import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ===== Chat tables =====
  // Note: Auth tables (users, sessions, accounts, verifications) are managed by Better Auth component

  chats: defineTable({
    clientId: v.optional(v.string()), // UUID from client for backwards compatibility
    title: v.string(),
    userId: v.string(), // References Better Auth user ID
    visibility: v.union(v.literal("public"), v.literal("private")),
    systemPrompt: v.optional(v.string()), // Custom system prompt per chat (nullable)
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_updatedAt", ["userId", "updatedAt"])
    .index("by_clientId", ["clientId"]),

  messages: defineTable({
    chatId: v.id("chats"),
    role: v.string(),
    parts: v.any(),
    attachments: v.any(),
    createdAt: v.number(),
    model: v.optional(v.string()),
  })
    .index("by_chatId", ["chatId"])
    .index("by_chatId_createdAt", ["chatId", "createdAt"]),

  streams: defineTable({
    chatId: v.id("chats"),
    createdAt: v.number(),
  })
    .index("by_chatId", ["chatId"])
    .index("by_chatId_createdAt", ["chatId", "createdAt"]),
});
