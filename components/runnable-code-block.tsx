"use client";

import { Play, Square } from "lucide-react";
import {
  type Ref,
  type UIEvent,
  useContext,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
} from "react";
import {
  CodeBlock,
  CodeBlockCopyButton,
  type CustomRendererProps,
  StreamdownContext,
} from "streamdown";
import { startRun } from "@/lib/code-runner/host";
import { type Runner, runnerForFence } from "@/lib/code-runner/languages";
import {
  INITIAL_RUN_STATE,
  isActive,
  OUTPUT_LIMIT,
  type RunState,
  type RunStatus,
  runReducer,
} from "@/lib/code-runner/run-state";
import { cn } from "@/lib/utils";

const STATUS_TEXT: Record<
  RunStatus["kind"],
  { label: string; preposition: "in" | "after" | null; failed: boolean }
> = {
  idle: { label: "", preposition: null, failed: false },
  loading: { label: "Loading Python…", preposition: null, failed: false },
  running: { label: "Running…", preposition: null, failed: false },
  done: { label: "Done", preposition: "in", failed: false },
  error: { label: "Failed", preposition: "after", failed: true },
  "timed-out": { label: "Timed out", preposition: "after", failed: true },
  stopped: { label: "Stopped", preposition: "after", failed: false },
};

const formatDuration = (ms: number) =>
  ms < 1000
    ? `${Math.max(1, Math.round(ms))} ms`
    : `${(ms / 1000).toFixed(1)} s`;

function statusText(status: RunStatus): string {
  const { label, preposition } = STATUS_TEXT[status.kind];
  return "durationMs" in status && status.durationMs !== null
    ? `${label} ${preposition} ${formatDuration(status.durationMs)}`
    : label;
}

const announcement = (status: RunStatus) =>
  status.kind === "running" ? "" : statusText(status);

function RunButton({
  active,
  label,
  onClick,
  ref,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  ref: Ref<HTMLButtonElement>;
}) {
  const action = active ? "Stop" : "Run";
  return (
    <button
      aria-label={`${action} ${label}`}
      className="flex cursor-pointer items-center gap-1 rounded-md p-1 font-medium text-muted-foreground text-xs outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
      onClick={onClick}
      ref={ref}
      type="button"
    >
      {active ? (
        <Square aria-hidden="true" className="size-3 fill-current" />
      ) : (
        <Play aria-hidden="true" className="size-3.5" />
      )}
      {action}
    </button>
  );
}

function RunOutput({
  state: { status, output },
  onClear,
}: {
  state: RunState;
  onClear: () => void;
}) {
  const active = isActive(status);
  const detail = "detail" in status ? status.detail : null;
  const shown = output.length + (detail?.length ?? 0);
  const scrollRef = useRef<HTMLPreElement>(null);
  const followRef = useRef(true);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (shown === 0) {
      followRef.current = true;
    } else if (element && followRef.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [shown]);

  const onScroll = (event: UIEvent<HTMLPreElement>) => {
    const element = event.currentTarget;
    followRef.current =
      element.scrollHeight - element.scrollTop - element.clientHeight < 8;
  };

  return (
    <div
      className="fade-in mb-3.5 animate-in rounded-b-xl border-border border-t bg-code duration-150"
      data-code-output=""
    >
      <div className="flex h-[34px] items-center gap-3 pt-1.5 pr-2 pl-3.5 font-medium text-muted-foreground text-xs">
        <span>Output</span>
        <span
          className={cn(
            "ml-auto",
            STATUS_TEXT[status.kind].failed && "text-destructive"
          )}
          data-code-status=""
        >
          {statusText(status)}
        </span>
        {active ? null : (
          <button
            className="touch-hitbox relative cursor-pointer rounded-md p-1 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
            onClick={onClear}
            type="button"
          >
            Clear
          </button>
        )}
      </div>
      {shown > 0 ? (
        <pre
          className="max-h-72 overflow-auto whitespace-pre-wrap break-words px-4 pt-0.5 pb-3 font-mono text-[13px] text-foreground leading-[1.55]"
          onScroll={onScroll}
          ref={scrollRef}
        >
          {output.chunks.map((chunk, index) => (
            <span
              className={
                chunk.stream === "stderr" ? "text-destructive" : undefined
              }
              data-stream={chunk.stream}
              key={index}
            >
              {chunk.text}
            </span>
          ))}
          {output.truncated ? (
            <span className="my-1 block font-sans text-muted-foreground text-xs">
              Output truncated at {OUTPUT_LIMIT.toLocaleString("en-US")}{" "}
              characters.
            </span>
          ) : null}
          {detail ? (
            <span className="block text-destructive" data-stream="stderr">
              {detail}
            </span>
          ) : null}
        </pre>
      ) : null}
      {shown === 0 && !active ? (
        <div className="px-3.5 pb-3 text-muted-foreground text-xs">
          No output
        </div>
      ) : null}
    </div>
  );
}

export function RunnableCodeBlock({
  code,
  isIncomplete,
  language,
}: CustomRendererProps) {
  const { lineNumbers } = useContext(StreamdownContext);
  const runner = runnerForFence(language);
  const [state, dispatch] = useReducer(runReducer, INITIAL_RUN_STATE);
  const stopRef = useRef<(() => void) | null>(null);
  const runButtonRef = useRef<HTMLButtonElement>(null);
  const active = isActive(state.status);

  useEffect(() => () => stopRef.current?.(), []);

  const toggleRun = (selected: Runner) => {
    if (active) {
      stopRef.current?.();
      return;
    }
    dispatch({ type: "run", at: performance.now() });
    stopRef.current = startRun(selected, code, dispatch);
  };

  const clear = () => {
    dispatch({ type: "clear" });
    runButtonRef.current?.focus();
  };

  const open = state.status.kind !== "idle";

  return (
    <div data-code-runner="" data-output-open={open ? "" : undefined}>
      <CodeBlock
        code={code}
        isIncomplete={isIncomplete}
        language={language}
        lineNumbers={lineNumbers}
      >
        {runner && !isIncomplete ? (
          <RunButton
            active={active}
            label={runner.label}
            onClick={() => toggleRun(runner)}
            ref={runButtonRef}
          />
        ) : null}
        <CodeBlockCopyButton />
      </CodeBlock>
      {open ? <RunOutput onClear={clear} state={state} /> : null}
      <output aria-live="polite" className="sr-only">
        {announcement(state.status)}
      </output>
    </div>
  );
}
