# GStack / GBrain Reference Intelligence

Last updated: 2026-05-29T19:51:30.224Z

You.md keeps Garry Tan's GStack and GBrain as local reference repos, then turns upstream changes into reviewable tasks for YouStacks and the You.md brain/context layer. Reference repos are not vendored into this repository; they live under `.reference-repos/` and are ignored by git.

Run:

```bash
npm run references:sync
```

## GStack

- URL: https://github.com/garrytan/gstack
- Local path: `.reference-repos/garrytan/gstack`
- Branch: `main`
- Latest commit: `070722ace398`
- Mode: Changes since 19770ea

- `070722a` 2026-05-29 — v1.52.1.0 feat: brain-aware planning — 5 skills read structured gbrain context before asking (#1742)
  Files: `CHANGELOG.md`, `TODOS.md`, `VERSION`, `bin/gstack-brain-cache`, `bin/gstack-config`, `docs/gbrain-write-surfaces.md`, `office-hours/SKILL.md`, `office-hours/SKILL.md.tmpl`, +36 more
- `ce5fbfa` 2026-05-28 — v1.52.0.0 feat(plan-tune): explicit consent + first-run setup wizard for contributors (#1741)
  Files: `CHANGELOG.md`, `TODOS.md`, `VERSION`, `autoplan/SKILL.md`, `bin/gstack-codex-session-import`, `bin/gstack-config`, `bin/gstack-developer-profile`, `bin/gstack-distill-apply`, +80 more

## GBrain

- URL: https://github.com/garrytan/gbrain
- Local path: `.reference-repos/garrytan/gbrain`
- Branch: `master`
- Latest commit: `041d89babe7a`
- Mode: Changes since 6ae9430

- `041d89b` 2026-05-29 — v0.41.29.0 feat(conversation-parser): bold-name-no-time builtin + fix(orphans): source-scoped orphan_ratio (supersedes #1613) (#1620)
  Files: `CHANGELOG.md`, `CLAUDE.md`, `TODOS.md`, `VERSION`, `llms-full.txt`, `package.json`, `src/commands/doctor.ts`, `src/commands/orphans.ts`, +13 more
- `ffac8ce` 2026-05-28 — v0.41.27.0 fix: withRetry self-heals on null singleton + facts:absorb drain + disconnect audit (closes #1570) (#1608)
  Files: `CHANGELOG.md`, `CLAUDE.md`, `README.md`, `TODOS.md`, `VERSION`, `llms-full.txt`, `package.json`, `src/cli.ts`, +12 more
- `cb1b5f9` 2026-05-28 — v0.41.27.0 fix(doctor): git-aware sync_freshness (supersedes #1564) (#1573)
  Files: `CHANGELOG.md`, `CLAUDE.md`, `VERSION`, `llms-full.txt`, `package.json`, `src/commands/doctor.ts`, `src/core/git-head.ts`, `test/core/git-head.test.ts`, +2 more

## Candidate Tasks

- [ ] YouStacks skill packaging: Review whether this upstream skill/agent pattern should become a YouStack artifact, bundled skill, or adapter-generation rule.
  Source: GStack 070722a: v1.52.1.0 feat: brain-aware planning — 5 skills read structured gbrain context before asking (#1742)
- [ ] YouStacks skill packaging: Review whether this upstream skill/agent pattern should become a YouStack artifact, bundled skill, or adapter-generation rule.
  Source: GStack ce5fbfa: v1.52.0.0 feat(plan-tune): explicit consent + first-run setup wizard for contributors (#1741)
- [ ] You.md brain privacy/grants: Check whether this upstream auth/privacy pattern should tighten private context, stack grants, scoped tokens, or audit logs.
  Source: GBrain 041d89b: v0.41.29.0 feat(conversation-parser): bold-name-no-time builtin + fix(orphans): source-scoped orphan_ratio (supersedes #1613) (#1620)
- [ ] You.md retrieval layer: Compare this retrieval/indexing signal against You.md memory search, project context search, and protected brain retrieval plans.
  Source: GBrain ffac8ce: v0.41.27.0 fix: withRetry self-heals on null singleton + facts:absorb drain + disconnect audit (closes #1570) (#1608)
- [ ] You.md retrieval layer: Compare this retrieval/indexing signal against You.md memory search, project context search, and protected brain retrieval plans.
  Source: GBrain cb1b5f9: v0.41.27.0 fix(doctor): git-aware sync_freshness (supersedes #1564) (#1573)
