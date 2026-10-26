"use client";

import {
  type ComponentProps,
  isValidElement,
  type ReactNode,
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
  defaultComponents,
  StreamdownContext,
  useIsCodeFenceIncomplete,
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
    : `${Number((ms / 1000).toFixed(1))} s`;

function statusText(status: RunStatus): string {
  const { label, preposition } = STATUS_TEXT[status.kind];
  if (!("durationMs" in status) || status.durationMs === null) {
    return label;
  }
  // A timeout fires at a whole-second limit. The extra milliseconds are
  // only the time the message took to arrive.
  const ms =
    status.kind === "timed-out"
      ? Math.round(status.durationMs / 1000) * 1000
      : status.durationMs;
  return `${label} ${preposition} ${formatDuration(ms)}`;
}

const SUMMARY_LENGTH = 40;

function blockName(runner: Runner, code: string): string {
  const firstLine =
    code
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line !== "") ?? "";
  if (firstLine === "") {
    return runner.label;
  }
  const summary =
    firstLine.length > SUMMARY_LENGTH
      ? `${firstLine.slice(0, SUMMARY_LENGTH - 1)}…`
      : firstLine;
  return `${runner.label}: ${summary}`;
}

const announcement = (status: RunStatus) =>
  status.kind === "running" ? "" : statusText(status);

function RunButton({
  active,
  name,
  onClick,
  ref,
}: {
  active: boolean;
  name: string;
  onClick: () => void;
  ref: Ref<HTMLButtonElement>;
}) {
  const action = active ? "Stop" : "Run";
  return (
    <button
      aria-label={`${action} ${name}`}
      className="flex cursor-pointer items-center gap-1 rounded-md p-1 font-medium text-muted-foreground text-xs outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
      onClick={onClick}
      ref={ref}
      type="button"
    >
      {/* The icons are CSS shapes because an SVG icon in each of 200 Run
          buttons pushed time to interactive back by about 190 ms. */}
      {active ? (
        <span
          aria-hidden="true"
          className="size-2.5 rounded-[2px] bg-current"
        />
      ) : (
        <span
          aria-hidden="true"
          className="size-3.5 bg-current"
          data-run-icon=""
        />
      )}
      {action}
    </button>
  );
}

function RunOutput({
  name,
  state: { status, output },
  onClear,
}: {
  name: string;
  state: RunState;
  onClear: () => void;
}) {
  const active = isActive(status);
  const detail = "detail" in status ? status.detail : null;
  const shown = output.length + (detail?.length ?? 0);
  const scrollRef = useRef<HTMLElement>(null);
  const followRef = useRef(true);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (shown === 0) {
      followRef.current = true;
    } else if (element && followRef.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [shown]);

  const onScroll = (event: UIEvent<HTMLElement>) => {
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
        <section
          aria-label={`Output of ${name}`}
          className="max-h-72 overflow-auto rounded-b-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset"
          onScroll={onScroll}
          ref={scrollRef}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: Safari does not let the keyboard reach a scroll container, so long output would be unreadable without a tab stop.
          tabIndex={0}
        >
          <pre className="w-max min-w-full whitespace-pre px-4 pt-0.5 pb-3 font-mono text-[13px] text-foreground leading-[1.55]">
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
        </section>
      ) : null}
      {shown === 0 && !active ? (
        <div className="px-3.5 pb-3 text-muted-foreground text-xs">
          No output
        </div>
      ) : null}
    </div>
  );
}

function RunnableCodeBlock({
  canRun,
  code,
  isIncomplete,
  language,
  runner,
}: {
  canRun: boolean;
  code: string;
  isIncomplete: boolean;
  language: string;
  runner: Runner;
}) {
  const { lineNumbers } = useContext(StreamdownContext);
  const [state, dispatch] = useReducer(runReducer, INITIAL_RUN_STATE);
  const stopRef = useRef<(() => void) | null>(null);
  const runButtonRef = useRef<HTMLButtonElement>(null);
  const active = isActive(state.status);
  const name = blockName(runner, code);

  useEffect(() => () => stopRef.current?.(), []);

  const ranCodeRef = useRef(code);
  useEffect(() => {
    if (ranCodeRef.current === code) {
      return;
    }
    ranCodeRef.current = code;
    stopRef.current?.();
    dispatch({ type: "clear" });
  }, [code]);

  const toggleRun = () => {
    if (active) {
      stopRef.current?.();
      return;
    }
    dispatch({ type: "run", at: performance.now() });
    stopRef.current = startRun(runner, code, dispatch);
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
        {canRun ? (
          <RunButton
            active={active}
            name={name}
            onClick={toggleRun}
            ref={runButtonRef}
          />
        ) : null}
        <CodeBlockCopyButton />
      </CodeBlock>
      {open ? <RunOutput name={name} onClear={clear} state={state} /> : null}
      <output aria-live="polite" className="sr-only">
        {announcement(state.status)}
      </output>
    </div>
  );
}

const DefaultCode = defaultComponents.code;
const LANGUAGE = /language-([^\s]+)/;

function codeText(children: ReactNode): string {
  if (typeof children === "string") {
    return children;
  }
  return isValidElement<{ children?: ReactNode }>(children) &&
    typeof children.props.children === "string"
    ? children.props.children
    : "";
}

const OPENING_FENCE = /^[ \t]*(`{3,}|~{3,})/;
const CLOSING_FENCE = /\n[ \t>]*(`{3,}|~{3,})[ \t]*$/;

// A fence the reply never closed runs to the end of its block, so its
// source ends with code rather than a closing fence.
function isClosedFence(source: string): boolean {
  const open = OPENING_FENCE.exec(source)?.[1];
  const close = CLOSING_FENCE.exec(source)?.[1];
  return (
    open !== undefined &&
    close !== undefined &&
    close[0] === open[0] &&
    close.length >= open.length
  );
}

interface HastNode {
  children?: HastNode[];
  position?: { start: { offset?: number }; end: { offset?: number } };
  properties?: Record<string, unknown>;
  tagName?: string;
}

// Streamdown parses each block on its own, so the file holds the block's
// markdown and positions index into it. This runs after sanitizing, which
// would drop the attribute.
export function markClosedFences() {
  return (tree: HastNode, file: { value: unknown }) => {
    const source = String(file.value);
    const visit = (node: HastNode) => {
      for (const child of node.children ?? []) {
        const { start, end } = child.position ?? {};
        const className = child.properties?.className;
        const language = Array.isArray(className)
          ? LANGUAGE.exec(className.join(" "))?.[1]
          : undefined;
        if (
          node.tagName === "pre" &&
          child.tagName === "code" &&
          language !== undefined &&
          runnerForFence(language) &&
          start?.offset !== undefined &&
          end?.offset !== undefined &&
          isClosedFence(source.slice(start.offset, end.offset))
        ) {
          child.properties = { ...child.properties, dataClosedFence: "" };
        }
        visit(child);
      }
    };
    visit(tree);
  };
}

// Rendering runnable blocks here, rather than through Streamdown's
// `plugins.renderers`, avoids the Suspense boundary that path adds around
// every block, which doubled hydration work in code-heavy chats.
export function RunnableCode(props: ComponentProps<typeof DefaultCode>) {
  const isIncomplete = useIsCodeFenceIncomplete();
  const language = LANGUAGE.exec(props.className ?? "")?.[1] ?? "";
  const runner = runnerForFence(language);
  if (!(runner && "data-block" in props)) {
    return <DefaultCode {...props} />;
  }
  return (
    <RunnableCodeBlock
      canRun={"data-closed-fence" in props && !isIncomplete}
      code={codeText(props.children)}
      isIncomplete={isIncomplete}
      language={language}
      runner={runner}
    />
  );
}
