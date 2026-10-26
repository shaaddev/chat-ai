/// <reference types="bun-types/test" />
import { describe, expect, test } from "bun:test";
import { type Runner, runnerForFence } from "./languages";

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
  });

  test.each(["jsx", "tsx", "node", "mjs", "bash", "json", "", "constructor"])(
    "has no runner for %p",
    (fence) => {
      expect(runnerForFence(fence)).toBeUndefined();
    }
  );

  test("matches fences exactly", () => {
    expect(runnerForFence("Python")).toBeUndefined();
  });
});
