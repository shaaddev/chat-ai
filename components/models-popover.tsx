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
            className="rounded-xl flex flex-col items-start gap-2 px-3.5 py-3.5 hover:cursor-pointer hover:bg-neutral-800/60 data-[active=true]:bg-neutral-800/80"
            onSelect={onSelect}
            data-active={isSelected}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-neutral-700/50 bg-neutral-800/80">
                  <ProviderLogo
                    provider={model.provider}
                    className="size-4"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-[13px] font-semibold leading-tight text-neutral-100">
                    {model.name}
                  </span>
                  <span className="mt-0.5 text-[11px] leading-tight text-neutral-500">
                    {model.contextWindow} context
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium tabular-nums text-neutral-500">
                  {model.inputPrice}/M in
                </span>
                {isSelected && (
                  <div className="flex size-5 items-center justify-center rounded-full bg-emerald-500/20">
                    <Check className="size-3 text-emerald-400" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-1 pl-9">
              {model.capabilities.map((cap) => (
                <CapabilityBadge key={cap} capability={cap} />
              ))}
            </div>
          </DropdownMenuItem>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          sideOffset={12}
          className="max-w-72 rounded-xl border border-neutral-700/50 bg-neutral-900 p-4 shadow-xl"
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <ProviderLogo
                provider={model.provider}
                className="size-4"
              />
              <span className="text-sm font-semibold text-neutral-100">
                {model.name}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-neutral-400">
              {model.description}
            </p>
            <div className="mt-1 flex items-center gap-3 border-t border-neutral-800 pt-2">
              <div className="flex items-center gap-1 text-neutral-500">
                <Layers className="size-3" />
                <span className="text-[11px]">{model.contextWindow}</span>
              </div>
              <div className="flex items-center gap-1 text-neutral-500">
                <Coins className="size-3" />
                <span className="text-[11px]">
                  {model.inputPrice} in / {model.outputPrice} out
                </span>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-700/50 to-transparent" />
      <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </span>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-700/50 to-transparent" />
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
    if (image_models.some((model) => model.id === optimisticModelId)) {
      return image_models.find((model) => model.id === optimisticModelId);
    }
    return stable_models.find((model) => model.id === optimisticModelId);
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
          className="group inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-neutral-800/60"
        >
          {selectedChatModel && (
            <div className="flex size-5 items-center justify-center rounded-md border border-neutral-700/40 bg-neutral-800/60">
              <ProviderLogo
                provider={selectedChatModel.provider}
                className="size-3"
              />
            </div>
          )}
          <span className="font-medium text-neutral-200 group-hover:text-neutral-50">
            {selectedChatModel?.name}
          </span>
          <ChevronDown className="size-3.5 text-neutral-500 transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="min-w-[440px] rounded-xl border-neutral-700/50 bg-neutral-900/95 p-0 shadow-2xl backdrop-blur-xl"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {/* Search + filter bar */}
        <div className="border-b border-neutral-800/60 p-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Search models..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900/80 py-1.5 pl-8 pr-3 text-sm text-neutral-200 placeholder:text-neutral-600 outline-none focus:border-neutral-700"
            />
          </div>

          <div className="mt-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setProviderFilter(null)}
              className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                providerFilter === null
                  ? "border-neutral-600 bg-neutral-800 text-neutral-200"
                  : "border-transparent bg-transparent text-neutral-500 hover:text-neutral-300"
              }`}
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
                  onClick={() =>
                    setProviderFilter(isActive ? null : p)
                  }
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    isActive
                      ? `${meta.color}`
                      : "border-transparent bg-transparent text-neutral-500 hover:text-neutral-300"
                  }`}
                >
                  <ProviderLogo provider={p} className="size-3" />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Model list */}
        <div className="h-[400px] overflow-y-auto p-1.5">
          {!hasResults && (
            <div className="flex flex-col items-center justify-center py-8 text-neutral-500">
              <Search className="mb-2 size-5" />
              <span className="text-sm">No models found</span>
              <span className="mt-0.5 text-xs text-neutral-600">
                Try a different search or filter
              </span>
            </div>
          )}

          {filteredStable.length > 0 && (
            <>
              <SectionHeader label="Standard Models" />
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

          {filteredStable.length > 0 && filteredImage.length > 0 && (
            <div className="my-1 h-px bg-neutral-800/60" />
          )}

          {filteredImage.length > 0 && (
            <>
              <SectionHeader label="Image Models" />
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
