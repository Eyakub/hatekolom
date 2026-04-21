"use client";

import { Clock, ArrowRight, ShoppingBag, ShieldAlert, User as UserIcon } from "lucide-react";
import { useLocaleStore } from "@/stores/locale-store";

type Order = {
  id?: string;
  order_number?: string;
  status?: string;
  total?: string | number;
  currency?: string;
  shipping_name?: string | null;
  shipping_phone?: string | null;
  created_at?: string;
  fraud_score?: number | null;
  is_guest?: boolean;
  items?: { product_title?: string | null; quantity?: number }[];
};

const STATUS_STYLE: Record<string, { bg: string; fg: string; bn: string; en: string }> = {
  pending:             { bg: "bg-amber-50",   fg: "text-amber-700",   bn: "পেন্ডিং",        en: "Pending" },
  confirmed:           { bg: "bg-blue-50",    fg: "text-blue-700",    bn: "কনফার্মড",       en: "Confirmed" },
  processing:          { bg: "bg-violet-50",  fg: "text-violet-700",  bn: "প্রসেসিং",       en: "Processing" },
  fulfilled:           { bg: "bg-emerald-50", fg: "text-emerald-700", bn: "ফুলফিল্ড",       en: "Fulfilled" },
  partially_fulfilled: { bg: "bg-indigo-50",  fg: "text-indigo-700",  bn: "আংশিক ফুলফিল্ড", en: "Partial" },
  cancelled:           { bg: "bg-rose-50",    fg: "text-rose-700",    bn: "বাতিল",           en: "Cancelled" },
  refunded:            { bg: "bg-orange-50",  fg: "text-orange-700",  bn: "রিফান্ড",         en: "Refunded" },
};

export function RecentOrdersCard({
  orders,
  loading,
  onNavigate,
}: {
  orders: Order[];
  loading: boolean;
  onNavigate: (tab: string) => void;
}) {
  const { locale, t } = useLocaleStore();
  const items = (orders || []).slice(0, 7);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#7c2df7]">
            <Clock className="w-3.5 h-3.5" />
            <span className={locale === "bn" ? "font-bn" : ""}>{t("সাম্প্রতিক অর্ডার", "Recent Orders")}</span>
          </div>
          <h3 className={`text-lg font-bold text-gray-900 mt-0.5 ${locale === "bn" ? "font-bn" : ""}`}>
            {t("সর্বশেষ ৭টি", "Latest 7")}
          </h3>
        </div>
        <button
          onClick={() => onNavigate("orders")}
          className="text-[11px] font-semibold text-[#7c2df7] hover:text-[#532d80] inline-flex items-center gap-1"
        >
          <span className={locale === "bn" ? "font-bn" : ""}>{t("সব অর্ডার", "All orders")}</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {loading ? (
        <div className="p-5 space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="py-10 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-[#f5f0ff] flex items-center justify-center mb-3">
            <ShoppingBag className="w-5 h-5 text-[#7c2df7]" />
          </div>
          <p className={`text-sm font-semibold text-gray-700 ${locale === "bn" ? "font-bn" : ""}`}>
            {t("এখনো কোনো অর্ডার নেই", "No orders yet")}
          </p>
          <p className={`text-xs text-gray-400 mt-1 ${locale === "bn" ? "font-bn" : ""}`}>
            {t("অর্ডার আসলে এখানে দেখাবে", "New orders will appear here")}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className={`text-left text-[10px] uppercase tracking-wider text-gray-400 font-semibold ${locale === "bn" ? "font-bn" : ""}`}>
                  <th className="px-5 py-2.5">{t("অর্ডার", "Order")}</th>
                  <th className="px-3 py-2.5">{t("কাস্টমার", "Customer")}</th>
                  <th className="px-3 py-2.5">{t("আইটেম", "Items")}</th>
                  <th className="px-3 py-2.5">{t("স্ট্যাটাস", "Status")}</th>
                  <th className="px-3 py-2.5 text-right">{t("টাকা", "Total")}</th>
                  <th className="px-5 py-2.5 text-right">{t("সময়", "Time")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((o) => {
                  const style = STATUS_STYLE[o.status || "pending"] || STATUS_STYLE.pending;
                  const itemsSummary = summarizeItems(o.items, locale, t);
                  const customer = o.shipping_name || o.shipping_phone || t("গেস্ট", "Guest");
                  const riskLevel = riskFor(o.fraud_score);
                  return (
                    <tr key={o.id || o.order_number} className="hover:bg-[#faf8ff] cursor-pointer group" onClick={() => onNavigate("orders")}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-semibold text-gray-800 truncate max-w-[120px]">
                            {o.order_number || shortId(o.id)}
                          </span>
                          {riskLevel === "high" && <span title="High risk" className="text-rose-600"><ShieldAlert className="w-3.5 h-3.5" /></span>}
                          {o.is_guest && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-gray-100 text-gray-500">
                              {t("গেস্ট", "GUEST")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#f5f0ff] flex items-center justify-center shrink-0">
                            <UserIcon className="w-3.5 h-3.5 text-[#7c2df7]" />
                          </div>
                          <div className="min-w-0">
                            <p className={`text-xs font-semibold text-gray-900 truncate max-w-[140px] ${locale === "bn" ? "font-bn" : ""}`}>{customer}</p>
                            {o.shipping_phone && o.shipping_name && (
                              <p className="text-[10px] text-gray-400 truncate">{o.shipping_phone}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className={`px-3 py-3 text-xs text-gray-600 max-w-[180px] truncate ${locale === "bn" ? "font-bn" : ""}`}>
                        {itemsSummary}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full ${style.bg} ${style.fg} ${locale === "bn" ? "font-bn" : ""}`}>
                          {locale === "bn" ? style.bn : style.en}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-sm font-bold text-gray-900 tabular-nums">
                        ৳{formatAmount(o.total, locale)}
                      </td>
                      <td className={`px-5 py-3 text-right text-xs text-gray-500 ${locale === "bn" ? "font-bn" : ""}`}>
                        {timeAgo(o.created_at, locale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked cards */}
          <div className="md:hidden divide-y divide-gray-50">
            {items.map((o) => {
              const style = STATUS_STYLE[o.status || "pending"] || STATUS_STYLE.pending;
              const customer = o.shipping_name || o.shipping_phone || t("গেস্ট", "Guest");
              return (
                <button
                  key={o.id || o.order_number}
                  onClick={() => onNavigate("orders")}
                  className="w-full text-left px-5 py-3 hover:bg-[#faf8ff]"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono font-semibold text-gray-800 truncate">{o.order_number || shortId(o.id)}</span>
                    <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full ${style.bg} ${style.fg} ${locale === "bn" ? "font-bn" : ""}`}>
                      {locale === "bn" ? style.bn : style.en}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className={`text-gray-700 truncate max-w-[55%] ${locale === "bn" ? "font-bn" : ""}`}>{customer}</span>
                    <span className="font-bold text-gray-900 tabular-nums">৳{formatAmount(o.total, locale)}</span>
                  </div>
                  <p className={`text-[10px] text-gray-400 mt-0.5 ${locale === "bn" ? "font-bn" : ""}`}>{timeAgo(o.created_at, locale)}</p>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function summarizeItems(
  items: { product_title?: string | null; quantity?: number }[] | undefined,
  locale: string,
  t: (bn: string, en: string) => string
): string {
  if (!items || items.length === 0) return "—";
  const first = items[0]?.product_title || t("আইটেম", "Item");
  if (items.length === 1) return first;
  const more = items.length - 1;
  return locale === "bn"
    ? `${first} + আরও ${more}টি`
    : `${first} + ${more} more`;
}

function riskFor(score?: number | null): "low" | "medium" | "high" | null {
  if (score == null) return null;
  if (score >= 60) return "high";
  if (score >= 30) return "medium";
  return "low";
}

function shortId(id?: string): string {
  if (!id) return "—";
  return id.slice(0, 8);
}

function formatAmount(v: string | number | undefined, locale: string): string {
  const n = typeof v === "number" ? v : parseFloat(v || "0");
  return Math.round(n).toLocaleString(locale === "bn" ? "bn-BD" : "en-US");
}

function timeAgo(iso: string | undefined, locale: string): string {
  if (!iso) return "";
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
