"use client";

import { useRef, useState, useEffect } from "react";
import { motion } from "motion/react";
import { MessageCircle, Sparkles, Rocket, ChevronLeft, ChevronRight, Play, Star, Eye, Timer, Award, ArrowRight, ArrowUpRight, Pause } from "lucide-react";
import { useLocaleStore } from "@/stores/locale-store";

// Dynamic icon resolver for activities
import * as LucideIcons from "lucide-react";
function DynamicIcon({ name, className }: { name: string; className?: string }) {
  const Icon = (LucideIcons as any)[name];
  return Icon ? <Icon className={className} /> : <LucideIcons.Sparkles className={className} />;
}

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^&?/]+)/);
  return match ? match[1] : null;
}

function getVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
}

export function SuccessAndJoyHub({ data }: { data: any }) {
  const { t } = useLocaleStore();
  const [activeTab, setActiveTab] = useState<"reviews" | "gallery" | "activities">("reviews");
  const scrollRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const activitiesRef = useRef<HTMLDivElement>(null);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);

  useEffect(() => {
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    if (!isMobile) return;
    const autoScroll = (ref: React.RefObject<HTMLDivElement | null>) => {
      if (!ref.current) return;
      const el = ref.current;
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 20) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: el.clientWidth * 0.75, behavior: 'smooth' });
      }
    };
    const interval = setInterval(() => {
      autoScroll(scrollRef);
      autoScroll(galleryRef);
      autoScroll(activitiesRef);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const scrollLeft = () => { scrollRef.current?.scrollBy({ left: -320, behavior: "smooth" }); };
  const scrollRight = () => { scrollRef.current?.scrollBy({ left: 320, behavior: "smooth" }); };

  const reviews = data?.testimonials || [];
  const gallery = data?.gallery || [];
  const activities = data?.activities || [];

  const handleTabClick = (tab: "reviews" | "gallery" | "activities") => {
    setActiveTab(tab);
    const element = document.getElementById(`hub-${tab}`);
    if (element) {
      const y = element.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  // Don't render if no data at all
  if (!data || (reviews.length === 0 && gallery.length === 0 && activities.length === 0)) return null;

  return (
    <section className="bg-[#fbf9f8] relative overflow-x-clip">
      <div className="px-4 md:px-8 max-w-7xl mx-auto pt-20 pb-24 font-bn relative z-10">
      {/* Hero Header */}
      <section className="text-center mb-16 relative">
        <div className="absolute -top-10 -left-10 w-64 h-64 bg-primary-100 rounded-full blur-3xl -z-10"></div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-primary-700 mb-6">
          {t("সাকসেস ও জয় হাব", "Success & Joy Hub")}
        </h1>
        <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
          {t("আমাদের এক্সপ্লোরারদের মাইলফলক উদযাপন এবং আবিষ্কারের জাদু শেয়ার করা হচ্ছে।", "Celebrating our explorers' milestones and sharing the magic of discovery.")}
        </p>
      </section>

      {/* Dynamic Nav Tabs */}
      <div className="flex items-center justify-center gap-1.5 md:gap-3 mb-10 md:mb-16 sticky top-16 md:top-20 z-40 bg-white/70 backdrop-blur-xl py-2 md:py-3 rounded-full px-2 md:px-4 shadow-sm border border-gray-100 mx-auto w-max max-w-[calc(100vw-2rem)]">
        {reviews.length > 0 && (
          <button onClick={() => handleTabClick("reviews")}
            className={`px-3 md:px-6 py-2 md:py-3 rounded-full font-bold transition-all duration-300 flex items-center gap-1.5 md:gap-2 text-xs md:text-base whitespace-nowrap ${activeTab === 'reviews' ? 'bg-primary-700 text-white shadow-md shadow-primary-700/20 scale-105' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'}`}>
            <MessageCircle className="w-3.5 h-3.5 md:w-5 md:h-5" /> {t("কমিউনিটি", "Voices")}
          </button>
        )}
        {gallery.length > 0 && (
          <button onClick={() => handleTabClick("gallery")}
            className={`px-3 md:px-6 py-2 md:py-3 rounded-full font-bold transition-all duration-300 flex items-center gap-1.5 md:gap-2 text-xs md:text-base whitespace-nowrap ${activeTab === 'gallery' ? 'bg-primary-700 text-white shadow-md shadow-primary-700/20 scale-105' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'}`}>
            <Sparkles className="w-3.5 h-3.5 md:w-5 md:h-5" /> {t("সাকসেস", "Success")}
          </button>
        )}
        {activities.length > 0 && (
          <button onClick={() => handleTabClick("activities")}
            className={`px-3 md:px-6 py-2 md:py-3 rounded-full font-bold transition-all duration-300 flex items-center gap-1.5 md:gap-2 text-xs md:text-base whitespace-nowrap ${activeTab === 'activities' ? 'bg-primary-700 text-white shadow-md shadow-primary-700/20 scale-105' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'}`}>
            <Rocket className="w-3.5 h-3.5 md:w-5 md:h-5" /> {t("অ্যাক্টিভিটিজ", "Activities")}
          </button>
        )}
      </div>

      {/* Section 1: Community Voices */}
      {reviews.length > 0 && (
        <section className="scroll-mt-40 mb-28" id="hub-reviews">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="w-2 h-10 bg-primary-700 rounded-full"></div>
              <h2 className="text-3xl font-extrabold text-gray-900">{t("কমিউনিটি ভয়েস", "Community Voices")}</h2>
            </div>
            <div className="hidden md:flex gap-2">
              <button onClick={scrollLeft} className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
              <button onClick={scrollRight} className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors"><ChevronRight className="w-5 h-5" /></button>
            </div>
          </div>

          <div className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-8 -mx-4 px-8 md:mx-0 md:px-0 hide-scrollbar" ref={scrollRef} style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {reviews.map((rv: any) => {
              const isPlaying = playingVideo === rv.id;
              const bg = rv.gradient_color || "from-primary-700";
              return (
                <motion.div key={rv.id} whileHover={{ scale: 1.02 }} className="group relative w-[75vw] md:w-[320px] aspect-[9/16] rounded-2xl overflow-hidden shadow-2xl cursor-pointer snap-center flex-shrink-0">
                  {/* Video or Image */}
                  {isPlaying && rv.video_url ? (
                    <div className="absolute inset-0 bg-black">
                      {rv.video_type === "youtube" && getYouTubeId(rv.video_url) ? (
                        <iframe src={`https://www.youtube.com/embed/${getYouTubeId(rv.video_url)}?autoplay=1&rel=0`} allow="autoplay; encrypted-media" allowFullScreen className="w-full h-full" />
                      ) : rv.video_type === "vimeo" && getVimeoId(rv.video_url) ? (
                        <iframe src={`https://player.vimeo.com/video/${getVimeoId(rv.video_url)}?autoplay=1`} allow="autoplay; fullscreen" allowFullScreen className="w-full h-full" />
                      ) : (
                        <video src={rv.video_url} autoPlay controls playsInline className="w-full h-full object-cover" />
                      )}
                      <button onClick={(e) => { e.stopPropagation(); setPlayingVideo(null); }}
                        className="absolute top-3 right-3 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center z-10">
                        <Pause className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <img alt="Review" src={rv.photo_url || ""} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      <div className={`absolute inset-0 bg-gradient-to-t ${bg} via-black/30 to-transparent opacity-90`}></div>

                      {rv.video_url && (
                        <div className="absolute inset-0 flex items-center justify-center" onClick={() => setPlayingVideo(rv.id)}>
                          <div className="w-16 h-16 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center border-2 border-white/50 hover:scale-110 transition-transform shadow-xl">
                            <Play className="w-8 h-8 text-white fill-white" />
                          </div>
                        </div>
                      )}

                      <div className="absolute bottom-0 p-6 w-full text-white">
                        <div className="flex gap-1 mb-3">
                          {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />)}
                        </div>
                        <p className="font-bold text-xl leading-tight mb-2">{t(rv.quote_bn || rv.quote, rv.quote)}</p>
                        <p className="text-[11px] opacity-80 uppercase tracking-widest font-black font-sans">
                          {rv.author_name} · {t(rv.author_role_bn || rv.author_role, rv.author_role)}
                        </p>
                      </div>
                    </>
                  )}
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* Section 2: Student Success Gallery — Carousel */}
      {gallery.length > 0 && (
        <section className="scroll-mt-40 mb-28" id="hub-gallery">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="w-2 h-10 bg-primary-700 rounded-full"></div>
              <div>
                <h2 className="text-3xl font-extrabold text-gray-900">{t("স্টুডেন্ট সাকসেস গ্যালারি", "Student Success Gallery")}</h2>
                <p className="text-gray-500 font-medium text-sm mt-1">{t("আমাদের লেভেল ১২ স্কলারদের মাস্টারপিসগুলো দেখুন।", "Behold the masterpieces of our Level 12 Scholars.")}</p>
              </div>
            </div>
            <div className="hidden md:flex gap-2">
              <button onClick={() => galleryRef.current?.scrollBy({ left: -320, behavior: "smooth" })} className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
              <button onClick={() => galleryRef.current?.scrollBy({ left: 320, behavior: "smooth" })} className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors"><ChevronRight className="w-5 h-5" /></button>
            </div>
          </div>

          <div className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-8 -mx-4 px-8 md:mx-0 md:px-0 hide-scrollbar" ref={galleryRef} style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {gallery.map((gl: any) => (
              <motion.div key={gl.id} whileHover={{ scale: 1.02 }} className="group relative w-[75vw] md:w-[320px] flex-shrink-0 snap-center aspect-[9/16] rounded-2xl overflow-hidden shadow-2xl cursor-pointer">
                <img alt="Gallery item" src={gl.image_url} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent opacity-80"></div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-16 h-16 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center border-2 border-white/50 group-hover:scale-110 transition-transform shadow-xl">
                    <Eye className="w-8 h-8 text-white" />
                  </div>
                </div>
                <div className="absolute bottom-0 p-6 w-full text-white">
                  <div className="flex gap-1 mb-3">
                    {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />)}
                  </div>
                  <p className="font-bold text-xl leading-tight mb-2">{t(gl.title_bn || gl.title, gl.title)}</p>
                  <p className="text-[11px] opacity-80 uppercase tracking-widest font-black font-sans">{t(gl.label_bn || gl.label, gl.label)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Section 3: Educational Activities */}
      {activities.length > 0 && (
        <section className="scroll-mt-40" id="hub-activities">
          <div className="bg-primary-50 rounded-3xl p-8 md:p-12 border border-primary-100 relative">
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
              <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-primary-100 opacity-50 rounded-full"></div>
            </div>
            <div className="max-w-2xl mb-12 relative z-10">
              <h2 className="text-4xl md:text-5xl font-extrabold text-primary-700 mb-4">{t("আনন্দে ঝাঁপিয়ে পড়ো!", "Jump Into the Joy!")}</h2>
              <p className="text-lg text-gray-600 leading-relaxed font-sans font-medium">
                {t("নিজের সাফল্যের গল্প শুরু করতে প্রস্তুত? আবিষ্কার করো আমাদের সব ইন্টারেক্টিভ লার্নিং মডিউল।", "Ready to start your own success story? Explore our immersive learning modules designed for ultimate engagement.")}
              </p>
            </div>

            <div className="flex md:grid md:grid-cols-3 gap-6 md:gap-8 mb-12 relative z-10 overflow-x-auto snap-x snap-mandatory pb-8 -mx-8 px-8 md:mx-0 md:px-0 hide-scrollbar" ref={activitiesRef} style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
              {activities.map((act: any) => {
                const borderColor = act.border_color || "border-primary-500";
                const iconColor = borderColor.replace("border-", "text-").replace("-500", "-600");
                const bgColor = borderColor.replace("border-", "bg-").replace("-500", "-100");
                return (
                  <div key={act.id} className={`bg-white rounded-2xl shadow-sm border-b-8 ${borderColor} hover:shadow-xl transition-all group overflow-hidden flex flex-col w-[75vw] md:w-auto flex-shrink-0 snap-center`}>
                    <div className={`aspect-video relative overflow-hidden ${bgColor} shrink-0`}>
                      {act.image_url ? (
                        <img alt={act.title} src={act.image_url} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <DynamicIcon name={act.icon_name} className={`w-16 h-16 ${iconColor}`} />
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <DynamicIcon name={act.icon_name} className={`w-16 h-16 ${iconColor} bg-white/90 p-4 rounded-full shadow-lg group-hover:scale-110 transition-transform`} />
                      </div>
                    </div>
                    <div className="p-6 md:p-8 flex-1 flex flex-col">
                      <h4 className="text-2xl font-bold mb-3 text-gray-900">{t(act.title_bn || act.title, act.title)}</h4>
                      <p className="text-gray-600 mb-6 font-sans flex-1">{t(act.description_bn || act.description, act.description)}</p>
                      <div className={`flex items-center gap-3 ${iconColor} text-[11px] font-black uppercase tracking-widest mb-6 font-sans`}>
                        {act.time_label && <div className="flex items-center gap-1"><Timer className="w-4 h-4" /> {act.time_label}</div>}
                        {act.time_label && act.xp_label && <span>•</span>}
                        {act.xp_label && <div className="flex items-center gap-1"><Award className="w-4 h-4" /> {act.xp_label}</div>}
                      </div>
                      {(act.cta_text || act.cta_text_bn) && (
                        <button className={`${iconColor} font-bold flex items-center gap-2 group-hover:translate-x-2 transition-transform uppercase text-sm tracking-wider`}>
                          {t(act.cta_text_bn || act.cta_text, act.cta_text)} <ArrowRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-center relative z-10 mt-6">
              <motion.button
                className="group bg-primary-600 text-white font-extrabold font-bn px-6 py-3 md:px-10 md:py-5 rounded-full text-sm md:text-2xl shadow-[0_6px_0_#4c1d95] md:shadow-[0_8px_0_#4c1d95] hover:shadow-[0_3px_0_#4c1d95] md:hover:shadow-[0_4px_0_#4c1d95] hover:translate-y-1 active:shadow-none active:translate-y-2 transition-all flex items-center gap-2 md:gap-3 mx-auto border-2 border-primary-800"
                whileHover={{ scale: 1.02 }}
              >
                {t("সকল অ্যাক্টিভিটি", "Explore All Activities")}
                <Rocket className="w-4 h-4 md:w-6 md:h-6 group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />
              </motion.button>
            </div>
          </div>
        </section>
      )}
      </div>
    </section>
  );
}
