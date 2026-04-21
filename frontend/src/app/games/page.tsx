"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Gamepad2 } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { api } from "@/lib/api";
import { useLocaleStore } from "@/stores/locale-store";
import { motion } from "motion/react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Game {
  id: string;
  title: string;
  title_bn: string | null;
  slug: string;
  game_type: string;
  difficulty: string;
  background_image_url: string | null;
  price: string;
  is_free: boolean;
  total_plays: number;
  time_limit_seconds: number | null;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const GAME_TYPE_FILTERS: { key: string; label_bn: string; label_en: string; emoji: string }[] = [
  { key: "", label_bn: "সব", label_en: "All", emoji: "🎮" },
  { key: "memory", label_bn: "মেমরি", label_en: "Memory", emoji: "🃏" },
  { key: "drag_drop", label_bn: "ড্র্যাগ এন্ড ড্রপ", label_en: "Drag & Drop", emoji: "🎯" },
  { key: "crossword", label_bn: "ক্রসওয়ার্ড", label_en: "Crossword", emoji: "\u270F\uFE0F" },
  { key: "find_words", label_bn: "শব্দ খোঁজা", label_en: "Find Words", emoji: "\uD83D\uDD0D" },
  { key: "image_sequence", label_bn: "সিকুয়েন্সিং", label_en: "Sequencing", emoji: "\uD83E\uDDE9" },
  { key: "arithmetic", label_bn: "গণিত", label_en: "Math", emoji: "\uD83D\uDD22" },
];

const DIFFICULTY_FILTERS: { key: string; label_bn: string; label_en: string; stars: number }[] = [
  { key: "easy", label_bn: "সহজ", label_en: "Easy", stars: 1 },
  { key: "medium", label_bn: "মাঝারি", label_en: "Medium", stars: 2 },
  { key: "hard", label_bn: "কঠিন", label_en: "Hard", stars: 3 },
];

const FLOATING_EMOJIS = [
  { emoji: "\uD83C\uDFAE", delay: 0 },
  { emoji: "\uD83E\uDDE9", delay: 0.5 },
  { emoji: "\uD83C\uDFAF", delay: 1.0 },
  { emoji: "\uD83D\uDD22", delay: 1.5 },
  { emoji: "\uD83C\uDCCF", delay: 2.0 },
  { emoji: "\uD83D\uDD0D", delay: 2.5 },
];

const GAME_TYPE_EMOJI: Record<string, string> = {
  memory: "\uD83C\uDCCF",
  drag_drop: "\uD83C\uDFAF",
  crossword: "\u270F\uFE0F",
  find_words: "\uD83D\uDD0D",
  image_sequence: "\uD83E\uDDE9",
  arithmetic: "\uD83D\uDD22",
};

const GAME_TYPE_LABEL_BN: Record<string, string> = {
  memory: "মেমরি",
  drag_drop: "ড্র্যাগ এন্ড ড্রপ",
  crossword: "ক্রসওয়ার্ড",
  find_words: "শব্দ খোঁজা",
  image_sequence: "সিকুয়েন্সিং",
  arithmetic: "গণিত",
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
/*  Inner component                                                    */
/* ------------------------------------------------------------------ */

function GamesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(searchParams?.get("type") || "");
  const [difficultyFilter, setDifficultyFilter] = useState(searchParams?.get("difficulty") || "");

  const { t: tRaw } = useLocaleStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const t = useCallback(
    (bn: string, en: string) => (mounted ? tRaw(bn, en) : bn),
    [mounted, tRaw],
  );

  /* URL sync */
  const updateUrl = useCallback(
    (type: string, diff: string) => {
      const params = new URLSearchParams();
      if (type) params.set("type", type);
      if (diff) params.set("difficulty", diff);
      const qs = params.toString();
      router.push(qs ? `/games?${qs}` : "/games", { scroll: false });
    },
    [router],
  );

  const handleTypeChange = (type: string) => {
    setTypeFilter(type);
    updateUrl(type, difficultyFilter);
  };

  const handleDifficultyToggle = (diff: string) => {
    const next = difficultyFilter === diff ? "" : diff;
    setDifficultyFilter(next);
    updateUrl(typeFilter, next);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setSearch(searchInput);
    }
  };

  /* Fetch games */
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.append("page", "1");
        params.append("page_size", "20");
        if (typeFilter) params.append("game_type", typeFilter);
        if (difficultyFilter) params.append("difficulty", difficultyFilter);
        if (search) params.append("search", search);

        const data: any = await api.get(`/games/?${params.toString()}`);
        const items = Array.isArray(data) ? data : data?.items || [];
        setGames(items);
      } catch {
        setGames([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [typeFilter, difficultyFilter, search]);

  /* Difficulty stars helper */
  const difficultyStars = (level: string) => {
    const count = level === "hard" ? 3 : level === "medium" ? 2 : 1;
    return "\u2B50".repeat(count);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* ==================== Animated Hero ==================== */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#5341CD] via-[#3B82F6] to-[#EC4899] py-16 sm:py-20">
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
            {t("\u0997\u09C7\u09AE \u099C\u09CB\u09A8", "Game Zone")}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-white/70 font-bn mt-3 text-lg"
          >
            {t(
              "\u0996\u09C7\u09B2\u09A4\u09C7 \u0996\u09C7\u09B2\u09A4\u09C7 \u09B6\u09C7\u0996\u09CB, \u09AE\u099C\u09BE\u09B0 \u09B8\u09BE\u09A5\u09C7 \u099C\u09CD\u099E\u09BE\u09A8 \u09AC\u09BE\u09A1\u09BC\u09BE\u0993!",
              "Learn through play, grow with fun!",
            )}
          </motion.p>

          {/* Search bar */}
          <div className="max-w-xl mx-auto mt-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder={t("\u0997\u09C7\u09AE \u0996\u09C1\u0981\u099C\u09CB...", "Search games...")}
                className="w-full pl-12 pr-4 py-4 rounded-full bg-white border-2 border-white/80 shadow-2xl text-sm font-bn text-gray-800 placeholder:text-gray-400 focus:ring-4 focus:ring-purple-200 focus:border-purple-300 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ==================== Filters + Content ==================== */}
      <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Game type filter tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {GAME_TYPE_FILTERS.map((item) => {
            const isActive = typeFilter === item.key;
            return (
              <button
                key={item.key}
                onClick={() => handleTypeChange(item.key)}
                className={`relative px-4 py-2 rounded-xl text-sm font-bold transition-all font-bn flex items-center gap-1.5 ${
                  isActive
                    ? "bg-[#5341CD] text-white shadow-lg shadow-[#5341CD]/25"
                    : "text-gray-600 bg-white border border-gray-200 hover:bg-gray-50"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="game-type-filter"
                    className="absolute inset-0 bg-[#5341CD] rounded-xl -z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span>{item.emoji}</span>
                <span>{t(item.label_bn, item.label_en)}</span>
              </button>
            );
          })}
        </div>

        {/* Difficulty filter */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          {DIFFICULTY_FILTERS.map((item) => {
            const isActive = difficultyFilter === item.key;
            return (
              <button
                key={item.key}
                onClick={() => handleDifficultyToggle(item.key)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all font-bn ${
                  isActive
                    ? "bg-amber-100 text-amber-800 border-2 border-amber-300 shadow-sm"
                    : "text-gray-500 bg-white border border-gray-200 hover:bg-gray-50"
                }`}
              >
                {"\u2B50".repeat(item.stars)} {t(item.label_bn, item.label_en)}
              </button>
            );
          })}
        </div>

        {/* ==================== Game Cards Grid ==================== */}
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
        ) : games.length === 0 ? (
          <div className="text-center py-20">
            <Gamepad2 className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-400 font-bn">
              {t(
                "\u0995\u09CB\u09A8\u09CB \u0997\u09C7\u09AE \u09AA\u09BE\u0993\u09DF\u09BE \u09AF\u09BE\u09DF\u09A8\u09BF",
                "No games found",
              )}
            </h3>
            <p className="text-sm text-gray-400 font-bn mt-1">
              {t(
                "\u09AB\u09BF\u09B2\u09CD\u099F\u09BE\u09B0 \u09AA\u09B0\u09BF\u09AC\u09B0\u09CD\u09A4\u09A8 \u0995\u09B0\u09C7 \u0986\u09AC\u09BE\u09B0 \u099A\u09C7\u09B7\u09CD\u099F\u09BE \u0995\u09B0\u09C1\u09A8",
                "Try changing the filters",
              )}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {games.map((game, index) => (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, type: "spring", stiffness: 300, damping: 24 }}
                whileHover={{ scale: 1.03 }}
              >
                <Link href={`/games/${game.slug}`} className="block group">
                  <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow">
                    {/* Background image */}
                    {game.background_image_url ? (
                      <img
                        src={game.background_image_url}
                        alt={game.title_bn || game.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#5341CD] via-[#3B82F6] to-[#EC4899] flex items-center justify-center">
                        <span className="text-6xl">
                          {GAME_TYPE_EMOJI[game.game_type] || "\uD83C\uDFAE"}
                        </span>
                      </div>
                    )}

                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

                    {/* Game type badge — top left */}
                    <div className="absolute top-3 left-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-white/90 backdrop-blur text-gray-800 font-bn">
                        {GAME_TYPE_EMOJI[game.game_type] || "\uD83C\uDFAE"}{" "}
                        {t(
                          GAME_TYPE_LABEL_BN[game.game_type] || game.game_type,
                          GAME_TYPE_LABEL_EN[game.game_type] || game.game_type,
                        )}
                      </span>
                    </div>

                    {/* Difficulty stars — top right */}
                    <div className="absolute top-3 right-3">
                      <span className="text-sm">{difficultyStars(game.difficulty)}</span>
                    </div>

                    {/* Bottom overlay content */}
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="text-white font-bold text-base font-bn leading-tight mb-1.5">
                        {t(game.title_bn || game.title, game.title)}
                      </h3>
                      <div className="flex items-center gap-3">
                        <span className="text-white/80 text-xs font-bn">
                          {"\uD83C\uDFAE"} {game.total_plays}
                        </span>
                        {game.is_free ? (
                          <span className="px-2 py-0.5 rounded-full bg-green-500 text-white text-xs font-bold">
                            FREE
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-purple-500 text-white text-xs font-bold">
                            &#x09F3;{game.price}
                          </span>
                        )}
                      </div>
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

export default function GamesPage() {
  return (
    <Suspense>
      <GamesContent />
    </Suspense>
  );
}
