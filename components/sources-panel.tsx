"use client";

import { ExternalLink, X } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getFaviconUrl, type Source } from "@/lib/sources";

interface SourcesPanelProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  sources: Source[];
}

function SourceFavicon({ domain }: { domain: string }) {
  // Render via CSS background-image so we don't need next/image domain
  // configuration for Google's favicon service. If the favicon fails to
  // load the muted swatch shows through cleanly.
  return (
    <span
      aria-hidden
      className="size-5 shrink-0 rounded-sm bg-center bg-contain bg-muted bg-no-repeat"
      style={{ backgroundImage: `url("${getFaviconUrl(domain)}")` }}
    />
  );
}

function SourceCard({ source, index }: { source: Source; index: number }) {
  return (
    <motion.a
      animate={{ opacity: 1, y: 0 }}
      className="group flex flex-col gap-2 rounded-lg border border-border/60 bg-card/40 p-3 transition-colors hover:border-foreground/20 hover:bg-card"
      href={source.url}
      initial={{ opacity: 0, y: 6 }}
      rel="noopener noreferrer"
      target="_blank"
      transition={{ delay: 0.04 * index, duration: 0.25 }}
    >
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <SourceFavicon domain={source.domain} />
        <span className="truncate">{source.domain}</span>
        <ExternalLink className="ml-auto size-3 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-foreground/60" />
      </div>
      <p className="line-clamp-2 font-serif text-[14px] text-foreground/90 leading-snug">
        {source.title}
      </p>
      {source.snippet ? (
        <p className="line-clamp-3 font-sans text-[12px] text-muted-foreground/80 leading-relaxed">
          {source.snippet}
        </p>
      ) : null}
    </motion.a>
  );
}

export function SourcesPanel({
  onOpenChange,
  open,
  sources,
}: SourcesPanelProps) {
  if (!open) {
    return null;
  }

  return (
    <motion.aside
      animate={{ x: 0, opacity: 1 }}
      aria-label="Sources"
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-border/60 border-l bg-background/95 shadow-md backdrop-blur"
      exit={{ x: 24, opacity: 0 }}
      initial={{ x: 24, opacity: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      <div className="flex h-14 items-center justify-between border-border/60 border-b px-4">
        <div className="flex items-baseline gap-2">
          <h2 className="font-serif text-[15px] text-foreground italic">
            Sources
          </h2>
          <span className="font-mono text-[11px] text-muted-foreground/60 tracking-wider">
            {sources.length}
          </span>
        </div>
        <Button
          aria-label="Close sources"
          className="size-8"
          onClick={() => onOpenChange(false)}
          size="icon"
          variant="ghost"
        >
          <X className="size-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2 p-3">
          {sources.length === 0 ? (
            <p className="px-2 py-6 text-muted-foreground/60 text-sm">
              No sources for this response.
            </p>
          ) : (
            sources.map((source, index) => (
              <SourceCard index={index} key={source.id} source={source} />
            ))
          )}
        </div>
      </ScrollArea>
    </motion.aside>
  );
}
