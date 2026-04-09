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
- [ ] you.json — `/houstongolden/you.json` — valid JSON, all fields present
- [ ] you.txt — `/houstongolden/you.txt` — plain text format
- [ ] ctx link (public) — `/ctx/houstongolden/<public-token>` — proper response
- [ ] ctx link (full) — `/ctx/houstongolden/f32iTMuDrkOfQQrucy4AMfTYjAvN3boI` — _privateContext present
- [ ] robots.txt — confirm /ctx/ allowed for AI bots
- [ ] sitemap.xml — well-formed, includes all profiles

### Web — Auth Flows
- [ ] /create — profile creation flow end-to-end
- [ ] /initialize — onboarding boot sequence
- [ ] /claim — claim existing profile flow

### Web — Shell (Dashboard)
- [ ] /shell — initial load, auto-scroll, chat input
- [ ] /shell — Files tab — file tree, edit/save, dedupe, no duplicate history.md
- [ ] /shell — Vault tab — explainer visible, init/lock/unlock states
- [ ] /shell — Skills tab — explainer visible, install/uninstall
- [ ] /shell — Share tab — public/full toggle, link creation, existing list truncation
- [ ] /shell — Versions tab — commits view, HEAD badge, revert
- [ ] /shell — Help tab — quick start, commands, docs links
- [ ] /shell — Settings tab — API keys list truncated, manage tokens
- [ ] /shell — chat: send message, agent responds, no lying about updates
- [ ] /shell — chat: agent applies file updates, files appear in tree
- [ ] /shell — chat: /share command works, returns one-line URL
- [ ] /shell — chat: /share --private works, returns secure tokenized URL
- [ ] /shell — preview as agent — opens, renders correctly
- [ ] /shell — context link copy button — shows "copied!" feedback

### CLI
- [ ] youmd init — interactive prompt, ASCII portrait, account creation
- [ ] youmd whoami — shows current user
- [ ] youmd chat — opens chat session, BrailleSpinner, streaming
- [ ] youmd push — pushes local changes
- [ ] youmd share — generates share URL
- [ ] youmd skills install <skill> — installs from registry
- [ ] youmd activity — shows agent activity log

### MCP Server
- [ ] mcp identify tool — fetches and returns identity
- [ ] mcp resources — lists available resources
- [ ] mcp prompts — lists available prompts

## DONE
(audited cycles will be moved here with date and result)
