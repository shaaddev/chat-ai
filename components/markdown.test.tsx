/// <reference types="bun-types/test" />
import { describe, expect, test } from "bun:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ChatMessage } from "@/lib/types";
import { PreviewMessage } from "./chat-message";
import { Markdown } from "./markdown";

const TAG = /<(\/?)([a-z0-9]+)((?:[^>"]|"[^"]*")*)>/g;
const LANGUAGE = /data-language="([^"]*)"/;
const CODE_BLOCK = 'data-streamdown="code-block"';
const RUN_BUTTON = 'aria-label="Run ';
const RUN_NAME = /aria-label="(Run [^"]*)"/g;

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

function blocksWithRun(element: ReactElement): (string | undefined)[] {
  return renderToStaticMarkup(element)
    .split(CODE_BLOCK)
    .slice(1)
    .filter((block) => block.includes(RUN_BUTTON))
    .map((block) => LANGUAGE.exec(block)?.[1]);
}

const fence = (language: string, code = "print(1)") =>
  `\`\`\`${language}\n${code}\n\`\`\``;

describe("Run in code blocks", () => {
  const fences = [
    "js",
    "javascript",
    "ts",
    "typescript",
    "py",
    "python",
    "python3",
    "bash",
    "json",
    "Python",
    "jsx",
    "",
  ]
    .map((language) => fence(language))
    .join("\n\nText.\n\n");

  test("adds Run only to JavaScript, TypeScript, and Python fences", () => {
    expect(blocksWithRun(<Markdown runnable>{fences}</Markdown>)).toEqual([
      "js",
      "javascript",
      "ts",
      "typescript",
      "py",
      "python",
      "python3",
    ]);
  });

  test("adds no Run outside replies and the document sheet", () => {
    expect(blocksWithRun(<Markdown>{fences}</Markdown>)).toEqual([]);
  });

  test("keeps Run on closed fences inside lists and quotes", () => {
    const markdown = [
      "1. Install it:",
      "",
      "   ```js",
      "   console.log(1)",
      "   ```",
      "",
      "   - Then:",
      "",
      "     ```py",
      "     print(2)",
      "     ```",
      "",
      "> ```ts",
      "> const n: number = 3;",
      "> ```",
    ].join("\n");
    expect(blocksWithRun(<Markdown runnable>{markdown}</Markdown>)).toEqual([
      "js",
      "py",
      "ts",
    ]);
  });

  test("leaves Run off a fence the reply never closed", () => {
    const stopped = `${fence("js", "console.log(1)")}\n\nNext:\n\n\`\`\`py\nfor i in range(3):\n`;
    expect(blocksWithRun(<Markdown runnable>{stopped}</Markdown>)).toEqual([
      "js",
    ]);
    expect(
      blocksWithRun(
        <Markdown runnable>
          {"> ```py\n> print(1)\n\nAfter the quote."}
        </Markdown>
      )
    ).toEqual([]);
  });

  test("names each Run button after its language and first line of code", () => {
    const markdown = [
      fence(
        "js",
        "// Sum the list\nconsole.log([1, 2].reduce((a, b) => a + b));"
      ),
      fence(
        "py",
        "\nprint('a fairly long line of Python that goes on and on')"
      ),
    ].join("\n\n");
    const html = renderToStaticMarkup(<Markdown runnable>{markdown}</Markdown>);
    expect([...html.matchAll(RUN_NAME)].map((match) => match[1])).toEqual([
      "Run JavaScript: // Sum the list",
      "Run Python: print(&#x27;a fairly long line of Python tha…",
    ]);
  });

  test("leaves Run off a fence that is still streaming", () => {
    expect(
      blocksWithRun(
        <Markdown isStreaming runnable>
          {"Here:\n\n```py\nfor i in range(3):\n"}
        </Markdown>
      )
    ).toEqual([]);
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
