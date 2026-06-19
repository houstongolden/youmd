/**
 * T14 — Unified hosted MCP tool registry.
 *
 * Single source of truth for all tools served by POST /api/v1/mcp.
 * Adding a tool requires editing only this file; convex/http.ts
 * tools/list and tools/call both drive from HOSTED_MCP_TOOLS.
 *
 * Shape:
 *   name         — JSON-RPC tool name (string)
 *   description  — surfaced to MCP clients in tools/list
 *   inputSchema  — JSON Schema object for tool arguments
 *   scopes       — ApiScope[] required (empty = unauthenticated OK). The http
 *                  handler checks auth once before calling the handler, then
 *                  forwards auth so the handler can use it without re-checking.
 *   handler      — business logic; receives (ctx, args, auth).
 *                  auth is null for unauthenticated tools (scopes: []).
 *
 * The handler MUST NOT call authenticateRequest or requireScope —
 * auth enforcement lives exclusively in the http route handler, which
 * runs the scope check once before dispatching to the registry.
 */

import type { ActionCtx } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ApiScope } from "./scopes";
import {
  AGENT_CONTEXT_MEMORY_CAP,
  asRecord,
  assembleAgentContext,
  memoryOneLine,
  selectPublicIdentityFields,
  type AgentContextMemory,
  type AssembledAgentContext,
} from "./agentContext";
import { deriveStacks } from "../github";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/**
 * Content item returned by a tool handler (mirrors MCP content shape).
 * The http handler wraps this in the standard { content, isError } envelope.
 */
export interface McpContent {
  type: "text";
  text: string;
  mimeType?: string;
}

/**
 * Result returned by every registry handler.
 * isError defaults to false when absent.
 */
export interface McpHandlerResult {
  content: McpContent[];
  isError?: boolean;
}

/**
 * Auth context forwarded from the http handler to the registry handler.
 * Null for unauthenticated tools (scopes: []).
 */
export interface McpAuthContext {
  credentialType: "api-key" | "connected-app";
  userId: string;        // clerkId
  username: string;
  plan: string;
  scopes: string[] | null;
  declaredScopes: string[];
  userDbId: Id<"users">;
  apiKeyId?: Id<"apiKeys">;
  connectedAppGrantId?: Id<"connectedAppGrants">;
  appSlug?: string;
  appName?: string;
  appType?: string;
  resourceScopes?: string[];
  writePolicy?: string;
  trustLevel?: string;
}

type CtxForHandlers = Pick<ActionCtx, "runQuery" | "runMutation">;

/** Single MCP tool specification (metadata + handler). */
export interface McpToolSpec {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  /** ApiScope[] required; empty means no auth needed. */
  scopes: ApiScope[];
  /** Business logic; auth is null when scopes is empty. */
  handler: (
    ctx: CtxForHandlers,
    args: Record<string, unknown>,
    auth: McpAuthContext | null
  ) => Promise<McpHandlerResult>;
}

// ---------------------------------------------------------------------------
// Trusted internal token (Cycle 43 bypass for httpAction→mutation calls).
// ---------------------------------------------------------------------------
const TRUSTED_INTERNAL_AUTH_TOKEN = process.env.TRUSTED_INTERNAL_AUTH_TOKEN;

// ---------------------------------------------------------------------------
// HostedAgentBrief helpers (co-located to avoid circular import from http.ts)
// ---------------------------------------------------------------------------

type HostedAgentBrief = {
  generatedAt: string;
  user: { username: string; plan: string | null; profileUrl: string; summary: string };
  memories: {
    included: boolean;
    count: number;
    items: Array<{ category: string; content: string; source: string | null; createdAt: number }>;
  };
  skills: { installed: string[] };
  nextMoves: string[];
  reminders: string[];
};

function buildHostedAgentBrief(assembled: AssembledAgentContext): HostedAgentBrief {
  const nextMoves: string[] = [];
  if (assembled.memories.items.length > 0) {
    nextMoves.push("Apply the durable preferences/decisions in Memories before proposing work.");
  }
  nextMoves.push("Call get_identity (or get_my_identity for private detail) when you need the full bundle.");
  nextMoves.push("Log meaningful new durable facts back with the memories API so future sessions start smarter.");

  return {
    generatedAt: new Date().toISOString(),
    user: {
      username: assembled.username ?? "",
      plan: assembled.plan,
      profileUrl: `https://you.md/${assembled.username ?? ""}`,
      summary: assembled.identitySummary,
    },
    memories: {
      included: assembled.memories.included,
      count: assembled.memories.items.length,
      items: assembled.memories.items.map((memory) => ({
        category: memory.category,
        content: memoryOneLine(memory.content),
        source: memory.sourceAgent ?? memory.source ?? null,
        createdAt: memory.createdAt ?? 0,
      })),
    },
    skills: { installed: assembled.installedSkills },
    nextMoves,
    reminders: [
      "Read the whole user request before acting; split multi-part asks into tracked items.",
      "Do not claim work is done unless it actually succeeded end-to-end.",
    ],
  };
}

function formatAgentBriefMarkdown(brief: HostedAgentBrief, maxChars = 6000): string {
  const lines: string[] = [];
  lines.push("# You.md Agent Brief");
  lines.push("");
  lines.push("## User");
  lines.push(brief.user.summary || "(no identity summary available)");
  lines.push("");
  lines.push(`- profile: ${brief.user.profileUrl}`);
  if (brief.user.plan) lines.push(`- plan: ${brief.user.plan}`);
  lines.push("");
  lines.push(`## Memories (${brief.memories.count})`);
  if (!brief.memories.included) {
    lines.push("- excluded (includeMemories=false)");
  } else if (brief.memories.items.length === 0) {
    lines.push("- none recorded yet");
  } else {
    for (const memory of brief.memories.items) {
      lines.push(`- [${memory.category}] ${memory.content}`);
    }
  }
  lines.push("");
  lines.push("## Skills");
  lines.push(`- installed: ${brief.skills.installed.length > 0 ? brief.skills.installed.join(", ") : "none"}`);
  lines.push("");
  lines.push("## Next Moves");
  lines.push(brief.nextMoves.map((move) => `- ${move}`).join("\n"));
  lines.push("");
  lines.push("## Reminders");
  lines.push(brief.reminders.map((reminder) => `- ${reminder}`).join("\n"));
  let markdown = lines.join("\n");
  if (markdown.length > maxChars) {
    markdown = markdown.slice(0, Math.max(0, maxChars - 32)).trimEnd() + "\n\n[truncated]";
  }
  return markdown;
}

/** Load the authenticated user's identity (user row + youJson from latest bundle). */
async function loadAuthedUserIdentity(
  ctx: CtxForHandlers,
  auth: McpAuthContext
): Promise<{
  user: { _id: Id<"users">; username: string; plan?: string };
  youJson: Record<string, unknown>;
} | null> {
  const user = await ctx.runQuery(api.users.getByClerkId, {
    clerkId: auth.userId,
    _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
  });
  if (!user) return null;
  const profile = await ctx.runQuery(api.profiles.getByOwnerId, { ownerId: user._id });
  const latestBundle = await ctx.runQuery(api.bundles.getLatestBundle, {
    clerkId: auth.userId,
    _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
    userId: user._id,
  });
  const youJson = asRecord(latestBundle?.youJson ?? profile?.youJson);
  return { user, youJson };
}

/** Derive YouStacks from mirror files (re-exported from convex/github.ts via http.ts). */
async function getMirrorStacks(
  ctx: CtxForHandlers,
  auth: McpAuthContext
): Promise<{ mirror: { repoFullName: string; files: Array<{ path: string; content: string }> } | null }> {
  const mirror = await ctx.runQuery(
    internal.github.internalGetMirrorByClerkId,
    { clerkId: auth.userId }
  );
  return { mirror: mirror ?? null };
}

// Helper: produce a text/plain McpHandlerResult
function textResult(text: string, mimeType = "text/plain"): McpHandlerResult {
  return { content: [{ type: "text", text, mimeType }], isError: false };
}

// Helper: produce a tool-error McpHandlerResult
function errorResult(message: string): McpHandlerResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

const PRIVATE_CONTEXT_OMISSIONS = [
  "private memories",
  "private loop reports",
  "private connected-app data",
  "private source snapshots",
  "owner-only agent logs",
  "scoped API/MCP grants",
];

type PublicContextSection = {
  label: string;
  value: string;
};

type PublicChatSettings = {
  enabled: boolean;
  style: "concise" | "voice" | "consultive";
  allowedFields: string[];
  capabilities: string[];
  customPrompt: string;
  showSources: boolean;
};

const PUBLIC_CHAT_FIELD_LABELS = [
  "identity.name",
  "identity.tagline",
  "identity.location",
  "identity.bio",
  "analysis.voice_summary",
  "preferences.agent.tone",
  "now.focus",
  "projects",
  "values",
  "topics",
  "skills",
  "links",
] as const;

const DEFAULT_PUBLIC_CHAT_FIELDS = [...PUBLIC_CHAT_FIELD_LABELS];
const DEFAULT_PUBLIC_CHAT_CAPABILITIES = ["current_work", "expertise", "voice", "links", "api"];

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringList(value: unknown, limit = 6): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item))
    .filter(Boolean)
    .slice(0, limit);
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const text = asString(value);
    if (text) return text;
  }
  return "";
}

function truncate(text: string, max = 220): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}...`;
}

function publicChatSettings(data: Record<string, unknown>): PublicChatSettings {
  const preferences = asRecord(data.preferences);
  const raw = asRecord(preferences.public_chat ?? preferences.publicChat);
  const style = asString(raw.style);
  const allowedFields = asStringList(raw.allowedFields, 24)
    .filter((field) => PUBLIC_CHAT_FIELD_LABELS.includes(field as (typeof PUBLIC_CHAT_FIELD_LABELS)[number]));
  const capabilities = asStringList(raw.capabilities, 12);

  return {
    enabled: raw.enabled !== false,
    style: style === "voice" || style === "consultive" ? style : "concise",
    allowedFields: allowedFields.length > 0 ? allowedFields : DEFAULT_PUBLIC_CHAT_FIELDS,
    capabilities: capabilities.length > 0 ? capabilities : DEFAULT_PUBLIC_CHAT_CAPABILITIES,
    customPrompt: truncate(asString(raw.customPrompt), 360),
    showSources: raw.showSources !== false,
  };
}

function projectSummaries(projects: unknown): string[] {
  if (!Array.isArray(projects)) return [];
  return projects
    .map((project) => {
      const record = asRecord(project);
      const name = asString(record.name);
      if (!name || name.startsWith("#")) return "";
      const status = asString(record.status);
      const description = asString(record.description);
      const role = asString(record.role);
      const details = [status, role, description].filter(Boolean).join(" / ");
      return details ? `${name}: ${truncate(details, 180)}` : name;
    })
    .filter(Boolean)
    .slice(0, 6);
}

function linkSummaries(links: unknown): string[] {
  const record = asRecord(links);
  return Object.entries(record)
    .filter(([, url]) => typeof url === "string" && url.trim())
    .map(([label, url]) => `${label}: ${url}`)
    .slice(0, 8);
}

function wants(message: string, keywords: string[]): boolean {
  return keywords.some((keyword) => message.includes(keyword));
}

function buildPublicProfileConversation(
  username: string,
  profile: {
    username?: string;
    displayName?: string | null;
    youJson?: unknown;
  },
  message: string
) {
  const data = asRecord(profile.youJson ?? profile);
  const identity = asRecord(data.identity);
  const bio = asRecord(identity.bio);
  const analysis = asRecord(data.analysis);
  const preferences = asRecord(data.preferences);
  const agentPreferences = asRecord(preferences.agent);
  const now = asRecord(data.now);

  const name = firstString(identity.name, profile.displayName, profile.username, username);
  const projects = projectSummaries(data.projects);
  const focus = asStringList(now.focus, 6);
  const values = asStringList(data.values, 6);
  const topics = asStringList(analysis.topics, 8);
  const skills = asStringList(identity.skills, 8);
  const links = linkSummaries(data.links ?? identity.links);
  const settings = publicChatSettings(data);
  if (!settings.enabled) {
    return {
      answer: "This profile owner has disabled public profile chat.",
      username,
      subject: firstString(asString(identity.name), name, `@${username}`),
      voice_mode: "public-context-disabled",
      sources: [],
      public_context_used: [],
      capabilities: [],
      omitted_private_context: PRIVATE_CONTEXT_OMISSIONS,
      suggested_followups: [],
    };
  }
  const allowed = new Set(settings.allowedFields);

  const sections: PublicContextSection[] = [
    { label: "identity.name", value: name },
    { label: "identity.tagline", value: asString(identity.tagline) },
    { label: "identity.location", value: asString(identity.location) },
    { label: "identity.bio", value: firstString(bio.long, bio.medium, bio.short) },
    { label: "analysis.voice_summary", value: asString(analysis.voice_summary) },
    { label: "preferences.agent.tone", value: asString(agentPreferences.tone) },
    { label: "now.focus", value: focus.join("; ") },
    { label: "projects", value: projects.join("; ") },
    { label: "values", value: values.join("; ") },
    { label: "topics", value: topics.join(", ") },
    { label: "skills", value: skills.join(", ") },
    { label: "links", value: links.join("; ") },
  ].filter((section) => section.value && (section.label === "identity.name" || allowed.has(section.label)));

  const normalizedMessage = message.toLowerCase();
  const selected: PublicContextSection[] = [];
  const push = (labels: string[]) => {
    for (const section of sections) {
      if (labels.includes(section.label) && !selected.some((item) => item.label === section.label)) {
        selected.push(section);
      }
    }
  };

  if (wants(normalizedMessage, ["project", "building", "work", "startup", "company", "build"])) {
    push(["projects", "now.focus", "identity.tagline"]);
  }
  if (wants(normalizedMessage, ["today", "now", "current", "focus", "agenda"])) {
    push(["now.focus", "identity.location", "projects"]);
  }
  if (wants(normalizedMessage, ["about", "bio", "background", "who", "story"])) {
    push(["identity.name", "identity.tagline", "identity.bio", "topics", "skills"]);
  }
  if (wants(normalizedMessage, ["voice", "style", "personality", "advice", "perspective", "consult"])) {
    push(["analysis.voice_summary", "preferences.agent.tone", "values", "topics"]);
  }
  if (wants(normalizedMessage, ["link", "contact", "social", "github", "linkedin", "website"])) {
    push(["links"]);
  }
  if (wants(normalizedMessage, ["api", "mcp", "endpoint", "json", "agent"])) {
    push(["analysis.voice_summary", "preferences.agent.tone"]);
  }
  if (selected.length === 0) {
    push(["identity.name", "identity.tagline", "identity.bio", "now.focus", "projects", "analysis.voice_summary"]);
  }

  const compact = selected.slice(0, 5);
  const summary = compact
    .map((section) => `- ${section.label}: ${truncate(section.value, 260)}`)
    .join("\n");
  const publicName = firstString(asString(identity.name), name, `@${username}`);
  const styleLine =
    settings.style === "voice"
      ? `Owner style: answer in ${publicName}'s public voice and personality signals, without pretending to be them.`
      : settings.style === "consultive"
      ? "Owner style: be useful and consultive, grounded only in public context."
      : "Owner style: concise public-context summary.";
  const customLine = settings.customPrompt
    ? `Owner note: ${settings.customPrompt}`
    : "";
  const answer = [
    `From ${publicName}'s public You.md context:`,
    styleLine,
    customLine,
    summary || "- No detailed public context has been published yet.",
    `Agents can read https://you.md/${username}/you.json or https://you.md/${username}/you.txt for the same public brain surface.`,
    "I did not use private memories, private reports, connected-app data, source snapshots, logs, or scoped grants for this answer.",
  ].filter(Boolean).join("\n\n");

  return {
    answer,
    username,
    subject: publicName,
    voice_mode: `public-context-${settings.style}`,
    sources: settings.showSources ? [
      { label: "public you.json", href: `https://you.md/${username}/you.json`, scope: "public" },
      { label: "public you.txt", href: `https://you.md/${username}/you.txt`, scope: "public" },
    ] : [],
    public_context_used: compact.map((section) => section.label),
    capabilities: settings.capabilities,
    owner_public_chat_settings: {
      style: settings.style,
      showSources: settings.showSources,
      allowedFields: settings.allowedFields,
    },
    omitted_private_context: PRIVATE_CONTEXT_OMISSIONS,
    suggested_followups: [
      `What is ${publicName} building right now?`,
      `What should I ask ${publicName} about?`,
      `Summarize ${publicName}'s public expertise.`,
      `Which public endpoints exist for @${username}?`,
    ],
  };
}

// ---------------------------------------------------------------------------
// Tool Registry
// ---------------------------------------------------------------------------

export const HOSTED_MCP_TOOLS: McpToolSpec[] = [
  // ── whoami ──────────────────────────────────────────────────────────────────
  {
    name: "whoami",
    description:
      "Return a compact ~500-char identity summary of the authenticated user: name, role, stack, tone, things to avoid, top projects, and current goal. This is the FIRST tool you should call when starting a new conversation — it gives you just enough context to orient on the user before deciding whether to pull the full identity bundle. Returns plain text, not JSON. Requires a you.md API key passed as Bearer token in the Authorization header.",
    inputSchema: { type: "object", properties: {} },
    scopes: ["read:private"],
    async handler(ctx, _args, auth) {
      if (!auth) return errorResult("authentication required — pass your you.md API key as Bearer token");
      const identity = await loadAuthedUserIdentity(ctx, auth);
      if (!identity) return errorResult("user not found");
      const assembled = assembleAgentContext({
        username: identity.user.username,
        youJson: identity.youJson,
        includeMemories: false,
      });
      return textResult(assembled.identitySummary, "text/plain");
    },
  },

  // ── get_agent_brief ─────────────────────────────────────────────────────────
  {
    name: "get_agent_brief",
    description:
      "Return a startup brief for the authenticated user. Use immediately after whoami when starting Claude Code, Codex, Cursor, or another MCP-backed session. It combines a compact identity summary, the user's recent durable memories (rendered inline by default), installed skills, and recommended next moves so the agent can act without asking the user to re-explain everything. Requires a you.md API key passed as Bearer token in the Authorization header.",
    inputSchema: {
      type: "object",
      properties: {
        format: {
          type: "string",
          enum: ["markdown", "json"],
          description: "Output format. markdown is default and best for agent context; json is best for automation.",
        },
        includeMemories: {
          type: "boolean",
          description: "Include up to 20 memories (category + content, durable categories first, then newest). Default true.",
        },
        maxChars: {
          type: "number",
          description: "Maximum markdown characters when format=markdown. Default 6000.",
        },
      },
    },
    scopes: ["read:private"],
    async handler(ctx, args, auth) {
      if (!auth) return errorResult("authentication required — pass your you.md API key as Bearer token");
      const identity = await loadAuthedUserIdentity(ctx, auth);
      if (!identity) return errorResult("user not found");

      const includeMemories = args.includeMemories !== false;
      let rawMemories: AgentContextMemory[] = [];
      if (includeMemories) {
        try {
          const raw = await ctx.runQuery(api.memories.listMemories, {
            clerkId: auth.userId,
            _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
            userId: identity.user._id,
            limit: AGENT_CONTEXT_MEMORY_CAP * 3,
          });
          rawMemories = Array.isArray(raw) ? (raw as AgentContextMemory[]) : [];
        } catch { /* memories are additive — never fail the brief on them */ }
      }

      let installedSkills: string[] = [];
      try {
        const installs = await ctx.runQuery(api.skills.listInstalls, {
          clerkId: auth.userId,
          _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
          userId: identity.user._id,
        });
        installedSkills = (Array.isArray(installs) ? installs : [])
          .map((install: { skillName: string }) => install.skillName);
      } catch { /* skill installs are additive — never fail the brief on them */ }

      const assembled = assembleAgentContext({
        username: identity.user.username,
        plan: typeof identity.user.plan === "string" ? identity.user.plan : null,
        youJson: identity.youJson,
        memories: rawMemories,
        includeMemories,
        installedSkills,
      });

      const brief = buildHostedAgentBrief(assembled);

      if (args.format === "json") {
        return textResult(JSON.stringify(brief, null, 2), "application/json");
      }

      const maxChars =
        typeof args.maxChars === "number" && args.maxChars > 500
          ? Math.min(args.maxChars, 20000)
          : 6000;
      return textResult(formatAgentBriefMarkdown(brief, maxChars), "text/markdown");
    },
  },

  // ── get_identity ─────────────────────────────────────────────────────────────
  {
    name: "get_identity",
    description:
      "Get a user's public identity bundle from you.md. Returns their structured identity: bio, projects, values, agent directives, communication preferences, and more. Use this at the start of a session to understand who you're working with.",
    inputSchema: {
      type: "object",
      properties: {
        username: {
          type: "string",
          description: "The you.md username (e.g. 'houstongolden')",
        },
      },
      required: ["username"],
    },
    scopes: [],
    async handler(ctx, args) {
      const username = args.username as string;
      if (!username || typeof username !== "string") return errorResult("username is required");

      const profile = await ctx.runQuery(api.profiles.getPublicProfile, {
        username: username.toLowerCase().replace(/^@/, ""),
      });
      if (!profile) return errorResult(`no profile found for @${username}`);

      try {
        await ctx.runMutation(api.profiles.recordView, {
          username: username.toLowerCase(),
          referrer: "mcp",
          isAgentRead: true,
        });
      } catch { /* non-fatal */ }

      const result = {
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        isClaimed: profile.isClaimed,
        ...selectPublicIdentityFields(
          profile.youJson as Record<string, unknown> | null
        ),
        _profile_url: `https://you.md/${profile.username}`,
      } as Record<string, unknown>;

      try {
        const repoStacks = await ctx.runQuery(api.github.getPublicRepoStacks, {
          username: username.toLowerCase().replace(/^@/, ""),
        });
        if (repoStacks && repoStacks.stacks.length > 0) {
          result.repo_stacks = repoStacks;
        }
      } catch { /* non-fatal */ }

      return textResult(JSON.stringify(result, null, 2), "application/json");
    },
  },

  // ── ask_public_profile ──────────────────────────────────────────────────────
  {
    name: "ask_public_profile",
    description:
      "Ask a public-context-only question about a You.md profile. This is the MCP companion to POST /api/v1/profiles/{username}/conversation: it answers from the user's public you.json/you.txt surface, returns public field provenance, and explicitly omits private memories, loop reports, connected-app data, source snapshots, logs, and scoped grants.",
    inputSchema: {
      type: "object",
      properties: {
        username: {
          type: "string",
          description: "The You.md username to ask about, without @.",
        },
        message: {
          type: "string",
          description: "The public-context question to answer.",
        },
      },
      required: ["username", "message"],
    },
    scopes: [],
    async handler(ctx, args) {
      const rawUsername = args.username;
      const rawMessage = args.message;
      if (typeof rawUsername !== "string" || !rawUsername.trim()) {
        return errorResult("username is required");
      }
      if (typeof rawMessage !== "string" || !rawMessage.trim()) {
        return errorResult("message is required");
      }

      const username = rawUsername.trim().toLowerCase().replace(/^@/, "");
      if (!/^[a-z0-9_-]{2,64}$/.test(username)) {
        return errorResult("invalid username");
      }
      const message = rawMessage.trim();
      if (message.length > 1200) {
        return errorResult("message must be 1200 characters or fewer");
      }

      const profile = await ctx.runQuery(api.profiles.getPublicProfile, { username });
      if (!profile) return errorResult(`no profile found for @${username}`);

      try {
        await ctx.runMutation(api.profiles.recordView, {
          username,
          referrer: "mcp:ask_public_profile",
          isAgentRead: true,
        });
      } catch { /* non-fatal */ }

      return textResult(
        JSON.stringify(buildPublicProfileConversation(username, profile, message), null, 2),
        "application/json"
      );
    },
  },

  // ── search_profiles ──────────────────────────────────────────────────────────
  {
    name: "search_profiles",
    description: "Search or list public profiles on you.md.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Optional search query to filter profiles by name or username",
        },
        limit: {
          type: "number",
          description: "Max number of results (default 20, max 100)",
        },
      },
    },
    scopes: [],
    async handler(ctx, args) {
      const query = (args.query as string | undefined) || "";
      const limit = Math.min(Number(args.limit) || 20, 100);

      const filtered = query.trim()
        ? await ctx.runQuery(api.profiles.searchPublicProfiles, {
            query: query.trim(),
            limit,
          })
        : await ctx.runQuery(api.profiles.listAll);

      const results = (filtered as Array<Record<string, unknown>>)
        .slice(0, limit)
        .map((p) => ({
          username: p.username,
          name: p.name,
          tagline: p.tagline,
          profileUrl: `https://you.md/${p.username}`,
          updatedAt: p.updatedAt || p.createdAt,
        }));

      return textResult(JSON.stringify({ profiles: results, total: results.length }, null, 2), "application/json");
    },
  },

  // ── get_my_identity ──────────────────────────────────────────────────────────
  {
    name: "get_my_identity",
    description:
      "Get the authenticated user's full identity bundle, including private context. Requires a you.md API key passed as Bearer token in the Authorization header.",
    inputSchema: { type: "object", properties: {} },
    scopes: ["read:private"],
    async handler(ctx, _args, auth) {
      if (!auth) return errorResult("authentication required — pass your you.md API key as Bearer token");

      const user = await ctx.runQuery(api.users.getByClerkId, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
      });
      if (!user) return errorResult("user not found");

      const profile = await ctx.runQuery(api.profiles.getByOwnerId, { ownerId: user._id });
      const latestBundle = await ctx.runQuery(api.bundles.getLatestBundle, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        userId: user._id,
      });

      const result = {
        username: user.username,
        email: user.email,
        plan: user.plan,
        profile: profile
          ? { avatarUrl: profile.avatarUrl, name: profile.name, tagline: profile.tagline }
          : null,
        bundle: latestBundle
          ? {
              version: latestBundle.version,
              isPublished: latestBundle.isPublished,
              youJson: latestBundle.youJson,
              youMd: latestBundle.youMd,
            }
          : null,
        _profile_url: `https://you.md/${user.username}`,
      };

      return textResult(JSON.stringify(result, null, 2), "application/json");
    },
  },

  // ── get_agent_stack_inventory ───────────────────────────────────────────────
  {
    name: "get_agent_stack_inventory",
    description:
      "Read the authenticated user's latest You.md agent-stack inventory snapshots: skill/stack counts, machine roots, You.md catalog gaps, DRY review queues, mirror clusters, provenance/source rollups, and repo snapshot files. Use to audit cross-machine skill drift and sync health without exposing secrets.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum inventory snapshots to return (default 5, max 20).",
        },
        include_repo_snapshot: {
          type: "boolean",
          description: "Include safe agent-stack snapshot files from the authenticated repo mirror when available (default true).",
        },
      },
    },
    scopes: ["read:private"],
    async handler(ctx, args, auth) {
      if (!auth) return errorResult("authentication required — pass your you.md API key as Bearer token");
      const limit = boundedNumber(args.limit, 5, 1, 20);
      const inventories = await ctx.runQuery(api.portfolio.listAgentStackInventories, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        limit,
      });

      let repoSnapshot: {
        repo: string | null;
        expectedPaths: string[];
        missingPaths: string[];
        files: Array<{ path: string; size: number; content: string }>;
      } | null = null;
      if (args.include_repo_snapshot !== false) {
        const { mirror } = await getMirrorStacks(ctx, auth);
        const expectedPaths = [
          "agent-stack/README.md",
          "agent-stack/inventory.md",
          "agent-stack/inventory.json",
        ];
        const snapshotPaths = new Set(expectedPaths);
        const files = (mirror?.files ?? [])
          .filter((file: { path: string }) => snapshotPaths.has(file.path))
          .map((file: { path: string; content: string }) => ({
            path: file.path,
            size: file.content.length,
            content: file.content,
          }));
        const presentPaths = new Set(files.map((file) => file.path));
        repoSnapshot = {
          repo: mirror?.repoFullName ?? null,
          expectedPaths,
          missingPaths: expectedPaths.filter((path) => !presentPaths.has(path)),
          files,
        };
      }

      return textResult(
        JSON.stringify(
          {
            schemaVersion: "you-md/agent-stack-mcp/v1",
            inventories,
            repoSnapshot,
            secretValuesExposed: false,
          },
          null,
          2
        ),
        "application/json"
      );
    },
  },

  // ── get_my_stacks ────────────────────────────────────────────────────────────
  {
    name: "get_my_stacks",
    description:
      "List the YouStacks the authenticated user hosts in their own GitHub repo (from the You.md server-side mirror). Requires a you.md API key as Bearer token.",
    inputSchema: { type: "object", properties: {} },
    scopes: ["read:private"],
    async handler(ctx, _args, auth) {
      if (!auth) return errorResult("authentication required — pass your you.md API key as Bearer token");
      const { mirror } = await getMirrorStacks(ctx, auth);
      if (!mirror) {
        return textResult(
          JSON.stringify({ repo: null, stacks: [], message: "No repo mirror yet. Link a repo and sync in settings." }, null, 2),
          "application/json"
        );
      }
      return textResult(
        JSON.stringify({ repo: mirror.repoFullName, stacks: deriveStacks(mirror.files) }, null, 2),
        "application/json"
      );
    },
  },

  // ── get_repo_file ────────────────────────────────────────────────────────────
  {
    name: "get_repo_file",
    description:
      "Read one file (e.g. you.md, you.json, or a stacks/<slug>/... file) from the authenticated user's repo via the You.md server-side mirror. Requires a you.md API key as Bearer token.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Repo-relative path, e.g. 'you.md' or 'stacks/coding/manifest.json'",
        },
      },
      required: ["path"],
    },
    scopes: ["read:private"],
    async handler(ctx, args, auth) {
      if (!auth) return errorResult("authentication required — pass your you.md API key as Bearer token");
      const path = args.path as string;
      if (!path || typeof path !== "string") return errorResult("path is required");
      const { mirror } = await getMirrorStacks(ctx, auth);
      if (!mirror) return errorResult("No repo mirror yet. Link a repo and sync in settings.");
      const file = mirror.files.find((f: { path: string }) => f.path === path);
      if (!file) return errorResult(`File not found in mirror: ${path}`);
      return textResult(file.content, "text/plain");
    },
  },

  // ── search_memories ──────────────────────────────────────────────────────────
  {
    name: "search_memories",
    description:
      "Full-text search the authenticated user's durable memories on you.md. Use this to recall specific facts, preferences, decisions, or context the user has stored — e.g. before answering a question about their past work or stated preferences. Returns one memory per line as plain text, relevance-ordered. Requires a you.md API key with the read:private scope passed as Bearer token in the Authorization header.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Full-text search query to match against memory content",
        },
        limit: {
          type: "number",
          description: "Max number of memories to return (default 20, max 100)",
        },
      },
      required: ["query"],
    },
    scopes: ["read:private"],
    async handler(ctx, args, auth) {
      if (!auth) return errorResult("authentication required — pass your you.md API key as Bearer token");
      const searchQuery = args.query as string;
      if (!searchQuery || typeof searchQuery !== "string" || !searchQuery.trim())
        return errorResult("query is required");
      const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 100);

      const user = await ctx.runQuery(api.users.getByClerkId, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
      });
      if (!user) return errorResult("user not found");

      const found = await ctx.runQuery(api.memories.searchMemories, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        userId: user._id,
        searchText: searchQuery.trim(),
        limit,
      });

      if (!Array.isArray(found) || found.length === 0) {
        return textResult(`no memories matched "${searchQuery.trim()}"`, "text/plain");
      }
      const lines = (found as Array<{ category: string; content: string }>)
        .map((m) => `[${m.category}] ${m.content}`);
      return textResult(lines.join("\n"), "text/plain");
    },
  },

  // ── report_skill_outcome ─────────────────────────────────────────────────────
  {
    name: "report_skill_outcome",
    description:
      "Report the outcome of a skill execution for the authenticated user. Call this after running a you.md skill to feed the self-improvement telemetry loop — your success/failure data powers the `youmd skill improve` surface. Requires a you.md API key with the write:memories scope passed as Bearer token in the Authorization header.",
    inputSchema: {
      type: "object",
      properties: {
        skill: {
          type: "string",
          description: "Skill name (e.g. 'youstack-start', 'claude-md-generator')",
        },
        outcome: {
          type: "string",
          enum: ["success", "failure", "partial"],
          description:
            "Execution outcome: success = worked as intended; failure = did not produce useful output; partial = partially successful",
        },
        note: {
          type: "string",
          description: "Optional free-text note about the outcome (max 500 chars)",
        },
        durationMs: {
          type: "number",
          description: "Optional wall-clock execution time in milliseconds",
        },
      },
      required: ["skill", "outcome"],
    },
    scopes: ["write:memories"],
    async handler(ctx, args, auth) {
      if (!auth) return errorResult("authentication required — pass your you.md API key as Bearer token");
      const skill = args.skill as string;
      if (!skill || typeof skill !== "string" || !skill.trim()) return errorResult("skill is required");
      const outcome = args.outcome as string;
      if (outcome !== "success" && outcome !== "failure" && outcome !== "partial")
        return errorResult("outcome must be one of: success, failure, partial");

      const user = await ctx.runQuery(api.users.getByClerkId, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
      });
      if (!user) return errorResult("user not found");

      const result = await ctx.runMutation(api.skills.recordOutcome, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        skillName: skill.trim(),
        outcome: outcome as "success" | "failure" | "partial",
        agent: typeof args.agent === "string" ? args.agent : undefined,
        note: typeof args.note === "string" ? args.note : undefined,
        durationMs: typeof args.durationMs === "number" ? args.durationMs : undefined,
      });

      return textResult(`outcome recorded: ${result.skillName} → ${result.outcome}`, "text/plain");
    },
  },
];
