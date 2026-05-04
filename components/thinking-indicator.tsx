"use client";

import { motion } from "motion/react";

export function ThinkingIndicator() {
  return (
    <motion.div
      animate={{ opacity: 1 }}
      aria-label="Generating response"
      className="flex items-center gap-1.5 py-2"
      initial={{ opacity: 0 }}
      role="status"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          animate={{ opacity: [0.3, 0.95, 0.3], y: [0, -2, 0] }}
          className="size-[6px] rounded-full bg-muted-foreground"
          key={i}
          transition={{
            delay: i * 0.16,
            duration: 1.3,
            ease: "easeInOut",
            repeat: Number.POSITIVE_INFINITY,
          }}
        />
      ))}
    </motion.div>
  );
}
