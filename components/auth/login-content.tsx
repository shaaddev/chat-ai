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
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoginContent({ open, onOpenChange }: LoginContentProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl mx-auto rounded-2xl p-6 sm:p-8">
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
              size="lg"
              className="w-full rounded-xl gap-2 bg-neutral-900"
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
