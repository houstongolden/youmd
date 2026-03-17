# You.md — Build Progress & Polish Tracker

Last Updated: 2026-03-17

## LAUNCH BLOCKERS — Must fix before launch

### Auth & Onboarding
- [ ] Style Clerk sign-in/sign-up components to match brand (or build custom auth UI)
- [ ] Add web-based chat agent on dashboard (web version of CLI youmd chat)
- [ ] Claim flow should auto-create first bundle after claiming username

### Loading & Error States
- [ ] Skeleton loaders on dashboard, profile, claim pages
- [ ] Error boundary with branded fallback UI
- [ ] Loading spinner component (brand-consistent, not generic)
- [ ] Empty state illustrations for no sources, no bundles, no keys

### Interactions & Feedback
- [ ] Copy button — toast notification with checkmark animation
- [ ] Confirmation dialogs for destructive actions (revoke key, revoke link)
- [ ] Unsaved changes indicator on dashboard form
- [ ] Auto-dismiss status messages after 5 seconds with X button
- [ ] Button loading spinners (publish, save, trigger build)
- [ ] Disabled buttons show cursor-not-allowed

### Accessibility
- [ ] Focus rings on all interactive elements (focus:ring-2 focus:ring-coral)
- [ ] ARIA labels on icon buttons and status indicators
- [ ] Skip-to-content link on landing page
- [ ] aria-hidden on decorative Aurora components
- [ ] Form validation with role="alert" aria-live="polite"
- [ ] Color-blind safe status indicators (icons + text, not just color)

### Mobile
- [ ] Mobile hamburger menu on landing page nav
- [ ] Touch-optimized input targets (min 44px)
- [ ] Terminal preview scrollable on mobile
- [ ] Dashboard action buttons stack on mobile
- [ ] Hero text scale tested on actual mobile viewports

---

## HIGH PRIORITY — Polish pass

### Typography & Hierarchy
- [ ] Dashboard heading scale (text-2xl for page title, not same as sections)
- [ ] Form field labels should be font-medium not thin
- [ ] Consistent section label convention across all pages
- [ ] Tagline/hero copy weight should be light (300-400) per PRD

### Visual Consistency
- [ ] Standardize copy button component (used in 4+ places)
- [ ] Consistent hover states on all cards (shadow + border shift)
- [ ] Section dividers consistent (border-t vs space-y)
- [ ] Input hover states (hover:border-mist/40)
- [ ] Tab indicator should animate smoothly (not snap)

### Profile Page
- [ ] Share button (copy URL, share to X, share to LinkedIn)
- [ ] Profile view counter visible to owner
- [ ] "Report profile" link for moderation
- [ ] Better bio rendering (medium bio shown if long is empty)

### Dashboard
- [ ] Projects editor — structured fields instead of pipe-delimited text
- [ ] Per-section save (not just global save)
- [ ] Undo/reset form changes
- [ ] Pipeline progress with stage-by-stage updates (real-time via Convex)
- [ ] View analytics (views, agent reads) in dashboard

### Landing Page
- [ ] Prefetch /claim and /sign-in links
- [ ] Gradient text animation performance (check CLS)
- [ ] Social proof — show real user count when available
- [ ] FAQ section for common questions
- [ ] Pricing section (Free vs Pro comparison)

---

## MODERATE PRIORITY — UX refinement

- [ ] Global toast notification system
- [ ] Breadcrumb navigation on dashboard
- [ ] "Back to dashboard" link on profile page (when logged in)
- [ ] Profile page — smooth scroll to sections
- [ ] Collapsible sections remember state
- [ ] Form field character counts
- [ ] Keyboard shortcut: Cmd+S to save on dashboard
- [ ] Progressive form rendering (lazy load lower sections)
- [ ] Dark mode toggle button (not just system preference)

---

## CLI Polish
- [ ] More personality in wait-state phrases (add 20 more)
- [ ] Agent should reference user's specific info in follow-ups
- [ ] Website content analysis should be more detailed/specific
- [ ] `youmd chat` slash commands all functional
- [ ] `youmd preview` — actually open local server
- [ ] `youmd diff` — show actual diff between local and published
- [ ] Better error messages with actionable suggestions
- [ ] Post-publish celebration message
- [ ] Agent should suggest adding more sources proactively

---

## Infrastructure
- [x] Convex production deployment
- [x] Vercel deployment
- [x] Clerk production keys
- [x] OpenRouter API key on Convex
- [x] LLM chat proxy
- [ ] Custom domain (you.md) on Vercel
- [ ] Sentry error monitoring
- [ ] Uptime monitoring
- [ ] Rate limiting on API endpoints
- [ ] Analytics (Vercel Analytics or Plausible)

---

## Completed
- [x] All milestones 0-3 code written
- [x] CLI published on npm with conversational AI agent
- [x] OG social cards auto-generated
- [x] Dynamic SEO metadata per profile
- [x] Dashboard with tabs, source management, pipeline trigger
- [x] Context links + API keys management
- [x] Landing page with Aurora, animations, brand system
- [x] Light mode default
- [x] Profile page with beam-glow, project cards, JSON-LD
