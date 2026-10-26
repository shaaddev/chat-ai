import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { type Database, getDb } from ".";
import {
  type Chat,
  chat,
  type Message,
  message,
  stream,
  upload,
} from "./schema";

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

export async function updateChat({
  id,
  userId,
  changes,
  onlyIfTitle,
}: {
  id: string;
  userId: string;
  changes: Partial<Pick<Chat, "title" | "systemPrompt" | "pinnedKey">>;
  onlyIfTitle?: string;
}): Promise<boolean> {
  // `updatedAt` orders the sidebar by activity. Renaming is not activity.
  const updated = await getDb()
    .update(chat)
    .set({ ...stripNul(changes), updatedAt: sql`${chat.updatedAt}` })
    .where(
      and(
        eq(chat.id, id),
        eq(chat.userId, userId),
        onlyIfTitle === undefined
          ? undefined
          : eq(chat.title, stripNul(onlyIfTitle))
      )
    )
    .returning({ id: chat.id });
  return updated.length > 0;
}

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function lockOwnedChat(tx: Transaction, chatId: string, userId: string) {
  const [owned] = await tx
    .select({ id: chat.id })
    .from(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)))
    .for("update");
  return owned !== undefined;
}

export async function deleteChat({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<{ uploadKeys: string[] } | null> {
  return await getDb().transaction(async (tx) => {
    if (!(await lockOwnedChat(tx, id, userId))) {
      return null;
    }
    const fileUrls = sql`(
      select part->>'url' from ${message}
      cross join lateral jsonb_array_elements(${message.parts}) as part
      where ${message.chatId} = ${id} and part->>'type' = 'file'
    )`;
    const uploads = await tx
      .delete(upload)
      .where(and(eq(upload.userId, userId), inArray(upload.url, fileUrls)))
      .returning({ key: upload.key });
    await tx.delete(chat).where(eq(chat.id, id));
    return { uploadKeys: uploads.map(({ key }) => key) };
  });
}

export async function saveUpload(row: typeof upload.$inferInsert) {
  await getDb()
    .insert(upload)
    .values(row)
    .onConflictDoNothing({ target: upload.key });
}

export async function ownsUploads({
  userId,
  urls,
}: {
  userId: string;
  urls: string[];
}): Promise<boolean> {
  const wanted = [...new Set(urls)];
  if (wanted.length === 0) {
    return true;
  }
  const owned = await getDb()
    .selectDistinct({ url: upload.url })
    .from(upload)
    .where(and(eq(upload.userId, userId), inArray(upload.url, wanted)));
  return owned.length === wanted.length;
}

export async function deleteUploads({
  userId,
  urls,
}: {
  userId: string;
  urls: string[];
}): Promise<string[]> {
  const deleted = await getDb()
    .delete(upload)
    .where(and(eq(upload.userId, userId), inArray(upload.url, urls)))
    .returning({ key: upload.key });
  return deleted.map(({ key }) => key);
}

export async function getMessagesByChatId(chatId: string): Promise<Message[]> {
  return await getDb()
    .select()
    .from(message)
    .where(eq(message.chatId, chatId))
    .orderBy(asc(message.createdAt), asc(message.id));
}

export async function getUserMessage({
  chatId,
  messageId,
}: {
  chatId: string;
  messageId: string;
}): Promise<Message | undefined> {
  const [row] = await getDb()
    .select()
    .from(message)
    .where(
      and(
        eq(message.chatId, chatId),
        eq(message.id, messageId),
        eq(message.role, "user")
      )
    );
  return row;
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

type NewMessage = Pick<Message, "id" | "parts">;

export type UserTurn =
  | { type: "append"; message: NewMessage }
  | { type: "edit"; userMessageId: string; message: NewMessage }
  | { type: "regenerate"; userMessageId: string };

export interface NewChat {
  systemPrompt?: string;
  title: string;
}

async function latestStreamId(db: Database | Transaction, chatId: string) {
  const [row] = await db
    .select({ id: stream.id })
    .from(stream)
    .where(eq(stream.chatId, chatId))
    .orderBy(desc(stream.createdAt))
    .limit(1);
  return row?.id;
}

export async function saveUserTurn({
  chatId,
  userId,
  streamId,
  turn,
  newChat,
}: {
  chatId: string;
  userId: string;
  streamId: string;
  turn: UserTurn;
  newChat?: NewChat;
}): Promise<Message[] | null> {
  try {
    return await saveUserTurnOrThrow({
      chatId,
      userId,
      streamId,
      turn,
      newChat,
    });
  } catch (error) {
    if (error instanceof MessageIdTakenError) {
      return null;
    }
    throw error;
  }
}

// Thrown inside the transaction so a new chat and the deletes roll back too.
class MessageIdTakenError extends Error {}

// The database clock, so app servers with skewed clocks agree on turn order.
// Not now(): it is fixed at transaction start, before the chat row lock.
const databaseNow = sql`clock_timestamp()`;

const messagePosition = sql`(${message.createdAt}, ${message.id})`;
const positionOf = (messageId: string) =>
  sql`(select ${message.createdAt}, ${message.id} from ${message} where ${message.id} = ${messageId})`;

async function saveUserTurnOrThrow({
  chatId,
  userId,
  streamId,
  turn,
  newChat,
}: {
  chatId: string;
  userId: string;
  streamId: string;
  turn: UserTurn;
  newChat?: NewChat;
}): Promise<Message[] | null> {
  return await getDb().transaction(async (tx) => {
    if (newChat) {
      await tx.insert(chat).values({
        id: chatId,
        userId,
        title: stripNul(newChat.title),
        systemPrompt: stripNul(newChat.systemPrompt ?? null),
      });
    }
    if (!(await lockOwnedChat(tx, chatId, userId))) {
      return null;
    }
    if (turn.type !== "append") {
      const [kept] = await tx
        .select({ id: message.id })
        .from(message)
        .where(
          and(
            eq(message.chatId, chatId),
            eq(message.id, turn.userMessageId),
            eq(message.role, "user")
          )
        );
      if (!kept) {
        return null;
      }
      // A regenerate keeps the current reply until its replacement saves,
      // so a stopped or empty regenerate loses nothing.
      if (turn.type === "edit") {
        await tx
          .delete(message)
          .where(
            and(
              eq(message.chatId, chatId),
              sql`${messagePosition} >= ${positionOf(kept.id)}`
            )
          );
      }
    }
    if (turn.type !== "regenerate") {
      const inserted = await tx
        .insert(message)
        .values({
          id: turn.message.id,
          chatId,
          role: "user",
          parts: stripNul(turn.message.parts),
          createdAt: databaseNow,
        })
        .onConflictDoNothing({ target: message.id })
        .returning({ id: message.id });
      if (inserted.length === 0) {
        throw new MessageIdTakenError();
      }
    }
    await tx
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: databaseNow });
    await tx
      .update(chat)
      .set({ updatedAt: databaseNow })
      .where(eq(chat.id, chatId));
    const history = await tx
      .select()
      .from(message)
      .where(
        and(
          eq(message.chatId, chatId),
          turn.type === "regenerate"
            ? sql`${messagePosition} <= ${positionOf(turn.userMessageId)}`
            : undefined
        )
      )
      .orderBy(asc(message.createdAt), asc(message.id));
    return history;
  });
}

export async function saveReplyIfLatestTurn({
  chatId,
  streamId,
  reply,
  replacesRepliesAfter,
}: {
  chatId: string;
  streamId: string;
  reply: NewMessage & Pick<Message, "model">;
  replacesRepliesAfter?: string;
}) {
  await getDb().transaction(async (tx) => {
    await tx
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.id, chatId))
      .for("update");
    if ((await latestStreamId(tx, chatId)) !== streamId) {
      return;
    }
    if (replacesRepliesAfter) {
      await tx
        .delete(message)
        .where(
          and(
            eq(message.chatId, chatId),
            sql`${messagePosition} > ${positionOf(replacesRepliesAfter)}`
          )
        );
    }
    await tx
      .insert(message)
      .values({
        ...reply,
        parts: stripNul(reply.parts),
        chatId,
        role: "assistant",
        createdAt: databaseNow,
      })
      .onConflictDoNothing({ target: message.id });
    await tx
      .update(chat)
      .set({ updatedAt: databaseNow })
      .where(eq(chat.id, chatId));
  });
}

export async function getLatestStreamId(
  chatId: string
): Promise<string | undefined> {
  return await latestStreamId(getDb(), chatId);
}
