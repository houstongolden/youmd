"use client";

import { useState, useEffect } from "react";
import { SUB_AGENTS, type SubAgent } from "../../_data/mock";
import { Icon } from "../icons";
import { Dot, Chip, SectionLabel } from "../primitives";

const SPAWN_STEPS = [
  "Forking your identity context",
  "Scoping memory + skills",
  "Briefing the sub-agent",
  "Bringing it online",
];

function SpawnCard({ onDone }: { onDone: (a: SubAgent) => void }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= SPAWN_STEPS.length) {
      const t = setTimeout(
        () =>
          onDone({
            id: `you-${Date.now()}`,
            name: "writing-you",
            role: "Writes in your voice",
            status: "active",
            scope: "creator.new",
            runs: 0,
          }),
        500,
      );
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), 700);
    return () => clearTimeout(t);
  }, [step, onDone]);

  return (
    <div className="rounded-sm border border-[hsl(var(--accent))]/40 bg-[hsl(var(--bg-raised))] p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon name="sparkles" size={14} className="text-[hsl(var(--accent))]" />
        <span className="font-mono text-[12px] uppercase tracking-wider text-[hsl(var(--accent))]">
          Spawning a YOU sub-agent…
        </span>
      </div>
      <div className="space-y-2">
        {SPAWN_STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div key={s} className="flex items-center gap-2.5 text-[13px]">
              <Dot tone={done ? "green" : active ? "orange" : "dim"} pulse={active} size={7} />
              <span className={done || active ? "text-[hsl(var(--text-primary))]" : "text-[hsl(var(--text-secondary))]/50"}>
                {s}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AgentsView() {
  const [agents, setAgents] = useState<SubAgent[]>(SUB_AGENTS);
  const [spawning, setSpawning] = useState(false);

  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-1 flex items-center gap-2">
        <Icon name="agent" size={18} className="text-[hsl(var(--accent))]" />
        <h2 className="font-mono text-xl font-semibold tracking-tight">Sub-agents</h2>
      </div>
      <p className="mb-6 text-[13px] text-[hsl(var(--text-secondary))]/80">
        You are the agent and the agent is you. Spawn scoped clones of yourself —
        each carries your context, voice, and taste into a slice of your work.
      </p>

      <div className="mb-6 space-y-3">
        {agents.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-3 rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-4"
          >
            <span className="grid h-10 w-10 place-items-center rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg))] text-[hsl(var(--accent))]">
              <Icon name="agent" size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">{a.name}</span>
                <Chip tone={a.status === "active" ? "green" : "default"}>
                  <Dot tone={a.status === "active" ? "green" : "dim"} size={5} /> {a.status}
                </Chip>
              </div>
              <div className="text-[12px] text-[hsl(var(--text-secondary))]/80">{a.role}</div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/50">
                scope: {a.scope} · {a.runs} runs
              </div>
            </div>
          </div>
        ))}
      </div>

      {spawning ? (
        <SpawnCard
          onDone={(a) => {
            setAgents((prev) => [a, ...prev]);
            setSpawning(false);
          }}
        />
      ) : (
        <button
          onClick={() => setSpawning(true)}
          className="flex w-full items-center justify-center gap-2 rounded-sm border border-dashed border-[hsl(var(--accent))]/40 py-3 font-mono text-[12px] uppercase tracking-wider text-[hsl(var(--accent))] transition-colors hover:bg-[hsl(var(--accent))]/5"
        >
          <Icon name="plus" size={14} /> Spawn a YOU sub-agent
        </button>
      )}
    </div>
  );
}
