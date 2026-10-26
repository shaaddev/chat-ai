"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useSidebar } from "@/components/ui/sidebar";

export function NewChat() {
  const { setOpenMobile } = useSidebar();

  return (
    <Link
      className="mx-3 mt-3 mb-1.5 flex h-[38px] items-center gap-2 rounded-[10px] bg-card px-3 font-medium text-foreground text-sm outline-hidden transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
      data-new-chat=""
      href="/"
      onNavigate={() => setOpenMobile(false)}
    >
      <Plus aria-hidden className="size-4" />
      New chat
    </Link>
  );
}
