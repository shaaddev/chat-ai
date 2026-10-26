/// <reference types="bun-types/test" />
import { afterEach, describe, expect, test } from "bun:test";
import { ChatSDKError } from "./errors";
import { fetchWithErrorHandlers } from "./utils";

const realFetch = globalThis.fetch;

const respondWith = (response: Response) => {
  globalThis.fetch = (() => Promise.resolve(response)) as typeof fetch;
};

const failureOf = async () => {
  try {
    await fetchWithErrorHandlers("http://localhost/api/chat");
  } catch (error) {
    return error;
  }
  throw new Error("expected the request to fail");
};

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("fetchWithErrorHandlers", () => {
  test("turns a JSON error into a ChatSDKError with its code and cause", async () => {
    respondWith(
      Response.json(
        { code: "bad_request:api", cause: "Image models need a text prompt." },
        { status: 400 }
      )
    );

    const error = await failureOf();

    expect(error).toBeInstanceOf(ChatSDKError);
    expect(error).toMatchObject({
      type: "bad_request",
      surface: "api",
      cause: "Image models need a text prompt.",
    });
  });

  test("turns a plain-text server error into a ChatSDKError", async () => {
    respondWith(new Response("Internal server error", { status: 500 }));

    const error = await failureOf();

    expect(error).toBeInstanceOf(ChatSDKError);
    expect(error).toMatchObject({ type: "server", surface: "api" });
  });

  test("turns a JSON error without a code into a ChatSDKError", async () => {
    respondWith(
      Response.json({ code: "", message: "Hidden" }, { status: 500 })
    );

    expect(await failureOf()).toMatchObject({ type: "server", surface: "api" });
  });

  test("returns a successful response untouched", async () => {
    const response = new Response("ok");
    respondWith(response);

    expect(await fetchWithErrorHandlers("http://localhost/api/chat")).toBe(
      response
    );
  });
});
