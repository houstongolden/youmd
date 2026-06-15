# env-vault — Secure .env.local Backup & Restore

Backs up all `.env.local` files across your CODE_2025 projects into a single
encrypted archive, and restores them on a new Mac. No secret values ever appear
in plaintext outside the encrypted blob.

---

## New-Machine Flow

### On the old Mac (backup)

```bash
# via CLI (preferred — ships in the npm package)
youmd env backup

# or directly via bash (from the youmd repo root)
cd /Users/houstongolden/Desktop/CODE_2025/youmd
bash cli/scripts/env-vault/backup.sh
```

This writes two files to `.env-vault/`:
- `env-vault-<date>.tar.<ext>` — encrypted archive (safe to transport)
- `manifest-<date>.txt` — variable names + counts only (safe to read, no values)

You will be prompted for a passphrase. Store it in **1Password** immediately.

### Transfer to new Mac

Options (all safe — the file is encrypted):
1. **AirDrop** the `.tar.<ext>` file directly
2. **USB drive** — copy to a thumb drive, plug into new Mac
3. **iCloud Drive** — upload briefly, download on new Mac, then delete from cloud

Do NOT transfer via unencrypted email or public Slack.

### On the new Mac (restore)

```bash
# Install dependencies first (e.g. Node, pnpm, etc.), then:
youmd env restore /path/to/env-vault-<date>.tar.<ext>

# If project dirs already exist with .env.local files:
youmd env restore --force /path/to/env-vault-<date>.tar.<ext>

# or directly via bash:
bash cli/scripts/env-vault/restore.sh /path/to/env-vault-<date>.tar.<ext>
bash cli/scripts/env-vault/restore.sh --force /path/to/env-vault-<date>.tar.<ext>
```

The script creates `<CODE_2025>/<project>/.env.local` for each project.
Existing files are backed up to `.env.local.bak.<timestamp>` (or overwritten with `--force`).

---

## 3-Location Backup Rule

Your encrypted vault should live in **at least 3 locations**:

| Location | Example |
|----------|---------|
| Local machine | `.env-vault/` (already done by backup.sh) |
| Secure cloud | 1Password attachment, private iCloud folder |
| Physical backup | USB drive stored separately from your Mac |

The encrypted file itself is safe to store anywhere. The passphrase is the secret.

---

## Security Model

- **Encryption:** `age` (preferred) → `gpg AES-256` → `openssl AES-256-CBC PBKDF2`
- **What's in the encrypted archive:** full `.env.local` file contents
- **What's in plaintext:** only the project name + variable NAMES + count (the manifest)
- **Values:** never printed, echoed, logged, or written anywhere outside the encrypted blob
- **Passphrase:** stored nowhere by these scripts — you must store it in 1Password

---

## CLI Integration

These scripts ship inside the `youmd` npm package (`cli/scripts/env-vault/`)
and are exposed as first-class CLI commands:

```bash
youmd env backup                # back up all .env.local files
youmd env backup --root <dir>   # custom search root
youmd env backup --out <dir>    # custom output dir

youmd env restore <vault>       # restore from an encrypted vault
youmd env restore --force       # overwrite existing .env.local files
youmd env restore --root <dir>  # restore into a custom root
```

The CLI wrapper delegates directly to these bash scripts via `spawnSync` with
`stdio: "inherit"` so the passphrase prompt and all output pass through to
your terminal unchanged.

---

## Flags

### backup.sh

| Flag | Default | Description |
|------|---------|-------------|
| `--root <dir>` | `~/Desktop/CODE_2025` | Where to discover `.env.local` files |
| `--out <dir>` | `youmd/.env-vault/` | Where to write encrypted vault + manifest |

### restore.sh

| Flag | Default | Description |
|------|---------|-------------|
| `--root <dir>` | `~/Desktop/CODE_2025` | Where to restore project `.env.local` files |
| `--force` | off | Overwrite existing `.env.local` instead of skipping |

---

## .gitignore Note

The `.env-vault/` output directory is listed in `youmd/.gitignore`. Encrypted
vault files are **never committed to git**. Only the scripts and this README
are tracked.
