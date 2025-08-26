import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MoveLeft } from "lucide-react";

export default function Page() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 bg-neutral-900">
      <p className="font-bold text-xl">
        You have been successfully logged out!
      </p>
      <Button
        type="button"
        variant={"default"}
        className="bg-blue-500 text-white rounded-xl hover:text-black "
      >
        <Link href="/" className=" flex flex-row items-center gap-2">
          <MoveLeft className="size-4 inline" />
          Go Home
        </Link>
      </Button>
    </div>
  );
}
