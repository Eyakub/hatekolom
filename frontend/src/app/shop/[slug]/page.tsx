"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Package, Loader2, ShoppingCart, Check, Minus, Plus,
  ChevronLeft, Weight, Barcode, User,
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

  useEffect(() => {
    const load = async () => {
      try {
        const data: any = await api.get(`/physical-items/${params.slug}`);
        setProduct(data);
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
    setAdded(true);
    toast.success(t("কার্টে যোগ হয়েছে", "Added to cart"));
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Back */}
        <button
          onClick={() => router.push("/shop")}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary-700 mb-6 font-bn"
        >
          <ChevronLeft className="w-4 h-4" />
          {t("শপে ফিরে যান", "Back to Shop")}
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Image Gallery */}
          <div>
            <motion.div
              className="aspect-square rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm"
              whileHover={{ scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              {currentImage ? (
                <img
                  src={currentImage}
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-violet-100 to-purple-200 flex items-center justify-center">
                  <Package className="w-24 h-24 text-purple-300" />
                </div>
              )}
            </motion.div>

            {/* Thumbnail strip */}
            {allImages.length > 1 && (
              <div className="flex gap-2 mt-4 overflow-x-auto hide-scrollbar">
                {allImages.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(idx)}
                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all ${
                      selectedImage === idx ? "border-primary-600 shadow-md" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div>
            {product.category_name && (
              <span className="text-xs text-primary-600 font-semibold uppercase tracking-wider font-bn">
                {t(product.category_name_bn || product.category_name, product.category_name)}
              </span>
            )}
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1 font-bn">
              {t(product.title_bn || product.title, product.title)}
            </h1>
            {product.title_bn && product.title !== product.title_bn && (
              <p className="text-sm text-gray-400 mt-1">{product.title}</p>
            )}

            {/* Price */}
            <div className="mt-4 p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-primary-700">
                  {product.is_free ? t("ফ্রি", "Free") : `৳${product.price}`}
                </span>
                {product.compare_price && product.compare_price > product.price && (
                  <>
                    <span className="text-lg text-gray-400 line-through">৳{product.compare_price}</span>
                    <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
                      {discount}% OFF
                    </span>
                  </>
                )}
              </div>

              {/* Stock */}
              <div className="mt-3">
                {outOfStock ? (
                  <span className="text-sm text-red-600 font-semibold font-bn">
                    {t("স্টক আউট", "Out of Stock")}
                  </span>
                ) : lowStock ? (
                  <span className="text-sm text-amber-600 font-semibold font-bn">
                    {t(`মাত্র ${product.stock_quantity}টি বাকি!`, `Only ${product.stock_quantity} left!`)}
                  </span>
                ) : (
                  <span className="text-sm text-emerald-600 font-semibold font-bn">
                    {t("স্টকে আছে", "In Stock")}
                  </span>
                )}
              </div>

              {/* Quantity + Add to Cart */}
              {!outOfStock && (
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="px-3 py-2.5 hover:bg-gray-50 transition-colors"
                    >
                      <Minus className="w-4 h-4 text-gray-500" />
                    </button>
                    <span className="px-4 py-2.5 text-sm font-bold text-gray-900 min-w-[40px] text-center">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity(Math.min(product.stock_quantity, quantity + 1))}
                      className="px-3 py-2.5 hover:bg-gray-50 transition-colors"
                    >
                      <Plus className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                  <button
                    onClick={handleAddToCart}
                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${
                      added
                        ? "bg-emerald-500 text-white"
                        : "bg-primary-700 text-white hover:bg-primary-800"
                    }`}
                  >
                    {added ? (
                      <>
                        <Check className="w-4 h-4" />
                        {t("কার্টে যোগ হয়েছে", "Added to Cart")}
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-4 h-4" />
                        {t("কার্টে যোগ করুন", "Add to Cart")}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Meta info */}
            <div className="mt-6 space-y-3">
              {product.author && (
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="font-bn">{t("লেখক", "Author")}: <strong>{product.author}</strong></span>
                </div>
              )}
              {product.weight_grams && (
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Weight className="w-4 h-4 text-gray-400" />
                  <span className="font-bn">{t("ওজন", "Weight")}: <strong>{product.weight_grams}g</strong></span>
                </div>
              )}
              {product.isbn && (
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Barcode className="w-4 h-4 text-gray-400" />
                  <span>ISBN: <strong>{product.isbn}</strong></span>
                </div>
              )}
            </div>

            {/* Description */}
            {(product.description || product.description_bn) && (
              <div className="mt-6">
                <h3 className="text-sm font-bold text-gray-900 mb-2 font-bn">
                  {t("বিবরণ", "Description")}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed font-bn whitespace-pre-line">
                  {t(product.description_bn || product.description || "", product.description || "")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
