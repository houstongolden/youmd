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
step "5. Reminder: restore secrets"
# ---------------------------------------------------------------------------
echo ""
echo "  !! IMPORTANT: Secrets are NOT in git. Restore them separately:"
echo ""
echo "     If you use the env-vault (~/Desktop/CODE_2025/youmd/scripts/env-vault/):"
echo "       bash ~/Desktop/CODE_2025/youmd/scripts/env-vault/restore.sh"
echo ""
echo "     Secrets to restore (set in your shell profile or .env files):"
echo "       OPENROUTER_API_KEY"
echo "       CONVEX_DEPLOY_KEY"
echo "       YOUMD_API_KEY"
echo "       GH_TOKEN (or: gh auth login)"
echo "       ANTHROPIC_API_KEY"
echo ""

# ---------------------------------------------------------------------------
step "6. Next steps"
# ---------------------------------------------------------------------------
echo ""
echo "  Bootstrap complete. To activate the auto-sync daemons, run:"
echo ""
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "    bash ${SCRIPT_DIR}/install-daemons.sh"
echo ""
echo "  To do a manual sync now:"
echo "    bash ${SCRIPT_DIR}/sync.sh"
echo ""
echo "  To do a dry-run first (recommended):"
echo "    bash ${SCRIPT_DIR}/sync.sh --dry-run"
echo ""
echo "================================================================"
echo "Bootstrap done. Welcome to the new machine."
echo "================================================================"
