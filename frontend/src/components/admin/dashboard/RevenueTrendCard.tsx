"use client";

import { useMemo, useState } from "react";
import { TrendingUp, Wallet } from "lucide-react";
import { useLocaleStore } from "@/stores/locale-store";
import { fillMissingDays, type RevenuePoint } from "./utils";

export function RevenueTrendCard({
  data,
  days,
  loading,
}: {
  data: RevenuePoint[];
  days: number;
  loading: boolean;
}) {
  const { locale, t } = useLocaleStore();
  const [hover, setHover] = useState<{ x: number; y: number; p: RevenuePoint } | null>(null);

  const series = useMemo(() => fillMissingDays(data, days), [data, days]);
  const values = series.map((p) => parseFloat(p.amount || "0"));
  const total = values.reduce((a, b) => a + b, 0);
  const avg = values.length ? total / values.length : 0;
  const peak = values.length ? Math.max(...values) : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm lg:col-span-2">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#7c2df7]">
            <TrendingUp className="w-3.5 h-3.5" />
            <span className={locale === "bn" ? "font-bn" : ""}>{t("রেভেনিউ ট্রেন্ড", "Revenue Trend")}</span>
          </div>
          <h3 className={`text-lg font-bold text-gray-900 mt-1 ${locale === "bn" ? "font-bn" : ""}`}>
            {t(`গত ${days} দিন`, `Last ${days} Days`)}
          </h3>
        </div>
        <div className="grid grid-cols-3 gap-5 text-right">
          <Stat label={t("মোট", "Total")} value={formatCurrency(total, locale)} tone="purple" locale={locale} />
          <Stat label={t("দৈনিক গড়", "Daily Avg")} value={formatCurrency(avg, locale)} tone="gray" locale={locale} />
          <Stat label={t("সর্বোচ্চ", "Peak")} value={formatCurrency(peak, locale)} tone="amber" locale={locale} />
        </div>
      </div>

      {loading ? (
        <div className="skeleton h-48 w-full rounded-xl" />
      ) : values.length === 0 || peak === 0 ? (
        <EmptyChart locale={locale} t={t} />
      ) : (
        <RevenueChart
          series={series}
          values={values}
          peak={peak}
          locale={locale}
          hover={hover}
          setHover={setHover}
        />
      )}
    </div>
  );
}

function RevenueChart({
  series, values, peak, locale, hover, setHover,
}: {
  series: RevenuePoint[];
  values: number[];
  peak: number;
  locale: string;
  hover: { x: number; y: number; p: RevenuePoint } | null;
  setHover: (v: { x: number; y: number; p: RevenuePoint } | null) => void;
}) {
  const W = 800;
  const H = 220;
  const padL = 44, padR = 12, padT = 12, padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const step = values.length > 1 ? innerW / (values.length - 1) : innerW;

  const yTicks = 4;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) => (peak * i) / yTicks);

  const points = values.map((v, i) => {
    const x = padL + i * step;
    const y = padT + innerH - (v / peak) * innerH;
    return [x, y] as const;
  });

  const linePath = points.map(([x, y], i) => (i === 0 ? `M ${x},${y}` : `L ${x},${y}`)).join(" ");
  const areaPath = `${linePath} L ${padL + innerW},${padT + innerH} L ${padL},${padT + innerH} Z`;

  // Sparse x-axis labels (4–6 spread points)
  const labelEvery = Math.max(1, Math.floor(series.length / 6));

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <defs>
          <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c2df7" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#7c2df7" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* grid */}
        {tickValues.map((v, i) => {
          const y = padT + innerH - (v / peak) * innerH;
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={padL + innerW} y2={y} stroke="#f1ecff" strokeWidth={1} />
              <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#9ca3af">
                {compactCurrency(v, locale)}
              </text>
            </g>
          );
        })}

        {/* area + line */}
        <path d={areaPath} fill="url(#rev-grad)" />
        <path d={linePath} fill="none" stroke="#7c2df7" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

        {/* data points */}
        {points.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={hover?.p.date === series[i].date ? 5 : 3}
            fill="#fff"
            stroke="#7c2df7"
            strokeWidth={2}
            onMouseEnter={() => setHover({ x, y, p: series[i] })}
            onMouseLeave={() => setHover(null)}
            className="cursor-pointer transition-all"
          />
        ))}

        {/* x-axis labels */}
        {series.map((p, i) =>
          i % labelEvery === 0 || i === series.length - 1 ? (
            <text
              key={p.date}
              x={padL + i * step}
              y={H - 8}
              textAnchor="middle"
              fontSize="10"
              fill="#9ca3af"
            >
              {formatShortDate(p.date, locale)}
            </text>
          ) : null
        )}
      </svg>

      {hover && (
        <div
          className="absolute pointer-events-none bg-[#1a1025] text-white rounded-lg px-3 py-2 text-xs shadow-xl"
          style={{
            left: `${(hover.x / W) * 100}%`,
            top: `${(hover.y / H) * 100}%`,
            transform: "translate(-50%, calc(-100% - 12px))",
          }}
        >
          <div className="font-semibold">{formatCurrency(parseFloat(hover.p.amount || "0"), locale)}</div>
          <div className="text-white/60 text-[10px]">{formatShortDate(hover.p.date, locale, true)}</div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone, locale }: { label: string; value: string; tone: "purple" | "amber" | "gray"; locale: string }) {
  const color = tone === "purple" ? "text-[#6b1ee3]" : tone === "amber" ? "text-[#b77800]" : "text-gray-700";
  return (
    <div>
      <p className={`text-[10px] uppercase tracking-wider text-gray-400 font-semibold ${locale === "bn" ? "font-bn" : ""}`}>{label}</p>
      <p className={`text-sm font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function EmptyChart({ locale, t }: { locale: string; t: (bn: string, en: string) => string }) {
  return (
    <div className="h-48 flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 rounded-full bg-[#f5f0ff] flex items-center justify-center mb-3">
        <Wallet className="w-5 h-5 text-[#7c2df7]" />
      </div>
      <p className={`text-sm font-semibold text-gray-700 ${locale === "bn" ? "font-bn" : ""}`}>
        {t("কোনো রেভেনিউ ডেটা নেই", "No revenue yet")}
      </p>
      <p className={`text-xs text-gray-400 mt-1 ${locale === "bn" ? "font-bn" : ""}`}>
        {t("অর্ডার কনফার্ম হলে এখানে চার্ট দেখাবে", "Once orders are confirmed, the trend will appear here")}
      </p>
    </div>
  );
}

function formatCurrency(n: number, locale: string): string {
  return `৳${Math.round(n).toLocaleString(locale === "bn" ? "bn-BD" : "en-US")}`;
}

function compactCurrency(n: number, locale: string): string {
  if (n >= 1_00_000) return `৳${(n / 1_00_000).toFixed(n >= 10_00_000 ? 0 : 1)}L`;
  if (n >= 1_000) return `৳${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return `৳${Math.round(n)}`;
}

function formatShortDate(date: string, locale: string, withYear = false): string {
  try {
    const d = new Date(date);
    return d.toLocaleDateString(locale === "bn" ? "bn-BD" : "en-US", {
      month: "short",
      day: "numeric",
      ...(withYear ? { year: "numeric" } : {}),
    });
  } catch {
    return date;
  }
}
