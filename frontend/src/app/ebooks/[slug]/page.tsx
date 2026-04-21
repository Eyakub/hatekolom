"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookOpenText, ShoppingCart, ArrowLeft, Loader2, Download,
  FileText, User as UserIcon, CheckCircle2,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { motion } from "motion/react";
import { useCartStore } from "@/stores/cart-store";
import { toast } from "@/stores/toast-store";
import { useLocaleStore } from "@/stores/locale-store";

interface EbookDetail {
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
  ebook_id: string | null;
}

export default function EbookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, accessToken } = useAuthStore();
  const { addItem } = useCartStore();
  const { t } = useLocaleStore();
  const [ebook, setEbook] = useState<EbookDetail | null>(null);
  const [cartAdded, setCartAdded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data: any = await api.get(`/ebooks/${params.slug}`);
        setEbook(data);
      } catch {
        setError(true);
      }
      setLoading(false);
    };
    load();
  }, [params.slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50/50">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !ebook) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50/50">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-center">
          <div>
            <BookOpenText className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-600 font-bn">ই-বুক পাওয়া যায়নি</h2>
            <Link href="/ebooks" className="mt-4 inline-flex items-center gap-2 text-primary-700 font-semibold text-sm hover:underline">
              <ArrowLeft className="w-4 h-4" /> সব ই-বুক দেখো
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50">
      <Navbar />

      <div className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Back */}
        <Link href="/ebooks" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-700 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> সব ই-বুক
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left — Cover */}
          <div className="lg:col-span-1">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, type: "spring" }}
              whileHover={{ y: -8, scale: 1.02 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden sticky top-24 transform-gpu"
            >
              <div className="aspect-[3/4] bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                {ebook.thumbnail_url ? (
                  <img src={ebook.thumbnail_url} alt={ebook.title} className="w-full h-full object-cover" />
                ) : (
                  <BookOpenText className="w-24 h-24 text-primary-300" />
                )}
              </div>
            </motion.div>
          </div>

          {/* Right — Details */}
          <div className="lg:col-span-2">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 font-bn mb-2">
              {ebook.title_bn || ebook.title}
            </h1>
            {ebook.title_bn && ebook.title !== ebook.title_bn && (
              <p className="text-gray-400 text-sm mb-3">{ebook.title}</p>
            )}

            {/* Meta */}
            <div className="flex flex-wrap gap-3 mb-6">
              {ebook.author && (
                <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
                  <UserIcon className="w-4 h-4" /> {ebook.author}
                </span>
              )}
              {ebook.pages && (
                <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
                  <FileText className="w-4 h-4" /> {ebook.pages} পৃষ্ঠা
                </span>
              )}
            </div>

            {/* Price Card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mb-6">
              <div className="flex items-center gap-3 mb-4">
                {ebook.is_free ? (
                  <span className="text-2xl font-bold text-green-600 font-bn">ফ্রি</span>
                ) : (
                  <>
                    <span className="text-3xl font-bold text-primary-700">৳{ebook.price}</span>
                    {ebook.compare_price && ebook.compare_price > ebook.price && (
                      <>
                        <span className="text-lg text-gray-400 line-through">৳{ebook.compare_price}</span>
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                          {Math.round((1 - ebook.price / ebook.compare_price) * 100)}% OFF
                        </span>
                      </>
                    )}
                  </>
                )}
              </div>

              <div className="space-y-2 mb-4">
                {["ডাউনলোডযোগ্য PDF ফর্ম্যাট", "আজীবন অ্যাক্সেস", "মোবাইল ও কম্পিউটারে পড়ুন"].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-gray-600 font-bn">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> {f}
                  </div>
                ))}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  router.push(`/checkout?product=${ebook.id}&type=ebook`);
                }}
                className="w-full py-3.5 bg-primary-700 text-white font-bold rounded-xl hover:bg-primary-800 transition-colors shadow-lg shadow-primary-700/25 text-sm flex items-center justify-center gap-2 font-bn mt-2"
              >
                <ShoppingCart className="w-4 h-4" />
                {ebook.is_free ? "ফ্রি ডাউনলোড" : "এখনই কিনুন"}
              </motion.button>

              {!ebook.is_free && (
                <button
                  onClick={() => {
                    addItem({
                      productId: ebook.id,
                      productType: "ebook",
                      title: ebook.title,
                      title_bn: ebook.title_bn,
                      thumbnail_url: ebook.thumbnail_url,
                      price: ebook.price,
                      compare_price: ebook.compare_price,
                      maxQuantity: 1,
                      slug: ebook.slug,
                    });
                    setCartAdded(true);
                    toast.success(t("কার্টে যোগ হয়েছে", "Added to cart"));
                    setTimeout(() => setCartAdded(false), 2000);
                  }}
                  className={`w-full py-3 border-2 font-bold rounded-xl text-sm flex items-center justify-center gap-2 font-bn mt-2 transition-all ${
                    cartAdded
                      ? "border-emerald-500 text-emerald-600 bg-emerald-50"
                      : "border-primary-200 text-primary-700 hover:bg-primary-50"
                  }`}
                >
                  {cartAdded ? (
                    <>{t("কার্টে যোগ হয়েছে ✓", "Added to Cart ✓")}</>
                  ) : (
                    <>{t("কার্টে যোগ করুন", "Add to Cart")}</>
                  )}
                </button>
              )}
            </div>

            {/* Description */}
            {(ebook.description_bn || ebook.description) && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <h3 className="font-bold text-gray-900 font-bn mb-3">বিবরণ</h3>
                <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap font-bn">
                  {ebook.description_bn || ebook.description}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
