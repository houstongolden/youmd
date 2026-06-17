"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  apiSurfaces,
  dependencyEdges,
  portfolioProjects,
  reusablePatterns,
  skillPropagation,
} from "@/data/portfolioGraph";
import { PaneDivider, PaneHeader, PaneSectionLabel } from "./shared";

type PortfolioGraphPaneProps = {
  clerkId?: string;
};

function statusClass(status: string) {
  if (status === "canonical" || status === "active" || status === "synced") return "text-[hsl(var(--success))]";
  if (status === "candidate" || status === "cataloged" || status === "build") return "text-[hsl(var(--accent))]";
  return "text-[hsl(var(--text-secondary))] opacity-55";
}

function statLabel(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function StatStrip({
  projectCount,
  surfaceCount,
  edgeCount,
  patternCount,
}: {
  projectCount: number;
  surfaceCount: number;
  edgeCount: number;
  patternCount: number;
}) {
  const stats = [
    ["projects", statLabel(projectCount)],
    ["surfaces", statLabel(surfaceCount)],
    ["edges", statLabel(edgeCount)],
    ["patterns", statLabel(patternCount)],
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-4">
      {stats.map(([label, value]) => (
        <div key={label} className="border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/45 px-3 py-2">
          <div className="font-mono text-[18px] leading-tight text-[hsl(var(--text-primary))]">{value}</div>
          <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--text-secondary))] opacity-45">{label}</div>
        </div>
      ))}
    </div>
  );
}

function fromPersistedProject(project: {
  slug: string;
  name: string;
  stackName?: string;
  status: string;
  summary?: string;
  goal?: string;
  focus?: string;
  docs: string[];
}) {
  return {
    slug: project.slug,
    name: project.name,
    stack: project.stackName ?? "Project YouStack",
    status: project.status,
    summary: project.summary ?? "No project summary saved yet.",
    goal: project.goal ?? "No high-level goal saved yet.",
    focus: project.focus ?? "No current focus saved yet.",
    docs: project.docs,
  };
}

function fromPersistedSurface(surface: {
  slug: string;
  name: string;
  kind: string;
  ownerProjectSlug: string;
  ownerStack?: string;
  trust: string;
  authMode?: string;
  writePolicy: string;
  features: string[];
  risk: string;
  notes?: string;
}) {
  return {
    slug: surface.slug,
    name: surface.name,
    kind: surface.kind,
    ownerProject: surface.ownerProjectSlug,
    ownerStack: surface.ownerStack ?? "Project YouStack",
    trust: surface.trust,
    authMode: surface.authMode ?? "not documented",
    writePolicy: surface.writePolicy,
    features: surface.features,
    risk: surface.risk,
    notes: surface.notes ?? "",
  };
}

function fromPersistedEdge(edge: {
  fromProjectSlug: string;
  toProjectSlug?: string;
  toSurfaceSlug?: string;
  tier: string;
  integrationType: string;
  features: string[];
  failureImpact?: string;
  notes?: string;
}) {
  return {
    fromProject: edge.fromProjectSlug,
    toSurface: edge.toSurfaceSlug ?? edge.toProjectSlug ?? "unknown",
    tier: edge.tier,
    integrationType: edge.integrationType,
    features: edge.features,
    failureImpact: edge.failureImpact ?? edge.notes ?? "No failure impact saved yet.",
  };
}

function fromPersistedPattern(pattern: {
  slug: string;
  name: string;
  status: string;
  tags: string[];
  canonicalOwnerProject?: string;
  summary: string;
}) {
  return {
    slug: pattern.slug,
    name: pattern.name,
    status: pattern.status,
    tags: pattern.tags,
    canonicalOwner: pattern.canonicalOwnerProject ?? "youmd",
    summary: pattern.summary,
  };
}

export function PortfolioGraphPane({ clerkId }: PortfolioGraphPaneProps) {
  const graph = useQuery(api.portfolio.listPortfolioGraph, clerkId ? { clerkId } : "skip");
  const syncDashboardSeed = useMutation(api.portfolio.syncDashboardSeed);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const hasPersistedGraph = Boolean(graph && (
    graph.projects.length > 0 ||
    graph.apiSurfaces.length > 0 ||
    graph.dependencyEdges.length > 0 ||
    graph.reusablePatterns.length > 0
  ));

  const activeProjects = hasPersistedGraph && graph
    ? graph.projects.map(fromPersistedProject)
    : portfolioProjects;
  const activeSurfaces = hasPersistedGraph && graph
    ? graph.apiSurfaces.map(fromPersistedSurface)
    : apiSurfaces;
  const activeEdges = hasPersistedGraph && graph
    ? graph.dependencyEdges.map(fromPersistedEdge)
    : dependencyEdges;
  const activePatterns = hasPersistedGraph && graph
    ? graph.reusablePatterns.map(fromPersistedPattern)
    : reusablePatterns;

  const surfaceBySlug = useMemo(
    () => new Map(activeSurfaces.map((surface) => [surface.slug, surface])),
    [activeSurfaces]
  );
  const projectBySlug = useMemo(
    () => new Map(activeProjects.map((project) => [project.slug, project])),
    [activeProjects]
  );

  const handleSyncSeed = async () => {
    if (!clerkId || syncing) return;
    setSyncing(true);
    setSyncStatus(null);
    try {
      const result = await syncDashboardSeed({
        clerkId,
        projects: portfolioProjects,
        apiSurfaces,
        dependencyEdges,
        reusablePatterns,
      });
      setSyncStatus(
        `persisted ${result.projects} projects / ${result.apiSurfaces} surfaces / ${result.dependencyEdges} edges / ${result.reusablePatterns} patterns`
      );
    } catch (err) {
      setSyncStatus(`error: ${err instanceof Error ? err.message : "failed to persist graph"}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <PaneHeader>project portfolio graph</PaneHeader>
      <div className="max-w-6xl px-6 py-6">
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section>
            <PaneSectionLabel>operating model</PaneSectionLabel>
            <h2 className="font-mono text-[18px] leading-tight text-[hsl(var(--text-primary))]">
              A map for Houston, agents, projects, APIs, MCPs, stacks, protected harnesses, and reusable patterns.
            </h2>
            <p className="mt-3 max-w-3xl font-mono text-[11px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-65">
              You.md keeps the human-level project catalog separate from each project&apos;s canonical repo, then joins
              them with dependency edges, API/MCP ownership, local machine readiness, and stack/skill propagation.
            </p>
          </section>
          <StatStrip
            projectCount={activeProjects.length}
            surfaceCount={activeSurfaces.length}
            edgeCount={activeEdges.length}
            patternCount={activePatterns.length}
          />
        </div>

        <div className="mt-5 border-y border-[hsl(var(--border))]/70 py-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--accent))] opacity-70">
                {graph === undefined ? "loading" : hasPersistedGraph ? "convex persisted graph" : "bootstrap graph"}
              </div>
              <p className="mt-1 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-55">
                {hasPersistedGraph
                  ? `loaded from owner-gated portfolio tables${graph?.recentTrackedProjects.length ? ` with ${graph.recentTrackedProjects.length} recent GitHub-tracked projects nearby` : ""}`
                  : "rendering the local bootstrap model until these records are synced into Convex"}
              </p>
              {graph && (graph.tasks.length > 0 || graph.recentCaptures.length > 0) && (
                <p className="mt-1 font-mono text-[9.5px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-45">
                  task graph: {graph.tasks.length} open item{graph.tasks.length === 1 ? "" : "s"} / recent captures: {graph.recentCaptures.length}
                </p>
              )}
              {syncStatus && (
                <p className={`mt-2 font-mono text-[10px] ${syncStatus.startsWith("error") ? "text-[hsl(var(--accent))]" : "text-[hsl(var(--success))]"} opacity-80`}>
                  {syncStatus}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleSyncSeed}
              disabled={!clerkId || syncing}
              className="h-8 shrink-0 border border-[hsl(var(--border))] px-3 font-mono text-[10px] text-[hsl(var(--text-primary))] transition-colors hover:border-[hsl(var(--accent))] disabled:opacity-35"
              style={{ borderRadius: "var(--radius)" }}
            >
              {syncing ? "syncing graph..." : hasPersistedGraph ? "refresh persisted graph" : "persist graph"}
            </button>
          </div>
        </div>

        <PaneDivider />

        <section>
          <PaneSectionLabel>projects</PaneSectionLabel>
          <div className="grid gap-3 xl:grid-cols-2">
            {activeProjects.map((project) => (
              <article key={project.slug} className="border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/40 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-mono text-[13px] text-[hsl(var(--text-primary))]">{project.name}</h3>
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-70">{project.stack}</span>
                  <span className={`ml-auto font-mono text-[9px] uppercase tracking-[0.14em] ${statusClass(project.status)}`}>{project.status}</span>
                </div>
                <p className="mt-2 font-mono text-[10.5px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-62">{project.summary}</p>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-60">goal</div>
                    <p className="mt-1 font-mono text-[9.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-55">{project.goal}</p>
                  </div>
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-60">focus</div>
                    <p className="mt-1 font-mono text-[9.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-55">{project.focus}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {project.docs.slice(0, 3).map((doc) => (
                    <span key={doc} className="border border-[hsl(var(--border))]/70 px-2 py-1 font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-45">
                      {doc}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <PaneDivider />

        <section>
          <PaneSectionLabel>dependency edges</PaneSectionLabel>
          <div className="space-y-2">
            {activeEdges.map((edge) => {
              const project = projectBySlug.get(edge.fromProject);
              const surface = surfaceBySlug.get(edge.toSurface);
              return (
                <div key={`${edge.fromProject}-${edge.toSurface}`} className="grid gap-3 border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-3 lg:grid-cols-[0.8fr_1fr_1.2fr]">
                  <div>
                    <div className="font-mono text-[11px] text-[hsl(var(--text-primary))]">
                      {project?.name ?? edge.fromProject} {"->"} {surface?.name ?? edge.toSurface}
                    </div>
                    <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-70">
                      {edge.tier} / {edge.integrationType}
                    </div>
                  </div>
                  <p className="font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-58">
                    {edge.features.join(", ")}
                  </p>
                  <p className="font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-45">
                    {edge.failureImpact}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <PaneDivider />

        <section>
          <PaneSectionLabel>reusable patterns</PaneSectionLabel>
          <div className="grid gap-3 xl:grid-cols-2">
            {activePatterns.map((pattern) => (
              <div key={pattern.slug} className="border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[12px] text-[hsl(var(--text-primary))]">{pattern.name}</span>
                  <span className={`ml-auto font-mono text-[9px] uppercase tracking-[0.14em] ${statusClass(pattern.status)}`}>{pattern.status}</span>
                </div>
                <p className="mt-2 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-58">{pattern.summary}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {pattern.tags.map((tag) => (
                    <span key={tag} className="font-mono text-[9px] text-[hsl(var(--accent))] opacity-55">#{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {graph && graph.tasks.length > 0 && (
          <>
            <PaneDivider />
            <section>
              <PaneSectionLabel>open tasks</PaneSectionLabel>
              <div className="space-y-2">
                {graph.tasks.slice(0, 8).map((task) => (
                  <div key={task._id} className="grid gap-2 border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-3 md:grid-cols-[0.75fr_0.4fr_1fr]">
                    <div className="font-mono text-[11px] text-[hsl(var(--text-primary))]">
                      {task.title}
                    </div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-70">
                      {task.ownerType}{task.projectSlug ? ` / ${task.projectSlug}` : " / personal"}
                    </div>
                    <div className="font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-50">
                      {task.description ?? (task.tags.join(", ") || task.status)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        <PaneDivider />

        <section>
          <PaneSectionLabel>skill propagation</PaneSectionLabel>
          <div className="space-y-3">
            {skillPropagation.map((entry) => (
              <div key={entry.skill} className="border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[12px] text-[hsl(var(--text-primary))]">{entry.skill}</span>
                  <span className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-45">{entry.owner}</span>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  {entry.projects.map((project) => (
                    <div key={`${entry.skill}-${project.project}`} className="border-t border-[hsl(var(--border))]/45 pt-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-[hsl(var(--text-primary))]">{project.project}</span>
                        <span className={`ml-auto font-mono text-[8px] uppercase tracking-[0.14em] ${statusClass(project.status)}`}>{project.status}</span>
                      </div>
                      <p className="mt-1 font-mono text-[9px] leading-4 text-[hsl(var(--text-secondary))] opacity-50">{project.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
