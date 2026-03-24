# You.md — Build Progress & Roadmap

Last Updated: 2026-03-24
PRD Version: 2.3

---

## COMPLETED

### Foundation (Milestone 0)
- [x] Next.js 16 + Convex + Clerk + Tailwind v4
- [x] Full Convex schema (users, bundles, sources, apiKeys, contextLinks, etc.)
- [x] Auth flow (Clerk production: clerk.you.md)
- [x] Git repo + GitHub sync
- [x] Vercel deployment (you.md custom domain)
- [x] Convex production (kindly-cassowary-600) + dev (uncommon-chicken-142)

### Backend (Milestones 1-3)
- [x] Bundle compilation (convex/lib/compile.ts)
- [x] Save + publish mutations
- [x] Ingestion pipeline (fetch, extract, analyze, compile via OpenRouter)
- [x] API key management (SHA-256 hashed, scoped, ym_ prefix)
- [x] Context links (token-based, TTL, scope)
- [x] Full HTTP API (public + authenticated endpoints)
- [x] LLM chat proxy (convex/chat.ts)
- [x] Pipeline orchestrator with job tracking

### CLI (npm: youmd)
- [x] Published on npm with auto-version-bump
- [x] 13 commands (init, login, register, whoami, status, build, publish, add, diff, preview, chat, link, keys)
- [x] Conversational AI onboarding agent (1014 lines, 72 thinking phrases)
- [x] youmd chat command (522 lines, slash commands)
- [x] Website fetching during onboarding with LLM commentary
- [x] API client hitting production Convex

### Design System Migration (PRD v2.3)
- [x] CSS rewrite: monochrome + burnt orange (#C46A3A)
- [x] JetBrains Mono + Inter typography
- [x] Dark mode default, .light class toggle
- [x] Terminal panel, CLI pill, glass nav styles
- [x] All animation keyframes (fadeUp, blink, pulse, beam)

### Components Ported from Lovable
- [x] PixelYOU canvas logo
- [x] ASCII portrait system (HeroPortrait, AsciiAvatar, Generator)
- [x] FadeUp animation
- [x] Glass Navbar with --flag navigation
- [x] ThemeToggle (dark/light/system)

### Landing Page (12 sections)
- [x] Hero (PixelYOU + boot sequence + CLI + ASCII portrait)
- [x] Founder Quote (terminal panel)
- [x] Profiles Showcase (hover-reveal)
- [x] Problem Strip
- [x] How It Works (3 CLI steps)
- [x] What's Inside (typewriter code)
- [x] Portrait Generator (upload → ASCII → PNG)
- [x] Open Spec
- [x] Integrations
- [x] Pricing (Free + Pro)
- [x] CTA Footer

### Web App Pages
- [x] Dashboard with tabs (Profile, Sources, Settings) — REPLACED by terminal split-screen
- [x] Web chat agent (/dashboard/chat) — REPLACED: terminal IS the dashboard now
- [x] Username claim page — REPLACED: /initialize auto-claims
- [x] Sign-in/sign-up (Clerk branded)
- [x] Public profile page with JSON-LD
- [x] OG social card generation
- [x] 404 page

### Terminal-First UI Architecture (2026-03-19)
- [x] useYouAgent hook — extracted all conversation logic from chat-content.tsx
- [x] Terminal components (TerminalShell, MessageBubble, ThinkingIndicator, TerminalInput, TerminalStatusBar)
- [x] /initialize route — auto-claim + boot sequence + onboarding terminal
- [x] Split-screen dashboard — 35% terminal left, 65% preview right
- [x] Right pane system — SIMPLIFIED from 12 panes to 4: profile, edit, share, settings
- [x] Slash commands switch right pane (/profile, /edit, /share, /settings + legacy aliases)
- [x] Shared pane primitives (PaneSectionLabel, PaneDivider, PaneHeader, PaneEmptyState)
- [x] PublishPane wired to real Convex data (listRecentBundles)
- [x] Auto-scrape existing links on session init for returning users
- [x] Auto-research sparse profiles via Perplexity
- [x] Auto-publish on every bundle save
- [x] Smarter profile image selection (LinkedIn > GitHub > X priority)
- [x] Claude Code-style thinking indicator with category icons
- [x] Terminal-style message rendering with markdown support
- [x] Persistent AppNav side panel for logged-in users — REPLACED by unified SiteNav top bar
- [x] Unified SiteNav — compact top bar on all pages (dashboard, profiles, docs, profile pages)
- [x] Dashboard navigation — links to home, profile, profiles, docs from dashboard
- [x] Cleaned up unused nav components (duplicate Navbar.tsx, NavLink.tsx)
- [x] Border radius standardized to 2px across entire app
- [x] Mobile responsiveness for public profile (avatar stacking, responsive padding)
- [x] Mobile status bar visible on dashboard
- [x] Pricing section terminal-panel styling
- [x] Sign-up redirects to /initialize (not /claim)
- [x] /claim redirects to /sign-up
- [x] Dashboard redirects to /initialize if no Convex user
- [x] Mobile: terminal full-width with toggle button for preview
- [x] Deleted /dashboard/chat (dead code)
- [x] Deleted claim-form.tsx (dead code)
- [x] All /claim links updated to /sign-up

---

### Markdown File System (Vault) — 2026-03-22
- [x] File decompiler utility (youJson -> individual .md files)
- [x] File recompiler utility (edited .md files -> patched youJson)
- [x] FilesPane component with file tree + markdown editor
- [x] `files` tab in dashboard right pane system
- [x] `/files` and `/vault` slash commands
- [x] `saveYouJsonDirect` Convex mutation for saving edited files
- [x] Save/discard buttons with status feedback
- [ ] Keyboard shortcuts (Ctrl+S to save)
- [ ] Markdown preview toggle (edit / preview split)
- [ ] Create new custom .md files
- [ ] Private vault files (encrypted)
- [ ] File diff view (compare versions)
- [ ] Backlinks / bidirectional linking between files

### Memory System (Unified Brain) — 2026-03-22
- [x] `memories` table in Convex schema (category, content, source, tags, sessionId)
- [x] `chatSessions` table for conversation history tracking
- [x] Memory CRUD mutations (save, archive, update, list, stats)
- [x] Session tracking mutations (upsert, list)
- [x] `memory_saves` JSON block parsing in useYouAgent
- [x] Auto-session tracking (sessionId per page load, message counting)
- [x] Agent system prompt: memory detection + save instructions
- [x] Memory files in vault (memory/facts.md, memory/insights.md, etc.)
- [x] Session history in vault (sessions/history.md)
- [x] Memory stats in file tree sidebar
- [x] Memory recall in agent context (inject recent memories into system prompt)
- [x] Memory search / filter UI (search bar in vault file tree)
- [x] Memory management commands (/memory, /recall, /recall {query})
- [x] External agent memory ingestion (HTTP API: GET/POST /api/v1/me/memories)
- [x] Session summaries (auto-generated via LLM every 10 messages)
- [x] Memory expiration / archival policies (archiveStale mutation: max age + max count)
- [x] CLI memory sync (`youmd memories list/add/stats`)

---

### Agent Directives & Proactive Agent UX — 2026-03-24
- [x] `directives/agent.md` bundle section (communication_style, negative_prompts, default_stack, decision_framework, current_goal)
- [x] `agentDirectives` field in ProfileData interface (convex/lib/compile.ts)
- [x] `agent_directives` section compiled into youJson
- [x] Agent Directives section in youMd output
- [x] directives/agent.md path in manifest
- [x] Parse directives from agent updates in useYouAgent
- [x] Include agent directives in profile context for LLM
- [x] Include agent directives in share blocks
- [x] "building" thinking category with 10 new phrases
- [x] More granular LLM wait sub-steps (7 steps vs 3, tighter intervals)
- [x] Faster thinking phrase rotation (2.5s vs 3.5s)
- [x] Category-aware phrase rotation during LLM wait
- [x] System prompt teaches agent to proactively build directives
- [x] Progressive depth updated with directive-related questions at L2/L3
- [x] soul.md updated with "Always Building" philosophy
- [x] agent.md updated with Agent Directives section documentation
- [ ] CLI: directives support in `youmd chat`
- [ ] API: directives in HTTP response

### Intelligent Model Routing & Portrait System — 2026-03-24
- [x] Model routing config map in convex/chat.ts (chat, research, verify, x_enrichment, summary, classify)
- [x] `verifyIdentity` action — Perplexity Sonar Pro cross-references scraped profiles to confirm same person
- [x] `/api/v1/verify-identity` HTTP endpoint
- [x] Identity verification runs in parallel with research during scraping
- [x] Verification context injected into agent conversation
- [x] Save ALL scraped images to `socialImages` (not just best one to avatarUrl)
- [x] Merge new images with existing socialImages on each scrape
- [x] AsciiAvatar: 4 format modes — classic, braille, block, minimal
- [x] AsciiAvatar: 120 columns default (was 80)
- [x] PortraitPane: tap-to-select primary image from all scraped sources
- [x] PortraitPane: real photo preview + ASCII preview side by side per source
- [x] PortraitPane: format picker (classic/braille/block/minimal)
- [x] PortraitPane: detail level picker (60/80/100/120/160 columns)
- [x] Public profile page: 120 col portraits (was 60)
- [ ] Custom image upload to socialImages.custom
- [ ] Download ASCII portrait as PNG

---

## IN PROGRESS / NEEDS FINISHING

### Profile Page (PRD §15.10 compliance)
- [ ] Port profile page from Lovable prototype (full terminal-panel layout)
- [ ] ASCII portrait banner (full-width, from user photo)
- [ ] System header in terminal panel (status pulse, metrics, verified badge)
- [ ] Raw JSON toggle (<> raw button)
- [ ] Count-up animations on metrics
- [ ] Role icons (◆ Founder, ⟐ Engineer, ◈ Designer)
- [ ] Section dividers with `── LABEL ──` format
- [ ] All 13 profile sections per PRD §15.10

### Profiles Directory Page
- [ ] Create /profiles route
- [ ] `> ls /profiles` header
- [ ] ASCII avatar hover-reveal (ASCII → photo on hover)
- [ ] Agent reads + integrations metrics in accent color
- [ ] Search/filter/sort

### Landing Page Polish
- [ ] Verify all sections match Lovable prototype exactly
- [ ] Boot sequence typewriter timing
- [ ] Scroll parallax on How It Works
- [ ] Content opacity fade on hero scroll
- [ ] Profiles showcase hover-reveal working
- [ ] Portrait generator functional end-to-end

---

## UP NEXT (v1 MVP)

### End-to-End Testing
- [ ] Sign up → /initialize → boot sequence → agent → /done → dashboard
- [ ] CLI: npx youmd init → build → publish → view live
- [ ] Pipeline: add source URL → trigger build → review → approve
- [ ] Context link: create → share → agent fetches → gets identity

### Polish
- [ ] Skeleton loaders on all async pages
- [ ] Error boundaries with branded fallback
- [ ] Empty state illustrations
- [ ] Confirmation dialogs for destructive actions
- [ ] Mobile hamburger menu on all pages
- [ ] Custom scrollbar working across browsers

### SEO / AEO
- [ ] JSON-LD verified on all profile pages
- [ ] OG cards verified (sharing on X, LinkedIn, Slack)
- [ ] Canonical URLs set
- [ ] Sitemap generation

### Monitoring
- [ ] Sentry error tracking
- [ ] Vercel Analytics
- [ ] Uptime monitoring

---

## FUTURE (Post-MVP / v1.1+)

### The You Agent System
- [ ] you-agent/ directory with soul.md, agent.md, skills/
- [ ] Agent harness for platform operations
- [ ] MCP endpoint (mcp.you.md/<username>)
- [ ] Agent-to-agent communication protocol

### Features
- [ ] Verified badges (domain, LinkedIn, GitHub verification)
- [ ] Private vault encryption (AES-256-GCM)
- [ ] Stripe Pro plan ($12/mo)
- [ ] Rate limiting per plan
- [ ] Custom domains for profiles
- [ ] Interview mode (youmd interview)
- [ ] Autonomous refresh (youmd refresh)
- [ ] Profile analytics dashboard
- [ ] Profile page theming (v1.2+)
- [ ] Team/org bundles (v2.0)
- [ ] Plugin marketplace (v2.0+)

### Integrations
- [ ] Composio OAuth for connected platforms
- [ ] Apify API key configuration
- [ ] Framework PRs (Aider, CrewAI, LangChain, etc.)
- [ ] skills.sh / clawhub.ai skill submission
- [ ] SKILL.md in repo

### CLI Enhancements
- [ ] youmd preview — local dev server
- [ ] youmd diff — actual diff vs published
- [ ] Standalone binary (bun build --compile)
- [ ] curl installer (you.md/install.sh)
