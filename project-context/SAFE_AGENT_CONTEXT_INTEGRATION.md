# You.md — Safe Agent Context Integration Strategy

Last Updated: 2026-04-16
Status: Proposed

## Why This Matters

The core promise of You.md is not just "store identity data." It is:

1. make agent-operating context portable across tools
2. improve how agents behave in real projects
3. do it without breaking the systems users already invested in

The current `youmd skill init-project` flow gets part of the way there, but it is
still too blunt for mature repositories. It can generate `CLAUDE.md`, scaffold a
fresh `project-context/`, and link rendered skills, but it does not yet have a
serious ownership model for coexistence with robust user-authored `CLAUDE.md`,
`AGENTS.md`, `.cursor/rules`, or existing `project-context/` trees.

This document proposes the safer long-term model.

## Current Behavior

Today the CLI does the following:

- installs bundled skills
- generates `CLAUDE.md` if absent
- appends a single `<!-- youmd:identity -->` block to existing `CLAUDE.md`
- scaffolds `project-context/` only if the directory does not already exist
- links rendered skill files into `.claude/skills/youmd/`
- optionally links Cursor rules if `.cursor/` already exists

Current gaps:

- no `AGENTS.md` generation or merge path
- no distinction between "minimal existing file" and "highly customized file"
- no per-file merge for `project-context/`
- no preview/dry-run before writes
- no "zero-touch" install mode
- no first-class namespaced supplemental context directory
- no explicit ownership boundary between user-authored instructions and You.md-authored instructions

## Recommendation

Do **not** make `CLAUDE-you.md` / `AGENTS-you.md` the primary strategy.

Reason:

- most agent tools do not auto-read those names
- they add clutter at repo root
- they still require modifying the main file to teach the agent to read them

Instead, adopt a **three-layer model plus zero-touch mode**.

## Proposed Ownership Model

### Layer 1 — User-owned primary files

These remain the user's source of truth if they already exist:

- `CLAUDE.md`
- `AGENTS.md`
- `.cursor/rules/*`
- existing `project-context/*`

You.md should never aggressively rewrite these.

### Layer 2 — You.md-managed supplemental context

Create a namespaced location for generated instructions:

```text
.you/
  AGENT.md
  identity.md
  project-context/
    CURRENT_STATE.md
    TODO.md
    FEATURES.md
    CHANGELOG.md
    PRD.md
    ARCHITECTURE.md
```

This directory is explicitly You.md-owned and safe to regenerate.

Why `.you/`:

- it is namespaced and hidden
- it does not pretend to be the user's handcrafted repo docs
- it can coexist with `project-context/`
- it matches the user's preference better than `.youmd/`

Compatibility note:

- current codebase uses `~/.youmd` and local `.youmd`
- migration should be additive first: support both `.youmd` and `.you`
- only switch defaults after a compatibility release

### Layer 3 — Agent-specific linked surfaces

Keep generating tool-specific files:

- `.claude/skills/youmd/*`
- `.codex/skills/youmd/*`
- `.cursor/rules/youmd.md`

These are the lowest-risk integration points because they avoid mutating the
user's main operating manual.

### Mode 4 — Zero-touch install

For cautious users or mature repos:

- install/link skills only
- create `.you/` supplemental context only
- do not modify `CLAUDE.md`
- do not modify `AGENTS.md`
- do not scaffold `project-context/`

This should be a first-class supported mode, not an accidental outcome.

## Safe Tier Strategy

### Tier 1 — No existing instruction system

Condition:

- no `CLAUDE.md`
- no `AGENTS.md`
- no meaningful `project-context/`

Action:

- scaffold all primary files normally
- create `.you/`
- link agent-specific skills

This is the fast path.

### Tier 2 — Minimal existing instruction system

Condition:

- `CLAUDE.md` or `AGENTS.md` exists but is short/lightweight
- `project-context/` exists but is sparse or partially missing

Action:

- preserve existing files
- insert a **small bootstrap block** near the top with markers
- scaffold only missing `project-context/` files one-by-one
- create `.you/` supplemental files
- link agent-specific skills

Example bootstrap block:

```md
<!-- youmd:bootstrap:start -->
## Additional Context

Also read:
- `.you/AGENT.md`
- `.you/project-context/`

Treat existing repo instructions as primary and You.md context as additive.
<!-- youmd:bootstrap:end -->
```

Important:

- this block must be marker-based so it can be updated in place later
- never duplicate it
- never append a second unmanaged blob

### Tier 3 — Robust existing instruction system

Condition:

- `CLAUDE.md` and/or `AGENTS.md` is long, structured, and clearly customized
- `project-context/` is already heavily used

Action:

- default to minimal-touch behavior
- do not append large identity blocks
- do not create duplicate top-level docs
- add only a tiny bootstrap block if safe
- otherwise fall back to zero-touch mode
- always create `.you/` supplemental context and linked skills

This is the correct place to push back on brute-force merge behavior.

## Detection Heuristics

The CLI should classify repos before writing:

### Instruction file classification

Treat as robust if any are true:

- file length > 120 lines
- 5+ headings
- contains custom operational rules or project-specific protocols
- lacks prior You.md markers but clearly has handcrafted structure

Treat as minimal if all are true:

- file length < 60 lines
- 3 or fewer headings
- little or no project-specific structure

### project-context classification

Treat as robust if:

- 4 or more major files exist and are non-empty
- files have substantial content, not just placeholders

Treat as minimal if:

- directory exists but only 1-3 files are present
- files are mostly empty templates

## CLI/Product Changes Needed

### 1. Add explicit modes to `youmd skill init-project`

Support:

- `--mode scaffold`
- `--mode merge`
- `--mode minimal`
- `--mode zero-touch`
- `--mode auto` (default)

`auto` should classify and then print the plan before writing.

### 2. Add first-class `AGENTS.md` support

Current behavior only thinks seriously about `CLAUDE.md`.

Needed:

- generate `AGENTS.md` when absent
- merge/update a bootstrap block when present
- if both `AGENTS.md` and `CLAUDE.md` exist, prefer `AGENTS.md` as repo-wide canonical and keep `CLAUDE.md` thin/tool-specific

### 3. Split "identity block" from "bootstrap block"

Current append strategy mixes too much into the root file.

Better:

- root file gets a tiny bootstrap/reference block
- rich generated context lives in `.you/AGENT.md`

### 4. Scaffold missing `project-context/` files individually

Current behavior skips the whole directory if it already exists.

That is too coarse.

Desired behavior:

- create missing files only
- never overwrite existing files without explicit approval
- optionally write You.md-owned variants into `.you/project-context/`

### 5. Add dry-run output

Before writing, show:

- repo classification
- files to create
- files to patch
- files intentionally left untouched

This is especially important for mature repos.

### 6. Separate global identity store from project overlays

Long-term model:

- `~/.you/` for user-global identity and skills
- repo-local `.you/` for project overlay and generated supplements
- continue reading `~/.youmd/` and local `.youmd/` during migration

## Recommended File Layout

### Global

```text
~/.you/
  config.json
  identity/
  skills/
  agents/
```

### Project

```text
repo/
  AGENTS.md                # user-owned or scaffolded
  CLAUDE.md                # optional tool-specific file
  project-context/         # user-owned shared project docs
  .you/
    AGENT.md               # youmd-generated additive operating context
    identity.md            # compact identity summary for agents
    project-context/       # youmd-generated additive context
  .claude/skills/youmd/
  .codex/skills/youmd/
  .cursor/rules/youmd.md
```

## Opinionated Recommendation

The best default is:

1. `auto` classify the repo
2. for mature repos, choose `minimal`
3. create `.you/` always
4. patch `AGENTS.md` or `CLAUDE.md` only with a tiny bootstrap block
5. link agent-specific skill files always
6. scaffold top-level `project-context/` only when absent or clearly minimal

This gets the upside of portable identity context without acting like You.md
owns the user's repo.

## What Should Change First

Highest leverage implementation order:

1. add `--mode auto|minimal|zero-touch`
2. add `AGENTS.md` support
3. replace "append full identity section" with "insert/update bootstrap block"
4. scaffold missing `project-context/` files individually
5. introduce `.you/` as supplemental namespace with `.youmd` compatibility

## Bottom Line

The product should act like a careful infrastructure layer, not a takeover.

You.md should:

- enrich the user's operating system for agents
- preserve handcrafted repo instructions
- keep its own generated context clearly namespaced
- give advanced users a zero-touch option

That is the durable path to making this work across Claude Code, Codex, Cursor,
and future agents without breaking trust.
