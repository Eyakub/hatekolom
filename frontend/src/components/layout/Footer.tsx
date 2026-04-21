"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { GraduationCap, Phone, Facebook, Youtube, Instagram, Linkedin } from "lucide-react";
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
    ? (locale === "bn" ? settings.footer_description_bn : settings.footer_description_en)
    : settings.footer_description_bn;

  return (
    <footer className="bg-[#1a1025] text-white/80 pt-12 pb-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              {settings.logo_url ? (
                <img src={settings.logo_url} alt={settings.platform_name} className="h-8 w-auto object-contain" />
              ) : (
                <GraduationCap className="w-7 h-7 text-[#ffce39]" />
              )}
              <span className="text-lg font-bold text-white">{settings.platform_name}</span>
            </div>
            <p className="text-sm text-white/50 font-bn leading-relaxed">
               {footerDesc}
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold text-white mb-4 font-bn">{t("এক্সপ্লোর", "Explore")}</h4>
            <ul className="space-y-2.5 text-sm">
              {[
                ["/courses", t("সকল কোর্স", "All Courses")],
                ["/courses?type=free", t("ফ্রি কোর্স", "Free Courses")],
                ["/ebooks", t("ই-বুক", "Ebooks")],
                ["/about", t("আমাদের সম্পর্কে", "About Us")],
              ].map(([href, label]) => (
                <motion.li key={href} whileHover={{ x: 6 }} transition={{ type: "spring", stiffness: 300, damping: 15 }}>
                  <Link href={href} className="hover:text-[#ffce39] transition-colors font-bn inline-block">
                    {label}
                  </Link>
                </motion.li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4 font-bn">{t("সাপোর্ট", "Support")}</h4>
            <ul className="space-y-2.5 text-sm">
              {[
                ["/faq", t("সাধারণ জিজ্ঞাসা", "FAQ")],
                ["/refund", t("রিফান্ড নীতি", "Refund Policy")],
                ["/privacy", t("গোপনীয়তা নীতি", "Privacy Policy")],
                ["/terms", t("সেবার শর্ত", "Terms of Service")],
              ].map(([href, label]) => (
                <motion.li key={href} whileHover={{ x: 6 }} transition={{ type: "spring", stiffness: 300, damping: 15 }}>
                  <Link href={href} className="hover:text-[#ffce39] transition-colors font-bn inline-block">
                    {label}
                  </Link>
                </motion.li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-white mb-4 font-bn">{t("যোগাযোগ", "Contact")}</h4>
            <div className="space-y-3 text-sm">
              <a href={`tel:${settings.support_phone}`} className="flex items-center gap-2 hover:text-[#ffce39] transition-colors">
                <Phone className="w-4 h-4" /> {settings.support_phone}
              </a>
              <p className="text-white/40 text-xs font-bn">{t("সকাল ৯টা - রাত ১০টা", "9 AM - 10 PM")}</p>
              <div className="flex flex-wrap gap-3 pt-2">
                {settings.facebook_url && (
                  <motion.a whileHover={{ y: -4, scale: 1.15, rotate: -8 }} whileTap={{ scale: 0.9 }} href={settings.facebook_url} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#ffce39] hover:text-[#1a1025] transition-colors">
                    <Facebook className="w-4 h-4" />
                  </motion.a>
                )}
                {settings.youtube_url && (
                  <motion.a whileHover={{ y: -4, scale: 1.15, rotate: 8 }} whileTap={{ scale: 0.9 }} href={settings.youtube_url} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#ffce39] hover:text-[#1a1025] transition-colors">
                    <Youtube className="w-4 h-4" />
                  </motion.a>
                )}
                {settings.instagram_url && (
                  <motion.a whileHover={{ y: -4, scale: 1.15, rotate: -8 }} whileTap={{ scale: 0.9 }} href={settings.instagram_url} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#ffce39] hover:text-[#1a1025] transition-colors">
                    <Instagram className="w-4 h-4" />
                  </motion.a>
                )}
                {settings.linkedin_url && (
                  <motion.a whileHover={{ y: -4, scale: 1.15, rotate: 8 }} whileTap={{ scale: 0.9 }} href={settings.linkedin_url} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#ffce39] hover:text-[#1a1025] transition-colors">
                    <Linkedin className="w-4 h-4" />
                  </motion.a>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/30">
          <p>© {new Date().getFullYear()} {settings.platform_name}. All rights reserved.</p>
          <p>
            Crafted by{" "}
            <a
              href="https://eyakub.github.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/50 hover:text-[#ffce39] transition-colors font-semibold"
            >
              Eyakub
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
