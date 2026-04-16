import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireOwner } from "./lib/auth";

// ---------------------------------------------------------------------------
// Bundled skill content — full templates, seeded on deploy
// ---------------------------------------------------------------------------

const BUNDLED_SKILLS = [
  {
    name: "claude-md-generator",
    description: "Generate CLAUDE.md for the current project, pre-loaded with your identity context",
    version: "1.0.0",
    scope: "shared" as const,
    identityFields: ["preferences.agent", "directives.agent", "voice.overall"],
    content: `# claude-md-generator

Generate a CLAUDE.md for the current project, pre-loaded with your identity so every coding agent knows who you are and how you work.

## Identity Context (resolved at install time)

- **Agent preferences:** {{preferences.agent}}
- **Directives:** {{directives.agent}}
- **Voice:** {{voice.overall}}

## What This Skill Does

1. Detect project type (package.json, Cargo.toml, go.mod, pyproject.toml, etc.)
2. Read existing CLAUDE.md or project-context/ if present
3. Generate CLAUDE.md with:
   - Your identity summary (who you are, what you're building)
   - Your agent preferences (how coding agents should behave)
   - Your directives (rules agents must follow)
   - Your voice profile (so agents match your communication style)
   - Detected project stack and structure
4. Write file (merge with existing, don't overwrite)

## Output Template

\`\`\`markdown
# {{project_name}} — Coding Agent Operating Manual

## Who You're Working With

{{profile.about}}

## Working Style

{{preferences.agent}}

## Directives

{{directives.agent}}

## Voice & Communication

{{voice.overall}}

## Project Stack

(auto-detected from project files)

## Project Structure

(auto-detected directory listing)
\`\`\`

## When To Use

- Starting a new project
- Onboarding a new coding agent (Claude Code, Cursor, Codex)
- After significant identity updates via \`youmd chat\` or \`youmd push\`
- When \`youmd skill sync\` detects identity changes affecting this skill`,
  },
  {
    name: "project-context-init",
    description: "Scaffold a project-context/ directory with PRD, TODO, features, changelog, and decision log",
    version: "1.0.0",
    scope: "project" as const,
    identityFields: ["preferences.agent", "profile.about"],
    content: `# project-context-init

Scaffold a complete project-context/ directory in any repo — pre-populated with your identity and agent preferences.

## Identity Context (resolved at install time)

- **Agent preferences:** {{preferences.agent}}
- **About you:** {{profile.about}}

## What This Skill Does

1. Detect project root (walk up to .git, package.json, etc.)
2. Create \`project-context/\` directory with:
   - \`PRD.md\` — Product requirements (empty template with your identity header)
   - \`TODO.md\` — Task tracking
   - \`FEATURES.md\` — Feature inventory with status
   - \`CHANGELOG.md\` — Dated change log
   - \`ARCHITECTURE.md\` — System architecture notes
   - \`CURRENT_STATE.md\` — What's deployed, what's broken
   - \`STYLE_GUIDE.md\` — Design system reference
   - \`feature-requests-active.md\` — Active request tracker
3. Pre-populate headers with your identity
4. Skip files that already exist (never overwrite)

## Directory Structure Created

\`\`\`
project-context/
├── PRD.md
├── TODO.md
├── FEATURES.md
├── CHANGELOG.md
├── ARCHITECTURE.md
├── CURRENT_STATE.md
├── STYLE_GUIDE.md
└── feature-requests-active.md
\`\`\`

## When To Use

- Starting any new project
- As part of \`youmd skill init-project\` (compound command)
- When adopting the project-context pattern in an existing repo`,
  },
  {
    name: "voice-sync",
    description: "Sync your voice profile across all agent tools — consistent tone everywhere",
    version: "1.0.0",
    scope: "shared" as const,
    identityFields: ["voice.overall", "voice.writing", "voice.speaking"],
    content: `# voice-sync

Keep your voice profile in sync across every agent tool you use. When your voice changes in one place, it propagates everywhere.

## Identity Context (resolved at sync time)

- **Overall voice:** {{voice.overall}}
- **Writing voice:** {{voice.writing}}
- **Speaking voice:** {{voice.speaking}}

## What This Skill Does

1. Read your current voice profile from the identity context
2. Generate agent-specific voice instructions for:
   - **Claude Code** (.claude/skills/youmd/voice.md)
   - **Cursor** (.cursor/rules/youmd-voice.md)
   - **Custom agents** (.youmd/skills/voice-context.md)
3. Re-render on every \`youmd skill sync\` or \`youmd push\`
4. Respect scope — shared voice propagates to all projects

## Sync Targets

| Agent | File | Format |
|---|---|---|
| Claude Code | .claude/skills/youmd/voice.md | Markdown with voice rules |
| Cursor | .cursor/rules/youmd-voice.md | Single markdown file |
| Generic | .youmd/skills/voice-context.md | Universal format |

## When To Use

- After updating your voice via \`youmd chat\`
- When \`youmd skill sync\` runs automatically
- When linking a new agent with \`youmd skill link\``,
  },
  {
    name: "meta-improve",
    description: "Self-improvement protocol — agents review their own effectiveness and propose identity updates",
    version: "1.0.0",
    scope: "shared" as const,
    identityFields: ["preferences.agent", "directives.agent"],
    content: `# meta-improve

The feedback loop that makes your identity smarter over time. Agents review what worked and what didn't, then propose updates to your identity context.

## Identity Context (resolved at review time)

- **Agent preferences:** {{preferences.agent}}
- **Directives:** {{directives.agent}}

## What This Skill Does

1. Read skill-metrics.json for usage data (which skills run, success/fail rates)
2. Analyze patterns:
   - Which skills get used most?
   - Which identity fields get referenced most?
   - Are there gaps? (skills that should exist but don't)
   - Are there stale entries? (skills never used)
3. Propose changes:
   - New directives based on repeated corrections
   - Voice refinements based on agent interactions
   - Skill additions based on detected workflow patterns
   - Pruning of unused skills
4. Present proposals for user approval (never auto-apply)

## Metrics Tracked

\`\`\`json
{
  "skills": {
    "claude-md-generator": {
      "uses": 12,
      "lastUsed": "2026-03-25T...",
      "avgDuration": 1200,
      "successRate": 0.92
    }
  },
  "identityFields": {
    "voice.overall": { "references": 45 },
    "preferences.agent": { "references": 38 }
  },
  "proposals": []
}
\`\`\`

## When To Use

- Periodically via \`youmd skill improve\`
- After a significant number of skill uses (auto-suggested)
- When onboarding a new project (review what's working)`,
  },
  {
    name: "proactive-context-fill",
    description: "Detect thin identity context and offer safe additive improvements",
    version: "1.0.0",
    scope: "shared" as const,
    identityFields: ["profile.projects", "profile.about", "preferences.agent", "voice.overall"],
    content: `# proactive-context-fill

Use this skill when starting a new session with a user who has a you.md identity bundle. It detects thin or missing context and proposes safe additive improvements.

## Detection Rules

1. **Projects:** If the identity references projects but the project context is thin, offer to scaffold missing project context.
2. **Voice:** If voice guidance is sparse, offer to derive a better voice profile from existing writing samples and preferences.
3. **Directives:** If agent directives are generic, offer to extract more explicit rules from recent conversations.
4. **Sources:** If profile links exist but source coverage is thin, offer to scrape and add them.
5. **Memories:** If there are very few memories, offer to seed initial memories from the current conversation.

## Guardrails

- Never overwrite user-owned files automatically.
- Present changes as additive proposals.
- Batch suggestions into a short, concrete list instead of asking ten questions at once.
- If project instructions are already robust, prefer adding a managed bootstrap block or \`.you/\` supplements over rewriting top-level docs.

## When To Use

- At the start of a new session when the identity bundle is obviously incomplete
- After major profile or project changes
- When a user wants You.md to improve their agent setup without clobbering what they already maintain`,
  },
  {
    name: "you-logs",
    description: "View recent agent activity and identity access logs inline",
    version: "1.0.0",
    scope: "shared" as const,
    identityFields: [],
    content: `# you-logs

Show recent agent activity for the current user.

## What It Does

Fetches recent agent activity from you.md and renders it as a terminal-friendly table showing:
- Time of activity
- Agent name
- Action performed
- Resource touched
- Bundle version diffs for writes

## How To Use It

Run:

\`\`\`bash
youmd logs --limit 30
\`\`\`

Pass through flags for filtering:

\`\`\`bash
youmd logs --limit 30 --agent "Claude Code"
youmd logs --action push
youmd logs --tail
\`\`\`

## When To Use

- When you want to see which agents touched your identity
- When debugging cross-agent context drift
- When reviewing whether shared instructions and skills are actually being used`,
  },
];

/**
 * Internal mutation — seeds bundled skills with full content.
 * Run via: npx convex run skills:seedBundledSkills
 * Idempotent: updates existing skills if name matches, skips if already current.
 */
export const seedBundledSkills = internalMutation({
  args: {},
  handler: async (ctx) => {
    let updated = 0;
    let created = 0;

    for (const skill of BUNDLED_SKILLS) {
      const existing = await ctx.db
        .query("skills")
        .withIndex("by_name", (q) => q.eq("name", skill.name))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          description: skill.description,
          version: skill.version,
          scope: skill.scope,
          identityFields: skill.identityFields,
          content: skill.content,
          isPublished: true,
          updatedAt: Date.now(),
        });
        updated++;
      } else {
        // Find any user to use as authorId (use first user)
        const anyUser = await ctx.db.query("users").first();
        if (!anyUser) continue;
        await ctx.db.insert("skills", {
          authorId: anyUser._id,
          name: skill.name,
          description: skill.description,
          version: skill.version,
          scope: skill.scope,
          identityFields: skill.identityFields,
          content: skill.content,
          isPublished: true,
          downloads: 0,
          createdAt: Date.now(),
        });
        created++;
      }
    }

    return { updated, created, total: BUNDLED_SKILLS.length };
  },
});

// ── Queries ──────────────────────────────────────────────────

/**
 * Browse published skills in the registry.
 */
export const listPublished = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const skills = await ctx.db
      .query("skills")
      .withIndex("by_isPublished", (q) => q.eq("isPublished", true))
      .collect();

    return skills
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, args.limit ?? 50)
      .map((s) => ({
        _id: s._id,
        name: s.name,
        description: s.description,
        version: s.version,
        scope: s.scope,
        identityFields: s.identityFields,
        downloads: s.downloads,
        authorId: s.authorId,
        createdAt: s.createdAt,
      }));
  },
});

/**
 * Get skills published by a specific user.
 */
export const listByAuthor = query({
  args: {
    authorId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const skills = await ctx.db
      .query("skills")
      .withIndex("by_authorId", (q) => q.eq("authorId", args.authorId))
      .collect();

    return skills.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Get a single skill by name.
 */
export const getByName = query({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("skills")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
  },
});

/**
 * Get user's installed skills.
 * Cycle 44: added auth. Previously leaked installed-skills list per user.
 */
export const listInstalls = query({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const owner = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!owner || owner._id !== args.userId) {
      throw new Error("not authorized: userId does not match authenticated user");
    }

    const installs = await ctx.db
      .query("skillInstalls")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    return installs.sort((a, b) => b.installedAt - a.installedAt);
  },
});

// ── Mutations ────────────────────────────────────────────────

/**
 * Publish a skill to the registry.
 */
export const publish = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    name: v.string(),
    description: v.string(),
    version: v.string(),
    scope: v.union(v.literal("shared"), v.literal("project"), v.literal("private")),
    identityFields: v.array(v.string()),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("User not found");

    // Check if skill name already exists
    const existing = await ctx.db
      .query("skills")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (existing) {
      // Only the author can update
      if (existing.authorId !== user._id) {
        throw new Error("Skill name already taken by another author");
      }
      // Update existing
      await ctx.db.patch(existing._id, {
        description: args.description,
        version: args.version,
        scope: args.scope,
        identityFields: args.identityFields,
        content: args.content,
        updatedAt: Date.now(),
      });
      return { id: existing._id, updated: true };
    }

    // Create new
    const skillId = await ctx.db.insert("skills", {
      authorId: user._id,
      name: args.name,
      description: args.description,
      version: args.version,
      scope: args.scope,
      identityFields: args.identityFields,
      content: args.content,
      isPublished: true,
      downloads: 0,
      createdAt: Date.now(),
    });

    return { id: skillId, updated: false };
  },
});

/**
 * Record a skill installation for a user.
 */
export const recordInstall = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    skillName: v.string(),
    source: v.string(),
    scope: v.string(),
    identityFields: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("User not found");

    // Check if already installed
    const existing = await ctx.db
      .query("skillInstalls")
      .withIndex("by_userId_skillName", (q) =>
        q.eq("userId", user._id).eq("skillName", args.skillName)
      )
      .first();

    if (existing) {
      // Update existing install
      await ctx.db.patch(existing._id, {
        source: args.source,
        scope: args.scope,
        identityFields: args.identityFields,
        installedAt: Date.now(),
      });
      return { id: existing._id, updated: true };
    }

    const installId = await ctx.db.insert("skillInstalls", {
      userId: user._id,
      skillName: args.skillName,
      source: args.source,
      scope: args.scope,
      identityFields: args.identityFields,
      installedAt: Date.now(),
      lastUsedAt: 0,
      useCount: 0,
    });

    // Increment download count on the registry skill if it exists
    const registrySkill = await ctx.db
      .query("skills")
      .withIndex("by_name", (q) => q.eq("name", args.skillName))
      .first();
    if (registrySkill) {
      await ctx.db.patch(registrySkill._id, {
        downloads: registrySkill.downloads + 1,
      });
    }

    return { id: installId, updated: false };
  },
});

/**
 * Track a skill usage event.
 */
export const trackUsage = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    skillName: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("User not found");

    const install = await ctx.db
      .query("skillInstalls")
      .withIndex("by_userId_skillName", (q) =>
        q.eq("userId", user._id).eq("skillName", args.skillName)
      )
      .first();

    if (install) {
      await ctx.db.patch(install._id, {
        useCount: install.useCount + 1,
        lastUsedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

/**
 * Remove a skill installation.
 */
export const removeInstall = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    skillName: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("User not found");

    const install = await ctx.db
      .query("skillInstalls")
      .withIndex("by_userId_skillName", (q) =>
        q.eq("userId", user._id).eq("skillName", args.skillName)
      )
      .first();

    if (install) {
      await ctx.db.delete(install._id);
    }

    return { success: true };
  },
});
