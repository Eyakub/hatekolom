"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, Trash2, Save, X, Loader2, Clock, Target,
  Link as LinkIcon, ChevronUp, ChevronDown, Star, Calculator,
  ChevronRight, Eye,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useLocaleStore } from "@/stores/locale-store";
import { api } from "@/lib/api";

// ---- Types ----

interface TutorialStep {
  instruction: string;
  instruction_bn?: string;
  target_value: number;
  highlight_rods: number[];
}

interface LevelConfig {
  operations: string[];
  number_range: [number, number];
  num_rods: number;
  question_count: number;
  time_limit_seconds: number | null;
  flash_duration_ms: number;
  pass_percentage: number;
}

interface AbacusLevel {
  id: string;
  sort_order: number;
  title: string;
  title_bn?: string;
  description?: string;
  description_bn?: string;
  level_type: string;
  exercise_type: string;
  config: LevelConfig;
  content: { steps?: TutorialStep[] };
}

interface AbacusAttempt {
  id: string;
  level_id: string;
  level_title?: string;
  user_id: string;
  child_profile_id: string;
  child_name?: string;
  score: number;
  total_points: number;
  stars: number;
  time_seconds?: number;
  passed: boolean;
  started_at: string | null;
  completed_at: string | null;
}

// ---- Component ----

export default function AbacusEditorPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.id as string;
  const { accessToken } = useAuthStore();
  const { locale } = useLocaleStore();
  const t = (bn: string, en: string) => locale === "bn" ? bn : en;

  const [course, setCourse] = useState<any>(null);
  const [levels, setLevels] = useState<AbacusLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLevel, setExpandedLevel] = useState<string | null>(null);

  // Level edit state
  const [levelForms, setLevelForms] = useState<Record<string, any>>({});
  const [savingLevel, setSavingLevel] = useState<string | null>(null);
  const [deletingLevel, setDeletingLevel] = useState<string | null>(null);
  const [addingLevel, setAddingLevel] = useState(false);

  // Course settings
  const [pricingForm, setPricingForm] = useState({ price: "0", compare_price: "", is_free: false });
  const [pricingSaving, setPricingSaving] = useState(false);
  const [activeToggling, setActiveToggling] = useState(false);

  // Product attachments
  const [attachedProducts, setAttachedProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<any[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [attaching, setAttaching] = useState(false);

  // Attempts
  const [attempts, setAttempts] = useState<AbacusAttempt[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);

  // ---- Load course ----

  useEffect(() => {
    if (!courseId || !accessToken) return;
    loadCourse();
    loadAttempts();
  }, [courseId, accessToken]);

  const loadCourse = async () => {
    try {
      const data: any = await api.get(`/abacus/${courseId}/admin`, accessToken!);
      setCourse(data);

      const sortedLevels = (data.levels || []).sort(
        (a: AbacusLevel, b: AbacusLevel) => a.sort_order - b.sort_order
      );
      setLevels(sortedLevels);

      // Populate pricing
      setPricingForm({
        price: data.price ?? "0",
        compare_price: data.compare_price ?? "",
        is_free: data.is_free ?? false,
      });

      // Build level form states
      const forms: Record<string, any> = {};
      for (const lv of sortedLevels) {
        forms[lv.id] = buildLevelForm(lv);
      }
      setLevelForms(forms);
    } catch {
      import("@/stores/toast-store").then(m => m.toast.error(t("কোর্স লোড হয়নি", "Failed to load course")));
    }
    setLoading(false);
  };

  const loadAttempts = async () => {
    setAttemptsLoading(true);
    try {
      const data: any = await api.get(`/abacus/${courseId}/attempts`, accessToken!);
      setAttempts(data || []);
    } catch {
      // silently ignore
    }
    setAttemptsLoading(false);
  };

  const buildLevelForm = (lv: AbacusLevel) => {
    const cfg = lv.config || {} as any;
    const range = cfg.number_range || [1, 20];
    return {
      title: lv.title || "",
      title_bn: lv.title_bn || "",
      description: lv.description || "",
      description_bn: lv.description_bn || "",
      level_type: lv.level_type || "test",
      exercise_type: lv.exercise_type || "bead_slide",
      sort_order: lv.sort_order ?? 0,
      // Config fields
      operations: cfg.operations || [],
      min_number: range[0] ?? 1,
      max_number: range[1] ?? 20,
      num_rods: cfg.num_rods ?? 1,
      question_count: cfg.question_count ?? 10,
      time_limit_seconds: cfg.time_limit_seconds != null ? String(cfg.time_limit_seconds) : "",
      flash_duration_ms: cfg.flash_duration_ms ?? 3000,
      pass_percentage: cfg.pass_percentage ?? 80,
      // Tutorial content
      steps: (lv.content?.steps || []).map((s: any) => ({
        instruction: s.instruction || "",
        instruction_bn: s.instruction_bn || "",
        target_value: s.target_value ?? 0,
        highlight_rods: Array.isArray(s.highlight_rods) ? s.highlight_rods.join(",") : "",
      })),
    };
  };

  // ---- Save level ----

  const saveLevel = async (levelId: string) => {
    const form = levelForms[levelId];
    if (!form) return;
    setSavingLevel(levelId);
    try {
      const config = {
        operations: form.operations,
        number_range: [parseInt(form.min_number) || 1, parseInt(form.max_number) || 20],
        num_rods: parseInt(form.num_rods) || 1,
        question_count: parseInt(form.question_count) || 10,
        time_limit_seconds: form.time_limit_seconds ? parseInt(form.time_limit_seconds) : null,
        flash_duration_ms: parseInt(form.flash_duration_ms) || 3000,
        pass_percentage: parseInt(form.pass_percentage) || 80,
      };

      const content: any = {};
      if (form.level_type === "tutorial" && form.steps.length > 0) {
        content.steps = form.steps.map((s: any) => ({
          instruction: s.instruction,
          instruction_bn: s.instruction_bn || undefined,
          target_value: parseInt(s.target_value) || 0,
          highlight_rods: s.highlight_rods
            ? s.highlight_rods.split(",").map((r: string) => parseInt(r.trim())).filter((n: number) => !isNaN(n))
            : [],
        }));
      }

      await api.put(`/abacus/levels/${levelId}`, {
        title: form.title,
        title_bn: form.title_bn || undefined,
        description: form.description || undefined,
        description_bn: form.description_bn || undefined,
        level_type: form.level_type,
        exercise_type: form.exercise_type,
        sort_order: parseInt(form.sort_order) ?? 0,
        config,
        content,
      }, accessToken!);

      import("@/stores/toast-store").then(m => m.toast.success(t("লেভেল সেভ হয়েছে", "Level saved")));
      await loadCourse();
    } catch (err: any) {
      import("@/stores/toast-store").then(m => m.toast.error(err.message || t("ত্রুটি", "Error")));
    }
    setSavingLevel(null);
  };

  // ---- Delete level ----

  const deleteLevel = async (levelId: string) => {
    if (!confirm(t("এই লেভেল মুছে ফেলবেন?", "Delete this level?"))) return;
    setDeletingLevel(levelId);
    try {
      await api.delete(`/abacus/levels/${levelId}`, accessToken!);
      import("@/stores/toast-store").then(m => m.toast.success(t("লেভেল মুছে ফেলা হয়েছে", "Level deleted")));
      if (expandedLevel === levelId) setExpandedLevel(null);
      await loadCourse();
    } catch (err: any) {
      import("@/stores/toast-store").then(m => m.toast.error(err.message || t("ত্রুটি", "Error")));
    }
    setDeletingLevel(null);
  };

  // ---- Add level ----

  const addLevel = async () => {
    setAddingLevel(true);
    try {
      const newOrder = levels.length;
      const created: any = await api.post(`/abacus/${courseId}/levels`, {
        title: `New Level ${newOrder + 1}`,
        sort_order: newOrder,
        level_type: "test",
        exercise_type: "bead_slide",
        config: {
          operations: ["+"],
          number_range: [1, 9],
          num_rods: 1,
          question_count: 10,
          time_limit_seconds: null,
          flash_duration_ms: 3000,
          pass_percentage: 80,
        },
        content: {},
      }, accessToken!);
      import("@/stores/toast-store").then(m => m.toast.success(t("নতুন লেভেল যোগ হয়েছে", "Level added")));
      await loadCourse();
      if (created?.id) setExpandedLevel(created.id);
    } catch (err: any) {
      import("@/stores/toast-store").then(m => m.toast.error(err.message || t("ত্রুটি", "Error")));
    }
    setAddingLevel(false);
  };

  // ---- Reorder levels ----

  const moveLevel = async (index: number, direction: "up" | "down") => {
    const newLevels = [...levels];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newLevels.length) return;

    [newLevels[index], newLevels[swapIndex]] = [newLevels[swapIndex], newLevels[index]];
    const levelIds = newLevels.map(l => l.id);

    try {
      await api.put(`/abacus/${courseId}/reorder`, { level_ids: levelIds }, accessToken!);
      await loadCourse();
    } catch (err: any) {
      import("@/stores/toast-store").then(m => m.toast.error(err.message || t("ত্রুটি", "Error")));
    }
  };

  // ---- Toggle active ----

  const toggleActive = async () => {
    setActiveToggling(true);
    try {
      await api.put(`/abacus/${courseId}`, {
        is_active: !course?.is_active,
      }, accessToken!);
      import("@/stores/toast-store").then(m => m.toast.success(t("স্ট্যাটাস আপডেট হয়েছে", "Status updated")));
      await loadCourse();
    } catch (err: any) {
      import("@/stores/toast-store").then(m => m.toast.error(err.message || t("ত্রুটি", "Error")));
    }
    setActiveToggling(false);
  };

  // ---- Pricing save ----

  const savePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    setPricingSaving(true);
    try {
      await api.put(`/abacus/${courseId}`, {
        price: parseFloat(pricingForm.price) || 0,
        compare_price: pricingForm.compare_price ? parseFloat(pricingForm.compare_price) : null,
        is_free: pricingForm.is_free,
      }, accessToken!);
      import("@/stores/toast-store").then(m => m.toast.success(t("মূল্য আপডেট হয়েছে", "Pricing updated")));
      await loadCourse();
    } catch (err: any) {
      import("@/stores/toast-store").then(m => m.toast.error(err.message || t("ত্রুটি", "Error")));
    }
    setPricingSaving(false);
  };

  // ---- Product attachment ----

  const searchProducts = async () => {
    if (!productSearch.trim()) return;
    setSearchingProducts(true);
    try {
      const data: any = await api.get(`/courses/?search=${encodeURIComponent(productSearch)}`, accessToken!);
      const results = (data.items || data || []).filter((item: any) => item.product?.id !== course?.product_id);
      setProductResults(results);
    } catch {
      setProductResults([]);
    }
    setSearchingProducts(false);
  };

  const attachProduct = async (productId: string) => {
    setAttaching(true);
    try {
      await api.post(`/abacus/${courseId}/attach/${productId}`, {}, accessToken!);
      import("@/stores/toast-store").then(m => m.toast.success(t("প্রোডাক্ট সংযুক্ত হয়েছে", "Product attached")));
      setProductSearch("");
      setProductResults([]);
    } catch (err: any) {
      import("@/stores/toast-store").then(m => m.toast.error(err.message || t("ত্রুটি", "Error")));
    }
    setAttaching(false);
  };

  const detachProduct = async (productId: string) => {
    if (!confirm(t("এই প্রোডাক্ট থেকে বিচ্ছিন্ন করবে?", "Detach this product?"))) return;
    try {
      await api.delete(`/abacus/${courseId}/attach/${productId}`, accessToken!);
      import("@/stores/toast-store").then(m => m.toast.success(t("বিচ্ছিন্ন হয়েছে", "Detached")));
    } catch (err: any) {
      import("@/stores/toast-store").then(m => m.toast.error(err.message || t("ত্রুটি", "Error")));
    }
  };

  // ---- Helper: update level form field ----

  const updateLevelForm = (levelId: string, field: string, value: any) => {
    setLevelForms(prev => ({
      ...prev,
      [levelId]: { ...prev[levelId], [field]: value },
    }));
  };

  const toggleOperation = (levelId: string, op: string) => {
    setLevelForms(prev => {
      const form = prev[levelId];
      const ops = form.operations.includes(op)
        ? form.operations.filter((o: string) => o !== op)
        : [...form.operations, op];
      return { ...prev, [levelId]: { ...form, operations: ops } };
    });
  };

  // ---- Badge helpers ----

  const levelTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      tutorial: "bg-blue-50 text-blue-700",
      practice: "bg-yellow-50 text-yellow-700",
      test: "bg-purple-50 text-purple-700",
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors[type] || "bg-gray-50 text-gray-600"}`}>
        {type}
      </span>
    );
  };

  const exerciseTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      bead_slide: "bg-emerald-50 text-emerald-700",
      mental_math: "bg-orange-50 text-orange-700",
      mixed: "bg-indigo-50 text-indigo-700",
    };
    const labels: Record<string, string> = {
      bead_slide: "Bead Slide",
      mental_math: "Mental Math",
      mixed: "Mixed",
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors[type] || "bg-gray-50 text-gray-600"}`}>
        {labels[type] || type}
      </span>
    );
  };

  // ---- Loading state ----

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin?tab=abacus" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="font-bold text-gray-900 font-bn text-lg">
                {locale === "bn" ? (course?.title_bn || course?.title || "অ্যাবাকাস কোর্স") : (course?.title || course?.title_bn || "Abacus Course")}
              </h1>
              <p className="text-xs text-gray-400">
                {levels.length} {t("টি লেভেল", " levels")}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Level List & Editor (70%) */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-primary-600" />
                  <h3 className="font-semibold text-sm text-gray-900 font-bn">
                    {t("লেভেলসমূহ", "Levels")}
                  </h3>
                </div>
                <button
                  onClick={addLevel}
                  disabled={addingLevel}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary-700 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 transition-all disabled:opacity-50"
                >
                  {addingLevel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {t("লেভেল যোগ করো", "Add Level")}
                </button>
              </div>

              <div className="divide-y divide-gray-50">
                {levels.length === 0 && (
                  <div className="text-center py-12 text-gray-400 text-sm">
                    {t("কোনো লেভেল নেই", "No levels yet")}
                  </div>
                )}

                {levels.map((level, idx) => {
                  const isExpanded = expandedLevel === level.id;
                  const form = levelForms[level.id];

                  return (
                    <div key={level.id} className="group">
                      {/* Level Card Header */}
                      <div
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50/50 transition-colors ${isExpanded ? "bg-gray-50/70" : ""}`}
                        onClick={() => setExpandedLevel(isExpanded ? null : level.id)}
                      >
                        {/* Reorder buttons */}
                        <div className="flex flex-col gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveLevel(idx, "up")}
                            className="p-0.5 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-30"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === levels.length - 1}
                            onClick={() => moveLevel(idx, "down")}
                            className="p-0.5 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-30"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Sort order number */}
                        <span className="w-6 h-6 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {level.sort_order + 1}
                        </span>

                        {/* Title + badges */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate font-bn">
                            {locale === "bn" ? (level.title_bn || level.title) : level.title}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {levelTypeBadge(level.level_type)}
                            {exerciseTypeBadge(level.exercise_type)}
                          </div>
                        </div>

                        <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                      </div>

                      {/* Level Editor (expanded) */}
                      {isExpanded && form && (
                        <div className="px-4 pb-4 pt-2 bg-gray-50/30 border-t border-gray-100 space-y-4">
                          {/* Title fields */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Title (EN)</label>
                              <input
                                value={form.title}
                                onChange={(e) => updateLevelForm(level.id, "title", e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">{t("শিরোনাম (বাংলা)", "Title (BN)")}</label>
                              <input
                                value={form.title_bn}
                                onChange={(e) => updateLevelForm(level.id, "title_bn", e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn"
                              />
                            </div>
                          </div>

                          {/* Description fields */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Description (EN)</label>
                              <input
                                value={form.description}
                                onChange={(e) => updateLevelForm(level.id, "description", e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">{t("বিবরণ (বাংলা)", "Description (BN)")}</label>
                              <input
                                value={form.description_bn}
                                onChange={(e) => updateLevelForm(level.id, "description_bn", e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn"
                              />
                            </div>
                          </div>

                          {/* Type dropdowns */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">{t("লেভেল টাইপ", "Level Type")}</label>
                              <select
                                value={form.level_type}
                                onChange={(e) => updateLevelForm(level.id, "level_type", e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400"
                              >
                                <option value="tutorial">Tutorial</option>
                                <option value="practice">Practice</option>
                                <option value="test">Test</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">{t("এক্সারসাইজ টাইপ", "Exercise Type")}</label>
                              <select
                                value={form.exercise_type}
                                onChange={(e) => updateLevelForm(level.id, "exercise_type", e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400"
                              >
                                <option value="bead_slide">Bead Slide</option>
                                <option value="mental_math">Mental Math</option>
                                <option value="mixed">Mixed</option>
                              </select>
                            </div>
                          </div>

                          {/* Config Section */}
                          <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-3">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t("কনফিগ", "Config")}</h4>

                            {/* Operations */}
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t("অপারেশন", "Operations")}</label>
                              <div className="flex flex-wrap gap-2">
                                {[
                                  { op: "+", label: "+" },
                                  { op: "-", label: "-" },
                                  { op: "*", label: "x" },
                                  { op: "/", label: "/" },
                                ].map(({ op, label }) => (
                                  <label key={op} className="flex items-center gap-1.5 text-sm bg-gray-50 px-2.5 py-1.5 rounded border border-gray-200 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={form.operations.includes(op)}
                                      onChange={() => toggleOperation(level.id, op)}
                                      className="rounded"
                                    />
                                    <span className="font-semibold">{label}</span>
                                  </label>
                                ))}
                              </div>
                            </div>

                            {/* Number range + rods */}
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">{t("সর্বনিম্ন", "Min")}</label>
                                <input
                                  type="number"
                                  value={form.min_number}
                                  onChange={(e) => updateLevelForm(level.id, "min_number", e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">{t("সর্বোচ্চ", "Max")}</label>
                                <input
                                  type="number"
                                  value={form.max_number}
                                  onChange={(e) => updateLevelForm(level.id, "max_number", e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">{t("রড সংখ্যা", "Rods")} (1-13)</label>
                                <input
                                  type="number"
                                  min="1"
                                  max="13"
                                  value={form.num_rods}
                                  onChange={(e) => updateLevelForm(level.id, "num_rods", e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400"
                                />
                              </div>
                            </div>

                            {/* Question count, time limit, flash, pass % */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">{t("প্রশ্ন সংখ্যা", "Questions")}</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={form.question_count}
                                  onChange={(e) => updateLevelForm(level.id, "question_count", e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">{t("সময়সীমা (সে.)", "Time (sec)")}</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={form.time_limit_seconds}
                                  onChange={(e) => updateLevelForm(level.id, "time_limit_seconds", e.target.value)}
                                  placeholder={t("নেই", "None")}
                                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">{t("ফ্ল্যাশ (ms)", "Flash (ms)")}</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={form.flash_duration_ms}
                                  onChange={(e) => updateLevelForm(level.id, "flash_duration_ms", e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">{t("পাস %", "Pass %")}</label>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={form.pass_percentage}
                                  onChange={(e) => updateLevelForm(level.id, "pass_percentage", e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Tutorial Content Section */}
                          {form.level_type === "tutorial" && (
                            <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-3">
                              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t("টিউটোরিয়াল ধাপ", "Tutorial Steps")}</h4>

                              {form.steps.map((step: any, sIdx: number) => (
                                <div key={sIdx} className="flex items-start gap-2 p-2.5 rounded-lg border border-gray-100 bg-gray-50/30">
                                  <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-1">
                                    {sIdx + 1}
                                  </span>
                                  <div className="flex-1 space-y-2">
                                    <input
                                      value={step.instruction}
                                      onChange={(e) => {
                                        const newSteps = [...form.steps];
                                        newSteps[sIdx] = { ...newSteps[sIdx], instruction: e.target.value };
                                        updateLevelForm(level.id, "steps", newSteps);
                                      }}
                                      placeholder="Instruction (EN)"
                                      className="w-full px-2.5 py-1.5 rounded border border-gray-200 text-sm outline-none focus:border-primary-400"
                                    />
                                    <input
                                      value={step.instruction_bn || ""}
                                      onChange={(e) => {
                                        const newSteps = [...form.steps];
                                        newSteps[sIdx] = { ...newSteps[sIdx], instruction_bn: e.target.value };
                                        updateLevelForm(level.id, "steps", newSteps);
                                      }}
                                      placeholder={t("নির্দেশনা (বাংলা)", "Instruction (BN)")}
                                      className="w-full px-2.5 py-1.5 rounded border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn"
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="block text-[10px] text-gray-500 mb-0.5">{t("লক্ষ্য মান", "Target Value")}</label>
                                        <input
                                          type="number"
                                          value={step.target_value}
                                          onChange={(e) => {
                                            const newSteps = [...form.steps];
                                            newSteps[sIdx] = { ...newSteps[sIdx], target_value: e.target.value };
                                            updateLevelForm(level.id, "steps", newSteps);
                                          }}
                                          className="w-full px-2.5 py-1.5 rounded border border-gray-200 text-sm outline-none focus:border-primary-400"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] text-gray-500 mb-0.5">{t("হাইলাইট রড", "Highlight Rods")} (0,1,...)</label>
                                        <input
                                          value={step.highlight_rods}
                                          onChange={(e) => {
                                            const newSteps = [...form.steps];
                                            newSteps[sIdx] = { ...newSteps[sIdx], highlight_rods: e.target.value };
                                            updateLevelForm(level.id, "steps", newSteps);
                                          }}
                                          placeholder="0,1"
                                          className="w-full px-2.5 py-1.5 rounded border border-gray-200 text-sm outline-none focus:border-primary-400"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newSteps = form.steps.filter((_: any, i: number) => i !== sIdx);
                                      updateLevelForm(level.id, "steps", newSteps);
                                    }}
                                    className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 shrink-0"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}

                              <button
                                type="button"
                                onClick={() => {
                                  const newSteps = [...form.steps, { instruction: "", instruction_bn: "", target_value: 0, highlight_rods: "" }];
                                  updateLevelForm(level.id, "steps", newSteps);
                                }}
                                className="flex items-center gap-1.5 text-sm text-primary-600 font-semibold hover:text-primary-700 font-bn"
                              >
                                <Plus className="w-4 h-4" /> {t("ধাপ যোগ করো", "Add Step")}
                              </button>
                            </div>
                          )}

                          {/* Action buttons */}
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => saveLevel(level.id)}
                              disabled={savingLevel === level.id}
                              className="flex items-center gap-1.5 px-4 py-2 bg-primary-700 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 transition-all disabled:opacity-50"
                            >
                              {savingLevel === level.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                              {t("সেভ করো", "Save")}
                            </button>
                            <button
                              onClick={() => deleteLevel(level.id)}
                              disabled={deletingLevel === level.id}
                              className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-100 transition-all disabled:opacity-50"
                            >
                              {deletingLevel === level.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                              {t("মুছো", "Delete")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Sidebar (30%) */}
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-20 lg:self-start">

            {/* Active Status Card */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
                <Target className="w-4 h-4 text-primary-600" />
                <h3 className="font-semibold text-sm text-gray-900 font-bn">{t("কোর্স স্ট্যাটাস", "Course Status")}</h3>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700 font-bn">{t("সক্রিয়", "Active")}</span>
                  <button
                    onClick={toggleActive}
                    disabled={activeToggling}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      course?.is_active ? "bg-green-500" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        course?.is_active ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1 font-bn">
                  {course?.is_active ? t("কোর্স পাবলিক দেখাচ্ছে", "Course is publicly visible") : t("কোর্স লুকানো আছে", "Course is hidden")}
                </p>
              </div>
            </div>

            {/* Pricing Card */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-green-600" />
                <h3 className="font-semibold text-sm text-gray-900 font-bn">{t("মূল্য নির্ধারণ", "Pricing")}</h3>
              </div>
              <form onSubmit={savePricing} className="p-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">{t("মূল্য", "Price")} ({t("৳", "৳")})</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={pricingForm.price}
                    onChange={e => setPricingForm(p => ({ ...p, price: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">{t("তুলনামূলক মূল্য", "Compare Price")} ({t("৳", "৳")})</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={pricingForm.compare_price}
                    onChange={e => setPricingForm(p => ({ ...p, compare_price: e.target.value }))}
                    placeholder={t("অপশনাল", "Optional")}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400"
                  />
                </div>
                <div className="flex items-center pt-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={pricingForm.is_free}
                      onChange={e => setPricingForm(p => ({ ...p, is_free: e.target.checked }))}
                      className="rounded"
                    />
                    <span className="font-bn font-semibold">{t("ফ্রি কোর্স", "Free Course")}</span>
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={pricingSaving}
                  className="w-full py-2 bg-primary-700 text-white font-semibold rounded-xl hover:bg-primary-800 transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {pricingSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {t("সেভ করো", "Save")}
                </button>
              </form>
            </div>

            {/* Product Attachments Card */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-blue-600" />
                <h3 className="font-semibold text-sm text-gray-900 font-bn">{t("প্রোডাক্ট সংযুক্তি", "Product Attachments")}</h3>
              </div>
              <div className="p-4 space-y-3">
                {/* Search */}
                <div className="flex gap-2">
                  <input
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && searchProducts()}
                    placeholder={t("প্রোডাক্ট খুঁজুন...", "Search products...")}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn"
                  />
                  <button
                    onClick={searchProducts}
                    disabled={searchingProducts}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    {searchingProducts ? <Loader2 className="w-4 h-4 animate-spin" /> : t("খুঁজো", "Search")}
                  </button>
                </div>

                {/* Search results */}
                {productResults.length > 0 && (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {productResults.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                        <span className="text-xs text-gray-800 font-bn truncate flex-1 mr-2">
                          {item.product?.title || item.title}
                        </span>
                        <button
                          onClick={() => attachProduct(item.product?.id || item.id)}
                          disabled={attaching}
                          className="px-2 py-1 bg-green-600 text-white rounded text-[10px] font-bold hover:bg-green-700 shrink-0 disabled:opacity-50"
                        >
                          {t("সংযুক্ত", "Attach")}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {productResults.length === 0 && (
                  <p className="text-xs text-gray-400 font-bn text-center py-2">
                    {t("প্রোডাক্ট খুঁজে সংযুক্ত করুন", "Search and attach products")}
                  </p>
                )}
              </div>
            </div>

            {/* Recent Attempts Card */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
                <Star className="w-4 h-4 text-purple-600" />
                <h3 className="font-semibold text-sm text-gray-900 font-bn">{t("সাম্প্রতিক চেষ্টা", "Recent Attempts")}</h3>
              </div>
              <div className="p-4">
                {attemptsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                ) : attempts.length === 0 ? (
                  <p className="text-xs text-gray-400 font-bn text-center py-4">{t("এখনো কেউ চেষ্টা করেনি", "No attempts yet")}</p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {attempts.slice(0, 20).map(a => (
                      <div key={a.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-700 font-bn truncate">
                            {a.child_name || a.child_profile_id.substring(0, 8) + "..."}
                          </p>
                          {a.level_title && (
                            <p className="text-[10px] text-gray-500 font-bn truncate">{a.level_title}</p>
                          )}
                          <p className="text-[10px] text-gray-400">
                            {t("স্কোর", "Score")}: {a.score}/{a.total_points}
                            {a.time_seconds != null && (
                              <span className="ml-2">{a.time_seconds}s</span>
                            )}
                            <span className={`ml-2 font-semibold ${a.passed ? "text-green-600" : "text-red-500"}`}>
                              {a.passed ? t("পাস", "Pass") : t("ফেল", "Fail")}
                            </span>
                          </p>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <span className="text-sm">
                            {Array.from({ length: a.stars || 0 }).map((_, i) => (
                              <span key={i} className="text-yellow-400">&#9733;</span>
                            ))}
                          </span>
                          {a.completed_at && (
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {new Date(a.completed_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Preview Buttons Card */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
                <Eye className="w-4 h-4 text-indigo-600" />
                <h3 className="font-semibold text-sm text-gray-900 font-bn">{t("প্রিভিউ", "Preview")}</h3>
              </div>
              <div className="p-4 space-y-1.5 max-h-60 overflow-y-auto">
                {levels.length === 0 ? (
                  <p className="text-xs text-gray-400 font-bn text-center py-2">{t("কোনো লেভেল নেই", "No levels")}</p>
                ) : (
                  levels.map((lv) => (
                    <button
                      key={lv.id}
                      onClick={() => window.open(`/abacus/${course?.slug}/level/${lv.id}?preview=true`, "_blank")}
                      className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-left hover:bg-gray-100 transition-colors"
                    >
                      <span className="text-xs text-gray-700 font-bn truncate flex-1">
                        {lv.sort_order + 1}. {locale === "bn" ? (lv.title_bn || lv.title) : lv.title}
                      </span>
                      <Eye className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-2" />
                    </button>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </main>
    </>
  );
}
