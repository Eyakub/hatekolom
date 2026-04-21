"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search, Filter, BookOpen, Play, Star, ChevronRight, X, SlidersHorizontal,
  ArrowUpDown, Users, GraduationCap,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { api } from "@/lib/api";
import { useLocaleStore } from "@/stores/locale-store";
import { motion, AnimatePresence } from "motion/react";

interface Course {
  id: string;
  course_type: string;
  level: string | null;
  age_min: number | null;
  age_max: number | null;
  total_lessons: number;
  is_featured: boolean;
  product: {
    id: string;
    title: string;
    title_bn: string | null;
    slug: string;
    thumbnail_url: string | null;
    price: number;
    compare_price: number | null;
    is_free: boolean;
  };
  instructor: {
    name: string;
    name_bn: string | null;
    profile_image_url: string | null;
  } | null;
}

function CoursesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(searchParams?.get("type") || "");
  const [sortBy, setSortBy] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Load categories
  useEffect(() => {
    const loadCats = async () => {
      try {
        const data: any = await api.get("/categories/?type=course");
        setCategories(Array.isArray(data) ? data : []);
      } catch { }
    };
    loadCats();
  }, []);

  // Sync URL when filter changes
  const handleTypeChange = (type: string) => {
    setTypeFilter(type);
    if (type) {
      router.push(`/courses?type=${type}`, { scroll: false });
    } else {
      router.push("/courses", { scroll: false });
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (typeFilter) params.append("course_type", typeFilter);
        if (typeFilter === "free") {
          params.delete("course_type");
          params.append("is_free", "true");
        }
        if (search) params.append("search", search);
        if (sortBy) params.append("sort_by", sortBy);
        if (categoryFilter) params.append("category_id", categoryFilter);

        const data: any = await api.get(`/courses/?${params.toString()}`);
        setCourses(Array.isArray(data) ? data : []);
      } catch {
        setCourses([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [typeFilter, search, sortBy, categoryFilter]);

  const { t: tRaw } = useLocaleStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const t = (bn: string, en: string) => (mounted ? tRaw(bn, en) : bn);

  const typeLabels: Record<string, string> = {
    "": t("সকল", "All"),
    live: t("লাইভ", "Live"),
    recorded: t("রেকর্ডেড", "Recorded"),
    free: t("ফ্রি", "Free"),
  };

  const typeColors: Record<string, string> = {
    live: "bg-red-100 text-red-700",
    recorded: "bg-purple-100 text-purple-700",
    free: "bg-green-100 text-green-700",
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Header */}
      <div className="bg-gradient-hero py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white font-bn">
            {t("আমাদের কোর্সসমূহ", "Our Courses")}
          </h1>
          <p className="text-white/70 font-bn mt-2">
            {t("তোমার পছন্দের কোর্স খুঁজে বের করো", "Find the course you love")}
          </p>

          {/* Search */}
          <div className="max-w-xl mx-auto mt-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("কোর্স খুঁজুন...", "Search courses...")}
                className="w-full pl-12 pr-4 py-4 rounded-full bg-white border-2 border-white/80 shadow-2xl text-sm font-bn text-gray-800 placeholder:text-gray-400 focus:ring-4 focus:ring-primary-200 focus:border-primary-300 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Filter tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {Object.entries(typeLabels).map(([key, label]) => {
            const isActive = typeFilter === key;
            return (
              <button
                key={key}
                onClick={() => handleTypeChange(key)}
                className={`relative px-5 py-2.5 rounded-xl text-sm font-bold transition-colors font-bn ${
                  isActive ? "text-primary-800" : "text-gray-600 bg-white border border-gray-200 hover:bg-gray-50"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="course-type-filter"
                    className="absolute inset-0 bg-primary-100 rounded-xl -z-10 shadow-sm border border-primary-200"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                {label}
              </button>
            );
          })}

          {/* Sort dropdown */}
          <div className="ml-auto">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-bn bg-white outline-none focus:border-primary-400 cursor-pointer"
            >
              <option value="">{t("সাজানো (ডিফল্ট)", "Sort (Default)")}</option>
              <option value="newest">{t("নতুন প্রথমে", "Newest First")}</option>
              <option value="price_low">{t("দাম: কম → বেশি", "Price: Low → High")}</option>
              <option value="price_high">{t("দাম: বেশি → কম", "Price: High → Low")}</option>
            </select>
          </div>
        </div>

        {/* Category filter */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-6">
            <button
              onClick={() => setCategoryFilter("")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all font-bn ${!categoryFilter ? "bg-primary-100 text-primary-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
            >
              {t("সব ক্যাটেগরি", "All Categories")}
            </button>
            {categories.map((cat: any) => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id === parseInt(categoryFilter) ? "" : String(cat.id))}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all font-bn ${categoryFilter === String(cat.id) ? "bg-primary-100 text-primary-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
              >
                {cat.name_bn || cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Course grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-2xl overflow-hidden">
                <div className="skeleton h-48" />
                <div className="p-5 space-y-3 bg-white border border-gray-100 rounded-b-2xl">
                  <div className="skeleton h-4 w-3/4" />
                  <div className="skeleton h-3 w-1/2" />
                  <div className="skeleton h-8 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-400 font-bn">
              {t("কোনো কোর্স পাওয়া যায়নি", "No courses found")}
            </h3>
            <p className="text-sm text-gray-400 font-bn mt-1">
              {t("ফিল্টার পরিবর্তন করে আবার চেষ্টা করুন", "Try changing the filters")}
            </p>
          </div>
        ) : (
          <motion.div 
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { staggerChildren: 0.1 } }
            }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {courses.map((course) => (
              <motion.div 
                key={course.id}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
                }}
              >
                <Link
                  href={`/courses/${course.product.slug}`}
                  className="block group h-full"
                >
                  <motion.div 
                    whileHover={{ y: -6, scale: 1.01 }}
                    transition={{ type: "spring", stiffness: 400 }}
                    className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-[0px_4px_20px_rgba(0,0,0,0.03)] group-hover:shadow-[0px_8px_32px_rgba(92,33,192,0.08)] transition-shadow h-full flex flex-col"
                  >
                    {/* Thumbnail */}
                    <div className="relative h-48 bg-gradient-to-br from-primary-200 to-primary-400 flex items-center justify-center shrink-0">
                      {course.product.thumbnail_url ? (
                        <img
                          src={course.product.thumbnail_url}
                          alt={course.product.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <BookOpen className="w-16 h-16 text-white/50" />
                      )}
                      {/* Badges */}
                      <div className="absolute top-3 left-3 flex gap-2">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${typeColors[course.course_type] || "bg-gray-100 text-gray-700"
                            }`}
                        >
                          {course.course_type === "live" ? t("লাইভ", "Live") : t("রেকর্ডেড", "Recorded")}
                        </span>
                        {course.product.is_free && (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 shadow-sm">
                            {t("ফ্রি", "Free")}
                          </span>
                        )}
                        {course.is_featured && (
                          <span className="px-2 py-1 rounded-full bg-yellow-400 text-yellow-900 shadow-sm">
                            <Star className="w-3 h-3 fill-yellow-900" />
                          </span>
                        )}
                        {(course as any).has_exam && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700 shadow-sm flex items-center gap-1">
                            <GraduationCap className="w-3 h-3" />
                            {t("পরীক্ষা", "Exam")}
                          </span>
                        )}
                      </div>
                      {course.age_min && (
                        <div className="absolute bottom-3 left-3">
                          <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-black/70 backdrop-blur-sm text-white font-bn border border-white/10 shadow-lg">
                            বয়স: {course.age_min}–{course.age_max || "১৩"}
                          </span>
                        </div>
                      )}
                    </div>
  
                    {/* Content */}
                    <div className="p-5 flex flex-col flex-1">
                      <div className="flex-1">
                        {/* Instructor Row */}
                        <div className="flex items-center gap-2 mb-3">
                          {course.instructor?.profile_image_url ? (
                            <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 border border-gray-100 bg-gray-50">
                              <img src={course.instructor.profile_image_url} alt="" className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center shrink-0 border border-gray-100 shadow-inner">
                              <Users className="w-3.5 h-3.5 text-primary-700" />
                            </div>
                          )}
                          <span className="text-[13px] font-semibold text-gray-600 font-bn">
                            By <span className="text-gray-800">{course.instructor ? (course.instructor.name_bn || course.instructor.name) : t("ইন্সট্রাক্টর", "Instructor")}</span>
                          </span>
                        </div>
  
                        {/* Title */}
                        <h3 className="font-bold font-bn text-xl text-gray-900 mb-4 group-hover:text-primary-700 transition-colors line-clamp-2 leading-snug">
                          {course.product.title_bn || course.product.title}
                        </h3>
  
                        {/* Meta Info */}
                        <div className="flex items-center gap-5 text-[14px] font-semibold text-gray-600 font-bn mb-4">
                          <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                            <Play className="w-4 h-4 text-primary-600" />
                            <span>{course.total_lessons} {t("ক্লাস", "Classes")}</span>
                          </div>
                        </div>
                      </div>
  
                      <div>
                        <div className="w-full h-px bg-gray-100 mb-4" />
  
                        {/* Footer (Price & Button) */}
                        <div className="flex items-end justify-between">
                          <div>
                            {course.product.is_free ? (
                              <div className="text-xl font-bold text-green-600 font-bn leading-none">{t("ফ্রি কোর্স", "Free")}</div>
                            ) : (
                              <div className="flex flex-col">
                                {course.product.compare_price && (
                                  <span className="text-[12px] text-gray-400 line-through leading-none font-bn mb-1.5">
                                    ৳{course.product.compare_price}
                                  </span>
                                )}
                                <span className="text-xl font-bold text-primary-700 font-bn leading-none">
                                  ৳{course.product.price}
                                </span>
                              </div>
                            )}
                          </div>
  
                          <div className="px-5 py-2.5 bg-primary-700 text-white text-[14px] font-bold rounded-xl group-hover:bg-primary-800 group-hover:shadow-lg group-hover:shadow-primary-700/25 transition-all font-bn active:scale-95">
                            {t("বিস্তারিত দেখো", "View Details")}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      <Footer />
    </div>
  );
}

export default function CoursesPage() {
  return (
    <Suspense>
      <CoursesContent />
    </Suspense>
  );
}
