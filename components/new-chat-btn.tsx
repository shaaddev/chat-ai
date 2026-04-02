import { SquarePen } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function NewChat() {
  const router = useRouter();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="cursor-pointer rounded-lg opacity-70 transition-opacity hover:bg-sidebar-accent hover:opacity-100"
            onClick={() => router.push("/")}
            variant="ghost"
          >
            <SquarePen className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent className="rounded-lg">
          <p>New chat</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
