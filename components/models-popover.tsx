import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ImageTooltip, UnstableTooltip } from "./model-helpful-tooltips";
import { useState, useOptimistic, useMemo, startTransition } from "react";
import { stable_models, experimental_models } from "@/lib/ai/models";
import { saveChatModelAsCookie } from "@/app/actions";

interface ModelSelectorProps {
  selectedModelId: string;
}

export function ModelsPopover({ selectedModelId }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [optimisticModelId, setOptimisticModelId] =
    useOptimistic(selectedModelId);

  const selectedChatModel = useMemo(
    () => stable_models.find((model) => model.id === optimisticModelId),
    [optimisticModelId]
  );

  console.log("SELECTED CHAT MODEL", selectedChatModel);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild className="outline-none focus:outline-none">
        <button
          data-testid="model-selector"
          type="button"
          className="inline-flex items-center gap-1 px-3 py-1 text-sm text-neutral-300 hover:text-neutral-100"
        >
          {selectedChatModel?.name}
          <ChevronDown className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] min-w-96 rounded-xl">
        <DropdownMenuLabel className=" font-normal">
          <div className="flex-1 text-left leading-tight">
            <span>Standard Models</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {stable_models.map((m) => {
          const { id } = m;

          return (
            <DropdownMenuItem
              data-testid={`model-item-${id}`}
              key={id}
              className="rounded-xl justify-between flex py-4 hover:cursor-pointer"
              onSelect={() => {
                setOpen(false);

                startTransition(() => {
                  setOptimisticModelId(id);
                  saveChatModelAsCookie(id);
                });
              }}
              data-active={id === selectedModelId}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{m.name}</span>
                <m.icon className="size-4" />
              </div>
              <ImageTooltip>
                <m.image className="size-4 text-blue-600" />
              </ImageTooltip>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className=" font-normal">
          <div className="flex-1 text-left leading-tight">
            <span>Experimental Models</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {experimental_models.map((m) => (
          <DropdownMenuItem
            key={m.name}
            className="rounded-xl justify-between flex py-4 hover:cursor-pointer"
            disabled
          >
            <div className="flex items-center gap-2">
              <span className="font-medium">{m.name}</span>
              <m.icon className="size-4" />
            </div>
            <UnstableTooltip>
              <m.unstable className="size-4 text-orange-600" />
            </UnstableTooltip>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
