/// <reference types="bun-types/test" />
import { describe, expect, test } from "bun:test";
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_COUNT,
  formatBytes,
} from "./attachments";
import {
  createAttachmentTray,
  type Rejection,
  readiness,
  sentFiles,
  type UploadOptions,
} from "./tray";

interface PendingUpload {
  file: File;
  options: UploadOptions;
  reject: (error: Error) => void;
  resolve: (url: string) => void;
}

function setup() {
  const uploads: PendingUpload[] = [];
  const discarded: string[] = [];
  const rejected: Rejection[][] = [];
  const failed: string[] = [];
  let nextId = 0;
  const tray = createAttachmentTray({
    createId: () => {
      nextId += 1;
      return `item-${nextId}`;
    },
    discard: (url) => discarded.push(url),
    notifyFailed: (name) => failed.push(name),
    notifyRejected: (rejections) => rejected.push(rejections),
    upload: (file, options) =>
      new Promise<string>((resolve, reject) => {
        uploads.push({ file, options, resolve, reject });
      }),
  });
  return { tray, uploads, discarded, rejected, failed };
}

const image = (name: string) =>
  new File(["pixels"], name, { type: "image/png" });
const pdf = (name: string) =>
  new File(["%PDF-1.7"], name, { type: "application/pdf" });
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("attachment tray", () => {
  test("shows each accepted file as uploading, then done with its URL", async () => {
    const { tray, uploads } = setup();
    tray.add([image("cat.png"), pdf("notes.pdf")]);

    expect(
      tray.getItems().map(({ name, status }) => ({ name, status }))
    ).toEqual([
      { name: "cat.png", status: "uploading" },
      { name: "notes.pdf", status: "uploading" },
    ]);
    expect(readiness(tray.getItems())).toBe("uploading");

    uploads[0].options.onProgress(42.7);
    expect(tray.getItems()[0]).toMatchObject({
      status: "uploading",
      progress: 42,
    });

    uploads[0].resolve("https://files.test/cat.png");
    uploads[1].resolve("https://files.test/notes.pdf");
    await settle();

    expect(tray.getItems()).toMatchObject([
      { name: "cat.png", status: "done", url: "https://files.test/cat.png" },
      {
        name: "notes.pdf",
        status: "done",
        url: "https://files.test/notes.pdf",
      },
    ]);
    expect(readiness(tray.getItems())).toBe("ready");
  });

  test("keeps the order the files were added when later ones finish first", async () => {
    const { tray, uploads } = setup();
    tray.add([image("first.png"), image("second.png")]);
    uploads[1].resolve("https://files.test/second.png");
    await settle();

    expect(tray.getItems().map(({ name }) => name)).toEqual([
      "first.png",
      "second.png",
    ]);
    const ids = tray.getItems().map(({ id }) => id);
    expect(new Set(ids).size).toBe(2);
  });

  test("rejects unsupported and oversized files before uploading them", () => {
    const { tray, uploads, rejected } = setup();
    const huge = new File(
      [new Uint8Array(ATTACHMENT_MAX_BYTES + 1)],
      "huge.pdf",
      {
        type: "application/pdf",
      }
    );
    const movie = new File(["frames"], "clip.mov", { type: "video/quicktime" });

    tray.add([huge, image("ok.png"), movie]);

    expect(rejected).toEqual([
      [
        { name: "huge.pdf", reason: "size" },
        { name: "clip.mov", reason: "type" },
      ],
    ]);
    expect(uploads.map(({ file }) => file.name)).toEqual(["ok.png"]);
    expect(tray.getItems().map(({ name }) => name)).toEqual(["ok.png"]);
  });

  test("rejects files past the per-message limit before uploading them", () => {
    const { tray, uploads, rejected } = setup();
    tray.add([image("first.png")]);

    tray.add(
      Array.from({ length: ATTACHMENT_MAX_COUNT + 1 }, (_, index) =>
        image(`batch-${index}.png`)
      )
    );

    expect(tray.getItems()).toHaveLength(ATTACHMENT_MAX_COUNT);
    expect(uploads).toHaveLength(ATTACHMENT_MAX_COUNT);
    expect(rejected).toEqual([
      [
        { name: `batch-${ATTACHMENT_MAX_COUNT - 1}.png`, reason: "count" },
        { name: `batch-${ATTACHMENT_MAX_COUNT}.png`, reason: "count" },
      ],
    ]);
  });

  test("a failed upload holds the send until it is retried or removed", async () => {
    const { tray, uploads } = setup();
    tray.add([image("chart.png"), pdf("spec.pdf")]);
    uploads[0].resolve("https://files.test/chart.png");
    uploads[1].reject(new Error("network down"));
    await settle();

    expect(readiness(tray.getItems())).toBe("failed");

    tray.remove(tray.getItems()[1].id);
    expect(readiness(tray.getItems())).toBe("ready");
  });

  test("a failed upload can be retried", async () => {
    const { tray, uploads, failed } = setup();
    tray.add([pdf("report.pdf")]);
    uploads[0].reject(new Error("network down"));
    await settle();

    expect(tray.getItems()[0].status).toBe("failed");
    expect(failed).toEqual(["report.pdf"]);
    expect(readiness(tray.getItems())).toBe("failed");

    tray.retry(tray.getItems()[0].id);
    expect(tray.getItems()[0]).toMatchObject({
      status: "uploading",
      progress: 0,
    });
    expect(uploads[1].file.name).toBe("report.pdf");

    uploads[1].resolve("https://files.test/report.pdf");
    await settle();
    expect(tray.getItems()[0]).toMatchObject({
      status: "done",
      url: "https://files.test/report.pdf",
    });
  });

  test("removing an item mid-upload cancels its upload", async () => {
    const { tray, uploads, discarded, failed } = setup();
    tray.add([image("draft.png")]);
    uploads[0].options.onProgress(30);

    tray.remove(tray.getItems()[0].id);

    expect(tray.getItems()).toEqual([]);
    expect(uploads[0].options.signal.aborted).toBe(true);
    uploads[0].reject(new Error("aborted"));
    await settle();
    expect(tray.getItems()).toEqual([]);
    expect(failed).toEqual([]);
    expect(discarded).toEqual([]);
  });

  test("removing an item whose bytes are all sent deletes the stored file", async () => {
    const { tray, uploads, discarded } = setup();
    tray.add([image("late.png")]);
    uploads[0].options.onProgress(100);

    tray.remove(tray.getItems()[0].id);
    expect(uploads[0].options.signal.aborted).toBe(false);

    uploads[0].resolve("https://files.test/late.png");
    await settle();
    expect(discarded).toEqual(["https://files.test/late.png"]);
    expect(tray.getItems()).toEqual([]);
  });

  test("removing a done item deletes its stored file", async () => {
    const { tray, uploads, discarded } = setup();
    tray.add([pdf("old.pdf")]);
    uploads[0].resolve("https://files.test/old.pdf");
    await settle();

    tray.remove(tray.getItems()[0].id);

    expect(tray.getItems()).toEqual([]);
    expect(discarded).toEqual(["https://files.test/old.pdf"]);
  });

  test("clearing after a send keeps the stored files", async () => {
    const { tray, uploads, discarded } = setup();
    tray.add([image("sent.png")]);
    uploads[0].resolve("https://files.test/sent.png");
    await settle();

    tray.clearAfterSend();

    expect(tray.getItems()).toEqual([]);
    expect(discarded).toEqual([]);
  });

  test("restored files come back as done uploads ahead of newer ones", async () => {
    const { tray, uploads } = setup();
    tray.add([pdf("new.pdf")]);
    uploads[0].resolve("https://files.test/new.pdf");
    await settle();

    tray.restore([
      {
        filename: "chart.png",
        mediaType: "image/png",
        size: 2048,
        url: "https://files.test/chart.png",
      },
    ]);

    expect(
      tray.getItems().map(({ name, status }) => ({ name, status }))
    ).toEqual([
      { name: "chart.png", status: "done" },
      { name: "new.pdf", status: "done" },
    ]);
    expect(tray.getItems()[0]).toMatchObject({
      previewUrl: "https://files.test/chart.png",
      url: "https://files.test/chart.png",
    });
    expect(readiness(tray.getItems())).toBe("ready");
  });

  test("removing a restored file deletes its stored file", () => {
    const { tray, discarded } = setup();
    tray.restore([
      {
        filename: "notes.pdf",
        mediaType: "application/pdf",
        size: 512,
        url: "u1",
      },
    ]);

    tray.remove(tray.getItems()[0].id);

    expect(tray.getItems()).toEqual([]);
    expect(discarded).toEqual(["u1"]);
  });

  test("restored files come back past the per-message limit, and none is deleted", () => {
    const { tray, discarded, rejected } = setup();
    tray.add(
      Array.from({ length: ATTACHMENT_MAX_COUNT - 1 }, (_, index) =>
        image(`kept-${index}.png`)
      )
    );

    tray.restore([
      { filename: "first.png", mediaType: "image/png", size: 1, url: "u1" },
      { filename: "second.png", mediaType: "image/png", size: 1, url: "u2" },
    ]);

    expect(tray.getItems()).toHaveLength(ATTACHMENT_MAX_COUNT + 1);
    expect(tray.getItems().map(({ name }) => name)).toContain("second.png");
    expect(rejected).toEqual([]);
    expect(discarded).toEqual([]);
  });

  test("files past the per-message limit hold the send until enough are removed", () => {
    const { tray } = setup();
    tray.restore(
      Array.from({ length: ATTACHMENT_MAX_COUNT + 2 }, (_, index) => ({
        filename: `file-${index}.png`,
        mediaType: "image/png" as const,
        size: 1,
        url: `u${index}`,
      }))
    );

    const twoOver = readiness(tray.getItems());
    tray.remove(tray.getItems()[0].id);
    const oneOver = readiness(tray.getItems());
    tray.remove(tray.getItems()[0].id);

    expect(twoOver).toBe("over-limit");
    expect(oneOver).toBe("over-limit");
    expect(readiness(tray.getItems())).toBe("ready");
  });

  test("a send carries only the finished uploads", async () => {
    const { tray, uploads } = setup();
    tray.add([image("done.png"), pdf("pending.pdf")]);
    uploads[0].resolve("https://files.test/done.png");
    await settle();

    expect(sentFiles(tray.getItems())).toEqual([
      {
        filename: "done.png",
        mediaType: "image/png",
        size: tray.getItems()[0].size,
        url: "https://files.test/done.png",
      },
    ]);
  });

  test("notifies subscribers until they unsubscribe", () => {
    const { tray, uploads } = setup();
    let calls = 0;
    const unsubscribe = tray.subscribe(() => {
      calls += 1;
    });
    tray.add([image("a.png")]);
    expect(calls).toBe(1);

    unsubscribe();
    uploads[0].options.onProgress(50);
    expect(calls).toBe(1);
  });
});

describe("formatBytes", () => {
  test("reads like a file manager", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(88 * 1024)).toBe("88 KB");
    expect(formatBytes(1.2 * 1024 * 1024)).toBe("1.2 MB");
    expect(formatBytes(12 * 1024 * 1024)).toBe("12 MB");
  });
});
