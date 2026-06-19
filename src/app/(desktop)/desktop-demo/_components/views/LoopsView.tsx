"use client";

import { useState } from "react";
import { LOOPS, type Loop } from "../../_data/mock";
import { Icon } from "../icons";
import { Dot, Chip, SectionLabel, ViewHeader } from "../primitives";
import { cn } from "../../_lib/cn";

export function LoopsView() {
  const [loops, setLoops] = useState<Loop[]>(LOOPS);
  const toggle = (id: string) =>
    setLoops((ls) =>
      ls.map((l) => (l.id === id ? { ...l, status: l.status === "running" ? "paused" : "running" } : l)),
    );

  const running = loops.filter((l) => l.status === "running").length;
  const groups: { kind: Loop["kind"]; label: string }[] = [
    { kind: "workflow", label: "Workflows" },
    { kind: "crawler", label: "Crawlers" },
  ];

  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
      <ViewHeader
        title="Loops"
        description={`Everything that runs on its own — scheduled workflows, self-improvement loops, and the crawlers that keep your brain current. ${running}/${loops.length} running.`}
      />

      {groups.map((g) => (
        <div key={g.kind} className="mb-6">
          <SectionLabel className="mb-2 flex items-center gap-1.5">
            <Icon name={g.kind === "workflow" ? "workflow" : "sync"} size={12} /> {g.label}
          </SectionLabel>
          <div className="space-y-2">
            {loops
              .filter((l) => l.kind === g.kind)
              .map((l) => (
                <div
                  key={l.id}
                  className="flex items-center gap-3 rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-3.5"
                >
                  <Icon name="loop" size={16} className="shrink-0 text-[hsl(var(--accent))]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{l.name}</span>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/50">
                        {l.trigger}
                      </span>
                    </div>
                    <div className="truncate text-[12px] text-[hsl(var(--text-secondary))]/75">{l.does}</div>
                    <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/45">
                      {l.scope} · ran {l.lastRun}
                    </div>
                  </div>
                  <button
                    onClick={() => toggle(l.id)}
                    className="flex shrink-0 items-center gap-1.5 rounded-sm border border-[hsl(var(--border))] px-2 py-1 transition-colors hover:border-[hsl(var(--accent))]/40"
                    title={l.status === "running" ? "Pause loop" : "Resume loop"}
                  >
                    <Dot tone={l.status === "running" ? "green" : "dim"} size={6} pulse={l.status === "running"} />
                    <span
                      className={cn(
                        "font-mono text-[10px] uppercase tracking-wider",
                        l.status === "running" ? "text-[hsl(var(--success))]" : "text-[hsl(var(--text-secondary))]/55",
                      )}
                    >
                      {l.status}
                    </span>
                  </button>
                </div>
              ))}
          </div>
        </div>
      ))}

      <button className="flex w-full items-center justify-center gap-2 rounded-sm border border-dashed border-[hsl(var(--accent))]/40 py-3 font-mono text-[12px] uppercase tracking-wider text-[hsl(var(--accent))] transition-colors hover:bg-[hsl(var(--accent))]/5">
        <Icon name="plus" size={14} /> New loop
        <Chip tone="accent">workflow or crawler</Chip>
      </button>
    </div>
  );
}
