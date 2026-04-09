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

## Cycle 4 — Fix P1: section title h2 hierarchy — 2026-04-08 17:10 UTC

**Tool:** Edit (9 files) + tsc + browse (verification of cycle 3)
**Status:** DONE — all section titles converted, type-check passes, cycle 3 main verified live

### What was done

1. **Verified cycle 3 fix is live on production:**
   - h1 count: 1 (still good from cycle 2)
   - main count: 1 (was 0 — cycle 3 fix is live ✓)

2. **Converted 9 section title `<p>` elements to `<h2>`:**
   - Pattern was identical across all sections — same classes, same dash-decorated style
   - Visual unchanged (className kept verbatim, just changed tag p → h2)
   - Pre-existing 1 h2 in ForDevelopers.tsx ("for AI builders") plus the 9 new = 10 total h2 on landing

### Verification
- Type-check: PASS (`npx tsc --noEmit` clean across 9 file edits)
- Production verification of cycle 3: PASS (main landmark live on you.md)
- Cycle 4 h2 count verification: deferred to next cycle (after Vercel deploy)

### Cycle bookkeeping
- Picked: top P1 from improvements.md (last one)
- improvements.md TODO list: now EMPTY for landing page
- Cycle 3 entry annotated with "VERIFIED LIVE" tag
- Lock held throughout
- **Next cycle will move to queue.md item 2: /sign-up flow audit** (no more landing improvements left)

## Cycle 5 — Audit /sign-up flow — 2026-04-08 17:20 UTC

**Tool:** /browse skill (real Chromium), desktop 1440x900
**Status:** DONE_WITH_FINDINGS — 4 a11y bugs found, all fixed inline

### What was tested
- Page load (HTTP 200 after 307 redirect to www.you.md, all 30+ assets load)
- Console errors (none)
- Boot animation timing (~5s before form renders)
- Form rendering after boot
- Email input accessibility attributes (aria-label, autoComplete, type, inputMode, name)
- Submit button (already correct)
- Cycle 4 verification on production

### Cycle 4 verification (passed)
- h1Count: 1 ✓ (cycle 2 fix live)
- h2Count: 10 ✓ (cycle 4 fix live, was 1)
- main: 1 ✓ (cycle 3 fix live, was 0)

### Issues found on /sign-up

**P1 — Email input has no accessible name**
- File: `src/components/terminal/TerminalAuthInput.tsx`
- Inspection result: `ariaLabel: null, hasMatchingLabel: false, id: ""`
- Impact: Screen readers will announce as generic "edit" or "input" instead of "email address"
- **STATUS: FIXED** — TerminalAuthInput now accepts ariaLabel prop with placeholder fallback

**P1 — Email input is `type="text"` not `type="email"`**
- Same file
- Inspection result: `type: "text"`
- Impact: Mobile users get text keyboard instead of email keyboard. No browser-level validation. No autofill hint.
- **STATUS: FIXED** — TerminalAuthInput type prop extended to accept "email"/"tel"; sign-up email step now passes type="email"

**P2 — Email input has `autoComplete="off"` (hardcoded)**
- Inspection: `autocomplete: "off"`
- Impact: Password managers (1Password, iCloud Keychain, etc) can't autofill or save credentials
- **STATUS: FIXED** — TerminalAuthInput now accepts autoComplete prop; sign-up passes "email", "new-password", "username", "one-time-code" per step

**P2 — Email input has no `name` attribute**
- Inspection: `name: ""`
- Impact: Form data has no key, password managers struggle to save credentials
- **STATUS: FIXED** — TerminalAuthInput now accepts name prop; sign-up passes "email", "new-password", "username", "verification-code" per step

**Bonus fix — `>` prompt span was announced by screen readers**
- The decorative `>` chevron in the terminal-style prompt was being read by screen readers
- **STATUS: FIXED** — added `aria-hidden="true"` to the span

### What worked correctly
- Submit button has `type="button"` ✓ and `aria-label="Submit"` ✓
- `enterKeyHint="send"` ✓ (good mobile UX)
- `spellCheck={false}` ✓ (correct for technical input)
- Custom Clerk wrapper with terminal aesthetic — unique, on-brand
- Boot sequence animation works
- All assets load (Clerk JS, fonts, chunks)
- 0 console errors

### Side effects
- TerminalAuthInput is shared by 4 other pages (sign-in, create, reset-password, and the component itself).
- Backwards compatible: all new props are optional, defaults preserve existing behavior.
- Other call sites still need per-field config to get the same a11y win — queued in improvements.md as P2 for future cycles.

### Numbers
- Network requests on /sign-up: 30+, all 200
- Console errors: 0
- Boot animation: ~5s
- Form fields: 1 input + 1 button

## Cycle 6 — Fix P2: sign-in/create/reset-password a11y — 2026-04-08 17:30 UTC

**Tool:** Edit (3 files) + tsc + browse (verification of cycle 5)
**Status:** DONE — all 3 remaining auth forms updated, cycle 5 verified live

### What was done

1. **Verified cycle 5 fix is live on production:**
   - /sign-up email input: `type=email, name=email, ariaLabel="email address", autocomplete=email, inputMode=email` ✓
   - All 4 cycle 5 fixes confirmed in production

2. **Applied stepFieldConfig pattern to 3 remaining auth forms:**

   **sign-in** (3 fields):
   - email: type=email, autoComplete=email, inputMode=email, name=email, ariaLabel="email address"
   - password: type=password, autoComplete=current-password (NOT new-password — this is sign-in), name=current-password, ariaLabel="password"
   - verify: type=text, autoComplete=one-time-code, inputMode=numeric, name=verification-code, ariaLabel="verification code"

   **create** (6 fields):
   - username: autoComplete=username, name=username
   - name: autoComplete=name, name=name
   - social: autoComplete=off, name=social-handle (off because there's no semantic autocomplete for "x or github username")
   - email: type=email, autoComplete=email, inputMode=email
   - password: type=password, autoComplete=new-password (this IS sign-up flow)
   - verify_code: autoComplete=one-time-code, inputMode=numeric

   **reset-password** (4 fields):
   - email: type=email, autoComplete=email, inputMode=email
   - code: autoComplete=one-time-code, inputMode=numeric
   - new-password: autoComplete=new-password
   - confirm-password: autoComplete=new-password (intentionally same — both are the new password)

### Verification
- Type-check: PASS (`npx tsc --noEmit` clean across 3 file edits)
- Production verification of cycle 5: PASS (all 4 a11y attributes correct on /sign-up email input)
- Cycle 6 verification: deferred to next cycle (will check /sign-in, /create, /reset-password each have correct a11y)

### Critical insight
- TerminalAuthInput is now used correctly across ALL 4 auth flows
- 16 input fields total (1 sign-up email + 3 sign-in + 6 create + 4 reset + 1 sign-up password + 1 sign-up username + 1 sign-up verify) all now have proper type, autoComplete, inputMode, name, and ariaLabel
- improvements.md TODO is now empty — next cycle moves to queue.md item 3 (/sign-in audit) which will independently verify the sign-in fixes via real Chromium

### Cycle bookkeeping
- Picked: top P2 from improvements.md (only item)
- Moved to DONE in improvements.md
- Cycle 5 entry annotated with "VERIFIED LIVE" tag
- Lock held throughout

## Cycle 7 — Audit /sign-in flow — 2026-04-08 17:40 UTC

**Tool:** /browse skill (real Chromium), desktop 1440x900
**Status:** DONE_WITH_FINDINGS — cycle 6 verified live + 1 new P1 found across all 4 auth pages, all fixed inline

### What was tested
- /sign-in page load (200, 0 console errors)
- Boot animation (~5s, same as sign-up)
- Email field a11y attributes (verifying cycle 6 fix)
- Password step a11y attributes (after typing email + clicking submit)
- ALL 4 auth pages checked for h1/h2/main (sign-in, sign-up, create, reset-password)

### Cycle 6 verification (PASSED)
**/sign-in email step:**
- type=email ✓
- name=email ✓
- ariaLabel="email address" ✓
- autocomplete=email ✓
- inputMode=email ✓

**/sign-in password step (after typing email + clicking submit):**
- type=password ✓
- name=current-password ✓ (correctly NOT new-password — this is sign-in)
- ariaLabel="password" ✓
- autocomplete=current-password ✓ (correctly NOT new-password)

Cycle 6 password step transition works correctly across the boot animation.

### New issue found and fixed inline

**P1 — All 4 auth pages have 0 h1, 0 h2, 0 main**
- Pages: /sign-in, /sign-up, /create, /reset-password
- Same SEO/a11y issue cycles 2-4 fixed for the landing page
- Inspection showed: `{h1:0, h2:0, main:0}` for every single page
- Impact: critical SEO (search engines have no semantic page title), broken screen-reader navigation, missing main landmark for "skip to content" pattern
- **STATUS: FIXED inline in cycle 7** — see DONE block in improvements.md

### Verification
- Type-check: PASS
- Cycle 7 verification of new fixes: deferred to next cycle (after Vercel deploy)

### Cycle bookkeeping
- Initially planned audit-only
- Reverted to audit + inline fix when the missing h1 was found (consistent with cycles 1-4 pattern)
- 5 file edits: TerminalHeader (component), sign-up, sign-in, reset-password, create
- Lock held throughout

### Numbers
- Console errors: 0 (all 4 auth pages)
- Boot animation: ~5s on sign-in (same as sign-up)
- Network requests: 30+ on /sign-in, all 200

## Cycle 8 — Audit /docs page — 2026-04-08 17:50 UTC

**Tool:** /browse skill (real Chromium), desktop 1440x900
**Status:** DONE_WITH_FINDINGS — 1 P1 + 1 P2 found, P1 fixed inline, P2 queued. Cycle 7 verified live on all 4 auth pages.

### What was tested
- Page load (200, 0 console errors)
- Page semantics (h1, h2, h3, main, nav, footer, links, code blocks)
- Heading hierarchy and IDs (for deep-linking)
- TOC structure (aside + nav)
- Cycle 7 verification on all 4 auth pages

### Cycle 7 verification (PASSED — all 4 auth pages)
- /sign-in: h1=1 "you.md — authenticate", main=1 ✓
- /sign-up: h1=1 "you.md — initialize", main=1 ✓
- /create: h1=1 "you.md — create", main=1 ✓
- /reset-password: h1=1 "you.md -- reset password", main=1 ✓

All 4 auth pages now have proper h1 + main landmark.

### /docs metrics (mostly excellent)
- h1=1 "you.md" ✓
- h2=10 ✓ (Getting Started, Claude Code Integration, Share Your Identity, Sync, CLI Reference, Skills, Agent Directives, API, Privacy, Dashboard Commands)
- h3=17 ✓
- main=1 ✓
- nav=1 (TOC sidebar) ✓
- All 27 headings have IDs ✓ (perfect for deep-linking)
- Page height: 15155px (long but expected)
- Code blocks: 67
- Console errors: 0
- Title: "Documentation — you.md" ✓
- No horizontal scroll on desktop

### Issues found

**P1 — /docs sidebar TOC uses 27 BUTTONS instead of anchor links**
- File: `src/app/docs/docs-content.tsx:317-361` (Sidebar component)
- Inspection: `nav.linkCount: 0, nav.buttonCount: 27`
- Impact: docs TOC was unusable for normal browser navigation patterns:
  - Right-click "copy link" doesn't work
  - Middle-click / cmd-click to open in new tab doesn't work
  - Can't bookmark or share specific docs sections
  - Buttons-as-navigation is an a11y antipattern (axe DevTools would flag this)
- **STATUS: FIXED inline** — converted to <a href="#id"> with click handler that preserves smooth scroll AND lets the browser handle modified clicks. Also added aria-label to the nav and aria-current to the active item.

**P2 — /docs has no <footer> landmark**
- Inspection: `footer: 0`
- Impact: incomplete landmark set; minor a11y issue
- **STATUS: queued to improvements.md**

### Verification
- Type-check: PASS (1 file edit)
- Cycle 7 verification: PASS (all 4 auth pages)
- Cycle 8 fix verification: deferred to next cycle (after Vercel deploy)

### Cycle bookkeeping
- Picked: queue.md item 4 (/docs)
- Found: 1 P1 (fixed inline) + 1 P2 (queued)
- Cycle 7 entry annotated with "VERIFIED LIVE" tag
- Lock held throughout

### Numbers
- /docs network requests: all 200
- /docs console errors: 0
- /docs h1 / h2 / h3 / main / nav: 1 / 10 / 17 / 1 / 1
- /docs heading IDs coverage: 27/27 (100%)
- Cycle 7 auth h1 verification: 4/4 pages pass
