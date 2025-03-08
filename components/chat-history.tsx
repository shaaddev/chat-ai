import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { SidebarHistory } from "./sidebar-history";
import { SidebarUser } from "./sidebar-user";
import { NewChat } from "./new-chat-btn";
import { LoginDialog } from "./auth/login-dialog";
import { Session } from "@/lib/auth";

export function ChatHistory({ session }: { session: Session | null }) {
  return (
    <Sidebar className="w-64 border-r border-neutral-800">
      <SidebarHeader className="p-4 flex flex-row items-center justify-between border-b mb-5">
        <h2 className="text-lg font-semibold">Chat History</h2>
        <NewChat />
      </SidebarHeader>
      <SidebarContent>
        <SidebarHistory />
      </SidebarContent>
      <SidebarFooter className="border-t p-4 mt-5">
        {session ? (
          <SidebarUser email={session?.user.email} />
        ) : (
          <LoginDialog />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
