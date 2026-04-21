"use client";

import { useState, useEffect, use, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import {
  Loader2, XCircle, ArrowRight, Clock, Trophy,
  CheckCircle2, Star, Sun, CircleDashed, CircleDot,
  SkipForward, Rocket, Timer, AlertCircle, Layers,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Decorative particles                                               */
/* ------------------------------------------------------------------ */

const HappyParticles = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
    <motion.div
      initial={{ x: "-50vw", y: "50vh", rotate: 45, scale: 2 }}
      animate={{ x: "100vw", y: "-50vh" }}
      transition={{ duration: 1.5, ease: "easeInOut" }}
      className="absolute text-8xl"
    >
      🚀
    </motion.div>
  </div>
);

const SadParticles = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
    {[...Array(10)].map((_, i) => (
      <motion.div
        key={i}
        initial={{ y: "-10vh", opacity: 0 }}
        animate={{ y: "110vh", opacity: [0, 0.5, 0] }}
        transition={{
          duration: 1 + Math.random(),
          repeat: Infinity,
          delay: Math.random() * 2,
          ease: "linear",
        }}
        className="absolute w-1 h-8 bg-blue-300 rounded-full blur-[1px]"
        style={{ left: `${Math.random() * 100}%` }}
      />
    ))}
  </div>
);

/* ------------------------------------------------------------------ */
/*  Option button style presets                                        */
/* ------------------------------------------------------------------ */

const optionStyles = [
  {
    bg: "bg-white", iconBg: "bg-orange-100", text: "text-gray-900",
    iconText: "text-orange-600",
    hoverBorder: "hover:border-orange-500 hover:shadow-orange-500/10",
    activeBorder: "border-orange-500 bg-orange-50",
    icon: Sun, label: "Option A",
  },
  {
    bg: "bg-white", iconBg: "bg-blue-100", text: "text-gray-900",
    iconText: "text-blue-600",
    hoverBorder: "hover:border-blue-500 hover:shadow-blue-500/10",
    activeBorder: "border-blue-500 bg-blue-50",
    icon: Star, label: "Option B",
  },
  {
    bg: "bg-white", iconBg: "bg-primary-100", text: "text-gray-900",
    iconText: "text-primary-600",
    hoverBorder: "hover:border-primary-500 hover:shadow-primary-500/10",
    activeBorder: "border-primary-500 bg-primary-50",
    icon: CircleDashed, label: "Option C",
  },
  {
    bg: "bg-white", iconBg: "bg-rose-100", text: "text-gray-900",
    iconText: "text-rose-600",
    hoverBorder: "hover:border-rose-500 hover:shadow-rose-500/10",
    activeBorder: "border-rose-500 bg-rose-50",
    icon: CircleDot, label: "Option D",
  },
];

/* ------------------------------------------------------------------ */
/*  Inner component (needs useSearchParams → must be inside Suspense)  */
/* ------------------------------------------------------------------ */

function ExamTakeInner({ slug }: { slug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const childId = searchParams.get("child");
  const examIdFromQuery = searchParams.get("examId");
  const { accessToken } = useAuthStore();

  /* ---- state ---- */
  const [exam, setExam] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);

  /* ---- sessionStorage key for this exam+child ---- */
  const storageKey = `exam_progress_${slug}_${childId}`;

  /* ---- persist progress to sessionStorage ---- */
  useEffect(() => {
    if (!exam || result) return;
    sessionStorage.setItem(storageKey, JSON.stringify({
      answers,
      currentSectionIndex,
      currentQuestionIndex,
      timeLeft,
    }));
  }, [answers, currentSectionIndex, currentQuestionIndex, timeLeft, exam, result, storageKey]);

  /* ---- warn before reload/close during active exam ---- */
  useEffect(() => {
    if (!exam || result) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [exam, result]);

  /* ---- load exam ---- */
  useEffect(() => {
    if (!slug || !accessToken || !childId) return;
    (async () => {
      try {
        // Resolve exam ID from slug or query param
        let resolvedId = examIdFromQuery;
        if (!resolvedId) {
          const detail: any = await api.get(`/exams/slug/${slug}`);
          resolvedId = detail.id;
        }
        const data: any = await api.get(
          `/exams/${resolvedId}/start?child_profile_id=${childId}`,
          accessToken,
        );
        setExam(data);

        // Restore progress from sessionStorage if available
        const saved = sessionStorage.getItem(storageKey);
        if (saved) {
          try {
            const progress = JSON.parse(saved);
            if (progress.answers && Object.keys(progress.answers).length > 0) {
              setAnswers(progress.answers);
            }
            if (typeof progress.currentSectionIndex === "number") {
              setCurrentSectionIndex(progress.currentSectionIndex);
            }
            if (typeof progress.currentQuestionIndex === "number") {
              setCurrentQuestionIndex(progress.currentQuestionIndex);
            }
            // Restore remaining time (use saved time, not full duration)
            if (data.time_limit_seconds && typeof progress.timeLeft === "number" && progress.timeLeft > 0) {
              setTimeLeft(progress.timeLeft);
            } else if (data.time_limit_seconds) {
              setTimeLeft(data.time_limit_seconds);
            }
          } catch {
            // Corrupted data — start fresh
            if (data.time_limit_seconds) setTimeLeft(data.time_limit_seconds);
          }
        } else {
          if (data.time_limit_seconds) {
            setTimeLeft(data.time_limit_seconds);
          }
        }
      } catch (err: any) {
        if (err instanceof ApiError) {
          setError({ status: err.status, message: err.message });
        } else {
          setError({ status: 500, message: "কিছু একটা সমস্যা হয়েছে" });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, examIdFromQuery, accessToken, childId]);

  /* ---- timer ---- */
  useEffect(() => {
    if (!exam || timeLeft <= 0 || result) return;
    const timer = setTimeout(() => {
      const next = timeLeft - 1;
      setTimeLeft(next);
      if (next === 0) handleSubmit();
    }, 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, result, exam]);

  /* ---- helpers ---- */
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const selectAnswer = (questionId: string, optionId: string) => {
    if (result) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const handleSubmit = async () => {
    if (!exam || submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        child_profile_id: childId,
        answers: Object.entries(answers).map(([question_id, selected_option_id]) => ({
          question_id,
          selected_option_id,
        })),
      };
      const res: any = await api.post(`/exams/${exam.id}/submit`, payload, accessToken!);
      sessionStorage.removeItem(storageKey);
      setResult(res);
    } catch {
      const { toast } = await import("@/stores/toast-store");
      toast.error("সাবমিট করা যায়নি");
    } finally {
      setSubmitting(false);
    }
  };

  /* ---- navigation ---- */
  const sections: any[] = exam?.sections ?? [];
  const currentSection = sections[currentSectionIndex];
  const questions: any[] = currentSection?.questions ?? [];
  const currentQuestion = questions[currentQuestionIndex];

  const isLastQuestionOfSection = currentQuestionIndex === questions.length - 1;
  const isLastSection = currentSectionIndex === sections.length - 1;
  const isVeryLast = isLastQuestionOfSection && isLastSection;

  const handleNext = () => {
    if (isVeryLast) {
      handleSubmit();
    } else if (isLastQuestionOfSection) {
      setCurrentSectionIndex((i) => i + 1);
      setCurrentQuestionIndex(0);
    } else {
      setCurrentQuestionIndex((i) => i + 1);
    }
  };

  const handleSkip = () => handleNext();

  const switchSection = (idx: number) => {
    setCurrentSectionIndex(idx);
    setCurrentQuestionIndex(0);
  };

  /* ---------------------------------------------------------------- */
  /*  1. Loading screen                                                */
  /* ---------------------------------------------------------------- */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fbf9f8] font-bn">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#5341CD]" />
          <p className="text-gray-500 text-lg font-bold">পরীক্ষা লোড হচ্ছে...</p>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Error screen                                                     */
  /* ---------------------------------------------------------------- */
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fbf9f8] font-bn px-4">
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-10 max-w-md w-full text-center space-y-5">
          <AlertCircle className="w-14 h-14 text-red-400 mx-auto" />
          <h2 className="text-2xl font-extrabold text-gray-900">
            {error.status === 403
              ? "পরীক্ষায় প্রবেশাধিকার নেই"
              : "সমস্যা হয়েছে"}
          </h2>
          <p className="text-gray-500">{error.message}</p>
          <button
            onClick={() => router.push(`/exams/${slug}`)}
            className="inline-flex items-center gap-2 bg-[#5341CD] text-white px-6 py-3 rounded-full font-bold hover:opacity-90 transition"
          >
            ফিরে যাও <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (!exam) return null;

  /* ---------------------------------------------------------------- */
  /*  3. Result screen                                                 */
  /* ---------------------------------------------------------------- */
  if (result) {
    const correctCount = result.results
      ? result.results.filter((r: any) => r.is_correct).length
      : 0;
    const skippedCount = result.results
      ? result.results.filter((r: any) => !r.selected_option_id).length
      : 0;
    const totalCount = result.results ? result.results.length : 0;
    const wrongCount = totalCount - correctCount - skippedCount;
    const scorePct = parseFloat(result.score);
    const circumference = 2 * Math.PI * 40;

    const wrongAndSkipped = result.results
      ? result.results.filter((r: any) => !r.is_correct)
      : [];

    return (
      <div className="min-h-screen bg-[#fbf9f8] relative overflow-hidden flex flex-col font-bn text-gray-900">
        {/* Background dots */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none z-0"
          style={{
            backgroundImage: "radial-gradient(#5341cd 0.6px, transparent 0.6px)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Header */}
        <header className="bg-white/80 backdrop-blur-xl w-full z-20 flex justify-between items-center px-6 sm:px-10 py-4 shadow-[0_4px_30px_rgba(0,0,0,0.02)] border-b border-gray-100/50">
          <div className="text-xl sm:text-2xl font-extrabold text-[#5341CD] tracking-wide">
            ফলাফল বিশ্লেষণ
          </div>
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-gray-600 hover:scale-105 transition-all outline-none"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </header>

        {/* Main — 30/70 split */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 relative z-10 overflow-y-auto">
          <div className="flex flex-col lg:flex-row gap-6">

            {/* LEFT: Summary sidebar (30%) — sticky */}
            <div className="w-full lg:w-[30%] lg:sticky lg:top-6 lg:self-start space-y-4">
              {/* Score card */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0, y: 30 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", bounce: 0.5, duration: 0.6 }}
                className={`relative rounded-2xl w-full p-6 shadow-[0_20px_40px_rgba(27,28,28,0.06)] overflow-hidden border-2 ${
                  result.passed ? "bg-white border-green-200" : "bg-white border-red-100"
                }`}
              >
                {result.passed ? <HappyParticles /> : <SadParticles />}

                {/* Title */}
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className={`text-xl font-extrabold relative z-10 tracking-tight text-center mb-5 ${
                    result.passed ? "text-green-600" : "text-gray-900"
                  }`}
                >
                  {result.passed
                    ? "অসাধারণ! 🎉"
                    : "উত্তীর্ণ হতে পারোনি 😞"}
                </motion.h2>

                {/* Donut */}
                <div className="flex flex-col items-center relative z-10">
                  <motion.div
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", bounce: 0.5, duration: 0.8, delay: 0.3 }}
                    className="relative w-36 h-36 mb-5"
                  >
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" className="stroke-gray-100" strokeWidth="10" fill="none" />
                      <motion.circle
                        cx="50" cy="50" r="40"
                        className={result.passed ? "stroke-[#5341CD]" : "stroke-red-400"}
                        strokeWidth="10" fill="none" strokeLinecap="round"
                        strokeDasharray={circumference}
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset: circumference * (1 - scorePct / 100) }}
                        transition={{ duration: 1.2, ease: "easeOut", delay: 0.5 }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-3xl font-black font-mono ${result.passed ? "text-[#5341CD]" : "text-red-500"}`}>
                        {scorePct.toFixed(0)}%
                      </span>
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">Score</span>
                    </div>
                  </motion.div>

                  {/* Metrics */}
                  <div className="w-full space-y-2">
                    <div className="bg-green-50 rounded-xl px-4 py-2.5 flex items-center justify-between border border-green-100/80">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-xs font-bold text-green-700">সঠিক উত্তর</span>
                      </div>
                      <span className="font-black text-green-700 tabular-nums">{correctCount}</span>
                    </div>
                    <div className="bg-red-50 rounded-xl px-4 py-2.5 flex items-center justify-between border border-red-100/80">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-xs font-bold text-red-700">ভুল উত্তর</span>
                      </div>
                      <span className="font-black text-red-700 tabular-nums">{wrongCount}</span>
                    </div>
                    <div className="bg-gray-50 rounded-xl px-4 py-2.5 flex items-center justify-between border border-gray-200/80">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gray-400" />
                        <span className="text-xs font-bold text-gray-600">এড়িয়ে যাওয়া</span>
                      </div>
                      <span className="font-black text-gray-700 tabular-nums">{skippedCount}</span>
                    </div>
                    <div className="bg-[#f3f0ff] rounded-xl px-4 py-2.5 flex items-center justify-between border border-[#5341CD]/10">
                      <div className="flex items-center gap-2">
                        <Trophy className={`w-3.5 h-3.5 ${result.passed ? "text-[#ffb787]" : "text-gray-400"}`} />
                        <span className="text-xs font-bold text-[#5341CD]">পয়েন্ট</span>
                      </div>
                      <span className="font-black text-[#5341CD] tabular-nums">
                        {result.earned_points}/{result.total_points}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Section breakdown */}
              {result.section_scores && result.section_scores.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.5 }}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
                >
                  <h3 className="text-sm font-extrabold text-gray-700 mb-3 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#5341CD]" />
                    সেকশন অনুযায়ী
                  </h3>
                  <div className="space-y-2.5">
                    {result.section_scores.map((ss: any) => {
                      const pct = ss.total > 0 ? (ss.earned / ss.total) * 100 : 0;
                      return (
                        <div key={ss.section_id}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-gray-700">
                              {ss.title_bn || ss.title}
                            </span>
                            <span className="text-xs font-black text-[#5341CD] tabular-nums">
                              {ss.earned}/{ss.total}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#5341CD] rounded-full transition-all duration-700"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </div>

            {/* RIGHT: Wrong answers review (70%) */}
            <div className="w-full lg:w-[70%]">
              {wrongAndSkipped.length === 0 ? (
                /* ===== ALL CORRECT — celebration + full review ===== */
                <div className="space-y-4">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border-2 border-green-200 p-6 text-center shadow-sm"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", bounce: 0.6, delay: 0.8 }}
                      className="text-5xl mb-3"
                    >
                      🏆
                    </motion.div>
                    <h3 className="text-xl font-extrabold text-green-700 mb-1">সব উত্তর সঠিক!</h3>
                    <p className="text-sm text-green-600/70">তুমি সব প্রশ্নের সঠিক উত্তর দিয়েছো। অসাধারণ!</p>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.9 }}
                  >
                    <h3 className="text-sm font-extrabold text-gray-600 mb-3 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      তোমার সব সঠিক উত্তর
                    </h3>
                  </motion.div>

                  {result.results.map((r: any, ri: number) => {
                    const correctOption = r.options.find((o: any) => o.is_correct);

                    return (
                      <motion.div
                        key={r.question_id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.0 + ri * 0.04 }}
                        className="bg-white rounded-2xl border border-green-100 shadow-sm overflow-hidden"
                      >
                        <div className="p-4 flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0 mt-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-3">
                              <div className="flex-1 min-w-0">
                                {r.image_url && (
                                  <img src={r.image_url} alt="" className="w-full max-w-xs aspect-video object-cover rounded-lg mb-2" />
                                )}
                                {(r.question_text || r.question_text_bn) && (
                                  <p className="text-sm font-bold text-gray-800 mb-1">
                                    {r.question_text_bn || r.question_text}
                                  </p>
                                )}
                              </div>
                              <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full shrink-0">
                                +{r.points}
                              </span>
                            </div>
                            {correctOption && (
                              <div className="mt-2 flex items-center gap-2 bg-green-50/60 rounded-lg px-3 py-2 border border-green-100">
                                {correctOption.image_url && (
                                  <img src={correctOption.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                                )}
                                {(correctOption.option_text || correctOption.option_text_bn) && (
                                  <span className="text-sm font-bold text-green-700">
                                    {correctOption.option_text_bn || correctOption.option_text}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                /* ===== HAS WRONG ANSWERS — wrong answer review ===== */
                <div className="space-y-4">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    <h3 className="text-lg font-extrabold text-gray-800 mb-1 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-red-400" />
                      ভুল ও এড়িয়ে যাওয়া উত্তরসমূহ
                    </h3>
                    <p className="text-xs text-gray-500 mb-4">
                      নিচে তোমার ভুল উত্তর এবং সঠিক উত্তর দেখানো হলো
                    </p>
                  </motion.div>

                  {wrongAndSkipped.map((r: any, ri: number) => {
                    const selectedOption = r.options.find((o: any) => o.id === r.selected_option_id);
                    const correctOption = r.options.find((o: any) => o.is_correct);

                    return (
                      <motion.div
                        key={r.question_id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 + ri * 0.05 }}
                        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                      >
                        {/* Question */}
                        <div className="p-5 border-b border-gray-50">
                          <div className="flex items-start gap-3">
                            <div className="w-7 h-7 rounded-full bg-red-50 text-red-500 flex items-center justify-center shrink-0 mt-0.5">
                              <span className="text-xs font-bold">{ri + 1}</span>
                            </div>
                            <div className="flex-1">
                              {r.image_url && (
                                <img
                                  src={r.image_url}
                                  alt=""
                                  className="w-full max-w-md aspect-video object-cover rounded-xl mb-3"
                                />
                              )}
                              {(r.question_text || r.question_text_bn) && (
                                <p className="text-base font-bold text-gray-900">
                                  {r.question_text_bn || r.question_text}
                                </p>
                              )}
                              <span className="text-[10px] font-bold text-gray-400 mt-1 block">
                                {r.points} পয়েন্ট
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Answer comparison */}
                        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Student's wrong answer */}
                          <div className={`rounded-xl border-2 p-3 ${
                            r.selected_option_id
                              ? "border-red-200 bg-red-50/50"
                              : "border-gray-200 bg-gray-50/50"
                          }`}>
                            <span className={`text-[10px] font-bold uppercase tracking-wider block mb-2 ${
                              r.selected_option_id ? "text-red-400" : "text-gray-400"
                            }`}>
                              {r.selected_option_id ? "তোমার উত্তর ✗" : "এড়িয়ে গেছো"}
                            </span>
                            {selectedOption ? (
                              <div className="flex items-center gap-2">
                                {selectedOption.image_url && (
                                  <img src={selectedOption.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                                )}
                                {(selectedOption.option_text || selectedOption.option_text_bn) && (
                                  <span className="text-sm font-bold text-red-700">
                                    {selectedOption.option_text_bn || selectedOption.option_text}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400 italic">উত্তর দেওয়া হয়নি</span>
                            )}
                          </div>

                          {/* Correct answer */}
                          <div className="rounded-xl border-2 border-green-200 bg-green-50/50 p-3">
                            <span className="text-[10px] font-bold text-green-500 uppercase tracking-wider block mb-2">
                              সঠিক উত্তর ✓
                            </span>
                            {correctOption ? (
                              <div className="flex items-center gap-2">
                                {correctOption.image_url && (
                                  <img src={correctOption.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                                )}
                                {(correctOption.option_text || correctOption.option_text_bn) && (
                                  <span className="text-sm font-bold text-green-700">
                                    {correctOption.option_text_bn || correctOption.option_text}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="w-full bg-white/90 backdrop-blur-xl px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-center border-t border-gray-100 z-20 shadow-[0_-15px_40px_rgba(0,0,0,0.03)]">
          <button
            onClick={() => {
              router.push(
                exam.product?.slug
                  ? `/exams/${exam.product.slug}`
                  : "/dashboard",
              );
            }}
            className="group px-8 sm:px-10 py-3.5 sm:py-4 rounded-full font-bold text-lg sm:text-xl flex items-center justify-center gap-3 transition-all bg-[#5341CD] text-white shadow-xl shadow-primary-600/30 hover:shadow-primary-600/50 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
          >
            ফলাফল দেখা শেষ
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </button>
        </footer>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  2. Active exam screen                                            */
  /* ---------------------------------------------------------------- */
  const totalQuestionsInSection = questions.length;
  const currentQNum = currentQuestionIndex + 1;
  const progressPct = (currentQNum / totalQuestionsInSection) * 100;
  const timeProgressPct = exam.time_limit_seconds
    ? ((exam.time_limit_seconds - timeLeft) / exam.time_limit_seconds) * 100
    : 0;

  const nextButtonLabel = isVeryLast
    ? "সাবমিট করো"
    : isLastQuestionOfSection
      ? "পরবর্তী সেকশন"
      : "পরবর্তী প্রশ্ন";

  return (
    <div className="min-h-screen bg-[#fbf9f8] relative overflow-hidden flex flex-col font-bn text-gray-900">
      {/* Background dots */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none z-0"
        style={{
          backgroundImage: "radial-gradient(#5341cd 0.6px, transparent 0.6px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* ---- Top bar ---- */}
      <header className="bg-white/80 backdrop-blur-xl w-full z-20 flex justify-between items-center px-4 sm:px-10 py-4 shadow-[0_4px_30px_rgba(0,0,0,0.02)] border-b border-gray-100/50">
        <div className="text-lg sm:text-2xl font-extrabold text-[#5341CD] tracking-wide truncate max-w-[50%]">
          {exam.title_bn || exam.title}
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          {/* Timer */}
          {exam.time_limit_seconds > 0 && (
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm sm:text-base font-bold font-mono ${
                timeLeft < 60
                  ? "bg-red-50 text-red-600 animate-pulse border border-red-200"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              <Clock className="w-4 h-4" />
              {formatTime(timeLeft)}
            </div>
          )}
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-gray-600 hover:scale-105 transition-all outline-none"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* ---- Section tabs ---- */}
      {sections.length > 1 && (
        <div className="w-full z-10 bg-white/60 backdrop-blur-lg border-b border-gray-100/50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 overflow-x-auto scrollbar-hide">
            <div className="flex gap-2 py-3">
              {sections.map((sec: any, idx: number) => {
                const isActive = idx === currentSectionIndex;
                /* Count answered questions in this section */
                const answeredInSection = sec.questions.filter(
                  (q: any) => answers[q.id],
                ).length;
                return (
                  <button
                    key={sec.id}
                    onClick={() => switchSection(idx)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all shrink-0 ${
                      isActive
                        ? "bg-[#5341CD] text-white shadow-md shadow-primary-600/20"
                        : "bg-white text-gray-600 border border-gray-200 hover:border-[#5341CD]/40 hover:text-[#5341CD]"
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    {sec.title_bn || sec.title}
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {answeredInSection}/{sec.questions.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ---- Main content ---- */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-5 flex flex-col items-center gap-3 sm:gap-4 relative z-10 overflow-y-auto">
        {/* Progress & Stats */}
        <section className="w-full space-y-2 sm:space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[#5341cd] font-bold text-sm">
              প্রশ্ন {currentQNum} / {totalQuestionsInSection}
            </span>
            <div className="flex items-center gap-3">
              {exam.time_limit_seconds > 0 && (
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500">
                  <Timer className="w-3.5 h-3.5 text-orange-500" />
                  <span className={`font-mono ${timeLeft < 60 ? "text-red-500 animate-pulse" : ""}`}>
                    {formatTime(timeLeft)}
                  </span>
                </div>
              )}
              <div className="bg-[#e4dfff] px-3 py-1 rounded-full text-[#4029ba] font-bold text-xs tracking-widest">
                {currentQuestion?.points ?? 1} পয়েন্ট
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="relative h-2 w-full bg-[#eae8e7] rounded-full border border-gray-200">
            <div
              className="absolute top-0 left-0 h-full bg-[#6c5ce7] rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </section>

        {/* Question navigation grid — compact inline */}
        <section className="w-full">
          <div className="flex flex-wrap gap-1.5">
            {questions.map((q: any, idx: number) => {
              const isActive = idx === currentQuestionIndex;
              const isAnswered = !!answers[q.id];
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className={`w-7 h-7 rounded-lg text-[10px] font-bold transition-all ${
                    isActive
                      ? "bg-[#5341CD] text-white shadow-md scale-105"
                      : isAnswered
                        ? "bg-green-100 text-green-700 border border-green-200"
                        : "bg-white text-gray-400 border border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </section>

        {/* Question + Options */}
        {currentQuestion && (() => {
          const hasQuestionImage = !!currentQuestion.image_url;
          const hasOptionImages = currentQuestion.options.some((o: any) => o.image_url);

          /* ---- Shared: render a single option button ---- */
          const renderOption = (opt: any, index: number, compact?: boolean) => {
            const isSelected = answers[currentQuestion.id] === opt.id;
            const style = optionStyles[index % 4];
            const hasImage = !!opt.image_url;

            return (
              <button
                key={opt.id}
                onClick={() => selectAnswer(currentQuestion.id, opt.id)}
                className={`group relative rounded-xl flex flex-col items-center justify-center ${compact ? "p-2" : "p-2.5"} text-center transition-all duration-300 active:scale-[0.98] border-2 shadow-sm ${
                  isSelected
                    ? style.activeBorder
                    : `border-transparent ${style.hoverBorder} ${style.bg}`
                }`}
              >
                {hasImage ? (
                  <div className="w-full aspect-square rounded-lg overflow-hidden mb-1.5">
                    <img
                      src={opt.image_url}
                      alt={opt.option_text || `Option ${String.fromCharCode(65 + index)}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className={`w-9 h-9 rounded-full ${style.iconBg} flex items-center justify-center mb-1.5 shrink-0`}>
                    <style.icon className={`w-4 h-4 ${style.iconText} ${isSelected ? "fill-current" : ""}`} />
                  </div>
                )}
                {(opt.option_text || opt.option_text_bn) && (
                  <span className={`text-xs sm:text-sm font-bold font-bn ${style.text} line-clamp-2`}>
                    {opt.option_text_bn || opt.option_text}
                  </span>
                )}
                {isSelected && (
                  <div className="absolute top-2 right-2 animate-in zoom-in spin-in-180 duration-300">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  </div>
                )}
              </button>
            );
          };

          /* ===== CASE 1: Question has image → side-by-side ===== */
          if (hasQuestionImage) return (
            <section className="w-full flex flex-col lg:flex-row gap-4 lg:gap-5 flex-1 min-h-0">
              {/* Left: Question (40%) */}
              <div className="w-full lg:w-[40%] lg:flex lg:flex-col lg:justify-center">
                <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-[0_10px_30px_rgba(27,28,28,0.04)] relative overflow-hidden border border-gray-100">
                  <div className="absolute top-0 left-0 w-1.5 shrink-0 h-full bg-[#6c5ce7]" />
                  <img
                    src={currentQuestion.image_url}
                    alt=""
                    className="w-full aspect-video object-cover rounded-xl mb-3"
                  />
                  {(currentQuestion.question_text || currentQuestion.question_text_bn) && (
                    <h2 className="text-lg sm:text-xl font-extrabold text-[#1b1c1c] text-center leading-snug">
                      {currentQuestion.question_text_bn || currentQuestion.question_text}
                    </h2>
                  )}
                </div>
              </div>

              {/* Right: Options 2×2 grid (60%) */}
              <div className="w-full lg:w-[60%] grid grid-cols-2 gap-2.5 auto-rows-fr">
                {currentQuestion.options.map((opt: any, i: number) => renderOption(opt, i, true))}
              </div>
            </section>
          );

          /* ===== CASE 2: Text question + image options → text on top, full-width 2×2 grid ===== */
          if (hasOptionImages) return (
            <>
              <section className="w-full bg-white rounded-2xl p-4 sm:p-6 shadow-[0_10px_30px_rgba(27,28,28,0.04)] relative overflow-hidden border border-gray-100">
                <div className="absolute top-0 left-0 w-1.5 shrink-0 h-full bg-[#6c5ce7]" />
                <h2 className="text-lg sm:text-xl font-extrabold text-[#1b1c1c] text-center leading-snug">
                  {currentQuestion.question_text_bn || currentQuestion.question_text}
                </h2>
              </section>

              <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full">
                {currentQuestion.options.map((opt: any, i: number) => renderOption(opt, i))}
              </section>
            </>
          );

          /* ===== CASE 3: All text → original vertical layout ===== */
          return (
            <>
              <section className="w-full bg-white rounded-2xl p-5 sm:p-8 shadow-[0_10px_30px_rgba(27,28,28,0.04)] relative overflow-hidden border border-gray-100">
                <div className="absolute top-0 left-0 w-1.5 shrink-0 h-full bg-[#6c5ce7]" />
                <h2 className="text-xl sm:text-2xl font-extrabold text-[#1b1c1c] text-center leading-snug pl-2 sm:pl-0">
                  {currentQuestion.question_text_bn || currentQuestion.question_text}
                </h2>
              </section>

              <section className="grid gap-3 w-full grid-cols-1 md:grid-cols-2">
                {currentQuestion.options.map((opt: any, index: number) => {
                  const isSelected = answers[currentQuestion.id] === opt.id;
                  const style = optionStyles[index % 4];

                  return (
                    <button
                      key={opt.id}
                      onClick={() => selectAnswer(currentQuestion.id, opt.id)}
                      className={`group relative rounded-xl flex items-center p-4 text-left transition-all duration-300 active:scale-[0.98] border-2 shadow-sm ${
                        isSelected
                          ? style.activeBorder
                          : `border-transparent ${style.hoverBorder} ${style.bg}`
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-full ${style.iconBg} flex items-center justify-center transition-transform group-hover:rotate-12 shrink-0`}
                      >
                        <style.icon
                          className={`w-5 h-5 ${style.iconText} ${isSelected ? "fill-current" : ""}`}
                        />
                      </div>
                      <div className="flex-1 ml-3">
                        <span className="block text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 font-sans">
                          {style.label}
                        </span>
                        <span className={`text-base sm:text-lg font-bold font-bn ${style.text}`}>
                          {opt.option_text_bn || opt.option_text}
                        </span>
                      </div>
                      {isSelected && (
                        <div className="absolute top-3 right-3 animate-in zoom-in spin-in-180 duration-300">
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </section>
            </>
          );
        })()}
      </main>

      {/* ---- Bottom bar ---- */}
      <footer className="w-full bg-white/90 backdrop-blur-xl px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-between gap-4 border-t border-gray-100 z-20 shadow-[0_-15px_40px_rgba(0,0,0,0.03)]">
        <button
          onClick={handleSkip}
          className="px-6 sm:px-8 py-3.5 sm:py-4 rounded-full font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors hidden sm:flex items-center gap-2 text-sm sm:text-base font-bn active:bg-gray-200"
        >
          <SkipForward className="w-5 h-5" />
          এড়িয়ে যাও
        </button>

        <div className="flex-1 sm:flex-none flex items-center justify-end w-full sm:w-auto">
          <button
            onClick={handleNext}
            disabled={submitting}
            className={`group px-8 sm:px-10 py-3.5 sm:py-4 rounded-full font-bold text-lg sm:text-xl flex items-center justify-center w-full sm:w-auto gap-3 transition-all ${
              answers[currentQuestion?.id]
                ? "bg-[#5341CD] text-white shadow-xl shadow-primary-600/30 hover:shadow-primary-600/50 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              nextButtonLabel
            )}
            {!submitting && (
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page component (Suspense wrapper for useSearchParams)              */
/* ------------------------------------------------------------------ */

export default function ExamTakePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fbf9f8] font-bn">
          <Loader2 className="w-10 h-10 animate-spin text-[#5341CD]" />
        </div>
      }
    >
      <ExamTakeInner slug={slug} />
    </Suspense>
  );
}
