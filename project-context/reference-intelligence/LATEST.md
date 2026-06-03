# You.md Reference Intelligence

Last updated: 2026-06-03T17:12:14.740Z

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
- Mode: Changes since 3bef43b

- `c43c850` 2026-06-02 — v1.55.1.0 fix: telemetry consent accuracy + gstack-slug cache sanitization (#1848)
  Files: `CHANGELOG.md`, `SKILL.md`, `VERSION`, `autoplan/SKILL.md`, `benchmark-models/SKILL.md`, `benchmark/SKILL.md`, `bin/gstack-slug`, `browse/SKILL.md`, +51 more

## GBrain

- URL: https://github.com/garrytan/gbrain
- Local path: `.reference-repos/garrytan/gbrain`
- Branch: `master`
- Latest commit: `f3ade6c0c3e5`
- Mode: Changes since 0bfe0d0

- `f3ade6c` 2026-06-03 — v0.42.21.0 fix(postgres): module-singleton ownership — canonical landing for the dream-cycle "connect() has not been called" class (#1404/#1471/#1619) (#1805)
  Files: `CHANGELOG.md`, `TODOS.md`, `VERSION`, `docs/architecture/KEY_FILES.md`, `package.json`, `src/cli.ts`, `src/core/db.ts`, `src/core/postgres-engine.ts`, +6 more
- `ec5fed2` 2026-06-03 — v0.42.20.0 fix: reliability wave — PGLite capture lock-pin + Postgres reconnect race + search embed-hang (#1762 #1745 #1775) (#1810)
  Files: `CHANGELOG.md`, `TODOS.md`, `VERSION`, `docs/architecture/KEY_FILES.md`, `package.json`, `src/cli.ts`, `src/core/ai/gateway.ts`, `src/core/background-work.ts`, +12 more
- `3d2add1` 2026-06-03 — v0.42.19.0 fix(skillopt): close the last gap in the AI SDK v6 tool-loop fix (write-capture mapper + regression test) (#1809)
  Files: `CHANGELOG.md`, `TODOS.md`, `VERSION`, `package.json`, `src/core/skillopt/write-capture.ts`, `test/ai/gateway-tools-schema.test.ts`, `test/skillopt/rollout-schema.test.ts`
- `bde11bb` 2026-06-03 — v0.42.18.0 fix: sync orphan-pileup watchdog (#1633) + links-lag µs stamp (#1768) (#1807)
  Files: `CHANGELOG.md`, `VERSION`, `docs/architecture/KEY_FILES.md`, `package.json`, `src/cli.ts`, `src/commands/extract.ts`, `src/commands/sync.ts`, `src/core/db-lock.ts`, +10 more
- `fd2fde9` 2026-06-03 — v0.42.17.0 fix(sync): resumable incremental sync — killed mid-import no longer loses progress (#1794) (#1808)
  Files: `CHANGELOG.md`, `VERSION`, `docs/architecture/KEY_FILES.md`, `package.json`, `src/commands/doctor.ts`, `src/commands/jobs.ts`, `src/commands/sync.ts`, `src/core/doctor-categories.ts`, +5 more
- `3fe4493` 2026-06-03 — v0.42.16.0 feat(doctor): brain health as a solved problem — cause-ranked doctor + OOM-loop line + auto-drain + pool-reap (#1685) (#1802)
  Files: `CHANGELOG.md`, `TODOS.md`, `VERSION`, `docs/architecture/KEY_FILES.md`, `package.json`, `src/commands/autopilot.ts`, `src/commands/doctor.ts`, `src/commands/dream.ts`, +23 more
- `488f89e` 2026-06-03 — v0.42.15.0 fix: decouple CLI primary output from process.stdout.isTTY (#1784) (#1806)
  Files: `CHANGELOG.md`, `TODOS.md`, `VERSION`, `docs/architecture/KEY_FILES.md`, `package.json`, `src/commands/eval-cross-modal.ts`, `src/commands/eval-suspected-contradictions.ts`, `src/commands/eval-takes-quality.ts`, +10 more
- `1036f8f` 2026-06-03 — v0.42.14.0 fix(zero-config): code-* readiness signal + init embedding-key validation + lock self-heal (#1780) (#1804)
  Files: `CHANGELOG.md`, `TODOS.md`, `VERSION`, `docs/architecture/KEY_FILES.md`, `package.json`, `src/cli.ts`, `src/commands/code-callees.ts`, `src/commands/code-callers.ts`, +13 more
- `bea2d3e` 2026-06-03 — v0.42.13.0 fix(search): archive/ content findable by default, demoted not hard-excluded (#1777) (#1797)
  Files: `CHANGELOG.md`, `VERSION`, `docs/architecture/KEY_FILES.md`, `docs/architecture/RETRIEVAL.md`, `package.json`, `src/commands/doctor.ts`, `src/core/doctor-categories.ts`, `src/core/postgres-engine.ts`, +11 more
- `a57d98b` 2026-06-03 — v0.42.12.0 feat: self-upgrading gbrain — invocation-riding update check + opt-in auto-upgrade (#1798)
  Files: `CHANGELOG.md`, `TODOS.md`, `VERSION`, `docs/guides/upgrades-auto-update.md`, `llms-full.txt`, `package.json`, `skills/RESOLVER.md`, `skills/gbrain-upgrade/SKILL.md`, +26 more
- `d4211f4` 2026-06-03 — v0.42.11.0 feat(skillopt): held-out eval gate, honest receipts, ENFORCE + ablation opts (#1759)
  Files: `AGENTS.md`, `CHANGELOG.md`, `CLAUDE.md`, `TODOS.md`, `VERSION`, `docs/RELEASING.md`, `docs/TESTING.md`, `docs/architecture/KEY_FILES.md`, +36 more
- `f09f917` 2026-06-02 — v0.42.10.0 feat(extract): opt-in global-basename wikilink resolution (closes #972) (#1388)
  Files: `CHANGELOG.md`, `CLAUDE.md`, `INSTALL_FOR_AGENTS.md`, `README.md`, `VERSION`, `llms-full.txt`, `package.json`, `scripts/llms-config.ts`, +14 more

## Agent Scripts

- URL: https://github.com/steipete/agent-scripts
- Local path: `.reference-repos/steipete/agent-scripts`
- Branch: `main`
- Latest commit: `5dc3c2435ba7`
- Mode: No new commits since 5dc3c24

- No commits found.

## The Library

- URL: https://github.com/disler/the-library
- Local path: `.reference-repos/disler/the-library`
- Branch: `main`
- Latest commit: `47f455cd139b`
- Mode: No new commits since 47f455c

- No commits found.

## Candidate Tasks

- [ ] YouStacks skill packaging: Review whether this upstream skill/agent pattern should become a YouStack artifact, bundled skill, or adapter-generation rule.
  Source: GStack c43c850: v1.55.1.0 fix: telemetry consent accuracy + gstack-slug cache sanitization (#1848)
- [ ] Docs/product education: Compare this upstream docs/example change against the homepage, `/docs`, quickstarts, and stack/brain examples.
  Source: GBrain f3ade6c: v0.42.21.0 fix(postgres): module-singleton ownership — canonical landing for the dream-cycle "connect() has not been called" class (#1404/#1471/#1619) (#1805)
- [ ] You.md retrieval layer: Compare this retrieval/indexing signal against You.md memory search, project context search, and protected brain retrieval plans.
  Source: GBrain ec5fed2: v0.42.20.0 fix: reliability wave — PGLite capture lock-pin + Postgres reconnect race + search embed-hang (#1762 #1745 #1775) (#1810)
- [ ] You.md brain/context/memory architecture review: Skim the upstream change and decide whether it should become a concrete You.md task or be recorded as no-op.
  Source: GBrain 3d2add1: v0.42.19.0 fix(skillopt): close the last gap in the AI SDK v6 tool-loop fix (write-capture mapper + regression test) (#1809)
- [ ] You.md brain sync: Evaluate whether this upstream sync or migration pattern should change GitHub repo sync, local bundle export/import, or backup behavior.
  Source: GBrain bde11bb: v0.42.18.0 fix: sync orphan-pileup watchdog (#1633) + links-lag µs stamp (#1768) (#1807)
- [ ] You.md brain sync: Evaluate whether this upstream sync or migration pattern should change GitHub repo sync, local bundle export/import, or backup behavior.
  Source: GBrain fd2fde9: v0.42.17.0 fix(sync): resumable incremental sync — killed mid-import no longer loses progress (#1794) (#1808)
- [ ] You.md brain schema/context: Review whether this upstream brain/context change should improve You.md memory categories, private context, profile files, or agent startup briefs.
  Source: GBrain 3fe4493: v0.42.16.0 feat(doctor): brain health as a solved problem — cause-ranked doctor + OOM-loop line + auto-drain + pool-reap (#1685) (#1802)
- [ ] You.md retrieval layer: Compare this retrieval/indexing signal against You.md memory search, project context search, and protected brain retrieval plans.
  Source: GBrain 488f89e: v0.42.15.0 fix: decouple CLI primary output from process.stdout.isTTY (#1784) (#1806)
- [ ] You.md retrieval layer: Compare this retrieval/indexing signal against You.md memory search, project context search, and protected brain retrieval plans.
  Source: GBrain 1036f8f: v0.42.14.0 fix(zero-config): code-* readiness signal + init embedding-key validation + lock self-heal (#1780) (#1804)
- [ ] You.md retrieval layer: Compare this retrieval/indexing signal against You.md memory search, project context search, and protected brain retrieval plans.
  Source: GBrain bea2d3e: v0.42.13.0 fix(search): archive/ content findable by default, demoted not hard-excluded (#1777) (#1797)
- [ ] You.md brain schema/context: Review whether this upstream brain/context change should improve You.md memory categories, private context, profile files, or agent startup briefs.
  Source: GBrain a57d98b: v0.42.12.0 feat: self-upgrading gbrain — invocation-riding update check + opt-in auto-upgrade (#1798)
- [ ] Docs/product education: Compare this upstream docs/example change against the homepage, `/docs`, quickstarts, and stack/brain examples.
  Source: GBrain d4211f4: v0.42.11.0 feat(skillopt): held-out eval gate, honest receipts, ENFORCE + ablation opts (#1759)
- [ ] You.md retrieval layer: Compare this retrieval/indexing signal against You.md memory search, project context search, and protected brain retrieval plans.
  Source: GBrain f09f917: v0.42.10.0 feat(extract): opt-in global-basename wikilink resolution (closes #972) (#1388)
