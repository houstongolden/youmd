# You.md Feature Roadmap — 2026-06-11

Prioritized backlog from the 2026-06-11 product audit (see PRODUCT-AUDIT.md for full evidence). Finding numbers (#N) reference that file.

## Milestone 0 — Safety Net (ship this week; all S/M effort)

Stops active data loss, security exposure, and runtime skew before anything else changes.

| Task | Finding | Effort | Acceptance criteria |
|---|---|---|---|
| 0.1 Replace all `Math.random()` token generators with shared `generateSecureToken` | #4 | S | Single helper in `convex/lib/`; `apiKeys.ts:17`, `contextLinks.ts:18`, `private.ts:82`, `profiles.ts:26` all use it; grep for `Math.random` in convex/ touching tokens = 0 |
| 0.2 Dirty-check guard in `youmd sync`/`pull` | #5 | M | Local edits since last pull are never overwritten without `--force`; sync is push-first when local dirty + remote unchanged; test covering edit→sync→edit-survives (sketch below) |
| 0.3 Publish CLI 0.6.23 to npm + version-skew CI check | #9 | S | `npm view youmd version` == `cli/package.json` version; `docs:check` fails on mismatch |
| 0.4 chmod 0600 config.json + 0700 ~/.youmd | #30 | S | Fresh login produces `-rw-------`; startup migration fixes existing perms |
| 0.5 `login --key` validates before persisting; preserve apiUrl/appUrl | #31 | S | Invalid key leaves prior working session intact; dev endpoints survive re-login |
| 0.6 Auto-gitignore `.youmd/` on pull/init inside a git repo | #37 | S | `youmd pull` in a repo without the ignore entry appends it and prints a notice; private/ never stageable by default |
| 0.7 TTY guard on interactive prompts | #43 | S | Piped/CI invocation of `you`, `youmd login` exits 1 immediately with pointer to `login --key` / `mcp` |

## Milestone 1 — Critical Fixes

| Task | Finding | Effort | Acceptance criteria |
|---|---|---|---|
| 1.1 Enforce API-key scopes on every route (sketch below) | #1 | M | A `read:public` key gets 403 with code `scope_missing` on all `/me/*` writes, `/me/private`, memories, rollback, vault, and authed MCP tools; legacy scope-less keys grandfathered full-access with logged activity event; scope map published in docs reference |
| 1.2 Fix draft/publish/rollback semantics (sketch below) | #2 | M | Chosen semantic (save==publish) is documented; rollback patches `profile.youJson/youMd` in the same mutation; public profile reflects rollback immediately; `isPublished` either removed or made truthful |
| 1.3 Fix `youmd mcp --install claude --auto` target (sketch below) | #8 | S | Install writes `~/.claude.json` mcpServers (or shells to `claude mcp add --scope user`); `claude mcp list` shows youmd after install; docs/llms.txt updated |
| 1.4 Headless auth via `YOUMD_API_KEY` / `YOUMD_API_URL` env vars | #32 | S | CI agent authenticates with zero filesystem writes; documented in llms.txt Local Runtime Commands |

## Milestone 2 — High-Leverage (the "same version of you" milestone)

| Task | Finding | Effort | Acceptance criteria |
|---|---|---|---|
| 2.1 Canonical `assembleAgentContext()` used by all four surfaces (sketch below) | #3 | L | Web agent, CLI chat, hosted MCP `get_my_identity`, and full-scope `/ctx` links all return bundle + top-N memories + scoped private context from one assembly function; `get_my_identity` description matches implementation; parity test asserting identical context core across surfaces |
| 2.2 Hosted MCP parity (memory read/write, update_section, agent brief, stack tools) | #7 | L | Hosted endpoint exposes the agent-critical tool set; docs claim split into hosted/local counts until parity, then unified |
| 2.3 Real memory search (sketch below) | #6 | L | `q` param on `GET /api/v1/me/memories` + MCP `search_memories` backed by a Convex search index; "what did I decide about X" retrieves a 6-month-old memory in tests |
| 2.4 Durable-memory lifecycle: exempt preference/relationship/goal/decision from decay; pinned flag; review queue before hard delete | #16 | M | A 91-day-old preference memory survives sessionMaintenance; nothing hard-deletes without appearing in a reviewable archive list |
| 2.5 `youmd stack install <user>/<slug>` + canonical `stacks/<slug>/youstack.json` layout | #10, #11 | L | Install fetches from repo mirror, writes canonical layout, runs smoke, links adapters; CLI discovers stacks in a cloned canonical repo; examples + PRD aligned |
| 2.6 Truthful capability contract | #12 | M | Every capability in `DEFAULT_YOUSTACK_CAPABILITIES` resolves to an implemented surface, tagged `transport: local-mcp \| hosted-mcp \| rest`; CI test curls each REST entry for non-404 |
| 2.7 GitHub repo freshness: debounced auto-push on save/publish + ancestor check on repo pulls | #19 | M | Web/CLI edit appears in linked repo within minutes; stale repo push produces a logged conflict instead of silent overwrite |
| 2.8 Device-code browser login | #29 | L | `youmd login` → browser approve → CLI authenticated with no manual key copy |
| 2.9 Pagination cursors on all list endpoints | #15 | M | profiles/memories/activity/history support `cursor`/`nextCursor`; directory and sitemap correct past 500 profiles; documented in OpenAPI |
| 2.10 Unify memory category taxonomy | #17 | S | One shared `MEMORY_CATEGORIES`; server-side validation; migration mapping legacy rows; cross-surface category filter returns identical sets |

## Milestone 3 — Polish & Protocol Hardening

| Task | Finding | Effort | Acceptance criteria |
|---|---|---|---|
| 3.1 Standard error contract `{error:{code,message}}` + real OpenAPI schemas | #23 | M | One error shape repo-wide; stable codes (unauthorized, scope_missing, rate_limited, not_found, conflict); generator emits request/response schemas |
| 3.2 Rate limits on all writes + Retry-After / X-RateLimit headers | #24 | M | Every authed write is per-key limited; 429s carry headers |
| 3.3 Idempotency-Key support + memory content-hash dedupe | #25 | M | Replayed POST returns original response; duplicate memories not created |
| 3.4 Outbound webhooks + MCP subscribe/listChanged | #26 | L | Agent can register a callback for bundle-published/memory-added; MCP resources signal changes |
| 3.5 Pipeline: compile merges into current bundle; review surface or de-document discover/review | #18 | L | Pipeline publish preserves chat-refined sections/directives/voice; status never sticks at "review" |
| 3.6 Unify capability vocabulary + single router package | #20 | M | CLI route and API route return identical capability for golden test prompts |
| 3.7 One host-link engine emitting `.claude/skills/<name>/SKILL.md` | #13 | M | Linked skills/stacks auto-discovered in Claude Code, Codex, Cursor (verified empirically as release gate) |
| 3.8 Single project-context engine | #14 | M | One storage decision (repo `project-context/` + `~/.youmd/projects/` private overlay); duplicate detect/read impls deleted |
| 3.9 Identity-bearing stack adapters + typed brainScopes + skill-ref doctor check | #21 | M | `stack link` renders approved-scope identity; invalid brainScope/skill ref fails doctor |
| 3.10 Honest counts & docs hygiene: exclude retired/internal from 76; split MCP tool counts; generate README command table; fix `@username` URL; per-host `YOUMD_AGENT_NAME` | #27, #42, #34, #35 | S | curl-able claims all verifiable; `youmd agents` attributes Codex/Cursor correctly |
| 3.11 Installer hardening: npm-channel default pinned, tag-pinned source, GIT_TERMINAL_PROMPT=0, EACCES hints, changelog on auto-upgrade | #36 | M | Reproducible installs; no silent self-replacing curl-bash |
| 3.12 Scheduled reference-intelligence cron + You Agent eval suite in CI | #28 | M | Weekly PR with TASKS.md deltas; golden Q&A evals gate releases |
| 3.13 Username canonicalization migration; delete 500-profile fallback scan | #38 | S | Unknown-username probe does an index miss, not a table scan |
| 3.14 Deprecation/Sunset headers + schemaVersion on payloads | #39 | S | Retired routes machine-detectable; bundle/memory payloads versioned |
| 3.15 Naming/precedence cleanup + `youmd status` active-roots line | #22, #41 | M | Shadowing of home brain by cwd `.youmd/` warned loudly; nearest-marker-wins project detection |
| 3.16 Fix `registry:` skill install hint | #33 | S | `skill browse` hint executes successfully end-to-end |
| 3.17 ARCHITECTURE.md YouStacks section + PRD layout reconciliation | #40 | S | One storage map as source of truth |

---

## Implementation Sketches — Top 5 Tasks

### 1. Enforce API-key scopes (Task 1.1)

Files: `convex/http.ts`, `convex/apiKeys.ts`, `src/generated/docs-reference.ts` (regen).

```ts
// convex/http.ts — extend the auth result
async function authenticateRequest(ctx, request): Promise<AuthContext | Response> {
  // ...existing hash lookup (http.ts:385-429)...
  return {
    userId: apiKey.userId,
    username: apiKey.username,
    plan: apiKey.plan,
    scopes: apiKey.scopes ?? null, // null => legacy key, grandfathered full-access
  };
}

type Scope = "read:public" | "read:private" | "write:bundle" | "write:memories" | "vault";

function requireScope(auth: AuthContext, scope: Scope): Response | null {
  if (auth.scopes === null) return null; // legacy: allow, but log scope_missing activity
  if (!auth.scopes.includes(scope)) {
    return json({ error: { code: "scope_missing", message: `API key lacks required scope: ${scope}` } }, 403);
  }
  return null;
}
```

Per-route wiring (every `/api/v1/me/*` handler, after auth):

```ts
const denied = requireScope(auth, "write:bundle"); // POST /me/bundle (http.ts:434)
if (denied) return denied;
```

Route→scope map: `GET /me/private`, `GET /me/memories` → `read:private`; `POST /me/bundle`, `/me/publish`, `/me/rollback` → `write:bundle`; `POST /me/memories` → `write:memories`; vault routes (`http.ts:2572-2686`) → `vault`; hosted MCP `get_my_identity`/`get_my_stacks`/`get_repo_file` → `read:private`. Log `scope_missing` activity events for legacy keys so usage can be measured before tightening.

### 2. `youmd sync` dirty-check + safe ordering (Task 0.2)

Files: `cli/src/commands/sync.ts`, `cli/src/commands/pull.ts`, `cli/src/lib/decompile.ts`.

```ts
// cli/src/commands/pull.ts — before decompileToFilesystem (pull.ts:72)
import { compileBundle } from "../lib/compile";
import { hashContent } from "../lib/hash";

async function isLocalDirty(bundleDir: string): Promise<boolean> {
  const local = await compileBundle(bundleDir);          // existing compiler
  const localHash = hashContent(JSON.stringify(local.youJson));
  const { lastPulledHash } = readSyncState(bundleDir);   // already persisted at pull.ts:139-141
  return Boolean(lastPulledHash) && localHash !== lastPulledHash;
}

export async function pullCommand(opts: { force?: boolean } = {}) {
  if (!opts.force && (await isLocalDirty(bundleDir))) {
    console.log(chalk.yellow("  local changes detected since last pull."));
    console.log(DIM("  run `youmd push` first, or `youmd pull --force` to overwrite."));
    process.exitCode = 1;
    return;
  }
  // ...existing decompileToFilesystem path...
}
```

```ts
// cli/src/commands/sync.ts:84-93 — order by state
const dirty = await isLocalDirty(bundleDir);
const remoteChanged = remoteHash !== lastPulledHash; // from GET bundle ETag/contentHash
if (dirty && !remoteChanged) { await pushCommand({ publish: true }); await pullCommand(); }
else if (!dirty)             { await pullCommand(); await pushCommand({ publish: true }); }
else { /* both changed */ console.log("  conflict: local and remote both changed — push will surface a 409; resolve, then sync."); }
```

Follow-up: real 3-way merge using the already-saved `base.json`.

### 3. Fix `mcp --install claude --auto` target (Task 1.3)

File: `cli/src/commands/mcp.ts:82-122`.

```ts
function installClaudeAuto(): boolean {
  // Preferred: delegate to the claude CLI (handles schema + scope correctly)
  const claudeBin = whichSync("claude");
  if (claudeBin) {
    const r = spawnSync(claudeBin, ["mcp", "add", "--scope", "user", "youmd",
      "--", "npx", "--yes", "youmd@latest", "mcp"], { stdio: "pipe" });
    if (r.status === 0) return verifyClaudeInstall(); // parse `claude mcp list` for "youmd"
  }
  // Fallback: write ~/.claude.json (the file Claude Code actually reads), NOT settings.json
  const configPath = path.join(os.homedir(), ".claude.json");
  const cfg = readJsonSafe(configPath) ?? {};
  cfg.mcpServers = mergeMcpServers(cfg.mcpServers);
  backupAndWrite(configPath, JSON.stringify(cfg, null, 2) + "\n");
  return verifyClaudeInstall();
}
```

Also update `public/llms.txt:45`, `src/app/(app)/docs/docs-content.tsx:2308, 2461`, `src/app/install.sh/route.ts:143`, and add `env: { YOUMD_AGENT_NAME: "Claude Code" }` per host (fixes #35 simultaneously: Codex TOML gets `YOUMD_AGENT_NAME = "Codex"`, Cursor gets `"Cursor"`).

### 4. Canonical agent context assembly (Task 2.1)

New file: `convex/lib/agentContext.ts`; consumers: `src/hooks/useYouAgent.ts:186-261`, `cli/src/commands/chat.ts:2255-2266`, `convex/http.ts:2958-2974` (hosted MCP), `convex/contextLinks.ts:234-250`.

```ts
// convex/lib/agentContext.ts
export type ContextScope = "public" | "standard" | "full";

export interface AgentContext {
  bundle: { youJson: unknown; youMd: string; contentHash: string };
  memories: Array<{ category: string; content: string; createdAt: number }>; // top-N, relevance-or-recency ranked
  privateContext: { notes?: string; links?: unknown[] } | null;              // full scope only
  assembledAt: number;
  scope: ContextScope;
}

export async function assembleAgentContext(
  ctx: QueryCtx, userId: Id<"users">, opts: { scope: ContextScope; memoryLimit?: number; query?: string }
): Promise<AgentContext> { /* bundle + listMemories(top-N) + private per scope */ }
```

Wiring: hosted MCP `get_my_identity` returns the full assembly (and its description is corrected to match); a memories digest is appended to full-scope `/ctx` link responses; CLI chat injects `memories` into the opening conversation context (today built bundle-only at `chat.ts:2255-2266`); web agent swaps its ad-hoc 30-recent injection for the same shape. Add a parity test: same seeded user, four surfaces, assert identical bundle hash + memory IDs.

### 5. Real memory search (Task 2.3)

Files: `convex/schema.ts:471-486`, `convex/memories.ts`, `convex/http.ts:2035-2058`, `cli/src/mcp/server.ts:1536-1551, 1961-1972`.

```ts
// convex/schema.ts — memories table
memories: defineTable({ /* existing fields */ })
  .index("by_user", ["userId"]) // existing
  .searchIndex("search_content", { searchField: "content", filterFields: ["userId", "category", "archived"] }),
```

```ts
// convex/memories.ts
export const searchMemories = query({
  args: { q: v.string(), category: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, { q, category, limit = 20 }) => {
    const userId = await requireOwner(ctx);
    return await ctx.db.query("memories")
      .withSearchIndex("search_content", (s) => {
        let f = s.search("content", q).eq("userId", userId).eq("archived", false);
        return category ? f.eq("category", category) : f;
      })
      .take(Math.min(limit, 100));
  },
});
```

HTTP: `GET /api/v1/me/memories?q=...` branches to `searchMemories` when `q` present (else existing `listMemories`). MCP: add `query` to the `search_memories` inputSchema and thread it through `fetchMemoriesEnvelope`. Acceptance test: seed a 6-month-old `decision` memory, assert it is retrievable by keyword via HTTP, MCP, and web `/recall` (which should call the server instead of filtering the loaded 30 client-side at `useYouAgent.ts:1772-1781`). Phase 2: embeddings + relevance-ranked injection into `assembleAgentContext`.
