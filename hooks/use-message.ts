"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const NEAR_BOTTOM_PX = 200;
const SCROLL_TO_TOP_OFFSET_PX = 16;
const SCROLL_RETRY_FRAMES = 4;

/**
 * Walks the DOM under a shadcn `ScrollArea` Root to find the actual
 * Radix viewport — that's the element that scrolls. Falls back to the
 * root if Radix's viewport attribute isn't found.
 */
function findViewport(root: HTMLElement | null): HTMLElement | null {
  if (!root) {
    return null;
  }
  return (
    root.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]") ?? root
  );
}

function distanceFromBottom(viewport: HTMLElement): number {
  return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
}

/**
 * Scroll utilities for the chat message list. The Google-AI-style pattern
 * pins the just-sent user message to the top of the viewport so the
 * assistant response grows below it. `isAtBottom` powers the floating
 * scroll-to-bottom button.
 */
export function useMessages() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    requestAnimationFrame(() => {
      const viewport = findViewport(containerRef.current);
      if (!viewport) {
        return;
      }
      viewport.scrollTo({ top: viewport.scrollHeight, behavior });
    });
  }, []);

  /**
   * Pins a specific message to the top of the viewport. Computes the
   * offset via getBoundingClientRect (reliable across scroll containers,
   * unlike `scrollIntoView` which sometimes no-ops inside Radix viewports)
   * and retries on subsequent frames so layout settling (e.g. min-height
   * wrappers being applied) doesn't strand the scroll halfway up.
   */
  const scrollUserMessageToTop = useCallback((messageId: string) => {
    let attempt = 0;
    const tryScroll = () => {
      const viewport = findViewport(containerRef.current);
      const target = viewport?.querySelector<HTMLElement>(
        `[data-message-id="${messageId}"]`
      );
      if (viewport && target) {
        const targetRect = target.getBoundingClientRect();
        const viewportRect = viewport.getBoundingClientRect();
        const offsetWithinViewport =
          targetRect.top - viewportRect.top + viewport.scrollTop;
        viewport.scrollTo({
          top: Math.max(0, offsetWithinViewport - SCROLL_TO_TOP_OFFSET_PX),
          behavior: "smooth",
        });
        return;
      }
      attempt += 1;
      if (attempt < SCROLL_RETRY_FRAMES) {
        requestAnimationFrame(tryScroll);
      }
    };
    requestAnimationFrame(tryScroll);
  }, []);

  const isNearBottom = useCallback((): boolean => {
    const viewport = findViewport(containerRef.current);
    if (!viewport) {
      return true;
    }
    return distanceFromBottom(viewport) < NEAR_BOTTOM_PX;
  }, []);

  // Track scroll position so the floating scroll-to-bottom button knows
  // when to reveal itself. Watches both scroll events and layout changes
  // (new messages appearing, images loading, etc.).
  useEffect(() => {
    const root = containerRef.current;
    if (!root) {
      return;
    }
    const viewport = findViewport(root);
    if (!viewport) {
      return;
    }

    const evaluate = () => {
      setIsAtBottom(distanceFromBottom(viewport) < NEAR_BOTTOM_PX);
    };
    evaluate();

    viewport.addEventListener("scroll", evaluate, { passive: true });
    const resizeObserver = new ResizeObserver(evaluate);
    resizeObserver.observe(viewport);
    // Children resize (assistant text streaming in) should also update.
    const inner = viewport.firstElementChild;
    if (inner) {
      resizeObserver.observe(inner);
    }

    return () => {
      viewport.removeEventListener("scroll", evaluate);
      resizeObserver.disconnect();
    };
  }, []);

  return {
    containerRef,
    isAtBottom,
    isNearBottom,
    scrollToBottom,
    scrollUserMessageToTop,
  };
}
