"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { DashboardHero, DateRange } from "./DashboardHero";
import { KPIGrid } from "./KPIGrid";
import { RevenueTrendCard } from "./RevenueTrendCard";
import { OrderPipelineCard } from "./OrderPipelineCard";
import { NeedsAttentionCard } from "./NeedsAttentionCard";
import { FraudSnapshotCard } from "./FraudSnapshotCard";
import { ShipmentHealthCard } from "./ShipmentHealthCard";
import { RecentOrdersCard } from "./RecentOrdersCard";

type RevenuePoint = { date: string; amount: string };
type OrderCounts = Record<string, number | undefined> & { total?: number };

type DashboardStats = {
  total_users?: number;
  total_courses?: number;
  total_orders?: number;
  total_revenue?: string;
  pending_orders?: number;
  confirmed_orders?: number;
  pending_shipments?: number;
  active_enrollments?: number;
  new_users_today?: number;
  orders_today?: number;
  revenue_today?: string;
};

type FraudDashboard = {
  summary?: {
    total_orders?: number;
    guest_orders?: number;
    low_risk?: number;
    medium_risk?: number;
    high_risk?: number;
    cancelled_rate?: number;
    returned_rate?: number;
    vpn_orders?: number;
  };
};

export function SuperAdminDashboard({
  onNavigate,
}: {
  onNavigate: (tab: string, extra?: Record<string, string>) => void;
}) {
  const router = useRouter();
  const { accessToken, user, logout } = useAuthStore();

  const [dateRange, setDateRange] = useState<DateRange>(30);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const [orderCounts, setOrderCounts] = useState<OrderCounts>({});
  const [fraud, setFraud] = useState<FraudDashboard | null>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [, tick] = useState(0);

  // re-render every 30s so "X seconds ago" stays fresh
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const loadAll = useCallback(
    async (isRefresh = false) => {
      if (!accessToken) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const [s, r, c, f, o] = await Promise.all([
          api.get("/admin/stats", accessToken).catch(() => null),
          api.get(`/admin/revenue-chart?days=${dateRange}`, accessToken).catch(() => []),
          api.get("/admin/orders/counts", accessToken).catch(() => ({})),
          api.get(`/admin/fraud-dashboard?days=${dateRange}`, accessToken).catch(() => null),
          api.get("/orders/?page=1&page_size=7", accessToken).catch(() => []),
        ]);
        setStats((s as DashboardStats) || null);
        setRevenue(Array.isArray(r) ? (r as RevenuePoint[]) : []);
        setOrderCounts((c as OrderCounts) || {});
        setFraud((f as FraudDashboard) || null);
        setRecentOrders(Array.isArray(o) ? o : []);
        setLastUpdated(new Date());
      } catch (err: any) {
        if (err?.status === 401) {
          logout();
          router.push("/login");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [accessToken, dateRange, logout, router]
  );

  useEffect(() => {
    loadAll(false);
  }, [loadAll]);

  // Wrap navigate so fraud-dashboard clicks carry the dashboard's active
  // date range — otherwise the Fraud Dashboard tab would default to its own
  // window and risk showing "no data" for orders within the dashboard's range.
  const handleNavigate = useCallback(
    (tab: string, extra?: Record<string, string>) => {
      if (tab === "fraud-dashboard" && !extra?.days) {
        onNavigate(tab, { ...(extra || {}), days: String(dateRange) });
        return;
      }
      onNavigate(tab, extra);
    },
    [onNavigate, dateRange]
  );

  return (
    <div className="animate-fade-in">
      <DashboardHero
        userName={user?.full_name?.split(" ")[0]}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onRefresh={() => loadAll(true)}
        refreshing={refreshing}
        lastUpdated={lastUpdated}
      />

      <KPIGrid
        stats={stats}
        revenueSeries={revenue}
        loading={loading}
        onNavigate={(tab) => handleNavigate(tab)}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <RevenueTrendCard data={revenue} days={dateRange} loading={loading} />
        <OrderPipelineCard counts={orderCounts} loading={loading} onNavigate={onNavigate} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-5">
        <NeedsAttentionCard
          stats={stats}
          fraudSummary={fraud?.summary || null}
          loading={loading}
          onNavigate={handleNavigate}
        />
        <FraudSnapshotCard
          summary={fraud?.summary || null}
          days={dateRange}
          loading={loading}
          onNavigate={(tab) => handleNavigate(tab)}
        />
        <ShipmentHealthCard
          stats={stats}
          fraudSummary={fraud?.summary || null}
          loading={loading}
          onNavigate={handleNavigate}
        />
      </div>

      <RecentOrdersCard
        orders={recentOrders}
        loading={loading}
        onNavigate={(tab) => handleNavigate(tab)}
      />
    </div>
  );
}
