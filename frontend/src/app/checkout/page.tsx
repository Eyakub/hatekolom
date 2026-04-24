"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShoppingCart, CheckCircle2,
  Loader2, ArrowLeft, Package, Tag, Smartphone, Wallet, Monitor,
  Shield, Landmark, LogIn, Phone, AlertCircle, Truck, Lock,
  MapPin, Clock, Gift, Sparkles, ChevronDown, ChevronUp, Minus, Plus, Trash2,
  GraduationCap, X,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuthStore } from "@/stores/auth-store";
import { useCartStore } from "@/stores/cart-store";
import { useLocaleStore } from "@/stores/locale-store";
import { api } from "@/lib/api";
import { motion, AnimatePresence } from "motion/react";
import { generateFingerprint } from "@/lib/fingerprint";
import { useSiteStore } from "@/stores/site-store";

// Child avatar emojis for playful selection
const childAvatars = ["🧒", "👧", "👦", "🧒🏽", "👧🏽", "👦🏽", "🧒🏻", "👧🏻"];

function CheckoutContent() {
  const searchParams = useSearchParams();
  const productId = searchParams?.get("product");
  const productType = searchParams?.get("type");
  const source = searchParams?.get("source");
  const isCartCheckout = source === "cart";
  const router = useRouter();
  const { isAuthenticated, accessToken, user, _hasHydrated } = useAuthStore();
  const cartStore = useCartStore();
  const { t } = useLocaleStore();

  const [product, setProduct] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderResult, setOrderResult] = useState<any>(null);

  const [form, setForm] = useState({
    shipping_name: "",
    shipping_phone: "",
    shipping_address: "",
    shipping_area: "",
    shipping_city: "Dhaka",
    shipping_zone: "inside_dhaka",
    notes: "",
  });
  const [selectedChildIds, setSelectedChildIds] = useState<Set<string>>(new Set());
  const [showNotes, setShowNotes] = useState(false);
  const [guestMode, setGuestMode] = useState(false);
  const [ipInfo, setIpInfo] = useState<any>(null);
  const [fingerprint, setFingerprint] = useState<any>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Cart state
  const cartItems = isCartCheckout ? cartStore.items : [];
  const cartHasPhysical = isCartCheckout ? cartStore.hasPhysicalItem() : false;
  const cartIsAllPhysical = isCartCheckout ? cartStore.isAllPhysical() : false;
  const canGuestCheckout = isCartCheckout && cartIsAllPhysical && !isAuthenticated;

  // Load product data for single-product checkout
  useEffect(() => {
    if (!mounted || !_hasHydrated) return;
    if (isCartCheckout) {
      if (cartItems.length === 0) { router.push("/shop"); return; }
      setLoading(false);
      return;
    }
    if (!productId) { router.push("/shop"); return; }
    const loadProduct = async () => {
      try {
        if (productType === "ebook") {
          const ebooks: any = await api.get("/ebooks/");
          const found = (Array.isArray(ebooks) ? ebooks : []).find((e: any) => e.id === productId);
          if (found) setProduct({ id: found.id, title: found.title, title_bn: found.title_bn, thumbnail_url: found.thumbnail_url, price: found.price, is_free: found.is_free, compare_price: found.compare_price });
        } else if (productType === "exam") {
          const exams: any = await api.get("/exams/");
          const list = Array.isArray(exams) ? exams : [];
          const found = list.find((e: any) => e.product_id === productId || e.product?.id === productId || e.id === productId);
          if (found) {
            const p = found.product || found;
            setProduct({ id: p.id || found.product_id || productId, title: p.title || found.title, title_bn: p.title_bn || found.title_bn, thumbnail_url: p.thumbnail_url || found.thumbnail_url || null, price: p.price ?? found.price, is_free: p.is_free ?? found.is_free, compare_price: p.compare_price ?? found.compare_price });
          }
        } else {
          const courses: any = await api.get("/courses/");
          const found = courses?.courses
            ? courses.courses.find((c: any) => c.product?.id === productId)
            : (Array.isArray(courses) ? courses : []).find((c: any) => c.product?.id === productId);
          if (found) setProduct({ ...found.product, thumbnail_url: found.product?.thumbnail_url || found.thumbnail_url || null });
        }
      } catch {}
      setLoading(false);
    };
    loadProduct();
  }, [mounted, _hasHydrated, productId, productType, router, isCartCheckout]);

  // Load children
  useEffect(() => {
    if (!mounted || !_hasHydrated || !isAuthenticated || !accessToken) return;
    const loadChildren = async () => {
      try {
        const kids: any = await api.get("/children/", accessToken);
        setChildren(kids || []);
        if (kids?.length > 0) setSelectedChildIds(new Set(kids.map((k: any) => k.id)));
      } catch {}
    };
    loadChildren();
    if (user?.phone) setForm((prev) => ({ ...prev, shipping_phone: user.phone || "" }));
    if (user?.full_name) setForm((prev) => ({ ...prev, shipping_name: user.full_name || "" }));
  }, [mounted, _hasHydrated, isAuthenticated, accessToken, user]);

  // Guest checkout: prefetch IP info and generate fingerprint
  useEffect(() => {
    if (!mounted || !_hasHydrated || !canGuestCheckout) return;
    setGuestMode(true);
    api.get("/orders/ip-check").then((res: any) => setIpInfo(res)).catch(() => {});
    setFingerprint(generateFingerprint());
  }, [mounted, _hasHydrated, canGuestCheckout]);

  const _initFlags = useSiteStore.getState().settings.feature_flags || {};
  const _defaultPay = _initFlags.payment_cod !== false ? "cod" : _initFlags.payment_bkash !== false ? "bkash" : "mock_success";
  const [paymentMethod, setPaymentMethod] = useState(_defaultPay);
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState("0");
  const [couponMessage, setCouponMessage] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponValid, setCouponValid] = useState(false);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    if (!isAuthenticated || !accessToken) { redirectToLogin(); return; }
    setCouponLoading(true);
    try {
      const res: any = await api.post("/coupons/apply", { code: couponCode.toUpperCase(), subtotal }, accessToken!);
      setCouponMessage(res.message); setCouponValid(res.valid); setCouponDiscount(res.valid ? res.discount : "0");
    } catch {
      setCouponMessage("Invalid coupon"); setCouponValid(false); setCouponDiscount("0");
    }
    setCouponLoading(false);
  };

  const redirectToLogin = () => {
    const url = isCartCheckout ? "/checkout?source=cart" : `/checkout?product=${productId}${productType ? `&type=${productType}` : ""}`;
    router.push(`/login?redirect=${encodeURIComponent(url)}`);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    // Guest checkout flow
    if (guestMode && canGuestCheckout) {
      setSubmitting(true);
      try {
        const guestData: any = {
          phone: form.shipping_phone,
          name: form.shipping_name,
          address: form.shipping_address,
          area: form.shipping_area || undefined,
          city: form.shipping_city,
          zone: form.shipping_zone,
          postal: undefined,
          notes: form.notes || undefined,
          items: cartItems.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
          payment_method: paymentMethod,
          device_fingerprint: fingerprint || undefined,
          ip_info: ipInfo || undefined,
        };
        const result: any = await api.post("/orders/guest", guestData);
        if (result.gateway_url) { window.location.href = result.gateway_url; return; }
        cartStore.clearCart();
        setOrderResult(result); setSuccess(true);
      } catch (err: any) {
        const msg = err.message || "";
        const status = err.status || err.statusCode || 0;
        let userMsg = msg;
        if (status === 429 || msg.includes("Too many") || msg.includes("already placed")) {
          // Rate limit — show the backend message directly
          userMsg = msg || t("অনেক বেশি অর্ডার হয়েছে। পরে আবার চেষ্টা করুন", "Too many orders. Please try again later.");
        } else if (msg.includes("address")) userMsg = t("সম্পূর্ণ ডেলিভারি ঠিকানা দিন", "Please enter a complete delivery address");
        else if (msg.includes("name")) userMsg = t("প্রাপকের নাম দিন", "Please enter the recipient name");
        else if (msg.includes("phone")) userMsg = t("সঠিক মোবাইল নম্বর দিন", "Please enter a valid mobile number");
        else if (msg.includes("physical")) userMsg = t("গেস্ট চেকআউট শুধু ফিজিক্যাল আইটেমের জন্য", "Guest checkout is only for physical items");
        else if (msg.includes("exceed")) userMsg = t("অর্ডারের পরিমাণ সীমা অতিক্রম করেছে", "Order amount exceeds limit");
        else if (!msg || msg === "Request failed") userMsg = t("অর্ডার তৈরিতে সমস্যা হয়েছে", "Failed to place order");
        import("@/stores/toast-store").then((m) => m.toast.error(userMsg));
      } finally { setSubmitting(false); }
      return;
    }

    // Authenticated checkout flow
    if (!isAuthenticated || !accessToken) { redirectToLogin(); return; }
    setSubmitting(true);
    try {
      const orderData: any = { payment_method: paymentMethod, notes: form.notes || undefined, coupon_code: couponValid ? couponCode.toUpperCase() : undefined };
      if (isCartCheckout) {
        orderData.items = cartItems.map((i) => ({ product_id: i.productId, quantity: i.quantity }));
        if (cartStore.totalPrice() === 0) orderData.payment_method = "free";
      } else {
        if (!productId) return;
        orderData.items = [{ product_id: productId, quantity: 1 }];
        if (product?.is_free) orderData.payment_method = "free";
      }
      // Always send shipping/contact info
      orderData.shipping = { shipping_name: form.shipping_name, shipping_phone: form.shipping_phone, shipping_address: form.shipping_address, shipping_area: form.shipping_area, shipping_city: form.shipping_city, shipping_zone: form.shipping_zone, shipping_postal: "" };
      if (form.shipping_name) orderData.contact_name = form.shipping_name;
      if (form.shipping_phone) orderData.contact_phone = form.shipping_phone;
      const selectedIds = Array.from(selectedChildIds);
      if (selectedIds.length > 1) orderData.child_profile_ids = selectedIds;
      else if (selectedIds.length === 1) orderData.child_profile_id = selectedIds[0];

      const result: any = await api.post("/orders/", orderData, accessToken);
      if (result.gateway_url) { window.location.href = result.gateway_url; return; }
      if (isCartCheckout) cartStore.clearCart();
      setOrderResult(result); setSuccess(true);
    } catch (err: any) {
      const msg = err.message || "";
      let userMsg = msg;
      if (msg.includes("shipping_address")) userMsg = t("সম্পূর্ণ ডেলিভারি ঠিকানা দিন", "Please enter a complete delivery address");
      else if (msg.includes("shipping_name")) userMsg = t("প্রাপকের নাম দিন", "Please enter the recipient name");
      else if (msg.includes("shipping_phone")) userMsg = t("সঠিক মোবাইল নম্বর দিন", "Please enter a valid mobile number");
      else if (!msg || msg === "Request failed") userMsg = t("অর্ডার তৈরিতে সমস্যা হয়েছে", "Failed to place order");
      import("@/stores/toast-store").then((m) => m.toast.error(userMsg));
    } finally { setSubmitting(false); }
  };

  // Pricing
  const subtotal = isCartCheckout ? cartStore.totalPrice() : parseFloat(product?.price || "0");
  const discount = parseFloat(couponDiscount || "0");
  const singleSavings = !isCartCheckout && product?.compare_price ? product.compare_price - subtotal : 0;
  const shippingFee = (isCartCheckout && cartHasPhysical) || guestMode ? (form.shipping_zone === "outside_dhaka" ? 120 : 60) : 0;
  const total = Math.max(0, subtotal - discount + shippingFee);
  const isFree = isCartCheckout ? cartStore.totalPrice() === 0 : product?.is_free;

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50/50">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  // ─── BLOCK ADMIN USERS ──────────────────────────────
  const isAdmin = isAuthenticated && user?.roles?.some((r: string) => ["super_admin", "admin"].includes(r));
  if (isAdmin) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50/50">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-5">
              <Shield className="w-10 h-10 text-red-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 font-bn mb-2">
              {t("অ্যাডমিন অ্যাকাউন্ট দিয়ে অর্ডার করা যাবে না", "Admin accounts cannot place orders")}
            </h1>
            <p className="text-sm text-gray-500 font-bn mb-6">
              {t("অর্ডার করতে একটি সাধারণ ইউজার অ্যাকাউন্ট ব্যবহার করুন। অ্যাডমিন প্যানেলে ফিরে যেতে নিচে ক্লিক করুন।", "Please use a regular user account to place orders. Click below to go back to the admin panel.")}
            </p>
            <div className="flex flex-col gap-3">
              <Link href="/admin" className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-primary-700 text-white font-bold rounded-xl hover:bg-primary-800 transition-all font-bn shadow-md">
                {t("অ্যাডমিন প্যানেলে যান", "Go to Admin Panel")}
              </Link>
              <Link href="/shop" className="text-sm text-primary-700 font-semibold hover:underline font-bn">
                {t("শপে ফিরে যান", "Back to Shop")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── SUCCESS STATE ──────────────────────────────
  if (success && orderResult) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-green-50 to-white">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", damping: 20 }}
            className="max-w-md w-full text-center"
          >
            {/* Celebration */}
            <div className="relative">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 12, delay: 0.2 }}
                className="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30"
              >
                <CheckCircle2 className="w-12 h-12 text-white" />
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="absolute top-0 left-1/2 -translate-x-1/2 text-4xl"
              >
                🎉
              </motion.div>
            </div>

            <h1 className="text-2xl font-bold font-bn text-gray-900 mb-2">
              {isCartCheckout ? t("অর্ডার সফল হয়েছে!", "Order Placed Successfully!") : productType === "ebook" ? t("ক্রয় সফল!", "Purchase Successful!") : productType === "exam" ? t("ভর্তি সফল!", "Enrollment Successful!") : t("ভর্তি সফল!", "Enrollment Successful!")}
            </h1>
            <p className="text-gray-500 font-bn mb-1">
              {t("অর্ডার নম্বর", "Order No")}: <span className="font-mono font-bold text-primary-700">{orderResult.order_number}</span>
            </p>

            {/* What happens next */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 mt-6 mb-6 text-left shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 font-bn mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" /> {t("এরপর কী হবে?", "What happens next?")}
              </h3>
              <div className="space-y-2.5">
                {cartHasPhysical && (
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5"><Truck className="w-3 h-3 text-violet-600" /></div>
                    <p className="text-xs text-gray-600 font-bn">{t("আপনার প্রোডাক্ট ৩-৫ কর্মদিবসের মধ্যে ডেলিভারি হবে", "Your product will be delivered within 3-5 business days")}</p>
                  </div>
                )}
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5"><Package className="w-3 h-3 text-blue-600" /></div>
                  <p className="text-xs text-gray-600 font-bn">{t("ড্যাশবোর্ডে গিয়ে অর্ডারের আপডেট দেখতে পারবেন", "You can track your order updates from the dashboard")}</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5"><Phone className="w-3 h-3 text-green-600" /></div>
                  <p className="text-xs text-gray-600 font-bn">{t("কোনো সমস্যা হলে কল করুন", "Need help? Call us")}: <strong>09610990880</strong></p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Link href="/dashboard/orders" className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-primary-700 text-white font-bold rounded-xl hover:bg-primary-800 transition-all font-bn shadow-md">
                {t("অর্ডার ট্র্যাক করো", "Track Order")}
              </Link>
              <Link href={isCartCheckout ? "/shop" : productType === "ebook" ? "/ebooks" : productType === "exam" ? "/exams" : "/shop"} className="text-sm text-primary-700 font-semibold hover:underline font-bn">
                {isCartCheckout ? t("আরও শপিং করো", "Continue Shopping") : productType === "exam" ? t("আরও পরীক্ষা দেখো", "Browse more exams") : t(`আরও ${productType === "ebook" ? "ই-বুক" : "কোর্স"} দেখো`, `Browse more ${productType === "ebook" ? "ebooks" : "courses"}`)}
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ─── PAYMENT METHODS (filtered by admin settings) ────────────────────────────
  const flags = useSiteStore.getState().settings.feature_flags || {};
  const allPaymentMethods = [
    { id: "bkash", flag: "payment_bkash", label: "bKash", icon: Smartphone, bg: "bg-gradient-to-br from-pink-500 to-pink-600", ring: "ring-pink-400" },
    { id: "nagad", flag: "payment_nagad", label: "Nagad", icon: Wallet, bg: "bg-gradient-to-br from-orange-500 to-orange-600", ring: "ring-orange-400" },
    { id: "cod", flag: "payment_cod", label: t("ক্যাশ অন ডেলিভারি", "Cash on Delivery"), icon: Truck, bg: "bg-gradient-to-br from-emerald-500 to-emerald-600", ring: "ring-emerald-400" },
    { id: "card", flag: "payment_card", label: "Card/Bank", icon: Landmark, bg: "bg-gradient-to-br from-slate-600 to-slate-700", ring: "ring-slate-400" },
    { id: "mock_success", flag: "payment_demo", label: "Demo", icon: Monitor, bg: "bg-gradient-to-br from-violet-500 to-violet-600", ring: "ring-violet-400" },
  ];
  const paymentMethods = allPaymentMethods.filter((m) => {
    if (flags[m.flag] === false) return false;
    // No COD for exam purchases (digital product)
    if (m.id === "cod") {
      if (!isCartCheckout && productType === "exam") return false;
      if (isCartCheckout && cartStore.items.some((i) => i.productType === "exam") && !cartHasPhysical) return false;
    }
    return true;
  });

  // Auto-select first available payment if current selection was filtered out (e.g. COD for exams)
  if (paymentMethods.length > 0 && !paymentMethods.find((m) => m.id === paymentMethod)) {
    // Use setTimeout to avoid setting state during render
    setTimeout(() => setPaymentMethod(paymentMethods[0].id), 0);
  }

  const backHref = isCartCheckout ? "/shop" : productType === "ebook" ? "/ebooks" : productType === "exam" ? "/exams" : "/shop";

  // ─── MAIN CHECKOUT UI ──────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50">
      <Navbar />

      <div className="flex-1 max-w-5xl mx-auto px-4 py-6 sm:py-8 w-full">
        {/* Header with back + title */}
        <div className="flex items-center gap-3 mb-6">
          <Link href={backHref} className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors shrink-0">
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900 font-bn">{t("চেকআউট", "Checkout")}</h1>
            <p className="text-xs text-gray-400 font-bn">
              {isCartCheckout ? t(`${cartItems.length}টি আইটেম`, `${cartItems.length} item${cartItems.length > 1 ? "s" : ""}`) : product?.title_bn || product?.title}
            </p>
          </div>
        </div>

        {/* Guest Quick Order banner */}
        {guestMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4 flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center shrink-0 text-2xl">🛒</div>
            <div className="flex-1">
              <p className="text-sm font-bold text-green-800 font-bn">{t("কুইক অর্ডার", "Quick Order")}</p>
              <p className="text-xs text-green-600 font-bn mt-0.5">{t("লগইন ছাড়াই অর্ডার করুন — শুধু নাম, ফোন ও ঠিকানা দিন", "Order without login — just name, phone & address")}</p>
            </div>
            <button onClick={redirectToLogin} className="px-4 py-2 bg-white text-green-700 text-xs font-bold rounded-xl border border-green-300 hover:bg-green-50 transition-all font-bn shadow-sm">
              {t("লগইন", "Login")}
            </button>
          </motion.div>
        )}

        {/* Login prompt — warm, not scary */}
        {!isAuthenticated && !guestMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-2xl p-4 flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center shrink-0 text-2xl">👋</div>
            <div className="flex-1">
              <p className="text-sm font-bold text-violet-800 font-bn">{t("আপনার অ্যাকাউন্টে লগইন করুন", "Please log in to your account")}</p>
              <p className="text-xs text-violet-500 font-bn mt-0.5">{t("অর্ডার করতে ও ট্র্যাক করতে লগইন প্রয়োজন", "Login is required to place and track orders")}</p>
            </div>
            <button onClick={redirectToLogin} className="px-5 py-2.5 bg-violet-600 text-white text-xs font-bold rounded-xl hover:bg-violet-700 transition-all font-bn shadow-sm">
              {t("লগইন", "Login")}
            </button>
          </motion.div>
        )}

        <div className="flex flex-col lg:grid lg:grid-cols-5 gap-6">
          {/* ─── LEFT COLUMN ─────────────── */}
          <div className="lg:col-span-3 space-y-5 order-2 lg:order-1">

            {/* 1. Child Selection — playful cards */}
            {isAuthenticated && children.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">👨‍👧‍👦</span>
                    <h2 className="font-bold font-bn text-gray-900">{t("কার জন্য কিনছেন?", "Who is this for?")}</h2>
                  </div>
                  {children.length > 1 && (
                    <button type="button"
                      onClick={() => selectedChildIds.size === children.length ? setSelectedChildIds(new Set()) : setSelectedChildIds(new Set(children.map((c: any) => c.id)))}
                      className="text-xs font-bold text-violet-600 hover:text-violet-800 px-3 py-1 rounded-full bg-violet-50 hover:bg-violet-100 transition-all"
                    >
                      {selectedChildIds.size === children.length ? t("সব বাতিল", "Deselect All") : t("সবাই", "Select All")}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {children.map((child: any, idx: number) => {
                    const isChecked = selectedChildIds.has(child.id);
                    const emoji = childAvatars[idx % childAvatars.length];
                    return (
                      <button key={child.id} type="button"
                        onClick={() => setSelectedChildIds((prev) => { const next = new Set(prev); next.has(child.id) ? next.delete(child.id) : next.add(child.id); return next; })}
                        className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                          isChecked ? "border-violet-400 bg-violet-50 shadow-sm shadow-violet-100" : "border-gray-150 hover:border-violet-200 bg-white"
                        }`}
                      >
                        <span className="text-2xl">{emoji}</span>
                        <span className="flex-1 font-semibold text-sm font-bn text-gray-800">{child.full_name}</span>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          isChecked ? "bg-violet-500 border-violet-500" : "border-gray-300"
                        }`}>
                          {isChecked && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-white text-[10px] font-black">✓</motion.span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {selectedChildIds.size === 0 && (
                  <div className="flex items-center gap-2 mt-3 bg-amber-50 border border-amber-200 px-3 py-2.5 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    <p className="text-xs text-amber-700 font-bn">{t("কোনো সন্তান নির্বাচিত না হলে, পরে অ্যাসাইন করতে হবে", "If no child is selected, you'll need to assign it later")}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* 2. Shipping / Order Info */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center"><MapPin className="w-4 h-4 text-blue-600" /></div>
                  <div>
                    <h2 className="font-bold font-bn text-gray-900 text-sm">{t("ডেলিভারি ঠিকানা", "Delivery Address")}</h2>
                    <p className="text-[10px] text-gray-400 font-bn">{t("পণ্য পৌঁছে দেওয়ার জন্য", "For product delivery")}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-500 font-bn mb-1 block">{t("প্রাপকের নাম", "Recipient Name")} *</label>
                    <input type="text" required value={form.shipping_name}
                      onChange={(e) => setForm((p) => ({ ...p, shipping_name: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 font-bn transition-all" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-500 font-bn mb-1 block">{t("মোবাইল নম্বর", "Mobile Number")} *</label>
                    <input type="tel" required value={form.shipping_phone}
                      onChange={(e) => setForm((p) => ({ ...p, shipping_phone: e.target.value }))}
                      placeholder="01XXXXXXXXX"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-semibold text-gray-500 font-bn mb-1 block">{t("সম্পূর্ণ ঠিকানা", "Full Address")} *</label>
                    <input type="text" required value={form.shipping_address}
                      onChange={(e) => setForm((p) => ({ ...p, shipping_address: e.target.value }))}
                      placeholder={t("বাসা নং, রোড, এলাকা...", "House, Road, Area...")}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 font-bn transition-all" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-500 font-bn mb-1 block">{t("শহর", "City")} *</label>
                    <select value={form.shipping_city}
                      onChange={(e) => {
                        const city = e.target.value;
                        const zone = city === "Dhaka" || city === "Gazipur" || city === "Narayanganj" ? "inside_dhaka" : "outside_dhaka";
                        setForm((p) => ({ ...p, shipping_city: city, shipping_zone: zone }));
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 font-bn transition-all appearance-none bg-white"
                    >
                      <option value="Dhaka">{t("ঢাকা", "Dhaka")}</option>
                      <option value="Chittagong">{t("চট্টগ্রাম", "Chittagong")}</option>
                      <option value="Rajshahi">{t("রাজশাহী", "Rajshahi")}</option>
                      <option value="Sylhet">{t("সিলেট", "Sylhet")}</option>
                      <option value="Khulna">{t("খুলনা", "Khulna")}</option>
                      <option value="Barisal">{t("বরিশাল", "Barisal")}</option>
                      <option value="Rangpur">{t("রংপুর", "Rangpur")}</option>
                      <option value="Mymensingh">{t("ময়মনসিংহ", "Mymensingh")}</option>
                      <option value="Cumilla">{t("কুমিল্লা", "Cumilla")}</option>
                      <option value="Gazipur">{t("গাজীপুর", "Gazipur")}</option>
                      <option value="Narayanganj">{t("নারায়ণগঞ্জ", "Narayanganj")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-500 font-bn mb-1 block">{t("এলাকা / থানা", "Area / Thana")}</label>
                    <input type="text" value={form.shipping_area}
                      onChange={(e) => setForm((p) => ({ ...p, shipping_area: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 font-bn transition-all" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-semibold text-gray-500 font-bn mb-1 block">{t("শিপিং জোন", "Shipping Zone")}</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: "inside_dhaka", label: t("ঢাকার ভিতরে", "Inside Dhaka"), price: "৳60", icon: MapPin, color: "text-violet-600", bg: "bg-violet-100" },
                        { value: "outside_dhaka", label: t("ঢাকার বাইরে", "Outside Dhaka"), price: "৳120", icon: Truck, color: "text-blue-600", bg: "bg-blue-100" },
                      ].map((zone) => {
                        const ZoneIcon = zone.icon;
                        return (
                          <button key={zone.value} type="button"
                            onClick={() => setForm((p) => ({ ...p, shipping_zone: zone.value }))}
                            className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all ${
                              form.shipping_zone === zone.value ? "border-violet-400 bg-violet-50" : "border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            <div className={`w-7 h-7 rounded-lg ${zone.bg} flex items-center justify-center shrink-0`}>
                              <ZoneIcon className={`w-3.5 h-3.5 ${zone.color}`} />
                            </div>
                            <div className="text-left">
                              <span className="text-[10px] font-semibold text-gray-700 font-bn block leading-tight">{zone.label}</span>
                              <span className="text-[10px] font-bold text-violet-600">{zone.price}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                {/* Delivery estimate */}
                <div className="flex items-center gap-2 mt-4 bg-blue-50 border border-blue-100 px-3 py-2.5 rounded-xl">
                  <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <p className="text-[11px] text-blue-700 font-bn font-medium">
                    {form.shipping_zone === "inside_dhaka" ? t("আনুমানিক ডেলিভারি: ২-৩ কর্মদিবস", "Estimated delivery: 2-3 business days") : t("আনুমানিক ডেলিভারি: ৩-৫ কর্মদিবস", "Estimated delivery: 3-5 business days")}
                  </p>
                </div>
              </motion.div>

            {/* 3. Payment Methods — big tappable cards */}
            {!isFree && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center"><Lock className="w-4 h-4 text-violet-600" /></div>
                  <div>
                    <h2 className="font-bold font-bn text-gray-900 text-sm">{t("পেমেন্ট মাধ্যম", "Payment Method")}</h2>
                    <p className="text-[10px] text-gray-400 font-bn">{t("আপনার পছন্দের মাধ্যম বেছে নিন", "Choose your preferred method")}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {paymentMethods.map((m) => {
                    const Icon = m.icon;
                    const isActive = paymentMethod === m.id;
                    return (
                      <button key={m.id} type="button" onClick={() => setPaymentMethod(m.id)}
                        className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                          isActive ? `border-violet-400 bg-violet-50 ring-2 ${m.ring} ring-offset-1` : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        <div className={`w-11 h-11 rounded-xl ${m.bg} flex items-center justify-center shadow-sm`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-semibold text-xs text-gray-800">{m.label}</span>
                        {isActive && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-violet-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-[9px] font-black">✓</span>
                          </motion.div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {paymentMethod === "cod" && (
                  <div className="flex items-center gap-2 mt-3 bg-emerald-50 border border-emerald-200 px-3 py-2.5 rounded-xl">
                    <Truck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <p className="text-[11px] text-emerald-700 font-bn font-medium">{t("ডেলিভারির সময় ক্যাশ পেমেন্ট করুন। অতিরিক্ত কোনো চার্জ নেই।", "Pay cash when your order is delivered. No extra charges.")}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* 4. Notes — collapsible */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <button type="button" onClick={() => setShowNotes(!showNotes)}
                className="w-full flex items-center justify-between px-5 py-3.5 bg-white rounded-2xl border border-gray-100 shadow-sm text-sm font-semibold text-gray-600 font-bn hover:bg-gray-50 transition-colors">
                <span>{t("বিশেষ নির্দেশনা (ঐচ্ছিক)", "Special Instructions (Optional)")}</span>
                {showNotes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <AnimatePresence>
                {showNotes && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                      placeholder={t("যেমন: গিফট র‍্যাপ করে দিন, বিকেলে ডেলিভারি দিন...", "e.g., Gift wrap please, deliver in the evening...")}
                      className="w-full mt-2 px-4 py-3 rounded-2xl border border-gray-100 bg-white text-sm font-bn resize-none h-24 outline-none focus:border-violet-400 shadow-sm transition-colors" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          {/* ─── RIGHT COLUMN — ORDER SUMMARY ─────── */}
          <div className="lg:col-span-2 order-1 lg:order-2">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm lg:sticky top-24 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4">
                <h2 className="text-base font-bold font-bn text-white flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" /> {t("অর্ডার সামারি", "Order Summary")}
                </h2>
              </div>

              {/* Products */}
              <div className="px-5 py-4 space-y-3">
                {isCartCheckout ? (
                  cartItems.filter((item) => !item.attachedTo).map((item) => {
                    const typeBadge = item.productType === "course"
                      ? { label: t("কোর্স", "Course"), color: "bg-blue-100 text-blue-700" }
                      : item.productType === "ebook"
                        ? { label: t("ই-বুক", "Ebook"), color: "bg-amber-100 text-amber-700" }
                        : item.productType === "exam"
                          ? { label: t("পরীক্ষা", "Exam"), color: "bg-purple-100 text-purple-700" }
                          : { label: t("প্রোডাক্ট", "Product"), color: "bg-violet-100 text-violet-700" };
                    const attachedItems = cartItems.filter((ai) => ai.attachedTo === item.productId);
                    return (
                      <div key={item.productId}>
                        <div className="flex gap-3 p-2.5 rounded-xl bg-gray-50/70">
                          <div className="w-14 h-14 rounded-lg bg-white shrink-0 flex items-center justify-center overflow-hidden border border-gray-100 shadow-sm">
                            {item.thumbnail_url ? (
                              <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-5 h-5 text-gray-300" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${typeBadge.color}`}>{typeBadge.label}</span>
                            </div>
                            <p className="text-xs font-bold text-gray-800 font-bn line-clamp-1">{t(item.title_bn || item.title, item.title)}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
                                {item.quantity <= 1 ? (
                                  <button type="button" onClick={() => cartStore.removeItem(item.productId)}
                                    className="px-1.5 py-1 hover:bg-red-50 transition-colors">
                                    <Trash2 className="w-3 h-3 text-red-400" />
                                  </button>
                                ) : (
                                  <button type="button" onClick={() => cartStore.updateQuantity(item.productId, item.quantity - 1)}
                                    className="px-1.5 py-1 hover:bg-gray-50 transition-colors">
                                    <Minus className="w-3 h-3 text-gray-500" />
                                  </button>
                                )}
                                <span className="px-2 py-1 text-[11px] font-bold text-gray-800 min-w-[24px] text-center">{item.quantity}</span>
                                <button type="button" onClick={() => cartStore.updateQuantity(item.productId, item.quantity + 1)}
                                  disabled={item.quantity >= item.maxQuantity}
                                  className="px-1.5 py-1 hover:bg-gray-50 transition-colors disabled:opacity-30">
                                  <Plus className="w-3 h-3 text-gray-500" />
                                </button>
                              </div>
                              {item.compare_price && item.compare_price > item.price && (
                                <span className="text-[10px] text-gray-400 line-through">৳{item.compare_price}</span>
                              )}
                            </div>
                          </div>
                          <p className="text-xs font-bold text-gray-900 shrink-0 self-center">৳{(item.price * item.quantity).toFixed(0)}</p>
                        </div>

                        {/* Attached exam items */}
                        {attachedItems.map((ai) => (
                          <div key={ai.productId} className="flex gap-3 p-2 ml-6 mt-1 rounded-lg bg-purple-50/50 border border-purple-100/50">
                            <div className="w-8 h-8 rounded-md bg-purple-100 shrink-0 flex items-center justify-center">
                              <GraduationCap className="w-4 h-4 text-purple-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                                  {t("পরীক্ষা", "Exam")}
                                </span>
                              </div>
                              <p className="text-xs font-bold text-gray-800 font-bn line-clamp-1">
                                {t(ai.title_bn || ai.title, ai.title)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <p className="text-xs font-bold text-gray-900">{ai.price > 0 ? `৳${ai.price}` : t("ফ্রি", "Free")}</p>
                              {ai.price > 0 && (
                                <button type="button" onClick={() => cartStore.removeItem(ai.productId)}
                                  className="p-1 hover:bg-red-50 rounded-md transition-colors">
                                  <X className="w-3 h-3 text-red-400" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })
                ) : product ? (
                  <div className="flex gap-3 p-2.5 rounded-xl bg-gray-50/70">
                    <div className="w-16 h-20 rounded-xl bg-white shrink-0 flex items-center justify-center overflow-hidden border border-gray-100 shadow-sm">
                      {product.thumbnail_url ? (
                        <img src={product.thumbnail_url} alt={product.title} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-6 h-6 text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        productType === "ebook" ? "bg-amber-100 text-amber-700" : productType === "exam" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                      }`}>
                        {productType === "ebook" ? t("ই-বুক", "Ebook") : productType === "exam" ? t("পরীক্ষা", "Exam") : t("কোর্স", "Course")}
                      </span>
                      <p className="text-sm font-bold text-gray-800 font-bn line-clamp-2 mt-1">{product.title_bn || product.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm font-bold text-violet-700">
                          {product.is_free ? <span className="text-green-600 font-bn">{t("ফ্রি", "Free")}</span> : `৳${subtotal}`}
                        </p>
                        {product.compare_price && product.compare_price > product.price && (
                          <span className="text-xs text-gray-400 line-through">৳{product.compare_price}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Pricing breakdown */}
              <div className="px-5 py-3 space-y-2.5 border-t border-gray-100">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400 font-bn">{t("সাবটোটাল", "Subtotal")}</span>
                  <span className="font-medium text-gray-600">৳{subtotal.toFixed(0)}</span>
                </div>
                {singleSavings > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600 font-semibold font-bn flex items-center gap-1"><Gift className="w-3 h-3" /> {t("সেভিংস", "Savings")}</span>
                    <span className="text-green-600 font-bold">-৳{singleSavings}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600 font-semibold font-bn">{t("কুপন ডিসকাউন্ট", "Coupon Discount")}</span>
                    <span className="text-green-600 font-bold">-৳{discount}</span>
                  </div>
                )}
                {shippingFee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400 font-bn">{t("শিপিং", "Shipping")}</span>
                    <span className="font-medium text-gray-600">৳{shippingFee}</span>
                  </div>
                )}

                {/* Coupon inline — hidden in guest mode */}
                {!guestMode && !isFree && (
                  <div className="pt-1">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                        <input type="text" value={couponCode}
                          onChange={e => { setCouponCode(e.target.value); setCouponMessage(""); setCouponValid(false); setCouponDiscount("0"); }}
                          placeholder={t("কুপন কোড", "Coupon Code")}
                          className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-xs font-mono uppercase outline-none focus:border-violet-400 font-bn transition-colors" />
                      </div>
                      <button type="button" onClick={applyCoupon} disabled={couponLoading || !couponCode.trim()}
                        className="px-3.5 py-2 bg-violet-600 text-white text-[11px] font-bold rounded-lg hover:bg-violet-700 disabled:opacity-40 transition-all shrink-0"
                      >{couponLoading ? "..." : t("প্রয়োগ", "Apply")}</button>
                    </div>
                    {couponMessage && (
                      <p className={`text-[10px] mt-1 font-bn ${couponValid ? "text-green-600" : "text-red-500"}`}>{couponMessage}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="mx-5 border-t border-gray-100" />
              <div className="px-5 py-4 flex justify-between items-baseline">
                <span className="font-bold text-gray-900 font-bn">{t("সর্বমোট", "Total")}</span>
                <span className="font-extrabold text-2xl text-violet-700">
                  {isFree ? <span className="text-green-600 font-bn text-lg">{t("ফ্রি", "Free")}</span> : `৳${total.toFixed(0)}`}
                </span>
              </div>

              {/* Submit */}
              <div className="px-5 pb-4">
                <button onClick={handleSubmit} disabled={submitting}
                  className="w-full py-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all hover:shadow-lg hover:shadow-violet-500/20 active:scale-[0.98] disabled:opacity-60 text-sm font-bn shadow-md flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : guestMode ? (
                    paymentMethod === "cod" ? (
                      <><Truck className="w-4 h-4" /> {t("ক্যাশ অন ডেলিভারি অর্ডার করো", "Place COD Order")}</>
                    ) : (
                      <><Lock className="w-4 h-4" /> {t("অর্ডার করো", "Place Order")}</>
                    )
                  ) : !isAuthenticated ? (
                    <><LogIn className="w-4 h-4" /> {t("লগইন করে অর্ডার করো", "Login to Place Order")}</>
                  ) : isFree ? (
                    <>{t("ফ্রি ভর্তি নিশ্চিত করো", "Confirm Free Enrollment")}</>
                  ) : paymentMethod === "cod" ? (
                    <><Truck className="w-4 h-4" /> {t("ক্যাশ অন ডেলিভারি অর্ডার করো", "Place COD Order")}</>
                  ) : (
                    <><Lock className="w-4 h-4" /> {t("নিরাপদ পেমেন্ট করো", "Pay Securely")}</>
                  )}
                </button>
              </div>

              {/* Trust strip */}
              <div className="px-5 pb-5 flex items-center justify-center gap-4 flex-wrap">
                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                  <Shield className="w-3 h-3" /> <span className="font-bn">{t("SSL সুরক্ষিত", "SSL Secured")}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                  <Lock className="w-3 h-3" /> <span className="font-bn">{t("তথ্য গোপনীয়", "Data Private")}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                  <Phone className="w-3 h-3" /> <span>09610990880</span>
                </div>
              </div>

              {/* Savings badge */}
              {(singleSavings > 0 || discount > 0) && (
                <div className="mx-5 mb-5">
                  <div className="py-2.5 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl text-center">
                    <p className="text-xs text-green-700 font-bold font-bn flex items-center justify-center gap-1">
                      <Gift className="w-3.5 h-3.5" /> {t(`তুমি ৳${(singleSavings + discount).toFixed(0)} সেভ করছো!`, `You're saving ৳${(singleSavings + discount).toFixed(0)}!`)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── MOBILE STICKY FOOTER ───────────────── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-gray-200 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div>
            <p className="text-[10px] text-gray-400 font-bn">{t("সর্বমোট", "Total")}</p>
            <p className="text-xl font-extrabold text-violet-700">
              {isFree ? <span className="text-green-600 font-bn text-base">{t("ফ্রি", "Free")}</span> : `৳${total.toFixed(0)}`}
            </p>
          </div>
          <button onClick={handleSubmit} disabled={submitting}
            className="px-8 py-3.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold rounded-xl text-sm font-bn shadow-md hover:shadow-lg active:scale-[0.98] disabled:opacity-60 flex items-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : guestMode ? t("অর্ডার করো", "Place Order") : !isAuthenticated ? t("লগইন করো", "Login") : isFree ? t("নিশ্চিত করো", "Confirm") : t("পেমেন্ট করো", "Pay Now")}
          </button>
        </div>
      </div>
      {/* Spacer for mobile sticky footer */}
      <div className="lg:hidden h-20" />
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutContent />
    </Suspense>
  );
}
