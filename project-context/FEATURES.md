# You.md — Feature Inventory

Last Updated: 2026-04-16

## Core Platform

| Feature | Status | Notes |
|---|---|---|
| Open spec you-md/v1 | Done | Directory-based identity bundles |
| Convex backend | Done | Reactive, serverless, TypeScript-native |
| Passwordless auth migration | Done | First-party email-code auth, sessions, custom JWT/JWKS. Local/dev validated and production browser + CLI parity hard-smoked |
| Username claim | Done | Auto-claim via /initialize (no manual form) |
| Bundle compilation | Done | Server-side via convex/lib/compile.ts |
| Bundle publishing | Done | Version tracking, unpublish previous |
| Public profile pages | Done | SSR, JSON-LD, dynamic metadata |
| OG social cards | Done | Auto-generated per profile |
| Terminal split-screen dashboard | Done | 35% terminal + 65% preview pane |
| Unified SiteNav top bar | Done | Compact nav across all authenticated pages (replaces AppNav side panel) |
| /initialize onboarding | Done | Boot sequence + agent conversation |
| useYouAgent hook | Done | Shared agent logic for all terminal UIs |
| Right pane system | Done | Simplified to 4 panes: profile, edit (files/json/sources sub-tabs), share (hero sharing UX + publish + context links + agent stats), settings (account/keys/billing/activity/help) |
| Markdown file system (Vault) | Done | Browse + edit identity bundle as individual .md files, save back to Convex |
| Memory system (Unified Brain) | Done | Auto-capture, recall in agent context, /memory + /recall commands, search UI, HTTP API, session summaries, archival policies, CLI sync |
| Real-time progress indicators | Done | Claude Code-style activity log showing each async step (scrape, research, LLM, save, publish) with running/done/error status |
| Typewriter message rendering | Done | Latest assistant message streams in with cursor animation |
| Auto-scrape on init | Done | Scrapes existing profile links before first LLM call |
| Auto-research | Done | Perplexity web research for sparse profiles |
| Auto-publish | Done | Every bundle save auto-publishes |
| Shared pane primitives | Done | Consistent UI across all dashboard panes |
| Source management | Done | Add URLs, view status |
| Pipeline trigger | Done | From dashboard |

## Ingestion Pipeline

| Feature | Status | Notes |
|---|---|---|
| Pipeline orchestrator | Done | 6-stage with job tracking |
| Website scraping | Done | Native fetch, HTML→text |
| LinkedIn scraping | Done | Apify integration wired in useYouAgent |
| X/Twitter scraping | Done | Via scrape endpoint in useYouAgent |
| LLM extraction | Done | OpenRouter, Claude Sonnet |
| Voice analysis | Done | Author voice profile |
| Topic mapping | Done | Expertise graph |
| Bio generation | Done | Short/medium/long variants |
| FAQ generation | Done | Predicted questions |
| Pipeline compilation | Done | Extracted → bundle |

## HTTP API

| Endpoint | Status |
|---|---|
| GET /api/v1/profiles | Done |
| GET /api/v1/check-username | Done |
| GET /.well-known/mcp.json | Done | Web-domain MCP discovery now proxied through Next to the Convex MCP discovery document |
| POST /api/v1/mcp | Done | Web-domain MCP transport now proxied through Next to the Convex MCP server |
| GET /ctx (context links) | Done |
| POST /api/v1/chat (LLM proxy) | Done |
| GET /api/v1/me | Done |
| POST /api/v1/me/bundle | Done |
| POST /api/v1/me/publish | Done |
| POST/GET /api/v1/me/sources | Done |
| GET /api/v1/me/analytics | Done |
| POST /api/v1/me/build | Done |
| GET /api/v1/me/build/status | Done |

## Agent Directives

| Feature | Status | Notes |
|---|---|---|
| directives/agent.md bundle section | Done | Communication style, negative prompts, default stack, decision framework, current goal |
| agent_directives in youJson | Done | Compiled from ProfileData.agentDirectives |
| Agent Directives in youMd | Done | Human-readable section |
| Proactive directive building | Done | Agent observes and infers directives from conversation |
| Directives in share blocks | Done | Context links include directive summary |
| "building" thinking category | Done | 10 new phrases for directive/identity construction |
| Enhanced activity simulation | Done | 7 granular sub-steps during LLM wait (vs 3), faster rotation |
| Portrait updates via tool_use | Done | Web shell now supports portrait/avatar changes on the primary `update_profile` tool path, with JSON fallback only when tools are unavailable |

## Intelligent Model Routing

| Feature | Status | Notes |
|---|---|---|
| Model routing config | Done | Named model map: chat, research, verify, x_enrichment, summary, classify |
| Identity verification | Done | Perplexity Sonar Pro cross-references scraped profiles, returns confidence score |
| Parallel verification | Done | Runs alongside research during scraping, injected into agent context |
| Verify HTTP endpoint | Done | POST /api/v1/verify-identity |

## Portrait System

| Feature | Status | Notes |
|---|---|---|
| Multi-image scraping | Done | ALL scraped images saved to socialImages (not just best) |
| Tap-to-select primary | Done | Click any source image to make it primary |
| Real photo + ASCII preview | Done | Each source shows actual photo and ASCII conversion side by side |
| ASCII format modes | Done | Classic ($@B%...), Braille (⣿⣷⣶...), Block (█▓▒░), Minimal (@%#*...) |
| Detail level picker | Done | 60/80/100/120/160 columns |
| 120 col default | Done | High-detail portraits by default (was 80) |
| Format picker UI | Done | Grid selector in PortraitPane |

## Security

| Feature | Status | Notes |
|---|---|---|
| API keys (SHA-256 hashed) | Done | ym_ prefix, scoped |
| Context links | Done | Token-based, TTL, max uses |
| Free tier limits | Done | 1 key, read:public |
| Private vault encryption | Not started | AES-256-GCM, deferred |
| Rate limiting | Not started | Per plan |

## CLI (npm: youmd v0.6.0)

| Feature | Status | Notes |
|---|---|---|
| youmd init | Done | Conversational AI onboarding with BrailleSpinners, ASCII portrait, multi-select |
| youmd chat | Done | Ongoing agent conversation with slash commands, project awareness |
| youmd build | Done | Local compile + thinking phrases |
| youmd publish | Done | Upload + publish to platform |
| youmd login | Done | Email-code auth or `--key` |
| youmd register | Done | Create account from CLI with passwordless verification |
| youmd status | Done | Rich tree-style summary |
| youmd whoami | Done | Profile display |
| youmd add | Done | Add source URLs |
| youmd link | Done | Context link management (create, list, preview, revoke) |
| youmd keys | Done | API key management |
| youmd diff | Done | LCS-based diff vs published |
| youmd export | Done | Export you.json + you.md to disk |
| youmd preview | Done | Local dev server for bundle inspection |
| youmd pull | Done | Pull from web to local |
| youmd push | Done | Push local to web |
| youmd sync | Done | Two-way sync |
| youmd memories | Done | List, add, stats |
| youmd private | Done | Private context management (10 subcommands) |
| youmd project | Done | Per-project context (init, list, switch, context, memory) |
| youmd skill | Done | 18 core subcommands plus aliases: list, install, remove, use, sync, create, add, push, link, init-project, improve, metrics, search, browse, publish, remote, export, info |
| MCP config generation | Done | `youmd mcp --json` / `--install` now emit an unambiguous published-package launcher instead of bare `npx youmd mcp` |
| Authenticated CLI production round-trip | Done | Fresh-account register/login/login-key/whoami/push/pull/diff/status/sync now hard-smoke clean against prod |
| Public-profile vendor JSON handling | Done | CLI now parses `application/vnd.you-md.v1+json`, strips `_profile`, fetches public markdown, and keeps local hashes/sync state aligned |

## Skill System (v1.0)

| Feature | Status | Notes |
|---|---|---|
| Skill catalog (YAML) | Done | youmd-skills.yaml with entries, scope, identity_fields |
| Template engine | Done | {{var}} interpolation against live identity data |
| Bundled skills (6) | Done | claude-md-generator, project-context-init, voice-sync, meta-improve, proactive-context-fill, you-logs |
| Install / Remove | Done | Global ~/.youmd/skills/ + batch all |
| Use (render) | Done | Interpolate + readiness check + display |
| Sync (re-interpolate) | Done | Manual + auto on push/pull/sync |
| Agent linking | Done | claude (.claude/skills/youmd/), cursor (.cursor/rules/youmd.md), codex |
| init-project | Done | Bootstrap AGENTS/CLAUDE entrypoints, canonical project-context/, generated `.you/`, and host links in one command |
| Managed bootstrap block | Done | Existing AGENTS.md / CLAUDE.md files get one additive You.md-managed block instead of broad rewrites |
| `.you/` generated layer | Done | `.you/AGENT.md`, `.you/STACK-MAP.md`, and `.you/project-context/README.md` scaffolded automatically |
| Per-file project-context scaffold | Done | Fills missing canonical files additively, including `PROMPTS.md` |
| Meta-improvement | Done | Identity coverage bars, unused skill detection, actionable proposals |
| Metrics tracking | Done | skill-metrics.json — uses, installs, identity field references |
| npm packaging | Done | Skills shipped with package in cli/skills/ |
| Push/pull hooks | Done | Auto re-interpolate installed skills on identity changes |
| Onboarding integration | Done | youmd init offers skill init-project when project detected |
| Status integration | Done | Skills count + identity coverage bar in status output |
| Bundled skill catalog upgrade merge | Done | Existing local YAML catalogs auto-merge new default bundled skills on upgrade |
| Web: SkillsPane | Done | Dashboard tab with catalog, CLI commands, how-it-works |
| Web: /skills command | Done | Slash command + help text |
| Skill registry | Done | Convex tables (skills + skillInstalls), 9 HTTP endpoints, web SkillsPane — completed 2026-03-27 |
| Ship-readiness audit evidence | In progress | Browser session auth, production shell hydration, production email delivery, real API-key issuance, and live CLI `whoami` parity now verified; broader web-agent personality/proactiveness audit still pending |
| Browser-auth parity audit | In progress | Passwordless auth stack validated locally and on dev backend; production browser/dashboard parity still needs live verification after deploy |

## Design System (PRD v2.3)

| Feature | Status | Notes |
|---|---|---|
| Monochrome + burnt orange palette | Done | CSS custom properties |
| JetBrains Mono + Inter | Done | next/font/google |
| Dark mode default | Done | .light class toggle |
| Terminal panel component | Done | CSS class |
| PixelYOU canvas logo | Done | 3-layer shadow algorithm |
| ASCII portrait system | Done | HeroPortrait, AsciiAvatar, Generator |
| Glass navbar | Done | --flag navigation |
| FadeUp animation | Done | IntersectionObserver |
| Boot sequence typewriter | Done | 55ms/char |
| ThemeToggle | Done | Dark/light/system |
| Section label format | Done | ── LABEL ── |

## Landing Page Sections

| # | Section | Status |
|---|---|---|
| 1 | Glass Navbar | Done |
| 2 | Hero (PixelYOU + boot + ASCII) | Done |
| 3 | Founder Quote | Done |
| 4 | Profiles Showcase | Done |
| 5 | Problem Strip | Done |
| 6 | How It Works | Done |
| 7 | What's Inside | Done |
| 8 | Portrait Generator | Done |
| 9 | Open Spec | Done |
| 10 | Integrations | Done |
| 11 | Pricing | Done |
| 12 | CTA Footer | Done |

## Recently Added (March 24-25)

| Feature | Status | Notes |
|---|---|---|
| Passwordless CLI auth | Done | No manual API token required for your own account |
| Server-side ASCII portrait generation | Done | convex/portrait.ts + DB caching |
| BrailleSpinner color rotation + lightsweep | Done | Orange shades, text lightsweep |
| CLI ASCII YOU logo | Done | Block-char logo in burnt orange |
| CLI multi-select UI | Done | Arrow keys + select for agents/tools |
| Markdown rendering on profile | Done | No more raw bold/heading markup |
| Richer profile cards in directory | Done | Bio, projects, social links |
| SSR profiles directory | Done | SEO: no more empty loading state |
| Profile breadcrumbs + rel=me | Done | SEO enhancement |
| Dynamic custom sections | Done | Agent can add/modify sections via chat |
| Persistent chat sessions | Done | Messages survive page refresh |
| Streaming responses via SSE | Done | Real-time token output |
| Portrait pane wired to real data | Done | Multi-source, format picker, detail picker |
| CLI rich terminal renderer | Done | Tables, stats, code blocks, callouts |
| Private context API + CLI | Done | Full CRUD on private identity data |
| Image paste in chat | Done | Web chat accepts pasted images |
| Codex MCP local-vs-global split | Done | Codex uses the local `cli/dist` build inside the youmd repo and the published npm CLI everywhere else |

## Feature Requests (Backlog)

- [ ] Custom image upload to socialImages.custom
- [ ] Download ASCII portrait as PNG
- [ ] Reveal/copy existing API key (not revoke-to-create)
- [ ] Dynamic profile sections via conversation
- [ ] Agent share prompt directives (tell receiving agent how to respond)
- [ ] Verified badges (domain, social, DNS TXT)
- [ ] Profile analytics dashboard (views, agent reads, top queries)
- [ ] Freshness score (4-dimension state)
- [ ] Activity timeline on profile
- [ ] Role icons on profiles (Founder, Engineer, Designer)
- [ ] Count-up animations on all metrics
- [ ] Status pulse (ACTIVE dot)
- [ ] Composio OAuth for platform connections
- [ ] Framework integration PRs (Aider, CrewAI, LangChain)
- [ ] MCP endpoint (mcp.you.md/{username})
- [ ] Stripe Pro plan ($12/mo)
- [ ] Interview mode (youmd interview)
- [ ] Autonomous refresh (youmd refresh)
- [ ] Voice onboarding
- [ ] Team/org bundles
- [ ] Standalone CLI binary (bun build --compile)
- [ ] curl installer (you.md/install.sh)
