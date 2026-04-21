"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GraduationCap, Phone, Lock, ArrowRight, ArrowLeft,
  Loader2, ShieldCheck, KeyRound, CheckCircle2,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";

type Step = "phone" | "otp" | "newPassword" | "success";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [otpCountdown, setOtpCountdown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer
  useEffect(() => {
    if (otpCountdown <= 0) return;
    const timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  // Step 1: Send OTP to phone
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!phone || phone.length < 11) {
      setError("সঠিক ফোন নম্বর দিন");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { phone });
      setStep("otp");
      setOtpCountdown(60);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.status === 429 ? "অনেক বেশি চেষ্টা হয়েছে। পরে আবার চেষ্টা করুন।" : err.message);
      } else {
        setError("কিছু ভুল হয়েছে।");
      }
    } finally {
      setLoading(false);
    }
  };

  // OTP input handlers
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1);
    setOtpDigits(newDigits);
    setError("");
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    // Auto-advance to password step
    if (value && index === 5 && newDigits.every(d => d !== "")) {
      setStep("newPassword");
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasteData.length) return;
    const newDigits = [...otpDigits];
    for (let i = 0; i < pasteData.length && i < 6; i++) newDigits[i] = pasteData[i];
    setOtpDigits(newDigits);
    const nextEmpty = newDigits.findIndex(d => d === "");
    inputRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();
    if (newDigits.every(d => d !== "")) setStep("newPassword");
  };

  const handleOtpContinue = () => {
    if (otpDigits.some(d => !d)) {
      setError("সম্পূর্ণ কোড দিন");
      return;
    }
    setStep("newPassword");
  };

  const resendOTP = async () => {
    if (otpCountdown > 0) return;
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { phone });
      setOtpCountdown(60);
      setOtpDigits(["", "", "", "", "", ""]);
      setError("");
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch {
      setError("কোড পাঠানো যায়নি।");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Set new password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("পাসওয়ার্ড মিলছে না");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", {
        phone,
        code: otpDigits.join(""),
        new_password: newPassword,
      });
      setStep("success");
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.message.includes("Invalid OTP") || err.message.includes("expired")) {
          setError("ভুল কোড বা মেয়াদ শেষ। আবার চেষ্টা করুন।");
          setStep("otp");
          setOtpDigits(["", "", "", "", "", ""]);
        } else {
          setError(err.message);
        }
      } else {
        setError("কিছু ভুল হয়েছে।");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <GraduationCap className="w-10 h-10 text-primary-700" />
            <span className="text-2xl font-bold text-primary-800 font-[family-name:var(--font-display)]">
              Hate Kolom
            </span>
          </Link>
        </div>

        {/* ===== Step 1: Phone Input ===== */}
        {step === "phone" && (
          <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
                <KeyRound className="w-8 h-8 text-primary-700" />
              </div>
              <h1 className="text-xl font-bold font-bn text-gray-900">
                পাসওয়ার্ড ভুলে গেছো?
              </h1>
              <p className="text-sm text-gray-500 font-bn mt-1">
                তোমার ফোন নম্বরে একটি কোড পাঠানো হবে
              </p>
            </div>

            <form onSubmit={handleSendOTP} className="space-y-4">
              {error && (
                <div className="bg-red-50 text-red-700 text-sm font-bn px-4 py-3 rounded-xl border border-red-100">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5 font-bn">
                  ফোন নম্বর
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all text-sm"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary-700 text-white font-semibold rounded-xl hover:bg-primary-800 transition-all active:scale-[0.98] disabled:opacity-60 font-bn"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>কোড পাঠাও <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-500 font-bn">
              <Link href="/login" className="text-primary-700 font-semibold hover:underline inline-flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> লগইনে ফিরে যাও
              </Link>
            </div>
          </div>
        )}

        {/* ===== Step 2: OTP Verification ===== */}
        {step === "otp" && (
          <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-8 h-8 text-primary-700" />
              </div>
              <h1 className="text-xl font-bold font-bn text-gray-900">
                কোড দাও
              </h1>
              <p className="text-sm text-gray-500 font-bn mt-1">
                <span className="font-mono font-bold text-gray-700">{phone}</span> নম্বরে পাঠানো ৬ ডিজিটের কোড
              </p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 text-sm font-bn px-4 py-3 rounded-xl border border-red-100 mb-4 text-center">
                {error}
              </div>
            )}

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
                  className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all ${
                    digit
                      ? "border-primary-500 bg-primary-50 text-primary-800"
                      : "border-gray-200 bg-white text-gray-900"
                  } focus:border-primary-600 focus:ring-2 focus:ring-primary-100`}
                />
              ))}
            </div>

            <button
              onClick={handleOtpContinue}
              disabled={otpDigits.some(d => !d)}
              className="w-full py-3.5 bg-primary-700 text-white font-semibold rounded-xl hover:bg-primary-800 transition-all active:scale-[0.98] disabled:opacity-50 font-bn flex items-center justify-center gap-2"
            >
              পরের ধাপে যাও <ArrowRight className="w-4 h-4" />
            </button>

            {/* Resend */}
            <div className="mt-4 text-center">
              {otpCountdown > 0 ? (
                <p className="text-xs text-gray-400 font-bn">
                  আবার পাঠানো যাবে <span className="font-mono font-bold text-gray-600">{otpCountdown}s</span> পরে
                </p>
              ) : (
                <button onClick={resendOTP} disabled={loading} className="text-sm text-primary-700 font-semibold hover:underline font-bn">
                  আবার কোড পাঠাও
                </button>
              )}
            </div>

            {/* Back */}
            <div className="mt-3 text-center">
              <button onClick={() => { setStep("phone"); setError(""); }} className="text-xs text-gray-400 hover:text-gray-600 font-bn">
                <ArrowLeft className="w-3 h-3 inline mr-1" />ফোন নম্বর পরিবর্তন করো
              </button>
            </div>

            {/* Mock hint */}
            <div className="mt-5 p-2.5 bg-amber-50 border border-amber-100 rounded-lg">
              <p className="text-[11px] text-amber-700 font-bn text-center">
                ডেমো মোড: OTP সার্ভার কনসোলে দেখা যাবে
              </p>
            </div>
          </div>
        )}

        {/* ===== Step 3: New Password ===== */}
        {step === "newPassword" && (
          <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-green-700" />
              </div>
              <h1 className="text-xl font-bold font-bn text-gray-900">
                নতুন পাসওয়ার্ড দাও
              </h1>
              <p className="text-sm text-gray-500 font-bn mt-1">
                কমপক্ষে ৬ অক্ষরের নতুন পাসওয়ার্ড সেট করো
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              {error && (
                <div className="bg-red-50 text-red-700 text-sm font-bn px-4 py-3 rounded-xl border border-red-100">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5 font-bn">
                  নতুন পাসওয়ার্ড
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="কমপক্ষে ৬ অক্ষর"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all text-sm"
                    required
                    minLength={6}
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5 font-bn">
                  পাসওয়ার্ড নিশ্চিত করো
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="আবার পাসওয়ার্ড লিখুন"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all text-sm"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary-700 text-white font-semibold rounded-xl hover:bg-primary-800 transition-all active:scale-[0.98] disabled:opacity-60 font-bn"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>পাসওয়ার্ড রিসেট করো <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ===== Step 4: Success ===== */}
        {step === "success" && (
          <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-xl font-bold font-bn text-gray-900 mb-2">
              পাসওয়ার্ড রিসেট সফল!
            </h1>
            <p className="text-sm text-gray-500 font-bn mb-6">
              তোমার নতুন পাসওয়ার্ড দিয়ে এখন লগইন করতে পারো
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 w-full py-3.5 bg-primary-700 text-white font-semibold rounded-xl hover:bg-primary-800 transition-all font-bn"
            >
              লগইনে যাও <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
