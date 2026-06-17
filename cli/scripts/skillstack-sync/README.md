# skillstack-sync

Cross-machine sync toolkit for Houston Golden's agent skill/stack setup.

## What this syncs

### Sync plane: Skills & Stacks (this toolkit)

| What | How | Notes |
|---|---|---|
| `~/.agent-shared` | git push/pull to `houstongolden/agent-shared` | Canonical shared agent layer: AGENTS.md, learnings, preferences, STACK-MAP |
| `~/.claude/scistack` | git push/pull to `Hubify-Projects/scistack` | Science skills: astrostack, hubstack, extensions |
| 4 loose skills (see below) | rsync into agent-shared repo, then back out | Ride along in agent-shared without their own repo |

**Loose skills synced via agent-shared/claude-skills/:**
- `agent-runtime-guard`
- `agent-stack-sync`
- `continue`
- `skill-governor`

### What does NOT sync here

| What | Why |
|---|---|
| `~/.claude/skills/gstack/` | Tracks upstream `garrytan/gstack` — updated via `/gstack-upgrade`, read-only to us |
| Project files / code | Synced via their own project repos (youmd, bamfaiapp, etc.) |
| Secrets / env vars | Use the env-vault (`cli/scripts/env-vault/`) |

### Complementary sync planes

- **Identity plane:** `youmd sync --daemon` (Convex ↔ local profile, memories, preferences). Automated via `com.youmd.identity-sync` daemon. Daemon mode refreshes local files/skills and skips unsafe lossy pushes instead of forcing over richer server data.
- **Project-context plane:** `youmd stack context-sync` safely commits and syncs only `AGENTS.md`, `CLAUDE.md`, `project-context/`, and `.claude/` in curated Houston-owned repos. It refuses to merge remote app-code changes.
- **Env-vault plane:** `cli/scripts/env-vault/restore.sh` for secrets (manual, invoked on new machine); also available as `youmd env restore <vault>`.

---

## Files

```
cli/scripts/skillstack-sync/
├── sync.sh                         Core syncer (bash 3.2 compatible)
├── install-daemons.sh              Installs all resident LaunchAgents
├── bootstrap-new-mac.sh            New machine setup script
├── com.youmd.skillstack-sync.plist LaunchAgent: runs `youmd stack sync` every 5 min
├── com.youmd.identity-sync.plist   LaunchAgent: runs `youmd sync --daemon` every 5 min
├── com.youmd.context-sync.plist    LaunchAgent: runs `youmd stack context-sync` every 15 min
└── README.md                       This file
```

---

## Sync logic (sync.sh)

```
1. Mirror loose skills:  ~/.claude/skills/<name>/ → ~/.agent-shared/claude-skills/<name>/
2. Sync ~/.agent-shared:
     a. git add -A + commit "auto-sync: <host> <timestamp>" if dirty
     b. git pull --no-rebase --no-edit (merge)
        → on conflict: abort merge, log LOUD warning, skip push, continue
     c. git push
3. Sync ~/.claude/scistack: same a/b/c sequence
4. Reverse-mirror loose skills: ~/.agent-shared/claude-skills/<name>/ → ~/.claude/skills/<name>/
     → backs up existing local copy to <name>.bak.<timestamp> before overwriting
     → skips if no changes detected
```

All actions logged to `~/.youmd/logs/skillstack-sync.log`.

### Flags

```bash
youmd stack sync              # live sync (all repos + loose skills)
youmd stack sync --dry-run    # log what WOULD happen, write nothing

# or run the script directly:
./sync.sh
./sync.sh --dry-run
```

### Env overrides

```bash
SKILLSTACK_REPOS="/path/to/repo1 /path/to/repo2"  # override repo list
GIT_USER_NAME="Houston Golden"                      # commit author (default)
GIT_USER_EMAIL="houston@bamf.ai"                    # commit email (default)
```

---

## Daemon setup (existing machine)

The preferred way is via the CLI:

```bash
youmd stack daemon install    # installs all resident LaunchAgents
youmd stack daemon status     # check loaded/not-loaded
youmd stack daemon uninstall  # remove plists from ~/Library/LaunchAgents/
```

Or run the raw script directly:

```bash
bash cli/scripts/skillstack-sync/install-daemons.sh
```

Installs three LaunchAgents:
- `com.youmd.skillstack-sync` → runs `youmd stack sync`
- `com.youmd.identity-sync` → runs `youmd sync --daemon`
- `com.youmd.context-sync` → runs `youmd stack context-sync`

Check status:
```bash
youmd stack daemon status
# or directly:
launchctl list com.youmd.skillstack-sync
launchctl list com.youmd.identity-sync
launchctl list com.youmd.context-sync
```

Check logs:
```bash
tail -f ~/.youmd/logs/skillstack-sync.log
tail -f ~/.youmd/logs/skillstack-sync.out.log
tail -f ~/.youmd/logs/identity-sync.out.log
tail -f ~/.youmd/logs/context-sync.log
```

### Uninstall daemons

```bash
youmd stack daemon uninstall
```

Or manually:
```bash
launchctl unload ~/Library/LaunchAgents/com.youmd.skillstack-sync.plist
launchctl unload ~/Library/LaunchAgents/com.youmd.identity-sync.plist
launchctl unload ~/Library/LaunchAgents/com.youmd.context-sync.plist
rm ~/Library/LaunchAgents/com.youmd.skillstack-sync.plist
rm ~/Library/LaunchAgents/com.youmd.identity-sync.plist
rm ~/Library/LaunchAgents/com.youmd.context-sync.plist
```

---

## New Mac setup

```bash
# 1. Install youmd CLI
curl -fsSL https://you.md/install.sh | bash

# 2. Clone this repo (youmd)
git clone https://github.com/houstongolden/youmd ~/Desktop/CODE_2025/youmd

# 3. Run bootstrap (clones agent-shared + scistack)
bash ~/Desktop/CODE_2025/youmd/cli/scripts/skillstack-sync/bootstrap-new-mac.sh

# 4. Restore secrets from env-vault (manual step — see env-vault/README)

# 5. Activate daemons
youmd stack daemon install
```

The bootstrap script is idempotent (safe to re-run).

---

## Compatibility

Scripts target macOS with:
- bash 3.2.57 (default macOS shell)
- BSD coreutils (no GNU `mapfile`, no `mktemp --suffix`, BSD `date`/`find`/`rsync`)
- No external tools installed beyond: `git`, `rsync`, `bash` (all stock on macOS)
