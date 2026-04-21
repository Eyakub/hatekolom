"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import {
  Loader2, X, ArrowRight, AlertCircle, Clock, Star as StarIcon,
  RotateCcw, Gamepad2,
} from "lucide-react";
import MemoryEngine from "@/components/games/MemoryEngine";
import ArithmeticEngine from "@/components/games/ArithmeticEngine";
import DragDropEngine from "@/components/games/DragDropEngine";
import CrosswordEngine from "@/components/games/CrosswordEngine";
import FindWordsEngine from "@/components/games/FindWordsEngine";
import ImageSequenceEngine from "@/components/games/ImageSequenceEngine";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface GameData {
  id: string;
  title: string;
  title_bn: string | null;
  slug: string;
  game_type: string;
  difficulty: string;
  background_image_url: string | null;
  time_limit_seconds: number | null;
  config: any;
}

interface GameResult {
  score: number;
  total_points: number;
  time_seconds: number;
  stars: number;
  attempt_data: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ENCOURAGEMENTS = [
  "You did great! \uD83C\uDF89",
  "Amazing! \u2B50",
  "Wonderful! \uD83C\uDFC6",
  "Wow! Excellent! \uD83D\uDE80",
];

const GAME_TYPE_LABELS: Record<string, string> = {
  memory: "Memory Game",
  drag_drop: "Drag & Drop",
  crossword: "Crossword",
  find_words: "Find Words",
  image_sequence: "Sequencing",
  arithmetic: "Math",
};

const CONFETTI_COLORS = [
  "#5341CD", "#3B82F6", "#EC4899", "#F59E0B", "#10B981",
  "#EF4444", "#8B5CF6", "#06B6D4", "#F97316", "#84CC16",
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
/*  Star SVG component                                                 */
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
/*  Counting-up number                                                 */
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

function GamePlayInner() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;
  const searchParams = useSearchParams();
  const childId = searchParams.get("child");
  const gameIdFromQuery = searchParams.get("gameId");
  const isPreview = searchParams.get("preview") === "true";
  const { accessToken } = useAuthStore();

  /* ---- state ---- */
  const [game, setGame] = useState<GameData | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showExitModal, setShowExitModal] = useState(false);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [encouragement] = useState(
    () => ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)],
  );
  const gameIdRef = useRef<string>("");

  /* ---- warn before reload/close ---- */
  useEffect(() => {
    if (!game || result) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [game, result]);

  /* ---- load game ---- */
  useEffect(() => {
    if (!slug || !accessToken) return;
    (async () => {
      try {
        let resolvedId = gameIdFromQuery;
        if (!resolvedId) {
          const detail: any = await api.get(`/games/slug/${slug}`);
          resolvedId = detail.id;
        }
        gameIdRef.current = resolvedId!;

        const params = new URLSearchParams();
        if (childId) params.set("child_profile_id", childId);
        if (isPreview) params.set("preview", "true");
        const qs = params.toString() ? `?${params.toString()}` : "";
        const data: any = await api.get(
          `/games/${resolvedId}/start${qs}`,
          accessToken,
        );
        setGame(data);

        if (data.time_limit_seconds) {
          setTimeLeft(data.time_limit_seconds);
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
  }, [slug, gameIdFromQuery, accessToken, childId]);

  /* ---- timer ---- */
  useEffect(() => {
    if (!game || result) return;

    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);

      if (timeLeft !== null) {
        setTimeLeft((prev) => {
          if (prev === null) return null;
          const next = prev - 1;
          if (next <= 0) {
            // Time's up — auto-complete with 0 score
            handleComplete({
              score: 0,
              total_points: 10,
              time_seconds: elapsed + 1,
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
  }, [game, result, timeLeft]);

  /* ---- format time ---- */
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  /* ---- handleComplete ---- */
  const handleComplete = useCallback(
    async (data: GameResult) => {
      if (result) return; // prevent double-submit
      setResult(data);

      try {
        const gameId = gameIdRef.current;
        if (gameId && accessToken && !isPreview) {
          await api.post(
            `/games/${gameId}/submit`,
            {
              child_profile_id: childId || undefined,
              score: data.score,
              total_points: data.total_points,
              time_seconds: data.time_seconds,
              completed: true,
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
    [result, accessToken, childId],
  );

  /* ---- play again ---- */
  const handlePlayAgain = () => {
    setResult(null);
    setElapsed(0);
    if (game?.time_limit_seconds) {
      setTimeLeft(game.time_limit_seconds);
    }
  };

  /* ================================================================ */
  /*  1. Loading screen                                                */
  /* ================================================================ */

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#5341CD] via-[#3B82F6] to-[#EC4899] font-bn">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-white" />
          <p className="text-white/90 text-lg font-bold">
            Loading game...
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
            onClick={() => router.push(`/games/${slug}`)}
            className="inline-flex items-center gap-2 bg-[#5341CD] text-white px-6 py-3 rounded-full font-bold hover:opacity-90 transition"
          >
            Go Back <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (!game) return null;

  /* ================================================================ */
  /*  3. Completion / Celebration overlay                               */
  /* ================================================================ */

  if (result) {
    return (
      <div className="min-h-screen relative overflow-hidden font-bn">
        {/* Background */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: game.background_image_url
              ? `url(${game.background_image_url})`
              : undefined,
            backgroundColor: game.background_image_url ? undefined : "#5341CD",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        {/* Confetti */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(35)].map((_, i) => (
            <ConfettiPiece key={i} index={i} />
          ))}
        </div>

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
              {encouragement}
            </motion.h2>

            {/* Score */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.0, type: "spring" }}
              className="bg-gradient-to-br from-[#5341CD] to-[#3B82F6] rounded-2xl p-6 text-white"
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
              <button
                onClick={handlePlayAgain}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#5341CD] to-[#3B82F6] text-white px-6 py-3.5 rounded-full font-bold hover:shadow-lg transition-shadow"
              >
                <RotateCcw className="w-4 h-4" />
                Play Again
              </button>
              <Link
                href="/games"
                className="flex-1 inline-flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-6 py-3.5 rounded-full font-bold hover:bg-gray-200 transition-colors"
              >
                <Gamepad2 className="w-4 h-4" />
                Other Games
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  /* ================================================================ */
  /*  4. Active game screen                                            */
  /* ================================================================ */

  const isTimeLow = timeLeft !== null && timeLeft < 30;
  const displayTime = game.time_limit_seconds ? formatTime(timeLeft ?? 0) : formatTime(elapsed);

  return (
    <div
      className="min-h-screen relative font-bn"
      style={{
        backgroundImage: game.background_image_url
          ? `url(${game.background_image_url})`
          : undefined,
        backgroundColor: game.background_image_url ? undefined : "#f8f6ff",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* ---- Floating top bar ---- */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          {/* Left: game title */}
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-sm sm:text-base font-extrabold text-gray-800 truncate">
              {game.title_bn || game.title}
            </h2>
          </div>

          {/* Center: timer */}
          <div
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-mono font-bold text-sm ${
              isTimeLow
                ? "bg-red-100 text-red-600 animate-pulse"
                : "bg-[#f3f0ff] text-[#5341CD]"
            }`}
          >
            <Clock className="w-4 h-4" />
            {displayTime}
          </div>

          {/* Right: stars + close */}
          <div className="flex-1 flex items-center justify-end gap-3 pl-4">
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

      {/* ---- Game container ---- */}
      <div className="pt-20 pb-10 px-4 flex items-center justify-center min-h-screen">
        <div className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl max-w-4xl w-full p-6 sm:p-10">
          {/* Game engine dispatch */}
          {game.game_type === "memory" && (
            <MemoryEngine config={game.config} elapsed={elapsed} onComplete={handleComplete} isPreview={isPreview} />
          )}
          {game.game_type === "drag_drop" && (
            <DragDropEngine config={game.config} elapsed={elapsed} onComplete={handleComplete} isPreview={isPreview} />
          )}
          {game.game_type === "crossword" && (
            <CrosswordEngine config={game.config} elapsed={elapsed} onComplete={handleComplete} isPreview={isPreview} />
          )}
          {game.game_type === "find_words" && (
            <FindWordsEngine config={game.config} elapsed={elapsed} onComplete={handleComplete} isPreview={isPreview} />
          )}
          {game.game_type === "image_sequence" && (
            <ImageSequenceEngine config={game.config} elapsed={elapsed} onComplete={handleComplete} isPreview={isPreview} />
          )}
          {game.game_type === "arithmetic" && (
            <ArithmeticEngine config={game.config} elapsed={elapsed} onComplete={handleComplete} isPreview={isPreview} />
          )}

          {/* Fallback for unknown game type */}
          {!["memory", "drag_drop", "crossword", "find_words", "image_sequence", "arithmetic"].includes(
            game.game_type,
          ) && (
            <div className="p-10 text-center text-gray-400">
              <span className="text-5xl mb-4 block">{"\uD83C\uDFAE"}</span>
              <p className="text-lg font-bold mb-1">
                {GAME_TYPE_LABELS[game.game_type] || game.game_type}
              </p>
              <p className="text-sm mb-4">Coming Soon</p>
              <button
                onClick={() =>
                  handleComplete({
                    score: 5,
                    total_points: 10,
                    time_seconds: elapsed,
                    stars: 1,
                    attempt_data: {},
                  })
                }
                className="px-6 py-3 bg-[#5341CD] text-white rounded-full font-bold hover:opacity-90 transition"
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
            <h3 className="text-lg font-bold text-gray-900 mb-2">Exit the game?</h3>
            <p className="text-sm text-gray-500 mb-5">Your progress will not be saved.</p>
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
                    else router.push("/admin?tab=games");
                  } else {
                    router.push(`/games/${slug}`);
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

export default function GamePlayPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#5341CD] via-[#3B82F6] to-[#EC4899]">
          <Loader2 className="w-10 h-10 animate-spin text-white" />
        </div>
      }
    >
      <GamePlayInner />
    </Suspense>
  );
}
