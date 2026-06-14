# You.md Reference Intelligence

Last updated: 2026-06-14T20:59:38.098Z

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
- Mode: Changes since 14fc086

- `c7ae632` 2026-06-14 — v1.58.1.0 feat: hermetic local E2E + Conductor prose AskUserQuestion (#2004)
  Files: `CHANGELOG.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `SKILL.md`, `VERSION`, `autoplan/SKILL.md`, `benchmark-models/SKILL.md`, `benchmark/SKILL.md`, +81 more

## GBrain

- URL: https://github.com/garrytan/gbrain
- Local path: `.reference-repos/garrytan/gbrain`
- Branch: `master`
- Latest commit: `090bb5320355`
- Mode: Changes since 4ee530f

- `090bb53` 2026-06-14 — v0.42.44.0 docs(tutorial): point AlphaClaw deploy link at the official site (#2165) (#2171)
  Files: `CHANGELOG.md`, `VERSION`, `docs/tutorials/personal-brain.md`, `package.json`
- `a81f7e0` 2026-06-14 — v0.42.43.0 feat(context): push-based context (#2095) + teardown-exit hardening (#2084) (#2175)
  Files: `AGENTS.md`, `CHANGELOG.md`, `CLAUDE.md`, `TODOS.md`, `VERSION`, `docker-compose.ci.yml`, `docs/RELEASING.md`, `docs/TESTING.md`, +41 more

## Agent Scripts

- URL: https://github.com/steipete/agent-scripts
- Local path: `.reference-repos/steipete/agent-scripts`
- Branch: `main`
- Latest commit: `448cfa972336`
- Mode: Changes since a3026ae

- `448cfa9` 2026-06-14 — fix(skill-cleaner): audit live Codex inventory
  Files: `CHANGELOG.md`, `skills/agent-transcript/SKILL.md`, `skills/github-project-triage/SKILL.md`, `skills/maintainer-orchestrator/SKILL.md`, `skills/skill-cleaner/SKILL.md`, `skills/skill-cleaner/scripts/skill-cleaner.test.ts`, `skills/skill-cleaner/scripts/skill-cleaner.ts`

## The Library

- URL: https://github.com/disler/the-library
- Local path: `.reference-repos/disler/the-library`
- Branch: `main`
- Latest commit: `47f455cd139b`
- Mode: No new commits since 47f455c

- No commits found.

## Candidate Tasks

- [ ] YouStacks skill packaging: Review whether this upstream skill/agent pattern should become a YouStack artifact, bundled skill, or adapter-generation rule.
  Source: GStack c7ae632: v1.58.1.0 feat: hermetic local E2E + Conductor prose AskUserQuestion (#2004)
- [ ] You.md brain schema/context: Review whether this upstream brain/context change should improve You.md memory categories, private context, profile files, or agent startup briefs.
  Source: GBrain 090bb53: v0.42.44.0 docs(tutorial): point AlphaClaw deploy link at the official site (#2165) (#2171)
- [ ] You.md brain schema/context: Review whether this upstream brain/context change should improve You.md memory categories, private context, profile files, or agent startup briefs.
  Source: GBrain a81f7e0: v0.42.43.0 feat(context): push-based context (#2095) + teardown-exit hardening (#2084) (#2175)
- [ ] Cross-agent instruction portability: Review whether this upstream shared-instruction pattern should improve `youmd skill init-project`, host adapters, or repo-local pointer rules.
  Source: Agent Scripts 448cfa9: fix(skill-cleaner): audit live Codex inventory
