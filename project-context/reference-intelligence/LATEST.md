# You.md Reference Intelligence

Last updated: 2026-06-04T16:57:20.958Z

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
- Latest commit: `c43c850cae77`
- Mode: No new commits since c43c850

- No commits found.

## GBrain

- URL: https://github.com/garrytan/gbrain
- Local path: `.reference-repos/garrytan/gbrain`
- Branch: `master`
- Latest commit: `9a0bae8d62cd`
- Mode: Changes since f3ade6c

- `9a0bae8` 2026-06-03 — v0.42.25.0 fix(pricing): unify chat-model pricing into one canonical source; add Opus 4.8 (#1819) (#1827)
  Files: `CHANGELOG.md`, `CLAUDE.md`, `TODOS.md`, `VERSION`, `docs/architecture/KEY_FILES.md`, `docs/eval/SEARCH_MODE_METHODOLOGY.md`, `llms-full.txt`, `package.json`, +11 more
- `f868257` 2026-06-03 — v0.42.24.0 fix(minions): route lock claim/renewLock through direct session pool (#1822)
  Files: `CHANGELOG.md`, `TODOS.md`, `VERSION`, `docs/architecture/KEY_FILES.md`, `package.json`, `src/core/engine.ts`, `src/core/minions/queue.ts`, `src/core/pglite-engine.ts`, +4 more
- `f11d56c` 2026-06-03 — v0.42.23.0 feat(jobs): --nice scheduling-priority flag for jobs work/supervisor (#1815) (#1820)
  Files: `CHANGELOG.md`, `VERSION`, `docs/architecture/KEY_FILES.md`, `docs/guides/minions-deployment.md`, `package.json`, `src/commands/doctor.ts`, `src/commands/jobs.ts`, `src/core/doctor-categories.ts`, +14 more
- `f495934` 2026-06-03 — v0.42.22.0 fix(minions): supervisor progress watchdog + worker DB self-defense — alive-but-wedged worker self-heals (#1801) (#1824)
  Files: `CHANGELOG.md`, `VERSION`, `docs/architecture/KEY_FILES.md`, `docs/guides/queue-operations-runbook.md`, `package.json`, `src/commands/doctor.ts`, `src/commands/jobs.ts`, `src/core/doctor-categories.ts`, +10 more

## Agent Scripts

- URL: https://github.com/steipete/agent-scripts
- Local path: `.reference-repos/steipete/agent-scripts`
- Branch: `main`
- Latest commit: `0bb3bb96fb2a`
- Mode: Changes since 5dc3c24

- `0bb3bb9` 2026-06-03 — docs: note zsh array loop behavior
  Files: `AGENTS.MD`

## The Library

- URL: https://github.com/disler/the-library
- Local path: `.reference-repos/disler/the-library`
- Branch: `main`
- Latest commit: `47f455cd139b`
- Mode: No new commits since 47f455c

- No commits found.

## Candidate Tasks

- [ ] You.md brain schema/context: Review whether this upstream brain/context change should improve You.md memory categories, private context, profile files, or agent startup briefs.
  Source: GBrain 9a0bae8: v0.42.25.0 fix(pricing): unify chat-model pricing into one canonical source; add Opus 4.8 (#1819) (#1827)
- [ ] Docs/product education: Compare this upstream docs/example change against the homepage, `/docs`, quickstarts, and stack/brain examples.
  Source: GBrain f868257: v0.42.24.0 fix(minions): route lock claim/renewLock through direct session pool (#1822)
- [ ] You.md brain sync: Evaluate whether this upstream sync or migration pattern should change GitHub repo sync, local bundle export/import, or backup behavior.
  Source: GBrain f11d56c: v0.42.23.0 feat(jobs): --nice scheduling-priority flag for jobs work/supervisor (#1815) (#1820)
- [ ] Docs/product education: Compare this upstream docs/example change against the homepage, `/docs`, quickstarts, and stack/brain examples.
  Source: GBrain f495934: v0.42.22.0 fix(minions): supervisor progress watchdog + worker DB self-defense — alive-but-wedged worker self-heals (#1801) (#1824)
- [ ] Cross-agent instruction portability: Review whether this upstream shared-instruction pattern should improve `youmd skill init-project`, host adapters, or repo-local pointer rules.
  Source: Agent Scripts 0bb3bb9: docs: note zsh array loop behavior
