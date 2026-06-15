import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

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
    return decision;
  },
});
