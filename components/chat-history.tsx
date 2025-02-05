import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { SidebarHistory } from "./sidebar-history";

export function ChatHistory() {
  return (
    <Sidebar className="w-64 border-r border-neutral-800">
      <SidebarHeader className="p-4">
        <h2 className="text-lg font-semibold">Chat History</h2>
      </SidebarHeader>
      <SidebarContent>
        {/* Add chat history items here */}
        <SidebarHistory />
        {/* <div className="p-4">
            <p className="text-gray-400">No chat history yet</p>
          </div> */}
      </SidebarContent>
    </Sidebar>
  );
}
