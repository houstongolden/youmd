#!/usr/bin/env bash
# capture-agent-config.sh — snapshot NON-SECRET agent config into ~/.agent-shared/
#
# This captures the agent-behavior config that isn't already in a synced repo —
# Claude/Codex/Warp settings, slash commands, plugin list, the orphaned
# ~/.agents skills, and the launchd/cron automations — into the agent-shared
# repo so they travel across machines. The skillstack-sync daemon then commits +
# pushes agent-shared, and `youmd machine setup`/restore applies them on a new Mac.
#
# SECRETS NEVER GO HERE. agent-shared is a git repo. Live secrets (codex
# auth.json, cursor mcp.json, ~/.claude.json BAMF token, .env.local) travel via
# the ENCRYPTED env-vault instead. This script captures only files confirmed to
# be secret-free, and a final guard greps the staged output for secret patterns
# and ABORTS if any are found (nothing is left in agent-shared on abort).
#
# bash 3.2 / BSD safe. Idempotent. --dry-run to preview.

set -euo pipefail

AGENT_SHARED="${HOME}/.agent-shared"
DEST="${AGENT_SHARED}/agent-config"
LOG_DIR="${HOME}/.youmd/logs"
LOG_FILE="${LOG_DIR}/capture-agent-config.log"

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    *) echo "Unknown flag: $arg" >&2; exit 1 ;;
  esac
done

mkdir -p "${LOG_DIR}"
log() { local ts; ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"; echo "[${ts}] $*"; echo "[${ts}] $*" >> "${LOG_FILE}"; }
is_dry() { [ "${DRY_RUN}" -eq 1 ]; }

if [ ! -d "${AGENT_SHARED}/.git" ]; then
  log "ERROR: ${AGENT_SHARED} is not a git repo — run machine setup first."
  exit 1
fi

# copy_in <src> <dest-subpath>  — copy a file/dir into the staging dest if it exists
copy_in() {
  local src="$1" rel="$2" target
  target="${DEST}/${rel}"
  if [ ! -e "${src}" ]; then return 0; fi
  if is_dry; then log "DRY would capture ${src} → agent-config/${rel}"; return 0; fi
  mkdir -p "$(dirname "${target}")"
  if [ -d "${src}" ]; then
    rsync -a --delete "${src}/" "${target}/"
  else
    cp "${src}" "${target}"
  fi
  log "captured ${src} → agent-config/${rel}"
}

log "=== capture-agent-config START ($([ "${DRY_RUN}" -eq 1 ] && echo DRY || echo LIVE)) ==="

# ── Claude config (settings have no raw secrets; ~/.claude.json is EXCLUDED — vaulted) ──
copy_in "${HOME}/.claude/settings.json"               "claude/settings.json"
copy_in "${HOME}/.claude/settings.local.json"         "claude/settings.local.json"
copy_in "${HOME}/.claude/commands"                    "claude/commands"
copy_in "${HOME}/.claude/mcp.json"                    "claude/mcp.json"
copy_in "${HOME}/.claude/plugins/installed_plugins.json" "claude/plugins/installed_plugins.json"

# ── Codex config (config.toml only; auth.json is EXCLUDED — vaulted) ──
copy_in "${HOME}/.codex/config.toml"                  "codex/config.toml"

# ── Warp (no secrets) ──
copy_in "${HOME}/.warp/settings.toml"                 "warp/settings.toml"
copy_in "${HOME}/.warp/keybindings.yaml"              "warp/keybindings.yaml"

# ── Orphaned ~/.agents skills (no repo of their own today) ──
copy_in "${HOME}/.agents/skills/find-skills"          "agents-skills/find-skills"
copy_in "${HOME}/.agents/skills/ui-ux-pro-max"        "agents-skills/ui-ux-pro-max"

# ── Automations: launchd plists (HOME-templated) + crontab snapshot ──
capture_plist() {
  local label="$1" src="${HOME}/Library/LaunchAgents/$1.plist" target="${DEST}/automations/launchd/$1.plist"
  if [ ! -f "${src}" ]; then return 0; fi
  if is_dry; then log "DRY would capture plist ${label} (HOME-templated)"; return 0; fi
  mkdir -p "$(dirname "${target}")"
  sed "s|${HOME}|__HOME__|g" "${src}" > "${target}"
  log "captured plist ${label} → agent-config/automations/launchd/${label}.plist"
}
capture_plist "com.youmd.skillstack-sync"
capture_plist "com.youmd.identity-sync"
capture_plist "com.houstongolden.agent-runtime-guard"

if ! is_dry; then
  mkdir -p "${DEST}/automations"
  crontab -l 2>/dev/null > "${DEST}/automations/crontab.txt" || true
  log "captured crontab → agent-config/automations/crontab.txt"
fi

# ── SECRET-LEAK GUARD — abort if anything captured looks like a live secret ──
if ! is_dry && [ -d "${DEST}" ]; then
  # Match real secret token shapes; allow bare key NAMES (KEY=) which are fine.
  HITS="$(grep -rIlE 'sk-ant-[A-Za-z0-9_-]{20}|sk-[A-Za-z0-9]{32}|ghp_[A-Za-z0-9]{30}|gho_[A-Za-z0-9]{30}|Bearer [A-Za-z0-9._-]{20}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10}' "${DEST}" 2>/dev/null || true)"
  if [ -n "${HITS}" ]; then
    log "ABORT: possible secret(s) found in captured config — removing capture, nothing committed:"
    log "${HITS}"
    rm -rf "${DEST}"
    exit 1
  fi
  log "secret-leak guard: clean (no live secret patterns in captured config)"
fi

log "=== capture-agent-config DONE ==="
