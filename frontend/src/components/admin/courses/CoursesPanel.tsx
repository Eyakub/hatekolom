"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Search, BookOpen, Users as UsersIcon, GraduationCap, Sparkles, Wallet,
  Edit3, Grid3x3, Rows3, Loader2, Star, Tag, ArrowUpDown, Power, Video, Radio, Layers, TrendingUp,
} from "lucide-react";
import { useLocaleStore } from "@/stores/locale-store";
import { api } from "@/lib/api";
import { toast } from "@/stores/toast-store";
import { ConfirmModal } from "../ConfirmModal";

type AdminCourse = {
  id: string;
  product_id: string;
  course_type: string;
  level?: string | null;
  total_lessons: number;
  is_featured: boolean;
  category_id?: number | null;
  category_name?: string | null;
  category_name_bn?: string | null;
  instructor_id?: string | null;
  instructor_name?: string | null;
  instructor_name_bn?: string | null;
  enrollment_count: number;
  revenue: number;
  product: {
    id: string;
    title: string;
    title_bn?: string | null;
    slug: string;
    description?: string | null;
    description_bn?: string | null;
    thumbnail_url?: string | null;
    price: number;
    compare_price?: number | null;
    is_free: boolean;
    is_active: boolean;
    created_at?: string | null;
  };
};

type Stats = {
  total: number;
  active: number;
  inactive: number;
  featured: number;
  free: number;
  paid: number;
  total_enrollments: number;
  total_revenue: number;
};

type Category = { id: number; name: string; name_bn?: string | null };
type StatusFilter = "" | "active" | "inactive" | "featured" | "free" | "paid";
type TypeFilter = "" | "recorded" | "live" | "hybrid";
type SortOption = "newest" | "oldest" | "price_asc" | "price_desc" | "enrollments_desc" | "revenue_desc" | "name_asc";
type ViewMode = "grid" | "table";

export function CoursesPanel({
  accessToken,
  categories,
  refreshKey,
  onCreate,
  onEdit,
  onToggleFeatured,
  onToggleActive,
}: {
  accessToken: string;
  categories: Category[];
  refreshKey: number;
  onCreate: () => void;
  onEdit: (course: AdminCourse) => void;
  onToggleFeatured?: (course: AdminCourse, next: boolean) => Promise<void>;
  onToggleActive?: (course: AdminCourse, next: boolean) => Promise<void>;
}) {
  const { locale, t } = useLocaleStore();
  const router = useRouter();

  const [items, setItems] = useState<AdminCourse[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [view, setView] = useState<ViewMode>("grid");

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    course: AdminCourse;
    action: "feature" | "unfeature" | "activate" | "deactivate";
  } | null>(null);

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
      if (typeFilter) params.set("course_type", typeFilter);
      if (statusFilter) params.set("status", statusFilter);
      params.set("sort", sort);
      const data: any = await api.get(`/courses/admin?${params.toString()}`, accessToken);
      setItems(Array.isArray(data?.items) ? data.items : []);
      setStats(data?.stats || null);
    } catch (err: any) {
      toast.error(err?.message || t("কোর্স লোড ব্যর্থ", "Failed to load courses"));
    } finally {
      setLoading(false);
    }
  }, [accessToken, debouncedSearch, categoryId, typeFilter, statusFilter, sort, t]);

  useEffect(() => { load(); }, [load, refreshKey]);

  // Toggles open a confirmation modal; the actual write happens in executePending.
  const requestToggleFeatured = (c: AdminCourse) =>
    setPending({ course: c, action: c.is_featured ? "unfeature" : "feature" });

  const requestToggleActive = (c: AdminCourse) =>
    setPending({ course: c, action: c.product.is_active ? "deactivate" : "activate" });

  const executePending = async () => {
    if (!pending) return;
    const { course: c, action } = pending;
    setTogglingId(c.id);
    try {
      if (action === "feature" || action === "unfeature") {
        const next = action === "feature";
        if (onToggleFeatured) await onToggleFeatured(c, next);
        else await api.patch(`/courses/${c.id}`, { is_featured: next }, accessToken);
        toast.success(next ? t("ফিচার্ড করা হয়েছে", "Featured") : t("ফিচার্ড থেকে সরানো", "Unfeatured"));
        setItems((prev) => prev.map((x) => (x.id === c.id ? { ...x, is_featured: next } : x)));
      } else {
        const next = action === "activate";
        if (onToggleActive) await onToggleActive(c, next);
        else await api.patch(`/courses/${c.id}`, { is_active: next }, accessToken);
        toast.success(next ? t("সক্রিয় করা হয়েছে", "Activated") : t("নিষ্ক্রিয় করা হয়েছে", "Deactivated"));
        setItems((prev) => prev.map((x) => (x.id === c.id ? { ...x, product: { ...x.product, is_active: next } } : x)));
      }
      setPending(null);
    } catch (err: any) {
      toast.error(err?.message || t("আপডেট ব্যর্থ", "Update failed"));
    } finally {
      setTogglingId(null);
    }
  };

  const activeFilters = [debouncedSearch, categoryId, typeFilter, statusFilter].filter(Boolean).length;

  return (
    <div>
      <Header onCreate={onCreate} locale={locale} t={t} />
      <StatsStrip stats={stats} loading={loading && !stats} locale={locale} t={t} onQuickFilter={setStatusFilter} activeFilter={statusFilter} />
      <Toolbar
        search={search} setSearch={setSearch}
        categoryId={categoryId} setCategoryId={setCategoryId}
        typeFilter={typeFilter} setTypeFilter={setTypeFilter}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        sort={sort} setSort={setSort}
        view={view} setView={setView}
        categories={categories}
        activeFiltersCount={activeFilters}
        onClear={() => { setSearch(""); setCategoryId(""); setTypeFilter(""); setStatusFilter(""); }}
        locale={locale} t={t}
      />

      {loading && items.length === 0 ? (
        <GridSkeleton view={view} />
      ) : items.length === 0 ? (
        <EmptyState hasFilters={activeFilters > 0} locale={locale} t={t} />
      ) : view === "grid" ? (
        <Grid
          items={items}
          onEdit={onEdit}
          onOpen={(c) => router.push(`/admin/courses/${c.id}`)}
          onToggleFeatured={requestToggleFeatured}
          onToggleActive={requestToggleActive}
          togglingId={togglingId}
          locale={locale}
          t={t}
        />
      ) : (
        <Table
          items={items}
          onEdit={onEdit}
          onOpen={(c) => router.push(`/admin/courses/${c.id}`)}
          onToggleFeatured={requestToggleFeatured}
          onToggleActive={requestToggleActive}
          togglingId={togglingId}
          locale={locale}
          t={t}
        />
      )}

      <ConfirmModal
        open={pending !== null}
        title={pendingTitle(pending, t)}
        body={pendingBody(pending, t)}
        confirmLabel={pendingConfirmLabel(pending, t)}
        tone={pending?.action === "deactivate" ? "destructive" : "info"}
        onCancel={() => setPending(null)}
        onConfirm={executePending}
      />
    </div>
  );
}

function pendingName(p: { course: AdminCourse } | null): string {
  if (!p) return "";
  return p.course.product.title_bn || p.course.product.title || "";
}

function pendingTitle(
  p: { action: "feature" | "unfeature" | "activate" | "deactivate" } | null,
  t: (bn: string, en: string) => string
): string {
  if (!p) return "";
  switch (p.action) {
    case "feature":    return t("কোর্স ফিচার্ড করবেন?", "Feature this course?");
    case "unfeature":  return t("ফিচার্ড থেকে সরাবেন?", "Remove from featured?");
    case "activate":   return t("কোর্স সক্রিয় করবেন?", "Activate this course?");
    case "deactivate": return t("কোর্স নিষ্ক্রিয় করবেন?", "Deactivate this course?");
  }
}

function pendingBody(
  p: { course: AdminCourse; action: "feature" | "unfeature" | "activate" | "deactivate" } | null,
  t: (bn: string, en: string) => string
): string {
  if (!p) return "";
  const name = pendingName(p);
  switch (p.action) {
    case "feature":
      return t(
        `"${name}" হোমপেজে ফিচার্ড কোর্স হিসেবে হাইলাইট হবে।`,
        `"${name}" will be highlighted as a featured course on the homepage.`
      );
    case "unfeature":
      return t(
        `"${name}" আর ফিচার্ড হিসেবে দেখানো হবে না।`,
        `"${name}" will no longer be highlighted as featured.`
      );
    case "activate":
      return t(
        `"${name}" ওয়েবসাইটে শিক্ষার্থীদের জন্য দৃশ্যমান হবে।`,
        `"${name}" will become visible to learners on the site.`
      );
    case "deactivate":
      return t(
        `"${name}" সাইট থেকে লুকানো হবে। বর্তমান এনরোলমেন্ট প্রভাবিত হবে না।`,
        `"${name}" will be hidden from the site. Existing enrollments are unaffected.`
      );
  }
}

function pendingConfirmLabel(
  p: { action: "feature" | "unfeature" | "activate" | "deactivate" } | null,
  t: (bn: string, en: string) => string
): string {
  if (!p) return t("নিশ্চিত করুন", "Confirm");
  switch (p.action) {
    case "feature":    return t("ফিচার্ড করুন", "Feature");
    case "unfeature":  return t("সরান", "Unfeature");
    case "activate":   return t("সক্রিয় করুন", "Activate");
    case "deactivate": return t("নিষ্ক্রিয় করুন", "Deactivate");
  }
}

/* ─── Header ─── */

function Header({ onCreate, locale, t }: { onCreate: () => void; locale: string; t: (bn: string, en: string) => string }) {
  return (
    <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
      <div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#7c2df7]">
          <GraduationCap className="w-3.5 h-3.5" />
          <span className={locale === "bn" ? "font-bn" : ""}>{t("কোর্স ম্যানেজমেন্ট", "Course Management")}</span>
        </div>
        <h1 className={`text-xl md:text-2xl font-bold text-gray-900 ${locale === "bn" ? "font-bn" : ""}`}>
          {t("কোর্স", "Courses")}
        </h1>
      </div>
      <button
        onClick={onCreate}
        className={`inline-flex items-center gap-2 px-4 py-2 bg-[#7c2df7] text-white text-sm font-semibold rounded-xl hover:bg-[#6b1ee3] shadow-sm ${locale === "bn" ? "font-bn" : ""}`}
      >
        <Plus className="w-4 h-4" /> {t("নতুন কোর্স", "New course")}
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
  const cards: { key: StatusFilter | "__enrollments" | "__revenue"; label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; iconBg: string; iconFg: string; clickable: boolean }[] = [
    { key: "",           label: t("মোট কোর্স", "Total courses"),    value: stats?.total ?? 0,       icon: BookOpen,     iconBg: "bg-[#f5f0ff]",  iconFg: "text-[#7c2df7]",  clickable: false },
    { key: "active",     label: t("অ্যাক্টিভ", "Active"),           value: stats?.active ?? 0,      icon: Power,        iconBg: "bg-emerald-50", iconFg: "text-emerald-600", clickable: true },
    { key: "featured",   label: t("ফিচার্ড", "Featured"),           value: stats?.featured ?? 0,    icon: Star,         iconBg: "bg-amber-50",   iconFg: "text-amber-600",   clickable: true },
    { key: "free",       label: t("ফ্রি কোর্স", "Free courses"),   value: stats?.free ?? 0,        icon: Sparkles,     iconBg: "bg-sky-50",     iconFg: "text-sky-600",     clickable: true },
    { key: "__enrollments", label: t("মোট এনরোলমেন্ট", "Total enrollments"), value: formatCompact(stats?.total_enrollments ?? 0, locale), icon: UsersIcon, iconBg: "bg-indigo-50", iconFg: "text-indigo-600", clickable: false },
    { key: "__revenue",  label: t("মোট রেভেনিউ", "Total revenue"),  value: stats ? formatCurrency(stats.total_revenue, locale) : "—", icon: Wallet, iconBg: "bg-[#fff8e1]", iconFg: "text-[#b77800]", clickable: false },
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
  search, setSearch, categoryId, setCategoryId, typeFilter, setTypeFilter,
  statusFilter, setStatusFilter, sort, setSort, view, setView,
  categories, activeFiltersCount, onClear, locale, t,
}: {
  search: string; setSearch: (v: string) => void;
  categoryId: string; setCategoryId: (v: string) => void;
  typeFilter: TypeFilter; setTypeFilter: (v: TypeFilter) => void;
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
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("কোর্স নাম খুঁজুন...", "Search courses...")}
            className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 outline-none focus:border-[#7c2df7]/50 ${locale === "bn" ? "font-bn" : ""}`}
          />
        </div>

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

        <div className="relative">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            className={`${selectClass} ${locale === "bn" ? "font-bn" : ""}`}
            aria-label={t("ধরন", "Type")}
          >
            <option value="">{t("সব ধরন", "All types")}</option>
            <option value="recorded">{t("রেকর্ডেড", "Recorded")}</option>
            <option value="live">{t("লাইভ", "Live")}</option>
            <option value="hybrid">{t("হাইব্রিড", "Hybrid")}</option>
          </select>
          <Video className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>

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
            <option value="featured">{t("ফিচার্ড", "Featured")}</option>
            <option value="free">{t("ফ্রি", "Free")}</option>
            <option value="paid">{t("পেইড", "Paid")}</option>
          </select>
          <Power className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className={`${selectClass} ${locale === "bn" ? "font-bn" : ""}`}
            aria-label={t("সাজান", "Sort")}
          >
            <option value="newest">{t("নতুন আগে", "Newest first")}</option>
            <option value="oldest">{t("পুরাতন আগে", "Oldest first")}</option>
            <option value="enrollments_desc">{t("সর্বাধিক এনরোলমেন্ট", "Most enrollments")}</option>
            <option value="revenue_desc">{t("সর্বাধিক রেভেনিউ", "Most revenue")}</option>
            <option value="price_asc">{t("দাম: কম → বেশি", "Price: low → high")}</option>
            <option value="price_desc">{t("দাম: বেশি → কম", "Price: high → low")}</option>
            <option value="name_asc">{t("নাম: A → Z", "Name: A → Z")}</option>
          </select>
          <ArrowUpDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>

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

/* ─── Type badge helper ─── */

function typeBadge(type: string, locale: string) {
  const map: Record<string, { bg: string; fg: string; bn: string; en: string; icon: React.ComponentType<{ className?: string }> }> = {
    recorded: { bg: "bg-violet-50", fg: "text-violet-700", bn: "রেকর্ডেড", en: "Recorded", icon: Video },
    live:     { bg: "bg-rose-50",   fg: "text-rose-700",   bn: "লাইভ",     en: "Live",     icon: Radio },
    hybrid:   { bg: "bg-indigo-50", fg: "text-indigo-700", bn: "হাইব্রিড", en: "Hybrid",  icon: Layers },
  };
  const info = map[type] || map.recorded;
  const Icon = info.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full ${info.bg} ${info.fg} ${locale === "bn" ? "font-bn" : ""}`}>
      <Icon className="w-2.5 h-2.5" />
      {locale === "bn" ? info.bn : info.en}
    </span>
  );
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

/* ─── Grid view ─── */

function Grid({
  items, onEdit, onOpen, onToggleFeatured, onToggleActive, togglingId, locale, t,
}: {
  items: AdminCourse[];
  onEdit: (c: AdminCourse) => void;
  onOpen: (c: AdminCourse) => void;
  onToggleFeatured: (c: AdminCourse) => void;
  onToggleActive: (c: AdminCourse) => void;
  togglingId: string | null;
  locale: string;
  t: (bn: string, en: string) => string;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((c) => (
        <CourseCard
          key={c.id}
          course={c}
          toggling={togglingId === c.id}
          onEdit={() => onEdit(c)}
          onOpen={() => onOpen(c)}
          onToggleFeatured={() => onToggleFeatured(c)}
          onToggleActive={() => onToggleActive(c)}
          locale={locale}
          t={t}
        />
      ))}
    </div>
  );
}

function CourseCard({
  course, toggling, onEdit, onOpen, onToggleFeatured, onToggleActive, locale, t,
}: {
  course: AdminCourse;
  toggling: boolean;
  onEdit: () => void;
  onOpen: () => void;
  onToggleFeatured: () => void;
  onToggleActive: () => void;
  locale: string;
  t: (bn: string, en: string) => string;
}) {
  const { product } = course;
  const hasDiscount = product.compare_price && product.compare_price > product.price;
  const discountPct = hasDiscount ? Math.round(((product.compare_price! - product.price) / product.compare_price!) * 100) : 0;

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-[#7c2df7]/20 transition-all group ${!product.is_active ? "opacity-75" : ""}`}>
      <div className="relative aspect-video bg-gradient-to-br from-[#f5f0ff] to-[#ede5ff]">
        {product.thumbnail_url ? (
          <img src={product.thumbnail_url} alt={product.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><BookOpen className="w-10 h-10 text-[#7c2df7]/30" /></div>
        )}
        {/* top-left pills */}
        <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap">
          {typeBadge(course.course_type, locale)}
          {product.is_free && (
            <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full bg-sky-500 text-white ${locale === "bn" ? "font-bn" : ""}`}>
              {t("ফ্রি", "FREE")}
            </span>
          )}
          {hasDiscount && !product.is_free && (
            <span className="inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-600 text-white">
              −{discountPct}%
            </span>
          )}
        </div>
        {/* top-right featured */}
        {course.is_featured && (
          <div className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 bg-amber-400 text-amber-900 text-[10px] font-bold rounded-full">
            <Star className="w-2.5 h-2.5 fill-amber-900" /> {t("ফিচার্ড", "Featured")}
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className={`font-bold text-sm text-gray-900 line-clamp-2 leading-snug min-h-[2.4em] ${locale === "bn" ? "font-bn" : ""}`}>
          {product.title_bn || product.title}
        </h3>

        {/* Metadata row */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[10px]">
          {course.category_name && (
            <span className={`bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full truncate max-w-[120px] ${locale === "bn" ? "font-bn" : ""}`}>
              {(locale === "bn" ? course.category_name_bn : null) || course.category_name}
            </span>
          )}
          {course.instructor_name && (
            <span className={`text-gray-500 truncate max-w-[140px] ${locale === "bn" ? "font-bn" : ""}`}>
              · {(locale === "bn" ? course.instructor_name_bn : null) || course.instructor_name}
            </span>
          )}
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100">
          <Metric icon={BookOpen} value={course.total_lessons} label={t("লেসন", "Lessons")} locale={locale} />
          <Metric icon={UsersIcon} value={formatCompact(course.enrollment_count, locale)} label={t("এনরোল", "Enrolled")} locale={locale} />
          <Metric icon={TrendingUp} value={formatCompactCurrency(course.revenue, locale)} label={t("রেভেনিউ", "Revenue")} locale={locale} />
        </div>

        {/* Price row */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-baseline gap-2">
            {product.is_free ? (
              <span className={`text-base font-bold text-sky-600 ${locale === "bn" ? "font-bn" : ""}`}>{t("ফ্রি", "Free")}</span>
            ) : (
              <>
                <span className="text-base font-bold text-[#7c2df7] tabular-nums">৳{product.price.toLocaleString(locale === "bn" ? "bn-BD" : "en-US")}</span>
                {hasDiscount && (
                  <span className="text-xs text-gray-400 line-through tabular-nums">
                    ৳{product.compare_price!.toLocaleString(locale === "bn" ? "bn-BD" : "en-US")}
                  </span>
                )}
              </>
            )}
          </div>
          {statusPill(product.is_active, locale, t)}
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 mt-3">
          <button
            onClick={onOpen}
            className={`flex-1 py-1.5 text-xs font-semibold text-[#7c2df7] bg-[#f5f0ff] rounded-lg hover:bg-[#ede5ff] inline-flex items-center justify-center gap-1 ${locale === "bn" ? "font-bn" : ""}`}
            title={t("মডিউল ও লেসন", "Modules & lessons")}
          >
            <BookOpen className="w-3 h-3" /> {t("মডিউল", "Modules")}
          </button>
          <button
            onClick={onEdit}
            className="py-1.5 px-2.5 text-xs font-semibold text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100"
            title={t("এডিট", "Edit")}
          >
            <Edit3 className="w-3 h-3" />
          </button>
          <button
            onClick={onToggleFeatured}
            disabled={toggling}
            title={course.is_featured ? t("ফিচার্ড থেকে সরান", "Unfeature") : t("ফিচার্ড করুন", "Feature")}
            className={`py-1.5 px-2.5 text-xs font-semibold rounded-lg disabled:opacity-50 ${course.is_featured ? "bg-amber-50 text-amber-700 hover:bg-amber-100" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}
          >
            {toggling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Star className={`w-3 h-3 ${course.is_featured ? "fill-current" : ""}`} />}
          </button>
          <button
            onClick={onToggleActive}
            disabled={toggling}
            title={product.is_active ? t("নিষ্ক্রিয় করুন", "Deactivate") : t("সক্রিয় করুন", "Activate")}
            className={`py-1.5 px-2.5 text-xs font-semibold rounded-lg disabled:opacity-50 ${product.is_active ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
          >
            {toggling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Power className="w-3 h-3" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, value, label, locale }: { icon: React.ComponentType<{ className?: string }>; value: string | number; label: string; locale: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-gray-400 mb-0.5">
        <Icon className="w-3 h-3" />
        <span className={`text-[10px] uppercase tracking-wide font-semibold ${locale === "bn" ? "font-bn" : ""}`}>{label}</span>
      </div>
      <p className="text-sm font-bold text-gray-900 tabular-nums truncate">{value}</p>
    </div>
  );
}

/* ─── Table view ─── */

function Table({
  items, onEdit, onOpen, onToggleFeatured, onToggleActive, togglingId, locale, t,
}: {
  items: AdminCourse[];
  onEdit: (c: AdminCourse) => void;
  onOpen: (c: AdminCourse) => void;
  onToggleFeatured: (c: AdminCourse) => void;
  onToggleActive: (c: AdminCourse) => void;
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
              <th className="px-4 py-3">{t("কোর্স", "Course")}</th>
              <th className="px-3 py-3">{t("ধরন", "Type")}</th>
              <th className="px-3 py-3 text-right">{t("লেসন", "Lessons")}</th>
              <th className="px-3 py-3 text-right">{t("এনরোল", "Enrolled")}</th>
              <th className="px-3 py-3 text-right">{t("রেভেনিউ", "Revenue")}</th>
              <th className="px-3 py-3 text-right">{t("দাম", "Price")}</th>
              <th className="px-3 py-3">{t("স্ট্যাটাস", "Status")}</th>
              <th className="px-4 py-3 text-right">{t("অ্যাকশন", "Actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((c) => {
              const { product } = c;
              const hasDiscount = product.compare_price && product.compare_price > product.price;
              return (
                <tr key={c.id} className="hover:bg-[#faf8ff]">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-10 rounded-lg bg-[#f5f0ff] overflow-hidden shrink-0 flex items-center justify-center">
                        {product.thumbnail_url ? (
                          <img src={product.thumbnail_url} alt="" className="w-full h-full object-cover" />
                        ) : <BookOpen className="w-4 h-4 text-[#7c2df7]/50" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`font-semibold text-sm text-gray-900 truncate max-w-[220px] ${locale === "bn" ? "font-bn" : ""}`}>
                            {product.title_bn || product.title}
                          </p>
                          {c.is_featured && <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />}
                        </div>
                        <p className={`text-[10px] text-gray-400 truncate ${locale === "bn" ? "font-bn" : ""}`}>
                          {c.category_name ? ((locale === "bn" ? c.category_name_bn : null) || c.category_name) : "—"}
                          {c.instructor_name && ` · ${(locale === "bn" ? c.instructor_name_bn : null) || c.instructor_name}`}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">{typeBadge(c.course_type, locale)}</td>
                  <td className="px-3 py-2.5 text-right text-sm font-bold tabular-nums text-gray-900">{c.total_lessons}</td>
                  <td className="px-3 py-2.5 text-right text-sm font-bold tabular-nums text-gray-900">{c.enrollment_count}</td>
                  <td className="px-3 py-2.5 text-right text-sm font-bold tabular-nums text-gray-900">৳{formatCompact(Math.round(c.revenue), locale)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex flex-col items-end">
                      {product.is_free ? (
                        <span className={`text-sm font-bold text-sky-600 ${locale === "bn" ? "font-bn" : ""}`}>{t("ফ্রি", "Free")}</span>
                      ) : (
                        <>
                          <span className="text-sm font-bold text-gray-900 tabular-nums">৳{product.price.toLocaleString(locale === "bn" ? "bn-BD" : "en-US")}</span>
                          {hasDiscount && <span className="text-[10px] text-gray-400 line-through tabular-nums">৳{product.compare_price!.toLocaleString(locale === "bn" ? "bn-BD" : "en-US")}</span>}
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">{statusPill(product.is_active, locale, t)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button onClick={() => onOpen(c)} title={t("মডিউল", "Modules")} className="p-1.5 rounded-lg text-[#7c2df7] hover:bg-[#f5f0ff]">
                        <BookOpen className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onEdit(c)} title={t("এডিট", "Edit")} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onToggleFeatured(c)}
                        disabled={togglingId === c.id}
                        title={c.is_featured ? t("ফিচার্ড থেকে সরান", "Unfeature") : t("ফিচার্ড করুন", "Feature")}
                        className={`p-1.5 rounded-lg disabled:opacity-50 ${c.is_featured ? "text-amber-600 hover:bg-amber-50" : "text-gray-400 hover:bg-gray-50"}`}
                      >
                        {togglingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className={`w-3.5 h-3.5 ${c.is_featured ? "fill-current" : ""}`} />}
                      </button>
                      <button
                        onClick={() => onToggleActive(c)}
                        disabled={togglingId === c.id}
                        title={product.is_active ? t("নিষ্ক্রিয় করুন", "Deactivate") : t("সক্রিয় করুন", "Activate")}
                        className={`p-1.5 rounded-lg disabled:opacity-50 ${product.is_active ? "text-emerald-600 hover:bg-emerald-50" : "text-gray-400 hover:bg-gray-50"}`}
                      >
                        {togglingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
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
        <GraduationCap className="w-6 h-6 text-[#7c2df7]" />
      </div>
      <p className={`text-base font-bold text-gray-900 ${locale === "bn" ? "font-bn" : ""}`}>
        {hasFilters ? t("কোনো কোর্স মেলেনি", "No courses match your filters") : t("এখনো কোনো কোর্স নেই", "No courses yet")}
      </p>
      <p className={`text-sm text-gray-500 mt-1 ${locale === "bn" ? "font-bn" : ""}`}>
        {hasFilters ? t("ফিল্টার পরিবর্তন করুন", "Try changing the filters") : t("শুরুতে একটি কোর্স যোগ করুন", "Get started by creating one")}
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="skeleton aspect-video rounded-none" />
          <div className="p-4 space-y-2">
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-3 w-1/2" />
            <div className="skeleton h-8 w-full mt-3" />
            <div className="skeleton h-5 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Formatters ─── */

function formatCompact(n: number, locale: string): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return n.toLocaleString(locale === "bn" ? "bn-BD" : "en-US");
}

function formatCompactCurrency(n: number, locale: string): string {
  if (n >= 1_00_000) return `৳${(n / 1_00_000).toFixed(n >= 10_00_000 ? 0 : 1)}L`;
  if (n >= 1_000) return `৳${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return `৳${Math.round(n).toLocaleString(locale === "bn" ? "bn-BD" : "en-US")}`;
}

function formatCurrency(n: number, locale: string): string {
  const rounded = Math.round(n);
  return `৳${rounded.toLocaleString(locale === "bn" ? "bn-BD" : "en-US")}`;
}
