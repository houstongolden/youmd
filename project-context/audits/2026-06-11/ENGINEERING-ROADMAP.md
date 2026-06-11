# Engineering Roadmap — 2026-06-11

Deduped, prioritized tasks from the four dimension audits. Effort: S (< half day), M (1-3 days), L (1-2 weeks) with CC+gstack compression. Severity reflects merged cross-dimension judgment.

## P0 — Reliability (data loss, fleet risk, prod safety)

| # | Task | Sev | Effort | Files | Notes |
|---|------|-----|--------|-------|-------|
| 1 | Pull-side dirty check: refuse to overwrite local edits unless `--force`; fix sync's pull-then-push ordering hazard | Critical | M | `cli/src/commands/pull.ts`, `sync.ts` | Mirrors existing push-side guard (`push.ts:94-161`) |
| 2 | Three-way merge using the already-saved `base.json` (base vs local vs remote, per section) | Critical | M | `cli/src/commands/pull.ts`, new `cli/src/lib/merge.ts` | base.json saved at `pull.ts:140-141`; read only by push's size/diff guard (`push.ts:48-92`) and the compiler skeleton fallback (`compiler.ts:359-363`), never as a merge ancestor |
| 3 | Default install channel to npm; pin source installs to release tag + sha256; auto-upgrade health check (`youmd --version` post-install) with rollback | High | M | `src/app/install.sh/route.ts` | Today one bad main commit bricks the fleet in 12h |
| 4 | Atomic JSON persistence helper (tmp + rename + lockfile) replacing 66 raw `writeFileSync` calls in production source; `mode: 0o600` on config.json; corrupt file -> `.bak` not silent `{}` | High | S | `cli/src/lib/config.ts`, shared helper | Houston runs 4-6 parallel agents against one `~/.youmd` |
| 5 | CI gate on PRs: `tsc --noEmit` + `next build` + lint; convex deploy gains test step + dev-first promotion + post-deploy smoke | High | S | new `.github/workflows/ci.yml`, `convex-deploy.yml` | Smoke script already exists (`scripts/smoke-agent-docs.mjs`) |
| 6 | convex-test contract tests: MCP dispatch, authenticateRequest/API-key scoping, rate limit + spend cap, pipeline stage transitions | Critical | L | new `convex/__tests__/`, root package.json test script | 3,449-line http.ts currently has zero tests |
| 7 | Fix `lastPulledHash` ancestry bug (records draft hash while writing published content — defeats push divergence guard) | Med | S | `cli/src/commands/pull.ts:124-137` | Silent draft overwrite path |
| 8 | Bounded-batch rateLimits cleanup (by_timestamp index, take(1000), self-reschedule) | Med | S | `convex/lib/rateLimit.ts:77`, schema index | Full-table `.collect()` will throw at scale, then growth compounds |
| 9 | API client timeout + 1 retry with jitter; consistent offline message; later: `~/.youmd/outbox/` queue | Med | S | `cli/src/lib/api.ts:46` | Pattern already exists in `update.ts:42` |
| 10 | `pull`/`push` resolve home-first via `resolveActiveBundleDir()`; project-local `.youmd/` requires flag + writes `.gitignore` entry (private/ leak guard) | High | S | `cli/src/lib/config.ts:45-47`, pull/push/sync | Private notes currently committable to GitHub |
| 11 | Fix `fs.watch({recursive:true})` Linux/Node-18 crash (dirs are flat — drop recursive) or bump engines to >=20 | Med | S | `cli/src/commands/sync.ts:51`, `cli/package.json` | |
| 12 | `login --key`: verify via getMe() before persisting; keep old credentials on failure | Med | S | `cli/src/commands/login.ts:160-168` | |

## P1 — Performance & scale

| # | Task | Sev | Effort | Files | Notes |
|---|------|-----|--------|-------|-------|
| 13 | ISR for `/[username]` + `/profiles`; gate anonymous Convex live queries with `"skip"` until authed; render visitors from ssrData | High | M | `src/app/(app)/[username]/page.tsx:4`, `profile-content.tsx:130-164` | Cuts per-view lambda + WebSocket cost by the anonymous-traffic fraction |
| 14 | Server-assemble system prompt (Convex action keyed by session); reject client system messages in chat proxy | High | L | `convex/chat.ts:490-504`, `src/hooks/useYouAgent.ts`, `agent-utils.ts` | Closes injection hole, removes prompt IP from bundle |
| 15 | Lazy-load dashboard panes via `next/dynamic`; convert docs page to server component with client islands | Med | M | `dashboard-content.tsx:11-21`, `docs/docs-content.tsx` | Zero code-splitting exists today |
| 16 | profiles search index (`withSearchIndex`) for MCP `search_profiles` (currently in-memory filter over newest 500) | Med | S | `convex/profiles.ts:167-172`, `convex/http.ts:2917-2924`, schema | Silent discovery failure at scale |
| 17 | Per-section sha256 manifest (replace 32-bit simpleHash) -> delta push/pull, section-level conflict diagnosis; shared `canonicalJsonString` package for CLI + convex | Low | M | `cli/src/lib/compiler.ts:31-39`, `hash.ts` | Foundation for merge (#2) |
| 18 | Lossless round-trip: markdown as per-section source of truth; property test `decompile(compile(b)) == b` | High | L | `cli/src/lib/compiler.ts`, `decompile.ts` | Removes the data-mutation-per-sync-cycle class entirely |

## P2 — Developer experience & product polish

| # | Task | Sev | Effort | Files | Notes |
|---|------|-----|--------|-------|-------|
| 19 | Load JetBrains Mono + Inter via next/font with the CSS-expected variables | High | S | `src/app/layout.tsx` | Brand fonts currently never load for anyone without them installed locally |
| 20 | Replace hand-rolled viewport meta with `export const viewport`; drop `user-scalable=no` (WCAG 1.4.4) | High | S | `src/app/layout.tsx:31` | |
| 21 | ARIA live region (`role="log" aria-live="polite"`) on terminal chat; `role="status"` on ThinkingIndicator; skip link | Med | S | `src/components/terminal/TerminalShell.tsx`, (app) layout | Primary product surface is invisible to screen readers |
| 22 | Delete 12 dead landing sections + unused reactbits/ + `ogl` dep; collapse 5 diverging duplicate components to canonical copies | Med | M | `src/components/landing/`, `src/components/`, package.json | Diverging ThemeToggle copies are a live hydration bug risk |
| 23 | Route-level `loading.tsx` + `error.tsx` for [username]/profiles/dashboard; wire error boundaries to an error sink | Med | M | `src/app/(app)/` | |
| 24 | Single canonical host: pick apex `you.md`, flip Vercel redirect direction, or update hardcoded URLs + sitemap (prod currently 307s apex -> www while canonicals point at apex) | Med | S | `page.tsx:74,118,133`, `sitemap.ts:4` | SEO equity on profile pages |
| 25 | Add `llms.txt`, `shell`, `schema`, `install.sh` to middleware RESERVED_PATHS (agent UAs hitting /llms.txt currently pay a Convex profile lookup with 10s timeout) | Low | S | `src/proxy.ts:25-28,109` | |
| 26 | CLI version from package.json (delete hardcoded `CURRENT_VERSION = "0.6.23"`); gate postinstall banner on TTY + !CI; version-exists check in publish-cli.yml | Low | S | `cli/src/index.ts:55`, `postinstall.ts`, workflow | Documented repeat-pain class (CLAUDE.md mistake #3) |
| 27 | Fix spend-cap doc/code drift ($50 comments vs $500 constant); rename clerkId -> externalId in next schema window; pre-hydration theme script | Low | S | `convex/lib/spendCap.ts:7,27`, dashboard/users | |
| 28 | MCP tool-call test harness: in-memory .youmd fixture + mocked api client, table-driven over 24 tools | Med | M | `cli/src/__tests__/` | Becomes the shared contract suite for #30 |

## P3 — Self-improving / agentic infrastructure

| # | Task | Sev | Effort | Files | Notes |
|---|------|-----|--------|-------|-------|
| 29 | Observability: Sentry (Next.js + Convex), sanitized stable error codes (stop returning raw `err.message` to MCP clients), scheduled llms:smoke + API smoke every 30-60 min with alerts, `/api/v1/health` with spend/rate counters | High | M | `convex/http.ts:3075`, new workflow | Currently blind in prod |
| 30 | Unified MCP tool registry consumed by local + remote servers; official SDK Streamable HTTP transport with sessions/SSE; remote serves all 24 tools | High | M | `cli/src/mcp/server.ts`, `convex/http.ts:2748-3077`, new shared module | 5/24 advertised tools served today |
| 31 | Schedule audit forever-loop (Actions cron or CC routine; atomic `mkdir` lock) + weekly references:sync PR | Med | M | `audit/cycle-protocol.md`, new workflows | Dormant since 2026-05-21 |
| 32 | YouStack `workflows` manifest section (cron/event/manual triggers) + Convex per-user scheduler | Med | L | `cli/src/lib/youstack.ts`, convex scheduler | Routing today is static keyword scoring |
| 33 | First dreaming loop: nightly memory consolidation via existing Haiku summarizer, writing to memories + agentActivity | Med | M | `convex/chat.ts`, `convex/crons.ts`, `memories.ts` | Proves the pattern; identity improves while user sleeps |
| 34 | Playwright smoke: landing -> sign-in -> dashboard shell + anonymous profile render | Med | M | new e2e/ | Highest-traffic regression surfaces |

## Sequencing

- **Week 1:** #1, #3, #4, #5, #19, #20, #25 (see ONE-CLICK-IMPROVEMENT-PLAN.md for the top 3 as PRs)
- **Weeks 2-3:** #2, #6, #13, #14, #29
- **Weeks 3-5:** #30, #18, #17, #15, #22
- **Ongoing:** #31-#33 once #29 gives visibility
