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

### [P2] /profiles directory had no footer landmark — cycle 11, 2026-04-08
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
