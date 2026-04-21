"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search, Download, ShoppingBag, Clock, Wallet, ShieldAlert, CreditCard,
  TrendingUp, Eye, Check, X as XIcon, Loader2, Phone, MapPin, Package, Truck,
  Filter, Calendar,
} from "lucide-react";
import { useLocaleStore } from "@/stores/locale-store";
import { api } from "@/lib/api";
import { toast } from "@/stores/toast-store";
import { ConfirmModal } from "../ConfirmModal";

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  total: string | number;
  currency?: string;
  shipping_name?: string | null;
  shipping_phone?: string | null;
  shipping_address?: string | null;
  shipping_area?: string | null;
  shipping_city?: string | null;
  created_at: string;
  is_guest?: boolean;
  fraud_score?: number | null;
  user?: { id?: string; full_name?: string | null; phone?: string | null };
  payment?: { status?: string; method?: string } | null;
  shipment?: { status?: string } | null;
  items?: { product_title?: string; quantity?: number }[];
};

type OpsStats = {
  orders_today: number;
  revenue_today: string;
  pending_count: number;
  unpaid_cod_count: number;
  high_risk_count: number;
  avg_order_value: number;
  fulfillment_rate: number;
};

type StatusCounts = Record<string, number | undefined> & { total?: number };

type StatusValue = "" | "pending" | "confirmed" | "processing" | "fulfilled" | "cancelled" | "refunded";
type TimeRange = "" | "1" | "7" | "30";
type PaymentFilter = "" | "cod" | "bkash" | "nagad" | "free" | "paid_only" | "unpaid_only";
type RiskFilter = "" | "low" | "medium" | "high";

export function OrdersPanel({
  accessToken,
  statusFilter,
  setStatusFilter,
  timeRange,
  setTimeRange,
  orderCounts,
  refreshKey,
  onIncrementRefresh,
  onView,
}: {
  accessToken: string;
  statusFilter: StatusValue;
  setStatusFilter: (s: StatusValue) => void;
  timeRange: TimeRange;
  setTimeRange: (t: TimeRange) => void;
  orderCounts: StatusCounts;
  refreshKey: number;
  onIncrementRefresh: () => void;
  onView: (o: OrderRow) => void;
}) {
  const { locale, t } = useLocaleStore();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [stats, setStats] = useState<OpsStats | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("");

  const [acting, setActing] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    order: OrderRow;
    action: "confirm" | "cancel" | "fulfill" | "mark_paid";
  } | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (timeRange) params.set("days", timeRange);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const data: any = await api.get(`/orders/${qs}`, accessToken);
      setOrders(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err?.message || t("অর্ডার লোড ব্যর্থ", "Failed to load orders"));
    } finally {
      setLoading(false);
    }
  }, [accessToken, statusFilter, timeRange, t]);

  const loadStats = useCallback(async () => {
    try {
      const data: any = await api.get("/admin/orders/ops-stats", accessToken);
      setStats(data || null);
    } catch {
      // silent
    }
  }, [accessToken]);

  useEffect(() => { loadOrders(); }, [loadOrders, refreshKey]);
  useEffect(() => { loadStats(); }, [loadStats, refreshKey]);

  // Client-side filters: search + payment + risk
  const filteredOrders = useMemo(() => {
    let out = orders;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      out = out.filter((o) =>
        (o.order_number || "").toLowerCase().includes(q) ||
        (o.shipping_name || "").toLowerCase().includes(q) ||
        (o.shipping_phone || "").includes(q) ||
        (o.user?.full_name || "").toLowerCase().includes(q) ||
        (o.user?.phone || "").includes(q)
      );
    }
    if (paymentFilter) {
      if (paymentFilter === "paid_only") {
        out = out.filter((o) => o.payment?.status === "success");
      } else if (paymentFilter === "unpaid_only") {
        out = out.filter((o) => o.payment?.status !== "success");
      } else {
        out = out.filter((o) => o.payment?.method === paymentFilter);
      }
    }
    if (riskFilter) {
      out = out.filter((o) => {
        const s = o.fraud_score;
        if (s == null) return false;
        if (riskFilter === "high") return s >= 60;
        if (riskFilter === "medium") return s >= 30 && s < 60;
        return s < 30;
      });
    }
    return out;
  }, [orders, debouncedSearch, paymentFilter, riskFilter]);

  const requestConfirm = (o: OrderRow) => setPending({ order: o, action: "confirm" });
  const requestCancel = (o: OrderRow) => setPending({ order: o, action: "cancel" });
  const requestFulfill = (o: OrderRow) => setPending({ order: o, action: "fulfill" });
  const requestMarkPaid = (o: OrderRow) => setPending({ order: o, action: "mark_paid" });

  const executePending = async () => {
    if (!pending) return;
    const { order: o, action } = pending;
    setActing(o.id);
    try {
      if (action === "mark_paid") {
        await api.patch(`/admin/orders/${o.id}/confirm-payment`, {}, accessToken);
        toast.success(t("পেমেন্ট কনফার্মড", "Payment confirmed"));
      } else {
        const newStatus = action === "confirm" ? "confirmed" : action === "cancel" ? "cancelled" : "fulfilled";
        await api.patch(`/admin/orders/${o.id}/status`, { status: newStatus }, accessToken);
        toast.success(
          action === "confirm" ? t("অর্ডার কনফার্মড", "Order confirmed") :
          action === "cancel"  ? t("অর্ডার বাতিল", "Order cancelled") :
                                 t("ফুলফিল্ড", "Fulfilled")
        );
      }
      setPending(null);
      onIncrementRefresh();
    } catch (err: any) {
      toast.error(err?.message || t("অপারেশন ব্যর্থ", "Operation failed"));
    } finally {
      setActing(null);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setPaymentFilter("");
    setRiskFilter("");
    setStatusFilter("");
    setTimeRange("");
  };
  const activeFilterCount = [debouncedSearch, paymentFilter, riskFilter, statusFilter, timeRange].filter(Boolean).length;

  return (
    <div>
      <Header locale={locale} t={t} />
      <StatsStrip stats={stats} loading={loading && !stats} locale={locale} t={t} />

      {/* Status pill tabs */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {[
          { value: "" as StatusValue,          label: t("সব", "All"),          color: "bg-gray-100 text-gray-700 border-gray-200",   activeColor: "bg-gray-800 text-white border-gray-800" },
          { value: "pending" as StatusValue,   label: t("পেন্ডিং", "Pending"),  color: "bg-amber-50 text-amber-700 border-amber-200", activeColor: "bg-amber-500 text-white border-amber-500" },
          { value: "confirmed" as StatusValue, label: t("কনফার্মড", "Confirmed"), color: "bg-blue-50 text-blue-700 border-blue-200",    activeColor: "bg-blue-600 text-white border-blue-600" },
          { value: "processing" as StatusValue, label: t("প্রসেসিং", "Processing"), color: "bg-violet-50 text-violet-700 border-violet-200", activeColor: "bg-violet-600 text-white border-violet-600" },
          { value: "fulfilled" as StatusValue, label: t("ফুলফিল্ড", "Fulfilled"), color: "bg-emerald-50 text-emerald-700 border-emerald-200", activeColor: "bg-emerald-600 text-white border-emerald-600" },
          { value: "cancelled" as StatusValue, label: t("বাতিল", "Cancelled"),  color: "bg-rose-50 text-rose-700 border-rose-200",     activeColor: "bg-rose-600 text-white border-rose-600" },
          { value: "refunded" as StatusValue,  label: t("রিফান্ড", "Refunded"), color: "bg-orange-50 text-orange-700 border-orange-200", activeColor: "bg-orange-500 text-white border-orange-500" },
        ].map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${statusFilter === s.value ? s.activeColor : s.color} hover:shadow-sm ${locale === "bn" ? "font-bn" : ""}`}
          >
            {s.label}
            <span className="font-mono tabular-nums text-[10px] opacity-80">
              {s.value === "" ? (orderCounts.total || 0) : (orderCounts[s.value] || 0)}
            </span>
          </button>
        ))}
      </div>

      {/* Search + filters bar */}
      <Toolbar
        search={search} setSearch={setSearch}
        timeRange={timeRange} setTimeRange={setTimeRange}
        paymentFilter={paymentFilter} setPaymentFilter={setPaymentFilter}
        riskFilter={riskFilter} setRiskFilter={setRiskFilter}
        activeFilterCount={activeFilterCount}
        onClear={clearFilters}
        locale={locale}
        t={t}
      />

      {loading && orders.length === 0 ? (
        <TableSkeleton />
      ) : filteredOrders.length === 0 ? (
        <EmptyState hasFilters={activeFilterCount > 0} locale={locale} t={t} />
      ) : (
        <OrdersTable
          orders={filteredOrders}
          onView={onView}
          onConfirm={requestConfirm}
          onCancel={requestCancel}
          onFulfill={requestFulfill}
          onMarkPaid={requestMarkPaid}
          acting={acting}
          locale={locale}
          t={t}
        />
      )}

      <ConfirmModal
        open={pending !== null}
        title={pendingTitle(pending, t)}
        body={pendingBody(pending, t)}
        confirmLabel={pendingConfirmLabel(pending, t)}
        tone={pending?.action === "cancel" ? "destructive" : "info"}
        onCancel={() => setPending(null)}
        onConfirm={executePending}
      />
    </div>
  );
}

/* ─── Header ─── */

function Header({ locale, t }: { locale: string; t: (bn: string, en: string) => string }) {
  const exportUrl = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/admin/orders/export/csv`;
  return (
    <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
      <div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#7c2df7]">
          <ShoppingBag className="w-3.5 h-3.5" />
          <span className={locale === "bn" ? "font-bn" : ""}>{t("অর্ডার ম্যানেজমেন্ট", "Order Management")}</span>
        </div>
        <h1 className={`text-xl md:text-2xl font-bold text-gray-900 ${locale === "bn" ? "font-bn" : ""}`}>
          {t("অর্ডার", "Orders")}
        </h1>
      </div>
      <a
        href={exportUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 shadow-sm ${locale === "bn" ? "font-bn" : ""}`}
      >
        <Download className="w-4 h-4" /> {t("CSV এক্সপোর্ট", "Export CSV")}
      </a>
    </div>
  );
}

/* ─── Stats strip ─── */

function StatsStrip({
  stats, loading, locale, t,
}: {
  stats: OpsStats | null; loading: boolean; locale: string; t: (bn: string, en: string) => string;
}) {
  const revenueToday = parseFloat(stats?.revenue_today || "0");
  const cards = [
    { label: t("আজকের অর্ডার", "Orders today"),  value: stats?.orders_today ?? 0,                          icon: ShoppingBag,   iconBg: "bg-[#f5f0ff]",  iconFg: "text-[#7c2df7]" },
    { label: t("আজকের রেভেনিউ", "Revenue today"), value: stats ? formatCurrency(revenueToday, locale) : "—", icon: Wallet,        iconBg: "bg-[#fff8e1]",  iconFg: "text-[#b77800]" },
    { label: t("পেন্ডিং অর্ডার", "Pending"),      value: stats?.pending_count ?? 0,                         icon: Clock,         iconBg: "bg-amber-50",   iconFg: "text-amber-600" },
    { label: t("আনপেইড COD", "Unpaid COD"),         value: stats?.unpaid_cod_count ?? 0,                      icon: CreditCard,    iconBg: "bg-orange-50",  iconFg: "text-orange-600" },
    { label: t("হাই রিস্ক", "High risk"),            value: stats?.high_risk_count ?? 0,                       icon: ShieldAlert,   iconBg: "bg-rose-50",    iconFg: "text-rose-600" },
    { label: t("ফুলফিলমেন্ট হার", "Fulfillment"),   value: stats ? `${stats.fulfillment_rate}%` : "—",        icon: TrendingUp,    iconBg: "bg-emerald-50", iconFg: "text-emerald-600" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
      {cards.map((c, i) => (
        <div key={i} className="rounded-2xl border border-gray-100 bg-white p-4">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 ${c.iconBg}`}>
            <c.icon className={`w-4 h-4 ${c.iconFg}`} />
          </div>
          <p className={`text-[11px] text-gray-500 font-medium leading-tight ${locale === "bn" ? "font-bn" : ""}`}>{c.label}</p>
          {loading && !stats ? (
            <div className="skeleton h-6 w-16 mt-1" />
          ) : (
            <p className="text-xl md:text-[22px] font-bold text-gray-900 mt-0.5 tabular-nums">{c.value}</p>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Toolbar ─── */

function Toolbar({
  search, setSearch, timeRange, setTimeRange, paymentFilter, setPaymentFilter, riskFilter, setRiskFilter,
  activeFilterCount, onClear, locale, t,
}: {
  search: string; setSearch: (v: string) => void;
  timeRange: TimeRange; setTimeRange: (v: TimeRange) => void;
  paymentFilter: PaymentFilter; setPaymentFilter: (v: PaymentFilter) => void;
  riskFilter: RiskFilter; setRiskFilter: (v: RiskFilter) => void;
  activeFilterCount: number; onClear: () => void;
  locale: string; t: (bn: string, en: string) => string;
}) {
  const selectClass = "bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 outline-none focus:border-[#7c2df7]/50 hover:border-gray-300 transition-colors cursor-pointer appearance-none pr-8";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 mb-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("অর্ডার নম্বর / ফোন / নাম...", "Order #, phone, or name...")}
            className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 outline-none focus:border-[#7c2df7]/50 ${locale === "bn" ? "font-bn" : ""}`}
          />
        </div>

        <div className="relative">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className={`${selectClass} ${locale === "bn" ? "font-bn" : ""}`}
          >
            <option value="">{t("সব সময়", "All time")}</option>
            <option value="1">{t("আজ", "Today")}</option>
            <option value="7">{t("গত ৭ দিন", "Last 7 days")}</option>
            <option value="30">{t("গত ৩০ দিন", "Last 30 days")}</option>
          </select>
          <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)}
            className={`${selectClass} ${locale === "bn" ? "font-bn" : ""}`}
          >
            <option value="">{t("সব পেমেন্ট", "All payments")}</option>
            <option value="paid_only">{t("পেইড", "Paid only")}</option>
            <option value="unpaid_only">{t("আনপেইড", "Unpaid only")}</option>
            <option value="cod">COD</option>
            <option value="bkash">bKash</option>
            <option value="nagad">Nagad</option>
            <option value="free">{t("ফ্রি", "Free")}</option>
          </select>
          <CreditCard className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value as RiskFilter)}
            className={`${selectClass} ${locale === "bn" ? "font-bn" : ""}`}
          >
            <option value="">{t("সব রিস্ক", "All risk levels")}</option>
            <option value="low">{t("লো রিস্ক", "Low risk")}</option>
            <option value="medium">{t("মিডিয়াম রিস্ক", "Medium risk")}</option>
            <option value="high">{t("হাই রিস্ক", "High risk")}</option>
          </select>
          <ShieldAlert className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>

        {activeFilterCount > 0 && (
          <button
            onClick={onClear}
            className={`inline-flex items-center gap-1 text-xs font-semibold text-[#7c2df7] hover:text-[#532d80] px-2 ${locale === "bn" ? "font-bn" : ""}`}
          >
            <Filter className="w-3 h-3" /> {t("ফিল্টার মুছুন", "Clear")} ({activeFilterCount})
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Table ─── */

const STATUS_STYLE: Record<string, { bg: string; fg: string; bn: string; en: string }> = {
  pending:             { bg: "bg-amber-50",   fg: "text-amber-700",   bn: "পেন্ডিং",        en: "Pending" },
  confirmed:           { bg: "bg-blue-50",    fg: "text-blue-700",    bn: "কনফার্মড",       en: "Confirmed" },
  processing:          { bg: "bg-violet-50",  fg: "text-violet-700",  bn: "প্রসেসিং",       en: "Processing" },
  fulfilled:           { bg: "bg-emerald-50", fg: "text-emerald-700", bn: "ফুলফিল্ড",       en: "Fulfilled" },
  partially_fulfilled: { bg: "bg-indigo-50",  fg: "text-indigo-700",  bn: "আংশিক",           en: "Partial" },
  cancelled:           { bg: "bg-rose-50",    fg: "text-rose-700",    bn: "বাতিল",           en: "Cancelled" },
  refunded:            { bg: "bg-orange-50",  fg: "text-orange-700",  bn: "রিফান্ড",         en: "Refunded" },
};

function OrdersTable({
  orders, onView, onConfirm, onCancel, onFulfill, onMarkPaid, acting, locale, t,
}: {
  orders: OrderRow[];
  onView: (o: OrderRow) => void;
  onConfirm: (o: OrderRow) => void;
  onCancel: (o: OrderRow) => void;
  onFulfill: (o: OrderRow) => void;
  onMarkPaid: (o: OrderRow) => void;
  acting: string | null;
  locale: string;
  t: (bn: string, en: string) => string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className={`text-left text-[10px] uppercase tracking-wider text-gray-400 font-semibold ${locale === "bn" ? "font-bn" : ""}`}>
              <th className="px-4 py-3">{t("অর্ডার", "Order")}</th>
              <th className="px-3 py-3">{t("কাস্টমার", "Customer")}</th>
              <th className="px-3 py-3">{t("আইটেম", "Items")}</th>
              <th className="px-3 py-3 text-right">{t("টোটাল", "Total")}</th>
              <th className="px-3 py-3">{t("পেমেন্ট", "Payment")}</th>
              <th className="px-3 py-3">{t("শিপমেন্ট", "Shipment")}</th>
              <th className="px-3 py-3">{t("সময়", "When")}</th>
              <th className="px-4 py-3 text-right">{t("অ্যাকশন", "Actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {orders.map((o) => (
              <OrderRow
                key={o.id}
                order={o}
                acting={acting === o.id}
                onView={() => onView(o)}
                onConfirm={() => onConfirm(o)}
                onCancel={() => onCancel(o)}
                onFulfill={() => onFulfill(o)}
                onMarkPaid={() => onMarkPaid(o)}
                locale={locale}
                t={t}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrderRow({
  order: o, acting, onView, onConfirm, onCancel, onFulfill, onMarkPaid, locale, t,
}: {
  order: OrderRow;
  acting: boolean;
  onView: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onFulfill: () => void;
  onMarkPaid: () => void;
  locale: string;
  t: (bn: string, en: string) => string;
}) {
  const statusStyle = STATUS_STYLE[o.status] || STATUS_STYLE.pending;
  const isPaid = o.payment?.status === "success";
  const method = o.payment?.method;
  const total = typeof o.total === "number" ? o.total : parseFloat(o.total || "0");
  const paidAmount = isPaid ? total : 0;
  const dueAmount = total - paidAmount;

  const itemsSummary = (() => {
    if (!o.items || o.items.length === 0) return "—";
    const first = o.items[0]?.product_title || t("আইটেম", "Item");
    if (o.items.length === 1) return first;
    return locale === "bn"
      ? `${first} + আরও ${o.items.length - 1}টি`
      : `${first} + ${o.items.length - 1} more`;
  })();

  const customerName = o.shipping_name || o.user?.full_name || t("নামহীন", "Unnamed");
  const customerPhone = o.shipping_phone || o.user?.phone;

  // Inline quick-actions available by current status
  const canConfirm = o.status === "pending";
  const canCancel = ["pending", "confirmed", "processing"].includes(o.status);
  const canFulfill = ["confirmed", "processing"].includes(o.status);
  const canMarkPaid = method === "cod" && !isPaid && ["pending", "confirmed", "processing"].includes(o.status);

  return (
    <tr className="hover:bg-[#faf8ff]">
      {/* Order */}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1 min-w-0">
          <span className={`inline-flex w-max items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full ${statusStyle.bg} ${statusStyle.fg} ${locale === "bn" ? "font-bn" : ""}`}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "currentColor" }} />
            {locale === "bn" ? statusStyle.bn : statusStyle.en}
          </span>
          <span className="font-mono text-xs font-bold text-[#6b1ee3]">#{o.order_number}</span>
          <FraudScoreChip score={o.fraud_score} locale={locale} t={t} />
        </div>
      </td>

      {/* Customer */}
      <td className="px-3 py-3">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`font-bold text-gray-900 text-sm truncate max-w-[180px] ${locale === "bn" ? "font-bn" : ""}`}>{customerName}</span>
            {o.is_guest && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 ${locale === "bn" ? "font-bn" : ""}`}>
                {t("গেস্ট", "GUEST")}
              </span>
            )}
          </div>
          {customerPhone && (
            <span className="text-[11px] text-gray-500 font-mono inline-flex items-center gap-1">
              <Phone className="w-2.5 h-2.5 text-gray-400" />
              {customerPhone}
            </span>
          )}
          {o.shipping_address ? (
            <span className={`text-[10px] text-gray-400 mt-0.5 leading-tight line-clamp-1 inline-flex items-center gap-1 max-w-[220px] ${locale === "bn" ? "font-bn" : ""}`} title={`${o.shipping_address}, ${o.shipping_area || ""} ${o.shipping_city || ""}`}>
              <MapPin className="w-2.5 h-2.5 text-gray-400 shrink-0" />
              <span className="truncate">{o.shipping_address}{o.shipping_city ? `, ${o.shipping_city}` : ""}</span>
            </span>
          ) : (
            <span className={`text-[10px] font-semibold text-[#7c2df7] bg-[#f5f0ff] px-1.5 py-0.5 rounded w-max mt-0.5 ${locale === "bn" ? "font-bn" : ""}`}>
              {t("ডিজিটাল", "Digital")}
            </span>
          )}
        </div>
      </td>

      {/* Items */}
      <td className={`px-3 py-3 text-xs text-gray-600 max-w-[200px] truncate ${locale === "bn" ? "font-bn" : ""}`} title={itemsSummary}>
        {itemsSummary}
      </td>

      {/* Total / Paid / Due */}
      <td className="px-3 py-3 text-right">
        <div className={`flex flex-col items-end gap-0.5 text-[11px] ${locale === "bn" ? "font-bn" : ""}`}>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">{t("মোট", "Total")}</span>
            <span className="text-sm font-bold text-gray-900 tabular-nums">৳{formatAmount(total, locale)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">{t("পেইড", "Paid")}</span>
            <span className={`text-xs font-bold tabular-nums ${isPaid ? "text-emerald-600" : "text-gray-400"}`}>৳{formatAmount(paidAmount, locale)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">{t("বাকি", "Due")}</span>
            <span className={`text-xs font-bold tabular-nums ${dueAmount > 0 ? "text-rose-600" : "text-gray-400"}`}>৳{formatAmount(dueAmount, locale)}</span>
          </div>
        </div>
      </td>

      {/* Payment */}
      <td className="px-3 py-3">
        <div className="flex flex-col gap-0.5">
          {method ? (
            <span className={`inline-flex w-max px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
              method === "cod"   ? "bg-amber-50 text-amber-700" :
              method === "bkash" ? "bg-pink-50 text-pink-700" :
              method === "nagad" ? "bg-orange-50 text-orange-700" :
              method === "free"  ? "bg-sky-50 text-sky-700" :
                                   "bg-gray-100 text-gray-600"
            }`}>
              {method}
            </span>
          ) : <span className="text-[10px] text-gray-400">—</span>}
        </div>
      </td>

      {/* Shipment */}
      <td className="px-3 py-3">
        {o.shipment && o.shipment.status ? (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full ${
            o.shipment.status === "delivered"  ? "bg-emerald-50 text-emerald-700" :
            o.shipment.status === "dispatched" ? "bg-blue-50 text-blue-700" :
            o.shipment.status === "confirmed"  ? "bg-indigo-50 text-indigo-700" :
            o.shipment.status === "returned"   ? "bg-gray-100 text-gray-600" :
                                                  "bg-amber-50 text-amber-700"
          }`}>
            <Truck className="w-2.5 h-2.5" />
            {o.shipment.status}
          </span>
        ) : <span className="text-[10px] text-gray-400">—</span>}
      </td>

      {/* When */}
      <td className={`px-3 py-3 text-[11px] text-gray-500 ${locale === "bn" ? "font-bn" : ""}`}>
        <div className="flex flex-col">
          <span className="font-semibold text-gray-700">{new Date(o.created_at).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB")}</span>
          <span>{new Date(o.created_at).toLocaleTimeString(locale === "bn" ? "bn-BD" : "en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <ActionButton
            label={t("বিস্তারিত দেখুন", "View details")}
            onClick={onView}
            className="text-[#7c2df7] bg-[#f5f0ff] hover:bg-[#ede5ff]"
            locale={locale}
          >
            <Eye className="w-3.5 h-3.5" />
          </ActionButton>
          {canMarkPaid && (
            <ActionButton
              label={t("COD পেমেন্ট কনফার্ম করুন", "Mark COD as paid")}
              onClick={onMarkPaid}
              disabled={acting}
              className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
              locale={locale}
            >
              {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
            </ActionButton>
          )}
          {canConfirm && (
            <ActionButton
              label={t("অর্ডার কনফার্ম করুন", "Confirm order")}
              onClick={onConfirm}
              disabled={acting}
              className="text-blue-700 bg-blue-50 hover:bg-blue-100"
              locale={locale}
            >
              {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </ActionButton>
          )}
          {canFulfill && (
            <ActionButton
              label={t("ফুলফিল্ড হিসেবে চিহ্নিত করুন", "Mark as fulfilled")}
              onClick={onFulfill}
              disabled={acting}
              className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
              locale={locale}
            >
              {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
            </ActionButton>
          )}
          {canCancel && (
            <ActionButton
              label={t("অর্ডার বাতিল করুন", "Cancel order")}
              onClick={onCancel}
              disabled={acting}
              className="text-rose-600 bg-rose-50 hover:bg-rose-100"
              locale={locale}
            >
              <XIcon className="w-3.5 h-3.5" />
            </ActionButton>
          )}
        </div>
      </td>
    </tr>
  );
}

/* ─── Fraud score chip ─── */

function FraudScoreChip({
  score, locale, t,
}: {
  score?: number | null;
  locale: string;
  t: (bn: string, en: string) => string;
}) {
  if (score == null) return null;
  const tone =
    score >= 60 ? { bg: "bg-rose-50 border-rose-200",     fg: "text-rose-700",   dot: "bg-rose-500",    label: t("হাই", "High") } :
    score >= 30 ? { bg: "bg-amber-50 border-amber-200",   fg: "text-amber-800",  dot: "bg-amber-500",   label: t("মিডিয়াম", "Medium") } :
                  { bg: "bg-emerald-50 border-emerald-200", fg: "text-emerald-700", dot: "bg-emerald-500", label: t("লো", "Low") };
  return (
    <span
      title={t("ফ্রড রিস্ক স্কোর", "Fraud risk score")}
      className={`inline-flex w-max items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded border ${tone.bg} ${tone.fg}`}
    >
      <ShieldAlert className="w-2.5 h-2.5" />
      <span className={`${locale === "bn" ? "font-bn" : ""}`}>{tone.label}</span>
      <span className={`ml-0.5 px-1 py-px rounded-sm text-[9px] tabular-nums text-white ${tone.dot}`}>{score}</span>
    </span>
  );
}

/* ─── Action button with styled hover tooltip ─── */

function ActionButton({
  label, onClick, disabled, className, children, locale,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
  locale: string;
}) {
  return (
    <span className="relative group inline-flex">
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={`p-1.5 rounded-lg disabled:opacity-50 ${className || ""}`}
      >
        {children}
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-full right-0 mb-1.5 whitespace-nowrap px-2 py-1 rounded-md bg-[#1a1025] text-white text-[11px] font-semibold shadow-lg opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition duration-150 z-30 ${locale === "bn" ? "font-bn" : ""}`}
      >
        {label}
        <span className="absolute top-full right-3 w-1.5 h-1.5 -mt-0.5 bg-[#1a1025] rotate-45" />
      </span>
    </span>
  );
}

/* ─── Empty/Skeleton ─── */

function EmptyState({ hasFilters, locale, t }: { hasFilters: boolean; locale: string; t: (bn: string, en: string) => string }) {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
      <div className="w-14 h-14 mx-auto rounded-full bg-[#f5f0ff] flex items-center justify-center mb-3">
        <ShoppingBag className="w-6 h-6 text-[#7c2df7]" />
      </div>
      <p className={`text-base font-bold text-gray-900 ${locale === "bn" ? "font-bn" : ""}`}>
        {hasFilters ? t("কোনো অর্ডার মেলেনি", "No orders match your filters") : t("এখনো কোনো অর্ডার নেই", "No orders yet")}
      </p>
      <p className={`text-sm text-gray-500 mt-1 ${locale === "bn" ? "font-bn" : ""}`}>
        {hasFilters ? t("ফিল্টার পরিবর্তন করুন", "Try changing the filters") : t("নতুন অর্ডার এলে এখানে দেখাবে", "New orders will appear here")}
      </p>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
      {[...Array(8)].map((_, i) => <div key={i} className="skeleton h-14 rounded-lg" />)}
    </div>
  );
}

/* ─── Confirm copy ─── */

function pendingTitle(p: { order: OrderRow; action: "confirm" | "cancel" | "fulfill" | "mark_paid" } | null, t: (bn: string, en: string) => string): string {
  if (!p) return "";
  switch (p.action) {
    case "confirm":   return t("অর্ডার কনফার্ম করবেন?", "Confirm this order?");
    case "cancel":    return t("অর্ডার বাতিল করবেন?", "Cancel this order?");
    case "fulfill":   return t("অর্ডার ফুলফিল্ড হিসেবে চিহ্নিত?", "Mark this order as fulfilled?");
    case "mark_paid": return t("পেমেন্ট কনফার্ম করবেন?", "Confirm payment received?");
  }
}

function pendingBody(p: { order: OrderRow; action: "confirm" | "cancel" | "fulfill" | "mark_paid" } | null, t: (bn: string, en: string) => string): string {
  if (!p) return "";
  const num = p.order.order_number;
  switch (p.action) {
    case "confirm":
      return t(
        `অর্ডার #${num} কনফার্ম করা হবে এবং ক্রেতা কোর্স/ই-বুক অ্যাক্সেস পাবেন।`,
        `Order #${num} will be confirmed and the customer will get access to any digital products.`
      );
    case "cancel":
      return t(
        `অর্ডার #${num} বাতিল করা হবে। কোনো এনটাইটেলমেন্ট আর প্রদান করা হবে না।`,
        `Order #${num} will be cancelled. No entitlements will be granted.`
      );
    case "fulfill":
      return t(
        `অর্ডার #${num} ফুলফিল্ড হিসেবে চিহ্নিত হবে। এটি শেষ ধাপ।`,
        `Order #${num} will be marked as fulfilled. This is the final step.`
      );
    case "mark_paid":
      return t(
        `অর্ডার #${num} এর COD পেমেন্ট কনফার্মড হিসেবে চিহ্নিত হবে।`,
        `The COD payment for order #${num} will be marked as received.`
      );
  }
}

function pendingConfirmLabel(p: { action: "confirm" | "cancel" | "fulfill" | "mark_paid" } | null, t: (bn: string, en: string) => string): string {
  if (!p) return t("নিশ্চিত করুন", "Confirm");
  switch (p.action) {
    case "confirm":   return t("কনফার্ম", "Confirm");
    case "cancel":    return t("বাতিল করুন", "Cancel order");
    case "fulfill":   return t("ফুলফিল্ড", "Mark fulfilled");
    case "mark_paid": return t("পেমেন্ট কনফার্ম", "Mark paid");
  }
}

/* ─── Formatters ─── */

function formatAmount(v: string | number, locale: string): string {
  const n = typeof v === "number" ? v : parseFloat(v || "0");
  return Math.round(n).toLocaleString(locale === "bn" ? "bn-BD" : "en-US");
}

function formatCurrency(n: number, locale: string): string {
  if (n >= 1_00_000) return `৳${(n / 1_00_000).toFixed(n >= 10_00_000 ? 0 : 1)}L`;
  if (n >= 1_000) return `৳${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return `৳${Math.round(n).toLocaleString(locale === "bn" ? "bn-BD" : "en-US")}`;
}
