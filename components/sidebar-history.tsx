"use client";

import { type LucideIcon, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  type KeyboardEvent,
  memo,
  type ReactNode,
  type Ref,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type ChatSummary,
  useChat,
  useChatList,
} from "@/components/chat-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { Session } from "@/lib/auth";
import { groupChatsByDate } from "@/lib/chat-groups";

const UI_SPRING = {
  type: "spring",
  stiffness: 500,
  damping: 40,
  mass: 0.6,
} as const;

const FADE = { duration: 0.15 } as const;

const PRESENCE = {
  initial: { opacity: 0, y: -6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6, transition: FADE },
  transition: { default: UI_SPRING, opacity: FADE },
} as const;

const MotionMenuItem = motion.create(SidebarMenuItem);

interface RowControls {
  remove: () => void;
  rename: () => void;
}

/** Where focus goes when the menu closes after an action runs. */
type FocusAfterAction = "menu-opener" | "neighbor-row" | "kept-by-action";

interface RowAction {
  icon: LucideIcon;
  label: string;
  run: (row: RowControls) => FocusAfterAction;
  variant?: "destructive";
}

const ROW_ACTIONS: readonly RowAction[] = [
  {
    label: "Rename",
    icon: Pencil,
    run: (row) => {
      row.rename();
      return "kept-by-action";
    },
  },
  {
    label: "Delete chat",
    icon: Trash2,
    variant: "destructive",
    run: (row) => {
      row.remove();
      return "neighbor-row";
    },
  },
];

function isContextMenuKey(event: KeyboardEvent) {
  return event.key === "ContextMenu" || (event.shiftKey && event.key === "F10");
}

function neighborOf(link: HTMLElement | null): HTMLElement | null {
  const links = Array.from(
    document.querySelectorAll<HTMLElement>("[data-chat-link]")
  );
  const index = link ? links.indexOf(link) : -1;
  return (
    links[index + 1] ??
    links[index - 1] ??
    document.querySelector<HTMLElement>("[data-new-chat]")
  );
}

function RenameField({
  initialTitle,
  onDone,
}: {
  initialTitle: string;
  onDone: (title: string | null, viaKeyboard: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const finish = (title: string | null, viaKeyboard: boolean) => {
    if (doneRef.current) {
      return;
    }
    doneRef.current = true;
    onDone(title, viaKeyboard);
  };

  return (
    <input
      aria-label="Chat title"
      className="h-9 w-full rounded-[10px] border border-border bg-card px-2.5 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      defaultValue={initialTitle}
      maxLength={100}
      onBlur={(event) => finish(event.currentTarget.value, false)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.nativeEvent.isComposing) {
          event.preventDefault();
          finish(event.currentTarget.value, true);
        } else if (event.key === "Escape") {
          event.preventDefault();
          finish(null, true);
        }
      }}
      ref={inputRef}
    />
  );
}

interface ChatRowProps {
  chat: ChatSummary;
  isActive: boolean;
  isResponding: boolean;
  onDelete: (chatId: string, wasActive: boolean) => void;
  onNavigate: () => void;
  onRename: (chatId: string, title: string) => void;
  ref?: Ref<HTMLLIElement>;
}

function ChatRowComponent({
  chat,
  isActive,
  isResponding,
  onDelete,
  onNavigate,
  onRename,
  ref,
}: ChatRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const openedFromRowRef = useRef(false);
  const usedKeysInMenuRef = useRef(false);
  const focusOnMenuCloseRef = useRef<HTMLElement | "kept" | null>(null);
  const refocusLinkRef = useRef(false);

  useEffect(() => {
    if (!isEditing && refocusLinkRef.current) {
      refocusLinkRef.current = false;
      linkRef.current?.focus();
    }
  }, [isEditing]);

  const controls: RowControls = {
    rename: () => setIsEditing(true),
    remove: () => onDelete(chat.id, isActive),
  };

  const runAction = (action: RowAction) => {
    const neighbor = neighborOf(linkRef.current);
    const focusAfter = action.run(controls);
    if (focusAfter === "neighbor-row") {
      focusOnMenuCloseRef.current = usedKeysInMenuRef.current
        ? neighbor
        : "kept";
    } else if (focusAfter === "kept-by-action") {
      focusOnMenuCloseRef.current = "kept";
    }
  };

  const openMenuFromRow = (event: SyntheticEvent) => {
    event.preventDefault();
    openedFromRowRef.current = true;
    setIsMenuOpen(true);
  };

  const restoreFocusOnMenuClose = (event: Event) => {
    const target =
      focusOnMenuCloseRef.current ??
      (openedFromRowRef.current ? linkRef.current : null);
    focusOnMenuCloseRef.current = null;
    openedFromRowRef.current = false;
    usedKeysInMenuRef.current = false;
    if (target) {
      event.preventDefault();
      if (target !== "kept") {
        target.focus();
      }
    }
  };

  const finishRename = (title: string | null, viaKeyboard: boolean) => {
    const next = title?.trim();
    if (next && next !== chat.title) {
      onRename(chat.id, next);
    }
    refocusLinkRef.current = viaKeyboard;
    setIsEditing(false);
  };

  return (
    <MotionMenuItem layout="position" ref={ref} {...PRESENCE}>
      {isEditing ? (
        <RenameField initialTitle={chat.title} onDone={finishRename} />
      ) : (
        <SidebarMenuButton
          asChild
          className="focus-visible:ring-ring"
          isActive={isActive}
        >
          <Link
            aria-current={isActive ? "page" : undefined}
            data-chat-link=""
            href={`/chat/${chat.id}`}
            onContextMenu={openMenuFromRow}
            onKeyDown={(event) => {
              if (isContextMenuKey(event)) {
                openMenuFromRow(event);
              }
            }}
            onNavigate={(event) => {
              if (isActive) {
                event.preventDefault();
              }
              onNavigate();
            }}
            ref={linkRef}
          >
            <span className="min-w-0 flex-1 truncate">{chat.title}</span>
            {isResponding ? (
              <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground">
                <span className="sr-only">Responding</span>
              </span>
            ) : null}
          </Link>
        </SidebarMenuButton>
      )}
      {isEditing ? null : (
        <DropdownMenu onOpenChange={setIsMenuOpen} open={isMenuOpen}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuAction
              aria-label={`More options for ${chat.title}`}
              className="rounded-lg focus-visible:ring-ring"
              showOnHover
            >
              <MoreHorizontal aria-hidden className="size-4" />
            </SidebarMenuAction>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="rounded-xl"
            onCloseAutoFocus={restoreFocusOnMenuClose}
            onKeyDownCapture={() => {
              usedKeysInMenuRef.current = true;
            }}
            onPointerDownCapture={() => {
              usedKeysInMenuRef.current = false;
            }}
            side="right"
          >
            {ROW_ACTIONS.map((action) => (
              <DropdownMenuItem
                className="rounded-lg"
                key={action.label}
                onSelect={() => runAction(action)}
                variant={action.variant}
              >
                <action.icon aria-hidden />
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </MotionMenuItem>
  );
}

const ChatRow = memo(ChatRowComponent);

const SKELETON_WIDTHS = ["w-3/4", "w-1/2", "w-5/6", "w-2/3", "w-3/5"];

function SidebarSkeleton() {
  return (
    <div aria-busy="true" className="px-3">
      <span className="sr-only">Loading chats</span>
      <div className="px-2.5 pt-[22px] pb-2.5">
        <div className="h-2 w-12 rounded-full bg-muted" />
      </div>
      {SKELETON_WIDTHS.map((width) => (
        <div className="flex h-9 items-center px-2.5" key={width}>
          <div className={`h-3 rounded-full bg-muted ${width}`} />
        </div>
      ))}
    </div>
  );
}

function SidebarNote({ children }: { children: ReactNode }) {
  return (
    <p className="px-[22px] py-2 text-muted-foreground text-xs">{children}</p>
  );
}

function SignedInHistory() {
  const pathname = usePathname();
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const { deleteChat, refreshChats, renameChat } = useChat();
  const list = useChatList();
  const chats = list.status === "ready" ? list.chats : undefined;

  const groups = useMemo(
    () => (chats ? groupChatsByDate(chats, new Date()) : []),
    [chats]
  );

  const closeMobileSheet = useCallback(
    () => setOpenMobile(false),
    [setOpenMobile]
  );

  const handleDelete = useCallback(
    (chatId: string, wasActive: boolean) => {
      deleteChat(chatId);
      if (wasActive) {
        router.replace("/");
      }
    },
    [deleteChat, router]
  );

  if (list.status === "error") {
    return (
      <div className="flex items-center justify-between py-2 pr-3 pl-[22px]">
        <p className="text-muted-foreground text-xs">Chats didn't load.</p>
        <Button
          className="h-7 rounded-lg px-2 text-xs"
          onClick={() => refreshChats()}
          variant="ghost"
        >
          Retry
        </Button>
      </div>
    );
  }

  if (list.status === "loading") {
    return <SidebarSkeleton />;
  }

  if (list.chats.length === 0) {
    return <SidebarNote>No chats yet</SidebarNote>;
  }

  return (
    <SidebarMenu className="relative gap-0 px-3 pb-3">
      <LayoutGroup>
        <AnimatePresence initial={false} mode="popLayout">
          {groups.flatMap((group) => [
            <motion.li
              key={`group:${group.label}`}
              layout="position"
              {...PRESENCE}
            >
              <SidebarGroupLabel
                asChild
                className="h-auto rounded-none px-2.5 pt-[18px] pb-1.5 text-muted-foreground"
              >
                <h2>{group.label}</h2>
              </SidebarGroupLabel>
            </motion.li>,
            ...group.chats.map((chat) => (
              <ChatRow
                chat={chat}
                isActive={pathname === `/chat/${chat.id}`}
                isResponding={list.loadingChats.has(chat.id)}
                key={chat.id}
                onDelete={handleDelete}
                onNavigate={closeMobileSheet}
                onRename={renameChat}
              />
            )),
          ])}
        </AnimatePresence>
      </LayoutGroup>
    </SidebarMenu>
  );
}

export function SidebarHistory({ session }: { session: Session | null }) {
  if (!session) {
    return <SidebarNote>Log in to see your chats.</SidebarNote>;
  }
  return <SignedInHistory />;
}
