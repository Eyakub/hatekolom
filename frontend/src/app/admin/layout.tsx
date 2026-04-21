import { Suspense } from "react";
import AdminLayoutClient from "@/components/admin/AdminLayout";
import { Loader2 } from "lucide-react";

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>}>
      <AdminLayoutClient>{children}</AdminLayoutClient>
    </Suspense>
  );
}
