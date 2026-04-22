"use client";

import { useState, useEffect, ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
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
  ShoppingBag,
  ShoppingCart,
  Package,
  Check,
  type LucideIcon,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { SuccessAndJoyHub } from "@/components/home/SuccessAndJoyHub";
import { HappyBabyELibrary } from "@/components/home/HappyBabyELibrary";
import { PlatformAchievements } from "@/components/home/PlatformAchievements";
import { Footer } from "@/components/layout/Footer";
import { useLocaleStore } from "@/stores/locale-store";
import { useCartStore } from "@/stores/cart-store";
import { toast } from "@/stores/toast-store";
import { api } from "@/lib/api";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

interface ShopItem {
  id: string;
  title: string;
  title_bn: string | null;
  slug: string;
  thumbnail_url: string | null;
  price: number;
  compare_price: number | null;
  is_free: boolean;
  is_active: boolean;
  stock_quantity: number;
  category_name: string | null;
  category_name_bn: string | null;
  images: { id: string; image_url: string; sort_order: number }[];
  author: string | null;
}

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
  const { addItem } = useCartStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [shopLoading, setShopLoading] = useState(true);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

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

  // Load shop items
  useEffect(() => {
    const loadShop = async () => {
      setShopLoading(true);
      try {
        const data: any = await api.get("/physical-items/");
        setShopItems(Array.isArray(data) ? data : []);
      } catch { setShopItems([]); }
      setShopLoading(false);
    };
    loadShop();
  }, []);

  const handleAddToCart = (e: React.MouseEvent, item: ShopItem) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      productId: item.id,
      productType: "physical_book",
      title: item.title,
      title_bn: item.title_bn,
      thumbnail_url: item.images?.[0]?.image_url || item.thumbnail_url,
      price: item.price,
      compare_price: item.compare_price,
      maxQuantity: item.stock_quantity,
      slug: item.slug,
    });
    setAddedIds((prev) => new Set(prev).add(item.id));
    toast.success(t("কার্টে যোগ হয়েছে", "Added to cart"));
    setTimeout(() => {
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }, 1500);
  };

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
          HERO BANNER
          ============================================ */}
      <section className="relative overflow-hidden" style={{ maxHeight: 'calc(100vh - 64px)' }}>
        <Link href="/register" className="block">
          <img
            src="/hero_banner.jpeg"
            alt={t("হাতে কলম — খেলো, শেখো, বড়ো হও", "Hate Kolom — Play, Learn, Grow")}
            className="w-full h-full object-cover"
            style={{ maxHeight: 'calc(100vh - 64px)' }}
          />
        </Link>

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
          SHOP — Product Grid
          ============================================ */}
      <section className="pt-8 md:pt-12 pb-16 md:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-left mb-8 md:mb-10">
            <h2 className="text-3xl md:text-5xl font-extrabold font-bn text-gray-900 mb-3 tracking-tight">
              {t("আমাদের শপ", "Our Shop")}
            </h2>
            <p className="text-gray-500 font-bn font-medium text-lg">
              {t("স্টিকার বই, কালারিং বুক ও শিক্ষা উপকরণ", "Sticker books, coloring books & educational materials")}
            </p>
          </div>

          {/* Product Grid */}
          {shopLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-2xl overflow-hidden">
                  <div className="skeleton aspect-square" />
                  <div className="p-4 space-y-3 bg-white border border-gray-100 rounded-b-2xl">
                    <div className="skeleton h-4 w-3/4" />
                    <div className="skeleton h-3 w-1/2" />
                    <div className="skeleton h-10 w-full rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : shopItems.length === 0 ? (
            <div className="text-center py-20">
              <Package className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-400 font-bn">
                {t("এখনো কোনো প্রোডাক্ট নেই", "No products yet")}
              </h3>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {shopItems.map((item) => {
                const imageUrl = item.images?.[0]?.image_url || item.thumbnail_url;
                const isAdded = addedIds.has(item.id);
                const outOfStock = item.stock_quantity <= 0;

                return (
                  <Link
                    key={item.id}
                    href={`/shop/${item.slug}`}
                    className="group flex flex-col cursor-pointer outline-none"
                  >
                    <div className="flex flex-col h-full bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-gray-100">
                      {/* Image */}
                      <div className="relative aspect-square overflow-hidden flex-shrink-0">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-blue-100 to-cyan-200 flex items-center justify-center">
                            <Package className="w-16 h-16 text-blue-300" />
                          </div>
                        )}
                        {item.is_free && (
                          <span className="absolute top-2.5 left-2.5 bg-emerald-500 text-white text-[9px] sm:text-[10px] font-bold uppercase px-2 py-0.5 rounded-md shadow-lg">
                            Free
                          </span>
                        )}
                        {item.compare_price && item.compare_price > item.price && (
                          <span className="absolute top-2.5 right-2.5 bg-red-500 text-white text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md shadow-lg">
                            {Math.round((1 - item.price / item.compare_price) * 100)}% OFF
                          </span>
                        )}
                        {outOfStock && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <span className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full font-bn">
                              {t("স্টক আউট", "Out of Stock")}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-3 sm:p-4 flex flex-col flex-grow">
                        <div className="flex items-start gap-1.5 mb-1.5">
                          <h3 className="font-bold text-sm sm:text-base text-gray-900 line-clamp-2 leading-snug flex-1 font-bn group-hover:text-blue-700 transition-colors">
                            {t(item.title_bn || item.title, item.title)}
                          </h3>
                          <span className={`text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap flex-shrink-0 ${
                            item.is_free ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-700"
                          }`}>
                            {item.is_free ? t("ফ্রি", "Free") : `৳${item.price}`}
                          </span>
                        </div>

                        {item.author && (
                          <span className="text-[11px] text-gray-500 font-bn mb-1.5 line-clamp-1">
                            {item.author}
                          </span>
                        )}

                        {item.stock_quantity > 0 && item.stock_quantity <= 5 && (
                          <span className="text-[10px] text-amber-600 font-semibold font-bn mb-2">
                            {t(`মাত্র ${item.stock_quantity}টি বাকি`, `Only ${item.stock_quantity} left`)}
                          </span>
                        )}

                        <div className="mt-auto pt-2">
                          {outOfStock ? (
                            <span className="flex items-center justify-center gap-1.5 bg-gray-200 text-gray-500 px-4 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold w-full font-bn cursor-not-allowed">
                              {t("স্টক আউট", "Out of Stock")}
                            </span>
                          ) : (
                            <button
                              onClick={(e) => handleAddToCart(e, item)}
                              className={`flex items-center justify-center gap-1.5 px-4 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold w-full transition-all font-bn ${
                                isAdded
                                  ? "bg-emerald-500 text-white"
                                  : "bg-gradient-to-r from-[#1a3f6f] to-[#2563eb] text-white hover:shadow-lg hover:shadow-blue-500/20"
                              }`}
                            >
                              {isAdded ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  {t("যোগ হয়েছে", "Added")}
                                </>
                              ) : (
                                <>
                                  <ShoppingCart className="w-3.5 h-3.5" />
                                  {t("কার্টে যোগ করুন", "Add to Cart")}
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* View All Link */}
          {shopItems.length > 0 && (
            <div className="text-center mt-10">
              <Link href="/shop">
                <motion.button
                  className="group bg-gradient-to-r from-[#1a3f6f] to-[#2563eb] text-white font-extrabold font-bn px-10 py-4 rounded-full text-xl shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all inline-flex items-center gap-3 mx-auto"
                  whileHover={{ scale: 1.02 }}
                >
                  {t("সব প্রোডাক্ট দেখুন", "View All Products")}
                  <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
                </motion.button>
              </Link>
            </div>
          )}
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
