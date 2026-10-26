import { FileText, RotateCw, X } from "lucide-react";
import Image, { type ImageLoaderProps } from "next/image";
import {
  attachmentKind,
  formatBytes,
  isImageType,
} from "@/lib/uploadthing/attachments";
import type { TrayItem } from "@/lib/uploadthing/tray";
import { cn } from "@/lib/utils";
import { AttachmentChip } from "./attachment-chip";

const passthroughImageLoader = ({ src }: ImageLoaderProps) => src;

const RING_RADIUS = 10;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ProgressRing({ name, progress }: { name: string; progress: number }) {
  return (
    <>
      <svg aria-hidden className="size-[26px] -rotate-90" viewBox="0 0 26 26">
        <circle
          className="fill-none stroke-foreground/15"
          cx="13"
          cy="13"
          r={RING_RADIUS}
          strokeWidth={3}
        />
        <circle
          className="fill-none stroke-foreground transition-[stroke-dashoffset] duration-150 ease-out motion-reduce:transition-none"
          cx="13"
          cy="13"
          r={RING_RADIUS}
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress / 100)}
          strokeLinecap="round"
          strokeWidth={3}
        />
      </svg>
      <progress
        aria-label={`Uploading ${name}`}
        className="sr-only"
        max={100}
        value={progress}
      />
    </>
  );
}

function RetryButton({
  className,
  name,
  onRetry,
}: {
  className: string;
  name: string;
  onRetry: () => void;
}) {
  return (
    <button
      aria-label={`Retry uploading ${name}`}
      className={cn(
        "cursor-pointer place-items-center text-destructive transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      onClick={onRetry}
      title="Upload failed. Retry"
      type="button"
    >
      <RotateCw aria-hidden className="size-4" />
    </button>
  );
}

function ImageTile({ item, onRetry }: { item: TrayItem; onRetry: () => void }) {
  return (
    <div className="relative size-[46px] overflow-hidden rounded-xl bg-card">
      {item.previewUrl ? (
        <Image
          alt={item.name}
          className="object-cover"
          fill
          loader={passthroughImageLoader}
          sizes="46px"
          src={item.previewUrl}
          unoptimized
        />
      ) : null}
      {item.status === "uploading" ? (
        <div className="absolute inset-0 grid place-items-center bg-card/62">
          <ProgressRing name={item.name} progress={item.progress} />
        </div>
      ) : null}
      {item.status === "failed" ? (
        <RetryButton
          className="absolute inset-0 grid rounded-xl bg-card/75"
          name={item.name}
          onRetry={onRetry}
        />
      ) : null}
    </div>
  );
}

function FileTile({ item, onRetry }: { item: TrayItem; onRetry: () => void }) {
  const kind = attachmentKind(item.mediaType);
  if (item.status === "failed") {
    return (
      <AttachmentChip
        detail={<span className="text-destructive">Upload failed</span>}
        icon={
          <RetryButton
            className="grid size-full rounded-[9px]"
            name={item.name}
            onRetry={onRetry}
          />
        }
        name={item.name}
      />
    );
  }
  return (
    <AttachmentChip
      detail={`${kind} · ${formatBytes(item.size)}`}
      icon={
        item.status === "uploading" ? (
          <ProgressRing name={item.name} progress={item.progress} />
        ) : (
          <FileText aria-hidden className="size-4" />
        )
      }
      name={item.name}
    />
  );
}

export function PreviewAttachment({
  item,
  onRemove,
  onRetry,
}: {
  item: TrayItem;
  onRemove: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="relative" data-testid="input-attachment-preview">
      {isImageType(item.mediaType) ? (
        <ImageTile item={item} onRetry={onRetry} />
      ) : (
        <FileTile item={item} onRetry={onRetry} />
      )}
      <button
        aria-label={`Remove ${item.name}`}
        className="touch-hitbox absolute -top-1.5 -right-1.5 z-10 flex size-5 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-testid="remove-attachment-button"
        onClick={onRemove}
        type="button"
      >
        <X aria-hidden className="size-3" />
      </button>
    </div>
  );
}
