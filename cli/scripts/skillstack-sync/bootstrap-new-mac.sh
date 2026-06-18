#!/usr/bin/env bash
# bootstrap-new-mac.sh — set up a new Mac with Houston's agent skill/stack layer
#
# Safe to re-run (idempotent). Prints all steps before executing them.
# Does NOT run launchctl, does NOT push git, does NOT install anything
# beyond youmd CLI and git clones.
#
# After this script: run install-daemons.sh to activate the sync daemons.
#
# Usage: bash bootstrap-new-mac.sh

set -euo pipefail
export PATH="${HOME}/.youmd/bin:${HOME}/.youmd/npm-global/bin:/opt/homebrew/opt/node@22/bin:/usr/local/opt/node@22/bin:/opt/homebrew/bin:/usr/local/bin:${PATH}"

AGENT_SHARED="${HOME}/.agent-shared"
SCISTACK="${HOME}/.claude/scistack"
CLAUDE_SKILLS="${HOME}/.claude/skills"

LOOSE_SKILLS="agent-runtime-guard agent-stack-sync continue skill-governor"

AGENT_SHARED_REPO="https://github.com/houstongolden/agent-shared.git"
SCISTACK_REPO="https://github.com/Hubify-Projects/scistack.git"

step() {
  echo ""
  echo "===> $*"
}

info() {
  echo "     $*"
}

warn() {
  echo "     WARN: $*"
}

ensure_github_auth() {
  if ! command -v gh >/dev/null 2>&1; then
    warn "GitHub CLI is missing. Install it with Homebrew first: brew install gh"
    return 1
  fi

  if gh auth status >/dev/null 2>&1; then
    info "GitHub auth ready."
    return 0
  fi

  warn "GitHub auth is required before private skill/stack repos can clone."
  if [ -t 0 ]; then
    gh auth login -h github.com -p https -s repo || true
  fi

  if gh auth status >/dev/null 2>&1; then
    info "GitHub auth ready."
    return 0
  fi

  warn "GitHub auth still is not complete."
  warn "Open a normal Terminal and run:"
  warn "  $(command -v gh || echo gh) auth login -h github.com -p https -s repo"
  warn "Then rerun: youmd machine setup"
  return 1
}

# ---------------------------------------------------------------------------
step "1. Install youmd CLI"
# ---------------------------------------------------------------------------
if command -v youmd >/dev/null 2>&1; then
  info "youmd already installed: $(youmd --version 2>/dev/null || echo '(version unknown)')"
else
  info "Installing youmd via official install script..."
  curl -fsSL https://you.md/install.sh | bash
  info "youmd installed."
fi

# ---------------------------------------------------------------------------
step "2. Clone agent-shared repo → ${AGENT_SHARED}"
# ---------------------------------------------------------------------------
ensure_github_auth

if [ -d "${AGENT_SHARED}/.git" ]; then
  info "Already present: ${AGENT_SHARED} — skipping clone."
else
  info "Cloning ${AGENT_SHARED_REPO} → ${AGENT_SHARED}"
  mkdir -p "$(dirname "${AGENT_SHARED}")"
  # Use gh if available for credential handling; fall back to git
  if command -v gh >/dev/null 2>&1; then
    gh repo clone houstongolden/agent-shared "${AGENT_SHARED}"
  else
    git clone "${AGENT_SHARED_REPO}" "${AGENT_SHARED}"
  fi
  info "Cloned agent-shared."
fi

# ---------------------------------------------------------------------------
step "3. Clone scistack repo → ${SCISTACK}"
# ---------------------------------------------------------------------------
if [ -d "${SCISTACK}/.git" ]; then
  info "Already present: ${SCISTACK} — skipping clone."
else
  info "Cloning ${SCISTACK_REPO} → ${SCISTACK}"
  mkdir -p "$(dirname "${SCISTACK}")"
  if command -v gh >/dev/null 2>&1; then
    gh repo clone Hubify-Projects/scistack "${SCISTACK}"
  else
    git clone "${SCISTACK_REPO}" "${SCISTACK}"
  fi
  info "Cloned scistack."
fi

# ---------------------------------------------------------------------------
step "4. Restore loose skills from agent-shared/claude-skills/ → ~/.claude/skills/"
# ---------------------------------------------------------------------------
mkdir -p "${CLAUDE_SKILLS}"

for skill in ${LOOSE_SKILLS}; do
  src="${AGENT_SHARED}/claude-skills/${skill}"
  dst="${CLAUDE_SKILLS}/${skill}"

  if [ ! -d "${src}" ]; then
    warn "Loose skill '${skill}' not found in agent-shared yet — will be populated on first sync."
    continue
  fi

  if [ -d "${dst}" ]; then
    info "Skill '${skill}' already exists at ${dst} — skipping (run sync.sh to update)."
  else
    info "Restoring skill '${skill}' → ${dst}"
    rsync -a "${src}/" "${dst}/"
    info "Restored ${skill}."
  fi
done

# ---------------------------------------------------------------------------
step "5. Restore agent config from agent-shared"
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESTORE_SCRIPT="${SCRIPT_DIR}/restore-agent-config.sh"

if [ -f "${RESTORE_SCRIPT}" ]; then
  info "Running restore-agent-config.sh (backs up existing files, safe to re-run)..."
  bash "${RESTORE_SCRIPT}"
  info "Agent config restored."
else
  warn "restore-agent-config.sh not found at ${RESTORE_SCRIPT} — skipping agent config restore."
  warn "You can run it manually later once youmd is fully installed:"
  warn "  bash ${RESTORE_SCRIPT}"
fi

# ---------------------------------------------------------------------------
step "6. Reminder: restore secrets"
# ---------------------------------------------------------------------------
echo ""
echo "  !! IMPORTANT: Secrets are NOT in git. Restore them separately:"
echo ""
echo "     If you use the env-vault:"
echo "       youmd env restore <vault-file>   # CLI wrapper (preferred)"
echo ""
echo "     Secrets to restore (set in your shell profile or .env files):"
echo "       OPENROUTER_API_KEY"
echo "       CONVEX_DEPLOY_KEY"
echo "       YOUMD_API_KEY"
echo "       GH_TOKEN (or: gh auth login)"
echo "       ANTHROPIC_API_KEY"
echo ""

# ---------------------------------------------------------------------------
step "7. Next steps"
# ---------------------------------------------------------------------------
echo ""
echo "  Bootstrap complete. To activate the auto-sync daemons, run:"
echo ""
echo "    youmd stack daemon install        # preferred (CLI-native)"
echo ""
echo "  Or run the raw script directly:"
echo "    bash ${SCRIPT_DIR}/install-daemons.sh"
echo ""
echo "  To do a manual sync now:"
echo "    youmd stack sync                  # preferred (CLI-native)"
echo ""
echo "  To do a dry-run first (recommended):"
echo "    youmd stack sync --dry-run"
echo ""
echo "================================================================"
echo "Bootstrap done. Welcome to the new machine."
echo "================================================================"
