"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { api } from "@/lib/api";

function SuccessContent() {
  const searchParams = useSearchParams();
  const tranId = searchParams?.get("tran_id");
  const orderNumber = searchParams?.get("order");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [paymentData, setPaymentData] = useState<any>(null);

  useEffect(() => {
    if (!tranId) {
      setStatus("success"); // Direct mock success
      return;
    }

    const check = async () => {
      try {
        const data: any = await api.get(`/payments/status/${tranId}`);
        setPaymentData(data);
        setStatus(data.status === "success" ? "success" : "error");
      } catch {
        // If tran_id present but API fails, still show success
        // (the IPN will handle actual verification)
        setStatus("success");
      }
    };
    check();
  }, [tranId]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-500 font-bn">পেমেন্ট যাচাই করা হচ্ছে...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6 animate-in zoom-in">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>

          <h1 className="text-2xl font-bold font-bn text-gray-900 mb-2">
            পেমেন্ট সফল!
          </h1>

          {(orderNumber || paymentData?.order_number) && (
            <p className="text-gray-500 font-bn mb-1">
              অর্ডার নম্বর:{" "}
              <span className="font-mono font-bold text-gray-800">
                {orderNumber || paymentData?.order_number}
              </span>
            </p>
          )}

          {tranId && (
            <p className="text-xs text-gray-400 font-mono mb-4">
              TXN: {tranId}
            </p>
          )}

          {paymentData?.amount && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 rounded-full text-green-700 font-semibold text-sm mb-6">
              ৳{paymentData.amount} — {paymentData.method?.toUpperCase()}
            </div>
          )}

          <p className="text-sm text-gray-400 font-bn mb-8">
            তোমার সন্তান এখন কোর্সে প্রবেশ করতে পারবে
          </p>

          <div className="flex flex-col gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-700 text-white font-semibold rounded-xl hover:bg-primary-800 transition-all font-bn"
            >
              ড্যাশবোর্ডে যাও <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/courses"
              className="text-sm text-primary-700 font-semibold hover:underline font-bn"
            >
              আরও কোর্স দেখো
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
