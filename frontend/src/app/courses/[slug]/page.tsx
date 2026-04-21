"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen, Clock, Users, Star, Play, FileText, Lock,
  ShoppingCart, ChevronRight, Loader2, CheckCircle2,
  MessageSquare, Send, GraduationCap,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { motion, AnimatePresence } from "motion/react";
import { useCartStore } from "@/stores/cart-store";
import { toast } from "@/stores/toast-store";
import { useLocaleStore } from "@/stores/locale-store";

interface CourseDetail {
  id: string;
  product_id: string;
  course_type: string;
  level: string | null;
  age_min: number | null;
  age_max: number | null;
  total_lessons: number;
  total_quizzes: number;
  preview_video_url: string | null;
  is_featured: boolean;
  instructor: {
    id: string;
    name: string;
    name_bn: string | null;
    designation: string | null;
    designation_bn: string | null;
    bio: string | null;
    bio_bn: string | null;
    profile_image_url: string | null;
  } | null;
  product: {
    id: string;
    title: string;
    title_bn: string | null;
    slug: string;
    description: string | null;
    description_bn: string | null;
    thumbnail_url: string | null;
    price: number;
    compare_price: number | null;
    is_free: boolean;
  };
  modules: {
    id: string;
    title: string;
    title_bn: string | null;
    sort_order: number;
    is_free: boolean;
    lessons: {
      id: string;
      title: string;
      title_bn: string | null;
      lesson_type: string;
      sort_order: number;
      duration_seconds: number | null;
      is_free: boolean;
      content?: string | null;
      content_bn?: string | null;
      video?: { youtube_id: string } | null;
    }[];
  }[];
}

export default function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { addItem } = useCartStore();
  const { t } = useLocaleStore();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "syllabus" | "faq" | "reviews">("overview");
  const [reviews, setReviews] = useState<any>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [cartAdded, setCartAdded] = useState(false);
  const [attachedExams, setAttachedExams] = useState<any[]>([]);
  const [previewLesson, setPreviewLesson] = useState<any>(null);
  const { accessToken } = useAuthStore();

  useEffect(() => {
    const load = async () => {
      try {
        const data: any = await api.get(`/courses/slug/${slug}`);
        setCourse(data);
      } catch {
        setCourse(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  useEffect(() => {
    if (!course) return;
    const loadReviews = async () => {
      try {
        const data: any = await api.get(`/feedback/course/${course.id}/reviews`);
        setReviews(data);
      } catch {}
    };
    loadReviews();
  }, [course]);

  useEffect(() => {
    if (!course) return;
    api.get(`/exams/product/${course.product.id}/attached`).then((data: any) => {
      setAttachedExams(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, [course]);

  const submitReview = async () => {
    if (!course || !accessToken || submittingReview || !reviewComment.trim()) return;
    if (/https?:\/\/|www\.|[a-z0-9-]+\.(com|org|net|io|dev|co|me|info|biz|xyz|bd|in)\b/i.test(reviewComment)) {
      toast.error("রিভিউতে লিংক দেওয়া যাবে না");
      return;
    }
    setSubmittingReview(true);
    try {
      await api.post("/feedback/", {
        course_id: course.id,
        feedback_type: "review",
        rating: reviewRating,
        message: reviewComment.trim(),
      }, accessToken);
      const data: any = await api.get(`/feedback/course/${course.id}/reviews`);
      setReviews(data);
      setReviewComment("");
      setReviewRating(5);
      toast.success("রিভিউ সাবমিট হয়েছে");
    } catch (err: any) {
      toast.error(err.message || "ত্রুটি");
    }
    setSubmittingReview(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-center p-8">
          <div>
            <BookOpen className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-400 font-bn">কোর্স পাওয়া যায়নি</h1>
            <Link href="/courses" className="text-primary-700 text-sm mt-2 inline-block hover:underline">
              ← সকল কোর্সে ফিরে যাও
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const totalDuration = course.modules.reduce(
    (acc, m) => acc + m.lessons.reduce((a, l) => a + (l.duration_seconds || 0), 0),
    0
  );
  const totalHours = Math.floor(totalDuration / 3600);
  const totalMins = Math.floor((totalDuration % 3600) / 60);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Hero */}
      <div className="bg-gradient-hero">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="grid md:grid-cols-3 gap-8 items-start">
            {/* Info (left 2 cols) */}
            <div className="md:col-span-2 text-white">
              <div className="flex items-center gap-2 mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  course.course_type === "live" ? "bg-red-500/80" : "bg-white/20"
                }`}>
                  {course.course_type === "live" ? "লাইভ" : "রেকর্ডেড"}
                </span>
                {course.is_featured && (
                  <span className="px-2 py-1 rounded-full bg-yellow-400 text-yellow-900 text-xs font-semibold flex items-center gap-1">
                    <Star className="w-3 h-3" /> জনপ্রিয়
                  </span>
                )}
              </div>

              <h1 className="text-3xl md:text-4xl font-bold font-bn leading-tight mb-3">
                {course.product.title_bn || course.product.title}
              </h1>

              {/* Rating & Reviews */}
              {reviews && reviews.total > 0 && (
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={`w-4 h-4 ${s <= Math.round(reviews.average_rating) ? "text-amber-400 fill-amber-400" : "text-white/30"}`} />
                    ))}
                  </div>
                  <span className="text-white font-bold text-sm">{reviews.average_rating}</span>
                  <span className="text-white/50 text-sm">({reviews.total} {t("রিভিউ", "Reviews")})</span>
                </div>
              )}

              <p className="text-white/70 font-bn mb-6 max-w-2xl leading-relaxed">
                {course.product.description_bn || course.product.description || ""}
              </p>

              {/* Stats */}
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-2 text-white/80">
                  <BookOpen className="w-4 h-4" />
                  <span className="font-bn">{course.total_lessons} টি ক্লাস</span>
                </div>
                {totalDuration > 0 && (
                  <div className="flex items-center gap-2 text-white/80">
                    <Clock className="w-4 h-4" />
                    <span className="font-bn">
                      {totalHours > 0 ? `${totalHours} ঘণ্টা ` : ""}{totalMins} মিনিট
                    </span>
                  </div>
                )}
                {course.age_min && (
                  <div className="flex items-center gap-2 text-white/80">
                    <Users className="w-4 h-4" />
                    <span className="font-bn">বয়স: {course.age_min}–{course.age_max || "১৩"}</span>
                  </div>
                )}
              </div>

              {/* Attached Exams Badge in Hero */}
              {attachedExams.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-3">
                  {attachedExams.map((exam: any) => (
                    <Link
                      key={exam.exam_id}
                      href={`/exams/${exam.slug}`}
                      className="group flex items-center gap-2.5 px-4 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-xl transition-all"
                    >
                      <GraduationCap className="w-4 h-4 text-amber-300" />
                      <div>
                        <p className="text-sm font-bold text-white leading-none">
                          {exam.title_bn || exam.title}
                        </p>
                        <p className="text-[10px] text-white/60 mt-0.5">
                          {exam.total_sections} {t("সেকশন", "sections")} · {exam.total_questions} {t("প্রশ্ন", "questions")}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white/70 group-hover:translate-x-0.5 transition-all" />
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Price card (right col) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, type: "spring" }}
              className="bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden transform-gpu border border-gray-100"
            >
              {/* Thumbnail with play button */}
              <div className="relative h-48 bg-gray-900 flex items-center justify-center">
                {course.product.thumbnail_url ? (
                  <img src={course.product.thumbnail_url} alt="" className="w-full h-full object-cover opacity-90" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600" />
                )}
                {course.preview_video_url && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                      <Play className="w-6 h-6 text-primary-700 ml-0.5" />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6">
                {/* Price */}
                {course.product.is_free ? (
                  <p className="text-3xl font-bold text-green-600 font-bn mb-4">{t("ফ্রি", "Free")}</p>
                ) : (
                  <div className="mb-4">
                    {course.product.compare_price && (
                      <p className="text-sm text-gray-400 line-through font-bn">৳{course.product.compare_price}</p>
                    )}
                    <p className="text-3xl font-bold text-gray-900">৳{course.product.price}</p>
                  </div>
                )}

                {/* CTA Buttons */}
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  {!course.product.is_free && attachedExams.length > 0 ? (
                    <button
                      onClick={() => {
                        addItem({
                          productId: course.product.id,
                          productType: "course",
                          title: course.product.title,
                          title_bn: course.product.title_bn,
                          thumbnail_url: course.product.thumbnail_url,
                          price: course.product.price,
                          compare_price: course.product.compare_price,
                          maxQuantity: 1,
                          slug: course.product.slug,
                        });
                        attachedExams.forEach((exam: any) => {
                          addItem({
                            productId: exam.product_id,
                            productType: "exam",
                            title: exam.title,
                            title_bn: exam.title_bn,
                            thumbnail_url: exam.thumbnail_url,
                            price: exam.is_free ? 0 : exam.price,
                            compare_price: null,
                            maxQuantity: 1,
                            slug: exam.slug,
                            attachedTo: course.product.id,
                          });
                        });
                        router.push("/checkout?source=cart");
                      }}
                      className="w-full inline-flex items-center justify-center gap-2 py-3.5 bg-primary-700 text-white font-bold rounded-xl hover:bg-primary-800 transition-colors shadow-lg shadow-primary-700/25 font-bn text-base"
                    >
                      {t("এখনই ভর্তি হও", "Enroll Now")}
                    </button>
                  ) : (
                    <Link
                      href={`/checkout?product=${course.product.id}`}
                      className="w-full inline-flex items-center justify-center gap-2 py-3.5 bg-primary-700 text-white font-bold rounded-xl hover:bg-primary-800 transition-colors shadow-lg shadow-primary-700/25 font-bn text-base"
                    >
                      {course.product.is_free ? t("ফ্রি ভর্তি হও", "Enroll Free") : t("এখনই ভর্তি হও", "Enroll Now")}
                    </Link>
                  )}
                </motion.div>

                {!course.product.is_free && (
                  <button
                    onClick={() => {
                      addItem({
                        productId: course.product.id,
                        productType: "course",
                        title: course.product.title,
                        title_bn: course.product.title_bn,
                        thumbnail_url: course.product.thumbnail_url,
                        price: course.product.price,
                        compare_price: course.product.compare_price,
                        maxQuantity: 1,
                        slug: course.product.slug,
                      });
                      // Auto-add attached exams (free or paid)
                      attachedExams.forEach((exam: any) => {
                        addItem({
                          productId: exam.product_id,
                          productType: "exam",
                          title: exam.title,
                          title_bn: exam.title_bn,
                          thumbnail_url: exam.thumbnail_url,
                          price: exam.is_free ? 0 : exam.price,
                          compare_price: null,
                          maxQuantity: 1,
                          slug: exam.slug,
                          attachedTo: course.product.id,
                        });
                      });
                      setCartAdded(true);
                      toast.success(t("কার্টে যোগ হয়েছে", "Added to cart"));
                      setTimeout(() => setCartAdded(false), 2000);
                    }}
                    className={`w-full mt-3 py-3 border-2 font-bold rounded-xl text-sm flex items-center justify-center gap-2 font-bn transition-all ${
                      cartAdded
                        ? "border-emerald-500 text-emerald-600 bg-emerald-50"
                        : "border-primary-200 text-primary-700 hover:bg-primary-50"
                    }`}
                  >
                    {cartAdded ? t("কার্টে যোগ হয়েছে ✓", "Added to Cart ✓") : t("কার্টে যোগ করো", "Add to Cart")}
                  </button>
                )}

                {/* Includes */}
                <div className="mt-6 space-y-3">
                  {[
                    t(`${course.total_lessons} টি রেকর্ডেড ক্লাস`, `${course.total_lessons} Recorded Classes`),
                    t("২৪/৭ লাইফটাইম অ্যাক্সেস", "Lifetime Access 24/7"),
                    t("কুইজ ও অনুশীলন সামগ্রী", "Quizzes & Practice Materials"),
                    t("প্রফেশনাল সার্টিফিকেশন", "Professional Certification"),
                    ...(attachedExams.length > 0 ? [t("পরীক্ষা অন্তর্ভুক্ত", "Includes Exam")] : []),
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3 text-sm text-gray-600">
                      <div className="w-5 h-5 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-primary-600" />
                      </div>
                      <span className="font-bn">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="flex gap-4 border-b border-gray-100 mb-8 relative">
          {(["overview", "syllabus", "faq", "reviews"] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-4 py-3 text-[15px] font-bold transition-colors font-bn ${
                  isActive ? "text-primary-800" : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {tab === "overview" ? "ওভারভিউ" : tab === "syllabus" ? "সিলেবাস" : tab === "faq" ? "জিজ্ঞাসা" : `রিভিউ${reviews?.total ? ` (${reviews.total})` : ""}`}
                
                {isActive && (
                  <motion.div
                    layoutId="course-tab-indicator"
                    className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-primary-700"
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="w-full"
          >
            {activeTab === "overview" && (
              <div className="prose prose-sm max-w-none font-bn space-y-8">
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">
              {course.product.description_bn || course.product.description || "কোর্সের বিবরণ শীঘ্রই আসছে..."}
            </p>
            
            {course.instructor && (
              <div className="mt-8 pt-8 border-t border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-6 font-bn">ইন্সট্রাক্টর</h3>
                <div className="flex items-start gap-4 p-6 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="w-20 h-20 rounded-full bg-white border-2 border-primary-100 overflow-hidden shrink-0 shadow-sm flex items-center justify-center">
                    {course.instructor.profile_image_url ? (
                      <img src={course.instructor.profile_image_url} alt={course.instructor.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-bold text-primary-300">{course.instructor.name[0]}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-bold text-gray-900 font-bn">
                      {course.instructor.name_bn || course.instructor.name}
                    </h4>
                    {(course.instructor.designation_bn || course.instructor.designation) && (
                      <p className="text-primary-600 font-semibold text-sm mb-2 font-bn">
                        {course.instructor.designation_bn || course.instructor.designation}
                      </p>
                    )}
                    {(course.instructor.bio_bn || course.instructor.bio) && (
                      <p className="text-gray-600 text-sm leading-relaxed font-bn">
                        {course.instructor.bio_bn || course.instructor.bio}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "syllabus" && (
          <div className="space-y-4">
            {course.modules
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((module, mi) => (
                <div key={module.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="p-4 bg-gray-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">
                        {mi + 1}
                      </span>
                      <h3 className="font-semibold font-bn text-gray-900 text-sm">
                        {module.title_bn || module.title}
                      </h3>
                    </div>
                    <span className="text-xs text-gray-400 font-bn">
                      {module.lessons.length} ক্লাস
                    </span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {module.lessons
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((lesson, li) => (
                        <div key={lesson.id}>
                          <div className={`flex items-center gap-3 px-4 py-3 ${lesson.is_free ? "hover:bg-primary-50/50 cursor-pointer transition-colors" : ""} ${previewLesson?.id === lesson.id ? "bg-primary-50/70" : ""}`}
                            onClick={() => {
                              if (!lesson.is_free) return;
                              setPreviewLesson(previewLesson?.id === lesson.id ? null : lesson);
                            }}
                          >
                            <span className="text-xs text-gray-400 w-8 text-right font-mono">
                              {mi + 1}.{li + 1}
                            </span>
                            <div className={`w-6 h-6 rounded flex items-center justify-center ${
                              lesson.lesson_type?.toLowerCase() === "video_lecture" ? "bg-blue-50 text-blue-600" : "bg-green-50 text-green-600"
                            }`}>
                              {lesson.lesson_type?.toLowerCase() === "video_lecture" ? (
                                <Play className="w-3 h-3" />
                              ) : (
                                <FileText className="w-3 h-3" />
                              )}
                            </div>
                            <span className="text-sm text-gray-700 font-bn flex-1">
                              {lesson.title_bn || lesson.title}
                            </span>
                            {lesson.is_free && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-bold flex items-center gap-1">
                                <Play className="w-2.5 h-2.5" />
                                {t("ফ্রি প্রিভিউ", "Free Preview")}
                              </span>
                            )}
                            {!lesson.is_free && (
                              <Lock className="w-3.5 h-3.5 text-gray-300" />
                            )}
                            {lesson.duration_seconds && (
                              <span className="text-xs text-gray-400">
                                {Math.floor(lesson.duration_seconds / 60)} {t("মিনিট", "min")}
                              </span>
                            )}
                          </div>

                          {/* Inline Preview */}
                          {previewLesson?.id === lesson.id && (
                            <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                              {lesson.video?.youtube_id ? (
                                <div className="mt-3 rounded-xl overflow-hidden aspect-video bg-black relative">
                                  <iframe
                                    src={`https://www.youtube-nocookie.com/embed/${lesson.video.youtube_id}?autoplay=1&modestbranding=1&rel=0&iv_load_policy=3`}
                                    className="w-full h-full"
                                    allow="autoplay; encrypted-media"
                                  />
                                </div>
                              ) : (lesson.content || lesson.content_bn) ? (
                                <div className="mt-3 p-4 bg-white rounded-xl border border-gray-100">
                                  <div
                                    className="prose prose-sm max-w-none font-bn"
                                    dangerouslySetInnerHTML={{ __html: lesson.content_bn || lesson.content || "" }}
                                  />
                                </div>
                              ) : (
                                <p className="mt-3 text-sm text-gray-400 font-bn text-center py-4">
                                  {t("প্রিভিউ পাওয়া যাচ্ছে না", "No preview available")}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              ))}
          </div>
        )}

        {activeTab === "faq" && (
          <div className="space-y-4 max-w-3xl">
            {[
              { q: "কোর্সে কীভাবে ভর্তি হবো?", a: "'কোর্সে ভর্তি হও' বাটনে ক্লিক করুন, পেমেন্ট করুন, এবং তৎক্ষণাৎ কোর্সে প্রবেশ পাবেন।" },
              { q: "কোর্সের মেয়াদ কত?", a: "কোর্সে লাইফটাইম অ্যাক্সেস পাবেন। যতবার খুশি দেখতে পারবেন।" },
              { q: "রিফান্ড পাওয়া যায়?", a: "কোর্সে ভর্তি হওয়ার ৭ দিনের মধ্যে রিফান্ড রিকোয়েস্ট করতে পারবেন।" },
            ].map((item) => (
              <div key={item.q} className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-900 font-bn">{item.q}</h3>
                <p className="text-sm text-gray-600 font-bn mt-2">{item.a}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === "reviews" && (
          <div className="max-w-3xl">
            {reviews && reviews.total > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6 flex items-center gap-6">
                <div className="text-center shrink-0">
                  <p className="text-4xl font-bold text-gray-900">{reviews.average_rating}</p>
                  <div className="flex items-center gap-0.5 mt-1 justify-center">
                    {[1, 2, 3, 4, 5].map((s: number) => (
                      <Star key={s} className={`w-4 h-4 ${s <= Math.round(reviews.average_rating) ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}`} />
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1 font-bn">{reviews.total} টি রিভিউ</p>
                </div>
                <div className="flex-1 space-y-1">
                  {[5, 4, 3, 2, 1].map((star: number) => {
                    const count = reviews.reviews?.filter((r: any) => r.rating === star).length || 0;
                    const pct = reviews.total > 0 ? (count / reviews.total) * 100 : 0;
                    return (
                      <div key={star} className="flex items-center gap-2 text-xs">
                        <span className="w-3 text-gray-400">{star}</span>
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-yellow-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-6 text-right text-gray-400">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {isAuthenticated && (
              <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
                <h3 className="font-semibold text-gray-900 font-bn mb-3">তোমার রিভিউ দাও</h3>
                <div className="flex items-center gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map((s: number) => (
                    <button key={s} onClick={() => setReviewRating(s)} className="p-0.5">
                      <Star className={`w-6 h-6 transition-colors ${s <= reviewRating ? "text-yellow-400 fill-yellow-400" : "text-gray-200 hover:text-yellow-300"}`} />
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={reviewComment}
                    onChange={e => setReviewComment(e.target.value)}
                    placeholder="তোমার মতামত লেখো..."
                    className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-bn outline-none focus:border-primary-400"
                  />
                  <button
                    onClick={submitReview}
                    disabled={submittingReview || !reviewComment.trim()}
                    className="px-4 py-2.5 bg-primary-700 text-white rounded-lg font-semibold text-sm hover:bg-primary-800 disabled:opacity-50 font-bn flex items-center gap-1.5"
                  >
                    <Send className="w-4 h-4" /> পাঠাও
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {reviews?.reviews?.map((r: any) => (
                <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="text-xs font-bold text-primary-700">{r.user_name?.charAt(0)?.toUpperCase() || "A"}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{r.user_name}</p>
                        <p className="text-[10px] text-gray-400">{new Date(r.created_at).toLocaleDateString("bn-BD")}</p>
                      </div>
                    </div>
                    {r.rating && (
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s: number) => (
                          <Star key={s} className={`w-3 h-3 ${s <= r.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}`} />
                        ))}
                      </div>
                    )}
                  </div>
                  {r.message && <p className="text-sm text-gray-600 font-bn mt-2">{r.message}</p>}
                </div>
              ))}
              {(!reviews?.reviews || reviews.reviews.length === 0) && (
                <div className="text-center py-8">
                  <MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400 font-bn">এখনো কোনো রিভিউ নেই</p>
                </div>
              )}
            </div>
          </div>
        )}
          </motion.div>
        </AnimatePresence>
      </div>

      <Footer />
    </div>
  );
}
