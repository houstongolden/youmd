# Active Feature Requests — Tracked Until Verified

Last Updated: 2026-05-25

## Tracking Rules
- Every request gets its own entry with status
- Status: TODO | IN PROGRESS | DONE | VERIFIED BY USER
- Don't mark DONE until actually deployed and tested
- Don't ignore parts of messages — break them ALL down
- Source: date + commit or conversation reference

---

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
