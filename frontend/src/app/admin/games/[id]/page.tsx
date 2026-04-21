"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, Plus, Trash2, Save, X, Loader2, Gamepad2, Clock, Target,
  Link as LinkIcon, ChevronUp, ChevronDown, Image as ImageIcon, Star,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useLocaleStore } from "@/stores/locale-store";
import { api } from "@/lib/api";

// ---- Types ----

interface MemoryPair {
  image_url: string;
  label: string;
  label_bn?: string;
}

interface MemoryConfig {
  grid: string;
  pairs: MemoryPair[];
}

interface DragDropItem {
  image_url?: string;
  content: string;
  content_bn?: string;
}

interface DragDropTarget {
  image_url?: string;
  label: string;
  label_bn?: string;
  accepted_items: number[];
}

interface DragDropConfig {
  items: DragDropItem[];
  targets: DragDropTarget[];
}

interface CrosswordWord {
  word: string;
  word_bn?: string;
  clue: string;
  clue_bn?: string;
}

interface CrosswordConfig {
  words: CrosswordWord[];
}

interface FindWordsConfig {
  words: { word: string; word_bn?: string }[];
  grid_size: number;
}

interface ImageSequenceStep {
  image_url: string;
  label: string;
  label_bn?: string;
  sort_order: number;
}

interface ImageSequenceConfig {
  reference_image_url?: string;
  steps: ImageSequenceStep[];
}

interface ArithmeticConfig {
  operations: string[];
  min_number: number;
  max_number: number;
  question_count: number;
}

interface GameAttempt {
  id: string;
  user_id: string;
  child_profile_id: string;
  child_name?: string;
  child_name_bn?: string;
  guardian_name?: string;
  stars: number;
  score: number;
  time_seconds?: number;
  completed_at: string | null;
}

// ---- Grid helpers ----

const GRID_OPTIONS = ["2x2", "2x3", "3x4", "4x4"];

function gridPairsRequired(grid: string): number {
  const [r, c] = grid.split("x").map(Number);
  return (r * c) / 2;
}

// ---- Component ----

export default function GameEditorPage() {
  const params = useParams();
  const gameId = params?.id as string;
  const { accessToken } = useAuthStore();
  const { locale } = useLocaleStore();
  const t = (bn: string, en: string) => locale === "bn" ? bn : en;

  const [game, setGame] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Config state per game type
  const [memoryConfig, setMemoryConfig] = useState<MemoryConfig>({ grid: "3x4", pairs: [] });
  const [dragDropConfig, setDragDropConfig] = useState<DragDropConfig>({ items: [], targets: [] });
  const [crosswordConfig, setCrosswordConfig] = useState<CrosswordConfig>({ words: [] });
  const [findWordsConfig, setFindWordsConfig] = useState<FindWordsConfig>({ words: [], grid_size: 10 });
  const [imageSeqConfig, setImageSeqConfig] = useState<ImageSequenceConfig>({ steps: [] });
  const [arithmeticConfig, setArithmeticConfig] = useState<ArithmeticConfig>({
    operations: ["+"],
    min_number: 1,
    max_number: 20,
    question_count: 10,
  });
  const [configSaving, setConfigSaving] = useState(false);

  // Settings form
  const [settingsForm, setSettingsForm] = useState({
    difficulty: "easy",
    time_limit_seconds: "",
  });
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Background image
  const [bgUploading, setBgUploading] = useState(false);
  const [bgSaving, setBgSaving] = useState(false);

  // Pricing form
  const [pricingForm, setPricingForm] = useState({
    price: "0",
    compare_price: "",
    is_free: false,
  });
  const [pricingSaving, setPricingSaving] = useState(false);

  // Product attachments
  const [attachedProducts, setAttachedProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<any[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [attaching, setAttaching] = useState(false);

  // Attempts
  const [attempts, setAttempts] = useState<GameAttempt[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);

  // Image upload tracking
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);

  // ---- Image upload helper ----

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "game-images");
      const res: any = await api.postFormData("/uploads/image", fd, accessToken!);
      return res.url;
    } catch {
      const { toast } = await import("@/stores/toast-store");
      toast.error(t("ছবি আপলোড ব্যর্থ", "Image upload failed"));
      return null;
    }
  };

  // ---- Load game ----

  useEffect(() => {
    if (!gameId || !accessToken) return;
    loadGame();
    loadAttempts();
  }, [gameId, accessToken]);

  const loadGame = async () => {
    try {
      const data: any = await api.get(`/games/${gameId}/admin`, accessToken!);
      setGame(data);

      // Populate settings form
      setSettingsForm({
        difficulty: data.difficulty || "easy",
        time_limit_seconds: data.time_limit_seconds != null ? String(data.time_limit_seconds) : "",
      });

      // Populate pricing form
      setPricingForm({
        price: data.price ?? "0",
        compare_price: data.compare_price ?? "",
        is_free: data.is_free ?? false,
      });

      // Populate config based on game type
      const cfg = data.config || {};
      switch (data.game_type) {
        case "memory":
          setMemoryConfig({
            grid: cfg.grid || "3x4",
            pairs: cfg.pairs || [],
          });
          break;
        case "drag_drop": {
          const loadedItems = (cfg.items || []).map((item: any) => ({
            content: item.content || "",
            content_bn: item.content_bn || "",
            image_url: item.image_url || "",
          }));
          const itemIdToIndex: Record<string, number> = {};
          (cfg.items || []).forEach((item: any, i: number) => { itemIdToIndex[item.id] = i; });
          setDragDropConfig({
            items: loadedItems,
            targets: (cfg.targets || []).map((t: any) => ({
              label: t.label || "",
              label_bn: t.label_bn || "",
              image_url: t.image_url || "",
              accepted_items: (t.correct_item_ids || []).map((id: string) => itemIdToIndex[id] ?? 0),
            })),
          });
          break;
        }
        case "crossword":
          setCrosswordConfig({ words: cfg.words || [] });
          break;
        case "find_words":
          setFindWordsConfig({
            words: cfg.words || [],
            grid_size: cfg.grid_size || 10,
          });
          break;
        case "image_sequence":
          setImageSeqConfig({
            reference_image_url: cfg.reference_image_url || "",
            steps: cfg.steps || [],
          });
          break;
        case "arithmetic": {
          const range = cfg.number_range || [1, 20];
          setArithmeticConfig({
            operations: cfg.operations || ["+"],
            min_number: range[0] ?? 1,
            max_number: range[1] ?? 20,
            question_count: cfg.question_count ?? 10,
          });
          break;
        }
      }
    } catch {
      import("@/stores/toast-store").then(m => m.toast.error(t("গেম লোড হয়নি", "Failed to load game")));
    }
    setLoading(false);
  };

  const loadAttempts = async () => {
    setAttemptsLoading(true);
    try {
      const data: any = await api.get(`/games/${gameId}/attempts`, accessToken!);
      setAttempts(data || []);
    } catch {
      // silently ignore
    }
    setAttemptsLoading(false);
  };

  // ---- Save config ----

  const getConfigPayload = () => {
    switch (game?.game_type) {
      case "memory":
        return {
          grid: memoryConfig.grid,
          pairs: memoryConfig.pairs.map(p => ({
            image_url: p.image_url,
            label: p.label,
            ...(p.label_bn ? { label_bn: p.label_bn } : {}),
          })),
        };
      case "drag_drop":
        return {
          items: dragDropConfig.items.map((item, i) => ({
            id: `item${i}`,
            content: item.content,
            ...(item.content_bn ? { content_bn: item.content_bn } : {}),
            ...(item.image_url ? { image_url: item.image_url } : {}),
          })),
          targets: dragDropConfig.targets.map((target, ti) => ({
            id: `target${ti}`,
            label: target.label,
            ...(target.label_bn ? { label_bn: target.label_bn } : {}),
            ...(target.image_url ? { image_url: target.image_url } : {}),
            correct_item_ids: target.accepted_items.map(idx => `item${idx}`),
          })),
        };
      case "crossword":
        return {
          words: crosswordConfig.words.map(w => ({
            word: w.word,
            clue: w.clue,
            ...(w.word_bn ? { word_bn: w.word_bn } : {}),
            ...(w.clue_bn ? { clue_bn: w.clue_bn } : {}),
          })),
        };
      case "find_words":
        return {
          words: findWordsConfig.words.map(w => ({
            word: w.word,
            ...(w.word_bn ? { word_bn: w.word_bn } : {}),
          })),
          grid_size: findWordsConfig.grid_size,
        };
      case "image_sequence":
        return {
          ...(imageSeqConfig.reference_image_url ? { reference_image_url: imageSeqConfig.reference_image_url } : {}),
          steps: imageSeqConfig.steps.map((s, i) => ({
            image_url: s.image_url,
            label: s.label,
            ...(s.label_bn ? { label_bn: s.label_bn } : {}),
            sort_order: i,
          })),
        };
      case "arithmetic":
        return {
          operations: arithmeticConfig.operations,
          number_range: [arithmeticConfig.min_number, arithmeticConfig.max_number],
          question_count: arithmeticConfig.question_count,
        };
      default:
        return {};
    }
  };

  const saveConfig = async () => {
    setConfigSaving(true);
    try {
      await api.put(`/games/${gameId}/config`, { config: getConfigPayload() }, accessToken!);
      import("@/stores/toast-store").then(m => m.toast.success(t("কনটেন্ট সেভ হয়েছে", "Content saved")));
      await loadGame();
    } catch (err: any) {
      import("@/stores/toast-store").then(m => m.toast.error(err.message || t("ত্রুটি", "Error")));
    }
    setConfigSaving(false);
  };

  // ---- Settings save ----

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaving(true);
    try {
      await api.put(`/games/${gameId}`, {
        difficulty: settingsForm.difficulty,
        time_limit_seconds: settingsForm.time_limit_seconds ? parseInt(settingsForm.time_limit_seconds) : null,
      }, accessToken!);
      import("@/stores/toast-store").then(m => m.toast.success(t("সেটিংস আপডেট হয়েছে", "Settings updated")));
      await loadGame();
    } catch (err: any) {
      import("@/stores/toast-store").then(m => m.toast.error(err.message || t("ত্রুটি", "Error")));
    }
    setSettingsSaving(false);
  };

  // ---- Background image ----

  const uploadBackground = async (file: File) => {
    setBgUploading(true);
    const url = await uploadImage(file);
    if (url) {
      setBgSaving(true);
      try {
        await api.put(`/games/${gameId}`, { background_image_url: url }, accessToken!);
        import("@/stores/toast-store").then(m => m.toast.success(t("ব্যাকগ্রাউন্ড আপডেট হয়েছে", "Background updated")));
        await loadGame();
      } catch (err: any) {
        import("@/stores/toast-store").then(m => m.toast.error(err.message || t("ত্রুটি", "Error")));
      }
      setBgSaving(false);
    }
    setBgUploading(false);
  };

  const resetBackground = async () => {
    setBgSaving(true);
    try {
      await api.put(`/games/${gameId}`, { background_image_url: null }, accessToken!);
      import("@/stores/toast-store").then(m => m.toast.success(t("ডিফল্ট ব্যাকগ্রাউন্ড সেট হয়েছে", "Default background set")));
      await loadGame();
    } catch (err: any) {
      import("@/stores/toast-store").then(m => m.toast.error(err.message || t("ত্রুটি", "Error")));
    }
    setBgSaving(false);
  };

  // ---- Pricing save ----

  const savePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    setPricingSaving(true);
    try {
      await api.put(`/games/${gameId}`, {
        price: parseFloat(pricingForm.price) || 0,
        compare_price: pricingForm.compare_price ? parseFloat(pricingForm.compare_price) : null,
        is_free: pricingForm.is_free,
      }, accessToken!);
      import("@/stores/toast-store").then(m => m.toast.success(t("মূল্য আপডেট হয়েছে", "Pricing updated")));
      await loadGame();
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
      const results = (data.items || data || []).filter((item: any) => item.product?.id !== game?.product_id);
      setProductResults(results);
    } catch {
      setProductResults([]);
    }
    setSearchingProducts(false);
  };

  const attachProduct = async (productId: string) => {
    setAttaching(true);
    try {
      await api.post(`/games/${gameId}/attach/${productId}`, {}, accessToken!);
      import("@/stores/toast-store").then(m => m.toast.success(t("প্রোডাক্ট সংযুক্ত হয়েছে", "Product attached")));
      setProductSearch("");
      setProductResults([]);
      loadAttachedProducts();
    } catch (err: any) {
      import("@/stores/toast-store").then(m => m.toast.error(err.message || t("ত্রুটি", "Error")));
    }
    setAttaching(false);
  };

  const detachProduct = async (productId: string) => {
    if (!confirm(t("এই প্রোডাক্ট থেকে বিচ্ছিন্ন করবে?", "Detach this product?"))) return;
    try {
      await api.delete(`/games/${gameId}/attach/${productId}`, accessToken!);
      import("@/stores/toast-store").then(m => m.toast.success(t("বিচ্ছিন্ন হয়েছে", "Detached")));
      loadAttachedProducts();
    } catch (err: any) {
      import("@/stores/toast-store").then(m => m.toast.error(err.message || t("ত্রুটি", "Error")));
    }
  };

  const loadAttachedProducts = async () => {
    // Placeholder — the admin response would include attached_products in a real setup
  };

  // ---- Content item count summary ----

  const getContentSummary = (): string => {
    switch (game?.game_type) {
      case "memory": {
        const needed = gridPairsRequired(memoryConfig.grid);
        return `${memoryConfig.pairs.length}/${needed} ${t("জোড়া", "pairs")}`;
      }
      case "drag_drop":
        return `${dragDropConfig.items.length} ${t("আইটেম", "items")}, ${dragDropConfig.targets.length} ${t("টার্গেট", "targets")}`;
      case "crossword":
        return `${crosswordConfig.words.length} ${t("শব্দ", "words")}`;
      case "find_words":
        return `${findWordsConfig.words.length} ${t("শব্দ", "words")}`;
      case "image_sequence":
        return `${imageSeqConfig.steps.length} ${t("ধাপ", "steps")}`;
      case "arithmetic":
        return `${arithmeticConfig.question_count} ${t("প্রশ্ন", "questions")}`;
      default:
        return "";
    }
  };

  const getGameTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      memory: t("মেমোরি", "Memory"),
      drag_drop: t("ড্র্যাগ অ্যান্ড ড্রপ", "Drag & Drop"),
      crossword: t("ক্রসওয়ার্ড", "Crossword"),
      find_words: t("শব্দ খুঁজো", "Find Words"),
      image_sequence: t("ছবির ক্রম", "Image Sequence"),
      arithmetic: t("গণিত", "Arithmetic"),
    };
    return labels[type] || type;
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
            <Link href="/admin?tab=games" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="font-bold text-gray-900 font-bn text-lg">
                {locale === "bn" ? (game?.title_bn || game?.title || "গেম") : (game?.title || game?.title_bn || "Game")}
              </h1>
              <p className="text-xs text-gray-400">
                {getGameTypeLabel(game?.game_type)} &bull; {getContentSummary()}
              </p>
            </div>
          </div>
          <button
            onClick={() => window.open(`/games/${game?.slug}/play?preview=true`, "_blank")}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-700 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 transition-all font-bn"
          >
            <Gamepad2 className="w-4 h-4" /> {t("প্রিভিউ", "Preview")}
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Game Content Editor (70%) */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gamepad2 className="w-4 h-4 text-primary-600" />
                  <h3 className="font-semibold text-sm text-gray-900 font-bn">
                    {t("গেম কনটেন্ট", "Game Content")} — {getGameTypeLabel(game?.game_type)}
                  </h3>
                </div>
                <button
                  onClick={saveConfig}
                  disabled={configSaving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary-700 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 transition-all disabled:opacity-50"
                >
                  {configSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {t("কনটেন্ট সেভ করো", "Save Content")}
                </button>
              </div>

              <div className="p-4">
                {/* ===== MEMORY CONFIG ===== */}
                {game?.game_type === "memory" && (
                  <div className="space-y-4">
                    {/* Grid size selector */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">{t("গ্রিড সাইজ", "Grid Size")}</label>
                      <select
                        value={memoryConfig.grid}
                        onChange={e => setMemoryConfig(p => ({ ...p, grid: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400"
                      >
                        {GRID_OPTIONS.map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-400 mt-1 font-bn">
                        {memoryConfig.pairs.length}/{gridPairsRequired(memoryConfig.grid)} {t("জোড়া", "pairs")} ({t("প্রয়োজন", "need")} {gridPairsRequired(memoryConfig.grid)} {t("জোড়া", "pairs")} {memoryConfig.grid} {t("গ্রিডের জন্য", "grid")})
                      </p>
                    </div>

                    {/* Pairs list */}
                    <div className="space-y-3">
                      {memoryConfig.pairs.map((pair, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50/30">
                          {/* Image upload */}
                          <div className="shrink-0">
                            {pair.image_url ? (
                              <div className="relative w-16 h-16">
                                <img src={pair.image_url} alt="" className="w-16 h-16 object-cover rounded-lg" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMemoryConfig(p => ({
                                      ...p,
                                      pairs: p.pairs.map((pr, i) => i === idx ? { ...pr, image_url: "" } : pr),
                                    }));
                                  }}
                                  className="absolute -top-1.5 -right-1.5 p-0.5 bg-red-600 text-white rounded-full hover:bg-red-700"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <label className="flex items-center justify-center w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-400 transition-colors bg-gray-50/50">
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    setUploadingImage(`memory-${idx}`);
                                    const url = await uploadImage(file);
                                    if (url) {
                                      setMemoryConfig(p => ({
                                        ...p,
                                        pairs: p.pairs.map((pr, i) => i === idx ? { ...pr, image_url: url } : pr),
                                      }));
                                    }
                                    setUploadingImage(null);
                                    e.target.value = "";
                                  }}
                                />
                                {uploadingImage === `memory-${idx}` ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                ) : (
                                  <Plus className="w-5 h-5 text-gray-400" />
                                )}
                              </label>
                            )}
                          </div>
                          {/* Labels */}
                          <div className="flex-1 space-y-2">
                            <input
                              value={pair.label}
                              onChange={e => {
                                const val = e.target.value;
                                setMemoryConfig(p => ({
                                  ...p,
                                  pairs: p.pairs.map((pr, i) => i === idx ? { ...pr, label: val } : pr),
                                }));
                              }}
                              placeholder="Label (English) *"
                              required
                              className="w-full px-2.5 py-1.5 rounded border border-gray-200 text-sm outline-none focus:border-primary-400"
                            />
                            <input
                              value={pair.label_bn || ""}
                              onChange={e => {
                                const val = e.target.value;
                                setMemoryConfig(p => ({
                                  ...p,
                                  pairs: p.pairs.map((pr, i) => i === idx ? { ...pr, label_bn: val } : pr),
                                }));
                              }}
                              placeholder={t("লেবেল (বাংলা)", "Label (Bengali)")}
                              className="w-full px-2.5 py-1.5 rounded border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn"
                            />
                          </div>
                          {/* Remove button */}
                          <button
                            type="button"
                            onClick={() => setMemoryConfig(p => ({ ...p, pairs: p.pairs.filter((_, i) => i !== idx) }))}
                            className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add Pair button */}
                    <button
                      type="button"
                      onClick={() => setMemoryConfig(p => ({
                        ...p,
                        pairs: [...p.pairs, { image_url: "", label: "", label_bn: "" }],
                      }))}
                      className="flex items-center gap-1.5 text-sm text-primary-600 font-semibold hover:text-primary-700 font-bn"
                    >
                      <Plus className="w-4 h-4" /> {t("জোড়া যোগ করো", "Add Pair")}
                    </button>
                  </div>
                )}

                {/* ===== DRAG & DROP CONFIG ===== */}
                {game?.game_type === "drag_drop" && (
                  <div className="space-y-6">
                    {/* Items section */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 font-bn">{t("আইটেমসমূহ", "Items")}</h4>
                      <div className="space-y-3">
                        {dragDropConfig.items.map((item, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50/30">
                            {/* Image upload */}
                            <div className="shrink-0">
                              {item.image_url ? (
                                <div className="relative w-16 h-16">
                                  <img src={item.image_url} alt="" className="w-16 h-16 object-cover rounded-lg" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDragDropConfig(p => ({
                                        ...p,
                                        items: p.items.map((it, i) => i === idx ? { ...it, image_url: "" } : it),
                                      }));
                                    }}
                                    className="absolute -top-1.5 -right-1.5 p-0.5 bg-red-600 text-white rounded-full hover:bg-red-700"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <label className="flex items-center justify-center w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-400 transition-colors bg-gray-50/50">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      setUploadingImage(`dd-item-${idx}`);
                                      const url = await uploadImage(file);
                                      if (url) {
                                        setDragDropConfig(p => ({
                                          ...p,
                                          items: p.items.map((it, i) => i === idx ? { ...it, image_url: url } : it),
                                        }));
                                      }
                                      setUploadingImage(null);
                                      e.target.value = "";
                                    }}
                                  />
                                  {uploadingImage === `dd-item-${idx}` ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                  ) : (
                                    <Plus className="w-5 h-5 text-gray-400" />
                                  )}
                                </label>
                              )}
                            </div>
                            <div className="flex-1 space-y-2">
                              <input
                                value={item.content}
                                onChange={e => {
                                  const val = e.target.value;
                                  setDragDropConfig(p => ({
                                    ...p,
                                    items: p.items.map((it, i) => i === idx ? { ...it, content: val } : it),
                                  }));
                                }}
                                placeholder="Content (English) *"
                                required
                                className="w-full px-2.5 py-1.5 rounded border border-gray-200 text-sm outline-none focus:border-primary-400"
                              />
                              <input
                                value={item.content_bn || ""}
                                onChange={e => {
                                  const val = e.target.value;
                                  setDragDropConfig(p => ({
                                    ...p,
                                    items: p.items.map((it, i) => i === idx ? { ...it, content_bn: val } : it),
                                  }));
                                }}
                                placeholder={t("কনটেন্ট (বাংলা)", "Content (Bengali)")}
                                className="w-full px-2.5 py-1.5 rounded border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => setDragDropConfig(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))}
                              className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setDragDropConfig(p => ({
                          ...p,
                          items: [...p.items, { image_url: "", content: "", content_bn: "" }],
                        }))}
                        className="flex items-center gap-1.5 text-sm text-primary-600 font-semibold hover:text-primary-700 font-bn mt-3"
                      >
                        <Plus className="w-4 h-4" /> {t("আইটেম যোগ করো", "Add Item")}
                      </button>
                    </div>

                    {/* Targets section */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 font-bn">{t("টার্গেটসমূহ", "Targets")}</h4>
                      <div className="space-y-3">
                        {dragDropConfig.targets.map((target, tIdx) => (
                          <div key={tIdx} className="p-3 rounded-lg border border-gray-100 bg-gray-50/30 space-y-3">
                            <div className="flex items-start gap-3">
                              {/* Image upload */}
                              <div className="shrink-0">
                                {target.image_url ? (
                                  <div className="relative w-16 h-16">
                                    <img src={target.image_url} alt="" className="w-16 h-16 object-cover rounded-lg" />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDragDropConfig(p => ({
                                          ...p,
                                          targets: p.targets.map((tg, i) => i === tIdx ? { ...tg, image_url: "" } : tg),
                                        }));
                                      }}
                                      className="absolute -top-1.5 -right-1.5 p-0.5 bg-red-600 text-white rounded-full hover:bg-red-700"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <label className="flex items-center justify-center w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-400 transition-colors bg-gray-50/50">
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        setUploadingImage(`dd-target-${tIdx}`);
                                        const url = await uploadImage(file);
                                        if (url) {
                                          setDragDropConfig(p => ({
                                            ...p,
                                            targets: p.targets.map((tg, i) => i === tIdx ? { ...tg, image_url: url } : tg),
                                          }));
                                        }
                                        setUploadingImage(null);
                                        e.target.value = "";
                                      }}
                                    />
                                    {uploadingImage === `dd-target-${tIdx}` ? (
                                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                    ) : (
                                      <Plus className="w-5 h-5 text-gray-400" />
                                    )}
                                  </label>
                                )}
                              </div>
                              <div className="flex-1 space-y-2">
                                <input
                                  value={target.label}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setDragDropConfig(p => ({
                                      ...p,
                                      targets: p.targets.map((tg, i) => i === tIdx ? { ...tg, label: val } : tg),
                                    }));
                                  }}
                                  placeholder="Label (English) *"
                                  required
                                  className="w-full px-2.5 py-1.5 rounded border border-gray-200 text-sm outline-none focus:border-primary-400"
                                />
                                <input
                                  value={target.label_bn || ""}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setDragDropConfig(p => ({
                                      ...p,
                                      targets: p.targets.map((tg, i) => i === tIdx ? { ...tg, label_bn: val } : tg),
                                    }));
                                  }}
                                  placeholder={t("লেবেল (বাংলা)", "Label (Bengali)")}
                                  className="w-full px-2.5 py-1.5 rounded border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => setDragDropConfig(p => ({ ...p, targets: p.targets.filter((_, i) => i !== tIdx) }))}
                                className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {/* Accepted items checkboxes */}
                            {dragDropConfig.items.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 mb-1.5 font-bn">{t("গ্রহণযোগ্য আইটেম:", "Accepted Items:")}</p>
                                <div className="flex flex-wrap gap-2">
                                  {dragDropConfig.items.map((item, iIdx) => {
                                    const checked = target.accepted_items.includes(iIdx);
                                    return (
                                      <label key={iIdx} className="flex items-center gap-1.5 text-xs bg-white px-2 py-1 rounded border border-gray-200 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => {
                                            setDragDropConfig(p => ({
                                              ...p,
                                              targets: p.targets.map((tg, i) => {
                                                if (i !== tIdx) return tg;
                                                const newAccepted = checked
                                                  ? tg.accepted_items.filter(a => a !== iIdx)
                                                  : [...tg.accepted_items, iIdx];
                                                return { ...tg, accepted_items: newAccepted };
                                              }),
                                            }));
                                          }}
                                          className="rounded"
                                        />
                                        <span className="font-bn">{item.content || `Item ${iIdx + 1}`}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setDragDropConfig(p => ({
                          ...p,
                          targets: [...p.targets, { image_url: "", label: "", label_bn: "", accepted_items: [] }],
                        }))}
                        className="flex items-center gap-1.5 text-sm text-primary-600 font-semibold hover:text-primary-700 font-bn mt-3"
                      >
                        <Plus className="w-4 h-4" /> {t("টার্গেট যোগ করো", "Add Target")}
                      </button>
                    </div>
                  </div>
                )}

                {/* ===== CROSSWORD CONFIG ===== */}
                {game?.game_type === "crossword" && (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      {crosswordConfig.words.map((word, idx) => (
                        <div key={idx} className="p-3 rounded-lg border border-gray-100 bg-gray-50/30 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-500">#{idx + 1}</span>
                            <button
                              type="button"
                              onClick={() => setCrosswordConfig(p => ({ ...p, words: p.words.filter((_, i) => i !== idx) }))}
                              className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              value={word.word}
                              onChange={e => {
                                const val = e.target.value;
                                setCrosswordConfig(p => ({
                                  ...p,
                                  words: p.words.map((w, i) => i === idx ? { ...w, word: val } : w),
                                }));
                              }}
                              placeholder="Word (English) *"
                              required
                              className="px-2.5 py-1.5 rounded border border-gray-200 text-sm outline-none focus:border-primary-400"
                            />
                            <input
                              value={word.word_bn || ""}
                              onChange={e => {
                                const val = e.target.value;
                                setCrosswordConfig(p => ({
                                  ...p,
                                  words: p.words.map((w, i) => i === idx ? { ...w, word_bn: val } : w),
                                }));
                              }}
                              placeholder={t("শব্দ (বাংলা)", "Word (Bengali)")}
                              className="px-2.5 py-1.5 rounded border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              value={word.clue}
                              onChange={e => {
                                const val = e.target.value;
                                setCrosswordConfig(p => ({
                                  ...p,
                                  words: p.words.map((w, i) => i === idx ? { ...w, clue: val } : w),
                                }));
                              }}
                              placeholder="Clue (English) *"
                              required
                              className="px-2.5 py-1.5 rounded border border-gray-200 text-sm outline-none focus:border-primary-400"
                            />
                            <input
                              value={word.clue_bn || ""}
                              onChange={e => {
                                const val = e.target.value;
                                setCrosswordConfig(p => ({
                                  ...p,
                                  words: p.words.map((w, i) => i === idx ? { ...w, clue_bn: val } : w),
                                }));
                              }}
                              placeholder={t("সূত্র (বাংলা)", "Clue (Bengali)")}
                              className="px-2.5 py-1.5 rounded border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setCrosswordConfig(p => ({
                        ...p,
                        words: [...p.words, { word: "", word_bn: "", clue: "", clue_bn: "" }],
                      }))}
                      className="flex items-center gap-1.5 text-sm text-primary-600 font-semibold hover:text-primary-700 font-bn"
                    >
                      <Plus className="w-4 h-4" /> {t("শব্দ যোগ করো", "Add Word")}
                    </button>
                  </div>
                )}

                {/* ===== FIND WORDS CONFIG ===== */}
                {game?.game_type === "find_words" && (
                  <div className="space-y-4">
                    {/* Grid size */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">{t("গ্রিড সাইজ", "Grid Size")}</label>
                      <input
                        type="number"
                        min="5"
                        max="20"
                        value={findWordsConfig.grid_size}
                        onChange={e => setFindWordsConfig(p => ({ ...p, grid_size: parseInt(e.target.value) || 10 }))}
                        className="w-24 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400"
                      />
                    </div>

                    {/* Words list */}
                    <div className="space-y-3">
                      {findWordsConfig.words.map((w, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50/30">
                          <span className="text-xs font-bold text-gray-400 shrink-0">#{idx + 1}</span>
                          <input
                            value={w.word}
                            onChange={e => {
                              const val = e.target.value;
                              setFindWordsConfig(p => ({
                                ...p,
                                words: p.words.map((wd, i) => i === idx ? { ...wd, word: val } : wd),
                              }));
                            }}
                            placeholder="Word (English) *"
                            required
                            className="flex-1 px-2.5 py-1.5 rounded border border-gray-200 text-sm outline-none focus:border-primary-400"
                          />
                          <input
                            value={w.word_bn || ""}
                            onChange={e => {
                              const val = e.target.value;
                              setFindWordsConfig(p => ({
                                ...p,
                                words: p.words.map((wd, i) => i === idx ? { ...wd, word_bn: val } : wd),
                              }));
                            }}
                            placeholder={t("শব্দ (বাংলা)", "Word (Bengali)")}
                            className="flex-1 px-2.5 py-1.5 rounded border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn"
                          />
                          <button
                            type="button"
                            onClick={() => setFindWordsConfig(p => ({ ...p, words: p.words.filter((_, i) => i !== idx) }))}
                            className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setFindWordsConfig(p => ({
                        ...p,
                        words: [...p.words, { word: "", word_bn: "" }],
                      }))}
                      className="flex items-center gap-1.5 text-sm text-primary-600 font-semibold hover:text-primary-700 font-bn"
                    >
                      <Plus className="w-4 h-4" /> {t("শব্দ যোগ করো", "Add Word")}
                    </button>
                  </div>
                )}

                {/* ===== IMAGE SEQUENCE CONFIG ===== */}
                {game?.game_type === "image_sequence" && (
                  <div className="space-y-4">
                    {/* Reference image */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">
                        {t("রেফারেন্স ছবি (ঐচ্ছিক)", "Reference Image (optional)")}
                        <span className="text-gray-400 ml-1">16:9</span>
                      </label>
                      {imageSeqConfig.reference_image_url ? (
                        <div className="relative">
                          <img src={imageSeqConfig.reference_image_url} alt="" className="w-full aspect-video object-cover rounded-lg" />
                          <button
                            type="button"
                            onClick={() => setImageSeqConfig(p => ({ ...p, reference_image_url: "" }))}
                            className="absolute top-1.5 right-1.5 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex items-center justify-center w-full aspect-video border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-400 transition-colors bg-gray-50/50">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setUploadingImage("seq-ref");
                              const url = await uploadImage(file);
                              if (url) setImageSeqConfig(p => ({ ...p, reference_image_url: url }));
                              setUploadingImage(null);
                              e.target.value = "";
                            }}
                          />
                          {uploadingImage === "seq-ref" ? (
                            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                          ) : (
                            <div className="text-center">
                              <Plus className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                              <span className="text-xs text-gray-400 font-bn">{t("ছবি আপলোড করো", "Upload Image")}</span>
                            </div>
                          )}
                        </label>
                      )}
                    </div>

                    {/* Steps list */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 font-bn">{t("ধাপসমূহ", "Steps")}</h4>
                      <div className="space-y-3">
                        {imageSeqConfig.steps.map((step, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50/30">
                            {/* Sort order display */}
                            <div className="shrink-0 flex flex-col items-center gap-1">
                              <span className="w-6 h-6 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-[10px] font-bold">{idx + 1}</span>
                              <div className="flex flex-col gap-0.5">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => {
                                    setImageSeqConfig(p => {
                                      const steps = [...p.steps];
                                      [steps[idx - 1], steps[idx]] = [steps[idx], steps[idx - 1]];
                                      return { ...p, steps: steps.map((s, i) => ({ ...s, sort_order: i })) };
                                    });
                                  }}
                                  className="p-0.5 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-30"
                                >
                                  <ChevronUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === imageSeqConfig.steps.length - 1}
                                  onClick={() => {
                                    setImageSeqConfig(p => {
                                      const steps = [...p.steps];
                                      [steps[idx], steps[idx + 1]] = [steps[idx + 1], steps[idx]];
                                      return { ...p, steps: steps.map((s, i) => ({ ...s, sort_order: i })) };
                                    });
                                  }}
                                  className="p-0.5 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-30"
                                >
                                  <ChevronDown className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            {/* Image upload */}
                            <div className="shrink-0">
                              {step.image_url ? (
                                <div className="relative w-16 h-16">
                                  <img src={step.image_url} alt="" className="w-16 h-16 object-cover rounded-lg" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setImageSeqConfig(p => ({
                                        ...p,
                                        steps: p.steps.map((s, i) => i === idx ? { ...s, image_url: "" } : s),
                                      }));
                                    }}
                                    className="absolute -top-1.5 -right-1.5 p-0.5 bg-red-600 text-white rounded-full hover:bg-red-700"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <label className="flex items-center justify-center w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-400 transition-colors bg-gray-50/50">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      setUploadingImage(`seq-step-${idx}`);
                                      const url = await uploadImage(file);
                                      if (url) {
                                        setImageSeqConfig(p => ({
                                          ...p,
                                          steps: p.steps.map((s, i) => i === idx ? { ...s, image_url: url } : s),
                                        }));
                                      }
                                      setUploadingImage(null);
                                      e.target.value = "";
                                    }}
                                  />
                                  {uploadingImage === `seq-step-${idx}` ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                  ) : (
                                    <Plus className="w-5 h-5 text-gray-400" />
                                  )}
                                </label>
                              )}
                            </div>
                            {/* Labels */}
                            <div className="flex-1 space-y-2">
                              <input
                                value={step.label}
                                onChange={e => {
                                  const val = e.target.value;
                                  setImageSeqConfig(p => ({
                                    ...p,
                                    steps: p.steps.map((s, i) => i === idx ? { ...s, label: val } : s),
                                  }));
                                }}
                                placeholder="Label (English) *"
                                required
                                className="w-full px-2.5 py-1.5 rounded border border-gray-200 text-sm outline-none focus:border-primary-400"
                              />
                              <input
                                value={step.label_bn || ""}
                                onChange={e => {
                                  const val = e.target.value;
                                  setImageSeqConfig(p => ({
                                    ...p,
                                    steps: p.steps.map((s, i) => i === idx ? { ...s, label_bn: val } : s),
                                  }));
                                }}
                                placeholder={t("লেবেল (বাংলা)", "Label (Bengali)")}
                                className="w-full px-2.5 py-1.5 rounded border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => setImageSeqConfig(p => ({
                                ...p,
                                steps: p.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, sort_order: i })),
                              }))}
                              className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setImageSeqConfig(p => ({
                          ...p,
                          steps: [...p.steps, { image_url: "", label: "", label_bn: "", sort_order: p.steps.length }],
                        }))}
                        className="flex items-center gap-1.5 text-sm text-primary-600 font-semibold hover:text-primary-700 font-bn mt-3"
                      >
                        <Plus className="w-4 h-4" /> {t("ধাপ যোগ করো", "Add Step")}
                      </button>
                    </div>
                  </div>
                )}

                {/* ===== ARITHMETIC CONFIG ===== */}
                {game?.game_type === "arithmetic" && (
                  <div className="space-y-4">
                    {/* Operation toggles */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-2 font-bn">{t("অপারেশন", "Operations")}</label>
                      <div className="flex flex-wrap gap-3">
                        {[
                          { op: "+", label: t("যোগ (+)", "Addition (+)") },
                          { op: "-", label: t("বিয়োগ (-)", "Subtraction (-)") },
                          { op: "*", label: t("গুণ (x)", "Multiplication (x)") },
                          { op: "/", label: t("ভাগ (/)", "Division (/)") },
                        ].map(({ op, label }) => (
                          <label key={op} className="flex items-center gap-2 text-sm bg-white px-3 py-2 rounded-lg border border-gray-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={arithmeticConfig.operations.includes(op)}
                              onChange={() => {
                                setArithmeticConfig(p => {
                                  const ops = p.operations.includes(op)
                                    ? p.operations.filter(o => o !== op)
                                    : [...p.operations, op];
                                  return { ...p, operations: ops.length > 0 ? ops : ["+"] };
                                });
                              }}
                              className="rounded"
                            />
                            <span className="font-bn">{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Number range */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">{t("সর্বনিম্ন সংখ্যা", "Min Number")}</label>
                        <input
                          type="number"
                          min="0"
                          value={arithmeticConfig.min_number}
                          onChange={e => setArithmeticConfig(p => ({ ...p, min_number: parseInt(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">{t("সর্বোচ্চ সংখ্যা", "Max Number")}</label>
                        <input
                          type="number"
                          min="1"
                          value={arithmeticConfig.max_number}
                          onChange={e => setArithmeticConfig(p => ({ ...p, max_number: parseInt(e.target.value) || 20 }))}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400"
                        />
                      </div>
                    </div>

                    {/* Question count */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">{t("প্রশ্ন সংখ্যা", "Question Count")}</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={arithmeticConfig.question_count}
                        onChange={e => setArithmeticConfig(p => ({ ...p, question_count: parseInt(e.target.value) || 10 }))}
                        className="w-24 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400"
                      />
                    </div>
                  </div>
                )}

                {/* No game type fallback */}
                {!game?.game_type && (
                  <p className="text-sm text-gray-400 font-bn text-center py-8">{t("অজানা গেম টাইপ", "Unknown game type")}</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Sidebar (30%) */}
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-20 lg:self-start">

            {/* Game Settings Card */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
                <Target className="w-4 h-4 text-primary-600" />
                <h3 className="font-semibold text-sm text-gray-900 font-bn">{t("গেম সেটিংস", "Game Settings")}</h3>
              </div>
              <form onSubmit={saveSettings} className="p-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">{t("কঠিনতা", "Difficulty")}</label>
                  <select
                    value={settingsForm.difficulty}
                    onChange={e => setSettingsForm(p => ({ ...p, difficulty: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400"
                  >
                    <option value="easy">{t("সহজ", "Easy")}</option>
                    <option value="medium">{t("মাঝারি", "Medium")}</option>
                    <option value="hard">{t("কঠিন", "Hard")}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">{t("সময়সীমা (সেকেন্ড)", "Time Limit (seconds)")}</label>
                  <input
                    type="number"
                    min="0"
                    value={settingsForm.time_limit_seconds}
                    onChange={e => setSettingsForm(p => ({ ...p, time_limit_seconds: e.target.value }))}
                    placeholder={t("কোনো সীমা নেই", "No limit")}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={settingsSaving}
                  className="w-full py-2 bg-primary-700 text-white font-semibold rounded-xl hover:bg-primary-800 transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {settingsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {t("সেভ করো", "Save")}
                </button>
              </form>
            </div>

            {/* Background Image Card */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-600" />
                <h3 className="font-semibold text-sm text-gray-900 font-bn">{t("ব্যাকগ্রাউন্ড ছবি", "Background Image")}</h3>
              </div>
              <div className="p-4 space-y-3">
                {game?.background_image_url ? (
                  <div className="relative">
                    <img src={game.background_image_url} alt="" className="w-full aspect-video object-cover rounded-lg" />
                  </div>
                ) : (
                  <div className="w-full aspect-video bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg flex items-center justify-center">
                    <Gamepad2 className="w-10 h-10 text-primary-200" />
                  </div>
                )}
                <div className="flex gap-2">
                  <label className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadBackground(file);
                        e.target.value = "";
                      }}
                    />
                    <span className="flex items-center justify-center gap-1.5 w-full py-2 bg-primary-700 text-white font-semibold rounded-xl hover:bg-primary-800 transition-all text-sm cursor-pointer">
                      {bgUploading || bgSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                      {t("আপলোড করো", "Upload")}
                    </span>
                  </label>
                  {game?.background_image_url && (
                    <button
                      type="button"
                      onClick={resetBackground}
                      disabled={bgSaving}
                      className="px-3 py-2 bg-gray-100 text-gray-600 font-semibold rounded-xl hover:bg-gray-200 transition-all text-sm disabled:opacity-50"
                    >
                      {t("ডিফল্ট", "Use Default")}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Pricing Card */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
                <Gamepad2 className="w-4 h-4 text-green-600" />
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
                    <span className="font-bn font-semibold">{t("ফ্রি গেম", "Free Game")}</span>
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
                          {item.product?.title}
                        </span>
                        <button
                          onClick={() => attachProduct(item.product?.id)}
                          disabled={attaching}
                          className="px-2 py-1 bg-green-600 text-white rounded text-[10px] font-bold hover:bg-green-700 shrink-0 disabled:opacity-50"
                        >
                          {t("সংযুক্ত", "Attach")}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Attached products */}
                {attachedProducts.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 font-bn">{t("সংযুক্ত প্রোডাক্টসমূহ:", "Attached Products:")}</p>
                    {attachedProducts.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between px-3 py-2 bg-blue-50 rounded-lg">
                        <span className="text-xs text-gray-800 font-bn truncate flex-1 mr-2">
                          {p.title_bn || p.title}
                        </span>
                        <button
                          onClick={() => detachProduct(p.id)}
                          className="px-2 py-1 bg-red-100 text-red-600 rounded text-[10px] font-bold hover:bg-red-200 shrink-0"
                        >
                          {t("বিচ্ছিন্ন", "Detach")}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {attachedProducts.length === 0 && productResults.length === 0 && (
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
                  <p className="text-xs text-gray-400 font-bn text-center py-4">{t("এখনো কেউ খেলেনি", "No attempts yet")}</p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {attempts.slice(0, 20).map(a => (
                      <div key={a.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                        <div className="flex-1 min-w-0">
                          {a.guardian_name && (
                            <p className="text-[10px] text-gray-500 font-bn">
                              {t("অভিভাবক", "Guardian")}: {a.guardian_name}
                            </p>
                          )}
                          <p className="text-xs text-gray-700 font-bn truncate">
                            {t("শিশু", "Child")}: {(locale === "bn" && a.child_name_bn) ? a.child_name_bn : a.child_name || a.child_profile_id.substring(0, 8) + "..."}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {t("স্কোর", "Score")}: {a.score}
                            {a.time_seconds != null && (
                              <span className="ml-2">{a.time_seconds}s</span>
                            )}
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

          </div>
        </div>
      </main>
    </>
  );
}
