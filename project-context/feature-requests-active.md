# Active Feature Requests — Tracked Until Verified

Last Updated: 2026-06-19

---

## 2026-06-19 — Live brain log and minimum shell surface

### 141. Make hidden cross-machine/agent activity visible as a terminal-style live log
**Status:** VERIFIED LOCAL / CONVEX PROD DEPLOYED
**Verified:** YES locally (root TypeScript pass, production Next build, Convex dev sync, Convex production deploy, local `next start -p 3100`, and Codex in-app Browser visual checks for `/shell` Live Log plus `/desktop-demo` System Status)
**Production Verified:** BACKEND YES / FRONTEND PENDING
**Source:** 2026-06-19 — Houston: "we can also just make it look like a real live server logs in a terminal and just have it as a toggle tab on the shell chat area basically - showing all the activity and updates the full central log of all updates across projects, skills, synced apps, crons, new inputs/sources etc..."
**Actionable Scope:**
1. Add a shell-chat-area toggle for a terminal-style live log instead of adding another right-pane tab. **DONE locally.**
2. Show high-signal realtime activity and sync proof as a product magic moment. **DONE local first slice:** realtime agent bus, shell agent progress, repo sync, identity bundle, local daemon health, skill mesh proof, Secret Vault metadata, machine proof, and recent chats.
3. Keep secrets out of the browser. **DONE local first slice:** only safe readiness metadata is rendered; raw `.env.local` values remain local/encrypted.
4. Use `minimal-surface` and the latest Project Clarity Audit direction to reduce the shell toward fewer core surfaces. **DONE local slice:** visible shell IA is now `Home`, `Brain`, `Projects`, and `Settings`; advanced surfaces are hidden under Settings.
5. Make the actual brain graph the canonical source for all project/skill/source/task/sync events. **DONE expanded durable slice:** owner-gated Convex `brainActivities` is the canonical stream; new realtime agent-bus messages mirror into it; shell Live Log reads it first; repo update runs/steps, portfolio task changes/triage/detail edits, brain-dump captures, and extracted brain-dump tasks write directly into it. **OPEN producer expansion:** skill self-improvements, portfolio hydrations, source crawls, and daemon checkpoints should write to `brainActivities` directly.
6. Reuse the same live-log primitive in `/desktop-demo` System Status so demo and real app converge. **DONE:** `LiveBrainLog` is now shared by the shell and desktop demo System Status.
**Progress (2026-06-19):** Added a `chat` / `live log` toggle inside `TerminalShell` and a terminal-style `central brain log` renderer. `DashboardContent` now reads owner-gated `api.brainActivity.listRecent`, polls authenticated local machine readiness every 10 seconds, and composes log entries from durable brain activity plus current agent progress, GitHub mirror/update state, identity bundle state, recent chat sessions, skill mesh proof, daemon health, Secret Vault metadata, machine readiness, and latest proof reports. The design intentionally keeps this in the chat column so it surfaces the magic moment without expanding the right-pane/navigation sprawl.
**Progress (2026-06-19 follow-up):** Added durable Convex `brainActivities` with indexes for user/source/kind/project/time, owner-gated `brainActivity.recordActivity` and `brainActivity.listRecent`, and agent-bus mirroring into the durable stream with redaction and `secretValuesExposed: false`. Extracted `LiveBrainLog` into `src/components/terminal/LiveBrainLog.tsx`, moved the shell query to `api.brainActivity.listRecent`, collapsed top shell IA to `Home`, `Brain`, `Projects`, and `Settings`, simplified the left sidebar to the same four groups, and reused `LiveBrainLog` in `/desktop-demo` System Status. Local in-app Browser proof confirmed `/shell` renders with no Convex render error, the `live log` button opens `CENTRAL BRAIN LOG` with `brain stream live`, and `/desktop-demo` System Status shows one `CENTRAL BRAIN LOG` with bus/daemon/machine rows.
**Progress (2026-06-19 producer follow-up):** Routed portfolio repo update runs/steps, task create/update/detail/triage mutations, brain-dump captures, and extracted brain-dump tasks into `brainActivities` with redacted text and `secretValuesExposed: false`. Focused Convex tests now prove repo update and task mutations create safe live-log rows; local Browser proof on `/shell?tab=tasks` confirmed the Tasks surface and Live Log remain healthy after the producer expansion.

---

## 2026-06-19 — Shared personal-stack clarity audit skill

### 140. Package Project Clarity Audit as a local global skill outside gstack
**Status:** DONE locally
**Verified:** YES (`youmd skill list` shows `project-clarity-audit`; `youmd skill use project-clarity-audit` renders the skill; shared-agent sync exposed it into Claude/Codex/Pi and the local You.md catalog points at `source: shared:project-clarity-audit`)
**Production Verified:** N/A (local/shared stack asset; pushed to `houstongolden/agent-shared`)
**Source:** 2026-06-19 — Houston: "package this as a local global skill for me - i don't want it inside gstack but my own stack and possibly shared with ystack too ..."
**Actionable Scope:**
1. Convert the reusable prompt into a real local global skill. **DONE.**
2. Keep canonical ownership outside gstack. **DONE** (`~/.agent-shared/claude-skills/project-clarity-audit`).
3. Make it available to the personal/You.md stack and potentially ystack/YouStack. **DONE** (`~/.youmd/skills/youmd-skills.yaml` registers `source: shared:project-clarity-audit`; `~/.youmd/skills/project-clarity-audit` symlinks to the shared canonical skill).
4. Sync across local agent hosts. **DONE** (`sync-agent-shared.sh` mirrored the shared skill into Codex and Pi; Claude points at the shared source; Cursor remains rules-based per the sync script).
**Progress (2026-06-19):** Added the shared `project-clarity-audit` skill with `/clarity-audit [LIGHT|FULL]` invocation, nine-phase audit workflow, status taxonomy, real-file/commit citation rules, and a strict quality gate. Registered it in the You.md local skill catalog as an installed shared skill, added the shared stack-map ownership note, logged the skill-governor learning, synced agent mirrors, verified You.md rendering, and pushed `agent-shared` commit `c4c8f62`.

---

## 2026-06-18 — Native desktop app design demo (frontend only)

### 139. Make the daily reference-intelligence loop prove actual You.md follow-through
**Status:** DONE locally
**Verified:** YES (`npm run references:sync` regenerated the reference artifacts with the new semantics, and the new follow-through ledger exists in project context)
**Production Verified:** NO
**Source:** 2026-06-18 — Houston: "are you sure? ... i've seen some activity on it the last day or two ... tell me what actionable follow ups and improvements you have taken ... if not, i need you to do more than just audit"
**Actionable Scope:**
1. Verify whether `steipete/agent-scripts` actually had recent upstream activity instead of trusting the prior summary. **DONE.**
2. Stop using phrasing that can make "no delta since last sync" sound like "no recent upstream activity". **DONE.**
3. Add a durable place to record what changed in You.md because of accepted reference-derived work. **DONE.**
4. Update docs/tracking so future daily runs are expected to leave a visible follow-through trail. **DONE.**
**Progress (2026-06-18):** Verified directly against the GitHub commits feed that `steipete/agent-scripts` had recent upstream activity on 2026-06-15 and 2026-06-16, with local reference head `6e512e6` matching the latest public commit. Patched `scripts/reference-intelligence.mjs` so `LATEST.md` now reports the latest upstream commit timestamp/age for each tracked repo and keeps "no new commits since last sync" scoped to the local-delta meaning. Added `project-context/reference-intelligence/FOLLOW_THROUGH.md` to show which reference-derived tasks have already changed You.md and which accepted tasks remain pending. Updated `REFERENCE_INTELLIGENCE.md`, `TODO.md`, `FEATURES.md`, and `CHANGELOG.md` so the daily loop is explicitly expected to produce tracked/shipped follow-through, not only raw audit artifacts.

### 138. Build a private, hosted, non-functional desktop-app frontend at `/desktop-demo` to lock the new UI/UX
**Status:** DONE pending Houston verification (frontend-only design demo; intentionally non-functional)
**Verified:** PARTIAL (production `next build` compiled + TypeScript passed for all new files; `scripts/check-radius.mjs` passes; dev server serves `/desktop-demo` HTTP 200 with expected content and no runtime errors. Visual screenshot proof blocked — Playwright browser binary download is disallowed by the sandbox network policy.)
**Production Verified:** PENDING (needs Vercel deploy + Houston eyes on `https://www.you.md/desktop-demo`)
**Source:** 2026-06-18 — Houston: "lets actually build out a private demo web version of the new desktop app front end only just to lock in the whole UI/UX ... just host the nonfunctional front end for this on /desktop-demo for now bc it will be much faster to iterate on the design"
**Actionable Scope (every part of the message):**
1. New consumer-friendly "second brain" surface, lighter than the CLI shell but rooted in the aesthetic (Notion/Obsidian/Claude/ChatGPT/Lovable feel). **DONE.**
2. Host the non-functional frontend at `/desktop-demo`. **DONE** (`src/app/(desktop)/desktop-demo`).
3. Zen, minimal, fully hideable/collapsible full-height left menu (project + file explorer / nav). **DONE** (collapsible `Sidebar`).
4. Main area = Notion/Obsidian-style rich markdown reader/editor + custom view panes (apps, tasks, home/dashboard). **DONE** (Home, Notes editor, Tasks, Connections, Sub-agents views).
5. Built-in interconnected Obsidian-style node graph across projects/skills/ideas/notes/agents. **DONE** (`GraphView`, SVG, hover-trace).
6. Mostly agent-controlled; "clone yourself" by spawning YOU sub-agents. **DONE** (`AgentsView` spawn flow with progress steps; chat offers to spawn).
7. Full-height clean agentic chat; toggle between full-chat (no main area) and 1/3-width chat + main area. **DONE** (split vs full-chat modes).
8. Codex-style sticky AI summary widget top-right in full-chat. **DONE** (`SummaryWidget`).
9. Toggle to shell/terminal mode running Claude Code / Codex / any CLI agent in-app (Notion × Conductor / Obsidian × Cmux). **DONE** (`TerminalView` with claude/codex/shell tabs).
10. Global principle: most powerful tool, most minimal product surface area. **APPLIED** throughout.
**Notes:** Stack recommendation for the real native build (Tauri vs RN etc.) was requested — to be answered in chat, not in code. Demo deliberately uses mock data and canned interactions.
**Follow-up (2026-06-18):** Houston reported it "looks terrible from my phone." Made the whole demo mobile-responsive — off-canvas drawer sidebar, single-column workspace with a bottom Chat/Workspace tab bar, collapsed title-bar chrome, and per-view reflow (Notes vault stacks on top, kanban/grids go single-column, graph legend → dots). Verified on a 390×844 phone viewport via system Chromium (screenshots of chat/drawer/Notes/Graph/Tasks). **DONE pending Houston re-check on `https://www.you.md/desktop-demo` after deploy.**

---

## 2026-06-17 — Fresh-computer You.md + active-project setup

### 137. Generate one-command setup for a brand-new computer and prove it on a real clean host
**Status:** IN PROGRESS (production graph-backed planning, readiness audit, bounded package checks, bounded dependency install/server probe mode, secret-safe proof reports, synced proof summaries, hosted skill registry parity, bounded graph-backed clean-root clone/proof, sudo-free live installer fix, bounded live generated-command env-vault proof, authenticated web/CLI proof, You.md Secret Vault v1 wiring, trusted-device envelope flow, realtime Secret Vault daemon-status wiring, source-Mac account snapshot upload/share, and realtime agent-bus source-Mac proof complete; npm `0.8.6` publish, actual Mac mini run, second-device envelope share, and two-Mac send/receive handshake pending)
**Verified:** PARTIAL (`youmd machine prompt` / `youmd machine verify` unit tests/build, bounded package-check tests/build, bounded dependency install/server probe tests, proof-report redaction test, full CLI test suite, root typecheck, docs generation/check, Convex codegen, full Convex test suite, production graph dry-run, compiled CLI prompt/readiness smokes, compiled CLI install+localhost HTTP 200 probe smoke, isolated installer user-prefix proof, global `youmd machine verify --write-report`, production `--sync-report` proof/read-back, bundled skill seed regression, live skill registry integration test, bounded clean-root clone/proof with `--max-clone-projects 2`, bounded live generated-command env-vault proof with `YOUMD_MAX_CLONE_PROJECTS=2`, server-builder proof consumption, authenticated local browser `/new computer` QA, authenticated Codex Browser Machine proof-sync QA, authenticated local Machine pane visual proof of the clean-root and env-vault rows, global CLI refresh, exact `youmd machine verify`/daemon-status command proof, and secret-leak log/UI scans passed)
**Production Verified:** PARTIAL (Convex graph + machine-proof endpoints deployed; hosted skill registry deployed/reseeded and live `/api/v1/skills` returns all 10 bundled/local-agent skills including `youstack-start`, `youstack-maintainer`, `machine-bootstrap`, and `portfolio-graph-auditor`; production dry-run fetched `55` projects / `40` tracked repos and selected `40` graph-backed cloneable repos; production proof sync/read-back returned one synced machine row with `61` scanned / `26` ready / `0` failures / `secretValuesExposed: false`; production API read-back returned the bounded clean-root proof row with `2` scanned / `1` needs env / `1` failure / `secretValuesExposed: false`; production installer commit `052507c` fixed npm-prefix `EACCES`; bounded live generated-command proof returned `READY` with `2` scanned / `1` ready / `0` needs env / `secretValuesExposed: false`; full real new-host/env-vault run pending)
**Source:** 2026-06-17 — Houston: "ensure that the skills that I requested earlier are going to leverage the projects graph and everything to finish or do a full setup of installing UMD and all your active projects on a brand new computer that I want to test..."
**Actionable Scope:**
1. Make the fresh-machine skill leverage the Projects/Portfolio Graph instead of only static local records. **DONE production slice:** `machine-bootstrap` now requires graph hydration before/after clone, `youmd machine prompt` previews the graph-backed setup plan, `GET /api/v1/me/portfolio/graph` exposes a secret-safe owner graph snapshot, and `youmd machine projects` fetches persisted graph records before planning.
2. Provide one copyable command/prompt for Claude Code or Codex on the new machine. **DONE local slice:** `youmd machine prompt` prints the artifact; web shell `/new computer` returns the same kind of copyable fenced command.
3. Have the command install You.md, authenticate, pull/sync identity, restore shared skills/stacks/agent config, create `~/Desktop/CODE_YOU`, clone active GitHub-backed projects, restore encrypted env vaults, rehydrate local evidence, install daemons, and show status. **DONE in generated command; production graph-backed clone plan, bounded clean-root clone/proof, post-clone readiness audit, and opt-in install/server probe path verified locally; pending real new-host/env-vault execution.**
4. Generate the web-shell prompt from natural language or `/new computer`. **DONE and visually verified:** signed-in local dashboard handles `/new computer`, switches to Skills, mints a 7-day scoped key, and renders the copyable command.
5. Embed an API key in the generated prompt without exposing raw `.env.local` values. **DONE local slice:** web shell creates a short-lived scoped key for the command; `.env.local` remains behind `YOUMD_ENV_VAULT` / encrypted local restore only.
6. Sync local skills/preferences/AGENTS/CLAUDE symlink behavior through the existing shared stack ownership model. **DONE in command path:** it runs `youmd machine setup`, `youmd skill install all`, `youmd skill sync`, `youmd skill link claude`, and `youmd skill link codex`; actual new-host proof pending.
7. Test on an actual brand-new computer / clean agent host. **PARTIAL:** bounded clean-root proof cloned two graph-backed repos into `/tmp/youmd-clean-host-CODE_YOU-20260617T0714`, synced proof state to You.md, and visually rendered in the Machine pane. Follow-up bounded live generated-command proof with a disposable encrypted fake env vault cloned `agent-shared` and `youmd` into `/tmp/youmd-fresh-env-vault-proof-20260617T153402Z/CODE_YOU`, restored `youmd/.env.local`, synced a `READY` proof row, and rendered it in authenticated `/shell` without exposing the fake secret value. **PENDING:** run the uncapped generated command on the actual new machine, verify full project clone count, shared skills/symlinks, local server startup for key projects, real env vault restore, resident daemon status, and Portfolio Graph sync back to You.md.
8. Add a first-class post-clone readiness/run checker. **DONE local slice:** `youmd machine verify` now reports git remotes, package managers/scripts, `.env.local` presence, `.env.example` presence, agent docs, and `project-context/` readiness without reading secret values, and the generated command runs it after clone/env restore. It supports opt-in bounded package checks with `--run-checks`, clean dependency installs with `--install-deps`, local dev-server probes with `--probe-servers`, project caps, script/server selection, timeout caps, redacted output tails, `--write-report` proof artifacts, and classified non-interactive setup blockers. **PENDING:** run the full command on the real new host after env/Convex setup is restorable non-interactively.
9. Sync verified machine proof state back into You.md so the dashboard can show tracked/synced computers. **DONE production slice:** `machineProofReports`, `POST /api/v1/me/machines/proof`, `GET /api/v1/me/machines/proofs`, `youmd machine verify --sync-report`, generated bootstrap `--write-report --sync-report`, signed-in Machine pane synced-proof rows, and the bounded clean-root synced proof row are implemented and verified. **PENDING:** real new-host/env-vault proof.
**Progress (2026-06-17):** Added `cli/src/lib/machine-bootstrap-prompt.ts`, `youmd machine prompt`, dashboard `/new computer` handling, command-palette/help/skills/docs discovery, and updated bundled `machine-bootstrap`. Verified compiled CLI output and authenticated local browser UI at `http://localhost:3100/dashboard`; screenshot: `/tmp/youmd-new-computer-prompt-2026-06-17.png`.
**Progress (2026-06-17 follow-up):** Added `GET /api/v1/me/portfolio/graph`, taught `youmd machine projects` to fetch persisted graph records and print source counts, added a dry-run setup preview to the generated command, deployed Convex, and verified the compiled production dry-run now reads `55` portfolio projects / `40` tracked repos and selects `40` graph-backed cloneable repos. Fixed false-positive GitHub inference from badge/docs URLs and covered it with a regression test.
**Progress (2026-06-17 MCP graph hydration follow-up):** Fixed the local-agent graph visibility gap that left `youmd://portfolio/graph` on the old static four-project fallback. Local MCP now fetches the authenticated persisted Portfolio Graph snapshot for `youmd://portfolio/graph`, maps that persisted graph into `get_agent_brief`, and resolves `get_project_context` project slices from the persisted graph before falling back offline. Live MCP SDK proof returned schema `you-md/portfolio-graph/v1`, `56` projects, `40` tracked repos, a BAMF.ai graph row with docs/curl fields, and a ready `bamfaiapp` project-scoped slice with one owned surface. Rehydrated the graph from `/Users/houstongolden/Desktop/CODE_2025` (`28` GitHub tracked records updated, `24` local audit records upserted, `9` reusable patterns updated), then compiled planner dry-runs selected `16` active/focused projects for 30d and `17` for 90d. Fresh-machine CLI/web commands now also try macOS Keychain service `youmd-env-vault` for the env-vault passphrase before prompting. The later env-vault handoff proof supersedes the earlier missing-vault blocker; remaining work is the actual new-host uncapped run.
**Progress (2026-06-17 env-vault handoff follow-up):** Verified a real encrypted env vault now exists at `~/Desktop/youmd-env-vault/env-vault-2026-06-17T2317Z.tar.enc`, tightened it to mode `600`, and proved the Keychain passphrase path using service `youmd-env-vault` without printing the passphrase. Secret-safe list proof showed `17` `.env.local` files and `3` agent-auth files with variable names/counts only; restore proof wrote `17` `.env.local` files into `/tmp/youmd-env-vault-restore-proof` and confirmed the agent-auth restore path without printing values. Added fresh-machine command auto-detection for the newest `~/Desktop/youmd-env-vault/env-vault-*` file, covered it with CLI/web parity tests, rebuilt the CLI, and updated the macOS clipboard command so the new Mac can run strict setup after the vault folder is moved to Desktop. Remaining: actual new-host run and visual Machine pane proof.
**Progress (2026-06-17 clipboard refresh continuation):** Re-checked the current source Mac handoff and found the macOS clipboard empty, so the immediate paste path was not ready. Re-ran the authenticated web-shell `/new computer` flow through a temporary owner web session, minted a fresh 7-day bootstrap key, copied the full `8783` character command to the macOS clipboard, and verified the clipboard shape independently: `YOUMD_API_KEY='ym_...'`, `~/Desktop/CODE_YOU`, `YOUMD_REQUIRE_ENV_VAULT`, auto-detected `~/Desktop/youmd-env-vault/env-vault-*`, Keychain service `youmd-env-vault`, `--recent-only`, active + Top Priority/Focusing setup gate, 90-day expansion prompt, hosted install curl, and `bash -n` status `0`. Current graph planner proof still selects `16` active/focused projects for 30d and `17` for 90d. Real vault list proof still shows `17` `.env.local` files and `3` agent-auth files without printing values. Screenshot: `/tmp/youmd-new-computer-command-refresh-2026-06-17.png`. Remaining: paste/run this command on the actual new computer and verify the synced machine proof row there.
**Progress (2026-06-18 graph/sync continuation):** Re-ran the actual local/GitHub Portfolio Graph hydrate from `/Users/houstongolden/Desktop/CODE_2025` instead of relying on persisted seed/static records. The hydrator scanned `131` auditor projects, found `30` local hydration candidates, mined `9` reusable patterns from `8240` files, updated `40` GitHub tracked rows, and upserted `30` local audit rows. Fresh planner proof now selects `15` active + Top Priority/Focusing projects for the 30-day first pass and `17` for the explicit 90-day expansion. Published latest owner bundle v137 through the API, found a CLI mismatch where `pull` still trusted a stale public profile endpoint while `status` read `/me`, patched `youmd pull` to prefer the authenticated published latest bundle, and verified live `youmd pull --force && youmd status` reports local/remote `33b6cc43a67d` with status `in sync`. Remaining: actual new-host/env-vault run and visual Machine pane proof from that host.
**Progress (2026-06-18 Machine pane setup surface):** Added a top Machine tab setup block so the product surface itself owns the new-computer handoff. The panel mirrors the Skills intro treatment, makes the blank-Mac goal explicit, and has a primary `copy setup command` action that mints a 7-day scoped bootstrap key from the signed-in shell and copies the full Claude Code/Codex bootstrap command. It also keeps `copy /new computer` as a shell-chat fallback. Verification passed typecheck, focused ESLint, full lint/radius, and production build. Remaining: signed-in visual click proof in the visible shell and actual Mac mini run with `~/Desktop/youmd-env-vault/` transferred.
**Progress (2026-06-18 Mac mini setup audit follow-up):** Audited the real Mac mini setup notes and fixed the major trial-and-error blockers in the product path: generated fresh-machine commands now prepend/persist You.md/Homebrew/Node 22 paths, check/install Homebrew, Node 22/npm, git, GitHub CLI, bun, and pnpm/corepack first, require GitHub auth before private `agent-shared`/project clones, install resident daemons early, continue past recoverable `youmd machine setup` warnings, auto-detect env vaults in local Desktop and iCloud Desktop, restore env files with `--map-existing --existing-only --skip-agent-auth`, and print one decisive Terminal command when GitHub browser auth cannot complete inside Claude/Codex. Added the same GitHub auth gate to `youmd machine setup`, made `you` CLI `/new computer` deterministic instead of LLM-routed, and verified with CLI/web parity tests, CLI build, root typecheck, production build, docs check, lint/radius, bash syntax checks, compiled prompt smoke, and fake encrypted env-vault list/restore proof through both raw bash and compiled CLI without leaking values. Remaining: re-run the updated generated command on the actual Mac mini with the real env vault and confirm the synced Machine pane proof row.
**Progress (2026-06-18 Secret Vault follow-up):** Added account-backed You.md Secret Vault v1 so trusted new devices can pull encrypted env-vault snapshots after login instead of depending only on a manually moved local file. The implementation adds `secretVaultSnapshots`, `GET/POST /api/v1/me/secret-vault/env` with required `vault` scope, CLI `youmd env vault push/list/pull`, fresh-machine Secret Vault pull before local/iCloud fallback, Machine pane copy updates, bundled `machine-bootstrap` Keychain guidance, and the `$HOME/Desktop/CODE_YOU` fix for the Mac mini literal-tilde bug. Verification passed Convex codegen, Convex deploy, focused fresh-machine parity tests, CLI build, root typecheck, root production build, docs check, lint/radius, compiled prompt smoke, live `youmd env vault list` safe empty-state smoke, and env-vault bash syntax. Added clearer CLI guidance for stale/non-vault auth failures. Houston clarified that future visual QA in this thread must use real Chrome, gstack/browser, or Codex in-app browser only, not headless Chrome or Playwright. Remaining: run `youmd env vault push --root ~/Desktop/CODE_2025 --out ~/Desktop/youmd-env-vault` on the source Mac with the real vault/passphrase, rerun the generated command on the Mac mini, and verify Secret Vault pull + synced Machine proof row.
**Progress (2026-06-18 realtime agent-bus follow-up):** Added a trusted-device agent bus so Macs/agents can send context/status messages to each other over Convex realtime instead of relying only on GitHub or local files. Production now has owner-gated `realtimeAgentMessages`, `GET/POST /api/v1/me/agent-bus/messages`, CLI `youmd agent send/inbox/status`, realtime-daemon materialization into `~/.youmd/realtime-sync-status.json` and `~/.youmd/agent-bus/inbox.json`, and Machine pane `realtime agent bus` status near the top. Generated fresh-machine prompts and the hosted `machine-bootstrap` skill now instruct Claude/Codex on the Mac mini to send `machine-sync` milestones with `youmd agent send`. Live proof from the source Mac sent `am_7YmkFS2V0tFV1sS8s1VfoLLQ`; a short websocket sync tick materialized `2` recent agent messages and Secret Vault ready state locally, with `secretValuesExposed: false` and zero raw `ym_` / `sk-` / env-key leaks in the status JSON. CLI is bumped to `0.8.6`; remaining: Houston publishes `youmd@0.8.6`, reruns the Mac mini prompt, and confirms the Mac mini sends a reply visible on this source Mac.
**Progress (2026-06-18 Mac mini stale-install follow-up):** Houston's Mac mini run proved the setup could still continue with stale installed `youmd 0.8.2` because npm latest was behind and the deployed installer path had not guaranteed the source channel. Source Mac account Secret Vault is present (`env-vault-2026-06-18T0741Z.tar.enc`, `16` projects / `451` vars, `secretValuesExposed: false`), so the “empty vault” symptom is most likely stale CLI/install/auth path rather than missing source data. Fresh-machine CLI/web prompts now force `YOUMD_INSTALL_CHANNEL=source YOUMD_SOURCE_REF=main`, add `MIN_YOUMD_VERSION=0.8.6`, run `ensure_youmd_min_version`, and exit before vault work if the install remains stale. `install.sh` now refuses to report success when the installed binary is older than the generated `CLI_VERSION`, and auto-upgrade defaults to source. Remaining: publish/deploy this follow-up, rerun on Mac mini, then store the vault passphrase in Keychain once if local AES decrypt still needs the human-gated passphrase.
**Progress (2026-06-18 trusted-device envelope follow-up):** Closed the Notion-like Secret Vault gap for trusted devices. Convex production now stores registered Secret Vault devices and per-device encrypted passphrase envelopes; CLI local `0.8.6` has `youmd env vault device-register`, `device-list`, `share`, and `pull --restore` envelope unlock. Fresh-machine CLI/web prompts now register the new Mac first, try trusted-device `pull --restore`, and instruct the source Mac to run `youmd env vault share` if no envelope exists. Source-Mac live proof registered device `svd_e87e4e3e4dc843ac1f8d73d7`, validated the source passphrase against `env-vault-2026-06-18T0741Z.tar.enc`, shared one envelope, proved headless restore into an empty temp root with no values printed, and refreshed realtime status to `Secret Vault ready: 16 projects / 451 vars ... / 1/1 device envelopes`. npm latest is still `0.8.5`; remaining: publish `0.8.6`, rerun Mac mini setup so it registers as a second device, rerun `youmd env vault share` on source, continue Mac mini restore, and verify machine proof + agent-bus reply.
**Progress (2026-06-18 shell polish follow-up):** Clarified the next Mac mini run expectation: the Mac mini does not need the env-vault passphrase before setup; it registers a local trusted-device key, then the source Mac runs `youmd env vault share` once with the source vault passphrase/Keychain to create the Mac mini's encrypted envelope. Also fixed the visible Machine/Vault/Skills shell UX: added shared `PaneCallout`, converted the top explainer/copy-prompt blocks to the Skills-style left accent + gradient treatment, removed the bright orange Vault block, and contained the sidebar YOU logo in a fixed square parent for expanded/collapsed states. Verified in Codex in-app Browser with no console warnings/errors. Remaining: Houston publishes `0.8.6` and reruns Mac mini setup.
**Progress (2026-06-17 readiness follow-up):** Added `youmd machine verify` / `readiness` / `doctor`, wired it into the one-command bootstrap, documented it in `machine-bootstrap`, and verified it with focused CLI tests plus a compiled readiness smoke against `/Users/houstongolden/Desktop/CODE_2025`. It reports readiness without reading `.env.local` values.
**Progress (2026-06-17 bounded-checks follow-up):** Added `youmd machine verify --run-checks` with default `typecheck`, `lint`, `test`, and `build` scripts, configurable `--check-scripts`, `--check-timeout-ms`, and `--max-check-projects`, generated prompt support via `YOUMD_RUN_CHECKS=1`, and machine-bootstrap docs. Verified with focused CLI tests, `cli npm run build`, and `git diff --check`.
**Progress (2026-06-17 signed-in readiness dashboard follow-up):** Added authenticated localhost-only `GET /api/local/machine-readiness`, the `/machine` / `stacks -> machine` shell pane, and secret-safe local readiness collection for daemon health, project clone/package/env-doc readiness, local You.md auth, shared skill mirrors, Codex/Claude MCP configs, and env-vault tooling. Authenticated Codex in-app Browser QA verified current-root and fresh-root views, `3/3` daemons loaded, `61` project directories scanned, `api key present READY`, env audit/backup/restore scripts ready, `secret values exposed: false`, and the `CODE_YOU` fresh-root blocker. Refreshed the global `youmd` install from the local CLI so the pane's copyable `youmd machine verify --root /Users/houstongolden/Desktop/CODE_2025` command works in a normal shell. Screenshots: `/tmp/youmd-machine-readiness-pane-2026-06-17-v2.png` and `/tmp/youmd-machine-readiness-stack-env-proof-2026-06-17-v2.png`.
**Progress (2026-06-17 local-run proof follow-up):** Added `youmd machine verify --install-deps` and `--probe-servers` for bounded clean-host dependency install and localhost dev-server proof. The generated one-command bootstrap now supports `YOUMD_INSTALL_DEPS=1` and `YOUMD_PROBE_SERVERS=1`, with install/server project caps and timeout controls. Verified with focused CLI tests, full CLI test suite (`53` files / `557` tests), CLI build, root typecheck, docs check, focused ESLint, production build, and a compiled CLI smoke against a disposable project where `npm install` passed and `npm run dev` returned HTTP 200 on `127.0.0.1`.
**Progress (2026-06-17 proof-report follow-up):** Added `youmd machine verify --write-report`, which writes `~/.youmd/machine-reports/latest.json` plus a timestamped archive with `secretValuesExposed: false`, readiness totals, optional install/check/server pass counts, warnings, and redacted output tails. The generated bootstrap command and bundled `machine-bootstrap` skill now write proof reports automatically. The localhost Machine readiness builder reads the latest proof and the `/machine` pane renders a latest-proof strip with host/root/status/totals plus the full fresh-root proof command. Verified with focused CLI tests, full CLI test suite (`53` files / `558` tests), CLI build, root typecheck, docs check, focused ESLint, production build, compiled custom-report smoke, global default-report smoke against `/Users/houstongolden/Desktop/CODE_2025`, and direct server-builder proof consumption. Authenticated browser visual proof for the new strip is pending because no attachable authenticated browser session was available in this turn.
**Progress (2026-06-17 proof-sync follow-up):** Added durable owner-gated `machineProofReports`, authenticated machine proof sync/list endpoints, `youmd machine verify --sync-report`, generated bootstrap `--write-report --sync-report` across readiness/check/install/server phases, regenerated OpenAPI/agent docs, and added synced machine rows to the signed-in Machine pane. Verified with focused Convex tests, full Convex suite (`44` files / `427` tests), focused CLI tests, full CLI suite (`53` files / `558` tests), CLI build, root typecheck, docs check, focused ESLint, production build, compiled prompt smoke proving every generated verify phase includes `--sync-report`, production Convex deploy via GitHub Actions run `27690893196`, production live sync with `node cli/dist/index.js machine verify --root /Users/houstongolden/Desktop/CODE_2025 --max-projects 80 --write-report --sync-report`, API read-back showing `1` synced machine row (`61` scanned, `26` ready, `2` needs env, `8` partial, `0` failures, `secretValuesExposed: false`), and authenticated Codex Browser QA screenshot `/tmp/youmd-machine-proof-sync-records-2026-06-17.png`. Actual new-host execution is still pending.
**Progress (2026-06-17 bounded clean-root proof):** Added `--max-clone-projects` / `YOUMD_MAX_CLONE_PROJECTS` so agents can prove a clean-root setup without cloning every active repo. The compiled dry-run read production graph data (`55` portfolio projects, `40` graph-tracked repos, `41` recent GitHub repos), then the capped live run cloned `youmd` and `agent-shared` into `/tmp/youmd-clean-host-CODE_YOU-20260617T0714`. `youmd machine verify --write-report --sync-report` synced the proof to You.md; a bounded install/server pass showed `npm ci` passed for `youmd` and the only server blocker was Convex prompting in a non-interactive terminal before dev startup. The verifier now classifies that blocker explicitly. Production API read-back confirmed the synced row with `secretValuesExposed: false`, and authenticated local `/shell` visual QA showed the clean-root synced row plus warning text even without a localhost readiness report; screenshot `/tmp/youmd-local-machine-clean-host-proof-2026-06-17.png`. The actual uncapped new-machine/env-vault run remains pending.
**Progress (2026-06-17 hosted registry proof):** Added the missing Convex bundled skill seed rows for `youstack-maintainer`, `machine-bootstrap`, and `portfolio-graph-auditor`, plus `convex/skillsSeed.test.ts` to prove the local-agent registry seeds all 10 skills. Deployed Convex, ran `npx convex run skills:seedBundledSkills`, and verified the live Convex Site `/api/v1/skills` returns `count: 10` with the full bundled/local-agent set. Full-content lookups verified `machine-bootstrap` contains graph-backed machine setup commands and `portfolio-graph-auditor` contains `get_agent_brief` plus env-audit instructions. The existing live CLI integration test now asserts the exact 10-skill registry contract.
**Progress (2026-06-17 canonical skills API follow-up):** Added a same-origin Next proxy for `GET/OPTIONS /api/v1/skills`, so README/docs examples using `https://you.md/api/v1/skills` match a real web-domain route instead of requiring agents to know the raw Convex Site URL. Local proof on `http://localhost:3100/api/v1/skills` returned `count: 10`; production proof after deploy returned `count: 10` on `https://www.you.md/api/v1/skills`, apex `https://you.md/api/v1/skills` followed successfully, `?name=machine-bootstrap` returned full content with graph-backed setup commands, and `OPTIONS` returned public CORS headers.
**Progress (2026-06-17 live env-vault bootstrap proof):** Running the actual generated command against live production first exposed a real fresh-machine blocker: the hosted installer tried to write npm globals under `/usr/local` and failed with `EACCES`. Fixed `https://you.md/install.sh` to fall back to a user-writable `~/.youmd/npm-global` prefix, symlink the CLI binaries into `~/.youmd/bin`, and persist PATH without sudo; isolated fake-HOME proof passed, production deployment `dpl_8onXNRgPofB7GjbAtHK4LEzZYMDg` was ready, and live installer content verified. Re-ran the generated command with `YOUMD_MAX_CLONE_PROJECTS=2` and a disposable encrypted fake env vault at `/tmp/youmd-fresh-env-vault-proof-20260617T153402Z`: it installed without sudo, cloned `agent-shared` and `youmd`, listed/restored `youmd/.env.local` by variable names/counts only, rehydrated the portfolio graph, wrote/synced a `READY` proof (`2` scanned / `1` ready / `0` needs env / `secretValuesExposed: false`), and authenticated local `/shell` visually showed the row at `/tmp/youmd-machine-proof-env-vault-visual-2026-06-17.png`. Secret scans confirmed the fake secret value did not appear in the bootstrap log, proof JSON, or rendered UI. The actual uncapped new-machine run with the real vault remains pending.
**Progress (2026-06-17 strict env-vault proof follow-up):** Re-ran the graph-backed clean-root lane with `--max-clone-projects 5` at `/tmp/youmd-fresh-machine-proof-20260617T183447Z/CODE_YOU`; it cloned `youmd`, `agent-shared`, `bamfsite`, `houstongolden-you-md`, and `bamfaiapp` from the persisted Portfolio Graph / recent GitHub merge, verified their remotes, wrote/synced a secret-safe proof row, and correctly reported `needs-env` because no real encrypted vault file or Keychain-stored vault passphrase was available in this session. Added `youmd machine prompt --require-env-vault` / `YOUMD_REQUIRE_ENV_VAULT=1` plus web-shell parity so real proof commands fail before readiness completion when `YOUMD_ENV_VAULT` is missing. The actual uncapped new-machine run with the real vault remains pending.
**Progress (2026-06-17 hosted strict-skill proof):** Pushed commit `bf4f5e4`, watched GitHub CI and Convex Deploy complete successfully, confirmed Vercel production deployment `youmd-cn8vux75k-hubify.vercel.app` was ready, ran `npx convex run --prod skills:seedBundledSkills` to refresh all `10` hosted bundled skills, and verified both `www.you.md` and the apex redirect path return `machine-bootstrap` content containing `--require-env-vault` and `YOUMD_REQUIRE_ENV_VAULT`.
**Progress (2026-06-17 strict real-vault disposable-host proof):** Created a real encrypted env vault from the local `CODE_2025` tree with `17` `.env.local` files and `3` agent-auth files using an in-process passphrase; backup/list/bootstrap logs passed secret-pattern scans. The uncapped generated setup selected `43` active projects, cloned `41` repos plus `2` directory-only projects into `/tmp/strict-real-env-bootstrap-20260617T185635Z/CODE_YOU`, and exposed a post-clone shutdown hang in `youmd machine projects --yes`. Fixed the `machine` CLI action to exit cleanly after `machineCommand` returns, then reran the strict generated command against that root with the real vault. It skipped existing clones, listed/restored `17` env files and `3` agent-auth files, synced a proof row with `48` scanned / `41` git / `25` ready / `8` needs-env / `4` partial / `secretValuesExposed: false`, ran bounded checks/installs/server probes (`2/3` installs passed, `1/2` server probes passed), and completed status `0`. Added `YOUMD_PORTFOLIO_HYDRATE_TIMEOUT_SECONDS` guards after post-restore hydration wedged on the large restored root. Headless Playwright could not visually verify `/shell` because it reached sign-in, so authenticated visual Machine-pane proof on a logged-in browser remains pending.
**Progress (2026-06-17 30-day-first new-computer urgency):** Updated the generated `/new computer` / `youmd machine prompt` contract to start with truly active 30-day projects in `~/Desktop/CODE_YOU`, added `youmd machine projects --recent-only` so out-of-window projects are skipped without prompting, and added an explicit 90-day expansion question before the script can report the full project clone set complete. The web-shell generator, CLI generator, bundled `machine-bootstrap` skill, docs, Help pane, and Skills pane now teach the 30-day-first flow. Verification passed focused prompt tests, CLI build, root build/lint, compiled prompt smoke, and compiled recent-only dry-run proof against persisted graph data (`56` projects / `40` tracked repos / `30` selected / `12` skipped outside 30d). The actual new-computer run with Houston's real bootstrap key/env vault remains pending and must not be marked complete until verified.
**Progress (2026-06-17 recency/manual-override proof):** Portfolio rows now show GitHub recency separately from Portfolio graph activity and expose active/inactive/setup-eligible counts next to the setup gate. Authenticated local Browser QA verified `active 47`, `inactive 9`, `setup eligible 24`, row `github updated` labels, and a reversible `h-computer` manual status mutation (`active -> inactive -> active`). CLI planner proof selected `16` setup-eligible projects for the 30-day pass and `17` for the 90-day pass, both through `Portfolio Graph status=active and focus=Top Priority/Focusing only`. Env-vault preflight found `17` `.env.local` files plus `3` agent-auth files; the later env-vault handoff proof supersedes the earlier missing-vault blocker. Real new-computer strict proof remains pending.
**Progress (2026-06-17 runtime compatibility follow-up):** Added a compatibility guard to the CLI and web-shell generated command so current/source installs use `--recent-only`, while older fallback npm installs run `youmd machine projects` with stdin from `/dev/null` and cannot block on older-project prompts. Re-verified focused prompt tests, CLI build, compiled prompt smoke, root build, and `git diff --check`.
**Progress (2026-06-17 live shell command proof):** Submitted `/new computer` in the authenticated local shell, verified it minted a fresh 7-day bootstrap key and generated the secret-bearing command, then copied the full command to the in-app browser clipboard for the immediate new-computer paste. Redacted proof confirms `~/Desktop/CODE_YOU`, 30-day first pass, source install curl, bootstrap-key login, portfolio hydrate before clone, recent-only fallback, env-vault handling, explicit 90-day expansion prompt, and honest 30-day/full completion language. Actual new-computer execution with the real env vault remains pending and must stay open.
**Progress (2026-06-17 active-focus setup gate):** Tightened `youmd machine projects` and generated fresh-computer prompts so the Portfolio Graph is now the default setup authority: when graph records exist, the planner clones only projects with `status: active` and `focusStatus: top-priority` or `focusing`; inactive, unsorted, on-ice, abandoned, killed, and unreviewed GitHub-only repos are skipped unless `--include-inactive` is explicitly supplied. Added manual project status persistence (`active`/`inactive`) with `statusSource: manual`, preserved it through tracked GitHub hydration, and verified the built CLI dry-run against the live graph: `56` projects / `40` tracked repos -> `16` selected / `84` skipped. Focused CLI tests, Convex regression, CLI build, lint/radius, production build, GitHub CI run `27721954290`, Convex Deploy run `27721954253`, and authenticated local Browser write proof passed; the UI changed `bamfaiapp-next` from `active` to `inactive` and showed `project status updated: bamfaiapp-next / inactive`.
**Progress (2026-06-17 setup-eligible filter proof):** Added a visible Portfolio `setup eligible` filter and count so Houston can see exactly which projects the new-computer planner will clone by default. Local authenticated Browser QA verified `LAST UPDATED` time-ago labels, `SETUP YES` row badges, active/inactive buttons, the filter narrowing to `24 / 56`, and a reversible `bamfaiapp-next` status mutation (`inactive -> active -> inactive`). The compiled CLI dry-run now prints the same setup-gate line and selected `16` projects while skipping `84` not-eligible/duplicate/unusable candidates. Screenshot: `/tmp/youmd-portfolio-setup-eligible-filter-toggle-proof-2026-06-17.png`. Actual new-computer execution with the real env vault remains pending and must stay open.
**Progress (2026-06-17 env-vault handoff clarity):** Tightened the actual handoff surface for the immediate new Mac run. Generated CLI/web commands now print `youmd env backup --root ~/Desktop/CODE_2025 --out ~/Desktop/youmd-env-vault` when `YOUMD_ENV_VAULT` is missing, explain moving the generated `env-vault-*.tar.enc` to the new machine, and strict mode exits before readiness is marked complete. The web-shell command now includes `YOUMD_CODE_ROOT='~/Desktop/CODE_YOU'` and `YOUMD_REQUIRE_ENV_VAULT='1'` by default. The Machine pane now renders copyable `/new computer`, strict CLI prompt, and old-machine vault backup commands; authenticated Browser proof saved `/tmp/youmd-machine-fresh-handoff-commands-proof-2026-06-17.png`. Actual new-computer execution with the real env vault remains pending and must stay open.
**Progress (2026-06-17 copy-button proof):** Fixed the actual web-shell `/new computer` artifact copy path. Fresh-machine command blocks now show a visible `copy command` button, keep the long paste command in a bounded scroll area, and only report `copied` after a real clipboard write. Authenticated Codex in-app Browser proof switched to the visible shell tab, clicked the real button, and verified the clipboard changed from a sentinel to the full 7633-character command. Redacted proof confirmed `ym_...` bootstrap key shape, `~/Desktop/CODE_YOU`, `YOUMD_REQUIRE_ENV_VAULT=1`, hosted install curl, `--recent-only`, active + Top Priority/Focusing setup gate, the interactive 90-day `[y/N]` expansion prompt, and no `.env.local=` / `sk-...` secret patterns. Actual new-computer execution with the real env vault remains pending and must stay open.
**Progress (2026-06-17 direct clipboard + vault blocker):** Re-ran machine-sync preflight from current state: `.agent-shared` was already up to date, shared skill mirrors synced, and `youmd sync` pulled the latest remote draft into `~/.youmd` plus re-rendered all `10` skills. Because the Browser plugin's virtual clipboard was unavailable for a fresh in-browser `/new computer` retry, minted a fresh scoped bootstrap key through the authenticated API and wrote the full generated prompt directly to the macOS clipboard with `pbcopy`; redacted proof showed a `10,153` character prompt / `7,633` character command with `ym_...`, `~/Desktop/CODE_YOU`, strict env-vault mode, install curl, `--recent-only`, active/focus setup gate, and interactive 90-day expansion prompt. Env preflight found `17` `.env.local` files and `3` agent-auth files; the later env-vault handoff proof supersedes the earlier missing-vault blocker. Actual new-computer execution with the real env vault remains pending and must stay open.

## 2026-06-17 — Shell sidebar expand/collapse regression

### 136. Fix left sidebar menu stuck collapsed
**Status:** DONE (authenticated local + production visual QA passed; Houston visual approval still welcome)
**Verified:** YES (focused dashboard lint, root lint/radius, `git diff --check`, `npm run build`, authenticated local `/shell` Playwright QA, and authenticated production `/shell` sidebar QA passed)
**Production Verified:** YES (production `/shell` toggled `56px -> 244px -> 56px` with expanded labels visible; screenshots `/tmp/youmd-production-sidebar-expanded-2026-06-17.png` and `/tmp/youmd-production-sidebar-collapsed-2026-06-17.png`)
**Source:** 2026-06-17 — Houston: "the left sidebar menu is stuck collapsed and will not properly expand/collapse"
**Actionable Scope:**
1. Investigate why the left shell sidebar cannot reliably expand/collapse. **FINDING:** the responsive auto-collapse rule below `1520px` overrides the user's click when the detail pane is open, so the rendered `effectiveSidebarCollapsed` can stay `true` even after the user clicks expand.
2. Make manual expand/collapse clicks override auto-collapse. **DONE locally:** sidebar persistence now uses explicit `auto` / `expanded` / `collapsed` mode, and the toggle writes a manual override from the rendered state.
3. Verify locally and in production in the actual shell UI. **DONE:** minted real web sessions, opened local `http://localhost:3100/shell` and production `https://www.you.md/shell`, clicked the visible sidebar toggle, verified the rail toggled `56px -> 244px -> 56px`, confirmed labels render in expanded state, and saved screenshots `/tmp/youmd-sidebar-expanded-auth-2026-06-17.png`, `/tmp/youmd-sidebar-collapsed-auth-2026-06-17.png`, `/tmp/youmd-production-sidebar-expanded-2026-06-17.png`, and `/tmp/youmd-production-sidebar-collapsed-2026-06-17.png`.

## 2026-06-17 — Project portfolio graph, API/MCP dependency map, and reuse catalog

### 135. Finish live GitHub sync proof, persisted project graph, project tasks, and brain-dump routing
**Status:** IN PROGRESS (core implementation + real active-project hydration + local authenticated web proof + production authenticated web proof + CLI/local-agent task/brain-dump proof + dashboard/API/MCP task triage + deployed richer task update contract + persisted shell update history/timeline complete for normal PR path + forced conflict-path regression proof + repo-backed graph snapshots + active project strategy enrichment + scanner-derived reusable pattern mining + bounded clean-root machine proof verified; mobile/watch adapters and full actual new-host/env-vault verification still open)
**Verified:** PARTIAL (root build, Convex tests/typecheck, CLI build, local MCP smoke, shared-skill mirror sync, authenticated Chrome `/shell` repo-update QA, authenticated Codex in-app Browser `/shell` update QA, authenticated production `/shell` Portfolio/task/sidebar/update QA, authenticated persisted update-history/timeline QA, forced 409 GitHub branch-recreation regression, authenticated repo-backed portfolio graph snapshot QA, authenticated persisted Portfolio Graph pane QA, authenticated 90-day GitHub project catalog refresh QA, authenticated real portfolio hydration from GitHub/local auditor data, active project strategy enrichment with authenticated Codex in-app Browser proof, authenticated shell-chat task/brain-dump repo-sync QA, authenticated CLI task/brain-dump repo-sync QA, built MCP registry proof, authenticated browser verification of CLI-created rows, authenticated dashboard task-triage QA, authenticated dashboard task detail/quick-route QA, API/local-agent task-triage proof, focused task-detail Convex regression, production task-update CLI proof, repo-backed task snapshot PR #16, identity repo PR #17 production sync proof, Convex Deploy, Agent Docs, CI rerun, root production build, lint/radius, and CLI build passed)
**Production Verified:** PARTIAL (Convex backend deployed to `kindly-cassowary-600`; production deployment `dpl_4DDQihfn488MFgJtMjUkomBFmyPZ` served authenticated `/shell`; Portfolio Graph showed `55 PROJECTS` / `CONVEX PERSISTED GRAPH` / `40 recent GitHub-tracked projects nearby`; production task `rx795skqcg5xjenrra3qdw39fs88vcbf` was routed through the dashboard and marked done; production `[ update ]` merged identity repo PR #17, refreshed `53` mirror files, and returned GitHub chrome to `JUST NOW`; production API read-back confirmed the bounded clean-root proof row; mobile/watch and full new-host/env-vault proof still pending)
**Source:** 2026-06-17 — Houston: "yo stop prematurely marking goals especially long-running goals complete... github icon still shows the last sync was 3H Ago... Add persisted Convex/repo-backed portfolio graph records... Add project-scoped portfolio slices to get_project_context... PROJECTS => Tasks... Task Owner: Agents, Me... braindumps... Fireflies AI for your workout thoughts/ideas..."
**Actionable Scope:**
1. Stop marking long-running goals or large feature lanes complete until the real success condition has been visually and functionally verified. **ACTIVE RULE:** broad goal remains open until the web/CLI agent, GitHub sync status, persisted graph, project slices, and task/brain-dump foundations are proven or exact blockers are documented.
2. Audit the shell GitHub icon stale state. **FINDING:** top `[ update ]` streamed a publish preflight but did not actually call `pushToRepo` or `syncMirror`, so `repoMirror.syncedAt` could remain stale.
3. Wire the shell `[ update ]` button to the real repo flow: publish current bundle, push identity files through the existing PR/direct GitHub action, refresh the repo mirror, stream each step into shell chat, and animate the status dot while running. **DONE and authenticated Chrome + Codex in-app Browser verified locally and in production.**
4. Preserve PR/conflict/merge details in the shell transcript/artifact. **DONE normal PR path + forced conflict regression:** `pushToRepo` returns PR number, PR URL, merged state, branch-recreated conflict retry info, and structured GitHub timeline events for transcript/persistence use. Persisted `repoUpdateRuns` / `repoUpdateSteps` now store publish, push, PR, merge, commit, pushed files, mirror counts, error state, ordered steps, default branch head, sync branch commit, PR open, squash merge attempt, merge conflict state, and merge-gate status. Authenticated QA showed PR #5, #7, #8, #11, #12, #13, and production PR #17 merged for `houstongolden/houstongolden-you-md`; Codex in-app Browser expanded the account-pane `update history` rows for PR #12 and PR #13. PR #13 verified the explicit persisted rows for `check merge conflict state` and `check GitHub merge gate`; production PR #17 independently verified publish, PR merge, mirror refresh, and the GitHub chrome returning to `SYNCED / REPO MIRROR CURRENT / JUST NOW`. The forced 409 regression in `convex/githubAgentSync.test.ts` verifies stale branch deletion, fresh default-head resolution, branch recreation, merge retry, `branchRecreated: true`, and conflict timeline rows.
5. Add persisted Convex portfolio graph records instead of static-local data only. **DONE first verified slice + corrected hydration proof + repo snapshot export + strategy enrichment + reusable pattern mining:** `portfolioProjects`, `portfolioApiSurfaces`, `portfolioDependencyEdges`, `portfolioReusablePatterns`, `portfolioProjectActivities`, `brainDumpCaptures`, and `portfolioTasks` tables plus owner-gated `portfolio.*` queries/mutations. The first 4-project dashboard seed proof was insufficient; follow-up added `portfolio.syncTrackedProjects`, `POST /api/v1/me/portfolio/projects/hydrate`, `youmd project portfolio-hydrate`, and MCP `hydrate_portfolio_graph`. The real run used `portfolio-graph-auditor` against `/Users/houstongolden/Desktop/CODE_2025` plus authenticated 90-day GitHub `trackedProjects`: 268 project/package candidates found, 129 recent local candidates scanned, 30 local projects upserted, 40 GitHub tracked projects considered, 36 rows created / 4 updated on the initial corrective run, and final deployed reruns refreshed 40 tracked rows + 30 local rows without duplicates. Authenticated local browser QA verified `55 PROJECTS`, `CONVEX PERSISTED GRAPH`, `40 recent GitHub-tracked projects nearby`, shipped chips, the shipping timeline, and high-signal ordering with `bamfsite`, `youmd`, `fantasyis`, and `bigbounce` first. Follow-up repo export now pushes `projects/_portfolio/README.md`, `projects/_portfolio/graph.md`, and mirror-safe `projects/_portfolio/graph.json`; authenticated Codex Browser QA merged PR #15, verified all three paths in the pushed list, and refreshed the mirror to 53 files. Follow-up strategy enrichment now hydrates `30` active projects from README plus `project-context` PRD/overview/tasks/design/research/ideas files, filtered setup/PRD-title boilerplate to zero known matches, and authenticated Codex Browser QA verified `STRATEGY INTELLIGENCE` for `bamfsite` with BAMF OS API/MCP context. Follow-up scanner-derived pattern mining now persists `8` mined pattern families from `30` active projects / `8240` signal files into `portfolioReusablePatterns`, with authenticated API proof showing `11` total patterns and authenticated browser proof of `REUSABLE PATTERNS` usage/source evidence.
6. Add project-scoped portfolio slices to local MCP `get_project_context`. **DONE locally:** local MCP now includes `portfolioGraph` slices with matched project, owned surfaces, dependency edges, dependent surfaces, reusable patterns, skill propagation, commands, and guardrails.
7. Add `PROJECTS => Tasks` with personal/uncategorized tasks and project-associated tasks. **DONE deployed richer-task slice:** `portfolioTasks.projectSlug` is optional, so uncategorized/personal tasks and project tasks share one table; authenticated Chrome shell-chat QA saved a personal task through `/task me personal: ...`, displayed it as `HUMAN / PERSONAL`, wrote `projects/_personal/tasks.md`, and synced PR #8. Follow-up added `TASK TRIAGE` controls in the Portfolio Graph pane plus `portfolio.updateTaskTriage`, `POST /api/v1/me/portfolio/tasks/triage`, and MCP `update_portfolio_task`. Authenticated local browser QA moved a no-sync QA task to urgent, then in-progress, then done; API/local-agent proof triaged a no-sync task to `done / urgent` without attempting repo sync. Follow-up now adds `portfolio.updateTaskDetails`, `POST /api/v1/me/portfolio/tasks/update`, `youmd project task update <task-id>`, expanded MCP `update_portfolio_task`, dashboard owner/project quick-routing controls, due/tag visibility, and CLI task id printing. Focused Convex proof covers partial edits, title/detail/owner/project/status/priority/due/tags, clear-to-personal behavior, completion timestamps, and owner isolation. Production proof passed after deploy: pre-deploy live CLI returned `HTTP 404`, Convex Deploy run `27692450980` passed, post-deploy CLI updates published bundles v116/v119, repo-backed snapshot sync merged PR #16 with `projects/youmd/tasks.md`, and authenticated production dashboard QA routed task `rx795skqcg5xjenrra3qdw39fs88vcbf` from `OPEN / LOW / AGENT / YOUMD` to `IN_PROGRESS / HIGH / HUMAN / HOUSTON / PERSONAL`, then marked it done.
8. Add task owner separation: Houston/human versus agents. **DONE verified web slice:** `portfolioTasks.ownerType` is `human` or `agent` with optional `ownerLabel`; authenticated QA proved both agent-owned brain-dump tasks and a human-owned personal task.
9. Add a cross-project synced brain-dump-to-tasks skill/workflow. **DONE shared-skill + web + CLI/local-agent invocation slice:** canonical shared `braindump-task-router` preserves raw dumps, summarizes insights, routes to projects, separates human/agent tasks, and points writes at You.md `brainDumpCaptures` + `portfolioTasks`; shared mirrors are synced into Claude/Codex/Cursor/Pi. Authenticated Chrome shell-chat QA saved a `/braindump project:youmd ...` capture, displayed it under `RECENT BRAIN DUMPS`, wrote `projects/_braindumps/recent.md`, proposed agent tasks, and synced PR #7. Authenticated CLI/API proof saved a second `project:youmd` brain dump, wrote `projects/_braindumps/recent.md`, published bundle v102, merged PR #10, refreshed the mirror, and authenticated browser QA verified the row in the Portfolio Graph pane. **PENDING:** mobile/watch invocation proof.
10. Expand project intelligence fields for founder focus: goals, vision, pain points, solution, positioning, audience, north star, metrics, constraints, not-building list, and competitors. **DONE verified local-agent slice:** fields exist on `portfolioProjects`, `youmd project portfolio-hydrate` now synthesizes them from local docs and recent activity, `POST /api/v1/me/portfolio/projects/hydrate` persists them, MCP `upsert_portfolio_project` can write them, and the Portfolio Graph pane renders `STRATEGY INTELLIGENCE` for the selected project. Verified persisted graph: `55` projects, `30` enriched records, zero known setup/PRD-title snippet matches, screenshot `/tmp/youmd-portfolio-strategy-section-2026-06-17-v4.png`.
11. Analyze recent GitHub/local activity from the last 90 days and make it visible in the project intelligence layer. **DONE authenticated dashboard + local hydration proof:** Chrome opened `/shell?integration=github`, clicked `refresh active projects`, waited through the analyzer, and verified 38 visible `repo: houstongolden/...` project rows with repo, dir, stack, API/MCP docs, goal, and recent progress fields. The new local hydrator now reads README/project-context files plus recent commits/PRs, stores `portfolioProjectActivities`, and renders shipped chips plus a shipping timeline in the Portfolio Graph pane.
12. Verify via authenticated local CLI shell + authenticated Chrome/web testing, not smoke tests only. **PARTIAL DONE:** `get_project_context` local MCP smoke proved project-scoped `portfolioGraph` for `youmd`; authenticated Chrome clicked `[ update ]` and observed `SYNCING` -> `SYNCED / REPO MIRROR CURRENT / JUST NOW` with the merged PR transcript; authenticated Chrome verified the Portfolio Graph pane loading persisted Convex records, then follow-up CLI/local hydration proved the graph from real project activity rather than only seed data: `youmd project portfolio-audit` found 268 candidates / 97 providers, `youmd project portfolio-hydrate` scanned 129 recent local candidates, upserted 30 local projects, considered 40 GitHub tracked projects, and authenticated shell QA verified `55 PROJECTS`; authenticated visual QA then verified shipped chips, high-signal ordering, and the scrolled shipping timeline with screenshots at `/tmp/youmd-portfolio-activity-proof-2026-06-17-v2.png` and `/tmp/youmd-portfolio-timeline-proof-2026-06-17-v3.png`; authenticated Chrome verified the 90-day GitHub project analyzer/dashboard catalog; authenticated Chrome verified shell-chat-initiated `/braindump` and `/task` writes that queued repo sync, pushed `you.md`/`you.json` through PRs #7/#8, merged them, refreshed 47 mirror files, and returned GitHub chrome to `SYNCED / REPO MIRROR CURRENT / JUST NOW`. Authenticated CLI QA then saved a project-scoped task through `youmd project task`, wrote `projects/youmd/tasks.md`, published bundle v100, merged PR #9, and saved a project-scoped brain dump through `youmd project braindump`, wrote `projects/_braindumps/recent.md`, published bundle v102, merged PR #10, refreshed 50 mirror files, and authenticated browser QA verified both rows. Follow-up authenticated browser QA verified `TASK TRIAGE` controls and status/priority updates with screenshot `/tmp/youmd-task-triage-controls-2026-06-17.png`; API/local-agent proof verified `/api/v1/me/portfolio/tasks/triage` with `repoSync.attempted=false`. Built MCP registry proof confirmed `upsert_portfolio_task`, `update_portfolio_task`, `record_brain_dump`, and `hydrate_portfolio_graph` exist. Fresh Codex in-app Browser QA then clicked the real local `[ update ]` button from an authenticated shell, observed `syncing` -> `synced / repo mirror current / just now`, streamed `published v108`, pushed identity/task/brain-dump snapshot files, merged PR #11, refreshed 50 mirrored files, and saved screenshot `/tmp/youmd-shell-update-proof-2026-06-17-pr11.png`; `gh pr view 11` independently verified `MERGED` at `2026-06-17T09:43:00Z`. Follow-up persisted-history QA deployed Convex, clicked `[ update ]` again, observed `synced / repo mirror current / just now`, merged PR #12, expanded the new account/GitHub `update history` row, and verified persisted `published v109`, pushed file list, `open PR #12`, commit `021870e5a1f0`, and start/publish/push/mirror steps; screenshot `/tmp/youmd-update-history-proof-2026-06-17-pr12.png`. Follow-up timeline QA deployed Convex again, clicked `[ update ]`, streamed and persisted default-head, branch-commit, PR-open, squash-merge-attempt, conflict-state, merge-gate, and mirror rows, merged PR #13 with commit `ceaf1771eca3`, and saved screenshots `/tmp/youmd-update-history-timeline-proof-2026-06-17-pr13.png` and `/tmp/youmd-update-history-timeline-detail-proof-2026-06-17-pr13.png`. Forced conflict regression QA covers the 409 branch-recreation path with `convex/githubAgentSync.test.ts`. Follow-up graph snapshot QA deployed Convex, clicked `[ update ]`, merged PR #15, pushed `projects/_portfolio/README.md`, `projects/_portfolio/graph.md`, and compact `projects/_portfolio/graph.json`, refreshed the mirror to 53 files, and saved screenshot `/tmp/youmd-portfolio-repo-snapshot-proof-2026-06-17-pr15.png`; GitHub shows `graph.json` at 114299 bytes, below the mirror cap. Follow-up strategy enrichment verified `30` enriched records and screenshot `/tmp/youmd-portfolio-strategy-section-2026-06-17-v4.png`. Follow-up scanner-derived reusable pattern mining verified `8` mined families, `11` persisted patterns, no `_generated` evidence paths, and screenshot `/tmp/youmd-reusable-patterns-scanner-proof-2026-06-17-v2.png`. Production signed-in QA then verified deployed `/shell` on `https://www.you.md`: Portfolio Graph rendered `55 PROJECTS` and `CONVEX PERSISTED GRAPH`, task `rx795skqcg5xjenrra3qdw39fs88vcbf` routed through the live dashboard and was marked done, production sidebar toggled `56px -> 244px -> 56px`, `[ update ]` published v124, merged PR #17, refreshed 53 files, and returned the GitHub chrome to `JUST NOW`; screenshots live under `/tmp/youmd-production-*2026-06-17.png`. Follow-up bounded clean-root proof cloned `youmd` and `agent-shared` from the graph-backed plan, synced a secret-safe machine proof row, classified the Convex non-interactive setup blocker, and authenticated local `/shell` rendered the synced row; screenshot `/tmp/youmd-local-machine-clean-host-proof-2026-06-17.png`. **PENDING:** mobile/watch adapter proof and full actual new-host/env-vault proof.
13. Verify strategy enrichment through the actual local-agent hydrate and authenticated browser path. **DONE verified:** compiled `youmd project portfolio-hydrate --root /Users/houstongolden/Desktop/CODE_2025 --days 90 --limit 80` refreshed `40` tracked rows and `30` local rows, authenticated API proof showed `55` persisted projects, `30` enriched strategy records, `5` tasks, and zero known setup/build/PRD-title snippet matches, and signed-in Codex in-app Browser QA screenshot-verified the Portfolio Graph `STRATEGY INTELLIGENCE` block for `bamfsite` with private BAMF OS API/MCP context at `/tmp/youmd-portfolio-strategy-section-2026-06-17-v4.png`.

### 134. Make You.md resident daemon first-class and safe enough for always-on sync
**Status:** IN PROGRESS (resident runtime foundation and local dashboard readiness surface implemented; deeper stack/API persistence still pending)
**Verified:** PARTIAL (CLI build, daemon install/status, global CLI refresh, daemon-safe identity sync, context-sync dry-run, script syntax checks, LaunchAgent kickstart, exact `youmd machine verify`, production build, and authenticated local Machine pane visual QA passed)
**Production Verified:** PARTIAL (`www.you.md/shell?tab=apis` is signed-in verified with `CONVEX PERSISTED ACCOUNT NOTES`, `refresh account seed`, no raw `sk-*` secret pattern, and screenshot `/tmp/youmd-production-api-env-provider-accounts-proof-2026-06-17.png`; full cost tracking and vault reveal/copy remain pending)
**Source:** 2026-06-17 — Houston: "continue looping through all given everything ive asked for... 100% close the entire main gap... daemon needs to just work to always keep EVERYTHING in you.md in sync always also without slowing down a users machine too much..."
**Actionable Scope:**
1. Make curl install optionally enable resident sync without surprising users. **DONE locally:** `YOUMD_INSTALL_DAEMON=1` enables `youmd stack daemon install`; normal install prints the command.
2. Add daemon health visibility. **DONE locally:** `youmd status` and `youmd stack daemon status` show identity, skillstack, and project-context daemon loaded state, intervals, last activity, and current warnings.
3. Add project-context sync as a third safe LaunchAgent. **DONE locally:** `com.youmd.context-sync` runs `youmd stack context-sync` every 15 minutes.
4. Fix identity daemon's repeated size-regression blocker. **DONE locally:** identity LaunchAgent now runs `youmd sync --daemon`; daemon mode refreshes local files/skills and skips unsafe lossy pushes instead of forcing over richer server data.
5. Avoid slowing machines down. **DONE locally:** daemon remains interval-based, not a hot file watcher; context sync runs every 15 minutes.
6. Prevent project-context sync from touching app code. **DONE locally after first-run finding:** `context-sync.sh` now fetches first and refuses pull/push when upstream contains non-context paths.
7. Verify the global installed binary matches the repo build so launchd can run the new flags. **DONE locally:** installed local `youmd-0.8.2.tgz` globally and verified `youmd sync --daemon`.
8. Broaden daemon coverage toward personal stacks, APIs, PROJECTS data, MCP readiness, and dashboard readiness. **PARTIAL DONE:** current local foundation covers identity/private context, installed skills, shared skills/stacks, project-context files, MCP config visibility, daemon health, and the signed-in Machine readiness pane. **PENDING:** richer persisted stack/API/project graph sync still needs backend/dashboard work.
**Progress (2026-06-17):** Added shared daemon metadata/health helpers, a third project-context LaunchAgent, daemon-safe identity sync, resident status in `youmd status`, opt-in curl install daemon activation, docs updates, and a safer context-sync upstream gate. Installed all three LaunchAgents locally and refreshed the global CLI to the built `0.8.2` tarball. `youmd sync --daemon` completes cleanly and preserves the richer remote draft instead of force-pushing a smaller compiled bundle. `youmd stack daemon status` now shows all three daemons loaded with recent activity and no current identity warning after kickstart. First context daemon run surfaced and partially exercised the safety model: it pushed a context merge in `bamfaiapp`, made local context commits in `bigbounce`, `myo`, `hubifycode`, and `badapp`, and skipped pull/push where WIP code existed; the script was then hardened to refuse future remote app-code merges.
**Progress (2026-06-17 dashboard follow-up):** Added the signed-in Machine readiness pane and localhost-only API route. Authenticated browser proof shows daemon status, blocked guards, MCP config readiness, project-context/project clone readiness, shared skill mirrors, local auth, env-vault tooling, and `secret values exposed: false` in one surface; exact shell commands `youmd machine verify --root /Users/houstongolden/Desktop/CODE_2025` and `youmd stack daemon status` now pass from the refreshed global CLI.

### 133. Make local skill/MCP/dashboard sync proof actually verifiable
**Status:** IN PROGRESS (local CLI/MCP/shared-skill/web proof completed; production and Codex in-app browser attach still pending)
**Verified:** PARTIAL (local stdio MCP smoke, shared skill mirror check, local You.md skill cache check, signed-in Chrome visual QA, focused CLI tests, lint/radius, and production build passed)
**Production Verified:** NO
**Source:** 2026-06-17 — Houston: "that final screenshot looks bad there's a bright orange rectangle that is very hard to read and i am not seeing any recent syncing of the portfolio graph auditor and any of these other key local skill sync and meta skill syncing and cross project tracking..."
**Actionable Scope:**
1. Fix the unreadable `/skills` orange visual regression. **DONE locally:** replaced the accidental solid orange slab with a dark low-opacity gradient and verified screenshot `/tmp/youmd-skills-pane-sync-proof-2026-06-17-v2.png`.
2. Show current local/meta skill sync proof in the web UI. **DONE locally:** `/skills` now shows `7/10 skills synced`, `portfolio-graph-auditor`, `meta-improve`, `proactive-context-fill`, and `get_agent_brief + portfolio graph`.
3. Refresh key installed skill records so the dashboard is not relying on stale install data. **DONE locally:** `portfolio-graph-auditor`, `meta-improve`, and `proactive-context-fill` install commands refreshed remote state; `youmd skill sync` reports 7 synced skills.
4. Make local agents receive the portfolio graph at startup. **DONE locally:** `get_agent_brief` / `youmd://agent/brief` includes `portfolioGraph`; `youmd://portfolio/graph` is available as structured JSON.
5. Self-improve the shared skill rather than only changing app UI. **DONE locally:** canonical `.agent-shared/claude-skills/portfolio-graph-auditor` now requires MCP graph verification, was synced to Claude/Codex/Cursor/Pi, and was refreshed into `~/.youmd/skills`.
6. Verify through real local-agent paths. **DONE locally:** stdio MCP smoke verified brief/resource contents and no secret-like values; signed-in `/skills` visual QA verified the dashboard proof strip and tracked propagation.
7. Keep Lempod out of scope for this follow-up. **DONE:** deferred per Houston's instruction while he handles Lempod in `bamfsite`/`bamfaiapp`.
8. Verify in production and/or the Codex in-app browser once attach/auth is healthy. **PENDING:** Chrome fallback succeeded; Codex in-app Browser attach timed out on this run.

### 131. Add Project Portfolio Graph and reusable pattern intelligence
**Status:** IN PROGRESS (local dashboard/data/CLI/shared-skill/MCP foundation shipped, persisted graph hydrated from real active projects, active-project strategy enrichment verified, scanner-derived reusable pattern mining verified, bounded clean-root proof verified, and local + production signed-in visual QA passed; full new-host/env-vault proof, mobile/watch adapters, and pattern-quality curation pending)
**Verified:** PARTIAL (local TypeScript, CLI build, focused shared-skill source tests, portfolio audit smoke, env-key audit, shared skill mirror check, local stdio MCP smoke, production build, self-improvement CLI review, local skill install/sync, real active-project hydration through `portfolio-graph-auditor` + authenticated GitHub `trackedProjects`, active strategy enrichment hydrate/API/browser proof, signed-in local visual QA, and authenticated production `/shell` Portfolio Graph/task/sidebar/update proof passed)
**Production Verified:** PARTIAL (signed-in production `/shell` verified Portfolio Graph `55 PROJECTS`, `CONVEX PERSISTED GRAPH`, `40 recent GitHub-tracked projects nearby`, `TASK TRIAGE`, `REUSABLE PATTERNS`, dashboard task routing, sidebar toggle, and production `[ update ]` PR #17; production API read-back verified the bounded clean-root machine proof row; full new-host/env-vault proof, mobile/watch capture adapters, and deeper pattern-quality curation still pending)
**Source:** 2026-06-17 — Houston: "we need to have a page/view in our you.md app dashboard dedicated to showing an organized display of all of our APIS/MCPS their associated projects... dependencies... code-reusability and ui-ux-reusability... project / api ecosystem... standard repeatable decisions... protected agentic harnesses vs installable stacks... Lempod management across bamfsite and bamfaiapp..."
**Actionable Scope:**
1. Explain how You.md currently saves and organizes Projects. **DONE in docs:** identity bundle `projects`, generated `projects/<slug>/` markdown packs, repo/global project-context overlays, GitHub `trackedProjects`, repo mirror, DSI components, and Loop Report snapshots are documented.
2. Preserve the strategic product direction in a dedicated memo. **DONE:** `project-context/PROJECT_PORTFOLIO_GRAPH_AND_REUSE_PRD_2026-06-17.md`.
3. Preserve a sanitized prompt capture for the realization. **DONE:** `project-context/prompts/2026-06-17-project-portfolio-graph-reuse-dependency-routing.md`.
4. Add Project records that carry detailed and summarized AI descriptions, high-level goal, current focus, PRD/tasks/design/research/ideas/changelog/current-state/agent-doc paths, repo/local/docs/API/MCP URLs, stack, environment, and fresh-machine setup metadata. **DONE verified strategy slice:** persisted `portfolioProjects` records exist, hydrate the dashboard, and now receive synthesized strategy fields from README plus `project-context` PRD/overview/tasks/design/research/ideas files through the real local hydrate path.
5. Add API/MCP surface records with owning project, owning stack, docs, auth mode, integration type, write policy, risk tier, features powered, failure impact, and duplicate-risk warnings. **DONE Convex first slice:** persisted `portfolioApiSurfaces` records exist and hydrate the dashboard; richer per-project audit remains pending.
6. Add dependency edges that label who depends on whom: dependent, feature, optional, dev-only, admin, workspace, user-level, provides API to, consumes API from, shares stack, reuses code, reuses UI, owns public stack, owns protected harness. **DONE Convex first slice:** persisted `portfolioDependencyEdges` records exist and hydrate the dashboard; richer active-project audit remains pending.
7. Add a `/shell` Portfolio/Projects graph view that shows APIs/MCPs, associated projects, dependency direction, integration tiers, docs status, machine readiness, duplicate-risk warnings, and reusable patterns. **DONE locally and visually verified:** `PortfolioGraphPane`.
8. Track protected in-product agentic harnesses separately from public/installable skill stacks so proprietary product-agent IP is not exposed through public stack installs. **DONE local data/dashboard/docs; pending per-project audit.**
9. Add a cross-project reusable code/UI/architecture pattern catalog, tagged by tech stack and canonical/candidate/deprecated status. **DONE local data/dashboard/docs + scanner-derived records:** `youmd project portfolio-hydrate` mines code/UI/auth/layout/streaming/env/task/project-context patterns into `portfolioReusablePatterns`, with usage projects and source-path evidence visible in the Portfolio Graph pane.
10. Preserve Houston's reusable defaults: API/MCP/SkillStack-first architecture, standard role hierarchy, first-party passwordless auth preference, standard left sidebar/app shell, agentic split workspace, streaming response behavior, no loading spinners, and no boxes-within-boxes admin/docs surfaces. **DONE in docs; implementation pending.**
11. Add a bundled YouStack skill or CLI command that audits local projects, prompts, docs, APIs, MCPs, stacks, code patterns, and UI patterns, then proposes graph/reuse updates. **DONE first scanner slice:** shared `portfolio-graph-auditor`, bundled local CLI catalog visibility, `shared:` source install support, local `portfolio-graph-auditor` install/sync, `youmd project portfolio-audit`, and compiled `youmd project portfolio-hydrate` now mine/persist reusable patterns from active repo signals. Further work is quality curation and stronger canonical source selection, not the first persistence path.
12. Audit Lempod management across `bamfsite` and `bamfaiapp` before creating any duplicate Lempod API endpoint. **PENDING implementation.**
**Progress (2026-06-17):** Added the portfolio graph/reuse PRD and sanitized prompt capture, then shipped the first local implementation slice: `src/data/portfolioGraph.ts`, `/shell` Portfolio Graph pane, dashboard/sidebar/slash-command routing, Skills pane propagation visibility, shared + bundled-catalog `portfolio-graph-auditor`, and local `youmd project portfolio-audit`. Ran `youmd skill improve`, fixed the `shared:` source resolver it exposed, then installed and synced `portfolio-graph-auditor` into the local You.md skill bundle. The signed-in `/skills` dashboard now shows `7 installed`, `INSTALLED (7)`, `portfolio-graph-auditor` in the installed list, tracked propagation across `youmd`, `bamfaiapp`, and `bamfsite`, plus a readable local-agent sync proof strip. Local MCP `get_agent_brief` / `youmd://agent/brief` now includes the portfolio graph, and `youmd://portfolio/graph` exposes structured project/API/MCP ownership context. The canonical shared `portfolio-graph-auditor` skill now requires agents to verify that MCP path and was synced into Claude/Codex/Cursor/Pi plus the local You.md skill cache. Follow-up work added Convex-backed graph/task/brain-dump records, project-scoped `get_project_context` slices, API/CLI/MCP write paths for tasks and brain dumps, persisted repo-update history/timeline rows, and repo-backed markdown/JSON snapshots pushed as actual GitHub files. The corrected hydration pass now uses real project activity: `youmd project portfolio-audit --root /Users/houstongolden/Desktop/CODE_2025` found 268 project/package candidates and 97 providers; `youmd project portfolio-hydrate --root /Users/houstongolden/Desktop/CODE_2025 --days 90 --limit 80` scanned 129 recent local candidates, upserted 30 local projects, considered 40 authenticated GitHub tracked projects, created 36 rows, updated 4, and authenticated browser QA verified `55 PROJECTS` in the persisted Portfolio Graph pane. Follow-up strategy enrichment refreshed `40` tracked rows plus `30` local-audit rows, persisted `30` enriched strategy records, filtered setup/build/PRD-title boilerplate to zero known matches, and screenshot-verified `STRATEGY INTELLIGENCE` for `bamfsite` in the signed-in Codex browser. Follow-up reusable pattern mining refreshed `40` tracked rows plus `30` local-audit rows, mined `8` pattern families from `30` active projects / `8240` signal files, persisted `11` total reusable patterns, verified no `_generated` evidence paths in the sample, and screenshot-verified `REUSABLE PATTERNS` usage/source evidence in the signed-in Codex browser. Follow-up richer task editing added partial task detail updates through Convex, HTTP, CLI, MCP, and dashboard owner/project routing controls; `convex/portfolio.test.ts` verifies partial edits, clear-to-personal behavior, completion timestamps, and owner isolation. The authenticated CLI create path saved proof task `rx7cbe2gnrxy9pmemtfvwv6zhn88vkzn`; the new update command hit production and returned `HTTP 404` before deploy, confirming the remaining step is deploying the new Convex HTTP route, not local wiring. Verified local TypeScript, CLI build, focused shared-source tests, reusable-pattern scanner tests, portfolio audit smoke, env-key audit, shared mirror sync, compiled `youmd skill list` catalog visibility, stdio MCP smoke, Convex deploy, production build, signed-in local visual QA for Portfolio Graph, APIs + Env Intelligence, `/skills` tracked-project propagation, authenticated CLI task/brain-dump writes through merged PRs #9/#10, authenticated browser visibility of the CLI-created rows, persisted update-history PRs #12/#13, repo-backed portfolio snapshot PR #15, active-project strategy enrichment, scanner-derived reusable patterns, focused task-detail Convex regression, lint/radius, and CLI build. Production signed-in dashboard verification now also passed on `https://www.you.md/shell`: deployment `dpl_4DDQihfn488MFgJtMjUkomBFmyPZ`, Portfolio Graph `55 PROJECTS`, production task `rx795skqcg5xjenrra3qdw39fs88vcbf` routed and marked done, sidebar toggled, and production `[ update ]` merged PR #17 with the GitHub chrome returning to `JUST NOW`. Bounded clean-root proof also passed through the graph-backed setup path: `--max-clone-projects 2` cloned `youmd` and `agent-shared`, synced a machine proof row with `secretValuesExposed: false`, and authenticated local `/shell` rendered the classified Convex blocker. Remaining: mobile/watch capture adapters, full actual new-host/env-vault proof, and pattern-quality curation. Lempod ownership audit is deferred per Houston's current focus.

**Progress (2026-06-17 deployment correction):** The richer task-update route is no longer pending deploy. Convex Deploy run `27692450980` passed, post-deploy `youmd project task update rx7cbe2gnrxy9pmemtfvwv6zhn88vkzn ... --no-sync` published bundle v116, and the repo-backed sync retry merged PR #16 into `houstongolden/houstongolden-you-md` with a final `done` snapshot in `projects/youmd/tasks.md`. The first CI run timed out in a live public-profile integration test; the rerun passed with typecheck, lint, web build, CLI tests, and Convex tests.

**Progress (2026-06-17 authenticated dashboard proof):** Minted a real local web session and verified the Portfolio Graph pane in `/shell` from an authenticated browser. Created no-sync task `rx74n65a3t2e9ew1hqk76xxkn588vy84` through `youmd project task`, saw it render at the top of `TASK TRIAGE`, used dashboard controls to route it from `OPEN / LOW / AGENT / YOUMD` to `IN_PROGRESS / HIGH / HUMAN / HOUSTON / PERSONAL`, captured `/tmp/youmd-task-controls-pre-update-2026-06-17.png` and `/tmp/youmd-task-controls-post-update-2026-06-17.png`, then clicked `DONE` and verified the disposable task disappeared from active triage and the graph returned to `5` open items.

**Progress (2026-06-17 compact project details):** Added the compact Portfolio Graph browser Houston requested: search, focus filter, sort by activity/priority/shipped 90d/name, compact/expanded density, clickable URL-backed project detail state (`/shell?project=youmd`), shipped `today` / `7d` / `30d` / `90d` counters, selected-project links, API/MCP/stack surface docs URLs, curl commands, dependency snapshot, and persisted `focusStatus` / `focusRank` fields. Added owner-gated `portfolio.updateProjectFocus` plus Convex regression coverage for owner isolation and a UI timeout guard so backend deploy gaps do not leave a disabled dropdown. Local authenticated in-app Browser proof verified the visible search/detail URL/docs/curl/shipped pieces; the first focus-change attempt exposed that the remote Convex deploy ran from pre-push `main`, then post-push Convex deploy succeeded and the browser changed `youmd` to `focusing` and back to `top-priority` through the deployed mutation.
**Progress (2026-06-17 direct detail/shipped pulse follow-up):** Finished reload-safe direct project detail URLs: `/shell?project=youmd` now opens the Portfolio pane directly instead of landing on the default profile pane. Added a portfolio-level shipped pulse (`today`, `7d`, `30d`, `90d`), leader chips, row-level `details`/`timeline` deep links, row-level focus dropdowns, and founder-language focus labels (`Top Priority`, `Focusing`, `Freeze / On Ice`, `Abandoned`, `Dead / Killed`, `Unsorted`). Added `curlCommand` to persisted API/MCP/stack surfaces, preserved exact docs URLs/integration types during seed sync, and mirrored docs/curl/install fields into repo-backed portfolio graph snapshots. Verification passed focused Portfolio tests, TypeScript, lint/radius, production build, and authenticated Codex in-app Browser proof: direct `/shell?project=youmd` showed `SHIPPED PULSE`, project detail URL, You.md API docs/curl, YouStack install command, compact list controls, and a reversible row-level focus mutation for `bamfsite` (`focusing` -> `unset`). Screenshots: `/tmp/youmd-portfolio-shipped-deeplink-controls-2026-06-17.png` and `/tmp/youmd-portfolio-compact-list-controls-2026-06-17.png`.
**Progress (2026-06-17 graph-link detail follow-up):** Added tracked-project graph metadata to selected project details so the Portfolio pane now shows stack/stack slug, GitHub repo evidence, exact API/MCP docs URLs, the owner-gated portfolio graph curl command, docs curl commands, stack install command, and clone command even when a project does not own a first-class API surface yet. `details` / `timeline` controls now target anchored sections (`#project-detail` / `#timeline`) and scroll after selecting the project. `GET /api/v1/me/portfolio/graph` project rows now carry project-level `apiDocsUrl`, `mcpDocsUrl`, `stackSlug`, `repoName`, `directoryName`, and `curlCommand` fields for local agents. Authenticated Codex in-app Browser QA verified the You.md `PROJECT GRAPH LINKS` block, graph/docs curl commands, YouStack install command, clone command, owned API/MCP surfaces, and a real `View timeline for youmd` click scrolling to the shipping timeline.
**Progress (2026-06-17 shipped-board/focus polish):** Made the shipped activity much more obvious in the Portfolio Graph UI: the main card now says `Me + agents, shipped across the portfolio`, keeps `today` / `7d` / `30d` / `90d` totals, shows top shippers, and lists the latest shipped commit/PR/release titles. Selected project pages now show `latest shipped here` above links/docs/curls, compact rows label the shipped counters, and focus controls expose full ranked labels (`1 Top Priority`, `2 Focusing`, `3 Freeze / On Ice`, `0 Abandoned`, `0 Dead / Killed`, `4 Unsorted`) instead of cryptic short codes. Authenticated Codex in-app Browser QA verified the shipped board, latest shipped rows, graph docs/curl/install/clone block, real `View timeline for youmd` anchor scroll, and a reversible `bamfsite` focus mutation (`focusing / 2` -> `unset / 4`). Search/filter/sort controls were DOM-verified; direct typing into search was blocked by the in-app browser virtual clipboard helper, not by app code.
**Progress (2026-06-17 production anchor QA):** Production signed-in Browser QA confirmed `www.you.md` was already serving the shipped-board/focus polish and exact graph docs/curl/install/clone links. The pass caught a URL bug where clicking `View timeline for youmd` from `#project-detail` scrolled correctly but produced `#project-detail#timeline`; the Portfolio Graph selector now forces the target anchor with `window.history.replaceState` after router replacement. Post-deploy production Browser QA verifies the clean `https://www.you.md/shell?tab=portfolio&project=youmd#timeline` URL with the timeline in view; screenshot `/var/folders/4n/hqpz_03d477c1f_m2ks7x18c0000gn/T/youmd-production-clean-timeline-anchor-2026-06-17.png`.
**Progress (2026-06-17 post-push GitHub sync proof):** Re-ran authenticated local Codex in-app Browser proof on `/shell?project=youmd` after the direct-detail/shipped-pulse push. The GitHub chrome initially showed `SYNCED / REPO MIRROR CURRENT / 2H AGO`; clicking `[ update ]` switched it to `SYNCING / PUBLISHING, PUSHING, AND REFRESHING THE REPO MIRROR`, then the transcript completed publish -> GitHub PR -> merge -> mirror refresh. The run published `v126`, pushed the portfolio/task/brain-dump snapshots, opened and merged identity repo PR #18, checked that GitHub reported no merge conflict, refreshed 53 mirror files, and returned the chrome to `SYNCED / REPO MIRROR CURRENT / JUST NOW`. GitHub read-back confirms PR #18 merged at `2026-06-17T16:48:04Z`; screenshot `/tmp/youmd-local-github-sync-just-now-pr18-2026-06-17.jpg`.
**Progress (2026-06-17 shell-chat brain-dump proof):** Authenticated Codex in-app Browser proof found and fixed a real deterministic-command blocker: the opening greeting could leave `isThinking` true long enough that `/task`, `/braindump`, and fresh-machine requests were ignored before reaching their deterministic handlers. `sendMessage` now routes portfolio and fresh-machine commands before the generic thinking guard, while ordinary chat remains blocked during active thinking. After reload, the browser submitted `/braindump project:youmd ...` through the actual shell composer; the shell saved the raw brain dump, proposed one agent task, wrote `projects/_braindumps/recent.md`, published `v127`, queued repo sync from shell chat, merged identity repo PR #19, refreshed 53 mirror files, and returned GitHub chrome to `SYNCED / REPO MIRROR CURRENT / JUST NOW`. GitHub read-back confirmed `projects/_braindumps/recent.md` on `main` contains the `2026-06-17T1703Z` raw proof, `shell-chat-proof` tags, and proposed agent task. Verification passed TypeScript and visual proof screenshot `/tmp/youmd-shell-chat-braindump-sync-pr19-2026-06-17.jpg`.
**Progress (2026-06-17 web-shell task sync proof):** Authenticated Codex in-app Browser proof on local `/shell?tab=portfolio&project=youmd#project-detail` verified the exact Portfolio Graph UI Houston asked for in the latest prompt: 55 persisted projects, shipped pulse totals for `today` / `7d` / `30d` / `90d`, compact project rows, search/focus/sort controls, clickable `details` and `timeline` links, full ranked focus labels, and You.md `PROJECT GRAPH LINKS` with API docs, OpenAPI docs, MCP docs, graph curl, docs curl, stack install curl, and clone command. The same browser submitted `/task agent youmd: web shell portfolio sync proof 20260617T175421Z ... #shell-sync-proof #portfolio-task-proof` through the actual composer; the shell saved an agent-owned `youmd` task, wrote `projects/youmd/tasks.md`, published bundle `v129`, opened and merged identity PR #20, refreshed 53 mirrored files, and returned GitHub chrome to `SYNCED / REPO MIRROR CURRENT / JUST NOW`. GitHub read-back confirmed the exact task entry on `main` with `owner: agent (You Agent)`, `project: youmd`, and both proof tags. Screenshots: `/tmp/youmd-portfolio-detail-shipped-links-proof-2026-06-17.png` and `/tmp/youmd-shell-task-github-sync-proof-2026-06-17.png`.
**Progress (2026-06-17 visible Browser re-proof):** Re-verified the same compact portfolio/detail/shipped/focus request in the visible Codex in-app Browser after context resume. The live local persisted graph now shows `56` projects, shipped pulse totals for `today` / `7d` / `30d` / `90d`, top shippers, latest shipped rows, compact project search/focus/sort controls, clickable rows plus `details` / `timeline` anchors, full ranked focus labels, and the selected You.md `PROJECT GRAPH LINKS` block with exact API/MCP docs URLs, owner-gated graph/docs curl commands, You.md install command, and clone command. Browser QA changed `bamfsite` from `unset` to `focusing` and back to `unset / 4`, then clicked the You.md timeline link and verified the clean `http://localhost:3100/shell?tab=portfolio&project=youmd#timeline` URL with the shipping timeline in view. Screenshot: `/tmp/youmd-portfolio-detail-shipped-focus-verified-2026-06-17.png`.
**Progress (2026-06-17 exact-docs/curl refinement):** Re-tested the portfolio controls in the visible authenticated Codex Browser: detail/timeline links stayed clean, search narrowed to `2 / 56`, focus filtering narrowed to top priority, shipped-90 sorting stuck, and clicking the `bamfaiapp` project card selected `?project=bamfaiapp`. This pass caught a real precision gap where `bamfaiapp` could show generic You.md docs/curl fallbacks for stack/API surface rows. Fixed the Portfolio pane and owner-gated portfolio graph API with stack-aware YouStack/BAMFStack/BAMFOSStack docs and curl fallbacks; graph project rows now include focus status/rank, docs curl commands, stack install command, clone command, shipped `today` / `7d` / `30d` / `90d`, and bounded latest shipped rows for local agents. Final visual proof shows `bamf.ai/docs`, `bamf.ai/docs/api/posts`, `bamf.ai/docs/mcp/overview`, `curl -fsSL https://bamf.ai/bamfstack/install.sh | bash`, `git clone https://github.com/houstongolden/bamfaiapp bamfaiapp`, and BAMF API/MCP curl `https://api.bamf.ai/v1/agent/capabilities`. Screenshot: `/tmp/youmd-portfolio-bamf-exact-docs-surface-curl-final-2026-06-17.png`.
**Progress (2026-06-17 active/updated portfolio controls):** Added compact list `last updated` time-ago labels based on latest project activity/GitHub signal, a status filter (`all status`, `active`, `inactive/not active`), and one-click project status pills that flip `active` <-> `inactive` through a new owner-gated Convex mutation. The detail pane mirrors the same status/time signal. Manual status overrides persist as `statusSource: manual` and survive future GitHub hydration. The new-machine planner now consumes the same graph fields, so inactive or unfocused projects are excluded from setup by default. Browser QA on `http://localhost:3100/shell?tab=portfolio&project=bamfaiapp#timeline` verified the deep link, filters, `last updated` labels, setup policy hint, enabled status buttons, and deployed write persistence by filtering to `bamfaiapp-next` and toggling it from `active` to `inactive`.
**Progress (2026-06-17 fresh-machine prompt parity):** Tightened the actual web-shell `/new computer` prompt so the visible artifact matches the planner: only `ACTIVE` + `Top Priority`/`Focusing` projects are cloned by default, and inactive, unsorted, on-ice, abandoned, killed, and unreviewed GitHub-only repos are skipped unless deliberately changed in Portfolio or overridden for audit runs. Added CLI-side parity coverage that reads `src/hooks/useYouAgent.ts` and checks the web prompt for active-focus gating, env-vault strictness, 90-day expansion controls, and bootstrap scopes. Fixed `youmd machine prompt --root ~/Desktop/CODE_YOU` so shell-expanded `/Users/...` paths are converted back to `~/...` in the generated command and explanatory text before handoff to a different Mac. Authenticated local Browser QA submitted `/new computer`, verified the shell minted a 7-day bootstrap key, rendered one secret-bearing copyable command with a nearby `copy` button, included `CODE_YOU`, `YOUMD_REQUIRE_ENV_VAULT=1`, `YOUMD_EXPAND_TO_90_DAYS`, and showed no `.env.local=` / `sk-...` secret patterns. The actual full run on Houston's brand-new computer remains pending.
**Progress (2026-06-17 production exact-docs proof):** Re-ran the exact-docs verification on production `www.you.md` in an authenticated Codex in-app Browser session. `https://www.you.md/shell?tab=portfolio&project=bamfaiapp#project-detail` loaded the signed-in shell without a sign-in bounce, rendered `56` projects, selected `bamfaiapp`, showed shipped windows and GitHub chrome, and displayed BAMF-specific project graph docs/curls plus the BAMF API surface curl. Owner API read-back for `GET /api/v1/me/portfolio/graph?includeTasks=1` confirmed the same `bamfaiapp` graph fields and shipped counters. Screenshot: `/tmp/youmd-production-bamf-portfolio-graph-links-2026-06-17.png`.
**Progress (2026-06-17 local interaction re-proof):** Re-ran the compact project portfolio request against the visible local authenticated shell after resume. The browser proof verified `56` persisted projects, shipped `today` / `7d` / `30d` / `90d`, top shippers, latest shipped rows, typed search (`bamfaiapp` -> `2 / 56`), focus filter (`Top Priority` -> You.md), shipped-90 sort, clickable project rows, exact You.md `PROJECT GRAPH LINKS`, clean `#timeline` navigation, and a reversible `agent-shared` focus mutation (`unset -> on-ice / 3 -> unset / 4`). Screenshots: `/tmp/youmd-portfolio-56-projects-controls-proof-2026-06-17.png`, `/tmp/youmd-portfolio-youmd-detail-graph-links-proof-2026-06-17.png`, and `/tmp/youmd-portfolio-youmd-timeline-proof-2026-06-17.png`.
**Progress (2026-06-17 dense/detail polish follow-up):** Added a true `dense` Portfolio Graph scan mode, made row actions more explicit (`open detail` plus `timeline`), added selected-project action chips for `open detail`, `timeline`, `api docs`, and `mcp`, and replaced faint unlabeled graph/API/MCP command boxes with labeled readable command snippets for portfolio graph curl, docs curl, stack install, and repo clone commands. Also fixed local-agent CLI discovery so `youmd project task --help`, `youmd project braindump --help`, and `youmd project --help` return workflow-specific help. Verification passed CLI build/help smokes, root lint/radius with existing warnings only, production build, and authenticated Codex in-app Browser QA on the visible local shell. The browser proof confirmed `56 / 56`, shipped `today` / `7d` / `30d` / `90d`, search/focus/sort interactions, clickable You.md detail/timeline links, full ranked focus status options, exact docs/curl/install/clone commands, and no orange blocks. Screenshots: `/tmp/youmd-portfolio-latest-details-shipped-focus-proof-2026-06-17.png`, `/tmp/youmd-portfolio-project-detail-links-proof-2026-06-17.png`, `/tmp/youmd-portfolio-project-graph-command-block-proof-2026-06-17.png`.
**Progress (2026-06-17 deep-link reliability follow-up):** Fixed the shell-level stale-query bug found during visible Browser QA: after `/new computer` or another agent workflow switched the right pane away from Portfolio, the URL could still retain `?project=youmd`, making same-URL project detail navigation appear stuck on the wrong pane. Pane switches now update `?tab=...`, clear stale `project=` outside Portfolio, and query-backed pane sync re-runs on full query-string changes. Authenticated Codex in-app Browser proof verified direct `/shell?tab=portfolio&project=youmd#project-detail`, switch-away to `?tab=stacks`, switch-back to Portfolio (`56 / 56`), card click to `bamfaiapp`, search narrowing to `2 / 56`, shipped-90 sorting, exact API/MCP/stack/clone commands, clean `#timeline`, and no unreadable orange blocks. Screenshots: `/tmp/youmd-portfolio-clickable-detail-shipped-status-proof-2026-06-17.png`, `/tmp/youmd-portfolio-project-detail-api-mcp-curl-proof-2026-06-17.png`, and `/tmp/youmd-portfolio-command-block-scrolled-proof-2026-06-17.png`.
**Progress (2026-06-17 dedicated shell drill-in follow-up):** Converted Portfolio project details from an inline lower-page panel into a dedicated URL-backed drill-in state. `/shell?tab=portfolio` now stays compact and renders no `#project-detail`; `/shell?tab=portfolio&project=bamfaiapp` hides the portfolio-wide operating model, shipped pulse, dependency/pattern list, task triage, brain-dump, and skill-propagation sections, then shows project overview with `<< back to projects`, `overview`, `strategy`, and `timeline` breadcrumbs. The old `#project-detail` hash is normalized away, while direct `#timeline` links now wait for graph hydration and scroll the nested shell pane until the shipping timeline is visible. Applied the same compact overview -> dedicated detail page pattern to YouStacks (`/shell?tab=stacks&stack=youstack`) and Skills (`/shell?tab=skills&skill=portfolio-graph-auditor`) with `<< back` breadcrumbs. Authenticated Codex in-app Browser QA verified project list/detail/back, clean `project=` clearing, hidden global sections on detail, direct timeline hash visibility, stack detail/back, skill detail/back, TypeScript, and lint/radius. Follow-up remains open for APIs/env provider/surface rows, task triage, and brain-dump records.
**Progress (2026-06-17 hard-route upgrade follow-up):** Tightened the drill-in implementation so the URL itself is now a dedicated page path, not a query-backed pseudo-page. Legacy URLs upgrade in place: `/shell?tab=portfolio&project=bamfaiapp#project-detail` -> `/shell/projects/bamfaiapp`, preserving only real section anchors such as `#strategy` and `#timeline`; `?stack=youstack` -> `/shell/stacks/youstack`; `?skill=portfolio-graph-auditor` -> `/shell/skills/portfolio-graph-auditor`. Authenticated Playwright QA used a temporary web session for the real owner, verified no legacy query/hash remained, proved the project detail page has no operating-model/list intro underneath it, confirmed route-backed `<< back to projects` plus overview/strategy/timeline links, and verified stack/skill legacy upgrades. Checks passed: `npm run lint`, `npx tsc --noEmit`, and `npm run build`. Screenshots: `/tmp/youmd-dedicated-project-route-proof-2026-06-17.png`, `/tmp/youmd-dedicated-skill-route-proof-2026-06-17.png`.
**Progress (2026-06-17 dedicated pathname correction):** Replaced the earlier query-param drill-ins with true shell sub-pages: `/shell/projects/bamfaiapp`, `/shell/projects/bamfaiapp#timeline`, `/shell/stacks/youstack`, and `/shell/skills/portfolio-graph-auditor`. `DashboardContent` now routes pathname drill-ins to the right pane on hard refresh, top-level shell tab switches return to `/shell?tab=...`, project rows/link buttons use the new paths, and the legacy `#project-detail` hash is only normalized for backwards compatibility. Authenticated Codex in-app Browser QA verified direct project route hydration, project list click-through, breadcrumb back to `/shell?tab=portfolio`, direct timeline hash scroll, stack detail/back, and skill detail/back. Screenshot: `/tmp/youmd-shell-project-dedicated-route-proof-2026-06-17.png`.

### 132. Add APIs/env intelligence dashboard and secret-safe provider account mapping
**Status:** IN PROGRESS (local dashboard + CLI foundation + persisted provider account metadata shipped and locally visually verified; encrypted full-secret reveal/copy, cost tracking, and full cross-project scan persistence pending)
**Verified:** PARTIAL (local TypeScript, Convex typecheck, focused Convex provider-account regression, CLI build, portfolio audit smoke, env-key audit, production build, signed-in local visual QA, and browser provider-account refresh proof passed)
**Production Verified:** NO
**Source:** 2026-06-17 — Houston: "introduce another new ui surface for having a high-level view of all the apis your projects are using and some stats on which ones are being used the most across projects... encrypted way to see without revealing which api keys are being used for which platform... analyze all the projects' .env.locals... identify when the same api or service is being used even under different names... save some key details to that api/service account so i know what email or login method i used..."
**Actionable Scope:**
1. Add a `/shell` high-level APIs/env surface with provider usage, project counts, key-name variants, API/MCP risk tiers, service-account notes, and local audit commands. **DONE locally and visually verified:** `ApiEnvPane`.
2. Normalize env key names across conventions such as `NEXT_`, `NEXT_PUBLIC_`, `VITE_`, and raw server-side names. **DONE first CLI slice:** `normalizeKeyName` in `cli/src/lib/portfolio-audit.ts`.
3. Scan `.env.local` / `.env.*.local` without printing values. **DONE first CLI slice:** `portfolio-audit` parses names only by default.
4. Detect reused secret values without exposing values. **DONE first CLI slice:** optional `--fingerprints` uses local salted HMAC prefixes.
5. Store service-account metadata such as provider, login hint, billing owner, separation policy, and encrypted storage notes. **DONE first persisted slice:** owner-gated `portfolioProviderAccounts`, list/upsert/seed mutations, project-scoped `getProjectSlice.providerAccounts`, and dashboard seed/refresh UI are implemented and visually verified. Raw secrets are not stored or sent to the browser.
6. Integrate with the existing secure env backup/restore path from machine-sync/fresh-machine setup. **PARTIAL:** dashboard records now store vault/encrypted-storage notes and key-name aliases; full local vault reveal/copy remains pending and must stay opt-in.
7. Add monthly provider/project cost tracking. **PENDING.**
8. Add full cross-project scan for projects active in the last year. **PENDING full-root audit + persistence; command supports `--root`.**
**Progress (2026-06-17 provider-account persistence):** Added `portfolioProviderAccounts` to Convex, owner-gated list/upsert/seed mutations, provider accounts inside `getProjectSlice`, and a dashboard seed/refresh action in the APIs + Env Intelligence pane. The UI strips undefined optional fields before sending, wraps the mutation in a timeout so stale backend deploys do not leave `persisting...` forever, and renders `CONVEX PERSISTED ACCOUNT NOTES` once records exist. Verified with `npx convex dev --once`, focused Convex regression `persists provider account metadata without exposing secrets across owners`, TypeScript, lint/radius, production build, and authenticated Codex in-app Browser proof: `persisted 0 new / 4 refreshed provider account notes`, no raw `sk-*` secret pattern, screenshot `/tmp/youmd-api-env-provider-accounts-persisted-proof-2026-06-17.png`. Post-push production proof on `https://www.you.md/shell?tab=apis` verified the same persisted section and no raw secret pattern; screenshot `/tmp/youmd-production-api-env-provider-accounts-proof-2026-06-17.png`.

## 2026-06-16 — Preserve h.computer platform ideas in You.md

### 130. Finish cross-machine project, skill, stack, env, and computer sync for fresh Mac setup
**Status:** IN PROGRESS (local CLI/API/dashboard project-catalog slice complete; signed-in machine readiness, bounded clean-root proof, live sudo-free installer fix, and bounded env-vault restore proof verified; full actual new-host/env-vault run pending)
**Verified:** PARTIAL (local server, CLI build/tests, GitHub 90-day dry-run, Convex codegen, TypeScript, route smoke, signed-in Machine pane QA, bounded graph-backed clean-root clone/proof, live generated-command env-vault proof, and secret-leak scans passed)
**Production Verified:** PARTIAL (production graph/project proof and machine proof sync endpoints deployed; production API read-back confirmed synced proof rows; live `install.sh` user-prefix fallback verified; bounded generated-command env-vault proof synced a `READY` row; full actual new-host/env-vault run pending)
**Source:** 2026-06-16 — Houston: "restart server and help me finish the tasks etc required to really properly use you.md to manage my projects and global/local skils/stacks synced across machines/computers etc... verify you are able to identify my most recent active projects last 30-90 days and add those as projects if they dont already exist... for all tracked recent projects we need the name, url, repo link, repo/directory name, link to the api/mcp docs, name of the skills-stack associated with that project... ensure any skills that are redundant or already exist in my global local skills etc are properly synced and that we are DRY... ensure the secure .env.local share for these projects gets synced with the install command skill... run the command on my new machine and have my most recently active projects from the last 90 days setup in the new CODE_YOU directory on my Desktop... dashboard/shell a legit confirmation that shows my tracked and synced Computers and projects... tracking daily what progress we are making on projects and the high-level vision/goal..."
**Actionable Scope:**
1. Restart local server and verify it responds. **DONE:** `http://localhost:3100` is live.
2. Audit current You.md auth/bundle sync, GitHub auth, env-key coverage, and global/shared skill inventory. **DONE locally.**
3. Identify GitHub repositories active in the last 30-90 days from authenticated GitHub data. **DONE locally + dashboard verified:** `gh api /user/repos` found 41 repos pushed in the last 90 days; authenticated dashboard refresh displayed 38 GitHub project rows after the analyzer cap/filter.
4. Compare recent repos against You.md tracked projects and add/refresh missing project records. **DONE for CLI planner + Convex action path + authenticated dashboard refresh.**
5. Store required project metadata: name, site URL, repo link, repo/directory name, API/MCP docs link, associated skill-stack, recent activity, and high-level goal/progress. **DONE locally:** schema, GitHub analyzer, DSI signal, and dashboard project cards now carry these fields.
6. Keep global/local/project skills/stacks DRY by cataloging canonical ownership and redundant duplicate warnings, not copying the same skill into every project. **DONE audit:** canonical roots confirmed; duplicate warnings captured for cleanup.
7. Make secure `.env.local` transfer part of the fresh-machine flow through encrypted env backup/restore instructions and preflight checks; never print secrets. **DONE via canonical shared tooling + CLI guardrails:** machine-bootstrap points to `env-key-audit.py`, `env-secure-backup.sh`, `env-backup-interactive.command`, and `env-secure-restore.sh`; `youmd env backup --preflight` and `youmd env restore --list` now give the generated bootstrap a secret-safe readiness/list step before restore. Bounded live generated-command proof restored a fake encrypted `youmd/.env.local` while showing only variable names/counts and `secretValuesExposed: false`.
8. Make `CODE_YOU` the fresh-machine code root target and verify `youmd machine projects --root ~/Desktop/CODE_YOU --days 90` can set it up. **DONE locally:** compiled dry-run targets `/tmp/CODE_YOU` with cloneable repo-name directories.
9. Add a dashboard/shell confirmation surface for tracked/synced computers, projects, skills/stacks, and env readiness. **DONE first surface:** the signed-in Machine pane shows current/fresh roots, daemon status, MCP config, shared skills, env-vault tooling, latest proof report, and synced machine proof rows without exposing secret values.
10. Capture daily project progress and high-level project goals into You.md-visible project context/reporting. **PARTIAL:** GitHub analyzer now persists `highLevelGoal` and `recentProgress`; richer daily project report loop is a follow-up.
**Progress (2026-06-16):** Restarted the frontend dev server on `http://localhost:3100` and verified HTTP 200. `youmd status` shows auth as `@houstongolden`, local bundle `v14` in `~/.youmd`, remote draft ahead, and the globally installed CLI catalog still stale at 8 skills while source-built CLI has 9. `gh auth status` is authenticated to `houstongolden` with `repo`/`workflow` scopes. Env-key audit over `~/Desktop/CODE_2025` scanned 23 secret env files with no missing examples or missing keys. Skill inventory surfaced true duplicate implementation warnings for `gstack`, `open-gstack-browser`, and `hubify`, plus expected mirrored aliases across Claude/Codex/Cursor/Pi. The compiled `youmd machine projects --dry-run --no-clone --root /tmp/CODE_YOU --days 90` path found 41 GitHub repos pushed in the last 90 days, selected all 41 cloneable repo-name directories, tagged stacks such as YouStack/BAMFStack/BAMFOSStack/HubStack/SciStack/AstroStack, and skipped 5 broad duplicate You.md bundle records covered by recent repo data.
**Progress (2026-06-17 bounded proof):** The newer graph-backed path now supersedes the old local-only dry-run: production graph data reads `55` portfolio projects / `40` graph-tracked repos / `41` recent GitHub repos, and the capped live run cloned `youmd` plus `agent-shared` into `/tmp/youmd-clean-host-CODE_YOU-20260617T0714`. `youmd machine verify --write-report --sync-report` wrote/synced secret-safe proof metadata, authenticated local `/shell` rendered the clean-root synced row, and server probing classified the remaining blocker as non-interactive Convex first-run setup. Full actual new-host/env-vault setup remains pending.
**Progress (2026-06-17 env-vault guardrails):** Added CLI/web-shell parity for env-vault readiness in the generated bootstrap: `youmd env backup --preflight`, missing `YOUMD_ENV_VAULT` path failure, `youmd env restore --list` before restore, and docs/skill updates. Disposable encrypted backup/list/restore smoke passed with a fake `.env.local`; the output showed variable names/counts only and did not print fake values. Full actual new-host/env-vault setup remains pending.
**Progress (2026-06-17 live env-vault proof):** The live hosted installer initially failed under a generated-command run because npm could not write to `/usr/local`; `install.sh` now uses a user-writable `~/.youmd/npm-global` prefix without sudo when needed. The rerun with `YOUMD_MAX_CLONE_PROJECTS=2` and a disposable encrypted fake env vault completed, cloned `agent-shared` and `youmd` into `/tmp/youmd-fresh-env-vault-proof-20260617T153402Z/CODE_YOU`, restored `youmd/.env.local` without exposing the fake value, synced a `READY` proof row, and authenticated local `/shell` rendered it; screenshot `/tmp/youmd-machine-proof-env-vault-visual-2026-06-17.png`. Full actual new-host/env-vault setup remains pending.

### 129. Add You.md mobile brain-dump inbox, voice clone, Slack, and project routing direction
**Status:** IN PROGRESS (product context captured; implementation pending)
**Verified:** PARTIAL (docs/product-context validation passed; implementation pending)
**Production Verified:** NO
**Source:** 2026-06-16 Part 2 brain dump delegation: mobile Apple Watch/iPhone voice-to-text, SMS/iMessage, pasted transcripts, Sendblue-or-provider-agnostic capture, voice clone/ElevenLabs, Slack host adapter, project routing, and safe action boundaries.
**Actionable Scope:**
1. Preserve raw intent safely without private phone numbers, secrets, API keys, or provider credentials. **DONE:** `project-context/prompts/2026-06-16-mobile-capture-voice-slack-project-routing.md`.
2. Add a dated product memo for the mobile capture and routing direction. **DONE:** `project-context/MOBILE_CAPTURE_AND_PROJECT_ROUTING_2026-06-16.md`.
3. Keep You.md as the universal capture/memory/project-routing/personal API/MCP/YouStacks owner; BAD, Myo, h.computer, Hubify/BigBounce, Creator.new, BAMF.ai, Fantasy.is, and BAMF site are consumers. **DONE in docs.**
4. Capture Sendblue as an iMessage/SMS/RCS adapter candidate while keeping the gateway provider-agnostic. **DONE in docs; provider research pending.**
5. Define the raw-first processing pipeline: raw artifact, dedupe, segment, classify, memory extraction, task extraction, external-write proposals, and clarification queue. **DONE in docs.**
6. Add voice clone/ElevenLabs direction with consent, disclosure, labeling/watermarking decisions, action scopes, audit logs, and revocation. **DONE in docs; full safety spec pending.**
7. Add Slack host adapter direction with workspace/channel allowlists, identity labels, draft/send modes, action scopes, client/team safety controls, audit logs, and revocation. **DONE in docs; full adapter spec pending.**
8. Add a concise task list for provider research, data model, pipeline, routing UI, approval model, BAD handoff, Slack spec, and voice safety spec. **DONE in TODO/memo.**
9. Capture revocable voice/likeness grants as an explicit You.md permission boundary rather than ambient product behavior. **DONE in docs; schema decision pending.**
10. Preserve the "agent is you" / amplified-user framing and keep `y.computer` only as a future runtime naming note while leaving `h.computer` intact. **DONE in docs.**
11. Add one consolidated You.md handoff/status file for this lane. **DONE:** `project-context/voice-memo-part-2-youmd-handoff-2026-06-16.md`.
**Progress (2026-06-16):** Added the mobile capture memo and sanitized prompt capture, updated PRD/Architecture/Personal API/Connector/YouStacks product docs, added `captures`/mobile capture direction to scope planning, and tracked follow-up tasks for provider-agnostic gateway research, inbound transcript model, dedupe/segment/classify pipeline, project-routing UI, external-write approvals, BAD workout handoff, Slack host adapter, and voice clone/likeness safety spec. Validation passed `npm run docs:check`, `npm run agent-docs:lint`, `git diff --check`, and a focused phone/secret scan on the new capture files.
**Progress (2026-06-16 You.md lane follow-up):** Added `project-context/voice-memo-part-2-youmd-handoff-2026-06-16.md` so this lane has one truthful status table for the universal capture inbox, Sendblue/provider-agnostic gateway, raw transcript artifacts, dedupe/segmentation/routing, project task proposals, approval gates, ElevenLabs/custom voice safety, revocable voice/likeness grants, Slack host adapter, "agent is you" framing, `y.computer` naming note, and You.md API/MCP/YouStack ownership. Tightened `TODO.md`, `FEATURES.md`, and `CURRENT_STATE.md` so the next implementation slice and exact blocked decisions are explicit instead of buried across prior memos.

### 128. Add a You.md machine-bootstrap skill for new computer project sync
**Status:** IN PROGRESS (GitHub/portfolio graph hydration, hosted skill registry parity, bounded clean-root proof, live sudo-free installer fix, and bounded generated-command env-vault proof complete; actual uncapped new-machine/env-vault run pending)
**Verified:** PARTIAL (focused CLI tests/build/dry-run, bundled skill seed regression, live skill registry integration test, graph-backed clean-root clone/proof, live generated-command env-vault proof, secret-leak scans, and authenticated Machine pane visual proof passed; actual uncapped new-machine/env-vault run pending)
**Production Verified:** PARTIAL (production graph/proof APIs verified; hosted `/api/v1/skills` registry returns all 10 bundled/local-agent skills including `machine-bootstrap`; production `install.sh` user-prefix fallback verified; bounded generated-command env-vault proof synced a `READY` machine row; actual uncapped new-machine/env-vault run pending)
**Source:** 2026-06-16 — Houston: "I really want my you.MD to also have a skill... setting up a new computer, laptop... create a code project directory on this computer on your desktop... create subdirectories with matching names to the actual GitHub repo directory names... sync any other projects that have been active in the last maybe six months... start with the projects active within the last like 30 to 90 days... install all of my skills... same agent behaviors and preferences and skills and tools..."
**Actionable Scope:**
1. Add a bundled You.md skill for fresh-machine bootstrap across identity, agent skills, stacks, GitHub auth, and project repo setup. **DONE locally:** `machine-bootstrap`.
2. Add a CLI command agents can run on a new machine to create a Desktop code root and create/clone project directories from You.md project data. **DONE locally:** `youmd machine projects`.
3. Use GitHub repo names as local directory names when GitHub URLs are present. **DONE locally.**
4. Default to recent/active projects within a configurable 30-90 day window and ask before older projects. **DONE locally:** default 90 days, per-project prompt for older items in interactive mode.
5. Clone via `gh repo clone` when available/authenticated and fall back to `git clone`; skip non-empty directories. **DONE locally.**
6. Support dry-run and directory-only modes for safe agent execution. **DONE locally:** `--dry-run`, `--no-clone`.
7. Hydrate richer GitHub repo URLs/activity into the local You.md bundle/DSI project data so the command can clone exact repos from a brand-new machine without relying on local old-machine state. **DONE locally via authenticated GitHub scan + tracked-project metadata.**
8. Add a bounded clean-root proof mode so agents can test the setup lane without cloning every active repo. **DONE:** `--max-clone-projects` / `YOUMD_MAX_CLONE_PROJECTS`.
9. Reseed/deploy the hosted skill registry so `machine-bootstrap` appears from `/api/v1/skills`, not only the local CLI catalog. **DONE:** Convex deployed/reseeded and live registry returns all 10 bundled/local-agent skills.
**Progress (2026-06-16):** Added `cli/skills/machine-bootstrap.md`, catalog/recommended-skill wiring, a pure `machine-projects` planner with GitHub URL parsing, recency classification, dedupe, repo-name target directories, and the `youmd machine projects` CLI wrapper. The command reads the active local bundle, defaults to `~/Desktop/CODE_YOU`, prompts for older projects when interactive, supports `--root`, `--days`, `--yes`, `--dry-run`, and `--no-clone`, and clones with `gh repo clone` or `git clone` when repo URLs exist. Verification passed `cli npm test -- src/__tests__/machine-projects.test.ts`, `cli npm run build`, and dry-run project scaffolding.
**Progress (2026-06-16 follow-up):** Hydrated the fresh-machine planner from authenticated GitHub `/user/repos`, so the compiled dry-run found 41 repos pushed in the last 90 days, selected cloneable repo-name directories under `CODE_YOU`, tagged associated stacks, and skipped 5 broad duplicate bundle records. Tracked-project schema/DSI/dashboard output now carries repo URL, project URL, repo/directory name, API/MCP docs links, stack name, high-level goal, and recent progress.
**Progress (2026-06-17 bounded proof):** The machine-bootstrap path now also uses persisted Portfolio Graph records. A bounded live run with `--max-clone-projects 2` cloned `youmd` and `agent-shared`, synced the secret-safe machine proof, and showed the result in the Machine pane. The actual uncapped new-machine run remains pending.
**Progress (2026-06-17 hosted registry proof):** Added the missing hosted seed entries for `youstack-maintainer`, `machine-bootstrap`, and `portfolio-graph-auditor`, deployed Convex, ran `skills:seedBundledSkills`, and verified the live registry returns the exact 10-skill contract with `machine-bootstrap` full content available.
**Progress (2026-06-17 env-vault guardrails):** `machine-bootstrap` now teaches `youmd env backup --preflight` and `youmd env restore --list`; the CLI-generated and web-shell-generated one-command setup scripts both check env-vault tooling, fail early on missing vault paths, list vault contents without writing, then restore. Verification passed focused prompt tests, CLI build, disposable encrypted env-vault smoke with no fake value leakage, compiled prompt smoke, docs check, production build, and `git diff --check`.
**Progress (2026-06-17 live generated-command proof):** The live generated-command proof now exercises the real hosted installer and env-vault restore lane. First run failed on `/usr/local` npm `EACCES`, so `install.sh` was fixed to install under `~/.youmd/npm-global` without sudo when needed. The rerun with `YOUMD_MAX_CLONE_PROJECTS=2` and a disposable encrypted fake vault completed with status `0`, cloned `agent-shared` and `youmd`, restored `youmd/.env.local` without printing the fake secret value, synced a `READY` machine proof row, and authenticated `/shell` rendered it in the Machine pane; screenshot `/tmp/youmd-machine-proof-env-vault-visual-2026-06-17.png`.

### 127. Make fresh-machine curl install + browser auth + local agent sync feel seamless
**Status:** IN PROGRESS (curl/web/CLI handoff deployed; npm publish pending)
**Verified:** NO
**Production Verified:** NO
**Source:** 2026-06-16 — Houston: "login on my new mac mini in a new terminal session run the youmd curl command inside of a Codex or claude code session - login via the terminal fully syncing seamlessly ... says \"press ENTER\" to open you.md/auth in your browser ... confirmation page ... \"Nice work. You're now authenticated via you.md on web and your local agent. You may close this window/tab now.\" ... ASCII portrait animation ... click this link to open the web you.md/shell ... new user ... onboarding via the local agent / cli..."
**Actionable Scope:**
1. Preserve the raw prompt/context in project-context. **DONE:** `project-context/prompts/2026-06-16-local-agent-bootstrap-auth-confirmation.md`.
2. Provide a clean `/auth` browser URL for the terminal device-flow approval. **DONE locally.**
3. Make `youmd login` print the short code, wait for Enter, and then open `you.md/auth`. **DONE locally; CLI package bumped to 0.8.2.**
4. Show a branded browser success page confirming web + local agent authentication, with identity/ASCII portrait context and a link to `/shell`. **DONE locally.**
5. Update the curl installer next-step copy for fresh-machine login/pull/sync/`you`. **DONE locally.**
6. Make the curl installer source-install GitHub `main` by default, with npm fallback, so fresh machines get the current runtime before npm publish catches up. **DONE locally/deployed.**
7. Publish `youmd@0.8.2` to npm so direct `npm install -g youmd` matches the curl/source runtime. **PENDING OTP publish.**
8. Add a first-run `you` onboarding branch that detects fresh auth/no local bundle and walks through pull, sync, skills, stacks, and profile onboarding. **DONE locally.**
**Progress (2026-06-16):** Added `/auth` as an alias for the device approval page, hid global site nav on `/auth` and `/device`, built a portrait-aware success page, updated `youmd login` to use an Enter-to-open browser handoff, bumped/built CLI `0.8.2`, made the curl installer source-install GitHub `main` by default with npm fallback, updated installer next steps, and added focused CLI tests for approval URL normalization. Local verification: `cli npm run build`, `cli npm test -- src/__tests__/device-login.test.ts` (10 passing), root `npm run lint` (warnings only; radius OK), and root `npm run build` passed.
**Progress (2026-06-16 continue):** Added the first-run `you` post-bundle handoff. After login/pull/init creates a bundle, the CLI now prompts for Enter = sync + open U, `chat` = skip sync, `status` = inspect, or `quit` = stop. The sync path runs the normal `youmd sync` flow before handing into chat, so fresh machines hydrate identity state and installed skills before the user starts talking to U.

### 126. Clarify shell GitHub update chrome, Folder.md storage, and Usage surface
**Status:** IN PROGRESS (MVP UI/code complete locally; real update orchestration pending)
**Verified:** NO
**Production Verified:** NO
**Source:** 2026-06-16 — Houston: "houstongolden/houstongolden-you-md ... should be right aligned so it is next to the github icon ... github icon should show a little yellow/green/red/purple ... [ update ] ... detailed steps should just stream into the shell chat session ... Files ... library ... folder.md ... increased free storage up to 10GB ... Usage: You Agent Tokens, API/MCP calls..."
**Actionable Scope:**
1. Preserve the raw prompt in project-context. **DONE:** `project-context/prompts/2026-06-16-shell-github-update-usage-foldermd.md`.
2. Move the shell repo label out of the left side of the top chat chrome and into the right GitHub control area. **DONE locally.**
3. Hide the repo name until the GitHub control is hovered. **DONE locally.**
4. Replace the GitHub/refresh/publish/deploy icon cluster with a clearer solid GitHub control plus one small `[ update ]` button. **DONE locally.**
5. Use Convex repo mirror state to show GitHub-style status colors for synced, ahead/pending, behind/stale, disconnected/error, and loading. **DONE locally.**
6. Show compact last-sync/status text next to the GitHub mark. **DONE locally.**
7. Stream update steps into shell chat when `[ update ]` runs. **MVP DONE locally:** preflight transcript + existing publish path. **PENDING:** true PR/conflict/merge/update orchestration.
8. Add expandable update artifacts with full commit/PR message and history persistence. **PENDING.**
9. Add a Files/artifact/markdown/rich-file library backed by first-class persistence. **PARTIAL:** artifact workspace MVP exists via Files pane/custom files. **PENDING:** dedicated artifact tables/history.
10. Add folder.md connector copy for optional 10GB free storage via folder.md account/API key. **DONE locally.**
11. Add a custom Folder.md connector prompt for agents. **DONE locally.**
12. Add a Usage surface covering You Agent tokens, API/MCP calls, custom stacks/endpoints, crons/loops, crawlers, integrations, skills/workflows, BYOK/custom env, and connector apps. **MVP DONE locally in Connectors API/MCP tab.**
13. Link Settings -> Usage and add live counters/quotas. **PENDING.**
**Progress (2026-06-16):** Reworked the shell desktop top chrome around one hover-aware GitHub repo status control and one `[ update ]` action, using existing Convex GitHub connection/repo mirror signals. Added update preflight streaming into the chat. Expanded the Connectors API/MCP page with a Usage surface and upgraded folder.md to a storage/artifact connector with 10GB positioning and an agent prompt. Remaining: live Settings Usage page, real repo PR/conflict/merge orchestration, expandable update artifacts, and first-class artifact storage tables.

### 125. Add artifact workspace, daily Loop Reports, DSI components, and public profile chat
**Status:** IN PROGRESS (artifact workspace + Loop Reports foundation + private DSI weather/surf/GitHub/school/agenda/task/fitness/BAMF adapters + public profile conversation API/MCP + owner controls code complete locally)
**Verified:** PARTIAL (local tests/build/browser smoke passed; production verification pending)
**Production Verified:** NO
**Source:** 2026-06-16 — Houston: "we really do need a proper nice markdown/artifact viewer + editor basically an obsidian style way... daily tasks for me via a Cron Loop + skills+connect apps/mcps and crawlers... bring over all relevant features and work from [h.computer]... DSI catalog components... public you.md profiles... chat with that person..."
**Actionable Scope:**
1. Preserve Houston's full raw prompt in project-context. **DONE:** `project-context/prompts/2026-06-16-artifacts-daily-loops-dsi-public-chat.md`.
2. Break the request into a detailed plan with nothing missing. **DONE:** `project-context/ARTIFACTS_DAILY_LOOPS_DSI_PUBLIC_CHAT_PLAN_2026-06-16.md`.
3. Add a nicer in-app markdown/artifact viewer/editor, with Obsidian-style artifact/report organization. **MVP CODE COMPLETE:** Files pane now has `files`, `artifacts`, and `reports` modes plus report templates saved through `custom_files`; generated private Loop Report artifacts appear as read-only markdown under `reports/generated/*`; the Reports workspace includes owner controls for definitions, runs, artifacts, default seeding, manual daily runs, pause/resume, and source snapshot provenance drilldown.
4. Add daily Cron Loop reports for industry pulse, agenda, code carryover, connected-app pulse, fitness/body, and daily journal article. **FOUNDATION CODE COMPLETE:** added report definitions/runs/artifacts/source snapshots, owner CRUD/list/manual-run functions, hourly due-loop cron, deterministic daily briefing from You.md-owned data, visible shell controls, and owner-only snapshot inspection for report runs. **PENDING:** external adapters and LLM/journal compiler.
5. Port relevant h.computer source adapters into You.md-native connectors: school Google Doc crawler, tasks/calendar, historical daily log, weather, surf report, GitHub project/LOC/LOMB/recent updates, research/blog crawlers. **PARTIAL:** weather + Venice Breakwater surf, GitHub project catalog, school Google Doc logistics crawler, the first Google Calendar agenda adapter, the first private task queue adapter, the first Bad.app fitness/body adapter, and the first BAMF pulse adapter now refresh into private DSI components and source snapshots. GitHub catalog includes tracked projects, GitHub URLs, matched project URLs, recent commits, stars, AI insight, visibility, and h.computer-style LOC/LOMB/LOMB ratio from GitHub `/languages` estimates for the top tracked repos, with repo-mirror fallback where language metrics are unavailable. School logistics fetches the Google Doc `mobilebasic` source, extracts upcoming active-grade/school-wide dated items, and stores countdowns, event totals, next-event metadata, source lines, and parser provenance. Agenda ports h.computer's important-upcoming Google Calendar filter, supports native bearer-token or legacy connector-gateway auth, folds in private `calendarContext`, and persists an honest unconfigured state when no connector exists. Task Queue reads h.computer-compatible task arrays from private `customData`, normalizes status/priority/due/source/proposed metadata, computes open/overdue/proposed/urgent counts, and persists an honest unconfigured state when no task source exists. Bad.app fitness reads live REST with a `bad_sk` bearer key or private `customData.badapp`, normalizes State of You scores, health summaries, body scans, fitness tests, data quality, and source metadata, and persists an honest unconfigured state when no Bad.app source exists. BAMF Pulse reads BAMF OS/BAMF.ai REST with API keys or private `customData.bamf`, normalizes clients, creators, LinkedIn posts, agency counts, stack sync runs, and connected-app notes, and persists an honest unconfigured state when no BAMF source exists. **PENDING:** richer task create/edit flows and external task apps, historical daily log, daily journal, research/blog crawlers, richer BAMF/BAMF OS/LinkedIn/X/social range analytics, richer Bad.app historical/range analytics, LLM school extraction, and Google Calendar writeback.
6. Add connected-app report adapters for BAMF.ai/BAMF OS/BAMF site analytics/client updates, Bad.app/BAD Stack fitness and health, LinkedIn/X/social analytics, and other connected apps. **PARTIAL:** first Bad.app/BAD Stack fitness/body adapter now refreshes into private DSI from live REST or private customData and feeds daily briefing body signals; first BAMF/BAMF OS pulse adapter now refreshes into private DSI from live REST or private customData and feeds daily briefing connected-app pulse. **PENDING:** LinkedIn/X/social range analytics, other connected apps, richer BAMF/BAMF OS writeback/report analytics, and richer Bad.app historical/range report analytics.
7. Add persistent historical reports across day/week/month/quarter/6-month/year horizons, including agent accomplishments. **FOUNDATION CODE COMPLETE:** report runs/artifacts/source snapshots persist dated outputs and facts. **PENDING:** aggregate range views and richer accomplishment analytics.
8. Add DSI catalog components that can render privately in `/shell` and optionally on public profiles with owner approval. **PARTIAL CODE COMPLETE:** private `dsiComponents` substrate, Reports DSI Catalog panel, refresh controls, and markdown artifacts under `dsi/private/*` are implemented for weather, surf, GitHub projects, school logistics, agenda, task queue, Bad.app fitness, and BAMF pulse. **PENDING:** custom component editor/schema and owner-approved public profile rendering.
9. Add secure public profile chat widget above the fold on all public profiles. **FIRST SLICE DONE locally:** public profiles now render a compact public conversation box above the agent endpoint docs.
10. Add public conversation API/MCP endpoint so apps can connect to a user's public You.md brain and create custom "talk to this person" experiences. **API/MCP FIRST SLICE DONE locally:** `POST /api/v1/profiles/[username]/conversation` and hosted MCP `ask_public_profile` answer from public profile context only and return sources, public fields used, follow-ups, and omitted private context. **PENDING:** LLM-backed voice tuning and optional local MCP parity.
11. Add owner controls for personality/style/capabilities/public data used by profile chat. **CODE COMPLETE locally:** Share pane controls now save `preferences.public_chat` into public `youJson`, including enable/disable, concise/voice/consultive mode, public field allow-list, advertised capabilities, source-link return, and owner note. Public page widget, REST endpoint, and hosted MCP all honor those controls.
**Progress (2026-06-16):** Reviewed the relevant local h.computer journal/school/surf/weather/GitHub-project patterns and badapp API/MCP/widget patterns. Added the raw prompt capture and detailed plan. Upgraded the shell Files pane into an artifact workspace with `files`, `artifacts`, and `reports` tabs and staged markdown templates for daily briefing, project carryover, daily journal article, and public profile chat contract. Added the Loop Reports backend substrate: report definitions, immutable source snapshots, report runs, report artifacts, owner CRUD/list/manual-run functions, hourly due-loop cron, deterministic daily briefing compilation from You.md-owned signals, focused Convex tests, read-only generated report artifacts in Files, owner-visible Reports controls for seeding defaults/manual runs/pause-resume/recent runs/artifacts, and owner-only source snapshot drilldown with normalized facts, hashes, trust levels, and capture windows. Added the first secure public-profile conversation slice: an above-fold public chat widget plus `POST /api/v1/profiles/[username]/conversation`, with public `you.json`/`you.txt` source links, public field provenance, suggested follow-ups, and explicit omission of private memories, loop reports, connected-app data, source snapshots, logs, and scoped grants. Added hosted MCP parity through `ask_public_profile` and fixed generated docs to parse/count hosted MCP tools from the registry. Added the first DSI component substrate and h.computer adapter ports: Open-Meteo weather, Venice Breakwater surf, and GitHub Project Catalog refresh into private source-backed components, render in `/shell` Reports under a DSI Catalog panel, appear as read-only markdown artifacts under `dsi/private/*`, and get included in fresh Daily Briefing runs as a `dsi-components` snapshot. Local verification passed focused Convex tests, full TypeScript, lint, build, and authenticated browser QA; the browser refresh created `weather-home`, `surf-venice-breakwater`, and `github-project-catalog`, then a new daily run showed the DSI snapshot in the report source set. Follow-up GitHub Project Catalog enrichment now calls GitHub `/languages` for tracked repositories, computes h.computer-style LOC/LOMB/LOMB ratio from language byte totals, and falls back to repo-mirror metrics when language data is unavailable; authenticated browser QA showed `10 projects / 226 commits/90d / 1,272,721 LOC / 0 LOMB`. Follow-up school logistics work now ports the h.computer Google Doc crawler into a private `school-logistics` DSI component with source snapshot provenance, active-grade filtering, Mar Vista countdowns, upcoming event totals, next-event metadata, source lines, and a `/shell` Reports `refresh school` control. Follow-up agenda work now ports h.computer's important-upcoming Google Calendar filter into an `agenda-today` DSI component with native bearer-token / legacy connector-gateway auth, private `calendarContext`, unconfigured-state preservation, and a `/shell` Reports `refresh agenda` control. Follow-up task work now adds a `task-queue` DSI component from h.computer-compatible private `customData` arrays, with normalized statuses/priorities/due dates/source text/tags/proposed metadata, open/overdue/proposed/urgent counts, reusable prompts, source snapshots, unconfigured-state preservation, and a `/shell` Reports `refresh tasks` control. Follow-up Bad.app fitness work now adds a `badapp-fitness` DSI component with live Bad.app REST via `bad_sk` env key or private `customData.badapp` fallback, State of You/health summary/body scan/fitness test normalization, source snapshots, a `/shell` Reports `refresh bad.app` control, daily briefing body signal inclusion, and Bad.app pending-adapter suppression when refreshed. Follow-up BAMF pulse work now adds a `bamf-pulse` DSI component with BAMF OS/BAMF.ai REST via API key or private `customData.bamf` fallback, clients/creators/LinkedIn posts/agency counts/stack sync run normalization, source snapshots, a `/shell` Reports `refresh bamf` control, daily briefing connected-app pulse inclusion, and BAMF pending-adapter suppression when refreshed. Follow-up public-chat owner controls now let the owner manage enable/disable, style, public field allow-list, advertised capabilities, source links, and an owner note from the Share pane; REST and hosted MCP honor the same controls. Remaining: richer task create/edit flows and external task apps, richer BAMF/BAMF OS writeback/range analytics, LinkedIn/X/social analytics, richer Bad.app history/range analytics, research/blog crawlers, historical daily log, daily journal, public DSI publishing controls, LLM voice generation for public profile chat, range analytics, and production verification.

### 124. Make blank `/shell` chats open with a personal activity-aware briefing
**Status:** DONE (deployed; Houston visual approval still welcome)
**Verified:** NO
**Production Verified:** YES
**Source:** 2026-06-16 — Houston: "additinally the agent just shows \"repo\" at the top of the blank chat session in the shell ... but it should at least acknowledge you by your name and analyze any recent work/activity/updates tracked recently and maybe congratulate you on how many active projects and LOC you've shipped and any other milestones or content or context it has from you ... and also then suggest possible best next steps or things you can do or that they can help you with etc"
**Actionable Scope:**
1. Stop a one-word restored command like `repo` from becoming the only thing visible in a blank shell session. **DONE locally.**
2. Make New Chat start an uninitialized session so the opening greeting runs. **DONE locally.**
3. Build the opening greeting from real data only: display name, latest bundle version/status, tracked projects, private project folders, recent memories, recent saved sessions, and repo mirror status/files/bytes/sync timestamp. **DONE locally.**
4. Instruct the agent to greet by name, acknowledge concrete recent activity/milestones, avoid fake LOC claims, and suggest useful next moves. **DONE locally.**
5. Add a deterministic fallback brief so the shell transcript is still useful if the streamed model returns an overly short stub. **DONE locally.**
6. Deploy and verify in authenticated production `/shell`. **DONE.**
**Progress (2026-06-16):** Updated `src/hooks/useYouAgent.ts` with a deterministic opening session brief, recent sessions/repo mirror queries, New Chat reinitialization, and half-empty session restore skipping. Local `npm run lint`, `npm run build`, and `git diff --check` passed. Commit `38030f3` deployed to production; Vercel deployment `dpl_7ymFW6ToUkHZXMuTQRxnzfEhNpHU` reached Ready, GitHub CI `27595231656` passed, and authenticated production browser QA confirmed New Chat greets Houston by name, includes real bundle/project/repo-mirror context, suggests next moves, and is not empty/just `repo`.

### 123. Clean up `/shell` right detail pane responsiveness and usefulness
**Status:** IN PROGRESS (follow-up deployed; Houston visual approval pending)
**Verified:** NO
**Production Verified:** YES (agent-authenticated browser QA)
**Source:** 2026-06-16 — Houston: "yo look at the design please ensure it is properly responsive the right side panel should be really re-thought and cleaned up and ensure it is always fully responsive and actually intuitive, minimal, clean actionable and USEFUL please..."
**Actionable Scope:**
1. Rebalance desktop shell split so the right detail pane cannot collapse into an unusable clipped column while preserving a usable chat width. **DONE locally.**
2. Make narrow desktop/tablet use a full-width shell/preview toggle rather than cramped two-column split. **DONE locally.**
3. Replace the profile detail pane's full public-profile render with a compact actionable inspector. **DONE locally.**
4. Clean up right-pane navigation so labels are shorter, wrap cleanly, and do not clip horizontally. **DONE locally.**
5. Reduce nested boxes in the profile inspector so the pane feels more seamless and useful. **DONE locally.**
6. Verify responsive layout visually in an authenticated browser session after deploy. **DONE via agent QA; Houston visual approval pending.**
7. Remove the redundant right-pane local title/subtitle (`profile` / `overview`) because the active tab already communicates that state. **DONE locally.**
8. Reorder and rename tabs so the artifact rail is more intuitive: `profile`, `files`, `share`, `stacks`, `api`, `stats`, `portrait`, `account`. **DONE locally.**
9. Make medium-width shell layouts keep the app sidebar/top action chrome but use full-width shell/preview tabs instead of a cramped split. **DONE locally.**
10. Tighten profile inspector wrapping so long identity text, bios, projects, and links cannot clip horizontally. **DONE locally.**
**Progress (2026-06-16):** Updated shell split constants, shortened/wrapped right-pane header navigation, swapped `ProfileContent` for `ProfilePane`, and flattened the compact profile pane. Local `npm run lint`, `npm run build`, `npm run docs:check`, and `git diff --check` passed. Pushed commit `380c1ce`; Vercel deployment `dpl_Cwjg25ybGryr6ZYmCEjrtvEfLxGM` reached Ready and is aliased to `https://www.you.md` / `https://you.md`. Authenticated production browser QA confirmed no horizontal overflow, the compact profile inspector is mounted, and the 1600px split renders about 597px chat / 751px detail.
**Progress (2026-06-16 hotfix):** Houston flagged that the first responsive pass hid the whole desktop app shell at narrow desktop widths. Restored the shell sidebar/top action chrome/right detail split at `md` widths, kept the chat column width explicit, and added `min-w-0`/overflow containment so the right detail pane can shrink instead of pushing past the viewport. Pushed commits `4f1da05`, `3fe9511`, `fab0cad`, and `ffd8d17`; Vercel deployment `dpl_8ygDyGiGWCyz97F1ZQuG2WtJQQzH` reached Ready and is aliased to `https://www.you.md` / `https://you.md`. Authenticated production browser QA at 900px confirmed the sidebar, top actions, resize handle, and right pane render together with 56px rail / 460px chat / 8px handle / 376px detail, `rightEdge: 900`, and no horizontal overflow. Remaining: Houston visual approval.
**Progress (2026-06-16 follow-up):** Removed the redundant desktop pane label/subtitle block, converted the right artifact chrome into one scroll-safe primary tab rail plus a sub-tab rail only when needed, promoted `api` earlier in the tab order, renamed `face` to `portrait`, hid the right-pane toggle below `lg`, and moved split behavior to `lg`+ while retaining sidebar/top actions at `md`. Local authenticated in-app browser QA at ~890px confirmed the shell now uses a single full-width surface with top tabs instead of the cramped split. `npm run lint`, `npm run build`, `npm run docs:check`, and `git diff --check` passed. Vercel deployment `dpl_n4ZMQ6dv3vHwj2RimFBBwaTfkd4x` reached Ready and is aliased to `https://www.you.md` / `https://you.md`; GitHub CI `27595879145` passed. Authenticated production visual QA confirmed the duplicate pane title is gone and the medium-width shell has one clean tab rail plus a full-width shell surface. Remaining: Houston visual approval.

### 122. Save and route personal API / human context protocol / YouStacks ideas into You.md
**Status:** IN PROGRESS (docs/context captured; future product implementation pending)
**Verified:** NO
**Production Verified:** N/A (project-context/docs-only)
**Source:** 2026-06-16 — Houston: "sharing this for context again... before i remove all these other features/pages from h.computer... the best language from h.computer's newest platform/vision/human-computer-protocol/hstack-vision docs actually belongs in You.md first"
**Actionable Scope:**
1. Read You.md PRD, Architecture, YouStacks Product Layer PRD, OKF Integration, Current State, local h.computer vision/protocol docs, and Creator.new routing memo. **DONE.**
2. Preserve the raw prompt/context in `project-context/prompts/` with a 2026-06-16 dated note. **DONE.**
3. Update You.md docs so You.md owns the durable agent brain: identity, memory, preferences, private context, project context, sources, provenance, trust rules, public/private links, and protected API/MCP. **DONE in PRD/Architecture/Current State.**
4. Update docs so You.md is the intuitive personal API/MCP layer with scoped links, API keys, MCP, host adapters, connectors, crawlers, crons, monitors, and public/private modes. **DONE as product direction; implementation remains tracked under #115.**
5. Update YouStacks docs so stacks carry reusable skills, workflows, prompts, examples, tools, tests, docs, host adapters, update policies, improvement policies, and folder.md-style readable structure. **DONE in YouStacks Product Layer PRD.**
6. Preserve and adapt the strongest h.computer language as You.md-native messaging without copying raw docs verbatim. **DONE in PRD/Current State.**
7. Add a relationship section mapping You.md, h.computer, Creator.new, folder.md, BAMF.ai, and BAMF OS. **DONE in PRD/Architecture.**
8. Add or update roadmap for connector UX, crawlers/refresh jobs, context-link/MCP polish, YouStacks distribution, screen-recording/transcript/SOP-to-skill learning, host adapters, and BYOK/model routing as advanced capability. **DONE in PRD/TODO/Features.**
9. Update TODO, FEATURES, CHANGELOG, active requests, and PROMPTS. **DONE.**
10. Commit the docs/context changes as one coherent docs commit. **DONE in this docs commit.**
**Progress (2026-06-16):** Added `prompts/2026-06-16-youmd-personal-api-context-routing.md`; updated PRD, Architecture, YouStacks Product Layer PRD, Current State, TODO, Features, Changelog, active request tracking, and prompt archive. Local docs checks and whitespace guard passed. Remaining: Houston/user verification and implementation slices tracked under #115.

## 2026-06-15 — Rebuild `/shell` as Codex/Lovable-style workspace

### 121. Shell logo hover sidebar toggle and right-pane toggle placement
**Status:** IN PROGRESS (follow-up deployed; Houston visual approval pending)
**Verified:** NO
**Production Verified:** YES (authenticated production visual QA)
**Source:** 2026-06-15 — Houston: "these sidebar icons on the top left are not following instructions... hover on the YOU logo should subtly animate and switch to a 2-line side menu icon... the YOU needs to be a touch smaller... the other side panel icon... should be on the top right of the whole screen since it controls the top right pannel... use a cleaner more minimal side panel icon"
**Actionable Scope:**
1. Remove the separate top-left sidebar toggle icon beside the YOU logo.
2. Make the YOU logo smaller so it does not crop on the right edge.
3. Make the YOU logo itself the sidebar collapse/expand target.
4. On hover, subtly animate the YOU mark into a two-line side-menu glyph.
5. Move the right-pane toggle from the left of the chat-column top chrome to the top-right of the whole workspace chrome.
6. Replace the right-pane Lucide panel icon with a cleaner minimal side-panel glyph.
7. Shrink and reposition the collapsed rail's PixelYOU viewport so the `YOU` mark fits cleanly without clipping the final letter. **DONE locally.**
**Progress (2026-06-15):** Implemented locally in `src/app/(app)/dashboard/dashboard-content.tsx`: removed the separate left-panel button, added a smaller hover-animated PixelYOU/sidebar menu toggle, moved the detail-pane toggle to the far-right top chrome after deploy, and replaced Lucide panel icons with small custom line glyphs. Verification passed `npm run lint` (existing warnings only, radius OK), `npm run build`, and `git diff --check`. Pushed commit `60484b8`; Vercel deployment `dpl_DdW1qSmFWKKc8iks3bJxbnaeYjTM` reached Ready and is aliased to `https://www.you.md` / `https://you.md`. Browser automation could only open an unauthenticated protected-shell view, so authenticated visual approval remains pending.
**Progress (2026-06-16 follow-up):** Houston flagged that the collapsed rail's `YOU` mark still clipped on the right edge. Reduced the collapsed PixelYOU scale to `0.094`, expanded the clipped viewport to `36px`, and shifted it left by a couple pixels while keeping the 56px sidebar rail unchanged. `npm run lint`, `npm run build`, `npm run docs:check`, and `git diff --check` passed. Vercel deployment `dpl_3K5S5n446oTqL2qDvZbUXraubqdc` reached Ready and is aliased to `https://www.you.md` / `https://you.md`; authenticated production visual QA confirmed the loaded collapsed `YOU` mark now fits cleanly inside the skinny rail. Remaining: GitHub CI final result and Houston visual approval.

### 120. Shell composer prompt/outline cleanup, attach, and voice affordance
**Status:** IN PROGRESS (code complete and deployed; Houston visual approval pending)
**Verified:** NO
**Production Verified:** YES (authenticated production browser QA)
**Source:** 2026-06-15 — Houston: "remove the orange right > in the main chat ui and remove the inner orange outline that should NEVER happen - only the entire chatui parent component should have the whole outline highlighted and probably need to just add a standard + icon on the bottom row to attach images/files and maybe a little keyboard short command on bottom row too to activate voice mode..."
**Actionable Scope:**
1. Remove the orange `>` prompt glyph from the shell composer.
2. Remove the inner orange focus outline/ring from the textarea/input row.
3. Highlight only the outer composer parent on focus.
4. Add a standard bottom-row `+` attachment control for images/files.
5. Add a keyboard-visible voice-mode affordance for fast speech-to-text, with Whisper-backed transcription as the next backend slice.
**Progress (2026-06-15):** Implemented in `src/components/terminal/TerminalInput.tsx`: removed the prompt glyph, removed textarea outlines/rings, moved focus styling to the outer composer shell, added a hidden file picker plus bottom-row `+` control for image and readable text/code attachments, and added a `cmd/ctrl shift m` voice affordance using browser speech recognition when supported with a `/voice` fallback. Verification passed `npm run lint` (existing warnings only, radius OK), `npm run build`, and `git diff --check`. Pushed commits `8225941` and `9160850`; Vercel deployment `dpl_7D9YbyHQDKBWehQ2VxnGPiSL8MTm` reached Ready and is aliased to `https://www.you.md` / `https://you.md`. Authenticated production browser QA confirmed zero `>` prompt glyphs in the composer, attach and voice controls present, focused textarea `outline: none` / `box-shadow: none`, and the outer composer shell carrying the orange outline. Remaining: Houston visual approval.

### 119. Collapsed shell rail cap, PixelYOU sidebar mark, and top action chrome
**Status:** IN PROGRESS (code complete and deployed; Houston visual approval pending)
**Verified:** NO
**Production Verified:** YES (deployment Ready and unauthenticated `/shell` redirect confirmed; Houston authenticated visual approval pending)
**Source:** 2026-06-15 — Houston: "reduce the total icons in the collapsed left sidebar view to only be like the top 6-8 icons max... top right of the shell above the existing tabs... true vibe coding style github icon and publish/update/deploy button... replace [you.md logo] with a small version of the YOU ascii art logo on the hero of homepage... sidebar collapse icon... should be exact same icons the minimal versions exactly like Codex..."
**Actionable Scope:**
1. Limit the skinny collapsed sidebar to 6-8 total controls instead of rendering the full sitemap as an icon tower.
2. Replace the text `you.md` sidebar mark with the homepage PixelYOU visual mark.
3. Make the sidebar collapse icon control only the left sidebar, using left-panel open/close iconography.
4. Move the right-pane toggle out of the left sidebar and into top-right shell chrome.
5. Add a compact coding-style top action row with GitHub, update, publish, and deploy controls above the desktop pane tabs.
6. Keep expanded sidebar groups collapsed by default so the left menu is not visually dumped open.
**Progress (2026-06-15):** Implemented in `src/app/(app)/dashboard/dashboard-content.tsx`: collapsed rail now shows the PixelYOU mark, expand, New Chat, Search, Repo, API/MCP, YouStack, Connectors, and account only; the full sidebar remains available when expanded. The right-pane toggle moved into a new desktop top shell chrome row beside GitHub/update/publish/deploy controls. Publish calls the real `/publish` slash command, update opens source refresh context, and deploy opens the GitHub/repo surface. Local in-app browser QA confirmed collapsed sidebar width 56px, 4 collapsed nav icons, 8 total clickable rail controls, top controls present, and chat width around 679px at a 1600px viewport. `npm run lint` passed with existing warnings only and radius guard OK; `npm run build` passed. Pushed commit `37e0a23`; Vercel deployment `dpl_Ba6tggxyGQ4k62gntwu5zbGJSoEo` reached Ready and is aliased to `https://www.you.md` / `https://you.md`; unauthenticated live `/shell` correctly redirects to `/sign-in?next=/shell`. Remaining: Houston authenticated visual approval.
**Progress (2026-06-15 follow-up):** Expanded sidebar groups now default to closed disclosure rows for Projects, Personal API, Skillstacks, Connect, Identity, and Chats; clicking a group opens only that group. Local browser QA at `localhost:3100/shell` confirmed expanded sidebar width 244px, closed group headers only by default, zero visible item rows before a group click, and `projects` expands to show Synced Repo / Repo Link / History while other groups stay closed. Verification passed `npm run lint` (existing warnings only, radius OK) and `npm run build`. Pushed commit `5d0c35c`; Vercel deployment `dpl_A3HW3Rx76DZbJXm4uyUBKT6ajk4G` reached Ready and is aliased to `https://www.you.md` / `https://you.md`. Remaining: Houston authenticated visual approval.

### 118. Connectors, personal API/MCP/stack surface, sidebar IA, and saved chats
**Status:** IN PROGRESS (latest connector catalog/API-MCP control center code complete locally; deploy and Houston visual approval pending)
**Verified:** NO
**Production Verified:** YES (agent-authenticated browser check; Houston visual approval pending)
**Source:** 2026-06-15 — Houston: "also the Connectors page... invest more of that unicorn creative officer attention to the users personal Api/mcp/stack... fully extendible personal api/mcp/stack with custom endpoints and functions and skills/tools/objects/properties... maybe called it ystack... user is their youstack... actual order of the left side menu... add the more standard way of saving chat sessions in the bottom half of the left side menu... Convex DB itself as a real-time chat/conversation/communication gateway... look into the badapp... sendblue..."
**Actionable Scope:**
1. Rework the Connectors page so it presents the secure personal API/MCP/stack gateway, with GitHub/repo sync as one source input rather than the entire page.
2. Clarify naming: `ystack` is the built-in base stack, `youstack` is the user's default private stack, and custom stacks can be named `{anything}stack`.
3. Surface API/MCP/YouStack security scopes in the UI: public, auth, token, and shared-link access.
4. Show the extensibility model for custom endpoints, functions, tools, objects, properties, skills, sources, and sessions.
5. Reorder the left sidebar by anticipated value/frequency instead of implementation buckets.
6. Add a saved chat sessions section in the lower left sidebar backed by Convex `chatSessions`.
7. Make New Chat create a fresh persisted session id and make saved session clicks hydrate the selected session.
8. Capture the Convex-as-realtime-internal-gateway architecture, including BadApp/Myo prior-art lessons and Sendblue/external-provider boundaries.
**Progress (2026-06-15):** Code complete and deployed: added owner-gated session-specific chat loading, wired New Chat to start a fresh persisted Convex session, added recent saved chats to the shell sidebar, reordered sidebar IA around Projects / Personal API / Skillstacks / Connect / Identity, reframed Connectors as the personal API gateway with `ystack`/`youstack`/`{name}stack` naming and public/auth/token/share access rows, updated the YouStacks pane naming model, and added `project-context/PERSONAL_API_MCP_STACK_SURFACE_2026-06-15.md` with the personal API/MCP/stack and Convex gateway architecture. Local verification passed Convex codegen, TypeScript, targeted ESLint (existing hook dependency warnings only), radius guard, `git diff --check`, and `npm run build`. In-app browser QA at 2048x1400 confirmed the sidebar renders recent saved Convex chat sessions, the reordered IA, and the Connectors gateway page with no horizontal overflow. Saved-session click initially exposed a reactive-query loading-state issue; implementation was switched to one-shot `useConvex().query` hydration. Convex production deployed to `https://kindly-cassowary-600.convex.cloud`; Vercel deployment `dpl_751zUxnaeqsb2aJn1FdSkWd2yoG6` reached Ready and is aliased to `https://www.you.md` / `https://you.md`. Authenticated production browser QA confirmed sidebar chat sessions load after sync, Connectors shows personal API gateway + ystack/youstack + extension/source-graph content with no horizontal overflow, and clicking saved chat `e415e271` hydrates the old conversation without getting stuck on `opening...`. Remaining: Houston visual approval.
**Progress (2026-06-16 follow-up):** Houston flagged that the surface still was not clearly viewable/manageable enough. Reworked the Connectors pane into tabs for `api/mcp`, `apps`, `crawlers/loops`, and `repo`; added a current-user private API/MCP docs table with REST/MCP/stack endpoints, auth contract, resource map, and private route list; added live connected-app grant list/revoke UI; added a Lovable-style searchable connector catalog with categories, pinned You.md/owned-project connectors, Custom API/MCP/Webhook, and popular services such as Firecrawl, Gmail, Google Calendar, Notion, Slack, Linear, Stripe, Shopify, Supabase, Vercel, OpenAI, Perplexity, Airtable, Google Drive/Sheets/Docs, Microsoft, HubSpot, Salesforce, PostHog, Sentry, n8n, LinkedIn, X, RSS, ElevenLabs, Replicate, Strava, and Spotify. Catalog cards can create one-time `yg_` grants and revoke active grants. Embedded Sources under `crawlers/loops` and moved GitHub repo sync to `repo`. Local verification passed `npx tsc --noEmit`, `npm run lint` (existing warnings only; radius guard passed), `npm run build`, and authenticated in-app browser QA at `http://localhost:3100/shell`. Remaining: deploy/push and Houston visual approval.
**Progress (2026-06-16 visibility follow-up):** Made the control center harder to miss and easier for agents to use: shell primary navigation now says `connect` with an `api/mcp` subtab instead of looking like a GitHub-only area; `/api`, `/mcp`, `/connect`, `/connectors`, `/apps`, `/crawlers`, `/crons`, and `/loops` route into the private API/MCP connector pane; command palette and `/help` list the new routes; and the API/MCP tab now includes copyable hosted-MCP config, local MCP host-adapter install, REST smoke-check, and scoped agent startup snippets.
**Progress (2026-06-16 connector icon/local-agent follow-up):** Upgraded the Connectors `apps` catalog with real Google favicon API icons from each connector's domain, stable connector QA hooks, Local Agent Runtime as the first recommended connector path, and clear CLI/grant verification copy for Claude Code/Codex/local MCP sessions. The catalog now ranks You.md/owned/custom connectors first, then popular apps immediately after: Slack, Notion, Gmail, Google Calendar, Linear, GitHub, HubSpot, Salesforce, Firecrawl, Stripe, and Google Drive. Authenticated in-app browser QA confirmed 49 connector cards, 50 Google favicon-backed icon styles, the recommended local-agent card, `lastUsedAt` verification copy, and the expected rank order.

### 117. Polish `/shell` ratios, sidebar/account chrome, and no-nested-box chat UI
**Status:** IN PROGRESS (implementation in progress; verification pending)
**Verified:** NO
**Production Verified:** YES (agent-authenticated browser check; Houston visual approval pending)
**Source:** 2026-06-15 — Houston: "I really want you to go through our app and polish it as it was your own baby... NEVER allow the chat column to be that narrow... remove the entire top row nav for logged in users... move the top right thing with portrait/image username etc to the bottom of the left hand sidebar... chatui... full width/height... too many borders/outlines... boxes inside boxes... side menu box/pills... bulky/clunky..."
**Actionable Scope:**
1. Prevent the chat column from loading or resizing below a usable desktop width.
2. Auto-collapse the left sidebar when the split needs room, instead of letting the chat column become too narrow.
3. Remove the logged-in top nav from `/shell`/dashboard workspace surfaces.
4. Move portrait/username/account controls to the bottom of the left sidebar.
5. Add a sidebar account popout with usage, settings, sign out, and saved theme preference (`light`, `dark`, `system`).
6. Remove bulky sidebar pills/borders and show item details as hover/title context instead of permanent subtext.
7. Make the chat composer fill its component width/height with one clean outer boundary and no nested borders.
8. Reduce right-pane tab chrome and overall nested-border visual noise while keeping the terminal-native aesthetic.
**Progress (2026-06-15):** Implemented locally: shell/dashboard logged-in surfaces now hide the global top nav, workspace height uses the full viewport, chat split defaults wider and is guarded by pixel + percentage clamps, stored narrow split widths are migrated up to the new default, desktop resize respects minimum chat/detail widths, sidebar auto-compacts below wide desktop when the detail split needs room, sidebar rows are borderless icon/label actions with hover/title detail context, account/usage/settings/signout/theme controls moved into a sidebar-footer popout, composer inner border removed, and desktop pane tabs changed from boxed pills to underline-style tabs. Verification passed TypeScript, targeted ESLint (existing unrelated warning only), radius guard, `git diff --check`, and production build. Pushed commits `05174fa` and `831478d`; Vercel deployment `dpl_HzLoG5YvgiQ2Li7kFS1VmPNHnkJR` reached Ready and is aliased to `https://www.you.md` / `https://you.md`. Authenticated production browser QA at 2048x1400 confirmed no logged-in top nav, full-height shell, 244px sidebar, 794px chat column after stored-width migration, 694px composer textarea, account popout with usage/settings/signout/theme, and no duplicate shell/body overflow. Remaining: Houston visual approval.

### 116. Remove terminal-window chrome and add full-height sidebar + resizable split shell
**Status:** IN PROGRESS (code complete and deployed; Houston authenticated verification pending)
**Verified:** NO
**Production Verified:** NO
**Source:** 2026-06-15 — Houston: "the you.md/shell page i think it is time to remove the top part with the red/yellow/green docs and the padding and border around it etc and make it a proper resizable lovable/codex style split screen full height two column layout with a far left side menu..."
**Actionable Scope:**
1. Remove the old red/yellow/green terminal-window header, outer padding, and framed border around `/shell`.
2. Make `/shell` a full-height app workspace with a persistent far-left sidebar.
3. Use the familiar app-sidebar pattern from Houston's BAMF/Bad/Myo projects: new chat, search, grouped navigation, account/status footer.
4. Make the chat/detail split resizable on desktop.
5. Improve the bottom chat composer visual treatment.
6. Seed sidebar groups for Projects/GitHub repos, Skillstacks, connectors, crawlers, crons, API/MCP/YouStack docs, private sharing/API tokens, and connected agents while mapping to current shipped panes where backend surfaces already exist.
**Progress (2026-06-15):** Rebuilt `/shell` as a full-height app workspace: old desktop terminal-window chrome/outer frame removed, persistent left sidebar added with New Chat/Search plus Workspace/Projects/Skillstacks/Automation/Access groups, synced GitHub repo status surfaced, desktop chat/detail split made resizable with persisted width, bottom composer restyled, and sidebar Crawlers/Crons now open the sources editor subtab. Local verification passed TypeScript, targeted ESLint, radius guard, `git diff --check`, production build, and in-app browser QA for desktop, mobile width, and crawler navigation. Pushed commit `0ce1963`; Vercel deployment `dpl_4nb5fiWgDSHwV6gdRvVzFhYkAnP5` reached Ready and is aliased to `https://www.you.md` / `https://you.md`; unauthenticated live `/shell` correctly redirects to `/sign-in?next=/shell`. Remaining: Houston authenticated production visual approval.

## 2026-06-15 — Route h.computer product ideas into native You.md

### 115. Make You.md the native personal API/MCP, agent brain, and YouStacks layer
**Status:** IN PROGRESS (native grants/connectors/crawler foundation code complete; prod/user verification and next slices pending)
**Verified:** NO
**Production Verified:** NO
**Source:** 2026-06-15 — Houston: "Move these ideas from the h.computer/creator-new cloud into You.md" and clarified that h.computer should remain his personal site/agent/reference implementation while You.md owns the productizable personal agentic computer, structured personal API/MCP, stack layer, connector UX, crawlers/crons, host adapters, skill-learning loop, model routing, and gated identity access.
**Actionable Scope:**
1. Read the new You.md project-context docs plus the late-night routing/context from `creator-new` and `h-computer`, including h.computer platform/docs/gallery. **DONE:** reviewed `creator-new/project-context/idea-routing-2026-06-15.md`, local h.computer protocol/vision docs, live h.computer platform/docs/gallery pages, and active You.md PRD/Architecture/YouStacks/OKF/backlog context.
2. Preserve the clarified product routing inside You.md. **DONE:** added `project-context/PERSONAL_API_MCP_AND_YOUSTACKS_MEMO_2026-06-15.md`.
3. Clarify that You.md is not only a profile page; it is the durable brain plus portable expertise-stack layer consumed by h.computer, Creator.new, BAMF.ai, folder.md, MCP clients, and local/cloud agents. **DONE in docs:** PRD + Architecture + Features + TODO updated.
4. Define the personal API/MCP boundary for `identity`, `now`, `projects`, `sources`, `memories`, `preferences`, `trust_rules`, `stacks`, and `activity`. **MVP UI COMPLETE:** the Connectors `api/mcp` tab now exposes the user's private endpoint docs, auth contract, resource map, route table, and connected-app grants; formal versioned protocol docs/custom endpoint implementation still remain.
5. Add Lovable-simple connector UX for adding sources/tools, previewing mapped context, choosing trust/visibility, and scheduling refresh. **MVP CODE COMPLETE:** Sources pane supports Website/GitHub/RSS/OKF/Webhook/JSON, provider selection, refresh cadence, visibility, trust, labels, refresh-now, pause-cron, inline policy edits, and provenance details. Connectors pane now also has a searchable app catalog with pinned You.md/owned connectors, Custom API/MCP/Webhook, popular third-party services, category filters, and `yg_` grant create/revoke controls.
6. Add custom crawlers, crons, source refresh, monitored updates, source health, and provenance-rich writeback. **PARTIAL CODE COMPLETE:** source metadata, hourly due-source marker cron, owner source actions, native/Firecrawl pipeline dispatch, immutable change timestamps, first rate/cost/approval gates, deterministic source-change summaries with preview/length/headings, and pending-review extraction holds are added; agent-browser fails closed until the sandbox worker is implemented.
7. Add context links, scoped grants, connected-app grants, and gated public/private identity modes for agents and products. **MVP CODE COMPLETE:** connected-app grant table + owner CRUD/resolve helpers added; HTTP/MCP `yg_` bearer auth now enforces resource/action scopes and write policy while logging grant-linked activity. Grants are now visible/manageable from the Connectors UI.
8. Expand YouStacks as named packages of skills, workflows, prompts, tools, docs, tests, host adapters, examples, update policy, improvement policy, and model routing. **PARTIAL existing YouStacks foundation; model routing and grants pending.**
9. Add host adapters for Claude Code, Codex, Cursor, ChatGPT, MCP clients, local agents, and future runtimes. **PARTIAL for Claude Code/Codex/Cursor; ChatGPT/MCP-client/future runtime work pending.**
10. Add skill learning/documentation loop from screen recordings, transcripts, SOP extraction, tool/API lists and fallbacks, agent-run logs/summaries, and saved reusable skills. **PENDING.**
11. Add stack-level multi-agent model routing policy: orchestrator for judgment, lead for planning/execution, workers for cheap/repeated/specialized tasks, plus BYOK and open/cheaper model support. **PENDING.**
12. Keep h.computer as Houston's personal site/agent/reference implementation that reads from You.md and writes back useful memories; Creator.new can optionally attach creator identity/context from You.md. **DONE in docs; implementation integration pending.**
**Progress (2026-06-15):** Product-context routing pass completed. Added the dedicated memo, updated PRD/Architecture/FEATURES/TODO, and kept implementation slices explicitly pending rather than marking product behavior shipped.
**Progress (2026-06-15 continuation):** Focused only on You.md. Added `connectedAppGrants` with hashed `yg_` tokens, scopes/resource scopes/write policy/trust/expiry/revocation, owner create/list/page/revoke/resolve functions, and tests. Extended `sources` with connector/crawler/refresh/visibility/trust metadata and updated `me.addSource` to save that contract while deduping by exact URL. Upgraded `SourcesPane` into a connector MVP. Added `sourceRefresh.markDueSourcesPending` plus an hourly cron that marks due sources pending without running expensive crawlers/LLM extraction. Saved the implementation/runbook in `CONNECTED_APPS_CONNECTORS_MVP_2026-06-15.md`. Verified with Convex codegen, focused Vitest, and root TypeScript.
**Progress (later 2026-06-15):** Wired `yg_` connected-app grants into HTTP/MCP auth and `agentActivity`; grants now resolve to the owner, update `lastUsedAt`, enforce resource/action scopes, and deny writes unless the grant has `approved_write`. Added owner source actions for refresh-now, pause, policy updates, and raw version history. Expanded `SourcesPane` with inline actions, policy chips, and provenance details. Added a Firecrawl runner path to the existing pipeline with env-key fail-closed behavior and immutable raw-source version writes; agent-browser now has a fail-closed sandbox-required provider boundary. Verification passed Convex codegen/typecheck, focused Vitest, `npx tsc --noEmit`, lint, docs check, agent-doc handoff, and `git diff --check`. Remaining: production deployment/verification, real Firecrawl env smoke, rate/cost/approval policy, monitored update summaries, and the real agent-browser sandbox worker.
**Progress (latest 2026-06-15):** Added `sourceRunPolicy.reserveSourceRun`, so the pipeline now estimates provider cost, requires owner approval for expensive providers, reserves per-user/provider hourly runs, and records the last run decision before executing native, Firecrawl, Apify, or agent-browser providers. Added `approveSourceRun` plus a Sources-pane `approve 24h` action for Firecrawl/agent-browser sources. `recordRawSourceVersion` now sets `lastChangedAt` only on real content-hash changes, and failed source status updates increment `failureCount`. Added `AGENT_BROWSER_SANDBOX_RUNNER_SPEC_2026-06-15.md` for the browser-worker boundary and skill-learning hook. Remaining: production deployment/verification, real Firecrawl env smoke, monitored update summaries, approval-aware extraction/writeback, and the actual agent-browser sandbox worker.
**Progress (continued 2026-06-15):** Added `sourceChangeSummaries`, deterministic first-fetch/content-changed summaries tied to immutable raw source versions, `metadata.lastChangeSummary`, owner APIs for listing/approving changes, and Sources-pane review UI. Approval-gated source changes are skipped by the extraction stage while `pending_review`, giving You.md a real monitored-update checkpoint before extraction/writeback. Remaining: production deployment/verification, real Firecrawl env smoke, richer semantic diff summaries, approval-aware writeback, source health states, and the actual agent-browser sandbox worker.
**Progress (latest 2026-06-15 continuation):** Enriched monitored source-change summaries with deterministic content length, safe text preview, and heading hints. Website, Firecrawl, Apify, and LinkedIn fetch paths now pass fetched text context into immutable source version recording, and the Sources pane surfaces the latest preview. Remaining: production deployment/verification, real Firecrawl env smoke, approval-aware writeback, source health states, and the actual agent-browser sandbox worker.
**Progress (2026-06-16 connector control center):** Looked at local h.computer Human Computer Protocol/hstack connector notes and badapp API/MCP/badstack patterns, then implemented the missing You.md-native control surface: personal API/MCP docs, connected-app grant management, app connector catalog, custom API/MCP/Webhook entries, crawlers/loops tab, and repo-as-one-connector IA. Authenticated local browser QA confirmed `api/mcp`, `apps`, `crawlers/loops`, and `repo` tabs render in `/shell`; the app catalog includes pinned You.md/custom/Firecrawl/Gmail-style entries; and crawlers/loops exposes native/Firecrawl/agent-browser provider intent, cron refresh, immutable versions, and existing source controls. Remaining: deploy/push, real Firecrawl key smoke, approval-aware writeback, source health states, real agent-browser sandbox worker, formal custom endpoint/docs generation, skill-learning loop, stack-level model routing, and additional host adapters.
**Progress (2026-06-16 visibility follow-up):** Promoted the private API/MCP + connector control center from a hidden `github`-labeled surface to `connect` -> `api/mcp`, added direct slash routes and command-palette entries, and added copyable MCP/local-adapter/REST/agent-start snippets so a user or agent can actually wire the personal API/MCP boundary without hunting through public docs.
**Progress (2026-06-16 favicon/local-agent follow-up):** The app catalog now uses Google favicon API icons for real connector domains, adds stable connector QA hooks, prioritizes Local Agent Runtime as the first recommended way to connect Claude Code/Codex/Cursor/local MCP clients, and shows grant `lastUsedAt` verification language. Popular apps are ranked directly after the pinned You.md/owned/custom connector layer: Slack, Notion, Gmail, Google Calendar, Linear, GitHub, HubSpot, Salesforce, Firecrawl, Stripe, and Google Drive.

## 2026-06-14 — Familiar follow-ups: graph, brain view, immutable sources

### 114. Implement the next three Familiar follow-ups (graph cross-linking, immutable-source enforcement, desktop/web brain view)
**Status:** IN PROGRESS (#1 + #3 code complete + verified; #2 code complete + runtime-verified, needs Convex codegen/deploy)
**Verified:** NO
**Production Verified:** NO
**Source:** 2026-06-14 — Houston: "Continue to implement those next three" (the three I flagged after the OKF + provenance + health work: concept graph cross-linking, immutable-source enforcement in the crawler pipeline, Obsidian-style desktop client + web consistency).
**Actionable Scope:**
1. **Concept graph cross-linking.** DONE + verified. `related` first-class OKF graph edges, derived from real structural relationships only (about anchor, voice platform→overall, skills→directives, prefs→directives), author edges preserved, stack→manifest hub; `okf health` counts `related` as edges. 5 tests.
2. **Immutable-source enforcement (Convex pipeline).** DONE + runtime-verified (needs codegen/deploy). `convex/lib/sourceHashing.ts` (pure), append-only `rawSourceVersions` table + `recordRawSourceVersion` (version-on-change, never overwrite), wired into all 3 fetch paths; fixed compiled-bundle provenance (real URLs in `meta.sources_used`/`linked_sources` + manifest). 389 convex tests green (11 new).
3. **Desktop/web brain view.** DONE + verified. `cli/src/lib/okf-view.ts` framework-agnostic `buildBrainView` model + dependency-free terminal-native HTML; `youmd okf view`. The shared view model is what the web app + future desktop client both render for consistency. 4 tests.
**Remaining:**
- Owner/CI: `npx convex codegen` + `tsc -p convex/tsconfig.json` + Convex deploy for the new `rawSourceVersions` table; verify the live pipeline versions sources and bundles carry URLs.
- A real Electron/Tauri desktop shell and a Next.js `/brain` route that imports the shared view model are their own initiatives (not built); OKF + `buildBrainView` are now the substrate that makes them cheap.
- Future Familiar items still not built: immutable-source rule extended to the public-profile crawler, `[CONFLICT]`/`[STALE]` authoring UX.

---

## 2026-06-13 — OKF (Open Knowledge Format) Integration

### 113. Provenance frontmatter on OKF concepts (Familiar-second-brain pattern)
**Status:** IN PROGRESS (code complete on branch; Houston verification pending)
**Verified:** NO
**Production Verified:** NO
**Source:** 2026-06-13 — Houston shared the "Familiar second-brain / KIMI Work" article ("do with it only what you think is appropriate... don't create unnecessary complexity"), then after the assessment: "Just build it" (= build recommendation #1: provenance frontmatter).
**Request:** Adopt the one genuinely-additive, low-complexity pattern from Familiar — `last_updated_by` / `confidence` / `linked_sources` provenance on each concept — so agents can audit who wrote a concept, how sure they were, and what it derives from. Explicitly NOT the cron/inbox/Whisper machinery (already covered by workflows/self-improving stacks).
**Actionable Scope:**
1. First-class provenance fields in the OKF core with stable ordering + light validation (bad `confidence` warns, never errors). **DONE** (`okf.ts`).
2. Thread through identity + stack export/import; preserve through round-trips; never overwrite existing. **DONE** (`okf-bundle.ts`, `okf-stack.ts`).
3. Stamp on export: `--author` (default logged-in username), skills stamped `agent`, `about` auto-linked to real `you.json` `meta.sources_used` (never fabricated); `--confidence` opt-in. **DONE** (`commands/okf.ts`, `--author`/`--confidence` flags).
4. Tests + smoke. **DONE:** +7 tests (37 OKF total); CLI build clean; smoke confirms provenance frontmatter on export and survives import round-trip.
5. **Houston (user-only):** confirm the provenance fields are useful in practice during the cross-machine test.
**Progress (2026-06-13):** Built on the same branch in the same session. Did NOT build the Familiar cron/inbox/Whisper stack (redundant with existing workflows/self-improving stacks + would add the "second filing cabinet" complexity Houston warned against). **Follow-on (same session, "Continue"):** built `youmd okf health` (`cli/src/lib/okf-health.ts` + `health`/`doctor` subcommand), which bundles three more flagged Familiar follow-ups — the graph/orphan check, `[CONFLICT]`/`[STALE]` markers, and the un-sourced "no synthesis without a source" rule — into one OKF-native self-audit with a 0-100 score (44 OKF tests total). Remaining future tracks, not built: the immutable-source enforcement in the crawler pipeline, and the Obsidian-style desktop client + web consistency (OKF is the substrate; treat as its own initiative).

### 112. Implement OKF and prove cross-machine sync of skills/stacks/context
**Status:** IN PROGRESS (code complete on branch; Houston e2e + publish pending)
**Verified:** NO
**Production Verified:** NO
**Source:** 2026-06-13 — Houston: first asked "How can this help my youmd project?" about Google's OKF, then: "you must implement the OKF as suggested and planned and ensure all of this works... share local agentic skills/stack across machines... update a skill on my MacBook and my Mac mini also auto-updates... publishable youStacks ie like your own Gstack... I have purchased two brand new machines a new MacBook Air and a new Mac mini... once you're 100% confident I'll run it locally and test the goal end to end."
**Request:** Adopt OKF as the portable, lock-in-free wire format for You.md so identity, skills, and YouStacks travel between machines and agents; make publishable youStacks expressible as OKF; get to 100% local confidence so Houston can run the end-to-end cross-machine test on the two new Macs.
**Actionable Scope:**
1. Implement OKF as proposed (conformant export/import). **DONE:** pure core `cli/src/lib/okf.ts` (serialize/parse, validation, `index.md`/`log.md` builders for `okf/v0.1`).
2. Identity bundle ↔ OKF, lossless round-trip incl. installed skills. **DONE:** `cli/src/lib/okf-bundle.ts` (`youmd_kind` routes concepts home on import).
3. YouStacks as publishable OKF ("Gstack" story). **DONE:** `cli/src/lib/okf-stack.ts` (manifest concept + typed files; `youstack.json` carried for installability).
4. CLI surface. **DONE:** `youmd okf export|import|validate` + `youmd export --okf`, `--json`/`--stack`/`--out`/`--no-skills`.
5. Skills/project-status/preferences sync across machines + background auto-update. **RIDES EXISTING ENGINE:** `youmd sync`/`sync --watch` + skills registry sync already move context server-side; OKF adds the portable, lock-in-free snapshot/exchange. No sync behavior changed. Cross-machine proof is steps A–C in `OKF_INTEGRATION.md`.
6. Tests + verification. **DONE:** 30 OKF tests green; CLI build clean; end-to-end CLI smoke for identity + stack export (conformant) and import round-trip.
7. Runbook for the two Macs. **DONE:** `project-context/OKF_INTEGRATION.md`.
8. **Houston (user-only):** run the cross-machine end-to-end test on MacBook Air + Mac mini.
9. **Owner-only:** bump CLI version, align root AGENTS.md/CLAUDE.md version markers, `npm publish` when ready (intentionally not bumped on this branch to keep the agent-docs version guardrail green).
**Design/Runbook:** `project-context/OKF_INTEGRATION.md`. Spec: https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md
**Progress (2026-06-13):** Built the full OKF layer on `claude/okf-youmd-integration-7bxxt1`. `npm --prefix cli run build` passes; new OKF suite green (30 tests); CLI smoke confirmed identity export (7 concepts, conformant), import round-trip rebuilds section files, and stack export (`youstack-personal`, conformant) with `youstack.json` carried. Pre-existing live-network `integration.test.ts` cases still fail in the sandbox (no production reachability) — unrelated to this change. Remaining: Houston's cross-machine e2e, then owner-only version bump + publish.

---

## 2026-06-04 — Free GitHub OAuth Signup + Repo-Native You.md

### 106. Free GitHub OAuth signup
**Status:** IN PROGRESS (code complete on branch, needs OAuth App + deploy + verify)
**Verified:** NO
**Production Verified:** NO
**Source:** 2026-06-04 — Houston: "add the GitHub OAuth and just let everyone sign up for free... users are gonna wanna just sign in, sign up, connect their repo, create their own You.md repo... prioritize that."
**Request:** Let anyone sign up for free via GitHub OAuth, alongside the existing email-code auth.
**Actionable Scope:**
1. `githubConnections` Convex table (GitHub identity + encrypted OAuth token + scopes + linked-repo metadata). DONE
2. `convex/github.ts`: `findOrCreateGithubUser` (gated by trusted internal token), `getConnection`, `linkRepo`. DONE
3. Web OAuth routes `/api/auth/github/start` + `/api/auth/github/callback`, reusing the opaque session cookie + JWKS Convex JWT path. DONE
4. "continue with github" / "sign up free with github" on sign-in + sign-up, with graceful unconfigured state + OAuth error surfacing. DONE
5. Operator runbook (`GITHUB_OAUTH_SETUP.md`) for registering the OAuth App + env vars. DONE
6. **Blocked on Houston/operator:** register the GitHub OAuth App, set `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` (+ optional `GITHUB_OAUTH_SCOPES`), deploy Convex + Vercel from `main`, verify end-to-end.
**Progress (2026-06-04):** Built the full Phase-1 foundation on `claude/github-oauth-free-signup`. `npx tsc --noEmit` (web + `convex/tsconfig.json`) passes with 0 errors; targeted ESLint clean. Email-code auth is untouched. Not deployed (branch only, no PR).

### 107. Repo-native You.md — host MD files + stacks in the user's own GitHub repo (public/private)
**Status:** IN PROGRESS (Phase 2 code complete on branch; Phases 3–5 planned)
**Verified:** NO
**Production Verified:** NO
**Source:** 2026-06-04 — same message: "host their full UMD and use stacks on their own GitHub repos and make those repos either public or private... use that for all the MD files and everything... since we have access to repo, we can clone it and host it on our own servers for the agentic and API MCP stuff." Then: "Start phase 2".
**Request:** Make the user's own GitHub repo the source of truth for their identity `.md` + stacks (public or private), and clone/mirror it server-side to power the agentic/API/MCP surfaces.
**Actionable Scope:**
1. Phase 2 — connect/create the You.md repo (create `you-md` public/private; or connect an existing repo) and seed it. **DONE (code complete, needs deploy):** `convex/githubRepo.ts` actions `createRepo`/`connectRepo`/`listRepos` (OAuth token decrypted only inside Convex actions), internal helpers in `convex/github.ts`, and `GithubRepoSection` wired into the Settings pane (visibility toggle + repo picker, no forms). tsc + eslint clean.
2. Phase 3 — sync engine: pull repo MD → bundles/profiles; push edits back as commits; conflict policy; webhook re-pull. **DONE (code complete, needs deploy):** `pushToRepo` / `pullFromRepo` actions (you.md + you.json, last-writer-wins via file sha, `lastSyncedSha`), push/pull controls, AND webhook auto-pull (`POST /api/github/webhook`, HMAC-verified, auto-registered on create/connect, schedules pull+mirror). **Remaining:** 3-way merge, sync `private/*`.
3. Phase 4 — server-side clone/mirror; stacks + MCP/API read from the mirror. **FIRST SLICE DONE (code complete, needs deploy):** `repoMirror` table + `syncMirror`/`internalMirrorForConnection` (head→tree→blobs, capped) snapshots identity + `stacks/**`; authenticated `GET /api/v1/me/repo/files` + `/stacks` serve it; `getRepoMirror` + `deriveStacks` power the Settings-pane mirror status. **Remaining:** wire MCP server + public profile to read stacks from the mirror; private files via token surfaces only.
4. Phase 5 — harden OAuth App → GitHub App (fine-grained, per-repo, least-privilege). **FOUNDATION DONE (code complete, additive, untested e2e):** `convex/githubApp.ts` (RS256 app JWT + installation tokens), `loadConnectionToken` prefers installation tokens when the App is configured + installed (OAuth fallback unchanged), `setInstallation` + `/api/auth/github/app/setup` callback, Settings install link. **Remaining:** register the App + env, token caching, `installation` webhook revocation.
5. Follow-ups landed alongside: MCP `get_my_stacks`/`get_repo_file` + public `get_identity.repo_stacks`; public profile renders repo-hosted stacks (public repos only).
**Design:** `project-context/GITHUB_NATIVE_PLAN.md` (defaults in use: repo name `you-md`, default visibility private, email-match links to existing account, repo-as-truth opt-in per account).
**Progress (2026-06-04):** Phases 2, 3 (+webhook), and 4-first-slice built on `claude/github-oauth-free-signup-sj6Nn`. Needs Convex deploy (new tables/actions/routes) + the OAuth App with `repo` scope (+ optional `GITHUB_WEBHOOK_SECRET`), then end-to-end verify (create → seed → push/pull round-trip → external push auto-pulls → mirror shows files/stacks → `GET /api/v1/me/repo/files` returns them). Phase 5 + the MCP/public-profile stack wiring remain their own slices.

---

## Tracking Rules
- Every request gets its own entry with status
- Status: TODO | IN PROGRESS | DONE | VERIFIED BY USER
- Don't mark DONE until actually deployed and tested
- Don't ignore parts of messages — break them ALL down
- Source: date + commit or conversation reference

---

## 2026-06-13 Remote Main Sync Continuation

### 111. Pull remote main, resolve conflicts, verify new landed work, and keep moving
**Status:** IN PROGRESS (local sync + verification complete; production/user verification pending)
**Verified:** NO
**Production Verified:** NO
**Source:** 2026-06-13 — Houston said "pull down all changes from remote main and resolve conflicts and continue"
**Request:** Bring local `main` up to current `origin/main`, preserve and merge local work, resolve any conflicts, audit what landed, fix/test anything newly broken from the merge, and continue through verification/setup notes.
**Actionable Scope:**
1. Fetch/pull all changes from remote `main`.
2. Reapply local work safely and resolve conflicts without losing user changes.
3. Audit the newly landed stack registry, MCP registry/subscribe, webhook, CLI stack-install, generated docs, and backlog/reference-intelligence updates.
4. Run local build, lint, docs, Convex, CLI, and production-build checks.
5. Fix issues surfaced by verification.
6. Identify owner-only setup/deploy needs.
7. Update project context and commit logical follow-through changes.
**Progress (2026-06-13):** Fast-forwarded local `main` to `origin/main` commit `376f967` after stashing/reapplying local artifacts; the stash pop was clean and there were no textual merge conflicts. Audited the newly landed stack install/public registry, hosted MCP registry + `subscribe`, outbound webhooks, generated agent docs, and backlog docs wave. Verification found and fixed three follow-through issues: Convex codegen/deploy rejected `convex/lib/capability-router.ts` because Convex module path components cannot contain hyphens, so the Convex-side twin is now `convex/lib/capabilityRouter.ts`; CLI round-trip decompile no longer treats `username` as an `identity.name`; `/docs` telemetry panel now uses the radius token accepted by the design guardrail. Verification passed `npm run lint` (0 errors, existing warnings), `npm run test:convex` (28 files / 355 tests), `npm --prefix cli test` (42 files / 472 tests), `npm --prefix cli run build`, `npx tsc --noEmit`, `npx tsc -p convex/tsconfig.json --noEmit`, `npx convex codegen --typecheck enable`, `npm run agent-docs:ci`, `npm run docs:check`, `npm run build`, and `git diff --check`. **Owner-only remaining:** deploy/push verification requires normal production ownership; GitHub OAuth/App/webhook setup still needs real secrets and app registration from Houston/operator where applicable.

## 2026-06-04 Remote Main Sync + Full Audit

### 108. Pull remote main, merge local state, verify, audit, and identify owner-only setup
**Status:** IN PROGRESS
**Verified:** NO
**Source:** 2026-06-04 — Houston said "Pull down all the changes from the remote main repo... Continue from there comprehensively."
**Request:** Bring local `main` fully up to date with remote, merge it with existing local work, prove the repo still builds/tests/runs, audit new improvements and docs, identify any keys/setup only Houston can complete, test new behavior, and keep moving comprehensively from the resulting state.
**Actionable Scope:**
1. Fetch/pull all changes from remote `main`.
2. Merge remote changes with local modifications without losing existing work.
3. Run the relevant build, lint, docs, CLI, and smoke checks.
4. Audit new improvements and docs introduced by the sync.
5. Identify required keys, credentials, environment variables, deploy permissions, or owner-only setup.
6. Test and fix new functionality where possible from this machine.
7. Update project context, commit logical local follow-through changes if any, and report remaining blocked/user-only work.
**Progress (2026-06-04):** Pulled `origin/main` and fast-forwarded local `main` from `22b09ea` to `cf56f07`, preserving and reapplying the local reference-intelligence artifacts. Audited the incoming GitHub-native wave: GitHub OAuth signup, repo create/connect, repo push/pull, webhook auto-pull, server-side repo mirror, authenticated repo file/stack APIs, setup docs, OpenAPI/docs updates, and project-context tracking. Fixed local follow-through issues found during the audit: regenerated stale `llms` docs, regenerated Convex API bindings for `lib/secretCrypto`, corrected GitHub OAuth local-dev fallback/docs/env from port `3000` to this repo's `3100`, and upgraded Next.js from `16.2.2` to `16.2.7` with root manual markers updated. Verification passed `npm run agent-docs:ci`, targeted GitHub integration ESLint, `next typegen && tsc --noEmit`, `npx convex codegen --typecheck enable`, `npm --prefix cli run build`, `npm --prefix cli test` (12 files / 69 tests), `git diff --check`, and local HTTP smoke for `/api/auth/github/start` returning `http://localhost:3100/sign-in?error=github_unconfigured` when GitHub OAuth is not configured. **Blocked/remaining:** local `next build` hangs silently with both default and `--webpack` even after the Next patch upgrade; full end-to-end GitHub OAuth/repo verification requires Houston/operator to configure the GitHub OAuth App and deployment secrets, then deploy Convex + Vercel.

## 2026-06-09 Reference-Intelligence Follow-Through

### 109. Turn the Jun 9 reference-intelligence wave into tracked You.md follow-up slices
**Status:** IN PROGRESS
**Verified:** NO
**Production Verified:** NO
**Source:** 2026-06-09 — Houston said "continue and also please commit and push to main and ensure everything works live on prod" after the daily reference-intelligence run completed.
**Request:** Continue the Jun 9 daily reference-intelligence run all the way through by turning the new upstream signals into durable tracked work, verifying the local monitor path, committing/pushing the resulting project-context updates, and smoke-checking production so the original automation goal is fully realized.
**Actionable Scope:**
1. Version the regenerated `project-context/reference-intelligence/LATEST.md` and `TASKS.md` outputs from the 2026-06-09 sync.
2. Distill the highest-value follow-up work from GStack `1626d48` and GBrain `1eb430a`.
3. Write a dated audit that maps those upstream changes to explicit You.md next steps.
4. Update TODO/features/changelog/request tracking/prompt archive so future sessions can continue without re-deriving the same two tasks.
5. Run local verification for the reference loop and smoke current public docs/API/MCP surfaces on production.
6. Commit and push the resulting local follow-through to `main`.
**Progress (2026-06-09):** Re-ran chat hygiene and the reference sync, which fetched new upstream heads for GStack and GBrain and regenerated the two reference-intelligence artifacts. The first pass surfaced two high-signal tasks, which are now preserved in `project-context/REFERENCE_INTELLIGENCE_AUDIT_2026-06-09.md`: deterministic review/report packaging for YouStacks and fail-closed protected retrieval plus malformed-frontmatter resilience for repo-native/context reads. A same-session verification re-run of `npm run references:sync` then correctly returned zero new candidates because the local reference heads were already updated. Updated project-context tracking so the two tasks stay durable even though the generated queue is now back to a caught-up steady state. Remaining in this run: commit/push and recording any prod blockers versus the unchanged live baseline.

### 110. Fix public profile portraits, default grid view, and harden scalable profile crawling
**Status:** IN PROGRESS (code complete locally; needs deploy + production smoke + user verification)
**Verified:** NO
**Production Verified:** NO
**Source:** 2026-06-09 — Houston said "please fix the profiles that are missing their ASCII portraits and let's default to grid view instead of the list view on the /profiles page... create a rule... harden how our own crawler creates and indexes and monitors and enhances these public profiles... cheap/open-source version of firecrawl... google search for agents looking up anything about real people..."
**Request:** Make public profiles reliably display a profile image or ASCII portrait on the `/profiles` index and individual public profile pages, default the directory to grid view, and design the scalable crawler/enrichment loop so You.md can grow a large SEO-friendly people index without runaway Firecrawl spend.
**Actionable Scope:**
1. Default `/profiles` to grid view. DONE locally.
2. Replace blank/broken portrait slots with a shared renderer that prefers stored ASCII, then real image, then a visible terminal fallback. DONE locally.
3. Validate stored ASCII before counting/rendering it and reject malformed empty portrait payloads in Convex directory normalization. DONE locally.
4. Add guardrails so future code/data regressions fail before deploy. DONE locally with `profiles:portrait-contract`, `profiles:portrait-audit`, and `profiles:portrait-audit:pages`.
5. Ensure individual public profile pages use the same portrait contract as the directory. DONE locally.
6. Add autonomous refresh hooks for unclaimed profile portraits. DONE locally via monthly Convex cron using existing enrichment/backfill action.
7. Preserve public profile API availability through the web domain. DONE locally via same-origin `/api/v1/profiles` proxy.
8. Document the low-cost crawler/indexing plan for thousands to hundreds of thousands of profiles. DONE locally in `PUBLIC_PROFILE_INDEXING_AND_REFRESH_PLAN.md`.
9. Deploy to production and run prod profile audits. TODO.
10. Build the production crawler/source-ledger/job-state implementation from the plan. DONE locally for the foundation: source ledger, refresh jobs, import batches, 50-target catalog, admin dry-run/import route, native metadata fetcher, content hashing, daily refresh cron, and target guard.
11. Deploy the indexing foundation, run an admin dry-run for all 50 seed targets, inspect created/patched/skipped output, then run the real import only if the dry-run is clean. TODO.
12. Add the next enrichment stage: cheap extractor routing, source-backed profile compilation, cost-capped LLM enrichment, and larger-batch monitoring. TODO.
**Progress (2026-06-09):** Added shared `ProfilePortrait`, frontend + Convex `hasRenderableAsciiPortrait` checks, stored-ASCII tile downsampling, `AsciiAvatar` overlay fallbacks, grid default, SSR profile fallback hydration, individual-profile portrait replacement, same-origin public profile API proxy, monthly Convex portrait QA cron, static contract script, dynamic API/page audit scripts, and the crawler/indexing plan. Local verification passed `profiles:portrait-contract`, `profiles:portrait-audit`, `profiles:portrait-audit:pages`, `next typegen`, web TypeScript, Convex TypeScript, targeted ESLint, `git diff --check`, local HTTP smoke for `/profiles`, `/karpathy`, and `/api/v1/profiles?username=karpathy`, plus headless Chrome screenshots showing no blank portrait boxes.
**Progress (later 2026-06-09):** Added the first scalable public-profile indexing foundation: Convex `profileSources`, `profileRefreshJobs`, and `profileImportBatches` tables; a 50-target top tech/AI/SaaS/builder catalog; internal import and source-refresh actions; admin-only HTTP routes for dry-run/import and source refresh; native HTML metadata fetch + content hashing + freshness scheduling; daily bounded source-refresh cron; and `profiles:targets-check`. Verification passed `npm run profiles:targets-check`, `npx convex codegen`, `npx tsc -p convex/tsconfig.json --noEmit`, `npx tsc --noEmit`, targeted ESLint on the new crawler files, and `git diff --check`. Production import is intentionally pending until the commit is deployed and the admin 50-target dry-run returns clean output.

## 2026-06-03 Reference-Intelligence Follow-Through

### 105. Turn the Jun 3 reference-intelligence wave into tracked You.md follow-up slices
**Status:** IN PROGRESS
**Verified:** NO
**Source:** 2026-06-03 — Houston said "continue comprehensively Highest-value follow-up tasks - then commit and push to main - then continue comprehensively" after the daily reference-intelligence run surfaced new GStack/GBrain tasks.
**Request:** Continue comprehensively by promoting the highest-value reference-intelligence follow-up tasks into concrete You.md tracking, docs/contracts, and implementation slices instead of leaving them as a flat generated queue.
**Actionable Scope:**
1. Version the fresh `project-context/reference-intelligence/LATEST.md` and `TASKS.md` outputs from the 2026-06-03 sync.
2. Distill the highest-value follow-up work across stack safety/private distribution, brain sync resilience, retrieval/readiness honesty, and runtime health/self-upgrade boundaries.
3. Write a dated audit that maps the upstream commits to explicit You.md next steps.
4. Update TODO/features/changelog/request tracking so future sessions can keep shipping the sequence instead of re-deriving it.
5. Land at least one repo-visible improvement from those highest-value tasks, then commit, push, and continue.
**Progress (2026-06-03):** Re-ran the reference loop, which produced 13 candidate tasks from GStack `c43c850` and GBrain `f09f917`..`f3ade6c`; versioned the regenerated `project-context/reference-intelligence/LATEST.md` and `TASKS.md`; added `project-context/REFERENCE_INTELLIGENCE_AUDIT_2026-06-03.md` to collapse the raw queue into four priority bands: stack safety/private distribution, brain sync resilience, retrieval/readiness honesty, and runtime health/self-upgrade boundaries; updated TODO, FEATURES, and CHANGELOG so the next implementation slices are explicit rather than buried in generated files. Followed through with a repo-visible docs/contract pass across README, `/docs#youstacks`, generated `/llms.txt` + `/llms-full.txt`, and the local/live handoff guardrails: the docs now explicitly require shell-safe adapter/helper identifiers, local-only metadata by default, honest readiness states for protected reads, and fallback-before-silence retrieval behavior. Then tightened the local runtime itself: `youstack` validation now rejects shell-unsafe `slug` and capability identifiers and warns when domain/alias/tag metadata becomes multi-line or control-character-heavy before those values flow into generated adapter files. The next slice landed stack-local readiness semantics in code: local stack CLI JSON output and MCP stack tools return an explicit readiness envelope with `not_found`, `invalid`, or `ready` instead of making agents infer state from empty payloads or plain error strings. The protected-memory follow-through now spans the broader MCP surface: `search_memories`, `youmd://memories` resources, and `get_agent_brief` memory inclusion all return or expose the same structured retrieval state (`ready`, `auth_required`, `unavailable`) plus concrete fallback guidance instead of letting auth/server failures masquerade as an empty memory set. The latest contract pass teaches the same behavior to future agents before they even call MCP: the shared stack capability contract and generated host adapters now explicitly state the protected-read readiness states and fallback order from local stack files to project-context to public identity before retrying hosted retrieval. The newer retrieval-contract fix closes a real capability gap: MCP now actually exposes the previously advertised `get_private_context` tool and `youmd://private-context` resource, both using the same readiness/fallback envelope so private-context failures stop surfacing as missing tools or ambiguous generic errors. The latest slice extends the same honesty to local project context: `get_project_context` and `youmd://projects/*` resources now return structured readiness/fallback envelopes instead of mixing raw JSON with ad hoc plain-text project errors. Local verification passed `npm --prefix cli run build`.

---

## Handoff Checker JSON Output (from Jun 2 conversation)

### 104. Add machine-readable JSON output for the agent-docs handoff checker
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_CcWeF8asBZULESwqvEKGjWYBRMmY` for commit `ee60713` completed successfully and is aliased to `https://www.you.md` / `https://you.md`; GitHub Actions run `26856413207` for `.github/workflows/agent-docs.yml` completed successfully.
**Source:** 2026-06-02 — Houston said "continue comprehensively - then commit and push to main - then continue comprehensively" after the modular agent-docs commands shipped.
**Request:** Continue improving shared agent docs/context comprehensively by making the handoff guardrail easier for agents, CI, and future automation to inspect without parsing prose.
**Actionable Scope:**
1. Add `--json` support to `scripts/check-agent-doc-handoff.mjs` with ok state, CLI version, checked files, marker counts, and failures.
2. Add `npm run agent-docs:handoff:json` as the reusable command.
3. Document and enforce the JSON command across README, root agent manuals, `/docs#agent-docs`, generated `/llms-full.txt`, local handoff markers, and live smoke expectations.
4. Run local checks, commit, push to `main`, and verify CI/deployment receipts.
**Progress (2026-06-02):** Added structured JSON output to `scripts/check-agent-doc-handoff.mjs`; added `agent-docs:handoff:json`; updated README, `AGENTS.md`, `CLAUDE.md`, `/docs#agent-docs`, generated root agent docs, handoff markers, and live smoke expectations; passed `npm run agent-docs:handoff`, `npm run agent-docs:handoff:json`, JSON parse/count assertion, `npm run agent-docs:syntax`, `npm run agent-docs:lint`, `npm run llms:check`, `npm run agent-docs:ci`, JSON command marker grep, and `git diff --check`; pushed commit `ee60713`; GitHub Actions run `26856413207` passed `Check Generated Agent Docs`; Vercel deployment `dpl_CcWeF8asBZULESwqvEKGjWYBRMmY` is Ready and aliased to `https://www.you.md` / `https://you.md`; live production `npm run llms:smoke -- --base-url https://www.you.md` passed all checks with the source-repo guardrail smoke check reporting 9 markers.

## Modular Agent Docs CI Commands (from Jun 2 conversation)

### 103. Split `agent-docs:ci` into reusable subcommands
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_BUWknQrA2KZ4J4GkQ9NKBN9iZP2H` for commit `152dd5e` completed successfully and is aliased to `https://www.you.md` / `https://you.md`; GitHub Actions run `26856191121` for `.github/workflows/agent-docs.yml` completed successfully.
**Source:** 2026-06-02 — Houston said "continue comprehensively - then commit and push to main - then continue comprehensively" after the handoff diagnostics deployment was recorded.
**Request:** Continue improving shared agent docs/context comprehensively by making the agent-docs release checks easier for future agents to run and debug.
**Actionable Scope:**
1. Split the long `npm run agent-docs:ci` command into focused syntax, handoff, and lint subcommands while keeping the umbrella command.
2. Document the modular commands in README, root agent manuals, `/docs#agent-docs`, and generated `/llms-full.txt`.
3. Extend local handoff markers and live smoke expectations so the modular commands cannot silently disappear.
4. Run local checks, commit, push to `main`, and verify CI/deployment receipts.
**Progress (2026-06-02):** Added `agent-docs:syntax`, `agent-docs:handoff`, and `agent-docs:lint`; rewired `agent-docs:ci` to call them; updated README, `AGENTS.md`, `CLAUDE.md`, `/docs#agent-docs`, generated root agent docs, handoff markers, and live smoke expectations; passed `npm run agent-docs:syntax`, `npm run agent-docs:handoff`, `npm run agent-docs:lint`, `npm run agent-docs:ci`, `npm run llms:check`, modular command marker grep, and `git diff --check`; pushed commit `152dd5e`; GitHub Actions run `26856191121` passed `Check Generated Agent Docs`; Vercel deployment `dpl_BUWknQrA2KZ4J4GkQ9NKBN9iZP2H` is Ready and aliased to `https://www.you.md` / `https://you.md`; live production `npm run llms:smoke -- --base-url https://www.you.md` passed all checks with the source-repo guardrail smoke check reporting 8 markers.

## Handoff Checker Diagnostics (from Jun 2 conversation)

### 102. Add marker-count diagnostics to the agent-docs handoff checker
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_9x5vntcS3kapiHZY9ZYQijCDzjpw` for commit `ceef051` completed successfully and is aliased to `https://www.you.md` / `https://you.md`; GitHub Actions run `26855935056` for `.github/workflows/agent-docs.yml` completed successfully.
**Source:** 2026-06-02 — continuation after local/live docs-page guardrail parity was committed and pushed.
**Request:** Continue comprehensively by making the growing agent-docs guardrail easier for future agents to understand from CI/local logs.
**Actionable Scope:**
1. Update `scripts/check-agent-doc-handoff.mjs` success output to report checked file count.
2. Report required marker count and forbidden stale-marker count in the same success output.
3. Run local checks, commit, push to `main`, and verify CI/deployment receipts.
**Progress (2026-06-02):** Added file, required-marker, and forbidden-marker counters to the handoff checker success output; passed direct `node scripts/check-agent-doc-handoff.mjs`, `npm run agent-docs:ci`, and `git diff --check`; pushed commit `ceef051`; GitHub Actions run `26855935056` passed `Check Generated Agent Docs`; Vercel deployment `dpl_9x5vntcS3kapiHZY9ZYQijCDzjpw` is Ready and aliased to `https://www.you.md` / `https://you.md`; live production `npm run llms:smoke -- --base-url https://www.you.md` passed all checks.

## Docs Page Local Guardrail Parity (from Jun 2 conversation)

### 101. Make the local handoff checker enforce expanded `/docs#agent-docs` wording
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_7RTHaMrQWf4ieQhmEgTbA171BehM` for commit `ed7facd` completed successfully and is aliased to `https://www.you.md` / `https://you.md`; GitHub Actions run `26855772471` for `.github/workflows/agent-docs.yml` completed successfully.
**Source:** 2026-06-02 — continuation after the live smoke marker output split shipped.
**Request:** Continue improving shared agent docs/context comprehensively by closing the next local-vs-production guardrail gap before committing and pushing to `main`.
**Actionable Scope:**
1. Require `scripts/check-agent-doc-handoff.mjs` to verify `/docs#agent-docs` mentions the expanded PRD/architecture source scope.
2. Require the local checker to verify `/docs#agent-docs` mentions stale stack/auth language rejection.
3. Require the local checker to verify `/docs#agent-docs` mentions required/forbidden marker checks.
4. Run local checks, commit, push to `main`, and verify CI/deployment receipts.
**Progress (2026-06-02):** Added the expanded `/docs#agent-docs` marker expectations to `scripts/check-agent-doc-handoff.mjs`; passed `npm run agent-docs:ci`, direct `node scripts/check-agent-doc-handoff.mjs`, expanded marker grep, and `git diff --check`; pushed commit `ed7facd`; GitHub Actions run `26855772471` passed `Check Generated Agent Docs`; Vercel deployment `dpl_7RTHaMrQWf4ieQhmEgTbA171BehM` is Ready and aliased to `https://www.you.md` / `https://you.md`; live production `npm run llms:smoke -- --base-url https://www.you.md` passed all checks.

## Agent Docs Smoke Output Clarity (from Jun 2 conversation)

### 100. Split source-repo guardrail markers into their own smoke check
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_ET95xLFTzNAF8EnfRTkmcWjzrCGc` for commit `c8d139b` completed successfully and is aliased to `https://www.you.md` / `https://you.md`; GitHub Actions run `26853813606` for `.github/workflows/agent-docs.yml` completed successfully.
**Source:** 2026-06-02 — continuation after the expanded public handoff guardrail wording shipped.
**Request:** Continue improving agent-docs verification so failed live smoke output points future agents to the exact class of drift.
**Actionable Scope:**
1. Keep workflow/privacy/upstream markers in their own `/llms-full.txt` smoke check.
2. Move source-repo guardrail wording markers into a separate `/llms-full.txt` smoke check.
3. Run local checks, commit, push to `main`, and verify deployment receipts.
**Progress (2026-06-02):** Split `scripts/smoke-agent-docs.mjs` so `/llms-full.txt` source-repo guardrail wording is checked separately from workflow/privacy/upstream markers; passed `npm run agent-docs:ci`, `node scripts/smoke-agent-docs.mjs --base-url https://www.you.md`, `node --check scripts/smoke-agent-docs.mjs`, and `git diff --check`; pushed commit `c8d139b`; GitHub Actions run `26853813606` passed `Check Generated Agent Docs`; Vercel deployment `dpl_ET95xLFTzNAF8EnfRTkmcWjzrCGc` is Ready and aliased to `https://www.you.md` / `https://you.md`; live production `npm run llms:smoke -- --base-url https://www.you.md` passed with separate workflow/privacy/upstream and source-repo guardrail marker checks.

## Public Agent Docs Guardrail Wording (from Jun 2 conversation)

### 99. Publish the expanded handoff-checker scope in generated and web docs
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_6Y696yy1PZyoCQ1Efy38Y7MBvRbe` for commit `930bd36` completed successfully and is aliased to `https://www.you.md` / `https://you.md`; GitHub Actions run `26853627596` for `.github/workflows/agent-docs.yml` completed successfully.
**Source:** 2026-06-02 — continuation after the forbidden stale-marker guardrail was committed and pushed.
**Request:** Continue comprehensively by ensuring the public agent-facing docs describe the expanded source-repo guardrail accurately.
**Actionable Scope:**
1. Update the root agent-docs generator so `/llms-full.txt` explains that `scripts/check-agent-doc-handoff.mjs` covers README, root manuals, `/docs` source, PRD, architecture docs, and stale stack/auth language.
2. Update `/docs#agent-docs` command copy with the same expanded required/forbidden marker scope.
3. Extend `scripts/smoke-agent-docs.mjs` so live production smoke verifies the expanded wording in `/llms-full.txt` and `/docs`.
4. Regenerate root agent docs, run local checks, commit, push to `main`, and verify deployment receipts.
**Progress (2026-06-02):** Updated `scripts/generate-llms-docs.mjs`, `src/app/(app)/docs/docs-content.tsx`, and `scripts/smoke-agent-docs.mjs`; regenerated `public/llms.txt` and `public/llms-full.txt`; passed `npm run agent-docs:ci`, `npm run llms:check`, expanded wording marker grep, and `git diff --check`; pushed commit `930bd36`; GitHub Actions run `26853627596` passed `Check Generated Agent Docs`; Vercel deployment `dpl_6Y696yy1PZyoCQ1Efy38Y7MBvRbe` is Ready and aliased to `https://www.you.md` / `https://you.md`; live production `npm run llms:smoke -- --base-url https://www.you.md` passed the expanded wording checks.

## Forbidden Stale Handoff Markers (from Jun 2 conversation)

### 98. Make the agent-docs checker reject stale stack/auth language
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_HwHPUDBVWf3ayk6fdPvT4csAqnBe` for commit `ed0d62a` completed successfully and is aliased to `https://www.you.md` / `https://you.md`; GitHub Actions run `26853454878` for `.github/workflows/agent-docs.yml` completed successfully.
**Source:** 2026-06-02 — Houston said "continue comprehensively - then commit and push to main - then continue comprehensively" after the active auth architecture cleanup was deployed.
**Request:** Continue hardening shared agent docs/context so future docs can fail CI not only when good handoff markers disappear, but also when obsolete stack/auth claims reappear.
**Actionable Scope:**
1. Extend `scripts/check-agent-doc-handoff.mjs` with per-file forbidden marker checks.
2. Forbid stale Next 16.1.6, Framer Motion naming, Clerk auth stack, Prod Clerk, and Clerk Backend API language in root `AGENTS.md` and `CLAUDE.md`.
3. Forbid stale Clerk-era auth-flow, user-table, route, and external-services markers in active `project-context/ARCHITECTURE.md`.
4. Forbid stale `users (1:1 Clerk)` PRD relationship language.
5. Run local checks, commit, push to `main`, and verify deployment receipts.
**Progress (2026-06-02):** Added `forbiddenMarkers` support to `scripts/check-agent-doc-handoff.mjs`; configured stale stack/auth forbidden markers for root manuals plus active architecture/PRD docs; passed `npm run agent-docs:ci`, direct `node scripts/check-agent-doc-handoff.mjs`, forbidden stale-marker grep, and `git diff --check`; pushed commit `ed0d62a`; GitHub Actions run `26853454878` passed `Check Generated Agent Docs`; Vercel deployment `dpl_HwHPUDBVWf3ayk6fdPvT4csAqnBe` is Ready and aliased to `https://www.you.md` / `https://you.md`; live production `npm run llms:smoke -- --base-url https://www.you.md` passed all checks.

## Architecture Auth Source-Of-Truth Cleanup (from Jun 2 conversation)

### 97. Remove stale Clerk-era auth language from active PRD/architecture docs
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_4DtvTt6comrhxsy7mkPFisPtA1BF` for commit `bb73faa` completed successfully and is aliased to `https://www.you.md` / `https://you.md`; GitHub Actions run `26853267125` for `.github/workflows/agent-docs.yml` completed successfully.
**Source:** 2026-06-02 — continuation of Houston's request to keep improving shared agent docs/context comprehensively after committing and pushing to `main`.
**Request:** Continue improving project-context source-of-truth docs so future agents see the current first-party passwordless auth architecture instead of obsolete Clerk-era language.
**Actionable Scope:**
1. Update `project-context/ARCHITECTURE.md` external-services, data-model, auth-flow, and route descriptions to use first-party passwordless auth language.
2. Update `project-context/PRD.md` data-model relationships to describe first-party auth subjects.
3. Extend `scripts/check-agent-doc-handoff.mjs` so active PRD/architecture auth markers are checked locally.
4. Expand `.github/workflows/agent-docs.yml` path filters so PRD/architecture edits trigger the guardrail.
5. Run local checks, commit, push to `main`, and verify the deployment receipts.
**Progress (2026-06-02):** Updated active architecture/PRD auth docs away from stale Clerk-era provider wording while keeping the legacy `clerkId` schema field name honest as a compatibility subject key; added PRD/architecture auth markers to the handoff checker; added `project-context/ARCHITECTURE.md` and `project-context/PRD.md` to the agent-docs workflow path filters; passed `npm run agent-docs:ci`, workflow path marker check, stale architecture/PRD Clerk-era grep, and `git diff --check`; pushed commit `bb73faa`; GitHub Actions run `26853267125` passed `Check Generated Agent Docs`; Vercel deployment `dpl_4DtvTt6comrhxsy7mkPFisPtA1BF` is Ready and aliased to `https://www.you.md` / `https://you.md`; live production `npm run llms:smoke -- --base-url https://www.you.md` passed all checks.

## Root Manual Stack Truth Guardrail (from Jun 2 conversation)

### 96. Align root agent manuals with current app stack and first-party auth
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_3xHhPeCq4za3oSHGbN7xX5Y3nujs` for commit `8bf8c18` completed successfully and is aliased to `https://www.you.md` / `https://you.md`; GitHub Actions run `26853067906` for `.github/workflows/agent-docs.yml` completed successfully.
**Source:** 2026-06-02 — continuation of Houston's request to keep improving shared agent docs/context comprehensively after committing and pushing to `main`.
**Request:** Continue improving repo-visible agent context by removing stale stack/auth claims from root manuals and making local CI catch future drift.
**Actionable Scope:**
1. Update `AGENTS.md` and `CLAUDE.md` to match current `package.json` app dependency versions for Next, React, Motion, and Convex.
2. Replace stale Clerk auth rows with first-party passwordless web sessions, email-code CLI login, signed cookies/JWKS, and scoped API keys.
3. Extend `scripts/check-agent-doc-handoff.mjs` so root manual stack markers are derived from package metadata where possible.
4. Run local checks, commit, push to `main`, and verify the deployment receipts.
**Progress (2026-06-02):** Updated root manuals from Next `16.1.6` to `16.2.2`, from Framer Motion wording to the installed `motion` package, and from stale Clerk rows to first-party passwordless auth rows; extended the handoff checker to derive Next/React/Motion/Convex versions from `package.json` and require the active auth/JWKS rows; passed `npm run agent-docs:ci`, stale root-manual grep for `Clerk` / `16.1.6` / `Framer Motion`, and `git diff --check`; pushed commit `8bf8c18`; GitHub Actions run `26853067906` passed `Check Generated Agent Docs`; Vercel deployment `dpl_3xHhPeCq4za3oSHGbN7xX5Y3nujs` is Ready and aliased to `https://www.you.md` / `https://you.md`; live production `npm run llms:smoke -- --base-url https://www.you.md` passed all checks.

## Dynamic Handoff CLI Version Guardrail (from Jun 2 conversation)

### 95. Derive root agent-manual CLI version checks from `cli/package.json`
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_Phut9JEZc3ZuhhPi3mfXZ2FX9Umx` for commit `51cdc32` completed successfully and is aliased to `https://www.you.md` / `https://you.md`; GitHub Actions run `26852875154` for `.github/workflows/agent-docs.yml` completed successfully.
**Source:** 2026-06-02 — Houston said "continue comprehensively - then commit and push to main - then continue comprehensively" after the local docs-page handoff guardrail shipped.
**Request:** Continue improving the shared agent docs/context layer by making the local handoff marker guardrail stay current when the CLI package version changes.
**Actionable Scope:**
1. Update `scripts/check-agent-doc-handoff.mjs` so it reads the current CLI version from `cli/package.json`.
2. Require root `AGENTS.md` and `CLAUDE.md` to include both the current `youmd X.Y.Z` stack row and `CLI package (npm: youmd, vX.Y.Z)` project-structure row.
3. Correct stale project-context architecture references for the CLI package version.
4. Run local checks, commit, push to `main`, and verify the resulting CI/deployment receipts.
**Progress (2026-06-02):** Updated the handoff checker to derive `youmd 0.6.23` / `CLI package (npm: youmd, v0.6.23)` markers from `cli/package.json`; corrected `project-context/ARCHITECTURE.md` from `v0.5.0` to `v0.6.23`; passed `npm run agent-docs:ci`, direct `node scripts/check-agent-doc-handoff.mjs`, and `git diff --check`; pushed commit `51cdc32`; GitHub Actions run `26852875154` passed `Check Generated Agent Docs`; Vercel deployment `dpl_Phut9JEZc3ZuhhPi3mfXZ2FX9Umx` is Ready and aliased to `https://www.you.md` / `https://you.md`; live production `npm run llms:smoke -- --base-url https://www.you.md` passed all checks.

## Local Handoff Marker Coverage For Docs Page (from Jun 2 conversation)

### 94. Extend local handoff marker checks to `/docs#agent-docs`
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_6x8AA2W56JepwY8zN4CQNJNbASaW` for commit `1e3e57e` completed successfully and is aliased to `https://www.you.md` / `https://you.md`; GitHub Actions run `26852593769` for `.github/workflows/agent-docs.yml` completed successfully.
**Source:** 2026-06-02 — continuation after `/docs#agent-docs` shipped the source-repo handoff commands.
**Request:** Continue comprehensively by making the local CI guardrail catch docs-page handoff drift before a deploy or production smoke.
**Actionable Scope:**
1. Extend `scripts/check-agent-doc-handoff.mjs` to check `src/app/(app)/docs/docs-content.tsx`.
2. Require the docs page source to keep the root docs URLs, docs reference, OpenAPI, MCP discovery, stack capabilities, README/AGENTS/CLAUDE handoff row, handoff marker script, and `agent-docs:ci`.
3. Run local CI, commit, push to `main`, and production-smoke.
**Progress (2026-06-02):** Added the docs page source to `scripts/check-agent-doc-handoff.mjs` marker coverage; passed `npm run agent-docs:ci`, direct `node scripts/check-agent-doc-handoff.mjs`, and `git diff --check`; pushed commit `1e3e57e`; GitHub Actions run `26852593769` passed `Check Generated Agent Docs`; Vercel deployment `dpl_6x8AA2W56JepwY8zN4CQNJNbASaW` is Ready and aliased to `https://www.you.md` / `https://you.md`; live production `npm run llms:smoke -- --base-url https://www.you.md` passed all checks.

## Docs Page Source Repo Handoff (from Jun 2 conversation)

### 93. Bring `/docs#agent-docs` up to the source-repo handoff standard
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_5vKbdeCp1k9Lfj2ZsyroUc5538N9` for commit `b8c91b3` completed successfully and is aliased to `https://www.you.md` / `https://you.md`; GitHub Actions run `26852409585` for `.github/workflows/agent-docs.yml` completed successfully.
**Source:** 2026-06-02 — Houston said "continue comprehensively - then commit and push to main - then continue comprehensively" after generated root docs learned the source-repo handoff.
**Request:** Continue comprehensively by keeping the web docs page aligned with the generated root agent docs, README, and root agent manuals.
**Actionable Scope:**
1. Update `/docs#agent-docs` to explain README, `AGENTS.md`, and `CLAUDE.md` as repo-visible handoff surfaces.
2. Add the handoff marker script and full `agent-docs:ci` command to the docs page.
3. Extend production smoke checks so `/docs` must include those source-repo handoff markers.
4. Verify locally, commit, push to `main`, and production-smoke after Vercel deploys.
**Progress (2026-06-02):** Updated `src/app/(app)/docs/docs-content.tsx` so `/docs#agent-docs` documents README/root agent manuals, the handoff marker script, and `agent-docs:ci`; updated `scripts/smoke-agent-docs.mjs` so live docs-page smoke checks require those markers; passed local `npm run agent-docs:ci`, targeted ESLint for docs content and smoke script, and `git diff --check`; pushed commit `b8c91b3`; GitHub Actions run `26852409585` passed `Check Generated Agent Docs`; Vercel deployment `dpl_5vKbdeCp1k9Lfj2ZsyroUc5538N9` is Ready and aliased to `https://www.you.md` / `https://you.md`; live production `npm run llms:smoke -- --base-url https://www.you.md` passed the strengthened docs-page handoff checks.

## Generated Source Repo Handoff In Root Agent Docs (from Jun 2 conversation)

### 92. Teach generated root agent docs about README/AGENTS/CLAUDE handoff surfaces
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_JCuw4fjSbkASm31i6iywADTLTEog` for commit `76f3075` completed successfully and is aliased to `https://www.you.md` / `https://you.md`; GitHub Actions run `26850743219` for `.github/workflows/agent-docs.yml` completed successfully.
**Source:** 2026-06-02 — Houston said "commit and push to main - then continue" after the handoff-marker CI guardrail shipped.
**Request:** Continue improving the shared agent docs/context layer so generated root agent docs also explain the repo-visible README, `AGENTS.md`, and `CLAUDE.md` handoff path that future coding agents should use.
**Actionable Scope:**
1. Update the `llms.txt` / `llms-full.txt` generator to include source-repo handoff guidance.
2. Regenerate `public/llms.txt` and `public/llms-full.txt`.
3. Update live smoke checks so the source-repo handoff markers are production-verified.
4. Run docs checks, commit, push to `main`, and production-smoke.
**Progress (2026-06-02):** Updated `scripts/generate-llms-docs.mjs` to mention the source repo, README "For Agents", root `AGENTS.md`/`CLAUDE.md`, the agent-docs workflow, and the handoff marker script; updated `scripts/smoke-agent-docs.mjs` to verify those markers; regenerated `public/llms.txt` and `public/llms-full.txt`; passed local `npm run agent-docs:ci` and `git diff --check`; pushed commit `76f3075`; GitHub Actions run `26850743219` passed `Check Generated Agent Docs`; Vercel deployment `dpl_JCuw4fjSbkASm31i6iywADTLTEog` is Ready and aliased to `https://www.you.md` / `https://you.md`; upgraded live production `npm run llms:smoke -- --base-url https://www.you.md` passed all source-repo handoff checks.

## Agent Docs Handoff CI Coverage (from Jun 2 conversation)

### 91. Guard README and root agent-manual generated-doc handoffs in CI
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_DX4g1vvZShDE3BaAxprMVhMfpiiw` for commit `2917ea6` completed successfully and is aliased to `https://www.you.md` / `https://you.md`; GitHub Actions run `26850497617` for `.github/workflows/agent-docs.yml` completed successfully.
**Source:** 2026-06-02 — Houston said "commit and push to main - then continue" after the agent-manual docs preflight shipped.
**Request:** Keep improving the shared agent docs/context layer by ensuring repo-visible handoff surfaces do not drift or disappear after they were added to README, `AGENTS.md`, and `CLAUDE.md`.
**Actionable Scope:**
1. Add a CI check that asserts README, `AGENTS.md`, and `CLAUDE.md` contain the generated-doc URLs and release-check commands.
2. Wire that check into `npm run agent-docs:ci`.
3. Expand `.github/workflows/agent-docs.yml` path filters so README and root agent manuals trigger the workflow.
4. Verify locally, commit, push to `main`, and production-smoke the resulting deployment.
**Progress (2026-06-02):** Added `scripts/check-agent-doc-handoff.mjs`, wired it into `npm run agent-docs:ci`, and added README/root agent manuals plus the new script to the agent-docs workflow path filters; passed local `npm run agent-docs:ci`, workflow path marker check, and `git diff --check`; pushed commit `2917ea6`; GitHub Actions run `26850497617` passed `Check Generated Agent Docs`; Vercel deployment `dpl_DX4g1vvZShDE3BaAxprMVhMfpiiw` is Ready and aliased to `https://www.you.md` / `https://you.md`; live production `npm run llms:smoke -- --base-url https://www.you.md` passed all checks.

## Agent Manual Generated Docs Preflight (from Jun 2 conversation)

### 90. Add generated-docs preflight to root agent manuals
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_BVdXiSU1uUBEJppmbJvLV79F4YTa` for commit `98683a5` completed successfully and is aliased to `https://www.you.md` / `https://you.md`.
**Source:** 2026-06-02 — follow-on from Houston's "commit and push to main - then continue" request after the README handoff shipped.
**Request:** Keep improving shared agent scripts/skills/context by making repo-visible coding-agent manuals route future agents through the generated You.md docs/API/MCP/stack surfaces before they change product contracts.
**Actionable Scope:**
1. Add an Agent Docs Preflight section to `AGENTS.md` and `CLAUDE.md`.
2. Point future agents to `/llms.txt`, `/llms-full.txt`, docs reference, OpenAPI, MCP discovery, and stack capabilities.
3. Add the docs drift and live smoke commands to the manuals.
4. Correct stale CLI version references in the manuals.
5. Verify, commit, push, and production-smoke the final deployment.
**Progress (2026-06-02):** Added the generated-docs preflight blocks to `AGENTS.md` and `CLAUDE.md`; updated the CLI version references from `0.4.9` / `0.5.0` to `0.6.23`; passed `npm run agent-docs:ci`, `git diff --check`, and manual grep checks for stale version strings plus the new preflight sections; pushed commit `98683a5`; Vercel deployment `dpl_BVdXiSU1uUBEJppmbJvLV79F4YTa` is Ready and aliased to `https://www.you.md` / `https://you.md`; live production `npm run llms:smoke -- --base-url https://www.you.md` passed all checks.

## README Agent Docs Handoff (from Jun 2 conversation)

### 89. Make source-repo readers discover generated agent docs and release checks
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_9BGpnTgiBMLLDGoNsWvfkdhtTDLY` for commit `69d1102` completed successfully and is aliased to `https://www.you.md` / `https://you.md`.
**Source:** 2026-06-02 — Houston said "commit and push to main - then continue" after the agent-docs CI guardrail shipped.
**Request:** Keep pushing the shared agent docs/context layer by making GitHub/npm/source readers and future agents quickly find the live generated docs, API/MCP surfaces, stack capabilities, and release checks.
**Actionable Scope:**
1. Add a concise README section for agents that points to `/llms.txt`, `/llms-full.txt`, docs reference, OpenAPI, MCP discovery, and stack capabilities.
2. Add the local/production agent-docs verification commands to README.
3. Correct stale README development port guidance for the frontend dev server.
4. Run docs drift checks and live smoke checks before committing.
5. Commit, push to `main`, and verify the resulting Vercel deployment.
**Progress (2026-06-02):** Added a README "For Agents" handoff with the generated live docs/API/MCP/stack URLs and the `docs:check`, `llms:smoke`, and `agent-docs:ci` release commands; corrected the frontend dev port from 3000 to 3100; passed local `npm run agent-docs:ci`, live `npm run llms:smoke -- --base-url https://www.you.md`, and `git diff --check`; pushed commit `69d1102`; Vercel deployment `dpl_9BGpnTgiBMLLDGoNsWvfkdhtTDLY` is Ready and aliased to `https://www.you.md` / `https://you.md`; live production `npm run llms:smoke -- --base-url https://www.you.md` passed all checks.

## Agent Docs CI Guardrail (from Jun 2 conversation)

### 88. Add CI guardrail for generated agent docs drift
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_6GAWESCyK3kYEhWuviYppbhGoMD8` for commit `eaed7be` completed successfully and is aliased to `https://www.you.md` / `https://you.md`; GitHub Actions run `26849731544` for `.github/workflows/agent-docs.yml` completed successfully.
**Source:** 2026-06-02 — Houston said "commit and push to main - then continue" after the live/local agent-docs smoke command shipped.
**Request:** Ensure pending work is committed and pushed to `main`, then continue improving the shared agent docs/context layer with stronger guardrails.
**Actionable Scope:**
1. Confirm `main` is clean and already pushed before continuing.
2. Add a reusable CI command for generated agent docs checks.
3. Add a GitHub Actions workflow that runs on agent-docs-related changes.
4. Verify the new CI command and workflow syntax locally.
5. Commit, push to `main`, and production/CI-status check after deployment.
**Progress (2026-06-02):** Confirmed `main` matched `origin/main` at `ee9aae3`, added `npm run agent-docs:ci`, added `.github/workflows/agent-docs.yml` with path-scoped push/PR/manual triggers for agent-docs source files, and passed local `npm run agent-docs:ci`, YAML parse, and `git diff --check`. Production/deployment verification passed on Vercel deployment `dpl_6GAWESCyK3kYEhWuviYppbhGoMD8`; live `npm run llms:smoke -- --base-url https://www.you.md` passed all checks; GitHub Actions run `26849731544` passed `Check Generated Agent Docs`.

## Agent Docs Smoke Automation (from Jun 2 conversation)

### 87. Add reusable live/local smoke checks for root agent docs
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_5z5yoHXRThajMiMG2YojwYyc61Am` for commit `1c66b8e` completed successfully and is aliased to `https://www.you.md` / `https://you.md`.
**Source:** 2026-06-02 — Houston said "continue improving" after the generated root agent docs pipeline shipped.
**Request:** Keep improving the shared agent docs/context layer by making the new root agent docs easier to verify locally, in production, and from future automations.
**Actionable Scope:**
1. Add a reusable smoke script for `/llms.txt`, `/llms-full.txt`, docs reference, MCP discovery, robots, sitemap, and `/docs#agent-docs`.
2. Compare live root agent docs against the generated docs reference source hash, CLI version, endpoint count, and MCP tool count.
3. Expose the command through `package.json`.
4. Add the smoke command to `/docs#agent-docs` and the generated full agent context.
5. Verify against production and localhost, then commit, push, deploy, and production-smoke.
**Progress (2026-06-02):** Added `scripts/smoke-agent-docs.mjs`, wired `npm run llms:smoke`, updated the generated full agent context and `/docs#agent-docs` to include the release smoke command, regenerated root agent docs, and passed production smoke on `https://www.you.md`, local smoke on `http://localhost:3100`, docs generation/checks, targeted ESLint, TypeScript, ASCII scan, and `git diff --check`. Production verification passed on deployment `dpl_5z5yoHXRThajMiMG2YojwYyc61Am`: `npm run llms:smoke -- --base-url https://www.you.md` checks docs reference JSON, root agent docs, source hash/count alignment, MCP discovery, robots, sitemap, and docs-page command markers.

## Generated Agent Docs Pipeline (from Jun 2 conversation)

### 86. Make root agent docs generated and drift-checked
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_J5wdK3PHkCED8ZoFyW7bFvRYNtqT` for commit `a00bc1f` completed successfully and is aliased to `https://www.you.md` / `https://you.md`.
**Source:** 2026-06-02 — Houston said "continue comprehensively" after the root `llms.txt` / `llms-full.txt` surfaces shipped.
**Request:** Continue the shared agent docs/context improvements comprehensively by making the newly added agent-readable docs easier to maintain, more robust, and less likely to drift from shipped routes, MCP tools, CLI metadata, and upstream reference intelligence.
**Actionable Scope:**
1. Add a generator for `public/llms.txt` and `public/llms-full.txt`.
2. Add `llms:generate` and `llms:check` scripts.
3. Wire `docs:generate`, `docs:check`, and `prebuild` so root agent docs are regenerated/checked with the existing docs reference path.
4. Pull concrete endpoint/tool counts, docs/MCP/YouStacks/schema/public-profile endpoints, CLI version, source hash, and upstream reference heads into the generated files.
5. Refresh reference-intelligence artifacts and confirm no new upstream task candidates.
6. Update `/docs#agent-docs` so maintainers know the root agent files are generated.
7. Verify docs generation/checks, TypeScript, targeted lint, ASCII safety, local HTTP smoke, then commit/push/deploy and production-smoke.
**Progress (2026-06-02):** Added `scripts/generate-llms-docs.mjs`, wired `npm run llms:generate` and `npm run llms:check`, connected root agent docs to `docs:generate`/`docs:check`, refreshed the reference-intelligence artifacts with no new task candidates, improved generated docs-reference summaries for OpenAPI and schema routes, regenerated `src/generated/*`, `public/llms.txt`, and `public/llms-full.txt`, and passed local docs checks, TypeScript, targeted ESLint, ASCII scan, `git diff --check`, and local HTTP smoke on `http://localhost:3100`. Production verification passed on deployment `dpl_J5wdK3PHkCED8ZoFyW7bFvRYNtqT`: live `/llms.txt` includes generated source hash, CLI version, route/tool counts, and reference-intelligence markers; `/llms-full.txt` includes generated endpoint/tool/upstream sections; `/docs` includes `llms:check` / `llms:generate`; `robots.txt` and `sitemap.xml` still expose the root docs.

## Agent-Readable Docs Surfaces (from Jun 2 conversation)

### 85. Add root-level `llms.txt` / `llms-full.txt` agent context surfaces
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_GcSaYeSrzo1JRaqVa9MAyMr4J2VY` for commit `0bec57c` completed successfully and is aliased to `https://www.you.md` / `https://you.md`.
**Source:** 2026-06-02 — Houston said "ok lets do it - keep rocking and pushing forward hard" after the next-step plan to make You.md easier for agents to discover and consume.
**Request:** Continue pushing the API/MCP/stack docs and shared agent-context strategy forward by adding machine-friendly, root-level docs that help agents understand You.md quickly and route into the right docs/API/MCP/YouStack surfaces.
**Actionable Scope:**
1. Add `/llms.txt` as the short agent-readable index for You.md.
2. Add `/llms-full.txt` as the full plain-text agent context pack for docs, API, MCP, runtime, stacks, smoke checks, and upstream reference intelligence.
3. Wire the new surfaces into `/docs`, `robots.txt`, and `sitemap.xml` so agents and crawlers can discover them.
4. Verify local serving, docs markers, robots, sitemap, docs reference freshness, TypeScript, targeted ESLint, and whitespace checks.
5. Commit, push to `main`, and production-smoke the live URLs after Vercel deploys.
**Progress (2026-06-02):** Added static `public/llms.txt` and `public/llms-full.txt`, added a `/docs#agent-docs` section with agent preflight commands, allowed the new docs/reference paths in robots, added the root docs to the sitemap, and passed local docs check, TypeScript, targeted ESLint, `git diff --check`, and local HTTP smoke on `http://localhost:3100`. Production verification passed on deployment `dpl_GcSaYeSrzo1JRaqVa9MAyMr4J2VY`: live `/llms.txt` returns 200 with expected docs/stack/reference-intelligence markers, `/llms-full.txt` includes agent order of operations, YouStacks, smoke checks, and privacy/trust markers, `/docs` includes Agent Docs plus the new GET rows, `robots.txt` allows the new docs/reference paths, and `sitemap.xml` includes both root docs files.

## Codex Chat Hygiene (from Jun 2 conversation)

### 84. Consolidate automation chats and preserve useful context
**Status:** DONE
**Verified:** NO
**Production Verified:** N/A
**Source:** 2026-06-02 — Houston noticed recurring daily Codex automations burying active You.md work chats and asked for a project-specific and global strategy for managing chat sprawl without losing useful context.
**Request:** Keep automation-created Codex chats from burying real active work; consolidate or remove recurring automation threads in a way that preserves the useful context; apply the thinking specifically to You.md and generally across Codex projects.
**Actionable Scope:**
1. Inspect local Codex automations and identify duplicate recurring jobs.
2. Pause overlapping You.md automation schedules so daily reference intelligence runs through one canonical job.
3. Preserve a durable digest/index of archived automation transcript paths and the intended global chat-hygiene policy.
4. Archive completed automation threads from the active You.md sidebar without deleting their transcript files.
5. Update project-context tracking so future agents keep automation output in durable project files and automation memory.
**Progress (2026-06-02):** Paused duplicate automation `daily-gstack-gbrain-reference-intelligence`, kept `daily-gstack-gbrain-reference-sync` active as the single daily 8:30 AM reference-intelligence job, added `project-context/CODEX_CHAT_HYGIENE.md`, and then performed the harder cleanup after the sidebar still showed daily runs: moved matching automation JSONL transcripts from `~/.codex/sessions` into `~/.codex/archived_sessions`, set all 14 matching You.md daily-reference threads to `archived=1`, removed 13 daily-reference rows from `session_index.jsonl`, added `scripts/codex-chat-hygiene.mjs` / `npm run codex:chat-hygiene`, and updated the active automation prompt to run the hygiene command before future syncs.

## Reference Intelligence Artifact Versioning (from Jun 2 conversation)

### 83. Always version refreshed reference-intelligence artifacts and session context
**Status:** DONE
**Verified:** NO
**Production Verified:** N/A
**Source:** 2026-06-02 — Houston request during the daily reference-intelligence review to always check in refreshed reference artifacts, commit anything completed in the chat, and push it to `main`.
**Request:** Treat refreshed `project-context/reference-intelligence/*` files as versioned daily artifacts; capture the completed session context in the project trackers; commit and push the resulting changes.
**Actionable Scope:**
1. Run `npm run references:sync` and keep the generated `LATEST.md` / `TASKS.md` changes in git when they refresh.
2. Update the project-context trackers to record what this session completed and that this daily artifact versioning behavior is expected going forward.
3. Archive Houston's exact prompts from this session into `project-context/PROMPTS.md`.
4. Commit the generated artifacts plus session-context updates and push `main`.
**Progress (2026-06-02):** Re-ran the local reference-intelligence loop, regenerated `project-context/reference-intelligence/LATEST.md` and `TASKS.md`, confirmed the current sync produced no candidate tasks, archived this session's prompts from the Codex session log, updated the project-context trackers, and pushed the resulting commits to `origin/main`.

## Agent Stack Upstream Monitoring (from Jun 1 conversation)

### 82. Make homepage minimal and upgrade docs to BAMF-style API/MCP/stack standard
**Status:** IN PROGRESS
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_7rodpWtQzYwZSqtfdPZTY95hsu9k` for commit `3e2c83b` completed successfully and is aliased to `https://www.you.md` / `https://you.md`.
**Source:** 2026-06-01 — Houston request to continue improvements, keep homepage simple/minimal, make docs robust, follow the higher-standard BAMF.ai API/MCP/stack docs setup/layout, test, commit, and push to main.
**Request:** Ensure the product looks and works amazingly; keep the homepage simple, clear, and minimal; upgrade docs design/structure to match the BAMF docs standard for API/MCP/stack docs; keep identifying and applying improvements; test, commit, and push to main.
**Actionable Scope:**
1. Keep the homepage reduced to the core hero/CTA path instead of section sprawl.
2. Rework `/docs` around start, API, MCP, local stack runtime, agent workflows, examples, and generated reference surfaces.
3. Add an explicit docs/API/MCP/stack standard so every capability has a guide, API contract, MCP surface where needed, local stack path, and smoke check.
4. Carry Agent Scripts and The Library into the public docs reference loop alongside GStack/GBrain.
5. Verify docs reference freshness, targeted lint, TypeScript, local page rendering, protected-route redirect behavior, MCP discovery, and redirect sanitizer behavior.
6. Commit bisected changes and push `main`.
**Progress (2026-06-01):** Local pass upgraded `/docs` with a BAMF-inspired docs map, generated reference stats near the top, an explicit API/MCP/Stack Standard, expanded reference-intelligence language for GStack, GBrain, Agent Scripts, and The Library, and stricter terminal-native docs styling. Homepage remains simplified to Hero + CTA/footer. Local verification passed `npm run docs:check`, `npx tsc --noEmit`, targeted ESLint on touched files, `git diff --check`, local `http://localhost:3100/` and `/docs` 200 smoke, `/shell` redirect to `/sign-in?next=%2Fshell`, `.well-known/mcp.json`, and direct `sanitizeNextPath` checks. Production verification passed on deployment `dpl_7rodpWtQzYwZSqtfdPZTY95hsu9k`: live `/` and `/docs` return 200, docs include the new surface map/API-MCP-stack standard/upstream markers, `/shell` redirects to `/sign-in?next=%2Fshell`, `/.well-known/mcp.json` responds, and `/api/v1/docs/reference` reports 68 endpoints plus 23 MCP tools. Full repo ESLint still fails on pre-existing ignored reference-repo and React Compiler issues; local `npm run build` still hangs in the Next 16 build worker after docs generation under Node 22, while Vercel production build succeeds.

### 81. Add Agent Scripts and The Library to You.md's core upstream reference loop
**Status:** IN PROGRESS
**Verified:** NO
**Production Verified:** NO
**Source:** 2026-06-01 — Houston request to use `steipete/agent-scripts` and keep it, `disler/the-library`, GStack, and GBrain monitored as core inspiration for You.md shared skills/scripts/context.
**Request:** Make shared agent skills, scripts, prompts, context, memory, preferences, source catalogs, and cross-agent stack distribution a first-class You.md product goal; monitor `agent-scripts` and `the-library` alongside GStack/GBrain; audit current You.md gaps; add README credits and open-source/product-boundary direction.
**Actionable Scope:**
1. Add `steipete/agent-scripts` and `disler/the-library` to the local upstream reference monitor.
2. Update project-context docs so You.md treats shared skills/scripts/prompts/context/memory/preferences/catalogs as core platform architecture.
3. Audit what You.md already has and what should improve for elegance, simplicity, onboarding, stack catalogs, typed dependencies, and source-of-truth sync.
4. Update `youstack-start` / `youstack-maintainer` guidance so host agents use upstream lessons when improving stacks.
5. Add README hat-tip credits and clarify the mostly-open-source plus hosted/protected-service boundary.
6. Retarget the daily Codex reference automation to summarize all monitored upstreams, not only GStack/GBrain.
**Progress (2026-06-01):** Added the two repos to `scripts/reference-intelligence.mjs`; generated local ignored clones under `.reference-repos/steipete/agent-scripts` and `.reference-repos/disler/the-library`; updated `REFERENCE_INTELLIGENCE.md`, `YOUSTACKS_PRODUCT_LAYER_PRD.md`, `YOUSTACKS_IMPLEMENTATION_PLAN.md`, README credits, bundled YouStack skills, and `AGENT_STACK_UPSTREAM_AUDIT_2026-06-01.md`. The first expanded sync captured Agent Scripts `5dc3c24` and The Library `47f455c` with 13 bootstrap candidate tasks; the verification rerun correctly reports no new candidates because the local reference state is now current.

## Homepage Minimal + Redirect Gate QA (from May 30 conversation)

### 78. Make the homepage minimal and confirm cookie-gate redirects
**Status:** IN PROGRESS
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_7rodpWtQzYwZSqtfdPZTY95hsu9k` confirms live homepage and `/shell` redirect behavior.
**Source:** 2026-05-30 — Houston feedback: "homepage is way too complicated" + "confirm /shell//dashboard redirect behavior"
**Request:** Further simplify the marketing homepage so it feels minimal, clear, and intentional; confirm the cookie-based gate cleanly redirects unauthenticated users and does not allow `next=//...` open redirects.
**Actionable Scope:**
1. Reduce homepage section sprawl to a small, intentional sequence.
2. Ensure auth gate redirects `/shell` + `/dashboard` to `/sign-in?next=/...` when unauthenticated.
3. Sanitize `next` so `//evil.com` cannot be used as an open redirect and double-slash paths are normalized.
4. Verify `next build` and a quick local `/shell` + `/dashboard` curl pass.
**Progress (2026-06-01):** Homepage remains reduced to Hero + CTA/footer. Local dev server verified `/` returns 200 and `/shell` redirects to `/sign-in?next=%2Fshell`; `sanitizeNextPath` rejects `//evil.com`, absolute `https://...`, and triple-slash paths. Production deployment `dpl_7rodpWtQzYwZSqtfdPZTY95hsu9k` is ready and live aliases verify `/` 200 plus `/shell` -> `/sign-in?next=%2Fshell`.

## You.md Vision Simplification (from May 27 conversation)

### 74. Finish the next product-clarity pass across remaining app surfaces
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_D2ZEuhDf5LUQFzW8JToASft64e5m` for commit `5f2150f` completed successfully, is aliased to `https://www.you.md` / `https://you.md`, and is live at `https://youmd-lh226mne7-hubify.vercel.app`.
**Request:** Continue the simplified You.md vision pass and "make all improvements" so the homepage/docs/app stop feeling confusing and consistently explain You.md as an agent brain plus named expertise stacks, runtime, and protected API/MCP.
**Actionable Scope:**
1. Sweep remaining app metadata, auth/onboarding copy, docs snippets, dashboard panes, share prompts, profile CTAs, README, PRD, and schema comments for stale "identity context protocol" positioning.
2. Preserve identity as one part of the brain, but stop presenting the product as an abstract protocol first.
3. Make skills and YouStacks read as brain-aware, stack-aware, and self-improving rather than generic identity templates.
4. Verify docs/checks locally, deploy through main/Vercel, and smoke production after deployment.
**Progress (2026-05-28):** Updated the remaining root metadata, auth boot screens, initialize copy, reset metadata, profile/profile-directory metadata and CTAs, share prompts, skill/help/history panes, homepage portrait/hero copy, README, PRD, docs snippets/navigation, sample profiles, schema comments, and robots comments so the product reads as an agent brain plus named expertise stacks, runtime, and protected API/MCP. Local verification passed docs check, root TypeScript after temporarily moving unrelated untracked middleware files, and targeted ESLint with warnings only from pre-existing ignored README/profile image/unused code. Production verification passed on `https://www.you.md`: homepage exposes brain/workflow and core-brain-free copy, `/docs#share` exposes Share Your Brain / brain-aware skills / brain smoke text, `/profiles` exposes public agent brains, `/sign-up` exposes agent-brain metadata, `/houstongolden` exposes agent brain + YouStacks metadata and the agent-brain CTA, and `/schema/you-md/v1.json` exposes the public agent brain schema description.

---

## Reference Intelligence Follow-ups (from May 29 sync)

### 75. Brain-aware planning: structured context load + safe write surfaces
**Status:** IN PROGRESS
**Verified:** NO
**Production Verified:** NO
**Source:** 2026-05-29 — reference-intelligence sync (GStack `070722a`: “brain-aware planning” + `docs/gbrain-write-surfaces.md`)
**Request:** Mirror the “brain-aware planning” pattern in You.md/YouStacks: load relevant brain context *when available* before planning, but suppress overhead when not configured; document “write surfaces” and gate writes via trust policy/consent.
**Actionable Scope:**
1. Define a minimal “Brain Context Load” block for You Agent planning flows (keywords → search → read top N → cite slugs).
2. Define “write surfaces” for You.md (memories, profiles, stacks, audit logs) and which ones are allowed to receive automated writes.
3. Add a trust-policy/consent gate that prevents auto-writeback until explicitly enabled per surface or per stack.
**Progress (2026-05-29):** Updated bundled You.md skills (`youstack-maintainer`, `meta-improve`, `proactive-context-fill`, `claude-md-generator`) so agents load `project-context/` (plus reference-intelligence tasks) before planning or prompting for basics.

### 76. Explicit consent + first-run wizard for sensitive writebacks
**Status:** TODO
**Verified:** NO
**Production Verified:** NO
**Source:** 2026-05-29 — reference-intelligence sync (GStack `ce5fbfa`: “explicit consent + first-run setup wizard”)
**Request:** Add a first-run setup wizard + explicit consent checks for any You.md workflow that can mutate private brain context (memory writes, profile edits, stack installs, grants).
**Actionable Scope:**
1. Identify all writeback entrypoints (CLI + web + API/MCP).
2. Require a one-time explicit consent interaction for “private brain writes” and log it.
3. Add a “consent already prompted” state to avoid spamming prompts while still enforcing the gate.

### 77. Source-scoped hygiene: orphan/coverage metrics per surface
**Status:** TODO
**Verified:** NO
**Production Verified:** NO
**Source:** 2026-05-29 — reference-intelligence sync (GBrain `041d89b`: “source-scoped orphan_ratio”)
**Request:** Make You.md memory/profile hygiene checks source-scoped (per surface/stack/source) so cleanup and coverage metrics don’t mix unrelated streams.
**Actionable Scope:**
1. Define what “sources” mean in You.md (stack, project, profile, import, agent session).
2. Implement or spec orphan/coverage metrics per source, with an operator-facing summary.

### 78. Reliability audit: self-healing retry + disconnect audit breadcrumbs
**Status:** TODO
**Verified:** NO
**Production Verified:** NO
**Source:** 2026-05-29 — reference-intelligence sync (GBrain `ffac8ce`: “withRetry self-heals… + disconnect audit”)
**Request:** Harden You.md’s long-lived client/singleton surfaces (MCP/HTTP clients, Convex/OpenRouter bridges) with self-healing retries and explicit disconnect audit logs for debugging + safety.
**Actionable Scope:**
1. Identify singleton-ish clients and their failure modes (null state, stale token, dropped stream).
2. Add an audit breadcrumb per disconnect/reconnect and surface it in diagnostics.

### 79. Git-aware sync freshness: skip expensive refresh when unchanged
**Status:** IN PROGRESS
**Verified:** NO
**Production Verified:** NO
**Source:** 2026-05-29 — reference-intelligence sync (GBrain `cb1b5f9`: “git-aware sync_freshness”)
**Request:** Add a sync-freshness signal for You.md “brain/index refresh” paths that short-circuits when the underlying source hasn’t changed; report freshness in CLI/dev UX.
**Actionable Scope:**
1. Decide which sync/refresh actions should be freshness-gated (project context index, memory index, stack repo sync).
2. Implement a lightweight “unchanged” detection strategy and a clear freshness summary output.
**Progress (2026-05-29):** Extended `youmd stack doctor` to surface git root, dirty working-tree warnings, and upstream ahead/behind counts (read-only) so stack maintenance is freshness-aware before publishing changes.

### 80. Homepage minimalization: remove section sprawl, keep it intentional
**Status:** IN PROGRESS
**Verified:** NO
**Production Verified:** NO
**Source:** 2026-05-29 — Houston feedback (“home page is way too complicated… minimal and clear and intentional”)
**Request:** Simplify the homepage information architecture so it feels minimal, calm, and terminal-native; stop stacking every possible section.
**Actionable Scope:**
1. Reduce homepage sections to the core story (Hero → YouStacks → Open Standard → CTA).
2. Simplify navbar and remove scroll-spy anchors when sections are removed.
3. Verify TypeScript and targeted lint locally, then deploy and production-smoke.

### 73. Simplify the whole product model around Brain, Stacks, Runtime, and Protected API/MCP
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — GitHub/Vercel deployment `4844921786` for commit `1a7c1a9` completed successfully and is live at `https://www.you.md` / `https://you.md` (`https://youmd-i1nc5c1ho-hubify.vercel.app`).
**Request:** Improve everything about You.md, the vision, stack, API/MCP, and YouStacks so the product feels more powerful, simpler, clearer, and more focused.
**Actionable Scope:**
1. Stop leading with abstract "identity context protocol" language on the user-facing surfaces.
2. Make the core model explicit everywhere: You.md Brain, named YouStacks, one curl-installed Runtime, and Protected API/MCP for sensitive access.
3. Update homepage copy and information architecture to explain the product in that order.
4. Update docs quickstart/core concepts so a new user can understand the model before seeing CLI/API details.
5. Update the public profile agent panel so `/{username}` reads like a public agent brain with optional public stacks.
6. Update dashboard labels and help copy so the shell feels organized around brain/stacks/sharing/activity instead of scattered implementation surfaces.
**Progress (2026-05-27):** Reworked homepage metadata, hero, problem, how-it-works, simple model, YouStacks, integrations, FAQ, CTA footer, sample profile copy, README, docs metadata, docs introduction, docs quickstart, docs core concepts, dashboard primary group labels, Stacks pane, Help pane, command palette, public profile agent panel, and public profile stack copy around the simplified `Brain → Stacks → Runtime → Protected API/MCP` model. Local verification passed docs check, root TypeScript after temporarily moving unrelated untracked middleware files, and targeted ESLint with warnings only from pre-existing profile image/unused code. Local Next dev/prod rendering still stalls in the Next compile worker, but Vercel production deployment `4844921786` for commit `1a7c1a9` completed successfully. Production smoke passed on `https://www.you.md`: homepage contains the new agent brain/expertise stacks/simple model language, `/docs#simple-model` contains Brain/Stacks/Runtime/Protected API/MCP, and `/houstongolden` exposes the public agent brain/profile language.

## YouStack Doctor Diagnostics (from May 27 conversation)

### 72. Add read-only YouStack health diagnostics from GStack reference learning
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — GitHub/Vercel deployment `4843270141` for commit `2c80f42` completed successfully and is live at `https://www.you.md` / `https://you.md` (`https://youmd-7dhuuysdw-hubify.vercel.app`).
**Request:** Continue improving YouStacks, the skill stack, API/MCP boundaries, docs, homepage, BAMFStack lighthouse, and GStack/GBrain-inspired self-improvement architecture.
**Actionable Scope:**
1. Convert the latest GStack reference-intelligence signal about memory diagnostics and resource-leak fixes into a YouStacks-native improvement.
2. Add a read-only stack doctor that host agents can run before self-improving, publishing, or updating named YouStacks.
3. Route diagnostic/health/bloat/drift/staleness requests to a first-class YouStack capability instead of relying on generic stack improvement copy.
4. Update the BAMFStack lighthouse example and docs so diagnostics become part of the install/use/improve loop.
5. Keep diagnostics local/static first, with no private brain reads, connected tool calls, or file mutations during the doctor pass.
**Progress (2026-05-27):** Added `youmd stack doctor --path <stack>` plus `runYouStackDoctor`, a read-only diagnostic pass that reports manifest size, file counts/types, capability split, adapters, brain scopes, warnings, and next recommendations. Added the built-in `stack.diagnose` / `stack-diagnostics` capability to CLI and shared route scoring. Updated the bundled `youstack-maintainer` skill, BAMFStack lighthouse manifest/docs/smoke checklist, homepage/docs YouStacks copy, dashboard stack pane, and README so agents run doctor before smoke/evals/self-improvement/public-readiness work. Local verification passed focused YouStack tests, CLI TypeScript, docs check, root TypeScript, CLI build, built `youmd stack doctor`, and built routing for diagnostic requests. Local Next production build attempts stalled in the Next compile worker with 0% CPU, but Vercel production deployment `4843270141` for commit `2c80f42` completed successfully. Production smoke passed on `https://www.you.md`: `/docs#youstacks` contains the doctor guidance, `/api/v1/stacks/capabilities` exposes `stack-diagnostics`, `/api/v1/docs/reference` still exposes YouStacks reference data, and `POST /api/v1/stacks/route` routes diagnostic requests to read-only `stack-diagnostics`.

## YouStacks Curl Runtime + BAMFStack Lighthouse (from May 27 conversation)

### 71. Make YouStacks curl-first, auto-updating, native-skill maintained, and BAMFStack-proofed
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — GitHub/Vercel deployment `4842170884` for commit `db6a01f` completed successfully and is live at `https://www.you.md` / `https://you.md` (`https://youmd-71x5nxy48-hubify.vercel.app`).
**Request:** Reframe YouStacks so users do not need a CLI mental model: one curl install should deliver the You.md runtime, native skills, auto-update behavior like BAMFStack, a shareable/open-source BAMFStack lighthouse example, agent-driven stack organization/update through a bundled skill, and shell/profile visibility management where stacks default private and only become public by owner action.
**Actionable Scope:**
1. Make the curl installer the default product surface and describe `youmd` as the helper runtime underneath.
2. Add a native bundled maintainer skill that lets host agents organize, improve, update, smoke, and prepare private/public visibility changes for named YouStacks.
3. Add an auto-upgrade helper so host adapters and stack workflows can refresh the runtime before stack work.
4. Create an open/public-safe BAMFStack lighthouse YouStack example with manifest, skills, workflows, prompts, docs, tests, update policy, improvement policy, protected-capability boundaries, and public-readiness routing.
5. Add shell/dashboard and profile surfaces for seeing named stacks, their visibility, update policy, install command, and public/private rules.
6. Keep stack visibility private by default, with scoped/public sharing only after redaction, smoke checks, and explicit owner approval.
7. Keep GStack/GBrain reference monitoring live with local reference repos, updated task queues, and a daily automation.
**Progress (2026-05-27):** Updated `https://you.md/install.sh` into a curl-first You.md runtime installer that source-installs current You.md by default, falls back to npm, installs native skills, writes `~/.youmd/bin/youmd-auto-upgrade`, and writes the stack runtime preamble. Added bundled `youstack-maintainer` across CLI catalog, SkillsPane, HelpPane, docs, README, You Agent prompt copy, and routing capabilities. Added `/stacks` shell navigation plus a YouStacks dashboard pane showing named private/public stacks, visibility, install commands, update policies, and agent commands. Added profile rendering for `public-open` YouStacks while keeping private/scoped stacks owner-only. Added `cli/examples/youstack-bamfstack-public` as the public-safe BAMFStack lighthouse with manifest, skill, workflow, prompt, quickstart, smoke test, auto-update policy, and public-readiness capability. Synced GStack/GBrain references to latest GStack `19770ea` and GBrain `42d99b6`, regenerated reference tasks, documented the daily reference automation, and created the active local Codex automation `Daily GStack/GBrain Reference Sync`. Local verification passed docs generation/check, targeted ESLint with zero errors, CLI TypeScript, root TypeScript, focused YouStack tests, CLI build, Next production build, built CLI BAMFStack smoke/routing, and local production homepage/docs/install/API smoke checks. Production verification passed on `https://www.you.md`: homepage exposes the no-CLI mental model and auto-upgrade copy, `/docs#youstacks` exposes runtime/profile/BAMFStack/reference automation sections, `/install.sh` serves the runtime installer with `youmd-auto-upgrade`, and `/api/v1/stacks/capabilities` exposes maintainer/visibility/update capabilities.
**Progress (2026-05-27 continuation):** Extended the BAMFStack lighthouse and native maintainer loop with `youmd stack doctor`, so curl-installed agents get a read-only health diagnostic before smoke/evals/public-readiness work.

## GStack/GBrain Reference Intelligence (from May 27 conversation)

### 70. Monitor GStack/GBrain and use them to improve YouStacks + You.md brain
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — deployment `dpl_4UwpUiK2vUPYu8R9nj8dfnBDpq9M` is Ready and aliased to `https://www.you.md` / `https://you.md`.
**Request:** Keep `garrytan/gstack` and `garrytan/gbrain` as local reference repos, monitor their daily updates/commits/messages/code changes, and turn relevant upstream patterns into tasks that improve YouStacks, the You.md brain/memory/context/profile layer, docs, homepage, architecture, and self-improvement loops.
**Actionable Scope:**
1. Treat GStack as the live reference for YouStacks architecture, skills, host adapters, install/update behavior, evals, QA/review/release workflows, and local-first agent operating systems.
2. Treat GBrain as the live reference for You.md memory/context/personal brain architecture, retrieval, sync, provenance, privacy, and shared-agent brain behavior.
3. Keep both repos cloned locally without vendoring them into this repository.
4. Add a repeatable sync/monitor command that fetches upstream commits and creates a reviewable You.md task list.
5. Improve homepage and docs so they directly explain the GStack/GBrain-guided architecture.
6. Set up a daily local automation to run the reference monitor.
**Progress (2026-05-27):** Added `npm run references:sync` backed by `scripts/reference-intelligence.mjs`, which clones/fetches `garrytan/gstack` and `garrytan/gbrain` into ignored `.reference-repos/garrytan/*`, records latest commit state, and writes `project-context/reference-intelligence/LATEST.md` plus `TASKS.md`. The first run captured GStack latest commit `a6fb317` and GBrain latest commit `42d99b6`, producing 24 candidate You.md tasks. Added `project-context/REFERENCE_INTELLIGENCE.md` plus PRD/implementation-plan updates describing GStack -> YouStacks and GBrain -> You.md brain translation rules. Updated homepage copy and `/docs` with Brain Architecture, Reference Intelligence, and GStack/GBrain Reference Loop sections. Local verification passed script syntax check, docs check, targeted ESLint, `npx tsc --noEmit`, and `npm run build -- --webpack`. Production verification passed on deployment `dpl_4UwpUiK2vUPYu8R9nj8dfnBDpq9M`: live homepage and docs expose the reference-guided architecture and reference monitor command.
**Progress (2026-05-27 continuation):** Re-ran `npm run references:sync` against the latest upstream refs: GStack advanced to `19770ea` (`v1.51.0.0 feat: $B memory diagnostic + 4 CDP-resource leak fixes`) and GBrain remains at `42d99b6`, producing a fresh review task in `project-context/reference-intelligence/TASKS.md`. Created the active local Codex automation `Daily GStack/GBrain Reference Sync` so the monitor runs daily and reports candidate tasks.

## YouStacks Named Portfolio + Self-Improvement (from May 27 conversation)

### 69. Make YouStacks nameable by domain and self-improving
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — deployment `dpl_CZR4kXxAnfvRWNC14XdfvAq6ye9F` is Ready and aliased to `https://www.you.md` / `https://you.md`.
**Request:** YouStacks need to be nameable so users can maintain separate stacks for different expertise areas such as coding, scientific research, and content creation. Stacks and skills inside stacks also need to be truly self-improving/autonomously improving and self-updating.
**Actionable Scope:**
1. Make the homepage and docs explain named stack portfolios instead of one generic personal stack.
2. Define how `name`, `slug`, domain metadata, aliases, and tags distinguish multiple stacks.
3. Add manifest/contract support for improvement and update policy.
4. Make CLI inspect/smoke output reveal stack identity and improvement/update policy.
5. Add route/capability support for improvement and update intents.
6. Keep autonomy policy-bound: local stack/skill improvements can be proposed or applied when allowed, while private brain/context/tool/repo writes stay behind explicit policy and approval.
**Progress (2026-05-27):** Added optional `domain`, `aliases`, `tags`, `improvement`, and `update` fields to the `youstack/v1` TypeScript manifest contract; added validation warnings when improvement/update policies are missing; added built-in `stack.improve` and `stack.update` local capabilities; updated adapter generation with stack identity and self-improvement instructions; updated `youmd stack inspect` and `smoke` to show name, slug, domain, tags, improvement mode, and update channel; updated the sample personal stack and focused YouStack tests. Expanded the homepage and `/docs#youstacks` with named stack portfolio guidance, coding/scientific research/content examples, self-improving stack/skill loops, manifest examples, API/MCP boundary guidance, and the stack route API now preserves `domain` and `tags`. Local verification passed `npm run docs:check`, `npm --prefix cli test -- youstack`, targeted ESLint, `npx tsc --noEmit`, `npm --prefix cli run build`, built CLI inspect/smoke/route checks, and `npm run build -- --webpack`. Production verification passed on deployment `dpl_CZR4kXxAnfvRWNC14XdfvAq6ye9F`: live homepage, docs, `/api/v1/stacks/capabilities`, `/api/v1/docs/reference`, and `POST /api/v1/stacks/route` all expose the named-stack and improvement/update contract.

## YouStacks Positioning Clarity (from May 27 conversation)

### 68. Clarify YouStacks as "your own GStack" for any agent
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — deployment `dpl_EyuaBhd5yXGFrw5eAGu2eBqZ46su` is Ready and aliased to `https://www.you.md` / `https://you.md`.
**Request:** The current homepage/docs copy does not convey YouStacks clearly enough. Reframe YouStacks as your own GStack-like stack of skills, expertise, prompts, workflows, taste, and safe memory access that can be shared with any agent.
**Actionable Scope:**
1. Make the homepage lead with the "build your own GStack for any agent" mental model.
2. Explain that a YouStack packages a person's expertise, skills, workflows, prompts, examples, taste, tools, and safe memory access.
3. Make docs clearer about what goes into a YouStack.
4. Preserve the brain boundary: You.md is the brain, YouStack is the shareable/installable stack built from it.
5. Verify locally and open the improved surfaces in the Codex browser for review.
**Progress (2026-05-27):** Reworked `src/components/landing/YouStacks.tsx`, homepage metadata, and `/docs#youstacks` copy around packaged expertise and the "personal GStack" analogy. Added a docs "What Goes In" subsection for skills, workflows, taste/examples, and protected capabilities. First production verification passed on `https://www.you.md`: homepage copy included "build your own GStack", docs included the GStack-style operating-system explanation plus "What Goes In", generated docs reference listed stack endpoints/tools, and OpenAPI tagged stack endpoints under `YouStacks`. Follow-up copy pass now makes the analogy explicit: Gary Tan creating GStack from years of startup operating experience, specialist agents, taste, review loops, and workflows; YouStacks let anyone package their own expertise/workflows/sub-agents into a shareable stack. Local verification passed `npm run docs:check`, targeted ESLint, `npx tsc --noEmit`, `npm run build -- --webpack`, and local production text checks. Production verification passed on deployment `dpl_EyuaBhd5yXGFrw5eAGu2eBqZ46su`: live homepage contains "package your expertise into your own GStack", "years of expertise", "sub-agents", and "like GStack, but yours"; live docs contain "Gary Tan creating GStack", "years of startup operating experience", "specialist agents", "sub-agents", "What Goes In", and "Personal expertise stack"; generated docs reference and OpenAPI still expose the YouStacks endpoint/tool surfaces.

## YouStacks Homepage + Docs Surface (from May 26 conversation)

### 67. Make YouStacks first-class on the homepage and in docs
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_7b6X4k3R6JahR7F3jqFdbgJXN5S1` is Ready and aliased to `https://www.you.md` / `https://you.md`.
**Request:** Ensure the YouStack/YouStacks product layer is properly included and described on the you.md homepage and in the improved docs, including use cases, how to use stacks, examples, and the improved API/MCP surfaces.
**Actionable Scope:**
1. Add a homepage section that explains YouStacks as portable execution packages on top of the You.md brain.
2. Cover practical stack use cases, including personal, project, team/friend, and public/open stacks.
3. Expand the docs YouStacks section into a fuller chapter.
4. Document how to use stacks through CLI commands and host adapters.
5. Add concrete examples for manifests, stack commands, and capability routing.
6. Include the improved YouStacks API and MCP surfaces in the docs.
7. Keep generated docs/API references in sync with source.
**Progress (2026-05-26):** Added `src/components/landing/YouStacks.tsx` and inserted it into the homepage after the identity bundle section. Expanded `/docs#youstacks` with overview, use cases, CLI, install flow, manifest, examples, API/MCP threshold, generated YouStacks endpoint reference, and stack-specific MCP tools. Updated docs generation so `/api/v1/stacks/capabilities` and `/api/v1/stacks/route` are categorized under `YouStacks` in `docs-reference` and OpenAPI. Local verification passed docs generation/check, targeted ESLint, TypeScript, production build, local production server smoke checks, and headless Chrome screenshots/text checks. Production verification passed on `https://www.you.md`: homepage YouStacks copy, docs use-case/how-to/API+MCP copy, generated docs reference stack endpoints/tools, and OpenAPI `YouStacks` tags are all live.

## YouStacks End-to-End Implementation (from May 24 conversation)

### 66. Continue YouStacks from planning into production-quality implementation
**Status:** IN PROGRESS
**Verified:** NO
**Request:** Continue the YouStacks work and get it done end-to-end, production-tested, and working per the full vision rather than stopping at planning.
**Actionable Scope:**
1. Move from the planning document into small, bisectable implementation phases.
2. Start with the first PR-sized slice from the plan: local YouStack manifest schema and read-only CLI smoke/inspect/capability support.
3. Keep broad product changes gated behind verified slices instead of making an unsafe mega-patch.
4. Test each implemented slice locally before commit.
5. Deploy and production-test only code that has passed local verification and is ready for production.
6. Keep GitHub sync, stack grants, protected brain retrieval, sharing, and host adapters tracked as later phases until their implementation slices are complete.
**Progress (2026-05-24):** Phase 1-3 plus the shared read-only route endpoint are implemented locally in bisectable commits:
- `dec9d3d` adds the local `youmd stack inspect/smoke/capabilities/route` manifest foundation, sample personal YouStack, tests, docs, and CLI `0.6.23` version bump.
- `d7be628` adds `youmd stack link` for Claude Code, Codex, and Cursor adapter generation with dry-run support.
- `4da2e99` exposes local MCP YouStack resources/tools: `get_stack_manifest`, `get_stack_capabilities`, `route_stack_request`, and `smoke_stack`.
- `e79bf70` adds shared read-only HTTP endpoints: `GET /api/v1/stacks/capabilities` and `POST /api/v1/stacks/route`.
- Local verification passed focused YouStack/MCP tests, full CLI tests, CLI build, docs check, root TypeScript, root production build, local production API smoke tests, and MCP SDK smoke.
- Production web/API/docs verification passed on `https://www.you.md`: stack capabilities, stack route, docs reference, and `/docs` all expose the new YouStacks surfaces.
- npm publish verification is blocked outside code: the trusted publish workflow for `youmd@0.6.23` passed install, tests, and build, then failed at `npm publish` with `E404 Not Found / no permission`; npm still serves `youmd@0.6.21`.
- Still intentionally deferred from this slice: GitHub App repo sync, stack grant/token storage, private/public share-link UI, paid stacks, secondary hosts, and optional custom per-stack API/MCP endpoints.

**Progress (2026-05-25):** Hardened the trusted publish workflow to current npm GitHub Actions guidance, normalized CLI package metadata back to the canonical git repository URL, and reran the workflow as run `26387133488`. Install, tests, and build passed again; `npm publish` still failed with `E404 Not Found / no permission`. Remaining action is external npm package configuration for Trusted Publishing/package permissions, not another code patch.

**Progress (2026-05-25 continuation):** Checked whether this machine could finish the npm-side setup directly. `npm whoami` returns `E401`, `npm trust list youmd` returns `E401`, and the real trusted-publisher setup command is blocked by npm `E401`. The dry-run command confirms the exact target is correct: `npx npm@11.15.0 trust github youmd --repo houstongolden/youmd --file publish-cli.yml --allow-publish --yes`. Also verified Vercel deployment `dpl_Eku5BV118Ww7W8tgehuHqy5axNKU` is ready and aliased, and live production `GET /api/v1/stacks/capabilities` plus `GET /api/v1/docs/reference` return the expected YouStacks contracts.

## YouStacks Planning Phase (from May 23 conversation)

### 65. Audit You.md and write the YouStacks implementation plan before product changes
**Status:** DONE
**Verified:** NO
**Request:** Start the YouStacks planning phase as an additive product-layer pass. Save the kickoff brief, audit existing You.md surfaces, review GStack and BAMFStack before designing YouStacks, and create `project-context/YOUSTACKS_IMPLEMENTATION_PLAN.md` without rushing into broad implementation.
**Actionable Scope:**
1. Preserve the kickoff brief in `project-context/YOUSTACKS_PRODUCT_LAYER_PRD.md`.
2. Read existing You.md context before writing code: README, AGENTS, CLAUDE, PRD, architecture, features, TODO, safe agent context integration, CLI commands, Convex schema/http routes, memory/private-context code, skill system, link/key sharing, and existing GitHub/source/sync code.
3. Treat YouStacks as additive execution packages on top of the You.md brain, not a replacement brain or custom launch harness.
4. Inventory current web app, CLI/TUI, You Agent, memory brain, private context, project context, skills, context links, API keys, MCP/API surfaces, Convex schema/http routes, GitHub/source/sync, docs, dashboard panes, onboarding, and sharing flows.
5. Classify each existing surface as keep, repurpose, expand, modify, defer, or remove-only-if-breaking.
6. Audit brain, memory, private context, project context, skills, link, API, and CLI boundaries.
7. Review GStack first, then the local `bamfaiapp` repo surfaces requested in the brief.
8. Extract GStack transfer lessons and BAMFStack applied-proof lessons for YouStacks.
9. Define the YouStack manifest schema, repo layout, access model, GitHub sync design, sharing model, host adapters, optional API/MCP boundaries, capability map, route endpoint, helper CLI, smoke test, and docs sync rule.
10. Decide the local-only/shared-API/custom-endpoint/user-owned-remote threshold.
11. Break implementation into small bisectable phases and name the first PR-sized slice.
12. Do not implement broad product changes until the audit and plan are complete.
**Progress (2026-05-23):** Kickoff brief exists in `project-context/YOUSTACKS_PRODUCT_LAYER_PRD.md`. Audit and implementation plan are written in `project-context/YOUSTACKS_IMPLEMENTATION_PLAN.md`.
**Progress (2026-05-24):** Houston continued the work into implementation with request #66.

## YouStack Local-Agent Priority (from May 22 conversation)

### 64. Prioritize You.md skills, MCP/API, and local-agent integration over CLI/npm polish
**Status:** IN PROGRESS
**Verified:** NO
**Request:** Continue improving the You.md / youmd stack around the gstack + bamfstack pattern: a "youstack" that empowers Claude Code, Codex, Grok, Cursor, and other top local/cloud agents with identity context, skills, prompts, tools, agent harness intelligence, and MCP/API access. Prioritize this over pure CLI/npm polish.
**Actionable Scope:**
1. Improve the bundled You.md skill layer so local agents get a stronger starting protocol, not just individual one-off templates.
2. Improve MCP/API surfaces that let agents quickly load identity, project context, active requests, TODOs, installed skills, and next moves.
3. Make Claude Code/Codex/Cursor-style sessions start from real local context instead of asking the user to re-explain the repo.
4. Keep the implementation additive and compatible with existing gstack/bamfstack-style workflows.
5. Update app/docs/web-agent copy so the shipped product advertises the actual skill/MCP surface.
6. Verify locally and leave production deploy/user verification clearly tracked.
**Progress (2026-05-22):** Added a local MCP `get_agent_brief` tool plus `youmd://agent/brief` resource that composes compact identity, cwd, project instructions, project-context files, active requests, open TODOs, known issues, installed skills, recommended skills, and next moves. Added the bundled `youstack-start` skill and wired it into the local catalog, recommended skills, backend bundled-skill seed list, SkillsPane, web agent prompt copy, README, docs copy, and generated docs reference. Added a focused CLI test for the brief builder. Local verification passed `npm test -- mcp-agent-brief.test.ts`, `npm run build` in `cli/`, `node dist/index.js skill list` with a temp HOME showing 7 bundled skills, `npm run docs:check`, and root `npm run build` with explicit Node PATH. Production Convex skill seeding/deploy was completed on 2026-06-17 and the live registry now returns all 10 bundled/local-agent skills.

## Docs Platform Upgrade (from May 21 conversation)

### 63. Bring You.md docs up to BAMF developer-platform quality and keep API/MCP reference auto-current
**Status:** IN PROGRESS
**Verified:** NO
**Request:** Audit what is missing from `you.md/docs`, compare against the latest BAMF docs work, improve the You.md docs to a more comprehensive Mintlify-style developer/reference/playbook standard, and ensure API/MCP docs automatically update when new features, endpoints, tools, or relevant platform changes ship.
**Actionable Scope:**
1. Identify gaps in the current You.md docs compared with the stronger BAMF docs structure and modern Mintlify patterns.
2. Add richer docs sections for concepts, quickstarts, architecture, CLI, skills, agent workflows, examples/playbooks, troubleshooting, privacy, API, MCP, schema, and release/documentation sync.
3. Improve visual polish inside the existing terminal-native You.md design system without turning docs into generic SaaS marketing.
4. Generate API/MCP reference data from source so endpoint and tool inventories do not stay as stale hand-maintained lists.
5. Wire docs generation into local development/build scripts so releases naturally refresh docs artifacts.
6. Update project tracking files, verify the docs build, and leave production deploy/user verification clearly tracked.
**Progress (2026-05-22):** Audited current `/docs`, `convex/http.ts`, web API proxies, CLI MCP tools, and BAMF `bamfaiapp/docs` / `bamfaiapp-next/docs` reference structure. Upgraded `/docs` with core concepts, context surfaces, source-of-truth mapping, agent workflow golden path, playbooks, starter prompts, examples, generated endpoint tables, generated MCP tool reference, schema guidance, docs automation, and troubleshooting. Added `scripts/generate-docs-reference.mjs`, `src/generated/docs-reference.ts`, `src/generated/openapi.ts`, `GET /api/v1/docs/reference`, and `GET /api/v1/docs/openapi.json`; wired `docs:generate` into `prebuild` and added `docs:check`. Local verification passed docs generation/check, targeted ESLint, `npx tsc --noEmit`, production `npm run build`, and desktop/mobile browser QA on `localhost:3100/docs` with no console errors or horizontal overflow. Production deploy and Houston verification remain pending.

## Private Context Link Reliability (from May 20 conversation)

### 62. Fix tokenized `/ctx` full-context URLs returning 5xx
**Status:** DONE
**Verified:** NO
**Request:** Private full-context URLs generated by the web shell, such as `/ctx/houstongolden/<token>`, must be fetchable by external AI agents and return `you-md/v1` JSON with both `identity` and `_privateContext` instead of Vercel/you.md server errors.
**Observed Failure:** A user-provided agent prompt produced repeatable server errors for freshly generated secure tokenized links. The external agent reported request IDs `70c536ff77274a5e`, `10a3d0c0aaa1a2bb`, and later `3467476f9899ec71`.
**Progress (2026-05-21):** Reproduced that the exact link resolves with redirect-following, then hardened the fragile server path that could turn valid links into 5xxs: `incrementUseCount`, `recordView`, and activity logging are now best-effort, unexpected `/ctx` exceptions return JSON, and both Convex + Next proxy responses use private/no-store cache headers with `Vary: Accept`. Deployed via push `92314d3` and verified production full JSON has `identity` + `_privateContext`, text/plain still returns markdown, invalid tokens return 404, and ETag revalidation still returns 304. The later Myo request ID did not appear in Vercel or Convex `/ctx` logs, so generated links now use `https://www.you.md/ctx/...` directly to remove the apex redirect from the agent-fetch path. Content negotiation now also returns JSON for broad agent headers that include both JSON and text. Follow-up pushes `f010837` and `b62ba51` are deployed; production `www` context URLs return 200 with zero redirects and include both `identity` and `_privateContext`. Local verification passed TypeScript, Convex TypeScript, targeted source lint, and a production build.
**Scope Checklist:**
1. Reproduce the production `/ctx/:username/:token` failure without exposing private content unnecessarily.
2. Trace the web route and Convex/API data path responsible for resolving tokenized context links.
3. Fix the server-side exception so valid owner-generated links return full-context JSON, including `_privateContext`.
4. Verify invalid/revoked/mismatched links still fail safely.
5. Update docs/session tracking and commit the fix once verified.
6. Remove apex-domain redirects from generated context-link URLs and verify `www.you.md` links return directly for agents.
7. Prefer JSON when agent `Accept` headers include both JSON and text formats.

## Homepage + App Design-System Cleanup (from May 19 conversation)

### 57. Mature the homepage and app UI without changing product behavior
**Status:** DONE
**Verified:** NO
**Request:** Run a design-system and homepage cleanup pass that makes the marketing homepage and app UI feel more polished, compact, consistent, and conversion-focused while preserving the terminal-native You.md aesthetic.
**Progress (2026-05-19):** Added shared UI primitives for layout, sections, buttons, cards, terminal cards, inputs, labels, helper/error text, textarea/select controls, and small class merging. Refactored the homepage into the requested conversion flow with a calmer hero, one primary above-fold CTA, compact social proof, compressed problem/how-it-works/inside/integration/open-standard sections, balanced pricing, compact FAQ, and simple final CTA. Normalized app-facing controls across terminal auth/input, dashboard pane headers/empty states, edit/share/sources/private context/files/settings surfaces, and mobile/desktop dashboard tabs without changing routes, auth, API, Convex behavior, or data models. Verified locally with a production build, live Chrome desktop/mobile visual QA on `localhost:3000`, and a targeted lint pass on changed files.
**Scope Checklist:**
1. Audit `globals.css`, marketing homepage, landing sections, shared UI components, install components, dashboard/app surfaces, and shared form/button/input controls.
2. Add or refine reusable primitives/tokens for `Container`, `Section`, `SectionHeader`, `Button`, `Card` / `TerminalCard`, `Input`, `Textarea`, `Select`, `Label`, `FieldHelp`, `FieldError`, and `FormField`.
3. Normalize layout rhythm: 1120/1160px page max width, readable text max width, 44-96px section padding, 16-24px grid gaps, 16-32px card padding, and 8px spacing rhythm.
4. Normalize typography hierarchy: controlled hero display, readable hero body, mono eyebrows, clear section h2s, consistent card titles/body/captions/code text.
5. Normalize button variants/sizes/states and make the homepage primary CTA “Create your you.md” or “Start in browser,” with CLI install secondary.
6. Normalize form/input/select/textarea styles, focus-visible rings, labels, helper/error text, disabled states, and app form spacing.
7. Refactor homepage order to: navbar, hero, compatibility strip, problem/solution, how it works, what’s inside, works everywhere/developer integration band, open standard/ownership, pricing, FAQ, final CTA, footer.
8. Calm the hero: lower ASCII texture density, compact two-column layout, obvious primary CTA above the fold, secondary CLI/docs CTA, shorter command detail.
9. Move network/profile proof lower or compress it; avoid a huge early list of unclaimed famous profiles.
10. Compress problem, how-it-works, what’s-inside, integrations/developer/open-standard, pricing, FAQ, and final CTA sections.
11. Apply the same Button/Input/Card/FormField standards to app UI surfaces including dashboard panes, settings, share/profile editing, onboarding/init, and terminal-like panels where practical.
12. Preserve semantic headings, accessible names, focus states, mobile tap targets, no horizontal overflow, readable contrast, and decorative ASCII `aria-hidden`.
13. Run lint/typecheck/build if scripts exist and fix issues.
**Verification:** Homepage is visibly shorter and clearer, one primary above-fold CTA wins, shared controls look consistent across marketing and app, typography hierarchy is obvious, mobile layout is clean, no product functionality/routes/auth/API/Convex/data behavior changed.

### 58. Clean up public profile duplicates, missing portraits, and crawler/enrichment hygiene
**Status:** DONE
**Verified:** NO
**Request:** Fix duplicate/incomplete profiles on `/profiles`, ensure real images and ASCII portraits do not display blank, and inspect/improve the crawler/fetch/enrichment path so future unclaimed public profiles are fetched comprehensively and safely.
**Progress (2026-05-19):** Added shared Convex profile-directory normalization that canonicalizes usernames, selects the richest duplicate record, suppresses known QA/test usernames from public directory lists, resolves avatar fallbacks from profile fields/social images/links, sanitizes public image URLs, and exposes stored ASCII portraits safely. Updated `/profiles` client and SSR directory paths to dedupe by canonical username, suppress QA/test rows defensively even before backend deployment, prefer stored ASCII portraits, fall back to real-image/social-link avatars, and render a deterministic terminal fallback instead of blank cards. Updated public profile pages/metadata to sanitize image URLs and render stored ASCII portraits even when a live avatar URL is missing. Hardened sample seeding/backfill/cleanup so reseeds do not create duplicate/orphan profile rows and profile backfills retain avatars. Fixed crawler/enrichment hygiene so Unavatar API keys are used only for server fetches and are no longer persisted into public `avatarUrl` fields; added an internal cleanup mutation to strip previously persisted image secrets.
**Verification:** Local browser QA on `localhost:3000/profiles` showed 27 real/network profiles, 0 visible QA/test rows, 0 duplicate visible profile hrefs, 27/27 with portrait, no horizontal overflow, and no image URLs containing API keys/tokens. Grid view passed the same checks. `localhost:3000/ilyasut` rendered a stored ASCII portrait (`pre`, no canvas dependency) plus real image, with no secret-bearing image URLs. `tsc --noEmit` passed. `next build --webpack` passed. Targeted lint on changed files has 0 errors and only existing image/unused warnings in profile UI files.
**Scope Checklist:**
1. Audit `/profiles` data flow, SSR profile list, frontend directory rendering, public profile rendering, profile query API, sample seeding/backfill/cleanup, crawler/scraper, portrait generation, and enrichment action.
2. Backend canonicalizes/dedupes profile directory results and chooses the richest row per username.
3. Directory and SSR paths suppress known QA/test rows and avoid exposing incomplete test profiles.
4. Directory cards use stored ASCII portraits and sanitized avatar/social image fallbacks before deterministic terminal fallback.
5. Public profile pages render stored ASCII portraits when present and sanitize all public image URLs.
6. Seed/backfill/cleanup paths avoid duplicate/orphan profiles and preserve avatar completeness.
7. Enrichment no longer stores third-party API keys in public avatar URLs and includes a cleanup mutation for old data.
8. Verify visually in the browser and with typecheck/build.

### 59. Polish `/profiles` create CTA and responsive filters
**Status:** DONE
**Verified:** NO
**Request:** Fix the bad-looking create-you button in the app nav on `/profiles` and make the profile filters/sort controls responsive.
**Progress (2026-05-19):** Replaced the signed-out app-nav create CTA with a compact terminal accent action (`create you.md`) instead of the old filled `cta-primary` block, and fixed the mobile tap-target CSS so hidden desktop nav links are not forced visible on narrow viewports. Rebuilt `/profiles` controls so search, filters, sort, and list/grid toggles use compact heights, shorter labels, clear focus states, and a responsive two-column/four-column/inline layout.
**Verification:** In-app browser QA on `localhost:3000/profiles` passed at the current narrow pane width, a 390px phone viewport, and a 1280px desktop viewport with no horizontal overflow. Clicked `claimed` and `grid` live; pressed states, match count, and grid rendering updated correctly. `tsc --noEmit`, targeted lint, and `next build --webpack` pass.

## Skill System (from March 27 conversation)

### 41. Codex MCP launcher should use local CLI in the youmd repo and npm elsewhere
**Status:** DONE
**Verified:** NO
**Request:** Prevent Codex/youmd MCP startup failures caused by `npx youmd mcp` resolving the repo root package when working inside the youmd codebase. Use the local `cli/` build in this repo for development, and a published npm package everywhere else.
**Verification:** Start Codex in the local `youmd` repository — no `youmd` MCP handshake warning. Start Codex in another repo — `youmd` MCP still starts via npm.

### 42. Safe multi-tier agent context integration for existing repos
**Status:** DONE
**Verified:** NO
**Request:** Make `youmd` able to improve agent/project operating context without clobbering mature `CLAUDE.md`, `AGENTS.md`, `.cursor/rules`, or existing `project-context/` structures. Support fresh scaffold, minimal merge, and zero-touch modes.
**Expanded Scope:** `.you/` should be the safe generated layer, but You.md should still make additive edits to top-level agent files so normal agents/tools actually discover and use the context. Prefer one standard managed bootstrap block for existing repos rather than too many subtle tiers. Non-additive rewrites, deletions, or consolidations should require an explicit approval flow.
**Verification:** In a fresh repo, `youmd skill init-project` scaffolds everything. In an existing repo, it inserts or updates one standard managed bootstrap block, adds missing context files only, creates `.you/` supplemental context, and avoids rewriting user-owned docs. Any requested destructive cleanup shows a preview and requires approval.

### 43. Productize the "agent operating system" workflow that works in this repo
**Status:** DONE
**Verified:** NO
**Request:** Ensure the packaged You.md CLI/skills bundle can replicate the behavior seen in this repo: agents read repo instructions first, read `project-context/` before substantial work, track multi-part requests, and treat updates to `TODO.md`, `FEATURES.md`, `CHANGELOG.md`, `feature-requests-active.md`, and `PROMPTS.md` as part of completion.
**Verification:** A user installs You.md in a new repo and a fresh agent session behaves this way out of the box. In an existing repo, You.md safely teaches the same workflow through additive bootstrap blocks, linked host-specific skills, and scaffolded missing files without clobbering user-owned docs.

### 44. Reconcile You.md with the validated cross-agent stack-sync workflow
**Status:** DONE
**Verified:** NO
**Request:** Before implementing the new bootstrap plan, audit what You.md already ships versus what is marketed, then ensure the product design incorporates the recently validated cross-agent pattern: shared instruction layer, shared skill layer, mapped portable overlap settings, persistent stack inventory, and host-specific entrypoints that still preserve tool-native behavior.
**Verification:** There is one clear bundled-skill source of truth. Dashboard/docs/README match shipped behavior. The new You.md bootstrap model works coherently with cross-agent stack sync instead of competing with it, and the product can clearly explain what is global/shared, repo-local, generated, mirrored, and tool-specific.

### 45. Ship-readiness audit across CLI, MCP, API, and web-agent parity
**Status:** IN PROGRESS
**Verified:** NO
**Request:** Hard-test the actual CLI/skill flows locally, ensure You.md API + MCP sync correctly, and audit the You Agent/onboarding/web shell so local and web experiences are highly consistent with a clear bias toward the local CLI/TUI power-user surface. Produce a comprehensive improvement plan and QA plan covering endpoints, functionality, UI/UX, personality, proactiveness, and cross-agent usage with Claude/Codex/etc.
**Progress (2026-04-18):** Completed the first evidence pass, then followed with multiple real hardening passes. Smoke-tested `skill init-project` scaffold/additive modes, `mcp --json`, `mcp --install`, live public API + MCP behavior, and the authenticated CLI flow (`register`, `login`, `login --key`, `whoami`, `push`, `pull`, `diff`, `status`, `keys list`, `sync`) against fresh production accounts. Fixed broken web-domain MCP discovery/transport, stale 4-skill web-shell copy, portrait tool-use handling, nested `/me` auth parsing, vendor `+json` public-profile parsing, local publish-state persistence, public-profile markdown fetching, and publish→pull→diff round-trip drift. Follow-up auth migration work replaced the Clerk-first web/CLI path with first-party passwordless auth, validated local `/api/auth/*` signup/login/logout/session flows, validated CLI `register`/`login`/`whoami` against dev, validated real production email delivery + verify-code + session cookies + `/shell` hydration on `you.md`, and validated production API-key issuance plus CLI `whoami` against the live prod backend. The web-shell parity pass fixed a frontend latency issue where the shell waited on `/chat/ack` before streaming the main response, added an explicit blank-response fallback instead of silent nothingness, and added same-origin web-domain proxies for `/api/v1/chat`, `/api/v1/chat/ack`, and `/api/v1/chat/stream` so the shell, docs, and public surface stop contradicting each other. Also cleaned stale auth/shell/docs copy (`v0.1.0`, "dashboard", dead auth endpoints, fake MCP command). Continuation audit work verified the Vercel deploy was actually `Ready`, confirmed live production `POST /api/v1/chat` and `POST /api/v1/chat/ack` return `200`, reproduced browser-level shell mutation journeys against disposable authenticated accounts, and fixed three more concrete quality bugs: local web auth minted `localhost`-issuer Convex tokens when pointed at remote Convex, custom-section saves could clobber `profile.youJson`, and completed custom-section turns could be re-applied on later unrelated requests because stale raw mutation history kept being forwarded back into the model. The latest pass re-verified local browser auth after restarting the stale dev server, re-verified production browser shell access, fixed `youmd chat` so closed stdin stops crashing with `ERR_USE_AFTER_CLOSE`, fixed the clean browser-level custom-section replay repro by pruning resolved mutation turns and storing the final rendered assistant completion text in LLM history, fixed the production shell's exact project-scaffold golden path by replacing the fragile LLM-only write flow with a deterministic scaffold mutation that now creates the real `private/projects/*` tree on `you.md`, and then re-verified the post-login production shell bootstrap path plus the live authenticated bundle contents so the scaffolded project files are now proven in the real published bundle rather than only in UI copy. New blocker uncovered during this auth-depth pass: passwordless email delivery is still effectively in Resend testing mode until production uses a verified sender (`AUTH_EMAIL_FROM` / `RESEND_FROM_EMAIL`), so non-owner accounts and plus-address aliases are not yet fully release-ready. This pass also moved the local CLI much closer to the intended “meet U” feel by adding a real `you` launcher, portrait-forward startup, home-bundle fallback, update-aware startup hints, active-bundle parity for read-only commands like `status`, `diff`, `export`, and `preview`, a one-question-at-a-time first-run setup loop inside `you`, a much smaller compact portrait bounding box so the launcher stops overwhelming narrow terminals, a compact web `/initialize` portrait render, removal of the stale Clerk-era middleware file that blocked Next 16 builds beside `src/proxy.ts`, a `0.6.22` CLI release bump, cleaner npm package output without compiled test artifacts, `you`-first docs/marketing copy, explicit Turbopack root config, stale auth architecture doc cleanup, and a web-domain MCP proxy fix for response bodies. The newest local CLI passes also fixed the exact worthless-`you` transcript and the follow-up continuation failure: running `you` inside `youmd/cli` resolves the real repo root, the opener now names the top real release blocker, `start` and `continue` both select `read_project_context` deterministically, the tool reads AGENTS/CLAUDE/package/current-state/TODO files, and U prints concrete action items instead of hallucinating that it cannot read the filesystem or drifting into stale BAMF profile context. Trusted Publishing now reaches CI install/test/build, but npm still rejects publish until the `youmd` package has the GitHub Actions trusted publisher configured on npm. Remaining major blocker: the broader transcript-level web-agent personality/proactiveness/product-behavior audit still needs its own focused pass.
**Verification:** There is a concrete ship-readiness plan, a real end-to-end test matrix, a bug/repro inventory for the web agent, a parity audit for local vs web, and a prioritized fix list that can be executed to reach public-release quality.

### 46. Replace Clerk with first-party passwordless auth modeled on foldermd
**Status:** IN PROGRESS
**Verified:** NO
**Request:** Drop Clerk, simplify aggressively, and move You.md to a first-party passwordless auth model similar to foldermd: email code / magic link for humans, HTTP-only sessions for the web, scoped API keys for CLI/MCP/agents, and one internal user identity rather than Clerk-owned auth.
**Progress (2026-04-16):** Added first-party auth/session tables and mutations in Convex, switched Convex auth to `customJwt`, added web auth routes (`send-verification`, `verify-code`, `verify-link`, `session`, `logout`, `/.well-known/jwks.json`), replaced the app-side Clerk provider with `YouAuthProvider`, replaced the sign-in/sign-up flows with sequential passwordless terminal UX, removed the last live Clerk package dependency from the web app, migrated CLI `register`/`login` to email-code auth, fixed Convex no-emit config to stop regenerating stray `.js` files, synced the new signer/JWKS env, validated local web auth plus CLI auth against the new flow, validated the real production email-code/session flow on `you.md`, validated authenticated production shell hydration, validated prod API-key issuance plus CLI `whoami`, and retired the legacy password/webhook routes to explicit deprecation responses while removing stale Clerk CSP/auth copy. Continuation work also fixed a local-development parity bug where the web app could mint `localhost`-issuer Convex JWTs while talking to a remote Convex deployment, which caused silent auth rejection during local shell QA.
**Progress (2026-04-17 update):** The first-party passwordless stack is now clearly the live auth path, and the production session/bootstrap flow is verified after login. This pass also exposed one remaining release blocker: the web auth route was still hardcoded to `onboarding@resend.dev`, which leaves Resend in testing-recipient mode. The route now supports `AUTH_EMAIL_FROM` / `RESEND_FROM_EMAIL` and returns an explicit error when production is still using the test sender, but the deployed environment still needs a verified sender configured before non-owner accounts can rely on email-code auth.
**Verification:** Production `you.md` supports passwordless sign-up/sign-in/sign-out/session refresh, the dashboard works on the new first-party auth stack, CLI `register`/`login`/`whoami` work against production, and the old Clerk-dependent paths/webhooks/password endpoints are removed or explicitly deprecated.

### 47. Let users reveal/copy current API keys again and clean up key-panel confusion
**Status:** DONE
**Verified:** NO
**Request:** The settings pane should let users reveal/show and copy active API keys again instead of forcing endless new key creation, and it should stop making the key list feel like a giant pile of still-live credentials when most of them are just revoked history.
**Progress (2026-04-17):** Added reveal support for newly issued API keys by storing owner-revealable encrypted plaintext alongside the existing hash-only auth record, kept auth validation on `keyHash`, added a `revealKey` mutation with owner checks + security logging, upgraded the settings pane to show/hide/copy revealable active keys, hid revoked key history behind an explicit toggle, and updated copy to explain the one-time migration reality: older keys created before reveal support remain hash-only and need one rotate to become revealable going forward.
**Verification:** On production, newly created or rotated API keys show a `show key` action in settings, reveal the plaintext for owner copy, and old revoked/history keys stay collapsed by default unless explicitly expanded.

### 48. Consolidate the right-panel nav into more intuitive grouped labels
**Status:** DONE
**Verified:** NO
**Request:** The dashboard panel nav is cluttered and confusing. Group/consolidate it into more intuitive labels that people instantly understand instead of a long flat row of niche tabs.
**Progress (2026-04-17):** Reworked the shell preview nav into grouped top-level buckets (`profile`, `content`, `share`, `agents`, `insights`, `portrait`, `account`) with secondary sub-tabs only when needed (`files/history`, `agents/skills`, `settings/secrets/help`). This now applies on both desktop and mobile instead of exposing the old long flat tab strip everywhere.
**Verification:** On the deployed shell, the right panel shows grouped primary categories with small secondary tabs only for grouped areas, and the mobile shell uses the same grouping model instead of exposing every pane as its own top-level tab.

### 49. Fix stale CLI auth state and add a real logout path
**Status:** DONE
**Verified:** NO
**Request:** The local CLI should not stay stuck on the disposable `@clitest...` machine state, and logging into a real production account with `youmd login --key ...` should not verify that key against stale dev endpoints. There also needs to be a proper `youmd logout`.
**Progress (2026-04-17):** Fixed CLI endpoint handling so auth requests resolve the configured API/app URLs per request instead of caching stale values at module load, forced fresh logins back onto the production defaults, cleared stale `username` / `email` on key login, and added `youmd logout` to clear local auth state from `~/.youmd/config.json`.
**Verification:** Run `youmd logout`, then `youmd login --key ...`, then `youmd whoami`. The CLI should resolve the real production identity cleanly instead of saving the key but reporting a 401 from the old dev backend.

### 50. Make the curl installer the default CLI onboarding path
**Status:** DONE
**Verified:** NO
**Request:** Add a `curl ... | bash` installer like gstack/OpenClaw, make it the primary CLI CTA on the homepage, and keep npm as the secondary install option. The docs and in-product help should all teach the same curl-first path.
**Progress (2026-04-17):** Added `https://you.md/install.sh`, which installs `youmd@latest` globally via npm and prints next steps. Updated the hero/footer CLI CTAs to use tabbed curl-vs-npm install cards, updated the landing-page how-it-works steps, updated docs/README/in-app help to teach the curl path first, and kept npm as the explicit fallback for users who prefer direct package-manager installs.
**Verification:** `curl -fsSL https://you.md/install.sh | bash` installs the CLI, `youmd --version` works in a fresh shell, and the homepage/docs/help all show curl first with npm as the secondary option.

### 51. Fix the blocked npm publish retry after 0.6.1 already landed
**Status:** DONE
**Verified:** NO
**Request:** Publishing `0.6.1` failed because npm already had that version. The CLI package should be bumped again and the package metadata warnings from npm should be cleaned up before the next publish attempt.
**Progress (2026-04-17):** Confirmed `youmd@0.6.1` is already live on npm, bumped the CLI to `0.6.2`, normalized the `bin` entries to clean `dist/...` paths, normalized the repository URL to `git+https://...`, and rebuilt the CLI so the runtime version + MCP user-agent match the next publish target.
**Verification:** `node cli/dist/index.js --version` returns `0.6.2`, `cli/package.json` and `package-lock.json` both say `0.6.2`, and `npm publish` should now target `0.6.2` without the prior overwrite error.

### 52. Make the installed CLI feel alive and proactive instead of assuming the user knows the commands
**Status:** DONE
**Verified:** NO
**Request:** The installed CLI should feel more like meeting a friendly wingman agent such as Claude Code/OpenClaw: logo/mascot energy, portrait-in-code when available, proactive suggestions, helpful next steps, and less of a “here’s a command list, good luck” vibe. This should not be limited to onboarding; normal `youmd` and `youmd chat` entry should feel alive too.
**Progress (2026-04-18):** Bare `youmd` now opens with the YOU logo, an optional saved portrait preview, a more human greeting, contextual next moves, and repo-aware setup suggestions instead of the old dry mini help state. `youmd chat` now enters with the same U-style opening, notices missing AGENTS/project-context wiring in a real repo, and no longer prints the first streamed assistant greeting twice. npm postinstall is no longer deadpan either — it now prints a small U-style install moment that points users toward `youmd`, `youmd login`, and `youmd chat`. The follow-up local-launch pass then added the stronger portrait-forward `you` entrypoint, bot greeting, and proactive intro so the “meet U” vibe is no longer limited to onboarding or the bare `youmd` welcome.
**Verification:** Run bare `youmd` in a normal shell and `youmd chat` from a directory with your bundle. Both should feel noticeably more alive, and `youmd chat` should only print the opening assistant turn once.

### 53. Evaluate a `you` command alias for U
**Status:** DONE
**Verified:** NO
**Request:** If it can be done safely, it would be ideal to type `you` to start the local U agent.
**Progress (2026-04-18):** Accepted the collision risk and shipped the alias in the CLI package. `you` now launches straight into U chat when the user is authenticated and a bundle exists, falls back to the home bundle in `~/.youmd` when there is no local `.youmd/`, and still preserves normal subcommand usage like `you status`. Local smoke tests passed from the repo root with no local `.youmd/`: `printf '/done\\n' | node cli/dist/you.js` rendered the YOU logo, Houston's portrait-in-code, the bot greeting, proactive intro copy, and exited cleanly; `node cli/dist/you.js status`, `diff`, and `export` now resolve the same active home bundle instead of pretending nothing is initialized.
**Verification:** Install the published CLI globally, run `you` from a directory without a local `.youmd/`, confirm it launches U chat using the home bundle, and confirm `you status` and other read-only commands still work as aliases for the active bundle.

### 39. Identity-Aware Skill System — Full Implementation
**Status:** DONE
**Verified:** NO
**Request:** Build The Library-inspired skill system with identity interpolation, YAML catalog, bundled skills, CLI commands, cross-project sync, agent linking, meta-improvement, web dashboard pane.
**Verification:** Run `youmd skill list` (shows 7 bundled skills), `youmd skill install all`, `youmd skill init-project` in a fresh repo (generates AGENTS.md + CLAUDE.md + project-context/ + .you/ + .claude/skills/), `youmd skill use youstack-start` with identity data populated (all {{var}} resolved), `youmd skill link claude`, web dashboard shows skills tab.

### 40. Git Self-Hosting vs Convex Architecture Decision
**Status:** DECIDED — Convex stays as source of truth, git as optional export channel in v2
**Verified:** N/A (architecture decision, not code)
**Request:** Should users self-host identity as GitHub repos?
**Decision:** Keep Convex canonical. Content-hash version control already works. Git would add complexity without adding value. Future: `youmd export --github` as optional mirror.

---

## CLI UX (from March 25 conversations)

### 1. BrailleSpinner color rotation + lightsweep effect
**Status:** DONE (e6955b4)
**Verified:** NO
**Request:** Spinner animation rotates through shades of orange. Lightsweep effect on text itself (brightness sweep across characters).
**Verification:** Run youmd init, observe spinner colors rotate and text has sweeping brightness.

### 2. Profile images + ASCII portraits synced CLI → web
**Status:** DONE (code exists)
**Verified:** NO
**Request:** CLI properly passes profile images and ASCII portrait data to web API on push/sync. Portraits generated locally should persist on server.
**Verification:** youmd init → generate portrait → youmd push → check web dashboard portrait pane shows same portrait.

### 3. Text formatting improvements
**Status:** DONE (16402b1)
**Verified:** YES
**Request:** Fix jumbled text, proper word wrapping, left alignment, line breaks between paragraphs.

### 4. Track all requests in feature-requests.md
**Status:** DONE (this file)
**Verified:** YES

### 5. Update CLAUDE.md with request tracking instructions
**Status:** DONE (CLAUDE.md rewrite 2026-03-26)
**Verified:** NO

### 6. Green OK for status indicators in CLI
**Status:** DONE (e6955b4)
**Verified:** NO
**Request:** Green checkmarks/indicators for live/active/done status are acceptable alongside orange accent.

### 7. CLI first-party auth (no API token needed for your own account)
**Status:** DONE (a6d5c3d)
**Verified:** NO
**Request:** Users should authenticate as themselves from the CLI without hand-managing API tokens. API tokens are for agent/app access, not basic account login.
**Verification:** `youmd register` → email code → account created → `youmd login` → email code → authenticated session + API key saved → `youmd whoami` succeeds.

### 8. ASCII portrait within first 3 interactions
**Status:** DONE (8d64e95)
**Verified:** NO
**Request:** After username + name + first social handle, immediately show ASCII portrait in terminal.
**Verification:** Run youmd init, after providing first social handle, portrait renders before next question.

### 9. Multi-select UI for agent/tool selection
**Status:** DONE (310816c)
**Verified:** NO
**Request:** Arrow keys to navigate, right to select, left to deselect. Pre-filled options for coding agents and web agents.

### 10. YOU ASCII logo on opening screen
**Status:** DONE (8d64e95)
**Verified:** NO
**Request:** Block-char YOU logo renders in burnt orange at start of youmd init.

---

## Web UI (from March 24-25 conversations)

### 11. Profile sections should be dynamic/flexible
**Status:** TODO
**Request:** Profiles shouldn't be bound to same sections every time. Users should chat with agent to add custom sections. Default sections as template, but extensible.
**Verification:** In dashboard terminal, ask agent "add a section called Research Interests" → new section appears on profile.

### 12. Agent chat thinking/streaming should match Claude Code style
**Status:** PARTIALLY DONE
**Request:** Activities, thinking, structured responses should look and feel like Claude Code. Currently "very unimpressive."
**Verification:** Compare web chat UX side-by-side with Claude Code.

### 13. Share prompts should include directive for agent response
**Status:** DONE (already implemented — RESPONSE_DIRECTIVE in SharePane.tsx)
**Verified:** NO
**Request:** When copying share prompt, include 1-2 directive lines telling the receiving agent HOW to respond after reading the you.md context. Agent should confirm what it received and how it will persist/use it.
**Verification:** Copy share prompt → paste to ChatGPT → ChatGPT responds with specific acknowledgment of identity data.

### 14. You Agent thinks it can't do things
**Status:** TODO
**Request:** Agent says "the system handles that in the backend" when asked to manage portraits/images. Agent IS the system. It should be able to do anything the system can do.
**Verification:** Ask agent "show me all my portraits" → it displays them. Ask "update my portrait to use my x.com profile" → it does it and shows the result.

### 15. Show portraits in web chat
**Status:** PARTIALLY DONE
**Request:** Portraits should display in chat when switched, created, or requested. "Can you show me all my portraits?" should work.
**Verification:** In web terminal, type "show me my portrait" → ASCII portrait renders inline in chat.

### 16. Reveal/copy existing API key (not just revoke-to-create)
**Status:** PARTIALLY DONE
**Request:** In web UI settings, user should be able to reveal and copy their existing API key instead of having to revoke and create a new one.
**Progress (2026-04-17):** Settings now supports the operationally useful path: `rotate key` creates one fresh key, reveals it immediately for copy, and revokes the old pile; `revoke all keys` cleans up stale keys without touching share links or other token types. Existing historical keys are still not revealable because the backend stores only hashes, not reversible ciphertext. Follow-up UX hardening now hides revoked keys behind an explicit history toggle so the panel reflects the real active-key state instead of showing the full graveyard first.
**Verification:** Go to dashboard /settings → API keys → use `rotate key` and confirm a fresh key is shown/copyable immediately while the old active keys are revoked. Use `revoke all keys` and confirm only API keys are revoked.

### 17. Persistent real-time progress on ALL active steps
**Status:** DONE
**Request:** BrailleSpinners/live animation on every step, not just web crawling. Every time agent is working, user sees activity.
**Verification:** Any agent operation (save, compile, scrape, LLM call) shows progress indicator.

### 53. Shell thinking indicator should feel like Codex/Claude Code
**Status:** DONE
**Verified:** NO
**Request:** Keep the braille loading animation alive while the agent is working, rotate through unique subtask-aware status text instead of one stale phrase, add a text sweep/shimmer effect to the active line, and show completed work in real time so the shell feels as alive and transparent as Codex or Claude Code.
**Verification:** In the web shell, trigger a multi-step task. The top thinking line keeps animating, rotates through active/completed subtask phrases while work is in progress, and the activity log visibly reorders/emphasizes running vs completed steps instead of freezing on one generic status.

### 54. Web/CLI agent turns should follow ack → plan → work → complete
**Status:** DONE
**Verified:** NO
**Request:** While the agent is still doing background saves/publishes/mutations, keep the active braille loader + work text visible instead of collapsing to a barely visible cursor. Then finish each turn with a stronger completion message that explains what actually changed, keeps the green programmatic notices, and proactively proposes the next highest-leverage follow-up options so the experience feels guided instead of abruptly stopping.
**Verification:** In a real shell mutation flow, the working indicator stays alive through response drafting plus the post-response mutation tail, then the assistant completion text summarizes the concrete changes and ends with proactive next-step options above the existing green notices.

### 55. Save Houston's preferred agent-session behavior into his own You.md identity and prove cross-agent discoverability
**Status:** IN PROGRESS
**Verified:** NO
**Request:** Persist Houston's preferences for how agentic chat / terminal sessions should behave — including the ack → plan → work → complete pattern and proactive next-step guidance — into his own durable You.md preferences/directives using the published npm package / skill workflow, sync them, and then verify another agent-facing surface can find that context later.
**Progress (2026-04-17):** Confirmed the last published npm package was `youmd@0.6.0`, simplified the CLI auth entrypoint so `youmd login` now offers browser sign-in on Enter, email-code login in-terminal when an email is typed, and `--key` as the explicit direct-auth path, and then corrected the repo/package version drift so the next clean publish target is `youmd@0.6.1`. The remaining blocker is account state, not the login surface: the current `~/.youmd/config.json` still points at the disposable CLI test account rather than Houston's real `@houstongolden` identity, so the preference-save proof cannot be completed honestly yet.
**Progress (2026-04-18 update):** Pulled Houston's real live bundle into `~/.youmd`, added the agent-session preferences directly into `preferences/agent.md` and `directives/agent.md`, published them as live bundle `v65`, and then verified a clean pull using the local `0.6.3` build. That exposed and then fixed a real compiler/decompiler bug: richer markdown instructions in preferences/directives/voice files were being flattened away on pull because only the structured top-line fields were preserved. The roundtrip now works correctly with the local `0.6.22` build. Remaining step: publish `youmd@0.6.22` to npm so end users get the same durable roundtrip behavior from the packaged CLI rather than only from the repo build.
**Verification:** Using the published npm package, pull Houston's real bundle, confirm the new session-behavior preferences are present in `preferences/agent.md` / `directives/agent.md`, and confirm another agent-facing surface can read or leverage that context without manual re-entry.

### 56. Make the `you` launcher feel truthful, proactive, and portrait-consistent
**Status:** DONE
**Verified:** NO
**Request:** Tighten the local `you` launch experience so it feels like a real wingman encounter rather than a static splash: make the bot art more solid, make the startup portrait follow Houston's actual default/public portrait, make onboarding feel like the same encounter, and ensure the "sipping bitbucks frappaccino" idea maps to real active investigation work rather than decorative fake-thinking copy.
**Progress (2026-04-18):** Hardened the `you` launcher so it now runs a real local-context investigation before speaking, keeps a live braille spinner active while it scans nearby AGENTS / CLAUDE / project-context signals, and then reports concrete findings instead of bluffing that it already looked around. Reworked the terminal bot into a chunkier block shape that sits more naturally beside the YOU logo. Tightened the encounter copy so the final speech line points at real active work ("taking a lap through your recent work"). Also fixed a contract bug on the public profile path: the CLI wrapper for `/api/v1/profiles` was stripping `_profile` metadata, so the launcher could not actually see the live profile portrait metadata it was supposed to prefer. The public profile payload now includes `_profile.asciiPortrait`, and the CLI portrait resolver now prefers current profile/portrait data before stale cached avatar fallbacks. Follow-up improvements: the launcher now scans recent project contexts for actual openings instead of only listing project names, that scan falls back to the home `~/.youmd/projects` root when `you` is launched from arbitrary directories, and it now also notices ordinary workspace repos that already have `AGENTS.md`, `CLAUDE.md`, `.youmd-project`, or `project-context/` so the proactive suggestions stay useful outside the managed You.md project format. The web `/initialize` flow now passes live progress metadata into the terminal shell, prompts the first greeting to sound like the same local U encounter, includes a portrait-first encounter strip above the onboarding terminal, and now also carries the actual YOU logo framing so the scene composition matches the local launcher more closely. The latest fixes also make the portrait encounter responsive in narrow terminals by stacking the portrait, bot, and speech vertically when the side-by-side scene would overlap, deepen the startup investigation so U reads home-level shared agent docs plus recent Claude-side session activity, compact the terminal portrait so the web-profile ASCII payload does not flood/truncate the terminal, slow the scan enough to feel intentional, collapse the duplicated startup output into two findings plus one concise strongest-move opener, and replace the two one-off host bridges with a real local tool loop so U can choose `discover_projects`, `read_project_context`, `write_project_context`, `sync_identity`, or `respond` while the CLI host performs the filesystem/bundle work. Remaining step: verify after deploy that the startup portrait now matches Houston's current default/public portrait on the live profile and tune the live layout balance if needed.
**Verification:** After the latest deploy and npm publish, run `you` from a fresh shell. The startup should show the updated bot art, keep a live spinner active while U investigates local context, print real findings, and render the same portrait-in-code that the public profile exposes as Houston's current default portrait.

### 57. Teach `you` consistently across install and onboarding surfaces
**Status:** DONE
**Verified:** NO
**Request:** Once `you` exists as the real wingman entrypoint, make sure the surrounding install/login/init/onboarding guidance consistently points people there instead of making them memorize the older `youmd chat` path.
**Progress (2026-04-18):** Updated the installer output, CLI register success copy, example-init next steps, conversational onboarding next-step block, and README quickstart/command table so the product consistently teaches `you` as the main alive terminal entrypoint after a bundle exists. `youmd chat` still exists as the explicit long-form command, but it is no longer the dominant path in the first-run guidance.
**Verification:** Run the curl installer, register/login/init, and read the README quickstart. The next-step guidance should consistently suggest `you` once the identity bundle exists.

---

## SEO/AEO (from March 24-25)

### 18. Full SSR for all profile pages
**Status:** DONE (0d003f9, e41a056, 73556f9)
**Verified:** YES (profiles render in SSR HTML)

### 19. JSON-LD on all profile pages
**Status:** DONE (73556f9)
**Verified:** NO
**Verification:** View page source of you.md/houstongolden → JSON-LD script tag present with correct data.

### 20. OG cards verified across platforms
**Status:** DONE (code exists)
**Verified:** NO
**Verification:** Share you.md/houstongolden on X, LinkedIn, Slack → preview card shows correctly.

### 21. Sitemap includes all profiles
**Status:** DONE
**Verified:** NO
**Verification:** Visit you.md/sitemap.xml → all profiles listed with correct URLs and timestamps.

---

## Architecture/Documentation (from March 26)

### 22. ARCHITECTURE.md with full system diagram
**Status:** DONE (2026-03-26)
**Verified:** NO

### 23. PRD.md rewrite (full product requirements)
**Status:** DONE (2026-03-26)
**Verified:** NO

### 24. CURRENT_STATE.md (what's deployed vs broken)
**Status:** DONE (2026-03-26)
**Verified:** NO

### 25. CLAUDE.md rewrite (complete operating manual)
**Status:** DONE (2026-03-26)
**Verified:** NO

### 26. TODO.md refresh (match git log)
**Status:** DONE (2026-03-26)
**Verified:** NO

### 27. Memory file consolidation
**Status:** IN PROGRESS
**Verification:** Memory index lists all files, no duplicates, CLI feedback consolidated.

---

## Agent System (from March 24-25)

### 28. Proactive source refresh
**Status:** DONE (code in useYouAgent)
**Verified:** NO
**Request:** Agent detects stale sources (>7 days) and suggests re-scraping.

### 29. Session compaction
**Status:** DONE (code in useYouAgent)
**Verified:** NO
**Request:** When conversation exceeds 120k chars, summarize old messages and continue.

### 30. CLI directives in chat context
**Status:** DONE (chat.ts)
**Verified:** NO
**Request:** CLI chat injects agent_directives from you.json into LLM context.

### 31. Project-aware CLI context injection
**Status:** DONE (config.ts, chat.ts)
**Verified:** NO
**Request:** CLI detects when in a project directory, injects project-specific context into agent conversations.

---

## Unfulfilled / Future Requests

### 32. MCP endpoint (mcp.you.md/{username})
**Status:** TODO
**Source:** PRD v2.0, multiple conversations

### 33. Stripe Pro plan billing
**Status:** TODO — BLOCKED (needs Stripe account)

### 34. Verified badges
**Status:** TODO
**Request:** Domain verification, social verification, DNS TXT records.

### 35. Profile analytics dashboard
**Status:** TODO
**Request:** Views, agent reads, top queries, traffic sources.

### 36. Custom domains for profiles
**Status:** TODO

### 37. Interview mode (youmd interview)
**Status:** TODO
**Request:** Structured interview flow for deeper identity capture.

### 38. Autonomous refresh (youmd refresh)
**Status:** TODO
**Request:** Agent autonomously re-scrapes sources and updates profile.

---

## Summary

| Status | Count |
|---|---|
| VERIFIED | 4 |
| DONE (not verified) | 37 |
| DECIDED | 1 |
| PARTIALLY DONE | 2 |
| IN PROGRESS | 2 |
| TODO | 9 |
| BLOCKED | 1 |
| **Total tracked** | **56** |

## March 27 Session Additions

### 39. Clickable links in MessageBubble
**Status:** DONE (0fe89b6)
**Request:** URLs in agent messages should be clickable. Both [text](url) and bare https:// URLs.

### 40. Code block copy buttons
**Status:** DONE (0fe89b6)
**Request:** Copy button on code blocks in terminal chat.

### 41. Dashboard skeleton loading
**Status:** DONE (0fe89b6)
**Request:** Proper skeleton layout instead of "loading..." text.

### 42. Profile "updated X ago" timestamp
**Status:** DONE (0fe89b6)
**Request:** Show relative time since last update on profile pages.

### 43. Visitor CTA on profile pages
**Status:** DONE (0fe89b6)
**Request:** "want your own identity file? > create yours" for non-owners.

### 44. EditPane tab visual hierarchy
**Status:** DONE (0fe89b6)
**Request:** Accent bottom border on active sub-tab.

### 45. Activity log progress step hierarchy
**Status:** DONE (0fe89b6)
**Request:** Running steps in accent color, completed steps dimmed.

### 46. Terminal scroll indicator
**Status:** DONE (0fe89b6)
**Request:** Gradient at top when messages exist above viewport.

### 47. CLI section validation (security)
**Status:** DONE (0fe89b6)
**Request:** Validate LLM section names before writing files, prevent path traversal.

### 48. CLI crash-safe raw mode restore
**Status:** DONE (0fe89b6)
**Request:** Restore terminal raw mode on unexpected process exit during password input.

### 49. Homepage FAQ section
**Status:** DONE (403a7f6)
**Request:** 8 expandable Q&As with terminal-native styling.

### 50. Homepage before/after demo
**Status:** DONE (403a7f6)
**Request:** ProblemStrip shows real agent conversation before vs after you.md.

### 51. Homepage integration demo
**Status:** DONE (403a7f6)
**Request:** Integrations section shows actual share prompt + agent response.

### 52. CLI YOU logo upgrade
**Status:** DONE (58ba376)
**Request:** Clean block art matching Vercel PLUGINS banner style. Just "YOU" — not YOU.MD.

## June 18 Session Additions

### 137. Machine tab fresh-computer setup prompt must be agent-readable
**Status:** DONE / 90-DAY EXPANSION FOLLOW-UP PENDING
**Verified:** PARTIAL (focused CLI prompt tests, CLI build, root typecheck, production Next build, package dry-run, compiled prompt smoke, local server restart, npm `0.8.7` publish, and live Mac mini trusted-device vault restore proof passed; user-triggered 90-day expansion report pending)
**Source:** 2026-06-18 — Houston: "the copy setup command did not work at all... there were no tasks or instructions it was just the raw config file or something... it needs to include a proper claude code prompt structure with the curl install command..."
**Actionable Scope:**
1. Stop copying only the raw shell/config blob from the Machine tab. **DONE:** primary button now copies `buildFreshMachineBootstrapMessage(...)`, a Claude/Codex setup prompt with role, goal, "execute this" instruction, fenced bash command, verification checklist, project gate, env-vault contract, and done-ness rules.
2. Add MCP setup to the fresh-machine command itself. **DONE:** web-shell and CLI prompt scripts now run `youmd mcp --install claude --auto || true` and `youmd mcp --install codex --auto || true`.
3. Keep CLI prompt parity. **DONE:** `youmd machine prompt` now emits the same agent-readable prompt shape rather than the old "copy this command" wrapper.
4. Secure exposed bootstrap material. **DONE:** unused fresh-machine bootstrap keys were revoked after a key was pasted into chat; future button clicks mint a new 7-day scoped key.
5. Clarify npm status. **UPDATED:** local CLI and npm latest are now `0.8.7`, so npm fallback and `npx youmd@latest` have the fresh-machine prompt/ystack/realtime-daemon/Secret-Vault-status changes. Curl install defaults to GitHub source/main once this commit is pushed.
6. Prove on the actual Mac mini. **DONE for 30-day pass / 90-day expansion pending:** the corrected prompt installed `youmd@0.8.7`, restored env through trusted-device Secret Vault, verified project/env readiness, and synced machine proof. Houston has asked the Mac mini agent to continue the 90-day expansion and will report back.
7. Ensure ystack teaches behind-the-scenes You CLI/You Agent use. **DONE / HOSTED VERIFIED:** CLI/web fresh-machine prompts, bundled `machine-bootstrap`, Convex hosted skill seed content, and shared `.agent-shared` `/machine-sync` now instruct Claude/Codex to run `youmd` status/sync/skill/vault/portfolio/verify commands themselves and interrupt Houston only for true human-gated steps. Live `/api/v1/skills?name=machine-bootstrap` verified the new section, 30-day-first commands, explicit 90-day expansion, and Secret Vault restore path.
8. Fix latest Mac mini failure mode. **DONE LOCALLY:** strict fresh-machine setup now stops at the trusted-device Secret Vault share gate, sends a realtime machine-sync status, and prints `youmd env vault share` for the source Mac instead of auto-detecting iCloud/local vaults and asking for a passphrase in a non-TTY agent session. Local encrypted-file fallback is explicit only via `YOUMD_ALLOW_LOCAL_ENV_VAULT_FALLBACK=1` or `YOUMD_ENV_VAULT=/path/to/vault`.
9. Fix Bash 3.2 installer workaround. **DONE LOCALLY:** `install.sh` no longer expands an empty Bash array under `set -u`; the generated route now uses `NPM_GLOBAL_PREFIX` + `npm_install_global()` and has a regression test. Production route verification remains pending after deploy.
10. Reconcile source-Mac bundle drift. **DONE LOCALLY:** generated CLI/web prompts and hosted `machine-bootstrap` now run `youmd pull && youmd sync` after env-vault handling so the new Mac does not leave setup with a `remote ahead` state after source-Mac shares/envelope updates.

### 138. Make shared You.md skills, project context, and stacks sync Notion-like across trusted devices
**Status:** DONE FIRST REALTIME SLICE / 90-DAY MAC MINI FOLLOW-UP PENDING
**Verified:** PARTIAL (Convex prod deployed, production websocket sync-head smoke passed, local CLI `youmd sync --live --daemon` smoke passed, this Mac's launchd daemon set shows `com.youmd.realtime-sync` loaded, npm `0.8.7` is published, and Mac mini restored via trusted-device vault; 90-day expansion/device-message proof pending)
**Source:** 2026-06-18 — Houston: "all synced skills and you.md project context and shared local/global skills/stacks should sync real-time like Notion too ya know ? come on"
**Actionable Scope:**
1. Add an always-on realtime account-state lane instead of relying only on 5m/15m polling. **DONE:** `youmd sync --live --daemon` subscribes to Convex websocket updates through a short-lived `ys_` sync session.
2. Keep `.env.local` secret handling safe. **DONE:** the sync head only exposes encrypted-vault metadata and explicitly returns `secretValuesExposed: false`; plaintext env restore remains local/Keychain/passphrase-gated.
3. Materialize useful local state. **DONE:** live updates pull identity files, re-render installed You.md skills, and trigger bounded shared skillstack/project-context syncs.
4. Make it visible in the Machine tab and CLI. **DONE:** `com.youmd.realtime-sync` is included in daemon install/status and Machine readiness as `realtime brain / live websocket`.
5. Publish/install everywhere. **DONE for 30-day pass:** CLI `0.8.7` is published to npm, and the Mac mini setup ran with the realtime daemon, trusted-device Secret Vault share gate, and account Secret Vault status from the normal install path.
6. Make the value visible in-product. **DONE LOCAL:** Home now shows a compact `live skill mesh` proof, and Machine shows a detailed local proof for `project-clarity-audit` across shared source, rendered skill, Claude mirror, Codex mirror, You.md catalog, and Stack Map.
7. Remaining architecture gap. **OPEN:** GitHub-backed shared skill repos still use conflict-safe git sync as the materialization layer; true instant cross-device sync for every non-Convex source should add GitHub webhook/change-event ingestion into the Convex sync head.

### 139. Main YOU home feed/dashboard plus global personal/project task tracking
**Status:** VERIFIED LOCAL
**Verified:** root TypeScript pass, full production Next build, local `next start -p 3100`, Codex in-app Browser visual checks for `/shell`, `/shell?tab=home`, and `/shell?tab=tasks`, and clean browser logs.
**Source:** 2026-06-18 — Houston: "why haven't you added anything for my main YOU home feed/dashboard etc and Task tracking globally across projects and personal/non-project scoped - and tasks which need YOU ... vs tasks that just need an agent assigned..."
**Actionable Scope:**
1. Surface the existing task graph where Houston can actually see it. **DONE:** `/shell` now defaults to Home, and Home shows human-owned tasks, agent-owned tasks, personal task count, focused projects, recent shipped/moved activity, and latest brain dumps.
2. Create a dedicated global Tasks screen instead of burying triage inside Portfolio Graph. **DONE:** `/shell?tab=tasks` provides active/done, owner, and personal/project filters with quick `me`, `agent`, `doing`, `done`, and `personal` task controls.
3. Make navigation more intuitive and less redundant. **DONE:** shell nav now groups around Home, Projects, APIs, Skillstacks, Connect, Identity, Stats, and Account, with Home/Tasks first.
4. Keep text and click navigation aligned for agent-first use. **DONE:** slash commands now route `/home`, `/dashboard`, `/today`, `/tasks`, and `/taskboard`.
5. Continue the deeper minimal-surface cleanup. **OPEN:** move more long project/stack/API detail sections into dedicated drill-in pages with breadcrumbs and compact list/detail modes.
