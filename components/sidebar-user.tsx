import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { LogOut, ChevronsUpDown, User } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useTransitionRouter } from "next-view-transitions";
import { toast } from "sonner";

interface UserProps {
  email: string;
}

export function SidebarUser({ email }: UserProps) {
  const { isMobile } = useSidebar();
  const router = useRouter();

  const transitionRouter = useTransitionRouter();
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
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground hover:bg-neutral-800 rounded-xl transition-all ease-in-out duration-150"
            >
              <div className="grid flex-1 text-center text-sm leading-tight">
                <span className="truncate font-semibold">{email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="rounded-xl hover:cursor-pointer"
                onClick={() => transitionRouter.push("/account")}
              >
                <User />
                Account Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-xl hover:cursor-pointer"
                onClick={handleLogout}
              >
                <LogOut />
                Log Out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
