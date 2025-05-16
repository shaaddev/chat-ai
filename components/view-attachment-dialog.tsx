import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import type { Attachment } from "ai";

export function ViewAttachmentDialog({
  children,
  attachment,
}: {
  children: React.ReactNode;
  attachment: Attachment;
}) {
  return (
    <Dialog>
      <DialogTrigger>{children}</DialogTrigger>
      <DialogContent className="border-opacity-5 border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.url}
          alt={attachment.name ?? "Attachment"}
          className="rounded-2xl size-full object-cover"
        />
      </DialogContent>
    </Dialog>
  );
}
