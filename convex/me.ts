import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import {
  compileYouJson,
  compileYouMd,
  compileManifest,
  type ProfileData,
} from "./lib/compile";
import { computeContentHash } from "./lib/hash";
import { requireOwner } from "./lib/auth";

/**
 * Authenticated user endpoints (/me/*).
 * These require a valid Clerk session.
 */

/**
 * Validate profile data before save to catch common data-quality
 * mistakes (e.g. agents pasting markdown into string fields).
 */
function validateProfileData(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check tone field doesn't start with markdown heading
  const tone = data?.preferences?.agent?.tone;
  if (tone && typeof tone === "string" && tone.trim().startsWith("#")) {
    errors.push(
      `preferences.agent.tone cannot start with '#' (got: "${tone.slice(0, 50)}")`
    );
  }

  // Check project names don't start with #
  if (Array.isArray(data?.projects)) {
    data.projects.forEach((p: any, i: number) => {
      const name = p?.name || p?.title;
      if (name && typeof name === "string" && name.trim().startsWith("#")) {
        errors.push(
          `projects[${i}].name cannot start with '#' (got: "${name.slice(0, 50)}")`
        );
      }
    });
  }

  // Auto-clean: trim whitespace from string fields
  // (this is mutation, but acceptable for data hygiene)

  return { valid: errors.length === 0, errors };
}

export const getMyProfile = query({
  args: { clerkId: v.string(), _internalAuthToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

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
    _internalAuthToken: v.optional(v.string()),
    profileData: v.any(), // ProfileData shape
    parentHash: v.optional(v.string()), // contentHash of the parent bundle (for conflict detection)
    source: v.optional(v.string()),     // "web-shell" | "cli" | "api" | "agent:<name>"
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

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

    // Validate compiled youJson before saving (data quality guard).
    // Catches agents that paste markdown into plain string fields.
    const validation = validateProfileData(youJson);
    if (!validation.valid) {
      throw new Error(
        `VALIDATION_FAILED: ${validation.errors.join("; ")}`
      );
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
    _internalAuthToken: v.optional(v.string()),
    youJson: v.any(),
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

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

/**
 * Create a user-defined custom directory inside the bundle.
 *
 * Custom directories are stored in youJson.custom_files as an array of
 * { path, content, isPublic } entries. Each entry is one virtual file.
 * A new directory is seeded with a single agent.md placeholder so it shows
 * up in the file tree (empty directories don't render).
 *
 * isPublic === true → file path is "profile/<dirName>/agent.md" (publicly visible)
 * isPublic === false (default) → file path is "<dirName>/agent.md", which the
 * FilesPane tree builder routes under the synthetic private/ container.
 */
export const createCustomDirectory = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    dirName: v.string(),
    isPublic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) throw new Error("User not found");

    // Validate directory name: lowercase alphanumeric + hyphens, max 30 chars
    const dirName = args.dirName.trim().toLowerCase();
    if (!dirName) throw new Error("Directory name required");
    if (dirName.length > 30) throw new Error("Directory name max 30 chars");
    if (!/^[a-z0-9-]+$/.test(dirName)) {
      throw new Error("Directory name: lowercase alphanumeric + hyphens only");
    }

    // Reserved directory names that conflict with the standard layout
    const RESERVED = new Set([
      "profile", "preferences", "voice", "directives", "sources",
      "projects", "skills", "private", "memory", "sessions", "custom",
    ]);
    if (RESERVED.has(dirName)) {
      throw new Error(`'${dirName}' is a reserved directory name`);
    }

    // Get latest bundle to mutate its youJson
    const existing = await ctx.db
      .query("bundles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const latestBundle = existing.sort((a, b) => b.version - a.version)[0];
    if (!latestBundle) {
      throw new Error("No bundle exists yet — talk to the agent first");
    }

    const isPublic = args.isPublic === true;
    const baseDir = isPublic ? `profile/${dirName}` : dirName;
    const filePath = `${baseDir}/agent.md`;

    // Clone youJson and add custom_files entry
    const yj = JSON.parse(JSON.stringify(latestBundle.youJson)) as Record<string, unknown>;
    const customFiles = (Array.isArray(yj.custom_files) ? yj.custom_files : []) as Array<{
      path: string;
      content: string;
      isPublic?: boolean;
    }>;

    // Reject if a custom file with the same dir already exists
    const dirExists = customFiles.some((f) => f && typeof f.path === "string" && f.path.startsWith(`${baseDir}/`));
    if (dirExists) {
      throw new Error(`Directory '${dirName}' already exists`);
    }

    const placeholder = `---\ntitle: ${dirName}\n---\n\n# ${dirName}\n\nCustom directory created by user. Add your files here.\n`;

    customFiles.push({ path: filePath, content: placeholder, isPublic });
    yj.custom_files = customFiles;

    // Recompile youMd via existing pipeline
    const data: ProfileData = {
      name: (yj?.identity as Record<string, unknown> | undefined)?.name as string ?? "",
      username: user.username,
      tagline: (yj?.identity as Record<string, unknown> | undefined)?.tagline as string | undefined,
      location: (yj?.identity as Record<string, unknown> | undefined)?.location as string | undefined,
      bio: (yj?.identity as Record<string, unknown> | undefined)?.bio as ProfileData["bio"],
      now: ((yj?.now as Record<string, unknown> | undefined)?.focus as string[] | undefined),
      projects: yj?.projects as ProfileData["projects"],
      values: yj?.values as string[] | undefined,
      links: yj?.links as Record<string, string> | undefined,
      preferences: yj?.preferences as ProfileData["preferences"],
    };

    const youMd = compileYouMd(data);
    const manifest = compileManifest(data);
    const contentHash = await computeContentHash(yj, youMd);

    const maxVersion = existing.reduce((max, b) => Math.max(max, b.version), 0);

    const bundleId = await ctx.db.insert("bundles", {
      userId: user._id,
      version: maxVersion + 1,
      schemaVersion: "you-md/v1",
      manifest,
      youJson: yj,
      youMd,
      isPublished: false,
      createdAt: Date.now(),
      contentHash,
      parentHash: latestBundle.contentHash ?? undefined,
      source: "web-shell",
    });

    return {
      bundleId,
      version: maxVersion + 1,
      dirName,
      filePath,
      isPublic,
    };
  },
});

export const publishLatest = mutation({
  args: { clerkId: v.string(), _internalAuthToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

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
    _internalAuthToken: v.optional(v.string()),
    sourceType: v.string(),
    sourceUrl: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

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
  args: { clerkId: v.string(), _internalAuthToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

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
  args: { clerkId: v.string(), _internalAuthToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

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

/**
 * Cycle 57: incident-response panic button.
 *
 * Bulk-revokes EVERY token type the authenticated user owns:
 *   - apiKeys (CLI/MCP/3rd-party) → sets revokedAt = now
 *   - accessTokens (private context tokens, scoped to user's profiles) → sets isRevoked = true
 *   - contextLinks (share links) → sets revokedAt = now
 *
 * Already-revoked rows are skipped (idempotent).
 *
 * Use case: user lost a laptop, suspects credential compromise, or just
 * wants to "log out everything" before handing the keys to a stranger.
 *
 * Does NOT delete the user record or any data — only revokes auth tokens.
 * The user can still sign back in via Clerk and create fresh tokens.
 *
 * Logs `eventType: "panic_revoke_all"` to securityLogs with the per-table
 * revoke counts.
 *
 * Wired to a button in `src/components/panes/SettingsPane.tsx`.
 */
export const revokeAllSessions = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("not authenticated");

    const now = Date.now();
    const counts: Record<string, number> = {
      apiKeys: 0,
      accessTokens: 0,
      contextLinks: 0,
    };

    // 1. apiKeys (by_userId)
    const apiKeys = await ctx.db
      .query("apiKeys")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    for (const k of apiKeys) {
      if (!k.revokedAt) {
        await ctx.db.patch(k._id, { revokedAt: now });
        counts.apiKeys++;
      }
    }

    // 2. contextLinks (by_userId)
    const links = await ctx.db
      .query("contextLinks")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    for (const l of links) {
      if (!l.revokedAt) {
        await ctx.db.patch(l._id, { revokedAt: now });
        counts.contextLinks++;
      }
    }

    // 3. accessTokens — these are scoped by profileId, so look up the user's profiles first
    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .collect();
    for (const p of profiles) {
      const tokens = await ctx.db
        .query("accessTokens")
        .withIndex("by_profileId", (q) => q.eq("profileId", p._id))
        .collect();
      for (const t of tokens) {
        if (!t.isRevoked) {
          await ctx.db.patch(t._id, { isRevoked: true });
          counts.accessTokens++;
        }
      }
    }

    // Audit log
    await ctx.db.insert("securityLogs", {
      eventType: "panic_revoke_all",
      userId: user._id,
      details: { counts, totalRevoked: counts.apiKeys + counts.accessTokens + counts.contextLinks },
      createdAt: now,
    });

    return { success: true, counts, totalRevoked: counts.apiKeys + counts.accessTokens + counts.contextLinks };
  },
});

/**
 * Internal mutation — scaffold project subdirectory files for a user by username.
 * Run via: npx convex run me:scaffoldProjectsForUser --username houstongolden
 * Idempotent: merges into existing bundle rather than overwriting.
 */
export const scaffoldProjectsForUser = internalMutation({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .first();
    if (!user) throw new Error(`User not found: ${args.username}`);

    const latestBundle = await ctx.db
      .query("bundles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()
      .then((bundles) => bundles.sort((a, b) => b.version - a.version)[0]);

    const existingYouJson = (latestBundle?.youJson as Record<string, unknown>) ?? {};

    // Project scaffolding: 5 real projects (skip the empty one)
    const projectFiles: Record<string, string> = {
      "projects/youmd/README.md": `---
title: "You.md — Project Overview"
---

# You.md

**Status:** Active development
**Role:** Founder & sole builder
**Stack:** Next.js, Convex, Clerk, TypeScript, Tailwind, Claude/OpenRouter, Vercel

## What It Is

The identity context protocol for the agent internet — an MCP where the context is you. A structured, portable identity file that gives every AI agent context about who Houston is, so they don't start from scratch.

## Current Focus

- Web shell agent reliability (tool_use execution, no hallucination)
- CLI maturity (v0.6.0 with 24+ commands)
- MCP server (JSON-RPC 2.0, Claude/Cursor integration)
- Skill system (6 bundled skills, identity interpolation)
- Production at you.md

## Key Links

- Production: https://you.md
- GitHub: https://github.com/houstongolden/youmd
- npm: youmd (CLI)
`,
      "projects/youmd/context.md": `---
title: "You.md — Agent Context"
---

# Agent Context: You.md

When working on this project, here is what matters:

## Architecture

- **Frontend**: Next.js 16+ App Router, deployed on Vercel (auto-deploy on push)
- **Backend**: Convex (kindly-cassowary-600 in prod, uncommon-chicken-142 in dev)
- **Auth**: first-party passwordless web auth + scoped API keys for CLI/agents
- **LLM**: Anthropic Claude Sonnet 4.6 (primary) → OpenRouter (fallback)
- **CLI**: npm package "youmd", v0.6.0, 24+ commands

## Critical Rules

- Always deploy BOTH Vercel (git push) AND Convex (npx convex deploy) when changing convex/ files
- Clean stale .js files before local Convex deploy: find convex -name "*.js" ! -path "convex/_generated/*" -delete
- Never bump CLI version to republish — always use npm version patch first
- Test end-to-end, not just compilation

## Current Known Issues

- Agent tool_use execution: system prompt updated to force tool calls on batch ops
- Portrait sync: CLI portraits need verification end-to-end
`,
      "projects/youmd/todo.md": `---
title: "You.md — Todo"
---

# You.md — Active Todos

## In Progress

- [ ] Verify agent tool_use reliably executes profile mutations in web shell
- [ ] End-to-end CLI → web portrait sync verification
- [ ] Stripe Pro plan billing integration

## Next Up

- [ ] Rate limiting per plan tier
- [ ] Verified badges (domain + social)
- [ ] Profile analytics dashboard
- [ ] Custom domains for profiles
- [ ] Interview mode (youmd interview)
- [ ] Autonomous refresh (youmd refresh)

## Done

- [x] Anthropic tool_use for agent mutations (replaces JSON block hallucination)
- [x] MCP server (JSON-RPC 2.0, Claude/Cursor integration)
- [x] Skill system with 6 bundled skills
- [x] CLI v0.6.0 (24+ commands)
- [x] Session persistence and restoration
- [x] Memory system with categories and search
`,
      "projects/youmd/prd.md": `---
title: "You.md — PRD"
---

# You.md — Product Requirements

## Vision

The identity context protocol for the agent internet. Every AI agent that works with Houston should know who he is, what he's building, how he thinks, and what he values — without him having to explain it every time.

## Core Value Prop

"An MCP where the context is you." You.md lets anyone publish a structured identity file that AI agents can consume natively. Portable. Persistent. Private when you want it to be.

## Target User

Founders and builders who use 5+ AI agents daily and are tired of context repetition. Early adopter: Houston himself.

## MVP Features (shipped)

- Web shell agent with streaming LLM chat
- Identity bundle system (you.json + you.md)
- CLI (youmd) with 24+ commands
- MCP server for Claude/Cursor
- Memory system
- Skill system with identity interpolation
- Public profiles at you.md/{username}
- Context links (/ctx/{username}/{token}) for agent sharing

## Pricing (target)

- Free: public profile, CLI, MCP
- Pro ($29/mo): private context, full context links, analytics
`,
      "projects/bamf-ai/README.md": `---
title: "BAMF.ai — Project Overview"
---

# BAMF.ai

**Status:** MVP launch (3-4 weeks to public beta)
**Role:** Founder
**Stack:** (to be documented)

## What It Is

AI-powered LinkedIn post generator. SaaS product that leverages BAMF Media's years of LinkedIn expertise. Years in development, finally ready for launch.

## Current Focus

- MVP finalization for public beta
- Applying the LinkedIn growth methodology at scale via AI
`,
      "projects/bamf-ai/context.md": `---
title: "BAMF.ai — Agent Context"
---

# Agent Context: BAMF.ai

BAMF.ai is the SaaS productization of BAMF Media's LinkedIn growth service. Where BAMF Media is the agency (hands-on service), BAMF.ai is the tool (self-serve AI).

## Context for Agents

- This is a separate product from BAMF Media (the agency)
- Core IP: the LinkedIn growth methodology developed over years of agency work
- Target market: founders who want LinkedIn presence without hiring an agency
`,
      "projects/bamf-ai/todo.md": `---
title: "BAMF.ai — Todo"
---

# BAMF.ai — Active Todos

## Pre-Launch

- [ ] Finalize MVP feature set
- [ ] Beta user onboarding flow
- [ ] Pricing and payment integration
- [ ] Launch prep

## Done

- [x] Core AI post generation
`,
      "projects/bamf-ai/prd.md": `---
title: "BAMF.ai — PRD"
---

# BAMF.ai — Product Requirements

## Vision

Democratize LinkedIn growth by encoding BAMF Media's expertise into an AI tool. Any founder should be able to generate high-quality LinkedIn content without agency retainers.

## Core Features

- AI-powered LinkedIn post generation
- BAMF-style writing and engagement optimization
- Content calendar and scheduling
- Analytics integration
`,
      "projects/hubify/README.md": `---
title: "Hubify — Project Overview"
---

# Hubify

**Status:** Active development
**Role:** Founder
**Website:** hubify.com

## What It Is

AI agent squad research platform. Infrastructure enabling AI research squads to collaborate on complex problems. Currently being used for independent cosmology research on big bounce theory.

## Current Focus

- AI research squad collaboration infrastructure
- BigBounce Research Program as the flagship use case
`,
      "projects/hubify/context.md": `---
title: "Hubify — Agent Context"
---

# Agent Context: Hubify

Hubify is both a product (AI agent squad platform) and the infrastructure powering the BigBounce Research Program. It's a meta-tool: AI helping AI do research.

## Key Relationship

- Hubify = the platform
- BigBounce = the most ambitious use case (cosmology research via AI squads)
- bigbounce.hubify.com = the research program's public home

## Context for Agents

When working on Hubify, understand that it needs to handle complex, multi-agent research workflows. Think orchestration, not just chat.
`,
      "projects/hubify/todo.md": `---
title: "Hubify — Todo"
---

# Hubify — Active Todos

## In Progress

- [ ] AI squad collaboration infrastructure
- [ ] BigBounce Research Program integration
- [ ] Research output formatting and publishing

## Backlog

- [ ] Public API for research squads
- [ ] Collaboration tools for human + AI researchers
`,
      "projects/hubify/prd.md": `---
title: "Hubify — PRD"
---

# Hubify — Product Requirements

## Vision

AI research squads that collaborate like human research teams — but at scale and speed. Hubify orchestrates multiple specialized AI agents to tackle complex, multi-dimensional problems.

## Use Case: BigBounce Research Program

Applying AI squad methodology to cosmology research. Multiple AI agents with different specializations (physics, mathematics, literature review, hypothesis generation) collaborate on spin-torsion models and big bounce theory.

## Core Features

- Agent squad orchestration
- Research task decomposition
- Cross-agent communication and synthesis
- Research output formatting (papers, reports, summaries)
`,
      "projects/bamf-agency/README.md": `---
title: "BAMF Agency — Project Overview"
---

# BAMF Agency (BAMF Media)

**Status:** Active operations
**Role:** Founder
**Website:** bamf.com

## What It Is

LinkedIn growth service for founders. Personal brand agency. The proven business model that funds the product experiments.

## Current Focus

- Ongoing client service delivery
- LinkedIn growth methodology refinement
- Transitioning clients to BAMF.ai (the tool) as it matures
`,
      "projects/bamf-agency/context.md": `---
title: "BAMF Agency — Agent Context"
---

# Agent Context: BAMF Agency

BAMF Media is an 8-figure growth marketing agency specializing in LinkedIn for founders. It's Houston's original business — the one that funded everything else.

## Key Facts

- 8-figure revenue
- LinkedIn growth is the core service
- Personal brand agency for founders
- The methodology that BAMF.ai is encoding into software

## Relationship to Other Projects

BAMF Agency → generates revenue and IP
BAMF.ai → productizes the agency's methodology
`,
      "projects/bamf-agency/todo.md": `---
title: "BAMF Agency — Todo"
---

# BAMF Agency — Active Todos

## Ongoing

- [ ] Client delivery and growth tracking
- [ ] Methodology documentation (feeding into BAMF.ai)
- [ ] Transition planning as BAMF.ai matures
`,
      "projects/bigbounce/README.md": `---
title: "BigBounce Research Program — Project Overview"
---

# BigBounce Research Program

**Status:** Active research
**Website:** bigbounce.hubify.com

## What It Is

Cosmology research on spin-torsion models and big bounce theory. Independent scientific research using Hubify's AI agent squads. Proof of concept demonstrating what AI-assisted scientific research looks like at scale.

## Current Focus

- Spin-torsion models in cosmology
- Big bounce theory (alternatives to Big Bang singularity)
- Using AI squads for literature review, hypothesis generation, and mathematical exploration
`,
      "projects/bigbounce/context.md": `---
title: "BigBounce Research — Agent Context"
---

# Agent Context: BigBounce Research Program

This is real scientific research, not just a demo. Houston is genuinely interested in cosmology and using this as both a research effort and a proof of concept for Hubify.

## Research Focus

- **Spin-torsion cosmology**: How torsion fields interact with matter in the early universe
- **Big bounce theory**: The idea that the universe contracts before expanding (avoiding singularity)
- **AI-assisted research**: Multiple specialized agents collaborating on complex scientific questions

## Context for Agents

When working on BigBounce research, take the science seriously. Cite actual papers, use proper physics notation, and maintain research rigor. This isn't sci-fi worldbuilding — it's an attempt at real cosmological research with AI assistance.
`,
      "projects/bigbounce/todo.md": `---
title: "BigBounce Research — Todo"
---

# BigBounce Research — Active Todos

## In Progress

- [ ] Spin-torsion model literature review
- [ ] Big bounce hypothesis formalization
- [ ] AI squad research methodology

## Backlog

- [ ] First publishable research output
- [ ] Peer review process (how does AI-assisted research get validated?)
`,
      "projects/bigbounce/prd.md": `---
title: "BigBounce Research — PRD"
---

# BigBounce Research Program — Requirements

## Vision

Demonstrate that AI agent squads can conduct meaningful scientific research — not just retrieve information, but generate novel hypotheses, identify gaps in existing literature, and propose testable models.

## Research Questions

1. What do spin-torsion models predict about the pre-bounce universe?
2. How does torsion couple to fermion fields in high-curvature regimes?
3. What observational signatures would distinguish big bounce from big bang models?

## Success Criteria

- At least one publishable research paper or preprint
- Reproducible AI research methodology that others can adopt
- Public documentation at bigbounce.hubify.com
`,
    };

    // Merge project files into existing youJson
    const mergedYouJson = { ...existingYouJson, ...projectFiles };

    // Generate simple youMd (just list sections)
    const existingYouMd = (latestBundle?.youMd as string) ?? "";
    const projectSectionList = Object.keys(projectFiles)
      .map((k) => `- ${k}`)
      .join("\n");
    const newYouMd = existingYouMd + `\n\n## Project Files (scaffolded)\n${projectSectionList}`;

    const existingManifest = (latestBundle?.manifest as Record<string, unknown>) ?? {};
    const updatedManifest = {
      ...existingManifest,
      sections: [
        ...((existingManifest.sections as string[]) ?? []),
        ...Object.keys(projectFiles),
      ],
      updatedAt: Date.now(),
    };

    const maxVersion = latestBundle?.version ?? 0;

    const bundleId = await ctx.db.insert("bundles", {
      userId: user._id,
      version: maxVersion + 1,
      schemaVersion: "you-md/v1",
      manifest: updatedManifest,
      youJson: mergedYouJson,
      youMd: newYouMd,
      isPublished: false,
      source: "scaffold",
      createdAt: Date.now(),
    });

    return {
      bundleId,
      version: maxVersion + 1,
      filesScaffolded: Object.keys(projectFiles).length,
      projects: ["you.md", "bamf.ai", "hubify", "bamf-agency", "bigbounce"],
    };
  },
});

/**
 * Internal mutation — publish the latest bundle for a user by username.
 * Run via: npx convex run me:publishLatestForUser --username houstongolden
 */
export const publishLatestForUser = internalMutation({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .first();
    if (!user) throw new Error(`User not found: ${args.username}`);

    const bundles = await ctx.db
      .query("bundles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const latest = bundles.sort((a, b) => b.version - a.version)[0];
    if (!latest) throw new Error("No bundle to publish");

    // Unpublish all
    for (const b of bundles) {
      if (b.isPublished) await ctx.db.patch(b._id, { isPublished: false });
    }

    // Publish latest
    await ctx.db.patch(latest._id, { isPublished: true, publishedAt: Date.now() });

    // Sync to profiles table
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .first();

    if (profile) {
      await ctx.db.patch(profile._id, {
        youJson: latest.youJson,
        youMd: latest.youMd,
        updatedAt: Date.now(),
      });
    }

    return { published: true, version: latest.version };
  },
});
