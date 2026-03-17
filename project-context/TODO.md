# You.md — Build Progress Tracker

Last Updated: 2026-03-17

## Milestone 0: Foundation — COMPLETE
- [x] Next.js 16 + Convex + Clerk + Tailwind v4
- [x] Full Convex schema (10 tables + contextLinks)
- [x] Brand system (9 colors, beam-glow, dark/light mode)
- [x] Auth flow (sign-in, sign-up, claim)
- [x] Git repo + GitHub sync
- [x] Vercel deployment (youmd.vercel.app)
- [x] Convex production deployment (kindly-cassowary-600)

## Milestone 1: Manual Identity Creation — COMPLETE
- [x] Structured dashboard editor (all identity fields)
- [x] Server-side bundle compilation (convex/lib/compile.ts)
- [x] Save + publish mutations (convex/me.ts)
- [x] Public profile page at /[username]
- [x] CLI: init, build (local compile)
- [x] Landing page with brand system
- [x] 404 page

## Milestone 2: Ingestion Pipeline — COMPLETE (code written)
- [x] Pipeline orchestrator (convex/pipeline/)
- [x] Web fetch via native fetch
- [x] Apify integration for LinkedIn/X
- [x] LLM extraction via OpenRouter
- [x] Voice analysis, topic mapping, bio generation, FAQ
- [x] Pipeline state management
- [x] HTTP endpoints: POST /me/build, GET /me/build/status
- [x] OpenRouter API key configured on prod
- [ ] End-to-end pipeline test with real URL
- [ ] Apify API key (need from Houston)

## Milestone 3: Security + Sharing — COMPLETE
- [x] API key management (create, list, revoke, hash-based auth)
- [x] Context links (create, list, revoke, resolve)
- [x] Context link HTTP endpoint (GET /ctx?token=xxx)
- [x] Scoped API keys
- [x] Free tier gating (1 key, read:public only)
- [x] Dashboard: API keys + context links UI
- [x] Authenticated HTTP API (all /me/* endpoints)
- [ ] Private vault encryption (AES-256-GCM) — deferred
- [ ] Stripe Pro plan — deferred
- [ ] Rate limiting — deferred

## Milestone 4: Polish + Launch — IN PROGRESS
- [x] Landing page (brand system, Aurora, animations)
- [x] Light mode default
- [x] CLI published to npm (youmd)
- [x] LLM chat proxy (convex/chat.ts) — CLI uses server-side key
- [ ] **Conversational AI onboarding agent (PRD v2.0 §4.6)** — IN PROGRESS
- [ ] **`youmd chat` command** — IN PROGRESS
- [ ] End-to-end web testing (sign up -> claim -> edit -> publish -> view)
- [ ] OG social cards (Vercel OG / Satori)
- [ ] SEO structured data on profiles
- [ ] Custom domain (you.md) on Vercel
- [ ] Monitoring + alerting

## CLI Status
- [x] Published on npm as `youmd` (v0.2.x)
- [x] Commands: init, login, register, whoami, status, build, publish, add, diff, preview, link, keys
- [x] API client talking to prod Convex
- [x] LLM chat proxy (no user API key needed)
- [x] Interactive onboarding with AI conversation
- [ ] **PRD v2.0 conversational agent** — agent reads/reacts to sources, 50+ wait phrases, box-drawing UI, progressive personalization
- [ ] **`youmd chat`** — ongoing conversation command with slash commands
- [ ] Auto-bump version on publish

## Environment (Production)
- Convex: kindly-cassowary-600 (prod)
- Clerk: clerk.you.md (prod keys)
- Vercel: youmd.vercel.app
- npm: youmd package
- OpenRouter: configured on Convex prod
- Apify: NOT YET configured

## What's Next (Priority Order)
1. Finish conversational CLI agent (agent is building now)
2. Test + publish CLI v0.2.2
3. Test full web flow end-to-end
4. OG social cards for profile pages
5. Configure custom domain you.md on Vercel
6. Stripe integration (when ready for paying users)
