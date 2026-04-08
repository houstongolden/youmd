# Cross-Agent Activity Tracking — The Universal Visibility Layer

**Created:** 2026-04-08
**Status:** PLANNING → BUILDING
**Linked from:** [IMPROVEMENTS_PLAN.md](./IMPROVEMENTS_PLAN.md)

---

## The Vision

You.md is the identity context protocol for the agent internet. Today, when an agent fetches your identity, it's invisible. You don't know:
- Which agents have connected
- What they read
- When they last synced
- If they tried to write/update anything
- What they did with your data

**The vision:** Every agent interaction with your identity is logged, versioned (like git), and visible in real-time across THREE surfaces:

1. **Web shell** — `/shell` has a new "Agents" tab showing live activity feed
2. **CLI** — `youmd logs` shows the same feed in your terminal
3. **In-IDE slash command** — `/you-logs` in Claude Code or Cursor shows the feed without leaving your editor

This is the ultimate verification that you.md works. You can SEE the value happening in real-time.

---

## Why This Matters

**For Houston (the user):** Every time he opens a new agent (Claude Code, Cursor, ChatGPT), he can verify within seconds that the agent successfully connected to his identity context. No more wondering "did it work?"

**For trust:** When you give an agent access to your private context (full-scope link), you need to know what it does with that data. Activity logs make agent trust auditable.

**For the product:** This is the missing demo. When someone asks "what does you.md actually do?" — show them the live feed of agents reading their context. That's the magic moment.

**For the agent internet:** This is the protocol layer for accountability. Today agents are black boxes. With activity logs, every action is observable.

---

## What We Have Today

### Schema (already in place)

```typescript
// convex/schema.ts
agentInteractions: defineTable({
  profileId: v.id("profiles"),
  agentName: v.string(),  // "Claude Code", "Cursor", "ChatGPT", etc.
  agentType: v.string(),  // "read" | "write" | "chat"
  interactionCount: v.number(),
  lastInteractionAt: v.number(),
}).index("by_profileId", ["profileId"])
  .index("by_agentName", ["agentName"]),

profileViews: defineTable({
  userId: v.optional(v.id("users")),
  profileId: v.optional(v.id("profiles")),
  viewedAt: v.number(),
  referrer: v.optional(v.string()),
  isAgentRead: v.boolean(),
  isContextLink: v.optional(v.boolean()),
}).index("by_userId", ["userId"])
  .index("by_userId_date", ["userId", "viewedAt"])
  .index("by_profileId", ["profileId"])
  .index("by_profileId_date", ["profileId", "viewedAt"]),

securityLogs: defineTable({
  eventType: v.string(),  // "profile_updated", "verification_created", etc.
  profileId: v.optional(v.id("profiles")),
  userId: v.optional(v.id("users")),
  details: v.optional(v.any()),
  createdAt: v.number(),
}).index("by_profileId", ["profileId"])
  .index("by_eventType", ["eventType"]),
```

### Existing functions

- `profiles.recordView` — logs profile views (with `isAgentRead` flag)
- `me.trackAgentInteraction` — logs agent reads/writes
- `private.getAgentStats` — aggregates agent stats per profile

### What's missing

- **No unified activity log** — data is in 3 different tables, not joinable as a single feed
- **No real-time UI** — nothing in /shell shows this
- **No CLI command** — nothing in `youmd` shows it
- **No MCP tool** — agents can't see their own history
- **No auto-tracking** — most API/MCP/link calls don't log anything
- **No agent identification** — User-Agent isn't parsed to name the agent
- **No write tracking** — bundle pushes don't appear in activity
- **No real-time updates** — even if data existed, the UI wouldn't auto-refresh

---

## What Needs to Be Built

### 1. Unified Activity Log Schema

A new table that captures EVERY agent action in one queryable feed:

```typescript
agentActivity: defineTable({
  userId: v.id("users"),                    // whose identity was accessed
  profileId: v.optional(v.id("profiles")),

  // Who/what
  agentName: v.string(),                    // "Claude Code", "Cursor", "ChatGPT", etc.
  agentSource: v.string(),                  // "mcp" | "context-link" | "api-key" | "web-fetch" | "cli"
  agentVersion: v.optional(v.string()),     // e.g. "Claude Code 0.5.0"

  // What action
  action: v.string(),                       // "read" | "read_section" | "write" | "memory_add" |
                                            //  "skill_use" | "compile" | "push" | "publish" |
                                            //  "vault_read" | "vault_write" | "scope_change"
  resource: v.optional(v.string()),         // e.g. "identity", "memories/preference",
                                            //  "project/youmd/prd", "skill/voice-sync"

  // Scope + auth
  scope: v.optional(v.string()),            // "public" | "full" | "project"
  tokenId: v.optional(v.id("contextLinks")),// which context link if any
  apiKeyId: v.optional(v.id("apiKeys")),    // which api key if any

  // Result
  status: v.string(),                       // "success" | "denied" | "error"
  details: v.optional(v.any()),             // arbitrary metadata (changeNote, file count, etc.)

  // For diffs
  bundleVersionBefore: v.optional(v.number()),
  bundleVersionAfter: v.optional(v.number()),
  contentHashBefore: v.optional(v.string()),
  contentHashAfter: v.optional(v.string()),

  // Timing
  durationMs: v.optional(v.number()),       // how long the action took
  createdAt: v.number(),
})
  .index("by_userId", ["userId"])
  .index("by_userId_date", ["userId", "createdAt"])
  .index("by_userId_agent", ["userId", "agentName"])
  .index("by_action", ["action"]),
```

### 2. Agent Detection from User-Agent

```typescript
// convex/lib/agentDetect.ts
export function detectAgent(userAgent: string): { name: string; source: string } {
  const ua = userAgent.toLowerCase();
  if (ua.includes("claude-code")) return { name: "Claude Code", source: "mcp" };
  if (ua.includes("claudebot") || ua.includes("anthropic")) return { name: "Claude.ai", source: "context-link" };
  if (ua.includes("cursor")) return { name: "Cursor", source: "mcp" };
  if (ua.includes("chatgpt") || ua.includes("openai")) return { name: "ChatGPT", source: "context-link" };
  if (ua.includes("gemini") || ua.includes("google")) return { name: "Gemini", source: "context-link" };
  if (ua.includes("perplexity")) return { name: "Perplexity", source: "context-link" };
  if (ua.includes("grok") || ua.includes("xai")) return { name: "Grok", source: "context-link" };
  if (ua.includes("codex")) return { name: "Codex", source: "cli" };
  if (ua.includes("youmd-mcp")) return { name: "you.md MCP", source: "mcp" };
  if (ua.includes("youmd")) return { name: "youmd CLI", source: "cli" };
  if (ua.includes("python") || ua.includes("node-fetch") || ua.includes("axios")) {
    return { name: "Custom Agent", source: "api-key" };
  }
  return { name: "Unknown", source: "web-fetch" };
}
```

### 3. Activity Logging Mutation

```typescript
// convex/activity.ts (NEW FILE)
export const logActivity = internalMutation({
  args: {
    userId: v.id("users"),
    profileId: v.optional(v.id("profiles")),
    agentName: v.string(),
    agentSource: v.string(),
    agentVersion: v.optional(v.string()),
    action: v.string(),
    resource: v.optional(v.string()),
    scope: v.optional(v.string()),
    tokenId: v.optional(v.id("contextLinks")),
    apiKeyId: v.optional(v.id("apiKeys")),
    status: v.string(),
    details: v.optional(v.any()),
    bundleVersionBefore: v.optional(v.number()),
    bundleVersionAfter: v.optional(v.number()),
    contentHashBefore: v.optional(v.string()),
    contentHashAfter: v.optional(v.string()),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("agentActivity", { ...args, createdAt: Date.now() });
  },
});

// Public query for the activity feed
export const listActivity = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
    agentName: v.optional(v.string()),
    action: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("agentActivity")
      .withIndex("by_userId_date", (q) => q.eq("userId", args.userId))
      .order("desc");

    const items = await q.take(args.limit ?? 100);

    // Filter in memory
    return items.filter(item => {
      if (args.agentName && item.agentName !== args.agentName) return false;
      if (args.action && item.action !== args.action) return false;
      return true;
    });
  },
});

// Aggregate stats
export const agentSummary = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("agentActivity")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const byAgent = new Map<string, {
      agentName: string;
      reads: number;
      writes: number;
      lastSeen: number;
      firstSeen: number;
    }>();

    for (const a of all) {
      const existing = byAgent.get(a.agentName) || {
        agentName: a.agentName,
        reads: 0,
        writes: 0,
        lastSeen: 0,
        firstSeen: a.createdAt,
      };
      if (a.action.includes("read") || a.action === "skill_use") existing.reads++;
      if (a.action.includes("write") || a.action === "push") existing.writes++;
      existing.lastSeen = Math.max(existing.lastSeen, a.createdAt);
      existing.firstSeen = Math.min(existing.firstSeen, a.createdAt);
      byAgent.set(a.agentName, existing);
    }

    return Array.from(byAgent.values()).sort((a, b) => b.lastSeen - a.lastSeen);
  },
});
```

### 4. Wire Up Existing Endpoints

Every endpoint that touches identity needs to call `logActivity`:

| Endpoint | Action | Source |
|---|---|---|
| `GET /api/v1/profiles?username=X` | `read` | `web-fetch` (parse User-Agent) |
| `GET /ctx/<user>/<token>` | `read` | `context-link` |
| `POST /api/v1/me/bundle` | `write` | depends on auth method |
| `POST /api/v1/me/publish` | `publish` | depends |
| `POST /api/v1/me/portrait` | `write` (portrait) | depends |
| `POST /api/v1/me/memories` | `memory_add` | depends |
| `POST /api/v1/me/private` | `write` (private) | depends |
| MCP `get_identity` | `read` | `mcp` |
| MCP `update_section` | `write` | `mcp` |
| MCP `add_memory` | `memory_add` | `mcp` |
| MCP `compile_and_push` | `push` | `mcp` |
| MCP `whoami` | `read` (compact) | `mcp` |
| MCP `use_skill` | `skill_use` | `mcp` |

### 5. Web UI: AgentsPane in /shell

New tab: `agents` (alongside profile, files, share, skills, history, etc.)

**Layout:**
```
┌─────────────────────────────────────────────┐
│ ── connected agents ──                       │
│                                              │
│ ● Claude Code           reading       2m ago │
│   12 reads, 3 writes — first seen 2 days ago │
│                                              │
│ ● Cursor                idle          1h ago │
│   45 reads — first seen 5 days ago           │
│                                              │
│ ○ ChatGPT               idle          3d ago │
│   2 reads — first seen 3 days ago            │
│                                              │
│ ── recent activity ──                        │
│                                              │
│ 14:32  Claude Code     read   identity        │
│ 14:32  Claude Code     read   memories/all    │
│ 14:31  Claude Code     read   project/current │
│ 14:30  Cursor          push   bundle v49→v50  │
│ 14:28  Claude.ai       read   ctx/<token>     │
│ 14:25  Claude Code     read   identity        │
│                                              │
│ ── filter ──                                 │
│ [all] [reads] [writes] [pushes]              │
└─────────────────────────────────────────────┘
```

Real-time updates via Convex `useQuery` (auto-subscribes to changes).

### 6. CLI: `youmd logs` and `youmd agents`

```bash
$ youmd logs
─── recent activity ───

14:32  Claude Code     read   identity
14:32  Claude Code     read   memories/all
14:31  Claude Code     read   project/current
14:30  Cursor          push   bundle v49→v50
14:28  Claude.ai       read   ctx/<token>
14:25  Claude Code     read   identity

(showing 6 of 47 — use --limit 100 for more)

$ youmd logs --agent "Claude Code"
$ youmd logs --action push
$ youmd logs --tail            # follow mode (polls every 2s)

$ youmd agents
─── connected agents ───

● Claude Code       active     last seen 2m ago
  12 reads, 3 writes — first seen 2 days ago

● Cursor            idle       last seen 1h ago
  45 reads — first seen 5 days ago

○ ChatGPT           idle       last seen 3d ago
  2 reads — first seen 3 days ago
```

### 7. MCP Tool: `get_activity_log`

```typescript
// New MCP tool
{
  name: "get_activity_log",
  description: "Get the user's recent agent activity log. Use this to see which agents have connected and what they did. Returns a list of activity events.",
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Max events to return (default 30)" },
      agentName: { type: "string", description: "Filter by agent name" },
      action: { type: "string", description: "Filter by action type" },
    },
  },
}
```

### 8. Slash Command Skill: `/you-logs`

A new skill in `cli/skills/you-logs.md` that any CLI agent (Claude Code, Cursor, etc.) can install. The skill:
1. Calls `youmd logs` (or the MCP `get_activity_log` tool if available)
2. Formats the output as terminal-friendly text
3. Returns it inline so the user sees the log without leaving their editor

When installed via `youmd skill install you-logs`, the rendered skill gets linked to `.claude/skills/youmd/you-logs.md` and Claude Code can invoke it as `/you-logs`.

### 9. Real-time Architecture

Convex queries auto-subscribe — when `agentActivity` table changes, all `useQuery(api.activity.listActivity)` consumers automatically re-render. No polling needed.

For the CLI `--tail` mode, poll every 2 seconds (Convex CLI doesn't support subscriptions natively, but a 2s poll feels real-time).

### 10. Privacy & Permissions

- Activity log is OWNER-ONLY (only Houston sees his own activity)
- Authenticated via clerkId or API key
- Can be cleared/exported by the owner
- Stored for 90 days, then auto-archived (similar to memories)

---

## Architecture Diagram

```
                ┌───────────────────────────────┐
                │  AGENT (Claude Code, Cursor,  │
                │   ChatGPT, Codex, etc.)       │
                └────────────┬──────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
       ┌───────────┐  ┌────────────┐  ┌───────────┐
       │  /ctx     │  │  /api/v1   │  │  MCP      │
       │  link     │  │  /me/*     │  │  tools    │
       └─────┬─────┘  └──────┬─────┘  └─────┬─────┘
             │               │               │
             └───────────────┼───────────────┘
                             │
                             ▼
                ┌────────────────────────────┐
                │  detectAgent(User-Agent)   │
                │  + log activity to Convex  │
                └────────────┬───────────────┘
                             │
                             ▼
                ┌────────────────────────────┐
                │   agentActivity table      │
                │   (Convex, real-time)      │
                └────────────┬───────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
       ┌───────────┐  ┌────────────┐  ┌───────────┐
       │  /shell   │  │  CLI       │  │  /you-logs│
       │  Agents   │  │  youmd     │  │  skill    │
       │  pane     │  │  logs      │  │           │
       └───────────┘  └────────────┘  └───────────┘
```

---

## Build Order (this session)

1. **Schema + activity.ts** — new table, mutations, queries
2. **Wire up existing endpoints** — every read/write logs activity
3. **MCP server** — every tool call logs + new `get_activity_log` tool
4. **CLI commands** — `youmd logs`, `youmd agents`
5. **Web UI** — AgentsPane in /shell with real-time feed
6. **Slash command skill** — `/you-logs` for any CLI agent
7. **Test end-to-end** — trigger activity from each source, verify all 3 surfaces show it

---

## Testing Plan

### Test 1: Basic Activity Logging
1. Fetch `/api/v1/profiles?username=houstongolden` with User-Agent `claude-code`
2. Run `youmd logs` — should show "Claude Code read identity"
3. Open /shell agents tab — should show same event
4. Call `/you-logs` skill — should show same event

### Test 2: Cross-Source Activity
1. Fetch via context link with User-Agent `chatgpt-user`
2. Run MCP `get_identity` from Claude Code session
3. Push a bundle update via CLI
4. **Verify all 3 sources** show in the activity log:
   - Web shell agents pane shows ChatGPT, Claude Code, and "youmd CLI"
   - `youmd logs` shows the same 3 events
   - `/you-logs` skill shows the same 3 events

### Test 3: Real-time Updates
1. Open /shell agents pane in browser
2. From a different terminal, fetch the profile via curl with a known User-Agent
3. **Verify** the activity appears in the web pane within 1 second (Convex real-time)

### Test 4: Filter and Search
1. Generate activity from 3 different agents
2. Run `youmd logs --agent "Claude Code"` — should only show Claude Code events
3. Run `youmd logs --action push` — should only show pushes

### Test 5: Diff Tracking
1. Push bundle v49 → v50
2. Verify the activity log entry includes `bundleVersionBefore: 49, bundleVersionAfter: 50`
3. Verify the contentHash before/after is captured

### Test 6: Real Agent (Claude Code MCP)
1. Install MCP: `youmd mcp --install claude --auto`
2. Restart Claude Code
3. Open new chat — Claude Code should call `whoami` automatically
4. Verify activity log shows the call within 2 seconds
5. Ask Claude Code to read project context
6. Verify the read shows up

### Test 7: Real Web Agent (Claude.ai)
1. Paste a one-line context link into Claude.ai
2. Ask it to fetch
3. Verify activity log shows "Claude.ai read identity (context-link)"

---

## Success Criteria

**Hard requirements:**
- [ ] Every API/MCP/link call logs to `agentActivity`
- [ ] Web /shell has Agents pane showing real-time feed
- [ ] CLI `youmd logs` shows same data as web
- [ ] `/you-logs` slash command works in Claude Code
- [ ] Filters work: by agent, by action, by date
- [ ] Activity feed shows: timestamp, agent name, action, resource
- [ ] Bundle pushes show version diffs
- [ ] No PII leaks — only the owner sees their own logs

**Soft requirements:**
- [ ] Real-time updates within 1 second
- [ ] Activity log retention: 90 days active, 1 year archived
- [ ] Export to JSON
- [ ] Visual indicators for "active right now" agents (last seen < 5 min)

---

## What Houston Should See When This Is Done

### Scenario A: First-time agent connection
1. Houston installs Claude Code MCP for the first time
2. Opens new Claude Code session
3. Within 2 seconds, his /shell Agents pane shows "● Claude Code — connected just now — 1 read"
4. In his terminal, `youmd logs --tail` shows the same event
5. He can confirm Claude Code is actually using his identity context

### Scenario B: Cross-agent verification
1. Houston starts a new Cursor session in a different project
2. Cursor reads identity via MCP
3. Houston's /shell shows BOTH agents now: Claude Code (idle) + Cursor (active)
4. He can see which agent is currently active

### Scenario C: Audit a private context share
1. Houston gives a full-scope link to a trusted agent
2. The agent reads it
3. Houston sees in the log: "Trusted Agent read full-scope context link 'My Project Context' (5 fields including private notes)"
4. He has an audit trail of every private context access

### Scenario D: Diff tracking for writes
1. An agent updates Houston's bio via MCP
2. Bundle goes from v52 to v53
3. Houston sees in the log: "Claude Code wrote profile/about (v52 → v53, hash a1b2c3 → d4e5f6)"
4. He can roll back if needed

---

## Files to Create/Modify

### New files
- `convex/activity.ts` — schema, mutations, queries
- `convex/lib/agentDetect.ts` — User-Agent parsing
- `cli/src/commands/logs.ts` — `youmd logs` command
- `cli/src/commands/agents.ts` — `youmd agents` command
- `cli/skills/you-logs.md` — slash command skill
- `src/components/panes/AgentsPane.tsx` — web pane
- `project-context/CROSS_AGENT_ACTIVITY_PLAN.md` — this file

### Modified files
- `convex/schema.ts` — add `agentActivity` table
- `convex/http.ts` — wire up logging on every relevant endpoint
- `convex/me.ts` — log on bundle saves/publishes
- `convex/profiles.ts` — log on portrait/links/etc updates
- `convex/contextLinks.ts` — log on resolve
- `cli/src/mcp/server.ts` — log on every tool call + add `get_activity_log` tool
- `cli/src/index.ts` — register new commands
- `src/app/shell/page.tsx` (or dashboard-content.tsx) — add agents tab
- `src/hooks/agent-utils.ts` — add "agents" to RightPane type
- `IMPROVEMENTS_PLAN.md` — link to this doc

---

## Connection to Existing IMPROVEMENTS_PLAN.md

This work adds a new tier:

**Tier 8 — Cross-Agent Activity Visibility (8 tasks)**
- 8.1 New schema + activity logging mutations
- 8.2 Wire up existing endpoints to log activity
- 8.3 MCP server activity logging + `get_activity_log` tool
- 8.4 CLI `youmd logs` + `youmd agents` commands
- 8.5 Web AgentsPane with real-time feed
- 8.6 `/you-logs` slash command skill
- 8.7 User-Agent detection library
- 8.8 End-to-end test across all 3 surfaces

After this is built, the existing test plan in [G2M_TESTING_PLAN.md](./G2M_TESTING_PLAN.md) becomes infinitely easier — Houston can SEE every test working in real-time.
