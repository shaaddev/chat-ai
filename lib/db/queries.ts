import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from ".";
import { type Chat, chat, type Message, message, stream } from "./schema";

export async function getChatsByUserId(userId: string): Promise<Chat[]> {
  return await getDb()
    .select()
    .from(chat)
    .where(eq(chat.userId, userId))
    .orderBy(desc(chat.updatedAt));
}

export async function getChatById(id: string): Promise<Chat | undefined> {
  const [row] = await getDb().select().from(chat).where(eq(chat.id, id));
  return row;
}

export function canReadChat(row: Chat, userId: string | undefined): boolean {
  return row.visibility === "public" || row.userId === userId;
}

export async function saveChat({
  id,
  userId,
  title,
  systemPrompt,
}: {
  id: string;
  userId: string;
  title: string;
  systemPrompt?: string;
}) {
  await getDb()
    .insert(chat)
    .values({ id, userId, title, systemPrompt: systemPrompt ?? null });
}

export async function updateChat({
  id,
  userId,
  changes,
}: {
  id: string;
  userId: string;
  changes: { title?: string; systemPrompt?: string | null };
}): Promise<boolean> {
  const updated = await getDb()
    .update(chat)
    .set(changes)
    .where(and(eq(chat.id, id), eq(chat.userId, userId)))
    .returning({ id: chat.id });
  return updated.length > 0;
}

export async function deleteChat({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<Pick<Message, "parts">[] | null> {
  return await getDb().transaction(async (tx) => {
    const parts = await tx
      .select({ parts: message.parts })
      .from(message)
      .innerJoin(chat, eq(chat.id, message.chatId))
      .where(and(eq(message.chatId, id), eq(chat.userId, userId)));
    const deleted = await tx
      .delete(chat)
      .where(and(eq(chat.id, id), eq(chat.userId, userId)))
      .returning({ id: chat.id });
    return deleted.length > 0 ? parts : null;
  });
}

export async function getMessagesByChatId(chatId: string): Promise<Message[]> {
  return await getDb()
    .select()
    .from(message)
    .where(eq(message.chatId, chatId))
    .orderBy(asc(message.createdAt), asc(message.id));
}

// Postgres jsonb rejects U+0000, which Convex accepted and models can emit.
function stripNul<T>(value: T): T {
  if (typeof value === "string") {
    return value.replaceAll("\u0000", "") as T;
  }
  if (Array.isArray(value)) {
    return value.map(stripNul) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, stripNul(item)])
    ) as T;
  }
  return value;
}

export async function saveMessages(
  chatId: string,
  messages: Omit<typeof message.$inferInsert, "chatId" | "createdAt">[]
) {
  if (messages.length === 0) {
    return;
  }
  const now = Date.now();
  await getDb().transaction(async (tx) => {
    await tx
      .insert(message)
      .values(
        messages.map((m, index) => ({
          ...m,
          parts: stripNul(m.parts),
          chatId,
          createdAt: new Date(now + index),
        }))
      )
      .onConflictDoNothing({ target: message.id });
    await tx
      .update(chat)
      .set({ updatedAt: new Date() })
      .where(eq(chat.id, chatId));
  });
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  await getDb().insert(stream).values({ id: streamId, chatId });
}

export async function getLatestStreamId(
  chatId: string
): Promise<string | undefined> {
  const [row] = await getDb()
    .select({ id: stream.id })
    .from(stream)
    .where(eq(stream.chatId, chatId))
    .orderBy(desc(stream.createdAt))
    .limit(1);
  return row?.id;
}
