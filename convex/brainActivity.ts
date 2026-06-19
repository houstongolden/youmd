import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireOwner } from "./lib/auth";
import { secureRandomString } from "./lib/secureToken";

const MAX_TITLE_CHARS = 180;
const MAX_DETAIL_CHARS = 2_000;
const MAX_FIELD_CHARS = 120;
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

function redactSecretLikeText(value: string): string {
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

function sanitizeText(value: string | undefined, fallback: string, maxChars: number): string {
  return redactSecretLikeText(cleanText(value, fallback, maxChars));
}

function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (depth > MAX_METADATA_DEPTH) return "[truncated]";
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return sanitizeText(value, "", 1_000);
  if (Array.isArray(value)) {
    return value.slice(0, MAX_METADATA_ARRAY).map((item) => sanitizeMetadata(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value).slice(0, MAX_METADATA_KEYS)) {
      out[cleanText(key, "key", MAX_FIELD_CHARS)] = sanitizeMetadata(item, depth + 1);
    }
    return out;
  }
  return String(value).slice(0, 200);
}

function normalizeStatus(value: string | undefined): "live" | "ok" | "warn" | "error" | "info" {
  if (value === "live" || value === "ok" || value === "warn" || value === "error" || value === "info") {
    return value;
  }
  if (value === "ready" || value === "success" || value === "synced" || value === "loaded") return "ok";
  if (value === "failed" || value === "blocked" || value === "missing") return "error";
  if (value === "running" || value === "syncing") return "live";
  if (value === "draft" || value === "pending") return "warn";
  return "info";
}

function toPublicActivity(row: Doc<"brainActivities">) {
  return {
    id: String(row._id),
    activityId: row.activityId,
    source: row.source,
    channel: row.channel ?? null,
    kind: row.kind,
    title: row.title,
    detail: row.detail ?? null,
    status: normalizeStatus(row.status),
    projectSlug: row.projectSlug ?? null,
    entityType: row.entityType ?? null,
    entityId: row.entityId ?? null,
    sourceHost: row.sourceHost ?? null,
    sourceAgent: row.sourceAgent ?? null,
    sourceRuntime: row.sourceRuntime ?? null,
    metadata: row.metadata ?? null,
    occurredAt: row.occurredAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    secretValuesExposed: false,
  };
}

export const recordActivity = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    activityId: v.optional(v.string()),
    source: v.string(),
    channel: v.optional(v.string()),
    kind: v.optional(v.string()),
    title: v.string(),
    detail: v.optional(v.string()),
    status: v.optional(v.string()),
    projectSlug: v.optional(v.string()),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    sourceHost: v.optional(v.string()),
    sourceAgent: v.optional(v.string()),
    sourceRuntime: v.optional(v.string()),
    metadata: v.optional(v.any()),
    occurredAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const now = Date.now();
    const activityId = args.activityId ? cleanText(args.activityId, "", MAX_FIELD_CHARS) : `ba_${secureRandomString(24)}`;
    const existing = await ctx.db
      .query("brainActivities")
      .withIndex("by_userId_activityId", (q) => q.eq("userId", user._id).eq("activityId", activityId))
      .first();
    const patch = {
      source: cleanText(args.source, "manual", MAX_FIELD_CHARS),
      channel: args.channel ? cleanText(args.channel, "", MAX_FIELD_CHARS) : undefined,
      kind: cleanText(args.kind, "event", MAX_FIELD_CHARS),
      title: sanitizeText(args.title, "brain activity", MAX_TITLE_CHARS),
      detail: args.detail ? sanitizeText(args.detail, "", MAX_DETAIL_CHARS) : undefined,
      status: normalizeStatus(args.status ?? args.kind),
      projectSlug: args.projectSlug ? cleanText(args.projectSlug, "", MAX_FIELD_CHARS) : undefined,
      entityType: args.entityType ? cleanText(args.entityType, "", MAX_FIELD_CHARS) : undefined,
      entityId: args.entityId ? cleanText(args.entityId, "", MAX_FIELD_CHARS) : undefined,
      sourceHost: args.sourceHost ? cleanText(args.sourceHost, "", MAX_FIELD_CHARS) : undefined,
      sourceAgent: args.sourceAgent ? cleanText(args.sourceAgent, "", MAX_FIELD_CHARS) : undefined,
      sourceRuntime: args.sourceRuntime ? cleanText(args.sourceRuntime, "", MAX_FIELD_CHARS) : undefined,
      metadata: args.metadata === undefined ? undefined : sanitizeMetadata(args.metadata),
      occurredAt: args.occurredAt ?? now,
      updatedAt: now,
      secretValuesExposed: false,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      const row = await ctx.db.get(existing._id);
      if (!row) throw new Error("Brain activity failed to update");
      return toPublicActivity(row);
    }

    const id = await ctx.db.insert("brainActivities", {
      userId: user._id,
      activityId,
      ...patch,
      createdAt: now,
    });
    const row = await ctx.db.get(id);
    if (!row) throw new Error("Brain activity failed to save");
    return toPublicActivity(row);
  },
});

export const listRecent = query({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    source: v.optional(v.string()),
    projectSlug: v.optional(v.string()),
    since: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const limit = Math.max(1, Math.min(120, Math.round(args.limit ?? 60)));
    const since = Number.isFinite(args.since) ? args.since ?? 0 : 0;
    const source = args.source ? cleanText(args.source, "", MAX_FIELD_CHARS) : null;
    const projectSlug = args.projectSlug ? cleanText(args.projectSlug, "", MAX_FIELD_CHARS) : null;

    const rows = projectSlug
      ? await ctx.db
          .query("brainActivities")
          .withIndex("by_userId_project_occurredAt", (q) => q.eq("userId", user._id).eq("projectSlug", projectSlug))
          .order("desc")
          .take(limit)
      : source
        ? await ctx.db
            .query("brainActivities")
            .withIndex("by_userId_source_occurredAt", (q) => q.eq("userId", user._id).eq("source", source))
            .order("desc")
            .take(limit)
        : await ctx.db
            .query("brainActivities")
            .withIndex("by_userId_occurredAt", (q) => q.eq("userId", user._id))
            .order("desc")
            .take(limit);

    return rows
      .filter((row) => row.occurredAt > since)
      .sort((a, b) => a.occurredAt - b.occurredAt)
      .map(toPublicActivity);
  },
});
