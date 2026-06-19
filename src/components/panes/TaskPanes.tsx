"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Bot, Check, Clock3, FolderGit2, ListTodo, UserRound } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
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
}: {
  task: PortfolioTask;
  busy: boolean;
  onStatus: (status: string) => void;
  onOwner: (ownerType: "human" | "agent", ownerLabel: string) => void;
  onPersonal: () => void;
  compact?: boolean;
}) {
  return (
    <div className="grid gap-3 border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto]">
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
          <span>{taskScope(task)}</span>
          <span>{task.dueAt ? `due ${new Date(task.dueAt).toLocaleDateString()}` : "no due date"}</span>
          <span>updated {relativeTime(task.updatedAt)}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-1.5 lg:justify-end">
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
}: {
  label: string;
  tasks: PortfolioTask[];
  empty: string;
  busyTaskId: string | null;
  onStatus: (taskId: Id<"portfolioTasks">, status: string) => void;
  onOwner: (taskId: Id<"portfolioTasks">, ownerType: "human" | "agent", ownerLabel: string) => void;
  onPersonal: (taskId: Id<"portfolioTasks">) => void;
  compact?: boolean;
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

export function HomePane({
  clerkId,
  onOpenPane,
}: {
  clerkId?: string;
  onOpenPane?: (pane: TaskPaneKey) => void;
}) {
  const graph = useQuery(api.portfolio.listPortfolioGraph, clerkId ? { clerkId } : "skip");
  const { busyTaskId, statusLine, setStatus, setOwner, setPersonal } = useTaskActions(clerkId);

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

  return (
    <>
      <PaneHeader>home</PaneHeader>
      <div className="space-y-6 p-6">
        <PaneCallout label="today">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="max-w-4xl font-mono text-[22px] leading-tight text-[hsl(var(--text-primary))]">
                Tasks, project focus, and agent handoffs in one place.
              </h2>
              <p className="mt-3 max-w-4xl font-mono text-[11px] leading-5 text-[hsl(var(--text-secondary))] opacity-60">
                Human-owned work stays separate from agent-owned work, with personal tasks and project-scoped tasks visible together.
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
  const [ownerFilter, setOwnerFilter] = useState<"all" | "human" | "agent">("all");
  const [scopeFilter, setScopeFilter] = useState<"all" | "personal" | "project">("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "done">("active");

  const tasks = useMemo(() => (graph?.tasks ?? []) as PortfolioTask[], [graph?.tasks]);
  const filteredTasks = useMemo(() => {
    return tasks
      .filter((task) => {
        if (statusFilter === "active" && DONE_STATUSES.has(task.status)) return false;
        if (statusFilter === "done" && !DONE_STATUSES.has(task.status)) return false;
        if (ownerFilter !== "all" && task.ownerType !== ownerFilter) return false;
        if (scopeFilter === "personal" && task.projectSlug) return false;
        if (scopeFilter === "project" && !task.projectSlug) return false;
        return true;
      })
      .sort(taskSort);
  }, [ownerFilter, scopeFilter, statusFilter, tasks]);
  const { humanTasks, agentTasks, personalTasks } = useMemo(() => partitionTasks(tasks), [tasks]);

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
                Project tasks and personal tasks share one queue.
              </h2>
              <p className="mt-3 max-w-4xl font-mono text-[11px] leading-5 text-[hsl(var(--text-secondary))] opacity-60">
                Route work to Houston or the agent, keep personal braindump tasks visible, and avoid losing execution items inside one project page.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 xl:min-w-[320px]">
              <MiniStat value={humanTasks.length} label="me" />
              <MiniStat value={agentTasks.length} label="agent" />
              <MiniStat value={personalTasks.length} label="personal" />
            </div>
          </div>
        </PaneCallout>

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
        ) : (
          <TaskQueue
            label={`${filteredTasks.length} task${filteredTasks.length === 1 ? "" : "s"}`}
            tasks={filteredTasks}
            empty="no tasks"
            busyTaskId={busyTaskId}
            onStatus={setStatus}
            onOwner={setOwner}
            onPersonal={setPersonal}
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
