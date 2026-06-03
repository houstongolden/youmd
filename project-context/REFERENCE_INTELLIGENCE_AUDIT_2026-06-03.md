# Reference Intelligence Audit — 2026-06-03

## Why This Exists

The 2026-06-03 reference sync produced a real follow-up wave instead of a no-op:

- 1 new `gstack` safety/privacy release: `c43c850`
- 12 new `gbrain` reliability/retrieval/runtime releases: `f09f917` through `f3ade6c`
- 13 generated candidate tasks in `project-context/reference-intelligence/TASKS.md`

That is too much to leave as one flat queue. This audit turns the raw task list into a narrower You.md implementation order.

## Highest-Value Follow-Up Tasks

### 1. Stack safety and private distribution boundaries

Primary upstream signals:

- `gstack c43c850`: cached slug sanitization for shell-evaluated startup helpers
- `gstack c43c850`: telemetry consent copy aligned with actual local-only repo metadata handling

You.md translation:

- Treat every stack adapter, startup helper, cached identifier, and generated shell snippet as hostile input until re-sanitized at use time.
- Keep stack/runtime docs explicit about what metadata stays local versus what can traverse hosted You.md surfaces.
- Preserve the product rule that private brain reads, connected tools, repo sync, and grants stay behind explicit protected API/MCP boundaries.

Concrete next slice:

1. Audit `youmd stack link`, startup helper generation, and any shell-evaluated identifiers for cached-input sanitization assumptions.
2. Tighten docs/examples so private-by-default distribution and local-only metadata handling are stated in the same plain language as the implementation.
3. Add or extend tests that pin the "no unsafe shell expansion" and "no accidental repo-identity egress" invariants.

### 2. Brain sync resilience and import convergence

Primary upstream signals:

- `gbrain fd2fde9`: resumable incremental sync
- `gbrain bde11bb`: hard-deadline watchdog for orphan-prone sync
- `gbrain f3ade6c`: shared connection ownership on long-lived cycles

You.md translation:

- Long-running profile/source/brain sync work should preserve partial progress instead of restarting from zero.
- Hosted or local sync work should have bounded-runtime escape hatches so one wedged run does not pile up future runs.
- Shared connection/resource ownership needs to stay explicit anywhere short-lived helpers touch long-lived brain work.

Concrete next slice:

1. Design resumable checkpoints for source ingest, repo sync, or bundle export/import jobs before adding more background automation.
2. Add a You.md-side watchdog/timeout policy for long-running local or hosted sync flows.
3. Review any shared-client patterns in brain/context jobs for borrower-versus-owner teardown mistakes.

### 3. Retrieval honesty and protected brain readiness

Primary upstream signals:

- `gbrain ec5fed2`: bounded query-embed with keyword fallback
- `gbrain 1036f8f`: readiness/status surfaces for code-intel empties
- `gbrain bea2d3e`: archive content searchable by default but demoted
- `gbrain f09f917`: scoped basename resolution and provenance-aware extraction

You.md translation:

- Protected brain retrieval should fail soft and still return an honest fallback when one retrieval method stalls.
- Empty results from memory/context/code-style reads should distinguish `not built`, `indexing`, and `ready but empty`.
- Archived or lower-priority context should usually be demoted rather than made invisible, unless safety/privacy policy requires exclusion.
- Any future cross-file or cross-source linking should stay source-scoped by default and preserve provenance.

Concrete next slice:

1. Define explicit readiness states for protected brain, project-context, and code/context-style reads exposed through API/MCP.
2. Add retrieval fallback guidance to docs and future implementation notes: vector failure should degrade toward keyword/basic retrieval, not silence.
3. Review memory/archive retrieval policy so older context is demoted before it is excluded.

### 4. Runtime health, self-upgrade, and hosted/open boundaries

Primary upstream signals:

- `gbrain 3fe4493`: doctor as a first-class health surface
- `gbrain a57d98b`: invocation-riding self-upgrade with opt-in auto mode
- `gbrain d4211f4`: held-out gates and honest receipts for self-improving skills

You.md translation:

- YouStacks and the runtime should expose more health/readiness receipts before mutating stack assets or private state.
- Auto-update should remain opt-in and health-gated for always-on/private installs.
- Self-improvement claims should stay evidence-backed with smoke/eval/held-out style gates instead of vague "improve" language.

Concrete next slice:

1. Extend docs and product language around doctor/readiness/smoke gates before publish, self-improvement, or public sharing.
2. Keep auto-upgrade/private distribution boundaries explicit: open local runtime by default, hosted value for protected access, grants, sync, and heavy shared services.
3. Tighten future self-improvement plans around honest receipts and held-out validation.

## Recommended Implementation Order

1. Repo-visible docs and contract updates for stack safety, readiness, and API/MCP boundaries.
2. Adapter/runtime safety audit and tests for shell-evaluated identifiers.
3. Retrieval/readiness contract design for protected brain and stack-aware API/MCP surfaces.
4. Sync-resilience design for resumable long-running brain/source jobs.

## Decision

The best immediate use of this sync is not a giant product patch.

It is:

- one tracking/audit pass to make the work explicit
- one repo-visible contract/docs pass to teach future agents the new rules
- then focused implementation slices for safety, readiness, retrieval, and sync

That keeps the reference loop useful without turning it into churn.
