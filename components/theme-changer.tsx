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
] as const;

export function ThemeChanger() {
  const { theme, setTheme } = useTheme();
  const { accentColor, setAccentColor } = useAccentColor();

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
          <label className="text-sm font-medium text-foreground">Mode</label>
          <div className="grid grid-cols-3 gap-2">
            {modes.map((mode) => (
              <button
                key={mode.value}
                onClick={() => setTheme(mode.value)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl px-3 py-3 text-sm transition-all cursor-pointer border",
                  theme === mode.value
                    ? "border-foreground/20 bg-accent text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50",
                )}
              >
                <mode.icon className="size-5" />
                <span className="text-xs font-medium">{mode.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Accent */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">
            Accent
          </label>
          <div className="flex flex-wrap gap-3">
            {ACCENT_COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() => setAccentColor(color.value)}
                className="group flex flex-col items-center gap-1.5 cursor-pointer"
                title={color.name}
              >
                <div
                  className={cn(
                    "size-8 rounded-full transition-all",
                    accentColor === color.value
                      ? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110"
                      : "hover:scale-105 opacity-70 hover:opacity-100",
                  )}
                  style={{
                    backgroundColor:
                      ACCENT_SWATCHES[color.value as AccentColor],
                  }}
                />
                <span
                  className={cn(
                    "text-[10px]",
                    accentColor === color.value
                      ? "text-foreground font-medium"
                      : "text-muted-foreground/60",
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
