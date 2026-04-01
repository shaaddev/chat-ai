"use client";

import { motion } from "motion/react";
import { Code, Globe, MessageSquareText, Sparkles } from "lucide-react";

const suggestions = [
  { icon: Sparkles, text: "Explain quantum computing simply" },
  { icon: Code, text: "Write a React custom hook" },
  { icon: Globe, text: "Summarize today's tech news" },
  { icon: MessageSquareText, text: "Help me draft an email" },
];

interface EmptyChatStateProps {
  onSuggestionClick?: (text: string) => void;
}

export function EmptyChatState({ onSuggestionClick }: EmptyChatStateProps) {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex flex-col items-center gap-8 max-w-lg w-full"
      >
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold text-foreground">
            How can I help?
          </h2>
          <p className="text-muted-foreground text-sm">
            Start a conversation or try one of these
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
          {suggestions.map((s, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.05, duration: 0.3 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-3 rounded-xl border border-border p-4 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
              onClick={() => onSuggestionClick?.(s.text)}
            >
              <s.icon className="size-4 shrink-0 text-primary" />
              <span>{s.text}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
