"use client";

import type { ReactNode } from "react";
import {
  PROJECTS,
  GRAPH_NODES,
  TASKS,
  SKILLS,
  STACKS,
  type ViewId,
} from "../_data/mock";
import { Icon } from "./icons";
import { Chip, Dot, SectionLabel } from "./primitives";

// One context-sensitive right dock that replaces ~8 of the old "detail panes".
// It reflects the current selection: a project, a graph node, or the workspace.
export function Inspector({
  view,
  selectedProject,
  selectedNode,
  onClose,
  onNavigate,
}: {
  view: ViewId;
  selectedProject: string;
  selectedNode: string | null;
  onClose: () => void;
  onNavigate: (v: ViewId) => void;
}) {
  const node = selectedNode ? GRAPH_NODES.find((n) => n.id === selectedNode) : null;
  const project =
    view === "projects" || (node && node.kind === "project")
      ? PROJECTS.find((p) => p.slug === selectedProject) ?? PROJECTS[0]
      : null;

  return (
    <aside className="flex h-full w-full flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--bg))]">
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-3.5 py-2.5">
        <SectionLabel>Inspector</SectionLabel>
        <button
          onClick={onClose}
          className="text-[hsl(var(--text-secondary))] transition-colors hover:text-[hsl(var(--text-primary))]"
          aria-label="Close inspector"
        >
          <Icon name="close" size={14} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
        {node && node.kind !== "project" ? (
          <NodeDetail nodeId={node.id} label={node.label} kind={node.kind} />
        ) : project ? (
          <ProjectDetail slug={project.slug} onNavigate={onNavigate} />
        ) : (
          <WorkspaceDetail />
        )}
      </div>
    </aside>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/60">{k}</span>
      <span className="text-right text-[12px] text-[hsl(var(--text-primary))]">{v}</span>
    </div>
  );
}

function ProjectDetail({ slug, onNavigate }: { slug: string; onNavigate: (v: ViewId) => void }) {
  const p = PROJECTS.find((x) => x.slug === slug) ?? PROJECTS[0];
  const tasks = TASKS.filter((t) => t.project === p.name);
  const stack = STACKS.find((s) => s.projects.includes(p.name));
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Icon name="branch" size={16} className="text-[hsl(var(--accent))]" />
        <span className="font-mono text-[15px] font-semibold text-[hsl(var(--text-primary))]">{p.name}</span>
      </div>
      <p className="mb-3 text-[12px] leading-relaxed text-[hsl(var(--text-secondary))]/80">{p.blurb}</p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <Chip tone={p.focus === "focusing" ? "accent" : p.focus === "active" ? "green" : "default"}>{p.focus}</Chip>
        <Chip>{p.stack}</Chip>
      </div>
      <div className="border-t border-[hsl(var(--border))] pt-2">
        <Row k="shipped 7d" v={p.shipped7d} />
        <Row k="open tasks" v={tasks.length} />
        {stack && <Row k="stack" v={stack.name} />}
        {stack && <Row k="skills" v={stack.skills.length} />}
      </div>
      {tasks.length > 0 && (
        <div className="mt-3 border-t border-[hsl(var(--border))] pt-2.5">
          <SectionLabel className="mb-1.5">Tasks</SectionLabel>
          {tasks.slice(0, 4).map((t) => (
            <div key={t.id} className="flex items-center gap-2 py-1 text-[12px] text-[hsl(var(--text-secondary))]">
              <Dot tone={t.status === "done" ? "green" : t.status === "in_progress" ? "orange" : "dim"} size={6} />
              <span className="truncate">{t.title}</span>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={() => onNavigate("graph")}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-sm border border-[hsl(var(--border))] py-1.5 font-mono text-[11px] text-[hsl(var(--text-secondary))] transition-colors hover:border-[hsl(var(--accent))]/40 hover:text-[hsl(var(--accent))]"
      >
        <Icon name="graph" size={13} /> view in graph
      </button>
    </div>
  );
}

const KIND_LABEL: Record<string, string> = {
  skill: "Skill",
  note: "Note",
  agent: "Agent",
  app: "Connection",
  project: "Project",
};

function NodeDetail({ nodeId, label, kind }: { nodeId: string; label: string; kind: string }) {
  const skill = kind === "skill" ? SKILLS.find((s) => s.name === label) : null;
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Icon
          name={kind === "skill" ? "layers" : kind === "agent" ? "agent" : kind === "app" ? "plug" : "file"}
          size={16}
          className="text-[hsl(var(--accent))]"
        />
        <span className="font-mono text-[15px] font-semibold text-[hsl(var(--text-primary))]">{label}</span>
      </div>
      <Chip tone="accent">{KIND_LABEL[kind] ?? kind}</Chip>
      <div className="mt-3 border-t border-[hsl(var(--border))] pt-2">
        {skill ? (
          <>
            <Row k="category" v={skill.category} />
            <Row k="shared across" v={`${skill.sharedAcross} machines`} />
            <Row k="installed in" v={`${skill.projects.length} projects`} />
            {skill.meta && <Row k="type" v={<Chip tone="accent">meta · self-improving</Chip>} />}
          </>
        ) : (
          <Row k="node" v={nodeId} />
        )}
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-[hsl(var(--text-secondary))]/70">
        Edges show what this connects to across your projects, skills, agents, and machines.
      </p>
    </div>
  );
}

function WorkspaceDetail() {
  return (
    <div>
      <SectionLabel className="mb-2">Context</SectionLabel>
      <p className="text-[12px] leading-relaxed text-[hsl(var(--text-secondary))]/80">
        Select a project, or click any node in the graph, to inspect it here. The inspector replaces
        the old shell&apos;s eight separate detail panes with one context-aware dock.
      </p>
      <div className="mt-3 border-t border-[hsl(var(--border))] pt-2">
        <Row k="projects" v={PROJECTS.length} />
        <Row k="skills" v={SKILLS.length} />
        <Row k="stacks" v={STACKS.length} />
        <Row k="open tasks" v={TASKS.filter((t) => t.status !== "done").length} />
      </div>
    </div>
  );
}
