#!/usr/bin/env node
/**
 * You.md MCP Server — Identity context protocol for the agent internet.
 *
 * An MCP where the context is you. Every agent that connects gets structured,
 * portable identity context: who you are, how you work, what you sound like.
 *
 * Resources: identity, profile sections, preferences, voice, directives,
 *            memories, projects, skills
 * Tools:     add_memory, update_section, search_memories, use_skill,
 *            compile_bundle, push_bundle, get_project_context,
 *            add_source, create_context_link, list_projects, get_remote_status
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
import * as fs from "fs";
import * as path from "path";
import {
  getGlobalConfigDir,
  getLocalBundleDir,
  localBundleExists,
  readGlobalConfig,
  isAuthenticated,
  getConvexSiteUrl,
} from "../lib/config";
import {
  findProjectsRoot,
  listProjects,
  detectCurrentProject,
  readProjectContext,
  getProjectDir,
  addProjectMemory,
} from "../lib/project";

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

function getBundleDir(): string {
  return getLocalBundleDir();
}

function getYouJson(): Record<string, unknown> {
  const bundleDir = getBundleDir();
  const youJsonPath = path.join(bundleDir, "you.json");
  return readJsonOr(youJsonPath, {}) as Record<string, unknown>;
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

function getInstalledSkills(): Array<{ name: string; rendered: string; raw: string }> {
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

async function fetchMemories(category?: string, limit?: number): Promise<unknown[]> {
  if (!isAuthenticated()) return [];
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
    if (!res.ok) return [];
    const data = await res.json() as Record<string, unknown>;
    return ((data.memories || data) as unknown[]) || [];
  } catch {
    return [];
  }
}

async function apiRequest(path: string, opts?: { method?: string; body?: unknown }): Promise<unknown> {
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
        "User-Agent": "youmd-mcp/0.6.10",
      },
      body: JSON.stringify({
        agentName: process.env.YOUMD_AGENT_NAME || "Claude Code",
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
const MEMORY_CATEGORIES = [
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
  const youJson = getYouJson() as Record<string, any>;

  const identity = youJson.identity || {};
  const preferences = youJson.preferences || {};
  const agentPrefs = preferences.agent || {};
  const directives = youJson.agent_directives || {};
  const projects = Array.isArray(youJson.projects) ? youJson.projects : [];

  const name = identity.name || youJson.username || "(unknown)";
  const role = identity.tagline || identity.bio?.short || "";
  const stack = directives.default_stack || "";
  const tone = agentPrefs.tone || "";
  const avoidList = Array.isArray(agentPrefs.avoid) ? agentPrefs.avoid : [];
  const avoid = avoidList.join(", ");
  const topProjects = projects
    .slice(0, 3)
    .map((p: any) => (typeof p === "string" ? p : p?.name || ""))
    .filter(Boolean)
    .join(", ");
  const goal = directives.current_goal || "";

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
  const youJson = getYouJson() as Record<string, any>;
  const identity = youJson.identity || {};
  const parts: string[] = [];
  parts.push(`# ${identity.name || youJson.username || "Identity"}`);
  if (identity.tagline) parts.push(identity.tagline);
  if (identity.bio?.long || identity.bio?.medium || identity.bio?.short) {
    parts.push(`\n## About\n\n${identity.bio.long || identity.bio.medium || identity.bio.short}`);
  }
  return parts.join("\n") + "\n";
}

/**
 * Find the nearest project-context/ directory by walking up from cwd.
 * Also treats a `.youmd-project` marker file as a valid project root.
 * Returns the directory that contains project-context/ or the marker.
 */
function findLocalProjectContextRoot(startDir: string = process.cwd()): string | null {
  let dir = startDir;
  // Walk up at most 8 levels to avoid runaway searches
  for (let i = 0; i < 8; i++) {
    const contextDir = path.join(dir, "project-context");
    const marker = path.join(dir, ".youmd-project");
    if (fs.existsSync(contextDir) && fs.statSync(contextDir).isDirectory()) {
      return dir;
    }
    if (fs.existsSync(marker)) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Returns true if the current cwd has local project context available
 * (either via project-context/ directory or a .youmd-project marker).
 */
function hasLocalProjectContext(): boolean {
  return findLocalProjectContextRoot() !== null;
}

/**
 * Read a single project-context markdown file. Tries project-context/<name>.md
 * in the detected project root. Returns empty string if not found.
 */
function readLocalProjectContextFile(name: string): string {
  const root = findLocalProjectContextRoot();
  if (!root) return "";
  const candidates = [
    path.join(root, "project-context", `${name}.md`),
    path.join(root, "project-context", `${name.toUpperCase()}.md`),
    path.join(root, `${name}.md`),
    path.join(root, `${name.toUpperCase()}.md`),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return readFileOr(candidate, "");
    }
  }
  return "";
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

export async function startMcpServer(): Promise<void> {
  const server = new Server(
    {
      name: "youmd",
      version: "0.5.0",
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    }
  );

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

    // youmd://memories
    if (uri === "youmd://memories" || uri === "youmd://memories/all") {
      const memories = await fetchMemories(undefined, 50);
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
      const memories = await fetchMemories(memCatMatch[1], 50);
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify(memories, null, 2),
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
      const current = getCurrentProject();
      if (!current) throw new Error("no project detected in current directory");
      const ctx = readProjectContext(current.dir);
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
      const root = findProjectsRoot();
      if (!root) throw new Error("no projects directory found");
      const projDir = getProjectDir(root, projMatch[1]);
      const ctx = readProjectContext(projDir);
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
        {
          name: "whoami",
          description: "Return a compact ~500-char identity summary: name, role, stack, tone, things to avoid, top projects, and current goal. This is the FIRST tool you should call when starting a new conversation — it gives you just enough context to orient on the user before deciding whether to pull the full identity bundle. Returns plain text, not JSON.",
          inputSchema: {
            type: "object" as const,
            properties: {},
          },
        },
        {
          name: "get_identity",
          description: "Get the user's complete you.md identity bundle. Returns compact (default), full JSON, or human-readable markdown. For the fastest orient, call whoami first; call get_identity when you need full detail (preferences, voice, directives, projects).",
          inputSchema: {
            type: "object" as const,
            properties: {
              format: {
                type: "string",
                enum: ["compact", "full", "json", "markdown"],
                description: "Output format: compact (500-char summary, default — same as whoami), full/json (complete identity bundle as JSON), markdown (human-readable markdown).",
              },
            },
          },
        },
        {
          name: "get_section",
          description: "Read a specific identity section by path. Use when you need just ONE section rather than the full bundle. Returns markdown content for the requested section. Available paths: profile/about, profile/projects, profile/now, profile/values, profile/links, preferences/agent, preferences/writing, voice/voice, directives/agent.",
          inputSchema: {
            type: "object" as const,
            properties: {
              section: {
                type: "string",
                description: "Section path: profile/about, profile/projects, profile/now, profile/values, profile/links, preferences/agent, preferences/writing, voice/voice, directives/agent",
              },
            },
            required: ["section"],
          },
        },
        {
          name: "update_section",
          description: "Update a section of the user's identity. Writes markdown content to the local .youmd/ directory. Use after the user explicitly asks to change their profile, preferences, voice, or directives. Always confirm changes with the user before calling. Does NOT auto-push — call push_bundle afterward if the user wants to publish.",
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
        {
          name: "add_memory",
          description: "Save a memory about the user — facts, preferences, decisions, or context learned during this conversation. Memories persist across sessions and inform ALL future agent interactions. Use proactively when you learn something important about the user (a preference, a decision, a project detail). Requires authentication.",
          inputSchema: {
            type: "object" as const,
            properties: {
              category: {
                type: "string",
                enum: [...MEMORY_CATEGORIES],
                description: "Memory category. Must be one of: fact, preference, decision, project, goal, insight, context, relationship.",
              },
              content: {
                type: "string",
                description: "The memory content — be specific and actionable",
              },
              tags: {
                type: "array",
                items: { type: "string" },
                description: "Optional tags for searchability",
              },
            },
            required: ["category", "content"],
          },
        },
        {
          name: "search_memories",
          description: "Search the user's memories by category or list all active memories. Returns an array of memory objects with category, content, tags, and timestamps. Use to check what you already know before asking the user a question they may have answered before.",
          inputSchema: {
            type: "object" as const,
            properties: {
              category: {
                type: "string",
                description: "Filter by category (optional): fact, preference, decision, project, goal, insight, context",
              },
              limit: {
                type: "number",
                description: "Max results (default 30)",
              },
            },
          },
        },
        {
          name: "get_project_context",
          description: "Get the full project context for the current or named project — PRD, TODO, features, decisions, changelog, and project memories. Returns a JSON object with all project-context/ files. Use when starting work on a project to understand what has been built, what is planned, and what decisions have been made.",
          inputSchema: {
            type: "object" as const,
            properties: {
              project: {
                type: "string",
                description: "Project name. Omit to auto-detect from current directory.",
              },
            },
          },
        },
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
        {
          name: "use_skill",
          description: "Render an identity-aware skill — returns the skill content with the user's identity interpolated into {{var}} placeholders. Returns rendered markdown with instructions the agent should follow. Use when the user asks to generate a CLAUDE.md, sync voice, scaffold a project, or run a self-improvement review.",
          inputSchema: {
            type: "object" as const,
            properties: {
              name: {
                type: "string",
                description: "Skill name: voice-sync, claude-md-generator, project-context-init, meta-improve, proactive-context-fill, you-logs",
              },
            },
            required: ["name"],
          },
        },
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
          description: "Combo tool that compiles the local .youmd bundle, writes it to disk, uploads it, and publishes it in one call. Replaces having to call compile_bundle + push_bundle + publish separately. Requires authentication. Returns the new version number and bundle content hash.",
          inputSchema: {
            type: "object" as const,
            properties: {},
          },
        },
        {
          name: "list_skills",
          description: "List all installed identity-aware skills with their names. Use to discover what skills are available before calling use_skill. Returns a simple list of installed skill names.",
          inputSchema: {
            type: "object" as const,
            properties: {},
          },
        },
        {
          name: "add_source",
          description: "Register an identity data source (LinkedIn, GitHub, X, website, blog, YouTube). Links an external profile to the user's identity so it can be scraped and indexed. Requires authentication. Use when the user wants to connect a new social profile or website to their identity.",
          inputSchema: {
            type: "object" as const,
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
        },
        {
          name: "create_context_link",
          description: "Generate a shareable context link for agents. The link gives any agent temporary or permanent read access to the user's identity context. Use when the user wants to share their identity with a third-party agent or service. Returns a URL that can be passed to any agent.",
          inputSchema: {
            type: "object" as const,
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
        },
        {
          name: "list_projects",
          description: "List all detected projects with their metadata. Returns project names found in the projects root directory. Use to discover available projects before calling get_project_context with a specific project name.",
          inputSchema: {
            type: "object" as const,
            properties: {},
          },
        },
        {
          name: "get_remote_status",
          description: "Check sync status between local identity bundle and the remote you.md server. Returns whether the user is authenticated, whether the local bundle exists, and the current version info. Use to diagnose sync issues or confirm a push was successful.",
          inputSchema: {
            type: "object" as const,
            properties: {},
          },
        },
        {
          name: "get_activity_log",
          description: "Get the user's recent agent activity log. Use this to see which agents have connected to their you.md identity and what they did. Returns an array of activity events with agent name, action, resource, timestamp. Useful for: showing the user proof their identity context is being used by other agents, debugging integration issues, auditing access.",
          inputSchema: {
            type: "object" as const,
            properties: {
              limit: { type: "number", description: "Max events (default 30)" },
              agentName: { type: "string", description: "Filter by agent name (e.g. 'Claude Code')" },
              action: { type: "string", description: "Filter by action (read|write|push|memory_add)" },
            },
          },
        },
      ],
    };
  });

  // ── CALL TOOL ──────────────────────────────────────────────────────

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "whoami": {
        void logMcpActivity("read", "identity:compact");
        return {
          content: [{
            type: "text" as const,
            text: buildWhoamiSummary(),
          }],
        };
      }

      case "get_identity": {
        const format = ((args as Record<string, unknown>)?.format as string) || "compact";
        void logMcpActivity("read", "identity:" + format);
        if (format === "markdown") {
          return { content: [{ type: "text" as const, text: buildIdentityMarkdown() }] };
        }
        if (format === "full" || format === "json") {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(getYouJson(), null, 2),
            }],
          };
        }
        // compact (default) — matches whoami output
        return {
          content: [{
            type: "text" as const,
            text: buildWhoamiSummary(),
          }],
        };
      }

      case "get_section": {
        const section = (args as Record<string, unknown>).section as string;
        const parts = section.split("/");
        if (parts.length !== 2) {
          return { content: [{ type: "text" as const, text: "invalid section path — use format: dir/slug (e.g., profile/about)" }], isError: true };
        }
        const filePath = path.join(getBundleDir(), parts[0], `${parts[1]}.md`);
        const content = readFileOr(filePath, "");
        if (!content) {
          return { content: [{ type: "text" as const, text: `section not found: ${section}` }], isError: true };
        }
        void logMcpActivity("read_section", section);
        return { content: [{ type: "text" as const, text: content }] };
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

      case "add_memory": {
        const { category, content: memContent, tags } = args as {
          category: string;
          content: string;
          tags?: string[];
        };

        if (!isAuthenticated()) {
          return { content: [{ type: "text" as const, text: "not authenticated — run youmd login first" }], isError: true };
        }

        // Validate category against known enum. Reject unknown categories so
        // we don't pollute the memory store with one-off tags masquerading as
        // categories.
        if (!category || !(MEMORY_CATEGORIES as readonly string[]).includes(category)) {
          return {
            content: [{
              type: "text" as const,
              text: `invalid category: ${category || "(missing)"}. valid categories: ${MEMORY_CATEGORIES.join(", ")}`,
            }],
            isError: true,
          };
        }

        try {
          const result = await apiRequest("/api/v1/me/memories", {
            method: "POST",
            body: {
              memories: [{
                category,
                content: memContent,
                source: "mcp",
                sourceAgent: "youmd-mcp",
                tags,
              }],
            },
          });
          void logMcpActivity("memory_add", category);
          return { content: [{ type: "text" as const, text: `memory saved: [${category}] ${memContent.slice(0, 80)}${memContent.length > 80 ? "..." : ""}` }] };
        } catch (err) {
          return { content: [{ type: "text" as const, text: `failed to save memory: ${err instanceof Error ? err.message : "unknown error"}` }], isError: true };
        }
      }

      case "search_memories": {
        const { category, limit } = (args || {}) as { category?: string; limit?: number };
        const memories = await fetchMemories(category, limit || 30);
        void logMcpActivity("read", "memories");
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(memories, null, 2),
          }],
        };
      }

      case "get_project_context": {
        const projectName = (args as Record<string, unknown>)?.project as string | undefined;
        try {
          if (projectName) {
            const root = findProjectsRoot();
            if (!root) throw new Error("no projects directory found");
            const projDir = getProjectDir(root, projectName);
            const ctx = readProjectContext(projDir);
            void logMcpActivity("read", "project/" + projectName);
            return { content: [{ type: "text" as const, text: JSON.stringify(ctx, null, 2) }] };
          }
          const current = getCurrentProject();
          if (!current) {
            return { content: [{ type: "text" as const, text: "no project detected in current directory" }], isError: true };
          }
          const ctx = readProjectContext(current.dir);
          void logMcpActivity("read", "project/current");
          return { content: [{ type: "text" as const, text: JSON.stringify(ctx, null, 2) }] };
        } catch (err) {
          return { content: [{ type: "text" as const, text: `project error: ${err instanceof Error ? err.message : "unknown"}` }], isError: true };
        }
      }

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

      case "use_skill": {
        const skillName = (args as Record<string, unknown>).name as string;
        const skills = getInstalledSkills();
        const skill = skills.find((s) => s.name === skillName);
        if (!skill) {
          const available = skills.map((s) => s.name).join(", ") || "none installed";
          return { content: [{ type: "text" as const, text: `skill not found: ${skillName}. available: ${available}` }], isError: true };
        }
        void logMcpActivity("skill_use", "skill/" + skillName);
        return { content: [{ type: "text" as const, text: skill.rendered || skill.raw }] };
      }

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
          return { content: [{ type: "text" as const, text: "not authenticated — run youmd login first" }], isError: true };
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
          return { content: [{ type: "text" as const, text: "not authenticated — run youmd login first" }], isError: true };
        }
        try {
          const { compileBundle, writeBundle } = await import("../lib/compiler");
          const { uploadBundle, publishLatest } = await import("../lib/api");
          const bundleDir = getBundleDir();

          // 1. Compile from the local .youmd directory
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

      case "list_skills": {
        const skills = getInstalledSkills();
        if (skills.length === 0) {
          return { content: [{ type: "text" as const, text: "no skills installed. run: youmd skill install voice-sync" }] };
        }
        const list = skills.map((s) => `- ${s.name}`).join("\n");
        void logMcpActivity("read", "skills");
        return { content: [{ type: "text" as const, text: `installed skills:\n${list}` }] };
      }

      case "add_source": {
        if (!isAuthenticated()) {
          return { content: [{ type: "text" as const, text: "not authenticated — run youmd login first" }], isError: true };
        }
        const { sourceType, sourceUrl } = args as { sourceType: string; sourceUrl: string };
        try {
          const result = await apiRequest("/api/v1/me/sources", {
            method: "POST",
            body: { sourceType, sourceUrl },
          });
          void logMcpActivity("write", "source/" + sourceType);
          return { content: [{ type: "text" as const, text: `source registered: [${sourceType}] ${sourceUrl}` }] };
        } catch (err) {
          return { content: [{ type: "text" as const, text: `failed to add source: ${err instanceof Error ? err.message : "unknown error"}` }], isError: true };
        }
      }

      case "create_context_link": {
        if (!isAuthenticated()) {
          return { content: [{ type: "text" as const, text: "not authenticated — run youmd login first" }], isError: true };
        }
        const { scope, ttl } = (args || {}) as { scope?: string; ttl?: string };
        try {
          const result = await apiRequest("/api/v1/me/context-links", {
            method: "POST",
            body: { scope: scope || "public", ttl: ttl || "24h" },
          }) as Record<string, unknown>;
          const link = result.url || result.link || JSON.stringify(result);
          void logMcpActivity("write", "context-link", { scope: scope || "public" });
          return { content: [{ type: "text" as const, text: `context link created: ${link}\nscope: ${scope || "public"}, ttl: ${ttl || "24h"}` }] };
        } catch (err) {
          return { content: [{ type: "text" as const, text: `failed to create context link: ${err instanceof Error ? err.message : "unknown error"}` }], isError: true };
        }
      }

      case "list_projects": {
        try {
          const root = findProjectsRoot();
          if (!root) {
            return { content: [{ type: "text" as const, text: "no projects directory found" }], isError: true };
          }
          const projects = listProjects(root);
          if (projects.length === 0) {
            return { content: [{ type: "text" as const, text: "no projects detected. create one with: youmd project init <name>" }] };
          }
          const current = getCurrentProject();
          const list = projects.map((p) => {
            const marker = current && current.name === p ? " (current)" : "";
            return `- ${p}${marker}`;
          }).join("\n");
          void logMcpActivity("read", "projects");
          return { content: [{ type: "text" as const, text: `projects:\n${list}` }] };
        } catch (err) {
          return { content: [{ type: "text" as const, text: `error listing projects: ${err instanceof Error ? err.message : "unknown"}` }], isError: true };
        }
      }

      case "get_remote_status": {
        const authenticated = isAuthenticated();
        const bundleExists = localBundleExists();
        const youJson = getYouJson();
        const version = (youJson as Record<string, unknown>)?.version || "unknown";

        const status: Record<string, unknown> = {
          authenticated,
          localBundleExists: bundleExists,
          localVersion: version,
        };

        if (authenticated) {
          try {
            const remote = await apiRequest("/api/v1/me/status") as Record<string, unknown>;
            status.remote = remote;
          } catch {
            status.remote = "unreachable";
          }
        }

        void logMcpActivity("read", "status");

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(status, null, 2),
          }],
        };
      }

      case "get_activity_log": {
        if (!isAuthenticated()) {
          return { content: [{ type: "text" as const, text: "not authenticated — run youmd login first" }], isError: true };
        }
        const config = readGlobalConfig();
        const params = new URLSearchParams();
        const activityArgs = (args || {}) as { limit?: number; agentName?: string; action?: string };
        if (activityArgs.limit) params.set("limit", String(activityArgs.limit));
        if (activityArgs.agentName) params.set("agent", String(activityArgs.agentName));
        if (activityArgs.action) params.set("action", String(activityArgs.action));

        const res = await fetch(`${getConvexSiteUrl()}/api/v1/me/activity?${params}`, {
          headers: { Authorization: `Bearer ${config.token}` },
          signal: AbortSignal.timeout(10_000),
        });

        if (!res.ok) {
          return { content: [{ type: "text" as const, text: `failed to fetch activity log: ${res.status}` }], isError: true };
        }

        const data = await res.json() as { activity?: any[] };
        const events = data.activity || [];

        if (events.length === 0) {
          return { content: [{ type: "text" as const, text: "No activity yet. Agents will appear here when they connect to your you.md identity." }] };
        }

        const formatted = events.slice(0, 30).reverse().map((e: any) => {
          const time = new Date(e.createdAt).toTimeString().slice(0, 5);
          const versions = e.bundleVersionBefore && e.bundleVersionAfter
            ? ` v${e.bundleVersionBefore}→v${e.bundleVersionAfter}`
            : '';
          return `${time}  ${e.agentName.padEnd(16)}  ${e.action.padEnd(12)}  ${e.resource || ''}${versions}`;
        }).join('\n');

        return {
          content: [{
            type: "text" as const,
            text: `── recent agent activity (${events.length} events) ──\n\n${formatted}`,
          }],
        };
      }

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
