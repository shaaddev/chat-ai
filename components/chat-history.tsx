import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { Session } from "@/lib/auth";
import { NewChat } from "./new-chat-btn";
import { SidebarHistory } from "./sidebar-history";
import { SidebarUser } from "./sidebar-user";

export function ChatHistory({ session }: { session: Session | null }) {
  return (
    <Sidebar className="bg-sidebar">
      <SidebarHeader className="gap-0 p-0 pt-3.5">
        <p className="flex h-9 select-none items-center pl-[18px] font-semibold text-[19px] leading-none tracking-[-0.035em]">
          chat<span className="text-primary">.</span>
        </p>
        <NewChat />
      </SidebarHeader>
      <SidebarContent>
        <SidebarHistory session={session} />
      </SidebarContent>
      <SidebarFooter className="px-3 pt-3 pb-2.5">
        {session ? (
          <SidebarUser email={session.user.email} name={session.user.name} />
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild className="focus-visible:ring-ring">
                <Link href="/login">Log in</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
