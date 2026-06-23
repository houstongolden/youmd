"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GRAPH_NODES, GRAPH_EDGES } from "../../_data/mock";
import { useRealData } from "../../_lib/RealDataContext";
import { Icon } from "../icons";
import { cn } from "../../_lib/cn";

type Kind = "you" | "project" | "skill" | "stack" | "note" | "machine" | "file";
type GNode = { id: string; label: string; kind: Kind };
type GEdge = { from: string; to: string };
type Sim = { x: number; y: number; vx: number; vy: number };

const COLOR: Record<Kind, string> = {
  you: "hsl(var(--accent))",
  project: "hsl(var(--accent-mid))",
  skill: "hsl(var(--success))",
  stack: "hsl(var(--accent-light))",
  note: "hsl(var(--text-secondary))",
  machine: "hsl(var(--accent))",
  file: "hsl(var(--text-secondary) / 0.6)",
};
const SIZE: Record<Kind, number> = { you: 11, project: 7, machine: 6, stack: 6, note: 5, skill: 3.5, file: 2.6 };

function buildGraph(real: ReturnType<typeof useRealData>): { nodes: GNode[]; edges: GEdge[] } {
  if (!real?.available) {
    return {
      nodes: GRAPH_NODES.map((n) => ({ id: n.id, label: n.label, kind: (n.kind === "agent" ? "you" : n.kind === "app" ? "stack" : n.kind) as Kind })),
      edges: GRAPH_EDGES,
    };
  }
  const nodes: GNode[] = [{ id: "you", label: "YOU", kind: "you" }];
  const edges: GEdge[] = [];
  for (const m of [real.machine?.host, "Houstons-MBP", "cloud-vps"].filter(Boolean).slice(0, 3) as string[]) {
    nodes.push({ id: `m:${m}`, label: m, kind: "machine" });
    edges.push({ from: "you", to: `m:${m}` });
  }
  for (const b of real.brain.slice(0, 8)) {
    nodes.push({ id: `b:${b.id}`, label: b.name, kind: "note" });
    edges.push({ from: "you", to: `b:${b.id}` });
  }
  for (const st of real.stacks.slice(0, 6)) {
    nodes.push({ id: `st:${st}`, label: st, kind: "stack" });
    edges.push({ from: "you", to: `st:${st}` });
  }
  real.projects.forEach((p) => {
    nodes.push({ id: `p:${p.name}`, label: p.name, kind: "project" });
    edges.push({ from: "you", to: `p:${p.name}` });
    // a few real files per project so clusters form like an Obsidian vault
    p.files.filter((f) => !f.endsWith("/")).slice(0, 4).forEach((f) => {
      const id = `f:${p.name}/${f}`;
      nodes.push({ id, label: f, kind: "file" });
      edges.push({ from: `p:${p.name}`, to: id });
    });
  });
  // skills attach to stacks/projects round-robin → organic clusters
  const anchors = nodes.filter((n) => n.kind === "stack" || n.kind === "project");
  real.skills.slice(0, 72).forEach((s, i) => {
    const id = `s:${s.name}`;
    nodes.push({ id, label: s.name, kind: "skill" });
    const a = anchors[i % Math.max(1, anchors.length)];
    edges.push({ from: a ? a.id : "you", to: id });
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
  const real = useRealData();
  const { nodes, edges } = useMemo(() => buildGraph(real), [real]);

  const sim = useRef<Record<string, Sim>>({});
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [view, setView] = useState({ k: 1, tx: 0, ty: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const dragging = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const adj = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    for (const n of nodes) m[n.id] = new Set([n.id]);
    for (const e of edges) {
      m[e.from]?.add(e.to);
      m[e.to]?.add(e.from);
    }
    return m;
  }, [nodes, edges]);

  // init positions on a circle (deterministic by index)
  useEffect(() => {
    const next: Record<string, Sim> = {};
    nodes.forEach((n, i) => {
      const a = (i / nodes.length) * Math.PI * 2;
      const r = n.id === "you" ? 0 : 120 + (i % 7) * 30;
      next[n.id] = sim.current[n.id] ?? { x: Math.cos(a) * r, y: Math.sin(a) * r, vx: 0, vy: 0 };
    });
    sim.current = next;
  }, [nodes]);

  // force simulation with cool-down
  useEffect(() => {
    let alpha = 1;
    let raf = 0;
    let frame = 0;
    const idx = nodes.map((n) => n.id);
    const step = () => {
      frame++;
      const s = sim.current;
      // repulsion (all pairs; node counts kept modest for smoothness)
      for (let i = 0; i < idx.length; i++) {
        const a = s[idx[i]];
        if (!a) continue;
        for (let j = i + 1; j < idx.length; j++) {
          const b = s[idx[j]];
          if (!b) continue;
          let dx = a.x - b.x, dy = a.y - b.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 0.01) { dx = Math.cos(i + j); dy = Math.sin(i + j); d2 = 1; }
          const f = (3200 / d2) * alpha;
          const d = Math.sqrt(d2);
          const fx = (dx / d) * f, fy = (dy / d) * f;
          a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
        }
      }
      // springs
      for (const e of edges) {
        const a = s[e.from], b = s[e.to];
        if (!a || !b) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = ((d - 64) * 0.04) * alpha;
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      }
      // gravity to center + integrate
      for (const id of idx) {
        const n = s[id];
        if (!n) continue;
        if (id === "you") { n.x = 0; n.y = 0; n.vx = 0; n.vy = 0; continue; }
        n.vx += -n.x * 0.008 * alpha;
        n.vy += -n.y * 0.008 * alpha;
        n.vx *= 0.82; n.vy *= 0.82;
        n.x += n.vx; n.y += n.vy;
      }
      alpha *= 0.985;
      // throttle React commits to ~30fps; always publish the final settled frame
      if (frame % 2 === 0 || alpha <= 0.02) {
        const snap: Record<string, { x: number; y: number }> = {};
        for (const id of idx) if (s[id]) snap[id] = { x: s[id].x, y: s[id].y };
        setPositions(snap);
      }
      if (alpha > 0.02) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [nodes, edges]);

  const lit = (id: string) => !hover || adj[hover]?.has(id);

  const zoom = (factor: number) => setView((v) => ({ ...v, k: Math.max(0.3, Math.min(4, v.k * factor)) }));
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    zoom(e.deltaY < 0 ? 1.12 : 0.89);
  };
  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = { x: e.clientX - view.tx, y: e.clientY - view.ty };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const d = dragging.current;
    setView((v) => ({ ...v, tx: e.clientX - d.x, ty: e.clientY - d.y }));
  };
  const endDrag = () => {
    dragging.current = null;
  };

  const { k, tx, ty } = view;
  const s = positions;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-2.5">
        <span className="font-mono text-[13px] text-[hsl(var(--text-primary))]">
          Graph {real?.available && <span className="text-[hsl(var(--text-secondary))]/50">· {nodes.length} nodes (live)</span>}
        </span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            {(["you", "project", "skill", "stack", "note"] as Kind[]).map((kk) => (
              <span key={kk} className="hidden items-center gap-1 sm:flex">
                <span style={{ background: COLOR[kk], width: 7, height: 7, borderRadius: "50%" }} aria-hidden />
                <span className="font-mono text-[9px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/60">{kk}</span>
              </span>
            ))}
          </div>
          <div className="flex items-center overflow-hidden rounded-sm border border-[hsl(var(--border))]">
            <button onClick={() => zoom(0.83)} className="px-1.5 py-0.5 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]" title="Zoom out"><Icon name="chevronDown" size={13} /></button>
            <button onClick={() => setView({ k: 1, tx: 0, ty: 0 })} className="border-x border-[hsl(var(--border))] px-1.5 py-0.5 font-mono text-[10px] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]" title="Reset">{Math.round(k * 100)}%</button>
            <button onClick={() => zoom(1.2)} className="px-1.5 py-0.5 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]" title="Zoom in"><Icon name="plus" size={13} /></button>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 cursor-grab overflow-hidden active:cursor-grabbing"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        style={{ backgroundImage: "radial-gradient(hsl(var(--border)) 1px, transparent 1px)", backgroundSize: "28px 28px" }}
      >
        <svg className="absolute inset-0 h-full w-full">
          <g transform={`translate(${size.w / 2 + tx}, ${size.h / 2 + ty}) scale(${k})`}>
            {edges.map((e, i) => {
                const a = s[e.from], b = s[e.to];
                if (!a || !b) return null;
                const on = lit(e.from) && lit(e.to);
                return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="hsl(var(--accent))" strokeOpacity={on ? (hover ? 0.4 : 0.14) : 0.05} strokeWidth={hover && on ? 1 : 0.6} />;
              })}
              {nodes.map((n) => {
                const p = s[n.id];
                if (!p) return null;
                const on = lit(n.id);
                const isCenter = n.id === "you";
                const isHover = hover === n.id;
                const isSel = selectedNode === n.id;
                const r = SIZE[n.kind] * (isHover ? 1.55 : 1);
                const showLabel = isCenter || n.kind === "project" || n.kind === "stack" || isHover || isSel;
                return (
                  <g key={n.id} transform={`translate(${p.x}, ${p.y})`} style={{ opacity: on ? 1 : 0.18, cursor: "pointer", transition: "opacity 160ms" }}
                    onPointerEnter={() => setHover(n.id)} onPointerLeave={() => setHover(null)}
                    onClick={(ev) => { ev.stopPropagation(); onSelectNode?.(n.id); }}>
                    {isCenter && (
                      <circle r={20} fill="hsl(var(--accent))" opacity={0.12}>
                        <animate attributeName="r" values="18;27;18" dur="3.6s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.16;0.05;0.16" dur="3.6s" repeatCount="indefinite" />
                      </circle>
                    )}
                    {(isHover || isSel) && <circle r={r * 2.4} fill={COLOR[n.kind]} opacity={0.16} />}
                    <circle
                      r={r}
                      fill={COLOR[n.kind]}
                      stroke={isSel ? "hsl(var(--accent))" : isCenter ? "hsl(var(--accent))" : "transparent"}
                      strokeWidth={isSel ? 2 : 0}
                    />
                    {showLabel && (
                      <text
                        x={0}
                        y={r + 9}
                        textAnchor="middle"
                        fontSize={isCenter ? 9.5 : isHover ? 8 : 7}
                        fill={isCenter || isHover ? "hsl(var(--text-primary))" : "hsl(var(--text-secondary))"}
                        style={{ fontFamily: "var(--font-mono, monospace)", pointerEvents: "none", paintOrder: "stroke", stroke: "hsl(var(--bg))", strokeWidth: 3, strokeLinejoin: "round" }}
                      >
                        {n.label.length > 18 ? n.label.slice(0, 17) + "…" : n.label}
                      </text>
                    )}
                  </g>
                );
              })}
          </g>
        </svg>

        <div className={cn("pointer-events-none absolute bottom-4 left-5 font-mono text-[11px] text-[hsl(var(--text-secondary))]/55")}>
          {nodes.length} nodes · {edges.length} links · scroll to zoom · drag to pan · click to inspect
        </div>
      </div>
    </div>
  );
}
