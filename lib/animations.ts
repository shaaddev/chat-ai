// Shared animation presets used across the app

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const fadeInUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
};

export const slideInFromLeft = {
  initial: { x: -16, opacity: 0 },
  animate: { x: 0, opacity: 1 },
};

export const slideInFromRight = {
  initial: { x: 16, opacity: 0 },
  animate: { x: 0, opacity: 1 },
};

// Spring configs
export const snappy = { type: "spring" as const, stiffness: 500, damping: 30 };
export const gentle = {
  type: "spring" as const,
  stiffness: 260,
  damping: 25,
};
export const smooth = {
  duration: 0.2,
  ease: [0.25, 0.1, 0.25, 1] as const,
};

// Stagger children
export const stagger = (staggerChildren = 0.03) => ({
  animate: { transition: { staggerChildren } },
});
