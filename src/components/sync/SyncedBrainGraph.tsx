"use client";

import { useMemo, useState } from "react";
import { PixelCharacter, type PixelCharacterStatus } from "@/components/ui/PixelCharacter";

export type SyncedBrainGraphNode = {
  id: string;
  label: string;
  value: string;
  detail: string;
  x: number;
  y: number;
  kind: "machine" | "agent" | "shell";
  status: PixelCharacterStatus;
  live: boolean;
  tone: "success" | "accent" | "muted" | "danger";
};

export type SyncedBrainGraphLink = {
  from: string;
  to: string;
  active: boolean;
};

export type SyncedBrainGraphSignal = {
  label: string;
  value: string;
  live: boolean;
};

export type SyncedBrainGraphActivity = {
  id: string;
  source: string;
  title: string;
};

export type SyncedBrainGraphDto = {
  schemaVersion: string;
  generatedAt: number;
  nodes: SyncedBrainGraphNode[];
  links: SyncedBrainGraphLink[];
  signals: SyncedBrainGraphSignal[];
  latestActivity?: SyncedBrainGraphActivity[];
  evidence?: {
    inventoryCount?: number;
    machineProofCount?: number;
    matchedInventoryProofCount?: number;
    brainActivityCount?: number;
    recentBrainActivityCount?: number;
    projectCount?: number;
    focusedProjectCount?: number;
    openTaskCount?: number;
    latestInventoryAt?: number | null;
    latestMachineProofAt?: number | null;
    latestBrainActivityAt?: number | null;
    latestProjectActivityAt?: number | null;
    secretValuesExposed?: boolean;
  };
};

export function SyncedBrainGraph({
  nodes,
  links,
  signals,
  latestActivity,
  className = "",
}: {
  nodes: SyncedBrainGraphNode[];
  links: SyncedBrainGraphLink[];
  signals: SyncedBrainGraphSignal[];
  latestActivity?: SyncedBrainGraphActivity[];
  className?: string;
}) {
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const liveNode = nodes.find((node) => node.live) ?? nodes[0];
  const [selectedNodeId, setSelectedNodeId] = useState(liveNode?.id ?? "");
  const selectedNode = nodeById.get(selectedNodeId) ?? liveNode;
  const activeLinks = links.filter((link) => link.active && nodeById.has(link.from) && nodeById.has(link.to));

  return (
    <div className={["mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.72fr)]", className].filter(Boolean).join(" ")}>
      <div className="relative min-h-[390px] overflow-hidden border-l border-[hsl(var(--border))]/70 bg-[hsl(var(--bg))]/35">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {links.map((link) => {
            const from = nodeById.get(link.from);
            const to = nodeById.get(link.to);
            if (!from || !to) return null;
            return (
              <line
                key={`${link.from}-${link.to}`}
                x1={`${from.x}%`}
                y1={`${from.y}%`}
                x2={`${to.x}%`}
                y2={`${to.y}%`}
                stroke={link.active ? "hsl(var(--success) / 0.46)" : "hsl(var(--border) / 0.48)"}
                strokeWidth={link.active ? 1.4 : 1}
                strokeDasharray={link.active ? "0" : "4 6"}
              />
            );
          })}
          {activeLinks.map((link, index) => {
            const from = nodeById.get(link.from);
            const to = nodeById.get(link.to);
            if (!from || !to) return null;
            const pathId = `brain-pulse-${link.from}-${link.to}`.replace(/[^a-zA-Z0-9_-]/g, "-");
            return (
              <g key={`${pathId}-pulse`}>
                <path
                  id={pathId}
                  d={`M ${from.x} ${from.y} L ${to.x} ${to.y}`}
                  pathLength={100}
                  vectorEffect="non-scaling-stroke"
                  fill="none"
                  stroke="transparent"
                />
                <circle r="1.15" fill="hsl(var(--success))" opacity="0.86">
                  <animateMotion
                    dur={`${3.2 + index * 0.28}s`}
                    repeatCount="indefinite"
                    begin={`${index * 0.18}s`}
                  >
                    <mpath href={`#${pathId}`} />
                  </animateMotion>
                </circle>
              </g>
            );
          })}
        </svg>
        {nodes.map((node) => (
          <button
            key={node.id}
            type="button"
            onClick={() => setSelectedNodeId(node.id)}
            className={[
              "absolute z-10 w-[148px] -translate-x-1/2 -translate-y-1/2 cursor-pointer border bg-[hsl(var(--bg-raised))]/92 px-3 py-2 text-left transition-[border-color,background,opacity,transform] hover:bg-[hsl(var(--bg-raised))]",
              graphNodeToneClass(node.tone),
              selectedNode?.id === node.id ? "ring-1 ring-[hsl(var(--text-primary))]/20" : "opacity-82 hover:opacity-100",
              node.live ? "shadow-[0_0_24px_hsl(var(--success)/0.10)]" : "",
            ].join(" ")}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
          >
            <div className="flex items-center gap-2">
              <PixelCharacter
                kind={node.kind}
                seed={`${node.id}:${node.label}:${node.value}`}
                status={node.status}
                size="xs"
                className={node.live ? "animate-pulse" : "opacity-75"}
              />
              <div className="min-w-0">
                <div className="truncate font-mono text-[9px] uppercase tracking-[0.14em]">
                  {node.label}
                </div>
                <div className="mt-1 truncate font-mono text-[13px] leading-none text-[hsl(var(--text-primary))]">
                  {node.value}
                </div>
              </div>
            </div>
            <div className="mt-2 line-clamp-2 font-mono text-[9px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-50">
              {node.detail}
            </div>
          </button>
        ))}
      </div>
      <div className="border-l border-[hsl(var(--border))]/70 bg-[hsl(var(--bg))]/28 px-4 py-3">
        {selectedNode && (
          <div className="mb-4 border-b border-[hsl(var(--border))]/45 pb-3">
            <BrainGraphSectionLabel>selected node</BrainGraphSectionLabel>
            <div className="flex items-start gap-2">
              <PixelCharacter
                kind={selectedNode.kind}
                seed={`${selectedNode.id}:selected`}
                status={selectedNode.status}
                size="sm"
                className={selectedNode.live ? "animate-pulse" : "opacity-75"}
              />
              <div className="min-w-0">
                <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--text-secondary))] opacity-50">
                  {selectedNode.label}
                </div>
                <div className="mt-1 truncate font-mono text-[17px] leading-tight text-[hsl(var(--text-primary))]">
                  {selectedNode.value}
                </div>
                <p className="mt-2 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-58">
                  {selectedNode.detail}
                </p>
              </div>
            </div>
          </div>
        )}
        <BrainGraphSectionLabel>live signals</BrainGraphSectionLabel>
        <div className="space-y-2">
          {signals.map((row) => (
            <div key={row.label} className="flex items-center gap-3 border-t border-[hsl(var(--border))]/35 pt-2 font-mono text-[10px]">
              <span className={row.live ? "text-[hsl(var(--success))]" : "text-[hsl(var(--text-secondary))] opacity-35"}>
                {row.live ? "live" : "idle"}
              </span>
              <span className="min-w-0 flex-1 truncate text-[hsl(var(--text-secondary))] opacity-58">{row.label}</span>
              <span className="max-w-[150px] truncate text-[hsl(var(--text-primary))] opacity-80">{row.value}</span>
            </div>
          ))}
        </div>
        {latestActivity && latestActivity.length > 0 && (
          <div className="mt-4 border-t border-[hsl(var(--border))]/45 pt-3">
            <BrainGraphSectionLabel>latest firing</BrainGraphSectionLabel>
            <div className="space-y-1.5">
              {latestActivity.slice(-4).map((activity) => (
                <div key={activity.id} className="font-mono text-[9.5px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-58">
                  <span className="text-[hsl(var(--text-primary))] opacity-85">{activity.source}</span>
                  <span className="opacity-35"> / </span>
                  {activity.title}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function graphNodeToneClass(tone: SyncedBrainGraphNode["tone"]) {
  if (tone === "success") return "border-[hsl(var(--success))]/55 text-[hsl(var(--success))]";
  if (tone === "danger") return "border-red-400/60 text-red-300";
  if (tone === "accent") return "border-[hsl(var(--accent))]/60 text-[hsl(var(--accent))]";
  return "border-[hsl(var(--border))]/70 text-[hsl(var(--text-secondary))]";
}

function BrainGraphSectionLabel({ children }: { children: string }) {
  return (
    <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--accent))] opacity-60">
      {children}
    </div>
  );
}
