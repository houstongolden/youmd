import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireOwner } from "./lib/auth";

async function loadOwner(
  ctx: QueryCtx | MutationCtx,
  clerkId: string,
  internalAuthToken?: string
): Promise<Doc<"users">> {
  await requireOwner(ctx, clerkId, internalAuthToken);
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
    .first();
  if (!user) throw new Error("User not found");
  return user;
}

export const listForUser = query({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Doc<"stackSources">[]> => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    return await ctx.db
      .query("stackSources")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const upsert = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    path: v.string(),
    remote: v.string(),
    label: v.optional(v.string()),
    kind: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ sourceId: Id<"stackSources">; created: boolean }> => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const now = Date.now();
    const cleanPath = args.path.trim().slice(0, 700);
    const cleanRemote = args.remote.trim().slice(0, 700);
    const existing = await ctx.db
      .query("stackSources")
      .withIndex("by_userId_path", (q) => q.eq("userId", user._id).eq("path", cleanPath))
      .first();

    const row = {
      userId: user._id,
      path: cleanPath,
      remote: cleanRemote,
      label: args.label?.trim().slice(0, 200),
      kind: args.kind?.trim().slice(0, 80),
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, row);
      return { sourceId: existing._id, created: false };
    }

    const sourceId = await ctx.db.insert("stackSources", {
      ...row,
      createdAt: now,
    });
    return { sourceId, created: true };
  },
});

export const remove = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    path: v.string(),
  },
  handler: async (ctx, args): Promise<{ removed: boolean }> => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const cleanPath = args.path.trim().slice(0, 700);
    const existing = await ctx.db
      .query("stackSources")
      .withIndex("by_userId_path", (q) => q.eq("userId", user._id).eq("path", cleanPath))
      .first();
    if (!existing) return { removed: false };
    await ctx.db.delete(existing._id);
    return { removed: true };
  },
});
