# You.md — Ship Readiness Audit (2026-04-16)

Status: Phase 1 hardening pass substantially complete
Owner: Houston + coding agents

## What Was Actually Tested

### Local CLI / Skill / MCP
- `node cli/dist/index.js --help`
- `node cli/dist/index.js skill list`
- `node cli/dist/index.js mcp --json`
- `node cli/dist/index.js skill init-project --mode scaffold` in a fresh temp repo
- `node cli/dist/index.js skill init-project --mode additive` in an existing temp repo with hand-written `AGENTS.md` and partial `project-context/`
- `HOME=$(mktemp -d) node cli/dist/index.js mcp --install claude --auto`
- Fresh-account authenticated CLI smoke tests in isolated `HOME` + workspace:
  - `register`
  - `login`
  - `login --key`
  - `whoami`
  - `init --example priya`
  - `build`
  - `push`
  - `pull`
  - `diff`
  - `status`
  - `keys list`
  - `sync`

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
- Live auth smoke against production:
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/login`
  - `GET /api/v1/me` with register-issued and login-issued keys
- Live chat surface smoke against production:
  - `POST /api/v1/chat/ack`
  - `POST /api/v1/chat`
  - `POST /api/v1/chat/stream`

### Browser / Web Shell QA
- Public profile page smoke in headless browser
- Docs page smoke in headless browser
- Auth-shell smoke for `/sign-in`, `/sign-up`, and `/shell`
- Clerk sign-in attempt with a fresh throwaway account in headless browser

## Confirmed Findings

### Fixed In This Pass
- Public MCP discovery on the web domain was broken.
  - `https://you.md/.well-known/mcp.json` redirected to `www` and ended in a 404 page.
- Public MCP transport on the web domain was broken.
  - `https://you.md/api/v1/mcp` redirected to `www` and ended in a 404 page.
- The web shell still advertised the old 4 bundled skills even though the shipped set is 6.
- Portrait updates in the web shell still depended on JSON block parsing instead of first-class tool-use fields.
- CLI integration tests were brittle against production reality because they assumed old sample usernames and a stricter public-profile shape than live prod guarantees.
- CLI auth resolution was brittle against the live `/api/v1/me` shape because it assumed flat user fields instead of the nested `user` payload.
- CLI public-profile reads were brittle against the real content type (`application/vnd.you-md.v1+json`) and treated valid profile payloads as raw text.
- `push` did not persist local publish state, so `status` could keep saying `publish never` after a successful publish.
- `pull`/`diff` round-trips were not clean because the CLI was:
  - ingesting web-only `_profile` transport metadata into the local bundle
  - materializing scaffold/default markdown during decompile
  - rendering empty `preferences.writing` blocks as real file diffs
  - hashing public-profile JSON without the markdown variant, causing false `local ahead` status after a clean pull
- The web shell was still serializing on `/api/v1/chat/ack`, which meant the "fast acknowledgement" added roughly 1.1s-1.2s of guaranteed latency before the main streamed response could even begin.
- The web shell could still end a turn with no visible response if the model stream never emitted tokens or tool calls.
- The web/docs/API story still contradicted itself because `/api/v1/chat*` was documented as a web surface while the actual routes only lived on the Convex hostname.
- Active auth/shell/docs copy still had stale phrasing such as `v0.1.0`, `dashboard`, deprecated password endpoints, and a fake `youmd mcp connect` command.

### Still True / Still Important
- The live MCP surface is currently small and public-read focused:
  - `get_identity`
  - `search_profiles`
  - `get_my_identity`
- Public profile completeness is inconsistent across seeded/public profiles.
  - Some public profiles have `identity.tagline` and `bio` but no `identity.name`.
  - Some public profiles do not expose non-empty `youMd` in the JSON payload.
- The browser-auth path still has a real open issue:
  - headless sign-in reaches the custom terminal auth UI, accepts input, then stalls on Clerk `sign_ins` network requests with no surfaced error or redirect
- Web-agent parity/personality still needs a deeper transcript-based audit beyond raw endpoint health.

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
- Stopped blocking the main shell reply on `/api/v1/chat/ack`; the ACK now runs in parallel and only shows if the real response has not started yet
- Added a visible fallback message when the model stream terminates without any text or tool calls instead of leaving the user with silent nothingness
- Added same-origin Next proxies for `/api/v1/chat`, `/api/v1/chat/ack`, and `/api/v1/chat/stream`, then pointed the web shell at those routes so the shell, docs, and public API surface match
- Synced active shell/auth/docs copy to the shipped product: no more stale `v0.1.0`, no more `redirecting to dashboard...`, no more deprecated password endpoint docs, and no more fake `youmd mcp connect`

### CLI Contract Tests
- Reworked the API integration tests to validate the live production contract instead of hard-coding stale sample usernames and assuming every public profile has the same shape as Houston's
- Added CLI API tests for:
  - nested-vs-legacy `/me` user extraction
  - vendor `+json` public-profile parsing
  - decompile/compiler behavior around empty/default-only sections

### CLI/Auth/Sync Hardening
- `login --key`, `whoami`, and `status` now resolve the nested live `/api/v1/me` response correctly
- `getPublicProfile()` now:
  - parses vendor `+json` responses
  - strips web-only `_profile` transport fields before treating the payload as canonical bundle data
  - fetches the markdown variant as well, so `pull` restores `you.md` and local hashes match the live remote bundle
- `push` now records `lastPublished`, so local status reflects successful publish operations
- `pull` now preserves the real remote content hash for sync status instead of computing a false local drift value
- Decompile/compile/diff round-trips were tightened so a fresh publish → pull → diff now returns cleanly with `no changes -- local matches remote`

## Current Ship-Readiness Read

### Stronger Than Before
- Repo bootstrap / skill linking / MCP install flows
- Public MCP discovery + transport story on the web domain
- Public chat story on the web domain for the shell itself
- Bundled-skill truth consistency between CLI and web shell messaging
- Portrait mutation path reliability in the web shell
- First visible shell response path, because the UI no longer forces the ACK to finish before streaming the real answer
- Authenticated CLI/account flow:
  - fresh account creation
  - email/password login
  - API-key login
  - whoami/status
  - push/publish/pull/diff/sync
  - API key listing
- Clean publish → pull → diff → status round-trip on the live production service

### Not Yet Ship-Ready
- Web shell end-to-end mutation QA with real user journeys
- Local vs web parity audit beyond static/code inspection
- Personality / proactiveness audit based on live interaction transcripts
- Browser-based auth reliability in headless/QA conditions
- Production verification after each deploy for the MCP + chat web-domain proxy routes and auth shell behavior

## Next Phase 1 Tasks
- Verify `https://you.md/.well-known/mcp.json` and `https://you.md/api/v1/mcp` in production after each deploy
- Build a documented endpoint matrix for public vs authenticated APIs
- Exercise the web shell against concrete mutation journeys:
  - profile file updates
  - custom sections
  - portrait changes
  - memory saves
  - private context writes
- Isolate the Clerk headless sign-in stall and determine whether it is:
  - a real production auth bug
  - a headless/browser-automation incompatibility
  - or a custom terminal-auth flow bug in the web shell
- Compare local CLI agent tone/initiative against the web shell with side-by-side prompts
