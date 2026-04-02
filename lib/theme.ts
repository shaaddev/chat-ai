export const ACCENT_COLORS = [
  { name: "Neutral", value: "neutral" },
  { name: "Blue", value: "blue" },
  { name: "Purple", value: "purple" },
  { name: "Green", value: "green" },
  { name: "Orange", value: "orange" },
  { name: "Rose", value: "rose" },
  { name: "Teal", value: "teal" },
  { name: "Amber", value: "amber" },
] as const;

export type AccentColor = (typeof ACCENT_COLORS)[number]["value"];

export const ACCENT_STORAGE_KEY = "accent-color";
export const DEFAULT_ACCENT: AccentColor = "blue";

// Preview swatches for the theme picker (the primary color in dark mode)
export const ACCENT_SWATCHES: Record<AccentColor, string> = {
  neutral: "oklch(0.922 0 0)",
  blue: "oklch(0.623 0.214 259.815)",
  purple: "oklch(0.627 0.265 303.9)",
  green: "oklch(0.696 0.17 162.48)",
  orange: "oklch(0.769 0.188 70.08)",
  rose: "oklch(0.645 0.246 16.439)",
  teal: "oklch(0.704 0.14 182.503)",
  amber: "oklch(0.828 0.189 84.429)",
};

export function getAccentColor(): AccentColor {
  if (typeof window === "undefined") {
    return DEFAULT_ACCENT;
  }
  return (
    (localStorage.getItem(ACCENT_STORAGE_KEY) as AccentColor) ?? DEFAULT_ACCENT
  );
}

export function setAccentColor(color: AccentColor) {
  localStorage.setItem(ACCENT_STORAGE_KEY, color);
  document.documentElement.setAttribute("data-accent", color);
  // Add transition class, remove after animation completes
  document.documentElement.classList.add("theme-transition");
  setTimeout(() => {
    document.documentElement.classList.remove("theme-transition");
  }, 350);
}
