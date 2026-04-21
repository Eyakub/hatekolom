"use client";

import { useState, useEffect } from "react";
import { Award, Lock, Trophy, Star, Palette } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useLocaleStore } from "@/stores/locale-store";
import { api } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BadgeWallItem {
  badge_id: string;
  name: string;
  name_bn: string | null;
  description: string | null;
  description_bn: string | null;
  icon_url: string | null;
  category: string; // "art" | "games" | "general" etc.
  earned: boolean;
  earned_at: string | null;
  progress: number;
  threshold: number;
}

interface BadgeWallProps {
  childProfileId: string;
}

type CategoryFilter = "all" | "art" | "games" | "general";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("bn-BD", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function CategoryIcon({ category }: { category: string }) {
  if (category === "art") return <Palette className="w-10 h-10 text-pink-400" />;
  if (category === "games") return <Star className="w-10 h-10 text-yellow-400" />;
  return <Trophy className="w-10 h-10 text-amber-400" />;
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col items-center gap-3 shadow-sm">
      <div className="animate-pulse bg-gray-200 rounded-full w-16 h-16" />
      <div className="animate-pulse bg-gray-200 rounded w-3/4 h-4" />
      <div className="animate-pulse bg-gray-200 rounded w-1/2 h-3" />
      <div className="animate-pulse bg-gray-100 rounded-full w-full h-2 mt-1" />
    </div>
  );
}

// ─── Badge Card ───────────────────────────────────────────────────────────────

function BadgeCard({ badge, t }: { badge: BadgeWallItem; t: (bn: string, en: string) => string }) {
  const progressPct =
    badge.threshold > 0
      ? Math.min(100, Math.round((badge.progress / badge.threshold) * 100))
      : 0;

  const displayName = badge.name_bn || badge.name;
  const displayDesc = badge.description_bn || badge.description;

  return (
    <div
      className={`
        relative bg-white rounded-2xl border p-4 flex flex-col items-center gap-2
        transition-all duration-300
        ${
          badge.earned
            ? "ring-2 ring-yellow-400 shadow-lg shadow-yellow-200 border-yellow-300"
            : "border-gray-100 shadow-sm opacity-60"
        }
      `}
    >
      {/* Shimmer overlay for earned badges */}
      {badge.earned && (
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none overflow-hidden"
          aria-hidden="true"
        >
          <div className="badge-shine absolute inset-0" />
        </div>
      )}

      {/* Lock indicator for locked badges */}
      {!badge.earned && (
        <div className="absolute top-2 right-2">
          <Lock className="w-4 h-4 text-gray-400" />
        </div>
      )}

      {/* Icon / Image */}
      <div
        className={`
          w-16 h-16 rounded-full flex items-center justify-center
          ${badge.earned ? "bg-yellow-50" : "bg-gray-100"}
          ${!badge.earned ? "grayscale" : ""}
        `}
      >
        {badge.icon_url ? (
          <img
            src={badge.icon_url}
            alt={displayName}
            className={`w-12 h-12 object-contain rounded-full ${!badge.earned ? "grayscale" : ""}`}
          />
        ) : (
          <CategoryIcon category={badge.category} />
        )}
      </div>

      {/* Badge name */}
      <p className="text-sm font-bold text-center text-gray-800 leading-tight font-bn">
        {displayName}
      </p>

      {/* Description */}
      {displayDesc && (
        <p className="text-xs text-center text-gray-400 leading-snug font-bn line-clamp-2">
          {displayDesc}
        </p>
      )}

      {/* Earned date OR progress bar */}
      {badge.earned && badge.earned_at ? (
        <span className="mt-1 text-xs text-yellow-600 font-semibold font-bn">
          {t("অর্জিত:", "Earned:")} {formatDate(badge.earned_at)}
        </span>
      ) : (
        !badge.earned && (
          <div className="w-full mt-1">
            <div className="flex justify-between text-xs text-gray-400 mb-1 font-bn">
              <span>{badge.progress}</span>
              <span>{badge.threshold}</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-400 to-pink-400 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )
      )}

      {/* Earned badge sparkle */}
      {badge.earned && (
        <Award className="w-4 h-4 text-yellow-500 absolute bottom-2 right-2" />
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BadgeWall({ childProfileId }: BadgeWallProps) {
  const { accessToken } = useAuthStore();
  const { t } = useLocaleStore();

  const [badges, setBadges] = useState<BadgeWallItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");

  // ── Fetch badges on mount ─────────────────────────────────────────────────
  useEffect(() => {
    if (!childProfileId) return;

    let cancelled = false;

    async function fetchBadges() {
      setLoading(true);
      try {
        const data = await api.get<BadgeWallItem[]>(
          `/badges/wall?child_profile_id=${childProfileId}`,
          accessToken ?? undefined,
        );
        if (!cancelled) {
          setBadges(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) setBadges([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchBadges();
    return () => {
      cancelled = true;
    };
  }, [childProfileId, accessToken]);

  // ── Category filter tabs ──────────────────────────────────────────────────
  const categoryTabs: { key: CategoryFilter; bn: string; en: string }[] = [
    { key: "all", bn: "সব", en: "All" },
    { key: "art", bn: "আর্ট", en: "Art" },
    { key: "games", bn: "গেমস", en: "Games" },
    { key: "general", bn: "সাধারণ", en: "General" },
  ];

  const filteredBadges =
    activeCategory === "all"
      ? badges
      : badges.filter((b) => b.category === activeCategory);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full font-bn">
      {/* Inline shimmer CSS */}
      <style>{`
        @keyframes badgeShine {
          0% { transform: translateX(-100%) skewX(-15deg); opacity: 0; }
          40% { opacity: 0.4; }
          60% { opacity: 0.4; }
          100% { transform: translateX(200%) skewX(-15deg); opacity: 0; }
        }
        .badge-shine::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 60%;
          height: 200%;
          background: linear-gradient(
            to right,
            rgba(255,255,255,0) 0%,
            rgba(255,255,255,0.55) 50%,
            rgba(255,255,255,0) 100%
          );
          animation: badgeShine 2.8s ease-in-out infinite;
        }
      `}</style>

      {/* ── Category Filter Tabs ── */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {categoryTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveCategory(tab.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
              activeCategory === tab.key
                ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md"
                : "bg-white text-gray-600 border border-gray-200 hover:border-purple-300 hover:text-purple-600"
            }`}
          >
            {t(tab.bn, tab.en)}
          </button>
        ))}
      </div>

      {/* ── Loading skeleton ── */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filteredBadges.length === 0 ? (
        /* ── Empty state ── */
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <Trophy className="w-16 h-16 text-yellow-200" />
          <p className="text-lg font-bold text-gray-400 font-bn">
            {t("এখনো কোনো ব্যাজ নেই! চালিয়ে যাও", "No badges yet! Keep going")} 🌟
          </p>
          <p className="text-sm text-gray-300 font-bn">
            {t(
              "আরও আঁকো, খেলো এবং শেখো — ব্যাজ আসবেই!",
              "Draw more, play, and learn — badges will come!",
            )}
          </p>
        </div>
      ) : (
        /* ── Badge Grid ── */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredBadges.map((badge) => (
            <BadgeCard key={badge.badge_id} badge={badge} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}
