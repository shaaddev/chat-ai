/// <reference types="bun-types/test" />
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  mock,
  setSystemTime,
  test,
} from "bun:test";
import { eq } from "drizzle-orm";
import { stream } from "./schema";
import { hasTestDatabase, openTestDatabase } from "./test-database";

mock.module("server-only", () => ({}));

const {
  getChatsByUserId,
  getLatestStreamId,
  getMessagesByChatId,
  isReplyPending,
  saveReplyIfLatestTurn,
  saveUserTurn,
  settleTurn,
} = await import("./queries");

const HOUR_MS = 60 * 60 * 1000;

const appClockBehindByAnHour = () =>
  setSystemTime(new Date(Date.now() - HOUR_MS));

async function sendTurn({
  chatId,
  userId,
  question,
  answer,
  newChat,
}: {
  chatId: string;
  userId: string;
  question: string;
  answer: string;
  newChat?: { title: string };
}) {
  const streamId = crypto.randomUUID();
  await saveUserTurn({
    chatId,
    userId,
    streamId,
    turn: {
      type: "append",
      message: {
        id: crypto.randomUUID(),
        parts: [{ type: "text", text: question }],
      },
    },
    newChat,
  });
  await saveReplyIfLatestTurn({
    chatId,
    streamId,
    reply: {
      id: crypto.randomUUID(),
      parts: [{ type: "text", text: answer }],
      model: "test-model",
    },
  });
}

const thread = async (chatId: string) =>
  (await getMessagesByChatId(chatId)).map(({ parts }) =>
    parts.map((part) => (part.type === "text" ? part.text : "")).join("")
  );

describe.skipIf(!hasTestDatabase)(
  "turns from instances with skewed clocks",
  () => {
    let testDatabase: Awaited<ReturnType<typeof openTestDatabase>>;

    beforeAll(async () => {
      testDatabase = await openTestDatabase();
    });

    afterEach(() => {
      setSystemTime();
    });

    afterAll(async () => {
      await testDatabase.close();
    });

    test("a turn saved by a lagging instance follows the previous reply and keeps its own", async () => {
      const userId = await testDatabase.createUser();
      const chatId = crypto.randomUUID();
      await sendTurn({
        chatId,
        userId,
        question: "First question",
        answer: "First answer",
        newChat: { title: "Skew" },
      });

      appClockBehindByAnHour();
      await sendTurn({
        chatId,
        userId,
        question: "Second question",
        answer: "Second answer",
      });

      expect(await thread(chatId)).toEqual([
        "First question",
        "First answer",
        "Second question",
        "Second answer",
      ]);
    });

    test("a turn saved by a lagging instance moves its chat to the top of the sidebar", async () => {
      const userId = await testDatabase.createUser();
      const olderChatId = crypto.randomUUID();
      const newerChatId = crypto.randomUUID();
      await sendTurn({
        chatId: olderChatId,
        userId,
        question: "Older chat",
        answer: "Reply",
        newChat: { title: "Older" },
      });
      await sendTurn({
        chatId: newerChatId,
        userId,
        question: "Newer chat",
        answer: "Reply",
        newChat: { title: "Newer" },
      });

      appClockBehindByAnHour();
      await sendTurn({
        chatId: olderChatId,
        userId,
        question: "Back to the older chat",
        answer: "Reply",
      });

      expect((await getChatsByUserId(userId)).map(({ id }) => id)).toEqual([
        olderChatId,
        newerChatId,
      ]);
    });
  }
);

const textOf = (parts: { type: string; text?: string }[]) =>
  parts.map((part) => (part.type === "text" ? part.text : "")).join("");

const append = (text: string) => ({
  type: "append" as const,
  message: {
    id: crypto.randomUUID(),
    parts: [{ type: "text" as const, text }],
  },
});

describe.skipIf(!hasTestDatabase)(
  "settling a turn the client lost track of",
  () => {
    let testDatabase: Awaited<ReturnType<typeof openTestDatabase>>;

    beforeAll(async () => {
      testDatabase = await openTestDatabase();
    });

    afterAll(async () => {
      await testDatabase.close();
    });

    const nextMillisecond = () =>
      new Promise((resolve) => setTimeout(resolve, 2));

    const ask = async (chatId: string, userId: string, question: string) => {
      const turnId = crypto.randomUUID();
      await nextMillisecond();
      await saveUserTurn({
        chatId,
        userId,
        streamId: turnId,
        turn: append(question),
      });
      return turnId;
    };

    const answer = async (
      chatId: string,
      turnId: string,
      text: string,
      replacesRepliesAfter?: string
    ) => {
      await nextMillisecond();
      await saveReplyIfLatestTurn({
        chatId,
        streamId: turnId,
        reply: {
          id: crypto.randomUUID(),
          parts: [{ type: "text", text }],
          model: "test-model",
        },
        replacesRepliesAfter,
      });
    };

    const answeredChat = async () => {
      const userId = await testDatabase.createUser();
      const chatId = crypto.randomUUID();
      const turnId = crypto.randomUUID();
      await saveUserTurn({
        chatId,
        userId,
        streamId: turnId,
        turn: append("First question"),
        newChat: { title: "Settle" },
      });
      await answer(chatId, turnId, "First answer");
      return { chatId, userId };
    };

    const streamRows = async (chatId: string) =>
      (
        await testDatabase.db
          .select()
          .from(stream)
          .where(eq(stream.chatId, chatId))
      ).length;

    test("a reply that saves after its turn was settled is dropped", async () => {
      const { chatId, userId } = await answeredChat();
      const turnId = await ask(chatId, userId, "Tell me a story");

      const settled = await settleTurn({ chatId, userId, turnId });
      await answer(chatId, turnId, "Once upon a time");

      expect(settled?.turnSaved).toBe(true);
      expect(settled?.messages.map(({ parts }) => textOf(parts))).toEqual([
        "First question",
        "First answer",
        "Tell me a story",
      ]);
      expect(await thread(chatId)).toEqual([
        "First question",
        "First answer",
        "Tell me a story",
      ]);
    });

    test("a regenerate settled before its reply saved keeps the reply it would replace", async () => {
      const { chatId, userId } = await answeredChat();
      const [question] = await getMessagesByChatId(chatId);
      const turnId = crypto.randomUUID();
      await saveUserTurn({
        chatId,
        userId,
        streamId: turnId,
        turn: { type: "regenerate", userMessageId: question.id },
      });

      const settled = await settleTurn({ chatId, userId, turnId });
      await answer(chatId, turnId, "A second answer", question.id);

      expect(settled?.messages.map(({ parts }) => textOf(parts))).toEqual([
        "First question",
        "First answer",
      ]);
      expect(await thread(chatId)).toEqual(["First question", "First answer"]);
    });

    test("a turn's reply is pending until it saves, and only for the chat's owner", async () => {
      const { chatId, userId } = await answeredChat();
      const turnId = await ask(chatId, userId, "Tell me a story");
      const otherUserId = await testDatabase.createUser();

      const beforeSave = await isReplyPending({ chatId, userId, turnId });
      const forOtherUser = await isReplyPending({
        chatId,
        userId: otherUserId,
        turnId,
      });
      await answer(chatId, turnId, "Once upon a time");
      const afterSave = await isReplyPending({ chatId, userId, turnId });

      expect(beforeSave).toBe(true);
      expect(forOtherUser).toBe(false);
      expect(afterSave).toBe(false);
    });

    test("a settled turn has no reply pending", async () => {
      const { chatId, userId } = await answeredChat();
      const turnId = await ask(chatId, userId, "Tell me a story");

      await settleTurn({ chatId, userId, turnId });

      expect(await isReplyPending({ chatId, userId, turnId })).toBe(false);
    });

    test("a settle returns the reply that saved before it", async () => {
      const { chatId, userId } = await answeredChat();
      const turnId = await ask(chatId, userId, "Tell me a story");
      await answer(chatId, turnId, "Once upon a time");

      const settled = await settleTurn({ chatId, userId, turnId });

      expect(settled?.turnSaved).toBe(true);
      expect(settled?.messages.map(({ parts }) => textOf(parts))).toEqual([
        "First question",
        "First answer",
        "Tell me a story",
        "Once upon a time",
      ]);
    });

    test("a turn sent after a settle saves its reply", async () => {
      const { chatId, userId } = await answeredChat();
      const stopped = await ask(chatId, userId, "Tell me a story");
      await settleTurn({ chatId, userId, turnId: stopped });

      const next = await ask(chatId, userId, "A short one, please");
      await answer(chatId, next, "Once.");

      expect(await thread(chatId)).toEqual([
        "First question",
        "First answer",
        "Tell me a story",
        "A short one, please",
        "Once.",
      ]);
    });

    test("a settle never cuts off a newer turn", async () => {
      const { chatId, userId } = await answeredChat();
      const older = await ask(chatId, userId, "Tell me a story");
      const newer = await ask(chatId, userId, "Make it a poem");

      await settleTurn({ chatId, userId, turnId: older });
      await answer(chatId, newer, "Roses are red");

      expect(await thread(chatId)).toEqual([
        "First question",
        "First answer",
        "Tell me a story",
        "Make it a poem",
        "Roses are red",
      ]);
    });

    test("turns and settles in one millisecond still sort in the order they ran", async () => {
      const { chatId, userId } = await answeredChat();
      const startTurn = async () => {
        const turnId = crypto.randomUUID();
        await saveUserTurn({
          chatId,
          userId,
          streamId: turnId,
          turn: append("Another question"),
        });
        return turnId;
      };
      const turnThenSettle = async (remaining: number): Promise<void> => {
        if (remaining === 0) {
          return;
        }
        await settleTurn({ chatId, userId, turnId: await startTurn() });
        await turnThenSettle(remaining - 1);
      };

      await turnThenSettle(50);
      const lastTurnId = await startTurn();
      const stamps = (
        await testDatabase.db
          .select({ createdAt: stream.createdAt })
          .from(stream)
          .where(eq(stream.chatId, chatId))
      ).map(({ createdAt }) => createdAt.getTime());

      expect(new Set(stamps).size).toBe(stamps.length);
      expect(await getLatestStreamId(chatId)).toBe(lastTurnId);
    });

    test("a turn settled before its request arrives cannot save when it arrives", async () => {
      const { chatId, userId } = await answeredChat();
      const turnId = crypto.randomUUID();

      const settled = await settleTurn({ chatId, userId, turnId });
      const late = await saveUserTurn({
        chatId,
        userId,
        streamId: turnId,
        turn: append("A late question"),
      });

      expect(settled?.turnSaved).toBe(false);
      expect(late).toBeNull();
      expect(await thread(chatId)).toEqual(["First question", "First answer"]);
    });

    test("settling a turn again gives the same answer and writes nothing", async () => {
      const { chatId, userId } = await answeredChat();
      const saved = await ask(chatId, userId, "Tell me a story");
      const unseen = crypto.randomUUID();

      const first = [
        await settleTurn({ chatId, userId, turnId: saved }),
        await settleTurn({ chatId, userId, turnId: unseen }),
      ];
      const rowsAfterFirst = await streamRows(chatId);
      const second = [
        await settleTurn({ chatId, userId, turnId: saved }),
        await settleTurn({ chatId, userId, turnId: unseen }),
      ];

      expect(second).toEqual(first);
      expect(await streamRows(chatId)).toBe(rowsAfterFirst);
    });

    test("a chat that does not exist has nothing to settle", async () => {
      const userId = await testDatabase.createUser();

      expect(
        await settleTurn({
          chatId: crypto.randomUUID(),
          userId,
          turnId: crypto.randomUUID(),
        })
      ).toBeNull();
    });

    test("another user cannot settle a chat, so its reply still saves", async () => {
      const { chatId, userId } = await answeredChat();
      const turnId = await ask(chatId, userId, "Tell me a story");
      const otherUserId = await testDatabase.createUser();

      const settled = await settleTurn({
        chatId,
        userId: otherUserId,
        turnId,
      });
      await answer(chatId, turnId, "Once upon a time");

      expect(settled).toBeNull();
      expect(await thread(chatId)).toEqual([
        "First question",
        "First answer",
        "Tell me a story",
        "Once upon a time",
      ]);
    });
  }
);
