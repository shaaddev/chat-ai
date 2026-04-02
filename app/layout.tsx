import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { ChatProvider } from "@/components/chat-context";
import { PerformanceMonitor } from "@/components/performance-monitor";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { getToken } from "@/lib/auth-server";
import { ConvexClientProvider } from "@/lib/convex/client";

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
  maximumScale: 1,
  width: "device-width",
  initialScale: 1,
  userScalable: false,
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get initial token, gracefully handle errors (user not authenticated)
  let initialToken: string | null = null;
  try {
    const token = await getToken();
    initialToken = token ?? null;
  } catch {
    // User not authenticated - this is expected for logged out users
    initialToken = null;
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Anti-FOUC script for accent color */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var accent = localStorage.getItem('accent-color') || 'blue';
                document.documentElement.setAttribute('data-accent', accent);
              } catch(e) {}
            `,
          }}
        />
        <link href="https://fonts.googleapis.com" rel="preconnect" />
        <link
          crossOrigin="anonymous"
          href="https://fonts.gstatic.com"
          rel="preconnect"
        />
        <link href="//fonts.googleapis.com" rel="dns-prefetch" />
        <link href="/manifest.json" rel="manifest" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-background text-foreground antialiased`}
      >
        <ThemeProvider>
          <ConvexClientProvider initialToken={initialToken}>
            <ChatProvider>
              <main className="lg:mx-auto">{children}</main>
              <Toaster position="bottom-right" />
            </ChatProvider>
          </ConvexClientProvider>
        </ThemeProvider>
        {process.env.NODE_ENV === "development" && <PerformanceMonitor />}
        <Script
          dangerouslySetInnerHTML={{
            __html: `
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js')
                      .then(function(registration) {
                        console.log('SW registered: ', registration);
                      })
                      .catch(function(registrationError) {
                        console.log('SW registration failed: ', registrationError);
                      });
                  });
                }
              `,
          }}
          id="service-worker"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
