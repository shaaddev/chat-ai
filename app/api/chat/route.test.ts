/// <reference types="bun-types/test" />
import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { eq } from "drizzle-orm";
import type { Session } from "@/app/auth";
import { chat, message, stream } from "@/lib/db/schema";
import { hasTestDatabase, openTestDatabase } from "@/lib/db/test-database";
import type { ChatMessage } from "@/lib/types";

let session: Session | null = null;
const titleRequests: ChatMessage[] = [];
let pendingTitle = Promise.withResolvers<string>();
const backgroundTasks: Promise<unknown>[] = [];

const replyModel = new MockLanguageModelV4({
  doStream: async () => ({
    stream: simulateReadableStream({
      chunks: [
        { type: "text-start", id: "reply" },
        { type: "text-delta", id: "reply", delta: "Here is a plan." },
        { type: "text-end", id: "reply" },
        {
          type: "finish",
          finishReason: { unified: "stop", raw: undefined },
          usage: {
            inputTokens: {
              total: 1,
              noCache: 1,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: { total: 1, text: 1, reasoning: undefined },
          },
        },
      ],
    }),
  }),
});

mock.module("server-only", () => ({}));
mock.module("@/app/auth", () => ({ auth: async () => session }));
const nextServer = await import("next/server");
mock.module("next/server", () => ({
  ...nextServer,
  after: (task: Promise<unknown>) => backgroundTasks.push(task),
}));
const providers = await import("@/lib/ai/providers");
mock.module("@/lib/ai/providers", () => ({
  ...providers,
  generateChatTitle: (firstMessage: ChatMessage) => {
    titleRequests.push(firstMessage);
    return pendingTitle.promise;
  },
  getLanguageModel: () => replyModel,
}));

const { POST } = await import("./route");
const { getChatById, getChatsByUserId, updateChat } = await import(
  "@/lib/db/queries"
);

const signInAs = (userId: string | null) => {
  session = userId
    ? { user: { id: userId, email: `${userId}@example.test`, name: "Test" } }
    : null;
};

const firstTurn = (
  chatId: string,
  messageId = crypto.randomUUID(),
  text = "Plan a weekend in Lisbon"
) => ({
  id: chatId,
  selectedChatModel: "chat-5-mini",
  message: { id: messageId, role: "user", parts: [{ type: "text", text }] },
});

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify(body),
    })
  );

test("a request without a session gets the sign-in error the client parses", async () => {
  signInAs(null);
  const response = await post(firstTurn(crypto.randomUUID()));
  expect(response.status).toBe(401);
  expect((await response.json()).code).toBe("unauthorized:chat");
});

describe.skipIf(!hasTestDatabase)("POST /api/chat against Postgres", () => {
  let testDatabase: Awaited<ReturnType<typeof openTestDatabase>>;

  beforeAll(async () => {
    testDatabase = await openTestDatabase();
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  test("a turn in another user's chat gets the forbidden error the client parses", async () => {
    const ownerId = await testDatabase.createUser();
    const chatId = crypto.randomUUID();
    await testDatabase.db.insert(chat).values({
      id: chatId,
      userId: ownerId,
      title: "Public",
      visibility: "public",
    });
    signInAs(await testDatabase.createUser());

    const response = await post(firstTurn(chatId));

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("forbidden:chat");
  });

  test("a first turn rejected for a taken message id leaves no chat behind", async () => {
    const userId = await testDatabase.createUser();
    const earlierChatId = crypto.randomUUID();
    const takenMessageId = crypto.randomUUID();
    await testDatabase.db
      .insert(chat)
      .values({ id: earlierChatId, userId, title: "Earlier chat" });
    await testDatabase.db.insert(message).values({
      id: takenMessageId,
      chatId: earlierChatId,
      role: "user",
      parts: [{ type: "text", text: "Hello" }],
    });
    signInAs(userId);
    titleRequests.length = 0;

    const response = await post(firstTurn(crypto.randomUUID(), takenMessageId));

    expect(response.status).toBe(400);
    expect((await getChatsByUserId(userId)).map(({ id }) => id)).toEqual([
      earlierChatId,
    ]);
    expect(titleRequests).toEqual([]);
  });

  test("a first message with a NUL character still starts its chat", async () => {
    const userId = await testDatabase.createUser();
    const chatId = crypto.randomUUID();
    signInAs(userId);

    pendingTitle = Promise.withResolvers();

    const response = await post(
      firstTurn(chatId, crypto.randomUUID(), "Plan a weekend\u0000 in Lisbon")
    );
    pendingTitle.resolve("Weekend in Lisbon");
    await Promise.all(backgroundTasks);
    await response.text();

    expect(response.status).toBe(200);
    expect((await getChatById(chatId))?.title).toBe("Weekend in Lisbon");
  });

  test("a first message of only NUL characters starts as a new chat", async () => {
    const userId = await testDatabase.createUser();
    const chatId = crypto.randomUUID();
    signInAs(userId);
    pendingTitle = Promise.withResolvers();

    const response = await post(
      firstTurn(chatId, crypto.randomUUID(), "\u0000")
    );
    const provisionalTitle = (await getChatById(chatId))?.title;
    pendingTitle.resolve("Empty message");
    await Promise.all(backgroundTasks);
    await response.text();

    expect(provisionalTitle).toBe("New chat");
  });

  test("the generated title replaces the provisional one", async () => {
    const userId = await testDatabase.createUser();
    const chatId = crypto.randomUUID();
    signInAs(userId);
    pendingTitle = Promise.withResolvers();

    const response = await post(firstTurn(chatId));
    expect((await getChatById(chatId))?.title).toBe("Plan a weekend in Lisbon");
    pendingTitle.resolve("Weekend in Lisbon");
    await Promise.all(backgroundTasks);
    await response.text();

    expect((await getChatById(chatId))?.title).toBe("Weekend in Lisbon");
  });

  test("a rename made while the title generates survives it", async () => {
    const userId = await testDatabase.createUser();
    const chatId = crypto.randomUUID();
    signInAs(userId);
    pendingTitle = Promise.withResolvers();

    const response = await post(firstTurn(chatId));
    await updateChat({ id: chatId, userId, changes: { title: "Lisbon trip" } });
    pendingTitle.resolve("Weekend in Lisbon");
    await Promise.all(backgroundTasks);
    await response.text();

    expect((await getChatById(chatId))?.title).toBe("Lisbon trip");
  });

  const STALE_TURN_CAUSE =
    "That message is no longer in this chat. Reload the chat and try again.";

  const seedRepliedChat = async (
    userParts: ChatMessage["parts"],
    replyParts: ChatMessage["parts"] = [{ type: "text", text: "Seeded reply" }]
  ) => {
    const userId = await testDatabase.createUser();
    const chatId = crypto.randomUUID();
    const userMessageId = crypto.randomUUID();
    const replyId = crypto.randomUUID();
    const updatedAt = new Date("2026-10-20T10:00:00Z");
    await testDatabase.db
      .insert(chat)
      .values({ id: chatId, userId, title: "Seeded", updatedAt });
    await testDatabase.db.insert(message).values([
      {
        id: userMessageId,
        chatId,
        role: "user",
        parts: userParts,
        createdAt: new Date("2026-10-20T09:00:00Z"),
      },
      {
        id: replyId,
        chatId,
        role: "assistant",
        parts: replyParts,
        createdAt: new Date("2026-10-20T09:01:00Z"),
      },
    ]);
    signInAs(userId);
    return { chatId, replyId, updatedAt, userMessageId };
  };

  const regenerate = (chatId: string, messageId: string, model: string) =>
    post({
      id: chatId,
      selectedChatModel: model,
      trigger: "regenerate-message",
      message: { id: messageId },
    });

  const expectNothingSaved = async (chatId: string, updatedAt: Date) => {
    const streams = await testDatabase.db
      .select()
      .from(stream)
      .where(eq(stream.chatId, chatId));
    expect(streams).toEqual([]);
    expect((await getChatById(chatId))?.updatedAt).toEqual(updatedAt);
  };

  test("an image-model regenerate of a message with no text is refused before anything is saved", async () => {
    const { chatId, updatedAt, userMessageId } = await seedRepliedChat([
      {
        type: "file",
        mediaType: "image/png",
        filename: "photo.png",
        url: "https://abc123.ufs.sh/f/photo",
      },
    ]);

    const response = await regenerate(
      chatId,
      userMessageId,
      "chat-image-1-mini"
    );

    expect(response.status).toBe(400);
    expect((await response.json()).cause).toBe(
      "Image models need a text prompt. Describe the image you want."
    );
    await expectNothingSaved(chatId, updatedAt);
  });

  test("an image-model regenerate aimed at a reply says the message is gone", async () => {
    const { chatId, replyId, updatedAt } = await seedRepliedChat(
      [{ type: "text", text: "Draw a lighthouse" }],
      [
        {
          type: "file",
          mediaType: "image/png",
          filename: "lighthouse.png",
          url: "https://abc123.ufs.sh/f/lighthouse",
        },
      ]
    );

    const response = await regenerate(chatId, replyId, "chat-image-1-mini");

    expect(response.status).toBe(400);
    expect((await response.json()).cause).toBe(STALE_TURN_CAUSE);
    await expectNothingSaved(chatId, updatedAt);
  });

  test("an image-model regenerate in a chat that does not exist is not found", async () => {
    signInAs(await testDatabase.createUser());

    const response = await regenerate(
      crypto.randomUUID(),
      crypto.randomUUID(),
      "chat-image-1-mini"
    );

    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe("not_found:chat");
  });

  test("a regenerate of a message that is not in the chat says to reload", async () => {
    const { chatId, updatedAt } = await seedRepliedChat([
      { type: "text", text: "Plan a weekend in Lisbon" },
    ]);

    const response = await regenerate(
      chatId,
      crypto.randomUUID(),
      "chat-5-mini"
    );

    expect(response.status).toBe(400);
    expect((await response.json()).cause).toBe(STALE_TURN_CAUSE);
    await expectNothingSaved(chatId, updatedAt);
  });
});
