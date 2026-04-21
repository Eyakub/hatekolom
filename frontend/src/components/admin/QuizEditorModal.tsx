"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Save, Loader2, PlayCircle } from "lucide-react";
import { api } from "@/lib/api";

interface Option {
  id?: string;
  option_text: string;
  option_text_bn: string;
  is_correct: boolean;
  sort_order: number;
}

interface Question {
  id?: string;
  question_text: string;
  question_text_bn: string;
  question_type: string;
  points: number;
  sort_order: number;
  options: Option[];
}

interface Quiz {
  id?: string;
  title: string;
  title_bn: string;
  description: string;
  pass_percentage: number;
  time_limit_seconds: number | "";
  questions: Question[];
}

export default function QuizEditorModal({ 
  lessonId, 
  lessonName, 
  accessToken, 
  onClose 
}: { 
  lessonId: string; 
  lessonName: string; 
  accessToken: string; 
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isExisting, setIsExisting] = useState(false);
  
  const [quiz, setQuiz] = useState<Quiz>({
    title: "",
    title_bn: lessonName,
    description: "",
    pass_percentage: 60,
    time_limit_seconds: "",
    questions: [],
  });

  useEffect(() => {
    loadQuiz();
  }, [lessonId]);

  const loadQuiz = async () => {
    try {
      const data: any = await api.get(`/quizzes/lesson/${lessonId}/admin`, accessToken);
      setIsExisting(true);
      setQuiz({
        id: data.id,
        title: data.title || "",
        title_bn: data.title_bn || "",
        description: data.description || "",
        pass_percentage: data.pass_percentage || 60,
        time_limit_seconds: data.time_limit_seconds || "",
        questions: data.questions || [],
      });
    } catch {
      setIsExisting(false);
      // Wait, let's add one empty question by default if new
      setQuiz(prev => ({
        ...prev,
        questions: [{
          question_text: "", question_text_bn: "", question_type: "mcq", points: 1, sort_order: 0,
          options: [
            { option_text: "", option_text_bn: "ক", is_correct: true, sort_order: 0 },
            { option_text: "", option_text_bn: "খ", is_correct: false, sort_order: 1 },
            { option_text: "", option_text_bn: "গ", is_correct: false, sort_order: 2 },
            { option_text: "", option_text_bn: "ঘ", is_correct: false, sort_order: 3 }
          ]
        }]
      }));
    }
    setLoading(false);
  };

  const addQuestion = () => {
    setQuiz(prev => ({
      ...prev,
      questions: [
        ...prev.questions,
        {
          question_text: "", question_text_bn: "", question_type: "mcq", points: 1, sort_order: prev.questions.length,
          options: [
            { option_text: "", option_text_bn: "ক", is_correct: true, sort_order: 0 },
            { option_text: "", option_text_bn: "খ", is_correct: false, sort_order: 1 },
            { option_text: "", option_text_bn: "গ", is_correct: false, sort_order: 2 },
            { option_text: "", option_text_bn: "ঘ", is_correct: false, sort_order: 3 }
          ]
        }
      ]
    }));
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    setQuiz(prev => {
      const newQs = [...prev.questions];
      newQs[index] = { ...newQs[index], [field]: value };
      return { ...prev, questions: newQs };
    });
  };

  const deleteQuestion = (index: number) => {
    setQuiz(prev => {
      const newQs = prev.questions.filter((_, i) => i !== index);
      return { ...prev, questions: newQs };
    });
  };

  const updateOption = (qIndex: number, oIndex: number, field: keyof Option, value: any) => {
    setQuiz(prev => {
      const newQs = [...prev.questions];
      const newOpts = [...newQs[qIndex].options];
      newOpts[oIndex] = { ...newOpts[oIndex], [field]: value };
      newQs[qIndex].options = newOpts;
      return { ...prev, questions: newQs };
    });
  };

  const setCorrectOption = (qIndex: number, oIndex: number) => {
    setQuiz(prev => {
      const newQs = [...prev.questions];
      const newOpts = newQs[qIndex].options.map((opt, i) => ({
        ...opt,
        is_correct: i === oIndex
      }));
      newQs[qIndex].options = newOpts;
      return { ...prev, questions: newQs };
    });
  };

  const saveQuiz = async () => {
    if (quiz.questions.length === 0) {
      import("@/stores/toast-store").then(m => m.toast.error("অন্তত একটি প্রশ্ন যোগ করুন"));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        lesson_id: lessonId,
        title: quiz.title,
        title_bn: quiz.title_bn,
        description: quiz.description,
        pass_percentage: quiz.pass_percentage,
        time_limit_seconds: quiz.time_limit_seconds ? parseInt(String(quiz.time_limit_seconds)) : null,
        questions: quiz.questions.map((q, i) => ({
          question_text: q.question_text || q.question_text_bn,
          question_text_bn: q.question_text_bn || q.question_text,
          question_type: q.question_type,
          points: q.points,
          sort_order: i,
          options: q.options.map((o, j) => ({
            option_text: o.option_text || o.option_text_bn,
            option_text_bn: o.option_text_bn || o.option_text,
            is_correct: o.is_correct,
            sort_order: j
          }))
        }))
      };

      if (isExisting) {
        await api.put(`/quizzes/lesson/${lessonId}`, payload, accessToken);
        import("@/stores/toast-store").then(m => m.toast.success("কুইজ আপডেট হয়েছে!"));
      } else {
        await api.post(`/quizzes/`, payload, accessToken);
        import("@/stores/toast-store").then(m => m.toast.success("নতুন কুইজ তৈরি হয়েছে!"));
      }
      onClose();
    } catch {
      import("@/stores/toast-store").then(m => m.toast.error("কুইজ সেভ করতে সমস্যা হয়েছে"));
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-4xl w-full flex flex-col max-h-[90vh] shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50 shrink-0">
          <div>
            <h2 className="text-xl font-bold font-bn text-gray-900 flex items-center gap-2">
              <PlayCircle className="w-5 h-5 text-purple-600" /> কুইজ এডিটর: {lessonName}
            </h2>
            <p className="text-sm text-gray-500 font-bn mt-1">কুইজের প্রশ্ন এবং উত্তরগুলো এখানে সেট করুন</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
        </div>
        
        <div className="overflow-y-auto p-6 flex-1 bg-gray-50/50 space-y-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
          ) : (
            <>
              {/* General Config */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="font-bold text-gray-800 font-bn border-b border-gray-100 pb-2">কুইজ বেসিক সেলটিংস</h3>
                
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">কুইজের শিরোনাম</label>
                  <input 
                    type="text" 
                    value={quiz.title_bn || ""} 
                    onChange={e => setQuiz(p => ({ ...p, title_bn: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn" 
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">পাস মার্ক (%)</label>
                    <input 
                      type="number" 
                      min="1" max="100"
                      value={quiz.pass_percentage || ""} 
                      onChange={e => setQuiz(p => ({ ...p, pass_percentage: parseInt(e.target.value) || 60 }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1 font-bn">সময় (সেকেন্ডে) - অপশনাল</label>
                    <input 
                      type="number" 
                      placeholder="যেমন: 600"
                      value={quiz.time_limit_seconds || ""} 
                      onChange={e => setQuiz(p => ({ ...p, time_limit_seconds: e.target.value ? Number(e.target.value) : "" }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400 font-bn" 
                    />
                  </div>
                </div>
              </div>

              {/* Questions */}
              <div className="space-y-4">
                <h3 className="font-bold text-gray-800 font-bn text-lg flex items-center justify-between">
                  <span>প্রশ্নসমূহ ({quiz.questions.length})</span>
                </h3>
                
                {quiz.questions.map((q, qIndex) => (
                  <div key={qIndex} className="bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden">
                    <div className="bg-blue-50/50 p-4 border-b border-blue-100 flex items-start flex-col gap-3">
                      <div className="flex w-full justify-between items-center">
                        <span className="font-bold text-blue-800 font-bn">প্রশ্ন {qIndex + 1}</span>
                        <button onClick={() => deleteQuestion(qIndex)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="w-full">
                        <input 
                          type="text" 
                          placeholder="প্রশ্ন লিখুন..."
                          value={q.question_text_bn || ""} 
                          onChange={e => updateQuestion(qIndex, 'question_text_bn', e.target.value)}
                          className="w-full px-4 py-3 rounded-lg border border-blue-200 bg-white text-gray-900 outline-none focus:border-blue-400 font-bn font-semibold" 
                        />
                      </div>
                    </div>
                    
                    <div className="p-4 bg-gray-50/30">
                      <p className="text-xs font-bold text-gray-400 mb-3 font-bn">সঠিক উত্তর নির্বাচন করুন:</p>
                      <div className="space-y-2">
                        {q.options.map((opt, oIndex) => (
                          <div key={oIndex} className={`flex items-center gap-3 p-2 rounded-lg border transition-colors ${opt.is_correct ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white hover:border-blue-300'}`}>
                            <button 
                              onClick={() => setCorrectOption(qIndex, oIndex)}
                              className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center border-2 ${opt.is_correct ? 'border-green-600 bg-green-600' : 'border-gray-300 bg-white'}`}
                            >
                              {opt.is_correct && <div className="w-2 h-2 bg-white rounded-full" />}
                            </button>
                            <input 
                              type="text" 
                              placeholder={`অপশন ${oIndex + 1}`}
                              value={opt.option_text_bn || ""} 
                              onChange={e => updateOption(qIndex, oIndex, 'option_text_bn', e.target.value)}
                              className="w-full bg-transparent border-none outline-none font-bn text-sm text-gray-700" 
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                
                <button 
                  onClick={addQuestion}
                  className="w-full py-4 border-2 border-dashed border-purple-200 text-purple-600 bg-purple-50/50 hover:bg-purple-50 hover:border-purple-300 rounded-xl font-bold font-bn flex items-center justify-center gap-2 transition-all"
                >
                  <Plus className="w-5 h-5" /> নতুন প্রশ্ন যোগ করুন
                </button>
              </div>
            </>
          )}
        </div>
        
        <div className="p-5 border-t border-gray-100 bg-white shrink-0 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-100 font-bn transition-colors">
            বাতিল
          </button>
          <button 
            disabled={loading || saving} 
            onClick={saveQuiz}
            className="px-8 py-2.5 rounded-xl font-bold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2 font-bn transition-colors shadow-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            সেভ করুন
          </button>
        </div>
      </div>
    </div>
  );
}
