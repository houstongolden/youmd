"use client";

/**
 * Rich terminal block renderer — parses markdown-like content from agent responses
 * and renders them as polished terminal components (tables, stat grids, code blocks,
 * callouts, horizontal bars, section headers).
 *
 * Inspired by Vercel Labs json-render TUI. Designed to make the web dashboard
 * feel like a real CLI with rich formatted output.
 */

import { type ReactNode, useState, useCallback } from "react";
import AsciiAvatar from "@/components/AsciiAvatar";

/* ── Block Types ──────────────────────────────────────────── */

type Block =
  | { type: "text"; lines: string[] }
  | { type: "code"; lang?: string; content: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "stats"; items: { label: string; value: string; accent?: boolean }[] }
  | { type: "bar"; items: { label: string; value: number; max: number }[] }
  | { type: "callout"; kind: "info" | "warn" | "success"; content: string }
  | { type: "heading"; level: number; text: string }
  | { type: "divider" }
  | { type: "list"; items: string[] }
  | { type: "image"; alt: string; url: string };

/* ── Parser ───────────────────────────────────────────────── */

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
      i++; // skip closing ```
      blocks.push({ type: "code", lang, content: codeLines.join("\n") });
      continue;
    }

    // Heading (## or ###)
    if (line.match(/^#{1,3}\s/)) {
      const level = line.match(/^(#+)/)![1].length;
      const text = line.replace(/^#+\s*/, "");
      blocks.push({ type: "heading", level, text });
      i++;
      continue;
    }

    // Horizontal rule
    if (line.match(/^[-=]{3,}$/)) {
      blocks.push({ type: "divider" });
      i++;
      continue;
    }

    // Table — detect pipe-delimited lines
    if (line.includes("|") && line.trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      const parsed = parseTable(tableLines);
      if (parsed) {
        blocks.push(parsed);
        continue;
      }
      // Failed to parse as table, fall through to text
      i -= tableLines.length;
    }

    // Stats line — "label: value | label: value | ..."
    if (line.includes("|") && !line.startsWith("|") && line.split("|").every(p => p.includes(":"))) {
      const items = line.split("|").map(p => {
        const [label, ...rest] = p.split(":");
        const value = rest.join(":").trim();
        const accent = value.startsWith("+") || value.startsWith("$") || value.endsWith("%");
        return { label: label.trim(), value, accent };
      }).filter(item => item.label && item.value);
      if (items.length >= 2) {
        blocks.push({ type: "stats", items });
        i++;
        continue;
      }
    }

    // Callout — > **Note:** or > **Warning:** or lines starting with >
    if (line.startsWith("> ")) {
      const calloutLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        calloutLines.push(lines[i].slice(2));
        i++;
      }
      const text = calloutLines.join("\n");
      const kind = text.toLowerCase().includes("warning") || text.toLowerCase().includes("warn")
        ? "warn" as const
        : text.toLowerCase().includes("success") || text.toLowerCase().includes("done")
          ? "success" as const
          : "info" as const;
      blocks.push({ type: "callout", kind, content: text });
      continue;
    }

    // Image — ![alt](url)
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (imgMatch) {
      blocks.push({ type: "image", alt: imgMatch[1], url: imgMatch[2] });
      i++;
      continue;
    }

    // Bullet list — consecutive lines starting with - or *
    if (line.match(/^\s*[-*]\s/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\s*[-*]\s/)) {
        items.push(lines[i].replace(/^\s*[-*]\s/, ""));
        i++;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    // Plain text — collect consecutive non-special lines
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

function parseTable(lines: string[]): Block | null {
  if (lines.length < 2) return null;

  const parseCells = (line: string) =>
    line.split("|").map(c => c.trim()).filter(c => c.length > 0);

  const headers = parseCells(lines[0]);
  if (headers.length === 0) return null;

  // Skip separator line (---|---|---)
  let dataStart = 1;
  if (lines[1] && lines[1].match(/^[\s|:-]+$/)) {
    dataStart = 2;
  }

  const rows = lines.slice(dataStart).map(parseCells);
  return { type: "table", headers, rows };
}

/* ── Renderers ────────────────────────────────────────────── */

export function RichTerminalContent({ content }: { content: string }) {
  const blocks = parseBlocks(content);
  return (
    <div className="space-y-2">
      {blocks.map((block, i) => (
        <BlockRenderer key={i} block={block} />
      ))}
    </div>
  );
}

function BlockRenderer({ block }: { block: Block }): ReactNode {
  switch (block.type) {
    case "text":
      return <TextBlock lines={block.lines} />;
    case "code":
      return <CodeBlock lang={block.lang} content={block.content} />;
    case "table":
      return <TableBlock headers={block.headers} rows={block.rows} />;
    case "stats":
      return <StatsBlock items={block.items} />;
    case "bar":
      return <BarBlock items={block.items} />;
    case "callout":
      return <CalloutBlock kind={block.kind} content={block.content} />;
    case "heading":
      return <HeadingBlock level={block.level} text={block.text} />;
    case "divider":
      return <div className="h-px bg-[hsl(var(--border))] my-2" />;
    case "list":
      return <ListBlock items={block.items} />;
    case "image":
      return <ImageBlock alt={block.alt} url={block.url} />;
    default:
      return null;
  }
}

function TextBlock({ lines }: { lines: string[] }) {
  return (
    <>
      {lines.map((line, i) => {
        if (!line.trim()) return <br key={i} />;
        return <div key={i}>{formatInline(line)}</div>;
      })}
    </>
  );
}

function CodeBlock({ lang, content }: { lang?: string; content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [content]);

  return (
    <div className="my-2 border border-[hsl(var(--border))] overflow-hidden relative group" style={{ borderRadius: "2px" }}>
      {lang && (
        <div className="bg-[hsl(var(--bg))] border-b border-[hsl(var(--border))] px-3 py-1 flex items-center justify-between">
          <span className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-40">{lang}</span>
          <button
            onClick={handleCopy}
            className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-0 group-hover:opacity-50 hover:!opacity-80 transition-opacity cursor-pointer"
          >
            {copied ? "copied" : "copy"}
          </button>
        </div>
      )}
      {!lang && (
        <button
          onClick={handleCopy}
          className="absolute top-1.5 right-2 text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-0 group-hover:opacity-50 hover:!opacity-80 transition-opacity cursor-pointer"
        >
          {copied ? "copied" : "copy"}
        </button>
      )}
      <pre className="bg-[hsl(var(--bg))] px-3 py-2 text-[11px] font-mono text-[hsl(var(--accent-mid))] leading-relaxed whitespace-pre-wrap break-words overflow-hidden">
        {content}
      </pre>
    </div>
  );
}

function TableBlock({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="my-2 border border-[hsl(var(--border))] overflow-x-auto" style={{ borderRadius: "2px" }}>
      <table className="w-full text-[12px] font-mono">
        <thead>
          <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--bg))]">
            {headers.map((h, i) => (
              <th key={i} className="text-left px-3 py-1.5 text-[hsl(var(--accent))] font-normal whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i < rows.length - 1 ? "border-b border-[hsl(var(--border))]/30" : ""}>
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-1.5 text-[hsl(var(--text-secondary))] opacity-80 whitespace-nowrap">
                  {formatInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatsBlock({ items }: { items: { label: string; value: string; accent?: boolean }[] }) {
  return (
    <div className="my-2 grid gap-px bg-[hsl(var(--border))] border border-[hsl(var(--border))]" style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, 1fr)`, borderRadius: "2px" }}>
      {items.map((item, i) => (
        <div key={i} className="bg-[hsl(var(--bg-raised))] px-3 py-2">
          <p className="text-[9px] font-mono text-[hsl(var(--text-secondary))] opacity-50 uppercase tracking-wider">
            {item.label}
          </p>
          <p className={`text-[14px] font-mono mt-0.5 ${item.accent ? "text-[hsl(var(--accent))]" : "text-[hsl(var(--text-primary))]"}`}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function BarBlock({ items }: { items: { label: string; value: number; max: number }[] }) {
  return (
    <div className="my-2 border border-[hsl(var(--border))] p-3 space-y-1.5" style={{ borderRadius: "2px" }}>
      {items.map((item, i) => {
        const pct = Math.min((item.value / item.max) * 100, 100);
        return (
          <div key={i} className="flex items-center gap-2 text-[11px] font-mono">
            <span className="w-20 text-[hsl(var(--text-secondary))] opacity-60 truncate shrink-0">{item.label}</span>
            <div className="flex-1 h-3 bg-[hsl(var(--bg))] border border-[hsl(var(--border))]/30 overflow-hidden" style={{ borderRadius: "1px" }}>
              <div
                className="h-full bg-[hsl(var(--accent))]"
                style={{ width: `${pct}%`, transition: "width 0.5s ease-out" }}
              />
            </div>
            <span className="text-[hsl(var(--text-secondary))] opacity-50 w-10 text-right shrink-0">{item.value}</span>
          </div>
        );
      })}
    </div>
  );
}

function CalloutBlock({ kind, content }: { kind: "info" | "warn" | "success"; content: string }) {
  const colors = {
    info: "border-l-[hsl(var(--accent))] bg-[hsl(var(--accent))]/5",
    warn: "border-l-amber-500 bg-amber-500/5",
    success: "border-l-[hsl(var(--success))] bg-[hsl(var(--success))]/5",
  };
  return (
    <div className={`my-2 border-l-2 ${colors[kind]} px-3 py-2 text-[12px] font-mono text-[hsl(var(--text-secondary))] opacity-80 leading-relaxed`} style={{ borderRadius: "0 2px 2px 0" }}>
      {formatInline(content)}
    </div>
  );
}

function HeadingBlock({ level, text }: { level: number; text: string }) {
  const sizes = {
    1: "text-[15px] text-[hsl(var(--text-primary))]",
    2: "text-[13px] text-[hsl(var(--accent))] uppercase tracking-wider",
    3: "text-[12px] text-[hsl(var(--text-primary))] opacity-80",
  };
  return (
    <p className={`font-mono ${sizes[level as keyof typeof sizes] || sizes[3]} mt-2 mb-1`}>
      {level >= 2 && <span className="opacity-40 mr-1">&gt;</span>}
      {text}
    </p>
  );
}

function ListBlock({ items }: { items: string[] }) {
  return (
    <div className="space-y-0.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2 ml-1">
          <span className="text-[hsl(var(--accent))] opacity-50 shrink-0 mt-px">{"\u203A"}</span>
          <span>{formatInline(item)}</span>
        </div>
      ))}
    </div>
  );
}

function ImageBlock({ alt, url }: { alt: string; url: string }) {
  return (
    <div className="my-3 border border-[hsl(var(--border))] overflow-hidden inline-block" style={{ borderRadius: "2px" }}>
      {/* Label */}
      <div className="bg-[hsl(var(--bg))] border-b border-[hsl(var(--border))] px-3 py-1 flex items-center justify-between">
        <span className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-50">{alt || "image"}</span>
      </div>
      {/* Image + ASCII side by side */}
      <div className="flex items-start gap-0">
        {/* Real photo */}
        <div className="shrink-0 w-24 h-24 bg-[hsl(var(--bg))]">
          <img
            src={url}
            alt={alt}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
        {/* ASCII portrait */}
        <div className="shrink-0 border-l border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))]">
          <AsciiAvatar src={url} cols={40} canvasWidth={96} className="block" />
        </div>
      </div>
    </div>
  );
}

/* ── Inline Formatter ─────────────────────────────────────── */

type InlinePart = string | { type: "bold" | "italic" | "code" | "link" | "bare-link"; text: string; href?: string };

function formatInline(text: string): ReactNode {
  const parts: InlinePart[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // Match markdown link [text](url), **bold**, *italic*, `code`, or bare URLs
    const match = remaining.match(/(\[([^\]]+)\]\((https?:\/\/[^)]+)\)|\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|(https?:\/\/[^\s<>)]+))/);
    if (!match || match.index === undefined) {
      parts.push(remaining);
      break;
    }

    if (match.index > 0) {
      parts.push(remaining.slice(0, match.index));
    }

    if (match[2] && match[3]) {
      // [text](url)
      parts.push({ type: "link", text: match[2], href: match[3] });
    } else if (match[4]) {
      // **bold**
      parts.push({ type: "bold", text: match[4] });
    } else if (match[5]) {
      // *italic*
      parts.push({ type: "italic", text: match[5] });
    } else if (match[6]) {
      // `code`
      parts.push({ type: "code", text: match[6] });
    } else if (match[7]) {
      // bare URL
      parts.push({ type: "bare-link", text: match[7], href: match[7] });
    }

    remaining = remaining.slice(match.index + match[0].length);
  }

  if (parts.length === 1 && typeof parts[0] === "string") {
    return <>{parts[0]}</>;
  }

  return (
    <>
      {parts.map((part, i) => {
        if (typeof part === "string") return <span key={i}>{part}</span>;
        if (part.type === "bold") {
          return <span key={i} className="text-[hsl(var(--text-primary))]">{part.text}</span>;
        }
        if (part.type === "italic") {
          return <span key={i} className="italic opacity-70">{part.text}</span>;
        }
        if (part.type === "code") {
          return (
            <code key={i} className="px-1 py-0.5 text-[12px] bg-[hsl(var(--bg))]/50 text-[hsl(var(--accent-mid))] border border-[hsl(var(--border))]" style={{ borderRadius: "2px" }}>
              {part.text}
            </code>
          );
        }
        if (part.type === "link" || part.type === "bare-link") {
          return (
            <a
              key={i}
              href={part.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[hsl(var(--accent))] hover:underline"
            >
              {part.text}
            </a>
          );
        }
        return null;
      })}
    </>
  );
}
