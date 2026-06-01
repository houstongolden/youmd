# Agent Stack Upstream Audit — 2026-06-01

## Why This Exists

Houston asked to fold `steipete/agent-scripts` and `disler/the-library` into the same long-running reference loop that already tracks GStack and GBrain.

The product goal is now explicit: You.md is not only an identity/profile product. It is the source-of-truth layer for shared agent context:

- brain, memory, preferences, voice, directives, projects, and private context
- named YouStacks of skills, scripts, prompts, workflows, examples, sub-agents, and adapters
- repo-backed source pointers so assets stay canonical where they are owned
- protected API/MCP for private memory, grants, sync, connected tools, high-usage hosted actions, and audit logs

## Upstream Lessons

| Upstream | What To Learn | You.md Translation |
|---|---|---|
| `garrytan/gstack` | Local-first agent operating system: skills, host adapters, QA/review/release workflows, evals, install/update behavior | YouStacks should feel immediately useful inside Claude Code, Codex, Cursor, and other hosts before any custom backend is needed |
| `garrytan/gbrain` | Durable shared brain: memory, retrieval, provenance, sync, privacy, startup context | You.md brain should be the protected context layer every stack can safely reference |
| `steipete/agent-scripts` | Canonical shared `AGENTS.MD`, terse skills, dependency-light scripts, validation hooks, repo-owned skills exposed by pointer/symlink | You.md should support canonical shared rules plus repo-local overrides, portable helpers, skill validation, and source pointers |
| `disler/the-library` | Private-first catalog of skill/agent/prompt references, typed dependencies, pull-on-demand install/use/sync, pure-agent cookbook ops | YouStacks should grow a private/source-backed catalog so capabilities can be referenced, pulled, synced, shared, and published without stale copies |

## Current You.md State

Already strong:

- `npm run references:sync` exists and now tracks all four lighthouses.
- YouStacks already have local manifests, inspect/doctor/smoke/capabilities/route/link commands, MCP tools, and a maintainer skill.
- The product model is already close: Brain -> Stacks -> Runtime -> Protected API/MCP.
- The README and docs already explain private-by-default stacks, curl-first runtime install, and protected memory/API/MCP boundaries.

Gaps to close:

- YouStacks do not yet have a first-class pointer catalog for skills, scripts, prompts, agents, and examples that live in canonical source repos.
- Stack manifests do not yet model typed dependencies such as `skill:*`, `agent:*`, `prompt:*`, `script:*`, or `protected:*`.
- `youmd stack doctor` does not yet warn about stale copied assets, invalid skill front matter, missing dependency declarations, or global-skill sprawl.
- `youmd skill init-project` and host adapters should more clearly support pointer-style managed blocks: shared rules first, repo-local rules below.
- The open-source/commercial boundary needs to be intentional: mostly open core and local stack runtime, hosted value for sync, grants, publishing, protected memory, high-usage limits, and future agent platform features.

## Product Direction

1. Keep You.md mostly open-source and local-first where trust and adoption benefit from inspectability.
2. Keep the cloud layer focused on availability, publishing, protected context, grants, hosted mirrors, high-usage limits, connected tools, and future platform features.
3. Treat public stacks as inspectable, forkable, installable agent kits.
4. Treat private stacks as user-owned catalogs that can include protected references without exposing secrets, private memories, or proprietary prompts.
5. Add explicit hat-tip credits in README/docs for GStack, GBrain, Agent Scripts, The Library, BAMFStack, and future monitored lighthouses.

## Next Implementation Slices

1. Add `sources` or `catalog` metadata to the `youstack/v1` manifest for source refs to skills, scripts, prompts, agents, examples, and docs.
2. Add typed dependency validation in `youmd stack doctor`.
3. Extend `youmd stack inspect` to show source refs, canonical owners, install targets, and stale-copy warnings.
4. Teach `youstack-maintainer` to convert copied assets into pointers when safe.
5. Add README/docs credit section plus an "upstream reference loop" explanation for builders.
6. Expand hosted stack sharing around open-source/public stacks, private/scoped catalogs, and paid/high-usage hosted capability boundaries.

## Decision

The cleanest architecture is not "one giant repo of all prompts" and not "everything in a SaaS registry."

The clean architecture is:

```text
You.md brain        = protected memory, identity, preferences, directives, projects
YouStack manifest   = named package, host adapters, policies, capabilities
Source catalog      = canonical refs to skills, scripts, prompts, agents, examples
Local runtime       = install, inspect, doctor, smoke, route, link, use
Hosted API/MCP      = protected retrieval, grants, sync, audit, publishing, cloud actions
```

That gives users the open-source feel and portability of GStack/Agent Scripts/The Library, plus the personal brain and protected service layer that only You.md is positioned to provide.
