"use client";

import { PixelCharacter } from "@/components/ui/PixelCharacter";
import { useRealData } from "../../_lib/RealDataContext";
import { ACTIVITY, AGENT_BUS } from "../../_data/mock";
import { Dot, Chip, ViewHeader } from "../primitives";

type Entry = { id: string; actor: string; kind: "agent" | "machine"; text: string; at: string };

// Consolidated live server/sync log — the demo's take on the main app's
// LiveBrainLog. Reads REAL agent-bus + machine activity when available, plus
// synthesized sync lines from the real machine report and project readiness.
export function LiveLogView() {
  const real = useRealData();

  let entries: Entry[] = [];
  let live = false;

  if (real?.available) {
    live = true;
    entries = real.activity.map((a) => ({ id: a.id, actor: a.actor, kind: a.kind, text: a.text, at: a.at }));
    if (real.machine?.host) {
      entries.push({
        id: "m-proof",
        actor: real.machine.host,
        kind: "machine",
        text: `readiness proof synced · ${real.machine.ready ?? "?"}/${real.machine.scanned ?? "?"} ready · ${real.machine.envLocal ?? 0} env.local`,
        at: "report",
      });
    }
    // synthesize a few real sync lines from project state
    for (const p of real.projects.filter((p) => p.hasEnvLocal).slice(0, 4)) {
      entries.push({ id: `env-${p.name}`, actor: p.name, kind: "machine", text: "env.local present · ready to run", at: "repo" });
    }
  } else {
    entries = [
      ...ACTIVITY.map((a) => ({ id: a.id, actor: a.actor, kind: a.kind, text: a.text, at: a.at })),
      ...AGENT_BUS.map((m) => ({ id: m.id, actor: m.from, kind: "agent" as const, text: m.text, at: m.at })),
    ];
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[hsl(var(--border))] px-4 py-3 sm:px-6">
        <ViewHeader
          title="Live log"
          description="Consolidated server + sync activity across your agents, machines, and repos."
          right={
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--success))]">
              <Dot tone="green" pulse size={5} /> {live ? "live · real" : "live"}
            </span>
          }
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-6">
        {entries.length === 0 ? (
          <div className="py-8 text-center font-mono text-[12px] text-[hsl(var(--text-secondary))]/50">
            no activity yet — agents will stream here
          </div>
        ) : (
          <div className="space-y-0">
            {entries.map((e, i) => (
              <div
                key={`${e.id}-${i}`}
                className="flex items-center gap-3 border-b border-[hsl(var(--border))]/60 py-2 last:border-b-0"
              >
                <PixelCharacter kind={e.kind} seed={e.actor} status="active" size="xs" />
                <span className="shrink-0 font-mono text-[11px] text-[hsl(var(--text-primary))]">{e.actor}</span>
                <Chip>{e.kind}</Chip>
                <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-[hsl(var(--text-secondary))]/85">{e.text}</span>
                <span className="shrink-0 font-mono text-[10px] text-[hsl(var(--text-secondary))]/40">{e.at}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
