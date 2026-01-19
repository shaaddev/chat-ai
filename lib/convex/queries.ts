import "server-only";

import { convex, api } from "./server";
import type { Id } from "@/convex/_generated/dataModel";

// Types that match the old Drizzle schema types
export type Chat = {
  _id: string;
  id: string;
  title: string;
  userId: string;
  visibility: "public" | "private";
  createdAt: Date;
  updatedAt: Date;
};

export type Message = {
  _id: string;
  id: string;
  chatId: string;
  role: string;
  parts: any;
  attachments: any;
  createdAt: Date;
  model: string | null;
};

// Helper to convert Convex doc to the expected shape
function convertChat(doc: any): Chat | null {
  if (!doc) return null;
  return {
    _id: doc._id,
    id: doc.clientId || doc._id, // Use clientId if available, otherwise Convex ID
    title: doc.title,
    userId: doc.userId,
    visibility: doc.visibility,
    createdAt: new Date(doc.createdAt),
    updatedAt: new Date(doc.updatedAt),
  };
}

function convertMessage(doc: any): Message {
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
}: {
  id: string;
  userId: string;
  title: string;
}) {
  // Create chat with the client-provided ID stored as clientId
  const chatId = await convex.mutation(api.chats.create, {
    clientId: id,
    title,
    userId: userId as Id<"users">,
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
    userId: id as Id<"users">,
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
    parts: any;
    attachments: any;
    createdAt?: Date;
    model?: string | null;
  }>;
}) {
  if (messages.length === 0) return [];
  
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

export async function isEmail(email: string): Promise<boolean> {
  return await convex.query(api.users.emailExists, { email });
}

export async function createStreamId({
  streamId,
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
  return streamIds.map((id: any) => id.toString());
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
