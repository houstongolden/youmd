"use client";

import { PixelCharacter } from "@/components/ui/PixelCharacter";
import { ACTIVITY } from "../_data/mock";
import { Dot } from "./primitives";

// The "your second brain is working for you" feed — agents + machines doing
// real things, each with a pixel-character so it reads at a glance. This is the
// demo's lightweight take on the shell's LiveBrainLog.
export function ActivityStream({ limit }: { limit?: number }) {
  const events = limit ? ACTIVITY.slice(0, limit) : ACTIVITY;
  return (
    <div className="overflow-hidden rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))]">
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-3.5 py-2.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--text-secondary))]/70">
          Live activity
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--success))]">
          <Dot tone="green" pulse size={5} /> live
        </span>
      </div>
      <div>
        {events.map((e, i) => (
          <div
            key={e.id}
            className={
              "flex items-center gap-3 px-3.5 py-2.5" +
              (i !== events.length - 1 ? " border-b border-[hsl(var(--border))]" : "")
            }
          >
            <PixelCharacter kind={e.kind} seed={e.actor} status={e.status} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[12px] text-[hsl(var(--text-primary))]">{e.actor}</span>
                <span className="font-mono text-[9px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/45">
                  {e.kind}
                </span>
              </div>
              <div className="truncate text-[12px] text-[hsl(var(--text-secondary))]/85">{e.text}</div>
            </div>
            <span className="shrink-0 font-mono text-[10px] text-[hsl(var(--text-secondary))]/45">{e.at}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
