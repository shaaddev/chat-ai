import "server-only";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { convex } from "./server";

// Convex document shapes (matching the schema)
interface ConvexChatDoc {
  _creationTime: number;
  _id: Id<"chats">;
  clientId?: string;
  createdAt: number;
  systemPrompt?: string;
  title: string;
  updatedAt: number;
  userId: string;
  visibility: "public" | "private";
}

interface ConvexMessageDoc {
  _creationTime: number;
  _id: Id<"messages">;
  attachments: unknown;
  chatId: Id<"chats">;
  createdAt: number;
  model?: string;
  parts: unknown;
  role: string;
}

// Types that match the old Drizzle schema types
export interface Chat {
  _id: string;
  createdAt: Date;
  id: string;
  systemPrompt?: string | null;
  title: string;
  updatedAt: Date;
  userId: string;
  visibility: "public" | "private";
}

export interface Message {
  _id: string;
  attachments: unknown;
  chatId: string;
  createdAt: Date;
  id: string;
  model: string | null;
  parts: unknown;
  role: string;
}

// Helper to convert Convex doc to the expected shape
function convertChat(doc: ConvexChatDoc | null): Chat | null {
  if (!doc) {
    return null;
  }
  return {
    _id: doc._id,
    id: doc.clientId || doc._id, // Use clientId if available, otherwise Convex ID
    title: doc.title,
    userId: doc.userId,
    visibility: doc.visibility,
    systemPrompt: doc.systemPrompt ?? null,
    createdAt: new Date(doc.createdAt),
    updatedAt: new Date(doc.updatedAt),
  };
}

function convertMessage(doc: ConvexMessageDoc): Message {
  return {
    _id: doc._id,
    id: doc._id,
    chatId: doc.chatId,
    role: doc.role,
    parts: doc.parts,
    attachments: doc.attachments,
    createdAt: new Date(doc.createdAt),
    model: doc.model ?? null,
  };
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
  // Create chat with the client-provided ID stored as clientId
  const chatId = await convex.mutation(api.chats.create, {
    clientId: id,
    title,
    userId, // Better Auth user ID (string)
    systemPrompt,
  });
  return chatId;
}

export async function deleteChatById({ id }: { id: string }) {
  // Try to delete by clientId first (for backwards compatibility)
  const result = await convex.mutation(api.chats.deleteChatByClientId, {
    clientId: id,
  });
  // Convert messages to expected format
  const messages = result.messages.map(convertMessage);
  return { messages, result };
}

export async function getChatsByUserId({ id }: { id: string }) {
  const chats = await convex.query(api.chats.getByUserId, {
    userId: id, // Better Auth user ID (string)
  });
  return chats.map(convertChat).filter(Boolean) as Chat[];
}

export async function getChatById({ id }: { id: string }) {
  // Try to get by clientId first (for backwards compatibility)
  const chat = await convex.query(api.chats.getByClientId, {
    clientId: id,
  });
  return convertChat(chat);
}

export async function saveMessages({
  messages,
}: {
  messages: Array<{
    id?: string;
    chatId: string;
    role: string;
    parts: unknown;
    attachments: unknown;
    createdAt?: Date;
    model?: string | null;
  }>;
}) {
  if (messages.length === 0) {
    return [];
  }

  const clientChatId = messages[0].chatId;
  const convexMessages = messages.map((m) => ({
    role: m.role,
    parts: m.parts,
    attachments: m.attachments,
    model: m.model ?? undefined,
  }));

  return await convex.mutation(api.messages.createManyByClientChatId, {
    clientChatId,
    messages: convexMessages,
  });
}

export async function getMessagesByChatId({ id }: { id: string }) {
  // Use clientId lookup
  const messages = await convex.query(api.messages.getByClientChatId, {
    clientChatId: id,
  });
  return messages.map(convertMessage);
}

export async function getMessageById({ id }: { id: string }) {
  const message = await convex.query(api.messages.getById, {
    id: id as Id<"messages">,
  });
  return message ? [convertMessage(message)] : [];
}

export async function createStreamId({
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  // In Convex, streamId is auto-generated, use clientChatId for lookup
  await convex.mutation(api.streams.createByClientChatId, {
    clientChatId: chatId,
  });
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  // Use clientId lookup
  const streamIds = await convex.query(api.streams.getByClientChatId, {
    clientChatId: chatId,
  });
  return streamIds.map((id: Id<"streams">) => id.toString());
}

export async function updateChatTitle({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  await convex.mutation(api.chats.updateTitleByClientId, {
    clientId: id,
    title,
  });
}

export async function updateChatSystemPrompt({
  id,
  systemPrompt,
}: {
  id: string;
  systemPrompt?: string;
}) {
  await convex.mutation(api.chats.updateSystemPromptByClientId, {
    clientId: id,
    systemPrompt,
  });
}
