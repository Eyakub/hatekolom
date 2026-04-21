"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, User, Phone, Mail, Calendar } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, accessToken, updateUser, _hasHydrated } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({ full_name: "", full_name_bn: "", email: "" });

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted || !_hasHydrated) return;
    if (!isAuthenticated) { router.push("/login"); return; }
    if (user) {
      setForm({
        full_name: user.full_name || "",
        full_name_bn: user.full_name_bn || "",
        email: user.email || "",
      });
    }
  }, [mounted, _hasHydrated, isAuthenticated, user, router]);

  const handleSave = async () => {
    if (!accessToken) return;
    setSaving(true);
    setSuccess(false);
    try {
      const updated: any = await api.patch("/users/me", form, accessToken);
      updateUser(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      import("@/stores/toast-store").then(m => m.toast.error(err.message || "আপডেট ব্যর্থ"));
    }
    setSaving(false);
  };

  if (!mounted || !_hasHydrated || !isAuthenticated) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 text-primary-600 animate-spin" /></div>;
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 font-bn">প্রোফাইল সেটিংস</h1>
        <p className="text-sm text-gray-400 font-bn mt-1">তোমার তথ্য আপডেট করো</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-800 px-6 py-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center">
              <span className="text-2xl font-bold text-white">{user?.full_name?.[0]?.toUpperCase() || "U"}</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white font-bn">{user?.full_name}</h2>
              <p className="text-white/70 text-sm flex items-center gap-1.5"><Phone className="w-3 h-3" /> {user?.phone || "—"}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="p-6 space-y-5">
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-1.5"><User className="w-3.5 h-3.5" /> Full Name (English)</label>
              <input type="text" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all" />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-1.5 font-bn"><User className="w-3.5 h-3.5" /> নাম (বাংলা)</label>
              <input type="text" value={form.full_name_bn} onChange={e => setForm(p => ({ ...p, full_name_bn: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all font-bn" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-1.5"><Mail className="w-3.5 h-3.5" /> Email</label>
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all" placeholder="email@example.com" />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-1.5"><Phone className="w-3.5 h-3.5" /> Phone</label>
              <input type="text" value={user?.phone || ""} disabled className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 text-gray-400 cursor-not-allowed" />
              <p className="text-[10px] text-gray-400 mt-1">Phone number cannot be changed</p>
            </div>
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-1.5"><Calendar className="w-3.5 h-3.5" /> Member Since</label>
            <p className="text-sm text-gray-700">{user?.created_at ? new Date(user.created_at).toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" }) : "—"}</p>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-700 text-white font-semibold rounded-xl hover:bg-primary-800 disabled:opacity-50 transition-all text-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "সেভ হচ্ছে..." : "সেভ করো"}
            </button>
            {success && <span className="text-sm text-green-600 font-semibold font-bn">✓ সফলভাবে আপডেট হয়েছে!</span>}
          </div>
        </div>
      </div>
    </>
  );
}
