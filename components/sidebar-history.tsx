"use client";

import { DndContext, useDraggable } from "@dnd-kit/core";
import {
  GripVertical,
  type LucideIcon,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
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
import { DraggedChatOverlay, useChatRail } from "@/components/chat-rail";
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
import { type DropTarget, PIN_AT_END, UNPINNED } from "@/lib/pinned-order";

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
  isPinned: boolean;
  pin: () => void;
  remove: () => void;
  rename: () => void;
  unpin: () => void;
}

/** Where focus goes when the menu closes after an action runs. */
type FocusAfterAction = "menu-opener" | "neighbor-row" | "kept-by-action";

interface RowAction {
  icon: LucideIcon;
  label: string;
  run: (row: RowControls) => FocusAfterAction;
  shows?: (row: RowControls) => boolean;
  variant?: "destructive";
}

const ROW_ACTIONS: readonly RowAction[] = [
  {
    label: "Pin chat",
    icon: Pin,
    shows: (row) => !row.isPinned,
    run: (row) => {
      row.pin();
      return "menu-opener";
    },
  },
  {
    label: "Unpin chat",
    icon: PinOff,
    shows: (row) => row.isPinned,
    run: (row) => {
      row.unpin();
      return "menu-opener";
    },
  },
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
  onMove: (chatId: string, target: DropTarget) => void;
  onNavigate: () => void;
  onRename: (chatId: string, title: string) => void;
  ref?: Ref<HTMLLIElement>;
}

const SLOT_CLASS =
  "rounded-[10px] bg-primary/8 outline-1 outline-dashed outline-primary/45 -outline-offset-1";

function ChatRowComponent({
  chat,
  isActive,
  isResponding,
  onDelete,
  onMove,
  onNavigate,
  onRename,
  ref,
}: ChatRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const { attributes, isDragging, listeners, setActivatorNodeRef, setNodeRef } =
    useDraggable({ id: chat.id });
  const setLinkRef = useCallback(
    (node: HTMLAnchorElement | null) => {
      linkRef.current = node;
      setNodeRef(node);
      setActivatorNodeRef(node);
    },
    [setActivatorNodeRef, setNodeRef]
  );
  const isPinned = chat.pinnedKey !== null;
  const openedFromRowRef = useRef(false);
  const usedKeysInMenuRef = useRef(false);
  const openedByPressRef = useRef(false);
  const focusOnMenuCloseRef = useRef<HTMLElement | "kept" | null>(null);
  const refocusLinkRef = useRef(false);

  useEffect(() => {
    if (!isEditing && refocusLinkRef.current) {
      refocusLinkRef.current = false;
      linkRef.current?.focus();
    }
  }, [isEditing]);

  const controls: RowControls = {
    isPinned,
    pin: () => onMove(chat.id, PIN_AT_END),
    rename: () => setIsEditing(true),
    remove: () => onDelete(chat.id, isActive),
    unpin: () => onMove(chat.id, UNPINNED),
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
    // A long press that lifted the row also fires contextmenu on Android.
    if (isDragging) {
      return;
    }
    openedFromRowRef.current = true;
    openedByPressRef.current = event.type === "contextmenu";
    setIsMenuOpen(true);
  };

  const restoreFocusOnMenuClose = (event: Event) => {
    const target =
      focusOnMenuCloseRef.current ??
      (openedFromRowRef.current ? linkRef.current : null);
    focusOnMenuCloseRef.current = null;
    openedFromRowRef.current = false;
    usedKeysInMenuRef.current = false;
    openedByPressRef.current = false;
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
    <MotionMenuItem
      className={isDragging ? SLOT_CLASS : undefined}
      layout="position"
      ref={ref}
      {...PRESENCE}
    >
      {isPinned && !isDragging ? (
        <GripVertical
          aria-hidden
          className="pointer-events-none absolute top-2.5 -left-[11px] size-4 text-muted-foreground opacity-0 transition-opacity group-hover/menu-item:opacity-100"
        />
      ) : null}
      {isEditing ? (
        <RenameField initialTitle={chat.title} onDone={finishRename} />
      ) : (
        <SidebarMenuButton
          asChild
          className={`pointer-coarse:h-11 select-none [-webkit-touch-callout:none] focus-visible:ring-ring ${isDragging ? "opacity-0" : ""}`}
          isActive={isActive}
        >
          <Link
            aria-current={isActive ? "page" : undefined}
            aria-describedby={attributes["aria-describedby"]}
            data-chat-link=""
            href={`/chat/${chat.id}`}
            {...listeners}
            onContextMenu={openMenuFromRow}
            onKeyDown={(event) => {
              if (isContextMenuKey(event)) {
                openMenuFromRow(event);
              } else {
                listeners?.onKeyDown?.(event);
              }
            }}
            onNavigate={(event) => {
              if (isActive) {
                event.preventDefault();
              }
              onNavigate();
            }}
            ref={setLinkRef}
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
      {isEditing || isDragging ? null : (
        <DropdownMenu onOpenChange={setIsMenuOpen} open={isMenuOpen}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuAction
              aria-label={`More options for ${chat.title}`}
              className="pointer-coarse:top-3! rounded-lg focus-visible:ring-ring"
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
              openedByPressRef.current = false;
            }}
            onPointerUpCapture={(event) => {
              if (openedByPressRef.current) {
                openedByPressRef.current = false;
                // Radix MenuItem clicks itself on a pointerup with no pointerdown
                // on it, unless the pointerup is default-prevented.
                event.preventDefault();
              }
            }}
            side="right"
          >
            {ROW_ACTIONS.filter(
              (action) => action.shows?.(controls) ?? true
            ).map((action) => (
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

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <SidebarGroupLabel
      asChild
      className="h-auto gap-1.5 rounded-none px-2.5 pt-[18px] pb-1.5 text-muted-foreground [&>svg]:size-[13px]"
    >
      <h2>{children}</h2>
    </SidebarGroupLabel>
  );
}

function SignedInHistory() {
  const pathname = usePathname();
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const { deleteChat, refreshChats, renameChat } = useChat();
  const list = useChatList();
  const chats = list.status === "ready" ? list.chats : undefined;
  const { announcement, contextProps, drag, labelRef, moveChat, rail } =
    useChatRail(chats);

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

  if (list.status === "loading" || !rail) {
    return <SidebarSkeleton />;
  }

  if (list.chats.length === 0) {
    return <SidebarNote>No chats yet</SidebarNote>;
  }

  const renderRow = (chat: ChatSummary) => (
    <ChatRow
      chat={chat}
      isActive={pathname === `/chat/${chat.id}`}
      isResponding={list.loadingChats.has(chat.id)}
      key={chat.id}
      onDelete={handleDelete}
      onMove={moveChat}
      onNavigate={closeMobileSheet}
      onRename={renameChat}
    />
  );

  const pinnedItems = rail.showsPinnedGroup
    ? [
        <motion.li
          key="group:Pinned"
          layout="position"
          ref={labelRef}
          {...PRESENCE}
        >
          <GroupLabel>
            <Pin aria-hidden />
            Pinned
          </GroupLabel>
        </motion.li>,
        ...(rail.pinned.length > 0
          ? rail.pinned.map(renderRow)
          : [
              <motion.li
                className="flex h-9 items-center gap-2 rounded-[10px] px-2.5 text-muted-foreground text-sm outline-dashed outline-1 outline-muted-foreground/40 -outline-offset-1"
                key="pin-target"
                layout="position"
                {...PRESENCE}
              >
                <Pin aria-hidden className="size-4" />
                Drop here to pin
              </motion.li>,
            ]),
      ]
    : [];

  const draggedTitle = drag
    ? list.chats.find(({ id }) => id === drag.chatId)?.title
    : undefined;

  return (
    <DndContext {...contextProps}>
      <SidebarMenu className="relative gap-0 px-3 pb-3">
        <LayoutGroup>
          <AnimatePresence initial={false} mode="popLayout">
            {[
              ...pinnedItems,
              ...rail.groups.flatMap((group) => [
                <motion.li
                  key={`group:${group.label}`}
                  layout="position"
                  {...PRESENCE}
                >
                  <GroupLabel>{group.label}</GroupLabel>
                </motion.li>,
                ...group.chats.map(renderRow),
              ]),
            ]}
          </AnimatePresence>
        </LayoutGroup>
      </SidebarMenu>
      <DraggedChatOverlay title={draggedTitle} />
      <p aria-atomic="true" aria-live="assertive" className="sr-only">
        {announcement}
      </p>
    </DndContext>
  );
}

export function SidebarHistory({ session }: { session: Session | null }) {
  if (!session) {
    return <SidebarNote>Log in to see your chats.</SidebarNote>;
  }
  return <SignedInHistory />;
}
