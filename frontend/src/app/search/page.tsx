"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import {
  Search, BookOpen, BookMarked, Loader2, SlidersHorizontal, ArrowRight
} from "lucide-react";
import { useLocaleStore } from "@/stores/locale-store";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface CourseResult {
  id: string;
  slug: string;
  title: string;
  title_bn?: string;
  thumbnail_url?: string;
  price: string;
  is_free: boolean;
  course_type: string;
  level?: string;
  total_lessons: number;
}

interface EbookResult {
  id: string;
  slug: string;
  title: string;
  title_bn?: string;
  thumbnail_url?: string;
  price: number;
  is_free: boolean;
  author?: string;
}

function SearchResultsInner() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";
  const { t, locale } = useLocaleStore();

  const [courses, setCourses] = useState<CourseResult[]>([]);
  const [ebooks, setEbooks] = useState<EbookResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"all" | "courses" | "ebooks">("all");

  useEffect(() => {
    if (!q.trim()) return;
    const controller = new AbortController();
    setLoading(true);
    setCourses([]);
    setEbooks([]);

    Promise.allSettled([
      fetch(`${API_BASE}/courses/?search=${encodeURIComponent(q)}&page_size=20`, { signal: controller.signal }).then(r => r.json()),
      fetch(`${API_BASE}/ebooks/?search=${encodeURIComponent(q)}&page_size=20`, { signal: controller.signal }).then(r => r.json()),
    ]).then(([courseRes, ebookRes]) => {
      if (courseRes.status === "fulfilled" && Array.isArray(courseRes.value)) {
        setCourses(courseRes.value.map((c: any) => ({
          id: c.id,
          slug: c.product?.slug,
          title: c.product?.title,
          title_bn: c.product?.title_bn,
          thumbnail_url: c.product?.thumbnail_url,
          price: c.product?.price,
          is_free: c.product?.is_free,
          course_type: c.course_type,
          level: c.level,
          total_lessons: c.total_lessons,
        })).filter((c: CourseResult) => c.slug));
      }
      if (ebookRes.status === "fulfilled" && Array.isArray(ebookRes.value)) {
        setEbooks(ebookRes.value);
      }
      setLoading(false);
    });

    return () => controller.abort();
  }, [q]);

  const allCount = courses.length + ebooks.length;
  const getLabel = (title: string, title_bn?: string) =>
    locale === "bn" && title_bn ? title_bn : title;

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 py-10 w-full flex-1">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-3">
            <Search className="w-4 h-4" />
            <span className="font-bn">
              {loading
                ? t("খোঁজা হচ্ছে...", "Searching...")
                : `"${q}" ${t("এর জন্য", "—")} ${allCount} ${t("টি ফলাফল", "results found")}`}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 font-bn">
            {q}
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 bg-white border border-gray-100 rounded-2xl p-1.5 w-fit shadow-sm">
          {[
            { key: "all", label: t("সব", "All"), count: allCount },
            { key: "courses", label: t("কোর্স", "Courses"), count: courses.length },
            { key: "ebooks", label: t("ই-বুক", "E-Books"), count: ebooks.length },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key as typeof tab)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all font-bn ${
                tab === item.key
                  ? "bg-primary-700 text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
              }`}
            >
              {item.label}
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                tab === item.key ? "bg-white/20" : "bg-gray-100"
              }`}>
                {item.count}
              </span>
            </button>
          ))}
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden border border-gray-100 animate-pulse">
                <div className="h-40 bg-gray-100" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {!loading && (
          <>
            {/* No results */}
            {allCount === 0 && q && (
              <div className="text-center py-20">
                <Search className="w-14 h-14 text-gray-200 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-gray-400 font-bn">
                  {t(`"${q}" এর কোনো ফলাফল পাওয়া যায়নি`, `No results for "${q}"`)}
                </h2>
                <p className="text-gray-400 mt-2 font-bn text-sm">
                  {t("অন্য কীওয়ার্ড দিয়ে চেষ্টা করুন", "Try a different keyword")}
                </p>
                <div className="flex flex-wrap gap-3 justify-center mt-6">
                  <Link href="/courses" className="px-5 py-2.5 bg-primary-700 text-white rounded-xl text-sm font-bold hover:bg-primary-800 transition-all font-bn">
                    {t("সব কোর্স দেখুন", "Browse Courses")}
                  </Link>
                  <Link href="/ebooks" className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:border-gray-300 transition-all font-bn">
                    {t("সব ই-বুক দেখুন", "Browse E-Books")}
                  </Link>
                </div>
              </div>
            )}

            {/* Courses */}
            {(tab === "all" || tab === "courses") && courses.length > 0 && (
              <div className="mb-10">
                {tab === "all" && (
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-primary-600" />
                      <h2 className="font-bold text-gray-800 font-bn text-sm uppercase tracking-wide">
                        {t("কোর্স", "Courses")} ({courses.length})
                      </h2>
                    </div>
                    {courses.length > 3 && (
                      <button onClick={() => setTab("courses")} className="text-xs font-bold text-primary-600 hover:text-primary-800 flex items-center gap-1">
                        {t("সব দেখুন", "See all")} <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(tab === "all" ? courses.slice(0, 3) : courses).map((course) => (
                    <Link
                      key={course.id}
                      href={`/courses/${course.slug}`}
                      className="group bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-primary-200 hover:shadow-md transition-all"
                    >
                      <div className="h-40 bg-gradient-to-br from-primary-50 to-primary-100 relative overflow-hidden">
                        {course.thumbnail_url ? (
                          <img src={course.thumbnail_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <BookOpen className="w-10 h-10 text-primary-300" />
                          </div>
                        )}
                        <div className="absolute top-2 left-2">
                          <span className="px-2 py-0.5 bg-white/90 backdrop-blur-sm text-primary-700 text-[10px] font-bold rounded-full capitalize">
                            {course.course_type}
                          </span>
                        </div>
                      </div>
                      <div className="p-4">
                        <h3 className="font-bold text-gray-900 font-bn text-sm leading-snug line-clamp-2">
                          {getLabel(course.title, course.title_bn)}
                        </h3>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-xs text-gray-400 font-bn">
                            {course.total_lessons} {t("টি পাঠ", "lessons")}
                          </span>
                          <span className={`text-sm font-black ${course.is_free ? "text-green-600" : "text-primary-700"}`}>
                            {course.is_free ? t("বিনামূল্যে", "Free") : `৳${course.price}`}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* E-Books */}
            {(tab === "all" || tab === "ebooks") && ebooks.length > 0 && (
              <div>
                {tab === "all" && (
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <BookMarked className="w-4 h-4 text-violet-600" />
                      <h2 className="font-bold text-gray-800 font-bn text-sm uppercase tracking-wide">
                        {t("ই-বুক", "E-Books")} ({ebooks.length})
                      </h2>
                    </div>
                    {ebooks.length > 3 && (
                      <button onClick={() => setTab("ebooks")} className="text-xs font-bold text-violet-600 hover:text-violet-800 flex items-center gap-1">
                        {t("সব দেখুন", "See all")} <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(tab === "all" ? ebooks.slice(0, 3) : ebooks).map((ebook) => (
                    <Link
                      key={ebook.id}
                      href={`/ebooks/${ebook.slug}`}
                      className="group bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-violet-200 hover:shadow-md transition-all"
                    >
                      <div className="h-40 bg-gradient-to-br from-violet-50 to-violet-100 relative overflow-hidden">
                        {ebook.thumbnail_url ? (
                          <img src={ebook.thumbnail_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <BookMarked className="w-10 h-10 text-violet-300" />
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="font-bold text-gray-900 font-bn text-sm leading-snug line-clamp-2">
                          {getLabel(ebook.title, ebook.title_bn)}
                        </h3>
                        {ebook.author && (
                          <p className="text-xs text-gray-400 mt-1">{ebook.author}</p>
                        )}
                        <div className="flex items-center justify-end mt-3">
                          <span className={`text-sm font-black ${ebook.is_free ? "text-green-600" : "text-violet-700"}`}>
                            {ebook.is_free ? t("বিনামূল্যে", "Free") : `৳${ebook.price}`}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    }>
      <SearchResultsInner />
    </Suspense>
  );
}
