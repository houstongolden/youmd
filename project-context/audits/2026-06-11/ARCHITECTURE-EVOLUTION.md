# Architecture Evolution — 2026-06-11

Current vs target architecture for scaling you.md to millions of users/agents while staying delightful for solo builders.

## Current Architecture

```mermaid
flowchart TB
    subgraph Clients
        B[Browser]
        A[AI agents / HTTP fetchers]
        C[youmd CLI 0.6.23]
        LM[Local stdio MCP - 24 tools]
    end

    subgraph Vercel["Vercel (Next.js 16)"]
        MW["proxy.ts middleware<br/>UA-aware agent interception"]
        P["/[username] page<br/>force-dynamic SSR (every view = lambda)"]
        DASH["Dashboard client bundle<br/>SYSTEM_PROMPT + 4.5k lines agent logic"]
        PROXY["/api/v1/* proxies"]
        INST["install.sh route<br/>defaults: git clone main HEAD"]
    end

    subgraph Convex["Convex (kindly-cassowary-600)"]
        HTTP["http.ts (3,449 lines, 59 routes + 46 CORS preflights)<br/>ZERO tests"]
        RMCP["Remote MCP: hand-rolled JSON-RPC<br/>5 tools (advertises 24)"]
        CHAT["chat.ts LLM proxy<br/>trusts client system message"]
        CRON["3 maintenance crons<br/>rateLimits cleanup = full table scan"]
        DB[(31 tables)]
    end

    OR[OpenRouter LLMs]

    B --> MW --> P
    B --> DASH -->|"client-assembled system prompt"| CHAT --> OR
    P -->|"SSR fetch (revalidate 60)"| HTTP
    B -.->|"duplicate anonymous WebSocket<br/>3-5 live queries per visitor"| DB
    A --> MW
    A --> RMCP
    C -->|"no timeout/retry"| HTTP
    C -->|"pull overwrites local, no merge"| C
    LM --> HTTP
    INST -->|"curl|bash every 12h, unpinned"| C
    HTTP --> DB
    CRON --> DB

    style P fill:#5c2e2e
    style DASH fill:#5c2e2e
    style RMCP fill:#5c2e2e
    style INST fill:#5c2e2e
    style CHAT fill:#5c4a2e
```

Red nodes: scale or security hazards. Amber: trust-boundary defect.

### Current pain points (deduped across all four audits)

| # | Pain | Root cause |
|---|---|---|
| 1 | Per-view lambda + WebSocket cost on profiles | force-dynamic + ungated anonymous Convex subscriptions |
| 2 | Prompt IP + injection surface in browser | client-assembled system prompt, pass-through proxy |
| 3 | Identity data mutates/loses on sync | lossy regex round-trip; pull has no dirty check; base.json never used as a merge base (only read by push's size/diff guard and the compiler skeleton fallback) |
| 4 | Fleet-wide brick risk | unpinned source install + 12h curl-bash auto-upgrade |
| 5 | Untested prod deploys | zero convex/src tests; push-to-main = prod deploy, no gate |
| 6 | MCP claim/reality gap | two unshared tool registries (24 local vs 5 remote) |
| 7 | Blind in production | no error tracking, no scheduled smoke, raw errors to clients |
| 8 | Self-improvement dormant | audit loop + reference sync exist but unscheduled |

## Target Architecture

```mermaid
flowchart TB
    subgraph Clients
        B[Browser]
        A[AI agents]
        C[youmd CLI]
        LM[Local MCP]
    end

    subgraph Edge["Vercel Edge/CDN"]
        MW["middleware: allowlist-based routing<br/>(reserved paths shared with router)"]
        ISR["/[username] ISR pages<br/>revalidateTag on publish — CDN-served"]
        DOCS["docs: server component<br/>+ client islands"]
    end

    subgraph App["Next.js app"]
        DASHV2["Dashboard: thin client<br/>lazy-loaded panes (next/dynamic)"]
    end

    subgraph Convex["Convex"]
        REG["Shared MCP tool registry<br/>(one module, CLI + remote)"]
        RMCP2["Remote MCP: official SDK<br/>Streamable HTTP + sessions, 24 tools"]
        CHATV2["chat action: server-assembled<br/>system prompt by session"]
        SRCH["profiles search index<br/>(withSearchIndex)"]
        WF["YouStack workflows engine<br/>cron/event triggers per user"]
        DREAM["Dreaming loops:<br/>memory consolidation, source freshness,<br/>stack smoke — writes agentActivity"]
        DB[(tables + bounded-batch maintenance)]
    end

    subgraph CI["CI/CD"]
        GATE["PR gate: tsc + next build + lint<br/>+ vitest (web, convex-test, CLI)"]
        PROMO["convex: dev deploy → smoke → prod promote"]
        SMOKE["scheduled llms:smoke + API smoke<br/>every 30-60 min → alert"]
        REF["weekly references:sync → PR"]
    end

    subgraph Dist["Distribution"]
        NPM["npm releases (default channel)<br/>version-exists check pre-publish"]
        SRC["source channel: tag-pinned,<br/>sha256-verified, health-check + rollback"]
    end

    subgraph Local["Local-first CLI"]
        MERGE["pull: dirty check + 3-way merge<br/>(base vs local vs remote, per section)"]
        ATOMIC["atomic writes (tmp+rename)<br/>+ lockfile on ~/.youmd"]
        LOSSLESS["markdown = source of truth<br/>decompile(compile(b)) == b"]
    end

    OBS["Sentry + health endpoint<br/>+ agentActivity dashboards"]

    B --> ISR
    B --> DASHV2 -->|"user turns + conversation id only"| CHATV2
    A --> MW --> ISR
    A --> RMCP2
    REG --> RMCP2
    REG --> LM
    C --> MERGE --> ATOMIC
    C --> LOSSLESS
    NPM --> C
    GATE --> PROMO --> Convex
    SMOKE --> OBS
    WF --> DREAM --> DB
    CHATV2 --> DB
    SRCH --> RMCP2
```

## Migration Notes

Ordered to avoid rework; each phase is independently shippable.

### Phase 1 — Stop the bleeding (this week)
1. **ISR profiles**: remove `force-dynamic` from `src/app/(app)/[username]/page.tsx`; gate `useQuery` calls in `profile-content.tsx` with `"skip"` until `useConvexAuth` confirms a session; render anonymous visitors purely from `ssrData`. No schema change.
2. **CI gate**: one workflow running `tsc --noEmit` + `next build` + `npm run lint` on every PR. Add a test+smoke job as dependency of `convex-deploy.yml`; flip prod deploy to dev-first promotion.
3. **Install channel**: default `INSTALL_CHANNEL` to `npm` in `src/app/install.sh/route.ts`; pin source channel to a release tag; add `youmd --version` health check + rollback to the auto-upgrade helper.
4. Fonts, viewport, RESERVED_PATHS additions — trivial one-file fixes bundled into Phase 1 PRs.

### Phase 2 — Trust boundaries and sync safety (1-2 weeks)
1. **Server-side prompt assembly**: new Convex action accepts `{conversationId, userTurns}`; assembles SYSTEM_PROMPT + identity context server-side; `convex/chat.ts` rejects client system messages. Client keeps parsing/rendering logic only. Migrate dashboard + CLI chat callers in the same PR set.
2. **Pull-side merge**: dirty check before `decompileToFilesystem` (compare local bundle hash vs `lastPushedHash`); refuse or prompt unless `--force`; then per-section 3-way merge using the already-saved `base.json`. Fix `lastPulledHash` to record the hash of the bundle actually written (not the draft's).
3. **Atomic writes**: one persistence helper (tmp + `renameSync` + lockfile) replacing the 92 raw `writeFileSync` calls; `mode: 0o600` on config.json; preserve corrupt files as `.bak`.

### Phase 3 — MCP unification (2-3 weeks)
1. Extract tool definitions from `cli/src/mcp/server.ts` into a shared registry module (name, schema, handler interface). Local server consumes directly; remote handler maps registry handlers onto Convex `runQuery`/`runMutation`.
2. Replace the hand-rolled JSON-RPC switch in `convex/http.ts:2748-3077` with the official MCP SDK Streamable HTTP transport (Node runtime route or spec-compliant Convex implementation with `Mcp-Session-Id` + SSE).
3. Add `withSearchIndex` on profiles for `search_profiles`; sanitize all MCP error responses to stable codes.
4. Contract test suite over the registry (table-driven, ~24 cases) shared by both servers.

### Phase 4 — Lossless identity + delta sync (3-4 weeks)
1. Extend raw-markdown-field pattern to about/bio, projects, custom sections; parsed fields become server-derived metadata. Property test on `cli/examples/` fixtures.
2. Replace 32-bit `simpleHash` manifest entries with per-section sha256 (reuse `sha256File` from youstack.ts) — enables delta push/pull and section-level conflict diagnosis.
3. Extract `canonicalJsonString` into a shared package consumed by CLI and convex/ to kill cross-implementation hash drift.

### Phase 5 — Self-improving infrastructure (ongoing)
1. Schedule the audit loop (GitHub Actions cron or Claude Code routine) with an atomic `mkdir` lock replacing the `touch` lock; weekly `references:sync` cron opening a PR.
2. Add `workflows` to the YouStack manifest schema (`trigger: cron|event|manual`, steps referencing capabilities); Convex scheduler executes per user.
3. First dreaming loop: nightly memory consolidation via the existing Haiku summarizer in `convex/chat.ts`, writing results into `memories` + `agentActivity` — identity visibly improves while the user sleeps.
4. Observability substrate: Sentry on Next.js + Convex, `/api/v1/health` exposing spend-cap/rate-limit counters, agentActivity-backed agent-traffic dashboards.
