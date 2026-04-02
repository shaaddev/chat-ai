"use client";

import { motion } from "motion/react";

export function ThinkingIndicator() {
  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="flex items-center gap-1 py-2"
      initial={{ opacity: 0 }}
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          animate={{ opacity: [0.25, 0.8, 0.25] }}
          className="size-[5px] rounded-full bg-muted-foreground/60"
          key={i}
          transition={{
            duration: 1.4,
            repeat: Number.POSITIVE_INFINITY,
            delay: i * 0.18,
            ease: "easeInOut",
          }}
        />
      ))}
    </motion.div>
  );
}
