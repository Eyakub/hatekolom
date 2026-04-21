"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { api } from "@/lib/api";
import { useLocaleStore } from "@/stores/locale-store";
import { motion } from "motion/react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AbacusCourse {
  id: string;
  title: string;
  title_bn: string | null;
  slug: string;
  thumbnail_url: string | null;
  price: string;
  is_free: boolean;
  level_count: number;
  enrolled: boolean;
  progress_percent: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const FLOATING_EMOJIS = [
  { emoji: "\uD83E\uDDEE", delay: 0 },
  { emoji: "\uD83D\uDD22", delay: 0.5 },
  { emoji: "\uD83E\uDDE0", delay: 1.0 },
  { emoji: "\u2B50", delay: 1.5 },
  { emoji: "\uD83E\uDDEE", delay: 2.0 },
  { emoji: "\uD83D\uDD22", delay: 2.5 },
];

/* ------------------------------------------------------------------ */
/*  Inner component                                                    */
/* ------------------------------------------------------------------ */

function AbacusContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [courses, setCourses] = useState<AbacusCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const { t: tRaw } = useLocaleStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const t = useCallback(
    (bn: string, en: string) => (mounted ? tRaw(bn, en) : bn),
    [mounted, tRaw],
  );

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setSearch(searchInput);
    }
  };

  /* Fetch courses */
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.append("page", "1");
        params.append("page_size", "20");
        if (search) params.append("search", search);

        const data: any = await api.get(`/abacus/?${params.toString()}`);
        const items = Array.isArray(data) ? data : data?.items || [];
        setCourses(items);
      } catch {
        setCourses([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [search]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* ==================== Animated Hero ==================== */}
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-red-400 py-16 sm:py-20">
        {/* Particle dots */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(white 0.8px, transparent 0.8px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Floating emojis */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {FLOATING_EMOJIS.map((item, i) => (
            <motion.div
              key={i}
              className="absolute text-3xl sm:text-4xl"
              style={{
                left: `${10 + i * 15}%`,
                top: `${15 + (i % 3) * 25}%`,
              }}
              animate={{ y: [0, -10, 0] }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                delay: item.delay,
                ease: "easeInOut",
              }}
            >
              {item.emoji}
            </motion.div>
          ))}
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Animated title */}
          <motion.h1
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 12, duration: 0.8 }}
            className="text-4xl md:text-5xl font-extrabold text-white font-bn drop-shadow-lg"
          >
            {t("অ্যাবাকাস ওয়ার্ল্ড 🧮", "Abacus World 🧮")}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-white/70 font-bn mt-3 text-lg"
          >
            {t(
              "অ্যাবাকাস শিখো, গণিতে এগিয়ে যাও!",
              "Learn Abacus, excel in Math!",
            )}
          </motion.p>

          {/* Search bar */}
          <div className="max-w-xl mx-auto mt-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder={t("কোর্স খুঁজো...", "Search courses...")}
                className="w-full pl-12 pr-4 py-4 rounded-full bg-white border-2 border-white/80 shadow-2xl text-sm font-bn text-gray-800 placeholder:text-gray-400 focus:ring-4 focus:ring-amber-200 focus:border-amber-300 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ==================== Course Cards Grid ==================== */}
      <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-2xl overflow-hidden">
                <div className="animate-pulse bg-gray-200 aspect-[4/3] rounded-2xl" />
                <div className="p-4 space-y-2">
                  <div className="animate-pulse h-4 bg-gray-200 rounded w-3/4" />
                  <div className="animate-pulse h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-20">
            <span className="text-6xl block mb-4">🧮</span>
            <h3 className="text-lg font-semibold text-gray-400 font-bn">
              {t("কোনো কোর্স পাওয়া যায়নি", "No courses found")}
            </h3>
            <p className="text-sm text-gray-400 font-bn mt-1">
              {t(
                "অন্য কিছু দিয়ে খোঁজার চেষ্টা করুন",
                "Try a different search term",
              )}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.map((course, index) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, type: "spring", stiffness: 300, damping: 24 }}
                whileHover={{ scale: 1.03 }}
              >
                <Link href={`/abacus/${course.slug}`} className="block group">
                  <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow">
                    {/* Background image */}
                    {course.thumbnail_url ? (
                      <img
                        src={course.thumbnail_url}
                        alt={course.title_bn || course.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-amber-500 via-orange-500 to-red-400 flex items-center justify-center">
                        <span className="text-6xl">🧮</span>
                      </div>
                    )}

                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

                    {/* Level count badge -- top left */}
                    <div className="absolute top-3 left-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-white/90 backdrop-blur text-gray-800 font-bn">
                        📊 {course.level_count} {t("লেভেল", "Levels")}
                      </span>
                    </div>

                    {/* Price badge -- top right */}
                    <div className="absolute top-3 right-3">
                      {course.is_free ? (
                        <span className="px-2 py-0.5 rounded-full bg-green-500 text-white text-xs font-bold">
                          FREE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-xs font-bold">
                          &#x09F3;{course.price}
                        </span>
                      )}
                    </div>

                    {/* Bottom overlay content */}
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="text-white font-bold text-base font-bn leading-tight mb-1.5">
                        {t(course.title_bn || course.title, course.title)}
                      </h3>

                      {/* Progress bar (if enrolled) */}
                      {course.enrolled && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-white/80 text-xs font-bn">
                              {t("অগ্রগতি", "Progress")}
                            </span>
                            <span className="text-white/80 text-xs font-bold">
                              {course.progress_percent}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-white/30 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-400 rounded-full transition-all"
                              style={{ width: `${course.progress_percent}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page export (wrapped in Suspense for useSearchParams)              */
/* ------------------------------------------------------------------ */

export default function AbacusPage() {
  return (
    <Suspense>
      <AbacusContent />
    </Suspense>
  );
}
