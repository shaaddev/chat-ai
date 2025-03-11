import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoginForm } from "./login-form";

interface LoginContentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoginContent({ open, onOpenChange }: LoginContentProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl mx-auto rounded-xl p-5 ">
        <DialogHeader className="flex justify-center">
          <DialogTitle>Login to Chat</DialogTitle>
        </DialogHeader>
        <LoginForm />
      </DialogContent>
    </Dialog>
  );
}
