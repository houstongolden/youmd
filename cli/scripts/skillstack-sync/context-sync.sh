#!/usr/bin/env bash
# context-sync.sh — per-project agent context syncer (cross-machine, code-safe)
# Compatible: bash 3.2+, macOS BSD coreutils (NO mapfile, NO GNU mktemp flags)
#
# WHAT IT DOES
# ============
# For each of Houston's own git repos, commits ONLY the agent-context paths
# (AGENTS.md, CLAUDE.md, project-context/, .claude/) and pull+pushes, so
# agent context travels across machines without ever touching application code.
#
# SAFETY GUARANTEES
# =================
# 1. Only stages named context paths — NEVER uses `git add -A` or `git add .`
# 2. Never stashes, resets, checks out, or cleans anything in the working tree
# 3. Never touches a repo that is mid-merge or mid-rebase
# 4. Never touches a repo with no `origin` remote
# 5. If the working tree has uncommitted non-context changes, commits context
#    locally but SKIPS pull/push to avoid merge conflicts touching his code;
#    logs a clear "push manually" warning
# 6. On pull conflict: aborts merge, skips push, logs loudly — never force
# 7. Per-repo failures are non-fatal; the loop always continues
# 8. --dry-run logs intended actions; writes nothing to disk
#
# WHAT IS EXCLUDED (by design)
# =============================
# - Third-party / fork repos (disler/*, coffeefuelbump/*, etc.) — Houston
#   doesn't own the remote, so auto-pushing context there is wrong
# - Repos with no origin remote or push-disabled remotes — detected at runtime
# - gstack, agent-shared, scistack — covered by sync.sh (skillstack layer)
#
# Usage:
#   ./context-sync.sh              # sync all context repos
#   ./context-sync.sh --dry-run    # log intended actions only, write nothing
#
# Env overrides:
#   CONTEXT_REPOS   space-separated list of repo DIRECTORY NAMES under
#                   ~/Desktop/CODE_2025/ (not full paths)
#   GIT_USER_NAME   commit author name  (default: Houston Golden)
#   GIT_USER_EMAIL  commit author email (default: houston@bamf.ai)

set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="${YOU_HOME:-${YOUMD_HOME:-${HOME}/.you}}/logs"
LOG_FILE="${LOG_DIR}/context-sync.log"

GIT_USER_NAME="${GIT_USER_NAME:-Houston Golden}"
GIT_USER_EMAIL="${GIT_USER_EMAIL:-houston@bamf.ai}"

CODE_ROOT="${HOME}/Desktop/CODE_2025"

# Curated list of Houston's OWN repos with rich agent context.
# These all have houstongolden/* or hubify-projects/* remotes — confirmed safe
# to push to. Override via env CONTEXT_REPOS (space-separated dir names).
#
# Excluded by design:
#   - disler/*, coffeefuelbump/*, etc.  → not Houston's remote
#   - repos with no origin              → detected and skipped at runtime
#   - gstack, agent-shared, scistack    → handled by sync.sh
DEFAULT_CONTEXT_REPOS="bamfaiapp bigbounce hubify-aios myo hubifycode badapp claws"
CONTEXT_REPOS="${CONTEXT_REPOS:-${DEFAULT_CONTEXT_REPOS}}"

# The ONLY paths we will ever stage. Nothing else is touched.
CONTEXT_PATHSPECS="AGENTS.md CLAUDE.md project-context .claude"

DRY_RUN=0

# ---------------------------------------------------------------------------
# Parse flags
# ---------------------------------------------------------------------------
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --once)    : ;;   # accepted for explicit invocation parity with sync.sh
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
  # BSD hostname (no --short flag on macOS)
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

# Collect context pathspecs that actually exist in this repo.
# Returns a space-separated list (possibly empty).
existing_context_paths() {
  local repo="$1"
  local found=""
  local p
  for p in ${CONTEXT_PATHSPECS}; do
    if [ -e "${repo}/${p}" ]; then
      if [ -z "${found}" ]; then
        found="${p}"
      else
        found="${found} ${p}"
      fi
    fi
  done
  echo "${found}"
}

path_is_context() {
  local changed="$1"
  local p
  for p in ${CONTEXT_PATHSPECS}; do
    if [ "${changed}" = "${p}" ]; then
      return 0
    fi
    case "${changed}" in
      "${p}/"*) return 0 ;;
    esac
  done
  return 1
}

remote_has_non_context_changes() {
  local repo="$1" repo_name="$2" upstream="$3"
  local changed non_context line
  changed="$(git -C "${repo}" diff --name-only "HEAD..${upstream}" 2>/dev/null || true)"
  if [ -z "${changed}" ]; then
    return 1
  fi

  non_context=""
  while IFS= read -r line; do
    [ -z "${line}" ] && continue
    if ! path_is_context "${line}"; then
      if [ -z "${non_context}" ]; then
        non_context="${line}"
      else
        non_context="${non_context}, ${line}"
      fi
    fi
  done <<EOF
${changed}
EOF

  if [ -n "${non_context}" ]; then
    log_warn "${repo_name}: upstream has non-context changes (${non_context}). Skipping pull/push so context-sync never merges application code."
    return 0
  fi
  return 1
}

# ---------------------------------------------------------------------------
# SYNC ONE REPO
# Returns 0 on success, 1 on non-fatal failure.
#
# Pull/push safety decision (dirty non-context working tree):
# ============================================================
# After committing context changes, the working tree may still have untracked
# or modified files (Houston's WIP code). A `git pull` that brings in remote
# changes could attempt to merge those dirty files, causing conflicts or
# accidentally modifying them. The SAFE choice:
#   - If the working tree has ANY remaining dirty files after the context
#     commit, SKIP pull/push and log a clear warning.
#   - The context commit is still made locally, so the changes are preserved
#     and Houston can push manually when he's ready.
#   - We never stash, reset, or touch his code.
# ---------------------------------------------------------------------------
sync_context_repo() {
  local repo_name="$1"
  local repo="${CODE_ROOT}/${repo_name}"

  log "=== Syncing context for: ${repo_name} ==="

  # Guard: directory must exist
  if [ ! -d "${repo}" ]; then
    log_warn "Skipping ${repo_name}: directory not found at ${repo}."
    return 1
  fi

  # Guard: must be a git repo
  if [ ! -d "${repo}/.git" ]; then
    log_warn "Skipping ${repo_name}: not a git repository."
    return 1
  fi

  # Guard: must not be mid-merge/rebase
  if repo_is_in_progress "${repo}"; then
    log_warn "Skipping ${repo_name}: repository is mid-merge or mid-rebase. Resolve manually first."
    return 1
  fi

  # Guard: must have an origin remote
  if ! git -C "${repo}" remote get-url origin >/dev/null 2>&1; then
    log_warn "Skipping ${repo_name}: no 'origin' remote configured."
    return 1
  fi

  # Determine which context paths exist in this repo
  local paths
  paths="$(existing_context_paths "${repo}")"

  if [ -z "${paths}" ]; then
    log "No context paths found in ${repo_name} (none of: ${CONTEXT_PATHSPECS}). Skipping."
    return 0
  fi

  log "Context paths present in ${repo_name}: ${paths}"

  # ---- Stage ONLY the context paths (never git add -A or git add .) --------
  if is_dry; then
    log_dry "Would stage in ${repo_name}: ${paths}"
  else
    # Build the git add command with only existing paths.
    # We pass each path as a separate argument — safe because they come from
    # our controlled CONTEXT_PATHSPECS list, not user input.
    local add_args=""
    local p
    for p in ${paths}; do
      add_args="${add_args} ${p}"
    done
    # shellcheck disable=SC2086
    git -C "${repo}" add -- ${add_args}
    log "Staged context paths in ${repo_name}: ${paths}"
  fi

  # ---- Commit if staged changes exist ---------------------------------------
  local context_committed=0
  if is_dry; then
    log_dry "Would check for staged changes and commit context in ${repo_name} if any"
    context_committed=1
  else
    if ! git -C "${repo}" diff --cached --quiet 2>/dev/null; then
      local ts host commit_msg
      ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
      host="$(hostname_short)"
      commit_msg="context-sync: ${host} ${ts}"

      git -C "${repo}" \
        -c "user.name=${GIT_USER_NAME}" \
        -c "user.email=${GIT_USER_EMAIL}" \
        commit -m "${commit_msg}"
      log "Committed context changes in ${repo_name}: '${commit_msg}'"
      context_committed=1
    else
      log "No staged context changes in ${repo_name} (already up to date)."
      context_committed=0
    fi
  fi

  # ---- Check for remaining dirty working tree (WIP code) -------------------
  # After committing context, if there are still dirty files, skip pull/push
  # to avoid merge conflicts or accidental code modification.
  if ! is_dry; then
    local remaining_dirty
    remaining_dirty="$(git -C "${repo}" status --porcelain 2>/dev/null)"
    if [ -n "${remaining_dirty}" ]; then
      log_warn "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
      log_warn "${repo_name} has uncommitted non-context changes (WIP code)."
      log_warn "Context was committed locally. Skipping pull/push to avoid"
      log_warn "touching your code. Push manually when your code is ready:"
      log_warn "  cd ${repo} && git pull --no-rebase && git push"
      log_warn "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
      return 0
    fi
  fi

  # ---- Pull (merge, no rebase) ---------------------------------------------
  if is_dry; then
    log_dry "Would fetch upstream and pull only if remote changes are limited to context paths in ${repo_name}"
  else
    local upstream
    upstream="$(git -C "${repo}" rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
    if [ -z "${upstream}" ]; then
      log_warn "Skipping pull/push for ${repo_name}: no upstream branch configured."
      return 0
    fi

    local fetch_log
    fetch_log="$(mktemp -t context_sync_fetch)"
    local fetch_ok=0
    git -C "${repo}" fetch --quiet >"${fetch_log}" 2>&1 || fetch_ok=$?
    if [ "${fetch_ok}" -ne 0 ]; then
      while IFS= read -r line; do
        log "fetch|${repo_name}: ${line}"
      done < "${fetch_log}"
      rm -f "${fetch_log}"
      log_error "Fetch FAILED for ${repo_name}. Skipping pull/push."
      return 1
    fi
    rm -f "${fetch_log}"

    if remote_has_non_context_changes "${repo}" "${repo_name}" "${upstream}"; then
      return 0
    fi

    local pull_log
    # BSD mktemp: no -p, use /tmp explicitly
    pull_log="$(mktemp -t context_sync_pull)"
    local pull_ok=0
    git -C "${repo}" pull --no-rebase --no-edit >"${pull_log}" 2>&1 || pull_ok=$?

    while IFS= read -r line; do
      log "pull|${repo_name}: ${line}"
    done < "${pull_log}"
    rm -f "${pull_log}"

    if [ "${pull_ok}" -ne 0 ]; then
      log_error "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
      log_error "CONFLICT in ${repo_name} — pull failed."
      log_error "Aborting merge and skipping push."
      log_error "Manual resolution needed: cd ${repo} && git status"
      log_error "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
      git -C "${repo}" merge --abort 2>/dev/null || true
      git -C "${repo}" rebase --abort 2>/dev/null || true
      return 1
    fi
    log "Pull succeeded for ${repo_name}."
  fi

  # ---- Push ----------------------------------------------------------------
  if is_dry; then
    log_dry "Would git push in ${repo_name}"
  else
    local push_log
    push_log="$(mktemp -t context_sync_push)"
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
  log "context-sync START [${mode}] on $(hostname_short)"
  log "Repos: ${CONTEXT_REPOS}"
  log "Context paths: ${CONTEXT_PATHSPECS}"
  log "============================================================"

  local repo_name
  for repo_name in ${CONTEXT_REPOS}; do
    sync_context_repo "${repo_name}" || true
  done

  log "============================================================"
  log "context-sync DONE [${mode}]"
  log "============================================================"
}

main "$@"
