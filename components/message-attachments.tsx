"use client";

import { FileText } from "lucide-react";
import Image, { type ImageLoaderProps } from "next/image";
import { useRef, useState } from "react";
import type { Attachment, ChatMessage } from "@/lib/types";
import {
  attachmentKind,
  formatBytes,
  isImageType,
} from "@/lib/uploadthing/attachments";
import { cn } from "@/lib/utils";
import { AttachmentChip } from "./attachment-chip";
import { ImageLightbox } from "./view-attachment-dialog";

const passthroughImageLoader = ({ src }: ImageLoaderProps) => src;

function toAttachments(message: ChatMessage): Attachment[] {
  return message.parts.flatMap((part) => {
    if (part.type !== "file") {
      return [];
    }
    const size =
      "size" in part && typeof part.size === "number" ? part.size : undefined;
    return [
      {
        contentType: part.mediaType,
        name: part.filename ?? (isImageType(part.mediaType) ? "Image" : "File"),
        size,
        url: part.url,
      },
    ];
  });
}

function gridShape(count: number) {
  if (count === 1) {
    return { columns: "grid-cols-1", tile: "h-48 w-64 sm:h-56 sm:w-72" };
  }
  if (count === 2 || count === 4) {
    return { columns: "grid-cols-2", tile: "size-32 sm:size-36" };
  }
  return { columns: "grid-cols-3", tile: "size-24 sm:size-32" };
}

function fileDetail(file: Attachment) {
  const kind = attachmentKind(file.contentType);
  return file.size === undefined ? kind : `${kind} · ${formatBytes(file.size)}`;
}

export function MessageAttachments({ message }: { message: ChatMessage }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const attachments = toAttachments(message);
  if (attachments.length === 0) {
    return null;
  }

  const images = attachments.filter((file) => isImageType(file.contentType));
  const files = attachments.filter((file) => !isImageType(file.contentType));
  const isUser = message.role === "user";
  const shape = gridShape(images.length);

  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        isUser ? "items-end" : "mb-2.5 items-start"
      )}
      data-testid="message-attachments"
    >
      {images.length > 0 ? (
        <div className={cn("grid gap-2", shape.columns)}>
          {images.map((image, index) => (
            <button
              aria-label={`Open ${image.name}`}
              className={cn(
                "relative cursor-zoom-in overflow-hidden rounded-xl bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                shape.tile
              )}
              key={image.url}
              onClick={(event) => {
                openerRef.current = event.currentTarget;
                setOpenIndex(index);
              }}
              type="button"
            >
              <Image
                alt=""
                className="object-cover"
                fill
                loader={passthroughImageLoader}
                sizes="288px"
                src={image.url}
                unoptimized
              />
            </button>
          ))}
        </div>
      ) : null}
      {files.length > 0 ? (
        <div
          className={cn(
            "flex flex-wrap gap-2",
            isUser ? "justify-end" : "justify-start"
          )}
        >
          {files.map((file) => (
            <a
              className="rounded-xl transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href={file.url}
              key={file.url}
              rel="noopener noreferrer"
              target="_blank"
              title={`Open ${file.name} in a new tab`}
            >
              <AttachmentChip
                detail={fileDetail(file)}
                icon={<FileText aria-hidden className="size-4" />}
                name={file.name}
                size="thread"
              />
            </a>
          ))}
        </div>
      ) : null}
      {images.length > 0 ? (
        <ImageLightbox
          images={images}
          index={openIndex}
          onClosed={() => openerRef.current?.focus()}
          onIndexChange={setOpenIndex}
        />
      ) : null}
    </div>
  );
}
