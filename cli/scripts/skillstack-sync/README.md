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

- **Realtime identity/project/Skill Mesh plane:** `youmd sync --live --daemon` subscribes to Convex websocket updates, mints only a short-lived sync session token, materializes identity files and installed You.md skills locally, and triggers bounded shared stack/project-context plus safe agent-stack inventory syncs. It never prints or returns raw `.env.local` values.
- **Identity repair plane:** `youmd sync --daemon` (Convex ↔ local profile, memories, preferences). Automated via `com.you.identity-sync` daemon as a timer-based fallback. Daemon mode refreshes local files/skills and skips unsafe lossy pushes instead of forcing over richer server data.
- **Project-context plane:** `youmd stack context-sync` safely commits and syncs only `AGENTS.md`, `CLAUDE.md`, `project-context/`, and `.claude/` in curated Houston-owned repos. It refuses to merge remote app-code changes.
- **Env-vault plane:** `cli/scripts/env-vault/restore.sh` for secrets (manual, invoked on new machine); also available as `youmd env restore <vault>`.

---

## Files

```
cli/scripts/skillstack-sync/
├── sync.sh                         Core syncer (bash 3.2 compatible)
├── install-daemons.sh              Installs all resident LaunchAgents
├── bootstrap-new-mac.sh            New machine setup script
├── com.you.realtime-sync.plist     LaunchAgent: runs `youmd sync --live --daemon` as a resident websocket + Skill Mesh syncer
├── com.you.skillstack-sync.plist   LaunchAgent: runs `youmd stack sync` every 5 min
├── com.you.identity-sync.plist     LaunchAgent: runs `youmd sync --daemon` every 5 min
├── com.you.context-sync.plist      LaunchAgent: runs `youmd stack context-sync` every 15 min
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

All actions logged to `~/.you/logs/skillstack-sync.log`, with legacy `~/.youmd` logs still readable during migration.

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

Installs four LaunchAgents:
- `com.you.realtime-sync` → runs `youmd sync --live --daemon`, including a bounded `youmd skill inventory --sync` pass every 30 minutes by default
- `com.you.skillstack-sync` → runs `youmd stack sync`
- `com.you.identity-sync` → runs `youmd sync --daemon`
- `com.you.context-sync` → runs `youmd stack context-sync`

Skill Mesh inventory knobs:

```bash
YOUMD_LIVE_SYNC_INVENTORY=0                    # disable resident inventory sync
YOUMD_LIVE_SYNC_INVENTORY_INTERVAL_SECONDS=900 # tune cadence; default 1800
YOU_AGENT_STACK_INVENTORY_DIR=~/.you/agent-stack-inventory
```

Check status:
```bash
youmd stack daemon status
# or directly:
launchctl list com.you.skillstack-sync
launchctl list com.you.realtime-sync
launchctl list com.you.identity-sync
launchctl list com.you.context-sync
```

Check logs:
```bash
tail -f ~/.you/logs/skillstack-sync.log
tail -f ~/.you/logs/skillstack-sync.out.log
tail -f ~/.you/logs/identity-sync.out.log
tail -f ~/.you/logs/context-sync.log
```

### Uninstall daemons

```bash
youmd stack daemon uninstall
```

Or manually:
```bash
launchctl unload ~/Library/LaunchAgents/com.you.skillstack-sync.plist
launchctl unload ~/Library/LaunchAgents/com.you.identity-sync.plist
launchctl unload ~/Library/LaunchAgents/com.you.context-sync.plist
rm ~/Library/LaunchAgents/com.you.skillstack-sync.plist
rm ~/Library/LaunchAgents/com.you.identity-sync.plist
rm ~/Library/LaunchAgents/com.you.context-sync.plist
```

---

## New Mac setup

Preferred path: open the You.md Machine tab on an authenticated source computer,
copy the fresh-machine Claude/Codex setup prompt, and paste it into Claude Code
or Codex on the new Mac. That generated prompt checks/install Homebrew, Node 22,
GitHub CLI, bun, and pnpm; authenticates You.md; requires GitHub auth before
private clones; clones only setup-eligible active projects into
`~/Desktop/CODE_YOU`; restores env files with `--map-existing --existing-only
--skip-agent-auth`; and installs resident daemons.

Fallback manual path:

```bash
# 1. Install youmd CLI
curl -fsSL https://you.md/install.sh | bash

# 2. Authenticate GitHub before private stack/project clones
gh auth login -h github.com -p https -s repo

# 3. Clone this repo (youmd)
git clone https://github.com/houstongolden/youmd ~/Desktop/CODE_2025/youmd

# 4. Run bootstrap (clones agent-shared + scistack)
bash ~/Desktop/CODE_2025/youmd/cli/scripts/skillstack-sync/bootstrap-new-mac.sh

# 5. Restore project env files from env-vault (manual step — see env-vault/README)
youmd env restore <vault> --root ~/Desktop/CODE_YOU --map-existing --existing-only --skip-agent-auth

# 6. Activate daemons
youmd stack daemon install
```

The bootstrap script is idempotent (safe to re-run).

---

## Compatibility

Scripts target macOS with:
- bash 3.2.57 (default macOS shell)
- BSD coreutils (no GNU `mapfile`, no `mktemp --suffix`, BSD `date`/`find`/`rsync`)
- No external tools installed beyond: `git`, `rsync`, `bash` (all stock on macOS)
