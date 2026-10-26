"use client";

import { SquarePen } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function NewChat() {
  const { setOpenMobile } = useSidebar();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          asChild
          className="size-8 rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          size="icon"
          variant="ghost"
        >
          <Link
            aria-label="New chat"
            data-new-chat=""
            href="/"
            onNavigate={() => setOpenMobile(false)}
          >
            <SquarePen aria-hidden className="size-4" />
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent className="rounded-lg">New chat</TooltipContent>
    </Tooltip>
  );
}
