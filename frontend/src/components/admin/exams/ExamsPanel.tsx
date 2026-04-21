"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Search, GraduationCap, Users as UsersIcon, Wallet, Edit3, Eye, Trash2,
  Grid3x3, Rows3, Loader2, ArrowUpDown, Power, Clock, CalendarClock, HelpCircle,
  ListChecks, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { useLocaleStore } from "@/stores/locale-store";
import { api } from "@/lib/api";
import { toast } from "@/stores/toast-store";
import { ConfirmModal } from "../ConfirmModal";

type AdminExam = {
  id: string;
  product_id: string;
  title: string;
  title_bn?: string | null;
  slug: string;
  thumbnail_url?: string | null;
  price: number;
  compare_price?: number | null;
  is_free: boolean;
  is_active: boolean;
  exam_type: string;
  pass_percentage: number;
  max_attempts?: number | null;
  time_limit_seconds?: number | null;
  total_sections: number;
  total_questions: number;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  attempt_count: number;
  revenue: number;
  created_at?: string | null;
};

type Stats = {
  total: number;
  active: number;
  inactive: number;
  anytime: number;
  scheduled: number;
  free: number;
  paid: number;
  empty: number;
  ready: number;
  total_attempts: number;
  total_revenue: number;
};

type StatusFilter = "" | "active" | "inactive" | "free" | "paid" | "empty" | "ready";
type TypeFilter = "" | "anytime" | "scheduled";
type SortOption = "newest" | "oldest" | "price_asc" | "price_desc" | "name_asc" | "attempts_desc" | "questions_desc";
type ViewMode = "grid" | "table";

export function ExamsPanel({
  accessToken,
  refreshKey,
  onCreate,
}: {
  accessToken: string;
  refreshKey: number;
  onCreate: () => void;
}) {
  const { locale, t } = useLocaleStore();
  const router = useRouter();

  const [items, setItems] = useState<AdminExam[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [view, setView] = useState<ViewMode>("grid");

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ exam: AdminExam; action: "activate" | "deactivate" | "delete" } | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (typeFilter) params.set("exam_type", typeFilter);
      if (statusFilter) params.set("status", statusFilter);
      params.set("sort", sort);
      const data: any = await api.get(`/exams/admin?${params.toString()}`, accessToken);
      setItems(Array.isArray(data?.items) ? data.items : []);
      setStats(data?.stats || null);
    } catch (err: any) {
      toast.error(err?.message || t("পরীক্ষা লোড ব্যর্থ", "Failed to load exams"));
    } finally {
      setLoading(false);
    }
  }, [accessToken, debouncedSearch, typeFilter, statusFilter, sort, t]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const requestToggle = (e: AdminExam) =>
    setPending({ exam: e, action: e.is_active ? "deactivate" : "activate" });
  const requestDelete = (e: AdminExam) =>
    setPending({ exam: e, action: "delete" });

  const executePending = async () => {
    if (!pending) return;
    const { exam: e, action } = pending;
    setTogglingId(e.id);
    try {
      if (action === "delete") {
        await api.delete(`/exams/${e.id}`, accessToken);
        toast.success(t("পরীক্ষা ডিলিট হয়েছে", "Exam deleted"));
        setItems((prev) => prev.filter((x) => x.id !== e.id));
      } else {
        const next = action === "activate";
        await api.patch(`/exams/${e.id}`, { is_active: next }, accessToken);
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

  const activeFilters = [debouncedSearch, typeFilter, statusFilter].filter(Boolean).length;

  return (
    <div>
      <Header onCreate={onCreate} locale={locale} t={t} />
      <StatsStrip stats={stats} loading={loading && !stats} locale={locale} t={t} onQuickFilter={setStatusFilter} activeFilter={statusFilter} />
      <Toolbar
        search={search} setSearch={setSearch}
        typeFilter={typeFilter} setTypeFilter={setTypeFilter}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        sort={sort} setSort={setSort}
        view={view} setView={setView}
        activeFiltersCount={activeFilters}
        onClear={() => { setSearch(""); setTypeFilter(""); setStatusFilter(""); }}
        locale={locale} t={t}
      />

      {loading && items.length === 0 ? (
        <GridSkeleton view={view} />
      ) : items.length === 0 ? (
        <EmptyState hasFilters={activeFilters > 0} locale={locale} t={t} />
      ) : view === "grid" ? (
        <Grid
          items={items}
          onOpen={(e) => router.push(`/admin/exams/${e.id}`)}
          onToggle={requestToggle}
          onDelete={requestDelete}
          togglingId={togglingId}
          locale={locale}
          t={t}
        />
      ) : (
        <Table
          items={items}
          onOpen={(e) => router.push(`/admin/exams/${e.id}`)}
          onToggle={requestToggle}
          onDelete={requestDelete}
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
          <GraduationCap className="w-3.5 h-3.5" />
          <span className={locale === "bn" ? "font-bn" : ""}>{t("পরীক্ষা ম্যানেজমেন্ট", "Exam Management")}</span>
        </div>
        <h1 className={`text-xl md:text-2xl font-bold text-gray-900 ${locale === "bn" ? "font-bn" : ""}`}>
          {t("পরীক্ষা", "Exams")}
        </h1>
      </div>
      <button
        onClick={onCreate}
        className={`inline-flex items-center gap-2 px-4 py-2 bg-[#7c2df7] text-white text-sm font-semibold rounded-xl hover:bg-[#6b1ee3] shadow-sm ${locale === "bn" ? "font-bn" : ""}`}
      >
        <Plus className="w-4 h-4" /> {t("নতুন পরীক্ষা", "New exam")}
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
    { key: "" as StatusFilter,       label: t("মোট পরীক্ষা", "Total exams"),           value: stats?.total ?? 0,                                         icon: GraduationCap,  iconBg: "bg-[#f5f0ff]",  iconFg: "text-[#7c2df7]",   clickable: false },
    { key: "active" as StatusFilter, label: t("অ্যাক্টিভ", "Active"),                   value: stats?.active ?? 0,                                        icon: Power,          iconBg: "bg-emerald-50", iconFg: "text-emerald-600", clickable: true },
    { key: "ready" as StatusFilter,  label: t("প্রশ্ন আছে", "With questions"),          value: stats?.ready ?? 0,                                         icon: ListChecks,     iconBg: "bg-sky-50",     iconFg: "text-sky-600",     clickable: true },
    { key: "empty" as StatusFilter,  label: t("খালি পরীক্ষা", "Empty exams"),          value: stats?.empty ?? 0,                                         icon: AlertTriangle,  iconBg: "bg-amber-50",   iconFg: "text-amber-600",   clickable: true },
    { key: "__attempts",             label: t("মোট অ্যাটেম্পট", "Total attempts"),     value: formatCompact(stats?.total_attempts ?? 0, locale),          icon: UsersIcon,      iconBg: "bg-indigo-50",  iconFg: "text-indigo-600",  clickable: false },
    { key: "__revenue",              label: t("মোট রেভেনিউ", "Total revenue"),         value: stats ? formatCurrency(stats.total_revenue, locale) : "—", icon: Wallet,         iconBg: "bg-[#fff8e1]",  iconFg: "text-[#b77800]",   clickable: false },
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
  search, setSearch, typeFilter, setTypeFilter, statusFilter, setStatusFilter,
  sort, setSort, view, setView, activeFiltersCount, onClear, locale, t,
}: {
  search: string; setSearch: (v: string) => void;
  typeFilter: TypeFilter; setTypeFilter: (v: TypeFilter) => void;
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
            placeholder={t("পরীক্ষা নাম খুঁজুন...", "Search exams...")}
            className={`w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 outline-none focus:border-[#7c2df7]/50 ${locale === "bn" ? "font-bn" : ""}`}
          />
        </div>

        <div className="relative">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            className={`${selectClass} ${locale === "bn" ? "font-bn" : ""}`}
          >
            <option value="">{t("সব ধরন", "All types")}</option>
            <option value="anytime">{t("যেকোনো সময়", "Anytime")}</option>
            <option value="scheduled">{t("নির্ধারিত", "Scheduled")}</option>
          </select>
          <Clock className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
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
            <option value="ready">{t("প্রশ্ন আছে", "With questions")}</option>
            <option value="empty">{t("খালি", "Empty")}</option>
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
          >
            <option value="newest">{t("নতুন আগে", "Newest first")}</option>
            <option value="oldest">{t("পুরাতন আগে", "Oldest first")}</option>
            <option value="attempts_desc">{t("সর্বাধিক অ্যাটেম্পট", "Most attempts")}</option>
            <option value="questions_desc">{t("সর্বাধিক প্রশ্ন", "Most questions")}</option>
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
          >
            <Grid3x3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView("table")}
            className={`p-1.5 rounded-lg transition-colors ${view === "table" ? "bg-white shadow-sm text-[#7c2df7]" : "text-gray-500 hover:text-gray-800"}`}
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

/* ─── Badges ─── */

function typeBadge(type: string, locale: string) {
  const map: Record<string, { bg: string; fg: string; bn: string; en: string; icon: React.ComponentType<{ className?: string }> }> = {
    anytime:   { bg: "bg-violet-50", fg: "text-violet-700", bn: "যেকোনো সময়", en: "Anytime",   icon: Clock },
    scheduled: { bg: "bg-rose-50",   fg: "text-rose-700",   bn: "নির্ধারিত",    en: "Scheduled", icon: CalendarClock },
  };
  const info = map[type] || map.anytime;
  const Icon = info.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full ${info.bg} ${info.fg} ${locale === "bn" ? "font-bn" : ""}`}>
      <Icon className="w-2.5 h-2.5" />
      {locale === "bn" ? info.bn : info.en}
    </span>
  );
}

function readyBadge(totalQuestions: number, locale: string, t: (bn: string, en: string) => string) {
  if (totalQuestions === 0) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-800 ${locale === "bn" ? "font-bn" : ""}`}>
        <AlertTriangle className="w-2.5 h-2.5" /> {t("খালি", "Empty")}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 ${locale === "bn" ? "font-bn" : ""}`}>
      <CheckCircle2 className="w-2.5 h-2.5" /> {t("প্রস্তুত", "Ready")}
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

/* ─── Grid / Card ─── */

function Grid({
  items, onOpen, onToggle, onDelete, togglingId, locale, t,
}: {
  items: AdminExam[];
  onOpen: (e: AdminExam) => void;
  onToggle: (e: AdminExam) => void;
  onDelete: (e: AdminExam) => void;
  togglingId: string | null;
  locale: string;
  t: (bn: string, en: string) => string;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((e) => (
        <ExamCard
          key={e.id}
          exam={e}
          toggling={togglingId === e.id}
          onOpen={() => onOpen(e)}
          onToggle={() => onToggle(e)}
          onDelete={() => onDelete(e)}
          locale={locale}
          t={t}
        />
      ))}
    </div>
  );
}

function ExamCard({
  exam, toggling, onOpen, onToggle, onDelete, locale, t,
}: {
  exam: AdminExam;
  toggling: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onDelete: () => void;
  locale: string;
  t: (bn: string, en: string) => string;
}) {
  const hasDiscount = exam.compare_price && exam.compare_price > exam.price;
  const minutes = exam.time_limit_seconds ? Math.round(exam.time_limit_seconds / 60) : null;

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-[#7c2df7]/20 transition-all ${!exam.is_active ? "opacity-75" : ""}`}>
      <div className="relative aspect-video bg-gradient-to-br from-[#f5f0ff] to-[#ede5ff]">
        {exam.thumbnail_url ? (
          <img src={exam.thumbnail_url} alt={exam.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><GraduationCap className="w-10 h-10 text-[#7c2df7]/30" /></div>
        )}
        <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap">
          {typeBadge(exam.exam_type, locale)}
          {exam.is_free && (
            <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full bg-sky-500 text-white ${locale === "bn" ? "font-bn" : ""}`}>
              {t("ফ্রি", "FREE")}
            </span>
          )}
        </div>
        <div className="absolute top-2 right-2">
          {readyBadge(exam.total_questions, locale, t)}
        </div>
      </div>

      <div className="p-4">
        <h3 className={`font-bold text-sm text-gray-900 line-clamp-2 leading-snug min-h-[2.4em] ${locale === "bn" ? "font-bn" : ""}`}>
          {exam.title_bn || exam.title}
        </h3>

        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100">
          <Metric icon={ListChecks} value={exam.total_sections} label={t("সেকশন", "Sections")} locale={locale} />
          <Metric icon={HelpCircle} value={exam.total_questions} label={t("প্রশ্ন", "Questions")} locale={locale} />
          <Metric icon={UsersIcon} value={formatCompact(exam.attempt_count, locale)} label={t("অ্যাটেম্পট", "Attempts")} locale={locale} />
        </div>

        <div className={`flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100 text-[10px] ${locale === "bn" ? "font-bn" : ""}`}>
          <span className="text-gray-500">
            {t("পাস", "Pass")}: <span className="font-bold text-gray-900">{exam.pass_percentage}%</span>
          </span>
          {minutes && (
            <span className="text-gray-500 inline-flex items-center gap-1">
              <Clock className="w-3 h-3" /> <span className="font-bold text-gray-900">{minutes}m</span>
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-baseline gap-2">
            {exam.is_free ? (
              <span className={`text-base font-bold text-sky-600 ${locale === "bn" ? "font-bn" : ""}`}>{t("ফ্রি", "Free")}</span>
            ) : (
              <>
                <span className="text-base font-bold text-[#7c2df7] tabular-nums">৳{exam.price.toLocaleString(locale === "bn" ? "bn-BD" : "en-US")}</span>
                {hasDiscount && (
                  <span className="text-xs text-gray-400 line-through tabular-nums">
                    ৳{exam.compare_price!.toLocaleString(locale === "bn" ? "bn-BD" : "en-US")}
                  </span>
                )}
              </>
            )}
          </div>
          {statusPill(exam.is_active, locale, t)}
        </div>

        <div className="flex gap-1.5 mt-3">
          <button
            onClick={onOpen}
            className={`flex-1 py-1.5 text-xs font-semibold text-[#7c2df7] bg-[#f5f0ff] rounded-lg hover:bg-[#ede5ff] inline-flex items-center justify-center gap-1 ${locale === "bn" ? "font-bn" : ""}`}
          >
            <Eye className="w-3 h-3" /> {t("ম্যানেজ", "Manage")}
          </button>
          <button
            onClick={onToggle}
            disabled={toggling}
            title={exam.is_active ? t("নিষ্ক্রিয় করুন", "Deactivate") : t("সক্রিয় করুন", "Activate")}
            className={`py-1.5 px-2.5 text-xs font-semibold rounded-lg disabled:opacity-50 ${exam.is_active ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
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

/* ─── Table ─── */

function Table({
  items, onOpen, onToggle, onDelete, togglingId, locale, t,
}: {
  items: AdminExam[];
  onOpen: (e: AdminExam) => void;
  onToggle: (e: AdminExam) => void;
  onDelete: (e: AdminExam) => void;
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
              <th className="px-4 py-3">{t("পরীক্ষা", "Exam")}</th>
              <th className="px-3 py-3">{t("ধরন", "Type")}</th>
              <th className="px-3 py-3 text-right">{t("প্রশ্ন", "Questions")}</th>
              <th className="px-3 py-3 text-right">{t("অ্যাটেম্পট", "Attempts")}</th>
              <th className="px-3 py-3 text-right">{t("পাস %", "Pass %")}</th>
              <th className="px-3 py-3 text-right">{t("দাম", "Price")}</th>
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
                      <div className="w-12 h-10 rounded-lg bg-[#f5f0ff] overflow-hidden shrink-0 flex items-center justify-center">
                        {e.thumbnail_url ? <img src={e.thumbnail_url} alt="" className="w-full h-full object-cover" /> : <GraduationCap className="w-4 h-4 text-[#7c2df7]/50" />}
                      </div>
                      <div className="min-w-0">
                        <p className={`font-semibold text-sm text-gray-900 truncate max-w-[240px] ${locale === "bn" ? "font-bn" : ""}`}>
                          {e.title_bn || e.title}
                        </p>
                        <div className="mt-0.5">{readyBadge(e.total_questions, locale, t)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">{typeBadge(e.exam_type, locale)}</td>
                  <td className="px-3 py-2.5 text-right text-sm font-bold tabular-nums text-gray-900">{e.total_questions}</td>
                  <td className="px-3 py-2.5 text-right text-sm font-bold tabular-nums text-gray-900">{e.attempt_count}</td>
                  <td className="px-3 py-2.5 text-right text-sm font-bold tabular-nums text-gray-900">{e.pass_percentage}%</td>
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
                  <td className="px-3 py-2.5">{statusPill(e.is_active, locale, t)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button onClick={() => onOpen(e)} title={t("ম্যানেজ", "Manage")} className="p-1.5 rounded-lg text-[#7c2df7] hover:bg-[#f5f0ff]">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onToggle(e)}
                        disabled={togglingId === e.id}
                        title={e.is_active ? t("নিষ্ক্রিয় করুন", "Deactivate") : t("সক্রিয় করুন", "Activate")}
                        className={`p-1.5 rounded-lg disabled:opacity-50 ${e.is_active ? "text-emerald-600 hover:bg-emerald-50" : "text-gray-400 hover:bg-gray-50"}`}
                      >
                        {togglingId === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => onDelete(e)}
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

/* ─── Empty/Skeleton ─── */

function EmptyState({ hasFilters, locale, t }: { hasFilters: boolean; locale: string; t: (bn: string, en: string) => string }) {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
      <div className="w-14 h-14 mx-auto rounded-full bg-[#f5f0ff] flex items-center justify-center mb-3">
        <GraduationCap className="w-6 h-6 text-[#7c2df7]" />
      </div>
      <p className={`text-base font-bold text-gray-900 ${locale === "bn" ? "font-bn" : ""}`}>
        {hasFilters ? t("কোনো পরীক্ষা মেলেনি", "No exams match your filters") : t("এখনো কোনো পরীক্ষা নেই", "No exams yet")}
      </p>
      <p className={`text-sm text-gray-500 mt-1 ${locale === "bn" ? "font-bn" : ""}`}>
        {hasFilters ? t("ফিল্টার পরিবর্তন করুন", "Try changing the filters") : t("শুরুতে একটি পরীক্ষা তৈরি করুন", "Get started by creating one")}
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
            <div className="skeleton h-8 w-full" />
            <div className="skeleton h-5 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Confirm modal copy ─── */

function pendingTitle(p: { exam: AdminExam; action: "activate" | "deactivate" | "delete" } | null, t: (bn: string, en: string) => string): string {
  if (!p) return "";
  switch (p.action) {
    case "activate":   return t("পরীক্ষা সক্রিয় করবেন?", "Activate this exam?");
    case "deactivate": return t("পরীক্ষা নিষ্ক্রিয় করবেন?", "Deactivate this exam?");
    case "delete":     return t("পরীক্ষা ডিলিট করবেন?", "Delete this exam?");
  }
}

function pendingBody(p: { exam: AdminExam; action: "activate" | "deactivate" | "delete" } | null, t: (bn: string, en: string) => string): string {
  if (!p) return "";
  const name = p.exam.title_bn || p.exam.title;
  switch (p.action) {
    case "activate":   return t(`"${name}" শিক্ষার্থীদের জন্য দৃশ্যমান হবে।`, `"${name}" will become available to learners.`);
    case "deactivate": return t(`"${name}" সাইট থেকে লুকানো হবে। বিদ্যমান অ্যাটেম্পট প্রভাবিত হবে না।`, `"${name}" will be hidden from the site. Existing attempts are unaffected.`);
    case "delete":     return t(
      `"${name}" ও এর সব প্রশ্ন/সেকশন স্থায়ীভাবে মুছে যাবে। ${p.exam.attempt_count > 0 ? `${p.exam.attempt_count}টি অ্যাটেম্পটের রেকর্ডও চলে যেতে পারে।` : ""}`,
      `"${name}" and all its sections / questions will be permanently removed. ${p.exam.attempt_count > 0 ? `${p.exam.attempt_count} attempt records may also be lost.` : ""}`
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
