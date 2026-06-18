"use client";

import { APPS } from "../../_data/mock";
import { Icon } from "../icons";
import { Dot, SectionLabel } from "../primitives";
import { cn } from "../../_lib/cn";

const STATUS_TONE = {
  connected: { tone: "green" as const, label: "connected" },
  syncing: { tone: "orange" as const, label: "syncing" },
  available: { tone: "dim" as const, label: "connect" },
};

export function AppsView() {
  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-8 py-8">
      <h2 className="mb-1 font-mono text-xl font-semibold tracking-tight">Connections</h2>
      <p className="mb-6 text-[13px] text-[hsl(var(--text-secondary))]/80">
        Every app feeds your brain. Crawlers, capture, and your own MCP/API pull
        context in — agents act on it.
      </p>

      <SectionLabel className="mb-2">Active</SectionLabel>
      <div className="mb-6 grid grid-cols-2 gap-3">
        {APPS.filter((a) => a.status !== "available").map((a) => {
          const st = STATUS_TONE[a.status];
          return (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-3.5"
            >
              <span className="grid h-9 w-9 place-items-center rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg))] text-[hsl(var(--text-secondary))]">
                <Icon name={a.icon} size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{a.name}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/50">
                    {a.category}
                  </span>
                </div>
                <div className="truncate text-[12px] text-[hsl(var(--text-secondary))]/70">{a.detail}</div>
              </div>
              <span className="flex items-center gap-1.5">
                <Dot tone={st.tone} pulse={a.status === "syncing"} size={6} />
              </span>
            </div>
          );
        })}
      </div>

      <SectionLabel className="mb-2">Available</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        {APPS.filter((a) => a.status === "available").map((a) => (
          <button
            key={a.id}
            className={cn(
              "flex items-center gap-3 rounded-sm border border-dashed border-[hsl(var(--border))] p-3.5 text-left",
              "transition-colors hover:border-[hsl(var(--accent))]/40 hover:bg-[hsl(var(--bg-raised))]",
            )}
          >
            <span className="grid h-9 w-9 place-items-center rounded-sm border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))]/60">
              <Icon name={a.icon} size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-[hsl(var(--text-secondary))]">{a.name}</div>
              <div className="truncate text-[12px] text-[hsl(var(--text-secondary))]/60">{a.detail}</div>
            </div>
            <Icon name="plus" size={14} className="text-[hsl(var(--accent))]" />
          </button>
        ))}
      </div>
    </div>
  );
}
