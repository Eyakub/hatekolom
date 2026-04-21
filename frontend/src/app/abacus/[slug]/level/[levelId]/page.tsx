"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import {
  Loader2, X, ArrowRight, AlertCircle, Clock, Star as StarIcon,
  RotateCcw,
} from "lucide-react";
import TutorialEngine from "@/components/abacus/TutorialEngine";
import BeadSlideTestEngine from "@/components/abacus/BeadSlideTestEngine";
import MentalMathEngine from "@/components/abacus/MentalMathEngine";
import MixedTestEngine from "@/components/abacus/MixedTestEngine";
import PracticeEngine from "@/components/abacus/PracticeEngine";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LevelData {
  id: string;
  title: string;
  title_bn: string | null;
  level_type: string;
  exercise_type: string;
  time_limit: number | null;
  questions: any[];
  config: any;
  content: any;
  total_questions: number;
}

interface LevelResult {
  score: number;
  total_points: number;
  time_seconds: number;
  passed: boolean;
  stars: number;
  attempt_data: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ENCOURAGEMENTS_PASS = [
  "Level Complete! \uD83C\uDF89",
  "Amazing! \u2B50",
  "Wonderful! \uD83C\uDFC6",
  "Excellent! \uD83D\uDE80",
];

const ENCOURAGEMENTS_FAIL = [
  "Keep Practicing!",
  "Almost there!",
  "Try again!",
  "You can do it!",
];

const CONFETTI_COLORS = [
  "#F59E0B", "#F97316", "#EF4444", "#EC4899", "#10B981",
  "#8B5CF6", "#3B82F6", "#06B6D4", "#84CC16", "#5341CD",
];

/* ------------------------------------------------------------------ */
/*  Confetti piece                                                     */
/* ------------------------------------------------------------------ */

function ConfettiPiece({ index }: { index: number }) {
  const angle = (index / 30) * Math.PI * 2;
  const distance = 100 + Math.random() * 200;
  const x = Math.cos(angle) * distance;
  const y = Math.sin(angle) * distance - 100;
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
  const size = 6 + Math.random() * 8;
  const isCircle = index % 3 !== 0;

  return (
    <motion.div
      initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
      animate={{
        x,
        y: y + 200,
        scale: [0, 1.5, 1],
        opacity: [1, 1, 0],
        rotate: Math.random() * 720 - 360,
      }}
      transition={{
        duration: 1.5 + Math.random() * 0.5,
        delay: Math.random() * 0.3,
        ease: "easeOut",
      }}
      className="absolute"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: isCircle ? "50%" : "2px",
        left: "50%",
        top: "40%",
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Animated star                                                      */
/* ------------------------------------------------------------------ */

function AnimatedStar({
  filled,
  delay,
}: {
  filled: boolean;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 12, delay }}
    >
      <svg
        width="56"
        height="56"
        viewBox="0 0 24 24"
        fill={filled ? "#F59E0B" : "none"}
        stroke={filled ? "#F59E0B" : "#D1D5DB"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Count-up number                                                    */
/* ------------------------------------------------------------------ */

function CountUpNumber({ target, duration = 1.5 }: { target: number; duration?: number }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (target <= 0) return;
    const steps = 30;
    const stepDuration = (duration * 1000) / steps;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setCurrent(Math.round((step / steps) * target));
      if (step >= steps) {
        clearInterval(interval);
        setCurrent(target);
      }
    }, stepDuration);
    return () => clearInterval(interval);
  }, [target, duration]);

  return <span>{current}</span>;
}

/* ------------------------------------------------------------------ */
/*  Inner component (needs useSearchParams -> Suspense)                */
/* ------------------------------------------------------------------ */

function LevelPlayInner() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;
  const levelId = params?.levelId as string;
  const searchParams = useSearchParams();
  const childId = searchParams.get("child");
  const isPreview = searchParams.get("preview") === "true";
  const { accessToken } = useAuthStore();

  /* ---- state ---- */
  const [level, setLevel] = useState<LevelData | null>(null);
  const [result, setResult] = useState<LevelResult | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showExitModal, setShowExitModal] = useState(false);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [encouragement] = useState(() => {
    // Will be overridden when result is set, just pick a default
    return ENCOURAGEMENTS_PASS[Math.floor(Math.random() * ENCOURAGEMENTS_PASS.length)];
  });
  const levelIdRef = useRef<string>("");

  /* ---- warn before reload/close ---- */
  useEffect(() => {
    if (!level || result) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [level, result]);

  /* ---- load level ---- */
  useEffect(() => {
    if (!levelId || !accessToken) return;
    (async () => {
      try {
        levelIdRef.current = levelId;

        const qp = new URLSearchParams();
        if (childId) qp.set("child_profile_id", childId);
        if (isPreview) qp.set("preview", "true");
        const qs = qp.toString() ? `?${qp.toString()}` : "";
        const data: any = await api.get(
          `/abacus/levels/${levelId}/start${qs}`,
          accessToken,
        );
        setLevel(data);

        if (data.time_limit) {
          setTimeLeft(data.time_limit);
        }
      } catch (err: unknown) {
        if (err instanceof ApiError) {
          setError({ status: err.status, message: err.message });
        } else {
          setError({ status: 500, message: "Something went wrong" });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [levelId, accessToken, childId, isPreview]);

  /* ---- timer ---- */
  useEffect(() => {
    if (!level || result) return;

    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);

      if (timeLeft !== null) {
        setTimeLeft((prev) => {
          if (prev === null) return null;
          const next = prev - 1;
          if (next <= 0) {
            handleComplete({
              score: 0,
              total_points: 10,
              time_seconds: elapsed + 1,
              passed: false,
              stars: 0,
              attempt_data: { timed_out: true },
            });
            return 0;
          }
          return next;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, result, timeLeft]);

  /* ---- format time ---- */
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  /* ---- handleComplete ---- */
  const handleComplete = useCallback(
    async (data: LevelResult) => {
      if (result) return; // prevent double-submit
      setResult(data);

      try {
        const lid = levelIdRef.current;
        if (lid && accessToken && !isPreview) {
          await api.post(
            `/abacus/levels/${lid}/submit`,
            {
              child_profile_id: childId || undefined,
              score: data.score,
              total_points: data.total_points,
              time_seconds: data.time_seconds,
              passed: data.passed,
              stars: data.stars,
              attempt_data: data.attempt_data,
            },
            accessToken,
          );
        }
      } catch {
        // Submission failed silently — result is still shown
      }
    },
    [result, accessToken, childId, isPreview],
  );

  /* ---- try again ---- */
  const handleTryAgain = () => {
    setResult(null);
    setElapsed(0);
    if (level?.time_limit) {
      setTimeLeft(level.time_limit);
    }
  };

  /* ================================================================ */
  /*  1. Loading screen                                                */
  /* ================================================================ */

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-500 via-orange-500 to-red-400 font-bn">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-white" />
          <p className="text-white/90 text-lg font-bold">
            Loading level...
          </p>
        </div>
      </div>
    );
  }

  /* ================================================================ */
  /*  2. Error screen                                                  */
  /* ================================================================ */

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fbf9f8] font-bn px-4">
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-10 max-w-md w-full text-center space-y-5">
          <AlertCircle className="w-14 h-14 text-red-400 mx-auto" />
          <h2 className="text-2xl font-extrabold text-gray-900">
            {error.status === 403
              ? "Access Denied"
              : "Something went wrong"}
          </h2>
          <p className="text-gray-500">{error.message}</p>
          <button
            onClick={() => router.push(`/abacus/${slug}`)}
            className="inline-flex items-center gap-2 bg-amber-500 text-white px-6 py-3 rounded-full font-bold hover:opacity-90 transition"
          >
            Go Back <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (!level) return null;

  /* ================================================================ */
  /*  3. Completion / Celebration overlay                               */
  /* ================================================================ */

  if (result) {
    const resultEncouragement = result.passed
      ? ENCOURAGEMENTS_PASS[Math.floor(Math.random() * ENCOURAGEMENTS_PASS.length)]
      : ENCOURAGEMENTS_FAIL[Math.floor(Math.random() * ENCOURAGEMENTS_FAIL.length)];

    return (
      <div className="min-h-screen relative overflow-hidden font-bn">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500 via-orange-500 to-red-400" />
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

        {/* Confetti (only on pass) */}
        {result.passed && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(35)].map((_, i) => (
              <ConfettiPiece key={i} index={i} />
            ))}
          </div>
        )}

        {/* Celebration card */}
        <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="bg-white rounded-3xl shadow-2xl p-8 sm:p-10 max-w-md w-full text-center space-y-6"
          >
            {/* Stars */}
            <div className="flex items-center justify-center gap-3">
              <AnimatedStar filled={result.stars >= 1} delay={0} />
              <AnimatedStar filled={result.stars >= 2} delay={0.3} />
              <AnimatedStar filled={result.stars >= 3} delay={0.6} />
            </div>

            {/* Encouragement */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="text-2xl font-extrabold text-gray-900"
            >
              {resultEncouragement}
            </motion.h2>

            {/* Score */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.0, type: "spring" }}
              className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-6 text-white"
            >
              <p className="text-sm font-semibold text-white/70 mb-1">
                Score
              </p>
              <p className="text-5xl font-black tabular-nums">
                <CountUpNumber target={result.score} />
                <span className="text-xl font-bold text-white/60">/{result.total_points}</span>
              </p>
            </motion.div>

            {/* Time */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="flex items-center justify-center gap-2 text-gray-500"
            >
              <Clock className="w-4 h-4" />
              <span className="text-sm font-bold">{formatTime(result.time_seconds)}</span>
            </motion.div>

            {/* Action buttons */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.4 }}
              className="flex flex-col sm:flex-row gap-3 pt-2"
            >
              {isPreview ? (
                <button
                  onClick={() => {
                    // Preview opens in new tab — close it, or go back to admin
                    if (window.opener) {
                      window.close();
                    } else {
                      router.push("/admin?tab=abacus");
                    }
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-3.5 rounded-full font-bold hover:shadow-lg transition-shadow"
                >
                  Close Preview
                </button>
              ) : result.passed ? (
                <button
                  onClick={() => router.push(`/abacus/${slug}`)}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-3.5 rounded-full font-bold hover:shadow-lg transition-shadow"
                >
                  Next Level <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleTryAgain}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-3.5 rounded-full font-bold hover:shadow-lg transition-shadow"
                >
                  <RotateCcw className="w-4 h-4" />
                  Try Again
                </button>
              )}
              <Link
                href={`/abacus/${slug}`}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-6 py-3.5 rounded-full font-bold hover:bg-gray-200 transition-colors"
              >
                🧮 Course Map
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  /* ================================================================ */
  /*  4. Active level screen                                           */
  /* ================================================================ */

  const isTimeLow = timeLeft !== null && timeLeft < 30;
  const displayTime = level.time_limit ? formatTime(timeLeft ?? 0) : formatTime(elapsed);

  return (
    <div className="min-h-screen relative font-bn bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100">
      {/* ---- Floating top bar ---- */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          {/* Left: level title */}
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-sm sm:text-base font-extrabold text-gray-800 truncate">
              {level.title_bn || level.title}
            </h2>
          </div>

          {/* Center: timer */}
          <div
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-mono font-bold text-sm ${
              isTimeLow
                ? "bg-red-100 text-red-600 animate-pulse"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            <Clock className="w-4 h-4" />
            {displayTime}
          </div>

          {/* Right: progress / stars + close */}
          <div className="flex-1 flex items-center justify-end gap-3 pl-4">
            {level.level_type === "test" && level.total_questions > 0 && (
              <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                Q 0/{level.total_questions}
              </span>
            )}
            <div className="flex items-center gap-0.5">
              {[1, 2, 3].map((i) => (
                <StarIcon
                  key={i}
                  className="w-5 h-5 text-gray-300"
                  strokeWidth={2}
                />
              ))}
            </div>
            <button
              onClick={() => setShowExitModal(true)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* ---- Level container ---- */}
      <div className="pt-16 sm:pt-20 pb-6 sm:pb-10 px-2 sm:px-4 flex items-center justify-center min-h-screen">
        <div className="bg-white/95 backdrop-blur rounded-2xl sm:rounded-3xl shadow-2xl max-w-4xl w-full p-3 sm:p-6 md:p-10">
          {/* Engine dispatch */}
          {level.level_type === "tutorial" && (
            <TutorialEngine config={level.config} content={level.content} elapsed={elapsed} onComplete={handleComplete} isPreview={isPreview} />
          )}
          {level.level_type === "test" && level.exercise_type === "bead_slide" && (
            <BeadSlideTestEngine config={level.config} content={level.content} elapsed={elapsed} onComplete={handleComplete} isPreview={isPreview} />
          )}
          {level.level_type === "test" && level.exercise_type === "mental_math" && (
            <MentalMathEngine config={level.config} content={level.content} elapsed={elapsed} onComplete={handleComplete} isPreview={isPreview} />
          )}
          {level.level_type === "test" && level.exercise_type === "mixed" && (
            <MixedTestEngine config={level.config} content={level.content} elapsed={elapsed} onComplete={handleComplete} isPreview={isPreview} />
          )}
          {level.level_type === "practice" && (
            <PracticeEngine config={level.config} content={level.content} elapsed={elapsed} onComplete={handleComplete} isPreview={isPreview} />
          )}

          {/* Fallback for unknown level/exercise types */}
          {!["tutorial", "test", "practice"].includes(level.level_type) && (
            <div className="p-10 text-center text-gray-400">
              <span className="text-5xl mb-4 block">🧮</span>
              <p className="text-lg font-bold mb-1">{level.level_type}</p>
              <p className="text-sm mb-4">Coming Soon</p>
              <button
                onClick={() =>
                  handleComplete({
                    score: 5,
                    total_points: 10,
                    time_seconds: elapsed,
                    passed: true,
                    stars: 1,
                    attempt_data: {},
                  })
                }
                className="px-6 py-3 bg-amber-500 text-white rounded-full font-bold hover:opacity-90"
              >
                Complete (Test)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ---- Exit Confirmation Modal ---- */}
      {showExitModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center"
          >
            <div className="text-4xl mb-3">🚪</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Exit the level?</h3>
            <p className="text-sm text-gray-500 mb-5">Your progress on this level will not be saved.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowExitModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
              >
                Continue
              </button>
              <button
                onClick={() => {
                  if (isPreview) {
                    if (window.opener) window.close();
                    else router.push("/admin?tab=abacus");
                  } else {
                    router.push(`/abacus/${slug}`);
                  }
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition-colors"
              >
                Exit
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page export                                                        */
/* ------------------------------------------------------------------ */

export default function AbacusLevelPlayPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-500 via-orange-500 to-red-400">
          <Loader2 className="w-10 h-10 animate-spin text-white" />
        </div>
      }
    >
      <LevelPlayInner />
    </Suspense>
  );
}
