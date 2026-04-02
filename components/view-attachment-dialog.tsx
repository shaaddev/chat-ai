import Image, { type ImageLoaderProps } from "next/image";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import type { Attachment } from "@/lib/types";

const passthroughImageLoader = ({ src }: ImageLoaderProps) => src;

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
          <div className="mx-auto flex max-h-[80vh] max-w-full items-center justify-center">
            <Image
              alt={name ?? "Attachment"}
              className="h-auto max-h-[80vh] w-auto max-w-full rounded-2xl object-contain"
              height={1200}
              loader={passthroughImageLoader}
              src={url}
              unoptimized
              width={1600}
            />
          </div>
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
