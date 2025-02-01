import { ChevronDown, Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function ModelsPopover() {
  const stable_models = [
    {
      model: "ChatGPT 4o mini",
      icon: Info,
    },
  ];

  const experimental_models = [
    {
      model: "Deekseek r1",
      icon: Info,
    },
    {
      model: "Deepseek v3",
      icon: Info,
    },
    {
      model: "Deepseek v3 (old)",
      icon: Info,
    },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 px-3 py-1 text-sm text-neutral-300 hover:text-neutral-100"
        >
          ChatGPT 4o mini
          <ChevronDown className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96 bg-neutral-950 rounded-xl border-neutral-800">
        <div className="px-5 py-1 text-sm font-medium text-muted-foreground">
          Stable Models
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
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
