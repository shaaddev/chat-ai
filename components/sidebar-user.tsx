"use client";

import { LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useChat } from "@/components/chat-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";

const WHITESPACE = /\s+/;

function initialsOf(name: string | undefined) {
  return (name ?? "")
    .split(WHITESPACE)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

interface UserProps {
  avatar?: string;
  email: string;
  name?: string;
}

export function SidebarUser({ email, avatar, name }: UserProps) {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const { clearChats } = useChat();

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          clearChats();
          toast.success("Logged out");
          router.push("/");
          router.refresh();
        },
        onError: () => {
          toast.error("Log out failed", {
            description: "Check your connection and try again.",
          });
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
              className="gap-2.5 px-2 font-medium text-sidebar-foreground focus-visible:ring-ring"
              size="lg"
            >
              <Avatar className="size-7">
                <AvatarImage alt={name} src={avatar} />
                <AvatarFallback className="bg-secondary font-semibold text-[11px] text-muted-foreground">
                  {initialsOf(name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{name}</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-xl"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="size-7">
                  <AvatarImage alt={name} src={avatar} />
                  <AvatarFallback className="bg-card font-semibold text-[11px] text-muted-foreground">
                    {initialsOf(name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate text-muted-foreground text-xs">
                    {name}
                  </span>
                  <span className="truncate font-semibold">{email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="rounded-lg hover:cursor-pointer"
                onClick={() => router.push("/account")}
              >
                <User aria-hidden />
                Account settings
              </DropdownMenuItem>
              <DropdownMenuItem
                className="rounded-lg hover:cursor-pointer"
                onClick={handleLogout}
              >
                <LogOut aria-hidden />
                Log out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
