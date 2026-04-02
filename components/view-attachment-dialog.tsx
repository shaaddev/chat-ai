import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import type { Attachment } from "@/lib/types";

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
      <DialogTrigger className="cursor-pointer">{children}</DialogTrigger>
      <DialogContent className="max-w-[90vw] border border-opacity-5 md:max-w-[80vw] lg:max-w-[70vw]">
        {contentType?.startsWith("image") ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={name ?? "Attachment"}
              className="mx-auto size-full max-h-[80vh] max-w-full rounded-2xl object-contain"
              src={url}
            />
          </>
        ) : (
          <div className="mx-auto flex size-full h-[70vh] w-full max-w-3xl items-center justify-center overflow-hidden rounded-2xl bg-muted md:h-[80vh]">
            <iframe
              className="size-full rounded-2xl object-cover"
              src={url}
              title={name ?? "An attachment"}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
