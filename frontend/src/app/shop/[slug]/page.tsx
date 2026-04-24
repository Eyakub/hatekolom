"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Package, Loader2, ShoppingCart, Check, Minus, Plus,
  ChevronLeft, Weight, Barcode, User, Truck, ShieldCheck,
  ArrowRight, GraduationCap, Clock, FileText, Layers,
  BookOpen, Star, ChevronRight, Zap,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { api } from "@/lib/api";
import { useLocaleStore } from "@/stores/locale-store";
import { useCartStore } from "@/stores/cart-store";
import { toast } from "@/stores/toast-store";
import { motion } from "motion/react";

interface ProductImage {
  id: string;
  image_url: string;
  alt_text: string | null;
  alt_text_bn: string | null;
  sort_order: number;
}

interface ProductDetail {
  id: string;
  title: string;
  title_bn: string | null;
  slug: string;
  description: string | null;
  description_bn: string | null;
  thumbnail_url: string | null;
  price: number;
  compare_price: number | null;
  currency: string;
  is_free: boolean;
  is_active: boolean;
  author: string | null;
  isbn: string | null;
  weight_grams: number | null;
  stock_quantity: number;
  sku: string | null;
  category_id: number | null;
  category_name: string | null;
  category_name_bn: string | null;
  images: ProductImage[];
  created_at: string;
  updated_at: string;
}

interface AttachedExam {
  id: string;
  exam_id: string;
  title: string;
  title_bn: string | null;
  slug: string;
  thumbnail_url: string | null;
  price: number;
  is_free: boolean;
  exam_type: string;
  total_sections: number;
  total_questions: number;
  time_limit_seconds: number | null;
}

interface SimilarProduct {
  id: string;
  title: string;
  title_bn: string | null;
  slug: string;
  thumbnail_url: string | null;
  price: number;
  compare_price: number | null;
  is_free: boolean;
  images: ProductImage[];
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useLocaleStore();
  const { addItem } = useCartStore();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [attachedExams, setAttachedExams] = useState<AttachedExam[]>([]);
  const [similarProducts, setSimilarProducts] = useState<SimilarProduct[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const data: any = await api.get(`/physical-items/${params.slug}`);
        setProduct(data);

        // Load attached exams
        if (data?.id) {
          try {
            const exams: any = await api.get(`/exams/product/${data.id}/attached`);
            setAttachedExams(Array.isArray(exams) ? exams : []);
          } catch { setAttachedExams([]); }
        }

        // Load similar products (same category or just other products)
        try {
          const similar: any = await api.get(`/physical-items/?page_size=4`);
          const items = Array.isArray(similar) ? similar : (similar.items || []);
          setSimilarProducts(items.filter((p: any) => p.slug !== data.slug).slice(0, 4));
        } catch { setSimilarProducts([]); }
      } catch {
        router.push("/shop");
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

  if (!product) return null;

  const allImages = product.images.length > 0
    ? product.images
    : product.thumbnail_url
      ? [{ id: "thumb", image_url: product.thumbnail_url, alt_text: product.title, alt_text_bn: product.title_bn, sort_order: 0 }]
      : [];

  const currentImage = allImages[selectedImage]?.image_url;
  const outOfStock = product.stock_quantity <= 0;
  const lowStock = product.stock_quantity > 0 && product.stock_quantity <= 5;
  const discount = product.compare_price && product.compare_price > product.price
    ? Math.round((1 - product.price / product.compare_price) * 100)
    : 0;

  const handleAddToCart = () => {
    addItem(
      {
        productId: product.id,
        productType: "physical_book",
        title: product.title,
        title_bn: product.title_bn,
        thumbnail_url: allImages[0]?.image_url || product.thumbnail_url,
        price: product.price,
        compare_price: product.compare_price,
        maxQuantity: product.stock_quantity,
        slug: product.slug,
      },
      quantity,
    );
    // Auto-add attached exams as bundled items
    attachedExams.forEach((exam) => {
      addItem({
        productId: exam.exam_id,
        productType: "exam",
        title: exam.title,
        title_bn: exam.title_bn,
        thumbnail_url: exam.thumbnail_url,
        price: exam.is_free ? 0 : exam.price,
        compare_price: null,
        maxQuantity: 1,
        slug: exam.slug,
        attachedTo: product.id,
      });
    });
    setAdded(true);
    toast.success(t("কার্টে যোগ হয়েছে", "Added to cart"));
    setTimeout(() => setAdded(false), 2000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const rem = mins % 60;
      return rem > 0 ? `${hrs} ${t("ঘণ্টা", "hr")} ${rem} ${t("মিনিট", "min")}` : `${hrs} ${t("ঘণ্টা", "hr")}`;
    }
    return `${mins} ${t("মিনিট", "min")}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 w-full">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <Link href="/shop" className="hover:text-primary-600 transition-colors font-bn">
            {t("শপ", "Shop")}
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          {product.category_name && (
            <>
              <span className="font-bn">{t(product.category_name_bn || product.category_name, product.category_name)}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </>
          )}
          <span className="text-gray-700 font-bn truncate max-w-[200px]">
            {t(product.title_bn || product.title, product.title)}
          </span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14">
          {/* ===== LEFT: Image Gallery ===== */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            {/* Main Image */}
            <motion.div
              className="aspect-square rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm relative"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {discount > 0 && (
                <div className="absolute top-4 left-4 z-10 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                  -{discount}%
                </div>
              )}
              {currentImage ? (
                <img
                  src={currentImage}
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-violet-50 to-purple-100 flex items-center justify-center">
                  <Package className="w-24 h-24 text-purple-300" />
                </div>
              )}
            </motion.div>

            {/* Thumbnail strip */}
            {allImages.length > 1 && (
              <div className="flex gap-3 mt-4 overflow-x-auto hide-scrollbar">
                {allImages.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(idx)}
                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all ${
                      selectedImage === idx
                        ? "border-primary-600 shadow-md ring-2 ring-primary-200"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ===== RIGHT: Product Info ===== */}
          <div>
            {/* Badge + Title */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              {product.category_name && (
                <span className="inline-block px-3 py-1 bg-primary-50 text-primary-700 text-[11px] font-bold uppercase tracking-wider rounded-full mb-3 font-bn">
                  {t(product.category_name_bn || product.category_name, product.category_name)}
                </span>
              )}
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 font-bn leading-tight">
                {t(product.title_bn || product.title, product.title)}
              </h1>
              {product.author && (
                <p className="mt-2 text-gray-500 font-bn text-base">
                  {t("লেখক", "by")} <span className="font-semibold text-gray-700">{product.author}</span>
                </p>
              )}
            </motion.div>

            {/* Price Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="mt-6 p-5 sm:p-6 rounded-2xl bg-white border border-gray-100 shadow-sm"
            >
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-4xl font-extrabold text-primary-700 font-bn">
                  {product.is_free ? t("ফ্রি", "Free") : `৳${product.price}`}
                </span>
                {product.compare_price && product.compare_price > product.price && (
                  <span className="text-xl text-gray-400 line-through font-bn">৳{product.compare_price}</span>
                )}
                {discount > 0 && (
                  <span className="bg-red-50 text-red-600 text-sm font-bold px-3 py-1 rounded-full border border-red-100">
                    {discount}% {t("ছাড়", "OFF")}
                  </span>
                )}
              </div>

              {/* Stock Status */}
              <div className="mt-3">
                {outOfStock ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-red-600 font-semibold font-bn bg-red-50 px-3 py-1 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    {t("স্টক আউট", "Out of Stock")}
                  </span>
                ) : lowStock ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-amber-600 font-semibold font-bn bg-amber-50 px-3 py-1 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    {t(`মাত্র ${product.stock_quantity}টি বাকি!`, `Only ${product.stock_quantity} left!`)}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 font-semibold font-bn bg-emerald-50 px-3 py-1 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    {t("স্টকে আছে", "In Stock")}
                  </span>
                )}
              </div>

              {/* Quantity + Add to Cart */}
              {!outOfStock && (
                <>
                  <div className="mt-5 flex items-center gap-3">
                    <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="px-3 py-3 hover:bg-gray-100 transition-colors"
                      >
                        <Minus className="w-4 h-4 text-gray-500" />
                      </button>
                      <span className="px-5 py-3 text-sm font-bold text-gray-900 min-w-[48px] text-center bg-white border-x border-gray-200">
                        {quantity}
                      </span>
                      <button
                        onClick={() => setQuantity(Math.min(product.stock_quantity, quantity + 1))}
                        className="px-3 py-3 hover:bg-gray-100 transition-colors"
                      >
                        <Plus className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                    <motion.button
                      onClick={handleAddToCart}
                      whileTap={{ scale: 0.95 }}
                      className={`flex-1 flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl text-sm font-bold transition-all shadow-md ${
                        added
                          ? "bg-emerald-500 text-white shadow-emerald-200"
                          : "bg-primary-700 text-white hover:bg-primary-800 shadow-primary-200 hover:shadow-lg"
                      }`}
                    >
                      {added ? (
                        <>
                          <Check className="w-5 h-5" />
                          {t("কার্টে যোগ হয়েছে", "Added to Cart")}
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="w-5 h-5" />
                          {t("কার্টে যোগ করুন", "Add to Cart")}
                        </>
                      )}
                    </motion.button>
                  </div>

                  {/* Buy Now */}
                  <motion.button
                    onClick={() => {
                      handleAddToCart();
                      router.push("/checkout?source=cart");
                    }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 mt-3 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-400 to-amber-500 text-blue-900 shadow-md shadow-amber-200 hover:from-amber-300 hover:to-amber-400 hover:shadow-lg transition-all"
                  >
                    <Zap className="w-5 h-5" />
                    {t("এখনই কিনুন", "Buy Now")}
                  </motion.button>
                </>
              )}
            </motion.div>

            {/* Trust Badges */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="mt-4 grid grid-cols-3 gap-3"
            >
              {[
                { icon: Truck, label: t("দ্রুত ডেলিভারি", "Fast Delivery"), color: "text-blue-600 bg-blue-50" },
                { icon: ShieldCheck, label: t("নিরাপদ পেমেন্ট", "Secure Payment"), color: "text-emerald-600 bg-emerald-50" },
                { icon: Star, label: t("মানসম্মত বই", "Quality Books"), color: "text-amber-600 bg-amber-50" },
              ].map((badge) => (
                <div key={badge.label} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white border border-gray-100">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${badge.color}`}>
                    <badge.icon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-semibold text-gray-600 font-bn text-center leading-tight">
                    {badge.label}
                  </span>
                </div>
              ))}
            </motion.div>

            {/* Product Details Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25 }}
              className="mt-6 p-5 sm:p-6 rounded-2xl bg-white border border-gray-100 shadow-sm"
            >
              <h3 className="text-base font-bold text-gray-900 mb-4 font-bn flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary-600" />
                {t("বিস্তারিত তথ্য", "Product Details")}
              </h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {product.author && (
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-xs text-gray-400 font-bn">{t("লেখক", "Author")}</span>
                    <p className="text-sm font-semibold text-gray-800 font-bn">{product.author}</p>
                  </div>
                )}
                {product.category_name && (
                  <div>
                    <span className="text-xs text-gray-400 font-bn">{t("ক্যাটাগরি", "Category")}</span>
                    <p className="text-sm font-semibold text-gray-800 font-bn">
                      {t(product.category_name_bn || product.category_name, product.category_name)}
                    </p>
                  </div>
                )}
                {product.weight_grams && (
                  <div>
                    <span className="text-xs text-gray-400 font-bn">{t("ওজন", "Weight")}</span>
                    <p className="text-sm font-semibold text-gray-800">{product.weight_grams}g</p>
                  </div>
                )}
                {product.isbn && (
                  <div>
                    <span className="text-xs text-gray-400">ISBN</span>
                    <p className="text-sm font-semibold text-gray-800">{product.isbn}</p>
                  </div>
                )}
                {product.sku && (
                  <div>
                    <span className="text-xs text-gray-400">SKU</span>
                    <p className="text-sm font-semibold text-gray-800">{product.sku}</p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Description */}
            {(product.description || product.description_bn) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="mt-6 p-5 sm:p-6 rounded-2xl bg-white border border-gray-100 shadow-sm"
              >
                <h3 className="text-base font-bold text-gray-900 mb-3 font-bn">
                  {t("বিবরণ", "Description")}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed font-bn whitespace-pre-line">
                  {t(product.description_bn || product.description || "", product.description || "")}
                </p>
              </motion.div>
            )}
          </div>
        </div>

        {/* ===== CONNECTED EXAMS SECTION ===== */}
        {attachedExams.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-12 sm:mt-16"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-200">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 font-bn">
                  {t("এই বইয়ের সাথে পরীক্ষা দিন", "Take Exams With This Book")}
                </h2>
                <p className="text-sm text-gray-500 font-bn">
                  {t("বই পড়ে শেষ করে অনলাইনে পরীক্ষা দিয়ে নিজেকে যাচাই করুন", "Test your knowledge through online exams after reading")}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {attachedExams.map((exam) => (
                <Link key={exam.id} href={`/exams/${exam.slug}`} className="block group">
                  <div className="relative bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-lg hover:shadow-blue-100/50 transition-all hover:-translate-y-1">
                    {/* Exam Header gradient */}
                    <div className="relative h-28 bg-gradient-to-br from-[#0f2b4a] via-[#1a3f6f] to-[#2563eb] p-4 flex flex-col justify-end overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                      <div className="absolute bottom-2 right-3 opacity-10">
                        <GraduationCap className="w-16 h-16 text-white" />
                      </div>
                      <div className="relative z-10">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold mb-1.5 ${
                          exam.exam_type === "scheduled"
                            ? "bg-orange-500/20 text-orange-200"
                            : "bg-blue-400/20 text-blue-200"
                        }`}>
                          {exam.exam_type === "scheduled" ? t("নির্ধারিত", "Scheduled") : t("অনলাইন", "Anytime")}
                        </span>
                        <h3 className="text-white font-bold font-bn text-base leading-snug line-clamp-1">
                          {t(exam.title_bn || exam.title, exam.title)}
                        </h3>
                      </div>
                    </div>

                    {/* Exam Meta */}
                    <div className="p-4">
                      <div className="flex flex-wrap gap-2 text-[12px] font-semibold text-gray-600 font-bn">
                        <div className="flex items-center gap-1 bg-gray-50 px-2.5 py-1.5 rounded-lg">
                          <Layers className="w-3.5 h-3.5 text-primary-600" />
                          {exam.total_sections} {t("সেকশন", "Sections")}
                        </div>
                        <div className="flex items-center gap-1 bg-gray-50 px-2.5 py-1.5 rounded-lg">
                          <FileText className="w-3.5 h-3.5 text-primary-600" />
                          {exam.total_questions} {t("প্রশ্ন", "Questions")}
                        </div>
                        {exam.time_limit_seconds && (
                          <div className="flex items-center gap-1 bg-gray-50 px-2.5 py-1.5 rounded-lg">
                            <Clock className="w-3.5 h-3.5 text-primary-600" />
                            {formatTime(exam.time_limit_seconds)}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-4">
                        <span className="text-lg font-bold text-primary-700 font-bn">
                          {exam.is_free ? t("ফ্রি", "Free") : `৳${exam.price}`}
                        </span>
                        <span className="flex items-center gap-1 text-sm font-bold text-primary-700 group-hover:text-primary-800 font-bn">
                          {t("পরীক্ষা দিন", "Take Exam")}
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </motion.section>
        )}

        {/* ===== SIMILAR PRODUCTS ===== */}
        {similarProducts.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-12 sm:mt-16 pb-8"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 font-bn">
                {t("একই ধরনের আরো বই", "Similar Products")}
              </h2>
              <Link
                href="/shop"
                className="flex items-center gap-1 text-sm font-bold text-primary-700 hover:text-primary-800 font-bn"
              >
                {t("সব দেখুন", "View All")}
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {similarProducts.map((item) => {
                const itemImage = item.images?.[0]?.image_url || item.thumbnail_url;
                const itemDiscount = item.compare_price && item.compare_price > item.price
                  ? Math.round((1 - item.price / item.compare_price) * 100)
                  : 0;
                return (
                  <Link key={item.id} href={`/shop/${item.slug}`} className="block group">
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-lg hover:shadow-primary-100/40 transition-all hover:-translate-y-1">
                      <div className="relative aspect-square bg-gray-50">
                        {itemImage ? (
                          <img src={itemImage} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-50 to-purple-100">
                            <Package className="w-12 h-12 text-purple-300" />
                          </div>
                        )}
                        {itemDiscount > 0 && (
                          <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            -{itemDiscount}%
                          </span>
                        )}
                      </div>
                      <div className="p-3 sm:p-4">
                        <h3 className="text-sm font-bold text-gray-900 font-bn line-clamp-2 group-hover:text-primary-700 transition-colors leading-snug mb-2">
                          {t(item.title_bn || item.title, item.title)}
                        </h3>
                        <div className="flex items-baseline gap-2">
                          <span className="text-base font-extrabold text-primary-700 font-bn">
                            {item.is_free ? t("ফ্রি", "Free") : `৳${item.price}`}
                          </span>
                          {item.compare_price && item.compare_price > item.price && (
                            <span className="text-xs text-gray-400 line-through">৳{item.compare_price}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </motion.section>
        )}
      </div>

      <Footer />
    </div>
  );
}
