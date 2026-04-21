"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2, Clock, Gamepad2, ArrowLeft, ArrowRight, Star,
  AlertCircle,
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

interface GameDetail {
  id: string;
  title: string;
  title_bn: string | null;
  slug: string;
  description: string | null;
  description_bn: string | null;
  game_type: string;
  difficulty: string;
  background_image_url: string | null;
  price: string;
  is_free: boolean;
  total_plays: number;
  time_limit_seconds: number | null;
  config: any;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const GAME_TYPE_EMOJI: Record<string, string> = {
  memory: "\uD83C\uDCCF",
  drag_drop: "\uD83C\uDFAF",
  crossword: "\u270F\uFE0F",
  find_words: "\uD83D\uDD0D",
  image_sequence: "\uD83E\uDDE9",
  arithmetic: "\uD83D\uDD22",
};

const GAME_TYPE_LABEL_BN: Record<string, string> = {
  memory: "\u09AE\u09C7\u09AE\u09B0\u09BF",
  drag_drop: "\u09A1\u09CD\u09B0\u09CD\u09AF\u09BE\u0997 \u098F\u09A8\u09CD\u09A1 \u09A1\u09CD\u09B0\u09AA",
  crossword: "\u0995\u09CD\u09B0\u09B8\u0993\u09DF\u09BE\u09B0\u09CD\u09A1",
  find_words: "\u09B6\u09AC\u09CD\u09A6 \u0996\u09CB\u0981\u099C\u09BE",
  image_sequence: "\u09B8\u09BF\u0995\u09C1\u09DF\u09C7\u09A8\u09CD\u09B8\u09BF\u0982",
  arithmetic: "\u0997\u09A3\u09BF\u09A4",
};

const GAME_TYPE_LABEL_EN: Record<string, string> = {
  memory: "Memory",
  drag_drop: "Drag & Drop",
  crossword: "Crossword",
  find_words: "Find Words",
  image_sequence: "Sequencing",
  arithmetic: "Math",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h} \u0998\u09A3\u09CD\u099F\u09BE ${m > 0 ? `${m} \u09AE\u09BF\u09A8\u09BF\u099F` : ""}`;
  return `${m} \u09AE\u09BF\u09A8\u09BF\u099F`;
}

function difficultyStars(level: string): string {
  const count = level === "hard" ? 3 : level === "medium" ? 2 : 1;
  return "\u2B50".repeat(count);
}

function difficultyLabelBn(level: string): string {
  if (level === "hard") return "\u0995\u09A0\u09BF\u09A8";
  if (level === "medium") return "\u09AE\u09BE\u099D\u09BE\u09B0\u09BF";
  return "\u09B8\u09B9\u099C";
}

function difficultyLabelEn(level: string): string {
  if (level === "hard") return "Hard";
  if (level === "medium") return "Medium";
  return "Easy";
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function GameDetailPage({
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

  const [game, setGame] = useState<GameDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState("");

  /* Fetch game detail */
  useEffect(() => {
    const load = async () => {
      try {
        const data: any = await api.get(`/games/slug/${slug}`);
        setGame(data);
      } catch {
        setGame(null);
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

  /* ---------------------------------------------------------------- */
  /*  Loading state                                                    */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#5341CD] animate-spin" />
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Not found                                                        */
  /* ---------------------------------------------------------------- */

  if (!game) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-center p-8">
          <div>
            <Gamepad2 className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-400 font-bn">
              {t("\u0997\u09C7\u09AE \u09AA\u09BE\u0993\u09DF\u09BE \u09AF\u09BE\u09DF\u09A8\u09BF", "Game not found")}
            </h1>
            <Link
              href="/games"
              className="text-[#5341CD] text-sm mt-2 inline-block hover:underline font-bn"
            >
              {t("\u2190 \u09B8\u09AC \u0997\u09C7\u09AE\u09C7 \u09AB\u09BF\u09B0\u09C7 \u09AF\u09BE\u0993", "\u2190 Back to all games")}
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

  const gameTypeEmoji = GAME_TYPE_EMOJI[game.game_type] || "\uD83C\uDFAE";
  const gameTypeLabelBn = GAME_TYPE_LABEL_BN[game.game_type] || game.game_type;
  const gameTypeLabelEn = GAME_TYPE_LABEL_EN[game.game_type] || game.game_type;

  const playUrl = selectedChild
    ? `/games/${game.slug}/play?child=${selectedChild}&gameId=${game.id}`
    : `/games/${game.slug}/play?gameId=${game.id}`;

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* ==================== Hero ==================== */}
      <div className="relative h-64 sm:h-72 overflow-hidden">
        {game.background_image_url ? (
          <img
            src={game.background_image_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#5341CD] via-[#3B82F6] to-[#EC4899]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 max-w-7xl mx-auto">
          {/* Game type badge */}
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, type: "spring" }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-white/90 backdrop-blur text-gray-800 font-bn mb-3"
          >
            {gameTypeEmoji} {t(gameTypeLabelBn, gameTypeLabelEn)}
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-3xl font-extrabold text-white font-bn leading-tight"
          >
            {t(game.title_bn || game.title, game.title)}
          </motion.h1>

          <div className="flex items-center gap-3 mt-2">
            <span className="text-lg">{difficultyStars(game.difficulty)}</span>
            <span className="text-white/70 text-sm font-bn">
              {t(difficultyLabelBn(game.difficulty), difficultyLabelEn(game.difficulty))}
            </span>
          </div>

          {(game.description_bn || game.description) && (
            <p className="text-white/70 font-bn mt-2 text-sm max-w-2xl leading-relaxed">
              {t(game.description_bn || game.description || "", game.description || "")}
            </p>
          )}
        </div>
      </div>

      {/* ==================== Info Cards ==================== */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="flex flex-wrap gap-4 mb-8">
          {/* Time limit card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-5 py-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-[#5341CD]" />
            <div>
              <p className="text-xs text-gray-400 font-bn">
                {t("\u09B8\u09AE\u09DF\u09B8\u09C0\u09AE\u09BE", "Time Limit")}
              </p>
              <p className="text-sm font-bold text-gray-800 font-bn">
                {game.time_limit_seconds
                  ? formatDuration(game.time_limit_seconds)
                  : t("\u09B8\u09C0\u09AE\u09BE\u09B9\u09C0\u09A8", "Unlimited")}
              </p>
            </div>
          </div>

          {/* Difficulty card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-5 py-4 flex items-center gap-3">
            <Star className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-xs text-gray-400 font-bn">
                {t("\u0995\u09A0\u09BF\u09A8\u09A4\u09BE", "Difficulty")}
              </p>
              <p className="text-sm font-bold text-gray-800 font-bn">
                {difficultyStars(game.difficulty)}{" "}
                {t(difficultyLabelBn(game.difficulty), difficultyLabelEn(game.difficulty))}
              </p>
            </div>
          </div>

          {/* Plays card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-5 py-4 flex items-center gap-3">
            <Gamepad2 className="w-5 h-5 text-[#EC4899]" />
            <div>
              <p className="text-xs text-gray-400 font-bn">
                {t("\u09AE\u09CB\u099F \u0996\u09C7\u09B2\u09BE", "Total Plays")}
              </p>
              <p className="text-sm font-bold text-gray-800 font-bn">
                {game.total_plays}
              </p>
            </div>
          </div>
        </div>

        {/* ==================== Play Section ==================== */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 max-w-xl">
          {/* Child selector (if authenticated and children exist) */}
          {isAuthenticated && children.length > 0 && (
            <div className="mb-5">
              <label className="text-sm text-gray-600 font-bn block mb-1.5 font-semibold">
                {t("\u09B6\u09BF\u09B6\u09C1 \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8", "Select child")}
              </label>
              <select
                value={selectedChild}
                onChange={(e) => setSelectedChild(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-bn outline-none focus:border-[#5341CD] focus:ring-2 focus:ring-[#5341CD]/20"
              >
                {children.map((child: any) => (
                  <option key={child.id} value={child.id}>
                    {child.full_name_bn || child.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Price display */}
          {!game.is_free && (
            <div className="mb-4">
              <span className="text-2xl font-bold text-gray-900">
                &#x09F3;{game.price}
              </span>
            </div>
          )}

          {/* Play CTA */}
          {isAuthenticated ? (
            game.is_free || parseFloat(game.price) === 0 ? (
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link
                  href={playUrl}
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#5341CD] to-[#3B82F6] text-white px-10 py-4 rounded-full font-bold text-lg shadow-lg shadow-[#5341CD]/25 hover:shadow-xl transition-shadow font-bn"
                >
                  {t("\u0996\u09C7\u09B2\u09BE \u09B6\u09C1\u09B0\u09C1 \u0995\u09B0\u09CB", "Start Playing")} {"\uD83C\uDFAE"}
                </Link>
              </motion.div>
            ) : (
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link
                  href={`/checkout?product=${game.id}`}
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#5341CD] to-[#3B82F6] text-white px-10 py-4 rounded-full font-bold text-lg shadow-lg shadow-[#5341CD]/25 hover:shadow-xl transition-shadow font-bn"
                >
                  {t("\u0995\u09BF\u09A8\u09C1\u09A8", "Buy Now")} <ArrowRight className="w-5 h-5" />
                </Link>
              </motion.div>
            )
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-xl px-4 py-3 border border-amber-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-bn">
                  {t(
                    "\u0996\u09C7\u09B2\u09A4\u09C7 \u09B2\u0997\u0987\u09A8 \u0995\u09B0\u09CB",
                    "Login to play",
                  )}
                </span>
              </div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link
                  href={`/login?redirect=/games/${game.slug}`}
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#5341CD] to-[#3B82F6] text-white px-10 py-4 rounded-full font-bold text-lg shadow-lg shadow-[#5341CD]/25 hover:shadow-xl transition-shadow font-bn"
                >
                  {t("\u09B2\u0997\u0987\u09A8 \u0995\u09B0\u09CB", "Login")} <ArrowRight className="w-5 h-5" />
                </Link>
              </motion.div>
            </div>
          )}
        </div>

        {/* ==================== Back link ==================== */}
        <div className="mt-8">
          <Link
            href="/games"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#5341CD] transition-colors font-bn"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("\u09AB\u09BF\u09B0\u09C7 \u09AF\u09BE\u0993", "Go back")}
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
}
