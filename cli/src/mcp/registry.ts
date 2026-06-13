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
 * MIGRATED (10 tools):
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
 *
 * DEFERRED (11 tools):
 *   get_agent_brief     — >50 lines; delegates to buildAgentBrief() in server.ts
 *                         which has a deep async call-tree; keep in switch.
 *   search_memories     — async fetch; needs fetchMemoriesEnvelope from server.ts
 *   get_private_context — async fetch; needs fetchPrivateContextEnvelope
 *   add_memory          — async POST; needs apiRequest + MEMORY_CATEGORIES
 *   add_source          — async POST; needs apiRequest
 *   create_context_link — async POST; needs apiRequest
 *   get_activity_log    — async fetch with custom formatting; >50 lines
 *   get_remote_status   — async fetch with conditional branch
 *   update_section      — fs write; intentionally deferred (write-ops last)
 *   add_project_memory  — fs write via lib/project; intentionally deferred
 *   compile_bundle      — dynamic import('../lib/compiler'); deferred
 *   push_bundle         — dynamic imports compiler + api; deferred
 *   compile_and_push    — dynamic imports compiler + api; deferred
 *   use_skill           — delegates to getInstalledSkills() in server.ts;
 *                         trivial but low-value; deferred to keep diff small
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

/**
 * Minimal context passed to registry handlers by the MCP server at dispatch
 * time. Handlers receive this instead of importing from server.ts directly
 * (which would create a circular dependency since server.ts imports registry).
 *
 * Currently unused — migrated tools are fully self-contained — but kept in
 * the signature for future handlers that need activity logging or auth access.
 */
export interface CliMcpCtx {
  /** Fire-and-forget activity logger (non-fatal). */
  logActivity: (action: string, resource?: string, details?: Record<string, unknown>) => void;
  /** Whether a valid auth token is present in the global config. */
  authenticated: boolean;
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
];
