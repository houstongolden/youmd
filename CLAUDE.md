# You.md — Identity as Code

## Project Overview
You.md is the identity file for the agent internet. It's a structured, portable identity bundle that gives every AI agent context about who you are.

## Tech Stack
- **Frontend:** Next.js 14+ (App Router, TypeScript, Tailwind CSS v4)
- **Backend + DB:** Convex (reactive, serverless, TypeScript-native)
- **Auth:** Clerk (via Convex integration)
- **Hosting:** Vercel (frontend), Convex Cloud (backend)

## Project Structure
```
src/app/               — Next.js App Router pages
src/app/[username]/    — Public profile pages (SSR)
src/app/dashboard/     — Authenticated editor/dashboard
src/app/claim/         — Username claim flow
src/providers/         — React context providers
convex/                — Convex backend (schema, queries, mutations, actions)
convex/schema.ts       — Database schema (all tables)
convex/users.ts        — User registration, username validation
convex/bundles.ts      — Bundle CRUD, publishing
convex/profiles.ts     — Public profile queries, view tracking
convex/http.ts         — Public HTTP API endpoints
project-context/       — PRD, TODO tracker, feature requests
```

## Key Conventions
- Dark mode is default
- Brand colors: coral (#E8857A), sky (#7ABED0), gold (#F4D78C), void (#0A0E1A), ink (#1A1F2E)
- `you.md` logo always in monospace
- No emoji in UI or CLI output
- Beam of light is the recurring visual motif

## Current Milestone
**Milestone 0: Foundation** — Core infrastructure, auth, username claim, empty bundle creation.

## Build Progress
See `project-context/TODO.md` for detailed progress tracking.
See `project-context/PRD.md` for full product spec.
See `project-context/FEATURES.md` for feature tracking.
