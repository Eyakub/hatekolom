"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Ban, ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";

function CancelContent() {
  const searchParams = useSearchParams();
  const tranId = searchParams?.get("tran_id");

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
            <Ban className="w-12 h-12 text-gray-400" />
          </div>

          <h1 className="text-2xl font-bold font-bn text-gray-900 mb-2">
            পেমেন্ট বাতিল করা হয়েছে
          </h1>

          <p className="text-gray-500 font-bn mb-6">
            তুমি পেমেন্ট বাতিল করেছো। তোমার অ্যাকাউন্ট থেকে কোনো টাকা কাটা হয়নি।
          </p>

          {tranId && (
            <p className="text-xs text-gray-400 font-mono mb-8">
              TXN: {tranId}
            </p>
          )}

          <div className="flex flex-col gap-3">
            <Link
              href="/courses"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-700 text-white font-semibold rounded-xl hover:bg-primary-800 transition-all font-bn"
            >
              কোর্স দেখো
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

export default function PaymentCancelPage() {
  return (
    <Suspense>
      <CancelContent />
    </Suspense>
  );
}
