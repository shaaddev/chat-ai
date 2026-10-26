export const OUTPUT_LIMIT = 10_000;
export const DETAIL_LIMIT = 4000;

export type OutputStream = "stdout" | "stderr";

export interface OutputChunk {
  readonly stream: OutputStream;
  readonly text: string;
}

export interface OutputBuffer {
  readonly chunks: readonly OutputChunk[];
  readonly length: number;
  readonly truncated: boolean;
}

export const EMPTY_OUTPUT: OutputBuffer = {
  chunks: [],
  length: 0,
  truncated: false,
};

export function appendOutput(
  buffer: OutputBuffer,
  incoming: readonly OutputChunk[]
): OutputBuffer {
  if (buffer.truncated) {
    return buffer;
  }
  const chunks = [...buffer.chunks];
  let { length } = buffer;
  for (const { stream, text } of incoming) {
    const kept = text.slice(0, OUTPUT_LIMIT - length);
    if (kept !== "") {
      const last = chunks.at(-1);
      if (last?.stream === stream) {
        chunks[chunks.length - 1] = { stream, text: last.text + kept };
      } else {
        chunks.push({ stream, text: kept });
      }
      length += kept.length;
    }
    if (kept.length < text.length) {
      return { chunks, length, truncated: true };
    }
  }
  return { chunks, length, truncated: false };
}

export type RunExit = "done" | "error" | "timed-out" | "stopped";

export type RunStatus =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | { readonly kind: "running"; readonly startedAt: number }
  | {
      readonly kind: RunExit;
      readonly durationMs: number | null;
      readonly detail: string | null;
    };

export interface RunState {
  readonly output: OutputBuffer;
  readonly status: RunStatus;
}

export const INITIAL_RUN_STATE: RunState = {
  status: { kind: "idle" },
  output: EMPTY_OUTPUT,
};

export type RunEvent =
  | { readonly type: "loading" }
  | { readonly type: "started"; readonly at: number }
  | { readonly type: "output"; readonly chunks: readonly OutputChunk[] }
  | {
      readonly type: "exit";
      readonly exit: RunExit;
      readonly at: number;
      readonly detail: string | null;
    };

export type RunAction =
  | RunEvent
  | { readonly type: "run"; readonly at: number }
  | { readonly type: "clear" };

export const isActive = (status: RunStatus): boolean =>
  status.kind === "loading" || status.kind === "running";

export function runReducer(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case "run":
      return {
        status: { kind: "running", startedAt: action.at },
        output: EMPTY_OUTPUT,
      };
    case "loading":
      return { ...state, status: { kind: "loading" } };
    case "started":
      return { ...state, status: { kind: "running", startedAt: action.at } };
    case "output":
      return { ...state, output: appendOutput(state.output, action.chunks) };
    case "exit":
      return {
        ...state,
        status: {
          kind: action.exit,
          durationMs:
            state.status.kind === "running"
              ? action.at - state.status.startedAt
              : null,
          detail: action.detail,
        },
      };
    case "clear":
      return INITIAL_RUN_STATE;
    default:
      return state;
  }
}
