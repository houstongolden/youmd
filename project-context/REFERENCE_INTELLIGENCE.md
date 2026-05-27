# Reference Intelligence Loop

Last updated: 2026-05-27

You.md should learn from the two clearest external reference systems:

- `garrytan/gstack`: the lighthouse for installable, local-first agent operating systems, host-native skills, specialist workflows, update behavior, QA/review/release loops, and a strong "it just works in my agent" install moment.
- `garrytan/gbrain`: the lighthouse for a shared brain across agents: durable memory, identity/context, retrieval, sync, privacy boundaries, and agent startup context.

This is not blind cloning. The rule is: inspect upstream changes daily, extract architecture/product lessons, then convert only relevant lessons into You.md tasks.

## Local Reference Repos

The repos are cloned under `.reference-repos/garrytan/` and ignored by git.

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

## You.md Translation

- `You.md brain`: identity, memory, private context, profile, preferences, projects, sources, and protected retrieval.
- `YouStacks`: named local execution packages containing skills, sub-agents, workflows, prompts, examples, evals, adapter files, and improvement/update policy.
- `Reference monitor`: daily upstream change review that produces tasks, not automatic product churn.
- `Self-improvement`: combine upstream lessons, local usage, user corrections, smoke tests, evals, and repo diffs into proposed stack/brain improvements.

## Safety Rules

- Do not vendor upstream repos into this repo.
- Do not copy large code blocks or full files from upstream into docs.
- Do not auto-apply protected brain, private context, connected-tool, or remote-repo writes.
- Promote a candidate task only when it improves You.md's core brain or YouStacks execution layer.
