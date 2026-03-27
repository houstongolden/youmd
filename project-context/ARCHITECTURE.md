# You.md — Architecture Reference

Last Updated: 2026-03-26

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
│  │  Clerk (Web)                  │  │  Email/Password + API Keys (CLI) │   │
│  │  clerk.you.md (production)    │  │  Clerk Backend API + SHA-256     │   │
│  │  OAuth, MFA, session mgmt    │  │  Bearer token: ym_*              │   │
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
│  DATA LAYER: 17 Convex tables                                             │
│  users, profiles, bundles, sources, analysisArtifacts, apiKeys,           │
│  privateVault, pipelineJobs, profileViews, contextLinks, memories,        │
│  chatSessions, chatMessages, privateContext, accessTokens,                │
│  securityLogs, profileReports, profileVerifications, agentInteractions    │
│                                                                            │
│  ───────────────────────────────────────────────────────────────────────  │
│                                                                            │
│  EXTERNAL SERVICES                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │  OpenRouter  │  │  Apify      │  │  Clerk      │  │  Vercel         │ │
│  │  Claude 4.6  │  │  LinkedIn   │  │  Auth       │  │  Hosting + Edge │ │
│  │  Perplexity  │  │  Scraper    │  │  Backend    │  │  ISR + SSR      │ │
│  │  Grok-3      │  │             │  │  API        │  │                 │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Model (17 Tables)

### Identity Core

**users** — Authenticated accounts (1:1 with Clerk)
| Field | Type | Notes |
|---|---|---|
| clerkId | string | Clerk user ID, indexed |
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

### Web (Clerk)
1. User visits /sign-up or /create
2. Terminal-style sequential prompts (email → password → verification code)
3. Clerk creates user, webhook or client creates Convex user + profile
4. Redirect to /initialize for onboarding conversation with You Agent
5. Session managed by Clerk, Convex queries use `ctx.auth.getUserIdentity()`

### CLI (Email/Password)
1. `youmd login` → enter email → enter password
2. CLI hits `POST /api/v1/auth/login` → Clerk Backend API verifies credentials
3. Returns API key (auto-generated), stored in `~/.youmd/config.json`
4. All subsequent CLI requests use Bearer token auth
5. `youmd register` → email → password → username → creates Clerk user + Convex records

### External Agents (API Key / Context Link)
1. User generates API key in dashboard or via CLI
2. Agent uses Bearer token to access `/api/v1/me/*` endpoints
3. OR: user creates context link → shares URL → agent GETs `/ctx/{username}/{token}`
4. Context link returns plain text or JSON identity bundle (scoped: public or full)

---

## Ingestion Pipeline (convex/pipeline/)

```
discover → fetch → extract → analyze → compile → review
```

1. **discover** — User adds source URL, type auto-detected
2. **fetch** — `fetchWebsite` (native), `fetchWithApify` (LinkedIn), `fetchLinkedInFull` (detailed)
3. **extract** — LLM extracts structured data from raw HTML/text using prompts per source type
4. **analyze** — Parallel: voice analysis, topic mapping, bio generation, FAQ generation
5. **compile** — `compileBundleFromPipeline` merges all artifacts into you.json + you.md
6. **review** — Bundle saved, auto-published

Pipeline is orchestrated by `convex/pipeline/orchestrator.ts`. Each stage creates `pipelineJobs` entries for tracking. Failures retry up to 3 times.

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
| `/sign-in` | Public | CSR | Terminal-style Clerk sign-in |
| `/sign-up` | Public | CSR | Terminal-style Clerk sign-up |
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

**Package:** `youmd` on npm (v0.5.0)
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
| Clerk | Production | clerk.you.md |
| npm | CLI package | npmjs.com/package/youmd |

### Deploy Commands
```bash
git push                           # Triggers Vercel auto-deploy
npx convex deploy                  # Deploy Convex to prod (needs CONVEX_DEPLOY_KEY)
cd cli && npm run build            # Build CLI
cd cli && npm version patch        # Bump version
cd cli && npm publish --otp=CODE   # Publish to npm
```

GitHub Actions auto-deploys Convex when `convex/` files change on push to main.
