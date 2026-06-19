"use client";

import { PROJECTS, SUB_AGENTS, WORKSPACE, DAILY_BRIEF, type Task, type ViewId } from "../../_data/mock";
import { Panel, Dot, Chip, SectionLabel } from "../primitives";
import { Icon } from "../icons";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function HomeView({ onNavigate, tasks }: { onNavigate: (v: ViewId) => void; tasks: Task[] }) {
  const shipped7d = PROJECTS.reduce((a, p) => a + p.shipped7d, 0);
  const openTasks = tasks.filter((t) => t.status !== "done").length;
  const activeAgents = SUB_AGENTS.filter((a) => a.status === "active").length;
  // Cross-project follow-ups that want a human: high-priority or you-owned.
  const needsAttention = tasks.filter(
    (t) => t.status !== "done" && (t.priority === "high" || t.owner === "you"),
  ).slice(0, 4);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
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
      <h1 className="mb-3 font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
        {greeting()}, Houston
      </h1>

      {/* AI daily brief — your agent's read on the day */}
      <div className="mb-6 flex items-start gap-2.5 rounded-sm border-l-2 border-[hsl(var(--accent))]/60 bg-[hsl(var(--bg-raised))] px-3.5 py-3">
        <Icon name="sparkles" size={14} className="mt-0.5 shrink-0 text-[hsl(var(--accent))]" />
        <p className="text-[13px] leading-relaxed text-[hsl(var(--text-secondary))]">{DAILY_BRIEF}</p>
      </div>

      {/* Metric row */}
      <div className="mb-7 grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: "Shipped · 7d", value: shipped7d, sub: "across 4 projects" },
          { label: "Open tasks", value: openTasks, sub: "2 high priority" },
          { label: "Sub-agents", value: `${activeAgents} active`, sub: `${SUB_AGENTS.length} total` },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-3 sm:p-4"
          >
            <SectionLabel>{m.label}</SectionLabel>
            <div className="mt-2 font-mono text-xl font-semibold tracking-tight sm:text-2xl">{m.value}</div>
            <div className="mt-1 text-[11px] text-[hsl(var(--text-secondary))]/70 sm:text-[12px]">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Needs attention — cross-project follow-ups that want a human */}
      <Panel
        title="Needs attention"
        right={
          <button
            onClick={() => onNavigate("tasks")}
            className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))] transition-colors hover:text-[hsl(var(--accent))]"
          >
            all tasks →
          </button>
        }
        bodyClassName="p-0"
        className="mb-5"
      >
        <div className="divide-y divide-[hsl(var(--border))]">
          {needsAttention.length === 0 ? (
            <div className="flex items-center gap-2 px-3.5 py-4 text-[13px] text-[hsl(var(--text-secondary))]/70">
              <Dot tone="green" size={6} /> You&apos;re all caught up — agents have the rest.
            </div>
          ) : (
            needsAttention.map((t) => (
            <button
              key={t.id}
              onClick={() => onNavigate("tasks")}
              className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-[hsl(var(--bg))]"
            >
              <Dot tone={t.priority === "high" ? "orange" : "green"} size={6} />
              <span className="flex-1 truncate text-[13px]">{t.title}</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/55">
                {t.project}
              </span>
              <Chip tone={t.owner === "agent" ? "accent" : "default"}>{t.owner === "agent" ? "agent" : "you"}</Chip>
            </button>
            ))
          )}
        </div>
      </Panel>

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
            <button
              key={p.slug}
              onClick={() => onNavigate("projects")}
              className="group flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-[hsl(var(--bg))]"
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
            </button>
          ))}
        </div>
      </Panel>

      {/* Quick actions */}
      <SectionLabel className="mb-2">What&apos;s next</SectionLabel>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[
          { v: "agents" as ViewId, icon: "agent" as const, t: "Spawn a YOU sub-agent", d: "Clone yourself into a scoped agent" },
          { v: "skills" as ViewId, icon: "layers" as const, t: "Skills & stacks", d: "Shared, DRY, grouped by stack" },
          { v: "editor" as ViewId, icon: "brain" as const, t: "Open your brain", d: "Identity, memories, goals" },
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
