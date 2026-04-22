"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Phone, Facebook, Youtube, Instagram, Linkedin, Mail, MapPin, Heart, ArrowUpRight } from "lucide-react";
import { useLocaleStore } from "@/stores/locale-store";
import { useSiteStore } from "@/stores/site-store";
import { motion } from "motion/react";

export function Footer() {
  const { locale, t: tRaw } = useLocaleStore();
  const { settings } = useSiteStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Before hydration always return Bengali to match SSR output
  const t = (bn: string, en: string) => (mounted ? tRaw(bn, en) : bn);
  const footerDesc = mounted
    ? t(
        "শিশুদের জন্য মজার স্টিকার বই, কালারিং বুক ও শিক্ষামূলক বই — সাথে অনলাইন এক্সাম। হাতে কলম দিয়ে শেখা শুরু হোক!",
        "Fun sticker books, coloring books & educational materials for kids — with online exams. Let the learning begin with Hate Kolom!"
      )
    : "শিশুদের জন্য মজার স্টিকার বই, কালারিং বুক ও শিক্ষামূলক বই — সাথে অনলাইন এক্সাম। হাতে কলম দিয়ে শেখা শুরু হোক!";

  const socialLinks = [
    { url: settings.facebook_url, icon: Facebook, label: "Facebook" },
    { url: settings.youtube_url, icon: Youtube, label: "YouTube" },
    { url: settings.instagram_url, icon: Instagram, label: "Instagram" },
    { url: settings.linkedin_url, icon: Linkedin, label: "LinkedIn" },
  ].filter((s) => s.url);

  return (
    <footer className="relative bg-gradient-to-b from-[#0a1e36] via-[#0f2b4a] to-[#0a1929] text-white/80 overflow-hidden">
      {/* Subtle decorative elements */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-8">
        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8 mb-12">
          {/* Brand Column */}
          <div className="md:col-span-4">
            <div className="mb-5">
              <img src="/logo_white.png" alt={settings.platform_name} className="h-10 w-auto object-contain" />
            </div>
            <p className="text-sm text-blue-200/60 font-bn leading-relaxed max-w-xs mb-6">
              {footerDesc}
            </p>

            {/* Social Icons */}
            {socialLinks.length > 0 && (
              <div className="flex gap-2.5">
                {socialLinks.map(({ url, icon: Icon, label }) => (
                  <motion.a
                    key={label}
                    whileHover={{ y: -3, scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-xl bg-white/[0.07] border border-white/[0.08] flex items-center justify-center text-blue-200/70 hover:bg-blue-500 hover:text-white hover:border-blue-400 transition-all duration-300"
                    aria-label={label}
                  >
                    <Icon className="w-4 h-4" />
                  </motion.a>
                ))}
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="md:col-span-2 md:col-start-6">
            <h4 className="text-xs font-bold text-blue-300/80 uppercase tracking-[0.15em] mb-5 font-bn">
              {t("এক্সপ্লোর", "Explore")}
            </h4>
            <ul className="space-y-3 text-sm">
              {[
                ["/shop", t("শপ", "Shop")],
                ["/exams", t("পরীক্ষা", "Exams")],
                ["/about", t("আমাদের সম্পর্কে", "About Us")],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="group flex items-center gap-1.5 text-blue-100/60 hover:text-white transition-colors font-bn">
                    <span>{label}</span>
                    <ArrowUpRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support Links */}
          <div className="md:col-span-2">
            <h4 className="text-xs font-bold text-blue-300/80 uppercase tracking-[0.15em] mb-5 font-bn">
              {t("সাপোর্ট", "Support")}
            </h4>
            <ul className="space-y-3 text-sm">
              {[
                ["/faq", t("সাধারণ জিজ্ঞাসা", "FAQ")],
                ["/refund", t("রিফান্ড নীতি", "Refund Policy")],
                ["/privacy", t("গোপনীয়তা নীতি", "Privacy Policy")],
                ["/terms", t("সেবার শর্ত", "Terms of Service")],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="group flex items-center gap-1.5 text-blue-100/60 hover:text-white transition-colors font-bn">
                    <span>{label}</span>
                    <ArrowUpRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Column */}
          <div className="md:col-span-3 md:col-start-10">
            <h4 className="text-xs font-bold text-blue-300/80 uppercase tracking-[0.15em] mb-5 font-bn">
              {t("যোগাযোগ", "Contact")}
            </h4>
            <div className="space-y-4">
              <a
                href={`tel:${settings.support_phone}`}
                className="flex items-start gap-3 group"
              >
                <div className="w-8 h-8 rounded-lg bg-white/[0.07] border border-white/[0.08] flex items-center justify-center shrink-0 group-hover:bg-blue-500 group-hover:border-blue-400 transition-all">
                  <Phone className="w-3.5 h-3.5 text-blue-300/70 group-hover:text-white transition-colors" />
                </div>
                <div>
                  <p className="text-sm text-blue-100/80 group-hover:text-white transition-colors font-medium">{settings.support_phone}</p>
                  <p className="text-[11px] text-blue-200/40 font-bn mt-0.5">{t("সকাল ৯টা - রাত ১০টা", "9 AM - 10 PM")}</p>
                </div>
              </a>

              {settings.support_email && (
                <a
                  href={`mailto:${settings.support_email}`}
                  className="flex items-center gap-3 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/[0.07] border border-white/[0.08] flex items-center justify-center shrink-0 group-hover:bg-blue-500 group-hover:border-blue-400 transition-all">
                    <Mail className="w-3.5 h-3.5 text-blue-300/70 group-hover:text-white transition-colors" />
                  </div>
                  <p className="text-sm text-blue-100/80 group-hover:text-white transition-colors">{settings.support_email}</p>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/[0.06] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-blue-200/30 tracking-wide">
            © {new Date().getFullYear()} {settings.platform_name}. All rights reserved.
          </p>
          <p className="text-[11px] text-blue-200/30 flex items-center gap-1 tracking-wide">
            Crafted with <Heart className="w-3 h-3 text-red-400/60 fill-red-400/60" /> by{" "}
            <a
              href="https://eyakub.github.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-200/50 hover:text-blue-300 transition-colors font-semibold"
            >
              Eyakub
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
