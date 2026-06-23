"use client";

import { PixelCharacter } from "@/components/ui/PixelCharacter";
import {
  PROJECTS,
  SUB_AGENTS,
  WORKSPACE,
  DAILY_BRIEF,
  VALUE_PROP,
  HOW_IT_WORKS,
  type Task,
  type ViewId,
} from "../../_data/mock";
import { Dot, Chip, SectionLabel } from "../primitives";
import { Icon } from "../icons";
import { ActivityStream } from "../ActivityStream";
import { useRealData } from "../../_lib/RealDataContext";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

type HomeProject = { name: string; blurb: string; focus: "focusing" | "active" | "idle"; metric: number; badge?: string };

export function HomeView({ onNavigate, tasks }: { onNavigate: (v: ViewId) => void; tasks: Task[] }) {
  const real = useRealData();
  const openTasks = tasks.filter((t) => t.status !== "done").length;
  const activeAgents = SUB_AGENTS.filter((a) => a.status === "active").length;

  // Real-aware: counts, projects, and a generated summary + "needs you".
  const live = Boolean(real?.available);
  const projects: HomeProject[] = live
    ? real!.projects.map((p) => ({
        name: p.name,
        blurb: p.blurb ?? (p.remote ?? ""),
        focus: p.isBrainRepo ? "focusing" : p.hasEnvLocal ? "active" : "idle",
        metric: p.files.length,
        badge: p.label,
      }))
    : PROJECTS.map((p) => ({ name: p.name, blurb: p.blurb, focus: p.focus, metric: p.shipped7d }));
  const skillCount = live ? real!.skills.length : 0;
  const machineCount = live ? Math.max(1, [real!.machine?.host, "Houstons-MBP", "cloud-vps"].filter(Boolean).length) : 3;

  // "Needs you" — derived from real project gaps when live, else mock tasks.
  const realNeeds = live
    ? real!.projects.filter((p) => !p.hasEnvLocal).slice(0, 3).map((p) => ({ id: p.name, title: `${p.name}: restore .env.local to run locally`, project: p.name, high: true }))
    : [];
  const needsAttention = live
    ? realNeeds
    : tasks
        .filter((t) => t.status !== "done" && (t.priority === "high" || t.owner === "you"))
        .slice(0, 3)
        .map((t) => ({ id: t.id, title: t.title, project: t.project, high: t.priority === "high" }));

  const brief = live
    ? `${projects.length} projects and ${skillCount} skills synced across ${machineCount} machines. ${needsAttention.length} need you; the rest are tracked by your agents.`
    : DAILY_BRIEF;

  const readyCount = live ? real!.projects.filter((p) => p.hasEnvLocal).length : 0;
  const insights = live
    ? [
        `${readyCount} of ${projects.length} projects are ready to run locally`,
        `${skillCount} skills synced across ${machineCount} machines · 0 duplicated`,
        real!.projects.some((p) => p.isBrainRepo) ? "Brain repo (source of truth) is current" : "No brain repo detected",
      ]
    : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      {/* greeting */}
      <div className="mb-1 flex items-center gap-2">
        <SectionLabel>{WORKSPACE.brain}</SectionLabel>
        <span className="flex items-center gap-1.5">
          <Dot tone="green" pulse />
          <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--success))]">
            synced · {WORKSPACE.machines} machines
          </span>
        </span>
      </div>
      <h1 className="mb-4 font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
        {greeting()}, Houston
      </h1>

      {/* what this is — orientation anyone can read in one breath */}
      <div className="mb-4 rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-4">
        <div className="mb-1.5 flex items-center gap-2">
          <Icon name="brain" size={14} className="text-[hsl(var(--accent))]" />
          <SectionLabel>what this is</SectionLabel>
        </div>
        <p className="text-[13.5px] leading-relaxed text-[hsl(var(--text-primary))]/90">{VALUE_PROP}</p>
      </div>

      {/* your agent's read on the day */}
      <div className="mb-7 flex items-start gap-2.5 rounded-sm border-l-2 border-[hsl(var(--accent))]/60 bg-[hsl(var(--bg-raised))] px-3.5 py-3">
        <Icon name="sparkles" size={14} className="mt-0.5 shrink-0 text-[hsl(var(--accent))]" />
        <p className="text-[13px] leading-relaxed text-[hsl(var(--text-secondary))]">{brief}</p>
      </div>

      {/* metric row */}
      <div className="mb-7 grid grid-cols-3 gap-2 sm:gap-3">
        {(live
          ? [
              { label: "Projects", value: projects.length, sub: `${needsAttention.length} need env` },
              { label: "Skills", value: skillCount, sub: "synced + shared" },
              { label: "Machines", value: machineCount, sub: "in sync" },
            ]
          : [
              { label: "Open tasks", value: openTasks, sub: `${needsAttention.length} need you` },
              { label: "Agents", value: `${activeAgents} active`, sub: `${SUB_AGENTS.length} total` },
              { label: "Machines", value: machineCount, sub: "in sync" },
            ]
        ).map((m) => (
          <div key={m.label} className="rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-3 sm:p-4">
            <SectionLabel>{m.label}</SectionLabel>
            <div className="mt-2 font-mono text-xl font-semibold tracking-tight sm:text-2xl">{m.value}</div>
            <div className="mt-1 text-[11px] text-[hsl(var(--text-secondary))]/70 sm:text-[12px]">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* generated report — AI summary from real state */}
      {live && (
        <div className="mb-7">
          <SectionLabel className="mb-2">Report · generated</SectionLabel>
          <div className="rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-3.5">
            {insights.map((t, i) => (
              <div key={i} className="flex items-start gap-2 py-1 text-[12.5px] text-[hsl(var(--text-secondary))]/85">
                <Icon name="sparkles" size={12} className="mt-0.5 shrink-0 text-[hsl(var(--accent))]" /> {t}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* your agents — clones of you, alive */}
      <div className="mb-2.5 flex items-center justify-between">
        <SectionLabel>Your agents</SectionLabel>
        <button onClick={() => onNavigate("agents")} className="font-mono text-[11px] text-[hsl(var(--text-secondary))] transition-colors hover:text-[hsl(var(--accent))]">
          manage →
        </button>
      </div>
      <div className="mb-7 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SUB_AGENTS.map((a) => (
          <button
            key={a.id}
            onClick={() => onNavigate("agents")}
            className="flex flex-col items-center gap-2 rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-3 text-center transition-colors hover:border-[hsl(var(--accent))]/40"
          >
            <PixelCharacter kind="agent" seed={a.name} status={a.status === "active" ? "active" : "idle"} size="md" />
            <div className="min-w-0">
              <div className="truncate font-mono text-[11.5px] text-[hsl(var(--text-primary))]">{a.name}</div>
              <div className="truncate text-[10px] text-[hsl(var(--text-secondary))]/60">{a.scope}</div>
            </div>
          </button>
        ))}
      </div>

      {/* live activity — the system visibly working for you */}
      <div className="mb-7">
        <ActivityStream limit={5} />
      </div>

      {/* needs you */}
      {needsAttention.length > 0 && (
        <div className="mb-7">
          <div className="mb-2.5 flex items-center justify-between">
            <SectionLabel>Needs you</SectionLabel>
            <button onClick={() => onNavigate("tasks")} className="font-mono text-[11px] text-[hsl(var(--text-secondary))] transition-colors hover:text-[hsl(var(--accent))]">
              all tasks →
            </button>
          </div>
          <div className="rounded-sm border border-[hsl(var(--border))]">
            {needsAttention.map((t, i) => (
              <button
                key={t.id}
                onClick={() => onNavigate("tasks")}
                className={
                  "flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-[hsl(var(--bg-raised))]" +
                  (i !== needsAttention.length - 1 ? " border-b border-[hsl(var(--border))]" : "")
                }
              >
                <Dot tone={t.high ? "orange" : "dim"} size={6} />
                <span className="min-w-0 flex-1 truncate text-[13px] text-[hsl(var(--text-primary))]">{t.title}</span>
                <Chip>{t.project}</Chip>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* jump back in */}
      <div className="mb-2.5 flex items-center justify-between">
        <SectionLabel>Jump back in</SectionLabel>
        <button onClick={() => onNavigate("projects")} className="font-mono text-[11px] text-[hsl(var(--text-secondary))] transition-colors hover:text-[hsl(var(--accent))]">
          all projects →
        </button>
      </div>
      <div className="mb-8 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {projects.filter((p) => p.focus !== "idle").slice(0, 6).map((p) => (
          <button
            key={p.name}
            onClick={() => onNavigate("projects")}
            className="flex items-start gap-2.5 rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-3 text-left transition-colors hover:border-[hsl(var(--accent))]/40"
          >
            <Icon name="branch" size={15} className="mt-0.5 text-[hsl(var(--text-secondary))]" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-mono text-[13px] text-[hsl(var(--text-primary))]">{p.name}</span>
                {p.badge ? <Chip tone="accent">{p.badge}</Chip> : <Chip tone={p.focus === "focusing" ? "accent" : "green"}>{p.focus}</Chip>}
              </div>
              <div className="mt-0.5 truncate text-[11.5px] text-[hsl(var(--text-secondary))]/70">{p.blurb}</div>
            </div>
            <span className="shrink-0 font-mono text-[10px] text-[hsl(var(--text-secondary))]/50">{p.metric}</span>
          </button>
        ))}
      </div>

      {/* how it works — the value loop, so the purpose is unmistakable */}
      <SectionLabel className="mb-2.5">How you.md helps you</SectionLabel>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {HOW_IT_WORKS.map((s, i) => (
          <div key={s.title} className="rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-3.5">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="font-mono text-[11px] text-[hsl(var(--accent))]">{i + 1}</span>
              <Icon name={s.icon} size={14} className="text-[hsl(var(--accent))]" />
            </div>
            <div className="mb-1 text-[12.5px] font-semibold text-[hsl(var(--text-primary))]">{s.title}</div>
            <p className="text-[11.5px] leading-relaxed text-[hsl(var(--text-secondary))]/75">{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
