"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Heart, ArrowLeft, Star } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useLocaleStore } from "@/stores/locale-store";
import { api } from "@/lib/api";
import { toast } from "@/stores/toast-store";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DrawingDetail {
  id: string;
  child_profile_id: string;
  child_name: string;
  image_url: string;
  title: string | null;
  title_bn: string | null;
  status: string;
  is_featured: boolean;
  like_count: number;
  liked_by_me?: boolean;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SingleDrawingPage() {
  const params = useParams();
  const id = params?.id as string;

  const { accessToken, isAuthenticated } = useAuthStore();
  const { t } = useLocaleStore();

  const [drawing, setDrawing] = useState<DrawingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [heartAnimating, setHeartAnimating] = useState(false);

  // ── Load drawing ─────────────────────────────────────────────────────────────
  const loadDrawing = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data: any = await api.get(`/drawings/${id}`, accessToken ?? undefined);
      setDrawing(data);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id, accessToken]);

  useEffect(() => {
    loadDrawing();
  }, [loadDrawing]);

  // ── Toggle like ──────────────────────────────────────────────────────────────
  const handleLike = async () => {
    if (!isAuthenticated) {
      toast.info(t("লাইক দিতে লগইন করুন।", "Login to like drawings."));
      return;
    }
    if (isLiking) return;

    // Trigger heart animation
    setHeartAnimating(true);
    setTimeout(() => setHeartAnimating(false), 350);

    setIsLiking(true);
    try {
      const res: any = await api.post(`/drawings/${id}/like`, {}, accessToken ?? undefined);
      setDrawing((prev) =>
        prev ? { ...prev, like_count: res.like_count, liked_by_me: res.liked } : prev,
      );
    } catch {
      toast.error(t("লাইক দেওয়া যায়নি।", "Could not update like."));
    } finally {
      setIsLiking(false);
    }
  };

  // ── Loading state ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-yellow-50 font-bn flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-300 border-t-purple-600 rounded-full animate-spin mb-4" />
        <p className="text-gray-500 text-sm font-medium">
          {t("লোড হচ্ছে...", "Loading...")}
        </p>
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────────
  if (notFound || !drawing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-yellow-50 font-bn flex flex-col items-center justify-center px-4 text-center">
        <div className="text-7xl mb-5">🖼️</div>
        <h2 className="text-2xl font-extrabold text-gray-700 mb-2">
          {t("ছবি পাওয়া যায়নি!", "Drawing not found!")}
        </h2>
        <p className="text-sm text-gray-400 mb-8">
          {t(
            "এই ছবিটি সরানো হয়েছে বা অনুমোদিত নয়।",
            "This drawing may have been removed or is not approved.",
          )}
        </p>
        <Link
          href="/gallery"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold shadow-md hover:opacity-90 transition-opacity"
        >
          <ArrowLeft size={18} />
          {t("গ্যালারিতে ফিরে যাও", "Back to Gallery")}
        </Link>
      </div>
    );
  }

  const title = t(
    drawing.title_bn || drawing.title || "শিরোনামহীন",
    drawing.title || "Untitled",
  );

  // ── Main render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-yellow-50 font-bn">
      {/* ── Top bar ── */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-purple-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/gallery"
            className="flex items-center gap-2 text-gray-600 hover:text-purple-600 transition-colors font-semibold text-sm"
          >
            <ArrowLeft size={18} />
            <span className="hidden sm:inline">
              {t("গ্যালারিতে ফিরে যাও", "Back to Gallery")}
            </span>
            <span className="sm:hidden">{t("গ্যালারি", "Gallery")}</span>
          </Link>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* ── Drawing image ── */}
        <div
          className={`overflow-hidden rounded-2xl shadow-xl mb-6 ${
            drawing.is_featured ? "ring-4 ring-yellow-400" : ""
          }`}
        >
          <img
            src={drawing.image_url}
            alt={title}
            className="w-full object-contain bg-white"
          />
        </div>

        {/* ── Info card ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {/* Featured badge */}
          {drawing.is_featured && (
            <div className="mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-yellow-400 text-white shadow-sm">
                <Star size={14} fill="currentColor" />
                {t("বিশেষ ছবি", "Featured Drawing")}
              </span>
            </div>
          )}

          {/* Title */}
          {(drawing.title || drawing.title_bn) && (
            <h1 className="text-2xl font-extrabold text-gray-800 mb-3">{title}</h1>
          )}

          {/* Child name + date */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white font-bold text-base flex-shrink-0">
              {drawing.child_name?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">{drawing.child_name}</p>
              <p className="text-xs text-gray-400">{formatDate(drawing.created_at)}</p>
            </div>
          </div>

          {/* ── Like button ── */}
          <button
            onClick={handleLike}
            disabled={isLiking}
            className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-bold text-base transition-all shadow-sm active:scale-95 ${
              drawing.liked_by_me
                ? "bg-pink-500 text-white hover:bg-pink-600"
                : "bg-gray-100 text-gray-600 hover:bg-pink-50 hover:text-pink-500 border border-gray-200"
            } ${isLiking ? "opacity-70 cursor-not-allowed" : ""}`}
            title={
              !isAuthenticated
                ? t("লাইক দিতে লগইন করুন", "Login to like")
                : drawing.liked_by_me
                ? t("আনলাইক", "Unlike")
                : t("লাইক", "Like")
            }
          >
            <Heart
              size={22}
              fill={drawing.liked_by_me ? "currentColor" : "none"}
              className={`transition-transform ${heartAnimating ? "scale-125" : "scale-100"}`}
            />
            <span className="text-xl font-extrabold">{drawing.like_count}</span>
            <span className="text-sm font-semibold">
              {drawing.liked_by_me ? t("লাইক করেছ", "Liked") : t("লাইক", "Like")}
            </span>
          </button>

          {/* Login hint for guests */}
          {!isAuthenticated && (
            <p className="mt-3 text-xs text-gray-400">
              {t(
                "লাইক দিতে ",
                "To like this drawing, ",
              )}
              <Link href="/login" className="text-purple-500 font-semibold hover:underline">
                {t("লগইন করুন", "login")}
              </Link>
            </p>
          )}
        </div>

        {/* ── Back link (bottom) ── */}
        <div className="mt-8 flex justify-center">
          <Link
            href="/gallery"
            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-purple-600 transition-colors"
          >
            <ArrowLeft size={16} />
            {t("সব ছবি দেখো", "View all drawings")}
          </Link>
        </div>
      </div>
    </div>
  );
}
