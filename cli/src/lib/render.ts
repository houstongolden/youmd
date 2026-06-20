/**
 * Rich terminal renderer for CLI — renders structured content blocks
 * using chalk and box-drawing characters. Mirrors the web TerminalBlocks
 * component but for actual terminal output.
 *
 * Supports: tables, stat grids, code blocks, callouts, bar charts,
 * headings, lists, dividers, and inline formatting.
 */

import chalk from "chalk";

const ACCENT = chalk.hex("#C46A3A");
const DIM = chalk.dim;
const SUCCESS = chalk.green;

// Box-drawing characters
const BOX = {
  tl: "\u250C", tr: "\u2510", bl: "\u2514", br: "\u2518",
  h: "\u2500", v: "\u2502",
  lt: "\u251C", rt: "\u2524", tt: "\u252C", bt: "\u2534",
  cross: "\u253C",
};

/* -- ANSI-aware width helpers ------------------------------- */

const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

/** Strip ANSI escape codes so we can measure visible width. */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, "");
}

/** Visible (ANSI-stripped) length of a string. */
export function visibleLength(text: string): number {
  return stripAnsi(text).length;
}

/**
 * padEnd that pads based on VISIBLE length. Plain String.padEnd counts
 * ANSI escape bytes, which under-pads colored text and breaks box/panel
 * alignment.
 */
export function padEndVisible(text: string, width: number): string {
  const pad = width - visibleLength(text);
  return pad > 0 ? text + " ".repeat(pad) : text;
}

/* -- TTY guard for interactive flows ------------------------ */

/**
 * Guard interactive commands against piped/CI stdin. Without a TTY,
 * readline prompts hang or consume the pipe; fail fast with one
 * machine-readable line instead.
 */
export function requireInteractiveTTY(): void {
  if (!process.stdin.isTTY) {
    console.error(
      "error: interactive terminal required -- use `youmd login --key <key>` or YOU_API_KEY env var"
    );
    process.exit(1);
  }
}

/* ── Block parsing ─────────────────────────────────────────── */

interface TextBlock { type: "text"; lines: string[] }
interface CodeBlock { type: "code"; lang?: string; content: string }
interface TableBlock { type: "table"; headers: string[]; rows: string[][] }
interface StatsBlock { type: "stats"; items: { label: string; value: string }[] }
interface CalloutBlock { type: "callout"; content: string }
interface HeadingBlock { type: "heading"; level: number; text: string }
interface ListBlock { type: "list"; items: string[] }
interface DividerBlock { type: "divider" }

type Block = TextBlock | CodeBlock | TableBlock | StatsBlock | CalloutBlock | HeadingBlock | ListBlock | DividerBlock;

export function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  const lines = content.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim() || undefined;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ type: "code", lang, content: codeLines.join("\n") });
      continue;
    }

    // Heading
    if (line.match(/^#{1,3}\s/)) {
      const level = line.match(/^(#+)/)![1].length;
      const text = line.replace(/^#+\s*/, "");
      blocks.push({ type: "heading", level, text });
      i++;
      continue;
    }

    // Divider
    if (line.match(/^[-=]{3,}$/)) {
      blocks.push({ type: "divider" });
      i++;
      continue;
    }

    // Table
    if (line.includes("|") && line.trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      const parsed = parseTable(tableLines);
      if (parsed) { blocks.push(parsed); continue; }
      i -= tableLines.length;
    }

    // Stats line
    if (line.includes("|") && !line.startsWith("|") && line.split("|").every(p => p.includes(":"))) {
      const items = line.split("|").map(p => {
        const [label, ...rest] = p.split(":");
        return { label: label.trim(), value: rest.join(":").trim() };
      }).filter(item => item.label && item.value);
      if (items.length >= 2) {
        blocks.push({ type: "stats", items });
        i++;
        continue;
      }
    }

    // Callout
    if (line.startsWith("> ")) {
      const calloutLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        calloutLines.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ type: "callout", content: calloutLines.join("\n") });
      continue;
    }

    // List
    if (line.match(/^\s*[-*]\s/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\s*[-*]\s/)) {
        items.push(lines[i].replace(/^\s*[-*]\s/, ""));
        i++;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    // Plain text
    const textLines: string[] = [];
    while (
      i < lines.length &&
      !lines[i].startsWith("```") &&
      !lines[i].match(/^#{1,3}\s/) &&
      !lines[i].match(/^[-=]{3,}$/) &&
      !(lines[i].includes("|") && lines[i].trim().startsWith("|")) &&
      !lines[i].startsWith("> ") &&
      !lines[i].match(/^\s*[-*]\s/)
    ) {
      textLines.push(lines[i]);
      i++;
    }
    if (textLines.length > 0) {
      blocks.push({ type: "text", lines: textLines });
    }
  }

  return blocks;
}

/** Word-wrap text to fit terminal width, preserving indent */
function wordWrap(text: string, maxWidth: number, indent: string = "  "): string {
  if (!text.trim()) return "";
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = indent;

  for (const word of words) {
    // Strip ANSI codes for length calculation
    const plainCurrent = stripAnsi(currentLine);
    const plainWord = stripAnsi(word);

    if (plainCurrent.length + plainWord.length + 1 > maxWidth && plainCurrent.trim().length > 0) {
      lines.push(currentLine);
      currentLine = indent + word;
    } else {
      currentLine += (plainCurrent.trim().length > 0 ? " " : "") + word;
    }
  }
  if (currentLine.trim().length > 0) lines.push(currentLine);
  return lines.join("\n");
}

function getTerminalWidth(): number {
  try {
    return process.stdout.columns || 80;
  } catch {
    return 80;
  }
}

function parseTable(lines: string[]): TableBlock | null {
  if (lines.length < 2) return null;
  const parseCells = (line: string) => line.split("|").map(c => c.trim()).filter(c => c.length > 0);
  const headers = parseCells(lines[0]);
  if (headers.length === 0) return null;
  let dataStart = 1;
  if (lines[1]?.match(/^[\s|:-]+$/)) dataStart = 2;
  const rows = lines.slice(dataStart).map(parseCells);
  return { type: "table", headers, rows };
}

/* ── Formatters ────────────────────────────────────────────── */

function formatInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, (_, t) => chalk.white(t))
    .replace(/\*(.+?)\*/g, (_, t) => DIM(t))
    .replace(/`([^`]+)`/g, (_, t) => ACCENT(t));
}

function renderTable(headers: string[], rows: string[][]): string {
  // Column widths are computed from VISIBLE lengths (post-inline-format,
  // ANSI stripped) so colored cells don't break alignment.
  const widths = headers.map((h, i) => {
    const cellWidths = rows.map(r => visibleLength(formatInline(r[i] || "")));
    return Math.max(h.length, ...cellWidths) + 2;
  });

  const line = (left: string, mid: string, right: string, fill: string) =>
    left + widths.map(w => fill.repeat(w)).join(mid) + right;

  const row = (cells: string[]) =>
    BOX.v + cells.map((c, i) => ` ${padEndVisible(c, widths[i] - 1)}`).join(BOX.v) + BOX.v;

  const out: string[] = [];
  out.push(DIM(line(BOX.tl, BOX.tt, BOX.tr, BOX.h)));
  out.push(row(headers.map(h => ACCENT(h))));
  out.push(DIM(line(BOX.lt, BOX.cross, BOX.rt, BOX.h)));
  for (const r of rows) {
    out.push(row(r.map(c => formatInline(c))));
  }
  out.push(DIM(line(BOX.bl, BOX.bt, BOX.br, BOX.h)));
  return out.join("\n");
}

function renderStats(items: { label: string; value: string }[]): string {
  const maxLabel = Math.max(...items.map(i => i.label.length));
  return items.map(item => {
    const isAccent = item.value.startsWith("+") || item.value.startsWith("$") || item.value.endsWith("%");
    const val = isAccent ? ACCENT(item.value) : chalk.white(item.value);
    return `  ${DIM(item.label.padEnd(maxLabel))}  ${val}`;
  }).join("\n");
}

function renderCodeBlock(content: string, lang?: string): string {
  const lines = content.split("\n");
  const width = Math.max(40, ...lines.map(l => l.length)) + 4;
  const out: string[] = [];
  const top = DIM(BOX.tl + BOX.h.repeat(width - 2) + BOX.tr);
  const bot = DIM(BOX.bl + BOX.h.repeat(width - 2) + BOX.br);

  out.push(top);
  if (lang) {
    out.push(DIM(BOX.v) + padEndVisible(` ${DIM(lang)}`, width - 2) + DIM(BOX.v));
    out.push(DIM(BOX.lt + BOX.h.repeat(width - 2) + BOX.rt));
  }
  for (const line of lines) {
    out.push(DIM(BOX.v) + padEndVisible(` ${ACCENT(line)}`, width - 2) + DIM(BOX.v));
  }
  out.push(bot);
  return out.join("\n");
}


/* ── Main renderer ─────────────────────────────────────────── */

/**
 * Render a rich-formatted agent response for the terminal.
 * Parses markdown-like content into structured blocks and outputs
 * with chalk styling, box-drawing chars, and terminal-native formatting.
 */
export function renderRichResponse(content: string): string {
  const blocks = parseBlocks(content);
  const parts: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "text": {
        const width = getTerminalWidth() - 2; // account for indent
        parts.push(block.lines.map(l => {
          if (!l.trim()) return "";
          const formatted = formatInline(l);
          return wordWrap(formatted, width);
        }).join("\n"));
        break;
      }
      case "code":
        parts.push(renderCodeBlock(block.content, block.lang));
        break;
      case "table":
        parts.push(renderTable(block.headers, block.rows));
        break;
      case "stats":
        parts.push(renderStats(block.items));
        break;
      case "callout": {
        const cw = getTerminalWidth() - 6;
        parts.push(wordWrap(`${ACCENT(BOX.v)} ${formatInline(block.content)}`, cw, `  ${ACCENT(BOX.v)} `));
        break;
      }
      case "heading":
        if (block.level === 1) {
          parts.push(`\n  ${chalk.white.bold(block.text)}`);
        } else {
          parts.push(`\n  ${ACCENT(">")} ${ACCENT(block.text.toUpperCase())}`);
        }
        break;
      case "list": {
        const lw = getTerminalWidth() - 6;
        parts.push(block.items.map(item => wordWrap(`${ACCENT("\u203A")} ${formatInline(item)}`, lw, `    `)).join("\n"));
        break;
      }
      case "divider":
        parts.push(DIM("  " + BOX.h.repeat(40)));
        break;
    }
  }

  return parts.join("\n");
}

// Orange color palette for spinner rotation (dark to light)
const ORANGE_SHADES = [
  "#7A3A1A", "#8A4220", "#9A4A28", "#AA5230", "#BA5A35",
  "#C46A3A", "#D07040", "#DC7848", "#E88050", "#F0885A",
  "#E88050", "#DC7848", "#D07040", "#C46A3A", "#BA5A35",
  "#AA5230", "#9A4A28", "#8A4220",
];

/**
 * Braille spinner with color rotation + text lightsweep.
 * Inspired by Claude Code's spinner aesthetic.
 */
export class BrailleSpinner {
  /**
   * Minimum visible time for a started spinner. Real operations keep their
   * real duration; sub-250ms operations hold the final frame briefly so the
   * spinner reads as a state change instead of a flash. This replaces the
   * old pattern of sprinkling fake `setTimeout` delays around fast work.
   */
  private static readonly MIN_DISPLAY_MS = 250;

  private frames = ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"];
  private frameIndex = 0;
  private colorIndex = 0;
  private sweepPos = 0;
  private interval: ReturnType<typeof setInterval> | null = null;
  private label: string;
  private startTime: number = 0;

  constructor(label: string) {
    this.label = label;
  }

  start(): void {
    this.startTime = Date.now();
    this.interval = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
      this.colorIndex = (this.colorIndex + 1) % ORANGE_SHADES.length;
      this.sweepPos = (this.sweepPos + 1) % (this.label.length + 6);

      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const time = elapsed >= 2 ? DIM(` ${elapsed}s`) : "";

      // Rotating color on the braille character
      const spinnerChar = chalk.hex(ORANGE_SHADES[this.colorIndex])(this.frames[this.frameIndex]);

      // Lightsweep on label text — a bright spot that moves across
      let labelStr = "";
      for (let i = 0; i < this.label.length; i++) {
        const dist = Math.abs(i - this.sweepPos);
        if (dist === 0) {
          labelStr += chalk.hex("#F0885A")(this.label[i]); // brightest
        } else if (dist === 1) {
          labelStr += chalk.hex("#D07040")(this.label[i]); // medium bright
        } else if (dist === 2) {
          labelStr += chalk.hex("#AA5230")(this.label[i]); // slight glow
        } else {
          labelStr += DIM(this.label[i]); // base dim
        }
      }

      process.stdout.write(`\r  ${spinnerChar} ${labelStr}${time}  `);
    }, 80);
  }

  /**
   * Swap the label without resetting the elapsed timer — label rotations
   * are cosmetic; the operation is still the same one that started.
   * Pass `resetTimer: true` when a genuinely new phase begins.
   */
  update(label: string, options: { resetTimer?: boolean } = {}): void {
    this.label = label;
    this.sweepPos = this.sweepPos % (label.length + 6);
    if (options.resetTimer) {
      this.startTime = Date.now();
    }
  }

  /**
   * Synchronously hold the last frame until MIN_DISPLAY_MS has elapsed
   * since start(). Synchronous (Atomics.wait) so the 69 existing
   * `spinner.stop()` call sites keep their output ordering without
   * becoming async.
   */
  private blockUntilMinDisplay(): void {
    if (this.startTime <= 0) return; // never started — nothing to smooth
    const remaining = BrailleSpinner.MIN_DISPLAY_MS - (Date.now() - this.startTime);
    if (remaining <= 0) return;
    try {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, remaining);
    } catch {
      // SharedArrayBuffer unavailable — skip the hold
    }
  }

  stop(result?: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.blockUntilMinDisplay();
    }
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const time = elapsed >= 1 ? DIM(` ${elapsed}s`) : "";
    if (result) {
      process.stdout.write(`\r  ${SUCCESS("\u2713")} ${DIM(this.label)}${time} ${DIM(result)}\n`);
    } else {
      process.stdout.write(`\r  ${SUCCESS("\u2713")} ${DIM(this.label)}${time}\n`);
    }
  }

  fail(detail?: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    process.stdout.write(`\r  ${ACCENT("\u2717")} ${DIM(this.label)} ${detail ? ACCENT(detail) : ""}\n`);
  }
}
