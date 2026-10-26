import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AttachmentChip({
  detail,
  icon,
  name,
  size = "tray",
}: {
  detail: ReactNode;
  icon: ReactNode;
  name: string;
  size?: "tray" | "thread";
}) {
  return (
    <span
      className={cn(
        "flex max-w-60 items-center gap-2.5 rounded-xl bg-secondary text-left",
        size === "tray"
          ? "h-[46px] py-1.5 pr-3.5 pl-1.5"
          : "h-[52px] py-2 pr-3.5 pl-2"
      )}
    >
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-[9px] bg-card text-muted-foreground",
          size === "tray" ? "size-8" : "size-9"
        )}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate font-medium text-[13px] text-foreground">
          {name}
        </span>
        <span className="truncate text-muted-foreground text-xs">{detail}</span>
      </span>
    </span>
  );
}
