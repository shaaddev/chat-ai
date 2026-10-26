import {
  type AttachmentMediaType,
  checkAttachment,
  isImageType,
} from "./attachments";

type TrayItemStatus =
  | { status: "uploading"; progress: number }
  | { status: "failed" }
  | { status: "done"; url: string };

interface TrayFile {
  id: string;
  mediaType: AttachmentMediaType;
  name: string;
  /** A local object URL for images, so a thumbnail shows before the upload ends. */
  previewUrl: string | null;
  size: number;
}

export type TrayItem = TrayFile & TrayItemStatus;

export interface Rejection {
  name: string;
  reason: "type" | "size";
}

export interface UploadOptions {
  onProgress: (percent: number) => void;
  signal: AbortSignal;
}

export interface TrayEffects {
  createId: () => string;
  discard: (url: string) => void;
  notifyFailed: (name: string) => void;
  notifyRejected: (rejections: Rejection[]) => void;
  /** Uploads one file and resolves with its stored URL. */
  upload: (file: File, options: UploadOptions) => Promise<string>;
}

export type TrayReadiness = "empty" | "uploading" | "ready";

export interface AttachmentTray {
  add: (files: File[]) => void;
  /** Empties the tray after a send. Done uploads now belong to the message. */
  clear: () => void;
  getItems: () => readonly TrayItem[];
  remove: (id: string) => void;
  retry: (id: string) => void;
  subscribe: (listener: () => void) => () => void;
}

interface Upload {
  controller: AbortController;
  removed: boolean;
}

export function readiness(items: readonly TrayItem[]): TrayReadiness {
  if (items.some((item) => item.status === "uploading")) {
    return "uploading";
  }
  return items.some((item) => item.status === "done") ? "ready" : "empty";
}

function withStatus(item: TrayItem, status: TrayItemStatus): TrayItem {
  const { id, mediaType, name, previewUrl, size } = item;
  return { id, mediaType, name, previewUrl, size, ...status };
}

export function createAttachmentTray(effects: TrayEffects): AttachmentTray {
  let items: readonly TrayItem[] = [];
  const files = new Map<string, File>();
  const uploads = new Map<string, Upload>();
  const listeners = new Set<() => void>();

  const commit = (next: readonly TrayItem[]) => {
    items = next;
    for (const listener of listeners) {
      listener();
    }
  };

  const setStatus = (id: string, status: TrayItemStatus) => {
    if (items.some((item) => item.id === id)) {
      commit(
        items.map((item) => (item.id === id ? withStatus(item, status) : item))
      );
    }
  };

  const release = (item: TrayItem) => {
    files.delete(item.id);
    if (item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
    }
  };

  const cancel = (item: TrayItem) => {
    const upload = uploads.get(item.id);
    if (!upload) {
      return;
    }
    upload.removed = true;
    // Once every byte is sent the file is stored even if the request is
    // cancelled, so let it finish and discard it instead.
    if (item.status === "uploading" && item.progress < 100) {
      upload.controller.abort();
    }
  };

  const start = async (id: string, file: File) => {
    const upload: Upload = {
      controller: new AbortController(),
      removed: false,
    };
    uploads.set(id, upload);
    let reported = 0;
    try {
      const url = await effects.upload(file, {
        signal: upload.controller.signal,
        onProgress: (percent) => {
          const progress = Math.min(100, Math.floor(percent));
          if (progress !== reported) {
            reported = progress;
            setStatus(id, { status: "uploading", progress });
          }
        },
      });
      if (upload.removed) {
        effects.discard(url);
        return;
      }
      setStatus(id, { status: "done", url });
    } catch {
      if (!upload.removed) {
        setStatus(id, { status: "failed" });
        effects.notifyFailed(file.name);
      }
    } finally {
      if (uploads.get(id) === upload) {
        uploads.delete(id);
      }
    }
  };

  return {
    add: (incoming) => {
      const rejections: Rejection[] = [];
      const added: { item: TrayItem; file: File }[] = [];
      for (const file of incoming) {
        const check = checkAttachment(file);
        if (!check.ok) {
          rejections.push({ name: file.name, reason: check.reason });
          continue;
        }
        added.push({
          file,
          item: {
            id: effects.createId(),
            mediaType: check.mediaType,
            name: file.name,
            previewUrl: isImageType(check.mediaType)
              ? URL.createObjectURL(file)
              : null,
            size: file.size,
            status: "uploading",
            progress: 0,
          },
        });
      }
      if (rejections.length > 0) {
        effects.notifyRejected(rejections);
      }
      if (added.length === 0) {
        return;
      }
      commit([...items, ...added.map(({ item }) => item)]);
      for (const { item, file } of added) {
        files.set(item.id, file);
        start(item.id, file);
      }
    },
    clear: () => {
      for (const item of items) {
        cancel(item);
        release(item);
      }
      commit([]);
    },
    getItems: () => items,
    remove: (id) => {
      const item = items.find((candidate) => candidate.id === id);
      if (!item) {
        return;
      }
      commit(items.filter((candidate) => candidate.id !== id));
      release(item);
      if (item.status === "done") {
        effects.discard(item.url);
      } else {
        cancel(item);
      }
    },
    retry: (id) => {
      const item = items.find((candidate) => candidate.id === id);
      const file = files.get(id);
      if (item?.status !== "failed" || !file) {
        return;
      }
      setStatus(id, { status: "uploading", progress: 0 });
      start(id, file);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
