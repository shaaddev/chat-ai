import type { Attachment } from "ai";
import { Loader } from "lucide-react";
import { ViewAttachmentDialog } from "./view-attachment-dialog";

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
        className={`${className} aspect-video bg-muted rounded-2xl relative flex flex-col items-center justify-center`}
      >
        {contentType ? (
          contentType.startsWith("image") ? (
            <ViewAttachmentDialog attachment={attachment}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={url}
                src={url}
                alt={name ?? "An image attachment"}
                className="rounded-2xl size-full object-cover"
              />
            </ViewAttachmentDialog>
          ) : (
            <div className="" />
          )
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
