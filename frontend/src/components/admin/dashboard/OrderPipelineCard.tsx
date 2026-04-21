"use client";

import { ShoppingBag, ArrowRight } from "lucide-react";
import { useLocaleStore } from "@/stores/locale-store";

type Counts = Record<string, number | undefined> & { total?: number };

const STAGES: { key: string; bn: string; en: string; color: string }[] = [
  { key: "pending",     bn: "পেন্ডিং",     en: "Pending",     color: "#eab308" },
  { key: "confirmed",   bn: "কনফার্মড",    en: "Confirmed",   color: "#3b82f6" },
  { key: "processing",  bn: "প্রসেসিং",    en: "Processing",  color: "#8b5cf6" },
  { key: "fulfilled",   bn: "ফুলফিল্ড",    en: "Fulfilled",   color: "#22c55e" },
];

export function OrderPipelineCard({
  counts,
  loading,
  onNavigate,
}: {
  counts: Counts;
  loading: boolean;
  onNavigate: (tab: string, extra?: Record<string, string>) => void;
}) {
  const { locale, t } = useLocaleStore();
  const max = Math.max(1, ...STAGES.map((s) => counts[s.key] || 0));
  const cancelled = counts["cancelled"] || 0;
  const refunded = counts["refunded"] || 0;
  const total = counts.total || 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm h-full flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#7c2df7]">
            <ShoppingBag className="w-3.5 h-3.5" />
            <span className={locale === "bn" ? "font-bn" : ""}>{t("অর্ডার পাইপলাইন", "Order Pipeline")}</span>
          </div>
          <h3 className={`text-lg font-bold text-gray-900 mt-1 ${locale === "bn" ? "font-bn" : ""}`}>
            {total.toLocaleString(locale === "bn" ? "bn-BD" : "en-US")} {t("মোট", "total")}
          </h3>
        </div>
        <button
          onClick={() => onNavigate("orders")}
          className="text-[11px] font-semibold text-[#7c2df7] hover:text-[#532d80] inline-flex items-center gap-1"
        >
          <span className={locale === "bn" ? "font-bn" : ""}>{t("সব দেখুন", "View all")}</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-10 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-2.5 flex-1">
          {STAGES.map((s) => {
            const v = counts[s.key] || 0;
            const pct = (v / max) * 100;
            return (
              <button
                key={s.key}
                onClick={() => onNavigate("orders", { status: s.key })}
                className="w-full text-left group"
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span
                    className={`font-semibold flex items-center gap-1.5 ${locale === "bn" ? "font-bn" : ""}`}
                    style={{ color: s.color }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                    {locale === "bn" ? s.bn : s.en}
                  </span>
                  <span className="text-gray-700 font-bold tabular-nums">{v}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all group-hover:brightness-110"
                    style={{ width: `${pct}%`, background: s.color }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 text-center">
        <div className="bg-rose-50 rounded-lg py-2">
          <p className={`text-[10px] text-rose-600 font-semibold uppercase ${locale === "bn" ? "font-bn" : ""}`}>{t("বাতিল", "Cancelled")}</p>
          <p className="text-sm font-bold text-rose-700 tabular-nums">{cancelled}</p>
        </div>
        <div className="bg-orange-50 rounded-lg py-2">
          <p className={`text-[10px] text-orange-600 font-semibold uppercase ${locale === "bn" ? "font-bn" : ""}`}>{t("রিফান্ড", "Refunded")}</p>
          <p className="text-sm font-bold text-orange-700 tabular-nums">{refunded}</p>
        </div>
      </div>
    </div>
  );
}
