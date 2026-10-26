import { History, HomeIcon, LogOutIcon, Palette, UserIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useLogOut } from "@/hooks/use-log-out";

export function AccountSidebar({
  setActiveSection,
}: {
  setActiveSection: (section: string) => void;
}) {
  const sidebarItems = [
    { id: "profile", label: "Edit profile", icon: UserIcon },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "usage", label: "Usage", icon: History },
  ];

  const logOut = useLogOut();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-semibold text-2xl tracking-tight">Account</h2>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      <nav className="flex flex-col gap-0.5">
        {sidebarItems.map((item) => (
          <Button
            className="h-9 cursor-pointer justify-start rounded-[10px]"
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            variant="ghost"
          >
            <item.icon className="!size-4 mr-2" />
            {item.label}
          </Button>
        ))}
        <Button
          asChild
          className="h-9 justify-start rounded-[10px]"
          variant="ghost"
        >
          <Link href="/">
            <HomeIcon className="mr-2 h-4 w-4" />
            Back to home
          </Link>
        </Button>
        <Button
          className="h-9 justify-start rounded-[10px] text-destructive hover:cursor-pointer hover:bg-destructive/10 hover:text-destructive"
          onClick={logOut}
          variant="ghost"
        >
          <LogOutIcon className="mr-2 h-4 w-4" />
          Log out
        </Button>
      </nav>
    </div>
  );
}
