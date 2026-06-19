"use client";

import { motion } from "motion/react";
import { LiveBrainLog, type LiveLogEntry } from "@/components/terminal/LiveBrainLog";
import { DAEMONS, DEVICES, AGENT_BUS, WORKSPACE } from "../_data/mock";
import { Icon } from "./icons";
import { Dot, SectionLabel } from "./primitives";

function mockTimeAgo(value: string): number {
  const now = Date.now();
  if (value === "now" || value === "just now") return now;
  const match = value.match(/^(\d+)(s|m|h|d) ago$/);
  if (!match) return now;
  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === "s") return now - amount * 1_000;
  if (unit === "m") return now - amount * 60_000;
  if (unit === "h") return now - amount * 60 * 60_000;
  return now - amount * 24 * 60 * 60_000;
}

// The "behind the scenes" panel. This is the product's answer to "what runs in
// the background vs. what the user sees": everything here is AWARENESS ONLY —
// daemons, realtime sync, machines, crawlers, agent bus. No controls, no
// config. It's managed by the curl-installed daemons; the app just reflects it.
export function SystemStatus({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  const online = DEVICES.filter((d) => d.status !== "idle").length;
  const logEntries: LiveLogEntry[] = [
    ...AGENT_BUS.map((message) => ({
      id: `bus-${message.id}`,
      at: mockTimeAgo(message.at),
      source: "bus",
      channel: message.channel,
      kind: "message",
      title: `${message.from} @ ${message.device}`,
      detail: message.text,
      status: "live" as const,
    })),
    ...DAEMONS.map((daemon) => ({
      id: `daemon-${daemon.name}`,
      at: mockTimeAgo(daemon.last),
      source: "daemon",
      channel: daemon.name,
      kind: "loaded",
      title: daemon.name,
      detail: daemon.detail,
      status: "ok" as const,
    })),
    ...DEVICES.map((device) => ({
      id: `device-${device.name}`,
      at: mockTimeAgo(device.lastSync),
      source: "machine",
      channel: device.name,
      kind: device.status,
      title: `${device.name}${device.current ? " · this machine" : ""}`,
      detail: device.agents.join(", "),
      status: device.status === "idle" ? "warn" as const : "ok" as const,
    })),
  ].sort((a, b) => Number(a.at ?? 0) - Number(b.at ?? 0));

  return (
    <div className="fixed inset-0 z-50">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <motion.div
        role="dialog"
        aria-label="System status"
        className="absolute left-3 top-12 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] shadow-2xl"
        initial={{ opacity: 0, y: -6, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
      >
        {/* header */}
        <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-4 py-3">
          <Dot tone="green" pulse />
          <span className="text-[13px] text-[hsl(var(--text-primary))]">Everything&apos;s in sync</span>
          <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/55">
            {WORKSPACE.lastSync}
          </span>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-3">
          {/* daemons */}
          <SectionLabel className="mb-1.5 px-1">Running behind the scenes</SectionLabel>
          <div className="mb-4 space-y-1">
            {DAEMONS.map((d) => (
              <div key={d.name} className="flex items-center gap-2.5 px-1 py-1">
                <Dot tone="green" size={6} />
                <span className="text-[12px] text-[hsl(var(--text-primary))]">{d.name}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/50">
                  {d.detail}
                </span>
                <span className="ml-auto font-mono text-[10px] text-[hsl(var(--text-secondary))]/45">{d.last}</span>
              </div>
            ))}
          </div>

          {/* machines */}
          <SectionLabel className="mb-1.5 px-1">
            Machines · {online}/{DEVICES.length} online
          </SectionLabel>
          <div className="mb-4 space-y-1">
            {DEVICES.map((d) => (
              <div key={d.name} className="flex items-center gap-2.5 px-1 py-1">
                <Icon name="device" size={13} className="text-[hsl(var(--text-secondary))]/70" />
                <span className="font-mono text-[12px] text-[hsl(var(--text-primary))]">{d.name}</span>
                {d.current && (
                  <span className="font-mono text-[9px] uppercase tracking-wider text-[hsl(var(--accent))]">this</span>
                )}
                <span className="ml-auto flex items-center gap-1.5">
                  <Dot tone={d.status === "idle" ? "dim" : "green"} size={5} pulse={d.status === "active"} />
                  <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))]/45">{d.lastSync}</span>
                </span>
              </div>
            ))}
          </div>

          {/* recent background activity */}
          <SectionLabel className="mb-1.5 px-1">Central brain log</SectionLabel>
          <LiveBrainLog entries={logEntries} compact maxEntries={9} showIntro={false} />
        </div>

        <div className="border-t border-[hsl(var(--border))] px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/45">
          managed by your daemons — nothing to configure
        </div>
      </motion.div>
    </div>
  );
}
