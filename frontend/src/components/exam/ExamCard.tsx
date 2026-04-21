"use client";

import Link from "next/link";
import { GraduationCap, Clock, FileText, Layers, CalendarClock } from "lucide-react";
import { useLocaleStore } from "@/stores/locale-store";
import { useState, useEffect } from "react";
import { motion } from "motion/react";

interface ExamCardProps {
  exam: any;
}

export function ExamCard({ exam }: ExamCardProps) {
  const { t: tRaw } = useLocaleStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const t = (bn: string, en: string) => (mounted ? tRaw(bn, en) : bn);

  const isScheduled = exam.exam_type === "scheduled";

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remainMins = mins % 60;
      return remainMins > 0
        ? `${hrs} ${t("ঘণ্টা", "hr")} ${remainMins} ${t("মিনিট", "min")}`
        : `${hrs} ${t("ঘণ্টা", "hr")}`;
    }
    return `${mins} ${t("মিনিট", "min")}`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("bn-BD", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Link href={`/exams/${exam.slug}`} className="block group h-full">
      <motion.div
        whileHover={{ y: -6, scale: 1.01 }}
        transition={{ type: "spring", stiffness: 400 }}
        className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-[0px_4px_20px_rgba(0,0,0,0.03)] group-hover:shadow-[0px_8px_32px_rgba(92,33,192,0.08)] transition-shadow h-full flex flex-col"
      >
        {/* Thumbnail */}
        <div className="relative h-48 bg-gradient-to-br from-primary-300 to-primary-500 flex items-center justify-center shrink-0">
          <img
            src={exam.thumbnail_url || "https://images.unsplash.com/photo-1611996575749-79a3a250f948?q=80&w=800&auto=format&fit=crop"}
            alt={exam.title}
            className="w-full h-full object-cover"
          />
          {/* Top badges */}
          <div className="absolute top-3 left-3 flex gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                isScheduled
                  ? "bg-orange-100 text-orange-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {isScheduled ? t("নির্ধারিত সময়", "Scheduled") : t("অনলাইন", "Anytime")}
            </span>
            {exam.is_free && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 shadow-sm">
                {t("ফ্রি", "Free")}
              </span>
            )}
          </div>
          {/* Time limit badge */}
          {exam.time_limit_seconds && (
            <div className="absolute bottom-3 left-3">
              <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-black/70 backdrop-blur-sm text-white font-bn border border-white/10 shadow-lg flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {formatTime(exam.time_limit_seconds)}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col flex-1">
          <div className="flex-1">
            {/* Title */}
            <h3 className="font-bold font-bn text-xl text-gray-900 mb-4 group-hover:text-primary-700 transition-colors line-clamp-2 leading-snug">
              {exam.title_bn || exam.title}
            </h3>

            {/* Meta Info */}
            <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-gray-600 font-bn mb-4">
              <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                <Layers className="w-3.5 h-3.5 text-primary-600" />
                <span>{exam.total_sections} {t("সেকশন", "Sections")}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                <FileText className="w-3.5 h-3.5 text-primary-600" />
                <span>{exam.total_questions} {t("প্রশ্ন", "Questions")}</span>
              </div>
            </div>

            {/* Scheduled date */}
            {isScheduled && exam.scheduled_start && (
              <div className="flex items-center gap-1.5 text-[13px] text-orange-600 font-semibold font-bn mb-4">
                <CalendarClock className="w-4 h-4" />
                <span>{formatDate(exam.scheduled_start)}</span>
              </div>
            )}
          </div>

          <div>
            <div className="w-full h-px bg-gray-100 mb-4" />

            {/* Footer (Price & Button) */}
            <div className="flex items-end justify-between">
              <div>
                {exam.is_free ? (
                  <div className="text-xl font-bold text-green-600 font-bn leading-none">
                    {t("ফ্রি", "Free")}
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {exam.compare_price && (
                      <span className="text-[12px] text-gray-400 line-through leading-none font-bn mb-1.5">
                        ৳{exam.compare_price}
                      </span>
                    )}
                    <span className="text-xl font-bold text-primary-700 font-bn leading-none">
                      ৳{exam.price}
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
  );
}
