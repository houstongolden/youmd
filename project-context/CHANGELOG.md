# You.md — Changelog

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
