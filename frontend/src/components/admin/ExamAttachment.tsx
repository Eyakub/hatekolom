"use client";

import { useState, useEffect } from "react";
import { GraduationCap, Link as LinkIcon, X, Loader2, Search, Clock, Layers, FileText } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useLocaleStore } from "@/stores/locale-store";

interface AttachedExam {
  id: string;
  exam_id: string;
  title: string;
  title_bn: string | null;
  exam_type: string;
  total_sections: number;
  total_questions: number;
  time_limit_seconds: number | null;
}

export function ExamAttachment({ productId }: { productId: string }) {
  const { accessToken } = useAuthStore();
  const { locale } = useLocaleStore();
  const t = (bn: string, en: string) => locale === "bn" ? bn : en;

  const [attached, setAttached] = useState<AttachedExam[]>([]);
  const [allExams, setAllExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [attaching, setAttaching] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !productId) return;
    loadData();
  }, [accessToken, productId]);

  const loadData = async () => {
    try {
      // Load all exams
      const exams: any = await api.get("/exams/", accessToken!);
      setAllExams(Array.isArray(exams) ? exams : []);

      // Load attached exams for this product
      // We check which exams have this product attached via ProductExam
      // For now, filter from the full list using a dedicated endpoint or check
      // We'll use a simple approach: load all and mark attached ones
      const attachedRes: any = await api.get(`/exams/product/${productId}/attached`, accessToken!).catch(() => []);
      setAttached(Array.isArray(attachedRes) ? attachedRes : []);
    } catch {
      setAllExams([]);
      setAttached([]);
    } finally {
      setLoading(false);
    }
  };

  const attachExam = async (examId: string) => {
    setAttaching(examId);
    try {
      await api.post(`/exams/${examId}/attach/${productId}`, {}, accessToken!);
      await loadData();
      setSearch("");
      setShowDropdown(false);
    } catch {
      const { toast } = await import("@/stores/toast-store");
      toast.error(t("সংযুক্ত করা যায়নি", "Failed to attach"));
    } finally {
      setAttaching(null);
    }
  };

  const detachExam = async (examId: string) => {
    try {
      await api.delete(`/exams/${examId}/attach/${productId}`, accessToken!);
      setAttached((prev) => prev.filter((e) => e.exam_id !== examId));
    } catch {
      const { toast } = await import("@/stores/toast-store");
      toast.error(t("বিচ্ছিন্ন করা যায়নি", "Failed to detach"));
    }
  };

  const attachedExamIds = new Set(attached.map((a) => a.exam_id));
  const filteredExams = allExams.filter(
    (e) =>
      !attachedExamIds.has(e.id) &&
      (e.title?.toLowerCase().includes(search.toLowerCase()) ||
        e.title_bn?.includes(search))
  );

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <GraduationCap className="w-4 h-4 text-primary-600" />
          <h3 className="font-semibold text-sm">{t("পরীক্ষা সংযুক্তি", "Exam Attachments")}</h3>
        </div>
        <div className="flex justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <GraduationCap className="w-4 h-4 text-primary-600" />
        <h3 className="font-semibold text-sm">{t("পরীক্ষা সংযুক্তি", "Exam Attachments")}</h3>
      </div>

      {/* Attached exams */}
      {attached.length > 0 && (
        <div className="space-y-2 mb-4">
          {attached.map((exam) => (
            <div
              key={exam.exam_id}
              className="flex items-center justify-between gap-2 p-2.5 bg-primary-50/50 rounded-lg border border-primary-100/50"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {locale === "bn" && exam.title_bn ? exam.title_bn : exam.title}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                  <span className="flex items-center gap-0.5">
                    <Layers className="w-2.5 h-2.5" />
                    {exam.total_sections}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <FileText className="w-2.5 h-2.5" />
                    {exam.total_questions}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    exam.exam_type === "scheduled" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                  }`}>
                    {exam.exam_type === "scheduled" ? t("নির্ধারিত", "Scheduled") : t("যেকোনো সময়", "Anytime")}
                  </span>
                </div>
              </div>
              <button
                onClick={() => detachExam(exam.exam_id)}
                className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search + attach */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              placeholder={t("পরীক্ষা খুঁজো...", "Search exams...")}
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-xs outline-none focus:border-primary-300"
            />
          </div>
        </div>

        {/* Dropdown */}
        {showDropdown && search.trim() && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border border-gray-200 shadow-lg z-20 max-h-60 overflow-y-auto">
            {filteredExams.length === 0 ? (
              <p className="p-3 text-xs text-gray-400 text-center">{t("কোনো পরীক্ষা পাওয়া যায়নি", "No exams found")}</p>
            ) : (
              filteredExams.map((exam) => (
                <button
                  key={exam.id}
                  onClick={() => attachExam(exam.id)}
                  disabled={attaching === exam.id}
                  className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">
                      {locale === "bn" && exam.title_bn ? exam.title_bn : exam.title}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                      <span>{exam.total_sections} {t("সেকশন", "sections")}</span>
                      <span>{exam.total_questions} {t("প্রশ্ন", "questions")}</span>
                    </div>
                  </div>
                  {attaching === exam.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-600 shrink-0" />
                  ) : (
                    <LinkIcon className="w-3.5 h-3.5 text-primary-600 shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Click outside to close */}
      {showDropdown && (
        <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
      )}

      {attached.length === 0 && !showDropdown && (
        <p className="text-[11px] text-gray-400 mt-2">{t("কোনো পরীক্ষা সংযুক্ত নেই", "No exams attached")}</p>
      )}
    </div>
  );
}
