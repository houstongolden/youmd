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
const MAX_LINKS = 8;

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

function metadataRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function safeSlug(value: unknown, maxChars = 80): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxChars);
  return cleaned || undefined;
}

function safeEntityValue(value: unknown, maxChars = 120): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const cleaned = String(value)
    .trim()
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._:@#/-]+/g, "")
    .slice(0, maxChars);
  return cleaned || undefined;
}

function stringArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return value.split(/[,\s]+/).filter(Boolean);
  return [];
}

function firstSafeSlug(values: unknown[], maxChars = 80): string | undefined {
  for (const value of values) {
    const slug = safeSlug(value, maxChars);
    if (slug) return slug;
  }
  return undefined;
}

function uniqueSafe(values: Array<string | undefined>): string[] {
  const out: string[] = [];
  for (const value of values) {
    if (!value || out.includes(value)) continue;
    out.push(value);
    if (out.length >= MAX_LINKS) break;
  }
  return out;
}

function inferFromText(text: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const pattern = new RegExp(`(?:^|[\\s\\[({,;])${label}\\s*[:=#]\\s*([A-Za-z0-9._/-]{2,120})`, "i");
    const match = text.match(pattern);
    const inferred = safeSlug(match?.[1]);
    if (inferred) return inferred;
  }
  return undefined;
}

function inferEntityFromText(text: string): { entityType?: string; entityId?: string } {
  const task = text.match(/(?:^|[\s[({,;])task\s*[:=#]\s*([A-Za-z0-9._:@#/-]{2,120})/i);
  if (task?.[1]) return { entityType: "task", entityId: safeEntityValue(task[1]) };
  const goal = text.match(/(?:^|[\s[({,;])goal\s*[:=#]\s*([A-Za-z0-9._:@#/-]{2,120})/i);
  if (goal?.[1]) return { entityType: "goal", entityId: safeEntityValue(goal[1]) };
  const pr = text.match(/(?:^|[\s[({,;])(?:pr|pull-request)\s*[:=#]\s*#?([0-9]{1,10})/i);
  if (pr?.[1]) return { entityType: "pullRequest", entityId: `#${pr[1]}` };
  return {};
}

function coordinationContext(fields: {
  body: string;
  channel: string;
  kind: string;
  messageId: string;
  metadata?: unknown;
}) {
  const metadata = metadataRecord(fields.metadata);
  const projectSlug = firstSafeSlug([
    metadata?.projectSlug,
    metadata?.project,
    metadata?.repo,
    metadata?.repository,
    inferFromText(fields.body, ["project", "repo", "workspace"]),
  ]);
  const skillName = firstSafeSlug([
    metadata?.skillName,
    metadata?.skill,
    metadata?.skillSlug,
    inferFromText(fields.body, ["skill", "ystack", "youstack"]),
  ], 100);
  const inferredEntity = inferEntityFromText(fields.body);
  const entityType =
    safeSlug(metadata?.entityType, 60) ??
    safeSlug(metadata?.type, 60) ??
    inferredEntity.entityType ??
    (skillName ? "skill" : "agentMessage");
  const entityId =
    safeEntityValue(metadata?.entityId) ??
    safeEntityValue(metadata?.id) ??
    safeEntityValue(metadata?.taskId) ??
    inferredEntity.entityId ??
    skillName ??
    fields.messageId;
  const relatedProjects = uniqueSafe([
    projectSlug,
    ...stringArray(metadata?.projectSlugs ?? metadata?.projects).map((value) => safeSlug(value)),
  ]);
  const relatedSkills = uniqueSafe([
    skillName,
    ...stringArray(metadata?.skillNames ?? metadata?.skills).map((value) => safeSlug(value, 100)),
  ]);

  return {
    projectSlug,
    skillName,
    entityType,
    entityId,
    relatedProjects,
    relatedSkills,
    channel: fields.channel,
    kind: fields.kind,
    messageId: fields.messageId,
  };
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
    const coordination = coordinationContext({
      body: row.body,
      channel: row.channel,
      kind: row.kind,
      messageId,
      metadata: row.metadata,
    });
    await ctx.db.insert("brainActivities", {
      userId: user._id,
      activityId: `agent-bus:${messageId}`,
      source: "agent-bus",
      channel: row.channel,
      kind: row.kind,
      title: `${row.sourceAgent}${row.sourceHost ? ` @ ${row.sourceHost}` : ""}`,
      detail: row.body,
      status: brainActivityStatus(row.kind),
      projectSlug: coordination.projectSlug,
      entityType: coordination.entityType,
      entityId: coordination.entityId,
      sourceHost: row.sourceHost,
      sourceAgent: row.sourceAgent,
      sourceRuntime: row.sourceRuntime,
      metadata: {
        coordination,
        message: row.metadata,
        targetHost: row.targetHost,
        targetAgent: row.targetAgent,
        secretValuesExposed: false,
      },
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
