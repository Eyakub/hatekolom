"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Plus, Edit3, Trash2, GripVertical, ChevronDown, ChevronRight,
  Video, FileText, BookOpen, Loader2, X, Save, Youtube, MessageSquare, CheckCircle2
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";

import { ResourceManager } from "@/components/admin/ResourceManager";
import { AdminFeedbackSection } from "@/components/admin/AdminFeedbackSection";
import { ExamAttachment } from "@/components/admin/ExamAttachment";

const RichTextEditor = lazy(() => import("@/components/admin/RichTextEditor"));
const QuizEditorModal = lazy(() => import("@/components/admin/QuizEditorModal"));

interface Lesson {
  id: string;
  title: string;
  title_bn?: string;
  lesson_type: string;
  sort_order: number;
  duration_seconds?: number;
  is_free: boolean;
  content?: string;
  content_bn?: string;
  youtube_id?: string;
  video?: { youtube_id: string } | null;
  allow_submission?: boolean;
  allow_image_upload?: boolean;
  max_grade?: number;
}

interface Module {
  id: string;
  title: string;
  title_bn?: string;
  sort_order: number;
  is_free: boolean;
  lessons: Lesson[];
}

const lessonTypeLabels: Record<string, string> = {
  video_lecture: "ভিডিও লেকচার",
  smart_note: "স্মার্ট নোট",
  assignment: "অ্যাসাইনমেন্ট",
  quiz: "কুইজ",
  live_session: "লাইভ ক্লাস",
};

const lessonTypeIcons: Record<string, typeof Video> = {
  video_lecture: Video,
  smart_note: FileText,
  assignment: BookOpen,
  quiz: BookOpen,
  live_session: Video,
};

export default function CourseEditorPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params?.id as string;
  const { accessToken } = useAuthStore();

  const [course, setCourse] = useState<any>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Module form
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [editModule, setEditModule] = useState<Module | null>(null);
  const [moduleForm, setModuleForm] = useState({ title: "", title_bn: "", sort_order: "0", is_free: false });
  const [moduleSaving, setModuleSaving] = useState(false);

  // Lesson form
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [lessonForModule, setLessonForModule] = useState<string>("");
  const [editLesson, setEditLesson] = useState<Lesson | null>(null);
  const [lessonForm, setLessonForm] = useState({
    title: "", title_bn: "", lesson_type: "video_lecture", sort_order: "0",
    duration_seconds: "", is_free: false, youtube_id: "", content: "",
    allow_submission: false, allow_image_upload: false, max_grade: "10",
  });
  const [lessonSaving, setLessonSaving] = useState(false);

  // Submissions Viewer
  const [showSubmissions, setShowSubmissions] = useState(false);
  const [activeLessonSubmissions, setActiveLessonSubmissions] = useState<Lesson | null>(null);
  const [submissionsList, setSubmissionsList] = useState<any[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [gradeForm, setGradeForm] = useState<{ id: string | null; grade: string; feedback: string }>({ id: null, grade: "", feedback: "" });

  // Quiz Editor
  const [showQuizEditor, setShowQuizEditor] = useState(false);
  const [activeQuizLesson, setActiveQuizLesson] = useState<Lesson | null>(null);

  const openQuizEditor = (lesson: Lesson) => {
    setActiveQuizLesson(lesson);
    setShowQuizEditor(true);
  };

  // Load course
  useEffect(() => {
    if (!courseId || !accessToken) return;
    loadCourse();
  }, [courseId, accessToken]);

  const loadCourse = async () => {
    try {
      const data: any = await api.get(`/courses/${courseId}`, accessToken!);
      setCourse(data);
      setModules(data.modules || []);
      // Expand all modules by default
      const ids = new Set<string>((data.modules || []).map((m: Module) => m.id));
      setExpandedModules(ids);
    } catch {
      import("@/stores/toast-store").then(m => m.toast.error("কোর্স লোড হয়নি"));
    }
    setLoading(false);
  };

  const toggleModule = (id: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openSubmissions = async (lesson: Lesson) => {
    setActiveLessonSubmissions(lesson);
    setShowSubmissions(true);
    setLoadingSubmissions(true);
    try {
      const data: any = await api.get(`/assignments/${lesson.id}/submissions`, accessToken!);
      setSubmissionsList(data.submissions || []);
    } catch {
      import("@/stores/toast-store").then(m => m.toast.error("সাবমিশন লোড করতে সমস্যা হয়েছে"));
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const submitGrade = async (submissionId: string) => {
    if (!gradeForm.grade) return;
    try {
      await api.post(`/assignments/submissions/${submissionId}/grade`, {
        grade: parseInt(gradeForm.grade),
        feedback: gradeForm.feedback || null
      }, accessToken!);
      import("@/stores/toast-store").then(m => m.toast.success("গ্রেড প্রদান সম্পন্ন"));
      setGradeForm({ id: null, grade: "", feedback: "" });
      // Refresh
      if (activeLessonSubmissions) {
        openSubmissions(activeLessonSubmissions);
      }
    } catch {
      import("@/stores/toast-store").then(m => m.toast.error("গ্রেড দিতে ব্যর্থ হয়েছে"));
    }
  };

  // ============================================
  // MODULE CRUD
  // ============================================

  const openModuleForm = (mod?: Module) => {
    if (mod) {
      setEditModule(mod);
      setModuleForm({ title: mod.title, title_bn: mod.title_bn || "", sort_order: String(mod.sort_order), is_free: mod.is_free });
    } else {
      setEditModule(null);
      setModuleForm({ title: "", title_bn: "", sort_order: String(modules.length), is_free: false });
    }
    setShowModuleForm(true);
  };

  const saveModule = async (e: React.FormEvent) => {
    e.preventDefault();
    setModuleSaving(true);
    try {
      const payload = {
        title: moduleForm.title,
        title_bn: moduleForm.title_bn || undefined,
        sort_order: parseInt(moduleForm.sort_order) || 0,
        is_free: moduleForm.is_free,
      };
      if (editModule) {
        await api.patch(`/courses/modules/${editModule.id}`, payload, accessToken!);
        import("@/stores/toast-store").then(m => m.toast.success("মডিউল আপডেট হয়েছে"));
      } else {
        await api.post(`/courses/${courseId}/modules`, payload, accessToken!);
        import("@/stores/toast-store").then(m => m.toast.success("মডিউল তৈরি হয়েছে"));
      }
      setShowModuleForm(false);
      await loadCourse();
    } catch (err: any) {
      import("@/stores/toast-store").then(m => m.toast.error(err.message || "ত্রুটি"));
    }
    setModuleSaving(false);
  };

  const deleteModule = async (modId: string) => {
    if (!confirm("এই মডিউল এবং এর সব লেসন মুছে ফেলবে?")) return;
    try {
      await api.delete(`/courses/modules/${modId}`, accessToken!);
      import("@/stores/toast-store").then(m => m.toast.success("মডিউল মুছে ফেলা হয়েছে"));
      await loadCourse();
    } catch {
      import("@/stores/toast-store").then(m => m.toast.error("ত্রুটি"));
    }
  };

  // ============================================
  // LESSON CRUD
  // ============================================

  const openLessonForm = (moduleId: string, lesson?: Lesson) => {
    setLessonForModule(moduleId);
    if (lesson) {
      setEditLesson(lesson);
      setLessonForm({
        title: lesson.title,
        title_bn: lesson.title_bn || "",
        lesson_type: lesson.lesson_type?.toLowerCase(),
        sort_order: String(lesson.sort_order),
        duration_seconds: lesson.duration_seconds ? String(lesson.duration_seconds) : "",
        is_free: lesson.is_free,
        youtube_id: lesson.video?.youtube_id || "",
        content: lesson.content || "",
        allow_submission: lesson.allow_submission || false,
        allow_image_upload: lesson.allow_image_upload || false,
        max_grade: String(lesson.max_grade || 10),
      });
    } else {
      setEditLesson(null);
      const mod = modules.find(m => m.id === moduleId);
      setLessonForm({
        title: "", title_bn: "", lesson_type: "video_lecture",
        sort_order: String(mod?.lessons.length || 0),
        duration_seconds: "", is_free: false, youtube_id: "", content: "",
        allow_submission: false, allow_image_upload: false, max_grade: "10",
      });
    }
    setShowLessonForm(true);
  };

  const saveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    setLessonSaving(true);
    try {
      const payload: any = {
        title: lessonForm.title,
        title_bn: lessonForm.title_bn || undefined,
        lesson_type: lessonForm.lesson_type,
        sort_order: parseInt(lessonForm.sort_order) || 0,
        duration_seconds: lessonForm.duration_seconds ? parseInt(lessonForm.duration_seconds) : undefined,
        is_free: lessonForm.is_free,
        youtube_id: lessonForm.youtube_id || undefined,
        content: lessonForm.content || undefined,
        allow_submission: lessonForm.allow_submission,
        allow_image_upload: lessonForm.allow_image_upload,
        max_grade: parseInt(lessonForm.max_grade) || 10,
      };
      if (editLesson) {
        await api.patch(`/courses/lessons/${editLesson.id}`, payload, accessToken!);
        import("@/stores/toast-store").then(m => m.toast.success("লেসন আপডেট হয়েছে"));
      } else {
        await api.post(`/courses/modules/${lessonForModule}/lessons`, payload, accessToken!);
        import("@/stores/toast-store").then(m => m.toast.success("লেসন তৈরি হয়েছে"));
      }
      setShowLessonForm(false);
      await loadCourse();
    } catch (err: any) {
      import("@/stores/toast-store").then(m => m.toast.error(err.message || "ত্রুটি"));
    }
    setLessonSaving(false);
  };

  const deleteLesson = async (lessonId: string) => {
    if (!confirm("এই লেসন মুছে ফেলবে?")) return;
    try {
      await api.delete(`/courses/lessons/${lessonId}`, accessToken!);
      import("@/stores/toast-store").then(m => m.toast.success("লেসন মুছে ফেলা হয়েছে"));
      await loadCourse();
    } catch {
      import("@/stores/toast-store").then(m => m.toast.error("ত্রুটি"));
    }
  };

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
            <Link href="/admin?tab=courses" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="font-bold text-gray-900 font-bn text-lg">
                {course?.product?.title_bn || course?.product?.title || "কোর্স"}
              </h1>
              <p className="text-xs text-gray-400">
                {modules.length} মডিউল • {modules.reduce((t, m) => t + m.lessons.length, 0)} লেসন
              </p>
            </div>
          </div>
          <button
            onClick={() => openModuleForm()}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-700 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 transition-all"
          >
            <Plus className="w-4 h-4" /> মডিউল যোগ করো
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Modules (70%) */}
        <div className="lg:col-span-8">
        {modules.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-bn mb-4">এই কোর্সে এখনো কোনো মডিউল নেই</p>
            <button
              onClick={() => openModuleForm()}
              className="px-5 py-2.5 bg-primary-700 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 transition-all font-bn"
            >
              <Plus className="w-4 h-4 inline mr-1" /> প্রথম মডিউল তৈরি করো
            </button>
          </div>
        )}

        {/* Modules */}
        <div className="space-y-3">
          {modules.map((mod, mi) => {
            const isExpanded = expandedModules.has(mod.id);
            return (
              <div key={mod.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Module Header */}
                <div
                  className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50/50 transition-colors"
                  onClick={() => toggleModule(mod.id)}
                >
                  <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
                  <div className="flex items-center gap-1.5 text-gray-400">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm text-gray-900 font-bn">
                      <span className="text-primary-600 mr-1.5">মডিউল {mi + 1}:</span>
                      {mod.title_bn || mod.title}
                    </h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {mod.lessons.length} লেসন
                      {mod.is_free && <span className="ml-2 text-green-600 font-semibold">ফ্রি</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openLessonForm(mod.id)} className="p-1.5 rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100" title="Add Lesson">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => openModuleForm(mod)} className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100" title="Edit Module">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteModule(mod.id)} className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100" title="Delete Module">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Lessons */}
                {isExpanded && (
                  <div className="border-t border-gray-50">
                    {mod.lessons.length === 0 && (
                      <div className="px-4 py-6 text-center">
                        <p className="text-xs text-gray-400 font-bn mb-2">কোনো লেসন নেই</p>
                        <button
                          onClick={() => openLessonForm(mod.id)}
                          className="text-xs text-primary-600 font-semibold hover:underline font-bn"
                        >
                          + লেসন যোগ করো
                        </button>
                      </div>
                    )}
                    {mod.lessons
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((lesson, li) => {
                        const IconComp = lessonTypeIcons[lesson.lesson_type?.toLowerCase()] || FileText;
                        return (
                          <div
                            key={lesson.id}
                            className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-50 hover:bg-gray-50/30 group transition-colors"
                          >
                            <div className="w-5 text-center">
                              <span className="text-[10px] text-gray-300 font-mono">{li + 1}</span>
                            </div>
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              lesson.lesson_type?.toLowerCase() === "video_lecture"
                                ? "bg-red-50 text-red-500"
                                : lesson.lesson_type?.toLowerCase() === "quiz"
                                ? "bg-purple-50 text-purple-500"
                                : "bg-blue-50 text-blue-500"
                            }`}>
                              <IconComp className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-800 font-bn truncate">
                                {lesson.title_bn || lesson.title}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                                <span className="font-semibold">{lessonTypeLabels[lesson.lesson_type?.toLowerCase()] || lesson.lesson_type}</span>
                                {lesson.duration_seconds && (
                                  <span>{Math.ceil(lesson.duration_seconds / 60)} মিনিট</span>
                                )}
                                {lesson.is_free && <span className="text-green-600 font-bold">ফ্রি</span>}
                                {lesson.video?.youtube_id && (
                                  <span className="text-red-500 flex items-center gap-0.5">
                                    <Youtube className="w-3 h-3" /> {lesson.video.youtube_id}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              {lesson.lesson_type?.toLowerCase() === 'quiz' && (
                                <button onClick={() => openQuizEditor(lesson)} className="px-2 py-1 rounded bg-purple-50 text-purple-600 hover:bg-purple-100 flex items-center gap-1 text-[10px] font-bold font-bn border border-purple-100 transition-colors">
                                  <Edit3 className="w-3 h-3" /> কুইজ এডিট
                                </button>
                              )}
                              {lesson.lesson_type?.toLowerCase() === 'assignment' && lesson.allow_submission && (
                                <button onClick={() => openSubmissions(lesson)} className="px-2 py-1 rounded bg-green-50 text-green-600 hover:bg-green-100 flex items-center gap-1 text-[10px] font-bold font-bn">
                                  <MessageSquare className="w-3 h-3" /> সাবমিশনস
                                </button>
                              )}
                              <button onClick={() => openLessonForm(mod.id, lesson)} className="p-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100">
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button onClick={() => deleteLesson(lesson.id)} className="p-1 rounded bg-red-50 text-red-500 hover:bg-red-100">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    {/* Add lesson button at the bottom of the module */}
                    <div className="px-4 py-2 border-t border-gray-50">
                      <button
                        onClick={() => openLessonForm(mod.id)}
                        className="text-xs text-primary-600 font-semibold hover:text-primary-700 font-bn flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> লেসন যোগ করো
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        </div>

        {/* Right Column: Resources + Feedback (30%) */}
        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-20 lg:self-start">
          {/* Resources Section */}
          {course && (
            <ResourceManager
              courseId={courseId as string}
              modules={(course.modules || []).map((m: any) => ({
                id: m.id,
                title: m.title,
                title_bn: m.title_bn,
                lessons: (m.lessons || []).map((l: any) => ({
                  id: l.id,
                  title: l.title,
                  title_bn: l.title_bn,
                })),
              }))}
            />
          )}

          {/* Exam Attachments */}
          {course && (
            <ExamAttachment productId={course.product?.id || course.product_id} />
          )}

          {/* Guardian Feedback Section */}
          {course && (
            <AdminFeedbackSection courseId={courseId as string} />
          )}
        </div>
        </div>
      </main>

      {/* ===== Module Form Modal ===== */}
      {showModuleForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModuleForm(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold font-bn">{editModule ? "মডিউল এডিট" : "নতুন মডিউল"}</h2>
              <button onClick={() => setShowModuleForm(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveModule} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Title (English)</label>
                <input value={moduleForm.title} onChange={e => setModuleForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">নাম (বাংলা)</label>
                <input value={moduleForm.title_bn} onChange={e => setModuleForm(p => ({ ...p, title_bn: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Sort Order</label>
                  <input type="number" value={moduleForm.sort_order} onChange={e => setModuleForm(p => ({ ...p, sort_order: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none" />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={moduleForm.is_free} onChange={e => setModuleForm(p => ({ ...p, is_free: e.target.checked }))} className="rounded" />
                    <span className="font-bn">ফ্রি</span>
                  </label>
                </div>
              </div>
              <button type="submit" disabled={moduleSaving}
                className="w-full py-2.5 bg-primary-700 text-white font-semibold rounded-xl hover:bg-primary-800 transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {moduleSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editModule ? "আপডেট করো" : "তৈরি করো"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===== Lesson Form Modal ===== */}
      {showLessonForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowLessonForm(false)}>
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold font-bn">{editLesson ? "লেসন এডিট" : "নতুন লেসন"}</h2>
              <button onClick={() => setShowLessonForm(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveLesson} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Title (English)</label>
                <input value={lessonForm.title} onChange={e => setLessonForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">নাম (বাংলা)</label>
                <input value={lessonForm.title_bn} onChange={e => setLessonForm(p => ({ ...p, title_bn: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
                  <select value={lessonForm.lesson_type} onChange={e => setLessonForm(p => ({ ...p, lesson_type: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none">
                    <option value="video_lecture">Video Lecture</option>
                    <option value="smart_note">Smart Note</option>
                    <option value="assignment">Assignment</option>
                    <option value="quiz">Quiz</option>
                    <option value="live_session">Live Session</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Sort Order</label>
                  <input type="number" value={lessonForm.sort_order} onChange={e => setLessonForm(p => ({ ...p, sort_order: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none" />
                </div>
              </div>

              {/* YouTube ID — only for video lectures */}
              {lessonForm.lesson_type === "video_lecture" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                    <Youtube className="w-3.5 h-3.5 text-red-500" /> YouTube Video ID
                  </label>
                  <input
                    value={lessonForm.youtube_id}
                    onChange={e => {
                      // Extract ID from full URL if pasted
                      let val = e.target.value;
                      const match = val.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
                      if (match) val = match[1];
                      setLessonForm(p => ({ ...p, youtube_id: val }));
                    }}
                    placeholder="dQw4w9WgXcQ or full YouTube URL"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary-400 font-mono"
                  />
                  {lessonForm.youtube_id && (
                    <div className="mt-2 rounded-lg overflow-hidden border border-gray-200">
                      <img
                        src={`https://img.youtube.com/vi/${lessonForm.youtube_id}/mqdefault.jpg`}
                        alt="YouTube thumbnail"
                        className="w-full h-32 object-cover"
                        onError={e => (e.currentTarget.style.display = "none")}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Duration (seconds)</label>
                  <input type="number" value={lessonForm.duration_seconds} onChange={e => setLessonForm(p => ({ ...p, duration_seconds: e.target.value }))}
                    placeholder="600" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none" />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={lessonForm.is_free} onChange={e => setLessonForm(p => ({ ...p, is_free: e.target.checked }))} className="rounded" />
                    <span className="font-bn">ফ্রি প্রিভিউ</span>
                  </label>
                </div>
              </div>

              {/* Assignment Settings */}
              {(lessonForm.lesson_type === 'assignment') && (
                <div className="bg-orange-50/50 rounded-xl p-4 border border-orange-100 space-y-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={lessonForm.allow_submission} onChange={e => setLessonForm(p => ({ ...p, allow_submission: e.target.checked }))} className="rounded" />
                    <span className="font-bn font-semibold text-orange-800">সাবমিশন চালু করুন</span>
                  </label>
                  {lessonForm.allow_submission && (
                    <div className="space-y-3 pt-2 border-t border-orange-100/50">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={lessonForm.allow_image_upload} onChange={e => setLessonForm(p => ({ ...p, allow_image_upload: e.target.checked }))} className="rounded" />
                        <span className="font-bn text-orange-900">ছবি আপলোড চালু করুন</span>
                      </label>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">সর্বোচ্চ গ্রেড</label>
                        <input type="number" value={lessonForm.max_grade} onChange={e => setLessonForm(p => ({ ...p, max_grade: e.target.value }))}
                          min="1" max="100" className="w-24 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Rich Text Content */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 font-bn">কন্টেন্ট</label>
                <Suspense fallback={
                  <div className="border border-gray-200 rounded-xl p-8 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                }>
                  <RichTextEditor
                    value={lessonForm.content}
                    onChange={(html) => setLessonForm(p => ({ ...p, content: html }))}
                    placeholder="লেসনের কন্টেন্ট লিখুন..."
                  />
                </Suspense>
              </div>

              <button type="submit" disabled={lessonSaving}
                className="w-full py-2.5 bg-primary-700 text-white font-semibold rounded-xl hover:bg-primary-800 transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {lessonSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editLesson ? "আপডেট করো" : "তৈরি করো"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===== Submissions Modal ===== */}
      {showSubmissions && activeLessonSubmissions && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowSubmissions(false)}>
          <div className="bg-white rounded-2xl max-w-3xl w-full flex flex-col max-h-[90vh] shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50">
              <div>
                <h2 className="text-xl font-bold font-bn text-gray-900">সাবমিশনস: {activeLessonSubmissions.title_bn || activeLessonSubmissions.title}</h2>
                <p className="text-sm text-gray-500 font-bn mt-1">সর্বোচ্চ গ্রেড: {activeLessonSubmissions.max_grade || 10}</p>
              </div>
              <button onClick={() => setShowSubmissions(false)} className="p-2 hover:bg-gray-200 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="overflow-y-auto p-5 flex-1 bg-gray-50/50">
              {loadingSubmissions ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                </div>
              ) : submissionsList.length === 0 ? (
                <div className="text-center py-20">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-bn text-lg">এখনও কোনো সাবমিশন আসেনি</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {submissionsList.map(sub => (
                    <div key={sub.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-zinc-50">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary-100 flex flex-col items-center justify-center text-primary-700 font-bold font-bn text-sm">
                            স্টুডেন্ট
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 font-bn leading-tight">{sub.child_name || 'অজানা স্টুডেন্ট'}</p>
                            <span className="text-[10px] text-gray-500 font-mono">আইডি: {sub.child_profile_id.substring(0, 8)}...</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${
                            sub.status === 'graded' ? 'bg-green-50 text-green-700 border-green-200' : 
                            'bg-amber-50 text-amber-700 border-amber-200'
                          } font-bn`}>
                            {sub.status === 'graded' ? 'গ্রেডিং সম্পন্ন' : 'রিভিউ বাকি'}
                          </span>
                          {sub.status === 'graded' && (
                            <p className="text-sm font-bold text-green-700 mt-1 font-bn">গ্রেড: {sub.grade}/{activeLessonSubmissions.max_grade || 10}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="p-5">
                        <div className="mb-4">
                          <p className="text-xs font-bold text-gray-400 mb-2 font-bn">উত্তর:</p>
                          <div className="bg-gray-50 rounded-lg p-4 text-gray-800 font-bn whitespace-pre-wrap text-sm border border-gray-100">
                            {sub.answer_text || "কোনো টেক্সট উত্তর নেই"}
                          </div>
                        </div>
                        
                        {sub.file_urls && sub.file_urls.length > 0 && (
                          <div className="mb-5">
                            <p className="text-xs font-bold text-gray-400 mb-2 font-bn">সংযুক্ত ছবি:</p>
                            <div className="flex flex-wrap gap-3">
                              {sub.file_urls.map((url: string, i: number) => (
                                <a key={i} href={url} target="_blank" rel="noreferrer" className="block relative group">
                                  <img src={url} alt={`Submission file`} className="w-24 h-24 object-cover rounded-lg border border-gray-200 group-hover:border-primary-400 transition-colors" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="pt-4 border-t border-gray-100">
                          {gradeForm.id === sub.id ? (
                            <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100 space-y-3">
                              <div className="flex items-center gap-3">
                                <label className="text-sm font-bold text-gray-700 font-bn whitespace-nowrap">গ্রেড প্রদান:</label>
                                <input 
                                  type="number" 
                                  min="0" 
                                  max={activeLessonSubmissions.max_grade || 10} 
                                  value={gradeForm.grade}
                                  onChange={e => setGradeForm(prev => ({ ...prev, grade: e.target.value }))}
                                  className="w-20 px-3 py-1.5 rounded-lg border border-gray-200 outline-none focus:border-primary-400 text-center"
                                  placeholder="0"
                                />
                                <span className="text-gray-500 font-bn">/ {activeLessonSubmissions.max_grade || 10}</span>
                              </div>
                              <div>
                                <textarea 
                                  value={gradeForm.feedback}
                                  onChange={e => setGradeForm(prev => ({ ...prev, feedback: e.target.value }))}
                                  placeholder="ফিডব্যাক লিখুন (অপশনাল)..."
                                  className="w-full h-20 px-4 py-3 rounded-xl border border-gray-200 outline-none focus:border-primary-400 resize-none font-bn text-sm"
                                />
                              </div>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => submitGrade(sub.id)}
                                  disabled={!gradeForm.grade}
                                  className="px-4 py-2 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 text-sm font-bn flex items-center gap-2 disabled:opacity-50"
                                >
                                  <CheckCircle2 className="w-4 h-4" /> গ্রেড সেভ করুন
                                </button>
                                <button onClick={() => setGradeForm({ id: null, grade: "", feedback: "" })} className="px-4 py-2 bg-gray-100 text-gray-600 font-bold rounded-lg hover:bg-gray-200 text-sm font-bn">
                                  বাতিল
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button 
                              onClick={() => setGradeForm({ id: sub.id, grade: sub.grade !== null ? String(sub.grade) : "", feedback: sub.feedback || "" })}
                              className="px-4 py-2 bg-orange-50 text-orange-700 font-bold rounded-lg hover:bg-orange-100 text-sm font-bn flex items-center gap-2 transition-colors border border-orange-200"
                            >
                              <Edit3 className="w-4 h-4" /> 
                              {sub.status === 'graded' ? 'গ্রেড আপডেট করুন' : 'গ্রেড দিন'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Quiz Editor Modal ===== */}
      {showQuizEditor && activeQuizLesson && (
        <Suspense fallback={
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <Loader2 className="w-10 h-10 animate-spin text-white" />
          </div>
        }>
          <QuizEditorModal 
            lessonId={activeQuizLesson.id} 
            lessonName={activeQuizLesson.title_bn || activeQuizLesson.title}
            accessToken={accessToken!}
            onClose={() => setShowQuizEditor(false)}
          />
        </Suspense>
      )}
    </>
  );
}
