"use client";

import { useToastStore } from "@/stores/toast-store";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";

export function ToastProvider() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 w-80 max-w-[calc(100vw-2rem)] p-4 rounded-xl shadow-lg border animate-in slide-in-from-bottom-5 fade-in pointer-events-auto ${
            t.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : t.type === "error"
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-blue-50 border-blue-200 text-blue-800"
          }`}
        >
          {t.type === "success" && <CheckCircle2 className="w-5 h-5 shrink-0 text-green-600" />}
          {t.type === "error" && <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />}
          {t.type === "info" && <Info className="w-5 h-5 shrink-0 text-blue-600" />}
          
          <div className="flex-1 text-sm font-medium font-bn mt-0.5">{t.message}</div>
          
          <button
            onClick={() => removeToast(t.id)}
            className={`shrink-0 rounded-lg p-1 transition-colors ${
              t.type === "success"
                ? "hover:bg-green-100 text-green-700"
                : t.type === "error"
                ? "hover:bg-red-100 text-red-700"
                : "hover:bg-blue-100 text-blue-700"
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
