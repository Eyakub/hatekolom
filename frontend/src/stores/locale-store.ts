import { create } from "zustand";
import { persist } from "zustand/middleware";

type Locale = "bn" | "en";

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (bn: string, en: string) => string;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set, get) => ({
      locale: "bn" as Locale,
      setLocale: (locale) => set({ locale }),
      t: (bn, en) => (get().locale === "bn" ? bn : en),
    }),
    {
      name: "locale-store",
      // Skip automatic rehydration — the store keeps default values ("bn")
      // during SSR and the first client render, ensuring no hydration mismatch.
      // Rehydration is triggered manually via useLocaleHydration().
      skipHydration: true,
    }
  )
);
