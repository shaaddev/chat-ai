export type Runtime = "javascript" | "python";

export interface Runner {
  readonly label: string;
  readonly runtime: Runtime;
  readonly transpile: "typescript" | null;
}

const JAVASCRIPT: Runner = {
  label: "JavaScript",
  runtime: "javascript",
  transpile: null,
};
const TYPESCRIPT: Runner = {
  label: "TypeScript",
  runtime: "javascript",
  transpile: "typescript",
};
const PYTHON: Runner = { label: "Python", runtime: "python", transpile: null };

const RUNNERS_BY_FENCE: ReadonlyMap<string, Runner> = new Map([
  ["js", JAVASCRIPT],
  ["javascript", JAVASCRIPT],
  ["ts", TYPESCRIPT],
  ["typescript", TYPESCRIPT],
  ["py", PYTHON],
  ["python", PYTHON],
  ["python3", PYTHON],
]);

export const RUNNABLE_FENCES: readonly string[] = [...RUNNERS_BY_FENCE.keys()];

export const runnerForFence = (fence: string): Runner | undefined =>
  RUNNERS_BY_FENCE.get(fence);
