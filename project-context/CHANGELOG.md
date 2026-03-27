# You.md — Changelog

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
