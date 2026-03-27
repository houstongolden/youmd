# You.md — Current State

Last Updated: 2026-03-27
Last Commit: 4e952ec (2026-03-27)

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

### CLI (youmd v0.5.0 — npm publish pending)
- 21 commands (added `skill` with 19 subcommands)
- Skill system: install, remove, use, sync, create, publish, browse, link, init-project, improve, metrics, export, info, remote
- CLI ↔ Convex skill sync (installs, usage, and removals auto-sync to server)
- Conversational AI onboarding with BrailleSpinners, ASCII logo, portrait rendering
- Email/password auth (no API token required for own account)
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
- 19-table schema fully deployed (added skills + skillInstalls)
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

### Clerk v7 Compatibility
- Some TypeScript errors in Clerk v7 API surface (non-blocking, types issue)
- Terminal-style auth works but uses undocumented Clerk v7 custom flow APIs
- Password reset flow uses `SignInFutureResource` which may change

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
- CLI email/password auth (register + login, no API token needed)
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

## Next Priorities (Houston's Order)

1. **Chat agent reliability** — slow responses, streaming improvements, session quality
2. **CLI ↔ Web sync verification** — portraits, images, full data round-trip
3. **Agent intelligence** — tune personality, ensure it acts (not asks), show portraits in chat
4. **MCP server** — working MCP endpoint for agent-to-agent identity sharing
5. **End-to-end flow testing** — full journey from CLI init to web dashboard to agent share
6. **Billing + Pro plan** — Stripe integration
7. **Growth features** — verified badges, analytics, rate limiting
