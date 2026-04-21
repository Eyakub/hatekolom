"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Package, Clock, CheckCircle2, XCircle,
  Loader2, ShoppingBag, ChevronRight, CreditCard, Truck,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";

interface OrderItem {
  id: string;
  product_title: string;
  product_type: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Payment {
  id: string;
  payment_method: string;
  status: string;
  amount: number;
  transaction_id: string | null;
}

interface Shipment {
  id: string;
  status: string;
  courier_name: string | null;
  tracking_number: string | null;
  estimated_delivery: string | null;
  actual_delivery: string | null;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  subtotal: number;
  discount: number;
  shipping_fee: number;
  total: number;
  currency: string;
  coupon_code: string | null;
  items: OrderItem[];
  payment: Payment | null;
  shipment: Shipment | null;
  created_at: string;
  shipping_name: string | null;
  shipping_phone: string | null;
  shipping_address: string | null;
  shipping_city: string | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "পেন্ডিং", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  confirmed: { label: "কনফার্মড", color: "bg-blue-100 text-blue-700", icon: Package },
  processing: { label: "প্রসেসিং", color: "bg-purple-100 text-purple-700", icon: Package },
  shipped: { label: "শিপড", color: "bg-indigo-100 text-indigo-700", icon: Truck },
  delivered: { label: "ডেলিভারড", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  cancelled: { label: "বাতিল", color: "bg-red-100 text-red-700", icon: XCircle },
  refunded: { label: "রিফান্ড", color: "bg-gray-100 text-gray-700", icon: XCircle },
};

export default function OrdersPage() {
  const router = useRouter();
  const { isAuthenticated, accessToken, _hasHydrated } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) { router.push("/login"); return; }
    const load = async () => {
      try {
        const data: any = await api.get("/orders/my", accessToken!);
        setOrders(Array.isArray(data) ? data : []);
      } catch {}
      setLoading(false);
    };
    load();
  }, [isAuthenticated, accessToken]);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 text-primary-600 animate-spin" /></div>;
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 font-bn">আমার অর্ডার সমূহ</h1>
        <p className="text-sm text-gray-400 font-bn mt-1">{orders.length} টি অর্ডার</p>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
          <ShoppingBag className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-400 font-bn">কোনো অর্ডার নেই</h3>
          <p className="text-sm text-gray-400 font-bn mt-1">কোর্স বা ই-বুক কিনলে এখানে দেখা যাবে</p>
          <Link href="/courses" className="mt-4 inline-flex items-center gap-2 px-6 py-2.5 bg-primary-700 text-white font-semibold rounded-full text-sm hover:bg-primary-800 transition-all font-bn">
            কোর্স দেখো <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const status = statusConfig[order.status] || statusConfig.pending;
            const StatusIcon = status.icon;
            const isExpanded = expandedOrder === order.id;
            return (
              <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button onClick={() => setExpandedOrder(isExpanded ? null : order.id)} className="w-full p-5 flex items-center gap-4 hover:bg-gray-50/50 transition-colors text-left">
                  <div className={`w-10 h-10 rounded-xl ${status.color} flex items-center justify-center shrink-0`}><StatusIcon className="w-5 h-5" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-900">#{order.order_number}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${status.color}`}>{status.label}</span>
                    </div>
                    <p className="text-xs text-gray-700 mt-1 font-bn truncate">
                      {order.items.map(i => i.product_title).join(", ")}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {new Date(order.created_at).toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-primary-700">৳{order.total}</p>
                    <ChevronRight className={`w-4 h-4 text-gray-300 mx-auto mt-1 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 pb-5">
                    <div className="py-4 space-y-2">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center"><Package className="w-3.5 h-3.5 text-primary-600" /></div>
                            <span className="text-gray-700 font-bn">{item.product_title}</span>
                            <span className="text-xs text-gray-400">× {item.quantity}</span>
                          </div>
                          <span className="font-semibold text-gray-900">৳{item.total_price}</span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-gray-100 pt-3 space-y-1.5 text-sm">
                      <div className="flex justify-between text-gray-500 font-bn"><span>সাবটোটাল</span><span>৳{order.subtotal}</span></div>
                      {order.discount > 0 && <div className="flex justify-between text-green-600 font-bn"><span>ডিসকাউন্ট {order.coupon_code && `(${order.coupon_code})`}</span><span>-৳{order.discount}</span></div>}
                      {order.shipping_fee > 0 && <div className="flex justify-between text-gray-500 font-bn"><span>শিপিং</span><span>৳{order.shipping_fee}</span></div>}
                      <div className="flex justify-between font-bold text-gray-900 pt-1.5 border-t border-gray-100 font-bn"><span>মোট</span><span>৳{order.total}</span></div>
                    </div>
                    {order.payment && (
                      <div className="mt-3 p-3 rounded-xl bg-gray-50 flex items-center gap-3">
                        <CreditCard className="w-4 h-4 text-gray-400" />
                        <div className="text-xs">
                          <span className="font-semibold text-gray-700 uppercase">{order.payment.payment_method}</span>
                          <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold ${order.payment.status === "completed" ? "bg-green-100 text-green-700" : order.payment.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>{order.payment.status}</span>
                          {order.payment.transaction_id && <span className="ml-2 text-gray-400">TXN: {order.payment.transaction_id}</span>}
                        </div>
                      </div>
                    )}
                    {order.shipping_name && (
                      <div className="mt-3 p-3 rounded-xl bg-gray-50 flex items-center gap-3">
                        <Truck className="w-4 h-4 text-gray-400" />
                        <div className="text-xs text-gray-600">
                          <span className="font-semibold">{order.shipping_name}</span>
                          {order.shipping_phone && <span className="ml-2">{order.shipping_phone}</span>}
                          {order.shipping_address && <p className="mt-0.5">{order.shipping_address}{order.shipping_city && `, ${order.shipping_city}`}</p>}
                        </div>
                      </div>
                    )}
                    {order.shipment && (
                      <div className="mt-3 p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100">
                        <div className="flex items-center gap-2 mb-2">
                          <Package className="w-4 h-4 text-indigo-600" />
                          <span className="text-sm font-bold text-indigo-800 font-bn">শিপমেন্ট ট্র্যাকিং</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              order.shipment.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                              order.shipment.status === "confirmed" ? "bg-blue-100 text-blue-700" :
                              order.shipment.status === "dispatched" ? "bg-purple-100 text-purple-700" :
                              order.shipment.status === "delivered" ? "bg-green-100 text-green-700" :
                              "bg-gray-100 text-gray-700"
                            }`}>
                              {order.shipment.status === "pending" ? "প্রস্তুত হচ্ছে" :
                               order.shipment.status === "confirmed" ? "কনফার্মড" :
                               order.shipment.status === "dispatched" ? "পাঠানো হয়েছে" :
                               order.shipment.status === "delivered" ? "ডেলিভারড" :
                               order.shipment.status === "returned" ? "ফেরত" :
                               order.shipment.status === "cancelled" ? "বাতিল" : order.shipment.status}
                            </span>
                          </div>
                          {order.shipment.courier_name && (
                            <p className="text-xs text-gray-600 font-bn">
                              কুরিয়ার: <span className="font-semibold">{order.shipment.courier_name}</span>
                            </p>
                          )}
                          {order.shipment.tracking_number && (
                            <p className="text-xs text-gray-600 font-bn">
                              ট্র্যাকিং নম্বর: <span className="font-mono font-semibold">{order.shipment.tracking_number}</span>
                            </p>
                          )}
                          {order.shipment.estimated_delivery && (
                            <p className="text-xs text-gray-500 font-bn">
                              আনুমানিক ডেলিভারি: {new Date(order.shipment.estimated_delivery).toLocaleDateString("bn-BD")}
                            </p>
                          )}
                          {order.shipment.actual_delivery && (
                            <p className="text-xs text-green-600 font-bn font-semibold">
                              ডেলিভারি হয়েছে: {new Date(order.shipment.actual_delivery).toLocaleDateString("bn-BD")}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
