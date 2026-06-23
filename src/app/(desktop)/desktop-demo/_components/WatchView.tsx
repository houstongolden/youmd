"use client";

import { useEffect, useState } from "react";
import { PixelCharacter } from "@/components/ui/PixelCharacter";
import { WATCH_FEED, type AgentSession } from "../_data/mock";
import { Dot, Chip } from "./primitives";
import { Icon } from "./icons";

// Peekaboo: watch an agent session running on ANOTHER you.md-synced machine,
// in real time. Read-only by default; "join" to collaborate. The summary lines
// stream in so it feels live (mock timer; wire to the agent bus in the real app).
export function WatchView({ session }: { session: AgentSession }) {
  const feed = WATCH_FEED[session.id] ?? [session.summary];
  const [shown, setShown] = useState(1);

  // Component is keyed by session id at the call site, so it remounts (and
  // `shown` resets to 1) when you switch sessions — no setState-in-effect.
  useEffect(() => {
    if (feed.length <= 1) return;
    const t = setInterval(() => {
      setShown((n) => (n < feed.length ? n + 1 : n));
    }, 1400);
    return () => clearInterval(t);
  }, [feed.length]);

  return (
    <div className="flex h-full flex-col bg-[hsl(var(--bg))]">
      {/* watching header */}
      <div className="flex items-center gap-2.5 border-b border-[hsl(var(--border))] px-4 py-2.5">
        <PixelCharacter kind="agent" seed={session.agent} status={session.status === "active" ? "active" : "idle"} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-[12.5px] text-[hsl(var(--text-primary))]">{session.agent}</span>
            <Chip tone="accent">
              <Icon name={session.cloud ? "cloud" : "device"} size={9} /> {session.machine}
            </Chip>
          </div>
          <div className="truncate font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/55">
            watching · {session.project}
          </div>
        </div>
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--success))]">
          <Dot tone="green" pulse size={5} /> live
        </span>
      </div>

      {/* streaming summary of what it's doing */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-3 rounded-sm border-l-2 border-[hsl(var(--accent))]/60 bg-[hsl(var(--bg-raised))] px-3 py-2.5 text-[12.5px] leading-relaxed text-[hsl(var(--text-secondary))]">
          {session.summary}
        </div>
        <div className="space-y-1.5 font-mono text-[12px]">
          {feed.slice(0, shown).map((line, i) => (
            <div key={i} className="flex items-start gap-2 text-[hsl(var(--text-secondary))]/85">
              <span className="mt-0.5 shrink-0 text-[hsl(var(--accent))]">›</span>
              <span>{line}</span>
            </div>
          ))}
          {shown < feed.length && (
            <div className="flex items-center gap-2 pl-4 text-[hsl(var(--text-secondary))]/45">
              <Dot tone="orange" pulse size={5} /> working…
            </div>
          )}
        </div>
      </div>

      {/* collaborate bar */}
      <div className="flex items-center gap-2 border-t border-[hsl(var(--border))] px-4 py-2.5">
        <button className="flex items-center gap-1.5 rounded-sm bg-[hsl(var(--accent))] px-3 py-1.5 font-mono text-[11px] text-white transition-opacity hover:opacity-90">
          <Icon name="chat" size={13} /> join session
        </button>
        <button className="flex items-center gap-1.5 rounded-sm border border-[hsl(var(--border))] px-3 py-1.5 font-mono text-[11px] text-[hsl(var(--text-secondary))] transition-colors hover:text-[hsl(var(--text-primary))]">
          <Icon name="send" size={13} /> nudge
        </button>
        <span className="ml-auto font-mono text-[10px] text-[hsl(var(--text-secondary))]/45">read-only · synced via you.md</span>
      </div>
    </div>
  );
}
