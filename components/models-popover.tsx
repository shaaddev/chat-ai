import { Check, ChevronDown, Coins, Layers, Search } from "lucide-react";
import {
  startTransition,
  useCallback,
  useMemo,
  useOptimistic,
  useState,
} from "react";
import { saveChatModelAsCookie } from "@/app/actions";
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
  image_models,
  PROVIDER_META,
  stable_models,
  type ModelProvider,
  type model_selection,
} from "@/lib/ai/models";
import { CapabilityBadge, ProviderLogo } from "./model-helpful-tooltips";
import { cn } from "@/lib/utils";

interface ModelSelectorProps {
  selectedModelId: string;
}

const ALL_PROVIDERS = Object.keys(PROVIDER_META) as ModelProvider[];

function ModelItem({
  model,
  isSelected,
  onSelect,
}: {
  model: model_selection;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuItem
            data-testid={`model-item-${model.id}`}
            className={cn(
              "rounded-lg flex flex-col items-start gap-1.5 px-3 py-2.5 cursor-pointer transition-colors",
              isSelected ? "bg-accent" : "hover:bg-accent/50",
            )}
            onSelect={onSelect}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex size-6 shrink-0 items-center justify-center rounded border border-border bg-muted">
                  <ProviderLogo provider={model.provider} className="size-3.5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[13px] font-medium leading-tight text-foreground">
                    {model.name}
                  </span>
                  <span className="text-[11px] leading-tight text-muted-foreground/60">
                    {model.contextWindow}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] tabular-nums text-muted-foreground/50">
                  {model.inputPrice}/M
                </span>
                {isSelected && (
                  <Check className="size-3.5 text-foreground" />
                )}
              </div>
            </div>
            {model.capabilities.length > 0 && (
              <div className="flex flex-wrap gap-1 pl-8">
                {model.capabilities.map((cap) => (
                  <CapabilityBadge key={cap} capability={cap} />
                ))}
              </div>
            )}
          </DropdownMenuItem>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          sideOffset={12}
          className="max-w-64 rounded-lg border border-border bg-popover p-3 shadow-lg"
        >
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <ProviderLogo provider={model.provider} className="size-3.5" />
              <span className="text-sm font-medium text-foreground">
                {model.name}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {model.description}
            </p>
            <div className="flex items-center gap-3 border-t border-border pt-1.5 mt-0.5">
              <div className="flex items-center gap-1 text-muted-foreground/60">
                <Layers className="size-3" />
                <span className="text-[11px]">{model.contextWindow}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground/60">
                <Coins className="size-3" />
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
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50">
        {label}
      </span>
    </div>
  );
}

export function ModelsPopover({ selectedModelId }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState<ModelProvider | null>(
    null,
  );
  const [optimisticModelId, setOptimisticModelId] =
    useOptimistic(selectedModelId);

  const selectedChatModel = useMemo(() => {
    return (
      image_models.find((m) => m.id === optimisticModelId) ||
      stable_models.find((m) => m.id === optimisticModelId)
    );
  }, [optimisticModelId]);

  const filterModels = useCallback(
    (models: model_selection[]) => {
      return models.filter((m) => {
        if (providerFilter && m.provider !== providerFilter) return false;
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
      });
    },
    [providerFilter, query],
  );

  const filteredStable = useMemo(
    () => filterModels(stable_models),
    [filterModels],
  );
  const filteredImage = useMemo(
    () => filterModels(image_models),
    [filterModels],
  );
  const hasResults = filteredStable.length > 0 || filteredImage.length > 0;

  const handleSelect = useCallback(
    (id: string) => {
      setOpen(false);
      startTransition(() => {
        setOptimisticModelId(id);
        saveChatModelAsCookie(id);
      });
    },
    [setOptimisticModelId],
  );

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery("");
          setProviderFilter(null);
        }
      }}
    >
      <DropdownMenuTrigger
        asChild
        className="outline-hidden focus:outline-hidden"
      >
        <button
          data-testid="model-selector"
          type="button"
          className="group inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors hover:bg-muted cursor-pointer"
        >
          {selectedChatModel && (
            <ProviderLogo
              provider={selectedChatModel.provider}
              className="size-3.5"
            />
          )}
          <span className="font-medium text-muted-foreground group-hover:text-foreground">
            {selectedChatModel?.name}
          </span>
          <ChevronDown className="size-3 text-muted-foreground/50 transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[380px] rounded-xl border-border bg-popover p-0 shadow-xl"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="border-b border-border p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/50" />
            <input
              type="text"
              placeholder="Search models..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-ring/40"
            />
          </div>

          <div className="mt-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setProviderFilter(null)}
              className={cn(
                "shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer",
                providerFilter === null
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              All
            </button>
            {ALL_PROVIDERS.map((p) => {
              const meta = PROVIDER_META[p];
              const isActive = providerFilter === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProviderFilter(isActive ? null : p)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer",
                    isActive
                      ? `${meta.color}`
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <ProviderLogo provider={p} className="size-3" />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-[380px] overflow-y-auto p-1">
          {!hasResults && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
              <Search className="mb-2 size-4" />
              <span className="text-sm">No models found</span>
            </div>
          )}

          {filteredStable.length > 0 && (
            <>
              <SectionLabel label="Models" />
              {filteredStable.map((m) => (
                <ModelItem
                  key={m.id}
                  model={m}
                  isSelected={m.id === optimisticModelId}
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
                  key={m.id}
                  model={m}
                  isSelected={m.id === optimisticModelId}
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
