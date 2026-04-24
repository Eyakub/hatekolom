"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Phone, Lock, User, Eye, EyeOff, ArrowRight, Loader2, ShieldCheck, Rocket, BookOpen, Sparkles, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuthStore } from "@/stores/auth-store";
import { api, ApiError } from "@/lib/api";
import { Navbar } from "@/components/layout/Navbar";

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get("redirect");
  const { setAuth, isAuthenticated } = useAuthStore();

  // Redirect logged-in users away from register page
  useEffect(() => {
    if (isAuthenticated) router.replace(redirectTo || "/dashboard");
  }, [isAuthenticated, router, redirectTo]);
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    password: "",
    confirm_password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // OTP state
  const [showOTP, setShowOTP] = useState(false);
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpResending, setOtpResending] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [registeredPhone, setRegisteredPhone] = useState("");
  const [registeredToken, setRegisteredToken] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirm_password) {
      setError("পাসওয়ার্ড মিলছে না");
      return;
    }

    if (formData.password.length < 6) {
      setError("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে");
      return;
    }

    setLoading(true);
    try {
      const res: any = await api.register({
        full_name: formData.full_name,
        phone: formData.phone,
        password: formData.password,
      });

      // Store auth and redirect (use redirect param if available)
      setAuth(res.user, res.access_token, res.refresh_token);
      // Use replace so back button doesn't return to register
      router.replace(redirectTo || "/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 409
            ? "এই ফোন নম্বর দিয়ে ইতোমধ্যে অ্যাকাউন্ট আছে"
            : err.status === 422 && err.message?.toLowerCase().includes("phone")
              ? "সঠিক ফোন নম্বর দিন (১১ ডিজিট, যেমন: 01XXXXXXXXX)"
              : err.message
        );
      } else {
        setError("কিছু ভুল হয়েছে। আবার চেষ্টা করুন।");
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP digit input
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1);
    setOtpDigits(newDigits);
    setOtpError("");
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    if (value && index === 5 && newDigits.every(d => d !== "")) verifyOTP(newDigits.join(""));
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasteData.length === 0) return;
    const newDigits = [...otpDigits];
    for (let i = 0; i < pasteData.length && i < 6; i++) newDigits[i] = pasteData[i];
    setOtpDigits(newDigits);
    const nextEmpty = newDigits.findIndex(d => d === "");
    inputRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();
    if (newDigits.every(d => d !== "")) verifyOTP(newDigits.join(""));
  };

  const verifyOTP = async (code: string) => {
    setOtpLoading(true);
    setOtpError("");
    try {
      await api.post("/auth/verify-otp", { phone: registeredPhone, code }, registeredToken);
      router.push(redirectTo || "/dashboard");
    } catch (err: any) {
      setOtpError(err?.message || "ভুল কোড। আবার চেষ্টা করুন।");
      setOtpDigits(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } finally {
      setOtpLoading(false);
    }
  };

  const resendOTP = async () => {
    if (otpCountdown > 0 || otpResending) return;
    setOtpResending(true);
    try {
      await api.post("/auth/send-otp", { phone: registeredPhone, purpose: "registration" }, registeredToken);
      setOtpCountdown(60);
      setOtpError("");
      setOtpDigits(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch {
      setOtpError("কোড পাঠানো যায়নি। আবার চেষ্টা করুন।");
    } finally {
      setOtpResending(false);
    }
  };

  const skipOTP = () => router.push(redirectTo || "/dashboard");

  const benefits = [
    "বিনামূল্যে একাউন্ট খুলুন",
    "ফ্রি কোর্স দেখুন",
    "সন্তানের অগ্রগতি ট্র্যাক করুন",
    "ই-বুক ডাউনলোড করুন",
  ];

  // ─── Hero Section (shared between both views) ─────────────────────────
  const HeroSide = () => (
    <div className="relative hidden md:flex w-1/2 h-full bg-gradient-to-br from-primary-50 via-primary-100/50 to-[#f0e8ff] items-center justify-center overflow-hidden">
      {/* Floating Clouds */}
      <motion.div className="absolute top-20 left-0 w-32 h-16 bg-white/60 blur-xl rounded-full" animate={{ x: ["0%", "400%"] }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }} />
      <motion.div className="absolute top-40 right-20 w-48 h-24 bg-white/40 blur-2xl rounded-full" animate={{ x: ["100%", "-300%"] }} transition={{ duration: 35, repeat: Infinity, ease: "linear" }} />
      <motion.div className="absolute bottom-60 left-10 w-40 h-20 bg-white/50 blur-lg rounded-full" animate={{ x: ["0%", "350%"] }} transition={{ duration: 28, repeat: Infinity, ease: "linear" }} />

      {/* Twinkling Stars */}
      {[
        { top: "10%", left: "15%", delay: 0 },
        { top: "25%", left: "40%", delay: 0.5 },
        { top: "15%", right: "25%", delay: 1.2 },
        { top: "60%", left: "20%", delay: 0.8 },
        { top: "70%", right: "15%", delay: 1.5 },
      ].map((star, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 bg-primary-300 rounded-full"
          style={{ top: star.top, left: star.left, right: (star as any).right }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, delay: star.delay }}
        />
      ))}

      <div className="relative z-10 flex flex-col items-center text-center px-12">
        <div className="relative w-80 h-80 mb-8">
          <div className="absolute bottom-0 w-full h-24 bg-primary-200 rounded-[100%] blur-sm opacity-30 translate-y-8" />
          <div className="absolute bottom-4 left-0 right-0 h-40 bg-gradient-to-b from-primary-300/60 to-primary-400/40 rounded-[50%] shadow-lg" />
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center">
            <div className="w-40 h-8 bg-primary-500 rounded-md shadow-md -rotate-2 translate-y-2" />
            <div className="w-44 h-10 bg-primary-300 rounded-md shadow-md rotate-1 translate-y-1 border-b-4 border-white/20" />
            <div className="w-48 h-12 bg-primary-100 rounded-md shadow-xl border-b-4 border-primary-800/10 flex items-center justify-center">
              <span className="text-[8px] font-bold text-primary-800/40 tracking-widest">ADVENTURE AWAITS</span>
            </div>
          </div>
          <motion.div className="absolute bottom-28 left-1/2 -translate-x-1/2 w-52 h-52" animate={{ y: [0, -15, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAL_iSkejHfI-kjHX-NzjRmwUqnDz7sLzExpkqM_ntHmVpscorf_Olo8ZS3wUDVd1_HvIJF4gfIRD6qEZ_2hGlaqrWkfTZrx8LD4Z2Z65T6Y2hlxCRhxYbD_dLhCJZ1VArbPhdXsWmXYtZD7wS0N87QuLH9mWzFjPqOVrtwwjmSSFZGYthsEWOCtr7yApWH-5owXeW_wIqxyGouC0TiKKYuOb-402p7fH9F-Mj5E2cCcNNuoLh6NtupLbdWkarCl1mzKY1J9o5EfnT8"
              alt="Learning Owl Mascot"
              className="w-full h-full object-contain drop-shadow-2xl"
            />
          </motion.div>
          <motion.div className="absolute -top-10 -right-4 w-12 h-12 bg-white rounded-xl rotate-12 shadow-lg flex items-center justify-center" animate={{ y: [0, -8, 0], rotate: [12, 20, 12] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
            <Rocket className="w-5 h-5 text-primary-600" />
          </motion.div>
          <motion.div className="absolute top-20 -left-10 w-10 h-10 bg-white rounded-xl -rotate-12 shadow-lg flex items-center justify-center" animate={{ y: [0, -6, 0], rotate: [-12, -20, -12] }} transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}>
            <BookOpen className="w-4 h-4 text-primary-500" />
          </motion.div>
          <motion.div className="absolute top-4 right-16 w-8 h-8 bg-white rounded-lg rotate-6 shadow-md flex items-center justify-center" animate={{ y: [0, -10, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </motion.div>
        </div>

        <motion.h1 className="font-[family-name:var(--font-display)] text-5xl font-bold text-primary-900 mb-4 leading-tight tracking-tight" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          শেখা হোক অ্যাডভেঞ্চার 🚀
        </motion.h1>
        <motion.p className="text-xl text-primary-700/70 max-w-md font-medium font-bn" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          হাজারো শিক্ষার্থী ইতোমধ্যে যুক্ত হয়েছে!
        </motion.p>
      </div>
      <div className="absolute top-0 right-0 bottom-0 w-16 bg-gradient-to-r from-transparent to-white/10 pointer-events-none" />
    </div>
  );

  // ─── OTP Verification Screen ──────────────────────────────────────────
  if (showOTP) {
    return (
      <>
      <Navbar />
      <div className="flex h-[calc(100vh-64px)] w-screen flex-col md:flex-row overflow-hidden">
        <HeroSide />
        <div className="w-full md:w-1/2 h-full flex flex-col justify-center items-center px-6 md:px-20 py-12 bg-white overflow-y-auto">
          <motion.div
            className="w-full max-w-md bg-white p-8 md:p-10 rounded-[24px] md:shadow-[0_20px_50px_rgba(0,0,0,0.06)] md:border md:border-gray-100/50"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div className="text-center mb-8">
              <motion.div
                className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <ShieldCheck className="w-10 h-10 text-primary-700" />
              </motion.div>
              <h1 className="text-2xl font-bold font-bn text-gray-900">ফোন যাচাই করুন</h1>
              <p className="text-gray-400 font-bn mt-2 text-sm">
                <span className="font-mono font-bold text-gray-600">{registeredPhone}</span> নম্বরে ৬ ডিজিটের কোড পাঠানো হয়েছে
              </p>
            </div>

            {/* OTP Input */}
            <div className="flex justify-center gap-2.5 mb-6" onPaste={handleOtpPaste}>
              {otpDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  disabled={otpLoading}
                  className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all ${
                    digit ? "border-primary-500 bg-primary-50 text-primary-800" : "border-gray-200 bg-gray-50 text-gray-900"
                  } focus:border-primary-600 focus:ring-2 focus:ring-primary-100 disabled:opacity-50`}
                />
              ))}
            </div>

            {otpLoading && (
              <div className="flex items-center justify-center gap-2 mb-4 text-primary-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm font-bn">যাচাই করা হচ্ছে...</span>
              </div>
            )}

            {otpError && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-50 text-red-700 text-sm font-bn px-4 py-3 rounded-xl border border-red-100 mb-4 text-center">
                {otpError}
              </motion.div>
            )}

            <button
              onClick={() => { const code = otpDigits.join(""); if (code.length === 6) verifyOTP(code); }}
              disabled={otpLoading || otpDigits.some(d => !d)}
              className="w-full h-14 bg-primary-600 text-white font-bold rounded-full shadow-lg shadow-primary-600/20 hover:bg-primary-700 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed font-bn flex items-center justify-center gap-2"
            >
              {otpLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ShieldCheck className="w-4 h-4" /> যাচাই করুন</>}
            </button>

            <div className="mt-4 text-center">
              {otpCountdown > 0 ? (
                <p className="text-xs text-gray-400 font-bn">আবার পাঠানো যাবে <span className="font-mono font-bold text-gray-600">{otpCountdown}s</span> পরে</p>
              ) : (
                <button onClick={resendOTP} disabled={otpResending} className="text-sm text-primary-700 font-semibold hover:underline font-bn disabled:opacity-50">
                  {otpResending ? "পাঠানো হচ্ছে..." : "আবার কোড পাঠান"}
                </button>
              )}
            </div>

            <div className="mt-4 text-center">
              <button onClick={skipOTP} className="text-xs text-gray-400 hover:text-gray-600 font-bn transition-colors">
                পরে করবো — এখন ড্যাশবোর্ডে যান
              </button>
            </div>

            <div className="mt-6 p-3 bg-amber-50 border border-amber-100 rounded-lg">
              <p className="text-[11px] text-amber-700 font-bn text-center">
                ডেমো মোড: OTP সার্ভার কনসোলে দেখা যাবে (SMS পাঠানো হবে না)
              </p>
            </div>
          </motion.div>
        </div>
      </div>
      </>
    );
  }

  // ─── Registration Form ────────────────────────────────────────────────
  return (
    <>
    <Navbar />
    <div className="flex h-[calc(100vh-64px)] w-screen flex-col md:flex-row overflow-hidden">
      <HeroSide />

      {/* Right Side: Form */}
      <div className="w-full md:w-1/2 h-full flex flex-col justify-center items-center px-6 md:px-20 py-8 bg-white overflow-y-auto">
        <motion.div
          className="w-full max-w-md bg-white p-8 md:p-10 rounded-[24px] md:shadow-[0_20px_50px_rgba(0,0,0,0.06)] md:border md:border-gray-100/50"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Branding */}
          <div className="mb-6 text-center md:text-left">
            <Link href="/" className="inline-flex items-center gap-2 mb-1">
              <span className="font-[family-name:var(--font-display)] text-3xl font-bold text-primary-800">Hate Kolom</span>
            </Link>
            <p className="text-sm text-gray-400 font-bn">অভিভাবক হিসেবে রেজিস্ট্রেশন করুন</p>
          </div>

          {/* Benefits */}
          <div className="bg-primary-50 rounded-xl p-3.5 mb-6 border border-primary-100">
            <div className="grid grid-cols-2 gap-1.5">
              {benefits.map((b) => (
                <div key={b} className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary-600 shrink-0" />
                  <span className="text-[11px] text-primary-800 font-bn font-medium">{b}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-50 text-red-700 text-sm font-bn px-4 py-3 rounded-xl border border-red-100">
                {error}
              </motion.div>
            )}

            {/* Name */}
            <div className="space-y-1">
              <label className="block text-sm font-semibold text-gray-600 ml-2 mb-1 font-bn">পুরো নাম (অভিভাবক)</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => updateField("full_name", e.target.value)}
                  placeholder="আপনার নাম লিখুন"
                  className="w-full h-13 pl-12 pr-4 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-primary-200 focus:bg-white transition-all text-sm outline-none placeholder:text-gray-300 font-bn"
                  required
                />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-1">
              <label className="block text-sm font-semibold text-gray-600 ml-2 mb-1 font-bn">ফোন নম্বর</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full h-13 pl-12 pr-4 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-primary-200 focus:bg-white transition-all text-sm outline-none placeholder:text-gray-300"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="block text-sm font-semibold text-gray-600 ml-2 mb-1 font-bn">পাসওয়ার্ড</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => updateField("password", e.target.value)}
                  placeholder="কমপক্ষে ৬ অক্ষর"
                  className="w-full h-13 pl-12 pr-14 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-primary-200 focus:bg-white transition-all text-sm outline-none placeholder:text-gray-300"
                  required
                  minLength={6}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-primary-600 mt-1 font-medium italic ml-2 font-bn">এটা শুধু আপনার গোপন! 🔐</p>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1">
              <label className="block text-sm font-semibold text-gray-600 ml-2 mb-1 font-bn">পাসওয়ার্ড নিশ্চিত করুন</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <input
                  type="password"
                  value={formData.confirm_password}
                  onChange={(e) => updateField("confirm_password", e.target.value)}
                  placeholder="আবার পাসওয়ার্ড লিখুন"
                  className="w-full h-13 pl-12 pr-4 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-primary-200 focus:bg-white transition-all text-sm outline-none placeholder:text-gray-300"
                  required
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-primary-600 text-white font-bold text-base rounded-full shadow-lg shadow-primary-600/20 hover:bg-primary-700 hover:scale-[1.02] active:scale-[0.98] transition-all mt-2 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-bn"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>অ্যাকাউন্ট তৈরি করুন <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          {/* Footer Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400 font-bn">
              ইতোমধ্যে অ্যাকাউন্ট আছে?{" "}
              <Link href={redirectTo ? `/login?redirect=${encodeURIComponent(redirectTo)}` : "/login"} className="font-bold text-primary-700 hover:underline">লগইন করুন</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
    </>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>}>
      <RegisterContent />
    </Suspense>
  );
}
