"use client";

import { useEffect, useRef, useState } from "react";

const BASE_CHARS_PER_FRAME = 2;
// Larger buffers reveal faster so we can keep up with bursty network chunks
// without ever falling visibly behind. ~3 chars/frame at 60fps ≈ 180 chars/sec
// baseline; large buffers can reveal up to ~remaining/30 per frame.
const CATCHUP_DIVISOR = 30;

/**
 * Smooths streamed text reveal by decoupling visual cadence from network
 * chunk arrival. Maintains an internal cursor that advances toward `target`
 * one or more characters per animation frame, so the assistant text appears
 * to flow at a steady rate even when the model emits in bursts.
 *
 * - When `isStreaming` is `false` the hook short-circuits and returns the
 *   full target immediately (no animation overhead on historical messages).
 * - When `target` shrinks (e.g. a new message replaces the old), the
 *   internal cursor resets so the new content animates from the start.
 */
export function useSmoothText(target: string, isStreaming: boolean): string {
  const [displayed, setDisplayed] = useState(target);
  const indexRef = useRef(target.length);
  const targetRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  // Keep latest target accessible inside the RAF loop without re-creating it.
  targetRef.current = target;

  useEffect(() => {
    if (!isStreaming) {
      // Snap to full text and reset the cursor for the next stream.
      indexRef.current = target.length;
      setDisplayed(target);
      return;
    }

    // If the target shrank (new assistant message starting fresh) reset
    // the cursor so we animate from the beginning of the new content.
    if (indexRef.current > target.length) {
      indexRef.current = 0;
      setDisplayed("");
    }

    const tick = () => {
      const fullText = targetRef.current;
      const remaining = fullText.length - indexRef.current;

      if (remaining > 0) {
        const step = Math.max(
          BASE_CHARS_PER_FRAME,
          Math.ceil(remaining / CATCHUP_DIVISOR)
        );
        indexRef.current = Math.min(fullText.length, indexRef.current + step);
        setDisplayed(fullText.slice(0, indexRef.current));
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isStreaming, target]);

  return displayed;
}
