"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect, useRef } from "react";
import { Search, Globe, ChevronDown, LayoutDashboard, UserPlus, User, LogOut, X, Menu, GraduationCap, ShoppingBag, BookOpen } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useLocaleStore } from "@/stores/locale-store";
import { useSiteStore } from "@/stores/site-store";
import { SearchBar } from "./SearchBar";
import { motion, AnimatePresence } from "motion/react";
import { useCartStore } from "@/stores/cart-store";
import { CartDrawer } from "@/components/shop/CartDrawer";

export function Navbar() {
  return (
    <Suspense fallback={<div className="h-[72px] w-full bg-[#1a3a5c]" />}>
      <NavbarContent />
    </Suspense>
  );
}

function NavbarContent() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { locale, setLocale, t } = useLocaleStore();
  const { settings } = useSiteStore();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileQuery, setMobileQuery] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const cartTotalItems = useCartStore((s) => s.totalItems);
  const mobileSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  const navLinks = [
    { href: "/shop", label: mounted ? t("শপ", "Shop") : "শপ" },
    { href: "/exams", label: mounted ? t("পরীক্ষা", "Exams") : "পরীক্ষা" },
  ];

  const isActive = (href: string) => {
    const [base, query] = href.split("?");
    if (pathname !== base) return false;
    
    if (query) {
      const urlParams = new URLSearchParams(query);
      const expectedType = urlParams.get("type");
      const currentType = searchParams?.get("type");
      
      // If the nav link expects a specific type, check if it perfectly matches the URL query
      if (expectedType && currentType !== expectedType) {
        return false;
      }
    }
    
    return true;
  };

  if (!mounted) return null;

  return (
    <>
      <nav className="sticky top-0 z-50 bg-gradient-to-r from-[#0f2b4a] via-[#1a3f6f] to-[#0f2b4a] shadow-lg shadow-blue-900/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 h-16 relative">
          {/* Mobile expanded search overlay */}
          {mobileSearchOpen && (
            <div className="md:hidden absolute inset-0 z-30 flex items-center px-3 bg-[#1a3f6f]/95 backdrop-blur-xl animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300 pointer-events-none" />
                <input
                  ref={mobileSearchRef}
                  type="text"
                  value={mobileQuery}
                  onChange={(e) => setMobileQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && mobileQuery.trim()) {
                      router.push(`/search?q=${encodeURIComponent(mobileQuery.trim())}`);
                      setMobileSearchOpen(false);
                      setMobileQuery("");
                    } else if (e.key === "Escape") {
                      setMobileSearchOpen(false);
                      setMobileQuery("");
                    }
                  }}
                  placeholder={t("কোর্স বা ই-বুক খুঁজুন...", "Search courses or books...")}
                  className="w-full pl-9 pr-10 py-2.5 text-sm bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:border-blue-300 focus:bg-white/15 transition-all placeholder:text-blue-200/60 text-white font-bn"
                  autoFocus
                />
              </div>
              <button
                onClick={() => { setMobileSearchOpen(false); setMobileQuery(""); }}
                className="ml-2 p-2 rounded-lg hover:bg-white/10 transition-colors text-blue-200"
                aria-label="Close search"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <img src="/logo_white.png" alt={settings.platform_name} className="h-9 w-auto object-contain" />
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-0.5 shrink-0">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 font-bn whitespace-nowrap ${
                    active
                      ? "text-white"
                      : "text-blue-100/80 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="navbar-indicator"
                      className="absolute inset-0 bg-white/15 rounded-lg -z-10 border border-white/20"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  {link.label}
                  {active && (
                    <motion.div
                      layoutId="navbar-underline"
                      className="absolute bottom-0 left-3 right-3 h-0.5 bg-gradient-to-r from-blue-300 to-cyan-300 rounded-full"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Search — desktop, grows to fill space */}
          <div className="hidden md:flex flex-1 justify-center px-2">
            <SearchBar />
          </div>

          {/* Language toggle + Auth */}
          <div className="flex items-center gap-2 shrink-0 ml-auto md:ml-0">
            {/* Search icon — mobile only, expands inline */}
            <button
              onClick={() => {
                setMobileSearchOpen(true);
                setTimeout(() => mobileSearchRef.current?.focus(), 100);
              }}
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-blue-100"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </button>
            {/* Cart icon */}
            <button
              onClick={() => setCartOpen(true)}
              className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-blue-100"
              aria-label="Cart"
            >
              <ShoppingBag className="w-4 h-4" />
              {mounted && cartTotalItems() > 0 && (
                <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-amber-400 text-blue-900 text-[9px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px]">
                  {cartTotalItems()}
                </span>
              )}
            </button>
            {/* Language toggle — desktop only */}
            <button
              onClick={() => setLocale(locale === "bn" ? "en" : "bn")}
              className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-xs font-semibold text-blue-100"
              title={locale === "bn" ? "Switch to English" : "বাংলায় পরিবর্তন করুন"}
            >
              <Globe className="w-3.5 h-3.5" />
              {locale === "bn" ? "EN" : "বাং"}
            </button>
            {isAuthenticated && user ? (
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center shadow-md shadow-blue-500/20">
                    <span className="text-sm font-bold text-white">
                      {user.full_name?.[0]?.toUpperCase() || "U"}
                    </span>
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-blue-50 max-w-24 truncate">
                    {user.full_name}
                  </span>
                  <ChevronDown className="w-4 h-4 text-blue-200" />
                </button>

                <AnimatePresence>
                {profileOpen && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-40"
                      onClick={() => setProfileOpen(false)}
                    />
                    <motion.div 
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28 }}
                      className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] border border-gray-100/80 z-50 origin-top-right overflow-hidden"
                    >
                      {/* Compact header */}
                      <div className="px-4 py-3 bg-gradient-to-r from-[#0f2b4a] to-[#1a3f6f]">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                            <span className="text-sm font-bold text-white">{user.full_name?.[0]?.toUpperCase() || "U"}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{user.full_name}</p>
                            <p className="text-[11px] text-blue-200/70 truncate">{user.phone}</p>
                          </div>
                        </div>
                      </div>

                      {/* Menu */}
                      <div className="p-1.5">
                        {!user.roles?.some((r) => ["super_admin", "admin"].includes(r)) && (
                          <Link
                            href="/dashboard"
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors font-bn"
                            onClick={() => setProfileOpen(false)}
                          >
                            <LayoutDashboard className="w-4 h-4" />
                            {t("ড্যাশবোর্ড", "Dashboard")}
                          </Link>
                        )}
                        <Link
                          href="/dashboard/profile"
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors font-bn"
                          onClick={() => setProfileOpen(false)}
                        >
                          <User className="w-4 h-4" />
                          {t("প্রোফাইল", "Profile")}
                        </Link>
                        {user.roles?.some((r) =>
                          ["super_admin", "admin"].includes(r)
                        ) && (
                          <Link
                            href="/admin"
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-amber-600 hover:bg-amber-50 transition-colors font-bold"
                            onClick={() => setProfileOpen(false)}
                          >
                            <LayoutDashboard className="w-4 h-4" />
                            Admin Panel
                          </Link>
                        )}
                      </div>

                      <div className="px-1.5 pb-1.5">
                        <div className="border-t border-gray-100 mb-1.5" />
                        <button
                          onClick={() => {
                            logout();
                            setProfileOpen(false);
                            window.location.href = "/";
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-red-500 hover:bg-red-50 transition-colors font-medium"
                        >
                          <LogOut className="w-4 h-4" />
                          {t("লগআউট", "Logout")}
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {/* Desktop: full text buttons */}
                <Link
                  href="/login"
                  className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-blue-100 hover:text-white transition-colors font-bn"
                >
                  {t("লগইন", "Login")}
                </Link>
                <Link
                  href="/register"
                  className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 text-blue-900 text-sm font-bold rounded-full hover:from-amber-300 hover:to-amber-400 transition-all hover:shadow-lg hover:shadow-amber-400/30 active:scale-95 font-bn"
                >
                  {t("রেজিস্ট্রেশন", "Register")}
                </Link>
                {/* Mobile: compact icon button → login */}
                <Link
                  href="/login"
                  className="sm:hidden flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-blue-900 hover:from-amber-300 hover:to-amber-400 transition-all active:scale-95"
                  aria-label="Login / Register"
                >
                  <UserPlus className="w-4 h-4" />
                </Link>
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 text-blue-100 hover:bg-white/10 rounded-lg transition-colors"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>

    {/* Mobile drawer overlay */}
    {mobileOpen && (
        <>
          {/* Blurry backdrop */}
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          {/* Slide-in drawer from right */}
          <div className="md:hidden fixed top-0 right-0 z-50 h-full w-[280px] max-w-[85vw] bg-gradient-to-b from-[#0f2b4a] to-[#1a3f6f] shadow-2xl animate-in slide-in-from-right duration-300">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 h-16 border-b border-white/10">
              <span className="text-lg font-bold font-[family-name:var(--font-display)] text-white">
                {settings.platform_name}
              </span>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors text-blue-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer content */}
            <div className="px-4 py-5 space-y-1 overflow-y-auto h-[calc(100%-64px)]">
              {/* Search */}
              <div className="pb-3 mb-2 border-b border-white/10">
                <SearchBar />
              </div>

              {/* Nav links */}
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block px-4 py-3 rounded-xl text-sm font-semibold transition-colors font-bn ${
                    isActive(link.href)
                      ? "bg-white/15 text-white"
                      : "text-blue-100/80 hover:bg-white/10 hover:text-white"
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}

              {/* Divider */}
              <div className="my-3 border-t border-white/10" />

              {/* Language toggle */}
              <button
                onClick={() => setLocale(locale === "bn" ? "en" : "bn")}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-blue-100/80 hover:bg-white/10 hover:text-white transition-colors"
              >
                <Globe className="w-4.5 h-4.5 text-blue-300" />
                {locale === "bn" ? "Switch to English" : "বাংলায় পরিবর্তন করুন"}
              </button>

              {/* Auth links for mobile (when not logged in) */}
              {!isAuthenticated && (
                <>
                  <div className="my-3 border-t border-white/10" />
                  <Link
                    href="/login"
                    className="block px-4 py-3 rounded-xl text-sm font-semibold text-blue-100/80 hover:bg-white/10 hover:text-white transition-colors font-bn"
                    onClick={() => setMobileOpen(false)}
                  >
                    {t("লগইন", "Login")}
                  </Link>
                  <Link
                    href="/register"
                    className="block px-4 py-3 rounded-xl text-sm font-semibold text-center bg-gradient-to-r from-amber-400 to-amber-500 text-blue-900 hover:from-amber-300 hover:to-amber-400 transition-all font-bn"
                    onClick={() => setMobileOpen(false)}
                  >
                    {t("রেজিস্ট্রেশন", "Register")}
                  </Link>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Cart Drawer */}
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
