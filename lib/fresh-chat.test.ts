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

test("the first visit to / shows the chat the page was rendered with", () => {
  const chats = openTab();

  expect(chats.idFor("page-1")).toBe("page-1");
});

test("a chat that a send may have created on the server is never shown fresh again", () => {
  const chats = openTab();
  chats.take("page-1");

  expect(chats.idFor("page-1")).toBe("new-1");
  expect(chats.idFor("page-1")).toBe("new-2");
});

test("a fresh chat whose send the server refused is shown again", () => {
  const chats = openTab();
  chats.take("page-1");

  chats.free("page-1");

  expect(chats.idFor("page-1")).toBe("page-1");
});
