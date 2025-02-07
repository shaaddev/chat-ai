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

interface model_selection {
  model: string;
  icon: LucideIcon;
  image: LucideIcon;
  unstable?: LucideIcon;
}

export function ModelsPopover() {
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className="outline-none focus:outline-none">
        <button
          type="button"
          className="inline-flex items-center gap-1 px-3 py-1 text-sm text-neutral-300 hover:text-neutral-100"
        >
          Gemini 1.5 pro
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
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{m.model}</span>
                <m.icon className="size-4" />{" "}
                {/* add tooltip component here later */}
              </div>
              <div>
                <ImageTooltip>
                  <m.image className="size-4 text-blue-600" />
                </ImageTooltip>
              </div>
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
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium'">{m.model}</span>
                  <m.icon className="size-4" />{" "}
                  {/* add tooltip component here later */}
                </div>
                <div>
                  <UnstableTooltip>
                    <m.unstable className="size-4 text-orange-600" />
                  </UnstableTooltip>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
