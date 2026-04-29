"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";

interface EmptyChatStateProps {
  onSuggestionClick?: (text: string) => void;
}

const prompts = [
  "Explain how a neural network learns",
  "Draft a professional cover letter",
  "Write a bash script to rename files",
  "Compare REST vs GraphQL trade-offs",
];

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
});

const DATE_STAMP_FORMATTER = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const DATE_STAMP_DAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
});

function getGreeting(now: Date): string {
  const hour = now.getHours();
  const weekday = WEEKDAY_FORMATTER.format(now);
  if (hour < 5) {
    return "Late night.";
  }
  if (hour < 12) {
    return `Good morning. ${weekday}.`;
  }
  if (hour < 17) {
    return `${weekday} afternoon.`;
  }
  if (hour < 21) {
    return "Good evening.";
  }
  return `${weekday} night.`;
}

function formatDateStamp(now: Date): string {
  // 29 APR 2026 · TUE
  const date = DATE_STAMP_FORMATTER.format(now).toUpperCase().replace(",", "");
  const day = DATE_STAMP_DAY_FORMATTER.format(now).toUpperCase();
  return `${date} · ${day}`;
}

export function EmptyChatState({ onSuggestionClick }: EmptyChatStateProps) {
  // Stamp values once on mount so they don't shift mid-frame after hydration.
  const [stamp, setStamp] = useState<{
    greeting: string;
    date: string;
  } | null>(null);

  useEffect(() => {
    const now = new Date();
    setStamp({
      greeting: getGreeting(now),
      date: formatDateStamp(now),
    });
  }, []);

  return (
    <div className="flex flex-1 items-end justify-center px-4 pb-10">
      <motion.div
        animate={{ opacity: 1 }}
        className="w-full max-w-2xl space-y-8"
        initial={{ opacity: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="font-mono text-[10px] text-muted-foreground/45 uppercase tracking-[0.22em]">
            {stamp?.date ?? " "}
          </p>
          <h2 className="font-serif text-[28px] text-foreground/80 italic leading-tight tracking-tight sm:text-[32px]">
            {stamp?.greeting ?? " "}
          </h2>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {prompts.map((text, i) => (
            <motion.button
              animate={{ opacity: 1, y: 0 }}
              className="cursor-pointer rounded-full border border-foreground/8 bg-card/40 px-3.5 py-1.5 font-sans text-[12.5px] text-muted-foreground transition-all hover:border-foreground/20 hover:bg-card hover:text-foreground"
              initial={{ opacity: 0, y: 6 }}
              key={text}
              onClick={() => onSuggestionClick?.(text)}
              transition={{ delay: 0.25 + i * 0.06, duration: 0.35 }}
              type="button"
            >
              {text}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
