/**
 * U6 — streamed ```json directive filtering.
 *
 * Unit tests for the pure incremental transformer that suppresses ```json
 * directive blocks (profile updates, memory saves, private updates) from the
 * DISPLAYED stream while callers keep the raw text for the post-stream
 * parsers.
 *
 * Also a parity suite: the web You Agent ships a mirrored copy of the
 * transformer (separate npm package boundary — src/hooks/stream-filter.ts).
 * The root repo has no web test runner (vitest there is scoped to convex/),
 * so these CLI tests import BOTH copies and assert they never drift on
 * shared fixtures across every chunk-split position.
 */
import { describe, expect, it } from "vitest";

import {
  DIRECTIVE_SWALLOW_PLACEHOLDER,
  JsonDirectiveStreamFilter as CliFilter,
  createFilteredStdoutWriter,
} from "../lib/stream";

import { JsonDirectiveStreamFilter as WebFilter } from "../../../src/hooks/stream-filter";

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface FilterLike {
  feed(chunk: string): string;
  flush(): string;
}

type FilterCtor = new () => FilterLike;

function runChunks(Ctor: FilterCtor, chunks: string[]): string {
  const filter = new Ctor();
  let out = "";
  for (const chunk of chunks) out += filter.feed(chunk);
  out += filter.flush();
  return out;
}

function runWhole(Ctor: FilterCtor, text: string): string {
  return runChunks(Ctor, [text]);
}

function runCharByChar(Ctor: FilterCtor, text: string): string {
  return runChunks(Ctor, text.split(""));
}

// ─── Fixtures (shared by unit + parity suites) ───────────────────────────────

const DIRECTIVE_BLOCK =
  '```json\n{"updates": [{"section": "profile/projects.md", "content": "# Projects"}]}\n```';

const FIXTURES: Array<{ name: string; input: string; expected: string }> = [
  {
    name: "json fence swallowed (text-json-text interleave)",
    input: `noted — updating your projects now.\n\n${DIRECTIVE_BLOCK}\n\nanything else?`,
    expected: "noted — updating your projects now.\n\nanything else?",
  },
  {
    name: "whole response is a directive block",
    input: '```json\n{"memory_saves": [{"category": "fact", "content": "based in miami"}]}\n```',
    expected: "",
  },
  {
    name: "directive block at end of response",
    input: `captured that.\n\n${DIRECTIVE_BLOCK}`,
    expected: "captured that.\n\n",
  },
  {
    name: "non-json fence passes through unchanged",
    input: "here:\n```python\nprint('hi')\n```\nrun it.",
    expected: "here:\n```python\nprint('hi')\n```\nrun it.",
  },
  {
    name: "bare ``` fence passes through unchanged",
    input: "```\nplain code\n```\ndone",
    expected: "```\nplain code\n```\ndone",
  },
  {
    name: "js fence (prefix of 'json') passes through unchanged",
    input: "```js\nconst x = 1\n```",
    expected: "```js\nconst x = 1\n```",
  },
  {
    name: "jsonc fence (json + extra chars) passes through unchanged",
    input: "```jsonc\n// comment\n```",
    expected: "```jsonc\n// comment\n```",
  },
  {
    name: "inline single backticks pass through",
    input: "run `youmd sync` then `you`",
    expected: "run `youmd sync` then `you`",
  },
  {
    name: "trailing partial backticks released by flush",
    input: "ends with ``",
    expected: "ends with ``",
  },
  {
    name: "multiple directive blocks interleaved with text",
    input: 'a\n```json\n{"x":1}\n```\nb\n```json\n{"y":2}\n```\nc',
    expected: "a\nb\nc",
  },
  {
    name: "json fence with trailing space on the opener line",
    input: "save\n```json \n{}\n```",
    expected: "save\n",
  },
  {
    name: "unterminated json fence stays swallowed",
    input: 'text\n```json\n{"a": 1',
    expected: "text\n",
  },
  {
    name: "stream ending mid fence-opener releases held text",
    input: "see ```py",
    expected: "see ```py",
  },
];

// ─── Unit: CLI transformer ───────────────────────────────────────────────────

describe("JsonDirectiveStreamFilter — whole-string fixtures", () => {
  for (const { name, input, expected } of FIXTURES) {
    it(name, () => {
      expect(runWhole(CliFilter, input)).toBe(expected);
    });
  }
});

describe("JsonDirectiveStreamFilter — chunk boundary handling", () => {
  it("produces identical output for every 2-chunk split position (json fixture)", () => {
    const { input, expected } = FIXTURES[0];
    for (let i = 0; i <= input.length; i++) {
      const out = runChunks(CliFilter, [input.slice(0, i), input.slice(i)]);
      expect(out, `split at ${i}`).toBe(expected);
    }
  });

  it("produces identical output for every 2-chunk split position (non-json fence)", () => {
    const { input, expected } = FIXTURES[3];
    for (let i = 0; i <= input.length; i++) {
      const out = runChunks(CliFilter, [input.slice(0, i), input.slice(i)]);
      expect(out, `split at ${i}`).toBe(expected);
    }
  });

  it("produces identical output for every 2-chunk split position (multiple blocks)", () => {
    const fixture = FIXTURES.find((f) => f.name.startsWith("multiple directive"))!;
    for (let i = 0; i <= fixture.input.length; i++) {
      const out = runChunks(CliFilter, [fixture.input.slice(0, i), fixture.input.slice(i)]);
      expect(out, `split at ${i}`).toBe(fixture.expected);
    }
  });

  it("handles fully char-by-char streaming for all fixtures", () => {
    for (const { name, input, expected } of FIXTURES) {
      expect(runCharByChar(CliFilter, input), name).toBe(expected);
    }
  });

  it("holds back a partial backtick run at a chunk boundary", () => {
    const filter = new CliFilter();
    expect(filter.feed("hello ``")).toBe("hello ");
    // Third backtick arrives → fence opener; "json\n" resolves it → swallow
    expect(filter.feed("`json\n{}")).toBe("");
    expect(filter.feed("\n```")).toBe("");
    expect(filter.feed("\nafter")).toBe("after");
    expect(filter.flush()).toBe("");
  });

  it("releases a partial backtick run when it turns out to be inline code", () => {
    const filter = new CliFilter();
    expect(filter.feed("use `")).toBe("use ");
    expect(filter.feed("`x`` ok")).toBe("``x`` ok");
    expect(filter.flush()).toBe("");
  });
});

describe("JsonDirectiveStreamFilter — state getters", () => {
  it("reports swallowing while inside a directive block", () => {
    const filter = new CliFilter();
    filter.feed("```json\n{\"a\":");
    expect(filter.isSwallowing).toBe(true);
    expect(filter.hasSwallowedDirective).toBe(true);
    expect(filter.hasVisibleOutput).toBe(false);
    filter.feed("1}\n```");
    expect(filter.isSwallowing).toBe(false);
    expect(filter.hasSwallowedDirective).toBe(true);
  });

  it("counts directive blocks", () => {
    const filter = new CliFilter();
    filter.feed('a\n```json\n{"x":1}\n```\nb\n```json\n{"y":2}\n```\nc');
    expect(filter.directiveBlockCount).toBe(2);
  });

  it("does not flag visible output for whitespace-only emission", () => {
    const filter = new CliFilter();
    filter.feed("\n\n");
    expect(filter.hasVisibleOutput).toBe(false);
    filter.feed("x");
    expect(filter.hasVisibleOutput).toBe(true);
  });
});

// ─── Parity: web mirror must match the CLI transformer ───────────────────────

describe("web/CLI transformer parity (src/hooks/stream-filter.ts mirror)", () => {
  it("matches on all fixtures, whole-string and char-by-char", () => {
    for (const { name, input } of FIXTURES) {
      expect(runWhole(WebFilter, input), `${name} (whole)`).toBe(runWhole(CliFilter, input));
      expect(runCharByChar(WebFilter, input), `${name} (chars)`).toBe(
        runCharByChar(CliFilter, input)
      );
    }
  });

  it("matches across every 2-chunk split position of the json fixture", () => {
    const { input } = FIXTURES[0];
    for (let i = 0; i <= input.length; i++) {
      const chunks = [input.slice(0, i), input.slice(i)];
      expect(runChunks(WebFilter, chunks), `split at ${i}`).toBe(runChunks(CliFilter, chunks));
    }
  });

  it("matches state getters mid-stream", () => {
    const cli = new CliFilter();
    const web = new WebFilter();
    const pieces = ["before ", "``", "`js", "on\n{\"upd", "ates\":[]}", "\n``", "`\n\nafter"];
    for (const piece of pieces) {
      expect(web.feed(piece)).toBe(cli.feed(piece));
      expect(web.isSwallowing).toBe(cli.isSwallowing);
      expect(web.hasSwallowedDirective).toBe(cli.hasSwallowedDirective);
      expect(web.hasVisibleOutput).toBe(cli.hasVisibleOutput);
      expect(web.directiveBlockCount).toBe(cli.directiveBlockCount);
    }
    expect(web.flush()).toBe(cli.flush());
  });
});

// ─── Filtered stdout writer (placeholder behavior) ───────────────────────────

class MockOut {
  buf = "";
  write(text: string): boolean {
    this.buf += text;
    return true;
  }
}

describe("createFilteredStdoutWriter — placeholder behavior", () => {
  it("shows the dim placeholder when the response is only a directive block", () => {
    const out = new MockOut();
    const writer = createFilteredStdoutWriter({ out });
    writer.write("```json\n");
    writer.write('{"updates": []}');
    writer.write("\n```");
    writer.finish();
    expect(out.buf).toContain(DIRECTIVE_SWALLOW_PLACEHOLDER);
    expect(out.buf).not.toContain('{"updates"');
    expect(out.buf.endsWith("\n")).toBe(true);
    expect(writer.wroteVisible).toBe(false);
  });

  it("clears the placeholder when visible text follows a leading directive", () => {
    const out = new MockOut();
    const writer = createFilteredStdoutWriter({ out });
    writer.write('```json\n{"updates": []}\n```\n\n');
    expect(out.buf).toContain(DIRECTIVE_SWALLOW_PLACEHOLDER);
    writer.write("done — profile updated.");
    writer.finish();
    expect(out.buf).toContain("\r\x1b[2K"); // placeholder line cleared
    expect(out.buf).toContain("done — profile updated.");
    expect(writer.wroteVisible).toBe(true);
  });

  it("never shows the placeholder for a plain text stream", () => {
    const out = new MockOut();
    const writer = createFilteredStdoutWriter({ out });
    writer.write("hello ");
    writer.write("there");
    writer.finish();
    expect(out.buf).not.toContain(DIRECTIVE_SWALLOW_PLACEHOLDER);
    expect(out.buf).toBe("  hello there\n");
  });

  it("does not show the placeholder when text streamed before the directive", () => {
    const out = new MockOut();
    const writer = createFilteredStdoutWriter({ out });
    writer.write("captured.\n\n");
    writer.write('```json\n{"memory_saves": []}\n```');
    writer.finish();
    expect(out.buf).not.toContain(DIRECTIVE_SWALLOW_PLACEHOLDER);
    expect(out.buf).toBe("  captured.\n\n\n");
  });

  it("writes nothing at all for an empty stream", () => {
    const out = new MockOut();
    const writer = createFilteredStdoutWriter({ out });
    writer.finish();
    expect(out.buf).toBe("");
  });
});
