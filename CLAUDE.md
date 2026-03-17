# You.md — Identity as Code

## Project Overview
You.md is the identity file for the agent internet. A structured, portable identity bundle that gives every AI agent context about who you are.

**Domain:** you.md
**npm:** youmd
**Founder:** Houston Golden

## Tech Stack
- **Frontend:** Next.js 16 (App Router, TypeScript, Tailwind CSS v4)
- **Backend + DB:** Convex (reactive, serverless, TypeScript-native)
- **Auth:** Clerk (production: clerk.you.md)
- **LLM:** OpenRouter (Claude Sonnet via server-side proxy)
- **Hosting:** Vercel (youmd.vercel.app) + Convex Cloud (kindly-cassowary-600)
- **CLI:** TypeScript, Commander, published as `youmd` on npm

## Project Structure
```
src/app/                    Next.js App Router pages
src/app/[username]/         Public profile pages + OG image generation
src/app/dashboard/          Authenticated editor (tabs: Profile, Sources, Settings)
src/app/dashboard/chat/     Web chat agent (You Agent)
src/app/claim/              Username claim flow
src/components/ui/          Shared components (Toast, Spinner, CopyButton)
src/components/reactbits/   Aurora, BlurText, GradientText animations
src/providers/              Convex + Clerk providers
convex/                     Backend (schema, queries, mutations, actions)
convex/pipeline/            Ingestion pipeline (fetch, extract, analyze, compile)
convex/chat.ts              LLM chat proxy for CLI/web
cli/                        CLI package (published as youmd on npm)
cli/src/lib/onboarding.ts   Conversational AI onboarding (1014 lines)
cli/src/commands/chat.ts    Ongoing chat command (522 lines)
project-context/            PRD, TODO tracker, feature requests
```

## Key Conventions
- Light mode is default (dark mode via prefers-color-scheme)
- Brand colors: coral (#E8857A), sky (#7ABED0), gold (#F4D78C), void (#0A0E1A), ink (#1A1F2E)
- Use CSS variables via Tailwind: text-coral, bg-void, text-foreground, bg-background, etc.
- `you.md` logo always in monospace
- No emoji in UI or CLI output
- Beam of light is the recurring visual motif
- Terminal/code blocks always use dark background (bg-ink or bg-void)
- The You Agent personality: warm, direct, dry humor, genuinely curious, no emoji

## Environment
- Production Convex: kindly-cassowary-600
- Production Clerk: clerk.you.md (pk_live keys)
- Vercel: youmd.vercel.app
- OpenRouter key set on Convex prod

## Build & Deploy
```bash
npx next build              # Build web app
cd cli && npm run build     # Build CLI
npm publish                 # Publish CLI to npm (auto-bumps version)
npx convex deploy           # Deploy Convex functions
git push                    # Triggers Vercel auto-deploy
```

## Current Status
Through 4 iterations of polish. See project-context/TODO.md for detailed status.
