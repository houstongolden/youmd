# You.md Reference Intelligence

Last updated: 2026-06-25T15:42:53.281Z

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
- Latest commit: `9fd03fae9e74`
- Latest upstream activity: 2026-06-21T07:15:19-07:00 (4d ago)
- Mode: No new commits since last sync (9fd03fa)

- No commits found.

## GBrain

- URL: https://github.com/garrytan/gbrain
- Local path: `.reference-repos/garrytan/gbrain`
- Branch: `master`
- Latest commit: `814258dda679`
- Latest upstream activity: 2026-06-24T06:05:16-07:00 (1d ago)
- Mode: No new commits since last sync (814258d)

- No commits found.

## Agent Scripts

- URL: https://github.com/steipete/agent-scripts
- Local path: `.reference-repos/steipete/agent-scripts`
- Branch: `main`
- Latest commit: `ea989d661163`
- Latest upstream activity: 2026-06-22T00:35:16-04:00 (3d ago)
- Mode: No new commits since last sync (ea989d6)

- No commits found.

## The Library

- URL: https://github.com/disler/the-library
- Local path: `.reference-repos/disler/the-library`
- Branch: `main`
- Latest commit: `47f455cd139b`
- Latest upstream activity: 2026-03-15T10:00:28-05:00 (102d ago)
- Mode: No new commits since last sync (47f455c)

- No commits found.

## Candidate Tasks

- No task candidates generated.
