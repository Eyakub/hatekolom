"use client";

import { useState, useEffect } from "react";
import { Upload, Link2, Trash2, Edit3, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

interface Resource {
  id: string;
  course_id: string;
  module_id: string | null;
  lesson_id: string | null;
  title: string;
  title_bn: string | null;
  resource_type: "file" | "link";
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  external_url: string | null;
  is_downloadable: boolean;
  sort_order: number;
}

interface ModuleItem {
  id: string;
  title: string;
  title_bn: string | null;
  lessons: { id: string; title: string; title_bn: string | null }[];
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getLevelLabel(r: Resource, modules: ModuleItem[]): { text: string; color: string } {
  if (r.lesson_id) {
    for (const m of modules) {
      const lesson = m.lessons.find((l) => l.id === r.lesson_id);
      if (lesson) return { text: `Lesson: ${lesson.title_bn || lesson.title}`, color: "bg-amber-100 text-amber-700" };
    }
    return { text: "Lesson", color: "bg-amber-100 text-amber-700" };
  }
  if (r.module_id) {
    const mod = modules.find((m) => m.id === r.module_id);
    return { text: `Module: ${mod?.title_bn || mod?.title || ""}`, color: "bg-purple-100 text-purple-700" };
  }
  return { text: "Course Level", color: "bg-blue-100 text-blue-700" };
}

interface Props {
  courseId: string;
  modules: ModuleItem[];
}

export function ResourceManager({ courseId, modules }: Props) {
  const { accessToken } = useAuthStore();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);

  const loadResources = () => {
    if (!accessToken) return;
    const levelParam = filter !== "all" ? `?level=${filter}` : "";
    api.get<Resource[]>(`/resources/courses/${courseId}${levelParam}`, accessToken)
      .then(setResources)
      .catch(() => setResources([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadResources();
  }, [courseId, accessToken, filter]);

  const handleDelete = async (id: string) => {
    if (!accessToken || !confirm("Delete this resource?")) return;
    await api.delete(`/resources/${id}`, accessToken);
    loadResources();
  };

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-200">
        <h3 className="font-bold text-gray-800">Resources</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition"
          >
            <Upload className="w-3.5 h-3.5" /> Upload File
          </button>
          <button
            onClick={() => setShowLinkModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-purple-500 rounded-lg hover:bg-purple-600 transition"
          >
            <Link2 className="w-3.5 h-3.5" /> Add Link
          </button>
        </div>
      </div>

      <div className="flex border-b border-gray-200">
        {[
          { key: "all", label: "All" },
          { key: "course", label: "Course" },
          { key: "module", label: "Module" },
          { key: "lesson", label: "Lesson" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2.5 text-xs font-semibold transition ${
              filter === tab.key
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-2">
        {loading && <div className="text-center py-6 text-gray-400 text-sm">Loading...</div>}
        {!loading && resources.length === 0 && (
          <div className="text-center py-6 text-gray-400 text-sm">No resources yet</div>
        )}
        {resources.map((r) => {
          const level = getLevelLabel(r, modules);
          return (
            <div key={r.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-gray-800">{r.title}</div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${level.color}`}>
                    {level.text}
                  </span>
                  {r.resource_type === "file" && (
                    <>
                      <span className="text-[10px] text-gray-400">{formatSize(r.file_size)}</span>
                      <span className={`text-[10px] font-bold ${r.is_downloadable ? "text-green-500" : "text-red-400"}`}>
                        {r.is_downloadable ? "✓ Downloadable" : "🔒 Preview Only"}
                      </span>
                    </>
                  )}
                  {r.resource_type === "link" && (
                    <span className="text-[10px] text-blue-400">External Link</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDelete(r.id)}
                className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {showUploadModal && (
        <UploadModal
          courseId={courseId}
          modules={modules}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => { setShowUploadModal(false); loadResources(); }}
        />
      )}

      {showLinkModal && (
        <LinkModal
          courseId={courseId}
          modules={modules}
          onClose={() => setShowLinkModal(false)}
          onSuccess={() => { setShowLinkModal(false); loadResources(); }}
        />
      )}
    </div>
  );
}


function UploadModal({
  courseId, modules, onClose, onSuccess,
}: {
  courseId: string; modules: ModuleItem[]; onClose: () => void; onSuccess: () => void;
}) {
  const { accessToken } = useAuthStore();
  const [title, setTitle] = useState("");
  const [titleBn, setTitleBn] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isDownloadable, setIsDownloadable] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const selectedModule = modules.find((m) => m.id === moduleId);

  const handleSubmit = async () => {
    if (!accessToken || !file || !title) return;
    setSubmitting(true);
    const formData = new FormData();
    formData.append("title", title);
    if (titleBn) formData.append("title_bn", titleBn);
    if (moduleId) formData.append("module_id", moduleId);
    if (lessonId) formData.append("lesson_id", lessonId);
    formData.append("is_downloadable", String(isDownloadable));
    formData.append("sort_order", "0");
    formData.append("file", file);

    try {
      await api.postFormData(`/resources/courses/${courseId}/upload`, formData, accessToken);
      onSuccess();
    } catch {
      alert("Upload failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800">Upload File</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Title (English)</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="e.g. Course Syllabus" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Title (Bengali)</label>
            <input value={titleBn} onChange={(e) => setTitleBn(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm font-bn" placeholder="e.g. কোর্স সিলেবাস" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Attach To</label>
            <div className="flex gap-2 mt-1">
              <select value={moduleId} onChange={(e) => { setModuleId(e.target.value); setLessonId(""); }} className="flex-1 px-3 py-2 border rounded-lg text-sm">
                <option value="">Course Level</option>
                {modules.map((m) => <option key={m.id} value={m.id}>{m.title_bn || m.title}</option>)}
              </select>
              {moduleId && selectedModule && (
                <select value={lessonId} onChange={(e) => setLessonId(e.target.value)} className="flex-1 px-3 py-2 border rounded-lg text-sm">
                  <option value="">— No lesson —</option>
                  {selectedModule.lessons.map((l) => <option key={l.id} value={l.id}>{l.title_bn || l.title}</option>)}
                </select>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">File</label>
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full mt-1 text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border file:border-gray-200 file:text-sm file:font-semibold file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100 file:cursor-pointer cursor-pointer" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isDownloadable} onChange={(e) => setIsDownloadable(e.target.checked)} />
            Allow download
          </label>
          <button
            onClick={handleSubmit}
            disabled={!title || !file || submitting}
            className="w-full py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition disabled:opacity-50 text-sm"
          >
            {submitting ? "Uploading..." : "Upload Resource"}
          </button>
        </div>
      </div>
    </div>
  );
}


function LinkModal({
  courseId, modules, onClose, onSuccess,
}: {
  courseId: string; modules: ModuleItem[]; onClose: () => void; onSuccess: () => void;
}) {
  const { accessToken } = useAuthStore();
  const [title, setTitle] = useState("");
  const [titleBn, setTitleBn] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedModule = modules.find((m) => m.id === moduleId);

  const handleSubmit = async () => {
    if (!accessToken || !title || !url) return;
    setSubmitting(true);
    try {
      await api.post(`/resources/courses/${courseId}/link`, {
        title, title_bn: titleBn || null,
        module_id: moduleId || null, lesson_id: lessonId || null,
        external_url: url, sort_order: 0,
      }, accessToken);
      onSuccess();
    } catch {
      alert("Failed to add link");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800">Add External Link</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Title (English)</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="e.g. Official Docs" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Title (Bengali)</label>
            <input value={titleBn} onChange={(e) => setTitleBn(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm font-bn" placeholder="e.g. অফিসিয়াল ডকুমেন্টেশন" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Attach To</label>
            <div className="flex gap-2 mt-1">
              <select value={moduleId} onChange={(e) => { setModuleId(e.target.value); setLessonId(""); }} className="flex-1 px-3 py-2 border rounded-lg text-sm">
                <option value="">Course Level</option>
                {modules.map((m) => <option key={m.id} value={m.id}>{m.title_bn || m.title}</option>)}
              </select>
              {moduleId && selectedModule && (
                <select value={lessonId} onChange={(e) => setLessonId(e.target.value)} className="flex-1 px-3 py-2 border rounded-lg text-sm">
                  <option value="">— No lesson —</option>
                  {selectedModule.lessons.map((l) => <option key={l.id} value={l.id}>{l.title_bn || l.title}</option>)}
                </select>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">URL</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="https://..." />
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
            External links always open in a new tab.
          </div>
          <button
            onClick={handleSubmit}
            disabled={!title || !url || submitting}
            className="w-full py-2 bg-purple-500 text-white font-bold rounded-lg hover:bg-purple-600 transition disabled:opacity-50 text-sm"
          >
            {submitting ? "Adding..." : "Add Link"}
          </button>
        </div>
      </div>
    </div>
  );
}
