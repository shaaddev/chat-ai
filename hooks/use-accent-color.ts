"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  type AccentColor,
  ACCENT_STORAGE_KEY,
  DEFAULT_ACCENT,
  setAccentColor as setAccentColorUtil,
} from "@/lib/theme";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("accent-color-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("accent-color-change", callback);
  };
}

function getSnapshot(): AccentColor {
  return (
    (localStorage.getItem(ACCENT_STORAGE_KEY) as AccentColor) ?? DEFAULT_ACCENT
  );
}

function getServerSnapshot(): AccentColor {
  return DEFAULT_ACCENT;
}

export function useAccentColor() {
  const accentColor = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setAccentColor = useCallback((color: AccentColor) => {
    setAccentColorUtil(color);
    window.dispatchEvent(new Event("accent-color-change"));
  }, []);

  return { accentColor, setAccentColor };
}
