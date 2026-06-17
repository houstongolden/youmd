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

## Still Open

- Export the persisted portfolio graph back into repo-backed markdown snapshots.
- Add first-class dashboard task editing/triage controls on top of persisted
  `portfolioTasks` / `brainDumpCaptures`.
- Add mobile/watch invocation proof for task and brain-dump capture paths.
- Add persisted update artifacts/history for PR, conflict, check, merge, and
  mirror-refresh steps.
- Enrich active project strategy records with vision, pain points, solution,
  constraints, not-building notes, metrics, and competitors.
