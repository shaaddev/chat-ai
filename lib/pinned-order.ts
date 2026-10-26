import { generateKeyBetween } from "fractional-indexing";

export interface Pinnable {
  id: string;
  pinnedKey: string | null;
}

type Pinned<T extends Pinnable> = T & { pinnedKey: string };

/**
 * Where a dragged chat lands. A pinned index counts the other pinned chats, so
 * 0 is the top of the group and their count is the bottom.
 */
export type DropTarget =
  | { zone: "pinned"; index: number }
  | { zone: "unpinned" };

export const UNPINNED: DropTarget = { zone: "unpinned" };

export const PIN_AT_END: DropTarget = {
  zone: "pinned",
  index: Number.POSITIVE_INFINITY,
};

const isPinned = <T extends Pinnable>(chat: T): chat is Pinned<T> =>
  chat.pinnedKey !== null;

// Fractional-indexing keys sort by code unit. localeCompare would not.
function compareCodeUnits(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

const byPinnedOrder = (a: Pinned<Pinnable>, b: Pinned<Pinnable>) =>
  compareCodeUnits(a.pinnedKey, b.pinnedKey) || compareCodeUnits(a.id, b.id);

/** Pinned chats sorted by key, then id. Unpinned chats keep their order. */
export function splitPinned<T extends Pinnable>(
  chats: readonly T[]
): { pinned: Pinned<T>[]; unpinned: T[] } {
  const pinned: Pinned<T>[] = [];
  const unpinned: T[] = [];
  for (const chat of chats) {
    if (isPinned(chat)) {
      pinned.push(chat);
    } else {
      unpinned.push(chat);
    }
  }
  pinned.sort(byPinnedOrder);
  return { pinned, unpinned };
}

const clampIndex = (index: number, max: number) =>
  Math.min(Math.max(index, 0), max);

export function isSameTarget(a: DropTarget, b: DropTarget): boolean {
  if (a.zone === "pinned" && b.zone === "pinned") {
    return a.index === b.index;
  }
  return a.zone === b.zone;
}

export function currentTargetOf(
  chats: readonly Pinnable[],
  chatId: string
): DropTarget {
  const index = splitPinned(chats).pinned.findIndex(
    (chat) => chat.id === chatId
  );
  return index === -1 ? UNPINNED : { zone: "pinned", index };
}

// Two devices can pin chats with the same key, and no key sorts strictly
// between equal keys. A drop inside such a run lands after it, so the preview
// and the saved order agree.
function landingIndex(others: readonly Pinnable[], index: number): number {
  let landing = clampIndex(index, others.length);
  while (
    landing > 0 &&
    landing < others.length &&
    others[landing].pinnedKey === others[landing - 1].pinnedKey
  ) {
    landing += 1;
  }
  return landing;
}

/** The rail with one chat moved to `target`, as it looks once the drop saves. */
export function placeChat<T extends Pinnable>(
  chats: readonly T[],
  chatId: string,
  target: DropTarget
): { pinned: T[]; unpinned: T[] } {
  const { pinned, unpinned } = splitPinned(chats);
  const chat = chats.find(({ id }) => id === chatId);
  if (!chat) {
    return { pinned, unpinned };
  }
  const others = pinned.filter(({ id }) => id !== chatId);
  const rest = unpinned.filter(({ id }) => id !== chatId);
  if (target.zone === "unpinned") {
    return { pinned: others, unpinned: [...rest, chat] };
  }
  const index = landingIndex(others, target.index);
  return {
    pinned: [...others.slice(0, index), chat, ...others.slice(index)],
    unpinned: rest,
  };
}

/**
 * The key that saves `placeChat` for this drop, or the chat's current key
 * when the drop leaves it where it was.
 */
export function pinnedKeyForDrop(
  chats: readonly Pinnable[],
  chatId: string,
  target: DropTarget
): string | null {
  if (target.zone === "unpinned") {
    return null;
  }
  const { pinned } = splitPinned(chats);
  const others = pinned.filter(({ id }) => id !== chatId);
  const index = landingIndex(others, target.index);
  const current = pinned.findIndex(({ id }) => id === chatId);
  if (current === index) {
    return pinned[current].pinnedKey;
  }
  const before = others[index - 1]?.pinnedKey ?? null;
  const after = others[index]?.pinnedKey ?? null;
  return generateKeyBetween(before, after);
}

export interface PinnedSlots {
  rowHeight: number;
  /** Viewport y where the first pinned slot starts. */
  top: number;
}

/**
 * The target under a dragged row's center. A row stays where it started
 * until it travels half a row, so picking it up never moves it, even when the
 * empty Pinned group opens under it.
 */
export function dropTargetAt({
  centerY,
  origin,
  otherPinned,
  slots,
  travelY,
}: {
  centerY: number;
  origin: DropTarget;
  otherPinned: number;
  slots: PinnedSlots;
  travelY: number;
}): DropTarget {
  if (Math.abs(travelY) < slots.rowHeight / 2) {
    return origin;
  }
  const slot = Math.floor((centerY - slots.top) / slots.rowHeight);
  if (slot > otherPinned) {
    return UNPINNED;
  }
  return { zone: "pinned", index: Math.max(slot, 0) };
}

/**
 * One arrow key press: up and down walk the pinned slots, down from the last
 * one unpins, and up from unpinned pins at the bottom.
 */
export function stepDropTarget(
  target: DropTarget,
  direction: "up" | "down",
  otherPinned: number
): DropTarget {
  if (target.zone === "unpinned") {
    return direction === "up"
      ? { zone: "pinned", index: otherPinned }
      : UNPINNED;
  }
  if (direction === "up") {
    return { zone: "pinned", index: Math.max(target.index - 1, 0) };
  }
  return target.index < otherPinned
    ? { zone: "pinned", index: target.index + 1 }
    : UNPINNED;
}
