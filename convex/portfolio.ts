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

const TASK_STATUSES = ["proposed", "open", "in_progress", "done", "snoozed", "cancelled"] as const;
const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

function normalizeTaskStatus(value: string | undefined, fallback: string): string {
  const next = value?.trim();
  return next && TASK_STATUSES.includes(next as typeof TASK_STATUSES[number]) ? next : fallback;
}

function normalizeTaskPriority(value: string | undefined, fallback: string): string {
  const next = value?.trim();
  return next && TASK_PRIORITIES.includes(next as typeof TASK_PRIORITIES[number]) ? next : fallback;
}

const projectActivityValidator = v.object({
  kind: v.string(),
  title: v.string(),
  summary: v.optional(v.string()),
  url: v.optional(v.string()),
  source: v.string(),
  evidencePath: v.optional(v.string()),
  dedupeKey: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
  metadata: v.optional(v.any()),
  occurredAt: v.number(),
});

const dashboardProjectValidator = v.object({
  slug: v.string(),
  name: v.string(),
  stack: v.string(),
  status: v.string(),
  summary: v.string(),
  goal: v.string(),
  focus: v.string(),
  repo: v.optional(v.string()),
  docs: v.array(v.string()),
  environments: v.array(v.string()),
});

const dashboardSurfaceValidator = v.object({
  slug: v.string(),
  name: v.string(),
  kind: v.string(),
  ownerProject: v.string(),
  ownerStack: v.string(),
  trust: v.string(),
  authMode: v.string(),
  writePolicy: v.string(),
  features: v.array(v.string()),
  risk: v.string(),
  notes: v.string(),
});

const dashboardDependencyValidator = v.object({
  fromProject: v.string(),
  toSurface: v.string(),
  tier: v.string(),
  integrationType: v.string(),
  features: v.array(v.string()),
  failureImpact: v.string(),
});

const dashboardPatternValidator = v.object({
  slug: v.string(),
  name: v.string(),
  status: v.string(),
  tags: v.array(v.string()),
  canonicalOwner: v.string(),
  summary: v.string(),
});

function githubRepoUrl(repo: string | undefined): string | undefined {
  if (!repo) return undefined;
  if (/^https?:\/\//.test(repo)) return repo;
  if (repo.includes("/")) return `https://github.com/${repo}`;
  return undefined;
}

function githubRepoFullName(repo: string | undefined): string | undefined {
  if (!repo || !repo.includes("/")) return undefined;
  return repo.replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "");
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function mergeStringArray(
  primary: string[] | undefined,
  fallback: string[] | undefined
): string[] {
  return Array.from(new Set([...(primary ?? []), ...(fallback ?? [])].map((item) => item.trim()).filter(Boolean)));
}

function statusFromPushedAt(pushedAt: number): string {
  const ageDays = (Date.now() - pushedAt) / 86_400_000;
  if (ageDays <= 30) return "active";
  if (ageDays <= 90) return "recent";
  return "tracked";
}

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
      projectActivities,
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
        .query("portfolioProjectActivities")
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
      projectActivities: projectActivities
        .sort((a, b) => b.occurredAt - a.occurredAt)
        .slice(0, 600),
      apiSurfaces: apiSurfaces.sort((a, b) => a.slug.localeCompare(b.slug)),
      dependencyEdges: dependencyEdges.sort((a, b) => a.fromProjectSlug.localeCompare(b.fromProjectSlug)),
      reusablePatterns: reusablePatterns.sort((a, b) => a.slug.localeCompare(b.slug)),
      tasks: tasks.sort((a, b) => b.updatedAt - a.updatedAt),
      recentCaptures,
    };
  },
});

export const upsertProjectActivityBatch = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    projectSlug: v.string(),
    activities: v.array(projectActivityValidator),
  },
  handler: async (ctx, args) => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const projectSlug = slugify(args.projectSlug);
    const now = Date.now();
    const counts = {
      received: args.activities.length,
      created: 0,
      updated: 0,
      skipped: 0,
    };

    for (const activity of args.activities.slice(0, 120)) {
      const title = activity.title.trim();
      if (!title || !Number.isFinite(activity.occurredAt)) {
        counts.skipped += 1;
        continue;
      }
      const dedupeKey = activity.dedupeKey?.trim() ||
        `${activity.source}:${activity.kind}:${activity.occurredAt}:${title}`.slice(0, 220);
      const existing = await ctx.db
        .query("portfolioProjectActivities")
        .withIndex("by_userId_project_dedupe", (q) =>
          q.eq("userId", user._id).eq("projectSlug", projectSlug).eq("dedupeKey", dedupeKey)
        )
        .first();
      const row = {
        userId: user._id,
        projectSlug,
        kind: activity.kind,
        title,
        summary: activity.summary,
        url: activity.url,
        source: activity.source,
        evidencePath: activity.evidencePath,
        dedupeKey,
        tags: optionalStrings(activity.tags),
        metadata: activity.metadata,
        occurredAt: activity.occurredAt,
        updatedAt: now,
      };

      if (existing) {
        await ctx.db.patch(existing._id, row);
        counts.updated += 1;
      } else {
        await ctx.db.insert("portfolioProjectActivities", { ...row, createdAt: now });
        counts.created += 1;
      }
    }

    return counts;
  },
});

export const syncDashboardSeed = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    projects: v.array(dashboardProjectValidator),
    apiSurfaces: v.array(dashboardSurfaceValidator),
    dependencyEdges: v.array(dashboardDependencyValidator),
    reusablePatterns: v.array(dashboardPatternValidator),
  },
  handler: async (ctx, args) => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const now = Date.now();
    const counts = {
      projects: 0,
      apiSurfaces: 0,
      dependencyEdges: 0,
      reusablePatterns: 0,
      created: 0,
      updated: 0,
    };

    for (const project of args.projects) {
      const slug = slugify(project.slug || project.name);
      const existing = await ctx.db
        .query("portfolioProjects")
        .withIndex("by_userId_slug", (q) => q.eq("userId", user._id).eq("slug", slug))
        .first();
      const row = {
        userId: user._id,
        slug,
        name: project.name,
        stackName: project.stack,
        status: project.status,
        summary: project.summary,
        goal: project.goal,
        focus: project.focus,
        repoFullName: githubRepoFullName(project.repo),
        repoUrl: githubRepoUrl(project.repo),
        docs: optionalStrings(project.docs),
        environments: optionalStrings(project.environments),
        painPoints: [],
        metrics: [],
        constraints: [],
        notBuilding: [],
        competitors: [],
        tags: optionalStrings([project.stack, project.status]),
        source: "dashboard-bootstrap",
        updatedAt: now,
      };
      if (existing) {
        await ctx.db.patch(existing._id, row);
        counts.updated += 1;
      } else {
        await ctx.db.insert("portfolioProjects", { ...row, createdAt: now });
        counts.created += 1;
      }
      counts.projects += 1;
    }

    for (const surface of args.apiSurfaces) {
      const slug = slugify(surface.slug || surface.name);
      const existing = await ctx.db
        .query("portfolioApiSurfaces")
        .withIndex("by_userId_slug", (q) => q.eq("userId", user._id).eq("slug", slug))
        .first();
      const row = {
        userId: user._id,
        slug,
        name: surface.name,
        kind: surface.kind,
        ownerProjectSlug: slugify(surface.ownerProject),
        ownerStack: surface.ownerStack,
        trust: surface.trust,
        authMode: surface.authMode,
        writePolicy: surface.writePolicy,
        features: optionalStrings(surface.features),
        risk: surface.risk,
        notes: surface.notes,
        docsUrls: [],
        integrationTypes: [],
        updatedAt: now,
      };
      if (existing) {
        await ctx.db.patch(existing._id, row);
        counts.updated += 1;
      } else {
        await ctx.db.insert("portfolioApiSurfaces", { ...row, createdAt: now });
        counts.created += 1;
      }
      counts.apiSurfaces += 1;
    }

    for (const edge of args.dependencyEdges) {
      const fromProjectSlug = slugify(edge.fromProject);
      const toSurfaceSlug = slugify(edge.toSurface);
      const existing = (await ctx.db
        .query("portfolioDependencyEdges")
        .withIndex("by_userId_from", (q) => q.eq("userId", user._id).eq("fromProjectSlug", fromProjectSlug))
        .collect()).find((row) => row.toSurfaceSlug === toSurfaceSlug);
      const row = {
        userId: user._id,
        fromProjectSlug,
        toSurfaceSlug,
        tier: edge.tier,
        integrationType: edge.integrationType,
        features: optionalStrings(edge.features),
        failureImpact: edge.failureImpact,
        updatedAt: now,
      };
      if (existing) {
        await ctx.db.patch(existing._id, row);
        counts.updated += 1;
      } else {
        await ctx.db.insert("portfolioDependencyEdges", { ...row, createdAt: now });
        counts.created += 1;
      }
      counts.dependencyEdges += 1;
    }

    for (const pattern of args.reusablePatterns) {
      const slug = slugify(pattern.slug || pattern.name);
      const existing = await ctx.db
        .query("portfolioReusablePatterns")
        .withIndex("by_userId_slug", (q) => q.eq("userId", user._id).eq("slug", slug))
        .first();
      const row = {
        userId: user._id,
        slug,
        name: pattern.name,
        status: pattern.status,
        tags: optionalStrings(pattern.tags),
        techStacks: optionalStrings(pattern.tags.filter((tag) => /next|vite|convex|react|api|mcp|auth|ui/i.test(tag))),
        canonicalOwnerProject: slugify(pattern.canonicalOwner),
        summary: pattern.summary,
        sourcePaths: [],
        usageProjects: optionalStrings([pattern.canonicalOwner]).map(slugify),
        updatedAt: now,
      };
      if (existing) {
        await ctx.db.patch(existing._id, row);
        counts.updated += 1;
      } else {
        await ctx.db.insert("portfolioReusablePatterns", { ...row, createdAt: now });
        counts.created += 1;
      }
      counts.reusablePatterns += 1;
    }

    return counts;
  },
});

export const syncTrackedProjects = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    days: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const now = Date.now();
    const days = Math.max(1, Math.min(args.days ?? 90, 365));
    const limit = Math.max(1, Math.min(args.limit ?? 60, 200));
    const cutoff = now - days * 86_400_000;
    const tracked = (await ctx.db
      .query("trackedProjects")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect())
      .filter((project) => project.pushedAt >= cutoff)
      .sort((a, b) => b.pushedAt - a.pushedAt)
      .slice(0, limit);

    const counts = {
      tracked: tracked.length,
      created: 0,
      updated: 0,
      skipped: 0,
      days,
      limit,
      projects: [] as Array<{ slug: string; name: string; created: boolean }>,
    };

    for (const trackedProject of tracked) {
      const slug = slugify(
        trackedProject.directoryName ||
        trackedProject.repoName ||
        trackedProject.name ||
        trackedProject.fullName
      );
      if (!slug) {
        counts.skipped += 1;
        continue;
      }

      const existing = await ctx.db
        .query("portfolioProjects")
        .withIndex("by_userId_slug", (q) => q.eq("userId", user._id).eq("slug", slug))
        .first();

      const docs = mergeStringArray(
        [trackedProject.apiDocsUrl, trackedProject.mcpDocsUrl].filter((value): value is string => Boolean(nonEmpty(value))),
        existing?.docs
      );
      const tags = mergeStringArray(
        [
          "github-tracked",
          trackedProject.primaryLanguage,
          trackedProject.stackSlug,
          trackedProject.stackName,
          trackedProject.isPrivate ? "private-repo" : "public-repo",
        ].filter((value): value is string => Boolean(nonEmpty(value))),
        existing?.tags
      );
      const environments = mergeStringArray(
        [
          trackedProject.directoryName ? `local:${trackedProject.directoryName}` : undefined,
          "github",
        ].filter((value): value is string => Boolean(nonEmpty(value))),
        existing?.environments
      );

      const existingIsBootstrap = existing?.source === "dashboard-bootstrap";
      const summary =
        (existingIsBootstrap
          ? nonEmpty(trackedProject.description) ?? nonEmpty(trackedProject.insight) ?? nonEmpty(existing?.summary)
          : nonEmpty(existing?.summary) ?? nonEmpty(trackedProject.description) ?? nonEmpty(trackedProject.insight)) ??
        `${trackedProject.fullName} is an active GitHub-tracked project.`;
      const goal = existingIsBootstrap
        ? nonEmpty(trackedProject.highLevelGoal) ?? nonEmpty(existing?.goal)
        : nonEmpty(existing?.goal) ?? nonEmpty(trackedProject.highLevelGoal);
      const focus = existingIsBootstrap
        ? nonEmpty(trackedProject.recentProgress) ?? nonEmpty(existing?.focus)
        : nonEmpty(existing?.focus) ?? nonEmpty(trackedProject.recentProgress);

      const row = {
        userId: user._id,
        slug,
        name: trackedProject.name,
        stackName: existingIsBootstrap
          ? nonEmpty(trackedProject.stackName) ?? nonEmpty(existing?.stackName) ?? "Project Stack"
          : nonEmpty(existing?.stackName) ?? nonEmpty(trackedProject.stackName) ?? "Project Stack",
        status: existingIsBootstrap ? statusFromPushedAt(trackedProject.pushedAt) : (existing?.status ?? statusFromPushedAt(trackedProject.pushedAt)),
        summary,
        detailedDescription: existing?.detailedDescription,
        goal,
        vision: existing?.vision,
        focus,
        positioning: existing?.positioning,
        audience: existing?.audience,
        painPoints: existing?.painPoints ?? [],
        solution: existing?.solution,
        whyThisSolution: existing?.whyThisSolution,
        northStar: existing?.northStar,
        metrics: existing?.metrics ?? [],
        constraints: existing?.constraints ?? [],
        notBuilding: existing?.notBuilding ?? [],
        competitors: existing?.competitors ?? [],
        repoFullName: trackedProject.fullName,
        repoUrl: trackedProject.url ?? githubRepoUrl(trackedProject.fullName),
        productUrl: nonEmpty(existing?.productUrl) ?? nonEmpty(trackedProject.projectUrl),
        docs,
        environments,
        tags,
        source: existing?.source === "manual" || existing?.source === "agent" ? existing.source : "github-tracked",
        repoPath: nonEmpty(existing?.repoPath) ?? nonEmpty(trackedProject.directoryName),
        lastActivityAt: trackedProject.pushedAt,
        updatedAt: now,
      };

      if (existing) {
        await ctx.db.patch(existing._id, row);
        counts.updated += 1;
        counts.projects.push({ slug, name: trackedProject.name, created: false });
      } else {
        await ctx.db.insert("portfolioProjects", { ...row, createdAt: now });
        counts.created += 1;
        counts.projects.push({ slug, name: trackedProject.name, created: true });
      }
    }

    return counts;
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

    const [ownedSurfaces, dependencyEdges, reusablePatterns, tasks, activities] = await Promise.all([
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
      ctx.db
        .query("portfolioProjectActivities")
        .withIndex("by_userId_project_occurredAt", (q) => q.eq("userId", user._id).eq("projectSlug", slug))
        .collect(),
    ]);

    return {
      project,
      trackedProject: trackedMatch,
      ownedSurfaces,
      dependencyEdges,
      reusablePatterns: reusablePatterns.filter((pattern) => pattern.usageProjects.includes(slug)),
      tasks: tasks.filter((task) => task.status !== "done" && task.status !== "cancelled"),
      activities: activities.sort((a, b) => b.occurredAt - a.occurredAt).slice(0, 80),
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

    const existingIsHumanManaged = existing?.source === "manual" || existing?.source === "agent";
    const incomingSource = args.source ?? existing?.source ?? "manual";
    const source = existingIsHumanManaged && incomingSource !== existing?.source
      ? existing.source
      : incomingSource;
    const row = {
      userId: user._id,
      slug,
      name: args.name.trim(),
      stackName: args.stackName ?? existing?.stackName,
      status: args.status ?? existing?.status ?? "active",
      summary: args.summary ?? existing?.summary,
      detailedDescription: args.detailedDescription ?? existing?.detailedDescription,
      goal: args.goal ?? existing?.goal,
      vision: args.vision ?? existing?.vision,
      focus: args.focus ?? existing?.focus,
      positioning: args.positioning ?? existing?.positioning,
      audience: args.audience ?? existing?.audience,
      painPoints: args.painPoints ? optionalStrings(args.painPoints) : (existing?.painPoints ?? []),
      solution: args.solution ?? existing?.solution,
      whyThisSolution: args.whyThisSolution ?? existing?.whyThisSolution,
      northStar: args.northStar ?? existing?.northStar,
      metrics: args.metrics ? optionalStrings(args.metrics) : (existing?.metrics ?? []),
      constraints: args.constraints ? optionalStrings(args.constraints) : (existing?.constraints ?? []),
      notBuilding: args.notBuilding ? optionalStrings(args.notBuilding) : (existing?.notBuilding ?? []),
      competitors: args.competitors ?? existing?.competitors ?? [],
      repoFullName: args.repoFullName ?? existing?.repoFullName,
      repoUrl: args.repoUrl ?? existing?.repoUrl,
      productUrl: args.productUrl ?? existing?.productUrl,
      docs: args.docs ? mergeStringArray(optionalStrings(args.docs), existing?.docs) : (existing?.docs ?? []),
      environments: args.environments ? mergeStringArray(optionalStrings(args.environments), existing?.environments) : (existing?.environments ?? []),
      tags: args.tags ? mergeStringArray(optionalStrings(args.tags), existing?.tags) : (existing?.tags ?? []),
      source,
      repoPath: args.repoPath ?? existing?.repoPath,
      lastActivityAt: args.lastActivityAt ?? existing?.lastActivityAt,
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

export const updateTaskTriage = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    taskId: v.id("portfolioTasks"),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const existing = await ctx.db.get(args.taskId);
    if (!existing || existing.userId !== user._id) throw new Error("Task not found");

    const now = Date.now();
    const status = normalizeTaskStatus(args.status, existing.status);
    const priority = normalizeTaskPriority(args.priority, existing.priority);
    const patch: Partial<Doc<"portfolioTasks">> = {
      updatedAt: now,
    };

    if (args.status !== undefined) {
      patch.status = status;
      patch.completedAt = status === "done" ? (existing.completedAt ?? now) : undefined;
    }
    if (args.priority !== undefined) {
      patch.priority = priority;
    }

    await ctx.db.patch(args.taskId, patch);

    return {
      taskId: args.taskId,
      title: existing.title,
      description: existing.description,
      ownerType: existing.ownerType,
      ownerLabel: existing.ownerLabel,
      projectSlug: existing.projectSlug,
      status,
      priority,
      tags: existing.tags,
      updatedAt: now,
      completedAt: status === "done" ? (existing.completedAt ?? now) : undefined,
    };
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
