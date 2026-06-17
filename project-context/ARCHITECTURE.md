# You.md — Architecture Reference

Last Updated: 2026-06-17

## System Overview

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           you.md ARCHITECTURE                              │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  CLIENTS                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Web App      │  │  CLI (youmd)  │  │  External     │  │  AI Agents   │  │
│  │  Next.js 16   │  │  npm package  │  │  API clients  │  │  via /ctx    │  │
│  │  Vercel       │  │  TypeScript   │  │  Bearer auth  │  │  plain text  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                  │                  │                  │          │
│  ───────┴──────────────────┴──────────────────┴──────────────────┴───────  │
│                                                                            │
│  AUTH LAYER                                                                │
│  ┌──────────────────────────────┐  ┌──────────────────────────────────┐   │
│  │  First-party web sessions     │  │  Email Code + API Keys (CLI)     │   │
│  │  youmd_session cookie         │  │  Passwordless or direct ym_* key  │   │
│  │  Convex custom JWT/JWKS       │  │  SHA-256 hashed Bearer tokens     │   │
│  └──────────────────────────────┘  └──────────────────────────────────┘   │
│                                                                            │
│  ───────────────────────────────────────────────────────────────────────  │
│                                                                            │
│  BACKEND: Convex (TypeScript-native, reactive, serverless)                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │  HTTP API    │  │  Queries    │  │  Mutations   │  │  Actions        │ │
│  │  30+ routes  │  │  Real-time  │  │  Transact.   │  │  External APIs  │ │
│  │  convex/http │  │  subscript. │  │              │  │  OpenRouter LLM │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘ │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  Pipeline (convex/pipeline/)                                         │  │
│  │  discover → fetch → extract → analyze → compile → review            │  │
│  │  Apify (LinkedIn), native fetch (web), OpenRouter (LLM extraction)  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  DATA LAYER: 21 Convex tables                                             │
│  users, profiles, bundles, sources, analysisArtifacts, apiKeys,           │
│  privateVault, pipelineJobs, profileViews, contextLinks, memories,        │
│  chatSessions, chatMessages, privateContext, accessTokens,                │
│  securityLogs, profileReports, profileVerifications, agentInteractions,   │
│  skills, skillInstalls                                                     │
│                                                                            │
│  ───────────────────────────────────────────────────────────────────────  │
│                                                                            │
│  EXTERNAL SERVICES                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │  OpenRouter  │  │  Apify      │  │  Auth       │  │  Vercel         │ │
│  │  Claude 4.6  │  │  LinkedIn   │  │  Email code │  │  Hosting + Edge │ │
│  │  Perplexity  │  │  Scraper    │  │  JWT/JWKS   │  │  ISR + SSR      │ │
│  │  Grok-3      │  │             │  │  API keys   │  │                 │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Product Boundary: Personal API/MCP

You.md is the canonical personal API/MCP and context protocol layer. It is the structured, extensible context API for a person: identity, now, projects, capture events, sources, memories, preferences, trust rules, stacks, activity, provenance, and public/private access rules.

h.computer is Houston's personal site and reference implementation that should consume this layer, not own it. Creator.new, BAMF.ai, folder.md, MCP clients, local agents, and future products can connect to You.md for identity, voice, preferences, source provenance, project context, memories, trust rules, and selected YouStacks.

The intended boundary is:

```text
External product or agent
  -> scoped grant / context link / owner API key
  -> You.md protected API/MCP
  -> identity, now, projects, sources, memories, preferences, trust rules, stacks, activity
  -> explicit provenance-rich writeback when allowed
```

### Canonical Resource Families

| Resource | Purpose | Current surface | Gap |
|---|---|---|---|
| `identity` | Public profile, links, bio, voice, public bundle | `/api/v1/profiles`, `/ctx`, MCP `get_identity` | Needs tighter versioned resource contract |
| `now` | Current status, focus, active work | Profile `now`, bundle fields | Needs first-class API/MCP route |
| `projects` | User/project context, repo status, next actions | CLI project context, MCP project resources, repo mirror, `trackedProjects` | Needs hosted resource contract and grants |
| `portfolio_graph` | Cross-project APIs/MCPs, dependency edges, protected harnesses, reusable patterns, machine readiness, and DRY ownership | Planned in `PROJECT_PORTFOLIO_GRAPH_AND_REUSE_PRD_2026-06-17.md` | Needs data contract, auditor, dashboard view, and MCP/API slice |
| `captures` | Mobile/host brain dumps, raw transcripts, inbound messages, routed ideas | Planned in `MOBILE_CAPTURE_AND_PROJECT_ROUTING_2026-06-16.md` | Needs inbox/event/session data model, provider adapters, dedupe/segment/classify pipeline, and review UI |
| `sources` | Source catalog, provenance, freshness, trust | `sources`, pipeline, immutable raw-source work | Needs user-facing connector grid and refresh policy |
| `memories` | Private/scoped durable facts | `memories`, MCP `search_memories` | Needs richer writeback approvals and source confidence UX |
| `preferences` | Communication, writing, model, workflow preferences | Bundle preferences/directives | Needs API/MCP-normalized resource contract |
| `trust_rules` | What agents may read, write, infer, share, mutate | Context links, API keys, visibility flags | Needs explicit object model |
| `stacks` | YouStack manifests, capabilities, host adapters | CLI stack tools, repo mirror, stack endpoints | Needs grant-specific install/share flow |
| `activity` | Agent runs, source refreshes, writes, security events | security logs, agent interactions, project log | Needs unified product/agent activity feed |

### Access Modes

- Public read: safe public identity, public-open stacks, and public source summaries.
- Scoped context link: selected brain scopes, projects, stacks, expiry, revocation, and preview.
- Owner API key: private reads and approved writes for the owner.
- Host/stack agent token: host-specific and stack-specific access with explicit scopes.
- Connected-app grant: durable app-level access for h.computer, Creator.new, BAMF.ai, folder.md, and future consumers.

### Consumer Roles

| Consumer | Role | Boundary |
|---|---|---|
| h.computer | Houston's personal site/agent/reference implementation | Reads You.md context, may write back useful memories/activity, does not own the protocol |
| Creator.new | BAMF-powered creator builder | Optionally attaches creator identity/context from You.md; creator workflows stay in BAMF.ai |
| folder.md | Agent-readable storage/file convention layer | Informs readable repo/stack layout; does not replace the hosted You.md brain |
| BAMF.ai | Creator/social/media engine | Owns content/media generation, approvals, analytics, scheduling, and BAMFStack |
| BAMF OS | Private/internal BAMF company brain and client/admin tools | Separate private product surface; can consume You.md for Houston identity when scoped |
| Agent hosts | Claude Code, Codex, Cursor, ChatGPT, MCP clients, local agents | Consume scoped context via links, API keys, MCP, host adapters, and YouStack installs |

### Portfolio Graph and Reuse Layer

Current project data is split across several useful surfaces:

- `profiles.projects` and bundle `youJson.projects` for identity-level project
  summaries.
- `projects/<slug>/README.md`, `context.md`, `prd.md`, and `todo.md` custom
  files generated from bundle projects.
- repo-local `project-context/` plus global `~/.youmd/projects/<name>/` context
  overlays read by the CLI/MCP project engine.
- `trackedProjects` for GitHub-active project telemetry: repo URL, product URL,
  repo/directory name, API docs, MCP docs, stack name, high-level goal, recent
  progress, pushed date, language, and LLM insight.
- `repoMirror` for server-readable identity and `stacks/**` files.
- DSI GitHub Project Catalog components and Loop Report source snapshots.

The portfolio graph should layer on top of those records rather than replace
them. It should add typed relationships:

- project owns API/MCP
- project consumes API/MCP
- project depends on project
- project reuses code/UI/pattern from project
- project shares stack/skill source
- project owns protected product agent harness
- project owns public/installable skill stack

Each relationship should carry dependency tier, integration type, auth boundary,
features powered, failure mode, last verification, and duplicate-risk notes.

The first dashboard target is a `/shell` Projects or Portfolio view that shows
all APIs/MCPs, owning projects, connected consumers, dependency direction,
integration tier, docs status, fresh-machine setup status, and reusable patterns
without devolving into nested cards.

The first skill target is a bundled `portfolio-graph-auditor` style skill that
reads local repos, project-context files, prompts, docs, API/MCP surfaces, and
stack manifests, then proposes canonical owners and reusable pattern records.

Local implementation slice:

- `src/data/portfolioGraph.ts` defines the first typed local contract for
  projects, API surfaces, dependency edges, reusable patterns, env-provider
  usage, service-account notes, and skill propagation.
- `src/components/panes/PortfolioGraphPane.tsx` renders the `/shell`
  portfolio view.
- `src/components/panes/ApiEnvPane.tsx` renders the `/shell` APIs/env
  intelligence view.
- `cli/src/lib/portfolio-audit.ts` powers `youmd project portfolio-audit`,
  `env-audit`, and `apis` with value-safe env scanning and optional local salted
  HMAC fingerprints for duplicate-key detection.
- `cli/src/lib/portfolio-graph.ts` is the local-agent graph brief mirror used
  by the published CLI/MCP package.
- `cli/src/mcp/server.ts` injects `portfolioGraph` into `get_agent_brief` /
  `youmd://agent/brief` and exposes structured `youmd://portfolio/graph` for
  local agents.
- `cli/src/mcp/registry.ts` exposes local write tools
  `upsert_portfolio_task` and `record_brain_dump`, which call authenticated
  You.md API endpoints instead of mutating static local mock data.
- `cli/src/commands/project.ts` exposes `youmd project task` and
  `youmd project braindump` for local agents and terminal sessions.
- `convex/http.ts` exposes `POST /api/v1/me/portfolio/tasks` and
  `POST /api/v1/me/portfolio/brain-dumps`; both authenticate API keys,
  write Convex portfolio records, update portable markdown snapshots, publish
  the bundle, push to the linked GitHub repo, and refresh the repo mirror when
  repo sync is enabled.
- `convex/githubRepo.ts` mirrors safe `you.json.custom_files` as actual GitHub
  files, so project task and brain-dump snapshots appear under `projects/**`
  in the repo-backed brain.
- `src/components/panes/SkillsPane.tsx` shows the local-agent sync proof strip
  for shared/meta skills and the MCP portfolio graph startup path.
- `/Users/houstongolden/.agent-shared/claude-skills/portfolio-graph-auditor`
  is the canonical shared agent skill for cross-project portfolio/env/API/MCP
  audits and now requires agents to verify `get_agent_brief` /
  `youmd://portfolio/graph`.

### Writeback Rules

Any write from an agent or connected product should record actor, host, app, stack, source, confidence, timestamp, reason, and approval state. Low-trust agent writes should land as proposed updates or lower-confidence memories, not overwrite higher-trust human-authored context.

### Near-Term Architecture Gaps

- Versioned personal API/MCP resource contract for `identity`, `now`, `projects`, `sources`, `memories`, `preferences`, `trust_rules`, `stacks`, and `activity`.
- App-level grants for h.computer and Creator.new style consumers.
- Lovable-simple connector UX that maps sources into structured context with preview, visibility, trust rules, and refresh policy.
- Source refresh policies, crawlers, crons, monitors, and approval-aware writeback that reuse the immutable raw-source ledger.
- Provider-agnostic mobile capture gateway for SMS/iMessage, voice transcripts, Slack, CLI/web shell, and future host inputs, with raw artifact preservation, source redaction, project routing, task proposals, and approval-aware external writes.
- Richer portfolio graph follow-through: strategy content enrichment,
  dashboard task editing/triage, mobile/watch capture adapters, persisted
  update artifact history, and repo-backed graph snapshots. The Convex-backed
  graph records, project-scoped MCP slice, and CLI/API/MCP task/brain-dump
  write path now exist and have local authenticated proof.
- Skill-learning ingestion for screen recordings, transcripts, SOPs, tool/API lists, agent-run logs, and summaries.
- YouStacks distribution: private/scoped/public repo-backed stacks, host adapters for Claude Code, Codex, Cursor, ChatGPT, MCP clients, and local agents.
- Stack-level model routing/BYOK policy in YouStack manifests and generated host adapters as an advanced capability, not the headline contract.

## Data Model (21 Tables)

### Identity Core

**users** — Authenticated accounts (1:1 with first-party auth subject)
| Field | Type | Notes |
|---|---|---|
| clerkId | string | Legacy field name for the first-party auth subject, indexed |
| username | string | Unique, indexed |
| email | string | Indexed |
| displayName | string? | |
| plan | "free" \| "pro" | |
| isSample | boolean? | Seed data flag |
| createdAt | number | Unix ms |

**profiles** — Public identity (can exist without auth, claimable)
| Field | Type | Notes |
|---|---|---|
| username | string | Indexed, unique |
| name | string | Display name |
| tagline | string? | Short bio |
| location | string? | |
| bio | {short?, medium?, long?}? | Multi-length bios |
| links | any? | Record<platform, url> |
| avatarUrl | string? | Primary avatar URL |
| socialImages | {x?, github?, linkedin?, custom?}? | All scraped images |
| primaryImage | string? | Which source is active |
| ownerId | Id<users>? | Null until claimed |
| isClaimed | boolean | Indexed |
| sessionToken | string? | Pre-auth editing token |
| youJson | any? | Compiled identity bundle |
| youMd | string? | Human-readable identity |
| asciiPortrait | object? | Pre-rendered ASCII art (lines, coloredLines, cols, rows, format, sourceUrl) |
| now | string[]? | What user is doing now |
| projects | any[]? | Projects array |
| values | string[]? | Core values |
| preferences | any? | Agent preferences |
| createdAt, updatedAt | number | |

**bundles** — Versioned identity snapshots
| Field | Type | Notes |
|---|---|---|
| userId | Id<users> | Owner |
| profileId | Id<profiles>? | Linked profile |
| version | number | Auto-increment |
| schemaVersion | string | "you-md/v1" |
| manifest, youJson, youMd | any/string | Bundle content |
| isPublished | boolean | |
| createdAt, publishedAt | number | |
| contentHash, parentHash | string? | Content-addressed ancestry |
| source | string? | "web-shell" \| "cli" \| "api" \| "rollback" \| "agent:<name>" |

#### Draft/publish semantics (P2 resolved 2026-06-13)

Every save creates a new bundle row with `isPublished: false`. Publish is a
separate explicit step that unpublishes all prior bundles and sets
`isPublished: true` on the target. There are no true drafts that stay hidden
from the public profile — but the profile stays at the last-published version
until publish is called, so unsaved-to-published bundles act as drafts in
practice. Both saves and publishes also sync fields directly to the `profiles`
table (profile stays readable without a bundle lookup).

**Save** (`me.saveBundleFromForm`, `me.saveYouJsonDirect`) — inserts a new
bundle at `version+1` with `isPublished: false`; patches `profiles.*` immediately
(convex/me.ts:511-553). The live public profile does NOT update until publish.

**Publish** (`me.publishLatest`, `bundles.publishBundle`) — unpublishes every
existing bundle for the user, patches the target bundle to `isPublished: true`,
and re-syncs fields to `profiles.*` (convex/me.ts:882-982, convex/bundles.ts:167-187).

**Rollback** (`bundles.rollbackToVersion`) — creates a NEW bundle (version+1)
from the old version's content with `isPublished: false`; does NOT auto-publish
(convex/bundles.ts:306-324). Caller must publish separately.

**Web agent auto-publish pattern** — `useYouAgent.ts` calls `saveUpdates` then
immediately calls `publishLatest` in sequence (src/hooks/useYouAgent.ts:2242-2266),
so the agent makes save and publish a single atomic UX action. The CLI `push`
and MCP server do the same two-call sequence. This means in practice every
agent-triggered save is immediately published; the draft window is typically
zero milliseconds for agent-driven flows.

**Single source of truth:** save==publish (with a mandatory explicit publish
step after save; not auto-published by the mutation itself).

### Ingestion Pipeline

**sources** — Connected data sources (URLs)
| Field | Type | Notes |
|---|---|---|
| userId | Id<users> | |
| sourceType | string | "linkedin", "github", "x", "website", etc. |
| sourceUrl | string | |
| rawStorageId | Id<_storage>? | Raw HTML in Convex storage |
| extracted | any? | LLM-extracted structured data |
| status | "pending" \| "fetching" \| "fetched" \| "extracting" \| "extracted" \| "failed" | |
| lastFetched | number? | |
| errorMessage | string? | |

**analysisArtifacts** — LLM analysis outputs
| Field | Type | Notes |
|---|---|---|
| userId | Id<users> | |
| artifactType | string | "author_voice", "topic_map", "bio_variants", "faq", "voice_linkedin", etc. |
| content | any | Structured analysis |

**pipelineJobs** — Pipeline execution tracking
| Field | Type | Notes |
|---|---|---|
| userId | Id<users> | |
| sourceId | Id<sources>? | |
| stage | "discover" \| "fetch" \| "extract" \| "analyze" \| "compile" \| "review" | |
| status | "queued" \| "running" \| "completed" \| "failed" | |
| retryCount | number | |

### Agent & Memory

**memories** — Auto-captured identity facts from conversations
| Field | Type | Notes |
|---|---|---|
| userId | Id<users> | |
| category | string | "fact", "insight", "decision", "preference", "context", "goal", "relationship" |
| content | string | |
| source | string | "you-agent", "cli", "external-agent", "manual" |
| sourceAgent | string? | External agent name |
| tags | string[]? | Searchable |
| sessionId | string? | Which chat produced this |
| isArchived | boolean | |

**chatSessions** — Conversation tracking
| Field | Type | Notes |
|---|---|---|
| userId | Id<users> | |
| sessionId | string | Unique per session |
| surface | string | "web", "cli", "api" |
| summary | string? | Auto-generated |
| messageCount | number | |

**chatMessages** — Persisted conversations (survives page refresh)
| Field | Type | Notes |
|---|---|---|
| userId | Id<users> | |
| sessionId | string | |
| displayMessages | [{id, role, content}] | Frontend display format |
| llmMessages | [{role, content}] | LLM context format |

**agentInteractions** — Which AI agents connect to a profile
| Field | Type | Notes |
|---|---|---|
| profileId | Id<profiles> | |
| agentName | string | "Claude Code", "Cursor", "ChatGPT", etc. |
| agentType | string | "read", "write", "chat" |
| interactionCount | number | |

### Security & Access

**apiKeys** — API keys for CLI and external access
| Field | Type | Notes |
|---|---|---|
| userId | Id<users> | |
| keyHash | string | SHA-256 of raw key (prefix: ym_) |
| label | string? | |
| scopes | string[] | ["read:public", "read:private", "write"] |
| revokedAt | number? | |

**contextLinks** — Shareable identity links with scoped access
| Field | Type | Notes |
|---|---|---|
| userId | Id<users> | |
| token | string | Random token |
| scope | "public" \| "full" | Full includes private context |
| expiresAt | number? | TTL |
| maxUses | number? | |
| useCount | number | |
| revokedAt | number? | |

**accessTokens** — Token-based private data access
| Field | Type | Notes |
|---|---|---|
| profileId | Id<profiles> | |
| tokenHash | string | SHA-256 |
| scopes | string[] | |
| expiresAt | number? | |
| isRevoked | boolean | |

**privateContext** — Owner-only private identity data
| Field | Type | Notes |
|---|---|---|
| profileId | Id<profiles> | |
| privateNotes | string? | |
| privateProjects | any[]? | |
| internalLinks | any? | |
| calendarContext | string? | |
| communicationPrefs | any? | |
| investmentThesis | string? | |
| customData | any? | Freeform |

**privateVault** — Encrypted private files (AES-256-GCM, not yet implemented)
| Field | Type | Notes |
|---|---|---|
| userId | Id<users> | |
| encryptedMd, encryptedJson, iv | bytes | |

**securityLogs, profileReports, profileVerifications** — Audit trail, reports, and verification records.

---

## HTTP API (convex/http.ts)

### Public (No Auth)
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/profiles` | List all profiles (no param) or get one (?username=) |
| GET | `/api/v1/check-username` | Check username availability |
| GET | `/ctx` | Resolve context link (token in path or query) |
| POST | `/api/v1/auth/register` | Create account (email, password, username) |
| POST | `/api/v1/auth/login` | Login (email, password) → API key |

### LLM / Enrichment (API Key Auth)
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/chat` | LLM chat proxy (non-streaming) |
| POST | `/api/v1/chat/stream` | LLM chat proxy (SSE streaming) |
| POST | `/api/v1/scrape` | Scrape a URL for profile data |
| POST | `/api/v1/research` | Perplexity web research |
| POST | `/api/v1/enrich-x` | X/Twitter profile enrichment via Grok |
| POST | `/api/v1/enrich-linkedin` | LinkedIn enrichment via Apify |
| POST | `/api/v1/verify-identity` | Cross-reference identity verification |

### Authenticated (/api/v1/me/*)
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/me` | Get own profile + bundle |
| POST | `/api/v1/me/bundle` | Save bundle |
| POST | `/api/v1/me/publish` | Publish latest bundle |
| GET | `/api/v1/me/sources` | List sources |
| POST | `/api/v1/me/sources` | Add source URL |
| GET | `/api/v1/me/analytics` | View analytics |
| POST | `/api/v1/me/build` | Trigger pipeline build |
| GET | `/api/v1/me/build/status` | Check build status |
| GET | `/api/v1/me/memories` | List memories |
| POST | `/api/v1/me/memories` | Save memory (from external agent) |
| GET/POST/DELETE | `/api/v1/me/context-links` | CRUD context links |
| GET/POST/DELETE | `/api/v1/me/api-keys` | CRUD API keys |
| GET | `/api/v1/me/private` | Get private context |
| POST | `/api/v1/me/private` | Update private context |

All authenticated endpoints use Bearer token auth (API key with ym_ prefix).

---

## Auth Flows

### Web (First-Party Passwordless)
1. User visits /sign-up or /create
2. Terminal-style sequential prompts (email → verification code)
3. Convex creates the user/profile during the passwordless verification flow
4. Redirect to /initialize for onboarding conversation with You Agent
5. Session managed by the first-party `youmd_session` cookie, Convex queries use a custom JWT via `ctx.auth.getUserIdentity()`

### CLI (Passwordless/API Key)
1. `youmd login` → browser sign-in, email-code login, or `--key`
2. CLI hits `/api/auth/send-verification` + `/api/auth/verify-code` for email-code auth
3. Returns API key when available, stored in `~/.youmd/config.json`
4. All subsequent CLI requests use Bearer token auth
5. `youmd register` → username → email → display name → verification code → creates Convex user/profile records

### External Agents (API Key / Context Link)
1. User generates API key in dashboard or via CLI
2. Agent uses Bearer token to access `/api/v1/me/*` endpoints
3. OR: user creates context link → shares URL → agent GETs `/ctx/{username}/{token}`
4. Context link returns plain text or JSON identity bundle (scoped: public or full)

---

## Ingestion Pipeline (convex/pipeline/)

```
fetch → extract → analyze → compile → (review)
```

1. **fetch** — `fetchWebsite` (native), `fetchWithApify` (LinkedIn), `fetchLinkedInFull` (detailed)
2. **extract** — LLM extracts structured data from raw HTML/text using prompts per source type
3. **analyze** — Parallel: voice analysis, topic mapping, bio generation, FAQ generation
4. **compile** — `compileBundleFromPipeline` merges extracted source artifacts into you.json + you.md
5. **review** — A `pipelineJobs` entry is created to signal pipeline completion; bundle is not auto-published (P18 backlog: review stage needs a publish/diff surface or auto-publish wire)

> **Note:** `"discover"` is a valid `stage` enum value in the schema but is not executed by `orchestrator.ts`. It exists as a pre-pipeline marker for when a user registers a source URL. The orchestrator begins at `fetch`. Chat-refined content (memories, private vault, agent directives) is stored separately and surfaced via MCP — it is not merged into the compiled public bundle.

Pipeline is orchestrated by `convex/pipeline/orchestrator.ts`. Each stage creates `pipelineJobs` entries for tracking.

### LLM Model Routing (convex/chat.ts)
| Task | Model |
|---|---|
| chat | Claude Sonnet 4.6 (via OpenRouter) |
| research | Perplexity Sonar |
| verify | Perplexity Sonar Pro |
| x_enrichment | Grok-3-mini |
| summary | Claude Haiku |
| classify | Claude Haiku |

---

## Frontend Routes (Next.js 16 App Router)

| Route | Auth | Rendering | Purpose |
|---|---|---|---|
| `/` | Public | SSR | Landing page (12 sections) |
| `/profiles` | Public | SSR | Profile directory with search |
| `/[username]` | Public | SSR | Public profile page (SEO, JSON-LD, OG) |
| `/docs` | Public | SSR | Documentation |
| `/create` | Public | CSR | Username claim entry point |
| `/sign-in` | Public | CSR | Terminal-style email-code sign-in |
| `/sign-up` | Public | CSR | Terminal-style email-code sign-up |
| `/reset-password` | Public | CSR | Password reset flow |
| `/claim` | Public | Redirect | Redirects to /sign-up |
| `/initialize` | Auth | CSR | Boot sequence + onboarding agent |
| `/dashboard` | Auth | CSR | Terminal (35%) + preview pane (65%) |

### Dashboard Pane System
Terminal left panel is persistent. Right pane switches via slash commands:
- `/profile` — Preview pane (identity summary, portrait)
- `/edit` — Sub-tabs: files (vault), json, sources
- `/share` — Publish, context links, agent prompts, stats
- `/settings` — Account, API keys, billing, activity, help

---

## CLI Architecture (cli/)

**Package:** `youmd` on npm (v0.6.23)
**Entry:** `cli/src/index.ts` (Commander.js)
**21 commands:** init, login, register, whoami, status, build, publish, add, diff, export, preview, chat, link, keys, memories, private, project, pull, push, sync, skill (19 subcommands)

### Key Modules
| File | Purpose |
|---|---|
| `lib/onboarding.ts` | Conversational AI onboarding (1000+ lines) |
| `lib/api.ts` | HTTP client for Convex API |
| `lib/config.ts` | Local config (~/.youmd/), project detection |
| `lib/render.ts` | BrailleSpinner, rich terminal rendering |
| `lib/ascii.ts` | ASCII portrait generation (Jimp) |
| `lib/compiler.ts` | Local bundle compilation |
| `lib/project.ts` | Project-aware file system |
| `commands/chat.ts` | Ongoing conversation with You Agent |

### Local File Structure
```
~/.youmd/
├── config.json          # Auth token, username, API URL
├── profile/             # Identity markdown files
│   ├── about.md
│   ├── now.md
│   ├── projects.md
│   ├── values.md
│   └── links.md
├── preferences/
│   ├── agent.md
│   └── writing.md
├── private/             # Private context
│   ├── notes.md
│   ├── links.json
│   └── projects.json
├── you.json             # Compiled bundle
├── you.md               # Human-readable bundle
└── manifest.json        # File manifest

~/.youmd/projects/{name}/   # Per-project context
├── project.json
├── private/
├── context/             # PRD, TODO, features, changelog, decisions
└── agent/               # Instructions, preferences, memory
```

---

## YouStacks Layer

YouStacks are named, portable packages of expertise (skills, workflows, prompts, docs, tests, host adapters) layered on top of the brain. The layer spans three code surfaces: the CLI manifest engine (`cli/src/lib/youstack.ts` + `cli/src/commands/stack.ts`), the published server-side capability contract (`src/lib/youstack-routing.ts`), and the GitHub repo mirror parser (`convex/github.ts` + `convex/githubRepo.ts`).

### Manifest (youstack.json, schema `youstack/v1`)

Validated by `validateYouStackManifest` in `cli/src/lib/youstack.ts`.

| Field | Required | Notes |
|---|---|---|
| schemaVersion | yes | Must be `"youstack/v1"` |
| kind | yes | Must be `"youstack"` |
| slug | yes | Shell-safe identifier (letters, numbers, dot, underscore, dash) |
| name, version | yes | |
| visibility | yes | `private` \| `scoped-link` \| `public-open` \| `team` |
| id, domain, aliases, tags, description, owner | no | Metadata (single-line recommended) |
| compatibility | no | `{hosts, minYoumdCli, requiresYoumdApi, requiresYoumdMcp}` |
| brainScopes | no | `[{scope, required?, reason?}]` — free text today (see drift) |
| files | no | `[{path, type, required?, checksum?}]` — safe relative paths only |
| adapters | no | `{<host>: {files?, bootstrap?}}` keyed by host id |
| capabilities | no | `[{id, intent?, workflow?, skill?, localOnly?, mcpTool?, apiEndpoint?, requiredScopes?, mutationPolicy?}]` |
| accessPolicy | no | `protectedByDefault: true` expected for v1 stacks |
| sharing, repoSync, docs, tests, provenance | no | Freeform objects |
| improvement | no | `{mode: observe\|propose\|auto_pr\|auto_apply_local, cadence, signals, evals, appliesTo, approvalRequiredFor}` |
| update | no | `{channel, check, source, autoApply, pin}` |
| modelRouting | planned | Stack-level policy for orchestrator, lead, worker, fallback, BYOK/provider preferences, cost posture, risk thresholds, and approval gates |

Canonical example: `cli/examples/youstack-personal/` (`youstack.json` + `skills/youstack-start/SKILL.md`, `workflows/startup.md`, `docs/quickstart.md`, `tests/smoke.md`).

### Capabilities & Routing

- **CLI built-ins** (always merged into every manifest's capabilities by `getYouStackCapabilities`): `manifest.inspect`, `manifest.smoke`, `stack.diagnose`, `stack.improve`, `stack.update`, `stack.maintain`.
- **CLI router:** `routeYouStackRequest` — keyword scorer over id/intent/workflow/skill/mcpTool/apiEndpoint/scopes.
- **Server contract:** `src/lib/youstack-routing.ts` exports `DEFAULT_YOUSTACK_CAPABILITIES` (different vocabulary: `local-static`, `stack-improvement-loop`, `protected-memory-search`, `repo-sync`, etc.) plus its own scorer `routeYouStackCapability`, and `getYouStackCapabilityContract` (readiness states `auth_required`/`unavailable`/`ready`, fallback order, API/MCP threshold).
- **CLI surface:** `youmd stack inspect | doctor | smoke | capabilities | route "<request>" | link` (`cli/src/commands/stack.ts`, registered in `cli/src/index.ts`).
- **Capability boundary:** `localOnly` capabilities use local stack files and never contact You.md; protected capabilities declare `mcpTool`/`apiEndpoint` + `requiredScopes`. `mutationPolicy` on the server type is `read_only | write_local | write_remote | server_action` (CLI type leaves it an open string). Doctor warns when a non-local mutating capability has no `requiredScopes`.

### Adapter Generation

`youmd stack link` (`linkYouStackAdapters`) renders host files from the manifest via `generateYouStackAdapterContent` (stack identity, startup steps, capability list, brain scopes, improvement/update policy, local commands). Default output paths when the manifest declares no `adapters.<host>.files`:

| Host | Generated path |
|---|---|
| claude-code | `.claude/skills/youstacks/<slug>/SKILL.md` |
| codex | `.codex/skills/youstacks/<slug>/SKILL.md` |
| cursor | `.cursor/rules/youstacks-<slug>.md` |
| other | `.you/adapters/<host>/<slug>.md` |

Adapters contain stack routing instructions but no identity content (drift, see below).

### CLI Local Discovery

`findManifestCandidates` (`cli/src/lib/youstack.ts`) walks **up** from cwd to the filesystem root and collects, per directory: `<dir>/youstack.json`, `<dir>/.you/youstack.json`, and `<dir>/youstacks/<name>/youstack.json`. It does NOT look in `stacks/` — the layout the server seeds and parses (see drift).

### Repo Mirror Layout (server source of truth)

GitHub connection state lives in the `githubConnections` table; the mirrored snapshot lives in `repoMirror` (one row per user). Both are written by `convex/github.ts` / `convex/githubRepo.ts`.

- **Seeded repo contents** (`convex/githubRepo.ts`): `README.md`, `you.md`, `you.json`, and `stacks/.gitkeep` ("YouStacks live here. One folder per named stack.").
- **Mirror filter** (`isMirrorablePath`): `you.md`, `you.json`, `README.md`, anything under `stacks/`, and top-level `*.md`. `private/*` is never mirrored server-side (belongs in the encrypted vault). Caps: 100 files, 128 KB/file, 700 KB total.
- **deriveStacks** (`convex/github.ts`) — THE server-side stack parser: a stack is any top-level folder under `stacks/` (path matches `^stacks/<slug>/<rest>`); it counts files per slug and sets `hasManifest` when `<rest>` is `manifest.json|yaml|yml` or `youstack.json|yaml|yml` at the stack root. Output: `{slug, fileCount, hasManifest}[]`.
- **Read surfaces:** `getRepoMirror` (owner; paths + sizes + derived stacks), `getPublicRepoStacks` (public, only when `repoVisibility === "public"` — never leaks private-repo stack names), and the hosted MCP tool `get_my_stacks` (`convex/http.ts`, requires `read:private`).
- **Pull path:** `internalSaveBundleFromRepo` treats repo `you.md`/`you.json` as source of truth, versions a new bundle (`source: "github-repo"`), and syncs the public profile.

### Storage Map

| Location | Layout | Written by | Read by |
|---|---|---|---|
| `~/.youmd/` | `config.json` (0600) + home bundle: `profile/`, `preferences/`, `private/`, `you.json`, `you.md`, `manifest.json` | CLI | CLI (fallback bundle root) |
| `~/.youmd/projects/<name>/` | `project.json`, `private/`, `context/`, `agent/` | CLI `youmd project` | CLI |
| `<cwd>/.youmd/` | Same bundle layout as home; when initialized it silently shadows `~/.youmd` (`resolveActiveBundleDir`, `cli/src/lib/config.ts`) | CLI | CLI |
| `<dir>/youstack.json`, `<dir>/.you/youstack.json`, `<dir>/youstacks/<slug>/youstack.json` | CLI manifest discovery candidates (upward walk) | Stack author | CLI `youmd stack` |
| `.claude/skills/youstacks/<slug>/SKILL.md` (+ codex/cursor equivalents) | Generated host adapters | CLI `youmd stack link` | Host agents |
| GitHub repo `stacks/<slug>/...` | Server canonical stack layout; manifest = `stacks/<slug>/(youstack\|manifest).(json\|yaml\|yml)` | Server seed (`stacks/.gitkeep`) + user commits | Server mirror sync → `deriveStacks` → dashboard/API/MCP |
| Convex `repoMirror` table | Snapshot of mirrorable repo files (100 files / 128 KB / 700 KB caps; no `private/*`) | `convex/githubRepo.ts` sync | `getRepoMirror`, `getPublicRepoStacks`, MCP `get_my_stacks` |

### Known Drift (do not paper over)

1. **Three incompatible stack layouts.** Server seeds/parses repo `stacks/<slug>/` (`deriveStacks`); CLI discovers only `youstack.json` / `.you/` / `youstacks/`; the example manifest's `repoSync.path` is `youstacks/personal-agent-start`; the YouStacks PRD proposed `.youstacks/<slug>/stack.json`. The CLI cannot find stacks laid out the way the server expects. Reconciliation tracked as backlog P8 (PRODUCT-AUDIT #10).
2. **Two independent routers/vocabularies.** CLI built-ins (`manifest.inspect`, `stack.maintain`, ...) vs server `DEFAULT_YOUSTACK_CAPABILITIES` (`local-static`, `native-stack-maintainer`, ...) with different scorers — the same request can route differently (PRODUCT-AUDIT #20).
3. **Phantom protected endpoints/scopes.** The published contract advertises `/api/v1/stacks/{stack_id}/...` routes and scopes like `stack.write`, `memories.search` that do not exist in the real API scope vocabulary (`read:public`, `read:private`, `write`) (PRODUCT-AUDIT #12).
4. **No install/distribution flow.** `youmd stack` is local-manifest tooling only (inspect/doctor/smoke/capabilities/route/link); "installable YouStack" is manual file copying; stack HTTP endpoints are self-only (PRODUCT-AUDIT #11).
5. **Example/CLI version contradiction.** `cli/examples/youstack-personal/youstack.json` declares `minYoumdCli: "0.7.0"` while the published CLI is `0.6.23` (`cli/package.json`).
6. **brainScopes are unvalidated free text** and generated adapters contain no identity content (PRODUCT-AUDIT #21).
7. **No stack-level model routing contract yet.** Global agent instructions describe orchestrator/lead/worker model tiers, but YouStack manifests and generated adapters do not yet carry a machine-readable routing policy for external hosts.

---

## You Agent System (you-agent/)

The You Agent is the AI personality that talks to users in the dashboard terminal and CLI. It is NOT the coding agent (Claude Code) — it's the product's built-in AI.

| File | Purpose |
|---|---|
| `you-agent/soul.md` | Agent personality, philosophy, voice |
| `you-agent/agent.md` | Technical capabilities, tool usage |
| `you-agent/skills/` | Modular skill definitions |

The You Agent is powered by `src/hooks/useYouAgent.ts` (web) and `cli/src/commands/chat.ts` (CLI). Both use the same LLM proxy (`/api/v1/chat/stream`) with Claude Sonnet 4.6.

---

## Deployment

| Service | Environment | URL |
|---|---|---|
| Vercel | Production | you.md |
| Convex | Production | kindly-cassowary-600 |
| Convex | Development | uncommon-chicken-142 |
| npm | CLI package | npmjs.com/package/youmd |

### Deploy Commands
```bash
git push                           # Triggers Vercel auto-deploy
npx convex deploy                  # Deploy Convex to prod (needs CONVEX_DEPLOY_KEY)
cd cli && npm run build            # Build CLI
cd cli && npm version patch        # Bump version
npm run publish:cli                # Trigger trusted npm publish through GitHub Actions
```

GitHub Actions auto-deploys Convex when `convex/` files change on push to main.
CLI npm publishing uses npm Trusted Publishing through `.github/workflows/publish-cli.yml`.
