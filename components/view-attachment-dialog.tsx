import { ChevronLeft, ChevronRight } from "lucide-react";
import Image, { type ImageLoaderProps } from "next/image";
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { Attachment } from "@/lib/types";

const passthroughImageLoader = ({ src }: ImageLoaderProps) => src;

const STEP_BUTTON =
  "absolute top-1/2 grid size-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-popover/85 text-foreground shadow-md backdrop-blur-sm transition-colors hover:bg-popover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ImageLightbox({
  images,
  index,
  onIndexChange,
  onClosed,
}: {
  images: Attachment[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
  onClosed: () => void;
}) {
  const [shownIndex, setShownIndex] = useState(index ?? 0);
  if (index !== null && index !== shownIndex) {
    setShownIndex(index);
  }
  const image = images[index ?? shownIndex];
  const count = images.length;
  const step = (delta: number) => {
    onIndexChange((shownIndex + delta + count) % count);
  };

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          onIndexChange(null);
        }
      }}
      open={index !== null}
    >
      <DialogContent
        aria-describedby={undefined}
        className="w-auto max-w-[calc(100vw-2rem)] gap-3 border-0 bg-transparent p-0 shadow-none sm:max-w-[calc(100vw-4rem)]"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onClosed();
        }}
        onKeyDown={(event) => {
          if (count < 2) {
            return;
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            step(1);
          } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            step(-1);
          }
        }}
      >
        {image ? (
          <figure className="relative flex flex-col items-center gap-3">
            <Image
              alt={image.name}
              className="h-auto max-h-[80vh] w-auto max-w-full rounded-2xl object-contain"
              height={1200}
              key={image.url}
              loader={passthroughImageLoader}
              src={image.url}
              unoptimized
              width={1600}
            />
            <figcaption className="flex max-w-full items-baseline gap-2 rounded-full bg-popover/90 px-3.5 py-1.5 text-sm shadow-md backdrop-blur-sm">
              <DialogTitle className="max-w-[60vw] truncate font-medium text-foreground text-sm leading-normal">
                {image.name}
              </DialogTitle>
              {count > 1 ? (
                <span className="text-muted-foreground">
                  {shownIndex + 1} of {count}
                </span>
              ) : null}
            </figcaption>
            {count > 1 ? (
              <>
                <button
                  aria-label="Previous image"
                  className={`${STEP_BUTTON} left-3`}
                  onClick={() => step(-1)}
                  type="button"
                >
                  <ChevronLeft aria-hidden className="size-5" />
                </button>
                <button
                  aria-label="Next image"
                  className={`${STEP_BUTTON} right-3`}
                  onClick={() => step(1)}
                  type="button"
                >
                  <ChevronRight aria-hidden className="size-5" />
                </button>
              </>
            ) : null}
          </figure>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
