"use client";

import { useState, useEffect, useRef, ReactNode } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  BookOpen,
  GraduationCap,
  Play,
  Users,
  Star,
  ChevronRight,
  Phone,
  ArrowRight,
  LayoutGrid,
  Brain,
  Calculator,
  Palette,
  Languages,
  BookOpenText,
  Code,
  FlaskConical,
  Heart,
  Lightbulb,
  Music,
  Pen,
  Sparkles,
  Puzzle,
  Award,
  ShieldCheck,
  TrendingUp,
  Rocket,
  type LucideIcon,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { SuccessAndJoyHub } from "@/components/home/SuccessAndJoyHub";
import { HappyBabyELibrary } from "@/components/home/HappyBabyELibrary";
import { PlatformAchievements } from "@/components/home/PlatformAchievements";
import { Footer } from "@/components/layout/Footer";
import { useLocaleStore } from "@/stores/locale-store";
import { api } from "@/lib/api";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

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
  category?: {
    id: number;
    name: string;
    name_bn: string | null;
  } | null;
}

interface Category {
  id: number;
  name: string;
  name_bn: string | null;
  slug: string;
}

/** Map a category slug/name to an appropriate icon. */
function getCategoryIcon(slug: string, name: string): LucideIcon {
  const key = `${slug} ${name}`.toLowerCase();
  if (key.match(/math|abacus|গাণিতিক|অ্যাবাকাস|ম্যাথ|হিসাব/)) return Calculator;
  if (key.match(/brain|মস্তিষ্ক|ব্রেইন|mental/)) return Brain;
  if (key.match(/art|draw|paint|ক্রিয়েটিভ|আর্ট|চিত্র|ড্রয়িং/)) return Palette;
  if (key.match(/bangla|bengali|বাংলা|সাহিত্য|ভাষা.*বাং/)) return Pen;
  if (key.match(/english|ইংরেজি|ইংলিশ|spoken/)) return Languages;
  if (key.match(/quran|islamic|ইসলাম|কুরআন|কোরআন|আরবি|দ্বীন/)) return BookOpenText;
  if (key.match(/code|coding|program|কোডিং|প্রোগ্রাম/)) return Code;
  if (key.match(/science|বিজ্ঞান|প্রযুক্তি|stem|physics|chemistry/)) return FlaskConical;
  if (key.match(/music|সংগীত|গান/)) return Music;
  if (key.match(/life|জীবন|দক্ষতা|skill/)) return Heart;
  if (key.match(/creative|সৃজনশীল/)) return Sparkles;
  return Lightbulb;
}

const RevealOnScroll = ({ children, delay = 0 }: { children: ReactNode, delay?: number }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, delay, ease: [0.34, 1.56, 0.64, 1] }}
    >
      {children}
    </motion.div>
  );
};

const StepCard = ({ 
  number, icon: Icon, title, description, bgColor, textColor, accentColor, delay = 0, wrapperClass = ""
}: { 
  number: number | string, icon: any, title: string, description: string, bgColor: string, textColor: string, accentColor: string, delay?: number, wrapperClass?: string
}) => {
  return (
    <div className={`w-full flex justify-center ${wrapperClass}`}>
      <RevealOnScroll delay={delay}>
      <motion.div 
        className={`relative w-[150px] sm:w-[180px] lg:w-[220px] h-[150px] sm:h-[180px] lg:h-[220px] ${bgColor} p-4 lg:p-6 rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] flex flex-col items-center justify-center text-center border-[4px] lg:border-[6px] border-white/80 backdrop-blur-sm cursor-pointer shadow-lg group font-bn mx-auto`}
        whileHover={{ 
          y: -10, 
          scale: 1.05,
          boxShadow: `0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 0 20px ${accentColor}40`
        }}
      >
        <motion.div 
          className={`absolute -top-3 -left-3 lg:-top-4 lg:-left-4 ${accentColor} text-white w-10 h-10 lg:w-14 lg:h-14 rounded-full flex items-center justify-center text-xl lg:text-3xl font-black shadow-lg border-2 lg:border-4 border-white`}
          whileHover={{ rotate: 12, scale: 1.1 }}
        >
          {number}
        </motion.div>
        
        <motion.div
          className={`${textColor} mb-2 lg:mb-3`}
          animate={{ rotate: [0, -5, 5, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <Icon className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 group-hover:scale-110 transition-transform" />
        </motion.div>
        
        <h3 className={`text-lg sm:text-xl lg:text-2xl font-bold ${textColor} mb-1 leading-none`}>{title}</h3>
        <p className={`${textColor} opacity-90 text-[12px] sm:text-[14px] lg:text-[15px] px-1 mt-1 lg:mt-2 leading-snug line-clamp-2`}>{description}</p>
      </motion.div>
    </RevealOnScroll>
    </div>
  );
};

export default function HomePage() {
  const { t: tRaw, locale } = useLocaleStore();
  const [courses, setCourses] = useState<Course[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end end"]
  });
  const pathLength = useTransform(scrollYProgress, [0, 0.8], [0, 1]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [homepageContent, setHomepageContent] = useState<any>(null);

  // Defer locale-dependent rendering until after client hydration
  // Before mount, always return the first (Bengali) string to match SSR
  const t = (bn: string, en: string) => (mounted ? tRaw(bn, en) : bn);

  useEffect(() => setMounted(true), []);

  // Load homepage content (single call for both PlatformAchievements + SuccessAndJoyHub)
  useEffect(() => {
    const loadHomepage = async () => {
      try {
        const res: any = await api.get("/homepage-content/");
        if (res) setHomepageContent(res);
      } catch {}
    };
    loadHomepage();
  }, []);

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

  // Load courses
  useEffect(() => {
    const loadCourses = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (activeCategory) params.append("category_id", activeCategory);
        const data: any = await api.get(`/courses/?${params.toString()}`);
        setCourses(Array.isArray(data) ? data : []);
      } catch {
        setCourses([]);
      } finally {
        setLoading(false);
      }
    };
    loadCourses();
  }, [activeCategory]);

  const [emblaRef] = useEmblaCarousel(
    { loop: true, align: "center", skipSnaps: false },
    [Autoplay({ delay: 3000, stopOnInteraction: false })]
  );

  const renderCourseCard = (course: Course, index: number, isMobile: boolean) => {
    const isFeatured = !isMobile && index === 0;
    const title = course.product.title_bn || course.product.title;
    const instructorName = course.instructor
      ? (course.instructor.name_bn || course.instructor.name)
      : t("ইন্সট্রাক্টর", "Instructor");
    const isLive = course.course_type === "live";
    const categoryName = course.category
      ? (course.category.name_bn || course.category.name)
      : (isLive ? t("লাইভ", "Live") : t("রেকর্ডেড", "Recorded"));

    if (isFeatured) {
      /* ── Featured Card (2-col span with overlay) ── */
      return (
        <Link
          key={course.id}
          href={`/courses/${course.product.slug}`}
          className="md:col-span-2 group bg-white rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_12px_32px_rgba(92,33,192,0.10)] ring-1 ring-gray-100"
        >
          <div className="relative h-64 md:h-full md:min-h-[400px]">
            {course.product.thumbnail_url ? (
              <img
                src={course.product.thumbnail_url}
                alt={title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary-300 to-primary-600 flex items-center justify-center">
                <BookOpen className="w-24 h-24 text-white/30" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-6 md:p-8">
              <div className="flex gap-2 mb-4">
                <span className={`px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${isLive ? "bg-red-500 text-white" : "bg-primary-600 text-white"}`}>
                  {isLive ? t("লাইভ", "Live") : t("রেকর্ডেড", "Recorded")}
                </span>
                {course.age_min && (
                  <span className="bg-white/20 backdrop-blur-md text-white px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider">
                    {t("বয়স:", "Ages:")} {course.age_min}–{course.age_max || "১৩"}
                  </span>
                )}
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-2 leading-tight font-bn">
                {title}
              </h3>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  {course.instructor?.profile_image_url ? (
                    <div className="w-10 h-10 rounded-full border-2 border-white/50 overflow-hidden">
                      <img alt="" src={course.instructor.profile_image_url} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full border-2 border-white/50 bg-white/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-white/70" />
                    </div>
                  )}
                  <div className="text-white">
                    <p className="text-xs opacity-70">By {instructorName}</p>
                    <p className="text-sm font-semibold font-bn">{course.total_lessons} {t("ক্লাস", "Classes")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {course.product.is_free ? (
                    <span className="text-2xl font-bold text-accent-400 font-bn">{t("ফ্রি", "Free")}</span>
                  ) : (
                    <span className="text-2xl font-bold text-accent-400 font-bn">৳ {course.product.price.toLocaleString()}</span>
                  )}
                  <span className="bg-accent-400 text-primary-900 px-6 md:px-8 py-2.5 md:py-3 rounded-full font-bold transition-all hover:scale-105 active:scale-95 shadow-lg text-sm">
                    {isLive ? t("লাইভ ক্লাস", "Join Live") : t("বিস্তারিত", "View Details")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Link>
      );
    }

    /* ── Regular Course Card ── */
    return (
      <Link
        key={course.id}
        href={`/courses/${course.product.slug}`}
        className={`group bg-white rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_12px_32px_rgba(92,33,192,0.08)] ring-1 ring-gray-100 flex flex-col ${isMobile ? "h-full select-none" : ""}`}
      >
        <div className="relative h-48 overflow-hidden shrink-0">
          {course.product.thumbnail_url ? (
            <img
              src={course.product.thumbnail_url}
              alt={title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary-200 to-primary-400 flex items-center justify-center">
              <BookOpen className="w-16 h-16 text-white/50" />
            </div>
          )}
          <div className="absolute top-3 left-3 flex gap-2">
            <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${isLive ? "bg-red-500 text-white" : "bg-primary-600 text-white"}`}>
              {isLive ? t("লাইভ", "Live") : t("রেকর্ডেড", "Recorded")}
            </span>
          </div>
        </div>
        <div className="p-5 flex flex-col flex-grow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-primary-700 bg-primary-50 px-2 py-1 rounded-md uppercase tracking-widest font-bn">
              {categoryName}
            </span>
            <div className="flex text-accent-500 items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-current" />
              <span className="text-xs font-bold text-gray-600">
                {(4.5 + Math.random() * 0.5).toFixed(1)}
              </span>
            </div>
          </div>
          <h4 className="text-base font-bold text-gray-900 mb-2 line-clamp-2 leading-snug font-bn group-hover:text-primary-700 transition-colors">
            {title}
          </h4>
          <p className="text-sm text-gray-500 mb-4 font-bn">
            By {instructorName} • {course.total_lessons} {t("ক্লাস", "Classes")}
          </p>
          <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
            <div className="flex flex-col">
              {course.product.compare_price && (
                <span className="text-xs text-gray-400 line-through font-bn">
                  ৳ {course.product.compare_price.toLocaleString()}
                </span>
              )}
              <span className="text-xl font-extrabold text-primary-700 font-bn">
                {course.product.is_free ? t("ফ্রি", "Free") : `৳ ${course.product.price.toLocaleString()}`}
              </span>
            </div>
            <span className="p-2.5 rounded-full border border-primary-700 text-primary-700 group-hover:bg-primary-700 group-hover:text-white transition-all">
              <ArrowRight className="w-5 h-5" />
            </span>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 bg-[radial-gradient(#5341CD18_1px,transparent_1px)] [background-size:24px_24px]">
      <Navbar />


      {/* ============================================
          HERO SECTION
          ============================================ */}
      <section className="bg-gradient-hero relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-16 md:py-28">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="text-white animate-fade-in">
              {/* Play · Learn · Grow tagline pills */}
              <div className="flex flex-wrap gap-2 mb-4 md:mb-6">
                {[
                  { emoji: "🎮", bn: "খেলো", en: "Play", bg: "bg-pink-500/20", border: "border-pink-400/30", delay: 0 },
                  { emoji: "📚", bn: "শেখো", en: "Learn", bg: "bg-blue-400/20", border: "border-blue-300/30", delay: 0.1 },
                  { emoji: "🌱", bn: "বড়ো হও", en: "Grow", bg: "bg-emerald-500/20", border: "border-emerald-400/30", delay: 0.2 },
                ].map((pill) => (
                  <motion.div
                    key={pill.en}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: pill.delay, duration: 0.4 }}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full ${pill.bg} border ${pill.border} backdrop-blur-sm`}
                  >
                    <span className="text-sm">{pill.emoji}</span>
                    <span className="text-[11px] font-bold text-white tracking-widest uppercase font-bn">
                      {t(pill.bn, pill.en)}
                    </span>
                  </motion.div>
                ))}
              </div>

              <h1 className="text-[2.75rem] leading-[1.1] md:text-6xl lg:text-7xl font-extrabold font-bn md:leading-[1.1] mb-3 md:mb-6 tracking-tight">
                {locale === "bn" ? (
                  <>
                    খেলো, <span className="text-[#c4b5fd] italic">শেখো</span>,<br />
                    <span className="text-accent-400">বড়ো হয়ে উঠো!</span>
                  </>
                ) : (
                  <>
                    Play, <span className="text-[#c4b5fd] italic">Learn</span>,<br />
                    <span className="text-accent-400">Grow Together!</span>
                  </>
                )}
              </h1>
              <p className="text-base md:text-xl text-white/90 md:text-white/80 mb-5 md:mb-8 max-w-lg font-bn">
                {t(
                  "মজায় খেলুন, আনন্দে শিখুন, দারুণভাবে বড়ো হোন — ঘরে বসেই অ্যাবাকাস, কোডিং ও শিল্পকলায় মাস্টার হওয়ার সুযোগ।",
                  "Play joyfully, learn meaningfully, grow brilliantly — master abacus, coding, art and more from home."
                )}
              </p>

              {/* Mobile Only Hero illustration area */}
              <div className="md:hidden flex justify-center relative w-full mb-6 pt-1 max-w-[320px] mx-auto">
                <motion.div 
                  className="relative w-full aspect-[4/3]"
                >
                  {/* Thick white physical card rim */}
                  <div className="absolute inset-0 bg-white rounded-3xl p-2 shadow-xl skew-x-1 rotate-1">
                    <div className="relative w-full h-full rounded-[20px] overflow-hidden bg-primary-100 ring-1 ring-black/5">
                      <img 
                        src="/happy_explorer.png" 
                        onError={(e) => { e.currentTarget.src = "https://images.unsplash.com/photo-1544626053-8985dc34ae63?q=80&w=800&auto=format&fit=crop"; }}
                        alt="Happy kid learning" 
                        className="w-full h-full object-cover scale-105"
                      />
                      
                      {/* Floating Achievement Badge */}
                      <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-sm rounded-xl p-2.5 shadow-lg flex items-center gap-2 border border-white">
                         <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                           <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                         </div>
                         <div className="flex-1">
                           <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest leading-none mb-0.5">{t("আজকের তারকা", "Today's Star")}</p>
                           <p className="text-xs font-extrabold text-gray-900 font-bn leading-none">{t("ড্রয়িং চ্যালেঞ্জ সম্পন্ন ⭐", "Drawing Challenge Done ⭐")}</p>
                         </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

              <div className="flex flex-col sm:flex-row flex-wrap gap-4 mt-2">
                <Link href="/register">
                  <motion.button 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="group bg-accent-400 text-primary-900 font-extrabold font-bn px-10 py-4 rounded-full text-xl shadow-[0_8px_0_#d97706] hover:shadow-[0_4px_0_#d97706] hover:translate-y-1 active:shadow-none active:translate-y-2 transition-all flex items-center gap-3 border-2 border-[#d97706]"
                  >
                    {t("ভ্রমণ শুরু করুন", "Join the Adventure")}
                    <motion.div
                      animate={{ y: [0, -2, 0], x: [0, 2, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <Rocket size={24} className="fill-primary-900 text-primary-900" />
                    </motion.div>
                  </motion.button>
                </Link>
                
                <Link href="/courses">
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    className="flex group bg-white/10 text-white font-extrabold font-bn px-8 py-4 rounded-full text-xl shadow-[0_8px_0_rgba(255,255,255,0.2)] hover:shadow-[0_4px_0_rgba(255,255,255,0.2)] hover:translate-y-1 active:shadow-none active:translate-y-2 transition-all items-center justify-center gap-2 border-2 border-white/30"
                  >
                    {t("কোর্স দেখুন", "Browse Courses")}
                  </motion.button>
                </Link>
              </div>

              {/* Trusted By avatars */}
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                className="mt-6 md:mt-10 flex items-center justify-center sm:justify-start gap-4"
              >
                <div className="flex -space-x-3">
                  {[1, 2, 3].map((i) => (
                    <img key={i} src={`https://ui-avatars.com/api/?name=Kid+${i}&background=random`} alt="Explorer" className="w-[42px] h-[42px] rounded-full border-2 border-primary-900 object-cover shadow-sm grayscale-[20%]" />
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-0.5 mb-1">
                    {[1, 2, 3, 4, 5].map((star) => <Star key={star} className="w-3.5 h-3.5 text-accent-400 fill-accent-400" />)}
                  </div>
                  <p className="text-xs text-white/80 font-semibold font-bn tracking-wide">
                    {t("১০,০০০+ হ্যাপি এক্সপ্লোরারদের আস্থাশীল", "Trusted by 10,000+ Happy Explorers")}
                  </p>
                </div>
              </motion.div>
            </div>

            {/* Hero illustration area */}
            <div className="hidden md:flex justify-center relative justify-self-end w-full max-w-[440px] aspect-square">
              <motion.div 
                animate={{ y: [-6, 6, -6] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="relative w-full h-full"
              >
                {/* Thick white physical card rim */}
                <div className="absolute inset-0 bg-white rounded-[32px] p-2.5 shadow-2xl skew-x-1 rotate-1">
                  <div className="relative w-full h-full rounded-[24px] overflow-hidden bg-primary-100 ring-1 ring-black/5">
                    {/* The user can replace this file with the generated artifact! */}
                    <img 
                      src="/happy_explorer.png" 
                      onError={(e) => { e.currentTarget.src = "https://images.unsplash.com/photo-1544626053-8985dc34ae63?q=80&w=800&auto=format&fit=crop"; }}
                      alt="Happy kid learning" 
                      className="w-full h-full object-cover scale-105"
                    />
                    
                    {/* Floating Achievement Badge */}
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      className="absolute bottom-5 right-5 bg-white/95 backdrop-blur-sm rounded-2xl p-3 shadow-xl flex items-center gap-3 pr-5 border border-white"
                    >
                       <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                         <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                       </div>
                       <div>
                         <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{t("আজকের তারকা", "Today's Star")}</p>
                         <p className="text-[13px] font-extrabold text-gray-900 font-bn leading-none mt-1">{t("ড্রয়িং চ্যালেঞ্জ সম্পন্ন ⭐", "Drawing Challenge Done ⭐")}</p>
                       </div>
                    </motion.div>
                  </div>
                </div>
                
                {/* 50+ Courses stat removed to avoid clutter, as the requested image focuses entirely on the child layout. */}
              </motion.div>
            </div>
          </div>
        </div>

        {/* Wave separator */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" className="w-full" preserveAspectRatio="none">
            <path
              fill="var(--color-surface)"
              d="M0,40 C360,80 720,0 1440,40 L1440,60 L0,60 Z"
            />
          </svg>
        </div>
      </section>

      {/* ============================================
          CORE BENEFITS / GOAL (Bento Layout)
          ============================================ */}
      <section className="max-w-7xl mx-auto px-6 relative pt-16 md:pt-24 pb-8 md:pb-12">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 bg-primary-50 text-primary-700 font-bold text-[0.75rem] tracking-widest uppercase rounded-full mb-4 font-bn">
            {t("কোর বেনিফিট", "Core Benefits")}
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4 font-bn leading-tight">
            {t("পরিপাটি ও আধুনিক শিক্ষার", "A Unique Environment for")} <br className="hidden md:block" />
            <span className="text-primary-700">{t("এক অনন্য আঙ্গিনা।", "Neat & Modern Education.")}</span>
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto text-lg font-bn">
            {t(
              "আমরা একাডেমিক নিয়মের পাশাপাশি সৃজনশীল আবিষ্কারের সমন্বয় করি, যা আপনার সন্তানকে আধুনিক বিশ্বের জন্য প্রস্তুত করে।",
              "We combine academic rigor with creative discovery to give your child a head start in the modern world."
            )}
          </p>
        </div>

        {/* Dynamic Bento/Floating Layout */}
        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column (3 cards) */}
          <div className="lg:col-span-4 space-y-6 md:space-y-8 order-2 lg:order-1">
            {/* Card 1 */}
            <RevealOnScroll delay={0.1}>
              <Link href="/courses" className="block group">
                <motion.div whileHover={{ y: -8, scale: 1.03 }} transition={{ type: "spring", stiffness: 300 }} className="bg-white p-6 rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.03)] border border-gray-100">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
                      <Calculator className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-lg text-gray-900 leading-tight font-bn">{t("ব্রেইন পাওয়ার বৃদ্ধি", "Boost Brain Power")}</h3>
                  </div>
                  <p className="text-sm text-gray-500 mb-4 leading-relaxed font-bn">
                    {t("অ্যাডভান্সড অ্যাবাকাস ট্রেনিং প্রোগ্রামের মাধ্যমে মানসিক গাণিতিক দক্ষতা এবং ফোকাস আয়ত্ত করুন।", "Master mental arithmetic and focus through our advanced abacus training program.")}
                  </p>
                  <div className="text-primary-600 text-sm font-bold flex items-center gap-1 group-hover:gap-2 transition-all font-bn">
                    {t("বিস্তারিত দেখুন", "Learn More")} <ArrowRight className="w-4 h-4" />
                  </div>
                </motion.div>
              </Link>
            </RevealOnScroll>
            {/* Card 2 */}
            <RevealOnScroll delay={0.2}>
              <Link href="/courses" className="block group lg:translate-x-6">
                <motion.div whileHover={{ y: -8, scale: 1.03 }} transition={{ type: "spring", stiffness: 300 }} className="bg-white p-6 rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.03)] border border-gray-100">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-lg text-gray-900 leading-tight font-bn">{t("ইংরেজিতে দক্ষতা", "Excel in English")}</h3>
                  </div>
                  <p className="text-sm text-gray-500 mb-4 leading-relaxed font-bn">
                    {t("ছোটবেলা থেকেই উন্নত শব্দভাণ্ডার এবং সম্পাদকীয় মানের লেখার দক্ষতা তৈরি করুন।", "Build a sophisticated vocabulary and editorial-grade writing skills from an early age.")}
                  </p>
                  <div className="text-primary-600 text-sm font-bold flex items-center gap-1 group-hover:gap-2 transition-all font-bn">
                    {t("বিস্তারিত দেখুন", "Learn More")} <ArrowRight className="w-4 h-4" />
                  </div>
                </motion.div>
              </Link>
            </RevealOnScroll>
            {/* Card 3 */}
            <RevealOnScroll delay={0.3}>
              <Link href="/courses" className="block group">
                <motion.div whileHover={{ y: -8, scale: 1.03 }} transition={{ type: "spring", stiffness: 300 }} className="bg-white p-6 rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.03)] border border-gray-100">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700">
                      <Brain className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-lg text-gray-900 leading-tight font-bn">{t("গণিতের ভয় আর নয়", "No More Fear of Math")}</h3>
                  </div>
                  <p className="text-sm text-gray-500 mb-4 leading-relaxed font-bn">
                    {t("আমরা জটিল সংখ্যাগুলোকে মজার পাজলে পরিণত করি, যা গাণিতিক আত্মবিশ্বাস তৈরি করে।", "We turn complex numbers into playful puzzles, building lasting mathematical confidence.")}
                  </p>
                  <div className="text-primary-600 text-sm font-bold flex items-center gap-1 group-hover:gap-2 transition-all font-bn">
                    {t("বিস্তারিত দেখুন", "Learn More")} <ArrowRight className="w-4 h-4" />
                  </div>
                </motion.div>
              </Link>
            </RevealOnScroll>
          </div>

          {/* Central Focal Point (The Child Image) */}
          <div className="lg:col-span-4 flex justify-center order-1 lg:order-2 my-8 lg:my-0">
            <RevealOnScroll delay={0.2}>
            <div className="relative w-full max-w-[350px] lg:max-w-[400px]">
              {/* Decorative Ring */}
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 border-[3px] border-dashed border-primary-300 rounded-full" 
              />
              {/* Main Image Container */}
              <div className="relative z-10 p-5">
                <img
                  className="w-full aspect-square object-cover rounded-full shadow-2xl border-8 border-white"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBFN2CRfZPHgoknZEvVDkwhlOsi4mTaWvcYHfTAWddqDc0rhnz-PICixOzaBMOGULOMuy6T9f-w23gBEzWVUWU1f9YkD4EXruFP_DN3ihVZWB1lj2wwZd7UkeUpSRlQtt4A9LI9D8k6ZThgOBaPHjrCUluUyZKLXTY373HZvvlfq3phOXMihMrwe6PGQHmQM7yt-4i6wuZgZuGWvcsdqzH-aP85_uFUATI41edi9025fMF87k7zlD5z0QKCKP3UkPv0cWgxMzYT-TlM"
                  alt="Happy student learning"
                />
                {/* Floating Badge */}
                <motion.div 
                  animate={{ y: [-5, 5, -5], rotate: [8, -4, 8] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute top-2 right-2 bg-accent-400 text-primary-900 w-16 h-16 md:w-20 md:h-20 rounded-full shadow-lg flex flex-col items-center justify-center cursor-pointer hover:bg-accent-300"
                >
                  <span className="text-xl md:text-2xl font-black font-bn leading-none">#১</span>
                  <span className="text-[10px] md:text-xs font-bold tracking-tighter uppercase leading-none mt-1">Choice</span>
                </motion.div>
              </div>
            </div>
            </RevealOnScroll>
          </div>

          {/* Right Column (3 cards) */}
          <div className="lg:col-span-4 space-y-6 md:space-y-8 order-3 lg:order-3">
            {/* Card 4 */}
            <RevealOnScroll delay={0.4}>
              <Link href="/courses" className="block group">
                <motion.div whileHover={{ y: -8, scale: 1.03 }} transition={{ type: "spring", stiffness: 300 }} className="bg-white p-6 rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.03)] border border-gray-100">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700">
                      <GraduationCap className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-lg text-gray-900 leading-tight font-bn">{t("সম্পূর্ণ প্রস্তুতি", "Complete Preparation")}</h3>
                  </div>
                  <p className="text-sm text-gray-500 mb-4 leading-relaxed font-bn">
                    {t("বাড়ি এবং শীর্ষ বিদ্যালয়ের মধ্যে সেতুবন্ধন তৈরি করার জন্য ডিজাইন করা একটি কারিকুলাম।", "A holistic curriculum designed to bridge the gap between home and top-tier schools.")}
                  </p>
                  <div className="text-primary-600 text-sm font-bold flex items-center gap-1 group-hover:gap-2 transition-all font-bn">
                    {t("বিস্তারিত দেখুন", "Learn More")} <ArrowRight className="w-4 h-4" />
                  </div>
                </motion.div>
              </Link>
            </RevealOnScroll>
            {/* Card 5 */}
            <RevealOnScroll delay={0.5}>
              <Link href="/courses" className="block group lg:-translate-x-6">
                <motion.div whileHover={{ y: -8, scale: 1.03 }} transition={{ type: "spring", stiffness: 300 }} className="bg-white p-6 rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.03)] border border-gray-100">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center text-teal-700">
                      <Phone className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-lg text-gray-900 leading-tight font-bn">{t("বাড়ি থেকে প্রি-স্কুলিং", "Pre-Schooling from Home")}</h3>
                  </div>
                  <p className="text-sm text-gray-500 mb-4 leading-relaxed font-bn">
                    {t("ইন্টারেক্টিভ লাইভ সেশনের মাধ্যমে উচ্চমানের প্রারম্ভিক শিক্ষা আপনার দোরগোড়ায়।", "High-quality early education delivered directly to your doorstep via interactive live sessions.")}
                  </p>
                  <div className="text-primary-600 text-sm font-bold flex items-center gap-1 group-hover:gap-2 transition-all font-bn">
                    {t("বিস্তারিত দেখুন", "Learn More")} <ArrowRight className="w-4 h-4" />
                  </div>
                </motion.div>
              </Link>
            </RevealOnScroll>
            {/* Card 6 */}
            <RevealOnScroll delay={0.6}>
              <Link href="/courses" className="block group">
                <motion.div whileHover={{ y: -8, scale: 1.03 }} transition={{ type: "spring", stiffness: 300 }} className="bg-white p-6 rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.03)] border border-gray-100">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-pink-100 flex items-center justify-center text-pink-700">
                      <Code className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-lg text-gray-900 leading-tight font-bn">{t("কোডিং মাস্টারী", "Coding Mastery")}</h3>
                  </div>
                  <p className="text-sm text-gray-500 mb-4 leading-relaxed font-bn">
                    {t("লজিক এবং ক্রিয়েটিভ কোডিং দিয়ে আপনার সন্তানকে ডিজিটাল বিশ্ব গড়তে সক্ষম করুন।", "Empower your child to build their own digital worlds with logic and creative coding.")}
                  </p>
                  <div className="text-primary-600 text-sm font-bold flex items-center gap-1 group-hover:gap-2 transition-all font-bn">
                    {t("বিস্তারিত দেখুন", "Learn More")} <ArrowRight className="w-4 h-4" />
                  </div>
                </motion.div>
              </Link>
            </RevealOnScroll>
          </div>
        </div>
      </section>

      {/* ============================================
          COURSES — Bento Grid with Filter Pills
          ============================================ */}
      <section className="pt-8 md:pt-12 pb-16 md:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-left mb-8 md:mb-10">
            <h2 className="text-3xl md:text-5xl font-extrabold font-bn text-primary-900 mb-3 tracking-tight">
              {t("আমাদের কোর্সসমূহ", "Our Courses")}
            </h2>
            <p className="text-gray-600 font-sans font-medium text-lg">
              {t("আপনার পছন্দের বিষয় বেছে নিন", "Choose your favorite subject")}
            </p>
          </div>

          {/* Dynamic Filter Pills */}
          <div className="mb-10 flex justify-start">
            <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 inline-flex flex-wrap gap-2 md:gap-3 items-center overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              <button
                onClick={() => setActiveCategory("")}
                className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all whitespace-nowrap font-bn ${activeCategory === ""
                    ? "bg-primary-700 text-white shadow-md"
                    : "text-gray-600 hover:bg-white/80"
                  }`}
              >
                <LayoutGrid className="w-4 h-4" />
                {t("সকল কোর্স", "All Courses")}
              </button>
              {categories.map((cat) => {
                const IconComp = getCategoryIcon(cat.slug, cat.name);
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(activeCategory === String(cat.id) ? "" : String(cat.id))}
                    className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap font-bn ${activeCategory === String(cat.id)
                        ? "bg-primary-700 text-white shadow-md"
                        : "text-gray-600 hover:bg-white/80"
                      }`}
                  >
                    <IconComp className="w-4 h-4" />
                    {cat.name_bn || cat.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Courses Bento Grid */}
          {loading ? (
            <>
              {/* Desktop Loaders */}
              <div className="hidden md:grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 -mx-4 md:mx-0">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className={`rounded-2xl overflow-hidden ${i === 1 ? "md:col-span-2 md:row-span-1" : ""}`}>
                    <div className={`skeleton ${i === 1 ? "h-64 md:h-80" : "h-48"}`} />
                    <div className="p-5 space-y-3 bg-white border border-gray-100 rounded-b-2xl">
                      <div className="skeleton h-4 w-3/4" />
                      <div className="skeleton h-3 w-1/2" />
                      <div className="skeleton h-8 w-24" />
                    </div>
                  </div>
                ))}
              </div>
              {/* Mobile Loaders */}
              <div className="md:hidden flex overflow-x-auto snap-x snap-mandatory gap-4 pb-8 -mx-4 px-[12.5vw]" style={{ scrollbarWidth: "none" }}>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="rounded-2xl overflow-hidden shrink-0 snap-center w-[75vw]">
                    <div className="skeleton h-48" />
                    <div className="p-5 space-y-3 bg-white border border-gray-100 rounded-b-2xl">
                      <div className="skeleton h-4 w-3/4" />
                      <div className="skeleton h-3 w-1/2" />
                      <div className="skeleton h-8 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : courses.length === 0 ? (
            <div className="text-center py-20">
              <BookOpen className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-400 font-bn">
                {t("কোনো কোর্স পাওয়া যায়নি", "No courses found")}
              </h3>
              <p className="text-sm text-gray-400 font-bn mt-1">
                {t("অন্য ক্যাটেগরি দেখুন", "Try another category")}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Bento Grid */}
              <div className="hidden md:grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 stagger-children">
                {courses.map((course, index) => renderCourseCard(course, index, false))}
              </div>

              {/* Mobile Infinite Auto-Scrolling Carousel */}
              <div className="md:hidden overflow-hidden -mx-4 py-4 cursor-grab active:cursor-grabbing" ref={emblaRef}>
                <div className="flex touch-pan-y">
                  {courses.map((course, index) => (
                    <div key={course.id} className="flex-[0_0_75%] min-w-0 pl-4 relative h-auto">
                      {renderCourseCard(course, index, true)}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* View All Link */}
          {courses.length > 0 && (
            <div className="text-center mt-10">
              <Link href="/courses">
                <motion.button 
                  className="group bg-primary-600 text-white font-extrabold font-bn px-10 py-4 rounded-full text-xl shadow-[0_8px_0_#4c1d95] hover:shadow-[0_4px_0_#4c1d95] hover:translate-y-1 active:shadow-none active:translate-y-2 transition-all inline-flex items-center gap-3 mx-auto border-2 border-primary-800"
                  whileHover={{ scale: 1.02 }}
                >
                  {t("সকল কোর্স দেখুন", "View All Courses")}
                  <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
                </motion.button>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ============================================
          HATE KOLOM E-LIBRARY (Supplementary Content)
          ============================================ */}
      <HappyBabyELibrary />

      {/* ============================================
          HOW IT WORKS (The Journey Path Section)
          ============================================ */}
      <section ref={containerRef} className="py-20 md:py-32 relative bg-primary-50/40 overflow-hidden">
        {/* Section Header */}
        <div className="text-center mb-16 relative z-10">
          <RevealOnScroll>
            <h2 className="text-4xl md:text-5xl font-extrabold font-bn text-primary-900 mb-4">
              {t("কীভাবে শুরু করবো?", "How to Get Started?")}
            </h2>
            <p className="text-gray-500 font-bn text-lg">{t("৬টি সহজ ও মজার ধাপে", "In 6 easy & fun steps")}</p>
          </RevealOnScroll>
        </div>

        <div className="max-w-6xl mx-auto px-6 relative">
          {/* SVG Path Connection for Desktop */}
          <div className="hidden lg:block absolute inset-0 z-0 pointer-events-none opacity-50">
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1200 600">
              <path 
                className="stroke-primary-300/40 fill-none stroke-[6]" 
                d="M200,116 L600,116 L1000,116 C1120,116 1120,484 1000,484 L600,484 L200,484" 
                strokeDasharray="12 12" 
                strokeLinecap="round"
              />
              <motion.path 
                style={{ pathLength }}
                className="stroke-primary-600 fill-none stroke-[6]" 
                d="M200,116 L600,116 L1000,116 C1120,116 1120,484 1000,484 L600,484 L200,484" 
                strokeLinecap="round"
              />
              <motion.circle 
                fill="#7c3aed" 
                r="10" 
                style={{ offsetPath: "path('M200,116 L600,116 L1000,116 C1120,116 1120,484 1000,484 L600,484 L200,484')", offsetDistance: pathLength }}
                className="shadow-xl"
              />
            </svg>
          </div>

          {/* SVG Path Connection for Mobile */}
          <div className="block lg:hidden absolute inset-0 z-0 pointer-events-none opacity-40">
            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 1400">
              <path 
                className="stroke-primary-300/40 fill-none stroke-[12]" 
                d="M250,200 L750,200 C870,200 870,700 750,700 L250,700 C130,700 130,1200 250,1200 L750,1200" 
                strokeDasharray="24 24" 
                strokeLinecap="round"
              />
              <motion.path 
                style={{ pathLength }}
                className="stroke-primary-600 fill-none stroke-[12]" 
                d="M250,200 L750,200 C870,200 870,700 750,700 L250,700 C130,700 130,1200 250,1200 L750,1200" 
                strokeLinecap="round"
              />
              <motion.circle 
                fill="#7c3aed" 
                r="16" 
                style={{ offsetPath: "path('M250,200 L750,200 C870,200 870,700 750,700 L250,700 C130,700 130,1200 250,1200 L750,1200')", offsetDistance: pathLength }}
                className="shadow-xl"
              />
            </svg>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-10 lg:gap-y-32 gap-x-4 items-center justify-items-center relative z-10 px-0">
            <StepCard 
              number={t("১", "1")}
              icon={Users}
              title={t("রেজিস্ট্রেশন", "Registration")}
              description={t("ফোন নম্বর দিয়ে একাউন্ট খুলুন", "Create your account easily")}
              bgColor="bg-blue-100/80"
              textColor="text-blue-900"
              accentColor="bg-blue-600"
              wrapperClass="order-1"
            />
            <StepCard 
              number={t("২", "2")}
              icon={BookOpen}
              title={t("কোর্স বাছাই", "Choose Course")}
              description={t("পছন্দের কোর্স বেছে নিন", "Pick the course you like")}
              bgColor="bg-amber-100/90"
              textColor="text-amber-900"
              accentColor="bg-amber-500"
              delay={0.15}
              wrapperClass="order-2"
            />
            <StepCard 
              number={t("৩", "3")}
              icon={Star}
              title={t("ভর্তি হোন", "Enroll")}
              description={t("পেমেন্ট করে ভর্তি নিশ্চিত করুন", "Complete payment & confirm")}
              bgColor="bg-emerald-100/80"
              textColor="text-emerald-900"
              accentColor="bg-emerald-500"
              delay={0.3}
              wrapperClass="order-4 lg:order-3"
            />
            <StepCard 
              number={t("৪", "4")}
              icon={Play}
              title={t("শেখা শুরু করুন", "Start Learning")}
              description={t("ভিডিও দেখুন এবং অধ্যায় শেষ করুন", "Learn from videos to progress")}
              bgColor="bg-purple-100/80"
              textColor="text-purple-900"
              accentColor="bg-purple-600"
              delay={0.15}
              wrapperClass="order-3 lg:order-6"
            />
            <StepCard 
              number={t("৫", "5")}
              icon={Puzzle}
              title={t("কুইজ ও ধাঁধা", "Quiz Checks")}
              description={t("জ্ঞান যাচাই করতে মজার কুইজ দিন", "Test skills with playful quizzes")}
              bgColor="bg-teal-100/80"
              textColor="text-teal-900"
              accentColor="bg-teal-500"
              delay={0.3}
              wrapperClass="order-5 lg:order-5"
            />
            <StepCard 
              number={t("৬", "6")}
              icon={Award}
              title={t("সার্টিফিকেট", "Mastery")}
              description={t("কোর্স শেষে নিজের অর্জন বুঝে নিন", "Earn your certificate & celebrate")}
              bgColor="bg-pink-100/80"
              textColor="text-pink-900"
              accentColor="bg-pink-500"
              delay={0.45}
              wrapperClass="order-6 lg:order-4"
            />
          </div>
        </div>
      </section>

      {/* ============================================
          WHY GUARDIANS TRUST US (Parent Trust Section)
          ============================================ */}
      <section className="max-w-4xl mx-auto px-6 mb-20 mt-16 relative z-10">
        <RevealOnScroll>
          <div className="bg-white rounded-[2.5rem] p-10 relative overflow-hidden shadow-[0_20px_50px_rgba(34,0,93,0.08)] border-4 border-gray-50/50">
            <div className="absolute -bottom-10 -right-10 opacity-[0.03] rotate-45 pointer-events-none">
              <ShieldCheck size={240} fill="currentColor" />
            </div>
            
            <h2 className="text-3xl font-extrabold font-bn text-center mb-10 relative z-10 text-gray-900">
              {t("অভিভাবকরা কেন আমাদের বিশ্বাস করেন?", "Why Guardians Trust Us")}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
              {[
                { icon: ShieldCheck, title: t("নিরাপদ গণ্ডি", "Safe Haven"), desc: t("ছোটদের জন্য শতভাগ মডারেট করা নিরাপদ স্পেস।", "100% moderated spaces designed specifically for young explorers."), color: "bg-blue-50", iconColor: "text-blue-600" },
                { icon: TrendingUp, title: t("প্রকৃত অগ্রগতি", "Real Progress"), desc: t("তাদের সাফল্য উদযাপনের জন্য সুন্দর ও সহজ ড্যাশবোর্ড।", "Beautiful, easy-to-read dashboards so you can celebrate their wins."), color: "bg-purple-50", iconColor: "text-purple-600" },
                { icon: Brain, title: t("দক্ষতা তৈরি", "Skill Building"), desc: t("সৃজনশীলতা, বিশ্লেষণ ও আত্মবিশ্বাস তৈরিতে ফোকাস।", "Focused on creativity, critical thinking, and confidence."), color: "bg-emerald-50", iconColor: "text-emerald-600" }
              ].map((item) => (
                <motion.div 
                  key={item.title}
                  className="text-center group"
                  whileHover={{ y: -5 }}
                >
                  <div className={`w-16 h-16 ${item.color} rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-sm`}>
                    <item.icon className={`${item.iconColor}`} size={32} />
                  </div>
                  <h4 className="font-bold font-bn text-xl mb-2 text-gray-900">{item.title}</h4>
                  <p className="text-gray-500 text-sm font-medium font-bn leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </RevealOnScroll>
      </section>

      {/* ============================================
          BOTTOM CTA SECTION
          ============================================ */}
      <section className="max-w-4xl mx-auto text-center px-6 pb-20 mt-16 relative z-10">
        <RevealOnScroll>
          <motion.div 
            className="inline-block p-1 bg-white rounded-full mb-6 shadow-sm border border-gray-100 cursor-pointer"
            whileHover={{ scale: 1.05 }}
          >
            <div className="flex items-center gap-3 px-5 py-2">
              <div className="flex -space-x-3">
                <img alt="Student" className="w-8 h-8 rounded-full border-2 border-white shadow-sm" src="https://picsum.photos/seed/s1/50/50" referrerPolicy="no-referrer" />
                <img alt="Student" className="w-8 h-8 rounded-full border-2 border-white shadow-sm" src="https://picsum.photos/seed/s2/50/50" referrerPolicy="no-referrer" />
                <div className="w-8 h-8 rounded-full border-2 border-white bg-primary-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">+</div>
              </div>
              <span className="font-bold font-bn text-primary-900 text-sm">
                {t("৫০,০০০+ খুশি শিক্ষার্থীর সাথে যুক্ত হোন", "Join 50,000+ Happy Explorers")}
              </span>
            </div>
          </motion.div>
          
          <h2 className="text-4xl md:text-5xl font-extrabold font-bn mb-8 text-gray-900">
            {t("ভ্রমণ শুরু করার জন্য প্রস্তুত?", "Ready to Start the Journey?")}
          </h2>
          
          <Link href="/register">
            <motion.button 
              className="group bg-primary-600 text-white font-extrabold font-bn px-10 py-5 rounded-full text-xl md:text-2xl shadow-[0_8px_0_#4c1d95] hover:shadow-[0_4px_0_#4c1d95] hover:translate-y-1 active:shadow-none active:translate-y-2 transition-all flex items-center gap-3 mx-auto border-2 border-primary-800"
              whileHover={{ scale: 1.02 }}
            >
              {t("ভর্তি শুরু করুন", "Enroll Your Scholar")}
              <Play size={24} className="group-hover:translate-x-1 transition-transform fill-white" />
            </motion.button>
          </Link>
        </RevealOnScroll>
      </section>

      {/* ============================================
          ACHIEVEMENTS (Social Proof)
          ============================================ */}
      <PlatformAchievements data={homepageContent} />

      {/* ============================================
          SUCCESS & JOY HUB (COMMUNITY)
          ============================================ */}
      <SuccessAndJoyHub data={homepageContent} />

      <Footer />
    </div>
  );
}
