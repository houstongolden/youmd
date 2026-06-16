import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireOwner } from "./lib/auth";

type DefaultDefinition = {
  slug: string;
  title: string;
  description: string;
  reportType: string;
  cadence: string;
  sourceSelectors: string[];
  promptTemplate?: string;
};

const DEFAULT_DEFINITIONS: DefaultDefinition[] = [
  {
    slug: "daily-briefing",
    title: "Daily Briefing",
    description: "Industry pulse, agenda, code carryover, connected app pulse, and body signal.",
    reportType: "daily_briefing",
    cadence: "daily",
    sourceSelectors: [
      "youmd:agent_activity",
      "youmd:projects",
      "youmd:sources",
      "youmd:memories",
      "github:repo_mirror",
      "perplexity:industry_trends",
      "google-calendar:agenda",
      "bamf:analytics",
      "badapp:fitness",
      "weather:home",
      "surf:home_break",
    ],
  },
  {
    slug: "project-carryover",
    title: "Project Carryover",
    description: "Per-project last state, repo activity, next action, and agent kickoff prompts.",
    reportType: "project_carryover",
    cadence: "daily",
    sourceSelectors: ["youmd:projects", "youmd:agent_activity", "github:repo_mirror"],
  },
  {
    slug: "daily-journal",
    title: "Daily Journal Article",
    description: "A source-grounded daily article in the owner's approved public/private voice.",
    reportType: "daily_journal",
    cadence: "daily",
    sourceSelectors: [
      "youmd:loop_reports",
      "youmd:agent_activity",
      "github:commits",
      "bamf:creator_analytics",
      "badapp:fitness",
      "weather:home",
      "surf:home_break",
    ],
  },
];

function canonicalJsonString(obj: unknown): string {
  if (obj === null || obj === undefined) return "null";
  if (typeof obj === "string") return JSON.stringify(obj);
  if (typeof obj === "number" || typeof obj === "boolean") return String(obj);
  if (Array.isArray(obj)) return "[" + obj.map(canonicalJsonString).join(",") + "]";
  if (typeof obj === "object") {
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    return "{" + keys.map((k) => `${JSON.stringify(k)}:${canonicalJsonString((obj as Record<string, unknown>)[k])}`).join(",") + "}";
  }
  return String(obj);
}

async function snapshotHash(payload: unknown): Promise<string> {
  const encoded = new TextEncoder().encode(canonicalJsonString(payload));
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "loop-report";
}

function utcDateKey(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

function windowForDate(date?: string): { date: string; start: string; end: string } {
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : utcDateKey();
  const start = `${day}T00:00:00.000Z`;
  const end = new Date(new Date(start).getTime() + 24 * 60 * 60 * 1000).toISOString();
  return { date: day, start, end };
}

function nextDailyRun(now: number): number {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(10, 30, 0, 0);
  return d.getTime();
}

async function ownerFromClerkId(
  ctx: MutationCtx,
  clerkId: string,
  userId?: Id<"users">
): Promise<Doc<"users">> {
  await requireOwner(ctx, clerkId);
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
    .first();
  if (!user) throw new Error("User not found");
  if (userId && user._id !== userId) throw new Error("not authorized: userId does not match authenticated user");
  return user;
}

async function ensureDefaultDefinition(
  ctx: MutationCtx,
  userId: Id<"users">,
  def: DefaultDefinition
): Promise<Doc<"loopReportDefinitions">> {
  const existing = await ctx.db
    .query("loopReportDefinitions")
    .withIndex("by_userId_slug", (q) => q.eq("userId", userId).eq("slug", def.slug))
    .first();
  if (existing) return existing;

  const now = Date.now();
  const id = await ctx.db.insert("loopReportDefinitions", {
    userId,
    slug: def.slug,
    title: def.title,
    description: def.description,
    reportType: def.reportType,
    cadence: def.cadence,
    timezone: "UTC",
    status: "active",
    visibility: "private",
    sourceSelectors: def.sourceSelectors,
    promptTemplate: def.promptTemplate,
    nextRunAt: nextDailyRun(now),
    createdAt: now,
    updatedAt: now,
    metadata: { seeded: true },
  });
  const row = await ctx.db.get(id);
  if (!row) throw new Error("Failed to create loop report definition");
  return row;
}

async function insertSnapshot(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    connectorKind: string;
    sourceKey: string;
    sourceType: string;
    windowStart: string;
    windowEnd: string;
    normalized: unknown;
    citations?: unknown[];
    visibility?: string;
    trustLevel?: string;
    metadata?: unknown;
  }
): Promise<Id<"sourceSnapshots">> {
  return await ctx.db.insert("sourceSnapshots", {
    userId: args.userId,
    connectorKind: args.connectorKind,
    sourceKey: args.sourceKey,
    sourceType: args.sourceType,
    windowStart: args.windowStart,
    windowEnd: args.windowEnd,
    rawHash: await snapshotHash(args.normalized),
    normalized: args.normalized,
    citations: args.citations,
    visibility: args.visibility ?? "private",
    trustLevel: args.trustLevel ?? "verified",
    capturedAt: Date.now(),
    metadata: args.metadata,
  });
}

function truncate(text: string, length = 220): string {
  const cleaned = text.trim().replace(/\s+/g, " ");
  return cleaned.length > length ? `${cleaned.slice(0, length - 1)}...` : cleaned;
}

function projectKickoffPrompt(projectName: string): string {
  return [
    `Read AGENTS.md and project-context for ${projectName}.`,
    "Summarize the current state, identify the next best scoped step, implement it, verify it, update trackers, and commit.",
  ].join(" ");
}

async function gatherDailyYouMdSignals(
  ctx: MutationCtx,
  userId: Id<"users">,
  windowStart: string,
  windowEnd: string
) {
  const startMs = new Date(windowStart).getTime();
  const endMs = new Date(windowEnd).getTime();

  const [latestBundle, repoMirror, activities, sources, changes, memories] = await Promise.all([
    ctx.db
      .query("bundles")
      .withIndex("by_userId_version", (q) => q.eq("userId", userId))
      .order("desc")
      .first(),
    ctx.db
      .query("repoMirror")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first(),
    ctx.db
      .query("agentActivity")
      .withIndex("by_userId_date", (q) => q.eq("userId", userId))
      .order("desc")
      .take(80),
    ctx.db
      .query("sources")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect(),
    ctx.db
      .query("sourceChangeSummaries")
      .withIndex("by_status", (q) => q.eq("status", "pending_review"))
      .take(25),
    ctx.db
      .query("memories")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20),
  ]);

  const youJson = (latestBundle?.youJson ?? {}) as Record<string, unknown>;
  const projects = Array.isArray(youJson.projects) ? (youJson.projects as Array<Record<string, unknown>>) : [];
  const agentActivity = activities
    .filter((a) => a.createdAt >= startMs && a.createdAt < endMs)
    .map((a) => ({
      agentName: a.agentName,
      agentSource: a.agentSource,
      action: a.action,
      resource: a.resource,
      status: a.status,
      createdAt: a.createdAt,
      details: a.details,
    }));
  const sourceSummary = sources.map((source) => ({
    id: source._id,
    sourceType: source.sourceType,
    sourceUrl: source.sourceUrl,
    displayName: source.displayName,
    connectorKind: source.connectorKind,
    crawlerProvider: source.crawlerProvider,
    refreshPolicy: source.refreshPolicy,
    visibility: source.visibility,
    trustLevel: source.trustLevel,
    status: source.status,
    lastFetched: source.lastFetched,
    lastChangedAt: source.lastChangedAt,
    failureCount: source.failureCount,
  }));
  const pendingChanges = changes
    .filter((change) => change.userId === userId)
    .map((change) => ({
      sourceUrl: change.sourceUrl,
      summary: change.summary,
      contentPreview: change.contentPreview,
      contentHeadings: change.contentHeadings,
      createdAt: change.createdAt,
    }));
  const durableMemories = memories
    .filter((memory) => !memory.isArchived && !memory.supersededBy)
    .slice(0, 8)
    .map((memory) => ({
      category: memory.category,
      content: memory.content,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
    }));

  return {
    latestBundle,
    repoMirror,
    projects,
    agentActivity,
    sourceSummary,
    pendingChanges,
    durableMemories,
  };
}

function buildDailyBriefingMarkdown(args: {
  date: string;
  projects: Array<Record<string, unknown>>;
  agentActivity: Array<Record<string, unknown>>;
  sourceSummary: Array<Record<string, unknown>>;
  pendingChanges: Array<Record<string, unknown>>;
  durableMemories: Array<Record<string, unknown>>;
  repoMirror: Doc<"repoMirror"> | null;
}): { title: string; summary: string; bodyMarkdown: string; facts: Record<string, unknown> } {
  const projectLines = args.projects.slice(0, 12).map((project) => {
    const name = String(project.name ?? project.title ?? "Untitled project");
    const status = project.status ? ` (${String(project.status)})` : "";
    const url = typeof project.url === "string" ? ` — ${project.url}` : "";
    return `- **${name}**${status}${url}\n  - kickoff: ${projectKickoffPrompt(name)}`;
  });
  const activityLines = args.agentActivity.slice(0, 20).map((activity) => {
    const when = new Date(Number(activity.createdAt ?? Date.now())).toISOString();
    return `- ${when} — ${activity.agentName ?? "agent"} ${activity.action ?? "worked"} ${activity.resource ? `on ${activity.resource}` : ""} (${activity.status ?? "ok"})`;
  });
  const sourceLines = args.sourceSummary.slice(0, 20).map((source) => (
    `- ${source.displayName ?? source.sourceUrl} — ${source.connectorKind ?? source.sourceType} / ${source.crawlerProvider ?? "native"} / ${source.status}`
  ));
  const changeLines = args.pendingChanges.slice(0, 10).map((change) => (
    `- ${change.sourceUrl}: ${change.summary}${change.contentPreview ? ` — ${truncate(String(change.contentPreview), 140)}` : ""}`
  ));
  const memoryLines = args.durableMemories.slice(0, 8).map((memory) => (
    `- ${memory.category}: ${truncate(String(memory.content), 180)}`
  ));

  const externalPlaceholders = [
    "- Perplexity industry pulse: not wired in this deterministic foundation run.",
    "- Google Calendar/tasks: connector adapter pending.",
    "- BAMF.ai/BAMF OS analytics: connector adapter pending.",
    "- Bad.app fitness/body signal: connector adapter pending.",
    "- Weather/surf/school crawler: connector adapters pending.",
  ];

  const summary = [
    `${args.projects.length} project${args.projects.length === 1 ? "" : "s"}`,
    `${args.agentActivity.length} agent event${args.agentActivity.length === 1 ? "" : "s"}`,
    `${args.sourceSummary.length} source${args.sourceSummary.length === 1 ? "" : "s"}`,
    `${args.pendingChanges.length} pending source change${args.pendingChanges.length === 1 ? "" : "s"}`,
  ].join(" / ");

  const bodyMarkdown = [
    `# Daily Briefing — ${args.date}`,
    "",
    "## industry pulse",
    ...externalPlaceholders.slice(0, 1),
    "",
    "## agenda",
    ...externalPlaceholders.slice(1, 2),
    "",
    "## code carryover",
    activityLines.length ? activityLines.join("\n") : "- no agent/code activity recorded in this window yet.",
    "",
    "## active projects",
    projectLines.length ? projectLines.join("\n") : "- no projects found in the latest identity bundle.",
    "",
    "## connected app pulse",
    ...externalPlaceholders.slice(2, 4),
    "",
    "## source and crawler state",
    sourceLines.length ? sourceLines.join("\n") : "- no connected sources yet.",
    "",
    "## monitored updates",
    changeLines.length ? changeLines.join("\n") : "- no pending source-change reviews.",
    "",
    "## durable memory hints",
    memoryLines.length ? memoryLines.join("\n") : "- no recent durable memories surfaced.",
    "",
    "## repo mirror",
    args.repoMirror
      ? `- ${args.repoMirror.repoFullName}: ${args.repoMirror.fileCount} files / ${args.repoMirror.totalBytes} bytes / synced ${new Date(args.repoMirror.syncedAt).toISOString()}`
      : "- no repo mirror connected.",
    "",
    "## body / weather / surf",
    ...externalPlaceholders.slice(4),
  ].join("\n");

  return {
    title: `Daily Briefing — ${args.date}`,
    summary,
    bodyMarkdown,
    facts: {
      projectCount: args.projects.length,
      agentActivityCount: args.agentActivity.length,
      sourceCount: args.sourceSummary.length,
      pendingChangeCount: args.pendingChanges.length,
      memoryCount: args.durableMemories.length,
      repoMirror: args.repoMirror
        ? {
            repoFullName: args.repoMirror.repoFullName,
            fileCount: args.repoMirror.fileCount,
            totalBytes: args.repoMirror.totalBytes,
            syncedAt: args.repoMirror.syncedAt,
          }
        : null,
      externalAdaptersPending: ["perplexity", "google-calendar", "bamf", "badapp", "weather", "surf", "school"],
    },
  };
}

async function createDailyBriefingRun(
  ctx: MutationCtx,
  userId: Id<"users">,
  definition: Doc<"loopReportDefinitions">,
  date?: string,
  force = false
) {
  const window = windowForDate(date);
  const existing = await ctx.db
    .query("loopReportRuns")
    .withIndex("by_userId_definition_window", (q) =>
      q.eq("userId", userId).eq("definitionId", definition._id).eq("windowStart", window.start)
    )
    .order("desc")
    .first();
  if (existing && !force) {
    const artifact = await ctx.db
      .query("loopReportArtifacts")
      .withIndex("by_runId", (q) => q.eq("runId", existing._id))
      .first();
    return { runId: existing._id, artifactId: artifact?._id ?? null, reused: true };
  }

  const signals = await gatherDailyYouMdSignals(ctx, userId, window.start, window.end);
  const snapshotIds = await Promise.all([
    insertSnapshot(ctx, {
      userId,
      connectorKind: "youmd",
      sourceKey: "agent-activity",
      sourceType: "activity",
      windowStart: window.start,
      windowEnd: window.end,
      normalized: signals.agentActivity,
    }),
    insertSnapshot(ctx, {
      userId,
      connectorKind: "youmd",
      sourceKey: "projects",
      sourceType: "projects",
      windowStart: window.start,
      windowEnd: window.end,
      normalized: signals.projects,
    }),
    insertSnapshot(ctx, {
      userId,
      connectorKind: "youmd",
      sourceKey: "sources",
      sourceType: "sources",
      windowStart: window.start,
      windowEnd: window.end,
      normalized: {
        sources: signals.sourceSummary,
        pendingChanges: signals.pendingChanges,
      },
    }),
    insertSnapshot(ctx, {
      userId,
      connectorKind: "github",
      sourceKey: "repo-mirror",
      sourceType: "repo",
      windowStart: window.start,
      windowEnd: window.end,
      normalized: signals.repoMirror
        ? {
            repoFullName: signals.repoMirror.repoFullName,
            commitSha: signals.repoMirror.commitSha,
            fileCount: signals.repoMirror.fileCount,
            totalBytes: signals.repoMirror.totalBytes,
            truncated: signals.repoMirror.truncated,
            syncedAt: signals.repoMirror.syncedAt,
          }
        : null,
      trustLevel: signals.repoMirror ? "verified" : "low",
    }),
  ]);

  const startedAt = Date.now();
  const runId = await ctx.db.insert("loopReportRuns", {
    userId,
    definitionId: definition._id,
    definitionSlug: definition.slug,
    reportType: definition.reportType,
    windowStart: window.start,
    windowEnd: window.end,
    status: "running",
    sourceSnapshotIds: snapshotIds,
    startedAt,
    metadata: { deterministic: true },
  });

  const compiled = buildDailyBriefingMarkdown({
    date: window.date,
    projects: signals.projects,
    agentActivity: signals.agentActivity,
    sourceSummary: signals.sourceSummary,
    pendingChanges: signals.pendingChanges,
    durableMemories: signals.durableMemories,
    repoMirror: signals.repoMirror,
  });
  const now = Date.now();
  const artifactId = await ctx.db.insert("loopReportArtifacts", {
    userId,
    runId,
    definitionId: definition._id,
    definitionSlug: definition.slug,
    title: compiled.title,
    summary: compiled.summary,
    bodyMarkdown: compiled.bodyMarkdown,
    facts: compiled.facts,
    citations: [],
    visibility: "private",
    status: "draft",
    createdAt: now,
    updatedAt: now,
    metadata: { deterministic: true, windowDate: window.date },
  });

  await ctx.db.patch(runId, { status: "completed", finishedAt: now });
  await ctx.db.patch(definition._id, {
    lastRunAt: now,
    nextRunAt: definition.cadence === "daily" ? nextDailyRun(now) : undefined,
    updatedAt: now,
  });

  return { runId, artifactId, reused: false };
}

export const seedDefaultDefinitions = mutation({
  args: {
    clerkId: v.string(),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await ownerFromClerkId(ctx, args.clerkId, args.userId);
    const rows = [];
    for (const def of DEFAULT_DEFINITIONS) rows.push(await ensureDefaultDefinition(ctx, user._id, def));
    return rows;
  },
});

export const listDefinitions = query({
  args: {
    clerkId: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId);
    const owner = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!owner || owner._id !== args.userId) throw new Error("not authorized: userId does not match authenticated user");
    return await ctx.db
      .query("loopReportDefinitions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const createDefinition = mutation({
  args: {
    clerkId: v.string(),
    userId: v.optional(v.id("users")),
    slug: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    reportType: v.string(),
    cadence: v.string(),
    sourceSelectors: v.array(v.string()),
    promptTemplate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ownerFromClerkId(ctx, args.clerkId, args.userId);
    const slug = normalizeSlug(args.slug || args.title);
    const existing = await ctx.db
      .query("loopReportDefinitions")
      .withIndex("by_userId_slug", (q) => q.eq("userId", user._id).eq("slug", slug))
      .first();
    if (existing) throw new Error(`Loop report definition already exists: ${slug}`);
    const now = Date.now();
    return await ctx.db.insert("loopReportDefinitions", {
      userId: user._id,
      slug,
      title: args.title.trim(),
      description: args.description?.trim(),
      reportType: args.reportType.trim(),
      cadence: args.cadence.trim(),
      timezone: "UTC",
      status: "active",
      visibility: "private",
      sourceSelectors: args.sourceSelectors,
      promptTemplate: args.promptTemplate,
      nextRunAt: args.cadence === "daily" ? nextDailyRun(now) : undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateDefinitionStatus = mutation({
  args: {
    clerkId: v.string(),
    definitionId: v.id("loopReportDefinitions"),
    status: v.union(v.literal("active"), v.literal("paused")),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId);
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    const definition = await ctx.db.get(args.definitionId);
    if (!user || !definition || definition.userId !== user._id) throw new Error("Loop report definition not found");
    await ctx.db.patch(args.definitionId, { status: args.status, updatedAt: Date.now() });
    return { ok: true };
  },
});

export const listRuns = query({
  args: {
    clerkId: v.string(),
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId);
    const owner = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!owner || owner._id !== args.userId) throw new Error("not authorized: userId does not match authenticated user");
    return await ctx.db
      .query("loopReportRuns")
      .withIndex("by_userId_startedAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(Math.min(Math.max(args.limit ?? 20, 1), 100));
  },
});

export const listArtifacts = query({
  args: {
    clerkId: v.string(),
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId);
    const owner = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!owner || owner._id !== args.userId) throw new Error("not authorized: userId does not match authenticated user");
    return await ctx.db
      .query("loopReportArtifacts")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(Math.min(Math.max(args.limit ?? 20, 1), 100));
  },
});

export const listSnapshotsForRun = query({
  args: {
    clerkId: v.string(),
    runId: v.id("loopReportRuns"),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId);
    const owner = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    const run = await ctx.db.get(args.runId);
    if (!owner || !run || run.userId !== owner._id) throw new Error("Loop report run not found");

    const snapshots = await Promise.all(run.sourceSnapshotIds.map((id) => ctx.db.get(id)));
    return snapshots.filter((snapshot): snapshot is Doc<"sourceSnapshots"> => snapshot !== null);
  },
});

export const runDailyBriefingNow = mutation({
  args: {
    clerkId: v.string(),
    userId: v.optional(v.id("users")),
    date: v.optional(v.string()),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await ownerFromClerkId(ctx, args.clerkId, args.userId);
    const definition = await ensureDefaultDefinition(ctx, user._id, DEFAULT_DEFINITIONS[0]);
    return await createDailyBriefingRun(ctx, user._id, definition, args.date, args.force === true);
  },
});

export const runDueLoopReports = internalMutation({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const due = await ctx.db
      .query("loopReportDefinitions")
      .withIndex("by_nextRunAt", (q) => q.lte("nextRunAt", now))
      .filter((q) => q.eq(q.field("status"), "active"))
      .take(Math.min(Math.max(args.limit ?? 25, 1), 100));
    const results = [];
    for (const definition of due) {
      if (definition.reportType !== "daily_briefing") {
        await ctx.db.patch(definition._id, { nextRunAt: nextDailyRun(now), updatedAt: now });
        results.push({ definitionId: definition._id, skipped: "unsupported_report_type" });
        continue;
      }
      const result = await createDailyBriefingRun(ctx, definition.userId, definition, utcDateKey(now - 24 * 60 * 60 * 1000), false);
      results.push({ definitionId: definition._id, ...result });
    }
    return { checked: due.length, results };
  },
});
