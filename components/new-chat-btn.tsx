import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SquarePen } from "lucide-react";
import Link from "next/link";

export function NewChat() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href="/" className="opacity-75 hover:opacity-100 rounded-xl">
            <SquarePen className="size-4" />
          </Link>
        </TooltipTrigger>
        <TooltipContent className="rounded-xl bg-neutral-950">
          <p>Start a new chat!</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
