# You.md — Build Progress Tracker

Last Updated: 2026-03-16

## Milestone 0: Foundation — COMPLETE
- [x] Next.js 16 + Convex + Clerk + Tailwind v4
- [x] Full Convex schema (10 tables)
- [x] Brand system (9 colors, beam-glow, dark mode default)
- [x] Auth flow (sign-in, sign-up, claim)
- [x] Git repo + GitHub sync

## Milestone 1: Manual Identity Creation — COMPLETE
- [x] Structured dashboard editor (all identity fields)
- [x] Server-side bundle compilation (convex/lib/compile.ts)
- [x] Save + publish mutations
- [x] Public profile page at /[username]
- [x] CLI: init, build (local compile)
- [x] Landing page (hero, how-it-works, dual value prop)
- [x] 404 page

## Milestone 2: Ingestion Pipeline — COMPLETE (code written)
- [x] Pipeline orchestrator (convex/pipeline/orchestrator.ts)
- [x] Web fetch via native fetch (convex/pipeline/fetch.ts)
- [x] Apify integration for LinkedIn/X (convex/pipeline/fetch.ts)
- [x] LLM extraction via OpenRouter (convex/pipeline/extract.ts)
- [x] Voice analysis, topic mapping, bio generation, FAQ (convex/pipeline/analyze.ts)
- [x] Pipeline compilation (convex/pipeline/compile.ts)
- [x] All LLM prompts (convex/pipeline/prompts.ts)
- [x] Pipeline state management (convex/pipeline/mutations.ts)
- [x] HTTP endpoints: POST /me/build, GET /me/build/status
- [x] OpenRouter API key configured
- [ ] Apify API key (need from user)
- [ ] End-to-end pipeline test

## Milestone 3: Security + Sharing + Monetization — MOSTLY COMPLETE
- [x] API key management (convex/apiKeys.ts) — create, list, revoke, hash-based auth
- [x] Context links (convex/contextLinks.ts) — create, list, revoke, resolve
- [x] Context link HTTP endpoint (GET /ctx?token=xxx)
- [x] Scoped API keys (read:public, read:private, write:bundle)
- [x] Free tier gating (1 key, read:public only)
- [x] Dashboard: API keys management UI
- [x] Dashboard: context links management UI
- [x] Authenticated HTTP API (all /me/* endpoints)
- [ ] Private vault encryption (AES-256-GCM)
- [ ] Stripe integration for Pro plan
- [ ] Rate limiting

## Milestone 4: Polish + Launch — IN PROGRESS
- [x] Landing page
- [ ] CLI published to npm (ready to publish, needs npm login)
- [ ] End-to-end testing (sign up → claim → edit → publish → view)
- [ ] Open Graph / social cards
- [ ] SEO structured data on profiles
- [ ] Monitoring + alerting

## CLI Status
- [x] All 12 commands: init, login, register, whoami, status, build, publish, add, diff, preview, link, keys
- [x] API client (cli/src/lib/api.ts) talking to Convex
- [x] TypeScript compiles, dist/ builds clean
- [ ] npm publish (needs npm login)

## Environment Variables (Convex)
- [x] CLERK_JWT_ISSUER_DOMAIN
- [x] OPENROUTER_API_KEY
- [ ] APIFY_API_KEY

## Next Steps
1. npm login + publish CLI as `youmd`
2. Test full end-to-end flow locally
3. Test ingestion pipeline with a real URL
4. Deploy web app to Vercel
