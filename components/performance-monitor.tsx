"use client";

import { useEffect } from "react";

export function PerformanceMonitor() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Monitor Core Web Vitals
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === "largest-contentful-paint") {
            console.log("LCP:", entry.startTime);
          }
          if (entry.entryType === "first-input") {
            const firstInputEntry = entry as PerformanceEventTiming;
            console.log(
              "FID:",
              firstInputEntry.processingStart - firstInputEntry.startTime,
            );
          }
          if (entry.entryType === "layout-shift") {
            const layoutShiftEntry = entry as any; // eslint-disable-line @typescript-eslint/no-explicit-any
            console.log("CLS:", layoutShiftEntry.value);
          }
        }
      });

      observer.observe({
        entryTypes: ["largest-contentful-paint", "first-input", "layout-shift"],
      });

      // Monitor navigation timing
      const navigationEntry = performance.getEntriesByType(
        "navigation",
      )[0] as PerformanceNavigationTiming;
      if (navigationEntry) {
        console.log(
          "Page Load Time:",
          navigationEntry.loadEventEnd - navigationEntry.loadEventStart,
        );
        console.log(
          "DOM Content Loaded:",
          navigationEntry.domContentLoadedEventEnd -
            navigationEntry.domContentLoadedEventStart,
        );
      }

      return () => observer.disconnect();
    }
  }, []);

  return null;
}
