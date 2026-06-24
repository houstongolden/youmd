"use client";

import { useEffect, useRef } from "react";
import { PixelCharacter, type PixelCharacterStatus } from "@/components/ui/PixelCharacter";
import { useRealData } from "../../_lib/RealDataContext";
import { ACTIVITY, AGENT_BUS } from "../../_data/mock";
import { Dot, ViewHeader } from "../primitives";

type Status = "live" | "ok" | "warn" | "info";
type Entry = { id: string; actor: string; kind: "agent" | "machine"; text: string; detail?: string; channel?: string; at: string; status: Status };

// Terminal-style brain log — ports the classic LiveBrainLog aesthetic (mono
// grid, tabular time, color-coded source) into the new shell. Reads REAL
// agent-bus + machine activity when available; clean, no link clutter.
function statusClass(s: Status) {
  if (s === "live") return "text-[hsl(var(--success))]";
  if (s === "ok") return "text-[hsl(var(--success))] opacity-80";
  if (s === "warn") return "text-[hsl(var(--accent))]";
  return "text-[hsl(var(--text-secondary))] opacity-45";
}
function pixelStatus(s: Status): PixelCharacterStatus {
  if (s === "live") return "active";
  if (s === "ok") return "ready";
  if (s === "warn") return "warn";
  return "idle";
}

export function LiveLogView() {
  const real = useRealData();
  const endRef = useRef<HTMLDivElement | null>(null);

  let entries: Entry[] = [];
  let live = false;

  if (real?.available) {
    live = true;
    entries = real.activity.map((a) => ({
      id: a.id,
      actor: a.actor,
      kind: a.kind,
      text: a.text,
      channel: a.kind === "machine" ? "sync" : "bus",
      at: a.at,
      status: a.kind === "machine" ? "ok" : "live",
    }));
    if (real.machine?.host) {
      entries.push({
        id: "m-proof",
        actor: real.machine.host,
        kind: "machine",
        text: "readiness proof synced",
        detail: `${real.machine.ready ?? "?"}/${real.machine.scanned ?? "?"} ready · ${real.machine.envLocal ?? 0} env.local`,
        channel: "proof",
        at: "report",
        status: "ok",
      });
    }
    for (const p of real.projects.filter((p) => p.hasEnvLocal).slice(0, 4)) {
      entries.push({ id: `env-${p.name}`, actor: p.name, kind: "machine", text: "env.local present", detail: "ready to run", channel: "repo", at: "repo", status: "info" });
    }
  } else {
    entries = [
      ...ACTIVITY.map((a) => ({ id: a.id, actor: a.actor, kind: a.kind, text: a.text, channel: a.kind === "machine" ? "sync" : "bus", at: a.at, status: (a.kind === "machine" ? "ok" : "live") as Status })),
      ...AGENT_BUS.map((m) => ({ id: m.id, actor: m.from, kind: "agent" as const, text: m.text, channel: "bus", at: m.at, status: "info" as Status })),
    ];
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [entries.length]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[hsl(var(--border))] px-4 py-3 sm:px-6">
        <ViewHeader
          title="Live log"
          description="Realtime agent messages, daemon proof, skill syncs, vault, and repo activity across your machines."
          right={
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--success))]">
              <Dot tone="green" pulse size={5} /> {live ? "live · real" : "live"}
            </span>
          }
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 font-mono text-[11px] leading-relaxed sm:px-6" role="log" aria-label="live activity log">
        {entries.length === 0 ? (
          <div className="py-8 text-center text-[12px] text-[hsl(var(--text-secondary))]/50">
            waiting for the first brain event…
          </div>
        ) : (
          <div className="space-y-1.5">
            {entries.map((e, i) => (
              <div key={`${e.id}-${i}`} className="grid grid-cols-[22px_64px_84px_1fr] items-start gap-2">
                <PixelCharacter kind={e.kind} seed={`${e.actor}:${e.text}`} status={pixelStatus(e.status)} size="xs" className="mt-0.5 opacity-80" />
                <span className="tabular-nums text-[hsl(var(--text-secondary))] opacity-40">{e.at}</span>
                <span className={`truncate uppercase tracking-[0.12em] ${statusClass(e.status)}`}>{e.actor}</span>
                <span className="min-w-0">
                  <span className="text-[hsl(var(--text-primary))] opacity-90">{e.text}</span>
                  {e.detail && <span className="text-[hsl(var(--text-secondary))] opacity-50"> {e.detail}</span>}
                  {e.channel && <span className="ml-1 text-[hsl(var(--text-secondary))] opacity-30">[{e.channel}]</span>}
                </span>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>
    </div>
  );
}
