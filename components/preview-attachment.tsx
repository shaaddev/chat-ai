import { FileText, Loader, X } from "lucide-react";
import Image, { type ImageLoaderProps } from "next/image";
import type { Attachment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ViewAttachmentDialog } from "./view-attachment-dialog";

const passthroughImageLoader = ({ src }: ImageLoaderProps) => src;

function fileKind(contentType: string) {
  return contentType.startsWith("application/pdf") ? "PDF" : "File";
}

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
  className,
  onRemove,
}: {
  attachment: Attachment;
  isUploading?: boolean;
  className?: string;
  onRemove?: () => void;
}) => {
  const { name, url, contentType } = attachment;
  const isImage = contentType?.startsWith("image") ?? false;
  const canPreview =
    isImage || (contentType?.startsWith("application/pdf") ?? false);

  const tile = isImage ? (
    <div className={cn("relative overflow-hidden rounded-xl", className)}>
      <Image
        alt={name ?? "An image attachment"}
        className="object-cover"
        fill
        key={url}
        loader={passthroughImageLoader}
        sizes="(max-width: 768px) 100vw, 50vw"
        src={url}
        unoptimized
      />
    </div>
  ) : (
    <div className="flex h-[46px] max-w-60 items-center gap-2.5 rounded-xl bg-secondary py-1.5 pr-3.5 pl-1.5 text-left">
      <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-card text-muted-foreground">
        {isUploading ? (
          <Loader
            aria-hidden
            className="size-4 animate-spin"
            data-testid="input-attachment-loader"
          />
        ) : (
          <FileText aria-hidden className="size-4" />
        )}
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate font-medium text-[13px]">{name}</span>
        <span className="text-muted-foreground text-xs">
          {isUploading ? "Uploading" : fileKind(contentType ?? "")}
        </span>
      </span>
    </div>
  );

  return (
    <div className="relative" data-testid="input-attachment-preview">
      {canPreview && !isUploading ? (
        <ViewAttachmentDialog attachment={attachment}>
          {tile}
        </ViewAttachmentDialog>
      ) : (
        tile
      )}

      {onRemove && !isUploading && (
        <button
          aria-label="Remove attachment"
          className="absolute -top-1.5 -right-1.5 z-10 flex size-5 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-accent"
          data-testid="remove-attachment-button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          type="button"
        >
          <X aria-hidden className="size-3" />
        </button>
      )}
    </div>
  );
};
