import Link from "next/link";
import { Button } from "@/components/ui/button";

export function LoginBtn() {
  return (
    <Link href="/login">
      <Button variant="ghost" className="w-full flex justify-start rounded-xl">
        Login
      </Button>
    </Link>
  );
}
