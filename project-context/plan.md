# Plan

## Goal

Prove the You.md fresh-computer setup path without gaming done-ness: the
generated command must use the persisted Portfolio Graph, clone active projects,
restore encrypted envs when supplied, sync shared skills/stacks, write
secret-safe proof rows, and fail loudly when a real env vault is required but
missing.

## Steps

1. Re-check the latest Portfolio Graph shipped/detail/focus UI in the Codex
   in-app Browser against the real local app. Done.
2. Audit fresh-machine/env-vault prerequisites without printing secrets:
   You.md status, env-key audit, portfolio audit, env-vault preflight, and
   generated command output. Done.
3. Run a clean-root graph-backed project clone proof in `/tmp` using the
   persisted Portfolio Graph plus recent GitHub repos. Done; 5 real repos
   cloned into `/tmp/youmd-fresh-machine-proof-20260617T183447Z/CODE_YOU`.
4. Run secret-safe machine readiness proof and sync the summary to You.md.
   Done; proof row synced with `5` scanned projects and
   `secretValuesExposed: false`.
5. Patch the generated fresh-computer commands so proof mode cannot pass without
   env restore. Done; `--require-env-vault` emits
   `YOUMD_REQUIRE_ENV_VAULT=1`, and CLI/web-shell scripts stop before readiness
   completion when `YOUMD_ENV_VAULT` is missing.
6. Verify focused tests/builds and update session docs. Done locally.
7. Run the closest local strict real-vault proof in a disposable temp home/root.
   Done; it selected `43` active projects, cloned `41` repos, restored `17`
   `.env.local` files plus `3` agent-auth files, synced a proof row, and
   completed status `0` after fixing the project-bootstrap handoff.
8. Add bootstrap guards for real blockers found by the proof. Done; the
   `machine` command exits cleanly after project bootstrap and generated
   portfolio hydration is bounded by
   `YOUMD_PORTFOLIO_HYDRATE_TIMEOUT_SECONDS`.
9. Still open: run the generated command on the actual brand-new computer /
   separate clean agent host with the real encrypted env vault and verify full
   project clone count, shared skill symlinks, `.env.local` restore, local
   servers, resident daemons, authenticated visual Machine pane proof, and
   Portfolio Graph proof sync there.

## Recovery Notes

- Latest clean-root proof:
  `/tmp/youmd-fresh-machine-proof-20260617T183447Z/CODE_YOU`.
- Cloned repos:
  `youmd`, `agent-shared`, `bamfsite`, `houstongolden-you-md`, `bamfaiapp`.
- Real env-vault blocker:
  original no-vault blocker is closed for local disposable proof; a real vault
  was created with an in-process passphrase and restored without printing
  values. The remaining blocker is actual separate-host execution plus
  authenticated visual dashboard verification.
- Latest strict real-vault proof:
  `/tmp/strict-real-env-bootstrap-20260617T185635Z/CODE_YOU`.
- Latest proof row:
  `48` scanned / `41` git / `33` package / `17` env local / `25` ready /
  `8` needs-env / `4` partial / `secretValuesExposed: false`.
- Verification commands:
  `npm --prefix cli test -- machine-bootstrap-prompt`,
  `npm --prefix cli run build`,
  `node cli/dist/index.js machine prompt --require-env-vault`,
  `npx tsc --noEmit --pretty false`,
  `npm run lint -- --file src/hooks/useYouAgent.ts`,
  `npm run build`.
