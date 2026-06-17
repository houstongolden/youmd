# You.md — Product Requirements Document

Version: 2.3
Last Updated: 2026-06-17
Founder: Houston Golden

---

## 1. Vision

You.md is your agent brain, personal API/MCP, and named expertise stack layer for the agent internet. It gives Claude Code, Codex, Cursor, ChatGPT, and any agent the context it should already have: who you are, what you remember, how you work, what you are building, which sources it can trust, and which workflows/skills it should use.

**One-liner:** Your brain and best workflows for every AI agent.

**Expanded promise:** A personal API where the context is you.

**Simple product model:** Brain → Stacks → Runtime → Protected API/MCP.

- **Brain:** identity, memory, preferences, private context, project context, source catalog, provenance, trust rules, public/private context links, and protected context surfaces.
- **Stacks:** named packages of expertise, skills, workflows, prompts, examples, docs, tests, host adapters, improvement policy, and update policy. A stack is a `youstack.json` (`youstack/v1`) manifest plus its files; in a connected GitHub repo, stacks live under `stacks/<slug>/` — the layout the server seeds and parses (`deriveStacks` in `convex/github.ts`). Known drift: CLI discovery and the example stack still use `youstack.json` / `.you/` / `youstacks/` paths instead of `stacks/`; reconciliation tracked as backlog P8.
- **Runtime:** the one curl-installed helper layer that gets You.md into Claude Code, Codex, Cursor, and other agent hosts.
- **Protected API/MCP:** the authenticated boundary for private memory retrieval, tokens, repo sync, connected tools, visibility changes, and sensitive actions.
- **Portfolio Graph:** the project ecosystem map that connects projects, APIs,
  MCPs, stacks, protected app agent harnesses, dependencies, reusable patterns,
  machine setup, and DRY ownership.

**Positioning:** Not just a social profile, resume, settings page, CLI, API, or chatbot. You.md is the durable brain plus portable expertise-stack layer agents use before they start improvising.

**Messaging anchors to preserve:**
- The context every agent should already have.
- Your portable identity and expertise stack for the agent internet.
- Not another chatbot; the substrate your agents use before they improvise.
- Your agent brain and best workflows for every AI agent.
- Brain → Stacks → Runtime → Protected API/MCP.

**h.computer routing clarification (2026-06-15/16):** h.computer is Houston's personal site, personal agent, and living reference implementation. The broad productizable primitive belongs here in You.md: personal API/MCP, structured identity/context, connector-backed source memory, YouStacks, host adapters, source refresh, skill learning, stack-level model routing, and gated agent access. h.computer should read from You.md and write back useful memories or activity. Creator.new can optionally attach creator identity/context from You.md. Neither should become the canonical identity/context protocol.

### Product Relationship Map

You.md is the canonical protocol and brain. Other Houston projects can consume it, demonstrate it, or build domain-specific experiences on top of it, but they should not become the source of truth for the general personal API primitive.

| Surface | Relationship to You.md |
|---|---|
| You.md | Canonical identity/context protocol, durable agent brain, personal API/MCP, YouStacks, trust/provenance, public/private context links, universal mobile brain-dump capture and project routing |
| h.computer | Houston's personal site, personal agent, and reference implementation powered by You.md; reads You.md context and may write useful memories/activity back |
| Creator.new | BAMF-powered creator builder that can optionally attach You.md identity, voice, preferences, and creator/project context |
| folder.md | Agent-readable storage and folder conventions that inform YouStack/repo layout and readable project context |
| BAMF.ai | Creator/social/media engine with its own API/MCP/BAMFStack, content generation, approvals, analytics, and scheduling |
| BAMF OS | Private/internal BAMF company brain, CRM, client portals, and admin tools; separate from public You.md and BAMF.ai creator flows |
| BAD/Myo/Hubify/BigBounce and other product apps | Domain consumers of routed capture output; they own their vertical experiences, while You.md owns the shared inbox, memory, routing, permissions, and audit substrate |

---

## 2. Target Users

### Primary: AI Power Users
People who use 3+ AI agents daily (Claude Code, Cursor, ChatGPT, Codex, etc.) and are tired of re-explaining who they are, what they do, and how they like to work. Founders, engineers, researchers, creators.

### Secondary: Agent Developers
Teams building AI agents/apps that need structured user context. They integrate via the HTTP API or context links to get rich public brain data for their users.

### Tertiary: Knowledge Workers
Anyone who wants a living, structured agent brain that evolves through conversation -- not a static bio page.

---

## 3. Core Product Surfaces

### 3.1 Web App (you.md)
- **Landing page** — 12-section homepage explaining the product
- **Public profiles** — `you.md/{username}` — SSR, SEO-optimized, JSON-LD
- **Dashboard** — Claude Code-style terminal (35%) + preview pane (65%)
- **Profiles directory** — Browse all public profiles with search
- **Docs** — Integration guides, API reference

### 3.2 CLI (npm: youmd)
- **youmd init** — Conversational AI onboarding that builds your agent brain through dialogue
- **youmd chat** — Ongoing conversation with the You Agent for profile evolution
- **youmd push/pull/sync** — Two-way sync between local files and web
- **youmd link** — Create shareable brain/context links with scoped permissions
- **youmd project** — Per-project agent context management
- 20 total commands covering the full brain, stack, and context lifecycle

### 3.3 HTTP API
- 30+ endpoints for profile CRUD, LLM chat, scraping, enrichment, memory management
- Bearer token auth (API keys with ym_ prefix)
- Context links for agent-accessible identity bundles
- SSE streaming for real-time chat

### 3.4 Protected API/MCP
The protected API/MCP is the user's structured context boundary for agents and products.

- Personal API resources: `identity`, `now`, `projects`, `sources`, `memories`, `preferences`, `trust_rules`, `stacks`, and `activity`
- MCP resources/tools for safe agent access to the same surfaces, with honest readiness states when auth, source freshness, or hosted retrieval is unavailable
- Access modes: public read, scoped context links, owner API keys, host/stack-specific agent tokens, and connected-app grants
- Writeback with provenance: actor, host, stack, source, confidence, timestamp, reason, and approval state
- Product consumers: h.computer, Creator.new, BAMF.ai, folder.md, MCP clients, Claude Code, Codex, Cursor, ChatGPT, and future runtimes

This is the intuitive personal API layer: agents should not need to scrape the user's life from scratch, and connected products should not need to invent their own identity brain. They request scoped context from You.md, mutate only through trusted writeback paths, and leave an audit trail.

### 3.5 Identity Bundle (you.json / you.md)
The compiled output — a portable identity file containing:
- Profile data (name, bio, tagline, location, links)
- Projects, values, "what I'm doing now"
- Voice analysis (how you write on each platform)
- Agent directives (how you want AI to interact with you)
- Credibility signals (cross-referenced from multiple sources)
- FAQ (predicted questions about you)
- Connected sources metadata

### 3.6 Connectors, Crawlers, and Source Refresh
- Lovable-simple connector UX for adding sources and tools: pick source, authenticate/paste URL, preview mapped context, choose visibility/trust rules, save, and schedule refresh
- Source ledger with immutable raw versions, content hashes, provenance, freshness, and conflict/stale/low-confidence states
- Refresh modes: manual, webhook, hourly, daily, weekly, and monitored update summaries
- First connector targets: GitHub, public URLs/RSS, raw markdown/OKF directories, custom webhooks, custom JSON endpoints, and generic connected-app grants for future product integrations

### 3.7 Mobile Capture and Project Routing
- Brain-dump inbox for Apple Watch/iPhone voice-to-text, SMS/iMessage, pasted transcripts, future audio transcripts, Slack messages, CLI/web shell messages, and other host-adapter inputs
- Raw artifact first: store the original transcript privately with redacted source metadata, timestamp, provider/channel, source hash, inferred session, project hints, and provenance
- Processing pipeline: dedupe repeated dictation chunks, segment into ideas, classify by project/consumer/confidence, extract memory candidates, extract tasks/next actions, and keep unclear fragments in a clarification queue
- Provider-agnostic messaging gateway: evaluate Sendblue for iMessage/SMS/RCS capture, but normalize all inbound messages into You.md before any app-specific handling
- Project-specific consumers: BAD owns workout/run transcript sessions; Myo owns health/body/productivity capture; h.computer displays Houston's personal stream; Hubify/BigBounce, Creator.new, BAMF.ai, Fantasy.is, and BAMF site receive routed project work when relevant
- External writes require approval unless a user explicitly configures a scoped automation rule. Notion, GitHub issues, project boards, CRM, Slack sends, and product-app writes should land as proposals by default
- Voice clone and Slack host adapters belong behind explicit consent, disclosure, action scopes, revocation, and audit logs

### 3.8 Skill Learning and YouStack Improvement
- Convert human screen recordings, transcripts, SOPs, tool/API lists, agent-run logs, summaries, corrections, and repeated workflows into reusable skills
- Draft `SKILL.md`, workflows, prompts, tests, docs, and host adapter updates into a selected YouStack
- Require approval and smoke tests before installing, sharing, or publishing learned skills
- Preserve provenance so every learned workflow explains what source material, run log, or human correction created it

### 3.9 Stack-Level Model Routing
- YouStacks should carry model routing policy, not just human-written instructions
- Policy fields should cover orchestrator model, lead model, worker models, fallback models, BYOK/provider preferences, cost posture, risk thresholds, and approval gates
- Host adapters should translate that policy into Claude Code, Codex, Cursor, ChatGPT, MCP-client, and local-agent guidance

### 3.10 Project Portfolio Graph and Reuse Catalog
You.md should organize Projects as a strategic portfolio, not just a list of
names. The `projects` resource must evolve into a goal-oriented map for a single
human building many products with many agents.

The portfolio graph should connect:

- active projects, repos, local directories, product URLs, docs, and current
  goals
- maintained project packs: PRD, tasks, design, research, ideas, changelog,
  current state, agent docs, API docs, and MCP docs
- APIs, MCP servers, CLI commands, webhooks, SDKs, internal functions, and
  protected product agent harnesses
- primary owning project and connected consumer projects
- dependency edges with clear labels: dependent, feature, optional, dev-only,
  admin, workspace, user-level
- risk and failure notes: what breaks if a dependency fails
- canonical skill-stack ownership and protected-vs-public stack boundaries
- reusable code, UI/UX, auth, role, sidebar, chat, streaming, connector, docs,
  and env patterns

The first saved product memo is
`project-context/PROJECT_PORTFOLIO_GRAPH_AND_REUSE_PRD_2026-06-17.md`.

Implementation slice shipped locally on 2026-06-17:

- `/shell` now has a Portfolio Graph pane for projects, API/MCP ownership,
  dependency edges, reusable patterns, protected harness boundaries, and shared
  skill propagation.
- `/shell` now has an APIs + Env Intelligence pane for provider usage,
  env-key normalization, service-account notes, API/MCP risk tiers, and
  secret-safe local audit commands.
- `youmd project portfolio-audit` / `env-audit` / `apis` now scan local
  projects and `.env.local` key names without printing values. Optional
  `--fingerprints` compares reused key values by local salted HMAC.
- Shared `portfolio-graph-auditor` now lives in the global agent skill layer and
  syncs into Claude, Codex, Cursor, and Pi.
- Local MCP `get_agent_brief` / `youmd://agent/brief` now includes the
  portfolio graph so Claude Code, Codex, Cursor, and other local agents see
  project/API/MCP ownership before adding duplicate routes or stacks.
- Local MCP exposes `youmd://portfolio/graph` as structured JSON for agents
  that need the graph without scraping dashboard copy.
- `/shell` `/skills` now includes a readable local-agent sync proof strip for
  `portfolio-graph-auditor`, `meta-improve`, `proactive-context-fill`, and
  `get_agent_brief + portfolio graph`, making shared/meta skill propagation
  visible to Houston in the web UI.

Implementation slice shipped and verified on 2026-06-17:

- Portfolio graph records now persist in Convex tables for projects, API/MCP
  surfaces, dependency edges, reusable patterns, brain-dump captures, and
  human/agent portfolio tasks.
- Portfolio project records now hydrate from real active project activity:
  authenticated 90-day GitHub `trackedProjects` plus filtered local
  `portfolio-graph-auditor` output. The 4-project bootstrap seed is only a
  fallback/proof seed, not the completion bar.
- Project activity intelligence persists in `portfolioProjectActivities` from
  recent local-git commits, GitHub PRs, and hydration summary events. Project
  cards now show shipped `today` / `7d` / `30d` chips and open into a shipping
  timeline for the selected project.
- Local MCP `get_project_context` now includes a project-scoped portfolio slice
  so agents see owned surfaces, dependencies, reusable patterns, commands, and
  guardrails before creating duplicate APIs, MCP routes, stacks, or UI/code.
- `/shell` task and brain-dump commands can create `portfolioTasks` and
  `brainDumpCaptures`, write repo-backed snapshots, and run the GitHub PR/mirror
  sync loop.
- Authenticated API endpoints now let local agents do the same work:
  `POST /api/v1/me/portfolio/tasks` and
  `POST /api/v1/me/portfolio/brain-dumps`.
- Authenticated API endpoint `POST /api/v1/me/portfolio/projects/hydrate`,
  local CLI command `youmd project portfolio-hydrate`, and MCP tool
  `hydrate_portfolio_graph` hydrate the persisted portfolio graph for local and
  web agents.
- The hydrate path synthesizes project strategy from README plus maintained
  `project-context` PRD, overview, tasks, design, research, and ideas docs, then
  renders those fields in the Portfolio Graph `STRATEGY INTELLIGENCE` section.
- The local CLI exposes `youmd project task` and `youmd project braindump`.
  Local MCP exposes `upsert_portfolio_task` and `record_brain_dump`.
- Portfolio task triage is now first-class in the dashboard and local-agent
  layer: `portfolio.updateTaskTriage`, `POST /api/v1/me/portfolio/tasks/triage`,
  and MCP `update_portfolio_task` update status/priority on existing tasks
  without creating duplicates. The `/shell` Portfolio Graph pane renders
  compact task controls for proposed/open/in-progress/done/snoozed/cancelled
  state and low/normal/high/urgent priority.
- Repo-backed snapshots such as `projects/youmd/tasks.md` and
  `projects/_braindumps/recent.md` are pushed as real files in the linked
  GitHub brain repo, not hidden only inside `you.json.custom_files`.
- Authenticated CLI and browser QA proved the path through merged PR #9 and PR
  #10 in `houstongolden/houstongolden-you-md`, refreshed the repo mirror to 50
  files, and rendered the CLI-created rows in the persisted Portfolio Graph pane.
- Authenticated task-triage QA proved the dashboard controls and local-agent API
  route: the shell moved a no-sync QA task from open/low to urgent, in-progress,
  and done; the API route triaged another no-sync task to done/urgent without
  attempting a GitHub repo push.
- Authenticated local hydration QA proved the real graph path on 2026-06-17:
  the auditor found 268 project/package candidates and 97 providers, hydration
  scanned 129 recent local candidates, upserted 30 local projects, considered
  40 GitHub tracked projects, and the shell rendered `55 PROJECTS`, shipped
  chips, high-signal ordering, and a scrolled shipping timeline in the
  persisted Portfolio Graph pane.
- Reusable pattern mining is now scanner-derived, not seed-only: the same
  compiled hydrate path mines code/UI/auth/layout/streaming/env/task/project-
  context patterns from active repo signals into `portfolioReusablePatterns`.
  Verified run: `8` pattern families from `30` active projects / `8240` signal
  files, `11` persisted patterns total, and authenticated browser proof of
  `REUSABLE PATTERNS` usage/source evidence.

Important boundary: a product's protected in-app agent harness is not the same
thing as an installable public skill stack. The public stack teaches host agents
how to use the product API/MCP safely. The protected harness may include private
strategy, copywriting, image generation, internal tools, client data, approvals,
and proprietary prompts.

The first duplicate-risk example to audit remains Lempod management across
`bamfsite` and `bamfaiapp`, but Houston deferred that audit on 2026-06-17 while
handling Lempod in those repos directly. You.md should still preserve the
ownership rule: verify which project owns a capability before any agent adds a
redundant endpoint.

---

## 4. Core User Journeys

### Journey 1: CLI-First Onboarding
```
npx youmd register (or youmd login)
→ Create account with email-code verification (30 seconds)
→ youmd init
→ ASCII YOU logo renders
→ Agent asks for username → name → first social handle
→ Agent immediately shows ASCII portrait ("you look good in pixels")
→ Agent scrapes social profiles, shows BrailleSpinner + personality
→ Conversational Q&A builds identity progressively
→ Agent compiles you.json + you.md
→ "done" → shows next steps (push, sync, chat)
```

### Journey 2: Web-First Onboarding
```
you.md/create → enter email → password → verification → username claim
→ /initialize boot sequence (typewriter animation)
→ You Agent greets, gathers context conversationally
→ Profile builds in real-time, visible in right pane
→ Agent auto-scrapes links, researches background, publishes
```

### Journey 3: Agent Integration
```
User creates context link (web or CLI)
→ Shares link with AI agent: "Read my identity: https://www.you.md/ctx/username/token"
→ Agent GETs the link → receives structured identity bundle
→ Agent responds with personalized context from the start
```

### Journey 4: Ongoing Identity Evolution
```
User runs youmd chat (CLI) or uses web terminal
→ Conversations auto-update profile sections
→ Agent captures memories, updates directives
→ Profile stays fresh without manual editing
→ youmd sync keeps local ↔ web in sync
```

---

## 5. The You Agent

The You Agent is the AI personality embedded in the product. It's not a generic chatbot — it's a sharp, curious, slightly weird AI that genuinely wants to understand you.

### Personality
- **Warm but direct.** Not corporate. Not try-hard.
- **Dry humor.** "you look good in pixels." Not "Great profile photo!"
- **Genuinely curious.** Asks follow-up questions that show it's listening.
- **Terminal-native tone.** Lowercase. No emoji. Concise.
- **"Always building."** Acts on inferences immediately. "adding that to your projects now" not "would you like me to add that?"

### Capabilities
- Profile building through conversation
- Web scraping and social profile enrichment
- Voice analysis across platforms
- Identity verification (cross-referencing sources)
- Memory management (auto-capture facts, preferences, decisions)
- Agent directive inference (learns your communication style)
- Custom section creation
- Portrait management

### Progressive Depth
The agent starts with basics and goes deeper:
- **L1:** Name, username, social handles, current role
- **L2:** Projects, values, tech stack, communication preferences
- **L3:** Decision frameworks, pet peeves, long-term goals
- **L4:** Private context, investment thesis, calendar priorities

---

## 6. Design System (v2.3 — STRICT)

### Philosophy
Terminal-native, not SaaS. Infrastructure with soul. Every pixel should feel like "system output that happens to be beautiful."

### Colors
- **Dark mode default:** #0D0D0D background
- **Light mode:** via `.light` class (NOT prefers-color-scheme)
- **Accent:** Burnt orange #C46A3A (links, CTAs, active states)
- **Text:** #EAE6E1 primary, #A89E91 secondary
- **Borders:** #2E2E2E
- **Hierarchy via spacing + opacity (0.3-0.9), NOT font weight**

### Typography
- **Headings/Brand/Code:** JetBrains Mono
- **Body text:** Inter
- **No Geist fonts**

### Components
- **Terminal panels** (bg-raised, 1px border, 3-dot header) replace all cards
- **CLI pills** (copy-to-clipboard) for commands
- **Glass nav** with --flag format items
- **Section labels:** uppercase, tracking-widest, mono, `── LABEL ──` format
- **ASCII portraits** are the visual identity — not profile photos
- **PixelYOU canvas logo** — drawn on canvas, not an image

### Animations
- FadeUp (IntersectionObserver)
- Boot sequence typewriter (55ms/char)
- Count-up metrics
- BrailleSpinner for all async operations
- NO Aurora, GradientText, BlurText, or particle effects

### Absolute Rules
- No emoji anywhere (UI or CLI)
- No rounded cards with drop shadows
- No colorful CTAs
- No decorative illustrations
- No gradients
- Border radius: 2px everywhere
- One accent color. Everything else grayscale.

---

## 7. Data Model

See ARCHITECTURE.md for the complete 21-table schema. Key relationships:

```
users (1:1 first-party auth subject) → profiles (1:1, claimable)
                   → bundles (1:many, versioned)
                   → sources (1:many)
                   → apiKeys (1:many)
                   → memories (1:many)
                   → chatSessions/chatMessages

profiles → contextLinks (1:many)
         → privateContext (1:1)
         → accessTokens (1:many)
         → agentInteractions (1:many)
         → securityLogs, profileReports, profileVerifications
```

---

## 8. Security Model

### Authentication
- **Web:** First-party passwordless email-code auth with signed session cookies and Convex custom JWTs
- **CLI:** Browser sign-in, email-code login, or direct API key auth
- **API:** Bearer token (SHA-256 hashed ym_ keys)

### Authorization
- **Free plan:** 1 API key, public read scope only, limited context links
- **Pro plan:** Unlimited keys, all scopes, full private access
- **Context links:** Token-based, scoped (public/full), TTL, max uses
- **Private context:** Only accessible to profile owner or full-scope tokens

### Data Protection
- API keys stored as SHA-256 hashes (raw key shown once at creation)
- Context link tokens: random, URL-safe, revocable
- Private vault: AES-256-GCM encryption (planned)
- Security events logged to securityLogs table

---

## 9. CLI Requirements

### Core Philosophy
The CLI is the PRIMARY experience, not a secondary tool. It should feel like Claude Code — alive, intelligent, responsive. Auth is required — users register or login before building their identity. Anonymous/no-signup profile creation is deferred to v2 growth strategy.

### UX Requirements
- BrailleSpinner on EVERY async operation (LLM calls, scrapes, compiles, saves)
- ASCII portrait shown within first 3 interactions during onboarding
- AI humor throughout (personality-rich spinner labels, witty transitions)
- One question at a time, accent-colored, skippable with Enter
- YOU ASCII logo on opening screen
- Multi-select UI for platform/tool selection
- Color rotation on spinner text (orange shades)
- Lightsweep effect on active text
- Proper word-wrap and left-aligned formatting

### CLI Commands (20)
init, login, register, whoami, status, build, publish, add, diff, export, preview, chat, link, keys, memories, private, project, pull, push, sync

---

## 10. Agent Integration Spec

### Context Link Resolution
```
GET https://www.you.md/ctx/{username}/{token}
Accept: text/plain → returns you.md (human-readable identity)
Accept: application/json → returns you.json (structured bundle)
```

### AI Agent User-Agent Detection
Profile pages serve public brain context to known AI agent user-agents, enabling:
```
"Read my public You.md brain before we start: https://you.md/houstongolden"
```

### Share Prompt Templates
Platform-specific prompts for Claude, ChatGPT, Cursor, Copilot, and universal format. Each includes the context link + directive for how the agent should respond.

---

## 11. Success Metrics

### North Star
- Unique profiles with 3+ sources connected
- Context link clicks per week (agents consuming identity)

### Engagement
- CLI installs (npm)
- Agent interactions per profile per week
- Memory capture rate (auto-captured per conversation)
- Profile freshness (% updated in last 7 days)

### Growth
- Profile directory size
- Inbound traffic to profiles (SEO)
- CLI → web conversion (users who sign up after trying CLI)

---

## 12. Roadmap Priorities

### Now (v1 MVP polish)
1. End-to-end flows working perfectly: CLI ↔ web sync, context links, MCP startup brief, protected reads, and shell chat persistence.
2. CLI and shell feel alive: spinners, portraits, personality, full-height workspace, clean composer, and trustworthy mutation follow-through.
3. Agent integration proven: context links, owner API keys, connected-app grants, and MCP resources work with Claude Code, Codex, Cursor, ChatGPT, MCP clients, and local agents.
4. Personal API/MCP contract documented: versioned resources for `identity`, `now`, `projects`, `sources`, `memories`, `preferences`, `trust_rules`, `stacks`, and `activity`.

### Next (v1.1) — Personal API, connectors, and source refresh
1. Lovable-simple connector UX: add source/tool, preview mapped context, choose visibility/trust, save, and schedule refresh.
2. Custom source crawlers and refresh jobs: native fetch, Firecrawl, agent-browser sandbox, webhook, RSS, GitHub, JSON, OKF/folder sources.
3. Monitored updates: immutable raw versions, source health, change summaries, owner approval, provenance-rich writeback, and freshness states.
4. Context-link and MCP polish: scope preview, revocation, readiness states, resource-specific grants, and clearer hosted/local fallback behavior.
5. Public/private context modes: public identity, scoped links, private memories, private project context, stack-specific reads, and token-gated connected products.
6. Mobile brain-dump capture: provider-agnostic SMS/iMessage/voice/Slack inbound adapter research, raw transcript inbox, dedupe/segment/classify pipeline, project-routing/task proposal UI, BAD workout handoff, and approval model for external writes.

### Next (v1.2) — YouStacks distribution and skill learning
1. YouStacks distribution: private, scoped, public-open, repo-backed, installable, smoke-tested, and host-adapted.
2. Host adapters for Claude Code, Codex, Cursor, ChatGPT, MCP clients, and local agents; OpenClaw/Hermes/Pi remain secondary after primary hosts are reliable.
3. Screen-recording/transcript/SOP-to-skill loop: convert repeated human or agent workflows into draft skills, workflows, prompts, docs, examples, tests, and adapter updates.
4. Folder.md-style readable structure: repo paths and OKF concepts remain useful to humans and agents without requiring a hosted SDK.
5. Stack-level model routing/BYOK as an advanced capability: orchestrator, lead, worker, fallback, cost posture, approval gates, and provider preferences travel with the stack but do not lead marketing copy.

### Later
1. Identity version control: content hashes, pull-before-push, merge strategies, bundle history, and "PR" style external-agent proposals.
2. Team/org bundles, custom domains, verified badges, profile analytics, Stripe Pro, marketplace/plugin distribution.
3. Anonymous profile creation / SEO knowledge panels — deferred growth feature.
4. Agent-to-agent communication protocol and richer connected-agent activity feed.
5. Interview mode and autonomous source refresh beyond the owner-approved MVP.
