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

type ProjectSeed = {
  name: string;
  role?: string;
  status?: string;
  url?: string;
  description?: string;
};

type CustomFileSeed = {
  path: string;
  content: string;
  isPublic?: boolean;
};

function slugifyProjectName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "project";
}

function ensureUniqueSlug(baseSlug: string, used: Set<string>): string {
  if (!used.has(baseSlug)) {
    used.add(baseSlug);
    return baseSlug;
  }

  let counter = 2;
  let next = `${baseSlug}-${counter}`;
  while (used.has(next)) {
    counter += 1;
    next = `${baseSlug}-${counter}`;
  }
  used.add(next);
  return next;
}

function buildProjectReadme(project: ProjectSeed): string {
  const lines = [
    "---",
    `title: "${project.name} — Project Overview"`,
    "---",
    "",
    `# ${project.name}`,
    "",
  ];
  if (project.status) lines.push(`**Status:** ${project.status}`);
  if (project.role) lines.push(`**Role:** ${project.role}`);
  if (project.url) lines.push(`**URL:** ${project.url}`);

  const summary =
    project.description ||
    `Working directory for ${project.name}. Capture the operating context here so agents stop guessing.`;

  lines.push(
    "",
    "## What It Is",
    "",
    summary,
    "",
    "## Current Focus",
    "",
    "- clarify the near-term priorities for this project",
    "- capture the current scope, constraints, and open questions",
    ""
  );

  return lines.join("\n");
}

function buildProjectContext(project: ProjectSeed): string {
  return [
    "---",
    `title: "${project.name} — Agent Context"`,
    "---",
    "",
    `# Agent Context: ${project.name}`,
    "",
    project.description || `Shared operating context for ${project.name}.`,
    "",
    "## Context For Agents",
    "",
    "- read this directory before making project-specific changes",
    "- keep README, context, prd, and todo aligned when the project changes",
    "- use this folder to capture decisions, constraints, and current direction",
    "",
  ].join("\n");
}

function buildProjectPrd(project: ProjectSeed): string {
  return [
    "---",
    `title: "${project.name} — PRD"`,
    "---",
    "",
    `# ${project.name} — Product Requirements`,
    "",
    "## Vision",
    "",
    project.description || `${project.name} needs a clear product definition here.`,
    "",
    "## Core Outcomes",
    "",
    "- define what success looks like for this project",
    "- capture the primary user or audience",
    "- list the most important constraints and differentiators",
    "",
  ].join("\n");
}

function buildProjectTodo(project: ProjectSeed): string {
  return [
    "---",
    `title: "${project.name} — Todo"`,
    "---",
    "",
    `# ${project.name} — Active Todos`,
    "",
    "## In Progress",
    "",
    "- [ ] define the current workstreams",
    "",
    "## Next",
    "",
    "- [ ] capture the next highest-value tasks",
    "",
    "## Done",
    "",
    "- [ ] move completed work here as it ships",
    "",
  ].join("\n");
}

function extractProjects(
  yj: Record<string, unknown>,
  fallbackProjects: Array<Record<string, unknown>> = []
): ProjectSeed[] {
  const rawProjects = Array.isArray(yj.projects) ? (yj.projects as Array<Record<string, unknown>>) : fallbackProjects;
  return rawProjects
    .map((project) => ({
      name: typeof project?.name === "string" ? project.name.trim() : "",
      role: typeof project?.role === "string" ? project.role.trim() : undefined,
      status: typeof project?.status === "string" ? project.status.trim() : undefined,
      url: typeof project?.url === "string" ? project.url.trim() : undefined,
      description: typeof project?.description === "string" ? project.description.trim() : undefined,
    }))
    .filter((project) => project.name.length > 0);
}

function scaffoldProjectCustomFiles(
  yj: Record<string, unknown>,
  fallbackProjects: Array<Record<string, unknown>> = []
): {
  projectCount: number;
  projectSlugs: string[];
  createdPaths: string[];
  customFiles: CustomFileSeed[];
} {
  const customFiles = (Array.isArray(yj.custom_files) ? yj.custom_files : []) as CustomFileSeed[];
  const normalizedFiles: CustomFileSeed[] = customFiles
    .filter((file) => file && typeof file.path === "string")
    .map((file) => ({
      path: file.path,
      content: typeof file.content === "string" ? file.content : "",
      isPublic: file.isPublic ?? file.path.startsWith("profile/"),
    }));
  const existingPaths = new Set(normalizedFiles.map((file) => file.path));
  const usedSlugs = new Set<string>();
  const projectSlugs: string[] = [];
  const createdPaths: string[] = [];

  for (const project of extractProjects(yj, fallbackProjects)) {
    const slug = ensureUniqueSlug(slugifyProjectName(project.name), usedSlugs);
    projectSlugs.push(slug);

    const files: CustomFileSeed[] = [
      { path: `projects/${slug}/README.md`, content: buildProjectReadme(project), isPublic: false },
      { path: `projects/${slug}/context.md`, content: buildProjectContext(project), isPublic: false },
      { path: `projects/${slug}/prd.md`, content: buildProjectPrd(project), isPublic: false },
      { path: `projects/${slug}/todo.md`, content: buildProjectTodo(project), isPublic: false },
    ];

    for (const file of files) {
      if (existingPaths.has(file.path)) continue;
      existingPaths.add(file.path);
      normalizedFiles.push({
        path: file.path,
        content: file.content,
        isPublic: file.isPublic ?? false,
      });
      createdPaths.push(file.path);
    }
  }

  return {
    projectCount: projectSlugs.length,
    projectSlugs,
    createdPaths,
    customFiles: normalizedFiles,
  };
}

function buildProfileDataFromYouJson(yj: Record<string, unknown>, username: string): ProfileData {
  const identity = (yj?.identity as Record<string, unknown> | undefined) || {};
  const now = (yj?.now as Record<string, unknown> | undefined) || {};
  const analysis = (yj?.analysis as Record<string, unknown> | undefined) || {};
  const voice = (yj?.voice as Record<string, unknown> | undefined) || {};
  const voicePlatforms = (voice.platforms as Record<string, unknown> | undefined) || {};
  const directives = (yj?.agent_directives as Record<string, unknown> | undefined) || {};
  const customSections = (Array.isArray(yj?.custom_sections) ? yj.custom_sections : []) as Array<Record<string, unknown>>;
  const customFiles = (Array.isArray(yj?.custom_files) ? yj.custom_files : []) as Array<Record<string, unknown>>;

  return {
    name: (identity.name as string) || username,
    username,
    tagline: (identity.tagline as string) || "",
    location: (identity.location as string) || "",
    bio: identity.bio as ProfileData["bio"],
    now: Array.isArray(now.focus) ? (now.focus as string[]) : [],
    projects: Array.isArray(yj?.projects) ? (yj.projects as ProfileData["projects"]) : [],
    values: Array.isArray(yj?.values) ? (yj.values as string[]) : [],
    links: (yj?.links as Record<string, string>) || {},
    preferences: (yj?.preferences as ProfileData["preferences"]) || {},
    analysis: {
      topics: Array.isArray(analysis.topics) ? (analysis.topics as string[]) : [],
      voice_summary: (voice.overall as string) || (analysis.voice_summary as string) || "",
      credibility_signals: Array.isArray(analysis.credibility_signals)
        ? (analysis.credibility_signals as string[])
        : [],
      voice_linkedin: (voicePlatforms.linkedin as string) || undefined,
      voice_x: (voicePlatforms.x as string) || undefined,
      voice_blog: (voicePlatforms.blog as string) || undefined,
    },
    socialImages: (yj?.social_images as ProfileData["socialImages"]) || {},
    agentDirectives: {
      communication_style: (directives.communication_style as string) || "",
      negative_prompts: Array.isArray(directives.negative_prompts)
        ? (directives.negative_prompts as string[])
        : [],
      default_stack: (directives.default_stack as string) || "",
      decision_framework: (directives.decision_framework as string) || "",
      current_goal: (directives.current_goal as string) || "",
    },
    customSections: customSections.map((section) => ({
      id: (section.id as string) || "",
      title: (section.title as string) || (section.id as string) || "",
      content: (section.content as string) || "",
    })),
    customFiles: customFiles
      .filter((file) => typeof file?.path === "string")
      .map((file) => ({
        path: file.path as string,
        content: typeof file.content === "string" ? file.content : "",
        isPublic: (file.isPublic as boolean | undefined) ?? (file.path as string).startsWith("profile/"),
      })),
  };
}

async function persistBundleFromYouJson(
  ctx: any,
  user: { _id: any; username: string },
  yj: Record<string, unknown>,
  source: string
) {
  const existing: any[] = await ctx.db
    .query("bundles")
    .withIndex("by_userId", (q: any) => q.eq("userId", user._id))
    .collect();
  const latestBundle = existing.sort((a: any, b: any) => b.version - a.version)[0];
  const maxVersion = existing.reduce((max: number, bundle: any) => Math.max(max, bundle.version), 0);
  const data = buildProfileDataFromYouJson(yj, user.username);
  const youMd = compileYouMd(data);
  const manifest = compileManifest(data);
  const contentHash = await computeContentHash(yj, youMd);

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
    parentHash: latestBundle?.contentHash ?? undefined,
    source,
  });

  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_ownerId", (q: any) => q.eq("ownerId", user._id))
    .first();

  if (profile) {
    const profileUpdates: Record<string, unknown> = {
      youJson: yj,
      youMd,
      updatedAt: Date.now(),
    };
    const identity = (yj?.identity as Record<string, unknown> | undefined) || {};
    if (identity.name) profileUpdates.name = identity.name;
    if (identity.tagline) profileUpdates.tagline = identity.tagline;
    if (identity.location) profileUpdates.location = identity.location;
    if (identity.bio) profileUpdates.bio = identity.bio;
    if (yj?.links) profileUpdates.links = yj.links;
    if ((yj?.now as Record<string, unknown> | undefined)?.focus) profileUpdates.now = (yj.now as Record<string, unknown>).focus;
    if (yj?.projects) profileUpdates.projects = yj.projects;
    if (yj?.values) profileUpdates.values = yj.values;
    if (yj?.preferences) profileUpdates.preferences = yj.preferences;

    await ctx.db.patch(profile._id, profileUpdates);
  }

  return { bundleId, version: maxVersion + 1, contentHash };
}

async function publishBundleForUser(ctx: any, userId: any, bundleId: any) {
  const bundles: any[] = await ctx.db
    .query("bundles")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .collect();

  for (const bundle of bundles) {
    if (bundle.isPublished) {
      await ctx.db.patch(bundle._id, { isPublished: false });
    }
  }

  await ctx.db.patch(bundleId, {
    isPublished: true,
    publishedAt: Date.now(),
  });
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

export const scaffoldProjectDirectories = mutation({
  args: { clerkId: v.string(), _internalAuthToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) throw new Error("User not found");

    const existing = await ctx.db
      .query("bundles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    const latestBundle = existing.sort((a, b) => b.version - a.version)[0];

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .first();

    const fallbackProjects = Array.isArray(profile?.projects)
      ? (profile.projects as Array<Record<string, unknown>>)
      : [];
    const profileNow = typeof (profile as Record<string, unknown> | null)?.now === "string"
      ? ((profile as Record<string, unknown>).now as string).trim()
      : "";

    const baseYouJson = latestBundle
      ? (JSON.parse(JSON.stringify(latestBundle.youJson)) as Record<string, unknown>)
      : compileYouJson({
          name: profile?.name || user.username,
          username: user.username,
          tagline: profile?.tagline || undefined,
          location: profile?.location || undefined,
          bio: (profile?.bio as ProfileData["bio"]) || undefined,
          now: profileNow ? [profileNow] : [],
          projects: fallbackProjects as ProfileData["projects"],
          values: Array.isArray(profile?.values) ? (profile.values as string[]) : [],
          links: (profile?.links as Record<string, string>) || {},
          preferences: (profile?.preferences as ProfileData["preferences"]) || {},
        });

    const { projectCount, projectSlugs, createdPaths, customFiles } = scaffoldProjectCustomFiles(
      baseYouJson,
      fallbackProjects
    );

    if (projectCount === 0) {
      throw new Error("No projects found in the current profile");
    }

    if (createdPaths.length === 0) {
      return {
        changed: false,
        version: latestBundle?.version ?? 0,
        projectCount,
        projectSlugs,
        createdPaths,
      };
    }

    baseYouJson.custom_files = customFiles;
    const persisted = await persistBundleFromYouJson(ctx as any, user as any, baseYouJson, "web-shell:project-scaffold");
    await publishBundleForUser(ctx as any, user._id, persisted.bundleId);

    return {
      changed: true,
      published: true,
      version: persisted.version,
      projectCount,
      projectSlugs,
      createdPaths,
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
    const existing = await ctx.db
      .query("bundles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    const latestBundle = existing.sort((a, b) => b.version - a.version)[0];

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .first();
    const fallbackProjects = Array.isArray(profile?.projects)
      ? (profile.projects as Array<Record<string, unknown>>)
      : [];
    const profileNow = typeof (profile as Record<string, unknown> | null)?.now === "string"
      ? ((profile as Record<string, unknown>).now as string).trim()
      : "";

    const baseYouJson = latestBundle
      ? (JSON.parse(JSON.stringify(latestBundle.youJson)) as Record<string, unknown>)
      : compileYouJson({
          name: profile?.name || user.username,
          username: user.username,
          tagline: profile?.tagline || undefined,
          location: profile?.location || undefined,
          bio: (profile?.bio as ProfileData["bio"]) || undefined,
          now: profileNow ? [profileNow] : [],
          projects: fallbackProjects as ProfileData["projects"],
          values: Array.isArray(profile?.values) ? (profile.values as string[]) : [],
          links: (profile?.links as Record<string, string>) || {},
          preferences: (profile?.preferences as ProfileData["preferences"]) || {},
        });

    const { projectCount, projectSlugs, createdPaths, customFiles } = scaffoldProjectCustomFiles(
      baseYouJson,
      fallbackProjects
    );

    if (projectCount === 0) {
      throw new Error("No projects found in the current profile");
    }

    if (createdPaths.length === 0) {
      return {
        changed: false,
        version: latestBundle?.version ?? 0,
        projectCount,
        projectSlugs,
        createdPaths,
      };
    }

    baseYouJson.custom_files = customFiles;
    const persisted = await persistBundleFromYouJson(ctx as any, user as any, baseYouJson, "internal:project-scaffold");
    await publishBundleForUser(ctx as any, user._id, persisted.bundleId);

    return {
      changed: true,
      published: true,
      version: persisted.version,
      projectCount,
      projectSlugs,
      createdPaths,
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
