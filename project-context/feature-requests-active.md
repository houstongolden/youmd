# Active Feature Requests — Tracked Until Verified

Last Updated: 2026-04-17

## Tracking Rules
- Every request gets its own entry with status
- Status: TODO | IN PROGRESS | DONE | VERIFIED BY USER
- Don't mark DONE until actually deployed and tested
- Don't ignore parts of messages — break them ALL down
- Source: date + commit or conversation reference

---

## Skill System (from March 27 conversation)

### 41. Codex MCP launcher should use local CLI in the youmd repo and npm elsewhere
**Status:** DONE
**Verified:** NO
**Request:** Prevent Codex/youmd MCP startup failures caused by `npx youmd mcp` resolving the repo root package when working inside the youmd codebase. Use the local `cli/` build in this repo for development, and a published npm package everywhere else.
**Verification:** Start Codex in `/Users/houstongolden/Desktop/CODE_2025/youmd` — no `youmd` MCP handshake warning. Start Codex in another repo — `youmd` MCP still starts via npm.

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
**Progress (2026-04-17):** Completed the first evidence pass, then followed with multiple real hardening passes. Smoke-tested `skill init-project` scaffold/additive modes, `mcp --json`, `mcp --install`, live public API + MCP behavior, and the authenticated CLI flow (`register`, `login`, `login --key`, `whoami`, `push`, `pull`, `diff`, `status`, `keys list`, `sync`) against fresh production accounts. Fixed broken web-domain MCP discovery/transport, stale 4-skill web-shell copy, portrait tool-use handling, nested `/me` auth parsing, vendor `+json` public-profile parsing, local publish-state persistence, public-profile markdown fetching, and publish→pull→diff round-trip drift. Follow-up auth migration work replaced the Clerk-first web/CLI path with first-party passwordless auth, validated local `/api/auth/*` signup/login/logout/session flows, validated CLI `register`/`login`/`whoami` against dev, validated real production email delivery + verify-code + session cookies + `/shell` hydration on `you.md`, and validated production API-key issuance plus CLI `whoami` against the live prod backend. The web-shell parity pass fixed a frontend latency issue where the shell waited on `/chat/ack` before streaming the main response, added an explicit blank-response fallback instead of silent nothingness, and added same-origin web-domain proxies for `/api/v1/chat`, `/api/v1/chat/ack`, and `/api/v1/chat/stream` so the shell, docs, and public surface stop contradicting each other. Also cleaned stale auth/shell/docs copy (`v0.1.0`, "dashboard", dead auth endpoints, fake MCP install command). Continuation audit work verified the Vercel deploy was actually `Ready`, confirmed live production `POST /api/v1/chat` and `POST /api/v1/chat/ack` return `200`, reproduced browser-level shell mutation journeys against disposable authenticated accounts, and fixed three more concrete quality bugs: local web auth minted `localhost`-issuer Convex tokens when pointed at remote Convex, custom-section saves could clobber `profile.youJson`, and completed custom-section turns could be re-applied on later unrelated requests because stale raw mutation history kept being forwarded back into the model. The latest pass re-verified local browser auth after restarting the stale dev server, re-verified production browser shell access, fixed `youmd chat` so closed stdin stops crashing with `ERR_USE_AFTER_CLOSE`, fixed the clean browser-level custom-section replay repro by pruning resolved mutation turns and storing the final rendered assistant completion text in LLM history, fixed the production shell's exact project-scaffold golden path by replacing the fragile LLM-only write flow with a deterministic scaffold mutation that now creates the real `private/projects/*` tree on `you.md`, and then re-verified the post-login production shell bootstrap path plus the live authenticated bundle contents so the scaffolded project files are now proven in the real published bundle rather than only in UI copy. New blocker uncovered during this auth-depth pass: passwordless email delivery is still effectively in Resend testing mode until production uses a verified sender (`AUTH_EMAIL_FROM` / `RESEND_FROM_EMAIL`), so non-owner accounts and plus-address aliases are not yet fully release-ready. Remaining major blocker: the broader transcript-level web-agent personality/proactiveness/product-behavior audit still needs its own focused pass.
**Verification:** There is a concrete ship-readiness plan, a real end-to-end test matrix, a bug/repro inventory for the web agent, a parity audit for local vs web, and a prioritized fix list that can be executed to reach public-release quality.

### 46. Replace Clerk with first-party passwordless auth modeled on foldermd
**Status:** IN PROGRESS
**Verified:** NO
**Request:** Drop Clerk, simplify aggressively, and move You.md to a first-party passwordless auth model similar to foldermd: email code / magic link for humans, HTTP-only sessions for the web, scoped API keys for CLI/MCP/agents, and one internal user identity rather than Clerk-owned auth.
**Progress (2026-04-16):** Added first-party auth/session tables and mutations in Convex, switched Convex auth to `customJwt`, added web auth routes (`send-verification`, `verify-code`, `verify-link`, `session`, `logout`, `/.well-known/jwks.json`), replaced the app-side Clerk provider with `YouAuthProvider`, replaced the sign-in/sign-up flows with sequential passwordless terminal UX, removed the last live Clerk package dependency from the web app, migrated CLI `register`/`login` to email-code auth, fixed Convex no-emit config to stop regenerating stray `.js` files, synced the new signer/JWKS env, validated local web auth plus CLI auth against the new flow, validated the real production email-code/session flow on `you.md`, validated authenticated production shell hydration, validated prod API-key issuance plus CLI `whoami`, and retired the legacy password/webhook routes to explicit deprecation responses while removing stale Clerk CSP/auth copy. Continuation work also fixed a local-development parity bug where the web app could mint `localhost`-issuer Convex JWTs while talking to a remote Convex deployment, which caused silent auth rejection during local shell QA.
**Progress (2026-04-17 update):** The first-party passwordless stack is now clearly the live auth path, and the production session/bootstrap flow is verified after login. This pass also exposed one remaining release blocker: the web auth route was still hardcoded to `onboarding@resend.dev`, which leaves Resend in testing-recipient mode. The route now supports `AUTH_EMAIL_FROM` / `RESEND_FROM_EMAIL` and returns an explicit error when production is still using the test sender, but the deployed environment still needs a verified sender configured before non-owner accounts can rely on email-code auth.
**Verification:** Production `you.md` supports passwordless sign-up/sign-in/sign-out/session refresh, the dashboard works on the new first-party auth stack, CLI `register`/`login`/`whoami` work against production, and the old Clerk-dependent paths/webhooks/password endpoints are removed or explicitly deprecated.

### 39. Identity-Aware Skill System — Full Implementation
**Status:** DONE
**Verified:** NO
**Request:** Build The Library-inspired skill system with identity interpolation, YAML catalog, bundled skills, CLI commands, cross-project sync, agent linking, meta-improvement, web dashboard pane.
**Verification:** Run `youmd skill list` (shows 6 bundled skills), `youmd skill install all`, `youmd skill init-project` in a fresh repo (generates AGENTS.md + CLAUDE.md + project-context/ + .you/ + .claude/skills/), `youmd skill use claude-md-generator` with identity data populated (all {{var}} resolved), `youmd skill link claude`, web dashboard shows skills tab.

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
**Status:** TODO
**Request:** In web UI settings, user should be able to reveal and copy their existing API key instead of having to revoke and create a new one.
**Verification:** Go to dashboard /settings → API keys → click reveal → key shown → copy works.

### 17. Persistent real-time progress on ALL active steps
**Status:** DONE
**Request:** BrailleSpinners/live animation on every step, not just web crawling. Every time agent is working, user sees activity.
**Verification:** Any agent operation (save, compile, scrape, LLM call) shows progress indicator.

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
