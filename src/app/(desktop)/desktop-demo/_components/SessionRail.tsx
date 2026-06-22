"use client";

import { PixelCharacter } from "@/components/ui/PixelCharacter";
import { SESSIONS, type AgentSession } from "../_data/mock";
import { Dot, SectionLabel } from "./primitives";
import { Icon } from "./icons";
import { cn } from "../_lib/cn";

// Conductor-style vertical rail of every live agent session, grouped by project.
// Local sessions run here; remote sessions run on other you.md-synced machines
// and are marked with an eye (watch). Click to switch the shell to that session.
export function SessionRail({
  activeId,
  onSelect,
  onNew,
}: {
  activeId: string;
  onSelect: (s: AgentSession) => void;
  onNew: () => void;
}) {
  const projects = Array.from(new Set(SESSIONS.map((s) => s.project)));

  return (
    <div className="flex w-[164px] shrink-0 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--bg))]">
      <div className="flex items-center justify-between px-3 py-2.5">
        <SectionLabel>Sessions</SectionLabel>
        <button onClick={onNew} title="New session" className="text-[hsl(var(--text-secondary))] transition-colors hover:text-[hsl(var(--accent))]">
          <Icon name="plus" size={13} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
        {projects.map((proj) => {
          const items = SESSIONS.filter((s) => s.project === proj);
          return (
            <div key={proj} className="mb-2">
              <div className="px-1.5 pb-1 font-mono text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--text-secondary))]/45">
                {proj}
              </div>
              {items.map((s) => {
                const active = s.id === activeId;
                return (
                  <button
                    key={s.id}
                    onClick={() => onSelect(s)}
                    title={`${s.title} · ${s.machine}`}
                    className={cn(
                      "mb-0.5 flex w-full items-center gap-2 rounded-sm px-1.5 py-1.5 text-left transition-colors",
                      active
                        ? "bg-[hsl(var(--bg-raised))]"
                        : "hover:bg-[hsl(var(--bg-raised))]/60",
                    )}
                  >
                    <PixelCharacter kind={s.local ? "agent" : "machine"} seed={s.agent} status={s.status === "active" ? "active" : "idle"} size="xs" />
                    <div className="min-w-0 flex-1">
                      <div className={cn("flex items-center gap-1", active ? "text-[hsl(var(--text-primary))]" : "text-[hsl(var(--text-secondary))]")}>
                        <Icon name={s.kind === "chat" ? "chat" : "terminal"} size={10} className="shrink-0 opacity-60" />
                        <span className="truncate text-[11.5px]">{s.title}</span>
                      </div>
                      <div className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/45">
                        {s.local ? (
                          <span>local</span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-[hsl(var(--accent))]/70">
                            <Icon name="expand" size={8} /> {s.machine}
                          </span>
                        )}
                      </div>
                    </div>
                    <Dot tone={s.status === "active" ? "green" : s.status === "waiting" ? "orange" : "dim"} pulse={s.status === "active"} size={5} />
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="border-t border-[hsl(var(--border))] px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/40">
        {SESSIONS.filter((s) => !s.local).length} remote · watchable
      </div>
    </div>
  );
}
