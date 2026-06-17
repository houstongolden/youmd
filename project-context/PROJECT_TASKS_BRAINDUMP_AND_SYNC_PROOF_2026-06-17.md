# Project Tasks, Brain Dumps, and Sync Proof

Date: 2026-06-17

## Goal

Make You.md the living operating layer for Houston's project portfolio: every
active project has strategy context, API/MCP ownership, reusable patterns,
human/agent tasks, brain-dump intake, and repo-backed proof that agents can
update the portable brain without stale dashboard state.

## Pain Points

- Houston is running many ambitious products and research lanes at once, so
  unstructured ideas and repeated decisions get lost or repeated.
- Agents can create duplicate APIs, duplicate skills, or duplicate UI/code
  patterns when they do not see cross-project ownership.
- The shell can imply GitHub sync while the visible repo mirror timestamp stays
  stale, eroding trust.
- Research/voice notes/long-run ideas can become one-off transcripts instead
  of durable tasks, project context, reusable patterns, or agent work queues.

## Solution

You.md stores a portfolio graph and task graph beside the identity brain:

- `portfolioProjects`: project strategy, goals, vision, pain points, solution,
  positioning, audience, metrics, constraints, not-building notes, competitors,
  docs, repos, tags, and activity.
- `portfolioApiSurfaces`: API/MCP/SkillStack/provider ownership, auth mode,
  write policy, integration types, features, risk, and docs.
- `portfolioDependencyEdges`: who depends on whom, integration tier, feature
  impact, and failure impact.
- `portfolioReusablePatterns`: canonical or candidate UI/code/auth/stack
  patterns organized by owner, tech stack, source path, and usage projects.
- `portfolioTasks`: project-associated or uncategorized tasks with explicit
  owner type: `human` for Houston or `agent` for local/web agents.
- `brainDumpCaptures`: raw capture first, then summary, insights, tags,
  project links, and generated task proposals.

## Success Conditions

- The shell `[ update ]` button publishes, pushes to the linked GitHub repo,
  refreshes the server mirror, streams a transcript, and makes the GitHub icon
  timestamp visibly fresh.
- Local agents calling `get_project_context` receive a portfolio slice before
  they add APIs, MCP routes, stack skills, env conventions, or reusable UI/code.
- You Agent and local agents can separate "Houston needs to do this" from
  "agent should do this" in the same task graph.
- Brain dumps from shell, CLI, SMS/iMessage, Slack, Bad.app, or Watch capture
  preserve raw text and become searchable summaries, insights, project links,
  and tasks.

## Not Building Yet

- Not building an OpenRouter-style API resale platform.
- Not exposing raw API keys or decrypted `.env.local` values in the browser.
- Not making Bad.app the canonical owner of the brain-dump intelligence layer;
  Bad.app can be an upstream capture source.
- Not auto-writing arbitrary external project repos with auto-merge. Autonomous
  PR/merge is scoped to the user's own You.md repo.
- Not treating a static dashboard mock as complete without authenticated local
  web/CLI verification.

## Watch / Workout Capture Direction

Bad.app can provide the Apple Watch/iPhone capture UX: quick voice trigger,
timestamped workout transcript, and reliable delivery. You.md owns the durable
brain-dump event, synthesis, project routing, and task extraction. The desired
experience is "Fireflies for workout thoughts": raw transcript, AI summary,
follow-up tasks, project links, reusable insights, and agent work items.

## Completion Rule

This lane is not complete until the code is built, local MCP is proven, shared
skills are synced, and authenticated Chrome/local shell testing proves the
GitHub status and task/graph paths behave in the actual product.

## Verification Snapshot

- Root `npm run build` passed after the schema/API changes.
- `npm run test:convex` passed with 41 files and 421 tests.
- `npx tsc -p convex/tsconfig.json --noEmit` passed.
- `cd cli && npm run build` passed.
- Local MCP `get_project_context` returned a `portfolioGraph` slice for `youmd`.
- Shared `braindump-task-router` was synced through the shared agent layer into
  Claude, Codex, Cursor, and Pi mirrors.
- Authenticated Chrome QA on local `/shell` clicked `[ update ]`; the GitHub
  chrome moved through `SYNCING`, streamed publish/push/mirror steps, merged
  PR #5 for `houstongolden/houstongolden-you-md`, and returned to
  `SYNCED / REPO MIRROR CURRENT / JUST NOW`.
- Follow-up authenticated Chrome QA on local `/shell` opened the Portfolio Graph
  pane, verified the initial bootstrap state, deployed the new Convex mutation,
  refreshed the pane, and proved the first persisted seed path. That 4-project
  seed proof was intentionally treated as insufficient after Houston's follow-up
  correction; the graph now has to hydrate from real local/GitHub activity.
- `youmd project portfolio-audit --root /Users/houstongolden/Desktop/CODE_2025`
  ran the real local portfolio auditor across the workspace. It found 268
  project/package candidates, 23 env files, and 97 providers without printing
  secret values.
- `~/.agent-shared/bin/env-key-audit.py --root /Users/houstongolden/Desktop/CODE_2025`
  ran as the secret-safety cross-check. It printed only key names and reported
  missing `.env.example` coverage for `bamfaiapp` and `bamfsite`; it did not
  expose secret values.
- `youmd project portfolio-hydrate --root /Users/houstongolden/Desktop/CODE_2025 --days 90 --limit 80`
  ran the corrected hydration path. It scanned 129 recent local candidates,
  upserted 30 local projects, considered 40 authenticated GitHub tracked
  projects, created 36 portfolio rows, and updated 4 on the initial corrective
  run. Final deployed reruns refreshed 40 tracked rows and 30 local rows without
  creating duplicates.
- Follow-up strategy enrichment ran the compiled hydrate path again, refreshed
  40 GitHub-tracked rows and 30 local-audit rows, and verified the authenticated
  API snapshot contained `55` persisted projects, `30` enriched strategy
  records, `5` tasks, and zero known setup/build/PRD-title snippet matches.
  Signed-in Codex in-app Browser QA screenshot-verified `STRATEGY INTELLIGENCE`
  for `bamfsite` with private BAMF OS API/MCP context at
  `/tmp/youmd-portfolio-strategy-section-2026-06-17-v4.png`.
- `portfolioProjectActivities` now persists local commit/PR/summary evidence
  from that hydration path, and the Portfolio Graph pane renders shipped
  `today` / `7d` / `30d` chips plus a project shipping timeline.
- Authenticated local browser QA then opened the Portfolio Graph pane and
  verified `55 PROJECTS`, `CONVEX PERSISTED GRAPH`, `40 recent GitHub-tracked
  projects nearby`, the `hydrate active projects` control, and hydrated rows
  including `badapp`, `bamfaiapp`, `bamfsite`, `bigbounce`, `foldermd`, `youmd`,
  `claws`, and `creator-new`.
- Authenticated local browser QA after ranking/timeline work verified the first
  visible projects are high-signal (`bamfsite`, `youmd`, `fantasyis`,
  `bigbounce`) and captured visual proof:
  `/tmp/youmd-portfolio-activity-proof-2026-06-17-v2.png` and
  `/tmp/youmd-portfolio-timeline-proof-2026-06-17-v3.png`.
- Authenticated Codex in-app Browser QA now also verifies the signed-in Machine
  readiness surface at `http://localhost:3100/shell` under `/machine` /
  `stacks -> machine`. The pane shows `3/3` daemons loaded, `61` project
  directories scanned, `35` git repos, `32` package projects, `17` `.env.local`
  files, `19` env examples, `21` agent-doc roots, `21` project-context roots,
  `api key present READY`, Codex/Claude MCP config readiness, env
  audit/backup/restore readiness, and `secret values exposed: false`. The
  fresh-root toggle shows the `CODE_YOU` target blocker before a real clean-host
  run. Screenshots:
  `/tmp/youmd-machine-readiness-pane-2026-06-17-v2.png` and
  `/tmp/youmd-machine-readiness-stack-env-proof-2026-06-17-v2.png`.
- The global `youmd` binary on this machine was refreshed from the local
  `cli/` package so the dashboard's copyable command works outside the repo:
  `youmd machine verify --root /Users/houstongolden/Desktop/CODE_2025` reports
  `61` project directories scanned, `26` ready projects, `2` needing env
  restore, and `8` partial projects; `youmd stack daemon status` reports all
  three resident sync daemons loaded.
- `youmd machine verify` now has the bounded local-run proof path needed before
  the actual clean-host run: `--install-deps` for capped dependency installs,
  `--run-checks` for package scripts, and `--probe-servers` for local dev-server
  HTTP probes. The generated fresh-machine command exposes
  `YOUMD_INSTALL_DEPS=1`, `YOUMD_RUN_CHECKS=1`, and `YOUMD_PROBE_SERVERS=1`.
  Compiled CLI smoke verified a disposable project where `npm install` passed
  and `npm run dev` returned HTTP 200 on localhost; the actual brand-new
  computer run remains pending.
- `youmd machine verify --write-report` now persists a secret-safe proof artifact
  at `~/.youmd/machine-reports/latest.json` plus a timestamped archive. The
  proof includes host/root/status/project totals/install/check/server pass
  counts/warnings and keeps `secretValuesExposed: false`; output tails are
  redacted before writing. The Machine pane server builder reads the latest
  proof and now exposes the summary plus full fresh-root proof command. Current
  local proof: `warn`, `61` scanned projects, `26` ready, `2` needing env
  restore, `8` partial, and zero proof failures. Authenticated browser visual
  proof for this new strip is pending because no attachable authenticated
  browser session was available in this turn.
- Authenticated Chrome QA opened `/shell?integration=github`, clicked
  `refresh active projects`, waited through the 90-day GitHub analyzer, and
  verified the dashboard catalog returned with 38 visible `repo:
  houstongolden/...` rows. The rows include repo, directory, stack, API/MCP
  docs links, goal, and recent progress; the top GitHub status also refreshed
  back to `JUST NOW`.
- Authenticated Chrome QA on local `/shell` sent `/braindump project:youmd ...`
  from the shell chat. The command saved a `brainDumpCaptures` record, proposed
  agent-owned `portfolioTasks`, wrote the repo-backed snapshot
  `projects/_braindumps/recent.md` into `you.json.custom_files`, queued the
  GitHub update loop from chat, pushed `you.md` and `you.json` through PR #7,
  merged the PR, refreshed 47 mirrored files, displayed the capture under
  `RECENT BRAIN DUMPS`, and returned the GitHub chrome to
  `SYNCED / REPO MIRROR CURRENT / JUST NOW`.
- Authenticated Chrome QA then sent `/task me personal: ...` from shell chat.
  The command saved a human-owned personal `portfolioTasks` record, displayed it
  as `HUMAN / PERSONAL` under open tasks, wrote
  `projects/_personal/tasks.md` into `you.json.custom_files`, pushed through PR
  #8, merged the PR, refreshed 47 mirrored files, and kept the GitHub chrome at
  `SYNCED / REPO MIRROR CURRENT / JUST NOW`.
- CLI/local-agent proof added authenticated API endpoints for local agents:
  `POST /api/v1/me/portfolio/tasks` and
  `POST /api/v1/me/portfolio/brain-dumps`. They write Convex records, update
  repo-backed markdown snapshots, publish the bundle, push to the linked GitHub
  repo, and refresh the mirror through the same trusted owner path.
- `youmd project task agent youmd: verify local CLI portfolio task sync proof
  from Codex --priority high --tags cli-proof,local-agent,youmd` saved the task
  into `portfolioTasks`, wrote `projects/youmd/tasks.md`, published bundle
  v100, pushed and merged PR #9, and refreshed the repo mirror.
- `youmd project braindump project:youmd ... --agent-task "Verify CLI-created
  brain dump appears in Portfolio Graph and repo mirror"` saved the raw
  `brainDumpCaptures` record, proposed an agent-owned task, wrote
  `projects/_braindumps/recent.md`, published bundle v102, pushed and merged
  PR #10, and refreshed the repo mirror.
- GitHub verified PR #9 merged at `2026-06-17T06:39:33Z` and PR #10 merged at
  `2026-06-17T06:39:59Z` in `houstongolden/houstongolden-you-md`. GitHub
  contents now include `projects/youmd/tasks.md` and
  `projects/_braindumps/recent.md`, and the repo mirror lists 50 files.
- Authenticated local browser QA opened the Portfolio Graph pane and verified
  `CONVEX PERSISTED GRAPH`, the CLI-created task row, the CLI-created
  brain-dump summary, `RECENT BRAIN DUMPS`, and fresh GitHub status. The status
  was green/current; by the screenshot pass it read minutes ago because the
  CLI/GitHub verification had already elapsed.
- Local MCP registry proof confirmed `upsert_portfolio_task` and
  `record_brain_dump` are present in the built CLI tool registry, so Claude,
  Codex, Cursor, and other local MCP clients can call the same API-backed write
  path instead of relying on static dashboard data.
- Local MCP registry proof also confirmed `hydrate_portfolio_graph` is present,
  so agents can trigger tracked-project portfolio hydration without relying on a
  manual dashboard click.
- Local strategy enrichment now reads README plus `project-context` PRD,
  overview, tasks, design, research, and ideas files, filters setup-only docs
  such as `.env.example`, local preview URLs, build commands, tech-stack
  snippets, and PRD title blocks, and persists project strategy fields through
  the same owner-gated hydrate API.
- Follow-up task triage work added `portfolio.updateTaskTriage`,
  `POST /api/v1/me/portfolio/tasks/triage`, and local MCP
  `update_portfolio_task` so existing tasks can move through status/priority
  states without duplicate task creation.
- Authenticated local browser QA created a no-sync QA task, opened the Portfolio
  Graph pane, verified `TASK TRIAGE`, clicked `urgent`, `doing`, and `done`, and
  observed `task triaged: done / urgent`. Screenshot:
  `/tmp/youmd-task-triage-controls-2026-06-17.png`.
- API/local-agent proof created a no-sync task through the built CLI API helper,
  triaged it through `/api/v1/me/portfolio/tasks/triage` to `done / urgent`, and
  verified the response kept `repoSync.attempted=false`.
- Fresh Codex in-app Browser QA reopened authenticated local `/shell`, verified
  the GitHub chrome started at `synced / repo mirror current / 1h ago`, clicked
  the real `[ update ]` button, and observed the UI move through `syncing` /
  `updating` into `synced / repo mirror current / just now`.
- The same rendered shell transcript showed `published v108`, pushed `you.md`,
  `you.json`, `projects/_braindumps/recent.md`, `projects/_personal/tasks.md`,
  and `projects/youmd/tasks.md`, used `route: pr`, linked PR #11, reported
  `merge: complete`, and refreshed the mirror to 50 files.
- GitHub independently verified PR #11 as `MERGED` at
  `2026-06-17T09:43:00Z` with merge commit
  `a8188ac7bcfe905d3767997d63fdd177e1bbdf99`. Visual proof screenshot:
  `/tmp/youmd-shell-update-proof-2026-06-17-pr11.png`.
- Persisted update history now has a verified first slice. Added
  `repoUpdateRuns` and `repoUpdateSteps`, deployed Convex, clicked the real
  local `[ update ]` button again in the Codex in-app Browser, and verified
  PR #12 appeared in the account/GitHub pane `UPDATE HISTORY` section.
- The expanded persisted history row showed `published v109`, pushed `you.md`,
  `you.json`, `projects/_braindumps/recent.md`,
  `projects/_personal/tasks.md`, and `projects/youmd/tasks.md`, linked
  `open PR #12`, stored commit `021870e5a1f0`, and rendered ordered
  `update started`, `publish current You.md bundle`, `push identity files to
  linked GitHub repo`, and `refresh server mirror` steps.
- Visual proof screenshot:
  `/tmp/youmd-update-history-proof-2026-06-17-pr12.png`.
- Follow-up update history timeline work now records GitHub-specific steps from
  the PR helper. A real authenticated Codex in-app Browser run clicked local
  `[ update ]`, streamed explicit `check merge conflict state` and
  `check GitHub merge gate` transcript lines, merged PR #13, and refreshed the
  mirror to 50 files.
- The expanded persisted PR #13 history row showed `resolve default branch
  head`, `create sync branch commit`, `open identity sync PR`,
  `attempt squash merge`, `check merge conflict state`, `check GitHub merge
  gate`, and `refresh server mirror` rows.
- GitHub independently verified PR #13 as `MERGED` at
  `2026-06-17T10:15:47Z` with merge commit
  `ceaf1771eca3e9f58eb8fbe8d13bef4b152e9621`.
- Visual proof screenshots:
  `/tmp/youmd-update-history-timeline-proof-2026-06-17-pr13.png` and
  `/tmp/youmd-update-history-timeline-detail-proof-2026-06-17-pr13.png`.
- Forced 409 conflict-path proof is now covered by
  `convex/githubAgentSync.test.ts`: the test mocks GitHub, makes the first
  PR merge return `409`, and verifies stale branch deletion, fresh default-head
  branch recreation, merge retry, `branchRecreated: true`, and conflict
  timeline rows.
- Persisted portfolio graph repo snapshots are now verified. `pushToRepo`
  writes `projects/_portfolio/README.md`, `projects/_portfolio/graph.md`, and
  compact `projects/_portfolio/graph.json` from the Convex portfolio graph.
- Authenticated Codex in-app Browser QA clicked local `[ update ]`, merged
  PR #15, showed all three `projects/_portfolio/*` files in the pushed list,
  and refreshed the server mirror to `53 files`.
- GitHub independently verified PR #15 as `MERGED` at
  `2026-06-17T10:41:46Z` with merge commit
  `819bddc31ad7c336f38978642df618c995225bba`; `graph.json` is `114299`
  bytes on `main`, below the mirror file cap.
- Visual proof screenshot:
  `/tmp/youmd-portfolio-repo-snapshot-proof-2026-06-17-pr15.png`.
- Scanner-derived reusable patterns are now persisted instead of relying only
  on hand-written seed records. `youmd project portfolio-hydrate --root
  /Users/houstongolden/Desktop/CODE_2025 --days 90 --limit 80` mined `8`
  reusable pattern families from `30` active projects / `8240` signal files,
  refreshed `40` GitHub-tracked rows and `30` local-audit rows, and updated
  `8` `portfolioReusablePatterns` records.
- Authenticated API proof verified the graph now has `55` projects and `11`
  reusable patterns, including `agent-streaming-progress`,
  `agentic-shell-layout`, `api-mcp-skillstack-first`,
  `first-party-passwordless-auth`, `task-braindump-router`,
  `convex-owner-gated-api`, `env-provider-intelligence`, and
  `project-context-operating-docs`, with no `_generated` evidence paths in the
  sample.
- Authenticated Codex in-app Browser QA verified the local `/shell` Portfolio
  pane renders `REUSABLE PATTERNS`, scanner evidence summaries, `used by`
  usage-project rows, and `evidence` source-path rows. Visual proof screenshot:
  `/tmp/youmd-reusable-patterns-scanner-proof-2026-06-17-v2.png`.

## Still Open

- Add mobile/watch invocation proof for task and brain-dump capture paths.
- Run the generated fresh-machine command on an actual clean/new host and
  verify cloned projects, restored skills, env vault restore, local servers,
  and portfolio graph sync there.
- Continue pattern-quality curation as agents find stronger canonical source
  files and reusable abstractions across active projects.
