"use client";

import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@radix-ui/react-dialog";
import { Command, defaultFilter } from "cmdk";
import {
  Check,
  type LucideIcon,
  MessageSquare,
  Monitor,
  Moon,
  PanelLeft,
  Plus,
  Search,
  Sun,
  TextCursorInput,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCachedChats } from "@/components/chat-context";
import { useSidebar } from "@/components/ui/sidebar";
import { focusComposer } from "@/lib/composer";

const RECENT_CHAT_COUNT = 8;
const APPLE_PLATFORM = /Mac|iPhone|iPad/;

interface ShortcutKeys {
  letter: string;
  shift?: boolean;
}

interface PaletteAction {
  focusesComposer: boolean;
  icon: LucideIcon;
  id: string;
  isActive?: boolean;
  keywords: string[];
  label: string;
  run: () => void;
  shortcut?: ShortcutKeys;
}

type RunAction = (
  action: Pick<PaletteAction, "focusesComposer" | "run">
) => void;

function filterByKeywords(_value: string, search: string, keywords?: string[]) {
  return defaultFilter(keywords?.join(" ") ?? "", search);
}

function Shortcut({ letter, shift = false }: ShortcutKeys) {
  const isApple = APPLE_PLATFORM.test(navigator.userAgent);
  const keys = [
    isApple ? "⌘" : "Ctrl",
    ...(shift ? [isApple ? "⇧" : "Shift"] : []),
    letter,
  ];
  return (
    <span className="ml-auto flex gap-1">
      {keys.map((key) => (
        <kbd
          className="min-w-5 rounded-md bg-card px-1.5 text-center font-sans text-[11px] text-muted-foreground leading-5"
          key={key}
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}

function useStartNewChat() {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  return useCallback(() => {
    setOpenMobile(false);
    router.push("/");
  }, [router, setOpenMobile]);
}

const ITEM_CLASS =
  "flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 text-sm outline-none data-[selected=true]:bg-foreground/[0.06] [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground";

function PaletteContent({ onRun }: { onRun: RunAction }) {
  const router = useRouter();
  const chats = useCachedChats();
  const { theme, setTheme } = useTheme();
  const { setOpenMobile, toggleSidebar } = useSidebar();
  const startNewChat = useStartNewChat();
  const [search, setSearch] = useState("");

  const actions: PaletteAction[] = [
    {
      id: "new-chat",
      label: "New chat",
      icon: Plus,
      keywords: ["new chat", "start", "create"],
      shortcut: { letter: "O", shift: true },
      focusesComposer: true,
      run: startNewChat,
    },
    {
      id: "focus-composer",
      label: "Focus composer",
      icon: TextCursorInput,
      keywords: ["focus composer", "message", "input", "type"],
      focusesComposer: true,
      run: () => setOpenMobile(false),
    },
    {
      id: "toggle-sidebar",
      label: "Toggle sidebar",
      icon: PanelLeft,
      keywords: ["toggle sidebar", "show", "hide", "panel"],
      shortcut: { letter: "B" },
      focusesComposer: false,
      run: toggleSidebar,
    },
    {
      id: "theme-light",
      label: "Theme: Light",
      icon: Sun,
      keywords: ["theme light", "appearance", "mode"],
      isActive: theme === "light",
      focusesComposer: false,
      run: () => setTheme("light"),
    },
    {
      id: "theme-dark",
      label: "Theme: Dark",
      icon: Moon,
      keywords: ["theme dark", "appearance", "mode"],
      isActive: theme === "dark",
      focusesComposer: false,
      run: () => setTheme("dark"),
    },
    {
      id: "theme-system",
      label: "Theme: System",
      icon: Monitor,
      keywords: ["theme system", "appearance", "mode", "auto"],
      isActive: theme === "system",
      focusesComposer: false,
      run: () => setTheme("system"),
    },
  ];

  const visibleChats = search ? chats : chats.slice(0, RECENT_CHAT_COUNT);

  return (
    <Command filter={filterByKeywords} label="Command palette" loop>
      <div className="flex items-center gap-2.5 border-border border-b px-4">
        <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <Command.Input
          className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-[15px]"
          onValueChange={setSearch}
          placeholder="Search chats and actions"
          value={search}
        />
      </div>
      <Command.List className="max-h-[min(380px,55vh)] scroll-py-1.5 overflow-y-auto overscroll-contain p-1.5 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:text-xs">
        <Command.Empty className="py-8 text-center text-muted-foreground text-sm">
          No chats or actions match.
        </Command.Empty>
        <Command.Group heading="Actions">
          {actions.map((action) => (
            <Command.Item
              className={ITEM_CLASS}
              key={action.id}
              keywords={action.keywords}
              onSelect={() => onRun(action)}
              value={action.id}
            >
              <action.icon aria-hidden />
              <span>{action.label}</span>
              {action.isActive ? (
                <>
                  <Check aria-hidden className="ml-auto" />
                  <span className="sr-only">Current</span>
                </>
              ) : null}
              {action.shortcut ? <Shortcut {...action.shortcut} /> : null}
            </Command.Item>
          ))}
        </Command.Group>
        {visibleChats.length > 0 ? (
          <Command.Group heading={search ? "Chats" : "Recent chats"}>
            {visibleChats.map((chat) => (
              <Command.Item
                className={ITEM_CLASS}
                key={chat.id}
                keywords={[chat.title]}
                onSelect={() =>
                  onRun({
                    focusesComposer: true,
                    run: () => {
                      setOpenMobile(false);
                      router.push(`/chat/${chat.id}`);
                    },
                  })
                }
                value={`chat-${chat.id}`}
              >
                <MessageSquare aria-hidden />
                <span className="truncate">{chat.title}</span>
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}
      </Command.List>
    </Command>
  );
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const focusComposerOnCloseRef = useRef(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const startNewChat = useStartNewChat();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const hasModifier = event.metaKey || event.ctrlKey;
      if (!hasModifier || event.altKey || event.isComposing) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "k" && !event.shiftKey) {
        event.preventDefault();
        setOpen((current) => !current);
      } else if (key === "o" && event.shiftKey) {
        event.preventDefault();
        focusComposerOnCloseRef.current = true;
        setOpen(false);
        startNewChat();
        focusComposer();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [startNewChat]);

  const runAction = useCallback<RunAction>(({ focusesComposer, run }) => {
    focusComposerOnCloseRef.current = focusesComposer;
    setOpen(false);
    run();
  }, []);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogPortal>
        <DialogOverlay className="data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-background/70 data-[state=closed]:animate-out data-[state=open]:animate-in" />
        <DialogContent
          aria-describedby={undefined}
          className="data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-[0.98] data-[state=open]:zoom-in-[0.98] fixed top-[14vh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-[560px] -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-md duration-150 data-[state=closed]:animate-out data-[state=open]:animate-in"
          onCloseAutoFocus={(event) => {
            // Radix returns focus to a `DialogTrigger`, and this dialog opens
            // from a shortcut instead, so it restores focus itself.
            event.preventDefault();
            if (focusComposerOnCloseRef.current) {
              focusComposer();
            } else {
              returnFocusRef.current?.focus();
            }
          }}
          onOpenAutoFocus={() => {
            focusComposerOnCloseRef.current = false;
            returnFocusRef.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
          }}
        >
          <DialogTitle className="sr-only">Command palette</DialogTitle>
          <PaletteContent onRun={runAction} />
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
