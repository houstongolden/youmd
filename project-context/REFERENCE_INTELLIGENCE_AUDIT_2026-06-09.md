# Reference Intelligence Audit — 2026-06-09

## Why This Exists

The 2026-06-09 reference sync was smaller than the Jun 3 wave, but it still surfaced two high-signal follow-up tasks:

- 1 new `gstack` release: `1626d48`
- 1 new `gbrain` release: `1eb430a`
- 2 generated candidate tasks in `project-context/reference-intelligence/TASKS.md`

That is small enough to ignore if the repo only preserves raw generated files.
This audit turns the two candidate tasks into concrete You.md next steps so the
reference loop keeps compounding instead of resetting every run.

## Highest-Value Follow-Up Tasks

### 1. YouStacks review/report packaging and host-adapter boundaries

Primary upstream signal:

- `gstack 1626d48`: review reports must always declare unresolved-decision status, and plan-mode exit now blocks if that state is missing

You.md translation:

- When YouStacks package maintainer skills, review helpers, or host-adapter guidance, the review artifact shape should be explicit and machine-checkable.
- A private or public stack should not leave agents guessing whether a review is clean, blocked on decisions, or missing required review state.
- Host adapters and bundled skills should prefer deterministic readiness/report states over ad hoc prose when they describe stack health, review status, or maintainer follow-through.

Concrete next slice:

1. Design a YouStacks review artifact contract for maintainer-oriented skills and generated host adapters:
   - explicit `ready` vs `needs_decision` vs `blocked` style states
   - one canonical place for unresolved decisions
   - deterministic final-line/status semantics if a report format exists
2. Audit current stack-maintainer and adapter-generation docs for places where review/readiness language is still prose-only.
3. Keep this scoped to packaging/contracts first, not runtime product mutations, so private stack distribution rules stay clear before implementation expands.

### 2. Protected retrieval scope, source isolation, and malformed-ingest resilience

Primary upstream signals:

- `gbrain 1eb430a`: fail-closed source-isolation grant enforcement for federated reads
- `gbrain 1eb430a`: exact-match reads now honor granted source lists
- `gbrain 1eb430a`: non-string frontmatter no longer crashes lint/sync and instead surfaces a validation finding

You.md translation:

- Protected brain/context retrieval across You.md MCP/API surfaces should stay fail-closed for remote callers, especially where future repo-native or stack-scoped reads span multiple sources.
- Exact-path or exact-file reads should honor the same source grants as search-style retrieval, not bypass them.
- Repo-native You.md ingest and source-catalog parsing should degrade safely when frontmatter is malformed instead of aborting the whole sync or mirror refresh.

Concrete next slice:

1. Audit protected retrieval surfaces for grant-consistent scoping:
   - private context
   - memories
   - project context
   - repo-mirror file reads
   - future stack-from-mirror MCP/API reads
2. Define a shared "federated but fail-closed" rule for multi-source remote reads so `__all__`-style behavior never widens access implicitly.
3. Add a validation/backstop design for malformed frontmatter in repo-native source catalogs and stack manifests:
   - surface a structured warning/finding
   - continue indexing what is still safe
   - avoid fabricating identifiers from junk values

## Recommended Implementation Order

1. Track the two tasks explicitly in project context so they do not disappear back into generated files.
2. Audit docs/contracts first: review artifact semantics and protected-retrieval scoping rules.
3. Then evaluate implementation slices for repo-mirror reads, stack-from-mirror surfaces, and malformed frontmatter handling.

## Decision

The right follow-through for this run is still not "ship product changes immediately."

It is:

- preserve the generated reference outputs
- write the Jun 9 audit so the two tasks become durable
- update tracking/docs so future sessions can pick up the exact next slices
- verify the local reference loop and current production public surfaces stay healthy

That keeps the daily reference monitor aligned with its original purpose: upstream intelligence in, concrete You.md tasks out.

## Note On The Verification Re-Run

This audit is based on the first 2026-06-09 sync pass, which surfaced the two
candidate tasks above. A later same-session verification run of
`npm run references:sync` correctly returned zero new candidates because the
local reference heads were already updated.

That is expected behavior:

- `project-context/reference-intelligence/LATEST.md` and `TASKS.md` now reflect the steady-state "caught up" view
- this audit preserves the actionable interpretation of the earlier detected deltas
