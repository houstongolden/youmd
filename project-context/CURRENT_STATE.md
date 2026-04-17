# You.md — Current State

Last Updated: 2026-04-16
Last Commit: b95bf6a (2026-04-16)

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
- Markdown file vault (browse, edit, save identity files)
- Memory system (auto-capture, recall, search, /memory + /recall commands)
- Session persistence (messages survive page refresh)
- Agent directives (proactive inference of communication preferences)
- Portrait system (multi-source, format/detail picker, tap-to-select primary)
- Share pane (publish, context links, agent-specific prompt templates, stats)
- Activity/security logs wired to real Convex data
- Sources pane with real mutations (add URL, view status, pipeline stats)
- Files pane with keyboard shortcuts (Cmd+S), markdown preview, create new file

### CLI (youmd v0.6.0 — npm publish pending)
- 21 commands (added `skill` with 19 subcommands)
- Skill system: install, remove, use, sync, create, publish, browse, link, init-project, improve, metrics, export, info, remote
- CLI ↔ Convex skill sync (installs, usage, and removals auto-sync to server)
- Conversational AI onboarding with BrailleSpinners, ASCII logo, portrait rendering
- Passwordless email-code auth (no API token required for your own account)
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
- Remaining cleanup is mostly product/documentation follow-through: broader web-agent behavior/personality QA and removing stale Clerk-era references from lower-priority internal comments

### Portrait Sync
- CLI generates ASCII portraits locally but sync to web API is not verified end-to-end
- Profile images scraped locally may not persist to server storage on push
- Portrait data structure exists in profiles table but upload path needs verification

### Agent Intelligence
- You Agent sometimes gives generic responses (personality needs tuning)
- Session compaction triggers at 120k chars but summary quality varies
- Stale source detection warns at 7 days but doesn't auto-refresh
- Agent sometimes says "the system handles that" instead of acting directly

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
