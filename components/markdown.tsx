import Link from "next/link";
import React, { memo } from "react";
import { Streamdown, type StreamdownProps } from "streamdown";

type Components = StreamdownProps["components"];

const components: Partial<Components> = {
  a: ({ children, ...props }) => {
    return (
      // @ts-expect-error - Next link prop typing collides with anchor props
      <Link
        {...props}
        className="text-accent underline-offset-2 transition-colors hover:underline"
        rel="noreferrer"
        target="_blank"
      >
        {children}
      </Link>
    );
  },
};

// Body type defaults to serif but follows whatever the user picks via the
// `data-prose` attribute (set on <html> by `lib/theme.ts`).
//   data-prose="serif"  → font-serif (Source Serif 4) — default
//   data-prose="sans"   → font-sans  (Geist Sans)
const PROSE_CLASSES = [
  "[html[data-prose='serif']_&]:font-serif",
  "[html[data-prose='sans']_&]:font-sans",
  "text-[16px] leading-[1.7] text-foreground/90",
  "[&_p]:my-3",
  "[&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:font-semibold [&_h1]:text-2xl [&_h1]:tracking-tight",
  "[&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:font-semibold [&_h2]:text-xl [&_h2]:tracking-tight",
  "[&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:font-semibold [&_h3]:text-lg",
  "[&_h4]:mt-4 [&_h4]:mb-1.5 [&_h4]:font-medium [&_h4]:text-base",
  "[&_strong]:font-semibold [&_strong]:text-foreground",
  "[&_em]:italic",
  "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6",
  "[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6",
  "[&_li]:my-1 [&_li]:leading-[1.65]",
  "[&_a]:text-accent [&_a]:underline-offset-2 hover:[&_a]:underline",
  "[&_code]:font-mono [&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.88em]",
  "[&_pre]:my-4 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border/60 [&_pre]:bg-muted/50 [&_pre]:p-4",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[13px] [&_pre_code]:leading-[1.55]",
  "[&_blockquote]:my-4 [&_blockquote]:border-foreground/20 [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:font-serif [&_blockquote]:text-muted-foreground [&_blockquote]:italic",
  "[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[14px]",
  "[&_th]:border [&_th]:border-border/60 [&_th]:bg-muted/40 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium",
  "[&_td]:border [&_td]:border-border/60 [&_td]:px-3 [&_td]:py-2",
  "[&_hr]:my-6 [&_hr]:border-border/60",
  "[&_img]:my-4 [&_img]:rounded-lg",
].join(" ");

const NonMemoizedMarkdown = ({ children }: { children: string }) => {
  return (
    <Streamdown
      className={PROSE_CLASSES}
      components={components}
      shikiTheme={["houston", "houston"]}
    >
      {children}
    </Streamdown>
  );
};

export const Markdown = memo(
  NonMemoizedMarkdown,
  (prevProps, nextProps) => prevProps.children === nextProps.children
);
