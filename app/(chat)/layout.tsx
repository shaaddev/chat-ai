import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { auth } from "@/app/auth";
import { ChatHistory } from "@/components/chat-history";
import { SidebarProvider } from "@/components/ui/sidebar";

export default async function ChatLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <ChatHistory session={session} />
      <div className="flex h-dvh min-w-0 flex-1 flex-col md:py-2 md:pr-2 md:peer-data-[state=collapsed]:pl-2">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-card md:rounded-2xl">
          {children}
        </div>
      </div>
    </SidebarProvider>
  );
}
