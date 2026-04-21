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
      <div className="bg-gradient-hero py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-white font-bn">
            {t("পরীক্ষাসমূহ", "Exams")}
          </h1>
          <p className="text-white/70 font-bn mt-2">
            {t(
              "তোমার দক্ষতা যাচাই করো আমাদের পরীক্ষায় অংশ নিয়ে",
              "Test your skills by participating in our exams"
            )}
          </p>

          {/* Search */}
          <div className="max-w-xl mx-auto mt-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("পরীক্ষা খুঁজুন...", "Search exams...")}
                className="w-full pl-12 pr-4 py-4 rounded-full bg-white border-2 border-white/80 shadow-2xl text-sm font-bn text-gray-800 placeholder:text-gray-400 focus:ring-4 focus:ring-primary-200 focus:border-primary-300 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Filter tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {Object.entries(typeLabels).map(([key, label]) => {
            const isActive = typeFilter === key;
            return (
              <button
                key={key}
                onClick={() => handleTypeChange(key)}
                className={`relative px-5 py-2.5 rounded-xl text-sm font-bold transition-colors font-bn ${
                  isActive
                    ? "text-primary-800"
                    : "text-gray-600 bg-white border border-gray-200 hover:bg-gray-50"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="exam-type-filter"
                    className="absolute inset-0 bg-primary-100 rounded-xl -z-10 shadow-sm border border-primary-200"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
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
