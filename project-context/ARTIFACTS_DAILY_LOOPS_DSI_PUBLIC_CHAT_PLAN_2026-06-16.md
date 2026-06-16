# Artifacts, Daily Loops, DSI, and Public Profile Chat Plan

Date: 2026-06-16

## Product Goal

You.md should become the durable personal brain and stack runtime that can:

1. Store and edit markdown/artifact files in an Obsidian-like app workspace.
2. Run scheduled Loop Reports through skills, connected apps, MCP/API grants, crawlers, and source refresh.
3. Persist daily source snapshots and generated reports as historical data.
4. Expose owner-approved DSI components on public profiles.
5. Let visitors and connected apps talk to a user's public context through a secure profile chat widget and conversation API.

## Local Reference Patterns Reviewed

### h.computer

Relevant files:

- `src/lib/journal.server.ts`
- `src/lib/journal.functions.ts`
- `src/lib/school.functions.ts`
- `src/lib/school-sync.server.ts`
- `src/lib/feed.functions.ts`
- `src/lib/feed-extra.functions.ts`
- `src/routes/surf.tsx`
- `src/lib/github.functions.ts`
- `src/lib/h-projects.ts`
- `src/routes/calendar.tsx`
- `src/routes/tasks.tsx`
- `docs/project-context/surf-calibration.md`
- `docs/project-context/badfit-api.md`

Portable lessons:

- Gather many source signals into a daily `SourceBundle`.
- Compile a dated journal row idempotently.
- Preserve source counts and citations.
- Use explicit fallback rows when model generation fails.
- Keep school/calendar/surf/weather/project/GitHub/social/fitness data as structured slices before rendering prose.
- Track LOC and LOMB from GitHub language byte totals.
- Render project pages from a stable catalog plus live GitHub/project context.

### badapp

Relevant patterns:

- `lib/badstack.ts`
- `app/api/mcp/route.ts`
- `app/api-mcp/page.tsx`
- `app/api/v1/digest/route.ts`
- `app/api/v1/health-intelligence/route.ts`
- `components/widgets/*`
- `project-context/knowledge/graph.json`

Portable lessons:

- Treat user-defined widgets/data as first-class API/MCP-readable resources.
- Keep domain primitives stable, then let users extend them.
- Make private API/MCP docs visible to the owner.
- Let public/private views reuse the same underlying structured objects with visibility gates.

## Core You.md Primitives

### 1. Artifact Workspace

Purpose: a polished markdown and artifact viewer/editor inside `/shell`.

Scope:

- Tree + search for identity files, custom files, reports, sources, sessions, memories, journals, and generated docs.
- Edit/preview markdown.
- Create report templates and arbitrary artifact docs.
- Preserve custom artifacts in `youJson.custom_files` until richer artifact tables exist.
- Later: backlinks, graph view, source/version provenance, citations, split view, embeddings/search.

MVP shipped in this slice:

- Files pane now has modes: `files`, `artifacts`, `reports`.
- Report/artifact templates can be staged as editable markdown custom files.
- Templates include daily briefing, project carryover, daily journal article, and public profile chat contract.

### 2. Loop Reports

Purpose: scheduled tasks that gather connected data and produce useful private reports.

Initial report types:

- Industry pulse: Perplexity-powered AI/agents/devtools/science updates for today/yesterday/this week, with citations.
- Agenda brief: calendar, tasks, personal/family commitments, school events.
- Code carryover: yesterday's commits/agent activity, per-project focus, Codex/Claude Code kickoff prompt per project.
- Connected-app pulse: BAMF.ai/BAMF OS analytics, LinkedIn/X/social, agency/client updates, other connected apps.
- Fitness/body report: Bad.app/BAD Stack data, workouts, goals, readiness, health intelligence.
- Daily journal article: generated in Houston/BAMF author voice from the above, with source counts and citations.

Storage model:

- `loopReportDefinitions`: owner, slug, cadence, prompt/skill id, source selectors, visibility, output policy.
- `loopReportRuns`: definition id, window, status, started/finished, source snapshot ids, costs, errors.
- `loopReportArtifacts`: run id, title, summary, markdown body, JSON facts, citations, visibility, publish state.

Execution model:

- One polling cron marks due loops.
- Runner gathers source snapshots through connected-app grants and provider adapters.
- Runner writes immutable source snapshots first.
- Deterministic fallback report lands if LLM generation fails.
- Expensive providers require approval/cost gate.
- Owner can publish selected artifacts or DSI components.

### 3. Source Connectors And Crawlers

Required source adapters:

- Perplexity/news research.
- Google Calendar and tasks.
- Gmail/action items later.
- GitHub repos, commits, PRs, LOC, LOMB, URLs, summaries, active project changes.
- BAMF.ai creator/social analytics: LinkedIn now, X soon.
- BAMF OS / bamf.com / bamfsite agency and client updates through API/MCP/Stack.
- Bad.app API/MCP/BAD Stack fitness, health, workout goals, readiness.
- School Google Doc crawler via Firecrawl/skill.
- Weather via Open-Meteo for hometown.
- Surf report via Open-Meteo Marine and optional Surfline-style post-processing.
- BigBounce/Hubify/BAMF blog/research crawlers.

All adapters should produce normalized `sourceSnapshots`:

- connector id
- source kind
- time window
- raw payload hash
- normalized facts
- citations/provenance
- visibility
- trust level
- cost/runtime metadata

### 4. DSI Catalog Components

Purpose: reusable data display blocks that can render privately in `/shell` and optionally publicly on profiles.

Initial DSI component types:

- Weather card.
- Surf report card.
- GitHub project catalog with AI summary, URL, GitHub link, LOC, LOMB, recent updates.
- Activity grid and agent accomplishment stats.
- Bad.app fitness/health/workout goal summary.
- BAMF.ai LinkedIn/X/social analytics summary.
- Research/blog crawler cards for BigBounce, BAMF blog, Hubify blog.
- School/family logistics card, private by default.

Visibility:

- private-only by default
- owner-approved public profile component
- context-link-only
- connected-app grant only

### 5. Public Profile Chat Widget

Purpose: above-the-fold chat input on every public You.md profile that lets humans talk to that person's public context.

Core behavior:

- Answer only from public profile context, public DSI components, public YouStacks, and owner-approved facts.
- Mimic the person's public voice and expertise without pretending to be the person in private.
- Explain uncertainty and cite profile/source context where useful.
- Do not expose private memories, private reports, private connected-app data, or owner-only logs.
- Owner can tune personality, style, topics, capabilities, and public source components through their You agent.

API/MCP surface:

- `POST /api/v1/profiles/:username/conversation`
- MCP tool: `youmd.converse_public_profile`
- Optional app-grant/private variant: `POST /api/v1/me/conversation`

Response envelope:

- `answer`
- `voice_mode`
- `sources`
- `public_context_used`
- `omitted_private_context`
- `suggested_followups`

## Implementation Order

### Phase 1 — Artifact Workspace MVP

- Upgrade Files pane into a clearer artifact workspace.
- Add report/artifact templates.
- Persist templates as `custom_files`.
- Add docs/tracking for the broader plan.

### Phase 2 — Loop Report Backend

- Add `loopReportDefinitions`, `loopReportRuns`, `loopReportArtifacts`, and `sourceSnapshots`.
- Add owner CRUD for loop definitions.
- Add polling cron and manual run action.
- Add deterministic report compiler first; LLM report compiler second.

MVP shipped in this slice:

- Added `loopReportDefinitions`, `sourceSnapshots`, `loopReportRuns`, and `loopReportArtifacts`.
- Added owner-only seed/list/create/pause/list-runs/list-artifacts/manual-run functions.
- Added an hourly due-loop cron.
- Added deterministic daily briefing compilation from You.md-owned data: agent activity, active projects, source/crawler state, pending source changes, repo mirror, and durable memories.
- Added focused Convex tests for manual and scheduled report generation.
- Surfaced generated private report artifacts in the Files pane as read-only markdown.

### Phase 3 — First Daily Brief

- Implement industry pulse, agenda, code carryover, and daily journal report.
- Reuse existing GitHub tracked-project and agent-activity tables.
- Add Perplexity/news adapter behind env/config guard.
- Save generated markdown into report artifacts and `custom_files` export if needed.

Current status:

- You.md-owned code carryover/project/source/memory/repo signals are implemented in the deterministic foundation runner.
- External adapters remain pending for Perplexity/news, Google Calendar/tasks, BAMF/BAMF OS, Bad.app, weather, surf, school, and richer journal generation.

### Phase 4 — h.computer Source Parity

- Port school crawler pattern to You.md source connector.
- Port weather tracker.
- Port surf report post-processing.
- Port GitHub LOC/LOMB project catalog.
- Port daily historical activity log.

### Phase 5 — External Product Connectors

- BAMF.ai/BAMF OS connector.
- Bad.app/BAD Stack connector.
- Blog/research crawlers for BigBounce, BAMF, Hubify, and other sources.
- Add public/private DSI component renderer.

### Phase 6 — Public Profile Chat

- Add above-the-fold chat widget.
- Add public conversation endpoint.
- Add owner personality/capability controls.
- Add app-grant/private variant for custom experiences.
- Add profile chat analytics and abuse/rate limits.

## Verification Gates

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `npm run docs:check`
- Browser QA in authenticated `/shell`
- Public profile QA for chat widget once implemented
- API smoke for report run and profile conversation endpoints

## Open Risks

- Public profile chat must be fail-closed around private context.
- Scheduled loops need cost/rate limits before external provider fan-out.
- OAuth/credential management must not become a forms-heavy SaaS flow.
- School/family, health, and client data should default to private and require explicit publication.
- Generated journal articles should preserve source counts/citations and avoid invented claims.
