/**
 * Streaming display utilities (U6 + U16).
 *
 * The You Agent embeds machine-directives in its responses as ```json fenced
 * blocks (profile updates, memory saves, private updates, project updates).
 * The full-text parsers in chat.ts / onboarding.ts consume those blocks AFTER
 * the stream completes — but during live streaming the raw blocks used to be
 * written straight to the terminal.
 *
 * This module provides:
 *   1. JsonDirectiveStreamFilter — a pure, incremental transformer that
 *      suppresses ```json directive blocks from DISPLAYED output while the
 *      caller keeps accumulating the raw text for the post-stream parsers.
 *   2. createFilteredStdoutWriter — terminal writer that applies the filter
 *      and shows a dim placeholder when a directive block is being swallowed
 *      and nothing visible has been written yet.
 *   3. streamSSEText — shared SSE reader for /api/v1/chat/stream.
 *   4. streamAssistantTurn — the shared spinner + stream + filter + fallback
 *      helper used by both `youmd chat` and onboarding turns 2+.
 *
 * NOTE: the transformer is mirrored (separate npm package boundaries) in
 * src/hooks/stream-filter.ts for the web You Agent. A parity test in
 * cli/src/__tests__/stream-filter.test.ts asserts the two never drift.
 */

import chalk from "chalk";
import { BrailleSpinner } from "./render";

// ─── Pure incremental ```json directive filter ────────────────────────
//
// Keep this class logic identical to src/hooks/stream-filter.ts.

type FilterState = "text" | "fenceInfo" | "json" | "afterJson" | "code";

/** A fence info-string longer than this can't be a json directive opener. */
const FENCE_INFO_MAX = 64;

export const DIRECTIVE_SWALLOW_PLACEHOLDER = "(updating your profile…)";

/**
 * Incremental transformer: feed(chunk) → displayable text.
 *
 * - Holds back a partial backtick run / undetermined fence opener at the end
 *   of the buffer until disambiguated (fences split across chunk boundaries).
 * - Once inside a ```json fence, swallows everything until the closing fence,
 *   plus the whitespace run immediately after it (so no blank gap remains).
 * - Non-json fences (``` alone or any other language) pass through unchanged.
 * - flush() releases any held-back non-directive text at end of stream.
 */
export class JsonDirectiveStreamFilter {
  private state: FilterState = "text";
  /** Pending backtick run at the end of the buffer (text state). */
  private tickRun = 0;
  /** Held "```<info>" while determining the fence language. */
  private fenceBuf = "";
  /** Match progress for the "\n```" closing fence (json/code states). */
  private closeProgress = 0;
  private blocks = 0;
  private visible = false;
  private swallowedEver = false;

  /** Feed a raw chunk; returns the displayable portion (may be empty). */
  feed(chunk: string): string {
    let out = "";

    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i];

      switch (this.state) {
        case "text": {
          if (ch === "`") {
            this.tickRun++;
            if (this.tickRun === 3) {
              this.tickRun = 0;
              this.state = "fenceInfo";
              this.fenceBuf = "```";
            }
          } else {
            if (this.tickRun > 0) {
              out += "`".repeat(this.tickRun);
              this.tickRun = 0;
            }
            out += ch;
          }
          break;
        }

        case "fenceInfo": {
          if (ch === "\n") {
            const info = this.fenceBuf.slice(3);
            if (/^json[ \t\r]*$/.test(info)) {
              // ```json opener — start swallowing.
              this.state = "json";
              // Treat the opener's newline as a potential close-start so a
              // degenerate "```json\n```" still terminates.
              this.closeProgress = 1;
              this.fenceBuf = "";
              this.blocks++;
              this.swallowedEver = true;
            } else {
              // Plain / other-language fence — passes through unchanged.
              out += this.fenceBuf + "\n";
              this.fenceBuf = "";
              this.state = "code";
              this.closeProgress = 1;
            }
          } else {
            this.fenceBuf += ch;
            if (this.fenceBuf.length > FENCE_INFO_MAX) {
              // Too long to be a fence info-string — release and move on.
              out += this.fenceBuf;
              this.fenceBuf = "";
              this.state = "code";
              this.closeProgress = 0;
            }
          }
          break;
        }

        case "json": {
          // Swallow everything; watch for the "\n```" closing fence.
          if (ch === "\n") {
            this.closeProgress = 1;
          } else if (ch === "`" && this.closeProgress >= 1) {
            this.closeProgress++;
            if (this.closeProgress === 4) {
              this.state = "afterJson";
              this.closeProgress = 0;
            }
          } else {
            this.closeProgress = 0;
          }
          break;
        }

        case "afterJson": {
          // Swallow the whitespace run right after a directive block so the
          // removed block doesn't leave a blank gap in the display.
          if (ch === "\n" || ch === "\r" || ch === " " || ch === "\t") {
            break;
          }
          this.state = "text";
          i--; // reprocess this char in text state
          break;
        }

        case "code": {
          // Inside a non-json fence: pass through, watch for "\n```" close.
          out += ch;
          if (ch === "\n") {
            this.closeProgress = 1;
          } else if (ch === "`" && this.closeProgress >= 1) {
            this.closeProgress++;
            if (this.closeProgress === 4) {
              this.state = "text";
              this.closeProgress = 0;
            }
          } else {
            this.closeProgress = 0;
          }
          break;
        }
      }
    }

    if (!this.visible && /\S/.test(out)) this.visible = true;
    return out;
  }

  /** End of stream: release held-back non-directive text. */
  flush(): string {
    let out = "";
    if (this.tickRun > 0) {
      out += "`".repeat(this.tickRun);
      this.tickRun = 0;
    }
    if (this.state === "fenceInfo") {
      // Stream ended mid fence-opener that never proved to be json — show it.
      out += this.fenceBuf;
      this.fenceBuf = "";
      this.state = "text";
    }
    // json / afterJson: an unterminated directive block stays swallowed —
    // it's machine-directive junk either way.
    if (!this.visible && /\S/.test(out)) this.visible = true;
    return out;
  }

  /** Currently inside a ```json directive block (actively swallowing). */
  get isSwallowing(): boolean {
    return this.state === "json";
  }

  /** At least one ```json directive block was encountered. */
  get hasSwallowedDirective(): boolean {
    return this.swallowedEver;
  }

  /** Some non-whitespace text has been emitted for display. */
  get hasVisibleOutput(): boolean {
    return this.visible;
  }

  /** Number of ```json directive blocks encountered so far. */
  get directiveBlockCount(): number {
    return this.blocks;
  }
}

// ─── Filtered terminal writer ─────────────────────────────────────────

export interface FilteredStreamWriter {
  /** Feed a raw streamed token; writes only the displayable portion. */
  write(token: string): void;
  /** Flush held text and terminate the streamed line(s). */
  finish(): void;
  /** Whether any displayable text was written to the terminal. */
  readonly wroteVisible: boolean;
}

interface MinimalWritable {
  write(text: string): unknown;
}

/**
 * Wrap stdout with the directive filter. Shows a subtle dim placeholder when
 * a ```json block is being swallowed and the response would otherwise look
 * empty mid-stream; clears it the moment real text arrives.
 */
export function createFilteredStdoutWriter(
  opts: { out?: MinimalWritable; indent?: string; placeholder?: string } = {}
): FilteredStreamWriter {
  const out = opts.out ?? process.stdout;
  const indent = opts.indent ?? "  ";
  const placeholder = opts.placeholder ?? DIRECTIVE_SWALLOW_PLACEHOLDER;
  const filter = new JsonDirectiveStreamFilter();
  let placeholderShown = false;
  let startedOutput = false;

  const writeDisplayable = (text: string): void => {
    if (!text) return;
    if (!startedOutput) {
      if (placeholderShown) {
        // Replace the placeholder line with the real response.
        out.write("\r\x1b[2K");
        placeholderShown = false;
      }
      out.write(indent);
      startedOutput = true;
    }
    out.write(text);
  };

  return {
    write(token: string): void {
      writeDisplayable(filter.feed(token));
      // A directive block is being (or was just) swallowed and nothing
      // visible has been written — show the placeholder so the response
      // doesn't look empty/stuck mid-stream.
      if (!startedOutput && !placeholderShown && filter.hasSwallowedDirective) {
        out.write(indent + chalk.dim(placeholder));
        placeholderShown = true;
      }
    },
    finish(): void {
      writeDisplayable(filter.flush());
      if (startedOutput || placeholderShown) out.write("\n");
    },
    get wroteVisible(): boolean {
      return startedOutput;
    },
  };
}

// ─── Shared SSE stream reader ─────────────────────────────────────────

export interface ChatTurnMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Stream a chat response token-by-token from a you.md SSE endpoint.
 * Calls onToken with each RAW text delta (unfiltered — display filtering is
 * the caller's concern) and returns the full assembled raw response.
 */
export async function streamSSEText(
  streamUrl: string,
  messages: ChatTurnMessage[],
  onToken: (text: string) => void,
  timeoutMs = 120_000
): Promise<string> {
  const res = await fetch(streamUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Stream error (${res.status}): ${body}`);
  }
  if (!res.body) {
    throw new Error("No response body from stream endpoint");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  const handleDataLine = (line: string): void => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data: ")) return;
    const data = trimmed.slice(6);
    if (!data || data === "[DONE]") return;
    try {
      const parsed = JSON.parse(data) as { text?: string };
      if (parsed.text) {
        fullText += parsed.text;
        onToken(parsed.text);
      }
    } catch {
      // Skip malformed SSE chunks
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) handleDataLine(line);
  }

  if (buffer.trim()) handleDataLine(buffer);

  return fullText;
}

// ─── Shared spinner + stream + filter + fallback turn helper ──────────

export interface StreamAssistantTurnOptions {
  streamUrl: string;
  messages: ChatTurnMessage[];
  /** BrailleSpinner label shown while waiting for the first token. */
  spinnerLabel: string;
  timeoutMs?: number;
  /** Blocking fallback (e.g. callLLM) used when streaming fails or is empty. */
  fallback?: () => Promise<string>;
  placeholder?: string;
}

/**
 * Run one assistant turn: spinner while waiting for the first token, then
 * live-stream the response with ```json directive blocks filtered out of the
 * display. Returns the FULL RAW response text (directives intact) so the
 * existing post-stream parsers keep working, plus whether it streamed.
 *
 * On stream failure (or an empty stream) falls back to the provided blocking
 * call; in that case `streamed` is false and the caller is expected to render
 * the parsed display text itself.
 */
export async function streamAssistantTurn(
  opts: StreamAssistantTurnOptions
): Promise<{ text: string; streamed: boolean }> {
  const spinner = new BrailleSpinner(opts.spinnerLabel);
  spinner.start();

  const writer = createFilteredStdoutWriter({ placeholder: opts.placeholder });
  let firstToken = true;

  try {
    const response = await streamSSEText(
      opts.streamUrl,
      opts.messages,
      (token) => {
        if (firstToken) {
          // Clear the spinner before writing streamed text.
          spinner.stop();
          firstToken = false;
        }
        writer.write(token);
      },
      opts.timeoutMs ?? 120_000
    );

    if (!firstToken) {
      writer.finish();
      return { text: response, streamed: true };
    }

    // No tokens arrived. Treat as a failure if we can fall back.
    if (!opts.fallback) {
      spinner.stop();
      return { text: response, streamed: false };
    }
    throw new Error("empty stream response");
  } catch (err) {
    if (!opts.fallback) {
      if (firstToken) spinner.stop();
      throw err;
    }

    // Streaming failed — fall back to the blocking call.
    spinner.update("streaming unavailable, waiting for response");
    if (!firstToken) {
      // Spinner was stopped when tokens started flowing; restart it for the
      // fallback wait so the user isn't staring at a dead line.
      spinner.start();
    }

    try {
      const response = await opts.fallback();
      spinner.stop();
      return { text: response, streamed: false };
    } catch (fallbackErr) {
      spinner.fail(fallbackErr instanceof Error ? fallbackErr.message : "failed");
      throw fallbackErr;
    }
  }
}
