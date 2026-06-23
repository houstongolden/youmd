"use client";

import { PROJECTS, STACKS, type Task, type ViewId } from "../../_data/mock";
import { useRealData } from "../../_lib/RealDataContext";
import { Icon } from "../icons";
import { Dot, Chip, SectionLabel } from "../primitives";
import { cn } from "../../_lib/cn";

type Row = { id: string; name: string; focus: "focusing" | "active" | "idle"; metric: number; badge?: string };

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
  const real = useRealData();
  const live = Boolean(real?.available);

  const rows: Row[] = live
    ? real!.projects.map((p) => ({
        id: p.name,
        name: p.name,
        focus: p.isBrainRepo ? "focusing" : p.hasEnvLocal ? "active" : "idle",
        metric: p.files.length,
        badge: p.label,
      }))
    : PROJECTS.map((p) => ({ id: p.slug, name: p.name, focus: p.focus, metric: p.shipped7d }));

  const activeId = rows.find((r) => r.id === selected)?.id ?? rows[0]?.id;
  const rp = live ? real!.projects.find((p) => p.name === activeId) ?? real!.projects[0] : null;
  const mp = !live ? PROJECTS.find((p) => p.slug === activeId) ?? PROJECTS[0] : null;
  const name = rp?.name ?? mp?.name ?? "";
  const tasks = allTasks.filter((t) => t.project === name);
  const stack = STACKS.find((s) => s.projects.includes(name));

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <aside className="max-h-44 w-full shrink-0 overflow-y-auto border-b border-[hsl(var(--border))] py-2 lg:max-h-none lg:w-60 lg:border-b-0 lg:border-r">
        <SectionLabel className="px-4 py-2">Projects · {rows.length}{live ? " · live" : ""}</SectionLabel>
        {rows.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={cn(
              "flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13px] transition-colors",
              activeId === p.id ? "bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))]" : "text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg))]",
            )}
          >
            <Dot tone={p.focus === "focusing" ? "orange" : p.focus === "active" ? "green" : "dim"} size={6} />
            <span className="flex-1 truncate font-mono">{p.name}</span>
            {p.badge ? (
              <Icon name="brain" size={11} className="text-[hsl(var(--accent))]" />
            ) : (
              <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))]/50">{p.metric}</span>
            )}
          </button>
        ))}
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
        <div className="mb-1 flex items-center gap-2">
          <h2 className="font-mono text-xl font-semibold tracking-tight">{name}</h2>
          {rp?.label && <Chip tone="accent">{rp.label}</Chip>}
          {!rp && mp?.focus === "focusing" && <Chip tone="accent">focusing</Chip>}
        </div>
        <p className="mb-5 text-[13px] text-[hsl(var(--text-secondary))]/80">{rp?.blurb ?? rp?.remote ?? mp?.blurb}</p>

        {live && rp ? (
          <>
            <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { label: "Files", value: rp.files.length },
                { label: "env.local", value: rp.hasEnvLocal ? "✓" : "—" },
                { label: "Agent docs", value: rp.hasAgentDocs ? "✓" : "—" },
              ].map((m) => (
                <div key={m.label} className="rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-3">
                  <SectionLabel>{m.label}</SectionLabel>
                  <div className="mt-1.5 truncate font-mono text-base">{m.value}</div>
                </div>
              ))}
            </div>
            <SectionLabel className="mb-2">Directory</SectionLabel>
            <div className="mb-6 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              {rp.files.map((f) => (
                <div key={f} className="flex items-center gap-1.5 truncate font-mono text-[12px] text-[hsl(var(--text-secondary))]/80">
                  <Icon name={f.endsWith("/") ? "folder" : "file"} size={11} className="shrink-0 opacity-60" />
                  <span className="truncate">{f}</span>
                </div>
              ))}
            </div>
            <SectionLabel className="mb-2">Links</SectionLabel>
            <div className="space-y-2 font-mono text-[12px] text-[hsl(var(--text-secondary))]">
              <div className="flex items-center gap-2"><Icon name="github" size={13} /> <span className="truncate">{rp.remote ?? "no remote"}</span></div>
              <div className="flex items-center gap-2"><Icon name="brain" size={13} className="text-[hsl(var(--accent))]" /> <button onClick={() => onNavigate("editor")} className="hover:text-[hsl(var(--accent))]">open in Vault</button></div>
            </div>
          </>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { label: "Shipped · 7d", value: `+${mp?.shipped7d ?? 0}` },
                { label: "Open tasks", value: tasks.filter((t) => t.status !== "done").length },
                { label: "Stack", value: stack?.name ?? "—" },
              ].map((m) => (
                <div key={m.label} className="rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-3">
                  <SectionLabel>{m.label}</SectionLabel>
                  <div className="mt-1.5 truncate font-mono text-base">{m.value}</div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {tasks.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] px-3.5 py-2.5">
                  <Dot tone={t.status === "done" ? "green" : t.priority === "high" ? "orange" : "dim"} size={6} />
                  <span className="flex-1 text-[13px]">{t.title}</span>
                  <Chip tone={t.owner === "agent" ? "accent" : "default"}>{t.owner}</Chip>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
