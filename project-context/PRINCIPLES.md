# You.md — Product Principles

Durable principles that override individual feature ideas. Read before designing
anything new.

## 1. Autonomous-First — NEVER add work for the user

You.md exists to **orchestrate, self-improve, self-update, and manage itself**.
The human is never turned into an operator.

Before shipping ANY feature, ask: *does this create work for the user — a command
to run, a prompt to approve, a migration to perform, a setting to maintain, a step
to remember?* If yes, **seriously reconsider** and redesign so it happens
automatically via the agents, ystack skills, and the you CLI/API/MCP.

- **No user homework.** Convention changes, scaffolding upgrades, core-stack
  updates, migrations, and re-syncs apply **autonomously** during normal sync
  (`you machine sync-now`) — never handed to the user as steps.
- **No "approve this" gates** for routine, safe, reversible work. Act, commit,
  report. Reserve confirmation only for genuinely destructive/irreversible or
  user-customization-conflicting changes.
- **Default disposition: it just works.** The win condition is the user doing
  nothing and everything staying current, synced, and correct.

## 2. Don't build platform bloat for one-off / personal fixes

If something only affects Houston's own dev machines (or a small handful during
this pre-launch phase), handle it as a **local one-off** — do not add a permanent
platform feature that future users will never need.

- **Canonical example:** the `youmd → you` / `.youmd → .you` rename is a **local
  dev one-off**. Future users start fresh on `you`/`.you`, so it must NOT become a
  shipped migration framework. Runtime backward-compat already exists
  (`cli/src/lib/config.ts` reads `.you/` then falls back to legacy `.youmd/`); the
  physical rename on the 2-3 existing dev machines is a local task, not a product
  feature.

## 3. Build the general capability only when reusable AND autonomous

A real "core update changes conventions → upgrade existing installs" system is
worth building **only if** it runs itself silently through the stack (version
stamp → migration detected during sync → applied + committed + reported, with
confirmation reserved for risky/customization-conflicting changes). If it would
add user steps, don't build it.
