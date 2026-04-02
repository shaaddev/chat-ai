import Link from "next/link";
import { Button } from "@/components/ui/button";

export function LoginBtn() {
  return (
    <Link href="/login">
      <Button className="flex w-full justify-start rounded-xl" variant="ghost">
        Login
      </Button>
    </Link>
  );
}
