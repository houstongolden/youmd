/**
 * Cross-machine remote command durability (CROSS-MACHINE-AGENTS.md §4, Phase 2).
 *
 * Phase 1 dispatches commands purely over the agent bus. Phase 2 adds this
 * durable `remoteCommands` table so:
 *   - the daemon can PULL queued work without scanning the message stream,
 *   - issuers can poll a single requestId for a clean terminal status,
 *   - idempotency is enforced at the store layer (one row per requestId),
 *   - a TTL (`expiresAt`) bounds how long a queued command stays runnable.
 *
 * Everything here is ADDITIVE. The HTTP dispatch route still posts the Phase 1
 * bus message; this table is written alongside it. If the daemon or issuer
 * predates Phase 2 (or the table isn't deployed), the bus path keeps working.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireOwner } from "./lib/auth";

const MAX_STR = 4_000;
const MAX_SHORT = 200;

/** Terminal + transition statuses a remote command row may carry. */
export const REMOTE_COMMAND_STATUSES = [
  "queued",
  "acked",
  "running",
  "done",
  "error",
  "expired",
  "rejected",
] as const;
export type RemoteCommandStatus = (typeof REMOTE_COMMAND_STATUSES)[number];

function isStatus(value: unknown): value is RemoteCommandStatus {
  return (
    typeof value === "string" &&
    (REMOTE_COMMAND_STATUSES as readonly string[]).includes(value)
  );
}

async function loadOwner(
  ctx: QueryCtx | MutationCtx,
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

function clip(value: string | undefined, max: number): string | undefined {
  if (value === undefined) return undefined;
  // Strip control chars (consistent with agentBus.ts sanitization) and cap.
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").slice(0, max);
}
function toPublic(row: Doc<"remoteCommands">) {
  return {
    id: String(row._id),
    requestId: row.requestId,
    targetHost: row.targetHost,
    sourceHost: row.sourceHost,
    sourceAgent: row.sourceAgent,
    action: row.action,
    args: row.args ?? null,
    status: row.status,
    ok: row.ok ?? null,
    output: row.output ?? null,
    exitCode: row.exitCode ?? null,
    gitState: row.gitState ?? null,
    issuedAt: row.issuedAt,
    expiresAt: row.expiresAt,
    completedAt: row.completedAt ?? null,
    secretValuesExposed: false,
  };
}

async function findByRequestId(
  ctx: QueryCtx | MutationCtx,
  userId: Doc<"users">["_id"],
  requestId: string,
): Promise<Doc<"remoteCommands"> | null> {
  return ctx.db
    .query("remoteCommands")
    .withIndex("by_userId_requestId", (q) =>
      q.eq("userId", userId).eq("requestId", requestId),
    )
    .first();
}

/**
 * Write (or no-op return) a queued command row. Idempotent on requestId: a
 * replay returns the existing row unchanged so dispatch can be safely retried.
 */
export const enqueue = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    requestId: v.string(),
    targetHost: v.string(),
    sourceHost: v.string(),
    sourceAgent: v.string(),
    action: v.string(),
    args: v.optional(v.any()),
    issuedAt: v.number(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const requestId = clip(args.requestId, MAX_SHORT) ?? "";
    if (!requestId) throw new Error("requestId is required");

    const existing = await findByRequestId(ctx, user._id, requestId);
    if (existing) return toPublic(existing);

    const id = await ctx.db.insert("remoteCommands", {
      userId: user._id,
      requestId,
      targetHost: clip(args.targetHost, MAX_SHORT) ?? "",
      sourceHost: clip(args.sourceHost, MAX_SHORT) ?? "",
      sourceAgent: clip(args.sourceAgent, MAX_SHORT) ?? "agent",
      action: clip(args.action, MAX_SHORT) ?? "",
      args: args.args,
      status: "queued",
      issuedAt: args.issuedAt,
      expiresAt: args.expiresAt,
      secretValuesExposed: false,
    });
    const row = await ctx.db.get(id);
    if (!row) throw new Error("remote command failed to save");
    return toPublic(row);
  },
});

/**
 * Best-effort status transition from the daemon (acked→running→done/error).
 * No-op (returns null) when the requestId is unknown — keeps the daemon
 * backward-compatible against deployments without a queued row.
 */
export const updateStatus = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    requestId: v.string(),
    status: v.string(),
    ok: v.optional(v.boolean()),
    output: v.optional(v.string()),
    exitCode: v.optional(v.number()),
    gitState: v.optional(v.any()),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    if (!isStatus(args.status)) throw new Error(`unknown status: ${args.status}`);

    const row = await findByRequestId(ctx, user._id, args.requestId);
    if (!row) return null; // no queued row — bus-only command, nothing to track

    const patch: Partial<Doc<"remoteCommands">> = { status: args.status };
    if (args.ok !== undefined) patch.ok = args.ok;
    if (args.output !== undefined) patch.output = clip(args.output, MAX_STR);
    if (args.exitCode !== undefined) patch.exitCode = args.exitCode;
    if (args.gitState !== undefined) patch.gitState = args.gitState;
    if (args.completedAt !== undefined) patch.completedAt = args.completedAt;

    await ctx.db.patch(row._id, patch);
    const updated = await ctx.db.get(row._id);
    return updated ? toPublic(updated) : null;
  },
});

/** Single-command status lookup by requestId (issuer poll). */
export const getByRequestId = query({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    requestId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const row = await findByRequestId(ctx, user._id, args.requestId);
    return row ? toPublic(row) : null;
  },
});

/**
 * List commands, optionally filtered by targetHost + status. The daemon uses
 * `targetHost=<self>&status=queued` to pull pending work.
 */
export const list = query({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    targetHost: v.optional(v.string()),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const limit = Math.max(1, Math.min(100, Math.round(args.limit ?? 30)));

    let rows: Doc<"remoteCommands">[];
    if (args.targetHost && args.status) {
      rows = await ctx.db
        .query("remoteCommands")
        .withIndex("by_userId_target_status", (q) =>
          q
            .eq("userId", user._id)
            .eq("targetHost", clip(args.targetHost, MAX_SHORT) ?? "")
            .eq("status", clip(args.status, MAX_SHORT) ?? ""),
        )
        .order("desc")
        .take(limit);
    } else {
      const all = await ctx.db
        .query("remoteCommands")
        .withIndex("by_userId_requestId", (q) => q.eq("userId", user._id))
        .order("desc")
        .take(500);
      const targetHost = args.targetHost
        ? (clip(args.targetHost, MAX_SHORT) ?? "")
        : null;
      const status = args.status ? (clip(args.status, MAX_SHORT) ?? "") : null;
      rows = all
        .filter((r) => (targetHost ? r.targetHost === targetHost : true))
        .filter((r) => (status ? r.status === status : true))
        .slice(0, limit);
    }

    return rows.map(toPublic);
  },
});
