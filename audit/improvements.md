# You.md Actionable Improvements

Each cycle that finds issues appends them here as `## TODO` items, top-to-bottom by severity.
Fix cycles pull from the top.

When an item is fixed, move it to `## DONE` with date + commit SHA.

Severity:
- **P0** — broken, blocks core flow
- **P1** — visible bug, broken UX
- **P2** — polish, minor friction
- **P3** — nice-to-have

## TODO
(empty — all known improvements cleared)


## DONE

### [P0] CLI HTTP routes broken by cycle 42 strict requireOwner + 2 NEW P0s in pipeline/index.ts — cycle 43, 2026-04-09
- **Cycle 42 follow-up:** all `/api/v1/me/*` httpAction routes were rejecting valid API-key callers because the inner mutation's `ctx.auth.getUserIdentity()` is null in httpAction context.
- **NEW P0 found mid-cycle:** `convex/pipeline/index.ts` `startPipeline` and `getPipelineStatus` had ZERO auth — same shape as the cycle 42 data leak. Anyone could kick off a $-billing LLM pipeline for any user, or read any user's pipeline status. Missed by cycles 37/38 because the audit didn't sweep `convex/pipeline/`.
- **Fix:** added a server-side-only `TRUSTED_INTERNAL_AUTH_TOKEN` Convex env var (256-bit random secret). `requireOwner` accepts an optional `internalAuthToken` arg that bypasses Clerk JWT check IFF it equals the env var (constant-equality, server-side only). HTTP routes pass `process.env.TRUSTED_INTERNAL_AUTH_TOKEN` as `_internalAuthToken` in mutation/query args. ~40 protected functions in 9 files now accept the optional bypass arg. Pipeline functions also got `requireOwner` for the first time.
- **Verification:**
  - Anonymous read of private data: BLOCKED ✓
  - Anonymous read with WRONG token: BLOCKED ✓
  - Anonymous startPipeline: BLOCKED ✓
  - HTTP route with valid API key: SUCCEEDS (returned 49-bundle history for Houston) ✓
  - HTTP route with revoked API key: 401 ✓
- **Trade-off:** the bypass is a shared secret (less elegant than internalMutation isolation), but it's:
  1. Server-side only (Convex env var, never in client bundles, never logged)
  2. 256 bits of entropy (effectively unguessable)
  3. Constant-equality validated against env var
  4. Minimum 32-char length check before validation
  5. Touches ~40 functions vs the ~80 touches of an internalMutation refactor
- Commit: 5063a4d

### [P3] FilesPane had 4 inputs missing aria-label/name — cycle 25, 2026-04-08
- File: `src/components/panes/FilesPane.tsx`
- Found by: cycle 25 source audit (FilesPane is auth-gated, can't browse-test directly)
- Issues:
  1. **File editor textarea** (line 360): no aria-label, no name
  2. **New file path input** (line 405): no aria-label, no name, no autoComplete, no spellCheck=false
  3. **New directory name input** (line 461): same as above
  4. **File search input** (line 854): no aria-label, no name, type=text instead of type=search, no autoComplete, no spellCheck=false
- Fix: applied a11y treatment to all 4 inputs:
  - Added `aria-label` describing the field's purpose (e.g. "edit ${file.path}", "new file path", "new directory name (lowercase letters, numbers, dashes only)", "search files by name or path")
  - Added `name` attribute matching field purpose
  - Search input: changed `type="text"` → `type="search"` (better mobile keyboard, native clear button on some browsers)
  - Added `autoComplete="off"` and `spellCheck={false}` to text inputs (technical input — no autofill or spell check)
  - Added `aria-hidden="true"` to the decorative `+` prefix spans (was being announced)
- Why P3: dashboard is auth-gated so screen reader users have already passed auth; lower impact than public-page a11y issues. But still good practice.
- Commit: pending

### [P0] Anonymous /shell, /dashboard, /initialize requests render fake profile page instead of redirecting to sign-in — cycle 24, 2026-04-08 (FULLY VERIFIED LIVE 21:00 UTC)
- **Verified live on all 3 protected routes:**
  - /shell: HTTP 307 → `/sign-in?redirect_url=https%3A%2F%2Fwww.you.md%2Fshell` ✓
  - /dashboard: HTTP 307 → `/sign-in?redirect_url=...%2Fdashboard` ✓
  - /initialize: HTTP 307 → `/sign-in?redirect_url=...%2Finitialize` ✓
- No more `protect-rewrite`, no more `x-matched-path: /[username]`, no more fake `clerk_${Date.now()}` profiles
- The dashboard surface is fully fixed for anonymous users — they're now correctly redirected to sign-in with the original URL preserved

### [P2] /claim had a 3-hop redirect chain after sign-up — cycle 23, 2026-04-08 (VERIFIED LIVE 21:00 UTC)
- **Verified live:** /claim now returns HTTP 307 to /initialize (was /sign-up before cycle 23 fix)
- File: `src/proxy.ts:43-47`
- Found by: cycle 24 audit — `curl /shell` returned HTTP 200 with `x-matched-path: /[username]` and `<title>clerk_${Date.now()} — you.md</title>`. Verified the same bug on /dashboard and /initialize.
- Root cause: `auth.protect()` in Clerk v7 does NOT do a 307 redirect for unauthenticated users. Instead, it does an internal "protect-rewrite" (visible in `x-clerk-auth-reason: protect-rewrite, session-token-and-uat-missing`) that re-routes the request through Next.js's catchall `/[username]` dynamic route. The `[username]` param ends up as a placeholder `clerk_${Date.now()}` so each anonymous visit shows a 'loading...' skeleton with metadata for a non-existent fake profile.
- Impact: P0 — the entire dashboard surface is broken for anonymous users. Visitors see "loading..." indefinitely instead of being prompted to sign in. SEO/social previews for /shell pull metadata for nonexistent `clerk_${timestamp}` profiles.
- Fix: replaced `await auth.protect()` with explicit:
  ```typescript
  const session = await auth();
  if (!session.userId) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("redirect_url", req.url);
    return NextResponse.redirect(signInUrl);
  }
  ```
- Result: anonymous requests to /shell, /dashboard, /initialize now return HTTP 307 to /sign-in?redirect_url={original} (predictable, no rewrites)
- Commit: pending
- Note: cycle 23 /claim fix not yet verified live in this cycle (will verify next cycle along with this one)

### [P2] /claim had a 3-hop redirect chain after sign-up — cycle 23, 2026-04-08
- File: `src/app/claim/page.tsx`
- Found by: cycle 23 audit + grep `/claim` → discovered `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/claim` in `.env.local.example`
- Bug: legacy redirect chain — after a user signs up via Clerk, they land on /claim (per env var), /claim used to `redirect("/sign-up")`, /sign-up sees `isSignedIn=true` and `router.replace("/shell")`. That's **3 redirects** (claim → sign-up → shell) for every newly signed-up user.
- Root cause: /claim was a separate "claim username" page in an earlier version. The functionality was later merged into /initialize but the env var was never updated and the /claim stub kept redirecting to the wrong place.
- Fix:
  1. Changed `redirect("/sign-up")` → `redirect("/initialize")` in `claim/page.tsx`. New users now go directly to the onboarding flow they should see.
  2. Added `robots: { index: false, follow: true }` to the page metadata so search engines don't index the redirect-only stub.
  3. Removed the unnecessary OpenGraph + Twitter card metadata (they were never visible since the page redirects immediately) — kept just title + description for any cached external links.
  4. Added an explanatory comment block at the top documenting the legacy alias status.
- Visible effect: signed-up users now go through 1 redirect (claim → initialize) instead of 3 (claim → sign-up → shell)
- Note: env var `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/claim` could be updated directly to `/initialize` to skip even the legacy /claim hop, but that requires updating Vercel + local .env.local. The redirect fix in /claim/page.tsx is sufficient and doesn't require env changes.
- Commit: pending

### [P2] /initialize had no main + no h1 landmarks across 3 render branches — cycle 22, 2026-04-08
- File: `src/app/initialize/initialize-content.tsx`
- Found by: cycle 22 source audit (page is auth-gated so couldn't browse-test directly — verified via source inspection)
- The page has 3 distinct render branches (loading, boot/claim phase, ready/onboarding) and ALL THREE were:
  1. Wrapping content in `<div>` instead of `<main>` (no main landmark)
  2. Calling `<TerminalHeader title=... />` without `asHeading` so the title rendered as `<span>` not `<h1>` (no h1)
- Note: page has `robots: { index: false, follow: false }` so SEO impact is low, but a11y for logged-in users navigating with screen readers still matters
- Fix: 4 surgical edits
  1. Loading branch: `<div>` → `<main>` wrapper
  2. Boot/claim branch: `<div>` → `<main>` wrapper, added `asHeading` to TerminalHeader
  3. OnboardingTerminal loading branch: `<div>` → `<main>` wrapper
  4. OnboardingTerminal main branch: `<div>` → `<main>` wrapper, added `asHeading` to TerminalHeader
- All 3 branches now render proper h1 + main landmarks
- Commit: pending

### [P1] /create renders empty SSR markup (no h1, no main, no content) — cycle 21, 2026-04-08 (VERIFIED LIVE 20:31 UTC)
- **Verified live via curl:** /create SSR markup now contains `<main>` and `<h1>you.md — create</h1>` — confirmed via `curl https://you.md/create | grep "<h1\|<main"` returning real elements (was empty before)
- File: `src/app/create/create-content.tsx`
- Found by: cycle 21 audit — first eval (no boot delay) returned `h1: 0, main: 0, nav: 0, footer: 0`. After 5500ms boot delay it returned `h1: 1, main: 1`. The semantic landmarks only appear AFTER hydration + boot animation completes.
- Root cause: `if (!publicConvex) return null;` returns `null` on the server because `publicConvex` is `null` when `typeof window === "undefined"`. Search engines and any non-JS crawler see an empty page. SEO-critical: the **profile creation page**, the main onboarding entry point, has zero indexable content.
- Confirmed via direct curl: `curl https://you.md/create | grep "<h1\|<main"` returns nothing.
- Fix: added a `CreateSkeleton` component that mirrors the visible structure of `CreateContentInner` but with no state/effects/Convex provider. Used a `useState(false) + useEffect(() => setMounted(true))` pattern so:
  - SSR renders `<CreateSkeleton>` (h1 + main + "initializing..." text)
  - First client render also renders `<CreateSkeleton>` (matches SSR — no hydration mismatch)
  - useEffect fires after mount, `mounted` becomes true, re-renders with the full `<ConvexProvider><CreateContentInner></ConvexProvider>` tree
- Visible result: same — the skeleton has the same terminal panel chrome and h1 as the live component, so the swap is invisible
- Commit: pending

### [P3] Convex /ctx HTTP route now computes ETag — cycle 18, 2026-04-08 (FULLY VERIFIED LIVE 19:51 UTC)
- File: `convex/http.ts` /ctx route (lines 246-295)
- Found by: cycle 17 (the Next.js proxy was forwarding "whatever upstream sends" and link came through but etag did not — root cause was upstream wasn't sending an etag at all)
- Fix:
  1. Build the JSON body once before responding so we can hash it
  2. Compute etag as `sha256(token + ":" + scope + ":" + body.length + ":" + sha256(body))` — includes scope so public/full variants of the same token never collide
  3. Honor `If-None-Match` → return `304 Not Modified` with ETag header (no body)
  4. Set ETag, Link, and Cache-Control headers on both JSON (200) and markdown (200) responses
  5. Markdown branch now also gets the Link header (was missing before)
- Required: `npx convex deploy` (Convex backend change)
- **End-to-end verification (live):**
  - Upstream Convex /ctx: `etag: "9795d458eacac4e5a3a3966159477c3ebf45c9a900cd01eef49fb1e668c6fd74"` ✓
  - Next.js proxy /ctx/{user}/{token}: same etag forwarded ✓
  - Conditional request with `If-None-Match` matching: returns **HTTP 304** ✓
- Cycle 16 is now **fully verified** since the proxy plumbing has data to forward
- Commit: pending

### [P2] /ctx proxy missing etag, link header, and 304 support — cycle 16, 2026-04-08 (NOW FULLY VERIFIED LIVE 19:51 UTC)
- **Verified live (etag):** /ctx/houstongolden/{token} now serves the upstream etag (cycle 18 made upstream compute one)
- **Verified live (link):** rel="describedby" header present
- All cycle 16 fixes confirmed end-to-end
- File: `src/app/ctx/[...path]/route.ts`
- Found by: cycle 16 audit of public ctx link
- Same fix pattern as cycles 13 and 15 — applied to the /ctx/[username]/{token} proxy route handler:
  - Forward `If-None-Match` from client to upstream
  - Pass through 304 with no body
  - Forward upstream `etag` header
  - Forward upstream `link` rel="describedby" header
  - Add `Access-Control-Allow-Origin` to all error paths
- Default Accept changed from `application/json` to `application/vnd.you-md.v1+json`
- Pre-existing wins on the public ctx link: scope=public, _privateContext correctly absent, no x-clerk-* headers (cycle 14 covered /ctx too), Miami present, Venice gone
- Commit: pending

### [P2] /[username]/you.txt missing etag, link header, and 304 support — cycle 15, 2026-04-08 (VERIFIED LIVE 19:30 UTC)
- **Verified live:** etag set, link rel="describedby" set on /houstongolden/you.txt
- File: `src/app/[username]/you.txt/route.ts`
- Found by: cycle 15 audit — same issues that cycle 13 fixed for you.json
- Fix: applied the same cycle 13 pattern to the you.txt route handler:
  - Forward `If-None-Match` from client to upstream
  - Pass through 304 responses with no body
  - Forward upstream `etag` header
  - Forward upstream `link` rel="describedby" header
  - Add `Access-Control-Allow-Origin` to all error paths
- Content-Type stays `text/plain; charset=utf-8` (correct for plain text/markdown)
- Commit: pending

### [P3] Clerk debug headers leaked on public agent API routes — cycle 14, 2026-04-08 (VERIFIED LIVE 19:28 UTC)
- **Verified live on both endpoints:**
  - /houstongolden/you.json: only content-type + etag headers, NO x-clerk-* headers
  - /houstongolden/you.txt: only content-type, NO x-clerk-* headers
- The matcher exclusion regex worked correctly
- File: `src/proxy.ts:90-96`
- Found by: cycle 13 (`x-clerk-auth-reason: session-token-and-uat-missing`, `x-clerk-auth-status: signed-out` on /[username]/you.json)
- Root cause: `clerkMiddleware()` always runs auth resolution on every matched request and adds those status headers regardless of whether `auth.protect()` is called. The matcher pattern was too permissive (included everything except _next + static files), so Clerk ran on the public agent API endpoints.
- Fix: tightened the middleware matcher to also exclude:
  - `/ctx/...` (already has its own proxy handler, never needs Clerk)
  - `/[username]/you.json`, `/[username]/you.txt`, `/[username]/you.md` (public agent endpoints with their own route handlers)
- The negative lookahead was extended with `ctx/|[^/]+/you\.(?:json|txt|md)$` patterns
- Static assets and other routes still match
- Note: `[username]` route (the visible profile page) still matches because it has no extension — middleware still runs there, which is intentional (it does the agent UA interception logic)
- Commit: pending

### [P2] /[username]/you.json missing content-type, etag, and link header — cycle 13, 2026-04-08 (VERIFIED LIVE 19:24 UTC)
- **Verified live:** content-type=application/vnd.you-md.v1+json, etag set, link header set with schema describedby. All 3 cycle 13 fixes confirmed in production.

### [P1] /houstongolden public profile had duplicate h1 + favicon 404 — cycle 12, 2026-04-08 (PARTIAL VERIFY)
- **h1 fix verified live:** h1=1 (was 2), h2=9 (was 13)
- **favicon 404 fix:** the onError handler does fire and the img DOES disappear, but the underlying HTTP request still happens before onError can run, so the console 404 is logged regardless. This is unavoidable browser behavior — the only way to prevent the console error is to NOT make the request at all (e.g. server-side proxy that returns transparent pixel for 404 domains, or maintain a list of known-favicon-less domains). Decided to accept the harmless console 404 since the visible result is correct (no broken icon).
- File: `src/app/[username]/you.json/route.ts`
- Found by: cycle 13 curl audit
- Issues found:
  1. Content-Type was `application/json` (should be `application/vnd.you-md.v1+json` to match the canonical /api/v1/profiles endpoint and signal it's a structured you-md/v1 doc)
  2. No ETag header (the upstream Convex endpoint computes one — was being dropped by `NextResponse.json()`)
  3. No Link rel="describedby" header (upstream returns this for schema discovery)
  4. No conditional request support (no If-None-Match → 304 path)
- Fix: rewrote the route handler to:
  - Use `new NextResponse(body, ...)` instead of `NextResponse.json(...)` so we control headers explicitly
  - Set `Content-Type: application/vnd.you-md.v1+json`
  - Forward upstream `etag` header
  - Forward upstream `link` header (for schema discovery)
  - Forward client `If-None-Match` header to upstream and pass through 304 responses
  - Add Access-Control-Allow-Origin to all error paths (was missing)
- Commit: pending

### [P1] /houstongolden public profile had duplicate h1 + favicon 404 — cycle 12, 2026-04-08 (PARTIAL VERIFY 18:41 UTC)
- **h1 fix verified live:** h1=1, h1Texts=["Houston Golden"], h2=9 (was 13 — the demoted-h1-to-h2 + bumped-h2s-to-h3 reduced h2 count by 4 as expected)
- **favicon 404 fix:** still showing in console — likely cached / Vercel deploy not finished. Will re-verify next cycle.
- Files: `src/app/[username]/page.tsx`, `src/app/[username]/profile-content.tsx`, `src/components/panes/ProfilePane.tsx`
- Found by: cycle 12 audit — `h1: 2` (both "Houston Golden") + 1 console 404 from favicon proxy
- Fix #1 (duplicate h1): the page renders TWO h1s — one in the visible profile content (correct, canonical) and one in a sr-only "structured data" block at `src/app/[username]/page.tsx:148`. Demoted the sr-only h1 to h2 and bumped its child h2s to h3 to maintain hierarchy. The visible h1 inside profile-content.tsx is now the only h1 on the page.
- Fix #2 (favicon 404): `LinkFavicon` component used Google's favicon proxy (`google.com/s2/favicons?domain=...`) which returns 404 for domains without a favicon (e.g. `bigbounce.hubify.app`). Added `useState` for failure tracking and `onError` handler so the img element disappears silently on 404 instead of showing a broken icon and logging a console error. Also added `aria-hidden="true"` (favicon is decorative) and `loading="lazy"`. Applied to both copies of LinkFavicon (profile-content.tsx and ProfilePane.tsx — they were duplicate code, kept as-is for now since they're rendered in different contexts).
- Commit: pending

### [P2] /profiles directory had no footer landmark — cycle 11, 2026-04-08 (VERIFIED LIVE 18:31 UTC)
- **Verified live:** /profiles now has `footer=1, main=1, h1=1`
- File: `src/app/profiles/profiles-content.tsx:388-411`
- Found by: cycle 10 (`footer: 0`)
- Fix:
  1. Cut the "Bottom CTAs" `motion.div` block out of `<main>`
  2. Wrapped it in a sibling `<footer className="px-6 pb-20">` after `</main>`
  3. Adjusted main padding: `pb-20` → `pb-8` (since the spacing now lives on the footer)
  4. Inner wrapping div with `max-w-[680px] mx-auto` keeps the footer content aligned with the directory list above it
- Visual: identical
- Conditional `!isLoading` preserved on the footer (no footer shown while still loading)
- Commit: pending

### [P1] /profiles directory had no main + search input had no a11y — cycle 10, 2026-04-08 (VERIFIED LIVE 18:21 UTC)
- **Verified live:** main=1, h1=1, searchInput.type=search, searchInput.name=search, searchInput.ariaLabel="search profiles by name, tagline, or location", searchInput.autocomplete=off — all 5 cycle 10 fixes confirmed
- File: `src/app/profiles/profiles-content.tsx:243-405`
- Found by: cycle 10 audit — `main: 0`, search input had `name: "", ariaLabel: null, type: "text"`
- Fixes applied:
  1. **Wrapped content in `<main>`**: changed inner `<div className="pt-8 pb-20 px-6">` to `<main className="pt-8 pb-20 px-6">` (no visual change)
  2. **Search input a11y/UX overhaul**:
     - Changed `type="text"` → `type="search"` (better mobile keyboard, browser-native clear button on some browsers)
     - Added `name="search"`
     - Added `aria-label="search profiles by name, tagline, or location"`
     - Added `autoComplete="off"` (was implicit, now explicit)
     - Added `spellCheck={false}`
     - Added `aria-hidden="true"` to the decorative `>` chevron (was being announced)
- Pre-existing wins: h1=1 ("> ls /profiles"), nav=1, JSON-LD CollectionPage schema, 22 profile cards rendering correctly, search filtering works
- Commit: pending

### [P2] /docs missing footer landmark — cycle 9, 2026-04-08 (VERIFIED LIVE 18:11 UTC)
- **Verified live:** /docs now has `footer: 1, main: 1, h1: 1` (was footer: 0)
- File: `src/app/docs/docs-content.tsx:1252-1267`
- Found by: cycle 8 (`footer: 0` even though there was a div labeled "Footer")
- Root cause: there was already a "Footer" div with copyright + Get Started link, but it was a `<div>` not a `<footer>` AND it was inside `<main>`. Per ARIA spec, `<footer>` only has `contentinfo` role when it is NOT a descendant of main/article/aside/nav/section.
- Fix: moved the footer markup OUT of `<main>` and converted the wrapper from `<div>` to `<footer>`. Adjusted the layout wrapping to align with the docs content column (md:ml-56 to account for the sidebar offset).
- Visual: identical
- Commit: pending

### [P1] /docs sidebar TOC used 27 buttons instead of 27 anchor links — cycle 8, 2026-04-08 (VERIFIED LIVE 18:00 UTC)
- **Verified live:** `navLinkCount: 27, navButtonCount: 0`, aria-label "Documentation table of contents", anchors with `#section-id` href, aria-current="location" working on the active item
- File: `src/app/docs/docs-content.tsx:317-361`
- Found by: cycle 8 audit — `nav.linkCount: 0, nav.buttonCount: 27`
- Impact: docs sidebar TOC was unusable for normal browser navigation:
  - No deep-linking (couldn't bookmark or share a specific section)
  - No copy-link (right-click "copy link address" wouldn't work)
  - No middle-click to open in new tab
  - No browser back/forward navigation between sections
  - Buttons-as-navigation is an a11y antipattern
- Fix: converted both top-level and child Sidebar items from `<button onClick>` to `<a href="#section-id" onClick>` with a click handler that:
  - Lets the browser handle modified clicks (cmd/ctrl/shift/middle-click) so new-tab and copy-link work
  - On normal click, calls `onNav(id)` for smooth scroll AND `window.history.pushState` to update the URL hash
  - Added `aria-current="location"` for the active item
  - Added `aria-label="Documentation table of contents"` to the wrapping `<nav>`
- Pre-existing: all 27 docs section headings already have IDs, so anchor links work natively
- Commit: pending

### [P1] All 4 auth pages had 0 h1 + 0 main — cycle 7, 2026-04-08 (VERIFIED LIVE 17:51 UTC)
- **Verified live on all 4 pages:**
  - /sign-in: h1=1 "you.md — authenticate", main=1
  - /sign-up: h1=1 "you.md — initialize", main=1
  - /create: h1=1 "you.md — create", main=1
  - /reset-password: h1=1 "you.md -- reset password", main=1
- Files: `src/components/terminal/TerminalHeader.tsx`, `src/app/sign-up/[[...sign-up]]/page.tsx`, `src/app/sign-in/[[...sign-in]]/page.tsx`, `src/app/reset-password/reset-content.tsx`, `src/app/create/create-content.tsx`
- Found by: cycle 7 audit checking h1/h2/main on all 4 auth pages — every single page returned `h1: 0, h2: 0, main: 0` (same SEO issue landing had before cycles 2-4)
- Fix:
  1. Extended `TerminalHeader` with optional `asHeading` prop. When true, the title renders as `<h1>` instead of `<span>`. Visual unchanged (same className, font-normal added so h1 default styling doesn't override).
  2. Updated sign-up, sign-in, reset-password to pass `asHeading` to TerminalHeader (3 pages, 1 line each).
  3. Updated create page (which doesn't use TerminalHeader — has inline header) to convert its title `<span>` to `<h1>`.
  4. Wrapped all 4 auth pages' root `<div>` in `<main>`.
  5. Added `aria-hidden="true"` to the decorative red/yellow/green terminal dots in both TerminalHeader and create's inline header.
- Commit: pending

### [P2] sign-in / create / reset-password TerminalAuthInput a11y — cycle 6, 2026-04-08 (VERIFIED LIVE 17:41 UTC)
- **Verified live:** /sign-in inputs at email step and password step both have correct a11y (type=email/password, name=email/current-password, ariaLabel="email address"/"password", autocomplete=email/current-password). Cycle 6's per-step config working correctly across the boot animation transition.
- Files: `src/app/sign-in/[[...sign-in]]/page.tsx`, `src/app/create/create-content.tsx`, `src/app/reset-password/reset-content.tsx`
- Fix: applied the same per-step `stepFieldConfig` / `phaseFieldConfig` map pattern from cycle 5 to all 3 remaining auth forms. Each step now passes correct type/autoComplete/inputMode/name/ariaLabel:
  - **sign-in**: email (type=email, autoComplete=email), password (autoComplete=current-password — note: NOT new-password since this is sign-in not sign-up), verify (one-time-code + numeric)
  - **create**: username, name, social, email, password (new-password), verify_code — 6 fields total
  - **reset-password**: email, code (one-time-code), new-password (autoComplete=new-password), confirm-password (autoComplete=new-password)
- TerminalAuthInput component itself was already updated in cycle 5 (backwards-compatible additions)
- Commit: pending

### [P1] /sign-up email field had 4 a11y/UX bugs — cycle 5, 2026-04-08 (VERIFIED LIVE 17:31 UTC)
- **Verified live:** input on /sign-up has `type=email, name=email, ariaLabel="email address", autocomplete=email, inputMode=email` (all 4 cycle 5 fixes confirmed)
- File: `src/components/terminal/TerminalAuthInput.tsx`, `src/app/sign-up/[[...sign-up]]/page.tsx`
- Bugs found via real Chromium DOM inspection of `/sign-up`:
  1. Email input was `type="text"` (should be `type="email"` for keyboard + validation)
  2. Email input had no `aria-label` (screen readers can't name it; "input" generic)
  3. Email input had `autoComplete="off"` (password managers can't autofill)
  4. Email input had no `name` attribute (form data has no key, password managers can't save credentials)
- Fix:
  - Extended `TerminalAuthInput` with optional `type` (now allows email/tel), `autoComplete`, `inputMode`, `name`, `ariaLabel` props (backwards compatible)
  - Added `aria-label` fallback to placeholder if not specified
  - Added `aria-hidden="true"` on the decorative `>` prompt span (was being announced)
  - Updated `/sign-up` to pass per-step config: email/password/username/verify each get correct type, autoComplete, inputMode, name, ariaLabel
- Commit: pending
- Other auth forms (sign-in, create, reset-password) queued in TODO above

### [P1] Landing page has only 1 h2 across 12 sections — cycle 4, 2026-04-08 (VERIFIED LIVE 17:21 UTC)
- Verified live: `h2Count: 10` (was 1), with all 9 new section title h2s present
- Files: 9 landing components
- Fix: converted all 9 `<p>` section titles to `<h2>` with identical className (visual unchanged):
  - ProfilesShowcase.tsx — "-- the network --"
  - HowItWorks.tsx — "-- how it works --"
  - WhatsInside.tsx — "-- what's inside --"
  - Integrations.tsx — "-- works everywhere --"
  - FAQ.tsx — "-- frequently asked --"
  - Pricing.tsx — "-- pricing --"
  - ProblemStrip.tsx — "-- the problem --"
  - OpenSpec.tsx — "-- open standard --"
  - CTAFooter.tsx — "-- get started --"
- Pre-existing h2 in ForDevelopers.tsx (which is the "for AI builders" h2) brings the total to 10 h2 elements
- Commit: pending

### [P1] Landing page has 0 main element — cycle 3, 2026-04-08 (VERIFIED LIVE 17:10 UTC)
- File: `src/app/page.tsx:39-57`
- Fix: wrapped all 12 section components in `<main id="main">` between Navbar and (no footer at root level — sections include CTAFooter inside main)
- Commit: f54e9fd
- **Verified live:** `main: 1`

### [P0] Landing page has 0 h1 elements — cycle 2, 2026-04-08 (VERIFIED LIVE 16:59 UTC)
- File: `src/components/landing/Hero.tsx:125-131`
- Fix: wrapped PixelYOU in `<motion.h1>` with `sr-only` text "you.md — identity context protocol for the agent internet" and `aria-hidden="true"` on the visual span
- Commit: 2edb941
- **Verified live:** `h1Count: 1, h1Texts: ["you.md — identity context protocol for the agent internet"]`
- File: `src/components/landing/Hero.tsx:125-131`
- Fix: wrapped PixelYOU in `<motion.h1>` with `sr-only` text "you.md — identity context protocol for the agent internet" for screen readers, and `aria-hidden="true"` on the visual PixelYOU span so it's not double-announced
- Commit: pending

### [P1] &check; rendered as literal text in pricing — cycle 1, 2026-04-08
- File: `src/components/landing/Pricing.tsx:49-55`
- Fix: replaced all 7 `&check;` with `✓` Unicode character
- Commit: pending

### [P2] Hero ASCII background pattern not hidden from screen readers — cycle 1, 2026-04-08
- File: `src/components/landing/Hero.tsx:109-114`
- Fix: added `aria-hidden="true"` and `role="presentation"` to wrapper div (18,600 chars no longer announced)
- Commit: pending

### [P2] FAQ buttons missing type="button" + aria-expanded — cycle 1, 2026-04-08
- File: `src/components/landing/FAQ.tsx:61-94`
- Fix: added `type="button"`, `aria-expanded={isOpen}`, `aria-controls={faq-panel-${index}}`, and `id` on answer panel
- Commit: pending
