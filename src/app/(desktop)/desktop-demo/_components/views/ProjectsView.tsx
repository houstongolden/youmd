"use client";

import { PROJECTS, STACKS, type Task, type ViewId } from "../../_data/mock";
import { Icon } from "../icons";
import { Dot, Chip, SectionLabel } from "../primitives";
import { cn } from "../../_lib/cn";

export function ProjectsView({
  selected,
  onSelect,
  onNavigate,
  tasks: allTasks,
}: {
  selected: string;
  onSelect: (slug: string) => void;
  onNavigate: (v: ViewId) => void;
  tasks: Task[];
}) {
  const project = PROJECTS.find((p) => p.slug === selected) ?? PROJECTS[0];
  const tasks = allTasks.filter((t) => t.project === project.name);
  const stack = STACKS.find((s) => s.projects.includes(project.name));

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Project list */}
      <aside className="max-h-44 w-full shrink-0 overflow-y-auto border-b border-[hsl(var(--border))] py-2 md:max-h-none md:w-60 md:border-b-0 md:border-r">
        <SectionLabel className="px-4 py-2">Projects · {PROJECTS.length}</SectionLabel>
        {PROJECTS.map((p) => (
          <button
            key={p.slug}
            onClick={() => onSelect(p.slug)}
            className={cn(
              "flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13px] transition-colors",
              selected === p.slug
                ? "bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))]"
                : "text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg))]",
            )}
          >
            <Dot tone={p.focus === "focusing" ? "orange" : p.focus === "active" ? "green" : "dim"} size={6} />
            <span className="flex-1 truncate font-mono">{p.name}</span>
            <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))]/50">+{p.shipped7d}</span>
          </button>
        ))}
      </aside>

      {/* Project detail */}
      <div className="min-w-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
        <div className="mb-1 flex items-center gap-2">
          <h2 className="font-mono text-xl font-semibold tracking-tight">{project.name}</h2>
          {project.focus === "focusing" && <Chip tone="accent">focusing</Chip>}
        </div>
        <p className="mb-5 text-[13px] text-[hsl(var(--text-secondary))]/80">{project.blurb}</p>

        <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: "Shipped · 7d", value: `+${project.shipped7d}` },
            { label: "Open tasks", value: tasks.filter((t) => t.status !== "done").length },
            { label: "Stack", value: stack?.name ?? "—" },
          ].map((m) => (
            <div key={m.label} className="rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-3">
              <SectionLabel>{m.label}</SectionLabel>
              <div className="mt-1.5 truncate font-mono text-base">{m.value}</div>
            </div>
          ))}
        </div>

        {/* Tasks for this project */}
        <div className="mb-5 flex items-center justify-between">
          <SectionLabel>Tasks</SectionLabel>
          <button
            onClick={() => onNavigate("tasks")}
            className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))] transition-colors hover:text-[hsl(var(--accent))]"
          >
            all tasks →
          </button>
        </div>
        <div className="mb-6 space-y-2">
          {tasks.length === 0 ? (
            <div className="rounded-sm border border-dashed border-[hsl(var(--border))] px-3 py-5 text-center font-mono text-[11px] text-[hsl(var(--text-secondary))]/40">
              no open tasks
            </div>
          ) : (
            tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] px-3.5 py-2.5">
                <Dot tone={t.status === "done" ? "green" : t.priority === "high" ? "orange" : "dim"} size={6} />
                <span className={cn("flex-1 text-[13px]", t.status === "done" && "text-[hsl(var(--text-secondary))] line-through")}>
                  {t.title}
                </span>
                <Chip tone={t.owner === "agent" ? "accent" : "default"}>
                  {t.owner === "agent" ? "agent" : "you"}
                </Chip>
              </div>
            ))
          )}
        </div>

        {/* Stack + repo */}
        <SectionLabel className="mb-2">Capabilities &amp; links</SectionLabel>
        <div className="space-y-2 font-mono text-[12px]">
          <div className="flex items-center gap-2 text-[hsl(var(--text-secondary))]">
            <Icon name="stack" size={13} className="text-[hsl(var(--accent))]" />
            <button onClick={() => onNavigate("skills")} className="hover:text-[hsl(var(--accent))]">
              {stack ? `${stack.name} · ${stack.skills.length} skills` : "no stack assigned"}
            </button>
          </div>
          <div className="flex items-center gap-2 text-[hsl(var(--text-secondary))]">
            <Icon name="github" size={13} />
            <span>github.com/houstongolden/{project.slug}</span>
          </div>
          <div className="flex items-center gap-2 text-[hsl(var(--text-secondary))]">
            <Icon name="branch" size={13} />
            <span>you.md/api/v1 · MCP connected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
