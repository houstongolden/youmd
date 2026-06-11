# Tech Stack Audit — 2026-06-11

Synthesis of four dimension audits (frontend, CLI/local-first, API/MCP/backend, agentic infrastructure). Every claim below was verified against the repo at synthesis time.

## Current-State Scorecard

| Layer | Grade | What's strong | What's broken | Key evidence |
|---|---|---|---|---|
| Web app (Next.js 16) | C+ | Agent-facing SSR is excellent: JSON-LD, sr-only fallbacks, UA-aware middleware, security headers | force-dynamic + duplicate anonymous Convex live queries per profile view; brand fonts never loaded; WCAG zoom block; zero tests | `src/app/(app)/[username]/page.tsx:4`, `src/app/layout.tsx:31`, no `next/font` anywhere in `src/` |
| You Agent (client) | C- | Rich orchestration, personality, parsing | Full SYSTEM_PROMPT + ~4.5k lines of agent logic ship in client bundle; chat proxy trusts client-supplied system message | `src/hooks/agent-utils.ts:426`, `convex/chat.ts:490-504` |
| CLI (youmd 0.6.23) | B- | sha256 push ancestry + 409 conflict protocol, YouStack manifest validation, 69 green tests, graceful MCP offline envelopes | `pull`/`sync` overwrite local edits with no dirty check or merge (base.json saved but never used as a merge base — only read by push's size/diff guard and the compiler skeleton fallback); lossy compile<->decompile round-trip; 66 non-atomic writes in production source; no HTTP timeouts | `cli/src/commands/sync.ts:84-93`, `cli/src/lib/decompile.ts`, `cli/src/lib/config.ts:101-106` |
| Install/update channel | D | Single curl command, auto-upgrade exists | Defaults to unpinned `git clone` of main HEAD; auto-upgrade re-pipes curl-bash every 12h; one bad commit bricks the fleet, no rollback | `src/app/install.sh/route.ts:11,53,110` |
| Convex backend + API | C | Layered LLM abuse defense (rate limit + spend cap), agentActivity audit trail, sane deploy scripts | Zero tests on a 3,449-line http.ts; push-to-main auto-deploys to prod with no gate; unbounded rateLimits table scan; spend-cap doc says $50, code says $500 | `.github/workflows/convex-deploy.yml:39`, `convex/lib/rateLimit.ts:77`, `convex/lib/spendCap.ts:7,27` |
| MCP surfaces | C- | Local stdio server: 24 tools, defensive, local-first fallbacks | Remote server exposes only 5 of the advertised 24 tools; hand-rolled JSON-RPC, no Streamable HTTP sessions, no shared tool registry; search_profiles caps at newest 500 profiles | `convex/http.ts:2788-2854`, `cli/src/mcp/server.ts:1379-1701`, `convex/profiles.ts:167-172` |
| Docs pipeline | A- | Generated, drift-checked, CI-gated (agent-docs:ci); README/version marker enforcement | llms:smoke exists but never runs automatically | `.github/workflows/agent-docs.yml`, `scripts/smoke-agent-docs.mjs` |
| Observability | F | agentActivity table is the right substrate | No error tracking, no metrics, no alerts, raw error messages returned to MCP clients, errors console-only | `convex/http.ts:3075`, no sentry/posthog/axiom in any package.json |
| Self-improving infra | D+ | Audit forever-loop protocol + reference-intelligence sync exist as real scaffolds | Audit loop dormant since 2026-05-21; references:sync manual-only; only 3 maintenance crons; YouStack routing is static keyword scoring | `audit/cycle-protocol.md`, `convex/crons.ts:28-52`, `cli/src/lib/youstack.ts:794-819` |
| Testing/CI overall | D | CLI: 12 suites / 69 tests, gated in publish-cli.yml | Web app and Convex backend: zero tests, no build/lint/typecheck CI on PRs | only `cli/vitest.config.ts` exists; root package.json has no test script |

## Strategic Tech Decisions

### 1. Next.js 16 + Vercel for web — KEEP, evolve rendering strategy
The framework is right; the rendering config is wrong. Move `/[username]` from force-dynamic to ISR (`revalidate`/`revalidateTag` on publish) and gate client Convex subscriptions behind authenticated viewers. The SSR-for-agents work (JSON-LD, UA interception) is a genuine moat — keep it. At millions of profile views, ISR + skipped anonymous WebSockets is the difference between linear lambda/Convex cost and near-flat CDN cost.

### 2. Convex as backend + DB — KEEP, with a hard quality-gate condition
Convex's reactive model fits the product, and the rate-limit/spend-cap work shows maturity. But "keep" is conditional on: (a) convex-test contract tests for auth, MCP dispatch, and pipeline; (b) dev-deploy -> smoke -> prod promotion in CI; (c) bounded-batch patterns for table maintenance (rateLimits scan will hard-fail at scale and then compound). Without these, Convex's deploy-on-merge speed is a liability, not a feature.

### 3. Hand-rolled remote MCP server — REPLACE with official MCP SDK + shared tool registry
The flagship "MCP where the context is you" surface advertises 24 tools and serves 5, with no sessions or SSE. Replace the switch-statement handler with the official SDK Streamable HTTP transport and extract one tool-registry module consumed by both `cli/src/mcp/server.ts` and the remote handler so counts can never diverge. This is the single biggest claim-vs-reality gap in the product.

### 4. curl-bash source-channel installer + 12h auto-upgrade — REPLACE with npm-first pinned releases
The agentic-first install story is right; the implementation (unpinned main HEAD, no checksum, fleet-wide 12h re-execution) is a supply-chain and reliability hazard. Default `INSTALL_CHANNEL` to npm (versioned, immutable), pin source installs to tags with sha256 verification, and add a post-install health check + rollback to the auto-upgrade helper.

### 5. Regex compile<->decompile identity pipeline — EVOLVE to markdown-as-source-of-truth
The lossy round-trip (bio short/medium/long collapse, tagline heuristics, directive re-parsing) mutates identity data on every sync cycle — the push-side ">50% smaller" guard is an admission of the problem. Extend the existing raw-`markdown`-field pattern (already used by preferences/voice/agent_directives) to all sections; parsed fields become derived metadata. Add the property test `decompile(compile(bundle)) == bundle`. This unblocks safe three-way merge (base.json is already saved on every pull; today it is only read for push's size/diff guard and the compiler skeleton, never as a merge ancestor) and true local-first.

### 6. Client-side You Agent orchestration — EVOLVE to server-assembled prompts
Move SYSTEM_PROMPT + context assembly into a Convex action keyed by session; client sends only user turns + conversation id. Removes prompt IP from the bundle, closes the arbitrary-system-prompt hole in `convex/chat.ts:490-504`, shrinks dashboard JS, and is the prerequisite for per-user prompt versioning and the "dreaming" loops in the roadmap.
