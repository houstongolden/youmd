import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireOwner } from "./lib/auth";
import { secureRandomString } from "./lib/secureToken";
import { hashKey } from "./apiKeys";
import { pageArgs, clampPageSize } from "./lib/pagination";
import type { Doc } from "./_generated/dataModel";

const RESOURCE_SCOPES = [
  "identity",
  "now",
  "projects",
  "sources",
  "memories",
  "preferences",
  "trust_rules",
  "stacks",
  "activity",
] as const;

const GRANT_SCOPES = [
  "identity:read",
  "identity:write",
  "now:read",
  "projects:read",
  "projects:write",
  "sources:read",
  "sources:write",
  "memories:read",
  "memories:write",
  "preferences:read",
  "preferences:write",
  "trust_rules:read",
  "trust_rules:write",
  "stacks:read",
  "stacks:write",
  "activity:read",
  "activity:write",
] as const;

const WRITE_POLICIES = ["read_only", "propose", "approved_write"] as const;
const TRUST_LEVELS = ["low", "medium", "high", "verified"] as const;
const APP_TYPES = ["first_party", "third_party", "local_agent", "mcp_client", "custom"] as const;

function isAllowed(value: string, allowed: readonly string[]): boolean {
  return allowed.includes(value);
}

function validateList(name: string, values: string[], allowed: readonly string[]) {
  const unknown = values.filter((value) => !isAllowed(value, allowed));
  if (unknown.length > 0) {
    throw new Error(`Unknown ${name}: ${unknown.join(", ")}`);
  }
}

function grantToken(): string {
  return `yg_${secureRandomString(40)}`;
}

function ttlToExpiresAt(ttl?: string): number | undefined {
  if (!ttl || ttl === "never") return undefined;
  const ttlMs: Record<string, number> = {
    "1h": 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    "90d": 90 * 24 * 60 * 60 * 1000,
  };
  const ms = ttlMs[ttl];
  if (!ms) throw new Error(`Invalid TTL: ${ttl}`);
  return Date.now() + ms;
}

function toGrantView(grant: Doc<"connectedAppGrants">) {
  return {
    id: grant._id,
    appSlug: grant.appSlug,
    appName: grant.appName,
    appType: grant.appType,
    scopes: grant.scopes,
    resourceScopes: grant.resourceScopes,
    writePolicy: grant.writePolicy,
    trustLevel: grant.trustLevel,
    expiresAt: grant.expiresAt ? new Date(grant.expiresAt).toISOString() : "never",
    revokedAt: grant.revokedAt ? new Date(grant.revokedAt).toISOString() : null,
    lastUsedAt: grant.lastUsedAt ? new Date(grant.lastUsedAt).toISOString() : null,
    createdAt: new Date(grant.createdAt).toISOString(),
    isExpired: grant.expiresAt ? grant.expiresAt < Date.now() : false,
    isActive: !grant.revokedAt && !(grant.expiresAt && grant.expiresAt < Date.now()),
    metadata: grant.metadata ?? null,
  };
}

export const createGrant = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    appSlug: v.string(),
    appName: v.string(),
    appType: v.optional(v.string()),
    scopes: v.array(v.string()),
    resourceScopes: v.array(v.string()),
    writePolicy: v.optional(v.string()),
    trustLevel: v.optional(v.string()),
    ttl: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("User not found");

    const appSlug = args.appSlug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64);
    if (!appSlug) throw new Error("appSlug is required");

    const appType = args.appType ?? "custom";
    const writePolicy = args.writePolicy ?? "propose";
    const trustLevel = args.trustLevel ?? "medium";
    validateList("grant scopes", args.scopes, GRANT_SCOPES);
    validateList("resource scopes", args.resourceScopes, RESOURCE_SCOPES);
    if (!isAllowed(appType, APP_TYPES)) throw new Error(`Unknown appType: ${appType}`);
    if (!isAllowed(writePolicy, WRITE_POLICIES)) throw new Error(`Unknown writePolicy: ${writePolicy}`);
    if (!isAllowed(trustLevel, TRUST_LEVELS)) throw new Error(`Unknown trustLevel: ${trustLevel}`);

    const token = grantToken();
    const tokenHash = await hashKey(token);
    const expiresAt = ttlToExpiresAt(args.ttl);

    const existing = await ctx.db
      .query("connectedAppGrants")
      .withIndex("by_userId_appSlug", (q) => q.eq("userId", user._id).eq("appSlug", appSlug))
      .collect();
    for (const grant of existing) {
      if (!grant.revokedAt) {
        await ctx.db.patch(grant._id, { revokedAt: Date.now(), updatedAt: Date.now() });
      }
    }

    const grantId = await ctx.db.insert("connectedAppGrants", {
      userId: user._id,
      appSlug,
      appName: args.appName.trim() || appSlug,
      appType,
      tokenHash,
      scopes: args.scopes,
      resourceScopes: args.resourceScopes,
      writePolicy,
      trustLevel,
      expiresAt,
      createdAt: Date.now(),
      metadata: args.metadata,
    });

    return {
      id: grantId,
      token,
      tokenPrefix: "yg_",
      appSlug,
      appName: args.appName.trim() || appSlug,
      scopes: args.scopes,
      resourceScopes: args.resourceScopes,
      writePolicy,
      trustLevel,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : "never",
    };
  },
});

export const listGrants = query({
  args: { clerkId: v.string(), _internalAuthToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) return [];

    const grants = await ctx.db
      .query("connectedAppGrants")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    return grants.map(toGrantView);
  },
});

export const listGrantsPage = query({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    ...pageArgs,
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) return { page: [], isDone: true, continueCursor: "" };

    const result = await ctx.db
      .query("connectedAppGrants")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .paginate({
        cursor: args.cursor ?? null,
        numItems: clampPageSize(args.numItems),
      });

    return { ...result, page: result.page.map(toGrantView) };
  },
});

export const revokeGrant = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    grantId: v.id("connectedAppGrants"),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("User not found");

    const grant = await ctx.db.get(args.grantId);
    if (!grant || grant.userId !== user._id) throw new Error("Grant not found");

    await ctx.db.patch(args.grantId, { revokedAt: Date.now(), updatedAt: Date.now() });
  },
});

export const getByTokenHash = query({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const grant = await ctx.db
      .query("connectedAppGrants")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", args.tokenHash))
      .first();

    if (!grant || grant.revokedAt || (grant.expiresAt && grant.expiresAt < Date.now())) {
      return null;
    }

    const user = await ctx.db.get(grant.userId);
    if (!user) return null;

    return {
      id: grant._id,
      userId: user.clerkId,
      userDbId: user._id,
      username: user.username,
      plan: user.plan,
      appSlug: grant.appSlug,
      appName: grant.appName,
      appType: grant.appType,
      scopes: grant.scopes,
      resourceScopes: grant.resourceScopes,
      writePolicy: grant.writePolicy,
      trustLevel: grant.trustLevel,
      expiresAt: grant.expiresAt ?? null,
    };
  },
});

export const updateLastUsed = internalMutation({
  args: { grantId: v.id("connectedAppGrants") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.grantId, {
      lastUsedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});
