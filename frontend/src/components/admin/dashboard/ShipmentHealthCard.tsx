"use client";

import { Truck, ArrowRight, Package, CheckCircle2, RotateCcw } from "lucide-react";
import { useLocaleStore } from "@/stores/locale-store";

type Stats = {
  pending_shipments?: number;
};

type FraudSummary = {
  returned_rate?: number;
};

export function ShipmentHealthCard({
  stats,
  fraudSummary,
  loading,
  onNavigate,
}: {
  stats: Stats | null;
  fraudSummary: FraudSummary | null;
  loading: boolean;
  onNavigate: (tab: string, extra?: Record<string, string>) => void;
}) {
  const { locale, t } = useLocaleStore();
  const pending = stats?.pending_shipments || 0;
  const returnedRate = fraudSummary?.returned_rate ?? 0;
  const healthy = returnedRate < 5;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm h-full flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#7c2df7]">
            <Truck className="w-3.5 h-3.5" />
            <span className={locale === "bn" ? "font-bn" : ""}>{t("শিপমেন্ট হেলথ", "Shipment Health")}</span>
          </div>
          <h3 className={`text-lg font-bold text-gray-900 mt-1 ${locale === "bn" ? "font-bn" : ""}`}>
            {healthy ? t("ভালো আছে", "Healthy") : t("নজর দিন", "Attention")}
          </h3>
        </div>
        <button
          onClick={() => onNavigate("shipments")}
          className="text-[11px] font-semibold text-[#7c2df7] hover:text-[#532d80] inline-flex items-center gap-1"
        >
          <span className={locale === "bn" ? "font-bn" : ""}>{t("দেখুন", "View")}</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-3 flex-1">
          <div className="skeleton h-16 rounded-xl" />
          <div className="skeleton h-16 rounded-xl" />
        </div>
      ) : (
        <div className="space-y-3 flex-1">
          <Row
            icon={Package}
            iconBg="bg-orange-50"
            iconFg="text-orange-600"
            label={t("পেন্ডিং শিপমেন্ট", "Pending")}
            value={pending}
            hint={pending === 0 ? t("কিছু নেই", "All clear") : t("ডিসপ্যাচ করুন", "Ready to dispatch")}
            onClick={() => onNavigate("shipments", { status: "pending" })}
            locale={locale}
          />
          <Row
            icon={RotateCcw}
            iconBg={returnedRate > 5 ? "bg-rose-50" : "bg-gray-50"}
            iconFg={returnedRate > 5 ? "text-rose-600" : "text-gray-500"}
            label={t("রিটার্ন রেট", "Return rate")}
            value={`${returnedRate}%`}
            hint={returnedRate > 5 ? t("গড়ের থেকে বেশি", "Above threshold") : t("স্বাভাবিক", "Within range")}
            onClick={() => onNavigate("fraud-dashboard")}
            locale={locale}
          />
          <Row
            icon={CheckCircle2}
            iconBg="bg-emerald-50"
            iconFg="text-emerald-600"
            label={t("সার্বিক অবস্থা", "Overall status")}
            value={healthy ? t("ভালো", "Good") : t("পর্যবেক্ষণ", "Watch")}
            hint={healthy ? t("অপারেশন মসৃণ চলছে", "Operations running smoothly") : t("উচ্চ রিটার্ন হার", "Elevated return rate")}
            onClick={() => onNavigate("shipments")}
            locale={locale}
          />
        </div>
      )}
    </div>
  );
}

function Row({
  icon: Icon, iconBg, iconFg, label, value, hint, onClick, locale,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconFg: string;
  label: string;
  value: string | number;
  hint: string;
  onClick: () => void;
  locale: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg} shrink-0`}>
        <Icon className={`w-4.5 h-4.5 ${iconFg}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[11px] text-gray-500 font-medium ${locale === "bn" ? "font-bn" : ""}`}>{label}</p>
        <p className={`text-sm font-bold text-gray-900 ${locale === "bn" ? "font-bn" : ""}`}>{value}</p>
      </div>
      <p className={`text-[10px] text-gray-400 text-right ${locale === "bn" ? "font-bn" : ""}`}>{hint}</p>
    </button>
  );
}
