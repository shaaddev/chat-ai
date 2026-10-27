"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

// Sonner uses PHONE_HEADER_CLEARANCE below 600 px wide and
// HEADER_CLEARANCE above.
const HEADER_CLEARANCE = 64;
const PHONE_HEADER_CLEARANCE = 58;

const Toaster = (props: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      className="toaster group"
      mobileOffset={{ top: PHONE_HEADER_CLEARANCE }}
      offset={{ top: HEADER_CLEARANCE }}
      position="top-center"
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
