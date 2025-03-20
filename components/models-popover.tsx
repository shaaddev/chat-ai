import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { ImageTooltip, UnstableTooltip } from "./model-helpful-tooltips";
import { useState, useEffect } from "react";
import {
  stable_models,
  experimental_models,
  DEFAULT_CHAT_MODEL,
} from "@/lib/ai/models";

interface ModelSelectorProps {
  onModelChange: (modelId: string) => void;
}

export function ModelsPopover({ onModelChange }: ModelSelectorProps) {
  const [selectedId, setSelectedId] = useState(DEFAULT_CHAT_MODEL);

  useEffect(() => {
    onModelChange(selectedId);
  }, [selectedId, onModelChange]);

  const getModelNameById = (id: string) => {
    return stable_models.find((model) => model.id === id)?.name;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className="outline-none focus:outline-none">
        <button
          type="button"
          className="inline-flex items-center gap-1 px-3 py-1 text-sm text-neutral-300 hover:text-neutral-100"
        >
          {getModelNameById(selectedId)}
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
        <DropdownMenuRadioGroup
          value={selectedId}
          onValueChange={setSelectedId}
        >
          {stable_models.map((m) => (
            <DropdownMenuRadioItem
              key={m.id}
              className="rounded-xl justify-between flex py-4 hover:cursor-pointer"
              value={m.id}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{m.name}</span>
                <m.icon className="size-4" />
              </div>
              <ImageTooltip>
                <m.image className="size-4 text-blue-600" />
              </ImageTooltip>
            </DropdownMenuRadioItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="font-normal">
            <div className="flex-1 text-left leading-tight">
              <span>Experimental Models</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={selectedId}
            onValueChange={setSelectedId}
          >
            {experimental_models.map((m, index) => (
              <DropdownMenuRadioItem
                key={index}
                className="rounded-xl justify-between flex py-4"
                value={m.name}
                disabled
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium'">{m.name}</span>
                  <m.icon className="size-4" />
                </div>
                <UnstableTooltip>
                  <m.unstable className="size-4 text-orange-600" />
                </UnstableTooltip>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
