"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { Rocket, Wand2, FlaskConical, Feather, Leaf, Eye, BookOpen, ChevronLeft, ChevronRight, ArrowRight, Star } from "lucide-react";
import { useLocaleStore } from "@/stores/locale-store";
import { api } from "@/lib/api";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

const categories = [
  { id: "space", label: "Space Tales", icon: Rocket },
  { id: "math", label: "Magic Math", icon: Wand2 },
  { id: "scifi", label: "Sci-Fi Quests", icon: FlaskConical },
  { id: "history", label: "History Heroes", icon: Feather },
  { id: "nature", label: "Nature Bio", icon: Leaf },
];

const books = [
  {
    id: 1,
    title: "Galactic Journey",
    author: "Dr. Neil Starborn",
    price: "৳৪০",
    pages: 85,
    img: "https://images.unsplash.com/photo-1614730321146-b6fa6a46bcb4?q=80&w=400&fit=crop",
    category: "space"
  },
  {
    id: 2,
    title: "The Magic Oak",
    author: "Elena Moon",
    price: "৳৫০",
    pages: 64,
    img: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=400&fit=crop",
    category: "nature"
  },
  {
    id: 3,
    title: "Deep Blue Secrets",
    author: "Captain Reef",
    price: "৳৪০",
    pages: 72,
    img: "https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?q=80&w=400&fit=crop",
    category: "scifi"
  },
  {
    id: 4,
    title: "Number Quest",
    author: "Prof. Pi",
    price: "৳৬০",
    pages: 48,
    img: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=400&fit=crop",
    category: "math"
  }
];

function BookCard({ book, idx, t }: { book: any; idx: number; t: (bn: string, en: string) => string }) {
  return (
    <Link href={book.slug ? `/ebooks/${book.slug}` : "#"} className="group flex flex-col cursor-pointer outline-none h-full">
      <motion.div whileHover={{ y: -6 }} className="flex flex-col h-full bg-white rounded-2xl overflow-hidden shadow-md group-hover:shadow-xl transition-all duration-300 border border-gray-100">
        {/* Image Section */}
        <div className="relative aspect-[4/5] overflow-hidden flex-shrink-0">
          <img
            alt={book.title}
            src={book.img}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
          {/* Badges */}
          {book.is_free && (
            <span className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 bg-emerald-500 text-white text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md shadow-lg">
              Free
            </span>
          )}
          {book.compare_price && book.rawPrice && book.compare_price > book.rawPrice && (
            <span className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 bg-red-500 text-white text-[9px] sm:text-[10px] font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md shadow-lg">
              {Math.round((1 - book.rawPrice / book.compare_price) * 100)}% OFF
            </span>
          )}
        </div>

        {/* Content Section */}
        <div className="p-3 sm:p-4 flex flex-col flex-grow">
          {/* Title + Price Badge */}
          <div className="flex items-start gap-1.5 mb-1.5 sm:mb-2">
            <h3 className="font-bold text-sm sm:text-base text-gray-900 line-clamp-2 leading-snug flex-1 font-bn">{book.title}</h3>
            <span className={`text-[10px] sm:text-xs font-bold px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-md whitespace-nowrap flex-shrink-0 ${
              book.price === t("ফ্রি", "Free")
                ? "bg-emerald-50 text-emerald-600"
                : "bg-primary-50 text-primary-700"
            }`}>
              {book.price}
            </span>
          </div>

          {/* Author */}
          <div className="flex items-center gap-1.5 text-gray-500 mb-2 sm:mb-3">
            <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
            </svg>
            <p className="text-[11px] sm:text-xs font-medium truncate">{book.author}</p>
          </div>

          {/* Stats Row */}
          <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-gray-400 font-medium mb-3 sm:mb-4">
            {book.pages && (
              <span className="flex items-center gap-1">
                <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> {book.pages} {t("পৃষ্ঠা", "Pages")}
              </span>
            )}
            <span className="flex items-center gap-0.5">
              <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 fill-amber-400" /> 4.9
            </span>
          </div>

          {/* CTA Button */}
          <div className="mt-auto">
            <span className="flex items-center justify-center gap-1.5 bg-primary-600 text-white px-4 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold group-hover:bg-primary-700 transition-colors w-full font-bn">
              {t("বিস্তারিত দেখুন", "View Details")}
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export function HappyBabyELibrary() {
  const { t } = useLocaleStore();
  const [activeCategory, setActiveCategory] = useState("space");
  const [displayBooks, setDisplayBooks] = useState<any[]>(books);

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "start", slidesToScroll: 1, dragFree: true },
    [Autoplay({ delay: 3500, stopOnInteraction: false, stopOnMouseEnter: true })]
  );

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  useEffect(() => {
    async function fetchEbooks() {
      try {
        const data: any = await api.get('/ebooks/?limit=4');
        const items = data?.items || data || [];
        if (items && items.length > 0) {
          // Map backend items to match the layout structure
          const mapped = items.slice(0, 4).map((eb: any, i: number) => ({
            id: eb.id || i,
            title: eb.title_bn || eb.title,
            author: eb.author || "Hate Kolom Explorer",
            price: eb.is_free ? t("ফ্রি", "Free") : `৳${eb.price}`,
            rawPrice: eb.price,
            compare_price: eb.compare_price || null,
            is_free: eb.is_free || false,
            pages: eb.pages || null,
            img: eb.thumbnail_url || books[i % 4].img,
            category: "all",
            slug: eb.slug || String(eb.id)
          }));
          setDisplayBooks(mapped);
        }
      } catch (err) {
        console.error("Failed to load ebooks, using layout defaults.", err);
      }
    }
    fetchEbooks();
  }, [t]);

  return (
    <section className="bg-transparent py-20 relative overflow-hidden font-bn">      
      <div className="max-w-7xl mx-auto px-4 md:px-8 relative z-10">
        <header className="mb-12">
          <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-2">
            {t("হেইট কলম ই-লাইব্রেরি", "Hate Kolom E-Library")}
          </h2>
          <p className="text-lg text-gray-600 font-sans font-medium">
            {t("অ্যাডভেঞ্চার এখন হাতের মুঠোয়", "Adventure at Your Fingertips")}
          </p>
        </header>

        {/* Adventure Chips — horizontal scroll strip on mobile */}
        <div className="relative mb-8 md:mb-12 z-10 font-sans">
          <div className="flex gap-2 md:gap-4 overflow-x-auto pb-1 hide-scrollbar -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory md:flex-wrap md:overflow-visible" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-1.5 md:gap-2 px-3.5 py-2 md:px-6 md:py-3 rounded-full transition-all text-xs md:text-sm whitespace-nowrap snap-start flex-shrink-0 md:flex-shrink ${
                    isActive 
                      ? "bg-primary-600 text-white shadow-md shadow-primary-600/30 scale-105" 
                      : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-100"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 md:w-5 md:h-5" />
                  <span className="font-bold tracking-wide">{cat.label}</span>
                </button>
              );
            })}
          </div>
          {/* Right fade affordance on mobile */}
          <div className="absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none md:hidden"></div>
        </div>

        {/* Book Carousel (mobile) + Grid (desktop) */}
        <div className="relative z-10 font-sans">
          {/* Desktop Grid */}
          <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {displayBooks.map((book, idx) => (
              <BookCard key={book.id} book={book} idx={idx} t={t} />
            ))}
          </div>

          {/* Mobile Carousel */}
          <div className="md:hidden">
            <div className="overflow-hidden -mx-4" ref={emblaRef}>
              <div className="flex gap-3 pl-4 pr-8">
                {displayBooks.map((book, idx) => (
                  <div key={book.id} className="flex-[0_0_46%] min-w-0">
                    <BookCard book={book} idx={idx} t={t} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Navigation Arrows */}
          <div className="flex items-center justify-end gap-2 mt-6">
            <button onClick={scrollPrev} className="md:hidden w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors bg-white shadow-sm">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <button onClick={scrollNext} className="md:hidden w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors bg-white shadow-sm">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* More Content Indicator */}
        <div className="mt-16 text-center pb-8">
          <Link href="/ebooks">
            <motion.button 
              className="group bg-primary-600 text-white font-extrabold font-bn px-10 py-4 rounded-full text-xl shadow-[0_8px_0_#4c1d95] hover:shadow-[0_4px_0_#4c1d95] hover:translate-y-1 active:shadow-none active:translate-y-2 transition-all inline-flex items-center gap-3 mx-auto border-2 border-primary-800"
              whileHover={{ scale: 1.02 }}
            >
              {t("সকল বই দেখুন", "View All Books")}
              <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </motion.button>
          </Link>
        </div>
      </div>
    </section>
  );
}
