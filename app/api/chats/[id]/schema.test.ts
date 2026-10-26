/// <reference types="bun-types/test" />
import { describe, expect, test } from "bun:test";
import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";
import { patchRequestBodySchema } from "./schema";

const parsePinnedKey = (pinnedKey: unknown) =>
  patchRequestBodySchema.safeParse({ pinnedKey });

describe("PATCH /api/chats/[id] pinnedKey", () => {
  test("accepts null to unpin", () => {
    const result = parsePinnedKey(null);
    expect(result.success).toBe(true);
    expect(result.data?.pinnedKey).toBeNull();
  });

  test("accepts keys the fractional-indexing package generates", () => {
    const first = generateKeyBetween(null, null);
    const [low, high] = generateNKeysBetween(first, null, 2);
    let crowded = high;
    for (let step = 0; step < 40; step += 1) {
      crowded = generateKeyBetween(low, crowded);
    }
    const keys = [
      first,
      low,
      high,
      crowded,
      generateKeyBetween(null, first),
      ...generateNKeysBetween(low, high, 20),
    ];

    for (const key of keys) {
      expect(parsePinnedKey(key).data?.pinnedKey).toBe(key);
    }
    expect(crowded.length).toBeGreaterThan(5);
  });

  test("accepts a 64-character key and rejects a 65-character key", () => {
    expect(parsePinnedKey("a".repeat(64)).success).toBe(true);
    expect(parsePinnedKey("a".repeat(65)).success).toBe(false);
  });

  test("rejects keys outside base62", () => {
    for (const key of ["", "a-0", "a 0", "a0_", "a0/", "ä0", "a0\n"]) {
      expect(parsePinnedKey(key).success).toBe(false);
    }
  });

  test("rejects a key that is not a string", () => {
    expect(parsePinnedKey(10).success).toBe(false);
    expect(parsePinnedKey(["a0"]).success).toBe(false);
  });

  test("rejects a body with nothing to update", () => {
    expect(patchRequestBodySchema.safeParse({}).success).toBe(false);
  });
});
