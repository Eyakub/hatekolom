"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Package, Search, Loader2, ShoppingCart, Check, ArrowRight,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { api } from "@/lib/api";
import { useLocaleStore } from "@/stores/locale-store";
import { useCartStore } from "@/stores/cart-store";
import { toast } from "@/stores/toast-store";

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

interface CategoryItem {
  id: number;
  name: string;
  name_bn: string | null;
  slug: string;
}

export default function ShopPage() {
  const { t } = useLocaleStore();
  const { addItem } = useCartStore();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      try {
        const [itemsData, catsData]: any = await Promise.all([
          api.get("/physical-items/"),
          api.get("/categories/?type=shop"),
        ]);
        setItems(Array.isArray(itemsData) ? itemsData : []);
        setCategories(Array.isArray(catsData) ? catsData : []);
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const filtered = items.filter((item) => {
    if (selectedCategory && item.category_name) {
      const cat = categories.find((c) => c.id === selectedCategory);
      if (cat && item.category_name !== cat.name && item.category_name_bn !== cat.name_bn) {
        return false;
      }
    }
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.title_bn?.toLowerCase().includes(q)
    );
  });

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

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50">
      <Navbar />

      {/* Hero */}
      <div className="bg-gradient-to-br from-violet-700 via-purple-800 to-indigo-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold font-bn mb-3">
            {t("🛍️ শপ", "🛍️ Shop")}
          </h1>
          <p className="text-white/70 font-bn text-lg mb-6">
            {t("বই, স্টেশনারি ও শিক্ষা উপকরণ", "Books, Stationery & Learning Materials")}
          </p>
          <div className="max-w-md mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("প্রোডাক্ট খোঁজো...", "Search products...")}
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-white text-gray-900 text-sm outline-none shadow-lg font-bn"
            />
          </div>
        </div>
      </div>

      {/* Category filters */}
      {categories.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors font-bn ${
                !selectedCategory
                  ? "bg-primary-700 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {t("সব", "All")}
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
                className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors font-bn ${
                  selectedCategory === cat.id
                    ? "bg-primary-700 text-white"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                {t(cat.name_bn || cat.name, cat.name)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <Package className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-400 font-bn">
              {search ? t("কোনো প্রোডাক্ট পাওয়া যায়নি", "No products found") : t("এখনো কোনো প্রোডাক্ট নেই", "No products yet")}
            </h3>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filtered.map((item) => {
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
                        <div className="w-full h-full bg-gradient-to-br from-violet-100 to-purple-200 flex items-center justify-center">
                          <Package className="w-16 h-16 text-purple-300" />
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
                        <h3 className="font-bold text-sm sm:text-base text-gray-900 line-clamp-2 leading-snug flex-1 font-bn group-hover:text-primary-700 transition-colors">
                          {t(item.title_bn || item.title, item.title)}
                        </h3>
                        <span className={`text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap flex-shrink-0 ${
                          item.is_free ? "bg-emerald-50 text-emerald-600" : "bg-primary-50 text-primary-700"
                        }`}>
                          {item.is_free ? t("ফ্রি", "Free") : `৳${item.price}`}
                        </span>
                      </div>

                      {item.category_name && (
                        <span className="text-[10px] text-gray-400 font-medium font-bn mb-2">
                          {t(item.category_name_bn || item.category_name, item.category_name)}
                        </span>
                      )}

                      {item.author && (
                        <span className="text-[11px] text-gray-500 font-bn mb-1.5 line-clamp-1 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
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
                                : "bg-primary-600 text-white hover:bg-primary-700"
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
      </div>

      <Footer />
    </div>
  );
}
