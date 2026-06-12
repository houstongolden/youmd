import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import chalk from "chalk";
import {
  stripAnsi,
  visibleLength,
  padEndVisible,
  renderRichResponse,
  BrailleSpinner,
} from "../lib/render";

const ANSI = /\x1b\[[0-9;]*m/;

describe("ANSI-aware width helpers", () => {
  const originalLevel = chalk.level;

  beforeEach(() => {
    // Vitest runs without a TTY, so chalk disables color by default —
    // force it on so these tests actually exercise ANSI handling.
    chalk.level = 3;
  });

  afterEach(() => {
    chalk.level = originalLevel;
  });

  it("stripAnsi removes escape codes, visibleLength measures what's shown", () => {
    const colored = chalk.hex("#C46A3A")("hello");
    expect(colored).toMatch(ANSI); // sanity: color is actually on
    expect(stripAnsi(colored)).toBe("hello");
    expect(visibleLength(colored)).toBe(5);
    expect(colored.length).toBeGreaterThan(5);
  });

  it("padEndVisible pads colored text to the same visible width as plain text", () => {
    const plain = padEndVisible("hi", 10);
    const colored = padEndVisible(chalk.green("hi"), 10);
    expect(visibleLength(plain)).toBe(10);
    expect(visibleLength(colored)).toBe(10);
  });

  it("padEndVisible never truncates text wider than the target", () => {
    expect(padEndVisible("longtext", 4)).toBe("longtext");
  });

  it("renders tables with colored cells at uniform visible width", () => {
    const content = [
      "| name | status |",
      "| --- | --- |",
      "| **alpha service** | `live` |",
      "| beta | done |",
    ].join("\n");

    const out = renderRichResponse(content);
    expect(out).toMatch(ANSI); // colors present, so padding is non-trivial
    const lines = out.split("\n").filter((l) => l.trim().length > 0);
    const widths = lines.map((l) => visibleLength(l));
    expect(new Set(widths).size).toBe(1);
  });

  it("renders code blocks with a flush right border", () => {
    const content = ["```bash", "youmd whoami", "echo done", "```"].join("\n");
    const out = renderRichResponse(content);
    expect(out).toMatch(ANSI);
    const lines = out.split("\n").filter((l) => l.trim().length > 0);
    const widths = lines.map((l) => visibleLength(l));
    expect(new Set(widths).size).toBe(1);
  });
});

describe("BrailleSpinner elapsed timer", () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
    writeSpy.mockRestore();
  });

  it("update() preserves the start time across label rotations", () => {
    const spinner = new BrailleSpinner("first label");
    spinner.start();

    vi.advanceTimersByTime(3000);
    spinner.update("second label");
    vi.advanceTimersByTime(2000);
    spinner.stop();

    const finalWrite = String(writeSpy.mock.calls.at(-1)?.[0]);
    // 3s + 2s of continuous work — the timer must not reset on update()
    expect(stripAnsi(finalWrite)).toContain("5s");
  });

  it("update() resets the timer only when explicitly asked", () => {
    const spinner = new BrailleSpinner("first label");
    spinner.start();

    vi.advanceTimersByTime(4000);
    spinner.update("new phase", { resetTimer: true });
    spinner.stop();

    const finalWrite = String(writeSpy.mock.calls.at(-1)?.[0]);
    expect(stripAnsi(finalWrite)).not.toContain("4s");
  });
});

describe("BrailleSpinner minimum display time", () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it("stop() holds a sub-250ms spinner so it doesn't flash", () => {
    const spinner = new BrailleSpinner("quick op");
    spinner.start();
    const before = Date.now();
    spinner.stop("done");
    const elapsed = Date.now() - before;
    // ~250ms minimum display, with a little scheduling slack
    expect(elapsed).toBeGreaterThanOrEqual(200);
  });

  it("stop() adds no extra hold once the minimum has elapsed", async () => {
    const spinner = new BrailleSpinner("slow op");
    spinner.start();
    await new Promise((r) => setTimeout(r, 300));
    const before = Date.now();
    spinner.stop("done");
    expect(Date.now() - before).toBeLessThan(100);
  });

  it("stop() on a never-started spinner returns immediately", () => {
    const spinner = new BrailleSpinner("never started");
    const before = Date.now();
    spinner.stop();
    expect(Date.now() - before).toBeLessThan(100);
  });
});
