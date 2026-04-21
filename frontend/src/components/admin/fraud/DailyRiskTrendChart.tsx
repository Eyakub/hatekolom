"use client";

import { useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { useLocaleStore } from "@/stores/locale-store";

type TrendPoint = {
  date: string;
  total: number;
  low_risk: number;
  medium_risk: number;
  high_risk: number;
};

const COLORS = { low: "#22c55e", medium: "#f59e0b", high: "#ef4444" };

export function DailyRiskTrendChart({
  data,
  days,
  loading,
}: {
  data: TrendPoint[];
  days: number;
  loading: boolean;
}) {
  const { locale, t } = useLocaleStore();
  const [hover, setHover] = useState<{ index: number; point: TrendPoint } | null>(null);

  const series = useMemo(() => fillMissingDays(data, days), [data, days]);
  const maxTotal = Math.max(1, ...series.map((s) => s.total));
  const hasAnyData = series.some((s) => s.total > 0);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#7c2df7]">
            <Activity className="w-3.5 h-3.5" />
            <span className={locale === "bn" ? "font-bn" : ""}>{t("দৈনিক রিস্ক ট্রেন্ড", "Daily Risk Trend")}</span>
          </div>
          <h3 className={`text-base font-bold text-gray-900 mt-0.5 ${locale === "bn" ? "font-bn" : ""}`}>
            {t(`গত ${days} দিন`, `Last ${days} days`)}
          </h3>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <Legend color={COLORS.low} label={t("কম", "Low")} locale={locale} />
          <Legend color={COLORS.medium} label={t("মাঝারি", "Medium")} locale={locale} />
          <Legend color={COLORS.high} label={t("উচ্চ", "High")} locale={locale} />
        </div>
      </div>

      {loading ? (
        <div className="skeleton h-48 rounded-lg" />
      ) : !hasAnyData ? (
        <div className="h-48 flex items-center justify-center text-sm text-gray-400">
          <span className={locale === "bn" ? "font-bn" : ""}>
            {t("এই সময়ের মধ্যে কোনো অর্ডার নেই", "No orders in this window")}
          </span>
        </div>
      ) : (
        <Chart series={series} maxTotal={maxTotal} hover={hover} setHover={setHover} locale={locale} t={t} />
      )}
    </div>
  );
}

function Chart({
  series, maxTotal, hover, setHover, locale, t,
}: {
  series: TrendPoint[];
  maxTotal: number;
  hover: { index: number; point: TrendPoint } | null;
  setHover: (v: { index: number; point: TrendPoint } | null) => void;
  locale: string;
  t: (bn: string, en: string) => string;
}) {
  const W = 800, H = 240;
  const padL = 34, padR = 12, padT = 12, padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = series.length;
  const gap = Math.min(4, innerW / n / 4);
  const barW = Math.max(2, innerW / n - gap);

  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((maxTotal * i) / yTicks));

  // Pick ~5 evenly-spaced labels, and only force-show the final one when it's
  // far enough from the previous labeled position to avoid overlap.
  const labelEvery = Math.max(1, Math.ceil(n / 5));
  const lastLabeled = Math.floor((n - 1) / labelEvery) * labelEvery;
  const shouldLabel = (i: number) =>
    i % labelEvery === 0 ||
    (i === n - 1 && (n - 1) - lastLabeled >= Math.ceil(labelEvery / 2));

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" onMouseLeave={() => setHover(null)}>
        {/* gridlines + y-axis labels */}
        {ticks.map((v, i) => {
          const y = padT + innerH - (v / maxTotal) * innerH;
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={padL + innerW} y2={y} stroke="#f1f1f1" strokeWidth={1} />
              <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#9ca3af">
                {v}
              </text>
            </g>
          );
        })}

        {/* stacked bars */}
        {series.map((p, i) => {
          const x = padL + i * (innerW / n) + gap / 2;
          const lowH = (p.low_risk / maxTotal) * innerH;
          const medH = (p.medium_risk / maxTotal) * innerH;
          const highH = (p.high_risk / maxTotal) * innerH;
          const baseY = padT + innerH;
          const isHover = hover?.index === i;
          return (
            <g
              key={p.date}
              onMouseEnter={() => setHover({ index: i, point: p })}
              className="cursor-pointer"
              style={{ opacity: hover && !isHover ? 0.5 : 1 }}
            >
              {/* invisible hit area covering the full column */}
              <rect x={x - gap / 2} y={padT} width={barW + gap} height={innerH} fill="transparent" />
              {p.low_risk > 0 && (
                <rect x={x} y={baseY - lowH} width={barW} height={lowH} fill={COLORS.low} rx={1} />
              )}
              {p.medium_risk > 0 && (
                <rect x={x} y={baseY - lowH - medH} width={barW} height={medH} fill={COLORS.medium} rx={1} />
              )}
              {p.high_risk > 0 && (
                <rect x={x} y={baseY - lowH - medH - highH} width={barW} height={highH} fill={COLORS.high} rx={1} />
              )}
            </g>
          );
        })}

        {/* x-axis labels */}
        {series.map((p, i) =>
          shouldLabel(i) ? (
            <text
              key={p.date}
              x={padL + i * (innerW / n) + barW / 2 + gap / 2}
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
          className="absolute pointer-events-none bg-[#1a1025] text-white rounded-lg px-3 py-2 text-xs shadow-xl min-w-[140px]"
          style={{
            left: `${(((padL + hover.index * (innerW / n) + barW / 2 + gap / 2) / W) * 100).toFixed(2)}%`,
            top: "12px",
            transform: "translate(-50%, 0)",
          }}
        >
          <div className={`font-semibold mb-1 ${locale === "bn" ? "font-bn" : ""}`}>
            {formatShortDate(hover.point.date, locale, true)}
          </div>
          <Row color={COLORS.high} label={t("উচ্চ", "High")} value={hover.point.high_risk} locale={locale} />
          <Row color={COLORS.medium} label={t("মাঝারি", "Medium")} value={hover.point.medium_risk} locale={locale} />
          <Row color={COLORS.low} label={t("কম", "Low")} value={hover.point.low_risk} locale={locale} />
          <div className="border-t border-white/15 mt-1 pt-1 flex justify-between text-white/70">
            <span className={locale === "bn" ? "font-bn" : ""}>{t("মোট", "Total")}</span>
            <span className="font-bold tabular-nums">{hover.point.total}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Legend({ color, label, locale }: { color: string; label: string; locale: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-gray-500">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
      <span className={locale === "bn" ? "font-bn" : ""}>{label}</span>
    </span>
  );
}

function Row({ color, label, value, locale }: { color: string; label: string; value: number; locale: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-sm" style={{ background: color }} />
        <span className={locale === "bn" ? "font-bn" : ""}>{label}</span>
      </span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function fillMissingDays(data: TrendPoint[], days: number): TrendPoint[] {
  const map = new Map(data.map((p) => [p.date, p]));
  const out: TrendPoint[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push(map.get(key) || { date: key, total: 0, low_risk: 0, medium_risk: 0, high_risk: 0 });
  }
  return out;
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
