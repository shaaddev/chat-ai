/// <reference types="bun-types/test" />
import { describe, expect, test } from "bun:test";
import { patchRequestBodySchema } from "@/app/api/chats/[id]/schema";
import {
  currentTargetOf,
  type DropTarget,
  dropTargetAt,
  isSameTarget,
  PIN_AT_END,
  type Pinnable,
  pinnedKeyForDrop,
  placeChat,
  splitPinned,
  stepDropTarget,
  UNPINNED,
} from "./pinned-order";

const chat = (id: string, pinnedKey: string | null = null): Pinnable => ({
  id,
  pinnedKey,
});

const ids = (chats: readonly Pinnable[]) => chats.map(({ id }) => id);

const pinnedOrder = (chats: readonly Pinnable[]) =>
  ids(splitPinned(chats).pinned);

function drop(chats: Pinnable[], chatId: string, target: DropTarget) {
  const pinnedKey = pinnedKeyForDrop(chats, chatId, target);
  return chats.map((c) => (c.id === chatId ? { ...c, pinnedKey } : c));
}

const at = (index: number): DropTarget => ({ zone: "pinned", index });

const RAIL = [
  chat("lisbon", "a0"),
  chat("resume", "a1"),
  chat("neon", "a2"),
  chat("stream"),
  chat("gifts"),
];

describe("splitPinned", () => {
  test("orders pinned chats by key in code-unit order, then id", () => {
    const chats = [
      chat("lower", "a0"),
      chat("unpinned-1"),
      chat("upper", "Zz"),
      chat("tie-b", "a0V"),
      chat("tie-a", "a0V"),
      chat("unpinned-2"),
    ];

    const { pinned, unpinned } = splitPinned(chats);

    expect(ids(pinned)).toEqual(["upper", "lower", "tie-a", "tie-b"]);
    expect(ids(unpinned)).toEqual(["unpinned-1", "unpinned-2"]);
  });
});

describe("pinnedKeyForDrop", () => {
  test("saves the order the drag previewed", () => {
    const drops: [string, DropTarget][] = [
      ["neon", at(0)],
      ["lisbon", at(2)],
      ["resume", at(1)],
      ["stream", at(0)],
      ["stream", at(1)],
      ["stream", at(3)],
      ["stream", PIN_AT_END],
      ["lisbon", UNPINNED],
    ];

    for (const [chatId, target] of drops) {
      const previewed = ids(placeChat(RAIL, chatId, target).pinned);
      expect(pinnedOrder(drop(RAIL, chatId, target))).toEqual(previewed);
    }
  });

  test("moves a pinned chat to the top and to the bottom", () => {
    expect(pinnedOrder(drop(RAIL, "neon", at(0)))).toEqual([
      "neon",
      "lisbon",
      "resume",
    ]);
    expect(pinnedOrder(drop(RAIL, "lisbon", PIN_AT_END))).toEqual([
      "resume",
      "neon",
      "lisbon",
    ]);
  });

  test("pins an unpinned chat between two pinned chats", () => {
    expect(pinnedOrder(drop(RAIL, "gifts", at(1)))).toEqual([
      "lisbon",
      "gifts",
      "resume",
      "neon",
    ]);
  });

  test("keeps the current key when the drop leaves a chat in place", () => {
    expect(pinnedKeyForDrop(RAIL, "resume", at(1))).toBe("a1");
  });

  test("unpins with a null key", () => {
    expect(pinnedKeyForDrop(RAIL, "neon", UNPINNED)).toBeNull();
  });

  test("pins the first chat when nothing is pinned", () => {
    const chats = [chat("stream"), chat("gifts")];

    const pinned = drop(chats, "gifts", at(0));

    expect(pinnedOrder(pinned)).toEqual(["gifts"]);
    expect(pinned.find(({ id }) => id === "stream")?.pinnedKey).toBeNull();
  });

  test("lands next to chats that share a key instead of throwing", () => {
    const chats = [
      chat("first", "a0"),
      chat("twin-a", "a1"),
      chat("twin-b", "a1"),
      chat("last", "a2"),
      chat("new"),
    ];

    const order = pinnedOrder(drop(chats, "new", at(2)));

    expect(order).toEqual(["first", "twin-a", "twin-b", "new", "last"]);
  });

  test("previews a drop between chats that share a key where it saves", () => {
    const chats = [
      chat("a", "a1"),
      chat("b", "a1"),
      chat("c", "a2"),
      chat("x"),
    ];

    const preview = ids(placeChat(chats, "x", at(1)).pinned);

    expect(preview).toEqual(["a", "b", "x", "c"]);
    expect(pinnedOrder(drop(chats, "x", at(1)))).toEqual(preview);
  });

  test("keeps every key valid for the PATCH route across many drops", () => {
    let chats: Pinnable[] = Array.from({ length: 8 }, (_, index) =>
      chat(`chat-${index}`)
    );
    let seed = 7;
    const random = (max: number) => {
      seed = (seed * 48_271) % 2_147_483_647;
      return seed % max;
    };

    for (let step = 0; step < 500; step += 1) {
      const chatId = chats[random(chats.length)].id;
      const otherPinned = chats.filter(
        (c) => c.pinnedKey !== null && c.id !== chatId
      ).length;
      const roll = random(otherPinned + 2);
      const target = roll > otherPinned ? UNPINNED : at(roll);
      const previewed = ids(placeChat(chats, chatId, target).pinned);

      chats = drop(chats, chatId, target);

      expect(pinnedOrder(chats)).toEqual(previewed);
      for (const { pinnedKey } of chats) {
        expect(patchRequestBodySchema.safeParse({ pinnedKey }).success).toBe(
          true
        );
      }
    }
  });
});

describe("currentTargetOf", () => {
  test("names a pinned chat's slot and an unpinned chat's zone", () => {
    expect(currentTargetOf(RAIL, "resume")).toEqual(at(1));
    expect(currentTargetOf(RAIL, "gifts")).toEqual(UNPINNED);
  });
});

describe("dropTargetAt", () => {
  const slots = { top: 100, rowHeight: 36 };
  const pointAt = (centerY: number, origin: DropTarget = UNPINNED) =>
    dropTargetAt({ centerY, origin, otherPinned: 2, slots, travelY: 100 });

  test("keeps the row where it started until it travels half a row", () => {
    const origin = UNPINNED;

    const target = dropTargetAt({
      centerY: 110,
      origin,
      otherPinned: 0,
      slots,
      travelY: -17,
    });

    expect(target).toEqual(UNPINNED);
  });

  test("maps the row's center to the slot it covers", () => {
    expect(pointAt(100)).toEqual(at(0));
    expect(pointAt(135)).toEqual(at(0));
    expect(pointAt(136)).toEqual(at(1));
    expect(pointAt(207)).toEqual(at(2));
  });

  test("pins at the top when the row is above the group", () => {
    expect(pointAt(20)).toEqual(at(0));
  });

  test("unpins below the last slot", () => {
    expect(pointAt(208)).toEqual(UNPINNED);
  });
});

describe("stepDropTarget", () => {
  test("walks down through the pinned slots, out, and back up", () => {
    const path: DropTarget[] = [UNPINNED];
    const moves: ("up" | "down")[] = ["up", "up", "up", "up", "down", "down"];
    for (const direction of moves) {
      path.push(stepDropTarget(path.at(-1) ?? UNPINNED, direction, 2));
    }

    expect(path).toEqual([UNPINNED, at(2), at(1), at(0), at(0), at(1), at(2)]);
    expect(stepDropTarget(at(2), "down", 2)).toEqual(UNPINNED);
    expect(stepDropTarget(UNPINNED, "down", 2)).toEqual(UNPINNED);
  });
});

describe("isSameTarget", () => {
  test("compares zones and pinned slots", () => {
    expect(isSameTarget(at(1), at(1))).toBe(true);
    expect(isSameTarget(at(1), at(2))).toBe(false);
    expect(isSameTarget(UNPINNED, { zone: "unpinned" })).toBe(true);
    expect(isSameTarget(UNPINNED, at(0))).toBe(false);
  });
});
