import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SquarePen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function NewChat() {
  const router = useRouter();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={"ghost"}
            className="opacity-75 hover:opacity-100 rounded-xl hover:bg-none"
            onClick={() => {
              router.push("/");
              router.refresh();
            }}
          >
            <SquarePen className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent className="rounded-xl">
          <p>Start a new chat!</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
