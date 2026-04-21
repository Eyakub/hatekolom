"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BookOpenText, Search, Loader2, BookOpen, Star, ArrowRight,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { api } from "@/lib/api";
import { useLocaleStore } from "@/stores/locale-store";

interface EbookItem {
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
  author: string | null;
  pages: number | null;
}

export default function EbooksPage() {
  const { t } = useLocaleStore();
  const [ebooks, setEbooks] = useState<EbookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data: any = await api.get("/ebooks/");
        setEbooks(Array.isArray(data) ? data : []);
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const filtered = ebooks.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.title.toLowerCase().includes(q) ||
      e.title_bn?.includes(q) ||
      e.author?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50">
      <Navbar />

      {/* Hero */}
      <div className="bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold font-bn mb-3">📚 ই-বুক সমূহ</h1>
          <p className="text-white/70 font-bn text-lg mb-6">সেরা শিক্ষামূলক ই-বুক ডাউনলোড করো</p>
          <div className="max-w-md mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ই-বুক খোঁজো..."
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-white text-gray-900 text-sm outline-none shadow-lg font-bn"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <BookOpenText className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-400 font-bn">
              {search ? "কোনো ই-বুক পাওয়া যায়নি" : "এখনো কোনো ই-বুক নেই"}
            </h3>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filtered.map((ebook, idx) => (
              <Link
                key={ebook.id}
                href={`/ebooks/${ebook.slug}`}
                className="group flex flex-col cursor-pointer outline-none"
              >
                <div className="flex flex-col h-full bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-gray-100">
                  {/* Image Section */}
                  <div className="relative aspect-[4/5] overflow-hidden flex-shrink-0">
                    {ebook.thumbnail_url ? (
                      <img
                        src={ebook.thumbnail_url}
                        alt={ebook.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                        <BookOpenText className="w-16 h-16 text-primary-300" />
                      </div>
                    )}
                    {/* Badges */}
                    {ebook.is_free && (
                      <span className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 bg-emerald-500 text-white text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md shadow-lg">
                        Free
                      </span>
                    )}
                    {ebook.compare_price && ebook.compare_price > ebook.price && (
                      <span className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 bg-red-500 text-white text-[9px] sm:text-[10px] font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md shadow-lg">
                        {Math.round((1 - ebook.price / ebook.compare_price) * 100)}% OFF
                      </span>
                    )}
                  </div>

                  {/* Content Section */}
                  <div className="p-3 sm:p-4 flex flex-col flex-grow">
                    {/* Title + Price Badge */}
                    <div className="flex items-start gap-1.5 mb-1.5 sm:mb-2">
                      <h3 className="font-bold text-sm sm:text-base text-gray-900 line-clamp-2 leading-snug flex-1 font-bn group-hover:text-primary-700 transition-colors">
                        {ebook.title_bn || ebook.title}
                      </h3>
                      <span className={`text-[10px] sm:text-xs font-bold px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-md whitespace-nowrap flex-shrink-0 ${
                        ebook.is_free
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-primary-50 text-primary-700"
                      }`}>
                        {ebook.is_free ? t("ফ্রি", "Free") : `৳${ebook.price}`}
                      </span>
                    </div>

                    {/* Author */}
                    {ebook.author && (
                      <div className="flex items-center gap-1.5 text-gray-500 mb-2 sm:mb-3">
                        <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
                        </svg>
                        <p className="text-[11px] sm:text-xs font-medium truncate">{ebook.author}</p>
                      </div>
                    )}

                    {/* Stats Row */}
                    <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-gray-400 font-medium mb-3 sm:mb-4">
                      {ebook.pages && (
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> {ebook.pages} {t("পৃষ্ঠা", "Pages")}
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
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
