"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Search, CheckCircle2, XCircle, Shield,
  Award, BookOpen, Calendar, Loader2, Download, Share2,
  LayoutGrid, Copy, ExternalLink
} from "lucide-react";
import { api } from "@/lib/api";

/* ── Mini Certificate Preview ─────────────────────────────── */
function CertificatePreview({ result }: { result: any }) {
  if (!result || !result.valid) return null;

  const issuedDate = new Date(result.issued_at).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="mt-10 print:mt-0">
      {/* Section Label */}
      <div className="flex items-center gap-3 mb-5 print:hidden">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-[10px] text-gray-400 font-bold tracking-[0.25em] uppercase">
          Document Preview
        </span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      {/* Certificate Card */}
      <div
        id="printable-certificate"
        className="rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.1)] overflow-hidden mx-auto max-w-[720px] print:max-w-none print:shadow-none print:rounded-none"
      >
        {/* Outer gradient border frame */}
        <div className="bg-gradient-to-br from-primary-700 via-primary-600 to-amber-500 p-[3px] rounded-3xl print:p-0 print:rounded-none">
          <div className="bg-[#FDFBF7] rounded-[22px] print:rounded-none relative overflow-hidden">

            {/* ── Background Decorations ────────────────── */}

            {/* Huge watermark logo in center */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.035]">
              <svg width="400" height="400" viewBox="0 0 100 100" fill="currentColor" className="text-primary-900">
                <path d="M50 5 L61 35 L93 35 L67 55 L76 87 L50 68 L24 87 L33 55 L7 35 L39 35 Z" />
              </svg>
            </div>

            {/* Top-left decorative rosette */}
            <div className="absolute top-0 left-0 pointer-events-none opacity-[0.06]">
              <svg width="200" height="200" viewBox="0 0 200 200">
                <circle cx="0" cy="0" r="180" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-primary-700" />
                <circle cx="0" cy="0" r="140" fill="none" stroke="currentColor" strokeWidth="0.3" className="text-primary-700" />
                <circle cx="0" cy="0" r="100" fill="none" stroke="currentColor" strokeWidth="0.3" className="text-primary-700" />
              </svg>
            </div>

            {/* Bottom-right decorative rosette */}
            <div className="absolute bottom-0 right-0 pointer-events-none opacity-[0.06]">
              <svg width="200" height="200" viewBox="0 0 200 200">
                <circle cx="200" cy="200" r="180" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-amber-700" />
                <circle cx="200" cy="200" r="140" fill="none" stroke="currentColor" strokeWidth="0.3" className="text-amber-700" />
                <circle cx="200" cy="200" r="100" fill="none" stroke="currentColor" strokeWidth="0.3" className="text-amber-700" />
              </svg>
            </div>

            {/* Corner ornaments — top-left */}
            <div className="absolute top-5 left-5 w-14 h-14 border-t-[2.5px] border-l-[2.5px] border-primary-400/40 rounded-tl-sm" />
            <div className="absolute top-7 left-7 w-10 h-10 border-t-[1px] border-l-[1px] border-primary-300/30" />
            {/* Corner ornaments — top-right */}
            <div className="absolute top-5 right-5 w-14 h-14 border-t-[2.5px] border-r-[2.5px] border-primary-400/40 rounded-tr-sm" />
            <div className="absolute top-7 right-7 w-10 h-10 border-t-[1px] border-r-[1px] border-primary-300/30" />
            {/* Corner ornaments — bottom-left */}
            <div className="absolute bottom-5 left-5 w-14 h-14 border-b-[2.5px] border-l-[2.5px] border-amber-400/40 rounded-bl-sm" />
            <div className="absolute bottom-7 left-7 w-10 h-10 border-b-[1px] border-l-[1px] border-amber-300/30" />
            {/* Corner ornaments — bottom-right */}
            <div className="absolute bottom-5 right-5 w-14 h-14 border-b-[2.5px] border-r-[2.5px] border-amber-400/40 rounded-br-sm" />
            <div className="absolute bottom-7 right-7 w-10 h-10 border-b-[1px] border-r-[1px] border-amber-300/30" />

            {/* Subtle repeating diagonal lines pattern */}
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.02]"
              style={{
                backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, currentColor 10px, currentColor 10.5px)`,
              }}
            />

            {/* ── Certificate Content ──────────────────── */}
            <div className="relative z-10 px-10 pt-8 pb-10">

              {/* Header Strip */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-700 to-primary-900 flex items-center justify-center shadow-md">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <span className="text-base font-black text-primary-900 font-serif tracking-wide block leading-none">
                      Happy<span className="text-primary-500">.</span>Baby
                    </span>
                    <span className="text-[7px] text-gray-400 uppercase tracking-[0.2em] font-semibold">
                      Academic Credential Registry
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[8px] text-gray-400 font-mono tracking-wider">
                    {result.certificate_number}
                  </p>
                </div>
              </div>

              {/* Divider with diamond */}
              <div className="flex items-center gap-3 mb-8">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary-300/50 to-transparent" />
                <div className="w-2 h-2 rotate-45 bg-primary-400/40 border border-primary-300/40" />
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary-300/50 to-transparent" />
              </div>

              {/* Title */}
              <div className="text-center mb-8">
                <p className="text-[9px] text-primary-500 uppercase tracking-[0.45em] font-bold mb-1.5">
                  Certificate of
                </p>
                <h1 className="text-3xl font-black text-gray-900 tracking-[0.08em] uppercase font-serif">
                  Achievement
                </h1>
              </div>

              {/* Student Name */}
              <div className="text-center mb-8">
                <p className="text-xs text-gray-500 italic mb-3 font-serif">This is to certify that</p>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight font-bn relative inline-block">
                  {result.student_name}
                  {/* Underline decoration */}
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-[120%] h-[3px] bg-gradient-to-r from-transparent via-primary-400 to-transparent rounded-full" />
                </h2>
              </div>

              {/* Course Title */}
              <div className="text-center mb-8">
                <p className="text-xs text-gray-500 italic mb-3 font-serif">
                  has successfully completed the course in
                </p>
                <h3 className="text-xl font-bold text-primary-800 font-bn leading-snug max-w-lg mx-auto">
                  {result.course_title}
                </h3>
              </div>

              {/* Gold Seal + Signatures */}
              <div className="flex items-end justify-between mt-8 mx-2 relative">
                {/* Signature Left */}
                <div className="text-center flex-1">
                  <div className="w-24 mx-auto mb-2">
                    <svg viewBox="0 0 120 30" className="w-full text-gray-400 opacity-40">
                      <path d="M5 20 Q20 5 35 18 T65 15 T95 20 T115 12" stroke="currentColor" strokeWidth="1.5" fill="none" />
                    </svg>
                  </div>
                  <div className="border-t border-gray-300 pt-1.5 w-28 mx-auto">
                    <p className="text-[7px] text-gray-400 uppercase tracking-[0.25em] font-bold">
                      Registrar Signature
                    </p>
                  </div>
                </div>

                {/* Gold Stamp/Seal — Center */}
                <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 z-20">
                  <div className="relative">
                    {/* Outer ring */}
                    <div className="w-20 h-20 rounded-full border-[3px] border-dashed border-amber-400/70 flex items-center justify-center bg-gradient-to-br from-amber-50 to-amber-100 shadow-lg shadow-amber-200/30">
                      {/* Inner ring */}
                      <div className="w-14 h-14 rounded-full border-2 border-amber-500/50 flex items-center justify-center bg-gradient-to-br from-amber-100 to-amber-200/60">
                        <div className="text-center">
                          <Award className="w-4 h-4 text-amber-600 mx-auto mb-0.5" />
                          <p className="text-amber-700 font-black text-[6px] uppercase tracking-[0.15em] leading-none">
                            Certified
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Date Right */}
                <div className="text-center flex-1">
                  <p className="text-sm font-semibold text-gray-800 mb-2">{issuedDate}</p>
                  <div className="border-t border-gray-300 pt-1.5 w-28 mx-auto">
                    <p className="text-[7px] text-gray-400 uppercase tracking-[0.25em] font-bold">
                      Date of Issue
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Ribbon */}
            <div className="bg-gradient-to-r from-primary-800 via-primary-700 to-primary-800 px-8 py-3 text-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(255,255,255,0.1) 20px, rgba(255,255,255,0.1) 21px)' }} />
              <p className="text-[8px] text-primary-100/70 tracking-wider relative z-10">
                Exclusively verified by Happy Baby Credential Registry • All rights reserved © {new Date().getFullYear()} • Verify at happybaby.com/verify
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Verify Content ──────────────────────────────────── */
function VerifyContent() {
  const searchParams = useSearchParams();
  const [certNumber, setCertNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [searched, setSearched] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const cert = searchParams?.get("cert");
    if (cert) {
      setCertNumber(cert);
      doVerify(cert);
    }
  }, [searchParams]);

  const doVerify = async (num: string) => {
    if (!num.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res: any = await api.get(`/certificates/verify/${num.trim()}`);
      setResult(res);
    } catch {
      setResult({ valid: false, message: "Verification failed" });
    }
    setLoading(false);
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    doVerify(certNumber);
  };

  const handlePrint = () => window.print();

  const handleCopy = () => {
    const url = `${window.location.origin}/verify?cert=${certNumber}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Print-only view */}
      <div className="hidden print:block">
        <CertificatePreview result={result} />
      </div>

      {/* Screen layout */}
      <div className="min-h-screen flex print:hidden">
        {/* Left Sidebar */}
        <aside className="hidden lg:flex w-[280px] shrink-0 bg-[#FDFBFE] min-h-screen border-r border-[#F3EDF7] p-6 flex-col relative z-20">
          {/* Branding */}
          <div className="mb-12 px-2">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-9 h-9 rounded-xl bg-primary-700 flex items-center justify-center">
                <Shield className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-black text-primary-900 font-serif tracking-wide leading-none">
                  Happy<span className="text-primary-600">.</span>Baby
                </h1>
              </div>
            </div>
            <p className="text-[9px] text-gray-400 mt-1.5 tracking-[0.2em] uppercase font-semibold pl-[3px]">
              Academic Credential Registry
            </p>
          </div>

          {/* Nav */}
          <nav className="space-y-1.5 flex-1">
            <Link
              href="/verify"
              className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm font-bn bg-white text-primary-700 font-bold shadow-[0_8px_20px_rgb(0,0,0,0.04)] border border-gray-50/50"
            >
              <Shield className="w-[18px] h-[18px] text-primary-600" />
              Certificate Verification
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm font-bn text-gray-500 hover:bg-white/50 hover:text-gray-800 font-semibold transition-all"
            >
              <LayoutGrid className="w-[18px] h-[18px] text-gray-400" />
              Dashboard
            </Link>
          </nav>

          {/* Bottom CTA */}
          <div className="mt-auto pt-8">
            <Link
              href="/courses"
              className="w-full flex items-center justify-center py-3.5 bg-primary-700 text-white rounded-2xl text-sm font-bold font-bn hover:bg-primary-800 transition-all shadow-[0_6px_16px_rgba(79,70,229,0.2)] active:scale-[0.98]"
            >
              Explore Courses
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 bg-gray-50/50 min-h-screen py-10 px-6 lg:px-12 overflow-y-auto">
          <div className="max-w-2xl mx-auto">

            {/* Page Header */}
            <div className="text-center mb-10">
              <div className="w-14 h-14 rounded-2xl bg-primary-100 flex items-center justify-center mx-auto mb-4 shadow-sm">
                <Shield className="w-7 h-7 text-primary-700" />
              </div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                Certificate Verification
              </h1>
              <p className="text-sm text-gray-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
                Validate the authenticity of Happy Baby credentials using the unique certificate identifier.
              </p>
            </div>

            {/* Verification Card */}
            <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-gray-100 p-6 relative overflow-hidden">
              {/* Decorative blob */}
              <div className="absolute -right-16 -top-16 w-48 h-48 bg-primary-50 rounded-full blur-3xl opacity-40 pointer-events-none" />

              <div className="relative z-10">
                <label className="text-xs font-bold text-gray-500 mb-2 block uppercase tracking-wider">
                  Certificate ID
                </label>
                <form onSubmit={verify} className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={certNumber}
                      onChange={(e) => setCertNumber(e.target.value)}
                      placeholder="CERT-2026-XXXXXXXX"
                      className="w-full pl-4 pr-10 py-3.5 rounded-xl bg-gray-50 border border-gray-200 text-sm font-mono tracking-wider outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 focus:bg-white uppercase transition-all"
                    />
                    {certNumber && (
                      <button
                        type="button"
                        onClick={() => setCertNumber("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !certNumber.trim()}
                    className="px-6 py-3.5 bg-primary-700 text-white rounded-xl font-bold text-sm hover:bg-primary-800 disabled:opacity-50 transition-all flex items-center gap-2 shadow-sm shadow-primary-700/20 active:scale-[0.97]"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    Verify
                  </button>
                </form>

                {/* Result Block */}
                {searched && result && !loading && (
                  <div className="mt-5">
                    {result.valid ? (
                      <div className="flex items-start gap-3 bg-green-50/80 border border-green-200/60 rounded-xl p-4">
                        <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-green-800 text-sm">Certificate Verified</h3>
                          <p className="text-xs text-green-600 mt-0.5">
                            This is a legitimate Happy Baby credential issued on{" "}
                            {new Date(result.issued_at).toLocaleDateString("en-US", {
                              year: "numeric", month: "long", day: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3 bg-red-50/80 border border-red-200/60 rounded-xl p-4">
                        <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                          <XCircle className="w-5 h-5 text-red-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-red-800 text-sm">Certificate Not Found</h3>
                          <p className="text-xs text-red-600 mt-0.5">
                            No credential matches this identifier. Verify the number and try again.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                {result?.valid && (
                  <div className="flex flex-wrap gap-2.5 mt-5">
                    <button
                      onClick={handlePrint}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download PDF
                    </button>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                    >
                      {copied ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Share2 className="w-3.5 h-3.5" />
                          Share to LinkedIn
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Certificate Document Preview */}
            <CertificatePreview result={result} />

          </div>

          {/* Footer */}
          <div className="text-center mt-12">
            <p className="text-[10px] text-gray-400 tracking-wide">
              Exclusively verified by Happy Baby Credential Registry. All rights reserved © {new Date().getFullYear()}
            </p>
          </div>
        </main>
      </div>
    </>
  );
}

/* ── Page Export ───────────────────────────────────────────── */
export default function CertificateVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
