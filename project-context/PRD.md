# You.md — Product Requirements Document

Version: 2.3
Last Updated: 2026-03-26
Founder: Houston Golden

---

## 1. Vision

You.md is the identity file for the agent internet. A structured, portable identity bundle that gives every AI agent context about who you are — so they don't start from scratch every time.

**One-liner:** Your identity, as code.

**Positioning:** Not a social profile. Not a resume. Not a settings page. You.md is identity infrastructure — a machine-readable, human-curated file that any AI agent can consume to understand you deeply from the first message.

---

## 2. Target Users

### Primary: AI Power Users
People who use 3+ AI agents daily (Claude Code, Cursor, ChatGPT, Codex, etc.) and are tired of re-explaining who they are, what they do, and how they like to work. Founders, engineers, researchers, creators.

### Secondary: Agent Developers
Teams building AI agents/apps that need structured user context. They integrate via the HTTP API or context links to get rich identity data for their users.

### Tertiary: Knowledge Workers
Anyone who wants a living, structured identity that evolves through conversation — not a static bio page.

---

## 3. Core Product Surfaces

### 3.1 Web App (you.md)
- **Landing page** — 12-section homepage explaining the product
- **Public profiles** — `you.md/{username}` — SSR, SEO-optimized, JSON-LD
- **Dashboard** — Claude Code-style terminal (35%) + preview pane (65%)
- **Profiles directory** — Browse all public profiles with search
- **Docs** — Integration guides, API reference

### 3.2 CLI (npm: youmd)
- **youmd init** — Conversational AI onboarding that builds your identity through dialogue
- **youmd chat** — Ongoing conversation with the You Agent for profile evolution
- **youmd push/pull/sync** — Two-way sync between local files and web
- **youmd link** — Create shareable identity links with scoped permissions
- **youmd project** — Per-project agent context management
- 20 total commands covering the full identity lifecycle

### 3.3 HTTP API
- 30+ endpoints for profile CRUD, LLM chat, scraping, enrichment, memory management
- Bearer token auth (API keys with ym_ prefix)
- Context links for agent-accessible identity bundles
- SSE streaming for real-time chat

### 3.4 Identity Bundle (you.json / you.md)
The compiled output — a portable identity file containing:
- Profile data (name, bio, tagline, location, links)
- Projects, values, "what I'm doing now"
- Voice analysis (how you write on each platform)
- Agent directives (how you want AI to interact with you)
- Credibility signals (cross-referenced from multiple sources)
- FAQ (predicted questions about you)
- Connected sources metadata

---

## 4. Core User Journeys

### Journey 1: CLI-First Onboarding
```
npx youmd register (or youmd login)
→ Create account with email + password (30 seconds)
→ youmd init
→ ASCII YOU logo renders
→ Agent asks for username → name → first social handle
→ Agent immediately shows ASCII portrait ("you look good in pixels")
→ Agent scrapes social profiles, shows BrailleSpinner + personality
→ Conversational Q&A builds identity progressively
→ Agent compiles you.json + you.md
→ "done" → shows next steps (push, sync, chat)
```

### Journey 2: Web-First Onboarding
```
you.md/create → enter email → password → verification → username claim
→ /initialize boot sequence (typewriter animation)
→ You Agent greets, gathers context conversationally
→ Profile builds in real-time, visible in right pane
→ Agent auto-scrapes links, researches background, publishes
```

### Journey 3: Agent Integration
```
User creates context link (web or CLI)
→ Shares link with AI agent: "Read my identity: https://you.md/ctx/username/token"
→ Agent GETs the link → receives structured identity bundle
→ Agent responds with personalized context from the start
```

### Journey 4: Ongoing Identity Evolution
```
User runs youmd chat (CLI) or uses web terminal
→ Conversations auto-update profile sections
→ Agent captures memories, updates directives
→ Profile stays fresh without manual editing
→ youmd sync keeps local ↔ web in sync
```

---

## 5. The You Agent

The You Agent is the AI personality embedded in the product. It's not a generic chatbot — it's a sharp, curious, slightly weird AI that genuinely wants to understand you.

### Personality
- **Warm but direct.** Not corporate. Not try-hard.
- **Dry humor.** "you look good in pixels." Not "Great profile photo!"
- **Genuinely curious.** Asks follow-up questions that show it's listening.
- **Terminal-native tone.** Lowercase. No emoji. Concise.
- **"Always building."** Acts on inferences immediately. "adding that to your projects now" not "would you like me to add that?"

### Capabilities
- Profile building through conversation
- Web scraping and social profile enrichment
- Voice analysis across platforms
- Identity verification (cross-referencing sources)
- Memory management (auto-capture facts, preferences, decisions)
- Agent directive inference (learns your communication style)
- Custom section creation
- Portrait management

### Progressive Depth
The agent starts with basics and goes deeper:
- **L1:** Name, username, social handles, current role
- **L2:** Projects, values, tech stack, communication preferences
- **L3:** Decision frameworks, pet peeves, long-term goals
- **L4:** Private context, investment thesis, calendar priorities

---

## 6. Design System (v2.3 — STRICT)

### Philosophy
Terminal-native, not SaaS. Infrastructure with soul. Every pixel should feel like "system output that happens to be beautiful."

### Colors
- **Dark mode default:** #0D0D0D background
- **Light mode:** via `.light` class (NOT prefers-color-scheme)
- **Accent:** Burnt orange #C46A3A (links, CTAs, active states)
- **Text:** #EAE6E1 primary, #A89E91 secondary
- **Borders:** #2E2E2E
- **Hierarchy via spacing + opacity (0.3-0.9), NOT font weight**

### Typography
- **Headings/Brand/Code:** JetBrains Mono
- **Body text:** Inter
- **No Geist fonts**

### Components
- **Terminal panels** (bg-raised, 1px border, 3-dot header) replace all cards
- **CLI pills** (copy-to-clipboard) for commands
- **Glass nav** with --flag format items
- **Section labels:** uppercase, tracking-widest, mono, `── LABEL ──` format
- **ASCII portraits** are the visual identity — not profile photos
- **PixelYOU canvas logo** — drawn on canvas, not an image

### Animations
- FadeUp (IntersectionObserver)
- Boot sequence typewriter (55ms/char)
- Count-up metrics
- BrailleSpinner for all async operations
- NO Aurora, GradientText, BlurText, or particle effects

### Absolute Rules
- No emoji anywhere (UI or CLI)
- No rounded cards with drop shadows
- No colorful CTAs
- No decorative illustrations
- No gradients
- Border radius: 2px everywhere
- One accent color. Everything else grayscale.

---

## 7. Data Model

See ARCHITECTURE.md for the complete 17-table schema. Key relationships:

```
users (1:1 Clerk) → profiles (1:1, claimable)
                   → bundles (1:many, versioned)
                   → sources (1:many)
                   → apiKeys (1:many)
                   → memories (1:many)
                   → chatSessions/chatMessages

profiles → contextLinks (1:many)
         → privateContext (1:1)
         → accessTokens (1:many)
         → agentInteractions (1:many)
         → securityLogs, profileReports, profileVerifications
```

---

## 8. Security Model

### Authentication
- **Web:** Clerk OAuth/password with MFA
- **CLI:** Email/password via Clerk Backend API → auto-generated API key
- **API:** Bearer token (SHA-256 hashed ym_ keys)

### Authorization
- **Free plan:** 1 API key, public read scope only, limited context links
- **Pro plan:** Unlimited keys, all scopes, full private access
- **Context links:** Token-based, scoped (public/full), TTL, max uses
- **Private context:** Only accessible to profile owner or full-scope tokens

### Data Protection
- API keys stored as SHA-256 hashes (raw key shown once at creation)
- Context link tokens: random, URL-safe, revocable
- Private vault: AES-256-GCM encryption (planned)
- Security events logged to securityLogs table

---

## 9. CLI Requirements

### Core Philosophy
The CLI is the PRIMARY experience, not a secondary tool. It should feel like Claude Code — alive, intelligent, responsive. Auth is required — users register or login before building their identity. Anonymous/no-signup profile creation is deferred to v2 growth strategy.

### UX Requirements
- BrailleSpinner on EVERY async operation (LLM calls, scrapes, compiles, saves)
- ASCII portrait shown within first 3 interactions during onboarding
- AI humor throughout (personality-rich spinner labels, witty transitions)
- One question at a time, accent-colored, skippable with Enter
- YOU ASCII logo on opening screen
- Multi-select UI for platform/tool selection
- Color rotation on spinner text (orange shades)
- Lightsweep effect on active text
- Proper word-wrap and left-aligned formatting

### CLI Commands (20)
init, login, register, whoami, status, build, publish, add, diff, export, preview, chat, link, keys, memories, private, project, pull, push, sync

---

## 10. Agent Integration Spec

### Context Link Resolution
```
GET https://you.md/ctx/{username}/{token}
Accept: text/plain → returns you.md (human-readable identity)
Accept: application/json → returns you.json (structured bundle)
```

### AI Agent User-Agent Detection
Profile pages serve plain-text identity context to known AI agent user-agents, enabling:
```
"Read my identity context before we start: https://you.md/houstongolden"
```

### Share Prompt Templates
Platform-specific prompts for Claude, ChatGPT, Cursor, Copilot, and universal format. Each includes the context link + directive for how the agent should respond.

---

## 11. Success Metrics

### North Star
- Unique profiles with 3+ sources connected
- Context link clicks per week (agents consuming identity)

### Engagement
- CLI installs (npm)
- Agent interactions per profile per week
- Memory capture rate (auto-captured per conversation)
- Profile freshness (% updated in last 7 days)

### Growth
- Profile directory size
- Inbound traffic to profiles (SEO)
- CLI → web conversion (users who sign up after trying CLI)

---

## 12. Roadmap Priorities

### Now (v1 MVP polish)
1. End-to-end flows working perfectly (CLI ↔ web sync)
2. CLI feels alive (spinners, portraits, personality)
3. SEO/AEO fully optimized (SSR, JSON-LD, OG, sitemap)
4. Agent integration proven (context links work, agents respond intelligently)

### Next (v1.1) — Identity Version Control
The identity bundle is a collaborative document. Multiple agents, devices, and surfaces edit it concurrently. Needs git-like semantics:
1. Content-hash-based version tracking (not just incrementing numbers)
2. Pull-before-push enforcement (implemented in v1.0 as safety guard)
3. Merge strategies for concurrent edits from web, CLI, and external APIs
4. Commit history / changelog per identity bundle
5. "PR" model — external agents propose changes, owner approves/rejects
6. `youmd skill` — installable agent skill (via skills.sh / npx) for automated identity management
7. MCP endpoint for real-time sync between agents (mcp.you.md/{username})
8. Verified badges, profile analytics, custom domains
9. Stripe Pro plan

### Future (v2.0)
1. Anonymous profile creation / SEO knowledge panels — deferred growth feature
2. Agent-to-agent communication protocol
3. Team/org bundles
4. Plugin marketplace
5. Autonomous refresh (youmd refresh)
6. Interview mode (youmd interview)
