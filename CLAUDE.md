# You.md — Coding Agent Operating Manual

## What This Project Is

You.md is the identity context protocol for the agent internet — an MCP where the context is you. A structured, portable identity context that gives every AI agent context about who you are — so they don't start from scratch.

**Domain:** you.md | **npm:** youmd | **Founder:** Houston Golden

---

## Who Houston Is

Founder of You.md and BAMF Media (8-figure growth marketing agency). Based in Miami. LinkedIn growth pioneer. Building multiple AI tools: You.md, Hubify.com, BAMF.ai, plus cosmology research (bigbounce.hubify.com).

**Working style:** Ships fast, expects fast. Runs 4-6 Claude Code instances in parallel across projects. Gives dense, multi-part prompts and expects EVERY part to be addressed. Gets frustrated when agents cherry-pick one thing and ignore the rest. Prefers CLI-first, terminal-native aesthetics. Has strong design opinions grounded in his Lovable prototype.

**What he values:** Speed, personality, polish. The product must feel alive. Every interaction should have soul — not corporate, not generic.

**Pet peeves:**
- Having to repeat himself (biggest one)
- Generic/boring CLI output
- Forms anywhere in the product
- Agents that ask permission instead of acting
- Ignoring parts of multi-part messages
- Marking things "done" that aren't actually working

---

## The Quality Bar

### What "Done" Means
1. Code compiles with no new errors
2. Feature works end-to-end (not just the happy path)
3. Deployed to production (Vercel + Convex if applicable)
4. Visually matches PRD v2.3 design system
5. Houston has verified it works in practice

### What "Done" Does NOT Mean
- "I wrote the code" (did you test it?)
- "The build passes" (does it actually work?)
- "I deployed the frontend" (did you also deploy Convex if needed?)
- "It works in dev" (does it work in prod?)

---

## CRITICAL: How to Handle Houston's Messages

Houston gives dense, multi-part prompts. The #1 failure mode is cherry-picking one thing.

**Protocol for every message from Houston:**

1. **Read the ENTIRE message** before starting work
2. **Extract EVERY actionable request** into a numbered list
3. **Track them in `project-context/feature-requests-active.md`** with status
4. **Address ALL of them** — if some are blocked, say which and why
5. **Never silently ignore a request** — if you skip something, explicitly say why
6. **Don't mark anything DONE until Houston verifies it works**

### After Every Development Session

Update these files (REQUIRED, not optional):
1. `project-context/TODO.md` — mark completed items, add new items
2. `project-context/FEATURES.md` — track feature completion
3. `project-context/CHANGELOG.md` — log what changed and when
4. `project-context/feature-requests-active.md` — update request status
5. `project-context/PROMPTS.md` — append all of Houston's messages from this session (see below)
6. Commit with conventional commits (feat:, fix:, docs:, chore:)

### Prompt Archival (PROMPTS.md)

Houston's exact messages are archived in `project-context/PROMPTS.md` so he can search his own words across sessions. At the end of every session:

1. Read the current session's JSONL transcript from `~/.claude/projects/-Users-houstongolden-Desktop-CODE-2026-youmd/`
2. Extract all entries where `type == "user"` and the message content has actual text (skip empty tool-result confirmations and `<task-notification>` blocks)
3. Append them to `project-context/PROMPTS.md` under a new `## Session:` heading with timestamps
4. Update the totals in the file header

Format per message:
```
**{YYYY-MM-DD HH:MM:SS UTC}**
> {full message text, blockquoted}
```

Do NOT include: tool results, assistant messages, system reminders, or task-notification XML. Only Houston's actual typed messages.

---

## Common Mistakes to Avoid

These are patterns that have caused problems in this project. Do not repeat them.

1. **Ignoring parts of a message.** If Houston asks for 5 things, do all 5. If one is blocked, say so.

2. **Marking features DONE that aren't deployed.** Code in git != working in production. Verify Vercel deployed. Verify Convex deployed if backend changed.

3. **Forgetting to bump CLI version before publish.** npm rejects republished versions. ALWAYS run `npm version patch` before `npm publish`.

4. **Making the CLI boring.** Every async operation needs a BrailleSpinner. Every response needs personality. Show the ASCII portrait early. The CLI must feel ALIVE.

5. **Adding forms.** ZERO forms anywhere. Everything is terminal-style sequential prompts. Even on the web.

6. **Deploying frontend without deploying Convex.** If you changed convex/ files, you MUST also deploy Convex or the frontend will break against the old schema.

7. **Not testing end-to-end.** Building a feature in isolation isn't enough. Does the CLI push data that the web can read? Does the web display what the CLI sent?

8. **Agent asking permission instead of acting.** The You Agent should say "adding that to your projects now" not "would you like me to add that?" The coding agent should act decisively too.

9. **Copying Lovable code verbatim.** It's a Vite/React/Supabase app. We're Next.js/Convex. Extract the intent, rebuild properly.

10. **Not reading project-context/ before starting work.** These files exist so you have context. Read them.

---

## Design System (PRD v2.3 — STRICT ADHERENCE)

**Read `project-context/STYLE_GUIDE.md` and `project-context/BRANDING.md` before ANY UI work.**

### The Rules
- **Terminal-native, not SaaS.** No rounded cards with drop shadows. No colorful CTAs.
- **Monochrome + burnt orange accent (#C46A3A).** One accent color. Everything else is grayscale.
- **JetBrains Mono** for headings/brand/code. **Inter** for body text.
- **Dark mode default** (#0D0D0D). Light mode via `.light` class.
- **Terminal panels** (bg-raised, 1px border, 3-dot header) replace all cards.
- **ASCII portraits** are the visual identity — not profile photos.
- **No emoji** in UI or CLI. No decorative illustrations.
- **Hierarchy via spacing + opacity (0.3-0.9), NOT font weight.**
- **Border radius: 2px everywhere.** No rounded corners.
- **Green is OK** for live/active/done indicators. Still use orange as primary accent.

### CLI UX Requirements
- BrailleSpinner on EVERY async operation (LLM calls, scrapes, compiles, saves)
- Spinner color rotation through orange shades (like Claude Code)
- Lightsweep effect on active text
- ASCII portrait within first 3 interactions during onboarding
- AI humor throughout — sharp, dry, slightly weird. Not corporate.
- One question at a time, accent-colored, skippable with Enter
- YOU ASCII logo on opening screen
- Proper word-wrap and left-aligned formatting
- Personality-rich spinner labels ("computing your main character energy...")

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | Next.js (App Router) | 16.1.6 |
| UI | React | 19.2.3 |
| Styling | Tailwind CSS | v4 |
| Animation | Framer Motion | 12.37.0 |
| Backend + DB | Convex | 1.33.1 |
| Auth | Clerk | 7.0.4 |
| LLM | OpenRouter → Claude Sonnet 4.6 | |
| CLI | TypeScript + Commander | youmd 0.4.9 |
| Hosting | Vercel (web) + Convex Cloud (backend) | |

---

## Project Structure

```
src/app/                    Next.js App Router pages (11 routes)
src/app/[username]/         Public profile (SSR, JSON-LD, OG)
src/app/dashboard/          Terminal split-screen (35% chat + 65% pane)
src/app/initialize/         Onboarding boot sequence
src/components/             Reusable components
src/components/landing/     Landing page sections
src/components/panes/       Dashboard right-pane components
src/components/ui/          UI primitives
src/hooks/useYouAgent.ts    Shared agent logic (2000+ lines)
src/data/                   Sample profiles

convex/                     Backend (21 tables, 38+ HTTP routes)
convex/schema.ts            Complete data model
convex/http.ts              All HTTP API endpoints
convex/chat.ts              LLM proxy (OpenRouter)
convex/pipeline/            Ingestion pipeline (6 stages)
convex/profiles.ts          Profile CRUD + security logs
convex/me.ts                Authenticated profile operations
convex/memories.ts          Memory system
convex/portrait.ts          Server-side ASCII generation

cli/                        CLI package (npm: youmd, v0.5.0)
cli/src/index.ts            Entry point (21 commands + skill subcommands)
cli/src/lib/onboarding.ts   Conversational AI onboarding (1000+ lines)
cli/src/commands/chat.ts    Ongoing chat with You Agent
cli/src/lib/render.ts       BrailleSpinner, rich terminal rendering
cli/src/lib/ascii.ts        ASCII portrait generation (Jimp)
cli/src/lib/api.ts          HTTP client for Convex API
cli/src/lib/config.ts       Local config + project detection

project-context/            Product docs (PRD, TODO, architecture, etc.)
you-agent/                  You Agent personality (soul.md, skills/)
```

---

## Important: You Agent vs Coding Agent

- **This file (CLAUDE.md)** = instructions for the CODING agent (you — Claude Code, Cursor, Codex)
- **you-agent/** directory = the You.md platform's built-in AI that talks to users
- These are DIFFERENT agents. Don't confuse their instructions.
- When Houston says "the agent" without context, he usually means the You Agent (the product).

---

## Environment

| Environment | Service | Identifier |
|---|---|---|
| Dev Convex | uncommon-chicken-142 | Local development |
| Prod Convex | kindly-cassowary-600 | Production |
| Prod Clerk | clerk.you.md | pk_live keys |
| Vercel | you.md | Custom domain, auto-deploy on push |
| OpenRouter | Configured on both Convex | OPENROUTER_API_KEY |

---

## Build & Deploy

```bash
# Web app
npx next build                    # Build
git push                          # Triggers Vercel auto-deploy

# Convex backend
npx convex deploy                 # Deploy to prod (needs CONVEX_DEPLOY_KEY)
# Also auto-deploys via GitHub Actions when convex/ files change

# CLI
cd cli
npm version patch --no-git-tag-version   # ALWAYS bump first
npm run build                            # Compile TypeScript
npm publish --otp=CODE                   # Publish (requires 2FA OTP)
# Commit version bump after publishing
```

### CLI Publishing Checklist
1. `cd cli`
2. `npm version patch --no-git-tag-version` (minor for features, major for breaking)
3. `npm run build`
4. Tell Houston to run `npm publish --otp=CODE`
5. Commit the version bump

---

## Architecture Quick Reference

**Full details:** `project-context/ARCHITECTURE.md`

- 21 Convex tables (users, profiles, bundles, sources, memories, skills, skillInstalls, chatMessages, etc.)
- 38+ HTTP API endpoints in convex/http.ts
- Auth: Clerk (web) + email/password via Clerk Backend API (CLI) + API keys (agents)
- Pipeline: discover → fetch → extract → analyze → compile → review
- LLM routing: Claude Sonnet (chat), Perplexity (research), Grok (X enrichment)

---

## Lovable Design Reference

The Lovable app (github.com/houstongolden/youmd-b73d50c7) is a **design playground**.

- **Clone:** `/tmp/youmd-lovable/` — `git pull` before reading
- **Live preview:** youmd.lovable.app
- **Details:** `project-context/LOVABLE_REFERENCE.md`

**Rules:**
1. This project is ALWAYS source of truth. Never override core functionality.
2. Never blindly copy. It's Vite/Supabase — we're Next.js/Convex.
3. UI design/styling CAN be closely matched — approved.
4. Extract intent, build properly here.

---

## Project Context Files

Read these before significant work:

| File | What It Contains |
|---|---|
| `project-context/PRD.md` | Full product requirements, vision, user journeys |
| `project-context/ARCHITECTURE.md` | System diagram, all tables, all API endpoints |
| `project-context/CURRENT_STATE.md` | What's deployed, what's broken, next priorities |
| `project-context/TODO.md` | Task tracking with completion status |
| `project-context/FEATURES.md` | Feature inventory with status |
| `project-context/CHANGELOG.md` | What changed and when |
| `project-context/feature-requests-active.md` | All tracked requests with verification status |
| `project-context/STYLE_GUIDE.md` | Design system reference |
| `project-context/BRANDING.md` | Brand guidelines |
| `project-context/LOVABLE_REFERENCE.md` | Lovable repo usage rules |
| `project-context/PROMPTS.md` | All of Houston's messages/prompts across sessions (searchable) |

---

## Session Protocol

### Starting a Session
1. Read CLAUDE.md (you're doing this now)
2. Check `project-context/CURRENT_STATE.md` for known issues
3. Check `project-context/feature-requests-active.md` for open requests
4. Read Houston's message fully before starting work

### During a Session
- Track what you're working on in feature-requests-active.md
- Test features end-to-end, not just compilation
- Deploy both frontend AND backend if both changed
- Show progress — don't go silent for long stretches

### Ending a Session
1. Update TODO.md with what was completed
2. Update FEATURES.md if features were added/changed
3. Update CHANGELOG.md with a dated entry
4. Update feature-requests-active.md status
5. Append Houston's messages from this session to PROMPTS.md
6. Commit with conventional commit messages
7. Note any known issues for the next session
