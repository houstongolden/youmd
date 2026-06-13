# You.md Reference Intelligence

Last updated: 2026-06-12T08:31:29.816Z

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
- Latest commit: `a5833c413f98`
- Mode: No new commits since a5833c4

- No commits found.

## GBrain

- URL: https://github.com/garrytan/gbrain
- Local path: `.reference-repos/garrytan/gbrain`
- Branch: `master`
- Latest commit: `ecd6ae87722a`
- Mode: No new commits since ecd6ae8

- No commits found.

## Agent Scripts

- URL: https://github.com/steipete/agent-scripts
- Local path: `.reference-repos/steipete/agent-scripts`
- Branch: `main`
- Latest commit: `a3026aea93b9`
- Mode: Changes since 831d5c3

- `a3026ae` 2026-06-12 — docs: suppress archived repositories in orchestration
  Files: `skills/maintainer-orchestrator/SKILL.md`
- `378b62b` 2026-06-11 — docs: add confidentiality guardrail
  Files: `AGENTS.MD`, `CHANGELOG.md`
- `ec018f4` 2026-06-11 — docs: generalize dependency freshness policy
  Files: `skills/maintainer-orchestrator/SKILL.md`
- `2df552b` 2026-06-11 — docs: add idle dependency freshness policy
  Files: `skills/maintainer-orchestrator/SKILL.md`
- `d70b69a` 2026-06-11 — docs: require public model identifier audit
  Files: `skills/maintainer-orchestrator/SKILL.md`
- `ccb28e0` 2026-06-11 — docs: improve maintainer decision briefs
  Files: `CHANGELOG.md`, `skills/maintainer-orchestrator/SKILL.md`, `skills/maintainer-orchestrator/agents/openai.yaml`

## The Library

- URL: https://github.com/disler/the-library
- Local path: `.reference-repos/disler/the-library`
- Branch: `main`
- Latest commit: `47f455cd139b`
- Mode: No new commits since 47f455c

- No commits found.

## Candidate Tasks

- [ ] YouStacks skill ergonomics: Compare this skill packaging or validation pattern against bundled skills, stack manifests, and `youmd stack doctor` warnings.
  Source: Agent Scripts a3026ae: docs: suppress archived repositories in orchestration
- [ ] Cross-agent instruction portability: Review whether this upstream shared-instruction pattern should improve `youmd skill init-project`, host adapters, or repo-local pointer rules.
  Source: Agent Scripts 378b62b: docs: add confidentiality guardrail
- [ ] YouStacks skill ergonomics: Compare this skill packaging or validation pattern against bundled skills, stack manifests, and `youmd stack doctor` warnings.
  Source: Agent Scripts ec018f4: docs: generalize dependency freshness policy
- [ ] YouStacks skill ergonomics: Compare this skill packaging or validation pattern against bundled skills, stack manifests, and `youmd stack doctor` warnings.
  Source: Agent Scripts 2df552b: docs: add idle dependency freshness policy
- [ ] YouStacks skill ergonomics: Compare this skill packaging or validation pattern against bundled skills, stack manifests, and `youmd stack doctor` warnings.
  Source: Agent Scripts d70b69a: docs: require public model identifier audit
- [ ] YouStacks skill ergonomics: Compare this skill packaging or validation pattern against bundled skills, stack manifests, and `youmd stack doctor` warnings.
  Source: Agent Scripts ccb28e0: docs: improve maintainer decision briefs
