/// <reference types="bun-types/test" />
import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import type { Session } from "@/app/auth";
import { chat, message } from "@/lib/db/schema";
import { hasTestDatabase, openTestDatabase } from "@/lib/db/test-database";
import type { ChatMessage } from "@/lib/types";

let session: Session | null = null;
const titleRequests: ChatMessage[] = [];
const backgroundTasks: Promise<unknown>[] = [];

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
  generateChatTitle: async (firstMessage: ChatMessage) => {
    titleRequests.push(firstMessage);
    return "Generated title";
  },
}));

const { POST } = await import("./route");
const { getChatsByUserId } = await import("@/lib/db/queries");

const signInAs = (userId: string | null) => {
  session = userId
    ? { user: { id: userId, email: `${userId}@example.test`, name: "Test" } }
    : null;
};

const firstTurn = (chatId: string, messageId = crypto.randomUUID()) => ({
  id: chatId,
  selectedChatModel: "chat-5-mini",
  message: {
    id: messageId,
    role: "user",
    parts: [{ type: "text", text: "Plan a weekend in Lisbon" }],
  },
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
});
