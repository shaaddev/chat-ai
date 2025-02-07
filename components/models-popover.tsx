import {
  ChevronDown,
  Info,
  Image,
  FlaskConical,
  LucideIcon,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 px-3 py-1 text-sm text-neutral-300 hover:text-neutral-100"
        >
          Gemini 1.5 pro
          <ChevronDown className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96 bg-neutral-950 rounded-xl border-neutral-800">
        <div className="px-5 py-1 text-sm font-medium text-muted-foreground">
          Standard Models
        </div>
        {stable_models.map((m, index) => (
          <div
            key={index}
            className="w-full flex items-center justify-between hover:bg-neutral-800 hover:cursor-pointer rounded-xl px-5 py-2"
          >
            <li className="flex items-center gap-2">
              <span className="font-medium">{m.model}</span>
              <m.icon className="size-4" />
            </li>
            <div>
              <ImageTooltip>
                <m.image className="size-4 text-blue-600" />
              </ImageTooltip>
            </div>
          </div>
        ))}
        <div className="w-full border-b border-neutral-700 my-5"></div>
        {experimental_models.map((m, index) => (
          <div
            key={index}
            className="w-full flex items-center justify-between hover:bg-neutral-800 hover:cursor-pointer rounded-xl px-5 py-2"
          >
            <li className="flex items-center gap-2">
              <span className="font-medium">{m.model}</span>
              <m.icon className="size-4" />
            </li>
            <div>
              <UnstableTooltip>
                <m.unstable className="size-4 text-orange-600" />
              </UnstableTooltip>
            </div>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
