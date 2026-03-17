# You.md — Feature Status

Last Updated: 2026-03-17

## v1 Core Features

### Spec & Data
- [x] Open spec you-md/v1 (directory-based identity bundles)
- [x] you.json compiled output schema
- [x] you.md entry file format
- [x] manifest.json with public/private/scoped paths
- [x] Bundle versioning

### Backend (Convex)
- [x] Users table with Clerk auth
- [x] Bundles table with versioning + publishing
- [x] Sources table with pipeline status tracking
- [x] Analysis artifacts table
- [x] API keys (SHA-256 hashed, scoped, ym_ prefix)
- [x] Context links (token-based, TTL, max uses, scope)
- [x] Private vault table (schema only, encryption deferred)
- [x] Pipeline jobs table
- [x] Profile views table (web + agent reads)
- [x] LLM chat proxy (convex/chat.ts)

### Ingestion Pipeline
- [x] Pipeline orchestrator
- [x] Website scraping (native fetch)
- [x] Apify integration (LinkedIn, X)
- [x] LLM extraction via OpenRouter (Claude Sonnet)
- [x] Voice profiling, topic mapping, bio generation, FAQ
- [x] Pipeline compilation to bundle
- [x] All prompt templates (per source type + analysis)
- [ ] End-to-end tested with real data

### HTTP API
- [x] GET /api/v1/profiles?username= (public you.json)
- [x] GET /api/v1/check-username?username= (availability)
- [x] GET /ctx?token= (context link resolution)
- [x] POST /api/v1/chat (LLM proxy for CLI)
- [x] GET /api/v1/me (authenticated profile)
- [x] POST /api/v1/me/bundle (save bundle)
- [x] POST /api/v1/me/publish (publish)
- [x] POST/GET /api/v1/me/sources (manage sources)
- [x] GET /api/v1/me/analytics (view counts)
- [x] POST /api/v1/me/build (trigger pipeline)
- [x] GET /api/v1/me/build/status (pipeline status)
- [x] CORS preflight for all endpoints

### Web Frontend
- [x] Landing page (Aurora, GradientText, BlurText, brand system)
- [x] Username claim page (real-time availability)
- [x] Dashboard (profile editor, save/publish, API keys, context links)
- [x] Public profile page (/[username])
- [x] Sign in / Sign up (Clerk)
- [x] 404 page
- [x] Light mode default
- [ ] OG social cards (auto-generated per profile)
- [ ] JSON-LD structured data verification

### CLI (npm: youmd)
- [x] 12+ commands (init, login, register, whoami, status, build, publish, add, diff, preview, link, keys)
- [x] API client talking to prod Convex
- [x] LLM chat proxy (works without user API key)
- [x] Interactive onboarding (Phase 1)
- [ ] **Conversational AI agent onboarding (PRD v2.0)** — building now
- [ ] **`youmd chat` command** — building now
- [ ] 50+ themed wait-state phrases
- [ ] Website fetching during onboarding
- [ ] Box-drawing profile previews
- [ ] Slash commands in chat (/status, /preview, /publish, /link, /help)

### Security
- [x] API key hashing (SHA-256)
- [x] Scoped keys (read:public, read:private, write:bundle)
- [x] Context link tokens (32-byte random)
- [x] Link expiry + revocation
- [x] Free tier limits (1 key, read:public only)
- [ ] Private vault AES-256-GCM encryption
- [ ] Rate limiting per plan

### Monetization
- [ ] Stripe integration
- [ ] Pro plan ($12/mo)
- [ ] BYOK support

## Post-v1 (NOT in scope)
- Interview mode (v1.1)
- MCP endpoint (v1.1)
- Custom domains (v1.1)
- Verified badges (v1.1)
- Profile theming (v1.2+)
- Team bundles (v2.0)
