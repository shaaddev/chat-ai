"use client";

import { useState, useEffect } from "react";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ComponentPropsWithoutRef } from "react";

type CodeBlockProps = ComponentPropsWithoutRef<"code"> & {
  inline?: boolean;
};

export function CodeBlock({
  children,
  className,
  inline,
  ...props
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [highlighted, setHighlighted] = useState("");

  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "plaintext";

  useEffect(() => {
    if (typeof children === "string" && !inline) {
      const highlighted = hljs.highlight(children, { language }).value;
      setHighlighted(highlighted);
    }
  }, [children, language, inline]);

  const copyToClipboard = async () => {
    if (typeof children === "string") {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (inline) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  }

  return (
    <div className="relative">
      <pre className="pl-10 pr-24 py-5 rounded-xl overflow-x-auto bg-neutral-950 text-white">
        <code
          className={`language-${language}`}
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </pre>
      <Button
        variant="outline"
        size="icon"
        className="absolute top-2 right-2 rounded-xl border-none bg-neutral-900 hover:bg-neutral-800"
        onClick={copyToClipboard}
      >
        {copied ? (
          <Check className="size-2 text-green-500" />
        ) : (
          <Copy className="size-2 text-white" />
        )}
      </Button>
    </div>
  );
}
