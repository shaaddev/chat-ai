"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useEffect } from "react";
import { getAccentColor } from "@/lib/theme";

function AccentColorInitializer() {
  useEffect(() => {
    const accent = getAccentColor();
    document.documentElement.setAttribute("data-accent", accent);
  }, []);
  return null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange={false}
      storageKey="theme"
    >
      <AccentColorInitializer />
      {children}
    </NextThemesProvider>
  );
}
