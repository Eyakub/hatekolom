"use client";

import { useState, useEffect } from "react";
import { Send, MessageSquare, Loader2, CheckCircle2, Clock, AlertTriangle, Lightbulb, Star, Lock } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/stores/toast-store";

interface Feedback {
  id: string;
  user_id: string;
  user_name: string | null;
  feedback_type: string;
  rating: number | null;
  message: string;
  admin_response: string | null;
  responder_name: string | null;
  responded_at: string | null;
  is_resolved: boolean;
  created_at: string;
}

const FEEDBACK_TYPES = [
  { value: "review", label: "রিভিউ", icon: Star, color: "text-amber-600 bg-amber-50 border-amber-200", isPublic: true },
  { value: "suggestion", label: "পরামর্শ", icon: Lightbulb, color: "text-blue-600 bg-blue-50 border-blue-200", isPublic: false },
  { value: "improvement", label: "উন্নতি", icon: CheckCircle2, color: "text-green-600 bg-green-50 border-green-200", isPublic: false },
  { value: "complaint", label: "অভিযোগ", icon: AlertTriangle, color: "text-red-600 bg-red-50 border-red-200", isPublic: false },
];

const getTypeConfig = (type: string) =>
  FEEDBACK_TYPES.find((t) => t.value === type) || FEEDBACK_TYPES[0];

function StarRating({ value, onChange, readonly = false }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          className={`${readonly ? "cursor-default" : "cursor-pointer hover:scale-110"} transition-transform`}
        >
          <Star
            className={`w-5 h-5 transition-colors ${
              star <= (hover || value)
                ? "text-amber-400 fill-amber-400"
                : "text-gray-200"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export function FeedbackTab({ courseId }: { courseId: string }) {
  const { accessToken } = useAuthStore();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [feedbackType, setFeedbackType] = useState("review");
  const [rating, setRating] = useState(0);

  useEffect(() => {
    if (!accessToken || !courseId) return;
    loadFeedbacks();
  }, [accessToken, courseId]);

  const loadFeedbacks = async () => {
    try {
      const data: any = await api.get(`/feedback/course/${courseId}`, accessToken!);
      setFeedbacks(data);
    } catch {
      setFeedbacks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!message.trim() || submitting) return;
    if (feedbackType === "review" && rating === 0) return;
    if (/https?:\/\/|www\.|[a-z0-9-]+\.(com|org|net|io|dev|co|me|info|biz|xyz|bd|in)\b/i.test(message)) {
      toast.error("লিংক দেওয়া যাবে না");
      return;
    }
    setSubmitting(true);
    try {
      const res: any = await api.post(
        "/feedback/",
        {
          course_id: courseId,
          feedback_type: feedbackType,
          rating: feedbackType === "review" ? rating : null,
          message: message.trim(),
        },
        accessToken!
      );
      setFeedbacks((prev) => [res, ...prev]);
      setMessage("");
      setRating(0);
      setFeedbackType("review");
      toast.success("পাঠানো হয়েছে");
    } catch {
      toast.error("পাঠানো যায়নি");
    } finally {
      setSubmitting(false);
    }
  };

  const reviews = feedbacks.filter((f) => f.feedback_type === "review");
  const privateFeedback = feedbacks.filter((f) => f.feedback_type !== "review");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Submit Form */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm">
        <h3 className="font-bold text-gray-900 font-bn text-lg mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary-600" />
          মতামত দাও
        </h3>

        {/* Type Selector */}
        <div className="flex flex-wrap gap-2 mb-4">
          {FEEDBACK_TYPES.map((t) => {
            const Icon = t.icon;
            const isActive = feedbackType === t.value;
            return (
              <button
                key={t.value}
                onClick={() => setFeedbackType(t.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold font-bn flex items-center gap-1.5 border transition-all ${
                  isActive ? t.color : "text-gray-400 bg-gray-50 border-gray-100 hover:bg-gray-100"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
                {!t.isPublic && <Lock className="w-2.5 h-2.5 opacity-50" />}
              </button>
            );
          })}
        </div>

        {/* Star Rating for reviews */}
        {feedbackType === "review" && (
          <div className="mb-4 flex items-center gap-3">
            <span className="text-sm font-bn text-gray-500">রেটিং:</span>
            <StarRating value={rating} onChange={setRating} />
          </div>
        )}

        {/* Privacy hint for non-review */}
        {feedbackType !== "review" && (
          <p className="text-[11px] text-gray-400 font-bn mb-3 flex items-center gap-1">
            <Lock className="w-3 h-3" />
            এটি শুধুমাত্র তুমি এবং ইনস্ট্রাক্টর দেখতে পারবে
          </p>
        )}

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={feedbackType === "review" ? "এই কোর্স সম্পর্কে তোমার মতামত লিখো..." : "তোমার বক্তব্য এখানে লিখো..."}
          className="w-full min-h-[100px] bg-gray-50 px-4 py-3 rounded-xl border border-gray-200 text-[15px] font-bn text-gray-800 placeholder-gray-400 outline-none focus:bg-white focus:border-primary-300 focus:ring-2 focus:ring-primary-100 transition-all resize-y"
        />

        <div className="flex justify-end mt-3">
          <button
            onClick={handleSubmit}
            disabled={!message.trim() || submitting || (feedbackType === "review" && rating === 0)}
            className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl font-bn text-sm disabled:opacity-40 flex items-center gap-2 shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            পাঠাও
          </button>
        </div>
      </div>

      {/* Public Reviews */}
      {reviews.length > 0 && (
        <div>
          <h4 className="font-bold text-gray-700 font-bn text-sm mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            রিভিউ ({reviews.length})
          </h4>
          <div className="space-y-3">
            {reviews.map((fb) => (
              <FeedbackCard key={fb.id} fb={fb} />
            ))}
          </div>
        </div>
      )}

      {/* Private Feedback */}
      {privateFeedback.length > 0 && (
        <div>
          <h4 className="font-bold text-gray-700 font-bn text-sm mb-3 flex items-center gap-2">
            <Lock className="w-4 h-4 text-gray-400" />
            তোমার ব্যক্তিগত মতামত ({privateFeedback.length})
          </h4>
          <div className="space-y-3">
            {privateFeedback.map((fb) => (
              <FeedbackCard key={fb.id} fb={fb} />
            ))}
          </div>
        </div>
      )}

      {feedbacks.length === 0 && (
        <div className="text-center py-10">
          <MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-bn text-sm">এখনো কোনো মতামত নেই</p>
        </div>
      )}
    </div>
  );
}

function FeedbackCard({ fb }: { fb: Feedback }) {
  const typeConfig = getTypeConfig(fb.feedback_type);
  const TypeIcon = typeConfig.icon;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            {fb.user_name && (
              <span className="text-xs font-semibold text-gray-600">{fb.user_name}</span>
            )}
            <div className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold font-bn flex items-center gap-1 border ${typeConfig.color}`}>
              <TypeIcon className="w-3 h-3" />
              {typeConfig.label}
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-gray-400">
            <Clock className="w-3 h-3" />
            <span className="text-[11px] font-medium">
              {new Date(fb.created_at).toLocaleDateString("bn-BD", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        {/* Star rating display */}
        {fb.feedback_type === "review" && fb.rating && (
          <div className="mb-2">
            <StarRating value={fb.rating} readonly />
          </div>
        )}

        <p className="text-gray-700 font-bn text-[15px] leading-relaxed whitespace-pre-wrap">
          {fb.message}
        </p>
      </div>

      {fb.admin_response && (
        <div className="bg-primary-50/50 border-t border-primary-100/50 px-4 sm:px-5 py-4">
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-5 h-5 rounded-full bg-primary-100 flex items-center justify-center">
              <CheckCircle2 className="w-3 h-3 text-primary-600" />
            </div>
            <span className="text-[11px] font-bold text-primary-600 font-bn">
              ইনস্ট্রাক্টর — {fb.responder_name || "ইনস্ট্রাক্টর"}
            </span>
          </div>
          <p className="text-gray-700 font-bn text-sm leading-relaxed whitespace-pre-wrap">
            {fb.admin_response}
          </p>
        </div>
      )}

      {!fb.admin_response && (
        <div className="bg-gray-50 border-t border-gray-100 px-4 py-2.5 flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-gray-400" />
          <span className="text-[11px] font-bn text-gray-400">ইনস্ট্রাক্টরের প্রতিক্রিয়া অপেক্ষমান</span>
        </div>
      )}
    </div>
  );
}
