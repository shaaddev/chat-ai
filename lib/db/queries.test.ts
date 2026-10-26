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
import { hasTestDatabase, openTestDatabase } from "./test-database";

mock.module("server-only", () => ({}));

const {
  getChatsByUserId,
  getMessagesByChatId,
  saveReplyIfLatestTurn,
  saveUserTurn,
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
