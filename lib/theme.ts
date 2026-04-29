/**
 * Theme variants. Each theme bundles a complete palette + accent direction
 * applied via `data-theme` on <html>. Light/dark mode is orthogonal — handled
 * by `next-themes` via a `.dark` class — and overlays cleanly on each variant.
 */
export const THEMES = [
  {
    value: "paper",
    name: "Paper",
    description: "Warm cream and ink. Editorial, default.",
  },
  {
    value: "ink",
    name: "Ink",
    description: "Cool parchment and midnight. Linear-leaning.",
  },
  {
    value: "terminal",
    name: "Terminal",
    description: "True black and sage green. Monospace energy.",
  },
] as const;

export type ThemeVariant = (typeof THEMES)[number]["value"];

export const THEME_STORAGE_KEY = "chat-ai:theme";
export const DENSITY_STORAGE_KEY = "chat-ai:density";
export const PROSE_STORAGE_KEY = "chat-ai:prose";
export const LEGACY_ACCENT_STORAGE_KEY = "accent-color";
export const DEFAULT_THEME: ThemeVariant = "paper";
export const DEFAULT_DENSITY: Density = "comfortable";
export const DEFAULT_PROSE: ProseFont = "serif";

export type Density = "comfortable" | "compact";
export type ProseFont = "serif" | "sans";

/**
 * Preview swatches for the theme picker. Each entry is what each theme
 * actually renders for the user under the current light/dark mode — used
 * to draw mini-cards in the appearance settings.
 */
export const THEME_PREVIEW: Record<
  ThemeVariant,
  {
    light: { background: string; foreground: string; accent: string };
    dark: { background: string; foreground: string; accent: string };
  }
> = {
  paper: {
    light: {
      background: "oklch(0.98 0.008 85)",
      foreground: "oklch(0.18 0.01 250)",
      accent: "oklch(0.7 0.14 60)",
    },
    dark: {
      background: "oklch(0.16 0.008 250)",
      foreground: "oklch(0.94 0.012 85)",
      accent: "oklch(0.78 0.14 60)",
    },
  },
  ink: {
    light: {
      background: "oklch(0.97 0.005 250)",
      foreground: "oklch(0.16 0.02 250)",
      accent: "oklch(0.7 0.18 235)",
    },
    dark: {
      background: "oklch(0.13 0.018 255)",
      foreground: "oklch(0.94 0.008 250)",
      accent: "oklch(0.74 0.18 235)",
    },
  },
  terminal: {
    light: {
      background: "oklch(0.99 0 0)",
      foreground: "oklch(0.13 0 0)",
      accent: "oklch(0.62 0.14 145)",
    },
    dark: {
      background: "oklch(0.08 0 0)",
      foreground: "oklch(0.94 0.02 145)",
      accent: "oklch(0.74 0.14 145)",
    },
  },
};

/**
 * Map legacy 8-color accent values to the closest new theme, so existing
 * users with localStorage values from the old system get migrated cleanly.
 */
export function migrateLegacyAccent(legacy: string | null): ThemeVariant {
  if (legacy === "blue" || legacy === "teal" || legacy === "purple") {
    return "ink";
  }
  if (legacy === "green") {
    return "terminal";
  }
  return DEFAULT_THEME;
}

export function getTheme(): ThemeVariant {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }
  const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeVariant | null;
  if (stored && THEMES.some((t) => t.value === stored)) {
    return stored;
  }
  const legacy = localStorage.getItem(LEGACY_ACCENT_STORAGE_KEY);
  return migrateLegacyAccent(legacy);
}

export function setTheme(theme: ThemeVariant) {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.classList.add("theme-transition");
  setTimeout(() => {
    document.documentElement.classList.remove("theme-transition");
  }, 350);
}

export function getDensity(): Density {
  if (typeof window === "undefined") {
    return DEFAULT_DENSITY;
  }
  return (
    (localStorage.getItem(DENSITY_STORAGE_KEY) as Density | null) ??
    DEFAULT_DENSITY
  );
}

export function setDensity(density: Density) {
  localStorage.setItem(DENSITY_STORAGE_KEY, density);
  document.documentElement.setAttribute("data-density", density);
}

export function getProseFont(): ProseFont {
  if (typeof window === "undefined") {
    return DEFAULT_PROSE;
  }
  return (
    (localStorage.getItem(PROSE_STORAGE_KEY) as ProseFont | null) ??
    DEFAULT_PROSE
  );
}

export function setProseFont(font: ProseFont) {
  localStorage.setItem(PROSE_STORAGE_KEY, font);
  document.documentElement.setAttribute("data-prose", font);
}
