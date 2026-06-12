/**
 * Streaming ```json directive filter for the web You Agent (U6).
 *
 * The You Agent embeds machine-directives in its responses as ```json fenced
 * blocks (profile updates, memory saves, private updates). The post-stream
 * parsers in agent-utils.ts consume the RAW text; this filter only shapes
 * what the user SEES while tokens stream into the chat surface.
 *
 * MIRROR NOTE: this class is intentionally a byte-for-byte logic mirror of
 * JsonDirectiveStreamFilter in cli/src/lib/stream.ts (the CLI is a separately
 * published npm package, so we can't share the import). A parity test in
 * cli/src/__tests__/stream-filter.test.ts imports BOTH copies and asserts
 * they never drift. If you change one, change the other.
 */

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
