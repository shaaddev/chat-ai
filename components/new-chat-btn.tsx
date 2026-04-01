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
            variant="ghost"
            className="opacity-70 hover:opacity-100 rounded-lg hover:bg-sidebar-accent cursor-pointer transition-opacity"
            onClick={() => {
              router.push("/");
              router.refresh();
            }}
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
