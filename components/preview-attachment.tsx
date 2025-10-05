import type { Attachment } from "@/lib/types";
import { File, Loader } from "lucide-react";
import { ViewAttachmentDialog } from "./view-attachment-dialog";
import { cn } from "@/lib/utils";

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
    <div data-testid="input-attachment-preview" className="flex flex-col gap-2">
      <div
        className={cn(
          className,
          "aspect-video bg-muted rounded-2xl relative flex flex-col items-center justify-center",
          contentType?.startsWith("image") && "bg-transparent",
        )}
      >
        {contentType ? (
          contentType.startsWith("image") ? (
            <ViewAttachmentDialog attachment={attachment}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={url}
                src={url}
                alt={name ?? "An image attachment"}
                className="rounded-2xl w-full object-cover"
              />
            </ViewAttachmentDialog>
          ) : contentType.startsWith("application/pdf") ? (
            <ViewAttachmentDialog attachment={attachment}>
              <div className="rounded-2xl size-full bg-muted flex flex-col gap-2 items-center justify-center">
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
            data-testid="input-attachment-loader"
            className="animate-spin absolute text-zinc-500"
          >
            <Loader />
          </div>
        )}
      </div>
    </div>
  );
};
