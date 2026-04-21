"use client";

import { useState, useEffect, use, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, Play, FileText, BookOpen, CheckCircle2, Lock, Award, Send, ImagePlus, X, ArrowRight, Trophy, Clock, Star, GraduationCap
} from "lucide-react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { SecureVideoPlayer } from "@/components/video/SecureVideoPlayer";
import { CourseAccordion } from "@/components/course/CourseAccordion";
import { ProgressBar } from "@/components/course/ProgressBar";
import { QuizPlayer } from "@/components/quiz/QuizPlayer";
import { ResourceList } from "@/components/course/ResourceList";
import { FeedbackTab } from "@/components/course/FeedbackTab";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";

interface LessonItem {
  id: string;
  title: string;
  title_bn: string | null;
  lesson_type: string;
  sort_order: number;
  duration_seconds: number | null;
  is_free: boolean;
  is_locked: boolean;
  is_completed: boolean;
  watch_seconds: number;
  last_position: number;
  has_video: boolean;
  content?: string | null;
  content_bn?: string | null;
  allow_submission?: boolean;
  max_grade?: number;
  allow_image_upload?: boolean;
}

interface Submission {
  id: string;
  answer_text: string | null;
  file_urls: string[];
  status: string;
  grade: number | null;
  feedback: string | null;
  max_grade: number;
  submitted_at: string | null;
}

function LearnContent({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const searchParams = useSearchParams();
  const childId = searchParams?.get("child");
  const router = useRouter();
  const { isAuthenticated, accessToken } = useAuthStore();

  const [courseData, setCourseData] = useState<any>(null);
  const [activeLesson, setActiveLesson] = useState<LessonItem | null>(null);
  const [videoAccess, setVideoAccess] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isTakingQuiz, setIsTakingQuiz] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "resources" | "feedback">("overview");
  const [quizPreviewInfo, setQuizPreviewInfo] = useState<any>(null);
  const [avgRating, setAvgRating] = useState<number>(0);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    if (!childId) {
      router.push("/dashboard");
      return;
    }

    const load = async () => {
      try {
        const data = await api.get(
          `/progress/children/${childId}/courses/${courseId}`,
          accessToken!
        );
        setCourseData(data);

        // Fetch average rating (public, no auth needed)
        api.get(`/feedback/course/${courseId}/reviews`, accessToken!)
          .then((rev: any) => { if (rev?.average_rating) setAvgRating(rev.average_rating); })
          .catch(() => {});

        // Retroactively generate certificate for users who already had 100% progress
        if ((data as any).enrollment?.progress_pct === 100) {
          api.post(`/certificates/generate/${courseId}`, { child_profile_id: childId }, accessToken!).catch(() => { });
        }

        // Auto-select first incomplete lesson
        const allLessons = (data as any).modules?.flatMap((m: any) => m.lessons) || [];
        const nextLesson = allLessons.find(
          (l: LessonItem) => !l.is_locked && !l.is_completed
        );
        if (nextLesson) setActiveLesson(nextLesson);
        else if (allLessons.length > 0) setActiveLesson(allLessons[0]);
      } catch {
        setCourseData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [mounted, courseId, childId, isAuthenticated, accessToken, router]);

  // Load video when lesson changes
  useEffect(() => {
    if (!activeLesson?.has_video || activeLesson.is_locked || !accessToken) {
      setVideoAccess(null);
      return;
    }

    const loadVideo = async () => {
      setLoadingVideo(true);
      try {
        const data = await api.post(
          "/video/access",
          { lesson_id: activeLesson.id, child_profile_id: childId },
          accessToken
        );
        setVideoAccess(data);
      } catch {
        setVideoAccess(null);
      } finally {
        setLoadingVideo(false);
      }
    };
    loadVideo();
  }, [activeLesson, accessToken, childId]);

  // Load quiz preview when quiz lesson is selected
  useEffect(() => {
    if (activeLesson?.lesson_type?.toLowerCase() === "quiz" && accessToken) {
      api.get(`/quizzes/lesson/${activeLesson.id}?t=${Date.now()}`, accessToken).then((res: any) => {
        setQuizPreviewInfo(res);
      }).catch(() => setQuizPreviewInfo(null));
    } else {
      setQuizPreviewInfo(null);
    }
  }, [activeLesson, accessToken]);

  // Load submission when lesson changes
  useEffect(() => {
    if (!activeLesson?.allow_submission || activeLesson.is_locked || !accessToken || !childId) {
      setSubmission(null);
      setAnswerText("");
      return;
    }
    const loadSubmission = async () => {
      try {
        const data: any = await api.get(
          `/assignments/${activeLesson.id}/my-submission?child_id=${childId}`,
          accessToken
        );
        if (data.submission) {
          setSubmission(data.submission);
          setAnswerText(data.submission.answer_text || "");
        } else {
          setSubmission(null);
          setAnswerText("");
        }
      } catch {
        setSubmission(null);
      }
    };
    loadSubmission();
  }, [activeLesson?.id, activeLesson?.allow_submission, accessToken, childId]);

  // Report progress
  const reportProgress = async (isCompleted: boolean = false) => {
    if (!activeLesson || !accessToken || !childId) return;
    try {
      await api.post(
        "/progress/update",
        {
          child_profile_id: childId,
          course_id: courseId,
          lesson_id: activeLesson.id,
          is_completed: isCompleted,
          watch_seconds: 0,
          last_position: 0,
        },
        accessToken
      );

      // Update local state immediately so sidebar indicator reflects change
      if (isCompleted && courseData) {
        const updated = { ...courseData };

        // First pass: mark the lesson as completed
        updated.modules = updated.modules.map((m: any) => ({
          ...m,
          lessons: m.lessons.map((l: any) =>
            l.id === activeLesson.id ? { ...l, is_completed: true } : l
          ),
        }));

        // Second pass: recalculate sequential locks across all lessons
        let prevCompleted = true;
        updated.modules = updated.modules.map((m: any) => ({
          ...m,
          lessons: m.lessons.map((l: any) => {
            const isLocked = l.is_free ? false : !prevCompleted;
            prevCompleted = l.is_completed || l.id === activeLesson.id;
            return { ...l, is_locked: isLocked };
          }),
          completed_lessons: m.lessons.filter((l: any) =>
            l.id === activeLesson.id ? true : l.is_completed
          ).length,
        }));

        // Update overall progress
        const allLessons = updated.modules.flatMap((m: any) => m.lessons);
        const totalLessons = allLessons.length;
        const completedLessons = allLessons.filter((l: any) => l.is_completed).length;
        const newProgressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
        const previousProgressPct = courseData.enrollment.progress_pct;

        updated.enrollment = {
          ...updated.enrollment,
          progress_pct: newProgressPct,
        };

        setCourseData(updated);

        // Also update activeLesson
        setActiveLesson({ ...activeLesson, is_completed: true });

        import("@/stores/toast-store").then(m => m.toast.success("লেসন সম্পন্ন হয়েছে ✓"));

        if (newProgressPct === 100 && previousProgressPct < 100) {
          try {
            await api.post(`/certificates/generate/${courseId}`, { child_profile_id: childId }, accessToken);
            import("@/stores/toast-store").then(m =>
              m.toast.success("অভিনন্দন! কোর্স সম্পন্ন হয়েছে এবং সার্টিফিকেট তৈরি হয়েছে 🎓")
            );
          } catch (err) {
            console.error("Failed to generate certificate", err);
          }
        }
      }
    } catch { }
  };


  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (!courseData) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <BookOpen className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-400 font-bn">
              কোর্স পাওয়া যায়নি
            </h1>
            <Link href="/dashboard" className="text-primary-700 text-sm mt-2 inline-block hover:underline">
              ← ড্যাশবোর্ডে ফিরে যাও
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const activeModule = courseData?.modules?.find((m: any) =>
    m.lessons.some((l: any) => l.id === activeLesson?.id)
  );

  const allLessons = courseData?.modules?.flatMap((m: any) => m.lessons) || [];
  const currentIndex = activeLesson ? allLessons.findIndex((l: any) => l.id === activeLesson.id) : -1;
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 && currentIndex !== -1 ? allLessons[currentIndex + 1] : null;

  const handleLessonClick = (lesson: LessonItem | null) => {
    if (lesson && !lesson.is_locked) {
      setActiveLesson(lesson);
      setActiveTab("overview");
      setIsTakingQuiz(false); // Reset quiz state when switching lessons
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFEFE] pb-12 relative overflow-x-hidden">
      {/* Global Brand Background Texture */}
      <div className="fixed inset-0 opacity-30 pointer-events-none z-0" style={{ backgroundImage: "radial-gradient(#5341cd 0.6px, transparent 0.6px)", backgroundSize: "24px 24px" }} />

      <div className="relative z-10 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Header Area */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div className="flex flex-wrap items-center gap-2 text-sm font-bn font-medium">
              <span className="text-gray-400">মডিউলস</span>
              <span className="text-gray-300">/</span>
              <span className="text-gray-500 line-clamp-1 max-w-[200px]">
                {activeModule?.title_bn || activeModule?.title || "মডিউল"}
              </span>
              <span className="text-gray-300">/</span>
              <span className="text-primary-700 font-bold line-clamp-1 max-w-[250px]">
                {activeLesson?.title_bn || activeLesson?.title}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleLessonClick(prevLesson)}
              disabled={!prevLesson || prevLesson.is_locked}
              className="px-5 py-2.5 rounded-xl text-sm font-bn font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              আগের ক্লাস
            </button>
            <button
              onClick={() => handleLessonClick(nextLesson)}
              disabled={!nextLesson || nextLesson.is_locked}
              className="px-5 py-2.5 rounded-xl text-sm font-bn font-semibold bg-primary-700 text-white hover:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-primary-700/20"
            >
              পরবর্তী ক্লাস
            </button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-12 gap-8">
          {/* Left Column - Video & Details (75%) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {activeLesson ? (
              <div className="w-full">
                {/* Video Player Box */}
                <div className="rounded-3xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-black aspect-video relative">
                  {activeLesson.is_locked ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50">
                      <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mb-4">
                        <Lock className="w-6 h-6 text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-bn font-semibold text-lg">
                        এই ক্লাস দেখতে কোর্সে ভর্তি হও
                      </p>
                      <Link
                        href="/courses"
                        className="mt-4 px-6 py-2.5 bg-primary-50 text-primary-700 rounded-xl font-semibold hover:bg-primary-100 font-bn"
                      >
                        কোর্সে ভর্তি হও
                      </Link>
                    </div>
                  ) : activeLesson.has_video && videoAccess ? (
                    <SecureVideoPlayer
                      youtubeId={videoAccess.youtube_id}
                      embedUrl={videoAccess.embed_url}
                      watermarkText={videoAccess.watermark_text}
                      token={videoAccess.token}
                      lessonId={activeLesson.id}
                      sessionId={`session-${Date.now()}`}
                    />
                  ) : loadingVideo && activeLesson.has_video ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                      <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
                    </div>
                  ) : activeLesson?.lesson_type?.toLowerCase() === "quiz" ? (
                    <div className="absolute inset-0 flex items-start md:items-center justify-center bg-white overflow-y-auto p-2 sm:p-4">
                      <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-12 gap-2 sm:gap-4 md:items-stretch md:h-full md:max-h-full">
                        {/* Left Panel: Dynamic Content (Mascot / Summary) */}
                        <div className="md:col-span-7 bg-white rounded-3xl p-4 sm:p-6 shadow-[0_10px_30px_rgba(27,28,28,0.04)] flex flex-col items-center justify-center relative overflow-hidden border border-gray-100 min-h-0">
                          {/* Background Pattern */}
                          <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: "radial-gradient(#5341cd 2px, transparent 2px)", backgroundSize: "24px 24px" }} />
                          <div className="relative z-10 w-full flex flex-col items-center justify-center h-full min-h-0">
                            {(activeLesson.is_completed || quizPreviewInfo?.last_attempt) ? (
                              <div className="flex flex-row items-center justify-center gap-4 sm:gap-10 w-full px-2">
                                {quizPreviewInfo?.last_attempt ? (
                                  <>
                                    {/* SVG Circular Progress */}
                                    <div className="relative w-24 h-24 sm:w-40 sm:h-40 shrink-0">
                                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="40" className="stroke-gray-100" strokeWidth="12" fill="none" />
                                        <circle
                                          cx="50" cy="50" r="40"
                                          className="stroke-[#5341CD] transition-all duration-1000 ease-out"
                                          strokeWidth="12" fill="none"
                                          strokeDasharray={`${2 * Math.PI * 40}`}
                                          strokeDashoffset={`${2 * Math.PI * 40 * (1 - parseFloat(quizPreviewInfo.last_attempt.score) / 100)}`}
                                          strokeLinecap="round"
                                        />
                                      </svg>
                                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-lg sm:text-3xl font-black text-[#5341CD]">
                                          {parseFloat(quizPreviewInfo.last_attempt.score).toFixed(0)}%
                                        </span>
                                        <span className="text-[8px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Score</span>
                                      </div>
                                    </div>

                                    {/* Stats Pills */}
                                    <div className="flex flex-col gap-1.5 sm:gap-2.5 w-full max-w-[240px]">
                                      <div className="bg-green-50 backdrop-blur-sm rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between border border-green-100/50">
                                        <div className="flex items-center gap-1.5 sm:gap-2">
                                          <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                          <span className="text-[11px] sm:text-sm font-bold text-green-700">সঠিক উত্তর</span>
                                        </div>
                                        <span className="font-black text-green-700 text-xs sm:text-base">{quizPreviewInfo.last_attempt.correct_count ?? '-'}</span>
                                      </div>

                                      <div className="bg-red-50 backdrop-blur-sm rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between border border-red-100/50">
                                        <div className="flex items-center gap-1.5 sm:gap-2">
                                          <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                                          <span className="text-[11px] sm:text-sm font-bold text-red-700">ভুল উত্তর</span>
                                        </div>
                                        <span className="font-black text-red-700 text-xs sm:text-base">{quizPreviewInfo.last_attempt.wrong_count ?? '-'}</span>
                                      </div>

                                      <div className="bg-gray-50 backdrop-blur-sm rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between border border-gray-100/50">
                                        <div className="flex items-center gap-1.5 sm:gap-2">
                                          <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                                          <span className="text-[11px] sm:text-sm font-bold text-gray-600">এড়িয়ে যাওয়া</span>
                                        </div>
                                        <span className="font-black text-gray-700 text-xs sm:text-base">{quizPreviewInfo.last_attempt.skipped_count ?? '-'}</span>
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <div className="flex flex-col items-center justify-center text-center p-6 border border-gray-100 rounded-3xl bg-gray-50/50 shadow-inner w-full">
                                     <CheckCircle2 className="w-12 h-12 sm:w-16 sm:h-16 text-green-500 mb-3 opacity-90" />
                                     <h2 className="text-lg sm:text-xl font-bold font-bn text-gray-800">কুইজ সফলভাবে সম্পন্ন হয়েছে</h2>
                                     <p className="text-xs sm:text-sm font-bn text-gray-500 mt-1">পুরোনো কুইজ হওয়ায় এর পরিসংখ্যান পাওয়া যায়নি।</p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <>
                                <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 mb-2 shrink-0 transition-transform hover:scale-105 duration-500">
                                  <img 
                                    alt="Scholar Joy Owl" 
                                    className="w-full h-full drop-shadow-xl object-cover" 
                                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuD0LvSVs4PRvS_zEDjFBOXxUaEgpEhahoZw-G-5YtVBasuumDkBF2B5zWQyZamKvit4xiJiQN2cMdf2XbqHzWgHaClw733pk7Qsdn9lBeUcRY6220bn3IaV7ddkRqdOlm38pWrdBE7HloZDkHbvGAD6Qz5U_uPINRGVvxUfbgvrpNgVXOrcN9S29IRftWrbGpq5RnX5EhGxOkNq-SrI78qx3MC3LgyWxJb3n4Qlua5WVhXh5cZttVh8O1Dc--Trdhpur-pUolqHQfN2" 
                                  />
                                </div>
                                <h1 className="font-bn text-xl sm:text-2xl lg:text-3xl font-extrabold text-primary-700 mb-1 tracking-tight leading-tight shrink-0 text-center">
                                  Ready to Test Your Knowledge?
                                </h1>
                                <p className="font-bn text-gray-500 text-xs sm:text-sm mb-3 sm:mb-4 max-w-sm shrink-0 text-center">
                                  Join Scholar Joy for a challenge and unlock your next level of expertise!
                                </p>
                                
                                <div className="grid grid-cols-3 gap-2 w-full max-w-xs mx-auto shrink-0">
                                  <div className="bg-gray-50 p-1.5 sm:p-2 rounded-lg border border-gray-100 flex flex-col items-center justify-center">
                                    <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600 mb-1" />
                                    <p className="font-bn text-[10px] sm:text-xs uppercase font-bold tracking-wider text-gray-600">কুইজ</p>
                                  </div>
                                  <div className="bg-gray-50 p-1.5 sm:p-2 rounded-lg border border-gray-100 flex flex-col items-center justify-center">
                                    <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-[#ffb787] mb-1" />
                                    <p className="font-bn text-[10px] sm:text-xs uppercase font-bold tracking-wider text-gray-600">পয়েন্ট</p>
                                  </div>
                                  <div className="bg-gray-50 p-1.5 sm:p-2 rounded-lg border border-gray-100 flex flex-col items-center justify-center">
                                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-[#5341CD] mb-1" />
                                    <p className="font-bn text-[10px] sm:text-xs uppercase font-bold tracking-wider text-gray-600">
                                      {activeLesson.duration_seconds ? `${Math.floor(activeLesson.duration_seconds / 60)} মিনিট` : 'সময়'}
                                    </p>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Right Panel: Mission Briefing */}
                        <div className="md:col-span-5 flex flex-col min-h-0">
                          <div className="bg-[#5341CD] text-white p-4 sm:p-5 rounded-3xl shadow-xl relative overflow-hidden flex-grow flex flex-col justify-center min-h-0">
                            {/* Decor element */}
                            <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl" />

                            <div className="flex items-center gap-2 mb-3 relative z-10 shrink-0">
                              <div className="bg-white/20 p-1.5 rounded-lg">
                                <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                              </div>
                              <h2 className="text-base sm:text-lg font-bold font-bn tracking-widest uppercase">মিশন ব্রিফিং</h2>
                            </div>

                            <div className="space-y-3 font-bn relative z-10 flex-grow min-h-0 flex flex-col justify-center">
                              <div className="shrink-0">
                                <h3 className="text-[10px] sm:text-[11px] font-bold text-white/70 uppercase tracking-wider mb-0.5">টপিক ওভারভিউ</h3>
                                <p className="text-sm sm:text-base leading-relaxed">
                                  তুমি এখন <span className="font-bold text-[#ffb787]">{courseData?.course?.title_bn || courseData?.course?.title}</span> কোর্সের কুইজ পর্বে অংশ নিচ্ছো।
                                </p>
                              </div>

                              <div className="bg-white/10 p-2 sm:p-3 rounded-lg border border-white/5 shrink-0">
                                <h3 className="text-[10px] sm:text-[11px] font-bold text-white/70 uppercase tracking-wider mb-1.5">লক্ষ্যসমূহ</h3>
                                <ul className="space-y-1">
                                  <li className="flex items-start gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-300 shrink-0" />
                                    <span className="text-[11px] sm:text-xs leading-tight">পুরো লেসনের সম্পূর্ণ রিভিউ</span>
                                  </li>
                                  <li className="flex items-start gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-300 shrink-0" />
                                    <span className="text-[11px] sm:text-xs leading-tight">দ্রুত চিন্তা করে সমস্যার সমাধান</span>
                                  </li>
                                </ul>
                              </div>
                            </div>

                            <div className="mt-3 sm:mt-4 relative z-10 shrink-0">
                              {activeLesson.is_locked ? (
                                <div className="w-full bg-white/10 text-white/80 font-bold py-2 sm:py-2.5 rounded-xl flex items-center justify-center gap-2 font-bn border border-white/20 text-xs sm:text-sm">
                                  <Lock className="w-4 h-4 sm:w-5 sm:h-5" /> কোর্সে ভর্তি হও
                                </div>
                              ) : quizPreviewInfo?.last_attempt ? (
                                <button
                                  onClick={() => setIsTakingQuiz(true)}
                                  className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-2.5 sm:py-3 rounded-xl flex items-center justify-center gap-2 group font-bn transition-all text-sm sm:text-base border border-white/20"
                                >
                                  বিস্তারিত ফলাফল দেখো
                                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </button>
                              ) : activeLesson.is_completed ? (
                                <div className="w-full flex-col gap-2">
                                  <div className="w-full py-2.5 sm:py-3 rounded-xl shadow-inner flex items-center justify-center px-4 sm:px-5 mb-2 font-bn bg-green-500 text-white">
                                    <CheckCircle2 className="w-5 h-5 mr-2 opacity-90" />
                                    <span className="font-bold tracking-wider text-base sm:text-lg">কুইজ সম্পন্ন হয়েছে</span>
                                  </div>
                                  <button
                                    disabled
                                    className="w-full bg-white/10 text-white font-bold py-2 sm:py-2.5 rounded-xl flex items-center justify-center gap-2 font-bn text-xs sm:text-sm border border-white/20 opacity-50 cursor-not-allowed"
                                  >
                                    আবার চেষ্টা করার সুযোগ নেই
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setIsTakingQuiz(true)}
                                  className="w-full bg-[#ffb787] hover:bg-orange-300 text-[#642e00] font-bold py-2.5 sm:py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 group font-bn transition-all hover:scale-[1.02]"
                                >
                                  <span className="text-base sm:text-lg">কুইজ শুরু করো</span>
                                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : !activeLesson.has_video && (activeLesson.content || activeLesson.content_bn || activeLesson.allow_submission) ? (
                    /* Non-video lesson with rich content + optional submission */
                    <div className="absolute inset-0 bg-[#fbf9f8] overflow-y-auto rounded-3xl flex flex-col font-bn shadow-inner custom-scrollbar">
                      {/* Subtle Background Pattern */}
                      <div className="absolute inset-0 opacity-20 pointer-events-none z-0" style={{ backgroundImage: "radial-gradient(#5341cd 0.5px, transparent 0.5px)", backgroundSize: "20px 20px" }} />

                      <div className="relative z-10 p-4 sm:p-6 flex flex-col gap-4 sm:gap-5 max-w-3xl mx-auto w-full">

                        {/* Assignment Header */}
                        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100 relative overflow-hidden shrink-0">
                          <div className={`absolute top-0 left-0 w-1.5 h-full ${activeLesson.lesson_type?.toLowerCase() === 'assignment' ? 'bg-orange-400' : 'bg-[#6c5ce7]'}`} />
                          <div className="pl-3 sm:pl-4">
                            <p className="text-[10px] font-bold text-gray-400 font-sans uppercase tracking-widest mb-1.5">
                              {activeLesson.lesson_type?.toLowerCase() === 'assignment' ? 'এসাইনমেন্ট মিশন' : activeLesson.lesson_type?.toLowerCase() === 'smart_note' ? 'স্মার্ট স্টাডি নোট' : 'স্টাডি মেটেরিয়াল'}
                            </p>
                            <h3 className="font-bold text-gray-900 font-bn text-xl sm:text-2xl tracking-tight leading-tight">
                              {activeLesson.title_bn || activeLesson.title}
                            </h3>
                          </div>
                        </div>

                        {/* Content / Instructions */}
                        {(activeLesson.content || activeLesson.content_bn) && (
                          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100 relative text-gray-800 shrink-0">
                            <div className="flex items-center gap-2 mb-3">
                              <BookOpen className="w-4 h-4 text-[#6c5ce7]" />
                              <span className="text-[10px] font-bold text-gray-400 font-sans uppercase tracking-widest">নির্দেশনা</span>
                            </div>
                            <div
                              className="tiptap prose prose-sm prose-orange max-w-none font-bn text-base leading-relaxed prose-p:my-1.5 prose-headings:font-bold"
                              dangerouslySetInnerHTML={{ __html: activeLesson.content_bn || activeLesson.content || '' }}
                            />
                          </div>
                        )}

                        {/* Mark as done — for smart notes and content lessons (not assignment/quiz) */}
                        {activeLesson.lesson_type?.toLowerCase() !== 'assignment' && activeLesson.lesson_type?.toLowerCase() !== 'quiz' && !activeLesson.is_completed && !activeLesson.is_locked && (
                          <button
                            onClick={() => reportProgress(true)}
                            className="w-full py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl font-bn text-base flex items-center justify-center gap-2 shadow-sm hover:shadow-md active:scale-[0.98] transition-all shrink-0"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            পড়া শেষ — পরবর্তী লেসনে যাও
                          </button>
                        )}

                        {/* Already completed indicator for smart notes */}
                        {activeLesson.lesson_type?.toLowerCase() !== 'assignment' && activeLesson.lesson_type?.toLowerCase() !== 'quiz' && activeLesson.is_completed && (
                          <div className="w-full py-2.5 bg-green-50 text-green-600 font-bold rounded-xl font-bn text-sm flex items-center justify-center gap-2 border border-green-100 shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                            সম্পন্ন হয়েছে
                          </div>
                        )}

                        {/* Submission Widget */}
                        {activeLesson.lesson_type?.toLowerCase() === 'assignment' && activeLesson.allow_submission && !activeLesson.is_locked && (
                          <AssignmentSubmissionSection
                            lessonId={activeLesson.id}
                            childId={childId!}
                            accessToken={accessToken!}
                            submission={submission}
                            setSubmission={setSubmission}
                            answerText={answerText}
                            setAnswerText={setAnswerText}
                            submitting={submitting}
                            setSubmitting={setSubmitting}
                            maxGrade={activeLesson.max_grade || 10}
                            allowImageUpload={activeLesson.allow_image_upload || false}
                            onComplete={() => reportProgress(true)}
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50">
                      <FileText className="w-16 h-16 text-gray-300 mb-4" />
                      <h3 className="font-bold text-gray-600 font-bn text-xl">
                        {activeLesson.title_bn || activeLesson.title}
                      </h3>
                      <p className="text-gray-400 font-bn mt-2">এই লেসনে এখনো কন্টেন্ট যোগ হয়নি</p>
                      {!activeLesson.is_completed && !activeLesson.is_locked && (
                        <button
                          onClick={() => reportProgress(true)}
                          className="mt-6 px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl font-bn text-sm flex items-center gap-2 shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          সম্পন্ন করো
                        </button>
                      )}
                      {activeLesson.is_completed && (
                        <div className="mt-6 px-5 py-2 bg-green-50 text-green-600 font-bold rounded-xl font-bn text-sm flex items-center gap-2 border border-green-100">
                          <CheckCircle2 className="w-4 h-4" />
                          সম্পন্ন হয়েছে
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Content Tabs area (Mocked per design layout) */}
                <div className="mt-8">
                  {/* Action Bar inside Content */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4 mb-6">
                    <div className="flex gap-6">
                      <button
                        onClick={() => setActiveTab("overview")}
                        className={`font-bold font-bn pb-4 -mb-[17px] ${activeTab === "overview" ? "text-primary-700 border-b-2 border-primary-700" : "text-gray-400 hover:text-gray-700"}`}
                      >
                        লেসন ওভারভিউ
                      </button>
                      <button
                        onClick={() => setActiveTab("resources")}
                        className={`font-bold font-bn pb-4 -mb-[17px] ${activeTab === "resources" ? "text-primary-700 border-b-2 border-primary-700" : "text-gray-400 hover:text-gray-700"}`}
                      >
                        রিসোর্স
                      </button>
                      <button
                        onClick={() => setActiveTab("feedback")}
                        className={`font-bold font-bn pb-4 -mb-[17px] ${activeTab === "feedback" ? "text-primary-700 border-b-2 border-primary-700" : "text-gray-400 hover:text-gray-700"}`}
                      >
                        মতামত
                      </button>
                    </div>

                    {/* Quick Action buttons */}
                    <div className="flex gap-3">
                      {activeLesson && !activeLesson.is_locked && !activeLesson.is_completed && courseData.enrollment.progress_pct < 100 && (
                        <button
                          onClick={() => reportProgress(true)}
                          className="px-5 py-2 bg-green-50 text-green-700 text-sm font-bold rounded-xl hover:bg-green-100 transition-all font-bn flex items-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          সম্পন্ন করো
                        </button>
                      )}

                      {courseData.enrollment.progress_pct === 100 && (
                        <Link
                          href="/dashboard/certificates"
                          className="px-5 py-2 bg-gradient-to-r from-amber-400 to-amber-500 text-white text-sm font-bold rounded-xl shadow-[0_4px_12px_rgba(245,158,11,0.2)] hover:shadow-[0_6px_16px_rgba(245,158,11,0.3)] transition-all font-bn flex items-center gap-2"
                        >
                          <Award className="w-4 h-4" />
                          সার্টিফিকেট
                        </Link>
                      )}
                    </div>
                  </div>

                  {activeTab === "overview" && (
                    <>
                      {/* Lesson Information Box */}
                      <div className="grid md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 bg-white rounded-3xl p-8 border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
                          <h2 className="text-3xl font-bold text-gray-900 font-bn mb-4">
                            {activeLesson.title_bn || activeLesson.title}
                          </h2>

                          {activeLesson.has_video && (activeLesson.content || activeLesson.content_bn) ? (
                            <div
                              className="tiptap font-bn"
                              dangerouslySetInnerHTML={{ __html: activeLesson.content_bn || activeLesson.content || '' }}
                            />
                          ) : (
                            <>
                              <p className="text-gray-500 font-bn text-lg leading-relaxed mb-6">
                                এই লেসনে আমরা বিস্তারিত আলোচনা করবো কীভাবে তুমি দ্রুত এই বিষয়ে দক্ষতা অর্জন করতে পারো। সম্পূর্ণ লেসনটি মনোযোগ সহকারে দেখো এবং প্রয়োজনীয় নোট নাও।
                              </p>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="bg-primary-50/50 rounded-2xl p-5 border border-primary-50">
                                  <div className="flex items-center gap-2 mb-2 text-primary-700 font-bold font-bn">
                                    <BookOpen className="w-4 h-4" />
                                    মূল বিষয়বস্তু
                                  </div>
                                  <p className="text-sm text-gray-600 font-bn leading-relaxed">
                                    লেসনের মূল ফোকাস এবং কোর কনসেপ্ট সমূহের বিস্তারিত সারাংশ।
                                  </p>
                                </div>
                                <div className="bg-purple-50/50 rounded-2xl p-5 border border-purple-50">
                                  <div className="flex items-center gap-2 mb-2 text-purple-700 font-bold font-bn">
                                    <CheckCircle2 className="w-4 h-4" />
                                    পরবর্তী লক্ষ্য
                                  </div>
                                  <p className="text-sm text-gray-600 font-bn leading-relaxed">
                                    এই লেসন থেকে অর্জিত জ্ঞান পরবর্তী লেসনে কাজে লাগানোর প্রস্তুতি।
                                  </p>
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        <div className="md:col-span-1 flex flex-col gap-4">
                          {/* Details Card */}
                          <div className="bg-gray-50/50 rounded-3xl p-6 border border-gray-100">
                            <h4 className="font-bold text-gray-900 font-bn mb-6 text-lg">লেসন ডিটেইলস</h4>
                            <div className="space-y-4">
                              <div className="flex justify-between items-center pb-4 border-b border-gray-200/60">
                                <span className="text-sm text-gray-500 font-bn">কোর্স ইনস্ট্রাক্টর</span>
                                <span className="text-sm font-bold text-gray-900 font-bn">LMS Admin</span>
                              </div>
                              <div className="flex justify-between items-center pb-4 border-b border-gray-200/60">
                                <span className="text-sm text-gray-500 font-bn">সময়কাল</span>
                                <span className="text-sm font-bold text-gray-900 font-bn">
                                  {activeLesson.duration_seconds ? Math.floor(activeLesson.duration_seconds / 60) + " মিনিট" : "অজানা"}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-500 font-bn">ধরণ</span>
                                <span className="px-2.5 py-1 bg-primary-100 text-primary-700 rounded-lg text-xs font-bold font-bn">
                                  {activeLesson.lesson_type?.toLowerCase() === 'video_lecture' ? 'ভিডিও লেকচার' : 'নোট/অন্যান্য'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {activeTab === "resources" && activeLesson && (
                    <div className="mt-4">
                      <ResourceList courseId={courseId} lessonId={activeLesson.id} />
                    </div>
                  )}

                  {activeTab === "feedback" && (
                    <div className="mt-4">
                      <FeedbackTab courseId={courseId} />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="aspect-video bg-gray-50 rounded-3xl flex items-center justify-center border border-gray-100">
                <p className="text-gray-400 font-bn text-lg">একটি ক্লাস সিলেক্ট করো</p>
              </div>
            )}
          </div>

          {/* Right Column - Sidebar (25%) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            {/* High-level Course Card */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center shrink-0">
                  <BookOpen className="w-6 h-6 text-primary-600" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <h2 className="font-bold text-gray-900 font-bn text-lg leading-tight line-clamp-1">
                      {courseData.course.title_bn || courseData.course.title}
                    </h2>
                    {courseData.course.has_exam && (
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 flex items-center gap-1 border border-purple-200">
                        <GraduationCap className="w-3 h-3" />
                        পরীক্ষা
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs text-gray-500 font-bn">কোর্স প্রোগ্রেস: {Math.round(courseData.enrollment.progress_pct)}%</p>
                    {avgRating > 0 && (
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3 h-3 ${s <= Math.round(avgRating) ? "text-amber-400 fill-amber-400" : "text-gray-200 fill-gray-200"}`}
                          />
                        ))}
                        <span className="text-[11px] font-semibold text-gray-500 ml-0.5">{avgRating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <ProgressBar
                percentage={courseData.enrollment.progress_pct}
                size="md"
                showLabel={false}
              />
            </div>

            {/* Accordion List */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] overflow-hidden lg:max-h-[calc(100vh-250px)] lg:overflow-y-auto">
              <div className="p-4 bg-gray-50/50 border-b border-gray-100 border-dashed">
                <h3 className="font-bold text-gray-900 font-bn text-lg">কোর্স কারিকুলাম</h3>
              </div>
              <div className="p-4">
                <CourseAccordion
                  modules={courseData.modules}
                  activeLessonId={activeLesson?.id}
                  onLessonClick={handleLessonClick}
                />
              </div>
            </div>

            {/* Exam Purchase Prompt */}
            {courseData.course.attached_exams?.filter((e: any) => !e.has_access).map((exam: any) => (
              <div key={exam.exam_id} className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-purple-100 p-4 mt-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                    <GraduationCap className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-900 font-bn text-sm">
                      {exam.title_bn || exam.title}
                    </h4>
                    <p className="text-xs text-gray-500 font-bn mt-0.5">
                      এই কোর্সের সাথে একটি পরীক্ষা সংযুক্ত আছে
                    </p>
                    <div className="flex items-center gap-3 mt-3">
                      {exam.is_free ? (
                        <Link
                          href={`/exams/${exam.slug}`}
                          className="px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 transition-colors font-bn"
                        >
                          ফ্রি পরীক্ষা দাও
                        </Link>
                      ) : (
                        <Link
                          href={`/exams/${exam.slug}`}
                          className="px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 transition-colors font-bn"
                        >
                          পরীক্ষা কিনো — ৳{exam.price}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating immersive Quiz Player Modal */}
      {isTakingQuiz && activeLesson && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col h-screen animate-in fade-in zoom-in-95 duration-200">
          <QuizPlayer
            lessonId={activeLesson.id}
            onClose={(resultData: any) => {
              setIsTakingQuiz(false);
              if (resultData) {
                 // Handle both fresh submission (has results array) and loaded last_attempt (has counts directly)
                 const correct = resultData.results
                   ? resultData.results.filter((r:any) => r.is_correct).length
                   : (resultData.correct_count ?? 0);
                 const skipped = resultData.results
                   ? resultData.results.filter((r:any) => !r.selected_option_id).length
                   : (resultData.skipped_count ?? 0);
                 const wrong = resultData.results
                   ? resultData.results.length - correct - skipped
                   : (resultData.wrong_count ?? 0);

                 setQuizPreviewInfo((prev: any) => ({
                   ...prev,
                   last_attempt: {
                     score: resultData.score,
                     passed: resultData.passed,
                     earned_points: resultData.earned_points,
                     total_points: resultData.total_points,
                     correct_count: correct,
                     wrong_count: wrong,
                     skipped_count: skipped
                   }
                 }));
              }
            }}
            onPass={(passed: boolean, resultData?: any) => {
              reportProgress(true); // Always report complete to lock it, regardless of pass score!
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function LearnPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    }>
      <LearnContent params={params} />
    </Suspense>
  );
}

/* Assignment Submission Section */
function AssignmentSubmissionSection({
  lessonId, childId, accessToken, submission, setSubmission,
  answerText, setAnswerText, submitting, setSubmitting, maxGrade, allowImageUpload,
  onComplete,
}: {
  lessonId: string;
  childId: string;
  accessToken: string;
  submission: Submission | null;
  setSubmission: (s: Submission | null) => void;
  answerText: string;
  setAnswerText: (v: string) => void;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  maxGrade: number;
  allowImageUpload: boolean;
  onComplete?: () => void;
}) {
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      import("@/stores/toast-store").then(m => m.toast.error("শুধুমাত্র ছবি আপলোড করা যাবে"));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      import("@/stores/toast-store").then(m => m.toast.error("ছবির সাইজ ২MB এর কম হতে হবে"));
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "assignments");

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1";
      const res = await fetch(`${apiUrl}/uploads/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        setUploadedImages(prev => [...prev, data.url]);
      }
    } catch {
      import("@/stores/toast-store").then(m => m.toast.error("আপলোড ব্যর্থ"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeImage = (idx: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!answerText.trim() && uploadedImages.length === 0) return;
    setSubmitting(true);
    try {
      const data: any = await api.post(
        `/assignments/${lessonId}/submit`,
        {
          child_profile_id: childId,
          answer_text: answerText || null,
          file_urls: uploadedImages.length > 0 ? uploadedImages : null,
        },
        accessToken
      );
      setSubmission(data.submission);
      onComplete?.();
      import("@/stores/toast-store").then(m => m.toast.success("এসাইনমেন্ট জমা হয়েছে ✓"));
    } catch {
      import("@/stores/toast-store").then(m => m.toast.error("জমা দিতে সমস্যা হয়েছে"));
    } finally {
      setSubmitting(false);
    }
  };

  const isSubmitted = submission && (submission.status === 'submitted' || submission.status === 'graded');

  const statusLabels: Record<string, { label: string; color: string }> = {
    submitted: { label: "পর্যালোচনা অপেক্ষমান", color: "text-amber-700 bg-amber-50 border-amber-200" },
    graded: { label: "গ্রেড সম্পন্ন", color: "text-green-700 bg-green-50 border-green-200" },
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 relative w-full overflow-hidden shrink-0">
      {isSubmitted ? (
        <div className="flex flex-col">
          {/* Submitted Header */}
          <div className="px-5 sm:px-6 pt-5 pb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <h4 className="font-bold text-gray-900 font-bn text-lg">তোমার সাবমিশন</h4>
            </div>
            <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border font-sans uppercase tracking-widest ${statusLabels[submission.status]?.color || ''}`}>
              {statusLabels[submission.status]?.label}
            </div>
          </div>

          {/* Answer Text */}
          {submission.answer_text && (
            <div className="mx-5 sm:mx-6 mb-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
              <p className="text-gray-700 font-bn text-[15px] leading-relaxed whitespace-pre-wrap">{submission.answer_text}</p>
            </div>
          )}

          {/* Attached Images */}
          {submission.file_urls && submission.file_urls.length > 0 && (
            <div className="mx-5 sm:mx-6 mb-4 flex flex-wrap gap-2.5">
              {submission.file_urls.map((url: string, idx: number) => (
                <a key={idx} href={url} target="_blank" rel="noreferrer" className="block relative group overflow-hidden rounded-xl border border-gray-200 hover:border-orange-400 transition-all shadow-sm">
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                    <ImagePlus className="w-4 h-4 text-white" />
                  </div>
                  <img src={url} alt={`Attachment ${idx + 1}`} className="w-[72px] h-[72px] object-cover group-hover:scale-105 transition-transform duration-300" />
                </a>
              ))}
            </div>
          )}

          {/* Grade Card */}
          {submission.status === 'graded' && submission.grade !== null && (
            <div className="mx-5 sm:mx-6 mb-5 rounded-xl border border-green-100 overflow-hidden">
              <div className="bg-green-50 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white border border-green-200 shadow-sm flex items-center justify-center shrink-0">
                    <span className="text-lg font-black text-green-600 font-mono">{submission.grade}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-green-600/70 font-sans uppercase tracking-wider block">অর্জিত গ্রেড</span>
                    <span className="text-sm font-bold text-gray-800 font-bn">সর্বমোট {maxGrade} এর মধ্যে</span>
                  </div>
                </div>
                <Award className="w-5 h-5 text-green-300" />
              </div>
              {submission.feedback && (
                <div className="px-4 py-3 bg-white border-t border-green-100">
                  <p className="text-[10px] font-bold text-green-600/70 font-sans uppercase tracking-wider mb-1">ইনস্ট্রাক্টর ফিডব্যাক</p>
                  <p className="text-sm text-gray-700 font-bn leading-relaxed">{submission.feedback}</p>
                </div>
              )}
            </div>
          )}

          {/* Bottom padding when no grade */}
          {submission.status !== 'graded' && <div className="h-1" />}
        </div>
      ) : (
        <div className="flex flex-col">
          {/* Form Header */}
          <div className="px-5 sm:px-6 pt-5 pb-3 flex items-center gap-2.5">
            <Send className="w-4 h-4 text-orange-500 shrink-0" />
            <h4 className="font-bold text-gray-900 font-bn text-lg">তোমার উত্তর</h4>
          </div>

          {/* Textarea */}
          <div className="px-5 sm:px-6 pb-4">
            <textarea
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="এসাইনমেন্টের উত্তর বিস্তারিতভাবে এখানে লিখো..."
              className="w-full min-h-[140px] bg-gray-50 px-4 py-3.5 rounded-xl border border-gray-200 text-[15px] font-bn text-gray-800 placeholder-gray-400 outline-none focus:bg-white focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition-all resize-y"
            />
          </div>

          {/* Image Upload Area */}
          {allowImageUpload && (
            <div className="px-5 sm:px-6 pb-4">
              {uploadedImages.length > 0 && (
                <div className="flex flex-wrap gap-2.5 mb-3">
                  {uploadedImages.map((url, idx) => (
                    <div key={idx} className="relative group">
                      <img src={url} alt="" className="w-[72px] h-[72px] object-cover rounded-xl border border-gray-200 shadow-sm" />
                      <button
                        onClick={() => removeImage(idx)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-md"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-gray-200 text-xs font-bold text-gray-400 hover:border-orange-300 hover:text-orange-500 hover:bg-orange-50/50 cursor-pointer transition-all font-bn">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                {uploading ? "আপলোড হচ্ছে..." : "ছবি যোগ করো (সর্বোচ্চ ২MB)"}
                <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="hidden" />
              </label>
            </div>
          )}

          {/* Submit Button — full width at bottom */}
          <div className="px-5 sm:px-6 pb-5">
            <button
              onClick={handleSubmit}
              disabled={submitting || (!answerText.trim() && uploadedImages.length === 0)}
              className="group w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl font-bn text-base disabled:opacity-40 disabled:hover:bg-orange-500 flex items-center justify-center gap-2 shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />}
              সাবমিট করো
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

