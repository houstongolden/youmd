# You.md Reference Intelligence

Last updated: 2026-06-15T15:31:00.696Z

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
- Latest commit: `090bb5320355`
- Mode: No new commits since 090bb53

- No commits found.

## Agent Scripts

- URL: https://github.com/steipete/agent-scripts
- Local path: `.reference-repos/steipete/agent-scripts`
- Branch: `main`
- Latest commit: `cb78a4ad65fc`
- Mode: Changes since 448cfa9

- `cb78a4a` 2026-06-15 — docs: group skills for skills.sh (#12)
  Files: `skills.sh.json`
- `7cdf065` 2026-06-15 — docs: add locked-mac Git fallback
  Files: `AGENTS.MD`, `CHANGELOG.md`
- `29c0423` 2026-06-15 — docs: require improving generated PR code
  Files: `AGENTS.MD`, `CHANGELOG.md`

## The Library

- URL: https://github.com/disler/the-library
- Local path: `.reference-repos/disler/the-library`
- Branch: `main`
- Latest commit: `47f455cd139b`
- Mode: No new commits since 47f455c

- No commits found.

## Candidate Tasks

- [ ] YouStacks skill ergonomics: Compare this skill packaging or validation pattern against bundled skills, stack manifests, and `youmd stack doctor` warnings.
  Source: Agent Scripts cb78a4a: docs: group skills for skills.sh (#12)
- [ ] Cross-agent instruction portability: Review whether this upstream shared-instruction pattern should improve `youmd skill init-project`, host adapters, or repo-local pointer rules.
  Source: Agent Scripts 7cdf065: docs: add locked-mac Git fallback
- [ ] Cross-agent instruction portability: Review whether this upstream shared-instruction pattern should improve `youmd skill init-project`, host adapters, or repo-local pointer rules.
  Source: Agent Scripts 29c0423: docs: require improving generated PR code
