import { SquarePen } from "lucide-react";
import { motion } from "motion/react";
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
          <motion.div whileTap={{ scale: 0.9 }}>
            <Button
              variant={"ghost"}
              className="opacity-75 hover:opacity-100 rounded-xl hover:bg-sidebar-accent cursor-pointer"
              onClick={() => {
                router.push("/");
                router.refresh();
              }}
            >
              <SquarePen className="size-4" />
            </Button>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent className="rounded-xl">
          <p>Start a new chat!</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
