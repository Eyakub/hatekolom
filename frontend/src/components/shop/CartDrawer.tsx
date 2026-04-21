"use client";

import { useRouter } from "next/navigation";
import { X, Minus, Plus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { useCartStore } from "@/stores/cart-store";
import { useLocaleStore } from "@/stores/locale-store";
import { motion, AnimatePresence } from "motion/react";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function CartDrawer({ open, onClose }: CartDrawerProps) {
  const router = useRouter();
  const { t } = useLocaleStore();
  const { items, removeItem, updateQuantity, totalPrice, totalItems } = useCartStore();

  const handleCheckout = () => {
    onClose();
    router.push("/checkout?source=cart");
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case "physical_book": return t("প্রোডাক্ট", "Product");
      case "ebook": return t("ই-বুক", "Ebook");
      case "course": return t("কোর্স", "Course");
      default: return type;
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-0 right-0 z-50 h-full w-[360px] max-w-[90vw] bg-white shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 h-16 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-primary-700" />
                <span className="text-lg font-bold text-gray-900 font-bn">
                  {t("কার্ট", "Cart")}
                </span>
                {totalItems() > 0 && (
                  <span className="bg-primary-100 text-primary-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {totalItems()}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <ShoppingBag className="w-16 h-16 text-gray-200 mb-4" />
                  <p className="text-gray-400 font-bn font-semibold">
                    {t("কার্ট খালি", "Cart is empty")}
                  </p>
                  <button
                    onClick={() => { onClose(); router.push("/shop"); }}
                    className="mt-4 text-sm text-primary-600 font-semibold hover:underline font-bn"
                  >
                    {t("শপে যান", "Go to Shop")}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => (
                    <div key={item.productId} className="flex gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                      {/* Thumbnail */}
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                        {item.thumbnail_url ? (
                          <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ShoppingBag className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate font-bn">
                          {t(item.title_bn || item.title, item.title)}
                        </p>
                        <span className="text-[10px] font-medium text-gray-400 uppercase">
                          {typeLabel(item.productType)}
                        </span>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
                            <button
                              onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                              className="px-2 py-1 hover:bg-gray-50 transition-colors"
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="w-3 h-3 text-gray-500" />
                            </button>
                            <span className="px-2 py-1 text-xs font-bold text-gray-900 min-w-[24px] text-center">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                              className="px-2 py-1 hover:bg-gray-50 transition-colors"
                              disabled={item.quantity >= item.maxQuantity}
                            >
                              <Plus className="w-3 h-3 text-gray-500" />
                            </button>
                          </div>
                          <span className="text-sm font-bold text-primary-700">
                            ৳{(item.price * item.quantity).toFixed(0)}
                          </span>
                        </div>
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() => removeItem(item.productId)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors self-start"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t border-gray-100 px-5 py-4 space-y-3 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-600 font-bn">
                    {t("সাবটোটাল", "Subtotal")}
                  </span>
                  <span className="text-xl font-bold text-gray-900">
                    ৳{totalPrice().toFixed(0)}
                  </span>
                </div>
                <button
                  onClick={handleCheckout}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-700 text-white rounded-xl text-sm font-bold hover:bg-primary-800 transition-all font-bn"
                >
                  {t("চেকআউট করুন", "Checkout")}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
