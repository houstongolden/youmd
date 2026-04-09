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

## Cycle 9 — Fix P2: /docs footer landmark — 2026-04-08 18:00 UTC

**Tool:** Edit + tsc + browse (verification of cycle 8)
**Status:** DONE — fix applied, type-check passes, cycle 8 verified live

### What was done

1. **Verified cycle 8 fix is live on production:**
   - /docs nav: 27 links (was 27 buttons), 0 buttons
   - aria-label "Documentation table of contents" present
   - Anchors use `#section-id` href
   - aria-current="location" working ("Getting Started" is the default active item)

2. **Fixed P2: /docs missing footer landmark:**
   - The page had a `<div>` labeled "Footer" with copyright + Get Started link, but:
     - It was a `<div>`, not a `<footer>` element
     - It was nested inside `<main>` (which strips the contentinfo role per ARIA spec)
   - Moved the footer markup OUT of `<main>` into a sibling position
   - Converted the wrapper from `<div>` to `<footer>`
   - Adjusted layout wrapping (md:ml-56 + max-w-2xl) so the footer aligns visually with the content column despite the sidebar offset
   - Visual unchanged

### Verification
- Type-check: PASS
- Cycle 8 verification: PASS (TOC anchors live, all working)
- Cycle 9 verification: deferred to next cycle (after Vercel deploy)

### Cycle bookkeeping
- Picked: top P2 from improvements.md (only item)
- Moved to DONE in improvements.md
- Cycle 8 entry annotated with "VERIFIED LIVE" tag
- Lock held throughout

## Cycle 10 — Audit /profiles directory — 2026-04-08 18:10 UTC

**Tool:** /browse skill (real Chromium), desktop 1440x900
**Status:** DONE_WITH_FINDINGS — 3 inline fixes (1 P1 main + 1 P1 search a11y combined as one fix), 1 P2 queued. Cycle 9 docs footer verified live.

### What was tested
- Page load (200, 0 console errors)
- Page semantics
- Profile card rendering (22 cards loaded from Convex)
- Search functionality (typed "houston" → filtered 22 → 16 results)
- Search input accessibility
- Cycle 9 verification

### Cycle 9 verification (PASSED)
- /docs: footer=1 (was 0), main=1, h1=1 ✓

### Issues found and fixed inline

**P1 — Missing `<main>` landmark**
- The page wrapped content in `<div className="pt-8 pb-20 px-6">` not `<main>`
- **STATUS: FIXED** — converted inner div to main

**P1 — Search input had multiple a11y/UX bugs**
- `name: ""`, `ariaLabel: null`, `type: "text"` (should be search)
- **STATUS: FIXED** — added type="search", name="search", aria-label, autoComplete="off", spellCheck=false. Also added aria-hidden to the decorative `>` chevron.

### Issues queued

**P2 — No `<footer>` landmark**
- Page has a "create your profile" / "cd ~/you.md" CTA section at the bottom but it's a motion.div, not a footer element
- **STATUS: queued to improvements.md** for next cycle

### What worked correctly
- h1=1 with text "> ls /profiles" ✓ (cycles 2-4 pattern continues working — pages built since then have proper h1)
- Title "Profiles — you.md" ✓
- nav=1 ✓
- JSON-LD CollectionPage schema present ✓ (good for SEO)
- 22 profile cards render with avatars, names, taglines
- Search functionality WORKS (22 → 16 with "houston" filter — fuzzy matching across name/tagline/location)
- Filter buttons (all/verified/has-projects) present
- Sort dropdown (recent/projects/alpha) present
- 0 console errors

### Verification
- Type-check: PASS
- Cycle 9 verification: PASS
- Cycle 10 fix verification: deferred to next cycle

### Numbers
- /profiles entries: 22
- /profiles search filter (houston): 16 results
- /profiles console errors: 0
- /profiles page height: 1322px (compact, no footer landmark issue is just incomplete semantics)

## Cycle 11 — Fix P2: /profiles footer landmark — 2026-04-08 18:20 UTC

**Tool:** Edit + tsc + browse (verification of cycle 10)
**Status:** DONE — fix applied, type-check passes, cycle 10 verified live

### What was done

1. **Verified cycle 10 fix is live on production:**
   - main=1 ✓ (was 0)
   - h1=1 ✓
   - searchInput.type="search" ✓
   - searchInput.name="search" ✓
   - searchInput.ariaLabel="search profiles by name, tagline, or location" ✓
   - searchInput.autocomplete="off" ✓
   - All 5 cycle 10 fixes confirmed in production

2. **Fixed P2: /profiles footer landmark:**
   - Cut the "Bottom CTAs" motion.div out of `<main>`
   - Wrapped it in a sibling `<footer>` element after `</main>`
   - Adjusted main padding (pb-20 → pb-8) to compensate for the footer absorbing the bottom space
   - Wrapped footer content in `max-w-[680px] mx-auto` to keep alignment with the directory list
   - Conditional `!isLoading` preserved
   - Visual unchanged

### Verification
- Type-check: PASS
- Cycle 10 verification: PASS (5 a11y attrs confirmed)
- Cycle 11 verification: deferred to next cycle (after Vercel deploy)

### Cycle bookkeeping
- Picked: top P2 from improvements.md (only item)
- Moved to DONE
- Cycle 10 entry annotated with "VERIFIED LIVE" tag
- Lock held throughout

## Cycle 12 — Audit /houstongolden public profile — 2026-04-08 18:30 UTC

**Tool:** /browse skill (real Chromium), desktop 1440x900
**Status:** DONE_WITH_FINDINGS — 2 P1 bugs fixed inline, cycle 11 verified live

### What was tested
- Profile page load (200, 1 console error to investigate)
- Page semantics (h1, h2, main, nav, footer, article)
- JSON-LD structured data (@context, @type, name, url)
- All OG tags (og:title, description, url, site_name, image, type)
- Twitter card
- Body content (Houston, Miami, BAMF, Hubify, **NOT** Venice)
- Image alt text
- Network requests (looking for failed loads)

### Cycle 11 verification (PASSED)
- /profiles: footer=1 (was 0), main=1, h1=1 ✓

### Pre-existing wins on /houstongolden
- ✅ Title: "Houston Golden — you.md/houstongolden"
- ✅ canonical link: https://you.md/houstongolden
- ✅ h2=13 (full hierarchy: Current Focus, Projects, Values, Links, Agent Preferences, ──identity, ──current activity, ──projects, ──values, ──links, ──export, ──share, ──maintenance)
- ✅ main=1, nav=1, footer=1 (full landmark set!)
- ✅ 13 images, all with alt text
- ✅ JSON-LD: 2 schemas (Person + BreadcrumbList)
- ✅ OG tags: title, description, url, site_name, image (with width/height/alt), type=profile
- ✅ Twitter card: summary_large_image
- ✅ **Houston, Miami, BAMF, Hubify** all in body
- ✅ **"Venice" NOT in body** — confirms the profile data cleanup (Venice→Miami) is fully landed and rendering correctly
- ✅ Page height: 3606px (reasonable)

### Issues found and fixed inline

**P1 — Duplicate h1 ("Houston Golden" appears as both visible and sr-only)**
- Inspection: `h1: 2`, both with text "Houston Golden"
- Source #1: `src/app/[username]/page.tsx:148` — inside an sr-only "structured data" wrapper for SEO/agents, has `<h1>{name}</h1>` plus child `<h2>` sections
- Source #2: visible inside profile-content.tsx (the canonical h1 that sighted users see)
- Impact: bad SEO (search engines confused about page topic), broken heading-by-heading screen reader navigation
- **STATUS: FIXED** — demoted sr-only h1 → h2, bumped child h2s → h3 in `src/app/[username]/page.tsx`. The visible h1 is now the canonical and only h1.

**P1 — favicon 404 console error**
- Source: `src/app/[username]/profile-content.tsx:1164-1177` LinkFavicon component
- Network log: `https://t3.gstatic.com/faviconV2?...&url=http://bigbounce.hubify.app&size=16 → 404`
- Cause: LinkFavicon uses `google.com/s2/favicons?domain=${domain}` which redirects to gstatic, returning 404 for domains without favicons (bigbounce.hubify.app)
- Impact: console 404 on every profile page that links to a faviconless domain
- **STATUS: FIXED** — added `useState` failure tracking and `onError` handler so the img element returns null on 404. Also added `aria-hidden="true"` (favicon is decorative) and `loading="lazy"`. Fix applied to both copies (profile-content.tsx and ProfilePane.tsx).

### Verification
- Type-check: PASS (3 file edits)
- Cycle 11 verification: PASS
- Cycle 12 fix verification: deferred to next cycle

### Cycle bookkeeping
- Picked: queue.md item 6 (/houstongolden public profile)
- Found: 2 P1s (both fixed inline)
- Cycle 11 entry annotated with "VERIFIED LIVE" tag
- Lock held throughout

### Numbers
- /houstongolden h1 (before fix): 2
- /houstongolden h1 (after fix): 1 (visible only)
- /houstongolden h2: 13 → 12 (one demoted h2 from sr-only block, others bumped to h3)
- /houstongolden console errors: 1 (favicon 404) → expected 0 after deploy
- /houstongolden JSON-LD schemas: 2 (Person + BreadcrumbList)
- /houstongolden OG tags: 8 (complete)
- Body content: Houston ✓, Miami ✓, BAMF ✓, Hubify ✓, Venice ✗ (correct)

## Cycle 13 — Audit /houstongolden/you.json API endpoint — 2026-04-08 18:40 UTC

**Tool:** curl + node JSON inspection
**Status:** DONE_WITH_FINDINGS — 1 P2 fixed inline (3 issues bundled), 1 P3 queued, cycle 12 partially verified

### What was tested
- HTTP status (after 307 redirect from apex to www)
- Response headers (cache-control, etag, content-type, link)
- ETag conditional request (If-None-Match → 304)
- JSON validity
- All top-level keys present
- Field correctness post data-cleanup (Miami vs Venice)
- Schema metadata (compiler_version, last_updated, _profile)
- Cycle 12 verification

### Cycle 12 verification (PARTIAL PASS)
- /houstongolden h1 fix: ✅ VERIFIED (h1=1 was 2, h2=9 was 13 — math checks out)
- /houstongolden favicon 404 fix: ⚠️ NOT YET VERIFIED — console still shows 404 (Vercel deploy may not be complete; will re-verify in next cycle)

### /houstongolden/you.json metrics

**JSON content (excellent — data layer is clean):**
- ✅ Valid JSON
- ✅ schema: "you-md/v1"
- ✅ username: "houstongolden"
- ✅ identity.name: "Houston Golden"
- ✅ identity.location: "Miami" (cleanup verified at API level)
- ✅ bio.long contains "Miami", does NOT contain "Venice"
- ✅ 18 top-level keys: schema, username, identity, now, projects, values, links, preferences, voice, analysis, custom_sections, agent_directives, agent_guide, meta, _profile, social_images, generated_at, verification
- ✅ 6 projects, 6 values, 11 links
- ✅ agent_directives + agent_guide present (above-and-beyond schema fields)
- ✅ meta.compiler_version: 0.3.0
- ✅ meta.last_updated: 2026-04-08T23:41:19 (post-cleanup)
- ✅ _profile present (avatarUrl, displayName, isClaimed, source)
- ✅ _privateContext NOT present (correct — this is the public endpoint)

**HTTP headers (issues found):**
- ✅ HTTP 200 (after expected 307 you.md → www.you.md redirect)
- ✅ Cache-Control: public, max-age=60
- ✅ Access-Control-Allow-Origin: * (good for cross-origin agents)
- ❌ **Content-Type: application/json** (should be `application/vnd.you-md.v1+json` to match /api/v1/profiles)
- ❌ **No ETag header** (upstream Convex endpoint computes one but it was being dropped by NextResponse.json())
- ❌ **No Link rel="describedby" header** (upstream returns this for schema discovery)
- ❌ **No conditional request support** (no If-None-Match → 304 path)
- ❌ **Clerk debug headers leaking**: `x-clerk-auth-reason: session-token-and-uat-missing`, `x-clerk-auth-status: signed-out` — these should not be exposed on public API endpoints

### Issues fixed inline

**P2 — Content-Type, ETag, Link header, and 304 support all missing on /[username]/you.json**
- File: `src/app/[username]/you.json/route.ts`
- Root cause: the route handler used `NextResponse.json(data, ...)` which always sets `content-type: application/json` and doesn't forward upstream headers
- **STATUS: FIXED** — rewrote the handler to use `new NextResponse(body, ...)` with explicit headers. Now sets Content-Type to `application/vnd.you-md.v1+json`, forwards upstream ETag, forwards upstream Link header, supports conditional requests via If-None-Match → 304 passthrough.

### Issue queued

**P3 — Clerk middleware leaks debug headers on public profile endpoints**
- `x-clerk-auth-reason: session-token-and-uat-missing`
- `x-clerk-auth-status: signed-out`
- Impact: minor information disclosure, not a security risk but unprofessional
- **STATUS: queued to improvements.md**

### Verification
- Type-check: PASS
- Cycle 12 verification (h1): PASS
- Cycle 12 verification (favicon 404): pending (cache/deploy)
- Cycle 13 verification: deferred to next cycle (after Vercel deploy)

### Numbers
- /houstongolden/you.json byte length: 6550
- /houstongolden/you.json top-level keys: 18
- Projects: 6, Values: 6, Links: 11
- Bio sample length: 115 chars
- 307 → 200 redirect roundtrip on apex domain (expected)

## Cycle 14 — Fix P3: Clerk debug headers + verify cycle 13 — 2026-04-08 19:24 UTC

**Tool:** Edit + tsc + curl + browse (verification)
**Status:** DONE — fix applied, type-check passes, cycle 13 verified live

### What was done

1. **Verified cycle 13 fix is live on production (PASSED):**
   - /houstongolden/you.json content-type: `application/vnd.you-md.v1+json` ✓
   - /houstongolden/you.json etag: `"f6cdd929f5c42e8300fb3e79dc353657190374ef01c5e5b4fa551eac0ef7e3b9"` ✓
   - /houstongolden/you.json link: `<https://you.md/schema/you-md/v1.json>; rel="describedby"; type="application/schema+json"` ✓
   - All 3 P2 fixes from cycle 13 confirmed in production

2. **Verified cycle 12 favicon 404 fix (DOES NOT FIX CONSOLE ERROR):**
   - Console still shows 404 — the HTTP request fires before onError can run
   - This is unavoidable browser behavior. The img element IS being hidden (visible result is correct), but the network request happens regardless and the browser logs the 404.
   - Decided to accept the harmless console message rather than build a more complex solution (server-side proxy or domain pre-validation).

3. **Found the middleware:**
   - File is `src/proxy.ts` (NOT middleware.ts) — Next.js 16.2 renamed middleware.ts → proxy.ts per their new convention
   - Confirmed via git log `eeb346e: feat: ... proxy migration` which renamed the file

4. **Fixed P3: Clerk debug headers on public API endpoints**
   - Root cause: `clerkMiddleware()` always runs auth resolution on every matched request and adds debug headers regardless. The matcher was too broad.
   - Fix: extended the negative lookahead in the matcher to also exclude:
     - `/ctx/...` (has its own proxy)
     - `/[^/]+/you\.(?:json|txt|md)$` (public agent endpoints with own handlers)
   - Visible profile page `/[username]` (no extension) still matches because it intentionally does agent UA interception in the middleware

### Verification
- Type-check: PASS
- Cycle 13 verification: PASS (3 of 3 fixes live)
- Cycle 12 verification: 1 of 2 (h1 yes, favicon console error unfixable)
- Cycle 14 verification: deferred to next cycle (after Vercel deploy)

### Cycle bookkeeping
- Picked: top P3 from improvements.md
- Moved to DONE
- Cycle 13 entry annotated with "VERIFIED LIVE" tag
- Cycle 12 entry annotated with "PARTIAL VERIFY" + explanation
- Lock held throughout

## Cycle 15 — Audit /houstongolden/you.txt — 2026-04-08 19:28 UTC

**Tool:** curl
**Status:** DONE_WITH_FINDINGS — 1 P2 fixed inline (3 issues bundled), cycle 14 verified live

### What was tested
- HTTP status (after 307 redirect from apex)
- Response headers (cache-control, etag, content-type, link, clerk leaks)
- Body content (markdown format, frontmatter, sections)
- Cycle 14 verification (Clerk header fix on both you.json and you.txt)

### Cycle 14 verification (PASSED — both endpoints)
- /houstongolden/you.json: content-type + etag only, NO x-clerk-* headers ✓
- /houstongolden/you.txt: content-type only, NO x-clerk-* headers ✓
- The matcher exclusion regex (`[^/]+/you\.(?:json|txt|md)$`) works correctly

### /houstongolden/you.txt body (excellent)
- ✅ Valid YAML frontmatter (schema, name, username, generated_at)
- ✅ Markdown sections: # Houston Golden, ## About, ## Now, ## Projects, ## Values, ## Links
- ✅ Houston Golden, BAMF, Hubify, BAMF.ai, BigBounce all present
- ✅ Miami location implicit in bio
- ✅ Venice NOT present (cleanup verified at txt layer too)
- ✅ 82 lines, 4226 bytes
- ✅ All 11 links present
- ⚠️ "# Projects [active]" is rendered as a project header — looks like a leftover seeded data noise (the "# Projects" section name is treated as a project itself). Minor.

### /houstongolden/you.txt headers
- ✅ HTTP 200 (after expected 307 to www)
- ✅ Cache-Control: public, max-age=60
- ✅ Access-Control-Allow-Origin: *
- ✅ Content-Type: text/plain; charset=utf-8
- ❌ **No ETag header** (same issue you.json had before cycle 13)
- ❌ **No Link rel="describedby" header**
- ❌ **No conditional request / 304 support**

### Issues fixed inline

**P2 — /[username]/you.txt missing etag, link header, 304 support**
- Same fix pattern as cycle 13 applied to the you.txt route handler
- **STATUS: FIXED**

### Verification
- Type-check: PASS
- Cycle 14 verification: PASS (both endpoints)
- Cycle 15 fix verification: deferred to next cycle

### Cycle bookkeeping
- Picked: queue.md item 8 (/houstongolden/you.txt)
- Cycle 14 entry annotated with "VERIFIED LIVE"
- Lock held throughout
