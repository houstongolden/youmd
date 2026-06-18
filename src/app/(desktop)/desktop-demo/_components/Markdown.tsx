"use client";

import React from "react";

// Minimal, dependency-free markdown renderer — just enough for the demo notes
// (headings, bold, inline code, links, lists, checkboxes, blockquote, hr,
// fenced code). Not a general-purpose parser; it only handles what the mock
// content uses. Good enough to make the editor read like Notion/Obsidian.

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Split on **bold**, `code`, and [label](url) while keeping delimiters.
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const tok = match[0];
    if (tok.startsWith("**")) {
      nodes.push(
        <strong key={`${keyPrefix}-b${i}`} className="font-semibold text-[hsl(var(--text-primary))]">
          {tok.slice(2, -2)}
        </strong>,
      );
    } else if (tok.startsWith("`")) {
      nodes.push(
        <code
          key={`${keyPrefix}-c${i}`}
          className="rounded-sm bg-[hsl(var(--bg))] px-1.5 py-0.5 font-mono text-[0.85em] text-[hsl(var(--accent-mid))]"
        >
          {tok.slice(1, -1)}
        </code>,
      );
    } else {
      const m = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok);
      if (m) {
        nodes.push(
          <span key={`${keyPrefix}-l${i}`} className="text-[hsl(var(--accent))] underline decoration-[hsl(var(--accent))]/30 underline-offset-2">
            {m[1]}
          </span>,
        );
      }
    }
    last = regex.lastIndex;
    i += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({ source }: { source: string }) {
  const lines = source.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trim().startsWith("```")) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence
      blocks.push(
        <pre
          key={key++}
          className="my-3 overflow-x-auto rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg))] p-3 font-mono text-[12.5px] leading-relaxed text-[hsl(var(--text-secondary))]"
        >
          {code.join("\n")}
        </pre>,
      );
      continue;
    }

    // Headings
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const sizes = ["text-2xl", "text-xl", "text-base", "text-sm"];
      blocks.push(
        <div
          key={key++}
          className={`${sizes[level - 1]} mt-5 mb-2 font-mono font-semibold tracking-tight text-[hsl(var(--text-primary))] first:mt-0`}
        >
          {renderInline(h[2], `h${key}`)}
        </div>,
      );
      i += 1;
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line)) {
      blocks.push(<hr key={key++} className="my-4 border-[hsl(var(--border))]" />);
      i += 1;
      continue;
    }

    // Blockquote
    if (line.startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        quote.push(lines[i].replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push(
        <blockquote
          key={key++}
          className="my-3 border-l-2 border-[hsl(var(--accent))]/50 pl-3 text-[hsl(var(--text-secondary))] italic"
        >
          {renderInline(quote.join(" "), `q${key}`)}
        </blockquote>,
      );
      continue;
    }

    // Lists (including [ ] / [x] checkboxes)
    if (/^\s*[-*]\s+/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        let item = lines[i].replace(/^\s*[-*]\s+/, "");
        const checkbox = /^\[([ x])\]\s+(.*)$/.exec(item);
        if (checkbox) {
          const checked = checkbox[1] === "x";
          items.push(
            <li key={`li${key}-${items.length}`} className="flex items-start gap-2">
              <span
                aria-hidden
                className={`mt-[3px] inline-block h-3.5 w-3.5 shrink-0 rounded-sm border ${
                  checked
                    ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/20"
                    : "border-[hsl(var(--border))]"
                }`}
              />
              <span className={checked ? "text-[hsl(var(--text-secondary))] line-through" : ""}>
                {renderInline(checkbox[2], `cb${key}-${items.length}`)}
              </span>
            </li>,
          );
        } else {
          item = item.replace(/^\[[ x]\]\s*/, "");
          items.push(
            <li key={`li${key}-${items.length}`} className="flex items-start gap-2">
              <span aria-hidden className="mt-[9px] inline-block h-1 w-1 shrink-0 bg-[hsl(var(--accent))]" />
              <span>{renderInline(item, `li${key}-${items.length}`)}</span>
            </li>,
          );
        }
        i += 1;
      }
      blocks.push(
        <ul key={key++} className="my-2 space-y-1.5 text-[hsl(var(--text-secondary))]">
          {items}
        </ul>,
      );
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      i += 1;
      continue;
    }

    // Paragraph
    blocks.push(
      <p key={key++} className="my-2 leading-relaxed text-[hsl(var(--text-secondary))]">
        {renderInline(line, `p${key}`)}
      </p>,
    );
    i += 1;
  }

  return <div className="text-[14px]">{blocks}</div>;
}
