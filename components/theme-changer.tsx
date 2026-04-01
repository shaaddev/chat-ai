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
import { ACCENT_COLORS, ACCENT_SWATCHES, type AccentColor } from "@/lib/theme";
import { useAccentColor } from "@/hooks/use-accent-color";
import { cn } from "@/lib/utils";

const modes = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeChanger() {
  const { theme, setTheme } = useTheme();
  const { accentColor, setAccentColor } = useAccentColor();

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Customize how the app looks and feels
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Mode Selector */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">Mode</label>
          <div className="flex gap-2">
            {modes.map((mode) => (
              <button
                key={mode.value}
                onClick={() => setTheme(mode.value)}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all cursor-pointer",
                  "border hover:bg-accent",
                  theme === mode.value
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-transparent text-muted-foreground",
                )}
              >
                <mode.icon className="size-4" />
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Accent Color Selector */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">
            Accent Color
          </label>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
            {ACCENT_COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() => setAccentColor(color.value)}
                className="group flex flex-col items-center gap-1.5 cursor-pointer"
                title={color.name}
              >
                <div
                  className={cn(
                    "size-10 rounded-full border-2 transition-all",
                    "hover:scale-110",
                    accentColor === color.value
                      ? "border-foreground ring-2 ring-ring ring-offset-2 ring-offset-background"
                      : "border-transparent",
                  )}
                  style={{
                    backgroundColor:
                      ACCENT_SWATCHES[color.value as AccentColor],
                  }}
                />
                <span
                  className={cn(
                    "text-xs",
                    accentColor === color.value
                      ? "text-foreground font-medium"
                      : "text-muted-foreground",
                  )}
                >
                  {color.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
