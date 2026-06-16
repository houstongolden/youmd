# You.md — Build Progress & Roadmap

Last Updated: 2026-06-16
PRD Version: 2.3

---

## COMPLETED

### 2026-06-16 — Local agent auth handoff
- [x] Preserve Houston's raw prompt for fresh-machine curl install, browser auth handoff, branded success confirmation, and local agent sync/onboarding path
- [x] Add `/auth` as the clean approval URL for device login while keeping `/device` compatible
- [x] Make `youmd login` wait for Enter before opening the browser and use `you.md/auth`
- [x] Replace the plain browser completion copy with a branded success page that confirms web + local agent auth and links to `/shell`
- [x] Update the curl installer next steps around login, pull, sync, and `you`
- [x] Make the curl installer source-install from GitHub `main` by default, with npm fallback, so fresh machines receive the current local-agent runtime before npm publish catches up
- [x] Bump/build the CLI package to `0.8.2` for publish
- [x] Add a true first-run `you` onboarding branch that detects fresh auth/no local bundle and walks the user through pull/sync/skills/stacks
- [ ] Publish `youmd@0.8.2` to npm after OTP so npm installs match the curl/source runtime

### 2026-06-16 — Shell GitHub update chrome and usage surface
- [x] Preserve Houston's raw prompt for right-aligned GitHub repo chrome, one `[ update ]` action, update stream artifacts, Files/artifact library, folder.md storage, and Usage accounting
- [x] Replace the top shell refresh/publish/deploy icon cluster with one GitHub sync-status control plus one small `[ update ]` button
- [x] Hide the repo name behind the GitHub hover state and show a compact last-sync/status label next to the solid GitHub mark
- [x] Add Convex repo-mirror-derived status colors for synced, ahead/pending, behind/stale, disconnected/error, and loading states
- [x] Stream an update preflight notice into the shell chat before running the existing publish/sync action
- [x] Add a private Usage surface to the API/MCP connector page
- [x] Add folder.md 10GB storage and artifact-library positioning to the connector catalog
- [ ] Build the real update artifact with expandable steps, commit/PR message capture, history persistence, and conflict/merge resolution
- [ ] Add Settings -> Usage as a first-class account surface
- [ ] Add first-class artifact/rich-file tables and library persistence beyond `custom_files`

### 2026-06-16 — Artifact workspace and daily loop plan
- [x] Preserve Houston's raw prompt for markdown/artifact viewing, daily reports, h.computer source migration, DSI components, and public profile chat
- [x] Add the detailed implementation plan for artifact workspace, Loop Reports, source snapshots, DSI catalog components, and profile conversation API
- [x] Add `files`, `artifacts`, and `reports` modes to the shell Files pane
- [x] Add staged markdown templates for daily briefing, project carryover, daily journal article, and public profile chat contract
- [x] Add first-class loop report tables and owner CRUD for scheduled reports
- [x] Add source snapshot table and a deterministic first daily briefing runner for You.md-owned activity, projects, sources, repo mirror, pending source changes, and memories
- [x] Add hourly due-loop cron processing and focused Convex tests for manual + scheduled report generation
- [x] Surface generated private Loop Report artifacts in the Files pane as read-only markdown under `reports/generated/*`
- [x] Add owner-visible Loop Report controls in the Files/Reports workspace for definitions, recent runs, generated artifacts, default seeding, manual daily runs, and pause/resume
- [x] Add owner-only source snapshot drilldown for report runs so generated reports show their normalized facts, hashes, trust level, and capture window
- [x] Port the first h.computer weather + Venice Breakwater surf report adapters into private You.md DSI components
- [x] Port the first GitHub project catalog DSI component with tracked projects, GitHub URLs, recent commits, AI insight, and exact repo-mirror LOC/LOMB where available
- [x] Enrich the GitHub project catalog DSI with GitHub `/languages` LOC/LOMB estimates for the top tracked repos, with repo-mirror fallback when language data is unavailable
- [x] Port the first h.computer school Google Doc crawler into a private school logistics DSI component with source snapshots and Reports refresh controls
- [x] Port the first h.computer Google Calendar agenda filter into a private agenda DSI component with native bearer-token / legacy connector-gateway auth and an honest unconfigured state
- [x] Add the first private task queue DSI component from h.computer-compatible `privateContext.customData` task arrays, with Reports refresh controls and source snapshots
- [ ] Add external report adapters for Perplexity industry pulse, BAMF/BAMF OS analytics, Bad.app fitness/body, richer school calendar writeback, and external task apps
- [ ] Port h.computer historical daily log, daily journal, research/blog crawler, richer task creation/editing, BAMF/BAMF OS, and Bad.app source adapters into You.md-native connectors
- [ ] Add owner-approved public profile rendering for selected DSI catalog components
- [x] Add secure public profile chat widget and `/api/v1/profiles/:username/conversation` first slice with public-context-only answers and provenance
- [x] Add hosted MCP parity for public profile conversation through `ask_public_profile`
- [ ] Add LLM voice tuning, owner controls, and optional local MCP parity for public profile conversation endpoints

### 2026-06-16 — Connector catalog and private API/MCP control center
- [x] Turn the Connectors pane into a clear owner control center with `api/mcp`, `apps`, `crawlers/loops`, and `repo` tabs
- [x] Surface the current user's private REST/MCP/stack endpoint docs, auth header contract, resource map, and API route table inside `/shell`
- [x] Make connected-app grants visible and manageable from the dashboard using the existing `yg_` grant backend
- [x] Add a Lovable-style app connector catalog with search, categories, pinned You.md/owned-project connectors, Custom API, Custom MCP, Custom Webhook, and popular third-party services
- [x] Move GitHub repo sync into its own connector tab so it is no longer the whole Connectors page
- [x] Embed crawlers/loops beside the connector catalog, keeping native/Firecrawl/agent-browser, cron refresh, immutable versions, and approval controls visible

### 2026-06-16 — Shell collapsed logo fit
- [x] Shrink the collapsed PixelYOU mark a few pixels so the `YOU` logo fits cleanly in the skinny rail
- [x] Give the collapsed logo viewport a few more pixels of horizontal room without widening the sidebar

### 2026-06-16 — Shell opening intelligence brief
- [x] Build an opening brief from real shell context: display name, bundle version, tracked projects, private project folders, memories, recent sessions, and repo mirror status
- [x] Require the opening agent greeting to acknowledge the user by name, reference concrete recent work/activity/milestones, and suggest specific next steps
- [x] Make New Chat run the opening greeting instead of leaving only a generic system notice
- [x] Skip restoring half-empty recent sessions that have no assistant reply, preventing a stray one-word command from becoming the blank shell state

### 2026-06-16 — Shell right-panel responsiveness
- [x] Remove the redundant right-pane title/subtitle block so the top artifact chrome has one obvious tab surface
- [x] Reorder/rename right-pane tabs so `api` is promoted and `portrait` is clearer than `face`
- [x] Keep sidebar/top action chrome visible at medium widths while switching the actual chat/detail split to large screens and up
- [x] Raise the readable detail-pane minimum width and clamp saved over-wide chat ratios harder
- [x] Add profile inspector overflow/text wrapping so bios, projects, and links cannot clip horizontally
- [x] Rebalance the shell split so the right detail pane has a real minimum width and stored over-wide chat ratios clamp down safely
- [x] Move split-screen behavior to large desktop only, letting tablet/narrow desktop use the full-width shell/preview toggle instead of cramped columns
- [x] Replace the shell profile detail pane's full public-profile render with the compact actionable profile inspector
- [x] Shorten and wrap right-pane navigation labels so they remain visible at narrower pane widths
- [x] Flatten the compact profile inspector to reduce nested boxes and make actions/project/preference rows feel more seamless
- [x] Restore the left sidebar, top action chrome, and right detail split at narrow desktop widths after the responsive breakpoint regression
- [x] Add flex shrink/overflow containment so the right detail pane cannot push the shell wider than the viewport

### 2026-06-15 — You.md connected apps + connector/crawler MVP
- [x] Add first-class connected-app grants with hashed `yg_` tokens, resource scopes, action scopes, write policy, trust level, expiry, revocation, and owner CRUD queries/mutations
- [x] Extend source records with connector kind, crawler provider intent, refresh policy, visibility, trust level, next refresh, failure count, display name, and metadata
- [x] Upgrade the Sources pane into a Lovable-simple connector MVP with Website/GitHub/RSS/OKF/Webhook/JSON connector choices, native/firecrawl/agent-browser/manual provider intent, refresh cadence, visibility, and trust controls
- [x] Add an hourly cheap source-refresh marker cron that only marks due personal sources pending and does not auto-run expensive crawls/LLM work
- [x] Document the You.md-only MVP and runner plan in `project-context/CONNECTED_APPS_CONNECTORS_MVP_2026-06-15.md`
- [x] Wire `yg_` connected-app grants into HTTP/MCP auth and agent activity logging with resource/action scope checks and write-policy enforcement
- [x] Add source detail actions: refresh now, pause, set policy, provenance/version/failure view
- [x] Implement the native + Firecrawl crawler runner foundation through the existing pipeline with immutable raw versions and env-key fail-closed behavior
- [x] Add the agent-browser provider boundary as a fail-closed sandbox-required runner stub before executing browser tasks server-side
- [x] Add the first per-user/provider rate limit, cost estimate, and owner approval gate before expensive provider execution
- [x] Document the agent-browser sandbox runner boundary in `project-context/AGENT_BROWSER_SANDBOX_RUNNER_SPEC_2026-06-15.md`
- [x] Add monitored change summaries with pending-review approval before extraction
- [x] Add richer deterministic change summaries with content length, safe preview, and headings
- [x] Add the owner-facing connected-app grant/catalog UI so `yg_` grants, private API/MCP docs, custom API/MCP/webhook entries, popular connectors, crawlers, and crons are actually visible/manageable in `/shell`
- [ ] Add approval-aware writeback before cron-triggered expensive work
- [ ] Configure and verify `FIRECRAWL_API_KEY` in dev/prod, then smoke a real Firecrawl source refresh end-to-end
- [ ] Implement the actual agent-browser sandbox worker with action transcripts, screenshot artifacts, and secret/permission boundaries

### 2026-06-15 — h.computer idea routing into You.md
- [x] Read the creator-new routing memo, local h.computer protocol/vision docs, live h.computer platform/docs/gallery pages, and active You.md context docs
- [x] Add `project-context/PERSONAL_API_MCP_AND_YOUSTACKS_MEMO_2026-06-15.md` to route personal API/MCP, connector UX, source refresh, skill learning, host adapters, model routing, and gated identity access into You.md
- [x] Update PRD, Architecture, Features, and active request tracking so You.md is documented as the canonical personal API/MCP + portable expertise-stack layer and h.computer is the consumer/reference implementation
- [x] Add 2026-06-16 prompt/context capture after Houston re-shared the h.computer/Creator.new boundary before removing h.computer pages
- [x] Update PRD, Architecture, YouStacks Product Layer PRD, Current State, Features, Changelog, active requests, and prompt archive so the "durable agent brain + personal API/MCP + YouStacks" language is preserved in the right home
- [ ] Define the versioned personal API/MCP resource contract for `identity`, `now`, `projects`, `sources`, `memories`, `preferences`, `trust_rules`, `stacks`, and `activity`
- [x] Design and implement the first connected-app grant substrate for You.md-native scoped reads/writes, expiry/revocation, trust level, and access preview metadata
- [x] Build the first Lovable-simple connector UX MVP for Website, GitHub, RSS, OKF, Webhook, and JSON source setup
- [ ] Extend source refresh into monitored updates: per-source policy, source health, change summaries, approval/writeback, and freshness states
- [ ] Design the skill-learning loop from screen recordings/transcripts/SOPs/agent logs into draft YouStack skills, workflows, prompts, docs, tests, and adapter updates
- [ ] Extend YouStack manifests/adapters with stack-level model routing policy: orchestrator, lead, workers, fallbacks, BYOK/provider preferences, cost posture, risk thresholds, and approval gates

### 2026-06-14 — OKF graph + view + immutable sources
- [x] Concept graph cross-linking: `related` edges derived from real structural relationships, round-trip-preserved, stack-manifest hub, orphan detection respects the graph
- [x] Brain view: framework-agnostic `buildBrainView` model + dependency-free terminal-native HTML (`youmd okf view`) — desktop-client seed + web-consistent model
- [x] Immutable-source enforcement in the Convex ingestion pipeline: content-addressed `rawSourceVersions` append-only ledger + `recordRawSourceVersion` (version-on-change, never overwrite), wired into all fetch paths; fixed compiled-bundle provenance (real source URLs in `meta.sources_used`/`linked_sources` + manifest). 389 convex tests green.
- [ ] Owner/CI: run `npx convex codegen` + `tsc -p convex/tsconfig.json` + Convex deploy for the new `rawSourceVersions` table, then verify the live pipeline records versions and bundles carry source URLs

### 2026-06-13 — OKF integration
- [x] Add `youmd okf health` brain-health audit (orphans, stale, un-sourced, low-confidence/needs-review, `[CONFLICT]`/`[STALE]`, missing type; 0-100 score) — Familiar graph-health pattern, OKF-native, no cron/inbox machinery
- [x] Add provenance frontmatter (`last_updated_by`/`confidence`/`linked_sources`) to OKF concepts — Familiar pattern #1, stampable on export (`--author`/`--confidence`), preserved through round-trips; skipped the Familiar cron/inbox stack as redundant complexity
- [x] Add a pure OKF core library (serialize/parse concept files, conformance validation, `index.md`/`log.md` builders) for `okf/v0.1`
- [x] Add identity bundle ↔ OKF export/import with lossless round-trip (`youmd_kind` routing), including installed skills
- [x] Add YouStack → OKF export (manifest concept + typed files), carrying `youstack.json` alongside for installability
- [x] Add `youmd okf export|import|validate` command + `youmd export --okf` shortcut with `--json`/`--stack`/`--out`/`--no-skills`
- [x] 30 OKF tests green; CLI build clean; end-to-end CLI smoke (identity + stack export → conformant; import round-trip)
- [x] Write `project-context/OKF_INTEGRATION.md` (design + cross-machine MacBook Air/Mac mini test runbook)
- [ ] Houston: run the cross-machine end-to-end test on the two new Macs (steps in `OKF_INTEGRATION.md`)
- [ ] Owner-only: bump CLI version + update root AGENTS.md/CLAUDE.md version markers + `npm publish` when ready to release

### 2026-06-13
- [x] Pull remote `main` to `376f967`, reapply local artifacts cleanly, and confirm there were no merge conflicts
- [x] Audit the newly landed public stack registry/install, hosted MCP registry + subscribe support, outbound webhooks, generated docs, and backlog/reference-intelligence updates
- [x] Rename the Convex-side capability router module to `convex/lib/capabilityRouter.ts` so `npx convex codegen --typecheck enable` can bundle/deploy it
- [x] Fix CLI round-trip decompile so a handle-only `username` does not become a fake `identity.name`
- [x] Replace the `/docs` telemetry panel arbitrary radius with the design-system radius token
- [x] Regenerate generated agent docs for the 2026-06-12 reference-intelligence state
- [ ] Push the follow-through commit and watch production/CI deploy results
- [ ] Operator: keep GitHub OAuth/App/webhook production secrets registered and verify the new registry/webhook flows against production credentials

### 2026-06-09
- [x] Re-run the daily reference-intelligence loop, archive stale Codex automation threads first, and version the fresh `project-context/reference-intelligence/LATEST.md` + `TASKS.md` outputs
- [x] Write `project-context/REFERENCE_INTELLIGENCE_AUDIT_2026-06-09.md` so the Jun 9 upstream signals become durable You.md follow-up work instead of staying only in generated files
- [x] Update roadmap/tracking docs for the Jun 9 reference-intelligence wave
- [x] Harden public profile portrait rendering: default `/profiles` to grid, render stored ASCII first, fall back to real image/terminal initials instead of blank boxes, and add static + runtime portrait audits
- [x] Add same-origin `GET /api/v1/profiles` proxy plus a monthly Convex portrait-refresh cron so public profile payloads and directory/profile pages share the same portrait contract
- [x] Capture the low-cost public-profile crawler/indexing direction in `project-context/PUBLIC_PROFILE_INDEXING_AND_REFRESH_PLAN.md`
- [x] Add the first public-profile indexing foundation: source ledger, refresh-job/import-batch tables, 50-target AI/SaaS/builder catalog, admin dry-run/import route, native metadata refresh action, daily Convex refresh cron, and `profiles:targets-check`
- [ ] Audit current YouStacks maintainer/adapter docs for a deterministic review artifact and unresolved-decision contract
- [ ] Audit protected retrieval and repo-mirror read paths for fail-closed multi-source grant enforcement plus malformed-frontmatter resilience
- [ ] Deploy the public profile portrait/API/crons patch to production and run `npm run profiles:portrait-audit -- --base-url https://www.you.md` plus `npm run profiles:portrait-audit:pages -- --base-url https://www.you.md`
- [ ] After deploy, run the admin public-profile dry-run for all 50 seed targets, inspect skipped/created/patch results, then run the real import only if the dry-run is clean
- [ ] Extend public-profile refresh beyond native HTML metadata into cheap extractor routing, source-backed profile compilation, and cost-capped LLM enrichment

### 2026-06-04
- [x] Add free GitHub OAuth signup foundation (Phase 1): `githubConnections` table, `convex/github.ts` find-or-create + connection + repo-link, `/api/auth/github/start` + `/callback` routes reusing the opaque-session/JWKS path, and "continue with github" on sign-in + sign-up
- [x] Encrypt the GitHub OAuth token at rest via shared `convex/lib/secretCrypto.ts` (AES-GCM)
- [x] Write `project-context/GITHUB_OAUTH_SETUP.md` (operator runbook) and `project-context/GITHUB_NATIVE_PLAN.md` (full vision + Phases 1–5)
- [ ] **Operator:** register the GitHub OAuth App + set `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` (scopes must include `repo`), deploy Convex + Vercel from `main`, verify signup/sign-in end-to-end
- [x] Phase 2 — connect/create the user's You.md repo (public/private) + seed it: `convex/githubRepo.ts` actions (create/connect/list) + `GithubRepoSection` in the Settings pane
- [x] Phase 3 (first slice) — repo↔bundle sync: `pushToRepo` / `pullFromRepo` actions + push/pull controls in the Settings pane (last-writer-wins, `lastSyncedSha` tracking)
- [x] Phase 3 follow-up — webhook auto-pull on external push (`POST /api/github/webhook`, HMAC-verified, auto-registered on create/connect)
- [x] Phase 4 (first slice) — server-side `repoMirror` (identity + `stacks/**`), `syncMirror`, and authenticated `GET /api/v1/me/repo/files` + `/stacks` so API/MCP read from our servers
- [x] Phase 3/4 follow-up — MCP tools `get_my_stacks` + `get_repo_file`, `get_identity` includes public `repo_stacks`, and the public profile renders repo-hosted stacks (public repos only, via `getPublicRepoStacks`)
- [x] Phase 5 follow-up — installation-token caching (encrypted, reused until ~1 min before expiry) + `installation` webhook revocation (`deleted`/`suspend` clears installation + cached token)
- [x] Private-file safety — `private/**` explicitly excluded from the server mirror (belongs in the zero-knowledge vault, not plaintext)
- [ ] Remaining follow-ups (own slices, some need product/security decisions) — `private/*` ↔ vault sync (client-side E2E), 3-way merge/diff on push, larger-repo mirror handling, App-first auth option; register the OAuth App (+ optional GitHub App) and verify e2e
- [x] Pull/merge remote `main` through GitHub-native Phase 4 first slice, preserve local reference-intelligence artifacts, regenerate stale agent docs and Convex bindings, and audit owner-only setup
- [x] Fix local GitHub OAuth development redirects to use this repo's frontend port `3100` instead of stale `3000` defaults
- [x] Upgrade Next.js patch version from `16.2.2` to `16.2.7` and update root agent-manual stack markers
- [ ] Phase 3/4 follow-ups — 3-way merge, sync `private/*` to vault, wire MCP server + public profile to read stacks from the mirror
- [ ] Phase 5 — harden OAuth App → GitHub App (fine-grained per-repo perms)
- [ ] Investigate local `next build` hang on this machine; `next typegen`, TypeScript, Convex typecheck, docs CI, targeted lint, and CLI tests pass, but production build stalls before route output

### 2026-06-03
- [x] Re-sync reference intelligence and version the new `project-context/reference-intelligence/LATEST.md` + `TASKS.md` artifacts from the 2026-06-03 upstream wave
- [x] Write `project-context/REFERENCE_INTELLIGENCE_AUDIT_2026-06-03.md` to turn the raw 13-task queue into a You.md implementation order across stack safety, brain sync resilience, retrieval/readiness, and runtime-health boundaries
- [x] Land a repo-visible docs/contract improvement from the Jun 3 reference-intelligence follow-up list
- [x] Enforce shell-safe `youstack` slugs/capability ids plus single-line metadata warnings before adapter generation
- [ ] Audit remaining `youmd stack` host adapters/runtime helpers for broader cached shell-identifier sanitization and local-only metadata guarantees
- [x] Add explicit readiness envelopes for local stack CLI/MCP reads so agents can distinguish `not_found`, `invalid`, and `ready`
- [x] Add retrieval readiness + fallback guidance to MCP `search_memories` so protected memory reads stop failing as opaque empty arrays
- [x] Extend protected-memory retrieval honesty beyond MCP `search_memories` into MCP memory resources and startup brief context
- [x] Teach the stack capability contract and generated adapters the protected-read readiness states and fallback order
- [x] Add the missing protected private-context MCP tool/resource with the same readiness and fallback contract as memory retrieval
- [x] Add explicit readiness envelopes for MCP project-context reads and project resources so missing project context stops surfacing as ad hoc plain-text errors
- [ ] Define broader protected-brain retrieval fallback behavior beyond current memory/private-context stack contracts
- [ ] Design resumable checkpoint + watchdog behavior for long-running brain/source sync work

### 2026-06-02
- [x] Add `--json` / `agent-docs:handoff:json` support for machine-readable agent-docs handoff checker output
- [x] Split the long `agent-docs:ci` package script into reusable `agent-docs:syntax`, `agent-docs:handoff`, and `agent-docs:lint` commands
- [x] Add file/required-marker/forbidden-marker success diagnostics to `scripts/check-agent-doc-handoff.mjs`
- [x] Make `scripts/check-agent-doc-handoff.mjs` enforce the expanded `/docs#agent-docs` PRD/architecture, stale stack/auth, and required/forbidden marker wording that live smoke already checks
- [x] Split `/llms-full.txt` source-repo guardrail markers into their own live smoke check
- [x] Publish expanded handoff-checker scope in generated `/llms-full.txt`, `/docs#agent-docs`, and live smoke expectations
- [x] Add forbidden stale stack/auth marker support to `scripts/check-agent-doc-handoff.mjs`
- [x] Remove stale Clerk-era auth provider wording from active `project-context/ARCHITECTURE.md` and `project-context/PRD.md`
- [x] Extend `scripts/check-agent-doc-handoff.mjs` and `.github/workflows/agent-docs.yml` to guard active PRD/architecture auth markers
- [x] Align root `AGENTS.md` and `CLAUDE.md` tech-stack/auth rows with current Next, Motion, Convex, and first-party passwordless auth reality
- [x] Extend `scripts/check-agent-doc-handoff.mjs` to derive root manual stack-version markers from `package.json`
- [x] Make `scripts/check-agent-doc-handoff.mjs` derive root agent-manual CLI version markers from `cli/package.json`
- [x] Correct stale `project-context/ARCHITECTURE.md` CLI package version reference to `v0.6.23`
- [x] Extend `scripts/check-agent-doc-handoff.mjs` so local CI verifies `/docs#agent-docs` source markers too
- [x] Update `/docs#agent-docs` with README, `AGENTS.md`, `CLAUDE.md`, handoff marker script, and `agent-docs:ci` guidance
- [x] Extend live docs-page smoke checks to require source-repo handoff markers
- [x] Add source-repo handoff guidance to generated `/llms.txt` and `/llms-full.txt`
- [x] Extend `npm run llms:smoke` to verify generated source-repo handoff markers in production
- [x] Add `scripts/check-agent-doc-handoff.mjs` to assert README, `AGENTS.md`, and `CLAUDE.md` keep generated-doc URLs and release-check commands
- [x] Wire the handoff marker check into `npm run agent-docs:ci`
- [x] Expand `.github/workflows/agent-docs.yml` path filters so README and root agent manuals trigger the agent-docs guardrail
- [x] Add generated-docs preflight blocks to root `AGENTS.md` and `CLAUDE.md` so future coding agents start from `/llms.txt`, `/llms-full.txt`, docs reference, OpenAPI, MCP discovery, and stack capabilities
- [x] Correct stale root agent-manual CLI version references to `youmd 0.6.23`
- [x] Add a README "For Agents" handoff to the generated `/llms.txt`, `/llms-full.txt`, docs reference, OpenAPI, MCP discovery, stack capabilities, and release smoke commands
- [x] Correct README frontend dev-server guidance to port 3100
- [x] Add path-scoped GitHub Actions coverage for generated agent docs drift checks
- [x] Add `npm run agent-docs:ci` to bundle docs checks, generator syntax checks, smoke-script syntax checks, and targeted lint
- [x] Add `npm run llms:smoke` for live/local verification of root agent docs, docs reference, MCP discovery, robots, sitemap, and `/docs#agent-docs`
- [x] Verify `llms:smoke` against both `https://www.you.md` and `http://localhost:3100`
- [x] Add `npm run codex:chat-hygiene` and hard-archive completed daily-reference automation threads into `~/.codex/archived_sessions`
- [x] Add a generated `llms.txt` / `llms-full.txt` pipeline that derives root agent docs from the generated docs reference and reference-intelligence state
- [x] Add `npm run llms:generate` and `npm run llms:check`, and wire them into `docs:generate` / `docs:check`
- [x] Refresh reference intelligence while generating agent docs and confirm no new upstream task candidates
- [x] Verify generated agent docs with docs checks, TypeScript, targeted ESLint, ASCII scan, whitespace checks, and local HTTP smoke
- [x] Add root-level agent-readable docs surfaces with `public/llms.txt` and `public/llms-full.txt`
- [x] Wire agent docs into `/docs#agent-docs`, `robots.txt`, and `sitemap.xml`
- [x] Verify the new agent docs with docs reference check, TypeScript, targeted ESLint, whitespace checks, and local HTTP smoke on `localhost:3100`
- [x] Consolidate recurring Codex automation chat clutter for You.md by pausing the duplicate daily reference-intelligence automation, documenting chat-hygiene policy, hard-archiving completed automation threads while preserving transcript files, and adding a reusable cleanup command for future runs
- [x] Re-sync reference intelligence, confirm the current loop emits no new task candidates, and version the refreshed `project-context/reference-intelligence/LATEST.md` + `TASKS.md` artifacts
- [x] Archive the Jun 2 daily-reference session prompts and update project-context tracking for the new "always version these artifacts" expectation

### 2026-06-01
- [x] Keep the homepage minimal (Hero + CTA/footer) while upgrading `/docs` into a BAMF-style API/MCP/stack documentation surface
- [x] Add a `/docs` surface map for Start, API, MCP, Stacks, Workflows, and generated Reference paths
- [x] Add an explicit API/MCP/Stack docs standard covering guide, API, MCP, stack, and smoke surfaces for each important capability
- [x] Update docs reference-intelligence copy so Agent Scripts and The Library sit beside GStack/GBrain as monitored upstream inspirations
- [x] Verify the docs/homepage pass with docs check, targeted ESLint, TypeScript, local page smoke, protected-route redirect smoke, MCP discovery, and redirect sanitizer checks
- [x] Expand reference intelligence from GStack/GBrain to also monitor `steipete/agent-scripts` and `disler/the-library`
- [x] Write `project-context/AGENT_STACK_UPSTREAM_AUDIT_2026-06-01.md` with the You.md translation, gaps, and next implementation slices
- [x] Update YouStack starter/maintainer skills with pointer-catalog, typed dependency, source-of-truth, and upstream-aware maintenance guidance
- [x] Add README hat-tip credits and mostly-open-source / hosted-protected-boundary direction

### 2026-05-30
- [x] Re-sync GStack/GBrain reference intelligence and refresh `project-context/reference-intelligence/*`
- [x] Simplify the marketing homepage to a minimal, intentional flow (remove section sprawl)
- [x] Harden `/sign-in` + `/sign-up` `next` redirect handling to prevent protocol-relative open redirects (`next=//...`)
- [x] Add defensive fetch timeouts + Tailwind content scoping to prevent Next build stalls; verify `npm run build` under Node 20

### 2026-05-28
- [x] Finish the product-language cleanup across remaining app metadata, auth/onboarding copy, docs snippets, profile/share surfaces, dashboard panes, README, PRD, schema comments, and sample profiles; deploy and production-smoke on Vercel deployment `dpl_D2ZEuhDf5LUQFzW8JToASft64e5m`

### 2026-05-27
- [x] Simplify the product model across homepage, docs, public profile, dashboard labels, README, and PRD around Brain -> Stacks -> Runtime -> Protected API/MCP
- [x] Reframe the curl installer as the You.md runtime install rather than a CLI-first install, including source install, fallback npm install, native skill install, stack runtime notes, and `youmd-auto-upgrade`
- [x] Add bundled `youstack-maintainer` so agents can organize, improve, update, smoke, and prepare private/public visibility changes for named YouStacks
- [x] Add `youmd stack doctor` as a read-only diagnostic pass for named YouStacks, including built-in routing, BAMFStack lighthouse coverage, docs, README, and maintainer-skill guidance
- [x] Add a `/stacks` shell/dashboard pane plus profile rendering rules for named private/scoped/public YouStacks
- [x] Add the public-safe `cli/examples/youstack-bamfstack-public` lighthouse with manifest, skill, workflow, prompt, quickstart, smoke test, update policy, improvement policy, and public-readiness routing
- [x] Create the daily local `Daily GStack/GBrain Reference Sync` automation and re-sync references to latest GStack `19770ea` / GBrain `42d99b6`
- [x] Add local GStack/GBrain reference intelligence monitoring with ignored clones, latest upstream summaries, and generated You.md task queues
- [x] Update homepage/docs so YouStacks are explicitly GStack-guided and the You.md brain is explicitly GBrain-guided
- [x] Deploy and production-verify the GStack/GBrain reference intelligence docs/homepage update on Vercel deployment `dpl_4UwpUiK2vUPYu8R9nj8dfnBDpq9M`
- [x] Add first-class named YouStack portfolio support to the manifest/docs model so users can keep separate coding, scientific research, content creation, and other domain stacks
- [x] Add explicit YouStack self-improvement and update policy fields, CLI inspect/smoke output, built-in route capabilities, docs examples, and production verification
- [x] Rework the YouStacks homepage copy around the clearer "build your own GStack for any agent" mental model
- [x] Rework the `/docs#youstacks` introduction around packaged expertise, shareable stacks, and your own GStack-style agent operating system
- [x] Add a docs "What Goes In" subsection covering skills, workflows, taste/examples, and protected capabilities
- [x] Tighten YouStacks copy again around the exact analogy: Gary Tan's GStack as years of experience, specialist agents, workflows, taste, and review loops packaged into a stack
- [x] Verify the clarified copy with docs check, targeted lint, TypeScript, Webpack production build, local production smoke checks, and Codex in-app browser review
- [x] Deploy and production-verify the clarified YouStacks homepage/docs copy on Vercel deployment `dpl_EyuaBhd5yXGFrw5eAGu2eBqZ46su`

### 2026-05-26
- [x] Add a first-class YouStacks section to the homepage with brain-vs-stack positioning, local-first files, protected API/MCP boundary, use cases, docs CTA, and example stack command
- [x] Expand `/docs` into a fuller YouStacks chapter covering overview, use cases, CLI, install flow, manifest, examples, API/MCP threshold, generated endpoint reference, and local MCP stack tools
- [x] Update generated docs/OpenAPI categorization so stack endpoints appear under `YouStacks` with useful summaries instead of generic `Other`
- [x] Verify the homepage/docs update with docs generation/check, targeted lint, TypeScript, production build, local production server smoke checks, and headless Chrome screenshots/text checks
- [x] Deploy and production-verify the YouStacks homepage/docs update on Vercel deployment `dpl_7b6X4k3R6JahR7F3jqFdbgJXN5S1`

### 2026-05-25
- [x] Harden the GitHub Actions trusted publishing workflow to current npm Trusted Publishing guidance (`actions/checkout@v6`, `actions/setup-node@v6`, disabled setup-node package-manager cache)
- [x] Normalize `cli/package.json` repository metadata back to the canonical `git+https://github.com/houstongolden/youmd.git` URL after npm warned about auto-correction
- [x] Retry the `youmd@0.6.23` trusted publish workflow; dependency install, CLI tests, and CLI build passed, then `npm publish` remained blocked by npm `E404 Not Found / no permission`
- [x] Verify local npm auth state and the new npm trusted-publisher CLI path: `npm whoami` is unauthenticated, the dry-run trusted-publisher command targets the right package/repo/workflow, and the real command is blocked by npm `E401` until an authenticated package owner completes it
- [x] Re-verify production after the publish-infra push: Vercel deployment `dpl_Eku5BV118Ww7W8tgehuHqy5axNKU` is ready and aliased, and live stack capabilities plus docs reference endpoints return the expected YouStacks contracts

### 2026-05-24
- [x] Implement the first YouStacks local foundation: `youmd stack inspect`, `smoke`, `capabilities`, and `route`
- [x] Add the `youstack/v1` TypeScript manifest model, validation, smoke checks, deterministic routing, and local capability extraction
- [x] Add a sample private personal YouStack under `cli/examples/youstack-personal`
- [x] Add focused YouStack CLI tests and verify the stack commands against the built CLI
- [x] Add `youmd stack link` for Claude Code, Codex, and Cursor host adapter generation with dry-run support
- [x] Expose local YouStack MCP resources/tools for manifest inspection, capability listing, request routing, and read-only smoke validation
- [x] Add shared read-only HTTP endpoints for YouStack capability contracts and deterministic request routing
- [x] Update `/docs`, generated API/MCP references, and CLI help for the new YouStack surfaces
- [x] Bump the CLI release target to `youmd@0.6.23` and regenerate docs reference data
- [x] Deploy and production-verify the YouStacks web/API/docs surfaces on `https://www.you.md`
- [x] Trigger the trusted npm publish workflow for `youmd@0.6.23`; workflow install/tests/build passed before npm permission failure

### 2026-05-23
- [x] Preserve the YouStacks product-layer brief in `project-context/YOUSTACKS_PRODUCT_LAYER_PRD.md`
- [x] Audit the existing You.md web, CLI, MCP/API, Convex schema/routes, memory/private-context, project-context, skills, sharing, and GitHub/source/sync surfaces before any product implementation
- [x] Review GStack and BAMFStack as reference patterns for local-first stack install, host adapters, capability discovery, route selection, smoke tests, docs, and sync discipline
- [x] Create `project-context/YOUSTACKS_IMPLEMENTATION_PLAN.md` with current feature inventory, keep/repurpose/expand/modify/defer classifications, YouStack schema, GitHub sync design, API/MCP threshold, adapter model, and bisectable phases
- [x] Houston continued the YouStacks planning work into implementation in the May 24 follow-up request

### 2026-05-22
- [x] Add a YouStack startup MCP brief for local agents via `get_agent_brief` and `youmd://agent/brief`
- [x] Add the bundled `youstack-start` skill and make it the first recommended skill for local Claude/Codex/Cursor sessions
- [x] Sync the 7-skill catalog across CLI defaults, backend seed data, SkillsPane copy, web-agent prompt copy, README, docs copy, and generated docs reference
- [x] Add focused CLI test coverage for MCP agent-brief extraction from `AGENTS.md` and `project-context/`
- [x] Verify the local pass with the focused CLI test, CLI TypeScript build, temp-HOME skill catalog smoke test, docs reference check, and root Next production build
- [x] Upgrade `/docs` from a single guide into a broader developer platform surface with concepts, context surfaces, agent workflows, playbooks, examples, API/MCP reference, schema guidance, docs automation, and troubleshooting
- [x] Add generated docs reference data from Convex HTTP routes, Next routes, and CLI MCP tools so endpoint/tool inventories refresh during builds
- [x] Add `GET /api/v1/docs/reference` and `GET /api/v1/docs/openapi.json` for machine-readable docs/reference consumers
- [x] Wire `npm run docs:generate` into `prebuild` and add `npm run docs:check` so release paths catch stale docs artifacts
- [x] Verify the docs upgrade with docs generation/check, targeted ESLint, `npx tsc --noEmit`, production `npm run build`, and desktop/mobile browser QA on `localhost:3100/docs`

### 2026-05-19
- [x] Complete a design-system cleanup pass for the marketing homepage and app UI without changing product behavior
- [x] Add shared `Container`, `Section`, `SectionHeader`, `Button`, `Card`, `TerminalCard`, `FormField`, `Input`, `Textarea`, `Select`, `Label`, `FieldHelp`, and `FieldError` primitives
- [x] Refactor the homepage into a compact conversion flow with one primary hero CTA, compressed profile proof, problem, how-it-works, inside, integrations, open-standard, pricing, FAQ, and final CTA sections
- [x] Normalize app controls and spacing across terminal auth/input, install tabs, dashboard tabs, pane headers, empty states, sources, share, private context, files, settings, and edit surfaces
- [x] Run production build, targeted lint, and live Chrome desktop/mobile visual QA on the local production server
- [x] Fix `/profiles` public directory quality: canonical dedupe, QA/test suppression, stored ASCII portrait rendering, sanitized avatar URLs, and deterministic nonblank fallbacks
- [x] Harden profile seed/backfill/cleanup and enrichment so future unclaimed public-profile crawling avoids duplicate/orphan rows and does not persist third-party API keys in public image fields
- [x] Visually QA `/profiles` list/grid, homepage profile proof, and an unclaimed public profile in the in-app browser on `localhost:3000`

### 2026-04-18
- [x] Add a real `you` command entrypoint that launches U directly, shows Houston's ASCII portrait-in-code, and feels closer to Claude/OpenClaw than a dry utility
- [x] Make conversational startup work from the home bundle in `~/.youmd` so `you` / `youmd chat` still work outside a project-local `.youmd/`
- [x] Make bare `youmd`, `youmd chat`, and npm postinstall feel more alive and U-like instead of dropping users into a dead utility experience
- [x] Preserve richer preference/directive markdown across identity push → pull roundtrips so saved agent-behavior instructions do not get flattened away
- [x] Extend home-bundle fallback parity to read-only bundle commands so `status`, `diff`, `export`, and `preview` work like `you`
- [x] Make the `you` launcher actually investigate local context with a live braille spinner before it talks, then report concrete findings instead of bluffing that it already "looked around"
- [x] Make the startup portrait prefer the live profile contract over stale cached avatar fallbacks, and expose the stored public ASCII portrait on the public payload so CLI/web can match more closely
- [x] Align installer + register/init/onboarding guidance around `you` so new users are consistently pointed at the alive entrypoint instead of the older `youmd chat` muscle memory
- [x] Make `youmd chat` use the same local proactive opener as `you` instead of delegating the first greeting to a remote model that can bluff about local capabilities
- [x] Add a local host-tool bridge for `start there` so U can act on its own strongest project suggestion, execute the local bootstrap, and send the tool result back through the remote model
- [x] Add a local host-tool bridge for marker-based recent-work scanning so U can answer “what have I been working on lately?” from real filesystem state with a remote-model final response
- [x] Expand the bridge into a real local tool loop so U can choose among `discover_projects`, `read_project_context`, `write_project_context`, `sync_identity`, and `respond` instead of only handling two hardcoded intents
- [ ] Publish `youmd@0.6.23` so end users get the `you` launcher, compact portrait splash, paced startup investigation, public-profile portrait contract fix, update hints, read-only active-bundle fallback, raw-markdown identity roundtrip preservation, marker-based recent-project opportunity scanning, broader local workspace repo awareness, local host-tool execution, the stronger onboarding handoff into U, smaller portrait bounds, first-run setup guidance, the deeper home-level context sweep, the local YouStack manifest/link/MCP surfaces, a much more concise strongest-move opener, and the new local tool loop
- [x] Rebuild the CLI at `0.6.22`, align runtime/MCP version strings, and remove compiled test artifacts from the npm package before the publish attempt
- [x] Add a Trusted Publishing workflow so agents can publish the CLI through GitHub Actions without a long-lived npm token or interactive OTP prompts
- [ ] Configure npm Trusted Publishing / package permissions for package `youmd` with GitHub owner `houstongolden`, repository `youmd`, workflow `publish-cli.yml`, and publish permission, then rerun `npm run publish:cli` (May 24 and May 25 retries for `0.6.23` passed install/tests/build, then failed at `npm publish` with `E404 Not Found / no permission`; exact CLI command is `npx npm@11.15.0 trust github youmd --repo houstongolden/youmd --file publish-cli.yml --allow-publish --yes`, but it requires npm login + 2FA)
- [x] Make local `you` + `start` read real project files and surface concrete action items from TODO/current-state docs instead of blocking, hallucinating, or asking the user to paste an `ls`
- [x] Make `continue`, `more`, and "next strongest move" stay on the deterministic local project-context path instead of falling through to the remote model and drifting into stale profile context
- [x] Rank and display the real release unblocker in the initial `you` opener, not only after the user types `start`
- [x] Add and test Codex MCP install support (`youmd mcp --install codex --auto`) so Codex can use You.md through the same safe published-package launcher as Claude/Cursor
- [x] Migrate local Claude and Codex MCP configs from `npx youmd mcp` to `npx --yes youmd@latest mcp`, with backups
- [x] Fix MCP home-bundle fallback so agents launched from repos without local `.youmd/` still get Houston's identity and skills from `~/.youmd`
- [x] Verify installed-package MCP behavior over stdio: initialize, tools/list, whoami, and use_skill all work
- [ ] Build a truly proactive first-run U flow after install/login instead of relying only on better static startup copy
- [ ] Do one live browser QA pass on `/initialize` to tune spacing, logo scale, and portrait/bot balance on desktop + mobile now that the full scene composition exists
- [ ] Verify the `you` splash now matches Houston's current primary/public portrait after the new `_profile.asciiPortrait` contract ships to production

### 2026-04-17
- [x] Make newly minted API keys revealable/copyable again without weakening hash-based auth validation
- [x] Hide revoked API key history behind an explicit toggle so the settings pane defaults to the real live-key state
- [x] Consolidate the shell preview pane nav into grouped primary labels with small secondary tabs where needed
- [x] Normalize the CLI publish version to 0.6.1 across package.json, package-lock, runtime version output, and built artifacts

### Foundation (March 16-17)
- [x] Next.js 16 + Convex + Clerk + Tailwind v4 scaffold
- [x] Full Convex schema (21 tables)
- [x] First-party passwordless auth (production: you.md sessions)
- [x] Vercel deployment (you.md custom domain)
- [x] Convex production (kindly-cassowary-600) + dev (uncommon-chicken-142)
- [x] Landing page with 12 sections
- [x] CLI package scaffolded + published to npm
- [x] Bundle compilation (convex/lib/compile.ts)
- [x] Ingestion pipeline (fetch, extract, analyze, compile)
- [x] API key management (SHA-256 hashed, ym_ prefix)
- [x] Context links (token-based, TTL, scope)
- [x] HTTP API (public + authenticated endpoints)
- [x] LLM chat proxy (convex/chat.ts via OpenRouter)

### Design System Migration (March 18-19)
- [x] PRD v2.3 monochrome + burnt orange (#C46A3A)
- [x] JetBrains Mono + Inter typography
- [x] Dark mode default, .light class toggle
- [x] Terminal panels, CLI pills, glass nav
- [x] PixelYOU canvas logo
- [x] ASCII portrait system (HeroPortrait, AsciiAvatar, Generator)
- [x] FadeUp animation, boot sequence typewriter
- [x] Terminal-style auth pages (no forms — sequential prompts)
- [x] Border radius standardized to 2px

### Terminal-First Architecture (March 19-21)
- [x] useYouAgent hook — extracted all agent logic (2000+ lines)
- [x] Terminal components (Shell, MessageBubble, ThinkingIndicator, Input, StatusBar)
- [x] /initialize route — boot sequence + onboarding
- [x] Split-screen dashboard — 35% terminal left, 65% pane right
- [x] 4-pane system: profile, edit (files/json/sources), share, settings
- [x] Slash commands switch panes (/profile, /edit, /share, /settings)
- [x] Unified SiteNav top bar (replaced AppNav side panel)
- [x] Mobile responsiveness (terminal full-width, toggle for pane)
- [x] Sign-up → /initialize → dashboard redirect chain
- [x] Convex auto-deploy GitHub Action

### Memory & File System (March 22)
- [x] Markdown file vault (browse, edit, save identity files)
- [x] Memory system (auto-capture, recall, /memory + /recall commands)
- [x] Memory HTTP API (GET/POST /api/v1/me/memories)
- [x] Session tracking + summaries
- [x] Memory archival policies
- [x] CLI memory sync (youmd memories list/add/stats)

### Agent Intelligence (March 23-24)
- [x] Claude Code-style progress indicators (step-by-step activity log)
- [x] Streaming LLM responses via SSE
- [x] Persistent chat sessions (survive page refresh)
- [x] Dashboard simplified from 12 to 4 panes
- [x] Share pane with agent-specific prompt templates
- [x] Agent directives system (communication_style, negative_prompts, etc.)
- [x] Intelligent model routing (Claude/Perplexity/Grok per task)
- [x] Identity verification via Perplexity
- [x] Proactive agent behavior ("always building" philosophy)
- [x] Session compaction (120k char limit → summarize)
- [x] Input history (arrow keys)

### Portrait System (March 24)
- [x] Multi-image scraping (all sources saved to socialImages)
- [x] 4 ASCII formats (classic, braille, block, minimal)
- [x] Detail picker (60/80/100/120/160 columns)
- [x] Tap-to-select primary image source
- [x] Real photo + ASCII preview side by side
- [x] Server-side ASCII portrait generation + DB caching
- [x] Portrait pane wired to real data

### SEO/AEO (March 24-25)
- [x] SSR on all public pages (profiles, profile, landing, docs)
- [x] JSON-LD structured data on profiles
- [x] OG social cards per profile
- [x] Dynamic sitemap.xml (all profiles)
- [x] robots.txt
- [x] Canonical URLs on all pages
- [x] AI agent user-agent detection (serves plain text)
- [x] Profile breadcrumbs + rel=me links

### Skill System (March 27)
- [x] 21 commands (added `skill` with 12 subcommands)
- [x] Skill catalog (youmd-skills.yaml) with YAML parser/writer
- [x] Brain-aware template engine ({{var}} -> brain data)
- [x] 4 bundled skills: claude-md-generator, project-context-init, voice-sync, meta-improve
- [x] Install/remove/use/sync/link/init-project/improve/metrics/search commands
- [x] Batch install/remove (youmd skill install all)
- [x] Cross-project sync hooks (push/pull/sync auto re-interpolate)
- [x] Agent linking (Claude Code, Cursor, Codex target directories)
- [x] CLAUDE.md merge (appends identity section to existing files)
- [x] Meta-improvement (identity coverage bars, actionable proposals)
- [x] Skills integrated into onboarding flow (youmd init → skill init-project)
- [x] Skills info in status command + identity coverage bar
- [x] BrailleSpinner personality across all commands
- [x] npm packaging (skills/ shipped with package)
- [x] Web: SkillsPane dashboard tab + /skills slash command
- [x] Nested you.json identity resolution (API + compiled bundle formats)
- [x] Skill system registry (Convex tables skills + skillInstalls, 9 HTTP endpoints, web SkillsPane)

### Build & Deploy Fixes (April 6)
- [x] Fixed /claim build error (force-dynamic)
- [x] Fixed CLI postinstall hook (inline echo)
- [x] Removed hardcoded deploy keys from convex-deploy.sh
- [x] Fixed npm vulnerabilities (picomatch ReDoS)
- [x] Removed deprecated @clerk/clerk-react
- [x] Centralized all hardcoded Convex URLs (src/lib/constants.ts for web, getConvexSiteUrl() for CLI)
- [x] DRYed pipeline OpenRouter utilities (convex/lib/openrouter.ts)
- [x] Fixed profile view tracking for unclaimed profiles (userId now optional)
- [x] Created .env.local with all API keys

### MCP Reliability (April 16)
- [x] Codex MCP launcher split: local `cli/dist` inside the youmd repo, published npm package elsewhere
- [x] Hardened generated MCP config to avoid bare `npx youmd mcp` package-name collisions
- [x] Updated user-facing MCP install copy/docs to use the safe published-package form

### Passwordless Auth Migration (April 16)
- [x] Replaced the app-side Clerk provider/middleware path with first-party session auth + Convex custom JWT signing
- [x] Added Convex auth/session tables plus passwordless email challenge/session mutations
- [x] Added web auth routes for send-verification, verify-code, verify-link, session, logout, and JWKS discovery
- [x] Migrated `/sign-in` and `/sign-up` to sequential passwordless terminal flows
- [x] Migrated CLI `register` / `login` from email+password to email-code auth
- [x] Removed the last live Clerk package dependency from the web app
- [x] Synced production Vercel auth env for the new JWT signer/JWKS stack
- [x] Validated local web auth route flow (signup, verify, session, logout, login) against the dev backend
- [x] Validated CLI auth flow (`register`, `login`, `whoami`) against the dev backend
- [x] Validated production passwordless email delivery, verify-code, session cookie, and authenticated `/shell` hydration on `you.md`
- [x] Validated production API-key issuance on the passwordless flow plus live CLI `whoami` against the prod backend
- [x] Retired legacy password/Clerk HTTP auth routes to explicit 410 deprecation responses
- [x] Removed stale Clerk CSP allowances and auth copy from active web/CLI surfaces

### Agent Context Bootstrap Overhaul (April 16)
- [x] `youmd skill init-project` now supports `auto`, `additive`, `zero-touch`, and `scaffold` modes
- [x] Added first-class `AGENTS.md` support with one managed additive bootstrap block for existing repos
- [x] Added generated `.you/` layer with `AGENT.md`, `STACK-MAP.md`, and supplemental `.you/project-context/`
- [x] Canonical `project-context/` scaffolding now fills missing files individually, including `PROMPTS.md`
- [x] `youmd init` now offers repo bootstrap even when mature repos already have `CLAUDE.md` / `project-context/`
- [x] Bundled skill truth pass completed across CLI catalog, backend seed data, dashboard UI, docs, and README
- [x] Bundled skill set expanded and reconciled to 7 shipped skills: `youstack-start`, `claude-md-generator`, `project-context-init`, `voice-sync`, `meta-improve`, `proactive-context-fill`, `you-logs`
- [x] Existing local skill catalogs now auto-merge new bundled defaults on upgrade instead of staying stuck on the old 4-skill set
- [x] Smoke-tested `youmd skill init-project` in fresh and existing repos to verify scaffold vs additive behavior

### CLI Overhaul (March 24-25)
- [x] 20 commands (init, login, register, whoami, status, build, publish, add, diff, export, preview, chat, link, keys, memories, private, project, pull, push, sync)
- [x] Conversational AI onboarding with BrailleSpinners
- [x] Passwordless email-code auth (no manual API token needed for your own account)
- [x] ASCII YOU logo on opening screen
- [x] ASCII portrait rendering in terminal
- [x] Multi-select UI for platform/tool selection
- [x] BrailleSpinner color rotation + lightsweep
- [x] Personality-rich spinner labels
- [x] Rich terminal rendering (tables, stats, code blocks)
- [x] Project-aware context (auto-detect, per-project files)
- [x] Private context management
- [x] Context link management (create, list, preview, revoke)
- [x] Export command (you.json + you.md)
- [x] Diff command (local vs published)

### Audit Gap Closure (March 24)
- [x] SourcesPane wired to real Convex mutations
- [x] ActivityPane wired to real security logs
- [x] SettingsPane wired to real data
- [x] FilesPane keyboard shortcuts (Cmd+S)
- [x] FilesPane markdown preview toggle
- [x] FilesPane create new file
- [x] Profiles directory search/filter
- [x] CLI directives in chat context
- [x] Profile page: raw JSON toggle, voice section, connected sources, maintenance
- [x] Lovable-style profile page (real photo + ASCII header)
- [x] Private profile preview (public/private/agent view toggle)
- [x] Share link preview mode (web + CLI)

### Fixes (March 24-25)
- [x] CLI hitting prod Convex (was dev — 401 bug)
- [x] Markdown rendering on profile page (no raw **bold**)
- [x] Nav avatar uses photo (not tiny ASCII)
- [x] LinkedIn scraper returning wrong profile (ignoreCache + forceFresh)
- [x] Text formatting in CLI (word-wrap, paragraph spacing)
- [x] Mobile dashboard navigation
- [x] Profile images + richer directory cards

---

## NEEDS VERIFICATION

These are implemented but Houston hasn't confirmed they work end-to-end:

- [ ] CLI → web portrait sync (ASCII portraits generated locally persist to server)
- [ ] CLI → web image sync (scraped profile images upload to server storage)
- [ ] Passwordless auth works end-to-end on production (web sign-up/sign-in/dashboard + CLI register/login/whoami)
- [ ] Context link resolution by AI agents (do real agents parse the response correctly?)
- [ ] CLI export produces valid you.json + you.md
- [ ] CLI diff accurately shows changes vs published
- [ ] Private profile preview shows correct scoped data

---

## IN PROGRESS

- [x] Deploy and verify the `/ctx` reliability fix so valid full-context links keep returning `you-md/v1` JSON even when tracking/logging writes fail
- [x] Change generated context-link URLs to `https://www.you.md/ctx/...` so agent fetchers avoid the apex-domain redirect
- [ ] Execute the ship-readiness plan across CLI, MCP, API, web-agent reliability, parity, and personality
- [ ] Deploy/reseed the Convex bundled-skill registry so production `/api/v1/skills` includes `youstack-start`
- [ ] Verify the new local MCP `get_agent_brief` tool through a real Claude Code/Codex MCP host after publishing or local MCP config refresh
- [x] Complete the first ship-readiness evidence pass: CLI/bootstrap smoke tests, live MCP/API checks, and a tracked audit doc
- [x] Complete authenticated production CLI hard-smoke coverage for `register`, `login`, `login --key`, `whoami`, `push`, `pull`, `diff`, `status`, `keys list`, and `sync`
- [x] Fix CLI public-profile ingestion + round-trip correctness (`application/vnd.you-md.v1+json`, public markdown fetch, clean publish→pull→diff, accurate local publish/sync state)
- [x] Fix web-shell response sequencing so the main answer no longer waits on `/api/v1/chat/ack`
- [x] Add same-origin web proxies for `/api/v1/chat`, `/api/v1/chat/ack`, and `/api/v1/chat/stream` so the shell/docs/public API surface are consistent
- [x] Remove stale active auth/shell/docs copy (`v0.1.0`, `dashboard`, dead password endpoints, fake MCP command)
- [x] Verify the Vercel deployment and live web-domain chat proxies after the parity hardening deploy
- [x] Fix local web auth so locally served passwordless sessions mint Convex JWTs accepted by remote Convex deployments
- [x] Fix destructive web-shell custom-section persistence so custom sections stop clobbering the rest of `profile.youJson`
- [x] Add deterministic follow-through text when the web shell gets tool calls but the model returns empty/terse user-facing copy
- [x] Re-run the local browser passwordless auth flow after restarting the stale dev server and confirm `/shell` hydrates cleanly
- [x] Re-verify the real-domain production passwordless browser shell flow on `you.md`
- [x] Fix `youmd chat` so closed stdin / piped non-interactive sessions exit cleanly instead of throwing `ERR_USE_AFTER_CLOSE`
- [x] Fix stale web-shell mutation replay so completed custom-section turns stop getting re-applied on later unrelated requests
- [x] Fix the core production shell scaffold regression so `create my projects directory and subdirectories for each project within my private folder` creates the real `private/projects/*` tree instead of hanging or fabricating repeated `README/context/prd/todo` updates
- [x] Verify the live post-login shell bootstrap path end-to-end on production (`/api/auth/session` + Convex user/profile/private/bundle queries)
- [x] Verify the authenticated production bundle really contains the scaffolded `projects/*/{README,context,prd,todo}.md` files instead of only claiming to
- [x] Support configurable verified passwordless email senders via `AUTH_EMAIL_FROM` / `RESEND_FROM_EMAIL` and surface a clearer error when Resend is still in testing mode
- [x] Upgrade the web shell thinking indicator so it keeps a braille spinner alive, rotates through subtask-aware status text, adds a sweep/shimmer effect to the active line, and shows completions more clearly in real time
- [x] Keep the shell working state alive through response drafting plus post-response saves/publishes, then finish with a stronger completion summary + proactive next-step options
- [ ] Configure a verified production email sender for passwordless auth so non-owner accounts and aliases can actually receive login/signup codes
- [ ] Switch the published `youmd` CLI from the disposable test account to Houston's real account and save the new agent-session behavior preferences into his durable brain context
- [x] Simplify `youmd login` so the default flow offers browser sign-in on Enter, email-code login in-terminal when an email is typed, and `--key` as the explicit direct-auth path
- [x] Add sane API-key operator UX in settings: rotate one fresh key, bulk revoke all API keys, and copy the newly issued key without touching unrelated token types
- [x] Hide revoked API-key history behind an explicit toggle so the default settings view shows the real active-key state
- [x] Fix stale CLI auth state so `youmd login --key ...` stops verifying production keys against cached dev endpoints and add an explicit `youmd logout` escape hatch
- [x] Add a curl-first installer at `you.md/install.sh` and update hero/footer/docs/help to teach curl as the default CLI install path with npm as fallback
- [x] Fix the blocked npm publish retry by bumping the CLI to `0.6.2` and normalizing package metadata npm was auto-correcting during publish
- [x] Make bare `youmd` and `youmd chat` feel more like meeting U: logo-first, contextual greeting, proactive repo guidance, and no duplicate first streamed reply
- [x] Make `youmd skill init-project` bootstrap both Claude and Codex skill discovery paths by default, then verify scaffold/additive flows through the installed local CLI
- [ ] Decide later whether You.md should ever store revealable API-key ciphertext for future keys, or keep the current hash-only model permanently
- [ ] Add an explicit preview + approval workflow if You.md ever introduces non-additive instruction-file rewrites or cleanup operations
- [ ] Remove or rewrite remaining Clerk-specific docs/comments/webhooks/password endpoints so the repo no longer describes the old auth model as current
- [ ] Run transcript-level local CLI vs web shell parity prompts and capture tone/proactiveness gaps with concrete repros
- [ ] Continue hardening the web shell's tone/proactiveness so it feels as crisp and grounded as the CLI instead of noisier/redundant
- [ ] Design global `~/.you/` plus repo-local `.you/` ownership model and migration path from `.youmd`
- [ ] Extend the validated cross-agent stack-sync pattern beyond repo bootstrap into global/shared instruction mirroring, portable overlap settings, and persistent stack inventory

---

## UP NEXT (Priority Order)

### Near-Term
- [ ] Chat context compaction (Claude Code-style)
- [ ] Memory lifecycle improvements
- [ ] Next.js 16.2.2 upgrade evaluation
- [ ] Study gstack setup/team-mode patterns and borrow the useful structure for global You.md bootstrap and team rollout
- [ ] Continue the web-agent reliability/personality audit with live repros and side-by-side parity checks against the local CLI agent
- [ ] Verify the new first-party passwordless browser flow on production and fix any dashboard/session/JWT parity gaps
- [ ] Add a documented production endpoint matrix for public, authenticated, MCP, and chat surfaces

### Agent Intelligence Polish
- [ ] You Agent personality tuning (more wit, less generic)
- [ ] Agent acts directly, never says "the system handles that"
- [ ] Keep the web shell's live thinking/progress UX feeling as crisp and legible as Codex/Claude Code during long-running multi-step work
- [ ] Push the same ack → plan → work → complete + proactive follow-through pattern into the local CLI agent so web and local feel aligned
- [x] Build a true post-install / first-run “meet U” flow so the CLI feels like a helpful wingman immediately after install/login instead of assuming the user already knows the command tree
- [ ] Show ASCII portrait in web chat when switched or created
- [ ] Conversational portrait management working end-to-end
- [ ] Custom sections via agent conversation (flexible, not rigid 13 sections)

### Reference Intelligence (May 29, 2026)
- [ ] Brain-aware planning blocks: add “context load” + “write surfaces” spec for You Agent / YouStacks (Source: GStack `070722a`) (partial: bundled skills now pre-load `project-context/` + reference tasks)
- [ ] Consent + first-run wizard for any private brain writeback (Source: GStack `ce5fbfa`)
- [ ] Source-scoped hygiene metrics (orphan/coverage) for memory/profile/stack surfaces (Source: GBrain `041d89b`)
- [ ] Self-healing retry + disconnect audit breadcrumbs for long-lived clients (Source: GBrain `ffac8ce`)
- [ ] Sync freshness gating: short-circuit expensive refresh when unchanged; surface freshness in CLI/dev UX (Source: GBrain `cb1b5f9`) (partial: `youmd stack doctor` now reports git dirty + upstream ahead/behind)

### End-to-End Flow Testing
- [x] Full CLI → web journey: fresh account → login → init → build → push/publish → public profile → pull → diff/status clean
- [ ] Full web → CLI journey: web create → CLI login → pull → local files correct
- [ ] Context link share: create → share with Claude → Claude responds with context
- [ ] Pipeline: add source URL → scrape → extract → compile → auto-publish

### CLI Polish
- [ ] Reveal/copy existing API key (instead of revoke-to-create-new)
- [ ] Better error messages when auth fails
- [ ] Standalone binary (bun build --compile)
- [x] curl installer (you.md/install.sh)

### Design Polish
- [x] Normalize the `/profiles` app-nav create CTA and responsive filter/sort controls after live in-app browser QA
- [x] Rebuild `/shell` as a full-height Codex/Lovable-style workspace with a persistent left sidebar, resizable chat/detail split, and cleaner bottom composer
- [x] Polish `/shell` layout ratios, remove logged-in top nav, move account/theme controls into the sidebar footer, and reduce nested borders/boxed sidebar chrome
- [x] Reframe the shell Connectors page around the personal API/MCP/stack gateway, including `ystack` / `youstack` / custom `{name}stack` naming
- [x] Add saved chat sessions to the left shell sidebar and wire session-specific Convex hydration
- [x] Trim the collapsed shell rail to the core 8 controls, replace the sidebar wordmark with the PixelYOU mark, and move GitHub/update/publish/deploy/right-pane controls into top shell chrome
- [x] Collapse expanded shell sidebar groups by default so Projects/API/Skillstacks/Connect/Identity/Chats do not all render open at once
- [x] Polish the shell composer so the orange prompt glyph and inner focus outline are gone, focus highlights only the outer composer shell, and the bottom row includes attach plus voice shortcut affordances
- [x] Move shell sidebar collapse onto the YOU logo hover state, shrink the mark to avoid cropping, and move the right-pane toggle to the far-right top chrome
- [ ] Add editable persisted YouStack records for default `youstack` and custom `{name}stack` metadata, visibility, capabilities, and owner policy
- [ ] Add token scopes and generated docs for personal API/MCP extensions (`sessions`, `stacks`, `tools`, `functions`, `sources`)
- [ ] Add Convex `agent_runs`, `agent_plan_steps`, and queued gateway messages so shell/MCP/external-channel conversations share live run state
- [ ] Homepage minimalization: reduce section sprawl, keep it intentional (Hero → YouStacks → Open Standard → CTA)
- [ ] Profile page custom sections (user-defined via conversation)
- [ ] Count-up animations on all metrics
- [ ] Status pulse (ACTIVE dot) on profiles
- [ ] Role icons (Founder, Engineer, Designer)
- [ ] Consistent animations across all pages

---

## BLOCKED

- [ ] Stripe Pro plan ($12/mo) — needs Stripe account setup
- [ ] Private vault encryption (AES-256-GCM) — needs crypto key management design
- [ ] Composio OAuth — needs Composio partnership/API access

---

## FUTURE (Post-MVP)

### v1.1
- [ ] Verified badges (domain, social, DNS TXT)
- [ ] Profile analytics dashboard (views, agent reads, top queries)
- [ ] Custom domains for profiles
- [ ] Rate limiting per plan
- [ ] MCP endpoint (mcp.you.md/{username})
- [ ] Activity timeline on profile page

### v2.0
- [ ] Agent-to-agent communication protocol
- [ ] Team/org bundles
- [ ] Plugin marketplace
- [ ] Autonomous refresh (youmd refresh)
- [ ] Interview mode (youmd interview)
- [ ] Voice onboarding
- [ ] Framework integration PRs (Aider, CrewAI, LangChain)
