import {
  type ModelCapability,
  type ModelProvider,
  PROVIDER_META,
} from "@/lib/ai/models";
import { cn } from "@/lib/utils";

export function ProviderDot({
  provider,
  className,
}: {
  provider: ModelProvider | undefined;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-[7px] shrink-0 rounded-full",
        provider ? PROVIDER_META[provider].dot : "bg-muted-foreground",
        className
      )}
    />
  );
}

const capabilityLabels: Record<ModelCapability, string> = {
  reasoning: "Reasoning",
  vision: "Vision",
  audio: "Audio",
  video: "Video",
  "tool-use": "Tools",
  fast: "Fast",
  "image-gen": "Image gen",
  "image-edit": "Image edit",
  code: "Code",
};

export function CapabilityBadge({
  capability,
}: {
  capability: ModelCapability;
}) {
  return (
    <span className="inline-flex items-center rounded-full bg-card px-2 py-0.5 font-medium text-[11px] text-muted-foreground">
      {capabilityLabels[capability]}
    </span>
  );
}
