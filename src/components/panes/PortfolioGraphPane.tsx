"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  Archive,
  ArrowUpDown,
  ChevronDown,
  CircleDot,
  Crosshair,
  ExternalLink,
  GitBranch,
  Link2,
  ListFilter,
  Package,
  Pause,
  Search,
  Target,
  Terminal,
  XCircle,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  apiSurfaces,
  dependencyEdges,
  portfolioProjects,
  reusablePatterns,
  skillPropagation,
} from "@/data/portfolioGraph";
import { PaneDivider, PaneHeader, PaneSectionLabel } from "./shared";

type PortfolioGraphPaneProps = {
  clerkId?: string;
};

type DisplayProject = {
  slug: string;
  name: string;
  stack: string;
  status: string;
  statusSource?: string;
  statusUpdatedAt?: number;
  focusStatus?: string;
  focusRank?: number;
  summary: string;
  detailedDescription?: string;
  goal: string;
  vision?: string;
  focus: string;
  positioning?: string;
  audience?: string;
  painPoints: string[];
  solution?: string;
  whyThisSolution?: string;
  northStar?: string;
  metrics: string[];
  constraints: string[];
  notBuilding: string[];
  competitors: Array<{ name: string; url?: string; note?: string }>;
  docs: string[];
  environments: string[];
  tags?: string[];
  repoUrl?: string;
  productUrl?: string;
  repoPath?: string;
  source?: string;
  lastActivityAt?: number;
  updatedAt?: number;
};

type DisplaySurface = {
  slug: string;
  name: string;
  kind: string;
  ownerProject: string;
  ownerStack: string;
  trust: string;
  authMode: string;
  writePolicy: string;
  features: string[];
  risk: string;
  notes: string;
  docsUrls: string[];
  integrationTypes: string[];
  curlCommand?: string;
};

type ProjectActivity = {
  projectSlug: string;
  kind: string;
  title: string;
  summary?: string;
  url?: string;
  source: string;
  evidencePath?: string;
  dedupeKey?: string;
  tags: string[];
  metadata?: Record<string, unknown>;
  occurredAt: number;
};

type DisplayTrackedProject = {
  fullName: string;
  name: string;
  url?: string;
  projectUrl?: string;
  repoName?: string;
  directoryName?: string;
  apiDocsUrl?: string;
  mcpDocsUrl?: string;
  stackName?: string;
  stackSlug?: string;
  highLevelGoal?: string;
  recentProgress?: string;
  description?: string;
  primaryLanguage?: string;
  pushedAt: number;
  updatedAt?: number;
  commitsLast90d?: number;
  visibility?: string;
};

type DisplayPattern = {
  slug: string;
  name: string;
  status: string;
  tags: string[];
  canonicalOwner: string;
  summary: string;
  techStacks?: string[];
  sourcePaths?: string[];
  usageProjects?: string[];
};

function statusClass(status: string) {
  if (status === "canonical" || status === "active" || status === "synced" || status === "done") return "text-[hsl(var(--success))]";
  if (status === "candidate" || status === "cataloged" || status === "build" || status === "proposed" || status === "open" || status === "in_progress" || status === "urgent" || status === "high") return "text-[hsl(var(--accent))]";
  return "text-[hsl(var(--text-secondary))] opacity-55";
}

function statLabel(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function StatStrip({
  projectCount,
  surfaceCount,
  edgeCount,
  patternCount,
}: {
  projectCount: number;
  surfaceCount: number;
  edgeCount: number;
  patternCount: number;
}) {
  const stats = [
    ["projects", statLabel(projectCount)],
    ["surfaces", statLabel(surfaceCount)],
    ["edges", statLabel(edgeCount)],
    ["patterns", statLabel(patternCount)],
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-4">
      {stats.map(([label, value]) => (
        <div key={label} className="border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/45 px-3 py-2">
          <div className="font-mono text-[18px] leading-tight text-[hsl(var(--text-primary))]">{value}</div>
          <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--text-secondary))] opacity-45">{label}</div>
        </div>
      ))}
    </div>
  );
}

function fromPersistedProject(project: {
  slug: string;
  name: string;
  stackName?: string;
  status: string;
  statusSource?: string;
  statusUpdatedAt?: number;
  focusStatus?: string;
  focusRank?: number;
  summary?: string;
  detailedDescription?: string;
  goal?: string;
  vision?: string;
  focus?: string;
  positioning?: string;
  audience?: string;
  painPoints?: string[];
  solution?: string;
  whyThisSolution?: string;
  northStar?: string;
  metrics?: string[];
  constraints?: string[];
  notBuilding?: string[];
  competitors?: Array<{ name: string; url?: string; note?: string }>;
  docs: string[];
  environments?: string[];
  tags?: string[];
  repoUrl?: string;
  productUrl?: string;
  repoPath?: string;
  source?: string;
  lastActivityAt?: number;
  updatedAt?: number;
}): DisplayProject {
  return {
    slug: project.slug,
    name: project.name,
    stack: project.stackName ?? "Project YouStack",
    status: project.status,
    statusSource: project.statusSource,
    statusUpdatedAt: project.statusUpdatedAt,
    focusStatus: project.focusStatus,
    focusRank: project.focusRank,
    summary: project.summary ?? "No project summary saved yet.",
    detailedDescription: project.detailedDescription,
    goal: project.goal ?? "No high-level goal saved yet.",
    vision: project.vision,
    focus: project.focus ?? "No current focus saved yet.",
    positioning: project.positioning,
    audience: project.audience,
    painPoints: project.painPoints ?? [],
    solution: project.solution,
    whyThisSolution: project.whyThisSolution,
    northStar: project.northStar,
    metrics: project.metrics ?? [],
    constraints: project.constraints ?? [],
    notBuilding: project.notBuilding ?? [],
    competitors: project.competitors ?? [],
    docs: project.docs,
    environments: project.environments ?? [],
    tags: project.tags,
    repoUrl: project.repoUrl,
    productUrl: project.productUrl,
    repoPath: project.repoPath,
    source: project.source,
    lastActivityAt: project.lastActivityAt,
    updatedAt: project.updatedAt,
  };
}

function fromPersistedSurface(surface: {
  slug: string;
  name: string;
  kind: string;
  ownerProjectSlug: string;
  ownerStack?: string;
  trust: string;
  authMode?: string;
  writePolicy: string;
  features: string[];
  risk: string;
  notes?: string;
  docsUrls?: string[];
  integrationTypes?: string[];
  curlCommand?: string;
}): DisplaySurface {
  return {
    slug: surface.slug,
    name: surface.name,
    kind: surface.kind,
    ownerProject: surface.ownerProjectSlug,
    ownerStack: surface.ownerStack ?? "Project YouStack",
    trust: surface.trust,
    authMode: surface.authMode ?? "not documented",
    writePolicy: surface.writePolicy,
    features: surface.features,
    risk: surface.risk,
    notes: surface.notes ?? "",
    docsUrls: surface.docsUrls ?? [],
    integrationTypes: surface.integrationTypes ?? [],
    curlCommand: surface.curlCommand,
  };
}

function fromPersistedEdge(edge: {
  fromProjectSlug: string;
  toProjectSlug?: string;
  toSurfaceSlug?: string;
  tier: string;
  integrationType: string;
  features: string[];
  failureImpact?: string;
  notes?: string;
}) {
  return {
    fromProject: edge.fromProjectSlug,
    toSurface: edge.toSurfaceSlug ?? edge.toProjectSlug ?? "unknown",
    tier: edge.tier,
    integrationType: edge.integrationType,
    features: edge.features,
    failureImpact: edge.failureImpact ?? edge.notes ?? "No failure impact saved yet.",
  };
}

function fromPersistedPattern(pattern: {
  slug: string;
  name: string;
  status: string;
  tags: string[];
  techStacks?: string[];
  canonicalOwnerProject?: string;
  summary: string;
  sourcePaths?: string[];
  usageProjects?: string[];
}) {
  return {
    slug: pattern.slug,
    name: pattern.name,
    status: pattern.status,
    tags: pattern.tags,
    techStacks: pattern.techStacks ?? [],
    canonicalOwner: pattern.canonicalOwnerProject ?? "youmd",
    summary: pattern.summary,
    sourcePaths: pattern.sourcePaths ?? [],
    usageProjects: pattern.usageProjects ?? [],
  };
}

function shippedCounts(activities: ProjectActivity[]) {
  const now = Date.now();
  const shippable = activities.filter(isShippableActivity);
  return {
    today: shippable.filter((activity) => activity.occurredAt >= now - 86_400_000).length,
    seven: shippable.filter((activity) => activity.occurredAt >= now - 7 * 86_400_000).length,
    thirty: shippable.filter((activity) => activity.occurredAt >= now - 30 * 86_400_000).length,
    ninety: shippable.filter((activity) => activity.occurredAt >= now - 90 * 86_400_000).length,
  };
}

function isShippableActivity(activity: ProjectActivity) {
  return activity.kind === "commit" || activity.kind === "pull-request" || activity.kind === "release";
}

function formatActivityDate(value: number) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatTimeAgo(value?: number) {
  if (!value) return "unknown";
  const diffMs = Math.max(0, Date.now() - value);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const month = 30 * day;
  const year = 365 * day;
  if (diffMs < minute) return "now";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  if (diffMs < month) return `${Math.floor(diffMs / day)}d ago`;
  if (diffMs < year) return `${Math.floor(diffMs / month)}mo ago`;
  return `${Math.floor(diffMs / year)}y ago`;
}

function projectLastUpdatedAt(project: DisplayProject, activities: ProjectActivity[]) {
  return activities[0]?.occurredAt ?? project.lastActivityAt ?? project.updatedAt;
}

function projectGitHubUpdatedAt(trackedProject?: DisplayTrackedProject) {
  const pushedAt = trackedProject?.pushedAt;
  const updatedAt = trackedProject?.updatedAt;
  const latest = Math.max(pushedAt ?? 0, updatedAt ?? 0);
  return latest > 0 ? latest : undefined;
}

function timestampTitle(label: string, value?: number) {
  return value ? `${label}: ${new Date(value).toLocaleString()}` : `${label}: no timestamp saved`;
}

const CORE_PROJECT_SLUGS = new Set([
  "youmd",
  "bamfaiapp",
  "bamfsite",
  "badapp",
  "foldermd",
  "bigbounce",
  "hubify",
  "myo",
  "creator-new",
  "fantasyis",
]);

const TASK_STATUS_ACTIONS = [
  { value: "open", label: "open" },
  { value: "in_progress", label: "doing" },
  { value: "done", label: "done" },
  { value: "snoozed", label: "snooze" },
  { value: "cancelled", label: "cancel" },
] as const;

const TASK_PRIORITY_ACTIONS = [
  { value: "low", label: "low" },
  { value: "normal", label: "normal" },
  { value: "high", label: "high" },
  { value: "urgent", label: "urgent" },
] as const;

const PROJECT_FOCUS_OPTIONS = [
  { value: "top-priority", label: "Top Priority", short: "top", rank: 1, weight: 100 },
  { value: "focusing", label: "Focusing", short: "focus", rank: 2, weight: 80 },
  { value: "on-ice", label: "Freeze / On Ice", short: "ice", rank: 3, weight: 35 },
  { value: "abandoned", label: "Abandoned", short: "drop", rank: 0, weight: 5 },
  { value: "killed", label: "Dead / Killed", short: "dead", rank: 0, weight: 0 },
  { value: "unset", label: "Unsorted", short: "open", rank: 4, weight: 50 },
] as const;

const PROJECT_SORT_OPTIONS = [
  { value: "activity", label: "activity" },
  { value: "focus", label: "priority" },
  { value: "shipped90", label: "shipped 90d" },
  { value: "name", label: "name" },
] as const;

type ProjectFocusStatus = typeof PROJECT_FOCUS_OPTIONS[number]["value"];
type ProjectStatusFilter = "all" | "setup" | "active" | "inactive";
type ProjectSortMode = typeof PROJECT_SORT_OPTIONS[number]["value"];
type ProjectDensity = "dense" | "compact" | "expanded";

const MACHINE_SETUP_FOCUS_STATUSES = new Set<ProjectFocusStatus>(["top-priority", "focusing"]);

function projectFocusOption(status?: string) {
  return PROJECT_FOCUS_OPTIONS.find((option) => option.value === status) ?? PROJECT_FOCUS_OPTIONS[5];
}

function isProjectSetupEligible(project: DisplayProject) {
  return project.status === "active" && MACHINE_SETUP_FOCUS_STATUSES.has(projectFocusOption(project.focusStatus).value);
}

function projectSetupEligibilityLabel(project: DisplayProject) {
  if (isProjectSetupEligible(project)) return "setup eligible";
  if (project.status !== "active") return `setup skipped: ${project.status || "not active"}`;
  return `setup skipped: ${projectFocusOption(project.focusStatus).label}`;
}

function ProjectFocusIcon({ status }: { status?: string }) {
  switch (projectFocusOption(status).value) {
    case "top-priority":
      return <Crosshair size={11} />;
    case "focusing":
      return <Target size={11} />;
    case "on-ice":
      return <Pause size={11} />;
    case "abandoned":
      return <Archive size={11} />;
    case "killed":
      return <XCircle size={11} />;
    default:
      return <CircleDot size={11} />;
  }
}

function ProjectFocusBadge({ status }: { status?: string }) {
  const focus = projectFocusOption(status);
  return (
    <span
      title={`${focus.label} / priority ${focus.rank}`}
      className="inline-flex h-6 shrink-0 items-center gap-1 border border-[hsl(var(--border))]/70 px-1.5 font-mono text-[9px] text-[hsl(var(--accent))]"
      aria-label={`${focus.label} priority rank ${focus.rank}`}
    >
      <ProjectFocusIcon status={status} />
      <span>{focus.rank}</span>
    </span>
  );
}

function nextProjectDensity(value: ProjectDensity): ProjectDensity {
  if (value === "dense") return "compact";
  if (value === "compact") return "expanded";
  return "dense";
}

function projectFocusWeight(project: DisplayProject) {
  return projectFocusOption(project.focusStatus).weight;
}

function docsForProjectStack(stackName?: string, projectSlug?: string) {
  const normalized = `${stackName ?? ""} ${projectSlug ?? ""}`.toLowerCase();
  if (normalized.includes("bamf")) {
    return [
      "https://bamf.ai/docs",
      "https://bamf.ai/docs/api/posts",
      "https://bamf.ai/docs/mcp/overview",
      "https://bamf.ai/docs/mcp/tools",
    ];
  }
  if (normalized.includes("you")) {
    return [
      "https://you.md/api/v1/docs/reference",
      "https://you.md/.well-known/mcp.json",
      "https://you.md/api/v1/stacks/capabilities",
    ];
  }
  return [];
}

function isGenericYouMdDoc(url?: string) {
  return Boolean(url && (
    url.includes("you.md/api/v1/docs/reference") ||
    url.includes("you.md/.well-known/mcp.json") ||
    url.includes("you.md/api/v1/mcp")
  ));
}

function docsForSurface(surface: DisplaySurface) {
  const stackDocs = docsForProjectStack(surface.ownerStack, surface.ownerProject);
  if (stackDocs.length > 0 && surface.docsUrls.every(isGenericYouMdDoc)) return stackDocs;
  const fallback = stackDocs.length > 0
    ? stackDocs
    : surface.kind === "mcp"
      ? ["https://you.md/.well-known/mcp.json", "https://you.md/api/v1/mcp"]
      : surface.kind === "skillstack"
        ? ["https://you.md/api/v1/skills", "https://you.md/api/v1/stacks/capabilities"]
        : ["https://you.md/api/v1/docs/reference", "https://you.md/api/v1/docs/openapi.json"];
  return surface.docsUrls.length > 0 ? surface.docsUrls : fallback;
}

function curlForSurface(surface: DisplaySurface) {
  if (surface.curlCommand) return surface.curlCommand;
  const normalized = `${surface.name} ${surface.ownerProject} ${surface.ownerStack}`.toLowerCase();
  if (normalized.includes("bamfos") || normalized.includes("admin")) return "curl -fsSL https://bamf.ai/bamfstack/install.sh | bash";
  if (normalized.includes("bamf")) return 'curl -H "Authorization: Bearer $BAMF_API_KEY" https://api.bamf.ai/v1/agent/capabilities';
  if (surface.kind === "mcp") return "curl -fsSL https://you.md/.well-known/mcp.json";
  if (surface.kind === "skillstack") return "curl -fsSL https://you.md/api/v1/skills";
  if (surface.ownerProject === "youmd") return 'curl -H "Authorization: Bearer $YOUMD_API_KEY" https://you.md/api/v1/me/portfolio/graph';
  return `curl ${docsForSurface(surface)[0]}`;
}

function detailHref(pathname: string, projectSlug: string) {
  const params = new URLSearchParams();
  params.set("tab", "portfolio");
  params.set("project", projectSlug);
  return `${pathname}?${params.toString()}`;
}

function detailHrefWithAnchor(pathname: string, projectSlug: string, anchor: "strategy" | "timeline") {
  return `${detailHref(pathname, projectSlug)}#${anchor}`;
}

function stackInstallCommand(stackName: string) {
  const normalized = stackName.toLowerCase();
  if (normalized.includes("you")) return "curl -fsSL https://you.md/install.sh | bash";
  if (normalized.includes("bamf")) return "curl -fsSL https://bamf.ai/bamfstack/install.sh | bash";
  return null;
}

function visibleSurfaceSummary(surface: DisplaySurface) {
  return [
    surface.kind,
    surface.ownerStack,
    surface.integrationTypes.slice(0, 2).join(" / "),
  ].filter(Boolean).join(" / ");
}

function slugifyProjectToken(value?: string | null) {
  if (!value) return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function trackedProjectSlugs(project: DisplayTrackedProject) {
  return [
    project.name,
    project.repoName,
    project.directoryName,
    project.fullName,
    project.stackSlug,
  ]
    .map(slugifyProjectToken)
    .filter(Boolean);
}

function dedupeStrings(values: Array<string | undefined | null>) {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const next = value?.trim();
    if (!next || seen.has(next)) return [];
    seen.add(next);
    return [next];
  });
}

function projectDocs(project: DisplayProject, trackedProject?: DisplayTrackedProject) {
  const stackDocs = docsForProjectStack(trackedProject?.stackName ?? project.stack, project.slug);
  const trackedApiDocs = trackedProject?.apiDocsUrl && !(stackDocs.length > 0 && isGenericYouMdDoc(trackedProject.apiDocsUrl))
    ? trackedProject.apiDocsUrl
    : undefined;
  const trackedMcpDocs = trackedProject?.mcpDocsUrl && !(stackDocs.length > 0 && isGenericYouMdDoc(trackedProject.mcpDocsUrl))
    ? trackedProject.mcpDocsUrl
    : undefined;
  return dedupeStrings([
    trackedApiDocs,
    trackedMcpDocs,
    ...stackDocs,
    ...project.docs,
  ]);
}

function preferredDocUrl(urls: string[], kind: "api" | "mcp") {
  const httpUrls = urls.filter((url) => /^https?:\/\//.test(url));
  if (kind === "mcp") {
    return httpUrls.find((url) => /mcp|well-known/i.test(url)) ?? httpUrls[1] ?? httpUrls[0];
  }
  return httpUrls.find((url) => /api|openapi|docs\/reference/i.test(url)) ?? httpUrls[0];
}

function portfolioGraphCurlCommand(projectSlug: string) {
  return `curl -H "Authorization: Bearer $YOUMD_API_KEY" "https://you.md/api/v1/me/portfolio/graph?includeTasks=1" | jq '.projects[] | select(.slug == "${projectSlug}")'`;
}

function docsCurlCommand(url: string) {
  return `curl -fsSL ${url}`;
}

function cloneCommand(project: DisplayProject, trackedProject?: DisplayTrackedProject) {
  const repoUrl = project.repoUrl ?? trackedProject?.url;
  if (!repoUrl) return null;
  const target = trackedProject?.directoryName ?? project.repoPath ?? project.slug;
  return `git clone ${repoUrl} ${target}`;
}

function commandLabel(value: string) {
  if (value.startsWith("curl")) return "curl";
  if (value.startsWith("git clone")) return "clone";
  return "cmd";
}

function CommandSnippet({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 overflow-x-auto border border-[hsl(var(--border))]/45 bg-[hsl(var(--bg-raised))]/45 px-2 py-1.5">
      <div className="mb-1 font-mono text-[7.5px] uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))] opacity-45">
        {label}
      </div>
      <code className="whitespace-pre font-mono text-[8.5px] leading-4 text-[hsl(var(--text-primary))] opacity-82">
        <Terminal size={10} className="mr-1 inline text-[hsl(var(--accent))]" />
        {value}
      </code>
    </div>
  );
}

function projectActivityScore(project: DisplayProject, activities: ProjectActivity[]) {
  const counts = shippedCounts(activities);
  const latestActivityAt = activities[0]?.occurredAt ?? project.lastActivityAt ?? project.updatedAt ?? 0;
  const tags = project.tags ?? [];
  const localSignal = project.source === "local-portfolio-audit" || tags.includes("activity-hydrated") ? 1 : 0;
  const coreSignal = CORE_PROJECT_SLUGS.has(project.slug) ? 1 : 0;
  return {
    score: counts.today * 10_000 + counts.seven * 1_000 + counts.thirty * 100 + counts.ninety * 10 + localSignal * 50 + coreSignal * 25,
    latestActivityAt,
  };
}

function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = 12_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} timed out; backend may not be deployed yet`));
    }, timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function scrollToPortfolioSection(targetId: string, attempt = 0) {
  const target = document.getElementById(targetId);
  if (target) {
    let scrollParent = target.parentElement;
    while (scrollParent) {
      const style = window.getComputedStyle(scrollParent);
      const canScroll = /(auto|scroll)/.test(style.overflowY) && scrollParent.scrollHeight > scrollParent.clientHeight;
      if (canScroll) break;
      scrollParent = scrollParent.parentElement;
    }
    if (scrollParent) {
      const parentRect = scrollParent.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const top = Math.max(0, scrollParent.scrollTop + targetRect.top - parentRect.top - 12);
      scrollParent.scrollTo({ top, behavior: "auto" });
      return;
    }
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (attempt >= 40) return;
  window.setTimeout(() => scrollToPortfolioSection(targetId, attempt + 1), 100);
}

export function PortfolioGraphPane({ clerkId }: PortfolioGraphPaneProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const graph = useQuery(api.portfolio.listPortfolioGraph, clerkId ? { clerkId } : "skip");
  const syncDashboardSeed = useMutation(api.portfolio.syncDashboardSeed);
  const syncTrackedProjects = useMutation(api.portfolio.syncTrackedProjects);
  const updateProjectFocus = useMutation(api.portfolio.updateProjectFocus);
  const updateProjectStatus = useMutation(api.portfolio.updateProjectStatus);
  const updateTaskTriage = useMutation(api.portfolio.updateTaskTriage);
  const updateTaskDetails = useMutation(api.portfolio.updateTaskDetails);
  const [syncing, setSyncing] = useState(false);
  const [hydrating, setHydrating] = useState(false);
  const [triagingTaskId, setTriagingTaskId] = useState<string | null>(null);
  const [focusUpdatingSlug, setFocusUpdatingSlug] = useState<string | null>(null);
  const [statusUpdatingSlug, setStatusUpdatingSlug] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [selectedProjectSlug, setSelectedProjectSlug] = useState<string | null>(() => searchParams.get("project"));
  const [projectSearch, setProjectSearch] = useState("");
  const [projectStatusFilter, setProjectStatusFilter] = useState<ProjectStatusFilter>("all");
  const [projectFocusFilter, setProjectFocusFilter] = useState<ProjectFocusStatus | "all">("all");
  const [projectSortMode, setProjectSortMode] = useState<ProjectSortMode>("activity");
  const [projectDensity, setProjectDensity] = useState<ProjectDensity>("dense");

  const hasPersistedGraph = Boolean(graph && (
    graph.projects.length > 0 ||
    graph.apiSurfaces.length > 0 ||
    graph.dependencyEdges.length > 0 ||
    graph.reusablePatterns.length > 0
  ));

  const rawProjects: DisplayProject[] = useMemo(() => {
    if (hasPersistedGraph && graph) return graph.projects.map(fromPersistedProject);
    return portfolioProjects.map((project) => ({
      ...project,
      focusStatus: "unset",
      focusRank: 4,
      painPoints: [],
      metrics: [],
      constraints: [],
      notBuilding: [],
      competitors: [],
      repoUrl: project.repo?.includes("/") ? `https://github.com/${project.repo}` : undefined,
      source: "bootstrap",
    }));
  }, [graph, hasPersistedGraph]);
  const activeSurfaces: DisplaySurface[] = hasPersistedGraph && graph
    ? graph.apiSurfaces.map(fromPersistedSurface)
    : apiSurfaces.map((surface) => ({
      ...surface,
      docsUrls: surface.docsUrls ?? [],
      integrationTypes: surface.integrationTypes ?? [],
      curlCommand: surface.curlCommand,
    }));
  const activeEdges = hasPersistedGraph && graph
    ? graph.dependencyEdges.map(fromPersistedEdge)
    : dependencyEdges;
  const activePatterns: DisplayPattern[] = hasPersistedGraph && graph
    ? graph.reusablePatterns.map(fromPersistedPattern)
    : reusablePatterns.map((pattern) => ({ ...pattern, techStacks: [], sourcePaths: [], usageProjects: [pattern.canonicalOwner] }));
  const projectActivities: ProjectActivity[] = useMemo(
    () => graph?.projectActivities ?? [],
    [graph?.projectActivities]
  );
  const trackedProjects: DisplayTrackedProject[] = useMemo(
    () => graph?.recentTrackedProjects ?? [],
    [graph?.recentTrackedProjects]
  );
  const allShippedCounts = useMemo(
    () => shippedCounts(projectActivities),
    [projectActivities]
  );

  const surfaceBySlug = useMemo(
    () => new Map(activeSurfaces.map((surface) => [surface.slug, surface])),
    [activeSurfaces]
  );
  const activitiesByProject = useMemo(() => {
    const map = new Map<string, ProjectActivity[]>();
    for (const activity of projectActivities) {
      const rows = map.get(activity.projectSlug) ?? [];
      rows.push(activity);
      map.set(activity.projectSlug, rows);
    }
    for (const rows of map.values()) {
      rows.sort((a, b) => b.occurredAt - a.occurredAt);
    }
    return map;
  }, [projectActivities]);
  const activeProjects = useMemo(
    () => [...rawProjects].sort((a, b) => {
      const aScore = projectActivityScore(a, activitiesByProject.get(a.slug) ?? []);
      const bScore = projectActivityScore(b, activitiesByProject.get(b.slug) ?? []);
      if (bScore.score !== aScore.score) return bScore.score - aScore.score;
      if (bScore.latestActivityAt !== aScore.latestActivityAt) return bScore.latestActivityAt - aScore.latestActivityAt;
      return a.name.localeCompare(b.name);
    }),
    [activitiesByProject, rawProjects]
  );
  const filteredProjects = useMemo(() => {
    const search = projectSearch.trim().toLowerCase();
    return activeProjects
      .filter((project) => {
        const focus = projectFocusOption(project.focusStatus).value;
        const isActive = project.status === "active";
        const setupEligible = isProjectSetupEligible(project);
        if (projectStatusFilter === "setup" && !setupEligible) return false;
        if (projectStatusFilter === "active" && !isActive) return false;
        if (projectStatusFilter === "inactive" && isActive) return false;
        if (projectFocusFilter !== "all" && focus !== projectFocusFilter) return false;
        if (!search) return true;
        const haystack = [
          project.name,
          project.slug,
          project.stack,
          project.status,
          project.summary,
          project.goal,
          project.focus,
          ...(project.tags ?? []),
          ...project.docs,
        ].join(" ").toLowerCase();
        return haystack.includes(search);
      })
      .sort((a, b) => {
        const aActivities = activitiesByProject.get(a.slug) ?? [];
        const bActivities = activitiesByProject.get(b.slug) ?? [];
        const aScore = projectActivityScore(a, aActivities);
        const bScore = projectActivityScore(b, bActivities);
        if (projectSortMode === "focus") {
          const focusDiff = projectFocusWeight(b) - projectFocusWeight(a);
          if (focusDiff !== 0) return focusDiff;
          return bScore.latestActivityAt - aScore.latestActivityAt;
        }
        if (projectSortMode === "shipped90") {
          const aShipped = shippedCounts(aActivities).ninety;
          const bShipped = shippedCounts(bActivities).ninety;
          if (bShipped !== aShipped) return bShipped - aShipped;
          return bScore.latestActivityAt - aScore.latestActivityAt;
        }
        if (projectSortMode === "name") return a.name.localeCompare(b.name);
        return activeProjects.indexOf(a) - activeProjects.indexOf(b);
      });
  }, [activeProjects, activitiesByProject, projectFocusFilter, projectSearch, projectSortMode, projectStatusFilter]);
  const setupEligibleCount = useMemo(
    () => activeProjects.filter(isProjectSetupEligible).length,
    [activeProjects]
  );
  const activeStatusCount = useMemo(
    () => activeProjects.filter((project) => project.status === "active").length,
    [activeProjects]
  );
  const inactiveStatusCount = useMemo(
    () => activeProjects.filter((project) => project.status !== "active").length,
    [activeProjects]
  );
  const shippingLeaders = useMemo(() => (
    activeProjects
      .map((project) => {
        const counts = shippedCounts(activitiesByProject.get(project.slug) ?? []);
        return { project, counts };
      })
      .filter((entry) => entry.counts.ninety > 0)
      .sort((a, b) => {
        if (b.counts.today !== a.counts.today) return b.counts.today - a.counts.today;
        if (b.counts.seven !== a.counts.seven) return b.counts.seven - a.counts.seven;
        return b.counts.ninety - a.counts.ninety;
      })
      .slice(0, 5)
  ), [activeProjects, activitiesByProject]);
  const projectBySlug = useMemo(
    () => new Map(activeProjects.map((project) => [project.slug, project])),
    [activeProjects]
  );
  const recentShippingActivityRows = useMemo(() => (
    projectActivities
      .filter(isShippableActivity)
      .sort((a, b) => b.occurredAt - a.occurredAt)
      .slice(0, 6)
      .map((activity) => ({ activity, project: projectBySlug.get(activity.projectSlug) }))
  ), [projectActivities, projectBySlug]);
  const trackedBySlug = useMemo(() => {
    const map = new Map<string, DisplayTrackedProject>();
    for (const trackedProject of trackedProjects) {
      for (const slug of trackedProjectSlugs(trackedProject)) {
        if (!map.has(slug)) map.set(slug, trackedProject);
      }
    }
    return map;
  }, [trackedProjects]);
  const selectedProject = selectedProjectSlug
    ? projectBySlug.get(selectedProjectSlug)
    : undefined;
  const effectiveSelectedProjectSlug = selectedProject?.slug;
  const isProjectDetailView = Boolean(selectedProjectSlug);
  const selectedActivities = selectedProject
    ? activitiesByProject.get(selectedProject.slug) ?? []
    : [];
  const selectedLastUpdatedAt = selectedProject
    ? projectLastUpdatedAt(selectedProject, selectedActivities)
    : undefined;
  const selectedShippingActivities = selectedActivities.filter(isShippableActivity).slice(0, 5);
  const selectedCounts = shippedCounts(selectedActivities);
  const selectedOwnedSurfaces = selectedProject
    ? activeSurfaces.filter((surface) => surface.ownerProject === selectedProject.slug)
    : [];
  const selectedDependencyEdges = selectedProject
    ? activeEdges.filter((edge) => edge.fromProject === selectedProject.slug)
    : [];
  const selectedTrackedProject = selectedProject
    ? trackedBySlug.get(selectedProject.slug)
    : undefined;
  const selectedGitHubUpdatedAt = projectGitHubUpdatedAt(selectedTrackedProject);
  const selectedProjectDocs = selectedProject
    ? projectDocs(selectedProject, selectedTrackedProject)
    : [];
  const selectedApiDocsUrl = preferredDocUrl(selectedProjectDocs, "api");
  const selectedMcpDocsUrl = preferredDocUrl(selectedProjectDocs, "mcp");
  const selectedStackName = selectedTrackedProject?.stackName ?? selectedProject?.stack;
  const selectedStackInstallCommand = selectedStackName ? stackInstallCommand(selectedStackName) : null;
  const selectedGraphCurlCommand = selectedProject ? portfolioGraphCurlCommand(selectedProject.slug) : null;
  const selectedCloneCommand = selectedProject ? cloneCommand(selectedProject, selectedTrackedProject) : null;

  const selectProject = (projectSlug: string, section?: "overview" | "strategy" | "timeline") => {
    setSelectedProjectSlug(projectSlug);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "portfolio");
    params.set("project", projectSlug);
    params.delete("stack");
    params.delete("skill");
    const anchor = section && section !== "overview" ? section : undefined;
    const nextUrl = `${pathname}?${params.toString()}${anchor ? `#${anchor}` : ""}`;
    router.replace(nextUrl, { scroll: false });
    const targetId = anchor ?? "portfolio-detail-top";
    window.setTimeout(() => {
      if (anchor && window.location.hash !== `#${anchor}`) {
        window.history.replaceState(null, "", nextUrl);
      }
      scrollToPortfolioSection(targetId);
    }, 80);
  };

  const returnToProjectList = () => {
    setSelectedProjectSlug(null);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "portfolio");
    params.delete("project");
    params.delete("stack");
    params.delete("skill");
    const nextUrl = `${pathname}?${params.toString()}`;
    router.replace(nextUrl, { scroll: false });
    window.setTimeout(() => {
      document.getElementById("portfolio-projects")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  useEffect(() => {
    const projectSlug = searchParams.get("project");
    setSelectedProjectSlug(projectSlug);
  }, [searchParams]);

  useEffect(() => {
    const anchor = window.location.hash.replace("#", "");
    if (anchor === "project-detail") {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", "portfolio");
      if (selectedProjectSlug) params.set("project", selectedProjectSlug);
      const nextUrl = `${pathname}?${params.toString()}`;
      window.history.replaceState(null, "", nextUrl);
      window.setTimeout(() => scrollToPortfolioSection("portfolio-detail-top"), 80);
      return;
    }
    if (anchor !== "strategy" && anchor !== "timeline") return;
    window.setTimeout(() => scrollToPortfolioSection(anchor), 120);
  }, [
    pathname,
    searchParams,
    selectedActivities.length,
    selectedOwnedSurfaces.length,
    selectedProject?.slug,
    selectedProjectDocs.length,
    selectedProjectSlug,
  ]);

  const handleSyncSeed = async () => {
    if (!clerkId || syncing || hydrating) return;
    setSyncing(true);
    setSyncStatus(null);
    try {
      const result = await syncDashboardSeed({
        clerkId,
        projects: portfolioProjects,
        apiSurfaces,
        dependencyEdges,
        reusablePatterns,
      });
      setSyncStatus(
        `persisted ${result.projects} projects / ${result.apiSurfaces} surfaces / ${result.dependencyEdges} edges / ${result.reusablePatterns} patterns`
      );
    } catch (err) {
      setSyncStatus(`error: ${err instanceof Error ? err.message : "failed to persist graph"}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleHydrateTrackedProjects = async () => {
    if (!clerkId || syncing || hydrating) return;
    setHydrating(true);
    setSyncStatus(null);
    try {
      const result = await syncTrackedProjects({ clerkId, days: 90, limit: 80 });
      setSyncStatus(
        `hydrated ${result.tracked} recent GitHub projects into portfolio graph (${result.created} created / ${result.updated} updated)`
      );
    } catch (err) {
      setSyncStatus(`error: ${err instanceof Error ? err.message : "failed to hydrate active projects"}`);
    } finally {
      setHydrating(false);
    }
  };

  const handleTaskTriage = async (
    taskId: Id<"portfolioTasks">,
    patch: { status?: string; priority?: string }
  ) => {
    if (!clerkId || triagingTaskId) return;
    setTriagingTaskId(String(taskId));
    setSyncStatus(null);
    try {
      const result = await updateTaskTriage({ clerkId, taskId, ...patch });
      setSyncStatus(`task triaged: ${result.status} / ${result.priority}`);
    } catch (err) {
      setSyncStatus(`error: ${err instanceof Error ? err.message : "failed to triage task"}`);
    } finally {
      setTriagingTaskId(null);
    }
  };

  const handleTaskDetails = async (
    taskId: Id<"portfolioTasks">,
    patch: { projectSlug?: string | null; ownerType?: "human" | "agent"; ownerLabel?: string | null }
  ) => {
    if (!clerkId || triagingTaskId) return;
    setTriagingTaskId(String(taskId));
    setSyncStatus(null);
    try {
      const result = await updateTaskDetails({ clerkId, taskId, ...patch });
      setSyncStatus(`task updated: ${result.ownerType}${result.projectSlug ? ` / ${result.projectSlug}` : " / personal"}`);
    } catch (err) {
      setSyncStatus(`error: ${err instanceof Error ? err.message : "failed to update task"}`);
    } finally {
      setTriagingTaskId(null);
    }
  };

  const handleProjectFocus = async (project: DisplayProject, focusStatus: ProjectFocusStatus) => {
    if (!clerkId || focusUpdatingSlug) return;
    const option = projectFocusOption(focusStatus);
    setFocusUpdatingSlug(project.slug);
    setSyncStatus(null);
    try {
      const result = await withTimeout(
        updateProjectFocus({
          clerkId,
          projectSlug: project.slug,
          focusStatus: option.value,
          focusRank: option.rank,
        }),
        "project focus update"
      );
      setSyncStatus(`project focus updated: ${project.name} / ${result.focusStatus} / ${result.focusRank}`);
    } catch (err) {
      setSyncStatus(`error: ${err instanceof Error ? err.message : "failed to update project focus"}`);
    } finally {
      setFocusUpdatingSlug(null);
    }
  };

  const handleProjectStatusToggle = async (project: DisplayProject) => {
    if (!clerkId || statusUpdatingSlug) return;
    const nextStatus = project.status === "active" ? "inactive" : "active";
    setStatusUpdatingSlug(project.slug);
    setSyncStatus(null);
    try {
      const result = await withTimeout(
        updateProjectStatus({
          clerkId,
          projectSlug: project.slug,
          status: nextStatus,
        }),
        "project status update"
      );
      setSyncStatus(`project status updated: ${project.name} / ${result.status}`);
    } catch (err) {
      setSyncStatus(`error: ${err instanceof Error ? err.message : "failed to update project status"}`);
    } finally {
      setStatusUpdatingSlug(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <PaneHeader>project portfolio graph</PaneHeader>
      <div className="max-w-6xl px-6 py-6">
        {!isProjectDetailView && (
          <>
            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <section>
                <PaneSectionLabel>operating model</PaneSectionLabel>
                <h2 className="font-mono text-[18px] leading-tight text-[hsl(var(--text-primary))]">
                  A map for Houston, agents, projects, APIs, MCPs, stacks, protected harnesses, and reusable patterns.
                </h2>
                <p className="mt-3 max-w-3xl font-mono text-[11px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-65">
                  You.md keeps the human-level project catalog separate from each project&apos;s canonical repo, then joins
                  them with dependency edges, API/MCP ownership, local machine readiness, and stack/skill propagation.
                </p>
              </section>
              <StatStrip
                projectCount={activeProjects.length}
                surfaceCount={activeSurfaces.length}
                edgeCount={activeEdges.length}
                patternCount={activePatterns.length}
              />
            </div>

            <section className="mt-5 border-y border-[hsl(var(--border))]/70 py-3">
              <div className="grid gap-3 xl:grid-cols-[0.72fr_1.28fr]">
                <div>
                  <PaneSectionLabel>shipped pulse</PaneSectionLabel>
                  <h3 className="mt-1 font-mono text-[13px] leading-tight text-[hsl(var(--text-primary))]">
                    Me + agents, shipped across the portfolio.
                  </h3>
                  <p className="mt-1 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-55">
                    Commits, pull requests, and releases across the portfolio graph.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-4">
                  {[
                    ["today", allShippedCounts.today],
                    ["7d", allShippedCounts.seven],
                    ["30d", allShippedCounts.thirty],
                    ["90d", allShippedCounts.ninety],
                  ].map(([label, value]) => (
                    <div key={label as string} className="border-l border-[hsl(var(--border))]/70 bg-[hsl(var(--bg))]/35 px-3 py-2">
                      <div className="font-mono text-[20px] leading-tight text-[hsl(var(--text-primary))]">{value as number}</div>
                      <div className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.16em] text-[hsl(var(--text-secondary))] opacity-45">shipped {label as string}</div>
                    </div>
                  ))}
                </div>
              </div>
              {(shippingLeaders.length > 0 || recentShippingActivityRows.length > 0) && (
                <div className="mt-3 grid gap-3 border-t border-[hsl(var(--border))]/45 pt-3 lg:grid-cols-[0.55fr_1.45fr]">
                  {shippingLeaders.length > 0 && (
                    <div>
                      <div className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-60">top shippers</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {shippingLeaders.map(({ project, counts }) => (
                          <button
                            key={project.slug}
                            type="button"
                            onClick={() => selectProject(project.slug)}
                            className="border border-[hsl(var(--border))]/60 px-2 py-1 text-left font-mono text-[8.5px] uppercase tracking-[0.12em] text-[hsl(var(--text-secondary))] opacity-65 transition-colors hover:border-[hsl(var(--accent))] hover:text-[hsl(var(--text-primary))]"
                            style={{ borderRadius: "var(--radius)" }}
                            title={`Open ${project.name} details`}
                          >
                            {project.slug} / {counts.today} today / {counts.seven} 7d / {counts.ninety} 90d
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {recentShippingActivityRows.length > 0 && (
                    <div>
                      <div className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-60">latest shipped</div>
                      <div className="mt-2 space-y-1.5">
                        {recentShippingActivityRows.map(({ activity, project }) => (
                          <button
                            key={`${activity.projectSlug}-${activity.dedupeKey ?? activity.source}-${activity.occurredAt}-${activity.title}`}
                            type="button"
                            onClick={() => selectProject(activity.projectSlug, "timeline")}
                            className="grid w-full gap-2 border-t border-[hsl(var(--border))]/35 pt-1.5 text-left transition-colors hover:border-[hsl(var(--accent))]/70 md:grid-cols-[0.22fr_0.58fr_1fr]"
                          >
                            <span className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-[hsl(var(--text-secondary))] opacity-42">
                              {formatActivityDate(activity.occurredAt)}
                            </span>
                            <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-70">
                              {(project?.slug ?? activity.projectSlug)} / {activity.kind}
                            </span>
                            <span className="line-clamp-1 font-mono text-[9.5px] leading-4 text-[hsl(var(--text-primary))] opacity-78">
                              {activity.title}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            <div className="mt-5 border-y border-[hsl(var(--border))]/70 py-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--accent))] opacity-70">
                    {graph === undefined ? "loading" : hasPersistedGraph ? "convex persisted graph" : "bootstrap graph"}
                  </div>
                  <p className="mt-1 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-55">
                    {hasPersistedGraph
                      ? `loaded from owner-gated portfolio tables${graph?.recentTrackedProjects.length ? ` with ${graph.recentTrackedProjects.length} recent GitHub-tracked projects nearby` : ""}`
                      : "rendering the local bootstrap model until these records are synced into Convex"}
                  </p>
                  {graph && (graph.tasks.length > 0 || graph.recentCaptures.length > 0) && (
                    <p className="mt-1 font-mono text-[9.5px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-45">
                      task graph: {graph.tasks.length} open item{graph.tasks.length === 1 ? "" : "s"} / recent captures: {graph.recentCaptures.length}
                    </p>
                  )}
                  {syncStatus && (
                    <p className={`mt-2 font-mono text-[10px] ${syncStatus.startsWith("error") ? "text-[hsl(var(--accent))]" : "text-[hsl(var(--success))]"} opacity-80`}>
                      {syncStatus}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleHydrateTrackedProjects}
                    disabled={!clerkId || syncing || hydrating}
                    className="h-8 border border-[hsl(var(--border))] px-3 font-mono text-[10px] text-[hsl(var(--text-primary))] transition-colors hover:border-[hsl(var(--accent))] disabled:opacity-35"
                    style={{ borderRadius: "var(--radius)" }}
                  >
                    {hydrating ? "hydrating..." : "hydrate active projects"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSyncSeed}
                    disabled={!clerkId || syncing || hydrating}
                    className="h-8 border border-[hsl(var(--border))]/70 px-3 font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-75 transition-colors hover:border-[hsl(var(--accent))] hover:text-[hsl(var(--text-primary))] disabled:opacity-35"
                    style={{ borderRadius: "var(--radius)" }}
                  >
                    {syncing ? "syncing seed..." : hasPersistedGraph ? "refresh seed" : "persist seed"}
                  </button>
                </div>
              </div>
            </div>

            <PaneDivider />
          </>
        )}

        <section id={isProjectDetailView ? "portfolio-detail-top" : "portfolio-projects"}>
          <PaneSectionLabel>{isProjectDetailView ? "project detail" : "projects"}</PaneSectionLabel>
          {isProjectDetailView && selectedProject && (
            <div className="mb-3 flex flex-wrap items-center gap-2 border-y border-[hsl(var(--border))]/55 py-3 font-mono text-[9px] uppercase tracking-[0.14em]">
              <button
                type="button"
                onClick={returnToProjectList}
                className="text-[hsl(var(--accent))] opacity-80 transition-opacity hover:opacity-100"
              >
                {"<<"} back to projects
              </button>
              <span className="text-[hsl(var(--text-secondary))] opacity-35">/</span>
              <span className="text-[hsl(var(--text-primary))] opacity-85">{selectedProject.name}</span>
              <span className="text-[hsl(var(--text-secondary))] opacity-35">/</span>
              <a
                href={detailHref(pathname, selectedProject.slug)}
                onClick={(event) => {
                  event.preventDefault();
                  selectProject(selectedProject.slug, "overview");
                }}
                className="text-[hsl(var(--text-secondary))] opacity-55 transition-opacity hover:opacity-90"
              >
                overview
              </a>
              <a
                href={detailHrefWithAnchor(pathname, selectedProject.slug, "strategy")}
                onClick={(event) => {
                  event.preventDefault();
                  selectProject(selectedProject.slug, "strategy");
                }}
                className="text-[hsl(var(--text-secondary))] opacity-55 transition-opacity hover:opacity-90"
              >
                strategy
              </a>
              <a
                href={detailHrefWithAnchor(pathname, selectedProject.slug, "timeline")}
                onClick={(event) => {
                  event.preventDefault();
                  selectProject(selectedProject.slug, "timeline");
                }}
                className="text-[hsl(var(--text-secondary))] opacity-55 transition-opacity hover:opacity-90"
              >
                timeline
              </a>
            </div>
          )}
          {isProjectDetailView && !selectedProject && (
            <div className="border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-4">
              <button
                type="button"
                onClick={returnToProjectList}
                className="font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-80 transition-opacity hover:opacity-100"
              >
                {"<<"} back to projects
              </button>
              <h3 className="mt-3 font-mono text-[14px] text-[hsl(var(--text-primary))]">
                {graph === undefined ? "loading project graph..." : "project not found"}
              </h3>
              {graph !== undefined && (
                <p className="mt-2 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-55">
                  No portfolio project is saved as <code className="text-[hsl(var(--text-primary))]">{selectedProjectSlug}</code>. Return to the compact list and open a current project record.
                </p>
              )}
            </div>
          )}
          {!isProjectDetailView && (
            <>
          <div className="mb-3 flex flex-col gap-2 border-y border-[hsl(var(--border))]/55 py-3 lg:flex-row lg:items-center">
            <label className="flex min-w-0 flex-1 items-center gap-2 border-l border-[hsl(var(--border))]/70 bg-[hsl(var(--bg))]/35 px-3 py-2">
              <Search size={13} className="shrink-0 text-[hsl(var(--accent))] opacity-70" />
              <input
                value={projectSearch}
                onChange={(event) => setProjectSearch(event.target.value)}
                placeholder="search projects, stacks, docs, tags"
                className="min-w-0 flex-1 bg-transparent font-mono text-[10px] text-[hsl(var(--text-primary))] outline-none placeholder:text-[hsl(var(--text-secondary))] placeholder:opacity-40"
              />
            </label>
            <label className="flex items-center gap-2 border-l border-[hsl(var(--border))]/70 bg-[hsl(var(--bg))]/35 px-3 py-2">
              <ListFilter size={13} className="text-[hsl(var(--accent))] opacity-70" />
              <select
                aria-label="Filter project status"
                value={projectStatusFilter}
                onChange={(event) => setProjectStatusFilter(event.target.value as ProjectStatusFilter)}
                className="bg-transparent font-mono text-[10px] text-[hsl(var(--text-primary))] outline-none"
              >
                <option value="all">all status</option>
                <option value="setup">setup eligible</option>
                <option value="active">active</option>
                <option value="inactive">inactive/not active</option>
              </select>
            </label>
            <label className="flex items-center gap-2 border-l border-[hsl(var(--border))]/70 bg-[hsl(var(--bg))]/35 px-3 py-2">
              <Target size={13} className="text-[hsl(var(--accent))] opacity-70" />
              <select
                aria-label="Filter project focus"
                value={projectFocusFilter}
                onChange={(event) => setProjectFocusFilter(event.target.value as ProjectFocusStatus | "all")}
                className="bg-transparent font-mono text-[10px] text-[hsl(var(--text-primary))] outline-none"
              >
                <option value="all">all focus</option>
                {PROJECT_FOCUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 border-l border-[hsl(var(--border))]/70 bg-[hsl(var(--bg))]/35 px-3 py-2">
              <ArrowUpDown size={13} className="text-[hsl(var(--accent))] opacity-70" />
              <select
                aria-label="Sort projects"
                value={projectSortMode}
                onChange={(event) => setProjectSortMode(event.target.value as ProjectSortMode)}
                className="bg-transparent font-mono text-[10px] text-[hsl(var(--text-primary))] outline-none"
              >
                {PROJECT_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>sort {option.label}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setProjectDensity(nextProjectDensity(projectDensity))}
              className="flex h-9 items-center gap-2 border-l border-[hsl(var(--border))]/70 bg-[hsl(var(--bg))]/35 px-3 font-mono text-[10px] text-[hsl(var(--text-secondary))] transition-colors hover:text-[hsl(var(--text-primary))]"
            >
              <ChevronDown size={13} className={projectDensity === "expanded" ? "rotate-180 text-[hsl(var(--accent))]" : "text-[hsl(var(--accent))]"} />
              {projectDensity}
            </button>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2 font-mono text-[8.5px] uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))] opacity-45">
            <span>showing {filteredProjects.length} / {activeProjects.length}</span>
            <span>active {activeStatusCount}</span>
            <span>inactive {inactiveStatusCount}</span>
            <span>setup eligible {setupEligibleCount}</span>
            <span>sort {PROJECT_SORT_OPTIONS.find((option) => option.value === projectSortMode)?.label ?? projectSortMode}</span>
            <span>status {projectStatusFilter === "all" ? "all" : projectStatusFilter}</span>
            <span>focus {projectFocusFilter === "all" ? "all" : projectFocusOption(projectFocusFilter).label}</span>
            <span>setup active + top/focus only</span>
            <span>rank 1 top / 2 focus / 3 ice / 0 dead</span>
          </div>
            </>
          )}

          <div className={isProjectDetailView ? "space-y-3" : "space-y-2"}>
            {!isProjectDetailView && (
            <div className="max-h-[760px] space-y-2 overflow-y-auto pr-1">
              {filteredProjects.map((project) => {
                const projectActivitiesForCard = activitiesByProject.get(project.slug) ?? [];
                const counts = shippedCounts(projectActivitiesForCard);
                const focus = projectFocusOption(project.focusStatus);
                const lastUpdatedAt = projectLastUpdatedAt(project, projectActivitiesForCard);
                const trackedProjectForCard = trackedBySlug.get(project.slug);
                const githubUpdatedAt = projectGitHubUpdatedAt(trackedProjectForCard);
                const setupEligible = isProjectSetupEligible(project);
                const selected = selectedProjectSlug === project.slug;
                return (
                  <article
                    key={project.slug}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open ${project.name} project details`}
                    onClick={() => selectProject(project.slug)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        selectProject(project.slug);
                      }
                    }}
                    className={`cursor-pointer border-l bg-[hsl(var(--bg))]/40 transition-colors ${
                      projectDensity === "dense" ? "px-3 py-2" : "px-4 py-3"
                    } ${
                      selected
                        ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/[0.055]"
                        : "border-[hsl(var(--border))]/80 hover:border-[hsl(var(--accent))]/75"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <ProjectFocusBadge status={project.focusStatus} />
                      <h3 className="min-w-0 truncate font-mono text-[12px] text-[hsl(var(--text-primary))]">{project.name}</h3>
                      <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-65">{project.stack}</span>
                      <span
                        className="font-mono text-[8px] uppercase tracking-[0.14em] text-[hsl(var(--text-primary))] opacity-62"
                        title={timestampTitle("latest GitHub pushed/updated signal", githubUpdatedAt ?? lastUpdatedAt)}
                      >
                        github updated {formatTimeAgo(githubUpdatedAt ?? lastUpdatedAt)}
                      </span>
                      {lastUpdatedAt && githubUpdatedAt && Math.abs(lastUpdatedAt - githubUpdatedAt) > 60_000 && (
                        <span
                          className="font-mono text-[8px] uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))] opacity-38"
                          title={timestampTitle("latest portfolio activity signal", lastUpdatedAt)}
                        >
                          graph signal {formatTimeAgo(lastUpdatedAt)}
                        </span>
                      )}
                      <span
                        className={`font-mono text-[8px] uppercase tracking-[0.14em] ${setupEligible ? "text-[hsl(var(--success))]" : "text-[hsl(var(--text-secondary))] opacity-38"}`}
                        title={projectSetupEligibilityLabel(project)}
                      >
                        {setupEligible ? "setup yes" : "setup skip"}
                      </span>
                      <button
                        type="button"
                        disabled={!clerkId || statusUpdatingSlug === project.slug}
                        aria-pressed={project.status === "active"}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleProjectStatusToggle(project);
                        }}
                        className={`ml-auto h-6 border px-2 font-mono text-[8.5px] uppercase tracking-[0.14em] transition-colors hover:border-[hsl(var(--accent))] hover:opacity-100 disabled:opacity-35 ${
                          project.status === "active"
                            ? "border-[hsl(var(--success))]/70 bg-[hsl(var(--success))]/[0.07] text-[hsl(var(--success))]"
                            : "border-[hsl(var(--border))]/60 bg-[hsl(var(--bg-raised))]/35 text-[hsl(var(--text-secondary))] opacity-62"
                        }`}
                        style={{ borderRadius: "var(--radius)" }}
                        title={project.status === "active" ? "Mark inactive; excluded from new-computer setup" : "Mark active; eligible only if focus is Top Priority or Focusing"}
                        aria-label={`${project.status === "active" ? "Mark inactive" : "Mark active"} for ${project.name}`}
                      >
                        {statusUpdatingSlug === project.slug ? "saving" : project.status}
                      </button>
                      {project.statusSource === "manual" && (
                        <span className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))] opacity-35">
                          manual
                        </span>
                      )}
                      <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))] opacity-38">open</span>
                    </div>
                    <div className={`${projectDensity === "dense" ? "mt-1" : "mt-2"} flex flex-wrap items-center gap-1.5`}>
                      <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))] opacity-42">shipped</span>
                      <span className="border border-[hsl(var(--border))]/60 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-[hsl(var(--success))] opacity-75">today {counts.today}</span>
                      <span className="border border-[hsl(var(--border))]/60 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-[hsl(var(--text-secondary))] opacity-55">7d {counts.seven}</span>
                      <span className="border border-[hsl(var(--border))]/60 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-[hsl(var(--text-secondary))] opacity-55">30d {counts.thirty}</span>
                      <span className="border border-[hsl(var(--border))]/60 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-[hsl(var(--text-secondary))] opacity-55">90d {counts.ninety}</span>
                      <a
                        href={detailHref(pathname, project.slug)}
                        onClick={(event) => {
                          event.stopPropagation();
                          event.preventDefault();
                          selectProject(project.slug, "overview");
                        }}
                        aria-label={`View details for ${project.name}`}
                        className="ml-auto border border-[hsl(var(--border))]/60 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-[hsl(var(--text-secondary))] opacity-60 transition-colors hover:border-[hsl(var(--accent))] hover:text-[hsl(var(--text-primary))]"
                        style={{ borderRadius: "var(--radius)" }}
                      >
                        open detail
                      </a>
                      <a
                        href={detailHrefWithAnchor(pathname, project.slug, "timeline")}
                        onClick={(event) => {
                          event.stopPropagation();
                          event.preventDefault();
                          selectProject(project.slug, "timeline");
                        }}
                        aria-label={`View timeline for ${project.name}`}
                        className="border border-[hsl(var(--border))]/60 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-[hsl(var(--text-secondary))] opacity-60 transition-colors hover:border-[hsl(var(--accent))] hover:text-[hsl(var(--text-primary))]"
                        style={{ borderRadius: "var(--radius)" }}
                      >
                        timeline
                      </a>
                      <label
                        className="flex max-w-full items-center gap-1 border border-[hsl(var(--border))]/60 px-1.5 py-1"
                        style={{ borderRadius: "var(--radius)" }}
                        onClick={(event) => event.stopPropagation()}
                        title={`${focus.label} / priority ${focus.rank}`}
                      >
                        <ProjectFocusIcon status={focus.value} />
                        <span className="sr-only">Set focus status for {project.name}</span>
                        <select
                          aria-label={`Set focus status for ${project.name}`}
                          value={focus.value}
                          disabled={focusUpdatingSlug === project.slug}
                          onClick={(event) => event.stopPropagation()}
                          onMouseDown={(event) => event.stopPropagation()}
                          onChange={(event) => handleProjectFocus(project, event.target.value as ProjectFocusStatus)}
                          className="bg-transparent font-mono text-[8px] uppercase tracking-[0.12em] text-[hsl(var(--text-secondary))] outline-none disabled:opacity-35"
                        >
                          {PROJECT_FOCUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.rank} {option.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {projectDensity !== "dense" && (
                      <p className={`font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-58 ${projectDensity === "compact" ? "mt-1 line-clamp-1" : "mt-2"}`}>
                        {project.summary}
                      </p>
                    )}
                    {projectDensity === "expanded" && (
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        <div>
                          <div className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-60">goal</div>
                          <p className="mt-1 font-mono text-[9.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-55">{project.goal}</p>
                        </div>
                        <div>
                          <div className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-60">focus</div>
                          <p className="mt-1 font-mono text-[9.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-55">{project.focus}</p>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
              {filteredProjects.length === 0 && (
                <div className="border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-6 font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-55">
                  no projects match the current search/filter.
                </div>
              )}
            </div>
            )}

            {isProjectDetailView && selectedProject && (
            <div className="scroll-mt-4 min-w-0 border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-3">
              {selectedProject ? (
                <>
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Target size={14} className="text-[hsl(var(--accent))]" />
                        <h3 className="font-mono text-[14px] text-[hsl(var(--text-primary))]">{selectedProject.name}</h3>
                        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-70">{selectedProject.stack}</span>
                        <span
                          className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[hsl(var(--text-primary))] opacity-62"
                          title={timestampTitle("latest GitHub pushed/updated signal", selectedGitHubUpdatedAt ?? selectedLastUpdatedAt)}
                        >
                          github updated {formatTimeAgo(selectedGitHubUpdatedAt ?? selectedLastUpdatedAt)}
                        </span>
                        {selectedLastUpdatedAt && selectedGitHubUpdatedAt && Math.abs(selectedLastUpdatedAt - selectedGitHubUpdatedAt) > 60_000 && (
                          <span
                            className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))] opacity-38"
                            title={timestampTitle("latest portfolio activity signal", selectedLastUpdatedAt)}
                          >
                            graph signal {formatTimeAgo(selectedLastUpdatedAt)}
                          </span>
                        )}
                        <span
                          className={`font-mono text-[8.5px] uppercase tracking-[0.14em] ${isProjectSetupEligible(selectedProject) ? "text-[hsl(var(--success))]" : "text-[hsl(var(--text-secondary))] opacity-42"}`}
                          title={projectSetupEligibilityLabel(selectedProject)}
                        >
                          {isProjectSetupEligible(selectedProject) ? "setup eligible" : "setup skipped"}
                        </span>
                      </div>
                      <p className="mt-2 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-58">{selectedProject.summary}</p>
                      {(selectedApiDocsUrl || selectedMcpDocsUrl) && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {selectedApiDocsUrl && (
                            <a
                              href={selectedApiDocsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-7 items-center gap-1 border border-[hsl(var(--border))]/60 px-2 font-mono text-[8px] uppercase tracking-[0.12em] text-[hsl(var(--text-secondary))] opacity-70 transition-colors hover:border-[hsl(var(--accent))] hover:text-[hsl(var(--text-primary))]"
                              style={{ borderRadius: "var(--radius)" }}
                            >
                              api docs <ExternalLink size={10} />
                            </a>
                          )}
                          {selectedMcpDocsUrl && selectedMcpDocsUrl !== selectedApiDocsUrl && (
                            <a
                              href={selectedMcpDocsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-7 items-center gap-1 border border-[hsl(var(--border))]/60 px-2 font-mono text-[8px] uppercase tracking-[0.12em] text-[hsl(var(--text-secondary))] opacity-70 transition-colors hover:border-[hsl(var(--accent))] hover:text-[hsl(var(--text-primary))]"
                              style={{ borderRadius: "var(--radius)" }}
                            >
                              mcp <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={!clerkId || statusUpdatingSlug === selectedProject.slug}
                      aria-pressed={selectedProject.status === "active"}
                      onClick={() => void handleProjectStatusToggle(selectedProject)}
                      className={`flex h-7 items-center border px-2 font-mono text-[9px] uppercase tracking-[0.12em] transition-colors hover:border-[hsl(var(--accent))] disabled:opacity-35 ${
                        selectedProject.status === "active"
                          ? "border-[hsl(var(--success))]/70 bg-[hsl(var(--success))]/[0.07] text-[hsl(var(--success))]"
                          : "border-[hsl(var(--border))]/60 bg-[hsl(var(--bg-raised))]/35 text-[hsl(var(--text-secondary))] opacity-62"
                      }`}
                      title={selectedProject.status === "active" ? "Mark inactive; excluded from new-computer setup" : "Mark active; eligible only if focus is Top Priority or Focusing"}
                    >
                      {statusUpdatingSlug === selectedProject.slug ? "saving" : selectedProject.status}
                    </button>
                    <label className="flex items-center gap-2 border border-[hsl(var(--border))]/60 px-2 py-1">
                      <ProjectFocusBadge status={selectedProject.focusStatus} />
                      <select
                        aria-label={`Set focus status for ${selectedProject.name}`}
                        value={projectFocusOption(selectedProject.focusStatus).value}
                        disabled={focusUpdatingSlug === selectedProject.slug}
                        onChange={(event) => handleProjectFocus(selectedProject, event.target.value as ProjectFocusStatus)}
                        className="bg-transparent font-mono text-[9px] uppercase tracking-[0.12em] text-[hsl(var(--text-primary))] outline-none disabled:opacity-40"
                      >
                        {PROJECT_FOCUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-4">
                    {[
                      ["today", selectedCounts.today],
                      ["7d", selectedCounts.seven],
                      ["30d", selectedCounts.thirty],
                      ["90d", selectedCounts.ninety],
                    ].map(([label, value]) => (
                      <div key={label as string} className="border-t border-[hsl(var(--border))]/45 pt-2">
                        <div className="font-mono text-[16px] text-[hsl(var(--text-primary))]">{value as number}</div>
                        <div className="font-mono text-[8px] uppercase tracking-[0.16em] text-[hsl(var(--text-secondary))] opacity-45">shipped {label as string}</div>
                      </div>
                    ))}
                  </div>

                  {selectedShippingActivities.length > 0 && (
                    <div className="mt-4 border-t border-[hsl(var(--border))]/45 pt-3">
                      <div className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-60">latest shipped here</div>
                      <div className="mt-2 space-y-1.5">
                        {selectedShippingActivities.map((activity) => (
                          <div key={`${activity.projectSlug}-${activity.dedupeKey ?? activity.source}-${activity.occurredAt}-${activity.title}`} className="grid gap-2 border-t border-[hsl(var(--border))]/35 pt-1.5 md:grid-cols-[0.26fr_0.35fr_1fr]">
                            <div className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-[hsl(var(--text-secondary))] opacity-42">
                              {formatActivityDate(activity.occurredAt)}
                            </div>
                            <div className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-70">
                              {activity.kind} / {activity.source}
                            </div>
                            {activity.url ? (
                              <a href={activity.url} target="_blank" rel="noreferrer" className="line-clamp-1 font-mono text-[9.5px] leading-4 text-[hsl(var(--text-primary))] opacity-78 underline-offset-4 hover:underline">
                                {activity.title}
                              </a>
                            ) : (
                              <div className="line-clamp-1 font-mono text-[9.5px] leading-4 text-[hsl(var(--text-primary))] opacity-78">
                                {activity.title}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <div>
                      <div className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-60">project links</div>
                      <div className="mt-2 space-y-1">
                        {selectedProject.repoUrl && (
                          <a href={selectedProject.repoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-mono text-[9.5px] text-[hsl(var(--text-primary))] underline-offset-4 hover:underline">
                            repo <ExternalLink size={10} />
                          </a>
                        )}
                        {selectedProject.productUrl && (
                          <a href={selectedProject.productUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-mono text-[9.5px] text-[hsl(var(--text-primary))] underline-offset-4 hover:underline">
                            product <ExternalLink size={10} />
                          </a>
                        )}
                        {selectedProjectDocs.slice(0, 8).map((doc) => (
                          /^https?:\/\//.test(doc) ? (
                            <a key={doc} href={doc} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-mono text-[9.5px] text-[hsl(var(--text-secondary))] opacity-65 underline-offset-4 hover:underline">
                              {doc.replace(/^https?:\/\//, "")} <ExternalLink size={10} />
                            </a>
                          ) : (
                            <div key={doc} className="font-mono text-[9.5px] text-[hsl(var(--text-secondary))] opacity-50">{doc}</div>
                          )
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-60">focus / goal</div>
                      <p className="mt-2 font-mono text-[9.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-55">{selectedProject.focus}</p>
                      <p className="mt-2 font-mono text-[9.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-45">{selectedProject.goal}</p>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-[hsl(var(--border))]/45 pt-3">
                    <div className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-60">project graph links</div>
                    <div className="mt-2 grid gap-3 lg:grid-cols-2">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2 font-mono text-[9.5px] text-[hsl(var(--text-secondary))] opacity-62">
                          <Package size={12} className="text-[hsl(var(--accent))]" />
                          <span>stack</span>
                          <span className="text-[hsl(var(--text-primary))] opacity-85">{selectedStackName ?? "Project Stack"}</span>
                          {selectedTrackedProject?.stackSlug && <span className="opacity-45">/{selectedTrackedProject.stackSlug}</span>}
                        </div>
                        {selectedApiDocsUrl && (
                          <a href={selectedApiDocsUrl} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1 break-all font-mono text-[8.5px] text-[hsl(var(--text-primary))] opacity-72 underline-offset-4 hover:underline">
                            <Link2 size={10} className="shrink-0 text-[hsl(var(--accent))]" />
                            api docs: {selectedApiDocsUrl.replace(/^https?:\/\//, "")}
                          </a>
                        )}
                        {selectedMcpDocsUrl && selectedMcpDocsUrl !== selectedApiDocsUrl && (
                          <a href={selectedMcpDocsUrl} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1 break-all font-mono text-[8.5px] text-[hsl(var(--text-primary))] opacity-72 underline-offset-4 hover:underline">
                            <Link2 size={10} className="shrink-0 text-[hsl(var(--accent))]" />
                            mcp docs: {selectedMcpDocsUrl.replace(/^https?:\/\//, "")}
                          </a>
                        )}
                        {selectedTrackedProject?.fullName && (
                          <div className="flex flex-wrap items-center gap-2 font-mono text-[9.5px] text-[hsl(var(--text-secondary))] opacity-55">
                            <GitBranch size={12} className="text-[hsl(var(--accent))]" />
                            <span>{selectedTrackedProject.fullName}</span>
                            {selectedTrackedProject.commitsLast90d !== undefined && <span>{selectedTrackedProject.commitsLast90d} commits 90d</span>}
                          </div>
                        )}
                        {selectedProjectDocs.filter((doc) => /^https?:\/\//.test(doc) && doc !== selectedApiDocsUrl && doc !== selectedMcpDocsUrl).slice(0, 3).map((url) => (
                          <a key={url} href={url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1 break-all font-mono text-[8.5px] text-[hsl(var(--text-secondary))] opacity-58 underline-offset-4 hover:underline">
                            <Link2 size={10} className="shrink-0" />
                            {url.replace(/^https?:\/\//, "")}
                          </a>
                        ))}
                      </div>
                      <div className="space-y-2">
                        {selectedGraphCurlCommand && (
                          <CommandSnippet label="portfolio graph curl" value={selectedGraphCurlCommand} />
                        )}
                        {selectedProjectDocs.filter((doc) => /^https?:\/\//.test(doc)).slice(0, 2).map((url) => (
                          <CommandSnippet key={`curl-${url}`} label={`${commandLabel(docsCurlCommand(url))} docs`} value={docsCurlCommand(url)} />
                        ))}
                        {selectedStackInstallCommand && (
                          <CommandSnippet label="stack install" value={selectedStackInstallCommand} />
                        )}
                        {selectedCloneCommand && (
                          <CommandSnippet label="repo clone" value={selectedCloneCommand} />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-[hsl(var(--border))]/45 pt-3">
                    <div className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-60">api / mcp / stack surfaces</div>
                    <div className="mt-2 space-y-3">
                      {selectedOwnedSurfaces.length > 0 ? selectedOwnedSurfaces.map((surface) => (
                        <div key={surface.slug} className="border-t border-[hsl(var(--border))]/35 pt-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[10.5px] text-[hsl(var(--text-primary))]">{surface.name}</span>
                            <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-70">{visibleSurfaceSummary(surface)}</span>
                            <span className={`ml-auto font-mono text-[8px] uppercase tracking-[0.14em] ${statusClass(surface.risk)}`}>{surface.risk}</span>
                          </div>
                          <p className="mt-1 font-mono text-[9px] leading-4 text-[hsl(var(--text-secondary))] opacity-48">{surface.features.join(", ")}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {docsForSurface(surface).slice(0, 3).map((url) => (
                              <a key={url} href={url} target="_blank" rel="noreferrer" className="break-all font-mono text-[8.5px] text-[hsl(var(--text-primary))] opacity-68 underline-offset-4 hover:underline">
                                {surface.kind} docs: {url.replace(/^https?:\/\//, "")}
                              </a>
                            ))}
                          </div>
                          <div className="mt-2">
                            <CommandSnippet label={`${surface.kind} ${commandLabel(curlForSurface(surface))}`} value={curlForSurface(surface)} />
                          </div>
                        </div>
                      )) : (
                        <p className="font-mono text-[9.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-45">
                          no owned API/MCP surface is linked to this project yet.
                        </p>
                      )}
                    </div>
                  </div>

                  {selectedDependencyEdges.length > 0 && (
                    <div className="mt-4 border-t border-[hsl(var(--border))]/45 pt-3">
                      <div className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-60">dependency snapshot</div>
                      <div className="mt-2 space-y-1">
                        {selectedDependencyEdges.slice(0, 4).map((edge) => {
                          const surface = surfaceBySlug.get(edge.toSurface);
                          return (
                            <p key={`${edge.fromProject}-${edge.toSurface}`} className="font-mono text-[9px] leading-4 text-[hsl(var(--text-secondary))] opacity-52">
                              {edge.tier} / {edge.integrationType}: {surface?.name ?? edge.toSurface}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-50">select a project to inspect details.</p>
              )}
            </div>
            )}
          </div>
        </section>

        {isProjectDetailView && selectedProject && (
          <>
        <PaneDivider />

        <section id="strategy" className="scroll-mt-4">
          <PaneSectionLabel>strategy intelligence</PaneSectionLabel>
          <div className="border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-mono text-[13px] text-[hsl(var(--text-primary))]">
                {selectedProject?.name ?? "No project selected"}
              </h3>
              {selectedProject?.northStar && (
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-70">
                  north star
                </span>
              )}
            </div>
            {selectedProject ? (
              <>
                <div className="mt-3 grid gap-4 lg:grid-cols-2">
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-60">vision</div>
                    <p className="mt-1 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-58">
                      {selectedProject.vision ?? selectedProject.goal}
                    </p>
                  </div>
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-60">solution</div>
                    <p className="mt-1 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-58">
                      {selectedProject.solution ?? selectedProject.summary}
                    </p>
                  </div>
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-60">audience / positioning</div>
                    <p className="mt-1 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-58">
                      {[selectedProject.audience, selectedProject.positioning].filter(Boolean).join(" ") || "Audience and positioning are not enriched yet."}
                    </p>
                  </div>
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-60">north star</div>
                    <p className="mt-1 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-58">
                      {selectedProject.northStar ?? selectedProject.metrics[0] ?? "North-star metric is not enriched yet."}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["pain points", selectedProject.painPoints],
                    ["metrics", selectedProject.metrics],
                    ["constraints", selectedProject.constraints],
                    ["not building", selectedProject.notBuilding],
                  ].map(([label, values]) => (
                    <div key={label as string} className="border-t border-[hsl(var(--border))]/45 pt-2">
                      <div className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-60">{label as string}</div>
                      <ul className="mt-1 space-y-1">
                        {(values as string[]).slice(0, 4).map((value) => (
                          <li key={value} className="font-mono text-[9.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-52">
                            {value}
                          </li>
                        ))}
                        {(values as string[]).length === 0 && (
                          <li className="font-mono text-[9.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-35">not enriched yet</li>
                        )}
                      </ul>
                    </div>
                  ))}
                </div>
                {selectedProject.competitors.length > 0 && (
                  <div className="mt-4 border-t border-[hsl(var(--border))]/45 pt-2">
                    <div className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-60">alternatives / competitors</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedProject.competitors.slice(0, 6).map((competitor) => (
                        <span key={competitor.name} className="font-mono text-[9.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-55">
                          {competitor.name}{competitor.note ? `: ${competitor.note}` : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="mt-2 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-50">
                Run `youmd project portfolio-hydrate --root ~/Desktop/CODE_2025` to enrich project strategy records from local docs and activity.
              </p>
            )}
          </div>
        </section>

        <PaneDivider />

        <section id="timeline" className="scroll-mt-4">
          <PaneSectionLabel>shipping timeline</PaneSectionLabel>
          <div className="border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-mono text-[13px] text-[hsl(var(--text-primary))]">
                {selectedProject?.name ?? "No project selected"}
              </h3>
              {selectedProject && (
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-70">
                  shipped over time
                </span>
              )}
            </div>
            {selectedActivities.length > 0 ? (
              <div className="mt-3 space-y-2">
                {selectedActivities.slice(0, 18).map((activity) => (
                  <div key={`${activity.projectSlug}-${activity.dedupeKey ?? activity.source}-${activity.occurredAt}-${activity.title}`} className="grid gap-2 border-t border-[hsl(var(--border))]/45 pt-2 md:grid-cols-[0.35fr_0.55fr_1.2fr]">
                    <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[hsl(var(--text-secondary))] opacity-45">
                      {formatActivityDate(activity.occurredAt)}
                    </div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-70">
                      {activity.kind} / {activity.source}
                    </div>
                    <div>
                      {activity.url ? (
                        <a href={activity.url} target="_blank" rel="noreferrer" className="font-mono text-[10.5px] leading-relaxed text-[hsl(var(--text-primary))] underline-offset-4 hover:underline">
                          {activity.title}
                        </a>
                      ) : (
                        <div className="font-mono text-[10.5px] leading-relaxed text-[hsl(var(--text-primary))]">
                          {activity.title}
                        </div>
                      )}
                      {(activity.summary || activity.evidencePath) && (
                        <p className="mt-1 font-mono text-[9.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-50">
                          {activity.summary ?? activity.evidencePath}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-50">
                Run `youmd project portfolio-hydrate --root ~/Desktop/CODE_2025` to load recent commit, PR, README, and project-context evidence for this project.
              </p>
            )}
          </div>
        </section>
          </>
        )}

        {!isProjectDetailView && (
          <>
        <PaneDivider />

        <section>
          <PaneSectionLabel>dependency edges</PaneSectionLabel>
          <div className="space-y-2">
            {activeEdges.map((edge) => {
              const project = projectBySlug.get(edge.fromProject);
              const surface = surfaceBySlug.get(edge.toSurface);
              return (
                <div key={`${edge.fromProject}-${edge.toSurface}`} className="grid gap-3 border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-3 lg:grid-cols-[0.8fr_1fr_1.2fr]">
                  <div>
                    <div className="font-mono text-[11px] text-[hsl(var(--text-primary))]">
                      {project?.name ?? edge.fromProject} {"->"} {surface?.name ?? edge.toSurface}
                    </div>
                    <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-70">
                      {edge.tier} / {edge.integrationType}
                    </div>
                  </div>
                  <p className="font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-58">
                    {edge.features.join(", ")}
                  </p>
                  <p className="font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-45">
                    {edge.failureImpact}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
          </>
        )}

        {!isProjectDetailView && (
          <>
        <PaneDivider />

        <section>
          <PaneSectionLabel>reusable patterns</PaneSectionLabel>
          <div className="grid gap-3 xl:grid-cols-2">
            {activePatterns.map((pattern) => (
              <div key={pattern.slug} className="border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[12px] text-[hsl(var(--text-primary))]">{pattern.name}</span>
                  <span className={`ml-auto font-mono text-[9px] uppercase tracking-[0.14em] ${statusClass(pattern.status)}`}>{pattern.status}</span>
                </div>
                <p className="mt-2 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-58">{pattern.summary}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {pattern.tags.map((tag) => (
                    <span key={tag} className="font-mono text-[9px] text-[hsl(var(--accent))] opacity-55">#{tag}</span>
                  ))}
                </div>
                {(pattern.usageProjects?.length || pattern.sourcePaths?.length) ? (
                  <div className="mt-3 space-y-1 border-t border-[hsl(var(--border))]/45 pt-2">
                    {pattern.usageProjects?.length ? (
                      <p className="font-mono text-[9px] leading-4 text-[hsl(var(--text-secondary))] opacity-48">
                        used by {pattern.usageProjects.slice(0, 8).join(", ")}{pattern.usageProjects.length > 8 ? ` +${pattern.usageProjects.length - 8}` : ""}
                      </p>
                    ) : null}
                    {pattern.sourcePaths?.length ? (
                      <p className="font-mono text-[8.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-38">
                        evidence {pattern.sourcePaths.slice(0, 3).join(" / ")}{pattern.sourcePaths.length > 3 ? ` +${pattern.sourcePaths.length - 3}` : ""}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
          </>
        )}

        {!isProjectDetailView && graph && graph.tasks.length > 0 && (
          <>
            <PaneDivider />
            <section>
              <PaneSectionLabel>task triage</PaneSectionLabel>
              <div className="space-y-2">
                {graph.tasks.slice(0, 12).map((task) => {
                  const busy = triagingTaskId === String(task._id);
                  const routeTarget = effectiveSelectedProjectSlug && effectiveSelectedProjectSlug !== task.projectSlug
                    ? effectiveSelectedProjectSlug
                    : null;
                  return (
                    <div key={task._id} className="grid gap-3 border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-3 lg:grid-cols-[0.9fr_0.55fr_1.05fr]">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11px] text-[hsl(var(--text-primary))]">{task.title}</span>
                          <span className={`font-mono text-[8.5px] uppercase tracking-[0.14em] ${statusClass(task.status)}`}>{task.status}</span>
                          <span className={`font-mono text-[8.5px] uppercase tracking-[0.14em] ${statusClass(task.priority)}`}>{task.priority}</span>
                        </div>
                        <p className="mt-1 font-mono text-[9.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-50">
                          {task.description ?? (task.tags.join(", ") || "No task detail saved yet.")}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 font-mono text-[8.5px] uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))] opacity-40">
                          {task.dueAt ? <span>due {new Date(task.dueAt).toLocaleDateString()}</span> : <span>no due date</span>}
                          {task.tags.length ? <span>{task.tags.slice(0, 4).map((tag) => `#${tag}`).join(" ")}</span> : <span>no tags</span>}
                        </div>
                      </div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-70">
                        {task.ownerType}{task.ownerLabel ? ` / ${task.ownerLabel}` : ""}{task.projectSlug ? ` / ${task.projectSlug}` : " / personal"}
                      </div>
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          {TASK_STATUS_ACTIONS.map((action) => (
                            <button
                              key={`${task._id}-${action.value}`}
                              type="button"
                              disabled={!clerkId || busy || task.status === action.value}
                              onClick={() => handleTaskTriage(task._id, { status: action.value })}
                              className={`h-7 border px-2 font-mono text-[8.5px] uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                                task.status === action.value
                                  ? "border-[hsl(var(--accent))] text-[hsl(var(--accent))]"
                                  : "border-[hsl(var(--border))]/60 text-[hsl(var(--text-secondary))] opacity-60 hover:border-[hsl(var(--accent))] hover:text-[hsl(var(--text-primary))]"
                              }`}
                              style={{ borderRadius: "var(--radius)" }}
                            >
                              {busy ? "..." : action.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {TASK_PRIORITY_ACTIONS.map((action) => (
                            <button
                              key={`${task._id}-${action.value}`}
                              type="button"
                              disabled={!clerkId || busy || task.priority === action.value}
                              onClick={() => handleTaskTriage(task._id, { priority: action.value })}
                              className={`h-7 border px-2 font-mono text-[8.5px] uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                                task.priority === action.value
                                  ? "border-[hsl(var(--accent))] text-[hsl(var(--accent))]"
                                  : "border-[hsl(var(--border))]/60 text-[hsl(var(--text-secondary))] opacity-60 hover:border-[hsl(var(--accent))] hover:text-[hsl(var(--text-primary))]"
                              }`}
                              style={{ borderRadius: "var(--radius)" }}
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            disabled={!clerkId || busy || task.ownerType === "human"}
                            onClick={() => handleTaskDetails(task._id, { ownerType: "human", ownerLabel: "Houston" })}
                            className={`h-7 border px-2 font-mono text-[8.5px] uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                              task.ownerType === "human"
                                ? "border-[hsl(var(--accent))] text-[hsl(var(--accent))]"
                                : "border-[hsl(var(--border))]/60 text-[hsl(var(--text-secondary))] opacity-60 hover:border-[hsl(var(--accent))] hover:text-[hsl(var(--text-primary))]"
                            }`}
                            style={{ borderRadius: "var(--radius)" }}
                          >
                            me
                          </button>
                          <button
                            type="button"
                            disabled={!clerkId || busy || task.ownerType === "agent"}
                            onClick={() => handleTaskDetails(task._id, { ownerType: "agent", ownerLabel: "You Agent" })}
                            className={`h-7 border px-2 font-mono text-[8.5px] uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                              task.ownerType === "agent"
                                ? "border-[hsl(var(--accent))] text-[hsl(var(--accent))]"
                                : "border-[hsl(var(--border))]/60 text-[hsl(var(--text-secondary))] opacity-60 hover:border-[hsl(var(--accent))] hover:text-[hsl(var(--text-primary))]"
                            }`}
                            style={{ borderRadius: "var(--radius)" }}
                          >
                            agent
                          </button>
                          <button
                            type="button"
                            disabled={!clerkId || busy || !routeTarget}
                            onClick={() => routeTarget && handleTaskDetails(task._id, { projectSlug: routeTarget })}
                            className="h-7 border border-[hsl(var(--border))]/60 px-2 font-mono text-[8.5px] uppercase tracking-[0.12em] text-[hsl(var(--text-secondary))] opacity-60 transition-colors hover:border-[hsl(var(--accent))] hover:text-[hsl(var(--text-primary))] disabled:cursor-not-allowed disabled:opacity-35"
                            style={{ borderRadius: "var(--radius)" }}
                          >
                            route here
                          </button>
                          <button
                            type="button"
                            disabled={!clerkId || busy || !task.projectSlug}
                            onClick={() => handleTaskDetails(task._id, { projectSlug: null })}
                            className="h-7 border border-[hsl(var(--border))]/60 px-2 font-mono text-[8.5px] uppercase tracking-[0.12em] text-[hsl(var(--text-secondary))] opacity-60 transition-colors hover:border-[hsl(var(--accent))] hover:text-[hsl(var(--text-primary))] disabled:cursor-not-allowed disabled:opacity-35"
                            style={{ borderRadius: "var(--radius)" }}
                          >
                            personal
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {!isProjectDetailView && graph && graph.recentCaptures.length > 0 && (
          <>
            <PaneDivider />
            <section>
              <PaneSectionLabel>recent brain dumps</PaneSectionLabel>
              <div className="space-y-2">
                {graph.recentCaptures.slice(0, 5).map((capture) => (
                  <div key={capture._id} className="grid gap-2 border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-3 md:grid-cols-[0.8fr_1.1fr_0.6fr]">
                    <div className="font-mono text-[11px] text-[hsl(var(--text-primary))]">
                      {capture.summary ?? capture.rawText.slice(0, 96)}
                    </div>
                    <div className="font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-50">
                      {capture.insights.slice(0, 2).join(" / ") || capture.rawText.slice(0, 140)}
                    </div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-70">
                      {capture.projectSlugs.join(", ") || "uncategorized"}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {!isProjectDetailView && (
          <>
            <PaneDivider />

            <section>
              <PaneSectionLabel>skill propagation</PaneSectionLabel>
              <div className="space-y-3">
                {skillPropagation.map((entry) => (
                  <div key={entry.skill} className="border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[12px] text-[hsl(var(--text-primary))]">{entry.skill}</span>
                      <span className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-45">{entry.owner}</span>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-3">
                      {entry.projects.map((project) => (
                        <div key={`${entry.skill}-${project.project}`} className="border-t border-[hsl(var(--border))]/45 pt-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-[hsl(var(--text-primary))]">{project.project}</span>
                            <span className={`ml-auto font-mono text-[8px] uppercase tracking-[0.14em] ${statusClass(project.status)}`}>{project.status}</span>
                          </div>
                          <p className="mt-1 font-mono text-[9px] leading-4 text-[hsl(var(--text-secondary))] opacity-50">{project.note}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
