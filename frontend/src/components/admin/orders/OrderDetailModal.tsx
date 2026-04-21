"use client";

import { useEffect, useMemo, useState } from "react";
import {
  X as XIcon, Copy, Phone, MessageCircle, MapPin, Mail, User, ShieldAlert,
  CreditCard, Package, Check, Play, RotateCcw, Loader2, Clock, Truck,
  FileText, ExternalLink, ShoppingBag, Ban, ChevronRight, ArrowUpRight,
  CircleDot, Printer,
} from "lucide-react";
import { useLocaleStore } from "@/stores/locale-store";
import { api } from "@/lib/api";
import { toast } from "@/stores/toast-store";
import { ConfirmModal } from "../ConfirmModal";
import { getFlagInfo, SEVERITY_STYLE } from "../fraud/flagLabels";

type OrderItem = {
  id?: string;
  product_id?: string;
  product_title?: string;
  quantity?: number;
  unit_price?: string | number;
  total_price?: string | number;
};

export type OrderDetail = {
  id: string;
  order_number: string;
  status: string;
  currency?: string;
  created_at: string;
  is_guest?: boolean;
  fraud_score?: number | null;
  fraud_flags?: string[];
  notes?: string | null;
  subtotal?: string | number;
  shipping_fee?: string | number;
  discount?: string | number;
  total: string | number;
  shipping_name?: string | null;
  shipping_phone?: string | null;
  shipping_address?: string | null;
  shipping_area?: string | null;
  shipping_city?: string | null;
  shipping_zone?: string | null;
  user?: { id?: string; full_name?: string | null; phone?: string | null; email?: string | null };
  payment?: { status?: string; method?: string; transaction_id?: string } | null;
  shipment?: { status?: string; tracking_number?: string | null; courier?: string | null } | null;
  items?: OrderItem[];
};

type Transition = "confirm" | "process" | "fulfill" | "cancel" | "refund" | "mark_paid";

type Pending = { kind: Transition };

export function OrderDetailModal({
  order,
  accessToken,
  onClose,
  onUpdated,
}: {
  order: OrderDetail | null;
  accessToken: string;
  onClose: () => void;
  onUpdated: (updated: OrderDetail) => void;
}) {
  const { locale, t } = useLocaleStore();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [current, setCurrent] = useState<OrderDetail | null>(order);

  // Sync to new order
  useEffect(() => { setCurrent(order); }, [order]);

  // Close on Escape
  useEffect(() => {
    if (!order) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy && !pending) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [order, busy, pending, onClose]);

  const o = current;
  if (!o) return null;

  const total = toNum(o.total);
  const subtotal = toNum(o.subtotal);
  const shippingFee = toNum(o.shipping_fee);
  const discount = toNum(o.discount);
  const isPaid = o.payment?.status === "success";
  const paidAmount = isPaid ? total : 0;
  const dueAmount = total - paidAmount;
  const method = o.payment?.method;

  const customerName = o.shipping_name || o.user?.full_name || t("নামহীন", "Unnamed");
  const customerPhone = o.shipping_phone || o.user?.phone || "";
  const customerEmail = o.user?.email || "";
  const fullAddress = [o.shipping_address, o.shipping_area, o.shipping_city].filter(Boolean).join(", ");

  const copy = async (value: string, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t(`${label} কপি হয়েছে`, `${label} copied`));
    } catch {
      toast.error(t("কপি ব্যর্থ", "Copy failed"));
    }
  };

  const runAction = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.kind === "mark_paid") {
        await api.patch(`/admin/orders/${o.id}/confirm-payment`, {}, accessToken);
        const updated: OrderDetail = {
          ...o,
          payment: { ...(o.payment || {}), status: "success" },
        };
        setCurrent(updated);
        onUpdated(updated);
        toast.success(t("পেমেন্ট সফল হিসেবে মার্ক হয়েছে", "Payment marked as received"));
      } else {
        const newStatus =
          pending.kind === "confirm" ? "confirmed" :
          pending.kind === "process" ? "processing" :
          pending.kind === "fulfill" ? "fulfilled" :
          pending.kind === "cancel"  ? "cancelled" :
                                       "refunded";
        await api.patch(`/admin/orders/${o.id}/status`, { status: newStatus }, accessToken);
        const updated: OrderDetail = { ...o, status: newStatus };
        setCurrent(updated);
        onUpdated(updated);
        toast.success(transitionToast(pending.kind, t));
      }
      setPending(null);
    } catch (err: any) {
      toast.error(err?.message || t("অপারেশন ব্যর্থ", "Operation failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[70] flex items-start md:items-center justify-center p-3 md:p-6 bg-gray-900/50 backdrop-blur-sm overflow-y-auto"
        onClick={(e) => { if (e.target === e.currentTarget && !pending) onClose(); }}
      >
        <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden my-6 md:my-0 max-h-[95vh] flex flex-col">
          {/* ── Sticky header ── */}
          <HeaderBar
            order={o}
            locale={locale}
            t={t}
            onCopy={copy}
            onClose={onClose}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 md:p-5 overflow-y-auto flex-1 bg-[#fafafa]">
            {/* ── LEFT / MAIN ── */}
            <div className="lg:col-span-2 space-y-4">
              <CustomerCard
                name={customerName}
                phone={customerPhone}
                email={customerEmail}
                address={o.shipping_address || null}
                area={o.shipping_area || null}
                city={o.shipping_city || null}
                zone={o.shipping_zone || null}
                fullAddress={fullAddress}
                isGuest={o.is_guest}
                notes={o.notes || null}
                locale={locale}
                t={t}
                onCopy={copy}
              />

              <ItemsCard items={o.items || []} locale={locale} t={t} />

              <TotalsCard
                subtotal={subtotal}
                shippingFee={shippingFee}
                discount={discount}
                total={total}
                locale={locale}
                t={t}
              />
            </div>

            {/* ── RIGHT / SIDE ── */}
            <div className="space-y-4">
              <StatusActionsCard
                status={o.status}
                busy={busy}
                onRequest={(kind) => setPending({ kind })}
                locale={locale}
                t={t}
              />

              <PaymentCard
                method={method}
                paymentStatus={o.payment?.status}
                transactionId={o.payment?.transaction_id}
                total={total}
                paidAmount={paidAmount}
                dueAmount={dueAmount}
                canMarkPaid={method === "cod" && !isPaid && ["pending", "confirmed", "processing"].includes(o.status)}
                onMarkPaid={() => setPending({ kind: "mark_paid" })}
                busy={busy}
                locale={locale}
                t={t}
                onCopy={copy}
              />

              {(o.fraud_score != null || o.is_guest) && (
                <FraudCard
                  score={o.fraud_score}
                  flags={o.fraud_flags || []}
                  isGuest={!!o.is_guest}
                  locale={locale}
                  t={t}
                />
              )}

              {o.shipment && (o.shipment.status || o.shipment.tracking_number) && (
                <ShipmentCard
                  status={o.shipment.status || null}
                  tracking={o.shipment.tracking_number || null}
                  courier={o.shipment.courier || null}
                  locale={locale}
                  t={t}
                  onCopy={copy}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation */}
      <ConfirmModal
        open={pending !== null}
        title={pendingTitle(pending?.kind, o.order_number, t)}
        body={pendingBody(pending?.kind, o.order_number, t)}
        confirmLabel={pendingConfirmLabel(pending?.kind, t)}
        tone={pending?.kind === "cancel" ? "destructive" : "info"}
        onCancel={() => !busy && setPending(null)}
        onConfirm={runAction}
      />
    </>
  );
}

/* ─── Header ─── */

function HeaderBar({
  order: o, locale, t, onCopy, onClose,
}: {
  order: OrderDetail;
  locale: string;
  t: (bn: string, en: string) => string;
  onCopy: (v: string, label: string) => void;
  onClose: () => void;
}) {
  const d = new Date(o.created_at);
  return (
    <div className="relative px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-[#f5f0ff] via-white to-white">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#7c2df7] flex items-center justify-center text-white shrink-0">
          <ShoppingBag className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2">
            <span className={`text-[11px] font-bold uppercase tracking-wider text-gray-400 ${locale === "bn" ? "font-bn" : ""}`}>
              {t("অর্ডার", "Order")}
            </span>
            <button
              onClick={() => onCopy(o.order_number, t("অর্ডার নাম্বার", "Order #"))}
              className="inline-flex items-center gap-1 font-mono text-base font-bold text-[#6b1ee3] hover:bg-white px-1.5 py-0.5 rounded transition-colors group"
            >
              #{o.order_number}
              <Copy className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
            </button>
            <StatusPill status={o.status} locale={locale} />
          </div>
          <p className={`text-xs text-gray-500 mt-1 flex items-center gap-1.5 ${locale === "bn" ? "font-bn" : ""}`}>
            <Clock className="w-3 h-3" />
            {d.toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            <span className="text-gray-300">·</span>
            {d.toLocaleTimeString(locale === "bn" ? "bn-BD" : "en-GB", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <a
          href={`/admin/orders/${o.id}/invoice`}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-bold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shrink-0 ${locale === "bn" ? "font-bn" : ""}`}
        >
          <Printer className="w-3.5 h-3.5" />
          {t("ইনভয়েস", "Invoice")}
        </a>
        <button
          onClick={onClose}
          aria-label={t("বন্ধ করুন", "Close")}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 shrink-0"
        >
          <XIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

const STATUS_STYLE: Record<string, { bg: string; fg: string; bn: string; en: string }> = {
  pending:             { bg: "bg-amber-100",   fg: "text-amber-800",   bn: "পেন্ডিং",   en: "Pending" },
  confirmed:           { bg: "bg-blue-100",    fg: "text-blue-800",    bn: "কনফার্মড",  en: "Confirmed" },
  processing:          { bg: "bg-violet-100",  fg: "text-violet-800",  bn: "প্রসেসিং",  en: "Processing" },
  fulfilled:           { bg: "bg-emerald-100", fg: "text-emerald-800", bn: "ফুলফিল্ড",  en: "Fulfilled" },
  partially_fulfilled: { bg: "bg-indigo-100",  fg: "text-indigo-800",  bn: "আংশিক",     en: "Partial" },
  cancelled:           { bg: "bg-rose-100",    fg: "text-rose-800",    bn: "বাতিল",     en: "Cancelled" },
  refunded:            { bg: "bg-orange-100",  fg: "text-orange-800",  bn: "রিফান্ড",   en: "Refunded" },
};

function StatusPill({ status, locale }: { status: string; locale: string }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${s.bg} ${s.fg} ${locale === "bn" ? "font-bn" : ""}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {locale === "bn" ? s.bn : s.en}
    </span>
  );
}

/* ─── Customer / shipping card ─── */

function CustomerCard({
  name, phone, email, address, area, city, zone, fullAddress, isGuest, notes, locale, t, onCopy,
}: {
  name: string;
  phone: string;
  email: string;
  address: string | null;
  area: string | null;
  city: string | null;
  zone: string | null;
  fullAddress: string;
  isGuest?: boolean;
  notes: string | null;
  locale: string;
  t: (bn: string, en: string) => string;
  onCopy: (v: string, label: string) => void;
}) {
  const mapsUrl = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}` : "";
  return (
    <Card>
      <SectionTitle icon={<User className="w-3.5 h-3.5" />} locale={locale} t={t} bn="কাস্টমার" en="Customer" />

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-base font-bold text-gray-900 truncate ${locale === "bn" ? "font-bn" : ""}`}>{name}</p>
            {isGuest && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 tracking-wider ${locale === "bn" ? "font-bn" : ""}`}>
                {t("গেস্ট", "GUEST")}
              </span>
            )}
          </div>
          {email && (
            <p className="text-xs text-gray-500 font-mono mt-0.5 inline-flex items-center gap-1 truncate max-w-[260px]">
              <Mail className="w-3 h-3 shrink-0" /> {email}
            </p>
          )}
        </div>
      </div>

      {/* Phone row with quick actions */}
      {phone && (
        <div className="flex items-center flex-wrap gap-1.5 pb-3 border-b border-gray-100">
          <div className="inline-flex items-center gap-1.5 text-sm font-mono font-semibold text-gray-900 bg-gray-50 rounded-lg px-2.5 py-1.5">
            <Phone className="w-3.5 h-3.5 text-gray-400" />
            {phone}
          </div>
          <QuickLink href={`tel:${phone}`} locale={locale} label={t("কল", "Call")} icon={<Phone className="w-3 h-3" />} color="text-blue-700 bg-blue-50 hover:bg-blue-100" />
          <QuickLink
            href={`https://wa.me/${phone.replace(/[^0-9]/g, "")}`}
            locale={locale}
            label={t("WhatsApp", "WhatsApp")}
            icon={<MessageCircle className="w-3 h-3" />}
            color="text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
            external
          />
          <button
            onClick={() => onCopy(phone, t("ফোন", "Phone"))}
            className={`inline-flex items-center gap-1 text-[11px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-lg ${locale === "bn" ? "font-bn" : ""}`}
          >
            <Copy className="w-3 h-3" /> {t("কপি", "Copy")}
          </button>
        </div>
      )}

      {/* Address */}
      {address ? (
        <div className="pt-3">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className={`text-sm text-gray-800 leading-relaxed ${locale === "bn" ? "font-bn" : ""}`}>
                {address}
                {area && <>, {area}</>}
                {city && <>, {city}</>}
              </p>
              {zone && (
                <p className="text-[11px] text-gray-500 font-mono mt-0.5">{t("জোন", "Zone")}: {zone}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-2">
                <QuickLink
                  href={mapsUrl}
                  locale={locale}
                  label={t("ম্যাপে দেখুন", "View on Maps")}
                  icon={<ExternalLink className="w-3 h-3" />}
                  color="text-[#7c2df7] bg-[#f5f0ff] hover:bg-[#ede5ff]"
                  external
                />
                <button
                  onClick={() => onCopy(fullAddress, t("ঠিকানা", "Address"))}
                  className={`inline-flex items-center gap-1 text-[11px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-lg ${locale === "bn" ? "font-bn" : ""}`}
                >
                  <Copy className="w-3 h-3" /> {t("কপি", "Copy")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="pt-3">
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold text-[#7c2df7] bg-[#f5f0ff] px-2 py-1 rounded-lg ${locale === "bn" ? "font-bn" : ""}`}>
            <Package className="w-3 h-3" /> {t("ডিজিটাল অর্ডার", "Digital order")}
          </span>
        </div>
      )}

      {/* Notes */}
      {notes && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className={`text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-1 inline-flex items-center gap-1 ${locale === "bn" ? "font-bn" : ""}`}>
            <FileText className="w-3 h-3" /> {t("কাস্টমার নোট", "Customer note")}
          </p>
          <p className={`text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed ${locale === "bn" ? "font-bn" : ""}`}>
            {notes}
          </p>
        </div>
      )}
    </Card>
  );
}

function QuickLink({
  href, locale, label, icon, color, external,
}: {
  href: string;
  locale: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg ${color} ${locale === "bn" ? "font-bn" : ""}`}
    >
      {icon}
      {label}
    </a>
  );
}

/* ─── Items table ─── */

function ItemsCard({ items, locale, t }: { items: OrderItem[]; locale: string; t: (bn: string, en: string) => string }) {
  const itemCount = items.reduce((n, it) => n + (Number(it.quantity) || 0), 0);
  return (
    <Card padded={false}>
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <SectionTitle icon={<Package className="w-3.5 h-3.5" />} locale={locale} t={t} bn="আইটেম" en="Items" noMargin />
        <span className={`text-[11px] font-semibold text-gray-500 ${locale === "bn" ? "font-bn" : ""}`}>
          {items.length} {t("প্রোডাক্ট", "products")} · {itemCount} {t("ইউনিট", "units")}
        </span>
      </div>
      {items.length === 0 ? (
        <div className={`px-4 py-8 text-center text-sm text-gray-400 ${locale === "bn" ? "font-bn" : ""}`}>
          {t("কোনো আইটেম পাওয়া যায়নি", "No items found")}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`text-[10px] uppercase tracking-wider text-gray-400 font-semibold border-t border-b border-gray-100 bg-gray-50/50 ${locale === "bn" ? "font-bn" : ""}`}>
                <th className="px-4 py-2 text-left">{t("প্রোডাক্ট", "Product")}</th>
                <th className="px-3 py-2 text-center w-16">{t("পরিমাণ", "Qty")}</th>
                <th className="px-3 py-2 text-right w-24">{t("মূল্য", "Price")}</th>
                <th className="px-4 py-2 text-right w-28">{t("মোট", "Total")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item, i) => (
                <tr key={item.id || i} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <p className={`text-sm font-bold text-gray-900 ${locale === "bn" ? "font-bn" : ""}`}>
                      {item.product_title || t("আনটাইটেলড আইটেম", "Untitled item")}
                    </p>
                    {item.product_id && (
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">{item.product_id.slice(0, 8)}</p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="inline-flex items-center justify-center min-w-[32px] h-6 px-1.5 rounded-md bg-gray-100 text-gray-700 text-xs font-bold tabular-nums">
                      ×{item.quantity || 1}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-sm text-gray-600 tabular-nums">
                    ৳{formatAmount(item.unit_price, locale)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-gray-900 tabular-nums">
                    ৳{formatAmount(item.total_price, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ─── Totals ─── */

function TotalsCard({
  subtotal, shippingFee, discount, total, locale, t,
}: {
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  locale: string;
  t: (bn: string, en: string) => string;
}) {
  return (
    <Card>
      <SectionTitle icon={<CreditCard className="w-3.5 h-3.5" />} locale={locale} t={t} bn="সারাংশ" en="Summary" />
      <div className="space-y-1.5">
        <Row label={t("সাবটোটাল", "Subtotal")} value={`৳${formatAmount(subtotal, locale)}`} locale={locale} />
        <Row label={t("শিপিং ফি", "Shipping")} value={`৳${formatAmount(shippingFee, locale)}`} locale={locale} />
        {discount > 0 && (
          <Row
            label={t("ডিসকাউন্ট", "Discount")}
            value={`− ৳${formatAmount(discount, locale)}`}
            valueClass="text-rose-600"
            locale={locale}
          />
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
        <span className={`text-sm font-bold text-gray-900 ${locale === "bn" ? "font-bn" : ""}`}>
          {t("গ্র্যান্ড টোটাল", "Grand total")}
        </span>
        <span className="text-lg font-bold text-[#7c2df7] tabular-nums">৳{formatAmount(total, locale)}</span>
      </div>
    </Card>
  );
}

function Row({ label, value, valueClass, locale }: { label: string; value: string; valueClass?: string; locale: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={`text-gray-500 font-semibold ${locale === "bn" ? "font-bn" : ""}`}>{label}</span>
      <span className={`font-bold tabular-nums ${valueClass || "text-gray-800"}`}>{value}</span>
    </div>
  );
}

/* ─── Status timeline + actions ─── */

const STEPS: { key: string; icon: React.ComponentType<{ className?: string }>; bn: string; en: string }[] = [
  { key: "pending",    icon: Clock,    bn: "পেন্ডিং",   en: "Pending" },
  { key: "confirmed",  icon: Check,    bn: "কনফার্মড",  en: "Confirmed" },
  { key: "processing", icon: Play,     bn: "প্রসেসিং",  en: "Processing" },
  { key: "fulfilled",  icon: Package,  bn: "ফুলফিল্ড",  en: "Fulfilled" },
];

function StatusActionsCard({
  status, busy, onRequest, locale, t,
}: {
  status: string;
  busy: boolean;
  onRequest: (k: Transition) => void;
  locale: string;
  t: (bn: string, en: string) => string;
}) {
  const stepIdx = STEPS.findIndex((s) => s.key === status);
  const isTerminal = status === "cancelled" || status === "refunded";
  const transitions = getAvailableTransitions(status);

  return (
    <Card>
      <SectionTitle icon={<CircleDot className="w-3.5 h-3.5" />} locale={locale} t={t} bn="স্ট্যাটাস" en="Status" />

      {/* Vertical timeline (compact, fits right column) */}
      <div className="space-y-0 mb-3">
        {STEPS.map((step, i) => {
          const isCurrent = step.key === status;
          const isPast = !isTerminal && stepIdx > i;
          const Icon = step.icon;
          return (
            <div key={step.key} className="flex items-start gap-2.5 relative">
              <div className="flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all ${
                  isCurrent ? "bg-[#7c2df7] text-white ring-4 ring-[#f5f0ff]" :
                  isPast ? "bg-emerald-500 text-white" :
                  "bg-gray-100 text-gray-400"
                }`}>
                  {isPast ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-0.5 h-5 ${isPast ? "bg-emerald-400" : "bg-gray-200"}`} />
                )}
              </div>
              <div className={`pt-1 pb-3 flex-1 ${locale === "bn" ? "font-bn" : ""}`}>
                <p className={`text-xs font-bold ${
                  isCurrent ? "text-[#7c2df7]" :
                  isPast ? "text-gray-700" :
                  "text-gray-400"
                }`}>
                  {locale === "bn" ? step.bn : step.en}
                </p>
              </div>
            </div>
          );
        })}
        {status === "cancelled" && (
          <div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 text-rose-700 rounded-lg text-xs font-bold">
            <Ban className="w-3 h-3" /> {t("অর্ডার বাতিল", "Order cancelled")}
          </div>
        )}
        {status === "refunded" && (
          <div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 text-orange-700 rounded-lg text-xs font-bold">
            <RotateCcw className="w-3 h-3" /> {t("রিফান্ডেড", "Refunded")}
          </div>
        )}
      </div>

      {/* Next-action buttons */}
      {transitions.length === 0 ? (
        <div className={`text-[11px] text-gray-400 text-center py-2 italic ${locale === "bn" ? "font-bn" : ""}`}>
          {t("আর কোনো পরিবর্তন সম্ভব নয়", "No further transitions available")}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {transitions.map((act) => (
            <ActionBtn
              key={act.kind}
              kind={act.kind}
              disabled={busy}
              onClick={() => onRequest(act.kind)}
              locale={locale}
              t={t}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function getAvailableTransitions(status: string): { kind: Transition }[] {
  switch (status) {
    case "pending":    return [{ kind: "confirm" }, { kind: "cancel" }];
    case "confirmed":  return [{ kind: "process" }, { kind: "fulfill" }, { kind: "cancel" }];
    case "processing": return [{ kind: "fulfill" }, { kind: "cancel" }];
    case "fulfilled":  return [{ kind: "refund" }];
    default: return [];
  }
}

const ACTION_META: Record<Transition, { bn: string; en: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  confirm:   { bn: "অর্ডার কনফার্ম",      en: "Confirm order",     icon: Check,      color: "bg-blue-600 hover:bg-blue-700 text-white" },
  process:   { bn: "প্রসেসিং শুরু",         en: "Start processing",  icon: Play,       color: "bg-violet-600 hover:bg-violet-700 text-white" },
  fulfill:   { bn: "ফুলফিল্ড মার্ক করুন",   en: "Mark fulfilled",    icon: Package,    color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
  cancel:    { bn: "অর্ডার বাতিল",          en: "Cancel order",      icon: XIcon,      color: "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200" },
  refund:    { bn: "রিফান্ড",                en: "Refund order",      icon: RotateCcw,  color: "bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200" },
  mark_paid: { bn: "COD পেমেন্ট সংগ্রহ",     en: "Mark COD paid",     icon: CreditCard, color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
};

function ActionBtn({
  kind, onClick, disabled, locale, t,
}: {
  kind: Transition;
  onClick: () => void;
  disabled: boolean;
  locale: string;
  t: (bn: string, en: string) => string;
}) {
  const meta = ACTION_META[kind];
  const Icon = meta.icon;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition disabled:opacity-50 ${meta.color} ${locale === "bn" ? "font-bn" : ""}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {locale === "bn" ? meta.bn : meta.en}
    </button>
  );
}

/* ─── Payment ─── */

function PaymentCard({
  method, paymentStatus, transactionId, total, paidAmount, dueAmount, canMarkPaid, onMarkPaid, busy, locale, t, onCopy,
}: {
  method?: string;
  paymentStatus?: string;
  transactionId?: string;
  total: number;
  paidAmount: number;
  dueAmount: number;
  canMarkPaid: boolean;
  onMarkPaid: () => void;
  busy: boolean;
  locale: string;
  t: (bn: string, en: string) => string;
  onCopy: (v: string, label: string) => void;
}) {
  const isPaid = paymentStatus === "success";
  return (
    <Card>
      <SectionTitle icon={<CreditCard className="w-3.5 h-3.5" />} locale={locale} t={t} bn="পেমেন্ট" en="Payment" />

      <div className="flex items-center flex-wrap gap-1.5 mb-3">
        {method ? (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
            method === "cod"   ? "bg-amber-100 text-amber-800" :
            method === "bkash" ? "bg-pink-100 text-pink-800" :
            method === "nagad" ? "bg-orange-100 text-orange-800" :
            method === "free"  ? "bg-sky-100 text-sky-800" :
                                 "bg-gray-100 text-gray-700"
          }`}>
            {method}
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
          isPaid ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? "bg-emerald-600" : "bg-gray-400"}`} />
          {isPaid ? t("পেইড", "Paid") : t("আনপেইড", "Unpaid")}
        </span>
      </div>

      {transactionId && (
        <button
          onClick={() => onCopy(transactionId, t("ট্রানজ্যাকশন আইডি", "Transaction ID"))}
          className="w-full text-left mb-3 flex items-center justify-between gap-2 text-[11px] bg-gray-50 hover:bg-gray-100 rounded-lg px-2.5 py-1.5 font-mono transition-colors"
        >
          <span className="truncate text-gray-700">{transactionId}</span>
          <Copy className="w-3 h-3 text-gray-400 shrink-0" />
        </button>
      )}

      <div className={`space-y-1 ${locale === "bn" ? "font-bn" : ""}`}>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">{t("মোট", "Total")}</span>
          <span className="font-bold text-gray-800 tabular-nums">৳{formatAmount(total, locale)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">{t("পেইড", "Paid")}</span>
          <span className={`font-bold tabular-nums ${isPaid ? "text-emerald-600" : "text-gray-400"}`}>৳{formatAmount(paidAmount, locale)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">{t("বাকি", "Due")}</span>
          <span className={`font-bold tabular-nums ${dueAmount > 0 ? "text-rose-600" : "text-gray-400"}`}>৳{formatAmount(dueAmount, locale)}</span>
        </div>
      </div>

      {canMarkPaid && (
        <button
          onClick={onMarkPaid}
          disabled={busy}
          className={`mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 ${locale === "bn" ? "font-bn" : ""}`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          {t("COD পেমেন্ট সংগ্রহ হয়েছে", "Mark COD as paid")}
        </button>
      )}
    </Card>
  );
}

/* ─── Fraud ─── */

function FraudCard({
  score, flags, isGuest, locale, t,
}: {
  score?: number | null;
  flags: string[];
  isGuest: boolean;
  locale: string;
  t: (bn: string, en: string) => string;
}) {
  const tone = useMemo(() => {
    if (score == null) return { bar: "bg-gray-300", fg: "text-gray-700", bg: "bg-gray-50", label: t("অপ্রযোজ্য", "N/A") };
    if (score >= 60) return { bar: "bg-rose-500",    fg: "text-rose-700",    bg: "bg-rose-50",    label: t("হাই রিস্ক",    "High risk") };
    if (score >= 30) return { bar: "bg-amber-500",   fg: "text-amber-800",   bg: "bg-amber-50",   label: t("মিডিয়াম রিস্ক", "Medium risk") };
    return              { bar: "bg-emerald-500", fg: "text-emerald-700", bg: "bg-emerald-50", label: t("লো রিস্ক",    "Low risk") };
  }, [score, t]);

  return (
    <Card>
      <SectionTitle icon={<ShieldAlert className="w-3.5 h-3.5" />} locale={locale} t={t} bn="ফ্রড রিস্ক" en="Fraud risk" />

      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm font-bold ${tone.fg} ${locale === "bn" ? "font-bn" : ""}`}>{tone.label}</span>
        {score != null && (
          <span className="text-xs text-gray-500 tabular-nums">
            <span className={`font-bold font-mono ${tone.fg}`}>{score}</span>
            <span className="text-gray-400"> / 100</span>
          </span>
        )}
      </div>

      {score != null && (
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
          <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
        </div>
      )}

      {isGuest && (
        <div className={`mb-3 text-[11px] bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 inline-flex items-center gap-1.5 text-gray-600 ${locale === "bn" ? "font-bn" : ""}`}>
          <User className="w-3 h-3" />
          {t("গেস্ট চেকআউট", "Guest checkout")}
        </div>
      )}

      {flags.length > 0 && (
        <div>
          <p className={`text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1.5 ${locale === "bn" ? "font-bn" : ""}`}>
            {t("ফ্ল্যাগ", "Flags")} ({flags.length})
          </p>
          <div className="space-y-1.5">
            {flags.map((flag, i) => {
              const info = getFlagInfo(flag);
              const style = SEVERITY_STYLE[info.severity];
              return (
                <div
                  key={i}
                  className={`flex items-start gap-2 p-2 rounded-lg ${style.bg}`}
                  title={locale === "bn" ? info.description.bn : info.description.en}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${style.dot} mt-1.5 shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold ${style.fg} ${locale === "bn" ? "font-bn" : ""}`}>
                      {locale === "bn" ? info.label.bn : info.label.en}
                    </p>
                    <p className={`text-[10px] text-gray-500 leading-snug mt-0.5 ${locale === "bn" ? "font-bn" : ""}`}>
                      {locale === "bn" ? info.description.bn : info.description.en}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {flags.length === 0 && score != null && score < 30 && (
        <p className={`text-[11px] text-gray-500 italic ${locale === "bn" ? "font-bn" : ""}`}>
          {t("কোনো সন্দেহজনক প্যাটার্ন নেই।", "No suspicious patterns detected.")}
        </p>
      )}
    </Card>
  );
}

/* ─── Shipment (optional) ─── */

function ShipmentCard({
  status, tracking, courier, locale, t, onCopy,
}: {
  status: string | null;
  tracking: string | null;
  courier: string | null;
  locale: string;
  t: (bn: string, en: string) => string;
  onCopy: (v: string, label: string) => void;
}) {
  return (
    <Card>
      <SectionTitle icon={<Truck className="w-3.5 h-3.5" />} locale={locale} t={t} bn="শিপমেন্ট" en="Shipment" />
      {status && (
        <p className={`text-sm font-bold text-gray-800 mb-2 capitalize ${locale === "bn" ? "font-bn" : ""}`}>{status}</p>
      )}
      {courier && (
        <p className="text-xs text-gray-500 mb-2 inline-flex items-center gap-1">
          <ArrowUpRight className="w-3 h-3" /> {courier}
        </p>
      )}
      {tracking && (
        <button
          onClick={() => onCopy(tracking, t("ট্র্যাকিং", "Tracking"))}
          className="w-full flex items-center justify-between gap-2 text-[11px] bg-gray-50 hover:bg-gray-100 rounded-lg px-2.5 py-1.5 font-mono transition-colors"
        >
          <span className="truncate text-gray-700">{tracking}</span>
          <Copy className="w-3 h-3 text-gray-400 shrink-0" />
        </button>
      )}
    </Card>
  );
}

/* ─── Primitives ─── */

function Card({ children, padded = true }: { children: React.ReactNode; padded?: boolean }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm ${padded ? "p-4" : ""}`}>
      {children}
    </div>
  );
}

function SectionTitle({
  icon, locale, t, bn, en, noMargin,
}: {
  icon: React.ReactNode;
  locale: string;
  t: (bn: string, en: string) => string;
  bn: string;
  en: string;
  noMargin?: boolean;
}) {
  return (
    <div className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#7c2df7] ${noMargin ? "" : "mb-3"} ${locale === "bn" ? "font-bn" : ""}`}>
      {icon}
      {t(bn, en)}
    </div>
  );
}

/* ─── Copy / number helpers ─── */

function toNum(v: string | number | undefined | null): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : parseFloat(v) || 0;
}

function formatAmount(v: string | number | undefined | null, locale: string): string {
  const n = toNum(v);
  return Math.round(n).toLocaleString(locale === "bn" ? "bn-BD" : "en-US");
}

function pendingTitle(kind: Transition | undefined, num: string, t: (bn: string, en: string) => string): string {
  switch (kind) {
    case "confirm":   return t("অর্ডার কনফার্ম করবেন?", "Confirm this order?");
    case "process":   return t("প্রসেসিং শুরু করবেন?", "Start processing?");
    case "fulfill":   return t("ফুলফিল্ড হিসেবে চিহ্নিত?", "Mark as fulfilled?");
    case "cancel":    return t("অর্ডার বাতিল করবেন?", "Cancel this order?");
    case "refund":    return t("অর্ডার রিফান্ড করবেন?", "Refund this order?");
    case "mark_paid": return t("পেমেন্ট কনফার্ম করবেন?", "Confirm payment received?");
    default: return "";
  }
}

function pendingBody(kind: Transition | undefined, num: string, t: (bn: string, en: string) => string): string {
  switch (kind) {
    case "confirm":   return t(`অর্ডার #${num} কনফার্ম করা হবে এবং ক্রেতা ডিজিটাল প্রোডাক্ট অ্যাক্সেস পাবেন।`, `Order #${num} will be confirmed and the customer will get access to any digital products.`);
    case "process":   return t(`অর্ডার #${num} প্রসেসিং স্টেটে যাবে।`, `Order #${num} will move to processing.`);
    case "fulfill":   return t(`অর্ডার #${num} ফুলফিল্ড হিসেবে চিহ্নিত হবে। এটি চূড়ান্ত ধাপ।`, `Order #${num} will be marked as fulfilled. This is the final step.`);
    case "cancel":    return t(`অর্ডার #${num} বাতিল করা হবে। কোনো এনটাইটেলমেন্ট প্রদান করা হবে না।`, `Order #${num} will be cancelled. No entitlements will be granted.`);
    case "refund":    return t(`অর্ডার #${num} রিফান্ডেড হিসেবে চিহ্নিত হবে।`, `Order #${num} will be marked as refunded.`);
    case "mark_paid": return t(`অর্ডার #${num} এর COD পেমেন্ট সংগ্রহ হয়েছে হিসেবে চিহ্নিত হবে।`, `The COD payment for order #${num} will be marked as received.`);
    default: return "";
  }
}

function pendingConfirmLabel(kind: Transition | undefined, t: (bn: string, en: string) => string): string {
  switch (kind) {
    case "confirm":   return t("কনফার্ম", "Confirm");
    case "process":   return t("প্রসেসিং", "Start");
    case "fulfill":   return t("ফুলফিল্ড", "Mark fulfilled");
    case "cancel":    return t("বাতিল করুন", "Cancel order");
    case "refund":    return t("রিফান্ড", "Refund");
    case "mark_paid": return t("পেমেন্ট কনফার্ম", "Mark paid");
    default: return t("নিশ্চিত করুন", "Confirm");
  }
}

function transitionToast(kind: Transition, t: (bn: string, en: string) => string): string {
  switch (kind) {
    case "confirm":   return t("অর্ডার কনফার্মড", "Order confirmed");
    case "process":   return t("প্রসেসিং শুরু", "Processing started");
    case "fulfill":   return t("অর্ডার ফুলফিল্ড", "Order fulfilled");
    case "cancel":    return t("অর্ডার বাতিল", "Order cancelled");
    case "refund":    return t("রিফান্ডেড", "Refunded");
    case "mark_paid": return t("পেমেন্ট কনফার্ম", "Payment confirmed");
  }
}
