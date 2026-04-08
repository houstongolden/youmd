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

### [P0] Landing page has 0 h1 elements (cycle 1)
- File: `src/components/landing/Hero.tsx`
- Issue: PixelYOU big "YOU" logo is rendered as DIV/spans, not wrapped in `<h1>`
- Fix: Wrap PixelYOU in an `<h1>` with `sr-only` text "you.md — identity context protocol"
- Why P0: critical SEO issue + a11y. Search engines have no semantic page title, screen readers can't navigate by heading
- Found by: cycle 1 page semantics check (h1Count: 0)

### [P1] Landing page has 0 main element (cycle 1)
- File: `src/app/page.tsx` (or wherever the landing page root is)
- Issue: Sections are wrapped in plain `<div>` not `<main>`
- Fix: Add `<main>` landmark wrapping all content sections (everything between nav and footer)
- Why P1: Missing accessibility landmark, breaks "skip to content" pattern
- Found by: cycle 1 page semantics check (mainCount: 0)

### [P1] Landing page has only 1 h2 across 12 sections (cycle 1)
- Files: `src/components/landing/*.tsx` (each section component)
- Issue: Section titles like "-- the network --", "-- how it works --", "-- pricing --" are wrapped in `<p>` not `<h2>`
- Fix: Convert each section title `<p>` to `<h2>` with the same styling
- Why P1: broken heading hierarchy, screen readers can't skim sections, search engines can't index subtopics
- Found by: cycle 1 page semantics check (h2Count: 1)

## DONE

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
