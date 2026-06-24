---
name: remote-machine
version: 1.0.0
scope: shared
identity_fields: [profile.about, preferences.agent]
description: Check a synced machine's agent/work status and, if needed, trigger it to commit and push — so the user can resume on another computer.
---

# remote-machine

Use this skill when the user asks about work happening on **another one of their
machines** and wants to check on it or hand it off — e.g.:

- "Is the work on my Mac mini done? Is it committed and pushed?"
- "What was the last update on my office machine?"
- "Have my Mac mini commit and push the youmd work so I can pull it down here."
- "Check <machine> and if it's not pushed, push it."

This runs entirely through the you.md synced connection (the agent bus relayed via
Convex). The user's machines are not directly reachable; commands and results flow
machine → Convex → machine. **Zero user steps beyond the sentence** — never ask the
user to run anything by hand.

## Identity Context

- **About:** {{profile.about}}
- **Agent preferences:** {{preferences.agent}}

## Workflow

1. **Identify the target machine.** If the user names it ("Mac mini", "office"),
   match it against their machines. If unsure, call `remote_machine_status` with no
   machine to list them, or `you remote list`, and pick/confirm the obvious one.

2. **Check status (read-only first).** Call the MCP tool `remote_machine_status`
   (or `you remote status <machine>`). Report concisely:
   - last readiness proof (ready / warn / failed) + when
   - git state if available: branch, dirty?, ahead/behind, last commit
   - last agent-bus activity (what the remote agent was doing)

3. **Decide if action is needed.** If the work is **clean and pushed** (not dirty,
   ahead = 0), tell the user it's already safe to pull — done. If it's **dirty or
   ahead of upstream** (uncommitted or unpushed commits), proceed to step 4.

4. **Trigger commit + push (only if needed).** Call `remote_machine_run` with
   `action: "git.commit_push"` and `args: { project: "<name>", message: "<short wip msg>" }`
   (or `you remote run <machine> git.commit_push --project <name> --message "..."`).
   This requires the opt-in `remote:command` scope on the key. The remote daemon
   executes a **whitelisted** git action only (never arbitrary commands).

5. **Confirm + report.** Read the returned result (`ok`, `gitState`, `output`).
   Tell the user exactly what happened and that they can now `git pull` here to
   resume. If it failed (e.g. auth, conflicts), report the redacted error and the
   safe next step — do not retry destructively.

## Allowed remote actions (the security boundary)

Only these may ever be triggered remotely: `git.status`, `git.last_activity`,
`git.commit_push`, `git.pull`, `agent.status`. Everything else is rejected by the
daemon. There is **no** arbitrary shell, force-push, reset, or file write. If the
user wants something outside this list, explain it's not a permitted remote action
and offer the closest safe option.

## Notes

- Prefer the read-only status call before any mutating one.
- All dispatches + results are audited (brain activity) and owner-scoped — a
  command can only target the user's own machines.
- See `project-context/CROSS-MACHINE-AGENTS.md` for the full architecture.
