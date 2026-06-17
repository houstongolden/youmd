---
name: machine-bootstrap
description: Set up a fresh computer with You.md identity, agent skills, stack sync, and active project repositories.
version: 1.0.0
scope: shared
identity_fields:
  - profile.about
  - profile.projects
  - preferences.agent
  - directives.agent
---

# machine-bootstrap

Use this skill when the user is on a new Mac, Mac mini, laptop, virtual computer, cloud workstation, or agent host and wants their You.md identity, projects, skills, stacks, and local code workspace restored.

You.md is the brain. The new machine should become a runnable local agent workstation, not just a copied folder.

## Identity Context

- **About:** {{profile.about}}
- **Projects:** {{profile.projects}}
- **Agent preferences:** {{preferences.agent}}
- **Directives:** {{directives.agent}}

## Default Flow

1. Confirm whether this looks like a fresh machine:
   - `youmd status`
   - `test -d ~/Desktop/CODE_YOU && find ~/Desktop/CODE_YOU -maxdepth 1 -type d | wc -l`
   - `git config user.name && git config user.email`
   - `gh auth status`
2. If the user is still on the old/source machine and wants a copy/paste handoff
   for Claude Code or Codex on the new machine, generate it first:

   ```bash
   youmd machine prompt --root ~/Desktop/CODE_YOU --days 90
   ```

   If the web dashboard minted a scoped bootstrap key, the generated prompt may
   include `YOUMD_API_KEY`. Treat that prompt as secret-bearing local setup
   material and do not paste it into public chats, tickets, or docs.

3. If You.md is not installed on the new machine, install it:

   ```bash
   curl -fsSL https://you.md/install.sh | bash
   ```

4. Authenticate and hydrate the local brain:

   ```bash
   youmd login --key "$YOUMD_API_KEY"  # or: youmd login
   youmd pull
   youmd sync
   ```

5. Restore shared agent skills, stack config, and host adapters:

   ```bash
   youmd machine setup
   youmd skill install all
   youmd skill sync
   youmd skill link codex
   youmd skill link claude
   ```

6. Hydrate the portfolio graph from You.md/GitHub records before cloning, then
   create the desktop code workspace and sync active projects:

   ```bash
   youmd project portfolio-hydrate --root ~/Desktop/CODE_YOU --days 90 --limit 80
   youmd machine projects --root ~/Desktop/CODE_YOU --days 90
   ```

7. If GitHub auth is missing, help the user log in and rerun only the project
   clone step:

   ```bash
   gh auth login
   youmd machine projects --root ~/Desktop/CODE_YOU --days 90
   ```

8. After projects are cloned and any encrypted env vault is restored, hydrate the
   portfolio graph again so local README, project-context, git, PR, and env-key
   evidence becomes visible to future agents:

   ```bash
   youmd project portfolio-hydrate --root ~/Desktop/CODE_YOU --days 90 --limit 80
   ```

## Project Bootstrap Rules

- Use repo directory names from GitHub URLs. `https://github.com/houstongolden/foldermd` becomes `foldermd`.
- Default to projects active in the last 90 days plus projects marked active/current in You.md.
- Ask before including older, archived, paused, or dormant projects.
- Create the workspace root on the Desktop if it is missing. `CODE_YOU` is the default fresh-machine root.
- Use the You.md Portfolio Graph as the strategic source of truth, then merge
  authenticated GitHub recent-repo data and local bundle project records so repo
  names and URLs stay cloneable.
- Clone with `gh repo clone owner/repo <target>` when `gh` is authenticated; otherwise fall back to `git clone`.
- Skip non-empty directories instead of overwriting them.
- Never print secrets. If `.env.local` files are needed, use the shared encrypted env backup/restore path or a password manager.
- After cloning, initialize missing per-repo agent context with `youmd skill init-project` from inside that repo.

## Secret-Safe Env Transfer

Audit local project env coverage before backup:

```bash
~/.agent-shared/bin/env-key-audit.py --root ~/Desktop/CODE_2025
~/.agent-shared/bin/env-secure-backup.sh --preflight
```

Create an encrypted archive from the old machine in an interactive macOS terminal:

```bash
open ~/.agent-shared/bin/env-backup-interactive.command
```

On the new machine, list the encrypted archive by path only before restore:

```bash
~/.agent-shared/bin/env-secure-restore.sh --archive ~/Desktop/env-local-backup.tar.gz.gpg --list
```

## Useful Variants

Dry-run the project layout:

```bash
youmd machine projects --root ~/Desktop/CODE_YOU --days 90 --dry-run
```

Create directories only, without cloning:

```bash
youmd machine projects --root ~/Desktop/CODE_YOU --no-clone
```

Include older projects without prompts:

```bash
youmd machine projects --root ~/Desktop/CODE_YOU --yes
```

Generate the copy/paste prompt for a new Claude Code or Codex terminal:

```bash
youmd machine prompt --root ~/Desktop/CODE_YOU --days 90 --limit 80
```

## Done Means

- You.md CLI is installed and authenticated.
- The local bundle is pulled/synced.
- Shared skills/stacks/agent config are restored.
- A Desktop code root exists.
- Active GitHub-backed project repos are cloned into matching repo-name directories.
- The portfolio graph is hydrated from both remote project records and local
  code/project-context/env-key evidence.
- `.env.local` files, if restored, came from encrypted vault tooling without
  printing raw values.
- Older projects are either explicitly included or intentionally skipped.
- The user can launch Claude Code or Codex inside the workspace and run `you`.
