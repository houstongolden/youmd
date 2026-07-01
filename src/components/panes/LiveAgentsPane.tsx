"use client";

/**
 * LiveAgentsPane — the "Live Agents / Attention Queue" observability widget.
 *
 * Read-only. Surfaces (a) live/running + recently-finished orchestrator workers
 * and agents, and (b) an attention queue for items that need a human
 * (needs-approval / blocked / failed). Backed by the owner-scoped, read-only
 * Convex query `api.agentActivity.liveAgents`, which reads `brainActivities`
 * rows the agent bus mirrors from orchestrator worker lifecycle events.
 *
 * Styling: terminal-native per project-context/STYLE_GUIDE.md — bg-raised panel,
 * 1px border, 3-dot header, mono labels, tiny green/orange/red status dots,
 * opacity-based hierarchy, burnt-orange (#C46A3A / --accent) as the only accent,
 * 2px radius, no emoji.
 */

import { useUser } from "@/lib/you-auth";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PixelCharacter, type PixelCharacterStatus } from "@/components/ui/PixelCharacter";

type AgentStatus =
  | "running"
  | "done"
  | "failed"
  | "needs-approval"
  | "blocked"
  | "idle";

interface AgentRow {
  id: string;
  activityId: string;
  harness: string | null;
  agent: string;
  host: string | null;
  workerId: string | null;
  project: string | null;
  goal: string | null;
  title: string;
  channel: string | null;
  kind: string;
  status: AgentStatus;
  workerStatus: string | null;
  exitCode: number | null;
  needsAttention: boolean;
  startedAt: number | null;
  endedAt: number | null;
  occurredAt: number;
  updatedAt: number;
  seed: string;
}

interface LiveAgentsResult {
  agents: AgentRow[];
  attention: AgentRow[];
  counts: { total: number; running: number; attention: number };
}

export function LiveAgentsPane() {
  const { user } = useUser();

  const data = useQuery(
    api.agentActivity.liveAgents,
    user?.id ? { clerkId: user.id, limit: 120 } : "skip"
  ) as LiveAgentsResult | undefined;

  if (!user) {
    return (
      <Panel title="live agents">
        <div className="px-1 py-2 opacity-55">
          sign in to watch your agents
        </div>
      </Panel>
    );
  }

  // Loading state — query not yet resolved.
  if (data === undefined) {
    return (
      <Panel title="live agents">
        <div className="px-1 py-2 opacity-45">
          <span className="text-[hsl(var(--accent))]">::</span> tuning in to the
          agent bus...
        </div>
      </Panel>
    );
  }

  const agents = data.agents ?? [];
  const attention = data.attention ?? [];
  const counts = data.counts ?? { total: 0, running: 0, attention: 0 };

  return (
    <Panel
      title="live agents"
      meta={
        counts.total > 0
          ? `${counts.running} running · ${counts.total} tracked`
          : undefined
      }
    >
      {/* Attention queue — only shown when something needs a human. */}
      {attention.length > 0 && (
        <section className="mb-5">
          <SectionLabel accent>
            needs you <span className="opacity-50">({attention.length})</span>
          </SectionLabel>
          <div className="space-y-1.5">
            {attention.map((row) => (
              <AgentRowView key={`attn-${row.id}`} row={row} emphasize />
            ))}
          </div>
        </section>
      )}

      {/* Live agents / workers. */}
      <section>
        <SectionLabel>
          agents{counts.total > 0 ? ` (${counts.total})` : ""}
        </SectionLabel>
        {agents.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-1.5">
            {agents.map((row) => (
              <AgentRowView key={row.id} row={row} />
            ))}
          </div>
        )}
      </section>
    </Panel>
  );
}

// ── Terminal panel shell ──────────────────────────────────────────────

function Panel({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-4 font-mono text-xs text-[hsl(var(--text-primary))]">
      <div
        className="border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))]"
        style={{ borderRadius: "var(--radius)" }}
      >
        {/* 3-dot terminal header */}
        <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-3 py-2">
          <span className="flex items-center gap-1" aria-hidden="true">
            <Dot className="bg-[hsl(var(--text-secondary))]/40" />
            <Dot className="bg-[hsl(var(--text-secondary))]/40" />
            <Dot className="bg-[hsl(var(--text-secondary))]/40" />
          </span>
          <span className="ml-1 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--text-secondary))] opacity-70">
            ── {title} ──
          </span>
          {meta && (
            <span className="ml-auto text-[10px] text-[hsl(var(--text-secondary))] opacity-50">
              {meta}
            </span>
          )}
        </div>
        <div className="p-3">{children}</div>
      </div>
    </div>
  );
}

function Dot({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-2 w-2 ${className}`}
      style={{ borderRadius: "var(--radius)" }}
    />
  );
}

function SectionLabel({
  children,
  accent = false,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`mb-2.5 text-[10px] uppercase tracking-[0.16em] ${
        accent
          ? "text-[hsl(var(--accent))]"
          : "text-[hsl(var(--text-secondary))] opacity-60"
      }`}
    >
      {children}
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────

function AgentRowView({ row, emphasize = false }: { row: AgentRow; emphasize?: boolean }) {
  const time = row.endedAt ?? row.occurredAt;
  return (
    <div
      className={`flex items-start gap-2.5 px-2 py-1.5 ${
        emphasize
          ? "border border-[hsl(var(--accent))]/25 bg-[hsl(var(--accent))]/[0.04]"
          : "border border-transparent"
      }`}
      style={{ borderRadius: "var(--radius)" }}
    >
      <PixelCharacter
        kind="agent"
        seed={row.seed}
        status={pixelStatus(row.status)}
        size="xs"
        className={row.status === "running" ? "opacity-95" : "opacity-70"}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <StatusDot status={row.status} />
          <span className="truncate font-bold">
            {row.harness ?? row.agent}
          </span>
          {row.project && (
            <span className="truncate text-[hsl(var(--text-secondary))] opacity-60">
              {row.project}
            </span>
          )}
          <span className="ml-auto shrink-0 text-[10px] text-[hsl(var(--text-secondary))] opacity-45">
            {relativeTime(time)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <StatusText status={row.status} exitCode={row.exitCode} />
          {row.goal && (
            <span className="truncate text-[11px] text-[hsl(var(--text-secondary))] opacity-70">
              {row.goal}
            </span>
          )}
        </div>
        {(row.host || row.workerId) && (
          <div className="mt-0.5 truncate text-[10px] text-[hsl(var(--text-secondary))] opacity-35">
            {[row.workerId, row.host].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: AgentStatus }) {
  const color = dotColor(status);
  return (
    <span
      className="inline-block h-1.5 w-1.5 shrink-0"
      style={{
        backgroundColor: color,
        borderRadius: "var(--radius)",
        boxShadow: status === "running" ? `0 0 6px ${color}` : undefined,
      }}
      aria-hidden="true"
    />
  );
}

function StatusText({
  status,
  exitCode,
}: {
  status: AgentStatus;
  exitCode: number | null;
}) {
  const label =
    status === "needs-approval"
      ? "needs approval"
      : status === "done"
        ? "done"
        : status;
  const cls =
    status === "failed" || status === "blocked"
      ? "text-[hsl(var(--destructive))]"
      : status === "needs-approval"
        ? "text-[hsl(var(--accent))]"
        : status === "running"
          ? "text-[hsl(var(--success))]"
          : status === "done"
            ? "text-[hsl(var(--success))] opacity-80"
            : "text-[hsl(var(--text-secondary))] opacity-60";
  return (
    <span className={`shrink-0 text-[11px] ${cls}`}>
      {label}
      {status === "failed" && exitCode != null ? ` (exit ${exitCode})` : ""}
    </span>
  );
}

// ── Empty state ───────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="px-1 py-3 text-[hsl(var(--text-secondary))]">
      <div className="opacity-55">no agents on the bus right now.</div>
      <div className="mt-1 opacity-35">
        run{" "}
        <span className="text-[hsl(var(--accent))]">you orchestrate run</span>{" "}
        &lt;goal&gt; and workers show up here live.
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

function pixelStatus(status: AgentStatus): PixelCharacterStatus {
  switch (status) {
    case "running":
      return "active";
    case "done":
      return "ready";
    case "failed":
      return "blocked";
    case "blocked":
      return "blocked";
    case "needs-approval":
      return "warn";
    default:
      return "idle";
  }
}

function dotColor(status: AgentStatus): string {
  if (status === "running" || status === "done") return "hsl(var(--success))";
  if (status === "failed" || status === "blocked") return "hsl(var(--destructive))";
  if (status === "needs-approval") return "hsl(var(--accent))";
  return "hsl(var(--text-secondary) / 0.5)";
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (!Number.isFinite(diff) || diff < 0) return "now";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
