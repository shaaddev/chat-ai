/// <reference types="bun-types/test" />
import { expect, test } from "bun:test";
import { createAttachmentTray, type SentFile } from "@/lib/uploadthing/tray";
import { createChatDrafts, joinDraftText } from "./chat-drafts";

const openTab = () => {
  const trays = new Map<string, ReturnType<typeof createAttachmentTray>>();
  const trayFor = (key: string) => {
    const existing = trays.get(key);
    if (existing) {
      return existing;
    }
    const tray = createAttachmentTray({
      createId: () => crypto.randomUUID(),
      discard: () => undefined,
      notifyFailed: () => undefined,
      notifyRejected: () => undefined,
      upload: () => new Promise<string>(() => undefined),
    });
    trays.set(key, tray);
    return tray;
  };
  return createChatDrafts({
    defaults: () => ({
      autoDocumentGeneration: false,
      input: "",
      useSearch: true,
    }),
    trays: {
      get: trayFor,
      move: (from, to) => {
        const tray = trays.get(from);
        if (tray) {
          trays.delete(from);
          trays.set(to, tray);
        }
      },
    },
    useSearchChanged: () => undefined,
  });
};

type Drafts = ReturnType<typeof openTab>;

const showComposer = (drafts: Drafts, key: string, typed = "") => {
  const composer = { text: typed };
  const close = drafts.takeHandBacks((draftKey, text) => {
    if (draftKey !== key) {
      return false;
    }
    composer.text = joinDraftText(text, composer.text);
    return true;
  });
  return { close, composer };
};

const PHOTO: SentFile = {
  filename: "photo.png",
  mediaType: "image/png",
  size: 1024,
  url: "https://utfs.io/f/photo.png",
};

const fileNames = (drafts: Drafts, key: string) =>
  drafts
    .tray(key)
    .getItems()
    .map(({ name }) => name);

const question = (text: string, files: SentFile[] = []) => ({
  files,
  maybeSaved: false,
  text,
});

test("restored text goes in front of anything typed since", () => {
  expect(joinDraftText("Unsent question", "")).toBe("Unsent question");
  expect(joinDraftText("Unsent question", "Follow-up")).toBe(
    "Unsent question\n\nFollow-up"
  );
  expect(joinDraftText("", "Follow-up")).toBe("Follow-up");
});

test("text and files handed back wait in their draft when no composer shows it", () => {
  const drafts = openTab();
  drafts.set("fresh:user-a", { input: "Follow-up" });

  const shown = drafts.handBack(
    "fresh:user-a",
    question("Unsent question", [PHOTO])
  );

  expect(shown).toBe(false);
  expect(drafts.get("fresh:user-a").input).toBe("Unsent question\n\nFollow-up");
  expect(fileNames(drafts, "fresh:user-a")).toEqual(["photo.png"]);
});

test("a composer showing the draft takes handed-back text at once, and the draft keeps it too", () => {
  const drafts = openTab();
  const { composer } = showComposer(drafts, "fresh:user-a", "Follow-up");

  expect(drafts.handBack("fresh:user-a", question("Unsent question"))).toBe(
    true
  );
  expect(composer.text).toBe("Unsent question\n\nFollow-up");
  expect(drafts.get("fresh:user-a").input).toBe("Unsent question");
});

test("handed-back text never reaches a composer showing another draft", () => {
  const drafts = openTab();
  const other = showComposer(drafts, "fresh:user-b");
  const closed = showComposer(drafts, "fresh:user-a");
  closed.close();

  expect(drafts.handBack("fresh:user-a", question("Unsent question"))).toBe(
    false
  );
  expect(other.composer.text).toBe("");
  expect(closed.composer.text).toBe("");
  expect(drafts.get("fresh:user-b").input).toBe("");
});

test("a draft moved to its chat takes its files, and a later hand-back to `/` keeps its own", () => {
  const drafts = openTab();
  drafts.set("fresh:user-a", { input: "Typed while the reply streamed" });
  drafts.tray("fresh:user-a").restore([PHOTO]);

  drafts.move("fresh:user-a", "chat-y");
  drafts.handBack(
    "fresh:user-a",
    question("A lost first message", [{ ...PHOTO, filename: "lost.png" }])
  );

  expect(drafts.get("chat-y").input).toBe("Typed while the reply streamed");
  expect(fileNames(drafts, "chat-y")).toEqual(["photo.png"]);
  expect(drafts.get("fresh:user-a").input).toBe("A lost first message");
  expect(fileNames(drafts, "fresh:user-a")).toEqual(["lost.png"]);
});
