import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    clientId: v.optional(v.string()),
    title: v.string(),
    userId: v.string(), // Better Auth user ID
    visibility: v.optional(v.union(v.literal("public"), v.literal("private"))),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const chatId = await ctx.db.insert("chats", {
      clientId: args.clientId,
      title: args.title,
      userId: args.userId,
      visibility: args.visibility ?? "private",
      createdAt: now,
      updatedAt: now,
    });
    return chatId;
  },
});

export const getById = query({
  args: { id: v.id("chats") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByClientId = query({
  args: { clientId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chats")
      .withIndex("by_clientId", (q) => q.eq("clientId", args.clientId))
      .unique();
  },
});

export const updateTitleByClientId = mutation({
  args: {
    clientId: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db
      .query("chats")
      .withIndex("by_clientId", (q) => q.eq("clientId", args.clientId))
      .unique();

    if (chat) {
      await ctx.db.patch(chat._id, {
        title: args.title,
        updatedAt: Date.now(),
      });
    }
  },
});

export const getByUserId = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chats")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const updateTitle = mutation({
  args: {
    id: v.id("chats"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      title: args.title,
      updatedAt: Date.now(),
    });
  },
});

export const updateUpdatedAt = mutation({
  args: { id: v.id("chats") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      updatedAt: Date.now(),
    });
  },
});

export const deleteChat = mutation({
  args: { id: v.id("chats") },
  handler: async (ctx, args) => {
    // Get all messages for this chat (to extract attachment info)
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.id))
      .collect();

    // Delete all messages
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete all streams
    const streams = await ctx.db
      .query("streams")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.id))
      .collect();

    for (const stream of streams) {
      await ctx.db.delete(stream._id);
    }

    // Delete the chat
    await ctx.db.delete(args.id);

    return { messages };
  },
});

export const deleteChatByClientId = mutation({
  args: { clientId: v.string() },
  handler: async (ctx, args) => {
    // Find the chat by clientId
    const chat = await ctx.db
      .query("chats")
      .withIndex("by_clientId", (q) => q.eq("clientId", args.clientId))
      .unique();

    if (!chat) {
      return { messages: [] };
    }

    // Get all messages for this chat (to extract attachment info)
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chatId", (q) => q.eq("chatId", chat._id))
      .collect();

    // Delete all messages
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete all streams
    const streams = await ctx.db
      .query("streams")
      .withIndex("by_chatId", (q) => q.eq("chatId", chat._id))
      .collect();

    for (const stream of streams) {
      await ctx.db.delete(stream._id);
    }

    // Delete the chat
    await ctx.db.delete(chat._id);

    return { messages };
  },
});
