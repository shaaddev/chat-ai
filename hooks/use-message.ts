"use client";

import { useCallback, useRef } from "react";

const NEAR_BOTTOM_PX = 200;

/**
 * Scroll utilities for the chat message list. The Google-AI-style pattern
 * pins the just-sent user message to the top of the viewport so the
 * assistant response grows below it. We keep a fallback scroll-to-bottom
 * for the case where the user is already at the bottom and the response
 * has finished — feels natural for short follow-up messages.
 */
export function useMessages() {
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollUserMessageToTop = useCallback((messageId: string) => {
    requestAnimationFrame(() => {
      const root = containerRef.current;
      if (!root) {
        return;
      }
      const target = root.querySelector<HTMLElement>(
        `[data-message-id="${messageId}"]`
      );
      if (target) {
        target.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    });
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior });
    });
  }, []);

  /**
   * Returns true when the chat scroll viewport is within `NEAR_BOTTOM_PX`
   * pixels of its bottom — i.e. the user is "following" the conversation.
   * Used to decide whether to gently scroll on stream completion.
   */
  const isNearBottom = useCallback((): boolean => {
    const root = containerRef.current;
    if (!root) {
      return false;
    }
    // The ScrollArea component nests its scrollable viewport via Radix.
    const viewport = root.querySelector<HTMLElement>(
      "[data-radix-scroll-area-viewport]"
    );
    const scroller = viewport ?? root;
    const distance =
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    return distance < NEAR_BOTTOM_PX;
  }, []);

  return {
    containerRef,
    messagesEndRef,
    scrollUserMessageToTop,
    scrollToBottom,
    isNearBottom,
  };
}
