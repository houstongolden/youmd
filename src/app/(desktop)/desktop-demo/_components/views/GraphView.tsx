"use client";

import { useState, useMemo } from "react";
import { GRAPH_NODES, GRAPH_EDGES, type GraphNode } from "../../_data/mock";
import { SectionLabel } from "../primitives";
import { cn } from "../../_lib/cn";

const KIND_STYLE: Record<GraphNode["kind"], { fill: string; ring: string; label: string }> = {
  agent: { fill: "hsl(var(--accent))", ring: "hsl(var(--accent))", label: "Agent" },
  project: { fill: "hsl(var(--bg-raised))", ring: "hsl(var(--accent-mid))", label: "Project" },
  skill: { fill: "hsl(var(--bg-raised))", ring: "hsl(var(--success))", label: "Skill" },
  note: { fill: "hsl(var(--bg-raised))", ring: "hsl(var(--text-secondary))", label: "Note" },
  app: { fill: "hsl(var(--bg-raised))", ring: "hsl(var(--text-secondary))", label: "App" },
};

export function GraphView() {
  const [hover, setHover] = useState<string | null>(null);

  // Precompute adjacency for hover-dimming.
  const neighbors = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const n of GRAPH_NODES) map[n.id] = new Set([n.id]);
    for (const e of GRAPH_EDGES) {
      map[e.from]?.add(e.to);
      map[e.to]?.add(e.from);
    }
    return map;
  }, []);

  const isLit = (id: string) => !hover || neighbors[hover]?.has(id);
  const nodeById = (id: string) => GRAPH_NODES.find((n) => n.id === id)!;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-[hsl(var(--border))] px-4 py-2.5 md:px-5">
        <SectionLabel className="shrink-0">Graph</SectionLabel>
        <div className="flex items-center gap-2 overflow-x-auto md:gap-3">
          {Object.entries(KIND_STYLE).map(([k, s]) => (
            <span key={k} className="flex shrink-0 items-center gap-1.5">
              <span
                style={{ background: s.ring, width: 8, height: 8, borderRadius: "50%" }}
                aria-hidden
              />
              <span className="hidden font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/70 sm:inline">
                {s.label}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* subtle dot grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "radial-gradient(hsl(var(--border)) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
          {GRAPH_EDGES.map((e, i) => {
            const a = nodeById(e.from);
            const b = nodeById(e.to);
            const lit = isLit(e.from) && isLit(e.to);
            return (
              <line
                key={i}
                x1={`${a.x}%`}
                y1={`${a.y}%`}
                x2={`${b.x}%`}
                y2={`${b.y}%`}
                stroke={lit ? "hsl(var(--accent))" : "hsl(var(--border))"}
                strokeOpacity={lit ? (hover ? 0.55 : 0.28) : 0.12}
                strokeWidth={lit && hover ? 1.4 : 1}
              />
            );
          })}
        </svg>

        {/* nodes */}
        {GRAPH_NODES.map((n) => {
          const s = KIND_STYLE[n.kind];
          const lit = isLit(n.id);
          const isCenter = n.kind === "agent" && n.id === "you";
          const dim = 12 + (isCenter ? 8 : n.kind === "project" ? 4 : 0);
          return (
            <div
              key={n.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 transition-opacity"
              style={{ left: `${n.x}%`, top: `${n.y}%`, opacity: lit ? 1 : 0.25 }}
              onMouseEnter={() => setHover(n.id)}
              onMouseLeave={() => setHover(null)}
            >
              <div className="flex cursor-pointer flex-col items-center gap-1.5">
                <span
                  className="transition-transform hover:scale-110"
                  style={{
                    width: dim,
                    height: dim,
                    borderRadius: "50%",
                    background: s.fill,
                    border: `1.5px solid ${s.ring}`,
                    boxShadow:
                      isCenter && lit
                        ? "0 0 0 4px hsl(var(--accent) / 0.15)"
                        : undefined,
                  }}
                  aria-hidden
                />
                <span
                  className={cn(
                    "whitespace-nowrap font-mono text-[10px] tracking-wide",
                    isCenter ? "text-[hsl(var(--accent))]" : "text-[hsl(var(--text-secondary))]",
                  )}
                >
                  {n.label}
                </span>
              </div>
            </div>
          );
        })}

        <div className="pointer-events-none absolute bottom-4 left-5 font-mono text-[11px] text-[hsl(var(--text-secondary))]/60">
          {GRAPH_NODES.length} nodes · {GRAPH_EDGES.length} connections · hover to trace
        </div>
      </div>
    </div>
  );
}
