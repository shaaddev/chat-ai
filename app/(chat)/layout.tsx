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
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </SidebarProvider>
  );
}
