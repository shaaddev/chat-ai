/// <reference types="bun-types/test" />
import { describe, expect, test } from "bun:test";
import { RUNNABLE_FENCES, type Runner, runnerForFence } from "./languages";

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

describe("runnerForFence", () => {
  test.each<[string, Runner]>([
    ["js", JAVASCRIPT],
    ["javascript", JAVASCRIPT],
    ["ts", TYPESCRIPT],
    ["typescript", TYPESCRIPT],
    ["py", PYTHON],
    ["python", PYTHON],
    ["python3", PYTHON],
  ])("runs %s fences", (fence, runner) => {
    expect(runnerForFence(fence)).toEqual(runner);
    expect(RUNNABLE_FENCES).toContain(fence);
  });

  test.each(["jsx", "tsx", "node", "mjs", "bash", "json", "", "constructor"])(
    "has no runner for %p",
    (fence) => {
      expect(runnerForFence(fence)).toBeUndefined();
      expect(RUNNABLE_FENCES).not.toContain(fence);
    }
  );

  test("matches fences exactly, as Streamdown routes them", () => {
    expect(runnerForFence("Python")).toBeUndefined();
    expect(RUNNABLE_FENCES).not.toContain("Python");
  });
});
