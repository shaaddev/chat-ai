import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({
  children,
  className,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(
      "flex flex-col gap-2 overflow-hidden text-base text-foreground leading-relaxed",
      className
    )}
    {...props}
  >
    {children}
  </div>
);
