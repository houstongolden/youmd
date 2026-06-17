# You.md — Current State

Last Updated: 2026-06-17
Latest Verified Production Web Commit: 052507c fix(web): install youmd without sudo
Latest CLI Publish Workflow Commit: 4a0d97a ci: align npm trusted publishing workflow

---

## What's Deployed and Working

### Web App (you.md via Vercel)
- Landing page with all 12 sections
- Terminal-style auth (sign-in, sign-up, reset-password) — sequential prompts, no forms
- Dashboard with 35/65 terminal split, 4-pane system (profile, edit, share, settings)
- Public profile pages with SSR, JSON-LD, OG cards, breadcrumbs
- Profiles directory with search/filter
- Docs page with Claude Code integration guide plus a full YouStacks chapter covering named stack portfolios, self-improving stack/skill loops, GStack/GBrain reference intelligence, use cases, install flow, manifest, examples, API/MCP threshold, generated stack endpoint reference, and stack MCP tools
- Docs now frame YouStacks as runtime-first rather than CLI-first: one curl install, native maintainer skill, auto-upgrade helper, shell/profile management, and BAMFStack as the public lighthouse example
- SiteNav top bar across all pages
- /initialize onboarding boot sequence + agent conversation
- You Agent chat with streaming responses, thinking indicators, progress steps
- The shell thinking line now rotates through active/completed subtask-aware phrases with a live braille spinner and sweep/shimmer treatment instead of freezing on one stale status string
- The shell no longer drops out of “working” state on first streamed token — it stays visibly active through the save/publish tail and now ends with a stronger completion follow-through when real mutations happened
- Markdown file vault (browse, edit, save identity files)
- Memory system (auto-capture, recall, search, /memory + /recall commands)
- Session persistence (messages survive page refresh)
- Agent directives (proactive inference of communication preferences)
- Portrait system (multi-source, format/detail picker, tap-to-select primary)
- Share pane (publish, context links, agent-specific prompt templates, stats)
- Activity/security logs wired to real Convex data
- Sources pane with real mutations (add URL, view status, pipeline stats)
- Files pane with keyboard shortcuts (Cmd+S), markdown preview, create new file
- Settings pane now supports `rotate key` and `revoke all keys`, which gives users a sane way to clean up API-key sprawl without revoking unrelated token types
- Revoked API keys are now hidden behind an explicit history toggle, so the default settings view reflects the real active-key state instead of surfacing the graveyard first
- Newly created or rotated API keys can now be revealed again from the settings pane by their owner, while older pre-migration hash-only keys correctly prompt a one-time rotate
- Same-origin web chat routes for the shell: `/api/v1/chat`, `/api/v1/chat/ack`, and `/api/v1/chat/stream`
- Same-origin web MCP routes: `/api/v1/mcp` and `/.well-known/mcp.json` proxy through the web domain with JSON bodies preserved
- Tokenized `/ctx/<username>/<token>` links now fail safely and serve reliably for agents: valid links return `you-md/v1` JSON with `_privateContext`, tracking/logging writes are best-effort, invalid links return explicit JSON errors, and deployed responses use private/no-store cache headers with `Vary: Accept`
- Deterministic shell project scaffolding for the `create my projects directory...` golden path, with real `private/projects/*` files now verified on production
- Shell pane navigation is now grouped into clearer primary buckets with secondary sub-tabs where needed instead of exposing the full flat tab sprawl on desktop and mobile
- Local `/shell` now has a Portfolio Graph pane for project goals, API/MCP ownership, dependency edges, protected harness vs public stack boundaries, reusable patterns, and shared skill propagation across You.md/BAMF targets
- Local `/shell` left sidebar expand/collapse is fixed and authenticated-verified: manual clicks now override the responsive auto-collapse state below `1520px` while preserving the narrow-width auto default until the user explicitly chooses expanded or collapsed. Visual QA on `http://localhost:3100/shell` verified the sidebar toggles `56px -> 244px -> 56px`, swaps `Expand sidebar` / `Collapse sidebar`, and renders expanded labels such as `new chat`, `projects`, `personal api`, `skillstacks`, `connect`, and `identity`. Screenshots: `/tmp/youmd-sidebar-expanded-auth-2026-06-17.png` and `/tmp/youmd-sidebar-collapsed-auth-2026-06-17.png`.
- The Portfolio Graph pane now hydrates from real active project data instead of stopping at the 4-project bootstrap seed. `portfolio.syncTrackedProjects`, `POST /api/v1/me/portfolio/projects/hydrate`, `youmd project portfolio-hydrate`, and local MCP `hydrate_portfolio_graph` hydrate `portfolioProjects` from authenticated 90-day GitHub `trackedProjects` plus filtered `portfolio-graph-auditor` local output. `portfolioProjectActivities` stores commit/PR/summary evidence so cards show shipped chips (`today`, `7d`, `30d`) and a shipping timeline per project. Authenticated local browser QA on `/shell` verified `55 PROJECTS`, `CONVEX PERSISTED GRAPH`, `40 recent GitHub-tracked projects nearby`, the `hydrate active projects` control, high-signal ordering with `bamfsite`, `youmd`, `fantasyis`, and `bigbounce` first, and rows including `badapp`, `bamfaiapp`, `bamfsite`, `bigbounce`, `foldermd`, `youmd`, `claws`, and `creator-new`.
- The Portfolio Graph project browser now has a compact operating view with search, focus filter, sort, density toggle, direct `/shell?project=<slug>` detail deep links, a top-level shipped pulse for `today` / `7d` / `30d` / `90d`, row-level shipped counters, and selected-project detail panels that show project links, API/MCP/stack surface docs URLs, curl/install commands, associated stack, focus/goal, and dependency snapshot. API/MCP/stack surfaces now persist exact docs URLs, integration types, and `curlCommand` values into Convex and repo-backed `projects/_portfolio/graph.md` / `graph.json` snapshots. Project focus status/rank is persisted in Convex via owner-gated `portfolio.updateProjectFocus`; the UI has a timeout guard so a pre-deploy backend mismatch cannot leave the focus dropdown permanently disabled. Authenticated Codex in-app Browser proof verified direct `/shell?project=youmd` routing, shipped pulse, compact list controls, You.md API docs/curl, YouStack install command, and row-level focus mutation by changing `bamfsite` to `focusing` and back to `unset`. Screenshots: `/tmp/youmd-portfolio-shipped-deeplink-controls-2026-06-17.png` and `/tmp/youmd-portfolio-compact-list-controls-2026-06-17.png`.
- Follow-up local Portfolio Graph polish makes the shipped work visibly concrete: the shipped pulse now says `Me + agents, shipped across the portfolio`, shows top shippers plus latest shipped commit/PR/release titles, selected project details show `latest shipped here`, compact rows label shipped counters, and row focus dropdowns show full ranked labels. Authenticated Codex in-app Browser QA verified the shipped board, You.md `latest shipped here`, the `PROJECT GRAPH LINKS` docs/curl/install/clone block, real `View timeline for youmd` anchor scrolling to `#timeline`, and a reversible `bamfsite` focus mutation (`focusing / 2` -> `unset / 4`). Screenshots: `/var/folders/4n/hqpz_03d477c1f_m2ks7x18c0000gn/T/youmd-portfolio-detail-shipped-graph-links-2026-06-17.png`, `/var/folders/4n/hqpz_03d477c1f_m2ks7x18c0000gn/T/youmd-portfolio-graph-links-curl-2026-06-17.png`, and `/var/folders/4n/hqpz_03d477c1f_m2ks7x18c0000gn/T/youmd-portfolio-timeline-shipped-focus-2026-06-17.png`.
- Production follow-up on `https://www.you.md/shell?tab=portfolio&project=youmd#project-detail` verified the same shipped/focus UI is live on the custom domain, then caught and fixed a URL hygiene issue where timeline clicks from an existing detail hash could produce `#project-detail#timeline`. Post-deploy production QA now verifies timeline clicks replace the URL with clean `https://www.you.md/shell?tab=portfolio&project=youmd#timeline` while keeping the shipping timeline in view; screenshot `/var/folders/4n/hqpz_03d477c1f_m2ks7x18c0000gn/T/youmd-production-clean-timeline-anchor-2026-06-17.png`.
- The Portfolio Graph selected-project detail page now also joins matching recent GitHub-tracked project metadata and renders a `PROJECT GRAPH LINKS` block with stack/stack slug, repo evidence, exact API/MCP docs URLs, owner-gated portfolio graph curl command, docs curl commands, stack install command, and clone command. `details` and `timeline` row controls are anchored deep links (`#project-detail` and `#timeline`) that scroll to the actual section after updating `?tab=portfolio&project=<slug>`. `GET /api/v1/me/portfolio/graph` project rows now include project-level `apiDocsUrl`, `mcpDocsUrl`, `stackSlug`, `repoName`, `directoryName`, and `curlCommand` fields for local agents. Authenticated Codex in-app Browser proof verified the You.md detail block, YouStack `/youstack`, `you.md/api/v1/docs/reference`, `.well-known/mcp.json`, graph/docs curl commands, `curl -fsSL https://you.md/install.sh | bash`, `git clone https://github.com/houstongolden/youmd youmd`, owned You.md API/MCP surfaces, and a real `View timeline for youmd` click scrolling to `#timeline`.
- Portfolio Graph strategy enrichment now runs through the same local-agent hydrate path. `youmd project portfolio-hydrate --root /Users/houstongolden/Desktop/CODE_2025 --days 90 --limit 80` reads README plus `project-context` PRD, overview, tasks, design, research, and ideas files, filters setup/build/PRD-title boilerplate, redacts secret-like values, and persists strategy fields for 30 enriched active projects. Verified persisted graph state: `55` projects, `30` enriched strategy records, `5` tasks, `0` known bad setup/PRD-title snippet matches, refreshed `40` GitHub-tracked rows and `30` local-audit rows. Authenticated Codex in-app Browser QA verified the Portfolio pane's `STRATEGY INTELLIGENCE` section for `bamfsite` with private BAMF OS API/MCP context and screenshot `/tmp/youmd-portfolio-strategy-section-2026-06-17-v4.png`.
- Portfolio Graph reusable pattern mining now runs through the same compiled local-agent hydrate path. The scanner reads active project file/path/dependency signals without reading `.env.local` values, mines code/UI/auth/layout/streaming/env/task/project-context patterns, and persists them into `portfolioReusablePatterns` with usage projects and source-path evidence. Verified run: `youmd project portfolio-hydrate --root /Users/houstongolden/Desktop/CODE_2025 --days 90 --limit 80` mined `8` reusable pattern families from `30` projects / `8240` signal files, then updated persisted graph state to `11` patterns total. Authenticated API proof verified `agent-streaming-progress`, `agentic-shell-layout`, `api-mcp-skillstack-first`, `first-party-passwordless-auth`, `task-braindump-router`, `convex-owner-gated-api`, `env-provider-intelligence`, and `project-context-operating-docs`, with no `_generated` evidence paths in the sample. Authenticated Codex in-app Browser QA verified the Portfolio pane renders `REUSABLE PATTERNS`, scanner evidence, usage projects, and source-path evidence; screenshot `/tmp/youmd-reusable-patterns-scanner-proof-2026-06-17-v2.png`.
- Persisted Portfolio Graph records now export back into the linked GitHub repo during normal identity sync as `projects/_portfolio/README.md`, `projects/_portfolio/graph.md`, and compact mirror-safe `projects/_portfolio/graph.json`. Authenticated Codex in-app Browser QA clicked `[ update ]`, merged PR #15 in `houstongolden/houstongolden-you-md`, verified all three files in the pushed list, and refreshed the server mirror to 53 files; `graph.json` is 114299 bytes on GitHub, below the mirror cap.
- Shell chat now has first task/brain-dump write paths: `/task ...` creates owner-aware human/agent `portfolioTasks`, `/braindump ...` preserves raw captures and proposed tasks in `brainDumpCaptures`, both write repo-backed markdown snapshots into `you.json.custom_files`, and both can trigger the publish -> GitHub PR push -> mirror refresh loop from chat. Authenticated Chrome QA verified `/braindump project:youmd ...` through merged PR #7 and `/task me personal: ...` through merged PR #8; the Portfolio Graph pane showed `HUMAN / PERSONAL`, `RECENT BRAIN DUMPS`, and GitHub chrome returned to `SYNCED / REPO MIRROR CURRENT / JUST NOW`.
- Follow-up authenticated Codex in-app Browser QA found and fixed a real shell-chat blocker: a stalled opening greeting could leave `isThinking` true and prevent deterministic `/task`, `/braindump`, and fresh-machine commands from running. Portfolio/fresh-machine commands now route ahead of the generic thinking guard. The browser proof then submitted `/braindump project:youmd ...` through the actual shell composer, saved the raw capture, proposed one agent task, wrote `projects/_braindumps/recent.md`, published bundle `v127`, queued the repo sync from shell chat, merged identity sync PR #19, refreshed 53 mirror files, and returned the GitHub chrome to `SYNCED / REPO MIRROR CURRENT / JUST NOW`. GitHub read-back confirmed `projects/_braindumps/recent.md` on `main` contains the `2026-06-17T1703Z` proof text, `shell-chat-proof` tags, and proposed agent task; screenshot `/tmp/youmd-shell-chat-braindump-sync-pr19-2026-06-17.jpg`.
- Follow-up authenticated Codex in-app Browser QA then proved the project-scoped `/task` shell path from the same local shell, not just via CLI/API. The browser verified `55 PROJECTS`, the shipped pulse with `today` / `7d` / `30d` / `90d`, clickable `details` / `timeline` links, compact project search/focus/sort controls, full ranked focus labels, and the You.md detail page's exact graph/API/MCP/stack links and commands. Submitting `/task agent youmd: web shell portfolio sync proof 20260617T175421Z ... #shell-sync-proof #portfolio-task-proof` saved an agent-owned task, wrote `projects/youmd/tasks.md`, published bundle `v129`, opened and merged identity sync PR #20, refreshed 53 mirror files, moved the Portfolio task graph to 7 open items, and returned the GitHub chrome to `SYNCED / REPO MIRROR CURRENT / JUST NOW`. GitHub read-back confirmed the exact task entry on `main`; screenshots `/tmp/youmd-portfolio-detail-shipped-links-proof-2026-06-17.png` and `/tmp/youmd-shell-task-github-sync-proof-2026-06-17.png`.
- Local-agent API/CLI/MCP writes now share that same portfolio task and brain-dump path. Authenticated CLI QA saved a project-scoped agent task through `youmd project task`, wrote `projects/youmd/tasks.md`, published bundle v100, pushed/merged PR #9, and refreshed the mirror. A follow-up `youmd project braindump` saved the raw capture plus proposed agent task, wrote `projects/_braindumps/recent.md`, published bundle v102, pushed/merged PR #10, and refreshed the mirror to 50 files. Authenticated local browser QA then verified both rows in the Portfolio Graph pane with green/current GitHub status. Follow-up added first-class Portfolio Graph `TASK TRIAGE` controls plus `portfolio.updateTaskTriage`, `POST /api/v1/me/portfolio/tasks/triage`, and MCP `update_portfolio_task`; authenticated local browser QA moved a no-sync task to `urgent`, then `in_progress`, then `done`, and API/local-agent proof triaged a no-sync task to `done / urgent` without a GitHub push. Follow-up richer-task visual QA created task `rx74n65a3t2e9ew1hqk76xxkn588vy84` via `youmd project task ... --no-sync`, verified it rendered in `TASK TRIAGE`, used dashboard controls to route it from `OPEN / LOW / AGENT / YOUMD` to `IN_PROGRESS / HIGH / HUMAN / HOUSTON / PERSONAL`, then clicked `DONE` and verified the active task count returned to `5`. Screenshots: `/tmp/youmd-task-controls-pre-update-2026-06-17.png` and `/tmp/youmd-task-controls-post-update-2026-06-17.png`.
- Local `/shell` now has an APIs + Env Intelligence pane for provider usage, env key-name normalization, service-account notes, API/MCP risk tiers, and secret-safe local audit commands. Follow-up persistence added owner-gated `portfolioProviderAccounts`, `portfolio.listProviderAccounts`, `portfolio.upsertProviderAccount`, `portfolio.syncProviderAccountSeed`, and project-scoped provider accounts in `getProjectSlice`. Authenticated Codex in-app Browser QA verified `CONVEX PERSISTED ACCOUNT NOTES`, `persisted 0 new / 4 refreshed provider account notes`, no raw `sk-*` secret pattern in the rendered browser payload, and screenshot `/tmp/youmd-api-env-provider-accounts-persisted-proof-2026-06-17.png`.
- `youmd project portfolio-hydrate --root /Users/houstongolden/Desktop/CODE_2025 --days 90 --limit 80` now runs the real local auditor/hydration path: the auditor found 268 project/package candidates, 23 env files, and 97 providers without printing secrets; hydration scanned 129 recent local candidates, upserted 30 local projects, considered 40 GitHub tracked projects, created 36 portfolio rows / updated 4 on the initial corrective run, then final deployed reruns refreshed 40 tracked rows and 30 local-audit rows without duplicates.
- `youmd project portfolio-hydrate` now also synthesizes active-project strategy fields from local docs and recent activity, including numbered PRD sections and broader `project-context/overview.md`, `tasks.md`/`tasks.json`, `design.md`, `research.md`, and `ideas.md` files where present. The synthesizer skips setup-only README fragments such as `.env.example`, local preview URLs, build commands, and PRD title blocks.
- The shell `[ update ]` GitHub control now runs the real publish -> repo push -> mirror refresh loop, streams those steps into shell chat, and was authenticated-Chrome verified locally returning from `SYNCING` to `SYNCED / REPO MIRROR CURRENT / JUST NOW` after merging PR #5 in the linked `houstongolden/houstongolden-you-md` repo
- Production signed-in dashboard verification now passed on Vercel deployment `dpl_4DDQihfn488MFgJtMjUkomBFmyPZ`, aliased to `https://www.you.md` / `https://you.md`: authenticated `/api/auth/session` returned `@houstongolden`; production `/shell` rendered the Portfolio Graph with `55 PROJECTS`, `CONVEX PERSISTED GRAPH`, `40 recent GitHub-tracked projects nearby`, `TASK TRIAGE`, and `REUSABLE PATTERNS`; production task `rx795skqcg5xjenrra3qdw39fs88vcbf` was routed via dashboard controls from `OPEN / LOW / AGENT / YOUMD` to `IN_PROGRESS / HIGH / HUMAN / HOUSTON / PERSONAL`, then marked done and active task count returned to `5`; the production sidebar toggled `56px -> 244px -> 56px`; and production `[ update ]` published v124, merged identity sync PR #17, refreshed 53 mirror files, and returned the GitHub chrome to `SYNCED / REPO MIRROR CURRENT / JUST NOW`. Screenshots: `/tmp/youmd-production-task-controls-pre-update-2026-06-17.png`, `/tmp/youmd-production-task-controls-post-update-2026-06-17.png`, `/tmp/youmd-production-task-controls-done-2026-06-17.png`, `/tmp/youmd-production-update-final-2026-06-17.png`, `/tmp/youmd-production-sidebar-expanded-2026-06-17.png`, and `/tmp/youmd-production-sidebar-collapsed-2026-06-17.png`.
- Follow-up authenticated local Codex in-app Browser verification on `http://localhost:3100/shell?project=youmd` proved the latest Portfolio Graph UI and the GitHub sync chrome together after the direct-detail/shipped-pulse push. The shell started at `SYNCED / REPO MIRROR CURRENT / 2H AGO`, `[ update ]` switched it to the live `SYNCING / PUBLISHING, PUSHING, AND REFRESHING THE REPO MIRROR` state, then published `v126`, opened and merged identity sync PR #18, checked the GitHub merge gate/no-conflict state, refreshed 53 mirror files, and returned the chrome to `SYNCED / REPO MIRROR CURRENT / JUST NOW`. GitHub read-back shows PR #18 merged at `2026-06-17T16:48:04Z`; screenshot `/tmp/youmd-local-github-sync-just-now-pr18-2026-06-17.jpg`.
- Local `/shell` now has a signed-in Machine readiness pane under `stacks -> machine` and `/machine`. It reads localhost-only, authenticated, secret-safe machine metadata for resident sync daemons, project clone/package/env-doc readiness, shared skill mirrors, Codex/Claude MCP config presence, and encrypted env-vault tooling. Authenticated Codex in-app Browser QA verified the current root view on `http://localhost:3100/shell`: `3/3` daemons loaded, `61` project directories scanned, `35` git repos, `32` package projects, `17` `.env.local` files, `19` env examples, `21` agent-doc roots, `21` project-context roots, `api key present READY`, env audit/backup/restore scripts ready, `secret values exposed: false`, and fresh-root `CODE_YOU` empty-target blockers. Screenshots: `/tmp/youmd-machine-readiness-pane-2026-06-17-v2.png` and `/tmp/youmd-machine-readiness-stack-env-proof-2026-06-17-v2.png`.
- Fresh-machine proof mode now has an explicit env-vault done-ness guard. A new clean-root proof at `/tmp/youmd-fresh-machine-proof-20260617T183447Z/CODE_YOU` cloned `youmd`, `agent-shared`, `bamfsite`, `houstongolden-you-md`, and `bamfaiapp` from the persisted Portfolio Graph / recent GitHub merge, verified correct remotes, and synced a secret-safe machine proof row with `5` scanned projects and `secretValuesExposed: false`. Because no real encrypted vault file or Keychain-stored vault passphrase was available in this session, readiness correctly reports `needs-env` for the app repos. `youmd machine prompt --require-env-vault` now emits `YOUMD_REQUIRE_ENV_VAULT=1`, and both the CLI and web-shell generated commands fail before completion if `YOUMD_ENV_VAULT` is missing, preventing agents from treating no-env setup as done. Post-push proof: GitHub CI and Convex Deploy passed on `bf4f5e4`, Vercel production deployment `youmd-cn8vux75k-hubify.vercel.app` is ready, the hosted bundled-skill registry was reseeded, and public `/api/v1/skills?name=machine-bootstrap` now returns the strict env-vault instructions.
- Local `/skills` now has a readable local-agent sync proof strip showing `7/10 skills synced`, `portfolio-graph-auditor`, `meta-improve`, `proactive-context-fill`, `get_agent_brief + portfolio graph`, and tracked propagation across `youmd`, `bamfaiapp`, and `bamfsite`; the prior bright orange explainer regression is fixed and screenshot-verified at `/tmp/youmd-skills-pane-sync-proof-2026-06-17-v2.png`
- Homepage now has a first-class YouStacks section that explains stacks as "your own GStack" for packaging expertise, skills, sub-agents, prompts, workflows, taste, examples, tool rules, safe You.md memory access, and improvement loops; it now explicitly supports naming separate stacks for coding, scientific research, content creation, and other domains, teaches curl-first runtime install instead of a CLI-first mental model, and shows GStack/GBrain reference patterns guiding the architecture

### CLI (youmd v0.8.2 — local build / npm publish pending)
- 30 commands, including project portfolio, task, brain-dump, machine, stack, and skill flows
- Skill system: install, remove, use, sync, create, publish, browse, link, init-project, improve, metrics, export, info, remote
- Bundled skills now include `youstack-maintainer`, which lets host agents organize, update, improve, smoke, and prepare named YouStacks for private/scoped/public sharing with owner approval
- Bundled skills now include `machine-bootstrap`, which teaches host agents to set up a fresh Mac/laptop/virtual agent host with You.md auth, local bundle sync, shared skills/stacks, GitHub auth, and active project repo checkout
- `youmd machine projects` now creates a Desktop code workspace such as `~/Desktop/CODE_YOU`, merges authenticated GitHub repos pushed in the last 90 days with local You.md project records, uses GitHub repo names as target directories, tags associated stacks, attaches API/MCP docs links, skips broad duplicate bundle entries, asks before older projects, supports dry-run/directory-only modes, and clones with `gh repo clone` or `git clone`
- The authenticated web GitHub connector refresh now has current visual proof: local `/shell?integration=github` ran `refresh active projects`, completed the analyzer, and displayed 38 GitHub project rows with repo, dir, stack, API/MCP docs, goal, and recent progress fields; the shell GitHub status returned to `JUST NOW`
- `youmd project portfolio-audit` / `env-audit` / `apis` now scan local project folders and `.env.local` key names without printing secret values; optional `--fingerprints` uses a local salted HMAC prefix to detect reused key values without exposing the raw secret
- `shared:` skill catalog sources now resolve from the canonical `.agent-shared` skill root and generated host mirrors, so shared local skills such as `portfolio-graph-auditor` can be installed through `youmd skill install`; this machine now has 7/10 skills installed after syncing `portfolio-graph-auditor`
- CLI ↔ Convex skill sync (installs, usage, and removals auto-sync to server)
- Conversational AI onboarding with BrailleSpinners, ASCII logo, portrait rendering
- Passwordless email-code auth (no API token required for your own account)
- `youmd login` now clearly splits the auth paths: press Enter for browser sign-in, type your email for in-terminal code login, or use `--key` for direct agent auth
- Install/login/register/init/onboarding copy now consistently points users toward `you` as the main "meet U" terminal path once they have an identity bundle, instead of over-indexing on `youmd chat`
- `youmd logout` now exists and clears stale local auth state from `~/.youmd/config.json`
- CLI auth now forces production defaults for `apiUrl` / `appUrl` on fresh logins and resolves those URLs per request instead of caching a stale dev endpoint at process start
- npm publish retry path is fixed: the next release target is `0.6.23`, package metadata is normalized, the trusted publish workflow matches current npm GitHub Actions guidance, and the built CLI, MCP user-agent, and MCP serverInfo now match that version cleanly
- The exact npm Trusted Publishing setup command has been validated with npm's current CLI shape: `npx npm@11.15.0 trust github youmd --repo houstongolden/youmd --file publish-cli.yml --allow-publish --yes`. It resolves to package `youmd`, repository `houstongolden/youmd`, workflow `publish-cli.yml`, and publish permission; running it for real still requires an npm login with package write access and 2FA.
- Local YouStacks foundation is implemented: `youmd stack inspect`, `smoke`, `capabilities`, `route`, and `link` support local/static stack validation, named stack identity, domain metadata, improvement/update policy, deterministic routing, and Claude Code/Codex/Cursor adapter generation
- `https://you.md/install.sh` now acts as the runtime installer: source install by default, npm fallback, native skills install, auto-upgrade helper, stack runtime preamble, MCP setup, and opt-in resident sync activation via `YOUMD_INSTALL_DAEMON=1`
- The resident local runtime now has three LaunchAgents: identity/API sync (`youmd sync --daemon`, every 5 minutes), shared skillstack sync (`youmd stack sync`, every 5 minutes), and safe project-context sync (`youmd stack context-sync`, every 15 minutes). `youmd status` and `youmd stack daemon status` expose loaded state, intervals, recent activity, and current warnings.
- The global `youmd` install on this machine was refreshed from the local `cli/` package so the copyable dashboard command `youmd machine verify --root /Users/houstongolden/Desktop/CODE_2025` works from a normal shell. Verification output: `61` project directories scanned, `35` git repos, `32` package projects, `17` env locals, `19` env examples, `21` agent docs, `21` project-context dirs, `26` ready, `2` needs-env, `8` partial; `youmd stack daemon status` shows all three daemons loaded.
- `youmd machine verify` now includes opt-in local-run proof modes: `--install-deps` runs capped dependency installs, `--run-checks` runs capped package scripts, and `--probe-servers` starts capped dev servers and probes localhost without reading `.env.local` values. The one-command fresh-machine prompt exposes `YOUMD_INSTALL_DEPS=1`, `YOUMD_RUN_CHECKS=1`, and `YOUMD_PROBE_SERVERS=1`; compiled CLI smoke verified a disposable package project with `npm install` plus `npm run dev` returning HTTP 200.
- `youmd machine verify --write-report` now writes a secret-safe JSON machine proof to `~/.youmd/machine-reports/latest.json` and a timestamped archive. The Machine pane server builder reads that proof and exposes latest status/host/root/totals without raw logs or env values. Current proof: `warn`, `61` scanned, `26` ready, `2` needs env, `8` partial, `secretValuesExposed: false`.
- `youmd machine verify --sync-report` now syncs the compact proof summary to owner-gated Convex `machineProofReports` through `POST /api/v1/me/machines/proof`; `GET /api/v1/me/machines/proofs` and the signed-in Machine pane show synced computer proof rows across hosts without raw logs or env values. The generated fresh-machine command runs `--write-report --sync-report` by default after readiness, optional checks, and optional install/server probes. Production live proof passed after Convex deploy: `Houstons-MBP.lan`, `61` scanned, `26` ready, `2` needs env, `8` partial, `0` failures, `secretValuesExposed: false`; authenticated Codex Browser visual proof: `/tmp/youmd-machine-proof-sync-records-2026-06-17.png`.
- `youmd machine projects` / `youmd machine prompt` now support `--max-clone-projects` / `YOUMD_MAX_CLONE_PROJECTS` for bounded clean-root proof runs. Verified compiled proof at `/tmp/youmd-clean-host-CODE_YOU-20260617T0714`: the graph-backed plan read `55` portfolio projects, `40` graph-tracked repos, and `41` recent GitHub repos, cloned `youmd` plus `agent-shared`, synced a secret-safe machine proof row with `secretValuesExposed: false`, and showed the row in authenticated local `/shell` even when the localhost-only readiness endpoint is unavailable. `npm ci` passed for `youmd`; the remaining server blocker is the classified Convex first-run prompt in non-interactive mode. Env preflight currently finds GPG installed but no configured recipient/secret key; the broader `env-key-audit.py` found one `.env.example` gap in `bamfsite/bamfsite`, outside this repo.
- Fresh-machine env-vault restore is now guarded in the generated command: `youmd env backup --preflight` checks tooling/discovery without writing, `youmd env restore <vault> --list` lists target paths plus variable names/counts without writing, missing `YOUMD_ENV_VAULT` paths fail before restore, and the web-shell `/new computer` generator mirrors the CLI sequence. Disposable encrypted backup/list/restore smoke proved no fake secret values were printed. Follow-up live production proof found and fixed the installer `EACCES` blocker by moving npm globals to a user-writable `~/.youmd/npm-global` prefix when needed; the bounded live generated command then installed without sudo, cloned `agent-shared` and `youmd` into `/tmp/youmd-fresh-env-vault-proof-20260617T153402Z/CODE_YOU`, restored a fake encrypted `youmd/.env.local` without leaking the fake secret value, synced a `READY` machine proof with `secretValuesExposed: false`, and rendered that row in authenticated local `/shell`; screenshot `/tmp/youmd-machine-proof-env-vault-visual-2026-06-17.png`. The actual new-host run with a real vault remains pending.
- Identity daemon sync now preserves richer remote data when local markdown compilation would upload a >50% smaller bundle; daemon mode completes as pull/refresh-only instead of force-pushing a lossy bundle.
- Project-context sync is now context-only and refuses to pull/push when upstream includes non-context app-code paths, reducing background-sync blast radius.
- Local MCP now exposes YouStack resources/tools for manifest inspection, capability listing, request routing, and read-only smoke validation
- Claude and Codex MCP configs on this machine now use the safe published-package launcher (`npx --yes youmd@latest mcp`) with backups written during migration
- MCP tools have been smoke-tested through stdio from the installed local CLI: `whoami` returns Houston's real home-bundle identity from inside this repo, and `use_skill project-context-init` returns identity-interpolated skill content
- Local MCP now exposes `get_agent_brief` plus `youmd://agent/brief`, giving Claude/Codex/Cursor-style agents one startup call for identity, repo instructions, project-context files, active requests, open TODOs, known issues, installed skills, and next moves
- Local MCP `get_agent_brief` / `youmd://agent/brief` now includes the You.md portfolio graph slice, and `youmd://portfolio/graph` exposes structured project/API/MCP ownership, reusable pattern, env-audit command, and shared-skill propagation context for local agents before they add endpoints or duplicate cross-project work
- Local MCP `get_project_context` now also includes a project-scoped portfolio graph slice for matched projects, so agents can see You.md-owned surfaces, dependency edges, reusable patterns, commands, and guardrails inside a project-specific context request
- Local MCP now exposes write tools `upsert_portfolio_task` and `record_brain_dump`; built-registry proof confirmed both tools are present, and the underlying API-backed CLI path was verified through merged GitHub PRs #9/#10.
- The canonical shared `portfolio-graph-auditor` skill now instructs agents to verify that MCP portfolio graph path, and the update is synced through `.agent-shared` into Claude, Codex, Cursor, Pi, and the local `~/.youmd/skills/portfolio-graph-auditor` cache
- The canonical shared `braindump-task-router` skill now exists in `.agent-shared` and is synced through Claude, Codex, Cursor, and Pi; it preserves raw dumps, summarizes insights, routes them to projects, and separates Houston-owned tasks from agent-owned tasks for You.md `brainDumpCaptures` and `portfolioTasks`
- Bundled skills now include `youstack-start`, `youstack-maintainer`, `machine-bootstrap`, and `portfolio-graph-auditor` locally, making the default catalog 10 skills and giving local agents first-session, stack-maintenance, fresh-machine bootstrap, and portfolio/API/env audit loops before they touch code
- npm Trusted Publishing is wired through `.github/workflows/publish-cli.yml`; after configuring the package on npm, local agents can run `npm run publish:cli` to trigger the GitHub OIDC publish without a long-lived npm token or OTP
- The published package is cleaner now: compiled test artifacts are excluded from `dist`, and the dry-run tarball dropped from 248 files to 212 files
- Bare `youmd` now enters like U instead of dropping straight into a dry command list: it shows the YOU logo, optionally shows the saved portrait preview, greets the user, surfaces project-context opportunities, and proposes the next best moves contextually
- `youmd chat` now opens with the same U-style entrance and no longer prints the first assistant greeting twice when streaming succeeds
- `youmd chat` now uses the same local proactive opener as `you` instead of asking the remote model to invent the first greeting, which prevents the old “suggested local action then claimed no filesystem access” failure path
- Web `/initialize` now passes the same `thinkingCategory` + `progressSteps` state into the terminal shell, so onboarding can show the same live working-state treatment as the main shell
- Web onboarding greeting instructions now explicitly target the same local-launcher U persona and can mention known saved projects instead of always sounding like a generic cold start
- Web `/initialize` now also has a portrait-first encounter strip above the terminal, using the saved ASCII portrait when available and a fallback "portrait incoming" state when it is not, so the first-contact framing is closer to the local `you` launcher
- Web `/initialize` now includes the actual YOU logo block and subtitle above that encounter strip, bringing the scene composition closer to the local launcher instead of looking like a generic onboarding header
- The npm install moment is now less deadpan: postinstall prints a real U-style welcome with logo + next moves instead of the old `Run: youmd init`
- A real `you` launcher now exists alongside `youmd`: if the user is authenticated and has a bundle in either the current project or `~/.youmd`, `you` goes straight into chat instead of forcing `youmd chat`
- The new `you` opening renders the YOU logo, the user's ASCII portrait-in-code, a small terminal bot greeting the portrait, and a more proactive U intro so the local entry feels more like meeting a wingman than a utility binary
- The compact `you` portrait now downsamples the full public-profile portrait instead of cropping the top rows first, so it preserves the face/body framing better while staying narrow-terminal friendly
- The `you` opening now runs a real local-context investigation before speaking: a live braille spinner stays active while U checks bundle guidance plus nearby AGENTS / CLAUDE / project-context signals, then U reports concrete findings instead of pretending it already looked around
- Running `you` from a nested package directory now resolves to the actual git repo root, so the launcher no longer mistakes `youmd/cli` for an unwired standalone project
- Obvious local follow-ups like `start` and `start there` now use deterministic host-tool routing and grounded local summaries, avoiding the previous failure mode where U asked the model to summarize filesystem results and then claimed it could not read files
- The portrait encounter in `you` now adapts to narrow terminals: if the portrait + bot + speech scene no longer fits side-by-side, it stacks vertically instead of smashing the portrait text into the dialog block
- The `you` investigation now also sweeps home-level agent docs plus recent Claude/Codex session roots, then turns that context into a concrete strongest-move proposal instead of ending on the old generic question
- The local `you` launch is now less overwhelming: the portrait is downsampled for terminal display, the scan has a visible dwell instead of flashing by, and the output is collapsed into two findings plus one concise proactive intro instead of repeating the same context three times
- The conversational loop now has a real local host-tool loop: U can choose `discover_projects`, `read_project_context`, `write_project_context`, `sync_identity`, or `respond`, while the CLI host executes filesystem and bundle operations locally and sends grounded tool results back through the remote model for the final answer
- The launcher now scans recent project contexts for actual openings instead of only listing project names, and that recent-project scan now falls back to `~/.youmd/projects` even when `you` is launched from arbitrary directories like `/tmp`
- U now also scans normal workspace repos with `AGENTS.md`, `CLAUDE.md`, `.youmd-project`, or `project-context/`, so the launcher can point at real projects like `foldermd` even when they were never initialized through `youmd project`
- CLI startup can now check npm for newer published versions, cache that result, and show the exact curl/npm upgrade commands when an update is available
- Conversational entrypoints now fall back to the home bundle in `~/.youmd` when no local `.youmd/` exists, which means `you` and `youmd chat` still work from arbitrary directories
- Read-only bundle commands now share that same active-bundle resolution: `status`, `diff`, `export`, and `preview` can all operate from the home bundle when no project-local `.youmd/` exists
- The identity compiler/decompiler now preserves richer raw markdown in `preferences/agent.md`, `preferences/writing.md`, `voice/voice.md`, and `directives/agent.md` so durable preference files survive push → pull roundtrips instead of being collapsed back to only the structured headline fields
- The public profile contract now includes the stored public ASCII portrait in `_profile.asciiPortrait`, and the CLI public-profile wrapper preserves `_profile` metadata instead of stripping it away, which unblocks launcher portrait parity with the web profile
- Chat command with slash commands, project awareness, directive injection
- Rich terminal rendering (tables, stats, code blocks, callouts)
- Pull/push/sync for web ↔ local
- Context link management (create, list, preview, revoke)
- API key management
- Memory commands (list, add, stats)
- Private context management
- Project-aware file system (auto-detect projects, per-project context)
- Export command (you.json + you.md)
- Diff command (compare local vs published)
- Multi-select UI for platform/tool selection during onboarding
- curl-first installer now exists at `https://you.md/install.sh`, with landing/docs/help updated to teach `curl -fsSL https://you.md/install.sh | bash` as the default CLI entry path and npm as the fallback

### YouStacks Product Layer
- Planning/audit is preserved in `project-context/YOUSTACKS_PRODUCT_LAYER_PRD.md` and `project-context/YOUSTACKS_IMPLEMENTATION_PLAN.md`
- 2026-06-17 portfolio-graph direction is preserved in `project-context/PROJECT_PORTFOLIO_GRAPH_AND_REUSE_PRD_2026-06-17.md` and `project-context/prompts/2026-06-17-project-portfolio-graph-reuse-dependency-routing.md`: You.md should organize active projects as a strategic graph across project goals, repo/local paths, APIs, MCPs, skill stacks, protected in-product agent harnesses, dependency tiers, integration types, machine readiness, and reusable code/UI/architecture patterns. The first duplicate-risk example to audit is Lempod ownership across `bamfsite` and `bamfaiapp`.
- 2026-06-16 context routing is now preserved in `project-context/prompts/2026-06-16-youmd-personal-api-context-routing.md`: You.md is the canonical agent brain, personal API/MCP, and YouStacks protocol layer; h.computer is Houston's personal site/reference implementation powered by You.md; Creator.new, BAMF.ai, folder.md, BAMF OS, MCP clients, and local agents are consumers or adjacent product shells
- 2026-06-16 Part 2 mobile-capture routing is now preserved in `project-context/MOBILE_CAPTURE_AND_PROJECT_ROUTING_2026-06-16.md` and `project-context/prompts/2026-06-16-mobile-capture-voice-slack-project-routing.md`: You.md owns the universal brain-dump inbox, SMS/iMessage/voice/Slack capture substrate, raw transcript artifacts, dedupe/segment/classify/project-routing pipeline, task/memory proposals, approval model, Slack host adapter, and voice clone/likeness consent/audit boundary; BAD, Myo, h.computer, Hubify/BigBounce, Creator.new, BAMF.ai, Fantasy.is, and BAMF site remain downstream consumers for domain-specific work
- The consolidated lane handoff now lives in `project-context/voice-memo-part-2-youmd-handoff-2026-06-16.md`, which records the done state, next implementation slice, and exact blocked decisions for pilot input path, inbox home, first downstream task destination, Slack v1 mode, and voice disclosure/grant shape
- Current product language to keep consistent: "A personal API where the context is you," "The context every agent should already have," "Your portable identity and expertise stack for the agent internet," and "Brain -> Stacks -> Runtime -> Protected API/MCP"
- Capture/voice/Slack direction should stay identity-native: the agent is an amplified version of the user with explicit consent, scopes, disclosure, revocation, and audit, not a generic assistant pretending to be human
- Upstream reference intelligence is implemented: `npm run references:sync` clones/fetches `garrytan/gstack`, `garrytan/gbrain`, `steipete/agent-scripts`, and `disler/the-library` into ignored `.reference-repos/<owner>/<repo>/`, then writes `project-context/reference-intelligence/LATEST.md` and `TASKS.md` for daily review
- The daily local reference automation is active, and the latest reference sync captured GStack `3bef43b`, GBrain `eefe8b5`, Agent Scripts `5dc3c24`, and The Library `47f455c`
- Local-first YouStack manifests work as portable execution packages on top of You.md rather than as a replacement brain
- Manifests now support named stack portfolios via `name`, stable `slug`, `domain`, `aliases`, and `tags`, so one user can keep separate coding, scientific research, content creation, and other domain stacks
- Manifests now declare `improvement` and `update` policy, and local stack capabilities include `stack.improve` plus `stack.update` for policy-bound stack/skill self-improvement and self-updating
- The sample private personal YouStack lives in `cli/examples/youstack-personal`
- A public-safe BAMFStack lighthouse YouStack lives in `cli/examples/youstack-bamfstack-public`, with a manifest, skill, workflow, prompt, quickstart, smoke test, auto-update policy, improvement policy, protected-capability boundaries, and public-readiness routing
- The web shell now has a `/stacks` pane for named private/scoped/public stacks, and public profiles can render only `public-open` YouStacks from profile/bundle data
- Primary host adapter generation exists for Claude Code, Codex, and Cursor; OpenClaw, Hermes Agent, and Pi agents remain secondary-host follow-up phases
- Shared read-only HTTP endpoints now exist for the capability contract and deterministic routing: `GET /api/v1/stacks/capabilities` and `POST /api/v1/stacks/route`
- Protected brain retrieval still uses the existing authenticated You.md MCP/API surfaces in this slice; stack-specific grants/tokens are intentionally deferred to the next backend phase
- GitHub App repo sync, public/private stack sharing UI, paid stacks, and optional custom per-stack API/MCP endpoints are still planned follow-up phases, not shipped behavior yet
- Production web/API/docs/homepage is deployed and verified on GitHub/Vercel deployment `4842170884` for commit `db6a01f`, aliased to `https://www.you.md` and `https://you.md`
- Live production verification confirms the homepage now frames YouStacks and the personal brain as GStack/GBrain-guided, curl-first, and runtime-not-CLI-first; `/docs` includes Brain Architecture, Reference Intelligence, GStack/GBrain Reference Loop, Shell/Profile Management, Auto-Update, and BAMFStack Lighthouse sections; `/install.sh` serves the runtime installer with `youmd-auto-upgrade`; `/api/v1/stacks/capabilities` includes maintainer, visibility, improvement, and update capabilities; `/api/v1/docs/reference` lists stack endpoints plus stack MCP tools; and `POST /api/v1/stacks/route` preserves stack `name`, `slug`, `domain`, and `tags`

### Backend (Convex — kindly-cassowary-600)
- 21-table schema fully deployed (added skills + skillInstalls)
- 40+ HTTP API endpoints, including task and brain-dump write endpoints for local-agent portfolio updates
- LLM chat proxy (OpenRouter → Claude Sonnet 4.6)
- Ingestion pipeline (fetch, extract, analyze, compile)
- LinkedIn scraping via Apify
- X/Twitter scraping via native + Grok enrichment
- Website scraping via native fetch
- Identity verification via Perplexity
- Server-side ASCII portrait generation
- GitHub Actions auto-deploy on convex/ changes

### SEO/AEO
- SSR on all public pages (profiles, profile, docs, landing)
- JSON-LD structured data on profiles
- OG social cards per profile
- Sitemap.xml (dynamic, includes all profiles)
- robots.txt
- Canonical URLs on all pages
- AI agent user-agent detection (serves plain text)

---

## Auth Strategy Pivot (2026-03-26)

MVP now requires account creation before profile building. The "no signup required" / anonymous profile creation messaging has been removed from all surfaces (landing page, FAQ, docs, PRD). Core users care about security and data ownership — auth-first reinforces trust. Anonymous onboarding is deferred to v2 as a growth feature, not an MVP priority.

---

## Known Issues

### Auth Migration
- Local/dev passwordless auth is working via first-party email codes, session cookies, and custom JWT/JWKS for Convex
- Production `you.md` passwordless auth is now hard-verified end to end: email delivery, verify-code, cookie-backed session refresh, and authenticated `/shell` hydration
- Production API-key issuance on the passwordless flow is verified, and `youmd whoami` resolves correctly against the live prod backend with a fresh prod key
- Production shell bootstrap is now verified after login: `/api/auth/session` returns a valid Convex JWT and the downstream authenticated user/profile/private/bundle queries all execute cleanly on prod
- Remaining release blocker on auth is deliverability, not session plumbing: the passwordless sender still needs a verified production domain sender configured (`AUTH_EMAIL_FROM` / `RESEND_FROM_EMAIL`) so non-owner accounts and plus-address aliases can receive codes reliably
- The stale local CLI auth-state bug is now fixed: this machine can log out of the disposable test account, log back into `@houstongolden`, and resolve the real production identity cleanly via `youmd whoami`
- Existing API keys created before the reveal upgrade remain non-revealable by design because those historical records were stored hash-only; newly created or rotated keys are now revealable, so one rotate is the migration path for older keys
- Remaining cleanup is mostly product/documentation follow-through: broader web-agent behavior/personality QA and removing stale Clerk-era references from lower-priority internal comments
- The CLI still does not feel proactive enough at install/startup compared with Claude Code/OpenClaw. The new startup entrance is a meaningful step, but U still needs a richer first-run / post-install “friendly wingman” flow that helps without requiring the user to already know the commands
- The published npm package on npm is still behind the repo; the latest CLI fixes in this repo are now `0.6.23`, but npm still serves `0.6.21`. The May 24 and May 25 trusted publish workflow runs passed install, tests, and build, then failed at `npm publish` with `E404 Not Found / no permission`, which points back to npm package Trusted Publishing/package permission configuration rather than local package code. This shell is not logged into npm (`npm whoami` returns `E401`), and the real `npm trust github ...` setup attempt also returns `E401`. The required external step is either npm package settings or an authenticated `npx npm@11.15.0 trust github youmd --repo houstongolden/youmd --file publish-cli.yml --allow-publish --yes`, then rerun `npm run publish:cli`.
- Stack-specific GitHub repo sync and stack grants are not live yet. Existing authenticated You.md MCP/API surfaces cover protected memory access for local agents, but scoped per-stack grant tokens remain the next backend slice.
- Remaining portfolio graph work is mobile/watch capture adapters,
  the full actual new-host/env-vault machine run, and deeper pattern-quality review/curation.
  The
  Convex-backed graph, dashboard view, auditor skill, project-scoped MCP slice,
  repo-backed graph snapshots, update history, active-project strategy enrichment,
  scanner-derived reusable patterns, richer task update contract, deployed
  production task-update CLI proof, authenticated local dashboard task-control
  proof, authenticated production dashboard task-control/GitHub-sync proof,
  and CLI/API/MCP task/brain-dump write path
  are now implemented and verified.

### Portrait Sync
- CLI generates ASCII portraits locally but sync to web API is not verified end-to-end
- Profile images scraped locally may not persist to server storage on push
- Portrait data structure exists in profiles table but upload path needs verification

### Agent Intelligence
- You Agent sometimes gives generic responses (personality needs tuning)
- Session compaction triggers at 120k chars but summary quality varies
- Stale source detection warns at 7 days but doesn't auto-refresh
- Agent sometimes says "the system handles that" instead of acting directly
- Production still needs a final live verification pass that the faster web-shell sequencing feels better after redeploy
- The core project-directory scaffold prompt is now fixed in production, but broader shell mutation QA still needs the same transcript-level scrutiny so other high-value actions do not regress into tool-call lies or half-finished saves

### UI Polish
- Some text formatting issues in CLI (wrapping, alignment) — partially fixed in 0.4.8
- Mobile dashboard navigation could be smoother
- Profile page sections are somewhat rigid (custom sections possible but not intuitive)

### Next.js / Middleware
- Next.js is now 16.2.7 locally after the June 4 sync audit; rerun production build/deploy verification after this patch upgrade lands.
- Middleware deprecation warning (cosmetic, not blocking)

### Missing/Incomplete
- Private vault encryption (AES-256-GCM) — not started
- Stripe Pro plan billing — not started
- Rate limiting per plan — not started
- Verified badges — not started
- Custom domains — not started
- Profile analytics dashboard — not started
- MCP endpoint — not started

---

## What Was Built Recently (March 24-25)

### March 25 (15 commits)
- BrailleSpinner color rotation + lightsweep effect
- Portrait sync improvements
- Request tracking in feature-requests-active.md
- CLI text formatting fixes (word-wrap, paragraph spacing)
- CLI passwordless auth (register + login via email code, no API token needed)
- ASCII portrait rendering in CLI terminal
- Block-char YOU logo + orange branding in CLI
- CLI onboarding overhaul (multi-select, personality, live spinners)
- Auto-URL crawling during onboarding conversation
- CLI hitting prod Convex (was hitting dev — 401 bug)
- Markdown rendering on profile page (no more raw **bold**)
- Richer profile cards in directory (bio, projects, social links)
- Nav avatar using duotone photo (not unreadable tiny ASCII)
- Portrait pane wired + dead code cleanup
- Server-side ASCII portrait generation + DB caching

### March 24 (33 commits)
- Agent directives system (communication_style, negative_prompts, etc.)
- Intelligent model routing (Claude/Perplexity/Grok per task)
- Identity verification (cross-reference scraped profiles)
- Portrait system overhaul (multi-image, 4 formats, detail picker)
- Close all 11 audit gaps (real data, missing sections, file editor, portraits, search)
- Lovable-style profile page redesign
- Image paste support (web chat + CLI)
- Claude Code integration guide in docs
- CLI feature gap closure (auto-scrape, memories, private context, links, keys)
- LinkedIn scraper fix (wrong profile bug)
- Private context API + CLI support
- Conversational portrait management
- Persistent chat sessions
- Streaming LLM responses via SSE
- CLI rich terminal renderer
- SEO optimization (OG cards, sitemap, robots.txt)
- MVP launch sprint (auth hardening, X scraping, error boundaries)

---

## What Was Built March 27

### Skill System (6 commits)
- Full skill system: 19 CLI subcommands, Convex registry (2 tables, 9 endpoints), web SkillsPane
- Identity-aware template engine ({{var}} interpolation from live identity data)
- 4 bundled skills published to production registry
- CLI ↔ Convex auto-sync on install/use/remove
- CLAUDE.md merge, init-project, agent linking (Claude/Cursor/Codex)

### Identity Context Protocol Rebrand (48 files)
- "identity file" → "identity context protocol" across entire codebase
- New tagline: "an MCP where the context is you"
- Agent system prompts updated

### Chat Fixes
- Fixed duplicate message bug (streaming message was being added twice)
- Fixed thinking indicator not clearing properly
- JSON blocks now always stripped from display after streaming

### Web
- ForDevelopers "for AI builders" landing section (cold start, personalization, API/MCP)
- SkillsPane dashboard tab with live Convex queries
- /skills slash command + agent response

---

## What Was Built April 6

### Build & Deploy Fixes
- Fixed /claim build error (added force-dynamic export)
- Fixed CLI postinstall hook (inline echo instead of external script)
- Removed hardcoded deploy keys from convex-deploy.sh
- Fixed npm vulnerabilities (picomatch ReDoS)
- Removed deprecated @clerk/clerk-react

### Code Quality & DRY
- Centralized all hardcoded Convex URLs (src/lib/constants.ts for web, getConvexSiteUrl() for CLI)
- DRYed pipeline OpenRouter utilities (convex/lib/openrouter.ts)

### Bug Fixes
- Fixed profile view tracking for unclaimed profiles (userId now optional)

### Environment
- Created .env.local with all API keys

---

## What Was Built April 14

### Chat Agent Reliability
- Streaming init: greeting now streams as tokens arrive (was blocking wait for full response)
- Reduced max_tokens: streaming 4096→1500, non-streaming 4096→2048 (faster responses)

### MCP Server (NEW — was TODO)
- Full JSON-RPC 2.0 MCP endpoint at `/api/v1/mcp`
- Tools: `get_identity`, `search_profiles`, `get_my_identity`
- Resources: `identity://{username}` 
- Discovery: `GET /.well-known/mcp.json`
- Claude Code, Cursor, Windsurf can now configure you.md as an MCP server

### Portrait in Chat
- `/portrait show` command renders avatar + all social images inline
- `updateProfile` now works from httpAction context (added `_internalAuthToken`)

### CLI Sync
- Portrait endpoint now patches `avatarUrl` from `sourceUrl` on push

---

## What Was Built April 16

### Passwordless Auth Migration
- Convex auth switched to `customJwt` with JWKS discovery
- Added `authChallenges` and `authSessions` tables plus first-party auth/session mutations
- Added web auth routes for `send-verification`, `verify-code`, `verify-link`, `session`, `logout`, and `/.well-known/jwks.json`
- Replaced the app-side Clerk provider with first-party session auth (`YouAuthProvider`)
- `/sign-in` and `/sign-up` now use sequential passwordless terminal flows
- CLI `register` and `login` now use email-code auth instead of email/password
- Fixed `convex/tsconfig.json` with `noEmit` so Convex commands stop regenerating stray `.js` source siblings

### Validation
- `npm run build` passes
- `npm --prefix cli run build` passes
- Local auth route smoke test passed: signup → verify → session → logout → login
- CLI smoke test passed against dev backend: `register`, `login`, `whoami`
- Production auth smoke test passed: send code → verify code → session cookie → `/shell`
- Production CLI parity smoke test passed: API-key issuance on the passwordless flow → `youmd whoami`
- CLI-pushed portraits now visible as profile photo on web

---

## Next Priorities (Houston's Order)

1. **End-to-end flow testing** — full journey from CLI init to web dashboard to agent share
2. **Agent intelligence** — tune personality, ensure it acts (not asks), conversational portrait management
3. **Billing + Pro plan** — Stripe integration
4. **Growth features** — verified badges, analytics, rate limiting
5. **MCP client tools** — SDK/npm package for agents to consume you.md MCP
