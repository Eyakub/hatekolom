"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, Pencil, Check, X, Image } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useLocaleStore } from "@/stores/locale-store";
import { api } from "@/lib/api";
import { toast } from "@/stores/toast-store";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Drawing {
  id: string;
  child_profile_id: string;
  image_url: string;
  title: string | null;
  title_bn: string | null;
  status: "pending" | "approved" | "rejected";
  is_featured: boolean;
  like_count: number;
  created_at: string;
}

interface Child {
  id: string;
  full_name: string;
  full_name_bn?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("bn-BD", { year: "numeric", month: "short", day: "numeric" });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MyDrawingsPage() {
  const router = useRouter();
  const { user, accessToken, isAuthenticated, _hasHydrated } = useAuthStore();
  const { t } = useLocaleStore();

  const isParent = user?.roles?.includes("parent") ?? false;

  // Children
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState("");

  // Drawings
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [loading, setLoading] = useState(true);

  // Inline preview modal (for pending/rejected)
  const [previewDrawing, setPreviewDrawing] = useState<Drawing | null>(null);

  // Action loading states: track which drawing id is being approved/rejected
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [_hasHydrated, isAuthenticated, router]);

  // ── Load children ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!accessToken) return;
    const loadChildren = async () => {
      try {
        const data: any = await api.get("/children/", accessToken);
        const list: Child[] = Array.isArray(data) ? data : data?.items || [];
        setChildren(list);
        if (list.length === 1) setSelectedChild(list[0].id);
      } catch {
        // silently ignore
      }
    };
    loadChildren();
  }, [accessToken]);

  // ── Load drawings ───────────────────────────────────────────────────────────
  const loadDrawings = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const endpoint = selectedChild
        ? `/drawings/my?child_profile_id=${selectedChild}`
        : "/drawings/my";
      const data: any = await api.get(endpoint, accessToken);
      const list: Drawing[] = Array.isArray(data) ? data : data?.items || [];
      setDrawings(list);
    } catch {
      setDrawings([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, selectedChild]);

  useEffect(() => {
    loadDrawings();
  }, [loadDrawings]);

  // ── Approve drawing ─────────────────────────────────────────────────────────
  const handleApprove = async (drawingId: string) => {
    if (!accessToken || actionLoading) return;
    setActionLoading(drawingId);
    try {
      const updated: any = await api.put(`/drawings/${drawingId}/approve`, {}, accessToken);
      setDrawings((prev) =>
        prev.map((d) =>
          d.id === drawingId ? { ...d, status: "approved", ...updated } : d,
        ),
      );
      toast.success(t("ছবি অনুমোদন করা হয়েছে!", "Drawing approved!"));
    } catch {
      toast.error(t("অনুমোদন ব্যর্থ হয়েছে।", "Approval failed."));
    } finally {
      setActionLoading(null);
    }
  };

  // ── Reject drawing ──────────────────────────────────────────────────────────
  const handleReject = async (drawingId: string) => {
    if (!accessToken || actionLoading) return;
    setActionLoading(drawingId);
    try {
      const updated: any = await api.put(`/drawings/${drawingId}/reject`, {}, accessToken);
      setDrawings((prev) =>
        prev.map((d) =>
          d.id === drawingId ? { ...d, status: "rejected", ...updated } : d,
        ),
      );
      toast.success(t("ছবি প্রত্যাখ্যান করা হয়েছে।", "Drawing rejected."));
    } catch {
      toast.error(t("প্রত্যাখ্যান ব্যর্থ হয়েছে।", "Rejection failed."));
    } finally {
      setActionLoading(null);
    }
  };

  // ── Status badge helper ─────────────────────────────────────────────────────
  const statusBadge = (status: Drawing["status"]) => {
    if (status === "approved") {
      return (
        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
          {t("অনুমোদিত", "Approved")}
        </span>
      );
    }
    if (status === "rejected") {
      return (
        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
          {t("প্রত্যাখ্যাত", "Rejected")}
        </span>
      );
    }
    return (
      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
        {t("অপেক্ষায়", "Pending")}
      </span>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (!_hasHydrated || !isAuthenticated) return null;

  // Pending drawings for parent section
  const pendingDrawings = drawings.filter((d) => d.status === "pending");

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 font-bn">

      {/* ── Top bar ── */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-purple-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-sm flex-shrink-0">
              <Image size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-extrabold text-gray-800 leading-tight truncate">
                {t("আমার আঁকা ছবি", "My Drawings")}
              </h1>
            </div>
          </div>

          {/* Child selector */}
          {children.length > 1 && (
            <select
              value={selectedChild}
              onChange={(e) => setSelectedChild(e.target.value)}
              className="text-sm border border-purple-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300 max-w-[160px]"
            >
              <option value="">{t("সব শিশু", "All children")}</option>
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name_bn || c.full_name}
                </option>
              ))}
            </select>
          )}

          {/* Start drawing button */}
          <Link
            href="/draw"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-sm shadow-sm hover:opacity-90 transition-opacity flex-shrink-0"
          >
            <Pencil size={15} />
            <span className="hidden sm:inline">{t("আঁকতে শুরু করো", "Start Drawing")}</span>
            <span className="sm:hidden">{t("আঁকো", "Draw")}</span>
          </Link>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* ── Parent section: pending approvals ── */}
        {isParent && pendingDrawings.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">🔔</span>
              <h2 className="text-base font-extrabold text-gray-700">
                {t("অনুমোদনের অপেক্ষায়", "Pending Approvals")}
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-400 text-white text-xs font-bold">
                  {pendingDrawings.length}
                </span>
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingDrawings.map((drawing) => {
                const isActioning = actionLoading === drawing.id;
                return (
                  <div
                    key={drawing.id}
                    className="bg-white rounded-2xl shadow-sm border border-yellow-200 overflow-hidden"
                  >
                    <div
                      className="aspect-square cursor-pointer relative group"
                      onClick={() => setPreviewDrawing(drawing)}
                    >
                      <img
                        src={drawing.image_url}
                        alt={drawing.title_bn || drawing.title || t("শিরোনামহীন", "Untitled")}
                        className="w-full h-full object-cover rounded-t-2xl"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-t-2xl flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                          {t("বড় করে দেখো", "View full size")}
                        </span>
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-semibold text-gray-800 truncate mb-1">
                        {t(
                          drawing.title_bn || drawing.title || "শিরোনামহীন",
                          drawing.title || "Untitled",
                        )}
                      </p>
                      <p className="text-xs text-gray-400 mb-3">{formatDate(drawing.created_at)}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(drawing.id)}
                          disabled={isActioning}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-500 text-white text-xs font-bold hover:bg-green-600 transition-colors disabled:opacity-60"
                        >
                          {isActioning ? (
                            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Check size={13} />
                          )}
                          {t("অনুমোদন", "Approve")}
                        </button>
                        <button
                          onClick={() => handleReject(drawing.id)}
                          disabled={isActioning}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors disabled:opacity-60"
                        >
                          {isActioning ? (
                            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <X size={13} />
                          )}
                          {t("প্রত্যাখ্যান", "Reject")}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── All drawings ── */}
        <div className="mb-4 flex items-center gap-2">
          <span className="text-lg">🎨</span>
          <h2 className="text-base font-extrabold text-gray-700">
            {t("সব ছবি", "All Drawings")}
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="animate-pulse bg-gray-200 aspect-square rounded-t-2xl" />
                <div className="p-3 space-y-2">
                  <div className="animate-pulse h-3.5 bg-gray-200 rounded w-3/4" />
                  <div className="animate-pulse h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : drawings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-7xl mb-5">🎨</div>
            <h3 className="text-xl font-extrabold text-gray-600 mb-2">
              {t("এখনও কোনো ছবি নেই!", "No drawings yet!")}
            </h3>
            <p className="text-sm text-gray-400 mb-6">
              {t("আঁকতে শুরু করো এবং তোমার ছবি এখানে দেখাও।", "Start creating and your drawings will appear here.")}
            </p>
            <Link
              href="/draw"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-base shadow-lg hover:opacity-90 transition-opacity"
            >
              <Pencil size={18} />
              {t("আঁকতে শুরু করো", "Start Drawing")}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {drawings.map((drawing) => {
              const title = t(
                drawing.title_bn || drawing.title || "শিরোনামহীন",
                drawing.title || "Untitled",
              );
              const isApproved = drawing.status === "approved";
              const isActioning = actionLoading === drawing.id;

              const cardContent = (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                  {/* Thumbnail */}
                  <div className="aspect-square relative">
                    <img
                      src={drawing.image_url}
                      alt={title}
                      className="w-full h-full object-cover rounded-t-2xl"
                    />
                    {/* Status overlay badge */}
                    <div className="absolute top-2 right-2">
                      {statusBadge(drawing.status)}
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="p-3">
                    <p className="text-sm font-semibold text-gray-800 truncate mb-1">{title}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">{formatDate(drawing.created_at)}</span>
                      {isApproved && drawing.like_count > 0 && (
                        <span className="flex items-center gap-1 text-xs text-pink-500 font-semibold">
                          <Heart size={12} fill="currentColor" />
                          {drawing.like_count}
                        </span>
                      )}
                    </div>

                    {/* Parent approve/reject for this card (only for parent role, non-pending already handled above) */}
                    {isParent && drawing.status === "pending" && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleApprove(drawing.id);
                          }}
                          disabled={isActioning}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-green-500 text-white text-xs font-bold hover:bg-green-600 transition-colors disabled:opacity-60"
                        >
                          {isActioning ? (
                            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Check size={11} />
                          )}
                          {t("অনুমোদন", "Approve")}
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleReject(drawing.id);
                          }}
                          disabled={isActioning}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors disabled:opacity-60"
                        >
                          {isActioning ? (
                            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <X size={11} />
                          )}
                          {t("প্রত্যাখ্যান", "Reject")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );

              // Approved → link to gallery
              if (isApproved) {
                return (
                  <Link key={drawing.id} href={`/gallery/${drawing.id}`}>
                    {cardContent}
                  </Link>
                );
              }

              // Pending/rejected → open inline preview modal
              return (
                <div
                  key={drawing.id}
                  className="cursor-pointer"
                  onClick={() => setPreviewDrawing(drawing)}
                >
                  {cardContent}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Start Drawing CTA (when drawings exist) ── */}
        {!loading && drawings.length > 0 && (
          <div className="mt-10 flex justify-center">
            <Link
              href="/draw"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-extrabold text-base shadow-xl hover:opacity-90 transition-opacity"
            >
              <span className="text-xl">🎨</span>
              {t("নতুন ছবি আঁকো!", "Draw Something New!")}
              <Pencil size={18} />
            </Link>
          </div>
        )}
      </div>

      {/* ── Preview modal (for pending/rejected drawings) ── */}
      {previewDrawing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setPreviewDrawing(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-extrabold text-gray-800 text-base">
                  {t(
                    previewDrawing.title_bn || previewDrawing.title || "শিরোনামহীন",
                    previewDrawing.title || "Untitled",
                  )}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  {statusBadge(previewDrawing.status)}
                  <span className="text-xs text-gray-400">{formatDate(previewDrawing.created_at)}</span>
                </div>
              </div>
              <button
                onClick={() => setPreviewDrawing(null)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Full-size image */}
            <div className="bg-gray-50">
              <img
                src={previewDrawing.image_url}
                alt={t(
                  previewDrawing.title_bn || previewDrawing.title || "শিরোনামহীন",
                  previewDrawing.title || "Untitled",
                )}
                className="w-full max-h-[60vh] object-contain"
              />
            </div>

            {/* Parent approve/reject inside modal */}
            {isParent && previewDrawing.status === "pending" && (
              <div className="px-5 py-4 flex gap-3 border-t border-gray-100">
                <button
                  onClick={() => {
                    handleApprove(previewDrawing.id);
                    setPreviewDrawing(null);
                  }}
                  disabled={actionLoading === previewDrawing.id}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500 text-white font-bold hover:bg-green-600 transition-colors disabled:opacity-60"
                >
                  <Check size={16} />
                  {t("অনুমোদন করো", "Approve")}
                </button>
                <button
                  onClick={() => {
                    handleReject(previewDrawing.id);
                    setPreviewDrawing(null);
                  }}
                  disabled={actionLoading === previewDrawing.id}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors disabled:opacity-60"
                >
                  <X size={16} />
                  {t("প্রত্যাখ্যান করো", "Reject")}
                </button>
              </div>
            )}

            {/* Close button for non-parent or non-pending */}
            {(!isParent || previewDrawing.status !== "pending") && (
              <div className="px-5 py-4 border-t border-gray-100">
                <button
                  onClick={() => setPreviewDrawing(null)}
                  className="w-full py-3 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors"
                >
                  {t("বন্ধ করো", "Close")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
