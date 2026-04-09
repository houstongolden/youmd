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

### [P2] Other auth forms (sign-in, create, reset-password) need same TerminalAuthInput a11y treatment (cycle 5)
- Files: `src/app/sign-in/[[...sign-in]]/page.tsx`, `src/app/create/create-content.tsx`, `src/app/reset-password/reset-content.tsx`
- Issue: TerminalAuthInput has been extended with optional autoComplete/inputMode/name/ariaLabel props (cycle 5), but only sign-up was updated to pass them. Other call sites still rely on the defaults (autoComplete="off", no inputMode, ariaLabel falls back to placeholder).
- Fix: For each call site, pass per-field config (email → type=email + autoComplete=email + inputMode=email; password → autoComplete=current-password or new-password; verification code → autoComplete=one-time-code + inputMode=numeric; etc)
- Why P2: Same screen-reader, autofill, and mobile-keyboard issues that cycle 5 fixed for sign-up. Lower priority than sign-up because the affected forms are less central.
- Found by: cycle 5 audit of /sign-up

## DONE

### [P1] /sign-up email field had 4 a11y/UX bugs — cycle 5, 2026-04-08
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
