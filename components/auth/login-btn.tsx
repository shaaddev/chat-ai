import { Button } from "@/components/ui/button";
import Link from "next/link";

export function LoginBtn() {
  return (
    <Link href="/login">
      <Button variant="ghost" className="w-full flex justify-start rounded-xl">
        Login
      </Button>
    </Link>
  );
}
