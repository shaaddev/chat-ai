import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface UserProps {
  email: string;
  avatar?: string;
  name?: string;
}

export function SidebarUser({ email, avatar, name }: UserProps) {
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
              <Avatar className="h-8 w-8 rounded-lg grayscale">
                <AvatarImage src={avatar} alt={name} />
                <AvatarFallback className="rounded-2xl text-white">
                  {(name?.charAt(0) || email.charAt(0)).toUpperCase()}
                </AvatarFallback>
              </Avatar>
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
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="size-8 rounded-2xl grayscale">
                  <AvatarImage src={avatar} alt={name} />
                  <AvatarFallback className="rounded-lg text-white">
                    {(name?.charAt(0) || email.charAt(0)).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{email}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {name}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
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
