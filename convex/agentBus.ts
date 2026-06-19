import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireOwner } from "./lib/auth";
import { secureRandomString } from "./lib/secureToken";

const MAX_BODY_CHARS = 4_000;
const MAX_CHANNEL_CHARS = 80;
const MAX_KIND_CHARS = 40;
const MAX_AGENT_CHARS = 120;
const MAX_HOST_CHARS = 120;
const MAX_METADATA_DEPTH = 4;
const MAX_METADATA_ARRAY = 24;
const MAX_METADATA_KEYS = 40;

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

function cleanText(value: string | undefined, fallback: string, maxChars: number): string {
  const cleaned = (value ?? fallback)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || fallback).slice(0, maxChars);
}

export function redactSecretLikeText(value: string): string {
  return value
    .replace(/\bym_[A-Za-z0-9]{16,}\b/g, "[redacted-youmd-api-key]")
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[redacted-api-key]")
    .replace(/\bxox[abprs]-[A-Za-z0-9-]{16,}\b/g, "[redacted-token]")
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{16,}\b/g, "[redacted-github-token]")
    .replace(
      /\b([A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|PASS)[A-Z0-9_]*)\s*=\s*([^\s"'`]+)\b/gi,
      "$1=[redacted]",
    );
}

function sanitizeBody(value: string): string {
  return redactSecretLikeText(cleanText(value, "agent message", MAX_BODY_CHARS));
}

function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (depth > MAX_METADATA_DEPTH) return "[truncated]";
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return redactSecretLikeText(cleanText(value, "", 1_000));
  if (Array.isArray(value)) {
    return value.slice(0, MAX_METADATA_ARRAY).map((item) => sanitizeMetadata(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value).slice(0, MAX_METADATA_KEYS)) {
      out[cleanText(key, "key", 120)] = sanitizeMetadata(item, depth + 1);
    }
    return out;
  }
  return String(value).slice(0, 200);
}

function toPublicMessage(row: Doc<"realtimeAgentMessages">) {
  return {
    id: String(row._id),
    messageId: row.messageId,
    channel: row.channel,
    kind: row.kind,
    body: row.body,
    sourceHost: row.sourceHost ?? null,
    sourceAgent: row.sourceAgent,
    sourceRuntime: row.sourceRuntime ?? null,
    targetHost: row.targetHost ?? null,
    targetAgent: row.targetAgent ?? null,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt,
    secretValuesExposed: false,
  };
}

function brainActivityStatus(kind: string): "live" | "ok" | "warn" | "error" | "info" {
  if (kind === "error" || kind === "failed" || kind === "blocked") return "error";
  if (kind === "status" || kind === "running" || kind === "syncing") return "live";
  if (kind === "success" || kind === "ready" || kind === "synced") return "ok";
  if (kind === "warning" || kind === "warn" || kind === "pending") return "warn";
  return "info";
}

export const sendMessage = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    channel: v.optional(v.string()),
    kind: v.optional(v.string()),
    body: v.string(),
    sourceHost: v.optional(v.string()),
    sourceAgent: v.optional(v.string()),
    sourceRuntime: v.optional(v.string()),
    targetHost: v.optional(v.string()),
    targetAgent: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const now = Date.now();
    const messageId = `am_${secureRandomString(24)}`;
    const rowId = await ctx.db.insert("realtimeAgentMessages", {
      userId: user._id,
      messageId,
      channel: cleanText(args.channel, "machine-sync", MAX_CHANNEL_CHARS),
      kind: cleanText(args.kind, "message", MAX_KIND_CHARS),
      body: sanitizeBody(args.body),
      sourceHost: args.sourceHost ? cleanText(args.sourceHost, "", MAX_HOST_CHARS) : undefined,
      sourceAgent: cleanText(args.sourceAgent, "local-agent", MAX_AGENT_CHARS),
      sourceRuntime: args.sourceRuntime ? cleanText(args.sourceRuntime, "", MAX_AGENT_CHARS) : undefined,
      targetHost: args.targetHost ? cleanText(args.targetHost, "", MAX_HOST_CHARS) : undefined,
      targetAgent: args.targetAgent ? cleanText(args.targetAgent, "", MAX_AGENT_CHARS) : undefined,
      metadata: args.metadata === undefined ? undefined : sanitizeMetadata(args.metadata),
      createdAt: now,
    });
    const row = await ctx.db.get(rowId);
    if (!row) throw new Error("Agent message failed to save");
    await ctx.db.insert("brainActivities", {
      userId: user._id,
      activityId: `agent-bus:${messageId}`,
      source: "agent-bus",
      channel: row.channel,
      kind: row.kind,
      title: `${row.sourceAgent}${row.sourceHost ? ` @ ${row.sourceHost}` : ""}`,
      detail: row.body,
      status: brainActivityStatus(row.kind),
      sourceHost: row.sourceHost,
      sourceAgent: row.sourceAgent,
      sourceRuntime: row.sourceRuntime,
      metadata: row.metadata,
      occurredAt: row.createdAt,
      createdAt: now,
      updatedAt: now,
      secretValuesExposed: false,
    });
    return toPublicMessage(row);
  },
});

export const listMessages = query({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    channel: v.optional(v.string()),
    since: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const limit = Math.max(1, Math.min(100, Math.round(args.limit ?? 30)));
    const channel = args.channel ? cleanText(args.channel, "machine-sync", MAX_CHANNEL_CHARS) : null;
    const rows = channel
      ? await ctx.db
          .query("realtimeAgentMessages")
          .withIndex("by_userId_channel_createdAt", (q) => q.eq("userId", user._id).eq("channel", channel))
          .order("desc")
          .take(limit)
      : await ctx.db
          .query("realtimeAgentMessages")
          .withIndex("by_userId_createdAt", (q) => q.eq("userId", user._id))
          .order("desc")
          .take(limit);

    const since = Number.isFinite(args.since) ? args.since ?? 0 : 0;
    return rows
      .filter((row) => row.createdAt > since)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(toPublicMessage);
  },
});
