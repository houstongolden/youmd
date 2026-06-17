import * as path from "path";

export type ProjectRecency = "recent" | "active-undated" | "older";

export interface MachineProjectCandidate {
  name: string;
  slug?: string;
  repoName: string;
  targetDirName: string;
  githubUrl?: string;
  cloneSpec?: string;
  projectUrl?: string;
  fullName?: string;
  status?: string;
  statusSource?: string;
  focusStatus?: string;
  focusRank?: number;
  machineSetupEligible?: boolean;
  updatedAt?: string;
  recency: ProjectRecency;
  reason: string;
  source: "youmd" | "github" | "portfolio-graph" | "youmd+github" | "portfolio-graph+github";
  stackName?: string;
  goal?: string;
  focus?: string;
  docs?: string[];
  environments?: string[];
  tags?: string[];
  apiDocsUrl: string;
  mcpDocsUrl: string;
}

export interface MachineProjectPlan {
  rootDir: string;
  recent: MachineProjectCandidate[];
  older: MachineProjectCandidate[];
  skipped: Array<{ name: string; reason: string }>;
  sourceCounts: {
    portfolioGraphProjects: number;
    portfolioGraphTrackedProjects: number;
    githubProjects: number;
    bundleProjects: number;
  };
}

export interface GithubProjectSource {
  name: string;
  fullName: string;
  url: string;
  pushedAt?: string;
  updatedAt?: string;
  description?: string | null;
  homepage?: string | null;
  isPrivate?: boolean;
}

const ACTIVE_STATUS_RE = /\b(active|current|in.?progress|building|maintained|live|ongoing)\b/i;
const INACTIVE_STATUS_RE = /\b(archived|inactive|paused|dormant|old|deprecated|sunset)\b/i;
const DEFAULT_API_DOCS_URL = "https://you.md/api/v1/docs/reference";
const DEFAULT_MCP_DOCS_URL = "https://you.md/.well-known/mcp.json";
const MACHINE_SETUP_FOCUS_STATUSES = new Set(["top-priority", "focusing"]);

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringField(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function stringArrayField(record: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function optionalNumberField(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return undefined;
}

function stableDirName(input: string): string {
  const cleaned = input
    .trim()
    .replace(/\.git$/i, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "project";
}

export function githubRepoFromUrl(input: string): { owner: string; repo: string; url: string; cloneSpec: string } | null {
  const raw = input.trim();
  if (!raw) return null;

  const ssh = raw.match(/^git@github\.com:([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:[#?].*)?$/i);
  if (ssh) {
    const owner = ssh[1];
    const repo = ssh[2].replace(/\.git$/i, "");
    return {
      owner,
      repo,
      url: `https://github.com/${owner}/${repo}`,
      cloneSpec: `${owner}/${repo}`,
    };
  }

  const https = raw.match(/^https?:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:[#?].*)?$/i);
  if (https) {
    const owner = https[1];
    const repo = https[2].replace(/\.git$/i, "");
    return {
      owner,
      repo,
      url: `https://github.com/${owner}/${repo}`,
      cloneSpec: `${owner}/${repo}`,
    };
  }

  const shorthand = raw.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (shorthand) {
    const owner = shorthand[1];
    const repo = shorthand[2].replace(/\.git$/i, "");
    return {
      owner,
      repo,
      url: `https://github.com/${owner}/${repo}`,
      cloneSpec: `${owner}/${repo}`,
    };
  }

  return null;
}

function findGithubUrl(record: Record<string, unknown>): string {
  const direct = stringField(record, [
    "githubUrl",
    "github_url",
    "repoUrl",
    "repo_url",
    "repositoryUrl",
    "repository_url",
    "github",
    "repo",
    "repository",
    "url",
  ]);
  if (direct && githubRepoFromUrl(direct)) return direct;

  for (const value of Object.values(record)) {
    if (typeof value !== "string") continue;
    const match = value.match(/(?:https?:\/\/github\.com\/[^\s),]+|git@github\.com:[^\s),]+)/i);
    if (match && githubRepoFromUrl(match[0])) return match[0];
  }

  return "";
}

function parseDate(value: unknown): Date | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function projectUpdatedAt(record: Record<string, unknown>): Date | null {
  for (const key of [
    "pushedAt",
    "pushed_at",
    "lastActiveAt",
    "last_active_at",
    "lastCommitAt",
    "last_commit_at",
    "updatedAt",
    "updated_at",
    "lastUpdated",
    "last_updated",
    "modifiedAt",
    "modified_at",
  ]) {
    const date = parseDate(record[key]);
    if (date) return date;
  }
  return null;
}

function recordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value
        .map(asRecord)
        .filter((record) => Object.keys(record).length > 0)
    : [];
}

function portfolioGraphSources(root: Record<string, unknown>, explicitGraph?: unknown): Record<string, unknown>[] {
  const rootPortfolio = asRecord(root.portfolio);
  const candidates = [
    explicitGraph,
    root.portfolioGraph,
    root.portfolio_graph,
    root.portfolioGraphSnapshot,
    root.portfolio_graph_snapshot,
    rootPortfolio.graph,
    rootPortfolio.portfolioGraph,
    rootPortfolio,
  ];
  const seen = new Set<Record<string, unknown>>();
  const sources: Record<string, unknown>[] = [];
  for (const candidate of candidates) {
    const record = asRecord(candidate);
    if (!Object.keys(record).length || seen.has(record)) continue;
    if (
      Array.isArray(record.projects) ||
      Array.isArray(record.portfolioProjects) ||
      Array.isArray(record.recentTrackedProjects)
    ) {
      sources.push(record);
      seen.add(record);
    }
  }
  return sources;
}

function graphDate(value: unknown): string | undefined {
  const date = parseDate(value);
  return date ? date.toISOString() : undefined;
}

function portfolioGraphProjectRecords(sources: Record<string, unknown>[]): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  for (const source of sources) {
    const projects = [
      ...recordArray(source.projects),
      ...recordArray(source.portfolioProjects),
    ];
    for (const project of projects) {
      const name = stringField(project, ["name", "title", "project", "slug"]);
      if (!name) continue;
      const repoFullName = stringField(project, ["repoFullName", "fullName", "repo", "repository"]);
      const repoUrl = stringField(project, ["repoUrl", "githubUrl", "github_url", "repositoryUrl", "repository_url"]);
      const productUrl = stringField(project, ["productUrl", "projectUrl", "homepage", "website"]);
      records.push({
        ...project,
        name,
        githubUrl: repoUrl || repoFullName,
        repo: repoFullName || repoUrl,
        website: productUrl,
        stackName: stringField(project, ["stackName", "stack", "stack_name"]),
        updatedAt: graphDate(project.lastActivityAt) || graphDate(project.updatedAt) || project.updatedAt,
        lastActiveAt: graphDate(project.lastActivityAt) || project.lastActivityAt,
        _machineSource: "portfolio-graph",
      });
    }
  }
  return records;
}

function isPortfolioGraphRecord(record: Record<string, unknown>): boolean {
  return stringField(record, ["_machineSource"]) === "portfolio-graph";
}

function portfolioMachineSetupEligibility(record: Record<string, unknown>): { eligible: boolean; reason?: string } {
  const status = stringField(record, ["status", "state"]).toLowerCase();
  const focusStatus = stringField(record, ["focusStatus", "focus_status"]).toLowerCase();
  if (status !== "active") {
    return { eligible: false, reason: `not active (${status || "unset"})` };
  }
  if (!MACHINE_SETUP_FOCUS_STATUSES.has(focusStatus)) {
    return { eligible: false, reason: `focus not setup-eligible (${focusStatus || "unset"})` };
  }
  return { eligible: true };
}

function portfolioGraphTrackedProjects(sources: Record<string, unknown>[]): GithubProjectSource[] {
  const repos: GithubProjectSource[] = [];
  for (const source of sources) {
    for (const record of recordArray(source.recentTrackedProjects)) {
      const fullName = stringField(record, ["fullName", "repoFullName", "repo", "repository"]);
      const name = stringField(record, ["name", "repoName", "directoryName"]) || fullName.split("/").pop() || "";
      const url = stringField(record, ["url", "repoUrl", "githubUrl"]) || (fullName ? `https://github.com/${fullName}` : "");
      if (!name || !fullName || !githubRepoFromUrl(url || fullName)) continue;
      repos.push({
        name,
        fullName,
        url,
        pushedAt: graphDate(record.pushedAt),
        updatedAt: graphDate(record.updatedAt),
        description: stringField(record, ["description", "insight", "recentProgress", "highLevelGoal"]) || null,
        homepage: stringField(record, ["projectUrl", "homepage", "productUrl"]) || null,
        isPrivate: record.isPrivate === true,
      });
    }
  }
  return repos;
}

export function inferStackName(input: string): string {
  const value = input.toLowerCase();
  if (value.includes("youmd") || value.includes("you-md") || value.includes("you.md")) return "YouStack";
  if (value.includes("agent-shared")) return "Shared Agent Stack";
  if (value.includes("bamfsite") || value.includes("bamfos") || value.includes("bamf agency")) return "BAMFOSStack";
  if (value.includes("bamfaiapp") || value.includes("bamf-ai") || value.includes("bamf.ai")) return "BAMFStack";
  if (value.includes("badapp") || value.includes("badfit")) return "BadStack";
  if (value.includes("folder")) return "FolderMDStack";
  if (value.includes("myo")) return "MyoStack";
  if (value.includes("scistack")) return "SciStack";
  if (value.includes("bigbounce")) return "AstroStack";
  if (value.includes("hubify")) return "HubStack";
  if (value.includes("hcomputer") || value.includes("h-computer")) return "HComputerStack";
  if (value.includes("fantasy")) return "FantasyStack";
  if (value.includes("newsletter")) return "ContentStack";
  if (value.includes("claws")) return "ClawsStack";
  return "Project YouStack";
}

function classifyProject(record: Record<string, unknown>, now: Date, activeDays: number): { recency: ProjectRecency; reason: string; updatedAt?: string } {
  const status = stringField(record, ["status", "state"]);
  const updatedAt = projectUpdatedAt(record);
  if (updatedAt) {
    const ageDays = Math.floor((now.getTime() - updatedAt.getTime()) / 86_400_000);
    if (ageDays <= activeDays) {
      return {
        recency: "recent",
        reason: `updated ${ageDays}d ago`,
        updatedAt: updatedAt.toISOString(),
      };
    }
    return {
      recency: "older",
      reason: `last update ${ageDays}d ago`,
      updatedAt: updatedAt.toISOString(),
    };
  }

  if (status && INACTIVE_STATUS_RE.test(status)) {
    return { recency: "older", reason: `status: ${status}` };
  }
  if (status && ACTIVE_STATUS_RE.test(status)) {
    return { recency: "active-undated", reason: `status: ${status}` };
  }
  return { recency: "active-undated", reason: "listed in You.md projects" };
}

export function buildMachineProjectPlan(
  youJson: unknown,
  options: {
    rootDir: string;
    activeDays?: number;
    now?: Date;
    githubProjects?: GithubProjectSource[];
    portfolioGraph?: unknown;
    apiDocsUrl?: string;
    mcpDocsUrl?: string;
    includeInactive?: boolean;
  },
): MachineProjectPlan {
  const rootDir = path.resolve(options.rootDir);
  const activeDays = options.activeDays ?? 90;
  const now = options.now ?? new Date();
  const apiDocsUrl = options.apiDocsUrl ?? DEFAULT_API_DOCS_URL;
  const mcpDocsUrl = options.mcpDocsUrl ?? DEFAULT_MCP_DOCS_URL;
  const root = asRecord(youJson);
  const projects = Array.isArray(root.projects) ? root.projects : [];
  const graphSources = portfolioGraphSources(root, options.portfolioGraph);
  const graphProjectRecords = portfolioGraphProjectRecords(graphSources);
  const graphGithubProjects = portfolioGraphTrackedProjects(graphSources);
  const requireFocusedPortfolioProjects = graphProjectRecords.length > 0 && options.includeInactive !== true;
  const seen = new Set<string>();
  const recent: MachineProjectCandidate[] = [];
  const older: MachineProjectCandidate[] = [];
  const skipped: Array<{ name: string; reason: string }> = [];

  const pushCandidate = (
    candidate: MachineProjectCandidate,
    dedupeKey: string,
  ) => {
    const key = dedupeKey.toLowerCase();
    if (seen.has(key)) {
      skipped.push({ name: candidate.name, reason: "duplicate repo/project target" });
      return;
    }
    seen.add(key);
    if (candidate.recency === "older") older.push(candidate);
    else recent.push(candidate);
  };

  const bundleRecords = [
    ...graphProjectRecords,
    ...projects.map(asRecord),
  ];

  const githubProjectSources = [
    ...graphGithubProjects,
    ...(options.githubProjects ?? []),
  ];

  for (const repo of githubProjectSources) {
    const github = githubRepoFromUrl(repo.url || repo.fullName);
    if (!github) continue;
    const matchingBundle = bundleRecords.find((record) => {
      const githubInput = findGithubUrl(record);
      const bundleGithub = githubInput ? githubRepoFromUrl(githubInput) : null;
      const bundleName = stringField(record, ["name", "title", "project"]).toLowerCase();
      return (
        bundleGithub?.cloneSpec.toLowerCase() === github.cloneSpec.toLowerCase() ||
        bundleName === repo.name.toLowerCase() ||
        bundleName === repo.fullName.toLowerCase()
      );
    });
    const name = stringField(matchingBundle ?? {}, ["name", "title", "project"]) || repo.name;
    const record = {
      ...(matchingBundle ?? {}),
      pushedAt: repo.pushedAt,
      updatedAt: repo.updatedAt,
      status: stringField(matchingBundle ?? {}, ["status", "state"]) || "active from GitHub",
    };
    const fromPortfolioGraph = isPortfolioGraphRecord(matchingBundle ?? {});
    if (requireFocusedPortfolioProjects) {
      if (!fromPortfolioGraph) {
        skipped.push({ name, reason: "not in focused portfolio graph for machine setup" });
        continue;
      }
      const eligibility = portfolioMachineSetupEligibility(matchingBundle ?? {});
      if (!eligibility.eligible) {
        skipped.push({ name, reason: eligibility.reason ?? "not setup-eligible" });
        continue;
      }
    }
    const classified = classifyProject(record, now, activeDays);
    const targetDirName = stableDirName(github.repo);
    pushCandidate(
      {
        name,
        slug: stringField(matchingBundle ?? {}, ["slug"]),
        repoName: github.repo,
        targetDirName,
        githubUrl: github.url,
        cloneSpec: github.cloneSpec,
        projectUrl: repo.homepage || undefined,
        fullName: repo.fullName,
        status: stringField(record, ["status", "state"]) || undefined,
        statusSource: stringField(record, ["statusSource", "status_source"]) || undefined,
        focusStatus: stringField(record, ["focusStatus", "focus_status"]) || undefined,
        focusRank: optionalNumberField(record, ["focusRank", "focus_rank"]),
        machineSetupEligible: fromPortfolioGraph ? portfolioMachineSetupEligibility(matchingBundle ?? {}).eligible : undefined,
        updatedAt: classified.updatedAt,
        recency: classified.recency,
        reason: classified.reason,
        source: matchingBundle ? (fromPortfolioGraph ? "portfolio-graph+github" : "youmd+github") : "github",
        stackName: stringField(record, ["stackName", "stack", "stack_name"]) || inferStackName(repo.fullName),
        goal: stringField(record, ["goal", "highLevelGoal"]),
        focus: stringField(record, ["focus", "recentProgress", "insight"]),
        docs: stringArrayField(record, ["docs", "docsUrls"]),
        environments: stringArrayField(record, ["environments"]),
        tags: stringArrayField(record, ["tags"]),
        apiDocsUrl,
        mcpDocsUrl,
      },
      github.cloneSpec,
    );
  }

  for (const record of bundleRecords) {
    const name = stringField(record, ["name", "title", "project"]) || "untitled-project";
    const githubInput = findGithubUrl(record);
    const github = githubInput ? githubRepoFromUrl(githubInput) : null;
    const repoName = github?.repo || stableDirName(name);
    const targetDirName = stableDirName(repoName);
    const dedupeKey = github?.cloneSpec.toLowerCase() || targetDirName.toLowerCase();

    const classified = classifyProject(record, now, activeDays);
    const fromPortfolioGraph = isPortfolioGraphRecord(record);
    if (requireFocusedPortfolioProjects) {
      if (!fromPortfolioGraph) {
        skipped.push({ name, reason: "superseded by focused portfolio graph selection gate" });
        continue;
      }
      const eligibility = portfolioMachineSetupEligibility(record);
      if (!eligibility.eligible) {
        skipped.push({ name, reason: eligibility.reason ?? "not setup-eligible" });
        continue;
      }
    }
    const candidate: MachineProjectCandidate = {
      name,
      slug: stringField(record, ["slug"]),
      repoName,
      targetDirName,
      githubUrl: github?.url,
      cloneSpec: github?.cloneSpec,
      projectUrl: stringField(record, ["website", "homepage", "projectUrl", "project_url"]) || undefined,
      fullName: github?.cloneSpec,
      status: stringField(record, ["status", "state"]) || undefined,
      statusSource: stringField(record, ["statusSource", "status_source"]) || undefined,
      focusStatus: stringField(record, ["focusStatus", "focus_status"]) || undefined,
      focusRank: optionalNumberField(record, ["focusRank", "focus_rank"]),
      machineSetupEligible: fromPortfolioGraph ? portfolioMachineSetupEligibility(record).eligible : undefined,
      updatedAt: classified.updatedAt,
      recency: classified.recency,
      reason: classified.reason,
      source: fromPortfolioGraph ? "portfolio-graph" : "youmd",
      stackName: stringField(record, ["stackName", "stack", "stack_name"]) || inferStackName(github?.cloneSpec || name),
      goal: stringField(record, ["goal", "highLevelGoal"]),
      focus: stringField(record, ["focus", "recentProgress", "insight"]),
      docs: stringArrayField(record, ["docs", "docsUrls"]),
      environments: stringArrayField(record, ["environments"]),
      tags: stringArrayField(record, ["tags"]),
      apiDocsUrl,
      mcpDocsUrl,
    };
    if (
      !github &&
      candidate.stackName !== "Project YouStack" &&
      recent.some((existing) => existing.source !== "youmd" && existing.stackName === candidate.stackName)
    ) {
      skipped.push({ name, reason: `covered by recent ${candidate.stackName} repo` });
      continue;
    }
    pushCandidate(candidate, dedupeKey);
  }

  return {
    rootDir,
    recent,
    older,
    skipped,
    sourceCounts: {
      portfolioGraphProjects: graphProjectRecords.length,
      portfolioGraphTrackedProjects: graphGithubProjects.length,
      githubProjects: options.githubProjects?.length ?? 0,
      bundleProjects: projects.length,
    },
  };
}
