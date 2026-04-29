"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_DENSITY,
  DEFAULT_PROSE,
  DEFAULT_THEME,
  DENSITY_STORAGE_KEY,
  type Density,
  getTheme,
  PROSE_STORAGE_KEY,
  type ProseFont,
  setDensity as setDensityUtil,
  setProseFont as setProseFontUtil,
  setTheme as setThemeUtil,
  THEME_STORAGE_KEY,
  type ThemeVariant,
} from "@/lib/theme";

const THEME_EVENT = "chat-ai:theme-change";
const DENSITY_EVENT = "chat-ai:density-change";
const PROSE_EVENT = "chat-ai:prose-change";

function subscribeFactory(eventName: string) {
  return (callback: () => void) => {
    window.addEventListener("storage", callback);
    window.addEventListener(eventName, callback);
    return () => {
      window.removeEventListener("storage", callback);
      window.removeEventListener(eventName, callback);
    };
  };
}

const subscribeTheme = subscribeFactory(THEME_EVENT);
const subscribeDensity = subscribeFactory(DENSITY_EVENT);
const subscribeProse = subscribeFactory(PROSE_EVENT);

function getThemeSnapshot(): ThemeVariant {
  return getTheme();
}

function getServerThemeSnapshot(): ThemeVariant {
  return DEFAULT_THEME;
}

function getDensitySnapshot(): Density {
  return (
    (localStorage.getItem(DENSITY_STORAGE_KEY) as Density | null) ??
    DEFAULT_DENSITY
  );
}

function getServerDensitySnapshot(): Density {
  return DEFAULT_DENSITY;
}

function getProseSnapshot(): ProseFont {
  return (
    (localStorage.getItem(PROSE_STORAGE_KEY) as ProseFont | null) ??
    DEFAULT_PROSE
  );
}

function getServerProseSnapshot(): ProseFont {
  return DEFAULT_PROSE;
}

export function useThemeVariant() {
  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getServerThemeSnapshot
  );

  const setTheme = useCallback((next: ThemeVariant) => {
    setThemeUtil(next);
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  return { theme, setTheme };
}

export function useDensity() {
  const density = useSyncExternalStore(
    subscribeDensity,
    getDensitySnapshot,
    getServerDensitySnapshot
  );

  const setDensity = useCallback((next: Density) => {
    setDensityUtil(next);
    window.dispatchEvent(new Event(DENSITY_EVENT));
  }, []);

  return { density, setDensity };
}

export function useProseFont() {
  const prose = useSyncExternalStore(
    subscribeProse,
    getProseSnapshot,
    getServerProseSnapshot
  );

  const setProse = useCallback((next: ProseFont) => {
    setProseFontUtil(next);
    window.dispatchEvent(new Event(PROSE_EVENT));
  }, []);

  return { prose, setProse };
}

// Storage keys live in `@/lib/theme` — import them directly there. We avoid
// re-exporting from this hook module to keep it from becoming a barrel.
