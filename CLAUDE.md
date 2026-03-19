# You.md — Coding Agent Instructions

## Project Overview
You.md is the identity file for the agent internet. A structured, portable identity bundle that gives every AI agent context about who you are.

**Domain:** you.md | **npm:** youmd | **Founder:** Houston Golden

## CRITICAL: After Every Development Session

After completing any significant work (features, fixes, design changes, PRD updates), you MUST:

1. **Update `project-context/TODO.md`** — mark completed items, add new items, update status
2. **Update `project-context/FEATURES.md`** — track feature completion, add new requests
3. **Update `project-context/CHANGELOG.md`** — log what changed and when
4. **Commit with descriptive messages** — use conventional commits (feat:, fix:, docs:, etc.)

When the user provides a long prompt with feature requests or design feedback:
- Extract ALL actionable items into `project-context/FEATURES.md`
- Update `project-context/TODO.md` with new tasks
- Save key decisions to memory if they affect future work

## Design System (PRD v2.3 — STRICT ADHERENCE)

**Read `project-context/STYLE_GUIDE.md` and `project-context/BRANDING.md` before ANY UI work.**

Key rules:
- **Terminal-native, not SaaS.** No rounded cards with drop shadows. No colorful CTAs.
- **Monochrome + burnt orange accent (#C46A3A).** One accent color. Everything else is grayscale.
- **JetBrains Mono** for headings/brand/code. **Inter** for body text.
- **Dark mode default** (#0D0D0D). Light mode via `.light` class.
- **Terminal panels** (bg-raised, 1px border, 3-dot header) replace all cards.
- **ASCII portraits** are the visual identity — not profile photos.
- **No emoji** in UI or CLI. No decorative illustrations.
- **Hierarchy via spacing + opacity (0.3–0.9), NOT font weight.**

## Tech Stack
- **Frontend:** Next.js 16 (App Router, TypeScript, Tailwind CSS v4)
- **Backend + DB:** Convex (reactive, serverless, TypeScript-native)
- **Auth:** Clerk (production: clerk.you.md)
- **LLM:** OpenRouter (Claude Sonnet via server-side Convex proxy)
- **Animation:** Framer Motion (motion/react)
- **Hosting:** Vercel (you.md) + Convex Cloud
- **CLI:** TypeScript, Commander, published as `youmd` on npm

## Project Structure
```
src/app/                    Next.js App Router pages
src/app/[username]/         Public profile pages + OG image generation
src/app/dashboard/          Authenticated editor + web chat agent
src/app/claim/              Username claim flow
src/components/             Reusable components (PixelYOU, ASCII, FadeUp, etc.)
src/components/landing/     Landing page section components
src/components/ui/          UI primitives (Toast, Spinner, CopyButton)
src/data/                   Sample profiles data
convex/                     Backend (schema, queries, mutations, actions)
convex/pipeline/            Ingestion pipeline (fetch, extract, analyze, compile)
convex/chat.ts              LLM chat proxy for CLI/web
cli/                        CLI package (published as youmd on npm)
cli/src/lib/onboarding.ts   Conversational AI onboarding agent
cli/src/commands/chat.ts    Ongoing chat command
project-context/            PRD, TODO, features, style guide, branding, changelog
you-agent/                  The You Agent system (soul.md, skills, tools) — SEPARATE from coding agent
```

## Important: You Agent vs Coding Agent

- **This file (CLAUDE.md)** = instructions for the CODING agent (Claude Code, Cursor, Codex)
- **you-agent/** directory = the You.md platform agent that talks to users, builds profiles, runs the pipeline
- These are DIFFERENT agents. Don't confuse their instructions.

## Environment
- **Dev Convex:** uncommon-chicken-142 (used for local dev)
- **Prod Convex:** kindly-cassowary-600
- **Prod Clerk:** clerk.you.md (pk_live keys)
- **Vercel:** you.md (custom domain)
- **OpenRouter:** configured on both Convex deployments

## Build & Deploy
```bash
npx next build              # Build web app
cd cli && npm run build     # Build CLI
cd cli && npm publish       # Publish CLI (auto-bumps version)
vercel --prod               # Deploy to production
npx convex deploy           # Deploy Convex to prod (needs CONVEX_DEPLOY_KEY)
git push                    # Triggers Vercel auto-deploy from GitHub
```

## Lovable Design Prototype
The design reference implementation is at `/tmp/youmd-lovable/` (cloned from github.com/houstongolden/youmd-b73d50c7). Port components from there when implementing new UI. Live preview: youmd.lovable.app
