import { differenceInCalendarDays } from "date-fns";

export type ChatGroupLabel =
  | "Today"
  | "Yesterday"
  | "Previous 7 days"
  | "Previous 30 days"
  | "Older";

export interface ChatGroup<T> {
  chats: T[];
  label: ChatGroupLabel;
}

interface Datable {
  id: string;
  updatedAt: Date;
}

const GROUPS: readonly { label: ChatGroupLabel; maxDaysAgo: number }[] = [
  { label: "Today", maxDaysAgo: 0 },
  { label: "Yesterday", maxDaysAgo: 1 },
  { label: "Previous 7 days", maxDaysAgo: 7 },
  { label: "Previous 30 days", maxDaysAgo: 30 },
  { label: "Older", maxDaysAgo: Number.POSITIVE_INFINITY },
];

const byRecency = (a: Datable, b: Datable) =>
  b.updatedAt.getTime() - a.updatedAt.getTime() || a.id.localeCompare(b.id);

/**
 * Buckets chats by calendar days between `now` and `updatedAt` in local time.
 * Groups come out in display order, empty groups are omitted, and each group
 * lists its chats most recent first.
 */
export function groupChatsByDate<T extends Datable>(
  chats: readonly T[],
  now: Date
): ChatGroup<T>[] {
  const groups: ChatGroup<T>[] = GROUPS.map(({ label }) => ({
    label,
    chats: [],
  }));
  for (const chat of [...chats].sort(byRecency)) {
    const daysAgo = differenceInCalendarDays(now, chat.updatedAt);
    const index = GROUPS.findIndex(({ maxDaysAgo }) => daysAgo <= maxDaysAgo);
    groups[index].chats.push(chat);
  }
  return groups.filter((group) => group.chats.length > 0);
}
