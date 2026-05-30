---
name: youstack-maintainer
description: Maintain, organize, update, and safely improve a user's YouStacks.
version: 1.0.0
scope: shared
identity_fields:
  - profile.about
  - preferences.agent
  - directives.agent
  - voice.overall
---

# youstack-maintainer

Use this skill when the user asks to create, organize, improve, update, share, publish, or audit YouStacks.

## Core Rule

You.md is the brain. YouStacks are named execution packages built on top of that brain.

Keep stacks private by default. Never make a stack public, widen a scoped link, read private memory, write brain data, call connected tools, or push to a remote repo unless the user explicitly approves that exact action.

## Startup

1. If the You.md auto-upgrade helper exists, run it quietly before editing stack files:

   ```bash
   ~/.youmd/bin/youmd-auto-upgrade --quiet || true
   ```

2. Discover stack manifests from the current repo, `youstacks/`, `.you/youstack.json`, or the user's chosen stack folder.
3. Run `youmd stack doctor --path <stack>`, then `youmd stack smoke --path <stack>` before trusting a manifest.
4. Read the stack's `improvement`, `update`, `sharing`, and `accessPolicy` blocks before changing anything.
5. Prefer local/static stack files first. Use You.md API/MCP only for protected brain retrieval, sync, tokens, grants, connected tools, hosted telemetry, or server-side actions.
6. Brain-aware preflight: before asking the user basic repo questions, skim the current repo context if present:
   - `project-context/CURRENT_STATE.md`
   - `project-context/feature-requests-active.md`
   - `project-context/TODO.md`
   - `project-context/reference-intelligence/TASKS.md`

## Organize A Stack

For each stack, make sure it has:

- A clear human name, stable slug, domain, aliases, and tags.
- Skills in `skills/<name>/SKILL.md`.
- Workflows in `workflows/`.
- Optional sub-agents in `subagents/`.
- Examples and golden prompts in `examples/` or `prompts/`.
- Smoke checks or eval notes in `tests/`.
- Docs in `docs/`.
- Host adapters for Claude Code, Codex, and Cursor.
- A read-only diagnostic path for manifest bloat, route ambiguity, adapter drift, update hygiene, and public-readiness gaps.
- An improvement policy and update policy.
- A private/public/scoped sharing policy with `private` as the default.

## Improve A Stack

Use safe signals first:

- User corrections.
- Failed or ambiguous route choices.
- Smoke failures.
- Evals and golden prompt regressions.
- Repo diffs.
- Repeated manual edits.
- New docs or examples the user approves.
- GStack/GBrain reference-intelligence tasks that are relevant.

Make the smallest useful improvement. Update skills, workflows, docs, examples, tests, and generated adapters together when the change affects more than one surface. Run `youmd stack smoke` again.
Run `youmd stack doctor` first when a change is triggered by route misses, bloat, stale adapters, memory/resource issues, or a GStack/GBrain reference-intelligence task.

## Visibility

- `private`: default. Visible only to the owner and local agents with file access.
- `scoped-link`: share a bounded install/grant with a teammate, friend, or contractor.
- `team`: shared within an approved workspace/team.
- `public-open`: inspectable, forkable, installable public stack. Strip secrets, private memories, proprietary prompts, private examples, and internal tool details first.

When the user says "make this stack public", first prepare a public-readiness diff:

1. Confirm the stack name and slug.
2. List files that will become public.
3. List protected capabilities that remain behind You.md auth.
4. Remove or redact secrets, private memories, private context, private links, and proprietary prompts.
5. Run smoke checks.
6. Ask for final approval before publishing or pushing.

## BAMFStack Lighthouse Pattern

BAMFStack is the reference proof for an open YouStack:

- One curl install.
- Host-native skills and commands.
- Local helper CLI.
- Env-only API key handling.
- Auto-upgrade preamble.
- Capability discovery.
- Deterministic workflow routing.
- Read-only smoke test.
- Read-only stack doctor/diagnostic pass.
- Docs-quality examples.
- Sync rule: update stack files, docs, API/MCP references, prompts, and tests together.

Copy the pattern, not the private implementation. Keep proprietary prompts, product internals, credentials, private creator data, and sensitive actions behind authenticated BAMF or You.md API/MCP surfaces.
