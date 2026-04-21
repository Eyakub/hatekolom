"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2, XCircle, ArrowRight, ArrowLeft, Loader2,
  Trophy, Clock, AlertCircle, RotateCcw,
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

function QuizContent() {
  const searchParams = useSearchParams();
  const lessonId = searchParams?.get("lesson");
  const router = useRouter();
  const { accessToken, user } = useAuthStore();

  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

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
      if (data.time_limit_seconds) setTimeLeft(data.time_limit_seconds);
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
    } catch (err: any) {
      import("@/stores/toast-store").then(m => m.toast.error("সাবমিট করা যায়নি"));
    }
    setSubmitting(false);
  };

  const retryQuiz = () => {
    setAnswers({});
    setResult(null);
    if (quiz?.time_limit_seconds) setTimeLeft(quiz.time_limit_seconds);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      </>
    );
  }

  if (!quiz) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-bn">এই লেসনে কোনো কুইজ নেই</p>
            <button onClick={() => router.back()} className="mt-4 text-primary-600 font-semibold text-sm hover:underline font-bn">
              <ArrowLeft className="w-4 h-4 inline mr-1" />ফিরে যাও
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50 pt-20 pb-12 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold font-bn text-gray-900">{quiz.title_bn || quiz.title}</h1>
                {quiz.description && <p className="text-sm text-gray-500 mt-1 font-bn">{quiz.description}</p>}
                <p className="text-xs text-gray-400 mt-2 font-bn">
                  {quiz.questions.length} টি প্রশ্ন • পাস মার্ক {quiz.pass_percentage}%
                </p>
              </div>
              {timeLeft !== null && !result && (
                <div className={`px-4 py-2 rounded-xl font-mono font-bold text-lg ${
                  timeLeft < 30 ? "bg-red-50 text-red-600 animate-pulse" : "bg-primary-50 text-primary-700"
                }`}>
                  <Clock className="w-4 h-4 inline mr-1" />
                  {formatTime(timeLeft)}
                </div>
              )}
            </div>

            {/* Previous attempt */}
            {quiz.last_attempt && !result && (
              <div className={`mt-3 p-3 rounded-lg text-sm font-bn ${quiz.last_attempt.passed ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                শেষ চেষ্টা: {parseFloat(quiz.last_attempt.score).toFixed(0)}% ({quiz.last_attempt.passed ? "পাস ✓" : "ফেল ✗"})
              </div>
            )}
          </div>

          {/* Result Card */}
          {result && (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", bounce: 0.5, duration: 0.6 }}
              className={`relative rounded-3xl border-2 p-8 mb-8 text-center shadow-xl overflow-hidden ${
                result.passed ? "bg-gradient-to-b from-green-50 to-white border-green-200" : "bg-gradient-to-b from-red-50 to-white border-red-200"
              }`}
            >
              {result.passed ? <HappyParticles /> : <SadParticles />}
              
              <motion.div 
                initial={{ scale: 0, y: result.passed ? 100 : -200 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: "spring", bounce: 0.6, duration: 0.8 }}
                className="relative z-10 w-40 h-40 mx-auto mb-6 drop-shadow-xl"
              >
                <img 
                  src={result.passed 
                    ? `https://api.dicebear.com/7.x/fun-emoji/svg?seed=Felix&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf` 
                    : `https://api.dicebear.com/7.x/fun-emoji/svg?seed=Snookums&mouth=sad&eyes=closed&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`} 
                  alt="Result Avatar" 
                  className={`w-full h-full rounded-full border-4 border-white shadow-xl object-cover ${result.passed ? 'bg-green-50' : 'bg-red-50 brightness-95 grayscale-[15%]'}`} 
                />
                
                {/* Embedded VFX based on result */}
                {result.passed ? (
                  [...Array(6)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
                      animate={{ 
                        opacity: [1, 1, 0],
                        scale: [0, 1.2, 0], 
                        x: Math.cos(i * (Math.PI / 3)) * 140, 
                        y: Math.sin(i * (Math.PI / 3)) * 140,
                        rotate: Math.random() * 360
                      }}
                      transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
                      className="absolute inset-0 m-auto text-4xl flex items-center justify-center w-10 h-10 pointer-events-none"
                    >
                      ⭐
                    </motion.div>
                  ))
                ) : (
                  <motion.div
                    initial={{ y: 0, x: 20, opacity: 0, scale: 0 }}
                    animate={{ y: [0, 70, 90], opacity: [0, 1, 0], scale: [0, 1, 1] }}
                    transition={{ duration: 1.5, delay: 0.6, repeat: 2, ease: "easeIn" }}
                    className="absolute bottom-2 right-4 text-4xl pointer-events-none"
                  >
                    💧
                  </motion.div>
                )}
              </motion.div>

              <motion.h2 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-3xl font-bold font-bn relative z-10"
              >
                {result.passed ? "অভিনন্দন! 🎉" : "আবার চেষ্টা করো 💪"}
              </motion.h2>

              <motion.p 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", bounce: 0.7, delay: 0.6 }}
                className={`text-5xl font-black mt-3 font-mono relative z-10 drop-shadow-sm ${result.passed ? "text-green-600" : "text-red-500"}`}
              >
                {parseFloat(result.score).toFixed(0)}%
              </motion.p>
              
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-sm text-gray-500 font-bn mt-2 relative z-10 font-bold"
              >
                {result.earned_points} / {result.total_points} পয়েন্ট
              </motion.p>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, type: "spring" }}
                className="flex justify-center gap-3 mt-6 relative z-10"
              >
                {!result.passed && (
                  <button onClick={retryQuiz} className="px-5 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold hover:bg-gray-50 focus:ring-4 focus:ring-gray-100 transition-all font-bn flex items-center gap-2 shadow-sm">
                    <RotateCcw className="w-4 h-4" /> আবার চেষ্টা
                  </button>
                )}
                <button onClick={() => router.back()} className="px-6 py-3 bg-primary-700 text-white rounded-xl text-sm font-bold hover:bg-primary-800 hover:-translate-y-0.5 focus:ring-4 focus:ring-primary-100 transition-all shadow-md font-bn flex items-center gap-2">
                  <ArrowLeft className="w-5 h-5" /> কোর্সে ফিরে যাও
                </button>
              </motion.div>
            </motion.div>
          )}

          {/* Questions */}
          <div className="space-y-4">
            {quiz.questions.map((q: any, qi: number) => {
              const resultQ = result?.results?.find((r: any) => r.question_id === q.id);
              return (
                <div key={q.id} className={`bg-white rounded-xl border p-5 shadow-sm transition-all ${
                  resultQ ? (resultQ.is_correct ? "border-green-200" : "border-red-200") : "border-gray-100"
                }`}>
                  <p className="font-semibold text-sm text-gray-900 font-bn mb-3">
                    <span className="text-primary-600 font-mono mr-2">{qi + 1}.</span>
                    {q.question_text_bn || q.question_text}
                    <span className="ml-2 text-[10px] text-gray-400 font-normal">({q.points} পয়েন্ট)</span>
                  </p>
                  <div className="space-y-2">
                    {q.options.map((opt: any) => {
                      const isSelected = answers[q.id] === opt.id;
                      const showResult = !!resultQ;
                      const isCorrectOption = resultQ?.options?.find((o: any) => o.id === opt.id)?.is_correct;

                      let optionStyle = "border-gray-200 hover:border-primary-300 hover:bg-primary-50/30 cursor-pointer";
                      if (isSelected && !showResult) optionStyle = "border-primary-500 bg-primary-50 ring-2 ring-primary-200";
                      if (showResult && isCorrectOption) optionStyle = "border-green-500 bg-green-50";
                      if (showResult && isSelected && !isCorrectOption) optionStyle = "border-red-400 bg-red-50";
                      if (showResult) optionStyle += " cursor-default";

                      return (
                        <button
                          key={opt.id}
                          onClick={() => selectAnswer(q.id, opt.id)}
                          disabled={!!result}
                          className={`w-full text-left px-4 py-3 rounded-lg border-2 text-sm transition-all flex items-center gap-3 ${optionStyle}`}
                        >
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            isSelected ? "border-primary-500 bg-primary-500" : "border-gray-300"
                          }`}>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <span className="font-bn flex-1">{opt.option_text_bn || opt.option_text}</span>
                          {showResult && isCorrectOption && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />}
                          {showResult && isSelected && !isCorrectOption && <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Submit */}
          {!result && (
            <div className="mt-6">
              <button
                onClick={handleSubmit}
                disabled={submitting || Object.keys(answers).length === 0}
                className="w-full py-4 bg-primary-700 text-white font-bold rounded-xl hover:bg-primary-800 transition-all text-lg disabled:opacity-50 font-bn flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>সাবমিট করো <ArrowRight className="w-5 h-5" /></>
                )}
              </button>
              <p className="text-center text-xs text-gray-400 mt-2 font-bn">
                {Object.keys(answers).length} / {quiz.questions.length} টি উত্তর দেওয়া হয়েছে
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>}>
      <QuizContent />
    </Suspense>
  );
}
