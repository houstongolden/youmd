# You.md — Current State

Last Updated: 2026-04-18
Last Commit: see git log for latest 2026-04-18 `you` launcher + proactive portrait continuation

---

## What's Deployed and Working

### Web App (you.md via Vercel)
- Landing page with all 12 sections
- Terminal-style auth (sign-in, sign-up, reset-password) — sequential prompts, no forms
- Dashboard with 35/65 terminal split, 4-pane system (profile, edit, share, settings)
- Public profile pages with SSR, JSON-LD, OG cards, breadcrumbs
- Profiles directory with search/filter
- Docs page with Claude Code integration guide
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
- Deterministic shell project scaffolding for the `create my projects directory...` golden path, with real `private/projects/*` files now verified on production
- Shell pane navigation is now grouped into clearer primary buckets with secondary sub-tabs where needed instead of exposing the full flat tab sprawl on desktop and mobile

### CLI (youmd v0.6.8 — ready to publish)
- 21 commands (added `skill` with 19 subcommands)
- Skill system: install, remove, use, sync, create, publish, browse, link, init-project, improve, metrics, export, info, remote
- CLI ↔ Convex skill sync (installs, usage, and removals auto-sync to server)
- Conversational AI onboarding with BrailleSpinners, ASCII logo, portrait rendering
- Passwordless email-code auth (no API token required for your own account)
- `youmd login` now clearly splits the auth paths: press Enter for browser sign-in, type your email for in-terminal code login, or use `--key` for direct agent auth
- Install/login/register/init/onboarding copy now consistently points users toward `you` as the main "meet U" terminal path once they have an identity bundle, instead of over-indexing on `youmd chat`
- `youmd logout` now exists and clears stale local auth state from `~/.youmd/config.json`
- CLI auth now forces production defaults for `apiUrl` / `appUrl` on fresh logins and resolves those URLs per request instead of caching a stale dev endpoint at process start
- npm publish retry path is fixed: the next release target is `0.6.8`, package metadata is normalized, and the built CLI + MCP user-agent now match that version cleanly
- Bare `youmd` now enters like U instead of dropping straight into a dry command list: it shows the YOU logo, optionally shows the saved portrait preview, greets the user, surfaces project-context opportunities, and proposes the next best moves contextually
- `youmd chat` now opens with the same U-style entrance and no longer prints the first assistant greeting twice when streaming succeeds
- The npm install moment is now less deadpan: postinstall prints a real U-style welcome with logo + next moves instead of the old `Run: youmd init`
- A real `you` launcher now exists alongside `youmd`: if the user is authenticated and has a bundle in either the current project or `~/.youmd`, `you` goes straight into chat instead of forcing `youmd chat`
- The new `you` opening renders the YOU logo, the user's ASCII portrait-in-code, a small terminal bot greeting the portrait, and a more proactive U intro so the local entry feels more like meeting a wingman than a utility binary
- The `you` opening now runs a real local-context investigation before speaking: a live braille spinner stays active while U checks bundle guidance plus nearby AGENTS / CLAUDE / project-context signals, then U reports concrete findings instead of pretending it already looked around
- The launcher now scans recent project contexts for actual openings instead of only listing project names, and that recent-project scan now falls back to `~/.youmd/projects` even when `you` is launched from arbitrary directories like `/tmp`
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

### Backend (Convex — kindly-cassowary-600)
- 21-table schema fully deployed (added skills + skillInstalls)
- 38+ HTTP API endpoints (added 9 skill endpoints)
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
- The published npm package on npm is still behind the repo; the latest CLI fixes in this repo are now `0.6.8` and need one more npm publish before end users get the `you` launcher, portrait splash, truthful startup investigation, update hints, public-profile portrait contract fix, active-bundle fallback on read-only commands, raw-markdown roundtrip preservation, and recent-project opportunity scanning from arbitrary directories

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
- Next.js 16.1.6 has moderate vulnerabilities (upgrade to 16.2.2 pending testing)
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
