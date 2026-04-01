"use client";

import { motion } from "motion/react";

export function ThinkingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-1 py-2"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-[5px] rounded-full bg-muted-foreground/60"
          animate={{ opacity: [0.25, 0.8, 0.25] }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            delay: i * 0.18,
            ease: "easeInOut",
          }}
        />
      ))}
    </motion.div>
  );
}
