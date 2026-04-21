"use client";

import { motion } from "motion/react";
import { TrendingUp, ArrowRight } from "lucide-react";
import { useLocaleStore } from "@/stores/locale-store";

export function PlatformAchievements({ data }: { data: any }) {
  const { t } = useLocaleStore();

  const stats = data?.stats || [];
  const galleryItems = data?.gallery || [];
  const column1Images = galleryItems.filter((g: any) => g.column_group === 1).map((g: any) => g.image_url);
  const column2Images = galleryItems.filter((g: any) => g.column_group === 2).map((g: any) => g.image_url);

  // Don't render if no stats and no gallery
  if (!data || (stats.length === 0 && galleryItems.length === 0)) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-8 mb-20 relative z-10 font-sans">
      <div className="relative bg-gradient-to-br from-primary-600 to-[#3b1285] rounded-[2.5rem] overflow-hidden p-8 md:p-14 text-white shadow-2xl flex flex-col md:flex-row items-center gap-12 border-4 border-white/10">

        {/* Abstract Background Patterns */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
            <circle cx="90" cy="10" fill="white" r="20" />
            <circle cx="10" cy="90" fill="white" r="15" />
            <path d="M0,50 Q25,30 50,50 T100,50" fill="none" stroke="white" strokeWidth="0.5" />
          </svg>
        </div>

        {/* Left Side: Animated Vertical Collage Carousels */}
        {(column1Images.length > 0 || column2Images.length > 0) && (
          <div className="w-full md:w-1/2 h-[400px] md:h-[480px] overflow-hidden relative" style={{ maskImage: "linear-gradient(to bottom, transparent, black 4%, black 96%, transparent)" }}>
            <div className="grid grid-cols-2 gap-4 h-full">
              {/* Column 1 - Marquee Scrolling UP */}
              {column1Images.length > 0 && (
                <div className="relative h-full overflow-hidden">
                  <motion.div
                    className="flex flex-col gap-4 w-full"
                    animate={{ y: ["0%", "-50%"] }}
                    transition={{ ease: "linear", duration: 15, repeat: Infinity }}
                  >
                    {[...column1Images, ...column1Images].map((img: string, idx: number) => (
                      <div key={`col1-${idx}`} className="w-full aspect-square rounded-2xl overflow-hidden hover:scale-105 hover:-translate-y-1 transition-transform cursor-pointer shadow-lg bg-primary-800 shrink-0">
                        <img alt={`Success ${idx}`} className="w-full h-full object-cover" src={img} />
                      </div>
                    ))}
                  </motion.div>
                </div>
              )}

              {/* Column 2 - Marquee Scrolling DOWN */}
              {column2Images.length > 0 && (
                <div className="relative h-full overflow-hidden">
                  <motion.div
                    className="flex flex-col gap-4 w-full"
                    animate={{ y: ["-50%", "0%"] }}
                    transition={{ ease: "linear", duration: 18, repeat: Infinity }}
                  >
                    {[...column2Images, ...column2Images].map((img: string, idx: number) => (
                      <div key={`col2-${idx}`} className="w-full aspect-square rounded-2xl overflow-hidden hover:scale-105 hover:-translate-y-1 transition-transform cursor-pointer shadow-lg bg-primary-800 shrink-0">
                        <img alt={`Success ${idx}`} className="w-full h-full object-cover" src={img} />
                      </div>
                    ))}
                  </motion.div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right Side: Content & Stats */}
        <div className={`w-full ${column1Images.length > 0 || column2Images.length > 0 ? "md:w-1/2" : ""} flex flex-col gap-8 relative z-10`}>
          <div>
            <div className="bg-white/20 backdrop-blur-md w-fit p-3 rounded-2xl mb-6 shadow-sm border border-white/10">
              <TrendingUp className="text-white w-8 h-8" />
            </div>

            <h2 className="text-3xl md:text-5xl font-extrabold font-bn leading-tight mb-4 tracking-tight drop-shadow-sm">
              {t("৪ বছরে হেইট কলমের অর্জন", "Hate Kolom's Achievement in 4 Years")}
            </h2>
            <p className="text-primary-100 opacity-90 text-lg leading-relaxed max-w-md font-medium">
              {t("আমাদের কমিউনিটির সাথে মিলে একটি উজ্জ্বল এবং বুদ্ধিদীপ্ত ভবিষ্যৎ গড়ে তুলি।", "Hand in hand with our community, let's build a brighter, smarter future together.")}
            </p>
          </div>

          {stats.length > 0 && (
            <div className="grid grid-cols-2 gap-y-10 gap-x-8">
              {stats.map((stat: any) => (
                <div key={stat.id} className="hover:-translate-y-1 transition-transform">
                  <p className="text-4xl md:text-5xl font-black mb-1 drop-shadow-sm font-bn">
                    {stat.auto_calculate && stat.computed_value
                      ? stat.computed_value
                      : t(stat.value, stat.value_en || stat.value)}
                  </p>
                  <p className="text-primary-200 text-xs md:text-sm font-bold uppercase tracking-widest opacity-80">
                    {t(stat.label_bn || stat.label, stat.label)}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4">
            <button className="inline-flex items-center gap-2 text-white font-extrabold font-bn text-lg group border-b-2 border-white/30 hover:border-white pb-1 transition-all">
              {t("সকল সাফল্যের গল্প দেখুন", "View all success stories")}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
