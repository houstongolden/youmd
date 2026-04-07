---
name: project-context-init
version: 1.0.0
scope: project
identity_fields: [preferences.agent, profile.about]
description: "Scaffold a project-context/ directory with PRD, TODO, features, changelog, and decision log"
---

# project-context-init

Scaffold a complete project-context/ directory in any repo — the same structure Houston uses across all his projects. Pre-populated with your identity and agent preferences.

## Identity Context (resolved at install time)

- **Agent preferences:** {{preferences.agent}}
- **About you:** {{profile.about}}

## What This Skill Does

1. Detect project root (walk up to .git, package.json, etc.)
2. Create `project-context/` directory with:
   - `PRD.md` — Product requirements (empty template with your identity header)
   - `TODO.md` — Task tracking
   - `FEATURES.md` — Feature inventory with status
   - `CHANGELOG.md` — Dated change log
   - `ARCHITECTURE.md` — System architecture notes
   - `CURRENT_STATE.md` — What's deployed, what's broken
   - `STYLE_GUIDE.md` — Design system reference
   - `feature-requests-active.md` — Active request tracker
3. Pre-populate headers with your identity
4. Skip files that already exist (never overwrite)

## Directory Structure Created

```
project-context/
├── PRD.md
├── TODO.md
├── FEATURES.md
├── CHANGELOG.md
├── ARCHITECTURE.md
├── CURRENT_STATE.md
├── STYLE_GUIDE.md
└── feature-requests-active.md
```

## Analytics & Verified Badges

Projects tracked by You.md can leverage the analytics pane and verified badge system:

### Analytics Pane

Once a project is registered and pushed, the You.md dashboard shows:

- **Activity timeline** — commits, memory additions, context updates over time
- **Agent usage** — which agents accessed this project's context and how often
- **Identity field coverage** — which sections of your identity are referenced by project agents
- **Skill usage** — which skills are triggered in this project's context

To enable analytics, ensure the project is linked via `youmd project init <name>` and that you push regularly with `youmd push`.

### Verified Badges

Projects with complete context (PRD, architecture, and at least 5 memories) earn a verified badge on your public profile. The badge signals to other agents and collaborators that this project has rich, maintained context. Badge criteria:

- PRD.md exists and is non-empty
- ARCHITECTURE.md exists and is non-empty
- At least 5 project memories recorded
- Last push within the past 30 days

The badge appears on your you.md profile page and in context links shared via `create_context_link`.

## When To Use

- Starting any new project
- As part of `youmd skill init-project` (compound command)
- When adopting the project-context pattern in an existing repo
