import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ViewTransitions } from "next-view-transitions";
import { Toaster } from "@/components/ui/sonner";
import { ChatProvider } from "@/components/chat-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "chat - shaaddev",
  description: "personal chat app for shaaddev",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ViewTransitions>
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased bg-neutral-900`}
        >
          <ChatProvider>
            <main className="lg:mx-auto">{children}</main>
            <Toaster position="bottom-right" className="bg-neutral-800" />
          </ChatProvider>
        </body>
      </html>
    </ViewTransitions>
  );
}
