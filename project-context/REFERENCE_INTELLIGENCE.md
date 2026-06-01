# Reference Intelligence Loop

Last updated: 2026-06-01

You.md should learn from the clearest external reference systems for agent brains, stacks, skills, scripts, prompts, and shared operating context:

- `garrytan/gstack`: the lighthouse for installable, local-first agent operating systems, host-native skills, specialist workflows, update behavior, QA/review/release loops, and a strong "it just works in my agent" install moment.
- `garrytan/gbrain`: the lighthouse for a shared brain across agents: durable memory, identity/context, retrieval, sync, privacy boundaries, and agent startup context.
- `steipete/agent-scripts`: the lighthouse for a tiny canonical repo of shared `AGENTS.MD`, reusable skills, dependency-light helper scripts, hooks, validation, and repo-owned skills exposed through pointers/symlinks instead of stale copies.
- `disler/the-library`: the lighthouse for private-first distribution of skills, agents, and prompts through a pointer catalog, typed dependencies, pull-on-demand install, and cross-device/team sync.

This is not blind cloning. The rule is: inspect upstream changes daily, extract architecture/product lessons, then convert only relevant lessons into You.md tasks.

## Local Reference Repos

The repos are cloned under `.reference-repos/<owner>/<repo>/` and ignored by git.
This workspace also has a daily local Codex automation named
`Daily You.md Reference Intelligence` that runs the monitor and reports the
review queue. Run the command manually any time a product or architecture pass
needs the newest upstream signal:

```bash
npm run references:sync
```

The sync writes:

- `project-context/reference-intelligence/LATEST.md`: latest upstream commits, local clone paths, and candidate tasks.
- `project-context/reference-intelligence/TASKS.md`: a review queue for YouStacks and You.md brain/context improvements.

## What To Copy From GStack

- Local-first installable skills and workflows.
- Host-native files for Claude Code, Codex, Cursor, OpenClaw, and other agents.
- Opinionated specialist modes instead of generic prompt bins.
- Read-only smoke checks before writes.
- Upgrade/update flows that keep generated files current.
- QA, review, canary, benchmark, release, docs, and safety workflows as first-class skills.
- Tiny enough startup instructions that agents actually load them.

## What To Copy From GBrain

- A shared brain that agents can read through a clear startup contract.
- Durable memories with provenance, timestamps, categories, and retrieval policy.
- Local-first cache plus hosted availability.
- Search/retrieval that respects scopes and privacy boundaries.
- Agent-safe context exports that do not leak the entire private brain.
- Sync and migration patterns that preserve user ownership.

## What To Copy From Agent Scripts

- A single canonical shared rules file with downstream repos using pointer-style local instructions.
- Short, routing-optimized skill descriptions and terse operational skill bodies.
- Skills that can own small scripts, references, and assets while staying easy to validate.
- Dependency-light helper scripts and local hooks for repeatable operations.
- Repo-owned skills kept canonical in their source repo and exposed into the shared layer by pointer, not copy.
- Validation before commit so shared agent instructions do not quietly rot.

## What To Copy From The Library

- A private-first catalog that references skills, agents, and prompts where they already live.
- Pull-on-demand install/use instead of global exposure of every capability.
- Typed dependencies such as `skill:*`, `agent:*`, and `prompt:*` so installs can resolve prerequisites.
- Local path, GitHub browser URL, and raw URL source formats for private and public catalogs.
- Agent-readable cookbook operations for install, add, use, push, remove, list, sync, and search.
- Cross-device/team sync through a user-owned fork or repo, not a closed marketplace first.

## You.md Translation

- `You.md brain`: identity, memory, private context, profile, preferences, projects, sources, and protected retrieval.
- `YouStacks`: named local execution packages containing skills, sub-agents, workflows, prompts, scripts, examples, evals, adapter files, source pointers, dependencies, and improvement/update policy.
- `You.md stack catalog`: a repo-backed, private-first catalog of skills, scripts, prompts, sub-agents, stack manifests, source pointers, protected capabilities, and sharing grants.
- `Reference monitor`: daily upstream change review that produces tasks, not automatic product churn.
- `Self-improvement`: combine upstream lessons, local usage, user corrections, smoke tests, evals, and repo diffs into proposed stack/brain improvements.

## Safety Rules

- Do not vendor upstream repos into this repo.
- Do not copy large code blocks or full files from upstream into docs.
- Do not auto-apply protected brain, private context, connected-tool, or remote-repo writes.
- Promote a candidate task only when it improves You.md's core brain or YouStacks execution layer.
- Keep credits and inspiration explicit without implying endorsement or affiliation.
