"use client";

import {
  apiSurfaces,
  dependencyEdges,
  portfolioProjects,
  reusablePatterns,
  skillPropagation,
} from "@/data/portfolioGraph";
import { PaneDivider, PaneHeader, PaneSectionLabel } from "./shared";

function statusClass(status: string) {
  if (status === "canonical" || status === "active" || status === "synced") return "text-[hsl(var(--success))]";
  if (status === "candidate" || status === "cataloged" || status === "build") return "text-[hsl(var(--accent))]";
  return "text-[hsl(var(--text-secondary))] opacity-55";
}

function StatStrip() {
  const stats = [
    ["projects", portfolioProjects.length],
    ["surfaces", apiSurfaces.length],
    ["edges", dependencyEdges.length],
    ["patterns", reusablePatterns.length],
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

export function PortfolioGraphPane() {
  const surfaceBySlug = new Map(apiSurfaces.map((surface) => [surface.slug, surface]));
  const projectBySlug = new Map(portfolioProjects.map((project) => [project.slug, project]));

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
          <StatStrip />
        </div>

        <PaneDivider />

        <section>
          <PaneSectionLabel>projects</PaneSectionLabel>
          <div className="grid gap-3 xl:grid-cols-2">
            {portfolioProjects.map((project) => (
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
            {dependencyEdges.map((edge) => {
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
            {reusablePatterns.map((pattern) => (
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
