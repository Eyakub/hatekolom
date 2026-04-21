"use client";

import { AlertTriangle, ChevronRight, CheckCircle2, Clock, Truck, ShieldAlert, Package } from "lucide-react";
import { useLocaleStore } from "@/stores/locale-store";

type Stats = {
  pending_orders?: number;
  pending_shipments?: number;
};

type FraudSummary = {
  high_risk?: number;
  medium_risk?: number;
};

export function NeedsAttentionCard({
  stats,
  fraudSummary,
  loading,
  onNavigate,
}: {
  stats: Stats | null;
  fraudSummary: FraudSummary | null;
  loading: boolean;
  onNavigate: (tab: string, extra?: Record<string, string>) => void;
}) {
  const { locale, t } = useLocaleStore();

  const items = [
    {
      key: "pending_orders",
      count: stats?.pending_orders || 0,
      icon: Clock,
      tone: "amber" as const,
      title: t("পেন্ডিং অর্ডার", "Pending orders"),
      desc: t("কনফার্ম করার অপেক্ষায়", "Awaiting confirmation"),
      action: () => onNavigate("orders", { status: "pending" }),
    },
    {
      key: "pending_shipments",
      count: stats?.pending_shipments || 0,
      icon: Truck,
      tone: "blue" as const,
      title: t("পেন্ডিং শিপমেন্ট", "Pending shipments"),
      desc: t("ডেলিভারি প্রস্তুতির অপেক্ষায়", "Ready to dispatch"),
      action: () => onNavigate("shipments", { status: "pending" }),
    },
    {
      key: "high_risk",
      count: fraudSummary?.high_risk || 0,
      icon: ShieldAlert,
      tone: "rose" as const,
      title: t("হাই-রিস্ক অর্ডার", "High-risk orders"),
      desc: t("ম্যানুয়াল রিভিউ প্রয়োজন", "Review manually"),
      action: () => onNavigate("fraud-dashboard"),
    },
    {
      key: "medium_risk",
      count: fraudSummary?.medium_risk || 0,
      icon: Package,
      tone: "violet" as const,
      title: t("মিডিয়াম রিস্ক অর্ডার", "Medium-risk orders"),
      desc: t("নজরে রাখুন", "Keep an eye"),
      action: () => onNavigate("fraud-dashboard"),
    },
  ];

  const nothingPending = items.every((i) => i.count === 0) && !loading;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#b77800]">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span className={locale === "bn" ? "font-bn" : ""}>{t("মনোযোগ প্রয়োজন", "Needs Attention")}</span>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2.5 flex-1">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
        </div>
      ) : nothingPending ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <p className={`text-sm font-semibold text-gray-900 ${locale === "bn" ? "font-bn" : ""}`}>
            {t("সব আপ-টু-ডেট!", "All caught up!")}
          </p>
          <p className={`text-xs text-gray-400 mt-1 ${locale === "bn" ? "font-bn" : ""}`}>
            {t("এই মুহূর্তে কোনো পেন্ডিং কাজ নেই", "Nothing pending right now")}
          </p>
        </div>
      ) : (
        <div className="space-y-2 flex-1">
          {items.filter((i) => i.count > 0).map(({ key, ...rest }) => (
            <AttentionRow key={key} {...rest} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}

const TONE: Record<string, { bg: string; fg: string; badgeBg: string }> = {
  amber:  { bg: "bg-amber-50",  fg: "text-amber-700",   badgeBg: "bg-amber-500" },
  blue:   { bg: "bg-blue-50",   fg: "text-blue-700",    badgeBg: "bg-blue-500" },
  rose:   { bg: "bg-rose-50",   fg: "text-rose-700",    badgeBg: "bg-rose-500" },
  violet: { bg: "bg-violet-50", fg: "text-violet-700",  badgeBg: "bg-violet-500" },
};

function AttentionRow({
  count, icon: Icon, tone, title, desc, action, locale,
}: {
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: keyof typeof TONE;
  title: string;
  desc: string;
  action: () => void;
  locale: string;
}) {
  const p = TONE[tone];
  return (
    <button
      onClick={action}
      className={`w-full flex items-center gap-3 p-3 rounded-xl ${p.bg} hover:brightness-95 transition-all text-left group`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-white shadow-sm relative shrink-0`}>
        <Icon className={`w-4.5 h-4.5 ${p.fg}`} />
        <span className={`absolute -top-1 -right-1 min-w-[20px] h-5 px-1 ${p.badgeBg} text-white text-[10px] font-bold rounded-full flex items-center justify-center tabular-nums`}>
          {count > 99 ? "99+" : count}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold text-gray-900 truncate ${locale === "bn" ? "font-bn" : ""}`}>{title}</p>
        <p className={`text-[11px] text-gray-500 truncate ${locale === "bn" ? "font-bn" : ""}`}>{desc}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />
    </button>
  );
}
