"use client";

import {  useState, useEffect, useCallback , Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Users, BookOpen, ShoppingBag, Truck,
  Settings, ChevronRight, Loader2, Plus, Eye, Ban, UserCheck,
  Edit3, Trash2, ToggleLeft, ToggleRight, Star, Tag, X, Download, Check,
  GraduationCap, LogOut, Home, MessageCircle, BarChart3, Image, Sparkles, Shield, Gamepad2, Calculator, Award, Target,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useLocaleStore } from "@/stores/locale-store";
import { api } from "@/lib/api";
import { ExamAttachment } from "@/components/admin/ExamAttachment";
import { SuperAdminDashboard } from "@/components/admin/dashboard/SuperAdminDashboard";
import { DailyRiskTrendChart } from "@/components/admin/fraud/DailyRiskTrendChart";
import { HighRiskOrdersCard } from "@/components/admin/fraud/HighRiskOrdersCard";
import { getFlagInfo, SEVERITY_STYLE } from "@/components/admin/fraud/flagLabels";
import { ShopProductsPanel } from "@/components/admin/shop/ShopProductsPanel";
import { CoursesPanel } from "@/components/admin/courses/CoursesPanel";
import { ExamsPanel } from "@/components/admin/exams/ExamsPanel";
import { EbooksPanel } from "@/components/admin/ebooks/EbooksPanel";
import { OrdersPanel } from "@/components/admin/orders/OrdersPanel";
import { OrderDetailModal } from "@/components/admin/orders/OrderDetailModal";

type Tab = "dashboard" | "users" | "courses" | "orders" | "shipments" | "coupons" | "ebooks" | "physical-items" | "homepage" | "settings" | "instructors" | "exams" | "fraud-config" | "fraud-dashboard" | "games" | "abacus" | "badges" | "gallery" | "challenges";
const validTabs: Tab[] = ["dashboard", "users", "courses", "orders", "shipments", "coupons", "ebooks", "physical-items", "homepage", "settings", "instructors", "exams", "fraud-config", "fraud-dashboard", "games", "abacus", "badges", "gallery", "challenges"];

function FraudBadge({ score, isGuest }: { score?: number | null; isGuest?: boolean }) {
  if (score == null && !isGuest) return null;
  const level = score != null ? (score >= 60 ? "high" : score >= 30 ? "medium" : "low") : null;
  const colors = { low: "bg-green-100 text-green-700", medium: "bg-amber-100 text-amber-700", high: "bg-red-100 text-red-700" };
  return (
    <div className="flex items-center gap-1.5">
      {isGuest && <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-100 text-gray-500">Guest</span>}
      {level && <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${colors[level]}`}>{level === "high" ? "High Risk" : level === "medium" ? "Medium" : "Low"} ({score})</span>}
    </div>
  );
}

/* ─── Fraud Config Tab ─── */
const FRAUD_CONFIG_FIELDS = {
  "Rate Limits": {
    bn: "রেট লিমিট",
    fields: [
      { key: "phone_rate_window_hours", bn: "ফোন রেট উইন্ডো (ঘন্টা)", en: "Phone Rate Window (hours)" },
      { key: "phone_rate_max_orders", bn: "ফোন সর্বোচ্চ অর্ডার", en: "Phone Max Orders" },
      { key: "phone_rate_score", bn: "ফোন রেট স্কোর", en: "Phone Rate Score" },
      { key: "ip_rate_window_hours", bn: "IP রেট উইন্ডো (ঘন্টা)", en: "IP Rate Window (hours)" },
      { key: "ip_rate_max_orders", bn: "IP সর্বোচ্চ অর্ডার", en: "IP Max Orders" },
      { key: "ip_rate_score", bn: "IP রেট স্কোর", en: "IP Rate Score" },
      { key: "fingerprint_rate_window_hours", bn: "ফিঙ্গারপ্রিন্ট রেট উইন্ডো (ঘন্টা)", en: "Fingerprint Rate Window (hours)" },
      { key: "fingerprint_rate_max_orders", bn: "ফিঙ্গারপ্রিন্ট সর্বোচ্চ অর্ডার", en: "Fingerprint Max Orders" },
      { key: "fingerprint_rate_score", bn: "ফিঙ্গারপ্রিন্ট রেট স্কোর", en: "Fingerprint Rate Score" },
    ],
  },
  "Address & Quantity": {
    bn: "ঠিকানা ও পরিমাণ",
    fields: [
      { key: "min_address_length", bn: "সর্বনিম্ন ঠিকানা দৈর্ঘ্য", en: "Min Address Length" },
      { key: "address_quality_score", bn: "ঠিকানা কোয়ালিটি স্কোর", en: "Address Quality Score" },
      { key: "max_single_item_qty", bn: "সর্বোচ্চ একক আইটেম পরিমাণ", en: "Max Single Item Qty" },
      { key: "max_total_items", bn: "সর্বোচ্চ মোট আইটেম", en: "Max Total Items" },
      { key: "quantity_spike_score", bn: "পরিমাণ স্পাইক স্কোর", en: "Quantity Spike Score" },
    ],
  },
  "Score Points": {
    bn: "স্কোর পয়েন্ট",
    fields: [
      { key: "phone_format_score", bn: "ফোন ফরম্যাট স্কোর", en: "Phone Format Score" },
      { key: "vpn_proxy_score", bn: "VPN/প্রক্সি স্কোর", en: "VPN/Proxy Score" },
      { key: "blacklist_score", bn: "ব্ল্যাকলিস্ট স্কোর", en: "Blacklist Score" },
      { key: "prepaid_discount_score", bn: "প্রিপেইড ডিসকাউন্ট স্কোর", en: "Prepaid Discount Score" },
    ],
  },
  "Risk Thresholds": {
    bn: "রিস্ক থ্রেশহোল্ড",
    fields: [
      { key: "medium_risk_threshold", bn: "মিডিয়াম রিস্ক থ্রেশহোল্ড", en: "Medium Risk Threshold" },
      { key: "high_risk_threshold", bn: "হাই রিস্ক থ্রেশহোল্ড", en: "High Risk Threshold" },
      { key: "max_cart_value", bn: "সর্বোচ্চ কার্ট ভ্যালু", en: "Max Cart Value" },
    ],
  },
};

function FraudConfigTab({ accessToken }: { accessToken: string }) {
  const { t } = useLocaleStore();
  const [config, setConfig] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data: any = await api.get("/admin/fraud-config", accessToken);
        setConfig(data || {});
        if (data?.updated_at) setLastUpdated(data.updated_at);
      } catch (err: any) {
        import("@/stores/toast-store").then((m) => m.toast.error(err?.message || "Failed to load fraud config"));
      } finally {
        setLoading(false);
      }
    })();
  }, [accessToken]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...config };
      delete payload.id;
      delete payload.created_at;
      delete payload.updated_at;
      const data: any = await api.patch("/admin/fraud-config", payload, accessToken);
      if (data?.updated_at) setLastUpdated(data.updated_at);
      import("@/stores/toast-store").then((m) => m.toast.success(t("ফ্রড কনফিগ সেভ হয়েছে", "Fraud config saved")));
    } catch (err: any) {
      import("@/stores/toast-store").then((m) => m.toast.error(err?.message || "Failed to save"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-primary-600" />
          <h1 className="text-xl font-bold">{t("ফ্রড কনফিগারেশন", "Fraud Configuration")}</h1>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400">
              {t("সর্বশেষ আপডেট:", "Last updated:")} {new Date(lastUpdated).toLocaleString("en-GB")}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 transition-all disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("সেভ করুন", "Save Config")}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Hard Block Toggles */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            {t("হার্ড ব্লকিং", "Hard Blocking")}
          </h3>
          <p className="text-xs text-gray-400 mb-4">{t("চালু থাকলে, লিমিট অতিক্রম করলে অর্ডার সরাসরি ব্লক হবে। বন্ধ থাকলে শুধু স্কোরে যুক্ত হবে।", "When enabled, orders exceeding limits are blocked. When disabled, they only add to the fraud score.")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { key: "block_phone_enabled", bn: "ফোন ব্লক", en: "Phone Block" },
              { key: "block_ip_enabled", bn: "IP ব্লক", en: "IP Block" },
              { key: "block_fingerprint_enabled", bn: "ডিভাইস ব্লক", en: "Device Block" },
            ].map((toggle) => (
              <button
                key={toggle.key}
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, [toggle.key]: !prev[toggle.key] }))}
                className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                  config[toggle.key] ? "border-green-400 bg-green-50" : "border-gray-200 bg-gray-50"
                }`}
              >
                <span className="text-sm font-semibold text-gray-800">{t(toggle.bn, toggle.en)}</span>
                <div className={`w-10 h-6 rounded-full transition-all relative ${config[toggle.key] ? "bg-green-500" : "bg-gray-300"}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${config[toggle.key] ? "left-5" : "left-1"}`} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {Object.entries(FRAUD_CONFIG_FIELDS).map(([groupName, group]) => (
          <div key={groupName} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
              {t(group.bn, groupName)}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.fields.map((field) => (
                <div key={field.key}>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">
                    {t(field.bn, field.en)}
                  </label>
                  <input
                    type="number"
                    value={config[field.key] ?? ""}
                    onChange={(e) => setConfig((prev) => ({ ...prev, [field.key]: e.target.value === "" ? "" : Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-100 transition-all font-mono"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Fraud Dashboard Tab ─── */
function FraudDashboardTab({ accessToken }: { accessToken: string }) {
  const { t, locale } = useLocaleStore();
  const searchParams = useSearchParams();
  const initialDays = (() => {
    const q = parseInt(searchParams?.get("days") || "", 10);
    return [1, 7, 30, 90].includes(q) ? q : 30;
  })();
  const [days, setDays] = useState(initialDays);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const fetchData = useCallback(async (d: number) => {
    setLoading(true);
    try {
      const res: any = await api.get(`/admin/fraud-dashboard?days=${d}`, accessToken);
      setData(res);
    } catch (err: any) {
      import("@/stores/toast-store").then((m) => m.toast.error(err?.message || "Failed to load dashboard"));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchData(days);
  }, [days, fetchData]);

  const periodOptions = [
    { value: 1, label: t("আজ", "Today") },
    { value: 7, label: t("৭ দিন", "7 Days") },
    { value: 30, label: t("৩০ দিন", "30 Days") },
    { value: 90, label: t("৯০ দিন", "90 Days") },
  ];

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  const summary = data?.summary || {};
  // Backend returns risk counts at the top level of `summary`, not in a
  // separate `risk_distribution` object. Map them here.
  const riskDist = {
    low: summary.low_risk || 0,
    medium: summary.medium_risk || 0,
    high: summary.high_risk || 0,
  };
  const totalRisk = riskDist.low + riskDist.medium + riskDist.high || 1;
  const topFlags = data?.top_flags || [];
  const offenders = data?.repeat_offenders || [];
  const suspiciousIps = data?.suspicious_ips || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-primary-600" />
          <h1 className="text-xl font-bold">{t("ফ্রড অ্যানালিটিক্স", "Fraud Analytics")}</h1>
        </div>
        <div className="flex gap-2">
          {periodOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                days === opt.value
                  ? "bg-primary-700 text-white border-primary-700"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        {[
          { label: t("মোট অর্ডার", "Total Orders"),   value: summary.total_orders ?? 0,                                 color: "text-primary-700", bg: "bg-primary-50" },
          { label: t("গেস্ট অর্ডার", "Guest Orders"),  value: summary.guest_orders ?? 0,                                 color: "text-gray-700",    bg: "bg-gray-50" },
          { label: t("হাই রিস্ক", "High Risk"),        value: summary.high_risk ?? 0,                                    color: "text-red-700",     bg: "bg-red-50" },
          { label: t("মাঝারি রিস্ক", "Medium Risk"),   value: summary.medium_risk ?? 0,                                  color: "text-amber-700",   bg: "bg-amber-50" },
          { label: t("কম রিস্ক", "Low Risk"),          value: summary.low_risk ?? 0,                                     color: "text-emerald-700", bg: "bg-emerald-50" },
          { label: t("VPN অর্ডার", "VPN Orders"),      value: summary.vpn_orders ?? 0,                                   color: "text-purple-700",  bg: "bg-purple-50" },
          { label: t("বাতিল হার", "Cancel Rate"),      value: `${(summary.cancelled_rate ?? 0).toFixed(1)}%`,            color: "text-orange-700",  bg: "bg-orange-50" },
          { label: t("রিটার্ন হার", "Return Rate"),    value: `${(summary.returned_rate ?? 0).toFixed(1)}%`,             color: "text-rose-700",    bg: "bg-rose-50" },
        ].map((card) => (
          <div key={card.label} className={`${card.bg} rounded-xl border border-gray-100 p-4`}>
            <p className={`text-[11px] font-semibold text-gray-500 mb-1 leading-tight ${locale === "bn" ? "font-bn" : ""}`}>{card.label}</p>
            <p className={`text-xl md:text-2xl font-bold tabular-nums ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Trend + Distribution — side-by-side on lg+ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <DailyRiskTrendChart data={data?.daily_trend || []} days={days} loading={loading} />

        {/* Risk Distribution — companion card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#7c2df7] mb-0.5">
            <Shield className="w-3.5 h-3.5" />
            <span className={locale === "bn" ? "font-bn" : ""}>{t("রিস্ক বিতরণ", "Risk Distribution")}</span>
          </div>
          <h3 className={`text-base font-bold text-gray-900 ${locale === "bn" ? "font-bn" : ""}`}>
            {riskDist.low + riskDist.medium + riskDist.high > 0
              ? t(`${riskDist.low + riskDist.medium + riskDist.high}টি স্কোরড অর্ডার`, `${riskDist.low + riskDist.medium + riskDist.high} scored orders`)
              : t("কোনো স্কোরড অর্ডার নেই", "No scored orders")}
          </h3>

          {/* Stacked bar */}
          <div className="mt-4 mb-3">
            <div className="flex rounded-full overflow-hidden h-3 bg-gray-100">
              {riskDist.low > 0 && <div className="bg-emerald-500" style={{ width: `${(riskDist.low / totalRisk) * 100}%` }} />}
              {riskDist.medium > 0 && <div className="bg-amber-500" style={{ width: `${(riskDist.medium / totalRisk) * 100}%` }} />}
              {riskDist.high > 0 && <div className="bg-rose-500" style={{ width: `${(riskDist.high / totalRisk) * 100}%` }} />}
            </div>
          </div>

          {/* Three tiles */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: "low",    label: t("কম", "Low"),       value: riskDist.low,    tone: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
              { key: "medium", label: t("মাঝারি", "Medium"), value: riskDist.medium, tone: "bg-amber-50 text-amber-800",    dot: "bg-amber-500" },
              { key: "high",   label: t("উচ্চ", "High"),    value: riskDist.high,   tone: "bg-rose-50 text-rose-700",      dot: "bg-rose-500" },
            ].map((r) => {
              const pct = totalRisk > 0 ? (r.value / totalRisk) * 100 : 0;
              return (
                <div key={r.key} className={`${r.tone} rounded-lg p-2.5 text-center`}>
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${r.dot}`} />
                    <span className={`text-[10px] font-semibold uppercase tracking-wide ${locale === "bn" ? "font-bn" : ""}`}>{r.label}</span>
                  </div>
                  <p className="text-xl font-bold tabular-nums">{r.value}</p>
                  <p className="text-[10px] opacity-60 tabular-nums">{pct.toFixed(0)}%</p>
                </div>
              );
            })}
          </div>

          {/* Context footer */}
          <div className={`mt-4 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-[11px] ${locale === "bn" ? "font-bn" : ""}`}>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">{t("বাতিল হার", "Cancel rate")}</span>
              <span className="font-bold tabular-nums text-gray-900">{(summary.cancelled_rate ?? 0).toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">{t("রিটার্ন হার", "Return rate")}</span>
              <span className="font-bold tabular-nums text-gray-900">{(summary.returned_rate ?? 0).toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">{t("গেস্ট অর্ডার", "Guest orders")}</span>
              <span className="font-bold tabular-nums text-gray-900">{summary.guest_orders ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">VPN / {t("প্রক্সি", "Proxy")}</span>
              <span className={`font-bold tabular-nums ${(summary.vpn_orders ?? 0) > 0 ? "text-rose-600" : "text-gray-900"}`}>
                {summary.vpn_orders ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Risky Orders — actionable list */}
      <HighRiskOrdersCard days={days} accessToken={accessToken} />

      {/* Suspicious IPs */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <h3 className="text-sm font-bold text-gray-900 mb-3">{t("সন্দেহজনক IP", "Suspicious IPs")}</h3>
        {suspiciousIps.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">{t("কোনো সন্দেহজনক IP নেই", "No suspicious IPs found")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs">IP</th>
                  <th className="text-center px-3 py-2 font-semibold text-gray-600 text-xs">{t("অর্ডার", "Orders")}</th>
                  <th className="text-center px-3 py-2 font-semibold text-gray-600 text-xs">{t("গেস্ট", "Guest")}</th>
                  <th className="text-center px-3 py-2 font-semibold text-gray-600 text-xs">{t("বাতিল", "Cancelled")}</th>
                  <th className="text-center px-3 py-2 font-semibold text-gray-600 text-xs">{t("গড় স্কোর", "Avg Score")}</th>
                  <th className="text-right px-3 py-2 font-semibold text-gray-600 text-xs">{t("সর্বশেষ", "Last Order")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {suspiciousIps.map((ip: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50/50">
                    <td className="px-3 py-2 font-mono text-xs font-medium">{ip.ip}</td>
                    <td className="px-3 py-2 text-center font-bold">{ip.order_count}</td>
                    <td className="px-3 py-2 text-center text-xs">{ip.guest_count}</td>
                    <td className="px-3 py-2 text-center text-xs font-semibold text-red-600">{ip.cancelled_count}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        ip.avg_score >= 60 ? "bg-red-100 text-red-700" :
                        ip.avg_score >= 30 ? "bg-amber-100 text-amber-700" :
                        "bg-green-100 text-green-700"
                      }`}>
                        {ip.avg_score}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-gray-500">{ip.last_order_date ? new Date(ip.last_order_date).toLocaleDateString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Triggered Flags */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className={`text-sm font-bold text-gray-900 mb-3 ${locale === "bn" ? "font-bn" : ""}`}>
            {t("শীর্ষ ফ্ল্যাগ", "Top Triggered Flags")}
          </h3>
          {topFlags.length === 0 ? (
            <p className={`text-xs text-gray-400 py-4 text-center ${locale === "bn" ? "font-bn" : ""}`}>
              {t("কোনো ফ্ল্যাগ নেই", "No flags found")}
            </p>
          ) : (() => {
            const maxCount = Math.max(...topFlags.map((f: any) => f.count || 0), 1);
            return (
              <div className="space-y-2.5">
                {topFlags.map((f: any, i: number) => {
                  const raw = f.flag || f.name || "";
                  const info = getFlagInfo(raw);
                  const style = SEVERITY_STYLE[info.severity];
                  const pct = ((f.count || 0) / maxCount) * 100;
                  return (
                    <div key={i} className="group">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
                          <span
                            className={`text-sm font-semibold text-gray-800 truncate ${locale === "bn" ? "font-bn" : ""}`}
                            title={info.description[locale === "bn" ? "bn" : "en"]}
                          >
                            {info.label[locale === "bn" ? "bn" : "en"]}
                          </span>
                        </div>
                        <span className="text-xs font-bold font-mono text-gray-900 tabular-nums shrink-0">{f.count}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${style.dot}`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className={`text-[11px] text-gray-500 mt-1 line-clamp-1 ${locale === "bn" ? "font-bn" : ""}`}>
                        {info.description[locale === "bn" ? "bn" : "en"]}
                      </p>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Repeat Offenders */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">{t("পুনরায় অপরাধী", "Repeat Offenders")}</h3>
          {offenders.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">{t("কোনো ডেটা নেই", "No data found")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-3 py-2 font-semibold text-gray-600 text-xs">{t("ফোন", "Phone")}</th>
                    <th className="text-center px-3 py-2 font-semibold text-gray-600 text-xs">{t("অর্ডার", "Orders")}</th>
                    <th className="text-center px-3 py-2 font-semibold text-gray-600 text-xs">{t("গড় স্কোর", "Avg Score")}</th>
                    <th className="text-center px-3 py-2 font-semibold text-gray-600 text-xs">{t("বাতিল", "Cancelled")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {offenders.map((o: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50/50">
                      <td className="px-3 py-2 font-mono text-xs">{o.phone}</td>
                      <td className="px-3 py-2 text-center font-bold">{o.order_count}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          o.avg_score >= 60 ? "bg-red-100 text-red-700" :
                          o.avg_score >= 30 ? "bg-amber-100 text-amber-700" :
                          "bg-green-100 text-green-700"
                        }`}>
                          {Math.round(o.avg_score)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center text-xs font-semibold text-red-600">{o.cancelled_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminPageContent() {
  const router = useRouter();
  const { user, isAuthenticated, accessToken, logout } = useAuthStore();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "dashboard";
  const [activeTab, setActiveTab] = useState<Tab>(validTabs.includes(initialTab) ? initialTab : "dashboard");

  // Sync state when URL search params change (e.g. from AdminLayout sidebar clicks)
  useEffect(() => {
    const currentTab = searchParams.get("tab") as Tab;
    if (currentTab && validTabs.includes(currentTab) && currentTab !== activeTab) {
      setActiveTab(currentTab);
      setListData([]); // clear previous content quickly
    }
  }, [searchParams, activeTab]);

  const changeTab = useCallback((tab: Tab, extraParams?: Record<string, string>) => {
    setActiveTab(tab);
    setListData([]);
    const params = new URLSearchParams({ tab });
    if (extraParams) {
      for (const [k, v] of Object.entries(extraParams)) {
        if (v) params.set(k, v);
      }
    }
    router.push(`/admin?${params.toString()}`, { scroll: false });
  }, [router]);
  const [loading, setLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [listData, setListData] = useState<any[]>([]);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [editCourse, setEditCourse] = useState<any>(null);
  const [courseForm, setCourseForm] = useState({ title: "", title_bn: "", description: "", description_bn: "", price: "0", is_free: false, course_type: "recorded", thumbnail_url: "", is_featured: false, category_id: "", instructor_id: "" });
  const [couponForm, setCouponForm] = useState({ code: "", discount_type: "percentage", discount_value: "10", max_uses: "100", is_active: true });
  const [showCouponForm, setShowCouponForm] = useState(false);
  const [shipmentFilter, setShipmentFilter] = useState("");
  const [shipmentEdit, setShipmentEdit] = useState<any>(null);
  const [shipmentForm, setShipmentForm] = useState({ status: "", courier_name: "", tracking_number: "", admin_notes: "" });
  const [showEbookForm, setShowEbookForm] = useState(false);
  const [ebookForm, setEbookForm] = useState({ title: "", title_bn: "", description: "", price: "0", is_free: false, author: "", pages: "", thumbnail_url: "", b2_key: "" });
  const [editEbook, setEditEbook] = useState<any>(null);
  const [showInstructorForm, setShowInstructorForm] = useState(false);
  const [editInstructor, setEditInstructor] = useState<any>(null);
  const [instructorForm, setInstructorForm] = useState({
    name: "", name_bn: "", designation: "", designation_bn: "", bio: "", bio_bn: "",
    profile_image_url: "", email: "", phone: "", facebook_url: "", linkedin_url: ""
  });
  const [showPhysicalItemForm, setShowPhysicalItemForm] = useState(false);
  const [editPhysicalItem, setEditPhysicalItem] = useState<any>(null);
  const [physicalItemForm, setPhysicalItemForm] = useState({
    title: "", title_bn: "", description: "", description_bn: "",
    price: "0", compare_price: "", author: "", isbn: "",
    weight_grams: "", stock_quantity: "0", sku: "",
    thumbnail_url: "", category_id: "", images: [] as { image_url: string; sort_order: number }[],
  });
  // Exam create state
  const [showExamCreateForm, setShowExamCreateForm] = useState(false);
  const [examCreateForm, setExamCreateForm] = useState({ title: "", title_bn: "", exam_type: "anytime", price: "0", is_free: false, pass_percentage: "60" });
  const [examCreateSaving, setExamCreateSaving] = useState(false);

  // Games state
  const [gamesData, setGamesData] = useState<any[]>([]);
  const [showGameForm, setShowGameForm] = useState(false);
  const [gameForm, setGameForm] = useState({ title: "", title_bn: "", game_type: "memory", difficulty: "easy" });

  // Abacus state
  const [abacusData, setAbacusData] = useState<any[]>([]);
  const [showAbacusForm, setShowAbacusForm] = useState(false);
  const [abacusForm, setAbacusForm] = useState({ title: "", title_bn: "", load_defaults: true });

  // Badges state
  const [badgesData, setBadgesData] = useState<any[]>([]);
  const [showBadgeForm, setShowBadgeForm] = useState(false);
  const [editBadge, setEditBadge] = useState<any>(null);
  const [badgeForm, setBadgeForm] = useState({
    name: "", name_bn: "", description: "", description_bn: "",
    category: "general", icon_url: "",
    criteria: { trigger: "drawing_count", threshold: 1, description: "" },
    sort_order: 0,
  });

  // Gallery state
  const [galleryData, setGalleryData] = useState<any[]>([]);
  const [galleryStatusFilter, setGalleryStatusFilter] = useState("");

  // Challenges state
  const [challengesData, setChallengesData] = useState<any[]>([]);
  const [showChallengeForm, setShowChallengeForm] = useState(false);
  const [editChallenge, setEditChallenge] = useState<any>(null);
  const [challengeForm, setChallengeForm] = useState({
    title: "", title_bn: "", description: "", description_bn: "",
    reference_image_url: "", challenge_type: "drawing",
    starts_at: "", ends_at: "", is_active: true,
  });

  // Homepage content state
  const [homepageSubTab, setHomepageSubTab] = useState<"voices" | "stats" | "gallery" | "activities">("voices");
  const [homepageData, setHomepageData] = useState<any>({ testimonials: [], stats: [], gallery: [], activities: [] });
  const [showHomepageForm, setShowHomepageForm] = useState(false);
  const [editHomepageItem, setEditHomepageItem] = useState<any>(null);
  const [homepageForm, setHomepageForm] = useState<any>({});
  const [viewOrder, setViewOrder] = useState<any | null>(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("");
  const [orderTimeRange, setOrderTimeRange] = useState<string>("");
  const [orderCounts, setOrderCounts] = useState<any>({});
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    confirmColor: string;
    onConfirm: (() => void) | null;
  }>({ open: false, title: "", message: "", confirmLabel: "", confirmColor: "", onConfirm: null });

  const showConfirm = (title: string, message: string, confirmLabel: string, confirmColor: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmModal({
        open: true,
        title,
        message,
        confirmLabel,
        confirmColor,
        onConfirm: () => {
          setConfirmModal(prev => ({ ...prev, open: false }));
          resolve(true);
        },
      });
      // Store reject in a way we can call it on cancel
      const handleCancel = () => {
        setConfirmModal(prev => ({ ...prev, open: false }));
        resolve(false);
      };
      // We need to attach cancel handler — use a small trick with a ref-like approach
      setTimeout(() => {
        const cancelBtn = document.getElementById("confirm-modal-cancel");
        const backdrop = document.getElementById("confirm-modal-backdrop");
        if (cancelBtn) cancelBtn.onclick = handleCancel;
        if (backdrop) backdrop.onclick = (e) => { if (e.target === backdrop) handleCancel(); };
      }, 50);
    });
  };

  const loadHomepageData = async () => {
    try {
      const [testimonials, stats, gallery, activities]: any = await Promise.all([
        api.get("/homepage-content/testimonials/", accessToken!),
        api.get("/homepage-content/stats/", accessToken!),
        api.get("/homepage-content/gallery/", accessToken!),
        api.get("/homepage-content/activities/", accessToken!),
      ]);
      setHomepageData({
        testimonials: Array.isArray(testimonials) ? testimonials : [],
        stats: Array.isArray(stats) ? stats : [],
        gallery: Array.isArray(gallery) ? gallery : [],
        activities: Array.isArray(activities) ? activities : [],
      });
    } catch {}
  };

  const [siteSettingsForm, setSiteSettingsForm] = useState<any>({
    platform_name: "", logo_url: "", favicon_url: "",
    support_phone: "", support_email: "", office_address: "",
    facebook_url: "", youtube_url: "", instagram_url: "", linkedin_url: "",
    footer_description_en: "", footer_description_bn: ""
  });

  const [mounted, setMounted] = useState(false);
  const [adminCategories, setAdminCategories] = useState<any[]>([]);
  const [shopCategories, setShopCategories] = useState<any[]>([]);
  const [shopRefreshKey, setShopRefreshKey] = useState(0);
  const [coursesRefreshKey, setCoursesRefreshKey] = useState(0);
  const [examsRefreshKey, setExamsRefreshKey] = useState(0);
  const [ebooksRefreshKey, setEbooksRefreshKey] = useState(0);
  const [ordersRefreshKey, setOrdersRefreshKey] = useState(0);
  const [adminInstructors, setAdminInstructors] = useState<any[]>([]);
  const [newShopCatName, setNewShopCatName] = useState("");
  const [newShopCatNameBn, setNewShopCatNameBn] = useState("");
  const [showAddShopCat, setShowAddShopCat] = useState(false);

  const loadShopCategories = async () => {
    try {
      const data: any = await api.get("/categories/?type=shop");
      setShopCategories(Array.isArray(data) ? data : []);
    } catch {}
  };

  useEffect(() => {
    setMounted(true);
    // Load categories for course form
    const loadInitialData = async () => {
      try {
        const [cats, insts] = await Promise.all([
          api.get("/categories/?type=course"),
          api.get("/instructors/")
        ]);
        setAdminCategories(Array.isArray(cats) ? cats : []);
        setAdminInstructors(Array.isArray(insts) ? insts : []);
        // Also load shop categories
        loadShopCategories();
      } catch {}
    };
    loadInitialData();
  }, []);

  // Auth guard
  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated) { router.push("/login"); return; }
    const roles = user?.roles || [];
    if (!roles.some((r: string) => ["super_admin", "admin"].includes(r))) {
      router.push("/dashboard");
      return;
    }
    setLoading(false);
  }, [mounted, isAuthenticated, user, router]);

  // Load data based on tab
  useEffect(() => {
    if (!accessToken || loading) return;

    const load = async () => {
      try {
        if (activeTab === "dashboard") {
          const data: any = await api.get("/admin/stats", accessToken);
          setDashboardStats(data);
        } else if (activeTab === "users") {
          const data: any = await api.get("/users/", accessToken);
          setListData(data || []);
        } else if (activeTab === "courses") {
          // Panel owns its own data via /courses/admin
        } else if (activeTab === "orders") {
          const params = new URLSearchParams();
          if (orderStatusFilter) params.set("status", orderStatusFilter);
          if (orderTimeRange) params.set("days", orderTimeRange);
          const qs = params.toString() ? `?${params.toString()}` : "";
          const [data, counts]: any = await Promise.all([
            api.get(`/orders/${qs}`, accessToken),
            api.get("/admin/orders/counts", accessToken),
          ]);
          setListData(data || []);
          setOrderCounts(counts || {});
        } else if (activeTab === "shipments") {
          const filter = shipmentFilter ? `?status=${shipmentFilter}` : "";
          const data: any = await api.get(`/shipments/${filter}`, accessToken);
          setListData(data || []);
        } else if (activeTab === "coupons") {
          const data: any = await api.get("/coupons/", accessToken);
          setListData(data || []);
        } else if (activeTab === "ebooks") {
          // EbooksPanel owns its own data via /ebooks/admin
        } else if (activeTab === "physical-items") {
          // Panel owns its own data via /physical-items/admin — we just need
          // categories for the form modal's dropdown.
          loadShopCategories();
        } else if (activeTab === "homepage") {
          loadHomepageData();
        } else if (activeTab === "settings") {
          const data: any = await api.get("/settings/site");
          setSiteSettingsForm(data);
        } else if (activeTab === "instructors") {
          const data: any = await api.get("/instructors/");
          setListData(Array.isArray(data) ? data : []);
        } else if (activeTab === "exams") {
          // ExamsPanel owns its own data via /exams/admin
        } else if (activeTab === "games") {
          const data: any = await api.get("/games/?page=1&page_size=50", accessToken);
          setGamesData(Array.isArray(data) ? data : (data?.items || []));
        } else if (activeTab === "abacus") {
          const data: any = await api.get("/abacus/?page=1&page_size=50", accessToken);
          setAbacusData(Array.isArray(data) ? data : (data?.items || []));
        } else if (activeTab === "badges") {
          const data: any = await api.get("/badges/", accessToken);
          setBadgesData(Array.isArray(data) ? data : []);
        } else if (activeTab === "gallery") {
          const filter = galleryStatusFilter ? `?status=${galleryStatusFilter}&page_size=50` : "?page_size=50";
          const data: any = await api.get(`/drawings/admin${filter}`, accessToken);
          setGalleryData(Array.isArray(data) ? data : []);
        } else if (activeTab === "challenges") {
          const data: any = await api.get("/challenges/admin", accessToken);
          setChallengesData(Array.isArray(data) ? data : []);
        }
      } catch (err: any) {
        if (err?.status === 401) {
          // Token expired — logout and redirect
          logout();
          router.push("/login");
          return;
        }
        setListData([]);
      }
    };
    load();
  }, [activeTab, accessToken, loading, shipmentFilter, orderStatusFilter, orderTimeRange, galleryStatusFilter, ordersRefreshKey]);

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "dashboard", label: "ড্যাশবোর্ড", icon: LayoutDashboard },
    { id: "users", label: "ইউজার", icon: Users },
    { id: "courses", label: "কোর্স", icon: BookOpen },
    { id: "ebooks", label: "ই-বুক", icon: BookOpen },
    { id: "physical-items", label: "শপ প্রোডাক্ট", icon: ShoppingBag },
    { id: "orders", label: "অর্ডার", icon: ShoppingBag },
    { id: "shipments", label: "শিপমেন্ট", icon: Truck },
    { id: "coupons", label: "কুপন", icon: Tag },
    { id: "homepage", label: "হোমপেজ", icon: Home },
    { id: "settings", label: "সেটিংস", icon: Settings },
    { id: "exams", label: "পরীক্ষা", icon: GraduationCap },
    { id: "games", label: "গেমস", icon: Gamepad2 },
    { id: "abacus", label: "অ্যাবাকাস", icon: Calculator },
  ];

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    confirmed: "bg-blue-100 text-blue-700",
    processing: "bg-purple-100 text-purple-700",
    partially_fulfilled: "bg-indigo-100 text-indigo-700",
    fulfilled: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
    refunded: "bg-orange-100 text-orange-700",
    dispatched: "bg-purple-100 text-purple-700",
    delivered: "bg-green-100 text-green-700",
    returned: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="p-6 md:p-8">
      {/* Dashboard */}
        {activeTab === "dashboard" && (
          <SuperAdminDashboard
            onNavigate={(tab, extra) => {
              if (extra?.status) {
                if (tab === "orders") setOrderStatusFilter(extra.status);
                else if (tab === "shipments") setShipmentFilter(extra.status);
              }
              const urlExtras: Record<string, string> = {};
              if (tab === "fraud-dashboard" && extra?.days) urlExtras.days = extra.days;
              changeTab(tab as Tab, urlExtras);
            }}
          />
        )}

        {/* Physical Items (Shop Products) */}
        {activeTab === "physical-items" && (
          <div>
            <ShopProductsPanel
              accessToken={accessToken!}
              categories={shopCategories}
              refreshKey={shopRefreshKey}
              onCreate={() => {
                setEditPhysicalItem(null);
                setPhysicalItemForm({ title: "", title_bn: "", description: "", description_bn: "", price: "0", compare_price: "", author: "", isbn: "", weight_grams: "", stock_quantity: "0", sku: "", thumbnail_url: "", category_id: "", images: [] });
                setShowPhysicalItemForm(true);
              }}
              onEdit={(item: any) => {
                setEditPhysicalItem(item);
                setPhysicalItemForm({
                  title: item.title || "", title_bn: item.title_bn || "",
                  description: item.description || "", description_bn: item.description_bn || "",
                  price: String(item.price || "0"), compare_price: item.compare_price ? String(item.compare_price) : "",
                  author: item.author || "", isbn: item.isbn || "",
                  weight_grams: item.weight_grams ? String(item.weight_grams) : "",
                  stock_quantity: String(item.stock_quantity || "0"),
                  sku: item.sku || "", thumbnail_url: item.thumbnail_url || "",
                  category_id: item.category_id ? String(item.category_id) : "",
                  images: (item.images || []).map((img: any) => ({ image_url: img.image_url, sort_order: img.sort_order || 0 })),
                });
                setShowPhysicalItemForm(true);
              }}
            />

            {/* Physical Item Form Modal */}
            {showPhysicalItemForm && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPhysicalItemForm(false)}>
                <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold font-bn">{editPhysicalItem ? "প্রোডাক্ট এডিট" : "নতুন প্রোডাক্ট"}</h2>
                    <button onClick={() => setShowPhysicalItemForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
                  </div>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const payload: any = {
                      title: physicalItemForm.title,
                      title_bn: physicalItemForm.title_bn || undefined,
                      description: physicalItemForm.description || undefined,
                      description_bn: physicalItemForm.description_bn || undefined,
                      price: parseFloat(physicalItemForm.price) || 0,
                      compare_price: physicalItemForm.compare_price ? parseFloat(physicalItemForm.compare_price) : undefined,
                      author: physicalItemForm.author || undefined,
                      isbn: physicalItemForm.isbn || undefined,
                      weight_grams: physicalItemForm.weight_grams ? parseInt(physicalItemForm.weight_grams) : undefined,
                      stock_quantity: parseInt(physicalItemForm.stock_quantity) || 0,
                      sku: physicalItemForm.sku || undefined,
                      thumbnail_url: physicalItemForm.thumbnail_url || undefined,
                      category_id: physicalItemForm.category_id ? parseInt(physicalItemForm.category_id) : undefined,
                      images: physicalItemForm.images,
                    };
                    try {
                      if (editPhysicalItem) {
                        await api.patch(`/physical-items/${editPhysicalItem.id}`, payload, accessToken!);
                      } else {
                        await api.post("/physical-items/", payload, accessToken!);
                      }
                      setShowPhysicalItemForm(false);
                      setShopRefreshKey((k) => k + 1);
                      const { toast } = await import("@/stores/toast-store");
                      toast.success(editPhysicalItem ? "প্রোডাক্ট আপডেট হয়েছে" : "প্রোডাক্ট তৈরি হয়েছে");
                    } catch (err: any) {
                      const { toast } = await import("@/stores/toast-store");
                      toast.error(err?.message || "Error saving product");
                    }
                  }} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 font-bn block mb-1">Title (EN) *</label>
                        <input required value={physicalItemForm.title} onChange={(e) => setPhysicalItemForm((p) => ({ ...p, title: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 font-bn block mb-1">টাইটেল (বাংলা)</label>
                        <input value={physicalItemForm.title_bn} onChange={(e) => setPhysicalItemForm((p) => ({ ...p, title_bn: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Description (EN)</label>
                        <textarea value={physicalItemForm.description} onChange={(e) => setPhysicalItemForm((p) => ({ ...p, description: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400 h-20 resize-none" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 font-bn block mb-1">বিবরণ (বাংলা)</label>
                        <textarea value={physicalItemForm.description_bn} onChange={(e) => setPhysicalItemForm((p) => ({ ...p, description_bn: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400 h-20 resize-none font-bn" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Price (৳)</label>
                        <input type="number" step="0.01" value={physicalItemForm.price} onChange={(e) => setPhysicalItemForm((p) => ({ ...p, price: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Compare Price</label>
                        <input type="number" step="0.01" value={physicalItemForm.compare_price} onChange={(e) => setPhysicalItemForm((p) => ({ ...p, compare_price: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Stock Qty</label>
                        <input type="number" value={physicalItemForm.stock_quantity} onChange={(e) => setPhysicalItemForm((p) => ({ ...p, stock_quantity: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Author</label>
                        <input value={physicalItemForm.author} onChange={(e) => setPhysicalItemForm((p) => ({ ...p, author: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">SKU</label>
                        <input value={physicalItemForm.sku} onChange={(e) => setPhysicalItemForm((p) => ({ ...p, sku: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Weight (g)</label>
                        <input type="number" value={physicalItemForm.weight_grams} onChange={(e) => setPhysicalItemForm((p) => ({ ...p, weight_grams: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">ISBN</label>
                        <input value={physicalItemForm.isbn} onChange={(e) => setPhysicalItemForm((p) => ({ ...p, isbn: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-gray-600 font-bn">ক্যাটাগরি</label>
                          <button type="button" onClick={() => setShowAddShopCat(!showAddShopCat)}
                            className="text-[10px] font-semibold text-primary-600 hover:text-primary-800">
                            {showAddShopCat ? "বাতিল" : "+ নতুন ক্যাটাগরি"}
                          </button>
                        </div>
                        {showAddShopCat && (
                          <div className="mb-2 p-2.5 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                            <input value={newShopCatName} onChange={(e) => setNewShopCatName(e.target.value)}
                              placeholder="Category name (EN)" className="w-full px-2.5 py-1.5 rounded border border-gray-200 text-xs outline-none focus:border-primary-400" />
                            <input value={newShopCatNameBn} onChange={(e) => setNewShopCatNameBn(e.target.value)}
                              placeholder="ক্যাটাগরি নাম (বাংলা)" className="w-full px-2.5 py-1.5 rounded border border-gray-200 text-xs outline-none focus:border-primary-400 font-bn" />
                            <button type="button" onClick={async () => {
                              if (!newShopCatName.trim()) return;
                              try {
                                const res: any = await api.post("/categories/", {
                                  name: newShopCatName, name_bn: newShopCatNameBn || undefined, category_type: "shop",
                                }, accessToken!);
                                await loadShopCategories();
                                setPhysicalItemForm((p) => ({ ...p, category_id: String(res.id) }));
                                setNewShopCatName(""); setNewShopCatNameBn(""); setShowAddShopCat(false);
                              } catch (err: any) { alert(err.message || "Error creating category"); }
                            }} className="w-full py-1.5 bg-primary-700 text-white text-xs font-semibold rounded hover:bg-primary-800">
                              তৈরি করুন
                            </button>
                          </div>
                        )}
                        <select value={physicalItemForm.category_id} onChange={(e) => setPhysicalItemForm((p) => ({ ...p, category_id: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn">
                          <option value="">-- নির্বাচন করুন --</option>
                          {shopCategories.map((cat: any) => (
                            <option key={cat.id} value={cat.id}>{cat.name_bn || cat.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {/* Thumbnail */}
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Thumbnail URL</label>
                      <div className="flex gap-2">
                        <input value={physicalItemForm.thumbnail_url} onChange={(e) => setPhysicalItemForm((p) => ({ ...p, thumbnail_url: e.target.value }))}
                          placeholder="URL or upload"
                          className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" />
                        <label className="px-3 py-2 bg-gray-100 rounded-lg text-xs font-semibold text-gray-600 cursor-pointer hover:bg-gray-200">
                          Upload
                          <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const fd = new FormData();
                            fd.append("file", file);
                            fd.append("folder", "shop-images");
                            try {
                              const res: any = await api.postFormData("/uploads/image", fd, accessToken!);
                              setPhysicalItemForm((p) => ({ ...p, thumbnail_url: res.url || res.image_url }));
                            } catch {}
                          }} />
                        </label>
                      </div>
                    </div>
                    {/* Multiple images */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-gray-600">Product Images</label>
                        <label className="px-3 py-1 bg-primary-50 text-primary-700 rounded-lg text-xs font-semibold cursor-pointer hover:bg-primary-100">
                          + Add Image
                          <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const fd = new FormData();
                            fd.append("file", file);
                            fd.append("folder", "shop-images");
                            try {
                              const res: any = await api.postFormData("/uploads/image", fd, accessToken!);
                              const url = res.url || res.image_url;
                              setPhysicalItemForm((p) => ({
                                ...p,
                                images: [...p.images, { image_url: url, sort_order: p.images.length }],
                              }));
                            } catch {}
                          }} />
                        </label>
                      </div>
                      {physicalItemForm.images.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {physicalItemForm.images.map((img, idx) => (
                            <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                              <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                              <button type="button" onClick={() => {
                                setPhysicalItemForm((p) => ({
                                  ...p,
                                  images: p.images.filter((_, i) => i !== idx),
                                }));
                              }} className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[8px]">✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button type="submit" className="w-full py-2.5 bg-primary-700 text-white font-semibold rounded-lg hover:bg-primary-800 text-sm font-bn">
                      {editPhysicalItem ? "আপডেট করুন" : "তৈরি করুন"}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Homepage Content Management */}
        {activeTab === "homepage" && (
          <div>
            <h1 className="text-xl font-bold font-bn mb-4">হোমপেজ কন্টেন্ট</h1>
            {/* Sub-tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto hide-scrollbar">
              {([
                { id: "voices", label: "ভয়েসেস", icon: MessageCircle },
                { id: "stats", label: "স্ট্যাটস", icon: BarChart3 },
                { id: "gallery", label: "গ্যালারি", icon: Image },
                { id: "activities", label: "অ্যাক্টিভিটিজ", icon: Sparkles },
              ] as const).map((st) => {
                const Icon = st.icon;
                return (
                  <button key={st.id} onClick={() => setHomepageSubTab(st.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors font-bn ${
                      homepageSubTab === st.id ? "bg-primary-700 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" /> {st.label}
                  </button>
                );
              })}
            </div>

            {/* ── Voices Sub-tab ── */}
            {homepageSubTab === "voices" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold font-bn text-gray-700">টেস্টিমোনিয়াল / ভয়েসেস</h2>
                  <button onClick={() => {
                    setEditHomepageItem(null);
                    setHomepageForm({ quote: "", quote_bn: "", author_name: "", author_role: "", author_role_bn: "", photo_url: "", video_url: "", video_type: "upload", gradient_color: "from-primary-700", sort_order: 0 });
                    setShowHomepageForm(true);
                  }} className="flex items-center gap-2 px-4 py-2 bg-primary-700 text-white text-sm font-semibold rounded-lg hover:bg-primary-800">
                    <Plus className="w-4 h-4" /> যোগ করুন
                  </button>
                </div>
                <div className="space-y-3">
                  {homepageData.testimonials.map((item: any) => (
                    <div key={item.id} className="flex items-center gap-4 bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                      <div className="w-14 h-14 rounded-xl bg-gray-100 shrink-0 overflow-hidden">
                        {item.photo_url ? <img src={item.photo_url} alt="" className="w-full h-full object-cover" /> : <MessageCircle className="w-6 h-6 text-gray-300 m-auto mt-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 font-bn truncate">{item.quote_bn || item.quote}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{item.author_name} · {item.author_role_bn || item.author_role}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {item.video_url && <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-semibold">{item.video_type}</span>}
                          {!item.is_active && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">নিষ্ক্রিয়</span>}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => {
                          setEditHomepageItem(item);
                          setHomepageForm({ quote: item.quote, quote_bn: item.quote_bn || "", author_name: item.author_name, author_role: item.author_role || "", author_role_bn: item.author_role_bn || "", photo_url: item.photo_url || "", video_url: item.video_url || "", video_type: item.video_type || "upload", gradient_color: item.gradient_color || "from-primary-700", sort_order: item.sort_order || 0, is_active: item.is_active });
                          setShowHomepageForm(true);
                        }} className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg"><Edit3 className="w-4 h-4" /></button>
                        <button onClick={async () => {
                          if (!confirm("ডিলিট করতে চান?")) return;
                          await api.delete(`/homepage-content/testimonials/${item.id}`, accessToken!);
                          loadHomepageData();
                        }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                  {homepageData.testimonials.length === 0 && <p className="text-sm text-gray-400 text-center py-8 font-bn">কোনো টেস্টিমোনিয়াল নেই</p>}
                </div>
                {/* Voices Form Modal */}
                {showHomepageForm && homepageSubTab === "voices" && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowHomepageForm(false)}>
                    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold font-bn">{editHomepageItem ? "এডিট" : "নতুন"} টেস্টিমোনিয়াল</h2>
                        <button onClick={() => setShowHomepageForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
                      </div>
                      <form onSubmit={async (e) => {
                        e.preventDefault();
                        try {
                          if (editHomepageItem) {
                            await api.patch(`/homepage-content/testimonials/${editHomepageItem.id}`, homepageForm, accessToken!);
                          } else {
                            await api.post("/homepage-content/testimonials/", homepageForm, accessToken!);
                          }
                          setShowHomepageForm(false);
                          loadHomepageData();
                        } catch (err: any) { alert(err.message || "Error"); }
                      }} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="text-xs font-semibold text-gray-600 block mb-1">Quote (EN) *</label>
                            <textarea required value={homepageForm.quote} onChange={(e) => setHomepageForm((p: any) => ({ ...p, quote: e.target.value }))}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400 h-20 resize-none" /></div>
                          <div><label className="text-xs font-semibold text-gray-600 font-bn block mb-1">উক্তি (বাংলা)</label>
                            <textarea value={homepageForm.quote_bn} onChange={(e) => setHomepageForm((p: any) => ({ ...p, quote_bn: e.target.value }))}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400 h-20 resize-none font-bn" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="text-xs font-semibold text-gray-600 block mb-1">Author Name *</label>
                            <input required value={homepageForm.author_name} onChange={(e) => setHomepageForm((p: any) => ({ ...p, author_name: e.target.value }))}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" /></div>
                          <div><label className="text-xs font-semibold text-gray-600 block mb-1">Role</label>
                            <input value={homepageForm.author_role} onChange={(e) => setHomepageForm((p: any) => ({ ...p, author_role: e.target.value }))}
                              placeholder="e.g. Parent" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" /></div>
                        </div>
                        <div><label className="text-xs font-semibold text-gray-600 font-bn block mb-1">ভূমিকা (বাংলা)</label>
                          <input value={homepageForm.author_role_bn} onChange={(e) => setHomepageForm((p: any) => ({ ...p, author_role_bn: e.target.value }))}
                            placeholder="যেমন: অভিভাবক" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn" /></div>
                        <div><label className="text-xs font-semibold text-gray-600 block mb-1">Photo</label>
                          <div className="flex gap-2">
                            <input value={homepageForm.photo_url} onChange={(e) => setHomepageForm((p: any) => ({ ...p, photo_url: e.target.value }))} placeholder="URL or upload"
                              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" />
                            <label className="px-3 py-2 bg-gray-100 rounded-lg text-xs font-semibold text-gray-600 cursor-pointer hover:bg-gray-200">Upload
                              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                const file = e.target.files?.[0]; if (!file) return;
                                const fd = new FormData(); fd.append("file", file); fd.append("folder", "homepage");
                                try { const res: any = await api.postFormData("/uploads/image", fd, accessToken!);
                                  setHomepageForm((p: any) => ({ ...p, photo_url: res.url || res.image_url })); } catch {}
                              }} /></label>
                          </div></div>
                        <div><label className="text-xs font-semibold text-gray-600 block mb-1">Video Type</label>
                          <select value={homepageForm.video_type} onChange={(e) => setHomepageForm((p: any) => ({ ...p, video_type: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400">
                            <option value="upload">Upload</option><option value="youtube">YouTube</option><option value="vimeo">Vimeo</option>
                          </select></div>
                        <div><label className="text-xs font-semibold text-gray-600 block mb-1">Video URL</label>
                          <input value={homepageForm.video_url} onChange={(e) => setHomepageForm((p: any) => ({ ...p, video_url: e.target.value }))}
                            placeholder={homepageForm.video_type === "youtube" ? "https://youtube.com/watch?v=..." : homepageForm.video_type === "vimeo" ? "https://vimeo.com/..." : "Upload URL"}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" /></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="text-xs font-semibold text-gray-600 block mb-1">Sort Order</label>
                            <input type="number" value={homepageForm.sort_order} onChange={(e) => setHomepageForm((p: any) => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" /></div>
                          <div><label className="text-xs font-semibold text-gray-600 block mb-1">Gradient Color</label>
                            <select value={homepageForm.gradient_color} onChange={(e) => setHomepageForm((p: any) => ({ ...p, gradient_color: e.target.value }))}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400">
                              <option value="from-primary-700">Purple</option><option value="from-orange-500">Orange</option><option value="from-blue-600">Blue</option><option value="from-emerald-600">Green</option>
                            </select></div>
                        </div>
                        <button type="submit" className="w-full py-2.5 bg-primary-700 text-white font-semibold rounded-lg hover:bg-primary-800 text-sm font-bn">
                          {editHomepageItem ? "আপডেট" : "তৈরি করুন"}
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Stats Sub-tab ── */}
            {homepageSubTab === "stats" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold font-bn text-gray-700">অ্যাচিভমেন্ট স্ট্যাটস</h2>
                  <button onClick={() => {
                    setEditHomepageItem(null);
                    setHomepageForm({ label: "", label_bn: "", value: "", value_en: "", auto_calculate: false, auto_source: "", sort_order: 0 });
                    setShowHomepageForm(true);
                  }} className="flex items-center gap-2 px-4 py-2 bg-primary-700 text-white text-sm font-semibold rounded-lg hover:bg-primary-800">
                    <Plus className="w-4 h-4" /> যোগ করুন
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {homepageData.stats.map((item: any) => (
                    <div key={item.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl font-black text-primary-700 font-bn">{item.computed_value || item.value}</span>
                        <div className="flex gap-1">
                          <button onClick={() => {
                            setEditHomepageItem(item);
                            setHomepageForm({ label: item.label, label_bn: item.label_bn || "", value: item.value, value_en: item.value_en || "", auto_calculate: item.auto_calculate, auto_source: item.auto_source || "", sort_order: item.sort_order || 0 });
                            setShowHomepageForm(true);
                          }} className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg"><Edit3 className="w-3.5 h-3.5" /></button>
                          <button onClick={async () => {
                            if (!confirm("ডিলিট?")) return;
                            await api.delete(`/homepage-content/stats/${item.id}`, accessToken!);
                            loadHomepageData();
                          }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 font-bn">{item.label_bn || item.label}</p>
                      {item.auto_calculate && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold mt-1 inline-block">Auto: {item.auto_source}</span>}
                    </div>
                  ))}
                </div>
                {homepageData.stats.length === 0 && <p className="text-sm text-gray-400 text-center py-8 font-bn">কোনো স্ট্যাট নেই</p>}
                {/* Stats Form Modal */}
                {showHomepageForm && homepageSubTab === "stats" && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowHomepageForm(false)}>
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold font-bn">{editHomepageItem ? "এডিট" : "নতুন"} স্ট্যাট</h2>
                        <button onClick={() => setShowHomepageForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
                      </div>
                      <form onSubmit={async (e) => {
                        e.preventDefault();
                        try {
                          if (editHomepageItem) await api.patch(`/homepage-content/stats/${editHomepageItem.id}`, homepageForm, accessToken!);
                          else await api.post("/homepage-content/stats/", homepageForm, accessToken!);
                          setShowHomepageForm(false); loadHomepageData();
                        } catch (err: any) { alert(err.message || "Error"); }
                      }} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="text-xs font-semibold text-gray-600 block mb-1">Label (EN) *</label>
                            <input required value={homepageForm.label} onChange={(e) => setHomepageForm((p: any) => ({ ...p, label: e.target.value }))}
                              placeholder="e.g. Courses" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" /></div>
                          <div><label className="text-xs font-semibold text-gray-600 font-bn block mb-1">লেবেল (বাংলা)</label>
                            <input value={homepageForm.label_bn} onChange={(e) => setHomepageForm((p: any) => ({ ...p, label_bn: e.target.value }))}
                              placeholder="যেমন: কোর্সসমূহ" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="text-xs font-semibold text-gray-600 block mb-1">Value (BN) *</label>
                            <input required value={homepageForm.value} onChange={(e) => setHomepageForm((p: any) => ({ ...p, value: e.target.value }))}
                              placeholder="যেমন: ৩০+" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn" /></div>
                          <div><label className="text-xs font-semibold text-gray-600 block mb-1">Value (EN)</label>
                            <input value={homepageForm.value_en} onChange={(e) => setHomepageForm((p: any) => ({ ...p, value_en: e.target.value }))}
                              placeholder="e.g. 30+" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" /></div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                          <input type="checkbox" checked={homepageForm.auto_calculate} onChange={(e) => setHomepageForm((p: any) => ({ ...p, auto_calculate: e.target.checked }))}
                            className="w-4 h-4 accent-primary-600" />
                          <div className="flex-1">
                            <label className="text-sm font-semibold text-gray-700">Auto Calculate</label>
                            <p className="text-[10px] text-gray-400">ডাটাবেজ থেকে অটো গণনা করবে</p>
                          </div>
                          {homepageForm.auto_calculate && (
                            <select value={homepageForm.auto_source} onChange={(e) => setHomepageForm((p: any) => ({ ...p, auto_source: e.target.value }))}
                              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-primary-400">
                              <option value="">Source</option>
                              <option value="courses">Courses</option><option value="users">Users</option>
                              <option value="enrollments">Enrollments</option><option value="instructors">Instructors</option>
                            </select>
                          )}
                        </div>
                        <div><label className="text-xs font-semibold text-gray-600 block mb-1">Sort Order</label>
                          <input type="number" value={homepageForm.sort_order} onChange={(e) => setHomepageForm((p: any) => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" /></div>
                        <button type="submit" className="w-full py-2.5 bg-primary-700 text-white font-semibold rounded-lg hover:bg-primary-800 text-sm font-bn">
                          {editHomepageItem ? "আপডেট" : "তৈরি করুন"}</button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Gallery Sub-tab ── */}
            {homepageSubTab === "gallery" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold font-bn text-gray-700">সাকসেস গ্যালারি</h2>
                  <button onClick={() => {
                    setEditHomepageItem(null);
                    setHomepageForm({ image_url: "", title: "", title_bn: "", label: "", label_bn: "", column_group: 1, sort_order: 0 });
                    setShowHomepageForm(true);
                  }} className="flex items-center gap-2 px-4 py-2 bg-primary-700 text-white text-sm font-semibold rounded-lg hover:bg-primary-800">
                    <Plus className="w-4 h-4" /> আপলোড করুন
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {homepageData.gallery.map((item: any) => (
                    <div key={item.id} className="relative group rounded-xl overflow-hidden border border-gray-100 shadow-sm">
                      <div className="aspect-square bg-gray-100">
                        <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-bold text-gray-800 truncate font-bn">{item.title_bn || item.title || "Untitled"}</p>
                        <p className="text-[10px] text-gray-400">{item.label || ""} · Col {item.column_group}</p>
                      </div>
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => {
                          setEditHomepageItem(item);
                          setHomepageForm({ image_url: item.image_url, title: item.title || "", title_bn: item.title_bn || "", label: item.label || "", label_bn: item.label_bn || "", column_group: item.column_group || 1, sort_order: item.sort_order || 0 });
                          setShowHomepageForm(true);
                        }} className="w-7 h-7 bg-white/90 rounded-lg flex items-center justify-center shadow-sm"><Edit3 className="w-3 h-3 text-primary-600" /></button>
                        <button onClick={async () => {
                          if (!confirm("ডিলিট?")) return;
                          await api.delete(`/homepage-content/gallery/${item.id}`, accessToken!);
                          loadHomepageData();
                        }} className="w-7 h-7 bg-white/90 rounded-lg flex items-center justify-center shadow-sm"><Trash2 className="w-3 h-3 text-red-500" /></button>
                      </div>
                    </div>
                  ))}
                </div>
                {homepageData.gallery.length === 0 && <p className="text-sm text-gray-400 text-center py-8 font-bn">কোনো ছবি নেই</p>}
                {/* Gallery Form Modal */}
                {showHomepageForm && homepageSubTab === "gallery" && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowHomepageForm(false)}>
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold font-bn">{editHomepageItem ? "এডিট" : "নতুন"} গ্যালারি আইটেম</h2>
                        <button onClick={() => setShowHomepageForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
                      </div>
                      <form onSubmit={async (e) => {
                        e.preventDefault();
                        try {
                          if (editHomepageItem) await api.patch(`/homepage-content/gallery/${editHomepageItem.id}`, homepageForm, accessToken!);
                          else await api.post("/homepage-content/gallery/", homepageForm, accessToken!);
                          setShowHomepageForm(false); loadHomepageData();
                        } catch (err: any) { alert(err.message || "Error"); }
                      }} className="space-y-3">
                        <div><label className="text-xs font-semibold text-gray-600 block mb-1">Image *</label>
                          <div className="flex gap-2">
                            <input required value={homepageForm.image_url} onChange={(e) => setHomepageForm((p: any) => ({ ...p, image_url: e.target.value }))} placeholder="URL or upload"
                              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" />
                            <label className="px-3 py-2 bg-gray-100 rounded-lg text-xs font-semibold text-gray-600 cursor-pointer hover:bg-gray-200">Upload
                              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                const file = e.target.files?.[0]; if (!file) return;
                                const fd = new FormData(); fd.append("file", file); fd.append("folder", "homepage");
                                try { const uploadRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1"}/uploads/image`, { method: "POST", body: fd, headers: { Authorization: `Bearer ${accessToken}` } });
                                  const res: any = await uploadRes.json(); setHomepageForm((p: any) => ({ ...p, image_url: res.url || res.image_url })); } catch {}
                              }} /></label>
                          </div></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="text-xs font-semibold text-gray-600 block mb-1">Title (EN)</label>
                            <input value={homepageForm.title} onChange={(e) => setHomepageForm((p: any) => ({ ...p, title: e.target.value }))}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" /></div>
                          <div><label className="text-xs font-semibold text-gray-600 font-bn block mb-1">টাইটেল (বাংলা)</label>
                            <input value={homepageForm.title_bn} onChange={(e) => setHomepageForm((p: any) => ({ ...p, title_bn: e.target.value }))}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="text-xs font-semibold text-gray-600 block mb-1">Label</label>
                            <input value={homepageForm.label} onChange={(e) => setHomepageForm((p: any) => ({ ...p, label: e.target.value }))}
                              placeholder="e.g. Art Class · Level 8" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" /></div>
                          <div><label className="text-xs font-semibold text-gray-600 block mb-1">Column Group</label>
                            <select value={homepageForm.column_group} onChange={(e) => setHomepageForm((p: any) => ({ ...p, column_group: parseInt(e.target.value) }))}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400">
                              <option value={1}>Column 1 (scroll up)</option><option value={2}>Column 2 (scroll down)</option>
                            </select></div>
                        </div>
                        <div><label className="text-xs font-semibold text-gray-600 block mb-1">Sort Order</label>
                          <input type="number" value={homepageForm.sort_order} onChange={(e) => setHomepageForm((p: any) => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" /></div>
                        <button type="submit" className="w-full py-2.5 bg-primary-700 text-white font-semibold rounded-lg hover:bg-primary-800 text-sm font-bn">
                          {editHomepageItem ? "আপডেট" : "আপলোড করুন"}</button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Activities Sub-tab ── */}
            {homepageSubTab === "activities" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold font-bn text-gray-700">অ্যাক্টিভিটি কার্ড</h2>
                  <button onClick={() => {
                    setEditHomepageItem(null);
                    setHomepageForm({ title: "", title_bn: "", description: "", description_bn: "", image_url: "", icon_name: "Palette", border_color: "border-primary-500", time_label: "", xp_label: "", cta_text: "", cta_text_bn: "", sort_order: 0 });
                    setShowHomepageForm(true);
                  }} className="flex items-center gap-2 px-4 py-2 bg-primary-700 text-white text-sm font-semibold rounded-lg hover:bg-primary-800">
                    <Plus className="w-4 h-4" /> যোগ করুন
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {homepageData.activities.map((item: any) => (
                    <div key={item.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                      {item.image_url && (
                        <div className="aspect-video bg-gray-100">
                          <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-bold text-sm text-gray-800 font-bn">{item.title_bn || item.title}</h3>
                          <div className="flex gap-1">
                            <button onClick={() => {
                              setEditHomepageItem(item);
                              setHomepageForm({ title: item.title, title_bn: item.title_bn || "", description: item.description || "", description_bn: item.description_bn || "", image_url: item.image_url || "", icon_name: item.icon_name || "Palette", border_color: item.border_color || "border-primary-500", time_label: item.time_label || "", xp_label: item.xp_label || "", cta_text: item.cta_text || "", cta_text_bn: item.cta_text_bn || "", sort_order: item.sort_order || 0 });
                              setShowHomepageForm(true);
                            }} className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg"><Edit3 className="w-3.5 h-3.5" /></button>
                            <button onClick={async () => {
                              if (!confirm("ডিলিট?")) return;
                              await api.delete(`/homepage-content/activities/${item.id}`, accessToken!);
                              loadHomepageData();
                            }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mb-2 line-clamp-2">{item.description_bn || item.description || "—"}</p>
                        <div className="flex items-center gap-3 text-[10px] text-gray-400 font-semibold">
                          {item.time_label && <span>{item.time_label}</span>}
                          {item.xp_label && <span>{item.xp_label}</span>}
                          <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded">{item.icon_name}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {homepageData.activities.length === 0 && <p className="text-sm text-gray-400 text-center py-8 font-bn">কোনো অ্যাক্টিভিটি নেই</p>}
                {/* Activities Form Modal */}
                {showHomepageForm && homepageSubTab === "activities" && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowHomepageForm(false)}>
                    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold font-bn">{editHomepageItem ? "এডিট" : "নতুন"} অ্যাক্টিভিটি</h2>
                        <button onClick={() => setShowHomepageForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
                      </div>
                      <form onSubmit={async (e) => {
                        e.preventDefault();
                        try {
                          if (editHomepageItem) await api.patch(`/homepage-content/activities/${editHomepageItem.id}`, homepageForm, accessToken!);
                          else await api.post("/homepage-content/activities/", homepageForm, accessToken!);
                          setShowHomepageForm(false); loadHomepageData();
                        } catch (err: any) { alert(err.message || "Error"); }
                      }} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="text-xs font-semibold text-gray-600 block mb-1">Title (EN) *</label>
                            <input required value={homepageForm.title} onChange={(e) => setHomepageForm((p: any) => ({ ...p, title: e.target.value }))}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" /></div>
                          <div><label className="text-xs font-semibold text-gray-600 font-bn block mb-1">টাইটেল (বাংলা)</label>
                            <input value={homepageForm.title_bn} onChange={(e) => setHomepageForm((p: any) => ({ ...p, title_bn: e.target.value }))}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="text-xs font-semibold text-gray-600 block mb-1">Description (EN)</label>
                            <textarea value={homepageForm.description} onChange={(e) => setHomepageForm((p: any) => ({ ...p, description: e.target.value }))}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400 h-16 resize-none" /></div>
                          <div><label className="text-xs font-semibold text-gray-600 font-bn block mb-1">বিবরণ (বাংলা)</label>
                            <textarea value={homepageForm.description_bn} onChange={(e) => setHomepageForm((p: any) => ({ ...p, description_bn: e.target.value }))}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400 h-16 resize-none font-bn" /></div>
                        </div>
                        <div><label className="text-xs font-semibold text-gray-600 block mb-1">Cover Image</label>
                          <div className="flex gap-2">
                            <input value={homepageForm.image_url} onChange={(e) => setHomepageForm((p: any) => ({ ...p, image_url: e.target.value }))} placeholder="URL or upload"
                              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" />
                            <label className="px-3 py-2 bg-gray-100 rounded-lg text-xs font-semibold text-gray-600 cursor-pointer hover:bg-gray-200">Upload
                              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                const file = e.target.files?.[0]; if (!file) return;
                                const fd = new FormData(); fd.append("file", file); fd.append("folder", "homepage");
                                try { const uploadRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1"}/uploads/image`, { method: "POST", body: fd, headers: { Authorization: `Bearer ${accessToken}` } });
                                  const res: any = await uploadRes.json(); setHomepageForm((p: any) => ({ ...p, image_url: res.url || res.image_url })); } catch {}
                              }} /></label>
                          </div></div>
                        <div className="grid grid-cols-3 gap-3">
                          <div><label className="text-xs font-semibold text-gray-600 block mb-1">Icon</label>
                            <select value={homepageForm.icon_name} onChange={(e) => setHomepageForm((p: any) => ({ ...p, icon_name: e.target.value }))}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400">
                              <option value="Palette">Palette</option><option value="Brain">Brain</option><option value="Languages">Languages</option>
                              <option value="Rocket">Rocket</option><option value="Star">Star</option><option value="BookOpen">BookOpen</option>
                              <option value="Music">Music</option><option value="Calculator">Calculator</option><option value="Code">Code</option>
                            </select></div>
                          <div><label className="text-xs font-semibold text-gray-600 block mb-1">Time</label>
                            <input value={homepageForm.time_label} onChange={(e) => setHomepageForm((p: any) => ({ ...p, time_label: e.target.value }))}
                              placeholder="15-20 Min" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" /></div>
                          <div><label className="text-xs font-semibold text-gray-600 block mb-1">XP</label>
                            <input value={homepageForm.xp_label} onChange={(e) => setHomepageForm((p: any) => ({ ...p, xp_label: e.target.value }))}
                              placeholder="500 XP" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="text-xs font-semibold text-gray-600 block mb-1">Border Color</label>
                            <select value={homepageForm.border_color} onChange={(e) => setHomepageForm((p: any) => ({ ...p, border_color: e.target.value }))}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400">
                              <option value="border-primary-500">Purple</option><option value="border-orange-500">Orange</option>
                              <option value="border-blue-500">Blue</option><option value="border-emerald-500">Green</option><option value="border-red-500">Red</option>
                            </select></div>
                          <div><label className="text-xs font-semibold text-gray-600 block mb-1">Sort Order</label>
                            <input type="number" value={homepageForm.sort_order} onChange={(e) => setHomepageForm((p: any) => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="text-xs font-semibold text-gray-600 block mb-1">CTA Text (EN)</label>
                            <input value={homepageForm.cta_text} onChange={(e) => setHomepageForm((p: any) => ({ ...p, cta_text: e.target.value }))}
                              placeholder="Start Painting" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" /></div>
                          <div><label className="text-xs font-semibold text-gray-600 font-bn block mb-1">CTA (বাংলা)</label>
                            <input value={homepageForm.cta_text_bn} onChange={(e) => setHomepageForm((p: any) => ({ ...p, cta_text_bn: e.target.value }))}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn" /></div>
                        </div>
                        <button type="submit" className="w-full py-2.5 bg-primary-700 text-white font-semibold rounded-lg hover:bg-primary-800 text-sm font-bn">
                          {editHomepageItem ? "আপডেট" : "তৈরি করুন"}</button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Site Settings */}
        {activeTab === "settings" && (
          <div className="max-w-4xl">
            <h1 className="text-xl font-bold mb-6 font-bn">সাইট সেটিংস</h1>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api.put("/settings/site", siteSettingsForm, accessToken!);
                  const { useSiteStore } = await import("@/stores/site-store");
                  await useSiteStore.getState().fetchSettings();
                  import("@/stores/toast-store").then(m => m.toast.success("সেটিংস আপডেট সফল!"));
                } catch (err) {
                  import("@/stores/toast-store").then(m => m.toast.error("আপডেট ব্যর্থ হয়েছে"));
                }
              }} className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold border-b pb-2 mb-4">Branding</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Platform Name</label>
                      <input value={siteSettingsForm.platform_name || ""} onChange={e => setSiteSettingsForm((p: any) => ({ ...p, platform_name: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" required />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Logo URL</label>
                      <input value={siteSettingsForm.logo_url || ""} onChange={e => setSiteSettingsForm((p: any) => ({ ...p, logo_url: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold border-b pb-2 mb-4">Contact Info</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Support Phone</label>
                      <input value={siteSettingsForm.support_phone || ""} onChange={e => setSiteSettingsForm((p: any) => ({ ...p, support_phone: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Support Email</label>
                      <input value={siteSettingsForm.support_email || ""} onChange={e => setSiteSettingsForm((p: any) => ({ ...p, support_email: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Office Address</label>
                      <input value={siteSettingsForm.office_address || ""} onChange={e => setSiteSettingsForm((p: any) => ({ ...p, office_address: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold border-b pb-2 mb-4">Social URLs (Leave blank to hide)</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Facebook</label>
                      <input value={siteSettingsForm.facebook_url || ""} onChange={e => setSiteSettingsForm((p: any) => ({ ...p, facebook_url: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">YouTube</label>
                      <input value={siteSettingsForm.youtube_url || ""} onChange={e => setSiteSettingsForm((p: any) => ({ ...p, youtube_url: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Instagram</label>
                      <input value={siteSettingsForm.instagram_url || ""} onChange={e => setSiteSettingsForm((p: any) => ({ ...p, instagram_url: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">LinkedIn</label>
                      <input value={siteSettingsForm.linkedin_url || ""} onChange={e => setSiteSettingsForm((p: any) => ({ ...p, linkedin_url: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold border-b pb-2 mb-4">Footer Text</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">English Description</label>
                      <textarea value={siteSettingsForm.footer_description_en || ""} onChange={e => setSiteSettingsForm((p: any) => ({ ...p, footer_description_en: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm h-20" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Bangla Description</label>
                      <textarea value={siteSettingsForm.footer_description_bn || ""} onChange={e => setSiteSettingsForm((p: any) => ({ ...p, footer_description_bn: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm h-20 font-bn" />
                    </div>
                  </div>
                </div>

                {/* Feature Toggles */}
                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                  <h3 className="text-sm font-bold text-gray-800 mb-1 font-bn">ফিচার টগল</h3>
                  <p className="text-xs text-gray-400 mb-4 font-bn">বন্ধ করলে সেকশনটি অ্যাডমিন সাইডবার ও পুরো প্ল্যাটফর্ম থেকে সম্পূর্ণ লুকিয়ে যাবে।</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { key: "games", label: "গেমস", labelEn: "Games" },
                      { key: "abacus", label: "অ্যাবাকাস", labelEn: "Abacus" },
                      { key: "badges", label: "ব্যাজ", labelEn: "Badges" },
                      { key: "gallery", label: "গ্যালারি", labelEn: "Gallery" },
                      { key: "challenges", label: "চ্যালেঞ্জ", labelEn: "Challenges" },
                    ].map(({ key, label, labelEn }) => {
                      const enabled = siteSettingsForm.feature_flags?.[key] !== false;
                      return (
                        <label key={key} className="flex items-center justify-between gap-3 bg-white rounded-xl px-4 py-3 border border-gray-100 cursor-pointer hover:border-primary-200 transition-colors">
                          <span className="text-sm font-semibold text-gray-700 font-bn">{label} <span className="text-gray-400 font-normal text-xs">({labelEn})</span></span>
                          <button
                            type="button"
                            onClick={() => setSiteSettingsForm((p: any) => ({ ...p, feature_flags: { ...(p.feature_flags || {}), [key]: !enabled } }))}
                            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ease-in-out shrink-0 ${enabled ? "bg-primary-600" : "bg-gray-300"}`}
                          >
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${enabled ? "translate-x-5" : "translate-x-0"}`} />
                          </button>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Payment Method Toggles */}
                <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                  <h3 className="text-sm font-bold text-gray-800 mb-1 font-bn">💳 পেমেন্ট মাধ্যম</h3>
                  <p className="text-xs text-gray-400 mb-4 font-bn">চেকআউটে কোন পেমেন্ট অপশনগুলো দেখাবে তা এখান থেকে নিয়ন্ত্রণ করুন।</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { key: "payment_bkash", label: "বিকাশ", labelEn: "bKash", color: "bg-pink-50 border-pink-200" },
                      { key: "payment_nagad", label: "নগদ", labelEn: "Nagad", color: "bg-orange-50 border-orange-200" },
                      { key: "payment_card", label: "কার্ড/ব্যাংক", labelEn: "Card/Bank", color: "bg-slate-50 border-slate-200" },
                      { key: "payment_cod", label: "ক্যাশ অন ডেলিভারি", labelEn: "COD", color: "bg-emerald-50 border-emerald-200" },
                      { key: "payment_demo", label: "ডেমো", labelEn: "Demo", color: "bg-violet-50 border-violet-200" },
                    ].map(({ key, label, labelEn, color }) => {
                      const enabled = siteSettingsForm.feature_flags?.[key] !== false;
                      return (
                        <label key={key} className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 border cursor-pointer hover:border-primary-200 transition-colors ${enabled ? color : "bg-white border-gray-100 opacity-60"}`}>
                          <span className="text-sm font-semibold text-gray-700 font-bn">{label} <span className="text-gray-400 font-normal text-xs">({labelEn})</span></span>
                          <button
                            type="button"
                            onClick={() => setSiteSettingsForm((p: any) => ({ ...p, feature_flags: { ...(p.feature_flags || {}), [key]: !enabled } }))}
                            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ease-in-out shrink-0 ${enabled ? "bg-primary-600" : "bg-gray-300"}`}
                          >
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${enabled ? "translate-x-5" : "translate-x-0"}`} />
                          </button>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 flex justify-end">
                  <button type="submit" className="px-6 py-2 bg-primary-700 text-white font-semibold rounded-xl hover:bg-primary-800 transition-all font-bn">
                    সেটিংস সেভ করো
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Instructors */}
        {activeTab === "instructors" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold font-bn">ইন্সট্রাক্টর ম্যানেজমেন্ট</h1>
              <button
                onClick={() => {
                  setShowInstructorForm(true);
                  setEditInstructor(null);
                  setInstructorForm({
                    name: "", name_bn: "", designation: "", designation_bn: "", bio: "", bio_bn: "",
                    profile_image_url: "", email: "", phone: "", facebook_url: "", linkedin_url: ""
                  });
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary-700 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 transition-all font-bn"
              >
                <Plus className="w-4 h-4" /> নতুন ইন্সট্রাক্টর
              </button>
            </div>

            {/* Instructor Form Modal */}
            {showInstructorForm && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowInstructorForm(false)}>
                <div className="bg-white rounded-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold font-bn">{editInstructor ? "ইন্সট্রাক্টর এডিট" : "নতুন ইন্সট্রাক্টর"}</h2>
                    <button onClick={() => setShowInstructorForm(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                  </div>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      const payload = { ...instructorForm };
                      if (editInstructor) {
                        await api.patch(`/instructors/${editInstructor.id}`, payload, accessToken!);
                        import("@/stores/toast-store").then(m => m.toast.success("ইন্সট্রাক্টর আপডেট হয়েছে"));
                      } else {
                        await api.post("/instructors/", payload, accessToken!);
                        import("@/stores/toast-store").then(m => m.toast.success("ইন্সট্রাক্টর তৈরি হয়েছে"));
                      }
                      setShowInstructorForm(false);
                      const data: any = await api.get("/instructors/");
                      setListData(data || []);
                    } catch (err: any) {
                      import("@/stores/toast-store").then(m => m.toast.error("আপডেট ব্যর্থ হয়েছে"));
                    }
                  }} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Name (English)</label>
                        <input value={instructorForm.name} onChange={e => setInstructorForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none" required />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">নাম (বাংলা)</label>
                        <input value={instructorForm.name_bn} onChange={e => setInstructorForm(p => ({ ...p, name_bn: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none font-bn" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Designation (English)</label>
                        <input value={instructorForm.designation} onChange={e => setInstructorForm(p => ({ ...p, designation: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">পদবি (বাংলা)</label>
                        <input value={instructorForm.designation_bn} onChange={e => setInstructorForm(p => ({ ...p, designation_bn: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none font-bn" />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Bio (English)</label>
                        <textarea value={instructorForm.bio} onChange={e => setInstructorForm(p => ({ ...p, bio: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm h-20 outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">বায়ো (বাংলা)</label>
                        <textarea value={instructorForm.bio_bn} onChange={e => setInstructorForm(p => ({ ...p, bio_bn: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm h-20 outline-none font-bn" />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Profile Image URL</label>
                        <input value={instructorForm.profile_image_url} onChange={e => setInstructorForm(p => ({ ...p, profile_image_url: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
                        <input value={instructorForm.email} onChange={e => setInstructorForm(p => ({ ...p, email: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none" />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Facebook URL</label>
                        <input value={instructorForm.facebook_url} onChange={e => setInstructorForm(p => ({ ...p, facebook_url: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">LinkedIn URL</label>
                        <input value={instructorForm.linkedin_url} onChange={e => setInstructorForm(p => ({ ...p, linkedin_url: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none" />
                      </div>
                    </div>

                    <button type="submit" className="w-full py-2.5 bg-primary-700 text-white font-semibold rounded-xl hover:bg-primary-800 transition-all text-sm font-bn">
                      {editInstructor ? "আপডেট করো" : "সেভ করো"}
                    </button>
                  </form>
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              {listData.map((inst: any) => (
                <div key={inst.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden shrink-0">
                    {inst.profile_image_url ? (
                      <img src={inst.profile_image_url} alt={inst.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center text-lg font-bold text-gray-400">
                        {inst.name[0]}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 font-bn text-sm truncate">{inst.name_bn || inst.name}</h3>
                    <p className="text-[11px] text-gray-500 font-bn mb-2">{inst.designation_bn || inst.designation || "কোনো পদবি নেই"}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditInstructor(inst);
                          setInstructorForm({
                            name: inst.name || "", name_bn: inst.name_bn || "",
                            designation: inst.designation || "", designation_bn: inst.designation_bn || "",
                            bio: inst.bio || "", bio_bn: inst.bio_bn || "",
                            profile_image_url: inst.profile_image_url || "",
                            email: inst.email || "", phone: inst.phone || "",
                            facebook_url: inst.facebook_url || "", linkedin_url: inst.linkedin_url || ""
                          });
                          setShowInstructorForm(true);
                        }}
                        className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-100 font-bn"
                      >
                        এডিট
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm("Remove instructor?")) return;
                          try {
                            await api.delete(`/instructors/${inst.id}`, accessToken!);
                            setListData(prev => prev.filter(x => x.id !== inst.id));
                          } catch {}
                        }}
                        className="px-3 py-1 bg-red-50 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-100 font-bn"
                      >
                        মুছো
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Users */}
        {activeTab === "users" && (
          <div>
            <h1 className="text-xl font-bold mb-4 font-bn">ইউজার ম্যানেজমেন্ট</h1>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 font-bn">নাম</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">ফোন</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">রোল</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">স্ট্যাটাস</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-600">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {listData.map((u: any) => (
                      <tr key={u.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-medium font-bn">{u.full_name}</td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{u.phone}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {u.roles?.map((r: string) => (
                              <span key={r} className="px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-[10px] font-semibold">
                                {r}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            u.is_active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                          }`}>
                            {u.is_active ? "Active" : "Banned"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={async () => {
                              try {
                                const action = u.is_active ? "ban" : "unban";
                                await api.post(`/users/${u.id}/${action}`, {}, accessToken!);
                                import("@/stores/toast-store").then((m) => m.toast.success(`User set to ${action === 'ban' ? 'banned' : 'active'}`));
                                setListData(listData.map(user => user.id === u.id ? { ...user, is_active: !u.is_active } : user));
                              } catch (e: any) {
                                import("@/stores/toast-store").then((m) => m.toast.error("An error occurred"));
                              }
                            }}
                            className={`p-1.5 rounded-lg text-white transition-all ${u.is_active ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"}`}
                            title={u.is_active ? "Ban User" : "Unban User"}
                          >
                            {u.is_active ? <Ban className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Orders */}
        {activeTab === "orders" && (
          <OrdersPanel
            accessToken={accessToken!}
            statusFilter={orderStatusFilter as any}
            setStatusFilter={(v) => setOrderStatusFilter(v)}
            timeRange={orderTimeRange as any}
            setTimeRange={(v) => setOrderTimeRange(v)}
            orderCounts={orderCounts}
            refreshKey={ordersRefreshKey}
            onIncrementRefresh={() => setOrdersRefreshKey((k) => k + 1)}
            onView={(o) => setViewOrder(o)}
          />
        )}

        {/* Shipments */}
        {activeTab === "shipments" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold font-bn">শিপমেন্ট ম্যানেজমেন্ট</h1>
            </div>

            {/* Status Filter */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {[
                { value: "", label: "সব", color: "bg-gray-100 text-gray-700" },
                { value: "pending", label: "পেন্ডিং", color: "bg-yellow-100 text-yellow-700" },
                { value: "confirmed", label: "কনফার্মড", color: "bg-blue-100 text-blue-700" },
                { value: "dispatched", label: "ডিসপ্যাচড", color: "bg-purple-100 text-purple-700" },
                { value: "delivered", label: "ডেলিভার্ড", color: "bg-green-100 text-green-700" },
                { value: "cancelled", label: "বাতিল", color: "bg-red-100 text-red-700" },
              ].map(f => (
                <button
                  key={f.value}
                  onClick={() => setShipmentFilter(f.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all font-bn ${
                    shipmentFilter === f.value ? `${f.color} ring-2 ring-offset-1 ring-primary-300` : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Shipment Update Modal */}
            {shipmentEdit && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShipmentEdit(null)}>
                <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold font-bn">শিপমেন্ট আপডেট</h2>
                    <button onClick={() => setShipmentEdit(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="mb-3 p-3 bg-gray-50 rounded-lg text-sm">
                    <p className="font-bn"><strong>প্রাপক:</strong> {shipmentEdit.recipient_name}</p>
                    <p className="text-gray-500 text-xs">{shipmentEdit.delivery_address}</p>
                    <p className="text-gray-500 text-xs mt-1">ফোন: {shipmentEdit.recipient_phone}</p>
                  </div>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await api.patch(`/shipments/${shipmentEdit.id}`, {
                        status: shipmentForm.status,
                        courier_name: shipmentForm.courier_name || undefined,
                        tracking_number: shipmentForm.tracking_number || undefined,
                        admin_notes: shipmentForm.admin_notes || undefined,
                      }, accessToken!);
                      import("@/stores/toast-store").then(m => m.toast.success("শিপমেন্ট আপডেট হয়েছে"));
                      setShipmentEdit(null);
                      // Reload
                      const filter = shipmentFilter ? `?status=${shipmentFilter}` : "";
                      const data: any = await api.get(`/shipments/${filter}`, accessToken!);
                      setListData(data || []);
                    } catch (err: any) { import("@/stores/toast-store").then(m => m.toast.error(err.message || "ত্রুটি")); }
                  }} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">নতুন স্ট্যাটাস</label>
                      <select value={shipmentForm.status} onChange={e => setShipmentForm(p => ({ ...p, status: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none" required>
                        <option value="">সিলেক্ট করো</option>
                        {shipmentEdit.status === "pending" && <><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option></>}
                        {shipmentEdit.status === "confirmed" && <><option value="dispatched">Dispatched</option><option value="cancelled">Cancelled</option></>}
                        {shipmentEdit.status === "dispatched" && <><option value="delivered">Delivered</option><option value="returned">Returned</option></>}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">কুরিয়ার নাম</label>
                      <input value={shipmentForm.courier_name} onChange={e => setShipmentForm(p => ({ ...p, courier_name: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none" placeholder="Pathao / SteadFast / RedX" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">ট্র্যাকিং নম্বর</label>
                      <input value={shipmentForm.tracking_number} onChange={e => setShipmentForm(p => ({ ...p, tracking_number: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none font-mono" placeholder="TRK-XXXX" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">অ্যাডমিন নোট</label>
                      <textarea value={shipmentForm.admin_notes} onChange={e => setShipmentForm(p => ({ ...p, admin_notes: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none h-16 resize-none" />
                    </div>
                    <button type="submit" disabled={!shipmentForm.status}
                      className="w-full py-2.5 bg-primary-700 text-white font-semibold rounded-xl hover:bg-primary-800 transition-all text-sm disabled:opacity-50 font-bn">
                      আপডেট করো
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* Shipment Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 font-bn">প্রাপক</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">জোন</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">স্ট্যাটাস</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">কুরিয়ার / ট্র্যাকিং</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">ঠিকানা</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-600">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {listData.map((s: any) => (
                      <tr key={s.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <p className="font-medium font-bn text-sm">{s.recipient_name}</p>
                          <p className="text-[10px] text-gray-400 font-mono">{s.recipient_phone}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700">
                            {s.zone === "inside_dhaka" ? "ঢাকা" : "ঢাকার বাইরে"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColors[s.status] || "bg-gray-100 text-gray-600"}`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {s.courier_name ? (
                            <div>
                              <p className="font-semibold text-gray-700">{s.courier_name}</p>
                              {s.tracking_number && <p className="font-mono text-gray-400">{s.tracking_number}</p>}
                            </div>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs max-w-40 truncate font-bn">
                          {s.delivery_address}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {!["delivered", "returned", "cancelled"].includes(s.status) ? (
                            <button
                              onClick={() => {
                                setShipmentEdit(s);
                                setShipmentForm({ status: "", courier_name: s.courier_name || "", tracking_number: s.tracking_number || "", admin_notes: "" });
                              }}
                              className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100" title="Update"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          ) : <span className="text-[10px] text-gray-300">—</span>}
                        </td>
                      </tr>
                    ))}
                    {listData.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 font-bn">কোনো শিপমেন্ট নেই</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Courses */}
        {activeTab === "courses" && (
          <div>
            <CoursesPanel
              accessToken={accessToken!}
              categories={adminCategories}
              refreshKey={coursesRefreshKey}
              onCreate={() => {
                setShowCourseForm(true);
                setEditCourse(null);
                setCourseForm({ title: "", title_bn: "", description: "", description_bn: "", price: "0", is_free: false, course_type: "recorded", thumbnail_url: "", is_featured: false, category_id: "", instructor_id: "" });
              }}
              onEdit={(c: any) => {
                setEditCourse(c as any);
                setCourseForm({
                  title: c.product?.title || "",
                  title_bn: c.product?.title_bn || "",
                  description: c.product?.description || "",
                  description_bn: c.product?.description_bn || "",
                  price: String(c.product?.price || 0),
                  is_free: c.product?.is_free || false,
                  course_type: c.course_type,
                  thumbnail_url: c.product?.thumbnail_url || "",
                  is_featured: c.is_featured,
                  category_id: c.category_id ? String(c.category_id) : "",
                  instructor_id: c.instructor_id || "",
                });
                setShowCourseForm(true);
              }}
            />

            {/* Course Form Modal */}
            {showCourseForm && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCourseForm(false)}>
                <div className="bg-white rounded-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold font-bn">{editCourse ? "কোর্স এডিট করো" : "নতুন কোর্স তৈরি করো"}</h2>
                    <button onClick={() => setShowCourseForm(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
                  </div>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      const payload: any = {
                        title: courseForm.title,
                        title_bn: courseForm.title_bn || undefined,
                        description: courseForm.description || undefined,
                        description_bn: courseForm.description_bn || undefined,
                        price: parseFloat(courseForm.price) || 0,
                        is_free: courseForm.is_free,
                        course_type: courseForm.course_type,
                        thumbnail_url: courseForm.thumbnail_url || undefined,
                        is_featured: courseForm.is_featured,
                        category_id: courseForm.category_id ? parseInt(courseForm.category_id) : undefined,
                        instructor_id: courseForm.instructor_id || undefined,
                      };
                      if (editCourse) {
                        await api.patch(`/courses/${editCourse.id}`, payload, accessToken!);
                        import("@/stores/toast-store").then(m => m.toast.success("কোর্স আপডেট হয়েছে"));
                      } else {
                        await api.post("/courses/", payload, accessToken!);
                        import("@/stores/toast-store").then(m => m.toast.success("কোর্স তৈরি হয়েছে"));
                      }
                      setShowCourseForm(false);
                      setCoursesRefreshKey((k) => k + 1);
                    } catch (err: any) {
                      import("@/stores/toast-store").then(m => m.toast.error(err.message || "ত্রুটি হয়েছে"));
                    }
                  }} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Title (English)</label>
                      <input value={courseForm.title} onChange={e => setCourseForm(p => ({ ...p, title: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" required />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">নাম (বাংলা)</label>
                      <input value={courseForm.title_bn} onChange={e => setCourseForm(p => ({ ...p, title_bn: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Description (English)</label>
                      <textarea value={courseForm.description} onChange={e => setCourseForm(p => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400 h-20 resize-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">বর্ণনা (বাংলা)</label>
                      <textarea value={courseForm.description_bn} onChange={e => setCourseForm(p => ({ ...p, description_bn: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400 h-20 resize-none font-bn" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Price (৳)</label>
                        <input type="number" value={courseForm.price} onChange={e => setCourseForm(p => ({ ...p, price: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
                        <select value={courseForm.course_type} onChange={e => setCourseForm(p => ({ ...p, course_type: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none">
                          <option value="recorded">Recorded</option>
                          <option value="live">Live</option>
                          <option value="hybrid">Hybrid</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
                      <select value={courseForm.category_id} onChange={e => setCourseForm(p => ({ ...p, category_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none">
                        <option value="">— No Category —</option>
                        {adminCategories.map((cat: any) => (
                          <option key={cat.id} value={cat.id}>{cat.name_bn || cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Instructor</label>
                      <select value={courseForm.instructor_id} onChange={e => setCourseForm(p => ({ ...p, instructor_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none font-bn">
                        <option value="">— No Instructor —</option>
                        {adminInstructors.map((inst: any) => (
                          <option key={inst.id} value={inst.id}>{inst.name_bn || inst.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Thumbnail</label>
                      <div className="flex gap-2">
                        <input value={courseForm.thumbnail_url} onChange={e => setCourseForm(p => ({ ...p, thumbnail_url: e.target.value }))} className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" placeholder="URL or upload" />
                        <label className="px-3 py-2 bg-gray-100 rounded-lg text-xs font-semibold text-gray-600 cursor-pointer hover:bg-gray-200 flex items-center gap-1">
                          <Image className="w-3.5 h-3.5" />
                          Upload
                          <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const fd = new FormData();
                            fd.append("file", file);
                            fd.append("folder", "course-thumbnails");
                            try {
                              const res: any = await api.postFormData("/uploads/image", fd, accessToken!);
                              setCourseForm(p => ({ ...p, thumbnail_url: res.url || res.image_url }));
                              import("@/stores/toast-store").then(m => m.toast.success("ছবি আপলোড হয়েছে"));
                            } catch {
                              import("@/stores/toast-store").then(m => m.toast.error("আপলোড ব্যর্থ হয়েছে"));
                            }
                          }} />
                        </label>
                      </div>
                      {courseForm.thumbnail_url && (
                        <img src={courseForm.thumbnail_url} alt="Preview" className="mt-2 h-24 rounded-lg object-cover border border-gray-100" />
                      )}
                    </div>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={courseForm.is_free} onChange={e => setCourseForm(p => ({ ...p, is_free: e.target.checked }))} className="rounded" />
                        <span className="font-bn">ফ্রি</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={courseForm.is_featured} onChange={e => setCourseForm(p => ({ ...p, is_featured: e.target.checked }))} className="rounded" />
                        <span className="font-bn">ফিচার্ড</span>
                      </label>
                    </div>
                    <button type="submit" className="w-full py-2.5 bg-primary-700 text-white font-semibold rounded-xl hover:bg-primary-800 transition-all text-sm">
                      {editCourse ? "আপডেট করো" : "তৈরি করো"}
                    </button>
                  </form>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Exams */}
        {activeTab === "exams" && (
          <div>
            <ExamsPanel
              accessToken={accessToken!}
              refreshKey={examsRefreshKey}
              onCreate={() => {
                setShowExamCreateForm(true);
                setExamCreateForm({ title: "", title_bn: "", exam_type: "anytime", price: "0", is_free: false, pass_percentage: "60" });
              }}
            />

            {/* Create Exam Modal */}
            {showExamCreateForm && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowExamCreateForm(false)}>
                <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold font-bn">নতুন পরীক্ষা তৈরি করুন</h2>
                    <button onClick={() => setShowExamCreateForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
                  </div>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    setExamCreateSaving(true);
                    try {
                      const created: any = await api.post("/exams/", {
                        title: examCreateForm.title,
                        title_bn: examCreateForm.title_bn || undefined,
                        exam_type: examCreateForm.exam_type,
                        price: parseFloat(examCreateForm.price) || 0,
                        is_free: examCreateForm.is_free,
                        pass_percentage: parseInt(examCreateForm.pass_percentage) || 60,
                      }, accessToken!);
                      setShowExamCreateForm(false);
                      setExamsRefreshKey((k) => k + 1);
                      import("@/stores/toast-store").then(m => m.toast.success("পরীক্ষা তৈরি হয়েছে!"));
                      if (created?.id) router.push(`/admin/exams/${created.id}`);
                    } catch (err: any) {
                      import("@/stores/toast-store").then(m => m.toast.error(err?.message || "পরীক্ষা তৈরি ব্যর্থ হয়েছে"));
                    }
                    setExamCreateSaving(false);
                  }} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">শিরোনাম (English) *</label>
                      <input
                        required
                        value={examCreateForm.title}
                        onChange={e => setExamCreateForm(p => ({ ...p, title: e.target.value }))}
                        placeholder="e.g. Math Level 1"
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">শিরোনাম (বাংলা)</label>
                      <input
                        value={examCreateForm.title_bn}
                        onChange={e => setExamCreateForm(p => ({ ...p, title_bn: e.target.value }))}
                        placeholder="যেমন: গণিত লেভেল ১"
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Exam Type</label>
                        <select value={examCreateForm.exam_type} onChange={e => setExamCreateForm(p => ({ ...p, exam_type: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400">
                          <option value="anytime">Anytime</option>
                          <option value="scheduled">Scheduled</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Pass % (default 60)</label>
                        <input type="number" min="1" max="100" value={examCreateForm.pass_percentage} onChange={e => setExamCreateForm(p => ({ ...p, pass_percentage: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 items-end">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Price (৳)</label>
                        <input type="number" min="0" value={examCreateForm.price} onChange={e => setExamCreateForm(p => ({ ...p, price: e.target.value }))} disabled={examCreateForm.is_free} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400 disabled:bg-gray-50 disabled:text-gray-400" />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer pb-2.5">
                        <input type="checkbox" checked={examCreateForm.is_free} onChange={e => setExamCreateForm(p => ({ ...p, is_free: e.target.checked }))} className="w-4 h-4 rounded accent-primary-600" />
                        <span className="text-sm font-semibold text-gray-700">ফ্রি পরীক্ষা</span>
                      </label>
                    </div>
                    <button type="submit" disabled={examCreateSaving} className="w-full py-3 bg-primary-700 text-white rounded-xl font-bold font-bn hover:bg-primary-800 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                      {examCreateSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      তৈরি করুন ও এডিট করুন
                    </button>
                  </form>
                </div>
              </div>
            )}


          </div>
        )}

        {/* Games */}
        {activeTab === "games" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold">Games Management</h1>
              <button
                onClick={() => { setShowGameForm(true); setGameForm({ title: "", title_bn: "", game_type: "memory", difficulty: "easy" }); }}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-primary-700 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 transition-all shadow-sm hover:shadow-md"
              >
                <Plus className="w-4 h-4" /> Create Game
              </button>
            </div>

            {showGameForm && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowGameForm(false)}>
                <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold">Create New Game</h2>
                    <button onClick={() => setShowGameForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
                  </div>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      const created: any = await api.post("/games/", {
                        title: gameForm.title,
                        title_bn: gameForm.title_bn || undefined,
                        game_type: gameForm.game_type,
                        difficulty: gameForm.difficulty,
                        is_free: true,
                      }, accessToken!);
                      setShowGameForm(false);
                      import("@/stores/toast-store").then(m => m.toast.success("Game created!"));
                      if (created?.id) router.push(`/admin/games/${created.id}`);
                    } catch (err: any) {
                      import("@/stores/toast-store").then(m => m.toast.error(err?.message || "Failed to create game"));
                    }
                  }} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                      <input
                        required
                        value={gameForm.title}
                        onChange={(e) => setGameForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="Game title"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Title (Bengali)</label>
                      <input
                        value={gameForm.title_bn}
                        onChange={(e) => setGameForm(f => ({ ...f, title_bn: e.target.value }))}
                        placeholder="বাংলা শিরোনাম"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 font-bn"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Game Type</label>
                      <select
                        value={gameForm.game_type}
                        onChange={(e) => setGameForm(f => ({ ...f, game_type: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                      >
                        <option value="memory">Memory</option>
                        <option value="drag_drop">Drag &amp; Drop</option>
                        <option value="crossword">Crossword</option>
                        <option value="find_words">Find the Words</option>
                        <option value="image_sequence">Image Sequencing</option>
                        <option value="arithmetic">Arithmetic</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Difficulty</label>
                      <select
                        value={gameForm.difficulty}
                        onChange={(e) => setGameForm(f => ({ ...f, difficulty: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-primary-700 text-white rounded-xl text-sm font-bold hover:bg-primary-800 transition-all"
                    >
                      Create Game
                    </button>
                  </form>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Difficulty</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plays</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Active</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {gamesData.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-12 text-gray-400 text-sm">No games yet</td></tr>
                  )}
                  {gamesData.map((game: any) => {
                    const typeColors: Record<string, string> = {
                      memory: "bg-purple-50 text-purple-700",
                      drag_drop: "bg-orange-50 text-orange-700",
                      crossword: "bg-blue-50 text-blue-700",
                      find_words: "bg-teal-50 text-teal-700",
                      image_sequence: "bg-sky-50 text-sky-700",
                      arithmetic: "bg-green-50 text-green-700",
                    };
                    const typeLabels: Record<string, string> = {
                      memory: "Memory",
                      drag_drop: "Drag & Drop",
                      crossword: "Crossword",
                      find_words: "Find Words",
                      image_sequence: "Image Seq",
                      arithmetic: "Arithmetic",
                    };
                    const diffColors: Record<string, string> = {
                      easy: "bg-green-50 text-green-700",
                      medium: "bg-yellow-50 text-yellow-700",
                      hard: "bg-red-50 text-red-700",
                    };
                    return (
                      <tr key={game.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900 text-sm">{game.title_bn || game.title}</p>
                          {game.title_bn && <p className="text-xs text-gray-400">{game.title}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${typeColors[game.game_type] || "bg-gray-50 text-gray-600"}`}>
                            {typeLabels[game.game_type] || game.game_type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${diffColors[game.difficulty] || "bg-gray-50 text-gray-600"}`}>
                            {game.difficulty || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{game.total_plays ?? 0}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {game.is_free ? <span className="text-green-600 font-semibold">Free</span> : `৳${game.price ?? 0}`}
                        </td>
                        <td className="px-4 py-3">
                          {game.is_active !== false
                            ? <span className="text-green-600 font-semibold text-xs">Active</span>
                            : <span className="text-gray-400 text-xs">Inactive</span>
                          }
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/games/${game.id}`}
                            className="p-1.5 rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100 inline-flex items-center"
                            title="Edit Game"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Abacus */}
        {activeTab === "abacus" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold">Abacus Courses</h1>
              <button
                onClick={() => { setShowAbacusForm(true); setAbacusForm({ title: "", title_bn: "", load_defaults: true }); }}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-primary-700 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 transition-all shadow-sm hover:shadow-md"
              >
                <Plus className="w-4 h-4" /> Create Course
              </button>
            </div>

            {showAbacusForm && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAbacusForm(false)}>
                <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold">Create Abacus Course</h2>
                    <button onClick={() => setShowAbacusForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
                  </div>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      const created: any = await api.post(`/abacus/?load_defaults=${abacusForm.load_defaults}`, {
                        title: abacusForm.title,
                        title_bn: abacusForm.title_bn || undefined,
                      }, accessToken!);
                      setShowAbacusForm(false);
                      import("@/stores/toast-store").then(m => m.toast.success("Abacus course created!"));
                      if (created?.id) router.push(`/admin/abacus/${created.id}`);
                    } catch (err: any) {
                      import("@/stores/toast-store").then(m => m.toast.error(err?.message || "Failed to create course"));
                    }
                  }} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                      <input
                        required
                        value={abacusForm.title}
                        onChange={(e) => setAbacusForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="Course title"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Title (Bengali)</label>
                      <input
                        value={abacusForm.title_bn}
                        onChange={(e) => setAbacusForm(f => ({ ...f, title_bn: e.target.value }))}
                        placeholder="বাংলা শিরোনাম"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 font-bn"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="load_defaults"
                        checked={abacusForm.load_defaults}
                        onChange={(e) => setAbacusForm(f => ({ ...f, load_defaults: e.target.checked }))}
                        className="rounded"
                      />
                      <label htmlFor="load_defaults" className="text-sm text-gray-700 font-semibold">Load default 12-level curriculum</label>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-primary-700 text-white rounded-xl text-sm font-bold hover:bg-primary-800 transition-all"
                    >
                      Create Course
                    </button>
                  </form>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Levels</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Active</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {abacusData.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-12 text-gray-400 text-sm">No abacus courses yet</td></tr>
                  )}
                  {abacusData.map((course: any) => (
                    <tr key={course.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900 text-sm">{course.title_bn || course.title}</p>
                        {course.title_bn && <p className="text-xs text-gray-400">{course.title}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{course.total_levels ?? 0}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {course.is_free ? <span className="text-green-600 font-semibold">Free</span> : `৳${course.price ?? 0}`}
                      </td>
                      <td className="px-4 py-3">
                        {course.is_active !== false
                          ? <span className="text-green-600 font-semibold text-xs">Active</span>
                          : <span className="text-gray-400 text-xs">Inactive</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/abacus/${course.id}`}
                          className="p-1.5 rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100 inline-flex items-center"
                          title="Edit Course"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Coupons */}
        {activeTab === "coupons" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-bold font-bn">কুপন ম্যানেজমেন্ট</h1>
                <p className="text-xs text-gray-400 mt-0.5 font-bn">{listData.length} টি কুপন</p>
              </div>
              <button
                onClick={() => { setShowCouponForm(true); setCouponForm({ code: "", discount_type: "percentage", discount_value: "10", max_uses: "100", is_active: true }); }}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-primary-700 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 transition-all shadow-sm hover:shadow-md font-bn"
              >
                <Plus className="w-4 h-4" /> নতুন কুপন
              </button>
            </div>

            {showCouponForm && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCouponForm(false)}>
                <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold font-bn">নতুন কুপন তৈরি করো</h2>
                    <button onClick={() => setShowCouponForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
                  </div>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await api.post("/coupons/", {
                        code: couponForm.code.toUpperCase(),
                        discount_type: couponForm.discount_type,
                        discount_value: parseFloat(couponForm.discount_value),
                        max_uses: parseInt(couponForm.max_uses),
                        is_active: couponForm.is_active,
                      }, accessToken!);
                      import("@/stores/toast-store").then(m => m.toast.success("কুপন তৈরি হয়েছে"));
                      setShowCouponForm(false);
                      const data: any = await api.get("/coupons/", accessToken || undefined);
                      setListData(data || []);
                    } catch (err: any) { import("@/stores/toast-store").then(m => m.toast.error(err.message || "ত্রুটি")); }
                  }} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 font-bn">কুপন কোড</label>
                      <input value={couponForm.code} onChange={e => setCouponForm(p => ({ ...p, code: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none uppercase font-mono tracking-widest focus:border-primary-400 focus:ring-2 focus:ring-primary-100" required placeholder="SAVE20" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5 font-bn">ডিসকাউন্ট টাইপ</label>
                        <select value={couponForm.discount_type} onChange={e => setCouponForm(p => ({ ...p, discount_type: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none">
                          <option value="percentage">শতাংশ (%)</option>
                          <option value="fixed">নির্দিষ্ট (৳)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5 font-bn">পরিমাণ</label>
                        <input type="number" value={couponForm.discount_value} onChange={e => setCouponForm(p => ({ ...p, discount_value: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none" required />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5 font-bn">সর্বোচ্চ ব্যবহার</label>
                      <input type="number" value={couponForm.max_uses} onChange={e => setCouponForm(p => ({ ...p, max_uses: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none" />
                    </div>
                    <button type="submit" className="w-full py-3 bg-primary-700 text-white font-bold rounded-xl hover:bg-primary-800 transition-all text-sm font-bn">
                      কুপন তৈরি করো
                    </button>
                  </form>
                </div>
              </div>
            )}

            {listData.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
                <Tag className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 font-bn text-sm">এখনো কোনো কুপন তৈরি হয়নি</p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {listData.map((c: any) => {
                  const usagePercent = c.max_uses ? Math.round(((c.times_used || 0) / c.max_uses) * 100) : 0;
                  const isExhausted = c.max_uses && (c.times_used || 0) >= c.max_uses;
                  return (
                    <div key={c.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${c.is_active ? "border-gray-100" : "border-gray-100 opacity-60"}`}>
                      <div className={`px-4 py-3.5 flex items-center justify-between ${c.is_active ? "bg-gradient-to-r from-primary-50/80 to-white" : "bg-gray-50"}`}>
                        <div className="flex items-center gap-2.5">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${c.discount_type === "percentage" ? "bg-purple-100 text-purple-600" : "bg-emerald-100 text-emerald-600"}`}>
                            {c.discount_type === "percentage" ? "%" : "৳"}
                          </div>
                          <div>
                            <p className="font-mono font-bold text-gray-900 tracking-wider text-sm">{c.code}</p>
                            <p className="text-[10px] text-gray-400 font-bn">
                              {c.discount_type === "percentage" ? `${parseFloat(c.discount_value).toFixed(0)}% ছাড়` : `৳${parseFloat(c.discount_value).toFixed(0)} ছাড়`}
                            </p>
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide ${
                          isExhausted ? "bg-orange-100 text-orange-600" : c.is_active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"
                        }`}>
                          {isExhausted ? "শেষ" : c.is_active ? "সক্রিয়" : "নিষ্ক্রিয়"}
                        </span>
                      </div>
                      <div className="px-4 py-3 border-t border-gray-50">
                        <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1.5">
                          <span className="font-bn">ব্যবহার হয়েছে</span>
                          <span className="font-mono font-semibold text-gray-700">{c.times_used || 0} / {c.max_uses || "∞"}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${usagePercent >= 90 ? "bg-red-400" : usagePercent >= 50 ? "bg-yellow-400" : "bg-primary-400"}`}
                            style={{ width: `${Math.min(usagePercent, 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="px-4 pb-3.5">
                        <button
                          onClick={async () => {
                            try {
                              await api.patch(`/coupons/${c.id}`, { is_active: !c.is_active }, accessToken!);
                              setListData(listData.map(x => x.id === c.id ? { ...x, is_active: !c.is_active } : x));
                              import("@/stores/toast-store").then(m => m.toast.success(c.is_active ? "কুপন নিষ্ক্রিয় করা হয়েছে" : "কুপন সক্রিয় করা হয়েছে"));
                            } catch { import("@/stores/toast-store").then(m => m.toast.error("ত্রুটি")); }
                          }}
                          className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 font-bn ${
                            c.is_active
                              ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                              : "bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
                          }`}
                        >
                          {c.is_active ? (
                            <><Ban className="w-3.5 h-3.5" /> নিষ্ক্রিয় করো</>
                          ) : (
                            <><ToggleRight className="w-3.5 h-3.5" /> পুনরায় সক্রিয় করো</>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Ebooks Tab */}
        {activeTab === "ebooks" && (
          <div>
            {showEbookForm && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mb-6">
                <h3 className="font-bold text-gray-900 mb-4 font-bn">{editEbook ? "ই-বুক সম্পাদনা করো" : "নতুন ই-বুক যোগ করো"}</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Title (English) *</label>
                    <input type="text" value={ebookForm.title} onChange={e => setEbookForm(p => ({ ...p, title: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block font-bn">শিরোনাম (বাংলা)</label>
                    <input type="text" value={ebookForm.title_bn} onChange={e => setEbookForm(p => ({ ...p, title_bn: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Author</label>
                    <input type="text" value={ebookForm.author} onChange={e => setEbookForm(p => ({ ...p, author: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Pages</label>
                    <input type="number" value={ebookForm.pages} onChange={e => setEbookForm(p => ({ ...p, pages: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Price (৳)</label>
                    <input type="number" value={ebookForm.price} onChange={e => setEbookForm(p => ({ ...p, price: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Thumbnail (Image Upload)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const fd = new FormData();
                        fd.append("file", file);
                        fd.append("folder", "ebook-thumbnails");
                        try {
                          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/uploads/image`, {
                            method: "POST", body: fd,
                            headers: { Authorization: `Bearer ${accessToken}` },
                          });
                          const data = await res.json();
                          if (data.url) setEbookForm(p => ({ ...p, thumbnail_url: data.url }));
                        } catch {}
                      }}
                      className="w-full text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-primary-50 file:text-primary-700 file:font-semibold file:text-xs hover:file:bg-primary-100 file:cursor-pointer"
                    />
                    {ebookForm.thumbnail_url && <p className="text-[10px] text-green-600 mt-1 truncate">✓ {ebookForm.thumbnail_url}</p>}
                    <input type="text" value={ebookForm.thumbnail_url} onChange={e => setEbookForm(p => ({ ...p, thumbnail_url: e.target.value }))} className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-primary-400 mt-1" placeholder="Or paste URL" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block font-bn">ই-বুক ফাইল (PDF)</label>
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const fd = new FormData();
                        fd.append("file", file);
                        try {
                          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/uploads/ebook-file`, {
                            method: "POST", body: fd,
                            headers: { Authorization: `Bearer ${accessToken}` },
                          });
                          const data = await res.json();
                          if (data.b2_key) setEbookForm(p => ({ ...p, b2_key: data.b2_key }));
                        } catch {}
                      }}
                      className="w-full text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-semibold file:text-xs hover:file:bg-blue-100 file:cursor-pointer"
                    />
                    {ebookForm.b2_key && <p className="text-[10px] text-green-600 mt-1 truncate">✓ {ebookForm.b2_key}</p>}
                  </div>
                </div>
                {/* Free toggle — full width, below grid */}
                <div className="mt-4">
                  <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                    <input type="checkbox" checked={ebookForm.is_free} onChange={e => setEbookForm(p => ({ ...p, is_free: e.target.checked }))} className="w-4 h-4 rounded accent-primary-600" />
                    <div>
                      <p className="text-sm font-semibold text-gray-700 font-bn">ফ্রি ই-বুক</p>
                      <p className="text-[11px] text-gray-400 font-bn">এটি চালু করলে ই-বুকটি বিনামূল্যে ডাউনলোড করা যাবে</p>
                    </div>
                  </label>
                </div>
                <div className="mt-4">
                  <label className="text-xs font-semibold text-gray-500 mb-1 block font-bn">বিবরণ</label>
                  <textarea value={ebookForm.description} onChange={e => setEbookForm(p => ({ ...p, description: e.target.value }))} rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn" />
                </div>
                <button
                  onClick={async () => {
                    if (!ebookForm.title.trim()) return;
                    const payload = {
                      title: ebookForm.title,
                      title_bn: ebookForm.title_bn || null,
                      description: ebookForm.description || null,
                      price: parseFloat(ebookForm.price) || 0,
                      is_free: ebookForm.is_free,
                      author: ebookForm.author || null,
                      pages: ebookForm.pages ? parseInt(ebookForm.pages) : null,
                      thumbnail_url: ebookForm.thumbnail_url || null,
                      b2_key: ebookForm.b2_key || "",
                    };
                    try {
                      if (editEbook) {
                        await api.patch(`/ebooks/${editEbook.id}`, payload, accessToken!);
                      } else {
                        await api.post("/ebooks/", payload, accessToken!);
                      }
                      setShowEbookForm(false);
                      setEditEbook(null);
                      setEbookForm({ title: "", title_bn: "", description: "", price: "0", is_free: false, author: "", pages: "", thumbnail_url: "", b2_key: "" });
                      setEbooksRefreshKey((k) => k + 1);
                      const { toast } = await import("@/stores/toast-store");
                      toast.success(editEbook ? "ই-বুক আপডেট হয়েছে" : "ই-বুক যোগ হয়েছে");
                    } catch (err: any) {
                      const { toast } = await import("@/stores/toast-store");
                      toast.error(err?.message || "Error saving ebook");
                    }
                  }}
                  className="mt-4 px-6 py-2.5 bg-primary-700 text-white font-semibold rounded-xl hover:bg-primary-800 transition-all text-sm font-bn"
                >
                  {editEbook ? "আপডেট করো" : "সেভ করো"}
                </button>
              </div>
            )}

            <EbooksPanel
              accessToken={accessToken!}
              refreshKey={ebooksRefreshKey}
              onCreate={() => {
                setEditEbook(null);
                setEbookForm({ title: "", title_bn: "", description: "", price: "0", is_free: false, author: "", pages: "", thumbnail_url: "", b2_key: "" });
                setShowEbookForm(true);
              }}
              onEdit={(e: any) => {
                setEditEbook(e);
                setEbookForm({
                  title: e.title || "",
                  title_bn: e.title_bn || "",
                  description: e.description || "",
                  price: String(e.price || 0),
                  is_free: e.is_free || false,
                  author: e.author || "",
                  pages: e.pages ? String(e.pages) : "",
                  thumbnail_url: e.thumbnail_url || "",
                  b2_key: e.b2_key || "",
                });
                setShowEbookForm(true);
              }}
            />
          </div>
        )}

        {/* Badges */}
        {activeTab === "badges" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2"><Award className="w-5 h-5 text-primary-600" /> Badge Management</h1>
                <p className="text-xs text-gray-400 mt-0.5">{badgesData.length} badges</p>
              </div>
              <button
                onClick={() => {
                  setEditBadge(null);
                  setBadgeForm({ name: "", name_bn: "", description: "", description_bn: "", category: "general", icon_url: "", criteria: { trigger: "drawing_count", threshold: 1, description: "" }, sort_order: 0 });
                  setShowBadgeForm(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-primary-700 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 transition-all shadow-sm hover:shadow-md"
              >
                <Plus className="w-4 h-4" /> Create Badge
              </button>
            </div>

            {/* Badge Form Modal */}
            {showBadgeForm && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowBadgeForm(false)}>
                <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold">{editBadge ? "Edit Badge" : "Create Badge"}</h2>
                    <button onClick={() => setShowBadgeForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
                  </div>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      const payload = {
                        name: badgeForm.name,
                        name_bn: badgeForm.name_bn || undefined,
                        description: badgeForm.description || undefined,
                        description_bn: badgeForm.description_bn || undefined,
                        category: badgeForm.category,
                        icon_url: badgeForm.icon_url || undefined,
                        criteria: { trigger: badgeForm.criteria.trigger, threshold: Number(badgeForm.criteria.threshold), description: badgeForm.criteria.description || undefined },
                        sort_order: Number(badgeForm.sort_order),
                      };
                      if (editBadge) {
                        await api.put(`/badges/${editBadge.id}`, payload, accessToken!);
                        import("@/stores/toast-store").then(m => m.toast.success("Badge updated!"));
                      } else {
                        await api.post("/badges/", payload, accessToken!);
                        import("@/stores/toast-store").then(m => m.toast.success("Badge created!"));
                      }
                      setShowBadgeForm(false);
                      const data: any = await api.get("/badges/", accessToken!);
                      setBadgesData(Array.isArray(data) ? data : []);
                    } catch (err: any) {
                      import("@/stores/toast-store").then(m => m.toast.error(err?.message || "Error saving badge"));
                    }
                  }} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Name (EN)</label>
                        <input value={badgeForm.name} onChange={e => setBadgeForm(p => ({ ...p, name: e.target.value }))} required className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" placeholder="First Drawing" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Name (BN)</label>
                        <input value={badgeForm.name_bn} onChange={e => setBadgeForm(p => ({ ...p, name_bn: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 font-bn" placeholder="প্রথম ড্রইং" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Description (EN)</label>
                        <input value={badgeForm.description} onChange={e => setBadgeForm(p => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" placeholder="Submitted first drawing" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Description (BN)</label>
                        <input value={badgeForm.description_bn} onChange={e => setBadgeForm(p => ({ ...p, description_bn: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 font-bn" placeholder="প্রথম ড্রইং জমা দিয়েছ" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Category</label>
                        <select value={badgeForm.category} onChange={e => setBadgeForm(p => ({ ...p, category: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400">
                          <option value="art">Art</option>
                          <option value="games">Games</option>
                          <option value="exams">Exams</option>
                          <option value="abacus">Abacus</option>
                          <option value="courses">Courses</option>
                          <option value="general">General</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Sort Order</label>
                        <input type="number" value={badgeForm.sort_order} onChange={e => setBadgeForm(p => ({ ...p, sort_order: Number(e.target.value) }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" placeholder="0" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Icon URL</label>
                      <input value={badgeForm.icon_url} onChange={e => setBadgeForm(p => ({ ...p, icon_url: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" placeholder="https://..." />
                    </div>
                    <div className="border-t border-gray-100 pt-4">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Criteria</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Trigger</label>
                          <select value={badgeForm.criteria.trigger} onChange={e => setBadgeForm(p => ({ ...p, criteria: { ...p.criteria, trigger: e.target.value } }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400">
                            <option value="drawing_count">Drawing Count</option>
                            <option value="featured_count">Featured Count</option>
                            <option value="like_count">Like Count</option>
                            <option value="challenge_streak">Challenge Streak</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Threshold</label>
                          <input type="number" min={1} value={badgeForm.criteria.threshold} onChange={e => setBadgeForm(p => ({ ...p, criteria: { ...p.criteria, threshold: Number(e.target.value) } }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" placeholder="1" />
                        </div>
                      </div>
                      <div className="mt-3">
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Criteria Description</label>
                        <input value={badgeForm.criteria.description} onChange={e => setBadgeForm(p => ({ ...p, criteria: { ...p.criteria, description: e.target.value } }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" placeholder="Submit 1 drawing" />
                      </div>
                    </div>
                    <button type="submit" className="w-full py-2.5 bg-primary-700 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 transition-colors mt-2">
                      {editBadge ? "Update Badge" : "Create Badge"}
                    </button>
                  </form>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Icon</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Trigger</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Threshold</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Active</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {badgesData.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-12 text-gray-400 text-sm">No badges yet. Create one!</td></tr>
                  )}
                  {badgesData.map((badge: any) => {
                    const catColors: Record<string, string> = {
                      art: "bg-pink-50 text-pink-700",
                      games: "bg-purple-50 text-purple-700",
                      exams: "bg-blue-50 text-blue-700",
                      abacus: "bg-orange-50 text-orange-700",
                      courses: "bg-green-50 text-green-700",
                      general: "bg-gray-100 text-gray-600",
                    };
                    return (
                      <tr key={badge.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900 text-sm">{badge.name_bn || badge.name}</p>
                          {badge.name_bn && <p className="text-xs text-gray-400">{badge.name}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${catColors[badge.category] || "bg-gray-100 text-gray-600"}`}>
                            {badge.category}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {badge.icon_url
                            ? <img src={badge.icon_url} alt="" className="w-8 h-8 rounded-lg object-cover border border-gray-100" />
                            : <Award className="w-6 h-6 text-gray-300" />
                          }
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs font-mono">{badge.criteria?.trigger || "—"}</td>
                        <td className="px-4 py-3 text-gray-700 font-semibold">{badge.criteria?.threshold ?? "—"}</td>
                        <td className="px-4 py-3">
                          {badge.is_active !== false
                            ? <span className="text-green-600 font-semibold text-xs">Active</span>
                            : <span className="text-gray-400 text-xs">Inactive</span>
                          }
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditBadge(badge);
                                setBadgeForm({
                                  name: badge.name || "",
                                  name_bn: badge.name_bn || "",
                                  description: badge.description || "",
                                  description_bn: badge.description_bn || "",
                                  category: badge.category || "general",
                                  icon_url: badge.icon_url || "",
                                  criteria: { trigger: badge.criteria?.trigger || "drawing_count", threshold: badge.criteria?.threshold ?? 1, description: badge.criteria?.description || "" },
                                  sort_order: badge.sort_order ?? 0,
                                });
                                setShowBadgeForm(true);
                              }}
                              className="p-1.5 rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100"
                              title="Edit"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={async () => {
                                const confirmed = await showConfirm("Delete Badge", `Delete "${badge.name_bn || badge.name}"? This cannot be undone.`, "Delete", "bg-red-600");
                                if (!confirmed) return;
                                try {
                                  await api.delete(`/badges/${badge.id}`, accessToken!);
                                  setBadgesData(prev => prev.filter((b: any) => b.id !== badge.id));
                                  import("@/stores/toast-store").then(m => m.toast.success("Badge deleted"));
                                } catch (err: any) {
                                  import("@/stores/toast-store").then(m => m.toast.error(err?.message || "Error deleting badge"));
                                }
                              }}
                              className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Gallery Moderation */}
        {activeTab === "gallery" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2"><Image className="w-5 h-5 text-primary-600" /> Gallery Moderation</h1>
                <p className="text-xs text-gray-400 mt-0.5">{galleryData.length} drawings</p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={galleryStatusFilter}
                  onChange={e => setGalleryStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400 bg-white"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Thumbnail</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Child</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Featured</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Likes</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {galleryData.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-12 text-gray-400 text-sm">No drawings found</td></tr>
                  )}
                  {galleryData.map((drawing: any) => {
                    const statusColors: Record<string, string> = {
                      pending: "bg-yellow-50 text-yellow-700",
                      approved: "bg-green-50 text-green-700",
                      rejected: "bg-red-50 text-red-700",
                    };
                    return (
                      <tr key={drawing.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          {drawing.thumbnail_url || drawing.image_url
                            ? <img src={drawing.thumbnail_url || drawing.image_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-gray-100" />
                            : <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center"><Image className="w-5 h-5 text-gray-300" /></div>
                          }
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900 text-sm max-w-[160px] truncate">{drawing.title || "Untitled"}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-sm">{drawing.child_name || drawing.user?.full_name || "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${statusColors[drawing.status] || "bg-gray-100 text-gray-600"}`}>
                            {drawing.status || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={async () => {
                              try {
                                await api.put(`/drawings/${drawing.id}/feature`, {}, accessToken!);
                                setGalleryData(prev => prev.map((d: any) => d.id === drawing.id ? { ...d, is_featured: !d.is_featured } : d));
                                import("@/stores/toast-store").then(m => m.toast.success(drawing.is_featured ? "Unfeatured" : "Featured!"));
                              } catch (err: any) {
                                import("@/stores/toast-store").then(m => m.toast.error(err?.message || "Error"));
                              }
                            }}
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors ${drawing.is_featured ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                            title="Toggle Featured"
                          >
                            {drawing.is_featured ? "Featured" : "—"}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-sm font-semibold">{drawing.like_count ?? drawing.likes ?? 0}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {drawing.created_at ? new Date(drawing.created_at).toLocaleDateString("en-GB") : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 flex-wrap">
                            {drawing.status !== "approved" && (
                              <button
                                onClick={async () => {
                                  try {
                                    await api.put(`/drawings/${drawing.id}/approve`, {}, accessToken!);
                                    setGalleryData(prev => prev.map((d: any) => d.id === drawing.id ? { ...d, status: "approved" } : d));
                                    import("@/stores/toast-store").then(m => m.toast.success("Approved!"));
                                  } catch (err: any) {
                                    import("@/stores/toast-store").then(m => m.toast.error(err?.message || "Error"));
                                  }
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-100 transition-colors"
                              >
                                <Check className="w-3 h-3" /> Approve
                              </button>
                            )}
                            {drawing.status !== "rejected" && (
                              <button
                                onClick={async () => {
                                  const confirmed = await showConfirm("Reject Drawing", `Reject "${drawing.title || "this drawing"}"?`, "Reject", "bg-red-600");
                                  if (!confirmed) return;
                                  try {
                                    await api.put(`/drawings/${drawing.id}/reject`, {}, accessToken!);
                                    setGalleryData(prev => prev.map((d: any) => d.id === drawing.id ? { ...d, status: "rejected" } : d));
                                    import("@/stores/toast-store").then(m => m.toast.success("Rejected"));
                                  } catch (err: any) {
                                    import("@/stores/toast-store").then(m => m.toast.error(err?.message || "Error"));
                                  }
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors"
                              >
                                <Ban className="w-3 h-3" /> Reject
                              </button>
                            )}
                            <button
                              onClick={async () => {
                                const confirmed = await showConfirm("Delete Drawing", `Permanently delete "${drawing.title || "this drawing"}"?`, "Delete", "bg-red-600");
                                if (!confirmed) return;
                                try {
                                  await api.delete(`/drawings/${drawing.id}/admin`, accessToken!);
                                  setGalleryData(prev => prev.filter((d: any) => d.id !== drawing.id));
                                  import("@/stores/toast-store").then(m => m.toast.success("Deleted"));
                                } catch (err: any) {
                                  import("@/stores/toast-store").then(m => m.toast.error(err?.message || "Error"));
                                }
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 bg-gray-50 text-gray-600 rounded-lg text-xs font-semibold hover:bg-red-50 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Challenges */}
        {activeTab === "challenges" && (
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2"><Target className="w-5 h-5 text-primary-600" /> Challenges</h1>
                <p className="text-xs text-gray-400 mt-0.5">{challengesData.length} challenges</p>
              </div>
              <button
                onClick={() => {
                  setEditChallenge(null);
                  setChallengeForm({ title: "", title_bn: "", description: "", description_bn: "", reference_image_url: "", challenge_type: "drawing", starts_at: "", ends_at: "", is_active: true });
                  setShowChallengeForm(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors"
              >
                <Plus className="w-4 h-4" /> New Challenge
              </button>
            </div>

            {/* Create / Edit Modal */}
            {showChallengeForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setShowChallengeForm(false); }}>
                <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl p-6">
                  <div className="flex justify-between items-center mb-5">
                    <h2 className="text-lg font-bold">{editChallenge ? "Edit Challenge" : "Create Challenge"}</h2>
                    <button onClick={() => setShowChallengeForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                  <form
                    onSubmit={async e => {
                      e.preventDefault();
                      try {
                        const payload: any = {
                          title: challengeForm.title,
                          title_bn: challengeForm.title_bn || undefined,
                          description: challengeForm.description || undefined,
                          description_bn: challengeForm.description_bn || undefined,
                          reference_image_url: challengeForm.reference_image_url || undefined,
                          challenge_type: challengeForm.challenge_type,
                          starts_at: challengeForm.starts_at || undefined,
                          ends_at: challengeForm.ends_at || undefined,
                          is_active: challengeForm.is_active,
                        };
                        if (editChallenge) {
                          await api.put(`/challenges/${editChallenge.id}`, payload, accessToken!);
                          import("@/stores/toast-store").then(m => m.toast.success("Challenge updated"));
                        } else {
                          await api.post("/challenges/", payload, accessToken!);
                          import("@/stores/toast-store").then(m => m.toast.success("Challenge created"));
                        }
                        setShowChallengeForm(false);
                        const data: any = await api.get("/challenges/admin", accessToken ?? undefined);
                        setChallengesData(Array.isArray(data) ? data : []);
                      } catch (err: any) {
                        import("@/stores/toast-store").then(m => m.toast.error(err?.message || "Error"));
                      }
                    }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Title <span className="text-red-500">*</span></label>
                        <input value={challengeForm.title} onChange={e => setChallengeForm(p => ({ ...p, title: e.target.value }))} required className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" placeholder="Draw a tree" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Title (BN)</label>
                        <input value={challengeForm.title_bn} onChange={e => setChallengeForm(p => ({ ...p, title_bn: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 font-bn" placeholder="একটি গাছ আঁক" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Description</label>
                      <textarea value={challengeForm.description} onChange={e => setChallengeForm(p => ({ ...p, description: e.target.value }))} rows={2} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 resize-none" placeholder="Draw any kind of tree you like" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Description (BN)</label>
                      <textarea value={challengeForm.description_bn} onChange={e => setChallengeForm(p => ({ ...p, description_bn: e.target.value }))} rows={2} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 resize-none font-bn" placeholder="তোমার পছন্দের যেকোনো গাছ আঁক" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Reference Image URL</label>
                      <input value={challengeForm.reference_image_url} onChange={e => setChallengeForm(p => ({ ...p, reference_image_url: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" placeholder="https://..." />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Challenge Type</label>
                      <select value={challengeForm.challenge_type} onChange={e => setChallengeForm(p => ({ ...p, challenge_type: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400">
                        <option value="drawing">Drawing</option>
                        <option value="text">Text</option>
                        <option value="both">Both</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Starts At</label>
                        <input type="datetime-local" value={challengeForm.starts_at} onChange={e => setChallengeForm(p => ({ ...p, starts_at: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Ends At <span className="text-gray-400 font-normal">(optional)</span></label>
                        <input type="datetime-local" value={challengeForm.ends_at} onChange={e => setChallengeForm(p => ({ ...p, ends_at: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => setChallengeForm(p => ({ ...p, is_active: !p.is_active }))}>
                        {challengeForm.is_active ? <ToggleRight className="w-8 h-8 text-primary-600" /> : <ToggleLeft className="w-8 h-8 text-gray-400" />}
                      </button>
                      <span className="text-sm font-medium text-gray-700">Active</span>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => setShowChallengeForm(false)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                      <button type="submit" className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors">
                        {editChallenge ? "Update Challenge" : "Create Challenge"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Starts At</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ends At</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Active</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {challengesData.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-sm">No challenges found</td></tr>
                  )}
                  {challengesData.map((ch: any) => {
                    const typeColors: Record<string, string> = {
                      drawing: "bg-blue-50 text-blue-700",
                      text: "bg-purple-50 text-purple-700",
                      both: "bg-green-50 text-green-700",
                    };
                    return (
                      <tr key={ch.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900 text-sm">{ch.title}</p>
                          {ch.title_bn && <p className="text-xs text-gray-400 font-bn mt-0.5">{ch.title_bn}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${typeColors[ch.challenge_type] || "bg-gray-100 text-gray-600"}`}>
                            {ch.challenge_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {ch.starts_at ? new Date(ch.starts_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {ch.ends_at ? new Date(ch.ends_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${ch.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {ch.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => {
                                setEditChallenge(ch);
                                setChallengeForm({
                                  title: ch.title || "",
                                  title_bn: ch.title_bn || "",
                                  description: ch.description || "",
                                  description_bn: ch.description_bn || "",
                                  reference_image_url: ch.reference_image_url || "",
                                  challenge_type: ch.challenge_type || "drawing",
                                  starts_at: ch.starts_at ? ch.starts_at.slice(0, 16) : "",
                                  ends_at: ch.ends_at ? ch.ends_at.slice(0, 16) : "",
                                  is_active: ch.is_active ?? true,
                                });
                                setShowChallengeForm(true);
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 bg-gray-50 text-gray-600 rounded-lg text-xs font-semibold hover:bg-primary-50 hover:text-primary-700 transition-colors"
                            >
                              <Edit3 className="w-3 h-3" /> Edit
                            </button>
                            <button
                              onClick={async () => {
                                const confirmed = await showConfirm("Delete Challenge", "Are you sure you want to delete this challenge?", "Delete", "bg-red-600");
                                if (!confirmed) return;
                                try {
                                  await api.delete(`/challenges/${ch.id}`, accessToken!);
                                  import("@/stores/toast-store").then(m => m.toast.success("Challenge deleted"));
                                  const data: any = await api.get("/challenges/admin", accessToken ?? undefined);
                                  setChallengesData(Array.isArray(data) ? data : []);
                                } catch (err: any) {
                                  import("@/stores/toast-store").then(m => m.toast.error(err?.message || "Error"));
                                }
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 bg-gray-50 text-gray-600 rounded-lg text-xs font-semibold hover:bg-red-50 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Fraud Config */}
        {activeTab === "fraud-config" && <FraudConfigTab accessToken={accessToken!} />}

        {/* Fraud Dashboard */}
        {activeTab === "fraud-dashboard" && <FraudDashboardTab accessToken={accessToken!} />}

        {/* VIEW ORDER MODAL */}
        <OrderDetailModal
          order={viewOrder}
          accessToken={accessToken!}
          onClose={() => setViewOrder(null)}
          onUpdated={(updated) => {
            setViewOrder(updated);
            setListData((prev: any[]) =>
              prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o))
            );
            setOrdersRefreshKey((k) => k + 1);
          }}
        />

        {/* CUSTOM CONFIRMATION MODAL */}
        {confirmModal.open && (
          <div
            id="confirm-modal-backdrop"
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm"
            style={{ animation: "fadeIn 0.15s ease-out" }}
          >
            <div
              className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
              style={{ animation: "scaleIn 0.2s ease-out" }}
            >
              <div className="p-6">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 text-center font-bn mb-2">{confirmModal.title}</h3>
                <p className="text-sm text-gray-600 text-center font-bn leading-relaxed">{confirmModal.message}</p>
              </div>
              <div className="flex border-t border-gray-100">
                <button
                  id="confirm-modal-cancel"
                  className="flex-1 px-4 py-3.5 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors font-bn border-r border-gray-100"
                >
                  বাতিল
                </button>
                <button
                  onClick={() => confirmModal.onConfirm?.()}
                  className="flex-1 px-4 py-3.5 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 transition-colors font-bn"
                >
                  {confirmModal.confirmLabel || "নিশ্চিত করুন"}
                </button>
              </div>
            </div>
          </div>
        )}

        <style jsx>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.9); }
            to { opacity: 1; transform: scale(1); }
          }
        `}</style>
    </div>
  );
}



export default function AdminPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>}>
      <AdminPageContent />
    </Suspense>
  );
}
