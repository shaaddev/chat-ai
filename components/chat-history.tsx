import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import type { Session } from "@/lib/auth";
import { LoginBtn } from "./auth/login-btn";
import { NewChat } from "./new-chat-btn";
import { SidebarHistory } from "./sidebar-history";
import { SidebarUser } from "./sidebar-user";

export function ChatHistory({ session }: { session: Session | null }) {
  return (
    <Sidebar className="w-64 border-none bg-sidebar">
      <SidebarHeader className="p-2 flex flex-row items-center justify-start mb-4">
        <NewChat />
      </SidebarHeader>
      <SidebarContent>
        <SidebarHistory session={session} />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        {session ? (
          <SidebarUser
            email={session?.user.email}
            name={session?.user.name}
          />
        ) : (
          <LoginBtn />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
