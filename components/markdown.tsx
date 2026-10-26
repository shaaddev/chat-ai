import { code } from "@streamdown/code";
import Link from "next/link";
import { memo } from "react";
import {
  Streamdown,
  type StreamdownProps,
  type ThemeRegistrationAny,
} from "streamdown";
import "streamdown/styles.css";

type Components = StreamdownProps["components"];

const components: Partial<Components> = {
  a: ({ children, ...props }) => {
    return (
      // @ts-expect-error - Next link prop typing collides with anchor props
      <Link
        {...props}
        className="text-primary underline-offset-2 transition-colors hover:underline"
        rel="noreferrer"
        target="_blank"
      >
        {children}
      </Link>
    );
  },
};

const plugins: StreamdownProps["plugins"] = { code };

const controls: StreamdownProps["controls"] = { code: { download: false } };

const codeTokenColors: ThemeRegistrationAny["tokenColors"] = [
  {
    scope: ["comment", "punctuation.definition.comment"],
    settings: { foreground: "var(--muted-foreground)" },
  },
  {
    scope: [
      "keyword",
      "storage",
      "storage.type",
      "storage.modifier",
      "variable.language",
      "entity.name.tag",
    ],
    settings: { foreground: "var(--code-keyword)" },
  },
  {
    scope: [
      "string",
      "punctuation.definition.string",
      "constant.numeric",
      "constant.language",
      "constant.character",
    ],
    settings: { foreground: "var(--code-string)" },
  },
  {
    scope: [
      "entity.name.function",
      "support.function",
      "meta.function-call",
      "variable.function",
      "entity.name.type",
      "entity.name.class",
      "support.type",
      "support.class",
      "entity.other.attribute-name",
    ],
    settings: { foreground: "var(--code-function)" },
  },
];

const codeTheme = (name: string, type: "light" | "dark") => ({
  name,
  type,
  colors: {
    "editor.background": "var(--code)",
    "editor.foreground": "var(--foreground)",
  },
  tokenColors: codeTokenColors,
});

const shikiTheme: StreamdownProps["shikiTheme"] = [
  codeTheme("night-shift-light", "light"),
  codeTheme("night-shift-dark", "dark"),
];

const PROSE_CLASSES = [
  "space-y-0 text-[15px] text-foreground leading-[1.6]",
  "[&>*:last-child]:after:text-primary [&>*:last-child]:after:animate-[blink-cursor_1.1s_ease-in-out_infinite] motion-reduce:[&>*:last-child]:after:animate-none",
  "[&_p]:mt-0 [&_p]:mb-2.5",
  "[&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:font-semibold [&_h1]:text-2xl [&_h1]:tracking-tight",
  "[&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:font-semibold [&_h2]:text-xl [&_h2]:tracking-tight",
  "[&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:font-semibold [&_h3]:text-lg",
  "[&_h4]:mt-4 [&_h4]:mb-1.5 [&_h4]:font-medium [&_h4]:text-base",
  "[&_strong]:font-semibold",
  "[&_em]:italic",
  "[&_ul]:mt-0 [&_ul]:mb-3.5 [&_ul]:list-outside [&_ul]:list-disc [&_ul]:pl-[22px]",
  "[&_ol]:mt-0 [&_ol]:mb-3.5 [&_ol]:list-outside [&_ol]:list-decimal [&_ol]:pl-[22px]",
  "[&_li]:my-[3px] [&_li]:py-0 [&_li]:pl-1 [&_li]:marker:text-muted-foreground",
  "[&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline",
  "[&_code]:rounded-md [&_code]:bg-code [&_code]:px-1.5 [&_code]:py-px [&_code]:font-mono [&_code]:text-[13px]",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:leading-[1.55]",
  "[&_blockquote]:my-4 [&_blockquote]:border-muted-foreground/40 [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground",
  "[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[14px]",
  "[&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium",
  "[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2",
  "[&_hr]:my-6 [&_hr]:border-border",
  "[&_img]:my-4 [&_img]:rounded-xl",
].join(" ");

function NonMemoizedMarkdown({
  children,
  isStreaming = false,
}: {
  children: string;
  isStreaming?: boolean;
}) {
  return (
    <Streamdown
      animated
      caret="block"
      className={PROSE_CLASSES}
      components={components}
      controls={controls}
      isAnimating={isStreaming}
      lineNumbers={false}
      plugins={plugins}
      shikiTheme={shikiTheme}
    >
      {children}
    </Streamdown>
  );
}

export const Markdown = memo(NonMemoizedMarkdown);
