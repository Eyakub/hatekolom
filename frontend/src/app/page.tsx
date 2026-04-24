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
  Rocket,
  ShoppingBag,
  ShoppingCart,
  Package,
  Check,
  type LucideIcon,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { ExamCard } from "@/components/exam/ExamCard";
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

interface HomeExam {
  id: string;
  slug: string;
  title: string;
  title_bn: string | null;
  thumbnail_url: string | null;
  price: number;
  compare_price: number | null;
  is_free: boolean;
  exam_type: string;
  total_sections: number;
  total_questions: number;
  time_limit_seconds: number | null;
  pass_percentage: number;
  scheduled_start: string | null;
  scheduled_end: string | null;
}

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
  const [exams, setExams] = useState<HomeExam[]>([]);
  const [examsLoading, setExamsLoading] = useState(true);

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

  // Load exams
  useEffect(() => {
    const loadExams = async () => {
      setExamsLoading(true);
      try {
        const data: any = await api.get("/exams/");
        setExams(Array.isArray(data) ? data.slice(0, 3) : []);
      } catch { setExams([]); }
      setExamsLoading(false);
    };
    loadExams();
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
      <section className="w-full bg-white">
        <img
          src="/hero_banner.webp"
          alt={t("হাতে কলম — খেলো, শেখো, বড়ো হও", "Hate Kolom — Play, Learn, Grow")}
          className="w-full h-auto block"
        />
      </section>
      {/* ============================================
          CORE BENEFITS
          ============================================ */}
      <section className="max-w-6xl mx-auto px-6 pt-16 md:pt-24 pb-8 md:pb-12 text-center">
        <RevealOnScroll>
          <span className="inline-block px-4 py-1.5 bg-primary-50 text-primary-700 font-bold text-[0.75rem] tracking-widest uppercase rounded-full mb-6 font-bn">
            {t("কোর বেনিফিট", "Core Benefits")}
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-5 font-bn leading-tight">
            {t("শিশুদের মেধা বিকাশে আধুনিক আর আনন্দময় শিক্ষার", "A new world of modern and joyful learning")}
            <br />
            <span className="text-primary-700">
              {t("নতুন এক জগত।", "for children's mental development.")}
            </span>
          </h2>

          <p className="text-gray-500 max-w-2xl mx-auto text-lg font-bn leading-relaxed">
            {t(
              "প্রথাগত শিক্ষার বাইরে আমরা জোর দিই নতুন কিছু শেখার ওপর, যাতে আপনার সন্তান বুদ্ধিদীপ্ত ও আত্মবিশ্বাসী হয়ে বড় হয়।",
              "Beyond traditional education, we focus on learning new things, so that your child grows up to be intelligent and confident."
            )}
          </p>
        </RevealOnScroll>
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
          EXAMS SECTION
          ============================================ */}
      {exams.length > 0 && (
        <section className="pt-8 md:pt-12 pb-16 md:pb-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Section Header */}
            <div className="text-left mb-8 md:mb-10">
              <h2 className="text-3xl md:text-5xl font-extrabold font-bn text-gray-900 mb-3 tracking-tight">
                {t("অনলাইন পরীক্ষা", "Online Exams")}
              </h2>
              <p className="text-gray-500 font-bn font-medium text-lg">
                {t(
                  "বই পড়া শেষ? এবার পরীক্ষা দিয়ে নিজেকে যাচাই করো!",
                  "Finished reading? Now test yourself with our exams!"
                )}
              </p>
            </div>

            {/* Exam Grid */}
            {examsLoading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
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
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {exams.map((exam) => (
                  <RevealOnScroll key={exam.id} delay={0.1}>
                    <ExamCard exam={exam} />
                  </RevealOnScroll>
                ))}
              </div>
            )}

            {/* View All Link */}
            <div className="text-center mt-10">
              <Link href="/exams">
                <motion.button
                  className="group bg-gradient-to-r from-[#1a3f6f] to-[#2563eb] text-white font-extrabold font-bn px-10 py-4 rounded-full text-xl shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all inline-flex items-center gap-3 mx-auto"
                  whileHover={{ scale: 1.02 }}
                >
                  {t("সব পরীক্ষা দেখুন", "View All Exams")}
                  <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
                </motion.button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ============================================
          WHY GUARDIANS TRUST US (Parent Trust Section)
          ============================================ */}
      <section className="max-w-4xl mx-auto px-6 mb-20 mt-16 relative z-10">
        <RevealOnScroll>
          <div className="bg-white rounded-[2.5rem] p-10 relative overflow-hidden shadow-[0_20px_50px_rgba(34,0,93,0.08)] border-4 border-gray-50/50">
            <div className="absolute -bottom-10 -right-10 opacity-[0.03] rotate-45 pointer-events-none">
              <Award size={240} fill="currentColor" />
            </div>
            
            <h2 className="text-3xl font-extrabold font-bn text-center mb-10 relative z-10 text-gray-900">
              {t("অভিভাবকরা কেন আমাদের বিশ্বাস করেন?", "Why Guardians Trust Us")}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
              {[
                {
                  icon: Heart,
                  title: t("আনন্দময় পড়াশোনা", "Joyful Learning"),
                  desc: t(
                    "আমাদের বইগুলো পেয়ে বাচ্চারা ভীষণ খুশি হয়। আর অভিভাবকরাও নিশ্চিন্ত থাকেন, কারণ বাচ্চারা আনন্দের সাথে নতুন কিছু শিখছে।",
                    "Children are overjoyed with our books, and parents rest easy knowing their little ones are learning happily."
                  ),
                  color: "bg-rose-50",
                  iconColor: "text-rose-500",
                },
                {
                  icon: GraduationCap,
                  title: t("বইয়ের সাথে পরীক্ষা", "Books + Exams"),
                  desc: t(
                    "আমাদের প্রতিটি বইয়ের সাথে বাচ্চারা পাচ্ছে অনলাইনে পরীক্ষা দিয়ে নিজেদের প্রস্তুতি যাচাই করার চমৎকার সুযোগ।",
                    "With every book, children get the wonderful opportunity to test their preparation through our online exams."
                  ),
                  color: "bg-blue-50",
                  iconColor: "text-blue-600",
                },
                {
                  icon: Award,
                  title: t("সাফল্যের স্বীকৃতি", "Recognition of Achievement"),
                  desc: t(
                    "পরীক্ষায় অংশগ্রহণ করলেই থাকছে আকর্ষণীয় সার্টিফিকেট পাওয়ার সুযোগ, যা বাচ্চাদের পড়াশোনায় আরও বেশি উৎসাহ জোগাবে।",
                    "Participating in exams comes with the chance to earn an exciting certificate, motivating children to study even more."
                  ),
                  color: "bg-amber-50",
                  iconColor: "text-amber-500",
                },
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
          <h2 className="text-4xl md:text-5xl font-extrabold font-bn mb-4 text-gray-900 leading-tight">
            {t("আপনার সন্তানের শেখার যাত্রা", "Let Your Child's Learning Journey")}
            <br />
            <span className="text-primary-700">{t("শুরু হোক আজই!", "Begin Today!")}</span>
          </h2>

          <p className="text-gray-500 font-bn text-lg mb-10 max-w-xl mx-auto">
            {t(
              "আনন্দময় বই ও অনলাইন পরীক্ষার মাধ্যমে আপনার সন্তানকে দিন শেখার সেরা সঙ্গী।",
              "Give your child the best learning companion through joyful books and online exams."
            )}
          </p>

          <Link href="/shop">
            <motion.button
              className="group inline-flex items-center gap-3 bg-gradient-to-r from-amber-400 to-amber-500 text-blue-900 font-extrabold font-bn px-10 py-4 rounded-full text-lg shadow-lg shadow-amber-400/30 hover:from-amber-300 hover:to-amber-400 hover:shadow-xl hover:shadow-amber-400/40 hover:-translate-y-0.5 active:translate-y-0 transition-all"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <ShoppingBag size={22} />
              {t("বই দেখুন", "Browse Books")}
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
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
