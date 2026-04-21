"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus, Search, BookOpen, FileText, Wallet, Edit3, Trash2,
  Grid3x3, Rows3, Loader2, ArrowUpDown, Power, AlertTriangle,
  ShoppingCart, FileCheck, CheckCircle2,
} from "lucide-react";
import { useLocaleStore } from "@/stores/locale-store";
import { api } from "@/lib/api";
import { toast } from "@/stores/toast-store";
import { ConfirmModal } from "../ConfirmModal";

type AdminEbook = {
  id: string;
  product_id: string;
  title: string;
  title_bn?: string | null;
  slug: string;
  description?: string | null;
  thumbnail_url?: string | null;
  price: number;
  compare_price?: number | null;
  is_free: boolean;
  is_active: boolean;
  author?: string | null;
  pages?: number | null;
  b2_key?: string | null;
  has_file: boolean;
  sales_count: number;
  revenue: number;
  created_at?: string | null;
};

type Stats = {
  total: number;
  active: number;
  inactive: number;
  free: number;
  paid: number;
  no_file: number;
  total_sales: number;
  total_revenue: number;
};

type StatusFilter = "" | "active" | "inactive" | "free" | "paid" | "has_file" | "no_file";
type SortOption = "newest" | "oldest" | "price_asc" | "price_desc" | "name_asc" | "sales_desc" | "revenue_desc";
type ViewMode = "grid" | "table";

export function EbooksPanel({
  accessToken,
  refreshKey,
  onCreate,
  onEdit,
}: {
  accessToken: string;
  refreshKey: number;
  onCreate: () => void;
  onEdit: (e: AdminEbook) => void;
}) {
  const { locale, t } = useLocaleStore();

  const [items, setItems] = useState<AdminEbook[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [view, setView] = useState<ViewMode>("grid");

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ ebook: AdminEbook; action: "activate" | "deactivate" | "delete" } | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter) params.set("status", statusFilter);
      params.set("sort", sort);
      const data: any = await api.get(`/ebooks/admin?${params.toString()}`, accessToken);
      setItems(Array.isArray(data?.items) ? data.items : []);
      setStats(data?.stats || null);
    } catch (err: any) {
      toast.error(err?.message || t("ই-বুক লোড ব্যর্থ", "Failed to load ebooks"));
    } finally {
      setLoading(false);
    }
  }, [accessToken, debouncedSearch, statusFilter, sort, t]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const requestToggle = (e: AdminEbook) =>
    setPending({ ebook: e, action: e.is_active ? "deactivate" : "activate" });
  const requestDelete = (e: AdminEbook) =>
    setPending({ ebook: e, action: "delete" });

  const executePending = async () => {
    if (!pending) return;
    const { ebook: e, action } = pending;
    setTogglingId(e.id);
    try {
      if (action === "delete") {
        await api.delete(`/ebooks/${e.id}`, accessToken);
        toast.success(t("ই-বুক ডিলিট হয়েছে", "Ebook deleted"));
        setItems((prev) => prev.filter((x) => x.id !== e.id));
      } else {
        const next = action === "activate";
        await api.patch(`/ebooks/${e.id}`, { is_active: next }, accessToken);
        toast.success(next ? t("সক্রিয় করা হয়েছে", "Activated") : t("নিষ্ক্রিয় করা হয়েছে", "Deactivated"));
        setItems((prev) => prev.map((x) => (x.id === e.id ? { ...x, is_active: next } : x)));
      }
      setPending(null);
    } catch (err: any) {
      toast.error(err?.message || t("অপারেশন ব্যর্থ", "Operation failed"));
    } finally {
      setTogglingId(null);
    }
  };

  const activeFilters = [debouncedSearch, statusFilter].filter(Boolean).length;

  return (
    <div>
      <Header onCreate={onCreate} locale={locale} t={t} />
      <StatsStrip stats={stats} loading={loading && !stats} locale={locale} t={t} onQuickFilter={setStatusFilter} activeFilter={statusFilter} />
      <Toolbar
        search={search} setSearch={setSearch}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        sort={sort} setSort={setSort}
        view={view} setView={setView}
        activeFiltersCount={activeFilters}
        onClear={() => { setSearch(""); setStatusFilter(""); }}
        locale={locale} t={t}
      />

      {loading && items.length === 0 ? (
        <GridSkeleton view={view} />
      ) : items.length === 0 ? (
        <EmptyState hasFilters={activeFilters > 0} locale={locale} t={t} />
      ) : view === "grid" ? (
        <Grid items={items} onEdit={onEdit} onToggle={requestToggle} onDelete={requestDelete} togglingId={togglingId} locale={locale} t={t} />
      ) : (
        <Table items={items} onEdit={onEdit} onToggle={requestToggle} onDelete={requestDelete} togglingId={togglingId} locale={locale} t={t} />
      )}

      <ConfirmModal
        open={pending !== null}
        title={pendingTitle(pending, t)}
        body={pendingBody(pending, t)}
        confirmLabel={pendingConfirmLabel(pending, t)}
        tone={pending?.action === "delete" || pending?.action === "deactivate" ? "destructive" : "info"}
        onCancel={() => setPending(null)}
        onConfirm={executePending}
      />
    </div>
  );
}

/* ─── Header ─── */

function Header({ onCreate, locale, t }: { onCreate: () => void; locale: string; t: (bn: string, en: string) => string }) {
  return (
    <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
      <div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#7c2df7]">
          <BookOpen className="w-3.5 h-3.5" />
          <span className={locale === "bn" ? "font-bn" : ""}>{t("ই-বুক ম্যানেজমেন্ট", "Ebook Management")}</span>
        </div>
        <h1 className={`text-xl md:text-2xl font-bold text-gray-900 ${locale === "bn" ? "font-bn" : ""}`}>
          {t("ই-বুক", "Ebooks")}
        </h1>
      </div>
      <button
        onClick={onCreate}
        className={`inline-flex items-center gap-2 px-4 py-2 bg-[#7c2df7] text-white text-sm font-semibold rounded-xl hover:bg-[#6b1ee3] shadow-sm ${locale === "bn" ? "font-bn" : ""}`}
      >
        <Plus className="w-4 h-4" /> {t("নতুন ই-বুক", "New ebook")}
      </button>
    </div>
  );
}

/* ─── Stats ─── */

function StatsStrip({
  stats, loading, locale, t, onQuickFilter, activeFilter,
}: {
  stats: Stats | null; loading: boolean; locale: string; t: (bn: string, en: string) => string;
  onQuickFilter: (f: StatusFilter) => void; activeFilter: StatusFilter;
}) {
  const cards = [
    { key: "" as StatusFilter,         label: t("মোট ই-বুক", "Total ebooks"),          value: stats?.total ?? 0,                                         icon: BookOpen,       iconBg: "bg-[#f5f0ff]",  iconFg: "text-[#7c2df7]",   clickable: false },
    { key: "active" as StatusFilter,   label: t("অ্যাক্টিভ", "Active"),                 value: stats?.active ?? 0,                                        icon: Power,          iconBg: "bg-emerald-50", iconFg: "text-emerald-600", clickable: true },
    { key: "free" as StatusFilter,     label: t("ফ্রি ই-বুক", "Free ebooks"),           value: stats?.free ?? 0,                                          icon: FileCheck,      iconBg: "bg-sky-50",     iconFg: "text-sky-600",     clickable: true },
    { key: "no_file" as StatusFilter,  label: t("ফাইল নেই", "Missing file"),           value: stats?.no_file ?? 0,                                       icon: AlertTriangle,  iconBg: "bg-amber-50",   iconFg: "text-amber-600",   clickable: true },
    { key: "__sales",                  label: t("মোট বিক্রি", "Total sales"),           value: formatCompact(stats?.total_sales ?? 0, locale),             icon: ShoppingCart,   iconBg: "bg-indigo-50",  iconFg: "text-indigo-600",  clickable: false },
    { key: "__revenue",                label: t("মোট রেভেনিউ", "Total revenue"),        value: stats ? formatCurrency(stats.total_revenue, locale) : "—", icon: Wallet,         iconBg: "bg-[#fff8e1]",  iconFg: "text-[#b77800]",   clickable: false },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
      {cards.map((c, i) => {
        const isActive = c.clickable && activeFilter === c.key;
        const El: any = c.clickable ? "button" : "div";
        return (
          <El
            key={i}
            {...(c.clickable ? { onClick: () => onQuickFilter(isActive ? "" : (c.key as StatusFilter)), type: "button" } : {})}
            className={`text-left rounded-2xl border p-4 bg-white border-gray-100 ${c.clickable ? "hover:border-[#7c2df7]/30 hover:-translate-y-0.5 transition-all" : ""} ${isActive ? "ring-2 ring-[#7c2df7]/30 border-[#7c2df7]/40" : ""}`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 ${c.iconBg}`}>
              <c.icon className={`w-4 h-4 ${c.iconFg}`} />
            </div>
            <p className={`text-[11px] text-gray-500 font-medium leading-tight ${locale === "bn" ? "font-bn" : ""}`}>{c.label}</p>
            {loading && !stats ? (
              <div className="skeleton h-6 w-16 mt-1" />
            ) : (
              <p className="text-xl md:text-[22px] font-bold text-gray-900 mt-0.5 tabular-nums">{c.value}</p>
            )}
          </El>
        );
      })}
    </div>
  );
}

/* ─── Toolbar ─── */

function Toolbar({
  search, setSearch, statusFilter, setStatusFilter, sort, setSort, view, setView,
  activeFiltersCount, onClear, locale, t,
}: {
  search: string; setSearch: (v: string) => void;
  statusFilter: StatusFilter; setStatusFilter: (v: StatusFilter) => void;
  sort: SortOption; setSort: (v: SortOption) => void;
  view: ViewMode; setView: (v: ViewMode) => void;
  activeFiltersCount: number; onClear: () => void;
  locale: string; t: (bn: string, en: string) => string;
}) {
  const selectClass = "bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 outline-none focus:border-[#7c2df7]/50 hover:border-gray-300 transition-colors cursor-pointer appearance-none pr-8";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 mb-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("শিরোনাম বা লেখক...", "Title or author...")}
            className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 outline-none focus:border-[#7c2df7]/50 ${locale === "bn" ? "font-bn" : ""}`}
          />
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className={`${selectClass} ${locale === "bn" ? "font-bn" : ""}`}
          >
            <option value="">{t("সব স্ট্যাটাস", "All statuses")}</option>
            <option value="active">{t("অ্যাক্টিভ", "Active")}</option>
            <option value="inactive">{t("ইনঅ্যাক্টিভ", "Inactive")}</option>
            <option value="free">{t("ফ্রি", "Free")}</option>
            <option value="paid">{t("পেইড", "Paid")}</option>
            <option value="has_file">{t("ফাইল আছে", "Has file")}</option>
            <option value="no_file">{t("ফাইল নেই", "Missing file")}</option>
          </select>
          <Power className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className={`${selectClass} ${locale === "bn" ? "font-bn" : ""}`}
          >
            <option value="newest">{t("নতুন আগে", "Newest first")}</option>
            <option value="oldest">{t("পুরাতন আগে", "Oldest first")}</option>
            <option value="sales_desc">{t("সর্বাধিক বিক্রি", "Most sales")}</option>
            <option value="revenue_desc">{t("সর্বাধিক রেভেনিউ", "Most revenue")}</option>
            <option value="price_asc">{t("দাম: কম → বেশি", "Price: low → high")}</option>
            <option value="price_desc">{t("দাম: বেশি → কম", "Price: high → low")}</option>
            <option value="name_asc">{t("নাম: A → Z", "Name: A → Z")}</option>
          </select>
          <ArrowUpDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>

        <div className="inline-flex rounded-xl bg-gray-100 p-0.5">
          <button onClick={() => setView("grid")} className={`p-1.5 rounded-lg transition-colors ${view === "grid" ? "bg-white shadow-sm text-[#7c2df7]" : "text-gray-500 hover:text-gray-800"}`}><Grid3x3 className="w-4 h-4" /></button>
          <button onClick={() => setView("table")} className={`p-1.5 rounded-lg transition-colors ${view === "table" ? "bg-white shadow-sm text-[#7c2df7]" : "text-gray-500 hover:text-gray-800"}`}><Rows3 className="w-4 h-4" /></button>
        </div>

        {activeFiltersCount > 0 && (
          <button onClick={onClear} className={`text-xs font-semibold text-[#7c2df7] hover:text-[#532d80] px-2 ${locale === "bn" ? "font-bn" : ""}`}>
            {t("ফিল্টার মুছুন", "Clear filters")} ({activeFiltersCount})
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Pills ─── */

function fileBadge(hasFile: boolean, locale: string, t: (bn: string, en: string) => string) {
  return hasFile
    ? <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 ${locale === "bn" ? "font-bn" : ""}`}>
        <CheckCircle2 className="w-2.5 h-2.5" /> {t("PDF আছে", "PDF")}
      </span>
    : <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-800 ${locale === "bn" ? "font-bn" : ""}`}>
        <AlertTriangle className="w-2.5 h-2.5" /> {t("ফাইল নেই", "No file")}
      </span>;
}

function statusPill(active: boolean, locale: string, t: (bn: string, en: string) => string) {
  return active
    ? <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 ${locale === "bn" ? "font-bn" : ""}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{t("অ্যাক্টিভ", "Active")}
      </span>
    : <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-100 text-gray-600 ${locale === "bn" ? "font-bn" : ""}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />{t("ইনঅ্যাক্টিভ", "Inactive")}
      </span>;
}

/* ─── Grid ─── */

function Grid({
  items, onEdit, onToggle, onDelete, togglingId, locale, t,
}: {
  items: AdminEbook[];
  onEdit: (e: AdminEbook) => void;
  onToggle: (e: AdminEbook) => void;
  onDelete: (e: AdminEbook) => void;
  togglingId: string | null;
  locale: string;
  t: (bn: string, en: string) => string;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((e) => (
        <EbookCard
          key={e.id}
          ebook={e}
          toggling={togglingId === e.id}
          onEdit={() => onEdit(e)}
          onToggle={() => onToggle(e)}
          onDelete={() => onDelete(e)}
          locale={locale}
          t={t}
        />
      ))}
    </div>
  );
}

function EbookCard({
  ebook, toggling, onEdit, onToggle, onDelete, locale, t,
}: {
  ebook: AdminEbook;
  toggling: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  locale: string;
  t: (bn: string, en: string) => string;
}) {
  const hasDiscount = ebook.compare_price && ebook.compare_price > ebook.price;
  const discountPct = hasDiscount ? Math.round(((ebook.compare_price! - ebook.price) / ebook.compare_price!) * 100) : 0;
  const priceDisplay = ebook.price.toLocaleString(locale === "bn" ? "bn-BD" : "en-US");
  const comparePriceDisplay = ebook.compare_price?.toLocaleString(locale === "bn" ? "bn-BD" : "en-US");

  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-[#7c2df7]/20 transition-all ${!ebook.is_active ? "opacity-75" : ""}`}>
      <div className="p-3">
        {/* Header row: thumb + title/author + status */}
        <div className="flex gap-3">
          <div className="relative w-14 h-[72px] rounded-md bg-gradient-to-br from-[#f5f0ff] to-[#ede5ff] overflow-hidden shrink-0">
            {ebook.thumbnail_url ? (
              <img src={ebook.thumbnail_url} alt={ebook.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><BookOpen className="w-5 h-5 text-[#7c2df7]/40" /></div>
            )}
            {ebook.is_free && (
              <span className={`absolute bottom-0.5 left-0.5 px-1 py-px text-[8px] font-bold rounded bg-sky-500 text-white ${locale === "bn" ? "font-bn" : ""}`}>
                {t("ফ্রি", "FREE")}
              </span>
            )}
            {hasDiscount && !ebook.is_free && (
              <span className="absolute bottom-0.5 left-0.5 px-1 py-px text-[8px] font-bold rounded bg-rose-600 text-white">−{discountPct}%</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className={`font-bold text-sm text-gray-900 leading-tight line-clamp-2 ${locale === "bn" ? "font-bn" : ""}`}>
                {ebook.title_bn || ebook.title}
              </h3>
              <div className="shrink-0">{statusPill(ebook.is_active, locale, t)}</div>
            </div>
            <p className={`text-[11px] text-gray-500 mt-1 truncate ${locale === "bn" ? "font-bn" : ""}`}>
              {ebook.author || <span className="italic text-gray-400">{t("লেখক নেই", "No author")}</span>}
            </p>
            <div className="flex items-baseline gap-1.5 mt-1">
              {ebook.is_free ? (
                <span className={`text-sm font-bold text-sky-600 ${locale === "bn" ? "font-bn" : ""}`}>{t("ফ্রি", "Free")}</span>
              ) : (
                <>
                  <span className="text-sm font-bold text-[#7c2df7] tabular-nums">৳{priceDisplay}</span>
                  {hasDiscount && <span className="text-[10px] text-gray-400 line-through tabular-nums">৳{comparePriceDisplay}</span>}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Inline metrics row */}
        <div className={`flex items-center gap-3 mt-2.5 pt-2 border-t border-gray-100 text-[11px] text-gray-500 ${locale === "bn" ? "font-bn" : ""}`}>
          <span className="inline-flex items-center gap-1 min-w-0">
            <FileText className="w-3 h-3 text-gray-400 shrink-0" />
            <span className="font-bold text-gray-900 tabular-nums">{ebook.pages ?? "—"}</span>
          </span>
          <span className="inline-flex items-center gap-1 min-w-0">
            <ShoppingCart className="w-3 h-3 text-gray-400 shrink-0" />
            <span className="font-bold text-gray-900 tabular-nums">{formatCompact(ebook.sales_count, locale)}</span>
          </span>
          <span className="inline-flex items-center gap-1 min-w-0">
            <Wallet className="w-3 h-3 text-gray-400 shrink-0" />
            <span className="font-bold text-gray-900 tabular-nums">{formatCurrency(ebook.revenue, locale)}</span>
          </span>
          <span className="ml-auto">{fileBadge(ebook.has_file, locale, t)}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-1 mt-2">
          <button
            onClick={onEdit}
            className={`flex-1 py-1 text-[11px] font-semibold text-[#7c2df7] bg-[#f5f0ff] rounded-md hover:bg-[#ede5ff] inline-flex items-center justify-center gap-1 ${locale === "bn" ? "font-bn" : ""}`}
          >
            <Edit3 className="w-3 h-3" /> {t("এডিট", "Edit")}
          </button>
          <button
            onClick={onToggle}
            disabled={toggling}
            title={ebook.is_active ? t("নিষ্ক্রিয় করুন", "Deactivate") : t("সক্রিয় করুন", "Activate")}
            className={`py-1 px-2 text-[11px] font-semibold rounded-md disabled:opacity-50 ${ebook.is_active ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
          >
            {toggling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Power className="w-3 h-3" />}
          </button>
          <button
            onClick={onDelete}
            title={t("ডিলিট", "Delete")}
            className="py-1 px-2 text-[11px] font-semibold text-rose-600 bg-rose-50 rounded-md hover:bg-rose-100"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Table ─── */

function Table({
  items, onEdit, onToggle, onDelete, togglingId, locale, t,
}: {
  items: AdminEbook[];
  onEdit: (e: AdminEbook) => void;
  onToggle: (e: AdminEbook) => void;
  onDelete: (e: AdminEbook) => void;
  togglingId: string | null;
  locale: string;
  t: (bn: string, en: string) => string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className={`text-left text-[10px] uppercase tracking-wider text-gray-400 font-semibold ${locale === "bn" ? "font-bn" : ""}`}>
              <th className="px-4 py-3">{t("ই-বুক", "Ebook")}</th>
              <th className="px-3 py-3">{t("লেখক", "Author")}</th>
              <th className="px-3 py-3 text-right">{t("পৃষ্ঠা", "Pages")}</th>
              <th className="px-3 py-3 text-right">{t("বিক্রি", "Sales")}</th>
              <th className="px-3 py-3 text-right">{t("রেভেনিউ", "Revenue")}</th>
              <th className="px-3 py-3 text-right">{t("দাম", "Price")}</th>
              <th className="px-3 py-3">{t("ফাইল", "File")}</th>
              <th className="px-3 py-3">{t("স্ট্যাটাস", "Status")}</th>
              <th className="px-4 py-3 text-right">{t("অ্যাকশন", "Actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((e) => {
              const hasDiscount = e.compare_price && e.compare_price > e.price;
              return (
                <tr key={e.id} className="hover:bg-[#faf8ff]">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-12 rounded-md bg-[#f5f0ff] overflow-hidden shrink-0 flex items-center justify-center">
                        {e.thumbnail_url ? <img src={e.thumbnail_url} alt="" className="w-full h-full object-cover" /> : <BookOpen className="w-4 h-4 text-[#7c2df7]/50" />}
                      </div>
                      <div className="min-w-0">
                        <p className={`font-semibold text-sm text-gray-900 truncate max-w-[240px] ${locale === "bn" ? "font-bn" : ""}`}>
                          {e.title_bn || e.title}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className={`px-3 py-2.5 text-xs text-gray-600 max-w-[160px] truncate ${locale === "bn" ? "font-bn" : ""}`}>{e.author || "—"}</td>
                  <td className="px-3 py-2.5 text-right text-sm font-bold tabular-nums text-gray-900">{e.pages ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right text-sm font-bold tabular-nums text-gray-900">{e.sales_count}</td>
                  <td className="px-3 py-2.5 text-right text-sm font-bold tabular-nums text-gray-900">৳{formatCompact(Math.round(e.revenue), locale)}</td>
                  <td className="px-3 py-2.5 text-right">
                    {e.is_free ? (
                      <span className={`text-sm font-bold text-sky-600 ${locale === "bn" ? "font-bn" : ""}`}>{t("ফ্রি", "Free")}</span>
                    ) : (
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-bold text-gray-900 tabular-nums">৳{e.price.toLocaleString(locale === "bn" ? "bn-BD" : "en-US")}</span>
                        {hasDiscount && <span className="text-[10px] text-gray-400 line-through tabular-nums">৳{e.compare_price!.toLocaleString(locale === "bn" ? "bn-BD" : "en-US")}</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5">{fileBadge(e.has_file, locale, t)}</td>
                  <td className="px-3 py-2.5">{statusPill(e.is_active, locale, t)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button onClick={() => onEdit(e)} title={t("এডিট", "Edit")} className="p-1.5 rounded-lg text-[#7c2df7] hover:bg-[#f5f0ff]">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onToggle(e)}
                        disabled={togglingId === e.id}
                        title={e.is_active ? t("নিষ্ক্রিয় করুন", "Deactivate") : t("সক্রিয় করুন", "Activate")}
                        className={`p-1.5 rounded-lg disabled:opacity-50 ${e.is_active ? "text-emerald-600 hover:bg-emerald-50" : "text-gray-400 hover:bg-gray-50"}`}
                      >
                        {togglingId === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => onDelete(e)} title={t("ডিলিট", "Delete")} className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50">
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
  );
}

/* ─── Empty/Skeleton ─── */

function EmptyState({ hasFilters, locale, t }: { hasFilters: boolean; locale: string; t: (bn: string, en: string) => string }) {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
      <div className="w-14 h-14 mx-auto rounded-full bg-[#f5f0ff] flex items-center justify-center mb-3">
        <BookOpen className="w-6 h-6 text-[#7c2df7]" />
      </div>
      <p className={`text-base font-bold text-gray-900 ${locale === "bn" ? "font-bn" : ""}`}>
        {hasFilters ? t("কোনো ই-বুক মেলেনি", "No ebooks match your filters") : t("এখনো কোনো ই-বুক নেই", "No ebooks yet")}
      </p>
      <p className={`text-sm text-gray-500 mt-1 ${locale === "bn" ? "font-bn" : ""}`}>
        {hasFilters ? t("ফিল্টার পরিবর্তন করুন", "Try changing the filters") : t("শুরুতে একটি ই-বুক যোগ করুন", "Get started by uploading one")}
      </p>
    </div>
  );
}

function GridSkeleton({ view }: { view: ViewMode }) {
  if (view === "table") {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
        {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-14 rounded-lg" />)}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {[...Array(12)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-100 p-3">
          <div className="flex gap-3">
            <div className="skeleton w-14 h-[72px] rounded-md shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="skeleton h-3.5 w-3/4" />
              <div className="skeleton h-3 w-1/2" />
              <div className="skeleton h-3 w-1/3" />
            </div>
          </div>
          <div className="skeleton h-3 w-full mt-2.5" />
          <div className="skeleton h-6 w-full mt-2" />
        </div>
      ))}
    </div>
  );
}

/* ─── Confirm copy ─── */

function pendingTitle(p: { ebook: AdminEbook; action: "activate" | "deactivate" | "delete" } | null, t: (bn: string, en: string) => string): string {
  if (!p) return "";
  switch (p.action) {
    case "activate":   return t("ই-বুক সক্রিয় করবেন?", "Activate this ebook?");
    case "deactivate": return t("ই-বুক নিষ্ক্রিয় করবেন?", "Deactivate this ebook?");
    case "delete":     return t("ই-বুক ডিলিট করবেন?", "Delete this ebook?");
  }
}

function pendingBody(p: { ebook: AdminEbook; action: "activate" | "deactivate" | "delete" } | null, t: (bn: string, en: string) => string): string {
  if (!p) return "";
  const name = p.ebook.title_bn || p.ebook.title;
  switch (p.action) {
    case "activate":   return t(`"${name}" শপে আবার দৃশ্যমান হবে।`, `"${name}" will be visible on the shop again.`);
    case "deactivate": return t(`"${name}" শপ থেকে লুকানো হবে। বিদ্যমান ক্রেতারা এখনো ডাউনলোড করতে পারবেন।`, `"${name}" will be hidden from the shop. Existing buyers can still download.`);
    case "delete":     return t(
      `"${name}" স্থায়ীভাবে মুছে যাবে। ${p.ebook.sales_count > 0 ? `এই ই-বুকের ${p.ebook.sales_count}টি বিক্রির রেকর্ড আছে — সতর্কতার সাথে ডিলিট করুন।` : ""}`,
      `"${name}" will be permanently removed. ${p.ebook.sales_count > 0 ? `This ebook has ${p.ebook.sales_count} sales records — delete with care.` : ""}`
    );
  }
}

function pendingConfirmLabel(p: { action: "activate" | "deactivate" | "delete" } | null, t: (bn: string, en: string) => string): string {
  if (!p) return t("নিশ্চিত করুন", "Confirm");
  switch (p.action) {
    case "activate":   return t("সক্রিয় করুন", "Activate");
    case "deactivate": return t("নিষ্ক্রিয় করুন", "Deactivate");
    case "delete":     return t("ডিলিট করুন", "Delete");
  }
}

/* ─── Formatters ─── */

function formatCompact(n: number, locale: string): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return n.toLocaleString(locale === "bn" ? "bn-BD" : "en-US");
}

function formatCurrency(n: number, locale: string): string {
  if (n >= 1_00_000) return `৳${(n / 1_00_000).toFixed(n >= 10_00_000 ? 0 : 1)}L`;
  if (n >= 1_000) return `৳${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return `৳${Math.round(n).toLocaleString(locale === "bn" ? "bn-BD" : "en-US")}`;
}
