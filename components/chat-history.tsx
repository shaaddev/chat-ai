import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { SidebarHistory } from "./sidebar-history";
import { SidebarUser } from "./sidebar-user";
import { NewChat } from "./new-chat-btn";
import { Session } from "@/lib/auth";
import { LoginBtn } from "./auth/login-btn";

export function ChatHistory({ session }: { session: Session | null }) {
  return (
    <Sidebar className="w-64 border-none">
      <SidebarHeader className="p-2 flex flex-row items-center justify-start mb-5">
        <NewChat />
      </SidebarHeader>
      <SidebarContent>
        <SidebarHistory session={session} />
      </SidebarContent>
      <SidebarFooter className="border-t p-4 mt-5">
        {session ? (
          <SidebarUser
            email={session?.user.email}
            // avatar={session?.user.avatar}
            name={session?.user.name}
          />
        ) : (
          <LoginBtn />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
