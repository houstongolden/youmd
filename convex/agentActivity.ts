import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { requireOwner } from "./lib/auth";

/**
 * Read-only query layer for the "Live Agents / Attention Queue" observability
 * widget (see project-context/DSI_VIEWS_WIDGETS_AND_PIXEL_AGENTS_2026-06-19.md).
 *
 * The orchestrator (`you orchestrate`) posts worker lifecycle events through the
 * agent bus. `agentBus.sendMessage` mirrors every bus message into a
 * `brainActivities` row with `source: "agent-bus"`, plus the raw worker payload
 * under `metadata.message` (workerId, harness, project, status, exitCode,
 * startedAt, endedAt). Other agents/machines also emit agent-bus activity.
 *
 * This module is STRICTLY read-only (Convex `query` only, no mutations) and is
 * scoped to the authenticated owner via `requireOwner` — the same auth path
 * every other user-scoped query in this codebase uses (see convex/lib/auth.ts).
 */

const AGENT_BUS_SOURCE = "agent-bus";
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 80;

// Terminal display status the widget renders row dots / attention grouping from.
type AgentStatus = "running" | "done" | "failed" | "needs-approval" | "blocked" | "idle";

async function requireUser(
  ctx: QueryCtx,
  clerkId: string,
  internalAuthToken?: string,
): Promise<Doc<"users">> {
  await requireOwner(ctx, clerkId, internalAuthToken);
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
    .first();
  if (!user) throw new Error("User not found");
  return user;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number") return String(value);
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return undefined;
}

/**
 * Collapse the various status signals an agent-bus row can carry into the
 * canonical widget status. Precedence: explicit worker `metadata.message.status`
 * (running|exited|failed) → the row `kind`/`status` conventions used by
 * `brainActivityStatus`/`normalizeStatus` (blocked, needs-approval, error).
 */
function deriveStatus(row: Doc<"brainActivities">, workerStatus: string | undefined): AgentStatus {
  const kind = (row.kind ?? "").toLowerCase();
  const status = (row.status ?? "").toLowerCase();
  const worker = (workerStatus ?? "").toLowerCase();

  // Human-attention signals take priority so the attention queue never misses one.
  if (
    kind.includes("needs-approval") ||
    kind.includes("needs_approval") ||
    kind.includes("approval") ||
    status.includes("needs-approval") ||
    status.includes("approval")
  ) {
    return "needs-approval";
  }
  if (kind.includes("blocked") || status.includes("blocked")) return "blocked";

  if (worker === "failed" || kind.includes("fail") || status === "error") return "failed";
  if (worker === "running" || kind === "running" || status === "live") return "running";
  if (worker === "exited" || worker === "done" || worker === "complete" || kind.includes("complete")) {
    // A completed worker with a non-zero exit is a failure worth surfacing.
    return "done";
  }
  if (status === "ok") return "done";
  return "idle";
}

function isAttention(status: AgentStatus): boolean {
  return status === "needs-approval" || status === "blocked" || status === "failed";
}

function toAgentRow(row: Doc<"brainActivities">) {
  const meta = asRecord(row.metadata);
  const message = asRecord(meta?.message);
  const workerStatus = asString(message?.status);
  const status = deriveStatus(row, workerStatus);
  const exitCode = asNumber(message?.exitCode);
  const startedAt = asNumber(message?.startedAt);
  const endedAt = asNumber(message?.endedAt);

  return {
    id: String(row._id),
    activityId: row.activityId,
    // Identity / harness
    harness: asString(message?.harness) ?? row.sourceRuntime ?? null,
    agent: row.sourceAgent ?? "agent",
    host: row.sourceHost ?? null,
    workerId: asString(message?.workerId) ?? null,
    // What it's doing
    project: asString(message?.project) ?? row.projectSlug ?? null,
    goal: row.detail ?? row.title ?? null,
    title: row.title,
    channel: row.channel ?? null,
    kind: row.kind,
    // Status
    status,
    workerStatus: workerStatus ?? null,
    exitCode: exitCode ?? null,
    needsAttention: isAttention(status),
    // Timing
    startedAt: startedAt ?? null,
    endedAt: endedAt ?? null,
    occurredAt: row.occurredAt,
    updatedAt: row.updatedAt,
    // Seed for a deterministic PixelCharacter
    seed:
      asString(message?.workerId) ??
      `${row.sourceAgent ?? "agent"}:${asString(message?.harness) ?? row.channel ?? ""}`,
  };
}

export type AgentRow = ReturnType<typeof toAgentRow>;

/**
 * Live/recent orchestrator workers + agents for the current user, split into
 * an `agents` list (all rows, newest first) and an `attention` list (rows that
 * need a human: needs-approval / blocked / failed).
 *
 * Read-only. Owner-scoped. Returns empty arrays when there is no data.
 */
export const liveAgents = query({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    since: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.clerkId, args._internalAuthToken);
    const limit = Math.max(1, Math.min(MAX_LIMIT, Math.round(args.limit ?? DEFAULT_LIMIT)));
    const since = Number.isFinite(args.since) ? (args.since ?? 0) : 0;

    // Scoped read: this user's agent-bus activity only, newest first.
    const rows = await ctx.db
      .query("brainActivities")
      .withIndex("by_userId_source_occurredAt", (q) =>
        q.eq("userId", user._id).eq("source", AGENT_BUS_SOURCE),
      )
      .order("desc")
      .take(limit);

    const agents = rows
      .filter((row) => row.occurredAt > since)
      .map(toAgentRow);

    const attention = agents.filter((row) => row.needsAttention);

    const running = agents.filter((row) => row.status === "running").length;

    return {
      agents,
      attention,
      counts: {
        total: agents.length,
        running,
        attention: attention.length,
      },
    };
  },
});
