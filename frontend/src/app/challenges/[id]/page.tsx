"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth-store";
import { useLocaleStore } from "@/stores/locale-store";
import { api } from "@/lib/api";
import { toast } from "@/stores/toast-store";
import DrawingCanvas from "@/components/drawing/DrawingCanvas";
import {
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  ImageIcon,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Challenge {
  id: string;
  title: string;
  title_bn: string | null;
  description: string | null;
  description_bn: string | null;
  reference_image_url: string | null;
  challenge_type: string;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
  submission_count?: number;
}

interface Submission {
  id: string;
  image_url: string;
  title: string | null;
  title_bn: string | null;
  status: "pending" | "approved" | "rejected";
  challenge_id: string;
  child_profile_id: string;
}

interface Child {
  id: string;
  full_name: string;
  full_name_bn?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDeadline(dateStr: string, locale: "bn" | "en"): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(locale === "bn" ? "bn-BD" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function isExpired(dateStr: string): boolean {
  return new Date(dateStr) < new Date();
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({
  status,
  t,
}: {
  status: "pending" | "approved" | "rejected";
  t: (bn: string, en: string) => string;
}) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold border border-green-200">
        <CheckCircle size={13} />
        {t("অনুমোদিত", "Approved")}
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-bold border border-red-200">
        <XCircle size={13} />
        {t("প্রত্যাখ্যাত", "Rejected")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold border border-amber-200">
      <Clock size={13} />
      {t("অপেক্ষারত", "Pending")}
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ChallengeDetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 bg-amber-200 rounded-xl w-3/4" />
      <div className="h-56 bg-amber-100 rounded-2xl w-full sm:w-80" />
      <div className="space-y-2">
        <div className="h-4 bg-amber-100 rounded w-full" />
        <div className="h-4 bg-amber-100 rounded w-5/6" />
        <div className="h-4 bg-amber-100 rounded w-4/6" />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChallengeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const { user, accessToken, isAuthenticated, _hasHydrated } = useAuthStore();
  const { t, locale } = useLocaleStore();

  // Challenge data
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loadingChallenge, setLoadingChallenge] = useState(true);

  // Children
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState("");

  // Existing submission check
  const [existingSubmission, setExistingSubmission] = useState<Submission | null | undefined>(
    undefined // undefined = not yet checked
  );
  const [checkingSubmission, setCheckingSubmission] = useState(false);

  // Save flow
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [showTitleModal, setShowTitleModal] = useState(false);
  const [drawingTitle, setDrawingTitle] = useState("");
  const [saving, setSaving] = useState(false);

  // Post-save success state
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── Fetch challenge ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    const fetchChallenge = async () => {
      setLoadingChallenge(true);
      try {
        const data = await api.get<Challenge>(`/challenges/${id}`);
        setChallenge(data);
      } catch {
        setChallenge(null);
      } finally {
        setLoadingChallenge(false);
      }
    };
    fetchChallenge();
  }, [id]);

  // ── Load children (only when authenticated) ──────────────────────────────────
  useEffect(() => {
    if (!accessToken) return;
    const loadChildren = async () => {
      try {
        const data: any = await api.get("/children/", accessToken);
        const list: Child[] = Array.isArray(data) ? data : data?.items || [];
        setChildren(list);
        if (list.length === 1) setSelectedChild(list[0].id);
      } catch {
        // silently ignore
      }
    };
    loadChildren();
  }, [accessToken]);

  // ── Check existing submission when child is selected ────────────────────────
  useEffect(() => {
    if (!accessToken || !selectedChild || !id) {
      setExistingSubmission(undefined);
      return;
    }
    const checkSubmission = async () => {
      setCheckingSubmission(true);
      try {
        const data = await api.get<Submission>(
          `/challenges/${id}/my-submission?child_profile_id=${selectedChild}`,
          accessToken
        );
        setExistingSubmission(data ?? null);
      } catch (err: any) {
        // 404 means no submission yet — that's expected
        if (err?.status === 404 || err?.message?.includes("404")) {
          setExistingSubmission(null);
        } else {
          setExistingSubmission(null);
        }
      } finally {
        setCheckingSubmission(false);
      }
    };
    checkSubmission();
  }, [accessToken, selectedChild, id]);

  // ── Canvas save handler ─────────────────────────────────────────────────────
  const handleSave = useCallback((blob: Blob) => {
    setPendingBlob(blob);
    setDrawingTitle("");
    setShowTitleModal(true);
  }, []);

  // ── Submit after title entered ──────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!pendingBlob || !accessToken) return;
    setSaving(true);

    try {
      // 1. Upload image
      const fd = new FormData();
      fd.append("file", pendingBlob, "drawing.png");
      fd.append("folder", "drawings");
      const uploadRes: any = await api.postFormData("/uploads/image", fd, accessToken);

      // 2. Save drawing record with challenge_id
      await api.post(
        "/drawings/",
        {
          child_profile_id: selectedChild || undefined,
          image_url: uploadRes.url,
          title: drawingTitle.trim() || undefined,
          title_bn: drawingTitle.trim() || undefined,
          challenge_id: id,
        },
        accessToken
      );

      // 3. Success
      setShowTitleModal(false);
      setPendingBlob(null);
      setDrawingTitle("");
      setSaveSuccess(true);
      toast.success(
        t(
          "চ্যালেঞ্জে জমা দেওয়া হয়েছে! অভিভাবকের অনুমোদনের অপেক্ষায়।",
          "Submitted to the challenge! Waiting for parent approval."
        )
      );
    } catch {
      toast.error(t("জমা দিতে ব্যর্থ হয়েছে। আবার চেষ্টা করুন।", "Submission failed. Please try again."));
    } finally {
      setSaving(false);
    }
  }, [pendingBlob, accessToken, selectedChild, drawingTitle, id, t]);

  // ── Cancel title modal ──────────────────────────────────────────────────────
  const handleCancelTitle = () => {
    setShowTitleModal(false);
    setPendingBlob(null);
    setDrawingTitle("");
  };

  // ── Wait for hydration before auth check ────────────────────────────────────
  if (!_hasHydrated) {
    return null;
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const challengeTitle = challenge
    ? t(challenge.title_bn || challenge.title, challenge.title)
    : "";
  const challengeDesc = challenge
    ? t(challenge.description_bn || challenge.description || "", challenge.description || "")
    : "";
  const expired = challenge?.ends_at ? isExpired(challenge.ends_at) : false;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 font-bn">
      {/* ── Top bar ── */}
      <div className="sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-amber-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/challenges"
            className="flex items-center gap-1.5 text-amber-600 hover:text-amber-800 font-semibold text-sm transition-colors"
          >
            <ArrowLeft size={17} />
            {t("চ্যালেঞ্জ তালিকা", "Challenges")}
          </Link>

          <div className="flex-1" />

          {/* Child selector — shown only when authenticated and multiple children */}
          {isAuthenticated && children.length > 1 && (
            <select
              value={selectedChild}
              onChange={(e) => {
                setSelectedChild(e.target.value);
                setExistingSubmission(undefined);
                setSaveSuccess(false);
              }}
              className="text-sm border border-amber-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-300 max-w-[180px]"
            >
              <option value="">{t("শিশু বেছে নিন", "Select child")}</option>
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {t(c.full_name_bn || c.full_name, c.full_name)}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-10">

        {/* ── Challenge info section ── */}
        <div className="mb-8">
          {loadingChallenge ? (
            <ChallengeDetailSkeleton />
          ) : !challenge ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">😕</div>
              <h2 className="text-xl font-bold text-gray-700 mb-2">
                {t("চ্যালেঞ্জটি পাওয়া যায়নি।", "Challenge not found.")}
              </h2>
              <Link
                href="/challenges"
                className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-xl bg-amber-400 text-white font-bold text-sm hover:bg-amber-500 transition-colors"
              >
                <ArrowLeft size={15} />
                {t("ফিরে যান", "Go back")}
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-3xl shadow-sm border border-amber-100 overflow-hidden">
              {/* Challenge header gradient band */}
              <div className="bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-400 px-6 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/25 text-white text-xs font-bold backdrop-blur-sm">
                    {challenge.challenge_type}
                  </span>
                  {!challenge.is_active && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-700/40 text-white text-xs font-bold">
                      {t("নিষ্ক্রিয়", "Inactive")}
                    </span>
                  )}
                  {expired && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-600/30 text-white text-xs font-bold">
                      <AlertCircle size={11} />
                      {t("মেয়াদ শেষ", "Expired")}
                    </span>
                  )}
                </div>
              </div>

              {/* Challenge body */}
              <div className="p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row gap-6">
                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800 leading-tight mb-3">
                      {challengeTitle}
                    </h1>

                    {challengeDesc && (
                      <p className="text-gray-600 text-base leading-relaxed mb-5">
                        {challengeDesc}
                      </p>
                    )}

                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      {challenge.ends_at && (
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          <Calendar size={14} className="text-orange-400" />
                          {t("শেষ হবে:", "Deadline:")} {formatDeadline(challenge.ends_at, locale)}
                        </span>
                      )}
                      {typeof challenge.submission_count === "number" && (
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          <Users size={14} className="text-amber-500" />
                          {challenge.submission_count} {t("জমা", "submissions")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Reference image */}
                  {challenge.reference_image_url && (
                    <div className="flex-shrink-0 self-start">
                      <div className="relative">
                        <img
                          src={challenge.reference_image_url}
                          alt={t("রেফারেন্স ছবি", "Reference image")}
                          className="w-full sm:w-56 h-48 sm:h-56 object-cover rounded-2xl shadow-md border-2 border-amber-200"
                        />
                        <span className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 text-white text-[11px] font-semibold backdrop-blur-sm">
                          <ImageIcon size={10} />
                          {t("নমুনা ছবি", "Reference")}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Submission / Canvas section ── */}
        {challenge && (
          <div>
            {/* Not authenticated */}
            {!isAuthenticated ? (
              <div className="bg-white rounded-3xl shadow-sm border border-amber-100 p-8 text-center">
                <div className="text-5xl mb-4">🔐</div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">
                  {t("অংশগ্রহণ করতে লগইন করুন", "Login to Participate")}
                </h2>
                <p className="text-gray-500 text-sm mb-6">
                  {t(
                    "এই চ্যালেঞ্জে আঁকা জমা দিতে আপনাকে লগইন করতে হবে।",
                    "You need to log in to submit your drawing for this challenge."
                  )}
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-extrabold text-sm shadow-md hover:opacity-90 active:scale-95 transition-all"
                >
                  {t("লগইন করুন", "Log In")}
                </Link>
              </div>
            ) : expired ? (
              /* Challenge expired */
              <div className="bg-white rounded-3xl shadow-sm border border-amber-100 p-8 text-center">
                <div className="text-5xl mb-4">⏰</div>
                <h2 className="text-xl font-bold text-gray-700 mb-2">
                  {t("এই চ্যালেঞ্জের সময় শেষ হয়ে গেছে।", "This challenge has ended.")}
                </h2>
                <p className="text-gray-400 text-sm mb-6">
                  {t(
                    "আর জমা দেওয়া সম্ভব নয়। অন্য চ্যালেঞ্জে অংশ নাও!",
                    "Submissions are no longer accepted. Try another challenge!"
                  )}
                </p>
                <Link
                  href="/challenges"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 text-white font-bold text-sm hover:bg-amber-500 transition-colors"
                >
                  <ArrowLeft size={15} />
                  {t("চ্যালেঞ্জ তালিকায় যান", "Browse Challenges")}
                </Link>
              </div>
            ) : saveSuccess ? (
              /* Post-save success screen */
              <div className="bg-white rounded-3xl shadow-sm border border-green-100 p-8 text-center">
                <div className="text-5xl mb-4">🎉</div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">
                  {t("দারুণ! তোমার ছবি জমা হয়েছে!", "Awesome! Your drawing is submitted!")}
                </h2>
                <p className="text-gray-500 text-sm mb-6">
                  {t(
                    "অভিভাবক অনুমোদন করলে তোমার ছবি গ্যালারিতে দেখা যাবে।",
                    "Your drawing will appear in the gallery once a parent approves it."
                  )}
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Link
                    href="/drawings"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-sm shadow-sm hover:opacity-90 transition-opacity"
                  >
                    {t("আমার জমা দেখো", "View My Submissions")}
                  </Link>
                  <Link
                    href="/challenges"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-amber-300 text-amber-700 font-bold text-sm hover:bg-amber-50 transition-colors"
                  >
                    <ArrowLeft size={15} />
                    {t("চ্যালেঞ্জ তালিকায় ফিরুন", "Back to Challenges")}
                  </Link>
                </div>
              </div>
            ) : /* No child selected but there are children */ isAuthenticated && children.length > 1 && !selectedChild ? (
              <div className="bg-white rounded-3xl shadow-sm border border-amber-100 p-8 text-center">
                <div className="text-5xl mb-4">👶</div>
                <h2 className="text-xl font-bold text-gray-700 mb-2">
                  {t("একটি শিশু প্রোফাইল বেছে নিন", "Select a Child Profile")}
                </h2>
                <p className="text-gray-400 text-sm">
                  {t(
                    "কার জন্য আঁকা জমা দিতে চান তা উপরে বেছে নিন।",
                    "Choose which child's profile to submit the drawing for."
                  )}
                </p>
              </div>
            ) : checkingSubmission ? (
              /* Checking submission status */
              <div className="bg-white rounded-3xl shadow-sm border border-amber-100 p-8 text-center">
                <div className="flex justify-center mb-4">
                  <span className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="text-gray-500 text-sm">
                  {t("আগের জমা খোঁজা হচ্ছে...", "Checking previous submissions...")}
                </p>
              </div>
            ) : existingSubmission ? (
              /* Already submitted — show their drawing */
              <div className="bg-white rounded-3xl shadow-sm border border-amber-100 overflow-hidden">
                <div className="bg-gradient-to-r from-green-400 to-teal-400 px-6 py-4">
                  <h2 className="text-white font-extrabold text-lg">
                    {t("তোমার জমা দেওয়া ছবি", "Your Submission")}
                  </h2>
                </div>
                <div className="p-6 sm:p-8">
                  <div className="flex flex-col sm:flex-row gap-6 items-start">
                    {/* Thumbnail */}
                    <div className="flex-shrink-0">
                      <img
                        src={existingSubmission.image_url}
                        alt={t("জমা দেওয়া ছবি", "Submitted drawing")}
                        className="w-48 h-48 object-cover rounded-2xl shadow-md border-2 border-green-200"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="mb-3">
                        <StatusBadge status={existingSubmission.status} t={t} />
                      </div>

                      {existingSubmission.title && (
                        <p className="text-lg font-bold text-gray-800 mb-1">
                          {t(existingSubmission.title_bn || existingSubmission.title, existingSubmission.title)}
                        </p>
                      )}

                      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                        <p className="text-amber-800 font-semibold text-sm flex items-center gap-2">
                          <CheckCircle size={15} className="text-green-500 flex-shrink-0" />
                          {t(
                            "তুমি ইতিমধ্যে এই চ্যালেঞ্জে একটি ছবি জমা দিয়েছ!",
                            "You already submitted for this challenge!"
                          )}
                        </p>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3">
                        <Link
                          href="/drawings"
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-sm shadow-sm hover:opacity-90 transition-opacity"
                        >
                          {t("আমার সব ছবি দেখো", "View My Drawings")}
                        </Link>
                        <Link
                          href="/challenges"
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-amber-300 text-amber-700 font-bold text-sm hover:bg-amber-50 transition-colors"
                        >
                          <ArrowLeft size={15} />
                          {t("চ্যালেঞ্জ তালিকায় ফিরুন", "Back to Challenges")}
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* No existing submission — show canvas */
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-xl">🎨</span>
                  <h2 className="text-lg font-extrabold text-gray-700">
                    {t("তোমার ছবি আঁকো", "Draw Your Entry")}
                  </h2>
                </div>

                {/* Child info strip */}
                {selectedChild && children.length > 0 && (
                  <div className="mb-4 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 font-medium flex items-center gap-2">
                    <span>👶</span>
                    {(() => {
                      const child = children.find((c) => c.id === selectedChild);
                      return child
                        ? t(child.full_name_bn || child.full_name, child.full_name)
                        : t("নির্বাচিত শিশু", "Selected child");
                    })()}
                  </div>
                )}

                <DrawingCanvas
                  onSave={handleSave}
                  challengePrompt={challengeTitle}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Title input modal ── */}
      {showTitleModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={handleCancelTitle}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full flex flex-col gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="text-4xl mb-2">🏆</div>
              <h2 className="text-xl font-bold text-gray-800">
                {t("ছবির নাম দিন", "Name your drawing")}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {t("ঐচ্ছিক — খালি রাখলেও হবে।", "Optional — you can leave it blank.")}
              </p>
            </div>

            <input
              type="text"
              value={drawingTitle}
              onChange={(e) => setDrawingTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !saving) handleSubmit();
              }}
              placeholder={t("যেমন: আমার বাড়ি", "e.g. My house")}
              className="w-full border-2 border-amber-200 rounded-xl px-4 py-3 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-amber-400 transition-colors"
              autoFocus
            />

            <div className="flex gap-3">
              <button
                onClick={handleCancelTitle}
                disabled={saving}
                className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-all disabled:opacity-50"
              >
                {t("বাতিল", "Cancel")}
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-semibold hover:opacity-90 shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t("জমা হচ্ছে...", "Submitting...")}
                  </>
                ) : (
                  t("জমা দিন", "Submit")
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
