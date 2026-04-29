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
  type ModelProvider,
  type model_selection,
  PROVIDER_META,
  stable_models,
} from "@/lib/ai/models";
import { cn } from "@/lib/utils";
import { CapabilityBadge, ProviderLogo } from "./model-helpful-tooltips";

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
            className={cn(
              "flex cursor-pointer flex-col items-start gap-1.5 rounded-lg px-3 py-2.5 transition-colors",
              isSelected ? "bg-muted text-foreground" : "hover:bg-muted/60"
            )}
            data-testid={`model-item-${model.id}`}
            onSelect={onSelect}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex size-6 shrink-0 items-center justify-center rounded border border-border bg-muted">
                  <ProviderLogo
                    className="size-3.5"
                    provider={model.provider}
                  />
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-[13px] text-foreground leading-tight">
                    {model.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground/60 leading-tight">
                    {model.contextWindow}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground/50 tabular-nums">
                  {model.inputPrice}/M
                </span>
                {isSelected && <Check className="size-3.5 text-foreground" />}
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
        <TooltipContent
          className="max-w-64 rounded-lg border border-border bg-popover p-3 shadow-lg"
          side="right"
          sideOffset={12}
        >
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <ProviderLogo className="size-3.5" provider={model.provider} />
              <span className="font-medium text-foreground text-sm">
                {model.name}
              </span>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {model.description}
            </p>
            <div className="mt-0.5 flex items-center gap-3 border-border border-t pt-1.5">
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
      <span className="font-medium text-[11px] text-muted-foreground/50 uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

export function ModelsPopover({ selectedModelId }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState<ModelProvider | null>(
    null
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
      });
    },
    [providerFilter, query]
  );

  const filteredStable = useMemo(
    () => filterModels(stable_models),
    [filterModels]
  );
  const filteredImage = useMemo(
    () => filterModels(image_models),
    [filterModels]
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
    [setOptimisticModelId]
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
          className="group inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors hover:bg-muted"
          data-testid="model-selector"
          type="button"
        >
          {selectedChatModel && (
            <ProviderLogo
              className="size-3.5"
              provider={selectedChatModel.provider}
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
        <div className="border-border border-b p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground/50" />
            <input
              className="w-full rounded-lg border border-border bg-background py-1.5 pr-3 pl-8 text-foreground text-sm outline-none placeholder:text-muted-foreground/40 focus:border-ring/40"
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
                "shrink-0 cursor-pointer rounded-md px-2 py-0.5 font-medium text-[11px] transition-colors",
                providerFilter === null
                  ? "bg-muted text-foreground"
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
                  className={cn(
                    "inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 py-0.5 font-medium text-[11px] transition-colors",
                    isActive
                      ? `${meta.color}`
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  key={p}
                  onClick={() => setProviderFilter(isActive ? null : p)}
                  type="button"
                >
                  <ProviderLogo className="size-3" provider={p} />
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
                  isSelected={m.id === optimisticModelId}
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
                  isSelected={m.id === optimisticModelId}
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
