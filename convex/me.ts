import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  compileYouJson,
  compileYouMd,
  compileManifest,
  type ProfileData,
} from "./lib/compile";
import { computeContentHash } from "./lib/hash";

/**
 * Authenticated user endpoints (/me/*).
 * These require a valid Clerk session.
 */

export const getMyProfile = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) return null;

    const bundles = await ctx.db
      .query("bundles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const latest = bundles.sort((a, b) => b.version - a.version)[0];
    const published = bundles
      .filter((b) => b.isPublished)
      .sort((a, b) => b.version - a.version)[0];

    return {
      user,
      latestBundle: latest ?? null,
      publishedBundle: published ?? null,
      bundleCount: bundles.length,
    };
  },
});

export const saveBundleFromForm = mutation({
  args: {
    clerkId: v.string(),
    profileData: v.any(), // ProfileData shape
    parentHash: v.optional(v.string()), // contentHash of the parent bundle (for conflict detection)
    source: v.optional(v.string()),     // "web-shell" | "cli" | "api" | "agent:<name>"
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) throw new Error("User not found");

    const raw = args.profileData as Record<string, unknown>;

    // CLI uploads send pre-compiled bundles with _rawBundle: true
    // Use them directly instead of recompiling (which would shred the data)
    let youJson: Record<string, unknown>;
    let youMd: string;
    let manifest: Record<string, unknown>;

    if (raw._rawBundle) {
      youJson = (raw.youJson as Record<string, unknown>) ?? {};
      youMd = (raw.youMd as string) ?? "";
      manifest = (raw.manifest as Record<string, unknown>) ?? {};
    } else {
      const data = raw as unknown as ProfileData;
      data.username = user.username;
      youJson = compileYouJson(data);
      youMd = compileYouMd(data);
      manifest = compileManifest(data);
    }

    // Get next version
    const existing = await ctx.db
      .query("bundles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const maxVersion = existing.reduce(
      (max, b) => Math.max(max, b.version),
      0
    );

    // Compute content hash for version control
    const contentHash = await computeContentHash(youJson, youMd as string);

    // Determine parent hash (ancestry tracking)
    const latestBundle = existing.sort((a, b) => b.version - a.version)[0];
    const autoParentHash = args.parentHash || latestBundle?.contentHash || undefined;

    // Push guard: if client sends parentHash, verify it matches current head
    if (args.parentHash && latestBundle?.contentHash && args.parentHash !== latestBundle.contentHash) {
      throw new Error(
        `ANCESTOR_MISMATCH:remote has changed since your last pull. ` +
        `Remote head: ${latestBundle.contentHash.slice(0, 12)} (v${latestBundle.version}). ` +
        `Your parent: ${args.parentHash.slice(0, 12)}. Run 'youmd pull' first.`
      );
    }

    const bundleId = await ctx.db.insert("bundles", {
      userId: user._id,
      version: maxVersion + 1,
      schemaVersion: "you-md/v1",
      manifest,
      youJson,
      youMd,
      isPublished: false,
      createdAt: Date.now(),
      contentHash,
      parentHash: autoParentHash,
      source: args.source || "api",
    });

    // Also sync youJson/youMd to the profiles table so public profile stays current
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .first();

    if (profile) {
      const profileUpdates: Record<string, unknown> = {
        youJson,
        youMd,
        updatedAt: Date.now(),
      };
      // Sync identity fields to profiles table
      const identity = youJson?.identity as Record<string, unknown> | undefined;
      if (identity?.name) profileUpdates.name = identity.name;
      if (identity?.tagline) profileUpdates.tagline = identity.tagline;
      if (identity?.location) profileUpdates.location = identity.location;
      if (identity?.bio) profileUpdates.bio = identity.bio;
      if (youJson?.links) profileUpdates.links = youJson.links;
      if (youJson?.now) {
        const now = youJson.now as Record<string, unknown>;
        if (now?.focus) profileUpdates.now = now.focus;
      }
      if (youJson?.projects) profileUpdates.projects = youJson.projects;
      if (youJson?.values) profileUpdates.values = youJson.values;
      if (youJson?.preferences) profileUpdates.preferences = youJson.preferences;

      await ctx.db.patch(profile._id, profileUpdates);
    }

    return { bundleId, version: maxVersion + 1, contentHash };
  },
});

/**
 * Save a patched youJson directly (used by the files pane editor).
 * Recompiles youMd and manifest from the youJson, then saves as a new bundle version.
 */
export const saveYouJsonDirect = mutation({
  args: {
    clerkId: v.string(),
    youJson: v.any(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) throw new Error("User not found");

    const yj = args.youJson;

    // Reconstruct ProfileData from youJson to recompile youMd and manifest
    const data: ProfileData = {
      name: yj?.identity?.name ?? "",
      username: user.username,
      tagline: yj?.identity?.tagline,
      location: yj?.identity?.location,
      bio: yj?.identity?.bio,
      now: yj?.now?.focus,
      projects: yj?.projects,
      values: yj?.values,
      links: yj?.links,
      preferences: yj?.preferences,
      analysis: {
        topics: yj?.analysis?.topics,
        voice_summary: yj?.voice?.overall ?? yj?.analysis?.voice_summary,
        credibility_signals: yj?.analysis?.credibility_signals,
        voice_linkedin: yj?.voice?.platforms?.linkedin,
        voice_x: yj?.voice?.platforms?.x,
        voice_blog: yj?.voice?.platforms?.blog,
      },
      socialImages: yj?.social_images,
    };

    const youMd = compileYouMd(data);
    const manifest = compileManifest(data);

    // Compute content hash for version control
    const contentHash = await computeContentHash(args.youJson, youMd);

    // Get next version
    const existing = await ctx.db
      .query("bundles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const maxVersion = existing.reduce(
      (max, b) => Math.max(max, b.version),
      0
    );

    // Auto-set parentHash from latest bundle
    const latestBundle = existing.sort((a, b) => b.version - a.version)[0];
    const parentHash = latestBundle?.contentHash ?? undefined;

    const bundleId = await ctx.db.insert("bundles", {
      userId: user._id,
      version: maxVersion + 1,
      schemaVersion: "you-md/v1",
      manifest,
      youJson: args.youJson,
      youMd,
      isPublished: false,
      createdAt: Date.now(),
      contentHash,
      parentHash,
    });

    // Sync to profiles table
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .first();

    if (profile) {
      const profileUpdates: Record<string, unknown> = {
        youJson: args.youJson,
        youMd,
        updatedAt: Date.now(),
      };
      const identity = yj?.identity;
      if (identity?.name) profileUpdates.name = identity.name;
      if (identity?.tagline) profileUpdates.tagline = identity.tagline;
      if (identity?.location) profileUpdates.location = identity.location;
      if (identity?.bio) profileUpdates.bio = identity.bio;
      if (yj?.links) profileUpdates.links = yj.links;
      if (yj?.now?.focus) profileUpdates.now = yj.now.focus;
      if (yj?.projects) profileUpdates.projects = yj.projects;
      if (yj?.values) profileUpdates.values = yj.values;
      if (yj?.preferences) profileUpdates.preferences = yj.preferences;

      await ctx.db.patch(profile._id, profileUpdates);
    }

    return { bundleId, version: maxVersion + 1, contentHash };
  },
});

export const publishLatest = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) throw new Error("User not found");

    const bundles = await ctx.db
      .query("bundles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const latest = bundles.sort((a, b) => b.version - a.version)[0];
    if (!latest) throw new Error("No bundle to publish");

    // Unpublish all
    for (const b of bundles) {
      if (b.isPublished) {
        await ctx.db.patch(b._id, { isPublished: false });
      }
    }

    // Publish latest
    await ctx.db.patch(latest._id, {
      isPublished: true,
      publishedAt: Date.now(),
    });

    // Sync published bundle's youJson/youMd to profiles table so public page is current
    let profile = await ctx.db
      .query("profiles")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .first();

    // Fallback: look up by username if profile wasn't claimed yet
    if (!profile) {
      profile = await ctx.db
        .query("profiles")
        .withIndex("by_username", (q) => q.eq("username", user.username))
        .first();
      // Auto-claim the profile if found
      if (profile && !profile.ownerId) {
        await ctx.db.patch(profile._id, { ownerId: user._id, isClaimed: true, claimedAt: Date.now() });
      }
    }

    if (profile && latest.youJson) {
      const yj = latest.youJson as Record<string, unknown>;
      const profileUpdates: Record<string, unknown> = {
        youJson: yj,
        youMd: latest.youMd,
        updatedAt: Date.now(),
      };

      // Handle web-compiled format (identity, projects, etc.)
      const identity = yj.identity as Record<string, unknown> | undefined;
      if (identity?.name) profileUpdates.name = identity.name;
      if (identity?.tagline) profileUpdates.tagline = identity.tagline;
      if (identity?.location) profileUpdates.location = identity.location;
      if (identity?.bio) profileUpdates.bio = identity.bio;
      if (yj.links) profileUpdates.links = yj.links;
      if (yj.now) {
        const now = yj.now as Record<string, unknown>;
        if (now?.focus) profileUpdates.now = now.focus;
      }
      if (yj.projects) profileUpdates.projects = yj.projects;
      if (yj.values) profileUpdates.values = yj.values;
      if (yj.preferences) profileUpdates.preferences = yj.preferences;

      // Handle CLI-compiled format (profile: [{slug, title, content}])
      if (yj.profile && Array.isArray(yj.profile)) {
        const sections = yj.profile as { slug: string; title: string; content: string }[];
        const about = sections.find(s => s.slug === "about");
        if (about?.content) {
          // Extract name from first heading or title
          const nameMatch = about.content.match(/^#\s+(.+)/m);
          if (nameMatch) profileUpdates.name = nameMatch[1].trim();
          // Use first paragraph as tagline
          const lines = about.content.split("\n").filter(l => l.trim() && !l.startsWith("#") && !l.startsWith("---"));
          if (lines[0]) profileUpdates.tagline = lines[0].trim();
          profileUpdates.bio = { short: lines[0]?.trim() || "", medium: lines.slice(0, 2).join(" ").trim(), long: about.content };
        }
      }

      await ctx.db.patch(profile._id, profileUpdates);
    }

    return {
      version: latest.version,
      username: user.username,
    };
  },
});

// Source management
export const addSource = mutation({
  args: {
    clerkId: v.string(),
    sourceType: v.string(),
    sourceUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) throw new Error("User not found");

    // Check for existing source of same type
    const existing = await ctx.db
      .query("sources")
      .withIndex("by_userId_type", (q) =>
        q.eq("userId", user._id).eq("sourceType", args.sourceType)
      )
      .first();

    if (existing) {
      // Update existing source
      await ctx.db.patch(existing._id, {
        sourceUrl: args.sourceUrl,
        status: "pending",
      });
      return existing._id;
    }

    // Create new source
    const sourceId = await ctx.db.insert("sources", {
      userId: user._id,
      sourceType: args.sourceType,
      sourceUrl: args.sourceUrl,
      status: "pending",
    });

    return sourceId;
  },
});

export const getSources = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) return [];

    return await ctx.db
      .query("sources")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
  },
});

// Analytics
export const getAnalytics = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) return null;

    const views = await ctx.db
      .query("profileViews")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const totalViews = views.length;
    const agentReads = views.filter((v) => v.isAgentRead).length;
    const webViews = totalViews - agentReads;
    const contextLinkViews = views.filter((v) => v.isContextLink).length;

    // Last 7 days
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentViews = views.filter((v) => v.viewedAt > weekAgo);

    // Daily breakdown for last 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentAllViews = views.filter((v) => v.viewedAt > thirtyDaysAgo);

    const dailyMap: Record<string, { total: number; agents: number; web: number }> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = { total: 0, agents: 0, web: 0 };
    }
    for (const view of recentAllViews) {
      const key = new Date(view.viewedAt).toISOString().slice(0, 10);
      if (dailyMap[key]) {
        dailyMap[key].total++;
        if (view.isAgentRead) {
          dailyMap[key].agents++;
        } else {
          dailyMap[key].web++;
        }
      }
    }
    const dailyViews = Object.entries(dailyMap)
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Top referrers
    const referrerMap: Record<string, number> = {};
    for (const view of views) {
      if (view.referrer) {
        try {
          const host = new URL(view.referrer).hostname;
          referrerMap[host] = (referrerMap[host] || 0) + 1;
        } catch {
          referrerMap[view.referrer] = (referrerMap[view.referrer] || 0) + 1;
        }
      }
    }
    const topReferrers = Object.entries(referrerMap)
      .map(([referrer, count]) => ({ referrer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalViews,
      agentReads,
      webViews,
      last7Days: recentViews.length,
      dailyViews,
      topReferrers,
      contextLinkViews,
    };
  },
});
