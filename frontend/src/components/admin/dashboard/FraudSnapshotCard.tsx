"use client";

import { Shield, ArrowRight, AlertTriangle } from "lucide-react";
import { useLocaleStore } from "@/stores/locale-store";

type FraudSummary = {
  total_orders?: number;
  low_risk?: number;
  medium_risk?: number;
  high_risk?: number;
  guest_orders?: number;
  cancelled_rate?: number;
  returned_rate?: number;
  vpn_orders?: number;
};

export function FraudSnapshotCard({
  summary,
  days,
  loading,
  onNavigate,
}: {
  summary: FraudSummary | null;
  days: number;
  loading: boolean;
  onNavigate: (tab: string) => void;
}) {
  const { locale, t } = useLocaleStore();
  const total = summary?.total_orders || 0;
  const low = summary?.low_risk || 0;
  const medium = summary?.medium_risk || 0;
  const high = summary?.high_risk || 0;
  const scored = low + medium + high;

  const lowPct = scored > 0 ? (low / scored) * 100 : 0;
  const medPct = scored > 0 ? (medium / scored) * 100 : 0;
  const highPct = scored > 0 ? (high / scored) * 100 : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm h-full flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#7c2df7]">
            <Shield className="w-3.5 h-3.5" />
            <span className={locale === "bn" ? "font-bn" : ""}>{t("ফ্রড স্ন্যাপশট", "Fraud Snapshot")}</span>
          </div>
          <h3 className={`text-lg font-bold text-gray-900 mt-1 ${locale === "bn" ? "font-bn" : ""}`}>
            {t(`গত ${days} দিন`, `Last ${days} days`)}
          </h3>
        </div>
        <button
          onClick={() => onNavigate("fraud-dashboard")}
          className="text-[11px] font-semibold text-[#7c2df7] hover:text-[#532d80] inline-flex items-center gap-1"
        >
          <span className={locale === "bn" ? "font-bn" : ""}>{t("বিস্তারিত", "Details")}</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 space-y-3">
          <div className="skeleton h-12 rounded-lg" />
          <div className="skeleton h-3 rounded-full" />
          <div className="skeleton h-16 rounded-lg" />
        </div>
      ) : total === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
          <div className="w-12 h-12 rounded-full bg-[#f5f0ff] flex items-center justify-center mb-3">
            <Shield className="w-5 h-5 text-[#7c2df7]" />
          </div>
          <p className={`text-sm font-semibold text-gray-700 ${locale === "bn" ? "font-bn" : ""}`}>
            {t("কোনো অর্ডার ডেটা নেই", "No order data yet")}
          </p>
        </div>
      ) : (
        <>
          {/* Stacked bar */}
          <div className="mb-3">
            <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
              {lowPct > 0 && <div className="bg-emerald-500" style={{ width: `${lowPct}%` }} title="Low" />}
              {medPct > 0 && <div className="bg-amber-500" style={{ width: `${medPct}%` }} title="Medium" />}
              {highPct > 0 && <div className="bg-rose-500" style={{ width: `${highPct}%` }} title="High" />}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            <RiskPill tone="emerald" label={t("লো", "Low")} value={low} pct={lowPct} locale={locale} />
            <RiskPill tone="amber" label={t("মিড", "Med")} value={medium} pct={medPct} locale={locale} />
            <RiskPill tone="rose" label={t("হাই", "High")} value={high} pct={highPct} locale={locale} />
          </div>

          <div className="mt-auto grid grid-cols-2 gap-2 text-[11px] pt-3 border-t border-gray-100">
            <MiniStat label={t("বাতিল হার", "Cancel rate")} value={`${summary?.cancelled_rate ?? 0}%`} locale={locale} />
            <MiniStat label={t("রিটার্ন হার", "Return rate")} value={`${summary?.returned_rate ?? 0}%`} locale={locale} />
            <MiniStat label={t("গেস্ট অর্ডার", "Guest orders")} value={String(summary?.guest_orders ?? 0)} locale={locale} />
            <MiniStat
              label={t("VPN/প্রক্সি", "VPN/Proxy")}
              value={String(summary?.vpn_orders ?? 0)}
              locale={locale}
              warn={(summary?.vpn_orders ?? 0) > 0}
            />
          </div>
        </>
      )}
    </div>
  );
}

const RISK: Record<string, { bg: string; fg: string }> = {
  emerald: { bg: "bg-emerald-50", fg: "text-emerald-700" },
  amber:   { bg: "bg-amber-50",   fg: "text-amber-700" },
  rose:    { bg: "bg-rose-50",    fg: "text-rose-700" },
};

function RiskPill({
  tone, label, value, pct, locale,
}: { tone: keyof typeof RISK; label: string; value: number; pct: number; locale: string }) {
  const p = RISK[tone];
  return (
    <div className={`${p.bg} rounded-lg p-2 text-center`}>
      <p className={`text-[10px] font-semibold uppercase ${p.fg} ${locale === "bn" ? "font-bn" : ""}`}>{label}</p>
      <p className={`text-base font-bold ${p.fg} tabular-nums`}>{value}</p>
      <p className="text-[9px] text-gray-400 tabular-nums">{pct.toFixed(0)}%</p>
    </div>
  );
}

function MiniStat({ label, value, locale, warn }: { label: string; value: string; locale: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-gray-500 ${locale === "bn" ? "font-bn" : ""}`}>{label}</span>
      <span className={`font-bold tabular-nums ${warn ? "text-rose-600" : "text-gray-900"} inline-flex items-center gap-1`}>
        {warn && <AlertTriangle className="w-3 h-3" />}
        {value}
      </span>
    </div>
  );
}
