/// <reference types="bun-types/test" />
import { describe, expect, test } from "bun:test";
import { ATTACHMENT_MAX_BYTES, formatBytes } from "./attachments";
import {
  createAttachmentTray,
  type Rejection,
  readiness,
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

  test("a failed upload can be retried", async () => {
    const { tray, uploads, failed } = setup();
    tray.add([pdf("report.pdf")]);
    uploads[0].reject(new Error("network down"));
    await settle();

    expect(tray.getItems()[0].status).toBe("failed");
    expect(failed).toEqual(["report.pdf"]);
    expect(readiness(tray.getItems())).toBe("empty");

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

    tray.clear();

    expect(tray.getItems()).toEqual([]);
    expect(discarded).toEqual([]);
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
