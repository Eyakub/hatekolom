"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect, useRef } from "react";
import { Search, Globe, ChevronDown, LayoutDashboard, UserPlus, User, LogOut, X, Menu, GraduationCap, ShoppingBag } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useLocaleStore } from "@/stores/locale-store";
import { useSiteStore } from "@/stores/site-store";
import { SearchBar } from "./SearchBar";
import { motion, AnimatePresence } from "motion/react";
import { useCartStore } from "@/stores/cart-store";
import { CartDrawer } from "@/components/shop/CartDrawer";

export function Navbar() {
  return (
    <Suspense fallback={<div className="h-[72px] w-full bg-white/90 border-b border-gray-100/50" />}>
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
    { href: "/courses", label: mounted ? t("কোর্স", "Courses") : "কোর্স" },
    { href: "/exams", label: mounted ? t("পরীক্ষা", "Exams") : "পরীক্ষা" },
    { href: "/ebooks", label: mounted ? t("ই-বুক", "E-Books") : "ই-বুক" },
    { href: "/shop", label: mounted ? t("শপ", "Shop") : "শপ" },
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
      <nav className="sticky top-0 z-50 bg-white/40 backdrop-blur-xl backdrop-saturate-150 border-b border-gray-200/30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 h-16 relative">
          {/* Mobile expanded search overlay */}
          {mobileSearchOpen && (
            <div className="md:hidden absolute inset-0 z-30 flex items-center px-3 bg-white/95 backdrop-blur-xl animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
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
                  className="w-full pl-9 pr-10 py-2.5 text-sm bg-gray-100 border border-gray-200 rounded-xl focus:outline-none focus:border-primary-300 focus:bg-white focus:shadow-sm transition-all placeholder:text-gray-400 font-bn"
                  autoFocus
                />
              </div>
              <button
                onClick={() => { setMobileSearchOpen(false); setMobileQuery(""); }}
                className="ml-2 p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
                aria-label="Close search"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt={settings.platform_name} className="h-8 w-auto object-contain" />
            ) : (
              <GraduationCap className="w-8 h-8 text-primary-700" />
            )}
            <span className="text-xl font-bold font-[family-name:var(--font-display)] text-primary-800">
              {settings.platform_name}
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1 shrink-0">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-4 py-2 rounded-xl text-sm font-medium transition-colors font-bn whitespace-nowrap ${
                    active ? "text-primary-800" : "text-gray-600 hover:text-primary-700 hover:bg-gray-50/50"
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="navbar-indicator"
                      className="absolute inset-0 bg-primary-50 rounded-xl -z-10 shadow-sm border border-primary-100"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  {link.label}
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
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-gray-600"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </button>
            {/* Cart icon */}
            <button
              onClick={() => setCartOpen(true)}
              className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-gray-600"
              aria-label="Cart"
            >
              <ShoppingBag className="w-4 h-4" />
              {mounted && cartTotalItems() > 0 && (
                <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px]">
                  {cartTotalItems()}
                </span>
              )}
            </button>
            {/* Language toggle — desktop only */}
            <button
              onClick={() => setLocale(locale === "bn" ? "en" : "bn")}
              className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-xs font-semibold text-gray-600"
              title={locale === "bn" ? "Switch to English" : "বাংলায় পরিবর্তন করুন"}
            >
              <Globe className="w-3.5 h-3.5" />
              {locale === "bn" ? "EN" : "বাং"}
            </button>
            {isAuthenticated && user ? (
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary-700">
                      {user.full_name?.[0]?.toUpperCase() || "U"}
                    </span>
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-24 truncate">
                    {user.full_name}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
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
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-gray-100 py-2 z-50 origin-top-right overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/50">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {user.full_name}
                        </p>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">{user.phone}</p>
                      </div>
                      <div className="py-1">
                        {!user.roles?.some((r) => ["super_admin", "admin"].includes(r)) && (
                          <Link
                            href="/dashboard"
                            className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors font-bn"
                            onClick={() => setProfileOpen(false)}
                          >
                            <LayoutDashboard className="w-4 h-4" />
                            {t("ড্যাশবোর্ড", "Dashboard")}
                          </Link>
                        )}
                        <Link
                          href="/dashboard/profile"
                          className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors font-bn"
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
                            className="flex items-center gap-2 px-4 py-2.5 text-sm text-amber-600 hover:bg-amber-50 transition-colors font-bold"
                            onClick={() => setProfileOpen(false)}
                          >
                            <LayoutDashboard className="w-4 h-4" />
                            Admin Panel
                          </Link>
                        )}
                      </div>
                      <div className="border-t border-gray-50 pt-1">
                        <button
                          onClick={() => {
                            logout();
                            setProfileOpen(false);
                            window.location.href = "/";
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors font-semibold"
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
                  className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary-700 transition-colors font-bn"
                >
                  {t("লগইন", "Login")}
                </Link>
                <Link
                  href="/register"
                  className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 bg-primary-700 text-white text-sm font-semibold rounded-full hover:bg-primary-800 transition-all hover:shadow-lg hover:shadow-primary-700/25 active:scale-95 font-bn"
                >
                  {t("রেজিস্ট্রেশন", "Register")}
                </Link>
                {/* Mobile: compact icon button → login */}
                <Link
                  href="/login"
                  className="sm:hidden flex items-center justify-center w-9 h-9 rounded-full bg-primary-700 text-white hover:bg-primary-800 transition-all active:scale-95"
                  aria-label="Login / Register"
                >
                  <UserPlus className="w-4 h-4" />
                </Link>
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2"
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
          <div className="md:hidden fixed top-0 right-0 z-50 h-full w-[280px] max-w-[85vw] bg-white/95 backdrop-blur-xl shadow-2xl animate-in slide-in-from-right duration-300">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 h-16 border-b border-gray-100">
              <span className="text-lg font-bold font-[family-name:var(--font-display)] text-primary-800">
                {settings.platform_name}
              </span>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer content */}
            <div className="px-4 py-5 space-y-1 overflow-y-auto h-[calc(100%-64px)]">
              {/* Search */}
              <div className="pb-3 mb-2 border-b border-gray-100">
                <SearchBar />
              </div>

              {/* Nav links */}
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block px-4 py-3 rounded-xl text-sm font-semibold transition-colors font-bn ${
                    isActive(link.href)
                      ? "bg-primary-50 text-primary-700"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}

              {/* Divider */}
              <div className="my-3 border-t border-gray-100" />

              {/* Language toggle */}
              <button
                onClick={() => setLocale(locale === "bn" ? "en" : "bn")}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Globe className="w-4.5 h-4.5 text-gray-400" />
                {locale === "bn" ? "Switch to English" : "বাংলায় পরিবর্তন করুন"}
              </button>

              {/* Auth links for mobile (when not logged in) */}
              {!isAuthenticated && (
                <>
                  <div className="my-3 border-t border-gray-100" />
                  <Link
                    href="/login"
                    className="block px-4 py-3 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors font-bn"
                    onClick={() => setMobileOpen(false)}
                  >
                    {t("লগইন", "Login")}
                  </Link>
                  <Link
                    href="/register"
                    className="block px-4 py-3 rounded-xl text-sm font-semibold text-center bg-primary-700 text-white hover:bg-primary-800 transition-all font-bn"
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
