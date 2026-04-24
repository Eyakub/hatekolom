"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Phone, Lock, Eye, EyeOff, ArrowRight, Loader2, Rocket, BookOpen, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useAuthStore } from "@/stores/auth-store";
import { api, ApiError } from "@/lib/api";
import { Navbar } from "@/components/layout/Navbar";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get("redirect");
  const { setAuth, isAuthenticated } = useAuthStore();

  // Redirect logged-in users away from login page
  useEffect(() => {
    if (isAuthenticated) router.replace(redirectTo || "/dashboard");
  }, [isAuthenticated, router, redirectTo]);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res: any = await api.login({ phone, password });
      setAuth(res.user, res.access_token, res.refresh_token);
      
      const hasAdmin = res.user?.roles?.some((r: string) => ["super_admin", "admin"].includes(r));
      router.push(redirectTo || (hasAdmin ? "/admin" : "/dashboard"));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 401
            ? "ভুল ফোন নম্বর অথবা পাসওয়ার্ড"
            : err.message
        );
      } else {
        setError("কিছু ভুল হয়েছে। আবার চেষ্টা করুন।");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <Navbar />
    <div className="flex h-[calc(100vh-64px)] w-screen flex-col md:flex-row overflow-hidden">
      {/* Left Side: Hero Section */}
      <div className="relative hidden md:flex w-1/2 h-full bg-gradient-to-br from-primary-50 via-primary-100/50 to-[#f0e8ff] items-center justify-center overflow-hidden">
        {/* Floating Clouds */}
        <motion.div
          className="absolute top-20 left-0 w-32 h-16 bg-white/60 blur-xl rounded-full"
          animate={{ x: ["0%", "400%"] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute top-40 right-20 w-48 h-24 bg-white/40 blur-2xl rounded-full"
          animate={{ x: ["100%", "-300%"] }}
          transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute bottom-60 left-10 w-40 h-20 bg-white/50 blur-lg rounded-full"
          animate={{ x: ["0%", "350%"] }}
          transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
        />

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

        {/* Central Composition */}
        <div className="relative z-10 flex flex-col items-center text-center px-12">
          <div className="relative w-80 h-80 mb-8">
            {/* Island Base */}
            <div className="absolute bottom-0 w-full h-24 bg-primary-200 rounded-[100%] blur-sm opacity-30 translate-y-8" />
            <div className="absolute bottom-4 left-0 right-0 h-40 bg-gradient-to-b from-primary-300/60 to-primary-400/40 rounded-[50%] shadow-lg" />

            {/* Floating Books Stack */}
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center">
              <div className="w-40 h-8 bg-primary-500 rounded-md shadow-md -rotate-2 translate-y-2" />
              <div className="w-44 h-10 bg-primary-300 rounded-md shadow-md rotate-1 translate-y-1 border-b-4 border-white/20" />
              <div className="w-48 h-12 bg-primary-100 rounded-md shadow-xl border-b-4 border-primary-800/10 flex items-center justify-center">
                <span className="text-[8px] font-bold text-primary-800/40 tracking-widest">ADVENTURE AWAITS</span>
              </div>
            </div>

            {/* Owl Mascot */}
            <motion.div
              className="absolute bottom-28 left-1/2 -translate-x-1/2 w-52 h-52"
              animate={{ y: [0, -15, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAL_iSkejHfI-kjHX-NzjRmwUqnDz7sLzExpkqM_ntHmVpscorf_Olo8ZS3wUDVd1_HvIJF4gfIRD6qEZ_2hGlaqrWkfTZrx8LD4Z2Z65T6Y2hlxCRhxYbD_dLhCJZ1VArbPhdXsWmXYtZD7wS0N87QuLH9mWzFjPqOVrtwwjmSSFZGYthsEWOCtr7yApWH-5owXeW_wIqxyGouC0TiKKYuOb-402p7fH9F-Mj5E2cCcNNuoLh6NtupLbdWkarCl1mzKY1J9o5EfnT8"
                alt="Learning Owl Mascot"
                className="w-full h-full object-contain drop-shadow-2xl"
              />
            </motion.div>

            {/* Floating Decorative Elements */}
            <motion.div
              className="absolute -top-10 -right-4 w-12 h-12 bg-white rounded-xl rotate-12 shadow-lg flex items-center justify-center"
              animate={{ y: [0, -8, 0], rotate: [12, 20, 12] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <Rocket className="w-5 h-5 text-primary-600" />
            </motion.div>
            <motion.div
              className="absolute top-20 -left-10 w-10 h-10 bg-white rounded-xl -rotate-12 shadow-lg flex items-center justify-center"
              animate={{ y: [0, -6, 0], rotate: [-12, -20, -12] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            >
              <BookOpen className="w-4 h-4 text-primary-500" />
            </motion.div>
            <motion.div
              className="absolute top-4 right-16 w-8 h-8 bg-white rounded-lg rotate-6 shadow-md flex items-center justify-center"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
            </motion.div>
          </div>

          <motion.h1
            className="font-[family-name:var(--font-display)] text-5xl font-bold text-primary-900 mb-4 leading-tight tracking-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            শেখা হোক অ্যাডভেঞ্চার 🚀
          </motion.h1>
          <motion.p
            className="text-xl text-primary-700/70 max-w-md font-medium font-bn"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            হাজারো শিক্ষার্থী ইতোমধ্যে যুক্ত হয়েছে!
          </motion.p>
        </div>

        {/* Layered Paper Edge */}
        <div className="absolute top-0 right-0 bottom-0 w-16 bg-gradient-to-r from-transparent to-white/10 pointer-events-none" />
      </div>

      {/* Right Side: Form Section */}
      <div className="w-full md:w-1/2 h-full flex flex-col justify-center items-center px-6 md:px-20 py-12 bg-white overflow-y-auto">
        <motion.div
          className="w-full max-w-md bg-white p-8 md:p-10 rounded-[24px] md:shadow-[0_20px_50px_rgba(0,0,0,0.06)] md:border md:border-gray-100/50"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Branding */}
          <div className="mb-8 text-center md:text-left">
            <Link href="/" className="inline-flex items-center gap-2 mb-1">
              <span className="font-[family-name:var(--font-display)] text-3xl font-bold text-primary-800">Hate Kolom</span>
            </Link>
            <p className="text-sm text-gray-400 font-bn">অভিভাবক হিসেবে লগইন করুন</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 text-red-700 text-sm font-bn px-4 py-3 rounded-xl border border-red-100"
              >
                {error}
              </motion.div>
            )}

            {/* Phone */}
            <div className="space-y-1">
              <label className="block text-sm font-semibold text-gray-600 ml-2 mb-1 font-bn">ফোন নম্বর</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full h-14 pl-12 pr-4 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-primary-200 focus:bg-white transition-all text-sm outline-none placeholder:text-gray-300"
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-14 pl-12 pr-14 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-primary-200 focus:bg-white transition-all text-sm outline-none placeholder:text-gray-300"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-primary-600 mt-1 font-medium italic ml-2 font-bn">এটা শুধু আপনার গোপন! 🔐</p>
                <Link href="/forgot-password" className="text-[11px] text-primary-700 font-semibold hover:underline font-bn mt-1">
                  পাসওয়ার্ড ভুলে গেছেন?
                </Link>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-primary-600 text-white font-bold text-base rounded-full shadow-lg shadow-primary-600/20 hover:bg-primary-700 hover:scale-[1.02] active:scale-[0.98] transition-all mt-2 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-bn"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  লগইন করুন <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer Link */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-400 font-bn">
              অ্যাকাউন্ট নেই?{" "}
              <Link href={redirectTo ? `/register?redirect=${encodeURIComponent(redirectTo)}` : "/register"} className="font-bold text-primary-700 hover:underline">
                ফ্রি রেজিস্ট্রেশন করুন
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>}>
      <LoginContent />
    </Suspense>
  );
}
