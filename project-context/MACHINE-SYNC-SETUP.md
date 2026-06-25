# Machine Sync + Cross-Machine Agents — Setup

Exact steps to get a Mac fully synced with your you.md identity, skills, stacks,
projects, and secrets — and to enable **cross-machine agent commands** (check a
synced machine's work and trigger it to commit/push from another computer).

Requires `youmd` **≥ 0.8.18**.

---

## 1. Set up a machine (run the SAME steps on every Mac)

```bash
# 1. Install/upgrade the runtime to latest (0.8.18+), migrate ~/.youmd → ~/.you,
#    and run a base sync. One command does install + auth + sync + daemon.
curl -fsSL https://you.md/install.sh | bash

# 2. Re-login. An existing key from before the cross-machine feature does NOT
#    have the opt-in `remote:command` scope. A fresh login mints an owner-session
#    key that includes it (needed to DISPATCH remote commands from this machine).
you login            # approve in the browser

# 3. Reconcile everything: identity, skills, category/project skill-stacks, MCP,
#    repos, and encrypted env vault.
you machine sync-now

# 4. Install/reload the resident realtime daemon. This is what RECEIVES and runs
#    cross-machine commands. It runs under launchd and survives logout/restart.
you stack daemon install

# 5. Verify: this machine should be listed and the daemon should be live.
you remote list
```

**Why each step matters**
- A machine needs **step 2** (the `remote:command` scope) only to *issue* commands.
- A machine needs **step 4** (the daemon) to *receive and execute* commands targeted
  at it. So set up both on every Mac you want to reach or command from.
- Keys minted via `you login` are owner-session keys and now last without forced
  expiry, so sync won't silently break. (Mint a standalone permanent key with
  `you keys create --permanent --scopes read:private,write:bundle,write:memories,vault`.)

---

## 2. Use it — check + trigger work across machines

From any set-up machine, target another by its hostname (see `you remote list`,
e.g. `Houstons-Mini.lan`, `Houstons-MBP.lan`):

```bash
# Read-only — confirm the round-trip works first (safe, changes nothing):
you remote status Houstons-Mini.lan
you remote run    Houstons-Mini.lan git.status --project youmd

# Then trigger a commit + push so you can pull it down where you are now:
you remote run Houstons-Mini.lan git.commit_push --project youmd --message "wip: handoff"

# Other allowed actions: git.last_activity, git.pull
```

**Or just talk to your agent** — with the you.md MCP connected in Claude Code /
Cursor / Codex, say:

> "Check my Mac mini — if the youmd work isn't committed and pushed, have it commit
> and push so I can pull it here."

The `remote-machine` skill + `remote_machine_status` / `remote_machine_run` MCP
tools run the whole check → (commit+push if needed) → report flow. Zero manual steps
beyond the sentence.

---

## 3. Security model (what a remote can and can't do)

Only this fixed whitelist is ever executable remotely — never arbitrary shell:

| Action | Effect | Mutating |
|---|---|---|
| `git.status` | branch / dirty / ahead / behind / last commit | no |
| `git.last_activity` | last commit metadata | no |
| `git.commit_push` | `git add -A && commit -m <msg> && push` (current branch) | reversible |
| `git.pull` | `git pull --ff-only` | reversible |
| `agent.status` | host / runtime info | no |

- Commands run via `execFile` with explicit argv arrays (**no shell**, no injection).
- Project paths are confined to your known You.md project roots (no path escape).
- Owner-scoped: a command can only target **your own** machines.
- Every dispatch + result is audited; outputs are secret-redacted.

Full architecture: `project-context/CROSS-MACHINE-AGENTS.md`.

---

## 4. Troubleshooting

- **`API key lacks required scope: remote:command`** when dispatching → run `you login`
  on the issuing machine (step 2) to mint a scoped owner-session key.
- **A command hangs / times out with no result** → the target machine's daemon isn't
  running. On that machine: `you stack daemon install` (step 4), confirm with
  `you remote list` (it should not show `daemons 0/4`).
- **Wrong machine shows as "this"** anywhere → identity is keyed off `os.hostname()`;
  `you remote list` is the source of truth for hostnames.
