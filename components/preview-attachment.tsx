import { File, Loader } from "lucide-react";
import Image, { type ImageLoaderProps } from "next/image";
import type { Attachment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ViewAttachmentDialog } from "./view-attachment-dialog";

const passthroughImageLoader = ({ src }: ImageLoaderProps) => src;

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
  className,
}: {
  attachment: Attachment;
  isUploading?: boolean;
  className?: string;
}) => {
  const { name, url, contentType } = attachment;

  return (
    <div className="flex flex-col gap-2" data-testid="input-attachment-preview">
      <div
        className={cn(
          className,
          "relative flex aspect-video flex-col items-center justify-center rounded-2xl bg-muted",
          contentType?.startsWith("image") && "bg-transparent"
        )}
      >
        {contentType ? (
          contentType.startsWith("image") ? (
            <ViewAttachmentDialog attachment={attachment}>
              <Image
                alt={name ?? "An image attachment"}
                className="rounded-2xl object-cover"
                fill
                key={url}
                loader={passthroughImageLoader}
                sizes="(max-width: 768px) 100vw, 50vw"
                src={url}
                unoptimized
              />
            </ViewAttachmentDialog>
          ) : contentType.startsWith("application/pdf") ? (
            <ViewAttachmentDialog attachment={attachment}>
              <div className="flex size-full flex-col items-center justify-center gap-2 rounded-2xl bg-muted">
                <File className="size-12" />
                <small className="text-xs text-zinc-500">PDF Attachment</small>
              </div>
            </ViewAttachmentDialog>
          ) : null
        ) : (
          <div className="" />
        )}

        {isUploading && (
          <div
            className="absolute animate-spin text-zinc-500"
            data-testid="input-attachment-loader"
          >
            <Loader />
          </div>
        )}
      </div>
    </div>
  );
};
