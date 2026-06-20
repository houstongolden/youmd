#!/usr/bin/env node
/**
 * You.md MCP Server — Identity context protocol for the agent internet.
 *
 * An MCP where the context is you. Every agent that connects gets structured,
 * portable identity context: who you are, how you work, what you sound like.
 *
 * Resources: identity, agent brief, profile sections, preferences, voice,
 *            directives, memories, projects, skills
 * Tools:     whoami, get_agent_brief, add_memory, update_section,
 *            search_memories, use_skill, compile_bundle, push_bundle, get_project_context,
 *            add_source, create_context_link, list_projects, get_remote_status,
 *            get_stack_manifest, get_stack_capabilities, route_stack_request, smoke_stack
 *
 * Transport: stdio (for Claude Code, Cursor, any MCP client)
 *
 * Usage:
 *   youmd mcp                   # start MCP server
 *   youmd mcp --json             # output config JSON for claude_desktop_config
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
// T14: CLI tool registry — single source of truth for future tool additions.
import { CLI_MCP_TOOLS, type CliMcpCtx } from "./registry.js";
import * as fs from "fs";
import * as path from "path";
import {
  getGlobalConfigDir,
  getHomeBundleDir,
  getLegacyHomeBundleDir,
  getLocalBundleDir,
  bundleLooksInitialized,
  readGlobalConfig,
  isAuthenticated,
  getConvexSiteUrl,
  detectProjectContext,
} from "../lib/config";
import {
  findProjectsRoot,
  listProjects,
  detectCurrentProject,
  readProjectContext,
  getProjectDir,
  addProjectMemory,
} from "../lib/project";
import {
  findRepoContextRoot,
  readContextFile,
  readMergedProjectContext,
  resolveProjectContext,
} from "../lib/projectContext";
import {
  getYouStackReadiness,
  getYouStackCapabilities,
  loadYouStackManifest,
  routeYouStackRequest,
  runYouStackSmoke,
} from "../lib/youstack";
import {
  PORTFOLIO_GRAPH_BRIEF,
  formatPortfolioGraphBriefMarkdown,
  portfolioGraphBriefFromSnapshot,
  type PortfolioGraphBrief,
} from "../lib/portfolio-graph";

const MCP_SERVER_VERSION = "0.6.23";

function getCurrentProject(): { name: string; dir: string } | null {
  const root = findProjectsRoot();
  if (!root) return null;
  const name = detectCurrentProject(root);
  if (!name) return null;
  return { name, dir: getProjectDir(root, name) };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readFileOr(filePath: string, fallback: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return fallback;
  }
}

function readJsonOr(filePath: string, fallback: unknown): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function sortByMtimeDesc(files: string[]): string[] {
  return files.sort((a, b) => {
    try {
      const delta = fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs;
      if (delta !== 0) return delta;
    } catch {
      // fall through to deterministic basename order
    }
    return path.basename(b).localeCompare(path.basename(a));
  });
}

function findLatestAgentStackInventoryJson(): string | null {
  const dirs = [
    path.join(getHomeBundleDir(), "agent-stack-inventory"),
    path.join(getLegacyHomeBundleDir(), "agent-stack-inventory"),
  ];
  const files: string[] = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      for (const file of fs.readdirSync(dir)) {
        if (/^local-agent-stack-inventory-.*\.json$/.test(file)) {
          files.push(path.join(dir, file));
        }
      }
    } catch {
      // skip unreadable inventory dirs
    }
  }
  return sortByMtimeDesc(files)[0] ?? null;
}

function latestAgentStackInventoryResource(): {
  jsonPath: string;
  htmlPath: string;
  snapshot: Record<string, unknown>;
} | null {
  const jsonPath = findLatestAgentStackInventoryJson();
  if (!jsonPath) return null;
  const snapshot = readJsonOr(jsonPath, {}) as Record<string, unknown>;
  if (!snapshot || typeof snapshot !== "object") return null;
  return {
    jsonPath,
    htmlPath: jsonPath.replace(/\.json$/, ".html"),
    snapshot,
  };
}

function getBundleDir(): string {
  const localDir = getLocalBundleDir();
  if (bundleLooksInitialized(localDir)) return localDir;

  const homeDir = getHomeBundleDir();
  if (bundleLooksInitialized(homeDir)) return homeDir;

  return localDir;
}

export function activeBundleExists(): boolean {
  return bundleLooksInitialized(getBundleDir());
}

function getYouJson(): Record<string, unknown> {
  const bundleDir = getBundleDir();
  const youJsonPath = path.join(bundleDir, "you.json");
  return readJsonOr(youJsonPath, {}) as Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function getYouMd(): string {
  const bundleDir = getBundleDir();
  return readFileOr(path.join(bundleDir, "you.md"), "");
}

function getSectionFiles(): Array<{ slug: string; dir: string; content: string }> {
  const bundleDir = getBundleDir();
  const sections: Array<{ slug: string; dir: string; content: string }> = [];
  const dirs = ["profile", "preferences", "voice", "directives"];

  for (const dir of dirs) {
    const dirPath = path.join(bundleDir, dir);
    if (!fs.existsSync(dirPath)) continue;
    try {
      const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".md"));
      for (const file of files) {
        const slug = file.replace(/\.md$/, "");
        const content = readFileOr(path.join(dirPath, file), "");
        sections.push({ slug, dir, content });
      }
    } catch {
      // skip
    }
  }
  return sections;
}

export function getInstalledSkills(): Array<{ name: string; rendered: string; raw: string }> {
  const skillsDir = path.join(getGlobalConfigDir(), "skills");
  if (!fs.existsSync(skillsDir)) return [];

  const skills: Array<{ name: string; rendered: string; raw: string }> = [];
  try {
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillDir = path.join(skillsDir, entry.name);
      const raw = readFileOr(path.join(skillDir, "SKILL.md"), "");
      const rendered = readFileOr(path.join(skillDir, "RENDERED.md"), raw);
      if (raw || rendered) {
        skills.push({ name: entry.name, rendered, raw });
      }
    }
  } catch {
    // skip
  }
  return skills;
}

function tryLoadCurrentYouStack(inputPath?: string): ReturnType<typeof loadYouStackManifest> | null {
  try {
    return loadYouStackManifest(inputPath);
  } catch {
    return null;
  }
}

type ProtectedReadinessStatus = "ready" | "auth_required" | "unavailable";

interface ProtectedReadiness {
  status: ProtectedReadinessStatus;
  ready: boolean;
  reason: string;
  fallback: string;
}

interface MemoryRetrievalEnvelope {
  readiness: ProtectedReadiness;
  memories: unknown[];
  count: number;
}

// Mirror of the canonical convex/lib/agentContext.ts assembly. The CLI is a
// separately published npm package and cannot import the convex module at
// runtime; cli/src/__tests__/agent-context-parity.test.ts asserts the two
// implementations never drift (cap, durable set, ordering, one-line collapse,
// identity summary). Exported for that parity test.

/** Max memories rendered into the agent brief (parity with hosted MCP). */
export const AGENT_BRIEF_MEMORY_CAP = 20;

/** Categories considered durable — surfaced ahead of newer ephemeral notes. */
export const DURABLE_MEMORY_CATEGORIES = new Set([
  "preference",
  "decision",
  "goal",
  "fact",
]);

export interface BriefMemory {
  category: string;
  content: string;
  source?: string;
  sourceAgent?: string;
  createdAt?: number;
}

function asBriefMemories(memories: unknown[]): BriefMemory[] {
  return memories.filter(
    (m): m is BriefMemory =>
      !!m &&
      typeof m === "object" &&
      typeof (m as BriefMemory).category === "string" &&
      typeof (m as BriefMemory).content === "string"
  );
}

/** Durable categories first, preserving server order (newest-first) within each group. */
export function orderBriefMemories(memories: BriefMemory[]): BriefMemory[] {
  const durable: BriefMemory[] = [];
  const rest: BriefMemory[] = [];
  for (const memory of memories) {
    (DURABLE_MEMORY_CATEGORIES.has(memory.category) ? durable : rest).push(memory);
  }
  return [...durable, ...rest];
}

/** Collapse memory content to a single line capped at `max` chars. */
export function briefOneLine(content: string, max = 200): string {
  const collapsed = content.replace(/\s+/g, " ").trim();
  return collapsed.length > max ? `${collapsed.slice(0, max - 1).trimEnd()}…` : collapsed;
}

interface PrivateContextRetrievalEnvelope {
  readiness: ProtectedReadiness;
  privateContext: Record<string, unknown> | null;
  summary: {
    hasNotes: boolean;
    linkCount: number;
    projectCount: number;
  };
}

type ProjectContextReadinessStatus = "ready" | "not_found";

interface ProjectContextReadiness {
  status: ProjectContextReadinessStatus;
  ready: boolean;
  reason: string;
  fallback: string;
}

interface ProjectContextEnvelope {
  readiness: ProjectContextReadiness;
  project: {
    name: string | null;
    source: "current" | "named";
  };
  projectContext: ReturnType<typeof readProjectContext>;
}

export async function fetchMemoriesEnvelope(category?: string, limit?: number): Promise<MemoryRetrievalEnvelope> {
  if (!isAuthenticated()) {
    return {
      readiness: {
        status: "auth_required",
        ready: false,
        reason: "Memory search needs an authenticated You.md session or API key.",
        fallback: "Use public identity, project-context files, or run `you login` before retrying protected memory search.",
      },
      memories: [],
      count: 0,
    };
  }

  const config = readGlobalConfig();
  const siteUrl = getConvexSiteUrl();
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (limit) params.set("limit", String(limit));

  try {
    const res = await fetch(`${siteUrl}/api/v1/me/memories?${params}`, {
      headers: { Authorization: `Bearer ${config.token}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return {
        readiness: {
          status: "unavailable",
          ready: false,
          reason: `Memory search failed with HTTP ${res.status}.`,
          fallback: "Use project-context files or local stack files first, then retry protected memory search when auth/server access is healthy.",
        },
        memories: [],
        count: 0,
      };
    }

    const data = await res.json() as Record<string, unknown>;
    const memories = ((data.memories || data) as unknown[]) || [];
    return {
      readiness: {
        status: "ready",
        ready: true,
        reason: memories.length > 0 ? "Protected memory search succeeded." : "Protected memory search succeeded but found no matching memories.",
        fallback: memories.length > 0 ? "None needed." : "If nothing matched, fall back to public identity, project-context files, or a narrower keyword query.",
      },
      memories,
      count: memories.length,
    };
  } catch {
    return {
      readiness: {
        status: "unavailable",
        ready: false,
        reason: "Memory search could not reach the protected You.md memories endpoint.",
        fallback: "Use public identity, project-context files, or local stack context first, then retry protected memory search later.",
      },
      memories: [],
      count: 0,
    };
  }
}

export async function fetchPrivateContextEnvelope(): Promise<PrivateContextRetrievalEnvelope> {
  if (!isAuthenticated()) {
    return {
      readiness: {
        status: "auth_required",
        ready: false,
        reason: "Private context needs an authenticated You.md session or API key.",
        fallback: "Use local stack files, project-context files, public identity, or run `you login` before retrying protected private-context access.",
      },
      privateContext: null,
      summary: {
        hasNotes: false,
        linkCount: 0,
        projectCount: 0,
      },
    };
  }

  const config = readGlobalConfig();
  const siteUrl = getConvexSiteUrl();

  try {
    const res = await fetch(`${siteUrl}/api/v1/me/private`, {
      headers: { Authorization: `Bearer ${config.token}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return {
        readiness: {
          status: "unavailable",
          ready: false,
          reason: `Private context fetch failed with HTTP ${res.status}.`,
          fallback: "Use local stack files, project-context files, or public identity first, then retry protected private-context access when auth/server access is healthy.",
        },
        privateContext: null,
        summary: {
          hasNotes: false,
          linkCount: 0,
          projectCount: 0,
        },
      };
    }

    const privateContext = await res.json() as Record<string, unknown> | null;
    const links = privateContext && typeof privateContext === "object" && privateContext.internalLinks && typeof privateContext.internalLinks === "object"
      ? Object.keys(privateContext.internalLinks as Record<string, unknown>).length
      : 0;
    const projects = Array.isArray(privateContext?.privateProjects) ? privateContext.privateProjects.length : 0;
    const hasNotes = typeof privateContext?.privateNotes === "string" && privateContext.privateNotes.trim().length > 0;

    return {
      readiness: {
        status: "ready",
        ready: true,
        reason: privateContext
          ? "Protected private context fetch succeeded."
          : "Protected private context fetch succeeded but no private context is stored yet.",
        fallback: privateContext
          ? "None needed."
          : "If private context is empty, fall back to local stack files, project-context files, or public identity.",
      },
      privateContext,
      summary: {
        hasNotes,
        linkCount: links,
        projectCount: projects,
      },
    };
  } catch {
    return {
      readiness: {
        status: "unavailable",
        ready: false,
        reason: "Private context fetch could not reach the protected You.md private-context endpoint.",
        fallback: "Use local stack files, project-context files, or public identity first, then retry protected private-context access later.",
      },
      privateContext: null,
      summary: {
        hasNotes: false,
        linkCount: 0,
        projectCount: 0,
      },
    };
  }
}

function fetchProjectContextEnvelope(projectName?: string): ProjectContextEnvelope {
  // Reads route through the single project-context engine: the repo
  // project-context/ directory is overlaid on the global store, repo wins
  // on file conflicts, and readers see the union (PRODUCT-AUDIT #14).
  if (projectName) {
    const ctx = readMergedProjectContext({ projectName });
    if (!ctx) {
      const hasAnyRoot = !!findProjectsRoot() || !!findRepoContextRoot();
      if (!hasAnyRoot) {
        return {
          readiness: {
            status: "not_found",
            ready: false,
            reason: "No projects directory was found for the requested named project.",
            fallback: "Use local project-context files from the current repo, public identity, or a current project detection flow before retrying a named project lookup.",
          },
          project: {
            name: projectName,
            source: "named",
          },
          projectContext: null,
        };
      }
      return {
        readiness: {
          status: "not_found",
          ready: false,
          reason: `Project context for ${projectName} was not found or is incomplete.`,
          fallback: "Use local repo instructions, project-context files, or confirm the named project exists before retrying.",
        },
        project: {
          name: projectName,
          source: "named",
        },
        projectContext: null,
      };
    }

    return {
      readiness: {
        status: "ready",
        ready: true,
        reason: `Project context for ${projectName} is available.`,
        fallback: "None needed.",
      },
      project: {
        name: projectName,
        source: "named",
      },
      projectContext: ctx,
    };
  }

  const current = getCurrentProject();
  if (!current) {
    // No managed project matches the cwd — the repo overlay alone may
    // still provide the context union.
    const repoCtx = readMergedProjectContext({});
    if (repoCtx) {
      return {
        readiness: {
          status: "ready",
          ready: true,
          reason: `Project context for ${repoCtx.meta.name} is available.`,
          fallback: "None needed.",
        },
        project: {
          name: repoCtx.meta.name,
          source: "current",
        },
        projectContext: repoCtx,
      };
    }
    return {
      readiness: {
        status: "not_found",
        ready: false,
        reason: "No current project was detected from the working directory.",
        fallback: "Use local project-context files in the current repo, pass an explicit project name, or fall back to public identity and stack files.",
      },
      project: {
        name: null,
        source: "current",
      },
      projectContext: null,
    };
  }

  const ctx = readMergedProjectContext({ projectName: current.name }) || readProjectContext(current.dir);
  if (!ctx) {
    return {
      readiness: {
        status: "not_found",
        ready: false,
        reason: `Project context for ${current.name} was detected but could not be read.`,
        fallback: "Use repo-local instructions and project-context markdown files directly, then repair the named project bundle before retrying.",
      },
      project: {
        name: current.name,
        source: "current",
      },
      projectContext: null,
    };
  }

  return {
    readiness: {
      status: "ready",
      ready: true,
      reason: `Project context for ${current.name} is available.`,
      fallback: "None needed.",
    },
    project: {
      name: current.name,
      source: "current",
    },
    projectContext: ctx,
  };
}

export async function apiRequest(path: string, opts?: { method?: string; body?: unknown }): Promise<unknown> {
  const config = readGlobalConfig();
  const siteUrl = getConvexSiteUrl();
  const res = await fetch(`${siteUrl}${path}`, {
    method: opts?.method || "GET",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  return res.json();
}

async function fetchPersistedPortfolioGraphSnapshot(): Promise<Record<string, unknown> | null> {
  if (!isAuthenticated()) return null;
  try {
    const result = await apiRequest("/api/v1/me/portfolio/graph?includeTasks=1");
    if (!result || typeof result !== "object") return null;
    const projects = (result as { projects?: unknown }).projects;
    if (!Array.isArray(projects) || projects.length === 0) return null;
    return result as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Agent attribution. Resolution order:
 *   1. YOUMD_AGENT_NAME env (set by generated MCP configs per host)
 *   2. MCP clientInfo.name from the initialize handshake
 *   3. "MCP Agent" — honest unknown instead of misattributing to one host
 */
let mcpClientName: string | null = null;

export function setMcpClientName(name: string | undefined | null): void {
  mcpClientName = typeof name === "string" && name.trim() ? name.trim() : null;
}

/** Friendly display names for well-known MCP clientInfo.name values. */
const CLIENT_NAME_MAP: Record<string, string> = {
  "claude-code": "Claude Code",
  "claude": "Claude Code",
  "claude-desktop": "Claude Desktop",
  "cursor": "Cursor",
  "cursor-vscode": "Cursor",
  "codex": "Codex",
  "codex-cli": "Codex",
  "windsurf": "Windsurf",
};

export function resolveAgentName(): string {
  const envName = process.env.YOUMD_AGENT_NAME?.trim();
  if (envName) return envName;
  if (mcpClientName) {
    return CLIENT_NAME_MAP[mcpClientName.toLowerCase()] || mcpClientName;
  }
  return "MCP Agent";
}

/**
 * Fire-and-forget activity logger. Logs every MCP tool call so the user can
 * see which agents are using their you.md identity via `youmd logs` or the
 * web shell. Non-fatal — failures are swallowed so logging can't break tool
 * calls.
 */
async function logMcpActivity(action: string, resource?: string, details?: Record<string, unknown>): Promise<void> {
  if (!isAuthenticated()) return;
  try {
    const config = readGlobalConfig();
    await fetch(`${getConvexSiteUrl()}/api/v1/me/activity/log`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
        "User-Agent": "youmd-mcp/0.6.23",
      },
      body: JSON.stringify({
        agentName: resolveAgentName(),
        agentSource: "mcp",
        action,
        resource,
        status: "success",
        details,
      }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // non-fatal — logging shouldn't break tool calls
  }
}

// Valid memory categories enforced by add_memory
export const MEMORY_CATEGORIES = [
  "fact",
  "preference",
  "decision",
  "project",
  "goal",
  "insight",
  "context",
  "relationship",
] as const;

/**
 * Build a compact (~500 char) identity summary. This is what the whoami tool
 * and the `compact` format of get_identity return. Designed to be the very
 * first call an agent makes so it can orient on the user in <1 tool round.
 */
function buildWhoamiSummary(): string {
  return buildWhoamiSummaryFromYouJson(getYouJson());
}

/**
 * Pure whoami summary from a youJson bundle. Mirror of the canonical
 * extractIdentityCore + renderIdentitySummary in convex/lib/agentContext.ts;
 * exported for the agent-context parity test.
 */
export function buildWhoamiSummaryFromYouJson(
  youJson: Record<string, unknown>
): string {
  const identity = asRecord(youJson.identity);
  const preferences = asRecord(youJson.preferences);
  const agentPrefs = asRecord(preferences.agent);
  const directives = asRecord(youJson.agent_directives);
  const projects = Array.isArray(youJson.projects) ? youJson.projects : [];

  const bio = asRecord(identity.bio);
  const name = typeof identity.name === "string"
    ? identity.name
    : typeof youJson.username === "string" ? youJson.username : "(unknown)";
  const role = typeof identity.tagline === "string"
    ? identity.tagline
    : typeof bio.short === "string" ? bio.short : "";
  const stack = typeof directives.default_stack === "string" ? directives.default_stack : "";
  const tone = typeof agentPrefs.tone === "string" ? agentPrefs.tone : "";
  const avoidList = Array.isArray(agentPrefs.avoid)
    ? agentPrefs.avoid.filter((item): item is string => typeof item === "string")
    : [];
  const avoid = avoidList.join(", ");
  const topProjects = projects
    .slice(0, 3)
    .map((project) => {
      if (typeof project === "string") return project;
      const record = asRecord(project);
      return typeof record.name === "string" ? record.name : "";
    })
    .filter(Boolean)
    .join(", ");
  const goal = typeof directives.current_goal === "string" ? directives.current_goal : "";

  const lines: string[] = [];
  lines.push(`Name: ${name}`);
  if (role) lines.push(`Role: ${role}`);
  if (stack) lines.push(`Stack: ${stack}`);
  if (tone) lines.push(`Tone: ${tone}`);
  if (avoid) lines.push(`Avoid: ${avoid}`);
  if (topProjects) lines.push(`Top projects: ${topProjects}`);
  if (goal) lines.push(`Goal: ${goal}`);

  let summary = lines.join("\n");
  // Hard cap at ~500 chars to keep it cheap for agents
  if (summary.length > 500) {
    summary = summary.slice(0, 497) + "...";
  }
  return summary;
}

/**
 * Build a human-readable markdown version of the identity bundle.
 * Used by get_identity format=markdown.
 */
function buildIdentityMarkdown(): string {
  const md = getYouMd();
  if (md) return md;

  // Fallback: synthesize from youJson if you.md is missing
  const youJson = getYouJson();
  const identity = asRecord(youJson.identity);
  const bio = asRecord(identity.bio);
  const parts: string[] = [];
  const title = typeof identity.name === "string"
    ? identity.name
    : typeof youJson.username === "string" ? youJson.username : "Identity";
  parts.push(`# ${title}`);
  if (typeof identity.tagline === "string") parts.push(identity.tagline);
  const about = typeof bio.long === "string"
    ? bio.long
    : typeof bio.medium === "string"
      ? bio.medium
      : typeof bio.short === "string" ? bio.short : "";
  if (about) {
    parts.push(`\n## About\n\n${about}`);
  }
  return parts.join("\n") + "\n";
}

/**
 * Returns true if the current cwd has local project context available
 * (either via project-context/ directory or a .youmd-project marker).
 * Detection and reads route through the single project-context engine
 * (lib/projectContext.ts) — repo files overlay the global store.
 */
function hasLocalProjectContext(): boolean {
  return findRepoContextRoot() !== null;
}

/**
 * Read a single project-context markdown file via the engine's overlay
 * union (repo project-context/ wins over the global overlay; legacy
 * top-level repo files still resolve). Returns empty string if not found.
 */
function readLocalProjectContextFile(name: string): string {
  const resolved = resolveProjectContext();
  return readContextFile(resolved, name)?.content || "";
}

interface AgentBriefFile {
  path: string;
  exists: boolean;
  chars?: number;
  summary?: string;
}

interface AgentBriefProject {
  name: string;
  root: string;
  marker: string;
  instructionFiles: AgentBriefFile[];
  contextFiles: AgentBriefFile[];
  activeRequests: string[];
  openTodos: string[];
  knownIssues: string[];
}

export interface AgentBrief {
  generatedAt: string;
  user: {
    summary: string;
    authenticated: boolean;
    bundleDir: string;
    bundleInitialized: boolean;
  };
  environment: {
    cwd: string;
    mcpVersion: string;
  };
  project: AgentBriefProject | null;
  skills: {
    installed: string[];
    recommended: string[];
  };
  portfolioGraph: PortfolioGraphBrief;
  memoriesReadiness?: MemoryRetrievalEnvelope["readiness"];
  memories?: BriefMemory[];
  nextMoves: string[];
  reminders: string[];
}

function firstContentLines(content: string, limit = 3): string {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("---") && !line.startsWith("#") && !line.startsWith("<!--"));

  return lines.slice(0, limit).join(" ").slice(0, 280);
}

function readBriefFile(root: string, relativePath: string): AgentBriefFile {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    return { path: relativePath, exists: false };
  }

  try {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      return { path: relativePath, exists: true, summary: "directory" };
    }
    const content = fs.readFileSync(filePath, "utf-8");
    return {
      path: relativePath,
      exists: true,
      chars: content.length,
      summary: firstContentLines(content),
    };
  } catch {
    return { path: relativePath, exists: true, summary: "unreadable" };
  }
}

function readProjectFile(root: string, relativePath: string): string {
  const filePath = path.join(root, relativePath);
  return readFileOr(filePath, "");
}

function collectInstructionFiles(root: string): AgentBriefFile[] {
  const candidates = [
    "AGENTS.md",
    "CLAUDE.md",
    ".you/AGENT.md",
    ".you/STACK-MAP.md",
    ".cursor/rules/youmd.mdc",
    ".cursor/rules/youmd.md",
    ".claude/skills/youmd",
    ".codex/skills/youmd",
  ];

  return candidates
    .map((candidate) => readBriefFile(root, candidate))
    .filter((file) => file.exists);
}

function collectContextFiles(root: string): AgentBriefFile[] {
  const candidates = [
    "project-context/CURRENT_STATE.md",
    "project-context/feature-requests-active.md",
    "project-context/TODO.md",
    "project-context/FEATURES.md",
    "project-context/CHANGELOG.md",
    "project-context/PRD.md",
    "project-context/ARCHITECTURE.md",
    "project-context/STYLE_GUIDE.md",
    "project-context/BRANDING.md",
  ];

  return candidates
    .map((candidate) => readBriefFile(root, candidate))
    .filter((file) => file.exists);
}

function extractOpenTodos(content: string, limit = 8): string[] {
  const todos: string[] = [];
  for (const line of content.split("\n")) {
    const match = line.match(/^\s*-\s+\[\s\]\s+(.+)$/);
    if (match) todos.push(match[1].trim());
    if (todos.length >= limit) break;
  }
  return todos;
}

function extractActiveRequests(content: string, limit = 6): string[] {
  const requests: string[] = [];
  const chunks = content.split(/\n(?=###\s+)/g);

  for (const chunk of chunks) {
    const titleMatch = chunk.match(/^###\s+(.+)$/m);
    if (!titleMatch) continue;

    const statusMatch = chunk.match(/\*\*Status:\*\*\s*([^\n]+)/);
    const status = statusMatch?.[1]?.trim() || "UNKNOWN";
    if (/^(DONE|VERIFIED BY USER|DECIDED|N\/A)/i.test(status)) continue;

    requests.push(`${titleMatch[1].trim()} [${status}]`);
    if (requests.length >= limit) break;
  }

  return requests;
}

function extractSectionBullets(content: string, heading: string, limit = 6): string[] {
  const lines = content.split("\n");
  const start = lines.findIndex((line) => line.trim().toLowerCase() === `## ${heading.toLowerCase()}`);
  if (start < 0) return [];

  const bullets: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s+/.test(line)) break;
    const match = line.match(/^\s*-\s+(.+)$/);
    if (match) bullets.push(match[1].trim());
    if (bullets.length >= limit) break;
  }
  return bullets;
}

function buildProjectBrief(): AgentBriefProject | null {
  const detected = detectProjectContext();
  const fallbackRoot = findRepoContextRoot();
  const root = detected?.root || fallbackRoot;
  if (!root) return null;

  const activeRequests = extractActiveRequests(
    readProjectFile(root, "project-context/feature-requests-active.md"),
  );
  const openTodos = extractOpenTodos(readProjectFile(root, "project-context/TODO.md"));
  const knownIssues = extractSectionBullets(
    readProjectFile(root, "project-context/CURRENT_STATE.md"),
    "Known Issues",
  );

  return {
    name: detected?.name || path.basename(root),
    root,
    marker: detected?.marker || "project-context",
    instructionFiles: collectInstructionFiles(root),
    contextFiles: collectContextFiles(root),
    activeRequests,
    openTodos,
    knownIssues,
  };
}

export async function buildAgentBrief(options: { includeMemories?: boolean } = {}): Promise<AgentBrief> {
  const project = buildProjectBrief();
  const installedSkills = getInstalledSkills().map((skill) => skill.name).sort();
  const nextMoves: string[] = [];

  if (project?.activeRequests.length) {
    nextMoves.push(`Address the top active request: ${project.activeRequests[0]}`);
  }
  if (project?.openTodos.length) {
    nextMoves.push(`Use the first open TODO as backlog context: ${project.openTodos[0]}`);
  }
  if (project && project.contextFiles.length === 0) {
    nextMoves.push("Bootstrap project-context with: youmd skill init-project --mode additive");
  }
  if (installedSkills.includes("portfolio-graph-auditor")) {
    nextMoves.push("Before adding APIs, MCP routes, env integrations, stacks, or reusable UI/code patterns, consult the portfolio graph and run: youmd project portfolio-audit --root ~/Desktop/CODE_2025");
  } else {
    nextMoves.push("Install the portfolio graph auditor with: youmd skill install portfolio-graph-auditor");
  }
  if (!installedSkills.includes("youstack-start")) {
    nextMoves.push("Install the YouStack starter skill with: youmd skill install youstack-start");
  }
  if (nextMoves.length === 0) {
    nextMoves.push("Read the project instructions, pick the highest-signal task, and act end-to-end.");
  }

  const persistedPortfolioGraph = await fetchPersistedPortfolioGraphSnapshot();
  const brief: AgentBrief = {
    generatedAt: new Date().toISOString(),
    user: {
      summary: buildWhoamiSummary(),
      authenticated: isAuthenticated(),
      bundleDir: getBundleDir(),
      bundleInitialized: activeBundleExists(),
    },
    environment: {
      cwd: process.cwd(),
      mcpVersion: MCP_SERVER_VERSION,
    },
    project,
    skills: {
      installed: installedSkills,
      recommended: [
        "youstack-start",
        "project-context-init",
        "portfolio-graph-auditor",
        "proactive-context-fill",
        "voice-sync",
        "you-logs",
      ],
    },
    portfolioGraph: portfolioGraphBriefFromSnapshot(persistedPortfolioGraph),
    nextMoves: nextMoves.slice(0, 5),
    reminders: [
      "Read the whole user request before acting; split multi-part asks into tracked items.",
      "Prefer local project instructions and project-context files before asking for context.",
      "When making changes, update TODO, FEATURES, CHANGELOG, active requests, and PROMPTS before closing.",
      "Do not claim files were written or pushed unless the tool call actually succeeded.",
    ],
  };

  // Memories are included by default (parity with hosted get_agent_brief:
  // the brief must surface memory CONTENT, not a count — opt out explicitly).
  if (options.includeMemories !== false) {
    const memoryResult = await fetchMemoriesEnvelope(undefined, AGENT_BRIEF_MEMORY_CAP * 3);
    brief.memoriesReadiness = memoryResult.readiness;
    brief.memories = orderBriefMemories(asBriefMemories(memoryResult.memories))
      .slice(0, AGENT_BRIEF_MEMORY_CAP);
  }

  return brief;
}

function renderFileList(files: AgentBriefFile[]): string {
  if (files.length === 0) return "- none detected";
  return files.map((file) => {
    const detail = file.summary ? ` - ${file.summary}` : "";
    const chars = typeof file.chars === "number" ? ` (${file.chars} chars)` : "";
    return `- ${file.path}${chars}${detail}`;
  }).join("\n");
}

function renderList(items: string[], empty: string): string {
  if (items.length === 0) return `- ${empty}`;
  return items.map((item) => `- ${item}`).join("\n");
}

export function formatAgentBriefMarkdown(brief: AgentBrief, maxChars = 10000): string {
  const project = brief.project;
  const lines: string[] = [];

  lines.push("# YouStack Agent Brief");
  lines.push("");
  lines.push("## User");
  lines.push(brief.user.summary || "(no identity summary available)");
  lines.push("");
  lines.push(`- authenticated: ${brief.user.authenticated ? "yes" : "no"}`);
  lines.push(`- bundle: ${brief.user.bundleInitialized ? brief.user.bundleDir : "not initialized"}`);
  lines.push(`- cwd: ${brief.environment.cwd}`);
  lines.push("");

  lines.push("## Project");
  if (project) {
    lines.push(`- name: ${project.name}`);
    lines.push(`- root: ${project.root}`);
    lines.push(`- marker: ${project.marker}`);
    lines.push("");
    lines.push("### Instruction Files");
    lines.push(renderFileList(project.instructionFiles));
    lines.push("");
    lines.push("### Project Context");
    lines.push(renderFileList(project.contextFiles));
    lines.push("");
    lines.push("### Active Requests");
    lines.push(renderList(project.activeRequests, "none detected"));
    lines.push("");
    lines.push("### Open TODOs");
    lines.push(renderList(project.openTodos, "none detected"));
    if (project.knownIssues.length > 0) {
      lines.push("");
      lines.push("### Known Issues");
      lines.push(renderList(project.knownIssues, "none detected"));
    }
  } else {
    lines.push("- no local project detected");
  }
  lines.push("");

  lines.push("## Skills");
  lines.push(`- installed: ${brief.skills.installed.length > 0 ? brief.skills.installed.join(", ") : "none"}`);
  lines.push(`- recommended: ${brief.skills.recommended.join(", ")}`);
  lines.push("");

  lines.push(formatPortfolioGraphBriefMarkdown(brief.portfolioGraph));
  lines.push("");

  if (brief.memories) {
    // Render actual memory content lines, not a bare count (parity with the
    // hosted get_agent_brief).
    lines.push(`## Memories (${brief.memories.length})`);
    if (brief.memories.length === 0) {
      lines.push("- none recorded yet");
    } else {
      for (const memory of brief.memories) {
        lines.push(`- [${memory.category}] ${briefOneLine(memory.content)}`);
      }
    }
    if (brief.memoriesReadiness && !brief.memoriesReadiness.ready) {
      lines.push(`- readiness: ${brief.memoriesReadiness.status} (${brief.memoriesReadiness.reason})`);
      lines.push(`- fallback: ${brief.memoriesReadiness.fallback}`);
    }
    lines.push("");
  }

  lines.push("## Next Moves");
  lines.push(renderList(brief.nextMoves, "read instructions, then act"));
  lines.push("");
  lines.push("## Reminders");
  lines.push(renderList(brief.reminders, "none"));

  let markdown = lines.join("\n");
  if (markdown.length > maxChars) {
    markdown = markdown.slice(0, Math.max(0, maxChars - 32)).trimEnd() + "\n\n[truncated]";
  }
  return markdown;
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

export async function startMcpServer(): Promise<void> {
  const server = new Server(
    {
      name: "youmd",
      version: MCP_SERVER_VERSION,
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    }
  );

  // Capture clientInfo.name from the initialize handshake for activity
  // attribution (fallback when YOUMD_AGENT_NAME isn't set by the host config).
  server.oninitialized = () => {
    setMcpClientName(server.getClientVersion()?.name);
  };

  // ── LIST RESOURCES ─────────────────────────────────────────────────

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const resources: Array<{
      uri: string;
      name: string;
      description: string;
      mimeType: string;
    }> = [];

    // Core identity
    resources.push({
      uri: "youmd://identity",
      name: "identity",
      description: "Complete you.md identity bundle (you.json) — who you are, how you work, what you sound like",
      mimeType: "application/json",
    });

    resources.push({
      uri: "youmd://identity/markdown",
      name: "identity-markdown",
      description: "Human-readable you.md identity (you.md format)",
      mimeType: "text/markdown",
    });

    resources.push({
      uri: "youmd://agent/brief",
      name: "agent-brief",
      description: "YouStack startup brief for local agents: compact identity, project instructions, active requests, open TODOs, installed skills, portfolio graph, and next moves",
      mimeType: "text/markdown",
    });

    resources.push({
      uri: "youmd://portfolio/graph",
      name: "portfolio/graph",
      description: "Local portfolio graph: project/API/MCP ownership, reusable patterns, shared-skill propagation, and agent guardrails",
      mimeType: "application/json",
    });

    const latestAgentStackInventory = latestAgentStackInventoryResource();
    resources.push({
      uri: "youmd://agent-stack/inventory",
      name: "agent-stack/inventory",
      description: "Skill Mesh inventory summary: latest local report paths plus synced machine inventory/drift status when authenticated",
      mimeType: "application/json",
    });
    if (latestAgentStackInventory) {
      resources.push({
        uri: "youmd://agent-stack/report.json",
        name: "agent-stack/report.json",
        description: `Latest local Skill Mesh JSON report (${latestAgentStackInventory.jsonPath})`,
        mimeType: "application/json",
      });
      if (fs.existsSync(latestAgentStackInventory.htmlPath)) {
        resources.push({
          uri: "youmd://agent-stack/report.html",
          name: "agent-stack/report.html",
          description: `Latest local Skill Mesh HTML report (${latestAgentStackInventory.htmlPath})`,
          mimeType: "text/html",
        });
      }
    }

    const currentStack = tryLoadCurrentYouStack();
    if (currentStack) {
      resources.push({
        uri: "youmd://stacks/current/manifest",
        name: "stacks/current/manifest",
        description: "Current local YouStack manifest discovered from cwd",
        mimeType: "application/json",
      });
      resources.push({
        uri: "youmd://stacks/current/capabilities",
        name: "stacks/current/capabilities",
        description: "Current local YouStack capability map",
        mimeType: "application/json",
      });
    }

    // Profile sections
    const sections = getSectionFiles();
    for (const section of sections) {
      resources.push({
        uri: `youmd://${section.dir}/${section.slug}`,
        name: `${section.dir}/${section.slug}`,
        description: `Identity section: ${section.dir}/${section.slug}`,
        mimeType: "text/markdown",
      });
    }

    // Memories (if authenticated)
    if (isAuthenticated()) {
      resources.push({
        uri: "youmd://private-context",
        name: "private-context",
        description: "Protected private context — notes, internal links, and private projects with readiness/fallback guidance",
        mimeType: "application/json",
      });

      resources.push({
        uri: "youmd://memories",
        name: "memories",
        description: "Active memories — facts, preferences, decisions, and context the agent has learned about you",
        mimeType: "application/json",
      });

      // All active memories as JSON (alias to the base memories resource, but
      // exposed explicitly so agents can discover a stable "all" URI).
      resources.push({
        uri: "youmd://memories/all",
        name: "memories/all",
        description: "All active memories as JSON (every category combined)",
        mimeType: "application/json",
      });

      // Per-category memory resources. Agents can load only the slice they need
      // instead of pulling the full memory firehose.
      const memoryCategories: Array<{ slug: string; desc: string }> = [
        { slug: "preference", desc: "Preferences learned about the user (tone, format, defaults)" },
        { slug: "decision", desc: "Decisions the user has made (architecture, product, stack)" },
        { slug: "fact", desc: "Facts about the user (bio, stack, constraints)" },
        { slug: "project", desc: "Project-related memories" },
        { slug: "goal", desc: "Current goals and objectives" },
      ];
      for (const { slug, desc } of memoryCategories) {
        resources.push({
          uri: `youmd://memories/${slug}`,
          name: `memories/${slug}`,
          description: desc,
          mimeType: "application/json",
        });
      }
    }

    // Local project context auto-loaded from cwd (project-context/*.md).
    // Only surfaced when a project-context/ dir or .youmd-project marker exists.
    if (hasLocalProjectContext()) {
      const localFiles: Array<{ slug: string; desc: string }> = [
        { slug: "prd", desc: "Current project PRD (from local project-context/prd.md)" },
        { slug: "todo", desc: "Current project TODO list (from local project-context/todo.md)" },
        { slug: "features", desc: "Current project feature list (from local project-context/features.md)" },
        { slug: "decisions", desc: "Current project decisions log (from local project-context/decisions.md)" },
        { slug: "changelog", desc: "Current project changelog (from local project-context/changelog.md)" },
      ];
      for (const { slug, desc } of localFiles) {
        resources.push({
          uri: `youmd://project/current/${slug}`,
          name: `project/current/${slug}`,
          description: desc,
          mimeType: "text/markdown",
        });
      }
    }

    // Projects
    try {
      const root = findProjectsRoot();
      if (root) {
        const projects = listProjects(root);
        for (const name of projects) {
          resources.push({
            uri: `youmd://projects/${name}`,
            name: `project/${name}`,
            description: `Project context for ${name} — PRD, TODO, features, decisions, memories`,
            mimeType: "application/json",
          });
        }
      }
    } catch {
      // no projects
    }

    // Current project (auto-detected from cwd)
    try {
      const current = getCurrentProject();
      if (current) {
        resources.push({
          uri: "youmd://projects/current",
          name: "project/current",
          description: `Current project context (auto-detected: ${current.name})`,
          mimeType: "application/json",
        });
      }
    } catch {
      // no current project
    }

    // Skills
    const skills = getInstalledSkills();
    for (const skill of skills) {
      resources.push({
        uri: `youmd://skills/${skill.name}`,
        name: `skill/${skill.name}`,
        description: `Rendered skill: ${skill.name} — identity-aware agent instructions`,
        mimeType: "text/markdown",
      });
    }

    return { resources };
  });

  // ── READ RESOURCE ──────────────────────────────────────────────────

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;

    // youmd://identity
    if (uri === "youmd://identity") {
      const youJson = getYouJson();
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify(youJson, null, 2),
        }],
      };
    }

    // youmd://identity/markdown
    if (uri === "youmd://identity/markdown") {
      return {
        contents: [{
          uri,
          mimeType: "text/markdown",
          text: getYouMd(),
        }],
      };
    }

    // youmd://agent/brief
    if (uri === "youmd://agent/brief") {
      const brief = await buildAgentBrief();
      void logMcpActivity("read", "agent/brief");
      return {
        contents: [{
          uri,
          mimeType: "text/markdown",
          text: formatAgentBriefMarkdown(brief),
        }],
      };
    }

    if (uri === "youmd://portfolio/graph") {
      void logMcpActivity("read", "portfolio/graph");
      const persistedPortfolioGraph = await fetchPersistedPortfolioGraphSnapshot();
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify(persistedPortfolioGraph ?? PORTFOLIO_GRAPH_BRIEF, null, 2),
        }],
      };
    }

    if (uri === "youmd://agent-stack/inventory") {
      void logMcpActivity("read", "agent-stack/inventory");
      const latest = latestAgentStackInventoryResource();
      let synced: unknown = null;
      let drift: unknown = null;
      if (isAuthenticated()) {
        try {
          [synced, drift] = await Promise.all([
            apiRequest("/api/v1/me/agent-stack/inventories?limit=12"),
            apiRequest("/api/v1/me/agent-stack/drift?limit=12"),
          ]);
        } catch {
          // Keep local report usable even when the network/API is unavailable.
        }
      }
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify({
            schemaVersion: "you-md/local-agent-stack-resource/v1",
            generatedAt: Date.now(),
            local: latest
              ? {
                  jsonPath: latest.jsonPath,
                  htmlPath: fs.existsSync(latest.htmlPath) ? latest.htmlPath : null,
                  generatedAt: latest.snapshot.generatedAt ?? null,
                  hostName: latest.snapshot.hostName ?? latest.snapshot.hostname ?? null,
                  rootDir: (latest.snapshot.roots as { workspace?: unknown } | undefined)?.workspace ?? latest.snapshot.repoRoot ?? null,
                  totals: latest.snapshot.totals ?? null,
                  secretValuesExposed: latest.snapshot.secretValuesExposed === true,
                }
              : null,
            synced,
            drift,
            secretValuesExposed: false,
          }, null, 2),
        }],
      };
    }

    if (uri === "youmd://agent-stack/report.json" || uri === "youmd://agent-stack/report.html") {
      const latest = latestAgentStackInventoryResource();
      if (!latest) throw new Error("no local agent-stack inventory report found; run `you skill inventory --out-dir ~/.you/agent-stack-inventory --register-catalog --sync`");
      const filePath = uri.endsWith(".html") ? latest.htmlPath : latest.jsonPath;
      if (!fs.existsSync(filePath)) throw new Error(`agent-stack report file missing: ${filePath}`);
      void logMcpActivity("read", uri.endsWith(".html") ? "agent-stack/report.html" : "agent-stack/report.json");
      return {
        contents: [{
          uri,
          mimeType: uri.endsWith(".html") ? "text/html" : "application/json",
          text: readFileOr(filePath, ""),
        }],
      };
    }

    if (uri === "youmd://stacks/current/manifest") {
      const loaded = tryLoadCurrentYouStack();
      if (!loaded) throw new Error("no local YouStack manifest found from current directory");
      void logMcpActivity("read", "stacks/current/manifest");
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify({
            manifestPath: loaded.manifestPath,
            rootDir: loaded.rootDir,
            manifest: loaded.manifest,
            validation: loaded.validation,
          }, null, 2),
        }],
      };
    }

    if (uri === "youmd://stacks/current/capabilities") {
      const loaded = tryLoadCurrentYouStack();
      if (!loaded) throw new Error("no local YouStack manifest found from current directory");
      void logMcpActivity("read", "stacks/current/capabilities");
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify({
            stack: loaded.manifest.slug,
            capabilities: getYouStackCapabilities(loaded.manifest),
          }, null, 2),
        }],
      };
    }

    // youmd://memories
    if (uri === "youmd://memories" || uri === "youmd://memories/all") {
      const memories = await fetchMemoriesEnvelope(undefined, 50);
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify(memories, null, 2),
        }],
      };
    }

    // youmd://memories/{category}
    const memCatMatch = uri.match(/^youmd:\/\/memories\/(.+)$/);
    if (memCatMatch) {
      const memories = await fetchMemoriesEnvelope(memCatMatch[1], 50);
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify(memories, null, 2),
        }],
      };
    }

    if (uri === "youmd://private-context") {
      const privateContext = await fetchPrivateContextEnvelope();
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify(privateContext, null, 2),
        }],
      };
    }

    // youmd://project/current/{file} — local project-context files from cwd
    const localProjMatch = uri.match(/^youmd:\/\/project\/current\/(prd|todo|features|decisions|changelog)$/);
    if (localProjMatch) {
      const content = readLocalProjectContextFile(localProjMatch[1]);
      if (!content) {
        throw new Error(`no local project-context/${localProjMatch[1]}.md found in current directory or parents`);
      }
      return {
        contents: [{
          uri,
          mimeType: "text/markdown",
          text: content,
        }],
      };
    }

    // youmd://projects/current
    if (uri === "youmd://projects/current") {
      const ctx = fetchProjectContextEnvelope();
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify(ctx, null, 2),
        }],
      };
    }

    // youmd://projects/{name}
    const projMatch = uri.match(/^youmd:\/\/projects\/(.+)$/);
    if (projMatch) {
      const ctx = fetchProjectContextEnvelope(projMatch[1]);
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify(ctx, null, 2),
        }],
      };
    }

    // youmd://skills/{name}
    const skillMatch = uri.match(/^youmd:\/\/skills\/(.+)$/);
    if (skillMatch) {
      const skills = getInstalledSkills();
      const skill = skills.find((s) => s.name === skillMatch[1]);
      if (!skill) throw new Error(`skill not found: ${skillMatch[1]}`);
      return {
        contents: [{
          uri,
          mimeType: "text/markdown",
          text: skill.rendered || skill.raw,
        }],
      };
    }

    // youmd://{dir}/{slug} — profile/preferences/voice/directives sections
    const sectionMatch = uri.match(/^youmd:\/\/(profile|preferences|voice|directives)\/(.+)$/);
    if (sectionMatch) {
      const bundleDir = getBundleDir();
      const filePath = path.join(bundleDir, sectionMatch[1], `${sectionMatch[2]}.md`);
      const content = readFileOr(filePath, "");
      if (!content) throw new Error(`section not found: ${sectionMatch[1]}/${sectionMatch[2]}`);
      return {
        contents: [{
          uri,
          mimeType: "text/markdown",
          text: content,
        }],
      };
    }

    throw new Error(`unknown resource: ${uri}`);
  });

  // ── LIST TOOLS ─────────────────────────────────────────────────────

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        // whoami, get_identity, list_skills, list_projects, get_section,
        // get_project_context, get_stack_manifest, get_stack_capabilities,
        // route_stack_request, smoke_stack — migrated to registry.ts (T14).
        {
          name: "get_agent_brief",
          description: "Return a YouStack startup brief for local agents. Use immediately after whoami when starting Claude Code, Codex, Cursor, or another MCP-backed session. It combines compact identity, the user's recent durable memories (rendered inline by default), current repo instructions, project-context active requests, open TODOs, installed skills, and recommended next moves so the agent can act without asking the user to re-explain the project.",
          inputSchema: {
            type: "object" as const,
            properties: {
              format: {
                type: "string",
                enum: ["markdown", "json"],
                description: "Output format. markdown is default and best for agent context; json is best for automation.",
              },
              includeMemories: {
                type: "boolean",
                description: "Include up to 20 memories (category + content, durable categories first, then newest) plus retrieval readiness/fallback guidance. Default true.",
              },
              maxChars: {
                type: "number",
                description: "Maximum markdown characters when format=markdown. Default 10000.",
              },
            },
          },
        },
        // get_stack_manifest, get_stack_capabilities, route_stack_request,
        // smoke_stack, get_identity, get_section — migrated to registry.ts (T14).
        {
          name: "update_section",
          description: "Update a section of the user's identity. Writes markdown content to the local .you/ directory, with legacy .youmd fallback. Use after the user explicitly asks to change their profile, preferences, voice, or directives. Always confirm changes with the user before calling. Does NOT auto-push — call push_bundle afterward if the user wants to publish.",
          inputSchema: {
            type: "object" as const,
            properties: {
              section: {
                type: "string",
                description: "Section to update: profile/about, profile/projects, profile/now, profile/values, preferences/agent, preferences/writing, voice/voice, directives/agent",
              },
              content: {
                type: "string",
                description: "New markdown content for the section",
              },
            },
            required: ["section", "content"],
          },
        },
        // add_memory, search_memories, get_private_context — migrated to registry.ts (T14).
        // get_project_context — migrated to registry.ts (T14).
        {
          name: "add_project_memory",
          description: "Save a memory scoped to a specific project. Unlike add_memory (which is global), project memories are stored locally in the project-context/ directory and only surface when working on that project. Use for architecture decisions, bug context, and feature-specific learnings.",
          inputSchema: {
            type: "object" as const,
            properties: {
              project: {
                type: "string",
                description: "Project name. Omit to use current project.",
              },
              category: {
                type: "string",
                description: "Memory category: decision, context, bug, feature, architecture",
              },
              content: {
                type: "string",
                description: "The memory content",
              },
            },
            required: ["category", "content"],
          },
        },
        // use_skill — migrated to registry.ts (T14).
        {
          name: "compile_bundle",
          description: "Recompile the local identity bundle from profile/, preferences/, voice/, directives/ files into you.json + you.md. Call after update_section to regenerate the compiled bundle. Returns compilation stats including version, section count, and files read.",
          inputSchema: {
            type: "object" as const,
            properties: {},
          },
        },
        {
          name: "push_bundle",
          description: "Push the local identity bundle to you.md servers and publish the profile. Requires authentication. Call after compile_bundle when the user wants their changes live. Returns the published version number.",
          inputSchema: {
            type: "object" as const,
            properties: {
              publish: {
                type: "boolean",
                description: "Whether to publish after push (default true)",
              },
            },
          },
        },
        {
          name: "compile_and_push",
          description: "Combo tool that compiles the local .you bundle, writes it to disk, uploads it, and publishes it in one call. Legacy .youmd bundles are still read during migration. Replaces having to call compile_bundle + push_bundle + publish separately. Requires authentication. Returns the new version number and bundle content hash.",
          inputSchema: {
            type: "object" as const,
            properties: {},
          },
        },
        // list_skills — migrated to registry.ts (T14).
        // add_source, create_context_link — migrated to registry.ts (T14).
        // list_projects — migrated to registry.ts (T14).
        // get_remote_status, get_activity_log — migrated to registry.ts (T14).
      ],
      // T14: registry tools appended; inline tools above remain until migration.
      ...CLI_MCP_TOOLS.map(({ name, description, inputSchema }) => ({
        name,
        description,
        inputSchema,
      })),
    };
  });

  // ── CALL TOOL ──────────────────────────────────────────────────────

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // T14: Try registry dispatch first (grows as tools are migrated out of the switch).
    const registrySpec = CLI_MCP_TOOLS.find((t) => t.name === name);
    if (registrySpec) {
      const ctx: CliMcpCtx = {
        logActivity: (action, resource, details) => {
          void logMcpActivity(action, resource, details);
        },
        authenticated: isAuthenticated(),
        // Injected helpers — avoids circular import (registry cannot import server).
        fetchMemoriesEnvelope,
        fetchPrivateContextEnvelope,
        apiRequest,
        memoryCategories: MEMORY_CATEGORIES,
        resolveAgentName,
        getInstalledSkills,
        activeBundleExists,
        getYouJson,
        fetchActivityLog: (params: URLSearchParams) => {
          const config = readGlobalConfig();
          return fetch(`${getConvexSiteUrl()}/api/v1/me/activity?${params}`, {
            headers: { Authorization: `Bearer ${config.token}` },
            signal: AbortSignal.timeout(10_000),
          });
        },
      };
      const result = await registrySpec.handler((args || {}) as Record<string, unknown>, ctx);
      return { content: result.content, isError: result.isError };
    }

    // whoami, get_identity, get_section, list_skills, list_projects,
    // get_project_context, get_stack_manifest, get_stack_capabilities,
    // route_stack_request, smoke_stack — dispatched via registry above (T14).
    switch (name) {
      case "get_agent_brief": {
        const briefArgs = (args || {}) as { format?: string; includeMemories?: boolean; maxChars?: number };
        const includeMemories = briefArgs.includeMemories !== false;
        const brief = await buildAgentBrief({ includeMemories });
        void logMcpActivity("read", "agent/brief", {
          format: briefArgs.format || "markdown",
          includeMemories,
        });

        if (briefArgs.format === "json") {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(brief, null, 2),
            }],
          };
        }

        const maxChars = typeof briefArgs.maxChars === "number" && briefArgs.maxChars > 500
          ? Math.min(briefArgs.maxChars, 24000)
          : 10000;
        return {
          content: [{
            type: "text" as const,
            text: formatAgentBriefMarkdown(brief, maxChars),
          }],
        };
      }

      case "update_section": {
        const section = (args as Record<string, unknown>).section as string;
        const content = (args as Record<string, unknown>).content as string;
        const parts = section.split("/");
        if (parts.length !== 2) {
          return { content: [{ type: "text" as const, text: "invalid section path" }], isError: true };
        }
        const bundleDir = getBundleDir();
        const dirPath = path.join(bundleDir, parts[0]);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
        const filePath = path.join(dirPath, `${parts[1]}.md`);
        fs.writeFileSync(filePath, content);
        void logMcpActivity("write", section);
        return { content: [{ type: "text" as const, text: `updated ${section}` }] };
      }

      // add_memory, search_memories, get_private_context — dispatched via registry (T14).

      case "add_project_memory": {
        const { project: projName, category, content: memContent } = args as {
          project?: string;
          category: string;
          content: string;
        };
        try {
          let projDir: string;
          if (projName) {
            const root = findProjectsRoot();
            if (!root) throw new Error("no projects directory found");
            projDir = getProjectDir(root, projName);
          } else {
            const current = getCurrentProject();
            if (!current) throw new Error("no project detected");
            projDir = current.dir;
          }
          addProjectMemory(projDir, { category, content: memContent });
          void logMcpActivity("memory_add", "project/" + (projName || "current"));
          return { content: [{ type: "text" as const, text: `project memory saved: [${category}] ${memContent.slice(0, 80)}` }] };
        } catch (err) {
          return { content: [{ type: "text" as const, text: `error: ${err instanceof Error ? err.message : "unknown"}` }], isError: true };
        }
      }

      // use_skill — dispatched via registry (T14).

      case "compile_bundle": {
        try {
          const { compileBundle, writeBundle } = await import("../lib/compiler");
          const bundleDir = getBundleDir();
          const result = compileBundle(bundleDir);
          writeBundle(bundleDir, result);
          void logMcpActivity("compile", "bundle");
          return {
            content: [{
              type: "text" as const,
              text: `compiled: v${result.stats.version} — ${result.stats.filledSections}/${result.stats.totalSections} sections filled, ${result.filesRead.length} files read`,
            }],
          };
        } catch (err) {
          return { content: [{ type: "text" as const, text: `compile error: ${err instanceof Error ? err.message : "unknown"}` }], isError: true };
        }
      }

      case "push_bundle": {
        if (!isAuthenticated()) {
          return { content: [{ type: "text" as const, text: "not authenticated — run you login first" }], isError: true };
        }
        try {
          const { compileBundle } = await import("../lib/compiler");
          const { uploadBundle, publishLatest } = await import("../lib/api");
          const bundleDir = getBundleDir();
          const result = compileBundle(bundleDir);
          const uploadRes = await uploadBundle({
            manifest: result.manifest,
            youJson: result.youJson,
            youMd: result.markdown,
          });
          if (!uploadRes.ok) {
            return { content: [{ type: "text" as const, text: `push failed: ${JSON.stringify(uploadRes.data)}` }], isError: true };
          }
          const shouldPublish = (args as Record<string, unknown>)?.publish !== false;
          if (shouldPublish) {
            await publishLatest();
          }
          void logMcpActivity("push", "bundle", { version: result.stats.version });
          return {
            content: [{
              type: "text" as const,
              text: `pushed v${result.stats.version}${shouldPublish ? " and published" : ""}`,
            }],
          };
        } catch (err) {
          return { content: [{ type: "text" as const, text: `push error: ${err instanceof Error ? err.message : "unknown"}` }], isError: true };
        }
      }

      case "compile_and_push": {
        if (!isAuthenticated()) {
          return { content: [{ type: "text" as const, text: "not authenticated — run you login first" }], isError: true };
        }
        try {
          const { compileBundle, writeBundle } = await import("../lib/compiler");
          const { uploadBundle, publishLatest } = await import("../lib/api");
          const bundleDir = getBundleDir();

          // 1. Compile from the local .you directory, with legacy .youmd fallback.
          const result = compileBundle(bundleDir);

          // 2. Write the compiled bundle to disk (you.json, you.md, manifest.json)
          writeBundle(bundleDir, result);

          // 3. Upload the bundle via the API
          const uploadRes = await uploadBundle({
            manifest: result.manifest,
            youJson: result.youJson,
            youMd: result.markdown,
          });
          if (!uploadRes.ok) {
            return {
              content: [{ type: "text" as const, text: `upload failed: ${JSON.stringify(uploadRes.data)}` }],
              isError: true,
            };
          }

          // 4. Publish the latest bundle
          const publishRes = await publishLatest();
          if (!publishRes.ok) {
            return {
              content: [{ type: "text" as const, text: `publish failed: ${JSON.stringify(publishRes.data)}` }],
              isError: true,
            };
          }

          // 5. Return version + content hash. Pull hash from upload response
          //    when available, otherwise fall back to whatever the manifest has.
          const uploadData = (uploadRes.data || {}) as Record<string, unknown>;
          const contentHash =
            (uploadData.contentHash as string | undefined) ||
            (uploadData.hash as string | undefined) ||
            ((result.manifest as Record<string, unknown>).contentHash as string | undefined) ||
            "unknown";

          void logMcpActivity("push", "bundle", { version: result.stats.version, hash: contentHash });

          return {
            content: [{
              type: "text" as const,
              text: `compiled + pushed + published v${result.stats.version} (hash: ${contentHash})`,
            }],
          };
        } catch (err) {
          return {
            content: [{ type: "text" as const, text: `compile_and_push error: ${err instanceof Error ? err.message : "unknown"}` }],
            isError: true,
          };
        }
      }

      // add_source, create_context_link, get_remote_status, get_activity_log — dispatched via registry (T14).

      default:
        throw new Error(`unknown tool: ${name}`);
    }
  });

  // ── START ──────────────────────────────────────────────────────────

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // All logging goes to stderr — stdout is reserved for MCP protocol
  console.error("youmd mcp server running");
}
