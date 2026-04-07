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
 *            compile_bundle, push_bundle, get_project_context
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
    if (uri === "youmd://memories") {
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
          name: "get_identity",
          description: "Get the user's complete you.md identity bundle — who they are, how they work, their voice, preferences, and directives. Start here to understand who you're working with.",
          inputSchema: {
            type: "object" as const,
            properties: {
              format: {
                type: "string",
                enum: ["json", "markdown"],
                description: "Output format: json (structured) or markdown (human-readable). Default: json",
              },
            },
          },
        },
        {
          name: "get_section",
          description: "Read a specific identity section (about, projects, now, values, links, agent preferences, writing preferences, voice, directives)",
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
          description: "Update a section of the user's identity. Writes the content to the local .youmd/ directory.",
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
          description: "Save a memory about the user — facts, preferences, decisions, or context learned during this conversation. Memories persist across sessions and inform all future agent interactions.",
          inputSchema: {
            type: "object" as const,
            properties: {
              category: {
                type: "string",
                description: "Memory category: fact, preference, decision, project, goal, insight, context",
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
          description: "Search the user's memories by category or list all active memories",
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
          description: "Get the full project context for the current or named project — PRD, TODO, features, decisions, changelog, and project memories",
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
          description: "Save a memory scoped to a specific project",
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
          description: "Render an identity-aware skill — returns the skill content with the user's identity interpolated into {{var}} placeholders",
          inputSchema: {
            type: "object" as const,
            properties: {
              name: {
                type: "string",
                description: "Skill name: voice-sync, claude-md-generator, project-context-init, meta-improve",
              },
            },
            required: ["name"],
          },
        },
        {
          name: "compile_bundle",
          description: "Recompile the local identity bundle from profile/, preferences/, voice/, directives/ files into you.json + you.md",
          inputSchema: {
            type: "object" as const,
            properties: {},
          },
        },
        {
          name: "push_bundle",
          description: "Push the local identity bundle to you.md servers and publish the profile. Requires authentication.",
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
          name: "list_skills",
          description: "List all installed identity-aware skills with their status",
          inputSchema: {
            type: "object" as const,
            properties: {},
          },
        },
      ],
    };
  });

  // ── CALL TOOL ──────────────────────────────────────────────────────

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "get_identity": {
        const format = (args as Record<string, unknown>)?.format || "json";
        if (format === "markdown") {
          return { content: [{ type: "text" as const, text: getYouMd() }] };
        }
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(getYouJson(), null, 2),
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
          return { content: [{ type: "text" as const, text: `memory saved: [${category}] ${memContent.slice(0, 80)}${memContent.length > 80 ? "..." : ""}` }] };
        } catch (err) {
          return { content: [{ type: "text" as const, text: `failed to save memory: ${err instanceof Error ? err.message : "unknown error"}` }], isError: true };
        }
      }

      case "search_memories": {
        const { category, limit } = (args || {}) as { category?: string; limit?: number };
        const memories = await fetchMemories(category, limit || 30);
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
            return { content: [{ type: "text" as const, text: JSON.stringify(ctx, null, 2) }] };
          }
          const current = getCurrentProject();
          if (!current) {
            return { content: [{ type: "text" as const, text: "no project detected in current directory" }], isError: true };
          }
          const ctx = readProjectContext(current.dir);
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
        return { content: [{ type: "text" as const, text: skill.rendered || skill.raw }] };
      }

      case "compile_bundle": {
        try {
          const { compileBundle, writeBundle } = await import("../lib/compiler");
          const bundleDir = getBundleDir();
          const result = compileBundle(bundleDir);
          writeBundle(bundleDir, result);
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

      case "list_skills": {
        const skills = getInstalledSkills();
        if (skills.length === 0) {
          return { content: [{ type: "text" as const, text: "no skills installed. run: youmd skill install voice-sync" }] };
        }
        const list = skills.map((s) => `- ${s.name}`).join("\n");
        return { content: [{ type: "text" as const, text: `installed skills:\n${list}` }] };
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
