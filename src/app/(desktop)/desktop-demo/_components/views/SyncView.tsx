"use client";

import { PixelCharacter } from "@/components/ui/PixelCharacter";
import { DEVICES, DAEMONS, WORKSPACE, SUB_AGENTS, SKILLS } from "../../_data/mock";
import { ViewHeader, Chip, Dot, SectionLabel } from "../primitives";
import { Icon } from "../icons";
import { useAllowMockFallback, useRealData } from "../../_lib/RealDataContext";
import { useToast } from "../Toast";

// The "everything's in sync" overview — promoted from a cramped popout to a
// real, breathable page. Machines, background daemons, and what's shared.
export function SyncView() {
  const activeAgents = SUB_AGENTS.filter((a) => a.status === "active").length;
  const real = useRealData();
  const allowMockFallback = useAllowMockFallback();
  const toast = useToast();
  const live = Boolean(real?.available);
  const realMachineRows = real?.machine?.host
    ? [{
        name: real.machine.host,
        os: `${real.machine.ready ?? 0}/${real.machine.scanned ?? 0} projects ready`,
        status: "synced" as const,
        lastSync: "real proof",
        current: true,
      }]
    : [];
  const machineRows = live ? realMachineRows : allowMockFallback ? DEVICES : [];
  // Mark "this machine" by the REAL host (server-detected), not a hardcoded
  // flag — so it's never wrong. If the host is unknown (e.g. hosted web with no
  // local fs), show no "this" badge rather than mislabel a machine.
  const realHost = (real?.machine?.host ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const isThisMachine = (name: string) => {
    if (!realHost) return false;
    const n = norm(name);
    return realHost === n || realHost.startsWith(n) || n.startsWith(realHost);
  };

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
        <Dot tone={live || allowMockFallback ? "green" : "dim"} pulse={live || allowMockFallback} size={7} />
        <div>
          <div className="text-[13px] text-[hsl(var(--text-primary))]">{live || allowMockFallback ? "Everything's in sync" : "Real sync data loading"}</div>
          <div className="font-mono text-[11px] text-[hsl(var(--text-secondary))]/65">
            {live
              ? `${machineRows.length} machine${machineRows.length === 1 ? "" : "s"} · ${real?.sessions?.length ?? 0} sessions · real proof`
              : allowMockFallback
                ? `${WORKSPACE.machines} machines · ${activeAgents} active agents · last sync ${WORKSPACE.lastSync}`
                : "no placeholder sync status shown"}
          </div>
        </div>
      </div>

      {/* two-track auto-update: you.md core (team-maintained) vs your own library */}
      <SectionLabel className="mb-2.5">Auto-update</SectionLabel>
      <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-3.5">
          <div className="mb-1.5 flex items-center gap-2">
            <Icon name="sync" size={14} className="text-[hsl(var(--accent))]" />
            <span className="text-[12.5px] text-[hsl(var(--text-primary))]">you.md core</span>
            <Chip tone="green">auto · v0.8.13</Chip>
          </div>
          <p className="mb-2 text-[11px] leading-relaxed text-[hsl(var(--text-secondary))]/65">
            Runtime, CLI, API, MCP, and YStack — maintained by the you.md team. Self-upgrades on every run
            (like gstack), tracked separately from your content so it never touches your stuff.
          </p>
          <div className="flex flex-wrap gap-1">
            {["runtime", "CLI", "API", "MCP", "YStack"].map((x) => (
              <Chip key={x}>{x}</Chip>
            ))}
          </div>
        </div>
        <div className="rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-3.5">
          <div className="mb-1.5 flex items-center gap-2">
            <Icon name="brain" size={14} className="text-[hsl(var(--accent))]" />
            <span className="text-[12.5px] text-[hsl(var(--text-primary))]">Your library</span>
            <Chip tone="green">synced</Chip>
          </div>
          <p className="mb-2 text-[11px] leading-relaxed text-[hsl(var(--text-secondary))]/65">
            Your skills, skill-stacks, projects, identity, and memories — versioned + synced across machines.
            Updated only by you and your agents; core upgrades never overwrite them.
          </p>
          <div className="flex flex-wrap gap-1">
            {["skills", "stacks", "projects", "identity", "memories"].map((x) => (
              <Chip key={x}>{x}</Chip>
            ))}
          </div>
        </div>
      </div>

      {/* machines */}
      <SectionLabel className="mb-2.5">Machines</SectionLabel>
      <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {machineRows.length === 0 ? (
          <div className="rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-3 text-[12px] text-[hsl(var(--text-secondary))]/60 sm:col-span-3">
            no real machine proof loaded yet
          </div>
        ) : machineRows.map((d) => {
          const here = isThisMachine(d.name);
          return (
            <div key={d.name} className="group rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-3">
              <div className="mb-2 flex items-center gap-2.5">
                <PixelCharacter kind="machine" seed={d.name} status={d.status === "active" || d.status === "synced" ? "ready" : "idle"} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-mono text-[12px] text-[hsl(var(--text-primary))]">{d.name}</span>
                    {here && <Chip tone="accent">this</Chip>}
                  </div>
                  <div className="truncate font-mono text-[9.5px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/50">{d.os}</div>
                </div>
                {/* rename + verify — surfaced on hover; run via the you CLI */}
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    title="Rename machine"
                    onClick={() => toast(`Rename ${d.name} — runs: you machine rename "${d.name}" <new-name>`, "device")}
                    className="rounded-sm p-0.5 text-[hsl(var(--text-secondary))]/60 hover:text-[hsl(var(--accent))]"
                  >
                    <Icon name="file" size={11} />
                  </button>
                  <button
                    title="Verify machine"
                    onClick={() => toast(`Verifying ${d.name} — running you machine verify…`, "sync")}
                    className="rounded-sm p-0.5 text-[hsl(var(--text-secondary))]/60 hover:text-[hsl(var(--accent))]"
                  >
                    <Icon name="check" size={11} />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between font-mono text-[10px] text-[hsl(var(--text-secondary))]/60">
                <span className="flex items-center gap-1.5">
                  <Dot tone={d.status === "idle" ? "dim" : "green"} pulse={d.status === "active"} size={5} /> {d.status}
                </span>
                <span>{d.lastSync}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* what's shared */}
      <SectionLabel className="mb-2.5">Shared across machines</SectionLabel>
      <div className="mb-6 grid grid-cols-3 gap-2">
        {[
          { label: "Identity", value: "in sync", icon: "brain" as const },
          { label: "Skills", value: live ? `${real?.skills.length ?? 0} real` : allowMockFallback ? `${SKILLS.length} shared` : "loading", icon: "layers" as const },
          { label: "Env vault", value: "trusted-device", icon: "sync" as const },
        ].map((s) => (
          <div key={s.label} className="rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-3">
            <Icon name={s.icon} size={14} className="mb-1.5 text-[hsl(var(--accent))]" />
            <div className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/55">{s.label}</div>
            <div className="mt-0.5 text-[12.5px] text-[hsl(var(--text-primary))]">{s.value}</div>
          </div>
        ))}
      </div>

      {/* vault sync — built in; no external tool to install */}
      <SectionLabel className="mb-2.5">Vault sync</SectionLabel>
      <div className="mb-6 rounded-sm border border-[hsl(var(--accent))]/50 bg-[hsl(var(--bg-raised))] p-3.5">
        <div className="mb-1 flex items-center gap-2">
          <Icon name="sync" size={14} className="text-[hsl(var(--accent))]" />
          <span className="text-[13px] text-[hsl(var(--text-primary))]">Continuous sync · built in</span>
          <Chip tone="green">live</Chip>
        </div>
        <p className="text-[11.5px] leading-relaxed text-[hsl(var(--text-secondary))]/70">
          you.md keeps your vault, identity, skills, stacks, and encrypted env secrets continuously
          in sync across every machine — git-backed with resident realtime daemons and a trusted-device
          envelope. Nothing else to install or connect.
        </p>
      </div>

      {/* self-organizing vault (curator) */}
      <div className="mb-6 flex items-start gap-2.5 rounded-sm border-l-2 border-[hsl(var(--accent))]/50 bg-[hsl(var(--bg-raised))] px-3.5 py-2.5">
        <Icon name="sparkles" size={14} className="mt-0.5 shrink-0 text-[hsl(var(--accent))]" />
        <p className="text-[12px] leading-relaxed text-[hsl(var(--text-secondary))]">
          <span className="text-[hsl(var(--text-primary))]">Self-organizing vault.</span> A curator agent files raw captures into the right notes, links, and projects by your vault rules — you dump, it organizes.
        </p>
      </div>

      {/* background daemons */}
      <SectionLabel className="mb-2.5">Background sync</SectionLabel>
      <div className="rounded-sm border border-[hsl(var(--border))]">
        {(allowMockFallback ? DAEMONS : []).map((d, i) => (
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
