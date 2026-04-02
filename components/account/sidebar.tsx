import { History, HomeIcon, LogOutIcon, Palette, UserIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";

export function AccountSidebar({
  setActiveSection,
}: {
  setActiveSection: (section: string) => void;
}) {
  const sidebarItems = [
    { id: "profile", label: "Edit Profile", icon: UserIcon },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "usage", label: "Usage", icon: History },
  ];

  const router = useRouter();

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          toast.success("Logged out successfully");
          router.push("/");
          router.refresh();
        },
        onError: () => {
          toast.error("Failed to log out");
        },
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-bold text-2xl">Account</h2>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      <Separator />
      <nav className="flex flex-col space-y-2">
        {sidebarItems.map((item) => (
          <Button
            className="cursor-pointer justify-start rounded-2xl"
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            variant="ghost"
          >
            <item.icon className="!size-4 mr-2" />
            {item.label}
          </Button>
        ))}
        <Button asChild className="justify-start rounded-2xl" variant="ghost">
          <Link href="/">
            <HomeIcon className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
        <Button
          className="justify-start rounded-2xl text-destructive hover:cursor-pointer hover:bg-destructive/10 hover:text-destructive"
          onClick={handleLogout}
          variant="ghost"
        >
          <LogOutIcon className="mr-2 h-4 w-4" />
          Log Out
        </Button>
      </nav>
    </div>
  );
}
