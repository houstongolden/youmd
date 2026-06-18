# You.md Reference Intelligence

Last updated: 2026-06-18T15:32:12.187Z

You.md keeps selected upstream agent-infrastructure repos as local references, then turns upstream changes into reviewable tasks for YouStacks and the You.md brain/context layer. Reference repos are not vendored into this repository; they live under `.reference-repos/` and are ignored by git.

Tracked lighthouses:

- GStack: installable local-first agent operating systems, skills, host adapters, evals, QA/review/release loops.
- GBrain: durable shared brain, memory, retrieval, sync, provenance, privacy, and startup context.
- Agent Scripts: canonical shared AGENTS/skills/scripts/hook patterns across Codex/Claude-style agents.
- The Library: private-first pointer catalog for skills, agents, prompts, dependencies, and cross-device/team distribution.

Run:

```bash
npm run references:sync
```

## GStack

- URL: https://github.com/garrytan/gstack
- Local path: `.reference-repos/garrytan/gstack`
- Branch: `main`
- Latest commit: `c7ae63201ab1`
- Mode: No new commits since c7ae632

- No commits found.

## GBrain

- URL: https://github.com/garrytan/gbrain
- Local path: `.reference-repos/garrytan/gbrain`
- Branch: `master`
- Latest commit: `9bf96db807c2`
- Mode: Changes since 70d5f36

- `9bf96db` 2026-06-17 — v0.42.51.0 fix(sync): contention-free clock + checkpoint integrity + honest sync freshness (#2255)
  Files: `.github/workflows/e2e.yml`, `CHANGELOG.md`, `VERSION`, `docs/architecture/KEY_FILES.md`, `package.json`, `src/commands/doctor.ts`, `src/commands/sync.ts`, `src/core/migrate.ts`, +15 more

## Agent Scripts

- URL: https://github.com/steipete/agent-scripts
- Local path: `.reference-repos/steipete/agent-scripts`
- Branch: `main`
- Latest commit: `6e512e6fe054`
- Mode: No new commits since 6e512e6

- No commits found.

## The Library

- URL: https://github.com/disler/the-library
- Local path: `.reference-repos/disler/the-library`
- Branch: `main`
- Latest commit: `47f455cd139b`
- Mode: No new commits since 47f455c

- No commits found.

## Candidate Tasks

- [ ] You.md retrieval layer: Compare this retrieval/indexing signal against You.md memory search, project context search, and protected brain retrieval plans.
  Source: GBrain 9bf96db: v0.42.51.0 fix(sync): contention-free clock + checkpoint integrity + honest sync freshness (#2255)
