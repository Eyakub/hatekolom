"use client";

import { useState, useEffect } from "react";
import { Download, Eye, ExternalLink, FileText, Image, Archive, Link2, X } from "lucide-react";
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mime: string | null, resourceType: string) {
  if (resourceType === "link") return <Link2 className="w-5 h-5 text-purple-600" />;
  if (!mime) return <FileText className="w-5 h-5 text-gray-500" />;
  if (mime === "application/pdf") return <FileText className="w-5 h-5 text-red-500" />;
  if (mime.startsWith("image/")) return <Image className="w-5 h-5 text-blue-500" />;
  if (mime.includes("zip") || mime.includes("archive")) return <Archive className="w-5 h-5 text-amber-500" />;
  return <FileText className="w-5 h-5 text-gray-500" />;
}

function getFileLabel(mime: string | null, resourceType: string, fileSize: number | null): string {
  if (resourceType === "link") return "External Link";
  const size = fileSize ? ` • ${formatFileSize(fileSize)}` : "";
  if (!mime) return `File${size}`;
  if (mime === "application/pdf") return `PDF${size}`;
  if (mime.startsWith("image/")) return `Image${size}`;
  if (mime.includes("zip")) return `Archive${size}`;
  return `File${size}`;
}

function isPreviewable(mime: string | null): boolean {
  if (!mime) return false;
  return mime === "application/pdf" || mime.startsWith("image/");
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1";

export function ResourceList({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const { accessToken } = useAuthStore();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewResource, setPreviewResource] = useState<Resource | null>(null);

  useEffect(() => {
    if (!accessToken || !lessonId) return;
    setLoading(true);
    api.get<Resource[]>(`/resources/courses/${courseId}/lesson/${lessonId}`, accessToken)
      .then(setResources)
      .catch(() => setResources([]))
      .finally(() => setLoading(false));
  }, [courseId, lessonId, accessToken]);

  const handleDownload = (resource: Resource) => {
    if (!accessToken) return;
    const url = `${API_BASE}/resources/${resource.id}/download`;
    fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(res => res.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.setAttribute("download", resource.file_name || "download");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      });
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-400 text-sm font-bn">লোড হচ্ছে...</div>;
  }

  if (resources.length === 0) {
    return <div className="text-center py-8 text-gray-400 text-sm font-bn">এই লেসনে কোনো রিসোর্স নেই</div>;
  }

  return (
    <>
      <div className="space-y-3">
        {resources.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100"
          >
            <div className="w-10 h-10 rounded-lg bg-white border border-gray-100 flex items-center justify-center flex-shrink-0">
              {getFileIcon(r.mime_type, r.resource_type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-gray-800 truncate">
                {r.title_bn || r.title}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {getFileLabel(r.mime_type, r.resource_type, r.file_size)}
              </div>
            </div>
            <div className="flex-shrink-0">
              {r.resource_type === "link" && r.external_url && (
                <a
                  href={r.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 transition font-bn"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> ওপেন
                </a>
              )}
              {r.resource_type === "file" && r.is_downloadable && (
                <button
                  onClick={() => handleDownload(r)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition font-bn"
                >
                  <Download className="w-3.5 h-3.5" /> ডাউনলোড
                </button>
              )}
              {r.resource_type === "file" && !r.is_downloadable && isPreviewable(r.mime_type) && (
                <button
                  onClick={() => setPreviewResource(r)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition font-bn"
                >
                  <Eye className="w-3.5 h-3.5" /> প্রিভিউ
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {previewResource && (
        <PreviewModal
          resource={previewResource}
          accessToken={accessToken}
          onClose={() => setPreviewResource(null)}
        />
      )}
    </>
  );
}

function PreviewModal({
  resource, accessToken, onClose,
}: {
  resource: Resource; accessToken: string | null; onClose: () => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    fetch(`${API_BASE}/resources/${resource.id}/preview`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((res) => res.blob())
      .then((blob) => setBlobUrl(URL.createObjectURL(blob)));

    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [resource.id, accessToken]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <span className="font-bold text-sm text-gray-800 truncate">
            {resource.file_name}
          </span>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-gray-900 flex items-center justify-center">
          {!blobUrl ? (
            <div className="text-gray-400 text-sm font-bn">লোড হচ্ছে...</div>
          ) : resource.mime_type === "application/pdf" ? (
            <iframe
              src={`${blobUrl}#toolbar=0`}
              className="w-full h-full min-h-[70vh]"
              title={resource.file_name || "PDF Preview"}
            />
          ) : (
            <img
              src={blobUrl}
              alt={resource.title}
              className="max-w-full max-h-[80vh] object-contain"
            />
          )}
        </div>
      </div>
    </div>
  );
}
