# You.md — Changelog

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
