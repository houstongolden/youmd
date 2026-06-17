#!/usr/bin/env bash
# env-vault/restore.sh — restores .env.local files AND agent-auth secrets from
# an encrypted vault created by backup.sh. NEVER prints, echoes, or logs any
# secret VALUES. Restore prints which file paths were restored or skipped; list
# mode prints target paths plus variable names/counts only.
#
# Usage: bash restore.sh [--list] [--force] [--root <target-root>] <vault-file>
#   vault-file: path to env-vault-*.tar.age / .tar.gpg / .tar.enc
#   --force:    overwrite existing files without backing them up
#   --root:     destination root for .env.local files
#               (default: /Users/houstongolden/Desktop/CODE_2025)
#
# agent-auth restore map (archive name → absolute home path):
#   agent-auth/codex-auth.json  → ~/.codex/auth.json
#   agent-auth/cursor-mcp.json  → ~/.cursor/mcp.json
#   agent-auth/claude.json      → ~/.claude.json

set -euo pipefail

# ── agent-auth restore map ─────────────────────────────────────────────────────
# Maps archive name (inside agent-auth/) to its absolute home destination.
# Format: "archive-name:absolute-destination-path"
# Must stay in sync with AGENT_SECRET_FILES in backup.sh.
AGENT_AUTH_MAP=(
  "codex-auth.json:${HOME}/.codex/auth.json"
  "cursor-mcp.json:${HOME}/.cursor/mcp.json"
  "claude.json:${HOME}/.claude.json"
)

# ── defaults ──────────────────────────────────────────────────────────────────
TARGET_ROOT="${ENV_VAULT_RESTORE_ROOT:-/Users/houstongolden/Desktop/CODE_2025}"
FORCE=false
LIST_ONLY=false
VAULT_FILE=""

# ── parse args ─────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --list)   LIST_ONLY=true; shift ;;
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
  echo "Usage: bash restore.sh [--list] [--force] [--root <path>] <vault-file>" >&2
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

if [[ "${LIST_ONLY}" == "true" ]]; then
  ENV_COUNT=0
  AGENT_PRESENT=0
  AGENT_MISSING=0

  echo "Vault contents (secret-safe inventory):"
  while IFS= read -r -d '' ENV_FILE; do
    REL_PATH="${ENV_FILE#${EXTRACT_DIR}/}"
    PROJECT_NAME="$(dirname "${REL_PATH}")"
    DEST="${TARGET_ROOT}/${PROJECT_NAME}/.env.local"
    VAR_COUNT=$(grep -cE '^[A-Za-z_][A-Za-z0-9_]*=' "${ENV_FILE}" 2>/dev/null || true)
    VAR_NAMES=$(grep -oE '^[A-Za-z_][A-Za-z0-9_]*' "${ENV_FILE}" 2>/dev/null \
                | grep -v '^$' | sort | paste -sd ',' - || true)
    echo "  env: ${PROJECT_NAME}/.env.local -> ${DEST} (${VAR_COUNT} variable(s) [${VAR_NAMES}])"
    (( ENV_COUNT++ )) || true
  done < <(find "${EXTRACT_DIR}" -name ".env.local" -print0)

  AGENT_AUTH_SRC="${EXTRACT_DIR}/agent-auth"
  echo "  agent-auth:"
  for ENTRY in "${AGENT_AUTH_MAP[@]}"; do
    ARCHIVE_NAME="${ENTRY%%:*}"
    DEST_PATH="${ENTRY##*:}"
    SRC_FILE="${AGENT_AUTH_SRC}/${ARCHIVE_NAME}"
    if [[ -f "${SRC_FILE}" ]]; then
      FILE_BYTES=$(wc -c < "${SRC_FILE}" | tr -d ' ')
      echo "    present: agent-auth/${ARCHIVE_NAME} -> ${DEST_PATH} (${FILE_BYTES} bytes)"
      (( AGENT_PRESENT++ )) || true
    else
      echo "    missing: agent-auth/${ARCHIVE_NAME}"
      (( AGENT_MISSING++ )) || true
    fi
  done

  echo ""
  echo "List summary: ${ENV_COUNT} .env.local file(s), ${AGENT_PRESENT} agent-auth file(s) present, ${AGENT_MISSING} agent-auth file(s) missing."
  echo "No files were written and no secret values were printed."
  exit 0
fi

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

# ── restore agent-auth files ───────────────────────────────────────────────────
AGENT_RESTORED=0
AGENT_SKIPPED=0
AGENT_BACKED_UP=0

AGENT_AUTH_SRC="${EXTRACT_DIR}/agent-auth"

if [[ -d "${AGENT_AUTH_SRC}" ]]; then
  echo "Restoring agent-auth files…"
  for ENTRY in "${AGENT_AUTH_MAP[@]}"; do
    ARCHIVE_NAME="${ENTRY%%:*}"
    DEST_PATH="${ENTRY##*:}"
    SRC_FILE="${AGENT_AUTH_SRC}/${ARCHIVE_NAME}"

    if [[ ! -f "${SRC_FILE}" ]]; then
      echo "  SKIPPED (not in vault): agent-auth/${ARCHIVE_NAME}"
      (( AGENT_SKIPPED++ )) || true
      continue
    fi

    DEST_DIR="$(dirname "${DEST_PATH}")"
    mkdir -p "${DEST_DIR}"

    if [[ -f "${DEST_PATH}" ]]; then
      if [[ "${FORCE}" == "true" ]]; then
        cp "${SRC_FILE}" "${DEST_PATH}"
        echo "  RESTORED (overwrite): ${DEST_PATH}"
        (( AGENT_RESTORED++ )) || true
      else
        TS="$(date -u +%Y%m%dT%H%M%SZ)"
        BAK="${DEST_PATH}.bak.${TS}"
        cp "${DEST_PATH}" "${BAK}"
        cp "${SRC_FILE}" "${DEST_PATH}"
        echo "  RESTORED (backed up old → $(basename "${BAK}")): ${DEST_PATH}"
        (( AGENT_RESTORED++ )) || true
        (( AGENT_BACKED_UP++ )) || true
      fi
    else
      cp "${SRC_FILE}" "${DEST_PATH}"
      echo "  RESTORED (new): ${DEST_PATH}"
      (( AGENT_RESTORED++ )) || true
    fi
  done
  echo ""
else
  echo "No agent-auth/ directory in vault — skipping agent-auth restore."
  echo ""
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Restore summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  .env.local  — Restored: ${RESTORED}  |  Skipped: ${SKIPPED}  |  Old files backed up: ${BACKED_UP}"
echo "  agent-auth  — Restored: ${AGENT_RESTORED}  |  Skipped: ${AGENT_SKIPPED}  |  Old files backed up: ${AGENT_BACKED_UP}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Secrets are now in place. Do not print or share secret files."
