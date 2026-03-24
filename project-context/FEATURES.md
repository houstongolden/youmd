# You.md — Feature Inventory

Last Updated: 2026-03-19

## Core Platform

| Feature | Status | Notes |
|---|---|---|
| Open spec you-md/v1 | Done | Directory-based identity bundles |
| Convex backend | Done | Reactive, serverless, TypeScript-native |
| Clerk auth | Done | Production: clerk.you.md |
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
| GET /ctx (context links) | Done |
| POST /api/v1/chat (LLM proxy) | Done |
| GET /api/v1/me | Done |
| POST /api/v1/me/bundle | Done |
| POST /api/v1/me/publish | Done |
| POST/GET /api/v1/me/sources | Done |
| GET /api/v1/me/analytics | Done |
| POST /api/v1/me/build | Done |
| GET /api/v1/me/build/status | Done |

## Security

| Feature | Status | Notes |
|---|---|---|
| API keys (SHA-256 hashed) | Done | ym_ prefix, scoped |
| Context links | Done | Token-based, TTL, max uses |
| Free tier limits | Done | 1 key, read:public |
| Private vault encryption | Not started | AES-256-GCM, deferred |
| Rate limiting | Not started | Per plan |

## CLI (npm: youmd)

| Feature | Status | Notes |
|---|---|---|
| youmd init | Done | Conversational AI onboarding |
| youmd chat | Done | Ongoing agent conversation |
| youmd build | Done | Local compile + thinking phrases |
| youmd publish | Done | Upload + publish to platform |
| youmd login | Done | API key auth |
| youmd status | Done | Rich tree-style summary |
| youmd whoami | Done | Profile display |
| youmd add | Done | Add source URLs |
| youmd link | Done | Context link management |
| youmd keys | Done | API key management |
| youmd diff | Placeholder | Show changes vs published |
| youmd preview | Placeholder | Local dev server |

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

## Feature Requests (Backlog)

- [ ] ASCII portrait upload during profile creation (web)
- [ ] Download ASCII portrait as PNG from profile page
- [ ] Verified badges (domain, social, DNS TXT)
- [ ] Profile analytics dashboard (views, agent reads, top queries)
- [ ] Freshness score (4-dimension state)
- [ ] Activity timeline on profile
- [ ] Agent network section (connected agents, top queries)
- [ ] Role icons on profiles (◆ Founder, ⟐ Engineer, ◈ Designer)
- [ ] Composio OAuth for platform connections
- [ ] Profile page raw JSON toggle
- [ ] Count-up animations on all metrics
- [ ] Status pulse (ACTIVE dot)
- [ ] Profiles directory page (/profiles)
- [ ] Framework integration PRs (Aider, CrewAI, LangChain)
- [ ] SKILL.md for skills.sh / clawhub.ai
- [ ] MCP endpoint
- [ ] Stripe Pro plan
- [ ] Interview mode (youmd interview)
- [ ] Voice onboarding
- [ ] Team/org bundles
- [ ] Self-host export (youmd export)
