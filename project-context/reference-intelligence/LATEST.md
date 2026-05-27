# GStack / GBrain Reference Intelligence

Last updated: 2026-05-27T17:56:28.290Z

You.md keeps Garry Tan's GStack and GBrain as local reference repos, then turns upstream changes into reviewable tasks for YouStacks and the You.md brain/context layer. Reference repos are not vendored into this repository; they live under `.reference-repos/` and are ignored by git.

Run:

```bash
npm run references:sync
```

## GStack

- URL: https://github.com/garrytan/gstack
- Local path: `.reference-repos/garrytan/gstack`
- Branch: `main`
- Latest commit: `a6fb31726cec`
- Mode: Recent commits

- `a6fb317` 2026-05-26 — v1.48.0.0 feat: AskUserQuestion split rule + runtime AUTO_DECIDE carve-out (#1740)
  Files: `CHANGELOG.md`, `VERSION`, `autoplan/SKILL.md`, `bin/gstack-question-preference`, `canary/SKILL.md`, `codex/SKILL.md`, `context-restore/SKILL.md`, `context-save/SKILL.md`, +52 more
- `f8bb590` 2026-05-26 — v1.47.0.0 feat: /spec — author backlog-ready spec in 5 phases + optional agent spawn (#1698) (#1733)
  Files: `AGENTS.md`, `CHANGELOG.md`, `CLAUDE.md`, `README.md`, `SKILL.md`, `SKILL.md.tmpl`, `TODOS.md`, `VERSION`, +60 more
- `22f8c7f` 2026-05-26 — v1.46.0.0 feat: gstack v2 foundation — catalog tokens drop 56%, eval-first floor covers all 51 skills (#1712)
  Files: `CHANGELOG.md`, `SKILL.md`, `VERSION`, `autoplan/SKILL.md`, `benchmark-models/SKILL.md`, `benchmark/SKILL.md`, `browse/SKILL.md`, `canary/SKILL.md`, +83 more
- `cf50443` 2026-05-25 — v1.45.0.0 feat(design): persistent board daemon — 24h boards, one tab, board history (#1710)
  Files: `CHANGELOG.md`, `TODOS.md`, `VERSION`, `design-consultation/SKILL.md`, `design-shotgun/SKILL.md`, `design/src/cli.ts`, `design/src/commands.ts`, `design/src/compare.ts`, +14 more
- `64f9aaf` 2026-05-25 — v1.44.1.0 fix wave: post-windhoek paper-cut — 9 community PRs in one bundle (#1682)
  Files: `.github/workflows/windows-free-tests.yml`, `CHANGELOG.md`, `VERSION`, `bin/gstack-brain-sync`, `bin/gstack-developer-profile`, `bin/gstack-diff-scope`, `bin/gstack-next-version`, `bin/gstack-timeline-read`, +21 more
- `920a13a` 2026-05-24 — v1.44.0.0 feat: long-lived sidebar — keepalive, restart, re-attach, scrollback replay (#1678)
  Files: `CHANGELOG.md`, `CLAUDE.md`, `TODOS.md`, `VERSION`, `browse/src/cli.ts`, `browse/src/pty-session-lease.ts`, `browse/src/server.ts`, `browse/src/terminal-agent-control.ts`, +25 more
- `61c9a20` 2026-05-21 — v1.43.3.0 fix(browse): headed-mode idle timer + onDisconnect target wrong BrowserManager for embedders (#1645)
  Files: `CHANGELOG.md`, `VERSION`, `browse/src/server.ts`, `browse/test/server-factory.test.ts`, `browse/test/sidebar-ux.test.ts`
- `66f3a18` 2026-05-21 — v1.43.2.0 fix wave: post-Daegu paper-cut — 18 fixes, 28 bisect commits (#1642)
  Files: `CHANGELOG.md`, `VERSION`, `bin/gstack-artifacts-url`, `bin/gstack-config`, `bin/gstack-gbrain-detect`, `bin/gstack-gbrain-lib.sh`, `bin/gstack-gbrain-supabase-provision`, `bin/gstack-gbrain-sync.ts`, +47 more
- `65972f6` 2026-05-21 — v1.43.1.0 feat: default PGLite to voyage-code-3 for code search + e2e tests (#1639)
  Files: `CHANGELOG.md`, `CLAUDE.md`, `USING_GBRAIN_WITH_GSTACK.md`, `VERSION`, `bin/gstack-gbrain-install`, `package.json`, `setup-gbrain/SKILL.md`, `setup-gbrain/SKILL.md.tmpl`, +4 more
- `1d9b9c4` 2026-05-21 — v1.43.0.0 feat: iOS device-farm (5 skills, Mac daemon, Tailscale) (#1574)
  Files: `AGENTS.md`, `CHANGELOG.md`, `README.md`, `VERSION`, `bin/gstack-ios-qa-daemon`, `bin/gstack-ios-qa-mint`, `docs/howto-ios-testing-with-gstack.md`, `docs/skills.md`, +66 more
- `029356e` 2026-05-20 — v1.42.2.0 fix wave: browse launch hardening (2 bug fixes + headed exit-code wiring) (#1629)
  Files: `CHANGELOG.md`, `VERSION`, `browse/src/browser-manager.ts`, `browse/src/server.ts`, `browse/test/browser-manager-unit.test.ts`, `package.json`
- `b03cd1a` 2026-05-20 — v1.42.1.0 feat: gate terminal-agent teardown on ServerConfig.ownsTerminalAgent (unblocks gbrowser embedder) (#1615)
  Files: `CHANGELOG.md`, `CLAUDE.md`, `TODOS.md`, `VERSION`, `browse/src/server.ts`, `browse/test/server-embedder-terminal-port.test.ts`, `package.json`

## GBrain

- URL: https://github.com/garrytan/gbrain
- Local path: `.reference-repos/garrytan/gbrain`
- Branch: `master`
- Latest commit: `42d99b6fca3b`
- Mode: Recent commits

- `42d99b6` 2026-05-27 — v0.41.26.0 fix: dream --source + ingest junk titles + emoji-crash (supersedes #1559, #1561) (#1571)
  Files: `CHANGELOG.md`, `TODOS.md`, `VERSION`, `package.json`, `src/commands/dream.ts`, `src/core/content-sanity.ts`, `src/core/cycle/synthesize.ts`, `test/content-sanity.test.ts`, +4 more
- `ff32fca` 2026-05-27 — v0.41.25.0 perf(sync): batched deletes + global page-generation clock (supersedes #1538) (#1566)
  Files: `CHANGELOG.md`, `CLAUDE.md`, `VERSION`, `llms-full.txt`, `package.json`, `scripts/run-unit-parallel.sh`, `src/commands/sync.ts`, `src/core/engine-constants.ts`, +16 more
- `726dfff` 2026-05-27 — v0.41.24.0 fix(conversation-parser): threshold gates + bold-paren-time pattern — 20,167 Circleback messages unblocked (closes #1533) (#1543)
  Files: `CHANGELOG.md`, `CLAUDE.md`, `VERSION`, `llms-full.txt`, `package.json`, `src/core/conversation-parser/builtins.ts`, `src/core/conversation-parser/parse.ts`, `test/conversation-parser/parse.test.ts`
- `48e1000` 2026-05-27 — v0.41.23.0 feat: extract operator surfaces + pack-driven extractables (#1541)
  Files: `CHANGELOG.md`, `CLAUDE.md`, `VERSION`, `llms-full.txt`, `package.json`, `src/commands/doctor.ts`, `src/commands/extract-benchmark.ts`, `src/commands/extract-conversation-facts.ts`, +30 more
- `127842e` 2026-05-27 — v0.41.22.1 feat: brainstorm/lsd judge fixes (closes #1540 end-to-end) (#1562)
  Files: `CHANGELOG.md`, `CLAUDE.md`, `README.md`, `TODOS.md`, `VERSION`, `llms-full.txt`, `package.json`, `src/core/ai/model-resolver.ts`, +15 more
- `5d42f32` 2026-05-27 — v0.41.22.0 feat: type-unification cathedral — 94 types → 15 canonical (closes #1479) (#1542)
  Files: `CHANGELOG.md`, `README.md`, `VERSION`, `docs/architecture/pack-upgrade-mechanism.md`, `docs/architecture/type-taxonomy.md`, `llms-full.txt`, `package.json`, `skills/RESOLVER.md`, +50 more
- `543f9a7` 2026-05-27 — v0.41.21.0 feat(ops): 5 daily-driver pains fixed in one wave (#1545)
  Files: `CHANGELOG.md`, `CLAUDE.md`, `TODOS.md`, `VERSION`, `llms-full.txt`, `package.json`, `skills/cron-scheduler/SKILL.md`, `src/commands/doctor.ts`, +19 more
- `a74e5d9` 2026-05-26 — v0.41.20.0 feat: gbrain status + doctor --scope=brain (fix wave 2: items #6 + #7) (#1544)
  Files: `CHANGELOG.md`, `TODOS.md`, `VERSION`, `package.json`, `src/cli.ts`, `src/commands/doctor.ts`, `src/commands/status.ts`, `src/core/doctor-categories.ts`, +8 more
- `a7b79b6` 2026-05-26 — feat: v0.41.19.0 Supavisor Retry Cathedral (#1537)
  Files: `CHANGELOG.md`, `CLAUDE.md`, `README.md`, `VERSION`, `llms-full.txt`, `package.json`, `scripts/check-batch-audit-site.sh`, `scripts/check-no-double-retry.sh`, +16 more
- `10816cb` 2026-05-26 — v0.41.18.0: gbrain onboard — the activation surface gbrain didn't have before (#1521)
  Files: `CHANGELOG.md`, `INSTALL_FOR_AGENTS.md`, `TODOS.md`, `VERSION`, `llms-full.txt`, `package.json`, `scripts/check-source-scope-onboard.sh`, `scripts/run-verify-parallel.sh`, +36 more
- `8ab7334` 2026-05-26 — v0.41.17.0 feat: --workers N on every bulk command + facts dim doctor parity (#1519)
  Files: `CHANGELOG.md`, `CLAUDE.md`, `TODOS.md`, `VERSION`, `llms-full.txt`, `package.json`, `scripts/check-worker-pool-atomicity.sh`, `scripts/run-verify-parallel.sh`, +28 more
- `f702ec0` 2026-05-26 — v0.41.16.0 feat: conversation parser cathedral + progressive-batch primitive (closes #1461) (#1510)
  Files: `CHANGELOG.md`, `CLAUDE.md`, `TODOS.md`, `VERSION`, `llms-full.txt`, `package.json`, `scripts/check-fixture-privacy.sh`, `scripts/check-privacy.sh`, +55 more

## Candidate Tasks

- [ ] YouStacks skill packaging: Review whether this upstream skill/agent pattern should become a YouStack artifact, bundled skill, or adapter-generation rule.
  Source: GStack a6fb317: v1.48.0.0 feat: AskUserQuestion split rule + runtime AUTO_DECIDE carve-out (#1740)
- [ ] YouStacks skill packaging: Review whether this upstream skill/agent pattern should become a YouStack artifact, bundled skill, or adapter-generation rule.
  Source: GStack f8bb590: v1.47.0.0 feat: /spec — author backlog-ready spec in 5 phases + optional agent spawn (#1698) (#1733)
- [ ] YouStacks skill packaging: Review whether this upstream skill/agent pattern should become a YouStack artifact, bundled skill, or adapter-generation rule.
  Source: GStack 22f8c7f: v1.46.0.0 feat: gstack v2 foundation — catalog tokens drop 56%, eval-first floor covers all 51 skills (#1712)
- [ ] YouStacks skill packaging: Review whether this upstream skill/agent pattern should become a YouStack artifact, bundled skill, or adapter-generation rule.
  Source: GStack cf50443: v1.45.0.0 feat(design): persistent board daemon — 24h boards, one tab, board history (#1710)
- [ ] YouStacks skill packaging: Review whether this upstream skill/agent pattern should become a YouStack artifact, bundled skill, or adapter-generation rule.
  Source: GStack 64f9aaf: v1.44.1.0 fix wave: post-windhoek paper-cut — 9 community PRs in one bundle (#1682)
- [ ] YouStacks skill packaging: Review whether this upstream skill/agent pattern should become a YouStack artifact, bundled skill, or adapter-generation rule.
  Source: GStack 920a13a: v1.44.0.0 feat: long-lived sidebar — keepalive, restart, re-attach, scrollback replay (#1678)
- [ ] YouStacks workflow quality gates: Consider adding or refining stack workflows, smoke tests, evals, or release-review loops based on this upstream quality pattern.
  Source: GStack 61c9a20: v1.43.3.0 fix(browse): headed-mode idle timer + onDisconnect target wrong BrowserManager for embedders (#1645)
- [ ] YouStacks skill packaging: Review whether this upstream skill/agent pattern should become a YouStack artifact, bundled skill, or adapter-generation rule.
  Source: GStack 66f3a18: v1.43.2.0 fix wave: post-Daegu paper-cut — 18 fixes, 28 bisect commits (#1642)
- [ ] YouStacks skill packaging: Review whether this upstream skill/agent pattern should become a YouStack artifact, bundled skill, or adapter-generation rule.
  Source: GStack 65972f6: v1.43.1.0 feat: default PGLite to voyage-code-3 for code search + e2e tests (#1639)
- [ ] YouStacks skill packaging: Review whether this upstream skill/agent pattern should become a YouStack artifact, bundled skill, or adapter-generation rule.
  Source: GStack 1d9b9c4: v1.43.0.0 feat: iOS device-farm (5 skills, Mac daemon, Tailscale) (#1574)
- [ ] YouStacks workflow quality gates: Consider adding or refining stack workflows, smoke tests, evals, or release-review loops based on this upstream quality pattern.
  Source: GStack 029356e: v1.42.2.0 fix wave: browse launch hardening (2 bug fixes + headed exit-code wiring) (#1629)
- [ ] YouStacks skill packaging: Review whether this upstream skill/agent pattern should become a YouStack artifact, bundled skill, or adapter-generation rule.
  Source: GStack b03cd1a: v1.42.1.0 feat: gate terminal-agent teardown on ServerConfig.ownsTerminalAgent (unblocks gbrowser embedder) (#1615)
- [ ] You.md brain sync: Evaluate whether this upstream sync or migration pattern should change GitHub repo sync, local bundle export/import, or backup behavior.
  Source: GBrain 42d99b6: v0.41.26.0 fix: dream --source + ingest junk titles + emoji-crash (supersedes #1559, #1561) (#1571)
- [ ] You.md retrieval layer: Compare this retrieval/indexing signal against You.md memory search, project context search, and protected brain retrieval plans.
  Source: GBrain ff32fca: v0.41.25.0 perf(sync): batched deletes + global page-generation clock (supersedes #1538) (#1566)
- [ ] You.md brain/context/memory architecture review: Skim the upstream change and decide whether it should become a concrete You.md task or be recorded as no-op.
  Source: GBrain 726dfff: v0.41.24.0 fix(conversation-parser): threshold gates + bold-paren-time pattern — 20,167 Circleback messages unblocked (closes #1533) (#1543)
- [ ] You.md brain schema/context: Review whether this upstream brain/context change should improve You.md memory categories, private context, profile files, or agent startup briefs.
  Source: GBrain 48e1000: v0.41.23.0 feat: extract operator surfaces + pack-driven extractables (#1541)
- [ ] You.md brain schema/context: Review whether this upstream brain/context change should improve You.md memory categories, private context, profile files, or agent startup briefs.
  Source: GBrain 127842e: v0.41.22.1 feat: brainstorm/lsd judge fixes (closes #1540 end-to-end) (#1562)
- [ ] You.md brain schema/context: Review whether this upstream brain/context change should improve You.md memory categories, private context, profile files, or agent startup briefs.
  Source: GBrain 5d42f32: v0.41.22.0 feat: type-unification cathedral — 94 types → 15 canonical (closes #1479) (#1542)
- [ ] You.md brain sync: Evaluate whether this upstream sync or migration pattern should change GitHub repo sync, local bundle export/import, or backup behavior.
  Source: GBrain 543f9a7: v0.41.21.0 feat(ops): 5 daily-driver pains fixed in one wave (#1545)
- [ ] You.md brain schema/context: Review whether this upstream brain/context change should improve You.md memory categories, private context, profile files, or agent startup briefs.
  Source: GBrain a74e5d9: v0.41.20.0 feat: gbrain status + doctor --scope=brain (fix wave 2: items #6 + #7) (#1544)
- [ ] Docs/product education: Compare this upstream docs/example change against the homepage, `/docs`, quickstarts, and stack/brain examples.
  Source: GBrain a7b79b6: feat: v0.41.19.0 Supavisor Retry Cathedral (#1537)
- [ ] You.md brain schema/context: Review whether this upstream brain/context change should improve You.md memory categories, private context, profile files, or agent startup briefs.
  Source: GBrain 10816cb: v0.41.18.0: gbrain onboard — the activation surface gbrain didn't have before (#1521)
- [ ] You.md retrieval layer: Compare this retrieval/indexing signal against You.md memory search, project context search, and protected brain retrieval plans.
  Source: GBrain 8ab7334: v0.41.17.0 feat: --workers N on every bulk command + facts dim doctor parity (#1519)
- [ ] You.md brain schema/context: Review whether this upstream brain/context change should improve You.md memory categories, private context, profile files, or agent startup briefs.
  Source: GBrain f702ec0: v0.41.16.0 feat: conversation parser cathedral + progressive-batch primitive (closes #1461) (#1510)
