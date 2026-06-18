#!/usr/bin/env bash
# env-vault/restore.sh — restores .env.local files AND agent-auth secrets from
# an encrypted vault created by backup.sh. NEVER prints, echoes, or logs any
# secret VALUES. Restore prints which file paths were restored or skipped; list
# mode prints target paths plus variable names/counts only.
#
# Usage: bash restore.sh [--list] [--force] [--map-existing] [--existing-only]
#        [--skip-agent-auth] [--root <target-root>] <vault-file>
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
MAP_EXISTING=false
EXISTING_ONLY=false
SKIP_AGENT_AUTH=false
VAULT_FILE=""

# ── parse args ─────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --list)            LIST_ONLY=true; shift ;;
    --force)           FORCE=true; shift ;;
    --map-existing)    MAP_EXISTING=true; shift ;;
    --existing-only)   EXISTING_ONLY=true; shift ;;
    --skip-agent-auth) SKIP_AGENT_AUTH=true; shift ;;
    --root)            TARGET_ROOT="$2"; shift 2 ;;
    -*)                echo "Unknown flag: $1" >&2; exit 1 ;;
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
  echo "Usage: bash restore.sh [--list] [--force] [--map-existing] [--existing-only] [--skip-agent-auth] [--root <path>] <vault-file>" >&2
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
echo "Project mapping: map-existing=${MAP_EXISTING} existing-only=${EXISTING_ONLY}"
echo "Agent auth:      $([[ "${SKIP_AGENT_AUTH}" == "true" ]] && echo "skip" || echo "restore")"
echo ""

normalize_project_name() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]//g'
}

map_project_name() {
  local archive_name="$1"
  local exact_dir="${TARGET_ROOT}/${archive_name}"
  if [[ "${MAP_EXISTING}" != "true" ]]; then
    printf '%s\n' "${archive_name}"
    return 0
  fi
  if [[ -d "${exact_dir}" ]]; then
    printf '%s\n' "${archive_name}"
    return 0
  fi

  local wanted
  wanted="$(normalize_project_name "${archive_name}")"
  local matches=()
  local candidate
  while IFS= read -r -d '' candidate; do
    local base
    base="$(basename "${candidate}")"
    if [[ "$(normalize_project_name "${base}")" == "${wanted}" ]]; then
      matches+=("${base}")
    fi
  done < <(find "${TARGET_ROOT}" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null || true)

  if [[ "${#matches[@]}" -eq 1 ]]; then
    printf '%s\n' "${matches[0]}"
    return 0
  fi
  if [[ "${#matches[@]}" -gt 1 ]]; then
    echo "WARN: multiple existing dirs match vault project '${archive_name}': ${matches[*]} — skipping" >&2
    return 1
  fi
  if [[ "${EXISTING_ONLY}" == "true" ]]; then
    echo "WARN: no existing dir for vault project '${archive_name}' under ${TARGET_ROOT} — skipping" >&2
    return 1
  fi
  printf '%s\n' "${archive_name}"
}

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
    ARCHIVE_PROJECT_NAME="$(dirname "${REL_PATH}")"
    if ! PROJECT_NAME="$(map_project_name "${ARCHIVE_PROJECT_NAME}")"; then
      echo "  env: ${ARCHIVE_PROJECT_NAME}/.env.local -> SKIPPED (no safe target)"
      (( ENV_COUNT++ )) || true
      continue
    fi
    DEST="${TARGET_ROOT}/${PROJECT_NAME}/.env.local"
    VAR_COUNT=$(grep -cE '^[A-Za-z_][A-Za-z0-9_]*=' "${ENV_FILE}" 2>/dev/null || true)
    VAR_NAMES=$(grep -oE '^[A-Za-z_][A-Za-z0-9_]*' "${ENV_FILE}" 2>/dev/null \
                | grep -v '^$' | sort | paste -sd ',' - || true)
    if [[ "${ARCHIVE_PROJECT_NAME}" == "${PROJECT_NAME}" ]]; then
      echo "  env: ${PROJECT_NAME}/.env.local -> ${DEST} (${VAR_COUNT} variable(s) [${VAR_NAMES}])"
    else
      echo "  env: ${ARCHIVE_PROJECT_NAME}/.env.local -> ${DEST} (${VAR_COUNT} variable(s) [${VAR_NAMES}])"
    fi
    (( ENV_COUNT++ )) || true
  done < <(find "${EXTRACT_DIR}" -name ".env.local" -print0)

  AGENT_AUTH_SRC="${EXTRACT_DIR}/agent-auth"
  echo "  agent-auth:"
  if [[ "${SKIP_AGENT_AUTH}" == "true" ]]; then
    echo "    skipped by --skip-agent-auth"
  else
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
  fi

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
  ARCHIVE_PROJECT_NAME="$(dirname "${REL_PATH}")"   # project-name
  if ! PROJECT_NAME="$(map_project_name "${ARCHIVE_PROJECT_NAME}")"; then
    echo "  SKIPPED (no existing mapped target): ${ARCHIVE_PROJECT_NAME}/.env.local"
    (( SKIPPED++ )) || true
    continue
  fi
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

if [[ "${SKIP_AGENT_AUTH}" == "true" ]]; then
  echo "Skipping agent-auth restore because --skip-agent-auth was provided."
  echo ""
elif [[ -d "${AGENT_AUTH_SRC}" ]]; then
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
