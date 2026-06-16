import * as path from "path";

export type ProjectRecency = "recent" | "active-undated" | "older";

export interface MachineProjectCandidate {
  name: string;
  repoName: string;
  targetDirName: string;
  githubUrl?: string;
  cloneSpec?: string;
  projectUrl?: string;
  fullName?: string;
  status?: string;
  updatedAt?: string;
  recency: ProjectRecency;
  reason: string;
  source: "youmd" | "github" | "youmd+github";
  stackName?: string;
  apiDocsUrl: string;
  mcpDocsUrl: string;
}

export interface MachineProjectPlan {
  rootDir: string;
  recent: MachineProjectCandidate[];
  older: MachineProjectCandidate[];
  skipped: Array<{ name: string; reason: string }>;
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
    const match = value.match(/(?:https?:\/\/github\.com\/[^\s),]+|git@github\.com:[^\s),]+|[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/i);
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
    apiDocsUrl?: string;
    mcpDocsUrl?: string;
  },
): MachineProjectPlan {
  const rootDir = path.resolve(options.rootDir);
  const activeDays = options.activeDays ?? 90;
  const now = options.now ?? new Date();
  const apiDocsUrl = options.apiDocsUrl ?? DEFAULT_API_DOCS_URL;
  const mcpDocsUrl = options.mcpDocsUrl ?? DEFAULT_MCP_DOCS_URL;
  const root = asRecord(youJson);
  const projects = Array.isArray(root.projects) ? root.projects : [];
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

  const bundleRecords = projects.map(asRecord);

  for (const repo of options.githubProjects ?? []) {
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
    const classified = classifyProject(record, now, activeDays);
    const targetDirName = stableDirName(github.repo);
    pushCandidate(
      {
        name,
        repoName: github.repo,
        targetDirName,
        githubUrl: github.url,
        cloneSpec: github.cloneSpec,
        projectUrl: repo.homepage || undefined,
        fullName: repo.fullName,
        status: stringField(record, ["status", "state"]) || undefined,
        updatedAt: classified.updatedAt,
        recency: classified.recency,
        reason: classified.reason,
        source: matchingBundle ? "youmd+github" : "github",
        stackName: inferStackName(repo.fullName),
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
    const candidate: MachineProjectCandidate = {
      name,
      repoName,
      targetDirName,
      githubUrl: github?.url,
      cloneSpec: github?.cloneSpec,
      projectUrl: stringField(record, ["website", "homepage", "projectUrl", "project_url"]) || undefined,
      fullName: github?.cloneSpec,
      status: stringField(record, ["status", "state"]) || undefined,
      updatedAt: classified.updatedAt,
      recency: classified.recency,
      reason: classified.reason,
      source: "youmd",
      stackName: inferStackName(github?.cloneSpec || name),
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

  return { rootDir, recent, older, skipped };
}
