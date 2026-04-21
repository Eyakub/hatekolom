"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLocaleStore } from "@/stores/locale-store";
import { api } from "@/lib/api";
import { Target, ArrowRight, Calendar, Users, Pencil } from "lucide-react";

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDeadline(dateStr: string, locale: "bn" | "en"): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(locale === "bn" ? "bn-BD" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TodaySkeletonCard() {
  return (
    <div className="animate-pulse rounded-3xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-6 mb-8">
      <div className="h-5 bg-amber-200 rounded w-32 mb-4" />
      <div className="h-8 bg-amber-200 rounded w-3/4 mb-3" />
      <div className="h-4 bg-amber-100 rounded w-full mb-2" />
      <div className="h-4 bg-amber-100 rounded w-5/6 mb-6" />
      <div className="h-12 bg-amber-200 rounded-2xl w-48" />
    </div>
  );
}

function GridSkeletonCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="animate-pulse bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="h-40 bg-gray-200" />
          <div className="p-4 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-full" />
            <div className="h-3 bg-gray-100 rounded w-5/6" />
            <div className="flex gap-3 mt-3">
              <div className="h-3 bg-gray-100 rounded w-20" />
              <div className="h-3 bg-gray-100 rounded w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Today's Challenge Card ────────────────────────────────────────────────────

function TodayChallengeCard({ challenge, t, locale }: { challenge: Challenge; t: (bn: string, en: string) => string; locale: "bn" | "en" }) {
  const title = t(challenge.title_bn || challenge.title, challenge.title);
  const description = t(
    challenge.description_bn || challenge.description || "",
    challenge.description || "",
  );

  return (
    <div className="relative rounded-3xl overflow-hidden mb-8 shadow-lg">
      {/* Gradient border effect */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-amber-400 via-orange-400 to-yellow-400 p-[3px]">
        <div className="h-full w-full rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50" />
      </div>

      {/* Content */}
      <div className="relative z-10 p-6 sm:p-8">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-white text-xs font-extrabold mb-4 shadow-sm">
          <Target size={13} />
          {t("আজকের চ্যালেঞ্জ", "Today's Challenge")}
        </div>

        <div className="flex flex-col sm:flex-row gap-6">
          {/* Text content */}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl font-extrabold text-gray-800 leading-tight mb-2">
              {title}
            </h2>
            {description && (
              <p className="text-gray-600 text-sm sm:text-base leading-relaxed mb-5">
                {description}
              </p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-4 mb-5 text-xs text-gray-500">
              {challenge.ends_at && (
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Calendar size={13} className="text-orange-400" />
                  {t("শেষ হবে:", "Deadline:")} {formatDeadline(challenge.ends_at, locale)}
                </span>
              )}
              {typeof challenge.submission_count === "number" && (
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Users size={13} className="text-amber-500" />
                  {challenge.submission_count} {t("জমা", "submissions")}
                </span>
              )}
            </div>

            <Link
              href={`/challenges/${challenge.id}`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-extrabold text-sm shadow-md hover:opacity-90 active:scale-95 transition-all"
            >
              <Pencil size={15} />
              {t("আঁকতে শুরু করো", "Start Drawing")}
              <ArrowRight size={15} />
            </Link>
          </div>

          {/* Reference image */}
          {challenge.reference_image_url && (
            <div className="flex-shrink-0 self-start">
              <img
                src={challenge.reference_image_url}
                alt={t("রেফারেন্স ছবি", "Reference image")}
                className="w-full sm:w-48 h-40 sm:h-48 object-cover rounded-2xl shadow-sm border-2 border-amber-200"
              />
              <p className="text-center text-xs text-gray-400 mt-1.5 font-medium">
                {t("নমুনা ছবি", "Reference")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Challenge Grid Card ──────────────────────────────────────────────────────

function ChallengeCard({ challenge, t, locale }: { challenge: Challenge; t: (bn: string, en: string) => string; locale: "bn" | "en" }) {
  const title = t(challenge.title_bn || challenge.title, challenge.title);
  const rawDesc = t(
    challenge.description_bn || challenge.description || "",
    challenge.description || "",
  );
  const excerpt = rawDesc ? truncate(rawDesc, 100) : null;

  return (
    <Link
      href={`/challenges/${challenge.id}`}
      className="group bg-white rounded-2xl shadow-sm border border-amber-100 overflow-hidden hover:shadow-md hover:border-amber-300 transition-all"
    >
      {/* Reference image thumbnail */}
      {challenge.reference_image_url ? (
        <div className="h-40 bg-amber-50 overflow-hidden relative">
          <img
            src={challenge.reference_image_url}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>
      ) : (
        <div className="h-40 bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
          <Target size={40} className="text-amber-300" />
        </div>
      )}

      {/* Card body */}
      <div className="p-4">
        <h3 className="text-base font-extrabold text-gray-800 leading-snug mb-1 group-hover:text-orange-600 transition-colors">
          {title}
        </h3>

        {excerpt && (
          <p className="text-xs text-gray-500 leading-relaxed mb-3 line-clamp-2">
            {excerpt}
          </p>
        )}

        {/* Meta footer */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
          {challenge.ends_at && (
            <span className="inline-flex items-center gap-1">
              <Calendar size={11} className="text-orange-300" />
              {formatDeadline(challenge.ends_at, locale)}
            </span>
          )}
          {typeof challenge.submission_count === "number" && (
            <span className="inline-flex items-center gap-1">
              <Users size={11} className="text-amber-400" />
              {challenge.submission_count} {t("জমা", "entries")}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChallengesPage() {
  const { t, locale } = useLocaleStore();

  const [todayChallenge, setTodayChallenge] = useState<Challenge | null | undefined>(undefined); // undefined = loading
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // ── Fetch today's challenge ─────────────────────────────────────────────────
  useEffect(() => {
    const fetchToday = async () => {
      try {
        const data = await api.get<Challenge>("/challenges/today");
        setTodayChallenge(data ?? null);
      } catch {
        setTodayChallenge(null);
      }
    };
    fetchToday();
  }, []);

  // ── Fetch all active challenges ─────────────────────────────────────────────
  useEffect(() => {
    const fetchAll = async () => {
      setLoadingList(true);
      try {
        const data: any = await api.get("/challenges/");
        const list: Challenge[] = Array.isArray(data) ? data : data?.items || [];
        setChallenges(list);
      } catch {
        setChallenges([]);
      } finally {
        setLoadingList(false);
      }
    };
    fetchAll();
  }, []);

  // Other active challenges (exclude today's if present)
  const otherChallenges = todayChallenge
    ? challenges.filter((c) => c.id !== todayChallenge.id)
    : challenges;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-r from-amber-100 to-orange-100 font-bn">

      {/* ── Hero header ── */}
      <div className="bg-gradient-to-r from-amber-100 to-orange-100 border-b border-amber-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-10 sm:py-14 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-400 shadow-lg mb-5">
            <Target size={30} className="text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-800 leading-tight mb-2">
            {t("আঁকার চ্যালেঞ্জ 🎯", "Drawing Challenges 🎯")}
          </h1>
          <p className="text-gray-600 text-base sm:text-lg max-w-xl mx-auto">
            {t(
              "প্রতিদিনের চ্যালেঞ্জে অংশ নাও, নিজের সেরাটা দেখাও!",
              "Join daily challenges and show off your best artwork!",
            )}
          </p>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-10">

        {/* ── Today's Challenge section ── */}
        <div className="mb-2">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">✨</span>
            <h2 className="text-lg font-extrabold text-gray-700">
              {t("আজকের চ্যালেঞ্জ", "Today's Challenge")}
            </h2>
          </div>

          {/* Loading state */}
          {todayChallenge === undefined && <TodaySkeletonCard />}

          {/* Has a challenge today */}
          {todayChallenge !== undefined && todayChallenge !== null && (
            <TodayChallengeCard challenge={todayChallenge} t={t} locale={locale} />
          )}

          {/* No challenge today */}
          {todayChallenge === null && (
            <div className="rounded-3xl border-2 border-dashed border-amber-300 bg-white/60 px-6 py-10 mb-8 text-center">
              <div className="text-5xl mb-3">🎨</div>
              <p className="text-gray-600 font-semibold text-base mb-1">
                {t(
                  "আজকের জন্য কোনো চ্যালেঞ্জ নেই — মুক্ত আঁকা করো!",
                  "No challenge today — try free drawing! 🎨",
                )}
              </p>
              <p className="text-gray-400 text-sm mb-5">
                {t(
                  "নিচের চ্যালেঞ্জগুলো দেখো অথবা মনের মতো আঁকো।",
                  "Browse challenges below or draw freely.",
                )}
              </p>
              <Link
                href="/draw"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 text-white font-bold text-sm shadow-sm hover:opacity-90 transition-opacity"
              >
                <Pencil size={14} />
                {t("মুক্ত আঁকা শুরু করো", "Start Free Drawing")}
                <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>

        {/* ── All active challenges ── */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">📋</span>
            <h2 className="text-lg font-extrabold text-gray-700">
              {t("সব চ্যালেঞ্জ", "All Challenges")}
            </h2>
          </div>

          {loadingList ? (
            <GridSkeletonCards />
          ) : otherChallenges.length === 0 && todayChallenge === null ? (
            /* Empty state: no today and no other challenges */
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-6xl mb-4">🌟</div>
              <h3 className="text-xl font-extrabold text-gray-600 mb-2">
                {t("এখন কোনো চ্যালেঞ্জ নেই।", "No challenges right now.")}
              </h3>
              <p className="text-gray-400 text-sm mb-6">
                {t(
                  "পরে আবার দেখো — নতুন চ্যালেঞ্জ আসবে! 🌟",
                  "Check back later! 🌟",
                )}
              </p>
              <Link
                href="/draw"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 text-white font-bold shadow-md hover:opacity-90 transition-opacity"
              >
                <Pencil size={16} />
                {t("মুক্ত আঁকা করো", "Try Free Drawing")}
              </Link>
            </div>
          ) : otherChallenges.length === 0 ? (
            /* Has a today challenge but no other challenges */
            <div className="text-center py-8 text-gray-400 text-sm">
              {t(
                "আজকের চ্যালেঞ্জ ছাড়া আর কোনো চ্যালেঞ্জ নেই।",
                "No other challenges besides today's.",
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {otherChallenges.map((challenge) => (
                <ChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  t={t}
                  locale={locale}
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
