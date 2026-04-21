"use client";

import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { Navbar } from "@/components/layout/Navbar";
import { usePathname } from "next/navigation";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#FDFEFE] relative">
      {/* Global Brand Background Texture */}
      <div className="fixed inset-0 opacity-20 pointer-events-none z-0" style={{ backgroundImage: "radial-gradient(#5341cd 0.6px, transparent 0.6px)", backgroundSize: "24px 24px" }} />

      {/* Mobile Navbar mapping (Hidden on Desktop) */}
      <div className="lg:hidden relative z-30">
        <Navbar />
      </div>

      <div className="relative z-10 lg:w-64 shrink-0">
        <DashboardSidebar />
      </div>
      
      <div className="flex-1 lg:max-h-screen lg:overflow-y-auto bg-gray-50/20 relative z-10">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full pb-24">
          {children}
        </div>
      </div>
    </div>
  );
}
