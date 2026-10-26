"use client";

import { motion } from "motion/react";
import { useSyncExternalStore } from "react";

const prompts = [
  "Explain how a neural network learns",
  "Draft a professional cover letter",
  "Write a bash script to rename files",
  "Compare REST vs GraphQL trade-offs",
];

const MORNING_STARTS = 5;
const AFTERNOON_STARTS = 12;
const EVENING_STARTS = 17;

function greetingFor(hour: number) {
  if (hour >= MORNING_STARTS && hour < AFTERNOON_STARTS) {
    return "Good morning";
  }
  if (hour >= AFTERNOON_STARTS && hour < EVENING_STARTS) {
    return "Good afternoon";
  }
  return "Good evening";
}

const subscribeToNothing = () => () => undefined;
const getLocalGreeting = () => greetingFor(new Date().getHours());
const greetingUnknownOnServer = () => null;

export function EmptyGreeting({ name }: { name: string | undefined }) {
  const greeting = useSyncExternalStore(
    subscribeToNothing,
    getLocalGreeting,
    greetingUnknownOnServer
  );
  const firstName = name?.trim().split(" ")[0];

  return (
    <h2 className="min-h-[1.2em] text-center font-medium text-[24px] leading-[1.2] tracking-[-0.025em] md:text-[30px]">
      {greeting && (firstName ? `${greeting}, ${firstName}` : greeting)}
    </h2>
  );
}

export function SuggestionChips({
  onSuggestionClick,
}: {
  onSuggestionClick: (text: string) => void;
}) {
  return (
    <div className="mx-auto flex max-w-[640px] flex-wrap justify-center gap-2">
      {prompts.map((text, i) => (
        <motion.button
          animate={{ opacity: 1, y: 0 }}
          className="h-9 cursor-pointer rounded-full bg-secondary px-[15px] text-[13.5px] text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
          initial={{ opacity: 0, y: 6 }}
          key={text}
          onClick={() => onSuggestionClick(text)}
          transition={{ delay: i * 0.04, duration: 0.2 }}
          type="button"
        >
          {text}
        </motion.button>
      ))}
    </div>
  );
}
