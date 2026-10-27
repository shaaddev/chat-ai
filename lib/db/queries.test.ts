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
import { eq, sql } from "drizzle-orm";
import { chat, message, stream } from "./schema";
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

    // The import from Convex copied each chat's messages but no stream rows.
    const importedChat = async () => {
      const userId = await testDatabase.createUser();
      const chatId = crypto.randomUUID();
      await testDatabase.db
        .insert(chat)
        .values({ id: chatId, userId, title: "Imported" });
      await testDatabase.db.insert(message).values({
        id: crypto.randomUUID(),
        chatId,
        role: "user",
        parts: [{ type: "text", text: "An imported question" }],
      });
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

    const stampAheadOfTheClock = async (chatId: string) => {
      await testDatabase.db.insert(stream).values({
        id: crypto.randomUUID(),
        chatId,
        createdAt: sql`clock_timestamp() + interval '1 second'`,
      });
    };

    const stamps = async (chatId: string) =>
      (
        await testDatabase.db
          .select({ createdAt: stream.createdAt })
          .from(stream)
          .where(eq(stream.chatId, chatId))
      ).map(({ createdAt }) => createdAt.getTime());

    test("a turn becomes the latest even when an earlier row is stamped ahead of the clock", async () => {
      const { chatId, userId } = await answeredChat();
      await stampAheadOfTheClock(chatId);

      const turnId = await ask(chatId, userId, "Tell me a story");
      const stamped = await stamps(chatId);

      expect(new Set(stamped).size).toBe(stamped.length);
      expect(await getLatestStreamId(chatId)).toBe(turnId);
    });

    test("a settle ends a turn that is stamped ahead of the clock", async () => {
      const { chatId, userId } = await answeredChat();
      await stampAheadOfTheClock(chatId);
      const turnId = await ask(chatId, userId, "Tell me a story");

      await settleTurn({ chatId, userId, turnId });
      await answer(chatId, turnId, "Once upon a time");
      const stamped = await stamps(chatId);

      expect(new Set(stamped).size).toBe(stamped.length);
      expect(await thread(chatId)).toEqual([
        "First question",
        "First answer",
        "Tell me a story",
      ]);
    });

    test("a turn id from another chat is not a turn of this chat", async () => {
      const { chatId, userId } = await answeredChat();
      const other = await answeredChat();
      const otherTurnId = await ask(
        other.chatId,
        other.userId,
        "Tell me a story"
      );

      const settled = await settleTurn({ chatId, userId, turnId: otherTurnId });
      await answer(other.chatId, otherTurnId, "Once upon a time");

      expect(settled?.turnSaved).toBe(false);
      expect(await thread(chatId)).toEqual(["First question", "First answer"]);
      expect(await thread(other.chatId)).toEqual([
        "First question",
        "First answer",
        "Tell me a story",
        "Once upon a time",
      ]);
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

    test("in a chat with no turns yet, a repeated settle writes nothing and the next turn still saves", async () => {
      const { chatId, userId } = await importedChat();
      const unseen = crypto.randomUUID();

      const first = await settleTurn({ chatId, userId, turnId: unseen });
      const pending = await isReplyPending({ chatId, userId, turnId: unseen });
      const rowsAfterFirst = await streamRows(chatId);
      const second = await settleTurn({ chatId, userId, turnId: unseen });
      const rowsAfterSecond = await streamRows(chatId);
      const next = await ask(chatId, userId, "A new question");
      await answer(chatId, next, "A new answer");

      expect(second).toEqual(first);
      expect(rowsAfterSecond).toBe(rowsAfterFirst);
      expect(pending).toBe(false);
      expect(await thread(chatId)).toEqual([
        "An imported question",
        "A new question",
        "A new answer",
      ]);
    });

    type TestTransaction = Parameters<
      Parameters<typeof testDatabase.db.transaction>[0]
    >[0];

    const waitForALockWaiter = async (
      tx: TestTransaction,
      attempts = 500
    ): Promise<void> => {
      const [{ waiting }] = await tx.execute<{ waiting: number }>(
        sql`select count(*)::int as waiting from pg_locks where not granted and pg_backend_pid() = any(pg_blocking_pids(pid))`
      );
      if (waiting > 0) {
        return;
      }
      if (attempts === 0) {
        throw new Error("nothing waited for the chat row lock");
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
      await waitForALockWaiter(tx, attempts - 1);
    };

    const settleDuringSave = async (
      { chatId, userId }: { chatId: string; userId: string },
      turnId: string,
      save: (tx: TestTransaction) => Promise<unknown>
    ) => {
      const { settling } = await testDatabase.db.transaction(async (tx) => {
        await tx
          .select({ id: chat.id })
          .from(chat)
          .where(eq(chat.id, chatId))
          .for("update");
        await save(tx);
        const started = settleTurn({ chatId, userId, turnId });
        await waitForALockWaiter(tx);
        return { settling: started };
      });
      return await settling;
    };

    test("a settle that races the turn's own save waits for it and finds the turn saved", async () => {
      const opened = await answeredChat();
      const turnId = crypto.randomUUID();

      const settled = await settleDuringSave(opened, turnId, async (tx) => {
        await tx.insert(message).values({
          id: crypto.randomUUID(),
          chatId: opened.chatId,
          role: "user",
          parts: [{ type: "text", text: "Tell me a story" }],
          createdAt: sql`clock_timestamp()`,
        });
        await tx.insert(stream).values({
          id: turnId,
          chatId: opened.chatId,
          createdAt: sql`clock_timestamp()`,
        });
      });

      expect(settled?.turnSaved).toBe(true);
      expect(settled?.messages.map(({ parts }) => textOf(parts))).toEqual([
        "First question",
        "First answer",
        "Tell me a story",
      ]);
    });

    test("a settle that races the reply's save waits for it and returns the reply", async () => {
      const opened = await answeredChat();
      const turnId = await ask(opened.chatId, opened.userId, "Tell me a story");

      const settled = await settleDuringSave(opened, turnId, async (tx) => {
        await tx.insert(message).values({
          id: crypto.randomUUID(),
          chatId: opened.chatId,
          role: "assistant",
          parts: [{ type: "text", text: "Once upon a time" }],
          createdAt: sql`clock_timestamp()`,
        });
      });

      expect(settled?.messages.map(({ parts }) => textOf(parts))).toEqual([
        "First question",
        "First answer",
        "Tell me a story",
        "Once upon a time",
      ]);
    });

    test("a reply that saves while a settle holds the chat waits, then finds its turn ended", async () => {
      const { chatId, userId } = await answeredChat();
      const turnId = await ask(chatId, userId, "Tell me a story");

      const { saving } = await testDatabase.db.transaction(async (tx) => {
        await tx
          .select({ id: chat.id })
          .from(chat)
          .where(eq(chat.id, chatId))
          .for("update");
        await tx.insert(stream).values({
          id: crypto.randomUUID(),
          chatId,
          createdAt: sql`clock_timestamp()`,
        });
        const started = answer(chatId, turnId, "Once upon a time");
        await waitForALockWaiter(tx);
        return { saving: started };
      });
      await saving;

      expect(await thread(chatId)).toEqual([
        "First question",
        "First answer",
        "Tell me a story",
      ]);
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
