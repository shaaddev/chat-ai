import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import type { Attachment } from "ai";

export function ViewAttachmentDialog({
  children,
  attachment,
}: {
  children: React.ReactNode;
  attachment: Attachment;
}) {
  const { contentType, url, name } = attachment;

  return (
    <Dialog>
      <DialogTrigger>{children}</DialogTrigger>
      <DialogContent className="border-opacity-5 border max-w-[90vw] md:max-w-[80vw] lg:max-w-[70vw]">
        {contentType?.startsWith("image") ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={name ?? "Attachment"}
              className="rounded-2xl size-full object-contain max-h-[80vh] max-w-full mx-auto"
            />
          </>
        ) : (
          <div className="rounded-2xl size-full bg-muted flex items-center justify-center overflow-hidden max-w-3xl w-full h-[70vh] md:h-[80vh] mx-auto">
            <iframe
              src={url}
              className="rounded-2xl size-full object-cover"
              title={name ?? "An attachment"}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
