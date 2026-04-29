"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useDensity,
  useProseFont,
  useThemeVariant,
} from "@/hooks/use-theme-variant";
import {
  type Density,
  type ProseFont,
  THEME_PREVIEW,
  THEMES,
  type ThemeVariant,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

const modes = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

const densities: { value: Density; label: string; description: string }[] = [
  {
    value: "comfortable",
    label: "Comfortable",
    description: "Generous spacing",
  },
  { value: "compact", label: "Compact", description: "More on screen" },
];

const proseFonts: {
  value: ProseFont;
  label: string;
  description: string;
}[] = [
  {
    value: "serif",
    label: "Serif",
    description: "Editorial reading feel (default)",
  },
  {
    value: "sans",
    label: "Sans",
    description: "Plainer, UI-matching",
  },
];

function ThemeCard({
  theme,
  isActive,
  isDarkMode,
  onSelect,
}: {
  theme: (typeof THEMES)[number];
  isActive: boolean;
  isDarkMode: boolean;
  onSelect: () => void;
}) {
  const preview = THEME_PREVIEW[theme.value];
  const colors = isDarkMode ? preview.dark : preview.light;

  return (
    <button
      aria-pressed={isActive}
      className={cn(
        "group flex flex-col gap-2 overflow-hidden rounded-xl border p-3 text-left transition-all",
        isActive
          ? "border-foreground/25 ring-2 ring-accent/40 ring-offset-2 ring-offset-background"
          : "border-border/60 hover:border-foreground/15 hover:bg-muted/40"
      )}
      onClick={onSelect}
      type="button"
    >
      <div
        className="relative h-14 w-full overflow-hidden rounded-md border border-border/60"
        style={{ backgroundColor: colors.background }}
      >
        <span
          className="absolute top-1/2 left-3 -translate-y-1/2 select-none text-2xl"
          style={{
            color: colors.foreground,
            fontFamily: "var(--font-source-serif), Georgia, serif",
            fontStyle: "italic",
          }}
        >
          Aa
        </span>
        <span
          className="absolute right-3 bottom-2 size-3 rounded-full"
          style={{ backgroundColor: colors.accent }}
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="font-medium text-foreground text-sm">
          {theme.name}
        </span>
        <span className="line-clamp-1 text-[11px] text-muted-foreground/70">
          {theme.description}
        </span>
      </div>
    </button>
  );
}

export function ThemeChanger() {
  const { theme: mode, setTheme: setMode, resolvedTheme } = useTheme();
  const { theme, setTheme } = useThemeVariant();
  const { density, setDensity } = useDensity();
  const { prose, setProse } = useProseFont();
  const isDarkMode = resolvedTheme === "dark";

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Customize the look and feel of the app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Mode */}
        <div className="space-y-3">
          <p className="font-medium text-foreground text-sm">Mode</p>
          <div className="grid grid-cols-3 gap-2">
            {modes.map((modeOption) => (
              <button
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-sm transition-all",
                  mode === modeOption.value
                    ? "border-foreground/20 bg-muted text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
                key={modeOption.value}
                onClick={() => setMode(modeOption.value)}
                type="button"
              >
                <modeOption.icon className="size-5" />
                <span className="font-medium text-xs">{modeOption.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Theme variant */}
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <p className="font-medium text-foreground text-sm">Theme</p>
            <span className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-wider">
              palette
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {THEMES.map((themeOption) => (
              <ThemeCard
                isActive={theme === themeOption.value}
                isDarkMode={isDarkMode}
                key={themeOption.value}
                onSelect={() => setTheme(themeOption.value as ThemeVariant)}
                theme={themeOption}
              />
            ))}
          </div>
        </div>

        {/* Density */}
        <div className="space-y-3">
          <p className="font-medium text-foreground text-sm">Density</p>
          <div className="grid grid-cols-2 gap-2">
            {densities.map((densityOption) => (
              <button
                className={cn(
                  "flex cursor-pointer flex-col gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-all",
                  density === densityOption.value
                    ? "border-foreground/25 bg-muted text-foreground"
                    : "border-border/60 text-muted-foreground hover:border-foreground/15 hover:bg-muted/40 hover:text-foreground"
                )}
                key={densityOption.value}
                onClick={() => setDensity(densityOption.value)}
                type="button"
              >
                <span className="font-medium text-sm">
                  {densityOption.label}
                </span>
                <span className="text-[11px] text-muted-foreground/70">
                  {densityOption.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Reading font */}
        <div className="space-y-3">
          <p className="font-medium text-foreground text-sm">Reading font</p>
          <div className="grid grid-cols-2 gap-2">
            {proseFonts.map((proseOption) => (
              <button
                className={cn(
                  "flex cursor-pointer flex-col gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-all",
                  prose === proseOption.value
                    ? "border-foreground/25 bg-accent/10 text-foreground"
                    : "border-border/60 text-muted-foreground hover:border-foreground/15 hover:text-foreground"
                )}
                key={proseOption.value}
                onClick={() => setProse(proseOption.value)}
                style={{
                  fontFamily:
                    proseOption.value === "serif"
                      ? "var(--font-source-serif), Georgia, serif"
                      : undefined,
                }}
                type="button"
              >
                <span
                  className={cn(
                    "text-base",
                    proseOption.value === "serif"
                      ? "italic"
                      : "font-medium font-sans"
                  )}
                >
                  {proseOption.label}
                </span>
                <span className="font-sans text-[11px] text-muted-foreground/70">
                  {proseOption.description}
                </span>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
