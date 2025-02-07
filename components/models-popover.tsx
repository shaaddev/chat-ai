import {
  ChevronDown,
  Info,
  Image,
  FlaskConical,
  LucideIcon,
} from "lucide-react";
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

interface model_selection {
  model: string;
  icon: LucideIcon;
  image: LucideIcon;
  unstable?: LucideIcon;
}

const LOCAL_STORAGE_KEY = "selectedAIModel";

export function ModelsPopover() {
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(LOCAL_STORAGE_KEY) || "Gemini 1.5 pro";
    }
    return "Gemini 1.5 pro";
  });

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, selectedModel);
  }, [selectedModel]);

  const stable_models: model_selection[] = [
    {
      model: "Gemini 1.5 pro",
      icon: Info,
      image: Image,
      unstable: FlaskConical,
    },
    {
      model: "Gemini 2.0 Flash",
      icon: Info,
      image: Image,
      unstable: FlaskConical,
    },
    {
      model: "ChatGPT o1-mini",
      icon: Info,
      image: Image,
    },
  ];

  const experimental_models = [
    {
      model: "Deekseek r1",
      icon: Info,
      unstable: FlaskConical,
    },
    {
      model: "Deepseek v3",
      icon: Info,
      unstable: FlaskConical,
    },
    {
      model: "Deepseek v3 (old)",
      icon: Info,
      unstable: FlaskConical,
    },
  ];

  const handleModelSelect = (model: string) => {
    setSelectedModel(model);
  };

  useEffect(() => {}, []);

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
              onSelect={() => handleModelSelect(m.model)}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{m.model}</span>
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
                onSelect={() => handleModelSelect(m.model)}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium'">{m.model}</span>
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
