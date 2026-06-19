import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const ONE_HOUR_MS = 60 * 60 * 1000;

const PROVIDER_COST_CENTS: Record<string, number> = {
  native: 0,
  manual: 0,
  firecrawl: 5,
  "agent-browser": 25,
  apify: 15,
};

const PROVIDER_HOURLY_LIMITS: Record<string, number> = {
  native: 120,
  manual: 0,
  firecrawl: 30,
  "agent-browser": 6,
  apify: 20,
};

const MAX_FIELD_CHARS = 120;
const MAX_TITLE_CHARS = 180;
const MAX_DETAIL_CHARS = 800;

function cleanText(value: string | undefined, fallback: string, maxChars: number): string {
  const cleaned = (value ?? fallback)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || fallback).slice(0, maxChars);
}

function safeSourceUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return cleanText(value, "source", MAX_FIELD_CHARS);
  }
}

type SourceRunDecision = Record<string, unknown> & {
  allowed?: boolean;
  reason?: string;
  estimatedCostCents?: number;
  requiresApproval?: boolean;
  hourlyLimit?: number;
  remainingThisHour?: number;
};

function activityStatus(decision: SourceRunDecision): "live" | "ok" | "warn" | "error" | "info" {
  if (decision.allowed) return "live";
  if (decision.reason === "approval_required" || decision.reason === "rate_limited") return "warn";
  return "error";
}

async function recordSourceRunActivity(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    sourceId: Id<"sources">;
    title: string;
    detail: string;
    provider: string;
    decision: SourceRunDecision;
    occurredAt: number;
  },
) {
  const existing = await ctx.db
    .query("brainActivities")
    .withIndex("by_userId_activityId", (q) =>
      q.eq("userId", args.userId).eq("activityId", `source-crawl:${args.sourceId}`)
    )
    .first();
  const now = Date.now();
  const patch = {
    source: "source-crawl",
    channel: "sources",
    kind: args.decision.allowed === true ? "reserved" : "blocked",
    title: cleanText(args.title, "source crawl", MAX_TITLE_CHARS),
    detail: cleanText(args.detail, "source crawl decision", MAX_DETAIL_CHARS),
    status: activityStatus(args.decision),
    entityType: "source",
    entityId: String(args.sourceId),
    sourceAgent: "source-run-policy",
    metadata: {
      provider: args.provider,
      allowed: args.decision.allowed === true,
      reason: args.decision.reason,
      estimatedCostCents: args.decision.estimatedCostCents,
      requiresApproval: args.decision.requiresApproval,
      hourlyLimit: args.decision.hourlyLimit,
      remainingThisHour: args.decision.remainingThisHour,
    },
    occurredAt: args.occurredAt,
    updatedAt: now,
    secretValuesExposed: false,
  };

  if (existing) {
    await ctx.db.patch(existing._id, patch);
    return;
  }

  await ctx.db.insert("brainActivities", {
    userId: args.userId,
    activityId: `source-crawl:${args.sourceId}`,
    ...patch,
    createdAt: now,
  });
}

function estimateCostCents(provider: string): number {
  return PROVIDER_COST_CENTS[provider] ?? 0;
}

function hourlyLimit(provider: string): number {
  return PROVIDER_HOURLY_LIMITS[provider] ?? 30;
}

function runPolicy(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object") return {};
  const policy = (metadata as Record<string, unknown>).runPolicy;
  return policy && typeof policy === "object" ? (policy as Record<string, unknown>) : {};
}

function mergeRunDecision(
  metadata: unknown,
  decision: Record<string, unknown>
): Record<string, unknown> {
  const base = metadata && typeof metadata === "object" ? metadata as Record<string, unknown> : {};
  return {
    ...base,
    lastRunDecision: decision,
  };
}

export const reserveSourceRun = internalMutation({
  args: {
    sourceId: v.id("sources"),
    provider: v.string(),
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const source = await ctx.db.get(args.sourceId);
    if (!source) {
      return { allowed: false as const, reason: "source_not_found" };
    }

    const provider = args.provider || source.crawlerProvider || "native";
    const displayName = source.displayName || source.sourceType || "source";
    const sourceLabel = `${displayName} via ${provider}`;
    const sourceUrl = safeSourceUrl(source.sourceUrl);
    const estimatedCostCents = estimateCostCents(provider);
    const policy = runPolicy(source.metadata);
    const approvedUntil =
      typeof policy.approvedUntil === "number" ? policy.approvedUntil : 0;
    const maxEstimatedCostCents =
      typeof policy.maxEstimatedCostCents === "number"
        ? policy.maxEstimatedCostCents
        : estimatedCostCents;
    const requiresApproval = estimatedCostCents > 0;
    const approvalValid = !requiresApproval || approvedUntil > now;

    const decisionBase = {
      provider,
      estimatedCostCents,
      maxEstimatedCostCents,
      requiresApproval,
      approvedUntil: approvedUntil || null,
      decidedAt: now,
    };

    if (provider === "manual") {
      const decision = { ...decisionBase, allowed: false, reason: "manual_source" };
      await ctx.db.patch(source._id, {
        status: "failed",
        errorMessage: "Manual source has no crawler provider",
        failureCount: (source.failureCount ?? 0) + 1,
        metadata: mergeRunDecision(source.metadata, decision),
      });
      await recordSourceRunActivity(ctx, {
        userId: source.userId,
        sourceId: source._id,
        provider,
        decision,
        title: `source crawl blocked: ${sourceLabel}`,
        detail: `manual source has no crawler provider · ${sourceUrl}`,
        occurredAt: now,
      });
      return decision;
    }

    if (!approvalValid) {
      const decision = { ...decisionBase, allowed: false, reason: "approval_required" };
      await ctx.db.patch(source._id, {
        status: "failed",
        errorMessage: `${provider} refresh requires owner approval`,
        failureCount: (source.failureCount ?? 0) + 1,
        metadata: mergeRunDecision(source.metadata, decision),
      });
      await recordSourceRunActivity(ctx, {
        userId: source.userId,
        sourceId: source._id,
        provider,
        decision,
        title: `source crawl needs approval: ${sourceLabel}`,
        detail: `${provider} refresh requires owner approval · ${sourceUrl}`,
        occurredAt: now,
      });
      return decision;
    }

    if (estimatedCostCents > maxEstimatedCostCents) {
      const decision = { ...decisionBase, allowed: false, reason: "cost_limit_exceeded" };
      await ctx.db.patch(source._id, {
        status: "failed",
        errorMessage: `${provider} estimate ${estimatedCostCents}c exceeds source limit ${maxEstimatedCostCents}c`,
        failureCount: (source.failureCount ?? 0) + 1,
        metadata: mergeRunDecision(source.metadata, decision),
      });
      await recordSourceRunActivity(ctx, {
        userId: source.userId,
        sourceId: source._id,
        provider,
        decision,
        title: `source crawl blocked: ${sourceLabel}`,
        detail: `${provider} estimate ${estimatedCostCents}c exceeds limit ${maxEstimatedCostCents}c · ${sourceUrl}`,
        occurredAt: now,
      });
      return decision;
    }

    const limit = hourlyLimit(provider);
    if (limit <= 0) {
      const decision = { ...decisionBase, allowed: false, reason: "provider_disabled" };
      await ctx.db.patch(source._id, {
        status: "failed",
        errorMessage: `${provider} provider is disabled for automatic runs`,
        failureCount: (source.failureCount ?? 0) + 1,
        metadata: mergeRunDecision(source.metadata, decision),
      });
      await recordSourceRunActivity(ctx, {
        userId: source.userId,
        sourceId: source._id,
        provider,
        decision,
        title: `source crawl disabled: ${sourceLabel}`,
        detail: `${provider} provider is disabled for automatic runs · ${sourceUrl}`,
        occurredAt: now,
      });
      return decision;
    }

    const bucket = `source-crawl:${provider}:${source.userId}`;
    const since = now - ONE_HOUR_MS;
    const recent = await ctx.db
      .query("rateLimits")
      .withIndex("by_bucket_ts", (q) => q.eq("bucket", bucket).gt("timestamp", since))
      .collect();

    if (recent.length >= limit) {
      const decision = { ...decisionBase, allowed: false, reason: "rate_limited", hourlyLimit: limit };
      await ctx.db.patch(source._id, {
        status: "failed",
        errorMessage: `${provider} hourly source-refresh limit reached`,
        failureCount: (source.failureCount ?? 0) + 1,
        metadata: mergeRunDecision(source.metadata, decision),
      });
      await recordSourceRunActivity(ctx, {
        userId: source.userId,
        sourceId: source._id,
        provider,
        decision,
        title: `source crawl rate limited: ${sourceLabel}`,
        detail: `${provider} hourly source-refresh limit reached · ${sourceUrl}`,
        occurredAt: now,
      });
      return decision;
    }

    await ctx.db.insert("rateLimits", { bucket, timestamp: now });
    const decision = {
      ...decisionBase,
      allowed: true,
      reason: "allowed",
      hourlyLimit: limit,
      remainingThisHour: limit - (recent.length + 1),
    };
    await ctx.db.patch(source._id, {
      metadata: mergeRunDecision(source.metadata, decision),
    });
    await recordSourceRunActivity(ctx, {
      userId: source.userId,
      sourceId: source._id,
      provider,
      decision,
      title: `source crawl reserved: ${sourceLabel}`,
      detail: `${provider} refresh reserved · ${sourceUrl}`,
      occurredAt: now,
    });
    return decision;
  },
});
