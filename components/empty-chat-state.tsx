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
    <div className="flex flex-1 items-end justify-center pb-8 px-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-2xl space-y-4"
      >
        <div className="flex flex-wrap gap-2 justify-center">
          {prompts.map((text, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.06, duration: 0.35 }}
              className="rounded-lg border border-border px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors cursor-pointer"
              onClick={() => onSuggestionClick?.(text)}
            >
              {text}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
