"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, Search, ShoppingBag, Package, AlertTriangle, XCircle, Wallet,
  Edit3, Trash2, Grid3x3, Rows3, Loader2, PackageCheck, PackageX, Tag, Power, ArrowUpDown,
} from "lucide-react";
import { useLocaleStore } from "@/stores/locale-store";
import { api } from "@/lib/api";
import { toast } from "@/stores/toast-store";
import { ConfirmModal } from "../ConfirmModal";

type ShopItem = {
  id: string;
  title: string;
  title_bn?: string | null;
  slug?: string;
  thumbnail_url?: string | null;
  price: number;
  compare_price?: number | null;
  is_active: boolean;
  stock_quantity: number;
  category_id?: number | null;
  category_name?: string | null;
  category_name_bn?: string | null;
  sku?: string | null;
  author?: string | null;
  images?: { image_url: string }[];
  created_at?: string;
};

type Stats = {
  total: number;
  active: number;
  inactive: number;
  out_of_stock: number;
  low_stock: number;
  in_stock: number;
  inventory_value: number;
  low_stock_threshold: number;
};

type Category = { id: number; name: string; name_bn?: string | null };

type StatusFilter = "" | "active" | "inactive" | "low_stock" | "out_of_stock";
type SortOption = "newest" | "oldest" | "price_asc" | "price_desc" | "stock_asc" | "stock_desc" | "name_asc";
type ViewMode = "grid" | "table";

export function ShopProductsPanel({
  accessToken,
  categories,
  refreshKey,
  onCreate,
  onEdit,
}: {
  accessToken: string;
  categories: Category[];
  refreshKey: number;
  onCreate: () => void;
  onEdit: (item: ShopItem) => void;
}) {
  const { locale, t } = useLocaleStore();

  const [items, setItems] = useState<ShopItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [view, setView] = useState<ViewMode>("grid");

  const [deleting, setDeleting] = useState<ShopItem | null>(null);
  const [toggling, setToggling] = useState<ShopItem | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // debounce search
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (categoryId) params.set("category_id", categoryId);
      if (statusFilter) params.set("status", statusFilter);
      params.set("sort", sort);
      const data: any = await api.get(`/physical-items/admin?${params.toString()}`, accessToken);
      setItems(Array.isArray(data?.items) ? data.items : []);
      setStats(data?.stats || null);
    } catch (err: any) {
      toast.error(err?.message || t("লোড করতে ব্যর্থ", "Failed to load products"));
    } finally {
      setLoading(false);
    }
  }, [accessToken, debouncedSearch, categoryId, statusFilter, sort, t]);

  useEffect(() => { load(); }, [load, refreshKey]);

  // Kick off toggle-active — shows confirmation modal; actual write happens on confirm.
  const requestToggleActive = (item: ShopItem) => setToggling(item);

  const handleConfirmToggle = async () => {
    if (!toggling) return;
    setTogglingId(toggling.id);
    try {
      const next = !toggling.is_active;
      await api.patch(`/physical-items/${toggling.id}`, { is_active: next }, accessToken);
      toast.success(
        next
          ? t("প্রোডাক্ট অ্যাক্টিভ করা হয়েছে", "Product activated")
          : t("প্রোডাক্ট ইনঅ্যাক্টিভ করা হয়েছে", "Product deactivated")
      );
      setToggling(null);
      await load();
    } catch (err: any) {
      toast.error(err?.message || t("আপডেট ব্যর্থ", "Update failed"));
    } finally {
      setTogglingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleting) return;
    try {
      await api.delete(`/physical-items/${deleting.id}`, accessToken);
      toast.success(t("প্রোডাক্ট ডিলিট করা হয়েছে", "Product deleted"));
      setDeleting(null);
      await load();
    } catch (err: any) {
      toast.error(err?.message || t("ডিলিট ব্যর্থ", "Delete failed"));
    }
  };

  const activeFiltersCount = [debouncedSearch, categoryId, statusFilter].filter(Boolean).length;

  return (
    <div>
      <Header onCreate={onCreate} locale={locale} t={t} />
      <StatsStrip stats={stats} loading={loading && !stats} locale={locale} t={t} onQuickFilter={setStatusFilter} activeFilter={statusFilter} />
      <Toolbar
        search={search} setSearch={setSearch}
        categoryId={categoryId} setCategoryId={setCategoryId}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        sort={sort} setSort={setSort}
        view={view} setView={setView}
        categories={categories}
        activeFiltersCount={activeFiltersCount}
        onClear={() => { setSearch(""); setCategoryId(""); setStatusFilter(""); }}
        locale={locale} t={t}
      />

      {loading && items.length === 0 ? (
        <GridSkeleton view={view} />
      ) : items.length === 0 ? (
        <EmptyState hasFilters={activeFiltersCount > 0} locale={locale} t={t} />
      ) : view === "grid" ? (
        <Grid items={items} onEdit={onEdit} onDelete={setDeleting} onToggle={requestToggleActive} togglingId={togglingId} stats={stats} locale={locale} t={t} />
      ) : (
        <Table items={items} onEdit={onEdit} onDelete={setDeleting} onToggle={requestToggleActive} togglingId={togglingId} stats={stats} locale={locale} t={t} />
      )}

      <ConfirmModal
        open={deleting !== null}
        title={t("প্রোডাক্ট ডিলিট করবেন?", "Delete this product?")}
        body={t(
          `"${deleting?.title_bn || deleting?.title || ""}" স্থায়ীভাবে মুছে যাবে — এটি পূর্বাবস্থায় ফেরানো যাবে না।`,
          `"${deleting?.title_bn || deleting?.title || ""}" will be permanently removed. This cannot be undone.`
        )}
        confirmLabel={t("ডিলিট করুন", "Delete")}
        tone="destructive"
        onCancel={() => setDeleting(null)}
        onConfirm={handleConfirmDelete}
      />

      <ConfirmModal
        open={toggling !== null}
        title={toggling?.is_active
          ? t("প্রোডাক্ট নিষ্ক্রিয় করবেন?", "Deactivate this product?")
          : t("প্রোডাক্ট সক্রিয় করবেন?", "Activate this product?")}
        body={toggling?.is_active
          ? t(
              `"${toggling?.title_bn || toggling?.title || ""}" শপ থেকে লুকানো হবে। বর্তমান অর্ডারে প্রভাব পড়বে না।`,
              `"${toggling?.title_bn || toggling?.title || ""}" will be hidden from the shop. Existing orders are unaffected.`
            )
          : t(
              `"${toggling?.title_bn || toggling?.title || ""}" আবার শপে দৃশ্যমান হবে।`,
              `"${toggling?.title_bn || toggling?.title || ""}" will be visible on the shop again.`
            )}
        confirmLabel={toggling?.is_active ? t("নিষ্ক্রিয় করুন", "Deactivate") : t("সক্রিয় করুন", "Activate")}
        tone={toggling?.is_active ? "destructive" : "info"}
        onCancel={() => setToggling(null)}
        onConfirm={handleConfirmToggle}
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
          <ShoppingBag className="w-3.5 h-3.5" />
          <span className={locale === "bn" ? "font-bn" : ""}>{t("শপ ইনভেন্টরি", "Shop Inventory")}</span>
        </div>
        <h1 className={`text-xl md:text-2xl font-bold text-gray-900 ${locale === "bn" ? "font-bn" : ""}`}>
          {t("শপ প্রোডাক্ট", "Shop Products")}
        </h1>
      </div>
      <button
        onClick={onCreate}
        className={`inline-flex items-center gap-2 px-4 py-2 bg-[#7c2df7] text-white text-sm font-semibold rounded-xl hover:bg-[#6b1ee3] shadow-sm ${locale === "bn" ? "font-bn" : ""}`}
      >
        <Plus className="w-4 h-4" /> {t("নতুন প্রোডাক্ট", "New product")}
      </button>
    </div>
  );
}

/* ─── Stats strip ─── */

function StatsStrip({
  stats, loading, locale, t, onQuickFilter, activeFilter,
}: {
  stats: Stats | null; loading: boolean; locale: string; t: (bn: string, en: string) => string;
  onQuickFilter: (f: StatusFilter) => void; activeFilter: StatusFilter;
}) {
  const cards: { key: StatusFilter; label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; tone: string; iconBg: string; iconFg: string; clickable?: boolean }[] = [
    { key: "",              label: t("মোট প্রোডাক্ট", "Total products"),  value: stats?.total ?? 0,                                     icon: Package,        tone: "bg-white border-gray-100",        iconBg: "bg-[#f5f0ff]",  iconFg: "text-[#7c2df7]" },
    { key: "active",        label: t("অ্যাক্টিভ", "Active"),              value: stats?.active ?? 0,                                   icon: PackageCheck,   tone: "bg-white border-gray-100",        iconBg: "bg-emerald-50", iconFg: "text-emerald-600", clickable: true },
    { key: "low_stock",     label: t("কম স্টক", "Low stock"),             value: stats?.low_stock ?? 0,                                icon: AlertTriangle,  tone: "bg-white border-gray-100",        iconBg: "bg-amber-50",   iconFg: "text-amber-600",   clickable: true },
    { key: "out_of_stock",  label: t("স্টক নেই", "Out of stock"),         value: stats?.out_of_stock ?? 0,                             icon: XCircle,        tone: "bg-white border-gray-100",        iconBg: "bg-rose-50",    iconFg: "text-rose-600",    clickable: true },
    { key: "inactive",      label: t("ইনঅ্যাক্টিভ", "Inactive"),          value: stats?.inactive ?? 0,                                 icon: PackageX,       tone: "bg-white border-gray-100",        iconBg: "bg-gray-50",    iconFg: "text-gray-500",    clickable: true },
    { key: "",              label: t("ইনভেন্টরি মূল্য", "Inventory value"), value: stats ? formatCurrency(stats.inventory_value, locale) : "—", icon: Wallet, tone: "bg-gradient-to-br from-[#f5f0ff] to-[#fff8e1] border-[#f0e4ff]", iconBg: "bg-white", iconFg: "text-[#7c2df7]" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
      {cards.map((c, i) => {
        const isActive = c.clickable && activeFilter === c.key;
        const clickProps = c.clickable
          ? { onClick: () => onQuickFilter(isActive ? "" : c.key), as: "button" as const, type: "button" as const }
          : { as: "div" as const };
        const El: any = c.clickable ? "button" : "div";
        return (
          <El
            key={i}
            {...(c.clickable ? { onClick: clickProps.onClick, type: "button" } : {})}
            className={`text-left rounded-2xl border p-4 ${c.tone} ${c.clickable ? "hover:border-[#7c2df7]/30 hover:-translate-y-0.5 transition-all" : ""} ${isActive ? "ring-2 ring-[#7c2df7]/30 border-[#7c2df7]/40" : ""}`}
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
  search, setSearch, categoryId, setCategoryId, statusFilter, setStatusFilter,
  sort, setSort, view, setView, categories, activeFiltersCount, onClear, locale, t,
}: {
  search: string; setSearch: (v: string) => void;
  categoryId: string; setCategoryId: (v: string) => void;
  statusFilter: StatusFilter; setStatusFilter: (v: StatusFilter) => void;
  sort: SortOption; setSort: (v: SortOption) => void;
  view: ViewMode; setView: (v: ViewMode) => void;
  categories: Category[]; activeFiltersCount: number; onClear: () => void;
  locale: string; t: (bn: string, en: string) => string;
}) {
  const selectClass = "bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 outline-none focus:border-[#7c2df7]/50 hover:border-gray-300 transition-colors cursor-pointer appearance-none pr-8";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 mb-5">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("নাম বা SKU দিয়ে খুঁজুন...", "Search by name or SKU...")}
            className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 outline-none focus:border-[#7c2df7]/50 ${locale === "bn" ? "font-bn" : ""}`}
          />
        </div>

        {/* Category */}
        <div className="relative">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={`${selectClass} ${locale === "bn" ? "font-bn" : ""}`}
            aria-label={t("ক্যাটাগরি", "Category")}
          >
            <option value="">{t("সব ক্যাটাগরি", "All categories")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{locale === "bn" ? (c.name_bn || c.name) : c.name}</option>
            ))}
          </select>
          <Tag className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>

        {/* Stock status */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className={`${selectClass} ${locale === "bn" ? "font-bn" : ""}`}
            aria-label={t("স্ট্যাটাস", "Status")}
          >
            <option value="">{t("সব স্ট্যাটাস", "All statuses")}</option>
            <option value="active">{t("অ্যাক্টিভ", "Active")}</option>
            <option value="inactive">{t("ইনঅ্যাক্টিভ", "Inactive")}</option>
            <option value="low_stock">{t("কম স্টক", "Low stock")}</option>
            <option value="out_of_stock">{t("স্টক নেই", "Out of stock")}</option>
          </select>
          <Power className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>

        {/* Sort */}
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className={`${selectClass} ${locale === "bn" ? "font-bn" : ""}`}
            aria-label={t("সাজান", "Sort")}
          >
            <option value="newest">{t("নতুন আগে", "Newest first")}</option>
            <option value="oldest">{t("পুরাতন আগে", "Oldest first")}</option>
            <option value="price_asc">{t("দাম: কম → বেশি", "Price: low → high")}</option>
            <option value="price_desc">{t("দাম: বেশি → কম", "Price: high → low")}</option>
            <option value="stock_asc">{t("স্টক: কম → বেশি", "Stock: low → high")}</option>
            <option value="stock_desc">{t("স্টক: বেশি → কম", "Stock: high → low")}</option>
            <option value="name_asc">{t("নাম: A → Z", "Name: A → Z")}</option>
          </select>
          <ArrowUpDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>

        {/* View toggle */}
        <div className="inline-flex rounded-xl bg-gray-100 p-0.5">
          <button
            onClick={() => setView("grid")}
            className={`p-1.5 rounded-lg transition-colors ${view === "grid" ? "bg-white shadow-sm text-[#7c2df7]" : "text-gray-500 hover:text-gray-800"}`}
            title={t("গ্রিড ভিউ", "Grid view")}
          >
            <Grid3x3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView("table")}
            className={`p-1.5 rounded-lg transition-colors ${view === "table" ? "bg-white shadow-sm text-[#7c2df7]" : "text-gray-500 hover:text-gray-800"}`}
            title={t("টেবিল ভিউ", "Table view")}
          >
            <Rows3 className="w-4 h-4" />
          </button>
        </div>

        {/* Clear */}
        {activeFiltersCount > 0 && (
          <button
            onClick={onClear}
            className={`text-xs font-semibold text-[#7c2df7] hover:text-[#532d80] px-2 ${locale === "bn" ? "font-bn" : ""}`}
          >
            {t("ফিল্টার মুছুন", "Clear filters")} ({activeFiltersCount})
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Grid view ─── */

function Grid({
  items, onEdit, onDelete, onToggle, togglingId, stats, locale, t,
}: {
  items: ShopItem[];
  onEdit: (i: ShopItem) => void;
  onDelete: (i: ShopItem) => void;
  onToggle: (i: ShopItem) => void;
  togglingId: string | null;
  stats: Stats | null;
  locale: string;
  t: (bn: string, en: string) => string;
}) {
  const threshold = stats?.low_stock_threshold ?? 5;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {items.map((item) => (
        <GridCard
          key={item.id}
          item={item}
          threshold={threshold}
          toggling={togglingId === item.id}
          onEdit={() => onEdit(item)}
          onDelete={() => onDelete(item)}
          onToggle={() => onToggle(item)}
          locale={locale}
          t={t}
        />
      ))}
    </div>
  );
}

function GridCard({
  item, threshold, toggling, onEdit, onDelete, onToggle, locale, t,
}: {
  item: ShopItem;
  threshold: number;
  toggling: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  locale: string;
  t: (bn: string, en: string) => string;
}) {
  const stockStatus = getStockStatus(item.stock_quantity, threshold, item.is_active);
  const imageUrl = item.images?.[0]?.image_url || item.thumbnail_url;
  const hasDiscount = item.compare_price && item.compare_price > item.price;
  const discountPct = hasDiscount ? Math.round(((item.compare_price! - item.price) / item.compare_price!) * 100) : 0;

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-[#7c2df7]/20 transition-all ${!item.is_active ? "opacity-75" : ""}`}>
      {/* Image */}
      <div className="relative aspect-square bg-gray-50">
        {imageUrl ? (
          <img src={imageUrl} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="w-12 h-12 text-gray-300" /></div>
        )}
        {hasDiscount && item.is_active && (
          <div className="absolute top-2 left-2 bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            −{discountPct}%
          </div>
        )}
        <div className={`absolute top-2 right-2 ${stockStatus.bg} ${stockStatus.fg} text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1`}>
          <span className={`w-1.5 h-1.5 rounded-full ${stockStatus.dot}`} />
          <span className={locale === "bn" ? "font-bn" : ""}>{stockStatus.label[locale === "bn" ? "bn" : "en"]}</span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <h3 className={`font-bold text-sm text-gray-900 line-clamp-2 leading-snug ${locale === "bn" ? "font-bn" : ""}`}>
          {item.title_bn || item.title}
        </h3>

        <div className="flex items-baseline gap-2 mt-1.5">
          <span className="text-base font-bold text-[#7c2df7] tabular-nums">৳{item.price.toLocaleString(locale === "bn" ? "bn-BD" : "en-US")}</span>
          {hasDiscount && (
            <span className="text-xs text-gray-400 line-through tabular-nums">
              ৳{item.compare_price!.toLocaleString(locale === "bn" ? "bn-BD" : "en-US")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[10px]">
          <span className={`inline-flex items-center gap-1 ${item.stock_quantity === 0 ? "text-rose-600" : item.stock_quantity < threshold ? "text-amber-600" : "text-gray-500"} font-semibold ${locale === "bn" ? "font-bn" : ""}`}>
            {t("স্টক", "Stock")}: <span className="tabular-nums">{item.stock_quantity}</span>
          </span>
          {item.category_name && (
            <span className={`bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full truncate max-w-[120px] ${locale === "bn" ? "font-bn" : ""}`}>
              {(locale === "bn" ? item.category_name_bn : null) || item.category_name}
            </span>
          )}
          {item.sku && <span className="text-gray-400 font-mono">{item.sku}</span>}
        </div>

        <div className="flex gap-1.5 mt-3">
          <button
            onClick={onEdit}
            className={`flex-1 py-1.5 text-xs font-semibold text-[#7c2df7] bg-[#f5f0ff] rounded-lg hover:bg-[#ede5ff] inline-flex items-center justify-center gap-1 ${locale === "bn" ? "font-bn" : ""}`}
          >
            <Edit3 className="w-3 h-3" /> {t("এডিট", "Edit")}
          </button>
          <button
            onClick={onToggle}
            disabled={toggling}
            title={item.is_active ? t("নিষ্ক্রিয় করুন", "Deactivate") : t("সক্রিয় করুন", "Activate")}
            className={`py-1.5 px-2.5 text-xs font-semibold rounded-lg disabled:opacity-50 ${item.is_active ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
          >
            {toggling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Power className="w-3 h-3" />}
          </button>
          <button
            onClick={onDelete}
            title={t("ডিলিট", "Delete")}
            className="py-1.5 px-2.5 text-xs font-semibold text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Table view ─── */

function Table({
  items, onEdit, onDelete, onToggle, togglingId, stats, locale, t,
}: {
  items: ShopItem[];
  onEdit: (i: ShopItem) => void;
  onDelete: (i: ShopItem) => void;
  onToggle: (i: ShopItem) => void;
  togglingId: string | null;
  stats: Stats | null;
  locale: string;
  t: (bn: string, en: string) => string;
}) {
  const threshold = stats?.low_stock_threshold ?? 5;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className={`text-left text-[10px] uppercase tracking-wider text-gray-400 font-semibold ${locale === "bn" ? "font-bn" : ""}`}>
              <th className="px-4 py-3">{t("প্রোডাক্ট", "Product")}</th>
              <th className="px-3 py-3">{t("ক্যাটাগরি", "Category")}</th>
              <th className="px-3 py-3 text-right">{t("দাম", "Price")}</th>
              <th className="px-3 py-3 text-right">{t("স্টক", "Stock")}</th>
              <th className="px-3 py-3">{t("স্ট্যাটাস", "Status")}</th>
              <th className="px-4 py-3 text-right">{t("অ্যাকশন", "Actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((item) => {
              const stockStatus = getStockStatus(item.stock_quantity, threshold, item.is_active);
              const imageUrl = item.images?.[0]?.image_url || item.thumbnail_url;
              const hasDiscount = item.compare_price && item.compare_price > item.price;
              return (
                <tr key={item.id} className="hover:bg-[#faf8ff]">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                        {imageUrl ? (
                          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : <ShoppingBag className="w-4 h-4 text-gray-300" />}
                      </div>
                      <div className="min-w-0">
                        <p className={`font-semibold text-sm text-gray-900 truncate max-w-[260px] ${locale === "bn" ? "font-bn" : ""}`}>
                          {item.title_bn || item.title}
                        </p>
                        {item.sku && <p className="text-[10px] text-gray-400 font-mono">{item.sku}</p>}
                      </div>
                    </div>
                  </td>
                  <td className={`px-3 py-2.5 text-xs text-gray-600 max-w-[140px] truncate ${locale === "bn" ? "font-bn" : ""}`}>
                    {(locale === "bn" ? item.category_name_bn : null) || item.category_name || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-bold text-gray-900 tabular-nums">৳{item.price.toLocaleString(locale === "bn" ? "bn-BD" : "en-US")}</span>
                      {hasDiscount && <span className="text-[10px] text-gray-400 line-through tabular-nums">৳{item.compare_price!.toLocaleString(locale === "bn" ? "bn-BD" : "en-US")}</span>}
                    </div>
                  </td>
                  <td className={`px-3 py-2.5 text-right text-sm font-bold tabular-nums ${item.stock_quantity === 0 ? "text-rose-600" : item.stock_quantity < threshold ? "text-amber-600" : "text-gray-900"}`}>
                    {item.stock_quantity}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center gap-1 ${stockStatus.bg} ${stockStatus.fg} text-[10px] font-bold px-2 py-0.5 rounded-full ${locale === "bn" ? "font-bn" : ""}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${stockStatus.dot}`} />
                      {stockStatus.label[locale === "bn" ? "bn" : "en"]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => onToggle(item)}
                        disabled={togglingId === item.id}
                        title={item.is_active ? t("নিষ্ক্রিয় করুন", "Deactivate") : t("সক্রিয় করুন", "Activate")}
                        className={`p-1.5 rounded-lg disabled:opacity-50 ${item.is_active ? "text-emerald-600 hover:bg-emerald-50" : "text-gray-400 hover:bg-gray-50"}`}
                      >
                        {togglingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => onEdit(item)}
                        title={t("এডিট", "Edit")}
                        className="p-1.5 rounded-lg text-[#7c2df7] hover:bg-[#f5f0ff]"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDelete(item)}
                        title={t("ডিলিট", "Delete")}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
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
  );
}

/* ─── Empty & skeleton ─── */

function EmptyState({ hasFilters, locale, t }: { hasFilters: boolean; locale: string; t: (bn: string, en: string) => string }) {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
      <div className="w-14 h-14 mx-auto rounded-full bg-[#f5f0ff] flex items-center justify-center mb-3">
        <ShoppingBag className="w-6 h-6 text-[#7c2df7]" />
      </div>
      <p className={`text-base font-bold text-gray-900 ${locale === "bn" ? "font-bn" : ""}`}>
        {hasFilters ? t("কোনো প্রোডাক্ট মেলেনি", "No products match your filters") : t("এখনো কোনো প্রোডাক্ট নেই", "No products yet")}
      </p>
      <p className={`text-sm text-gray-500 mt-1 ${locale === "bn" ? "font-bn" : ""}`}>
        {hasFilters ? t("ফিল্টার পরিবর্তন করুন", "Try changing the filters") : t("শুরুতে একটি প্রোডাক্ট যোগ করুন", "Get started by creating one")}
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="skeleton aspect-square rounded-none" />
          <div className="p-4 space-y-2">
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-5 w-1/3" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Helpers ─── */

type StockStatus = {
  label: { en: string; bn: string };
  bg: string;
  fg: string;
  dot: string;
};

function getStockStatus(stock: number, threshold: number, active: boolean): StockStatus {
  if (!active) return { label: { en: "Inactive", bn: "ইনঅ্যাক্টিভ" }, bg: "bg-gray-100", fg: "text-gray-600", dot: "bg-gray-400" };
  if (stock === 0) return { label: { en: "Out of stock", bn: "স্টক নেই" }, bg: "bg-rose-50", fg: "text-rose-700", dot: "bg-rose-500" };
  if (stock < threshold) return { label: { en: "Low stock", bn: "কম স্টক" }, bg: "bg-amber-50", fg: "text-amber-800", dot: "bg-amber-500" };
  return { label: { en: "In stock", bn: "স্টকে আছে" }, bg: "bg-emerald-50", fg: "text-emerald-700", dot: "bg-emerald-500" };
}

function formatCurrency(n: number, locale: string): string {
  const rounded = Math.round(n);
  return `৳${rounded.toLocaleString(locale === "bn" ? "bn-BD" : "en-US")}`;
}
