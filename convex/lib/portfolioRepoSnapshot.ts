type MaybeNumber = number | null | undefined;
type MaybeString = string | null | undefined;

export type PortfolioRepoProject = {
  slug: string;
  name: string;
  stackName?: MaybeString;
  status?: MaybeString;
  summary?: MaybeString;
  detailedDescription?: MaybeString;
  goal?: MaybeString;
  vision?: MaybeString;
  focus?: MaybeString;
  positioning?: MaybeString;
  audience?: MaybeString;
  painPoints?: string[];
  solution?: MaybeString;
  whyThisSolution?: MaybeString;
  northStar?: MaybeString;
  metrics?: string[];
  constraints?: string[];
  notBuilding?: string[];
  competitors?: Array<{ name: string; url?: MaybeString; note?: MaybeString }>;
  repoFullName?: MaybeString;
  repoUrl?: MaybeString;
  productUrl?: MaybeString;
  docs?: string[];
  environments?: string[];
  tags?: string[];
  source?: MaybeString;
  repoPath?: MaybeString;
  lastActivityAt?: MaybeNumber;
  updatedAt?: MaybeNumber;
};

export type PortfolioRepoTrackedProject = {
  fullName: string;
  name: string;
  url?: MaybeString;
  projectUrl?: MaybeString;
  repoName?: MaybeString;
  directoryName?: MaybeString;
  stackName?: MaybeString;
  stackSlug?: MaybeString;
  highLevelGoal?: MaybeString;
  recentProgress?: MaybeString;
  description?: MaybeString;
  primaryLanguage?: MaybeString;
  pushedAt?: MaybeNumber;
  commitsLast90d?: number;
  visibility?: MaybeString;
};

export type PortfolioRepoApiSurface = {
  slug: string;
  name: string;
  kind: string;
  ownerProjectSlug: string;
  ownerStack?: MaybeString;
  trust?: MaybeString;
  authMode?: MaybeString;
  writePolicy?: MaybeString;
  features?: string[];
  risk?: MaybeString;
  notes?: MaybeString;
  docsUrls?: string[];
  integrationTypes?: string[];
  curlCommand?: MaybeString;
  updatedAt?: MaybeNumber;
};

export type PortfolioRepoDependencyEdge = {
  fromProjectSlug: string;
  toProjectSlug?: MaybeString;
  toSurfaceSlug?: MaybeString;
  tier: string;
  integrationType: string;
  features?: string[];
  failureImpact?: MaybeString;
  notes?: MaybeString;
  updatedAt?: MaybeNumber;
};

export type PortfolioRepoReusablePattern = {
  slug: string;
  name: string;
  status?: MaybeString;
  tags?: string[];
  techStacks?: string[];
  canonicalOwnerProject?: MaybeString;
  summary?: MaybeString;
  sourcePaths?: string[];
  usageProjects?: string[];
  updatedAt?: MaybeNumber;
};

export type PortfolioRepoTask = {
  projectSlug?: MaybeString;
  title: string;
  description?: MaybeString;
  ownerType: "human" | "agent";
  ownerLabel?: MaybeString;
  status?: MaybeString;
  priority?: MaybeString;
  dueAt?: MaybeNumber;
  sourceType?: MaybeString;
  tags?: string[];
  createdAt?: MaybeNumber;
  updatedAt?: MaybeNumber;
};

export type PortfolioRepoProjectActivity = {
  projectSlug: string;
  kind: string;
  title: string;
  summary?: MaybeString;
  url?: MaybeString;
  source?: MaybeString;
  evidencePath?: MaybeString;
  tags?: string[];
  occurredAt?: MaybeNumber;
};

export type PortfolioRepoSnapshotGraph = {
  projects?: PortfolioRepoProject[];
  recentTrackedProjects?: PortfolioRepoTrackedProject[];
  apiSurfaces?: PortfolioRepoApiSurface[];
  dependencyEdges?: PortfolioRepoDependencyEdge[];
  reusablePatterns?: PortfolioRepoReusablePattern[];
  tasks?: PortfolioRepoTask[];
  projectActivities?: PortfolioRepoProjectActivity[];
};

export type PortfolioRepoSnapshotFile = {
  path: string;
  content: string;
};

const SNAPSHOT_VERSION = "you-md/portfolio-graph-repo-snapshot/v1";
const MAX_PROJECTS = 90;
const MAX_TRACKED = 80;
const MAX_SURFACES = 120;
const MAX_EDGES = 160;
const MAX_PATTERNS = 80;
const MAX_TASKS = 80;
const MAX_ACTIVITIES = 80;
const MAX_MIRRORED_JSON_BYTES = 120 * 1024;
const SECRET_ASSIGNMENT_PATTERN =
  /\b([A-Z][A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|PRIVATE[_-]?KEY|ACCESS[_-]?KEY)[A-Z0-9_]*)\s*=\s*[^\s,;]+/gi;
const SECRET_TOKEN_PATTERNS = [
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9_]{16,}\b/g,
  /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{12,}\b/g,
];

function asArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function cleanText(value: MaybeString): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return undefined;
  let cleaned = text.replace(/\s+/g, " ");
  cleaned = cleaned.replace(SECRET_ASSIGNMENT_PATTERN, (_match, keyName: string) => `${keyName}=[REDACTED_SECRET]`);
  for (const pattern of SECRET_TOKEN_PATTERNS) {
    cleaned = cleaned.replace(pattern, "[REDACTED_SECRET]");
  }
  return cleaned.slice(0, 320);
}

function cleanList(value: string[] | undefined, limit = 12): string[] {
  return asArray(value)
    .map((item) => cleanText(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, limit);
}

function dateStamp(value: MaybeNumber): string {
  return typeof value === "number" && Number.isFinite(value)
    ? new Date(value).toISOString().slice(0, 10)
    : "unknown";
}

function bulletList(items: string[]): string {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- none tracked yet";
}

function tableCell(value: unknown): string {
  const text = cleanText(typeof value === "string" ? value : String(value ?? "")) ?? "-";
  return text.replace(/\|/g, "\\|");
}

function sortByFreshness<T extends { updatedAt?: MaybeNumber; lastActivityAt?: MaybeNumber; pushedAt?: MaybeNumber; occurredAt?: MaybeNumber }>(
  rows: T[]
): T[] {
  return [...rows].sort((a, b) => {
    const aTime = a.lastActivityAt ?? a.updatedAt ?? a.pushedAt ?? a.occurredAt ?? 0;
    const bTime = b.lastActivityAt ?? b.updatedAt ?? b.pushedAt ?? b.occurredAt ?? 0;
    return bTime - aTime;
  });
}

function compactProject(project: PortfolioRepoProject) {
  return {
    slug: project.slug,
    name: project.name,
    stackName: cleanText(project.stackName),
    status: cleanText(project.status),
    summary: cleanText(project.summary),
    goal: cleanText(project.goal),
    vision: cleanText(project.vision),
    positioning: cleanText(project.positioning),
    audience: cleanText(project.audience),
    painPoints: cleanList(project.painPoints),
    solution: cleanText(project.solution),
    northStar: cleanText(project.northStar),
    metrics: cleanList(project.metrics),
    constraints: cleanList(project.constraints),
    notBuilding: cleanList(project.notBuilding),
    competitors: asArray(project.competitors).slice(0, 8).map((competitor) => ({
      name: competitor.name,
      url: cleanText(competitor.url),
      note: cleanText(competitor.note),
    })),
    repoFullName: cleanText(project.repoFullName),
    repoUrl: cleanText(project.repoUrl),
    productUrl: cleanText(project.productUrl),
    docs: cleanList(project.docs, 8),
    environments: cleanList(project.environments, 8),
    tags: cleanList(project.tags, 12),
    source: cleanText(project.source),
    repoPath: cleanText(project.repoPath),
    lastActivityAt: project.lastActivityAt,
    updatedAt: project.updatedAt,
  };
}

function compactTrackedProject(project: PortfolioRepoTrackedProject) {
  return {
    fullName: project.fullName,
    name: project.name,
    url: cleanText(project.url),
    projectUrl: cleanText(project.projectUrl),
    repoName: cleanText(project.repoName),
    directoryName: cleanText(project.directoryName),
    stackName: cleanText(project.stackName),
    stackSlug: cleanText(project.stackSlug),
    highLevelGoal: cleanText(project.highLevelGoal),
    recentProgress: cleanText(project.recentProgress),
    description: cleanText(project.description),
    primaryLanguage: cleanText(project.primaryLanguage),
    pushedAt: project.pushedAt,
    commitsLast90d: project.commitsLast90d ?? 0,
    visibility: cleanText(project.visibility),
  };
}

function compactTask(task: PortfolioRepoTask) {
  return {
    projectSlug: cleanText(task.projectSlug) ?? "personal",
    title: cleanText(task.title) ?? "untitled task",
    description: cleanText(task.description),
    ownerType: task.ownerType,
    ownerLabel: cleanText(task.ownerLabel),
    status: cleanText(task.status) ?? "open",
    priority: cleanText(task.priority) ?? "normal",
    dueAt: task.dueAt,
    sourceType: cleanText(task.sourceType),
    tags: cleanList(task.tags),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

function compactGraph(graph: PortfolioRepoSnapshotGraph, generatedAt: string) {
  const projects = sortByFreshness(asArray(graph.projects)).slice(0, MAX_PROJECTS).map(compactProject);
  const recentTrackedProjects = sortByFreshness(asArray(graph.recentTrackedProjects))
    .slice(0, MAX_TRACKED)
    .map(compactTrackedProject);
  const apiSurfaces = asArray(graph.apiSurfaces).slice(0, MAX_SURFACES).map((surface) => ({
    slug: surface.slug,
    name: surface.name,
    kind: surface.kind,
    ownerProjectSlug: surface.ownerProjectSlug,
    ownerStack: cleanText(surface.ownerStack),
    trust: cleanText(surface.trust),
    authMode: cleanText(surface.authMode),
    writePolicy: cleanText(surface.writePolicy),
    features: cleanList(surface.features),
    risk: cleanText(surface.risk),
    notes: cleanText(surface.notes),
    docsUrls: cleanList(surface.docsUrls, 8),
    integrationTypes: cleanList(surface.integrationTypes),
    curlCommand: cleanText(surface.curlCommand),
    updatedAt: surface.updatedAt,
  }));
  const dependencyEdges = asArray(graph.dependencyEdges).slice(0, MAX_EDGES).map((edge) => ({
    fromProjectSlug: edge.fromProjectSlug,
    toProjectSlug: cleanText(edge.toProjectSlug),
    toSurfaceSlug: cleanText(edge.toSurfaceSlug),
    tier: edge.tier,
    integrationType: edge.integrationType,
    features: cleanList(edge.features),
    failureImpact: cleanText(edge.failureImpact),
    notes: cleanText(edge.notes),
    updatedAt: edge.updatedAt,
  }));
  const reusablePatterns = asArray(graph.reusablePatterns).slice(0, MAX_PATTERNS).map((pattern) => ({
    slug: pattern.slug,
    name: pattern.name,
    status: cleanText(pattern.status),
    tags: cleanList(pattern.tags),
    techStacks: cleanList(pattern.techStacks),
    canonicalOwnerProject: cleanText(pattern.canonicalOwnerProject),
    summary: cleanText(pattern.summary),
    sourcePaths: cleanList(pattern.sourcePaths, 12),
    usageProjects: cleanList(pattern.usageProjects, 20),
    updatedAt: pattern.updatedAt,
  }));
  const tasks = sortByFreshness(asArray(graph.tasks)).slice(0, MAX_TASKS).map(compactTask);
  const projectActivities = sortByFreshness(asArray(graph.projectActivities))
    .slice(0, MAX_ACTIVITIES)
    .map((activity) => ({
      projectSlug: activity.projectSlug,
      kind: activity.kind,
      title: cleanText(activity.title) ?? "activity",
      summary: cleanText(activity.summary),
      url: cleanText(activity.url),
      source: cleanText(activity.source),
      evidencePath: cleanText(activity.evidencePath),
      tags: cleanList(activity.tags),
      occurredAt: activity.occurredAt,
    }));

  return {
    schemaVersion: SNAPSHOT_VERSION,
    generatedAt,
    counts: {
      projects: projects.length,
      recentTrackedProjects: recentTrackedProjects.length,
      apiSurfaces: apiSurfaces.length,
      dependencyEdges: dependencyEdges.length,
      reusablePatterns: reusablePatterns.length,
      tasks: tasks.length,
      projectActivities: projectActivities.length,
    },
    projects,
    recentTrackedProjects,
    apiSurfaces,
    dependencyEdges,
    reusablePatterns,
    tasks,
    projectActivities,
  };
}

function renderReadme(snapshot: ReturnType<typeof compactGraph>): string {
  return [
    "# Portfolio Graph",
    "",
    "Repo-backed snapshot maintained by You.md. Local agents should treat this as a portable summary of active projects, API/MCP surfaces, dependencies, reusable patterns, and open work.",
    "",
    `Generated: ${snapshot.generatedAt}`,
    "",
    "## Files",
    "",
    "- `graph.md` — human-readable project/API/dependency/pattern summary",
    "- `graph.json` — compact machine-readable graph for local agents and fresh-computer setup",
    "",
    "## Counts",
    "",
    `- projects: ${snapshot.counts.projects}`,
    `- recent GitHub-tracked projects: ${snapshot.counts.recentTrackedProjects}`,
    `- API/MCP/stack surfaces: ${snapshot.counts.apiSurfaces}`,
    `- dependency edges: ${snapshot.counts.dependencyEdges}`,
    `- reusable patterns: ${snapshot.counts.reusablePatterns}`,
    `- open tasks: ${snapshot.counts.tasks}`,
    `- recent activity records: ${snapshot.counts.projectActivities}`,
    "",
    "This snapshot intentionally excludes raw brain-dump transcripts, `.env.local` values, and secrets.",
    "",
  ].join("\n");
}

function renderMarkdown(snapshot: ReturnType<typeof compactGraph>): string {
  const projectRows = snapshot.projects.map((project) =>
    `| ${tableCell(project.name)} | ${tableCell(project.slug)} | ${tableCell(project.status)} | ${tableCell(project.stackName)} | ${tableCell(project.repoFullName)} | ${dateStamp(project.lastActivityAt ?? project.updatedAt)} | ${tableCell(project.goal ?? project.summary)} |`
  );
  const surfaceRows = snapshot.apiSurfaces.map((surface) =>
    `| ${tableCell(surface.name)} | ${tableCell(surface.kind)} | ${tableCell(surface.ownerProjectSlug)} | ${tableCell(surface.ownerStack)} | ${tableCell(surface.docsUrls.join(", "))} | ${tableCell(surface.curlCommand)} | ${tableCell(surface.writePolicy)} |`
  );
  const edgeRows = snapshot.dependencyEdges.map((edge) =>
    `| ${tableCell(edge.fromProjectSlug)} | ${tableCell(edge.toProjectSlug ?? edge.toSurfaceSlug)} | ${tableCell(edge.tier)} | ${tableCell(edge.integrationType)} | ${tableCell(edge.failureImpact)} |`
  );
  const patternRows = snapshot.reusablePatterns.map((pattern) =>
    `| ${tableCell(pattern.name)} | ${tableCell(pattern.status)} | ${tableCell(pattern.canonicalOwnerProject)} | ${tableCell(pattern.techStacks.join(", "))} | ${tableCell(pattern.usageProjects.join(", "))} |`
  );
  const taskRows = snapshot.tasks.map((task) =>
    `| ${tableCell(task.title)} | ${tableCell(task.projectSlug)} | ${tableCell(task.ownerType)} | ${tableCell(task.status)} | ${tableCell(task.priority)} | ${dateStamp(task.updatedAt ?? task.createdAt)} |`
  );
  const recentActivity = snapshot.projectActivities.slice(0, 40).map((activity) =>
    `- ${dateStamp(activity.occurredAt)} [${activity.projectSlug}] ${activity.kind}: ${activity.title}${activity.url ? ` (${activity.url})` : ""}`
  );

  return [
    "# Portfolio Graph Snapshot",
    "",
    `Generated: ${snapshot.generatedAt}`,
    "",
    "This is a portable, repo-backed summary generated from You.md's persisted portfolio graph. It is designed for Claude Code, Codex, Cursor, MCP clients, and fresh-machine setup agents.",
    "",
    "It intentionally excludes raw brain-dump transcripts, `.env.local` values, and secrets.",
    "",
    "## Counts",
    "",
    `- projects: ${snapshot.counts.projects}`,
    `- recent GitHub-tracked projects: ${snapshot.counts.recentTrackedProjects}`,
    `- API/MCP/stack surfaces: ${snapshot.counts.apiSurfaces}`,
    `- dependency edges: ${snapshot.counts.dependencyEdges}`,
    `- reusable patterns: ${snapshot.counts.reusablePatterns}`,
    `- open tasks: ${snapshot.counts.tasks}`,
    `- recent activity records: ${snapshot.counts.projectActivities}`,
    "",
    "## Projects",
    "",
    "| Project | Slug | Status | Stack | Repo | Last Activity | Goal / Summary |",
    "|---|---|---|---|---|---|---|",
    ...(projectRows.length ? projectRows : ["| none | - | - | - | - | - | - |"]),
    "",
    "## API / MCP / Stack Surfaces",
    "",
    "| Surface | Kind | Owner Project | Stack | Docs URLs | Curl / Install | Write Policy |",
    "|---|---|---|---|---|---|---|",
    ...(surfaceRows.length ? surfaceRows : ["| none | - | - | - | - | - | - |"]),
    "",
    "## Dependency Edges",
    "",
    "| From Project | Depends On | Tier | Integration Type | Failure Impact |",
    "|---|---|---|---|---|",
    ...(edgeRows.length ? edgeRows : ["| none | - | - | - | - |"]),
    "",
    "## Reusable Patterns",
    "",
    "| Pattern | Status | Canonical Owner | Tech Stacks | Used By |",
    "|---|---|---|---|---|",
    ...(patternRows.length ? patternRows : ["| none | - | - | - | - |"]),
    "",
    "## Open Tasks",
    "",
    "| Task | Project | Owner | Status | Priority | Updated |",
    "|---|---|---|---|---|---|",
    ...(taskRows.length ? taskRows : ["| none | - | - | - | - | - |"]),
    "",
    "## Recent Activity",
    "",
    bulletList(recentActivity),
    "",
  ].join("\n");
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function renderJsonForMirror(snapshot: ReturnType<typeof compactGraph>): string {
  const full = JSON.stringify(snapshot);
  if (byteLength(full) <= MAX_MIRRORED_JSON_BYTES) return full;

  const slimmer = {
    schemaVersion: snapshot.schemaVersion,
    generatedAt: snapshot.generatedAt,
    counts: snapshot.counts,
    projects: snapshot.projects.map((project) => ({
      slug: project.slug,
      name: project.name,
      stackName: project.stackName,
      status: project.status,
      summary: project.summary,
      goal: project.goal,
      repoFullName: project.repoFullName,
      repoUrl: project.repoUrl,
      productUrl: project.productUrl,
      tags: project.tags,
      lastActivityAt: project.lastActivityAt,
      updatedAt: project.updatedAt,
    })),
    recentTrackedProjects: snapshot.recentTrackedProjects.slice(0, 60),
    apiSurfaces: snapshot.apiSurfaces.map((surface) => ({
      slug: surface.slug,
      name: surface.name,
      kind: surface.kind,
      ownerProjectSlug: surface.ownerProjectSlug,
      trust: surface.trust,
      writePolicy: surface.writePolicy,
      risk: surface.risk,
      features: surface.features,
      integrationTypes: surface.integrationTypes,
      docsUrls: surface.docsUrls,
      curlCommand: surface.curlCommand,
    })),
    dependencyEdges: snapshot.dependencyEdges,
    reusablePatterns: snapshot.reusablePatterns.map((pattern) => ({
      slug: pattern.slug,
      name: pattern.name,
      status: pattern.status,
      canonicalOwnerProject: pattern.canonicalOwnerProject,
      summary: pattern.summary,
      techStacks: pattern.techStacks,
      usageProjects: pattern.usageProjects,
    })),
    tasks: snapshot.tasks,
    projectActivities: snapshot.projectActivities.slice(0, 25),
    mirrorNote: "Slimmed to stay under You.md repo mirror per-file limits. See graph.md for the fuller human-readable snapshot.",
  };

  return JSON.stringify(slimmer);
}

export function buildPortfolioRepoSnapshotFiles(
  graph: PortfolioRepoSnapshotGraph,
  generatedAt = new Date().toISOString()
): PortfolioRepoSnapshotFile[] {
  const snapshot = compactGraph(graph, generatedAt);
  return [
    {
      path: "projects/_portfolio/README.md",
      content: renderReadme(snapshot),
    },
    {
      path: "projects/_portfolio/graph.md",
      content: renderMarkdown(snapshot),
    },
    {
      path: "projects/_portfolio/graph.json",
      content: `${renderJsonForMirror(snapshot)}\n`,
    },
  ];
}
