# You.md — Feature Requests & Decisions

Last Updated: 2026-03-16

## v1 Features (Committed)

### Core
- [ ] Open spec you-md/v1 (directory-based identity bundles)
- [ ] Convex backend (reactive, serverless, TypeScript-native)
- [ ] Clerk auth with username claim
- [ ] Public profile pages (SSR, dark mode default)
- [ ] Structured profile editor (web)
- [ ] Bundle compilation (you.json, you.md, manifest.json)

### Ingestion Pipeline
- [ ] Perplexity Sonar for discovery
- [ ] Firecrawl for web scraping
- [ ] Apify for LinkedIn/X scraping
- [ ] OpenRouter for LLM extraction + analysis
- [ ] Voice profiling, topic mapping, bio variants, narrative arcs, FAQ generation
- [ ] Human-in-the-loop review before publish

### CLI (`youmd`)
- [ ] init, login, register, add, build, preview, diff, publish, status
- [ ] Key management (list, create, revoke)
- [ ] Context links (create, list, revoke)
- [ ] Config (BYOK keys for Pro)
- [ ] Skill export

### Security
- [ ] AES-256-GCM private vault encryption
- [ ] API key hashing (SHA-256, ym_ prefix)
- [ ] Scoped API keys
- [ ] Rate limiting (Free: 30/min, Pro: 120/min)
- [ ] Hard delete on account deletion

### Monetization
- [ ] Free tier (3 pipeline runs, 1 API key, public profile)
- [ ] Pro tier ($12/mo — BYOK, private vault, unlimited pipeline, scoped keys)
- [ ] Stripe integration

### Sharing
- [ ] Context links with scope (public/full) and TTL
- [ ] Auto-generated Open Graph cards
- [ ] JSON-LD structured data on profile pages

---

## Post-v1 Features (NOT in scope — for awareness only)

| Feature | Target | Notes |
|---|---|---|
| Interview mode | v1.1 | Interactive identity building via conversation |
| MCP endpoint | v1.1 | mcp.you.md/<username> |
| Custom domains | v1.1 | DNS + Vercel config |
| Profile analytics | v1.1 | Views, agent reads |
| Verified badges (people) | v1.1 | Domain, LinkedIn, GitHub verification |
| Verified badges (business) | v1.2 | Higher bar, manual review |
| Autonomous refresh | v1.2 | youmd refresh with approval flow |
| Voice onboarding | v1.2 | Depends on interview mode |
| Identity network directory | v1.2 | Needs ~1,000 profiles |
| Profile page theming | v1.2+ | After standardized design proven |
| Newsletter subscribe embed | v1.2+ | After profile page stable |
| Team/org bundles | v2.0 | Multi-tenant architecture |
| Self-host export | v2.0 | youmd export command |
| Plugin marketplace | v2.0+ | Ecosystem traction needed |

---

## Open Decisions

1. **Clerk plan** — Which tier? Organizations needed for future team bundles?
2. **Scraping fallback** — What if Apify LinkedIn scraper breaks? Manual paste? Browser extension?
3. **LLM model selection** — Fast (Haiku-tier) for extraction, strong (Sonnet-tier) for analysis?
4. **Username policy** — Min/max length, allowed characters, reserved words
5. **Private vault UX** — Decrypt in browser or CLI/API only?
6. **Convex limits** — Validate file storage + document size for large bundles
