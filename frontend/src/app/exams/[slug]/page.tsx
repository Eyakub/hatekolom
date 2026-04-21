"use client";

import { useState, useEffect, use, useMemo } from "react";
import Link from "next/link";
import {
  GraduationCap, Clock, Target, Layers, FileText,
  ShoppingCart, ArrowRight, Loader2, BookOpen, CheckCircle2,
  AlertCircle, ChevronDown, ChevronUp, RefreshCw,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useCartStore } from "@/stores/cart-store";
import { useLocaleStore } from "@/stores/locale-store";
import { toast } from "@/stores/toast-store";
import { motion } from "motion/react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ExamSection {
  id: string;
  title: string;
  title_bn: string | null;
  question_count: number;
  total_points: number;
  time_limit_seconds: number | null;
}

interface ExamDetail {
  id: string;
  product: {
    id: string;
    title: string;
    title_bn: string | null;
    slug: string;
    description: string | null;
    description_bn: string | null;
    thumbnail_url: string | null;
    price: number;
    compare_price: number | null;
    is_free: boolean;
  };
  exam_type: "anytime" | "scheduled";
  pass_percentage: number;
  max_attempts: number | null;
  time_limit_seconds: number | null;
  total_sections: number;
  total_questions: number;
  scheduled_start: string | null;
  scheduled_end: string | null;
  sections: ExamSection[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h} ঘণ্টা ${m > 0 ? `${m} মিনিট` : ""}`;
  return `${m} মিনিট`;
}

function getScheduleStatus(
  start: string | null,
  end: string | null,
): "upcoming" | "live" | "ended" | null {
  if (!start) return null;
  const now = Date.now();
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : null;
  if (now < s) return "upcoming";
  if (e && now > e) return "ended";
  return "live";
}

/* ------------------------------------------------------------------ */
/*  Countdown hook                                                     */
/* ------------------------------------------------------------------ */

function useCountdown(targetDate: string | null) {
  const [remaining, setRemaining] = useState<string>("");

  useEffect(() => {
    if (!targetDate) return;
    const tick = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining("");
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      const parts: string[] = [];
      if (d > 0) parts.push(`${d} দিন`);
      if (h > 0) parts.push(`${h} ঘণ্টা`);
      if (m > 0) parts.push(`${m} মিনিট`);
      parts.push(`${s} সেকেন্ড`);
      setRemaining(parts.join(" "));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  return remaining;
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function ExamDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { isAuthenticated, accessToken } = useAuthStore();
  const { addItem } = useCartStore();
  const { t: tRaw } = useLocaleStore();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const t = (bn: string, en: string) => (mounted ? tRaw(bn, en) : bn);

  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cartAdded, setCartAdded] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>("");

  /* Fetch exam */
  useEffect(() => {
    const load = async () => {
      try {
        const data: any = await api.get(`/exams/slug/${slug}`);
        // API returns product fields flat — nest them for the UI
        if (data && !data.product) {
          data.product = {
            id: data.product_id,
            title: data.title,
            title_bn: data.title_bn,
            slug: data.slug,
            description: data.description,
            description_bn: data.description_bn,
            thumbnail_url: data.thumbnail_url,
            price: data.price,
            compare_price: data.compare_price,
            is_free: data.is_free,
            is_active: data.is_active,
          };
        }
        setExam(data);
      } catch {
        setExam(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  /* Check access (if authenticated) */
  useEffect(() => {
    if (!exam || !accessToken) return;
    const checkAccess = async () => {
      try {
        const data: any = await api.get(`/exams/${exam.id}/access`, accessToken);
        setHasAccess(data?.has_access === true);
      } catch {
        setHasAccess(false);
      }
    };
    if (exam.product.is_free) {
      setHasAccess(true);
    } else {
      checkAccess();
    }
  }, [exam, accessToken]);

  /* Load children for child selector */
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

  const scheduleStatus = useMemo(
    () => (exam ? getScheduleStatus(exam.scheduled_start, exam.scheduled_end) : null),
    [exam],
  );

  const countdown = useCountdown(
    scheduleStatus === "upcoming" ? exam?.scheduled_start ?? null : null,
  );

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ---------------------------------------------------------------- */
  /*  Loading state                                                    */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Not found                                                        */
  /* ---------------------------------------------------------------- */

  if (!exam) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-center p-8">
          <div>
            <GraduationCap className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-400 font-bn">
              {t("পরীক্ষা পাওয়া যায়নি", "Exam not found")}
            </h1>
            <Link
              href="/exams"
              className="text-primary-700 text-sm mt-2 inline-block hover:underline"
            >
              {t("← সকল পরীক্ষায় ফিরে যাও", "← Back to all exams")}
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Derived values                                                   */
  /* ---------------------------------------------------------------- */

  const totalPoints = exam.sections.reduce((a, s) => a + s.total_points, 0);

  const infoBadges = [
    {
      icon: Layers,
      label: t(`${exam.total_sections} টি সেকশন`, `${exam.total_sections} Sections`),
    },
    {
      icon: FileText,
      label: t(`${exam.total_questions} টি প্রশ্ন`, `${exam.total_questions} Questions`),
    },
    ...(exam.time_limit_seconds
      ? [
          {
            icon: Clock,
            label: formatDuration(exam.time_limit_seconds),
          },
        ]
      : []),
    {
      icon: Target,
      label: t(`পাস মার্ক ${exam.pass_percentage}%`, `Pass ${exam.pass_percentage}%`),
    },
    ...(exam.max_attempts
      ? [
          {
            icon: RefreshCw,
            label: t(`সর্বোচ্চ ${exam.max_attempts} বার`, `Max ${exam.max_attempts} attempts`),
          },
        ]
      : []),
    {
      icon: BookOpen,
      label:
        exam.exam_type === "scheduled"
          ? t("নির্ধারিত সময়", "Scheduled")
          : t("যেকোনো সময়", "Anytime"),
    },
  ];

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* ==================== Hero ==================== */}
      <div className="bg-gradient-hero">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="grid md:grid-cols-3 gap-8 items-start">
            {/* Left — Info */}
            <div className="md:col-span-2 text-white">
              {/* Exam type badge */}
              <div className="flex items-center gap-2 mb-4">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    exam.exam_type === "scheduled"
                      ? "bg-amber-500/80"
                      : "bg-white/20"
                  }`}
                >
                  {exam.exam_type === "scheduled"
                    ? t("নির্ধারিত সময়", "Scheduled")
                    : t("যেকোনো সময়", "Anytime")}
                </span>
                {exam.product.is_free && (
                  <span className="px-2 py-1 rounded-full bg-green-400 text-green-900 text-xs font-semibold">
                    {t("ফ্রি", "Free")}
                  </span>
                )}
              </div>

              <h1 className="text-3xl md:text-4xl font-bold font-bn leading-tight mb-4">
                {t(
                  exam.product.title_bn || exam.product.title,
                  exam.product.title,
                )}
              </h1>

              <p className="text-white/70 font-bn mb-6 max-w-2xl leading-relaxed">
                {t(
                  exam.product.description_bn || exam.product.description || "",
                  exam.product.description || "",
                )}
              </p>

              {/* Info badges */}
              <div className="flex flex-wrap gap-4 text-sm">
                {infoBadges.map((badge, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-white/80 bg-white/10 px-3 py-1.5 rounded-lg"
                  >
                    <badge.icon className="w-4 h-4" />
                    <span className="font-bn">{badge.label}</span>
                  </div>
                ))}
              </div>

              {/* Schedule countdown (if scheduled + upcoming) */}
              {scheduleStatus === "upcoming" && countdown && (
                <div className="mt-6 bg-white/10 backdrop-blur-sm rounded-xl p-4 inline-flex items-center gap-3">
                  <Clock className="w-5 h-5 text-amber-300" />
                  <div>
                    <p className="text-xs text-white/60 font-bn">
                      {t("পরীক্ষা শুরু হবে", "Exam starts in")}
                    </p>
                    <p className="text-white font-bold font-bn">{countdown}</p>
                  </div>
                </div>
              )}

              {scheduleStatus === "ended" && (
                <div className="mt-6 bg-red-500/20 backdrop-blur-sm rounded-xl p-4 inline-flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-300" />
                  <p className="text-white/90 font-bold font-bn">
                    {t("সময় শেষ", "Exam has ended")}
                  </p>
                </div>
              )}

              {scheduleStatus === "live" && (
                <div className="mt-6 bg-green-500/20 backdrop-blur-sm rounded-xl p-4 inline-flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                  <p className="text-white/90 font-bold font-bn">
                    {t("পরীক্ষা চলছে", "Exam is live")}
                  </p>
                </div>
              )}
            </div>

            {/* Right — Price / Action card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, type: "spring" }}
              whileHover={{ y: -8, scale: 1.02 }}
              className="bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] p-6 text-center border border-white/20 transform-gpu"
            >
              {/* Thumbnail */}
              <div className="relative h-40 rounded-xl overflow-hidden bg-gradient-to-br from-primary-200 to-primary-400 mb-5 flex items-center justify-center">
                {exam.product.thumbnail_url ? (
                  <img
                    src={exam.product.thumbnail_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <GraduationCap className="w-12 h-12 text-white/50" />
                )}
              </div>

              {/* Price */}
              {exam.product.is_free ? (
                <p className="text-3xl font-bold text-green-600 font-bn mb-2">
                  {t("ফ্রি", "Free")}
                </p>
              ) : (
                <div className="mb-2">
                  <p className="text-3xl font-bold text-gray-900">
                    ৳{exam.product.price}
                  </p>
                  {exam.product.compare_price && (
                    <p className="text-sm text-gray-400 line-through">
                      ৳{exam.product.compare_price}
                    </p>
                  )}
                </div>
              )}

              {/* Child selector (if authenticated and children exist) */}
              {isAuthenticated && children.length > 0 && (
                <div className="mt-3 mb-2">
                  <label className="text-xs text-gray-500 font-bn block mb-1 text-left">
                    {t("শিশু নির্বাচন করুন", "Select child")}
                  </label>
                  <select
                    value={selectedChild}
                    onChange={(e) => setSelectedChild(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-bn outline-none focus:border-primary-400"
                  >
                    {children.map((child: any) => (
                      <option key={child.id} value={child.id}>
                        {child.full_name_bn || child.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* CTA */}
              {scheduleStatus === "ended" ? (
                <div className="mt-4 py-3.5 bg-gray-100 text-gray-400 font-bold rounded-xl font-bn text-center">
                  {t("সময় শেষ", "Exam ended")}
                </div>
              ) : isAuthenticated && (hasAccess || exam.product.is_free) ? (
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="mt-4"
                >
                  {scheduleStatus === "upcoming" ? (
                    <div className="w-full inline-flex items-center justify-center gap-2 py-3.5 bg-amber-100 text-amber-700 font-bold rounded-xl font-bn">
                      <Clock className="w-4 h-4" />
                      {t("শীঘ্রই শুরু হবে", "Starting soon")}
                    </div>
                  ) : (
                    <Link
                      href={
                        selectedChild
                          ? `/exams/${exam.product.slug}/take?child=${selectedChild}&examId=${exam.id}`
                          : `/exams/${exam.product.slug}/take?examId=${exam.id}`
                      }
                      className="w-full inline-flex items-center justify-center gap-2 py-3.5 bg-primary-700 text-white font-bold rounded-xl hover:bg-primary-800 transition-colors shadow-lg shadow-primary-700/25 font-bn"
                    >
                      {t("পরীক্ষা শুরু করো", "Start Exam")}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                </motion.div>
              ) : !isAuthenticated && exam.product.is_free ? (
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="mt-4"
                >
                  <Link
                    href={`/login?redirect=/exams/${exam.product.slug}`}
                    className="w-full inline-flex items-center justify-center gap-2 py-3.5 bg-primary-700 text-white font-bold rounded-xl hover:bg-primary-800 transition-colors shadow-lg shadow-primary-700/25 font-bn"
                  >
                    {t("ফ্রি পরীক্ষা দিতে লগইন করো", "Login to Start Free Exam")}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </motion.div>
              ) : (
                <>
                  <motion.div
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="mt-4"
                  >
                    <Link
                      href={`/checkout?product=${exam.product.id}`}
                      className="w-full inline-flex items-center justify-center gap-2 py-3.5 bg-primary-700 text-white font-bold rounded-xl hover:bg-primary-800 transition-colors shadow-lg shadow-primary-700/25 font-bn"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      {t("পরীক্ষায় ভর্তি হও", "Enroll Now")}
                    </Link>
                  </motion.div>

                  <button
                    onClick={() => {
                      addItem({
                        productId: exam.product.id,
                        productType: "exam",
                        title: exam.product.title,
                        title_bn: exam.product.title_bn,
                        thumbnail_url: exam.product.thumbnail_url,
                        price: exam.product.price,
                        compare_price: exam.product.compare_price,
                        maxQuantity: 1,
                        slug: exam.product.slug,
                      });
                      setCartAdded(true);
                      toast.success(t("কার্টে যোগ হয়েছে", "Added to cart"));
                      setTimeout(() => setCartAdded(false), 2000);
                    }}
                    className={`w-full mt-2 py-3 border-2 font-bold rounded-xl text-sm flex items-center justify-center gap-2 font-bn transition-all ${
                      cartAdded
                        ? "border-emerald-500 text-emerald-600 bg-emerald-50"
                        : "border-primary-200 text-primary-700 hover:bg-primary-50"
                    }`}
                  >
                    {cartAdded
                      ? t("কার্টে যোগ হয়েছে ✓", "Added to Cart ✓")
                      : t("কার্টে যোগ করুন", "Add to Cart")}
                  </button>
                </>
              )}

              {/* Includes */}
              <div className="mt-6 text-left space-y-2.5">
                {[
                  t(`${exam.total_questions} টি প্রশ্ন`, `${exam.total_questions} Questions`),
                  t(`${exam.total_sections} টি সেকশন`, `${exam.total_sections} Sections`),
                  totalPoints > 0
                    ? t(`${totalPoints} পয়েন্ট`, `${totalPoints} Points`)
                    : null,
                  exam.time_limit_seconds
                    ? t(
                        `সময়: ${formatDuration(exam.time_limit_seconds)}`,
                        `Duration: ${formatDuration(exam.time_limit_seconds)}`,
                      )
                    : null,
                  t("তাৎক্ষণিক ফলাফল", "Instant results"),
                ]
                  .filter(Boolean)
                  .map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-2 text-sm text-gray-600"
                    >
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      <span className="font-bn">{item}</span>
                    </div>
                  ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ==================== Sections Preview ==================== */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        <h2 className="text-xl font-bold text-gray-900 font-bn mb-6">
          {t("পরীক্ষার সেকশনসমূহ", "Exam Sections")}
        </h2>

        {exam.sections.length === 0 ? (
          <div className="text-center py-12">
            <Layers className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400 font-bn">
              {t("সেকশনের তথ্য শীঘ্রই আসছে", "Section details coming soon")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {exam.sections.map((section, i) => {
              const isOpen = expandedSections.has(section.id);
              return (
                <div
                  key={section.id}
                  className="bg-white rounded-xl border border-gray-100 overflow-hidden"
                >
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <h3 className="font-semibold font-bn text-gray-900 text-sm text-left">
                        {t(
                          section.title_bn || section.title,
                          section.title,
                        )}
                      </h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 font-bn">
                        {t(
                          `${section.question_count} টি প্রশ্ন`,
                          `${section.question_count} questions`,
                        )}
                      </span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      transition={{ duration: 0.2 }}
                      className="px-4 pb-4 border-t border-gray-50"
                    >
                      <div className="pt-3 flex flex-wrap gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" />
                          <span className="font-bn">
                            {t(
                              `${section.question_count} টি প্রশ্ন`,
                              `${section.question_count} questions`,
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Target className="w-3.5 h-3.5" />
                          <span className="font-bn">
                            {t(
                              `${section.total_points} পয়েন্ট`,
                              `${section.total_points} points`,
                            )}
                          </span>
                        </div>
                        {section.time_limit_seconds && (
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            <span className="font-bn">
                              {formatDuration(section.time_limit_seconds)}
                            </span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Exam description (if long) */}
        {(exam.product.description_bn || exam.product.description) && (
          <div className="mt-10 pt-8 border-t border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 font-bn mb-4">
              {t("বিস্তারিত", "Details")}
            </h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-line font-bn">
              {t(
                exam.product.description_bn || exam.product.description || "",
                exam.product.description || "",
              )}
            </p>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
