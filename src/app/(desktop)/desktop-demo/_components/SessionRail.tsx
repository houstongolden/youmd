"use client";

import { PixelCharacter } from "@/components/ui/PixelCharacter";
import { type AgentSession } from "../_data/mock";
import { ModelMark } from "./ModelSelector";
import { Dot, SectionLabel } from "./primitives";
import { Icon } from "./icons";
import { cn } from "../_lib/cn";

// Conductor-style vertical rail of every live agent session, grouped by project.
// Per-project + adds a session to that project. Sessions blocked on you are
// surfaced loudly (orange) and bubble to a "Needs you" banner up top.
export function SessionRail({
  sessions,
  activeId,
  onSelect,
  onNew,
  onCollapse,
}: {
  sessions: AgentSession[];
  activeId: string;
  onSelect: (s: AgentSession) => void;
  onNew: (project: string) => void;
  onCollapse?: () => void;
}) {
  const projects = Array.from(new Set(sessions.map((s) => s.project)));
  const needsYou = sessions.filter((s) => s.needsYou);

  return (
    <div className="flex h-full w-full flex-col bg-[hsl(var(--bg))]">
      <div className="flex items-center gap-1.5 px-3 py-2.5">
        <SectionLabel>Sessions</SectionLabel>
        <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/40">
          {sessions.length}
        </span>
        {onCollapse && (
          <button
            onClick={onCollapse}
            title="Collapse sessions"
            className="text-[hsl(var(--text-secondary))]/60 transition-colors hover:text-[hsl(var(--accent))]"
          >
            <Icon name="chevronsLeft" size={14} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* needs-you banner — the blocked work that wants Houston */}
      {needsYou.length > 0 && (
        <button
          onClick={() => onSelect(needsYou[0])}
          className="mx-2 mb-1 flex items-center gap-1.5 rounded-sm border border-[hsl(var(--accent))]/40 bg-[hsl(var(--accent))]/5 px-2 py-1.5 text-left"
        >
          <Dot tone="orange" pulse size={6} />
          <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--accent))]">
            {needsYou.length} need you
          </span>
        </button>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
        {projects.map((proj) => {
          const items = sessions.filter((s) => s.project === proj);
          return (
            <div key={proj} className="mb-2">
              <div className="group/p flex items-center justify-between px-1.5 pb-1">
                <span className="truncate font-mono text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--text-secondary))]/45">
                  {proj}
                </span>
                <button
                  onClick={() => onNew(proj)}
                  title={`New agent on ${proj}`}
                  className="text-[hsl(var(--text-secondary))]/40 transition-colors hover:text-[hsl(var(--accent))]"
                >
                  <Icon name="plus" size={11} />
                </button>
              </div>
              {items.map((s) => {
                const active = s.id === activeId;
                const needs = Boolean(s.needsYou);
                return (
                  <button
                    key={s.id}
                    onClick={() => onSelect(s)}
                    title={s.needsYou ? `Needs you: ${s.needsYou}` : `${s.title} · ${s.machine}`}
                    className={cn(
                      "mb-0.5 flex w-full items-start gap-2 rounded-sm px-1.5 py-1.5 text-left transition-colors",
                      active ? "bg-[hsl(var(--bg-raised))]" : "hover:bg-[hsl(var(--bg-raised))]/60",
                    )}
                  >
                    <span className="relative mt-0.5">
                      <PixelCharacter kind={s.local ? "agent" : "machine"} seed={s.agent} status={needs ? "warn" : s.status === "active" ? "active" : "idle"} size="xs" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className={cn("flex items-center gap-1", active ? "text-[hsl(var(--text-primary))]" : "text-[hsl(var(--text-secondary))]")}>
                        <ModelMark id={s.model} size={11} />
                        <span className="truncate text-[11.5px]">{s.title}</span>
                      </div>
                      {s.task && (
                        <div className="truncate text-[10px] text-[hsl(var(--text-secondary))]/55">↳ {s.task}</div>
                      )}
                      <div className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider">
                        {needs ? (
                          <span className="text-[hsl(var(--accent))]">needs you</span>
                        ) : s.cloud ? (
                          <span className="flex items-center gap-0.5 text-[hsl(var(--accent))]/70">
                            <Icon name="cloud" size={9} /> {s.machine}
                          </span>
                        ) : s.local ? (
                          <span className="text-[hsl(var(--text-secondary))]/45">{s.agent} · local</span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-[hsl(var(--accent))]/70">
                            <Icon name="expand" size={8} /> {s.machine}
                          </span>
                        )}
                      </div>
                    </div>
                    <Dot
                      tone={needs ? "orange" : s.status === "active" ? "green" : "dim"}
                      pulse={needs || s.status === "active"}
                      size={5}
                    />
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="border-t border-[hsl(var(--border))] px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/40">
        {sessions.filter((s) => !s.local).length} remote · watchable
      </div>
    </div>
  );
}
