import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    chatId: v.id("chats"),
  },
  handler: async (ctx, args) => {
    const streamId = await ctx.db.insert("streams", {
      chatId: args.chatId,
      createdAt: Date.now(),
    });
    return streamId;
  },
});

export const createByClientChatId = mutation({
  args: {
    clientChatId: v.string(),
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

    const streamId = await ctx.db.insert("streams", {
      chatId: chat._id,
      createdAt: Date.now(),
    });
    return streamId;
  },
});

export const getByChatId = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const streams = await ctx.db
      .query("streams")
      .withIndex("by_chatId_createdAt", (q) => q.eq("chatId", args.chatId))
      .order("asc")
      .collect();
    return streams.map((s) => s._id);
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

    const streams = await ctx.db
      .query("streams")
      .withIndex("by_chatId_createdAt", (q) => q.eq("chatId", chat._id))
      .order("asc")
      .collect();
    return streams.map((s) => s._id);
  },
});
