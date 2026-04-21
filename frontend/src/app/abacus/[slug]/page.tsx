"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2, ArrowLeft, ArrowRight, AlertCircle, Lock, CheckCircle,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useLocaleStore } from "@/stores/locale-store";
import { motion } from "motion/react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CourseDetail {
  id: string;
  title: string;
  title_bn: string | null;
  slug: string;
  description: string | null;
  description_bn: string | null;
  thumbnail_url: string | null;
  price: string;
  is_free: boolean;
  level_count: number;
}

interface LevelProgress {
  level_id: string;
  title: string;
  title_bn: string | null;
  sort_order: number;
  level_type: string;
  exercise_type: string;
  locked: boolean;
  completed: boolean;
  stars: number;
  best_score: number | null;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const LEVEL_TYPE_EMOJI: Record<string, string> = {
  tutorial: "\uD83D\uDCD6",
  test: "\uD83D\uDCDD",
  practice: "\u270F\uFE0F",
};

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function AbacusCourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const { isAuthenticated, accessToken } = useAuthStore();
  const { t: tRaw } = useLocaleStore();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const t = useCallback(
    (bn: string, en: string) => (mounted ? tRaw(bn, en) : bn),
    [mounted, tRaw],
  );

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState("");
  const [levels, setLevels] = useState<LevelProgress[]>([]);
  const [levelsLoading, setLevelsLoading] = useState(false);

  /* Fetch course detail */
  useEffect(() => {
    const load = async () => {
      try {
        const data: any = await api.get(`/abacus/slug/${slug}`);
        setCourse(data);
      } catch {
        setCourse(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  /* Load children (if authenticated) */
  useEffect(() => {
    if (!accessToken) return;
    const loadChildren = async () => {
      try {
        const data: any = await api.get("/children/", accessToken);
        const list = Array.isArray(data) ? data : data?.items || [];
        setChildren(list);
        if (list.length > 0) setSelectedChild(list[0].id);
      } catch {
        setChildren([]);
      }
    };
    loadChildren();
  }, [accessToken]);

  /* Fetch level progress when course + child are both available */
  useEffect(() => {
    if (!course || !selectedChild || !accessToken) return;
    const loadProgress = async () => {
      setLevelsLoading(true);
      try {
        const data: any = await api.get(
          `/abacus/${course.id}/progress?child_profile_id=${selectedChild}`,
          accessToken,
        );
        const items = Array.isArray(data) ? data : data?.items || data?.levels || [];
        setLevels(items);
      } catch {
        setLevels([]);
      } finally {
        setLevelsLoading(false);
      }
    };
    loadProgress();
  }, [course, selectedChild, accessToken]);

  /* ---------------------------------------------------------------- */
  /*  Loading state                                                    */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Not found                                                        */
  /* ---------------------------------------------------------------- */

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-center p-8">
          <div>
            <span className="text-6xl block mb-4">🧮</span>
            <h1 className="text-xl font-bold text-gray-400 font-bn">
              {t("কোর্স পাওয়া যায়নি", "Course not found")}
            </h1>
            <Link
              href="/abacus"
              className="text-amber-600 text-sm mt-2 inline-block hover:underline font-bn"
            >
              {t("\u2190 সব কোর্সে ফিরে যাও", "\u2190 Back to all courses")}
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Derived                                                          */
  /* ---------------------------------------------------------------- */

  const completedCount = levels.filter((l) => l.completed).length;
  const totalCount = levels.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* ==================== Hero ==================== */}
      <div className="relative h-48 sm:h-64 md:h-72 overflow-hidden">
        {course.thumbnail_url ? (
          <img
            src={course.thumbnail_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-amber-500 via-orange-500 to-red-400" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 max-w-7xl mx-auto">
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, type: "spring" }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-white/90 backdrop-blur text-gray-800 font-bn mb-3"
          >
            🧮 {t("অ্যাবাকাস কোর্স", "Abacus Course")}
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-2xl sm:text-3xl font-extrabold text-white font-bn leading-tight"
          >
            {t(course.title_bn || course.title, course.title)}
          </motion.h1>

          {(course.description_bn || course.description) && (
            <p className="text-white/70 font-bn mt-2 text-sm max-w-2xl leading-relaxed">
              {t(course.description_bn || course.description || "", course.description || "")}
            </p>
          )}
        </div>
      </div>

      {/* ==================== Main Content ==================== */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">

        {/* Auth gate */}
        {!isAuthenticated ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-xl px-4 py-3 border border-amber-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-bn">
                {t("লেভেল দেখতে লগইন করো", "Login to view levels")}
              </span>
            </div>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Link
                href={`/login?redirect=/abacus/${course.slug}`}
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-10 py-4 rounded-full font-bold text-lg shadow-lg shadow-amber-500/25 hover:shadow-xl transition-shadow font-bn"
              >
                {t("লগইন করো", "Login")} <ArrowRight className="w-5 h-5" />
              </Link>
            </motion.div>
          </div>
        ) : (
          <>
            {/* Child selector */}
            {children.length > 0 && (
              <div className="mb-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <label className="text-sm text-gray-600 font-bn block mb-1.5 font-semibold">
                  {t("শিশু নির্বাচন করুন", "Select child")}
                </label>
                <select
                  value={selectedChild}
                  onChange={(e) => setSelectedChild(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-bn outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                >
                  {children.map((child: any) => (
                    <option key={child.id} value={child.id}>
                      {child.full_name_bn || child.full_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* No child selected message */}
            {children.length === 0 && (
              <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
                <p className="text-sm text-amber-700 font-bn font-semibold">
                  {t(
                    "প্রথমে একটি শিশু প্রোফাইল তৈরি করুন",
                    "Please create a child profile first",
                  )}
                </p>
                <Link
                  href="/dashboard"
                  className="text-amber-600 text-sm mt-2 inline-block hover:underline font-bn font-bold"
                >
                  {t("ড্যাশবোর্ডে যাও", "Go to Dashboard")} &rarr;
                </Link>
              </div>
            )}

            {/* Progress summary */}
            {selectedChild && levels.length > 0 && (
              <div className="mb-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-gray-700 font-bn">
                    {t("অগ্রগতি", "Progress")}: Level {completedCount}/{totalCount}
                  </span>
                  <span className="text-sm font-bold text-amber-600">
                    {progressPercent}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
              </div>
            )}

            {/* Level map */}
            {selectedChild && levelsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
              </div>
            ) : selectedChild && levels.length > 0 ? (
              <div className="relative pb-8">
                {levels.map((level, index) => {
                  const isCompleted = level.completed;
                  const isLocked = level.locked;
                  const isCurrent = !isCompleted && !isLocked;
                  const isLast = index === levels.length - 1;
                  const emoji = LEVEL_TYPE_EMOJI[level.level_type] || "📝";

                  return (
                    <motion.div
                      key={level.level_id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: index * 0.08,
                        type: "spring",
                        stiffness: 300,
                        damping: 24,
                      }}
                      className="relative flex items-start gap-3 sm:gap-4"
                    >
                      {/* Vertical line + node */}
                      <div className="flex flex-col items-center shrink-0">
                        {/* Node circle */}
                        {isCompleted ? (
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/25">
                            <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                          </div>
                        ) : isCurrent ? (
                          <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-[#5341CD] flex items-center justify-center shadow-lg shadow-[#5341CD]/30 animate-pulse">
                            <span className="text-xl sm:text-2xl">{emoji}</span>
                          </div>
                        ) : (
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-300 flex items-center justify-center">
                            <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
                          </div>
                        )}

                        {/* Connecting line */}
                        {!isLast && (
                          <div
                            className={`w-0.5 flex-1 min-h-[40px] ${
                              isCompleted
                                ? "bg-green-400"
                                : "bg-gray-200 border-l border-dashed border-gray-300"
                            }`}
                          />
                        )}
                      </div>

                      {/* Content card */}
                      <div
                        className={`flex-1 min-w-0 mb-4 rounded-xl sm:rounded-2xl border p-3 sm:p-4 transition-all ${
                          isCompleted
                            ? "bg-green-50 border-green-200 cursor-pointer hover:shadow-md"
                            : isCurrent
                              ? "bg-white border-[#5341CD]/30 shadow-md"
                              : "bg-gray-50 border-gray-200 opacity-60"
                        }`}
                        onClick={() => {
                          if (isCompleted || isCurrent) {
                            router.push(
                              `/abacus/${slug}/level/${level.level_id}?child=${selectedChild}`,
                            );
                          }
                        }}
                        role={isCompleted || isCurrent ? "button" : undefined}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="min-w-0">
                            <p className={`text-[10px] sm:text-xs font-bold uppercase tracking-wide mb-0.5 ${
                              isCompleted
                                ? "text-green-600"
                                : isCurrent
                                  ? "text-[#5341CD]"
                                  : "text-gray-400"
                            }`}>
                              Level {level.sort_order}
                            </p>
                            <h3 className={`text-sm sm:text-base font-bold font-bn ${
                              isLocked ? "text-gray-400" : "text-gray-800"
                            }`}>
                              {t(level.title_bn || level.title, level.title)}
                            </h3>
                            <p className="text-xs text-gray-400 mt-0.5 font-bn capitalize">
                              {emoji} {level.level_type}
                              {level.exercise_type ? ` \u2022 ${level.exercise_type.replace("_", " ")}` : ""}
                            </p>
                          </div>

                          <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-1">
                            {/* Stars for completed */}
                            {isCompleted && level.stars > 0 && (
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3].map((s) => (
                                  <span
                                    key={s}
                                    className={`text-sm ${
                                      s <= level.stars ? "" : "opacity-20"
                                    }`}
                                  >
                                    ⭐
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Best score for completed */}
                            {isCompleted && level.best_score !== null && (
                              <span className="text-xs text-green-600 font-bold">
                                Best: {level.best_score}
                              </span>
                            )}

                            {/* Start button for current */}
                            {isCurrent && (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(
                                    `/abacus/${slug}/level/${level.level_id}?child=${selectedChild}`,
                                  );
                                }}
                                className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full text-sm font-bold shadow-md shadow-amber-500/25 hover:shadow-lg transition-shadow"
                              >
                                {t("শুরু করো", "Start")}
                              </motion.button>
                            )}

                            {/* Lock icon for locked */}
                            {isLocked && (
                              <span className="text-lg">🔒</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : selectedChild && !levelsLoading && levels.length === 0 ? (
              <div className="text-center py-16">
                <span className="text-5xl block mb-4">📭</span>
                <p className="text-gray-400 font-bn font-semibold">
                  {t("এখনো কোনো লেভেল নেই", "No levels available yet")}
                </p>
              </div>
            ) : null}
          </>
        )}

        {/* ==================== Back link ==================== */}
        <div className="mt-8">
          <Link
            href="/abacus"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-amber-600 transition-colors font-bn"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("ফিরে যাও", "Go back")}
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
}
