"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

// Dynamically import the Chat component to reduce initial bundle size
const Chat = dynamic(
  () => import("@/components/chat").then((mod) => ({ default: mod.Chat })),
  {
    loading: () => (
      <div className="flex flex-col min-h-screen w-full">
        <div className="flex items-center p-4 gap-2">
          <div className="w-10 h-10 bg-neutral-800 rounded-xl animate-pulse" />
          <div className="w-20 h-6 bg-neutral-800 rounded animate-pulse" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-neutral-400">Loading chat...</div>
        </div>
      </div>
    ),
    ssr: false,
  },
);

interface DynamicChatProps {
  id: string;
  initialChatModel: string;
  initialMessages: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  session: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export function DynamicChat({
  id,
  initialChatModel,
  initialMessages,
  session,
}: DynamicChatProps) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col min-h-screen w-full">
          <div className="flex items-center p-4 gap-2">
            <div className="w-10 h-10 bg-neutral-800 rounded-xl animate-pulse" />
            <div className="w-20 h-6 bg-neutral-800 rounded animate-pulse" />
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-neutral-400">Loading chat...</div>
          </div>
        </div>
      }
    >
      <Chat
        id={id}
        initialChatModel={initialChatModel}
        initialMessages={initialMessages}
        session={session}
      />
    </Suspense>
  );
}
