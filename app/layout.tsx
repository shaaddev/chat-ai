import { MotionConfig } from "motion/react";
import type { Metadata } from "next";
import { Geist_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { ChatProvider } from "@/components/chat-context";
import { InputModality } from "@/components/input-modality";
import { PerformanceMonitor } from "@/components/performance-monitor";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  metadataBase: new URL("https://chat.shaaddev.com"),
  title: "chat",
  description: "Personal chat app for shaaddev",
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "chat",
    "mobile-web-app-capable": "yes",
    "msapplication-config": "/browserconfig.xml",
    "msapplication-TileColor": "#000000",
    "msapplication-tap-highlight": "no",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link href="/manifest.json" rel="manifest" />
      </head>
      <body
        className={`${instrumentSans.variable} ${geistMono.variable} bg-background font-sans text-foreground antialiased`}
      >
        <InputModality />
        <ThemeProvider>
          <MotionConfig reducedMotion="user">
            <ChatProvider>
              <main className="lg:mx-auto">{children}</main>
              <Toaster />
            </ChatProvider>
          </MotionConfig>
        </ThemeProvider>
        {process.env.NODE_ENV === "development" && <PerformanceMonitor />}
      </body>
    </html>
  );
}
