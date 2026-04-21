import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://example.com";
const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1";

interface ProductItem {
  slug: string;
  updated_at?: string;
}

interface CourseProduct {
  product?: ProductItem;
}

/**
 * Dynamic sitemap generator.
 *
 * Static routes are always included. Dynamic course and ebook slugs
 * are fetched from the backend API at build / request time so the
 * sitemap stays in sync with the database automatically.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ── Static pages ──────────────────────────────────────────
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/courses`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/ebooks`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/register`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  // ── Dynamic course pages ──────────────────────────────────
  let courseRoutes: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${API_URL}/courses/?limit=500`, {
      next: { revalidate: 3600 }, // cache 1 hour
    });
    if (res.ok) {
      const data = await res.json();
      const courses: CourseProduct[] = data?.items || data || [];
      courseRoutes = courses
        .filter((c) => c.product?.slug)
        .map((c) => ({
          url: `${SITE_URL}/courses/${c.product!.slug}`,
          lastModified: c.product!.updated_at
            ? new Date(c.product!.updated_at)
            : new Date(),
          changeFrequency: "weekly" as const,
          priority: 0.7,
        }));
    }
  } catch {
    // API unavailable — skip dynamic courses
  }

  // ── Dynamic ebook pages ───────────────────────────────────
  let ebookRoutes: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${API_URL}/ebooks/?limit=500`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = await res.json();
      const ebooks: ProductItem[] = data?.items || data || [];
      ebookRoutes = ebooks
        .filter((e) => e.slug)
        .map((e) => ({
          url: `${SITE_URL}/ebooks/${e.slug}`,
          lastModified: e.updated_at ? new Date(e.updated_at) : new Date(),
          changeFrequency: "monthly" as const,
          priority: 0.6,
        }));
    }
  } catch {
    // API unavailable — skip dynamic ebooks
  }

  return [...staticRoutes, ...courseRoutes, ...ebookRoutes];
}
