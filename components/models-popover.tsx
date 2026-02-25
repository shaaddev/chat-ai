import { Check, ChevronDown, Coins, Layers } from "lucide-react";
import { startTransition, useMemo, useOptimistic, useState } from "react";
import { saveChatModelAsCookie } from "@/app/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { image_models, stable_models, type model_selection } from "@/lib/ai/models";
import { CapabilityBadge, ProviderLogo } from "./model-helpful-tooltips";

interface ModelSelectorProps {
  selectedModelId: string;
}

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
            className="rounded-xl flex flex-col items-start gap-2 px-3 py-3 hover:cursor-pointer data-[active=true]:bg-neutral-800/80"
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
                  <span className="text-[13px] font-semibold text-neutral-100 leading-tight">
                    {model.name}
                  </span>
                  <span className="text-[11px] text-neutral-500 leading-tight mt-0.5">
                    {model.contextWindow} context
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-neutral-500 tabular-nums">
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
          className="max-w-72 rounded-xl border border-neutral-700/50 bg-neutral-900 p-3 shadow-xl"
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

export function ModelsPopover({ selectedModelId }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [optimisticModelId, setOptimisticModelId] =
    useOptimistic(selectedModelId);

  const selectedChatModel = useMemo(() => {
    if (image_models.some((model) => model.id === optimisticModelId)) {
      return image_models.find((model) => model.id === optimisticModelId);
    }
    return stable_models.find((model) => model.id === optimisticModelId);
  }, [optimisticModelId]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
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
      <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-[420px] rounded-xl border-neutral-700/50 bg-neutral-900/95 p-1.5 shadow-2xl backdrop-blur-xl">
        <DropdownMenuLabel className="px-3 py-2 font-normal">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-700/50 to-transparent" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Standard Models
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-700/50 to-transparent" />
          </div>
        </DropdownMenuLabel>
        {stable_models.map((m) => (
          <ModelItem
            key={m.id}
            model={m}
            isSelected={m.id === optimisticModelId}
            onSelect={() => {
              setOpen(false);
              startTransition(() => {
                setOptimisticModelId(m.id);
                saveChatModelAsCookie(m.id);
              });
            }}
          />
        ))}
        <DropdownMenuSeparator className="my-1.5 bg-neutral-800/60" />
        <DropdownMenuLabel className="px-3 py-2 font-normal">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-700/50 to-transparent" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Image Models
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-neutral-700/50 to-transparent" />
          </div>
        </DropdownMenuLabel>
        {image_models.map((m) => (
          <ModelItem
            key={m.id}
            model={m}
            isSelected={m.id === optimisticModelId}
            onSelect={() => {
              setOpen(false);
              startTransition(() => {
                setOptimisticModelId(m.id);
                saveChatModelAsCookie(m.id);
              });
            }}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
