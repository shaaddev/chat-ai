"use client";

import { Check, Copy, type LucideIcon } from "lucide-react";
import { type ReactNode, type Ref, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const COPIED_FEEDBACK_MS = 2000;

export function MessageActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-0.5 pointer-fine:opacity-0 transition-opacity duration-200 focus-within:opacity-100 pointer-fine:group-hover/message:opacity-100",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ActionButton({
  icon: Icon,
  label,
  onClick,
  ref,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      aria-label={label}
      className="flex size-8 cursor-pointer items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onClick}
      ref={ref}
      title={label}
      type="button"
    >
      <Icon aria-hidden className="size-4" />
    </button>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timeoutId = window.setTimeout(
      () => setCopied(false),
      COPIED_FEEDBACK_MS
    );
    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
  };

  return (
    <ActionButton
      icon={copied ? Check : Copy}
      label={copied ? "Copied" : "Copy message"}
      onClick={copy}
    />
  );
}
