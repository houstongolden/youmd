# You.md — Build Progress & Roadmap

Last Updated: 2026-04-17
PRD Version: 2.3

---

## COMPLETED

### 2026-04-17
- [x] Make newly minted API keys revealable/copyable again without weakening hash-based auth validation
- [x] Hide revoked API key history behind an explicit toggle so the settings pane defaults to the real live-key state
- [x] Consolidate the shell preview pane nav into grouped primary labels with small secondary tabs where needed
- [x] Normalize the CLI publish version to 0.6.1 across package.json, package-lock, runtime version output, and built artifacts

### Foundation (March 16-17)
- [x] Next.js 16 + Convex + Clerk + Tailwind v4 scaffold
- [x] Full Convex schema (21 tables)
- [x] Clerk auth (production: clerk.you.md)
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
- [x] Identity-aware template engine ({{var}} → identity data)
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
- [x] Bundled skill set expanded and reconciled to 6 shipped skills: `claude-md-generator`, `project-context-init`, `voice-sync`, `meta-improve`, `proactive-context-fill`, `you-logs`
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

- [ ] Execute the ship-readiness plan across CLI, MCP, API, web-agent reliability, parity, and personality
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
- [ ] Switch the published `youmd` CLI from the disposable test account to Houston's real account and save the new agent-session behavior preferences into his durable identity context
- [x] Simplify `youmd login` so the default flow offers browser sign-in on Enter, email-code login in-terminal when an email is typed, and `--key` as the explicit direct-auth path
- [x] Add sane API-key operator UX in settings: rotate one fresh key, bulk revoke all API keys, and copy the newly issued key without touching unrelated token types
- [x] Hide revoked API-key history behind an explicit toggle so the default settings view shows the real active-key state
- [x] Fix stale CLI auth state so `youmd login --key ...` stops verifying production keys against cached dev endpoints and add an explicit `youmd logout` escape hatch
- [x] Add a curl-first installer at `you.md/install.sh` and update hero/footer/docs/help to teach curl as the default CLI install path with npm as fallback
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
- [ ] Show ASCII portrait in web chat when switched or created
- [ ] Conversational portrait management working end-to-end
- [ ] Custom sections via agent conversation (flexible, not rigid 13 sections)

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
