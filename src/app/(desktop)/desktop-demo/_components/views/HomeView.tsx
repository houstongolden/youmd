"use client";

import { PROJECTS, TASKS, SUB_AGENTS, WORKSPACE, type ViewId } from "../../_data/mock";
import { Panel, Dot, Chip, SectionLabel } from "../primitives";
import { Icon } from "../icons";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function HomeView({ onNavigate }: { onNavigate: (v: ViewId) => void }) {
  const shipped7d = PROJECTS.reduce((a, p) => a + p.shipped7d, 0);
  const openTasks = TASKS.filter((t) => t.status !== "done").length;
  const activeAgents = SUB_AGENTS.filter((a) => a.status === "active").length;

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      {/* Header */}
      <div className="mb-1 flex items-center gap-2">
        <SectionLabel>{WORKSPACE.brain}</SectionLabel>
        <span className="flex items-center gap-1.5">
          <Dot tone="green" pulse />
          <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--success))]">
            synced · {WORKSPACE.lastSync}
          </span>
        </span>
      </div>
      <h1 className="mb-6 font-mono text-3xl font-semibold tracking-tight">
        {greeting()}, Houston
      </h1>

      {/* Metric row */}
      <div className="mb-7 grid grid-cols-3 gap-3">
        {[
          { label: "Shipped · 7d", value: shipped7d, sub: "across 4 projects" },
          { label: "Open tasks", value: openTasks, sub: "2 high priority" },
          { label: "Sub-agents", value: `${activeAgents} active`, sub: `${SUB_AGENTS.length} total` },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-4"
          >
            <SectionLabel>{m.label}</SectionLabel>
            <div className="mt-2 font-mono text-2xl font-semibold tracking-tight">{m.value}</div>
            <div className="mt-1 text-[12px] text-[hsl(var(--text-secondary))]/70">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Projects */}
      <Panel
        title="Projects"
        right={
          <button
            onClick={() => onNavigate("graph")}
            className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))] transition-colors hover:text-[hsl(var(--accent))]"
          >
            <Icon name="graph" size={12} /> view graph
          </button>
        }
        bodyClassName="p-0"
        className="mb-5"
      >
        <div className="divide-y divide-[hsl(var(--border))]">
          {PROJECTS.map((p) => (
            <div
              key={p.slug}
              className="group flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-[hsl(var(--bg))]"
            >
              <Dot tone={p.focus === "focusing" ? "orange" : p.focus === "active" ? "green" : "dim"} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">{p.name}</span>
                  {p.focus === "focusing" && <Chip tone="accent">focusing</Chip>}
                </div>
                <div className="truncate text-[12px] text-[hsl(var(--text-secondary))]/70">{p.blurb}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm text-[hsl(var(--text-primary))]">+{p.shipped7d}</div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/60">
                  7d
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Quick actions */}
      <SectionLabel className="mb-2">What&apos;s next</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        {[
          { v: "agents" as ViewId, icon: "agent" as const, t: "Spawn a YOU sub-agent", d: "Clone yourself into a scoped agent" },
          { v: "editor" as ViewId, icon: "file" as const, t: "Open your notes", d: "Identity, projects, ideas" },
          { v: "tasks" as ViewId, icon: "check" as const, t: "Triage tasks", d: `${openTasks} open` },
          { v: "terminal" as ViewId, icon: "terminal" as const, t: "Drop into the shell", d: "Run Claude Code / Codex" },
        ].map((a) => (
          <button
            key={a.t}
            onClick={() => onNavigate(a.v)}
            className="flex items-start gap-3 rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-3.5 text-left transition-colors hover:border-[hsl(var(--accent))]/40"
          >
            <span className="mt-0.5 text-[hsl(var(--accent))]">
              <Icon name={a.icon} size={16} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm">{a.t}</span>
              <span className="block text-[12px] text-[hsl(var(--text-secondary))]/70">{a.d}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
