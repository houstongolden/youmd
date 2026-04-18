# Active Feature Requests — Tracked Until Verified

Last Updated: 2026-04-18

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
**Progress (2026-04-18):** Completed the first evidence pass, then followed with multiple real hardening passes. Smoke-tested `skill init-project` scaffold/additive modes, `mcp --json`, `mcp --install`, live public API + MCP behavior, and the authenticated CLI flow (`register`, `login`, `login --key`, `whoami`, `push`, `pull`, `diff`, `status`, `keys list`, `sync`) against fresh production accounts. Fixed broken web-domain MCP discovery/transport, stale 4-skill web-shell copy, portrait tool-use handling, nested `/me` auth parsing, vendor `+json` public-profile parsing, local publish-state persistence, public-profile markdown fetching, and publish→pull→diff round-trip drift. Follow-up auth migration work replaced the Clerk-first web/CLI path with first-party passwordless auth, validated local `/api/auth/*` signup/login/logout/session flows, validated CLI `register`/`login`/`whoami` against dev, validated real production email delivery + verify-code + session cookies + `/shell` hydration on `you.md`, and validated production API-key issuance plus CLI `whoami` against the live prod backend. The web-shell parity pass fixed a frontend latency issue where the shell waited on `/chat/ack` before streaming the main response, added an explicit blank-response fallback instead of silent nothingness, and added same-origin web-domain proxies for `/api/v1/chat`, `/api/v1/chat/ack`, and `/api/v1/chat/stream` so the shell, docs, and public surface stop contradicting each other. Also cleaned stale auth/shell/docs copy (`v0.1.0`, "dashboard", dead auth endpoints, fake MCP install command). Continuation audit work verified the Vercel deploy was actually `Ready`, confirmed live production `POST /api/v1/chat` and `POST /api/v1/chat/ack` return `200`, reproduced browser-level shell mutation journeys against disposable authenticated accounts, and fixed three more concrete quality bugs: local web auth minted `localhost`-issuer Convex tokens when pointed at remote Convex, custom-section saves could clobber `profile.youJson`, and completed custom-section turns could be re-applied on later unrelated requests because stale raw mutation history kept being forwarded back into the model. The latest pass re-verified local browser auth after restarting the stale dev server, re-verified production browser shell access, fixed `youmd chat` so closed stdin stops crashing with `ERR_USE_AFTER_CLOSE`, fixed the clean browser-level custom-section replay repro by pruning resolved mutation turns and storing the final rendered assistant completion text in LLM history, fixed the production shell's exact project-scaffold golden path by replacing the fragile LLM-only write flow with a deterministic scaffold mutation that now creates the real `private/projects/*` tree on `you.md`, and then re-verified the post-login production shell bootstrap path plus the live authenticated bundle contents so the scaffolded project files are now proven in the real published bundle rather than only in UI copy. New blocker uncovered during this auth-depth pass: passwordless email delivery is still effectively in Resend testing mode until production uses a verified sender (`AUTH_EMAIL_FROM` / `RESEND_FROM_EMAIL`), so non-owner accounts and plus-address aliases are not yet fully release-ready. This pass also moved the local CLI much closer to the intended “meet U” feel by adding a real `you` launcher, portrait-forward startup, home-bundle fallback, update-aware startup hints, and active-bundle parity for read-only commands like `status`, `diff`, `export`, and `preview`. Remaining major blocker: the broader transcript-level web-agent personality/proactiveness/product-behavior audit still needs its own focused pass.
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
**Progress (2026-04-18 update):** Pulled Houston's real live bundle into `~/.youmd`, added the agent-session preferences directly into `preferences/agent.md` and `directives/agent.md`, published them as live bundle `v65`, and then verified a clean pull using the local `0.6.3` build. That exposed and then fixed a real compiler/decompiler bug: richer markdown instructions in preferences/directives/voice files were being flattened away on pull because only the structured top-line fields were preserved. The roundtrip now works correctly with the local `0.6.11` build. Remaining step: publish `youmd@0.6.11` to npm so end users get the same durable roundtrip behavior from the packaged CLI rather than only from the repo build.
**Verification:** Using the published npm package, pull Houston's real bundle, confirm the new session-behavior preferences are present in `preferences/agent.md` / `directives/agent.md`, and confirm another agent-facing surface can read or leverage that context without manual re-entry.

### 56. Make the `you` launcher feel truthful, proactive, and portrait-consistent
**Status:** DONE
**Verified:** NO
**Request:** Tighten the local `you` launch experience so it feels like a real wingman encounter rather than a static splash: make the bot art more solid, make the startup portrait follow Houston's actual default/public portrait, make onboarding feel like the same encounter, and ensure the "sipping bitbucks frappaccino" idea maps to real active investigation work rather than decorative fake-thinking copy.
**Progress (2026-04-18):** Hardened the `you` launcher so it now runs a real local-context investigation before speaking, keeps a live braille spinner active while it scans nearby AGENTS / CLAUDE / project-context signals, and then reports concrete findings instead of bluffing that it already looked around. Reworked the terminal bot into a chunkier block shape that sits more naturally beside the YOU logo. Tightened the encounter copy so the final speech line points at real active work ("taking a lap through your recent work"). Also fixed a contract bug on the public profile path: the CLI wrapper for `/api/v1/profiles` was stripping `_profile` metadata, so the launcher could not actually see the live profile portrait metadata it was supposed to prefer. The public profile payload now includes `_profile.asciiPortrait`, and the CLI portrait resolver now prefers current profile/portrait data before stale cached avatar fallbacks. Follow-up improvements: the launcher now scans recent project contexts for actual openings instead of only listing project names, that scan falls back to the home `~/.youmd/projects` root when `you` is launched from arbitrary directories, and it now also notices ordinary workspace repos that already have `AGENTS.md`, `CLAUDE.md`, `.youmd-project`, or `project-context/` so the proactive suggestions stay useful outside the managed You.md project format. The web `/initialize` flow now passes live progress metadata into the terminal shell, prompts the first greeting to sound like the same local U encounter, and includes a portrait-first encounter strip above the onboarding terminal. Remaining step: verify after deploy that the startup portrait now matches Houston's current default/public portrait on the live profile.
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
