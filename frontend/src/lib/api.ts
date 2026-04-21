const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1";

interface FetchOptions extends RequestInit {
  token?: string;
}

// Shared refresh state to avoid multiple concurrent refresh calls
let refreshPromise: Promise<any> | null = null;

function getStoredAuth(): { accessToken: string | null; refreshToken: string | null } {
  try {
    const raw = localStorage.getItem("hatekolom-auth");
    if (!raw) return { accessToken: null, refreshToken: null };
    const parsed = JSON.parse(raw);
    return {
      accessToken: parsed?.state?.accessToken || null,
      refreshToken: parsed?.state?.refreshToken || null,
    };
  } catch {
    return { accessToken: null, refreshToken: null };
  }
}

function updateStoredTokens(accessToken: string, refreshToken: string) {
  try {
    const raw = localStorage.getItem("hatekolom-auth");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    parsed.state.accessToken = accessToken;
    parsed.state.refreshToken = refreshToken;
    localStorage.setItem("hatekolom-auth", JSON.stringify(parsed));
  } catch {}
}

function clearAuthAndRedirect() {
  try {
    localStorage.removeItem("hatekolom-auth");
  } catch {}
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { token, headers: customHeaders, ...fetchOptions } = options;

    const headers: Record<string, string> = {};
    if (!(fetchOptions.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    Object.assign(headers, (customHeaders as Record<string, string>) || {});

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...fetchOptions,
      headers,
    });

    if (!response.ok) {
      // On 401, try refreshing the token before logging out
      if (response.status === 401 && token) {
        const newToken = await this.tryRefresh();
        if (newToken) {
          // Retry the original request with the new token
          const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` };
          const retryResponse = await fetch(`${this.baseUrl}${endpoint}`, {
            ...fetchOptions,
            headers: retryHeaders,
          });
          if (retryResponse.ok) {
            return retryResponse.json();
          }
        }
        // Refresh failed or retry failed — log out
        clearAuthAndRedirect();
      }

      const error = await response.json().catch(() => ({ detail: "Unknown error" }));
      let message = "Request failed";
      if (typeof error.detail === "string") {
        message = error.detail;
      } else if (Array.isArray(error.detail)) {
        // FastAPI validation errors: [{loc: [...], msg: "..."}, ...]
        message = error.detail.map((e: any) => {
          const field = e.loc?.slice(-1)[0] || "field";
          return `${field}: ${e.msg}`;
        }).join(", ");
      }
      throw new ApiError(response.status, message);
    }

    return response.json();
  }

  private async tryRefresh(): Promise<string | null> {
    const { refreshToken } = getStoredAuth();
    if (!refreshToken) return null;

    // If a refresh is already in progress, wait for it
    if (refreshPromise) {
      try {
        const result = await refreshPromise;
        return result?.access_token || null;
      } catch {
        return null;
      }
    }

    try {
      refreshPromise = fetch(`${this.baseUrl}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }).then((res) => {
        if (!res.ok) throw new Error("Refresh failed");
        return res.json();
      });

      const data = await refreshPromise;
      if (data?.access_token && data?.refresh_token) {
        updateStoredTokens(data.access_token, data.refresh_token);
        return data.access_token;
      }
      return null;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  }

  // Auth
  async register(data: { phone: string; password: string; full_name: string }) {
    return this.request("/auth/register", { method: "POST", body: JSON.stringify(data) });
  }

  async login(data: { phone: string; password: string }) {
    return this.request("/auth/login", { method: "POST", body: JSON.stringify(data) });
  }

  async refreshToken(refreshToken: string) {
    return this.request("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  }

  async getMe(token: string) {
    return this.request("/auth/me", { token });
  }

  // Children
  async createChild(token: string, data: any) {
    return this.request("/children/", { method: "POST", token, body: JSON.stringify(data) });
  }

  async listChildren(token: string) {
    return this.request("/children/", { token });
  }

  async getChild(token: string, childId: string) {
    return this.request(`/children/${childId}`, { token });
  }

  // Categories
  async listCategories() {
    return this.request("/categories/");
  }

  // Generic helpers
  get<T>(endpoint: string, token?: string) {
    return this.request<T>(endpoint, { token });
  }

  post<T>(endpoint: string, data: any, token?: string) {
    return this.request<T>(endpoint, { method: "POST", token, body: JSON.stringify(data) });
  }

  postFormData<T>(endpoint: string, data: FormData, token?: string) {
    return this.request<T>(endpoint, { method: "POST", token, body: data });
  }

  patch<T>(endpoint: string, data: any, token?: string) {
    return this.request<T>(endpoint, { method: "PATCH", token, body: JSON.stringify(data) });
  }

  put<T>(endpoint: string, data: any, token?: string) {
    return this.request<T>(endpoint, { method: "PUT", token, body: JSON.stringify(data) });
  }

  delete<T>(endpoint: string, token?: string) {
    return this.request<T>(endpoint, { method: "DELETE", token });
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export const api = new ApiClient(API_BASE);
