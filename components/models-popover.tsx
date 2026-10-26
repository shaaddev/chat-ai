import { Check, ChevronDown, Coins, Layers, Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CHAT_MODELS,
  type ChatModel,
  type ChatModelId,
  getChatModel,
  type ModelProvider,
  PROVIDER_META,
} from "@/lib/ai/models";
import { cn } from "@/lib/utils";
import { CapabilityBadge, ProviderDot } from "./model-helpful-tooltips";

interface ModelSelectorProps {
  onSelectModel: (modelId: ChatModelId) => void;
  selectedModelId: ChatModelId;
}

const ALL_PROVIDERS = Object.keys(PROVIDER_META) as ModelProvider[];
const TEXT_MODELS = CHAT_MODELS.filter((model) => model.kind === "text");
const IMAGE_MODELS = CHAT_MODELS.filter((model) => model.kind === "image");

function ModelItem({
  model,
  isSelected,
  onSelect,
}: {
  model: ChatModel;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuItem
            className={cn(
              "flex cursor-pointer flex-col items-start gap-1.5 rounded-lg px-3 py-2.5 transition-colors",
              isSelected && "bg-card"
            )}
            data-testid={`model-item-${model.id}`}
            onSelect={onSelect}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center">
                  <ProviderDot provider={model.provider} />
                </span>
                <div className="flex flex-col">
                  <span className="font-medium text-[13px] text-foreground leading-tight">
                    {model.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground leading-tight">
                    {model.contextWindow}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {model.inputPrice}/M
                </span>
                {isSelected && (
                  <Check aria-hidden className="size-3.5 text-primary" />
                )}
              </div>
            </div>
            {model.capabilities.length > 0 && (
              <div className="flex flex-wrap gap-1 pl-8">
                {model.capabilities.map((cap) => (
                  <CapabilityBadge capability={cap} key={cap} />
                ))}
              </div>
            )}
          </DropdownMenuItem>
        </TooltipTrigger>
        <TooltipContent className="max-w-64 p-3" side="right" sideOffset={12}>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <ProviderDot provider={model.provider} />
              <span className="font-medium text-foreground text-sm">
                {model.name}
              </span>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {model.description}
            </p>
            <div className="mt-0.5 flex items-center gap-3 pt-1">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Layers aria-hidden className="size-3" />
                <span className="text-[11px]">{model.contextWindow}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Coins aria-hidden className="size-3" />
                <span className="text-[11px]">
                  {model.inputPrice} / {model.outputPrice}
                </span>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="px-3 pt-3 pb-1">
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}

export function ModelsPopover({
  onSelectModel,
  selectedModelId,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState<ModelProvider | null>(
    null
  );

  const selectedChatModel = getChatModel(selectedModelId);

  const filterModels = useCallback(
    (models: readonly ChatModel[]) =>
      models.filter((m) => {
        if (providerFilter && m.provider !== providerFilter) {
          return false;
        }
        if (query) {
          const q = query.toLowerCase();
          return (
            m.name.toLowerCase().includes(q) ||
            m.provider.toLowerCase().includes(q) ||
            m.description.toLowerCase().includes(q) ||
            m.capabilities.some((c) => c.toLowerCase().includes(q))
          );
        }
        return true;
      }),
    [providerFilter, query]
  );

  const filteredStable = useMemo(
    () => filterModels(TEXT_MODELS),
    [filterModels]
  );
  const filteredImage = useMemo(
    () => filterModels(IMAGE_MODELS),
    [filterModels]
  );
  const hasResults = filteredStable.length > 0 || filteredImage.length > 0;

  const handleSelect = useCallback(
    (id: ChatModelId) => {
      setOpen(false);
      onSelectModel(id);
    },
    [onSelectModel]
  );

  return (
    <DropdownMenu
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery("");
          setProviderFilter(null);
        }
      }}
      open={open}
    >
      <DropdownMenuTrigger
        asChild
        className="outline-hidden focus:outline-hidden"
      >
        <button
          className="group inline-flex h-[34px] min-w-0 cursor-pointer items-center gap-[7px] rounded-[10px] px-2.5 font-medium text-[13.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent data-[state=open]:text-foreground"
          data-testid="model-selector"
          type="button"
        >
          <ProviderDot provider={selectedChatModel.provider} />
          <span className="truncate">{selectedChatModel.name}</span>
          <ChevronDown
            aria-hidden
            className="size-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-180"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[min(380px,calc(100vw-1rem))] p-0"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="p-2 pb-1">
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <input
              aria-label="Search models"
              className="w-full rounded-lg border border-border bg-card py-1.5 pr-3 pl-8 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="Search models..."
              type="text"
              value={query}
            />
          </div>

          <div className="no-scrollbar mt-1.5 flex items-center gap-1 overflow-x-auto">
            <button
              className={cn(
                "shrink-0 cursor-pointer rounded-full px-2.5 py-0.5 font-medium text-xs transition-colors",
                providerFilter === null
                  ? "bg-card text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setProviderFilter(null)}
              type="button"
            >
              All
            </button>
            {ALL_PROVIDERS.map((p) => {
              const meta = PROVIDER_META[p];
              const isActive = providerFilter === p;
              return (
                <button
                  aria-pressed={isActive}
                  className={cn(
                    "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium text-xs transition-colors",
                    isActive
                      ? "bg-card text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  key={p}
                  onClick={() => setProviderFilter(isActive ? null : p)}
                  type="button"
                >
                  <ProviderDot provider={p} />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-[380px] overflow-y-auto p-1">
          {!hasResults && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Search aria-hidden className="mb-2 size-4" />
              <span className="text-sm">No models found</span>
            </div>
          )}

          {filteredStable.length > 0 && (
            <>
              <SectionLabel label="Models" />
              {filteredStable.map((m) => (
                <ModelItem
                  isSelected={m.id === selectedModelId}
                  key={m.id}
                  model={m}
                  onSelect={() => handleSelect(m.id)}
                />
              ))}
            </>
          )}

          {filteredImage.length > 0 && (
            <>
              <SectionLabel label="Image" />
              {filteredImage.map((m) => (
                <ModelItem
                  isSelected={m.id === selectedModelId}
                  key={m.id}
                  model={m}
                  onSelect={() => handleSelect(m.id)}
                />
              ))}
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
