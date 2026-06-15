#!/usr/bin/env bash
# env-vault/restore.sh — restores .env.local files from an encrypted vault
# created by backup.sh. NEVER prints, echoes, or logs any secret VALUES.
# Only prints which file paths were restored or skipped.
#
# Usage: bash restore.sh [--force] [--root <target-root>] <vault-file>
#   vault-file: path to env-vault-*.tar.age / .tar.gpg / .tar.enc
#   --force:    overwrite existing .env.local files without backing them up
#   --root:     destination root (default: /Users/houstongolden/Desktop/CODE_2025)

set -euo pipefail

# ── defaults ──────────────────────────────────────────────────────────────────
TARGET_ROOT="${ENV_VAULT_RESTORE_ROOT:-/Users/houstongolden/Desktop/CODE_2025}"
FORCE=false
VAULT_FILE=""

# ── parse args ─────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --force)  FORCE=true; shift ;;
    --root)   TARGET_ROOT="$2"; shift 2 ;;
    -*)       echo "Unknown flag: $1" >&2; exit 1 ;;
    *)
      if [[ -z "${VAULT_FILE}" ]]; then
        VAULT_FILE="$1"
      else
        echo "Unexpected argument: $1" >&2
        exit 1
      fi
      shift ;;
  esac
done

if [[ -z "${VAULT_FILE}" ]]; then
  echo "Usage: bash restore.sh [--force] [--root <path>] <vault-file>" >&2
  echo "  vault-file: env-vault-*.tar.age | .tar.gpg | .tar.enc" >&2
  exit 1
fi

if [[ ! -f "${VAULT_FILE}" ]]; then
  echo "ERROR: Vault file not found: ${VAULT_FILE}" >&2
  exit 1
fi

# ── detect encryption tool from extension ─────────────────────────────────────
case "${VAULT_FILE}" in
  *.tar.age) ENC_TOOL="age" ;;
  *.tar.gpg) ENC_TOOL="gpg" ;;
  *.tar.enc) ENC_TOOL="openssl" ;;
  *)
    echo "ERROR: Unrecognised vault extension. Expected .tar.age / .tar.gpg / .tar.enc" >&2
    exit 1 ;;
esac

if ! command -v "${ENC_TOOL}" &>/dev/null && [[ "${ENC_TOOL}" != "openssl" ]]; then
  echo "ERROR: ${ENC_TOOL} is not installed." >&2
  exit 1
fi

echo "Encryption tool: ${ENC_TOOL}"
echo "Vault file:      ${VAULT_FILE}"
echo "Target root:     ${TARGET_ROOT}"
echo ""

# ── decrypt into a temp dir ────────────────────────────────────────────────────
WORK_DIR="$(mktemp -d)"
TAR_PATH="${WORK_DIR}/vault.tar"

trap 'rm -rf "${WORK_DIR}"' EXIT

echo "Decrypting vault…"

case "${ENC_TOOL}" in
  openssl)
    if [[ -n "${ENV_VAULT_PASS:-}" ]]; then
      openssl enc -d -aes-256-cbc -pbkdf2 -pass env:ENV_VAULT_PASS \
          -in "${VAULT_FILE}" -out "${TAR_PATH}"
    else
      openssl enc -d -aes-256-cbc -pbkdf2 \
          -in "${VAULT_FILE}" -out "${TAR_PATH}"
    fi
    ;;
  age)
    age -d -o "${TAR_PATH}" "${VAULT_FILE}"
    ;;
  gpg)
    if [[ -n "${ENV_VAULT_PASS:-}" ]]; then
      printf '%s' "${ENV_VAULT_PASS}" | gpg --batch --yes --decrypt \
          --passphrase-fd 0 --pinentry-mode loopback \
          --output "${TAR_PATH}" "${VAULT_FILE}"
    else
      gpg --output "${TAR_PATH}" --decrypt "${VAULT_FILE}"
    fi
    ;;
esac

echo "Decryption complete."
echo ""

# ── extract into work dir ─────────────────────────────────────────────────────
EXTRACT_DIR="${WORK_DIR}/extracted"
mkdir -p "${EXTRACT_DIR}"
tar -xf "${TAR_PATH}" -C "${EXTRACT_DIR}"

# ── restore each .env.local ───────────────────────────────────────────────────
RESTORED=0
SKIPPED=0
BACKED_UP=0

while IFS= read -r -d '' ENV_FILE; do
  # ENV_FILE is relative to EXTRACT_DIR, e.g. ./project-name/.env.local
  REL_PATH="${ENV_FILE#${EXTRACT_DIR}/}"   # project-name/.env.local
  PROJECT_NAME="$(dirname "${REL_PATH}")"   # project-name
  DEST="${TARGET_ROOT}/${PROJECT_NAME}/.env.local"
  DEST_DIR="$(dirname "${DEST}")"

  if [[ -f "${DEST}" ]]; then
    if [[ "${FORCE}" == "true" ]]; then
      mkdir -p "${DEST_DIR}"
      cp "${ENV_FILE}" "${DEST}"
      echo "  RESTORED (overwrite): ${DEST}"
      (( RESTORED++ )) || true
    else
      TS="$(date -u +%Y%m%dT%H%M%SZ)"
      BAK="${DEST}.bak.${TS}"
      cp "${DEST}" "${BAK}"
      cp "${ENV_FILE}" "${DEST}"
      echo "  RESTORED (backed up old → $(basename "${BAK}")): ${DEST}"
      (( RESTORED++ )) || true
      (( BACKED_UP++ )) || true
    fi
  else
    # Target project dir may not exist yet on a fresh machine — create it
    mkdir -p "${DEST_DIR}"
    cp "${ENV_FILE}" "${DEST}"
    echo "  RESTORED (new):     ${DEST}"
    (( RESTORED++ )) || true
  fi
done < <(find "${EXTRACT_DIR}" -name ".env.local" -print0)

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Restore summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Restored: ${RESTORED}  |  Skipped: ${SKIPPED}  |  Old files backed up: ${BACKED_UP}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Secrets are now in place. Do not print or share .env.local files."
