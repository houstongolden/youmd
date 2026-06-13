# L-Series Execution Plan — 2026-06-12

Self-contained implementation plans for the three remaining L-series lanes. A resuming agent can dispatch these as `Agent({model: "sonnet", ...})` calls (or execute inline) without reading the full audit deliverables.

**Status at handoff:** ~100 backlog items shipped as ~110 commits on `main`, all prod-verified. `main` is clean and green. Convex prod is `kindly-cassowary-600.convex.site`; web prod is `https://www.you.md`. Gated `Convex Deploy` workflow auto-runs on push touching `convex/**`; pick `environment=prod` when dispatching manually.

**Authoritative state:** `project-context/audits/2026-06-11/MASTER-BACKLOG.md` (statuses + commit SHAs). Update it after each item.

**Recurring guards** (apply to every lane below):
- Never commit `project-context/reference-intelligence/{LATEST,TASKS}.md` — pre-existing user edits.
- Stash those two files around any `npm run docs:generate` (the generator reads `LATEST.md`).
- Don't touch the host-link engine (`cli/src/lib/host-link.ts`) internals — call its exports.
- Standard test commands: `npm run test:convex`, `cd cli && npm test`, `npx tsc --noEmit`, `npm run lint`.
- After Convex deploy: e2e against `https://kindly-cassowary-600.convex.site`.
- Convex tests = 237 baseline; CLI tests = 292 baseline. New tests add to those.

---

## Lane A — L9 / L10: skill outcome telemetry (closes the self-improvement loop)

**File lane:** `convex/` (you own `convex/http.ts`) + `cli/src/commands/skill.ts` + `cli/src/lib/skills.ts` + one additive function in `cli/src/lib/api.ts` + tests.

**Off-limits:** `cli/src/commands/stack.ts`, `cli/src/lib/youstack.ts`, `cli/src/lib/host-link.ts`, `convex/crons.ts`, `convex/consolidation.ts` (Lane C owns those), all of `src/`.

**Context to preserve in `convex/http.ts`:** standard error envelope (`errorResponse` / `sanitizedServerErrorEnvelope`), `guardWrite` rate limits, `Idempotency-Key`, `requireScope`, 9-tool hosted MCP (incl. `search_memories`), `/api/v1/health`, route trailing comments feed the docs generator.

### L9 — skill outcome telemetry
1. **Schema (additive)** in `convex/schema.ts`: extend `skillEvents` (grep for the existing table) — or add a sibling `skillOutcomes` table if it's cleaner — with `{skillId or skillName, userId, agent?, outcome: "success"|"failure"|"partial", note?, durationMs?, createdAt}`. Index by `userId` + `skillName` for the L10 insights query.
2. **Mutation** `skills.recordOutcome` — auth via the established owner/clerk path; rejects unknown outcome values via the standard error envelope.
3. **Hosted MCP tool** `report_skill_outcome` (tool #10) in `convex/http.ts` — inputSchema `{ skill: string (required), outcome: enum (required), note?: string, durationMs?: number }`. Auth = same Bearer + `write:memories` scope path the existing write tools use. Returns one-line text ack. Register in both `tools/list` and `tools/call` dispatch; mirror existing tool registration patterns. Update the `.well-known/mcp.json` authed-tools description list.
4. **HTTP route** `POST /api/v1/me/skills/outcomes` for non-MCP agents. Wire `authenticateRequest` + `requireScope("write:memories")` + `guardWrite` + idempotency exactly like sibling write routes. Trailing route comment for the docs generator.

### L10 — insights → improvement surface
1. **Query** `skills.activityInsights` (extend if one exists — grep) returning per-skill aggregates for the calling user only: `{ skill, uses, success, failure, partial, successRate, lastUsedAt }`. Sort by uses desc, cap 50.
2. **HTTP route** `GET /api/v1/me/skills/insights` — `read:private` scope, additive `?cursor=&limit=` (use the established pagination contract).
3. **CLI command** `youmd skill improve` in `cli/src/commands/skill.ts`:
   - One additive function in `cli/src/lib/api.ts`: `getSkillInsights(): Promise<ApiResponse<SkillInsights>>`
   - BrailleSpinner while fetching
   - Terminal table: `skill | uses | success rate (green ≥80%, #C46A3A < 80%) | last used`
   - Dim recommendation line under each low-performer: `consider revising <skill> — N failures recently`
   - Lowercase, no emoji, no rounded radii beyond `var(--radius)`

### Tests
- convex-test: outcome recording (auth, shape, per-user isolation, unknown-outcome rejection), insights math (correct counts/rates with mixed outcomes), MCP dispatch happy-path mirroring existing patterns.
- CLI: table rendering with fixture data (success-rate coloring, recommendation line gating), api function call shape.

### Verification + ship
1. `npm run test:convex` (237 + new); `cd cli && npm run build && npm test` (292 + new); root `npx tsc --noEmit`; `npm run lint` 0 errors; `npx convex codegen`.
2. Bisected commits: `feat(api): skill outcome telemetry — report_skill_outcome tool + HTTP route` → `feat(api): activityInsights query and /me/skills/insights endpoint` → `feat(cli): youmd skill improve — terminal table with success rates`.
3. Stash reference-intelligence, `npm run docs:generate`, commit if regen produced output, pop stash.
4. Push; watch `Convex Deploy`; e2e on prod:
   ```bash
   KEY=$(jq -r '.apiKey // .token' ~/.youmd/config.json)
   B=https://kindly-cassowary-600.convex.site
   # report outcome via MCP
   curl -s -X POST -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"report_skill_outcome","arguments":{"skill":"e2e-test","outcome":"success"}}}' \
     $B/api/v1/mcp
   # confirm insights
   curl -s -H "Authorization: Bearer $KEY" $B/api/v1/me/skills/insights | jq
   ```
5. Update MASTER-BACKLOG.md: L9 + L10 → done.

---

## Lane B — L16 / L12 / L13: stack safety contracts + guard + eval runner

**Read first:** `project-context/audits/2026-06-11/SELF-IMPROVING-SYSTEM-DESIGN.md` — T0–T3 tier definitions, safety-contract section, eval runner section. Ground every decision in what that doc specifies.

**File lane:** `cli/src/commands/stack.ts`, `cli/src/lib/youstack.ts` (additive — preserve canonical-layout discovery + doctor warnings + host-link engine wiring), new `cli/src/lib/stackSafety.ts` and `cli/src/lib/stackEval.ts`, tests, optional `cli/templates/safety-contract.template.json`.

**Off-limits:** `cli/src/commands/skill.ts`, `cli/src/lib/skills.ts`, `cli/src/lib/api.ts`, `cli/src/lib/host-link.ts` internals (call exports only), `convex/`, `src/`.

### L16 — machine-checkable safety contract (do first; L12 enforces it)
- Format: extend `youstack.json` with a `safety` section (don't add a second file unless the design doc says otherwise): `{ tier: "T0"|"T1"|"T2"|"T3", capabilities: { fs_write?, network?, shell?, auto_pr? }, humanGate: { required: boolean, scopes?: string[] } }`.
- Tier rules in `stackSafety.ts`:
  - T0 read-only suggestions: no `fs_write`, no `auto_pr`, no `shell`.
  - T1 suggest-only with disk writes to scratch only: no `auto_pr`.
  - T2 supervised actions: `auto_pr` only if `humanGate.required === true`.
  - T3 autonomous: anything declared, but `humanGate` MUST list explicit scopes.
- Helpers: `parseSafetyContract(manifest)`, `validateSafetyContract(contract): ContractValidationResult`, `tierAllows(contract, capability): boolean`.

### L12 — `youmd stack guard` + enforcement
- Subcommand `youmd stack guard [path]`:
  - Parses the manifest's safety section.
  - Scans declared `skills` / `workflows` / `scripts` for capability hints (e.g. a skill that writes files implies `fs_write`; a workflow with `auto_pr: true` implies `auto_pr`). Design doc lists the inference rules — follow them.
  - Prints per-capability PASS/VIOLATION with the tier rule that breaks.
  - Exit 1 on any violation.
- Doctor integration: `runYouStackDoctor` (`cli/src/lib/youstack.ts`) calls guard and surfaces results inline. Missing contract = treated as T0 with a warning to declare one.
- Runtime enforcement: wherever stack requests are routed locally (grep `routeStackRequest` or similar in youstack.ts), refuse actions that exceed the declared tier with an honest one-line refusal: `blocked: stack is T1 (suggest-only) — this action needs T2`.

### L13 — golden-prompt eval runner
- Subcommand `youmd stack eval [path] [--init]`:
  - `--init`: writes `stacks/<slug>/tests/golden.json` with 2–3 example entries.
  - Default: reads that file, runs each `{prompt, expect: {contains?, notContains?, routesTo?}}` through the same local routing path the runtime uses (NO LLM calls — deterministic routing + content presence checks).
  - Writes `stacks/<slug>/tests/eval-results.json` `{ ranAt, total, passed, failures: [...] }`.
  - Prints terminal summary (green pass count, #C46A3A failures with expected/actual diffs).
  - Exit 1 on failures.

### Tests
- `stackSafety.test.ts`: contract validation matrix (valid per tier; violations per tier; tier-capability consistency).
- `stackGuard.test.ts`: fixture stacks pass/violation; doctor surfacing; tier-refusal at the routing hook.
- `stackEval.test.ts`: fixture golden suite passes; mismatch fails with diff; `--init` writes a valid file.

### Verification + ship
1. `cd cli && npm run build && npm test` (292 + new, no regressions); root `npx tsc --noEmit`; `npm run lint` 0 errors.
2. Bisected commits: `feat(cli): machine-checkable T0-T3 safety contract in youstack.json` → `feat(cli): youmd stack guard with tier enforcement and doctor integration` → `feat(cli): youmd stack eval — deterministic golden-prompt runner`.
3. Push; no Convex deploy needed (CLI-only). Update MASTER-BACKLOG.md: L16, L12, L13 → done.

---

## Lane C — L19 / L20: nightly dreaming + k-anon fleet learning

**Read first:** `project-context/audits/2026-06-11/SELF-IMPROVING-SYSTEM-DESIGN.md` (consolidation loop, Stage-1 deterministic gates — no LLM yet) and `project-context/audits/2026-06-11/GLOBAL-EVOLUTION-ROADMAP.md` (fleet aggregation, k-anon floor).

**File lane:** `convex/crons.ts` (check if it exists — there's an hourly rateLimits cleanup cron), `convex/memories.ts` (additive), new `convex/consolidation.ts` and `convex/fleet.ts`, `convex/schema.ts` (additive), tests.

**Off-limits:** `convex/http.ts` (Lane A may still touch it), `cli/`, `src/`.

**Context to preserve:** memory categories (`convex/lib/memoryCategories.ts`, durable set includes `correction`), `contentHash` dedupe, `pinned`/`importance`/`supersededBy` (pinned exempt from decay; superseded excluded from briefs), `search_content` index, `listReviewQueue` (active, non-pinned, low-importance, >90d, cap 50).

### L19 — nightly dreaming loop (deterministic v1, no LLM)
1. **Schema (additive):** new `consolidationRuns` table `{ userId, ranAt (yyyy-mm-dd), duplicatesSuperseded, archived, reviewQueueSize, _creationTime }`. Index by `userId_ranAt` for the idempotency check.
2. **`convex/consolidation.ts`:**
   - `internalAction` `nightlyConsolidation`: pages through users in batches (e.g. 50/page); for each user schedules an `internalMutation` `consolidateUser({ userId })`.
   - `consolidateUser`:
     - Idempotency: skip if a row exists for `(userId, today)`.
     - Exact-duplicate sweep: find `contentHash` collisions among the user's active non-superseded memories; keep oldest, set `supersededBy: oldestId` on the rest (NEVER delete).
     - Stale-ephemeral demotion: non-durable category, non-pinned, importance unset, older than the threshold the design doc specifies (default 30 days if none) → set `isArchived: true`. Reuse existing `archiveStale` / `sessionMaintenance` helpers if present (grep) rather than duplicating logic.
     - Caps: ≤200 mutations per user per night. `pinned`, durable categories, and `correction` are NEVER archived.
     - Write the consolidationRuns row last.
3. **Cron registration** in `convex/crons.ts` (create if absent): nightly at 09:00 UTC (2am PT) `internal.consolidation.nightlyConsolidation`.

### L20 — fleet learning (aggregate-only, k-anon ≥ 20)
1. **Schema (additive):** new `fleetReports` table `{ ranAt, metrics (json), _creationTime }`.
2. **`convex/fleet.ts`:**
   - Export const `K_ANON_FLOOR = 20`.
   - Helper `kAnonBucket<T>(perUserValues: T[][], summarizer: (xs: T[]) => unknown): unknown | null` — returns null when `perUserValues.length < K_ANON_FLOOR`, otherwise the summary. EVERY aggregate must pass through this helper.
   - Queries (internal — no HTTP surface yet):
     - `categoryDistribution`: per-category memory count distribution across users; suppress any category bucket with fewer than 20 distinct contributing users.
     - `skillInstallCounts`: per-skill install counts; suppress same way.
     - `avgMemoriesPerActiveUser`: single aggregate; null if active-user count < 20.
   - Output shape: counts, rates, and percentiles only. NO usernames, ids, content strings.
3. **Weekly cron** in `convex/crons.ts`: Sundays 10:00 UTC → `internalAction` that runs all aggregates and writes one `fleetReports` row.

### Tests
- `consolidation.test.ts`: duplicate supersede keeps oldest; pinned/durable/correction never archived; idempotency per date (second run same date = no-op); 200-mutation cap respected; consolidationRuns row written.
- `fleet.test.ts`: k-anon suppression at n=19 (null) vs n=20 (returns); outputs contain NO identifying field keys (assert exact key sets); aggregates correct on small fixtures.

### Verification + ship
1. `npm run test:convex` (237 + new); root `npx tsc --noEmit`; `npx tsc -p convex --noEmit`; `npm run lint` 0 errors; `npx convex codegen`.
2. Bisected commits: `feat(api): nightly memory consolidation cron with idempotency and caps` → `feat(api): k-anon fleet aggregates with K_ANON_FLOOR=20 enforcement`.
3. Push; watch `Convex Deploy` (must dispatch with `environment=prod` if manual). E2E:
   - Crons aren't immediately observable on prod without a manual trigger. Run one consolidation manually for the active user to prove the pipeline:
     ```bash
     TOK=$(npx convex env get TRUSTED_INTERNAL_AUTH_TOKEN)
     # find your user via /me, then:
     npx convex run consolidation:consolidateUser "{\"userId\":\"<id>\",\"_internalAuthToken\":\"$TOK\"}"
     ```
   - Confirm a `consolidationRuns` row appears for today.
4. Update MASTER-BACKLOG.md: L19, L20 → done.

---

## Recommended dispatch sequence

If running parallel sub-agents (`model: "sonnet"`), spawn all three lanes at once — they have disjoint file ownership.

If running inline serially: A → B → C. A is the smallest and closes the most visible loop; B is CLI-only so it never waits on Convex deploys; C is the largest and requires manual cron triggering for e2e.

## After the L-series wave

The remaining tail is in MASTER-BACKLOG.md:
- **Self-improvement cluster** (depends on L9/L10 + L12/L13/L16 + L19/L20 above): L6, L7, L8, L14, L15, L17, L18, L21, L23, L24, L25 (L22 and L26 stay blocked by design).
- **Product/API**: P9 stack registry install, P10 capability contract, P18 shared router, P19 brainScopes, P24 webhooks.
- **Perf + MCP**: T8 ISR, T9 server-assembled system prompt, T10 lossless round-trip, T14 unified MCP registry, T19 lazy panes, T25 MCP tool harness, T26 Playwright smoke, T27 sha256 manifest.
- **Houston-blocked** (need Houston's input, do NOT implement speculatively): P2 draft/publish semantics, P16 pipeline-honesty decision, P7 npm OTP for CLI publish, Sentry DSN for T13.
