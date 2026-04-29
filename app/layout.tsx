import type { Metadata } from "next";
import { Geist, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";
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

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
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
        {/* Anti-FOUC: hydrate the active theme variant + density before paint.
            Migrates legacy `accent-color` localStorage values to the new
            `chat-ai:theme` key. */}
        <script>{`
          try {
            var theme = localStorage.getItem('chat-ai:theme');
            if (!theme) {
              var legacy = localStorage.getItem('accent-color');
              if (legacy === 'blue' || legacy === 'teal' || legacy === 'purple') {
                theme = 'ink';
              } else if (legacy === 'green') {
                theme = 'terminal';
              } else {
                theme = 'paper';
              }
              localStorage.setItem('chat-ai:theme', theme);
            }
            document.documentElement.setAttribute('data-theme', theme);

            var density = localStorage.getItem('chat-ai:density') || 'comfortable';
            document.documentElement.setAttribute('data-density', density);

            var prose = localStorage.getItem('chat-ai:prose') || 'serif';
            document.documentElement.setAttribute('data-prose', prose);
          } catch (_error) {
          }
        `}</script>
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
        className={`${geistSans.variable} ${sourceSerif.variable} ${jetbrainsMono.variable} bg-background text-foreground antialiased`}
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
      </body>
    </html>
  );
}
