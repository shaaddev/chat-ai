import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ImageTooltip({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>{children}</TooltipTrigger>
        <TooltipContent className="rounded-xl">
          <p>Supports image uploads</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function UnstableTooltip({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>{children}</TooltipTrigger>
        <TooltipContent className="rounded-xl">
          <p>May be unstable</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
