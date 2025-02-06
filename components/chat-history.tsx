import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { SidebarHistory } from "./sidebar-history";
import { SquarePen } from "lucide-react";
import Link from "next/link";

export function ChatHistory() {
  return (
    <Sidebar className="w-64 border-r border-neutral-800">
      <SidebarHeader className="p-4 flex flex-row items-center justify-between border-b mb-5">
        <h2 className="text-lg font-semibold">Chat History</h2>
        <Link href="/" className="opacity-75 hover:opacity-100 rounded-xl">
          <SquarePen className="size-4" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarHistory />
      </SidebarContent>
      <SidebarFooter className="border-t p-4 mt-5">
        <div className="w-full bg-neutral-600 rounded-xl h-full px-5 py-2">
          does it need words?
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
