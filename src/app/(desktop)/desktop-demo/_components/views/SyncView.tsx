"use client";

import { PixelCharacter } from "@/components/ui/PixelCharacter";
import { DEVICES, DAEMONS, WORKSPACE, SUB_AGENTS, SKILLS } from "../../_data/mock";
import { ViewHeader, Chip, Dot, SectionLabel } from "../primitives";
import { Icon } from "../icons";

// The "everything's in sync" overview — promoted from a cramped popout to a
// real, breathable page. Machines, background daemons, and what's shared.
export function SyncView() {
  const activeAgents = SUB_AGENTS.filter((a) => a.status === "active").length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-8">
      <ViewHeader
        title={
          <>
            <Icon name="sync" size={18} className="text-[hsl(var(--accent))]" /> Sync
          </>
        }
        description="Your brain, skills, and projects stay current on every machine — automatically, in the background."
      />

      {/* status hero */}
      <div className="mb-6 flex items-center gap-3 rounded-sm border-l-2 border-[hsl(var(--success))]/60 bg-[hsl(var(--bg-raised))] px-4 py-3">
        <Dot tone="green" pulse size={7} />
        <div>
          <div className="text-[13px] text-[hsl(var(--text-primary))]">Everything&apos;s in sync</div>
          <div className="font-mono text-[11px] text-[hsl(var(--text-secondary))]/65">
            {WORKSPACE.machines} machines · {activeAgents} active agents · last sync {WORKSPACE.lastSync}
          </div>
        </div>
      </div>

      {/* machines */}
      <SectionLabel className="mb-2.5">Machines</SectionLabel>
      <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {DEVICES.map((d) => (
          <div key={d.name} className="rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-3">
            <div className="mb-2 flex items-center gap-2.5">
              <PixelCharacter kind="machine" seed={d.name} status={d.status === "active" || d.status === "synced" ? "ready" : "idle"} size="md" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-mono text-[12px] text-[hsl(var(--text-primary))]">{d.name}</span>
                  {d.current && <Chip>this</Chip>}
                </div>
                <div className="truncate font-mono text-[9.5px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/50">{d.os}</div>
              </div>
            </div>
            <div className="flex items-center justify-between font-mono text-[10px] text-[hsl(var(--text-secondary))]/60">
              <span className="flex items-center gap-1.5">
                <Dot tone={d.status === "idle" ? "dim" : "green"} pulse={d.status === "active"} size={5} /> {d.status}
              </span>
              <span>{d.lastSync}</span>
            </div>
          </div>
        ))}
      </div>

      {/* what's shared */}
      <SectionLabel className="mb-2.5">Shared across machines</SectionLabel>
      <div className="mb-6 grid grid-cols-3 gap-2">
        {[
          { label: "Identity", value: "in sync", icon: "brain" as const },
          { label: "Skills", value: `${SKILLS.length} shared`, icon: "layers" as const },
          { label: "Env vault", value: "trusted-device", icon: "sync" as const },
        ].map((s) => (
          <div key={s.label} className="rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-3">
            <Icon name={s.icon} size={14} className="mb-1.5 text-[hsl(var(--accent))]" />
            <div className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/55">{s.label}</div>
            <div className="mt-0.5 text-[12.5px] text-[hsl(var(--text-primary))]">{s.value}</div>
          </div>
        ))}
      </div>

      {/* background daemons */}
      <SectionLabel className="mb-2.5">Background sync</SectionLabel>
      <div className="rounded-sm border border-[hsl(var(--border))]">
        {DAEMONS.map((d, i) => (
          <div
            key={d.name}
            className={
              "flex items-center gap-3 px-3.5 py-2.5" +
              (i !== DAEMONS.length - 1 ? " border-b border-[hsl(var(--border))]" : "")
            }
          >
            <Dot tone="green" pulse size={5} />
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-[hsl(var(--text-primary))]">{d.name}</span>
            <span className="shrink-0 font-mono text-[10px] text-[hsl(var(--text-secondary))]/55">{d.detail}</span>
            <span className="shrink-0 font-mono text-[10px] text-[hsl(var(--text-secondary))]/40">{d.last}</span>
          </div>
        ))}
      </div>

      <p className="mt-4 text-[12px] leading-relaxed text-[hsl(var(--text-secondary))]/70">
        These run on their own via the resident daemons — you never configure them, you just see their state.
      </p>
    </div>
  );
}
