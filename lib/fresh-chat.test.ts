/// <reference types="bun-types/test" />
import { expect, test } from "bun:test";
import { createFreshChats } from "./fresh-chat";

const openTab = () => {
  let minted = 0;
  return createFreshChats(() => {
    minted += 1;
    return `new-${minted}`;
  });
};

const visit = (
  chats: ReturnType<typeof openTab>,
  pageChatId: string,
  userId: string | undefined
) => {
  const chatId = chats.idFor(pageChatId, userId);
  chats.shown(chatId, userId);
  return chatId;
};

test("the first visit to / shows the chat the page was rendered with", () => {
  const chats = openTab();

  expect(visit(chats, "page-1", "user-a")).toBe("page-1");
});

test("a chat that a send may have created on the server is never shown fresh again", () => {
  const chats = openTab();
  visit(chats, "page-1", "user-a");
  chats.take("page-1");

  const next = visit(chats, "page-1", "user-a");
  chats.take(next);

  expect(next).toBe("new-1");
  expect(visit(chats, "page-1", "user-a")).toBe("new-2");
});

test("an unsent fresh chat comes back on every visit, whichever page the router restores", () => {
  const chats = openTab();
  visit(chats, "page-1", "user-a");
  chats.take("page-1");
  const draftChat = visit(chats, "page-1", "user-a");

  expect(visit(chats, "page-1", "user-a")).toBe(draftChat);
  expect(visit(chats, "page-2", "user-a")).toBe(draftChat);
});

test("a fresh chat whose send the server refused is shown again", () => {
  const chats = openTab();
  visit(chats, "page-1", "user-a");
  chats.take("page-1");

  chats.free("page-1");

  expect(visit(chats, "page-2", "user-a")).toBe("page-1");
});

test("a newer page id is used once the fresh chat is taken", () => {
  const chats = openTab();
  visit(chats, "page-1", "user-a");
  chats.take("page-1");

  expect(visit(chats, "page-2", "user-a")).toBe("page-2");
});

test("a fresh chat is never shown after sign-out or to another user", () => {
  const chats = openTab();
  visit(chats, "page-1", "user-a");

  expect(visit(chats, "page-2", undefined)).toBe("page-2");
  expect(visit(chats, "page-3", "user-b")).toBe("page-3");
});
