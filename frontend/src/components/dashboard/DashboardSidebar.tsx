"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, ShoppingBag, User, BookOpenText, Award, LayoutGrid
} from "lucide-react";
import { useLocaleStore } from "@/stores/locale-store";

const navItems = [
  { href: "/dashboard", label: "ড্যাশবোর্ড", labelEn: "Dashboard", icon: LayoutGrid },
  // { href: "/dashboard/ebooks", label: "আমার ই-বুক", labelEn: "My Ebooks", icon: BookOpenText },
  { href: "/dashboard/certificates", label: "সার্টিফিকেট", labelEn: "Certificates", icon: Award },
  { href: "/dashboard/orders", label: "অর্ডার সমূহ", labelEn: "Orders", icon: ShoppingBag },
  { href: "/dashboard/profile", label: "প্রোফাইল", labelEn: "Profile", icon: User },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const { locale, t } = useLocaleStore();

  // Prevent hydration mismatch: don't render locale-dependent text until mounted
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Before hydration, use Bengali (matches server default)
  const getLabel = (item: typeof navItems[0]) => {
    if (!mounted) return item.label;
    return locale === "bn" ? item.label : item.labelEn;
  };

  const exploreLabel = mounted
    ? t("নতুন কোর্স অন্বেষণ করুন", "Explore New Courses")
    : "নতুন কোর্স অন্বেষণ করুন";

  return (
    <aside className="w-full lg:w-[280px] shrink-0 bg-[#FDFBFE] lg:min-h-screen border-r border-[#F3EDF7] p-6 flex flex-col relative z-20">
      {/* Branding */}
      <div className="mb-12 px-2 hidden lg:block">
        <h1 className="text-[26px] font-black text-primary-900 font-serif tracking-wide leading-none">
          Hate<span className="text-primary-600">.</span>Kolom
        </h1>
        <p className="text-[10px] text-gray-500 mt-1.5 tracking-widest uppercase font-semibold">Guardian Portal</p>
      </div>

      <nav className="space-y-1.5 flex-1 flex lg:flex-col overflow-x-auto lg:overflow-visible pb-4 lg:pb-0 hide-scrollbar">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm font-bn transition-all shrink-0 lg:shrink whitespace-nowrap ${
                isActive
                  ? "bg-white text-primary-700 font-bold shadow-[0_8px_20px_rgb(0,0,0,0.04)] border border-gray-50/50"
                  : "text-gray-500 hover:bg-white/50 hover:text-gray-800 font-semibold"
              }`}
            >
              <item.icon
                className={`w-[18px] h-[18px] transition-colors ${
                  isActive ? "text-primary-600 fill-primary-600/10" : "text-gray-400"
                }`}
              />
              {getLabel(item)}
            </Link>
          );
        })}
      </nav>

      {/* Upgrade / Explore Box */}
      <div className="mt-auto pt-8 hidden lg:block">
        <Link
          href="/courses"
          className="w-full flex items-center justify-center py-3.5 bg-primary-700 text-white rounded-2xl text-sm font-bold font-bn hover:bg-primary-800 transition-all shadow-[0_6px_16px_rgba(79,70,229,0.2)] active:scale-[0.98]"
        >
          {exploreLabel}
        </Link>
      </div>
    </aside>
  );
}
