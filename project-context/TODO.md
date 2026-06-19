# You.md — Build Progress & Roadmap

Last Updated: 2026-06-19
PRD Version: 2.3

---

## COMPLETED

### 2026-06-19 — DSI views and pixel sync characters
- [x] Add a reusable original retro pixel character primitive for Machines, Agents, and Shell/session surfaces
- [x] Surface stable machine/agent characters inside the Machine `you sync mesh` so connected computers and agents feel alive without adding another tab
- [x] Add quiet status animation for live/ready characters with `prefers-reduced-motion` support
- [x] Create `project-context/DSI_VIEWS_WIDGETS_AND_PIXEL_AGENTS_2026-06-19.md` to define Dynamic Software Interface primitives, Views, Widgets, live widget contracts, private data boundaries, and the navigation implication
- [x] Add first Convex `dsiViews` / `dsiViewWidgets` schema and make Home read/initialize a saved default DSI View
- [x] Add focused Convex coverage for persisted Home DSI view + widgets
- [ ] Next pass: deploy Convex schema/functions after resolving the silent `npx convex deploy` hang from this local session
- [ ] Next pass: extend pixel characters into connected-agent rows and live-log emitters

### 2026-06-19 — Shell live brain log
- [x] Add a `chat` / `live log` toggle inside the shell chat column instead of creating another top-level pane
- [x] Render a terminal-style central log of realtime agent-bus messages, shell agent progress, repo/identity state, local daemon health, skill sync proof, Secret Vault metadata, machine proof, and recent chats
- [x] Poll the authenticated local machine readiness endpoint for safe metadata only
- [x] Keep raw `.env.local` values and secret material out of the browser log (`secretValuesExposed: false` remains the contract)
- [x] Add owner-gated Convex `brainActivities` as the durable canonical activity stream
- [x] Mirror new realtime agent-bus messages into `brainActivities` with redacted text/metadata and `secretValuesExposed: false`
- [x] Make the shell Live Log read `brainActivities` first, with local readiness and current UI state as safe supplementary rows
- [x] Extract `LiveBrainLog` as a shared product primitive and reuse it in `/desktop-demo` System Status
- [x] Collapse visible shell IA toward `Home`, `Brain`, `Projects`, and `Settings`, with APIs/Machine/Vault/Activity/Stats/Portrait hidden under Settings
- [x] Route repo update runs/steps, global portfolio task changes, task triage/detail edits, brain-dump captures, and extracted brain-dump tasks directly into `brainActivities`
- [x] Keep producer-written brain activity redacted and marked `secretValuesExposed: false`
- [x] Bring hidden Activity/Stats signals into the foreground Live Log as compact `AGENTS` and `STATS` rows
- [x] Move the second-brain GitHub repo/update-history surface to the top of Settings and truncate noisy API/session sections
- [x] Make Machine's new-computer setup block collapsible into a compact first-run row
- [x] Add a foreground `you sync mesh` on Machine that summarizes real local/Convex signals for trusted machines, agent bus, shared skill mesh, project graph, and Secret Vault readiness
- [x] Verify Machine collapse + sync mesh in the Codex in-app Browser with localhost readiness hydrated
- [x] Simplify the shell chat history into an always-visible one-line list with no section icon, no toggle, no per-chat subtitles, and a 50-session first page
- [x] Generate/backfill useful chat titles from first prompts or existing session summaries so the left rail reads like real chat history instead of raw ids
- [x] Soften light mode with a subtle super-light beige gradient and warmer surface tokens instead of a stark white canvas
- [x] Replace black/orange shell chrome and active fills with warm charcoal/beige shell tokens, and document the no orange-gradient-over-black design rule
- [x] Verify with root TypeScript, production Next build, Convex dev sync, Convex production deploy, local `next start -p 3100`, and Codex in-app Browser screenshots for `/shell` and `/desktop-demo`
- [ ] Next pass: route skill self-improvements, portfolio hydrations, source crawls, and daemon checkpoints directly into `brainActivities` as first-class producers

### 2026-06-19 — Cross-machine skill sync proof UI
- [x] Add local machine readiness metadata for shared skill sync proof
- [x] Highlight `project-clarity-audit` across canonical shared source, rendered skill, Claude mirror, Codex mirror, You.md catalog, and Stack Map
- [x] Surface the proof as a compact `live skill mesh` block on Home
- [x] Surface the detailed proof in Machine readiness with sync/verify commands
- [x] Verify with root TypeScript, production build, direct readiness payload proof, and local server restart
- [ ] Next pass: make the desktop app System Status popover consume the same real readiness payload instead of mock sync data

### 2026-06-19 — Shared Project Clarity Audit skill
- [x] Package the reusable Project Clarity Audit prompt as `project-clarity-audit`
- [x] Keep canonical ownership outside gstack in `~/.agent-shared/claude-skills/project-clarity-audit`
- [x] Register the skill into the local You.md catalog as `source: shared:project-clarity-audit`
- [x] Symlink `~/.youmd/skills/project-clarity-audit` to the canonical shared implementation for YouStack/ystack visibility
- [x] Run shared-agent sync so local agent hosts can discover the skill
- [x] Verify `youmd skill list` and `youmd skill use project-clarity-audit`
- [x] Push the shared stack update to `houstongolden/agent-shared`

### 2026-06-19 — Mac mini trusted-device setup follow-up
- [x] Fix the `install.sh` Bash 3.2 empty-array crash so fresh Macs no longer need `YOUMD_FORCE_USER_NPM_PREFIX=1`
- [x] Add a regression test that reads the generated install route and blocks reintroducing `NPM_GLOBAL_FLAGS=()`
- [x] Add post-vault `youmd pull && youmd sync` reconciliation to CLI and web fresh-machine setup prompts
- [x] Update hosted `machine-bootstrap` skill seed text so local agents run the post-vault reconcile before proofing readiness
- [x] Confirm npm latest is `youmd@0.8.7`
- [x] Record the Mac mini trusted-device restore proof: device registered, env vault restored via envelope, machine proof synced, and raw secrets stayed local
- [ ] Verify the user's 90-day Mac mini expansion result after Houston reports back
- [x] Verify production `https://you.md/install.sh` after deploy no longer contains `NPM_GLOBAL_FLAGS`

### 2026-06-18 — Home dashboard and global task surface
- [x] Make `/shell` default to a real Home dashboard instead of leaving the user in chat/profile-only mode
- [x] Add a Home pane that summarizes Houston-owned tasks, agent-owned tasks, personal tasks, focused projects, shipped/moved activity, and recent brain dumps
- [x] Add a dedicated Tasks pane for global personal/project task triage
- [x] Keep task ownership explicit: `me` / `agent`, project-scoped / personal, active / done
- [x] Add `/home`, `/dashboard`, `/today`, `/tasks`, and `/taskboard` shell slash command routing
- [x] Simplify the shell navigation taxonomy around Home, Projects, APIs, Skillstacks, Connect, Identity, Stats, and Account
- [x] Verify with root TypeScript, full production build, local server restart, and Codex in-app Browser checks for `/shell`, `/shell?tab=home`, and `/shell?tab=tasks`
- [ ] Next pass: continue reducing duplicate long panes by moving project/stack/API drill-ins to dedicated pages with breadcrumbs and compact list/detail modes

### 2026-06-18 — Shell callout and logo polish
- [x] Clarify Mac mini Secret Vault flow: the new Mac does not need the vault passphrase first; it registers as a trusted device, then the source Mac runs `youmd env vault share` once using the source vault passphrase locally
- [x] Add shared `PaneCallout` styling so top explainer/copy-prompt blocks match the Skills tab left-border + gradient treatment
- [x] Convert Skills, Machine setup, and Vault explainer blocks to the shared callout
- [x] Replace the unreadable bright-orange Vault explainer with a dark, readable callout
- [x] Contain the top sidebar YOU logo in a fixed square parent for expanded and collapsed sidebar states
- [x] Verify with root TypeScript, full production build, local server restart, and Codex in-app Browser screenshots for Vault, Skills, Machine, and collapsed sidebar

### 2026-06-18 — Realtime agent bus for trusted Macs (`youmd@0.8.6`)
- [x] Add owner-gated Convex realtime agent-bus records and HTTP `GET/POST /api/v1/me/agent-bus/messages`
- [x] Add CLI `youmd agent send`, `youmd agent inbox`, and `youmd agent status`
- [x] Include recent agent-bus messages in the realtime sync head and materialize safe local files at `~/.youmd/realtime-sync-status.json` and `~/.youmd/agent-bus/inbox.json`
- [x] Teach generated fresh-machine CLI/web prompts to send setup milestones over `youmd agent send --channel machine-sync --kind status ...`
- [x] Move `realtime agent bus` into the top Machine tab proof surface so the dashboard shows device-to-device messaging state
- [x] Update and redeploy/reseed the hosted `machine-bootstrap` skill so production skill installs include the agent-bus workflow
- [x] Harden generated fresh-machine roots so `$HOME/Desktop/CODE_YOU` expands correctly instead of becoming a literal `$HOME` directory
- [x] Verify live source-Mac message send/inbox, websocket materialization, `secretValuesExposed: false`, and no raw `ym_` / `sk-` / env-key patterns in local status JSON
- [x] Patch Mac mini stale-install regression: setup now source-installs from GitHub main and hard-gates `youmd >= 0.8.6` before login/vault/agent-bus work
- [x] Bump CLI to `0.8.6`
- [x] Houston published `youmd@0.8.7` to npm with OTP
- [x] Mac mini reran the setup prompt on `0.8.7`, restored env via trusted-device Secret Vault, and synced machine proof
- [ ] Confirm the 90-day expansion sends a fresh `machine-sync` message back and both Macs show the same agent-bus inbox/status

### 2026-06-18 — Reference-intelligence follow-through visibility
- [x] Verify whether `steipete/agent-scripts` really had recent upstream activity and stop describing "no delta since last sync" as "no activity"
- [x] Teach `npm run references:sync` to show the latest upstream commit timestamp/age for each tracked repo
- [x] Add a durable `project-context/reference-intelligence/FOLLOW_THROUGH.md` ledger for shipped reference-derived improvements
- [ ] Keep promoting accepted high-signal reference tasks into tracked implementation work instead of leaving them only in `TASKS.md`

### 2026-06-18 — Native desktop app design demo (`/desktop-demo`)
- [x] Add a private, frontend-only `/desktop-demo` route (route group `(desktop)`, mock data, noindex, no SiteNav/Convex)
- [x] macOS-style title bar (traffic lights, breadcrumb, ⌘K command bar, sidebar + chat-layout toggles)
- [x] Collapsible full-height sidebar (workspace switcher, primary nav, projects)
- [x] Split chat mode (1/3 agentic chat left + main view right) and full-chat mode (Codex-style sticky summary widget)
- [x] Home/dashboard view, Notes view (file tree + tiny markdown reader/editor), Tasks kanban, Connections, Sub-agents spawn flow
- [x] Obsidian-style interactive knowledge graph (SVG nodes/edges, hover-trace)
- [x] Conductor/Cmux-style in-app terminal (Claude Code / Codex / shell tabs)
- [x] Production build + TypeScript pass; radius lint pass; dev HTTP 200
- [ ] Deploy to Vercel and get Houston's design review on `/desktop-demo`
- [ ] Decide native stack (Tauri vs React Native) and start the real desktop app build

### 2026-06-18 — Realtime trusted-device sync daemon
- [x] Add a short-lived, API-key-minted realtime sync session for trusted local daemons
- [x] Add secret-safe Convex sync head data for identity bundle hashes, installed skills, portfolio graph state, repo mirror state, GitHub mirror state, machine proofs, and encrypted env-vault metadata
- [x] Add account-backed Secret Vault snapshot readiness into the realtime sync head and local daemon status file
- [x] Push a fresh encrypted account Secret Vault snapshot from this source Mac and verify realtime status reports it as ready
- [x] Add CLI `youmd sync --live --daemon` using Convex websocket subscriptions
- [x] Materialize realtime updates locally by pulling identity, re-rendering installed skills, and triggering bounded shared stack/project-context syncs
- [x] Add `com.youmd.realtime-sync` launchd daemon and show it as `live websocket` in CLI status, daemon status, and the Machine pane
- [x] Deploy Convex production and smoke the websocket sync head without exposing secrets
- [x] Install/reload local daemons on this Mac and verify the realtime daemon activity log
- [x] Bump CLI to `0.8.6` for npm publish
- [x] Publish CLI `0.8.7` to npm with OTP so new machines and `npx youmd@latest` get the realtime daemon + Secret Vault status path
- [x] Verify the Mac mini fresh-machine setup after `0.8.7` publish: trusted-device vault restore succeeded and machine proof synced
- [ ] Confirm Mac mini daemon status shows `realtime brain / live websocket` after the 90-day expansion finishes

### 2026-06-18 — You.md Secret Vault trusted-device env sync
- [x] Teach generated fresh-machine prompts and the bundled `machine-bootstrap` ystack skill that Claude/Codex should use `youmd` + `you` behind the scenes for status/sync/skill/vault/portfolio/verify work and only interrupt Houston for real auth/passphrase/OTP/permission/90-day-expansion gates
- [x] Update shared `.agent-shared` `/machine-sync` so Claude/Codex/Cursor/Pi skill mirrors use You.md Secret Vault as the primary trusted-device env path
- [x] Bump CLI package to `0.8.6` as the next npm publish target for the machine-bootstrap/Secret Vault/realtime sync updates
- [x] Add owner-gated Convex `secretVaultSnapshots` records and `GET/POST /api/v1/me/secret-vault/env` for encrypted env-vault snapshots
- [x] Require the new `vault` API key scope for Secret Vault upload/list/download
- [x] Add CLI `youmd env vault push`, `youmd env vault list`, and `youmd env vault pull --restore`
- [x] Update CLI/web fresh-machine setup to pull You.md Secret Vault first, then fall back to local/iCloud `youmd-env-vault` files
- [x] Verify account Secret Vault contains the source-Mac encrypted snapshot (`16` projects / `451` variables) without returning manifest text, archive bytes, or secret values in list/realtime status
- [x] Fix generated fresh-machine root/env paths to use `$HOME/Desktop/CODE_YOU` instead of a single-quoted literal `~/Desktop/CODE_YOU`
- [x] Update the Machine pane and bundled `machine-bootstrap` skill so Keychain service `youmd-env-vault` setup is part of the trusted-device workflow
- [x] Verify with Convex codegen, focused fresh-machine parity tests, CLI build, root typecheck, root production build, compiled prompt smoke, `youmd env vault` help smoke, and env-vault bash syntax
- [x] Add trusted-device key escrow on top of account snapshots: `secretVaultDevices`, `secretVaultKeyEnvelopes`, `/api/v1/me/secret-vault/devices`, and `/api/v1/me/secret-vault/envelopes`
- [x] Add CLI `youmd env vault device-register`, `device-list`, and `share`; private keys stay local under `~/.youmd/secret-vault/devices/`
- [x] Make `youmd env vault pull --restore` unlock through the local device key envelope before restore, with Keychain/passphrase fallback only when no envelope exists
- [x] Update CLI/web fresh-machine prompts and hosted `machine-bootstrap` so the new Mac registers first and the source Mac runs `youmd env vault share` if an envelope is missing
- [x] Extend realtime daemon Secret Vault status with trusted-device counts and envelope counts instead of treating snapshot presence as restore readiness
- [x] Live source-Mac proof: registered device `svd_e87e4e3e4dc843ac1f8d73d7`, validated the source passphrase against `env-vault-2026-06-18T0741Z.tar.enc`, shared `1` envelope, proved headless `pull --restore` into an empty temp root, and refreshed realtime status to `1/1 device envelopes`
- [x] Publish CLI `0.8.7` to npm with OTP (`npm view youmd version` returns `0.8.7`)
- [x] Rerun the generated Mac mini setup after `0.8.7` publish/install; the Mac mini registered a second device, source Mac shared envelopes, Mac mini restored via trusted-device pull, and synced machine proof
- [ ] Confirm the 90-day expansion proof row + agent-bus reply after Houston reports back

### 2026-06-18 — Machine setup prompt correction
- [x] Fix Machine tab `copy setup` so it copies a Claude/Codex execution prompt, not only a raw shell command
- [x] Include the curl install command inside the copied prompt with clear local-agent instructions, success checks, and strict env-vault done-ness language
- [x] Add Claude Code and Codex MCP install commands to the generated fresh-machine script
- [x] Keep `youmd machine prompt` in parity with the web-shell Machine tab prompt
- [x] Harden the generated setup script from Mac mini notes: prereq install/checks first, GitHub auth before private clones, daemon install early, recoverable `machine setup` warnings, and persistent You.md/Homebrew/Node 22 PATH handling
- [x] Add safe fresh-machine env restore flags: `--map-existing --existing-only --skip-agent-auth`, with raw bash and compiled CLI fake-vault proofs
- [x] Make terminal `you` chat handle `/new computer` deterministically instead of routing the slash command to the LLM
- [x] Revoke unused fresh-machine bootstrap keys after the exposed pasted key incident
- [x] Verify local CLI/npm publish state: local `0.8.6`, npm latest still behind, `0.8.6` unpublished until Houston runs npm publish with OTP
- [x] Restart local `next start -p 3100` from the fresh build
- [x] Publish CLI `0.8.7` to npm with OTP so `npx youmd@latest` and npm fallback installs are current
- [ ] Re-run the Machine tab button in the signed-in Codex browser and verify the clipboard starts with `You are Claude Code or Codex running on my brand-new Mac.`
- [x] Run the corrected prompt on the Mac mini with trusted-device Secret Vault and verify `~/Desktop/CODE_YOU`, MCP config, skill sync, project clone count, env restore, and synced machine proof

### 2026-06-18 — Machine tab new-computer setup surface
- [x] Add a top Machine pane setup panel matching the Skills tab intro style
- [x] Add a primary `copy setup command` action that mints a 7-day scoped bootstrap key from the signed-in shell
- [x] Copy the full Claude Code/Codex blank-Mac setup command from the Machine tab, not from this Mac's external clipboard state
- [x] Keep `/new computer` as an explicit fallback command for shell-chat generation
- [x] State the expected blank-computer outcome in the pane: You.md install, auth, identity sync, shared skills/stacks, agent host config, `CODE_YOU`, env vault, active/focused project clones, proof sync, and resident daemons
- [ ] Run signed-in visual click proof in `/shell?tab=machine` and verify clipboard shape from the Machine pane button

### 2026-06-17 — Shell dedicated path drill-ins
- [x] Add dedicated hard-refreshable shell routes for project, stack, and skill detail pages: `/shell/projects/[projectSlug]`, `/shell/stacks/[stackSlug]`, and `/shell/skills/[skillName]`
- [x] Teach the shell pane router to open Portfolio, YouStacks, and Skills from those pathname drill-ins
- [x] Upgrade legacy query/hash detail URLs into the dedicated routes: `?project=...#project-detail` -> `/shell/projects/...`, `?stack=...` -> `/shell/stacks/...`, and `?skill=...` -> `/shell/skills/...`
- [x] Update Portfolio project cards, detail links, shipped/timeline links, and breadcrumbs to use `/shell/projects/<slug>` plus `#timeline` instead of `?project=` / `#project-detail`
- [x] Update YouStacks and Skills detail navigation to use `/shell/stacks/<slug>` and `/shell/skills/<name>` with breadcrumb returns to compact list views
- [x] Verify authenticated browser behavior for legacy URL upgrade, direct route reload, breadcrumb back, timeline hash scroll, stack detail/back, and skill detail/back

### 2026-06-17 — Portfolio active/inactive setup controls
- [x] Add `last updated` time-ago labels to compact Portfolio project rows and selected project details
- [x] Add status filtering for all / setup-eligible / active / inactive-not-active projects
- [x] Show setup eligibility count and per-row `setup yes` / `setup skip` badges using the same `active` + `Top Priority`/`Focusing` rule as the new-computer setup planner
- [x] Add owner-gated one-click project status toggles for `active` <-> `inactive`
- [x] Persist manual project status ownership with `statusSource: manual` and preserve it through GitHub tracked-project hydration
- [x] Restrict graph-backed fresh-machine project setup to `active` + `Top Priority`/`Focusing` projects by default
- [x] Add explicit `youmd machine projects --include-inactive` override for audit/legacy setup runs
- [x] Verify the built CLI planner against the live graph: `56` projects / `40` tracked repos -> `16` selected / `84` skipped with the setup-gate line visible
- [x] Deploy the new Convex `portfolio.updateProjectStatus` mutation to the remote backend, then rerun authenticated browser click proof that a status pill persists from `active` to `inactive`
- [x] Re-verify authenticated local Portfolio UI after the setup-eligible filter polish: filter narrowed to `24 / 56`, rows showed `LAST UPDATED` + `SETUP YES`, and `bamfaiapp-next` toggled `inactive -> active -> inactive`

### 2026-06-17 — Graph-backed fresh-computer bootstrap prompt
- [x] Change the generated new-computer bootstrap to a 30-day first pass into `~/Desktop/CODE_YOU`, with `--recent-only` preventing older projects from being prompted/included before the explicit 90-day expansion gate
- [x] Make `/new computer` / `youmd machine prompt` ask before expanding to the 90-day active project set, and only report full 90-day project setup complete after that expansion runs
- [x] Verify the compiled 30-day recent-only planner against the persisted portfolio graph: `56` projects / `40` tracked repos / `30` selected / `12` skipped outside the 30-day window
- [x] Add `youmd machine prompt` to generate a one-command Claude Code/Codex fresh-computer setup artifact
- [x] Make the generated command install You.md, authenticate, pull/sync identity, restore shared skills/stacks, hydrate the portfolio graph before cloning, clone active projects into `~/Desktop/CODE_YOU`, restore encrypted env vaults when provided, rehydrate local evidence, and start resident sync daemons
- [x] Update the bundled `machine-bootstrap` skill so local agents use the portfolio graph + GitHub/local audit hydration path instead of a static checklist
- [x] Add signed-in shell handling for `/new computer`, `/new machine`, and obvious natural-language fresh-machine setup requests
- [x] Mint a short-lived scoped bootstrap key from the web shell and embed it in the copyable local setup command, while keeping raw `.env.local` values out of the browser prompt
- [x] Add command-palette/help/skills-pane discovery for `/new computer` and `youmd machine prompt`
- [x] Add secret-safe `GET /api/v1/me/portfolio/graph` so fresh-machine agents can fetch persisted project graph records with repo/stack/docs/task metadata but no raw `.env.local` values or raw brain-dump transcripts
- [x] Teach `youmd machine projects` to fetch the persisted portfolio graph before planning, merge it with authenticated GitHub tracked repos and local bundle projects, and print source counts in dry-run/clone output
- [x] Add a graph-backed dry-run preview step to the one-command bootstrap prompt before cloning
- [x] Verify the compiled CLI dry-run against deployed production graph data: `55` portfolio projects, `40` tracked repos, and `40` graph-backed cloneable project repos selected after fixing false-positive badge/docs URL detection
- [x] Verify with focused CLI tests, CLI build, root typecheck, docs check, lint/radius, production build, compiled CLI prompt smoke, and authenticated local browser QA of `/new computer`
- [x] Add a first-class post-clone local readiness checker with `youmd machine verify` that reports git remotes, package managers/scripts, env file presence, root agent docs, and `project-context/` readiness without reading secret values
- [x] Extend `youmd machine verify` with an explicit opt-in bounded package-check mode for `typecheck`, `lint`, `test`, and `build`, including project caps, timeout caps, output tails, and generated prompt docs
- [x] Extend `youmd machine verify` with clean-host dependency install and local server smoke/probe modes for selected key projects
- [x] Add a secret-safe machine proof report written by `youmd machine verify --write-report` and surfaced in the signed-in Machine pane
- [x] Add persisted owner-gated machine proof records and `youmd machine verify --sync-report` so synced computer proof summaries appear in the Machine pane across hosts
- [x] Run a bounded graph-backed clean-root proof with `--max-clone-projects 2`: production graph input reported `55` projects / `40` graph-tracked repos / `41` recent GitHub repos, cloned `youmd` and `agent-shared` into `/tmp/youmd-clean-host-CODE_YOU-20260617T0714`, synced the machine proof row to You.md, verified `npm ci` passed for `youmd`, and classified the remaining server blocker as non-interactive Convex setup before dev-server start
- [x] Add env-vault setup guardrails to the generated command: `youmd env backup --preflight`, missing-vault path failure, `youmd env restore --list` before restore, dashboard `/new computer` parity, and disposable secret-safe backup/list/restore smoke proof
- [x] Fix the live curl installer fresh-machine blocker where global `npm install -g` could fail with `/usr/local` `EACCES`; `https://you.md/install.sh` now falls back to a user-writable `~/.youmd/npm-global` prefix, symlinks `youmd`/`you`/`create-youmd` into `~/.youmd/bin`, and persists the PATH shim without sudo
- [x] Run the live production generated bootstrap command in a bounded disposable proof with `YOUMD_MAX_CLONE_PROJECTS=2` and a fake encrypted env vault: the command installed via the new sudo-free prefix, cloned `agent-shared` and `youmd` into `/tmp/youmd-fresh-env-vault-proof-20260617T153402Z/CODE_YOU`, listed and restored `youmd/.env.local` by variable names/counts only, rehydrated the portfolio graph, wrote/synced a `READY` machine proof with `secretValuesExposed: false`, and authenticated visual QA verified the synced row in `/shell` at `/tmp/youmd-machine-proof-env-vault-visual-2026-06-17.png`
- [x] Add strict env-vault proof mode: `youmd machine prompt --require-env-vault` emits `YOUMD_REQUIRE_ENV_VAULT=1`, CLI/web-shell generated commands stop before readiness completion when no `YOUMD_ENV_VAULT` is supplied, and a 5-repo clean-root proof synced a secret-safe `needs-env` row instead of pretending setup was complete
- [x] Deploy/reseed/verify strict env-vault skill registry parity: GitHub CI and Convex Deploy passed on `bf4f5e4`, Vercel production is ready, `skills:seedBundledSkills` refreshed all 10 hosted skills, and public `machine-bootstrap` content exposes `--require-env-vault` / `YOUMD_REQUIRE_ENV_VAULT`
- [x] Run the strict generated command with a real encrypted env vault in a disposable temp-home/root proof: uncapped graph plan selected 43 active projects, cloned 41 repos, restored 17 `.env.local` files + 3 agent-auth files without printing values, synced a proof row with 48 scanned / 25 ready / 8 needs-env / 4 partial / `secretValuesExposed: false`, and completed status 0
- [x] Fix full-path fresh-machine proof blockers found by the real-vault run: force the `machine` CLI action to exit cleanly after `machine projects --yes`, and add `YOUMD_PORTFOLIO_HYDRATE_TIMEOUT_SECONDS` timeout guards around generated portfolio hydration calls
- [x] Add a compatibility guard to generated fresh-machine commands so source/current installs use `--recent-only`, while fallback older npm installs force noninteractive project planning via stdin from `/dev/null` instead of blocking on older-project prompts
- [x] Generate the real authenticated `/new computer` shell command with a fresh 7-day bootstrap key, verify the command structure in redacted form, and copy the full command to the in-app browser clipboard for Houston's immediate new-machine paste
- [x] Align the actual web shell `/new computer` artifact copy with the strict setup policy: `ACTIVE` + `Top Priority`/`Focusing` only, with inactive/unsorted/on-ice/abandoned/killed/unreviewed GitHub-only repos skipped by default
- [x] Add CLI/web parity coverage so future edits fail tests if the visible shell prompt drifts from env-vault strictness, 90-day expansion controls, active-focus setup gating, or required bootstrap scopes
- [x] Keep `youmd machine prompt --root ~/Desktop/CODE_YOU` portable by converting shell-expanded `/Users/...` home paths back to `~/...` in the generated command and explanatory text
- [x] Re-verify authenticated local `/new computer` after the active-focus and portability fixes: the shell minted a bootstrap key, rendered a secret-bearing copyable command with a `copy` button, showed `CODE_YOU`, `YOUMD_REQUIRE_ENV_VAULT=1`, `YOUMD_EXPAND_TO_90_DAYS`, and contained no `.env.local=` / `sk-...` secret patterns
- [x] Make the fresh-machine handoff self-contained: generated commands now print the old-machine env vault backup command, the web-shell command includes `YOUMD_CODE_ROOT='~/Desktop/CODE_YOU'` and `YOUMD_REQUIRE_ENV_VAULT='1'`, and the Machine pane shows copyable `/new computer`, strict CLI prompt, and source vault backup commands
- [x] Fix the actual web-shell fresh-machine artifact copy path: fresh-machine command blocks now show a visible `copy command` control, keep the 7k+ setup command in a bounded scroll area, and authenticated in-app Browser QA clicked the real button and verified the clipboard contains the full redacted command shape (`ym_...` key, `~/Desktop/CODE_YOU`, `YOUMD_REQUIRE_ENV_VAULT=1`, install curl, `--recent-only`, 30-day first pass, interactive 90-day expansion prompt) without `.env.local=` or `sk-...` patterns
- [x] Refresh the shared agent layer and direct-copy a fresh setup prompt outside the flaky browser clipboard path: `.agent-shared` was already up to date, shared mirrors synced, `youmd sync` pulled the latest remote draft and re-rendered all 10 skills, then a new scoped `ym_...` bootstrap key was minted through the authenticated API and the full 10,153-character fresh-machine prompt was placed on the macOS clipboard with redacted proof
- [x] Fix local-agent Portfolio Graph hydration for new-machine agents: `youmd://portfolio/graph` and `get_agent_brief` now load the persisted authenticated graph instead of the static four-project fallback, `get_project_context` returns persisted project-scoped graph slices, and live MCP proof showed `56` projects / `40` tracked repos plus a ready `bamfaiapp` slice
- [x] Re-run the local/GitHub Portfolio Graph hydrate from the real active code root and verify the current fresh-machine setup gate: `131` auditor projects scanned, `30` local candidates, `40` GitHub rows updated, `30` local rows upserted, `9` reusable patterns refreshed, 30-day setup selects `15` active/focused projects, and 90-day expansion selects `17`
- [x] Fix CLI pull/status stale-sync mismatch after publishing v137: `youmd pull` now prefers the authenticated published latest bundle when available, and live status shows local/remote `33b6cc43a67d` `in sync`
- [x] Add macOS Keychain passphrase pickup to generated env-vault restores: fresh-machine CLI/web commands try Keychain service `youmd-env-vault` for `ENV_VAULT_PASS` before prompting, covered by CLI/web parity tests
- [x] Verify the real encrypted env vault at `~/Desktop/youmd-env-vault/env-vault-2026-06-17T2317Z.tar.enc`: permissions tightened to `600`, Keychain service `youmd-env-vault` supplies the passphrase, list mode shows `17` `.env.local` files plus `3` agent-auth files by names/counts only, and restore proof writes the env files into a disposable root without printing secret values
- [x] Add fresh-machine env-vault auto-detection so pasted setup commands use the newest `~/Desktop/youmd-env-vault/env-vault-*` file if `YOUMD_ENV_VAULT` is not manually supplied
- [x] Refill the immediate new-computer clipboard after it was found empty: authenticated `/new computer` web-shell flow minted a fresh scoped key, copied an `8783` character command to macOS clipboard, and verified `CODE_YOU`, strict env vault, Keychain lookup, `--recent-only`, active/focus setup gate, 90-day prompt, install curl, and `bash -n`
- [ ] Run the generated command end-to-end on the actual brand-new computer / separate clean agent host with a real encrypted env vault and visually verify projects, skills, env vault restore, local servers, resident daemons, Machine pane proof row, and portfolio graph sync there

### 2026-06-17 — Shell sidebar expand/collapse regression
- [x] Investigate why the left shell sidebar can get stuck collapsed when the right detail pane is open
- [x] Fix the responsive auto-collapse state so a manual click expands the sidebar immediately instead of being overridden below `1520px`
- [x] Preserve the narrow-width auto-collapse default until the user explicitly chooses expanded or collapsed
- [x] Verify with focused dashboard lint, root lint/radius, `git diff --check`, and `npm run build`
- [x] Run authenticated visual QA in `/shell` with a real session cookie and verify `56px -> 244px -> 56px` expand/collapse behavior

### 2026-06-17 — Resident daemon and always-on sync
- [x] Add a first-class daemon health model for identity/API sync, shared skillstack sync, and project-context sync
- [x] Add `com.youmd.context-sync` as a third resident LaunchAgent running `youmd stack context-sync` every 15 minutes
- [x] Change identity LaunchAgent to run `youmd sync --daemon` so the background process refreshes local files/skills and skips unsafe lossy pushes
- [x] Add `youmd status` resident-sync health with loaded state, interval, last activity, and current warning visibility
- [x] Add opt-in curl installer support via `YOUMD_INSTALL_DAEMON=1`
- [x] Harden `context-sync.sh` so it fetches first and refuses pull/push when upstream includes non-context app-code paths
- [x] Add persisted dashboard machine/readiness cards for daemon status, last sync, blocked guards, MCP readiness, project-context sync, and env-vault readiness
- [ ] Extend resident sync beyond the local foundation into persisted personal stack/API/project graph records and per-project MCP context slices

### 2026-06-17 — Project portfolio graph and reuse catalog
- [x] Preserve Houston's project portfolio / API-MCP dependency / reusable pattern direction in a dedicated memo
- [x] Document how You.md currently saves and organizes Projects across identity bundle projects, project markdown packs, `trackedProjects`, repo mirror, DSI components, and Loop Reports
- [x] Define the portfolio graph product model: projects, API/MCP surfaces, dependency edges, integration tiers, protected product harnesses, public skill stacks, reusable patterns, and fresh-machine readiness
- [x] Capture reusable cross-project defaults for API/MCP/SkillStack-first architecture, role hierarchy, auth preference, app shell layout, agentic split workspace, and streaming response behavior
- [x] Track Lempod management across `bamfsite` and `bamfaiapp` as the first concrete duplicate-risk audit
- [x] Define the first local `portfolio_graph` / `reuse_patterns` data contract in `src/data/portfolioGraph.ts`
- [x] Add shared `portfolio-graph-auditor` skill plus local `youmd project portfolio-audit` / `env-audit` / `apis` command for secret-safe local project/API/env scans
- [x] Build the `/shell` Portfolio/Projects graph view with API/MCP ownership, connected projects, dependency tiers, docs status, shared skill propagation, and reusable pattern catalog
- [x] Persist project activity intelligence from local README/project-context files plus recent commits/PRs into `portfolioProjectActivities`
- [x] Add shipped `today` / `7d` / `30d` chips to project cards and a per-project shipping timeline in the Portfolio Graph pane
- [x] Visually verify authenticated local `/shell` shows 55 hydrated projects, high-signal project ordering, shipped chips, and the scrolled shipping timeline
- [x] Add compact portfolio project browser controls: search, focus filter, sort, density toggle, URL-backed clickable details, shipped `today` / `7d` / `30d` / `90d`, API docs URL/curl/stack surface details, and persisted project focus rank/status fields
- [x] Make direct project detail URLs such as `/shell?project=youmd` reload-safe by opening the Portfolio pane directly, then visually verify the shipped pulse, compact project list, detail URL, API docs/curl, stack install command, and row-level focus mutation in the authenticated Codex in-app Browser
- [x] Persist exact API/MCP/stack surface docs URLs plus curl/install commands in the portfolio graph and repo-backed graph snapshots
- [x] Enrich selected project detail pages with tracked-project graph links: stack/stack slug, GitHub repo evidence, exact API/MCP docs URLs, owner-gated portfolio graph curl command, docs curl commands, stack install command, and clone command
- [x] Make `details` and `timeline` controls anchored clickable project detail links (`#project-detail` / `#timeline`) and visually verify a real `View timeline for youmd` click scrolls to the shipping timeline
- [x] Make the Portfolio Graph shipped work more obvious: add latest shipped commit/PR/release rows to the main shipped pulse, add `latest shipped here` to selected project detail pages, label compact row shipped counters, expose full ranked focus dropdown labels, and visually verify timeline click plus reversible focus mutation
- [x] Production-QA the shipped/focus Portfolio Graph polish on `www.you.md`, catch the doubled `#project-detail#timeline` URL bug, and fix local anchor replacement so timeline clicks produce a clean `#timeline` hash
- [x] Enrich `GET /api/v1/me/portfolio/graph` project rows with project-level API docs, MCP docs, stack slug, repo/directory names, and safe curl command fields so local agents can consume the graph without reverse-joining tracked-project rows
- [x] After this commit is pushed and Convex deploys from the new `main`, rerun authenticated browser proof that changing a project focus status persists and the dropdown recovers from backend deploy gaps
- [x] Build the `/shell` APIs + Env Intelligence view with provider usage stats, env key-name normalization, service-account notes, API/MCP risk tiers, and secret-safe audit commands
- [x] Register `portfolio-graph-auditor` in the bundled local CLI skill catalog and align the Skills pane with `machine-bootstrap` + portfolio-audit catalog visibility
- [x] Run signed-in local visual QA for Portfolio Graph, APIs + Env Intelligence, and `/skills` tracked-project propagation at `http://localhost:3100/shell`
- [x] Run `youmd skill improve`, fix `shared:` skill source resolution, and install/sync `portfolio-graph-auditor` into the local You.md skill bundle
- [x] Fix the `/skills` unreadable orange explainer regression and add a readable local-agent sync proof strip for `portfolio-graph-auditor`, `meta-improve`, `proactive-context-fill`, and `get_agent_brief`
- [x] Teach local MCP `get_agent_brief` and `youmd://agent/brief` to include the portfolio graph, plus expose structured `youmd://portfolio/graph`
- [x] Self-improve the canonical shared `portfolio-graph-auditor` skill so it requires local agents to verify `get_agent_brief` / `youmd://portfolio/graph`, then sync the shared layer into Claude/Codex/Cursor/Pi and refresh the local You.md skill cache
- [x] Verify the local agent path end-to-end with real stdio MCP smoke, skill install refreshes, `youmd skill sync`, signed-in browser visual QA, focused CLI tests, lint/radius, and production build
- [x] Persist portfolio graph records in Convex instead of only the local static data contract
- [x] Teach MCP `get_project_context` to include a project-scoped portfolio graph slice before agents create new APIs, MCP routes, stacks, or reusable components
- [x] Export the persisted portfolio graph into repo-backed `projects/_portfolio/README.md`, `graph.md`, and mirror-safe `graph.json` snapshots during GitHub sync
- [x] Enrich active project strategy records from local README/project-context docs plus recent activity, including vision, solution, positioning, audience, north star, metrics, constraints, not-building, competitors, docs, and fallback local-audit summaries
- [x] Mine reusable code/UI/auth/layout/streaming/env/task patterns from active repos into `portfolioReusablePatterns` instead of relying on hand-written seed records
- [x] Persist secret-safe API/env provider account notes in owner-gated Convex records and verify the APIs/env pane can refresh persisted account metadata without exposing raw secrets
- [x] Re-run authenticated Codex in-app Browser proof for Houston's compact portfolio request: 55 persisted projects, shipped `today` / `7d` / `30d` / `90d`, typed search/sort/focus filtering, clickable details/timeline anchors, exact API/MCP docs/curl/stack/clone commands, and reversible project focus mutation
- [x] Re-run visible Codex in-app Browser proof after resume for Houston's compact portfolio request: 56 persisted projects, shipped `today` / `7d` / `30d` / `90d`, compact search/focus/sort controls, clickable cards plus details/timeline anchors, exact You.md graph/API/MCP/docs/install/clone commands, clean `#timeline` URL, and reversible `bamfsite` focus mutation back to `unset / 4`
- [x] Re-run visible local Portfolio Graph proof for Houston's latest compact portfolio ask: 56 persisted projects, typed search, focus filter, shipped-90 sort, exact You.md graph/API/MCP/docs/install/clone commands, clean timeline anchor, and reversible `agent-shared` focus mutation (`unset -> on-ice / 3 -> unset / 4`)
- [x] Fix exact-doc/curl fallback precision for stack-aware project details: `bamfaiapp` now shows BAMF docs/API/MCP URLs, BAMFStack install curl, GitHub clone command, and the BAMF API/MCP surface curl instead of generic You.md fallbacks; owner-gated portfolio graph rows now include focus status/rank, docs curl commands, stack install, clone command, shipped counters, and bounded latest-shipped rows for local agents
- [x] Verify the exact-doc/curl fallback fix on production `www.you.md` with an authenticated Browser session and owner API read-back for `bamfaiapp`
- [x] Add a true dense Portfolio Graph scan mode plus clearer selected-project actions (`open detail`, `timeline`, `api docs`, `mcp`) and labeled graph/API/MCP/stack/clone command snippets that are readable without bright orange blocks
- [x] Restore local-agent CLI help discoverability for `youmd project task --help`, `youmd project braindump --help`, and `youmd project --help`
- [x] Run authenticated Codex in-app Browser visual QA for the latest dense/detail polish and confirm dense rows, project click-through, labeled command snippets, API/MCP action chips, and no unreadable bright-orange blocks render correctly. Screenshots: `/tmp/youmd-portfolio-latest-details-shipped-focus-proof-2026-06-17.png`, `/tmp/youmd-portfolio-project-detail-links-proof-2026-06-17.png`, `/tmp/youmd-portfolio-project-graph-command-block-proof-2026-06-17.png`
- [x] Fix shell pane/query sync so clickable Portfolio project detail pages stay reliable after other workflows switch panes: leaving Portfolio now clears stale `project=`, direct project deep links re-open Portfolio, and visual QA verified card click, search, shipped-90 sort, API/MCP/stack/clone commands, clean `#timeline`, and no orange-block regression
- [x] Convert Portfolio project details from an inline lower-page appendix into a dedicated URL-backed drill-in state: `/shell?tab=portfolio` stays a compact project list, while `/shell?tab=portfolio&project=bamfaiapp` shows project overview with breadcrumbs; `#timeline` remains a section anchor inside the detail page and scrolls the nested pane after graph hydration
- [x] Apply the same compact list -> dedicated detail page pattern to YouStacks and Skills: `/shell?tab=stacks&stack=youstack` and `/shell?tab=skills&skill=portfolio-graph-auditor` now show focused detail pages with `<< back` breadcrumbs
- [ ] Apply the same compact list -> dedicated detail page pattern to APIs/env provider/surface rows, task triage, and brain-dump records so shell tabs do not become long mixed overview/detail pages
- [ ] Audit `bamfaiapp` and `bamfsite` Lempod management so one canonical API owner is documented before any duplicate endpoint work happens (deferred per Houston's 2026-06-17 focus change)

### 2026-06-17 — GitHub sync proof, Projects -> Tasks, and brain-dump routing
- [x] Archive Houston's continuation prompt and explicitly track the no-premature-completion rule
- [x] Identify why the shell GitHub icon can stay stale after `[ update ]`: the button did not call the real repo push/mirror actions
- [x] Wire shell `[ update ]` to publish, push to linked GitHub repo, refresh mirror, stream step transcript, and pulse the GitHub status dot while running
- [x] Return PR URL/number, merge state, and branch-recreated conflict retry info from `pushToRepo`
- [x] Add Convex tables for persisted project intelligence, API/MCP surfaces, dependency edges, reusable patterns, brain-dump captures, and owner-aware portfolio tasks
- [x] Add owner-gated Convex portfolio graph/task/brain-dump queries and mutations
- [x] Add project-scoped portfolio graph slices to local MCP `get_project_context`
- [x] Add shared `braindump-task-router` skill and register it in the shared stack map
- [x] Run shared-skill sync and verify the new skill appears in Claude/Codex/Cursor/Pi mirrors
- [x] Run Convex codegen/typecheck/tests and root/CLI builds for the new schema/API/MCP updates
- [x] Run a real local MCP `get_project_context` smoke that proves the portfolio slice is present
- [x] Run authenticated Chrome web QA against local `/shell`, click `[ update ]`, and verify chat transcript + GitHub icon timestamp behavior
- [x] Run the authenticated recent GitHub project analysis refresh and verify 90-day project catalog visibility
- [x] Add dashboard hydration for persisted portfolio graph records instead of static-only pane data, with static data demoted to bootstrap seed/fallback
- [x] Add first shell-chat task and brain-dump invocation on top of persisted `portfolioTasks` / `brainDumpCaptures`
- [x] Prove shell chat can trigger the repo update loop without relying only on the `[ update ]` button
- [x] Fix and re-prove shell-chat deterministic commands when the opening You Agent greeting is still thinking: `/braindump project:youmd ...` now bypasses the generic thinking guard, saved a raw capture, proposed one agent task, wrote `projects/_braindumps/recent.md`, merged PR #19, refreshed 53 mirror files, and returned GitHub chrome to `JUST NOW`
- [x] Prove the project-scoped `/task agent youmd: ...` shell path from the actual local composer: saved agent-owned task `web shell portfolio sync proof 20260617T175421Z`, wrote `projects/youmd/tasks.md`, merged identity PR #20, refreshed 53 mirrored files, returned GitHub chrome to `SYNCED / REPO MIRROR CURRENT / JUST NOW`, and verified the exact task entry on GitHub `main`
- [x] Add first-class dashboard task editing/triage controls on top of persisted `portfolioTasks` / `brainDumpCaptures`, plus API/MCP task status/priority updates for local agents
- [x] Add richer persisted task updates for title, description, owner, owner label, project/personal scope, status, priority, due date, and tags through Convex, HTTP, CLI, MCP, and dashboard quick-routing controls
- [x] Deploy the new task-update HTTP route and rerun authenticated `youmd project task update ...` against production; pre-deploy proof correctly returned `HTTP 404`, post-deploy proof published bundles v116/v119 and merged repo snapshot PR #16
- [x] Run authenticated local dashboard proof for richer task quick-routing controls: create a no-sync CLI task, route it to human/personal/high/in-progress in `TASK TRIAGE`, then mark it done and verify the open count returns to 5
- [x] Run authenticated production `/shell` verification for persisted Portfolio Graph, task controls, sidebar toggling, and production `[ update ]` GitHub sync; task `rx795skqcg5xjenrra3qdw39fs88vcbf` routed correctly, PR #17 merged into `houstongolden/houstongolden-you-md`, and the GitHub chrome returned to `JUST NOW`
- [x] Re-run authenticated local `/shell?project=youmd` update proof after the direct-detail/shipped-pulse portfolio push: clicked `[ update ]` from a stale `2H AGO` state, watched publish -> PR -> merge -> mirror refresh, confirmed PR #18 merged, and verified the GitHub chrome returned to `SYNCED / REPO MIRROR CURRENT / JUST NOW`
- [x] Add CLI/local-agent task and brain-dump invocation proof through You.md MCP/CLI
- [x] Add first-class persisted update run history for publish/push/PR/merge/mirror steps
- [x] Extend persisted update history with explicit GitHub check-status and conflict/no-conflict timeline events
- [x] Add a forced-conflict regression test for the 409 branch-recreation retry path
- [x] Seed the first persisted portfolio graph records from the dashboard bootstrap model and visually verify the Convex-backed pane
- [x] Run the real `portfolio-graph-auditor` hydration path against recent GitHub/local activity and verify the Portfolio Graph shows 55 persisted projects instead of only the 4-project bootstrap seed
- [x] Enrich active project strategy records with vision, pain points, solution, constraints, not-building, metrics, and competitors
- [x] Add scanner-derived reusable code/UI/auth/layout/streaming/env/task pattern records across active repos

### 2026-06-16 — Mobile capture, voice, Slack, and project routing
- [x] Preserve the 2026-06-16 Part 2 mobile brain-dump intent safely without private phone numbers or secrets
- [x] Add the durable mobile capture/product-routing memo to project context
- [x] Add a sanitized prompt capture under `project-context/prompts/`
- [x] Update PRD, architecture, personal API/MCP, connector, YouStacks, feature, request, changelog, current-state, and prompt-history docs
- [x] Record Sendblue as a provider candidate, not hardcoded architecture
- [x] Validate with `npm run docs:check`, `npm run agent-docs:lint`, `git diff --check`, and a focused phone/secret scan on the new capture files
- [x] Add a single You.md handoff file with done/next-slice/blocked-decision status for this lane (`project-context/voice-memo-part-2-youmd-handoff-2026-06-16.md`)
- [ ] Research and choose the first inbound capture pilot: Sendblue iMessage/SMS, generic SMS/RCS, Slack DM, manual paste, or audio transcript upload
- [ ] Decide the first Brain Dump Inbox home: `/shell` `connect -> api/mcp`, a dedicated inbox pane, or Files/Reports
- [ ] Design the inbound transcript/capture event data model with raw artifacts, redacted metadata, source hashes, sessions, routing state, and audit log links
- [ ] Define the personal API/MCP `captures` resource contract for artifacts, routing proposals, approvals, and clarification queues
- [ ] Build deterministic dedupe/segment/classify foundations before LLM interpretation
- [ ] Add project-routing and task/memory proposal UI with approval controls
- [ ] Choose the first downstream task destination after You.md-native proposals: project-context docs, GitHub issues, Notion, or product-specific boards
- [ ] Define the approval model for external writes to Notion, GitHub issues, project boards, CRM, Slack, and product apps
- [ ] Write the BAD workout transcript consumer handoff contract
- [ ] Write the Slack host adapter spec with channel allowlists, identity labels, draft/send modes, action scopes, and audit logs
- [ ] Write the voice clone/likeness safety spec for ElevenLabs or equivalent with consent, disclosure, revocation, and audit boundaries
- [ ] Define revocable voice/likeness grant objects and decide whether they extend `yg_` grants or use a dedicated grant family
- [ ] Preserve the "agent is you" / amplified-user framing in future capture, Slack, and voice UX/copy so the product stays identity-native

### 2026-06-16 — Machine bootstrap skill and project repo setup
- [x] Preserve Houston's fresh-machine skill request in active feature tracking
- [x] Add bundled `machine-bootstrap` skill for setting up new Macs/laptops/virtual agent hosts with You.md identity, skills, stacks, GitHub auth, and project repos
- [x] Add `youmd machine projects` for creating a Desktop code root and creating/cloning You.md project directories
- [x] Use GitHub repo names as target directory names when project records include GitHub URLs
- [x] Split recent/active projects from older projects with a configurable `--days` window and interactive older-project prompts
- [x] Add safe `--dry-run`, `--no-clone`, `--yes`, and `--root` options for agent-run setup
- [x] Verify the planner with focused CLI tests, build the CLI, and smoke the dry-run command
- [x] Hydrate recent GitHub repo URLs/activity into the fresh-machine planner so brand-new machines can clone exact repos from authenticated GitHub plus You.md brain records
- [x] Default fresh-machine project setup to `~/Desktop/CODE_YOU`
- [x] Add project stack names, API docs links, MCP docs links, repo/directory names, high-level goals, and recent progress to tracked project records and DSI/dashboard project catalog output
- [x] Link fresh-machine env handling to the canonical encrypted `.env.local` audit/backup/restore flow in `.agent-shared`
- [x] Add a dedicated signed-in machine/computer readiness card that shows this machine, synced computers, skill-stack sync, project clone readiness, and encrypted env-backup readiness in one dashboard/shell confirmation
- [x] Run the authenticated GitHub project refresh and verify the dashboard lists the 90-day active project catalog with repo, dir, stack, API/MCP docs, goal, and recent progress
- [x] Reseed/deploy the hosted bundled-skill registry so production `/api/v1/skills` includes `machine-bootstrap`
- [x] Add the same-origin web-domain `/api/v1/skills` proxy so docs/agents can use `https://you.md/api/v1/skills` instead of the raw Convex Site URL

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
- [x] Upgrade the Files pane markdown/artifact viewer with edit/preview/split modes, document metadata, heading outline, richer markdown rendering, and copy path/content controls
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
- [x] Add the first Bad.app fitness/body DSI component with REST/customData hydration, Reports refresh controls, source snapshots, and daily briefing body signal inclusion
- [x] Add the first BAMF.ai/BAMF OS pulse DSI component with REST/customData hydration, Reports refresh controls, source snapshots, and daily briefing connected-app pulse inclusion
- [ ] Add external report adapters for Perplexity industry pulse, richer school calendar writeback, external task apps, and richer BAMF/BAMF OS/LinkedIn/X/social range analytics
- [ ] Port h.computer historical daily log, daily journal, research/blog crawler, richer task creation/editing, richer BAMF/BAMF OS writeback/range source adapters, and richer Bad.app historical/range source adapters into You.md-native connectors
- [ ] Add owner-approved public profile rendering for selected DSI catalog components
- [x] Add secure public profile chat widget and `/api/v1/profiles/:username/conversation` first slice with public-context-only answers and provenance
- [x] Add hosted MCP parity for public profile conversation through `ask_public_profile`
- [x] Add owner controls for public profile chat style, public field allow-list, advertised capabilities, source-link return, and enable/disable state
- [ ] Add LLM voice tuning and optional local MCP parity for public profile conversation endpoints

### 2026-06-16 — Connector catalog and private API/MCP control center
- [x] Turn the Connectors pane into a clear owner control center with `api/mcp`, `apps`, `crawlers/loops`, and `repo` tabs
- [x] Surface the current user's private REST/MCP/stack endpoint docs, auth header contract, resource map, and API route table inside `/shell`
- [x] Make connected-app grants visible and manageable from the dashboard using the existing `yg_` grant backend
- [x] Add a Lovable-style app connector catalog with search, categories, pinned You.md/owned-project connectors, Custom API, Custom MCP, Custom Webhook, and popular third-party services
- [x] Replace generic connector icons with Google favicon API icons from real app domains and rank the catalog around Local Agent Runtime first, then You.md/owned/custom connectors, then popular apps like Slack, Notion, Gmail, Google Calendar, Linear, GitHub, HubSpot, Salesforce, Firecrawl, Stripe, and Google Drive
- [x] Show local-agent connection as a first-order connector path with CLI install/smoke-check copy and grant `lastUsedAt` verification language for Claude Code/Codex/local MCP sessions
- [x] Move GitHub repo sync into its own connector tab so it is no longer the whole Connectors page
- [x] Embed crawlers/loops beside the connector catalog, keeping native/Firecrawl/agent-browser, cron refresh, immutable versions, and approval controls visible
- [x] Make the private API/MCP control center directly discoverable from shell navigation, slash commands, command palette, and copyable agent-ready snippets

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
- [x] Bundled skill set expanded and reconciled to 9 shipped skills: `youstack-start`, `youstack-maintainer`, `machine-bootstrap`, `claude-md-generator`, `project-context-init`, `voice-sync`, `meta-improve`, `proactive-context-fill`, `you-logs`
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
- [x] Deploy/reseed the Convex bundled-skill registry so production `/api/v1/skills` includes `youstack-start`
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
- [x] Harden fresh-machine Secret Vault setup so strict Mac mini bootstraps wait for trusted-device `youmd env vault share` instead of defaulting into local/iCloud passphrase fallback; CLI bumped to 0.8.7
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
