"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Bot, Check, Clock3, Columns3, FolderGit2, List, ListTodo, UserRound } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { LocalMachineReadiness } from "@/lib/local-machine-readiness.server";
import { PaneCallout, PaneDivider, PaneEmptyState, PaneHeader, PaneSectionLabel } from "./shared";

type TaskPaneKey = "portfolio" | "tasks" | "machine" | "agents" | "apis" | "skills";

type PortfolioTask = {
  _id: Id<"portfolioTasks">;
  projectSlug?: string;
  title: string;
  description?: string;
  ownerType: "human" | "agent";
  ownerLabel?: string;
  status: string;
  priority: string;
  dueAt?: number;
  sourceType?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
};

type PortfolioProject = {
  slug: string;
  name: string;
  status: string;
  focusStatus?: string;
  focusRank?: number;
  summary?: string;
  stackName?: string;
  lastActivityAt?: number;
  updatedAt?: number;
};

type PortfolioActivity = {
  projectSlug: string;
  kind: string;
  title: string;
  summary?: string;
  url?: string;
  source: string;
  occurredAt: number;
};

type BrainDumpCapture = {
  _id: Id<"brainDumpCaptures">;
  source: string;
  rawText: string;
  summary?: string;
  insights?: string[];
  projectSlugs?: string[];
  tags?: string[];
  createdAt: number;
};

const DONE_STATUSES = new Set(["done", "cancelled"]);
const PRIORITY_WEIGHT: Record<string, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};
const STATUS_WEIGHT: Record<string, number> = {
  in_progress: 0,
  open: 1,
  proposed: 2,
  snoozed: 3,
};
const ACTIVE_TASK_COLUMNS = [
  { key: "in_progress", label: "doing", empty: "nothing actively moving" },
  { key: "open", label: "ready", empty: "no ready work" },
  { key: "proposed", label: "proposed", empty: "no untriaged ideas" },
  { key: "snoozed", label: "later", empty: "no parked work" },
] as const;
const DONE_TASK_COLUMNS = [
  { key: "done", label: "done", empty: "nothing completed in this filter" },
  { key: "cancelled", label: "killed", empty: "nothing killed in this filter" },
] as const;

function relativeTime(ts?: number): string {
  if (!ts) return "no timestamp";
  const diffMin = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(ts).toLocaleDateString();
}

function taskSort(a: PortfolioTask, b: PortfolioTask) {
  const priorityDelta = (PRIORITY_WEIGHT[a.priority] ?? 4) - (PRIORITY_WEIGHT[b.priority] ?? 4);
  if (priorityDelta !== 0) return priorityDelta;
  const dueDelta = (a.dueAt ?? Number.MAX_SAFE_INTEGER) - (b.dueAt ?? Number.MAX_SAFE_INTEGER);
  if (dueDelta !== 0) return dueDelta;
  const statusDelta = (STATUS_WEIGHT[a.status] ?? 4) - (STATUS_WEIGHT[b.status] ?? 4);
  if (statusDelta !== 0) return statusDelta;
  return b.updatedAt - a.updatedAt;
}

function statusTone(status: string) {
  if (status === "done" || status === "active" || status === "in_progress") return "text-[hsl(var(--success))]";
  if (status === "urgent" || status === "high" || status === "open" || status === "proposed") return "text-[hsl(var(--accent))]";
  return "text-[hsl(var(--text-secondary))] opacity-55";
}

function priorityLabel(priority: string) {
  if (priority === "urgent") return "p0";
  if (priority === "high") return "p1";
  if (priority === "normal") return "p2";
  return "p3";
}

function taskScope(task: PortfolioTask) {
  return task.projectSlug ? task.projectSlug : "personal";
}

function projectDisplayName(projectSlug: string | undefined, projectsBySlug: Map<string, PortfolioProject>) {
  if (!projectSlug) return "personal";
  return projectsBySlug.get(projectSlug)?.name ?? projectSlug;
}

function normalizedBoardStatus(status: string, statusFilter: "active" | "done") {
  if (statusFilter === "done") return status === "cancelled" ? "cancelled" : "done";
  if (status === "in_progress" || status === "open" || status === "proposed" || status === "snoozed") return status;
  return "open";
}

function MiniStat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/45 px-3 py-2">
      <div className="font-mono text-[20px] leading-none text-[hsl(var(--text-primary))]">{value}</div>
      <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--text-secondary))] opacity-45">
        {label}
      </div>
    </div>
  );
}

function TaskActionButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "h-7 cursor-pointer border px-2 font-mono text-[8.5px] uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-35",
        active
          ? "border-[hsl(var(--accent))] text-[hsl(var(--accent))]"
          : "border-[hsl(var(--border))]/60 text-[hsl(var(--text-secondary))] opacity-60 hover:border-[hsl(var(--accent))] hover:text-[hsl(var(--text-primary))]",
      ].join(" ")}
      style={{ borderRadius: "var(--radius)" }}
    >
      {children}
    </button>
  );
}

function TaskRow({
  task,
  busy,
  onStatus,
  onOwner,
  onPersonal,
  compact,
  surface = "row",
  projectName,
}: {
  task: PortfolioTask;
  busy: boolean;
  onStatus: (status: string) => void;
  onOwner: (ownerType: "human" | "agent", ownerLabel: string) => void;
  onPersonal: () => void;
  compact?: boolean;
  surface?: "row" | "card";
  projectName?: string;
}) {
  const isCard = surface === "card";
  return (
    <div
      className={[
        "border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35",
        isCard ? "space-y-3 px-3 py-3" : "grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto]",
      ].join(" ")}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] leading-5 text-[hsl(var(--text-primary))]">{task.title}</span>
          <span className={`font-mono text-[8.5px] uppercase tracking-[0.14em] ${statusTone(task.status)}`}>
            {task.status.replace("_", " ")}
          </span>
          <span className={`font-mono text-[8.5px] uppercase tracking-[0.14em] ${statusTone(task.priority)}`}>
            {priorityLabel(task.priority)}
          </span>
        </div>
        {!compact && (
          <p className="mt-1 max-w-[92ch] font-mono text-[9.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-50">
            {task.description ?? (task.tags.length ? task.tags.map((tag) => `#${tag}`).join(" ") : "No task detail saved yet.")}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-2 font-mono text-[8.5px] uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))] opacity-40">
          <span>{task.ownerType}{task.ownerLabel ? ` / ${task.ownerLabel}` : ""}</span>
          <span>{projectName ?? taskScope(task)}</span>
          <span>{task.dueAt ? `due ${new Date(task.dueAt).toLocaleDateString()}` : "no due date"}</span>
          <span>updated {relativeTime(task.updatedAt)}</span>
        </div>
      </div>
      <div className={["flex flex-wrap items-start gap-1.5", isCard ? "" : "lg:justify-end"].join(" ")}>
        <TaskActionButton active={task.ownerType === "human"} disabled={busy || task.ownerType === "human"} onClick={() => onOwner("human", "Houston")}>
          me
        </TaskActionButton>
        <TaskActionButton active={task.ownerType === "agent"} disabled={busy || task.ownerType === "agent"} onClick={() => onOwner("agent", "You Agent")}>
          agent
        </TaskActionButton>
        <TaskActionButton active={task.status === "in_progress"} disabled={busy || task.status === "in_progress"} onClick={() => onStatus("in_progress")}>
          doing
        </TaskActionButton>
        <TaskActionButton active={task.status === "done"} disabled={busy || task.status === "done"} onClick={() => onStatus("done")}>
          done
        </TaskActionButton>
        <TaskActionButton disabled={busy || !task.projectSlug} onClick={onPersonal}>
          personal
        </TaskActionButton>
      </div>
    </div>
  );
}

function TaskQueue({
  label,
  tasks,
  empty,
  busyTaskId,
  onStatus,
  onOwner,
  onPersonal,
  compact,
  projectsBySlug,
}: {
  label: string;
  tasks: PortfolioTask[];
  empty: string;
  busyTaskId: string | null;
  onStatus: (taskId: Id<"portfolioTasks">, status: string) => void;
  onOwner: (taskId: Id<"portfolioTasks">, ownerType: "human" | "agent", ownerLabel: string) => void;
  onPersonal: (taskId: Id<"portfolioTasks">) => void;
  compact?: boolean;
  projectsBySlug?: Map<string, PortfolioProject>;
}) {
  return (
    <section>
      <PaneSectionLabel>{label}</PaneSectionLabel>
      {tasks.length === 0 ? (
        <div className="border-l border-[hsl(var(--border))]/70 bg-[hsl(var(--bg))]/30 px-4 py-3 font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-45">
          {empty}
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskRow
              key={task._id}
              task={task}
              busy={busyTaskId === String(task._id)}
              compact={compact}
              projectName={projectsBySlug ? projectDisplayName(task.projectSlug, projectsBySlug) : undefined}
              onStatus={(status) => onStatus(task._id, status)}
              onOwner={(ownerType, ownerLabel) => onOwner(task._id, ownerType, ownerLabel)}
              onPersonal={() => onPersonal(task._id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function TaskBoardColumn({
  label,
  empty,
  tasks,
  busyTaskId,
  projectsBySlug,
  onStatus,
  onOwner,
  onPersonal,
}: {
  label: string;
  empty: string;
  tasks: PortfolioTask[];
  busyTaskId: string | null;
  projectsBySlug: Map<string, PortfolioProject>;
  onStatus: (taskId: Id<"portfolioTasks">, status: string) => void;
  onOwner: (taskId: Id<"portfolioTasks">, ownerType: "human" | "agent", ownerLabel: string) => void;
  onPersonal: (taskId: Id<"portfolioTasks">) => void;
}) {
  return (
    <section className="min-w-0 bg-[hsl(var(--bg-raised))]/22 px-2 py-2">
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-[hsl(var(--border))]/45 pb-2">
        <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--accent))] opacity-75">{label}</div>
        <div className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-45">{tasks.length}</div>
      </div>
      {tasks.length === 0 ? (
        <div className="px-2 py-3 font-mono text-[9.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-38">{empty}</div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskRow
              key={task._id}
              task={task}
              busy={busyTaskId === String(task._id)}
              compact
              surface="card"
              projectName={projectDisplayName(task.projectSlug, projectsBySlug)}
              onStatus={(status) => onStatus(task._id, status)}
              onOwner={(ownerType, ownerLabel) => onOwner(task._id, ownerType, ownerLabel)}
              onPersonal={() => onPersonal(task._id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ProjectPulse({ projects }: { projects: PortfolioProject[] }) {
  return (
    <section>
      <PaneSectionLabel>active project focus</PaneSectionLabel>
      {projects.length === 0 ? (
        <div className="border-l border-[hsl(var(--border))]/70 bg-[hsl(var(--bg))]/30 px-4 py-3 font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-45">
          no focused projects saved yet
        </div>
      ) : (
        <div className="space-y-2">
          {projects.slice(0, 6).map((project) => (
            <div key={project.slug} className="grid gap-3 border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-3 md:grid-cols-[0.7fr_1fr_auto]">
              <div>
                <div className="font-mono text-[11px] text-[hsl(var(--text-primary))]">{project.name}</div>
                <div className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-65">
                  {project.focusStatus ?? project.status}
                </div>
              </div>
              <p className="font-mono text-[9.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-50">
                {project.summary ?? project.stackName ?? "No project summary saved yet."}
              </p>
              <div className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))] opacity-40">
                {relativeTime(project.lastActivityAt ?? project.updatedAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ActivityPulse({ activities }: { activities: PortfolioActivity[] }) {
  return (
    <section>
      <PaneSectionLabel>shipped / moved recently</PaneSectionLabel>
      {activities.length === 0 ? (
        <div className="border-l border-[hsl(var(--border))]/70 bg-[hsl(var(--bg))]/30 px-4 py-3 font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-45">
          no recent shipping events in the portfolio graph yet
        </div>
      ) : (
        <div className="space-y-2">
          {activities.slice(0, 6).map((activity) => (
            <div key={`${activity.projectSlug}-${activity.kind}-${activity.occurredAt}-${activity.title}`} className="grid gap-3 border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-3 md:grid-cols-[0.7fr_1fr_auto]">
              <div>
                <div className="font-mono text-[11px] text-[hsl(var(--text-primary))]">{activity.title}</div>
                <div className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-65">
                  {activity.projectSlug} / {activity.kind}
                </div>
              </div>
              <p className="font-mono text-[9.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-50">
                {activity.summary ?? activity.source}
              </p>
              <div className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))] opacity-40">
                {relativeTime(activity.occurredAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CapturePulse({ captures }: { captures: BrainDumpCapture[] }) {
  if (captures.length === 0) return null;
  return (
    <>
      <PaneDivider />
      <section>
        <PaneSectionLabel>latest brain dumps</PaneSectionLabel>
        <div className="space-y-2">
          {captures.slice(0, 4).map((capture) => (
            <div key={capture._id} className="grid gap-3 border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-3 md:grid-cols-[0.8fr_1fr_auto]">
              <div className="font-mono text-[11px] text-[hsl(var(--text-primary))]">
                {capture.summary ?? capture.rawText.slice(0, 96)}
              </div>
              <div className="font-mono text-[9.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-50">
                {(capture.insights ?? []).slice(0, 2).join(" / ") || capture.rawText.slice(0, 140)}
              </div>
              <div className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-65">
                {(capture.projectSlugs ?? []).join(", ") || "personal"}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function useTaskActions(clerkId?: string) {
  const updateTaskTriage = useMutation(api.portfolio.updateTaskTriage);
  const updateTaskDetails = useMutation(api.portfolio.updateTaskDetails);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState<string | null>(null);

  const setStatus = async (taskId: Id<"portfolioTasks">, status: string) => {
    if (!clerkId || busyTaskId) return;
    setBusyTaskId(String(taskId));
    setStatusLine(null);
    try {
      const result = await updateTaskTriage({ clerkId, taskId, status });
      setStatusLine(`task triaged: ${result.status} / ${result.priority}`);
    } catch (err) {
      setStatusLine(`task update failed: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setBusyTaskId(null);
    }
  };

  const setOwner = async (taskId: Id<"portfolioTasks">, ownerType: "human" | "agent", ownerLabel: string) => {
    if (!clerkId || busyTaskId) return;
    setBusyTaskId(String(taskId));
    setStatusLine(null);
    try {
      const result = await updateTaskDetails({ clerkId, taskId, ownerType, ownerLabel });
      setStatusLine(`task routed: ${result.ownerType}${result.projectSlug ? ` / ${result.projectSlug}` : " / personal"}`);
    } catch (err) {
      setStatusLine(`task route failed: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setBusyTaskId(null);
    }
  };

  const setPersonal = async (taskId: Id<"portfolioTasks">) => {
    if (!clerkId || busyTaskId) return;
    setBusyTaskId(String(taskId));
    setStatusLine(null);
    try {
      const result = await updateTaskDetails({ clerkId, taskId, projectSlug: null });
      setStatusLine(`task routed: ${result.ownerType} / personal`);
    } catch (err) {
      setStatusLine(`task route failed: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setBusyTaskId(null);
    }
  };

  return { busyTaskId, statusLine, setStatus, setOwner, setPersonal };
}

function partitionTasks(tasks: PortfolioTask[]) {
  const openTasks = tasks.filter((task) => !DONE_STATUSES.has(task.status)).sort(taskSort);
  return {
    openTasks,
    humanTasks: openTasks.filter((task) => task.ownerType === "human"),
    agentTasks: openTasks.filter((task) => task.ownerType === "agent"),
    personalTasks: openTasks.filter((task) => !task.projectSlug),
  };
}

function HomeSkillSyncProof({
  readiness,
  onOpenMachine,
}: {
  readiness: LocalMachineReadiness | null;
  onOpenMachine?: () => void;
}) {
  const skillSync = readiness?.skillSync;
  const proof = skillSync?.highlightedSkill;
  const readyCount = proof
    ? [
        proof.canonicalPresent,
        proof.renderedPresent,
        proof.claudePresent,
        proof.codexPresent,
        proof.catalogPresent,
        proof.stackMapPresent,
      ].filter(Boolean).length
    : 0;

  return (
    <div className="border-l border-[hsl(var(--success))]/70 bg-[hsl(var(--bg))]/30 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--accent))] opacity-70">
          live skill mesh
        </span>
        <span className={`ml-auto font-mono text-[8.5px] uppercase tracking-[0.14em] ${skillSync?.status === "ready" ? "text-[hsl(var(--success))]" : "text-[hsl(var(--accent))]"}`}>
          {skillSync?.status ?? "checking"}
        </span>
      </div>
      <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="font-mono text-[15px] leading-tight text-[hsl(var(--text-primary))]">
            {proof?.name ?? "project-clarity-audit"}
          </div>
          <p className="mt-2 max-w-3xl font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-58">
            A shared skill created on one Mac is now a canonical agent capability across trusted machines, Claude, Codex, and the You.md catalog.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))] opacity-45">
            {skillSync
              ? `${skillSync.canonicalCount} shared / ${skillSync.claudeMirrorCount} claude / ${skillSync.codexMirrorCount} codex / ${readyCount}/6 proof`
              : "reading local sync state"}
          </span>
          <button
            type="button"
            onClick={onOpenMachine}
            className="h-8 cursor-pointer border border-[hsl(var(--border))]/70 px-3 font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] transition-colors hover:border-[hsl(var(--accent))]"
            style={{ borderRadius: "var(--radius)" }}
          >
            machine proof
          </button>
        </div>
      </div>
    </div>
  );
}

function HomeDsiViewProof({
  dsiView,
  onOpenMachine,
  onOpenTasks,
  onOpenSkills,
}: {
  dsiView:
    | {
        view: { title: string; updatedAt: number };
        widgets: Array<{ widgetKey: string; title: string; sourceKind: string; liveEnabled: boolean }>;
        summary: { widgetCount: number; liveCount: number; sourceKinds: string[]; rawSecretsInBrowser: boolean };
      }
    | null
    | undefined;
  onOpenMachine?: () => void;
  onOpenTasks?: () => void;
  onOpenSkills?: () => void;
}) {
  const widgets = dsiView?.widgets ?? [];
  const visibleWidgets = widgets.slice(0, 6);
  return (
    <div className="border-l border-[hsl(var(--accent))]/60 bg-[hsl(var(--bg))]/30 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--accent))] opacity-70">
          DSI home view
        </span>
        <span className="ml-auto font-mono text-[8.5px] uppercase tracking-[0.14em] text-[hsl(var(--success))]">
          {dsiView ? "persisted" : dsiView === undefined ? "loading" : "initializing"}
        </span>
      </div>
      <div className="mt-2 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="font-mono text-[15px] leading-tight text-[hsl(var(--text-primary))]">
            {dsiView?.view.title ?? "Home"} is now a saved live View, not a fixed tab.
          </div>
          <p className="mt-2 max-w-3xl font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-58">
            This is the substrate for You Agent-created dashboards: widgets can be reordered, scoped to projects/tasks/machines, and synced through Convex without exposing raw secrets.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))] opacity-45">
            {dsiView
              ? `${dsiView.summary.liveCount}/${dsiView.summary.widgetCount} live widgets / secrets ${dsiView.summary.rawSecretsInBrowser ? "unsafe" : "redacted"}`
              : "creating default widgets"}
          </span>
          <button
            type="button"
            onClick={onOpenMachine}
            className="h-8 cursor-pointer border border-[hsl(var(--border))]/70 px-3 font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] transition-colors hover:border-[hsl(var(--accent))]"
            style={{ borderRadius: "var(--radius)" }}
          >
            mesh proof
          </button>
          <button
            type="button"
            onClick={onOpenTasks}
            className="h-8 cursor-pointer border border-[hsl(var(--border))]/70 px-3 font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))] opacity-65 transition-colors hover:border-[hsl(var(--accent))] hover:text-[hsl(var(--text-primary))]"
            style={{ borderRadius: "var(--radius)" }}
          >
            task board
          </button>
          <button
            type="button"
            onClick={onOpenSkills}
            className="h-8 cursor-pointer border border-[hsl(var(--border))]/70 px-3 font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))] opacity-65 transition-colors hover:border-[hsl(var(--accent))] hover:text-[hsl(var(--text-primary))]"
            style={{ borderRadius: "var(--radius)" }}
          >
            skills
          </button>
        </div>
      </div>
      {visibleWidgets.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {visibleWidgets.map((widget) => (
            <div key={widget.widgetKey} className="border-l border-[hsl(var(--border))]/65 bg-[hsl(var(--bg-raised))]/30 px-2.5 py-1.5">
              <div className="font-mono text-[9px] text-[hsl(var(--text-primary))]">{widget.title}</div>
              <div className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-[hsl(var(--text-secondary))] opacity-45">
                {widget.sourceKind} {widget.liveEnabled ? "/ live" : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HomeOperatingMesh({
  readiness,
  projects,
  openTasks,
  activities,
  onOpenMachine,
  onOpenAgents,
}: {
  readiness: LocalMachineReadiness | null;
  projects: PortfolioProject[];
  openTasks: PortfolioTask[];
  activities: PortfolioActivity[];
  onOpenMachine?: () => void;
  onOpenAgents?: () => void;
}) {
  const summary = readiness?.summary;
  const agentBus = readiness?.agentBus;
  const envVault = readiness?.envVault;
  const machineLabel = readiness?.hostName ?? "this Mac";
  const liveState = agentBus?.state === "active" ? "live" : readiness ? "checking" : "loading";
  const focusedCount = projects.filter((project) => {
    const focus = project.focusStatus ?? "";
    return project.status === "active" || focus === "top-priority" || focus === "focusing";
  }).length;
  const meshStats = [
    { label: "machines", value: readiness ? "1 local" : "loading" },
    { label: "daemons", value: summary ? `${summary.daemonsLoaded}/${summary.daemonsTotal}` : "--" },
    { label: "skills", value: readiness ? readiness.skillSync.canonicalCount : "--" },
    { label: "agent bus", value: agentBus ? `${agentBus.recentCount} msgs` : "--" },
    { label: "focus projects", value: focusedCount },
    { label: "open tasks", value: openTasks.length },
  ];

  return (
    <section className="border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--accent))] opacity-75">
              machine you sync mesh
            </span>
            <span className={`font-mono text-[8.5px] uppercase tracking-[0.14em] ${liveState === "live" ? "text-[hsl(var(--success))]" : "text-[hsl(var(--text-secondary))] opacity-45"}`}>
              {liveState}
            </span>
          </div>
          <div className="mt-3 font-mono text-[18px] leading-tight text-[hsl(var(--text-primary))]">
            {machineLabel} is materializing your brain into agents, skills, projects, env vault, and logs.
          </div>
          <p className="mt-2 max-w-4xl font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-55">
            This is the living proof surface: project changes, skill syncs, trusted-device vault state, and agent messages should all flow through one brain activity stream.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 xl:justify-end">
          <button type="button" onClick={onOpenAgents} className="h-8 cursor-pointer border border-[hsl(var(--border))]/70 px-3 font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] transition-colors hover:border-[hsl(var(--accent))]" style={{ borderRadius: "var(--radius)" }}>
            agents
          </button>
          <button type="button" onClick={onOpenMachine} className="h-8 cursor-pointer border border-[hsl(var(--border))]/70 px-3 font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))] opacity-65 transition-colors hover:border-[hsl(var(--accent))] hover:text-[hsl(var(--text-primary))]" style={{ borderRadius: "var(--radius)" }}>
            machine
          </button>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        {meshStats.map((stat) => (
          <div key={stat.label} className="border-l border-[hsl(var(--border))]/55 bg-[hsl(var(--bg-raised))]/22 px-3 py-2">
            <div className="font-mono text-[14px] leading-none text-[hsl(var(--text-primary))]">{stat.value}</div>
            <div className="mt-2 font-mono text-[8px] uppercase tracking-[0.15em] text-[hsl(var(--text-secondary))] opacity-42">{stat.label}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-2 xl:grid-cols-[1fr_1fr]">
        <div className="font-mono text-[9.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-50">
          vault: {envVault?.accountSnapshotStatus ?? "unknown"}{envVault?.latestAccountSnapshot?.projectCount ? ` / ${envVault.latestAccountSnapshot.projectCount} projects` : ""}
        </div>
        <div className="font-mono text-[9.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-50 xl:text-right">
          latest shipping signal: {activities[0] ? `${activities[0].projectSlug} / ${relativeTime(activities[0].occurredAt)}` : "waiting for brain activity"}
        </div>
      </div>
    </section>
  );
}

export function HomePane({
  clerkId,
  onOpenPane,
}: {
  clerkId?: string;
  onOpenPane?: (pane: TaskPaneKey) => void;
}) {
  const graph = useQuery(api.portfolio.listPortfolioGraph, clerkId ? { clerkId } : "skip");
  const dsiView = useQuery(api.dsi.getDefaultHomeView, clerkId ? { clerkId } : "skip");
  const ensureDefaultHomeView = useMutation(api.dsi.ensureDefaultHomeView);
  const { busyTaskId, statusLine, setStatus, setOwner, setPersonal } = useTaskActions(clerkId);
  const [machineReadiness, setMachineReadiness] = useState<LocalMachineReadiness | null>(null);

  const tasks = useMemo(() => (graph?.tasks ?? []) as PortfolioTask[], [graph?.tasks]);
  const projects = useMemo(() => (graph?.projects ?? []) as PortfolioProject[], [graph?.projects]);
  const activities = useMemo(() => (graph?.projectActivities ?? []) as PortfolioActivity[], [graph?.projectActivities]);
  const captures = useMemo(() => (graph?.recentCaptures ?? []) as BrainDumpCapture[], [graph?.recentCaptures]);
  const { openTasks, humanTasks, agentTasks, personalTasks } = useMemo(() => partitionTasks(tasks), [tasks]);
  const focusedProjects = useMemo(() => {
    return projects
      .filter((project) => {
        const focus = project.focusStatus ?? "";
        return project.status === "active" || focus === "top-priority" || focus === "focusing";
      })
      .sort((a, b) => (a.focusRank ?? 99) - (b.focusRank ?? 99) || (b.lastActivityAt ?? b.updatedAt ?? 0) - (a.lastActivityAt ?? a.updatedAt ?? 0));
  }, [projects]);
  const recentActivity = useMemo(() => {
    return activities
      .slice()
      .sort((a, b) => b.occurredAt - a.occurredAt)
      .slice(0, 8);
  }, [activities]);

  useEffect(() => {
    let cancelled = false;
    async function loadMachineReadiness() {
      try {
        const response = await fetch("/api/local/machine-readiness?root=current", {
          cache: "no-store",
          credentials: "include",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as LocalMachineReadiness;
        if (!cancelled) setMachineReadiness(payload);
      } catch {
        if (!cancelled) setMachineReadiness(null);
      }
    }
    void loadMachineReadiness();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!clerkId || dsiView !== null) return;
    void ensureDefaultHomeView({ clerkId }).catch(() => {
      // The Home pane can still render from the portfolio graph while the DSI
      // substrate initializes; do not block the core task view.
    });
  }, [clerkId, dsiView, ensureDefaultHomeView]);

  return (
    <>
      <PaneHeader>home</PaneHeader>
      <div className="space-y-6 p-6">
        <PaneCallout label="today">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="max-w-4xl font-mono text-[22px] leading-tight text-[hsl(var(--text-primary))]">
                Your live operating system for projects, tasks, machines, skills, and agents.
              </h2>
              <p className="mt-3 max-w-4xl font-mono text-[11px] leading-5 text-[hsl(var(--text-secondary))] opacity-60">
                Home is becoming a DSI surface: ask the You Agent to add widgets, scope them to projects or machines, and keep the live brain stream close to the work.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => onOpenPane?.("tasks")} className="h-8 cursor-pointer border border-[hsl(var(--border))]/70 px-3 font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] transition-colors hover:border-[hsl(var(--accent))]" style={{ borderRadius: "var(--radius)" }}>
                open tasks
              </button>
              <button type="button" onClick={() => onOpenPane?.("portfolio")} className="h-8 cursor-pointer border border-[hsl(var(--border))]/70 px-3 font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))] opacity-65 transition-colors hover:border-[hsl(var(--accent))] hover:text-[hsl(var(--text-primary))]" style={{ borderRadius: "var(--radius)" }}>
                projects
              </button>
            </div>
          </div>
        </PaneCallout>

        <div className="grid gap-2 md:grid-cols-4">
          <MiniStat value={humanTasks.length} label="needs Houston" />
          <MiniStat value={agentTasks.length} label="agent queue" />
          <MiniStat value={personalTasks.length} label="personal tasks" />
          <MiniStat value={focusedProjects.length} label="focused projects" />
        </div>

        <HomeSkillSyncProof readiness={machineReadiness} onOpenMachine={() => onOpenPane?.("machine")} />
        <HomeDsiViewProof
          dsiView={dsiView}
          onOpenMachine={() => onOpenPane?.("machine")}
          onOpenTasks={() => onOpenPane?.("tasks")}
          onOpenSkills={() => onOpenPane?.("skills")}
        />
        <HomeOperatingMesh
          readiness={machineReadiness}
          projects={projects}
          openTasks={openTasks}
          activities={recentActivity}
          onOpenMachine={() => onOpenPane?.("machine")}
          onOpenAgents={() => onOpenPane?.("agents")}
        />

        {statusLine && (
          <div className="border-l border-[hsl(var(--accent))]/70 bg-[hsl(var(--accent))]/[0.035] px-4 py-2 font-mono text-[9.5px] uppercase tracking-[0.12em] text-[hsl(var(--accent))]">
            {statusLine}
          </div>
        )}

        {graph === undefined ? (
          <PaneEmptyState>loading your project and task graph...</PaneEmptyState>
        ) : openTasks.length === 0 && focusedProjects.length === 0 ? (
          <PaneEmptyState>no active tasks or focused projects yet</PaneEmptyState>
        ) : (
          <>
            <TaskQueue
              label="needs Houston"
              tasks={humanTasks.slice(0, 5)}
              empty="no human-owned tasks waiting"
              busyTaskId={busyTaskId}
              onStatus={setStatus}
              onOwner={setOwner}
              onPersonal={setPersonal}
              compact
            />
            <PaneDivider />
            <TaskQueue
              label="agent queue"
              tasks={agentTasks.slice(0, 5)}
              empty="no agent-owned tasks waiting"
              busyTaskId={busyTaskId}
              onStatus={setStatus}
              onOwner={setOwner}
              onPersonal={setPersonal}
              compact
            />
            <PaneDivider />
            <ProjectPulse projects={focusedProjects} />
            <PaneDivider />
            <ActivityPulse activities={recentActivity} />
            <CapturePulse captures={captures} />
          </>
        )}
      </div>
    </>
  );
}

export function TasksPane({ clerkId }: { clerkId?: string }) {
  const graph = useQuery(api.portfolio.listPortfolioGraph, clerkId ? { clerkId, includeDoneTasks: true } : "skip");
  const { busyTaskId, statusLine, setStatus, setOwner, setPersonal } = useTaskActions(clerkId);
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [ownerFilter, setOwnerFilter] = useState<"all" | "human" | "agent">("all");
  const [scopeFilter, setScopeFilter] = useState<"all" | "personal" | "project">("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "done">("active");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const tasks = useMemo(() => (graph?.tasks ?? []) as PortfolioTask[], [graph?.tasks]);
  const projects = useMemo(() => (graph?.projects ?? []) as PortfolioProject[], [graph?.projects]);
  const projectsBySlug = useMemo(() => {
    const next = new Map<string, PortfolioProject>();
    for (const project of projects) next.set(project.slug, project);
    return next;
  }, [projects]);
  const projectOptions = useMemo(() => {
    const projectMap = new Map<string, Pick<PortfolioProject, "slug" | "name" | "status" | "focusStatus" | "focusRank" | "lastActivityAt" | "updatedAt">>();
    for (const project of projects) projectMap.set(project.slug, project);
    for (const task of tasks) {
      if (task.projectSlug && !projectMap.has(task.projectSlug)) {
        projectMap.set(task.projectSlug, { slug: task.projectSlug, name: task.projectSlug, status: "unknown" });
      }
    }
    return Array.from(projectMap.values()).sort((a, b) => {
      const focusA = a.focusStatus === "top-priority" ? 0 : a.focusStatus === "focusing" ? 1 : a.status === "active" ? 2 : 3;
      const focusB = b.focusStatus === "top-priority" ? 0 : b.focusStatus === "focusing" ? 1 : b.status === "active" ? 2 : 3;
      return focusA - focusB || (a.focusRank ?? 99) - (b.focusRank ?? 99) || a.name.localeCompare(b.name);
    });
  }, [projects, tasks]);
  const filteredTasks = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    return tasks
      .filter((task) => {
        if (statusFilter === "active" && DONE_STATUSES.has(task.status)) return false;
        if (statusFilter === "done" && !DONE_STATUSES.has(task.status)) return false;
        if (ownerFilter !== "all" && task.ownerType !== ownerFilter) return false;
        if (scopeFilter === "personal" && task.projectSlug) return false;
        if (scopeFilter === "project" && !task.projectSlug) return false;
        if (projectFilter === "personal" && task.projectSlug) return false;
        if (projectFilter !== "all" && projectFilter !== "personal" && task.projectSlug !== projectFilter) return false;
        if (normalizedSearch) {
          const haystack = [
            task.title,
            task.description,
            task.ownerLabel,
            task.projectSlug,
            ...task.tags,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(normalizedSearch)) return false;
        }
        return true;
      })
      .sort(taskSort);
  }, [ownerFilter, projectFilter, scopeFilter, searchQuery, statusFilter, tasks]);
  const { humanTasks, agentTasks, personalTasks } = useMemo(() => partitionTasks(tasks), [tasks]);
  const taskColumns = useMemo(() => {
    const columns = statusFilter === "done" ? DONE_TASK_COLUMNS : ACTIVE_TASK_COLUMNS;
    return columns.map((column) => ({
      ...column,
      tasks: filteredTasks.filter((task) => normalizedBoardStatus(task.status, statusFilter) === column.key),
    }));
  }, [filteredTasks, statusFilter]);

  const filters = [
    { key: "active", label: "active", onClick: () => setStatusFilter("active"), active: statusFilter === "active" },
    { key: "done", label: "done", onClick: () => setStatusFilter("done"), active: statusFilter === "done" },
    { key: "all", label: "all owners", onClick: () => setOwnerFilter("all"), active: ownerFilter === "all" },
    { key: "human", label: "me", onClick: () => setOwnerFilter("human"), active: ownerFilter === "human" },
    { key: "agent", label: "agent", onClick: () => setOwnerFilter("agent"), active: ownerFilter === "agent" },
    { key: "all-scope", label: "all scope", onClick: () => setScopeFilter("all"), active: scopeFilter === "all" },
    { key: "personal", label: "personal", onClick: () => setScopeFilter("personal"), active: scopeFilter === "personal" },
    { key: "project", label: "projects", onClick: () => setScopeFilter("project"), active: scopeFilter === "project" },
  ];

  return (
    <>
      <PaneHeader>tasks</PaneHeader>
      <div className="space-y-6 p-6">
        <PaneCallout label="global task router">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div>
              <h2 className="font-mono text-[22px] leading-tight text-[hsl(var(--text-primary))]">
                Board, list, personal work, and project work share one task router.
              </h2>
              <p className="mt-3 max-w-4xl font-mono text-[11px] leading-5 text-[hsl(var(--text-secondary))] opacity-60">
                Use the board for execution state, list for audits, and project filters when you need a founder-level slice without losing personal or agent-owned work.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 xl:min-w-[320px]">
              <MiniStat value={humanTasks.length} label="me" />
              <MiniStat value={agentTasks.length} label="agent" />
              <MiniStat value={personalTasks.length} label="personal" />
            </div>
          </div>
        </PaneCallout>

        <div className="grid gap-3 xl:grid-cols-[auto_minmax(220px,320px)_minmax(220px,1fr)] xl:items-center">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setViewMode("board")}
              className={[
                "flex h-8 cursor-pointer items-center gap-1.5 border px-2.5 font-mono text-[8.5px] uppercase tracking-[0.12em] transition-colors",
                viewMode === "board"
                  ? "border-[hsl(var(--accent))] text-[hsl(var(--accent))]"
                  : "border-[hsl(var(--border))]/60 text-[hsl(var(--text-secondary))] opacity-60 hover:border-[hsl(var(--accent))] hover:text-[hsl(var(--text-primary))]",
              ].join(" ")}
              style={{ borderRadius: "var(--radius)" }}
            >
              <Columns3 size={12} aria-hidden="true" />
              board
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={[
                "flex h-8 cursor-pointer items-center gap-1.5 border px-2.5 font-mono text-[8.5px] uppercase tracking-[0.12em] transition-colors",
                viewMode === "list"
                  ? "border-[hsl(var(--accent))] text-[hsl(var(--accent))]"
                  : "border-[hsl(var(--border))]/60 text-[hsl(var(--text-secondary))] opacity-60 hover:border-[hsl(var(--accent))] hover:text-[hsl(var(--text-primary))]",
              ].join(" ")}
              style={{ borderRadius: "var(--radius)" }}
            >
              <List size={12} aria-hidden="true" />
              list
            </button>
          </div>
          <select
            aria-label="filter tasks by project"
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
            className="h-8 w-full border border-[hsl(var(--border))]/60 bg-[hsl(var(--bg))]/70 px-2.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[hsl(var(--text-secondary))] outline-none transition-colors focus:border-[hsl(var(--accent))]"
            style={{ borderRadius: "var(--radius)" }}
          >
            <option value="all">all projects + personal</option>
            <option value="personal">personal only</option>
            {projectOptions.map((project) => (
              <option key={project.slug} value={project.slug}>
                {project.name}
              </option>
            ))}
          </select>
          <input
            aria-label="search tasks"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="search tasks, tags, projects..."
            className="h-8 w-full border border-[hsl(var(--border))]/60 bg-[hsl(var(--bg))]/70 px-2.5 font-mono text-[9px] text-[hsl(var(--text-primary))] outline-none placeholder:text-[hsl(var(--text-secondary))] placeholder:opacity-35 focus:border-[hsl(var(--accent))]"
            style={{ borderRadius: "var(--radius)" }}
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {filters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={filter.onClick}
              className={[
                "h-8 cursor-pointer border px-2.5 font-mono text-[8.5px] uppercase tracking-[0.12em] transition-colors",
                filter.active
                  ? "border-[hsl(var(--accent))] text-[hsl(var(--accent))]"
                  : "border-[hsl(var(--border))]/60 text-[hsl(var(--text-secondary))] opacity-60 hover:border-[hsl(var(--accent))] hover:text-[hsl(var(--text-primary))]",
              ].join(" ")}
              style={{ borderRadius: "var(--radius)" }}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {statusLine && (
          <div className="border-l border-[hsl(var(--accent))]/70 bg-[hsl(var(--accent))]/[0.035] px-4 py-2 font-mono text-[9.5px] uppercase tracking-[0.12em] text-[hsl(var(--accent))]">
            {statusLine}
          </div>
        )}

        {graph === undefined ? (
          <PaneEmptyState>loading tasks...</PaneEmptyState>
        ) : filteredTasks.length === 0 ? (
          <PaneEmptyState>no tasks match this view</PaneEmptyState>
        ) : viewMode === "board" ? (
          <section>
            <PaneSectionLabel>{filteredTasks.length} tasks / {projectFilter === "all" ? "all scopes" : projectFilter === "personal" ? "personal" : projectDisplayName(projectFilter, projectsBySlug)}</PaneSectionLabel>
            <div className={statusFilter === "done" ? "grid gap-3 xl:grid-cols-2" : "grid gap-3 xl:grid-cols-4"}>
              {taskColumns.map((column) => (
                <TaskBoardColumn
                  key={column.key}
                  label={column.label}
                  empty={column.empty}
                  tasks={column.tasks}
                  busyTaskId={busyTaskId}
                  projectsBySlug={projectsBySlug}
                  onStatus={setStatus}
                  onOwner={setOwner}
                  onPersonal={setPersonal}
                />
              ))}
            </div>
          </section>
        ) : (
          <TaskQueue
            label={`${filteredTasks.length} task${filteredTasks.length === 1 ? "" : "s"}`}
            tasks={filteredTasks}
            empty="no tasks"
            busyTaskId={busyTaskId}
            onStatus={setStatus}
            onOwner={setOwner}
            onPersonal={setPersonal}
            projectsBySlug={projectsBySlug}
          />
        )}

        <PaneDivider />
        <section>
          <PaneSectionLabel>shell commands</PaneSectionLabel>
          <div className="grid gap-2 lg:grid-cols-3">
            {[
              { icon: ListTodo, label: "/task", text: "create or update a task from chat" },
              { icon: UserRound, label: "owner: me", text: "human-gated work that needs Houston" },
              { icon: Bot, label: "owner: agent", text: "autonomous work an agent can execute" },
              { icon: FolderGit2, label: "projectSlug", text: "route work into a specific project" },
              { icon: Clock3, label: "/braindump", text: "capture raw ideas, then extract tasks" },
              { icon: Check, label: "done", text: "close work when verified" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="border-l border-[hsl(var(--border))]/75 bg-[hsl(var(--bg))]/35 px-4 py-3">
                  <div className="flex items-center gap-2 font-mono text-[10.5px] text-[hsl(var(--text-primary))]">
                    <Icon size={13} className="text-[hsl(var(--accent))]" aria-hidden="true" />
                    <span>{item.label}</span>
                  </div>
                  <p className="mt-2 font-mono text-[9.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-50">
                    {item.text}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
