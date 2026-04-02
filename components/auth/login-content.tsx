import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LoginContentProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function LoginContent({ open, onOpenChange }: LoginContentProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="mx-auto max-w-xl rounded-2xl p-6 sm:p-8">
        <DialogHeader className="flex flex-col items-center gap-2">
          <DialogTitle className="text-2xl sm:text-3xl">
            Sign in to continue
          </DialogTitle>
          <DialogDescription className="text-center">
            Access your chats and pick up where you left off.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2">
          <Link href="/login">
            <Button
              className="w-full gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
              size="lg"
            >
              Login
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
