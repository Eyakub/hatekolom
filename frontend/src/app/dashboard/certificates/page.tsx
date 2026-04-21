"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Award, ExternalLink, Loader2, Shield, Download } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useLocaleStore } from "@/stores/locale-store";
import { api } from "@/lib/api";

export default function CertificatesPage() {
  const { accessToken, _hasHydrated, isAuthenticated } = useAuthStore();
  const { locale, t: tRaw } = useLocaleStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const t = (bn: string, en: string) => (mounted ? tRaw(bn, en) : bn);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated || !accessToken) {
      setLoading(false);
      return;
    }
    
    const loadCerts = async () => {
      try {
        const data: any = await api.get("/certificates/my", accessToken);
        setCertificates(data || []);
      } catch {
        // ignore
      }
      setLoading(false);
    };
    
    loadCerts();
  }, [_hasHydrated, isAuthenticated, accessToken]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Award className="w-6 h-6 text-primary-600" />
          {t("আমার সার্টিফিকেট", "My Certificates")}
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          {t("তোমার বা তোমার সন্তানের অর্জিত সকল সার্টিফিকেট", "All certificates earned by you or your children")}
        </p>
      </div>

      {certificates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
          <Award className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-400">
            {t("এখনো কোনো সার্টিফিকেট পাওয়া যায়নি", "No certificates found yet")}
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            {t("কোর্স সম্পন্ন করে সার্টিফিকেট অর্জন করো", "Complete a course to earn a certificate")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {certificates.map((cert: any) => {
            const issuedDate = new Date(cert.issued_at).toLocaleDateString(
              locale === "bn" ? "bn-BD" : "en-US",
              { year: "numeric", month: "long", day: "numeric" }
            );
            return (
              <div
                key={cert.id}
                className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-lg transition-all flex flex-col h-full group"
              >
                {/* Top accent */}
                <div className="h-1.5 bg-gradient-to-r from-primary-500 to-primary-700" />

                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start gap-3.5 mb-4 flex-1">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center shrink-0 border border-amber-200/50">
                      <Award className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-900 line-clamp-2 leading-tight group-hover:text-primary-700 transition-colors">
                        {cert.course_title}
                      </p>
                      <p className="text-xs text-gray-500 mt-1.5">
                        {t("শিক্ষার্থী:", "Student:")} <span className="font-semibold text-gray-700">{cert.student_name}</span>
                      </p>
                    </div>
                  </div>

                  {/* Cert number */}
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="w-3 h-3 text-primary-400" />
                    <p className="text-[10px] text-gray-500 font-mono bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-md tracking-wider">
                      {cert.certificate_number}
                    </p>
                  </div>

                  {/* Footer */}
                  <div className="pt-3 border-t border-gray-50 flex items-center justify-between mt-auto">
                    <p className="text-[11px] text-gray-400">
                      {issuedDate}
                    </p>
                    <Link 
                      href={`/verify?cert=${cert.certificate_number}`} 
                      className="px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-xs font-bold hover:bg-primary-100 transition-all flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" /> {t("যাচাই", "Verify")}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
