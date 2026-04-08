# You.md Improvements Plan

**Created:** 2026-04-08
**Source:** Critical QA review revealed many "passing" tests were actually weak.
**Goal:** Fix every gap, retest with REAL one-line context link flow (not paste blobs), and ship a product that actually delivers the "share one URL, agent knows everything" value prop.

---

## The Critical Realization

The whole point of you.md is **share one URL → agent fetches structured identity**. Not "paste this 4KB markdown blob into every chat." My initial QA generated paste blobs and called it tested. That misses the entire product. This plan fixes that.

---

## Priority Fixes

### Tier 1 — Data Quality + Agent Protocol (BLOCKING for credibility)

- [ ] **1.1 Add Zod validation on bundle save**
  - Location: `convex/me.ts:saveBundleFromForm`, `convex/lib/compile.ts`
  - Reject: `tone` starting with `#`, project names starting with `#`, any field that is just whitespace, schema mismatches
  - Auto-clean: trim whitespace, strip leading `#` headers from text fields
  - Add unit tests for the validator
  - **Pass criteria:** Cannot save a bundle where `preferences.agent.tone === "# Agent Directives"`. Returns 400 with clear error.

- [ ] **1.2 Publish JSON Schema at stable URL**
  - New file: `src/app/schema/you-md/v1.json/route.ts`
  - Returns the full Zod-derived JSON Schema for `you-md/v1`
  - Cache headers: `public, max-age=86400, immutable`
  - **Pass criteria:** `curl https://you.md/schema/you-md/v1.json` returns valid JSON Schema.

- [ ] **1.3 Add Content-Type header `application/vnd.you-md.v1+json`**
  - Location: `convex/http.ts` profile JSON endpoint
  - Set proper MIME type with schema URL
  - Add `Link: </schema/you-md/v1.json>; rel="describedby"` header
  - **Pass criteria:** Response headers include `Content-Type: application/vnd.you-md.v1+json` and Link header

- [ ] **1.4 Add ETag + If-None-Match support**
  - Location: `convex/http.ts` profile endpoints
  - ETag = bundle contentHash (already exists)
  - Return 304 Not Modified when If-None-Match matches
  - **Pass criteria:** Second curl with `If-None-Match: <hash>` returns 304

- [ ] **1.5 Fix Houston's profile data leakage**
  - The bug: `tone: "# Agent Directives"` in stored data
  - Run a one-time data cleanup mutation across all bundles
  - **Pass criteria:** No profile in production has tone or project names starting with `#`

### Tier 2 — MCP Server Improvements (the agent integration)

- [ ] **2.1 Add `whoami` MCP tool**
  - Returns compact identity: name, tagline, role, top 3 projects, tone, stack
  - Default response < 500 tokens
  - **Pass criteria:** Agent can call `whoami` and get a one-line identity summary

- [ ] **2.2 Expose memories as MCP resources**
  - URI: `youmd://memories/all`, `youmd://memories/{category}`
  - Auto-loadable, browsable like files
  - **Pass criteria:** Agent can list resources and see memories without calling a tool

- [ ] **2.3 Auto-load current project context**
  - When MCP server starts in a directory with `.youmd-project` marker, expose project resources automatically
  - URI: `youmd://project/current/prd`, `youmd://project/current/todo`, etc.
  - **Pass criteria:** Agent in a youmd-enabled repo sees project context without asking

- [ ] **2.4 Add `compile_and_push` combo tool**
  - Single call that compiles → pushes → publishes
  - Reduces 3 tool calls to 1
  - **Pass criteria:** Agent can update + publish in one tool call

- [ ] **2.5 Validate memory categories with enum**
  - Restrict to: `fact`, `preference`, `decision`, `project`, `goal`, `insight`, `context`, `relationship`
  - Return validation error for invalid categories
  - **Pass criteria:** `add_memory` with `category: "purple"` returns clear error

- [ ] **2.6 Improve `get_identity` default response**
  - Default: compact summary (~500 tokens)
  - Add `format: "compact" | "full"` parameter
  - **Pass criteria:** Default response < 1000 chars; full response includes everything

### Tier 3 — Context Links (the one-URL value prop)

- [ ] **3.1 Add memorable names to context links**
  - Schema field: `name: v.optional(v.string())`
  - CLI: `youmd link create --name "Coding Claude"`
  - Web: name input on creation
  - **Pass criteria:** Links list shows names, not just tokens

- [ ] **3.2 Per-link analytics**
  - Track use count per link (already exists in schema)
  - CLI: `youmd link list` shows usage counts
  - Web: analytics pane shows per-link breakdown
  - **Pass criteria:** Houston can see which link is most-used

- [ ] **3.3 "Preview as agent" tool**
  - CLI: `youmd link preview <id>` shows what an agent will receive
  - Web: preview button on link cards
  - **Pass criteria:** User can verify what data is shared without setting up a real agent

- [ ] **3.4 Project-scoped context links**
  - Schema field: `projectScope: v.optional(v.string())`
  - When set, link only returns data for that project + base identity
  - CLI: `youmd link create --project youmd`
  - **Pass criteria:** Project-scoped link omits other projects' data

- [ ] **3.5 Expiration warnings**
  - Background check: links expiring in < 24h
  - CLI: `youmd link list` shows warning icon for soon-to-expire
  - **Pass criteria:** Expiring links are visually flagged

### Tier 4 — CLI UX (first-run experience)

- [ ] **4.1 `youmd` (no args) → guided tutorial**
  - First time: 30-second tour of what you.md is + setup steps
  - Returning user: status summary + suggested next action
  - **Pass criteria:** New user can get to first-published profile from `youmd` with no other docs

- [ ] **4.2 Group `youmd --help` by category**
  - Categories: `auth`, `bundle`, `sync`, `skills`, `mcp`, `info`
  - Each category lists 3-7 commands with one-line descriptions
  - **Pass criteria:** `--help` is scannable in one screen

- [ ] **4.3 `youmd mcp --install claude --auto`**
  - Detects `~/.claude/settings.json`
  - Merges youmd config into existing mcpServers
  - Backs up settings.json before write
  - **Pass criteria:** One command installs MCP without copy/paste

- [ ] **4.4 Better `youmd status` for fresh users**
  - When not initialized: show 3 numbered next steps
  - When initialized but not pushed: show "1 command away from going live"
  - **Pass criteria:** Status output is actionable, not just descriptive

- [ ] **4.5 `youmd skill list` improvements**
  - Show install status, popularity (downloads), category, "recommended for new users" tag
  - **Pass criteria:** Users can pick a skill in < 30 seconds

### Tier 5 — Web UX (the public face)

- [ ] **5.1 Move "for agents" section above the fold**
  - Currently buried at the bottom of profile pages
  - Move to top: "agents start here" section with copy buttons for context link
  - **Pass criteria:** First thing visible on profile page is the agent integration

- [ ] **5.2 Add owner edit affordance**
  - When viewing your own profile, hover over sections to see edit icons
  - Click to jump to /shell with that section open
  - **Pass criteria:** Profile owners don't need to navigate through /shell

- [ ] **5.3 /profiles directory: search, filter, sort**
  - Search by name, role, location, tags
  - Filter by verified, has-projects, etc.
  - Sort by recent, most-viewed, most-followed
  - **Pass criteria:** Directory is browsable for discovery, not just a flat list

- [ ] **5.4 Mobile profile pages**
  - Improve text contrast at 375px width
  - Larger tap targets for links
  - Single-column layout that scales properly
  - **Pass criteria:** Profile is fully readable on iPhone SE without zoom

- [ ] **5.5 /docs quick-start at the top**
  - "Get started in 30 seconds" section
  - Copy-paste install command
  - One-screen overview before deep docs
  - **Pass criteria:** New developers find first useful action in < 10 seconds

- [ ] **5.6 Tighten /create boot sequence**
  - Currently ~5 seconds before input appears
  - Reduce to 1-2 seconds
  - **Pass criteria:** First interactive prompt visible in < 1.5s

- [ ] **5.7 Social proof on profiles**
  - Show view count: "2.4K views • 627 agent reads"
  - Show verified badges (we have the schema)
  - Show "last updated 3 days ago"
  - **Pass criteria:** Profiles feel alive, not static

### Tier 6 — Bundle + Vault (data management)

- [ ] **6.1 `youmd diff <v1> <v2>` command**
  - Show what changed between two bundle versions
  - Color-coded diff
  - **Pass criteria:** Users can see history of changes

- [ ] **6.2 Web vault management pane**
  - List encrypted vault items
  - Add/edit/delete with passphrase
  - **Pass criteria:** Vault is usable from web, not just CLI

### Tier 7 — Onboarding (first impression)

- [ ] **7.1 Ship example bundles**
  - Include 3 sample profiles in `cli/examples/`
  - `youmd init --example houston` copies a starter
  - **Pass criteria:** New users see "good" examples before writing their own

- [ ] **7.2 Onboarding agent speed**
  - First response in < 2s
  - Streaming responses for slower operations
  - **Pass criteria:** First agent message appears within 2 seconds of starting `youmd init`

---

## Real Testing Plan (After Fixes)

After completing the fixes, run THIS test sequence (not the paste-blob version I did before):

### Test A: Web → Web Agent (the primary value prop)

1. Web: log in to you.md/shell
2. Web: create a context link with scope `public`, name "Test Link Public"
3. Web: copy the URL (one line: `https://you.md/ctx/houstongolden/<token>`)
4. Open Claude.ai in a new browser tab
5. Paste ONLY the URL — nothing else
6. Send message: "fetch this and tell me what you know about me"
7. **Verify:** Claude fetches the URL, parses identity, responds with name + projects + preferences
8. Screenshot the response

### Test B: Web → CLI Agent (Codex / Pi / fresh terminal)

1. Open a fresh terminal
2. Run `youmd login` (just authenticate, no init)
3. Run `youmd link create --scope public --name "Codex test"`
4. Copy the one-line URL
5. Open Codex CLI in another terminal: `codex`
6. First message: paste the URL with "fetch this for context"
7. **Verify:** Codex fetches, applies preferences, addresses by name

### Test C: Private Project Context Link

1. Run `youmd link create --scope full --project youmd --name "YouMD project context"`
2. Copy URL
3. Open Claude Code in a different project
4. Paste URL with "read this"
5. **Verify:** Claude Code sees full identity + ONLY youmd project context (not other projects)

### Test D: Fresh CLI Install (someone who's never used youmd)

1. Open fresh terminal in a brand new directory
2. Run `npx youmd@latest`
3. **Verify:** Tutorial appears, walks user through setup
4. Complete the setup, push, get a profile URL
5. Time to first published profile: should be < 5 minutes

### Test E: MCP Integration in Fresh Claude Code Session

1. Add youmd MCP to a fresh Claude Code config
2. Start new session in a project directory
3. **Verify:** Claude Code automatically reads identity via `whoami` tool
4. Ask: "what should I work on today?"
5. **Verify:** Claude references project TODO + memories without being told

### What "Pass" Means For Each Test

- **Weak Pass:** Agent receives data but generic response
- **Adequate Pass:** Agent acknowledges name + 1 specific detail
- **Strong Pass:** Agent applies preferences + references multiple specific details + asks follow-up based on context
- **Optimal:** Agent feels like it has been working with you for months from message 1

---

## Tracking

| Tier | Total | Done | In Progress |
|---|---|---|---|
| 1 — Data + Protocol | 5 | 0 | 0 |
| 2 — MCP Server | 6 | 0 | 0 |
| 3 — Context Links | 5 | 0 | 0 |
| 4 — CLI UX | 5 | 0 | 0 |
| 5 — Web UX | 7 | 0 | 0 |
| 6 — Bundle + Vault | 2 | 0 | 0 |
| 7 — Onboarding | 2 | 0 | 0 |
| **Total** | **32** | **0** | **0** |

---

## Final Deliverables

After completing all fixes:

1. **Updated share blocks at `/tmp/youmd-qa-results/share-blocks/`** that contain ONE-LINE URLs with real tested tokens, not paste blobs:
   - `claude-code-mcp-config.json` — single MCP entry
   - `web-agent-link.txt` — one URL
   - `cli-agent-link.txt` — one URL
   - `private-project-link.txt` — one URL with project scope

2. **Test results report at `project-context/TEST_RESULTS_REAL.md`** with:
   - Each test (A-E) with screenshots
   - Pass tier (weak / adequate / strong / optimal)
   - What worked and what still needs improvement

3. **Updated G2M_TESTING_PLAN.md** with verified pass criteria checked off
