/// <reference types="bun-types/test" />
import { expect, test } from "bun:test";
import { createChatDrafts, joinDraftText } from "./chat-drafts";

const openTab = () =>
  createChatDrafts({
    defaults: () => ({
      autoDocumentGeneration: false,
      input: "",
      useSearch: true,
    }),
    useSearchChanged: () => undefined,
  });

// A composer on screen showing `key`, as Chat watches for hand-backs.
const showComposer = (
  drafts: ReturnType<typeof openTab>,
  key: string,
  typed = ""
) => {
  const composer = { text: typed };
  const close = drafts.watchHandBacks((draftKey, text) => {
    if (draftKey !== key) {
      return false;
    }
    composer.text = joinDraftText(text, composer.text);
    return true;
  });
  return { close, composer };
};

test("restored text goes in front of anything typed since", () => {
  expect(joinDraftText("Unsent question", "")).toBe("Unsent question");
  expect(joinDraftText("Unsent question", "Follow-up")).toBe(
    "Unsent question\n\nFollow-up"
  );
  expect(joinDraftText("", "Follow-up")).toBe("Follow-up");
});

test("text handed back waits in the draft when no composer shows it", () => {
  const drafts = openTab();
  drafts.set("fresh:user-a", { input: "Follow-up" });

  expect(drafts.handBack("fresh:user-a", "Unsent question")).toBe(false);
  expect(drafts.get("fresh:user-a").input).toBe("Unsent question\n\nFollow-up");
});

test("a composer showing the draft takes handed-back text at once", () => {
  const drafts = openTab();
  const { composer } = showComposer(drafts, "fresh:user-a", "Follow-up");

  expect(drafts.handBack("fresh:user-a", "Unsent question")).toBe(true);
  expect(composer.text).toBe("Unsent question\n\nFollow-up");
});

test("handed-back text never reaches a composer showing another draft", () => {
  const drafts = openTab();
  const other = showComposer(drafts, "fresh:user-b");
  const closed = showComposer(drafts, "fresh:user-a");
  closed.close();

  expect(drafts.handBack("fresh:user-a", "Unsent question")).toBe(false);
  expect(other.composer.text).toBe("");
  expect(closed.composer.text).toBe("");
  expect(drafts.get("fresh:user-b").input).toBe("");
});

test("a moved draft shows under its new key only", () => {
  const drafts = openTab();
  drafts.set("fresh:user-a", { input: "Typed while the reply streamed" });

  drafts.move("fresh:user-a", "chat-1");

  expect(drafts.get("chat-1").input).toBe("Typed while the reply streamed");
  expect(drafts.get("fresh:user-a").input).toBe("");
});
