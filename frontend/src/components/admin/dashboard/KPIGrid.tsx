"use client";

import { useMemo } from "react";
import {
  Users, ShoppingBag, Wallet, GraduationCap, UserPlus,
  ArrowUp, ArrowDown, Minus,
} from "lucide-react";
import { useLocaleStore } from "@/stores/locale-store";
import { Sparkline } from "./Sparkline";
import { fillMissingDays, type RevenuePoint } from "./utils";

type Stats = {
  total_users?: number;
  total_courses?: number;
  total_orders?: number;
  total_revenue?: string;
  active_enrollments?: number;
  new_users_today?: number;
  orders_today?: number;
  revenue_today?: string;
};

export function KPIGrid({
  stats,
  revenueSeries,
  loading,
  onNavigate,
}: {
  stats: Stats | null;
  revenueSeries: RevenuePoint[];
  loading: boolean;
  onNavigate: (tab: string) => void;
}) {
  const { locale, t } = useLocaleStore();

  // Gap-fill the revenue series so every calendar day is represented.
  // The backend only returns days that had payments, which makes raw
  // sparklines and "vs yesterday" comparisons misleading.
  const filledSeries = useMemo(() => fillMissingDays(revenueSeries, 30), [revenueSeries]);
  const filledValues = filledSeries.map((p) => parseFloat(p.amount || "0"));

  const todayRevenue = parseFloat(stats?.revenue_today || "0");
  const totalRevenue = parseFloat(stats?.total_revenue || "0");

  // True yesterday = second-to-last entry of the gap-filled series.
  const yesterdayRevenue = filledValues.length >= 2
    ? filledValues[filledValues.length - 2]
    : 0;

  const todayTrend = buildTodayTrend(todayRevenue, yesterdayRevenue, t);

  const cards = [
    {
      key: "revenue",
      label: t("মোট রেভেনিউ", "Total Revenue"),
      value: formatCurrency(totalRevenue, locale),
      delta: todayRevenue > 0 ? `+${formatCurrency(todayRevenue, locale)} ${t("আজ", "today")}` : t("আজ কোনো আয় নেই", "No revenue today"),
      deltaTone: todayRevenue > 0 ? "up" : "flat",
      icon: Wallet,
      tone: "purple" as const,
      sparkData: filledValues,
      tab: "orders",
    },
    {
      key: "revenue_today",
      label: t("আজকের রেভেনিউ", "Today's Revenue"),
      value: formatCurrency(todayRevenue, locale),
      delta: todayTrend.label,
      deltaTone: todayTrend.tone,
      icon: Wallet,
      tone: "amber" as const,
      sparkData: filledValues.slice(-7),
      tab: "orders",
    },
    {
      key: "orders",
      label: t("মোট অর্ডার", "Total Orders"),
      value: formatNumber(stats?.total_orders || 0, locale),
      delta: `+${formatNumber(stats?.orders_today || 0, locale)} ${t("আজ", "today")}`,
      deltaTone: (stats?.orders_today || 0) > 0 ? "up" : "flat",
      icon: ShoppingBag,
      tone: "emerald" as const,
      sparkData: null,
      tab: "orders",
    },
    {
      key: "users",
      label: t("মোট ইউজার", "Total Users"),
      value: formatNumber(stats?.total_users || 0, locale),
      delta: `+${formatNumber(stats?.new_users_today || 0, locale)} ${t("আজ", "today")}`,
      deltaTone: (stats?.new_users_today || 0) > 0 ? "up" : "flat",
      icon: Users,
      tone: "blue" as const,
      sparkData: null,
      tab: "users",
    },
    {
      key: "enrollments",
      label: t("সক্রিয় এনরোলমেন্ট", "Active Enrollments"),
      value: formatNumber(stats?.active_enrollments || 0, locale),
      delta: `${formatNumber(stats?.total_courses || 0, locale)} ${t("কোর্স", "courses")}`,
      deltaTone: "flat",
      icon: GraduationCap,
      tone: "violet" as const,
      sparkData: null,
      tab: "courses",
    },
    {
      key: "new_users",
      label: t("আজকের নতুন ইউজার", "New Users Today"),
      value: formatNumber(stats?.new_users_today || 0, locale),
      delta: `${formatNumber(stats?.total_users || 0, locale)} ${t("মোট", "total")}`,
      deltaTone: (stats?.new_users_today || 0) > 0 ? "up" : "flat",
      icon: UserPlus,
      tone: "rose" as const,
      sparkData: null,
      tab: "users",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      {cards.map((c) => (
        <KPICard
          key={c.key}
          label={c.label}
          value={c.value}
          delta={c.delta}
          deltaTone={c.deltaTone as any}
          icon={c.icon}
          tone={c.tone}
          sparkData={c.sparkData}
          loading={loading}
          locale={locale}
          onClick={() => onNavigate(c.tab)}
        />
      ))}
    </div>
  );
}

const TONES: Record<string, { bg: string; fg: string; spark: string }> = {
  purple:  { bg: "bg-[#f5f0ff]", fg: "text-[#6b1ee3]",  spark: "#7c2df7" },
  amber:   { bg: "bg-[#fff8e1]", fg: "text-[#b77800]",  spark: "#e5a100" },
  emerald: { bg: "bg-[#e7fbf2]", fg: "text-[#15803d]",  spark: "#22c55e" },
  blue:    { bg: "bg-[#e6f0ff]", fg: "text-[#1e40af]",  spark: "#3b82f6" },
  violet:  { bg: "bg-[#f2e9ff]", fg: "text-[#6d28d9]",  spark: "#8b5cf6" },
  rose:    { bg: "bg-[#ffe8ef]", fg: "text-[#be185d]",  spark: "#ec4899" },
};

function KPICard({
  label, value, delta, deltaTone, icon: Icon, tone, sparkData, loading, locale, onClick,
}: {
  label: string;
  value: string;
  delta: string;
  deltaTone: "up" | "down" | "flat";
  icon: React.ComponentType<{ className?: string }>;
  tone: keyof typeof TONES;
  sparkData: number[] | null;
  loading: boolean;
  locale: string;
  onClick: () => void;
}) {
  const palette = TONES[tone];

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="skeleton h-9 w-9 rounded-lg mb-3" />
        <div className="skeleton h-3 w-24 mb-2" />
        <div className="skeleton h-7 w-20 mb-2" />
        <div className="skeleton h-3 w-16" />
      </div>
    );
  }

  const DeltaIcon = deltaTone === "up" ? ArrowUp : deltaTone === "down" ? ArrowDown : Minus;
  const deltaClasses =
    deltaTone === "up" ? "text-emerald-600" :
    deltaTone === "down" ? "text-rose-600" : "text-gray-400";

  return (
    <button
      onClick={onClick}
      className="group text-left bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md hover:border-[#7c2df7]/30 hover:-translate-y-0.5 transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${palette.bg}`}>
          <Icon className={`w-4 h-4 ${palette.fg}`} />
        </div>
        {sparkData && sparkData.length >= 2 && (
          <Sparkline values={sparkData} stroke={palette.spark} fill={palette.spark} width={72} height={28} />
        )}
      </div>
      <p className={`text-[11px] text-gray-500 font-medium ${locale === "bn" ? "font-bn" : ""}`}>{label}</p>
      <p className="text-xl md:text-[22px] font-bold text-gray-900 mt-0.5 leading-tight tabular-nums">{value}</p>
      <div className={`flex items-center gap-1 mt-1.5 text-[11px] ${deltaClasses} ${locale === "bn" ? "font-bn" : ""}`}>
        <DeltaIcon className="w-3 h-3" />
        <span className="truncate">{delta}</span>
      </div>
    </button>
  );
}

function formatCurrency(n: number, locale: string): string {
  const rounded = Math.round(n);
  const formatted = rounded.toLocaleString(locale === "bn" ? "bn-BD" : "en-US");
  return `৳${formatted}`;
}

function formatNumber(n: number, locale: string): string {
  return n.toLocaleString(locale === "bn" ? "bn-BD" : "en-US");
}

function buildTodayTrend(
  today: number,
  yesterday: number,
  t: (bn: string, en: string) => string
): { label: string; tone: "up" | "down" | "flat" } {
  if (today === 0 && yesterday === 0) {
    return { label: t("কোনো কার্যকলাপ নেই", "no activity"), tone: "flat" };
  }
  if (yesterday === 0) {
    return { label: t("নতুন শুরু", "new momentum"), tone: "up" };
  }
  if (today === 0) {
    return { label: t("গতকালের তুলনায় কম", "down vs yesterday"), tone: "down" };
  }
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  const arrow = pct >= 0 ? "+" : "";
  return {
    label: `${arrow}${pct}% ${t("গতকালের তুলনায়", "vs yesterday")}`,
    tone: pct >= 0 ? "up" : "down",
  };
}
