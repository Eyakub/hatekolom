"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, Loader2, ChevronDown, ChevronRight, User as UserIcon, MapPin, Globe } from "lucide-react";
import { useLocaleStore } from "@/stores/locale-store";
import { api } from "@/lib/api";
import { getFlagInfo, SEVERITY_STYLE } from "./flagLabels";

type RiskLevel = "high" | "medium" | "low" | "all";

type FraudOrder = {
  id: string;
  order_number: string;
  status: string;
  total: string;
  currency?: string;
  shipping_name?: string | null;
  shipping_phone?: string | null;
  shipping_city?: string | null;
  is_guest?: boolean;
  ip_address?: string | null;
  fraud_score: number;
  fraud_flags: string[];
  risk_level: "high" | "medium" | "low";
  created_at: string;
};

const STATUS_STYLE: Record<string, { bg: string; fg: string; bn: string; en: string }> = {
  pending:             { bg: "bg-amber-50",   fg: "text-amber-700",   bn: "পেন্ডিং",        en: "Pending" },
  confirmed:           { bg: "bg-blue-50",    fg: "text-blue-700",    bn: "কনফার্মড",       en: "Confirmed" },
  processing:          { bg: "bg-violet-50",  fg: "text-violet-700",  bn: "প্রসেসিং",       en: "Processing" },
  fulfilled:           { bg: "bg-emerald-50", fg: "text-emerald-700", bn: "ফুলফিল্ড",       en: "Fulfilled" },
  partially_fulfilled: { bg: "bg-indigo-50",  fg: "text-indigo-700",  bn: "আংশিক",           en: "Partial" },
  cancelled:           { bg: "bg-rose-50",    fg: "text-rose-700",    bn: "বাতিল",           en: "Cancelled" },
  refunded:            { bg: "bg-orange-50",  fg: "text-orange-700",  bn: "রিফান্ড",         en: "Refunded" },
};

export function HighRiskOrdersCard({
  days,
  accessToken,
}: {
  days: number;
  accessToken: string;
}) {
  const { locale, t } = useLocaleStore();
  const [risk, setRisk] = useState<RiskLevel>("high");
  const [orders, setOrders] = useState<FraudOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/admin/fraud-orders?days=${days}&risk=${risk}&limit=25`, accessToken)
      .then((data: any) => setOrders(Array.isArray(data) ? data : []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [days, risk, accessToken]);

  const riskTabs: { value: RiskLevel; label: string; color: string }[] = [
    { value: "high", label: t("উচ্চ রিস্ক", "High risk"), color: "bg-rose-600 text-white" },
    { value: "medium", label: t("মাঝারি রিস্ক", "Medium risk"), color: "bg-amber-500 text-white" },
    { value: "low", label: t("কম রিস্ক", "Low risk"), color: "bg-emerald-600 text-white" },
    { value: "all", label: t("সব", "All"), color: "bg-gray-800 text-white" },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#7c2df7]">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span className={locale === "bn" ? "font-bn" : ""}>{t("রিস্কি অর্ডার", "Risky Orders")}</span>
          </div>
          <h3 className={`text-base font-bold text-gray-900 mt-0.5 ${locale === "bn" ? "font-bn" : ""}`}>
            {t("ম্যানুয়ালি রিভিউ করুন", "Review manually")}
          </h3>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
          {riskTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setRisk(tab.value)}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all ${
                risk === tab.value ? tab.color : "text-gray-500 hover:text-gray-800"
              } ${locale === "bn" ? "font-bn" : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-10 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-[#7c2df7]" />
        </div>
      ) : orders.length === 0 ? (
        <div className="p-10 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 flex items-center justify-center mb-3">
            <ShieldAlert className="w-5 h-5 text-emerald-600" />
          </div>
          <p className={`text-sm font-semibold text-gray-700 ${locale === "bn" ? "font-bn" : ""}`}>
            {t("এই ফিল্টারে কোনো অর্ডার নেই", "No orders match this filter")}
          </p>
          <p className={`text-xs text-gray-400 mt-1 ${locale === "bn" ? "font-bn" : ""}`}>
            {t("এটি একটি ভালো সাইন", "That's a good sign")}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {orders.map((o) => {
            const isOpen = expanded === o.id;
            const status = STATUS_STYLE[o.status] || STATUS_STYLE.pending;
            return (
              <div key={o.id}>
                <button
                  onClick={() => setExpanded(isOpen ? null : o.id)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#faf8ff] text-left"
                >
                  <RiskScore level={o.risk_level} score={o.fraud_score} />
                  <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-5 gap-3 items-center">
                    <div className="min-w-0">
                      <p className="text-xs font-mono font-semibold text-gray-800 truncate">{o.order_number}</p>
                      <p className={`text-[10px] text-gray-400 ${locale === "bn" ? "font-bn" : ""}`}>
                        {timeAgo(o.created_at, locale)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold text-gray-900 truncate ${locale === "bn" ? "font-bn" : ""}`}>
                        {o.shipping_name || t("নামহীন", "Unnamed")}
                      </p>
                      <p className="text-[10px] text-gray-500 font-mono truncate">{o.shipping_phone || "—"}</p>
                    </div>
                    <div className={`min-w-0 hidden md:block text-xs text-gray-600 truncate ${locale === "bn" ? "font-bn" : ""}`}>
                      {o.shipping_city || "—"}
                    </div>
                    <div className="min-w-0 hidden md:flex items-center gap-1.5">
                      {o.fraud_flags.slice(0, 3).map((flag, i) => (
                        <FlagChip key={i} flag={flag} locale={locale} />
                      ))}
                      {o.fraud_flags.length > 3 && (
                        <span className="text-[10px] text-gray-400">+{o.fraud_flags.length - 3}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <span className={`hidden sm:inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full ${status.bg} ${status.fg} ${locale === "bn" ? "font-bn" : ""}`}>
                        {locale === "bn" ? status.bn : status.en}
                      </span>
                      <span className="text-sm font-bold tabular-nums text-gray-900">৳{formatAmount(o.total, locale)}</span>
                      {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-4 bg-[#faf8ff]/60 border-t border-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-3">
                      <DetailItem
                        icon={UserIcon}
                        label={t("কাস্টমার", "Customer")}
                        value={o.shipping_name || t("গেস্ট", "Guest")}
                        sub={[o.shipping_phone, o.is_guest ? t("গেস্ট চেকআউট", "Guest checkout") : null].filter(Boolean).join(" · ")}
                        locale={locale}
                      />
                      <DetailItem
                        icon={MapPin}
                        label={t("শহর", "City")}
                        value={o.shipping_city || "—"}
                        locale={locale}
                      />
                      <DetailItem
                        icon={Globe}
                        label="IP"
                        value={o.ip_address || "—"}
                        monoValue
                        locale={locale}
                      />
                    </div>

                    <div>
                      <p className={`text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2 ${locale === "bn" ? "font-bn" : ""}`}>
                        {t("সব ফ্ল্যাগ", "All flags")} ({o.fraud_flags.length})
                      </p>
                      {o.fraud_flags.length === 0 ? (
                        <p className="text-xs text-gray-400">—</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {o.fraud_flags.map((flag, i) => (
                            <FlagDetail key={i} flag={flag} locale={locale} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RiskScore({ level, score }: { level: "high" | "medium" | "low"; score: number }) {
  const style =
    level === "high" ? "bg-rose-100 text-rose-700 border-rose-200" :
    level === "medium" ? "bg-amber-100 text-amber-800 border-amber-200" :
    "bg-emerald-100 text-emerald-700 border-emerald-200";
  return (
    <div className={`shrink-0 w-11 h-11 rounded-lg border flex flex-col items-center justify-center ${style}`}>
      <span className="text-sm font-bold leading-none tabular-nums">{score}</span>
      <span className="text-[8px] uppercase tracking-wider opacity-70 mt-0.5">{level}</span>
    </div>
  );
}

function FlagChip({ flag, locale }: { flag: string; locale: string }) {
  const info = getFlagInfo(flag);
  const s = SEVERITY_STYLE[info.severity];
  return (
    <span
      title={info.description[locale === "bn" ? "bn" : "en"]}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold ${s.bg} ${s.fg} ${locale === "bn" ? "font-bn" : ""}`}
    >
      <span className={`w-1 h-1 rounded-full ${s.dot}`} />
      {info.label[locale === "bn" ? "bn" : "en"]}
    </span>
  );
}

function FlagDetail({ flag, locale }: { flag: string; locale: string }) {
  const info = getFlagInfo(flag);
  const s = SEVERITY_STYLE[info.severity];
  const suffix = flag.includes(":") ? flag.split(":").slice(1).join(":") : "";
  return (
    <div className={`${s.bg} rounded-lg px-3 py-2 max-w-xs`}>
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
        <span className={`text-xs font-bold ${s.fg} ${locale === "bn" ? "font-bn" : ""}`}>
          {info.label[locale === "bn" ? "bn" : "en"]}
        </span>
      </div>
      <p className={`text-[11px] text-gray-600 mt-1 ${locale === "bn" ? "font-bn" : ""}`}>
        {info.description[locale === "bn" ? "bn" : "en"]}
      </p>
      {suffix && <p className="text-[10px] text-gray-400 mt-1 font-mono">{suffix}</p>}
    </div>
  );
}

function DetailItem({
  icon: Icon,
  label,
  value,
  sub,
  monoValue,
  locale,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  monoValue?: boolean;
  locale: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-gray-400 mt-0.5" />
      <div className="min-w-0">
        <p className={`text-[10px] uppercase tracking-wider text-gray-400 font-semibold ${locale === "bn" ? "font-bn" : ""}`}>{label}</p>
        <p className={`text-xs font-semibold text-gray-900 truncate ${monoValue ? "font-mono" : ""} ${locale === "bn" ? "font-bn" : ""}`}>{value}</p>
        {sub && <p className={`text-[10px] text-gray-500 truncate ${locale === "bn" ? "font-bn" : ""}`}>{sub}</p>}
      </div>
    </div>
  );
}

function formatAmount(v: string | number, locale: string): string {
  const n = typeof v === "number" ? v : parseFloat(v || "0");
  return Math.round(n).toLocaleString(locale === "bn" ? "bn-BD" : "en-US");
}

function timeAgo(iso: string, locale: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  const bn = locale === "bn";
  if (seconds < 60) return bn ? "এইমাত্র" : "just now";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return bn ? `${mins} মিনিট আগে` : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return bn ? `${hours} ঘন্টা আগে` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return bn ? `${days} দিন আগে` : `${days}d ago`;
  return new Date(iso).toLocaleDateString(bn ? "bn-BD" : "en-US", { month: "short", day: "numeric" });
}
