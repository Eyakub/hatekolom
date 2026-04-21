"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Users, BookOpen, ShoppingBag, Truck,
  Settings, ChevronRight, Loader2, Tag, GraduationCap, LogOut, Loader, Home, Shield, BarChart3, Gamepad2, Calculator, Award, Image as ImageIcon, Target
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useLocaleStore } from "@/stores/locale-store";
import { useSiteStore } from "@/stores/site-store";

const sidebarGroups = [
  {
    items: [
      { id: "dashboard", bn: "ড্যাশবোর্ড", en: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    bn: "কন্টেন্ট", en: "Content",
    items: [
      { id: "courses", bn: "কোর্স", en: "Courses", icon: BookOpen },
      { id: "exams", bn: "পরীক্ষা", en: "Exams", icon: GraduationCap },
      { id: "games", bn: "গেমস", en: "Games", icon: Gamepad2 },
      { id: "abacus", bn: "অ্যাবাকাস", en: "Abacus", icon: Calculator },
      { id: "badges", bn: "ব্যাজ", en: "Badges", icon: Award },
      { id: "gallery", bn: "গ্যালারি", en: "Gallery", icon: ImageIcon },
      { id: "challenges", bn: "চ্যালেঞ্জ", en: "Challenges", icon: Target },
      { id: "ebooks", bn: "ই-বুক", en: "Ebooks", icon: BookOpen },
      { id: "physical-items", bn: "শপ প্রোডাক্ট", en: "Shop Products", icon: ShoppingBag },
    ],
  },
  {
    bn: "মানুষজন", en: "People",
    items: [
      { id: "users", bn: "ইউজার", en: "Users", icon: Users },
      { id: "instructors", bn: "ইন্সট্রাক্টর", en: "Instructors", icon: Users },
    ],
  },
  {
    bn: "বাণিজ্য", en: "Commerce",
    items: [
      { id: "orders", bn: "অর্ডার", en: "Orders", icon: ShoppingBag },
      { id: "shipments", bn: "শিপমেন্ট", en: "Shipments", icon: Truck },
      { id: "coupons", bn: "কুপন", en: "Coupons", icon: Tag },
      { id: "fraud-config", bn: "ফ্রড সেটিংস", en: "Fraud Config", icon: Shield },
      { id: "fraud-dashboard", bn: "ফ্রড ড্যাশবোর্ড", en: "Fraud Dashboard", icon: BarChart3 },
    ],
  },
  {
    bn: "সাইট", en: "Site",
    items: [
      { id: "homepage", bn: "হোমপেজ", en: "Homepage", icon: Home },
      { id: "settings", bn: "সেটিংস", en: "Settings", icon: Settings },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { locale, setLocale } = useLocaleStore();
  const { settings } = useSiteStore();
  
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    const roles = user?.roles || [];
    if (!roles.some((r: string) => ["super_admin", "admin"].includes(r))) {
      router.push("/dashboard");
      return;
    }
    setLoading(false);
  }, [mounted, isAuthenticated, user, router]);

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  // Standalone routes inside /admin that must skip the sidebar + top header
  // (e.g. the printable invoice). Still auth-protected by the checks above.
  const isStandaloneRoute = pathname?.endsWith("/invoice") || false;
  if (isStandaloneRoute) {
    return <>{children}</>;
  }

  // Active tab derivation logic
  const queryTab = searchParams?.get("tab");
  let activeTab = queryTab || "dashboard";
  if (pathname?.includes("/admin/courses")) activeTab = "courses";
  if (pathname?.includes("/admin/exams")) activeTab = "exams";
  if (pathname?.includes("/admin/games")) activeTab = "games";
  if (pathname?.includes("/admin/abacus")) activeTab = "abacus";
  if (pathname?.includes("/admin/users")) activeTab = "users";

  const isTabVisible = (id: string) => settings.feature_flags[id] !== false;

  const handleTabClick = (tabId: string) => {
    if (pathname === "/admin") {
      router.push(`/admin?tab=${tabId}`, { scroll: false });
    } else {
      router.push(`/admin?tab=${tabId}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar - Desktop */}
      <aside className="w-64 bg-[#1a1025] text-white min-h-screen p-5 hidden md:flex flex-col">
        <div className="flex items-center gap-2 mb-8">
          <Settings className="w-6 h-6 text-[#ffce39]" />
          <span className="text-lg font-bold">Admin Panel</span>
        </div>

        <nav className="space-y-4">
          {sidebarGroups.map((group, gi) => (
            <div key={gi}>
              {group.bn && (
                <p className="px-4 mb-2 pt-1 text-xs font-semibold text-white/40 uppercase tracking-wider">
                  {locale === "bn" ? group.bn : group.en}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.filter((tab) => isTabVisible(tab.id)).map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabClick(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all text-left ${
                        isActive
                          ? "bg-white/10 text-white"
                          : "text-white/50 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      {locale === "bn" ? tab.bn : tab.en}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto pt-8">
          <Link href="/" className="flex items-center gap-2 text-white/40 text-sm hover:text-white/70 transition-colors">
            <ChevronRight className="w-4 h-4 rotate-180" /> {locale === "bn" ? "ওয়েবসাইটে ফিরুন" : "Back to Website"}
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 text-primary-700 hover:text-primary-800 transition-colors">
              <GraduationCap className="w-5 h-5" />
              <span className="font-bold text-sm hidden sm:block">Hate Kolom</span>
            </Link>
            <span className="text-gray-200">|</span>
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Admin Panel</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocale(locale === "bn" ? "en" : "bn")}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-gray-200 hover:bg-gray-50 transition-colors"
              title="Switch language"
            >
              {locale === "bn" ? "EN" : "বাং"}
            </button>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-gray-900">{user?.full_name}</p>
              <p className="text-[10px] text-gray-400">{user?.roles?.join(", ")}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-xs font-bold text-primary-700">
                {user?.full_name?.[0]?.toUpperCase() || "A"}
              </span>
            </div>
            <button
              onClick={() => { logout(); window.location.href = "/login"; }}
              className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dynamic Mobile Tabs below header if on /admin index */}
        {pathname === "/admin" && (
          <div className="md:hidden flex gap-1 overflow-x-auto p-4 shrink-0 bg-gray-50">
            {sidebarGroups.flatMap((g) => g.items).filter((tab) => isTabVisible(tab.id)).map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
                  activeTab === tab.id
                    ? "bg-primary-700 text-white"
                    : "bg-white text-gray-600 border border-gray-200"
                }`}
              >
                {locale === "bn" ? tab.bn : tab.en}
              </button>
            ))}
          </div>
        )}

        {/* Scrollable Content Container */}
        <div className="flex-1 overflow-y-auto relative bg-gray-50">
          {children}
        </div>
      </main>
    </div>
  );
}
