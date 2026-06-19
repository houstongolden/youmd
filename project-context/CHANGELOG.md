# You.md — Changelog

## 2026-06-19 — Shared Project Clarity Audit skill

### feat(skills): package Project Clarity Audit outside gstack
- Added `project-clarity-audit` as a canonical shared personal-stack skill at `~/.agent-shared/claude-skills/project-clarity-audit`.
- Registered the skill in the local You.md catalog as `source: shared:project-clarity-audit` and symlinked `~/.youmd/skills/project-clarity-audit` to the shared source for YouStack/ystack visibility.
- Synced shared agent mirrors, verified `youmd skill list` / `youmd skill use project-clarity-audit`, logged the skill-governor learning, and pushed the shared stack update to `houstongolden/agent-shared`.

## 2026-06-18 — Desktop demo: tablet breakpoint + caught-up empty state

### polish(web): fix the desktop-split breakpoint for tablets/narrow windows
- Moved the desktop split (sidebar + 1/3 chat + main) from `md` (768px) up to `lg` (1024px). Below 1024 the app now uses the clean single-column layout (drawer + bottom tabs + stacked master-detail) instead of cramming the chat + main + master-detail panes into a narrow tablet width. Kept the JS (`useIsMobile`) and CSS breakpoints in lockstep at 1024 so the title-bar chrome and the layout structure always agree (no mismatched state between 768–1024).
- Converted the structural `md:` breakpoints to `lg:` in TitleBar (desktop chrome) and the EditorView/ProjectsView master-detail stacking.
- Added a "You're all caught up — agents have the rest" empty state to Home's Needs-attention (now that tasks are live shared state, this shows when nothing needs a human).
- Verified: tablet (834px) renders single-column; desktop (1440px) renders the split. TypeScript + radius lint pass; dev serves HTTP 200.

## 2026-06-18 — Desktop demo: typography/spacing rhythm sweep

### polish(web): unify view headers across `/desktop-demo`
- Added two shared header primitives — `ViewHeader` (title + description, for full-page scrolling views) and `ViewBar` (titled top bar + controls, for tool views) — so every screen shares one title treatment and vertical rhythm instead of ad-hoc per-view markup.
- Applied `ViewHeader` to Skills, Connections, Agents, and Loops (consistent `text-xl` title + description + `mb-6`); applied `ViewBar` to Graph and Tasks (gives them a real title matching the Editor/Projects bar height/padding, replacing the tiny standalone section labels).
- Net effect: page views and tool views are each internally consistent, and the whole app reads with one rhythm. Verified visually (Tasks/Graph bars match; Connections matches Skills/Agents/Loops). TypeScript + radius lint pass; dev serves HTTP 200.

## 2026-06-18 — Desktop demo: Chats wired to the conversation + empty state

### feat(web): the sidebar Chats list now actually drives the chat
- Lifted chat threads + the active thread into `DesktopShell`. Clicking a chat in the sidebar **swaps the conversation** (each thread seeds its own short history from its title; the first thread keeps the demo's canned exchange). **New chat** prepends a fresh thread, makes it active, and (on mobile) jumps to the chat pane.
- Added a proper **empty state** for a fresh chat — a centered "What can I help you with? — I'll use your full you.md context" prompt (mirrors the inspo screenshot), with the contextual suggestion chips still available below.
- Verified end-to-end (system Chromium): selecting "Draft big-bounce paper" swaps the thread, "New chat" shows the empty state and adds the thread to the sidebar. TypeScript + radius lint pass; dev serves HTTP 200.

## 2026-06-18 — Desktop demo: Loops, Chats sidebar, real task round-trip

### feat(web): Loops + sidebar Chats/account + working agent actions for `/desktop-demo`
- **Loops** (new RUNTIME view + nav): unifies recurring automations — scheduled workflows, the self-improvement loop, and the crawlers that feed the brain — each with trigger, scope, last-run, and a running/paused toggle. (Houston's request: a Loops section that holds workflows + crawlers.)
- **Sidebar restructure**: workspace/sync trigger up top, the nav sections, then a reserved **Chats** list (truncated one-line history with timestamps, Claude/ChatGPT style), and a pinned **account row** at the very bottom with a popout (theme toggle, settings, sign out). (Houston's request.)
- **Real "promote idea → task" round-trip**: lifted tasks into a single shared source of truth in `DesktopShell`, so creating one (via the Brain chat chip) shows up live in Tasks, Home "Needs attention", and the project's task list. Added a self-contained **toast** system for action feedback (task added, spawning agent, syncing machines, forging/improving a skill); the contextual chat chips now perform these real effects, not just send a message.
- Verified end-to-end (system Chromium): the Brain chip creates a task that appears in Tasks with a toast; Loops, the Chats list, and the account popout all render. TypeScript + radius lint pass; dev serves HTTP 200.

## 2026-06-18 — Desktop demo: detail-polish pass (native feel + motion)

### polish(web): make `/desktop-demo` feel like a real app
- Scoped `desktop-demo.css` (wrapper `.youmd-desktop`, kept out of globals): thin app-native scrollbars (Chromium + Firefox), a consistent accent keyboard `:focus-visible` ring, and a `prefers-reduced-motion` guard that neutralizes the demo's animations.
- Active-nav **left accent bar** (Linear/Notion-style) on the selected sidebar item, plus a subtle press scale on nav items.
- Tasteful entrance **motion** (Motion 12) — command palette and System Status fade/scale in, the main view fades on switch, and chat messages fade-up. Subtle and short (≤0.2s); reduced-motion users get none.
- Verified the page renders (HTTP 200), TypeScript + radius lint pass (new CSS uses only 2px radii).

## 2026-06-18 — Desktop demo: background-magic layer + daily-brief Home

### feat(web): make the "it just works behind the scenes" layer visible (awareness only)
- Decided and implemented the hard background/foreground line (documented in the audit, §7b). Everything that runs on its own — identity/skill/stack/project-context sync daemons, the realtime websocket, crawlers, machine sync — is now surfaced in a single **System Status popover** opened from the sidebar workspace header. It's awareness only: live daemon state + intervals + last-run, machines online, and recent background activity, footed with "managed by your daemons — nothing to configure." No controls, no config — that's the product line vs. the foreground screens you act on.
- Reworked **Home into a daily-brief command center**: an AI brief line (your agent's read on the day), a **Needs attention** list of cross-project follow-ups (high-priority / you-owned tasks, click → Tasks), the metric row, and the projects glance.
- Verified desktop + mobile render consistently (system Chromium): the status popover and the new Home reflow cleanly at 1440px and 390px. TypeScript + radius lint pass; dev serves HTTP 200.

## 2026-06-18 — Desktop demo: scope-aware chat + contextual agent actions

### feat(web): make the `/desktop-demo` agent context-aware
- The chat now knows what you're looking at. A `ChatScope` flows from `DesktopShell` into the chat: the active project (when in Projects), the open note (Brain), or the active view. The composer's context line now reads e.g. `you.md · bamfsite · claude-sonnet-4.6`, and agent replies acknowledge that scope ("using your **bamfsite** context plus your brain").
- Added **contextual suggestion chips** above the composer that adapt to the active surface — Projects: "Spawn coding-you on {project}", "Triage {project} tasks"; Brain: "Promote an idea to a task"; Skills: "Forge a new skill from a pattern"; Agents: "Sync all machines now"; etc. Clicking one sends a scope-aware message. This is the "light-touch direction" layer (surfacing meta-skills and agent actions in the flow without a config surface).
- Lifted the selected project into the shell so the Projects list, the ⌘K "Open project: X" commands, and the chat scope all stay in sync.
- Verified end-to-end (system Chromium): selecting bamfsite updates the chips + context line, and a chip click produces a project-scoped agent reply. TypeScript + radius lint pass; dev serves HTTP 200.

## 2026-06-18 — Desktop demo restructured around the MECE product model

### feat(web): audit-driven IA + Skills/Projects/Devices for `/desktop-demo`
- Ran a full product-surface audit (saved to `project-context/DESKTOP_APP_AUDIT_2026-06-18.md`): mapped every feature across web/CLI/API/YouStacks/shared-skills/second-brain/realtime-sync into four MECE buckets — **Context · Work · Capabilities · Runtime** — and defined what the desktop daily-driver intentionally leaves out vs. the web control plane.
- Restructured the demo's navigation into a sectioned rail matching the model: **Home**, then **Context** (Brain · Projects · Tasks · Graph), **Stacks** (Skills · Connections), **Runtime** (Agents · Terminal). Chat + Terminal are modes; everything else is reachable via ⌘K.
- Closed the biggest vision gaps in the mockup:
  - **Skills view (new):** stacks grouped by domain with visibility (private/scoped/public), shared skills with DRY "shared Nx · 0 duplicated" indicators, and meta-skills (meta-improve, skill-forge).
  - **Projects view (new):** the spine — per-project context, its tasks, its assigned stack, and repo/API/MCP links (connects Work ↔ Capabilities).
  - **Agents view (enhanced):** added a **Devices** section (machines syncing in realtime) and an **agent-bus** feed (cross-machine, cross-agent messages) — surfacing the realtime sync + agent-bus work that was previously invisible in the demo.
  - **Brain (was Notes):** folded memories + goals into the vault and relabeled.
- Verified the restructure visually (system Chromium): sectioned nav, Skills, Projects, and Agents/Devices all render cleanly. TypeScript + radius lint pass; dev serves HTTP 200.

## 2026-06-19 — Fresh-machine Secret Vault fallback hardening

### fix(install): remove Bash 3.2 empty-array installer crash
- Fixed the public `install.sh` generator so it no longer expands an empty Bash array under `set -u` when npm's global prefix is writable. macOS system Bash 3.2 treats `"${array[@]}"` on an empty array as an unbound variable, which forced the Mac mini run to use `YOUMD_FORCE_USER_NPM_PREFIX=1`.
- Replaced the old `NPM_GLOBAL_FLAGS=()` pattern with a Bash-3.2-safe `NPM_GLOBAL_PREFIX` string plus `npm_install_global()` helper.
- Added a route-level regression test that reads the actual `install.sh` response and asserts the Bash-3.2-safe wrapper is present and `NPM_GLOBAL_FLAGS` is absent.
- Verified the served local script via `curl http://localhost:3100/install.sh`, `/bin/bash -n`, and a fake-home npm-channel install without needing `YOUMD_FORCE_USER_NPM_PREFIX=1`; production `https://you.md/install.sh` now reads back the same helper and no `NPM_GLOBAL_FLAGS`.

### fix(machine): reconcile after trusted-device env restore
- Added a post-vault `youmd pull && youmd sync` checkpoint to both generated fresh-machine setup paths (`youmd machine prompt` and the signed-in Machine tab prompt), so source-Mac bundle changes, new trusted-device envelopes, shared skills, and synced proof state do not leave the new Mac reporting `remote ahead` after setup.
- Updated the hosted `machine-bootstrap` seed guidance with the same post-vault reconcile step.
- Reseeded production bundled skills; public `machine-bootstrap` readback now includes the post-vault reconcile and trusted-device flow.
- npm latest now reports `youmd@0.8.7`, so new npm/npx fallback installs are no longer stuck behind the Secret Vault trusted-device flow.
- Mac mini proof from the latest run: trusted-device envelope restore succeeded on device `svd_248cb16f09ddcc0f04c909d1`, restored `8` `.env.local` files from the encrypted `env-vault-2026-06-18T0741Z` snapshot, synced machine proof with `secretValuesExposed: false`, and left the 90-day expansion as the next intentional step.

### fix(cli): keep Mac mini setup on the trusted-device vault path
- Updated the fresh-machine bootstrap script generated by both `youmd machine prompt` and the web shell `/new computer` flow so strict setup no longer auto-detects local/iCloud passphrase vaults by default after trusted-device Secret Vault restore misses an envelope.
- The new default failure path registers the Mac, sends a realtime `machine-sync` status, prints the exact source-Mac action (`youmd env vault share`), and stops before marking setup ready.
- Local/iCloud encrypted-file restore still exists, but it is now explicit opt-in via `YOUMD_ALLOW_LOCAL_ENV_VAULT_FALLBACK=1` or an explicit `YOUMD_ENV_VAULT=/path/to/env-vault...`.
- Updated the hosted `machine-bootstrap` skill guidance so Claude/Codex agents do not ask Houston for a Keychain/passphrase fallback unless that older local-vault path was intentionally selected.
- Updated the bundled packaged `cli/skills/machine-bootstrap.md` with the same trusted-device-first rule so npm installs and hosted skill reads match.
- Bumped CLI runtime to `0.8.7`; generated docs/openapi/llms references now advertise `0.8.7`.
- Verification: focused CLI prompt tests passed, CLI TypeScript build passed, root TypeScript passed, and full production Next build passed.

## 2026-06-18 — Home dashboard and global task surface

### feat(shell): surface cross-project tasks as the default workspace
- Added first-class `home` and `tasks` shell panes backed by the existing Convex `portfolioTasks` and `brainDumpCaptures` graph, so global project/personal tasks are no longer buried inside Portfolio Graph detail.
- Home now opens by default for `/shell`, including compact in-app browser widths, and shows Houston-owned tasks, agent-owned tasks, personal task count, focused projects, recent shipped/moved activity, and latest brain dumps.
- Tasks now provides a focused global task router with active/done, owner, and personal/project filters plus quick assignment controls for `me`, `agent`, `doing`, `done`, and `personal`.
- Simplified shell navigation around clearer product jobs: Home, Projects, APIs, Skillstacks, Connect, Identity, Stats, and Account. Slash commands now include `/home`, `/dashboard`, `/today`, `/tasks`, and `/taskboard`.
- Verification: root TypeScript pass, full production Next build, fresh local `next start -p 3100`, and Codex in-app Browser visual checks for `/shell`, `/shell?tab=home`, and `/shell?tab=tasks`. Browser logs were clean.

## 2026-06-18 — Shell callout and sidebar logo polish

### fix(shell): make pane intro blocks consistent and readable
- Added a shared `PaneCallout` primitive matching the Skills tab treatment: subtle left accent line, faint left-to-right gradient, dark background, 2px radius, and restrained terminal typography.
- Moved the Skills, Machine/new-computer setup, and Vault top explainer blocks onto the shared callout so copyable prompt/setup sections keep one visual language.
- Replaced the unreadable solid-orange Vault explainer with the shared callout while preserving the private-notes vault explanation.
- Contained the top sidebar YOU mark in a fixed `40px` square button with inner padding so expanded/collapsed sidebar states no longer crop the logo.
- Verification: root TypeScript pass, full production Next build, local `next start -p 3100`, and Codex in-app Browser visual checks for Vault, Skills, Machine, and collapsed sidebar logo. No browser console warnings/errors observed.

## 2026-06-18 — Desktop demo light/dark theme switch

### feat(web): visible theme toggle for `/desktop-demo`
- Added a discoverable light/dark switch in the sidebar footer (sun/moon, "Light mode" / "Dark mode"), backed by a `useTheme` hook that toggles the `.light` class and persists `localStorage.theme` exactly like the rest of the site's pre-hydration theme bootstrap.
- Theme state lives in `DesktopShell` and is shared by both the sidebar toggle and the ⌘K palette "Toggle light / dark theme" action, so they stay in sync.
- Verified the full demo in light mode (warm off-white canvas, white panels, burnt-orange accent preserved across nav, chips, metrics, and project dots) — the design system's light variant holds up across every view. Toggle verified dark → light → dark; TypeScript + radius lint pass; dev serves HTTP 200.
- Note: this work and future desktop-demo polish lives on a new branch / PR (`claude/desktop-demo-polish`) since the original demo PR (#23) was already merged.

## 2026-06-18 — Desktop demo ⌘K command palette

### feat(web): real command palette for `/desktop-demo`
- Built a working ⌘K / Ctrl+K command palette (`CommandPalette.tsx`) — the title bar's "Search or run a command…" button and the mobile search icon now both open it instead of being dead UI. The whole product surface in one input, Notion/Linear/Raycast-style.
- Grouped commands: **Navigate** (every view), **Notes** (open any vault file directly), **Projects** (jump into the graph), and **Actions** (spawn a YOU sub-agent, toggle light/dark theme, focus/split chat).
- Full keyboard control: ⌘K toggles, type to fuzzy-filter, ↑/↓ to move across groups, Enter to run, Esc/backdrop to close; mouse hover also selects and the active row auto-scrolls into view.
- Lifted the Notes editor's active-file state into `DesktopShell` so the palette can open a specific note (verified: filtering "voice" + Enter opens `identity/voice.md`).
- Verified end-to-end via Playwright (system Chromium): shortcut opens it, filtering works, Enter runs the command and routes to the editor. TypeScript + radius lint pass; dev serves HTTP 200.

## 2026-06-18 — Desktop demo mobile polish (swipe + safe areas)

### feat(web): native-feeling mobile gestures and notch handling for `/desktop-demo`
- Added swipe gestures via a new `useSwipe` hook (touchstart/touchend only — never preventDefault, so it can't break scrolling): edge-swipe right (within 32px of the left edge) opens the drawer, swipe left closes it. Verified end-to-end with synthetic touch events (`translate -100% → 0 → -100%`).
- Added safe-area insets so the chrome dodges the notch and home indicator on modern phones: title bar gets `pt-[env(safe-area-inset-top)]` (now `min-h` so it grows below the notch instead of squishing) and the bottom tab bar gets `pb-[env(safe-area-inset-bottom)]`. Enabled `viewport-fit=cover` via a page-scoped `viewport` export so those insets actually resolve.
- Drawer now casts a shadow over the dimmed workspace for clearer depth.
- Verified on a 390×844 phone viewport (system Chromium): swipe open/close works, layout intact, TypeScript + radius lint pass, dev serves HTTP 200.

## 2026-06-18 — Mobile-responsive desktop demo (`/desktop-demo`)

### fix(web): make the desktop app demo usable on phones
- Made `/desktop-demo` fully responsive (it was desktop-only and looked broken on mobile). Added a `useIsMobile` hook (matchMedia `< 768px`, SSR-safe — starts desktop, corrects on mount, no hydration mismatch).
- Mobile layout: the macOS title bar collapses to a menu button + title + search icon (traffic lights / wide command bar / split-vs-full toggle hidden); the left sidebar becomes an off-canvas drawer with a dimmed backdrop (tap a nav item or the backdrop to close); the desktop split (chat + main view) collapses to a single column with a bottom tab bar that swaps between **Chat** and the active **Workspace** view.
- View-level responsiveness: Home metric grid/quick-actions reflow, Notes stacks the vault file tree above the document (was a side rail), Tasks kanban stacks vertically, Connections grids go single-column, the Graph legend collapses to dots and nodes reflow via percentage positions, padding tightens across views, and the terminal helper label hides on small screens.
- Verified on a 390×844 phone viewport (system Chromium via Playwright): chat, drawer, Notes, Graph, and Tasks all render cleanly with proper tap targets. TypeScript passes for all new/changed files; `scripts/check-radius.mjs` passes; dev serves `/desktop-demo` at HTTP 200 with no runtime errors.

## 2026-06-18 — Trusted-device Secret Vault envelopes

### feat(vault): make fresh-machine env restore device-key based
- Added trusted-device Secret Vault escrow on top of encrypted account snapshots: Convex now stores registered device public keys and per-device encrypted passphrase envelopes in `secretVaultDevices` and `secretVaultKeyEnvelopes`, with owner-gated `GET/POST /api/v1/me/secret-vault/devices` and `/envelopes`.
- Added CLI commands `youmd env vault device-register`, `youmd env vault device-list`, and `youmd env vault share`. The local private key stays under `~/.youmd/secret-vault/devices/current-device-key.json`; only the public key and wrapped passphrase envelopes sync to You.md.
- Updated `youmd env vault pull --restore` so trusted devices register first, fetch their key envelope, unwrap the vault passphrase locally, and restore without raw `.env.local` values touching browser/chat/server logs.
- Hardened `youmd env vault share` so it validates the source passphrase against the latest encrypted snapshot with list-only local decrypt before writing envelopes, preventing bad Keychain/passphrase data from being shared.
- Updated CLI/web `/new computer` setup prompts and the bundled/hosted `machine-bootstrap` skill to use the device-register -> source `vault share` -> pull/restore flow before local/iCloud fallback.
- Extended realtime daemon status from snapshot-only readiness to `account-backed-encrypted-snapshot+trusted-device-envelopes`, including trusted device count and latest-snapshot envelope count with `secretValuesExposed: false`.
- Verification: Convex codegen, CLI build, root TypeScript, focused machine/realtime tests, docs check, production build, Convex production deploy, hosted skill reseed, live source-Mac `device-register`, live `vault share` with passphrase validation, headless `vault pull --restore` proof into an empty temp root, and realtime status showing `Secret Vault ready: 16 projects / 451 vars ... / 1/1 device envelopes`.
- npm latest is still `youmd@0.8.5`; publish `0.8.6` before rerunning the Mac mini setup through npm/npx fallback.

## 2026-06-18 — Reference-intelligence follow-through visibility

### chore(reference-intelligence): make daily upstream audits harder to misread
- Verified that `steipete/agent-scripts` did have recent upstream activity on 2026-06-15 and 2026-06-16; the prior "no new commits" phrasing was only true relative to the last local sync head, not as a plain-English statement about recent upstream activity.
- Updated `scripts/reference-intelligence.mjs` so generated reports now show the latest upstream commit timestamp and age for every tracked repo, while still separately reporting whether there was a delta since the previous local sync.
- Added `project-context/reference-intelligence/FOLLOW_THROUGH.md` as the durable ledger of shipped reference-derived improvements and pending accepted tasks, so the daily loop has an explicit audit -> tracked task -> shipped outcome path.
- Updated reference-intelligence docs and project trackers so future runs are expected to record accepted and shipped work, not only regenerate `LATEST.md` and `TASKS.md`.

## 2026-06-18 — Realtime agent bus and CLI 0.8.6 prep

### feat(sync): let trusted local agents message each other through You.md
- Added an owner-gated realtime agent bus backed by Convex: trusted devices can send/list redacted status messages through `POST/GET /api/v1/me/agent-bus/messages`.
- Added CLI commands `youmd agent send`, `youmd agent inbox`, and `youmd agent status`. The realtime daemon materializes a safe inbox at `~/.youmd/agent-bus/inbox.json` and includes agent-bus state in `~/.youmd/realtime-sync-status.json`.
- Fresh-machine prompts now tell Claude Code/Codex to publish setup milestones with `youmd agent send --channel machine-sync --kind status ...`, so the source Mac can see the Mac mini come online over the realtime protocol.
- The Machine pane now surfaces `realtime agent bus` near the top of the Machine tab, including state, latest message time, inbox path, send command, and recent safe messages.
- Updated and redeployed the hosted `machine-bootstrap` skill seed so the production skill catalog includes `youmd agent status`, `youmd agent inbox`, `youmd agent send`, and `machine-sync` guidance.
- Hardened fresh-machine root generation so a literal `$HOME/Desktop/CODE_YOU` argument expands correctly instead of creating a literal `$HOME` directory.
- Follow-up from the Mac mini run: fresh-machine setup now forces `YOUMD_INSTALL_CHANNEL=source YOUMD_SOURCE_REF=main` and refuses to continue unless `youmd` is at least `0.8.6`, preventing stale npm installs such as `0.8.2` from attempting Secret Vault restore with missing commands/flags. The public `install.sh` route now has the same version gate and auto-upgrade defaults to source.
- Bumped CLI package to `0.8.6`; Houston needs to publish `youmd@0.8.6` to npm before the Mac mini gets these commands through npm fallback / `npx youmd@latest`.
- Verification: CLI build, root TypeScript, full production build, focused machine-bootstrap prompt tests, Convex production deploy, hosted skill reseed/read-back, live `youmd agent send`/`inbox`, live websocket materialization showing `2 agent msgs`, and secret-leak scans of the local status/inbox JSON all passed.

## 2026-06-18 — Native desktop app design demo (`/desktop-demo`)

### feat(web): private, frontend-only desktop app UI/UX demo
- Added a self-contained, non-functional design demo for the upcoming You.md native desktop app at `/desktop-demo` (route group `src/app/(desktop)/`). The goal is to lock the new lighter "second brain" aesthetic — Notion × Obsidian × Conductor × Claude — before building the real Tauri/RN app. All data is mocked locally; nothing touches Convex or the API. The route is `robots: noindex/nofollow` and renders with no SiteNav/marketing chrome.
- Keeps the You.md design DNA (monochrome + burnt orange `#C46A3A`, JetBrains Mono labels, Inter body, 2px radius token, status dots) but trades the heavy CLI treatment for a calmer, zen, modern-SaaS surface.
- Layout: macOS-style title bar (traffic lights, breadcrumb, ⌘K command bar, sidebar + chat-layout toggles); full-height collapsible left sidebar (workspace switcher, primary nav, projects); and a workspace that swaps between two chat modes — **split** (agentic chat at 1/3 left + main view 2/3 right, Lovable-style) and **full chat** (chat fills the workspace with a Codex-style sticky AI summary widget top-right).
- Main views: Home/dashboard, Notes (Notion/Obsidian file tree + tiny dependency-free markdown reader/editor with read/edit toggle), an Obsidian-style interactive knowledge Graph (SVG nodes/edges, hover-trace), Tasks (kanban, click-to-advance), Connections (apps/crawlers/MCP), Sub-agents ("YOU sub-agents" — clone-yourself spawn flow with progress steps), and a Conductor/Cmux-style Terminal that runs Claude Code / Codex / shell tabs inside the app.
- Verification: production `next build` compiled successfully and passed TypeScript for all new files; `node scripts/check-radius.mjs` passes; dev server serves `/desktop-demo` at HTTP 200 with expected content and no runtime errors. (Pre-existing `/auth` prerender failure in this sandbox is env/auth-related and unrelated to this route. Screenshots blocked — Playwright browser download is disallowed by the network policy.)

## 2026-06-18 — Secret Vault realtime daemon status and CLI 0.8.6 prep

### feat(sync): expose account-backed env snapshot readiness in realtime status
- Extended `realtimeSync.getHead` so vault-scoped realtime sessions report the account-backed encrypted Secret Vault snapshot flow as `ready`, `missing`, or `scope-missing`, including snapshot count, safe file metadata, encryption tool, project/variable counts, source host/root, sha256 fingerprints, and `secretValuesExposed: false`.
- Added a local secret-safe `~/.youmd/realtime-sync-status.json` written by `youmd sync --live --daemon`, so Claude/Codex and the Machine pane can inspect Secret Vault readiness without parsing logs or downloading/decrypting env files.
- Updated `youmd status`, `youmd stack daemon status`, and the Machine pane to display the realtime Secret Vault state and copyable account pull/restore commands.
- Bumped the CLI package to `0.8.6`; npm publish with OTP is now required before the Mac mini normal npm/npx install path has this Secret Vault realtime-status flow.
- Fixed the Secret Vault HTTP route for the Convex runtime by replacing Node `Buffer` conversions with runtime-safe base64 helpers, then tightened list/upload responses so they do not return manifest text by default. Explicit download for restore remains the only path that returns the safe manifest.
- Verification: CLI build, root typecheck, focused realtime/machine prompt tests, Convex codegen, docs regeneration/checks, agent-docs CI, production Next build, Convex production deploy, account Secret Vault push, safe list smoke (`manifestText` absent), production realtime websocket smoke (`vaultStatus: ready`, `16` projects, `451` variables, no archive bytes), and local `youmd stack daemon status` showing `secret vault: Secret Vault ready...` all passed. Remaining proof: publish `youmd@0.8.6` and rerun Mac mini setup.

## 2026-06-18 — Realtime trusted-device sync daemon and CLI 0.8.4 prep

### feat(sync): add Convex websocket materialization for local agents
- Added short-lived realtime sync sessions: `POST /api/v1/me/realtime-sync/session` mints a limited websocket credential from an authenticated API key, and `realtimeSync.getHead` returns a secret-safe sync head for identity bundle hashes, installed skills, portfolio graph counts, repo mirror state, GitHub mirror state, machine proof counts, and encrypted env-vault metadata only.
- Added CLI `youmd sync --live --daemon`, backed by the official Convex client. The live loop subscribes to Convex updates, pulls identity files, re-renders installed skills, and triggers bounded shared stack/project-context syncs while keeping timer daemons as repair/fallback.
- Added `com.youmd.realtime-sync` LaunchAgent with `KeepAlive=true`; `youmd stack daemon install/status`, `youmd status`, the local Machine pane, and machine-readiness metadata now show `realtime brain / live websocket`.
- Updated fresh-machine prompts to install/confirm resident realtime + identity + skillstack + project-context daemons early.
- Bumped the CLI package to `0.8.4` and pinned the CLI Convex runtime to `1.33.1`. Superseded by `0.8.6` after adding Secret Vault realtime-status support. npm publish is required for npm fallback / `npx youmd@latest`.
- Verification: `npx convex codegen`, `npx convex deploy --yes --typecheck enable`, CLI build, focused CLI realtime + machine prompt tests, production Next build, agent-docs syntax, production websocket sync-head smoke (`56` projects / `10` skills / `14` tasks / `secretValuesExposed: false`), `youmd sync --live --daemon` CLI smoke, and local `youmd stack daemon install/status` proof all passed.

## 2026-06-18 — Fresh-machine agent autonomy and CLI 0.8.3 prep

### fix(machine): teach setup agents to use You.md behind the scenes
- Updated the CLI and web-shell fresh-machine prompts so Claude Code/Codex are explicitly instructed to run You.md CLI/You Agent commands themselves (`status`, `pull`, `sync`, `skill sync`, `env vault`, `portfolio-hydrate`, `machine verify`) before interrupting Houston.
- Updated the bundled `machine-bootstrap` skill and hosted Convex seed content with the same behind-the-scenes operating rule, plus the 30-day strict env-vault setup prompt as the default handoff.
- Updated shared `/machine-sync` in `.agent-shared` so Claude/Codex/Cursor/Pi skill mirrors treat You.md Secret Vault as the primary trusted-device env path and interrupt Houston only for GitHub auth, Keychain/passphrase, npm OTP, OS permissions, or the explicit 90-day expansion.
- Bumped the CLI package to `0.8.3` in this slice; later realtime + Secret Vault status slices supersede the pending npm target to `0.8.6`. npm publish is now needed for `npx youmd@latest` and npm fallback installs; curl/source installs can track GitHub once this commit is on `main`.

## 2026-06-18 — You.md Secret Vault trusted-device env sync

### feat(machine): make env sync account-backed before local fallback
- Added account-backed Secret Vault v1 for encrypted `.env.local` transfer: owner-gated `secretVaultSnapshots` records, encrypted archive storage in Convex file storage, `GET/POST /api/v1/me/secret-vault/env`, checksum verification, safe manifest metadata, and activity logging for `vault_read` / `vault_write`.
- Added CLI `youmd env vault push/list/pull`; `push` creates the encrypted local env vault, uploads ciphertext plus a safe manifest only, `pull` downloads the latest encrypted snapshot into `~/.youmd/secret-vault`, and `pull --restore` uses the fresh-machine defaults `--map-existing --existing-only --skip-agent-auth`.
- Fresh-machine CLI/web prompts now mint bootstrap keys with `vault` scope, check You.md Secret Vault before local Desktop/iCloud fallback, and keep `.env.local` values out of browser prompts and logs.
- Fixed the Mac mini path bug found in round 2: generated commands now assign `YOUMD_CODE_ROOT="$HOME/Desktop/CODE_YOU"` instead of single-quoting `~/Desktop/CODE_YOU`.
- Updated the Machine pane and bundled `machine-bootstrap` skill so the source-machine command is `youmd env vault push --root ~/Desktop/CODE_2025 --out ~/Desktop/youmd-env-vault`, and Keychain service `youmd-env-vault` setup is documented as the headless restore gate.
- Deployed the Convex backend so the live `.site` API now serves `GET /api/v1/me/secret-vault/env`; live CLI `youmd env vault list` returns a safe empty state with `secretValuesExposed: false`.
- Added clearer CLI guidance for stale/non-vault auth failures so a local agent sees “refresh auth or use a vault-scoped key” instead of a vague Secret Vault failure.
- Verification: `npx convex codegen`, `npx convex deploy`, focused fresh-machine parity tests, CLI build, root `npx tsc --noEmit --pretty false`, root `npm run build`, `npm run docs:check`, `npm run lint` (warnings only), compiled `youmd machine prompt --require-env-vault` smoke, live `youmd env vault list` safe empty-state smoke, and env-vault backup/restore bash syntax all passed.
- Visual-testing note from Houston: future UI proof for this thread should use real Chrome, gstack/browser, or the Codex in-app browser, not headless Chrome or Playwright.
- Remaining proof: run the real source-Mac `youmd env vault push`, rerun the generated command on the Mac mini, and verify Secret Vault pull, env restore, synced skills/stacks, active project clones, and the Machine pane proof row from that host.

## 2026-06-18 — Mac mini fresh-machine audit fixes

### fix(machine): make new-computer setup less trial-and-error
- Hardened the generated CLI/web fresh-machine script from the actual Mac mini setup notes: prerequisite checks now run first for Homebrew, Node 22/npm, git, GitHub CLI, bun, and pnpm/corepack; the setup shell forces You.md/Homebrew/Node 22 paths; GitHub auth is required before private `agent-shared` and project clones; resident daemons install immediately after identity sync; and recoverable `youmd machine setup` warnings no longer abort the whole prompt.
- The generated command now auto-detects env vaults in both local Desktop and iCloud Desktop, then restores project env files with `youmd env restore --map-existing --existing-only --skip-agent-auth` so archived names like `foldermd` map to cloned dirs like `folder-md` and active Claude/Codex auth files are not clobbered.
- Added restore flags to the env-vault CLI/bash contract: `--map-existing`, `--existing-only`, and `--skip-agent-auth`, with docs for the fresh-machine restore path.
- Hardened `youmd machine setup` itself so it exports the same PATH and verifies `gh auth` before cloning private shared-skill repos.
- Made terminal `you` chat handle `/new computer` and natural fresh-machine setup requests deterministically by printing the setup prompt instead of sending the slash command to the remote agent.
- Improved `https://you.md/install.sh` PATH persistence so You.md runtime paths are written for zsh and bash profiles, not only the user-npm-prefix case.
- Verification: bash syntax checks, focused CLI/web parity tests, CLI build, root typecheck, production Next build, docs check, lint/radius, compiled prompt smoke, raw bash fake env-vault mapping proof, and compiled CLI fake env-vault mapping proof all passed. Local `next start -p 3100` is running from the fresh build.

## 2026-06-18 — Machine setup prompt correction

### fix(machine): copy a Claude/Codex setup prompt instead of a raw shell blob
- Changed the Machine tab primary action from copying only the raw bootstrap shell command to copying a full Claude Code/Codex prompt with role, goal, execution instructions, fenced curl setup command, verification checklist, project gate, env-vault rules, and done-ness contract.
- Added explicit `youmd mcp --install claude --auto` and `youmd mcp --install codex --auto` steps to both the web-shell and CLI fresh-machine bootstrap scripts.
- Updated `youmd machine prompt` to match the web prompt shape so CLI-generated fresh-machine setup artifacts are agent-readable too.
- Reworded the Machine tab hero/button from `copy setup command` to `copy setup prompt`.
- Revoked unused fresh-machine bootstrap keys after a key was pasted into chat; future Machine tab copies mint a fresh 7-day scoped key.
- Confirmed npm state: local CLI is `0.8.2`, npm latest is still `0.8.0`, and `0.8.2` is not published yet. The curl installer defaults to source-from-GitHub, but npm fallback / `npx youmd@latest` remain stale until publish.
- Verification: focused CLI prompt tests, CLI build, root typecheck, root lint/radius, production Next build, `npm pack --dry-run`, and compiled prompt smoke passed. Local `next start -p 3100` was restarted from the fresh build.

## 2026-06-18 — Machine tab new-computer setup surface

### feat(machine): copy the fresh-Mac bootstrap command from Machine
- Added a top-of-pane `new machine setup` terminal panel to the Machine tab, matching the Skills tab's intro-block style.
- The primary button mints a 7-day scoped `fresh-machine bootstrap` key from the signed-in shell and copies the full Claude Code/Codex setup command directly from the Machine tab.
- The copied command is the same graph-backed flow used by `/new computer`: install You.md, authenticate, sync identity, restore shared skills/stacks and host config, create `~/Desktop/CODE_YOU`, clone active + Top Priority/Focusing projects from 30 days first, ask before 90-day expansion, restore the encrypted env vault, sync a machine proof, and install resident daemons.
- Added a fallback button for copying `/new computer` when the user wants the shell chat to mint the command instead.
- Verification: `npx tsc --noEmit --pretty false`, focused ESLint, full `npm run lint`, and `npm run build` passed. Headless Playwright redirected to sign-in, so signed-in visual click proof remains pending in the visible shell.

## 2026-06-18 — Portfolio graph hydrate and sync hash repair

### fix(cli): keep pull/status in sync after publishing the latest bundle
- Re-ran the real Portfolio Graph hydrate from `/Users/houstongolden/Desktop/CODE_2025`: `131` auditor projects scanned, `30` local hydration candidates, `40` GitHub tracked rows updated, `30` local audit rows upserted, and `9` reusable patterns refreshed from `8240` scanned files.
- Re-verified the new-computer setup gate from the hydrated graph: 30-day first pass now selects `15` active + Top Priority/Focusing projects, while the explicit 90-day expansion selects `17`.
- Published the latest owner bundle v137, then fixed `youmd pull` so it prefers the authenticated published latest bundle from `/api/v1/me` over a potentially stale public profile response.
- Verification: focused CLI pull tests pass (`18`), CLI build passes, and live `node cli/dist/index.js pull --force && node cli/dist/index.js status` now reports local and remote hash `33b6cc43a67d` with status `in sync`.

## 2026-06-17 — Fresh-machine command refreshed

### chore(machine): restore immediate `/new computer` clipboard handoff
- Re-ran the authenticated web-shell `/new computer` flow after finding the macOS clipboard empty during goal continuation.
- Minted a fresh 7-day scoped bootstrap key and copied the full `8783` character setup command to the macOS clipboard without printing the key.
- Redacted proof confirms the command targets `~/Desktop/CODE_YOU`, requires strict env-vault restore, auto-detects the newest `~/Desktop/youmd-env-vault/env-vault-*` archive, tries Keychain service `youmd-env-vault`, uses `--recent-only`, includes active + Top Priority/Focusing setup gate language, asks before 90-day expansion, runs the hosted install curl, and passes `bash -n`.
- Re-verified the real vault inventory from `~/Desktop/youmd-env-vault/env-vault-2026-06-17T2317Z.tar.enc`: `17` `.env.local` files and `3` agent-auth files by variable names/counts only, no values printed.
- Verification screenshot: `/tmp/youmd-new-computer-command-refresh-2026-06-17.png`.

## 2026-06-17 — Shell dedicated path detail pages

### fix(shell): route project, stack, and skill drill-ins to real sub-pages
- Portfolio project details now open at dedicated shell paths such as `/shell/projects/bamfaiapp` instead of the older `/shell?tab=portfolio&project=bamfaiapp#project-detail` query/hash state.
- Legacy detail URLs now upgrade in place: `/shell?tab=portfolio&project=bamfaiapp#project-detail` redirects to `/shell/projects/bamfaiapp`, while `#strategy` and `#timeline` are preserved as section anchors.
- Legacy stack and skill query states now upgrade too: `?stack=youstack` -> `/shell/stacks/youstack`, and `?skill=portfolio-graph-auditor` -> `/shell/skills/portfolio-graph-auditor`.
- The shell router recognizes `/shell/projects/<slug>`, `/shell/stacks/<slug>`, and `/shell/skills/<name>` and opens the correct right pane on hard refresh.
- Top-level shell tab switches now return to `/shell?tab=...` from a detail route, so stale detail pathnames do not leak across panes.
- Portfolio rows and timeline links now point to `/shell/projects/<slug>` and `/shell/projects/<slug>#timeline`; `#timeline` still scrolls the nested pane after graph hydration.
- YouStacks and Skills now use `/shell/stacks/youstack` and `/shell/skills/portfolio-graph-auditor` for focused detail pages with `<< back` breadcrumbs.
- Verification: `npm run lint`, `npx tsc --noEmit`, `npm run build`, and authenticated Playwright QA for legacy project/stack/skill URL upgrades, breadcrumb back, hidden portfolio-wide sections on project detail, and route-backed detail links. Screenshots: `/tmp/youmd-dedicated-project-route-proof-2026-06-17.png`, `/tmp/youmd-dedicated-skill-route-proof-2026-06-17.png`.

## 2026-06-17 — Fresh-machine env-vault auto-detect proof

### fix(machine): auto-detect transferred env vaults during strict setup
- Fresh-machine CLI and web-shell commands now auto-detect the newest `~/Desktop/youmd-env-vault/env-vault-*` file when `YOUMD_ENV_VAULT` is not supplied, then continue through the existing strict env-vault list/restore path.
- Verified the real encrypted vault at `~/Desktop/youmd-env-vault/env-vault-2026-06-17T2317Z.tar.enc`, tightened its permissions to `600`, and confirmed macOS Keychain service `youmd-env-vault` can supply the passphrase without printing it.
- Secret-safe list proof showed `17` `.env.local` files and `3` agent-auth files in the vault with variable names/counts only and no secret values.
- Restore proof restored `17` `.env.local` files into a disposable root and confirmed the agent-auth restore path, again without printing secret values.
- The current macOS clipboard contains a fresh 7-day `/new computer` setup command with `~/Desktop/CODE_YOU`, strict env-vault mode, vault auto-detection, Keychain passphrase lookup, `--recent-only`, and the 90-day expansion prompt; the embedded script passed `bash -n`.

## 2026-06-17 — Local MCP persisted portfolio graph

### fix(mcp): stop local agents from seeing the four-project fallback graph
- `youmd://portfolio/graph` now returns the authenticated persisted `/api/v1/me/portfolio/graph?includeTasks=1` snapshot when available, including exact project docs/curl fields, shipped counts, setup eligibility, tracked repos, API surfaces, dependency edges, reusable patterns, and tasks.
- `get_agent_brief` now maps that persisted snapshot into the compact `## Portfolio Graph` startup section instead of always using the static four-project fallback.
- `get_project_context` now resolves project-scoped Portfolio Graph slices from the persisted graph before falling back to the bundled static graph.
- Fresh-machine env-vault restore commands now try macOS Keychain service `youmd-env-vault` for `ENV_VAULT_PASS` before prompting, while still never embedding `.env.local` values in prompts.
- Verification: full CLI test suite (`565` tests), CLI build, root `npx tsc --noEmit`, machine-sync preflights, portfolio hydration (`56` projects / `40` tracked repos), compiled 30-day planner (`16` selected), compiled 90-day planner (`17` selected), and live MCP SDK proof showing `youmd://portfolio/graph` returns `56` projects and `get_project_context` for `bamfaiapp` returns a ready persisted slice.

## 2026-06-17 — Shell drill-in detail navigation

### fix(shell): make portfolio, stacks, and skills details dedicated sub-pages
- Portfolio project details now open as a clean URL-backed shell detail page at `/shell?tab=portfolio&project=<slug>` instead of an anchored lower-page appendix.
- The Portfolio list stays compact at `/shell?tab=portfolio`; opening a project hides global portfolio-wide sections and shows `<< back to projects`, overview, strategy, timeline nav, exact graph/API/MCP/stack commands, and selected-project shipped context.
- The old `#project-detail` hash is normalized away; `#strategy` and `#timeline` remain section anchors inside the detail page.
- Fixed nested-pane hash scrolling so direct `#timeline` reloads wait for graph hydration and scroll the shell's inner overflow container until the shipping timeline is visible.
- Added the same compact-list-to-detail pattern for YouStacks (`/shell?tab=stacks&stack=youstack`) and Skills (`/shell?tab=skills&skill=portfolio-graph-auditor`), both with breadcrumb back navigation.
- Verification: `npx tsc --noEmit`; `npm run lint -- --file src/components/panes/PortfolioGraphPane.tsx --file src/components/panes/StacksPane.tsx --file src/components/panes/SkillsPane.tsx` (existing repo warnings only); authenticated Codex in-app Browser QA for project list/detail/back, direct timeline hash visibility, stack detail/back, and skill detail/back.

## 2026-06-17 — Fresh-machine direct clipboard handoff

### chore(machine): refresh synced skills and copy the setup prompt directly
- Refreshed machine-sync state for the source Mac: `.agent-shared` was already up to date, shared skill mirrors synced into local agent runtimes, and `youmd sync` pulled the latest remote draft into `~/.youmd` while re-rendering all `10` local skills.
- Minted a fresh scoped bootstrap key through the authenticated API and generated the same graph-backed 30-day-first fresh-machine prompt without relying on the Browser plugin's virtual clipboard.
- Wrote the full prompt to the macOS clipboard using `pbcopy`; redacted proof confirmed a `10,153` character prompt / `7,633` character command with `ym_...`, `~/Desktop/CODE_YOU`, `YOUMD_REQUIRE_ENV_VAULT=1`, hosted install curl, `--recent-only`, active + Top Priority/Focusing setup gate, and the interactive 90-day `[y/N]` expansion prompt.
- Re-ran env readiness checks: You.md env preflight found `17` `.env.local` files and `3` agent-auth files, and portfolio audit scanned `270` projects / `23` env files / `97` providers without reading secret values.
- Remaining blocker: no `~/Desktop/youmd-env-vault/env-vault-*.tar.enc` file exists. With no GPG recipient, 1Password CLI, or age recipient configured, the safe path is the interactive symmetric/passphrase backup; do not fake a secure env vault.

## 2026-06-17 — Fresh-machine command copy reliability

### fix(shell): make `/new computer` command copying real
- Fresh-machine code blocks now use a visible `copy command` button instead of the generic hover-only copy affordance.
- The 7k+ generated setup command is bounded to an internal scroll area so the copy control stays reachable instead of being pushed far above the visible shell.
- Clipboard writes now use the secure Clipboard API when available, fall back through an explicit `copy` event + `execCommand`, and show `copy failed` if neither path succeeds.
- Authenticated Codex in-app Browser proof clicked the real `/shell` `copy command` button and verified, in redacted form, that the clipboard contains the full generated command with `ym_...` bootstrap key, `~/Desktop/CODE_YOU`, `YOUMD_REQUIRE_ENV_VAULT=1`, hosted install curl, `--recent-only`, active/focus setup gate, and the interactive 90-day expansion prompt, with no `.env.local=` or `sk-...` secret patterns.
- Verification: `npx tsc --noEmit`, focused `npx eslint src/components/terminal/TerminalBlocks.tsx` (existing `<img>` warning only), CLI/web fresh-machine parity specs through Vitest, `npm run lint` (existing warnings only), `npm run build`, and authenticated browser clipboard proof.
- Remaining gap: the long-running fresh-machine goal is still open until the copied command runs on the actual new computer with the real encrypted env vault and synced proof row.

## 2026-06-17 — Portfolio dedicated project detail pages

### fix(portfolio): turn project detail into a drill-in page
- Portfolio project details now render as a URL-backed drill-in state instead of an inline detail panel below the compact project list.
- `/shell?tab=portfolio` keeps the overview compact with operating model, shipped pulse, filters, and dense rows, and renders no `#project-detail` node until a project is opened.
- `/shell?tab=portfolio&project=bamfaiapp#project-detail` hides global portfolio/task/brain/skill sections and shows the project detail page with `<< back to projects`, overview, strategy, and timeline anchors.
- Breadcrumb back navigation clears `project=` and returns to the compact Portfolio list.
- Follow-up remains open: apply the same list-to-detail drill-in pattern to Stacks, APIs/env, Skills propagation, task triage, and brain-dump records.
- Verification: `npx tsc --noEmit`, `npm run lint` (existing warnings only), `npm run build`, and authenticated Codex in-app Browser QA for list, detail, and breadcrumb-back states.

## 2026-06-17 — Portfolio recency and active setup gate proof

### feat(portfolio): make manual active overrides obvious for fresh-machine setup
- Portfolio project rows now distinguish GitHub recency (`github updated X ago`) from newer Portfolio activity (`graph signal X ago`) so fresh-machine setup decisions are easier to sanity-check.
- The project toolbar now shows active/inactive/setup-eligible counts, and active/inactive buttons are styled as explicit one-click setup-exclusion toggles with manual override badges.
- Verification: local Browser QA on `/shell?tab=portfolio&project=bamfaiapp#timeline` showed `active 47`, `inactive 9`, `setup eligible 24`, row `github updated` labels, and a reversible `h-computer` active toggle (`active -> inactive -> active`). Screenshot: `/tmp/youmd-portfolio-recency-active-toggle-setup-gate-proof-2026-06-17.png`.
- Machine planner proof: `youmd machine projects --root ~/Desktop/CODE_YOU --days 30 --limit 80 --dry-run --recent-only` selected `16` projects; the 90-day dry-run selected `17`; both printed `setup gate: Portfolio Graph status=active and focus=Top Priority/Focusing only`.
- Env-vault proof: `youmd env backup --root ~/Desktop/CODE_2025 --out ~/Desktop/youmd-env-vault --preflight` found `17` `.env.local` files and `3` agent-auth files, with no secret values printed. No `~/Desktop/youmd-env-vault/env-vault-*.tar.enc` file exists yet, so the real new-computer strict run remains open.

## 2026-06-17 — Fresh-machine env-vault handoff clarity

### fix(machine): make the new-computer handoff self-contained
- The generated CLI and web-shell fresh-machine commands now print the exact old/source Mac vault creation command when `YOUMD_ENV_VAULT` is missing: `youmd env backup --root ~/Desktop/CODE_2025 --out ~/Desktop/youmd-env-vault`.
- The web-shell `/new computer` command now explicitly includes `YOUMD_CODE_ROOT='~/Desktop/CODE_YOU'` and `YOUMD_REQUIRE_ENV_VAULT='1'`, so the default web artifact fails instead of pretending setup is complete when the encrypted vault is missing.
- The Machine pane copyable checks now surface `/new computer`, `youmd machine prompt --root ~/Desktop/CODE_YOU --days 30 --limit 80 --require-env-vault`, and the source-machine env-vault backup command.
- Verification: focused CLI prompt/parity tests, CLI build, root TypeScript, root lint/radius, root production build, compiled `youmd machine prompt --root ~/Desktop/CODE_YOU --days 30 --limit 80 --require-env-vault` smoke, and authenticated Codex in-app Browser QA on local `/shell?tab=machine`. Screenshot: `/tmp/youmd-machine-fresh-handoff-commands-proof-2026-06-17.png`.
- Remaining gap: the actual brand-new-computer run with the real env vault is still open and must not be marked complete until verified on the target machine.

## 2026-06-17 — Portfolio setup eligibility filter proof

### feat(portfolio): expose the exact new-computer setup gate in project rows
- Added a first-class `setup eligible` Portfolio status filter and count using the same rule as `youmd machine projects`: `status=active` plus focus `Top Priority` or `Focusing`.
- Added row/detail setup badges (`setup yes` / `setup skip`) beside the existing `last updated` time-ago labels, and made the row `active` / `inactive` toggle visibly button-like with accessible action labels.
- Tightened CLI wording so `--include-inactive` reads as an audit override, and dry-runs now print `setup gate: Portfolio Graph status=active and focus=Top Priority/Focusing only`.
- Verification: focused CLI planner/prompt/parity tests, CLI build, root TypeScript, root lint/radius, root production build, compiled graph dry-run (`56` projects / `40` tracked repos -> `16` selected / `84` skipped plus setup-gate line), and authenticated Codex in-app Browser QA on local `/shell?tab=portfolio&project=bamfaiapp#timeline`. Browser proof confirmed `LAST UPDATED`, `SETUP YES`, active buttons, `setup eligible` filter narrowing to `24 / 56`, and a reversible `bamfaiapp-next` status mutation (`inactive -> active -> inactive`). Screenshot: `/tmp/youmd-portfolio-setup-eligible-filter-toggle-proof-2026-06-17.png`.

## 2026-06-17 — Fresh-machine prompt parity and portable root

### fix(cli/shell): keep `/new computer` aligned with active focus setup gate
- Tightened the web shell `/new computer` response so the visible artifact says the same thing the planner enforces: fresh-machine setup clones only projects marked `ACTIVE` plus `Top Priority`/`Focusing`, while inactive, unsorted, on-ice, abandoned, killed, and unreviewed GitHub-only repos are skipped by default.
- Added a CLI regression test that reads the web `useYouAgent` source and fails if the visible shell prompt drifts away from the strict machine setup gate, env-vault strictness, 90-day expansion control, or required bootstrap scopes.
- Fixed `youmd machine prompt --root ~/Desktop/CODE_YOU` portability: when the source shell expands `~` to `/Users/...`, the generated paste command and explanatory text now convert the path back to `~/Desktop/CODE_YOU` before handing it to the new computer.
- Verification: focused CLI tests (`machine-bootstrap-prompt`, `machine-projects`, `fresh-machine-web-parity`), CLI build, root lint/radius, root production build, compiled prompt smoke proving portable `YOUMD_CODE_ROOT='~/Desktop/CODE_YOU'`, live graph dry-run (`56` projects / `40` tracked repos -> `16` selected / `84` skipped), and authenticated local Browser QA of `/new computer` showing a secret-bearing copyable command with the active-focus project gate, env-vault guard, 90-day expansion flag, and no `.env.local=` or `sk-...` secret patterns.

## 2026-06-17 — Portfolio active setup gate

### feat(portfolio): add active/inactive controls and setup eligibility policy
- Added `last updated` time-ago labels to compact Portfolio project rows and selected project details, using latest activity/GitHub signal before record update timestamps.
- Added a status filter (`all status`, `active`, `inactive/not active`) and one-click status pills that toggle project status between `active` and `inactive` through owner-gated Convex state.
- Added `statusSource` / `statusUpdatedAt` so manual status overrides survive dashboard seed refreshes, GitHub tracked-project hydration, and local project upserts.
- Tightened `youmd machine projects` and fresh-computer prompt copy: when Portfolio Graph records exist, setup selects only `active` projects whose focus is `Top Priority` or `Focusing`; inactive, unsorted, on-ice, abandoned, killed, and unreviewed GitHub-only repos are skipped by default.
- Added `--include-inactive` as an explicit CLI override for audit/legacy runs.
- Verification: focused CLI planner/prompt tests, Convex status-hydration regression, `npx convex codegen`, `npm run test:convex -- convex/portfolio.test.ts`, `npm --prefix cli run build`, `npm run lint`, `npm run build`, live graph dry-run (`56` projects / `40` tracked repos -> `16` selected / `84` skipped), and authenticated local Browser UI proof of filters/last-updated/status buttons.
- Post-push proof: GitHub CI run `27721954290` and Convex Deploy run `27721954253` passed; authenticated local Browser QA then changed `bamfaiapp-next` from `active` to `inactive` through the deployed mutation and saw `project status updated: bamfaiapp-next / inactive`.

## 2026-06-17 — Portfolio deep-link reliability

### fix(shell): keep project detail URLs and pane state in sync
- Fixed a shell state bug where `?project=<slug>` could remain in the URL after an agent workflow switched the right pane to another surface, making project detail deep links look unreliable until a full reload.
- Pane switches now update the query string, clear stale `project=` outside Portfolio, clear stale GitHub integration hints outside GitHub, and query-backed pane sync now responds to full query-string changes.
- Authenticated Codex in-app Browser QA verified direct Portfolio deep links, switching away to `?tab=stacks`, switching back to Portfolio, clicking `bamfaiapp`, search narrowing, `shipped90` sorting, API/MCP/stack/clone command visibility, clean `#timeline` navigation, shipped counters, status dropdowns, and no unreadable orange blocks.
- Screenshots: `/tmp/youmd-portfolio-clickable-detail-shipped-status-proof-2026-06-17.png`, `/tmp/youmd-portfolio-project-detail-api-mcp-curl-proof-2026-06-17.png`, and `/tmp/youmd-portfolio-command-block-scrolled-proof-2026-06-17.png`.
- Verification: `git diff --check`, focused `npx eslint 'src/app/(app)/dashboard/dashboard-content.tsx'`, `npm run check:radius`, and `npm run build`.
- Note: GitHub Actions run `27720163894` from the previous docs-proof commit failed in CLI live integration tests due to two 10s timeouts against live profile endpoints after `557` CLI tests passed; unrelated to this dashboard navigation patch.

## 2026-06-17 — Live new-computer command proof

### test(shell): mint and copy the actual fresh-machine bootstrap command
- Submitted `/new computer` in the authenticated local shell and verified the product path minted a fresh 7-day bootstrap key, embedded it in the copyable command, and switched to the Skills/Machine setup surface.
- Copied the full generated command to the in-app browser clipboard for Houston's immediate new-computer paste. The command was inspected only in redacted form for docs.
- Redacted structural proof confirmed `YOUMD_ACTIVE_DAYS='30'`, `~/Desktop/CODE_YOU`, `curl -fsSL https://you.md/install.sh | bash`, source/runtime login with the bootstrap key, portfolio hydrate before clone, `RECENT_ONLY_ARGS` detection, stdin-from-`/dev/null` fallback for older CLIs, env-vault list/restore handling, the explicit 90-day expansion prompt, and separate 30-day-vs-full completion messages.
- Remaining gap is deliberately still open: the command must run on the actual new computer with the real encrypted env vault before the long-running fresh-machine goal can be called complete.

## 2026-06-17 — Portfolio visual proof and bootstrap fallback

### fix(cli/web): make fresh-machine project planning tolerate older installed runtimes
- Added a compatibility guard to both generated fresh-machine scripts: detect `youmd machine --help` for `--recent-only`, use it when present, and otherwise run `youmd machine projects` with stdin from `/dev/null` so older fallback npm installs cannot hang on older-project prompts.
- Re-verified the generated command shape after the fallback patch: the script still starts with the 30-day project set, still asks before 90-day expansion, and still refuses to call the full project set complete unless the expansion runs.
- Authenticated Codex in-app Browser QA covered the latest dense Portfolio Graph UI at `http://localhost:3100/shell?tab=portfolio&project=youmd#project-detail`: `56 / 56`, shipped `today` / `7d` / `30d` / `90d`, search/focus/sort interactions, clickable You.md detail/timeline links, full ranked focus options, exact API/MCP docs URLs, portfolio graph curl, docs curl, stack install, repo clone command, and no unreadable orange blocks.
- Screenshots: `/tmp/youmd-portfolio-latest-details-shipped-focus-proof-2026-06-17.png`, `/tmp/youmd-portfolio-project-detail-links-proof-2026-06-17.png`, and `/tmp/youmd-portfolio-project-graph-command-block-proof-2026-06-17.png`.
- Verification: `npm --prefix cli run test -- machine-bootstrap-prompt.test.ts`, `npm --prefix cli run build`, compiled `node cli/dist/index.js machine prompt --root ~/Desktop/CODE_YOU --days 30 --limit 80` smoke, `npm run build`, and `git diff --check`.

## 2026-06-17 — Fresh-machine 30-day-first bootstrap

### feat(cli/web): make new-computer setup start with truly active 30-day projects
- Changed the generated fresh-machine bootstrap contract from 90-day-first to a 30-day first pass targeting `~/Desktop/CODE_YOU`.
- Added `youmd machine projects --recent-only` so the initial clone/directory pass skips projects outside the selected activity window without prompting or silently including them.
- Updated the CLI `youmd machine prompt` and web shell `/new computer` generators to hydrate the portfolio graph, preview/clone the 30-day set with `--recent-only`, write/sync a machine proof, then ask before expanding to all active 90-day projects.
- Added honest completion language: the generated script only reports full 90-day project setup complete after the expansion runs; otherwise it reports a 30-day setup pass with 90-day expansion still open.
- Updated bundled `machine-bootstrap` skill text, docs, Help pane, and Skills pane examples to teach `--days 30` as the default new-computer flow.
- Verification: `npm --prefix cli run test -- machine-bootstrap-prompt.test.ts`, `npm --prefix cli run build`, compiled `node cli/dist/index.js machine prompt --root ~/Desktop/CODE_YOU --days 30 --limit 80` smoke, compiled `node cli/dist/index.js machine projects --root /tmp/youmd-recent-only-smoke-CODE_YOU --days 30 --recent-only --dry-run --no-github` proof (`56` persisted projects / `40` tracked repos / `30` selected / `12` skipped outside 30d), `npm run lint` (existing warnings only), and `npm run build`.
- Immediate rescue command was provided in-chat for the new computer; it uses the current runtime and prompts before the 90-day expansion.
- Remaining gap: run the generated command on the actual brand-new computer with the real bootstrap key/env vault and verify synced skills, project clones, daemons, Machine pane proof, and Portfolio Graph sync there.

## 2026-06-17 — Portfolio dense detail polish and CLI help recovery

### feat(shell/cli): make portfolio project rows denser and graph commands more legible
- Made the Portfolio Graph project browser default to a true `dense` scan mode, while keeping `compact` and `expanded` available through the density control.
- Strengthened project-card affordances: rows remain clickable, the row action now reads `open detail`, and selected project pages expose obvious `open detail`, `timeline`, `api docs`, and `mcp` action chips.
- Clarified selected project graph links with labeled API docs, MCP docs, stack, repo, owner-gated portfolio graph curl, docs curl, stack install, and repo clone snippets.
- Replaced faint unlabeled command boxes in project and API/MCP surface details with labeled command snippets that avoid high-contrast orange blocks and keep commands readable.
- Fixed CLI help interception for `youmd project task --help` and `youmd project braindump --help`, so local agents can discover task/braindump syntax instead of seeing only generic project help.
- Verification: `npm --prefix cli run build`, `node cli/dist/index.js project task --help`, `node cli/dist/index.js project braindump --help`, `npm run lint` (existing warnings only), and `npm run build`.
- Visual note: headless Playwright reached the expected unauthenticated `/sign-in?next=/shell` redirect, so final screenshot proof for this exact UI polish remains pending in the already-authenticated Codex in-app Browser session.

## 2026-06-17 — Local portfolio interaction re-proof

### test(shell): verify compact project portfolio controls after resume
- Re-verified Houston's latest Portfolio Graph request in the visible authenticated Codex in-app Browser at `http://localhost:3100/shell?tab=portfolio`.
- Confirmed the persisted graph renders `56` projects, shipped `today` / `7d` / `30d` / `90d`, top shippers, latest shipped rows, compact search/focus/sort controls, full ranked focus labels, clickable project rows, and `details` / `timeline` anchors.
- Confirmed typed search narrows `bamfaiapp` to `2 / 56`, focus filtering narrows `Top Priority` to the You.md row, and `sort shipped 90d` orders the highest-shipping projects first.
- Confirmed the You.md detail page contains exact graph/API/MCP docs URLs, owner-gated graph/docs curl commands, `curl -fsSL https://you.md/install.sh | bash`, `git clone https://github.com/houstongolden/youmd youmd`, and owned You.md API/MCP surface curl commands.
- Confirmed the real You.md timeline link produces the clean URL `http://localhost:3100/shell?tab=portfolio&project=youmd#timeline` and scrolls to the shipping timeline.
- Ran a reversible focus-status write proof through the dashboard UI: `agent-shared` changed from `unset` to `on-ice / 3`, then back to `unset / 4`.
- Screenshots: `/tmp/youmd-portfolio-56-projects-controls-proof-2026-06-17.png`, `/tmp/youmd-portfolio-youmd-detail-graph-links-proof-2026-06-17.png`, and `/tmp/youmd-portfolio-youmd-timeline-proof-2026-06-17.png`.

## 2026-06-17 — Production portfolio exact-docs proof

### test(prod): verify BAMF project graph links on www.you.md
- Verified the pushed Portfolio Graph exact-docs fix in an authenticated production Codex in-app Browser session at `https://www.you.md/shell?tab=portfolio&project=bamfaiapp#project-detail`.
- Confirmed the production shell is signed in and renders the persisted Portfolio Graph directly, not the sign-in page: `56` projects, selected project `bamfaiapp`, shipped `today` / `7d` / `30d` / `90d`, and GitHub chrome present.
- Confirmed the selected project graph links show BAMF-specific docs and commands: `https://bamf.ai/docs`, `https://bamf.ai/docs/api/posts`, `https://bamf.ai/docs/mcp/overview`, `https://bamf.ai/docs/mcp/tools`, `curl -fsSL https://bamf.ai/bamfstack/install.sh | bash`, and `git clone https://github.com/houstongolden/bamfaiapp bamfaiapp`.
- Confirmed the BAMF API/MCP surface curl is no longer the generic You.md MCP fallback; production renders `curl -H "Authorization: Bearer $BAMF_API_KEY" https://api.bamf.ai/v1/agent/capabilities`.
- Production owner API read-back for `GET /api/v1/me/portfolio/graph?includeTasks=1` returned `56` projects and the same BAMF docs/curl/install/clone fields plus shipped counters (`19` today / `58` 7d / `58` 30d / `58` 90d) and `latestShippedCount: 5`.
- Screenshot: `/tmp/youmd-production-bamf-portfolio-graph-links-2026-06-17.png`.

## 2026-06-17 — Portfolio graph exact docs/curl refinement

### fix(web/api): make stack-aware project graph commands exact
- Re-verified the Portfolio pane in the visible authenticated Codex in-app Browser on `http://localhost:3100/shell?tab=portfolio&project=youmd#timeline`: detail/timeline links resolve cleanly, search narrowed to `2 / 56`, focus filtering narrowed to top priority, shipped-90 sorting stuck, and clicking the `bamfaiapp` project card selected `?project=bamfaiapp`.
- Found and fixed a real precision issue in the project graph details: `bamfaiapp` was falling back to generic You.md docs/curl for some API/MCP rows instead of BAMF-specific docs.
- Added stack-aware docs fallbacks for YouStack and BAMFStack/BAMFOSStack in the Portfolio pane, so project details now show exact BAMF docs such as `https://bamf.ai/docs/api/posts` and `https://bamf.ai/docs/mcp/overview`.
- Enriched owner-gated `GET /api/v1/me/portfolio/graph` project rows with `focusStatus`, `focusRank`, `apiDocsCurlCommand`, `mcpDocsCurlCommand`, `stackInstallCommand`, `cloneCommand`, `shipped`, and bounded `latestShipped` rows so local agents can consume priority, shipped activity, docs, stack, and setup commands directly from the graph.
- Added stack-aware surface curl fallbacks so BAMF API/MCP surfaces render `curl -H "Authorization: Bearer $BAMF_API_KEY" https://api.bamf.ai/v1/agent/capabilities` instead of the generic You.md MCP curl when persisted surface rows are missing a curl command.
- Visual proof: `/tmp/youmd-portfolio-bamf-exact-docs-surface-curl-final-2026-06-17.png`.
- Verification: `npx tsc --noEmit --pretty false`, `cd cli && npm run build`, `npx eslint convex/http.ts src/components/panes/PortfolioGraphPane.tsx cli/src/lib/api.ts`, `npm run test:convex -- convex/portfolio.test.ts`, and `npm run build`.

## 2026-06-17 — Portfolio detail proof refresh

### test(shell): re-verify compact project portfolio controls in the visible Codex Browser
- Re-used the visible Codex in-app Browser session on `http://localhost:3100/shell?tab=portfolio&project=youmd#project-detail` instead of relying on older screenshots.
- Verified the live persisted graph now renders `56` projects, the shipped pulse for `today` / `7d` / `30d` / `90d`, top shippers, latest shipped rows, compact project search/focus/sort controls, full ranked focus labels, and clickable project rows plus `details` / `timeline` anchors.
- Verified the selected You.md project detail page includes `PROJECT GRAPH LINKS`, exact API/MCP docs URLs, the owner-gated portfolio graph curl command, docs curl commands, `curl -fsSL https://you.md/install.sh | bash`, `git clone https://github.com/houstongolden/youmd youmd`, and owned You.md API/MCP surface curl commands.
- Ran a reversible status-write proof on the real dashboard control: `bamfsite` focus changed from `unset` to `focusing`, then back to `unset / 4`, and the pane reported `project focus updated: bamfsite / unset / 4`.
- Clicked the real You.md timeline link and verified the URL stayed clean as `http://localhost:3100/shell?tab=portfolio&project=youmd#timeline`, with the shipping timeline in view.
- Screenshot: `/tmp/youmd-portfolio-detail-shipped-focus-verified-2026-06-17.png`.
- Verification: `npm --prefix cli test -- src/__tests__/project-strategy.test.ts src/__tests__/machine-projects.test.ts` and `npm run lint -- --file src/components/panes/PortfolioGraphPane.tsx` passed with existing repo warnings only.

## 2026-06-17 — Fresh-machine strict env-vault proof mode

### feat(cli/web): prevent fresh-computer proof from passing without env restore
- Re-verified the live local Portfolio Graph request in the Codex in-app Browser at `http://localhost:3100/shell?tab=portfolio&project=youmd#project-detail`: `55` projects, shipped `today` / `7d` / `30d` / `90d`, compact controls, clickable `details` / `timeline`, ranked focus dropdowns, `PROJECT GRAPH LINKS`, API/MCP docs URLs, graph/docs/stack/clone curl commands, and current You.md shipped rows are present.
- Ran a fresh graph-backed clean-root clone proof at `/tmp/youmd-fresh-machine-proof-20260617T183447Z/CODE_YOU` with `--max-clone-projects 5`. The planner read `55` portfolio projects, `40` graph-tracked repos, and `41` recent GitHub repos, then cloned `youmd`, `agent-shared`, `bamfsite`, `houstongolden-you-md`, and `bamfaiapp` with correct GitHub remotes.
- Ran secret-safe readiness proof on that clean root. It wrote and synced a You.md machine record with `5` scanned projects, `5` git repos, `3` package projects, `0` `.env.local` files, `3` env examples, `4` agent-doc roots, `3` project-context roots, `0` ready, `3` needs env, `1` partial, and `secretValuesExposed: false`.
- Confirmed the real blocker for actual done-ness: no encrypted real env vault file was present in `.env-vault`, no `youmd-env-vault` / `YOUMD_ENV_VAULT_PASS` Keychain item exists, and the clean root correctly reports `needs-env` for `youmd`, `bamfsite`, and `bamfaiapp`.
- Added strict env-vault proof mode to the CLI generated command: `youmd machine prompt --require-env-vault` now emits `YOUMD_REQUIRE_ENV_VAULT=1`, and the generated script exits before readiness completion when `YOUMD_ENV_VAULT` is missing.
- Added the same fail-loud branch and done-ness language to the web shell `/new computer` generated command so dashboard prompts no longer encourage agents to mark setup complete without vault restore.
- Post-push production proof passed: GitHub CI and Convex Deploy completed on `bf4f5e4`, Vercel production deployment `https://youmd-cn8vux75k-hubify.vercel.app` was `Ready`, `npx convex run --prod skills:seedBundledSkills` updated all `10` hosted bundled skills, and both `https://www.you.md/api/v1/skills?name=machine-bootstrap` and the apex redirect path now expose `--require-env-vault` plus `YOUMD_REQUIRE_ENV_VAULT`.
- Ran the closest local full-path proof with a real encrypted env vault in a disposable temp home/root. The uncapped graph plan selected `43` active projects, cloned `41` git repos plus `2` directory-only projects into `/tmp/strict-real-env-bootstrap-20260617T185635Z/CODE_YOU`, and exposed a real handoff bug where `youmd machine projects --yes` could finish cloning but spin during Node shutdown after large clone output.
- Fixed that handoff by making the `machine` CLI action exit with the accumulated exit code after `machineCommand` returns. Focused regression: `timeout 45 node cli/dist/index.js machine projects --root /tmp/strict-real-env-bootstrap-20260617T185635Z/CODE_YOU --days 90 --max-clone-projects 3 --yes` exited `0` in about `3s`.
- Re-ran the strict generated command against the 43-project root with a real encrypted env vault. It installed from source, authenticated in a temp home, skipped existing clones, listed/restored `17` `.env.local` files and `3` agent-auth files without printing values, wrote/synced a machine proof row, and completed with status `0`; secret-pattern scan passed.
- Synced proof read-back from the owner-gated Convex Site API shows the latest machine row for `/tmp/strict-real-env-bootstrap-20260617T185635Z/CODE_YOU`: `48` scanned dirs, `41` git repos, `33` package projects, `17` env locals, `17` env examples, `25` ready, `8` needs env, `4` partial, `2/3` dependency installs passed, `1/2` dev-server probes passed, and `secretValuesExposed: false`.
- The full proof found another real bootstrap friction point: post-restore portfolio hydration over a large restored root can run for minutes. Added a portable `run_with_timeout` guard around both generated `portfolio-hydrate` calls in the CLI and web-shell `/new computer` prompt, defaulting to `YOUMD_PORTFOLIO_HYDRATE_TIMEOUT_SECONDS=180`.
- Headless Playwright could not visually verify the Machine pane because it reached the unauthenticated sign-in page; current visual proof is therefore still pending for an authenticated browser session, while CLI/local report/API read-back proof is complete.
- Verification: `npm --prefix cli test -- machine-bootstrap-prompt`, `npm --prefix cli run build`, compiled `node cli/dist/index.js machine prompt --require-env-vault` smoke, `npx tsc --noEmit --pretty false`, `npm run lint -- --file src/hooks/useYouAgent.ts` (existing warnings only), and `npm run build`.
- Remaining gap: run the uncapped generated command on the actual new computer / clean agent host with the real encrypted env vault and verify restored skills/symlinks, env files, local servers, resident daemons, and Portfolio Graph sync there.

## 2026-06-17 — Portfolio proof and provider account persistence

### feat(convex/web): persist secret-safe provider account notes
- Added owner-gated `portfolioProviderAccounts` records for API/env service-account metadata: provider, category, login hint, billing owner, separation policy, encrypted-storage/vault reference notes, project slugs, key-name aliases, status, risk, cost estimate, and source.
- Added `portfolio.listProviderAccounts`, `portfolio.upsertProviderAccount`, and `portfolio.syncProviderAccountSeed`; `getProjectSlice` now includes matching provider accounts for the requested project without returning raw secrets.
- Updated the APIs + Env Intelligence pane so static service-account notes can be persisted/refreshed into Convex, then rendered as `CONVEX PERSISTED ACCOUNT NOTES`. The browser payload shows provider/account/key-name metadata only; raw `.env.local` values and raw API keys are never sent.
- Hardened the dashboard action with undefined-field stripping and a timeout guard so a stale backend deploy reports a clear error instead of leaving the button stuck on `persisting...`.
- Authenticated Codex in-app Browser QA verified the Portfolio Graph request against the real persisted graph: `55 PROJECTS`, `CONVEX PERSISTED GRAPH`, shipped `today` / `7d` / `30d` / `90d`, compact project list controls, clickable `details` / `timeline`, You.md `PROJECT GRAPH LINKS`, API/MCP docs URLs, graph/docs/stack/clone curl commands, and a reversible `youmd` focus mutation (`focusing / 2` -> `top-priority / 1`).
- Authenticated Codex in-app Browser QA also verified the APIs/env persisted account path after `npx convex dev --once`: `persisted 0 new / 4 refreshed provider account notes`, `CONVEX PERSISTED ACCOUNT NOTES`, no raw `sk-*` secret pattern, and screenshot `/tmp/youmd-api-env-provider-accounts-persisted-proof-2026-06-17.png`. Post-push production QA on `https://www.you.md/shell?tab=apis` verified the deployed persisted section with no raw secret pattern and screenshot `/tmp/youmd-production-api-env-provider-accounts-proof-2026-06-17.png`.
- Verification: `npx convex dev --once`, `npm run test:convex -- convex/portfolio.test.ts`, `npx tsc --noEmit --pretty false`, `npx tsc -p convex/tsconfig.json --noEmit --pretty false`, `npm run lint` (existing warnings only), and `npm run build`.

## 2026-06-17 — Web-shell portfolio task sync proof

### test(shell): prove project-scoped agent task sync from the local composer
- Authenticated Codex in-app Browser QA on `http://localhost:3100/shell?tab=portfolio&project=youmd#project-detail` verified the rendered Portfolio Graph state Houston requested: `55 PROJECTS`, shipped pulse with `today` / `7d` / `30d` / `90d`, compact project list, search/focus/sort controls, clickable `details` / `timeline` links, full ranked focus labels, and the selected You.md `PROJECT GRAPH LINKS` block.
- The selected project detail block showed exact graph/API/MCP/stack context: `https://you.md/api/v1/docs/reference`, `https://you.md/api/v1/docs/openapi.json`, `https://you.md/.well-known/mcp.json`, the owner-gated portfolio graph curl command, docs curl commands, `curl -fsSL https://you.md/install.sh | bash`, and `git clone https://github.com/houstongolden/youmd youmd`.
- Submitted `/task agent youmd: web shell portfolio sync proof 20260617T175421Z ... #shell-sync-proof #portfolio-task-proof` through the actual shell composer. The shell saved an agent-owned You.md task, wrote `projects/youmd/tasks.md`, published bundle `v129`, queued the repo update loop from chat, opened identity sync PR #20, merged it, refreshed 53 mirrored files, and returned the GitHub chrome to `SYNCED / REPO MIRROR CURRENT / JUST NOW`.
- GitHub read-back confirmed PR #20 (`https://github.com/houstongolden/houstongolden-you-md/pull/20`) merged at `2026-06-17T17:55:56Z` with merge commit `57a4417c30257a483b0a0e193aecc0ee44e5c998`, and `projects/youmd/tasks.md` on `main` contains the exact proof title, `owner: agent (You Agent)`, `project: youmd`, and `shell-sync-proof` / `portfolio-task-proof` tags.
- Visual proof screenshots: `/tmp/youmd-portfolio-detail-shipped-links-proof-2026-06-17.png` and `/tmp/youmd-shell-task-github-sync-proof-2026-06-17.png`.

## 2026-06-17 — Production portfolio anchor QA

### fix(web): replace project detail hash when opening timeline anchors
- Production QA on `https://www.you.md/shell?tab=portfolio&project=youmd#project-detail` verified the new shipped board, latest shipped rows, full ranked project focus options, and `PROJECT GRAPH LINKS` docs/curl/install/clone block were live on the custom domain.
- The same production QA found a real URL hygiene bug: clicking `View timeline for youmd` from `#project-detail` scrolled correctly, but the browser URL became `#project-detail#timeline` instead of replacing the hash with clean `#timeline`.
- Updated the Portfolio Graph project selector to compute a single anchored URL and use `window.history.replaceState` after the Next router update when the current hash does not match the target anchor.
- Local authenticated Browser QA now proves the exact transition from `http://localhost:3100/shell?tab=portfolio&project=youmd#project-detail` to `http://localhost:3100/shell?tab=portfolio&project=youmd#timeline`, with no doubled hash and the shipping timeline in view.
- Post-deploy production QA on `www.you.md` now proves the same clean transition to `https://www.you.md/shell?tab=portfolio&project=youmd#timeline`, with no doubled hash, `Me + agents, shipped across the portfolio` still present, `latest shipped here` still present, and the shipping timeline in view. Screenshot: `/var/folders/4n/hqpz_03d477c1f_m2ks7x18c0000gn/T/youmd-production-clean-timeline-anchor-2026-06-17.png`.

## 2026-06-17 — Portfolio shipped board polish

### feat(web): make shipped work and project priority controls more obvious
- Upgraded the Portfolio Graph shipped pulse from counters-only telemetry into a founder/agent shipping board: the main card now says `Me + agents, shipped across the portfolio`, keeps `today` / `7d` / `30d` / `90d` totals, shows top-shipping projects, and lists the latest shipped commit/PR/release titles inline.
- Added `latest shipped here` to the selected project detail panel so project pages show concrete recent shipped items before the longer timeline section.
- Made compact project rows read more directly with a `shipped` label before `today` / `7d` / `30d` / `90d` counters.
- Made the row-level focus dropdown self-explanatory by showing the focus icon plus full ranked labels: `1 Top Priority`, `2 Focusing`, `3 Freeze / On Ice`, `0 Abandoned`, `0 Dead / Killed`, and `4 Unsorted`.
- Added a compact rank legend beside the project search/filter/sort controls.
- Verified locally with `npx tsc --noEmit --pretty false`, `npm run lint` (existing warnings only), `cd cli && npm run build`, and authenticated Codex in-app Browser QA.
- Browser proof on `http://localhost:3100/shell?tab=portfolio&project=youmd` verified the shipped board, latest shipped rows, search/filter/sort controls present, focus dropdown options, You.md project detail page, project graph docs/curl/install/clone links, and a real `View timeline for youmd` click scrolling to `#timeline`. A reversible focus mutation changed `bamfsite` to `focusing / 2` and back to `unset / 4`. Screenshots: `/var/folders/4n/hqpz_03d477c1f_m2ks7x18c0000gn/T/youmd-portfolio-detail-shipped-graph-links-2026-06-17.png`, `/var/folders/4n/hqpz_03d477c1f_m2ks7x18c0000gn/T/youmd-portfolio-graph-links-curl-2026-06-17.png`, and `/var/folders/4n/hqpz_03d477c1f_m2ks7x18c0000gn/T/youmd-portfolio-timeline-shipped-focus-2026-06-17.png`.

## 2026-06-17 — Portfolio detail graph links follow-up

### feat(web/api): enrich project details with graph docs, stack, and curl commands
- Tightened the Portfolio Graph selected-project detail panel so it now joins each portfolio project with the matching recent GitHub-tracked project record when available.
- Added a visible `PROJECT GRAPH LINKS` section for selected projects showing associated stack/stack slug, GitHub repo evidence, exact API/MCP docs URLs, the owner-gated portfolio graph curl command, docs curl commands, stack install command, and clone command.
- Made row-level `details` and `timeline` controls true anchored deep links: `details` targets `#project-detail`, `timeline` targets `#timeline`, and the click handler scrolls the right section into view after updating `?tab=portfolio&project=<slug>`.
- Replaced the plain numeric focus badge with a compact icon+rank badge for `Top Priority`, `Focusing`, `Freeze / On Ice`, `Abandoned`, `Dead / Killed`, and `Unsorted` while keeping the persisted dropdown behavior.
- Enriched `GET /api/v1/me/portfolio/graph` project rows with tracked-project `apiDocsUrl`, `mcpDocsUrl`, `stackSlug`, `repoName`, `directoryName`, and a safe `curlCommand` so local agents do not have to reverse-join graph rows to find API/MCP docs or project graph fetch commands.
- Verified locally with `npx tsc --noEmit --pretty false`, `cd cli && npm run build`, `npm run lint` (existing warnings only), `npm run build`, and `git diff --check`.
- Authenticated Codex in-app Browser QA on `http://localhost:3100/shell?tab=portfolio&project=youmd` verified `PROJECT GRAPH LINKS`, YouStack `/youstack`, `you.md/api/v1/docs/reference`, `.well-known/mcp.json`, graph/docs curl commands, `curl -fsSL https://you.md/install.sh | bash`, `git clone https://github.com/houstongolden/youmd youmd`, and owned You.md API/MCP surfaces. Clicking the real `View timeline for youmd` link updated the URL to `#timeline` and scrolled the shipping timeline into view.

## 2026-06-17 — Shell-chat brain-dump sync proof

### fix(shell): let deterministic portfolio commands run while the opener is stuck
- Found a real browser-test blocker while proving shell-chat brain-dump sync: the shell opening greeting could remain in `isThinking` for minutes, and `sendMessage` returned before deterministic `/task`, `/braindump`, or fresh-machine commands could run.
- Moved portfolio and fresh-machine command routing ahead of the generic `isThinking` guard, while keeping normal chat messages blocked during active thinking. This lets command-like agent actions proceed even if the LLM opener stalls.
- Verified locally with `npx tsc --noEmit --pretty false`.
- Authenticated Codex in-app Browser proof on `http://localhost:3100/shell?project=youmd` submitted `/braindump project:youmd ...` through the actual composer. The shell saved the raw brain dump, proposed one agent task, wrote `projects/_braindumps/recent.md`, published bundle `v127`, queued repo sync from shell chat, opened and merged identity sync PR #19, refreshed 53 mirror files, and returned GitHub chrome to `SYNCED / REPO MIRROR CURRENT / JUST NOW`.
- GitHub read-back confirmed PR #19 (`https://github.com/houstongolden/houstongolden-you-md/pull/19`) merged at `2026-06-17T16:59:45Z` with merge commit `e53141345e2480175b8c9a73bf2a6b47ca2d83e4`, and `projects/_braindumps/recent.md` on `main` contains the `2026-06-17T1703Z` raw proof, `shell-chat-proof` tags, and proposed agent task.
- Visual proof: `/tmp/youmd-shell-chat-braindump-sync-pr19-2026-06-17.jpg`.

## 2026-06-17 — Portfolio project details and shipped/focus controls

### test(shell): verify local GitHub sync returns to JUST NOW after portfolio push
- Re-ran authenticated local Codex in-app Browser QA on `http://localhost:3100/shell?project=youmd` after the portfolio detail/shipped pulse push.
- Verified the Portfolio Graph still renders the new direct project detail state, shipped pulse, compact project list, and You.md selected-project context.
- Clicked the real `[ update ]` GitHub control from the shell chrome while it showed `SYNCED / REPO MIRROR CURRENT / 2H AGO`; the chrome switched to `SYNCING / PUBLISHING, PUSHING, AND REFRESHING THE REPO MIRROR`.
- Watched the transcript complete publish -> GitHub PR -> merge -> mirror refresh. The run published `v126`, pushed `you.md`, `you.json`, task snapshots, brain-dump snapshots, and `projects/_portfolio/{README.md,graph.md,graph.json}`, opened and merged identity sync PR #18, checked that GitHub reported no merge conflict, refreshed `53` mirror files, and returned the chrome to `SYNCED / REPO MIRROR CURRENT / JUST NOW`.
- GitHub read-back confirmed PR #18 (`https://github.com/houstongolden/houstongolden-you-md/pull/18`) merged at `2026-06-17T16:48:04Z` with merge commit `797951a7ef728aada9bb711153e93d72af1d9af1`.
- Visual proof: `/tmp/youmd-local-github-sync-just-now-pr18-2026-06-17.jpg`.

### feat(web/convex): deep-link portfolio details and expose shipped/API command pulse
- Made `/shell?project=<slug>` open the Portfolio pane directly on reload, including `/shell?project=youmd`, so project detail pages are real shareable shell deep links instead of only in-memory selection state.
- Added a top-level shipped pulse for the whole portfolio (`today`, `7d`, `30d`, `90d`) plus leader chips for the highest-shipping projects.
- Tightened the compact project list with showing/sort/focus summary text, row-level `details` and `timeline` deep-link controls, and row-level quick focus dropdowns.
- Updated focus labels to match the requested operating statuses: `Top Priority`, `Focusing`, `Freeze / On Ice`, `Abandoned`, `Dead / Killed`, and `Unsorted`.
- Added `curlCommand` to persisted API/MCP/stack surface records, preserved exact surface docs URLs/integration types during seed sync, surfaced stack install commands in project details, and mirrored docs/curl fields into repo-backed `projects/_portfolio/graph.md` / `graph.json` snapshots.
- Verified with Convex codegen, focused Portfolio snapshot/focus tests, root TypeScript, `npm run lint` (warnings only), `git diff --check`, and `npm run build`.
- Authenticated Codex in-app Browser proof verified direct `/shell?project=youmd` routing, Portfolio pane selection, `SHIPPED PULSE`, project detail URL, You.md API docs/curl, YouStack install command, compact list controls, and row-level focus mutation by changing `bamfsite` to `focusing` and back to `unset`. Screenshots: `/tmp/youmd-portfolio-shipped-deeplink-controls-2026-06-17.png` and `/tmp/youmd-portfolio-compact-list-controls-2026-06-17.png`.

### feat(web/convex): make project portfolio cards compact, clickable, and priority-aware
- Added a compact Portfolio Graph project browser with search, focus filter, activity/priority/shipped/name sorting, and a compact/expanded density toggle.
- Made project rows and `details` / `timeline` controls open a stable URL-backed detail state such as `/shell?project=youmd`.
- Added persisted project focus metadata (`focusStatus`, `focusRank`) with owner-gated `portfolio.updateProjectFocus` mutation and regression coverage for owner isolation.
- Added project focus statuses: `Top Priority`, `Focusing`, `On Ice`, `Abandoned`, `Killed`, and `Unsorted`, with numeric rank badges.
- Expanded shipped counters from `today` / `7d` / `30d` to include `90d` on both compact project rows and selected project detail panels.
- Surfaced project links, API/MCP/stack surfaces, exact docs URLs, curl commands, associated stack, and dependency snapshot inside the selected project detail panel.
- Added a timeout/recovery guard so the focus dropdown cannot stay disabled if the frontend is ahead of the deployed Convex backend.
- Verified locally with `npx tsc --noEmit --pretty false`, `npm run test:convex -- convex/portfolio.test.ts`, `git diff --check`, `npm run lint` (warnings only), and `npm run build`.
- Authenticated in-app Browser proof verified `/shell` renders the Portfolio Graph with search, URL-backed `project=youmd` detail selection, shipped `today` / `7d` / `30d` / `90d` counters, docs URL, and curl command visibility. The first focus-mutation browser attempt correctly exposed that the remote deploy was still running from pre-push `main`; after pushing `783e8d9` and rerunning Convex deploy, the browser changed `youmd` from `focusing` back to `top-priority`, showed the success message, stayed enabled, and read back the persisted value.

## 2026-06-17 — Live fresh-machine env-vault bootstrap proof

### fix(web/installer): install You.md without sudo on locked-down npm prefixes
- Fixed a real fresh-machine blocker found by running the generated bootstrap command against live production: `curl https://you.md/install.sh | bash` failed with `EACCES` when npm tried to write to `/usr/local/lib/node_modules/youmd`.
- Updated the hosted installer to detect unwritable global npm roots and use a user-writable `~/.youmd/npm-global` prefix, prepend `~/.youmd/bin` to PATH, symlink `youmd`, `you`, and `create-youmd`, and persist the PATH shim without requiring sudo.
- Verified the installer patch in an isolated fake HOME/source-install run, then deployed commit `052507c` and confirmed live `https://www.you.md/install.sh` contains the user-prefix fallback.
- Re-ran the live generated bootstrap with `YOUMD_MAX_CLONE_PROJECTS=2` and a disposable encrypted fake env vault. The command installed through the sudo-free prefix, cloned `agent-shared` and `youmd` into `/tmp/youmd-fresh-env-vault-proof-20260617T153402Z/CODE_YOU`, listed/restored `youmd/.env.local` by target path plus variable names/counts only, rehydrated the portfolio graph, and completed with status `0`.
- Verified the synced machine proof through Convex and authenticated local `/shell`: latest proof row is `READY`, root `/tmp/youmd-fresh-env-vault-proof-20260617T153402Z/CODE_YOU`, `scanned 2 / ready 1 / needs env 0 / partial 0`, and `secret values exposed: false`.
- Confirmed neither the bootstrap log nor rendered Machine pane exposed the fake secret value. Visual proof: `/tmp/youmd-machine-proof-env-vault-visual-2026-06-17.png`.
- Remaining gap: run the uncapped command on the actual new computer/clean agent host with the real encrypted env vault and verify full project clone count, skills/symlinks, local servers, resident daemons, and Portfolio Graph sync there.

## 2026-06-17 — Env-vault preflight for fresh-machine bootstrap

### feat(cli/web/docs): verify encrypted env vaults before restore
- Added `youmd env backup --preflight`, which checks encryption tooling, `.env.local` discovery, and agent-auth file presence without writing a vault or printing secret values.
- Added `youmd env restore <vault> --list`, which decrypts into a temp directory, prints target paths plus variable names/counts and agent-auth presence, then exits without writing files.
- Hardened the generated fresh-computer command so it checks env-vault tooling, fails early when `YOUMD_ENV_VAULT` points to a missing file, lists the encrypted vault before restore, then restores only after the list step passes.
- Brought the web shell `/new computer` generated command up to CLI parity: graph-backed dry-run preview, optional clone cap, env-vault preflight/list/restore, readiness proof sync, and optional bounded checks/install/server probes.
- Updated the bundled `machine-bootstrap` skill, env-vault README, and public docs to teach the preflight/list/restore flow.
- Verified with focused machine prompt tests, CLI build, disposable encrypted backup/list/restore smoke with a fake `.env.local` and no fake value leakage in output, compiled `youmd machine prompt` smoke, `npm run docs:check`, `npm run build`, and `git diff --check`.

## 2026-06-17 — Canonical skills API route

### feat(web): expose hosted skill registry through the web domain
- Added same-origin `GET /api/v1/skills` and `OPTIONS /api/v1/skills` Next routes that proxy the Convex skill registry, preserving query strings, upstream status, JSON bodies, cache headers, and public CORS headers.
- Regenerated the agent docs/OpenAPI references so `/api/v1/skills` is documented as `convex + next`, matching the README/docs examples that use `https://you.md/api/v1/skills`.
- Verified local `http://localhost:3100/api/v1/skills` returns `count: 10`, verified `?name=portfolio-graph-auditor` returns full content with `get_agent_brief` and `env-key-audit.py`, then verified production `https://www.you.md/api/v1/skills` returns `count: 10`, apex `https://you.md/api/v1/skills` follows to the same registry, `?name=machine-bootstrap` returns full graph-backed setup content, and `OPTIONS` returns public CORS headers.

## 2026-06-17 — Hosted skill registry parity

### feat(api): seed all bundled local-agent skills in production
- Added the missing Convex bundled skill seed entries for `youstack-maintainer`, `machine-bootstrap`, and `portfolio-graph-auditor`, bringing the hosted registry seed set to the same 10-skill shape as the local CLI catalog.
- Added `convex/skillsSeed.test.ts` so the seed mutation proves all 10 bundled/local-agent skills are published and key full-content instructions are present.
- Tightened the live CLI integration test so production `/api/v1/skills` must return the exact 10-skill contract, including `machine-bootstrap` and `portfolio-graph-auditor`.
- Deployed Convex, ran `npx convex run skills:seedBundledSkills`, and verified the live Convex Site registry returns `count: 10`; content lookups confirmed `machine-bootstrap` includes graph-backed machine setup and `portfolio-graph-auditor` includes `get_agent_brief` plus env-audit guidance.

## 2026-06-17 — Bounded clean-host machine proof

### feat(cli/web/docs): add capped clone proofs and show synced machine records on hosted shells
- Added `--max-clone-projects <n>` to `youmd machine projects` and `youmd machine prompt`, plus generated-command support through `YOUMD_MAX_CLONE_PROJECTS`, so agents can run bounded clean-root proof passes without cloning the full active project set.
- Updated the web docs and bundled `machine-bootstrap` skill with the proof cap while preserving the uncapped path as the real new-machine default.
- Classified non-interactive Convex first-run setup failures in `youmd machine verify --probe-servers`, so machine proof warnings now say `non-interactive Convex setup required before dev server start; restore Convex/env config or run convex dev interactively once` instead of a generic server failure.
- Moved synced machine proof records in the Machine pane outside the localhost-only readiness-report branch, so hosted/production shells can still show owner-gated synced proof history when `/api/local/machine-readiness` is unavailable.
- Ran the compiled clean-root proof at `/tmp/youmd-clean-host-CODE_YOU-20260617T0714`: production graph input reported `55` portfolio projects, `40` graph-tracked repos, and `41` recent GitHub repos; the capped run cloned `youmd` and `agent-shared`, verified remotes, wrote secret-safe proof JSON, and synced the proof row to You.md with `secretValuesExposed: false`.
- Ran bounded install/server proof: `npm ci` passed for `youmd`; the dev-server probe failed only because Convex tried to prompt in a non-interactive terminal before startup.
- Verified the synced proof through the production API and authenticated local `/shell` visual QA: the Machine pane shows the clean root, `FAILED`, `secret values exposed: false`, `scanned 2 / ready 0 / env 1 / partial 0`, and the classified Convex blocker. Local screenshot: `/tmp/youmd-local-machine-clean-host-proof-2026-06-17.png`.

## 2026-06-17 — Production dashboard and GitHub sync proof

### test(web): verify production Portfolio Graph, task routing, sidebar, and repo update
- Verified production deployment `dpl_4DDQihfn488MFgJtMjUkomBFmyPZ` was Ready and aliased to `https://www.you.md` / `https://you.md`, then loaded authenticated production `/shell` as `@houstongolden`.
- Verified the production Portfolio Graph pane shows `55 PROJECTS`, `CONVEX PERSISTED GRAPH`, `40 recent GitHub-tracked projects nearby`, `TASK TRIAGE`, `REUSABLE PATTERNS`, and `hydrate active projects`.
- Created production no-sync task `rx795skqcg5xjenrra3qdw39fs88vcbf`, routed it through dashboard controls from `OPEN / LOW / AGENT / YOUMD` to `IN_PROGRESS / HIGH / HUMAN / HOUSTON / PERSONAL`, then clicked `DONE` and verified the active task count returned to `5`.
- Captured production task-control proof screenshots: `/tmp/youmd-production-task-controls-pre-update-2026-06-17.png`, `/tmp/youmd-production-task-controls-post-update-2026-06-17.png`, and `/tmp/youmd-production-task-controls-done-2026-06-17.png`.
- Clicked production `[ update ]`, watched publish -> GitHub PR -> merge -> mirror refresh complete, and verified the GitHub chrome returned to `SYNCED / REPO MIRROR CURRENT / JUST NOW`.
- Production update merged identity repo PR #17 (`https://github.com/houstongolden/houstongolden-you-md/pull/17`) at `2026-06-17T13:59:29Z`, pushed `projects/_portfolio/README.md`, `projects/_portfolio/graph.json`, `projects/_portfolio/graph.md`, and `projects/youmd/tasks.md`, refreshed `53 files`, and screenshot proof is `/tmp/youmd-production-update-final-2026-06-17.png`.
- Verified the production left sidebar toggles `56px -> 244px -> 56px` with expanded labels visible; screenshots: `/tmp/youmd-production-sidebar-expanded-2026-06-17.png` and `/tmp/youmd-production-sidebar-collapsed-2026-06-17.png`.

## 2026-06-17 — Authenticated dashboard QA follow-through

### test(web): prove task routing controls and sidebar toggle in a real shell session
- Minted a real local web session for `@houstongolden` and visually tested `http://localhost:3100/shell` with Playwright.
- Created no-sync task `rx74n65a3t2e9ew1hqk76xxkn588vy84` through `youmd project task`, verified it appeared in the Portfolio Graph `TASK TRIAGE` list, routed it from `OPEN / LOW / AGENT / YOUMD` to `IN_PROGRESS / HIGH / HUMAN / HOUSTON / PERSONAL` through the dashboard buttons, then clicked `DONE` and verified the open task count returned to `5`.
- Captured task-control proof screenshots: `/tmp/youmd-task-controls-pre-update-2026-06-17.png` and `/tmp/youmd-task-controls-post-update-2026-06-17.png`.
- Verified the left shell sidebar no longer gets stuck collapsed: authenticated QA toggled `56px -> 244px -> 56px`, confirmed `Expand sidebar` / `Collapse sidebar` swap, and captured `/tmp/youmd-sidebar-expanded-auth-2026-06-17.png` plus `/tmp/youmd-sidebar-collapsed-auth-2026-06-17.png`.
- No app-code patch was needed in this pass; this was proof completion and project-context tracking.

## 2026-06-17 — Richer Portfolio Task Updates

### feat(api/cli/mcp/web): update task details across project graph surfaces
- Added `portfolio.updateTaskDetails` for owner-gated partial task updates: title, description, owner type, owner label, project/personal scope, status, priority, due date, and tags.
- Added authenticated `POST /api/v1/me/portfolio/tasks/update`, with repo-backed task snapshot publishing and activity logging.
- Added `youmd project task update <task-id> ...`, task id/capture id printing in CLI write results, and `updatePortfolioTask` API helper.
- Expanded local MCP `update_portfolio_task` from status/priority triage into full task routing/editing.
- Extended the Portfolio Graph pane task section with due/tag visibility plus quick controls to reassign owner and route a task to the selected project or back to personal.
- Added focused Convex regression coverage for partial edits, clear-to-personal behavior, completion timestamps, and owner isolation.
- Verified with `npm run test:convex -- convex/portfolio.test.ts`, `npm run build`, `npm run lint`, `npm --prefix cli run build`, Convex Deploy run `27692450980`, Agent Docs, and CI rerun.
- Authenticated CLI create proof saved task `rx7cbe2gnrxy9pmemtfvwv6zhn88vkzn`; the pre-deploy update returned `HTTP 404`, then the deployed route published bundles v116/v119 and repo-backed snapshot sync merged PR #16 with `projects/youmd/tasks.md`.

## 2026-06-17 — Machine proof sync

### feat(api/cli/web): sync fresh-machine proof summaries to You.md
- Added owner-gated `machineProofReports` records with status, host/root, readiness totals, install/check/server pass counts, warnings, source, generated time, and `secretValuesExposed` tracking.
- Added authenticated `POST /api/v1/me/machines/proof` and `GET /api/v1/me/machines/proofs` so local CLI agents can sync/list machine proof summaries without uploading raw logs or `.env.local` values.
- Added `youmd machine verify --sync-report`; the one-command fresh-machine bootstrap now runs `--write-report --sync-report` for readiness, optional package checks, and optional install/server proof phases.
- Extended the signed-in Machine pane with synced machine records from Convex alongside the localhost-only latest local proof strip.
- Regenerated agent docs/OpenAPI references for the new machine proof endpoints.
- Verified locally with `npx convex codegen`, focused Convex tests, full Convex suite (`44` files / `427` tests), focused CLI tests, full CLI suite (`53` files / `558` tests), CLI build, root typecheck, focused ESLint, docs check, production build, and compiled CLI prompt smoke showing all verify phases include `--sync-report`.
- Deployed Convex to production via GitHub Actions run `27690893196`, then live-smoked production proof sync with `node cli/dist/index.js machine verify --root /Users/houstongolden/Desktop/CODE_2025 --max-projects 80 --write-report --sync-report`. Production read-back returned one synced machine row: `Houstons-MBP.lan`, `warn`, `61` scanned, `26` ready, `2` needs env, `8` partial, `0` failures, `secretValuesExposed: false`.
- Authenticated Codex Browser visual QA verified the Machine pane showing `synced machine records`, `1 tracked`, the current root, synced timestamp, totals, warnings, and `secret values exposed: false`. Screenshot: `/tmp/youmd-machine-proof-sync-records-2026-06-17.png`.
- The actual brand-new-computer run remains open.

## 2026-06-17 — Machine proof report

### feat(cli/web): persist fresh-machine proof artifacts
- Added `youmd machine verify --write-report`, which writes a secret-safe JSON proof artifact to `~/.youmd/machine-reports/latest.json` plus a timestamped archive file.
- Redacted token/email-like output tails before writing proof JSON and kept `secretValuesExposed: false` in the report contract.
- Updated the generated fresh-computer bootstrap command and bundled `machine-bootstrap` skill so readiness, package checks, dependency installs, and server probes write proof reports automatically.
- Extended the localhost-only Machine readiness API and `/machine` pane with a `latest machine proof` strip showing host, root, status, project totals, install/check/server pass counts, warnings, and a copyable full fresh-root proof command.
- Verified with focused CLI tests, full CLI test suite (`53` files / `558` tests), CLI build, root typecheck, docs check, focused ESLint, production build, compiled proof-report smoke, global `youmd machine verify --write-report`, and direct server-builder proof that the pane sees `~/.youmd/machine-reports/latest.json`.
- Authenticated browser visual proof is still pending for this exact strip because no attachable authenticated browser session was available in this turn.

## 2026-06-17 — Machine verify local-run proof

### feat(cli): add bounded install and dev-server probes to machine verify
- Extended `youmd machine verify` with opt-in `--install-deps` and `--probe-servers` modes so a fresh-machine setup can install dependencies and smoke-probe local dev servers for capped selected projects.
- Added install/project/server caps and timeouts: `--max-install-projects`, `--install-timeout-ms`, `--max-server-projects`, `--server-timeout-ms`, and `--server-start-port`.
- Updated the one-command fresh-computer bootstrap prompt to support `YOUMD_INSTALL_DEPS=1` and `YOUMD_PROBE_SERVERS=1` without embedding `.env.local` values.
- Verified with focused CLI tests, full CLI test suite (`53` files / `557` tests), CLI build, root typecheck, docs check, focused ESLint, production build, and compiled CLI smoke against a disposable project where `npm install` passed and `npm run dev` returned HTTP 200 on localhost.
- Remaining proof is the real brand-new computer / clean host run with actual cloned projects, env vault restore, resident daemons, and Portfolio Graph sync.

## 2026-06-17 — Signed-in machine readiness

### feat(web/local): add localhost-only Machine readiness pane
- Added an authenticated localhost-only `GET /api/local/machine-readiness` route for secret-safe local machine metadata.
- Added a `/machine` shell pane under `stacks -> machine` showing resident sync daemons, current/fresh project roots, clone/package/env-doc readiness, local You.md auth, shared skill mirrors, Codex/Claude MCP config presence, and env-vault tooling.
- Kept raw `.env.local` values out of the browser response; the pane reports presence/readiness and explicitly shows `secret values exposed: false`.
- Wired `/machine`, `/computer`, `/readiness`, and `/daemons` slash commands into the shell command router and help output.
- Marked the route as an internal/local route in generated agent docs so it is not advertised as a hosted public API endpoint.
- Refreshed the global `youmd` install from the local `cli/` package so `youmd machine verify` works from a normal shell.
- Verified with `npx tsc --noEmit`, targeted ESLint, `git diff --check`, exact global `youmd machine verify --root /Users/houstongolden/Desktop/CODE_2025`, `youmd stack daemon status`, authenticated Codex in-app Browser QA, and `npm run build`.
- Visual proof: `/tmp/youmd-machine-readiness-pane-2026-06-17-v2.png` and `/tmp/youmd-machine-readiness-stack-env-proof-2026-06-17-v2.png`.

## 2026-06-17 — Scanner-derived reusable patterns

### feat(cli/api/web): mine reusable code/UI/auth/layout patterns into the portfolio graph
- Added a deterministic local reusable-pattern miner for active project repos. It scans safe file/path/package/doc signals, skips generated directories and env values, and emits reusable pattern families with usage projects plus source-path evidence.
- Extended `youmd project portfolio-hydrate` to mine reusable patterns by default, show local pattern counts in dry-run/live output, and send the pattern batch through `POST /api/v1/me/portfolio/projects/hydrate`.
- Added `portfolio.upsertReusablePatternBatch` and wired the hydrate API to persist scanner-derived records into `portfolioReusablePatterns`, replacing stale scanner evidence paths on each hydrate while preserving merged tags/tech stacks.
- Updated the Portfolio Graph pane to render pattern usage projects and source-path evidence under `REUSABLE PATTERNS`.
- Verified with focused CLI tests, CLI build, root TypeScript, Convex deploy, real compiled hydrate, authenticated API proof, and authenticated Codex in-app Browser QA.
- Real hydrate proof: `youmd project portfolio-hydrate --root /Users/houstongolden/Desktop/CODE_2025 --days 90 --limit 80` mined `8` pattern families from `30` projects / `8240` signal files, refreshed `40` GitHub-tracked rows and `30` local-audit rows, and updated `8` persisted reusable pattern records.
- API/UI proof: persisted graph now has `55` projects and `11` reusable patterns; verified scanner-derived families include `agent-streaming-progress`, `agentic-shell-layout`, `api-mcp-skillstack-first`, `first-party-passwordless-auth`, `task-braindump-router`, `convex-owner-gated-api`, `env-provider-intelligence`, and `project-context-operating-docs`, with no `_generated` evidence paths in the sample. Screenshot: `/tmp/youmd-reusable-patterns-scanner-proof-2026-06-17-v2.png`.

## 2026-06-17 — Portfolio strategy enrichment

### feat(cli/api/mcp/web): enrich active projects with strategy intelligence
- Added deterministic project strategy synthesis for local portfolio hydration, covering detailed description, goal, vision, positioning, audience, pain points, solution, rationale, north star, metrics, constraints, not-building notes, and competitors.
- Expanded local doc intake beyond README/PRD/current-state to include `project-context/overview.md`, `tasks.md`, `tasks.json`, `design.md`, `research.md`, and `ideas.md` where present.
- Filtered setup/build/doc-title boilerplate so `.env.example` copy steps, local preview URLs, build commands, tech-stack snippets, and PRD title blocks do not become project vision or solution text.
- Extended `POST /api/v1/me/portfolio/projects/hydrate` and the local MCP `upsert_portfolio_project` tool to accept the richer strategy fields.
- Added a `STRATEGY INTELLIGENCE` section to the Portfolio Graph pane for the selected project.
- Verified the real local-agent hydrate path: `youmd project portfolio-hydrate --root /Users/houstongolden/Desktop/CODE_2025 --days 90 --limit 80` refreshed `40` GitHub-tracked rows and `30` local-audit rows, persisted `55` projects, and produced `30` enriched strategy records with zero known setup/PRD-title snippet matches.
- Authenticated Codex in-app Browser QA verified the local `/shell` Portfolio pane showing `STRATEGY INTELLIGENCE` for `bamfsite`, including private BAMF OS API/MCP context. Screenshot: `/tmp/youmd-portfolio-strategy-section-2026-06-17-v4.png`.

## 2026-06-17 — Repo-backed portfolio graph snapshots

### feat(convex/github): push portfolio graph snapshots into the linked repo
- Added `convex/lib/portfolioRepoSnapshot.ts` to render the persisted portfolio graph into repo-backed files: `projects/_portfolio/README.md`, `projects/_portfolio/graph.md`, and `projects/_portfolio/graph.json`.
- Wired `githubRepo.pushToRepo` to append those generated snapshots to every normal identity sync, alongside `you.md`, `you.json`, project task snapshots, and brain-dump snapshots.
- Kept the snapshot secret-safe by excluding raw brain-dump transcripts and `.env.local` values, and added a mirror-size guard so `graph.json` stays below the repo mirror per-file cap.
- Verified with focused renderer tests, full Convex tests, `npx convex codegen`, `npx tsc --noEmit --pretty false`, `npx convex deploy`, authenticated Codex in-app Browser QA, and GitHub PR #15 cross-check.
- Visual proof: clicked local `[ update ]`, observed PR #15 merge, saw `projects/_portfolio/README.md`, `projects/_portfolio/graph.md`, and `projects/_portfolio/graph.json` in the pushed file list, and confirmed the server mirror refreshed to `53 files`. Screenshot: `/tmp/youmd-portfolio-repo-snapshot-proof-2026-06-17-pr15.png`.
- GitHub proof: PR #15 merged at `2026-06-17T10:41:46Z` with merge commit `819bddc31ad7c336f38978642df618c995225bba`; `graph.md` is `23559` bytes, `graph.json` is `114299` bytes, and `README.md` is `695` bytes on `main`.

## 2026-06-17 — Persisted shell update history

### test(convex): prove GitHub 409 branch-recreation retry timeline
- Added `convex/githubAgentSync.test.ts` covering the forced 409 merge-conflict path without touching a real repository.
- The test mocks the GitHub HTTP boundary, forces the first PR merge attempt to return `409`, verifies the agent deletes the stale sync branch, resolves a fresh default-branch HEAD, recreates the branch, retries merge, and returns `branchRecreated: true`.
- Pinned the emitted timeline keys for the conflict path: `merge-conflict-detected`, `conflict-retry-branch-recreated`, and final `github-checks-merge-gate`.
- Verified with `npm run test:convex -- convex/githubAgentSync.test.ts`.

### feat(web/convex): add GitHub check and conflict timeline rows
- Threaded structured timeline events out of `agentPushViaPR`, including default-branch head resolution, sync branch commit, PR open, squash merge attempt, conflict/no-conflict state, conflict branch recreation when needed, and GitHub merge-gate result.
- Returned that timeline from `githubRepo.pushToRepo` for PR and direct-push paths.
- Persisted each timeline event as an ordered `repoUpdateSteps` row during the shell `[ update ]` loop.
- Allowed `pending` update-step status so required-checks-pending states can be represented without forcing them into success/failure.
- Deployed Convex to `kindly-cassowary-600`.
- Verified with focused Convex tests, `npx convex codegen`, `npx tsc --noEmit --pretty false`, `npm run lint`, authenticated Codex in-app Browser QA, and GitHub PR #13 cross-check.
- Visual proof: clicked local `[ update ]`, observed PR #13 merge, expanded the latest account-pane history row, and confirmed persisted rows for `resolve default branch head`, `create sync branch commit`, `open identity sync PR`, `attempt squash merge`, `check merge conflict state`, `check GitHub merge gate`, and `refresh server mirror`. Screenshots: `/tmp/youmd-update-history-timeline-proof-2026-06-17-pr13.png` and `/tmp/youmd-update-history-timeline-detail-proof-2026-06-17-pr13.png`.
- Follow-up added a forced 409 regression test for the branch-recreation retry path.

### feat(web/convex): store and render repo update run artifacts
- Added owner-scoped `repoUpdateRuns` and `repoUpdateSteps` Convex tables for shell/GitHub update history.
- Added `portfolio.startRepoUpdateRun`, `portfolio.appendRepoUpdateStep`, `portfolio.completeRepoUpdateRun`, and `portfolio.listRepoUpdateRuns` so the shell can persist publish, push, PR, merge, commit, mirror, and failure state instead of leaving update evidence only in the transient chat transcript.
- Wired the shell `[ update ]` loop to create a run, append start/publish/push/mirror/error steps, and complete the run with PR URL/number, merge state, branch-recreated flag, commit SHA, pushed files, publish version, and mirror file counts.
- Added an `update history` section to the account/GitHub repo pane with expandable run details and ordered steps.
- Deployed Convex to `kindly-cassowary-600`.
- Verified with focused Convex tests, `npx convex codegen`, `npx tsc --noEmit --pretty false`, `npm run docs:check`, `npm run lint`, `npm run build`, and authenticated Codex in-app Browser QA.
- Visual proof: clicked local `[ update ]`, observed GitHub chrome return to `synced / repo mirror current / just now`, merged PR #12, refreshed 50 mirrored files, expanded the account-pane history row, and confirmed `published v109`, pushed five files, `open PR #12`, commit `021870e5a1f0`, plus start/publish/push/mirror steps. Screenshot: `/tmp/youmd-update-history-proof-2026-06-17-pr12.png`.
- Follow-up added explicit GitHub check-status and conflict/no-conflict timeline rows, then a forced 409 conflict-path regression proof.

## 2026-06-17 — Authenticated shell update proof

### qa(web): verify shell GitHub update loop in Codex browser
- Opened the authenticated local shell at `http://localhost:3100/shell` in the Codex in-app browser and verified the pre-update GitHub chrome showed `synced / repo mirror current / 1h ago`.
- Clicked the real `[ update ]` button and observed the top GitHub chrome switch to `syncing`, the button disable as `updating`, and the shell transcript stream publish, push, and mirror-refresh steps.
- Verified completion in the rendered shell: `published v108`, `pushed: you.md, you.json, projects/_braindumps/recent.md, projects/_personal/tasks.md, projects/youmd/tasks.md`, `route: pr`, PR #11, `merge: complete`, `mirror refreshed: 50 files`, and GitHub chrome returning to `synced / repo mirror current / just now`.
- Cross-checked GitHub externally: `houstongolden/houstongolden-you-md` PR #11 is `MERGED` at `2026-06-17T09:43:00Z` with merge commit `a8188ac7bcfe905d3767997d63fdd177e1bbdf99`.
- Verified repo-backed snapshots still exist on `main`: `projects/_braindumps/recent.md` and `projects/youmd/tasks.md`.
- Visual proof screenshot: `/tmp/youmd-shell-update-proof-2026-06-17-pr11.png`.

## 2026-06-17 — Bounded machine checks and artifact viewer polish

### feat(cli): add bounded machine verify checks
- Added `youmd machine verify --run-checks` for opt-in package checks after the secret-safe readiness audit.
- Default scripts are `typecheck`, `lint`, `test`, and `build`; callers can override them with `--check-scripts`, cap projects with `--max-check-projects`, and cap per-script execution with `--check-timeout-ms`.
- The checker reports passed, failed, timeout, and skipped totals, prints bounded failure output tails, and exits non-zero on failed/timeouts.
- Updated `youmd machine prompt` so generated fresh-computer scripts can set `YOUMD_RUN_CHECKS=1` to run the bounded package-check pass.
- Updated the bundled `machine-bootstrap` skill docs with the new opt-in verification command.
- Verified with focused CLI tests for machine verify/bootstrap prompt, `cli npm run build`, and `git diff --check`.

### feat(web): upgrade artifact markdown viewer
- Upgraded the Files pane viewer with edit, preview, and split modes for markdown artifacts.
- Added markdown metadata/frontmatter analysis, document stats, a heading outline, copy path/content controls, and richer markdown rendering for headings, links, code fences, blockquotes, tasks, and ordered lists.
- Verified with focused Files pane ESLint, `git diff --check`, and root `npm run build`.

## 2026-06-17 — Fresh-machine readiness audit

### feat(cli): audit cloned project readiness after bootstrap
- Added `youmd machine verify` / `youmd machine readiness` / `youmd machine doctor`.
- The verifier scans cloned project directories for git repo/remotes, package manager, standard scripts, `.env.local` presence, `.env.example` presence, root agent docs, and `project-context/` presence without reading secret values.
- Updated `youmd machine prompt` so the one-paste fresh-computer command runs `youmd machine verify --root "$ROOT" --max-projects "$LIMIT"` after clone/env restore/rehydration.
- Updated `machine-bootstrap` skill docs so local agents treat the readiness audit as part of fresh-machine done-ness, while still not pretending that every app can be launched with one generic dev-server command.
- Verified with focused CLI tests (`11` passing), CLI build, root typecheck, docs generation/check, compiled `machine verify` smoke against `/Users/houstongolden/Desktop/CODE_2025`, lint/radius, and production build.
- Remaining: add explicit opt-in run/smoke mode for installing dependencies and probing key local servers on the actual clean host.

## 2026-06-17 — Production graph-backed machine bootstrap planning

### feat(api/cli): make fresh-machine project setup read the persisted graph
- Added secret-safe `GET /api/v1/me/portfolio/graph` for authenticated local agents and fresh-machine bootstrap keys. The endpoint returns project/repo/stack/docs/surface/dependency/pattern/task summary metadata, while avoiding raw `.env.local` values and raw brain-dump transcripts.
- Taught `youmd machine projects` to fetch that persisted graph when authenticated, merge portfolio graph projects, graph-tracked GitHub repos, live `gh` repo scans, and local `you.json.projects`, then print source counts in dry-run and clone output.
- Updated `machine-bootstrap` and `youmd machine prompt` so the one-paste command hydrates the graph, previews the graph-backed setup plan, then clones active project repos.
- Fixed overly broad repo inference so non-GitHub slash paths in summaries, docs, badges, or image URLs no longer become fake `github.com/<thing>/<path>` clones.
- Deployed Convex to `kindly-cassowary-600`.
- Verified with focused CLI tests (`9` passing), CLI build, root typecheck, docs generation, Convex codegen/deploy, compiled prompt smoke, and production graph dry-run. The compiled dry-run now reports `55 projects / 40 tracked repos`, selects `40` graph-backed cloneable repos, and labels rows as `source:portfolio-graph+github`.
- Remaining: run the generated command on the actual brand-new computer / clean agent host, restore encrypted env vaults there, and add a real post-clone local readiness/run checker for key projects.

## 2026-06-17 — Graph-backed fresh-computer bootstrap prompt

### feat(cli/web): generate one-command new-computer setup artifacts
- Added `youmd machine prompt` / `youmd machine new-computer` / `youmd machine new-machine`, which print a single copyable Claude Code/Codex bootstrap command.
- Added `cli/src/lib/machine-bootstrap-prompt.ts` with shell-safe command generation and focused tests.
- The generated command installs You.md, authenticates with `YOUMD_API_KEY` when present, pulls/syncs identity, restores shared skills/stacks, links Claude/Codex skills, checks GitHub auth, hydrates the Portfolio Graph before cloning, runs `youmd machine projects`, restores encrypted env vaults only when `YOUMD_ENV_VAULT` is set, rehydrates local project/env evidence, starts resident daemons, and shows status.
- Updated the bundled `machine-bootstrap` skill so local agents use portfolio graph hydration before and after project clone rather than treating fresh-machine setup as a static checklist.
- Added deterministic signed-in shell handling for `/new computer`, `/new machine`, `/machine bootstrap`, and obvious natural-language fresh-machine setup requests. The web shell mints a 7-day scoped bootstrap key and returns the copyable command while keeping raw `.env.local` values out of the browser prompt.
- Added command-palette, Help pane, Skills pane, and docs references for `/new computer` and `youmd machine prompt`.
- Verified with `npm --prefix cli test -- machine-bootstrap-prompt`, `npm --prefix cli run build`, `npx tsc --noEmit --pretty false`, `npm run docs:check`, `npm run lint` (warnings only), `npm run build`, compiled CLI prompt smoke, and authenticated local browser QA of `/new computer`.
- Visual QA screenshot: `/tmp/youmd-new-computer-prompt-2026-06-17.png`.
- Remaining: run the generated command on the actual fresh/new computer or clean agent host and verify cloned projects, local servers, env vault restore, shared skills, resident daemons, and portfolio graph sync there.

## 2026-06-17 — Shell sidebar expand/collapse

### fix(web): let manual sidebar toggles override responsive auto-collapse
- Fixed the left shell sidebar getting stuck collapsed when the right detail pane was open below the `1520px` auto-collapse threshold.
- Replaced the raw persisted boolean with an explicit sidebar collapse mode: `auto`, `collapsed`, or `expanded`.
- Kept responsive auto-collapse as the default for narrow desktop layouts, but made the YOU/menu toggle write a manual override based on the currently rendered state so the first click expands an auto-collapsed sidebar.
- Preserved the legacy `youmd.shell.sidebarCollapsed` key for compatibility while adding `youmd.shell.sidebarCollapseMode`.
- Verified with focused dashboard lint, root lint/radius, `git diff --check`, and `npm run build`.
- Authenticated visual click QA is still pending because the available browser sessions were either unauthenticated or not attachable without writing a new local auth session.

## 2026-06-17 — GitHub sync proof, portfolio persistence, and project tasks

### feat(web/api/mcp): add portfolio task triage controls
- Added owner-gated `portfolio.updateTaskTriage` for status and priority updates on persisted `portfolioTasks`.
- Added `POST /api/v1/me/portfolio/tasks/triage` so local agents can move tasks through `proposed`, `open`, `in_progress`, `done`, `snoozed`, and `cancelled`, or change priority without creating duplicate tasks.
- Added local MCP tool `update_portfolio_task` beside `upsert_portfolio_task`, `hydrate_portfolio_graph`, and `record_brain_dump`.
- Reworked the Portfolio Graph task section into `TASK TRIAGE`, with visible status and priority chips plus compact controls for `open`, `doing`, `done`, `snooze`, `cancel`, `low`, `normal`, `high`, and `urgent`.
- Deployed Convex to `kindly-cassowary-600` after the first browser click proved the local web app needed the new remote mutation.
- Authenticated local browser QA created a no-sync QA task, opened `/shell`, clicked the task controls, moved it to `urgent`, then `in_progress`, then `done`, and verified `task triaged: done / urgent`. Screenshot: `/tmp/youmd-task-triage-controls-2026-06-17.png`.
- API/local-agent proof created a no-sync task through `savePortfolioTask`, triaged it through `/api/v1/me/portfolio/tasks/triage` to `done / urgent`, and verified `repoSync.attempted=false`.

### fix(web/cli/convex): hydrate Portfolio Graph from real active projects
- Fixed the Portfolio Graph pane so the persisted graph is no longer only the
  4-project dashboard bootstrap seed.
- Added `portfolio.syncTrackedProjects`, which hydrates `portfolioProjects`
  from authenticated 90-day GitHub `trackedProjects` records while preserving
  richer human/agent strategy fields.
- Added `portfolioProjectActivities` so local commit/PR/doc evidence persists
  as activity intelligence instead of disappearing after the CLI scan.
- Added a `hydrate active projects` action in the Portfolio Graph pane beside
  the seed refresh button.
- Added shipped chips on project cards (`today`, `7d`, `30d`) plus a
  drill-in shipping timeline that shows commit/PR/summary activity over time.
- Sorted hydrated project rows by recent shipping activity, local-audit signal,
  and core project priority so high-signal projects are visible first instead
  of being buried under arbitrary repo order.
- Added `POST /api/v1/me/portfolio/projects/hydrate` and
  `youmd project portfolio-hydrate`, which run the local portfolio auditor,
  filter noisy nested packages/reference repos, and upsert workspace-level
  local projects into the Convex portfolio graph.
- Added local MCP tool `hydrate_portfolio_graph` for agents that need to
  hydrate from the tracked GitHub project catalog without using the dashboard.
- Ran `youmd project portfolio-audit --root /Users/houstongolden/Desktop/CODE_2025`:
  268 project/package candidates, 23 env files, and 97 providers were detected
  without printing secret values.
- Ran `youmd project portfolio-hydrate --root /Users/houstongolden/Desktop/CODE_2025 --days 90 --limit 80`:
  129 recent local candidates scanned, 30 local projects upserted, 40 GitHub
  tracked projects considered, 36 portfolio rows created, and 4 updated on the
  initial corrective run; final deployed reruns refreshed the same 40 tracked
  rows and 30 local-audit rows without creating duplicates.
- Deployed Convex to `kindly-cassowary-600`.
- Authenticated local browser QA verified the actual shell now shows
  `55 PROJECTS`, `CONVEX PERSISTED GRAPH`, `40 recent GitHub-tracked projects
  nearby`, the `hydrate active projects` control, and hydrated rows including
  `badapp`, `bamfaiapp`, `bamfsite`, `bigbounce`, `foldermd`, `youmd`, `claws`,
  and `creator-new`.
- Authenticated local browser QA also verified shipped chips and the timeline:
  top projects ranked as `bamfsite`, `youmd`, `fantasyis`, and `bigbounce`, and
  screenshots were captured at
  `/tmp/youmd-portfolio-activity-proof-2026-06-17-v2.png` and
  `/tmp/youmd-portfolio-timeline-proof-2026-06-17-v3.png`.

### feat(api/cli/mcp): let local agents write portfolio tasks and brain dumps
- Added authenticated API endpoints for local-agent writes:
  `POST /api/v1/me/portfolio/tasks` and
  `POST /api/v1/me/portfolio/brain-dumps`.
- Added `youmd project task` and `youmd project braindump`, including compact
  agent/human owner syntax, project scoping, tags, proposed tasks, and
  repo-sync status output.
- Added local MCP tools `upsert_portfolio_task` and `record_brain_dump` so
  Claude/Codex/Cursor-style MCP clients can create the same Convex-backed
  `portfolioTasks` and `brainDumpCaptures` records.
- Updated GitHub repo sync so safe `you.json.custom_files` snapshots are pushed
  as actual repo files, including `projects/<slug>/tasks.md` and
  `projects/_braindumps/recent.md`, rather than staying hidden inside JSON only.
- Deployed Convex to `kindly-cassowary-600`.
- Verified with `npx convex codegen`, `npx tsc --noEmit --pretty false`,
  `npm --prefix cli run build`, `npm run lint` (warnings only),
  `git diff --check`, and `npm run build`.
- Verified authenticated CLI task write: bundle v100, snapshot
  `projects/youmd/tasks.md`, merged PR #9, and refreshed repo mirror.
- Verified authenticated CLI brain-dump write: bundle v102, snapshot
  `projects/_braindumps/recent.md`, merged PR #10, and refreshed repo mirror.
- Verified GitHub contents and the repo mirror now include both snapshot files
  with 50 mirrored files.
- Verified authenticated local browser Portfolio Graph QA: `CONVEX PERSISTED
  GRAPH`, the CLI-created task row, the CLI-created brain-dump summary, and
  fresh/current GitHub status were visible in the actual shell.

### feat(web): let shell chat save tasks/brain dumps and trigger repo sync
- Added deterministic shell chat commands for `/task ...` and `/braindump ...` so the You Agent surface can create owner-aware `portfolioTasks` and raw `brainDumpCaptures` without using a form.
- Task commands write portable markdown snapshots into `projects/<project-or-_personal>/tasks.md`; brain-dump commands write `projects/_braindumps/recent.md`, preserving raw text, summaries, tags, linked projects, and proposed tasks in `you.json.custom_files`.
- Wired those chat-created bundle updates to the same publish -> GitHub PR push -> mirror refresh loop used by the shell `[ update ]` button, so chat-initiated work visibly animates the GitHub status and streams PR/merge/mirror transcript lines.
- Added `recent brain dumps` rows to the Portfolio Graph pane beside the existing open task rows.
- Verified with root `npm run lint`, root `npm run build`, and authenticated Chrome QA on local `/shell`: `/braindump project:youmd ...` saved the capture, proposed agent tasks, wrote `projects/_braindumps/recent.md`, pushed/merged PR #7, refreshed 47 mirror files, and returned GitHub chrome to `SYNCED / REPO MIRROR CURRENT / JUST NOW`.
- Verified `/task me personal: ...` saved a human-owned personal task, displayed `HUMAN / PERSONAL`, wrote `projects/_personal/tasks.md`, pushed/merged PR #8, refreshed 47 mirror files, and kept GitHub chrome at `SYNCED / REPO MIRROR CURRENT / JUST NOW`.

### test(web): verify authenticated 90-day GitHub project catalog refresh
- Opened authenticated local `/shell?integration=github` in Chrome, clicked `refresh active projects`, and waited through the `analyzing your most active repos` state.
- Verified the dashboard returned 38 visible `repo: houstongolden/...` project rows, including repo name, local directory name, inferred stack, API/MCP docs links, goal, and recent progress fields.
- Verified the shell GitHub status indicator refreshed to `JUST NOW` after the analysis completed.
- Captured a visual proof screenshot showing the GitHub connector repo tab, `refresh active projects`, and the refreshed project catalog list.

### feat(web/convex): hydrate portfolio graph dashboard from persisted records
- Added `portfolio.syncDashboardSeed`, an owner-gated mutation that upserts the dashboard bootstrap graph into `portfolioProjects`, `portfolioApiSurfaces`, `portfolioDependencyEdges`, and `portfolioReusablePatterns`.
- Refactored the `/shell` Portfolio Graph pane to query `portfolio.listPortfolioGraph`, label whether it is rendering `bootstrap graph` or `convex persisted graph`, and demote the local static graph to a bootstrap/fallback seed.
- Added a pane-level `persist graph` / `refresh persisted graph` control, task/capture count visibility, and status text for persisted project/surface/edge/pattern counts.
- Deployed Convex functions to `kindly-cassowary-600` after the first browser proof exposed the new mutation was not yet available to the remote-backed local web session.
- Verified with `npx convex codegen`, `npx tsc -p convex/tsconfig.json --noEmit`, `npm run test:convex` (421 tests), root `npm run build`, and authenticated Chrome QA at `http://localhost:3100/shell`. The final browser proof showed `CONVEX PERSISTED GRAPH`, 4 projects, 5 surfaces, 4 edges, 5 patterns, and `persisted 4 projects / 5 surfaces / 4 edges / 5 patterns`.

### feat(convex/cli/web/skills): persist portfolio graph foundations and prove repo update freshness
- Added persisted Convex portfolio foundations for project strategy records, API/MCP surfaces, dependency edges, reusable patterns, raw brain-dump captures, and owner-aware portfolio tasks.
- Added owner-gated portfolio queries/mutations for listing the graph, fetching a project slice, upserting projects/tasks, and recording brain dumps.
- Added local MCP `get_project_context` project-scoped `portfolioGraph` slices so agents can see owned surfaces, dependencies, reusable patterns, commands, guardrails, and skill propagation before creating duplicate APIs or stacks.
- Added shared `braindump-task-router` under the canonical `.agent-shared` skill root, synced it through Claude/Codex/Cursor/Pi mirrors, and recorded the route in the shared stack map.
- Rewired shell `[ update ]` to publish the bundle, push identity files to the linked GitHub repo, refresh the server mirror, animate the GitHub status, and stream each step into shell chat.
- Extended `pushToRepo` results with PR URL/number, merged state, and branch-recreated retry state so shell transcripts can show PR/merge/conflict details.
- Fixed explicit GitHub push/mirror completion so `pendingPushAt`, `lastPushError`, and `mirrorStale` clear after a successful sync.
- Deployed the Convex backend to `kindly-cassowary-600`.
- Verified with root `npm run build`, `npm run test:convex` (421 tests), `npx tsc -p convex/tsconfig.json --noEmit`, `cd cli && npm run build`, focused diff hygiene, local MCP `get_project_context` smoke, shared-skill mirror checks, and authenticated Chrome `/shell` QA. The final Chrome proof showed `SYNCING` -> `SYNCED / REPO MIRROR CURRENT / JUST NOW` and PR #5 merged for `houstongolden/houstongolden-you-md`.
- Kept the larger lane open: dashboard hydration from persisted records, authenticated 90-day project catalog visibility, persisted update artifacts/history, shell-chat-initiated content-change proof, and seeded project strategy records remain pending.

## 2026-06-17 — Resident daemon and always-on sync

### feat(cli/runtime): make resident sync first-class and daemon-safe
- Added shared daemon metadata/health helpers for the resident You.md runtime.
- Added `com.youmd.context-sync`, a third LaunchAgent that runs `youmd stack context-sync` every 15 minutes for project agent-context files.
- Changed `com.youmd.identity-sync` to run `youmd sync --daemon`; daemon mode refreshes local identity files and installed skills while skipping unsafe lossy pushes instead of force-uploading a compiled bundle that is >50% smaller than `base.json`.
- Added daemon health to `youmd status` and expanded `youmd stack daemon status` to show loaded state, sync plane, interval, last activity, and current warnings.
- Added opt-in curl installer daemon activation via `YOUMD_INSTALL_DAEMON=1`, while keeping normal install non-surprising and documenting `youmd stack daemon install` as the later activation path.
- Hardened `context-sync.sh` so it fetches first and refuses pull/push when upstream contains non-context app-code paths; it only syncs `AGENTS.md`, `CLAUDE.md`, `project-context/`, and `.claude/`.
- Installed the updated local `0.8.2` CLI tarball globally on this machine, installed all three LaunchAgents, kicked the identity daemon, and verified `youmd sync --daemon` and daemon status.
- First context daemon run pushed a context merge in `bamfaiapp`, made local context commits in `bigbounce`, `myo`, `hubifycode`, and `badapp`, and skipped pull/push where WIP code existed; the upstream app-code merge gap was then fixed in the script.

## 2026-06-17 — Project portfolio graph and reuse catalog

### fix(web/cli/skills): prove portfolio graph sync across local agents and dashboard
- Fixed the `/skills` explainer visual regression where the intended faint orange wash rendered as a solid bright orange block; the panel now uses an explicit low-opacity gradient and readable terminal-dark styling.
- Added a local-agent sync proof strip to `/skills` showing current installed-skill state for `portfolio-graph-auditor`, `meta-improve`, `proactive-context-fill`, plus the `get_agent_brief + portfolio graph` startup packet path.
- Added `cli/src/lib/portfolio-graph.ts`, wired `portfolioGraph` into local MCP `get_agent_brief` / `youmd://agent/brief`, exposed structured `youmd://portfolio/graph`, and bumped the markdown brief default cap to preserve the new graph section.
- Self-improved the canonical shared `portfolio-graph-auditor` skill so it requires local agents to verify `get_agent_brief` / `youmd://agent/brief` includes `## Portfolio Graph` and to use `youmd://portfolio/graph` for structured reads.
- Synced the shared agent layer from `.agent-shared`, verified the canonical skill update appears in Claude/Codex/Cursor mirrors, refreshed the local You.md installed skill cache, and ran `youmd skill sync` showing 7 installed skills synced.
- Verified local stdio MCP end-to-end: `get_agent_brief` includes `## Portfolio Graph`, `portfolio-graph-auditor`, and `youmd project portfolio-audit --root ~/Desktop/CODE_2025`; `resources/list` includes `youmd://portfolio/graph`; `resources/read` returns `bamfaiapp` context without secret-like values.
- Verified the signed-in local `/skills` dashboard in Chrome at `http://localhost:3100/shell`; screenshot saved at `/tmp/youmd-skills-pane-sync-proof-2026-06-17-v2.png`.
- Verified with `cd cli && npm test -- mcp-agent-brief skills-registry-sync`, `cd cli && npm run build`, root `npm run lint`, `git diff --check`, and root `npm run build`.

### feat(web/cli/skills): add portfolio graph and APIs/env intelligence foundation
- Added `src/data/portfolioGraph.ts` with the first local typed portfolio graph contract for projects, API/MCP/provider surfaces, dependency edges, reusable patterns, service-account notes, env-provider usage, and shared skill propagation.
- Added `/shell` Portfolio Graph and APIs + Env Intelligence panes, plus sidebar, desktop/mobile pane navigation, command palette, slash-command, and You Agent help routing for `/portfolio`, `/projects`, `/api`, `/apis`, and `/env`.
- Added bundled dashboard visibility for `portfolio-graph-auditor` and a tracked-project propagation table in the Skills pane so shared skills can be viewed across You.md/BAMF targets.
- Registered `portfolio-graph-auditor` in the local CLI bundled skill catalog and aligned `/skills`, MCP skill descriptions, and the dashboard Skills pane with the existing `machine-bootstrap` skill so local agent sessions and web skill-stack views show the same catalog.
- Added `youmd project portfolio-audit` with aliases `env-audit` and `apis`; it scans local projects and `.env.local` key names without printing values, with optional local salted HMAC fingerprints for reused-key detection.
- Added shared `portfolio-graph-auditor` under `.agent-shared`, synced it into Claude/Codex/Cursor/Pi mirrors, updated `machine-sync`, and logged the skill-governor learning.
- Fixed `shared:` skill source resolution so CLI catalog entries can install from the canonical `.agent-shared` skill root and host mirrors. `youmd skill improve` surfaced `portfolio-graph-auditor` as a missing install, then `youmd skill install portfolio-graph-auditor` and `youmd skill sync` installed/synced it into the local You.md skill bundle; idempotent `youmd skill install <name>` now refreshes the remote dashboard record when a skill is already installed locally.
- Verified with `cd cli && npm run build`, root `npx tsc --noEmit --pretty false`, `node cli/dist/index.js project portfolio-audit --root /Users/houstongolden/Desktop/CODE_2025/youmd --json`, `~/.agent-shared/bin/env-key-audit.py --root /Users/houstongolden/Desktop/CODE_2025/youmd`, shared skill inventory, and `npm run build`.
- Verified the shared-skill install path with `cd cli && npm test -- skills-registry-sync`, `cd cli && npm run build`, `node cli/dist/index.js skill install portfolio-graph-auditor`, `node cli/dist/index.js skill sync`, and `node cli/dist/index.js skill list`.
- Verified the local signed-in dashboard at `http://localhost:3100/shell` through the development email-code flow. Screenshot-backed checks passed for the Portfolio Graph pane, APIs + Env Intelligence pane, and `/skills` tracked-project propagation view; after refreshing install records, `/skills` shows `7 installed`, `INSTALLED (7)`, `portfolio-graph-auditor` in the installed section, and tracked propagation across `youmd`, `bamfaiapp`, and `bamfsite`. The Codex in-app browser still failed to attach, so Chrome extension control was used as the visual QA fallback.

### docs(product): capture cross-project dependency and reuse layer
- Added `project-context/PROJECT_PORTFOLIO_GRAPH_AND_REUSE_PRD_2026-06-17.md` as the product memo for a first-class You.md portfolio graph across projects, APIs, MCPs, stacks, protected in-product agent harnesses, dependency edges, integration tiers, machine readiness, and reusable code/UI/architecture patterns.
- Added `project-context/prompts/2026-06-17-project-portfolio-graph-reuse-dependency-routing.md` as the sanitized prompt capture for the BAMF site/BAMF.ai/Lempod-driven realization.
- Updated PRD, Architecture, Current State, Features, TODO, and active request tracking so future agents see this as an active product lane.
- Documented how You.md currently saves Projects: identity bundle `projects`, generated `projects/<slug>/` markdown packs, repo-local/global project-context overlays, GitHub `trackedProjects`, repo mirror, DSI project catalog components, and Loop Report snapshots.
- Captured reusable defaults Houston wants available across projects: API/MCP/SkillStack-first architecture, protected harness vs installable public stack boundaries, role hierarchy, custom passwordless auth preference, standard left sidebar/app shell, agentic split workspace, no dead loading spinners, and no boxes-within-boxes design.
- Tracked Lempod management across `bamfsite` and `bamfaiapp` as the first duplicate-risk ownership audit before any new endpoint work.

## 2026-06-16 — Fresh-machine project catalog sync

### feat(cli/convex/web): hydrate 90-day GitHub projects for CODE_YOU setup
- Updated `youmd machine projects` to default to `~/Desktop/CODE_YOU`, read authenticated GitHub repos pushed in the last 90 days via `gh`, merge them with You.md bundle project records, and skip broad duplicate bundle entries covered by recent repo data.
- Added stack inference, API docs links, MCP docs links, repo names, directory names, homepage/project URLs, and richer dry-run output to the machine-project planner.
- Extended tracked GitHub project records with repo URL, project URL, repo/directory name, API/MCP docs URLs, stack name/slug, high-level goal, and recent progress so the DSI project catalog and dashboard can confirm what a new machine should clone.
- Updated the dashboard GitHub project refresh cards to show repo, directory, stack, API/MCP docs, GitHub URL, project URL, goal, and recent progress.
- Linked the fresh-machine skill to the canonical `.agent-shared` encrypted env audit/backup/restore tooling instead of creating a second secret-sync path.
- Verified locally with `cli npm test -- src/__tests__/machine-projects.test.ts`, `cli npm run build`, root `npx tsc --noEmit`, `npx convex codegen`, Playwright route smoke for `/` and `/dashboard` redirect, and `node dist/index.js machine projects --dry-run --no-clone --root /tmp/CODE_YOU --days 90` finding 41 recent repos and skipping 5 duplicate broad records.

## 2026-06-16 — You.md voice-memo lane handoff

### docs(product): consolidate the You.md Part 2 brain-dump lane
- Added `project-context/voice-memo-part-2-youmd-handoff-2026-06-16.md` as the single You.md handoff for Houston's Part 2 voice-memo/mobile-capture lane, with a status table covering universal capture inbox ownership, Sendblue/provider-agnostic gateway direction, raw transcript artifacts, dedupe/segmentation/routing, project task proposals, approval gates, custom-voice safety, voice/likeness grants, Slack host adapter policy, `y.computer` naming, and You.md API/MCP/YouStack ownership.
- Tightened `TODO.md`, `FEATURES.md`, `CURRENT_STATE.md`, and active request `#129` so the next slice and blocked product decisions are explicit: first capture pilot, inbox home, first downstream task destination, Slack v1 mode, and voice disclosure/grant shape.
- Preserved the identity-native framing that the agent is an amplified version of the user with explicit consent, scopes, disclosure, revocation, and audit rather than a deceptive ambient assistant.

## 2026-06-16 — Connector catalog icons and local-agent verification

### feat(web): use real connector favicons and prioritize local-agent setup
- Updated the `/shell` Connectors `apps` catalog to use Google favicon API URLs from each connector's real domain instead of generic placeholder icons.
- Added `Local Agent Runtime` as the first recommended connector path for Claude Code, Codex, Cursor, ChatGPT, and local MCP clients, with copyable install/smoke-check commands and explicit grant `lastUsedAt` verification copy.
- Reordered the catalog so You.md/owned/custom connectors stay pinned first, then popular services appear immediately after: Slack, Notion, Gmail, Google Calendar, Linear, GitHub, HubSpot, Salesforce, Firecrawl, Stripe, and Google Drive.
- Added stable `data-connector-*` attributes so browser QA and future tests can verify connector order, domains, and recommended local-agent placement without scraping incidental marketing copy.
- Verified locally with focused connected-app grant tests, TypeScript, lint, build, `git diff --check`, and authenticated in-app browser QA at `http://localhost:3100/shell`.

## 2026-06-16 — Mobile capture and project routing

### docs(product): add brain-dump inbox, voice, and Slack direction
- Added `MOBILE_CAPTURE_AND_PROJECT_ROUTING_2026-06-16.md` to preserve the Part 2 brain-dump direction: mobile brain-dump inbox, provider-agnostic SMS/iMessage capture, raw transcript artifacts, dedupe/segment/classify routing, task/memory proposals, BAD workout handoff, Slack host adapter, voice clone/likeness boundaries, and `y.computer` naming exploration.
- Added a sanitized prompt capture under `project-context/prompts/2026-06-16-mobile-capture-voice-slack-project-routing.md` with no private phone numbers, credentials, or provider secrets.
- Updated PRD, architecture, personal API/MCP, connector, YouStacks, current-state, feature inventory, TODO, active feature requests, and prompt history so the memo is rooted in durable product context.
- Ran a quick Sendblue documentation scan: current docs expose inbound receive webhooks and API v2 messaging surfaces, but the docs now keep Sendblue as an adapter candidate rather than hardcoded architecture.
- Verified with `npm run docs:check`, `npm run agent-docs:lint`, `git diff --check`, and a focused phone/secret scan against the new mobile-capture memo and sanitized prompt capture.

## 2026-06-16 — Machine bootstrap skill

### feat(cli): add fresh-machine project bootstrap
- Added bundled `machine-bootstrap`, a You.md skill for setting up new Macs/laptops/virtual agent hosts with local identity sync, shared skills/stacks, GitHub auth, and active project repo checkout.
- Added `youmd machine projects`, which reads the active local bundle, defaults to `~/Desktop/CODE_YOU`, separates recent/active projects from older projects, prompts before including older projects, and supports `--root`, `--days`, `--yes`, `--dry-run`, and `--no-clone`.
- Project setup now uses GitHub repo names as local directory names when URLs are present, dedupes duplicate repo targets, skips non-empty directories, and clones with `gh repo clone` or `git clone`.
- Added focused planner tests for GitHub URL parsing, repo-name targets, recency classification, active undated projects, and dedupe.
- Verified locally with `npm test -- src/__tests__/machine-projects.test.ts`, `npm run build` in `cli/`, and a dry-run `node dist/index.js machine projects --dry-run --no-clone --root /tmp/youmd-code-2026-smoke --days 90`.

## 2026-06-16 — DSI weather and surf components

### fix(web): make the private API/MCP control center easier to find
- Renamed the shell primary `api` group to `connect` and changed its subtab from `github` to `api/mcp`, so the personal API/MCP + connector surface no longer reads like a GitHub-only page.
- Added `/api`, `/mcp`, `/connect`, `/connectors`, `/apps`, `/crawlers`, `/crons`, and `/loops` slash-command routing to the Connectors control center.
- Added the new API/MCP connector commands to the command palette and `/help` output.
- Added copyable owner/agent snippets for hosted MCP config, local MCP host adapter install, REST smoke checks, and a scoped agent startup prompt.

### feat(convex/web): add BAMF pulse DSI adapter
- Added a private `bamf-pulse` DSI component for BAMF.ai/BAMF OS connected-app pulse data: clients, creators, LinkedIn post metrics, agency counts, case studies, newsletter/chat lead counts, and recent stack sync runs.
- The adapter supports BAMF OS REST through `YOUMD_BAMF_OS_API_KEY`/`BAMF_OS_API_KEY`, BAMF.ai REST through `YOUMD_BAMF_AI_API_KEY`/`BAMF_AI_API_KEY`, and private `customData.bamf`/`bamfai`/`bamfOS`/`agency` fallback for source-compatible testing.
- The Files/Reports DSI Catalog now includes `refresh bamf`, persists BAMF source snapshots with provenance, and surfaces an honest unconfigured state when no key or private custom data exists.
- Daily Loop Reports now treat `bamf-pulse` as the connected-app pulse and stop listing BAMF as pending once the component has been refreshed.
- Verified locally with Convex codegen and focused DSI/Loop Report tests.

### feat(convex/web): add Bad.app fitness DSI adapter
- Added a private `badapp-fitness` DSI component that normalizes Bad.app/BAD Stack State of You intelligence, health summaries, body scans, and fitness tests into the You.md personal API/MCP catalog.
- The adapter supports live Bad.app REST hydration through `YOUMD_BADAPP_API_KEY`, `BADAPP_API_KEY`, or `BAD_API_KEY`, plus a private `customData.badapp`/`badApp`/`badfit`/`fitness`/`health` fallback so the same component can be tested without external secrets.
- The Files/Reports DSI Catalog now includes `refresh bad.app`, persists source snapshots with Bad.app provenance, and surfaces an honest unconfigured state when no key or private custom data exists.
- Daily Loop Reports now include fitness DSI components in the body/weather/surf section and stop listing Bad.app as an external adapter pending once `badapp-fitness` has been refreshed.
- Verified locally with Convex codegen and focused DSI/Loop Report tests.

### feat(convex/web): add private task queue DSI adapter
- Added a You.md-native `task-queue` DSI component that reads h.computer-compatible task arrays from `privateContext.customData` (`tasks`, `taskQueue`, `h_tasks`, or `todos`) and normalizes title, details, status, priority, due dates, source text, tags, proposed state, and completion timestamps.
- Task Queue snapshots preserve an honest unconfigured state when no private task source exists, and otherwise compute open, overdue, due-today, proposed, urgent/high, snoozed, and recent-done counts plus reusable agent prompts.
- Added a `refresh tasks` control to the Files/Reports DSI Catalog so owners can materialize the private task object as a read-only markdown artifact under `dsi/private/task-queue.md`.
- Verified locally with Convex codegen and focused DSI/Loop Report tests.

### feat(convex/web): add Google Calendar agenda DSI adapter
- Added an owner-gated agenda DSI action that ports h.computer's important-upcoming Google Calendar filter into You.md: it keeps family, sports, school, health, travel, and meetings with attendees while dropping common focus/hold/fluff blocks.
- The adapter supports native Google Calendar bearer-token env first and the legacy h.computer/Lovable connector gateway as a compatibility fallback; when no calendar connector is configured it persists an honest private unconfigured component instead of inventing agenda data.
- Agenda snapshots now fold in the owner's existing private `calendarContext`, persist as `agenda-today`, and are visible from the Files/Reports DSI Catalog through a new `refresh agenda` control.
- Verified locally with Convex codegen, focused Convex tests, root TypeScript, Convex TypeScript, lint, and build.

### feat(convex/web): port school logistics crawler into private DSI
- Added a You.md-native school logistics DSI action that fetches the h.computer Google Doc `mobilebasic` source, strips the document, deterministically extracts upcoming active-grade/school-wide dated items, and persists the result as a private source-backed DSI component.
- The school component carries Mar Vista countdowns, active grade defaults, upcoming event totals, next-event metadata, source lines, citations, and parser provenance; LLM extraction and Google Calendar writeback remain explicit follow-up adapters.
- Added a `refresh school` control to the Files/Reports DSI Catalog panel and focused Convex coverage for private component + source snapshot persistence.
- Verified locally with live Google Doc fetch smoke, Convex codegen, focused Convex tests, root TypeScript, Convex TypeScript, lint, and build; authenticated click-through could not be repeated in the fresh Playwright context because it redirected to sign-in.

### feat(convex/web): enrich GitHub Project Catalog DSI with language metrics
- Added an owner-gated GitHub Project Catalog DSI action that calls GitHub `/languages` for tracked repositories, computes h.computer-style LOC/LOMB/LOMB ratio from language byte totals, and persists the enriched component through the existing private DSI/source-snapshot path.
- The Files/Reports `refresh projects` control now prefers the GitHub-language action and falls back to the DB-only tracked-project/repo-mirror refresh when GitHub auth or rate limits are unavailable.
- Focused Convex tests now cover both the fallback repo-mirror path and the enriched `/languages` path, including project metric statuses and aggregate LOC/LOMB totals.
- Verified locally with Convex codegen, focused Convex tests, root TypeScript, Convex TypeScript, lint, build, and authenticated browser QA at `http://localhost:3100/shell`; browser refresh showed `10 projects / 226 commits/90d / 1,272,721 LOC / 0 LOMB`.

### feat(convex/web): port the first h.computer live signals into You.md DSI
- Added `dsiComponents`, a private/scoped/public-ready structured component table for extensible personal API/MCP facts.
- Added an owner-gated DSI action that refreshes Open-Meteo weather and Venice Breakwater surf data, ports the h.computer Surfline-style face-foot/wind-quality calibration, and writes source snapshots for provenance.
- Added a GitHub Project Catalog DSI refresh from tracked projects plus the repo mirror, including GitHub URLs, matched project URLs, recent commits, stars, AI insight, visibility, and exact repo-mirror LOC/LOMB/LOMB ratio where available.
- Daily Loop Reports now snapshot current DSI components and include weather/surf summaries when present.
- The Files/Reports workspace now includes a DSI Catalog panel with refresh controls for weather/surf and projects, component counts, status, visibility, trust level, summaries, and read-only markdown artifacts under `dsi/private/*`.
- Verified locally with focused Convex tests, full TypeScript, lint, build, and authenticated browser QA at `http://localhost:3100/shell`; the browser refresh created `weather-home`, `surf-venice-breakwater`, and `github-project-catalog`, then a fresh daily run showed the DSI snapshot in the report source set.

## 2026-06-16 — Public profile conversation API

### feat(web/convex): add owner controls for public profile chat
- Added owner-editable public profile chat controls in the Share pane: enable/disable, concise/voice/consultive mode, allowed public fields, advertised capabilities, source-link toggle, and a short owner note.
- Persisted those controls into `preferences.public_chat` inside the public `youJson`, so the settings travel with the portable public brain instead of living in a disconnected UI-only store.
- Updated the public profile chat widget to hide when disabled and tailor suggestion chips from the owner's advertised capabilities.
- Updated `POST /api/v1/profiles/[username]/conversation` and hosted MCP `ask_public_profile` to honor the same controls: disabled state, field allow-list, source suppression, style metadata, capabilities, and explicit private-context omissions.
- Added focused Convex tests for owner settings persistence and MCP field filtering.
- Hardened the profile Open Graph image font loader so local dev public-profile renders do not crash when Next rewrites the bundled JetBrains Mono font to a relative static URL.

### feat(web): make public profiles conversational from public context
- Added `POST /api/v1/profiles/[username]/conversation`, a public-context-only conversation endpoint that answers from the user's public `you.json`/`you.txt` surface and returns sources, fields used, suggested follow-ups, and explicitly omitted private context.
- Added a compact above-the-fold public profile chat box so visitors can ask what a person is building, what to ask them about, and what public expertise their You.md exposes.
- Regenerated the agent docs reference, OpenAPI spec, `llms.txt`, and `llms-full.txt`; the generated docs reference now lists 85 documented endpoints.
- Added hosted MCP parity via `ask_public_profile`, so MCP clients can ask the same public-context-only question without a private grant; fixed generated docs to count hosted MCP tools from the registry.

## 2026-06-16 — Local agent auth handoff

### feat(cli/web): make curl-installed login feel like a real local runtime
- Added `/auth` as the clean browser approval alias for the existing `/device` flow while preserving `/device` for older clients.
- Updated the CLI device-login flow to show the short code, wait for Enter, open `you.md/auth`, and then poll for browser approval.
- Added a branded post-approval success page that says the web session and local agent are authenticated, shows the user's ASCII portrait when available, and links to `/shell`.
- Updated the curl installer next-step copy to guide fresh machines through `youmd login`, `youmd pull`, `youmd sync`, then `you`.
- Bumped the CLI package to `youmd@0.8.2` and rebuilt `cli/dist` for publish.
- Captured the raw bootstrap/auth vision in `project-context/prompts/2026-06-16-local-agent-bootstrap-auth-confirmation.md`.
- Added a guided first-run `you` handoff after login/pull/init so fresh machines can sync/hydrate, inspect status, or open U without guessing the next command.

## 2026-06-16 — Loop Report substrate

### feat(convex): add scheduled report artifacts and source snapshots
- Added first-class Loop Report tables for owner report definitions, immutable source snapshots, report runs, and markdown/JSON report artifacts.
- Added owner functions to seed/list/create/pause report definitions, list runs/artifacts, and manually run the first deterministic daily briefing.
- Added an hourly due-loop cron that runs active due daily briefings and advances unsupported report types safely.
- The first daily briefing compiler now snapshots You.md-owned agent activity, projects, source/crawler state, pending source changes, repo mirror data, and durable memories, then writes a private markdown artifact with structured facts and explicit external-adapter placeholders.
- The Files pane now surfaces generated private Loop Report artifacts as read-only markdown under `reports/generated/*`.
- Added focused Convex tests for default seeding, manual report generation, duplicate-run reuse, source snapshot creation, and cron execution.

### feat(web): make loop reports visible and manageable in shell
- Added a Reports workspace control panel that shows loop definitions, active counts, recent runs, and generated artifacts.
- Owners can seed the default daily loops, manually run the daily briefing, pause/resume loop definitions, and open generated markdown artifacts from the same Files/Reports surface.
- Added owner-only source snapshot drilldown for report runs, including normalized facts, raw hashes, trust levels, connector/source kind, and capture windows.

## 2026-06-16 — Shell GitHub update chrome and usage surface

### fix(web): clarify repo sync and update controls in shell
- Replaced the confusing top-right GitHub/refresh/publish/deploy icon cluster with one GitHub repo status control and one small `[ update ]` action.
- Right-aligned the repo chrome, hid the repo name until GitHub hover, added a solid Octocat mark, GitHub-style sync state dot colors, and a compact last-sync label from the Convex repo mirror.
- Made `[ update ]` stream a structured update preflight into the shell chat before invoking the existing publish/sync flow, so the shell starts becoming the audit trail for repo updates.
- Expanded the Connectors API/MCP tab with a usage-surface map covering You Agent tokens, API/MCP calls, loops/crons, crawlers, connectors, BYOK/custom env, and artifact storage.
- Upgraded the folder.md connector copy with optional 10GB free artifact/markdown storage language and a prompt owners can hand to agents.
- Captured the raw prompt and follow-up product work in `project-context/prompts/2026-06-16-shell-github-update-usage-foldermd.md`.

## 2026-06-16 — Artifact workspace and daily loop plan

### feat(web): start the artifact/report workspace inside shell
- Added `project-context/prompts/2026-06-16-artifacts-daily-loops-dsi-public-chat.md` to preserve Houston's raw request for Obsidian-style artifact viewing, daily Cron Loop reports, h.computer source migration, DSI profile components, and public profile chat.
- Added `project-context/ARTIFACTS_DAILY_LOOPS_DSI_PUBLIC_CHAT_PLAN_2026-06-16.md` with the implementation plan for artifact workspace, Loop Reports, source snapshots, DSI catalog components, and secure public profile conversation endpoints.
- Upgraded the Files pane into an artifact workspace with `files`, `artifacts`, and `reports` modes.
- Added one-click markdown templates for daily briefing, project carryover, daily journal article, and public profile chat contract; templates save through existing `custom_files` so they remain part of the portable You.md bundle/API/MCP surface.

## 2026-06-16 — Connector catalog and private API/MCP control center

### feat(web): make connected app grants and personal API docs visible in shell
- Reworked the authenticated Connectors pane into four clear owner tabs: `api/mcp`, `apps`, `crawlers/loops`, and `repo`.
- Added an owner-facing private API/MCP documentation surface for the current user, including the personal REST base, hosted MCP endpoint, stack-scoped MCP endpoint, auth header contract, resource map, and private endpoint table.
- Added live connected-app grant management backed by the existing `connectedAppGrants` Convex mutations: owners can create one-time `yg_` grants from catalog entries and revoke active grants from the API/MCP tab or app cards.
- Added a Lovable-style app connector catalog with search, categories, pinned first-party/owned project connectors, Custom API, Custom MCP, Custom Webhook, and common services including Firecrawl, Gmail, Google Calendar, Notion, Slack, Linear, Stripe, Shopify, Supabase, Vercel, OpenAI, Perplexity, Airtable, Google Drive/Sheets/Docs, Microsoft, HubSpot, Salesforce, PostHog, Sentry, n8n, LinkedIn, X, RSS, ElevenLabs, Replicate, Strava, and Spotify.
- Split GitHub repo sync into the `repo` tab so GitHub is one connector/source input instead of swallowing the entire personal API/MCP product surface.
- Embedded the existing Sources pane under `crawlers/loops`, with a top summary for crawler providers, cron refresh policies, immutable versions, monitored changes, and approvals.
- Verified locally with `npx tsc --noEmit`, `npm run lint` (existing warnings only; radius guard passed), `npm run build`, and authenticated in-app browser QA at `http://localhost:3100/shell`.

## 2026-06-16 — Shell collapsed logo fit

### fix(web): stop the collapsed YOU mark from clipping
- Reduced the collapsed PixelYOU mark scale from `0.102` to `0.094` and widened its clipped viewport from `32px` to `36px`.
- Shifted the collapsed logo viewport slightly left so the final `U` has enough room inside the skinny sidebar rail.
- Vercel deployment `dpl_3K5S5n446oTqL2qDvZbUXraubqdc` reached Ready and is aliased to `https://www.you.md` / `https://you.md`; authenticated production visual QA confirmed the collapsed `YOU` mark now fits cleanly in the rail.

## 2026-06-16 — Shell opening intelligence brief

### fix(web): make new shell sessions greet from real activity context
- Added a session-opening activity brief for the web You Agent that includes the user's display name, latest bundle version/status, tracked/active projects, private project folder count, recent memories, recent saved chat sessions, and GitHub repo mirror file/size/sync status when available.
- Updated the opening prompt so the agent acknowledges the user by name, references concrete recent activity/milestones, and suggests useful next moves instead of showing a blank session or only a one-word restored command like `repo`.
- Added a deterministic local fallback opening brief so the transcript still has a useful personal summary and next moves if the streamed model returns an overly short stub.
- Changed New Chat to start a fresh uninitialized session so the richer opening greeting runs, and ignored half-empty recent chat restores that have no assistant reply.
- Verified locally with `npm run lint`, `npm run build`, and `git diff --check`.

## 2026-06-16 — Shell right-panel responsiveness

### fix(web): make the shell detail pane cleaner and harder to break
- Removed the redundant right-pane title/subtitle block (`profile` / `overview`) so the artifact area has one clear tab surface instead of repeating the selected tab twice.
- Reordered the right-pane top tabs so API sits with the primary product surfaces, renamed `face` to the clearer `portrait`, and made the tab rail horizontally scroll-safe without wrapping into awkward stacked chrome.
- Moved the cramped split behavior to `lg` and up while keeping the sidebar and top action chrome visible at `md` widths; medium screens now use the full-width shell/preview toggle instead of squeezing chat and artifacts into unusable columns.
- Raised the protected detail-pane width and clamped over-wide saved chat ratios harder so the right artifact pane stays readable on large desktop.
- Tightened the compact profile inspector with overflow containment, safer text wrapping, and no horizontal escape for long names, bios, projects, or links.
- Follow-up deployment `dpl_n4ZMQ6dv3vHwj2RimFBBwaTfkd4x` reached Ready and is aliased to `https://www.you.md` / `https://you.md`; GitHub CI run `27595879145` passed, and authenticated production visual QA confirmed the duplicate pane title is gone at medium width with a single full-width shell surface and top tab rail.
- Rebalanced the desktop shell split so the chat column stays usable while the right detail pane no longer collapses into an awkward clipped sliver.
- Moved split-mode behavior up to the large-screen breakpoint; tablet/narrow desktop now uses the full-width shell/preview toggle instead of forcing two cramped columns.
- Replaced the right pane's full public-profile render with the compact actionable profile inspector, removing the clipped giant profile/ASCII layout from the shell detail pane.
- Shortened and wrapped right-pane navigation labels so tabs remain visible and usable instead of scrolling into clipped labels.
- Flattened the compact profile inspector by removing unnecessary inner card borders around actions, projects, preferences, values, and portrait sources.
- Verified with `npm run lint`, `npm run build`, `npm run docs:check`, and authenticated production browser QA. Vercel deployment `dpl_Cwjg25ybGryr6ZYmCEjrtvEfLxGM` reached Ready and is aliased to `https://www.you.md` / `https://you.md`; production QA confirmed no horizontal overflow, ~597px chat / ~751px detail pane at 1600px, and full-width shell/preview toggle behavior at 900px.
- Follow-up hotfix restored the desktop shell chrome at `md` widths after the `lg` split behavior accidentally hid the app sidebar/top actions/right preview for narrow desktop users.
- Added explicit flex shrink/overflow containment to the shell split so long right-pane tabs/content cannot push the detail pane past the viewport. Vercel deployment `dpl_8ygDyGiGWCyz97F1ZQuG2WtJQQzH` reached Ready and is aliased to `https://www.you.md` / `https://you.md`; authenticated production QA at 900px confirmed the sidebar, top actions, resize handle, and right pane render together with 56px rail / 460px chat / 8px handle / 376px detail and no horizontal overflow.

## 2026-06-16 — Personal API context routing preservation

### docs(product): preserve h.computer platform ideas in You.md-native context
- Added `project-context/prompts/2026-06-16-youmd-personal-api-context-routing.md` to preserve Houston's latest h.computer/Creator.new/You.md boundary prompt before h.computer pages are removed.
- Updated PRD messaging so You.md clearly owns the durable agent brain, personal API/MCP, public/private context links, source catalog, provenance, trust rules, and protected agent access.
- Updated Architecture with a consumer-role map: h.computer is Houston's personal site/reference implementation, Creator.new can attach You.md identity/context, folder.md supplies readable storage conventions, BAMF.ai owns creator/media engine, and BAMF OS remains the internal BAMF brain/client tooling layer.
- Added a YouStacks Product Layer addendum covering `ystack` vs `youstack`, custom `{anything}stack` naming, reusable capability packages, host adapters, and BYOK/model routing as advanced stack capability.
- Updated Current State, TODO, Features, active request tracking, and the prompt archive so the preserved direction is visible to future agents.

## 2026-06-15 — Shell logo and panel-toggle polish

### fix(web): make shell panel controls match their geography
- Removed the separate Lucide left-panel icon from the top-left sidebar header.
- Made the PixelYOU mark a touch smaller so it fits without right-side cropping.
- Turned the YOU mark into the sidebar toggle itself; hovering the mark subtly transitions to a two-line menu glyph.
- Moved the detail/right-pane toggle out of the left side of the chat top bar and into the far-right top chrome, beside the GitHub/update/publish/deploy actions.
- Replaced the right-pane toggle icon with a cleaner custom line glyph instead of the heavier Lucide side-panel icon.
- Verified locally with `npm run lint` (existing warnings only; radius guard passed) and `npm run build`.
- Pushed to `main`; Vercel deployment `dpl_DdW1qSmFWKKc8iks3bJxbnaeYjTM` reached Ready and is aliased to `https://www.you.md` / `https://you.md`. Browser automation could only open an unauthenticated protected-shell view, so authenticated visual approval remains pending.

## 2026-06-15 — Shell composer control polish

### fix(web): remove inner composer chrome and add attach/voice affordances
- Removed the orange `>` prompt glyph from the main shell composer so the input feels like one seamless command surface instead of a nested terminal prompt inside a terminal.
- Removed inner focus outlines/rings from the textarea; focus now highlights only the outer composer parent boundary.
- Added a bottom-row `+` control for attaching images and readable text/code files, reusing the existing image-paste path and inserting text attachments into the prompt as fenced context.
- Added a `cmd/ctrl shift m` voice affordance that starts browser speech recognition where supported and falls back to a `/voice` command hint for the future Whisper-backed transcription slice.
- Verified locally with `npm run lint` (existing warnings only; radius guard passed) and `npm run build`.
- Pushed to `main`; Vercel deployment `dpl_7D9YbyHQDKBWehQ2VxnGPiSL8MTm` reached Ready and is aliased to `https://www.you.md` / `https://you.md`.
- Authenticated production browser QA confirmed the composer has zero `>` prompt glyphs, the attach and voice controls render, the focused textarea has `outline: none` and `box-shadow: none`, and only the outer composer shell carries the orange outline.

## 2026-06-15 — Shell rail and top chrome polish

### feat(web): tighten collapsed shell navigation and action chrome
- Expanded sidebar groups now render as compact closed disclosure rows by default instead of showing every item in Projects, Personal API, Skillstacks, Connect, Identity, and Chats at once.
- Group headers carry the group icon, a subtle active dot when the current pane belongs to that group, and only reveal their items when clicked; saved chat sessions are also behind a closed `chats` disclosure by default.
- Pushed the closed-groups follow-up to `main`; Vercel deployment `dpl_A3HW3Rx76DZbJXm4uyUBKT6ajk4G` reached Ready and is aliased to `https://www.you.md` / `https://you.md`.
- Replaced the sidebar `you.md` text mark with a scaled PixelYOU canvas mark so the shell uses the same identity mark as the homepage.
- Changed the sidebar collapse affordance to true left-panel open/close icons and removed the right-pane toggle from the left sidebar header.
- Reduced the skinny collapsed rail to exactly 8 clickable controls total: expand, new chat, search, Repo, API/MCP, YouStack, Connectors, and account.
- Added a desktop top shell chrome row with the right-pane toggle plus GitHub, update, publish, and deploy controls; publish calls the real `/publish` command, update opens source refresh context, and deploy opens the GitHub/repo surface.
- Verified locally with in-app browser DOM/screenshot QA: collapsed sidebar width 56px, 4 collapsed nav icons, 8 total clickable rail controls, top controls present, and protected chat width around 679px at a 1600px viewport.
- Verified with `npm run lint` (existing warnings only, radius guard passed) and `npm run build`.
- Pushed to `main`; Vercel deployment `dpl_Ba6tggxyGQ4k62gntwu5zbGJSoEo` reached Ready and is aliased to `https://www.you.md` / `https://you.md`. Unauthenticated production `/shell` correctly redirects to `/sign-in?next=/shell`; authenticated visual approval remains Houston-side.

## 2026-06-15 — Personal API gateway and saved shell sessions

### feat(web): reframe connectors around personal API/MCP/youstack
- Reworked the Connectors pane into a personal API gateway surface with public/auth/token/share access levels, `ystack` vs user-owned `youstack` naming, custom `{name}stack` language, and extension rows for endpoints, functions, tools, objects, and properties.
- Updated the YouStacks pane so the default personal stack is `youstack`, the built-in platform base is `ystack`, and custom stacks can be named for domains/projects.
- Reordered the shell sidebar IA around Projects, Personal API, Skillstacks, Connect, and Identity so the navigation reads by user value instead of implementation category.
- Added recent saved chat sessions to the shell sidebar and wired owner-gated Convex session hydration; New Chat now starts a fresh persisted session id instead of only adding a display note.
- Added `project-context/PERSONAL_API_MCP_STACK_SURFACE_2026-06-15.md` covering the extensible personal API/MCP/stack architecture and Convex-as-internal-realtime-gateway model, including BadApp/Myo prior-art lessons.
- Verified locally with Convex codegen, TypeScript, targeted ESLint (existing hook dependency warnings only), radius guard, `git diff --check`, production build, and in-app browser QA at 2048x1400 for sidebar chat-session rendering, reordered IA, Connectors gateway content, and no horizontal overflow.
- Deployed Convex functions to `https://kindly-cassowary-600.convex.cloud`; pushed to `main`; Vercel deployment `dpl_751zUxnaeqsb2aJn1FdSkWd2yoG6` reached Ready and is aliased to `https://www.you.md` / `https://you.md`. Authenticated production browser QA confirmed saved chat rows load, Connectors renders the gateway/ystack/youstack/extension-source graph surface, there is no horizontal overflow, and clicking saved chat `e415e271` hydrates the prior conversation without getting stuck on `opening...`.

## 2026-06-15 — Shell polish pass

### feat(web): refine `/shell` ratios, sidebar chrome, and account controls
- Removed the logged-in global top nav from the shell/dashboard workspace so the app uses the full viewport height.
- Protected the chat column with a wider default split, pixel minimums, and resize clamping so it cannot collapse into an unusable sliver on desktop.
- Migrated previously saved narrow split widths up to the new default so existing logged-in users do not keep loading the old cramped ratio.
- Auto-compacted the left sidebar below the wide-desktop breakpoint when the detail split needs room.
- Reworked the sidebar from bulky bordered rows into quieter icon/label actions with hover/title detail context and a slimmer active signal.
- Moved the portrait/username/account affordance into the sidebar footer and added a popout for usage, settings, sign out, and persisted `light`/`dark`/`system` theme preference.
- Flattened the chat composer and pane tabs to reduce nested-border/boxes-inside-boxes visual noise while preserving the terminal-native shell feel.
- Verified locally with TypeScript, targeted ESLint, radius guard, whitespace check, and production build. Pushed to `main`; Vercel deployment `dpl_HzLoG5YvgiQ2Li7kFS1VmPNHnkJR` reached Ready and is aliased to `https://www.you.md` / `https://you.md`. Authenticated production browser QA confirmed full-height shell, no logged-in top nav, 244px sidebar, 794px chat column at 2048px viewport after stored-width migration, account popout controls, and no duplicate shell/body overflow.

## 2026-06-15 — Full-height shell workspace

### feat(web): rebuild `/shell` as a Codex/Lovable-style workspace
- Removed the old desktop terminal-window chrome, red/yellow/green header strip, centered max-width wrapper, outer padding, and framed border from the authenticated shell surface.
- Added a persistent far-left shell sidebar with New Chat/Search, workspace navigation, synced GitHub repo/project status, Skillstacks, Automation, and Access groups.
- Made the desktop chat/detail split resizable with a persisted width and a desktop-only drag handle.
- Improved the bottom chat composer into a single terminal command surface with a cleaner send affordance and metadata strip.
- Added an editor subtab entry path so sidebar Crawlers/Crons navigation can open the sources pane directly.
- Verified locally with TypeScript, targeted ESLint, radius guard, whitespace check, and in-app browser QA at desktop and mobile widths.
- Pushed to `main`; Vercel deployment `dpl_4nb5fiWgDSHwV6gdRvVzFhYkAnP5` reached Ready and is aliased to `https://www.you.md` / `https://you.md`. Unauthenticated production `/shell` correctly redirects to `/sign-in?next=/shell`; authenticated production visual approval remains Houston-side.

## 2026-06-15 — Connected-app grants and connector MVP

### feat: enrich monitored change summaries
- `sourceChangeSummaries` now stores deterministic content length, safe text preview, and extracted heading hints in addition to hashes/status.
- Website, Firecrawl, Apify, and LinkedIn fetch paths pass the fetched text context into `recordRawSourceVersion` when recording immutable source changes.
- The Sources pane now surfaces the latest monitored-change preview below the change summary.
- Focused tests assert preview/heading/length behavior so monitored summaries do not regress to hash-only records.

### feat: add monitored source-change summaries
- Added `sourceChangeSummaries`, an owner/source-scoped ledger for deterministic change summaries tied to immutable raw source versions.
- `recordRawSourceVersion` now writes a first-fetch/content-changed summary and stores `metadata.lastChangeSummary` on the source row.
- Sources can opt into approval-gated monitoring via metadata; pending-review changes are skipped by the extraction stage until approved.
- Added owner APIs and Sources-pane UI to list source-change summaries and approve pending changes inline.
- Focused tests now cover auto-accepted summaries, pending-review summaries, owner list/approve flow, and unchanged-content no-op behavior.

### feat: add source run-policy approval gate
- Added `sourceRunPolicy.reserveSourceRun`, an internal provider gate that estimates source-run cost, requires owner approval for expensive providers, enforces per-user/provider hourly reservations, and records the last run decision in source metadata.
- Added `approveSourceRun` so owners can approve a source's expensive crawler provider for a bounded window from the Sources pane.
- Pipeline fetch dispatch now reserves a source run before native, Firecrawl, Apify, or agent-browser provider execution; blocked runs fail closed with source failure metadata instead of spending silently.
- `recordRawSourceVersion` now sets `lastChangedAt` only when the content hash changes; failed source status updates increment `failureCount`.
- Added `project-context/AGENT_BROWSER_SANDBOX_RUNNER_SPEC_2026-06-15.md` defining the sandbox job contract, forbidden runtime patterns, transcript/output contract, and skill-learning hook for future browser-worker execution.

### feat: enforce connected-app grants and run source providers
- Wired `yg_` connected-app grants into HTTP/MCP bearer auth alongside `ym_` API keys. Grants now resolve to the owning user, update `lastUsedAt`, enforce mapped resource/action scopes, deny writes unless `writePolicy` is `approved_write`, and log scope denials/writes as `agentSource: connected-app` with the grant id.
- Added owner source actions: refresh now, pause cron refresh, update crawler/refresh/visibility/trust policy, and read raw-source version history.
- Expanded the Sources pane with inline refresh/pause/details controls, policy chips, next-refresh/failure/hash metadata, and recent source-version provenance.
- Added a Firecrawl provider path to the existing ingestion pipeline (`FIRECRAWL_API_KEY`, `/v1/scrape`, markdown/html normalization, immutable raw-source versions). The agent-browser provider now fails closed with a sandbox-required error until a safe runner is implemented.
- Added `convex/sourceActions.test.ts` and extended grant tests; focused backend tests, Convex codegen/typecheck, TypeScript, lint, docs check, and agent-doc handoff passed locally.

### feat: You.md-native grants, connector metadata, and refresh marker
- Added `connectedAppGrants` with hashed `yg_` tokens, resource scopes, action scopes, write policy, trust level, expiry, revocation, owner CRUD/list/page/resolve helpers, and focused tests.
- Extended `sources` with connector kind, crawler provider intent, refresh policy, visibility, trust level, next refresh, failure count, display name, and metadata. `addSource` now dedupes by exact URL instead of clobbering all sources with the same broad type.
- Upgraded the Sources pane into the first Lovable-simple connector MVP: Website/GitHub/RSS/OKF/Webhook/JSON, provider intent (`native`, `firecrawl`, `agent-browser`, `manual`), refresh cadence, visibility, trust, and labels.
- Added a cheap hourly source-refresh marker cron that marks due personal sources pending without automatically running Firecrawl, browser automation, Apify, or LLM extraction.
- Added `project-context/CONNECTED_APPS_CONNECTORS_MVP_2026-06-15.md` documenting the You.md-only MVP, Firecrawl/agent-browser runner boundaries, and next implementation slices.

## 2026-06-15 — h.computer ideas routed into native You.md

### docs(product): You.md owns the personal API/MCP + YouStacks primitive
- Added `project-context/PERSONAL_API_MCP_AND_YOUSTACKS_MEMO_2026-06-15.md` after reviewing the creator-new routing memo, local h.computer protocol/vision docs, active You.md project context, and live h.computer platform/docs/gallery pages.
- Updated PRD and Architecture to clarify that You.md is the durable brain plus portable expertise-stack layer, while h.computer remains Houston's personal site/agent/reference implementation and Creator.new can optionally attach creator identity/context.
- Added planned feature inventory and roadmap items for personal API/MCP resources, connected-app grants, Lovable-simple connector UX, crawlers/crons/source refresh, monitored updates, skill learning from transcripts/SOPs/agent logs, host adapters, public/private identity modes, and stack-level model routing.
- Added active request #115 so these implementation slices remain tracked until they are built and verified.

## 2026-06-15 — Lossless push, late github greeting, per-project activity log

### fix(cli): compile preserves `_profile` and unmodeled fields (lossless push)
- The markdown→bundle compile only mapped modeled fields, silently dropping server-managed top-level keys like `_profile` (~250KB). That made `youmd push` lossy and tripped the >50% size guard, blocking legitimate pushes. The compiler now carries every unmodeled skeleton key forward — verified against Houston's real `~/.youmd` bundle: compiled output is byte-for-byte the same size as `base.json` (265,211 bytes), `_profile` intact. The local→web push is now safe (no force-push needed).

### fix(web): github-connected greeting fires when repo resolves late (SG3)
- The init effect ran once on session restore, but the GitHub connection query resolves async afterward — so `githubRepoName` was null at fire time and the greeting fell through to the generic one. Added a ref-guarded single re-run that flushes the prior greeting and sends the github-connected protocol once `githubRepoName` arrives. Deployed to prod (HEAD 44ce332).

### feat(cli): `youmd project log` — per-project agent activity log (#4)
- `youmd project log <message>` appends a timestamped, agent-named entry to `project-context/you.md/log.md` (created with a `CONVENTION.md` on first use); `youmd project log` with no args prints the last 15 entries. Travels with the project's own git repo so any agent in the repo sees recent work. Agent name from `YOUMD_AGENT_NAME`. CLI bumped to 0.8.0 — **needs `npm publish` (Houston's OTP)**.

## 2026-06-14 — Immutable-source enforcement in the ingestion pipeline (#2)

### Anti-drift: content-addressed, versioned sources + real provenance
- Added `convex/lib/sourceHashing.ts` (pure): `computeRawSourceHash` (SHA-256 content-addressing), `isContentChanged`/`shouldRecordVersion` (re-fetch versions on change only), `buildProvenanceMap`/`buildSourcesUsed` (per-source provenance), and `assertNoInPlaceOverwrite` (the guard).
- Added an append-only `rawSourceVersions` table + `recordRawSourceVersion` internal mutation: a new version is written only when fetched content is new or changed; the source pointer advances but prior version rows are never modified or deleted. Wired into all three fetch paths (website, Apify, LinkedIn) best-effort/additive — LinkedIn hashes substantive content only so the volatile fetchedAt doesn't cause spurious versions.
- Fixed source provenance in compiled bundles: `meta.sources_used` (previously hardcoded `[]`) and the manifest `sources[].url` (previously `""`) now carry the real source URLs + content hashes; added `meta.linked_sources` (URL list) so compiled concepts trace to their origin and OKF export carries true `linked_sources`.
- Verified: full Convex suite green (34 files / 389 tests) including 11 new tests (pure hashing helpers + the immutable version ledger). **Needs `npx convex codegen` + Convex deploy** (new table/mutation) in an environment with a deployment configured — `_generated` and the live pipeline behavior are owner/CI verification steps.

## 2026-06-14 — OKF concept graph + brain view

### Concept graph cross-linking (#1)
- Added `related` as a first-class OKF graph-edge field (stable ordering after `linked_sources`, round-trip-preserved through export/import).
- `deriveRelated()` builds edges from real structural relationships only (no fabricated semantic links): every concept anchors to `profile/about`, platform voices link to the overall voice, skills link to the agent directives they run under, and agent preferences link to those directives. Author-declared `related` edges are preserved and unioned with derived ones.
- Stack concepts link to their manifest concept (`youstack`) hub.
- `youmd okf health` now counts `related` frontmatter as graph edges, so orphan detection respects the real graph.

### Brain view — desktop-client seed + web consistency (#3)
- Added `cli/src/lib/okf-view.ts`: a framework-agnostic view model (`buildBrainView`) over an OKF bundle (concepts grouped by type, graph edges, health) plus a dependency-free HTML renderer (`renderBrainHtml`) — terminal-native (monochrome + burnt orange, JetBrains Mono, 2px radius, no emoji, no JS/network).
- Added `youmd okf view [dir]`: renders a self-contained local "brain page" (the Obsidian-style desktop-client seed) from a directory or the live bundle; `--out <file>` and `--json` (emits the view model the web app can render for a consistent surface).
- +9 tests (53 OKF tests total); CLI build clean; verified end-to-end (graph edges present in export; `okf view` renders a 90/100 brain page from the example bundle).

## 2026-06-13 — OKF brain-health audit

### `youmd okf health` (Familiar graph-health pattern, OKF-native)
- Added `cli/src/lib/okf-health.ts`: a pure audit of an OKF bundle for the failure modes that rot agent knowledge bases — concepts missing `type` (error), thin/no-description concepts, un-sourced concepts ("no synthesis without a source"), agent-authored or low-confidence concepts that need a human pass, stale concepts (timestamp age or `[STALE]` markers), unresolved `[CONFLICT]` markers, and orphans nothing links to. Produces a 0-100 health score.
- Added the `youmd okf health [dir]` subcommand (alias `doctor`): audits a directory on disk, or the live identity bundle built in memory when no dir is given; `--stale-days <n>` (default 30) and `--json`.
- Bundles three of the four flagged Familiar follow-ups (graph/orphan check, `[CONFLICT]`/`[STALE]` markers, the un-sourced rule) into one self-auditing command — deliberately without the cron/inbox machinery.
- +7 tests (44 OKF tests total); CLI build clean. Smoke: live example bundle scores 90/100 with honest advisory flags; a malformed bundle surfaces the error plus conflict/stale/orphan/un-sourced.

## 2026-06-13 — OKF (Open Knowledge Format) integration

### Portable OKF export/import for identity, skills, and stacks
- Added a pure OKF core library (`cli/src/lib/okf.ts`): serialize/parse concept files (YAML frontmatter + body, required `type`), conformance validation, and `index.md`/`log.md` reserved-file builders for `okf/v0.1`.
- Added identity bundle ↔ OKF (`cli/src/lib/okf-bundle.ts`): lossless, round-trippable export of `profile/`, `preferences/`, `voice/`, `directives/`, and installed `skills/` as conformant OKF concepts, each tagged with a `youmd_kind` field so import routes it home; carries `you.json` + `manifest.sha256.json` alongside as integrity value-adds.
- Added YouStack → OKF (`cli/src/lib/okf-stack.ts`): renders a stack (manifest summary concept + skills/workflows/docs/tests/prompts) as a conformant OKF bundle, carrying `youstack.json` alongside so it stays installable — the shareable "Gstack" story.
- Added the `youmd okf export | import | validate` command plus a `youmd export --okf` shortcut, all with `--json` output; `--stack [path]`, `--out <dir>`, and `--no-skills` flags.
- OKF is a portable interchange/exchange format that rides the existing `youmd sync`/`pull`/`push` engine (3-way merge in `merge.ts`); no sync behavior changed.
- Added `project-context/OKF_INTEGRATION.md` with the design rationale and a cross-machine (MacBook Air + Mac mini) end-to-end test runbook.

### Provenance frontmatter (Familiar-second-brain convention)
- Added optional `last_updated_by` / `confidence` / `linked_sources` provenance fields to OKF concepts (first-class in `okf.ts`, stable frontmatter ordering, light validation — bad `confidence` warns, never errors), so agents can audit who wrote a concept, how sure they were, and what it derives from.
- Export stamps `last_updated_by` from `--author` (defaults to the logged-in username); installed skills are stamped `agent`; the `about` concept is auto-linked to the real `you.json` `meta.sources_used` (never fabricated). `--confidence` stamps `confidence` only when given.
- Provenance is preserved through export → import → re-export round-trips, and existing per-section provenance is never overwritten. Added `--author`/`--confidence` flags to `youmd okf export`. +7 tests (37 OKF tests total).

### Verification
- `npm --prefix cli run build` passes. New OKF suite green (30 tests) across serialize/parse round-trips, the `type` requirement, validation rules, reserved-file formats, an identity round-trip against the real `examples/houston` bundle, and a stack export against `examples/youstack-personal`. Full CLI suite green except pre-existing live-network `integration.test.ts` cases that require reaching production from the sandbox.
- CLI smoke verified end-to-end: identity export → conformant; import round-trip rebuilds section files; stack export → conformant; `okf validate` passes on the written bundles.

## 2026-06-13 — Remote main sync continuation and verification fixes

### Sync + audit
- Fast-forwarded local `main` to `origin/main` commit `376f967` and reapplied local artifacts cleanly; no merge conflicts required manual resolution.
- Audited the newly landed public stack registry/install path, hosted MCP registry + subscribe handling, outbound webhooks, generated agent docs, and backlog/reference-intelligence updates.
- Refreshed reference-intelligence artifacts to the 2026-06-12 upstream state and regenerated `/llms.txt` + `/llms-full.txt`.

### Fixes from verification
- Renamed the Convex-side capability router twin from `convex/lib/capability-router.ts` to `convex/lib/capabilityRouter.ts` because Convex deployment rejects hyphenated module path components.
- Stopped CLI decompile from treating `username` as `identity.name`, fixing the empty-bundle round-trip test and keeping handle metadata distinct from display-name identity.
- Replaced a `/docs` arbitrary `rounded-[2px]` class with `rounded-sm` so the radius guardrail passes.

### Verification
- Passed `npm run lint` (0 errors, existing warnings), `npm run test:convex` (28 files / 355 tests), `npm --prefix cli test` (42 files / 472 tests), `npm --prefix cli run build`, root TypeScript, Convex TypeScript, Convex codegen/typecheck, `npm run agent-docs:ci`, `npm run docs:check`, production `npm run build`, and `git diff --check`.

## 2026-06-09 — Public profile indexing pipeline foundation

### Crawler/indexer backend
- Added Convex source-ledger tables for public profile sources, refresh jobs, and import-batch audit records.
- Added a 50-target initial catalog for top tech, AI, SaaS founders/builders/investors with source URLs, segments, priorities, and source-backed starter profile payloads.
- Added internal import and refresh actions that upsert unclaimed public profiles, queue source/portrait jobs, fetch cheap native HTML metadata, hash source content, track freshness, and avoid paid crawling by default.
- Added a daily Convex cron to refresh due public profile sources in bounded batches.
- Added admin-only HTTP controls for dry-running/importing the target batch and refreshing due sources via `Authorization: Bearer <TRUSTED_INTERNAL_AUTH_TOKEN>`.
- Added same-origin Next proxies for those admin controls so the documented `you.md/api/admin/profiles/*` routes reach Convex on production.

### Guardrails
- Added `npm run profiles:targets-check` to enforce exactly 50 unique seed targets, valid username slugs, names, and HTTPS source links before scaling batches.
- Regenerated Convex API bindings and repaired surfaced type holes in existing Convex HTTP/pipeline code.

### Verification
- Passed `profiles:targets-check`, Convex codegen, Convex TypeScript, root TypeScript, targeted ESLint for the new crawler files, and `git diff --check`.
- Full-file ESLint on `convex/http.ts` still reports pre-existing `no-explicit-any` debt unrelated to this slice; the touched http changes are covered by TypeScript.
- Production import is intentionally pending until this commit is deployed; next step is an admin dry-run of 50 targets, then a real import if the dry-run is clean.

## 2026-06-09 — Public profile portrait hardening

### Profiles directory + public pages
- Defaulted `/profiles` to grid view and reused the SSR profile payload while Convex client queries hydrate, so the directory does not briefly collapse into a sparse/blank state.
- Added a shared `ProfilePortrait` renderer and frontend/Convex `hasRenderableAsciiPortrait` validation so stored ASCII is only treated as present when it has nonblank lines.
- Hardened `AsciiAvatar` loading/error fallbacks so missing or CORS-blocked generated ASCII never renders as an empty square; cards now fall back to a real image tile or visible terminal initials.
- Downsampled stored 120-column ASCII portraits to the requested tile size before rendering, so directory cards show the full portrait instead of an empty-looking top-left crop.
- Swapped individual public profile header portraits from raw image tags to the same shared portrait contract.

### Guardrails + crawler strategy
- Added `profiles:portrait-contract`, `profiles:portrait-audit`, and `profiles:portrait-audit:pages` so code structure, public profile payloads, and individual profile pages can be checked before deploy.
- Added a same-origin `GET /api/v1/profiles` web proxy for the public profile API and preserved content type, ETag, pagination/link, cache, and CORS headers from Convex.
- Added a monthly Convex cron for unclaimed public profile portrait QA using the existing enrichment/backfill action.
- Wrote `PUBLIC_PROFILE_INDEXING_AND_REFRESH_PLAN.md` to define the low-cost crawling/enrichment direction around Scrapy/Crawl4AI/Trafilatura, JS-heavy Playwright/Crawlee fallback, source ledgers, cheap LLM enrichment, cron refresh, SEO, and claim-profile conversion.

### Verification
- Passed `profiles:portrait-contract`, `profiles:portrait-audit`, and `profiles:portrait-audit:pages` locally.
- Passed `next typegen`, root TypeScript, Convex TypeScript, targeted ESLint on changed files, and `git diff --check`.
- Local HTTP smoke passed for `/profiles`, `/karpathy`, and `/api/v1/profiles?username=karpathy`; headless Chrome visual QA confirmed `/profiles` grid has no blank portrait boxes and `/karpathy` no longer shows a broken small portrait tile.

## 2026-06-09 — Daily reference-intelligence follow-through

### Reference intelligence
- Ran `npm run codex:chat-hygiene -- --apply --older-than-minutes 120` before the daily monitor and archived 2 stale active automation threads while preserving transcripts and backup indices.
- Re-ran `npm run references:sync` and regenerated `project-context/reference-intelligence/LATEST.md` plus `TASKS.md`.
- Updated the tracked upstream heads to GStack `1626d48`, GBrain `1eb430a`, Agent Scripts `3bd6b21`, and The Library `47f455c`.
- Captured the Jun 9 follow-through in `project-context/REFERENCE_INTELLIGENCE_AUDIT_2026-06-09.md`, narrowing the new work to two explicit You.md slices: YouStacks review/report packaging and fail-closed protected retrieval plus malformed-frontmatter resilience.

### Tracking
- Updated `project-context/TODO.md`, `FEATURES.md`, `feature-requests-active.md`, and `PROMPTS.md` so the Jun 9 reference-intelligence work is durable and future sessions can continue from tracked next steps instead of re-deriving them from generated files.

## 2026-06-04 — GitHub repo follow-ups: token caching, App revocation, private-file safety

### GitHub App hardening
- Installation-token **caching**: `mintInstallationToken` now returns the GitHub-provided expiry; `loadConnectionToken` caches the token (AES-GCM encrypted) on the connection (`installationTokenEnc`/`Iv`/`Exp`) and reuses it until ~1 min before expiry instead of minting one per repo op. New `internalCacheInstallationToken`.
- Installation **revocation**: the GitHub webhook now handles `installation` events — `deleted`/`suspend` clears the user's `installationId` + cached token (so repo ops fall back to OAuth). New `by_installationId` index + `internalClearInstallationById`.

### Private-file safety
- `private/**` is now explicitly excluded from the server-side mirror (defensive early-return + comment). Private files belong in the zero-knowledge vault (client-side encrypted), not the plaintext mirror — so `private/*` ↔ vault sync stays a deliberate client-side follow-up, not a server action that would store plaintext.

### Validation
- `tsc` (web + convex) 0 errors; ESLint clean; `docs:check` passes (regenerated — the Phase 5 setup route is now in the reference, 74 endpoints).

## 2026-06-04 — GitHub App foundation (Phase 5, additive)

### GitHub App (fine-grained tokens — optional, untested e2e)
- New `convex/githubApp.ts`: signs an RS256 app JWT (Web Crypto, PKCS#8) and mints short-lived installation access tokens. `isGithubAppConfigured()` gates the whole path.
- `convex/githubRepo.ts` `loadConnectionToken` now prefers a GitHub App installation token when the App is configured AND the user has an `installationId`; otherwise it falls back to the OAuth token (the verified default). OAuth scope check only applies to the fallback.
- `convex/github.ts`: `setInstallation` mutation + `installationId` on the connection context/schema; `getConnection` returns `appInstalled`.
- New web route `GET /api/auth/github/app/setup` — the App's post-install Setup URL; authenticates the session and records the installation id.
- `GithubRepoSection` shows GitHub App status + an install link when `NEXT_PUBLIC_GITHUB_APP_SLUG` is configured.
- Documented registration + PKCS#8 conversion + env in `GITHUB_OAUTH_SETUP.md`.

### Honest status
- Compiles clean and is fully additive — but **untested end-to-end** (needs a real registered App). The OAuth `repo`-scope path remains the verified default. Follow-ups: installation-token caching, `installation` webhook handling for revocation.

## 2026-06-04 — MCP + public profile read repo-hosted stacks (Phase 3/4 follow-up)

### MCP
- Two new authenticated `/api/v1/mcp` tools: `get_my_stacks` (lists the YouStacks the user hosts in their repo, from the mirror) and `get_repo_file` (reads one mirrored file, e.g. `you.md` or `stacks/<slug>/manifest.json`). The public `get_identity` tool now also includes `repo_stacks` when the user's repo is public.

### Public profile
- New public `convex/github.ts` query `getPublicRepoStacks(username)` — returns repo-hosted stacks ONLY when the linked repo is public (never leaks private-repo stack names).
- The `/api/v1/profiles` response now carries `_profile.repoStacks`, and the public profile page renders a "stacks in their repo" section linking each stack folder on GitHub.

### Validation
- `tsc` (web + convex) 0 errors; ESLint clean on changed files (only pre-existing warnings remain). `docs:check` passes (24 MCP tools / 73 endpoints unchanged in the generated reference — the web MCP tools live in the http route).

## 2026-06-04 — Remote main sync audit + local follow-through

### Sync / audit
- Fast-forwarded local `main` from `22b09ea` to `cf56f07` and preserved local reference-intelligence artifacts across the pull.
- Audited the merged GitHub-native wave: free GitHub OAuth signup, GitHub repo create/connect, repo push/pull sync, webhook auto-pull, server-side repo mirror, authenticated repo file/stack APIs, setup docs, OpenAPI/docs updates, and project-context tracking.

### Fixes
- Regenerated stale `public/llms.txt` and `public/llms-full.txt` after the June 4 reference-intelligence refresh.
- Regenerated Convex API bindings so `convex/_generated/api.d.ts` includes `convex/lib/secretCrypto.ts`.
- Fixed GitHub OAuth local-dev fallback/docs/env to use the repo's actual frontend port `3100` instead of stale `3000`.
- Upgraded Next.js from `16.2.2` to `16.2.7` and updated root agent-manual stack markers.

### Validation / blockers
- Passed `npm run agent-docs:ci`, targeted GitHub integration ESLint, `NEXT_TELEMETRY_DISABLED=1 npx next typegen && npx tsc --noEmit`, `npx convex codegen --typecheck enable`, `npm --prefix cli run build`, `npm --prefix cli test` (12 files / 69 tests), `git diff --check`, and local GitHub OAuth unconfigured-route smoke.
- `next build` still hangs silently on this machine before route output with both default and `--webpack`; this remains a local production-build blocker to investigate before deploy confidence.
- Owner/operator setup is still required: GitHub OAuth App credentials, production env/secrets, Convex deploy, Vercel deploy, and live end-to-end OAuth/repo verification.

## 2026-06-04 — Server-side repo mirror + stacks (Phase 4, first slice)

### Mirror (clone/host on our servers for API/MCP)
- New `repoMirror` Convex table: a snapshot of the user's repo tree (identity files + `stacks/**` + top-level markdown), one row per user, refreshed on pull/webhook/create-connect. Bounded by caps (≤100 files, ≤128KB/file, ≤700KB total; `truncated` flag).
- New `convex/githubRepo.ts` mirror layer: `performMirror` (reads the head commit → recursive git tree → fetches allowlisted blobs within caps), public `syncMirror` action, and `internalMirrorForConnection` (webhook/post-create). Mirror refresh is scheduled after create/connect and on every webhook push.
- New `convex/github.ts`: `internalUpsertMirror`, `internalGetMirrorByClerkId`, owner-only `getRepoMirror` (paths+sizes, no content, + derived stacks), and `deriveStacks` (groups `stacks/<slug>/...` into named stacks with file counts + manifest detection).
- New authenticated HTTP reads so agents consume the repo from our servers (not GitHub) — `GET /api/v1/me/repo/files` (list, or `?path=` for one file's content) and `GET /api/v1/me/repo/stacks` (derived stacks). Docs reference regenerated (73 endpoints).
- `GithubRepoSection` shows a "server mirror" status (file count, stack slugs, capped flag) with a "refresh mirror" button.

### Notes / next
- This directly serves "use stacks on their own repos": `stacks/**` is captured into the mirror and exposed via the stacks API. Next: wire the MCP server + public profile to read stacks from the mirror, and serve private files only through authenticated/token surfaces.

### Validation
- `npx tsc --noEmit` (web) and `convex/tsconfig.json`: 0 errors. ESLint clean on new files (no new issues in `http.ts`). `docs:check` passes.

## 2026-06-04 — Repo Sync Engine: push / pull (Phase 3, first slice)

### GitHub repo sync
- New `convex/githubRepo.ts` actions:
  - `pushToRepo` — writes the user's current compiled `you.md` + `you.json` to their linked repo (reads each file's current sha and updates it; skips byte-identical files to avoid empty commits), then records the commit sha as `lastSyncedSha`.
  - `pullFromRepo` — reads `you.md` + `you.json` from the repo (repo is source of truth on pull), parses the JSON, and saves them as a new bundle version, syncing the public profile and marking synced.
- New `convex/github.ts` internal mutations: `internalMarkSynced` (record a push) and `internalSaveBundleFromRepo` (write a bundle from repo content + sync profile + mark synced, reusing `computeContentHash`). `internalGetConnectionContext` now also returns the repo default branch.
- Added GitHub Contents API helpers (`getRepoFile` returns null on 404; `putRepoFile` create-or-update with sha) and UTF-8-safe base64 decode.
- `GithubRepoSection` now shows **push to repo** / **pull from repo** controls and a "last synced" timestamp in the linked-repo view, with success/error feedback.

### Notes / next
- Conflict policy in this slice is last-writer-wins (push updates by sha; pull overwrites the bundle). The existing `saveBundleFromForm` ANCESTOR_MISMATCH guard remains for the form path. A 3-way merge + webhook-driven auto-pull are Phase 3 follow-ups.

### Validation
- `npx tsc --noEmit` (web) and `convex/tsconfig.json`: 0 errors. ESLint clean. Not deployed — needs Convex deploy + the OAuth App with `repo` scope.

## 2026-06-04 — Connect / Create Your You.md Repo (Phase 2)

### GitHub repo (own repo as source of truth — first slice)
- New `convex/githubRepo.ts` Convex **actions** (so the decrypted OAuth token never leaves the Convex trust boundary; called from the browser with `requireOwner` auth):
  - `createRepo` — creates a `you-md` repo (public or private per the user's choice), then seeds it with `README.md`, `you.md` (the user's latest compiled bundle, or a starter), `you.json`, and a `stacks/.gitkeep`, and links it to the account.
  - `connectRepo` — verifies write access to an existing repo the user owns and links it as their You.md repo (visibility read from GitHub).
  - `listRepos` — lists the user's push-access repos for the connect picker.
- New internal helpers in `convex/github.ts`: `internalGetConnectionContext` (resolve connection + encrypted token by clerkId), `internalGetSeedContent` (latest bundle/profile content to seed with), `internalSetRepo` (persist the linked repo + audit). Repo-scope is enforced before create/connect; missing `repo` scope returns a clear "reconnect and approve repository access" error.
- New `src/components/panes/GithubRepoSection.tsx`, wired into the Settings pane: terminal-native, **no text-input forms** — visibility is a `private`/`public` toggle, existing repos are a pickable list. Shows linked-repo status (repo link, visibility, branch, GitHub handle) with a "change repo" path, and a "connect github" prompt for email-only accounts.

### Validation
- `npx tsc --noEmit` (web) and `npx tsc -p convex/tsconfig.json --noEmit`: 0 errors. Targeted ESLint clean.
- Not deployed — same branch. Needs Convex deploy (new actions) + the GitHub OAuth App configured with `repo` scope.

## 2026-06-04 — Free GitHub OAuth Signup (Phase 1)

### Auth
- New `githubConnections` Convex table: GitHub identity (numeric id + login + name + email + avatar), AES-GCM-encrypted OAuth access token + scopes, and linked You.md repo metadata (`repoFullName`, `repoVisibility`, default branch, sync bookkeeping). Indexed by user, GitHub id, and repo.
- New `convex/github.ts`: `findOrCreateGithubUser` (resolve by GitHub id → verified email → create new user+profile; gated on `TRUSTED_INTERNAL_AUTH_TOKEN` since there's no per-request challenge), `getConnection` (owner-only, no token plaintext), and `linkRepo` (owner-only repo linking, public/private).
- New `convex/lib/secretCrypto.ts`: shared AES-GCM `encryptSecret`/`decryptSecret` using `API_KEY_ENCRYPTION_SECRET` (falls back to the internal token) so OAuth tokens are recoverable for repo ops but encrypted at rest.
- New web routes `/api/auth/github/start` (CSRF `state` cookie + GitHub authorize redirect) and `/api/auth/github/callback` (state check → token exchange → identity fetch incl. verified primary email → resolve/create account → mint the existing opaque session cookie → redirect new users to `/initialize`, returning users to their destination). Reuses the existing session/JWKS plumbing — no change to email-code auth.
- New `src/lib/github-oauth.ts` (config, authorize URL, token exchange, identity fetch) and `src/components/terminal/GithubAuthButton.tsx` (terminal-native button + error copy). Wired into both `/sign-in` and `/sign-up`; the button degrades gracefully to a `?error=github_unconfigured` redirect until the OAuth App is configured.

### Docs / Planning
- `project-context/GITHUB_OAUTH_SETUP.md`: operator runbook for registering the GitHub OAuth App + env vars (`GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, optional `GITHUB_OAUTH_SCOPES`) and verifying end-to-end.
- `project-context/GITHUB_NATIVE_PLAN.md`: the full "repo as source of truth" vision broken into Phases 1–5 (signup → connect/create repo → sync engine → server-side clone/mirror for API/MCP → GitHub App hardening), with chosen defaults flagged for confirmation.

### Validation
- `npx tsc --noEmit` (web) and `npx tsc -p convex/tsconfig.json --noEmit`: 0 errors. Targeted ESLint on all new/changed files: clean.
- Not deployed — branch `claude/github-oauth-free-signup` only, no PR. Needs the OAuth App + Convex/Vercel deploy from `main` to go live.

## 2026-06-03 — Reference Follow-Up Audit

### Strategy / Tracking
- Re-ran `npm run references:sync` and versioned the refreshed `project-context/reference-intelligence/LATEST.md` and `TASKS.md` artifacts after the new GStack/GBrain upstream wave
- Added `project-context/REFERENCE_INTELLIGENCE_AUDIT_2026-06-03.md` to collapse the raw 13-task queue into an explicit You.md implementation order across stack safety/private distribution, brain sync resilience, retrieval/readiness honesty, and runtime health/self-upgrade boundaries
- Updated active request tracking, roadmap TODOs, and feature inventory so future sessions can continue shipping the follow-up slices without re-deriving the same priorities from generated files
- Followed through with a repo-visible docs/contract pass across README, `/docs#youstacks`, generated root agent docs, and the local/live handoff guardrails so the highest-risk Jun 3 rules are explicit before deeper implementation work

### Reference Signal
- The new upstream wave is concentrated in GStack safety/privacy hardening (`c43c850`) plus GBrain reliability and retrieval work: resumable sync, watchdogs, background-work drain, AI timeouts, retrieval fallbacks, readiness states, self-upgrade, held-out gates, and Postgres singleton ownership fixes
- Agent Scripts and The Library had no new upstream commits in this sync window, so the immediate work shifts from monitoring breadth to implementing the highest-value GStack/GBrain translations

### Docs / Agent Contract
- README and `/docs#youstacks` now state four explicit follow-up rules from the audit: shell-facing helpers must be sanitized at use time, repo/branch/runtime metadata stays local by default, protected reads should report honest readiness states, and richer retrieval should degrade toward fallback before silence
- Regenerated `public/llms.txt` and `public/llms-full.txt` so root agent docs carry the same stack safety and readiness rules
- Extended `scripts/check-agent-doc-handoff.mjs` and `scripts/smoke-agent-docs.mjs` so local and live guardrails enforce the new stack safety/readiness wording alongside the existing source-repo handoff markers

### CLI / YouStacks Runtime
- Tightened `cli/src/lib/youstack.ts` so manifest validation rejects shell-unsafe stack slugs and capability ids before they can flow into adapter paths or generated host files
- Added warnings for multi-line/control-character-heavy `domain`, `aliases`, and `tags` metadata so generated adapter/docs metadata stays readable and less error-prone across hosts
- Added focused CLI coverage for the new manifest-safety rules in `cli/src/__tests__/youstack.test.ts`
- Added explicit `YouStackReadiness` envelopes to the local runtime so stack CLI JSON output and MCP stack tools can report `not_found`, `invalid`, or `ready` instead of making agents infer state from plain error strings or empty payloads
- Threaded readiness state through `get_stack_manifest`, `get_stack_capabilities`, `route_stack_request`, and `smoke_stack`, plus local `youmd stack inspect/capabilities/route/smoke` JSON output
- Added a protected-memory retrieval envelope in `cli/src/mcp/server.ts` so `search_memories` reports `ready`, `auth_required`, or `unavailable` plus a concrete fallback path instead of only returning a bare array
- Applied the same protected-memory retrieval envelope to `youmd://memories` MCP resources and `get_agent_brief` memory inclusion so missing auth or server failures no longer look like a healthy empty memory set
- Updated the shared YouStack capability contract and generated host adapters so protected-read capabilities explicitly advertise readiness states and fallback order instead of implying hosted retrieval is always available
- Added the missing MCP `get_private_context` tool plus `youmd://private-context` resource, both using a protected-read readiness envelope so private-context auth/server failures no longer surface as missing capability coverage or ambiguous generic errors
- Added readiness envelopes for MCP project-context reads and `youmd://projects/*` resources so missing current/named project context now carries structured fallback guidance instead of plain-text project errors

### Verification
- Passed `npm run references:sync`
- Passed `npm run llms:generate`, `npm run llms:check`, `npm run agent-docs:handoff`, and `npm run agent-docs:ci`
- Passed `npm --prefix cli test -- youstack` and `npm --prefix cli run build`
- Confirmed the regenerated reference outputs now record the new upstream commit heads and 13 candidate tasks
- Confirmed the new audit maps those tasks into repo-visible next steps before implementation work begins

## 2026-06-02 — Handoff Checker JSON Output

### CI / Docs
- Added `--json` support to `scripts/check-agent-doc-handoff.mjs` so automation can read ok state, CLI version, checked files, marker counts, and failures without parsing prose
- Added `npm run agent-docs:handoff:json` as the reusable machine-readable handoff check
- Documented and enforced the JSON command across README, root agent manuals, `/docs#agent-docs`, generated `/llms-full.txt`, local handoff markers, and live smoke expectations

### Verification
- Passed `npm run agent-docs:handoff`, `npm run agent-docs:handoff:json`, JSON parse/count assertion, `npm run agent-docs:syntax`, `npm run agent-docs:lint`, `npm run llms:check`, `npm run agent-docs:ci`, JSON command marker grep, and `git diff --check`
- Confirmed JSON output reports `ok: true`, `6` checked files, `86` required markers, `17` forbidden stale markers, and no failures
- Verified GitHub Actions run `26856413207` passed `Check Generated Agent Docs`
- Verified Vercel production deployment `dpl_CcWeF8asBZULESwqvEKGjWYBRMmY`, aliased to `https://www.you.md` and `https://you.md`; live `npm run llms:smoke -- --base-url https://www.you.md` passed all checks with the source-repo guardrail smoke check reporting 9 markers

## 2026-06-02 — Modular Agent Docs CI Commands

### CI / Docs
- Split the long `npm run agent-docs:ci` script into `agent-docs:syntax`, `agent-docs:handoff`, and `agent-docs:lint`, while keeping `agent-docs:ci` as the full umbrella command
- Documented the modular commands in README, root agent manuals, `/docs#agent-docs`, and generated `/llms-full.txt`
- Extended the handoff checker and live smoke checks so the modular commands remain part of the source-repo and public docs handoff contract

### Verification
- Passed `npm run agent-docs:syntax`, `npm run agent-docs:handoff`, `npm run agent-docs:lint`, `npm run agent-docs:ci`, `npm run llms:check`, modular command marker grep, and `git diff --check`
- Confirmed the handoff checker now reports `6 files, 82 required markers, 17 forbidden stale markers`
- Verified GitHub Actions run `26856191121` passed `Check Generated Agent Docs`
- Verified Vercel production deployment `dpl_BUWknQrA2KZ4J4GkQ9NKBN9iZP2H`, aliased to `https://www.you.md` and `https://you.md`; live `npm run llms:smoke -- --base-url https://www.you.md` passed all checks with the source-repo guardrail smoke check reporting 8 markers

## 2026-06-02 — Handoff Checker Diagnostics

### CI / Docs
- Updated `scripts/check-agent-doc-handoff.mjs` success output to report checked file count, required marker count, and forbidden stale-marker count
- The agent-docs guardrail now gives future agents a compact local/CI receipt for the size of the handoff contract it just validated

### Verification
- Passed direct `node scripts/check-agent-doc-handoff.mjs`, `npm run agent-docs:ci`, and `git diff --check`
- Confirmed the checker reports `6 files, 70 required markers, 17 forbidden stale markers`
- Verified GitHub Actions run `26855935056` passed `Check Generated Agent Docs`
- Verified Vercel production deployment `dpl_9x5vntcS3kapiHZY9ZYQijCDzjpw`, aliased to `https://www.you.md` and `https://you.md`; live `npm run llms:smoke -- --base-url https://www.you.md` passed all checks

## 2026-06-02 — Docs Page Local Guardrail Parity

### CI / Docs
- Extended `scripts/check-agent-doc-handoff.mjs` so local CI verifies `/docs#agent-docs` includes the expanded PRD/architecture source scope
- The local handoff checker now also verifies the docs-page copy mentions stale stack/auth language rejection and required/forbidden handoff marker checks
- This keeps local `npm run agent-docs:ci` aligned with the stronger production smoke expectations for the public docs page

### Verification
- Passed `npm run agent-docs:ci`, direct `node scripts/check-agent-doc-handoff.mjs`, expanded marker grep, and `git diff --check`
- Verified GitHub Actions run `26855772471` passed `Check Generated Agent Docs`
- Verified Vercel production deployment `dpl_7RTHaMrQWf4ieQhmEgTbA171BehM`, aliased to `https://www.you.md` and `https://you.md`; live `npm run llms:smoke -- --base-url https://www.you.md` passed all checks

## 2026-06-02 — Agent Docs Smoke Output Clarity

### CI / Docs
- Split `scripts/smoke-agent-docs.mjs` so `/llms-full.txt` source-repo guardrail wording is checked separately from workflow/privacy/upstream markers
- Live smoke output now identifies source-repo guardrail drift directly instead of folding it into the broader workflow/upstream marker check

### Verification
- Passed `npm run agent-docs:ci`, `node scripts/smoke-agent-docs.mjs --base-url https://www.you.md`, `node --check scripts/smoke-agent-docs.mjs`, and `git diff --check`
- Verified GitHub Actions run `26853813606` passed `Check Generated Agent Docs`
- Verified Vercel production deployment `dpl_ET95xLFTzNAF8EnfRTkmcWjzrCGc`, aliased to `https://www.you.md` and `https://you.md`; live `npm run llms:smoke -- --base-url https://www.you.md` passed with separate workflow/privacy/upstream and source-repo guardrail marker checks

## 2026-06-02 — Public Agent Docs Guardrail Wording

### Docs / Agent Context
- Updated the generated root agent-docs source so `/llms-full.txt` explains that `scripts/check-agent-doc-handoff.mjs` covers README, root manuals, `/docs` source, PRD, architecture docs, and stale stack/auth language
- Updated `/docs#agent-docs` command copy with the expanded required/forbidden marker scope
- Extended `scripts/smoke-agent-docs.mjs` so production smoke verifies the expanded guardrail wording in `/llms-full.txt` and `/docs`
- Regenerated `public/llms.txt` and `public/llms-full.txt`

### Verification
- Passed `npm run agent-docs:ci`, `npm run llms:check`, expanded wording marker grep, and `git diff --check`
- Verified GitHub Actions run `26853627596` passed `Check Generated Agent Docs`
- Verified Vercel production deployment `dpl_6Y696yy1PZyoCQ1Efy38Y7MBvRbe`, aliased to `https://www.you.md` and `https://you.md`; live `npm run llms:smoke -- --base-url https://www.you.md` passed the expanded wording checks

## 2026-06-02 — Forbidden Stale Handoff Markers

### CI / Docs
- Added `forbiddenMarkers` support to `scripts/check-agent-doc-handoff.mjs`
- Root `AGENTS.md` and `CLAUDE.md` now fail the handoff check if stale Next 16.1.6, Framer Motion naming, Clerk auth stack, Prod Clerk, or Clerk Backend API markers return
- Active `project-context/ARCHITECTURE.md` and `project-context/PRD.md` now fail the handoff check if stale Clerk-era auth source-of-truth markers return

### Verification
- Passed `npm run agent-docs:ci`, direct `node scripts/check-agent-doc-handoff.mjs`, forbidden stale-marker grep, and `git diff --check`
- Verified GitHub Actions run `26853454878` passed `Check Generated Agent Docs`
- Verified Vercel production deployment `dpl_HwHPUDBVWf3ayk6fdPvT4csAqnBe`, aliased to `https://www.you.md` and `https://you.md`; live `npm run llms:smoke -- --base-url https://www.you.md` passed all checks

## 2026-06-02 — Architecture Auth Source-Of-Truth Cleanup

### Docs / Agent Context
- Updated `project-context/ARCHITECTURE.md` so external services, the user table, auth flows, and auth route descriptions describe first-party passwordless auth instead of stale Clerk-era provider language
- Updated `project-context/PRD.md` so the data-model relationship diagram refers to first-party auth subjects
- Extended `scripts/check-agent-doc-handoff.mjs` to check active PRD/architecture auth markers
- Expanded `.github/workflows/agent-docs.yml` path filters so PRD and architecture changes trigger `npm run agent-docs:ci`

### Verification
- Passed `npm run agent-docs:ci`, workflow path marker check, stale architecture/PRD Clerk-era grep, and `git diff --check`
- Verified GitHub Actions run `26853267125` passed `Check Generated Agent Docs`
- Verified Vercel production deployment `dpl_4DtvTt6comrhxsy7mkPFisPtA1BF`, aliased to `https://www.you.md` and `https://you.md`; live `npm run llms:smoke -- --base-url https://www.you.md` passed all checks

## 2026-06-02 — Root Manual Stack Truth Guardrail

### Agent Context
- Updated root `AGENTS.md` and `CLAUDE.md` tech-stack rows to match current app dependency versions for Next, React, Motion, and Convex
- Replaced stale Clerk auth rows in root manuals with first-party passwordless web sessions, email-code CLI login, signed cookies/JWKS, and scoped API keys
- Extended `scripts/check-agent-doc-handoff.mjs` so root manual stack-version markers are derived from `package.json` and active auth markers are required in both manuals

### Verification
- Passed `npm run agent-docs:ci`, stale root-manual grep for `Clerk` / `16.1.6` / `Framer Motion`, and `git diff --check`
- Verified GitHub Actions run `26853067906` passed `Check Generated Agent Docs`
- Verified Vercel production deployment `dpl_3xHhPeCq4za3oSHGbN7xX5Y3nujs`, aliased to `https://www.you.md` and `https://you.md`; live `npm run llms:smoke -- --base-url https://www.you.md` passed all checks

## 2026-06-02 — Dynamic CLI Handoff Version Check

### CI / Docs
- Updated `scripts/check-agent-doc-handoff.mjs` so root agent-manual CLI version markers are derived from `cli/package.json`
- The local handoff marker check now verifies both the current `youmd X.Y.Z` tech-stack row and `CLI package (npm: youmd, vX.Y.Z)` project-structure row in `AGENTS.md` and `CLAUDE.md`
- Corrected `project-context/ARCHITECTURE.md` so the CLI architecture section references npm package version `v0.6.23`

### Verification
- Passed `npm run agent-docs:ci`, direct `node scripts/check-agent-doc-handoff.mjs`, and `git diff --check`
- Verified GitHub Actions run `26852875154` passed `Check Generated Agent Docs`
- Verified Vercel production deployment `dpl_Phut9JEZc3ZuhhPi3mfXZ2FX9Umx`, aliased to `https://www.you.md` and `https://you.md`; live `npm run llms:smoke -- --base-url https://www.you.md` passed all checks

## 2026-06-02 — Local Docs Page Handoff Guardrail

### CI / Docs
- Extended `scripts/check-agent-doc-handoff.mjs` so local CI checks `src/app/(app)/docs/docs-content.tsx` for `/docs#agent-docs` handoff markers
- The local handoff marker check now verifies the docs page keeps the root agent-doc URLs, docs reference, OpenAPI, MCP discovery, stack capabilities, README/AGENTS/CLAUDE handoff row, marker script, and `agent-docs:ci`

### Verification
- Passed `npm run agent-docs:ci`, direct `node scripts/check-agent-doc-handoff.mjs`, and `git diff --check`
- Verified GitHub Actions run `26852593769` passed `Check Generated Agent Docs`
- Verified Vercel production deployment `dpl_6x8AA2W56JepwY8zN4CQNJNbASaW`, aliased to `https://www.you.md` and `https://you.md`; live `npm run llms:smoke -- --base-url https://www.you.md` passed all checks

## 2026-06-02 — Docs Page Source Repo Handoff

### Docs / Agent Context
- Updated `/docs#agent-docs` to explain README, `AGENTS.md`, and `CLAUDE.md` as repo-visible handoff surfaces for coding agents
- Added `node scripts/check-agent-doc-handoff.mjs` and `npm run agent-docs:ci` to the docs-page agent command table
- Extended `npm run llms:smoke` so `/docs` must include source-repo handoff markers and release commands

### Verification
- Passed `npm run agent-docs:ci`, targeted ESLint for docs content and smoke script, and `git diff --check`
- Verified GitHub Actions run `26852409585` passed `Check Generated Agent Docs`
- Verified Vercel production deployment `dpl_5vKbdeCp1k9Lfj2ZsyroUc5538N9`, aliased to `https://www.you.md` and `https://you.md`; live `npm run llms:smoke -- --base-url https://www.you.md` passed the strengthened docs-page handoff checks

## 2026-06-02 — Generated Source Repo Handoff

### Docs / Agent Context
- Updated the root agent-docs generator so `/llms.txt` points agents to the source repo and explains that README, `AGENTS.md`, and `CLAUDE.md` contain repo-visible generated-docs handoffs
- Added a `Source Repo Handoff` section to generated `/llms-full.txt`
- Extended `npm run llms:smoke` so production smoke checks verify the source-repo handoff markers and `scripts/check-agent-doc-handoff.mjs`
- Regenerated `public/llms.txt` and `public/llms-full.txt`

### Verification
- Passed `npm run agent-docs:ci` and `git diff --check`
- Verified GitHub Actions run `26850743219` passed `Check Generated Agent Docs`
- Verified Vercel production deployment `dpl_JCuw4fjSbkASm31i6iywADTLTEog`, aliased to `https://www.you.md` and `https://you.md`; upgraded live `npm run llms:smoke -- --base-url https://www.you.md` passed all source-repo handoff checks

## 2026-06-02 — Agent Docs Handoff CI Coverage

### CI / Docs
- Added `scripts/check-agent-doc-handoff.mjs` to assert README, `AGENTS.md`, and `CLAUDE.md` keep the generated-doc URLs, MCP/stack URLs, and release-check commands
- Wired the handoff marker check into `npm run agent-docs:ci`
- Expanded `.github/workflows/agent-docs.yml` path filters so README and root agent manuals trigger the agent-docs workflow

### Verification
- Passed `npm run agent-docs:ci`, workflow path marker check, and `git diff --check`
- Verified GitHub Actions run `26850497617` passed `Check Generated Agent Docs`
- Verified Vercel production deployment `dpl_DX4g1vvZShDE3BaAxprMVhMfpiiw`, aliased to `https://www.you.md` and `https://you.md`; live `npm run llms:smoke -- --base-url https://www.you.md` passed all checks

## 2026-06-02 — Agent Manual Docs Preflight

### Agent Context
- Added an Agent Docs Preflight section to root `AGENTS.md` and `CLAUDE.md`
- Pointed future coding agents to generated `/llms.txt`, `/llms-full.txt`, docs reference, OpenAPI, MCP discovery, and stack capabilities before they change docs/API/MCP/stack contracts
- Added the generated-docs release checks to the manuals: `docs:check`, live `llms:smoke`, and `agent-docs:ci`
- Corrected stale CLI version references in root agent manuals to `youmd 0.6.23`

### Verification
- Passed `npm run agent-docs:ci`, `git diff --check`, and manual grep checks for stale CLI version references plus new `Agent Docs Preflight` sections
- Verified Vercel production deployment `dpl_BVdXiSU1uUBEJppmbJvLV79F4YTa`, aliased to `https://www.you.md` and `https://you.md`; live `npm run llms:smoke -- --base-url https://www.you.md` passed all checks

## 2026-06-02 — README Agent Docs Handoff

### Docs / Discoverability
- Added a README "For Agents" section that points source-repo readers to generated `/llms.txt`, `/llms-full.txt`, docs reference, OpenAPI, MCP discovery, and stack capabilities
- Added README release/drift commands for `docs:check`, live `llms:smoke`, and `agent-docs:ci`
- Corrected the README frontend dev-server port from 3000 to 3100

### Verification
- Passed `npm run agent-docs:ci`, live `npm run llms:smoke -- --base-url https://www.you.md`, and `git diff --check`
- Verified Vercel production deployment `dpl_9BGpnTgiBMLLDGoNsWvfkdhtTDLY`, aliased to `https://www.you.md` and `https://you.md`; live `npm run llms:smoke -- --base-url https://www.you.md` passed all checks

## 2026-06-02 — Agent Docs CI Guardrail

### CI / Docs
- Added `npm run agent-docs:ci` to run generated docs checks, generator syntax checks, smoke-script syntax checks, and targeted lint for the agent-docs surface
- Added `.github/workflows/agent-docs.yml`, a path-scoped GitHub Actions workflow for changes to agent docs, docs generators, generated docs artifacts, robots/sitemap, docs page content, and reference-intelligence artifacts

### Verification
- Confirmed `main` was clean and already pushed before continuing
- Passed `npm run agent-docs:ci`, YAML parse for `.github/workflows/agent-docs.yml`, and `git diff --check`
- Verified GitHub Actions run `26849731544` passed `Check Generated Agent Docs`
- Verified Vercel production deployment `dpl_6GAWESCyK3kYEhWuviYppbhGoMD8`, aliased to `https://www.you.md` and `https://you.md`; live `npm run llms:smoke -- --base-url https://www.you.md` passed all checks

## 2026-06-02 — Agent Docs Smoke Automation

### Docs Automation
- Added `scripts/smoke-agent-docs.mjs` for reusable local/production smoke checks of `/llms.txt`, `/llms-full.txt`, `/api/v1/docs/reference`, MCP discovery, `robots.txt`, `sitemap.xml`, and `/docs`
- Added `npm run llms:smoke`
- Updated `/docs#agent-docs` and generated `llms-full.txt` so future agents and release paths know the smoke command

### Verification
- Passed `npm run docs:generate`, `npm run docs:check`, `npm run llms:smoke -- --base-url https://www.you.md`, `npm run llms:smoke -- --base-url http://localhost:3100`, `node --check scripts/smoke-agent-docs.mjs`, targeted ESLint, `npx tsc --noEmit`, ASCII scan, and `git diff --check`
- Verified Vercel production deployment `dpl_5z5yoHXRThajMiMG2YojwYyc61Am`, aliased to `https://www.you.md` and `https://you.md`; live `npm run llms:smoke -- --base-url https://www.you.md` passed all checks

## 2026-06-02 — Generated Agent Docs Pipeline

### Docs Automation
- Added `scripts/generate-llms-docs.mjs` to generate `public/llms.txt` and `public/llms-full.txt` from `src/generated/docs-reference.ts` plus `project-context/reference-intelligence/LATEST.md`
- Added `npm run llms:generate` and `npm run llms:check`
- Wired `docs:generate` and `docs:check` so root agent docs are kept current with shipped routes, MCP tools, CLI metadata, source hash, and monitored upstream reference heads
- Improved generated docs-reference summaries for the OpenAPI inventory and `you-md/v1` schema route
- Updated `/docs#agent-docs` so maintainers know the root agent docs are generated artifacts

### Reference Intelligence
- Re-ran `npm run references:sync`; refreshed `project-context/reference-intelligence/LATEST.md` and `TASKS.md`
- Confirmed the current upstream sync produced no new task candidates

### Verification
- Passed `npm run docs:generate`, `npm run docs:check`, `npx tsc --noEmit`, targeted ESLint on touched generator/docs/generated files, ASCII scan for root agent docs, and `git diff --check`
- Local webpack dev server verified generated `/llms.txt`, `/llms-full.txt`, `/docs`, `robots.txt`, and `sitemap.xml` on `http://localhost:3100`
- Verified Vercel production deployment `dpl_J5wdK3PHkCED8ZoFyW7bFvRYNtqT`, aliased to `https://www.you.md` and `https://you.md`; live generated `/llms.txt`, `/llms-full.txt`, `/docs`, `robots.txt`, and `sitemap.xml` smoke checks passed

## 2026-06-02 — Agent-Readable Docs Surfaces

### Docs / Discovery
- Added root-level `public/llms.txt` as a short agent-readable index for You.md docs, API, MCP, runtime, YouStacks, privacy, and source links
- Added root-level `public/llms-full.txt` as the full plain-text agent context pack with recommended agent order of operations, commands, API/MCP examples, stack rules, smoke checks, and upstream reference intelligence
- Added `/docs#agent-docs` with direct agent bootstrap commands for `/llms.txt`, `/llms-full.txt`, docs reference, OpenAPI, MCP discovery, and stack capabilities
- Added the new docs/reference paths to `robots.txt` allow rules and `sitemap.xml`

### Verification
- Passed `npm run docs:check`, `npx tsc --noEmit`, targeted ESLint on touched TypeScript files, and `git diff --check`
- Local webpack dev server verified `/llms.txt`, `/llms-full.txt`, `/docs`, `robots.txt`, and `sitemap.xml` on `http://localhost:3100`
- Verified Vercel production deployment `dpl_GcSaYeSrzo1JRaqVa9MAyMr4J2VY`, aliased to `https://www.you.md` and `https://you.md`; live `/llms.txt`, `/llms-full.txt`, `/docs`, `robots.txt`, and `sitemap.xml` smoke checks passed

## 2026-06-02 — Codex Chat Hygiene

### Automations
- Paused duplicate local Codex automation `daily-gstack-gbrain-reference-intelligence`
- Kept `daily-gstack-gbrain-reference-sync` active as the single daily You.md reference-intelligence job at 8:30 AM
- Hard-archived completed You.md automation threads from the active Codex thread list without deleting their transcript files: moved JSONL rollouts into `~/.codex/archived_sessions`, set local Codex thread rows to archived, and pruned matching rows from `session_index.jsonl`
- Updated the active daily automation prompt so future runs start with `npm run codex:chat-hygiene -- --apply --older-than-minutes 120`

### Project Context
- Added `project-context/CODEX_CHAT_HYGIENE.md` with the global strategy, You.md automation setup, archived transcript index, and product-level recommendation for automation lanes
- Added `scripts/codex-chat-hygiene.mjs` and `npm run codex:chat-hygiene` as an idempotent local cleanup command
- Backed up local Codex state before hard-archiving threads: `~/.codex/state_5.sqlite.backup-chat-hygiene-hard-20260602T204535Z` and `~/.codex/session_index.jsonl.backup-chat-hygiene-hard-20260602T204535Z`

## 2026-06-02 — Reference Intelligence Artifact Versioning

### Reference Intelligence
- Re-ran `npm run references:sync` and refreshed `project-context/reference-intelligence/LATEST.md` plus `TASKS.md`
- Recorded the current no-new-candidates state from the local reference-intelligence loop while updating the stored GBrain head pointer in the generated artifacts
- Kept the generated reference-intelligence markdown files versioned in git as daily review artifacts instead of treating them as throwaway local output

### Project Context
- Updated `project-context/TODO.md`, `FEATURES.md`, and `feature-requests-active.md` to record the Jun 2 reference-sync result and the new expectation that refreshed reference artifacts are always committed
- Archived Houston's Jun 2 prompts from this session into `project-context/PROMPTS.md`

## 2026-06-01 — BAMF-Style Docs + Minimal Homepage QA

### Docs / API / MCP / Stacks
- Upgraded `/docs` with a BAMF-inspired surface map for Start, API, MCP, Stacks, Workflows, and generated Reference paths
- Added an explicit API/MCP/Stack Standard that defines the expected guide, HTTP, MCP, local stack/runtime, and smoke-check surfaces for each important capability
- Moved generated docs reference stats near the top of the page so the docs read more like a platform reference instead of only a long guide
- Tightened docs UI styling to stay terminal-native: 2px radii, normal letter spacing on headings, and sharper code/table/callout surfaces
- Expanded reference-intelligence docs so GStack, GBrain, Agent Scripts, and The Library all appear as monitored upstream inspirations

### Homepage / Auth / Build Hardening
- Kept the homepage reduced to the core Hero + CTA/footer path
- Preserved the hardened `next` redirect sanitizer and cleaned small touched-file lint warnings
- Kept the Next 16 `proxy` naming/path in place for the cookie gate, matching current Next 16 proxy conventions

### Verification
- Passed `npm run docs:check`, `npx tsc --noEmit`, targeted ESLint on touched files, and `git diff --check`
- Local webpack dev server verified `/` and `/docs` render 200 on `http://localhost:3100`
- Verified `/shell` redirects unauthenticated users to `/sign-in?next=%2Fshell`
- Verified `/.well-known/mcp.json` responds and `sanitizeNextPath` rejects protocol-relative, absolute, and triple-slash unsafe next paths
- Verified Vercel production deployment `dpl_7rodpWtQzYwZSqtfdPZTY95hsu9k`, aliased to `https://www.you.md` and `https://you.md`; live `/`, `/docs`, `/shell`, `/.well-known/mcp.json`, and `/api/v1/docs/reference` smoke checks passed
- Full repo ESLint still fails on pre-existing `.reference-repos` and React Compiler lint issues; local `npm run build` still idles in the Next 16 build worker after docs generation under Node 22, while the Vercel production build succeeds

## 2026-06-01 — Agent Stack Upstream Reference Loop

### Reference Intelligence
- Expanded `npm run references:sync` beyond GStack/GBrain to also clone/fetch `steipete/agent-scripts` and `disler/the-library` under ignored `.reference-repos/<owner>/<repo>/`
- Regenerated `project-context/reference-intelligence/LATEST.md` and `TASKS.md`; latest new upstream captures are Agent Scripts `5dc3c24` and The Library `47f455c`
- Added `project-context/AGENT_STACK_UPSTREAM_AUDIT_2026-06-01.md` to record the product audit, gaps, and next slices for shared agent skills/scripts/prompts/context/catalogs

### YouStacks
- Updated `youstack-start` and `youstack-maintainer` so host agents prefer source pointers over stale copies, check expanded reference-intelligence tasks, validate skill metadata, and model typed dependencies across skills, agents, prompts, scripts, and protected capabilities
- Updated the YouStacks PRD and implementation plan so Agent Scripts and The Library join GStack/GBrain as first-class lighthouses for the stack runtime and private catalog/distribution layer

### README / Product
- Added hat-tip credits for GStack, GBrain, Agent Scripts, and The Library
- Clarified the open-source direction: keep the brain, stack runtime, skills, and public examples mostly open/forkable while hosted You.md covers protected retrieval, sync, publishing, grants, connected tools, high-usage limits, and future agent-platform surfaces

## 2026-05-30 — Reference Sync + Homepage Simplification + Redirect Hardening

### Reference Intelligence
- Re-synced upstream GStack/GBrain references and regenerated `project-context/reference-intelligence/LATEST.md` and `TASKS.md`

### Marketing / UX
- Simplified the homepage down to the core flow (Hero + footer CTA) by removing section sprawl from the root marketing page

### Auth / Redirects
- Hardened `next` redirect handling on `/sign-in` and `/sign-up` to prevent protocol-relative open redirects (e.g. `next=//evil.com`)
- Verified unauthenticated redirects for `/shell` and `/dashboard` via the cookie-gated proxy

### Build / Infra
- Added fetch timeouts for Convex-backed SSR/metadata routes to prevent build stalls
- Added a Tailwind `content` config and removed a stale Next build artifact directory that was stalling PostCSS builds
- Verified `npm run build` successfully under Node 20

## 2026-05-29 — Homepage Minimalization + Brain-Aware Preflight

### Marketing / UX
- Simplified the homepage to a minimal core sequence (Hero → YouStacks → Open standard → CTA) and removed section sprawl
- Simplified the landing navbar to remove scroll-spy anchors and keep only durable navigation (`--profiles`, `--docs`, create / signed-in dropdown)

### YouStacks / Agent Layer
- Updated bundled skills to pre-load `project-context/` (and reference-intelligence tasks) before planning or prompting for basics
- Extended `youmd stack doctor` with git-aware diagnostics (repo root, dirty-tree warning, upstream ahead/behind) to improve sync-freshness visibility

### Auth / Middleware
- Replaced Clerk middleware usage with a lightweight session-cookie gate for protected routes in `src/proxy.ts`, removed the conflicting `src/middleware.ts`, and added `?next=/path` redirect preservation for sign-in flows

### Verification
- Verified root TypeScript with `npx tsc --noEmit`
- Verified CLI TypeScript build with `npm --prefix cli run build`
- Verified targeted landing lint with `npx eslint` on changed homepage components

## 2026-05-28 — Product Language Cleanup

### Product / Copy
- Finished the next product-clarity pass across remaining app metadata, auth boot screens, initialize copy, profile/share surfaces, dashboard panes, README, PRD, docs snippets, sample profiles, schema comments, and robots comments
- Replaced leftover "identity context protocol" / "identity-aware" presentation with the simpler Brain -> Stacks -> Runtime -> Protected API/MCP model while preserving identity as one part of the brain
- Tightened skills and YouStacks copy so agents see brain-aware templates, stack-aware workflows, protected API/MCP boundaries, and private-by-default sharing rules

### Verification
- Verified docs reference freshness with `npm run docs:check`
- Verified root TypeScript with `npx tsc --noEmit --pretty false` after temporarily moving unrelated untracked Clerk-era middleware files out of the compile path
- Verified targeted changed-file lint with `npx eslint`; only pre-existing ignored README/profile image/unused warnings remain
- Verified Vercel production deployment `dpl_D2ZEuhDf5LUQFzW8JToASft64e5m` for commit `5f2150f`, aliased to `https://www.you.md` / `https://you.md`
- Verified live homepage, `/docs#share`, `/profiles`, `/sign-up`, `/houstongolden`, and `/schema/you-md/v1.json` expose the new brain/stacks language and reject the old top-level phrases on those surfaces

## 2026-05-27 — Product Model Simplification

### Product / Copy
- Reframed the user-facing product model from "identity context protocol" toward `Brain -> Stacks -> Runtime -> Protected API/MCP`
- Updated homepage metadata, hero, problem, how-it-works, simple model, YouStacks, integrations, FAQ, CTA footer, and sample profile copy around the simpler model
- Updated docs metadata, docs intro, quickstart, and core concepts with a new "Simple Model" section before protocol/API details
- Updated public profiles so the agent-ready panel reads as a public agent brain with optional public stacks and protected API/MCP for private memory, tokens, and connected tools
- Updated dashboard primary group labels, Stacks pane rules, Help pane, command palette, README, and PRD so future work stays aligned to the simplified model

### Verification
- Verified docs reference freshness with `npm run docs:check`
- Verified root TypeScript with `npx tsc --noEmit` after temporarily moving unrelated untracked Clerk-era middleware files out of the compile path
- Verified targeted changed-file lint with `npx eslint`; only pre-existing profile image/unused warnings remain
- Local Next dev rendering and prior production build attempts still stall in the Next compile worker with 0% CPU; Vercel production deployment `4844921786` for commit `1a7c1a9` completed successfully and is live at `https://www.you.md`
- Verified live homepage, `/docs#simple-model`, and `/houstongolden` expose the Brain, Stacks, Runtime, and Protected API/MCP model

## 2026-05-27 — YouStack Doctor Diagnostics

### YouStacks / CLI
- Added `youmd stack doctor --path <stack>` for read-only stack health diagnostics before agents smoke, improve, update, or publish named YouStacks
- Added a built-in `stack.diagnose` capability and diagnostic route scoring for health, bloat, drift, stale adapter, public-readiness, and resource-leak style requests
- Added doctor output for manifest size, file count/type mix, capability split, adapters, brain scopes, warnings, and next recommendations without reading private brain data or mutating files

### Docs / Lighthouse
- Updated the bundled `youstack-maintainer` skill so agents run doctor before smoke/evals/self-improvement/public-readiness loops
- Added stack diagnostics to the BAMFStack lighthouse manifest, quickstart, smoke checklist, README, dashboard pane, and `/docs#youstacks`
- Kept the GStack/GBrain reference loop concrete by converting the latest GStack diagnostic signal into a YouStacks-native local diagnostic layer

### Verification
- Verified focused YouStack tests with `npm --prefix cli test -- youstack`
- Verified CLI TypeScript with `npx tsc --noEmit --project cli/tsconfig.json`
- Verified docs reference freshness with `npm run docs:check`
- Verified root TypeScript with `npx tsc --noEmit` after temporarily moving unrelated untracked middleware files out of the compile path
- Verified CLI build with `npm --prefix cli run build`
- Verified the built CLI with `node cli/dist/index.js stack doctor --path cli/examples/youstack-bamfstack-public`
- Verified diagnostic routing with `node cli/dist/index.js stack route --path cli/examples/youstack-bamfstack-public "diagnose stack health for route drift and public readiness"`
- Local Next production build attempts using both Webpack and Turbopack stalled in the Next compile worker with 0% CPU; Vercel production deployment `4843270141` for commit `2c80f42` completed successfully and is live at `https://www.you.md`
- Verified live `/docs#youstacks`, `/api/v1/stacks/capabilities`, `/api/v1/docs/reference`, and `POST /api/v1/stacks/route` expose doctor guidance and route diagnostic requests to read-only `stack-diagnostics`

## 2026-05-27 — YouStacks Runtime + BAMFStack Lighthouse

### Runtime / Skills
- Reframed `https://you.md/install.sh` as the curl-first You.md runtime installer instead of a CLI-first installer
- Added source install by default with npm fallback, bundled skill installation, `~/.youmd/bin/youmd-auto-upgrade`, and `~/.youmd/stack-runtime.md`
- Added bundled `youstack-maintainer` so host agents can organize, update, improve, smoke, and prepare private-by-default YouStacks for sharing or publishing
- Added `native-stack-maintainer` and `stack-visibility-management` capabilities to the shared stack route contract

### Product / Docs
- Added `/stacks` shell navigation and a YouStacks dashboard pane covering named stacks, visibility, install commands, update policy, maintainer commands, and BAMFStack lighthouse rules
- Added public-profile rendering for `public-open` YouStacks while keeping private/scoped stacks owner-only
- Expanded homepage and `/docs#youstacks` around runtime-not-CLI-first positioning, shell/profile management, auto-update behavior, the maintainer skill, and BAMFStack as the first public lighthouse case study
- Added `cli/examples/youstack-bamfstack-public` with manifest, skill, workflow, prompt, quickstart, smoke test, update policy, improvement policy, protected-capability boundaries, and public-readiness routing
- Re-synced GStack/GBrain references to latest GStack `19770ea` / GBrain `42d99b6` and created the daily local `Daily GStack/GBrain Reference Sync` automation

### Verification
- Verified docs generation/check, targeted ESLint with zero errors, CLI TypeScript, root TypeScript, focused YouStack tests, CLI build, and Webpack production build
- Verified the built BAMFStack example with `youmd stack smoke` and routing for both creator context and public-readiness requests
- Verified local production homepage, docs, installer script, and stack capabilities API on `localhost:3100`
- Deployed commit `db6a01f` to production via GitHub/Vercel deployment `4842170884` (`https://youmd-71x5nxy48-hubify.vercel.app`) and verified live `https://www.you.md` homepage, `/docs#youstacks`, `/install.sh`, and `/api/v1/stacks/capabilities`

## 2026-05-27 — YouStacks Positioning Clarity

### Marketing / Docs
- Added GStack/GBrain-guided architecture language to the homepage: YouStacks learn from GStack reference patterns, while the You.md brain follows GBrain-style durable shared brain patterns
- Added `/docs` Brain Architecture, Reference Intelligence, and GStack/GBrain Reference Loop sections
- Added named YouStack portfolio guidance so users can keep separate stacks for coding, scientific research, content creation, and other expertise lanes
- Added `/docs#youstacks` sections for `Named Stacks` and `Self-Improving Stacks`, including domain stack examples and policy-bound autonomous improvement loops
- Updated homepage YouStacks copy to explain named domain stacks and self-improving stack/skill loops
- Reframed the homepage YouStacks section around the clearer "build your own GStack for any agent" mental model
- Changed YouStacks copy from abstract execution-package language to packaged expertise: skills, prompts, workflows, taste, examples, tools, and safe You.md memory access
- Added a `/docs#youstacks` "What Goes In" subsection covering skills, workflows, taste/examples, and protected capabilities
- Updated YouStack docs examples and manifest snippets to show a founder/growth expertise stack instead of a generic startup package
- Tightened the copy again around the exact Gary Tan/GStack analogy: years of expertise, specialist agents, workflows, taste, examples, and review loops packaged into a stack that others can install

### Product Contract
- Added `npm run references:sync`, which keeps ignored local clones of `garrytan/gstack` and `garrytan/gbrain` under `.reference-repos/garrytan/`
- Added `project-context/reference-intelligence/LATEST.md` and `TASKS.md` generated from upstream commit summaries, plus `project-context/REFERENCE_INTELLIGENCE.md` documenting the loop
- Updated the YouStacks PRD and implementation plan so daily GStack/GBrain reference monitoring becomes part of the product architecture
- Extended the `youstack/v1` manifest model with optional `domain`, `aliases`, `tags`, `improvement`, and `update` fields
- Added validation warnings for stacks that omit improvement/update policy, plus built-in `stack.improve` and `stack.update` local capabilities
- Updated `youmd stack inspect`, `smoke`, adapter generation, the sample stack, route scoring, and the stack route API payload around stack identity and improvement/update behavior

### Verification
- Verified the reference monitor with an initial sync: GStack latest `a6fb317`, GBrain latest `42d99b6`, and 24 generated You.md task candidates
- Verified `scripts/reference-intelligence.mjs` syntax with `node --check`
- Verified docs reference freshness with `npm run docs:check`
- Verified targeted changed-file lint with `npx eslint`
- Verified focused YouStack tests with `npm --prefix cli test -- youstack`
- Verified TypeScript with `npx tsc --noEmit` and `npm --prefix cli run build` after temporarily stashing unrelated untracked middleware files
- Verified production build with `npm run build -- --webpack`; Vercel production deploy also passed the Turbopack build path
- Verified built CLI `youmd stack inspect`, `smoke`, and `route` output for the sample stack
- Verified local production homepage/docs/reference text on `localhost:3100`
- Opened the improved homepage and docs YouStacks section in the Codex in-app browser for visual review
- Deployed commit `f9defd0` to production as Vercel deployment `dpl_EyuaBhd5yXGFrw5eAGu2eBqZ46su`, aliased to `https://www.you.md` and `https://you.md`
- Verified live production homepage, `/docs#youstacks`, `/api/v1/docs/reference`, and `/api/v1/docs/openapi.json` expose the clarified YouStacks copy and reference surfaces, including the stronger "package your expertise into your own GStack" and Gary Tan/GStack/sub-agent framing
- Deployed commit `4a0c25d` to production as Vercel deployment `dpl_CZR4kXxAnfvRWNC14XdfvAq6ye9F`, aliased to `https://www.you.md` and `https://you.md`
- Verified live production homepage, `/docs#youstacks`, `/api/v1/stacks/capabilities`, `/api/v1/docs/reference`, and `POST /api/v1/stacks/route` expose named stack portfolio, self-improvement, update policy, and stack metadata behavior
- Deployed commit `2e07682` to production as Vercel deployment `dpl_4UwpUiK2vUPYu8R9nj8dfnBDpq9M`, aliased to `https://www.you.md` and `https://you.md`
- Verified live production homepage and `/docs` expose the GStack/GBrain reference-intelligence architecture and `npm run references:sync` monitor command

## 2026-05-26 — YouStacks Homepage + Docs Surface

### Marketing / Docs
- Added a first-class homepage YouStacks section that explains the brain-vs-stack boundary, local-first stack files, protected You.md API/MCP access, and personal/project/team/public stack use cases
- Expanded the `/docs` YouStacks chapter with use cases, install flow, manifest guidance, personal/project examples, API/MCP threshold rules, generated YouStacks endpoint reference, and local MCP stack tool reference
- Updated generated docs reference/OpenAPI categorization so `/api/v1/stacks/capabilities` and `/api/v1/stacks/route` appear under a dedicated `YouStacks` category instead of generic `Other`
- Updated homepage metadata to mention the YouStack layer alongside the identity context protocol

### Verification
- Verified docs reference generation with `npm run docs:generate` and `npm run docs:check`
- Verified targeted changed-file lint with `npx eslint`
- Verified TypeScript with `npx tsc --noEmit` after temporarily stashing and restoring the unrelated untracked Clerk-era `src/middleware.ts`
- Verified a production build with `npm run build`; the built route manifest still includes `/`, `/docs`, `/api/v1/stacks/capabilities`, and `/api/v1/stacks/route`
- Verified the built local production server on `localhost:3100` returns homepage/docs content and generated API/OpenAPI data with YouStacks copy, endpoint tags, and stack MCP tool names
- Deployed commit `8e37ec1` to production as Vercel deployment `dpl_7b6X4k3R6JahR7F3jqFdbgJXN5S1`, aliased to `https://www.you.md` and `https://you.md`
- Verified live production homepage, `/docs`, `/api/v1/docs/reference`, and `/api/v1/docs/openapi.json` all expose the YouStacks homepage/docs/API/MCP surfaces

## 2026-05-24 — YouStacks Local Product Layer

### CLI / MCP / API
- Added the first local YouStacks foundation: `youmd stack inspect`, `youmd stack smoke`, `youmd stack capabilities`, and `youmd stack route`
- Added `youstack/v1` manifest types, validation, read-only smoke checks, deterministic capability routing, and a sample personal YouStack under `cli/examples/youstack-personal`
- Added `youmd stack link` for Claude Code, Codex, and Cursor adapter generation, including dry-run output before writing host files
- Exposed local MCP stack resources and tools: `youmd://stacks/current/manifest`, `youmd://stacks/current/capabilities`, `get_stack_manifest`, `get_stack_capabilities`, `route_stack_request`, and `smoke_stack`
- Added shared read-only HTTP endpoints for `GET /api/v1/stacks/capabilities` and `POST /api/v1/stacks/route`
- Updated `/docs`, generated API/MCP reference data, and CLI help around the local-first stack boundary and shared API/MCP threshold
- Bumped the CLI release target and generated docs reference to `0.6.23`

### Verification
- Verified the focused YouStack tests with `npm test -- mcp-agent-brief.test.ts youstack.test.ts`
- Verified the full CLI suite with `npm test` in `cli/` (12 files, 61 tests)
- Verified the CLI build with `npm run build` in `cli/`
- Verified the local stack commands with the built CLI: `stack inspect`, `stack smoke`, `stack capabilities`, `stack route`, and `stack link`
- Verified local MCP through the official MCP SDK client: stack tools listed, current stack resources listed, and `route_stack_request` returned `protected-memory-search` for a memory request
- Verified docs sync with `npm run docs:generate` and `npm run docs:check`
- Verified root TypeScript with `npx tsc --noEmit`
- Verified root production build with `npm run build`; the Next route manifest includes `/api/v1/stacks/capabilities` and `/api/v1/stacks/route`
- Verified local production API behavior on `localhost:3100`: capabilities contract, default memory routing, and manifest-supplied local startup routing
- Pushed to `main`; Vercel production deployment `dpl_N72DFZEPzzXeu5oLMQXp8wPzcWpx` is ready and aliased to `https://www.you.md` / `https://you.md`
- Verified live production `https://www.you.md/api/v1/stacks/capabilities`, `POST https://www.you.md/api/v1/stacks/route`, `https://www.you.md/api/v1/docs/reference`, and `https://www.you.md/docs`
- Verified the Convex Deploy GitHub Action for the YouStacks implementation push completed successfully at `0bd0e66`
- Triggered the trusted npm publish workflow for `youmd@0.6.23`; install, tests, and build passed, but npm publish failed with `E404 Not Found / no permission`, so the npm package remains `0.6.21` until npm package Trusted Publishing/permissions are configured
- Hardened the publish workflow to match current npm Trusted Publishing guidance (`actions/checkout@v6`, `actions/setup-node@v6`, `package-manager-cache: false`) and normalized CLI package metadata back to the canonical `git+https://github.com/houstongolden/youmd.git` repository URL after npm warned about auto-correction
- Retried the GitHub trusted publish workflow as run `26387133488`; dependency install, CLI tests, and CLI build passed again, then `npm publish` failed with the same `E404 Not Found / no permission`, confirming the remaining blocker is npm package Trusted Publishing/package permission configuration rather than repo code
- Verified the exact npm Trusted Publishing CLI setup path with `npx npm@11.15.0 trust github youmd --repo houstongolden/youmd --file publish-cli.yml --allow-publish --yes`; dry-run resolves to the right package/repo/workflow/publish permission, while the real command is blocked on this machine by npm `E401` because the shell is not logged into npm with write access and 2FA
- Verified the latest Vercel production deployment is ready and aliased to `https://www.you.md` / `https://you.md`, then re-smoked live stack capabilities and generated docs reference endpoints
- Browser QA through gstack browse was blocked because the browse runtime could not start without `bun`; HTTP/API and production-build verification completed instead

## 2026-05-23 — YouStacks Product-Layer Planning

### Planning / Architecture
- Preserved the YouStacks product-layer brief in `project-context/YOUSTACKS_PRODUCT_LAYER_PRD.md`
- Audited the existing You.md web app, dashboard panes, CLI/TUI, You Agent, memory/private-context/project-context, skill system, context links, API keys, MCP/API surfaces, Convex schema/routes, docs, onboarding, sharing, and GitHub/source/sync code
- Reviewed GStack as the local-first external lighthouse and BAMFStack as the internal proof pattern for stack install, capability discovery, deterministic routing, smoke tests, docs quality, and sync discipline
- Added `project-context/YOUSTACKS_IMPLEMENTATION_PLAN.md` with feature inventory/classifications, brain boundary audit, YouStack manifest schema, repo layout, access model, GitHub App repo-sync recommendation, sharing model, primary/secondary host adapters, API/MCP threshold, helper CLI, smoke test, docs sync rule, and bisectable phases

### Verification
- This was a planning-only pass. No broad product behavior changes were implemented.

## 2026-05-22 — YouStack Agent Brief + Starter Skill

### MCP / Skills
- Added local MCP `get_agent_brief`, a YouStack startup brief that combines compact identity, cwd, repo instruction files, project-context files, active requests, open TODOs, known issues, installed skills, recommended skills, and next moves
- Added `youmd://agent/brief` as a markdown MCP resource for clients that prefer resource reads over tool calls
- Added bundled `youstack-start`, a local-agent startup skill for Claude Code, Codex, Cursor, and other MCP/CLI agents
- Made `youstack-start` the first recommended bundled skill and updated the empty-catalog next step to `youmd skill install youstack-start`
- Synced the 7-skill surface across CLI catalog defaults, backend bundled-skill seed data, SkillsPane, You Agent skill copy, README, docs, and generated docs reference

### Verification
- Added `cli/src/__tests__/mcp-agent-brief.test.ts` for startup brief extraction from `AGENTS.md` and `project-context/`
- Verified with `npm test -- mcp-agent-brief.test.ts`, `npm run build` in `cli/`, temp-HOME `node dist/index.js skill list`, root `npm run docs:check`, and root `npm run build` with explicit Node PATH
- Production registry seeding/deploy and real Claude/Codex host verification are still pending

## 2026-05-22 — Developer Docs Platform Upgrade

### Docs / API / MCP
- Compared the current You.md docs against the stronger BAMF docs structure and Mintlify patterns: concepts, quickstart, auth/scopes/errors, endpoint reference, MCP tooling, playbooks, examples, generated OpenAPI, and release-time docs sync
- Expanded `/docs` with core concepts, context surfaces, source-of-truth mapping, agent workflow golden path, playbooks, starter prompts, generated API endpoint tables, generated MCP tool cards, schema guidance, docs automation, and troubleshooting
- Added `scripts/generate-docs-reference.mjs`, which scans `convex/http.ts`, Next route files, and `cli/src/mcp/server.ts` to generate `src/generated/docs-reference.ts` plus an OpenAPI 3.1-style spec
- Added `GET /api/v1/docs/reference` and `GET /api/v1/docs/openapi.json` so agents, smoke tests, and future docs tooling can fetch the same generated reference data
- Wired docs generation into `prebuild` and added `npm run docs:check` so releases catch stale API/MCP docs artifacts automatically
- Verified with `npm run docs:generate`, `npm run docs:check`, targeted ESLint, `npx tsc --noEmit`, production `npm run build`, and browser QA on `localhost:3100/docs` across desktop and mobile with no console errors or horizontal overflow

## 2026-05-21 — Context Link Reliability

### Agent Context URLs
- Hardened `GET /ctx` so valid full-context links no longer fail just because use-count tracking, profile-view recording, or cross-agent activity logging throws
- Added a top-level fallback error response for unexpected `/ctx` failures so agents get JSON instead of opaque platform "Server Error" pages
- Changed tokenized context-link cache headers from public caching to `private, no-store` and added `Vary: Accept` so JSON and markdown/text negotiation does not bleed across clients or shared caches
- Updated the Next `/ctx/[...path]` proxy to preserve the same private/no-store cache behavior and `Vary: Accept`
- Verified locally against the production Convex dataset: JSON returns `schema: you-md/v1`, `identity`, and `_privateContext`; `Accept: text/plain` returns markdown; invalid tokens return 404; `If-None-Match` still returns 304; `npx tsc --noEmit`, `npx tsc --noEmit -p convex/tsconfig.json`, and `npm run build` pass
- Deployed via push `92314d3` and verified production context links return full JSON with `_privateContext`, markdown for `Accept: text/plain`, 404 JSON for invalid tokens, 304 for matching ETags, and deployed `Cache-Control: private, no-store` + `Vary: Accept`
- After Myo reported a fresh server error that did not appear in Vercel or Convex `/ctx` logs, changed generated context links and docs to use `https://www.you.md/ctx/...` directly so agent fetchers do not have to follow the apex-domain redirect first
- Tightened `/ctx` and profile content negotiation so broad agent headers like `Accept: application/json, text/plain, */*` return JSON; markdown/plain text now only wins when the caller asks for text without also accepting JSON
- Deployed follow-up fixes via pushes `f010837` and `b62ba51`; verified production `https://www.you.md/ctx/houstongolden/<token>` returns 200 with zero redirects, JSON includes `schema`, `identity`, and `_privateContext`, broad agent Accept headers return JSON, explicit `Accept: text/plain` returns markdown, and apex `https://you.md/ctx/...` now only remains as a 307 fallback
- Verified the direct-`www` URL change with `npx tsc --noEmit`, `npx tsc --noEmit -p convex/tsconfig.json`, targeted ESLint on live changed source files, and `npm run build` through Homebrew Node; docs-page ESLint is still blocked by pre-existing `react/no-unescaped-entities` issues away from the changed URL line

## 2026-05-19 — Homepage + App Design-System Cleanup

### Public Profiles / Directory Quality
- Added shared Convex profile-directory normalization for canonical username dedupe, richest-record selection, public image URL sanitization, social-link avatar fallback resolution, stored ASCII portrait sanitization, and public QA/test row suppression
- Updated `/profiles` client and SSR directory rendering to suppress QA/test rows defensively, dedupe by canonical username, prefer stored ASCII portraits, fall back through sanitized avatar/social-link sources, and render deterministic terminal placeholders instead of blank cards
- Updated public profile pages and metadata to sanitize avatar URLs and render stored ASCII portraits even when the live avatar URL is missing or unavailable
- Hardened sample profile seeding/backfill/cleanup so reseeds avoid duplicate/orphan profile rows and keep avatar data attached to backfilled profiles
- Fixed enrichment/crawler hygiene so Unavatar API keys are used only for server-side fetches and are no longer persisted into public `avatarUrl` fields; added an internal cleanup mutation for previously persisted image secrets
- Verified `/profiles` list/grid, homepage profile proof, and an unclaimed public profile visually in the in-app browser on `localhost:3000`; `tsc --noEmit` and `next build --webpack` pass

### Marketing / App UI
- Added shared design primitives for containers, sections, section headers, buttons, cards, terminal cards, form fields, inputs, textareas, selects, helper text, and error text
- Tightened global layout/type/control tokens around the 1120px page width, readable copy widths, 2px radius, consistent focus rings, compact section rhythm, and shared button/input sizing
- Rebuilt the homepage into a clearer conversion path: calmer hero, one obvious primary CTA, compact profile proof strip, compressed problem/how-it-works/inside sections, combined integrations/builders band, ownership band, balanced pricing, compact FAQ, and direct final CTA
- Reduced early profile/network noise, moved CLI install details into supporting sections, and kept the terminal/ASCII identity as an accent instead of a wall of competing command content
- Normalized app-facing controls across terminal auth/input, dashboard tabs, pane headers/empty states, edit/share/sources/private context/files/settings surfaces, and install tabs while preserving routes, auth, API, Convex behavior, and data models
- Cleaned up the app-nav signed-out create CTA and `/profiles` filter/sort controls so the CTA no longer leaks into narrow nav layouts, filters snap into compact responsive rows, and live list/grid interactions stay overflow-free
- Verified with a clean production build, live Chrome desktop/mobile visual QA on `localhost:3000`, and targeted lint on changed files; full repo lint still reports pre-existing issues in untouched/generated components

## 2026-04-30 — Guided `you` Setup + Smaller Launcher Portrait

### CLI / Agent UX
- Bumped the CLI publish target to `0.6.22`, rebuilt the package, and aligned `cli/package.json`, `package-lock.json`, runtime `--version`, and the MCP user-agent so the launcher fixes can publish cleanly
- Taught `you` how to stay alive when setup is incomplete: if auth or a local bundle is missing, the launcher now asks one direct next-step question and can route straight into `login`, `register`, `pull`, or `init` instead of dumping a static command list
- Once a local bundle exists, `you` now hands straight into U chat even before auth is finished, which keeps the launcher useful in local-only identity workflows instead of hard-gating the conversation behind login
- Shrunk the compact launcher portrait bounds dramatically so the saved/profile portrait stays inside a much smaller square on narrow terminals instead of taking over the whole viewport and getting cropped
- Fixed the compact portrait crop bug by preserving the full public-profile portrait before downsampling, so the CLI no longer throws away the lower 70% of the portrait and cuts the face framing off at the forehead
- Fixed nested-repo project detection so running `you` from `youmd/cli` resolves to the real git repo root instead of treating the nested CLI package as an unwired project that needs fake scaffolding
- Made `start` / `start there` route through deterministic local host tools for obvious local actions, read real project files first, and print a grounded local summary instead of sending filesystem results back through the model and risking "i can't access files" theater
- Made that local project read materially more useful by extracting open action items from `project-context/TODO.md`, `CURRENT_STATE.md`, and active request docs, then using the top real item as the next strongest move instead of ending on a vague "if the user wants" prompt
- Upgraded the launch-time strongest move itself to use those ranked project action items, so `you` now opens on the real unblocker when it can see one instead of forcing the user to type `start` before U becomes specific
- Fixed the `continue` / `more` / "next strongest move" path so it bypasses the remote model router and runs the deterministic local project-context read; this prevents stale identity context from hijacking a local release-readiness continuation
- Ranked release blockers like npm Trusted Publishing configuration above broader publish todos, and tightened action-list display so U shows the top concrete items without dumping an overlong project backlog
- Changed the launcher's next-move heuristic so the current project wins over unrelated recent-project orbit; `you` launched inside You.md now proposes reading You.md's own project context instead of drifting to BigBounce
- Matched the web `/initialize` encounter to the smaller portrait direction by downsampling stored portraits and rendering generated portraits at 44 columns inside a fixed small portrait column
- Cleaned the published CLI package shape so compiled test artifacts are no longer included in the npm tarball
- Added a GitHub Actions Trusted Publishing workflow plus `npm run publish:cli`, so local agents can trigger npm publish through GitHub OIDC without a long-lived npm token or interactive OTP prompt
- Hardened the publish workflow after a real run failed in dependency install: CI now installs with package scripts disabled before build, and the package postinstall no longer crashes in fresh source checkouts where `dist/` has not been generated yet
- Verified the trusted-publishing workflow now gets through install, tests, and build; the remaining publish failure is npm-side package permission / Trusted Publisher configuration for `youmd`, not a local package/build problem
- Added first-class Codex MCP install support: `youmd mcp --install codex` now prints the right `~/.codex/config.toml` block, and `--auto` safely upserts the `[mcp_servers.youmd]` entry with `npx --yes youmd@latest mcp` instead of the older collision-prone `npx youmd mcp`
- Migrated the real local Claude and Codex MCP configs to the safe published-package launcher and updated `~/.agent-shared/STACK-MAP.md` so future local agents see the current stack shape
- Fixed MCP server identity and fallback behavior: agents now see `serverInfo.version` as `0.6.22`, and MCP tools fall back to the initialized home bundle when a project has no local `.youmd/`, so `whoami` returns Houston's actual identity instead of `Name: (unknown)`
- Smoke-tested MCP over stdio with `initialize`, `tools/list`, `whoami`, and `use_skill project-context-init`; both identity and skill rendering now work from the installed CLI package while launched inside this repo
- Verified `youmd skill link codex` and `youmd skill link claude` render the six bundled skills into project-local agent directories, then ignored generated `.codex/` artifacts the same way `.claude/` artifacts were already ignored
- Fixed `youmd skill init-project` so fresh and existing repos now bootstrap both `.claude/skills/youmd/` and `.codex/skills/youmd/` by default, while keeping Cursor opt-in for repos that already have `.cursor/`
- Re-tested the installed local `youmd` package end-to-end in disposable projects: scaffold mode and additive mode both preserve existing files, create the project-context layer, link 6 Claude skills, link 6 Codex skills, and generate Codex MCP config through `youmd mcp --install codex --auto`
- Updated the curl installer and npm postinstall moment to put `you` first, with `youmd login` and `youmd init` framed as explicit paths rather than mandatory paperwork before meeting U
- Changed browser login fallback copy to return users to `/shell` instead of the older dashboard path
- Updated README, docs, FAQ, onboarding, and skill copy to consistently teach `you` as the main local U entrypoint while keeping `youmd chat` as the explicit long-form command
- Removed a stale untracked Clerk-era `src/middleware.ts` that was blocking Next 16 builds now that the real request gate lives in `src/proxy.ts`
- Set an explicit Turbopack root in `next.config.ts` so Next 16 builds no longer warn about the workspace root being inferred from the Desktop lockfile
- Fixed the public web-domain MCP proxy to return the upstream JSON body for `/api/v1/mcp` and `/.well-known/mcp.json` instead of only forwarding headers
- Updated stale architecture/PRD/current-state docs that still described Clerk/email-password auth instead of the live first-party passwordless stack
- Added CLI tests for the first-run action parser and the portrait-bound sizing helper, then re-ran the full CLI test suite plus TypeScript build cleanly
- Re-ran the full Next production build cleanly after the middleware/proxy conflict was removed
- Re-verified live public identity markdown and the direct production Convex MCP endpoint during this pass
- This keeps the launcher closer to the intended wingman experience on real laptop and phone-width terminal windows, while also moving the broader ship-readiness audit forward instead of leaving setup UX as a known rough edge

## 2026-04-21 — Local Tool Loop

### CLI / Agent UX
- Turned the one-off local host bridge into an explicit local tool loop with `discover_projects`, `read_project_context`, `write_project_context`, `sync_identity`, and `respond`
- U can now route local chat requests through host-owned filesystem tools, read real project entrypoints/context files, bootstrap project context, and compile/publish identity only when the user asks for that mutation
- Added grounded failure handling so local tool errors become visible assistant turns instead of making the chat look stalled
- Bumped the next CLI publish target to `0.6.20` so this tool-loop pass ships as a fresh npm version

## 2026-04-21 — Local Host Tool Bridge

### CLI / Agent UX
- Fixed the bad `youmd chat` opener path so it no longer asks the remote model to invent the first proactive greeting; both `you` and `youmd chat` now use the local context-aware opener
- Added a local host-tool bridge for `start there`, so the CLI executes the project bootstrap locally and then sends the tool result through the remote model for the final response
- Added the same host-tool bridge for recent-work questions, so the CLI scans generic local workspace roots and the remote model summarizes real filesystem results instead of claiming it cannot access files
- Generalized workspace discovery; U now checks common roots like `~/Projects`, `~/Code`, `~/Developer`, `~/repos`, desktop variants, and explicit `YOUMD_WORKSPACE_ROOTS`
- Removed the remaining personal workspace root names from CLI source; discovery now relies on generic workspace roots, safe current-directory parents, and explicit user configuration
- Added marker-based auto-discovery so U can infer workspace roots from real project markers like `AGENTS.md`, `CLAUDE.md`, `.agents`, `.claude`, `.claw`, `.git`, `package.json`, `pyproject.toml`, and `project-context`
- Bumped the next CLI publish target to `0.6.19` so this behavior fix shipped as a fresh npm version

## 2026-04-21 — Compact, Paced `you` Startup

### CLI / Agent UX
- Fixed the local `you` startup so it no longer dumps the full web-profile ASCII portrait into the terminal; the portrait is now downsampled for terminal display before rendering
- Reduced the launch sequence from a full-page context dump into a tighter progressive flow: logo + compact portrait, a visible scan, two findings, then one concise proactive opener
- Removed duplicated startup summaries for the `you` surface so U no longer repeats recent projects, findings, strongest opening, and chat header in multiple sections before the user can type
- Bumped the next CLI publish target to `0.6.14` so this UX fix was versioned before the next npm publish prompt

## 2026-04-18 — Deeper `you` Context Sweep + Strongest-Move Opener

### CLI / Agent UX
- Deepened the `you` launcher investigation so U now reads home-level shared agent docs and recent Claude/Codex session roots, not just the immediate repo and home bundle
- Replaced the old generic “what are we moving forward right now?” opener with a stronger handoff that proposes the strongest move U can already see from the recent context sweep
- Bumped the next CLI publish target to `0.6.13` so the deeper startup-context pass is versioned before the next npm publish prompt

## 2026-04-18 — Narrow-Terminal `you` Encounter Fix

### CLI / Agent UX
- Fixed the `you` launcher scene on narrow terminals so the portrait, bot, and greeting no longer collide into unreadable overlap when the viewport is too tight for the full side-by-side encounter
- The launcher now detects when the scene exceeds the active terminal width and automatically stacks the portrait, bot, and speech vertically instead of forcing the old horizontal composition
- Bumped the next CLI publish target to `0.6.12` so the screenshot-driven launcher fix is already versioned before the next npm publish prompt

## 2026-04-18 — `you`-First Install + Onboarding Copy

### CLI / Install / DX
- Tightened the first-run guidance around the new launcher so the product now consistently teaches `you` as the main "meet U" path once a bundle exists
- Updated the curl installer next-steps output, CLI register success copy, example-init next steps, and conversational onboarding next-step block so they no longer over-index on `youmd chat`
- Updated the README quickstart and command table to introduce `you` explicitly as the alive terminal entrypoint instead of burying it beneath the older explicit chat command

## 2026-04-18 — Workspace Repo Awareness For `you`

### CLI / Agent UX
- Brought the actual YOU logo framing into web `/initialize`, so the onboarding encounter now starts with the same brand scene language as the local launcher instead of just a portrait strip over a terminal
- Gave web `/initialize` a real portrait-first encounter strip above the onboarding terminal: it now reuses the stored ASCII portrait when available, pairs it with the U bot, and frames the first interaction like the local `you` launcher instead of a plain terminal box
- Tightened the web `/initialize` encounter so it uses the same live thinking/progress plumbing as the main shell, instead of feeling flatter than the local `you` launcher while the agent is working
- The onboarding greeting prompt now explicitly targets the same U persona as the local launcher and can naturally mention known saved projects when context already exists
- Bumped the next CLI publish target to `0.6.11` so this onboarding-handoff pass is versioned before the next npm publish prompt
- Extracted shared recent-project helper logic into the project library so `you`, `youmd`, and onboarding can all prioritize the same real project openings instead of drifting
- `youmd init` and conversational onboarding now finish with a stronger handoff into U: `you` is the first next step, recent orbit is surfaced explicitly, and actionable openings like `foldermd` are suggested right in the finish flow
- Extended the launcher's local-awareness pass beyond `~/.youmd/projects`, so U can now notice ordinary workspace repos that already have `AGENTS.md`, `CLAUDE.md`, `.youmd-project`, or `project-context/` even if they were never initialized through the dedicated You.md project command
- This makes the proactive startup genuinely more useful on real machines: when launched from arbitrary directories, U can now point at actionable openings like `foldermd` having project-context docs but no top-level agent entrypoint, instead of pretending your recent work disappeared
- `you` now prioritizes actionable project openings over just the most recent healthy contexts, so startup and chat can point at real next moves like tightening `foldermd` instead of only listing project names

## 2026-04-18 — Recent Project Opportunity Scan From Anywhere

### CLI / Agent UX
- Taught the `you` startup flow to look for actual openings in recent project contexts instead of only naming recently touched projects, which gives U something concrete to point at when it wants to be proactively helpful
- Added a home-bundle fallback for that recent-project scan, so launching `you` from arbitrary directories like `/tmp` can still inspect `~/.youmd/projects` instead of acting like your recent project orbit disappeared
- Bumped the next CLI publish target to `0.6.8` so the new startup-opportunity pass is versioned before the next npm publish prompt

## 2026-04-18 — Truthful `you` Startup + Public Portrait Contract Fix

### CLI / Portrait / Agent UX
- Upgraded the `you` launcher from a stylish bluff into a truthful wingman entrance: after the YOU logo and portrait-in-code, U now keeps a live braille spinner running while it actually checks local guidance, nearby AGENTS / CLAUDE files, and project-context signals before it talks
- Added a concrete finding pass to that startup flow, so the launcher now tells you what it actually found instead of implying it already looked around with no evidence
- Tightened the terminal bot / portrait encounter copy so the last line now points at real active work — "i'm taking a lap through your recent work" — rather than acting like a static joke
- Fixed a contract bug that was blocking portrait parity: the CLI wrapper for `/api/v1/profiles` was stripping `_profile` metadata out of the returned `youJson`, which meant the launcher could not actually see the public profile metadata it was trying to prefer
- Extended the public profile payload with `_profile.asciiPortrait`, then taught the CLI portrait resolver to prefer the current profile-selected portrait data over stale cached avatar fallbacks, which is the foundation for making the startup face match the public profile instead of a long-lived X/GitHub fallback
- Bumped the next CLI publish target to `0.6.7` so the version bump is already handled before the next npm publish prompt reaches Houston

## 2026-04-18 — `you` Launcher + Portrait Encounter + Update Hints

### CLI / UX / Release Ops
- Added a real `you` launcher alongside `youmd`, so the default local entry can now feel more like Claude/OpenClaw: if you're authenticated and have a bundle, `you` drops straight into chat instead of making you remember `youmd chat`
- Upgraded that launcher to feel like meeting U instead of a utility binary: it now renders the YOU logo, loads the user's ASCII portrait-in-code, shows a small terminal bot greeting the portrait, and opens with a more proactive "I help other agents know you" intro
- Made the conversational launch path resilient outside initialized repos by letting `you` / `youmd chat` fall back to the home bundle in `~/.youmd` when there is no local `.youmd/`
- Extended that same active-bundle fallback to read-only commands, so `status`, `diff`, `export`, and `preview` now work cleanly from arbitrary directories instead of pretending no bundle exists
- Added update-aware startup hints so the CLI can notice when npm has a newer published build and show the exact curl and npm commands to upgrade without the user having to guess
- Bumped the next publish target to `0.6.5` so the runtime version, package metadata, and MCP user-agent stay aligned for the next npm release

## 2026-04-18 — U-Style Install Moment + Durable Preference Roundtrips

### CLI / Identity Bundle / Agent UX
- Upgraded the npm install moment so postinstall now feels like meeting U instead of getting barked at with `Run: youmd init`: it prints the YOU logo, frames U as the user's wingman, and points people toward `youmd`, `youmd login`, and `youmd chat`
- Fixed a real identity roundtrip bug where richer markdown written into `preferences/agent.md`, `preferences/writing.md`, `voice/voice.md`, or `directives/agent.md` would get flattened away on publish and then reappear as thin generated files on pull
- The compiler now preserves the raw markdown for those files alongside the structured fields, and the decompiler now prefers that preserved markdown when rebuilding the local bundle, which means users can safely store more opinionated agent instructions in their identity without losing them on sync
- Verified the fix end to end by writing Houston's preferred ack -> plan -> visible work -> complete + proactive next-step pattern into the live bundle, publishing it, and pulling it back into a clean temp directory with the local `0.6.3` build

## 2026-04-18 — U-Style CLI Entrance + Next Publish Target 0.6.3

### CLI / UX / Release Ops
- Upgraded the normal CLI entrypoints so they feel less like a raw utility and more like meeting U: bare `youmd` now opens with the YOU logo, greets the user contextually, surfaces relevant next moves, and calls out obvious repo setup opportunities instead of just dumping a minimal command stub
- Upgraded `youmd chat` to enter the same way, with a more human opening and proactive repo-awareness when the current project still wants AGENTS/project-context wiring
- Fixed the duplicated first assistant greeting in `youmd chat` by stopping the chat renderer from printing the same opening turn again after a successful streamed response
- Bumped the next CLI publish target to `0.6.3` after `0.6.2` landed, keeping `package.json`, `package-lock.json`, `youmd --version`, and the MCP user-agent aligned for the next npm release

## 2026-04-17 — CLI Publish Retry Fix For 0.6.2

### CLI / Release Ops
- Bumped the CLI from `0.6.1` to `0.6.2` after confirming `0.6.1` was already live on npm, which unblocks the next publish attempt instead of trying to overwrite a forbidden version
- Normalized the published package metadata so npm stops auto-correcting the same fields during publish: the `bin` entries now use clean `dist/...` paths and the repository URL now uses the canonical `git+https://...` form
- Rebuilt the CLI after the bump so `cli/package.json`, `package-lock.json`, `youmd --version`, and the MCP user-agent string all agree on `0.6.2`

## 2026-04-17 — CLI Auth State Hardening + Curl Installer

### CLI / Install / Docs
- Fixed a real CLI auth-state bug where `youmd login --key ...` could save a fresh production key but then try to verify it against stale dev endpoints cached from an older machine config, which produced a misleading 401 and left users looking half-logged-in
- Added `youmd logout` so switching machines or accounts no longer requires hand-editing `~/.youmd/config.json`
- Changed the CLI API/app URL handling to resolve the configured endpoints per request and force fresh browser/key logins back onto the production defaults, which makes the login path much harder to poison with old local test state
- Added a real curl bootstrap path at `https://you.md/install.sh` that installs the latest global CLI, then points users straight at `youmd login` and `youmd init`
- Updated the landing page, docs, in-app help, and README to teach the curl installer as the default CLI entry path and keep npm as the explicit fallback instead of scattering older `npx`-first guidance

## 2026-04-17 — CLI Version Sync For npm Publish

### CLI / Release Ops
- Corrected the CLI package version drift so the repo, lockfile, runtime `youmd --version`, and MCP user-agent string now all agree on `0.6.1`
- Fixed the stale mismatch where `cli/package.json` still said `0.6.0`, `cli/package-lock.json` was left behind at `0.5.0`, and the built CLI still reported `0.6.0`, which could block or confuse the next npm publish attempt
- Rebuilt the CLI after the version sync so the generated `dist/` artifacts now line up with the publish target

## 2026-04-17 — Revealable API Keys + Grouped Pane Navigation

### Web Settings / Shell UX
- Added owner-only reveal support for newly created or rotated API keys, so fresh keys can now be shown and copied again from the settings pane instead of disappearing forever after the first hide
- Kept the secure auth model intact by continuing to authenticate on the SHA-256 key hash while storing a separate encrypted plaintext copy strictly for owner reveal/copy in the UI
- Made the settings copy honest about the migration edge case: older keys created before reveal support stay hash-only and need one rotate to become revealable going forward
- Consolidated the cluttered shell preview tab strip into grouped primary categories with smaller secondary sub-tabs only where needed, which makes the panel navigation feel closer to a normal intuitive product UI instead of a long flat debug rail

## 2026-04-17 — API Key History Panel Cleanup

### Web Settings / Auth Ops
- Fixed the settings pane so active API keys are now the primary view and revoked keys are hidden behind an explicit history toggle instead of cluttering the panel by default
- Confirmed the production account cleanup worked at the data level: the old key pile is revoked history, not dozens of still-live keys
- Softened the fresh-key helper text so it tells users to copy the new key and hide the card when done instead of foregrounding the one-way-storage warning in the main CTA

## 2026-04-17 — API Key Rotation + Cleanup UX

### Web Settings / Auth Ops
- Upgraded the settings pane API-key section to support a cleaner operator workflow: `rotate key` now creates one fresh key, immediately reveals it for copy, and revokes the rest in the same move
- Added a dedicated `revoke all keys` action so users can clean up stale API-key sprawl without nuking share links, access tokens, or their email-login session
- Kept API-key storage hash-only for existing keys and made that explicit in the UI, so the product no longer implies it can magically reveal old plaintext keys that the backend never stored
- Improved the fresh-key follow-through block with explicit copy + hide actions instead of a single dismiss-only CTA

## 2026-04-17 — Simpler CLI Login Flow

### CLI / Docs / Auth UX
- Simplified `youmd login` so the default human path is now obvious: pressing Enter opens browser sign-in, typing an email starts the in-terminal verification-code flow, and `youmd login --key ...` remains the direct agent/automation path
- Kept `--web` as an explicit escape hatch but changed the copy so it opens browser sign-in directly instead of sending users to a vague dashboard-first API-key scavenger hunt
- Updated CLI help text, README quick-start guidance, and docs copy to match the real shipped login contract instead of implying the more confusing legacy flow
- Rebuilt both the CLI and Next app after the login UX pass to confirm the new auth-entry guidance is production-safe

## 2026-04-17 — Shell Turn Lifecycle Hardening

### Shell / Agent UX
- Fixed the shell turn lifecycle so the working indicator no longer disappears on first streamed token while profile saves, private-context writes, memory saves, portrait changes, or publish operations are still running in the background
- Added an explicit planning step plus a live “drafting the response” step so the activity log now reads more like ack → plan → work instead of only showing scrape/save fragments
- Upgraded mutation-heavy completions with a deterministic follow-through block that summarizes what actually changed and proposes the next best moves, which makes the shell feel guided instead of ending on a thin one-liner plus green notices
- Rebuilt the app successfully after the lifecycle hardening pass to confirm the new turn-state logic is production-safe

## 2026-04-17 — Web Shell Thinking Animation Upgrade

### Shell / Progress UX
- Upgraded the web shell thinking indicator so it behaves more like Codex or Claude Code during real work instead of freezing on one stale label
- Kept the braille spinner alive while the agent is working, rotated the main status line through active and recently completed subtasks, and preserved elapsed timing without resetting on every phrase swap
- Added a sweep/shimmer treatment to the active thinking line and running activity labels so the shell looks visibly alive while long-running work is in flight
- Reordered the activity log to keep running work at the top, then errors, then completed steps, which makes real-time progress easier to scan during multi-step tasks
- Rebuilt the app successfully after the shell UX pass to confirm the animation/state changes are production-safe

## 2026-04-17 — Production Shell Verification + Passwordless Sender Hardening

### Shell / Auth / Release Readiness
- Verified the latest GitHub-triggered Vercel deploy reached `Ready` on `www.you.md`, then re-validated the live production session bootstrap path: `/api/auth/session` returns a healthy authenticated user + Convex JWT, and the production Convex logs show the full shell bootstrap stack (`users:getByClerkId`, `profiles:getByOwnerId`, `private:getPrivateContext`, `bundles:getLatestBundle`, memory/session queries) executing successfully
- Re-verified the exact golden-path scaffold behavior against the live authenticated production account: `me:scaffoldProjectDirectories` now cleanly no-ops with `changed: false` because the generated project tree is already present, and the latest published bundle remains `v60`
- Verified the production bundle data really contains the scaffolded `projects/*/{README,context,prd,todo}.md` files rather than only pretending to, which closes the core "it said it wrote files but didn't" trust failure on the live shell path
- Hardened production passwordless email sending so the auth route can use `AUTH_EMAIL_FROM` / `RESEND_FROM_EMAIL` instead of being permanently locked to `onboarding@resend.dev`
- Added a clearer production error message when Resend is still in testing mode, so auth failures now point directly at the missing verified sender configuration instead of surfacing opaque provider text
- Updated the example env file to reflect the real first-party passwordless auth stack and remove stale Clerk-era env guidance

## 2026-04-17 — Deterministic Project Scaffold Fix For Web Shell

### Web Shell / Files / QA
- Fixed the core live shell regression where asking `create my projects directory and subdirectories for each project within my private folder` could stall, lie about writing files, or emit misleading repeated `README/context/prd/todo` notices without actually creating the directory tree
- Added a deterministic scaffold path for that exact golden-path request so the shell now bypasses the fragile LLM mutation flow and writes real `custom_files` entries for per-project `README`, `context`, `prd`, and `todo` files under the synthetic `private/projects/` tree
- Replaced the broken hardcoded internal scaffolder with a generic project-driven implementation that derives project directories from the user's actual bundle/profile data instead of a stale one-off Houston-specific file map
- Verified the exact production repro on `https://www.you.md/shell` with a fresh authenticated session: the prompt now creates the real project subtree, the files pane reflects the new directories, and subsequent runs correctly report that the scaffold is already in place instead of pretending to write again
- Followed with an atomic publish hardening pass so future scaffold saves publish server-side in the same mutation rather than depending on a second client-side publish race
- Confirmed local codegen + app build still pass after the scaffold + publish hardening changes

## 2026-04-17 — Local Browser Re-Verification + Mutation Replay Hardening

### Web Shell / CLI / QA
- Re-ran the local passwordless browser flow after restarting the stale dev server and confirmed the full localhost auth loop still works: send verification, verify code, session cookie, and authenticated `/shell` hydration
- Re-verified the production browser shell path with a fresh real session on `you.md`, then compared CLI chat against the web shell to confirm the CLI still feels cleaner and more grounded
- Fixed a real shell-history bug where completed custom-section mutations were still being sent back into later turns, causing unrelated requests like `fetch website` to re-apply already finished profile updates
- Updated web-shell LLM history to store the final rendered/synthesized assistant completion text instead of only the raw terse model reply, which keeps future turns grounded in what the user actually saw
- Added targeted pruning of resolved mutation turns before building each new shell prompt, which stopped the clean browser-level custom-section replay repro on a fresh disposable account
- Fixed `youmd chat` for piped/non-interactive usage so closed stdin now exits cleanly instead of throwing `ERR_USE_AFTER_CLOSE`

## 2026-04-17 — Deploy Verification + Web-Shell Mutation Reliability

### Web Shell / Auth / QA
- Verified the Vercel deploy for the web-shell parity hardening commit reached `Ready`, and confirmed the live web-domain chat routes (`/api/v1/chat`, `/api/v1/chat/ack`, `/api/v1/chat/stream`) are responding in production
- Fixed a real local web-auth parity bug: when local Next was pointed at a remote Convex deployment, the app could mint `localhost`-issued Convex JWTs that the remote backend rejected with `NoAuthProvider`
- Split local auth-link targeting from JWT issuer semantics so localhost can still be used for verification links/cookies while remote Convex auth continues to use the production issuer
- Fixed a destructive web-shell mutation path where saving custom sections could overwrite `profile.youJson` with only `custom_sections`, effectively wiping the rest of the public identity payload until another full bundle save repaired it
- Moved custom-section persistence onto the same versioned bundle compile/save/publish path as normal shell-written profile updates, so custom sections now preserve the rest of the user's compiled identity state
- Hardened the shell against tool-only non-answers: when the model emits real tool calls but returns empty or ultra-short copy, the UI now synthesizes concrete follow-through text for updates, memories, fetches, and portrait changes

### Audit Notes
- Direct live mutation probes confirmed the model often does the right thing structurally but still under-communicates after tool execution; the shell now patches that gap instead of leaving the user with `on it.` or silence
- A clean browser-level re-test of the local web auth flow is still needed after restarting the stale dev server process that was already running during this continuation pass

## 2026-04-17 — Web Shell Parity Hardening + Chat Surface Unification

### Web Shell / Docs / UX
- Removed a real source of shell sluggishness: the web app no longer waits for the fast `/chat/ack` call to finish before starting the main streamed reply, so responses can start as soon as the real model does
- Added a visible fallback when the model stream dies without text or tool calls, which prevents the shell from leaving users staring at an empty/non-answer turn
- Added same-origin web-domain proxies for `/api/v1/chat`, `/api/v1/chat/ack`, and `/api/v1/chat/stream`, so the shell, docs, and public API story now agree instead of quietly depending on a Convex-only hostname
- Cleaned stale product copy across active surfaces: no more `v0.1.0` auth boot text, no more `redirecting to dashboard...` after sign-in, no more deprecated password auth endpoints in docs, and no more fake `youmd mcp connect` install guidance

### Audit Notes
- Measured the production fast-ack path at roughly 1.1-1.2s and the first streamed token at roughly 1.4-1.5s, which explained why the old shell sequencing felt slower than it should
- Confirmed the deeper remaining release work is transcript-level product quality: tone, proactiveness, real mutation journeys, and local-vs-web parity — not auth plumbing

## 2026-04-16 — Production Passwordless Verification + Legacy Clerk Surface Retirement

### Auth / Reliability / Cleanup
- Hard-verified production passwordless auth on `you.md`: email delivery, verification-code login, cookie-backed session refresh, and authenticated `/shell` hydration all work on the live site
- Hard-verified the production API-key path by issuing a fresh key through the passwordless flow and resolving `youmd whoami` successfully against the live prod backend
- Removed stale Clerk-specific CSP allowances from the active Next.js security headers so production no longer advertises dead third-party auth domains
- Retired the legacy `/api/v1/auth/register`, `/api/v1/auth/login`, and `/api/v1/webhooks/clerk` paths to explicit 410 deprecation responses instead of leaving dead password/webhook infrastructure wired into the repo
- Cleaned active auth copy and comments so the current app describes first-party passwordless auth rather than the retired Clerk model
- Verified both app and CLI builds still pass after the auth-surface cleanup

## 2026-04-16 — Passwordless Auth Migration: First-Party Web + CLI Sign-In

### Auth / Web / CLI
- Replaced the Clerk-first app auth path with first-party passwordless auth built around email verification codes, opaque session cookies, and custom Convex JWT signing
- Added first-party auth/session tables and mutations in Convex (`authChallenges`, `authSessions`) plus JWKS-backed `customJwt` auth config
- Added web auth routes for `send-verification`, `verify-code`, `verify-link`, `session`, `logout`, and `/.well-known/jwks.json`
- Rebuilt `/sign-in` and `/sign-up` as sequential passwordless terminal flows and retired password reset into a redirect to the new sign-in path
- Migrated CLI `register` and `login` from email/password to email-code auth while keeping `--key` as the direct API-key path
- Removed the last live Clerk package dependency from the web app and fixed lingering sign-out / copy references that still described the old auth model

### Infrastructure / Validation
- Fixed `convex/tsconfig.json` with `noEmit` so Convex commands stop regenerating source-adjacent `.js` artifacts and breaking deploy/codegen with duplicate-path errors
- Deployed the auth/schema changes to the dev Convex deployment and synced production Vercel auth env for the new signer/JWKS stack
- Validated the local passwordless route loop end-to-end: signup → code verification → session → logout → login
- Validated CLI auth against the dev backend: `register`, `login`, and `whoami`
- Production browser/dashboard parity has now been hard-verified in the follow-up ship-readiness pass

## 2026-04-16 — Ship Readiness Pass: Authenticated CLI Hardening + Round-Trip Fidelity

### CLI / API / Sync Reliability
- Hard-tested the authenticated production CLI flow against fresh throwaway accounts: `register`, `login`, `login --key`, `whoami`, `init`, `build`, `push`, `pull`, `diff`, `status`, `keys list`, and `sync`
- Fixed CLI auth/account resolution against the real `/api/v1/me` shape by normalizing nested `user` responses instead of assuming only legacy flat fields
- Fixed public-profile ingestion so the CLI correctly parses `application/vnd.you-md.v1+json`, strips web-only `_profile` transport metadata, and fetches the markdown variant for `you.md`
- Fixed `push` so successful publishes persist local publish state, which makes `status` reflect reality instead of continuing to say `publish never`
- Fixed publish → pull → diff round-trip drift by tightening compiler/decompiler defaults, removing scaffold-only decompile output, and preventing empty writing-preferences objects from rendering as fake file diffs
- Fixed sync-state accuracy after `pull` so local and remote hashes now match after a clean production round-trip

### QA Findings
- The local CLI/auth/API path is materially healthier now: fresh-account onboarding and live profile publication work end-to-end against production
- The main remaining release blocker is not the CLI toolchain — it is browser-based auth/web-shell parity, where headless Clerk sign-in still stalls with no surfaced error

## 2026-04-16 — Ship Readiness Pass: MCP Web Proxy + Web-Agent Reliability

### MCP / API / QA
- Added `project-context/SHIP_READINESS_AUDIT_2026-04-16.md` to capture the first real evidence pass across CLI, skills, MCP, API contracts, and web-agent behavior
- Fixed public MCP discovery on the web domain by adding a Next route proxy for `/.well-known/mcp.json`
- Fixed public MCP transport on the web domain by adding a Next route proxy for `/api/v1/mcp`
- Updated `robots.txt` so the MCP discovery and transport URLs are explicitly allowed for agents/crawlers
- Reworked the CLI integration tests to validate the real live production profile contract instead of relying on stale sample-profile usernames and stricter assumptions than prod actually guarantees

### Web Agent Reliability
- Updated the web shell's bundled-skill guidance from the stale 4-skill set to the real shipped 6-skill set
- Promoted portrait updates onto the main `update_profile` tool path with explicit `avatar_url` / `avatar_source` fields, reducing reliance on brittle JSON-block parsing for portrait mutations

## 2026-04-16 — Ship Readiness Planning

### Planning / QA Direction
- Added `project-context/SHIP_READINESS_PLAN.md` to define the next major release-hardening phase across:
  - CLI + skills + MCP hard testing
  - API + MCP endpoint coverage
  - web-agent execution reliability
  - local-vs-web parity
  - agent personality / proactiveness
  - UI/docs truth auditing
- Tracked the new ship-readiness audit as an active request and moved the roadmap/TODO items from vague "test more" language into a concrete multi-workstream plan

## 2026-04-16 — Agent Bootstrap Overhaul + Skill Truth Reconciliation

### CLI / Skill System
- Rebuilt `youmd skill init-project` around a safer bootstrap model:
  - `auto`, `additive`, `zero-touch`, and `scaffold` modes
  - first-class `AGENTS.md` support
  - additive managed bootstrap blocks for existing `AGENTS.md` / `CLAUDE.md`
  - canonical `project-context/` files scaffolded per-file instead of all-or-nothing skipping
  - generated `.you/` layer with `AGENT.md`, `STACK-MAP.md`, and supplemental `.you/project-context/`
- Updated `youmd init` so mature repos can refresh the repo bootstrap instead of being skipped just because `CLAUDE.md` or `project-context/` already exist
- Fixed `youmd skill` argument passthrough so `init-project --mode ...` works correctly through the top-level CLI router
- Added automatic local skill-catalog reconciliation so existing installs pick up newly bundled default skills on upgrade instead of staying pinned to the old 4-skill catalog

### Bundled Skill Truth Pass
- Reconciled the bundled skill system around the real shipped set of 6 local skills:
  - `claude-md-generator`
  - `project-context-init`
  - `voice-sync`
  - `meta-improve`
  - `proactive-context-fill`
  - `you-logs`
- Updated the CLI catalog, backend seed data, MCP skill hints, dashboard SkillsPane, landing copy, onboarding copy, docs page, README, and project metadata so they describe the same shipped behavior instead of drifting across multiple partial truths

### Verification
- `npm --prefix cli run build` passed
- `npm run build` passed
- Smoke-tested `youmd skill init-project` in:
  - a fresh throwaway repo (`scaffold` mode)
  - an existing throwaway repo with pre-existing `AGENTS.md` + `project-context/TODO.md` (`additive` mode)

## 2026-04-16 — Truth Pass + Cross-Agent Stack Sync Planning

### Planning / Product Direction
- Added an explicit pre-implementation truth pass to reconcile what the You.md skill system actually ships versus what the dashboard, README, and docs currently imply
- Captured the need to unify multiple overlapping skill sources of truth: CLI bundled catalog, backend-seeded bundled skills, dashboard UI lists, and on-disk skill markdown files
- Folded the validated cross-agent stack-sync workflow into the product direction so the You.md plan now accounts for:
  - a shared instruction layer
  - a shared skill layer with host-specific mirrors
  - portable overlap settings instead of forced config flattening
  - a persistent stack inventory for future agents
- Clarified that the new bootstrap work should complement platform-side agent/activity visibility and linked host-native skills, not create a second conflicting system

## 2026-04-16 — Bootstrap Strategy Simplification

### Planning / Product Direction
- Simplified the safe integration plan so existing repos use one standard managed bootstrap block instead of trying to vary block size too much based on subjective "minimal vs robust" repo tiers
- Kept the real safety boundary where it belongs: additive bootstrap + missing-file scaffolding can be automatic, but anything more invasive still requires preview plus approval
- Renamed the intended default mode direction from `minimal` toward `additive` to better match the product behavior we actually want

## 2026-04-16 — Agent Operating System Product Direction

### Planning / Product Direction
- Expanded the safe integration strategy to make one product point explicit: `.you/` by itself is not enough, because most agents do not auto-read it and the product only feels magical when top-level agent files are improved safely too
- Defined the intended three-part delivery model:
  - `.you/` as the You.md-owned generated layer
  - tiny additive bootstrap blocks in `AGENTS.md` / `CLAUDE.md` when safe
  - host-specific linked skills/rules for Claude, Codex, Cursor, and future agents
- Added an explicit permission model: additive edits can be automatic in `auto` / `minimal`, but rewrites, deletions, consolidations, and other non-additive changes should require a preview plus approval
- Captured the exact "agent operating system" behaviors You.md should scaffold, including reading `project-context/`, tracking multi-part requests, and treating updates to `TODO.md`, `FEATURES.md`, `CHANGELOG.md`, `feature-requests-active.md`, and `PROMPTS.md` as part of completion
- Documented the main gstack patterns worth borrowing: tiny bootstrap surfaces, host-specific generated artifacts, setup as the magic moment, repo/team bootstrap, and clearly owned generated assets

## 2026-04-16 — Safe Agent Context Integration Strategy

### Planning / Product Direction
- Added `project-context/SAFE_AGENT_CONTEXT_INTEGRATION.md` to define a safer long-term model for how You.md should integrate with existing `CLAUDE.md`, `AGENTS.md`, linked skills, and `project-context/` directories
- Proposed moving from the current blunt append/skip behavior to a tiered system:
  - full scaffold for empty repos
  - minimal bootstrap merge for lightweight repos
  - minimal-touch or zero-touch mode for robust/customized repos
- Recommended a namespaced supplemental context directory (`.you/`) so You.md-generated instructions can stay clearly additive instead of pretending to own the user's handcrafted repo docs

## 2026-04-16 — MCP Launch Hardening for Local Dev + Codex

### MCP / CLI Reliability
- **Fixed Codex startup in the `youmd` repo:** the Codex MCP launcher now uses the local `cli/dist/index.js` build when your working directory is this repo, so developing the CLI/MCP no longer collides with the root app package also being named `youmd`
- **Safe generated MCP config:** `youmd mcp --json` and `youmd mcp --install ...` now emit an explicit published-package launcher instead of bare `npx youmd mcp`, avoiding package-name collisions in monorepos or source checkouts
- **Updated install UX:** dashboard/docs/CLI copy now points people at the safe MCP install command for Claude Code and Cursor
- **Result:** you can dogfood the newest local MCP implementation while building `youmd`, but everywhere else Codex still uses the published npm CLI like a normal user

## 2026-04-15 — QA Sprint: Web Shell Parity + AI Leader Seeding

### Web Shell — Feature Parity with CLI
- **`/history` + `/analytics` routing:** both commands now route to their panes (were missing from `paneCommands` map in `useYouAgent.ts`); `/versions` aliases `/history`, `/stats` aliases `/analytics`
- **`/help` rewrite:** shell help text now lists all 25 commands in 7 sections (identity, sharing, skills, account, data, memory, system)
- **HelpPane:** commands reference completely rewritten with 7 categorized sections + accent-colored headers; added previously missing commands (`/json`, `/files`, `/sources`, `/activity`, `/portrait show`, `/portrait --regenerate`, `/skill use {name}`, `/analytics`, `/history`)
- **SkillsPane:** each skill card now shows a "use in shell" copy button — clicking copies `/skill use {name}` to clipboard with visual confirmation

### Seeding — 20 AI Leader Profiles
- Added `seedAiLeaders` internalMutation to `convex/seed.ts`
- Added `cleanDuplicates` utility mutation
- Seeded 20 top AI founders/influencers in prod (all 20 created, 0 skipped):
  sama, gdb, hwchase17, ylecun, jeremyphoward, emollick, swyx, svpino,
  rileytomasek, danshipper, gregisenberg, linusekenstam, alexandrwang,
  saranormous, clemdelangue, reidhoffman, natfriedman, andrewng,
  darioamodei, ilyasut
- Used GitHub avatars where available (unavatar.io/github/handle)

### Infrastructure
- **Fixed Convex deploy:** removed `"allowJs": true` from `convex/tsconfig.json` — was causing esbuild to pick up both `.ts` and `.js` versions of every file, crashing with "Two output files share the same path"

## 2026-04-15 — Profiles Directory Upgrade + Seeding Plan

### /profiles Page
- **Deduplication:** entries now deduplicated by username in frontend `useMemo` (profiles source wins over legacy); `listAllLegacy` already deduplicates at backend
- **Grid view:** added `ProfileGridCard` component + list/grid toggle (List/LayoutGrid icons) — state persists in session
- **Search expanded:** bio text now included in search filter (was: name, tagline, location only)
- **New filter:** `has-portrait` filter added alongside all/claimed/has-projects
- **Stats line:** header now shows portrait count alongside profile + claimed counts

### Seeding Plan
- Created `project-context/SEEDING_PLAN.md` with:
  - 3-tier target list (Tier 1: 100 AI leaders, Tier 2: 200, Tier 3: 500+)
  - 9-stage pipeline per profile (Perplexity identity → X enrichment → GitHub → website → LinkedIn → compile → ASCII portrait → quality review → publish)
  - Data sources + rate limits (GitHub 60/hr, Apify for LinkedIn, Grok-3-mini for X)
  - Quality standards table per tier
  - Deduplication rules
  - Batch sizes + pacing guide
  - SEO/AEO optimization specs (JSON-LD Person schema, OG, canonical URL, sitemap)

## 2026-04-14 — Agent Tool_Use Fix + Stale Build Cleanup

### Agent Harness — Proper Tool Execution (CRITICAL FIX)
- **Root cause:** Agent was hallucinating actions. Claimed to "scaffold directories" and "update files" without actually calling any mutations. No structured `tools` array was sent to Anthropic API, so the model emitted free-text JSON blocks that were often skipped or malformed.
- **Fix:** Implemented Anthropic `tool_use` in the streaming pipeline end-to-end:
  - `convex/http.ts`: New `transformAnthropicStream()` accumulates `input_json_delta` events and emits `{"tool_use": {...}}` SSE events on block stop; added `update_profile` + `save_memory` tool schemas to Anthropic API call
  - `src/hooks/useYouAgent.ts`: `callLLMStreaming` now returns `{ text, toolCalls }`; callers extract updates/memories from tool calls directly rather than regex-parsing JSON blocks; OpenRouter fallback still uses JSON block parsing for backwards compatibility
  - `src/hooks/agent-utils.ts`: System prompt updated to instruct agent to use tools as primary mechanism
- **Also fixed:** Removed stale compiled `.js` files from `convex/` that were conflicting with fresh Convex bundle and blocking all deployments

## 2026-04-14 — Top 5 Priority Sprint

### Chat Agent Reliability
- **Streaming init:** greeting now streams token-by-token instead of waiting for full response (switches from `callLLM` → `callLLMStreaming` in `initConversation`)
- **Faster responses:** reduced `max_tokens` from 4096 → 1500 (streaming endpoint) and 4096 → 2048 (non-streaming). Agent is meant to be concise — large token limits were generating unnecessary latency.

### MCP Server (Priority 4 — NEW)
- **Full MCP endpoint:** `/api/v1/mcp` — JSON-RPC 2.0 compliant Model Context Protocol server
- **Tools:** `get_identity(username)`, `search_profiles(query?)`, `get_my_identity` (auth required)
- **Resources:** `identity://{username}` resource type
- **Discovery:** `GET /.well-known/mcp.json` returns server capabilities + endpoint URL
- **Discovery ping:** `GET /api/v1/mcp` returns server info
- Claude Code, Cursor, Windsurf can now connect to you.md as an MCP server

### Portrait in Chat
- **`/portrait show` command:** renders the user's current avatar and all scraped social images inline using `![platform](url)` markdown (rendered by TerminalBlocks as real images)
- Shows which source is active and prompts to switch

### CLI → Web Sync
- **avatarUrl sync:** portrait endpoint (`POST /api/v1/me/portrait`) now also patches `avatarUrl` from `portrait.sourceUrl` when profile has no avatar — CLI-generated portraits now appear as profile photo on web
- **`updateProfile` httpAction compat:** added `_internalAuthToken` bypass so httpActions can call it without Clerk JWT

## 2026-03-27 — Identity-Aware Skill System

### CLI Skill System (Phase 1-5 complete)
- **New command:** `youmd skill` with 12 subcommands (list, install, remove, use, sync, add, push, link, init-project, improve, metrics, search)
- **Skill catalog:** YAML-based catalog (`youmd-skills.yaml`) with scope, identity_fields, version tracking
- **Template engine:** `{{var}}` interpolation resolves against live identity data (profile, preferences, voice, directives)
- **4 bundled skills:** claude-md-generator, project-context-init, voice-sync, meta-improve
- **Agent linking:** Claude Code (.claude/skills/youmd/), Cursor (.cursor/rules/youmd.md), Codex targets
- **init-project compound command:** CLAUDE.md + project-context/ + .claude/skills/ in one shot
- **CLAUDE.md merge:** Appends identity section to existing CLAUDE.md files instead of skipping
- **Cross-project sync:** push/pull/sync auto re-interpolate installed skills on identity changes
- **Meta-improvement:** Identity coverage bars, unused skill detection, actionable proposals
- **Metrics tracking:** Usage counts, identity field references, install history
- **Batch operations:** `youmd skill install all` / `youmd skill remove all`
- **npm packaging:** Skills shipped with package via cli/skills/

### CLI Polish
- BrailleSpinner personality labels on build, skill, and all async commands
- Status command shows skills count, identity coverage bar, voice/ directory tree, actionable recommendations
- Push completion shows "what's next" recommendations
- Build command uses BrailleSpinner (was basic Spinner)
- Onboarding flow offers skill init-project after project detection

### Web Dashboard
- **New:** SkillsPane — skills tab in dashboard with catalog, CLI commands, how-it-works, scope explanation
- **New:** `/skills` slash command in CommandPalette + help text
- **New:** "skills" tab in desktop + mobile nav

### Files
- 13 new files (4 CLI lib, 1 command, 4 bundled skills, 4 source skills)
- 13 modified files (6 CLI commands, 2 CLI lib, 1 CLI config, 3 web components, 1 web hook)
- 1 new dependency: js-yaml

## 2026-03-26 — Project Context & Agent Self-Improvement Overhaul

### New Files Created
- **ARCHITECTURE.md** (~200 lines) — complete system diagram, all 17 Convex tables documented, 30+ API endpoints, auth flows, pipeline architecture, CLI structure, deployment reference
- **CURRENT_STATE.md** (~150 lines) — what's deployed and working, known issues, what was built March 24-25, next priorities in Houston's order
- **PRD.md** (~300 lines) — full product requirements rewrite: vision, target users, 4 core journeys, product surfaces, You Agent spec, design system, data model, security model, success metrics, roadmap

### Files Rewritten
- **CLAUDE.md** (~400 lines) — complete operating manual: Houston's profile/working style, quality bar, message handling protocol, 10 common mistakes, design system, tech stack with versions, project structure, session protocol, architecture quick reference
- **TODO.md** (~250 lines) — cleared all stale items, added March 24-26 work, organized into COMPLETED / NEEDS VERIFICATION / IN PROGRESS / UP NEXT / BLOCKED / FUTURE
- **feature-requests-active.md** (~150 lines) — 38 tracked requests with status, source, verification criteria

### Files Updated
- **FEATURES.md** — added 16 recently completed features, expanded CLI from 12 to 20 commands, updated backlog

### Memory Consolidation
- Created `feedback_cli_comprehensive.md` — consolidated 5 separate CLI feedback files
- Created `feedback_common_mistakes.md` — 10 failure patterns compiled from all feedback
- Expanded `user_houston.md` — full profile with working style, pet peeves, collaboration guidelines
- Updated `project_youmd.md` — exact dependency versions, current architecture summary
- Rebuilt `MEMORY.md` index — all 15 files listed, organized by type, superseded files noted

---

## 2026-03-25 — CLI Alive UX + Email Auth + Portrait System

### CLI UX Overhaul
- **BrailleSpinner color rotation** — spinner rotates through orange shades like Claude Code
- **Text lightsweep effect** — brightness sweep across active text characters
- **ASCII YOU logo** — block-char logo renders in burnt orange on youmd init
- **ASCII portrait in terminal** — renders user's portrait after first social handle
- **Multi-select UI** — arrow keys + right-to-select for agent/tool selection
- **Personality-rich spinner labels** — "computing your main character energy...", "downloading your online soul..."
- **Proper word-wrap** — terminal-width-aware text formatting, left-aligned, paragraph spacing

### CLI Passwordless Auth
- **youmd login** — browser sign-in, email-code login, or direct API key auth
- **youmd register** — create account from CLI with email verification
- First-party passwordless auth now replaces the old Clerk password endpoint model
- API tokens now reserved for agent/app access only

### CLI → Web Improvements
- **Prod Convex fix** — CLI was hitting dev instead of prod (401 on all keys)
- **Richer profile cards** — directory shows bio, projects, social links
- **Nav avatar** — uses duotone photo instead of unreadable tiny ASCII
- **Markdown rendering** — profile page no longer shows raw **bold** or # headings

### Portrait System
- **Server-side generation** — convex/portrait.ts generates ASCII portraits on server
- **DB caching** — portraits cached in profiles.asciiPortrait
- **Portrait pane wired** — real data, flow consolidation, dead code cleanup

---

## 2026-03-24 — Intelligent Model Routing & Portrait System

### Model Routing
- **Named model config** — `MODELS` map in chat.ts routes tasks to the right model: Claude Sonnet 4.6 for chat, Perplexity Sonar for research, Sonar Pro for identity verification, Grok-3-mini for X enrichment, Haiku for summaries/classification
- **Identity verification** — new `verifyIdentity` action uses Perplexity Sonar Pro to cross-reference scraped profiles and confirm they belong to the same person. Returns confidence score, matching signals, and discrepancies
- **Parallel execution** — verification runs alongside research during scraping, both injected into agent context for informed conversation
- **HTTP endpoint** — POST /api/v1/verify-identity for external use

### Portrait System
- **Multi-image storage** — ALL scraped images saved to `socialImages` field (x, github, linkedin, custom). Previously only saved the best one to avatarUrl
- **Tap-to-select** — click any source image in PortraitPane to make it primary. Calls `setProfileImages` mutation
- **Real photo + ASCII** — each source shows actual photo preview alongside ASCII conversion
- **4 ASCII formats** — Classic ($@B%...), Braille (⣿⣷⣶⣦⣤), Block (█▓▒░), Minimal (@%#*+=-:.)
- **Detail picker** — 60/80/100/120/160 column presets. Default bumped to 120 (was 80)
- **Format picker** — grid selector for switching between ASCII formats in real-time
- **Public profile** — now renders at 120 columns desktop / 60 mobile (was 60/40)

---

## 2026-03-24 — Agent Directives & Proactive Agent UX

### Agent Directives (directives/agent.md)
- **New bundle section** — `directives/agent.md` gives any AI behavioral instructions for how to interact with the user: communication style, pet peeves (negative prompts), default tech stack, decision-making framework, and current goal
- **Compiled into youJson** — `agent_directives` object with `communication_style`, `negative_prompts`, `default_stack`, `decision_framework`, `current_goal`
- **Compiled into youMd** — human-readable "Agent Directives" section
- **Share block integration** — context links now include directive summary so agents get behavioral instructions immediately
- **Proactive extraction** — agent observes how users communicate and infers directives without being asked (short answers = concise preference, technical language = skip explanations)
- **Progressive depth updated** — L2 questions now include stack and communication preferences, L3 includes pet peeves and decision framework

### "Always Building" Agent UX
- **"building" thinking category** — 10 new thinking phrases for when the agent is constructing identity primitives, encoding preferences, structuring directives
- **More granular activity simulation** — 7 sub-steps during LLM wait (vs 3), with tighter intervals (1.5s, 3.5s, 6s, 9s, 13s, 18s, 24s) so the UI never feels static
- **Faster phrase rotation** — thinking phrases rotate every 2.5s (was 3.5s) for a more dynamic feel
- **Category-aware rotation** — each simulated sub-step rotates both the phrase AND category, so the thinking indicator shows contextual work (discovery -> analysis -> identity -> building)
- **soul.md "Always Building" philosophy** — agent now acts on inferences immediately instead of asking permission for obvious updates
- **Proactive update language** — "adding that to your projects now" instead of "want me to add that?"

---

## 2026-03-24 — Real-Time Progress Indicators (Claude Code-style)

### Activity Log System
- **ActivityLog component** — Claude Code-style step-by-step progress display showing what the agent is doing in real-time (fetching sources, researching context, generating response, saving updates, publishing)
- **ProgressStep tracking** — each async operation (scrape, research, LLM call, save, publish) gets its own progress step with running/done/error status and elapsed time
- **ThinkingIndicator enhanced** — now shows the activity log underneath the thinking phrase when steps are active
- **Typewriter effect** — latest assistant message streams in character-by-character with a blinking cursor for a natural terminal feel
- **Init flow progress** — session initialization (auto-scrape, auto-research, greeting generation) now shows step-by-step progress instead of going silent
- **Per-source scrape tracking** — each source being scraped gets its own progress line that completes independently as results come in

### UX Improvements
- Users always see exactly what the agent is working on — no more silent waiting
- Progress steps show elapsed time per operation
- Failed steps clearly marked with error indicator
- Steps auto-clear after completion with a brief delay to show final state

---

## 2026-03-24 — Dashboard Simplification & Share UX

### Dashboard Tab Consolidation (12 -> 4)
- **ProfilePane** — merged preview + portrait into single identity view
- **EditPane** — thin wrapper with sub-tabs for files, json, sources
- **SharePane** — NEW hero pane: publish status, agent-specific prompt templates (Claude/ChatGPT/Cursor/Copilot/Universal), one-click copy of link + prompt, context link generation + management, agent activity stats
- **SettingsPane** — merged account, api keys, billing, activity log, help/commands reference into single scrollable pane

### Share UX Improvements
- **Agent-specific prompt templates** — select Claude, ChatGPT, Cursor, Copilot, or Universal and get a tailored prompt with your identity link
- **One-click copy** — prominent "copy prompt + link" button copies the full share block to clipboard
- **Expiring link generation** — generate scoped 7-day context links directly from the Share pane
- **/share command** — now also switches to Share pane for visual confirmation
- **/publish command** — switches to Share pane (was separate publish pane)

### Terminal Command Updates
- All legacy slash commands (/preview, /agents, /billing, /tokens, /activity, /portrait) still work via aliases
- /help text updated to reflect new 4-tab structure
- /profile, /edit, /share as new primary navigation commands

---

## 2026-03-22 — Memory System v2 (Full Brain)

### Memory Recall
- **Agent context injection** — recent memories (up to 50) are injected into the agent's system prompt, grouped by category, enabling personal and contextual responses
- **buildProfileContext() enhanced** — now accepts optional memory array and formats it for the agent

### Memory Commands
- **/memory** — shows memory summary with category breakdown, switches to files pane
- **/recall** — shows 10 most recent memories
- **/recall {query}** — searches memories by content, category, or tags
- **Help text updated** — /files, /memory, /recall added to /help output

### Memory Search UI
- **Search bar in vault** — filter files and memories by content or path
- **Filtered file count** — shows "X/Y files" when search is active

### External Agent Memory API
- **GET /api/v1/me/memories** — list memories (supports ?category and ?limit params)
- **POST /api/v1/me/memories** — save memories from external agents (requires agentName)
- **convex/memoryApi.ts** — dedicated query/mutation for external agent access

### Session Summaries
- **Auto-summarization** — every 10 messages, the session is summarized via Claude Haiku
- **convex/chat.ts summarizeSession** — lightweight action using Haiku for cost-efficiency
- **Summaries stored** — saved to chatSessions table, visible in sessions/history.md

### Memory Archival
- **archiveStale mutation** — configurable max age (default 90 days) and max active count (default 200)
- **Soft delete** — archived memories are hidden but not deleted

### CLI Memory Sync
- **`youmd memories list`** — list all memories, optionally filter by category
- **`youmd memories add <category> <content>`** — manually add a memory with optional --tags
- **`youmd memories stats`** — show memory count by category
- **API client** — listMemories() and saveMemories() added to cli/src/lib/api.ts

### Files
- `convex/memoryApi.ts` — new: external agent memory queries/mutations
- `convex/memories.ts` — added archiveStale mutation
- `convex/chat.ts` — added summarizeSession action
- `convex/http.ts` — added GET/POST /api/v1/me/memories routes
- `cli/src/commands/memories.ts` — new: CLI memories command
- `cli/src/index.ts` — registered memories command
- `cli/src/lib/api.ts` — added listMemories, saveMemories
- `src/hooks/useYouAgent.ts` — memory recall, /memory + /recall commands, session summaries
- `src/components/panes/FilesPane.tsx` — search bar, filtered file tree

## 2026-03-22 — Memory System (Unified Brain)

### New Feature: Persistent Memory
- **Auto-capture from chat** — agent detects facts, insights, decisions, preferences, context, goals, and relationships worth remembering and saves them automatically via `memory_saves` JSON blocks
- **Session tracking** — each browser session gets a unique ID, message counts are tracked, sessions appear in vault under `sessions/history.md`
- **Memory files in vault** — memories grouped by category appear as read-only .md files (memory/facts.md, memory/insights.md, etc.) with an index file
- **7 memory categories** — fact, insight, decision, preference, context, goal, relationship — each with tags and source tracking
- **Multi-source support** — memories can come from you-agent, CLI, or external agents (via access tokens)

### Schema
- `memories` table — userId, category, content, source, sourceAgent, tags, sessionId, isArchived
- `chatSessions` table — userId, sessionId, surface, summary, messageCount

### Files
- `convex/memories.ts` — full CRUD: saveMemories, listMemories, getMemoryStats, archiveMemory, updateMemory, upsertSession, listSessions
- `convex/schema.ts` — added memories + chatSessions tables with indexes
- `src/hooks/useYouAgent.ts` — parseMemorySavesFromResponse(), session tracking, memory system prompt section
- `src/lib/decompile.ts` — generateMemoryFiles() for vault display
- `src/components/panes/FilesPane.tsx` — queries memories + sessions, shows in file tree

## 2026-03-22 — Markdown File System (Vault)

### New Feature: Files Pane
- **File tree browser** — view your entire identity bundle as a file system (profile/, preferences/, voice/ directories)
- **Inline markdown editor** — click any .md file to view and edit it directly
- **Decompiler utility** — converts youJson back into individual markdown files with frontmatter
- **Recompiler utility** — parses edited markdown files back into patched youJson
- **Save/discard workflow** — save edits as a new bundle version, or discard changes
- **`saveYouJsonDirect` mutation** — new Convex mutation that accepts patched youJson, recompiles youMd/manifest, syncs to profiles table
- **Slash commands** — `/files` and `/vault` switch to the files pane from terminal
- **Read-only compiled outputs** — you.md, you.json, and manifest.json shown but not directly editable

### Files
- `src/lib/decompile.ts` — bundle decompiler (youJson -> VirtualFile[])
- `src/lib/recompile.ts` — markdown recompiler (edited files -> patched youJson)
- `src/components/panes/FilesPane.tsx` — file tree + editor pane component
- Modified: `src/hooks/useYouAgent.ts` — added "files" to RightPane type + slash commands
- Modified: `src/app/dashboard/dashboard-content.tsx` — wired FilesPane into dashboard
- Modified: `convex/me.ts` — added saveYouJsonDirect mutation

## 2026-03-21 — Navigation Consistency Overhaul

### Navigation
- **Unified SiteNav component** — replaces AppNav side-panel with a consistent, compact top bar across all authenticated pages (including dashboard)
- **Dashboard navigation** — dashboard now has persistent nav links to home, profile, profiles, docs (was previously isolated with no way to navigate out)
- **Removed duplicate sign-out** — sign out now lives in the top nav bar; removed redundant sign-out from dashboard status bar
- **Cleaned up unused components** — deleted duplicate Navbar.tsx (was unused), deleted unused NavLink.tsx
- **Terminal aesthetic preserved** — monospace typography, 1px borders, `> active` indicators, burnt orange accent for active state

## 2026-03-21 — Agent Personalization, Auto-Scraping, UI Consistency Pass

### Agent Intelligence
- **Auto-scrape on session init** — returning users with links in their profile get auto-scraped before the first LLM greeting, so the agent greets with real, specific context
- **Auto-research for sparse profiles** — Perplexity web research triggers for new/sparse users with a display name
- **Smarter profile image selection** — prefers LinkedIn > GitHub > X when selecting avatar from scrape results
- **Real scraping integration** — LinkedIn via Apify, X/GitHub via scrape endpoint, Perplexity research — all injected into conversation as real data
- **System prompt rewrite** — capabilities section, honest about what it can/can't do, structured output format, private content handling

### UI/UX Consistency
- **Shared pane primitives** — PaneSectionLabel, PaneDivider, PaneHeader, PaneEmptyState (eliminates 5+ duplicate implementations)
- **Border radius standardized to 2px** across entire app (was 4px/8px in many places)
- **Pricing section** — terminal-panel styling with 3-dot headers (was rounded cards)
- **PublishPane** — wired to real Convex data (listRecentBundles query replaces mock data)
- **All pane headers, section labels, dividers** — now consistent across Settings, Billing, Sources, Portrait, Agents, Activity, Help, Publish

### Mobile Responsiveness
- **Public profile** — avatar stacks vertically on mobile (smaller 40-col ASCII), responsive padding, centered text
- **Dashboard status bar** — now visible on mobile (compact 10px text)
- **Pane tabs** — larger touch targets, scroll fade hint for hidden tabs
- **Section spacing** — responsive mb-8/mb-10 instead of fixed values

### Dashboard
- **Persistent AppNav** — side panel for logged-in users on all pages
- **Claude Code-style thinking** — pulsing dot, category icons, elapsed timer
- **Terminal-style messages** — monospace rendering with markdown support
- **Chat input** — fixed iOS auto-zoom, added send button

### Infrastructure
- **listRecentBundles** query added to convex/bundles.ts
- **Auto-publish** on every bundle save (no manual /publish needed)
- **Profile sync** — saveBundleFromForm also updates profiles table

## 2026-03-20 — Identity System Unification + Private Layer + Docs

### Architecture
- **Profiles decoupled from auth** — profiles can exist without a user account
- **Unified identity system** — `profiles` is now the canonical table; `users` is auth-only
- When a user signs up, auto-creates or claims a profile entry
- Session-based profile claiming: `/create` sets cookie, `/initialize` claims on sign-up
- Context links are now profile-aware (profileId stored alongside userId)

### Private Layer + Security
- **privateContext table** — owner-only data (private notes, projects, internal links, calendar, investment thesis)
- **accessTokens table** — SHA-256 hashed tokens with scopes (read/write), expirable, revocable
- **securityLogs table** — audit trail for all profile events (created, claimed, reported, tokens)
- **profileReports table** — abuse reporting with 5 reason types
- **profileVerifications table** — multiple verification signals per profile
- Token validation endpoint: external agents validate tokens, get profile + private context based on scopes

### New Pages
- **`/create`** — no-auth profile creation (pick username, name, profile created instantly)
- **`/profiles`** — directory page listing all profiles from both systems
- **`/docs`** — terminal-styled documentation (getting started, /share, CLI, API, privacy, commands)

### Share Flow
- **`/share` command** — creates context link, generates copyable block, auto-copies to clipboard
- **`/share --private`** — includes private context for trusted agents
- Share block designed for pasting into any AI conversation

### UI Overhaul
- Centered terminal panels with colored dots (red/yellow/green) on auth, initialize, 404 pages
- Blinking block cursor (█) on terminal inputs
- Dashboard uses same TerminalHeader as other pages
- Profile page fully migrated to terminal design tokens
- Landing page CTAs point to `/create` instead of `/sign-up`
- ClaimBanner + ReportDialog components for unclaimed profiles
- 6 new shell panes: Sources, Portrait, Publish, Agents, Activity, Help
- Mobile keyboard scroll fix (100dvh + scrollIntoView)
- Orange focus ring killed on all terminal inputs

### Agent Personality
- Categorized thinking phrases (discovery, analysis, identity, portrait, sync)
- Progressive questioning depth (L1-L4) in system prompt
- Source-aware reactions in system prompt
- soul.md + agent.md deep rewrite — definitive personality specification
- CLI system prompts updated to match web agent

### CLI (v0.3.0)
- Upgraded onboarding + chat system prompts (proactive, concise, witty)
- Description: "your identity file for the agent internet"

## 2026-03-19 — Terminal-First UI Architecture
- **No more forms.** Dashboard is now split-screen: 35% terminal + 65% preview pane
- New `/initialize` route: auto-claims username, runs boot sequence, launches onboarding agent
- Extracted `useYouAgent` hook from 913-line chat-content.tsx — shared across all terminal UIs
- Terminal components: TerminalShell, MessageBubble, ThinkingIndicator, TerminalInput, TerminalStatusBar
- Right pane system: ProfilePreviewPane, SettingsPane, TokensPane, BillingPane, JsonPane
- Slash commands switch panes: /preview, /settings, /billing, /tokens, /json, /publish, /status, /help
- Sign-up flow: signup → /initialize (auto-boot) → agent conversation → /dashboard
- Deleted old form-based dashboard (1100 lines), chat page (913 lines), claim form (133 lines)
- Mobile responsive: terminal full-width with toggle button for preview pane
- All /claim links → /sign-up, middleware updated for /initialize

## 2026-03-19 — Design System Migration (PRD v2.3)
- Complete visual rebrand: monochrome + burnt orange (#C46A3A)
- Ported 20+ components from Lovable prototype
- PixelYOU canvas logo, ASCII portrait system
- 12-section landing page with glass nav, boot sequence, typewriter
- JetBrains Mono + Inter typography (replaces Geist)
- Dark mode default, theme toggle with .light class
- Terminal panels replace all card components

## 2026-03-18 — PRD v2.3 Defined
- ASCII portrait as signature visual identity
- PixelYOU canvas logo specification
- Complete style guide integrated into PRD §15
- Glass nav with --flag navigation
- Boot sequence animation spec
- Profile page as "live identity surface"

## 2026-03-17 — 4 Iteration Cycles
- Iteration 1: UI components (Toast, Spinner, CopyButton), web chat agent, Clerk styling, accessibility
- Iteration 2: Mobile hamburger menu, pricing section, FAQ, dashboard tabs, Cmd+S shortcut
- Iteration 3: Visual consistency, hover states, transitions, CLI 72 thinking phrases
- Iteration 4: Final verification, BlurText fix, copy review

## 2026-03-17 — Conversational CLI Agent (PRD v2.0 §4.6)
- Complete rewrite of onboarding (1014 lines)
- Website fetching during onboarding with LLM commentary
- 50+ themed thinking phrases
- youmd chat command (522 lines) with slash commands
- LLM chat proxy via Convex (no user API key needed)

## 2026-03-16 — Full Stack Foundation
- Milestone 0-3 code complete
- Next.js + Convex + Clerk + Tailwind
- Ingestion pipeline (fetch, extract, analyze, compile)
- API keys, context links, HTTP API
- CLI published on npm (youmd)
- Vercel + Convex production deployments
- GitHub repo synced

## 2026-03-16 — Project Inception
- PRD v2.0 received from founder
- Initial project scaffolding
- Convex schema (10+ tables)
- First commit
