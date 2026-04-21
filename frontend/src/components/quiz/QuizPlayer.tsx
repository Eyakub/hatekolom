"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2, XCircle, ArrowRight, ArrowLeft, Loader2,
  Trophy, Clock, AlertCircle, RotateCcw,
  Sun, Star, CircleDashed, CircleDot, SkipForward, Rocket, Timer, HelpCircle, Sparkles, Globe
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { Suspense } from "react";
import { motion } from "framer-motion";

const HappyParticles = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
    <motion.div
      initial={{ x: "-50vw", y: "50vh", rotate: 45, scale: 2 }}
      animate={{ x: "100vw", y: "-50vh" }}
      transition={{ duration: 1.5, ease: "easeInOut" }}
      className="absolute text-8xl"
    >
      🚀
    </motion.div>
  </div>
);

const SadParticles = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
    {[...Array(10)].map((_, i) => (
      <motion.div
        key={i}
        initial={{ y: "-10vh", opacity: 0 }}
        animate={{ y: "110vh", opacity: [0, 0.5, 0] }}
        transition={{ duration: 1 + Math.random(), repeat: Infinity, delay: Math.random() * 2, ease: "linear" }}
        className="absolute w-1 h-8 bg-blue-300 rounded-full blur-[1px]"
        style={{ left: `${Math.random() * 100}%` }}
      />
    ))}
  </div>
);

export function QuizPlayer({ lessonId, onClose, onPass }: { lessonId: string, onClose?: (result?: any) => void, onPass?: (passed: boolean, result?: any) => void }) {
  const router = useRouter();
  const { accessToken, user } = useAuthStore();

  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!lessonId || !accessToken) return;
    loadQuiz();
  }, [lessonId, accessToken]);

  // Timer
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || result) return;
    const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    if (timeLeft === 1) handleSubmit();
    return () => clearTimeout(timer);
  }, [timeLeft, result]);

  const loadQuiz = async () => {
    try {
      const data: any = await api.get(`/quizzes/lesson/${lessonId}`, accessToken!);
      setQuiz(data);
      if (data.last_attempt) {
        setResult(data.last_attempt);
      } else if (data.time_limit_seconds) {
        setTimeLeft(data.time_limit_seconds);
      }
    } catch {
      setQuiz(null);
    }
    setLoading(false);
  };

  const selectAnswer = (questionId: string, optionId: string) => {
    if (result) return;
    setAnswers(prev => ({ ...prev, [questionId]: optionId }));
  };

  const handleSubmit = async () => {
    if (!quiz || submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        answers: Object.entries(answers).map(([question_id, selected_option_id]) => ({
          question_id,
          selected_option_id,
        })),
      };
      const res: any = await api.post(`/quizzes/${quiz.id}/submit`, payload, accessToken!);
      setResult(res);
      if (onPass) {
        onPass(res.passed, res);
      }
    } catch (err: any) {
      import("@/stores/toast-store").then(m => m.toast.error("সাবমিট করা যায়নি"));
    }
    setSubmitting(false);
  };

  const retryQuiz = () => {
    setAnswers({});
    setResult(null);
    setCurrentIndex(0);
    if (quiz?.time_limit_seconds) setTimeLeft(quiz.time_limit_seconds);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleNext = () => {
    if (currentIndex < quiz.questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleSubmit();
    }
  };

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-50/50 backdrop-blur-sm rounded-3xl">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="h-full w-full flex items-center justify-center px-4 bg-white rounded-3xl border border-gray-100">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-bn">এই লেসনে কোনো কুইজ নেই</p>
          <button onClick={() => onClose ? onClose() : router.back()} className="mt-4 text-primary-600 font-semibold text-sm hover:underline font-bn">
            <ArrowLeft className="w-4 h-4 inline mr-1" />ফিরে যাও
          </button>
        </div>
      </div>
    );
  }

  if (result) {
    // Compute correct/wrong/skipped from either fresh submission or loaded last_attempt
    const correctCount = result.results
      ? result.results.filter((r: any) => r.is_correct).length
      : (result.correct_count ?? 0);
    const skippedCount = result.results
      ? result.results.filter((r: any) => !r.selected_option_id).length
      : (result.skipped_count ?? 0);
    const totalCount = result.results
      ? result.results.length
      : (correctCount + (result.wrong_count ?? 0) + skippedCount);
    const wrongCount = result.results
      ? totalCount - correctCount - skippedCount
      : (result.wrong_count ?? 0);
    const scorePct = parseFloat(result.score);
    const circumference = 2 * Math.PI * 40;

    return (
      <div className="bg-[#fbf9f8] h-full w-full rounded-3xl relative overflow-hidden flex flex-col font-bn text-gray-900 shadow-inner">
        {/* Background Texture Overlay */}
        <div className="absolute inset-0 opacity-40 pointer-events-none z-0" style={{ backgroundImage: "radial-gradient(#5341cd 0.6px, transparent 0.6px)", backgroundSize: "24px 24px" }} />

        {/* Decorative Graphics */}
        <div className="absolute bottom-20 -left-16 opacity-[0.04] pointer-events-none hidden md:block rotate-[15deg] z-0">
          <Sparkles className="w-80 h-80 text-[#5341cd]" />
        </div>
        <div className="absolute top-24 -right-16 opacity-[0.04] pointer-events-none hidden md:block -rotate-[15deg] z-0">
          <Globe className="w-96 h-96 text-orange-600" />
        </div>

        {/* Top Header */}
        <header className="bg-white/80 backdrop-blur-xl w-full z-20 flex justify-between items-center px-6 sm:px-10 py-4 shadow-[0_4px_30px_rgba(0,0,0,0.02)] border-b border-gray-100/50">
          <div className="text-xl sm:text-2xl font-extrabold text-[#5341CD] tracking-wide">ফলাফল বিশ্লেষণ</div>
          <div className="flex items-center gap-4">
            <button onClick={() => onClose ? onClose(result) : router.back()} className="text-gray-400 hover:text-gray-600 hover:scale-105 transition-all outline-none">
              <XCircle className="w-6 h-6" />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col items-center justify-center relative z-10 overflow-y-auto">
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", bounce: 0.5, duration: 0.6 }}
            className={`relative rounded-[2rem] w-full p-8 md:p-12 shadow-[0_20px_40px_rgba(27,28,28,0.06)] overflow-hidden border-2 ${
              result.passed ? "bg-white border-green-200" : "bg-white border-red-100"
            }`}
          >
            {result.passed ? <HappyParticles /> : <SadParticles />}

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`text-2xl sm:text-3xl font-extrabold relative z-10 tracking-tight text-center mb-8 ${result.passed ? "text-green-600" : "text-gray-900"}`}
            >
              {result.passed ? "অসাধারণ পারফরম্যান্স! 🎉" : "তুমি উত্তীর্ণ হতে পারোনি 😞"}
            </motion.h2>

            {/* Donut + Stats Row */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-12 relative z-10">
              {/* Circular Score Donut */}
              <motion.div
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", bounce: 0.5, duration: 0.8, delay: 0.3 }}
                className="relative w-44 h-44 sm:w-52 sm:h-52 shrink-0"
              >
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" className="stroke-gray-100" strokeWidth="10" fill="none" />
                  <motion.circle
                    cx="50" cy="50" r="40"
                    className={result.passed ? "stroke-[#5341CD]" : "stroke-red-400"}
                    strokeWidth="10" fill="none"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: circumference * (1 - scorePct / 100) }}
                    transition={{ duration: 1.2, ease: "easeOut", delay: 0.5 }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", bounce: 0.7, delay: 0.8 }}
                    className={`text-4xl sm:text-5xl font-black font-mono ${result.passed ? "text-[#5341CD]" : "text-red-500"}`}
                  >
                    {scorePct.toFixed(0)}%
                  </motion.span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Score</span>
                </div>
              </motion.div>

              {/* Metrics Pills */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6, duration: 0.5 }}
                className="flex flex-col gap-3 w-full max-w-[260px]"
              >
                {/* Correct */}
                <div className="bg-green-50 rounded-xl px-5 py-3.5 flex items-center justify-between border border-green-100/80 shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm shadow-green-300"></div>
                    <span className="text-sm font-bold text-green-700">সঠিক উত্তর</span>
                  </div>
                  <span className="font-black text-green-700 text-lg tabular-nums">{correctCount}</span>
                </div>

                {/* Wrong */}
                <div className="bg-red-50 rounded-xl px-5 py-3.5 flex items-center justify-between border border-red-100/80 shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm shadow-red-300"></div>
                    <span className="text-sm font-bold text-red-700">ভুল উত্তর</span>
                  </div>
                  <span className="font-black text-red-700 text-lg tabular-nums">{wrongCount}</span>
                </div>

                {/* Skipped */}
                <div className="bg-gray-50 rounded-xl px-5 py-3.5 flex items-center justify-between border border-gray-200/80 shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-400 shadow-sm shadow-gray-300"></div>
                    <span className="text-sm font-bold text-gray-600">এড়িয়ে যাওয়া</span>
                  </div>
                  <span className="font-black text-gray-700 text-lg tabular-nums">{skippedCount}</span>
                </div>

                {/* Points Earned */}
                <div className="bg-[#f3f0ff] rounded-xl px-5 py-3.5 flex items-center justify-between border border-[#5341CD]/10 shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <Trophy className={`w-4 h-4 ${result.passed ? 'text-[#ffb787]' : 'text-gray-400'}`} />
                    <span className="text-sm font-bold text-[#5341CD]">পয়েন্ট প্রাপ্ত</span>
                  </div>
                  <span className="font-black text-[#5341CD] text-lg tabular-nums">{result.earned_points}/{result.total_points}</span>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </main>

        {/* Unified Bottom Action Shell */}
        <footer className="w-full bg-white/90 backdrop-blur-xl px-4 sm:px-8 py-4 sm:py-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100 z-20 shadow-[0_-15px_40px_rgba(0,0,0,0.03)]">
          <div className="hidden sm:block"></div>

          <button
            onClick={() => onClose ? onClose(result) : router.back()}
            className="group px-8 sm:px-10 py-3.5 sm:py-4 rounded-full font-bold text-lg sm:text-xl flex items-center justify-center w-full sm:w-auto gap-3 transition-all bg-[#5341CD] text-white shadow-xl shadow-primary-600/30 hover:shadow-primary-600/50 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
          >
            {onClose ? 'লেসনে ফিরে যাও' : 'কোর্সে ফিরে যাও'}
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </button>
        </footer>
      </div>
    );
  }

  // Active Quiz (Paginated Mission Mars Layout)
  const currentTotalQuestions = quiz.questions.length;
  const currentQNum = currentIndex + 1;
  const q = quiz.questions[currentIndex];
  const progressPct = (currentQNum / currentTotalQuestions) * 100;
  const timeProgressPct = quiz.time_limit_seconds ? ((quiz.time_limit_seconds - (timeLeft || 0)) / quiz.time_limit_seconds) * 100 : 0;

  const optionStyles = [
    { bg: "bg-white", iconBg: "bg-orange-100", text: "text-gray-900", iconText: "text-orange-600", hoverBorder: "hover:border-orange-500 hover:shadow-orange-500/10", activeBorder: "border-orange-500 bg-orange-50", icon: Sun, label: "Option A" },
    { bg: "bg-white", iconBg: "bg-blue-100", text: "text-gray-900", iconText: "text-blue-600", hoverBorder: "hover:border-blue-500 hover:shadow-blue-500/10", activeBorder: "border-blue-500 bg-blue-50", icon: Star, label: "Option B" },
    { bg: "bg-white", iconBg: "bg-primary-100", text: "text-gray-900", iconText: "text-primary-600", hoverBorder: "hover:border-primary-500 hover:shadow-primary-500/10", activeBorder: "border-primary-500 bg-primary-50", icon: CircleDashed, label: "Option C" },
    { bg: "bg-white", iconBg: "bg-rose-100", text: "text-gray-900", iconText: "text-rose-600", hoverBorder: "hover:border-rose-500 hover:shadow-rose-500/10", activeBorder: "border-rose-500 bg-rose-50", icon: CircleDot, label: "Option D" },
  ];

  return (
    <div className="bg-[#fbf9f8] h-full w-full rounded-3xl relative overflow-hidden flex flex-col font-bn text-gray-900 shadow-inner">
      {/* Background Texture Overlay */}
      <div className="absolute inset-0 opacity-40 pointer-events-none z-0" style={{ backgroundImage: "radial-gradient(#5341cd 0.6px, transparent 0.6px)", backgroundSize: "24px 24px" }} />
      
      {/* Decorative Graphics */}
      <div className="absolute bottom-20 -left-16 opacity-[0.04] pointer-events-none hidden md:block rotate-[15deg] z-0">
        <Sparkles className="w-80 h-80 text-[#5341cd]" />
      </div>
      <div className="absolute top-24 -right-16 opacity-[0.04] pointer-events-none hidden md:block -rotate-[15deg] z-0">
        <Globe className="w-96 h-96 text-orange-600" />
      </div>

      {/* Top Header */}
      <header className="bg-white/80 backdrop-blur-xl w-full z-20 flex justify-between items-center px-6 sm:px-10 py-4 shadow-[0_4px_30px_rgba(0,0,0,0.02)] border-b border-gray-100/50">
        <div className="text-xl sm:text-2xl font-extrabold text-[#5341CD] tracking-wide">{quiz.title_bn || quiz.title}</div>
        <div className="flex items-center gap-4">
          <button className="text-gray-400 hover:text-gray-600 hover:scale-105 transition-all">
            <Timer className="w-6 h-6" />
          </button>
          <button onClick={() => onClose ? onClose() : router.back()} className="text-gray-400 hover:text-gray-600 hover:scale-105 transition-all outline-none">
            <XCircle className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col items-center gap-6 sm:gap-10 relative z-10 overflow-y-auto">
        
        {/* Progress & Stats Segment */}
        <section className="w-full space-y-4 sm:space-y-6">
          <div className="flex justify-between items-end mb-2">
            <span className="text-[#5341cd] font-bold text-base sm:text-lg">প্রশ্ন {currentQNum} / {currentTotalQuestions}</span>
            <div className="bg-[#e4dfff] px-4 py-1.5 rounded-full text-[#4029ba] font-bold text-xs sm:text-sm tracking-widest shadow-sm">
              {q.points} পয়েন্ট
            </div>
          </div>
          
          {/* Rocket Progress Timeline */}
          <div className="relative h-3 sm:h-4 w-full bg-[#eae8e7] rounded-full drop-shadow-inner border border-gray-200">
            <div className="absolute top-0 left-0 h-full bg-[#6c5ce7] rounded-full transition-all duration-700 ease-out" style={{ width: `${progressPct}%` }} />
            <div className="absolute top-1/2 -translate-y-1/2 bg-white p-1.5 sm:p-2 rounded-full shadow-lg border-2 border-[#5341cd] transition-all duration-700 ease-out flex items-center justify-center" style={{ left: `calc(${progressPct}% - 16px)` }}>
              <Rocket className="w-3 h-3 sm:w-4 sm:h-4 text-[#5341cd]" />
            </div>
          </div>

          {/* Time Limit Glow Bar */}
          {timeLeft !== null && (
            <div className="w-full space-y-2 pt-2 sm:pt-4">
              <div className="flex items-center gap-2 text-[#474554] text-xs sm:text-sm font-bold tracking-wide">
                <Clock className="w-4 h-4 text-orange-500" />
                <span>সময় বাকি: <span className={`font-mono ml-2 ${timeLeft < 30 ? "text-red-500 animate-pulse" : ""}`}>{formatTime(timeLeft)}</span></span>
              </div>
              <div className="h-1.5 w-full bg-[#dcd9d9] rounded-full overflow-hidden shadow-inner">
                <div className="h-full bg-orange-400 shadow-[0_0_12px_rgba(255,137,42,0.6)] rounded-full transition-all duration-1000 ease-linear" style={{ width: `${100 - timeProgressPct}%` }} />
              </div>
            </div>
          )}
        </section>

        {/* Question Presentation Card */}
        <section className="w-full bg-white rounded-2xl p-6 sm:p-12 shadow-[0_15px_40px_rgba(27,28,28,0.06)] relative overflow-hidden border border-gray-100">
          <div className="absolute top-0 left-0 w-2 shrink-0 h-full bg-[#6c5ce7]" />
          <h2 className="text-2xl sm:text-4xl font-extrabold text-[#1b1c1c] text-center leading-[1.3] pl-2 sm:pl-0">
            {q.question_text_bn || q.question_text}
          </h2>
        </section>

        {/* Options Bento Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full">
          {q.options.map((opt: any, index: number) => {
            const isSelected = answers[q.id] === opt.id;
            const style = optionStyles[index % 4];
            
            return (
              <button
                key={opt.id}
                onClick={() => selectAnswer(q.id, opt.id)}
                className={`group relative p-5 sm:p-6 rounded-2xl flex items-center gap-4 sm:gap-6 text-left transition-all duration-300 active:scale-[0.98] border-2 shadow-sm ${
                  isSelected ? style.activeBorder : `border-transparent ${style.hoverBorder} ${style.bg}`
                }`}
              >
                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full ${style.iconBg} flex items-center justify-center transition-transform group-hover:rotate-12 shrink-0`}>
                  <style.icon className={`w-7 h-7 sm:w-8 sm:h-8 ${style.iconText} ${isSelected ? 'fill-current' : ''}`} />
                </div>
                <div className="flex-1">
                  <span className="block text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 font-sans">{style.label}</span>
                  <span className={`text-xl sm:text-2xl font-bold font-bn ${style.text}`}>{opt.option_text_bn || opt.option_text}</span>
                </div>
                {isSelected && (
                  <div className="absolute top-4 right-4 animate-in zoom-in spin-in-180 duration-300">
                    <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8 text-green-500" />
                  </div>
                )}
              </button>
            );
          })}
        </section>
      </main>

      {/* Bottom Action Shell */}
      <footer className="w-full bg-white/90 backdrop-blur-xl px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-between gap-4 border-t border-gray-100 z-20 shadow-[0_-15px_40px_rgba(0,0,0,0.03)]">
        <button 
          onClick={() => handleNext()}
          className="px-6 sm:px-8 py-3.5 sm:py-4 rounded-full font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors flex items-center gap-2 text-sm sm:text-base hidden sm:flex font-bn active:bg-gray-200"
        >
          <SkipForward className="w-5 h-5" />
          এড়িয়ে যাও
        </button>
        
        <div className="flex-1 sm:flex-none flex items-center justify-end w-full sm:w-auto">
          <button 
            onClick={currentQNum === currentTotalQuestions ? handleSubmit : handleNext}
            disabled={!answers[q.id] && submitting}
            className={`group px-8 sm:px-10 py-3.5 sm:py-4 rounded-full font-bold text-lg sm:text-xl flex items-center justify-center w-full sm:w-auto gap-3 transition-all ${
              answers[q.id] 
                ? 'bg-[#5341CD] text-white shadow-xl shadow-primary-600/30 hover:shadow-primary-600/50 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              currentQNum === currentTotalQuestions ? "সাবমিট করো" : "পরবর্তী প্রশ্ন"
            )}
            {!submitting && <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />}
          </button>
        </div>
      </footer>
    </div>
  );
}
