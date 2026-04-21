"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, Plus, Edit3, Trash2, ChevronDown, ChevronRight, Save, X,
  Loader2, CheckCircle2, GraduationCap, Clock, Target, Layers, Link as LinkIcon,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useLocaleStore } from "@/stores/locale-store";
import { api } from "@/lib/api";

// ---- Types ----

interface ExamOption {
  id: string;
  option_text: string;
  option_text_bn?: string;
  is_correct?: boolean;
  sort_order: number;
  image_url?: string;
}

interface ExamQuestion {
  id: string;
  question_text: string;
  question_text_bn?: string;
  question_type: string;
  sort_order: number;
  points: number;
  image_url?: string;
  options: ExamOption[];
}

interface ExamSection {
  id: string;
  title: string;
  title_bn?: string;
  sort_order: number;
  time_limit_seconds?: number;
  questions: ExamQuestion[];
}

interface Attempt {
  id: string;
  user_id: string;
  child_profile_id: string;
  guardian_name?: string;
  child_name?: string;
  child_name_bn?: string;
  score: string | null;
  total_points: number;
  earned_points: number;
  passed: boolean;
  completed_at: string | null;
}

// ---- Component ----

export default function ExamEditorPage() {
  const params = useParams();
  const examId = params?.id as string;
  const { accessToken } = useAuthStore();
  const { locale } = useLocaleStore();
  const t = (bn: string, en: string) => locale === "bn" ? bn : en;

  const [exam, setExam] = useState<any>(null);
  const [sections, setSections] = useState<ExamSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Section form
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [editSection, setEditSection] = useState<ExamSection | null>(null);
  const [sectionForm, setSectionForm] = useState({ title: "", title_bn: "", time_limit_seconds: "" });
  const [sectionSaving, setSectionSaving] = useState(false);

  // Question form
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [questionForSection, setQuestionForSection] = useState<string>("");
  const [editingQuestion, setEditingQuestion] = useState<ExamQuestion | null>(null);
  const [questionForm, setQuestionForm] = useState({
    question_text: "",
    question_text_bn: "",
    image_url: "",
    points: "1",
    options: [
      { option_text: "", option_text_bn: "", is_correct: true, image_url: "" },
      { option_text: "", option_text_bn: "", is_correct: false, image_url: "" },
      { option_text: "", option_text_bn: "", is_correct: false, image_url: "" },
      { option_text: "", option_text_bn: "", is_correct: false, image_url: "" },
    ],
  });
  const [questionSaving, setQuestionSaving] = useState(false);
  const [uploadingQuestionImage, setUploadingQuestionImage] = useState(false);
  const [uploadingOptionImage, setUploadingOptionImage] = useState<number | null>(null);

  // Exam settings form
  const [settingsForm, setSettingsForm] = useState({
    exam_type: "anytime",
    pass_percentage: "60",
    max_attempts: "",
    time_limit_seconds: "",
    scheduled_start: "",
    scheduled_end: "",
  });
  const [settingsSaving, setSettingsSaving] = useState(false);

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
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);

  // Title edit form
  const [showTitleForm, setShowTitleForm] = useState(false);
  const [titleForm, setTitleForm] = useState({ title: "", title_bn: "", slug: "" });
  const [titleSaving, setTitleSaving] = useState(false);

  // ---- Image upload helper ----

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "exam-images");
      const res: any = await api.postFormData("/uploads/image", fd, accessToken!);
      return res.url;
    } catch {
      const { toast } = await import("@/stores/toast-store");
      toast.error(t("ছবি আপলোড ব্যর্থ", "Image upload failed"));
      return null;
    }
  };

  // ---- Load exam ----

  useEffect(() => {
    if (!examId || !accessToken) return;
    loadExam();
    loadAttempts();
  }, [examId, accessToken]);

  const loadExam = async () => {
    try {
      const data: any = await api.get(`/exams/${examId}/admin`, accessToken!);
      setExam(data);
      setSections(data.sections || []);
      const ids = new Set<string>((data.sections || []).map((s: ExamSection) => s.id));
      setExpandedSections(ids);

      // Populate settings form
      setSettingsForm({
        exam_type: data.exam_type || "anytime",
        pass_percentage: String(data.pass_percentage ?? 60),
        max_attempts: data.max_attempts != null ? String(data.max_attempts) : "",
        time_limit_seconds: data.time_limit_seconds != null ? String(data.time_limit_seconds) : "",
        scheduled_start: data.scheduled_start ? data.scheduled_start.replace(" ", "T").slice(0, 16) : "",
        scheduled_end: data.scheduled_end ? data.scheduled_end.replace(" ", "T").slice(0, 16) : "",
      });

      // Populate pricing form
      setPricingForm({
        price: data.price ?? "0",
        compare_price: data.compare_price ?? "",
        is_free: data.is_free ?? false,
      });
    } catch {
      import("@/stores/toast-store").then(m => m.toast.error(t("পরীক্ষা লোড হয়নি", "Failed to load exam")));
    }
    setLoading(false);
  };

  const loadAttempts = async () => {
    setAttemptsLoading(true);
    try {
      const data: any = await api.get(`/exams/${examId}/attempts`, accessToken!);
      setAttempts(data || []);
    } catch {
      // silently ignore
    }
    setAttemptsLoading(false);
  };

  // ---- Toggle section ----

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ---- Section CRUD ----

  const openSectionForm = (section?: ExamSection) => {
    if (section) {
      setEditSection(section);
      setSectionForm({
        title: section.title,
        title_bn: section.title_bn || "",
        time_limit_seconds: section.time_limit_seconds != null ? String(section.time_limit_seconds) : "",
      });
    } else {
      setEditSection(null);
      setSectionForm({ title: "", title_bn: "", time_limit_seconds: "" });
    }
    setShowSectionForm(true);
  };

  const saveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    setSectionSaving(true);
    try {
      const payload: any = {
        title: sectionForm.title,
        title_bn: sectionForm.title_bn || undefined,
        sort_order: sections.length,
        time_limit_seconds: sectionForm.time_limit_seconds ? parseInt(sectionForm.time_limit_seconds) : undefined,
        questions: [],
      };

      if (editSection) {
        // The API doesn't have a PATCH section endpoint, so we delete and re-create
        // with existing questions preserved via the add section endpoint
        // For now we'll use the add section endpoint for new sections only
        // and skip editing (limitation: edit not supported by API)
        import("@/stores/toast-store").then(m => m.toast.error(t("সেকশন এডিট এই মুহূর্তে সাপোর্টেড নয়। মুছে নতুন করে তৈরি করুন।", "Section editing is not supported yet. Delete and re-create instead.")));
        setSectionSaving(false);
        setShowSectionForm(false);
        return;
      }

      await api.post(`/exams/${examId}/sections`, payload, accessToken!);
      import("@/stores/toast-store").then(m => m.toast.success(t("সেকশন তৈরি হয়েছে", "Section created")));
      setShowSectionForm(false);
      await loadExam();
    } catch (err: any) {
      import("@/stores/toast-store").then(m => m.toast.error(err.message || t("ত্রুটি", "Error")));
    }
    setSectionSaving(false);
  };

  const deleteSection = async (sectionId: string) => {
    if (!confirm(t("এই সেকশন এবং এর সব প্রশ্ন মুছে ফেলবে?", "This will delete the section and all its questions. Continue?"))) return;
    try {
      await api.delete(`/exams/sections/${sectionId}`, accessToken!);
      import("@/stores/toast-store").then(m => m.toast.success(t("সেকশন মুছে ফেলা হয়েছে", "Section deleted")));
      await loadExam();
    } catch {
      import("@/stores/toast-store").then(m => m.toast.error(t("ত্রুটি", "Error")));
    }
  };

  // ---- Question form ----

  const openQuestionForm = (sectionId: string) => {
    setQuestionForSection(sectionId);
    setEditingQuestion(null);
    setQuestionForm({
      question_text: "",
      question_text_bn: "",
      image_url: "",
      points: "1",
      options: [
        { option_text: "", option_text_bn: "", is_correct: true, image_url: "" },
        { option_text: "", option_text_bn: "", is_correct: false, image_url: "" },
        { option_text: "", option_text_bn: "", is_correct: false, image_url: "" },
        { option_text: "", option_text_bn: "", is_correct: false, image_url: "" },
      ],
    });
    setShowQuestionForm(true);
  };

  const openEditQuestion = (sectionId: string, question: ExamQuestion) => {
    setQuestionForSection(sectionId);
    setEditingQuestion(question);
    const opts = question.options
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(o => ({
        option_text: o.option_text,
        option_text_bn: o.option_text_bn || "",
        is_correct: o.is_correct || false,
        image_url: o.image_url || "",
      }));
    // Ensure we always have exactly 4 options
    while (opts.length < 4) {
      opts.push({ option_text: "", option_text_bn: "", is_correct: false, image_url: "" });
    }
    setQuestionForm({
      question_text: question.question_text,
      question_text_bn: question.question_text_bn || "",
      image_url: question.image_url || "",
      points: String(question.points),
      options: opts.slice(0, 4),
    });
    setShowQuestionForm(true);
  };

  const deleteQuestion = async (questionId: string) => {
    if (!confirm(t("এই প্রশ্নটি মুছে ফেলবে?", "Delete this question?"))) return;
    try {
      await api.delete(`/exams/questions/${questionId}`, accessToken!);
      import("@/stores/toast-store").then(m => m.toast.success(t("প্রশ্ন মুছে ফেলা হয়েছে", "Question deleted")));
      await loadExam();
    } catch {
      import("@/stores/toast-store").then(m => m.toast.error(t("ত্রুটি", "Error")));
    }
  };

  const saveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuestionSaving(true);
    try {
      if (editingQuestion) {
        // ---- UPDATE existing question via PUT ----
        const payload = {
          question_text: questionForm.question_text,
          question_text_bn: questionForm.question_text_bn || undefined,
          image_url: questionForm.image_url || undefined,
          points: parseInt(questionForm.points) || 1,
          sort_order: editingQuestion.sort_order,
          options: questionForm.options.map((o, i) => ({
            option_text: o.option_text,
            option_text_bn: o.option_text_bn || undefined,
            image_url: o.image_url || undefined,
            is_correct: o.is_correct,
            sort_order: i,
          })),
        };
        await api.put(`/exams/questions/${editingQuestion.id}`, payload, accessToken!);
        import("@/stores/toast-store").then(m => m.toast.success(t("প্রশ্ন আপডেট হয়েছে", "Question updated")));
      } else {
        // ---- ADD new question directly to section ----
        const section = sections.find(s => s.id === questionForSection);
        if (!section) throw new Error(t("সেকশন পাওয়া যায়নি", "Section not found"));

        const payload = {
          question_text: questionForm.question_text || undefined,
          question_text_bn: questionForm.question_text_bn || undefined,
          image_url: questionForm.image_url || undefined,
          question_type: "mcq",
          sort_order: section.questions.length,
          points: parseInt(questionForm.points) || 1,
          options: questionForm.options.map((o, i) => ({
            option_text: o.option_text || undefined,
            option_text_bn: o.option_text_bn || undefined,
            image_url: o.image_url || undefined,
            is_correct: o.is_correct,
            sort_order: i,
          })),
        };

        await api.post(`/exams/sections/${section.id}/questions`, payload, accessToken!);
        import("@/stores/toast-store").then(m => m.toast.success(t("প্রশ্ন যোগ হয়েছে", "Question added")));
      }
      setShowQuestionForm(false);
      setEditingQuestion(null);
      await loadExam();
    } catch (err: any) {
      import("@/stores/toast-store").then(m => m.toast.error(err.message || t("ত্রুটি", "Error")));
    }
    setQuestionSaving(false);
  };

  // ---- Settings save ----

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaving(true);
    try {
      const payload: any = {
        exam_type: settingsForm.exam_type,
        pass_percentage: parseInt(settingsForm.pass_percentage) || 60,
        max_attempts: settingsForm.max_attempts ? parseInt(settingsForm.max_attempts) : null,
        time_limit_seconds: settingsForm.time_limit_seconds ? parseInt(settingsForm.time_limit_seconds) : null,
      };
      if (settingsForm.exam_type === "scheduled") {
        payload.scheduled_start = settingsForm.scheduled_start || null;
        payload.scheduled_end = settingsForm.scheduled_end || null;
      }
      await api.put(`/exams/${examId}`, payload, accessToken!);
      import("@/stores/toast-store").then(m => m.toast.success(t("সেটিংস আপডেট হয়েছে", "Settings updated")));
      await loadExam();
    } catch (err: any) {
      import("@/stores/toast-store").then(m => m.toast.error(err.message || t("ত্রুটি", "Error")));
    }
    setSettingsSaving(false);
  };

  // ---- Pricing save ----

  const savePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    setPricingSaving(true);
    try {
      await api.put(`/exams/${examId}`, {
        price: parseFloat(pricingForm.price) || 0,
        compare_price: pricingForm.compare_price ? parseFloat(pricingForm.compare_price) : null,
        is_free: pricingForm.is_free,
      }, accessToken!);
      import("@/stores/toast-store").then(m => m.toast.success(t("মূল্য আপডেট হয়েছে", "Pricing updated")));
      await loadExam();
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
      const results = (data.items || data || []).filter((item: any) => item.product?.id !== exam?.product_id);
      setProductResults(results);
    } catch {
      setProductResults([]);
    }
    setSearchingProducts(false);
  };

  const attachProduct = async (productId: string) => {
    setAttaching(true);
    try {
      await api.post(`/exams/${examId}/attach/${productId}`, {}, accessToken!);
      import("@/stores/toast-store").then(m => m.toast.success(t("প্রোডাক্ট সংযুক্ত হয়েছে", "Product attached")));
      setProductSearch("");
      setProductResults([]);
      // Reload attached products list
      loadAttachedProducts();
    } catch (err: any) {
      import("@/stores/toast-store").then(m => m.toast.error(err.message || t("ত্রুটি", "Error")));
    }
    setAttaching(false);
  };

  const detachProduct = async (productId: string) => {
    if (!confirm(t("এই প্রোডাক্ট থেকে বিচ্ছিন্ন করবে?", "Detach this product?"))) return;
    try {
      await api.delete(`/exams/${examId}/attach/${productId}`, accessToken!);
      import("@/stores/toast-store").then(m => m.toast.success(t("বিচ্ছিন্ন হয়েছে", "Detached")));
      loadAttachedProducts();
    } catch (err: any) {
      import("@/stores/toast-store").then(m => m.toast.error(err.message || t("ত্রুটি", "Error")));
    }
  };

  // ---- Title save ----

  const openTitleForm = () => {
    setTitleForm({
      title: exam?.title || "",
      title_bn: exam?.title_bn || "",
      slug: exam?.slug || "",
    });
    setShowTitleForm(true);
  };

  const saveTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    setTitleSaving(true);
    try {
      await api.put(`/exams/${examId}`, {
        title: titleForm.title,
        title_bn: titleForm.title_bn || undefined,
        slug: titleForm.slug || undefined,
      }, accessToken!);
      import("@/stores/toast-store").then(m => m.toast.success(t("শিরোনাম আপডেট হয়েছে", "Title updated")));
      setShowTitleForm(false);
      await loadExam();
    } catch (err: any) {
      import("@/stores/toast-store").then(m => m.toast.error(err.message || t("ত্রুটি", "Error")));
    }
    setTitleSaving(false);
  };

  const loadAttachedProducts = async () => {
    // No dedicated endpoint for listing attached products; we can't load them separately.
    // This is a placeholder; in a real setup, the admin response would include attached_products.
  };

  // ---- Loading state ----

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const totalQuestions = sections.reduce((t, s) => t + s.questions.length, 0);

  return (
    <>
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin?tab=exams" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-gray-900 font-bn text-lg">
                  {locale === "bn" ? (exam?.title_bn || exam?.title || "পরীক্ষা") : (exam?.title || exam?.title_bn || "Exam")}
                </h1>
                <button
                  onClick={openTitleForm}
                  className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-primary-600 transition-colors"
                  title={t("শিরোনাম এডিট করুন", "Edit title")}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-gray-400">
                {sections.length} {t("সেকশন", "sections")} • {totalQuestions} {t("প্রশ্ন", "questions")}
              </p>
            </div>
          </div>
          <button
            onClick={() => openSectionForm()}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-700 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 transition-all font-bn"
          >
            <Plus className="w-4 h-4" /> {t("সেকশন যোগ করো", "Add Section")}
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Sections (70%) */}
          <div className="lg:col-span-8">
            {sections.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
                <Layers className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-bn mb-4">{t("এই পরীক্ষায় এখনো কোনো সেকশন নেই", "This exam has no sections yet")}</p>
                <button
                  onClick={() => openSectionForm()}
                  className="px-5 py-2.5 bg-primary-700 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 transition-all font-bn"
                >
                  <Plus className="w-4 h-4 inline mr-1" /> {t("প্রথম সেকশন তৈরি করো", "Create First Section")}
                </button>
              </div>
            )}

            {/* Sections */}
            <div className="space-y-3">
              {sections.map((section, si) => {
                const isExpanded = expandedSections.has(section.id);
                return (
                  <div key={section.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Section Header */}
                    <div
                      className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50/50 transition-colors"
                      onClick={() => toggleSection(section.id)}
                    >
                      <div className="flex items-center gap-1.5 text-gray-400">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm text-gray-900 font-bn">
                          <span className="text-primary-600 mr-1.5">{t("সেকশন", "Section")} {si + 1}:</span>
                          {locale === "bn" ? (section.title_bn || section.title) : (section.title || section.title_bn)}
                        </h3>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {section.questions.length} {t("প্রশ্ন", "questions")}
                          {section.time_limit_seconds && (
                            <span className="ml-2">
                              <Clock className="w-3 h-3 inline mr-0.5" />
                              {Math.ceil(section.time_limit_seconds / 60)} {t("মিনিট", "min")}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => openQuestionForm(section.id)} className="p-1.5 rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100" title="Add Question">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => openSectionForm(section)} className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100" title="Edit Section">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteSection(section.id)} className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100" title="Delete Section">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Questions */}
                    {isExpanded && (
                      <div className="border-t border-gray-50">
                        {section.questions.length === 0 && (
                          <div className="px-4 py-6 text-center">
                            <p className="text-xs text-gray-400 font-bn mb-2">{t("কোনো প্রশ্ন নেই", "No questions")}</p>
                            <button
                              onClick={() => openQuestionForm(section.id)}
                              className="text-xs text-primary-600 font-semibold hover:underline font-bn"
                            >
                              + {t("প্রশ্ন যোগ করো", "Add Question")}
                            </button>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
                          {section.questions
                            .sort((a, b) => a.sort_order - b.sort_order)
                            .map((question, qi) => (
                              <div
                                key={question.id}
                                className="relative rounded-xl border border-gray-100 bg-white p-3 hover:shadow-sm transition-all"
                              >
                                {/* Top row: number, points badge, action buttons */}
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                                      <span className="text-[10px] font-bold">{qi + 1}</span>
                                    </div>
                                    <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-[10px] font-bold rounded-md border border-purple-100">
                                      {question.points} {t("পয়েন্ট", "pts")}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => openEditQuestion(section.id, question)}
                                      className="p-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                      title={t("প্রশ্ন এডিট করো", "Edit Question")}
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => deleteQuestion(question.id)}
                                      className="p-1 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                                      title={t("প্রশ্ন মুছে ফেলো", "Delete Question")}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                                {/* Question image */}
                                {question.image_url && (
                                  <img src={question.image_url} alt="" className="w-full aspect-video object-cover rounded-lg mb-2" />
                                )}
                                {/* Question text (truncated) */}
                                <p className="text-sm text-gray-800 font-bn line-clamp-2 mb-2">
                                  {locale === "bn" ? (question.question_text_bn || question.question_text) : (question.question_text || question.question_text_bn)}
                                </p>
                                {/* Options */}
                                <div className="space-y-1">
                                  {question.options
                                    .sort((a, b) => a.sort_order - b.sort_order)
                                    .map((opt, oi) => (
                                      <div
                                        key={opt.id}
                                        className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg ${
                                          opt.is_correct
                                            ? "bg-green-50 text-green-700 border border-green-200"
                                            : "bg-gray-50 text-gray-600"
                                        }`}
                                      >
                                        {opt.is_correct && <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />}
                                        <span className="font-bn truncate flex items-center gap-1.5">
                                          {String.fromCharCode(2453 + oi)})
                                          {opt.image_url && <img src={opt.image_url} alt="" className="w-5 h-5 rounded object-cover inline-block" />}
                                          {(opt.option_text || opt.option_text_bn) && (
                                            <span>{locale === "bn" ? (opt.option_text_bn || opt.option_text) : (opt.option_text || opt.option_text_bn)}</span>
                                          )}
                                        </span>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            ))}
                        </div>
                        {/* Add question button at the bottom */}
                        <div className="px-4 py-2 border-t border-gray-50">
                          <button
                            onClick={() => openQuestionForm(section.id)}
                            className="text-xs text-primary-600 font-semibold hover:text-primary-700 font-bn flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> {t("প্রশ্ন যোগ করো", "Add Question")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Sidebar (30%) */}
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-20 lg:self-start">

            {/* Exam Settings Card */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
                <Target className="w-4 h-4 text-primary-600" />
                <h3 className="font-semibold text-sm text-gray-900 font-bn">{t("পরীক্ষার সেটিংস", "Exam Settings")}</h3>
              </div>
              <form onSubmit={saveSettings} className="p-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">{t("পরীক্ষার ধরণ", "Exam Type")}</label>
                  <select
                    value={settingsForm.exam_type}
                    onChange={e => setSettingsForm(p => ({ ...p, exam_type: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400"
                  >
                    <option value="anytime">{t("যেকোনো সময়", "Anytime")}</option>
                    <option value="scheduled">{t("নির্ধারিত সময়", "Scheduled")}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">{t("পাস মার্ক (%)", "Pass Mark (%)")}</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={settingsForm.pass_percentage}
                    onChange={e => setSettingsForm(p => ({ ...p, pass_percentage: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">{t("সর্বোচ্চ চেষ্টা", "Max Attempts")}</label>
                  <input
                    type="number"
                    min="0"
                    value={settingsForm.max_attempts}
                    onChange={e => setSettingsForm(p => ({ ...p, max_attempts: e.target.value }))}
                    placeholder={t("সীমাহীন", "Unlimited")}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400"
                  />
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

                {settingsForm.exam_type === "scheduled" && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">{t("শুরু", "Start")}</label>
                      <input
                        type="datetime-local"
                        value={settingsForm.scheduled_start}
                        onChange={e => setSettingsForm(p => ({ ...p, scheduled_start: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">{t("শেষ", "End")}</label>
                      <input
                        type="datetime-local"
                        value={settingsForm.scheduled_end}
                        onChange={e => setSettingsForm(p => ({ ...p, scheduled_end: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400"
                      />
                    </div>
                  </>
                )}

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

            {/* Pricing Card */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-green-600" />
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
                    <span className="font-bn font-semibold">{t("ফ্রি পরীক্ষা", "Free Exam")}</span>
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

            {/* Attempts Card */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-purple-600" />
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
                          {a.guardian_name && (
                            <p className="text-[10px] text-gray-500 font-bn">
                              {t("অভিভাবক", "Guardian")}: {a.guardian_name}
                            </p>
                          )}
                          <p className="text-xs text-gray-700 font-bn truncate">
                            {t("শিশু", "Child")}: {(locale === "bn" && a.child_name_bn) ? a.child_name_bn : a.child_name || a.child_profile_id.substring(0, 8) + "..."}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {a.earned_points}/{a.total_points} {t("পয়েন্ট", "points")}
                          </p>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            a.passed
                              ? "bg-green-50 text-green-700 border border-green-200"
                              : "bg-red-50 text-red-600 border border-red-200"
                          }`}>
                            {a.passed ? t("পাশ", "Pass") : t("ফেল", "Fail")}
                          </span>
                          {a.score && (
                            <p className="text-[10px] text-gray-500 mt-0.5">{parseFloat(a.score).toFixed(1)}%</p>
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

      {/* ===== Title Edit Modal ===== */}
      {showTitleForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowTitleForm(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold font-bn">{t("পরীক্ষার শিরোনাম সম্পাদনা", "Edit Exam Title")}</h2>
              <button onClick={() => setShowTitleForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={saveTitle} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Title (English) *</label>
                <input
                  required
                  value={titleForm.title}
                  onChange={e => setTitleForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400"
                  placeholder="Exam title in English"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">শিরোনাম (বাংলা)</label>
                <input
                  value={titleForm.title_bn}
                  onChange={e => setTitleForm(p => ({ ...p, title_bn: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn"
                  placeholder="বাংলায় শিরোনাম"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Slug (URL)</label>
                <input
                  value={titleForm.slug}
                  onChange={e => setTitleForm(p => ({ ...p, slug: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400 font-mono"
                  placeholder="exam-url-slug"
                />
                <p className="text-[11px] text-gray-400 mt-1">Leave blank to keep current slug</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowTitleForm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all font-bn">
                  {t("বাতিল", "Cancel")}
                </button>
                <button type="submit" disabled={titleSaving} className="flex-1 py-2.5 bg-primary-700 text-white rounded-xl text-sm font-bold hover:bg-primary-800 transition-all disabled:opacity-60 flex items-center justify-center gap-2 font-bn">
                  {titleSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {t("সংরক্ষণ করুন", "Save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== Section Form Modal ===== */}
      {showSectionForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowSectionForm(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold font-bn">{editSection ? t("সেকশন এডিট", "Edit Section") : t("নতুন সেকশন", "New Section")}</h2>
              <button onClick={() => setShowSectionForm(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveSection} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Title (English)</label>
                <input
                  value={sectionForm.title}
                  onChange={e => setSectionForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">{t("নাম (বাংলা)", "Title (Bengali)")}</label>
                <input
                  value={sectionForm.title_bn}
                  onChange={e => setSectionForm(p => ({ ...p, title_bn: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">{t("সময়সীমা (সেকেন্ড)", "Time Limit (seconds)")}</label>
                <input
                  type="number"
                  min="0"
                  value={sectionForm.time_limit_seconds}
                  onChange={e => setSectionForm(p => ({ ...p, time_limit_seconds: e.target.value }))}
                  placeholder={t("অপশনাল", "Optional")}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400"
                />
              </div>
              <button
                type="submit"
                disabled={sectionSaving}
                className="w-full py-2.5 bg-primary-700 text-white font-semibold rounded-xl hover:bg-primary-800 transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sectionSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editSection ? t("আপডেট করো", "Update") : t("তৈরি করো", "Create")}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===== Question Form Modal ===== */}
      {showQuestionForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setShowQuestionForm(false); setEditingQuestion(null); }}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold font-bn">{editingQuestion ? t("প্রশ্ন এডিট করো", "Edit Question") : t("নতুন প্রশ্ন", "New Question")}</h2>
              <button onClick={() => { setShowQuestionForm(false); setEditingQuestion(null); }} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveQuestion} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Question (English)</label>
                <textarea
                  value={questionForm.question_text}
                  onChange={e => setQuestionForm(p => ({ ...p, question_text: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400 resize-none h-20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">{t("প্রশ্ন (বাংলা)", "Question (Bengali)")}</label>
                <textarea
                  value={questionForm.question_text_bn}
                  onChange={e => setQuestionForm(p => ({ ...p, question_text_bn: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn resize-none h-20"
                />
              </div>

              {/* Question Image Upload */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">
                  {t("প্রশ্নের ছবি (ঐচ্ছিক)", "Question Image (optional)")}
                  <span className="text-gray-400 ml-1">16:9</span>
                </label>
                {questionForm.image_url ? (
                  <div className="relative">
                    <img src={questionForm.image_url} alt="" className="w-full aspect-video object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={() => setQuestionForm(p => ({ ...p, image_url: "" }))}
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
                        setUploadingQuestionImage(true);
                        const url = await uploadImage(file);
                        if (url) setQuestionForm(p => ({ ...p, image_url: url }));
                        setUploadingQuestionImage(false);
                        e.target.value = "";
                      }}
                    />
                    {uploadingQuestionImage ? (
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

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">{t("পয়েন্ট", "Points")}</label>
                <input
                  type="number"
                  min="1"
                  value={questionForm.points}
                  onChange={e => setQuestionForm(p => ({ ...p, points: e.target.value }))}
                  className="w-24 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400"
                />
              </div>

              {/* Options */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2 font-bn">{t("অপশনসমূহ (সঠিক উত্তর সিলেক্ট করুন)", "Options (select the correct answer)")}</label>
                <div className="space-y-2">
                  {questionForm.options.map((opt, idx) => (
                    <div key={idx} className={`p-3 rounded-lg border ${opt.is_correct ? "border-green-300 bg-green-50/50" : "border-gray-200 bg-gray-50/30"}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="radio"
                          name="correct_option"
                          checked={opt.is_correct}
                          onChange={() => {
                            setQuestionForm(p => ({
                              ...p,
                              options: p.options.map((o, i) => ({ ...o, is_correct: i === idx })),
                            }));
                          }}
                          className="text-green-600"
                        />
                        <span className="text-xs font-bold text-gray-500">{String.fromCharCode(65 + idx)})</span>
                        {opt.is_correct && (
                          <span className="text-[10px] font-bold text-green-600 font-bn">{t("সঠিক উত্তর", "Correct")}</span>
                        )}
                      </div>
                      {/* Option Image */}
                      <div className="mb-2">
                        {opt.image_url ? (
                          <div className="relative w-20 h-20">
                            <img src={opt.image_url} alt="" className="w-20 h-20 object-cover rounded-lg" />
                            <button
                              type="button"
                              onClick={() => {
                                setQuestionForm(p => ({
                                  ...p,
                                  options: p.options.map((o, i) => i === idx ? { ...o, image_url: "" } : o),
                                }));
                              }}
                              className="absolute -top-1.5 -right-1.5 p-0.5 bg-red-600 text-white rounded-full hover:bg-red-700"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <label className="flex items-center justify-center w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-400 transition-colors bg-gray-50/50">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setUploadingOptionImage(idx);
                                const url = await uploadImage(file);
                                if (url) {
                                  setQuestionForm(p => ({
                                    ...p,
                                    options: p.options.map((o, i) => i === idx ? { ...o, image_url: url } : o),
                                  }));
                                }
                                setUploadingOptionImage(null);
                                e.target.value = "";
                              }}
                            />
                            {uploadingOptionImage === idx ? (
                              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                            ) : (
                              <Plus className="w-5 h-5 text-gray-400" />
                            )}
                          </label>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={opt.option_text}
                          onChange={e => {
                            const val = e.target.value;
                            setQuestionForm(p => ({
                              ...p,
                              options: p.options.map((o, i) => i === idx ? { ...o, option_text: val } : o),
                            }));
                          }}
                          placeholder="English"
                          className="px-2.5 py-1.5 rounded border border-gray-200 text-sm outline-none focus:border-primary-400"
                        />
                        <input
                          value={opt.option_text_bn}
                          onChange={e => {
                            const val = e.target.value;
                            setQuestionForm(p => ({
                              ...p,
                              options: p.options.map((o, i) => i === idx ? { ...o, option_text_bn: val } : o),
                            }));
                          }}
                          placeholder={t("বাংলা", "Bengali")}
                          className="px-2.5 py-1.5 rounded border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={questionSaving}
                className="w-full py-2.5 bg-primary-700 text-white font-semibold rounded-xl hover:bg-primary-800 transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {questionSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingQuestion ? t("আপডেট করো", "Update Question") : t("প্রশ্ন যোগ করো", "Add Question")}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
