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
(empty — landing page improvements all cleared)

## DONE

### [P1] Landing page has only 1 h2 across 12 sections — cycle 4, 2026-04-08
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
