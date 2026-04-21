"use client";

import { AlertTriangle, HelpCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocaleStore } from "@/stores/locale-store";

export type ConfirmTone = "destructive" | "question" | "info";

export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  tone = "question",
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  tone?: ConfirmTone;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}) {
  const { locale, t } = useLocaleStore();
  const [busy, setBusy] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel, busy]);

  if (!open) return null;

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={() => !busy && onCancel()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            tone === "destructive" ? "bg-rose-50" :
            tone === "info" ? "bg-[#f5f0ff]" : "bg-amber-50"
          }`}>
            {tone === "destructive" ? (
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            ) : tone === "info" ? (
              <HelpCircle className="w-5 h-5 text-[#7c2df7]" />
            ) : (
              <HelpCircle className="w-5 h-5 text-amber-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`text-base font-bold text-gray-900 ${locale === "bn" ? "font-bn" : ""}`}>{title}</h3>
            <p className={`text-sm text-gray-600 mt-1.5 ${locale === "bn" ? "font-bn" : ""}`}>{body}</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onCancel}
            disabled={busy}
            className={`px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 ${locale === "bn" ? "font-bn" : ""}`}
          >
            {t("বাতিল", "Cancel")}
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-60 ${
              tone === "destructive" ? "bg-rose-600 hover:bg-rose-700" : "bg-[#7c2df7] hover:bg-[#6b1ee3]"
            } ${locale === "bn" ? "font-bn" : ""}`}
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel || t("নিশ্চিত করুন", "Confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
