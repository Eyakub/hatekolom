"use client";

import { useState, useEffect } from "react";
import {
  MessageSquare, Send, Loader2, CheckCircle2, Clock, ChevronDown,
  AlertTriangle, Lightbulb, Star, X,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

interface Feedback {
  id: string;
  user_name: string | null;
  feedback_type: string;
  message: string;
  admin_response: string | null;
  responder_name: string | null;
  responded_at: string | null;
  is_resolved: boolean;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  review: { label: "রিভিউ", icon: Star, color: "text-amber-700 bg-amber-50 border-amber-200" },
  suggestion: { label: "পরামর্শ", icon: Lightbulb, color: "text-blue-700 bg-blue-50 border-blue-200" },
  improvement: { label: "উন্নতি", icon: CheckCircle2, color: "text-green-700 bg-green-50 border-green-200" },
  complaint: { label: "অভিযোগ", icon: AlertTriangle, color: "text-red-700 bg-red-50 border-red-200" },
};

export function AdminFeedbackSection({ courseId }: { courseId: string }) {
  const { accessToken } = useAuthStore();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [markResolved, setMarkResolved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!accessToken || !courseId) return;
    loadFeedbacks();
  }, [accessToken, courseId]);

  const loadFeedbacks = async () => {
    try {
      const data: any = await api.get(`/feedback/course/${courseId}/all`, accessToken!);
      setFeedbacks(data);
    } catch {
      setFeedbacks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (feedbackId: string) => {
    if (!responseText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res: any = await api.put(
        `/feedback/${feedbackId}/respond`,
        { admin_response: responseText.trim(), is_resolved: markResolved },
        accessToken!
      );
      setFeedbacks((prev) =>
        prev.map((f) => (f.id === feedbackId ? res : f))
      );
      setRespondingId(null);
      setResponseText("");
      setMarkResolved(false);
    } catch {
      import("@/stores/toast-store").then((m) => m.toast.error("Response failed"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary-600" />
          Guardian Feedback
          {feedbacks.length > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-primary-50 text-primary-700 text-xs font-bold rounded-full">
              {feedbacks.length}
            </span>
          )}
        </h2>
      </div>

      {feedbacks.length === 0 ? (
        <div className="p-8 text-center">
          <MessageSquare className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No feedback yet</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {feedbacks.map((fb) => {
            const config = TYPE_CONFIG[fb.feedback_type] || TYPE_CONFIG.review;
            const TypeIcon = config.icon;
            const isResponding = respondingId === fb.id;

            return (
              <div key={fb.id} className="p-4 sm:p-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-gray-800">
                      {fb.user_name || "Unknown"}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${config.color}`}>
                      <TypeIcon className="w-2.5 h-2.5 inline mr-0.5" />
                      {config.label}
                    </span>
                    {fb.is_resolved && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-600 border border-green-200">
                        Resolved
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-gray-400 shrink-0">
                    {new Date(fb.created_at).toLocaleDateString("en-US", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>

                {/* Message */}
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-bn">
                  {fb.message}
                </p>

                {/* Existing Response */}
                {fb.admin_response && (
                  <div className="mt-3 bg-primary-50/50 rounded-lg px-4 py-3 border border-primary-100/50">
                    <p className="text-[10px] font-bold text-primary-600 uppercase tracking-wider mb-1">
                      Response by Instructor — {fb.responder_name || "Instructor"}
                    </p>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {fb.admin_response}
                    </p>
                  </div>
                )}

                {/* Response Form */}
                {isResponding ? (
                  <div className="mt-3 space-y-3">
                    <textarea
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      placeholder="Write your response..."
                      autoFocus
                      className="w-full min-h-[80px] bg-gray-50 px-3 py-2.5 rounded-lg border border-gray-200 text-sm outline-none focus:bg-white focus:border-primary-300 focus:ring-2 focus:ring-primary-100 transition-all resize-y"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-xs text-gray-500">
                        <input
                          type="checkbox"
                          checked={markResolved}
                          onChange={(e) => setMarkResolved(e.target.checked)}
                          className="rounded"
                        />
                        Mark as resolved
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setRespondingId(null); setResponseText(""); }}
                          className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleRespond(fb.id)}
                          disabled={!responseText.trim() || submitting}
                          className="px-4 py-1.5 bg-primary-600 text-white text-xs font-bold rounded-lg hover:bg-primary-700 disabled:opacity-40 flex items-center gap-1.5 transition-all"
                        >
                          {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3">
                    <button
                      onClick={() => {
                        setRespondingId(fb.id);
                        setResponseText(fb.admin_response || "");
                        setMarkResolved(fb.is_resolved);
                      }}
                      className="text-xs text-primary-600 hover:text-primary-700 font-semibold hover:bg-primary-50 px-2 py-1 rounded-lg transition-all"
                    >
                      {fb.admin_response ? "Edit Response" : "Respond"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
