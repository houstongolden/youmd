# You.md — Build Progress Tracker

Last Updated: 2026-03-16

## Milestone 0: Foundation
> Core infrastructure. Auth. Username claim. Empty bundle creation.

### Project Setup
- [x] Save PRD to project-context
- [x] Create TODO tracker
- [x] Create feature requests file
- [x] Initialize Next.js 14+ app with App Router
- [x] Initialize Convex backend (schema + functions)
- [x] Set up Clerk auth with Convex integration
- [x] Define Convex schema (all tables from PRD §4.3)
- [x] Implement user registration + username claim (convex/users.ts)
- [x] GET /api/v1/profiles/:username — public API endpoint (convex/http.ts)
- [x] Basic auth flow in web UI (sign up, sign in, sign out via Clerk)
- [x] Username claim page (check availability, reserve)
- [x] Set up brand system (CSS variables, typography, dark mode)
- [x] Build compiles successfully
- [ ] CI/CD pipeline setup (Vercel + Convex deploy)
- [ ] Connect to live Convex deployment (npx convex dev)
- [ ] Configure Clerk credentials in .env.local

### NOT in Milestone 0 scope:
- Ingestion pipeline
- Analysis
- Publishing
- Public profiles

---

## Milestone 1: Manual Identity Creation
> Users can create and publish an identity bundle manually (no scraping yet).

- [ ] Structured profile editor (web form → bundle)
- [ ] PUT /me/bundle — save bundle
- [ ] POST /me/publish — publish bundle
- [ ] Public profile page at you.md/<username> (SSR from you.json)
- [ ] youmd build (local compile only, no ingestion)
- [ ] youmd publish
- [ ] you.json and you.md compilation from form data
- [ ] Manifest generation
- [ ] Profile page design system (brand colors, typography, layout)

### NOT in Milestone 1 scope:
- Scraping
- LLM analysis
- Private vault
- API keys

---

## Milestone 2: Ingestion Pipeline
> Users can add source URLs and the system scrapes, extracts, and generates analysis.

- [ ] POST /me/sources — add source URL
- [ ] Ingestion pipeline (all 6 stages)
- [ ] Website scraping (Firecrawl)
- [ ] LinkedIn scraping (Apify)
- [ ] X scraping (Apify)
- [ ] LLM extraction prompts (per source type)
- [ ] LLM analysis prompts (voice, topics, bio variants, arcs, FAQ)
- [ ] Diff review UI (web)
- [ ] youmd add <source> <url>
- [ ] youmd build (full pipeline)
- [ ] youmd diff
- [ ] Human-in-the-loop approval

---

## Milestone 3: Security + Sharing + Monetization
> Private vault. Context links. API keys. Pro plan.

- [ ] Private vault encryption (AES-256-GCM)
- [ ] GET/PUT /me/private
- [ ] Context links — create, list, revoke
- [ ] GET /ctx/:username/:token endpoint
- [ ] API key management (create, list, revoke)
- [ ] Scoped API keys
- [ ] Rate limiting
- [ ] Stripe integration for Pro plan
- [ ] Pro gating

---

## Milestone 4: Polish + Launch
> Production-ready. Public launch.

- [ ] Public landing page
- [ ] Spec documentation site
- [ ] CLI published to npm
- [ ] Error handling, edge cases, loading states
- [ ] Monitoring + alerting
- [ ] SEO for profile pages
- [ ] Open Graph / social cards
- [ ] Open spec published to GitHub

---

## Current Focus
**Milestone 0 — Foundation**
Starting with: Next.js + Convex + Clerk setup, schema definition, brand system.
