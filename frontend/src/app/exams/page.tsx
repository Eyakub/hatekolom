"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, GraduationCap } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ExamCard } from "@/components/exam/ExamCard";
import { api } from "@/lib/api";
import { useLocaleStore } from "@/stores/locale-store";
import { motion } from "motion/react";

interface Exam {
  id: string;
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
  exam_type: string;
  total_sections: number;
  total_questions: number;
  time_limit_seconds: number | null;
  pass_percentage: number;
  scheduled_start: string | null;
  scheduled_end: string | null;
}

function ExamsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(searchParams?.get("type") || "");

  const { t: tRaw } = useLocaleStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const t = (bn: string, en: string) => (mounted ? tRaw(bn, en) : bn);

  const handleTypeChange = (type: string) => {
    setTypeFilter(type);
    if (type) {
      router.push(`/exams?type=${type}`, { scroll: false });
    } else {
      router.push("/exams", { scroll: false });
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (typeFilter) params.append("exam_type", typeFilter);
        if (search) params.append("search", search);

        const data: any = await api.get(`/exams/?${params.toString()}`);
        setExams(Array.isArray(data) ? data : []);
      } catch {
        setExams([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [typeFilter, search]);

  const typeLabels: Record<string, string> = {
    "": t("সকল", "All"),
    anytime: t("অনলাইন", "Anytime"),
    scheduled: t("নির্ধারিত সময়", "Scheduled"),
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Hero */}
      <div className="relative bg-gradient-to-br from-[#0a1e36] via-[#1a3f6f] to-[#0d2d52] py-16 md:py-20 overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-cyan-400/10 rounded-full blur-[80px] -translate-x-1/2 translate-y-1/2" />
        
        {/* Floating icons */}
        <motion.div
          animate={{ y: [-8, 8, -8], rotate: [0, 5, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-12 right-[15%] hidden md:block"
        >
          <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/[0.08] backdrop-blur-sm flex items-center justify-center">
            <span className="text-2xl">📝</span>
          </div>
        </motion.div>
        <motion.div
          animate={{ y: [6, -6, 6], rotate: [0, -5, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-16 left-[12%] hidden md:block"
        >
          <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/[0.08] backdrop-blur-sm flex items-center justify-center">
            <span className="text-xl">🏆</span>
          </div>
        </motion.div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl md:text-5xl font-extrabold text-white font-bn tracking-tight"
          >
            {t("পরীক্ষাসমূহ", "Exams")}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-blue-200/60 font-bn mt-3 text-lg max-w-md mx-auto"
          >
            {t(
              "তোমার দক্ষতা যাচাই করো আমাদের পরীক্ষায় অংশ নিয়ে",
              "Test your skills by participating in our exams"
            )}
          </motion.p>

          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="max-w-xl mx-auto mt-8"
          >
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-cyan-400/20 to-blue-500/20 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("পরীক্ষা খুঁজুন...", "Search exams...")}
                  className="w-full pl-12 pr-4 py-4 rounded-xl bg-white/[0.08] border border-white/[0.12] backdrop-blur-md text-sm font-bn text-white placeholder:text-blue-200/40 focus:bg-white/[0.12] focus:border-blue-400/40 focus:shadow-[0_0_20px_rgba(59,130,246,0.15)] outline-none transition-all duration-300"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Filter tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          {Object.entries(typeLabels).map(([key, label]) => {
            const isActive = typeFilter === key;
            const icons: Record<string, string> = { "": "📋", anytime: "🌐", scheduled: "📅" };
            return (
              <button
                key={key}
                onClick={() => handleTypeChange(key)}
                className={`relative px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 font-bn flex items-center gap-2 ${
                  isActive
                    ? "text-white shadow-lg shadow-blue-500/20"
                    : "text-gray-500 bg-white border border-gray-200 hover:border-blue-200 hover:text-blue-600 hover:shadow-md hover:shadow-blue-100/50"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="exam-type-filter"
                    className="absolute inset-0 bg-gradient-to-r from-[#1a3f6f] to-[#2563eb] rounded-xl -z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="text-base">{icons[key]}</span>
                {label}
              </button>
            );
          })}
        </div>

        {/* Exam grid */}
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
        ) : exams.length === 0 ? (
          <div className="text-center py-20">
            <GraduationCap className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-400 font-bn">
              {t("কোনো পরীক্ষা পাওয়া যায়নি", "No exams found")}
            </h3>
            <p className="text-sm text-gray-400 font-bn mt-1">
              {t(
                "ফিল্টার পরিবর্তন করে আবার চেষ্টা করুন",
                "Try changing the filters"
              )}
            </p>
          </div>
        ) : (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: { staggerChildren: 0.1 },
              },
            }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {exams.map((exam) => (
              <motion.div
                key={exam.id}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  show: {
                    opacity: 1,
                    y: 0,
                    transition: {
                      type: "spring",
                      stiffness: 300,
                      damping: 24,
                    },
                  },
                }}
              >
                <ExamCard exam={exam} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      <Footer />
    </div>
  );
}

export default function ExamsPage() {
  return (
    <Suspense>
      <ExamsContent />
    </Suspense>
  );
}
