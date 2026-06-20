import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireOwner } from "./lib/auth";
import { redactSecretLikeText } from "./agentBus";

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
const PROJECT_FOCUS_STATUSES = ["unset", "top-priority", "focusing", "on-ice", "abandoned", "killed"] as const;
const PROJECT_MANUAL_STATUSES = ["active", "inactive"] as const;
const MACHINE_PROOF_STATUSES = ["ready", "warn", "failed"] as const;
const UPDATE_RUN_STATUSES = ["running", "success", "failed"] as const;
const UPDATE_STEP_STATUSES = ["running", "success", "failed", "skipped", "pending"] as const;
const MAX_ACTIVITY_FIELD_CHARS = 120;
const MAX_ACTIVITY_TITLE_CHARS = 180;
const MAX_ACTIVITY_DETAIL_CHARS = 1_500;
const AGENT_STACK_STALE_MS = 6 * 60 * 60 * 1000;

function normalizeTaskStatus(value: string | undefined, fallback: string): string {
  const next = value?.trim();
  return next && TASK_STATUSES.includes(next as typeof TASK_STATUSES[number]) ? next : fallback;
}

function normalizeTaskPriority(value: string | undefined, fallback: string): string {
  const next = value?.trim();
  return next && TASK_PRIORITIES.includes(next as typeof TASK_PRIORITIES[number]) ? next : fallback;
}

function normalizeProjectFocusStatus(value: string | undefined): typeof PROJECT_FOCUS_STATUSES[number] {
  const next = value?.trim();
  return next && PROJECT_FOCUS_STATUSES.includes(next as typeof PROJECT_FOCUS_STATUSES[number]) ? next as typeof PROJECT_FOCUS_STATUSES[number] : "unset";
}

function normalizeManualProjectStatus(value: string | undefined): typeof PROJECT_MANUAL_STATUSES[number] {
  const next = value?.trim().toLowerCase();
  return next && PROJECT_MANUAL_STATUSES.includes(next as typeof PROJECT_MANUAL_STATUSES[number])
    ? next as typeof PROJECT_MANUAL_STATUSES[number]
    : "active";
}

function agentStackCounts(row: Doc<"agentStackInventories">) {
  return {
    uniqueSkillNames: row.uniqueSkillNames,
    uniqueRealSkillFiles: row.uniqueRealSkillFiles,
    directExposureSkillRecords: row.directExposureSkillRecords,
    canonicalSkillFiles: row.canonicalSkillFiles,
    youmdCatalogSkills: row.youmdCatalogSkills,
    missingFromYoumdCatalog: row.missingFromYoumdCatalog,
    duplicateNameDifferentRealpaths: row.duplicateNameDifferentRealpaths,
    sameRealpathMirrors: row.sameRealpathMirrors,
    projectSignals: row.projectSignals,
  };
}

function compareAgentStackBaseline(a: Doc<"agentStackInventories">, b: Doc<"agentStackInventories">) {
  const aSafe = a.secretValuesExposed === false ? 1 : 0;
  const bSafe = b.secretValuesExposed === false ? 1 : 0;
  return (
    bSafe - aSafe ||
    b.uniqueSkillNames - a.uniqueSkillNames ||
    b.uniqueRealSkillFiles - a.uniqueRealSkillFiles ||
    b.directExposureSkillRecords - a.directExposureSkillRecords ||
    b.canonicalSkillFiles - a.canonicalSkillFiles ||
    b.sameRealpathMirrors - a.sameRealpathMirrors ||
    b.generatedAt - a.generatedAt ||
    b.updatedAt - a.updatedAt
  );
}

function buildAgentStackInventoryDrift(inventories: Doc<"agentStackInventories">[]) {
  const sorted = [...inventories].sort((a, b) => b.generatedAt - a.generatedAt || b.updatedAt - a.updatedAt);
  const baseline = [...inventories].sort(compareAgentStackBaseline)[0] ?? null;
  const displayRows = baseline
    ? [baseline, ...sorted.filter((row) => row.machineKey !== baseline.machineKey)]
    : sorted;
  const now = Date.now();
  const rows = baseline ? displayRows.map((row) => {
    const skillDelta = row.uniqueSkillNames - baseline.uniqueSkillNames;
    const fileDelta = row.uniqueRealSkillFiles - baseline.uniqueRealSkillFiles;
    const catalogGapDelta = row.missingFromYoumdCatalog - baseline.missingFromYoumdCatalog;
    const dryReviewDelta = row.duplicateNameDifferentRealpaths - baseline.duplicateNameDifferentRealpaths;
    const staleByMs = Math.max(0, baseline.generatedAt - row.generatedAt);
    const stale = now - row.updatedAt > AGENT_STACK_STALE_MS || staleByMs > AGENT_STACK_STALE_MS;
    const issues = [
      skillDelta < 0 ? `${Math.abs(skillDelta)} fewer skill names than baseline` : "",
      fileDelta < 0 ? `${Math.abs(fileDelta)} fewer real SKILL.md files than baseline` : "",
      catalogGapDelta > 0 ? `${catalogGapDelta} more You.md catalog gaps than baseline` : "",
      dryReviewDelta > 0 ? `${dryReviewDelta} more DRY review cases than baseline` : "",
      stale ? "inventory proof is stale" : "",
      row.secretValuesExposed ? "inventory reports secret exposure" : "",
    ].filter(Boolean);
    const status = row.secretValuesExposed
      ? "unsafe"
      : row.machineKey === baseline.machineKey
        ? "baseline"
        : issues.length > 0
          ? "drift"
          : skillDelta > 0 || fileDelta > 0
            ? "ahead"
            : "ok";
    const repairCommands = status === "baseline" ? [] : [
      "youmd pull",
      "youmd stack sync",
      "youmd skill sync",
      "youmd skill inventory --out-dir ~/.youmd/agent-stack-inventory --sync",
      "youmd machine verify --write-report --sync-report",
    ];
    return {
      machineKey: row.machineKey,
      hostName: row.hostName,
      rootDir: row.rootDir,
      generatedAt: row.generatedAt,
      updatedAt: row.updatedAt,
      counts: agentStackCounts(row),
      deltas: {
        uniqueSkillNames: skillDelta,
        uniqueRealSkillFiles: fileDelta,
        missingFromYoumdCatalog: catalogGapDelta,
        duplicateNameDifferentRealpaths: dryReviewDelta,
      },
      stale,
      staleByMs,
      status,
      issues,
      repairCommands,
      secretValuesExposed: row.secretValuesExposed === true,
    };
  }) : [];

  return {
    schemaVersion: "you-md/agent-stack-drift/v1",
    generatedAt: now,
    baseline: baseline ? {
      machineKey: baseline.machineKey,
      hostName: baseline.hostName,
      rootDir: baseline.rootDir,
      generatedAt: baseline.generatedAt,
      updatedAt: baseline.updatedAt,
      counts: agentStackCounts(baseline),
      selection: "best-complete-safe-snapshot",
    } : null,
    summary: {
      machineCount: sorted.length,
      driftCount: rows.filter((row) => row.status === "drift").length,
      staleCount: rows.filter((row) => row.stale).length,
      unsafeCount: rows.filter((row) => row.secretValuesExposed).length,
      okCount: rows.filter((row) => row.status === "ok" || row.status === "baseline" || row.status === "ahead").length,
    },
    machines: rows,
    secretValuesExposed: false as const,
  };
}

function projectFocusRank(status: string, suppliedRank?: number): number {
  if (Number.isFinite(suppliedRank)) return Math.max(0, Math.min(9, Math.round(suppliedRank!)));
  if (status === "top-priority") return 1;
  if (status === "focusing") return 2;
  if (status === "on-ice") return 3;
  if (status === "abandoned" || status === "killed") return 0;
  return 4;
}

function normalizeMachineProofStatus(value: string | undefined, fallback: string): string {
  const next = value?.trim();
  return next && MACHINE_PROOF_STATUSES.includes(next as typeof MACHINE_PROOF_STATUSES[number]) ? next : fallback;
}

function safeCount(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value!)) : 0;
}

function optionalSampleStrings(value: string[] | undefined, maxItems = 24): string[] {
  return optionalStrings(value)
    .map((item) => item.slice(0, 240))
    .slice(0, maxItems);
}

function normalizeUpdateRunStatus(value: string | undefined, fallback: string): string {
  const next = value?.trim();
  return next && UPDATE_RUN_STATUSES.includes(next as typeof UPDATE_RUN_STATUSES[number]) ? next : fallback;
}

function normalizeUpdateStepStatus(value: string | undefined, fallback: string): string {
  const next = value?.trim();
  return next && UPDATE_STEP_STATUSES.includes(next as typeof UPDATE_STEP_STATUSES[number]) ? next : fallback;
}

function cleanActivityText(value: string | undefined, fallback: string, maxChars: number): string {
  const cleaned = (value ?? fallback)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return redactSecretLikeText(cleaned || fallback).slice(0, maxChars);
}

function brainActivityStatus(value: string | undefined): "live" | "ok" | "warn" | "error" | "info" {
  if (value === "running" || value === "in_progress" || value === "open") return "live";
  if (value === "success" || value === "done" || value === "ready") return "ok";
  if (value === "failed" || value === "error" || value === "cancelled") return "error";
  if (value === "warn") return "warn";
  if (value === "pending" || value === "proposed" || value === "snoozed" || value === "skipped") return "warn";
  return "info";
}

async function recordBrainActivity(
  ctx: MutationCtx,
  fields: {
    userId: Id<"users">;
    activityId: string;
    source: string;
    kind: string;
    title: string;
    detail?: string;
    status?: string;
    projectSlug?: string;
    entityType?: string;
    entityId?: string;
    channel?: string;
    sourceHost?: string;
    sourceAgent?: string;
    sourceRuntime?: string;
    metadata?: Record<string, unknown>;
    occurredAt?: number;
  },
) {
  const now = Date.now();
  const activityId = cleanActivityText(fields.activityId, "activity", MAX_ACTIVITY_FIELD_CHARS);
  const existing = await ctx.db
    .query("brainActivities")
    .withIndex("by_userId_activityId", (q) => q.eq("userId", fields.userId).eq("activityId", activityId))
    .first();
  const patch = {
    source: cleanActivityText(fields.source, "portfolio", MAX_ACTIVITY_FIELD_CHARS),
    channel: fields.channel ? cleanActivityText(fields.channel, "", MAX_ACTIVITY_FIELD_CHARS) : undefined,
    kind: cleanActivityText(fields.kind, "event", MAX_ACTIVITY_FIELD_CHARS),
    title: cleanActivityText(fields.title, "portfolio activity", MAX_ACTIVITY_TITLE_CHARS),
    detail: fields.detail ? cleanActivityText(fields.detail, "", MAX_ACTIVITY_DETAIL_CHARS) : undefined,
    status: brainActivityStatus(fields.status ?? fields.kind),
    projectSlug: fields.projectSlug ? slugify(fields.projectSlug) : undefined,
    entityType: fields.entityType ? cleanActivityText(fields.entityType, "", MAX_ACTIVITY_FIELD_CHARS) : undefined,
    entityId: fields.entityId ? cleanActivityText(fields.entityId, "", MAX_ACTIVITY_FIELD_CHARS) : undefined,
    sourceHost: fields.sourceHost ? cleanActivityText(fields.sourceHost, "", MAX_ACTIVITY_FIELD_CHARS) : undefined,
    sourceAgent: fields.sourceAgent ? cleanActivityText(fields.sourceAgent, "", MAX_ACTIVITY_FIELD_CHARS) : undefined,
    sourceRuntime: fields.sourceRuntime ? cleanActivityText(fields.sourceRuntime, "", MAX_ACTIVITY_FIELD_CHARS) : undefined,
    metadata: fields.metadata,
    occurredAt: fields.occurredAt ?? now,
    updatedAt: now,
    secretValuesExposed: false,
  };

  if (existing) {
    await ctx.db.patch(existing._id, patch);
    return;
  }

  await ctx.db.insert("brainActivities", {
    userId: fields.userId,
    activityId,
    ...patch,
    createdAt: now,
  });
}

function taskActivityDetail(task: {
  ownerType: string;
  ownerLabel?: string;
  status: string;
  priority: string;
  projectSlug?: string;
}) {
  return [
    `owner ${task.ownerType}${task.ownerLabel ? `:${task.ownerLabel}` : ""}`,
    `status ${task.status}`,
    `priority ${task.priority}`,
    task.projectSlug ? `project ${task.projectSlug}` : "personal",
  ].join(" · ");
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
  docsUrls: v.optional(v.array(v.string())),
  integrationTypes: v.optional(v.array(v.string())),
  curlCommand: v.optional(v.string()),
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

const providerAccountValidator = v.object({
  provider: v.string(),
  category: v.optional(v.string()),
  loginHint: v.optional(v.string()),
  billingOwner: v.optional(v.string()),
  separationPolicy: v.optional(v.string()),
  encryptedStorage: v.optional(v.string()),
  vaultRef: v.optional(v.string()),
  projects: v.optional(v.array(v.string())),
  keyNameAliases: v.optional(v.array(v.string())),
  status: v.optional(v.string()),
  risk: v.optional(v.string()),
  monthlyCostUsd: v.optional(v.number()),
  notes: v.optional(v.string()),
  source: v.optional(v.string()),
});

const reusablePatternValidator = v.object({
  slug: v.string(),
  name: v.string(),
  status: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
  techStacks: v.optional(v.array(v.string())),
  canonicalOwnerProject: v.optional(v.string()),
  summary: v.string(),
  sourcePaths: v.optional(v.array(v.string())),
  usageProjects: v.optional(v.array(v.string())),
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

function mergeLimitedStringArray(
  primary: string[] | undefined,
  fallback: string[] | undefined,
  limit = 40
): string[] {
  return mergeStringArray(primary, fallback).slice(0, limit);
}

function normalizePatternStatus(value: string | undefined, fallback: string): string {
  const next = value?.trim();
  if (next === "canonical" || next === "candidate" || next === "deprecated") return next;
  return fallback;
}

function normalizeProviderAccountStatus(value: string | undefined, fallback = "active"): string {
  const next = value?.trim();
  if (next === "active" || next === "audit" || next === "needs-split" || next === "archived") return next;
  return fallback;
}

function normalizeRisk(value: string | undefined, fallback = "medium"): string {
  const next = value?.trim();
  if (next === "low" || next === "medium" || next === "high") return next;
  return fallback;
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

export const updateProjectFocus = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    projectSlug: v.string(),
    focusStatus: v.string(),
    focusRank: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const slug = slugify(args.projectSlug);
    const project = await ctx.db
      .query("portfolioProjects")
      .withIndex("by_userId_slug", (q) => q.eq("userId", user._id).eq("slug", slug))
      .first();
    if (!project) throw new Error("Project not found");

    const focusStatus = normalizeProjectFocusStatus(args.focusStatus);
    const focusRank = projectFocusRank(focusStatus, args.focusRank);
    await ctx.db.patch(project._id, {
      focusStatus,
      focusRank,
      updatedAt: Date.now(),
    });

    return {
      projectId: project._id,
      projectSlug: slug,
      focusStatus,
      focusRank,
    };
  },
});

export const updateProjectStatus = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    projectSlug: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const slug = slugify(args.projectSlug);
    const project = await ctx.db
      .query("portfolioProjects")
      .withIndex("by_userId_slug", (q) => q.eq("userId", user._id).eq("slug", slug))
      .first();
    if (!project) throw new Error("Project not found");

    const status = normalizeManualProjectStatus(args.status);
    const now = Date.now();
    await ctx.db.patch(project._id, {
      status,
      statusSource: "manual",
      statusUpdatedAt: now,
      updatedAt: now,
    });

    return {
      projectId: project._id,
      projectSlug: slug,
      status,
      statusSource: "manual",
      statusUpdatedAt: now,
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
        status: existing?.statusSource === "manual" ? existing.status : project.status,
        statusSource: existing?.statusSource === "manual" ? existing.statusSource : existing?.statusSource ?? "dashboard-bootstrap",
        statusUpdatedAt: existing?.statusSource === "manual" ? existing.statusUpdatedAt : existing?.statusUpdatedAt ?? now,
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
        docsUrls: optionalStrings(surface.docsUrls),
        integrationTypes: optionalStrings(surface.integrationTypes),
        curlCommand: nonEmpty(surface.curlCommand),
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
      const inferredStatus = statusFromPushedAt(trackedProject.pushedAt);
      const statusWasManual = existing?.statusSource === "manual";
      const status = statusWasManual
        ? existing.status
        : existingIsBootstrap
          ? inferredStatus
          : existing?.status ?? inferredStatus;

      const row = {
        userId: user._id,
        slug,
        name: trackedProject.name,
        stackName: existingIsBootstrap
          ? nonEmpty(trackedProject.stackName) ?? nonEmpty(existing?.stackName) ?? "Project Stack"
          : nonEmpty(existing?.stackName) ?? nonEmpty(trackedProject.stackName) ?? "Project Stack",
        status,
        statusSource: statusWasManual ? existing.statusSource : existing?.statusSource ?? "github-tracked",
        statusUpdatedAt: statusWasManual ? existing.statusUpdatedAt : existing?.statusUpdatedAt ?? now,
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

export const upsertReusablePatternBatch = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    patterns: v.array(reusablePatternValidator),
  },
  handler: async (ctx, args) => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const now = Date.now();
    const counts = {
      received: args.patterns.length,
      upserted: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      patterns: [] as Array<{ slug: string; name: string; created: boolean }>,
    };

    for (const pattern of args.patterns.slice(0, 80)) {
      const slug = slugify(pattern.slug || pattern.name);
      const name = pattern.name.trim();
      const summary = pattern.summary.trim();
      if (!slug || !name || !summary) {
        counts.skipped += 1;
        continue;
      }

      const existing = await ctx.db
        .query("portfolioReusablePatterns")
        .withIndex("by_userId_slug", (q) => q.eq("userId", user._id).eq("slug", slug))
        .first();

      const status = existing?.status === "canonical"
        ? "canonical"
        : normalizePatternStatus(pattern.status, existing?.status ?? "candidate");
      const row = {
        userId: user._id,
        slug,
        name,
        status,
        tags: mergeLimitedStringArray(pattern.tags, existing?.tags, 24),
        techStacks: mergeLimitedStringArray(pattern.techStacks, existing?.techStacks, 20),
        canonicalOwnerProject: slugify(
          pattern.canonicalOwnerProject ?? existing?.canonicalOwnerProject ?? pattern.usageProjects?.[0] ?? "youmd"
        ),
        summary,
        sourcePaths: pattern.sourcePaths && pattern.sourcePaths.length > 0
          ? mergeLimitedStringArray(pattern.sourcePaths, undefined, 40)
          : existing?.sourcePaths ?? [],
        usageProjects: pattern.usageProjects && pattern.usageProjects.length > 0
          ? mergeLimitedStringArray(pattern.usageProjects.map(slugify), undefined, 80)
          : existing?.usageProjects ?? [],
        updatedAt: now,
      };

      if (existing) {
        await ctx.db.patch(existing._id, row);
        counts.updated += 1;
        counts.patterns.push({ slug, name, created: false });
      } else {
        await ctx.db.insert("portfolioReusablePatterns", { ...row, createdAt: now });
        counts.created += 1;
        counts.patterns.push({ slug, name, created: true });
      }
      counts.upserted += 1;
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

    const [ownedSurfaces, dependencyEdges, reusablePatterns, tasks, activities, providerAccounts] = await Promise.all([
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
      ctx.db
        .query("portfolioProviderAccounts")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect(),
    ]);

    return {
      project,
      trackedProject: trackedMatch,
      ownedSurfaces,
      dependencyEdges,
      providerAccounts: providerAccounts.filter((account) => account.projects.includes(slug)),
      reusablePatterns: reusablePatterns.filter((pattern) => pattern.usageProjects.includes(slug)),
      tasks: tasks.filter((task) => task.status !== "done" && task.status !== "cancelled"),
      activities: activities.sort((a, b) => b.occurredAt - a.occurredAt).slice(0, 80),
      readiness: project || trackedMatch
        ? { ready: true, reason: "Project portfolio slice is available." }
        : { ready: false, reason: "No persisted portfolio slice found for this project yet." },
    };
  },
});

export const listProviderAccounts = query({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    return (await ctx.db
      .query("portfolioProviderAccounts")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect())
      .sort((a, b) => {
        if (a.risk !== b.risk) return (b.risk === "high" ? 1 : 0) - (a.risk === "high" ? 1 : 0);
        return a.provider.localeCompare(b.provider);
      });
  },
});

export const upsertProviderAccount = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    provider: v.string(),
    category: v.optional(v.string()),
    loginHint: v.optional(v.string()),
    billingOwner: v.optional(v.string()),
    separationPolicy: v.optional(v.string()),
    encryptedStorage: v.optional(v.string()),
    vaultRef: v.optional(v.string()),
    projects: v.optional(v.array(v.string())),
    keyNameAliases: v.optional(v.array(v.string())),
    status: v.optional(v.string()),
    risk: v.optional(v.string()),
    monthlyCostUsd: v.optional(v.number()),
    notes: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ accountId: Id<"portfolioProviderAccounts">; created: boolean }> => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const provider = args.provider.trim().slice(0, 160);
    if (!provider) throw new Error("Provider is required");
    const slug = slugify(provider);
    const existing = await ctx.db
      .query("portfolioProviderAccounts")
      .withIndex("by_userId_slug", (q) => q.eq("userId", user._id).eq("slug", slug))
      .first();
    const now = Date.now();
    const row = {
      userId: user._id,
      slug,
      provider,
      category: args.category?.trim().slice(0, 60) || existing?.category || "other",
      loginHint: args.loginHint?.trim().slice(0, 240) || existing?.loginHint,
      billingOwner: args.billingOwner?.trim().slice(0, 180) || existing?.billingOwner,
      separationPolicy: args.separationPolicy?.trim().slice(0, 420) || existing?.separationPolicy,
      encryptedStorage: args.encryptedStorage?.trim().slice(0, 360) || existing?.encryptedStorage,
      vaultRef: args.vaultRef?.trim().slice(0, 240) || existing?.vaultRef,
      projects: args.projects ? optionalStrings(args.projects).map(slugify).slice(0, 80) : (existing?.projects ?? []),
      keyNameAliases: args.keyNameAliases ? optionalStrings(args.keyNameAliases).slice(0, 80) : (existing?.keyNameAliases ?? []),
      status: normalizeProviderAccountStatus(args.status, existing?.status ?? "active"),
      risk: normalizeRisk(args.risk, existing?.risk ?? "medium"),
      monthlyCostUsd: args.monthlyCostUsd ?? existing?.monthlyCostUsd,
      notes: args.notes?.trim().slice(0, 600) || existing?.notes,
      source: args.source?.trim().slice(0, 80) || existing?.source || "manual",
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, row);
      return { accountId: existing._id, created: false };
    }

    const accountId = await ctx.db.insert("portfolioProviderAccounts", { ...row, createdAt: now });
    return { accountId, created: true };
  },
});

export const syncProviderAccountSeed = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    accounts: v.array(providerAccountValidator),
  },
  handler: async (ctx, args) => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const now = Date.now();
    const counts = {
      received: args.accounts.length,
      created: 0,
      updated: 0,
      skipped: 0,
      accounts: [] as Array<{ slug: string; provider: string; created: boolean }>,
    };

    for (const account of args.accounts.slice(0, 80)) {
      const provider = account.provider.trim().slice(0, 160);
      if (!provider) {
        counts.skipped += 1;
        continue;
      }
      const slug = slugify(provider);
      const existing = await ctx.db
        .query("portfolioProviderAccounts")
        .withIndex("by_userId_slug", (q) => q.eq("userId", user._id).eq("slug", slug))
        .first();
      const row = {
        userId: user._id,
        slug,
        provider,
        category: account.category?.trim().slice(0, 60) || existing?.category || "other",
        loginHint: account.loginHint?.trim().slice(0, 240) || existing?.loginHint,
        billingOwner: account.billingOwner?.trim().slice(0, 180) || existing?.billingOwner,
        separationPolicy: account.separationPolicy?.trim().slice(0, 420) || existing?.separationPolicy,
        encryptedStorage: account.encryptedStorage?.trim().slice(0, 360) || existing?.encryptedStorage,
        vaultRef: account.vaultRef?.trim().slice(0, 240) || existing?.vaultRef,
        projects: account.projects ? optionalStrings(account.projects).map(slugify).slice(0, 80) : (existing?.projects ?? []),
        keyNameAliases: account.keyNameAliases ? optionalStrings(account.keyNameAliases).slice(0, 80) : (existing?.keyNameAliases ?? []),
        status: normalizeProviderAccountStatus(account.status, existing?.status ?? "active"),
        risk: normalizeRisk(account.risk, existing?.risk ?? "medium"),
        monthlyCostUsd: account.monthlyCostUsd ?? existing?.monthlyCostUsd,
        notes: account.notes?.trim().slice(0, 600) || existing?.notes,
        source: account.source?.trim().slice(0, 80) || existing?.source || "dashboard-seed",
        updatedAt: now,
      };

      if (existing) {
        await ctx.db.patch(existing._id, row);
        counts.updated += 1;
        counts.accounts.push({ slug, provider, created: false });
      } else {
        await ctx.db.insert("portfolioProviderAccounts", { ...row, createdAt: now });
        counts.created += 1;
        counts.accounts.push({ slug, provider, created: true });
      }
    }

    return counts;
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
    const preserveManualStatus = existing?.statusSource === "manual" && source !== "manual";
    const status = preserveManualStatus
      ? existing.status
      : args.status ?? existing?.status ?? "active";
    const row = {
      userId: user._id,
      slug,
      name: args.name.trim(),
      stackName: args.stackName ?? existing?.stackName,
      status,
      statusSource: preserveManualStatus
        ? existing.statusSource
        : args.status
          ? (source === "manual" ? "manual" : existing?.statusSource ?? source)
          : existing?.statusSource,
      statusUpdatedAt: preserveManualStatus
        ? existing.statusUpdatedAt
        : args.status
          ? now
          : existing?.statusUpdatedAt,
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
      await recordBrainActivity(ctx, {
        userId: user._id,
        activityId: `task:${args.taskId}`,
        source: "task",
        kind: row.status,
        title: `task updated: ${row.title}`,
        detail: taskActivityDetail(row),
        status: row.status,
        projectSlug: row.projectSlug,
        entityType: "portfolioTask",
        entityId: String(args.taskId),
        sourceAgent: row.sourceType,
        metadata: {
          taskId: String(args.taskId),
          ownerType: row.ownerType,
          priority: row.priority,
          sourceType: row.sourceType,
        },
        occurredAt: now,
      });
      return { taskId: args.taskId, created: false };
    }

    const taskId = await ctx.db.insert("portfolioTasks", {
      ...row,
      createdAt: now,
    });
    await recordBrainActivity(ctx, {
      userId: user._id,
      activityId: `task:${taskId}`,
      source: "task",
      kind: row.status,
      title: `task created: ${row.title}`,
      detail: taskActivityDetail(row),
      status: row.status,
      projectSlug: row.projectSlug,
      entityType: "portfolioTask",
      entityId: String(taskId),
      sourceAgent: row.sourceType,
      metadata: {
        taskId: String(taskId),
        ownerType: row.ownerType,
        priority: row.priority,
        sourceType: row.sourceType,
      },
      occurredAt: now,
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
    await recordBrainActivity(ctx, {
      userId: user._id,
      activityId: `task:${args.taskId}`,
      source: "task",
      kind: status,
      title: `task triaged: ${existing.title}`,
      detail: taskActivityDetail({
        ownerType: existing.ownerType,
        ownerLabel: existing.ownerLabel,
        status,
        priority,
        projectSlug: existing.projectSlug,
      }),
      status,
      projectSlug: existing.projectSlug,
      entityType: "portfolioTask",
      entityId: String(args.taskId),
      sourceAgent: "portfolio-triage",
      metadata: {
        taskId: String(args.taskId),
        changedStatus: args.status !== undefined,
        changedPriority: args.priority !== undefined,
        ownerType: existing.ownerType,
      },
      occurredAt: now,
    });

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

export const updateTaskDetails = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    taskId: v.id("portfolioTasks"),
    projectSlug: v.optional(v.union(v.string(), v.null())),
    title: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    ownerType: v.optional(v.union(v.literal("human"), v.literal("agent"))),
    ownerLabel: v.optional(v.union(v.string(), v.null())),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    dueAt: v.optional(v.union(v.number(), v.null())),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const existing = await ctx.db.get(args.taskId);
    if (!existing || existing.userId !== user._id) throw new Error("Task not found");

    const now = Date.now();
    const patch: Partial<Doc<"portfolioTasks">> = {
      updatedAt: now,
    };

    if (args.projectSlug !== undefined) {
      patch.projectSlug = args.projectSlug === null ? undefined : slugify(args.projectSlug);
    }
    if (args.title !== undefined) {
      const title = args.title.trim();
      if (!title) throw new Error("Task title cannot be blank");
      patch.title = title;
    }
    if (args.description !== undefined) {
      patch.description = args.description === null ? undefined : args.description.trim() || undefined;
    }
    if (args.ownerType !== undefined) {
      patch.ownerType = args.ownerType;
    }
    if (args.ownerLabel !== undefined) {
      patch.ownerLabel = args.ownerLabel === null ? undefined : args.ownerLabel.trim() || undefined;
    }
    if (args.status !== undefined) {
      const status = normalizeTaskStatus(args.status, existing.status);
      patch.status = status;
      patch.completedAt = status === "done" ? (existing.completedAt ?? now) : undefined;
    }
    if (args.priority !== undefined) {
      patch.priority = normalizeTaskPriority(args.priority, existing.priority);
    }
    if (args.dueAt !== undefined) {
      patch.dueAt = args.dueAt === null ? undefined : args.dueAt;
    }
    if (args.tags !== undefined) {
      patch.tags = optionalStrings(args.tags);
    }

    await ctx.db.patch(args.taskId, patch);
    const updated = {
      ...existing,
      ...patch,
      _id: existing._id,
      _creationTime: existing._creationTime,
    };
    await recordBrainActivity(ctx, {
      userId: user._id,
      activityId: `task:${args.taskId}`,
      source: "task",
      kind: updated.status,
      title: `task updated: ${updated.title}`,
      detail: taskActivityDetail(updated),
      status: updated.status,
      projectSlug: updated.projectSlug,
      entityType: "portfolioTask",
      entityId: String(args.taskId),
      sourceAgent: "portfolio-update",
      metadata: {
        taskId: String(args.taskId),
        changedProject: args.projectSlug !== undefined,
        changedOwner: args.ownerType !== undefined || args.ownerLabel !== undefined,
        changedStatus: args.status !== undefined,
        changedPriority: args.priority !== undefined,
      },
      occurredAt: now,
    });

    return {
      taskId: args.taskId,
      title: updated.title,
      description: updated.description,
      ownerType: updated.ownerType,
      ownerLabel: updated.ownerLabel,
      projectSlug: updated.projectSlug,
      status: updated.status,
      priority: updated.priority,
      dueAt: updated.dueAt,
      tags: updated.tags,
      updatedAt: now,
      completedAt: updated.completedAt,
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
      await recordBrainActivity(ctx, {
        userId: user._id,
        activityId: `task:${taskId}`,
        source: "task",
        kind: task.status ?? "proposed",
        title: `task proposed: ${task.title.trim()}`,
        detail: taskActivityDetail({
          ownerType: task.ownerType,
          ownerLabel: task.ownerLabel,
          status: task.status ?? "proposed",
          priority: task.priority ?? "normal",
          projectSlug: task.projectSlug ? slugify(task.projectSlug) : projectSlugs[0],
        }),
        status: task.status ?? "proposed",
        projectSlug: task.projectSlug ? slugify(task.projectSlug) : projectSlugs[0],
        entityType: "portfolioTask",
        entityId: String(taskId),
        sourceAgent: "braindump-router",
        metadata: {
          taskId: String(taskId),
          captureId: String(captureId),
          source: args.source,
        },
        occurredAt: now,
      });
    }

    await recordBrainActivity(ctx, {
      userId: user._id,
      activityId: `braindump:${captureId}`,
      source: "braindump",
      kind: "capture",
      title: `${args.source} brain dump captured`,
      detail: args.summary ?? `${taskIds.length} proposed task${taskIds.length === 1 ? "" : "s"} extracted`,
      status: taskIds.length > 0 ? "proposed" : "info",
      projectSlug: projectSlugs[0],
      entityType: "brainDumpCapture",
      entityId: String(captureId),
      sourceAgent: "braindump-router",
      metadata: {
        captureId: String(captureId),
        source: args.source,
        projectCount: projectSlugs.length,
        taskCount: taskIds.length,
        tagCount: optionalStrings(args.tags).length,
      },
      occurredAt: now,
    });

    return { captureId, taskIds };
  },
});

export const upsertMachineProof = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    machineKey: v.optional(v.string()),
    hostName: v.string(),
    platform: v.optional(v.string()),
    rootDir: v.string(),
    proofSchemaVersion: v.optional(v.number()),
    status: v.string(),
    scanned: v.number(),
    ready: v.number(),
    needsEnv: v.number(),
    partial: v.number(),
    installPassed: v.number(),
    checksPassed: v.number(),
    serversPassed: v.number(),
    failures: v.number(),
    warnings: v.optional(v.array(v.string())),
    secretValuesExposed: v.boolean(),
    reportPath: v.optional(v.string()),
    source: v.optional(v.string()),
    agentName: v.optional(v.string()),
    generatedAt: v.number(),
  },
  handler: async (ctx, args): Promise<{ proofId: Id<"machineProofReports">; created: boolean }> => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const now = Date.now();
    const hostName = args.hostName.trim().slice(0, 180) || "unknown-host";
    const rootDir = args.rootDir.trim().slice(0, 700) || "unknown-root";
    const machineKey = slugify(args.machineKey ?? `${hostName}-${rootDir}`);
    const existing = await ctx.db
      .query("machineProofReports")
      .withIndex("by_userId_machineKey", (q) => q.eq("userId", user._id).eq("machineKey", machineKey))
      .first();

    const row = {
      userId: user._id,
      machineKey,
      hostName,
      platform: args.platform?.trim().slice(0, 180),
      rootDir,
      proofSchemaVersion: args.proofSchemaVersion,
      status: normalizeMachineProofStatus(args.status, "warn"),
      scanned: Math.max(0, Math.trunc(args.scanned)),
      ready: Math.max(0, Math.trunc(args.ready)),
      needsEnv: Math.max(0, Math.trunc(args.needsEnv)),
      partial: Math.max(0, Math.trunc(args.partial)),
      installPassed: Math.max(0, Math.trunc(args.installPassed)),
      checksPassed: Math.max(0, Math.trunc(args.checksPassed)),
      serversPassed: Math.max(0, Math.trunc(args.serversPassed)),
      failures: Math.max(0, Math.trunc(args.failures)),
      warnings: optionalStrings(args.warnings).slice(0, 12),
      secretValuesExposed: args.secretValuesExposed,
      reportPath: args.reportPath?.trim().slice(0, 700),
      source: args.source?.trim().slice(0, 80) || "cli",
      agentName: args.agentName?.trim().slice(0, 160),
      generatedAt: Number.isFinite(args.generatedAt) ? args.generatedAt : now,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, row);
      await recordBrainActivity(ctx, {
        userId: user._id,
        activityId: `machine-proof:${machineKey}`,
        source: "machine",
        channel: "machine-proof",
        kind: row.status,
        title: `${hostName} machine proof ${row.status}`,
        detail: `${row.ready}/${row.scanned} projects ready · ${row.needsEnv} need env · ${row.failures} failures`,
        status: row.status,
        entityType: "machineProofReport",
        entityId: String(existing._id),
        sourceHost: hostName,
        sourceAgent: row.agentName ?? row.source,
        metadata: {
          machineKey,
          rootDir,
          platform: row.platform,
          scanned: row.scanned,
          ready: row.ready,
          needsEnv: row.needsEnv,
          partial: row.partial,
          installPassed: row.installPassed,
          checksPassed: row.checksPassed,
          serversPassed: row.serversPassed,
          failures: row.failures,
          warningCount: row.warnings.length,
          proofSecretValuesExposed: row.secretValuesExposed === true,
        },
        occurredAt: row.generatedAt,
      });
      return { proofId: existing._id, created: false };
    }

    const proofId = await ctx.db.insert("machineProofReports", {
      ...row,
      createdAt: now,
    });
    await recordBrainActivity(ctx, {
      userId: user._id,
      activityId: `machine-proof:${machineKey}`,
      source: "machine",
      channel: "machine-proof",
      kind: row.status,
      title: `${hostName} machine proof ${row.status}`,
      detail: `${row.ready}/${row.scanned} projects ready · ${row.needsEnv} need env · ${row.failures} failures`,
      status: row.status,
      entityType: "machineProofReport",
      entityId: String(proofId),
      sourceHost: hostName,
      sourceAgent: row.agentName ?? row.source,
      metadata: {
        machineKey,
        rootDir,
        platform: row.platform,
        scanned: row.scanned,
        ready: row.ready,
        needsEnv: row.needsEnv,
        partial: row.partial,
        installPassed: row.installPassed,
        checksPassed: row.checksPassed,
        serversPassed: row.serversPassed,
        failures: row.failures,
        warningCount: row.warnings.length,
        proofSecretValuesExposed: row.secretValuesExposed === true,
      },
      occurredAt: row.generatedAt,
    });
    return { proofId, created: true };
  },
});

export const listMachineProofs = query({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const limit = Math.max(1, Math.min(Number(args.limit ?? 12), 50));
    return await ctx.db
      .query("machineProofReports")
      .withIndex("by_userId_generatedAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);
  },
});

export const upsertAgentStackInventory = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    machineKey: v.optional(v.string()),
    hostName: v.string(),
    platform: v.optional(v.string()),
    rootDir: v.string(),
    inventorySchemaVersion: v.optional(v.string()),
    uniqueSkillNames: v.number(),
    uniqueRealSkillFiles: v.number(),
    directExposureSkillRecords: v.number(),
    canonicalSkillFiles: v.number(),
    youmdCatalogSkills: v.number(),
    missingFromYoumdCatalog: v.number(),
    duplicateNameDifferentRealpaths: v.number(),
    sameRealpathMirrors: v.number(),
    projectSignals: v.number(),
    ownershipRollup: v.optional(v.any()),
    syncPolicyRollup: v.optional(v.any()),
    provenanceRollup: v.optional(v.any()),
    missingCatalogSamples: v.optional(v.array(v.string())),
    duplicateNameSamples: v.optional(v.array(v.string())),
    mirrorSamples: v.optional(v.array(v.string())),
    reportJsonPath: v.optional(v.string()),
    reportHtmlPath: v.optional(v.string()),
    source: v.optional(v.string()),
    agentName: v.optional(v.string()),
    secretValuesExposed: v.boolean(),
    generatedAt: v.number(),
  },
  handler: async (ctx, args): Promise<{ inventoryId: Id<"agentStackInventories">; created: boolean }> => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const now = Date.now();
    const hostName = args.hostName.trim().slice(0, 180) || "unknown-host";
    const rootDir = args.rootDir.trim().slice(0, 700) || "unknown-root";
    const machineKey = slugify(args.machineKey ?? `${hostName}-${rootDir}-agent-stack`);
    const existing = await ctx.db
      .query("agentStackInventories")
      .withIndex("by_userId_machineKey", (q) => q.eq("userId", user._id).eq("machineKey", machineKey))
      .first();

    const row = {
      userId: user._id,
      machineKey,
      hostName,
      platform: args.platform?.trim().slice(0, 180),
      rootDir,
      inventorySchemaVersion: args.inventorySchemaVersion?.trim().slice(0, 80),
      uniqueSkillNames: safeCount(args.uniqueSkillNames),
      uniqueRealSkillFiles: safeCount(args.uniqueRealSkillFiles),
      directExposureSkillRecords: safeCount(args.directExposureSkillRecords),
      canonicalSkillFiles: safeCount(args.canonicalSkillFiles),
      youmdCatalogSkills: safeCount(args.youmdCatalogSkills),
      missingFromYoumdCatalog: safeCount(args.missingFromYoumdCatalog),
      duplicateNameDifferentRealpaths: safeCount(args.duplicateNameDifferentRealpaths),
      sameRealpathMirrors: safeCount(args.sameRealpathMirrors),
      projectSignals: safeCount(args.projectSignals),
      ownershipRollup: args.ownershipRollup ?? {},
      syncPolicyRollup: args.syncPolicyRollup ?? {},
      provenanceRollup: args.provenanceRollup ?? {},
      missingCatalogSamples: optionalSampleStrings(args.missingCatalogSamples, 40),
      duplicateNameSamples: optionalSampleStrings(args.duplicateNameSamples, 40),
      mirrorSamples: optionalSampleStrings(args.mirrorSamples, 40),
      reportJsonPath: args.reportJsonPath?.trim().slice(0, 700),
      reportHtmlPath: args.reportHtmlPath?.trim().slice(0, 700),
      source: args.source?.trim().slice(0, 80) || "cli",
      agentName: args.agentName?.trim().slice(0, 160),
      secretValuesExposed: args.secretValuesExposed,
      generatedAt: Number.isFinite(args.generatedAt) ? args.generatedAt : now,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, row);
      await recordBrainActivity(ctx, {
        userId: user._id,
        activityId: `agent-stack-inventory:${machineKey}`,
        source: "skill",
        channel: "agent-stack-inventory",
        kind: row.missingFromYoumdCatalog > 0 || row.duplicateNameDifferentRealpaths > 0 ? "warn" : "synced",
        title: `${hostName} agent stack inventory synced`,
        detail: `${row.uniqueSkillNames} skills · ${row.youmdCatalogSkills} cataloged · ${row.missingFromYoumdCatalog} catalog gaps · ${row.duplicateNameDifferentRealpaths} DRY reviews`,
        status: row.missingFromYoumdCatalog > 0 || row.duplicateNameDifferentRealpaths > 0 ? "warn" : "ok",
        entityType: "agentStackInventory",
        entityId: String(existing._id),
        sourceHost: hostName,
        sourceAgent: row.agentName ?? row.source,
        metadata: {
          machineKey,
          rootDir,
          platform: row.platform,
          uniqueSkillNames: row.uniqueSkillNames,
          uniqueRealSkillFiles: row.uniqueRealSkillFiles,
          directExposureSkillRecords: row.directExposureSkillRecords,
          youmdCatalogSkills: row.youmdCatalogSkills,
          missingFromYoumdCatalog: row.missingFromYoumdCatalog,
          duplicateNameDifferentRealpaths: row.duplicateNameDifferentRealpaths,
          sameRealpathMirrors: row.sameRealpathMirrors,
          projectSignals: row.projectSignals,
          inventorySecretValuesExposed: row.secretValuesExposed === true,
        },
        occurredAt: row.generatedAt,
      });
      return { inventoryId: existing._id, created: false };
    }

    const inventoryId = await ctx.db.insert("agentStackInventories", {
      ...row,
      createdAt: now,
    });
    await recordBrainActivity(ctx, {
      userId: user._id,
      activityId: `agent-stack-inventory:${machineKey}`,
      source: "skill",
      channel: "agent-stack-inventory",
      kind: row.missingFromYoumdCatalog > 0 || row.duplicateNameDifferentRealpaths > 0 ? "warn" : "synced",
      title: `${hostName} agent stack inventory synced`,
      detail: `${row.uniqueSkillNames} skills · ${row.youmdCatalogSkills} cataloged · ${row.missingFromYoumdCatalog} catalog gaps · ${row.duplicateNameDifferentRealpaths} DRY reviews`,
      status: row.missingFromYoumdCatalog > 0 || row.duplicateNameDifferentRealpaths > 0 ? "warn" : "ok",
      entityType: "agentStackInventory",
      entityId: String(inventoryId),
      sourceHost: hostName,
      sourceAgent: row.agentName ?? row.source,
      metadata: {
        machineKey,
        rootDir,
        platform: row.platform,
        uniqueSkillNames: row.uniqueSkillNames,
        uniqueRealSkillFiles: row.uniqueRealSkillFiles,
        directExposureSkillRecords: row.directExposureSkillRecords,
        youmdCatalogSkills: row.youmdCatalogSkills,
        missingFromYoumdCatalog: row.missingFromYoumdCatalog,
        duplicateNameDifferentRealpaths: row.duplicateNameDifferentRealpaths,
        sameRealpathMirrors: row.sameRealpathMirrors,
        projectSignals: row.projectSignals,
        inventorySecretValuesExposed: row.secretValuesExposed === true,
      },
      occurredAt: row.generatedAt,
    });
    return { inventoryId, created: true };
  },
});

export const listAgentStackInventories = query({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const limit = Math.max(1, Math.min(Number(args.limit ?? 12), 50));
    return await ctx.db
      .query("agentStackInventories")
      .withIndex("by_userId_generatedAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);
  },
});

export const getAgentStackInventoryDrift = query({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const limit = Math.max(1, Math.min(Number(args.limit ?? 12), 50));
    const inventories = await ctx.db
      .query("agentStackInventories")
      .withIndex("by_userId_generatedAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);
    return buildAgentStackInventoryDrift(inventories);
  },
});

export const startRepoUpdateRun = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    source: v.string(),
    trigger: v.string(),
    actorLabel: v.optional(v.string()),
    repoFullName: v.optional(v.string()),
    branch: v.optional(v.string()),
    summary: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ runId: Id<"repoUpdateRuns"> }> => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const now = Date.now();
    const runId = await ctx.db.insert("repoUpdateRuns", {
      userId: user._id,
      source: args.source,
      trigger: args.trigger,
      actorLabel: args.actorLabel,
      repoFullName: nonEmpty(args.repoFullName),
      branch: nonEmpty(args.branch),
      status: "running",
      summary: args.summary,
      pushedFiles: [],
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await recordBrainActivity(ctx, {
      userId: user._id,
      activityId: `repo-update:${runId}`,
      source: "repo",
      kind: "running",
      title: "repo update started",
      detail: args.summary ?? `${args.trigger} from ${args.source}`,
      status: "running",
      entityType: "repoUpdateRun",
      entityId: String(runId),
      sourceAgent: args.actorLabel,
      metadata: {
        runId: String(runId),
        trigger: args.trigger,
        repoFullName: args.repoFullName,
        branch: args.branch,
      },
      occurredAt: now,
    });
    return { runId };
  },
});

export const appendRepoUpdateStep = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    runId: v.id("repoUpdateRuns"),
    order: v.number(),
    stepKey: v.string(),
    label: v.string(),
    status: v.string(),
    detail: v.optional(v.string()),
    metadata: v.optional(v.any()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ stepId: Id<"repoUpdateSteps"> }> => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const run = await ctx.db.get(args.runId);
    if (!run || run.userId !== user._id) throw new Error("Repo update run not found");
    const now = Date.now();
    const stepId = await ctx.db.insert("repoUpdateSteps", {
      userId: user._id,
      runId: args.runId,
      order: args.order,
      stepKey: args.stepKey,
      label: args.label,
      status: normalizeUpdateStepStatus(args.status, "running"),
      detail: args.detail,
      metadata: args.metadata,
      startedAt: args.startedAt,
      completedAt: args.completedAt,
      createdAt: now,
      updatedAt: now,
    });
    const status = normalizeUpdateStepStatus(args.status, "running");
    await recordBrainActivity(ctx, {
      userId: user._id,
      activityId: `repo-update:${args.runId}:step:${args.order}:${args.stepKey}`,
      source: "repo",
      kind: status,
      title: args.label,
      detail: args.detail,
      status,
      entityType: "repoUpdateStep",
      entityId: String(stepId),
      sourceAgent: run.actorLabel,
      metadata: {
        runId: String(args.runId),
        stepId: String(stepId),
        stepKey: args.stepKey,
        order: args.order,
        repoFullName: run.repoFullName,
      },
      occurredAt: args.completedAt ?? args.startedAt ?? now,
    });
    await ctx.db.patch(args.runId, { updatedAt: now });
    return { stepId };
  },
});

export const completeRepoUpdateRun = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    runId: v.id("repoUpdateRuns"),
    status: v.string(),
    summary: v.optional(v.string()),
    publishVersion: v.optional(v.number()),
    profileUrl: v.optional(v.string()),
    pushedFiles: v.optional(v.array(v.string())),
    route: v.optional(v.string()),
    prUrl: v.optional(v.string()),
    prNumber: v.optional(v.number()),
    merged: v.optional(v.boolean()),
    branchRecreated: v.optional(v.boolean()),
    commitSha: v.optional(v.string()),
    mirrorFileCount: v.optional(v.number()),
    mirrorTruncated: v.optional(v.boolean()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const run = await ctx.db.get(args.runId);
    if (!run || run.userId !== user._id) throw new Error("Repo update run not found");
    const now = Date.now();
    const status = normalizeUpdateRunStatus(args.status, run.status);
    const patch: Partial<Doc<"repoUpdateRuns">> = {
      status,
      summary: args.summary ?? run.summary,
      publishVersion: args.publishVersion ?? run.publishVersion,
      profileUrl: args.profileUrl ?? run.profileUrl,
      pushedFiles: args.pushedFiles ? optionalStrings(args.pushedFiles) : run.pushedFiles,
      route: args.route ?? run.route,
      prUrl: args.prUrl ?? run.prUrl,
      prNumber: args.prNumber ?? run.prNumber,
      merged: args.merged ?? run.merged,
      branchRecreated: args.branchRecreated ?? run.branchRecreated,
      commitSha: args.commitSha ?? run.commitSha,
      mirrorFileCount: args.mirrorFileCount ?? run.mirrorFileCount,
      mirrorTruncated: args.mirrorTruncated ?? run.mirrorTruncated,
      error: args.error ?? run.error,
      completedAt: now,
      updatedAt: now,
    };
    await ctx.db.patch(args.runId, patch);
    await recordBrainActivity(ctx, {
      userId: user._id,
      activityId: `repo-update:${args.runId}`,
      source: "repo",
      kind: status,
      title: status === "success" ? "repo update complete" : status === "failed" ? "repo update failed" : "repo update finished",
      detail: args.summary ?? args.error ?? run.summary,
      status,
      entityType: "repoUpdateRun",
      entityId: String(args.runId),
      sourceAgent: run.actorLabel,
      metadata: {
        runId: String(args.runId),
        repoFullName: run.repoFullName,
        publishVersion: args.publishVersion,
        route: args.route,
        prNumber: args.prNumber,
        merged: args.merged,
        mirrorFileCount: args.mirrorFileCount,
      },
      occurredAt: now,
    });
    return { runId: args.runId, status, completedAt: now };
  },
});

export const listRepoUpdateRuns = query({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    limit: v.optional(v.number()),
    includeSteps: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await loadOwner(ctx, args.clerkId, args._internalAuthToken);
    const limit = Math.max(1, Math.min(Number(args.limit ?? 6), 20));
    const runs = await ctx.db
      .query("repoUpdateRuns")
      .withIndex("by_userId_startedAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);

    if (!args.includeSteps) return runs.map((run) => ({ ...run, steps: [] }));

    const withSteps = [];
    for (const run of runs) {
      const steps = await ctx.db
        .query("repoUpdateSteps")
        .withIndex("by_userId_run_order", (q) => q.eq("userId", user._id).eq("runId", run._id))
        .collect();
      withSteps.push({ ...run, steps: steps.sort((a, b) => a.order - b.order) });
    }
    return withSteps;
  },
});
