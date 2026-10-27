"use client";

import { Paperclip } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ATTACHMENT_LIMIT_LABEL } from "@/lib/uploadthing/attachments";
import type { AttachmentTray } from "@/lib/uploadthing/tray";
import { cn } from "@/lib/utils";

function carriesFiles(event: DragEvent) {
  return event.dataTransfer?.types.includes("Files") ?? false;
}

function DropOverlay() {
  return (
    <motion.div
      animate={{ opacity: 1 }}
      aria-hidden
      className="absolute inset-0 z-40 bg-card/93 p-3.5 backdrop-blur-[6px]"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <div className="flex h-full flex-col items-center justify-center gap-2.5 rounded-[18px] border-[1.5px] border-primary/65 border-dashed bg-primary/6 p-5 text-center">
        <span className="mb-1.5 grid size-14 place-items-center rounded-full bg-secondary text-primary">
          <Paperclip className="size-6" />
        </span>
        <p className="font-medium text-foreground text-xl">
          Drop files to attach
        </p>
        <p className="text-muted-foreground text-sm">
          Images and PDFs up to {ATTACHMENT_LIMIT_LABEL} each
        </p>
      </div>
    </motion.div>
  );
}

export function AttachmentDropZone({
  children,
  className,
  isAuthenticated,
  tray,
}: {
  children: ReactNode;
  className?: string;
  isAuthenticated: boolean;
  tray: AttachmentTray;
}) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone) {
      return;
    }
    // dragenter and dragleave fire for every child the pointer crosses, so
    // count them and hide only when the pointer has left the zone itself.
    let depth = 0;
    const onDragEnter = (event: DragEvent) => {
      if (carriesFiles(event)) {
        event.preventDefault();
        depth += 1;
        setIsDragging(true);
      }
    };
    const onDragOver = (event: DragEvent) => {
      if (carriesFiles(event) && event.dataTransfer) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }
    };
    const onDragLeave = (event: DragEvent) => {
      if (carriesFiles(event)) {
        depth = Math.max(0, depth - 1);
        if (depth === 0) {
          setIsDragging(false);
        }
      }
    };
    const onDrop = (event: DragEvent) => {
      if (!carriesFiles(event)) {
        return;
      }
      event.preventDefault();
      depth = 0;
      setIsDragging(false);
      if (!isAuthenticated) {
        toast("Sign in to attach files");
        return;
      }
      tray.add(Array.from(event.dataTransfer?.files ?? []));
    };
    zone.addEventListener("dragenter", onDragEnter);
    zone.addEventListener("dragover", onDragOver);
    zone.addEventListener("dragleave", onDragLeave);
    zone.addEventListener("drop", onDrop);
    return () => {
      zone.removeEventListener("dragenter", onDragEnter);
      zone.removeEventListener("dragover", onDragOver);
      zone.removeEventListener("dragleave", onDragLeave);
      zone.removeEventListener("drop", onDrop);
    };
  }, [isAuthenticated, tray]);

  return (
    <div className={cn("relative", className)} ref={zoneRef}>
      {children}
      <AnimatePresence>
        {isDragging ? <DropOverlay key="drop-overlay" /> : null}
      </AnimatePresence>
    </div>
  );
}
