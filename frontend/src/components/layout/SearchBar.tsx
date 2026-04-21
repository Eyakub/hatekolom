"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, BookOpen, BookMarked, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useLocaleStore } from "@/stores/locale-store";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface SearchResult {
  id: string;
  slug: string;
  title: string;
  title_bn?: string;
  thumbnail_url?: string;
  price?: string;
  is_free?: boolean;
  type: "course" | "ebook";
}

async function fetchResults(q: string): Promise<SearchResult[]> {
  if (!q.trim() || q.length < 2) return [];
  try {
    const [courses, ebooks] = await Promise.allSettled([
      fetch(`${API_BASE}/courses/?search=${encodeURIComponent(q)}&page_size=4`).then((r) => r.json()),
      fetch(`${API_BASE}/ebooks/?search=${encodeURIComponent(q)}&page_size=4`).then((r) => r.json()),
    ]);

    // CourseListItem: { id, product: { title, title_bn, slug, thumbnail_url, price, is_free } }
    const courseItems: SearchResult[] = (
      courses.status === "fulfilled" && Array.isArray(courses.value) ? courses.value : []
    ).map((c: any) => ({
      id: c.id,
      slug: c.product?.slug,
      title: c.product?.title,
      title_bn: c.product?.title_bn,
      thumbnail_url: c.product?.thumbnail_url,
      price: c.product?.price != null ? String(c.product.price) : undefined,
      is_free: c.product?.is_free,
      type: "course" as const,
    })).filter((c: any) => c.slug && c.title);

    // Ebook list: flat { id, slug, title, title_bn, thumbnail_url, price, is_free }
    const ebookItems: SearchResult[] = (
      ebooks.status === "fulfilled" && Array.isArray(ebooks.value) ? ebooks.value : []
    ).map((e: any) => ({
      id: e.id,
      slug: e.slug,
      title: e.title,
      title_bn: e.title_bn,
      thumbnail_url: e.thumbnail_url,
      price: e.price != null ? String(e.price) : undefined,
      is_free: e.is_free,
      type: "ebook" as const,
    })).filter((e: any) => e.slug && e.title);

    return [...courseItems, ...ebookItems].slice(0, 7);
  } catch {
    return [];
  }
}

export function SearchBar() {
  const router = useRouter();
  const { t, locale } = useLocaleStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Debounced search
  const doSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim() || q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const data = await fetchResults(q);
      setResults(data);
      setLoading(false);
      setOpen(true);
      setActiveIndex(-1);
    }, 300);
  }, []);

  useEffect(() => { doSearch(query); }, [query, doSearch]);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) {
      if (e.key === "Enter" && query.trim()) submitSearch();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) {
        const r = results[activeIndex];
        router.push(r.type === "course" ? `/courses/${r.slug}` : `/ebooks/${r.slug}`);
        closeDropdown();
      } else {
        submitSearch();
      }
    } else if (e.key === "Escape") {
      closeDropdown();
    }
  };

  const submitSearch = () => {
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    closeDropdown();
  };

  const closeDropdown = () => {
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  };

  const clear = () => {
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  const getLabel = (r: SearchResult) =>
    locale === "bn" && r.title_bn ? r.title_bn : r.title;

  const courses = results.filter((r) => r.type === "course");
  const ebooks = results.filter((r) => r.type === "ebook");

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      {/* Input */}
      <div className="relative flex items-center">
        <Search className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={t("কোর্স বা ই-বুক খুঁজুন...", "Search courses or books...")}
          className="w-full pl-9 pr-8 py-2 text-sm bg-gray-100/80 border border-transparent rounded-xl focus:outline-none focus:border-primary-300 focus:bg-white focus:shadow-sm transition-all placeholder:text-gray-400 font-bn"
        />
        {loading ? (
          <Loader2 className="absolute right-3 w-3.5 h-3.5 text-gray-400 animate-spin" />
        ) : query ? (
          <button
            onClick={clear}
            className="absolute right-3 w-3.5 h-3.5 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>

      {/* Dropdown */}
      {open && (results.length > 0 || loading) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
          {/* Courses section */}
          {courses.length > 0 && (
            <div>
              <div className="px-4 pt-3 pb-1 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-primary-500" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {t("কোর্স", "Courses")}
                </span>
              </div>
              {courses.map((r, idx) => {
                const globalIdx = idx;
                return (
                  <Link
                    key={r.id}
                    href={`/courses/${r.slug}`}
                    onClick={closeDropdown}
                    className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                      activeIndex === globalIdx ? "bg-primary-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary-100 shrink-0 overflow-hidden flex items-center justify-center">
                      {r.thumbnail_url ? (
                        <img src={r.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <BookOpen className="w-4 h-4 text-primary-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 font-bn truncate">{getLabel(r)}</p>
                      <p className="text-xs text-primary-600 font-bold mt-0.5">
                        {r.is_free ? t("বিনামূল্যে", "Free") : `৳${r.price}`}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* E-books section */}
          {ebooks.length > 0 && (
            <div className={courses.length > 0 ? "border-t border-gray-50" : ""}>
              <div className="px-4 pt-3 pb-1 flex items-center gap-1.5">
                <BookMarked className="w-3.5 h-3.5 text-violet-500" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {t("ই-বুক", "E-Books")}
                </span>
              </div>
              {ebooks.map((r, idx) => {
                const globalIdx = courses.length + idx;
                return (
                  <Link
                    key={r.id}
                    href={`/ebooks/${r.slug}`}
                    onClick={closeDropdown}
                    className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                      activeIndex === globalIdx ? "bg-violet-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-violet-100 shrink-0 overflow-hidden flex items-center justify-center">
                      {r.thumbnail_url ? (
                        <img src={r.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <BookMarked className="w-4 h-4 text-violet-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 font-bn truncate">{getLabel(r)}</p>
                      <p className="text-xs text-violet-600 font-bold mt-0.5">
                        {r.is_free ? t("বিনামূল্যে", "Free") : `৳${r.price}`}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* See all results */}
          {results.length > 0 && (
            <div className="border-t border-gray-50">
              <button
                onClick={submitSearch}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-primary-700 hover:bg-primary-50 transition-colors font-bn group"
              >
                <span>
                  &ldquo;{query}&rdquo; {t("দিয়ে সব রেজাল্ট দেখুন", "— see all results")}
                </span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* No results */}
      {open && !loading && query.length >= 2 && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 px-4 py-5 z-50 text-center">
          <Search className="w-6 h-6 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 font-bn">
            &ldquo;{query}&rdquo; {t("এর জন্য কোনো ফলাফল পাওয়া যায়নি", "— no results found")}
          </p>
        </div>
      )}
    </div>
  );
}
