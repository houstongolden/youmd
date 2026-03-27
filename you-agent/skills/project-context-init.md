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

## When To Use

- Starting any new project
- As part of `youmd skill init-project` (compound command)
- When adopting the project-context pattern in an existing repo
