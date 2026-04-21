"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { XCircle, ArrowLeft, RefreshCw } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";

function FailContent() {
  const searchParams = useSearchParams();
  const tranId = searchParams?.get("tran_id");
  const error = searchParams?.get("error");

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-12 h-12 text-red-500" />
          </div>

          <h1 className="text-2xl font-bold font-bn text-gray-900 mb-2">
            পেমেন্ট ব্যর্থ হয়েছে
          </h1>

          <p className="text-gray-500 font-bn mb-2">
            দুঃখিত, তোমার পেমেন্ট প্রক্রিয়া সম্পন্ন হয়নি।
          </p>

          {error && (
            <p className="text-xs text-red-400 mb-2 font-mono">
              Error: {error}
            </p>
          )}

          {tranId && (
            <p className="text-xs text-gray-400 font-mono mb-6">
              TXN: {tranId}
            </p>
          )}

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800 mb-8 font-bn text-left">
            <p className="font-semibold mb-1">কী করবে?</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>তোমার অ্যাকাউন্ট থেকে কোনো টাকা কাটা হয়নি</li>
              <li>আবার চেষ্টা করো বা ভিন্ন পেমেন্ট মাধ্যম ব্যবহার করো</li>
              <li>সমস্যা থাকলে আমাদের সাথে যোগাযোগ করো</li>
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href="/courses"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-700 text-white font-semibold rounded-xl hover:bg-primary-800 transition-all font-bn"
            >
              <RefreshCw className="w-4 h-4" />
              আবার চেষ্টা করো
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-1 text-sm text-gray-500 hover:text-primary-700 font-bn"
            >
              <ArrowLeft className="w-4 h-4" />
              হোমপেজে ফিরে যাও
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentFailPage() {
  return (
    <Suspense>
      <FailContent />
    </Suspense>
  );
}
