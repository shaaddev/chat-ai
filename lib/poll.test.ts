/// <reference types="bun-types/test" />
import { expect, test } from "bun:test";
import { pollWhile } from "./poll";

const fakeClock = () => {
  let time = 0;
  const sleeps: number[] = [];
  return {
    now: () => time,
    sleep: (ms: number) => {
      sleeps.push(ms);
      time += ms;
      return Promise.resolve();
    },
    sleeps,
  };
};

test("checks again after 50 ms, doubles the wait up to 250 ms, and never sleeps past the deadline", async () => {
  const clock = fakeClock();
  const checkedAt: number[] = [];

  await pollWhile(
    () => {
      checkedAt.push(clock.now());
      return Promise.resolve(true);
    },
    1000,
    clock
  );

  expect(clock.sleeps).toEqual([50, 100, 200, 250, 250, 150]);
  expect(checkedAt).toEqual([0, 50, 150, 350, 600, 850]);
  expect(clock.now()).toBe(1000);
});

test("stops as soon as the check is false", async () => {
  const clock = fakeClock();
  const answers = [true, true, false];

  await pollWhile(() => Promise.resolve(answers.shift() ?? false), 1000, clock);

  expect(clock.sleeps).toEqual([50, 100]);
});

test("doesn't check once the deadline has passed", async () => {
  const clock = fakeClock();
  let checks = 0;

  await pollWhile(
    () => {
      checks += 1;
      return Promise.resolve(true);
    },
    0,
    clock
  );

  expect(checks).toBe(0);
  expect(clock.sleeps).toEqual([]);
});
