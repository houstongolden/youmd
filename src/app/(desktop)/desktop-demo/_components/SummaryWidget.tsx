"use client";

import { SESSION_SUMMARY } from "../_data/mock";
import { Icon } from "./icons";
import { Dot } from "./primitives";

// Codex-style sticky summary widget, shown top-right in full-chat mode.
export function SummaryWidget() {
  return (
    <div className="w-64 max-w-[calc(100vw-2.5rem)] rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))]/90 p-3 shadow-sm backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon name="sparkles" size={12} className="text-[hsl(var(--accent))]" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]">
            {SESSION_SUMMARY.title}
          </span>
        </div>
        <Dot tone="green" pulse size={6} />
      </div>
      <ul className="space-y-1.5">
        {SESSION_SUMMARY.bullets.map((b) => (
          <li key={b} className="flex items-start gap-2 text-[12px] leading-snug text-[hsl(var(--text-secondary))]">
            <span aria-hidden className="mt-[7px] inline-block h-1 w-1 shrink-0 bg-[hsl(var(--accent))]" />
            {b}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between border-t border-[hsl(var(--border))] pt-2 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/55">
        <span>{SESSION_SUMMARY.model}</span>
        <span>{SESSION_SUMMARY.tokens}</span>
      </div>
    </div>
  );
}
