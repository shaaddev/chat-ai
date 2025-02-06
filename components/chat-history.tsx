import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { SidebarHistory } from "./sidebar-history";
import { SquarePen } from "lucide-react";
import Link from "next/link";

export function ChatHistory() {
  return (
    <Sidebar className="w-64 border-r border-neutral-800">
      <SidebarHeader className="p-4 flex flex-row items-center justify-between">
        <h2 className="text-lg font-semibold">Chat History</h2>
        <Link href="/" className="opacity-75 hover:opacity-100 rounded-xl">
          <SquarePen className="size-4" />
        </Link>
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
