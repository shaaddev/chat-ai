/// <reference types="bun-types/test" />
import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import type { Session } from "@/app/auth";
import { chat } from "@/lib/db/schema";
import { hasTestDatabase, openTestDatabase } from "@/lib/db/test-database";

let session: Session | null = null;

mock.module("server-only", () => ({}));
mock.module("@/app/auth", () => ({ auth: async () => session }));

const { POST } = await import("./route");

const signInAs = (userId: string | null) => {
  session = userId
    ? { user: { id: userId, email: `${userId}@example.test`, name: "Test" } }
    : null;
};

const firstTurn = (chatId: string) => ({
  id: chatId,
  selectedChatModel: "chat-5-mini",
  message: {
    id: crypto.randomUUID(),
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
});
