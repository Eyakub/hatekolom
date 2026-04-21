"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, Star } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useLocaleStore } from "@/stores/locale-store";
import { api } from "@/lib/api";
import { toast } from "@/stores/toast-store";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GalleryDrawing {
  id: string;
  child_profile_id: string;
  child_name: string;
  image_url: string;
  title: string | null;
  title_bn: string | null;
  status: string;
  is_featured: boolean;
  like_count: number;
  created_at: string;
  liked_by_me?: boolean;
}

type SortOption = "recent" | "popular" | "featured";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("bn-BD", { year: "numeric", month: "short", day: "numeric" });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GalleryPage() {
  const { accessToken, isAuthenticated } = useAuthStore();
  const { t } = useLocaleStore();

  const [sort, setSort] = useState<SortOption>("recent");
  const [drawings, setDrawings] = useState<GalleryDrawing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());
  const [challenges, setChallenges] = useState<any[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<string>("");

  // ── Fetch active challenges on mount ─────────────────────────────────────────
  useEffect(() => {
    api.get("/challenges/").then((data: any) => {
      setChallenges(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, []);

  // ── Load drawings ────────────────────────────────────────────────────────────
  const loadDrawings = useCallback(
    async (pageNum: number, sortOpt: SortOption, append = false, challengeId = "") => {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      try {
        let url = `/drawings/gallery?page=${pageNum}&page_size=20&sort=${sortOpt}`;
        if (challengeId) url += `&challenge_id=${challengeId}`;
        const data: any = await api.get(
          url,
          accessToken ?? undefined,
        );
        const list: GalleryDrawing[] = Array.isArray(data) ? data : data?.items || [];
        if (append) {
          setDrawings((prev) => [...prev, ...list]);
        } else {
          setDrawings(list);
        }
        // If fewer than 20 results came back, there are no more pages
        setHasMore(list.length === 20);
      } catch {
        if (!append) setDrawings([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [accessToken],
  );

  // Reset and reload when sort or challenge filter changes
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    loadDrawings(1, sort, false, selectedChallenge);
  }, [sort, selectedChallenge, loadDrawings]);

  // ── Load more ────────────────────────────────────────────────────────────────
  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadDrawings(nextPage, sort, true, selectedChallenge);
  };

  // ── Toggle like ──────────────────────────────────────────────────────────────
  const handleLike = async (e: React.MouseEvent, drawingId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      toast.info(t("লাইক দিতে লগইন করুন।", "Login to like drawings."));
      return;
    }

    if (likingIds.has(drawingId)) return;

    setLikingIds((prev) => new Set(prev).add(drawingId));
    try {
      const res: any = await api.post(`/drawings/${drawingId}/like`, {}, accessToken ?? undefined);
      setDrawings((prev) =>
        prev.map((d) =>
          d.id === drawingId
            ? { ...d, like_count: res.like_count, liked_by_me: res.liked }
            : d,
        ),
      );
    } catch {
      toast.error(t("লাইক দেওয়া যায়নি।", "Could not update like."));
    } finally {
      setLikingIds((prev) => {
        const next = new Set(prev);
        next.delete(drawingId);
        return next;
      });
    }
  };

  // ── Sort tabs config ─────────────────────────────────────────────────────────
  const sortTabs: { key: SortOption; bn: string; en: string }[] = [
    { key: "recent", bn: "সাম্প্রতিক", en: "Recent" },
    { key: "popular", bn: "জনপ্রিয়", en: "Popular" },
    { key: "featured", bn: "বিশেষ", en: "Featured" },
  ];

  // ── Derived challenge title for banner ───────────────────────────────────────
  const selectedChallengeObj = challenges.find((c) => c.id === selectedChallenge);
  const selectedChallengeTitle = selectedChallengeObj
    ? t(selectedChallengeObj.title_bn || selectedChallengeObj.title || "", selectedChallengeObj.title || "")
    : "";

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-yellow-50 font-bn">
      {/* ── Hero Header ── */}
      <div className="bg-gradient-to-r from-pink-100 to-purple-100 border-b border-pink-200">
        <div className="max-w-6xl mx-auto px-4 py-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-800 mb-2">
            {t("আর্ট গ্যালারি 🎨", "Art Gallery 🎨")}
          </h1>
          <p className="text-sm sm:text-base text-gray-500 font-medium">
            {t(
              "শিশুদের সুন্দর সব আঁকা ছবি এখানে দেখো!",
              "Discover beautiful artwork created by kids!",
            )}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* ── Sort Tabs ── */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {sortTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSort(tab.key)}
              className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${
                sort === tab.key
                  ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-md"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-purple-300 hover:text-purple-600"
              }`}
            >
              {t(tab.bn, tab.en)}
            </button>
          ))}
        </div>

        {/* ── Challenge Filter Pills ── */}
        {challenges.length > 0 && (
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <button
              onClick={() => setSelectedChallenge("")}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
                selectedChallenge === ""
                  ? "bg-amber-400 text-white shadow-md"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-amber-300 hover:text-amber-600"
              }`}
            >
              {t("সব ছবি", "All Drawings")}
            </button>
            {challenges.map((challenge) => (
              <button
                key={challenge.id}
                onClick={() => setSelectedChallenge(challenge.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
                  selectedChallenge === challenge.id
                    ? "bg-amber-400 text-white shadow-md"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-amber-300 hover:text-amber-600"
                }`}
              >
                {t(challenge.title_bn || challenge.title || "", challenge.title || "")}
              </button>
            ))}
          </div>
        )}

        {/* ── Challenge Banner ── */}
        {selectedChallenge && selectedChallengeTitle && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
            <p className="text-amber-800 font-semibold text-sm">
              🎯 {selectedChallengeTitle}
            </p>
          </div>
        )}

        {/* ── Loading skeleton ── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="animate-pulse bg-gray-200 aspect-square rounded-t-2xl" />
                <div className="p-3 space-y-2">
                  <div className="animate-pulse h-3.5 bg-gray-200 rounded w-2/3" />
                  <div className="animate-pulse h-3 bg-gray-200 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : drawings.length === 0 ? (
          /* ── Empty state ── */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-7xl mb-5">🖼️</div>
            <h3 className="text-xl font-extrabold text-gray-600 mb-2">
              {t("এখনও কোনো ছবি নেই!", "No drawings here yet!")}
            </h3>
            <p className="text-sm text-gray-400">
              {t(
                "অনুমোদিত ছবি এখানে দেখা যাবে।",
                "Approved drawings will appear here.",
              )}
            </p>
          </div>
        ) : (
          <>
            {/* ── Drawing Grid ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {drawings.map((drawing) => {
                const title = t(
                  drawing.title_bn || drawing.title || "শিরোনামহীন",
                  drawing.title || "Untitled",
                );
                const isLiking = likingIds.has(drawing.id);
                const isLiked = drawing.liked_by_me;

                return (
                  <Link key={drawing.id} href={`/gallery/${drawing.id}`}>
                    <div
                      className={`bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-all hover:-translate-y-0.5 ${
                        drawing.is_featured
                          ? "ring-2 ring-yellow-400"
                          : "border border-gray-100"
                      }`}
                    >
                      {/* Thumbnail */}
                      <div className="aspect-square relative">
                        <img
                          src={drawing.image_url}
                          alt={title}
                          className="w-full h-full object-cover rounded-t-2xl"
                        />
                        {/* Featured badge */}
                        {drawing.is_featured && (
                          <div className="absolute top-2 left-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-400 text-white shadow">
                              <Star size={11} fill="currentColor" />
                              {t("বিশেষ", "Featured")}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Card footer */}
                      <div className="p-3 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-gray-800 truncate">
                            {drawing.child_name}
                          </p>
                          {drawing.title || drawing.title_bn ? (
                            <p className="text-xs text-gray-400 truncate">{title}</p>
                          ) : null}
                        </div>

                        {/* Like button */}
                        <button
                          onClick={(e) => handleLike(e, drawing.id)}
                          disabled={isLiking}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all min-w-[56px] justify-center ${
                            isLiked
                              ? "bg-pink-100 text-pink-600"
                              : "bg-gray-100 text-gray-500 hover:bg-pink-50 hover:text-pink-500"
                          } ${isLiking ? "opacity-60 cursor-not-allowed" : ""}`}
                          title={
                            !isAuthenticated
                              ? t("লাইক দিতে লগইন করুন", "Login to like")
                              : isLiked
                              ? t("আনলাইক", "Unlike")
                              : t("লাইক", "Like")
                          }
                        >
                          <Heart
                            size={13}
                            fill={isLiked ? "currentColor" : "none"}
                            className={isLiking ? "animate-pulse" : ""}
                          />
                          <span>{drawing.like_count}</span>
                        </button>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* ── Load More ── */}
            {hasMore && (
              <div className="mt-10 flex justify-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-8 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold text-sm shadow-md hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-2"
                >
                  {loadingMore ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {t("লোড হচ্ছে...", "Loading...")}
                    </>
                  ) : (
                    t("আরও দেখো", "Load More")
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
