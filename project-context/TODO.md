# You.md — Build Progress Tracker

Last Updated: 2026-03-18
PRD Version: 2.3

## ACTIVE: Design System Migration (v2.3)

Porting from Lovable prototype (youmd-b73d50c7) to Next.js production app.

### CSS + Design Tokens — IN PROGRESS
- [ ] New color system: monochrome + burnt orange (#C46A3A)
- [ ] JetBrains Mono + Inter typography
- [ ] Dark mode default, light mode via .light class
- [ ] Terminal panel component styles
- [ ] All animation keyframes (fadeUp, typewriter, countUp, pulse)
- [ ] Custom scrollbar
- [ ] Remove old coral/sky/gold palette

### Key Components — IN PROGRESS
- [ ] PixelYOU canvas logo
- [ ] ASCII Portrait system (HeroPortrait, AsciiAvatar, ProfileAsciiHeader)
- [ ] ASCII Portrait Generator (upload → download PNG)
- [ ] FadeUp animation component
- [ ] ThemeToggle (dark/light)
- [ ] Glass navbar with --flag navigation
- [ ] Sample profiles data

### Landing Page — IN PROGRESS
- [ ] Glass Navbar
- [ ] Hero (PixelYOU + boot sequence + CLI + ASCII portrait)
- [ ] Founder Quote (terminal panel)
- [ ] Profiles Showcase (hover-reveal ASCII → photo)
- [ ] Problem Strip
- [ ] How It Works (3 CLI steps)
- [ ] What's Inside (typewriter code)
- [ ] Portrait Generator section
- [ ] Open Spec
- [ ] Integrations
- [ ] Pricing (Free + Pro)
- [ ] CTA Footer

### Profile Page — TODO
- [ ] ASCII portrait banner (full-width)
- [ ] Terminal panel system header
- [ ] Raw JSON toggle
- [ ] Count-up metrics
- [ ] Role icons
- [ ] Verified badge + ACTIVE pulse
- [ ] All profile sections per PRD §15.10

### Profiles Directory — TODO
- [ ] > ls /profiles header
- [ ] ASCII avatar hover-reveal
- [ ] Agent reads + integrations metrics
- [ ] Search/sort

### Dashboard — TODO (after design migration)
- [ ] Adapt to new design system
- [ ] Terminal panel styling
- [ ] Web chat agent in new style

---

## Backend (Complete)
- [x] Convex production (kindly-cassowary-600)
- [x] Full schema (users, bundles, sources, apiKeys, contextLinks, etc.)
- [x] Ingestion pipeline (fetch, extract, analyze, compile)
- [x] LLM chat proxy
- [x] HTTP API (all endpoints)
- [x] API key management
- [x] Context links

## CLI (Complete)
- [x] Published on npm (youmd)
- [x] Conversational AI onboarding agent (1014 lines)
- [x] youmd chat command (522 lines)
- [x] 72 thinking phrases
- [x] All 13 commands working

## Infrastructure (Complete)
- [x] Vercel deployment
- [x] Convex production
- [x] Clerk production (clerk.you.md)
- [x] OpenRouter configured
- [x] GitHub repo synced
