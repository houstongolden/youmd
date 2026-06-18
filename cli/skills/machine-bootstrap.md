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
   youmd machine prompt --root ~/Desktop/CODE_YOU --days 30 --limit 80 --require-env-vault
   ```

   If the web dashboard minted a scoped bootstrap key, the generated prompt may
   include `YOUMD_API_KEY`. Treat that prompt as secret-bearing local setup
   material and do not paste it into public chats, tickets, or docs.
   Fresh-machine bootstrap keys must include the `vault` scope so the trusted
   device can pull encrypted Secret Vault snapshots after login.
   For bounded proof runs on a clean local root, add
   `--max-clone-projects 2` or set `YOUMD_MAX_CLONE_PROJECTS=2`; omit that cap
   on the real new machine.

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
   preview the graph-backed setup plan before creating the desktop code workspace
   and syncing truly active 30-day projects first:

   ```bash
   youmd project portfolio-hydrate --root ~/Desktop/CODE_YOU --days 30 --limit 80
   youmd machine projects --root ~/Desktop/CODE_YOU --days 30 --recent-only --dry-run
   youmd machine projects --root ~/Desktop/CODE_YOU --days 30 --recent-only
   ```

7. Ask whether Houston wants to expand the workspace to all active projects
   from the last 90 days before calling the full project clone set complete:

   ```bash
   youmd project portfolio-hydrate --root ~/Desktop/CODE_YOU --days 90 --limit 80
   youmd machine projects --root ~/Desktop/CODE_YOU --days 90 --recent-only --dry-run
   youmd machine projects --root ~/Desktop/CODE_YOU --days 90 --recent-only
   ```

8. If GitHub auth is missing, help the user log in and rerun only the project
   clone step:

   ```bash
   gh auth login
   youmd machine projects --root ~/Desktop/CODE_YOU --days 30 --recent-only
   ```

9. After projects are cloned and any encrypted env vault is restored, hydrate the
   portfolio graph again so local README, project-context, git, PR, and env-key
   evidence becomes visible to future agents:

   ```bash
   youmd project portfolio-hydrate --root ~/Desktop/CODE_YOU --days 30 --limit 80
   ```

10. Run the secret-safe readiness audit and sync the proof summary:

   ```bash
   youmd machine verify --root ~/Desktop/CODE_YOU --max-projects 80 --write-report --sync-report
   ```

   This checks cloned directories, git remotes, package managers, standard
   scripts, `.env.local` presence, `.env.example` presence, root agent docs, and
   `project-context/` presence. It writes a secret-safe JSON proof artifact to
   `~/.youmd/machine-reports/latest.json` and syncs only the compact proof
   summary to the You.md machine dashboard. It does not read secret values,
   upload raw logs, or launch every dev server.

11. Only when Houston explicitly wants deeper local proof or the clean host has
    enough time/CPU, run bounded package checks and dev-server probes:

   ```bash
   youmd machine verify --root ~/Desktop/CODE_YOU --max-projects 80 --install-deps --run-checks --probe-servers --write-report --sync-report
   ```

   The default check scripts are `typecheck`, `lint`, `test`, and `build`.
   Override with `--check-scripts lint,build` when needed. Dependency installs
   and dev-server probes are capped by default; tune with
   `--max-install-projects`, `--max-server-projects`, and timeout flags.

## Behind-the-Scenes Agent Operation

- Use the You.md CLI and You Agent yourself before asking Houston to do manual
  work. Prefer deterministic commands for setup and proof:
  `youmd status`, `youmd whoami`, `youmd pull`, `youmd sync`,
  `youmd machine prompt`, `youmd machine setup`,
  `youmd skill install all`, `youmd skill sync`,
  `youmd env vault list`, `youmd env vault pull`,
  `youmd project portfolio-hydrate`, `youmd machine verify`,
  `youmd agent status`, and `youmd agent inbox`.
- Report setup milestones to Houston's other trusted Macs with the realtime
  agent bus instead of relying on clipboard/manual status relays:

  ```bash
  youmd agent send --channel machine-sync --kind status "Mac mini completed identity + skill sync"
  ```

  This writes through Convex realtime and the receiving daemon materializes it
  into `~/.youmd/agent-bus/inbox.json` without reading or exposing `.env.local`
  values.
- Use `you` / `youmd chat` when you need the You Agent to synthesize context,
  route a natural-language request, or produce the setup artifact, then turn the
  result into concrete shell actions.
- Do not stop to ask "what next?" after each setup phase. Continue through the
  command, verify the result, and report concise proof.
- Interrupt Houston only for true human-gated steps: GitHub browser auth,
  source-Mac Secret Vault share/passphrase entry if no trusted-device envelope
  exists yet, npm OTP, OS permissions, or the explicit 90-day project expansion
  choice.
- If the installed CLI is stale, run the curl installer/update path first, then
  retry the You.md command. Tell Houston when npm publish is needed for
  `npx youmd@latest` or npm fallback installs.

## Project Bootstrap Rules

- Use repo directory names from GitHub URLs. `https://github.com/houstongolden/foldermd` becomes `foldermd`.
- Default to projects active in the last 30 days and marked active plus Top
  Priority/Focusing in You.md. Ask before expanding to the 90-day active set.
- Ask before including older, archived, paused, inactive, on-ice, abandoned,
  killed, dormant, or unsorted projects.
- Create the workspace root on the Desktop if it is missing. `CODE_YOU` is the default fresh-machine root.
- Use the You.md Portfolio Graph as the strategic source of truth, then merge
  authenticated GitHub recent-repo data and local bundle project records so repo
  names and URLs stay cloneable.
- `youmd machine projects` should fetch the persisted owner graph through the
  You.md API when authenticated. If that graph is unavailable, fall back to the
  local bundle plus authenticated GitHub scan and say so.
- Clone with `gh repo clone owner/repo <target>` when `gh` is authenticated; otherwise fall back to `git clone`.
- Skip non-empty directories instead of overwriting them.
- Never print secrets. If `.env.local` files are needed, use You.md Secret Vault
  or the shared encrypted env backup/restore path. Never paste raw env values
  into chat.
- After cloning, initialize missing per-repo agent context with `youmd skill init-project` from inside that repo.

## Secret-Safe Env Transfer

Audit local project env coverage before backup:

```bash
~/.agent-shared/bin/env-key-audit.py --root ~/Desktop/CODE_2025
~/.agent-shared/bin/env-secure-backup.sh --preflight
youmd env backup --root ~/Desktop/CODE_2025 --preflight
```

Primary path: from the old/source machine, create an encrypted archive and push
only the ciphertext plus safe manifest metadata to You.md Secret Vault:

```bash
youmd env vault push --root ~/Desktop/CODE_2025 --out ~/Desktop/youmd-env-vault
youmd env vault list
```

On the new machine, register its local Secret Vault device key. The private key
stays under `~/.youmd/secret-vault/devices/`; only the public key is synced:

```bash
youmd env vault device-register
```

Back on the old/source machine, share local decrypt access to trusted devices.
This stores per-device encrypted passphrase envelopes; it does not upload raw env
values:

```bash
youmd env vault share
```

On the new machine, pull the latest encrypted account snapshot and restore into
already-cloned project directories without clobbering local agent auth:

```bash
youmd env vault pull --restore --root ~/Desktop/CODE_YOU --map-existing --existing-only --skip-agent-auth
```

If `pull --restore` says no trusted-device envelope exists for this Mac, do not
ask Houston for raw secrets. Confirm `device-register` ran on the new Mac, run
`youmd env vault share` on the source Mac, then rerun `pull --restore`.

Fallback path: create an encrypted archive from the old machine in an
interactive macOS terminal and transfer the encrypted file by iCloud, AirDrop,
USB, or private password-manager attachment:

```bash
open ~/.agent-shared/bin/env-backup-interactive.command
youmd env backup --root ~/Desktop/CODE_2025 --out ~/Desktop/youmd-env-vault
```

On the new machine, list the encrypted archive by path only before restore:

```bash
~/.agent-shared/bin/env-secure-restore.sh --archive ~/Desktop/env-local-backup.tar.gz.gpg --list
youmd env restore ~/Desktop/env-local-backup.tar.gz.gpg --root ~/Desktop/CODE_YOU --list --map-existing --existing-only --skip-agent-auth
youmd env restore ~/Desktop/env-local-backup.tar.gz.gpg --root ~/Desktop/CODE_YOU --map-existing --existing-only --skip-agent-auth
```

If a headless agent still cannot decrypt after device sharing, then and only then
use the macOS Keychain fallback for the env-vault passphrase. Input is silent and
the value is not printed:

```bash
read -rs "PW?You.md vault passphrase: " && \
security add-generic-password -a "$USER" -s youmd-env-vault -w "$PW" -U && \
unset PW && echo "stored in Keychain"
```

## Useful Variants

Dry-run the project layout:

```bash
youmd machine projects --root ~/Desktop/CODE_YOU --days 30 --recent-only --dry-run
```

Create directories only, without cloning:

```bash
youmd machine projects --root ~/Desktop/CODE_YOU --no-clone
```

Audit cloned readiness:

```bash
youmd machine verify --root ~/Desktop/CODE_YOU --max-projects 80 --write-report --sync-report
```

Run bounded package checks:

```bash
youmd machine verify --root ~/Desktop/CODE_YOU --run-checks --max-check-projects 8 --check-timeout-ms 120000
```

Run clean-host dependency installs and localhost dev-server probes:

```bash
youmd machine verify --root ~/Desktop/CODE_YOU --install-deps --probe-servers --write-report --sync-report
```

Include older projects without prompts:

```bash
youmd machine projects --root ~/Desktop/CODE_YOU --yes
```

Generate the copy/paste prompt for a new Claude Code or Codex terminal:

```bash
youmd machine prompt --root ~/Desktop/CODE_YOU --days 30 --limit 80 --require-env-vault
```

Generate the same prompt but cap clones for a clean-host proof run:

```bash
youmd machine prompt --root /tmp/youmd-clean-host-CODE_YOU --days 30 --limit 80 --max-clone-projects 2 --require-env-vault
```

Fetch the secret-safe project graph directly:

```bash
curl -H "Authorization: Bearer $YOUMD_API_KEY" https://you.md/api/v1/me/portfolio/graph
```

## Done Means

- You.md CLI is installed and authenticated.
- The local bundle is pulled/synced.
- Shared skills/stacks/agent config are restored.
- A Desktop code root exists.
- Active GitHub-backed project repos are cloned into matching repo-name directories.
- The clone plan visibly used the persisted portfolio graph, authenticated
  GitHub recent repos, and local bundle records with source counts.
- `youmd machine verify` reports git/package/env/agent-doc/project-context
  readiness for the cloned workspace without reading `.env.local` values and
  writes `~/.youmd/machine-reports/latest.json`.
- `--sync-report` creates or updates an owner-gated You.md machine proof row
  that the dashboard can show across computers.
- If `--run-checks` was requested, bounded package checks ran with project and
  timeout caps, and failures/timeouts were reported per project.
- If `--install-deps` or `--probe-servers` was requested, dependency installs
  and localhost server probes ran with project and timeout caps, and the proof
  report shows install/check/server pass counts.
- The portfolio graph is hydrated from both remote project records and local
  code/project-context/env-key evidence.
- `.env.local` files, if restored, came from encrypted vault tooling without
  printing raw values.
- Older projects are either explicitly included or intentionally skipped.
- The user can launch Claude Code or Codex inside the workspace and run `you`.
