import { History, HomeIcon, LogOutIcon, UserIcon } from "lucide-react";
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
        <h2 className="text-2xl font-bold">Account</h2>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      <Separator />
      <nav className="flex flex-col space-y-2">
        {sidebarItems.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            className="justify-start rounded-2xl"
            // asChild
            onClick={() => setActiveSection(item.id)}
          >
            <item.icon className="mr-2 !size-4" />
            {item.label}
          </Button>
        ))}
        <Button variant="ghost" className="justify-start rounded-2xl" asChild>
          <Link href="/">
            <HomeIcon className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
        <Button
          variant="ghost"
          className="justify-start text-red-500 hover:bg-red-50 hover:text-red-600 rounded-2xl hover:cursor-pointer"
          onClick={handleLogout}
        >
          <LogOutIcon className="mr-2 h-4 w-4" />
          Log Out
        </Button>
      </nav>
    </div>
  );
}
