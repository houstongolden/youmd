# You.md — Ship Readiness Audit (2026-04-16)

Status: Phase 1 evidence pass started
Owner: Houston + coding agents

## What Was Actually Tested

### Local CLI / Skill / MCP
- `node cli/dist/index.js --help`
- `node cli/dist/index.js skill list`
- `node cli/dist/index.js mcp --json`
- `node cli/dist/index.js skill init-project --mode scaffold` in a fresh temp repo
- `node cli/dist/index.js skill init-project --mode additive` in an existing temp repo with hand-written `AGENTS.md` and partial `project-context/`
- `HOME=$(mktemp -d) node cli/dist/index.js mcp --install claude --auto`

### Build / Test Baseline
- `npm --prefix cli test`
- `npm --prefix cli run build`
- `npm run build`
- local `next start --port 4010` with direct curls to:
  - `/.well-known/mcp.json`
  - `/api/v1/mcp`

### Live API / MCP
- `GET https://kindly-cassowary-600.convex.site/api/v1/profiles`
- `GET https://kindly-cassowary-600.convex.site/api/v1/profiles?username=houstongolden`
- `GET https://kindly-cassowary-600.convex.site/api/v1/profiles?username=houstongolden` with `Accept: text/plain`
- `POST https://kindly-cassowary-600.convex.site/api/v1/mcp`:
  - `tools/list`
  - `resources/list`
  - `tools/call search_profiles`
  - `tools/call get_identity`
  - `tools/call get_my_identity` without auth

## Confirmed Findings

### Fixed In This Pass
- Public MCP discovery on the web domain was broken.
  - `https://you.md/.well-known/mcp.json` redirected to `www` and ended in a 404 page.
- Public MCP transport on the web domain was broken.
  - `https://you.md/api/v1/mcp` redirected to `www` and ended in a 404 page.
- The web shell still advertised the old 4 bundled skills even though the shipped set is 6.
- Portrait updates in the web shell still depended on JSON block parsing instead of first-class tool-use fields.
- CLI integration tests were brittle against production reality because they assumed old sample usernames and a stricter public-profile shape than live prod guarantees.

### Still True / Still Important
- The live MCP surface is currently small and public-read focused:
  - `get_identity`
  - `search_profiles`
  - `get_my_identity`
- Public profile completeness is inconsistent across seeded/public profiles.
  - Some public profiles have `identity.tagline` and `bio` but no `identity.name`.
  - Some public profiles do not expose non-empty `youMd` in the JSON payload.
- Local CLI authenticated flows were not exercised in this pass because the current machine was not logged in through `youmd`.

## Fixes Landed

### Web Domain MCP
- Added Next route proxy for `/.well-known/mcp.json`
- Added Next route proxy for `/api/v1/mcp`
- Allowed both routes in `robots.txt`

### Web Agent Reliability / Truth
- Updated the web shell skill notices and bundled-skill guidance from 4 → 6 skills
- Extended the main `update_profile` tool schema with:
  - `avatar_url`
  - `avatar_source`
- Updated the web shell to prefer tool-use portrait updates before falling back to JSON parsing
- Updated the agent instructions to tell the model to use the tool path first for portrait changes

### CLI Contract Tests
- Reworked the API integration tests to validate the live production contract instead of hard-coding stale sample usernames and assuming every public profile has the same shape as Houston's

## Current Ship-Readiness Read

### Stronger Than Before
- Repo bootstrap / skill linking / MCP install flows
- Public MCP discovery + transport story on the web domain
- Bundled-skill truth consistency between CLI and web shell messaging
- Portrait mutation path reliability in the web shell

### Not Yet Ship-Ready
- Full authenticated CLI flow:
  - `register`
  - `login`
  - `push`
  - `pull`
  - `sync`
  - `publish`
- Web shell end-to-end mutation QA with real user journeys
- Local vs web parity audit beyond static/code inspection
- Personality / proactiveness audit based on live interaction transcripts
- Production verification after deploy for the new MCP web-domain proxy routes

## Next Phase 1 Tasks
- Verify `https://you.md/.well-known/mcp.json` and `https://you.md/api/v1/mcp` in production after deploy
- Run authenticated CLI smoke tests using a real account
- Build a documented endpoint matrix for public vs authenticated APIs
- Exercise the web shell against concrete mutation journeys:
  - profile file updates
  - custom sections
  - portrait changes
  - memory saves
  - private context writes
- Compare local CLI agent tone/initiative against the web shell with side-by-side prompts
