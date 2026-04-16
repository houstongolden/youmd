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

## Critical Clarification

Using `.you/` alone is not enough.

Reason:

- most agents do not auto-read `.you/AGENT.md`
- most tools discover `AGENTS.md`, `CLAUDE.md`, host-linked skills, and
  conventional project docs first
- if You.md only writes hidden duplicates, users will not get the immediate
  "magic moment" where a fresh agent actually behaves better on first contact

So the right model is:

- `.you/` as the safe, generated, You.md-owned context layer
- plus tiny additive bootstrap edits to `AGENTS.md` / `CLAUDE.md` when safe
- plus host-specific linked skills/rules for Claude, Codex, Cursor, and future agents

That three-part combination is what makes the system both safe and instantly
useful.

## The Real Product Goal

The product is not merely "identity-aware prompts."

The product is a portable agent operating system bootstrap that helps users
replicate the kind of setup that already works well in this repo:

- agents read repo operating instructions before substantial work
- agents read and use `project-context/`
- agents track multi-part requests explicitly
- agents treat updates to `TODO.md`, `FEATURES.md`, `CHANGELOG.md`,
  `feature-requests-active.md`, and `PROMPTS.md` as part of "done"
- agents preserve the user's working style across sessions and across tools

If You.md does not scaffold or teach those behaviors, it is not yet delivering
the full value proposition.

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
- no `PROMPTS.md` scaffold even though prompt archival is part of the operating model
- no preview/dry-run before writes
- no "zero-touch" install mode
- no first-class namespaced supplemental context directory
- no explicit ownership boundary between user-authored instructions and You.md-authored instructions
- bundled skills describe safe behavior aspirationally, but the merge policy actually lives in code and is still too coarse

## Recommendation

Do not make `CLAUDE-you.md` / `AGENTS-you.md` the primary strategy.

Reason:

- most agent tools do not auto-read those names
- they add clutter at repo root
- they still require modifying the main file to teach the agent to read them

Instead, adopt a three-layer model plus zero-touch mode.

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
    feature-requests-active.md
    PROMPTS.md
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

## Permission Model

This needs to be explicit because trust is the product.

### Safe by default

Auto/minimal modes may:

- create missing files
- insert or update a managed bootstrap block
- scaffold missing `project-context/` files one-by-one
- create `.you/`
- link host-specific skills/rules

Auto/minimal modes must not:

- delete user content
- rewrite large user-authored sections
- rename files
- replace `CLAUDE.md`, `AGENTS.md`, or existing `project-context/*`
- silently move user content into `.you/`

### Approval required

If the agent wants to do anything beyond additive safe edits, it must:

1. show the exact proposed changes
2. explain why they help
3. explain what existing behavior is preserved
4. ask for approval before making the change

This applies to:

- deletions
- major rewrites
- consolidations or deduplication passes
- replacing existing instruction structures
- changing robust/customized `project-context/` files beyond marker blocks

### Implementation note

This should become a real CLI behavior, not just documentation:

- `auto` prints a plan before writing
- `minimal` performs additive writes only
- rewrite/cleanup paths require explicit confirmation

## Safe Tier Strategy

The previous version of this plan split existing repos into finer-grained
"minimal" versus "robust" tiers with different bootstrap sizes.

That is probably too clever.

The better default is a more consistent user/agent experience:

- empty repos get scaffolded first-class files
- existing repos get the same managed bootstrap block
- anything beyond additive edits requires preview + approval

This reduces ambiguity across agents and avoids a gray area where different
tools interpret "minimal" versus "robust" differently.

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

### Tier 2 — Existing instruction system

Condition:

- `CLAUDE.md` and/or `AGENTS.md` already exists

Action:

- preserve existing files
- insert or update one standard managed bootstrap block
- scaffold only missing `project-context/` files one-by-one
- create `.you/` supplemental files
- link agent-specific skills

Example managed bootstrap block:

```md
<!-- youmd:bootstrap:start -->
## Additional Context

Also read:
- `.you/AGENT.md`
- `.you/project-context/`
- `project-context/`

Treat existing repo instructions as primary and You.md context as additive.
<!-- youmd:bootstrap:end -->
```

Important:

- this block must be marker-based so it can be updated in place later
- never duplicate it
- never append a second unmanaged blob
- it should be compact, but rich enough that agents do not overlook it
- it should encode the core operating workflow, not just point vaguely at `.you/`

### Tier 3 — Approval-required invasive changes

Condition:

- the agent wants to do more than add/update the managed bootstrap block
- or the repo has highly customized instruction files and the proposed change
  goes beyond additive bootstrap + missing-file scaffolding

Action:

- show a preview
- explain exactly what would change
- explain what behavior is preserved
- ask for approval before proceeding

This is where rewrites, consolidations, deletions, or heavier cleanup belong.

## Detection Heuristics

The CLI should classify repos before writing.

### Instruction file classification

Classification still matters, but less for choosing radically different
behaviors and more for deciding when approval is required.

Treat as highly customized if any are true:

- file length > 120 lines
- 5+ headings
- contains custom operational rules or project-specific protocols
- lacks prior You.md markers but clearly has handcrafted structure

For highly customized files:

- additive bootstrap edits are still acceptable
- heavier changes should require approval

### project-context classification

Treat as robust if:

- 4 or more major files exist and are non-empty
- files have substantial content, not just placeholders

Treat as minimal if:

- directory exists but only 1-3 files are present
- files are mostly empty templates

## Operating-System Behaviors To Scaffold

When You.md generates or patches repo instructions, the resulting setup should
teach agents to do the following:

1. read `AGENTS.md` / `CLAUDE.md` first
2. read `project-context/` before significant work
3. treat multi-part user prompts as a checklist, not a single request
4. record active asks in `feature-requests-active.md`
5. update at least:
   - `TODO.md`
   - `FEATURES.md`
   - `CHANGELOG.md`
   - `feature-requests-active.md`
   - `PROMPTS.md`
6. treat those updates as part of completion, not optional cleanup
7. preserve user-authored instructions as primary when they already exist

This is what made the first Codex session in this repo feel immediately
context-aware. That behavior needs to be productized.

## CLI/Product Changes Needed

### 1. Add explicit modes to `youmd skill init-project`

Support:

- `--mode scaffold`
- `--mode additive`
- `--mode zero-touch`
- `--mode auto` (default)

`auto` should classify and then print the plan before writing.

Human users should not need to think about the mode flag. The default should be
good enough.

### 2. Add first-class `AGENTS.md` support

Current behavior only thinks seriously about `CLAUDE.md`.

Needed:

- generate `AGENTS.md` when absent
- merge/update a bootstrap block when present
- if both `AGENTS.md` and `CLAUDE.md` exist, prefer `AGENTS.md` as repo-wide canonical and keep `CLAUDE.md` thin/tool-specific

### 3. Split identity context from bootstrap context

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

Minimum shared files You.md should understand and scaffold:

- `CURRENT_STATE.md`
- `TODO.md`
- `FEATURES.md`
- `CHANGELOG.md`
- `feature-requests-active.md`
- `PROMPTS.md`

These are the core files that create the "carry context forward between agent
sessions" effect.

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

## What To Borrow From gstack

gstack is relevant here because it already produces the "install this and your
agent gets better immediately" feeling.

Patterns worth copying:

### 1. Tiny top-level bootstrap, rich generated layer underneath

gstack becomes useful quickly because it teaches the host agent where to look
and what skills to use, while keeping richer generated content in linked skill
directories.

You.md should do the same:

- tiny managed bootstrap block in `AGENTS.md` / `CLAUDE.md`
- richer generated context in `.you/`
- host-linked skills for actual tool/runtime integration

### 2. Host-specific generated outputs

gstack does not assume one generic file works everywhere. It generates and links
host-specific artifacts for Claude, Codex, Cursor, Kiro, Factory, and others.

You.md should keep leaning into this. A universal context model is good; a
universal delivery surface is not.

### 3. Setup/bootstrap command as the magic moment

gstack's setup flow is opinionated and immediate. That is part of why it feels
useful right away.

You.md should have the same quality bar:

- one command
- classify the repo automatically
- print the plan
- make safe additive edits
- leave the repo immediately more usable by agents

### 4. Team/repo bootstrap as a first-class concept

gstack has a clear repo/team bootstrap story, not just a personal install.

You.md needs the same split:

- user-global identity + skills under `~/.you/`
- repo-local agent bootstrap under `.you/` plus top-level bootstrap blocks
- later: explicit team/repo init command that teammates can inherit safely

### 5. Generated assets should be clearly owned

gstack distinguishes generated/linked assets from hand-authored project docs.
You.md should formalize the same ownership boundary so users know what they can
edit freely and what the CLI may regenerate.

## Cross-Agent Stack Sync Implications

An additional lesson from the recent local stack-standardization workflow is
that You.md should not think only in terms of a single repo.

There are really three integration layers:

### 1. Global agent entrypoints

Examples from the validated local workflow:

- shared top-level instructions across Claude, Codex, Cursor, and Pi
- one canonical instruction source with agent-specific entrypoints pointing to it
- one shared inventory file that future agents can consult before mutating the stack

You.md does not need to copy that exact filesystem layout, but the product
should support the same outcome:

- one clear shared instruction layer
- agent-specific entrypoints
- one permanent inventory of what is installed, shared, mirrored, or tool-specific

### 2. Shared skill library

The local workflow also validated the usefulness of:

- one shared source-of-truth skill directory
- mirrored host-specific installs where needed
- preserving host-native built-ins instead of flattening everything into one directory

That should inform the You.md direction:

- `.you/` and host-linked skills should complement, not erase, host-native systems
- the product should understand "shared skills" versus "agent-native managed skills"

### 3. Portable shared settings

The validated stack-sync workflow did not force one config format across every
agent. It synced only the safe overlap and preserved tool-specific extras.

That is the right philosophy for You.md too:

- unify the shared semantic layer
- map only the safe overlap into each tool
- preserve host-specific extras instead of trying to flatten everything

This matters because You.md is trying to become infrastructure, not a takeover.

## Truth Pass Required Before Build

Before implementing the new bootstrap behavior, the product needs a deliberate
"truth pass" across the existing skill system.

Right now there are multiple overlapping sources of truth:

- default bundled skills in `cli/src/lib/skill-catalog.ts`
- bundled skill content seeded in `convex/skills.ts`
- UI-local bundled skill arrays in the dashboard
- docs/README command tables
- extra skill markdown files in `cli/skills/` that are present on disk but not
  actually part of the default bundled product

This creates drift.

Examples already observed:

- the dashboard markets `proactive-context-fill`, but it is not in the default
  skill catalog
- `README.md` and CLI copy still describe the old `init-project` behavior
- the skill catalog source paths are written one way while runtime resolution
  succeeds via fallback behavior

So implementation should begin with:

1. decide the canonical source of truth for bundled skill metadata
2. reconcile catalog, seeded backend records, dashboard UI, and docs against it
3. mark which skills are real shipping product versus experimental/on-disk only
4. only then update `init-project`, `.you/`, and bootstrap behavior

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
2. create `.you/` always
3. if no top-level files exist, scaffold them
4. if top-level files exist, insert or update one standard managed bootstrap block
5. link agent-specific skill files always
6. scaffold top-level `project-context/` missing files individually
7. require approval for anything beyond additive bootstrap + missing-file scaffolding

This gets the upside of portable identity context without acting like You.md
owns the user's repo.

## What Should Change First

Highest leverage implementation order:

1. add `--mode auto|additive|zero-touch`
2. add `AGENTS.md` support
3. replace "append full identity section" with "insert/update standard managed bootstrap block"
4. scaffold missing `project-context/` files individually, including `PROMPTS.md`
5. introduce `.you/` as supplemental namespace with `.youmd` compatibility
6. teach generated instructions the operating-system behaviors listed above
7. add explicit preview/approval flow for anything beyond additive edits

## Bottom Line

The product should act like a careful infrastructure layer, not a takeover.

You.md should:

- enrich the user's operating system for agents
- preserve handcrafted repo instructions
- keep its own generated context clearly namespaced
- make small useful additive edits to shared agent files when safe
- require approval for anything beyond additive edits
- give advanced users a zero-touch option

That is the durable path to making this work across Claude Code, Codex, Cursor,
and future agents without breaking trust.
