import type { Runtime } from "./languages";
import {
  DETAIL_LIMIT,
  OUTPUT_LIMIT,
  type OutputChunk,
  type OutputStream,
  type RunExit,
} from "./run-state";

export const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/";
export const RUN_TIMEOUT_MS = 5000;
export const LOAD_TIMEOUT_MS = 60_000;
export const READY_TIMEOUT_MS = 10_000;
export const HOST_BACKSTOP_MARGIN_MS = 2000;
export const OUTPUT_LIMIT_WITH_OVERFLOW_SENTINEL = OUTPUT_LIMIT + 1;

export function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

export type HostMessage =
  | {
      readonly type: "run";
      readonly runId: string;
      readonly runtime: Runtime;
      readonly code: string;
    }
  | { readonly type: "stop"; readonly runId: string };

export type FrameExit = Exclude<RunExit, "stopped">;

export type FrameMessage =
  | { readonly type: "ready" }
  | { readonly type: "loading" | "started"; readonly runId: string }
  | {
      readonly type: "output";
      readonly runId: string;
      readonly chunks: readonly OutputChunk[];
    }
  | {
      readonly type: "exit";
      readonly runId: string;
      readonly exit: FrameExit;
      readonly detail: string | null;
    };

export interface FrameContext {
  readonly frame: MessageEventSource | null;
  readonly isActiveRun: (runId: string) => boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isOutputStream = (value: unknown): value is OutputStream =>
  value === "stdout" || value === "stderr";

const isFrameExit = (value: unknown): value is FrameExit =>
  value === "done" || value === "error" || value === "timed-out";

function parseChunks(value: unknown): OutputChunk[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const chunks: OutputChunk[] = [];
  let length = 0;
  for (const item of value) {
    if (
      !(
        isRecord(item) &&
        isOutputStream(item.stream) &&
        typeof item.text === "string" &&
        item.text !== ""
      )
    ) {
      return null;
    }
    length += item.text.length;
    if (length > OUTPUT_LIMIT_WITH_OVERFLOW_SENTINEL) {
      return null;
    }
    chunks.push({ stream: item.stream, text: item.text });
  }
  return chunks;
}

function parseDetail(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  return typeof value === "string" && value.length <= DETAIL_LIMIT
    ? value
    : undefined;
}

export function readFrameMessage(
  event: Pick<MessageEvent, "data" | "origin" | "source">,
  context: FrameContext
): FrameMessage | null {
  // A sandboxed frame without allow-same-origin always reports origin "null".
  if (
    context.frame === null ||
    event.source !== context.frame ||
    event.origin !== "null" ||
    !isRecord(event.data)
  ) {
    return null;
  }
  const { data } = event;
  if (data.type === "ready") {
    return { type: "ready" };
  }
  const { runId } = data;
  if (typeof runId !== "string" || !context.isActiveRun(runId)) {
    return null;
  }
  switch (data.type) {
    case "loading":
    case "started":
      return { type: data.type, runId };
    case "output": {
      const chunks = parseChunks(data.chunks);
      return chunks ? { type: "output", runId, chunks } : null;
    }
    case "exit": {
      const detail = parseDetail(data.detail);
      return isFrameExit(data.exit) && detail !== undefined
        ? { type: "exit", runId, exit: data.exit, detail }
        : null;
    }
    default:
      return null;
  }
}
