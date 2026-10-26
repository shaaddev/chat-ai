import { addDays, isSameDay, startOfDay } from "date-fns";
import { useEffect, useState } from "react";

/**
 * The current local date, refreshed when the day rolls over. One timer waits
 * for the next local midnight, and a check when the tab is shown again
 * catches a machine that slept through it.
 */
export function useToday(): Date {
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    const untilMidnight = startOfDay(addDays(today, 1)).getTime() - Date.now();
    const timeoutId = window.setTimeout(
      () => setToday(new Date()),
      Math.max(untilMidnight, 0)
    );
    const catchUp = () =>
      setToday((current) => {
        const now = new Date();
        return isSameDay(current, now) ? current : now;
      });
    document.addEventListener("visibilitychange", catchUp);
    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", catchUp);
    };
  }, [today]);

  return today;
}
