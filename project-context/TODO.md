# You.md — Build Progress Tracker

Last Updated: 2026-03-16

## Milestone 0: Foundation ✓ COMPLETE
> Core infrastructure. Auth. Username claim. Empty bundle creation.

- [x] Save PRD to project-context
- [x] Create TODO tracker + feature requests
- [x] Initialize Next.js 14+ app with App Router
- [x] Initialize Convex backend (schema + functions)
- [x] Set up Clerk auth with Convex integration
- [x] Define Convex schema (all tables from PRD §4.3)
- [x] Implement user registration + username claim
- [x] GET /api/v1/profiles/:username — public API endpoint
- [x] Basic auth flow (sign up, sign in, sign out via Clerk)
- [x] Username claim page (real-time availability check)
- [x] Brand system (9 color tokens, beam-glow, gradients, dark mode)
- [x] Connect to live Convex deployment (uncommon-chicken-142)
- [x] Configure Clerk credentials (superb-lab-93)
- [x] Git repo initialized + pushed to GitHub
- [ ] CI/CD pipeline setup (Vercel + Convex deploy)

---

## Milestone 1: Manual Identity Creation — IN PROGRESS
> Users can create and publish an identity bundle manually (no scraping yet).

- [x] Structured profile editor (web dashboard form)
- [x] Save bundle mutation (convex/me.ts saveBundleFromForm)
- [x] Publish bundle mutation (convex/me.ts publishLatest)
- [x] Public profile page at /[username] (renders you.json)
- [x] youmd build (local compile from profile/*.md + preferences/*.md)
- [x] you.json and you.md compilation (convex/lib/compile.ts + cli/src/lib/compiler.ts)
- [x] Manifest generation
- [x] Profile page design (brand colors, beam-glow, dark mode, sections)
- [x] Landing page (hero, how-it-works, dual value prop)
- [x] 404 page with brand styling
- [ ] youmd publish (needs API auth integration)
- [ ] Dashboard form uses saveBundleFromForm mutation (currently uses older saveBundle)
- [ ] Test end-to-end: create account → claim username → fill form → save → publish → view profile

---

## Milestone 2: Ingestion Pipeline
> Users can add source URLs and the system scrapes, extracts, and generates analysis.

- [x] youmd add <source> <url> (CLI command)
- [x] POST /me/sources — add source URL (convex/me.ts addSource)
- [x] GET /me/sources — list sources (convex/me.ts getSources)
- [ ] Ingestion pipeline (all 6 stages)
- [ ] Website scraping (Firecrawl)
- [ ] LinkedIn scraping (Apify)
- [ ] X scraping (Apify)
- [ ] LLM extraction prompts (per source type)
- [ ] LLM analysis prompts (voice, topics, bio variants, arcs, FAQ)
- [ ] Diff review UI (web)
- [ ] youmd build (full pipeline)
- [ ] youmd diff
- [ ] Human-in-the-loop approval

---

## Milestone 3: Security + Sharing + Monetization
- [ ] Private vault encryption (AES-256-GCM)
- [ ] Context links — create, list, revoke
- [ ] API key management
- [ ] Rate limiting
- [ ] Stripe integration for Pro plan

---

## Milestone 4: Polish + Launch
- [ ] Public landing page (production quality)
- [ ] CLI published to npm as `youmd`
- [ ] Open Graph / social cards
- [ ] SEO for profile pages
- [ ] Monitoring + alerting

---

## CLI Package Status
- [x] Scaffolded at cli/
- [x] Commands: init, login, register, whoami, status, build, publish, add, diff, preview
- [x] Bundle compiler (cli/src/lib/compiler.ts)
- [x] Config management (cli/src/lib/config.ts)
- [x] TypeScript compiles cleanly
- [x] `youmd init` tested — creates .youmd/ bundle structure
- [x] `youmd build` tested — compiles bundle from markdown files
- [ ] Compile to standalone binary
- [ ] Publish to npm as `youmd`
- [ ] API auth integration for publish/status commands

---

## Current Focus
**Milestone 1 — Manual Identity Creation**
Next: Wire dashboard to new saveBundleFromForm mutation, test full end-to-end flow, prepare CLI for npm publish.
