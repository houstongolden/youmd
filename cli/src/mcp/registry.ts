/**
 * T14 — CLI stdio MCP tool registry.
 *
 * Mirrors the shape of convex/lib/mcpRegistry.ts for the local stdio server.
 * The CLI is a separate npm package that cannot import Convex modules, so this
 * is an independent definition with the same ergonomics.
 *
 * Adding a tool: add one entry to CLI_MCP_TOOLS. The ListToolsRequestSchema
 * and CallToolRequestSchema handlers in server.ts both drive from this array —
 * no more editing two places.
 *
 * ─── MIGRATION STATUS ───────────────────────────────────────────────────────
 *
 * MIGRATED (17 tools):
 *   whoami              — local bundle read, no auth required
 *   get_identity        — local bundle read, compact/full/json/markdown
 *   list_skills         — pure local dir scan
 *   list_projects       — pure local dir scan
 *   get_section         — local bundle file read
 *   get_project_context — local project-context engine, no network
 *   get_stack_manifest  — local youstack.json parse
 *   get_stack_capabilities — local youstack.json capability map
 *   route_stack_request — local routing algorithm, no network
 *   smoke_stack         — local manifest validation, no network
 *   search_memories     — async fetch via ctx.fetchMemoriesEnvelope
 *   get_private_context — async fetch via ctx.fetchPrivateContextEnvelope
 *   add_memory          — async POST via ctx.apiRequest + ctx.memoryCategories
 *   add_source          — async POST via ctx.apiRequest
 *   create_context_link — async POST via ctx.apiRequest
 *   get_remote_status   — conditional auth branch + ctx.apiRequest
 *   use_skill           — ctx.getInstalledSkills()
 *   get_activity_log    — auth-gated fetch via ctx.fetchActivityLog
 *
 * DEFERRED (4 tools — write-ops and dynamic-import tools):
 *   get_agent_brief     — >50 lines; delegates to buildAgentBrief() in server.ts
 *                         which has a deep async call-tree; keep in switch.
 *   update_section      — fs write; intentionally deferred (write-ops last)
 *   add_project_memory  — fs write via lib/project; intentionally deferred
 *   compile_bundle      — dynamic import('../lib/compiler'); deferred
 *   push_bundle         — dynamic imports compiler + api; deferred
 *   compile_and_push    — dynamic imports compiler + api; deferred
 *
 * ────────────────────────────────────────────────────────────────────────────
 */

import * as fs from "fs";
import * as path from "path";
import {
  getGlobalConfigDir,
  getHomeBundleDir,
  getLocalBundleDir,
  bundleLooksInitialized,
  readGlobalConfig as _readGlobalConfig,
} from "../lib/config";
import {
  findProjectsRoot,
  listProjects,
  detectCurrentProject,
  getProjectDir,
} from "../lib/project";
import {
  findRepoContextRoot,
} from "../lib/projectContext";
import {
  getYouStackReadiness,
  getYouStackCapabilities,
  loadYouStackManifest,
  routeYouStackRequest,
  runYouStackSmoke,
} from "../lib/youstack";

// ─── Shared config/helpers (duplicated here to avoid circular server.ts dep) ──

function _getLocalBundleDir2(): string { return getLocalBundleDir(); }
function _getHomeBundleDir2(): string { return getHomeBundleDir(); }

function getBundleDir(): string {
  const local = _getLocalBundleDir2();
  if (bundleLooksInitialized(local)) return local;
  const home = _getHomeBundleDir2();
  if (bundleLooksInitialized(home)) return home;
  return local;
}

function readFileOr(filePath: string, fallback: string): string {
  try { return fs.readFileSync(filePath, "utf-8"); } catch { return fallback; }
}

function readJsonOr(filePath: string, fallback: unknown): unknown {
  try { return JSON.parse(fs.readFileSync(filePath, "utf-8")); } catch { return fallback; }
}

function getYouJson(): Record<string, unknown> {
  return readJsonOr(path.join(getBundleDir(), "you.json"), {}) as Record<string, unknown>;
}

function getYouMd(): string {
  return readFileOr(path.join(getBundleDir(), "you.md"), "");
}

function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : {};
}

function getInstalledSkillNames(): string[] {
  const skillsDir = path.join(getGlobalConfigDir(), "skills");
  if (!fs.existsSync(skillsDir)) return [];
  try {
    return fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter((e) => {
        if (!e.isDirectory() && !e.isSymbolicLink()) return false;
        const skillDir = path.join(skillsDir, e.name);
        const hasSkill = fs.existsSync(path.join(skillDir, "SKILL.md"));
        const hasRendered = fs.existsSync(path.join(skillDir, "RENDERED.md"));
        return hasSkill || hasRendered;
      })
      .map((e) => e.name);
  } catch { return []; }
}

function buildWhoamiSummary(): string {
  const youJson = getYouJson();
  const identity = asRecord(youJson.identity);
  const preferences = asRecord(youJson.preferences);
  const agentPrefs = asRecord(preferences.agent);
  const directives = asRecord(youJson.agent_directives);
  const projects = Array.isArray(youJson.projects) ? youJson.projects : [];
  const bio = asRecord(identity.bio);
  const name = typeof identity.name === "string" ? identity.name
    : typeof youJson.username === "string" ? youJson.username : "(unknown)";
  const role = typeof identity.tagline === "string" ? identity.tagline
    : typeof bio.short === "string" ? bio.short : "";
  const stack = typeof directives.default_stack === "string" ? directives.default_stack : "";
  const tone = typeof agentPrefs.tone === "string" ? agentPrefs.tone : "";
  const avoidList = Array.isArray(agentPrefs.avoid)
    ? agentPrefs.avoid.filter((item): item is string => typeof item === "string") : [];
  const avoid = avoidList.join(", ");
  const topProjects = projects.slice(0, 3).map((p) => {
    if (typeof p === "string") return p;
    const r = asRecord(p); return typeof r.name === "string" ? r.name : "";
  }).filter(Boolean).join(", ");
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
  if (summary.length > 500) summary = summary.slice(0, 497) + "...";
  return summary;
}

function buildIdentityMarkdown(): string {
  const md = getYouMd();
  if (md) return md;
  const youJson = getYouJson();
  const identity = asRecord(youJson.identity);
  const bio = asRecord(identity.bio);
  const parts: string[] = [];
  const title = typeof identity.name === "string" ? identity.name
    : typeof youJson.username === "string" ? youJson.username : "Identity";
  parts.push(`# ${title}`);
  if (typeof identity.tagline === "string") parts.push(identity.tagline);
  const about = typeof bio.long === "string" ? bio.long
    : typeof bio.medium === "string" ? bio.medium
    : typeof bio.short === "string" ? bio.short : "";
  if (about) parts.push(`\n## About\n\n${about}`);
  return parts.join("\n") + "\n";
}

function getCurrentProject(): { name: string; dir: string } | null {
  const root = findProjectsRoot();
  if (!root) return null;
  const name = detectCurrentProject(root);
  if (!name) return null;
  return { name, dir: getProjectDir(root, name) };
}

function tryLoadStack(inputPath?: string): ReturnType<typeof loadYouStackManifest> | null {
  try { return loadYouStackManifest(inputPath); } catch { return null; }
}

// ─── Types ────────────────────────────────────────────────────────────────────

/** Content item returned by a CLI tool handler (MCP SDK shape). */
export interface CliToolContent {
  type: "text";
  text: string;
}

/** Result returned by every CLI registry handler. */
export interface CliToolResult {
  content: CliToolContent[];
  isError?: boolean;
}

/** Memory retrieval result shape (mirrors MemoryRetrievalEnvelope in server.ts). */
export interface MemoryEnvelope {
  readiness: { status: string; ready: boolean; reason: string; fallback: string };
  memories: unknown[];
  count: number;
}

/** Private context retrieval result shape (mirrors PrivateContextRetrievalEnvelope). */
export interface PrivateContextEnvelope {
  readiness: { status: string; ready: boolean; reason: string; fallback: string };
  privateContext: Record<string, unknown> | null;
  summary: { hasNotes: boolean; linkCount: number; projectCount: number };
}

/**
 * Context passed to every registry handler by the MCP server at dispatch time.
 *
 * Keeping helpers here (injected by server.ts) avoids a circular import:
 *   server.ts imports registry.ts (CLI_MCP_TOOLS)
 *   registry.ts must NOT import from server.ts
 * So helpers that live in server.ts are passed in via this ctx object.
 */
export interface CliMcpCtx {
  /** Fire-and-forget activity logger (non-fatal). */
  logActivity: (action: string, resource?: string, details?: Record<string, unknown>) => void;
  /** Whether a valid auth token is present in the global config. */
  authenticated: boolean;

  // ── Injected by server.ts for network-capable tools ──────────────────────

  /** Fetch memories envelope (auth-gated, returns readiness wrapper on failure). */
  fetchMemoriesEnvelope: (category?: string, limit?: number) => Promise<MemoryEnvelope>;
  /** Fetch private context envelope (auth-gated, returns readiness wrapper on failure). */
  fetchPrivateContextEnvelope: () => Promise<PrivateContextEnvelope>;
  /** Authenticated JSON API request helper. */
  apiRequest: (path: string, opts?: { method?: string; body?: unknown }) => Promise<unknown>;
  /** Valid memory category strings (as-const tuple from server.ts). */
  memoryCategories: readonly string[];
  /** Resolve the MCP client's friendly agent name for memory attribution. */
  resolveAgentName: () => string;
  /** Full installed skill list including rendered content (for use_skill). */
  getInstalledSkills: () => Array<{ name: string; rendered: string; raw: string }>;
  /** True when local bundle is found and initialized. */
  activeBundleExists: () => boolean;
  /** Raw fetch to the Convex site URL (for get_activity_log). */
  fetchActivityLog: (params: URLSearchParams) => Promise<Response>;
  /** Serialised local you.json bundle (plain object). */
  getYouJson: () => Record<string, unknown>;
}

/** Single CLI MCP tool specification (metadata + handler). */
export interface CliToolSpec {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  /** Async handler. args is the raw arguments object from the MCP call. */
  handler: (args: Record<string, unknown>, ctx: CliMcpCtx) => Promise<CliToolResult>;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const CLI_MCP_TOOLS: CliToolSpec[] = [
  // ── whoami ──────────────────────────────────────────────────────────────────
  {
    name: "whoami",
    description:
      "Return a compact ~500-char identity summary: name, role, stack, tone, things to avoid, top projects, and current goal. This is the FIRST tool you should call when starting a new conversation — it gives you just enough context to orient on the user before deciding whether to pull the full identity bundle. Returns plain text, not JSON.",
    inputSchema: { type: "object", properties: {} },
    handler: async (_args, ctx) => {
      ctx.logActivity("read", "identity:compact");
      return { content: [{ type: "text", text: buildWhoamiSummary() }] };
    },
  },

  // ── get_identity ─────────────────────────────────────────────────────────────
  {
    name: "get_identity",
    description:
      "Get the user's complete you.md identity bundle. Returns compact (default), full JSON, or human-readable markdown. For the fastest orient, call whoami first; call get_identity when you need full detail (preferences, voice, directives, projects).",
    inputSchema: {
      type: "object",
      properties: {
        format: {
          type: "string",
          enum: ["compact", "full", "json", "markdown"],
          description:
            "Output format: compact (500-char summary, default — same as whoami), full/json (complete identity bundle as JSON), markdown (human-readable markdown).",
        },
      },
    },
    handler: async (args, ctx) => {
      const format = (args.format as string) || "compact";
      ctx.logActivity("read", "identity:" + format);
      if (format === "markdown") {
        return { content: [{ type: "text", text: buildIdentityMarkdown() }] };
      }
      if (format === "full" || format === "json") {
        return { content: [{ type: "text", text: JSON.stringify(getYouJson(), null, 2) }] };
      }
      return { content: [{ type: "text", text: buildWhoamiSummary() }] };
    },
  },

  // ── list_skills ──────────────────────────────────────────────────────────────
  {
    name: "list_skills",
    description:
      "List all installed identity-aware skills with their names. Use to discover what skills are available before calling use_skill. Returns a simple list of installed skill names.",
    inputSchema: { type: "object", properties: {} },
    handler: async (_args, ctx) => {
      const names = getInstalledSkillNames();
      ctx.logActivity("read", "skills");
      if (names.length === 0) {
        return {
          content: [{ type: "text", text: "no skills installed. run: youmd skill install voice-sync" }],
        };
      }
      return { content: [{ type: "text", text: `installed skills:\n${names.map((n) => `- ${n}`).join("\n")}` }] };
    },
  },

  // ── list_projects ─────────────────────────────────────────────────────────────
  {
    name: "list_projects",
    description:
      "List all detected projects with their metadata. Returns project names found in the projects root directory. Use to discover available projects before calling get_project_context with a specific project name.",
    inputSchema: { type: "object", properties: {} },
    handler: async (_args, ctx) => {
      try {
        const root = findProjectsRoot();
        if (!root) {
          return { content: [{ type: "text", text: "no projects directory found" }], isError: true };
        }
        const projects = listProjects(root);
        if (projects.length === 0) {
          return { content: [{ type: "text", text: "no projects detected. create one with: youmd project init <name>" }] };
        }
        const current = getCurrentProject();
        const list = projects
          .map((p) => `- ${p}${current && current.name === p ? " (current)" : ""}`)
          .join("\n");
        ctx.logActivity("read", "projects");
        return { content: [{ type: "text", text: `projects:\n${list}` }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `error listing projects: ${err instanceof Error ? err.message : "unknown"}` }],
          isError: true,
        };
      }
    },
  },

  // ── get_section ──────────────────────────────────────────────────────────────
  {
    name: "get_section",
    description:
      "Read a specific identity section by path. Use when you need just ONE section rather than the full bundle. Returns markdown content for the requested section. Available paths: profile/about, profile/projects, profile/now, profile/values, profile/links, preferences/agent, preferences/writing, voice/voice, directives/agent.",
    inputSchema: {
      type: "object",
      properties: {
        section: {
          type: "string",
          description:
            "Section path: profile/about, profile/projects, profile/now, profile/values, profile/links, preferences/agent, preferences/writing, voice/voice, directives/agent",
        },
      },
      required: ["section"],
    },
    handler: async (args, ctx) => {
      const section = args.section as string;
      const parts = section.split("/");
      if (parts.length !== 2) {
        return {
          content: [{ type: "text", text: "invalid section path — use format: dir/slug (e.g., profile/about)" }],
          isError: true,
        };
      }
      const filePath = path.join(getBundleDir(), parts[0], `${parts[1]}.md`);
      const content = readFileOr(filePath, "");
      if (!content) {
        return { content: [{ type: "text", text: `section not found: ${section}` }], isError: true };
      }
      ctx.logActivity("read_section", section);
      return { content: [{ type: "text", text: content }] };
    },
  },

  // ── get_project_context ──────────────────────────────────────────────────────
  {
    name: "get_project_context",
    description:
      "Get the full project context for the current or named project — PRD, TODO, features, decisions, changelog, and project memories. Returns a readiness envelope so agents can distinguish missing project context from ready project context without parsing plain-text errors.",
    inputSchema: {
      type: "object",
      properties: {
        project: {
          type: "string",
          description: "Project name. Omit to auto-detect from current directory.",
        },
      },
    },
    handler: async (args, ctx) => {
      // Delegate to server.ts's fetchProjectContextEnvelope via ctx. Since
      // that function has no network calls and is pure local-read, we re-
      // implement it here using the same projectContext engine imports.
      const { readMergedProjectContext, resolveProjectContext: _rpc } = await import("../lib/projectContext");
      const projectName = args.project as string | undefined;

      const repoRoot = findRepoContextRoot();
      const readiness = (status: "ready" | "not_found", reason: string, fallback: string) => ({
        status, ready: status === "ready", reason, fallback,
      });

      if (projectName) {
        const ctx2 = readMergedProjectContext({ projectName });
        if (!ctx2) {
          const result = {
            readiness: readiness("not_found", `Project context for ${projectName} was not found or is incomplete.`,
              "Use local repo instructions, project-context files, or confirm the named project exists before retrying."),
            project: { name: projectName, source: "named" as const },
            projectContext: null,
          };
          ctx.logActivity("read", "project/" + projectName);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], isError: true };
        }
        const result = {
          readiness: readiness("ready", `Project context for ${projectName} is available.`, "None needed."),
          project: { name: projectName, source: "named" as const },
          projectContext: ctx2,
        };
        ctx.logActivity("read", "project/" + projectName);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      const current = getCurrentProject();
      const merged = readMergedProjectContext(current ? { projectName: current.name } : {});

      if (!merged && !repoRoot) {
        const result = {
          readiness: readiness("not_found", "No current project was detected from the working directory.",
            "Use local project-context files in the current repo, pass an explicit project name, or fall back to public identity and stack files."),
          project: { name: null, source: "current" as const },
          projectContext: null,
        };
        ctx.logActivity("read", "project/current");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], isError: true };
      }

      const finalCtx = merged;
      const name = finalCtx?.meta?.name || current?.name || null;
      const result = finalCtx
        ? {
            readiness: readiness("ready", `Project context for ${name} is available.`, "None needed."),
            project: { name, source: "current" as const },
            projectContext: finalCtx,
          }
        : {
            readiness: readiness("not_found", "Project context could not be read.",
              "Use repo-local instructions and project-context markdown files directly."),
            project: { name, source: "current" as const },
            projectContext: null,
          };
      ctx.logActivity("read", "project/current");
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: !result.readiness.ready,
      };
    },
  },

  // ── get_stack_manifest ────────────────────────────────────────────────────────
  {
    name: "get_stack_manifest",
    description:
      "Return the current local YouStack manifest discovered from cwd, or from a provided manifest/stack path. Use before trusting local stack files.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Optional path to a youstack.json file or stack directory." },
      },
    },
    handler: async (args, ctx) => {
      const loaded = tryLoadStack(args.path as string | undefined);
      const readiness = getYouStackReadiness(loaded);
      if (!loaded) {
        return {
          content: [{ type: "text", text: JSON.stringify({ readiness, manifest: null, validation: null }, null, 2) }],
          isError: true,
        };
      }
      ctx.logActivity("read", "stack/manifest", { stack: loaded.manifest.slug });
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            readiness,
            manifestPath: loaded.manifestPath,
            rootDir: loaded.rootDir,
            manifest: loaded.manifest,
            validation: loaded.validation,
          }, null, 2),
        }],
      };
    },
  },

  // ── get_stack_capabilities ────────────────────────────────────────────────────
  {
    name: "get_stack_capabilities",
    description:
      "Return the local YouStack capability map, including local/static capabilities and protected API/MCP capabilities declared by the manifest.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Optional path to a youstack.json file or stack directory." },
      },
    },
    handler: async (args, ctx) => {
      const loaded = tryLoadStack(args.path as string | undefined);
      const readiness = getYouStackReadiness(loaded);
      if (!loaded) {
        return {
          content: [{ type: "text", text: JSON.stringify({ readiness, capabilities: [] }, null, 2) }],
          isError: true,
        };
      }
      ctx.logActivity("read", "stack/capabilities", { stack: loaded.manifest.slug });
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            readiness,
            stack: loaded.manifest.slug,
            capabilities: getYouStackCapabilities(loaded.manifest),
          }, null, 2),
        }],
      };
    },
  },

  // ── route_stack_request ──────────────────────────────────────────────────────
  {
    name: "route_stack_request",
    description:
      "Route a natural-language request to the safest matching local YouStack capability. This is deterministic and read-only.",
    inputSchema: {
      type: "object",
      properties: {
        request: { type: "string", description: "The user's natural-language stack request." },
        path: { type: "string", description: "Optional path to a youstack.json file or stack directory." },
      },
      required: ["request"],
    },
    handler: async (args, ctx) => {
      if (!args.request) {
        return { content: [{ type: "text", text: "missing required argument: request" }], isError: true };
      }
      const loaded = tryLoadStack(args.path as string | undefined);
      const readiness = getYouStackReadiness(loaded);
      if (!loaded) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ readiness, request: args.request, capability: null, alternatives: [] }, null, 2),
          }],
          isError: true,
        };
      }
      const route = routeYouStackRequest(loaded.manifest, args.request as string);
      ctx.logActivity("read", "stack/route", { stack: loaded.manifest.slug, capability: route.capability.id });
      return {
        content: [{ type: "text", text: JSON.stringify({ readiness, ...route }, null, 2) }],
      };
    },
  },

  // ── smoke_stack ───────────────────────────────────────────────────────────────
  {
    name: "smoke_stack",
    description:
      "Run read-only local YouStack smoke validation. It parses the manifest, verifies required files/checksums, checks adapter declarations, and performs no writes.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Optional path to a youstack.json file or stack directory." },
      },
    },
    handler: async (args, ctx) => {
      const loaded = tryLoadStack(args.path as string | undefined);
      const readiness = getYouStackReadiness(loaded);
      if (!loaded) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ readiness, ok: false, errors: ["no local YouStack manifest found"], warnings: [], checks: [] }, null, 2),
          }],
          isError: true,
        };
      }
      const smoke = runYouStackSmoke(loaded);
      ctx.logActivity("read", "stack/smoke", { stack: loaded.manifest.slug, ok: smoke.ok });
      return {
        content: [{ type: "text", text: JSON.stringify({ readiness, ...smoke }, null, 2) }],
        isError: !smoke.ok,
      };
    },
  },

  // ── search_memories ──────────────────────────────────────────────────────────
  {
    name: "search_memories",
    description:
      "Search the user's memories by category or list all active memories. Returns a readiness envelope plus memory objects so agents can distinguish auth-required, unavailable, and ready-but-empty retrieval states.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Filter by category (optional): fact, preference, decision, project, goal, insight, context",
        },
        limit: { type: "number", description: "Max results (default 30)" },
      },
    },
    handler: async (args, ctx) => {
      const { category, limit } = args as { category?: string; limit?: number };
      const result = await ctx.fetchMemoriesEnvelope(category, limit ?? 30);
      ctx.logActivity("read", "memories");
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: !result.readiness.ready,
      };
    },
  },

  // ── get_private_context ──────────────────────────────────────────────────────
  {
    name: "get_private_context",
    description:
      "Read protected private context — notes, internal links, and private projects. Returns a readiness envelope so agents can distinguish auth-required, unavailable, and ready-but-empty retrieval states before asking the user to restate private context.",
    inputSchema: { type: "object", properties: {} },
    handler: async (_args, ctx) => {
      const result = await ctx.fetchPrivateContextEnvelope();
      ctx.logActivity("read", "private-context");
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: !result.readiness.ready,
      };
    },
  },

  // ── add_memory ───────────────────────────────────────────────────────────────
  {
    name: "add_memory",
    description:
      "Save a memory about the user — facts, preferences, decisions, or context learned during this conversation. Memories persist across sessions and inform ALL future agent interactions. Use proactively when you learn something important about the user (a preference, a decision, a project detail). Requires authentication.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["fact", "preference", "decision", "project", "goal", "insight", "context", "relationship"],
          description: "Memory category. Must be one of: fact, preference, decision, project, goal, insight, context, relationship.",
        },
        content: { type: "string", description: "The memory content — be specific and actionable" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Optional tags for searchability",
        },
      },
      required: ["category", "content"],
    },
    handler: async (args, ctx) => {
      const { category, content: memContent, tags } = args as {
        category: string; content: string; tags?: string[];
      };
      if (!ctx.authenticated) {
        return { content: [{ type: "text", text: "not authenticated — run youmd login first" }], isError: true };
      }
      if (!category || !ctx.memoryCategories.includes(category)) {
        return {
          content: [{
            type: "text",
            text: `invalid category: ${category || "(missing)"}. valid categories: ${ctx.memoryCategories.join(", ")}`,
          }],
          isError: true,
        };
      }
      try {
        await ctx.apiRequest("/api/v1/me/memories", {
          method: "POST",
          body: {
            memories: [{
              category,
              content: memContent,
              source: "mcp",
              sourceAgent: ctx.resolveAgentName(),
              tags,
            }],
          },
        });
        ctx.logActivity("memory_add", category);
        return {
          content: [{
            type: "text",
            text: `memory saved: [${category}] ${memContent.slice(0, 80)}${memContent.length > 80 ? "..." : ""}`,
          }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `failed to save memory: ${err instanceof Error ? err.message : "unknown error"}` }],
          isError: true,
        };
      }
    },
  },

  // ── add_source ───────────────────────────────────────────────────────────────
  {
    name: "add_source",
    description:
      "Register an identity data source (LinkedIn, GitHub, X, website, blog, YouTube). Links an external profile to the user's identity so it can be scraped and indexed. Requires authentication. Use when the user wants to connect a new social profile or website to their identity.",
    inputSchema: {
      type: "object",
      properties: {
        sourceType: {
          type: "string",
          enum: ["website", "linkedin", "x", "github", "blog", "youtube"],
          description: "Type of source to register",
        },
        sourceUrl: {
          type: "string",
          description: "Full URL to the source (e.g., https://github.com/username)",
        },
      },
      required: ["sourceType", "sourceUrl"],
    },
    handler: async (args, ctx) => {
      if (!ctx.authenticated) {
        return { content: [{ type: "text", text: "not authenticated — run youmd login first" }], isError: true };
      }
      const { sourceType, sourceUrl } = args as { sourceType: string; sourceUrl: string };
      try {
        await ctx.apiRequest("/api/v1/me/sources", {
          method: "POST",
          body: { sourceType, sourceUrl },
        });
        ctx.logActivity("write", "source/" + sourceType);
        return { content: [{ type: "text", text: `source registered: [${sourceType}] ${sourceUrl}` }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `failed to add source: ${err instanceof Error ? err.message : "unknown error"}` }],
          isError: true,
        };
      }
    },
  },

  // ── create_context_link ──────────────────────────────────────────────────────
  {
    name: "create_context_link",
    description:
      "Generate a shareable context link for agents. The link gives any agent temporary or permanent read access to the user's identity context. Use when the user wants to share their identity with a third-party agent or service. Returns a URL that can be passed to any agent.",
    inputSchema: {
      type: "object",
      properties: {
        scope: {
          type: "string",
          enum: ["public", "full"],
          description: "Access scope: public (profile only) or full (includes memories, preferences, directives). Default: public",
        },
        ttl: {
          type: "string",
          enum: ["1h", "24h", "7d", "30d", "never"],
          description: "Time-to-live for the link. Default: 24h",
        },
      },
    },
    handler: async (args, ctx) => {
      if (!ctx.authenticated) {
        return { content: [{ type: "text", text: "not authenticated — run youmd login first" }], isError: true };
      }
      const { scope, ttl } = args as { scope?: string; ttl?: string };
      try {
        const result = await ctx.apiRequest("/api/v1/me/context-links", {
          method: "POST",
          body: { scope: scope || "public", ttl: ttl || "24h" },
        }) as Record<string, unknown>;
        const link = result.url || result.link || JSON.stringify(result);
        ctx.logActivity("write", "context-link", { scope: scope || "public" });
        return {
          content: [{ type: "text", text: `context link created: ${link}\nscope: ${scope || "public"}, ttl: ${ttl || "24h"}` }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `failed to create context link: ${err instanceof Error ? err.message : "unknown error"}` }],
          isError: true,
        };
      }
    },
  },

  // ── get_remote_status ────────────────────────────────────────────────────────
  {
    name: "get_remote_status",
    description:
      "Check sync status between local identity bundle and the remote you.md server. Returns whether the user is authenticated, whether the local bundle exists, and the current version info. Use to diagnose sync issues or confirm a push was successful.",
    inputSchema: { type: "object", properties: {} },
    handler: async (_args, ctx) => {
      const youJson = ctx.getYouJson();
      const version = (youJson as Record<string, unknown>)?.version || "unknown";
      const status: Record<string, unknown> = {
        authenticated: ctx.authenticated,
        localBundleExists: ctx.activeBundleExists(),
        localVersion: version,
      };
      if (ctx.authenticated) {
        try {
          const remote = await ctx.apiRequest("/api/v1/me/status") as Record<string, unknown>;
          status.remote = remote;
        } catch {
          status.remote = "unreachable";
        }
      }
      ctx.logActivity("read", "status");
      return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }] };
    },
  },

  // ── use_skill ────────────────────────────────────────────────────────────────
  {
    name: "use_skill",
    description:
      "Render an identity-aware skill — returns the skill content with the user's identity interpolated into {{var}} placeholders. Returns rendered markdown with instructions the agent should follow. Use when the user asks to generate a CLAUDE.md, sync voice, scaffold a project, or run a self-improvement review.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Skill name: youstack-start, youstack-maintainer, machine-bootstrap, portfolio-graph-auditor, voice-sync, claude-md-generator, project-context-init, meta-improve, proactive-context-fill, you-logs",
        },
      },
      required: ["name"],
    },
    handler: async (args, ctx) => {
      const skillName = args.name as string;
      const skills = ctx.getInstalledSkills();
      const skill = skills.find((s) => s.name === skillName);
      if (!skill) {
        const available = skills.map((s) => s.name).join(", ") || "none installed";
        return { content: [{ type: "text", text: `skill not found: ${skillName}. available: ${available}` }], isError: true };
      }
      ctx.logActivity("skill_use", "skill/" + skillName);
      return { content: [{ type: "text", text: skill.rendered || skill.raw }] };
    },
  },

  // ── get_activity_log ─────────────────────────────────────────────────────────
  {
    name: "get_activity_log",
    description:
      "Get the user's recent agent activity log. Use this to see which agents have connected to their you.md identity and what they did. Returns an array of activity events with agent name, action, resource, timestamp. Useful for: showing the user proof their identity context is being used by other agents, debugging integration issues, auditing access.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max events (default 30)" },
        agentName: { type: "string", description: "Filter by agent name (e.g. 'Claude Code')" },
        action: { type: "string", description: "Filter by action (read|write|push|memory_add)" },
      },
    },
    handler: async (args, ctx) => {
      if (!ctx.authenticated) {
        return { content: [{ type: "text", text: "not authenticated — run youmd login first" }], isError: true };
      }
      const params = new URLSearchParams();
      const activityArgs = args as { limit?: number; agentName?: string; action?: string };
      if (activityArgs.limit) params.set("limit", String(activityArgs.limit));
      if (activityArgs.agentName) params.set("agent", String(activityArgs.agentName));
      if (activityArgs.action) params.set("action", String(activityArgs.action));

      const res = await ctx.fetchActivityLog(params);
      if (!res.ok) {
        return {
          content: [{ type: "text", text: `failed to fetch activity log: ${res.status}` }],
          isError: true,
        };
      }

      type ActivityEvent = {
        createdAt?: number;
        agentName?: string;
        action?: string;
        resource?: string;
        bundleVersionBefore?: number;
        bundleVersionAfter?: number;
      };
      const data = await res.json() as { activity?: ActivityEvent[] };
      const events = data.activity || [];

      if (events.length === 0) {
        return { content: [{ type: "text", text: "No activity yet. Agents will appear here when they connect to your you.md identity." }] };
      }

      const formatted = events.slice(0, 30).reverse().map((e) => {
        const time = new Date(e.createdAt || Date.now()).toTimeString().slice(0, 5);
        const versions = e.bundleVersionBefore && e.bundleVersionAfter
          ? ` v${e.bundleVersionBefore}→v${e.bundleVersionAfter}` : "";
        const agentName = (e.agentName || "unknown").padEnd(16);
        const action = (e.action || "read").padEnd(12);
        return `${time}  ${agentName}  ${action}  ${e.resource || ""}${versions}`;
      }).join("\n");

      return {
        content: [{
          type: "text",
          text: `── recent agent activity (${events.length} events) ──\n\n${formatted}`,
        }],
      };
    },
  },
];
