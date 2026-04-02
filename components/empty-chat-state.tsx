"use client";

import { motion } from "motion/react";

interface EmptyChatStateProps {
  onSuggestionClick?: (text: string) => void;
}

const prompts = [
  "Explain how a neural network learns",
  "Draft a professional cover letter",
  "Write a bash script to rename files",
  "Compare REST vs GraphQL trade-offs",
];

export function EmptyChatState({ onSuggestionClick }: EmptyChatStateProps) {
  return (
    <div className="flex flex-1 items-end justify-center px-4 pb-8">
      <motion.div
        animate={{ opacity: 1 }}
        className="w-full max-w-2xl space-y-4"
        initial={{ opacity: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="flex flex-wrap justify-center gap-2">
          {prompts.map((text, i) => (
            <motion.button
              animate={{ opacity: 1, y: 0 }}
              className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
              initial={{ opacity: 0, y: 6 }}
              key={i}
              onClick={() => onSuggestionClick?.(text)}
              transition={{ delay: 0.2 + i * 0.06, duration: 0.35 }}
            >
              {text}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
