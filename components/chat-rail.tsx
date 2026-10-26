"use client";

import {
  type Announcements,
  type DndContextProps,
  DragOverlay,
  type DropAnimation,
  defaultDropAnimationSideEffects,
  type KeyboardCoordinateGetter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { type ChatSummary, useChat } from "@/components/chat-context";
import { useToday } from "@/hooks/use-today";
import { groupChatsByDate } from "@/lib/chat-groups";
import {
  currentTargetOf,
  type DropTarget,
  dropTargetAt,
  isSameTarget,
  type PinnedSlots,
  pinnedKeyForDrop,
  placeChat,
  splitPinned,
  stepDropTarget,
} from "@/lib/pinned-order";

interface Drag {
  chatId: string;
  origin: DropTarget;
  target: DropTarget;
}

const MOUSE_DRAGS_AFTER_MOVING = { activationConstraint: { distance: 6 } };

const TOUCH_DRAGS_AFTER_HOLDING = {
  activationConstraint: { delay: 200, tolerance: 6 },
};

const KEYS_LEAVING_ENTER_TO_LINKS = {
  cancel: ["Escape", "Tab"],
  end: ["Space", "Enter"],
  start: ["Space"],
};

const ARROW_DIRECTIONS: Record<string, "up" | "down"> = {
  ArrowDown: "down",
  ArrowUp: "up",
};

const SILENT: Announcements = {
  onDragCancel: () => undefined,
  onDragEnd: () => undefined,
  onDragOver: () => undefined,
  onDragStart: () => undefined,
};

const ACCESSIBILITY = {
  announcements: SILENT,
  screenReaderInstructions: {
    draggable:
      "To move this chat, press space. Use the up and down arrow keys to pin it, reorder it, or unpin it. Press space again to drop it, or escape to cancel.",
  },
};

const SETTLE_MS = 200;
const SETTLE_EASING = "cubic-bezier(0.2, 0.8, 0.2, 1)";

const hideRowWhileSettling = defaultDropAnimationSideEffects({
  styles: { active: { opacity: "0" } },
});

const DROP_ANIMATION: DropAnimation = {
  duration: SETTLE_MS,
  easing: SETTLE_EASING,
  sideEffects: (parameters) => {
    parameters.dragOverlay.node.firstElementChild?.animate(
      { boxShadow: "0 0 0 0 transparent", rotate: "0deg" },
      { duration: SETTLE_MS, easing: SETTLE_EASING, fill: "forwards" }
    );
    return hideRowWhileSettling(parameters);
  },
};

const NO_TRANSITION = () => undefined;

function countOtherPinned(chats: readonly ChatSummary[], chatId: string) {
  return chats.filter((chat) => chat.pinnedKey !== null && chat.id !== chatId)
    .length;
}

function measureSlots(
  label: HTMLElement | null,
  rowHeight: number
): PinnedSlots | null {
  const rail = label?.offsetParent;
  if (!(label && rail)) {
    return null;
  }
  // offsetTop ignores the transforms of rows that are still springing.
  const top =
    rail.getBoundingClientRect().top + label.offsetTop + label.offsetHeight;
  return { rowHeight, top };
}

function describePlace(title: string, target: DropTarget, otherPinned: number) {
  if (target.zone === "unpinned") {
    return `${title}, not pinned.`;
  }
  return `${title}, position ${target.index + 1} of ${otherPinned + 1} in Pinned.`;
}

function describeDrop(title: string, drag: Drag, otherPinned: number) {
  const { origin, target } = drag;
  if (isSameTarget(origin, target)) {
    return `${title} dropped where it was.`;
  }
  if (target.zone === "unpinned") {
    return `Unpinned ${title}.`;
  }
  const verb = origin.zone === "unpinned" ? "Pinned" : "Moved";
  return `${verb} ${title} to position ${target.index + 1} of ${otherPinned + 1}.`;
}

export function useChatRail(chats: readonly ChatSummary[] | undefined) {
  const { setPinnedKey } = useChat();
  const [drag, setDrag] = useState<Drag | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const dragRef = useRef<Drag | null>(null);
  const chatsRef = useRef(chats);
  const labelRef = useRef<HTMLLIElement>(null);
  const reduceMotion = useReducedMotion();
  const today = useToday();

  useLayoutEffect(() => {
    chatsRef.current = chats;
  });

  // dnd-kit measures the lifted row after the drag's first commit and pins
  // the overlay to that rect. Opening the empty Pinned group in the same
  // commit would push the row down first and leave the overlay below the
  // pointer, so the group opens one commit later.
  const isDragging = drag !== null;
  const [isEmptyGroupOpen, setIsEmptyGroupOpen] = useState(false);
  useEffect(() => {
    setIsEmptyGroupOpen(isDragging);
  }, [isDragging]);

  const rail = useMemo(() => {
    if (!chats) {
      return null;
    }
    const { pinned, unpinned } = drag
      ? placeChat(chats, drag.chatId, drag.target)
      : splitPinned(chats);
    return {
      groups: groupChatsByDate(unpinned, today),
      pinned,
      showsPinnedGroup: pinned.length > 0 || (isDragging && isEmptyGroupOpen),
    };
  }, [chats, drag, isDragging, isEmptyGroupOpen, today]);

  const moveChat = useCallback(
    (chatId: string, target: DropTarget) => {
      const list = chatsRef.current ?? [];
      const chat = list.find(({ id }) => id === chatId);
      if (chat) {
        setPinnedKey(chat, pinnedKeyForDrop(list, chatId, target));
      }
    },
    [setPinnedKey]
  );

  const updateDrag = useCallback((next: Drag | null) => {
    dragRef.current = next;
    setDrag(next);
  }, []);

  const moveDragTo = useCallback(
    (target: DropTarget) => {
      const { current } = dragRef;
      const list = chatsRef.current ?? [];
      const chat = list.find(({ id }) => id === current?.chatId);
      if (!(current && chat) || isSameTarget(current.target, target)) {
        return;
      }
      updateDrag({ ...current, target });
      setAnnouncement(
        describePlace(chat.title, target, countOtherPinned(list, chat.id))
      );
    },
    [updateDrag]
  );

  const coordinateGetter = useCallback<KeyboardCoordinateGetter>(
    (event, { context, currentCoordinates }) => {
      const direction = ARROW_DIRECTIONS[event.code];
      const { current } = dragRef;
      const rect = context.collisionRect;
      if (!(direction && current && rect)) {
        return;
      }
      event.preventDefault();
      const otherPinned = countOtherPinned(
        chatsRef.current ?? [],
        current.chatId
      );
      const target = stepDropTarget(current.target, direction, otherPinned);
      const slots = measureSlots(labelRef.current, rect.height);
      if (isSameTarget(target, current.target) || !slots) {
        return;
      }
      moveDragTo(target);
      const slot = target.zone === "pinned" ? target.index : otherPinned + 1;
      return {
        x: currentCoordinates.x,
        y: slots.top + slot * slots.rowHeight,
      };
    },
    [moveDragTo]
  );

  const keyboardOptions = useMemo(
    () => ({
      coordinateGetter,
      keyboardCodes: KEYS_LEAVING_ENTER_TO_LINKS,
      scrollBehavior: reduceMotion ? ("auto" as const) : ("smooth" as const),
    }),
    [coordinateGetter, reduceMotion]
  );

  const sensors = useSensors(
    useSensor(MouseSensor, MOUSE_DRAGS_AFTER_MOVING),
    useSensor(TouchSensor, TOUCH_DRAGS_AFTER_HOLDING),
    useSensor(KeyboardSensor, keyboardOptions)
  );

  const contextProps: DndContextProps = {
    accessibility: ACCESSIBILITY,
    sensors,
    onDragStart: ({ active }) => {
      const list = chats ?? [];
      const chat = list.find(({ id }) => id === active.id);
      if (!chat) {
        return;
      }
      const origin = currentTargetOf(list, chat.id);
      updateDrag({ chatId: chat.id, origin, target: origin });
      setAnnouncement(
        `Picked up ${describePlace(chat.title, origin, countOtherPinned(list, chat.id))}`
      );
    },
    onDragMove: ({ active, activatorEvent, delta }) => {
      const { current } = dragRef;
      const rect = active.rect.current.translated;
      if (!(current && rect) || activatorEvent instanceof KeyboardEvent) {
        return;
      }
      const slots = measureSlots(labelRef.current, rect.height);
      if (!slots) {
        return;
      }
      moveDragTo(
        dropTargetAt({
          centerY: rect.top + rect.height / 2,
          origin: current.origin,
          otherPinned: countOtherPinned(chats ?? [], current.chatId),
          slots,
          travelY: delta.y,
        })
      );
    },
    onDragEnd: () => {
      const { current } = dragRef;
      updateDrag(null);
      const list = chats ?? [];
      const chat = list.find(({ id }) => id === current?.chatId);
      if (!(current && chat)) {
        return;
      }
      moveChat(chat.id, current.target);
      setAnnouncement(
        describeDrop(chat.title, current, countOtherPinned(list, chat.id))
      );
    },
    onDragCancel: () => {
      const title = chats?.find(
        ({ id }) => id === dragRef.current?.chatId
      )?.title;
      updateDrag(null);
      if (title) {
        setAnnouncement(`Move cancelled. ${title} is back where it was.`);
      }
    },
  };

  return { announcement, contextProps, drag, labelRef, moveChat, rail };
}

export function DraggedChatOverlay({ title }: { title: string | undefined }) {
  const reduceMotion = useReducedMotion();
  return createPortal(
    <DragOverlay
      dropAnimation={reduceMotion ? null : DROP_ANIMATION}
      transition={reduceMotion ? NO_TRANSITION : undefined}
    >
      {title === undefined ? null : (
        <div className="relative flex h-9 -rotate-[1.2deg] starting:rotate-0 cursor-grabbing items-center rounded-[10px] bg-sidebar-accent pr-2.5 pl-7 text-sidebar-accent-foreground text-sm shadow-[0_16px_30px_-12px_color-mix(in_oklch,var(--foreground)_55%,transparent)] starting:shadow-none transition-[rotate,box-shadow] duration-150 ease-out motion-reduce:rotate-0 motion-reduce:transition-none dark:shadow-[0_16px_30px_-12px_rgb(0_0_0/0.55)]">
          <GripVertical
            aria-hidden
            className="absolute left-[7px] size-4 text-muted-foreground"
          />
          <span className="min-w-0 flex-1 truncate">{title}</span>
        </div>
      )}
    </DragOverlay>,
    document.body
  );
}
