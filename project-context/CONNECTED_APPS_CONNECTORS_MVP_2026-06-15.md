# Connected Apps + Connector/Crawler MVP

Date: 2026-06-15

Scope: You.md only. This is the native You.md personal API/MCP and connector layer. Do not route this MVP through h.computer, Creator.new, or any other product surface.

## What Shipped In This Slice

### Connected-App Grants

Added a first-class `connectedAppGrants` table and owner-managed grant API.

Purpose:

- Give You.md a product/app/agent grant primitive separate from owner API keys.
- Support app-level access to personal API/MCP resources without treating every integration as a full owner credential.
- Make grants previewable, revocable, expiring, scoped, and audit-ready.

Grant token shape:

```text
yg_<40 base62 chars>
```

Stored server-side as SHA-256 hashes only.

Grant resource scopes:

- `identity`
- `now`
- `projects`
- `sources`
- `memories`
- `preferences`
- `trust_rules`
- `stacks`
- `activity`

Grant action scopes:

- `identity:read`
- `identity:write`
- `now:read`
- `projects:read`
- `projects:write`
- `sources:read`
- `sources:write`
- `memories:read`
- `memories:write`
- `preferences:read`
- `preferences:write`
- `trust_rules:read`
- `trust_rules:write`
- `stacks:read`
- `stacks:write`
- `activity:read`
- `activity:write`

Write policies:

- `read_only`
- `propose`
- `approved_write`

Trust levels:

- `low`
- `medium`
- `high`
- `verified`

Code surfaces:

- `convex/schema.ts` — `connectedAppGrants`
- `convex/connectedApps.ts` — create/list/page/revoke/resolve-by-token-hash/last-used
- `convex/http.ts` — `yg_` HTTP/MCP auth, grant scope mapping, write-policy denial
- `convex/activity.ts` — grant-linked activity records
- `convex/connectedApps.test.ts`

### Connector Source Metadata

The `sources` table now stores connector metadata instead of only URL/type/status:

- `displayName`
- `connectorKind`
- `crawlerProvider`
- `refreshPolicy`
- `visibility`
- `trustLevel`
- `lastChangedAt`
- `nextRefreshAt`
- `failureCount`
- `metadata`

`me.addSource` now:

- Saves connector metadata from the dashboard.
- Defaults to private/manual/native/medium.
- Computes `nextRefreshAt` for non-manual refresh policies.
- Dedupes by exact URL instead of replacing every source with the same broad source type.

Code surfaces:

- `convex/schema.ts`
- `convex/me.ts`

### Lovable-Simple Connector UX MVP

The Sources pane now lets the owner choose:

- Connector kind: Website, GitHub, RSS, OKF, Webhook, JSON.
- Crawler provider intent: `native`, `firecrawl`, `agent-browser`, `manual`.
- Refresh cadence: manual, hourly, daily, weekly, monthly.
- Visibility: private, scoped, public.
- Trust: low, medium, high, verified.

Important guardrail:

- Firecrawl now executes only through the explicit pipeline provider path and fails closed if `FIRECRAWL_API_KEY` is not configured.
- Agent-browser remains fail-closed until a sandbox runner boundary is implemented.
- The hourly cron still does not execute expensive crawls, browser automation, or LLM extraction automatically.
- Rate limits, cost checks, monitored update summaries, and approval behavior remain the next safety layer before autonomous expensive work.

Code surface:

- `src/components/panes/SourcesPane.tsx`
- `convex/me.ts` — refresh now, pause, policy update, raw-version history
- `convex/sourceActions.test.ts`

### Source Refresh Cron Marker

Added a cheap refresh marker:

- `convex/sourceRefresh.ts` marks due owner sources as `pending`.
- `convex/crons.ts` runs it hourly.
- It advances `nextRefreshAt` according to the saved policy.
- It skips sources that are actively fetching/extracting.

Important guardrail:

- The cron does not run Firecrawl, agent-browser, Apify, OpenRouter, or the full pipeline.
- It only marks due sources as ready for the existing pipeline or a future approval-aware crawler worker.

Code surfaces:

- `convex/sourceRefresh.ts`
- `convex/sourceRefresh.test.ts`
- `convex/crons.ts`

## Crawler Provider Plan

### Native

Use for cheap static fetches:

- URL metadata.
- RSS/XML.
- JSON endpoints.
- Simple public pages.
- GitHub public raw/API reads where auth is unnecessary or already first-party.

Default behavior:

- Cheapest provider.
- First attempt for simple sources.
- Records immutable raw-source versions.

### Firecrawl

Use when a source needs hosted rendering, markdown conversion, crawl/map/extract, or schema-guided page extraction.

Implementation requirements before execution:

- `FIRECRAWL_API_KEY` server-side env.
- Per-user/provider rate limits.
- Cost estimate before run.
- Failure telemetry on source row.
- Cache/hash before LLM extraction.
- Provider result normalized into the existing immutable raw-source ledger.

Relevant current docs reviewed:

- `https://docs.firecrawl.dev/api-reference/endpoint/scrape`
- `https://www.firecrawl.dev/`

### agent-browser

Use when a source needs deterministic browser interaction:

- Dynamic UI.
- Authenticated owner-driven session later.
- Screenshots.
- Click/fill flows.
- Browser task transcripts that can become skills.

Implementation requirements before execution:

- Server-side runner boundary.
- Provider selection: local worker, Vercel Sandbox, Browser Use, Kernel, Browserbase, or similar.
- Snapshot/action logs saved to `activity` and source metadata.
- No owner secrets in browser tasks unless scoped and approved.
- Hard timeout and cost cap.

Relevant current docs reviewed:

- `https://github.com/vercel-labs/agent-browser`
- `https://agent-browser.dev/`
- `https://vercel.com/docs/sandbox`

### Manual

Use for:

- Raw markdown/OKF import.
- Webhook sources.
- Owner-pasted or CLI-pushed artifacts.
- Sources where automatic crawling would be noisy or unsafe.

## Next Implementation Slice

### P1: Personal API/MCP Grant Enforcement

Wire `yg_` connected-app grants into HTTP/MCP auth alongside `ym_` API keys:

- Detect `yg_` bearer tokens. **DONE**
- Resolve via `connectedApps.getByTokenHash`. **DONE**
- Enforce grant scopes and resource scopes. **DONE**
- Enforce write policy before mutations. **DONE**
- Record `agentActivity` with `agentSource: "connected-app"`. **DONE**
- Return explicit denied envelopes for missing/expired/revoked/scope-mismatched grants. **DONE**

### P2: Connector Details + Manual Refresh

Add owner actions:

- `refreshSourceNow(sourceId)` — marks one source pending. **DONE**
- `pauseSource(sourceId)` — clears `nextRefreshAt`. **DONE**
- `setSourcePolicy(sourceId, refreshPolicy, crawlerProvider, visibility, trustLevel)`. **DONE**
- Source detail pane with last version hash, next refresh, failure count, and provenance. **DONE**

### P3: Native + Firecrawl Runner

Add an approval-aware crawler worker:

- Native fetch first. **DONE**
- Firecrawl provider for selected sources when configured. **DONE**
- Save raw output through `recordRawSourceVersion`. **DONE**
- Set `lastChangedAt` only when content hash changes.
- Update `failureCount` and `errorMessage`.
- Never auto-run LLM extraction from cron without a separate policy.

### P4: agent-browser Sandbox Runner

Add browser task support only after the runner boundary is designed:

- Use an isolated sandbox/provider.
- Save compact action transcript.
- Optional screenshot artifact support.
- Convert successful repeated browser tasks into skill-learning inputs.

## Verification

This slice was verified with:

```bash
npx convex codegen --typecheck enable
npx vitest run convex/connectedApps.test.ts convex/sourceRefresh.test.ts convex/sourceActions.test.ts convex/pipeline/mutations.test.ts
npx tsc --noEmit
npm run lint
npm run docs:check
npm run agent-docs:handoff
git diff --check
```
