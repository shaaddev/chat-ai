import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ImageTooltip, UnstableTooltip } from "./model-helpful-tooltips";
import { useState, useEffect } from "react";
import { stable_models, experimental_models } from "@/lib/ai/models";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { setCookie, getCookie } from "cookies-next";

const STORAGE_KEY = "selected_model";

export function ModelsPopover() {
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const localStorageValue = localStorage.getItem(STORAGE_KEY);
      if (localStorageValue) return localStorageValue;

      const cookieValue = getCookie(STORAGE_KEY);
      if (cookieValue) return cookieValue as string;

      return DEFAULT_CHAT_MODEL;
    }
    return DEFAULT_CHAT_MODEL;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, selectedModel);

    // update cookie
    setCookie(STORAGE_KEY, selectedModel, {
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });
  }, [selectedModel]);

  const handleModelSelect = (model: string) => {
    setSelectedModel(model);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className="outline-none focus:outline-none">
        <button
          type="button"
          className="inline-flex items-center gap-1 px-3 py-1 text-sm text-neutral-300 hover:text-neutral-100"
        >
          {selectedModel}
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
        <DropdownMenuGroup>
          {stable_models.map((m, index) => (
            <DropdownMenuItem
              key={index}
              className="rounded-xl justify-between flex py-4"
              onSelect={() => handleModelSelect(m.name)}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{m.name}</span>
                <m.icon className="size-4" />{" "}
                {/* add tooltip component here later */}
              </div>
              <ImageTooltip>
                <m.image className="size-4 text-blue-600" />
              </ImageTooltip>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="font-normal">
            <div className="flex-1 text-left leading-tight">
              <span>Experimental Models</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {experimental_models.map((m, index) => (
              <DropdownMenuItem
                key={index}
                className="rounded-xl justify-between flex py-4"
                onSelect={() => handleModelSelect(m.name)}
                disabled
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium'">{m.name}</span>
                  <m.icon className="size-4" />{" "}
                  {/* add tooltip component here later */}
                </div>
                <UnstableTooltip>
                  <m.unstable className="size-4 text-orange-600" />
                </UnstableTooltip>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
