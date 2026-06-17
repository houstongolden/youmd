import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
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

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "project";
}

function optionalStrings(value: string[] | undefined): string[] {
  return (value ?? []).map((item) => item.trim()).filter(Boolean);
}

const competitorValidator = v.object({
  name: v.string(),
  url: v.optional(v.string()),
  note: v.optional(v.string()),
});

const taskDraftValidator = v.object({
  projectSlug: v.optional(v.string()),
  title: v.string(),
  description: v.optional(v.string()),
  ownerType: v.union(v.literal("human"), v.literal("agent")),
  ownerLabel: v.optional(v.string()),
  status: v.optional(v.string()),
  priority: v.optional(v.string()),
  dueAt: v.optional(v.number()),
  tags: v.optional(v.array(v.string())),
});

export const listPortfolioGraph = query({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    includeDoneTasks: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);

    const [
      projects,
      apiSurfaces,
      dependencyEdges,
      reusablePatterns,
      trackedProjects,
      allTasks,
      recentCaptures,
    ] = await Promise.all([
      ctx.db
        .query("portfolioProjects")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect(),
      ctx.db
        .query("portfolioApiSurfaces")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect(),
      ctx.db
        .query("portfolioDependencyEdges")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect(),
      ctx.db
        .query("portfolioReusablePatterns")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect(),
      ctx.db
        .query("trackedProjects")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect(),
      ctx.db
        .query("portfolioTasks")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect(),
      ctx.db
        .query("brainDumpCaptures")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .order("desc")
        .take(8),
    ]);

    const tasks = args.includeDoneTasks
      ? allTasks
      : allTasks.filter((task) => task.status !== "done" && task.status !== "cancelled");

    return {
      projects: projects.sort((a, b) => b.updatedAt - a.updatedAt),
      recentTrackedProjects: trackedProjects.sort((a, b) => b.pushedAt - a.pushedAt),
      apiSurfaces: apiSurfaces.sort((a, b) => a.slug.localeCompare(b.slug)),
      dependencyEdges: dependencyEdges.sort((a, b) => a.fromProjectSlug.localeCompare(b.fromProjectSlug)),
      reusablePatterns: reusablePatterns.sort((a, b) => a.slug.localeCompare(b.slug)),
      tasks: tasks.sort((a, b) => b.updatedAt - a.updatedAt),
      recentCaptures,
    };
  },
});

export const getProjectSlice = query({
  args: {
    clerkId: v.string(),
    projectSlug: v.string(),
    _internalAuthToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const slug = slugify(args.projectSlug);

    const project =
      await ctx.db
        .query("portfolioProjects")
        .withIndex("by_userId_slug", (q) => q.eq("userId", user._id).eq("slug", slug))
        .first();

    const tracked = await ctx.db
      .query("trackedProjects")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    const trackedMatch = tracked.find((row) => {
      const candidates = [row.name, row.repoName, row.directoryName, row.fullName, row.stackSlug]
        .filter(Boolean)
        .map((value) => slugify(String(value)));
      return candidates.includes(slug);
    }) ?? null;

    const [ownedSurfaces, dependencyEdges, reusablePatterns, tasks] = await Promise.all([
      ctx.db
        .query("portfolioApiSurfaces")
        .withIndex("by_userId_owner", (q) => q.eq("userId", user._id).eq("ownerProjectSlug", slug))
        .collect(),
      ctx.db
        .query("portfolioDependencyEdges")
        .withIndex("by_userId_from", (q) => q.eq("userId", user._id).eq("fromProjectSlug", slug))
        .collect(),
      ctx.db
        .query("portfolioReusablePatterns")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect(),
      ctx.db
        .query("portfolioTasks")
        .withIndex("by_userId_project", (q) => q.eq("userId", user._id).eq("projectSlug", slug))
        .collect(),
    ]);

    return {
      project,
      trackedProject: trackedMatch,
      ownedSurfaces,
      dependencyEdges,
      reusablePatterns: reusablePatterns.filter((pattern) => pattern.usageProjects.includes(slug)),
      tasks: tasks.filter((task) => task.status !== "done" && task.status !== "cancelled"),
      readiness: project || trackedMatch
        ? { ready: true, reason: "Project portfolio slice is available." }
        : { ready: false, reason: "No persisted portfolio slice found for this project yet." },
    };
  },
});

export const upsertProject = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    slug: v.optional(v.string()),
    name: v.string(),
    stackName: v.optional(v.string()),
    status: v.optional(v.string()),
    summary: v.optional(v.string()),
    detailedDescription: v.optional(v.string()),
    goal: v.optional(v.string()),
    vision: v.optional(v.string()),
    focus: v.optional(v.string()),
    positioning: v.optional(v.string()),
    audience: v.optional(v.string()),
    painPoints: v.optional(v.array(v.string())),
    solution: v.optional(v.string()),
    whyThisSolution: v.optional(v.string()),
    northStar: v.optional(v.string()),
    metrics: v.optional(v.array(v.string())),
    constraints: v.optional(v.array(v.string())),
    notBuilding: v.optional(v.array(v.string())),
    competitors: v.optional(v.array(competitorValidator)),
    repoFullName: v.optional(v.string()),
    repoUrl: v.optional(v.string()),
    productUrl: v.optional(v.string()),
    docs: v.optional(v.array(v.string())),
    environments: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
    source: v.optional(v.string()),
    repoPath: v.optional(v.string()),
    lastActivityAt: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ projectId: Id<"portfolioProjects">; created: boolean }> => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const slug = slugify(args.slug ?? args.name);
    const now = Date.now();
    const existing = await ctx.db
      .query("portfolioProjects")
      .withIndex("by_userId_slug", (q) => q.eq("userId", user._id).eq("slug", slug))
      .first();

    const row = {
      userId: user._id,
      slug,
      name: args.name.trim(),
      stackName: args.stackName,
      status: args.status ?? "active",
      summary: args.summary,
      detailedDescription: args.detailedDescription,
      goal: args.goal,
      vision: args.vision,
      focus: args.focus,
      positioning: args.positioning,
      audience: args.audience,
      painPoints: optionalStrings(args.painPoints),
      solution: args.solution,
      whyThisSolution: args.whyThisSolution,
      northStar: args.northStar,
      metrics: optionalStrings(args.metrics),
      constraints: optionalStrings(args.constraints),
      notBuilding: optionalStrings(args.notBuilding),
      competitors: args.competitors ?? [],
      repoFullName: args.repoFullName,
      repoUrl: args.repoUrl,
      productUrl: args.productUrl,
      docs: optionalStrings(args.docs),
      environments: optionalStrings(args.environments),
      tags: optionalStrings(args.tags),
      source: args.source ?? "manual",
      repoPath: args.repoPath,
      lastActivityAt: args.lastActivityAt,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, row);
      return { projectId: existing._id, created: false };
    }

    const projectId = await ctx.db.insert("portfolioProjects", {
      ...row,
      createdAt: now,
    });
    return { projectId, created: true };
  },
});

export const upsertTask = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    taskId: v.optional(v.id("portfolioTasks")),
    projectSlug: v.optional(v.string()),
    title: v.string(),
    description: v.optional(v.string()),
    ownerType: v.union(v.literal("human"), v.literal("agent")),
    ownerLabel: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    dueAt: v.optional(v.number()),
    sourceType: v.optional(v.string()),
    sourceId: v.optional(v.string()),
    rawCaptureId: v.optional(v.id("brainDumpCaptures")),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<{ taskId: Id<"portfolioTasks">; created: boolean }> => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const now = Date.now();
    const completedAt = args.status === "done" ? now : undefined;
    const row = {
      userId: user._id,
      projectSlug: args.projectSlug ? slugify(args.projectSlug) : undefined,
      title: args.title.trim(),
      description: args.description,
      ownerType: args.ownerType,
      ownerLabel: args.ownerLabel,
      status: args.status ?? "open",
      priority: args.priority ?? "normal",
      dueAt: args.dueAt,
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      rawCaptureId: args.rawCaptureId,
      tags: optionalStrings(args.tags),
      updatedAt: now,
      completedAt,
    };

    if (args.taskId) {
      const existing = await ctx.db.get(args.taskId);
      if (!existing || existing.userId !== user._id) throw new Error("Task not found");
      await ctx.db.patch(args.taskId, row);
      return { taskId: args.taskId, created: false };
    }

    const taskId = await ctx.db.insert("portfolioTasks", {
      ...row,
      createdAt: now,
    });
    return { taskId, created: true };
  },
});

export const recordBrainDump = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    source: v.string(),
    rawText: v.string(),
    summary: v.optional(v.string()),
    insights: v.optional(v.array(v.string())),
    projectSlugs: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
    transcriptStartedAt: v.optional(v.number()),
    transcriptEndedAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
    tasks: v.optional(v.array(taskDraftValidator)),
  },
  handler: async (ctx, args): Promise<{ captureId: Id<"brainDumpCaptures">; taskIds: Id<"portfolioTasks">[] }> => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const now = Date.now();
    const projectSlugs = optionalStrings(args.projectSlugs).map(slugify);
    const captureId = await ctx.db.insert("brainDumpCaptures", {
      userId: user._id,
      source: args.source,
      rawText: args.rawText,
      summary: args.summary,
      insights: optionalStrings(args.insights),
      projectSlugs,
      tags: optionalStrings(args.tags),
      transcriptStartedAt: args.transcriptStartedAt,
      transcriptEndedAt: args.transcriptEndedAt,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    });

    const taskIds: Id<"portfolioTasks">[] = [];
    for (const task of args.tasks ?? []) {
      const taskId = await ctx.db.insert("portfolioTasks", {
        userId: user._id,
        projectSlug: task.projectSlug ? slugify(task.projectSlug) : projectSlugs[0],
        title: task.title.trim(),
        description: task.description,
        ownerType: task.ownerType,
        ownerLabel: task.ownerLabel,
        status: task.status ?? "proposed",
        priority: task.priority ?? "normal",
        dueAt: task.dueAt,
        sourceType: "braindump",
        sourceId: String(captureId),
        rawCaptureId: captureId,
        tags: optionalStrings(task.tags),
        createdAt: now,
        updatedAt: now,
      });
      taskIds.push(taskId);
    }

    return { captureId, taskIds };
  },
});
