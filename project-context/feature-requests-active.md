# Active Feature Requests — Tracked Until Verified

Last Updated: 2026-06-13

---

## 2026-06-13 — OKF (Open Knowledge Format) Integration

### 112. Implement OKF and prove cross-machine sync of skills/stacks/context
**Status:** IN PROGRESS (code complete on branch; Houston e2e + publish pending)
**Verified:** NO
**Production Verified:** NO
**Source:** 2026-06-13 — Houston: first asked "How can this help my youmd project?" about Google's OKF, then: "you must implement the OKF as suggested and planned and ensure all of this works... share local agentic skills/stack across machines... update a skill on my MacBook and my Mac mini also auto-updates... publishable youStacks ie like your own Gstack... I have purchased two brand new machines a new MacBook Air and a new Mac mini... once you're 100% confident I'll run it locally and test the goal end to end."
**Request:** Adopt OKF as the portable, lock-in-free wire format for You.md so identity, skills, and YouStacks travel between machines and agents; make publishable youStacks expressible as OKF; get to 100% local confidence so Houston can run the end-to-end cross-machine test on the two new Macs.
**Actionable Scope:**
1. Implement OKF as proposed (conformant export/import). **DONE:** pure core `cli/src/lib/okf.ts` (serialize/parse, validation, `index.md`/`log.md` builders for `okf/v0.1`).
2. Identity bundle ↔ OKF, lossless round-trip incl. installed skills. **DONE:** `cli/src/lib/okf-bundle.ts` (`youmd_kind` routes concepts home on import).
3. YouStacks as publishable OKF ("Gstack" story). **DONE:** `cli/src/lib/okf-stack.ts` (manifest concept + typed files; `youstack.json` carried for installability).
4. CLI surface. **DONE:** `youmd okf export|import|validate` + `youmd export --okf`, `--json`/`--stack`/`--out`/`--no-skills`.
5. Skills/project-status/preferences sync across machines + background auto-update. **RIDES EXISTING ENGINE:** `youmd sync`/`sync --watch` + skills registry sync already move context server-side; OKF adds the portable, lock-in-free snapshot/exchange. No sync behavior changed. Cross-machine proof is steps A–C in `OKF_INTEGRATION.md`.
6. Tests + verification. **DONE:** 30 OKF tests green; CLI build clean; end-to-end CLI smoke for identity + stack export (conformant) and import round-trip.
7. Runbook for the two Macs. **DONE:** `project-context/OKF_INTEGRATION.md`.
8. **Houston (user-only):** run the cross-machine end-to-end test on MacBook Air + Mac mini.
9. **Owner-only:** bump CLI version, align root AGENTS.md/CLAUDE.md version markers, `npm publish` when ready (intentionally not bumped on this branch to keep the agent-docs version guardrail green).
**Design/Runbook:** `project-context/OKF_INTEGRATION.md`. Spec: https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md
**Progress (2026-06-13):** Built the full OKF layer on `claude/okf-youmd-integration-7bxxt1`. `npm --prefix cli run build` passes; new OKF suite green (30 tests); CLI smoke confirmed identity export (7 concepts, conformant), import round-trip rebuilds section files, and stack export (`youstack-personal`, conformant) with `youstack.json` carried. Pre-existing live-network `integration.test.ts` cases still fail in the sandbox (no production reachability) — unrelated to this change. Remaining: Houston's cross-machine e2e, then owner-only version bump + publish.

---

## 2026-06-04 — Free GitHub OAuth Signup + Repo-Native You.md

### 106. Free GitHub OAuth signup
**Status:** IN PROGRESS (code complete on branch, needs OAuth App + deploy + verify)
**Verified:** NO
**Production Verified:** NO
**Source:** 2026-06-04 — Houston: "add the GitHub OAuth and just let everyone sign up for free... users are gonna wanna just sign in, sign up, connect their repo, create their own You.md repo... prioritize that."
**Request:** Let anyone sign up for free via GitHub OAuth, alongside the existing email-code auth.
**Actionable Scope:**
1. `githubConnections` Convex table (GitHub identity + encrypted OAuth token + scopes + linked-repo metadata). DONE
2. `convex/github.ts`: `findOrCreateGithubUser` (gated by trusted internal token), `getConnection`, `linkRepo`. DONE
3. Web OAuth routes `/api/auth/github/start` + `/api/auth/github/callback`, reusing the opaque session cookie + JWKS Convex JWT path. DONE
4. "continue with github" / "sign up free with github" on sign-in + sign-up, with graceful unconfigured state + OAuth error surfacing. DONE
5. Operator runbook (`GITHUB_OAUTH_SETUP.md`) for registering the OAuth App + env vars. DONE
6. **Blocked on Houston/operator:** register the GitHub OAuth App, set `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` (+ optional `GITHUB_OAUTH_SCOPES`), deploy Convex + Vercel from `main`, verify end-to-end.
**Progress (2026-06-04):** Built the full Phase-1 foundation on `claude/github-oauth-free-signup`. `npx tsc --noEmit` (web + `convex/tsconfig.json`) passes with 0 errors; targeted ESLint clean. Email-code auth is untouched. Not deployed (branch only, no PR).

### 107. Repo-native You.md — host MD files + stacks in the user's own GitHub repo (public/private)
**Status:** IN PROGRESS (Phase 2 code complete on branch; Phases 3–5 planned)
**Verified:** NO
**Production Verified:** NO
**Source:** 2026-06-04 — same message: "host their full UMD and use stacks on their own GitHub repos and make those repos either public or private... use that for all the MD files and everything... since we have access to repo, we can clone it and host it on our own servers for the agentic and API MCP stuff." Then: "Start phase 2".
**Request:** Make the user's own GitHub repo the source of truth for their identity `.md` + stacks (public or private), and clone/mirror it server-side to power the agentic/API/MCP surfaces.
**Actionable Scope:**
1. Phase 2 — connect/create the You.md repo (create `you-md` public/private; or connect an existing repo) and seed it. **DONE (code complete, needs deploy):** `convex/githubRepo.ts` actions `createRepo`/`connectRepo`/`listRepos` (OAuth token decrypted only inside Convex actions), internal helpers in `convex/github.ts`, and `GithubRepoSection` wired into the Settings pane (visibility toggle + repo picker, no forms). tsc + eslint clean.
2. Phase 3 — sync engine: pull repo MD → bundles/profiles; push edits back as commits; conflict policy; webhook re-pull. **DONE (code complete, needs deploy):** `pushToRepo` / `pullFromRepo` actions (you.md + you.json, last-writer-wins via file sha, `lastSyncedSha`), push/pull controls, AND webhook auto-pull (`POST /api/github/webhook`, HMAC-verified, auto-registered on create/connect, schedules pull+mirror). **Remaining:** 3-way merge, sync `private/*`.
3. Phase 4 — server-side clone/mirror; stacks + MCP/API read from the mirror. **FIRST SLICE DONE (code complete, needs deploy):** `repoMirror` table + `syncMirror`/`internalMirrorForConnection` (head→tree→blobs, capped) snapshots identity + `stacks/**`; authenticated `GET /api/v1/me/repo/files` + `/stacks` serve it; `getRepoMirror` + `deriveStacks` power the Settings-pane mirror status. **Remaining:** wire MCP server + public profile to read stacks from the mirror; private files via token surfaces only.
4. Phase 5 — harden OAuth App → GitHub App (fine-grained, per-repo, least-privilege). **FOUNDATION DONE (code complete, additive, untested e2e):** `convex/githubApp.ts` (RS256 app JWT + installation tokens), `loadConnectionToken` prefers installation tokens when the App is configured + installed (OAuth fallback unchanged), `setInstallation` + `/api/auth/github/app/setup` callback, Settings install link. **Remaining:** register the App + env, token caching, `installation` webhook revocation.
5. Follow-ups landed alongside: MCP `get_my_stacks`/`get_repo_file` + public `get_identity.repo_stacks`; public profile renders repo-hosted stacks (public repos only).
**Design:** `project-context/GITHUB_NATIVE_PLAN.md` (defaults in use: repo name `you-md`, default visibility private, email-match links to existing account, repo-as-truth opt-in per account).
**Progress (2026-06-04):** Phases 2, 3 (+webhook), and 4-first-slice built on `claude/github-oauth-free-signup-sj6Nn`. Needs Convex deploy (new tables/actions/routes) + the OAuth App with `repo` scope (+ optional `GITHUB_WEBHOOK_SECRET`), then end-to-end verify (create → seed → push/pull round-trip → external push auto-pulls → mirror shows files/stacks → `GET /api/v1/me/repo/files` returns them). Phase 5 + the MCP/public-profile stack wiring remain their own slices.

---

## Tracking Rules
- Every request gets its own entry with status
- Status: TODO | IN PROGRESS | DONE | VERIFIED BY USER
- Don't mark DONE until actually deployed and tested
- Don't ignore parts of messages — break them ALL down
- Source: date + commit or conversation reference

---

## 2026-06-13 Remote Main Sync Continuation

### 111. Pull remote main, resolve conflicts, verify new landed work, and keep moving
**Status:** IN PROGRESS (local sync + verification complete; production/user verification pending)
**Verified:** NO
**Production Verified:** NO
**Source:** 2026-06-13 — Houston said "pull down all changes from remote main and resolve conflicts and continue"
**Request:** Bring local `main` up to current `origin/main`, preserve and merge local work, resolve any conflicts, audit what landed, fix/test anything newly broken from the merge, and continue through verification/setup notes.
**Actionable Scope:**
1. Fetch/pull all changes from remote `main`.
2. Reapply local work safely and resolve conflicts without losing user changes.
3. Audit the newly landed stack registry, MCP registry/subscribe, webhook, CLI stack-install, generated docs, and backlog/reference-intelligence updates.
4. Run local build, lint, docs, Convex, CLI, and production-build checks.
5. Fix issues surfaced by verification.
6. Identify owner-only setup/deploy needs.
7. Update project context and commit logical follow-through changes.
**Progress (2026-06-13):** Fast-forwarded local `main` to `origin/main` commit `376f967` after stashing/reapplying local artifacts; the stash pop was clean and there were no textual merge conflicts. Audited the newly landed stack install/public registry, hosted MCP registry + `subscribe`, outbound webhooks, generated agent docs, and backlog docs wave. Verification found and fixed three follow-through issues: Convex codegen/deploy rejected `convex/lib/capability-router.ts` because Convex module path components cannot contain hyphens, so the Convex-side twin is now `convex/lib/capabilityRouter.ts`; CLI round-trip decompile no longer treats `username` as an `identity.name`; `/docs` telemetry panel now uses the radius token accepted by the design guardrail. Verification passed `npm run lint` (0 errors, existing warnings), `npm run test:convex` (28 files / 355 tests), `npm --prefix cli test` (42 files / 472 tests), `npm --prefix cli run build`, `npx tsc --noEmit`, `npx tsc -p convex/tsconfig.json --noEmit`, `npx convex codegen --typecheck enable`, `npm run agent-docs:ci`, `npm run docs:check`, `npm run build`, and `git diff --check`. **Owner-only remaining:** deploy/push verification requires normal production ownership; GitHub OAuth/App/webhook setup still needs real secrets and app registration from Houston/operator where applicable.

## 2026-06-04 Remote Main Sync + Full Audit

### 108. Pull remote main, merge local state, verify, audit, and identify owner-only setup
**Status:** IN PROGRESS
**Verified:** NO
**Source:** 2026-06-04 — Houston said "Pull down all the changes from the remote main repo... Continue from there comprehensively."
**Request:** Bring local `main` fully up to date with remote, merge it with existing local work, prove the repo still builds/tests/runs, audit new improvements and docs, identify any keys/setup only Houston can complete, test new behavior, and keep moving comprehensively from the resulting state.
**Actionable Scope:**
1. Fetch/pull all changes from remote `main`.
2. Merge remote changes with local modifications without losing existing work.
3. Run the relevant build, lint, docs, CLI, and smoke checks.
4. Audit new improvements and docs introduced by the sync.
5. Identify required keys, credentials, environment variables, deploy permissions, or owner-only setup.
6. Test and fix new functionality where possible from this machine.
7. Update project context, commit logical local follow-through changes if any, and report remaining blocked/user-only work.
**Progress (2026-06-04):** Pulled `origin/main` and fast-forwarded local `main` from `22b09ea` to `cf56f07`, preserving and reapplying the local reference-intelligence artifacts. Audited the incoming GitHub-native wave: GitHub OAuth signup, repo create/connect, repo push/pull, webhook auto-pull, server-side repo mirror, authenticated repo file/stack APIs, setup docs, OpenAPI/docs updates, and project-context tracking. Fixed local follow-through issues found during the audit: regenerated stale `llms` docs, regenerated Convex API bindings for `lib/secretCrypto`, corrected GitHub OAuth local-dev fallback/docs/env from port `3000` to this repo's `3100`, and upgraded Next.js from `16.2.2` to `16.2.7` with root manual markers updated. Verification passed `npm run agent-docs:ci`, targeted GitHub integration ESLint, `next typegen && tsc --noEmit`, `npx convex codegen --typecheck enable`, `npm --prefix cli run build`, `npm --prefix cli test` (12 files / 69 tests), `git diff --check`, and local HTTP smoke for `/api/auth/github/start` returning `http://localhost:3100/sign-in?error=github_unconfigured` when GitHub OAuth is not configured. **Blocked/remaining:** local `next build` hangs silently with both default and `--webpack` even after the Next patch upgrade; full end-to-end GitHub OAuth/repo verification requires Houston/operator to configure the GitHub OAuth App and deployment secrets, then deploy Convex + Vercel.

## 2026-06-09 Reference-Intelligence Follow-Through

### 109. Turn the Jun 9 reference-intelligence wave into tracked You.md follow-up slices
**Status:** IN PROGRESS
**Verified:** NO
**Production Verified:** NO
**Source:** 2026-06-09 — Houston said "continue and also please commit and push to main and ensure everything works live on prod" after the daily reference-intelligence run completed.
**Request:** Continue the Jun 9 daily reference-intelligence run all the way through by turning the new upstream signals into durable tracked work, verifying the local monitor path, committing/pushing the resulting project-context updates, and smoke-checking production so the original automation goal is fully realized.
**Actionable Scope:**
1. Version the regenerated `project-context/reference-intelligence/LATEST.md` and `TASKS.md` outputs from the 2026-06-09 sync.
2. Distill the highest-value follow-up work from GStack `1626d48` and GBrain `1eb430a`.
3. Write a dated audit that maps those upstream changes to explicit You.md next steps.
4. Update TODO/features/changelog/request tracking/prompt archive so future sessions can continue without re-deriving the same two tasks.
5. Run local verification for the reference loop and smoke current public docs/API/MCP surfaces on production.
6. Commit and push the resulting local follow-through to `main`.
**Progress (2026-06-09):** Re-ran chat hygiene and the reference sync, which fetched new upstream heads for GStack and GBrain and regenerated the two reference-intelligence artifacts. The first pass surfaced two high-signal tasks, which are now preserved in `project-context/REFERENCE_INTELLIGENCE_AUDIT_2026-06-09.md`: deterministic review/report packaging for YouStacks and fail-closed protected retrieval plus malformed-frontmatter resilience for repo-native/context reads. A same-session verification re-run of `npm run references:sync` then correctly returned zero new candidates because the local reference heads were already updated. Updated project-context tracking so the two tasks stay durable even though the generated queue is now back to a caught-up steady state. Remaining in this run: commit/push and recording any prod blockers versus the unchanged live baseline.

### 110. Fix public profile portraits, default grid view, and harden scalable profile crawling
**Status:** IN PROGRESS (code complete locally; needs deploy + production smoke + user verification)
**Verified:** NO
**Production Verified:** NO
**Source:** 2026-06-09 — Houston said "please fix the profiles that are missing their ASCII portraits and let's default to grid view instead of the list view on the /profiles page... create a rule... harden how our own crawler creates and indexes and monitors and enhances these public profiles... cheap/open-source version of firecrawl... google search for agents looking up anything about real people..."
**Request:** Make public profiles reliably display a profile image or ASCII portrait on the `/profiles` index and individual public profile pages, default the directory to grid view, and design the scalable crawler/enrichment loop so You.md can grow a large SEO-friendly people index without runaway Firecrawl spend.
**Actionable Scope:**
1. Default `/profiles` to grid view. DONE locally.
2. Replace blank/broken portrait slots with a shared renderer that prefers stored ASCII, then real image, then a visible terminal fallback. DONE locally.
3. Validate stored ASCII before counting/rendering it and reject malformed empty portrait payloads in Convex directory normalization. DONE locally.
4. Add guardrails so future code/data regressions fail before deploy. DONE locally with `profiles:portrait-contract`, `profiles:portrait-audit`, and `profiles:portrait-audit:pages`.
5. Ensure individual public profile pages use the same portrait contract as the directory. DONE locally.
6. Add autonomous refresh hooks for unclaimed profile portraits. DONE locally via monthly Convex cron using existing enrichment/backfill action.
7. Preserve public profile API availability through the web domain. DONE locally via same-origin `/api/v1/profiles` proxy.
8. Document the low-cost crawler/indexing plan for thousands to hundreds of thousands of profiles. DONE locally in `PUBLIC_PROFILE_INDEXING_AND_REFRESH_PLAN.md`.
9. Deploy to production and run prod profile audits. TODO.
10. Build the production crawler/source-ledger/job-state implementation from the plan. DONE locally for the foundation: source ledger, refresh jobs, import batches, 50-target catalog, admin dry-run/import route, native metadata fetcher, content hashing, daily refresh cron, and target guard.
11. Deploy the indexing foundation, run an admin dry-run for all 50 seed targets, inspect created/patched/skipped output, then run the real import only if the dry-run is clean. TODO.
12. Add the next enrichment stage: cheap extractor routing, source-backed profile compilation, cost-capped LLM enrichment, and larger-batch monitoring. TODO.
**Progress (2026-06-09):** Added shared `ProfilePortrait`, frontend + Convex `hasRenderableAsciiPortrait` checks, stored-ASCII tile downsampling, `AsciiAvatar` overlay fallbacks, grid default, SSR profile fallback hydration, individual-profile portrait replacement, same-origin public profile API proxy, monthly Convex portrait QA cron, static contract script, dynamic API/page audit scripts, and the crawler/indexing plan. Local verification passed `profiles:portrait-contract`, `profiles:portrait-audit`, `profiles:portrait-audit:pages`, `next typegen`, web TypeScript, Convex TypeScript, targeted ESLint, `git diff --check`, local HTTP smoke for `/profiles`, `/karpathy`, and `/api/v1/profiles?username=karpathy`, plus headless Chrome screenshots showing no blank portrait boxes.
**Progress (later 2026-06-09):** Added the first scalable public-profile indexing foundation: Convex `profileSources`, `profileRefreshJobs`, and `profileImportBatches` tables; a 50-target top tech/AI/SaaS/builder catalog; internal import and source-refresh actions; admin-only HTTP routes for dry-run/import and source refresh; native HTML metadata fetch + content hashing + freshness scheduling; daily bounded source-refresh cron; and `profiles:targets-check`. Verification passed `npm run profiles:targets-check`, `npx convex codegen`, `npx tsc -p convex/tsconfig.json --noEmit`, `npx tsc --noEmit`, targeted ESLint on the new crawler files, and `git diff --check`. Production import is intentionally pending until the commit is deployed and the admin 50-target dry-run returns clean output.

## 2026-06-03 Reference-Intelligence Follow-Through

### 105. Turn the Jun 3 reference-intelligence wave into tracked You.md follow-up slices
**Status:** IN PROGRESS
**Verified:** NO
**Source:** 2026-06-03 — Houston said "continue comprehensively Highest-value follow-up tasks - then commit and push to main - then continue comprehensively" after the daily reference-intelligence run surfaced new GStack/GBrain tasks.
**Request:** Continue comprehensively by promoting the highest-value reference-intelligence follow-up tasks into concrete You.md tracking, docs/contracts, and implementation slices instead of leaving them as a flat generated queue.
**Actionable Scope:**
1. Version the fresh `project-context/reference-intelligence/LATEST.md` and `TASKS.md` outputs from the 2026-06-03 sync.
2. Distill the highest-value follow-up work across stack safety/private distribution, brain sync resilience, retrieval/readiness honesty, and runtime health/self-upgrade boundaries.
3. Write a dated audit that maps the upstream commits to explicit You.md next steps.
4. Update TODO/features/changelog/request tracking so future sessions can keep shipping the sequence instead of re-deriving it.
5. Land at least one repo-visible improvement from those highest-value tasks, then commit, push, and continue.
**Progress (2026-06-03):** Re-ran the reference loop, which produced 13 candidate tasks from GStack `c43c850` and GBrain `f09f917`..`f3ade6c`; versioned the regenerated `project-context/reference-intelligence/LATEST.md` and `TASKS.md`; added `project-context/REFERENCE_INTELLIGENCE_AUDIT_2026-06-03.md` to collapse the raw queue into four priority bands: stack safety/private distribution, brain sync resilience, retrieval/readiness honesty, and runtime health/self-upgrade boundaries; updated TODO, FEATURES, and CHANGELOG so the next implementation slices are explicit rather than buried in generated files. Followed through with a repo-visible docs/contract pass across README, `/docs#youstacks`, generated `/llms.txt` + `/llms-full.txt`, and the local/live handoff guardrails: the docs now explicitly require shell-safe adapter/helper identifiers, local-only metadata by default, honest readiness states for protected reads, and fallback-before-silence retrieval behavior. Then tightened the local runtime itself: `youstack` validation now rejects shell-unsafe `slug` and capability identifiers and warns when domain/alias/tag metadata becomes multi-line or control-character-heavy before those values flow into generated adapter files. The next slice landed stack-local readiness semantics in code: local stack CLI JSON output and MCP stack tools return an explicit readiness envelope with `not_found`, `invalid`, or `ready` instead of making agents infer state from empty payloads or plain error strings. The protected-memory follow-through now spans the broader MCP surface: `search_memories`, `youmd://memories` resources, and `get_agent_brief` memory inclusion all return or expose the same structured retrieval state (`ready`, `auth_required`, `unavailable`) plus concrete fallback guidance instead of letting auth/server failures masquerade as an empty memory set. The latest contract pass teaches the same behavior to future agents before they even call MCP: the shared stack capability contract and generated host adapters now explicitly state the protected-read readiness states and fallback order from local stack files to project-context to public identity before retrying hosted retrieval. The newer retrieval-contract fix closes a real capability gap: MCP now actually exposes the previously advertised `get_private_context` tool and `youmd://private-context` resource, both using the same readiness/fallback envelope so private-context failures stop surfacing as missing tools or ambiguous generic errors. The latest slice extends the same honesty to local project context: `get_project_context` and `youmd://projects/*` resources now return structured readiness/fallback envelopes instead of mixing raw JSON with ad hoc plain-text project errors. Local verification passed `npm --prefix cli run build`.

---

## Handoff Checker JSON Output (from Jun 2 conversation)

### 104. Add machine-readable JSON output for the agent-docs handoff checker
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_CcWeF8asBZULESwqvEKGjWYBRMmY` for commit `ee60713` completed successfully and is aliased to `https://www.you.md` / `https://you.md`; GitHub Actions run `26856413207` for `.github/workflows/agent-docs.yml` completed successfully.
**Source:** 2026-06-02 — Houston said "continue comprehensively - then commit and push to main - then continue comprehensively" after the modular agent-docs commands shipped.
**Request:** Continue improving shared agent docs/context comprehensively by making the handoff guardrail easier for agents, CI, and future automation to inspect without parsing prose.
**Actionable Scope:**
1. Add `--json` support to `scripts/check-agent-doc-handoff.mjs` with ok state, CLI version, checked files, marker counts, and failures.
2. Add `npm run agent-docs:handoff:json` as the reusable command.
3. Document and enforce the JSON command across README, root agent manuals, `/docs#agent-docs`, generated `/llms-full.txt`, local handoff markers, and live smoke expectations.
4. Run local checks, commit, push to `main`, and verify CI/deployment receipts.
**Progress (2026-06-02):** Added structured JSON output to `scripts/check-agent-doc-handoff.mjs`; added `agent-docs:handoff:json`; updated README, `AGENTS.md`, `CLAUDE.md`, `/docs#agent-docs`, generated root agent docs, handoff markers, and live smoke expectations; passed `npm run agent-docs:handoff`, `npm run agent-docs:handoff:json`, JSON parse/count assertion, `npm run agent-docs:syntax`, `npm run agent-docs:lint`, `npm run llms:check`, `npm run agent-docs:ci`, JSON command marker grep, and `git diff --check`; pushed commit `ee60713`; GitHub Actions run `26856413207` passed `Check Generated Agent Docs`; Vercel deployment `dpl_CcWeF8asBZULESwqvEKGjWYBRMmY` is Ready and aliased to `https://www.you.md` / `https://you.md`; live production `npm run llms:smoke -- --base-url https://www.you.md` passed all checks with the source-repo guardrail smoke check reporting 9 markers.

## Modular Agent Docs CI Commands (from Jun 2 conversation)

### 103. Split `agent-docs:ci` into reusable subcommands
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_BUWknQrA2KZ4J4GkQ9NKBN9iZP2H` for commit `152dd5e` completed successfully and is aliased to `https://www.you.md` / `https://you.md`; GitHub Actions run `26856191121` for `.github/workflows/agent-docs.yml` completed successfully.
**Source:** 2026-06-02 — Houston said "continue comprehensively - then commit and push to main - then continue comprehensively" after the handoff diagnostics deployment was recorded.
**Request:** Continue improving shared agent docs/context comprehensively by making the agent-docs release checks easier for future agents to run and debug.
**Actionable Scope:**
1. Split the long `npm run agent-docs:ci` command into focused syntax, handoff, and lint subcommands while keeping the umbrella command.
2. Document the modular commands in README, root agent manuals, `/docs#agent-docs`, and generated `/llms-full.txt`.
3. Extend local handoff markers and live smoke expectations so the modular commands cannot silently disappear.
4. Run local checks, commit, push to `main`, and verify CI/deployment receipts.
**Progress (2026-06-02):** Added `agent-docs:syntax`, `agent-docs:handoff`, and `agent-docs:lint`; rewired `agent-docs:ci` to call them; updated README, `AGENTS.md`, `CLAUDE.md`, `/docs#agent-docs`, generated root agent docs, handoff markers, and live smoke expectations; passed `npm run agent-docs:syntax`, `npm run agent-docs:handoff`, `npm run agent-docs:lint`, `npm run agent-docs:ci`, `npm run llms:check`, modular command marker grep, and `git diff --check`; pushed commit `152dd5e`; GitHub Actions run `26856191121` passed `Check Generated Agent Docs`; Vercel deployment `dpl_BUWknQrA2KZ4J4GkQ9NKBN9iZP2H` is Ready and aliased to `https://www.you.md` / `https://you.md`; live production `npm run llms:smoke -- --base-url https://www.you.md` passed all checks with the source-repo guardrail smoke check reporting 8 markers.

## Handoff Checker Diagnostics (from Jun 2 conversation)

### 102. Add marker-count diagnostics to the agent-docs handoff checker
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_9x5vntcS3kapiHZY9ZYQijCDzjpw` for commit `ceef051` completed successfully and is aliased to `https://www.you.md` / `https://you.md`; GitHub Actions run `26855935056` for `.github/workflows/agent-docs.yml` completed successfully.
**Source:** 2026-06-02 — continuation after local/live docs-page guardrail parity was committed and pushed.
**Request:** Continue comprehensively by making the growing agent-docs guardrail easier for future agents to understand from CI/local logs.
**Actionable Scope:**
1. Update `scripts/check-agent-doc-handoff.mjs` success output to report checked file count.
2. Report required marker count and forbidden stale-marker count in the same success output.
3. Run local checks, commit, push to `main`, and verify CI/deployment receipts.
**Progress (2026-06-02):** Added file, required-marker, and forbidden-marker counters to the handoff checker success output; passed direct `node scripts/check-agent-doc-handoff.mjs`, `npm run agent-docs:ci`, and `git diff --check`; pushed commit `ceef051`; GitHub Actions run `26855935056` passed `Check Generated Agent Docs`; Vercel deployment `dpl_9x5vntcS3kapiHZY9ZYQijCDzjpw` is Ready and aliased to `https://www.you.md` / `https://you.md`; live production `npm run llms:smoke -- --base-url https://www.you.md` passed all checks.

## Docs Page Local Guardrail Parity (from Jun 2 conversation)

### 101. Make the local handoff checker enforce expanded `/docs#agent-docs` wording
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_7RTHaMrQWf4ieQhmEgTbA171BehM` for commit `ed7facd` completed successfully and is aliased to `https://www.you.md` / `https://you.md`; GitHub Actions run `26855772471` for `.github/workflows/agent-docs.yml` completed successfully.
**Source:** 2026-06-02 — continuation after the live smoke marker output split shipped.
**Request:** Continue improving shared agent docs/context comprehensively by closing the next local-vs-production guardrail gap before committing and pushing to `main`.
**Actionable Scope:**
1. Require `scripts/check-agent-doc-handoff.mjs` to verify `/docs#agent-docs` mentions the expanded PRD/architecture source scope.
2. Require the local checker to verify `/docs#agent-docs` mentions stale stack/auth language rejection.
3. Require the local checker to verify `/docs#agent-docs` mentions required/forbidden marker checks.
4. Run local checks, commit, push to `main`, and verify CI/deployment receipts.
**Progress (2026-06-02):** Added the expanded `/docs#agent-docs` marker expectations to `scripts/check-agent-doc-handoff.mjs`; passed `npm run agent-docs:ci`, direct `node scripts/check-agent-doc-handoff.mjs`, expanded marker grep, and `git diff --check`; pushed commit `ed7facd`; GitHub Actions run `26855772471` passed `Check Generated Agent Docs`; Vercel deployment `dpl_7RTHaMrQWf4ieQhmEgTbA171BehM` is Ready and aliased to `https://www.you.md` / `https://you.md`; live production `npm run llms:smoke -- --base-url https://www.you.md` passed all checks.

## Agent Docs Smoke Output Clarity (from Jun 2 conversation)

### 100. Split source-repo guardrail markers into their own smoke check
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_ET95xLFTzNAF8EnfRTkmcWjzrCGc` for commit `c8d139b` completed successfully and is aliased to `https://www.you.md` / `https://you.md`; GitHub Actions run `26853813606` for `.github/workflows/agent-docs.yml` completed successfully.
**Source:** 2026-06-02 — continuation after the expanded public handoff guardrail wording shipped.
**Request:** Continue improving agent-docs verification so failed live smoke output points future agents to the exact class of drift.
**Actionable Scope:**
1. Keep workflow/privacy/upstream markers in their own `/llms-full.txt` smoke check.
2. Move source-repo guardrail wording markers into a separate `/llms-full.txt` smoke check.
3. Run local checks, commit, push to `main`, and verify deployment receipts.
**Progress (2026-06-02):** Split `scripts/smoke-agent-docs.mjs` so `/llms-full.txt` source-repo guardrail wording is checked separately from workflow/privacy/upstream markers; passed `npm run agent-docs:ci`, `node scripts/smoke-agent-docs.mjs --base-url https://www.you.md`, `node --check scripts/smoke-agent-docs.mjs`, and `git diff --check`; pushed commit `c8d139b`; GitHub Actions run `26853813606` passed `Check Generated Agent Docs`; Vercel deployment `dpl_ET95xLFTzNAF8EnfRTkmcWjzrCGc` is Ready and aliased to `https://www.you.md` / `https://you.md`; live production `npm run llms:smoke -- --base-url https://www.you.md` passed with separate workflow/privacy/upstream and source-repo guardrail marker checks.

## Public Agent Docs Guardrail Wording (from Jun 2 conversation)

### 99. Publish the expanded handoff-checker scope in generated and web docs
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_6Y696yy1PZyoCQ1Efy38Y7MBvRbe` for commit `930bd36` completed successfully and is aliased to `https://www.you.md` / `https://you.md`; GitHub Actions run `26853627596` for `.github/workflows/agent-docs.yml` completed successfully.
**Source:** 2026-06-02 — continuation after the forbidden stale-marker guardrail was committed and pushed.
**Request:** Continue comprehensively by ensuring the public agent-facing docs describe the expanded source-repo guardrail accurately.
**Actionable Scope:**
1. Update the root agent-docs generator so `/llms-full.txt` explains that `scripts/check-agent-doc-handoff.mjs` covers README, root manuals, `/docs` source, PRD, architecture docs, and stale stack/auth language.
2. Update `/docs#agent-docs` command copy with the same expanded required/forbidden marker scope.
3. Extend `scripts/smoke-agent-docs.mjs` so live production smoke verifies the expanded wording in `/llms-full.txt` and `/docs`.
4. Regenerate root agent docs, run local checks, commit, push to `main`, and verify deployment receipts.
**Progress (2026-06-02):** Updated `scripts/generate-llms-docs.mjs`, `src/app/(app)/docs/docs-content.tsx`, and `scripts/smoke-agent-docs.mjs`; regenerated `public/llms.txt` and `public/llms-full.txt`; passed `npm run agent-docs:ci`, `npm run llms:check`, expanded wording marker grep, and `git diff --check`; pushed commit `930bd36`; GitHub Actions run `26853627596` passed `Check Generated Agent Docs`; Vercel deployment `dpl_6Y696yy1PZyoCQ1Efy38Y7MBvRbe` is Ready and aliased to `https://www.you.md` / `https://you.md`; live production `npm run llms:smoke -- --base-url https://www.you.md` passed the expanded wording checks.

## Forbidden Stale Handoff Markers (from Jun 2 conversation)

### 98. Make the agent-docs checker reject stale stack/auth language
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_HwHPUDBVWf3ayk6fdPvT4csAqnBe` for commit `ed0d62a` completed successfully and is aliased to `https://www.you.md` / `https://you.md`; GitHub Actions run `26853454878` for `.github/workflows/agent-docs.yml` completed successfully.
**Source:** 2026-06-02 — Houston said "continue comprehensively - then commit and push to main - then continue comprehensively" after the active auth architecture cleanup was deployed.
**Request:** Continue hardening shared agent docs/context so future docs can fail CI not only when good handoff markers disappear, but also when obsolete stack/auth claims reappear.
**Actionable Scope:**
1. Extend `scripts/check-agent-doc-handoff.mjs` with per-file forbidden marker checks.
2. Forbid stale Next 16.1.6, Framer Motion naming, Clerk auth stack, Prod Clerk, and Clerk Backend API language in root `AGENTS.md` and `CLAUDE.md`.
3. Forbid stale Clerk-era auth-flow, user-table, route, and external-services markers in active `project-context/ARCHITECTURE.md`.
4. Forbid stale `users (1:1 Clerk)` PRD relationship language.
5. Run local checks, commit, push to `main`, and verify deployment receipts.
**Progress (2026-06-02):** Added `forbiddenMarkers` support to `scripts/check-agent-doc-handoff.mjs`; configured stale stack/auth forbidden markers for root manuals plus active architecture/PRD docs; passed `npm run agent-docs:ci`, direct `node scripts/check-agent-doc-handoff.mjs`, forbidden stale-marker grep, and `git diff --check`; pushed commit `ed0d62a`; GitHub Actions run `26853454878` passed `Check Generated Agent Docs`; Vercel deployment `dpl_HwHPUDBVWf3ayk6fdPvT4csAqnBe` is Ready and aliased to `https://www.you.md` / `https://you.md`; live production `npm run llms:smoke -- --base-url https://www.you.md` passed all checks.

## Architecture Auth Source-Of-Truth Cleanup (from Jun 2 conversation)

### 97. Remove stale Clerk-era auth language from active PRD/architecture docs
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_4DtvTt6comrhxsy7mkPFisPtA1BF` for commit `bb73faa` completed successfully and is aliased to `https://www.you.md` / `https://you.md`; GitHub Actions run `26853267125` for `.github/workflows/agent-docs.yml` completed successfully.
**Source:** 2026-06-02 — continuation of Houston's request to keep improving shared agent docs/context comprehensively after committing and pushing to `main`.
**Request:** Continue improving project-context source-of-truth docs so future agents see the current first-party passwordless auth architecture instead of obsolete Clerk-era language.
**Actionable Scope:**
1. Update `project-context/ARCHITECTURE.md` external-services, data-model, auth-flow, and route descriptions to use first-party passwordless auth language.
2. Update `project-context/PRD.md` data-model relationships to describe first-party auth subjects.
3. Extend `scripts/check-agent-doc-handoff.mjs` so active PRD/architecture auth markers are checked locally.
4. Expand `.github/workflows/agent-docs.yml` path filters so PRD/architecture edits trigger the guardrail.
5. Run local checks, commit, push to `main`, and verify the deployment receipts.
**Progress (2026-06-02):** Updated active architecture/PRD auth docs away from stale Clerk-era provider wording while keeping the legacy `clerkId` schema field name honest as a compatibility subject key; added PRD/architecture auth markers to the handoff checker; added `project-context/ARCHITECTURE.md` and `project-context/PRD.md` to the agent-docs workflow path filters; passed `npm run agent-docs:ci`, workflow path marker check, stale architecture/PRD Clerk-era grep, and `git diff --check`; pushed commit `bb73faa`; GitHub Actions run `26853267125` passed `Check Generated Agent Docs`; Vercel deployment `dpl_4DtvTt6comrhxsy7mkPFisPtA1BF` is Ready and aliased to `https://www.you.md` / `https://you.md`; live production `npm run llms:smoke -- --base-url https://www.you.md` passed all checks.

## Root Manual Stack Truth Guardrail (from Jun 2 conversation)

### 96. Align root agent manuals with current app stack and first-party auth
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_3xHhPeCq4za3oSHGbN7xX5Y3nujs` for commit `8bf8c18` completed successfully and is aliased to `https://www.you.md` / `https://you.md`; GitHub Actions run `26853067906` for `.github/workflows/agent-docs.yml` completed successfully.
**Source:** 2026-06-02 — continuation of Houston's request to keep improving shared agent docs/context comprehensively after committing and pushing to `main`.
**Request:** Continue improving repo-visible agent context by removing stale stack/auth claims from root manuals and making local CI catch future drift.
**Actionable Scope:**
1. Update `AGENTS.md` and `CLAUDE.md` to match current `package.json` app dependency versions for Next, React, Motion, and Convex.
2. Replace stale Clerk auth rows with first-party passwordless web sessions, email-code CLI login, signed cookies/JWKS, and scoped API keys.
3. Extend `scripts/check-agent-doc-handoff.mjs` so root manual stack markers are derived from package metadata where possible.
4. Run local checks, commit, push to `main`, and verify the deployment receipts.
**Progress (2026-06-02):** Updated root manuals from Next `16.1.6` to `16.2.2`, from Framer Motion wording to the installed `motion` package, and from stale Clerk rows to first-party passwordless auth rows; extended the handoff checker to derive Next/React/Motion/Convex versions from `package.json` and require the active auth/JWKS rows; passed `npm run agent-docs:ci`, stale root-manual grep for `Clerk` / `16.1.6` / `Framer Motion`, and `git diff --check`; pushed commit `8bf8c18`; GitHub Actions run `26853067906` passed `Check Generated Agent Docs`; Vercel deployment `dpl_3xHhPeCq4za3oSHGbN7xX5Y3nujs` is Ready and aliased to `https://www.you.md` / `https://you.md`; live production `npm run llms:smoke -- --base-url https://www.you.md` passed all checks.

## Dynamic Handoff CLI Version Guardrail (from Jun 2 conversation)

### 95. Derive root agent-manual CLI version checks from `cli/package.json`
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_Phut9JEZc3ZuhhPi3mfXZ2FX9Umx` for commit `51cdc32` completed successfully and is aliased to `https://www.you.md` / `https://you.md`; GitHub Actions run `26852875154` for `.github/workflows/agent-docs.yml` completed successfully.
**Source:** 2026-06-02 — Houston said "continue comprehensively - then commit and push to main - then continue comprehensively" after the local docs-page handoff guardrail shipped.
**Request:** Continue improving the shared agent docs/context layer by making the local handoff marker guardrail stay current when the CLI package version changes.
**Actionable Scope:**
1. Update `scripts/check-agent-doc-handoff.mjs` so it reads the current CLI version from `cli/package.json`.
2. Require root `AGENTS.md` and `CLAUDE.md` to include both the current `youmd X.Y.Z` stack row and `CLI package (npm: youmd, vX.Y.Z)` project-structure row.
3. Correct stale project-context architecture references for the CLI package version.
4. Run local checks, commit, push to `main`, and verify the resulting CI/deployment receipts.
**Progress (2026-06-02):** Updated the handoff checker to derive `youmd 0.6.23` / `CLI package (npm: youmd, v0.6.23)` markers from `cli/package.json`; corrected `project-context/ARCHITECTURE.md` from `v0.5.0` to `v0.6.23`; passed `npm run agent-docs:ci`, direct `node scripts/check-agent-doc-handoff.mjs`, and `git diff --check`; pushed commit `51cdc32`; GitHub Actions run `26852875154` passed `Check Generated Agent Docs`; Vercel deployment `dpl_Phut9JEZc3ZuhhPi3mfXZ2FX9Umx` is Ready and aliased to `https://www.you.md` / `https://you.md`; live production `npm run llms:smoke -- --base-url https://www.you.md` passed all checks.

## Local Handoff Marker Coverage For Docs Page (from Jun 2 conversation)

### 94. Extend local handoff marker checks to `/docs#agent-docs`
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_6x8AA2W56JepwY8zN4CQNJNbASaW` for commit `1e3e57e` completed successfully and is aliased to `https://www.you.md` / `https://you.md`; GitHub Actions run `26852593769` for `.github/workflows/agent-docs.yml` completed successfully.
**Source:** 2026-06-02 — continuation after `/docs#agent-docs` shipped the source-repo handoff commands.
**Request:** Continue comprehensively by making the local CI guardrail catch docs-page handoff drift before a deploy or production smoke.
**Actionable Scope:**
1. Extend `scripts/check-agent-doc-handoff.mjs` to check `src/app/(app)/docs/docs-content.tsx`.
2. Require the docs page source to keep the root docs URLs, docs reference, OpenAPI, MCP discovery, stack capabilities, README/AGENTS/CLAUDE handoff row, handoff marker script, and `agent-docs:ci`.
3. Run local CI, commit, push to `main`, and production-smoke.
**Progress (2026-06-02):** Added the docs page source to `scripts/check-agent-doc-handoff.mjs` marker coverage; passed `npm run agent-docs:ci`, direct `node scripts/check-agent-doc-handoff.mjs`, and `git diff --check`; pushed commit `1e3e57e`; GitHub Actions run `26852593769` passed `Check Generated Agent Docs`; Vercel deployment `dpl_6x8AA2W56JepwY8zN4CQNJNbASaW` is Ready and aliased to `https://www.you.md` / `https://you.md`; live production `npm run llms:smoke -- --base-url https://www.you.md` passed all checks.

## Docs Page Source Repo Handoff (from Jun 2 conversation)

### 93. Bring `/docs#agent-docs` up to the source-repo handoff standard
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_5vKbdeCp1k9Lfj2ZsyroUc5538N9` for commit `b8c91b3` completed successfully and is aliased to `https://www.you.md` / `https://you.md`; GitHub Actions run `26852409585` for `.github/workflows/agent-docs.yml` completed successfully.
**Source:** 2026-06-02 — Houston said "continue comprehensively - then commit and push to main - then continue comprehensively" after generated root docs learned the source-repo handoff.
**Request:** Continue comprehensively by keeping the web docs page aligned with the generated root agent docs, README, and root agent manuals.
**Actionable Scope:**
1. Update `/docs#agent-docs` to explain README, `AGENTS.md`, and `CLAUDE.md` as repo-visible handoff surfaces.
2. Add the handoff marker script and full `agent-docs:ci` command to the docs page.
3. Extend production smoke checks so `/docs` must include those source-repo handoff markers.
4. Verify locally, commit, push to `main`, and production-smoke after Vercel deploys.
**Progress (2026-06-02):** Updated `src/app/(app)/docs/docs-content.tsx` so `/docs#agent-docs` documents README/root agent manuals, the handoff marker script, and `agent-docs:ci`; updated `scripts/smoke-agent-docs.mjs` so live docs-page smoke checks require those markers; passed local `npm run agent-docs:ci`, targeted ESLint for docs content and smoke script, and `git diff --check`; pushed commit `b8c91b3`; GitHub Actions run `26852409585` passed `Check Generated Agent Docs`; Vercel deployment `dpl_5vKbdeCp1k9Lfj2ZsyroUc5538N9` is Ready and aliased to `https://www.you.md` / `https://you.md`; live production `npm run llms:smoke -- --base-url https://www.you.md` passed the strengthened docs-page handoff checks.

## Generated Source Repo Handoff In Root Agent Docs (from Jun 2 conversation)

### 92. Teach generated root agent docs about README/AGENTS/CLAUDE handoff surfaces
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_JCuw4fjSbkASm31i6iywADTLTEog` for commit `76f3075` completed successfully and is aliased to `https://www.you.md` / `https://you.md`; GitHub Actions run `26850743219` for `.github/workflows/agent-docs.yml` completed successfully.
**Source:** 2026-06-02 — Houston said "commit and push to main - then continue" after the handoff-marker CI guardrail shipped.
**Request:** Continue improving the shared agent docs/context layer so generated root agent docs also explain the repo-visible README, `AGENTS.md`, and `CLAUDE.md` handoff path that future coding agents should use.
**Actionable Scope:**
1. Update the `llms.txt` / `llms-full.txt` generator to include source-repo handoff guidance.
2. Regenerate `public/llms.txt` and `public/llms-full.txt`.
3. Update live smoke checks so the source-repo handoff markers are production-verified.
4. Run docs checks, commit, push to `main`, and production-smoke.
**Progress (2026-06-02):** Updated `scripts/generate-llms-docs.mjs` to mention the source repo, README "For Agents", root `AGENTS.md`/`CLAUDE.md`, the agent-docs workflow, and the handoff marker script; updated `scripts/smoke-agent-docs.mjs` to verify those markers; regenerated `public/llms.txt` and `public/llms-full.txt`; passed local `npm run agent-docs:ci` and `git diff --check`; pushed commit `76f3075`; GitHub Actions run `26850743219` passed `Check Generated Agent Docs`; Vercel deployment `dpl_JCuw4fjSbkASm31i6iywADTLTEog` is Ready and aliased to `https://www.you.md` / `https://you.md`; upgraded live production `npm run llms:smoke -- --base-url https://www.you.md` passed all source-repo handoff checks.

## Agent Docs Handoff CI Coverage (from Jun 2 conversation)

### 91. Guard README and root agent-manual generated-doc handoffs in CI
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_DX4g1vvZShDE3BaAxprMVhMfpiiw` for commit `2917ea6` completed successfully and is aliased to `https://www.you.md` / `https://you.md`; GitHub Actions run `26850497617` for `.github/workflows/agent-docs.yml` completed successfully.
**Source:** 2026-06-02 — Houston said "commit and push to main - then continue" after the agent-manual docs preflight shipped.
**Request:** Keep improving the shared agent docs/context layer by ensuring repo-visible handoff surfaces do not drift or disappear after they were added to README, `AGENTS.md`, and `CLAUDE.md`.
**Actionable Scope:**
1. Add a CI check that asserts README, `AGENTS.md`, and `CLAUDE.md` contain the generated-doc URLs and release-check commands.
2. Wire that check into `npm run agent-docs:ci`.
3. Expand `.github/workflows/agent-docs.yml` path filters so README and root agent manuals trigger the workflow.
4. Verify locally, commit, push to `main`, and production-smoke the resulting deployment.
**Progress (2026-06-02):** Added `scripts/check-agent-doc-handoff.mjs`, wired it into `npm run agent-docs:ci`, and added README/root agent manuals plus the new script to the agent-docs workflow path filters; passed local `npm run agent-docs:ci`, workflow path marker check, and `git diff --check`; pushed commit `2917ea6`; GitHub Actions run `26850497617` passed `Check Generated Agent Docs`; Vercel deployment `dpl_DX4g1vvZShDE3BaAxprMVhMfpiiw` is Ready and aliased to `https://www.you.md` / `https://you.md`; live production `npm run llms:smoke -- --base-url https://www.you.md` passed all checks.

## Agent Manual Generated Docs Preflight (from Jun 2 conversation)

### 90. Add generated-docs preflight to root agent manuals
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_BVdXiSU1uUBEJppmbJvLV79F4YTa` for commit `98683a5` completed successfully and is aliased to `https://www.you.md` / `https://you.md`.
**Source:** 2026-06-02 — follow-on from Houston's "commit and push to main - then continue" request after the README handoff shipped.
**Request:** Keep improving shared agent scripts/skills/context by making repo-visible coding-agent manuals route future agents through the generated You.md docs/API/MCP/stack surfaces before they change product contracts.
**Actionable Scope:**
1. Add an Agent Docs Preflight section to `AGENTS.md` and `CLAUDE.md`.
2. Point future agents to `/llms.txt`, `/llms-full.txt`, docs reference, OpenAPI, MCP discovery, and stack capabilities.
3. Add the docs drift and live smoke commands to the manuals.
4. Correct stale CLI version references in the manuals.
5. Verify, commit, push, and production-smoke the final deployment.
**Progress (2026-06-02):** Added the generated-docs preflight blocks to `AGENTS.md` and `CLAUDE.md`; updated the CLI version references from `0.4.9` / `0.5.0` to `0.6.23`; passed `npm run agent-docs:ci`, `git diff --check`, and manual grep checks for stale version strings plus the new preflight sections; pushed commit `98683a5`; Vercel deployment `dpl_BVdXiSU1uUBEJppmbJvLV79F4YTa` is Ready and aliased to `https://www.you.md` / `https://you.md`; live production `npm run llms:smoke -- --base-url https://www.you.md` passed all checks.

## README Agent Docs Handoff (from Jun 2 conversation)

### 89. Make source-repo readers discover generated agent docs and release checks
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_9BGpnTgiBMLLDGoNsWvfkdhtTDLY` for commit `69d1102` completed successfully and is aliased to `https://www.you.md` / `https://you.md`.
**Source:** 2026-06-02 — Houston said "commit and push to main - then continue" after the agent-docs CI guardrail shipped.
**Request:** Keep pushing the shared agent docs/context layer by making GitHub/npm/source readers and future agents quickly find the live generated docs, API/MCP surfaces, stack capabilities, and release checks.
**Actionable Scope:**
1. Add a concise README section for agents that points to `/llms.txt`, `/llms-full.txt`, docs reference, OpenAPI, MCP discovery, and stack capabilities.
2. Add the local/production agent-docs verification commands to README.
3. Correct stale README development port guidance for the frontend dev server.
4. Run docs drift checks and live smoke checks before committing.
5. Commit, push to `main`, and verify the resulting Vercel deployment.
**Progress (2026-06-02):** Added a README "For Agents" handoff with the generated live docs/API/MCP/stack URLs and the `docs:check`, `llms:smoke`, and `agent-docs:ci` release commands; corrected the frontend dev port from 3000 to 3100; passed local `npm run agent-docs:ci`, live `npm run llms:smoke -- --base-url https://www.you.md`, and `git diff --check`; pushed commit `69d1102`; Vercel deployment `dpl_9BGpnTgiBMLLDGoNsWvfkdhtTDLY` is Ready and aliased to `https://www.you.md` / `https://you.md`; live production `npm run llms:smoke -- --base-url https://www.you.md` passed all checks.

## Agent Docs CI Guardrail (from Jun 2 conversation)

### 88. Add CI guardrail for generated agent docs drift
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_6GAWESCyK3kYEhWuviYppbhGoMD8` for commit `eaed7be` completed successfully and is aliased to `https://www.you.md` / `https://you.md`; GitHub Actions run `26849731544` for `.github/workflows/agent-docs.yml` completed successfully.
**Source:** 2026-06-02 — Houston said "commit and push to main - then continue" after the live/local agent-docs smoke command shipped.
**Request:** Ensure pending work is committed and pushed to `main`, then continue improving the shared agent docs/context layer with stronger guardrails.
**Actionable Scope:**
1. Confirm `main` is clean and already pushed before continuing.
2. Add a reusable CI command for generated agent docs checks.
3. Add a GitHub Actions workflow that runs on agent-docs-related changes.
4. Verify the new CI command and workflow syntax locally.
5. Commit, push to `main`, and production/CI-status check after deployment.
**Progress (2026-06-02):** Confirmed `main` matched `origin/main` at `ee9aae3`, added `npm run agent-docs:ci`, added `.github/workflows/agent-docs.yml` with path-scoped push/PR/manual triggers for agent-docs source files, and passed local `npm run agent-docs:ci`, YAML parse, and `git diff --check`. Production/deployment verification passed on Vercel deployment `dpl_6GAWESCyK3kYEhWuviYppbhGoMD8`; live `npm run llms:smoke -- --base-url https://www.you.md` passed all checks; GitHub Actions run `26849731544` passed `Check Generated Agent Docs`.

## Agent Docs Smoke Automation (from Jun 2 conversation)

### 87. Add reusable live/local smoke checks for root agent docs
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_5z5yoHXRThajMiMG2YojwYyc61Am` for commit `1c66b8e` completed successfully and is aliased to `https://www.you.md` / `https://you.md`.
**Source:** 2026-06-02 — Houston said "continue improving" after the generated root agent docs pipeline shipped.
**Request:** Keep improving the shared agent docs/context layer by making the new root agent docs easier to verify locally, in production, and from future automations.
**Actionable Scope:**
1. Add a reusable smoke script for `/llms.txt`, `/llms-full.txt`, docs reference, MCP discovery, robots, sitemap, and `/docs#agent-docs`.
2. Compare live root agent docs against the generated docs reference source hash, CLI version, endpoint count, and MCP tool count.
3. Expose the command through `package.json`.
4. Add the smoke command to `/docs#agent-docs` and the generated full agent context.
5. Verify against production and localhost, then commit, push, deploy, and production-smoke.
**Progress (2026-06-02):** Added `scripts/smoke-agent-docs.mjs`, wired `npm run llms:smoke`, updated the generated full agent context and `/docs#agent-docs` to include the release smoke command, regenerated root agent docs, and passed production smoke on `https://www.you.md`, local smoke on `http://localhost:3100`, docs generation/checks, targeted ESLint, TypeScript, ASCII scan, and `git diff --check`. Production verification passed on deployment `dpl_5z5yoHXRThajMiMG2YojwYyc61Am`: `npm run llms:smoke -- --base-url https://www.you.md` checks docs reference JSON, root agent docs, source hash/count alignment, MCP discovery, robots, sitemap, and docs-page command markers.

## Generated Agent Docs Pipeline (from Jun 2 conversation)

### 86. Make root agent docs generated and drift-checked
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_J5wdK3PHkCED8ZoFyW7bFvRYNtqT` for commit `a00bc1f` completed successfully and is aliased to `https://www.you.md` / `https://you.md`.
**Source:** 2026-06-02 — Houston said "continue comprehensively" after the root `llms.txt` / `llms-full.txt` surfaces shipped.
**Request:** Continue the shared agent docs/context improvements comprehensively by making the newly added agent-readable docs easier to maintain, more robust, and less likely to drift from shipped routes, MCP tools, CLI metadata, and upstream reference intelligence.
**Actionable Scope:**
1. Add a generator for `public/llms.txt` and `public/llms-full.txt`.
2. Add `llms:generate` and `llms:check` scripts.
3. Wire `docs:generate`, `docs:check`, and `prebuild` so root agent docs are regenerated/checked with the existing docs reference path.
4. Pull concrete endpoint/tool counts, docs/MCP/YouStacks/schema/public-profile endpoints, CLI version, source hash, and upstream reference heads into the generated files.
5. Refresh reference-intelligence artifacts and confirm no new upstream task candidates.
6. Update `/docs#agent-docs` so maintainers know the root agent files are generated.
7. Verify docs generation/checks, TypeScript, targeted lint, ASCII safety, local HTTP smoke, then commit/push/deploy and production-smoke.
**Progress (2026-06-02):** Added `scripts/generate-llms-docs.mjs`, wired `npm run llms:generate` and `npm run llms:check`, connected root agent docs to `docs:generate`/`docs:check`, refreshed the reference-intelligence artifacts with no new task candidates, improved generated docs-reference summaries for OpenAPI and schema routes, regenerated `src/generated/*`, `public/llms.txt`, and `public/llms-full.txt`, and passed local docs checks, TypeScript, targeted ESLint, ASCII scan, `git diff --check`, and local HTTP smoke on `http://localhost:3100`. Production verification passed on deployment `dpl_J5wdK3PHkCED8ZoFyW7bFvRYNtqT`: live `/llms.txt` includes generated source hash, CLI version, route/tool counts, and reference-intelligence markers; `/llms-full.txt` includes generated endpoint/tool/upstream sections; `/docs` includes `llms:check` / `llms:generate`; `robots.txt` and `sitemap.xml` still expose the root docs.

## Agent-Readable Docs Surfaces (from Jun 2 conversation)

### 85. Add root-level `llms.txt` / `llms-full.txt` agent context surfaces
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_GcSaYeSrzo1JRaqVa9MAyMr4J2VY` for commit `0bec57c` completed successfully and is aliased to `https://www.you.md` / `https://you.md`.
**Source:** 2026-06-02 — Houston said "ok lets do it - keep rocking and pushing forward hard" after the next-step plan to make You.md easier for agents to discover and consume.
**Request:** Continue pushing the API/MCP/stack docs and shared agent-context strategy forward by adding machine-friendly, root-level docs that help agents understand You.md quickly and route into the right docs/API/MCP/YouStack surfaces.
**Actionable Scope:**
1. Add `/llms.txt` as the short agent-readable index for You.md.
2. Add `/llms-full.txt` as the full plain-text agent context pack for docs, API, MCP, runtime, stacks, smoke checks, and upstream reference intelligence.
3. Wire the new surfaces into `/docs`, `robots.txt`, and `sitemap.xml` so agents and crawlers can discover them.
4. Verify local serving, docs markers, robots, sitemap, docs reference freshness, TypeScript, targeted ESLint, and whitespace checks.
5. Commit, push to `main`, and production-smoke the live URLs after Vercel deploys.
**Progress (2026-06-02):** Added static `public/llms.txt` and `public/llms-full.txt`, added a `/docs#agent-docs` section with agent preflight commands, allowed the new docs/reference paths in robots, added the root docs to the sitemap, and passed local docs check, TypeScript, targeted ESLint, `git diff --check`, and local HTTP smoke on `http://localhost:3100`. Production verification passed on deployment `dpl_GcSaYeSrzo1JRaqVa9MAyMr4J2VY`: live `/llms.txt` returns 200 with expected docs/stack/reference-intelligence markers, `/llms-full.txt` includes agent order of operations, YouStacks, smoke checks, and privacy/trust markers, `/docs` includes Agent Docs plus the new GET rows, `robots.txt` allows the new docs/reference paths, and `sitemap.xml` includes both root docs files.

## Codex Chat Hygiene (from Jun 2 conversation)

### 84. Consolidate automation chats and preserve useful context
**Status:** DONE
**Verified:** NO
**Production Verified:** N/A
**Source:** 2026-06-02 — Houston noticed recurring daily Codex automations burying active You.md work chats and asked for a project-specific and global strategy for managing chat sprawl without losing useful context.
**Request:** Keep automation-created Codex chats from burying real active work; consolidate or remove recurring automation threads in a way that preserves the useful context; apply the thinking specifically to You.md and generally across Codex projects.
**Actionable Scope:**
1. Inspect local Codex automations and identify duplicate recurring jobs.
2. Pause overlapping You.md automation schedules so daily reference intelligence runs through one canonical job.
3. Preserve a durable digest/index of archived automation transcript paths and the intended global chat-hygiene policy.
4. Archive completed automation threads from the active You.md sidebar without deleting their transcript files.
5. Update project-context tracking so future agents keep automation output in durable project files and automation memory.
**Progress (2026-06-02):** Paused duplicate automation `daily-gstack-gbrain-reference-intelligence`, kept `daily-gstack-gbrain-reference-sync` active as the single daily 8:30 AM reference-intelligence job, added `project-context/CODEX_CHAT_HYGIENE.md`, and then performed the harder cleanup after the sidebar still showed daily runs: moved matching automation JSONL transcripts from `~/.codex/sessions` into `~/.codex/archived_sessions`, set all 14 matching You.md daily-reference threads to `archived=1`, removed 13 daily-reference rows from `session_index.jsonl`, added `scripts/codex-chat-hygiene.mjs` / `npm run codex:chat-hygiene`, and updated the active automation prompt to run the hygiene command before future syncs.

## Reference Intelligence Artifact Versioning (from Jun 2 conversation)

### 83. Always version refreshed reference-intelligence artifacts and session context
**Status:** DONE
**Verified:** NO
**Production Verified:** N/A
**Source:** 2026-06-02 — Houston request during the daily reference-intelligence review to always check in refreshed reference artifacts, commit anything completed in the chat, and push it to `main`.
**Request:** Treat refreshed `project-context/reference-intelligence/*` files as versioned daily artifacts; capture the completed session context in the project trackers; commit and push the resulting changes.
**Actionable Scope:**
1. Run `npm run references:sync` and keep the generated `LATEST.md` / `TASKS.md` changes in git when they refresh.
2. Update the project-context trackers to record what this session completed and that this daily artifact versioning behavior is expected going forward.
3. Archive Houston's exact prompts from this session into `project-context/PROMPTS.md`.
4. Commit the generated artifacts plus session-context updates and push `main`.
**Progress (2026-06-02):** Re-ran the local reference-intelligence loop, regenerated `project-context/reference-intelligence/LATEST.md` and `TASKS.md`, confirmed the current sync produced no candidate tasks, archived this session's prompts from the Codex session log, updated the project-context trackers, and pushed the resulting commits to `origin/main`.

## Agent Stack Upstream Monitoring (from Jun 1 conversation)

### 82. Make homepage minimal and upgrade docs to BAMF-style API/MCP/stack standard
**Status:** IN PROGRESS
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_7rodpWtQzYwZSqtfdPZTY95hsu9k` for commit `3e2c83b` completed successfully and is aliased to `https://www.you.md` / `https://you.md`.
**Source:** 2026-06-01 — Houston request to continue improvements, keep homepage simple/minimal, make docs robust, follow the higher-standard BAMF.ai API/MCP/stack docs setup/layout, test, commit, and push to main.
**Request:** Ensure the product looks and works amazingly; keep the homepage simple, clear, and minimal; upgrade docs design/structure to match the BAMF docs standard for API/MCP/stack docs; keep identifying and applying improvements; test, commit, and push to main.
**Actionable Scope:**
1. Keep the homepage reduced to the core hero/CTA path instead of section sprawl.
2. Rework `/docs` around start, API, MCP, local stack runtime, agent workflows, examples, and generated reference surfaces.
3. Add an explicit docs/API/MCP/stack standard so every capability has a guide, API contract, MCP surface where needed, local stack path, and smoke check.
4. Carry Agent Scripts and The Library into the public docs reference loop alongside GStack/GBrain.
5. Verify docs reference freshness, targeted lint, TypeScript, local page rendering, protected-route redirect behavior, MCP discovery, and redirect sanitizer behavior.
6. Commit bisected changes and push `main`.
**Progress (2026-06-01):** Local pass upgraded `/docs` with a BAMF-inspired docs map, generated reference stats near the top, an explicit API/MCP/Stack Standard, expanded reference-intelligence language for GStack, GBrain, Agent Scripts, and The Library, and stricter terminal-native docs styling. Homepage remains simplified to Hero + CTA/footer. Local verification passed `npm run docs:check`, `npx tsc --noEmit`, targeted ESLint on touched files, `git diff --check`, local `http://localhost:3100/` and `/docs` 200 smoke, `/shell` redirect to `/sign-in?next=%2Fshell`, `.well-known/mcp.json`, and direct `sanitizeNextPath` checks. Production verification passed on deployment `dpl_7rodpWtQzYwZSqtfdPZTY95hsu9k`: live `/` and `/docs` return 200, docs include the new surface map/API-MCP-stack standard/upstream markers, `/shell` redirects to `/sign-in?next=%2Fshell`, `/.well-known/mcp.json` responds, and `/api/v1/docs/reference` reports 68 endpoints plus 23 MCP tools. Full repo ESLint still fails on pre-existing ignored reference-repo and React Compiler issues; local `npm run build` still hangs in the Next 16 build worker after docs generation under Node 22, while Vercel production build succeeds.

### 81. Add Agent Scripts and The Library to You.md's core upstream reference loop
**Status:** IN PROGRESS
**Verified:** NO
**Production Verified:** NO
**Source:** 2026-06-01 — Houston request to use `steipete/agent-scripts` and keep it, `disler/the-library`, GStack, and GBrain monitored as core inspiration for You.md shared skills/scripts/context.
**Request:** Make shared agent skills, scripts, prompts, context, memory, preferences, source catalogs, and cross-agent stack distribution a first-class You.md product goal; monitor `agent-scripts` and `the-library` alongside GStack/GBrain; audit current You.md gaps; add README credits and open-source/product-boundary direction.
**Actionable Scope:**
1. Add `steipete/agent-scripts` and `disler/the-library` to the local upstream reference monitor.
2. Update project-context docs so You.md treats shared skills/scripts/prompts/context/memory/preferences/catalogs as core platform architecture.
3. Audit what You.md already has and what should improve for elegance, simplicity, onboarding, stack catalogs, typed dependencies, and source-of-truth sync.
4. Update `youstack-start` / `youstack-maintainer` guidance so host agents use upstream lessons when improving stacks.
5. Add README hat-tip credits and clarify the mostly-open-source plus hosted/protected-service boundary.
6. Retarget the daily Codex reference automation to summarize all monitored upstreams, not only GStack/GBrain.
**Progress (2026-06-01):** Added the two repos to `scripts/reference-intelligence.mjs`; generated local ignored clones under `.reference-repos/steipete/agent-scripts` and `.reference-repos/disler/the-library`; updated `REFERENCE_INTELLIGENCE.md`, `YOUSTACKS_PRODUCT_LAYER_PRD.md`, `YOUSTACKS_IMPLEMENTATION_PLAN.md`, README credits, bundled YouStack skills, and `AGENT_STACK_UPSTREAM_AUDIT_2026-06-01.md`. The first expanded sync captured Agent Scripts `5dc3c24` and The Library `47f455c` with 13 bootstrap candidate tasks; the verification rerun correctly reports no new candidates because the local reference state is now current.

## Homepage Minimal + Redirect Gate QA (from May 30 conversation)

### 78. Make the homepage minimal and confirm cookie-gate redirects
**Status:** IN PROGRESS
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_7rodpWtQzYwZSqtfdPZTY95hsu9k` confirms live homepage and `/shell` redirect behavior.
**Source:** 2026-05-30 — Houston feedback: "homepage is way too complicated" + "confirm /shell//dashboard redirect behavior"
**Request:** Further simplify the marketing homepage so it feels minimal, clear, and intentional; confirm the cookie-based gate cleanly redirects unauthenticated users and does not allow `next=//...` open redirects.
**Actionable Scope:**
1. Reduce homepage section sprawl to a small, intentional sequence.
2. Ensure auth gate redirects `/shell` + `/dashboard` to `/sign-in?next=/...` when unauthenticated.
3. Sanitize `next` so `//evil.com` cannot be used as an open redirect and double-slash paths are normalized.
4. Verify `next build` and a quick local `/shell` + `/dashboard` curl pass.
**Progress (2026-06-01):** Homepage remains reduced to Hero + CTA/footer. Local dev server verified `/` returns 200 and `/shell` redirects to `/sign-in?next=%2Fshell`; `sanitizeNextPath` rejects `//evil.com`, absolute `https://...`, and triple-slash paths. Production deployment `dpl_7rodpWtQzYwZSqtfdPZTY95hsu9k` is ready and live aliases verify `/` 200 plus `/shell` -> `/sign-in?next=%2Fshell`.

## You.md Vision Simplification (from May 27 conversation)

### 74. Finish the next product-clarity pass across remaining app surfaces
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_D2ZEuhDf5LUQFzW8JToASft64e5m` for commit `5f2150f` completed successfully, is aliased to `https://www.you.md` / `https://you.md`, and is live at `https://youmd-lh226mne7-hubify.vercel.app`.
**Request:** Continue the simplified You.md vision pass and "make all improvements" so the homepage/docs/app stop feeling confusing and consistently explain You.md as an agent brain plus named expertise stacks, runtime, and protected API/MCP.
**Actionable Scope:**
1. Sweep remaining app metadata, auth/onboarding copy, docs snippets, dashboard panes, share prompts, profile CTAs, README, PRD, and schema comments for stale "identity context protocol" positioning.
2. Preserve identity as one part of the brain, but stop presenting the product as an abstract protocol first.
3. Make skills and YouStacks read as brain-aware, stack-aware, and self-improving rather than generic identity templates.
4. Verify docs/checks locally, deploy through main/Vercel, and smoke production after deployment.
**Progress (2026-05-28):** Updated the remaining root metadata, auth boot screens, initialize copy, reset metadata, profile/profile-directory metadata and CTAs, share prompts, skill/help/history panes, homepage portrait/hero copy, README, PRD, docs snippets/navigation, sample profiles, schema comments, and robots comments so the product reads as an agent brain plus named expertise stacks, runtime, and protected API/MCP. Local verification passed docs check, root TypeScript after temporarily moving unrelated untracked middleware files, and targeted ESLint with warnings only from pre-existing ignored README/profile image/unused code. Production verification passed on `https://www.you.md`: homepage exposes brain/workflow and core-brain-free copy, `/docs#share` exposes Share Your Brain / brain-aware skills / brain smoke text, `/profiles` exposes public agent brains, `/sign-up` exposes agent-brain metadata, `/houstongolden` exposes agent brain + YouStacks metadata and the agent-brain CTA, and `/schema/you-md/v1.json` exposes the public agent brain schema description.

---

## Reference Intelligence Follow-ups (from May 29 sync)

### 75. Brain-aware planning: structured context load + safe write surfaces
**Status:** IN PROGRESS
**Verified:** NO
**Production Verified:** NO
**Source:** 2026-05-29 — reference-intelligence sync (GStack `070722a`: “brain-aware planning” + `docs/gbrain-write-surfaces.md`)
**Request:** Mirror the “brain-aware planning” pattern in You.md/YouStacks: load relevant brain context *when available* before planning, but suppress overhead when not configured; document “write surfaces” and gate writes via trust policy/consent.
**Actionable Scope:**
1. Define a minimal “Brain Context Load” block for You Agent planning flows (keywords → search → read top N → cite slugs).
2. Define “write surfaces” for You.md (memories, profiles, stacks, audit logs) and which ones are allowed to receive automated writes.
3. Add a trust-policy/consent gate that prevents auto-writeback until explicitly enabled per surface or per stack.
**Progress (2026-05-29):** Updated bundled You.md skills (`youstack-maintainer`, `meta-improve`, `proactive-context-fill`, `claude-md-generator`) so agents load `project-context/` (plus reference-intelligence tasks) before planning or prompting for basics.

### 76. Explicit consent + first-run wizard for sensitive writebacks
**Status:** TODO
**Verified:** NO
**Production Verified:** NO
**Source:** 2026-05-29 — reference-intelligence sync (GStack `ce5fbfa`: “explicit consent + first-run setup wizard”)
**Request:** Add a first-run setup wizard + explicit consent checks for any You.md workflow that can mutate private brain context (memory writes, profile edits, stack installs, grants).
**Actionable Scope:**
1. Identify all writeback entrypoints (CLI + web + API/MCP).
2. Require a one-time explicit consent interaction for “private brain writes” and log it.
3. Add a “consent already prompted” state to avoid spamming prompts while still enforcing the gate.

### 77. Source-scoped hygiene: orphan/coverage metrics per surface
**Status:** TODO
**Verified:** NO
**Production Verified:** NO
**Source:** 2026-05-29 — reference-intelligence sync (GBrain `041d89b`: “source-scoped orphan_ratio”)
**Request:** Make You.md memory/profile hygiene checks source-scoped (per surface/stack/source) so cleanup and coverage metrics don’t mix unrelated streams.
**Actionable Scope:**
1. Define what “sources” mean in You.md (stack, project, profile, import, agent session).
2. Implement or spec orphan/coverage metrics per source, with an operator-facing summary.

### 78. Reliability audit: self-healing retry + disconnect audit breadcrumbs
**Status:** TODO
**Verified:** NO
**Production Verified:** NO
**Source:** 2026-05-29 — reference-intelligence sync (GBrain `ffac8ce`: “withRetry self-heals… + disconnect audit”)
**Request:** Harden You.md’s long-lived client/singleton surfaces (MCP/HTTP clients, Convex/OpenRouter bridges) with self-healing retries and explicit disconnect audit logs for debugging + safety.
**Actionable Scope:**
1. Identify singleton-ish clients and their failure modes (null state, stale token, dropped stream).
2. Add an audit breadcrumb per disconnect/reconnect and surface it in diagnostics.

### 79. Git-aware sync freshness: skip expensive refresh when unchanged
**Status:** IN PROGRESS
**Verified:** NO
**Production Verified:** NO
**Source:** 2026-05-29 — reference-intelligence sync (GBrain `cb1b5f9`: “git-aware sync_freshness”)
**Request:** Add a sync-freshness signal for You.md “brain/index refresh” paths that short-circuits when the underlying source hasn’t changed; report freshness in CLI/dev UX.
**Actionable Scope:**
1. Decide which sync/refresh actions should be freshness-gated (project context index, memory index, stack repo sync).
2. Implement a lightweight “unchanged” detection strategy and a clear freshness summary output.
**Progress (2026-05-29):** Extended `youmd stack doctor` to surface git root, dirty working-tree warnings, and upstream ahead/behind counts (read-only) so stack maintenance is freshness-aware before publishing changes.

### 80. Homepage minimalization: remove section sprawl, keep it intentional
**Status:** IN PROGRESS
**Verified:** NO
**Production Verified:** NO
**Source:** 2026-05-29 — Houston feedback (“home page is way too complicated… minimal and clear and intentional”)
**Request:** Simplify the homepage information architecture so it feels minimal, calm, and terminal-native; stop stacking every possible section.
**Actionable Scope:**
1. Reduce homepage sections to the core story (Hero → YouStacks → Open Standard → CTA).
2. Simplify navbar and remove scroll-spy anchors when sections are removed.
3. Verify TypeScript and targeted lint locally, then deploy and production-smoke.

### 73. Simplify the whole product model around Brain, Stacks, Runtime, and Protected API/MCP
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — GitHub/Vercel deployment `4844921786` for commit `1a7c1a9` completed successfully and is live at `https://www.you.md` / `https://you.md` (`https://youmd-i1nc5c1ho-hubify.vercel.app`).
**Request:** Improve everything about You.md, the vision, stack, API/MCP, and YouStacks so the product feels more powerful, simpler, clearer, and more focused.
**Actionable Scope:**
1. Stop leading with abstract "identity context protocol" language on the user-facing surfaces.
2. Make the core model explicit everywhere: You.md Brain, named YouStacks, one curl-installed Runtime, and Protected API/MCP for sensitive access.
3. Update homepage copy and information architecture to explain the product in that order.
4. Update docs quickstart/core concepts so a new user can understand the model before seeing CLI/API details.
5. Update the public profile agent panel so `/{username}` reads like a public agent brain with optional public stacks.
6. Update dashboard labels and help copy so the shell feels organized around brain/stacks/sharing/activity instead of scattered implementation surfaces.
**Progress (2026-05-27):** Reworked homepage metadata, hero, problem, how-it-works, simple model, YouStacks, integrations, FAQ, CTA footer, sample profile copy, README, docs metadata, docs introduction, docs quickstart, docs core concepts, dashboard primary group labels, Stacks pane, Help pane, command palette, public profile agent panel, and public profile stack copy around the simplified `Brain → Stacks → Runtime → Protected API/MCP` model. Local verification passed docs check, root TypeScript after temporarily moving unrelated untracked middleware files, and targeted ESLint with warnings only from pre-existing profile image/unused code. Local Next dev/prod rendering still stalls in the Next compile worker, but Vercel production deployment `4844921786` for commit `1a7c1a9` completed successfully. Production smoke passed on `https://www.you.md`: homepage contains the new agent brain/expertise stacks/simple model language, `/docs#simple-model` contains Brain/Stacks/Runtime/Protected API/MCP, and `/houstongolden` exposes the public agent brain/profile language.

## YouStack Doctor Diagnostics (from May 27 conversation)

### 72. Add read-only YouStack health diagnostics from GStack reference learning
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — GitHub/Vercel deployment `4843270141` for commit `2c80f42` completed successfully and is live at `https://www.you.md` / `https://you.md` (`https://youmd-7dhuuysdw-hubify.vercel.app`).
**Request:** Continue improving YouStacks, the skill stack, API/MCP boundaries, docs, homepage, BAMFStack lighthouse, and GStack/GBrain-inspired self-improvement architecture.
**Actionable Scope:**
1. Convert the latest GStack reference-intelligence signal about memory diagnostics and resource-leak fixes into a YouStacks-native improvement.
2. Add a read-only stack doctor that host agents can run before self-improving, publishing, or updating named YouStacks.
3. Route diagnostic/health/bloat/drift/staleness requests to a first-class YouStack capability instead of relying on generic stack improvement copy.
4. Update the BAMFStack lighthouse example and docs so diagnostics become part of the install/use/improve loop.
5. Keep diagnostics local/static first, with no private brain reads, connected tool calls, or file mutations during the doctor pass.
**Progress (2026-05-27):** Added `youmd stack doctor --path <stack>` plus `runYouStackDoctor`, a read-only diagnostic pass that reports manifest size, file counts/types, capability split, adapters, brain scopes, warnings, and next recommendations. Added the built-in `stack.diagnose` / `stack-diagnostics` capability to CLI and shared route scoring. Updated the bundled `youstack-maintainer` skill, BAMFStack lighthouse manifest/docs/smoke checklist, homepage/docs YouStacks copy, dashboard stack pane, and README so agents run doctor before smoke/evals/self-improvement/public-readiness work. Local verification passed focused YouStack tests, CLI TypeScript, docs check, root TypeScript, CLI build, built `youmd stack doctor`, and built routing for diagnostic requests. Local Next production build attempts stalled in the Next compile worker with 0% CPU, but Vercel production deployment `4843270141` for commit `2c80f42` completed successfully. Production smoke passed on `https://www.you.md`: `/docs#youstacks` contains the doctor guidance, `/api/v1/stacks/capabilities` exposes `stack-diagnostics`, `/api/v1/docs/reference` still exposes YouStacks reference data, and `POST /api/v1/stacks/route` routes diagnostic requests to read-only `stack-diagnostics`.

## YouStacks Curl Runtime + BAMFStack Lighthouse (from May 27 conversation)

### 71. Make YouStacks curl-first, auto-updating, native-skill maintained, and BAMFStack-proofed
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — GitHub/Vercel deployment `4842170884` for commit `db6a01f` completed successfully and is live at `https://www.you.md` / `https://you.md` (`https://youmd-71x5nxy48-hubify.vercel.app`).
**Request:** Reframe YouStacks so users do not need a CLI mental model: one curl install should deliver the You.md runtime, native skills, auto-update behavior like BAMFStack, a shareable/open-source BAMFStack lighthouse example, agent-driven stack organization/update through a bundled skill, and shell/profile visibility management where stacks default private and only become public by owner action.
**Actionable Scope:**
1. Make the curl installer the default product surface and describe `youmd` as the helper runtime underneath.
2. Add a native bundled maintainer skill that lets host agents organize, improve, update, smoke, and prepare private/public visibility changes for named YouStacks.
3. Add an auto-upgrade helper so host adapters and stack workflows can refresh the runtime before stack work.
4. Create an open/public-safe BAMFStack lighthouse YouStack example with manifest, skills, workflows, prompts, docs, tests, update policy, improvement policy, protected-capability boundaries, and public-readiness routing.
5. Add shell/dashboard and profile surfaces for seeing named stacks, their visibility, update policy, install command, and public/private rules.
6. Keep stack visibility private by default, with scoped/public sharing only after redaction, smoke checks, and explicit owner approval.
7. Keep GStack/GBrain reference monitoring live with local reference repos, updated task queues, and a daily automation.
**Progress (2026-05-27):** Updated `https://you.md/install.sh` into a curl-first You.md runtime installer that source-installs current You.md by default, falls back to npm, installs native skills, writes `~/.youmd/bin/youmd-auto-upgrade`, and writes the stack runtime preamble. Added bundled `youstack-maintainer` across CLI catalog, SkillsPane, HelpPane, docs, README, You Agent prompt copy, and routing capabilities. Added `/stacks` shell navigation plus a YouStacks dashboard pane showing named private/public stacks, visibility, install commands, update policies, and agent commands. Added profile rendering for `public-open` YouStacks while keeping private/scoped stacks owner-only. Added `cli/examples/youstack-bamfstack-public` as the public-safe BAMFStack lighthouse with manifest, skill, workflow, prompt, quickstart, smoke test, auto-update policy, and public-readiness capability. Synced GStack/GBrain references to latest GStack `19770ea` and GBrain `42d99b6`, regenerated reference tasks, documented the daily reference automation, and created the active local Codex automation `Daily GStack/GBrain Reference Sync`. Local verification passed docs generation/check, targeted ESLint with zero errors, CLI TypeScript, root TypeScript, focused YouStack tests, CLI build, Next production build, built CLI BAMFStack smoke/routing, and local production homepage/docs/install/API smoke checks. Production verification passed on `https://www.you.md`: homepage exposes the no-CLI mental model and auto-upgrade copy, `/docs#youstacks` exposes runtime/profile/BAMFStack/reference automation sections, `/install.sh` serves the runtime installer with `youmd-auto-upgrade`, and `/api/v1/stacks/capabilities` exposes maintainer/visibility/update capabilities.
**Progress (2026-05-27 continuation):** Extended the BAMFStack lighthouse and native maintainer loop with `youmd stack doctor`, so curl-installed agents get a read-only health diagnostic before smoke/evals/public-readiness work.

## GStack/GBrain Reference Intelligence (from May 27 conversation)

### 70. Monitor GStack/GBrain and use them to improve YouStacks + You.md brain
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — deployment `dpl_4UwpUiK2vUPYu8R9nj8dfnBDpq9M` is Ready and aliased to `https://www.you.md` / `https://you.md`.
**Request:** Keep `garrytan/gstack` and `garrytan/gbrain` as local reference repos, monitor their daily updates/commits/messages/code changes, and turn relevant upstream patterns into tasks that improve YouStacks, the You.md brain/memory/context/profile layer, docs, homepage, architecture, and self-improvement loops.
**Actionable Scope:**
1. Treat GStack as the live reference for YouStacks architecture, skills, host adapters, install/update behavior, evals, QA/review/release workflows, and local-first agent operating systems.
2. Treat GBrain as the live reference for You.md memory/context/personal brain architecture, retrieval, sync, provenance, privacy, and shared-agent brain behavior.
3. Keep both repos cloned locally without vendoring them into this repository.
4. Add a repeatable sync/monitor command that fetches upstream commits and creates a reviewable You.md task list.
5. Improve homepage and docs so they directly explain the GStack/GBrain-guided architecture.
6. Set up a daily local automation to run the reference monitor.
**Progress (2026-05-27):** Added `npm run references:sync` backed by `scripts/reference-intelligence.mjs`, which clones/fetches `garrytan/gstack` and `garrytan/gbrain` into ignored `.reference-repos/garrytan/*`, records latest commit state, and writes `project-context/reference-intelligence/LATEST.md` plus `TASKS.md`. The first run captured GStack latest commit `a6fb317` and GBrain latest commit `42d99b6`, producing 24 candidate You.md tasks. Added `project-context/REFERENCE_INTELLIGENCE.md` plus PRD/implementation-plan updates describing GStack -> YouStacks and GBrain -> You.md brain translation rules. Updated homepage copy and `/docs` with Brain Architecture, Reference Intelligence, and GStack/GBrain Reference Loop sections. Local verification passed script syntax check, docs check, targeted ESLint, `npx tsc --noEmit`, and `npm run build -- --webpack`. Production verification passed on deployment `dpl_4UwpUiK2vUPYu8R9nj8dfnBDpq9M`: live homepage and docs expose the reference-guided architecture and reference monitor command.
**Progress (2026-05-27 continuation):** Re-ran `npm run references:sync` against the latest upstream refs: GStack advanced to `19770ea` (`v1.51.0.0 feat: $B memory diagnostic + 4 CDP-resource leak fixes`) and GBrain remains at `42d99b6`, producing a fresh review task in `project-context/reference-intelligence/TASKS.md`. Created the active local Codex automation `Daily GStack/GBrain Reference Sync` so the monitor runs daily and reports candidate tasks.

## YouStacks Named Portfolio + Self-Improvement (from May 27 conversation)

### 69. Make YouStacks nameable by domain and self-improving
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — deployment `dpl_CZR4kXxAnfvRWNC14XdfvAq6ye9F` is Ready and aliased to `https://www.you.md` / `https://you.md`.
**Request:** YouStacks need to be nameable so users can maintain separate stacks for different expertise areas such as coding, scientific research, and content creation. Stacks and skills inside stacks also need to be truly self-improving/autonomously improving and self-updating.
**Actionable Scope:**
1. Make the homepage and docs explain named stack portfolios instead of one generic personal stack.
2. Define how `name`, `slug`, domain metadata, aliases, and tags distinguish multiple stacks.
3. Add manifest/contract support for improvement and update policy.
4. Make CLI inspect/smoke output reveal stack identity and improvement/update policy.
5. Add route/capability support for improvement and update intents.
6. Keep autonomy policy-bound: local stack/skill improvements can be proposed or applied when allowed, while private brain/context/tool/repo writes stay behind explicit policy and approval.
**Progress (2026-05-27):** Added optional `domain`, `aliases`, `tags`, `improvement`, and `update` fields to the `youstack/v1` TypeScript manifest contract; added validation warnings when improvement/update policies are missing; added built-in `stack.improve` and `stack.update` local capabilities; updated adapter generation with stack identity and self-improvement instructions; updated `youmd stack inspect` and `smoke` to show name, slug, domain, tags, improvement mode, and update channel; updated the sample personal stack and focused YouStack tests. Expanded the homepage and `/docs#youstacks` with named stack portfolio guidance, coding/scientific research/content examples, self-improving stack/skill loops, manifest examples, API/MCP boundary guidance, and the stack route API now preserves `domain` and `tags`. Local verification passed `npm run docs:check`, `npm --prefix cli test -- youstack`, targeted ESLint, `npx tsc --noEmit`, `npm --prefix cli run build`, built CLI inspect/smoke/route checks, and `npm run build -- --webpack`. Production verification passed on deployment `dpl_CZR4kXxAnfvRWNC14XdfvAq6ye9F`: live homepage, docs, `/api/v1/stacks/capabilities`, `/api/v1/docs/reference`, and `POST /api/v1/stacks/route` all expose the named-stack and improvement/update contract.

## YouStacks Positioning Clarity (from May 27 conversation)

### 68. Clarify YouStacks as "your own GStack" for any agent
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — deployment `dpl_EyuaBhd5yXGFrw5eAGu2eBqZ46su` is Ready and aliased to `https://www.you.md` / `https://you.md`.
**Request:** The current homepage/docs copy does not convey YouStacks clearly enough. Reframe YouStacks as your own GStack-like stack of skills, expertise, prompts, workflows, taste, and safe memory access that can be shared with any agent.
**Actionable Scope:**
1. Make the homepage lead with the "build your own GStack for any agent" mental model.
2. Explain that a YouStack packages a person's expertise, skills, workflows, prompts, examples, taste, tools, and safe memory access.
3. Make docs clearer about what goes into a YouStack.
4. Preserve the brain boundary: You.md is the brain, YouStack is the shareable/installable stack built from it.
5. Verify locally and open the improved surfaces in the Codex browser for review.
**Progress (2026-05-27):** Reworked `src/components/landing/YouStacks.tsx`, homepage metadata, and `/docs#youstacks` copy around packaged expertise and the "personal GStack" analogy. Added a docs "What Goes In" subsection for skills, workflows, taste/examples, and protected capabilities. First production verification passed on `https://www.you.md`: homepage copy included "build your own GStack", docs included the GStack-style operating-system explanation plus "What Goes In", generated docs reference listed stack endpoints/tools, and OpenAPI tagged stack endpoints under `YouStacks`. Follow-up copy pass now makes the analogy explicit: Gary Tan creating GStack from years of startup operating experience, specialist agents, taste, review loops, and workflows; YouStacks let anyone package their own expertise/workflows/sub-agents into a shareable stack. Local verification passed `npm run docs:check`, targeted ESLint, `npx tsc --noEmit`, `npm run build -- --webpack`, and local production text checks. Production verification passed on deployment `dpl_EyuaBhd5yXGFrw5eAGu2eBqZ46su`: live homepage contains "package your expertise into your own GStack", "years of expertise", "sub-agents", and "like GStack, but yours"; live docs contain "Gary Tan creating GStack", "years of startup operating experience", "specialist agents", "sub-agents", "What Goes In", and "Personal expertise stack"; generated docs reference and OpenAPI still expose the YouStacks endpoint/tool surfaces.

## YouStacks Homepage + Docs Surface (from May 26 conversation)

### 67. Make YouStacks first-class on the homepage and in docs
**Status:** DONE
**Verified:** NO
**Production Verified:** YES — Vercel deployment `dpl_7b6X4k3R6JahR7F3jqFdbgJXN5S1` is Ready and aliased to `https://www.you.md` / `https://you.md`.
**Request:** Ensure the YouStack/YouStacks product layer is properly included and described on the you.md homepage and in the improved docs, including use cases, how to use stacks, examples, and the improved API/MCP surfaces.
**Actionable Scope:**
1. Add a homepage section that explains YouStacks as portable execution packages on top of the You.md brain.
2. Cover practical stack use cases, including personal, project, team/friend, and public/open stacks.
3. Expand the docs YouStacks section into a fuller chapter.
4. Document how to use stacks through CLI commands and host adapters.
5. Add concrete examples for manifests, stack commands, and capability routing.
6. Include the improved YouStacks API and MCP surfaces in the docs.
7. Keep generated docs/API references in sync with source.
**Progress (2026-05-26):** Added `src/components/landing/YouStacks.tsx` and inserted it into the homepage after the identity bundle section. Expanded `/docs#youstacks` with overview, use cases, CLI, install flow, manifest, examples, API/MCP threshold, generated YouStacks endpoint reference, and stack-specific MCP tools. Updated docs generation so `/api/v1/stacks/capabilities` and `/api/v1/stacks/route` are categorized under `YouStacks` in `docs-reference` and OpenAPI. Local verification passed docs generation/check, targeted ESLint, TypeScript, production build, local production server smoke checks, and headless Chrome screenshots/text checks. Production verification passed on `https://www.you.md`: homepage YouStacks copy, docs use-case/how-to/API+MCP copy, generated docs reference stack endpoints/tools, and OpenAPI `YouStacks` tags are all live.

## YouStacks End-to-End Implementation (from May 24 conversation)

### 66. Continue YouStacks from planning into production-quality implementation
**Status:** IN PROGRESS
**Verified:** NO
**Request:** Continue the YouStacks work and get it done end-to-end, production-tested, and working per the full vision rather than stopping at planning.
**Actionable Scope:**
1. Move from the planning document into small, bisectable implementation phases.
2. Start with the first PR-sized slice from the plan: local YouStack manifest schema and read-only CLI smoke/inspect/capability support.
3. Keep broad product changes gated behind verified slices instead of making an unsafe mega-patch.
4. Test each implemented slice locally before commit.
5. Deploy and production-test only code that has passed local verification and is ready for production.
6. Keep GitHub sync, stack grants, protected brain retrieval, sharing, and host adapters tracked as later phases until their implementation slices are complete.
**Progress (2026-05-24):** Phase 1-3 plus the shared read-only route endpoint are implemented locally in bisectable commits:
- `dec9d3d` adds the local `youmd stack inspect/smoke/capabilities/route` manifest foundation, sample personal YouStack, tests, docs, and CLI `0.6.23` version bump.
- `d7be628` adds `youmd stack link` for Claude Code, Codex, and Cursor adapter generation with dry-run support.
- `4da2e99` exposes local MCP YouStack resources/tools: `get_stack_manifest`, `get_stack_capabilities`, `route_stack_request`, and `smoke_stack`.
- `e79bf70` adds shared read-only HTTP endpoints: `GET /api/v1/stacks/capabilities` and `POST /api/v1/stacks/route`.
- Local verification passed focused YouStack/MCP tests, full CLI tests, CLI build, docs check, root TypeScript, root production build, local production API smoke tests, and MCP SDK smoke.
- Production web/API/docs verification passed on `https://www.you.md`: stack capabilities, stack route, docs reference, and `/docs` all expose the new YouStacks surfaces.
- npm publish verification is blocked outside code: the trusted publish workflow for `youmd@0.6.23` passed install, tests, and build, then failed at `npm publish` with `E404 Not Found / no permission`; npm still serves `youmd@0.6.21`.
- Still intentionally deferred from this slice: GitHub App repo sync, stack grant/token storage, private/public share-link UI, paid stacks, secondary hosts, and optional custom per-stack API/MCP endpoints.

**Progress (2026-05-25):** Hardened the trusted publish workflow to current npm GitHub Actions guidance, normalized CLI package metadata back to the canonical git repository URL, and reran the workflow as run `26387133488`. Install, tests, and build passed again; `npm publish` still failed with `E404 Not Found / no permission`. Remaining action is external npm package configuration for Trusted Publishing/package permissions, not another code patch.

**Progress (2026-05-25 continuation):** Checked whether this machine could finish the npm-side setup directly. `npm whoami` returns `E401`, `npm trust list youmd` returns `E401`, and the real trusted-publisher setup command is blocked by npm `E401`. The dry-run command confirms the exact target is correct: `npx npm@11.15.0 trust github youmd --repo houstongolden/youmd --file publish-cli.yml --allow-publish --yes`. Also verified Vercel deployment `dpl_Eku5BV118Ww7W8tgehuHqy5axNKU` is ready and aliased, and live production `GET /api/v1/stacks/capabilities` plus `GET /api/v1/docs/reference` return the expected YouStacks contracts.

## YouStacks Planning Phase (from May 23 conversation)

### 65. Audit You.md and write the YouStacks implementation plan before product changes
**Status:** DONE
**Verified:** NO
**Request:** Start the YouStacks planning phase as an additive product-layer pass. Save the kickoff brief, audit existing You.md surfaces, review GStack and BAMFStack before designing YouStacks, and create `project-context/YOUSTACKS_IMPLEMENTATION_PLAN.md` without rushing into broad implementation.
**Actionable Scope:**
1. Preserve the kickoff brief in `project-context/YOUSTACKS_PRODUCT_LAYER_PRD.md`.
2. Read existing You.md context before writing code: README, AGENTS, CLAUDE, PRD, architecture, features, TODO, safe agent context integration, CLI commands, Convex schema/http routes, memory/private-context code, skill system, link/key sharing, and existing GitHub/source/sync code.
3. Treat YouStacks as additive execution packages on top of the You.md brain, not a replacement brain or custom launch harness.
4. Inventory current web app, CLI/TUI, You Agent, memory brain, private context, project context, skills, context links, API keys, MCP/API surfaces, Convex schema/http routes, GitHub/source/sync, docs, dashboard panes, onboarding, and sharing flows.
5. Classify each existing surface as keep, repurpose, expand, modify, defer, or remove-only-if-breaking.
6. Audit brain, memory, private context, project context, skills, link, API, and CLI boundaries.
7. Review GStack first, then the local `bamfaiapp` repo surfaces requested in the brief.
8. Extract GStack transfer lessons and BAMFStack applied-proof lessons for YouStacks.
9. Define the YouStack manifest schema, repo layout, access model, GitHub sync design, sharing model, host adapters, optional API/MCP boundaries, capability map, route endpoint, helper CLI, smoke test, and docs sync rule.
10. Decide the local-only/shared-API/custom-endpoint/user-owned-remote threshold.
11. Break implementation into small bisectable phases and name the first PR-sized slice.
12. Do not implement broad product changes until the audit and plan are complete.
**Progress (2026-05-23):** Kickoff brief exists in `project-context/YOUSTACKS_PRODUCT_LAYER_PRD.md`. Audit and implementation plan are written in `project-context/YOUSTACKS_IMPLEMENTATION_PLAN.md`.
**Progress (2026-05-24):** Houston continued the work into implementation with request #66.

## YouStack Local-Agent Priority (from May 22 conversation)

### 64. Prioritize You.md skills, MCP/API, and local-agent integration over CLI/npm polish
**Status:** IN PROGRESS
**Verified:** NO
**Request:** Continue improving the You.md / youmd stack around the gstack + bamfstack pattern: a "youstack" that empowers Claude Code, Codex, Grok, Cursor, and other top local/cloud agents with identity context, skills, prompts, tools, agent harness intelligence, and MCP/API access. Prioritize this over pure CLI/npm polish.
**Actionable Scope:**
1. Improve the bundled You.md skill layer so local agents get a stronger starting protocol, not just individual one-off templates.
2. Improve MCP/API surfaces that let agents quickly load identity, project context, active requests, TODOs, installed skills, and next moves.
3. Make Claude Code/Codex/Cursor-style sessions start from real local context instead of asking the user to re-explain the repo.
4. Keep the implementation additive and compatible with existing gstack/bamfstack-style workflows.
5. Update app/docs/web-agent copy so the shipped product advertises the actual skill/MCP surface.
6. Verify locally and leave production deploy/user verification clearly tracked.
**Progress (2026-05-22):** Added a local MCP `get_agent_brief` tool plus `youmd://agent/brief` resource that composes compact identity, cwd, project instructions, project-context files, active requests, open TODOs, known issues, installed skills, recommended skills, and next moves. Added the bundled `youstack-start` skill and wired it into the local catalog, recommended skills, backend bundled-skill seed list, SkillsPane, web agent prompt copy, README, docs copy, and generated docs reference. Added a focused CLI test for the brief builder. Local verification passed `npm test -- mcp-agent-brief.test.ts`, `npm run build` in `cli/`, `node dist/index.js skill list` with a temp HOME showing 7 bundled skills, `npm run docs:check`, and root `npm run build` with explicit Node PATH. Production Convex skill seeding/deploy and user verification are still pending.

## Docs Platform Upgrade (from May 21 conversation)

### 63. Bring You.md docs up to BAMF developer-platform quality and keep API/MCP reference auto-current
**Status:** IN PROGRESS
**Verified:** NO
**Request:** Audit what is missing from `you.md/docs`, compare against the latest BAMF docs work, improve the You.md docs to a more comprehensive Mintlify-style developer/reference/playbook standard, and ensure API/MCP docs automatically update when new features, endpoints, tools, or relevant platform changes ship.
**Actionable Scope:**
1. Identify gaps in the current You.md docs compared with the stronger BAMF docs structure and modern Mintlify patterns.
2. Add richer docs sections for concepts, quickstarts, architecture, CLI, skills, agent workflows, examples/playbooks, troubleshooting, privacy, API, MCP, schema, and release/documentation sync.
3. Improve visual polish inside the existing terminal-native You.md design system without turning docs into generic SaaS marketing.
4. Generate API/MCP reference data from source so endpoint and tool inventories do not stay as stale hand-maintained lists.
5. Wire docs generation into local development/build scripts so releases naturally refresh docs artifacts.
6. Update project tracking files, verify the docs build, and leave production deploy/user verification clearly tracked.
**Progress (2026-05-22):** Audited current `/docs`, `convex/http.ts`, web API proxies, CLI MCP tools, and BAMF `bamfaiapp/docs` / `bamfaiapp-next/docs` reference structure. Upgraded `/docs` with core concepts, context surfaces, source-of-truth mapping, agent workflow golden path, playbooks, starter prompts, examples, generated endpoint tables, generated MCP tool reference, schema guidance, docs automation, and troubleshooting. Added `scripts/generate-docs-reference.mjs`, `src/generated/docs-reference.ts`, `src/generated/openapi.ts`, `GET /api/v1/docs/reference`, and `GET /api/v1/docs/openapi.json`; wired `docs:generate` into `prebuild` and added `docs:check`. Local verification passed docs generation/check, targeted ESLint, `npx tsc --noEmit`, production `npm run build`, and desktop/mobile browser QA on `localhost:3100/docs` with no console errors or horizontal overflow. Production deploy and Houston verification remain pending.

## Private Context Link Reliability (from May 20 conversation)

### 62. Fix tokenized `/ctx` full-context URLs returning 5xx
**Status:** DONE
**Verified:** NO
**Request:** Private full-context URLs generated by the web shell, such as `/ctx/houstongolden/<token>`, must be fetchable by external AI agents and return `you-md/v1` JSON with both `identity` and `_privateContext` instead of Vercel/you.md server errors.
**Observed Failure:** A user-provided agent prompt produced repeatable server errors for freshly generated secure tokenized links. The external agent reported request IDs `70c536ff77274a5e`, `10a3d0c0aaa1a2bb`, and later `3467476f9899ec71`.
**Progress (2026-05-21):** Reproduced that the exact link resolves with redirect-following, then hardened the fragile server path that could turn valid links into 5xxs: `incrementUseCount`, `recordView`, and activity logging are now best-effort, unexpected `/ctx` exceptions return JSON, and both Convex + Next proxy responses use private/no-store cache headers with `Vary: Accept`. Deployed via push `92314d3` and verified production full JSON has `identity` + `_privateContext`, text/plain still returns markdown, invalid tokens return 404, and ETag revalidation still returns 304. The later Myo request ID did not appear in Vercel or Convex `/ctx` logs, so generated links now use `https://www.you.md/ctx/...` directly to remove the apex redirect from the agent-fetch path. Content negotiation now also returns JSON for broad agent headers that include both JSON and text. Follow-up pushes `f010837` and `b62ba51` are deployed; production `www` context URLs return 200 with zero redirects and include both `identity` and `_privateContext`. Local verification passed TypeScript, Convex TypeScript, targeted source lint, and a production build.
**Scope Checklist:**
1. Reproduce the production `/ctx/:username/:token` failure without exposing private content unnecessarily.
2. Trace the web route and Convex/API data path responsible for resolving tokenized context links.
3. Fix the server-side exception so valid owner-generated links return full-context JSON, including `_privateContext`.
4. Verify invalid/revoked/mismatched links still fail safely.
5. Update docs/session tracking and commit the fix once verified.
6. Remove apex-domain redirects from generated context-link URLs and verify `www.you.md` links return directly for agents.
7. Prefer JSON when agent `Accept` headers include both JSON and text formats.

## Homepage + App Design-System Cleanup (from May 19 conversation)

### 57. Mature the homepage and app UI without changing product behavior
**Status:** DONE
**Verified:** NO
**Request:** Run a design-system and homepage cleanup pass that makes the marketing homepage and app UI feel more polished, compact, consistent, and conversion-focused while preserving the terminal-native You.md aesthetic.
**Progress (2026-05-19):** Added shared UI primitives for layout, sections, buttons, cards, terminal cards, inputs, labels, helper/error text, textarea/select controls, and small class merging. Refactored the homepage into the requested conversion flow with a calmer hero, one primary above-fold CTA, compact social proof, compressed problem/how-it-works/inside/integration/open-standard sections, balanced pricing, compact FAQ, and simple final CTA. Normalized app-facing controls across terminal auth/input, dashboard pane headers/empty states, edit/share/sources/private context/files/settings surfaces, and mobile/desktop dashboard tabs without changing routes, auth, API, Convex behavior, or data models. Verified locally with a production build, live Chrome desktop/mobile visual QA on `localhost:3000`, and a targeted lint pass on changed files.
**Scope Checklist:**
1. Audit `globals.css`, marketing homepage, landing sections, shared UI components, install components, dashboard/app surfaces, and shared form/button/input controls.
2. Add or refine reusable primitives/tokens for `Container`, `Section`, `SectionHeader`, `Button`, `Card` / `TerminalCard`, `Input`, `Textarea`, `Select`, `Label`, `FieldHelp`, `FieldError`, and `FormField`.
3. Normalize layout rhythm: 1120/1160px page max width, readable text max width, 44-96px section padding, 16-24px grid gaps, 16-32px card padding, and 8px spacing rhythm.
4. Normalize typography hierarchy: controlled hero display, readable hero body, mono eyebrows, clear section h2s, consistent card titles/body/captions/code text.
5. Normalize button variants/sizes/states and make the homepage primary CTA “Create your you.md” or “Start in browser,” with CLI install secondary.
6. Normalize form/input/select/textarea styles, focus-visible rings, labels, helper/error text, disabled states, and app form spacing.
7. Refactor homepage order to: navbar, hero, compatibility strip, problem/solution, how it works, what’s inside, works everywhere/developer integration band, open standard/ownership, pricing, FAQ, final CTA, footer.
8. Calm the hero: lower ASCII texture density, compact two-column layout, obvious primary CTA above the fold, secondary CLI/docs CTA, shorter command detail.
9. Move network/profile proof lower or compress it; avoid a huge early list of unclaimed famous profiles.
10. Compress problem, how-it-works, what’s-inside, integrations/developer/open-standard, pricing, FAQ, and final CTA sections.
11. Apply the same Button/Input/Card/FormField standards to app UI surfaces including dashboard panes, settings, share/profile editing, onboarding/init, and terminal-like panels where practical.
12. Preserve semantic headings, accessible names, focus states, mobile tap targets, no horizontal overflow, readable contrast, and decorative ASCII `aria-hidden`.
13. Run lint/typecheck/build if scripts exist and fix issues.
**Verification:** Homepage is visibly shorter and clearer, one primary above-fold CTA wins, shared controls look consistent across marketing and app, typography hierarchy is obvious, mobile layout is clean, no product functionality/routes/auth/API/Convex/data behavior changed.

### 58. Clean up public profile duplicates, missing portraits, and crawler/enrichment hygiene
**Status:** DONE
**Verified:** NO
**Request:** Fix duplicate/incomplete profiles on `/profiles`, ensure real images and ASCII portraits do not display blank, and inspect/improve the crawler/fetch/enrichment path so future unclaimed public profiles are fetched comprehensively and safely.
**Progress (2026-05-19):** Added shared Convex profile-directory normalization that canonicalizes usernames, selects the richest duplicate record, suppresses known QA/test usernames from public directory lists, resolves avatar fallbacks from profile fields/social images/links, sanitizes public image URLs, and exposes stored ASCII portraits safely. Updated `/profiles` client and SSR directory paths to dedupe by canonical username, suppress QA/test rows defensively even before backend deployment, prefer stored ASCII portraits, fall back to real-image/social-link avatars, and render a deterministic terminal fallback instead of blank cards. Updated public profile pages/metadata to sanitize image URLs and render stored ASCII portraits even when a live avatar URL is missing. Hardened sample seeding/backfill/cleanup so reseeds do not create duplicate/orphan profile rows and profile backfills retain avatars. Fixed crawler/enrichment hygiene so Unavatar API keys are used only for server fetches and are no longer persisted into public `avatarUrl` fields; added an internal cleanup mutation to strip previously persisted image secrets.
**Verification:** Local browser QA on `localhost:3000/profiles` showed 27 real/network profiles, 0 visible QA/test rows, 0 duplicate visible profile hrefs, 27/27 with portrait, no horizontal overflow, and no image URLs containing API keys/tokens. Grid view passed the same checks. `localhost:3000/ilyasut` rendered a stored ASCII portrait (`pre`, no canvas dependency) plus real image, with no secret-bearing image URLs. `tsc --noEmit` passed. `next build --webpack` passed. Targeted lint on changed files has 0 errors and only existing image/unused warnings in profile UI files.
**Scope Checklist:**
1. Audit `/profiles` data flow, SSR profile list, frontend directory rendering, public profile rendering, profile query API, sample seeding/backfill/cleanup, crawler/scraper, portrait generation, and enrichment action.
2. Backend canonicalizes/dedupes profile directory results and chooses the richest row per username.
3. Directory and SSR paths suppress known QA/test rows and avoid exposing incomplete test profiles.
4. Directory cards use stored ASCII portraits and sanitized avatar/social image fallbacks before deterministic terminal fallback.
5. Public profile pages render stored ASCII portraits when present and sanitize all public image URLs.
6. Seed/backfill/cleanup paths avoid duplicate/orphan profiles and preserve avatar completeness.
7. Enrichment no longer stores third-party API keys in public avatar URLs and includes a cleanup mutation for old data.
8. Verify visually in the browser and with typecheck/build.

### 59. Polish `/profiles` create CTA and responsive filters
**Status:** DONE
**Verified:** NO
**Request:** Fix the bad-looking create-you button in the app nav on `/profiles` and make the profile filters/sort controls responsive.
**Progress (2026-05-19):** Replaced the signed-out app-nav create CTA with a compact terminal accent action (`create you.md`) instead of the old filled `cta-primary` block, and fixed the mobile tap-target CSS so hidden desktop nav links are not forced visible on narrow viewports. Rebuilt `/profiles` controls so search, filters, sort, and list/grid toggles use compact heights, shorter labels, clear focus states, and a responsive two-column/four-column/inline layout.
**Verification:** In-app browser QA on `localhost:3000/profiles` passed at the current narrow pane width, a 390px phone viewport, and a 1280px desktop viewport with no horizontal overflow. Clicked `claimed` and `grid` live; pressed states, match count, and grid rendering updated correctly. `tsc --noEmit`, targeted lint, and `next build --webpack` pass.

## Skill System (from March 27 conversation)

### 41. Codex MCP launcher should use local CLI in the youmd repo and npm elsewhere
**Status:** DONE
**Verified:** NO
**Request:** Prevent Codex/youmd MCP startup failures caused by `npx youmd mcp` resolving the repo root package when working inside the youmd codebase. Use the local `cli/` build in this repo for development, and a published npm package everywhere else.
**Verification:** Start Codex in the local `youmd` repository — no `youmd` MCP handshake warning. Start Codex in another repo — `youmd` MCP still starts via npm.

### 42. Safe multi-tier agent context integration for existing repos
**Status:** DONE
**Verified:** NO
**Request:** Make `youmd` able to improve agent/project operating context without clobbering mature `CLAUDE.md`, `AGENTS.md`, `.cursor/rules`, or existing `project-context/` structures. Support fresh scaffold, minimal merge, and zero-touch modes.
**Expanded Scope:** `.you/` should be the safe generated layer, but You.md should still make additive edits to top-level agent files so normal agents/tools actually discover and use the context. Prefer one standard managed bootstrap block for existing repos rather than too many subtle tiers. Non-additive rewrites, deletions, or consolidations should require an explicit approval flow.
**Verification:** In a fresh repo, `youmd skill init-project` scaffolds everything. In an existing repo, it inserts or updates one standard managed bootstrap block, adds missing context files only, creates `.you/` supplemental context, and avoids rewriting user-owned docs. Any requested destructive cleanup shows a preview and requires approval.

### 43. Productize the "agent operating system" workflow that works in this repo
**Status:** DONE
**Verified:** NO
**Request:** Ensure the packaged You.md CLI/skills bundle can replicate the behavior seen in this repo: agents read repo instructions first, read `project-context/` before substantial work, track multi-part requests, and treat updates to `TODO.md`, `FEATURES.md`, `CHANGELOG.md`, `feature-requests-active.md`, and `PROMPTS.md` as part of completion.
**Verification:** A user installs You.md in a new repo and a fresh agent session behaves this way out of the box. In an existing repo, You.md safely teaches the same workflow through additive bootstrap blocks, linked host-specific skills, and scaffolded missing files without clobbering user-owned docs.

### 44. Reconcile You.md with the validated cross-agent stack-sync workflow
**Status:** DONE
**Verified:** NO
**Request:** Before implementing the new bootstrap plan, audit what You.md already ships versus what is marketed, then ensure the product design incorporates the recently validated cross-agent pattern: shared instruction layer, shared skill layer, mapped portable overlap settings, persistent stack inventory, and host-specific entrypoints that still preserve tool-native behavior.
**Verification:** There is one clear bundled-skill source of truth. Dashboard/docs/README match shipped behavior. The new You.md bootstrap model works coherently with cross-agent stack sync instead of competing with it, and the product can clearly explain what is global/shared, repo-local, generated, mirrored, and tool-specific.

### 45. Ship-readiness audit across CLI, MCP, API, and web-agent parity
**Status:** IN PROGRESS
**Verified:** NO
**Request:** Hard-test the actual CLI/skill flows locally, ensure You.md API + MCP sync correctly, and audit the You Agent/onboarding/web shell so local and web experiences are highly consistent with a clear bias toward the local CLI/TUI power-user surface. Produce a comprehensive improvement plan and QA plan covering endpoints, functionality, UI/UX, personality, proactiveness, and cross-agent usage with Claude/Codex/etc.
**Progress (2026-04-18):** Completed the first evidence pass, then followed with multiple real hardening passes. Smoke-tested `skill init-project` scaffold/additive modes, `mcp --json`, `mcp --install`, live public API + MCP behavior, and the authenticated CLI flow (`register`, `login`, `login --key`, `whoami`, `push`, `pull`, `diff`, `status`, `keys list`, `sync`) against fresh production accounts. Fixed broken web-domain MCP discovery/transport, stale 4-skill web-shell copy, portrait tool-use handling, nested `/me` auth parsing, vendor `+json` public-profile parsing, local publish-state persistence, public-profile markdown fetching, and publish→pull→diff round-trip drift. Follow-up auth migration work replaced the Clerk-first web/CLI path with first-party passwordless auth, validated local `/api/auth/*` signup/login/logout/session flows, validated CLI `register`/`login`/`whoami` against dev, validated real production email delivery + verify-code + session cookies + `/shell` hydration on `you.md`, and validated production API-key issuance plus CLI `whoami` against the live prod backend. The web-shell parity pass fixed a frontend latency issue where the shell waited on `/chat/ack` before streaming the main response, added an explicit blank-response fallback instead of silent nothingness, and added same-origin web-domain proxies for `/api/v1/chat`, `/api/v1/chat/ack`, and `/api/v1/chat/stream` so the shell, docs, and public surface stop contradicting each other. Also cleaned stale auth/shell/docs copy (`v0.1.0`, "dashboard", dead auth endpoints, fake MCP command). Continuation audit work verified the Vercel deploy was actually `Ready`, confirmed live production `POST /api/v1/chat` and `POST /api/v1/chat/ack` return `200`, reproduced browser-level shell mutation journeys against disposable authenticated accounts, and fixed three more concrete quality bugs: local web auth minted `localhost`-issuer Convex tokens when pointed at remote Convex, custom-section saves could clobber `profile.youJson`, and completed custom-section turns could be re-applied on later unrelated requests because stale raw mutation history kept being forwarded back into the model. The latest pass re-verified local browser auth after restarting the stale dev server, re-verified production browser shell access, fixed `youmd chat` so closed stdin stops crashing with `ERR_USE_AFTER_CLOSE`, fixed the clean browser-level custom-section replay repro by pruning resolved mutation turns and storing the final rendered assistant completion text in LLM history, fixed the production shell's exact project-scaffold golden path by replacing the fragile LLM-only write flow with a deterministic scaffold mutation that now creates the real `private/projects/*` tree on `you.md`, and then re-verified the post-login production shell bootstrap path plus the live authenticated bundle contents so the scaffolded project files are now proven in the real published bundle rather than only in UI copy. New blocker uncovered during this auth-depth pass: passwordless email delivery is still effectively in Resend testing mode until production uses a verified sender (`AUTH_EMAIL_FROM` / `RESEND_FROM_EMAIL`), so non-owner accounts and plus-address aliases are not yet fully release-ready. This pass also moved the local CLI much closer to the intended “meet U” feel by adding a real `you` launcher, portrait-forward startup, home-bundle fallback, update-aware startup hints, active-bundle parity for read-only commands like `status`, `diff`, `export`, and `preview`, a one-question-at-a-time first-run setup loop inside `you`, a much smaller compact portrait bounding box so the launcher stops overwhelming narrow terminals, a compact web `/initialize` portrait render, removal of the stale Clerk-era middleware file that blocked Next 16 builds beside `src/proxy.ts`, a `0.6.22` CLI release bump, cleaner npm package output without compiled test artifacts, `you`-first docs/marketing copy, explicit Turbopack root config, stale auth architecture doc cleanup, and a web-domain MCP proxy fix for response bodies. The newest local CLI passes also fixed the exact worthless-`you` transcript and the follow-up continuation failure: running `you` inside `youmd/cli` resolves the real repo root, the opener now names the top real release blocker, `start` and `continue` both select `read_project_context` deterministically, the tool reads AGENTS/CLAUDE/package/current-state/TODO files, and U prints concrete action items instead of hallucinating that it cannot read the filesystem or drifting into stale BAMF profile context. Trusted Publishing now reaches CI install/test/build, but npm still rejects publish until the `youmd` package has the GitHub Actions trusted publisher configured on npm. Remaining major blocker: the broader transcript-level web-agent personality/proactiveness/product-behavior audit still needs its own focused pass.
**Verification:** There is a concrete ship-readiness plan, a real end-to-end test matrix, a bug/repro inventory for the web agent, a parity audit for local vs web, and a prioritized fix list that can be executed to reach public-release quality.

### 46. Replace Clerk with first-party passwordless auth modeled on foldermd
**Status:** IN PROGRESS
**Verified:** NO
**Request:** Drop Clerk, simplify aggressively, and move You.md to a first-party passwordless auth model similar to foldermd: email code / magic link for humans, HTTP-only sessions for the web, scoped API keys for CLI/MCP/agents, and one internal user identity rather than Clerk-owned auth.
**Progress (2026-04-16):** Added first-party auth/session tables and mutations in Convex, switched Convex auth to `customJwt`, added web auth routes (`send-verification`, `verify-code`, `verify-link`, `session`, `logout`, `/.well-known/jwks.json`), replaced the app-side Clerk provider with `YouAuthProvider`, replaced the sign-in/sign-up flows with sequential passwordless terminal UX, removed the last live Clerk package dependency from the web app, migrated CLI `register`/`login` to email-code auth, fixed Convex no-emit config to stop regenerating stray `.js` files, synced the new signer/JWKS env, validated local web auth plus CLI auth against the new flow, validated the real production email-code/session flow on `you.md`, validated authenticated production shell hydration, validated prod API-key issuance plus CLI `whoami`, and retired the legacy password/webhook routes to explicit deprecation responses while removing stale Clerk CSP/auth copy. Continuation work also fixed a local-development parity bug where the web app could mint `localhost`-issuer Convex JWTs while talking to a remote Convex deployment, which caused silent auth rejection during local shell QA.
**Progress (2026-04-17 update):** The first-party passwordless stack is now clearly the live auth path, and the production session/bootstrap flow is verified after login. This pass also exposed one remaining release blocker: the web auth route was still hardcoded to `onboarding@resend.dev`, which leaves Resend in testing-recipient mode. The route now supports `AUTH_EMAIL_FROM` / `RESEND_FROM_EMAIL` and returns an explicit error when production is still using the test sender, but the deployed environment still needs a verified sender configured before non-owner accounts can rely on email-code auth.
**Verification:** Production `you.md` supports passwordless sign-up/sign-in/sign-out/session refresh, the dashboard works on the new first-party auth stack, CLI `register`/`login`/`whoami` work against production, and the old Clerk-dependent paths/webhooks/password endpoints are removed or explicitly deprecated.

### 47. Let users reveal/copy current API keys again and clean up key-panel confusion
**Status:** DONE
**Verified:** NO
**Request:** The settings pane should let users reveal/show and copy active API keys again instead of forcing endless new key creation, and it should stop making the key list feel like a giant pile of still-live credentials when most of them are just revoked history.
**Progress (2026-04-17):** Added reveal support for newly issued API keys by storing owner-revealable encrypted plaintext alongside the existing hash-only auth record, kept auth validation on `keyHash`, added a `revealKey` mutation with owner checks + security logging, upgraded the settings pane to show/hide/copy revealable active keys, hid revoked key history behind an explicit toggle, and updated copy to explain the one-time migration reality: older keys created before reveal support remain hash-only and need one rotate to become revealable going forward.
**Verification:** On production, newly created or rotated API keys show a `show key` action in settings, reveal the plaintext for owner copy, and old revoked/history keys stay collapsed by default unless explicitly expanded.

### 48. Consolidate the right-panel nav into more intuitive grouped labels
**Status:** DONE
**Verified:** NO
**Request:** The dashboard panel nav is cluttered and confusing. Group/consolidate it into more intuitive labels that people instantly understand instead of a long flat row of niche tabs.
**Progress (2026-04-17):** Reworked the shell preview nav into grouped top-level buckets (`profile`, `content`, `share`, `agents`, `insights`, `portrait`, `account`) with secondary sub-tabs only when needed (`files/history`, `agents/skills`, `settings/secrets/help`). This now applies on both desktop and mobile instead of exposing the old long flat tab strip everywhere.
**Verification:** On the deployed shell, the right panel shows grouped primary categories with small secondary tabs only for grouped areas, and the mobile shell uses the same grouping model instead of exposing every pane as its own top-level tab.

### 49. Fix stale CLI auth state and add a real logout path
**Status:** DONE
**Verified:** NO
**Request:** The local CLI should not stay stuck on the disposable `@clitest...` machine state, and logging into a real production account with `youmd login --key ...` should not verify that key against stale dev endpoints. There also needs to be a proper `youmd logout`.
**Progress (2026-04-17):** Fixed CLI endpoint handling so auth requests resolve the configured API/app URLs per request instead of caching stale values at module load, forced fresh logins back onto the production defaults, cleared stale `username` / `email` on key login, and added `youmd logout` to clear local auth state from `~/.youmd/config.json`.
**Verification:** Run `youmd logout`, then `youmd login --key ...`, then `youmd whoami`. The CLI should resolve the real production identity cleanly instead of saving the key but reporting a 401 from the old dev backend.

### 50. Make the curl installer the default CLI onboarding path
**Status:** DONE
**Verified:** NO
**Request:** Add a `curl ... | bash` installer like gstack/OpenClaw, make it the primary CLI CTA on the homepage, and keep npm as the secondary install option. The docs and in-product help should all teach the same curl-first path.
**Progress (2026-04-17):** Added `https://you.md/install.sh`, which installs `youmd@latest` globally via npm and prints next steps. Updated the hero/footer CLI CTAs to use tabbed curl-vs-npm install cards, updated the landing-page how-it-works steps, updated docs/README/in-app help to teach the curl path first, and kept npm as the explicit fallback for users who prefer direct package-manager installs.
**Verification:** `curl -fsSL https://you.md/install.sh | bash` installs the CLI, `youmd --version` works in a fresh shell, and the homepage/docs/help all show curl first with npm as the secondary option.

### 51. Fix the blocked npm publish retry after 0.6.1 already landed
**Status:** DONE
**Verified:** NO
**Request:** Publishing `0.6.1` failed because npm already had that version. The CLI package should be bumped again and the package metadata warnings from npm should be cleaned up before the next publish attempt.
**Progress (2026-04-17):** Confirmed `youmd@0.6.1` is already live on npm, bumped the CLI to `0.6.2`, normalized the `bin` entries to clean `dist/...` paths, normalized the repository URL to `git+https://...`, and rebuilt the CLI so the runtime version + MCP user-agent match the next publish target.
**Verification:** `node cli/dist/index.js --version` returns `0.6.2`, `cli/package.json` and `package-lock.json` both say `0.6.2`, and `npm publish` should now target `0.6.2` without the prior overwrite error.

### 52. Make the installed CLI feel alive and proactive instead of assuming the user knows the commands
**Status:** DONE
**Verified:** NO
**Request:** The installed CLI should feel more like meeting a friendly wingman agent such as Claude Code/OpenClaw: logo/mascot energy, portrait-in-code when available, proactive suggestions, helpful next steps, and less of a “here’s a command list, good luck” vibe. This should not be limited to onboarding; normal `youmd` and `youmd chat` entry should feel alive too.
**Progress (2026-04-18):** Bare `youmd` now opens with the YOU logo, an optional saved portrait preview, a more human greeting, contextual next moves, and repo-aware setup suggestions instead of the old dry mini help state. `youmd chat` now enters with the same U-style opening, notices missing AGENTS/project-context wiring in a real repo, and no longer prints the first streamed assistant greeting twice. npm postinstall is no longer deadpan either — it now prints a small U-style install moment that points users toward `youmd`, `youmd login`, and `youmd chat`. The follow-up local-launch pass then added the stronger portrait-forward `you` entrypoint, bot greeting, and proactive intro so the “meet U” vibe is no longer limited to onboarding or the bare `youmd` welcome.
**Verification:** Run bare `youmd` in a normal shell and `youmd chat` from a directory with your bundle. Both should feel noticeably more alive, and `youmd chat` should only print the opening assistant turn once.

### 53. Evaluate a `you` command alias for U
**Status:** DONE
**Verified:** NO
**Request:** If it can be done safely, it would be ideal to type `you` to start the local U agent.
**Progress (2026-04-18):** Accepted the collision risk and shipped the alias in the CLI package. `you` now launches straight into U chat when the user is authenticated and a bundle exists, falls back to the home bundle in `~/.youmd` when there is no local `.youmd/`, and still preserves normal subcommand usage like `you status`. Local smoke tests passed from the repo root with no local `.youmd/`: `printf '/done\\n' | node cli/dist/you.js` rendered the YOU logo, Houston's portrait-in-code, the bot greeting, proactive intro copy, and exited cleanly; `node cli/dist/you.js status`, `diff`, and `export` now resolve the same active home bundle instead of pretending nothing is initialized.
**Verification:** Install the published CLI globally, run `you` from a directory without a local `.youmd/`, confirm it launches U chat using the home bundle, and confirm `you status` and other read-only commands still work as aliases for the active bundle.

### 39. Identity-Aware Skill System — Full Implementation
**Status:** DONE
**Verified:** NO
**Request:** Build The Library-inspired skill system with identity interpolation, YAML catalog, bundled skills, CLI commands, cross-project sync, agent linking, meta-improvement, web dashboard pane.
**Verification:** Run `youmd skill list` (shows 7 bundled skills), `youmd skill install all`, `youmd skill init-project` in a fresh repo (generates AGENTS.md + CLAUDE.md + project-context/ + .you/ + .claude/skills/), `youmd skill use youstack-start` with identity data populated (all {{var}} resolved), `youmd skill link claude`, web dashboard shows skills tab.

### 40. Git Self-Hosting vs Convex Architecture Decision
**Status:** DECIDED — Convex stays as source of truth, git as optional export channel in v2
**Verified:** N/A (architecture decision, not code)
**Request:** Should users self-host identity as GitHub repos?
**Decision:** Keep Convex canonical. Content-hash version control already works. Git would add complexity without adding value. Future: `youmd export --github` as optional mirror.

---

## CLI UX (from March 25 conversations)

### 1. BrailleSpinner color rotation + lightsweep effect
**Status:** DONE (e6955b4)
**Verified:** NO
**Request:** Spinner animation rotates through shades of orange. Lightsweep effect on text itself (brightness sweep across characters).
**Verification:** Run youmd init, observe spinner colors rotate and text has sweeping brightness.

### 2. Profile images + ASCII portraits synced CLI → web
**Status:** DONE (code exists)
**Verified:** NO
**Request:** CLI properly passes profile images and ASCII portrait data to web API on push/sync. Portraits generated locally should persist on server.
**Verification:** youmd init → generate portrait → youmd push → check web dashboard portrait pane shows same portrait.

### 3. Text formatting improvements
**Status:** DONE (16402b1)
**Verified:** YES
**Request:** Fix jumbled text, proper word wrapping, left alignment, line breaks between paragraphs.

### 4. Track all requests in feature-requests.md
**Status:** DONE (this file)
**Verified:** YES

### 5. Update CLAUDE.md with request tracking instructions
**Status:** DONE (CLAUDE.md rewrite 2026-03-26)
**Verified:** NO

### 6. Green OK for status indicators in CLI
**Status:** DONE (e6955b4)
**Verified:** NO
**Request:** Green checkmarks/indicators for live/active/done status are acceptable alongside orange accent.

### 7. CLI first-party auth (no API token needed for your own account)
**Status:** DONE (a6d5c3d)
**Verified:** NO
**Request:** Users should authenticate as themselves from the CLI without hand-managing API tokens. API tokens are for agent/app access, not basic account login.
**Verification:** `youmd register` → email code → account created → `youmd login` → email code → authenticated session + API key saved → `youmd whoami` succeeds.

### 8. ASCII portrait within first 3 interactions
**Status:** DONE (8d64e95)
**Verified:** NO
**Request:** After username + name + first social handle, immediately show ASCII portrait in terminal.
**Verification:** Run youmd init, after providing first social handle, portrait renders before next question.

### 9. Multi-select UI for agent/tool selection
**Status:** DONE (310816c)
**Verified:** NO
**Request:** Arrow keys to navigate, right to select, left to deselect. Pre-filled options for coding agents and web agents.

### 10. YOU ASCII logo on opening screen
**Status:** DONE (8d64e95)
**Verified:** NO
**Request:** Block-char YOU logo renders in burnt orange at start of youmd init.

---

## Web UI (from March 24-25 conversations)

### 11. Profile sections should be dynamic/flexible
**Status:** TODO
**Request:** Profiles shouldn't be bound to same sections every time. Users should chat with agent to add custom sections. Default sections as template, but extensible.
**Verification:** In dashboard terminal, ask agent "add a section called Research Interests" → new section appears on profile.

### 12. Agent chat thinking/streaming should match Claude Code style
**Status:** PARTIALLY DONE
**Request:** Activities, thinking, structured responses should look and feel like Claude Code. Currently "very unimpressive."
**Verification:** Compare web chat UX side-by-side with Claude Code.

### 13. Share prompts should include directive for agent response
**Status:** DONE (already implemented — RESPONSE_DIRECTIVE in SharePane.tsx)
**Verified:** NO
**Request:** When copying share prompt, include 1-2 directive lines telling the receiving agent HOW to respond after reading the you.md context. Agent should confirm what it received and how it will persist/use it.
**Verification:** Copy share prompt → paste to ChatGPT → ChatGPT responds with specific acknowledgment of identity data.

### 14. You Agent thinks it can't do things
**Status:** TODO
**Request:** Agent says "the system handles that in the backend" when asked to manage portraits/images. Agent IS the system. It should be able to do anything the system can do.
**Verification:** Ask agent "show me all my portraits" → it displays them. Ask "update my portrait to use my x.com profile" → it does it and shows the result.

### 15. Show portraits in web chat
**Status:** PARTIALLY DONE
**Request:** Portraits should display in chat when switched, created, or requested. "Can you show me all my portraits?" should work.
**Verification:** In web terminal, type "show me my portrait" → ASCII portrait renders inline in chat.

### 16. Reveal/copy existing API key (not just revoke-to-create)
**Status:** PARTIALLY DONE
**Request:** In web UI settings, user should be able to reveal and copy their existing API key instead of having to revoke and create a new one.
**Progress (2026-04-17):** Settings now supports the operationally useful path: `rotate key` creates one fresh key, reveals it immediately for copy, and revokes the old pile; `revoke all keys` cleans up stale keys without touching share links or other token types. Existing historical keys are still not revealable because the backend stores only hashes, not reversible ciphertext. Follow-up UX hardening now hides revoked keys behind an explicit history toggle so the panel reflects the real active-key state instead of showing the full graveyard first.
**Verification:** Go to dashboard /settings → API keys → use `rotate key` and confirm a fresh key is shown/copyable immediately while the old active keys are revoked. Use `revoke all keys` and confirm only API keys are revoked.

### 17. Persistent real-time progress on ALL active steps
**Status:** DONE
**Request:** BrailleSpinners/live animation on every step, not just web crawling. Every time agent is working, user sees activity.
**Verification:** Any agent operation (save, compile, scrape, LLM call) shows progress indicator.

### 53. Shell thinking indicator should feel like Codex/Claude Code
**Status:** DONE
**Verified:** NO
**Request:** Keep the braille loading animation alive while the agent is working, rotate through unique subtask-aware status text instead of one stale phrase, add a text sweep/shimmer effect to the active line, and show completed work in real time so the shell feels as alive and transparent as Codex or Claude Code.
**Verification:** In the web shell, trigger a multi-step task. The top thinking line keeps animating, rotates through active/completed subtask phrases while work is in progress, and the activity log visibly reorders/emphasizes running vs completed steps instead of freezing on one generic status.

### 54. Web/CLI agent turns should follow ack → plan → work → complete
**Status:** DONE
**Verified:** NO
**Request:** While the agent is still doing background saves/publishes/mutations, keep the active braille loader + work text visible instead of collapsing to a barely visible cursor. Then finish each turn with a stronger completion message that explains what actually changed, keeps the green programmatic notices, and proactively proposes the next highest-leverage follow-up options so the experience feels guided instead of abruptly stopping.
**Verification:** In a real shell mutation flow, the working indicator stays alive through response drafting plus the post-response mutation tail, then the assistant completion text summarizes the concrete changes and ends with proactive next-step options above the existing green notices.

### 55. Save Houston's preferred agent-session behavior into his own You.md identity and prove cross-agent discoverability
**Status:** IN PROGRESS
**Verified:** NO
**Request:** Persist Houston's preferences for how agentic chat / terminal sessions should behave — including the ack → plan → work → complete pattern and proactive next-step guidance — into his own durable You.md preferences/directives using the published npm package / skill workflow, sync them, and then verify another agent-facing surface can find that context later.
**Progress (2026-04-17):** Confirmed the last published npm package was `youmd@0.6.0`, simplified the CLI auth entrypoint so `youmd login` now offers browser sign-in on Enter, email-code login in-terminal when an email is typed, and `--key` as the explicit direct-auth path, and then corrected the repo/package version drift so the next clean publish target is `youmd@0.6.1`. The remaining blocker is account state, not the login surface: the current `~/.youmd/config.json` still points at the disposable CLI test account rather than Houston's real `@houstongolden` identity, so the preference-save proof cannot be completed honestly yet.
**Progress (2026-04-18 update):** Pulled Houston's real live bundle into `~/.youmd`, added the agent-session preferences directly into `preferences/agent.md` and `directives/agent.md`, published them as live bundle `v65`, and then verified a clean pull using the local `0.6.3` build. That exposed and then fixed a real compiler/decompiler bug: richer markdown instructions in preferences/directives/voice files were being flattened away on pull because only the structured top-line fields were preserved. The roundtrip now works correctly with the local `0.6.22` build. Remaining step: publish `youmd@0.6.22` to npm so end users get the same durable roundtrip behavior from the packaged CLI rather than only from the repo build.
**Verification:** Using the published npm package, pull Houston's real bundle, confirm the new session-behavior preferences are present in `preferences/agent.md` / `directives/agent.md`, and confirm another agent-facing surface can read or leverage that context without manual re-entry.

### 56. Make the `you` launcher feel truthful, proactive, and portrait-consistent
**Status:** DONE
**Verified:** NO
**Request:** Tighten the local `you` launch experience so it feels like a real wingman encounter rather than a static splash: make the bot art more solid, make the startup portrait follow Houston's actual default/public portrait, make onboarding feel like the same encounter, and ensure the "sipping bitbucks frappaccino" idea maps to real active investigation work rather than decorative fake-thinking copy.
**Progress (2026-04-18):** Hardened the `you` launcher so it now runs a real local-context investigation before speaking, keeps a live braille spinner active while it scans nearby AGENTS / CLAUDE / project-context signals, and then reports concrete findings instead of bluffing that it already looked around. Reworked the terminal bot into a chunkier block shape that sits more naturally beside the YOU logo. Tightened the encounter copy so the final speech line points at real active work ("taking a lap through your recent work"). Also fixed a contract bug on the public profile path: the CLI wrapper for `/api/v1/profiles` was stripping `_profile` metadata, so the launcher could not actually see the live profile portrait metadata it was supposed to prefer. The public profile payload now includes `_profile.asciiPortrait`, and the CLI portrait resolver now prefers current profile/portrait data before stale cached avatar fallbacks. Follow-up improvements: the launcher now scans recent project contexts for actual openings instead of only listing project names, that scan falls back to the home `~/.youmd/projects` root when `you` is launched from arbitrary directories, and it now also notices ordinary workspace repos that already have `AGENTS.md`, `CLAUDE.md`, `.youmd-project`, or `project-context/` so the proactive suggestions stay useful outside the managed You.md project format. The web `/initialize` flow now passes live progress metadata into the terminal shell, prompts the first greeting to sound like the same local U encounter, includes a portrait-first encounter strip above the onboarding terminal, and now also carries the actual YOU logo framing so the scene composition matches the local launcher more closely. The latest fixes also make the portrait encounter responsive in narrow terminals by stacking the portrait, bot, and speech vertically when the side-by-side scene would overlap, deepen the startup investigation so U reads home-level shared agent docs plus recent Claude-side session activity, compact the terminal portrait so the web-profile ASCII payload does not flood/truncate the terminal, slow the scan enough to feel intentional, collapse the duplicated startup output into two findings plus one concise strongest-move opener, and replace the two one-off host bridges with a real local tool loop so U can choose `discover_projects`, `read_project_context`, `write_project_context`, `sync_identity`, or `respond` while the CLI host performs the filesystem/bundle work. Remaining step: verify after deploy that the startup portrait now matches Houston's current default/public portrait on the live profile and tune the live layout balance if needed.
**Verification:** After the latest deploy and npm publish, run `you` from a fresh shell. The startup should show the updated bot art, keep a live spinner active while U investigates local context, print real findings, and render the same portrait-in-code that the public profile exposes as Houston's current default portrait.

### 57. Teach `you` consistently across install and onboarding surfaces
**Status:** DONE
**Verified:** NO
**Request:** Once `you` exists as the real wingman entrypoint, make sure the surrounding install/login/init/onboarding guidance consistently points people there instead of making them memorize the older `youmd chat` path.
**Progress (2026-04-18):** Updated the installer output, CLI register success copy, example-init next steps, conversational onboarding next-step block, and README quickstart/command table so the product consistently teaches `you` as the main alive terminal entrypoint after a bundle exists. `youmd chat` still exists as the explicit long-form command, but it is no longer the dominant path in the first-run guidance.
**Verification:** Run the curl installer, register/login/init, and read the README quickstart. The next-step guidance should consistently suggest `you` once the identity bundle exists.

---

## SEO/AEO (from March 24-25)

### 18. Full SSR for all profile pages
**Status:** DONE (0d003f9, e41a056, 73556f9)
**Verified:** YES (profiles render in SSR HTML)

### 19. JSON-LD on all profile pages
**Status:** DONE (73556f9)
**Verified:** NO
**Verification:** View page source of you.md/houstongolden → JSON-LD script tag present with correct data.

### 20. OG cards verified across platforms
**Status:** DONE (code exists)
**Verified:** NO
**Verification:** Share you.md/houstongolden on X, LinkedIn, Slack → preview card shows correctly.

### 21. Sitemap includes all profiles
**Status:** DONE
**Verified:** NO
**Verification:** Visit you.md/sitemap.xml → all profiles listed with correct URLs and timestamps.

---

## Architecture/Documentation (from March 26)

### 22. ARCHITECTURE.md with full system diagram
**Status:** DONE (2026-03-26)
**Verified:** NO

### 23. PRD.md rewrite (full product requirements)
**Status:** DONE (2026-03-26)
**Verified:** NO

### 24. CURRENT_STATE.md (what's deployed vs broken)
**Status:** DONE (2026-03-26)
**Verified:** NO

### 25. CLAUDE.md rewrite (complete operating manual)
**Status:** DONE (2026-03-26)
**Verified:** NO

### 26. TODO.md refresh (match git log)
**Status:** DONE (2026-03-26)
**Verified:** NO

### 27. Memory file consolidation
**Status:** IN PROGRESS
**Verification:** Memory index lists all files, no duplicates, CLI feedback consolidated.

---

## Agent System (from March 24-25)

### 28. Proactive source refresh
**Status:** DONE (code in useYouAgent)
**Verified:** NO
**Request:** Agent detects stale sources (>7 days) and suggests re-scraping.

### 29. Session compaction
**Status:** DONE (code in useYouAgent)
**Verified:** NO
**Request:** When conversation exceeds 120k chars, summarize old messages and continue.

### 30. CLI directives in chat context
**Status:** DONE (chat.ts)
**Verified:** NO
**Request:** CLI chat injects agent_directives from you.json into LLM context.

### 31. Project-aware CLI context injection
**Status:** DONE (config.ts, chat.ts)
**Verified:** NO
**Request:** CLI detects when in a project directory, injects project-specific context into agent conversations.

---

## Unfulfilled / Future Requests

### 32. MCP endpoint (mcp.you.md/{username})
**Status:** TODO
**Source:** PRD v2.0, multiple conversations

### 33. Stripe Pro plan billing
**Status:** TODO — BLOCKED (needs Stripe account)

### 34. Verified badges
**Status:** TODO
**Request:** Domain verification, social verification, DNS TXT records.

### 35. Profile analytics dashboard
**Status:** TODO
**Request:** Views, agent reads, top queries, traffic sources.

### 36. Custom domains for profiles
**Status:** TODO

### 37. Interview mode (youmd interview)
**Status:** TODO
**Request:** Structured interview flow for deeper identity capture.

### 38. Autonomous refresh (youmd refresh)
**Status:** TODO
**Request:** Agent autonomously re-scrapes sources and updates profile.

---

## Summary

| Status | Count |
|---|---|
| VERIFIED | 3 |
| DONE (not verified) | 37 |
| DECIDED | 1 |
| PARTIALLY DONE | 2 |
| IN PROGRESS | 1 |
| TODO | 9 |
| BLOCKED | 1 |
| **Total tracked** | **54** |

## March 27 Session Additions

### 39. Clickable links in MessageBubble
**Status:** DONE (0fe89b6)
**Request:** URLs in agent messages should be clickable. Both [text](url) and bare https:// URLs.

### 40. Code block copy buttons
**Status:** DONE (0fe89b6)
**Request:** Copy button on code blocks in terminal chat.

### 41. Dashboard skeleton loading
**Status:** DONE (0fe89b6)
**Request:** Proper skeleton layout instead of "loading..." text.

### 42. Profile "updated X ago" timestamp
**Status:** DONE (0fe89b6)
**Request:** Show relative time since last update on profile pages.

### 43. Visitor CTA on profile pages
**Status:** DONE (0fe89b6)
**Request:** "want your own identity file? > create yours" for non-owners.

### 44. EditPane tab visual hierarchy
**Status:** DONE (0fe89b6)
**Request:** Accent bottom border on active sub-tab.

### 45. Activity log progress step hierarchy
**Status:** DONE (0fe89b6)
**Request:** Running steps in accent color, completed steps dimmed.

### 46. Terminal scroll indicator
**Status:** DONE (0fe89b6)
**Request:** Gradient at top when messages exist above viewport.

### 47. CLI section validation (security)
**Status:** DONE (0fe89b6)
**Request:** Validate LLM section names before writing files, prevent path traversal.

### 48. CLI crash-safe raw mode restore
**Status:** DONE (0fe89b6)
**Request:** Restore terminal raw mode on unexpected process exit during password input.

### 49. Homepage FAQ section
**Status:** DONE (403a7f6)
**Request:** 8 expandable Q&As with terminal-native styling.

### 50. Homepage before/after demo
**Status:** DONE (403a7f6)
**Request:** ProblemStrip shows real agent conversation before vs after you.md.

### 51. Homepage integration demo
**Status:** DONE (403a7f6)
**Request:** Integrations section shows actual share prompt + agent response.

### 52. CLI YOU logo upgrade
**Status:** DONE (58ba376)
**Request:** Clean block art matching Vercel PLUGINS banner style. Just "YOU" — not YOU.MD.
