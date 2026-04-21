"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenText, Download, Loader2, ExternalLink, Eye } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";

interface Entitlement {
  id: string;
  product_id: string;
  product_title: string;
  product_type: string;
  product_slug: string;
  granted_at: string;
}

export default function MyEbooksPage() {
  const router = useRouter();
  const { isAuthenticated, accessToken, _hasHydrated } = useAuthStore();
  const [ebooks, setEbooks] = useState<Entitlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) { router.push("/login"); return; }
    const load = async () => {
      try {
        const data: any = await api.get("/orders/my/entitlements", accessToken!);
        setEbooks((data || []).filter((e: any) => e.product_type === "ebook"));
      } catch {}
      setLoading(false);
    };
    load();
  }, [_hasHydrated, isAuthenticated, accessToken]);

  const handleDownload = async (ebook: Entitlement) => {
    if (!accessToken) return;
    setDownloading(ebook.id);
    try {
      // The download endpoint uses ebook entity ID, but we have product_id.
      // Call the download endpoint with product_id — the backend will resolve it.
      const res: any = await api.post(`/ebooks/${ebook.product_id}/download`, {}, accessToken);
      if (res.download_url) {
        // If relative URL (local mode), prepend API host
        const url = res.download_url.startsWith("/")
          ? `${(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1").replace("/api/v1", "")}${res.download_url}`
          : res.download_url;
        window.open(url, "_blank");
      } else if (res.message) {
        import("@/stores/toast-store").then((m) => m.toast.info(res.message));
      }
    } catch (err: any) {
      import("@/stores/toast-store").then((m) =>
        m.toast.error(err?.message || "ডাউনলোড করা যাচ্ছে না")
      );
    }
    setDownloading(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 text-primary-600 animate-spin" /></div>;
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 font-bn">আমার ই-বুক</h1>
        <p className="text-sm text-gray-400 font-bn mt-1">{ebooks.length} টি ই-বুক</p>
      </div>

      {ebooks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
          <BookOpenText className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-400 font-bn">কোনো ই-বুক নেই</h3>
          <p className="text-sm text-gray-400 font-bn mt-1">ই-বুক কিনলে এখানে দেখা যাবে</p>
          <Link href="/ebooks" className="mt-4 inline-flex items-center gap-2 px-6 py-2.5 bg-primary-700 text-white font-semibold rounded-full text-sm hover:bg-primary-800 transition-all font-bn">
            ই-বুক দেখো <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {ebooks.map((ebook) => (
            <div key={ebook.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
                  <BookOpenText className="w-6 h-6 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 font-bn text-sm">{ebook.product_title}</h3>
                  <p className="text-xs text-gray-400 mt-1">প্রাপ্ত: {new Date(ebook.granted_at).toLocaleDateString("bn-BD")}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      onClick={() => handleDownload(ebook)}
                      disabled={downloading === ebook.id}
                      className="inline-flex items-center gap-1.5 text-xs text-white bg-primary-700 hover:bg-primary-800 px-3 py-1.5 rounded-lg font-semibold transition-all disabled:opacity-50"
                    >
                      {downloading === ebook.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      ডাউনলোড
                    </button>
                    <Link
                      href={`/ebooks/${ebook.product_slug}`}
                      className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-primary-700 font-semibold transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" /> বিস্তারিত
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
