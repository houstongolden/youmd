"use client";

import { PixelCharacter } from "@/components/ui/PixelCharacter";
import { SESSIONS, DEVICES, type AgentSession } from "../../_data/mock";
import { useRealData } from "../../_lib/RealDataContext";
import { ModelMark } from "../ModelSelector";
import { Icon } from "../icons";
import { Dot, Chip, SectionLabel, ViewHeader } from "../primitives";

// High-level view of YOUR agents working across YOUR projects and machines —
// grouped exactly like the sessions rail (consistency). You don't micro-manage
// sub-agents here; you get visibility into what's running, where, on what.
export function AgentsView() {
  const real = useRealData();
  const sessions: AgentSession[] = real?.sessions?.length ? (real.sessions as AgentSession[]) : SESSIONS;
  const projects = Array.from(new Set(sessions.map((s) => s.project)));
  const machines = Array.from(new Set(sessions.map((s) => s.machine)));

  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
      <ViewHeader
        title={
          <>
            <Icon name="agent" size={18} className="text-[hsl(var(--accent))]" /> Agents
          </>
        }
        description="Your agents at work across projects and machines. They spawn their own sub-agents — you just watch the high level."
      />

      <div className="mb-6 flex items-center gap-3 rounded-sm border-l-2 border-[hsl(var(--accent))]/50 bg-[hsl(var(--bg-raised))] px-4 py-2.5 font-mono text-[11px] text-[hsl(var(--text-secondary))]">
        <span>{sessions.length} agents</span>
        <span className="opacity-40">·</span>
        <span>{projects.length} projects</span>
        <span className="opacity-40">·</span>
        <span>{machines.length} machines</span>
      </div>

      {projects.map((proj) => {
        const items = sessions.filter((s) => s.project === proj);
        return (
          <div key={proj} className="mb-5">
            <SectionLabel className="mb-2">{proj}</SectionLabel>
            <div className="rounded-sm border border-[hsl(var(--border))]">
              {items.map((s, i) => {
                const needs = Boolean(s.needsYou);
                return (
                  <div
                    key={s.id}
                    className={
                      "flex items-center gap-3 px-3.5 py-3" +
                      (i !== items.length - 1 ? " border-b border-[hsl(var(--border))]" : "")
                    }
                  >
                    <PixelCharacter
                      kind={s.local ? "agent" : "machine"}
                      seed={s.agent}
                      status={needs ? "warn" : s.status === "active" ? "active" : "idle"}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-mono text-[13px] text-[hsl(var(--text-primary))]">{s.agent}</span>
                        <ModelMark id={s.model} size={13} />
                        {s.subAgents ? <Chip>+{s.subAgents} sub-agents</Chip> : null}
                      </div>
                      <div className="truncate text-[12px] text-[hsl(var(--text-secondary))]/75">↳ {s.task ?? s.title}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/50">
                        {s.cloud ? (
                          <span className="flex items-center gap-1 text-[hsl(var(--accent))]/70"><Icon name="cloud" size={9} /> {s.machine} · cloud</span>
                        ) : s.local ? (
                          <span className="flex items-center gap-1"><Icon name="device" size={9} /> {s.machine}</span>
                        ) : (
                          <span className="flex items-center gap-1 text-[hsl(var(--accent))]/70"><Icon name="expand" size={9} /> {s.machine} · remote</span>
                        )}
                      </div>
                    </div>
                    {needs ? (
                      <Chip tone="accent">needs you</Chip>
                    ) : (
                      <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/55">
                        <Dot tone={s.status === "active" ? "green" : "dim"} pulse={s.status === "active"} size={5} /> {s.status}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* machines footer — where the agents run */}
      <SectionLabel className="mb-2">Machines</SectionLabel>
      <div className="flex flex-wrap gap-2">
        {DEVICES.map((d) => (
          <span key={d.name} className="flex items-center gap-2 rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] px-2.5 py-1.5">
            <PixelCharacter kind="machine" seed={d.name} status={d.status === "idle" ? "idle" : "ready"} size="xs" />
            <span className="font-mono text-[11px] text-[hsl(var(--text-primary))]">{d.name}</span>
            {d.current && <Chip>this</Chip>}
          </span>
        ))}
      </div>
    </div>
  );
}
