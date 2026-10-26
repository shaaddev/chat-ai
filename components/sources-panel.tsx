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
      className="size-4 shrink-0 rounded-full bg-center bg-contain bg-muted bg-no-repeat"
      style={{ backgroundImage: `url("${getFaviconUrl(domain)}")` }}
    />
  );
}

function SourceCard({ source, index }: { source: Source; index: number }) {
  return (
    <motion.a
      animate={{ opacity: 1, y: 0 }}
      className="group flex flex-col gap-1.5 rounded-xl bg-card p-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      href={source.url}
      initial={{ opacity: 0, y: 6 }}
      rel="noopener noreferrer"
      target="_blank"
      transition={{ delay: 0.03 * index, duration: 0.2 }}
    >
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <SourceFavicon domain={source.domain} />
        <span className="truncate">{source.domain}</span>
        <ExternalLink
          aria-hidden
          className="ml-auto size-3 shrink-0 transition-colors group-hover:text-foreground"
        />
      </div>
      <p className="line-clamp-2 font-medium text-sm leading-snug">
        {source.title}
      </p>
      {source.snippet ? (
        <p className="line-clamp-3 text-muted-foreground text-xs leading-relaxed">
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
      className="fixed inset-x-0 top-[50px] bottom-0 z-40 flex flex-col rounded-t-2xl bg-popover text-popover-foreground shadow-md md:top-2 md:right-2 md:bottom-2 md:left-auto md:w-full md:max-w-sm md:rounded-2xl"
      exit={{ x: 24, opacity: 0 }}
      initial={{ x: 24, opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <div className="flex h-12 shrink-0 items-center justify-between pr-2 pl-4">
        <div className="flex items-baseline gap-2">
          <h2 className="font-medium text-sm">Sources</h2>
          <span className="text-muted-foreground text-xs tabular-nums">
            {sources.length}
          </span>
        </div>
        <Button
          aria-label="Close sources"
          className="size-9 rounded-[10px] text-muted-foreground"
          onClick={() => onOpenChange(false)}
          size="icon"
          variant="ghost"
        >
          <X aria-hidden className="size-4" />
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-2 px-3 pb-3">
          {sources.length === 0 ? (
            <p className="px-2 py-6 text-muted-foreground text-sm">
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
