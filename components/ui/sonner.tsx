"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

// Sonner's phone layout, and its mobileOffset, apply up to 600 px wide.
const PHONE_QUERY = "(max-width: 600px)";
const HEADER_CLEARANCE = 64;
const PHONE_COMPOSER_PADDING = 10;
const TOAST_GAP = 12;
// On a phone the thread pins the message just sent under the header, so
// toasts sit just above the composer, which publishes its height.
const COMPOSER_CLEARANCE = `calc(var(--composer-height, 0px) + ${PHONE_COMPOSER_PADDING + TOAST_GAP}px)`;

const subscribeToPhone = (onChange: () => void) => {
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const isPhone = () => window.matchMedia(PHONE_QUERY).matches;

const Toaster = (props: ToasterProps) => {
  const { theme = "system" } = useTheme();
  const phone = useSyncExternalStore(subscribeToPhone, isPhone, () => false);

  return (
    <Sonner
      className="toaster group"
      mobileOffset={{ bottom: COMPOSER_CLEARANCE }}
      offset={{ top: HEADER_CLEARANCE }}
      position={phone ? "bottom-center" : "top-center"}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "12px",
        } as React.CSSProperties
      }
      theme={theme as ToasterProps["theme"]}
      {...props}
    />
  );
};

export { Toaster };
