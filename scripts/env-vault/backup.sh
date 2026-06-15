#!/usr/bin/env bash
# env-vault/backup.sh — backs up all .env.local files under CODE_2025 into an
# encrypted vault. NEVER prints, echoes, logs, or writes any secret VALUE.
# Only variable NAMES and counts appear in plaintext output.
#
# Usage: bash backup.sh [--root <search-root>] [--out <output-dir>]
# Defaults:
#   search-root: /Users/houstongolden/Desktop/CODE_2025
#   output-dir:  /Users/houstongolden/Desktop/CODE_2025/youmd/.env-vault

set -euo pipefail

# ── configurable defaults ──────────────────────────────────────────────────────
SEARCH_ROOT="${ENV_VAULT_ROOT:-/Users/houstongolden/Desktop/CODE_2025}"
OUTPUT_DIR="${ENV_VAULT_OUT:-/Users/houstongolden/Desktop/CODE_2025/youmd/.env-vault}"

# ── parse flags ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --root)  SEARCH_ROOT="$2"; shift 2 ;;
    --out)   OUTPUT_DIR="$2";  shift 2 ;;
    *) echo "Unknown flag: $1" >&2; exit 1 ;;
  esac
done

# ── detect encryption tool ────────────────────────────────────────────────────
# Prefer openssl: it ships on every macOS install, so a vault encrypted with it
# can ALWAYS be restored on a brand-new Mac (which may not have age or gpg). The
# others are used only if openssl is somehow unavailable. Set ENV_VAULT_PASS to
# run non-interactively (e.g. from automation); otherwise you'll be prompted.
ENC_TOOL=""
ENC_EXT=""
if command -v openssl &>/dev/null; then
  ENC_TOOL="openssl"
  ENC_EXT="enc"
elif command -v age &>/dev/null; then
  ENC_TOOL="age"
  ENC_EXT="age"
elif command -v gpg &>/dev/null; then
  ENC_TOOL="gpg"
  ENC_EXT="gpg"
else
  echo "ERROR: No encryption tool found. Install age, gpg, or openssl." >&2
  exit 1
fi

echo "Encryption tool: ${ENC_TOOL}"

# ── discover .env.local files (handles spaces in dir names) ───────────────────
# bash 3.2 (macOS default) has no `mapfile`, so build the array with read -d ''.
ENV_FILES=()
while IFS= read -r -d '' _envf; do
  ENV_FILES+=("${_envf}")
done < <(find "${SEARCH_ROOT}" -maxdepth 2 -name ".env.local" -print0 2>/dev/null)

if [[ ${#ENV_FILES[@]} -eq 0 ]]; then
  echo "No .env.local files found under ${SEARCH_ROOT}" >&2
  exit 1
fi

echo "Found ${#ENV_FILES[@]} .env.local file(s)."

# ── build plaintext manifest (names + counts, NO values) ─────────────────────
mkdir -p "${OUTPUT_DIR}"
UTC_DATE="$(date -u +%Y-%m-%dT%H%MZ)"
MANIFEST_PATH="${OUTPUT_DIR}/manifest-${UTC_DATE}.txt"

{
  echo "env-vault manifest — ${UTC_DATE}"
  echo "Encryption: ${ENC_TOOL}"
  echo "Search root: ${SEARCH_ROOT}"
  echo "---"
} > "${MANIFEST_PATH}"

# ── stage files into a temp dir preserving project-relative paths ─────────────
STAGING_DIR="$(mktemp -d)"
trap 'rm -rf "${STAGING_DIR}"' EXIT

for ENV_FILE in "${ENV_FILES[@]}"; do
  PROJECT_DIR="$(dirname "${ENV_FILE}")"
  PROJECT_NAME="$(basename "${PROJECT_DIR}")"

  # Store as <project-name>/.env.local inside the archive
  DEST="${STAGING_DIR}/${PROJECT_NAME}"
  mkdir -p "${DEST}"
  cp "${ENV_FILE}" "${DEST}/.env.local"

  # Count variable names only — never read values
  VAR_COUNT=$(grep -cE '^[A-Za-z_][A-Za-z0-9_]*=' "${ENV_FILE}" 2>/dev/null || true)
  VAR_NAMES=$(grep -oE '^[A-Za-z_][A-Za-z0-9_]*' "${ENV_FILE}" 2>/dev/null \
              | grep -v '^$' | sort | paste -sd ',' - || true)

  echo "${PROJECT_NAME}/.env.local: ${VAR_COUNT} variable(s) [${VAR_NAMES}]" \
    >> "${MANIFEST_PATH}"
done

echo "" >> "${MANIFEST_PATH}"
echo "SECURITY: The encrypted archive is safe to transport. Keep the passphrase private." \
  >> "${MANIFEST_PATH}"

# ── create tar from staging dir ───────────────────────────────────────────────
# BSD mktemp (macOS) has no --suffix; the tar path is temporary and deleted
# after encryption, so a plain mktemp is fine.
TAR_PATH="$(mktemp)"
tar -cf "${TAR_PATH}" -C "${STAGING_DIR}" .

VAULT_PATH="${OUTPUT_DIR}/env-vault-${UTC_DATE}.tar.${ENC_EXT}"

# ── encrypt ───────────────────────────────────────────────────────────────────
echo ""
echo "Enter a strong passphrase to encrypt the vault."
echo "(You will need this passphrase to restore on a new machine — store it safely.)"
echo ""

case "${ENC_TOOL}" in
  openssl)
    if [[ -n "${ENV_VAULT_PASS:-}" ]]; then
      openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:ENV_VAULT_PASS \
          -in "${TAR_PATH}" -out "${VAULT_PATH}"
    else
      openssl enc -aes-256-cbc -pbkdf2 -salt \
          -in "${TAR_PATH}" -out "${VAULT_PATH}"
    fi
    ;;
  age)
    age -p -o "${VAULT_PATH}" "${TAR_PATH}"
    ;;
  gpg)
    if [[ -n "${ENV_VAULT_PASS:-}" ]]; then
      printf '%s' "${ENV_VAULT_PASS}" | gpg --batch --yes --symmetric \
          --cipher-algo AES256 --passphrase-fd 0 --pinentry-mode loopback \
          --output "${VAULT_PATH}" "${TAR_PATH}"
    else
      gpg --symmetric --cipher-algo AES256 --output "${VAULT_PATH}" "${TAR_PATH}"
    fi
    ;;
esac

# Securely remove the unencrypted tar
rm -f "${TAR_PATH}"

# ── final output ──────────────────────────────────────────────────────────────
VAULT_SIZE=$(du -sh "${VAULT_PATH}" | cut -f1)

echo ""
echo "Vault written: ${VAULT_PATH} (${VAULT_SIZE})"
echo "Manifest:      ${MANIFEST_PATH}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  NEXT STEPS — 3-LOCATION BACKUP RULE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  The encrypted vault is safe to move (secrets are encrypted)."
echo "  Store it in at least 3 locations:"
echo "    1. ✓ Already here: ${OUTPUT_DIR}"
echo "    2. Copy to iCloud Drive / 1Password attachment / USB drive"
echo "    3. Copy to a second USB or private cloud vault"
echo ""
echo "  Transfer to new Macs:"
echo "    • AirDrop the .${ENC_EXT} file directly"
echo "    • OR copy via USB drive"
echo "    • OR store in private (non-public) cloud storage"
echo ""
echo "  On the new Mac, run:"
echo "    bash restore.sh <path-to-vault.tar.${ENC_EXT}>"
echo ""
echo "  The passphrase is NOT stored anywhere — keep it in 1Password."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
