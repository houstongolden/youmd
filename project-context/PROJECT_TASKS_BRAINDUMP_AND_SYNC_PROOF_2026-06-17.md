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
  refreshed the pane, and proved it now reads `CONVEX PERSISTED GRAPH` with
  `4 projects / 5 surfaces / 4 edges / 5 patterns` plus the status line
  `persisted 4 projects / 5 surfaces / 4 edges / 5 patterns`.
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

## Still Open

- Export the persisted portfolio graph back into repo-backed markdown snapshots.
- Add first-class dashboard task editing/triage controls on top of persisted
  `portfolioTasks` / `brainDumpCaptures`.
- Add CLI/local-agent and mobile/watch invocation proof for task and brain-dump
  capture paths.
- Add persisted update artifacts/history for PR, conflict, check, merge, and
  mirror-refresh steps.
- Enrich active project strategy records with vision, pain points, solution,
  constraints, not-building notes, metrics, and competitors.
