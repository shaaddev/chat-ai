import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LoginForm } from "./login-form";

export function LoginDialog() {
  return (
    <Dialog>
      <DialogTrigger>
        <Button
          variant={"ghost"}
          className="w-full flex justify-start rounded-xl"
        >
          Login
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl mx-auto rounded-xl p-5 ">
        <DialogHeader className="flex justify-center">
          <DialogTitle>Login to Chat</DialogTitle>
        </DialogHeader>
        <LoginForm />
      </DialogContent>
    </Dialog>
  );
}
