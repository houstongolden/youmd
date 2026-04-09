# You.md QA Audit Findings Log

Each cycle appends a `## Cycle N — <area> — <date>` block.
Issues found go BOTH here (with full context) AND to `audit/improvements.md` (as actionable TODOs).

---

## Cycle 1 — Landing page (/) — 2026-04-08 16:48 UTC

**Tool:** /browse skill (real Chromium), desktop 1440x900 + mobile 390x844
**Status:** DONE_WITH_FINDINGS (3 fixed inline, 3 queued for follow-up cycles)

### What was tested
- Page load (HTTP 200, no console errors, no failed network requests)
- Page structure (12 sections, 11626px desktop / 13364px mobile, no horizontal scroll)
- All 45 interactive elements catalogued via accessibility tree
- Pricing section content visual review
- FAQ accordion behavior (programmatic click test — works correctly, no navigation)
- Hero section structure
- Mobile rendering at 390x844 viewport
- Page semantics (h1/h2/main/nav/footer/header/img alt)
- Title and meta description

### Issues found

**P1 — `&check;` rendered as literal `&amp;check;` text in pricing**
- File: `src/components/landing/Pricing.tsx:49-55`
- Cause: JSX does not decode the HTML5 `&check;` named entity (it only decodes basic entities like `&amp;`, `&lt;`, `&gt;`, `&rsaquo;`). React then escapes the `&` and renders the string as text.
- Visual impact: 7 lines in the Free plan card showed "&check; Full identity context via CLI or web" instead of "✓ Full identity context via CLI or web"
- **STATUS: FIXED inline** — replaced all `&check;` with `✓` Unicode character

**P2 — Hero background ASCII pattern not hidden from screen readers**
- File: `src/components/landing/Hero.tsx:109-114`
- Cause: 18,600 character decorative background pattern (300 repeats of `$@B%8&#*oahkbdpqwm...`) is in a `<p>` with `opacity-[0.02]` but no `aria-hidden`
- Impact: Screen readers will read 18,600 chars of garbage as page content
- **STATUS: FIXED inline** — added `aria-hidden="true"` and `role="presentation"` to wrapper div

**P2 — FAQ buttons missing `type="button"`, `aria-expanded`, `aria-controls`**
- File: `src/components/landing/FAQ.tsx:61-75`
- Cause: `<button>` defaults to `type="submit"` in HTML. While there's no parent form here so it doesn't actually navigate, this is fragile and incorrect. Also missing standard accordion ARIA attributes.
- Impact: Accessibility — screen readers can't announce expand/collapse state
- **STATUS: FIXED inline** — added `type="button"`, `aria-expanded={isOpen}`, `aria-controls`, and `id` on the answer panel

**P0 — Landing page has 0 `<h1>` elements**
- File: `src/components/landing/Hero.tsx` (PixelYOU is rendered as DIV/spans not h1)
- Impact: Critical SEO issue. Search engines won't know what the page is about. Screen readers can't navigate by heading.
- **STATUS: queued to improvements.md**

**P1 — Landing page has 0 `<main>` element**
- Cause: Page wraps content in plain `<div>` not `<main>`
- Impact: Missing landmark for screen readers, broken "skip to main content" pattern
- **STATUS: queued to improvements.md**

**P1 — Landing page has only 1 `<h2>` element across 12 sections**
- Cause: Section titles like "-- the network --" are wrapped in `<p>` not `<h2>`
- Impact: Broken heading hierarchy, screen readers can't skim sections
- **STATUS: queued to improvements.md**

### What worked correctly
- HTTP 200, no console errors
- All images have alt text (1/1)
- Title + meta description are good
- 1 nav, 1 footer (correct)
- No horizontal scroll on mobile
- FAQ accordion expand/collapse works (despite missing ARIA)
- Pricing Pro plan `&rsaquo;` (›) renders correctly
- Hero PixelYOU renders on both desktop and mobile
- Featured profile cards render correctly
- Section content all loads (no missing/broken sections)

### Numbers
- Page height desktop: 11626px (12 sections, ~970px avg)
- Page height mobile: 13364px
- Network requests: all 200 (no failed)
- Console errors: 0

---

## Cycle 2 — Fix P0: missing h1 on landing — 2026-04-08 16:56 UTC

**Tool:** Edit + tsc
**Status:** DONE — fix applied, type-check passes

### What was done
Wrapped the PixelYOU visual in `<motion.h1>` with screen-reader-only text:

```tsx
<motion.h1 ... className="mb-6">
  <span className="sr-only">you.md — identity context protocol for the agent internet</span>
  <span aria-hidden="true">
    <PixelYOU />
  </span>
</motion.h1>
```

The visual pixel "YOU" is now decorative (aria-hidden) and the h1 has semantic
text for SEO and screen readers. Tailwind v4 ships `sr-only` as a built-in utility.

### Verification
- Type-check: PASS (`npx tsc --noEmit` clean)
- Live verification deferred to next cycle (after Vercel deploy)

### Cycle bookkeeping
- Picked: top P0 from improvements.md
- Moved to DONE in improvements.md
- Lock held throughout

## Cycle 3 — Fix P1: missing main landmark on landing — 2026-04-08 17:00 UTC

**Tool:** Edit + tsc + browse (verification of cycle 2)
**Status:** DONE — fix applied, type-check passes, cycle 2 h1 verified live

### What was done

1. **Fix applied:** wrapped all 12 landing page section components in `<main id="main">`
   in `src/app/page.tsx`. Navbar stays outside main (correct landmark structure).

2. **Verified cycle 2 fix is live on production:**
   - Browsed to https://you.md/ (real Chromium)
   - h1 count: 1 (was 0)
   - h1 text: "you.md — identity context protocol for the agent internet" ✓
   - sr-only working correctly (text in DOM, not visually rendered)

### Verification
- Type-check: PASS (`npx tsc --noEmit` clean)
- Production verification of cycle 2: PASS (h1 live on you.md)
- Cycle 3 main landmark verification: deferred to next cycle (after Vercel deploy)

### Cycle bookkeeping
- Picked: top P1 from improvements.md (after cycle 2 cleared the P0)
- Moved to DONE in improvements.md
- Cycle 2 entry annotated with "VERIFIED LIVE" tag
- Lock held throughout
