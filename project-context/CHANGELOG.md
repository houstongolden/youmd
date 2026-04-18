# You.md — Changelog

## 2026-04-18 — `you`-First Install + Onboarding Copy

### CLI / Install / DX
- Tightened the first-run guidance around the new launcher so the product now consistently teaches `you` as the main "meet U" path once a bundle exists
- Updated the curl installer next-steps output, CLI register success copy, example-init next steps, and conversational onboarding next-step block so they no longer over-index on `youmd chat`
- Updated the README quickstart and command table to introduce `you` explicitly as the alive terminal entrypoint instead of burying it beneath the older explicit chat command

## 2026-04-18 — Truthful `you` Startup + Public Portrait Contract Fix

### CLI / Portrait / Agent UX
- Upgraded the `you` launcher from a stylish bluff into a truthful wingman entrance: after the YOU logo and portrait-in-code, U now keeps a live braille spinner running while it actually checks local guidance, nearby AGENTS / CLAUDE files, and project-context signals before it talks
- Added a concrete finding pass to that startup flow, so the launcher now tells you what it actually found instead of implying it already looked around with no evidence
- Tightened the terminal bot / portrait encounter copy so the last line now points at real active work — "i'm taking a lap through your recent work" — rather than acting like a static joke
- Fixed a contract bug that was blocking portrait parity: the CLI wrapper for `/api/v1/profiles` was stripping `_profile` metadata out of the returned `youJson`, which meant the launcher could not actually see the public profile metadata it was trying to prefer
- Extended the public profile payload with `_profile.asciiPortrait`, then taught the CLI portrait resolver to prefer the current profile-selected portrait data over stale cached avatar fallbacks, which is the foundation for making the startup face match the public profile instead of a long-lived X/GitHub fallback
- Bumped the next CLI publish target to `0.6.6` so the version bump is already handled before the next npm publish prompt reaches Houston

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

### CLI Email/Password Auth
- **youmd login** — email + password (no API token needed for own account)
- **youmd register** — create account from CLI with email verification
- **POST /api/v1/auth/login** and **POST /api/v1/auth/register** — Clerk Backend API endpoints
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
