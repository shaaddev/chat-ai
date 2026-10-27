"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  ATTACHMENT_LIMIT_LABEL,
  ATTACHMENT_MAX_COUNT,
  ATTACHMENT_TYPES_LABEL,
} from "@/lib/uploadthing/attachments";
import {
  type AttachmentTray,
  createAttachmentTray,
  filesOverLimit,
  type Rejection,
  readiness,
  type TrayEffects,
  type TrayItem,
  type TrayReadiness,
} from "@/lib/uploadthing/tray";
import { uploadFiles } from "@/lib/uploadthing/uploadthing";
import { generateUUID } from "@/lib/utils";
import { PreviewAttachment } from "./preview-attachment";

const UI_SPRING = {
  type: "spring",
  stiffness: 500,
  damping: 40,
  mass: 0.6,
} as const;

const FADE = { duration: 0.15 } as const;

function rejectionToast(reason: Rejection["reason"], names: string[]) {
  const [first] = names;
  const subject =
    names.length === 1 ? first : `${first} and ${names.length - 1} more`;
  if (reason === "count") {
    toast.error(
      `${subject} ${names.length === 1 ? "wasn't" : "weren't"} attached`,
      {
        description: `A message can carry up to ${ATTACHMENT_MAX_COUNT} files.`,
      }
    );
    return;
  }
  if (reason === "size") {
    toast.error(
      `${subject} ${names.length === 1 ? "is" : "are"} over the ${ATTACHMENT_LIMIT_LABEL} limit`,
      { description: `Attach files up to ${ATTACHMENT_LIMIT_LABEL} each.` }
    );
    return;
  }
  toast.error(`${subject} can't be attached`, {
    description: `Attach ${ATTACHMENT_TYPES_LABEL}.`,
  });
}

const uploadEffects: TrayEffects = {
  createId: generateUUID,
  upload: async (file, { signal, onProgress }) => {
    const [uploaded] = await uploadFiles("attachmentUploader", {
      files: [file],
      signal,
      onUploadProgress: ({ progress }) => onProgress(progress),
    });
    if (!uploaded) {
      throw new Error(`The upload of ${file.name} returned no file`);
    }
    return uploaded.ufsUrl;
  },
  discard: (url) => {
    fetch("/api/files/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    }).catch(() => undefined);
  },
  notifyFailed: (name) => {
    toast.error(`${name} didn't upload`, {
      description: "Retry it from the composer.",
    });
  },
  notifyRejected: (rejections) => {
    for (const reason of ["type", "size", "count"] as const) {
      const names = rejections
        .filter((rejection) => rejection.reason === reason)
        .map((rejection) => rejection.name);
      if (names.length > 0) {
        rejectionToast(reason, names);
      }
    }
  },
};

const traysForThisTab = new Map<string, AttachmentTray>();

export function getAttachmentTray(chatId: string): AttachmentTray {
  const existing = traysForThisTab.get(chatId);
  if (existing) {
    return existing;
  }
  const tray = createAttachmentTray(uploadEffects);
  const isBrowser = typeof window !== "undefined";
  if (isBrowser) {
    traysForThisTab.set(chatId, tray);
  }
  return tray;
}

export function moveAttachmentTray(from: string, to: string) {
  const tray = traysForThisTab.get(from);
  if (tray) {
    traysForThisTab.delete(from);
    traysForThisTab.set(to, tray);
  }
}

export const ATTACHMENT_LIMIT_HINT_ID = "attachment-limit-hint";

export const overLimitHint = (count: number) =>
  `Remove ${count} ${count === 1 ? "file" : "files"} to send. A message can carry up to ${ATTACHMENT_MAX_COUNT} files.`;

const NO_ITEMS: readonly TrayItem[] = [];

export function useTrayReadiness(tray: AttachmentTray): TrayReadiness {
  return useSyncExternalStore(
    tray.subscribe,
    () => readiness(tray.getItems()),
    () => "empty"
  );
}

export function AttachmentTrayList({ tray }: { tray: AttachmentTray }) {
  const items = useSyncExternalStore(
    tray.subscribe,
    tray.getItems,
    () => NO_ITEMS
  );
  const reduceMotion = useReducedMotion();
  const overLimit = filesOverLimit(items);

  return (
    <AnimatePresence initial={false}>
      {items.length > 0 ? (
        <motion.div
          animate={{ height: "auto", opacity: 1 }}
          className="overflow-hidden"
          exit={{ height: 0, opacity: 0 }}
          initial={{ height: 0, opacity: 0 }}
          key="tray"
          transition={reduceMotion ? { duration: 0 } : UI_SPRING}
        >
          <ul
            aria-label="Attachments"
            className="flex gap-3 overflow-x-auto px-0.5 pt-2 pr-2 pb-1.5"
            data-testid="attachments-preview"
          >
            <AnimatePresence initial={false} mode="popLayout">
              {items.map((item) => (
                <motion.li
                  animate={{ opacity: 1, y: 0 }}
                  className="shrink-0"
                  exit={{ opacity: 0, y: 6, transition: FADE }}
                  initial={{ opacity: 0, y: 6 }}
                  key={item.id}
                  layout
                  transition={{ default: UI_SPRING, opacity: FADE }}
                >
                  <PreviewAttachment
                    item={item}
                    onRemove={() => tray.remove(item.id)}
                    onRetry={() => tray.retry(item.id)}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {overLimit > 0 ? (
            <p
              className="px-1 pb-1.5 text-muted-foreground text-xs"
              id={ATTACHMENT_LIMIT_HINT_ID}
              role="status"
            >
              {overLimitHint(overLimit)}
            </p>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
