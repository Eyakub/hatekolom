"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Printer, ArrowLeft, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useSiteStore } from "@/stores/site-store";

type Item = {
  id: string;
  product_title: string;
  quantity: number;
  unit_price: string;
  total_price: string;
};

type Detail = {
  order: {
    id: string;
    order_number: string;
    status: string;
    subtotal: string;
    discount: string;
    shipping_fee: string;
    total: string;
    currency: string;
    notes?: string | null;
    shipping_name?: string | null;
    shipping_phone?: string | null;
    shipping_address?: string | null;
    shipping_area?: string | null;
    shipping_city?: string | null;
    created_at: string;
  };
  customer: {
    id: string | null;
    name: string;
    phone: string | null;
    email: string | null;
  };
  items: Item[];
  payment: {
    status?: string;
    method?: string;
    tran_id?: string;
    amount?: string;
  } | null;
};

export default function OrderInvoicePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken, isAuthenticated } = useAuthStore();
  const { settings, fetchSettings } = useSiteStore();

  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      router.replace(`/login?redirect=/admin/orders/${params.id}/invoice`);
      return;
    }
    (async () => {
      try {
        const data = await api.get<Detail>(`/admin/orders/${params.id}/detail`, accessToken);
        setDetail(data);
      } catch (e: any) {
        setError(e?.message || "Failed to load order");
      } finally {
        setLoading(false);
      }
    })();
    fetchSettings().catch(() => {});
  }, [params.id, accessToken, isAuthenticated, router, fetchSettings]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-3 p-6">
        <p className="text-sm text-gray-700">{error || "Order not found"}</p>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>
    );
  }

  const { order, customer, items, payment } = detail;
  const d = new Date(order.created_at);
  const subtotal = toNum(order.subtotal);
  const shipping = toNum(order.shipping_fee);
  const discount = toNum(order.discount);
  const total = toNum(order.total);
  const isPaid = payment?.status === "success";
  const paid = isPaid ? total : 0;
  const due = total - paid;
  const shipsToAddress = !!order.shipping_address;

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Action bar (hidden in print) */}
      <div className="print:hidden bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-black"
          >
            <Printer className="w-4 h-4" /> Print invoice
          </button>
        </div>
      </div>

      {/* Invoice sheet */}
      <div className="max-w-3xl mx-auto my-6 print:my-0 bg-white shadow-sm print:shadow-none p-10 print:p-8 text-gray-900 print:text-black font-sans invoice-sheet">
        {/* Header: company + invoice meta */}
        <header className="flex items-start justify-between gap-4 pb-5 border-b border-gray-300 print:border-black">
          <div>
            <h1 className="text-2xl font-bold tracking-tight uppercase">{settings.platform_name}</h1>
            {settings.office_address && (
              <p className="text-xs text-gray-700 mt-0.5">{settings.office_address}</p>
            )}
            <p className="text-xs text-gray-700">
              {settings.support_phone && <>Phone: {settings.support_phone}</>}
              {settings.support_email && <> · {settings.support_email}</>}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Invoice</p>
            <p className="font-mono text-base font-bold mt-0.5">#{order.order_number}</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
          </div>
        </header>

        {/* Bill to / Ship to */}
        <section className="grid grid-cols-2 gap-6 py-5 border-b border-gray-300 print:border-black">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-1">Bill to</p>
            <p className="text-sm font-bold">{customer.name}</p>
            {customer.phone && <p className="text-xs text-gray-700 mt-0.5">{customer.phone}</p>}
            {customer.email && <p className="text-xs text-gray-700">{customer.email}</p>}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-1">Ship to</p>
            {shipsToAddress ? (
              <>
                <p className="text-sm font-bold">{order.shipping_name || customer.name}</p>
                {order.shipping_phone && <p className="text-xs text-gray-700 mt-0.5">{order.shipping_phone}</p>}
                <p className="text-xs text-gray-700 leading-relaxed mt-0.5">
                  {[order.shipping_address, order.shipping_area, order.shipping_city].filter(Boolean).join(", ")}
                </p>
              </>
            ) : (
              <p className="text-xs text-gray-700 italic">Digital delivery (no shipping)</p>
            )}
          </div>
        </section>

        {/* Items table */}
        <section className="py-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500 border-b border-gray-400 print:border-black">
                <th className="pb-2 text-left w-8">#</th>
                <th className="pb-2 text-left">Description</th>
                <th className="pb-2 text-center w-14">Qty</th>
                <th className="pb-2 text-right w-24">Unit</th>
                <th className="pb-2 text-right w-28">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id} className="border-b border-gray-200 print:border-gray-400">
                  <td className="py-2.5 text-xs text-gray-500 tabular-nums align-top">{i + 1}</td>
                  <td className="py-2.5 text-sm align-top">{it.product_title}</td>
                  <td className="py-2.5 text-center text-sm tabular-nums align-top">{it.quantity}</td>
                  <td className="py-2.5 text-right text-sm tabular-nums align-top">৳{fmt(it.unit_price)}</td>
                  <td className="py-2.5 text-right text-sm font-semibold tabular-nums align-top">৳{fmt(it.total_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Totals */}
        <section className="flex justify-end">
          <div className="w-72 text-sm">
            <Row label="Subtotal" value={`৳${fmt(subtotal)}`} />
            <Row label="Shipping" value={`৳${fmt(shipping)}`} />
            {discount > 0 && <Row label="Discount" value={`− ৳${fmt(discount)}`} />}
            <div className="flex justify-between items-center py-2.5 mt-1 border-t-2 border-b-2 border-gray-800 print:border-black">
              <span className="text-sm font-bold uppercase tracking-wider">Total</span>
              <span className="text-lg font-bold tabular-nums">৳{fmt(total)}</span>
            </div>
          </div>
        </section>

        {/* Payment summary */}
        <section className="mt-5 pt-4 border-t border-gray-300 print:border-black grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-1">Method</p>
            <p className="font-semibold uppercase">{payment?.method || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-1">Status</p>
            <p className="font-semibold uppercase">{isPaid ? "Paid" : "Unpaid"}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-1">Due</p>
            <p className={`font-bold tabular-nums ${due > 0 ? "" : ""}`}>৳{fmt(due)}</p>
          </div>
        </section>

        {payment?.tran_id && (
          <p className="text-[11px] text-gray-600 font-mono mt-2">Txn: {payment.tran_id}</p>
        )}

        {order.notes && (
          <section className="mt-5 pt-4 border-t border-gray-200">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-1">Notes</p>
            <p className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap">{order.notes}</p>
          </section>
        )}

        {/* Footer */}
        <footer className="mt-8 pt-4 border-t border-gray-300 print:border-black text-center">
          <p className="text-sm font-semibold">Thank you for your order.</p>
          <p className="text-[11px] text-gray-600 mt-0.5">
            For queries please contact {settings.support_phone || "us"}
            {settings.support_email ? ` or ${settings.support_email}` : ""}.
          </p>
        </footer>
      </div>

      {/* Print-only tweaks */}
      <style jsx global>{`
        @page {
          size: A4;
          margin: 0;
        }
        @media print {
          html, body {
            background: white !important;
            margin: 0 !important;
          }
          body {
            padding: 14mm !important;
          }
          .invoice-sheet {
            box-shadow: none !important;
            border: none !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          * {
            -webkit-print-color-adjust: economy;
            print-color-adjust: economy;
          }
        }
      `}</style>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1 text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function toNum(v: string | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : parseFloat(v) || 0;
}

function fmt(v: string | number | null | undefined): string {
  const n = toNum(v);
  return Math.round(n).toLocaleString("en-US");
}
