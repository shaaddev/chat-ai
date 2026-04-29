"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useEffect } from "react";
import { getDensity, getProseFont, getTheme } from "@/lib/theme";

/**
 * Hydrates the theme variant + density + prose font from localStorage on
 * mount. The anti-FOUC inline script in `app/layout.tsx` already sets the
 * data-attributes before paint, so this is a defensive re-sync (covers
 * tabs that were opened before the script ran, etc.).
 */
function ThemePreferencesInitializer() {
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", getTheme());
    document.documentElement.setAttribute("data-density", getDensity());
    document.documentElement.setAttribute("data-prose", getProseFont());
  }, []);
  return null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      disableTransitionOnChange={false}
      enableSystem
      storageKey="theme"
    >
      <ThemePreferencesInitializer />
      {children}
    </NextThemesProvider>
  );
}
