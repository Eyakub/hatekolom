"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, Pencil } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useLocaleStore } from "@/stores/locale-store";
import { api } from "@/lib/api";
import { toast } from "@/stores/toast-store";
import DrawingCanvas from "@/components/drawing/DrawingCanvas";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Child {
  id: string;
  full_name: string;
  full_name_bn?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FreeDrawingPage() {
  const router = useRouter();
  const { user, accessToken, isAuthenticated, _hasHydrated } = useAuthStore();
  const { t } = useLocaleStore();

  // Children
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState("");

  // Save flow
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [showTitleModal, setShowTitleModal] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  // Close modal
  const [showCloseModal, setShowCloseModal] = useState(false);

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

  // ── Canvas save handler ─────────────────────────────────────────────────────
  const handleSave = useCallback((blob: Blob) => {
    setPendingBlob(blob);
    setTitle("");
    setShowTitleModal(true);
  }, []);

  // ── Submit after title entered ──────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!pendingBlob || !accessToken) return;
    setSaving(true);

    try {
      // 1. Upload image
      const fd = new FormData();
      fd.append("file", pendingBlob, "drawing.png");
      fd.append("folder", "drawings");
      const uploadRes: any = await api.postFormData("/uploads/image", fd, accessToken);

      // 2. Save drawing record
      await api.post(
        "/drawings/",
        {
          child_profile_id: selectedChild || undefined,
          image_url: uploadRes.url,
          title: title.trim() || undefined,
          title_bn: title.trim() || undefined,
        },
        accessToken,
      );

      // 3. Success feedback
      setShowTitleModal(false);
      setPendingBlob(null);
      setTitle("");
      toast.success(
        t(
          "ছবি সংরক্ষিত হয়েছে! অভিভাবকের অনুমোদনের অপেক্ষায়।",
          "Drawing saved! Waiting for parent approval.",
        ),
      );
    } catch {
      toast.error(t("সংরক্ষণ ব্যর্থ হয়েছে। আবার চেষ্টা করুন।", "Save failed. Please try again."));
    } finally {
      setSaving(false);
    }
  }, [pendingBlob, accessToken, selectedChild, title, t]);

  // ── Cancel title modal ──────────────────────────────────────────────────────
  const handleCancelTitle = () => {
    setShowTitleModal(false);
    setPendingBlob(null);
    setTitle("");
  };

  // ── Close / exit page ───────────────────────────────────────────────────────
  const handleClose = () => {
    setShowCloseModal(true);
  };

  const handleConfirmClose = () => {
    setShowCloseModal(false);
    router.push("/drawings");
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (!_hasHydrated || !isAuthenticated) return null;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 font-bn">
      {/* ── Top bar ── */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-purple-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Title */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-sm flex-shrink-0">
              <Pencil size={18} className="text-white" />
            </div>
            <h1 className="text-base sm:text-lg font-extrabold text-gray-800 truncate">
              {t("মুক্ত আঁকা 🎨", "Free Drawing 🎨")}
            </h1>
          </div>

          {/* Child selector */}
          {children.length > 1 && (
            <select
              value={selectedChild}
              onChange={(e) => setSelectedChild(e.target.value)}
              className="text-sm border border-purple-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300 max-w-[160px]"
            >
              <option value="">{t("শিশু বেছে নিন", "Select child")}</option>
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name_bn || c.full_name}
                </option>
              ))}
            </select>
          )}

          {/* Close */}
          <button
            onClick={handleClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors flex-shrink-0"
            title={t("বন্ধ করুন", "Close")}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* ── Canvas area ── */}
      <div className="flex-1 flex flex-col items-center justify-start py-6 px-4">
        <DrawingCanvas onSave={handleSave} />
      </div>

      {/* ── Title input modal ── */}
      {showTitleModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={handleCancelTitle}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full flex flex-col gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="text-4xl mb-2">🎨</div>
              <h2 className="text-xl font-bold text-gray-800">
                {t("ছবির নাম দিন", "Name your drawing")}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {t("ঐচ্ছিক — খালি রাখলেও হবে।", "Optional — you can leave it blank.")}
              </p>
            </div>

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !saving) handleSubmit();
              }}
              placeholder={t("যেমন: আমার বাড়ি", "e.g. My house")}
              className="w-full border-2 border-purple-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-purple-400 transition-colors"
              autoFocus
            />

            <div className="flex gap-3">
              <button
                onClick={handleCancelTitle}
                disabled={saving}
                className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-all disabled:opacity-50"
              >
                {t("বাতিল", "Cancel")}
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:opacity-90 shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t("সংরক্ষণ হচ্ছে...", "Saving...")}
                  </>
                ) : (
                  t("সংরক্ষণ করুন", "Save")
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Exit confirmation modal ── */}
      {showCloseModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setShowCloseModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full flex flex-col items-center gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-5xl">🖼️</div>
            <h2 className="text-xl font-bold text-gray-800 text-center">
              {t("আঁকা ছেড়ে যাবেন?", "Leave the drawing?")}
            </h2>
            <p className="text-sm text-gray-500 text-center">
              {t(
                "সংরক্ষণ না করলে আঁকা হারিয়ে যাবে।",
                "Unsaved changes will be lost.",
              )}
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setShowCloseModal(false)}
                className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-all"
              >
                {t("আঁকতে থাকুন", "Keep Drawing")}
              </button>
              <button
                onClick={handleConfirmClose}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 shadow-sm transition-all"
              >
                {t("হ্যাঁ, বের হব", "Yes, Exit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
