/// <reference types="bun-types/test" />
import { describe, expect, test } from "bun:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ChatMessage } from "@/lib/types";
import { PreviewMessage } from "./chat-message";
import { Markdown } from "./markdown";

const TAG = /<(\/?)([a-z0-9]+)((?:[^>"]|"[^"]*")*)>/g;

type Mark = "[b]" | "[i]" | "";

function markOf(tag: string, attributes: string): Mark {
  if (tag === "strong" || attributes.includes('data-streamdown="strong"')) {
    return "[b]";
  }
  return tag === "em" ? "[i]" : "";
}

function markedText(element: ReactElement): string {
  const html = renderToStaticMarkup(element);
  const open: Mark[] = [];
  let result = "";
  let last = 0;
  for (const match of html.matchAll(TAG)) {
    const [token, closing, tag, attributes] = match;
    result += html.slice(last, match.index);
    last = match.index + token.length;
    if (closing) {
      const mark = open.pop();
      result += mark ? mark.replace("[", "[/") : "";
    } else if (!attributes.endsWith("/")) {
      const mark = markOf(tag, attributes);
      open.push(mark);
      result += mark;
    }
  }
  return result + html.slice(last);
}

describe("Markdown in a finished message", () => {
  test.each([
    [
      "**what *is* and what *will be*.**",
      "[b]what [i]is[/i] and what [i]will be[/i].[/b]",
    ],
    [
      "the **significance of what *was***. Now **what *is* and what *will be*.**",
      "the [b]significance of what [i]was[/i][/b]. Now [b]what [i]is[/i] and what [i]will be[/i].[/b]",
    ],
    [
      "Someone talks *at* you.\n\n***\n\n**Will he finally bridge the gap.**",
      "Someone talks [i]at[/i] you.[b]Will he finally bridge the gap.[/b]",
    ],
    ["**a *b* c.**", "[b]a [i]b[/i] c.[/b]"],
    ["*a **b** c*", "[i]a [b]b[/b] c[/i]"],
    ["**bold**.", "[b]bold[/b]."],
    [
      "__what _is_ and what _will be_.__",
      "[b]what [i]is[/i] and what [i]will be[/i].[/b]",
    ],
  ])("renders %j without stray markers", (markdown, expected) => {
    expect(markedText(<Markdown>{markdown}</Markdown>)).toBe(expected);
  });
});

describe("Markdown in a streaming reply", () => {
  test("shows an unclosed bold run as bold while it streams", () => {
    expect(markedText(<Markdown isStreaming>{"Some **bold"}</Markdown>)).toBe(
      "Some [b]bold[/b]"
    );
  });

  test("keeps the streaming text repaired after a source arrives", () => {
    const reply: ChatMessage = {
      id: "reply",
      role: "assistant",
      parts: [
        { type: "text", text: "Some **bold", state: "streaming" },
        {
          type: "source-url",
          sourceId: "source",
          url: "https://example.com",
          title: "Example",
        },
      ],
    };
    const text = markedText(
      <PreviewMessage
        isEditing={false}
        isSourcesOpen={false}
        isStreaming
        message={reply}
        onToggleSources={() => undefined}
      />
    );
    expect(text).toContain("Some [b]bold[/b]");
  });
});
