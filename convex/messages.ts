import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export const create = mutation({
  args: {
    chatId: v.id("chats"),
    role: v.string(),
    parts: v.any(),
    attachments: v.any(),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("messages", {
      chatId: args.chatId,
      role: args.role,
      parts: args.parts,
      attachments: args.attachments,
      createdAt: Date.now(),
      model: args.model,
    });

    // Update the chat's updatedAt timestamp
    await ctx.db.patch(args.chatId, {
      updatedAt: Date.now(),
    });

    return messageId;
  },
});

export const createMany = mutation({
  args: {
    messages: v.array(
      v.object({
        chatId: v.id("chats"),
        role: v.string(),
        parts: v.any(),
        attachments: v.any(),
        model: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const ids = [];
    let chatIdToUpdate: Id<"chats"> | null = null;

    for (const msg of args.messages) {
      const messageId = await ctx.db.insert("messages", {
        chatId: msg.chatId,
        role: msg.role,
        parts: msg.parts,
        attachments: msg.attachments,
        createdAt: Date.now(),
        model: msg.model,
      });
      ids.push(messageId);
      chatIdToUpdate = msg.chatId;
    }

    // Update the chat's updatedAt timestamp
    if (chatIdToUpdate) {
      await ctx.db.patch(chatIdToUpdate, {
        updatedAt: Date.now(),
      });
    }

    return ids;
  },
});

export const getByChatId = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_chatId_createdAt", (q) => q.eq("chatId", args.chatId))
      .order("asc")
      .collect();
  },
});

export const getByClientChatId = query({
  args: { clientChatId: v.string() },
  handler: async (ctx, args) => {
    // First find the chat by clientId
    const chat = await ctx.db
      .query("chats")
      .withIndex("by_clientId", (q) => q.eq("clientId", args.clientChatId))
      .unique();

    if (!chat) {
      return [];
    }

    return await ctx.db
      .query("messages")
      .withIndex("by_chatId_createdAt", (q) => q.eq("chatId", chat._id))
      .order("asc")
      .collect();
  },
});

export const createManyByClientChatId = mutation({
  args: {
    clientChatId: v.string(),
    messages: v.array(
      v.object({
        role: v.string(),
        parts: v.any(),
        attachments: v.any(),
        model: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    // First find the chat by clientId
    const chat = await ctx.db
      .query("chats")
      .withIndex("by_clientId", (q) => q.eq("clientId", args.clientChatId))
      .unique();

    if (!chat) {
      throw new Error(`Chat not found with clientId: ${args.clientChatId}`);
    }

    const ids = [];
    for (const msg of args.messages) {
      const messageId = await ctx.db.insert("messages", {
        chatId: chat._id,
        role: msg.role,
        parts: msg.parts,
        attachments: msg.attachments,
        createdAt: Date.now(),
        model: msg.model,
      });
      ids.push(messageId);
    }

    // Update the chat's updatedAt timestamp
    await ctx.db.patch(chat._id, {
      updatedAt: Date.now(),
    });

    return ids;
  },
});

export const getById = query({
  args: { id: v.id("messages") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
