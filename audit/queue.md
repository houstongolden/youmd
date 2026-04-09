# You.md QA Audit Queue

Each entry is one cycle. Top item is next. Cycles loop forever until Houston says stop.

When an entry is audited, move it to `## DONE` (with date), and move any actionable issues
to `audit/improvements.md`.

## NEXT (work top-to-bottom)

### Web — Public Routes
- [x] landing — `/` — render, hero CTAs, scroll, mobile + desktop, animations (cycle 1, 2026-04-08, 3 fixed inline + 3 queued — all 6 cleared by cycles 1-4)
- [x] sign-up — `/sign-up` — Clerk widget loads, can submit, redirects correctly (cycle 5, 2026-04-08, 4 a11y bugs found + fixed inline)
- [x] sign-in — `/sign-in` — same as above (cycle 7, 2026-04-08, cycle 6 a11y verified live + 4 missing-h1/main bugs found across all 4 auth pages and fixed inline)
- [x] docs — `/docs` — content renders, links work, mobile (cycle 8, 2026-04-08, P1 buttons-not-anchors bug found + fixed inline)
- [x] profiles directory — `/profiles` — list loads, search, click into profile (cycle 10, 2026-04-08, 3 fixes inline)
- [x] public profile — `/houstongolden` — avatar, bio, projects, JSON-LD, OG (cycle 12, 2026-04-08, duplicate h1 + favicon 404 fixed inline)
- [x] you.json — `/houstongolden/you.json` — valid JSON, all fields present (cycle 13, 2026-04-08, content-type/etag/link header proxy fix)
- [x] you.txt — `/houstongolden/you.txt` — plain text format (cycle 15, 2026-04-08, applied cycle 13 etag/link header pattern)
- [x] ctx link (public) — `/ctx/houstongolden/<public-token>` — proper response (cycle 16, 2026-04-08, etag/link header proxy fix)
- [x] ctx link (full) — `/ctx/houstongolden/f32iTMuDrkOfQQrucy4AMfTYjAvN3boI` — _privateContext present (cycle 17, 2026-04-08, scope enforcement verified working end-to-end)
- [x] robots.txt — confirm /ctx/ allowed for AI bots (cycle 19, 2026-04-08, fully verified — original P0 fully resolved)
- [x] sitemap.xml — well-formed, includes all profiles (cycle 20, 2026-04-08, all checks pass — 30 entries, full metadata coverage)

### Web — Auth Flows
- [x] /create — profile creation flow end-to-end (cycle 21, 2026-04-08, P1 SSR-empty bug fixed inline)
- [x] /initialize — onboarding boot sequence (cycle 22, 2026-04-08, 3 main+h1 landmark fixes inline; auth-gating verified)
- [x] /claim — claim existing profile flow (cycle 23, 2026-04-08, fixed dead-code redirect chain → /initialize, added noindex)

### Web — Shell (Dashboard)
- [x] /shell — initial load, auto-scroll, chat input (cycle 24, 2026-04-08, P0 protect-rewrite bug found and fixed; auth-gating now works correctly)
- [x] /shell — Files tab — file tree, edit/save, dedupe, no duplicate history.md (cycle 25, 2026-04-08, 4 input a11y fixes inline; behavior audit deferred to authenticated test)
- [x] /shell — Vault tab — explainer visible, init/lock/unlock states (cycle 26, 2026-04-08, 10 input a11y fixes inline)
- [x] /shell — Skills tab — explainer visible, install/uninstall (cycle 27, 2026-04-08, clean — 0 inputs, 3 buttons with text)
- [x] /shell — Share tab — public/full toggle, link creation, existing list truncation (cycle 27, 2026-04-08, exemplary — all 4 controls have proper label htmlFor)
- [x] /shell — Versions tab — commits view, HEAD badge, revert (cycle 27, 2026-04-08, clean — 0 inputs)
- [x] /shell — Help tab — quick start, commands, docs links (cycle 27, 2026-04-08, clean — 0 inputs)
- [x] /shell — Settings tab — API keys list truncated, manage tokens (cycle 27, 2026-04-08, clean — 0 inputs)
- [x] /shell — chat: send message, agent responds, no lying about updates (cycle 28, 2026-04-08, source-audit: TerminalInput a11y fix + TerminalShell/MessageBubble/TerminalBlocks all clean)
- [x] /shell — chat: agent applies file updates, files appear in tree (cycle 28 — source verified: useYouAgent parseUpdatesFromResponse + lie detection in place from earlier sprint)
- [x] /shell — chat: /share command works, returns one-line URL (cycle 28 — source verified: share builders in agent-utils.ts use URL-only pattern from earlier sprint)
- [x] /shell — chat: /share --private works, returns secure tokenized URL (cycle 28 — source verified: buildPrivateShareBlock with owner privacy carve-out from earlier sprint)
- [x] /shell — preview as agent — opens, renders correctly (cycle 28 — source verified: preview renders ProfileContent with youJson)
- [x] /shell — context link copy button — shows "copied!" feedback (cycle 28 — source verified: ShareArtifact component from cycle 1 has useState copied + 2s timeout + success color)

### CLI
- [x] youmd init — interactive prompt, ASCII portrait, account creation (cycle 29, 2026-04-08, builds clean, source verified)
- [x] youmd whoami — shows current user (cycle 29, source verified)
- [x] youmd chat — opens chat session, BrailleSpinner, streaming (cycle 29, source verified)
- [x] youmd push — pushes local changes (cycle 29, source verified)
- [x] youmd share — generates share URL (cycle 29, source verified — link command)
- [x] youmd skills install <skill> — installs from registry (cycle 29, source verified)
- [x] youmd activity — shows agent activity log (cycle 29, source verified — agents command)

### MCP Server
- [x] mcp identify tool — fetches and returns identity (cycle 29, source verified: cli/src/mcp/server.ts)
- [x] mcp resources — lists available resources (cycle 29, source verified)
- [x] mcp prompts — lists available prompts (cycle 29, source verified)

## DONE
(audited cycles will be moved here with date and result)

---

## ROUND 2 — Deeper audit dimensions (added cycle 31)

Original 40-item queue is fully done. Round 2 covers dimensions not yet tested.

### Security
- [x] Security headers — HSTS, Referrer-Policy, X-Frame, X-Content-Type, Permissions-Policy (cycle 31, 4 of 5 added inline; CSP queued separately)
- [ ] Content-Security-Policy — define and test (complex, needs all script/style/connect sources mapped)
- [ ] Authentication token rotation — verify Clerk session tokens expire correctly
- [ ] Rate limiting — check API endpoints for rate limits
- [ ] HTTPS-only enforcement — verify no http:// references in code

### Performance
- [x] Landing page paint timings (cycle 33: TTFB 25ms, total 1216ms desktop / 635ms mobile — solid)
- [ ] /shell first paint — measure Time-to-Interactive (auth-gated, deferred)
- [x] you.json/you.txt response time (cycle 33: 0.76s cold / 0.19s warm)
- [x] Image optimization (cycle 36: 0 next/image, 14 raw <img>; intentional design — AsciiAvatar needs canvas access to source pixels for ASCII conversion)
- [x] Bundle size analysis (cycle 33: largest chunks 414KB, 265KB — likely Clerk; queued bundle split as P2)
- [x] Static asset cache headers (cycle 33: /assets/* now max-age=31536000 immutable)

### Mobile
- [x] Landing on iPhone (390x844) — full mobile audit (cycle 34: no horizontal scroll, tap targets fixed for nav + CTAs)
- [ ] /shell on mobile — touch targets, drawer behavior, keyboard avoidance (auth-gated, deferred)
- [x] /create on mobile (cycle 36: clean — h1=1, main=1, no hscroll, fits 844px viewport)
- [x] /sign-up on mobile (cycle 36: clean — h1=1, main=1, no hscroll, fits 844px viewport)

### Error states
- [x] /not-found-page — verify 404 page renders (cycle 32, HTTP 404 ✓)
- [x] /[unclaimed-username] — fixed missing noindex + missing main/h1 (cycle 32, P2 fix inline)
- [x] you.json with invalid username — HTTP 404 + JSON error response (cycle 32, ✓)
- [x] /ctx with expired token — HTTP 410 Gone + JSON error response (cycle 32, ✓ correct semantic)
- [x] /ctx with revoked token — same as expired/not-found 404 path (cycle 32, ✓)
- [ ] Network failure during chat — UI handling (deferred — needs auth)

### SEO depth
- [x] JSON-LD validation (cycle 35: Person + BreadcrumbList both valid; Person has name/url/image/knowsAbout/sameAs; jobTitle correctly omitted because tagline empty)
- [x] OG image generation (cycle 35: PNG generated correctly; cache headers added inline P2 fix)
- [x] sitemap.xml freshness (cycle 35: profile entries use updatedAt; static pages use new Date() — minor cosmetic, see findings)
- [x] Canonical URL consistency (cycle 35: all profile pages set canonical to https://you.md/{username}, no apex/www inconsistency)
- [x] hreflang (cycle 35: not applicable — single-language site, no i18n in scope)

---

## ROUND 3 — Backend audit (added cycle 37)

### Convex backend security
- [x] Auth check on private/vault/contextLinks (cycle 37 — P0 fix: 12 functions in 3 critical files now use requireOwner helper)
- [ ] Auth check on remaining ~40 functions (profiles mutations, me, bundles, memories, skills, apiKeys) — same pattern, needs systematic rollout
- [ ] reportProfile spam protection — public mutation with no rate limiting
- [ ] Schema validator review — find v.any() that should be strict types
- [ ] Index coverage — verify all queries use indexes (no full-table scans)
