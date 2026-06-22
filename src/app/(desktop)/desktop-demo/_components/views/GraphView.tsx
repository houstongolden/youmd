"use client";

import { useState, useMemo } from "react";
import { GRAPH_NODES, GRAPH_EDGES, type GraphNode, type GraphEdge } from "../../_data/mock";
import { useRealData } from "../../_lib/RealDataContext";
import { ViewBar } from "../primitives";
import { cn } from "../../_lib/cn";

const KIND_STYLE: Record<GraphNode["kind"], { fill: string; ring: string; label: string }> = {
  agent: { fill: "hsl(var(--accent))", ring: "hsl(var(--accent))", label: "You / machine" },
  project: { fill: "hsl(var(--bg-raised))", ring: "hsl(var(--accent-mid))", label: "Project" },
  skill: { fill: "hsl(var(--bg-raised))", ring: "hsl(var(--success))", label: "Skill" },
  note: { fill: "hsl(var(--bg-raised))", ring: "hsl(var(--text-secondary))", label: "Brain" },
  app: { fill: "hsl(var(--bg-raised))", ring: "hsl(var(--text-secondary))", label: "Stack" },
};

// Build a radial graph from REAL data: you at center, projects inner ring,
// skills outer ring, machines + brain notes around. Falls back to mock.
function buildRealGraph(
  projects: { name: string }[],
  skills: { name: string }[],
  stacks: string[],
  brain: { id: string; name: string }[],
  machines: string[],
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [{ id: "you", label: "YOU", kind: "agent", x: 50, y: 50 }];
  const edges: GraphEdge[] = [];
  const ring = (i: number, n: number, r: number) => ({
    x: 50 + r * Math.cos((i / Math.max(1, n)) * 2 * Math.PI - Math.PI / 2),
    y: 50 + r * Math.sin((i / Math.max(1, n)) * 2 * Math.PI - Math.PI / 2),
  });

  const projN = projects.slice(0, 14);
  projN.forEach((p, i) => {
    const { x, y } = ring(i, projN.length, 24);
    nodes.push({ id: `p:${p.name}`, label: p.name, kind: "project", x, y });
    edges.push({ from: "you", to: `p:${p.name}` });
  });

  const skillN = skills.slice(0, 18);
  skillN.forEach((s, i) => {
    const { x, y } = ring(i + 0.5, skillN.length, 42);
    nodes.push({ id: `s:${s.name}`, label: s.name, kind: "skill", x, y });
    // attach each skill to a project round-robin so edges read as "used by"
    if (projN.length) edges.push({ from: `p:${projN[i % projN.length].name}`, to: `s:${s.name}` });
  });

  machines.slice(0, 4).forEach((m, i) => {
    const { x, y } = ring(i, 4, 11);
    nodes.push({ id: `m:${m}`, label: m, kind: "agent", x, y });
    edges.push({ from: "you", to: `m:${m}` });
  });

  brain.slice(0, 4).forEach((b, i) => {
    const { x, y } = ring(i + 0.25, 4, 15);
    nodes.push({ id: `b:${b.id}`, label: b.name, kind: "note", x, y });
    edges.push({ from: "you", to: `b:${b.id}` });
  });

  stacks.slice(0, 5).forEach((st, i) => {
    const { x, y } = ring(i + 0.7, 5, 33);
    nodes.push({ id: `st:${st}`, label: st, kind: "app", x, y });
    edges.push({ from: "you", to: `st:${st}` });
  });

  return { nodes, edges };
}

export function GraphView({
  onSelectNode,
  selectedNode,
}: {
  onSelectNode?: (id: string) => void;
  selectedNode?: string | null;
} = {}) {
  const [hover, setHover] = useState<string | null>(null);
  const real = useRealData();

  const { nodes, edges } = useMemo(() => {
    if (real?.available) {
      return buildRealGraph(real.projects, real.skills, real.stacks, real.brain, real.machine?.host ? [real.machine.host, "Houstons-MBP", "cloud-vps"] : ["Houstons-MBP", "Houstons-Mini", "cloud-vps"]);
    }
    return { nodes: GRAPH_NODES, edges: GRAPH_EDGES };
  }, [real]);

  const neighbors = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const n of nodes) map[n.id] = new Set([n.id]);
    for (const e of edges) {
      map[e.from]?.add(e.to);
      map[e.to]?.add(e.from);
    }
    return map;
  }, [nodes, edges]);

  const isLit = (id: string) => !hover || neighbors[hover]?.has(id);
  const nodeById = (id: string) => nodes.find((n) => n.id === id);

  return (
    <div className="flex h-full flex-col">
      <ViewBar
        title={real?.available ? `Graph · ${nodes.length - 1} nodes (live)` : "Graph"}
        right={
          <div className="flex items-center gap-2 overflow-x-auto md:gap-3">
            {Object.entries(KIND_STYLE).map(([k, s]) => (
              <span key={k} className="flex shrink-0 items-center gap-1.5">
                <span style={{ background: s.ring, width: 8, height: 8, borderRadius: "50%" }} aria-hidden />
                <span className="hidden font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/70 sm:inline">{s.label}</span>
              </span>
            ))}
          </div>
        }
      />

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{ backgroundImage: "radial-gradient(hsl(var(--border)) 1px, transparent 1px)", backgroundSize: "26px 26px" }}
        />
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
          {edges.map((e, i) => {
            const a = nodeById(e.from);
            const b = nodeById(e.to);
            if (!a || !b) return null;
            const lit = isLit(e.from) && isLit(e.to);
            return (
              <line
                key={i}
                x1={`${a.x}%`}
                y1={`${a.y}%`}
                x2={`${b.x}%`}
                y2={`${b.y}%`}
                stroke={lit ? "hsl(var(--accent))" : "hsl(var(--border))"}
                strokeOpacity={lit ? (hover ? 0.5 : 0.22) : 0.1}
                strokeWidth={lit && hover ? 1.4 : 1}
              />
            );
          })}
        </svg>

        {nodes.map((n) => {
          const s = KIND_STYLE[n.kind];
          const lit = isLit(n.id);
          const isCenter = n.id === "you";
          const dim = 11 + (isCenter ? 9 : n.kind === "project" ? 4 : 0);
          return (
            <div
              key={n.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 transition-opacity"
              style={{ left: `${n.x}%`, top: `${n.y}%`, opacity: lit ? 1 : 0.22 }}
              onMouseEnter={() => setHover(n.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelectNode?.(n.id)}
            >
              <div className="flex cursor-pointer flex-col items-center gap-1">
                <span
                  className="transition-transform hover:scale-110"
                  style={{
                    width: dim,
                    height: dim,
                    borderRadius: "50%",
                    background: s.fill,
                    border: `1.5px solid ${s.ring}`,
                    boxShadow:
                      selectedNode === n.id ? "0 0 0 4px hsl(var(--accent) / 0.3)" : isCenter && lit ? "0 0 0 4px hsl(var(--accent) / 0.15)" : undefined,
                  }}
                  aria-hidden
                />
                {(isCenter || n.kind === "project" || hover === n.id) && (
                  <span className={cn("max-w-[80px] truncate whitespace-nowrap font-mono text-[9px] tracking-wide", isCenter ? "text-[hsl(var(--accent))]" : "text-[hsl(var(--text-secondary))]")}>
                    {n.label}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        <div className="pointer-events-none absolute bottom-4 left-5 font-mono text-[11px] text-[hsl(var(--text-secondary))]/60">
          {nodes.length} nodes · {edges.length} connections · hover to trace · click to inspect
        </div>
      </div>
    </div>
  );
}
