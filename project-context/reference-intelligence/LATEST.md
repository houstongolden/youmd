# You.md Reference Intelligence

Last updated: 2026-06-17T15:31:10.710Z

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
- Latest commit: `70d5f36db60d`
- Mode: Changes since 090bb53

- `70d5f36` 2026-06-17 — v0.42.50.0 ci: reliability hardening — cancel-superseded + per-job timeouts + actionlint + hermetic E2E env (#2254)
  Files: `.github/workflows/actionlint.yml`, `.github/workflows/e2e.yml`, `.github/workflows/test.yml`, `CHANGELOG.md`, `VERSION`, `package.json`, `scripts/run-e2e.sh`
- `7968f84` 2026-06-17 — v0.42.49.0 feat(pace): native DB-contention pacing for embed/sync backfills (#2240)
  Files: `CHANGELOG.md`, `CLAUDE.md`, `TODOS.md`, `VERSION`, `llms-full.txt`, `package.json`, `src/commands/embed.ts`, `src/commands/jobs.ts`, +8 more
- `7ea92d6` 2026-06-17 — v0.42.48.0 feat(durability): auto-harden brain repos for git durability on PAT+URL (#2241)
  Files: `CHANGELOG.md`, `TODOS.md`, `VERSION`, `docs/architecture/KEY_FILES.md`, `docs/guides/multi-source-brains.md`, `package.json`, `src/cli.ts`, `src/commands/sources-harden.ts`, +7 more
- `9d88680` 2026-06-16 — v0.42.47.0 feat(skillpack,advisor): brain-resident skillpacks + proactive gbrain advisor (#2180) (#2231)
  Files: `CHANGELOG.md`, `CLAUDE.md`, `TODOS.md`, `VERSION`, `docs/architecture/KEY_FILES.md`, `llms-full.txt`, `openclaw.plugin.json`, `package.json`, +42 more
- `c023a60` 2026-06-16 — v0.42.46.0 fix(engine): federated read scope reaches by-slug reads (#2200) (#2239)
  Files: `CHANGELOG.md`, `TODOS.md`, `VERSION`, `docs/architecture/KEY_FILES.md`, `package.json`, `src/core/engine.ts`, `src/core/operations.ts`, `src/core/pglite-engine.ts`, +4 more
- `5c49225` 2026-06-16 — v0.42.45.0 feat(sync): delta-aware cost estimator — stop wedging the daily cron (#2139) (#2224)
  Files: `CHANGELOG.md`, `CLAUDE.md`, `TODOS.md`, `VERSION`, `docs/architecture/KEY_FILES.md`, `docs/operations/spend-controls.md`, `llms-full.txt`, `package.json`, +20 more

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

- [ ] You.md brain sync: Evaluate whether this upstream sync or migration pattern should change GitHub repo sync, local bundle export/import, or backup behavior.
  Source: GBrain 70d5f36: v0.42.50.0 ci: reliability hardening — cancel-superseded + per-job timeouts + actionlint + hermetic E2E env (#2254)
- [ ] You.md retrieval layer: Compare this retrieval/indexing signal against You.md memory search, project context search, and protected brain retrieval plans.
  Source: GBrain 7968f84: v0.42.49.0 feat(pace): native DB-contention pacing for embed/sync backfills (#2240)
- [ ] You.md brain schema/context: Review whether this upstream brain/context change should improve You.md memory categories, private context, profile files, or agent startup briefs.
  Source: GBrain 7ea92d6: v0.42.48.0 feat(durability): auto-harden brain repos for git durability on PAT+URL (#2241)
- [ ] You.md brain schema/context: Review whether this upstream brain/context change should improve You.md memory categories, private context, profile files, or agent startup briefs.
  Source: GBrain 9d88680: v0.42.47.0 feat(skillpack,advisor): brain-resident skillpacks + proactive gbrain advisor (#2180) (#2231)
- [ ] You.md brain privacy/grants: Check whether this upstream auth/privacy pattern should tighten private context, stack grants, scoped tokens, or audit logs.
  Source: GBrain c023a60: v0.42.46.0 fix(engine): federated read scope reaches by-slug reads (#2200) (#2239)
- [ ] You.md retrieval layer: Compare this retrieval/indexing signal against You.md memory search, project context search, and protected brain retrieval plans.
  Source: GBrain 5c49225: v0.42.45.0 feat(sync): delta-aware cost estimator — stop wedging the daily cron (#2139) (#2224)
