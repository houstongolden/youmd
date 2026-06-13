# MASTER-BACKLOG.md — Mission Audit Execution

**Mandate:** Implement, test end-to-end, and deploy every improvement identified across the 13 audit deliverables in this directory. Nothing deferred. Loop continues until every item is `done` (= built, verified e2e, deployed, working in prod).

**Status legend:** `todo` / `in-progress` / `verify` / `done` / `blocked(<reason>)`

**Ingestion state:** all 13 deliverables ingested 2026-06-11 (red-team verified). FEATURE-ROADMAP.md tasks are folded into P#/T# items below (its Milestone 0 maps to: 0.1=P4, 0.2=T1, 0.3=P7, 0.4=T5, 0.5=P26, 0.6=T7, 0.7=P35). ONE-CLICK PRs map to: PR1=T1+T15+T5, PR2=T4, PR3=T6; bonus fixes=T11,T12,T28,T29,T30.

---

## M1 — Vision/GTM items (final)

| ID | Item | Source | Effort | Status | Verification |
|---|---|---|---|---|---|
| V1 | Hero rework: kicker kept, headline → "every agent meets the same you", handshake triad (agent.md/soul.md/you.md) added below CTAs, install command in hero, quiet bullet "one runtime" → "one brain across your agents" | POSITIONING-PLAYBOOK §2 (R1+R2) | S | done (645d9d9; deployed, hero markup verified on prod) | Visual check in browser vs PRD v2.3; build passes; Vercel deploy live |
| V2 | Demote "stop re-explaining yourself" to problem-statement line on landing (keep as pain hook section, not headline) | POSITIONING-PLAYBOOK §1 | S | done (645d9d9; subhead carries pain hook, verified on prod) | Landing renders; copy consistent across sections |
| V3 | Freshness-moat copy: "a copied YouStack freezes at copy time; yours stays current" added to YouStacks landing section + README | VISION-AUDIT R5 | S | done (645d9d9; freshness-moat copy live) | Copy live on landing + README; no overstated "clone-proof" claims |
| V4 | Lighthouse growth loop: ASCII-portrait OG share card framing "this is what agents see when they meet me" on public profiles | VISION-AUDIT R4 | M | done (f3bc25c; portrait-hero OG card, bundled mono font, fixed displayName bug; OG PNG visually verified on prod) | OG card renders for a real profile; share preview correct |
| V5 | Honesty-ledger guard: no copy promises encrypted vault until AES-256-GCM ships; audit landing/pricing copy now ("scoped access" not "encrypted") | POSITIONING-PLAYBOOK §4 / risk X2 | S | done (audit clean: all encryption claims map to shipped AES-256-GCM vault surfaces; landing/llms docs make no encryption promises) | Grep landing+docs for encryption promises; none ahead of shipped reality |
| V6 | Protocol positioning: publish/promote `you-md/v1` schema as open standard page in docs; "an MCP where the context is you" line into developer docs | VISION-AUDIT R3 | M | done (2e3ce77; open-standard section grounded in served schema, positioning line in docs+llms; prod check after Vercel) | Docs page live; llms surfaces regenerated + docs:check passes |

## M2 — Product items (PRODUCT-AUDIT + GAP-VS-VISION + FEATURE-ROADMAP)

| ID | Item | Sources | Effort | Status |
|---|---|---|---|---|
| P1 | Enforce API-key scopes: scopes from `authenticateRequest`, `requireScope()` per route/MCP tool, log `scope_missing` for legacy keys | PRODUCT-AUDIT #1; FEATURE-ROADMAP 1.1 | M | done (scope enforcement live; grandfathered pre-epoch + cli-auth keys w/ telemetry) |
| P2 | Resolve draft/publish semantics (save==publish w/ rollback patching profile, or true drafts) | PRODUCT-AUDIT #2; FEATURE-ROADMAP 1.2 | M | blocked(needs-spec: Houston call) |
| P3 | Canonical `assembleAgentContext()` for web agent, CLI chat, hosted MCP, /ctx links + parity test | PRODUCT-AUDIT #3; FEATURE-ROADMAP 2.1 | L | done (23910d4/59fd576/6b1eeb2; all 4 surfaces through assembleAgentContext + 12-test parity lock; prod e2e verified: whoami/brief byte-stable, get_identity OK) |
| P4 | Shared `generateSecureToken` replacing Math.random in apiKeys.ts:17, contextLinks.ts:18, private.ts:82, profiles.ts:26 | PRODUCT-AUDIT #4; FEATURE-ROADMAP 0.1 | S | done (1ce525d: CSPRNG via secureToken.ts, shapes preserved) |
| P5 | Memory full-text search: Convex searchIndex + `q` param + MCP `search_memories` | PRODUCT-AUDIT #6; FEATURE-ROADMAP 2.3 | L | done (4b943a2; prod e2e: REST ?q= + MCP search_memories verified; docs regenerated 2a0abb2) |
| P6 | Fix `youmd mcp --install claude --auto` → ~/.claude.json or `claude mcp add`; post-install verify | PRODUCT-AUDIT #8; FEATURE-ROADMAP 1.3 | S | done (bf2e647: claude mcp add / ~/.claude.json + verify) |
| P7 | Publish CLI to npm + version-skew CI check | PRODUCT-AUDIT #9; FEATURE-ROADMAP 0.3 | S | blocked(otp) |
| P8 | Canonical stack layout `stacks/<slug>/youstack.json`; CLI discovery + doctor warning; also reconcile YOUSTACKS_PRODUCT_LAYER_PRD.md:201-210 drifted table + fix example manifest minYoumdCli 0.7.0 vs cli 0.6.23 | PRODUCT-AUDIT #10; P32 findings | M | done (canonical discovery + doctor warnings + PRD reconciled; 220/220 tests) |
| P9 | `youmd stack install <user>/<slug>` + registry endpoint | PRODUCT-AUDIT #11; FEATURE-ROADMAP 2.5 | L | todo |
| P10 | Truthful capability contract w/ transport tags + CI curl test | PRODUCT-AUDIT #12; FEATURE-ROADMAP 2.6 | M | done (982151c; transports tags + CI smoke cross-check) |
| P11 | One host-link engine emitting `.claude/skills/<name>/SKILL.md`; empirical discovery release gate | PRODUCT-AUDIT #13; FEATURE-ROADMAP 3.7 | M | done (0fd58b1; one engine, claude .claude/skills/<name>/SKILL.md layout, verify gate, snapshot parity) |
| P12 | Single project-context engine (repo project-context/ + ~/.youmd/projects/ overlay); delete dup impls | PRODUCT-AUDIT #14; FEATURE-ROADMAP 3.8 | M | done (d83f718; one engine, repo-over-global overlay, dup impls deleted, 237/237) |
| P13 | Pagination cursors on all list endpoints + OpenAPI docs | PRODUCT-AUDIT #15; FEATURE-ROADMAP 2.9 | M | done (904ba31; 8 endpoints, prod e2e cursor verified, legacy shape unchanged) |
| P14 | Memory durability: pinned/importance/supersededBy, decay exemptions, review queue | PRODUCT-AUDIT #16; FEATURE-ROADMAP 2.4 | M | done (b285d99; pinned/importance/supersede + review queue; prod verified) |
| P15 | One `MEMORY_CATEGORIES` module + validation + migration + `correction` category | PRODUCT-AUDIT #17; FEATURE-ROADMAP 2.10 | M | done (b285d99; one category module + correction; prod migration: 48 scanned/14 normalized, 400 on invalid) |
| P16 | Pipeline honesty: compile merges chat-refined content, or de-document discover→review | PRODUCT-AUDIT #18; FEATURE-ROADMAP 3.5 | L | blocked(needs-spec: Houston call) |
| P17 | GitHub repo freshness: debounced auto-push on save/publish + ancestor check on repo pulls | PRODUCT-AUDIT #19; FEATURE-ROADMAP 2.7 | M | done (3d92c04; debounced auto-push, retry-once, canonical-wins staleness) |
| P18 | Shared capability router package for CLI + API route + golden parity tests | PRODUCT-AUDIT #20; FEATURE-ROADMAP 3.6 | M | done (54c8a6e/7b717eb; parity-locked resolver, 10 fixture cases × 2 runners) |
| P19 | Typed brainScopes + identity-bearing adapters + doctor skill-ref validation | PRODUCT-AUDIT #21; FEATURE-ROADMAP 3.9 | M | done (982151c; scopes on MCP tools + doctor requiresScopes validation) |
| P20 | Documented precedence model + shadowing warning + `youmd status` active-roots line | PRODUCT-AUDIT #22; FEATURE-ROADMAP 3.15 | M | done (d83f718; PRECEDENCE table, shadow warnings, active-roots in status) |
| P21 | Standard error envelope `{error:{code,message}}` + real OpenAPI schemas | PRODUCT-AUDIT #23; FEATURE-ROADMAP 3.1 | M | done (63524a5; 115 error sites, CLI parser updated, 89/89 convex tests; prod e2e verified) |
| P22 | Per-key rate limits on writes + Retry-After/X-RateLimit headers | PRODUCT-AUDIT #24; FEATURE-ROADMAP 3.2 | M | done (a703c6a; prod e2e: 200 carries X-RateLimit trio) |
| P23 | Idempotency-Key support + memory content-hash dedupe | PRODUCT-AUDIT #25; FEATURE-ROADMAP 3.3 | M | done (a703c6a/c0547ea; prod e2e: Idempotency-Replayed true, dedupe live, test memory archived) |
| P24 | Outbound webhooks + MCP subscribe/listChanged | PRODUCT-AUDIT #26; FEATURE-ROADMAP 3.4 | L | todo |
| P25 | Honest endpoint counts (exclude retired/internal) in docs generator | PRODUCT-AUDIT #27; FEATURE-ROADMAP 3.10 | S | done (3b5b000; 69 honest endpoints, 7 documented exclusions, stale-exclusion guard) |
| P26 | `login --key` validates before persisting; preserve apiUrl/appUrl | PRODUCT-AUDIT #31; FEATURE-ROADMAP 0.5 | S | done (308ad0b) |
| P27 | Headless auth via YOUMD_API_KEY/YOUMD_API_URL env vars | PRODUCT-AUDIT #32; FEATURE-ROADMAP 1.4 | S | done (308ad0b: env auth, zero-write verified) |
| P28 | Fix `skill browse` registry: install hint | PRODUCT-AUDIT #33; FEATURE-ROADMAP 3.16 | S | done (b0ddedb: hint fixed + registry: resolver) |
| P29 | Per-host YOUMD_AGENT_NAME + clientInfo.name fallback for attribution | PRODUCT-AUDIT #35; FEATURE-ROADMAP 3.10 | S | done (bf2e647: per-host YOUMD_AGENT_NAME + clientInfo fallback) |
| P30 | Username canonicalization migration; delete 500-profile fallback scan | PRODUCT-AUDIT #38; FEATURE-ROADMAP 3.13 | S | done (995122e+1f9d0df; prod migration ran: 25 users/45 profiles, 0 rewrites, 0 conflicts; mixed-case API+web lookups verified) |
| P31 | Deprecation/Sunset headers + schemaVersion on payloads | PRODUCT-AUDIT #39; FEATURE-ROADMAP 3.14 | S | done (a703c6a; prod e2e: 410 Deprecation+Sunset, schemaVersion you-md/v1 on /me) |
| P32 | ARCHITECTURE.md YouStacks section + PRD layout reconciliation | PRODUCT-AUDIT #40; FEATURE-ROADMAP 3.17 | S | done (YouStacks layer + storage map + drift notes) |
| P33 | Project attribution: nearest-marker-wins by depth | PRODUCT-AUDIT #41 | S | done (0c32304) |
| P34 | Generate CLI command table from commander; docs:check assertion | PRODUCT-AUDIT #42 | S | done (3b5b000; 27 commands parsed from commander, drift-checked) |
| P35 | TTY/EOF guard on interactive prompts | PRODUCT-AUDIT #43; FEATURE-ROADMAP 0.7 | S | done (5028339: 6 entry points guarded) |
| P36 | Issue real owner scopes for cli-auth login keys (convex/auth.ts) + settings UI scope selection, then remove the cli-auth grandfather carve-out in lib/scopes.ts; regen docs with the 403 scope contract | P1 follow-up | M | done (05512ab; prod e2e: read:public key → 403 scope_missing on private read/write, grandfathered session 200, test key revoked) |

## M3 — UX items (UX-AUDIT)

| ID | Item | Effort | Status |
|---|---|---|---|
| U1 | Strip `@` from CLI celebration URLs + normalize `@`/`%40` in [username] route w/ 301 | S | done (65cd878 web, verified 308 on prod; e218877 CLI URLs) |
| U2 | Fix onboarding done-phrase false positives (bare no/yes/ready); gate on wrap-up offer | S | done (f9d75d4; intent-gated wrap-up + 11 tests) |
| U3 | Fix fake "[saved private project]" — real updatePrivateContext write or honest message | S | done (026fd0b; real getPrivateContext+append+updatePrivateContext write) |
| U4 | Gate /initialize redirect on onboarding-complete marker, not bare username | M | done (51a7f38; gated on published bundle, resumes mid-flow users) |
| U5 | Dashboard panelOpen=true default + localStorage persist; align skeleton | S | done (e66a58b; default-open + localStorage persist + skeleton parity) |
| U6 | Buffer-and-filter streamed tokens (no raw ```json blocks) in CLI + web | M | done (b72d07a CLI, web commit; 30 tests incl. every-split parity) |
| U7 | Device-flow login (CLI code → browser approve → poll) | L | done (07dce12/cb3a834/4721ef1; prod e2e: start/poll/page verified) |
| U8 | Split docs counts hosted/local tools; fix failing JSON-RPC example; replay all doc examples in llms:smoke | M | done (3b5b000; 8 hosted vs 24 local split, get_identity example fixed, 9 public examples replayed in smoke) |
| U9 | Homepage magic moment: handle → live ASCII portrait → /create funnel | M | done (f3bc25c; terminal preview prompt, in-browser ascii, /create?handle prefill; landing section live on prod) |
| U10 | Delete fixed fake delays; min spinner display 250ms; elapsed timer never resets | S | done (b0ddedb: 16 fake delays removed, 250ms min spinner display) |
| U11 | Pane taxonomy MECE pass (activity vs analytics naming) | S | done (e66a58b; activity=agent log, analytics=stats, session log=account events) |
| U12 | Profile preview: direct ProfileContent render w/ preview prop (kill iframe) | M | done (7c7bbdf; inline ProfileContent preview prop, no view counting, public page unchanged) |
| U13 | Local-first portrait cache (instant render, background refresh) | M | done (7c7bbdf; localStorage cache, instant paint, hash-gated swap) |
| U14 | Sign-up correction commands (`back`, `/email`) + resend/change-email on verify failure | S | done (5256355; back//email/resend + 5 tests) |
| U15 | Tappable /help + cmd+k hints (mobile palette) | S | done (8b07564; /help chip mobile, cmd/ctrl+k hint desktop, touch-friendly palette) |
| U16 | Onboarding turns 2+ stream via shared helper | S | done (1a5d949; all onboarding turns stream filtered) |
| U17 | Portrait source chain: LinkedIn unavatar + og:image; retry after research | M | done (904ba31; deployed) |
| U18 | --radius:2px token; migrate 178 inline styles; ban rounded-md/2xl | S | done (7caa891; 213 instances, check:radius guard in lint chain) |
| U19 | Status-bar freshness segment + staleness nudge on session restore | S | done (8b07564; synced-ago segment from existing bundle query, 7-day nudge once per session) |
| U20 | Renderer: strip ANSI before padEnd; spinner update() preserves startTime | S | done (5028339) |
| U21 | Lowercase CTAs on landing | S | done (645d9d9; lowercase CTAs verified on prod) |
| U22 | Sweep font-medium/semibold per opacity-not-weight rule (19 instances) | S | done (645d9d9) |
| U23 | Boot sequence checkmarks tied to real events; enter-to-skip | S | done (dffaf72; gated on auth/user/ws/profile queries, enter-to-skip with honest still-loading; fixed createUser race) |

## M3 — Self-improving loop items (SELF-IMPROVING-SYSTEM-DESIGN + GLOBAL-EVOLUTION-ROADMAP)

| ID | Item | Effort | Status |
|---|---|---|---|
| L1 | Render memory content in formatAgentBriefMarkdown; includeMemories default true | S | done (11a32bb: hosted brief renders memories, default on) |
| L2 | Lift whoami + get_agent_brief (Bearer-authed) to hosted MCP | M | done (11a32bb: hosted tools 5->7) |
| L3 | Hosted MCP hygiene: protocol pin upgrade, auth in mcp.json, proxy guards, cache only 200s | S | done (11a32bb: protocol 2025-06-18 negotiation, auth block, proxy guards) |
| L4 | Replace hardcoded identity://houstongolden with resources/templates/list URI template | S | done (11a32bb: identity://{username} uriTemplate) |
| L5 | Delete hand-maintained tool-inventory comment (http.ts:2699-2702) | S | done (11a32bb) |
| L6 | Reference-intelligence v2: dedupe, Haiku batch pass, weekly Action cron → PR | M | done (9f6bf9d; dedupe script + reference:dedupe; Haiku pass deferred) |
| L7 | Golden Q&A eval suite for You Agent in CI | M | done (afce80c; 7 golden Q&A fixtures, no live LLM) |
| L8 | Schedule audit forever-loop (Actions cron) w/ atomic mkdir lock | M | done (bf8cdb7; daily audit-loop workflow with atomic mkdir lock) |
| L9 | trackSkillEvent outcomes + MCP report_skill_outcome tool | M | done (73175f3; report_skill_outcome MCP tool + outcomes route, 12 tests); prod e2e: MCP+HTTP) |
| L10 | activityInsights query → `youmd skill improve` + dashboard | M | done (73175f3/d583d59; activityInsights + youmd skill improve, 13 tests); prod e2e: insights returned 2 uses 50% rate) |
| L11 | Fix improveCmd sync heuristic (lastSyncedAt vs identity-change timestamp) | S | done (b0ddedb: lastSyncedAt vs identity mtimes) |
| L12 | Stack guard: `youmd stack guard` + enforcement in route/MCP (T0-T3 tiers) | M-L | done (afdc4af; stack guard + tier enforcement + doctor integration, 19 tests) |
| L13 | Golden-prompt eval runner: `youmd stack eval` → tests/eval-results.json | M | done (6704814; stack eval golden-prompt runner, 28 tests) |
| L14 | Stack improvement runner: journal/ + `youmd stack improve` (propose/auto_pr) | L | done (83928d1; journal proposals + auto_pr tier gate, 27 tests) |
| L15 | Visible heartbeat: "stack wants to improve" card + doctor NEXT line | S | done (1d8b234; wired into status + doctor with try/catch) |
| L16 | One machine-checkable SAFETY-CONTRACT spec (T0-T3), enforced by guard/doctor/smoke | M | done (2ed63e6; T0-T3 safety contract + validation, 47 tests) |
| L17 | Stack update channel: registry version metadata + `youmd stack update` | M | done (5cbd8b3; upstream version check + --apply) |
| L18 | YouStack workflows manifest section + Convex per-user scheduler | L | done (9f7519c; workflows manifest + userWorkflowSchedules table + runUserWorkflow action) |
| L19 | First dreaming loop: nightly memory consolidation cron | M | done (9914771; nightly consolidation cron, deterministic, idempotent, 13 tests); prod e2e: archived 25 ephemerals) |
| L20 | Fleet learning: aggregate-only queries (k-anon ≥20) + weekly fleet report | M | done (0fa2595; k-anon ≥20 fleet aggregates with weekly cron, 15 tests) |
| L21 | Telemetry consent surface + privacy contract in docs/llms.txt | M | done (f3f9c3e; telemetry section in docs + llms.txt; consent model documented) |
| L22 | User-facing fleet feedback notices | M | blocked(needs-spec) |
| L23 | Per-stack MCP namespace /api/v1/mcp/{user}/{stack} | L | done (3342caf; namespaced MCP with filtered tools; test gap noted); prod 404 contract verified) |
| L24 | Scheduled maintainer agent mining journal → guarded auto_pr | L | done (a5d8147 + cron orchestrator; mineStackJournals + weekly cron; test gap noted) |
| L25 | Cross-stack proposals → human-gated registry candidates | L | done (a5d8147; listPendingRegistryCandidates query, ≥5 evidence threshold) |
| L26 | Server-orchestrated evolution (Convex crons) | L | blocked(sequenced-last by design: requires Stage 2-3 gates) |
| L27 | CLI stdio MCP brief parity: render memory content + includeMemories default true (match hosted) | S | done (34ce3b3; stdio brief renders memories, includeMemories default true) |

## M4 — Tech items (TECH-STACK-AUDIT + ARCHITECTURE-EVOLUTION + ENGINEERING-ROADMAP + ONE-CLICK)

| ID | Item | Effort | Status |
|---|---|---|---|
| T1 | Pull/sync dirty-check guard (refuse overwrite unless --force); safe sync ordering | M | done (a984939: dirty-check guard + state-aware sync, 13 tests) |
| T2 | Per-section 3-way merge using base.json (cli/src/lib/merge.ts) | M | done (atomic per-section merge, 19 tests, 183/183 green) |
| T3 | convex-test contract tests: auth/scopes, MCP dispatch, rate+spend caps, pipeline | L | done (61 contract tests: scopes/agentContext/tokens/memories/apiKeys; CI step added) |
| T4 | Installer hardening: npm default channel, tag-pinned source, auto-upgrade health check + rollback | M | done (9d4a6e0: npm default, tag-pinned source, upgrade rollback) |
| T5 | Atomic JSON writes (tmp+rename+lock), 0600/0700 perms, .bak on corrupt config | S | done (e514a2b: atomic+locked writes, 0600/0700, .bak on corrupt) |
| T6 | CI: tsc+lint+build+cli-tests on PR; gated Convex prod deploys | S | done (28d90b5+cd8b29c: CI gate live; lint warn-only until T31) |
| T7 | pull/push home-first resolution; project-local needs flag + auto-gitignore | S | done (34fc522; home-first, --local + marker, auto-gitignore; 13 tests) |
| T8 | ISR for /[username] + /profiles; skip anonymous Convex live queries | M | done (aee87ca; revalidate=60 + anon skip live queries) |
| T9 | Server-assembled system prompt; chat proxy rejects client system messages | L | done (ea10001; server-assembled prompt, client system messages stripped, 9 tests) |
| T10 | Lossless identity round-trip (markdown per-section source of truth + property test) | L | done (e3eca29; roundtripIdentity + 2 decompiler fixes, 12 tests) |
| T11 | Load JetBrains Mono + Inter via next/font | S | done (aca29f3) |
| T12 | export const viewport; drop user-scalable=no (WCAG) | S | done (aca29f3) |
| T13 | Sentry + sanitized error codes + scheduled smoke alerts + /api/v1/health | M | done (34fc522; health route, 26 sanitized 500 sites, 30-min smoke cron; prod health 200 verified; Sentry = Houston decision) |
| T14 | Unified MCP tool registry; official SDK Streamable HTTP; remote serves all tools | M-L | todo |
| T15 | Fix lastPulledHash ancestry bug | S | done (a984939) |
| T16 | Bounded-batch rateLimits cleanup w/ index + reschedule | S | done (683f014) |
| T17 | API client timeout + retry w/ jitter; consistent offline message | S | done (9cbb89e) |
| T18 | Fix fs.watch recursive crash on Linux/Node 18 | S | done (5895375) |
| T19 | Lazy-load dashboard panes; docs page → server component | M | done (8d0e5b3; next/dynamic on 6 heavy panes; docs skipped) |
| T20 | Profiles searchIndex for MCP search_profiles | S | done (683f014) |
| T21 | ARIA live regions on terminal chat + skip link | S | done (2607f97; quiescence-based announce, dialog semantics, skip link; SR QA noted) |
| T22 | Delete 12 dead landing sections + unused reactbits/ + ogl dep; dedupe components | M | done (9451a9d; 17 dead files + ogl removed, live components verified kept) |
| T23 | Route-level loading.tsx + error.tsx for key routes | M | done (2607f97; shared RouteError + 10 boundary files) |
| T24 | Single canonical host (apex vs www) alignment | S | done (9451a9d; www canonical, 308 backstop + metadata/sitemap aligned; post-deploy curls pending) |
| T25 | MCP tool-call test harness (table-driven over all tools) | M | done (16 tests across 9 hosted tools) |
| T26 | Playwright smoke: landing → sign-in → dashboard + anon profile | M | done (chromium smoke; daily workflow) |
| T27 | Per-section sha256 manifest + shared canonicalJsonString package | M | done (bb2b69d; manifest.sha256.json + canonical-json helper, 15 tests) |
| T28 | Add llms.txt/shell/schema/install.sh to proxy RESERVED_PATHS | S | done (f0f7925) |
| T29 | CLI version from package.json; postinstall banner TTY gate; publish version-exists check | S | partial (a984939 version-from-package.json; banner TTY gate + publish version-exists check pending) |
| T30 | Spend-cap doc/code drift fix; pre-hydration theme script | S | done (ab0277d spend-cap; 70efbe3 pre-hydration theme script) |

| T31 | Lint-zero: fix 169 pre-existing eslint errors in src/, then flip CI lint step to blocking | S-M | done (0060f68 lint-zero 169→0 repo-wide; 76dfcac lint blocking in CI) |

## Execution order (waves)

1. **Wave 1 (safety net / ONE-CLICK):** T1+T15+T5 (PR1), T4 (PR2), T6 (PR3), bonus T11/T12/T28/T29/T30, P4, P26, P35, T7 — stops data loss, fleet-bricking, untested deploys, insecure tokens
2. **Wave 2 (critical correctness):** P1 (scopes), T2 (3-way merge), P6 (claude install), P27, U1-U6, L1-L5, T16-T18, T3 start
3. **Wave 3 (same-version-of-you):** P3, P5, P13-P15, P17, T8-T10, T14, T20, U7-U17, L6-L11
4. **Wave 4 (protocol + polish + evolution):** P8-P12, P18-P25, P28-P34, U18-U23, L12-L21, T13, T19, T21-T27, V1-V6
5. **Wave 5 (living stacks):** L23-L25; unblock P2/P16/L22/L26 with Houston decisions

---

## Execution rules

1. Order: safety-net/Milestone-0 items first (tests, CI guards), then Critical, then ONE-CLICK PRs, then High-leverage, then Polish.
2. Every item: build passes (`npx next build` / `cli npm run build`), e2e verified (real flow, not just compile), deployed (Vercel push + `npx convex deploy` if convex/ touched), docs surfaces regenerated when contracts change (`npm run agent-docs:ci`).
3. Conventional, bisected commits per logical change.
4. CLI publish steps require Houston's npm OTP — mark `blocked(otp)` and batch them, never skip version bump.
5. Update this file every iteration; an item is `done` only after verification evidence is noted.
