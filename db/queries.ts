import "server-only";

import { chat, message, type Message, user } from "./schema";
import { db } from ".";
import { eq, asc, desc } from "drizzle-orm";

export async function saveChat({
  id,
  userId,
  title,
}: {
  id: string;
  userId: string;
  title: string;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId,
      title,
    });
  } catch (error) {
    console.error("Failed to save chat in database");
    throw error;
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(message).where(eq(message.chatId, id));

    return await db.delete(chat).where(eq(chat.id, id));
  } catch (error) {
    console.error("Failed to delete chat by id from database");
    throw error;
  }
}

export async function getChatsByUserId({ id }: { id: string }) {
  try {
    const chats = await db
      .select()
      .from(chat)
      .where(eq(chat.userId, id))
      .orderBy(desc(chat.updatedAt));
    return chats;
  } catch (error) {
    console.error("Failed to fetch chats:", error);
    return [];
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [result] = await db.select().from(chat).where(eq(chat.id, id));
    return result;
  } catch (error) {
    console.error("Failed to get chat by id from database");
    throw error;
  }
}

export async function saveMessages({ messages }: { messages: Array<Message> }) {
  try {
    // Update the chat's updatedAt timestamp when messages are saved
    if (messages.length > 0) {
      const chatId = messages[0].chatId;
      await db
        .update(chat)
        .set({ updatedAt: new Date() })
        .where(eq(chat.id, chatId));
    }

    return await db.insert(message).values(messages);
  } catch (error) {
    console.error("Failed to save messsages in database", error);
    throw error;
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (error) {
    console.error("Failed to get messages by chat id from database", error);
    throw error;
  }
}

// everything pass here - idk
export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    console.error("Failed to get message by id from database");
    throw error;
  }
}

export async function isEmail(email: string): Promise<boolean> {
  try {
    const check = await db.select().from(user).where(eq(user.email, email));
    return check.length > 0;
  } catch (error) {
    console.error("Failed to get email from database");
    throw error;
  }
}
