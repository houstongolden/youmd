#!/usr/bin/env bash
# sync.sh — cross-machine agent skill/stack syncer
# Compatible: bash 3.2+, macOS BSD coreutils (NO mapfile, NO GNU mktemp flags)
#
# Usage:
#   ./sync.sh              # sync all repos + loose skills
#   ./sync.sh --dry-run    # log intended actions only, write nothing
#
# Env overrides:
#   SKILLSTACK_REPOS   space-separated list of absolute repo paths (default: ~/.agent-shared ~/.claude/scistack)
#   GIT_USER_NAME      commit author name  (default: Houston Golden)
#   GIT_USER_EMAIL     commit author email (default: houston@bamf.ai)

set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="${HOME}/.youmd/logs"
LOG_FILE="${LOG_DIR}/skillstack-sync.log"

GIT_USER_NAME="${GIT_USER_NAME:-Houston Golden}"
GIT_USER_EMAIL="${GIT_USER_EMAIL:-houston@bamf.ai}"

AGENT_SHARED="${HOME}/.agent-shared"
SCISTACK="${HOME}/.claude/scistack"

# 4 loose skills that live in ~/.claude/skills/ but aren't in any repo
LOOSE_SKILLS="agent-runtime-guard agent-stack-sync continue skill-governor"

# Repos to sync (space-separated absolute paths; override via env).
# Houston's agent skill/stack layer syncs by DEFAULT:
#   - ~/.agent-shared  → shared agent config + loose skills (houstongolden/agent-shared)
#   - ~/.claude/scistack → ALL science skills (Hubify-Projects/scistack): 68 skill
#     symlink targets under hubstack/ + astrostack/ + extensions/, incl. the
#     learning-loop IP. Conflict-safe (commit→merge-pull→push, abort on conflict),
#     so auto-syncing his own repo is exactly the cross-machine behavior intended.
# gstack is NOT here (upstream garrytan/gstack, reinstalled via gstack-upgrade).
# Add more repos by setting SKILLSTACK_REPOS to a space-separated path list.
DEFAULT_REPOS="${AGENT_SHARED} ${SCISTACK}"
SKILLSTACK_REPOS="${SKILLSTACK_REPOS:-${DEFAULT_REPOS}}"

DRY_RUN=0

# ---------------------------------------------------------------------------
# Parse flags
# ---------------------------------------------------------------------------
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --once)    : ;;   # default — accepted for explicit invocation
    *) echo "Unknown flag: $arg" >&2; exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
mkdir -p "${LOG_DIR}"

log() {
  local ts
  ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  local msg="[${ts}] $*"
  echo "${msg}"
  echo "${msg}" >> "${LOG_FILE}"
}

log_warn() {
  log "WARN  $*"
}

log_error() {
  log "ERROR $*"
}

log_dry() {
  log "DRY   $*"
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

hostname_short() {
  # BSD hostname (no --short flag)
  hostname | cut -d. -f1
}

is_dry() {
  [ "${DRY_RUN}" -eq 1 ]
}

# Check if repo is in a mid-merge/rebase state
repo_is_in_progress() {
  local repo="$1"
  if [ -f "${repo}/.git/MERGE_HEAD" ] \
     || [ -d "${repo}/.git/rebase-merge" ] \
     || [ -d "${repo}/.git/rebase-apply" ]; then
    return 0
  fi
  return 1
}

# Diff two directories; returns 0 if they differ, 1 if identical
dirs_differ() {
  local src="$1" dst="$2"
  if diff -rq "${src}" "${dst}" >/dev/null 2>&1; then
    return 1   # identical
  fi
  return 0     # different
}

# ---------------------------------------------------------------------------
# LOOSE SKILL MIRROR (local → agent-shared repo)
# ---------------------------------------------------------------------------
mirror_loose_skills_to_repo() {
  local skill name src dst
  log "--- Loose-skill mirror: ~/.claude/skills/ → ${AGENT_SHARED}/claude-skills/ ---"

  for skill in ${LOOSE_SKILLS}; do
    src="${HOME}/.claude/skills/${skill}"
    dst="${AGENT_SHARED}/claude-skills/${skill}"

    if [ ! -d "${src}" ]; then
      log_warn "Loose skill '${skill}' not found at ${src}, skipping."
      continue
    fi

    if is_dry; then
      log_dry "Would rsync ${src}/ → ${dst}/"
    else
      mkdir -p "${dst}"
      rsync -a "${src}/" "${dst}/"
      log "Mirrored ${skill} → ${AGENT_SHARED}/claude-skills/${skill}"
    fi
  done
}

# ---------------------------------------------------------------------------
# REVERSE LOOSE SKILL MIRROR (agent-shared repo → local ~/.claude/skills/)
# Called AFTER agent-shared is synced, so we pick up remote edits.
# ---------------------------------------------------------------------------
mirror_loose_skills_from_repo() {
  local skill src dst bak ts
  log "--- Reverse loose-skill mirror: ${AGENT_SHARED}/claude-skills/ → ~/.claude/skills/ ---"

  for skill in ${LOOSE_SKILLS}; do
    src="${AGENT_SHARED}/claude-skills/${skill}"
    dst="${HOME}/.claude/skills/${skill}"

    if [ ! -d "${src}" ]; then
      log_warn "Repo copy of loose skill '${skill}' not found at ${src}, skipping reverse mirror."
      continue
    fi

    # Detect if there are actually changes to apply
    if [ -d "${dst}" ] && ! dirs_differ "${src}" "${dst}"; then
      log "Loose skill '${skill}': no changes, skipping reverse mirror."
      continue
    fi

    if is_dry; then
      log_dry "Would backup ${dst} → ${dst}.bak.<timestamp> and rsync ${src}/ → ${dst}/"
      continue
    fi

    # Backup existing local copy before overwriting
    if [ -d "${dst}" ]; then
      ts="$(date -u +"%Y-%m-%dT%H-%M-%SZ")"
      bak="${dst}.bak.${ts}"
      log "Backing up ${dst} → ${bak}"
      rsync -a "${dst}/" "${bak}/"
    fi

    mkdir -p "${dst}"
    rsync -a "${src}/" "${dst}/"
    log "Reverse-mirrored ${skill} → ${dst}"
  done
}

# ---------------------------------------------------------------------------
# SYNC ONE REPO
# Returns 0 on success, 1 on non-fatal failure.
# ---------------------------------------------------------------------------
sync_repo() {
  local repo="$1"
  local repo_name
  repo_name="$(basename "${repo}")"

  log "=== Syncing repo: ${repo} ==="

  # Guard: must be a git repo
  if [ ! -d "${repo}/.git" ]; then
    log_warn "Skipping ${repo}: not a git repository."
    return 1
  fi

  # Guard: must not be mid-merge/rebase
  if repo_is_in_progress "${repo}"; then
    log_warn "Skipping ${repo}: repository is mid-merge or mid-rebase. Resolve manually first."
    return 1
  fi

  # Stage and commit local changes if any
  local status_out
  status_out="$(git -C "${repo}" status --porcelain 2>&1)"
  if [ -n "${status_out}" ]; then
    local ts host commit_msg
    ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    host="$(hostname_short)"
    commit_msg="auto-sync: ${host} ${ts}"

    if is_dry; then
      log_dry "Would commit in ${repo}: '${commit_msg}'"
      log_dry "Changed files:\n${status_out}"
    else
      git -C "${repo}" add -A
      git -C "${repo}" \
        -c "user.name=${GIT_USER_NAME}" \
        -c "user.email=${GIT_USER_EMAIL}" \
        commit -m "${commit_msg}"
      log "Committed local changes in ${repo_name}: '${commit_msg}'"
    fi
  else
    log "No local changes in ${repo_name}."
  fi

  # Pull (merge, no rebase)
  if is_dry; then
    log_dry "Would git pull --no-rebase --no-edit in ${repo}"
  else
    local pull_log
    pull_log="$(mktemp -t skillstack_pull)"
    local pull_ok=0
    git -C "${repo}" pull --no-rebase --no-edit >"${pull_log}" 2>&1 || pull_ok=$?
    # Echo pull output line by line into the log
    while IFS= read -r line; do
      log "pull|${repo_name}: ${line}"
    done < "${pull_log}"
    rm -f "${pull_log}"

    if [ "${pull_ok}" -ne 0 ]; then
      log_error "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
      log_error "CONFLICT in ${repo_name} — pull failed."
      log_error "Aborting merge/rebase and skipping push."
      log_error "Manual resolution needed: cd ${repo} && git status"
      log_error "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
      # Abort any in-progress merge or rebase, leave working tree clean
      git -C "${repo}" merge --abort 2>/dev/null || true
      git -C "${repo}" rebase --abort 2>/dev/null || true
      return 1
    fi
    log "Pull succeeded for ${repo_name}."
  fi

  # Push
  if is_dry; then
    log_dry "Would git push in ${repo}"
  else
    local push_log
    push_log="$(mktemp -t skillstack_push)"
    local push_ok=0
    git -C "${repo}" push >"${push_log}" 2>&1 || push_ok=$?
    while IFS= read -r line; do
      log "push|${repo_name}: ${line}"
    done < "${push_log}"
    rm -f "${push_log}"

    if [ "${push_ok}" -ne 0 ]; then
      log_error "Push FAILED for ${repo_name}. Check connectivity/auth."
      return 1
    fi
    log "Push succeeded for ${repo_name}."
  fi

  log "=== Done: ${repo_name} ==="
  return 0
}

# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------
main() {
  local mode
  if is_dry; then
    mode="DRY-RUN"
  else
    mode="LIVE"
  fi

  log "============================================================"
  log "skillstack-sync START [${mode}] on $(hostname_short)"
  log "============================================================"

  # Step 0: Capture non-secret agent config (claude/codex/warp settings, slash
  # commands, plugin list, orphan skills, automations) into agent-shared so it
  # travels with the sync. Secret-leak-guarded; never blocks the sync on failure.
  if [ -x "${SCRIPT_DIR}/capture-agent-config.sh" ]; then
    if is_dry; then
      bash "${SCRIPT_DIR}/capture-agent-config.sh" --dry-run || log_warn "capture-agent-config dry-run failed (non-fatal)"
    else
      bash "${SCRIPT_DIR}/capture-agent-config.sh" || log_warn "capture-agent-config failed (non-fatal — continuing sync)"
    fi
  fi

  # Step 1: Mirror loose skills into agent-shared BEFORE syncing it
  mirror_loose_skills_to_repo

  # Step 2: Sync each repo
  local agent_shared_synced=0
  for repo in ${SKILLSTACK_REPOS}; do
    if sync_repo "${repo}"; then
      if [ "${repo}" = "${AGENT_SHARED}" ]; then
        agent_shared_synced=1
      fi
    fi
  done

  # Step 3: Reverse-mirror loose skills from agent-shared back to ~/.claude/skills/
  # Only do this if agent-shared was successfully synced (or in dry-run mode)
  if is_dry || [ "${agent_shared_synced}" -eq 1 ]; then
    mirror_loose_skills_from_repo
  else
    log_warn "Skipping reverse loose-skill mirror because agent-shared sync did not complete cleanly."
  fi

  log "============================================================"
  log "skillstack-sync DONE [${mode}]"
  log "============================================================"
}

main "$@"
