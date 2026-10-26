"use client";

import { ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";

const TICK_MS = 1000;

function toSeconds(ms: number) {
  return Math.floor(ms / TICK_MS);
}

function useThinkingLabel(isThinking: boolean) {
  const [startedAt] = useState(() => (isThinking ? Date.now() : null));
  const [now, setNow] = useState(startedAt);
  const [endedAt, setEndedAt] = useState<number | null>(null);

  useEffect(() => {
    if (startedAt === null) {
      return;
    }
    if (!isThinking) {
      setEndedAt((current) => current ?? Date.now());
      return;
    }
    const intervalId = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(intervalId);
  }, [isThinking, startedAt]);

  if (startedAt === null) {
    return { label: "Thought process", seconds: null };
  }
  if (isThinking) {
    return {
      label: "Thinking",
      seconds: toSeconds((now ?? startedAt) - startedAt),
    };
  }
  const duration = Math.max(1, toSeconds((endedAt ?? Date.now()) - startedAt));
  return { label: `Thought for ${duration}s`, seconds: null };
}

export function MessageReasoning({
  isThinking,
  text,
}: {
  isThinking: boolean;
  text: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const contentId = useId();
  const { label, seconds } = useThinkingLabel(isThinking);

  return (
    <div className="mb-2.5">
      <button
        aria-controls={isOpen ? contentId : undefined}
        aria-expanded={isOpen}
        className="-ml-1.5 inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg px-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        <span>{label}</span>
        {seconds === null ? null : (
          <span className="tabular-nums">{seconds}s</span>
        )}
        <ChevronRight
          aria-hidden
          className={cn(
            "size-3.5 transition-transform duration-200",
            isOpen && "rotate-90"
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            aria-label="Reasoning"
            className="mt-1.5 border-border border-l-2 pl-3.5 text-muted-foreground [&>div]:text-[13.5px] [&>div]:text-muted-foreground"
            exit={{ opacity: 0, y: -4 }}
            id={contentId}
            initial={{ opacity: 0, y: -4 }}
            role="region"
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            <Markdown isStreaming={isThinking}>{text}</Markdown>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
