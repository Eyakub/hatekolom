"use client";

import { useEffect } from "react";
import { useSiteStore } from "@/stores/site-store";
import { useLocaleStore } from "@/stores/locale-store";

export function SiteSettingsProvider() {
  const { fetchSettings } = useSiteStore();

  useEffect(() => {
    fetchSettings();
    // Manually rehydrate locale store from localStorage AFTER React hydration
    // is complete. The store uses skipHydration: true to prevent SSR mismatches.
    useLocaleStore.persist.rehydrate();
  }, [fetchSettings]);

  return null; // This component doesn't render anything
}
