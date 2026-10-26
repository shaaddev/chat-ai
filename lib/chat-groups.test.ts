/// <reference types="bun-types/test" />
import { describe, expect, test } from "bun:test";
import { groupChatsByDate } from "./chat-groups";

const NOW = new Date(2026, 5, 17, 12, 0, 0, 0);

const chat = (id: string, updatedAt: Date) => ({ id, title: id, updatedAt });

const summarize = (chats: ReturnType<typeof chat>[], now = NOW) =>
  groupChatsByDate(chats, now).map((group) => ({
    label: group.label,
    ids: group.chats.map(({ id }) => id),
  }));

describe("groupChatsByDate", () => {
  test("returns no groups for no chats", () => {
    expect(groupChatsByDate([], NOW)).toEqual([]);
  });

  test("splits today from yesterday at local midnight", () => {
    const chats = [
      chat("last-ms-of-yesterday", new Date(2026, 5, 16, 23, 59, 59, 999)),
      chat("midnight", new Date(2026, 5, 17, 0, 0, 0, 0)),
    ];

    expect(summarize(chats)).toEqual([
      { label: "Today", ids: ["midnight"] },
      { label: "Yesterday", ids: ["last-ms-of-yesterday"] },
    ]);
  });

  test("moves a chat into yesterday the moment the day rolls over", () => {
    const chats = [chat("late", new Date(2026, 5, 16, 23, 59, 0, 0))];

    expect(summarize(chats, new Date(2026, 5, 16, 23, 59, 59, 999))).toEqual([
      { label: "Today", ids: ["late"] },
    ]);
    expect(summarize(chats, new Date(2026, 5, 17, 0, 0, 0, 0))).toEqual([
      { label: "Yesterday", ids: ["late"] },
    ]);
  });

  test("keeps a chat from exactly 7 days ago in previous 7 days", () => {
    const chats = [
      chat("exactly-7-days", new Date(2026, 5, 10, 12, 0, 0, 0)),
      chat("start-of-day-7", new Date(2026, 5, 10, 0, 0, 0, 0)),
      chat("end-of-day-8", new Date(2026, 5, 9, 23, 59, 59, 999)),
      chat("two-days", new Date(2026, 5, 15, 8, 0, 0, 0)),
    ];

    expect(summarize(chats)).toEqual([
      {
        label: "Previous 7 days",
        ids: ["two-days", "exactly-7-days", "start-of-day-7"],
      },
      { label: "Previous 30 days", ids: ["end-of-day-8"] },
    ]);
  });

  test("keeps 30 calendar days in previous 30 days and the rest in older", () => {
    const chats = [
      chat("day-30", new Date(2026, 4, 18, 0, 0, 0, 0)),
      chat("day-31", new Date(2026, 4, 17, 23, 59, 59, 999)),
      chat("last-year", new Date(2025, 5, 17, 12, 0, 0, 0)),
    ];

    expect(summarize(chats)).toEqual([
      { label: "Previous 30 days", ids: ["day-30"] },
      { label: "Older", ids: ["day-31", "last-year"] },
    ]);
  });

  test("orders groups for display and chats most recent first", () => {
    const chats = [
      chat("older", new Date(2026, 0, 1)),
      chat("today-early", new Date(2026, 5, 17, 9)),
      chat("week", new Date(2026, 5, 13)),
      chat("today-late", new Date(2026, 5, 17, 11)),
      chat("yesterday", new Date(2026, 5, 16, 20)),
      chat("month", new Date(2026, 4, 30)),
    ];

    expect(summarize(chats)).toEqual([
      { label: "Today", ids: ["today-late", "today-early"] },
      { label: "Yesterday", ids: ["yesterday"] },
      { label: "Previous 7 days", ids: ["week"] },
      { label: "Previous 30 days", ids: ["month"] },
      { label: "Older", ids: ["older"] },
    ]);
  });

  test("treats a timestamp ahead of the local clock as today", () => {
    const chats = [chat("skewed", new Date(2026, 5, 18, 0, 0, 1))];

    expect(summarize(chats)).toEqual([{ label: "Today", ids: ["skewed"] }]);
  });

  test("returns the same chat objects it was given", () => {
    const original = chat("same", new Date(2026, 5, 17, 10));

    expect(groupChatsByDate([original], NOW)[0].chats[0]).toBe(original);
  });
});
