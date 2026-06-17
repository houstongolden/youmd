# You.md — Feature Inventory

Last Updated: 2026-06-17

## Core Platform

| Feature | Status | Notes |
|---|---|---|
| Shell sidebar expand/collapse | Fixed locally / authenticated visual QA pending | Fixed the left shell sidebar state model so responsive auto-collapse below `1520px` no longer overrides a user click. Sidebar state now stores an explicit `auto`, `expanded`, or `collapsed` mode: `auto` preserves the narrow-width default, while clicking the YOU/menu mark writes a manual override based on the currently rendered state, so the first click expands an auto-collapsed sidebar immediately. Verified with focused dashboard lint, root lint/radius, `git diff --check`, and `npm run build`; authenticated browser click QA is pending because the available browser profiles were unauthenticated or not attachable without mutating local auth state |
| Resident You.md sync daemon | Local foundation shipped / broader persistence pending | Added a first-class resident runtime across three macOS LaunchAgents: `com.youmd.identity-sync` runs `youmd sync --daemon` every 5 minutes, `com.youmd.skillstack-sync` runs `youmd stack sync` every 5 minutes, and `com.youmd.context-sync` runs `youmd stack context-sync` every 15 minutes. The curl installer now supports opt-in daemon activation with `YOUMD_INSTALL_DAEMON=1`, and `youmd status` / `youmd stack daemon status` show loaded state, intervals, last activity, and current warnings. Daemon-safe identity sync refreshes local files and installed skills while preserving richer remote server data when the local markdown compiler would upload a >50% smaller bundle. Project-context sync now refuses to pull/push if upstream includes non-context app-code paths, keeping the background path context-only. Installed and verified locally with the global `youmd@0.8.2` tarball; production docs/build verification and dashboard machine-readiness UI remain pending |
| Project portfolio graph and reuse catalog | Persisted dashboard slice verified / richer project intelligence pending | Added `PROJECT_PORTFOLIO_GRAPH_AND_REUSE_PRD_2026-06-17.md` and the first local implementation slice: `src/data/portfolioGraph.ts`, `/shell` Portfolio Graph pane, `/shell` APIs + Env Intelligence pane, slash-command routing (`/portfolio`, `/projects`, `/api`, `/apis`, `/env`), command-palette entries, `youmd project portfolio-audit` / `env-audit` / `apis`, bundled local CLI catalog visibility for `portfolio-graph-auditor`, and shared `portfolio-graph-auditor` skill synced through `.agent-shared`. Follow-up added Convex tables and owner-gated APIs for `portfolioProjects`, `portfolioApiSurfaces`, `portfolioDependencyEdges`, `portfolioReusablePatterns`, `brainDumpCaptures`, and `portfolioTasks`, plus project-scoped `portfolioGraph` slices in local MCP `get_project_context`. The Portfolio Graph pane now queries persisted Convex records first, labels `CONVEX PERSISTED GRAPH`, keeps static local data only as a bootstrap seed/fallback, and authenticated Chrome QA verified 4 projects, 5 surfaces, 4 edges, and 5 patterns persisted through the dashboard. `youmd skill improve` now has a verified local follow-through path here: `shared:` catalog sources resolve from the canonical shared skill root, `portfolio-graph-auditor` installed/synced into the local You.md skill bundle, and the signed-in `/skills` dashboard reflects `7 installed` with `portfolio-graph-auditor` in the installed list and tracked across `youmd`, `bamfaiapp`, and `bamfsite`. Signed-in local visual QA passed for Portfolio Graph, APIs + Env Intelligence, and `/skills` tracked-project propagation at `http://localhost:3100/shell`; the follow-up pass fixed the unreadable orange `/skills` explainer, added a local-agent sync proof strip, and screenshot-verified `7/10 skills synced`, `portfolio-graph-auditor`, `meta-improve`, `proactive-context-fill`, `get_agent_brief`, and tracked propagation. Local MCP now includes `portfolioGraph` in `get_agent_brief` / `youmd://agent/brief`, exposes structured `youmd://portfolio/graph`, and `get_project_context` returns a project-scoped graph slice for `youmd`; stdio MCP smoke verified the paths without leaking secret-like values. The canonical shared `portfolio-graph-auditor` skill now requires agents to verify that MCP path, and the update was synced into Claude/Codex/Cursor/Pi plus the local You.md skill cache. The model tracks project goals, AI summaries, API/MCP ownership, protected product agent harness boundaries, public/installable skill stacks, dependency tiers, integration types, failure modes, reusable code/UI/auth/role/sidebar/chat/streaming/connector patterns, provider/env key-name normalization, service-account notes, and secret-safe duplicate-key fingerprinting. Lempod ownership across `bamfsite` and `bamfaiapp` is intentionally deferred while Houston handles that in those projects. Next: run authenticated 90-day project catalog refresh visibly, add task/brain-dump creation workflows, export repo-backed graph snapshots, enrich active projects with deeper strategy fields, and add richer code/UI pattern mining |
| Personal API/MCP product boundary | MVP visible / protocol expansion pending | 2026-06-15/16 routing passes moved the productizable h.computer/creator-new ideas into You.md: You.md owns the personal API/MCP, structured identity/context contract, durable agent brain, connected source memory, scoped grants, provenance-rich writeback, YouStacks, host adapters, source refresh, skill learning, and stack-level model routing. `/shell` now exposes the owner-facing Human API/MCP control center under `connect` -> `api/mcp`, with private REST/MCP/stack endpoint docs, grant management, resource map, route table, copyable MCP/local-adapter/REST/agent-start snippets, and direct slash commands (`/api`, `/mcp`, `/connectors`, `/crawlers`, `/loops`). h.computer remains Houston's personal site/reference implementation that reads from You.md and writes useful memories/activity back. Current preserved messaging includes "A personal API where the context is you," "The context every agent should already have," and "Brain -> Stacks -> Runtime -> Protected API/MCP." See `PERSONAL_API_MCP_AND_YOUSTACKS_MEMO_2026-06-15.md` and `prompts/2026-06-16-youmd-personal-api-context-routing.md` |
| Mobile brain-dump capture and project routing | Product context + shared task-router foundation | Added the 2026-06-16 Part 2 direction: You.md owns the universal mobile capture inbox for Apple Watch/iPhone voice-to-text, SMS/iMessage, pasted transcripts, future audio transcripts, Slack messages, CLI/web shell messages, and host-adapter inputs. The planned pipeline saves raw artifacts first, redacts phone/provider metadata, dedupes repeated dictation chunks, segments ideas, classifies projects/consumers/confidence, extracts memory/task/doc-update candidates, keeps unclear fragments in a clarification queue, and requires approval or scoped automation before external writes. Sendblue is captured as an iMessage/SMS/RCS adapter candidate, not a hardcoded architecture. The same direction also preserves revocable voice/likeness grants, Slack host-adapter scopes, the "agent is you" / amplified-user framing, and `y.computer` only as a future runtime naming note. BAD owns workout transcript UX; Myo/h.computer/Hubify/BigBounce/Creator.new/BAMF.ai/Fantasy.is/BAMF site consume routed outputs. Follow-up added the shared `braindump-task-router` skill plus Convex `brainDumpCaptures` and owner-aware `portfolioTasks`, separating `human` tasks from `agent` tasks. Next: invoke the workflow from shell/CLI and connect it to mobile/watch capture inputs. See `MOBILE_CAPTURE_AND_PROJECT_ROUTING_2026-06-16.md`, `voice-memo-part-2-youmd-handoff-2026-06-16.md`, and `PROJECT_TASKS_BRAINDUMP_AND_SYNC_PROOF_2026-06-17.md` |
| Machine bootstrap skill | Local project-sync + authenticated dashboard refresh verified / production registry pending | Added bundled `machine-bootstrap` plus `youmd machine projects` so a fresh computer can install/auth/pull/sync You.md, restore agent skills/stacks, create a Desktop code root such as `CODE_YOU`, and create/clone active project repo directories. The project command now merges authenticated GitHub repos pushed in the last 90 days with You.md project records, uses repo names as directory names, tags associated stacks, attaches API/MCP docs links, skips broad duplicate bundle entries, asks before older projects in interactive mode, supports dry-run/directory-only modes, and clones with `gh repo clone` or `git clone`. Tracked projects now have schema/DSI/dashboard fields for repo URL, product URL, repo/directory name, docs links, stack name, high-level goal, and recent progress. Authenticated Chrome QA ran the dashboard `refresh active projects` analyzer and verified 38 visible GitHub project rows with repo, dir, stack, API/MCP docs, goal, and recent progress. Next: dedicated machine/computer readiness confirmation and hosted `/api/v1/skills` reseed |
| Connected-app grants | MVP code complete / prod verification pending | Added `connectedAppGrants` with hashed `yg_` tokens, app type, resource scopes, action scopes, write policy, trust level, expiry, revocation, list/page/revoke/create/resolve mutations and tests. `yg_` bearer tokens now authenticate through HTTP/MCP, enforce resource/action scopes plus `approved_write` for writes, update last-used, and log `agentActivity` with `agentSource: connected-app` plus the grant id |
| Lovable-simple connector UX | MVP code complete | Sources pane now supports connector choices (Website/GitHub/RSS/OKF/Webhook/JSON), crawler provider (`native`, `firecrawl`, `agent-browser`, `manual`), refresh cadence, visibility, trust, optional label, refresh-now, pause-cron, inline policy edits, and source provenance details. Connectors `apps` now uses Google favicon API icons from real app domains, puts Local Agent Runtime first for Claude Code/Codex/Cursor/MCP setup and grant verification, then keeps You.md/owned/custom connectors pinned above popular apps such as Slack, Notion, Gmail, Google Calendar, Linear, GitHub, HubSpot, Salesforce, Firecrawl, Stripe, and Google Drive |
| Source refresh and monitored updates | Partial code complete | Immutable raw-source versioning and provenance work gives the backend substrate. Source refresh metadata and an hourly cheap cron mark due sources `pending`; source details can manually refresh/pause/edit policy, approve cost-bounded expensive provider windows, and review monitored source-change summaries. The existing pipeline now dispatches native vs Firecrawl providers, runs through a per-user/provider rate/cost/approval gate, records immutable raw versions, writes deterministic change-summary rows with content length, safe preview, and headings, and skips extraction for pending-review source changes; agent-browser fails closed until a sandbox runner exists. Remaining: source health, approval-aware writeback, real Firecrawl env verification |
| Skill-learning loop | Planned | Convert human screen recordings, transcripts, SOPs, tool/API lists, agent-run logs, summaries, corrections, and repeated workflows into draft `SKILL.md`, workflows, prompts, docs, tests, and host adapter updates inside named YouStacks |
| Stack-level model routing | Planned | Extend YouStack manifests/adapters with orchestrator, lead, worker, fallback, BYOK/provider, cost, risk, and approval policy so model routing travels with the stack rather than living only in global agent instructions |
| Gated product/app access | Planned | Add connected-app grants for h.computer, Creator.new, BAMF.ai, folder.md, and future consumers, with scoped reads, provenance-rich writes, expiry/revocation, audit logs, and previewable access boundaries |
| Shell GitHub update chrome | Local authenticated repo-update proof passed / persisted artifacts pending | Shell top chrome now right-aligns repo state with a solid GitHub mark, Convex repo-mirror status colors, hover-only repo name, compact last-sync label, and one `[ update ]` action. The button now publishes the current bundle, pushes identity files to the linked repo through the existing PR/direct action, refreshes the server mirror, pulses the GitHub dot while running, and streams publish/push/mirror steps into shell chat. Authenticated Chrome QA on local `/shell` verified `SYNCING` -> `SYNCED / REPO MIRROR CURRENT / JUST NOW`, with PR #5 merged for `houstongolden/houstongolden-you-md`. Next: expandable/persisted update artifacts, commit/PR message history, conflict/check timeline, and shell-chat-initiated content-change proof |
| Usage surface | MVP code complete / Settings link pending | Connectors API/MCP tab now maps usage across You Agent tokens, API/MCP calls, loops/crons, crawlers, connector grants, BYOK/custom env, and artifact storage. Next: a first-class Settings -> Usage page with live Convex counters and product-friendly usage encouragement |
| Folder.md artifact storage connector | MVP copy/UI complete / integration pending | Connector catalog now positions folder.md as the markdown/artifact library expansion path with optional 10GB free storage when connected via account/API key, including an agent-ready prompt. Next: real OAuth/API-key connector flow, storage quota state, and artifact read/write grants |
| Artifact workspace | MVP code complete / report history foundation added | Files pane now has `files`, `artifacts`, and `reports` modes plus markdown report templates for daily briefing, project carryover, daily journal article, and public profile chat contract. Templates save through `custom_files`, keeping them portable through the existing bundle/API/MCP path. Generated private Loop Report artifacts now appear as read-only markdown under `reports/generated/*`, and the Reports workspace shows owner controls for definitions, runs, artifacts, manual daily runs, and source snapshot provenance. Next: richer editing/versioning, backlinks, and DSI publish controls |
| Loop Reports | Foundation UI + backend code complete / first DSI adapters wired | Added `loopReportDefinitions`, `sourceSnapshots`, `loopReportRuns`, and `loopReportArtifacts`, owner CRUD/listing/manual-run functions, an hourly due-loop cron, deterministic daily briefing compilation from You.md-owned activity/projects/sources/repo mirror/memories/pending source changes/DSI components, focused Convex tests, and owner-visible `/shell` controls to seed defaults, run the daily briefing, pause/resume definitions, inspect runs, open generated artifacts, and drill into normalized source snapshots with hashes/trust/capture windows. External adapters remain pending for Perplexity trends, full tasks, richer school calendar writeback, richer BAMF/BAMF OS/LinkedIn/X/social range analytics, richer Bad.app history/range analytics, and richer daily journal generation. Detailed plan: `ARTIFACTS_DAILY_LOOPS_DSI_PUBLIC_CHAT_PLAN_2026-06-16.md` |
| DSI catalog components | First private weather/surf/GitHub/school/agenda/task/fitness/BAMF slices code complete | Added `dsiComponents` as the first extensible structured component table for the personal API/MCP layer, plus owner-gated refresh actions for h.computer-style Open-Meteo weather, Venice Breakwater surf calibration, GitHub project catalog, school logistics, Google Calendar agenda, private task queue, Bad.app fitness/body state, and BAMF.ai/BAMF OS pulse. `/shell` Reports now shows a DSI catalog panel with counts, trust/visibility metadata, refresh controls, summaries, and read-only markdown artifacts under `dsi/private/*`. GitHub catalog includes project count, GitHub URLs, matched clean project URL, recent commits, stars, AI insight, privacy/visibility, and h.computer-style LOC/LOMB/LOMB ratio. It now prefers GitHub `/languages` estimates for the top tracked repos and falls back to exact repo-mirror metrics when language data is unavailable. School logistics fetches the public Google Doc `mobilebasic` source, extracts upcoming active-grade/school-wide dated items, and stores countdowns, event totals, next event, source lines, and parser provenance privately. Agenda uses h.computer's important-upcoming Google Calendar filter with native bearer-token or legacy connector-gateway auth, and preserves an honest unconfigured state when no connector exists. Task Queue reads h.computer-compatible arrays from private `customData`, normalizes status/priority/due/source/proposed metadata, computes open/overdue/proposed/urgent counts, and generates reusable task prompts while preserving an honest unconfigured state. Bad.app fitness reads live REST with a `bad_sk` bearer key or private `customData.badapp`, normalizes State of You scores, health summaries, body scans, fitness tests, data quality, and source metadata, and feeds daily briefing body signals. BAMF Pulse reads BAMF OS/BAMF.ai REST or private `customData.bamf`, normalizes clients, creators, LinkedIn posts, agency counts, stack sync runs, and connected-app notes, and feeds daily briefing connected-app pulse. Remaining: owner-approved public profile rendering, custom component schema/editor, richer BAMF social/range analytics, richer Bad.app historical/range analytics, LLM school extraction/calendar writeback, richer task creation/editing/external task apps, and research/blog source trackers |
| Public profile chat | API + MCP + owner controls code complete / prod verification pending | Public profiles expose an above-the-fold chat widget backed by `POST /api/v1/profiles/[username]/conversation`, and hosted MCP exposes `ask_public_profile` with the same public-context-only contract. Owners can now manage the public chat from Share: enable/disable, concise/voice/consultive mode, allowed public fields, advertised capabilities, source-link return, and a short owner note. Those settings persist in `preferences.public_chat` inside public `youJson`, hide the widget when disabled, shape widget suggestions, and constrain both REST and hosted MCP responses while still explicitly omitting private memories, reports, connected-app data, source snapshots, logs, and scoped API/MCP grants. Remaining: LLM-backed voice generation, optional local MCP parity if needed, and production verification |
| OKF (Open Knowledge Format) export/import | Code complete / needs Houston e2e + publish | `youmd okf export\|import\|validate` (+ `youmd export --okf`). Renders the identity bundle (`profile/`/`preferences/`/`voice/`/`directives/` + installed skills) and YouStacks as conformant `okf/v0.1` bundles — a directory of markdown concepts any OKF-aware agent/tool reads natively, no SDK. Lossless round-trip (`youmd_kind` routes concepts home on import); stacks carry `youstack.json` alongside so they stay installable. Pure core in `cli/src/lib/okf.ts`; bundle/stack layers in `okf-bundle.ts`/`okf-stack.ts`; 30 tests green. Rides the existing `youmd sync` engine — no sync changes. Runbook + cross-machine test plan in `OKF_INTEGRATION.md` |
| Free GitHub OAuth signup | Code complete / needs OAuth App + deploy | Phase 1 is now merged into local `main`: `githubConnections` table (GitHub identity + AES-GCM-encrypted OAuth token + scopes + linked-repo metadata), `convex/github.ts` (`findOrCreateGithubUser` gated by trusted internal token, `getConnection`, `linkRepo`), `/api/auth/github/start` + `/callback` reusing the opaque-session cookie + JWKS Convex JWT path, and "continue with github" / "sign up free with github" on sign-in + sign-up with graceful unconfigured + error states. Email-code auth untouched. Operator must register the OAuth App + set `GITHUB_OAUTH_CLIENT_ID`/`SECRET` then deploy. Local dev redirects now use port `3100`. See `GITHUB_OAUTH_SETUP.md` |
| Connect / create your You.md repo | Code complete / needs Convex deploy + repo scope | Phase 2: `convex/githubRepo.ts` actions — `createRepo` (creates `you-md` public/private + seeds README/you.md/you.json/stacks), `connectRepo` (link an existing owned repo), `listRepos` (picker). Token decrypt stays inside Convex actions; UI is `GithubRepoSection` in the Settings pane (visibility toggle + repo picker, no text-input forms) showing linked-repo status |
| Repo↔You.md sync (push/pull) | Code complete / needs Convex deploy + repo scope | Phase 3 first slice: `pushToRepo` writes current `you.md` + `you.json` to the linked repo (update-by-sha, skips no-op commits, tracks `lastSyncedSha`); `pullFromRepo` reads them back and saves a new bundle + syncs the profile (repo wins on pull). Push/pull controls + last-synced timestamp in the Settings pane. Last-writer-wins conflict policy |
| GitHub webhook auto-pull | Code complete / needs Convex deploy + webhook secret | `POST /api/github/webhook` (HMAC-SHA256 verified) auto-pulls + re-mirrors when an external `git push` hits the linked repo's default branch; the push hook is auto-registered on create/connect when `GITHUB_WEBHOOK_SECRET` is set |
| Server-side repo mirror + stacks API | Code complete / needs Convex deploy | Phase 4 first slice: `repoMirror` snapshots identity + `stacks/**` (capped), refreshed on create/connect/pull/webhook; authenticated `GET /api/v1/me/repo/files` (+`?path=`) and `/api/v1/me/repo/stacks` let agents read the repo from our servers; Settings pane shows mirror file/stack status |
| Repo-hosted stacks on MCP + public profile | Code complete / needs Convex deploy | MCP `get_my_stacks` + `get_repo_file` read the mirror; public `get_identity` includes `repo_stacks`; public profile renders a "stacks in their repo" section. Public-repo stacks only (`getPublicRepoStacks` never leaks private-repo names) |
| GitHub App fine-grained tokens | Foundation (additive, untested e2e) | Phase 5: `convex/githubApp.ts` mints RS256 app-JWT + installation tokens; `loadConnectionToken` prefers them when the App is configured + installed, else OAuth fallback. `setInstallation` + `/api/auth/github/app/setup` callback + Settings install link (`NEXT_PUBLIC_GITHUB_APP_SLUG`). Needs the App registered to verify |
| Repo-native You.md (own GitHub repo as source of truth) | Phases 2–5 foundations done / followups remain | Host the full You.md `.md` + stacks in the user's own public/private GitHub repo and clone/mirror server-side for API/MCP. Done: connect/create/seed, push/pull sync, webhook auto-pull, server mirror + stacks API, MCP/public-profile stack surfacing, GitHub App token foundation. Remaining: 3-way merge, sync `private/*` to vault, App registration + e2e verify, installation-token caching. Phased design in `GITHUB_NATIVE_PLAN.md` |
| Shared product design primitives | Done | Reusable `Container`, `Section`, `SectionHeader`, `Button`, `Card`, `TerminalCard`, `FormField`, `Input`, `Textarea`, `Select`, `Label`, `FieldHelp`, and `FieldError` now anchor marketing and app UI control standards |
| Simplified product model | Done deployed | Homepage, docs, public profile, auth/onboarding copy, dashboard panes, README, PRD, and schema comments now explain You.md as four layers: Brain, Stacks, Runtime, and Protected API/MCP |
| Developer docs platform | Done deployed | `/docs` now includes a BAMF-style surface map, concepts, API/MCP/stack operating standard, context surfaces, source-of-truth mapping, agent workflows, playbooks, examples, generated API/MCP reference, schema guidance, docs automation, troubleshooting, and a dedicated YouStacks chapter; deployment `dpl_7rodpWtQzYwZSqtfdPZTY95hsu9k` is live |
| Agent-readable docs surfaces | Done deployed | `/llms.txt` exposes the short agent index and `/llms-full.txt` exposes the full plain-text agent context pack; README, root `AGENTS.md`/`CLAUDE.md`, `/docs#agent-docs`, `robots.txt`, and `sitemap.xml` point agents to docs, API, MCP, runtime, YouStacks, smoke checks, source-repo handoff files, and upstream reference intelligence. The root files now have a generated pipeline (`llms:generate` / `llms:check`) plus `llms:smoke`, which compares live docs against the generated docs reference, MCP discovery, robots, sitemap, docs page, source-repo handoff markers, and the docs-page handoff commands; the current docs also make the Jun 3 reference follow-up rules explicit: shell-facing stack helpers must stay sanitized, repo/branch/runtime metadata stays local by default, protected reads should report honest readiness states, and richer retrieval should degrade toward fallback before silence. Docs-page handoff deployment `dpl_5vKbdeCp1k9Lfj2ZsyroUc5538N9` is live |
| Agent docs CI guardrail | Done deployed | `npm run agent-docs:ci` runs generated docs checks plus modular `agent-docs:syntax`, `agent-docs:handoff`, `agent-docs:handoff:json`, and `agent-docs:lint` subcommands, making the guardrail easier to run, debug, and consume from automation; the handoff marker check derives the expected root agent-manual CLI version from `cli/package.json` plus app stack versions from `package.json`, so `AGENTS.md` and `CLAUDE.md` must stay aligned with the real package versions and first-party passwordless auth model. `/llms-full.txt`, `/docs#agent-docs`, README, and root manuals now document the modular commands; live smoke and the local handoff checker enforce that they remain part of the source-repo and public docs handoff contract. The local handoff checker also enforces the docs-page PRD/architecture, stale stack/auth, required/forbidden marker wording, and the new shell-safety/local-metadata/readiness/fallback contract so local CI matches live smoke, reports checked file, required marker, and forbidden stale-marker counts in human output, and emits the same contract as JSON for CI/agent tooling. `.github/workflows/agent-docs.yml` runs the umbrella check on path-scoped push, pull request, or manual triggers for agent-docs source surfaces including README, `AGENTS.md`, `CLAUDE.md`, `/docs#agent-docs`, and active PRD/architecture docs. Latest local verification passed `agent-docs:handoff`, `agent-docs:handoff:json`, JSON parse/count assertion, syntax, lint, `llms:check`, `agent-docs:ci`, JSON command marker grep, and `git diff --check`; GitHub Actions run `26856413207` passed and production deployment `dpl_CcWeF8asBZULESwqvEKGjWYBRMmY` is live |
| Generated docs reference | Done | `npm run docs:generate` scans Convex HTTP routes, Next routes, and CLI MCP tools into `src/generated/docs-reference.ts` plus a generated OpenAPI-style spec; YouStacks endpoints are categorized under `YouStacks`; `prebuild` refreshes it and `docs:check` detects stale artifacts |
| Upstream reference intelligence | Done local | `npm run references:sync` keeps ignored local clones of `garrytan/gstack`, `garrytan/gbrain`, `steipete/agent-scripts`, and `disler/the-library`, writes versioned `project-context/reference-intelligence/LATEST.md` and `TASKS.md` artifacts, and feeds daily review for YouStacks, You.md brain/context, shared agent scripts, source catalogs, and private stack distribution; the latest 2026-06-12 sync captured GStack `a5833c4`, GBrain `ecd6ae8`, Agent Scripts `a3026ae`, and The Library `47f455c` |
| Convex-safe capability router twin | Done local | The Convex-side capability router now lives at `convex/lib/capabilityRouter.ts` so Convex codegen/deploy bundling accepts the module path while CLI, web, and Convex parity tests continue sharing the same fixture |
| Reference follow-up audit | Done local / implementation pending | `project-context/REFERENCE_INTELLIGENCE_AUDIT_2026-06-03.md` turns the broader Jun 3 wave into four concrete You.md follow-up bands, and `project-context/REFERENCE_INTELLIGENCE_AUDIT_2026-06-09.md` narrows the Jun 9 wave to two next slices: deterministic review/report packaging for YouStacks and fail-closed protected retrieval plus malformed-frontmatter resilience for repo-native/context reads |
| Codex chat hygiene | Done local | You.md now has a documented policy, reusable `npm run codex:chat-hygiene` command, and transcript index for consolidating recurring automation chats; the duplicate daily reference automation is paused, the active daily job starts by archiving older automation runs, completed automation transcripts live in `~/.codex/archived_sessions`, and durable outputs live in project-context files plus automation memory |
| YouStacks product-layer planning | In implementation | `YOUSTACKS_PRODUCT_LAYER_PRD.md` and `YOUSTACKS_IMPLEMENTATION_PLAN.md` define the additive stack layer, current product inventory/classification, GStack/BAMFStack transfer analysis, manifest schema, GitHub sync direction, API/MCP threshold, adapter model, and bisectable phases |
| YouStack local manifest CLI | Done local / publish pending | `youmd stack inspect`, `doctor`, `smoke`, `capabilities`, and `route` validate, diagnose, and route a local `youstack/v1` manifest without mutating brain data or connected tools; manifests now support human names, stable slugs, domains, aliases, tags, improvement policy, and update policy. Validation now rejects shell-unsafe stack slugs/capability ids and warns when domain/alias/tag metadata becomes multi-line before those values flow into generated adapter files. Stack inspect/capabilities/route/smoke JSON output now also returns an explicit readiness envelope so local agents can distinguish `not_found`, `invalid`, and `ready` states |
| YouStack doctor diagnostics | Done deployed | `youmd stack doctor --path DIR` runs read-only health diagnostics for manifest size, file composition, capability routing, adapter coverage, brain scopes, update hygiene, public-readiness gaps, and self-improvement readiness before agents smoke, publish, or modify a stack; production exposes the shared `stack-diagnostics` route capability |
| YouStack host adapter linking | Done local / publish pending | `youmd stack link` generates Claude Code, Codex, and Cursor adapter files from one manifest with dry-run support |
| YouStack local MCP tools | Done local / publish pending | Local MCP exposes `youmd://stacks/current/manifest`, `youmd://stacks/current/capabilities`, `get_stack_manifest`, `get_stack_capabilities`, `route_stack_request`, and `smoke_stack`; stack-oriented read tools now return explicit readiness envelopes (`not_found`, `invalid`, `ready`) instead of only plain error strings |
| Protected memory MCP retrieval | Done local / publish pending | MCP `search_memories` now returns a retrieval envelope with `ready`, `auth_required`, or `unavailable` plus fallback guidance, so protected memory reads no longer collapse into an opaque empty array when auth or the hosted endpoint is unavailable |
| Protected memory MCP resources + startup brief | Done local / publish pending | `youmd://memories` resources and `get_agent_brief includeMemories=true` now expose the same retrieval-readiness contract, so protected-memory auth/server failures no longer masquerade as a healthy empty context |
| Protected-read stack contract | Done local / publish pending | The shared stack capability contract and generated host adapters now explicitly tell agents that protected reads may return `auth_required`, `unavailable`, or `ready`, and that they should fall back to local stack files, project-context files, and public identity before retrying hosted retrieval |
| Protected private-context MCP retrieval | Done local / publish pending | MCP now exposes the previously advertised `get_private_context` tool plus `youmd://private-context`, both returning the same readiness/fallback envelope as protected memory retrieval instead of forcing agents to infer auth/server failures from missing tools or generic errors |
| Project-context MCP readiness envelopes | Done local / publish pending | `get_project_context`, `youmd://projects/current`, and named project resources now return a readiness envelope with fallback guidance, so missing project context stops surfacing as raw error strings while still distinguishing ready vs not found |
| YouStack shared route API | Done deployed | `GET /api/v1/stacks/capabilities` exposes the shared capability contract and `POST /api/v1/stacks/route` routes requests against default or manifest-supplied capabilities on `https://www.you.md`; route responses now preserve stack `name`, `slug`, `domain`, and `tags` |
| YouStacks homepage section | Done deployed | Homepage now leads with "package your expertise into your own GStack" and explains named domain stacks, skills, sub-agents, workflows, safe memory access, improvement loops, curl-first runtime install, auto-upgrade, and GStack/GBrain-guided reference patterns; production deployment `dpl_4UwpUiK2vUPYu8R9nj8dfnBDpq9M` is ready and aliased |
| YouStacks docs chapter | Done deployed | `/docs#youstacks` now includes named stack portfolio guidance, self-improving stack/skill loops, stack doctor diagnostics, expanded reference-intelligence guidance for GStack/GBrain/Agent Scripts/The Library, runtime-not-CLI-first install guidance, shell/profile management, auto-update behavior, the BAMFStack lighthouse example, API/MCP threshold, endpoint reference, and stack MCP tools |
| YouStack maintainer skill | Done local / publish pending | Bundled `youstack-maintainer` teaches host agents to organize, update, improve, smoke, and prepare private-by-default YouStacks for scoped or public sharing with owner approval |
| YouStacks dashboard pane | Done local | `/stacks` opens a shell/dashboard stack portfolio pane with named stacks, private/scoped/public visibility, install commands, update policy, maintainer commands, and BAMFStack lighthouse rules |
| Public profile YouStacks | Done local | Public profiles can render `public-open` YouStacks from the profile/bundle payload while private and scoped stacks remain owner-only |
| BAMFStack public lighthouse example | Done local | `cli/examples/youstack-bamfstack-public` is a public-safe example stack with manifest, bundled skill, workflow, prompt, docs, doctor/smoke tests, auto-update policy, improvement policy, protected-capability boundaries, and public-readiness routing |
| Compact conversion homepage | Done | Homepage now follows a calmer conversion flow with one primary hero CTA, compact profile proof, compressed problem/how-it-works/inside sections, combined integrations/builders credibility band, balanced pricing, compact FAQ, and simple final CTA |
| App control normalization | Done | Terminal auth/input, install tabs, dashboard tabs, pane headers, empty states, sources, share, private context, files, settings, and edit surfaces now share more consistent heights, padding, focus rings, card treatment, and muted text behavior |
| Public profile directory hygiene | Done local / deploy pending | `/profiles` now canonicalizes/dedupes usernames, suppresses QA/test rows, sanitizes public image URLs, defaults to grid view, prefers stored ASCII portraits, and falls back to real image/terminal portrait tiles instead of blank cards |
| Public profile portrait contract | Done local / deploy pending | Shared `ProfilePortrait` + `hasRenderableAsciiPortrait` enforce the same renderability contract on `/profiles` and individual public profile pages. `profiles:portrait-contract` catches code regressions; `profiles:portrait-audit` and `profiles:portrait-audit:pages` verify live/local profile data and individual pages |
| Public profile indexing + refresh pipeline | Done local / deploy + import pending | Source-ledger, refresh-job, and import-batch tables now back a 50-target AI/SaaS/builder seed catalog, admin dry-run/import route, native metadata fetcher, content hashing, freshness scheduling, daily Convex refresh cron, and `profiles:targets-check`. Next slice: deploy, dry-run all 50 targets, import if clean, then add extractor/LLM enrichment routing from `PUBLIC_PROFILE_INDEXING_AND_REFRESH_PLAN.md` |
| Profile enrichment URL safety | Done | Public-profile crawler/enrichment now keeps third-party API keys out of persisted avatar URLs and includes an internal cleanup mutation for old image URL secrets |
| Profile seed/backfill cleanup | Done | Sample profile seeding/backfill/cleanup now avoids duplicate/orphan profile rows and preserves avatar data when reconstructing profile records from bundles |
| Open spec you-md/v1 | Done | Directory-based identity bundles |
| Convex backend | Done | Reactive, serverless, TypeScript-native |
| Passwordless auth migration | Done | First-party email-code auth, sessions, custom JWT/JWKS. Local/dev validated and production browser + CLI parity hard-smoked |
| Simpler CLI login contract | Done | `youmd login` now cleanly branches into browser sign-in on Enter, email-code login in-terminal, or `--key` for direct agent auth |
| CLI logout | Done | `youmd logout` now clears local auth state so machines can switch accounts without hand-editing `~/.youmd/config.json` |
| Stale endpoint-safe CLI auth | Done | CLI auth requests now resolve `apiUrl` / `appUrl` at request time and reset fresh logins to production defaults instead of verifying production keys against cached dev endpoints |
| Curl installer | Done | `https://you.md/install.sh` now acts as the You.md runtime installer: source-installs current You.md by default, falls back to npm, installs native skills, writes `~/.youmd/bin/youmd-auto-upgrade`, and teaches `you` plus MCP/stack smoke as next steps |
| Clean npm publish metadata | Done | CLI package now targets `0.6.23`, uses normalized `bin` paths, and has been restored to the canonical `git+https://github.com/houstongolden/youmd.git` repository URL after the trusted publish retry confirmed npm's warning was only metadata normalization |
| Codex MCP install | Done | `youmd mcp --install codex --auto` safely writes `~/.codex/config.toml` with `npx --yes youmd@latest mcp`, matching the Claude/Cursor published-package launcher |
| MCP home-bundle fallback | Done | MCP tools now fall back to `~/.youmd` when the working repo has no local `.youmd/`, so background Claude/Codex agents still get the user's identity and skills |
| YouStack MCP startup brief | In progress | Local MCP now exposes `get_agent_brief` and `youmd://agent/brief`, combining compact identity, repo instructions, project-context files, active requests, open TODOs, known issues, installed skills, and next moves; production host/deploy verification is pending |
| YouStack starter skill | In progress | New bundled `youstack-start` skill teaches Claude/Codex/Cursor sessions to orient through You.md MCP, read local context first, route to the right bundled skill, and close the loop with tracker updates; Convex registry deploy/user verification pending |
| Cross-agent project bootstrap | Done | `youmd skill init-project` now links both `.claude/skills/youmd/` and `.codex/skills/youmd/` by default, with fresh scaffold and additive existing-repo paths verified from the installed CLI |
| Trusted CLI publishing | Repo ready / npm config blocked | GitHub Actions workflow uses npm Trusted Publishing with `id-token: write`, current checkout/setup-node actions, disabled setup-node cache, and passing install/test/build. npm still rejects `youmd@0.6.23` publish with `E404 Not Found / no permission` until package `youmd` trusts owner `houstongolden`, repo `youmd`, workflow `publish-cli.yml`, publish permission. The validated CLI setup command is `npx npm@11.15.0 trust github youmd --repo houstongolden/youmd --file publish-cli.yml --allow-publish --yes`, but it requires npm login + 2FA |
| Onboarding handoff into U | Done | `youmd init` and conversational onboarding now end with the same actionable U-centric next move pattern the launcher uses, including real recent-project openings instead of only a static checklist |
| Web initialize shell parity | Done | `/initialize` now passes live thinking/progress state into the terminal shell and prompts U to sound like the same local launcher wingman, including mentioning known projects when context already exists |
| Web initialize portrait encounter | Done | `/initialize` now shows a portrait-and-bot encounter strip above the onboarding terminal, reusing the saved ASCII portrait when available and falling back gracefully before the portrait exists |
| Web initialize YOU logo scene | Done | `/initialize` now brings in the actual YOU logo + subtitle framing above the portrait encounter so the first-contact scene matches the local launcher more closely |
| U-style CLI entrance | Done | Bare `youmd` now opens with the YOU logo, an optional saved portrait preview, a more human greeting, and contextual “next best moves” instead of a dry mini help menu |
| `you` launcher alias | Done | `you` now launches straight into U chat when the user is authenticated and a bundle exists, while still supporting subcommands like `you status` |
| Guided first-run `you` setup | Done | When `you` is missing auth or a local bundle, it now stays alive and walks the user through login/register/pull/init one question at a time instead of dumping static command text |
| Home-bundle conversational fallback | Done | `you` / `youmd chat` now work from arbitrary directories by falling back to `~/.youmd` when no local `.youmd/` exists |
| Smaller launcher portrait bounds | Done | Compact `you` startup now hard-caps the portrait to a much smaller width/height box, keeping it readable on narrow terminals instead of letting the portrait dominate the whole screen |
| Full-height compact portrait sampling | Done | Compact `you` startup now downsamples the full stored public portrait instead of slicing the top rows before fitting, preserving the intended face/body framing |
| Smaller web initialize portrait | Done | `/initialize` now renders the first-contact portrait in a small fixed column with compact pre-rendered portrait sampling instead of a huge 120-column panel |
| Active-bundle read-only parity | Done | `status`, `diff`, `export`, and `preview` now use the same active-bundle resolution as `you`, so they can operate from `~/.youmd` outside initialized repos |
| Portrait + bot startup scene | Done | The proactive `you` launch now shows the YOU logo, the user's ASCII portrait, a small bot greeting the portrait, and a more human "meet U" intro |
| Truthful startup investigation | Done | `you` now keeps a live braille spinner active while it actually checks local bundle guidance plus nearby AGENTS / CLAUDE / project-context signals, then reports concrete findings before the first chat turn |
| Narrow-terminal portrait encounter stacking | Done | The `you` launcher now stacks the portrait, bot, and speech vertically when the terminal is too narrow for the side-by-side scene, so the encounter no longer collides into unreadable overlap on mobile-ish terminal widths |
| Home-level agent context sweep | Done | `you` now also inspects shared home agent docs and recent Claude/Codex session roots, then uses that context to propose a strongest move instead of ending on a generic “what are we moving forward right now?” opener |
| Paced compact U launcher | Done | The local `you` startup now uses a compact terminal portrait, keeps the scan spinner visible long enough to feel intentional, and avoids dumping duplicate findings, project lists, headers, and intro paragraphs all at once |
| Local host-tool loop | Done | `you` / `youmd chat` now let U choose among `discover_projects`, `read_project_context`, `write_project_context`, `sync_identity`, and `respond`; the CLI host executes local filesystem/bundle operations and sends grounded tool results through the remote model for the final response |
| Deterministic local tool summaries | Done | `start` / `start there` now read the real repo root and print grounded host-tool output directly instead of asking the model to summarize filesystem access and risk bluffing |
| Recent-project opportunity scan | Done | Launcher startup now looks for concrete gaps in recent project contexts instead of only listing names, and it falls back to the home `~/.youmd/projects` root even when launched outside a repo tree |
| Workspace repo awareness | Done | Launcher startup now notices normal local repos with `AGENTS.md`, `CLAUDE.md`, `.youmd-project`, or `project-context/`, not just You.md-managed project bundles |
| Update-aware CLI startup | Done | CLI startup now checks npm for newer published versions, caches the result, and shows both curl and npm upgrade paths when an update exists |
| Live-profile portrait contract | Done | Public profile payloads now expose `_profile.asciiPortrait`, the CLI preserves `_profile` metadata from `/api/v1/profiles`, and the launcher prefers current public/profile portrait data over stale cached avatar fallbacks |
| Non-duplicated streamed chat greeting | Done | `youmd chat` no longer prints the first assistant turn twice after a successful streamed opening response |
| Proactive CLI repo callouts | Done | `youmd` / `youmd chat` now notice missing AGENTS/project-context wiring in a real repo and suggest `youmd skill init-project` at the right moment |
| U-style npm postinstall | Done | npm install now drops users into a logo-forward “meet U” moment with next moves instead of the old dead `Run: youmd init` text |
| `you`-first onboarding copy | Done | Installer output, register success, init success, onboarding next-steps, and README quickstart now consistently steer users toward `you` as the main alive entrypoint once a bundle exists |
| Raw-markdown identity roundtrip preservation | Done | Richer markdown in preferences/directives/voice files now survives compile → publish → pull instead of being flattened down to only structured top-line fields |
| Resilient full-context links | Done | `/ctx` resolution now treats use-count/view/activity writes as best-effort, returns explicit JSON errors instead of platform 5xxs, sends tokenized context responses with private/no-store cache headers plus `Vary: Accept`, and emits generated links as direct `www.you.md` URLs so agents avoid the apex redirect; production verified with full JSON, text/plain, invalid-token, and ETag checks |
| API key rotation + cleanup UX | Done | Settings pane now supports rotating to one fresh key, bulk revoking all API keys, and copying the newly issued key without revoking other token types |
| Revoked API key history collapse | Done | Settings now shows active keys by default and hides revoked history behind an explicit toggle |
| Revealable active API keys | Done | Newly created or rotated keys can now be shown again by the owner from the settings pane; pre-existing hash-only keys still need one rotate to migrate |
| Verified passwordless sender config | Done | Auth email route now supports `AUTH_EMAIL_FROM` / `RESEND_FROM_EMAIL` instead of being hardcoded to `onboarding@resend.dev` |
| Remote-Convex local auth guard | Done | Local web sessions now mint `https://you.md` Convex JWT issuers when the app is pointed at a remote Convex deployment, avoiding `NoAuthProvider` auth failures during local web QA |
| Cookie-gated redirects + safe `next` | Done | Protected routes (`/shell`, `/dashboard`, `/initialize`) redirect unauthenticated users to `/sign-in?next=/...`; `next` is sanitized to prevent protocol-relative open redirects |
| Username claim | Done | Auto-claim via /initialize (no manual form) |
| Bundle compilation | Done | Server-side via convex/lib/compile.ts |
| Bundle publishing | Done | Version tracking, unpublish previous |
| Public profile pages | Done | SSR, JSON-LD, dynamic metadata |
| OG social cards | Done | Auto-generated per profile |
| Terminal split-screen dashboard | Done | 35% terminal + 65% preview pane |
| Unified SiteNav top bar | Done | Compact nav across all authenticated pages (replaces AppNav side panel) |
| /initialize onboarding | Done | Boot sequence + agent conversation |
| useYouAgent hook | Done | Shared agent logic for all terminal UIs |
| Right pane system | Done | Simplified to 4 panes: profile, edit (files/json/sources sub-tabs), share (hero sharing UX + publish + context links + agent stats), settings (account/keys/billing/activity/help) |
| Markdown file system (Vault) | Done | Browse + edit identity bundle as individual .md files, save back to Convex |
| Memory system (Unified Brain) | Done | Auto-capture, recall in agent context, /memory + /recall commands, search UI, HTTP API, session summaries, archival policies, CLI sync |
| Real-time progress indicators | Done | Claude Code-style activity log showing each async step (scrape, research, LLM, save, publish) with running/done/error status |
| Typewriter message rendering | Done | Latest assistant message streams in with cursor animation |
| Auto-scrape on init | Done | Scrapes existing profile links before first LLM call |
| Auto-research | Done | Perplexity web research for sparse profiles |
| Auto-publish | Done | Every bundle save auto-publishes |
| Deterministic project scaffold in shell | Done | The exact `create my projects directory and subdirectories for each project within my private folder` request now bypasses the fragile LLM mutation path and creates real `private/projects/*` files |
| Production shell bootstrap verification | Done | Live `/api/auth/session` plus authenticated Convex user/profile/private/bundle queries now verified on `www.you.md` after login |
| Shared pane primitives | Done | Consistent UI across all dashboard panes |
| Grouped shell pane navigation | Done | Flat desktop/mobile pane sprawl replaced with grouped primary buckets plus small secondary sub-tabs where needed |
| Source management | Done | Add URLs, view status |
| Pipeline trigger | Done | From dashboard |

## Ingestion Pipeline

| Feature | Status | Notes |
|---|---|---|
| Pipeline orchestrator | Done | 6-stage with job tracking |
| Website scraping | Done | Native fetch, HTML→text |
| LinkedIn scraping | Done | Apify integration wired in useYouAgent |
| X/Twitter scraping | Done | Via scrape endpoint in useYouAgent |
| LLM extraction | Done | OpenRouter, Claude Sonnet |
| Voice analysis | Done | Author voice profile |
| Topic mapping | Done | Expertise graph |
| Bio generation | Done | Short/medium/long variants |
| FAQ generation | Done | Predicted questions |
| Pipeline compilation | Done | Extracted → bundle |

## HTTP API

| Endpoint | Status |
|---|---|
| GET /api/v1/profiles | Done |
| GET /api/v1/profiles (same-origin web proxy) | Done local / deploy pending |
| GET /api/v1/check-username | Done |
| GET /.well-known/mcp.json | Done | Web-domain MCP discovery now proxied through Next to the Convex MCP discovery document with JSON bodies preserved |
| POST /api/v1/mcp | Done | Web-domain MCP transport now proxied through Next to the Convex MCP server with JSON-RPC bodies preserved |
| GET /ctx (context links) | Done |
| POST /api/v1/chat | Done | Web-domain chat proxy now exists through Next so the shell and docs can use same-origin API routes |
| POST /api/v1/chat/ack | Done | Web-domain fast-ack proxy now exists through Next |
| POST /api/v1/chat/stream | Done | Web-domain SSE chat proxy now exists through Next |
| GET /api/v1/docs/reference | Done | Machine-readable generated docs manifest for endpoint/tool counts, route inventory, MCP tools, source hash, and CLI version |
| GET /api/v1/docs/openapi.json | Done | Generated OpenAPI 3.1-style API inventory for reference tooling and future Mintlify-style API docs |
| GET /api/v1/stacks/capabilities | Done deployed | Shared YouStack capability contract and API/MCP threshold map |
| POST /api/v1/stacks/route | Done deployed | Deterministic read-only request routing against default or manifest-supplied YouStack capabilities |
| GET /api/v1/me | Done |
| POST /api/v1/me/bundle | Done |
| POST /api/v1/me/publish | Done |
| POST/GET /api/v1/me/sources | Done |
| GET /api/v1/me/analytics | Done |
| POST /api/v1/me/build | Done |
| GET /api/v1/me/build/status | Done |

## Agent Directives

| Feature | Status | Notes |
|---|---|---|
| directives/agent.md bundle section | Done | Communication style, negative prompts, default stack, decision framework, current goal |
| agent_directives in youJson | Done | Compiled from ProfileData.agentDirectives |
| Agent Directives in youMd | Done | Human-readable section |
| Proactive directive building | Done | Agent observes and infers directives from conversation |
| Directives in share blocks | Done | Context links include directive summary |
| "building" thinking category | Done | 10 new phrases for directive/identity construction |
| Enhanced activity simulation | Done | 7 granular sub-steps during LLM wait (vs 3), faster rotation |
| Portrait updates via tool_use | Done | Web shell now supports portrait/avatar changes on the primary `update_profile` tool path, with JSON fallback only when tools are unavailable |
| Versioned custom-section saves | Done | Web shell custom sections now merge into the compiled bundle + publish path instead of partially overwriting `profile.youJson` |
| Tool-only shell response synthesis | Done | When the model emits valid tool calls but little/no natural-language follow-through, the web shell now synthesizes concrete confirmation copy for updates, memories, fetches, and portrait changes |
| Authoritative turn-history pruning | Done | Completed profile-mutation turns are now stripped from future shell reasoning so later unrelated requests do not re-apply already finished custom-section updates |
| Finalized assistant history storage | Done | Web shell now stores the rendered/synthesized assistant completion text in LLM history instead of only the raw terse model output, improving later turn grounding |
| Project scaffold truthfulness | Done | The shell no longer claims repeated `README/context/prd/todo` updates for project scaffolding without writing the directory tree; production now shows the real scaffolded files under the files pane |

## Intelligent Model Routing

| Feature | Status | Notes |
|---|---|---|
| Model routing config | Done | Named model map: chat, research, verify, x_enrichment, summary, classify |
| Identity verification | Done | Perplexity Sonar Pro cross-references scraped profiles, returns confidence score |
| Parallel verification | Done | Runs alongside research during scraping, injected into agent context |
| Verify HTTP endpoint | Done | POST /api/v1/verify-identity |

## Portrait System

| Feature | Status | Notes |
|---|---|---|
| Multi-image scraping | Done | ALL scraped images saved to socialImages (not just best) |
| Tap-to-select primary | Done | Click any source image to make it primary |
| Real photo + ASCII preview | Done | Each source shows actual photo and ASCII conversion side by side |
| ASCII format modes | Done | Classic ($@B%...), Braille (⣿⣷⣶...), Block (█▓▒░), Minimal (@%#*...) |
| Detail level picker | Done | 60/80/100/120/160 columns |
| 120 col default | Done | High-detail portraits by default (was 80) |
| Format picker UI | Done | Grid selector in PortraitPane |

## Security

| Feature | Status | Notes |
|---|---|---|
| API keys (SHA-256 hashed) | Done | ym_ prefix, scoped |
| Context links | Done | Token-based, TTL, max uses |
| Free tier limits | Done | 1 key, read:public |
| Private vault encryption | Not started | AES-256-GCM, deferred |
| Rate limiting | Not started | Per plan |

## CLI (npm: youmd v0.6.23)

| Feature | Status | Notes |
|---|---|---|
| youmd init | Done | Conversational AI onboarding with BrailleSpinners, ASCII portrait, multi-select |
| you | Done | Friendly shortcut launcher for U chat with portrait scene + proactive intro |
| youmd chat | Done | Ongoing agent conversation with slash commands, project awareness |
| youmd chat EOF handling | Done | Piped/non-interactive chat sessions now exit cleanly on closed stdin instead of crashing with `ERR_USE_AFTER_CLOSE` |
| youmd build | Done | Local compile + thinking phrases |
| youmd publish | Done | Upload + publish to platform |
| youmd login | Done | Email-code auth or `--key` |
| youmd register | Done | Create account from CLI with passwordless verification |
| youmd status | Done | Rich tree-style summary |
| youmd whoami | Done | Profile display |
| youmd add | Done | Add source URLs |
| youmd link | Done | Context link management (create, list, preview, revoke) |
| youmd keys | Done | API key management |
| youmd diff | Done | LCS-based diff vs published |
| youmd export | Done | Export you.json + you.md to disk |
| youmd preview | Done | Local dev server for bundle inspection |
| youmd pull | Done | Pull from web to local |
| youmd push | Done | Push local to web |
| youmd sync | Done | Two-way sync |
| youmd memories | Done | List, add, stats |
| youmd private | Done | Private context management (10 subcommands) |
| youmd project | Done | Per-project context (init, list, switch, context, memory) |
| youmd skill | Done | 18 core subcommands plus aliases: list, install, remove, use, sync, create, add, push, link, init-project, improve, metrics, search, browse, publish, remote, export, info |
| youmd stack | Done local / publish pending | Inspect, smoke-test, list capabilities, route requests, and link host adapters from local YouStack manifests |
| MCP config generation | Done | `youmd mcp --json` / `--install` now emit an unambiguous published-package launcher instead of bare `npx youmd mcp` |
| Authenticated CLI production round-trip | Done | Fresh-account register/login/login-key/whoami/push/pull/diff/status/sync now hard-smoke clean against prod |
| Public-profile vendor JSON handling | Done | CLI now parses `application/vnd.you-md.v1+json`, strips `_profile`, fetches public markdown, and keeps local hashes/sync state aligned |

## Skill System (v1.0)

| Feature | Status | Notes |
|---|---|---|
| Skill catalog (YAML) | Done | youmd-skills.yaml with entries, scope, identity_fields |
| Template engine | Done | {{var}} interpolation against live brain data |
| Bundled skills (9) | In progress | youstack-start, youstack-maintainer, machine-bootstrap, claude-md-generator, project-context-init, voice-sync, meta-improve, proactive-context-fill, you-logs; local catalog/build verified, production registry deploy pending |
| Install / Remove | Done | Global ~/.youmd/skills/ + batch all |
| Use (render) | Done | Interpolate + readiness check + display |
| Sync (re-interpolate) | Done | Manual + auto on push/pull/sync |
| Agent linking | Done | claude (.claude/skills/youmd/), cursor (.cursor/rules/youmd.md), codex |
| init-project | Done | Bootstrap AGENTS/CLAUDE entrypoints, canonical project-context/, generated `.you/`, and host links in one command |
| Managed bootstrap block | Done | Existing AGENTS.md / CLAUDE.md files get one additive You.md-managed block instead of broad rewrites |
| `.you/` generated layer | Done | `.you/AGENT.md`, `.you/STACK-MAP.md`, and `.you/project-context/README.md` scaffolded automatically |
| Per-file project-context scaffold | Done | Fills missing canonical files additively, including `PROMPTS.md` |
| Meta-improvement | Done | Identity coverage bars, unused skill detection, actionable proposals |
| Metrics tracking | Done | skill-metrics.json — uses, installs, identity field references |
| npm packaging | Done | Skills shipped with package in cli/skills/ |
| Push/pull hooks | Done | Auto re-interpolate installed skills on identity changes |
| Onboarding integration | Done | youmd init offers skill init-project when project detected |
| Status integration | Done | Skills count + identity coverage bar in status output |
| Bundled skill catalog upgrade merge | Done | Existing local YAML catalogs auto-merge new default bundled skills on upgrade |
| Web: SkillsPane | Done | Dashboard tab with catalog, CLI commands, how-it-works |
| Web: /skills command | Done | Slash command + help text |
| Skill registry | Done | Convex tables (skills + skillInstalls), 9 HTTP endpoints, web SkillsPane — completed 2026-03-27 |
| Ship-readiness audit evidence | In progress | Browser session auth, production shell hydration, production email delivery, real API-key issuance, live CLI `whoami` parity, local browser auth re-verification, and a fixed browser-level mutation replay repro are now verified; broader web-agent personality/proactiveness audit still pending |
| Browser-auth parity audit | Done | Passwordless auth stack now validated locally, on dev, and in a fresh real browser session on `you.md`; remaining quality work is shell behavior/personality, not browser auth plumbing |
| Web shell first-response latency hardening | Done | Shell no longer waits on `/api/v1/chat/ack` before streaming the real answer, and blank streams now surface an explicit fallback message |
| Web shell thinking animation parity | Done | Active thinking line now rotates through subtask-aware phrases with a sweep/shimmer treatment, and the activity log keeps running work visually prominent in real time |
| Web shell completion follow-through | Done | Working state now stays alive through response drafting plus save/publish work, and mutation-heavy turns end with a deterministic completion summary plus proactive next-step options above the green notices |

## Design System (PRD v2.3)

| Feature | Status | Notes |
|---|---|---|
| Monochrome + burnt orange palette | Done | CSS custom properties |
| JetBrains Mono + Inter | Done | next/font/google |
| Dark mode default | Done | .light class toggle |
| Terminal panel component | Done | CSS class |
| PixelYOU canvas logo | Done | 3-layer shadow algorithm |
| ASCII portrait system | Done | HeroPortrait, AsciiAvatar, Generator |
| Glass navbar | Done | --flag navigation |
| FadeUp animation | Done | IntersectionObserver |
| Boot sequence typewriter | Done | 55ms/char |
| ThemeToggle | Done | Dark/light/system |
| Section label format | Done | ── LABEL ── |

## Landing Page Sections

| # | Section | Status |
|---|---|---|
| 1 | Glass Navbar | Done |
| 2 | Hero (PixelYOU + boot + ASCII) | Done |
| 3 | Founder Quote | Done |
| 4 | Profiles Showcase | Done |
| 5 | Problem Strip | Done |
| 6 | How It Works | Done |
| 7 | What's Inside | Done |
| 8 | Portrait Generator | Done |
| 9 | Open Spec | Done |
| 10 | Integrations | Done |
| 11 | Pricing | Done |
| 12 | CTA Footer | Done |

## Recently Added (March 24-25)

| Feature | Status | Notes |
|---|---|---|
| Passwordless CLI auth | Done | No manual API token required for your own account |
| Server-side ASCII portrait generation | Done | convex/portrait.ts + DB caching |
| BrailleSpinner color rotation + lightsweep | Done | Orange shades, text lightsweep |
| CLI ASCII YOU logo | Done | Block-char logo in burnt orange |
| CLI multi-select UI | Done | Arrow keys + select for agents/tools |
| Markdown rendering on profile | Done | No more raw bold/heading markup |
| Richer profile cards in directory | Done | Bio, projects, social links |
| SSR profiles directory | Done | SEO: no more empty loading state |
| Profile breadcrumbs + rel=me | Done | SEO enhancement |
| Dynamic custom sections | Done | Agent can add/modify sections via chat |
| Persistent chat sessions | Done deployed | Messages survive page refresh; shell sidebar now lists recent saved Convex sessions, New Chat starts a fresh persisted session id, and clicking a saved session owner-gates then hydrates that chat history back into the terminal |
| Streaming responses via SSE | Done | Real-time token output |
| Portrait pane wired to real data | Done | Multi-source, format picker, detail picker |
| CLI rich terminal renderer | Done | Tables, stats, code blocks, callouts |
| Private context API + CLI | Done | Full CRUD on private brain data |
| Image paste in chat | Done | Web chat accepts pasted images |
| Full-height shell workspace | Done local | `/shell` now drops the old terminal-window chrome and centered frame in favor of a full-height Codex/Lovable-style app workspace with a persistent far-left sidebar, New Chat/Search actions, Projects/Skillstacks/Automation/Access groups, synced GitHub repo status, desktop resizable chat/detail split, and a cleaner bottom command composer. Local browser QA covered desktop, mobile, sidebar crawler navigation, and no mobile horizontal overflow |
| Shell opening intelligence brief | Done deployed | New blank shell sessions now use available real Convex context and ask the You Agent to greet the user by display name, acknowledge concrete recent activity/milestones from bundle version, projects, memories, saved sessions, and repo mirror status when loaded, then suggest useful next moves. A deterministic local fallback brief keeps the transcript useful if the streamed model returns a stub. New Chat now triggers the richer greeting, and half-empty restored sessions with no assistant reply are skipped so a stray `repo` command cannot become the blank shell state |
| Shell polish pass | Done local / prod visual pending | Logged-in shell/dashboard surfaces hide the global top nav, the left sidebar auto-compacts when the split needs room, chat width is protected by pixel and percentage clamps, saved narrow split widths migrate up to the new default, sidebar rows no longer use bulky bordered pills or permanent subtext, and account/usage/settings/signout/theme controls now live in a bottom sidebar popout. Production visual approval remains pending |
| Shell right-pane responsiveness | Done deployed / visual approval pending | The artifact pane no longer repeats a local title/subtitle beside the active tab. Primary tabs are now one scroll-safe rail with `api` promoted and `portrait` named clearly; split mode is large-screen only while medium widths keep sidebar/top action chrome and use the full-width shell/preview toggle. Desktop split protects both chat and detail widths, and the compact profile inspector wraps long identity/project/link text without horizontal clipping. Follow-up deployment `dpl_n4ZMQ6dv3vHwj2RimFBBwaTfkd4x` reached Ready and GitHub CI `27595879145` passed |
| Collapsed shell rail + top action chrome | Done deployed / visual approval pending | Collapsed `/shell` now caps the skinny rail to 8 total clickable controls, uses the homepage PixelYOU mark instead of the text `you.md` wordmark, keeps the left collapse icon scoped to the left sidebar, and moves the right-pane toggle plus GitHub/update/publish/deploy actions into a desktop top shell chrome row. Expanded sidebar groups now default closed as disclosure rows for Projects/API/Skillstacks/Connect/Identity/Chats. Local browser QA confirmed 56px rail width, 4 collapsed nav icons, 8 total clickable rail controls, closed expanded groups, top controls, and protected chat width; Vercel deployment `dpl_A3HW3Rx76DZbJXm4uyUBKT6ajk4G` reached Ready |
| Shell composer attach + voice polish | Done deployed / visual approval pending | The main chat composer no longer renders the orange `>` prompt glyph or inner orange input outline; focus now highlights only the outer composer shell. The bottom utility row has a standard `+` attach control for images and readable text/code files plus a `cmd/ctrl shift m` voice shortcut affordance using browser speech recognition where available, with a clean fallback path for future Whisper-backed transcription. Vercel deployment `dpl_7D9YbyHQDKBWehQ2VxnGPiSL8MTm` reached Ready and authenticated production browser QA confirmed the focused textarea has `outline: none` / `box-shadow: none` while the outer composer owns the orange outline |
| Shell logo/sidebar toggle polish | Done deployed / visual approval pending | The separate Lucide left-sidebar toggle beside the YOU mark is removed. The PixelYOU mark is now the sidebar toggle itself, and hover subtly swaps the logo into a two-line menu glyph. The collapsed mark was further tightened to `scale(.094)` inside a 36px viewport so `YOU` fits cleanly in the skinny rail; deployment `dpl_3K5S5n446oTqL2qDvZbUXraubqdc` reached Ready and authenticated production visual QA confirmed the fit. The right-pane toggle moved out of the left side of the top chrome and into the far-right top chrome using a cleaner minimal side-panel glyph |
| Personal API/MCP stack gateway | Done local / deploy pending | Connectors pane now has owner tabs for `api/mcp`, `apps`, `crawlers/loops`, and `repo`. The `api/mcp` tab shows the user's private REST/MCP/stack endpoint docs, auth header contract, resource map, route table, live connected-app grant list, and copyable agent-ready snippets for hosted MCP config, local host adapter install, REST smoke checks, and scoped session startup. The shell navigation now labels this surface as `connect` -> `api/mcp`, and `/api`, `/mcp`, `/connectors`, `/apps`, `/crawlers`, `/crons`, and `/loops` all route there. The `apps` tab adds a Lovable-style searchable connector catalog with pinned You.md/owned-project connectors, Custom API, Custom MCP, Custom Webhook, and popular third-party services; catalog entries can create/revoke scoped `yg_` app grants. The `crawlers/loops` tab embeds source/crawler/cron/version/provenance controls, while GitHub repo sync now lives under its own `repo` connector tab. Architecture note captured in `project-context/PERSONAL_API_MCP_STACK_SURFACE_2026-06-15.md` |
| Codex MCP local-vs-global split | Done | Codex uses the local `cli/dist` build inside the youmd repo and the published npm CLI everywhere else |
| Curl-first landing/docs/help install path | Done | Hero, footer, docs, and in-app help now teach `curl -fsSL https://you.md/install.sh | bash` first while keeping npm as the fallback |
| Profile directory responsive controls | Done | `/profiles` create CTA, filters, sort, and list/grid toggles now use compact responsive app-control styling |
| Local agent browser auth handoff | Done local / deploy pending | `youmd login` now uses an Enter-to-open `/auth` browser approval flow, `/auth` shows a branded portrait-aware success confirmation for web + local agent auth, the curl installer source-installs GitHub `main` by default before falling back to npm, and fresh `you` sessions now guide login/pull/init into sync/status/chat without guessing. CLI remains bumped/built as `0.8.2` pending npm OTP publish |

## Feature Requests (Backlog)

- [ ] Custom image upload to socialImages.custom
- [ ] Download ASCII portrait as PNG
- [ ] Reveal/copy existing API key (not revoke-to-create)
- [ ] Dynamic profile sections via conversation
- [ ] Agent share prompt directives (tell receiving agent how to respond)
- [ ] Verified badges (domain, social, DNS TXT)
- [ ] Profile analytics dashboard (views, agent reads, top queries)
- [ ] Freshness score (4-dimension state)
- [ ] Activity timeline on profile
- [ ] Role icons on profiles (Founder, Engineer, Designer)
- [ ] Count-up animations on all metrics
- [ ] Status pulse (ACTIVE dot)
- [ ] Composio OAuth for platform connections
- [ ] Framework integration PRs (Aider, CrewAI, LangChain)
- [ ] MCP endpoint (mcp.you.md/{username})
- [ ] Stripe Pro plan ($12/mo)
- [ ] Interview mode (youmd interview)
- [ ] Autonomous refresh (youmd refresh)
- [ ] Voice onboarding
- [ ] Team/org bundles
- [ ] Standalone CLI binary (bun build --compile)
