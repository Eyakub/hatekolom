import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";

interface SiteSettings {
  id?: string;
  platform_name: string;
  logo_url: string;
  favicon_url: string;
  support_phone: string;
  support_email: string;
  office_address: string;
  facebook_url: string;
  youtube_url: string;
  linkedin_url: string;
  instagram_url: string;
  footer_description_en: string;
  footer_description_bn: string;
  feature_flags: Record<string, boolean>;
  updated_at?: string;
}

interface SiteStore {
  settings: SiteSettings;
  isLoading: boolean;
  fetchSettings: () => Promise<void>;
}

const defaultSettings: SiteSettings = {
  platform_name: "Happy Baby",
  logo_url: "",
  favicon_url: "",
  support_phone: "09610990880",
  support_email: "support@happybaby.com",
  office_address: "Dhaka, Bangladesh",
  facebook_url: "https://facebook.com",
  youtube_url: "https://youtube.com",
  instagram_url: "https://instagram.com",
  linkedin_url: "https://linkedin.com",
  footer_description_en: "A new era of joyful learning. Learn abacus, math, coding and more from home.",
  footer_description_bn: "আনন্দের সাথে শেখার নতুন যুগ। ঘরে বসে শিখুন অ্যাবাকাস, ম্যাথ, কোডিং ও আরও অনেক কিছু।",
  feature_flags: { games: true, abacus: true, badges: true, gallery: true, challenges: true },
};

export const useSiteStore = create<SiteStore>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      isLoading: false,
      fetchSettings: async () => {
        set({ isLoading: true });
        try {
          const data: any = await api.get("/settings/site");
          set({ settings: { ...defaultSettings, ...(data || {}) }, isLoading: false });
        } catch (error) {
          console.error("Failed to fetch site settings", error);
          set({ isLoading: false });
        }
      },
    }),
    {
      name: "site-settings-storage",
    }
  )
);
