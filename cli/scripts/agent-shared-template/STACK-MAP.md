# Stack Map

This is your shared agent stack — a private git repository that travels with
you across every machine and keeps every AI agent host in sync.

## What lives here

| Path | Purpose |
|------|---------|
| `AGENTS.md` | Canonical shared agent instructions (symlinked into every host) |
| `STACK-MAP.md` | This file — orientation for agents landing in this repo |
| `claude-skills/` | Shared skills, each as `<name>/SKILL.md` |
| `bin/sync-agent-shared.sh` | Idempotent sync script — run on every machine after cloning |

## How to sync a new machine

1. Clone this repo to `~/.agent-shared`:
   ```bash
   git clone <remote-url> ~/.agent-shared
   ```
2. Run the sync script:
   ```bash
   bash ~/.agent-shared/bin/sync-agent-shared.sh
   ```
3. The script symlinks `AGENTS.md` into every agent host and registers all skills.

## How syncing stays live

You.md's `you stack sync` and the resident skillstack daemon handle pulling,
committing local changes, and pushing automatically. Run `you stack sync` to
trigger it manually, or install daemons with `you stack daemon install`.
