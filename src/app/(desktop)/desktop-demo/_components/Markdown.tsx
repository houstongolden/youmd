"use client";

import React from "react";

// Lightweight, dependency-free markdown renderer tuned for a second-brain vault:
// headings (with anchors), bold/italic, inline + fenced code, links, [[wikilinks]],
// #tags, blockquotes, lists + task checkboxes, tables, hr. Not a full parser —
// just enough to make notes/skills/stacks read like Obsidian/Notion.

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const INLINE = /(\*\*[^*]+\*\*|\*[^*\n]+\*|_[^_\n]+_|`[^`]+`|\[\[[^\]]+\]\]|\[[^\]]+\]\([^)]+\)|#[A-Za-z][\w/-]*)/g;

function renderInline(text: string, keyPrefix: string, onWikiLink?: (name: string) => void): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyPrefix}-${i}`;
    if (tok.startsWith("**")) {
      nodes.push(<strong key={k} className="font-semibold text-[hsl(var(--text-primary))]">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`")) {
      nodes.push(<code key={k} className="rounded-sm bg-[hsl(var(--bg))] px-1.5 py-0.5 font-mono text-[0.85em] text-[hsl(var(--accent-mid))]">{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith("[[")) {
      const name = tok.slice(2, -2);
      nodes.push(
        <button
          key={k}
          onClick={() => onWikiLink?.(name)}
          className="text-[hsl(var(--accent))] underline decoration-[hsl(var(--accent))]/40 underline-offset-2 hover:decoration-[hsl(var(--accent))]"
        >
          {name}
        </button>,
      );
    } else if (tok.startsWith("[")) {
      const lm = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok);
      if (lm) nodes.push(<span key={k} className="text-[hsl(var(--accent))] underline decoration-[hsl(var(--accent))]/30 underline-offset-2">{lm[1]}</span>);
    } else if (tok.startsWith("#")) {
      nodes.push(<span key={k} className="rounded-sm bg-[hsl(var(--accent))]/10 px-1 font-mono text-[0.82em] text-[hsl(var(--accent))]">{tok}</span>);
    } else if (tok.startsWith("*") || tok.startsWith("_")) {
      nodes.push(<em key={k} className="italic text-[hsl(var(--text-secondary))]">{tok.slice(1, -1)}</em>);
    }
    last = INLINE.lastIndex;
    i += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function isTableSep(line?: string) {
  return Boolean(line && /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes("-"));
}
function cells(line: string) {
  return line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
}

export function Markdown({ source, onWikiLink }: { source: string; onWikiLink?: (name: string) => void }) {
  const lines = source.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) { code.push(lines[i]); i += 1; }
      i += 1;
      blocks.push(<pre key={key++} className="my-3 overflow-x-auto rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg))] p-3 font-mono text-[12.5px] leading-relaxed text-[hsl(var(--text-secondary))]">{code.join("\n")}</pre>);
      continue;
    }

    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const sizes = ["text-2xl", "text-xl", "text-base", "text-sm"];
      blocks.push(
        <div key={key++} id={`h-${slugify(h[2])}`} className={`${sizes[level - 1]} mt-5 mb-2 scroll-mt-4 font-mono font-semibold tracking-tight text-[hsl(var(--text-primary))] first:mt-0`}>
          {renderInline(h[2], `h${key}`, onWikiLink)}
        </div>,
      );
      i += 1;
      continue;
    }

    if (/^---+\s*$/.test(line)) { blocks.push(<hr key={key++} className="my-4 border-[hsl(var(--border))]" />); i += 1; continue; }

    if (line.startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) { quote.push(lines[i].replace(/^>\s?/, "")); i += 1; }
      blocks.push(<blockquote key={key++} className="my-3 border-l-2 border-[hsl(var(--accent))]/50 pl-3 italic text-[hsl(var(--text-secondary))]">{renderInline(quote.join(" "), `q${key}`, onWikiLink)}</blockquote>);
      continue;
    }

    // Table
    if (line.includes("|") && isTableSep(lines[i + 1])) {
      const header = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) { rows.push(cells(lines[i])); i += 1; }
      blocks.push(
        <div key={key++} className="my-3 overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>{header.map((c, ci) => <th key={ci} className="border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] px-2.5 py-1.5 text-left font-mono text-[11px] uppercase tracking-wider text-[hsl(var(--text-secondary))]">{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} className="border border-[hsl(var(--border))] px-2.5 py-1.5 text-[hsl(var(--text-secondary))]">{renderInline(c, `t${key}-${ri}-${ci}`, onWikiLink)}</td>)}</tr>)}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        const indent = (/^(\s*)/.exec(lines[i])?.[1].length ?? 0) >= 2;
        let item = lines[i].replace(/^\s*[-*]\s+/, "");
        const cb = /^\[([ xX])\]\s+(.*)$/.exec(item);
        if (cb) {
          const checked = cb[1].toLowerCase() === "x";
          items.push(
            <li key={`li${key}-${items.length}`} className={`flex items-start gap-2 ${indent ? "ml-4" : ""}`}>
              <span aria-hidden className={`mt-[3px] inline-block h-3.5 w-3.5 shrink-0 rounded-sm border ${checked ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/20" : "border-[hsl(var(--border))]"}`} />
              <span className={checked ? "text-[hsl(var(--text-secondary))] line-through" : ""}>{renderInline(cb[2], `cb${key}-${items.length}`, onWikiLink)}</span>
            </li>,
          );
        } else {
          item = item.replace(/^\[[ xX]\]\s*/, "");
          items.push(
            <li key={`li${key}-${items.length}`} className={`flex items-start gap-2 ${indent ? "ml-4" : ""}`}>
              <span aria-hidden className="mt-[9px] inline-block h-1 w-1 shrink-0 bg-[hsl(var(--accent))]" />
              <span>{renderInline(item, `li${key}-${items.length}`, onWikiLink)}</span>
            </li>,
          );
        }
        i += 1;
      }
      blocks.push(<ul key={key++} className="my-2 space-y-1.5 text-[hsl(var(--text-secondary))]">{items}</ul>);
      continue;
    }

    if (line.trim() === "") { i += 1; continue; }

    blocks.push(<p key={key++} className="my-2 leading-relaxed text-[hsl(var(--text-secondary))]">{renderInline(line, `p${key}`, onWikiLink)}</p>);
    i += 1;
  }

  return <div className="text-[14px]">{blocks}</div>;
}
