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
import { cn } from "@/lib/utils";

const modes = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function ThemeChanger() {
  const { theme: mode, setTheme: setMode } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Choose light, dark, or match your system.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          {modes.map((modeOption) => (
            <button
              aria-pressed={mode === modeOption.value}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-1.5 rounded-xl px-3 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                mode === modeOption.value
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              key={modeOption.value}
              onClick={() => setMode(modeOption.value)}
              type="button"
            >
              <modeOption.icon aria-hidden className="size-5" />
              <span className="font-medium text-xs">{modeOption.label}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
