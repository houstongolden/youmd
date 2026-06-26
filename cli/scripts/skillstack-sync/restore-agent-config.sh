#!/usr/bin/env bash
# restore-agent-config.sh — apply ~/.agent-shared/agent-config/ back onto this machine
#
# Mirror-image of capture-agent-config.sh. Takes each item in agent-config/
# and copies it to its canonical home location, backing up any existing
# file/dir to <dest>.bak.<UTC-ts> first (unless --force skips the backup).
#
# Restored mappings:
#   agent-config/claude/*                  → ~/.claude/
#   agent-config/codex/config.toml        → ~/.codex/config.toml
#   agent-config/warp/*                   → ~/.warp/
#   agent-config/agents-skills/*          → ~/.agents/skills/
#   agent-config/automations/launchd/*.plist → ~/Library/LaunchAgents/ (HOME templated back)
#   agent-config/automations/crontab.txt  → PRINTED ONLY (user must merge manually)
#
# bash 3.2 / BSD safe. Idempotent. --dry-run to preview without writing.
# --force to skip per-file backups (still idempotent, overwrites in place).
#
# SECRETS: there should be none in agent-config (the capture script guards
# against it), but this script never prints file contents — only paths.
#
# Usage: bash restore-agent-config.sh [--dry-run] [--force]

set -euo pipefail

AGENT_SHARED="${HOME}/.agent-shared"
SRC="${AGENT_SHARED}/agent-config"
LOG_DIR="${YOU_HOME:-${YOUMD_HOME:-${HOME}/.you}}/logs"
LOG_FILE="${LOG_DIR}/restore-agent-config.log"

DRY_RUN=0
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --force)   FORCE=1 ;;
    *) echo "Unknown flag: $arg" >&2; exit 1 ;;
  esac
done

mkdir -p "${LOG_DIR}"
log() { local ts; ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"; echo "[${ts}] $*"; echo "[${ts}] $*" >> "${LOG_FILE}"; }
is_dry()   { [ "${DRY_RUN}" -eq 1 ]; }
is_force() { [ "${FORCE}" -eq 1 ]; }

if [ ! -d "${AGENT_SHARED}/.git" ]; then
  # Fresh machine: agent-shared not cloned/provisioned yet. Nothing to restore
  # from yet — skip quietly instead of erroring (sync clones it this pass).
  log "agent-shared not present yet — skipping restore (will be cloned this sync)."
  exit 0
fi

if [ ! -d "${SRC}" ]; then
  log "ERROR: ${SRC} does not exist — nothing to restore. Run 'youmd machine capture' on the source machine first."
  exit 1
fi

log "=== restore-agent-config START ($([ "${DRY_RUN}" -eq 1 ] && echo DRY || echo LIVE) $([ "${FORCE}" -eq 1 ] && echo FORCE || echo SAFE)) ==="

# backup_dest <path>
#   If the dest exists and --force is not set, back it up.
backup_dest() {
  local dest="$1"
  if [ -e "${dest}" ] && ! is_force; then
    local ts; ts="$(date -u +"%Y%m%dT%H%M%SZ")"
    local bak="${dest}.bak.${ts}"
    if is_dry; then
      log "DRY would backup ${dest} → ${bak}"
    else
      mv "${dest}" "${bak}"
      log "backed up ${dest} → ${bak}"
    fi
  fi
}

# copy_out <src-relative-to-agent-config> <absolute-dest>
#   Copy a file or directory from agent-config onto this machine.
copy_out() {
  local rel="$1" dest="$2" src
  src="${SRC}/${rel}"
  if [ ! -e "${src}" ]; then return 0; fi

  if is_dry; then
    log "DRY would restore agent-config/${rel} → ${dest}"
    return 0
  fi

  mkdir -p "$(dirname "${dest}")"
  backup_dest "${dest}"
  if [ -d "${src}" ]; then
    rsync -a "${src}/" "${dest}/"
  else
    cp "${src}" "${dest}"
  fi
  log "restored agent-config/${rel} → ${dest}"
}

# ── Claude config ──────────────────────────────────────────────────────────────
copy_out "claude/settings.json"               "${HOME}/.claude/settings.json"
copy_out "claude/settings.local.json"         "${HOME}/.claude/settings.local.json"
copy_out "claude/commands"                    "${HOME}/.claude/commands"
copy_out "claude/mcp.json"                    "${HOME}/.claude/mcp.json"
copy_out "claude/plugins/installed_plugins.json" "${HOME}/.claude/plugins/installed_plugins.json"

# ── Codex config ───────────────────────────────────────────────────────────────
copy_out "codex/config.toml"                  "${HOME}/.codex/config.toml"

# ── Warp ───────────────────────────────────────────────────────────────────────
copy_out "warp/settings.toml"                 "${HOME}/.warp/settings.toml"
copy_out "warp/keybindings.yaml"              "${HOME}/.warp/keybindings.yaml"

# ── Orphaned ~/.agents skills ──────────────────────────────────────────────────
copy_out "agents-skills/find-skills"          "${HOME}/.agents/skills/find-skills"
copy_out "agents-skills/ui-ux-pro-max"        "${HOME}/.agents/skills/ui-ux-pro-max"

# ── Automations: launchd plists (HOME-templated → real HOME) ───────────────────
LAUNCH_AGENTS_DIR="${HOME}/Library/LaunchAgents"
LAUNCHD_SRC="${SRC}/automations/launchd"
if [ -d "${LAUNCHD_SRC}" ]; then
  # BSD-compatible glob: use find to enumerate plists
  while IFS= read -r plist_src; do
    name="$(basename "${plist_src}")"
    dest="${LAUNCH_AGENTS_DIR}/${name}"
    if is_dry; then
      log "DRY would restore plist ${name} → ${dest} (with __HOME__ → \$HOME)"
    else
      mkdir -p "${LAUNCH_AGENTS_DIR}"
      backup_dest "${dest}"
      # Replace __HOME__ placeholder with the real HOME value (BSD sed, no -i extension trick)
      sed "s|__HOME__|${HOME}|g" "${plist_src}" > "${dest}"
      log "restored plist ${name} → ${dest}"
    fi
    log "NOTE: to load this daemon run: launchctl load -w ${dest}"
    log "      (or run: youmd stack daemon install — covers the youmd ones)"
  done < <(find "${LAUNCHD_SRC}" -maxdepth 1 -name "*.plist" 2>/dev/null || true)
fi

# ── Crontab — PRINT ONLY, never overwrite automatically ────────────────────────
CRONTAB_SRC="${SRC}/automations/crontab.txt"
if [ -f "${CRONTAB_SRC}" ]; then
  log "crontab.txt found — NOT writing automatically (clobbering crontab is destructive)."
  log "Inspect and merge manually with:  crontab -e"
  echo ""
  echo "  ── captured crontab entries (merge manually with 'crontab -e') ──"
  # Print each line with a leading "  " indent so it's visually distinct.
  # Use a while-read loop (no cat) to stay shell-safe.
  while IFS= read -r line; do
    echo "  ${line}"
  done < "${CRONTAB_SRC}"
  echo "  ── end crontab ──"
  echo ""
fi

log "=== restore-agent-config DONE ==="
