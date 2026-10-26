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
    <Sidebar className="border-border bg-sidebar">
      <SidebarHeader className="flex-row items-center p-2">
        <NewChat />
      </SidebarHeader>
      <SidebarContent>
        <SidebarHistory session={session} />
      </SidebarContent>
      <SidebarFooter className="border-border border-t p-2">
        {session ? (
          <SidebarUser email={session.user.email} name={session.user.name} />
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className="rounded-lg focus-visible:ring-ring"
              >
                <Link href="/login">Log in</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
