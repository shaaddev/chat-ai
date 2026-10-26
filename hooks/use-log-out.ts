import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useChat } from "@/components/chat-context";
import { authClient } from "@/lib/auth-client";

async function signOut() {
  try {
    const { error } = await authClient.signOut();
    return !error;
  } catch {
    // A network failure throws instead of returning an error.
    return false;
  }
}

export function useLogOut() {
  const router = useRouter();
  const { clearChats, flushPendingDeletes } = useChat();
  const loggingOutRef = useRef(false);

  return useCallback(async () => {
    if (loggingOutRef.current) {
      return;
    }
    loggingOutRef.current = true;
    // A delete still waiting on its Undo toast needs the session to go out.
    await flushPendingDeletes();
    const signedOut = await signOut();
    loggingOutRef.current = false;
    if (!signedOut) {
      toast.error("Log out failed", {
        description: "Check your connection and try again.",
      });
      return;
    }
    clearChats();
    toast.success("Logged out");
    router.push("/");
    router.refresh();
  }, [clearChats, flushPendingDeletes, router]);
}
