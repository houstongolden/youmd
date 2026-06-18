# You.md Reference Intelligence

Last updated: 2026-06-18T22:37:55.014Z

You.md keeps selected upstream agent-infrastructure repos as local references, then turns upstream changes into reviewable tasks for YouStacks and the You.md brain/context layer. Reference repos are not vendored into this repository; they live under `.reference-repos/` and are ignored by git. "No new commits since last sync" means no delta versus the previous local reference head, not "the upstream repo has been inactive."

Tracked lighthouses:

- GStack: installable local-first agent operating systems, skills, host adapters, evals, QA/review/release loops.
- GBrain: durable shared brain, memory, retrieval, sync, provenance, privacy, and startup context.
- Agent Scripts: canonical shared AGENTS/skills/scripts/hook patterns across Codex/Claude-style agents.
- The Library: private-first pointer catalog for skills, agents, prompts, dependencies, and cross-device/team distribution.

Run:

```bash
npm run references:sync
```

Follow-through ledger:

- `project-context/reference-intelligence/FOLLOW_THROUGH.md`

## GStack

- URL: https://github.com/garrytan/gstack
- Local path: `.reference-repos/garrytan/gstack`
- Branch: `main`
- Latest commit: `a861c00cfac6`
- Latest upstream activity: 2026-06-18T10:45:05-07:00 (4h ago)
- Mode: Changes since c7ae632

- `a861c00` 2026-06-18 — v1.58.3.0 feat: gbrowser anti-detection Layer C stealth (#2047)
  Files: `BROWSER.md`, `CHANGELOG.md`, `TODOS.md`, `VERSION`, `browse/src/browser-manager.ts`, `browse/src/stealth.ts`, `browse/test/browser-manager-unit.test.ts`, `browse/test/stealth-extended.test.ts`, +3 more

## GBrain

- URL: https://github.com/garrytan/gbrain
- Local path: `.reference-repos/garrytan/gbrain`
- Branch: `master`
- Latest commit: `9bf96db807c2`
- Latest upstream activity: 2026-06-17T14:02:47-07:00 (1d ago)
- Mode: No new commits since last sync (9bf96db)

- No commits found.

## Agent Scripts

- URL: https://github.com/steipete/agent-scripts
- Local path: `.reference-repos/steipete/agent-scripts`
- Branch: `main`
- Latest commit: `6e512e6fe054`
- Latest upstream activity: 2026-06-16T00:23:05-04:00 (2d ago)
- Mode: No new commits since last sync (6e512e6)

- No commits found.

## The Library

- URL: https://github.com/disler/the-library
- Local path: `.reference-repos/disler/the-library`
- Branch: `main`
- Latest commit: `47f455cd139b`
- Latest upstream activity: 2026-03-15T10:00:28-05:00 (95d ago)
- Mode: No new commits since last sync (47f455c)

- No commits found.

## Candidate Tasks

- [ ] YouStacks workflow quality gates: Consider adding or refining stack workflows, smoke tests, evals, or release-review loops based on this upstream quality pattern.
  Source: GStack a861c00: v1.58.3.0 feat: gbrowser anti-detection Layer C stealth (#2047)
