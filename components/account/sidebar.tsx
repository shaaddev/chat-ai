import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { HomeIcon, UserIcon, LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";

export function AccountSidebar() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Account</h2>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      <Separator />
      <nav className="flex flex-col space-y-2">
        <Button variant="ghost" className="justify-start rounded-2xl" asChild>
          <Link href="/account">
            <UserIcon className="mr-2 h-4 w-4" />
            Edit Profile
          </Link>
        </Button>
        <Button variant="ghost" className="justify-start rounded-2xl" asChild>
          <Link href="/">
            <HomeIcon className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
        <Button
          variant="ghost"
          className="justify-start text-red-500 hover:bg-red-50 hover:text-red-600 rounded-2xl"
          onClick={() => {
            // In a real app, this would log the user out
            router.push("/");
          }}
        >
          <LogOutIcon className="mr-2 h-4 w-4" />
          Log Out
        </Button>
      </nav>
    </div>
  );
}
