"use client";

import { RefreshCw, Calendar, Sparkles } from "lucide-react";
import { useLocaleStore } from "@/stores/locale-store";

export type DateRange = 7 | 30 | 90;

export function DashboardHero({
  userName,
  dateRange,
  onDateRangeChange,
  onRefresh,
  refreshing,
  lastUpdated,
}: {
  userName?: string;
  dateRange: DateRange;
  onDateRangeChange: (r: DateRange) => void;
  onRefresh: () => void;
  refreshing?: boolean;
  lastUpdated?: Date | null;
}) {
  const { locale, t } = useLocaleStore();

  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? t("শুভ সকাল", "Good morning")
      : hour < 17
      ? t("শুভ অপরাহ্ণ", "Good afternoon")
      : t("শুভ সন্ধ্যা", "Good evening");

  const today = new Date().toLocaleDateString(
    locale === "bn" ? "bn-BD" : "en-US",
    { weekday: "long", month: "long", day: "numeric", year: "numeric" }
  );

  const ranges: { value: DateRange; label: string }[] = [
    { value: 7, label: t("৭ দিন", "7d") },
    { value: 30, label: t("৩০ দিন", "30d") },
    { value: 90, label: t("৯০ দিন", "90d") },
  ];

  const lastUpdatedText = lastUpdated
    ? `${t("আপডেট হয়েছে", "Updated")} ${formatRelative(lastUpdated, locale)}`
    : t("লোড হচ্ছে...", "Loading...");

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#2d0f49] via-[#532d80] to-[#7c2df7] text-white p-6 md:p-8 mb-6 shadow-lg">
      {/* decorative blobs */}
      <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-[#ffce39]/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-10 w-72 h-72 rounded-full bg-[#a67cff]/30 blur-3xl pointer-events-none" />

      <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 text-[#ffce39] text-xs font-semibold uppercase tracking-widest mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t("সুপার অ্যাডমিন ড্যাশবোর্ড", "Super Admin Dashboard")}</span>
          </div>
          <h1 className={`text-2xl md:text-3xl font-bold leading-tight ${locale === "bn" ? "font-bn" : ""}`}>
            {greeting}{userName ? `, ${userName}` : ""} 👋
          </h1>
          <p className="text-white/70 text-sm mt-1.5 flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" />
            <span className={locale === "bn" ? "font-bn" : ""}>{today}</span>
            <span className="text-white/30">·</span>
            <span className="text-white/50">{lastUpdatedText}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center rounded-xl bg-white/10 backdrop-blur-sm p-1 border border-white/10">
            {ranges.map((r) => (
              <button
                key={r.value}
                onClick={() => onDateRangeChange(r.value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  dateRange === r.value
                    ? "bg-white text-[#532d80] shadow"
                    : "text-white/70 hover:text-white"
                } ${locale === "bn" ? "font-bn" : ""}`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 transition-colors disabled:opacity-50"
            title={t("রিফ্রেশ", "Refresh")}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span className={locale === "bn" ? "font-bn" : ""}>{t("রিফ্রেশ", "Refresh")}</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function formatRelative(d: Date, locale: string): string {
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (locale === "bn") {
    if (seconds < 5) return "এইমাত্র";
    if (seconds < 60) return `${seconds} সেকেন্ড আগে`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins} মিনিট আগে`;
    const hours = Math.floor(mins / 60);
    return `${hours} ঘন্টা আগে`;
  }
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}
