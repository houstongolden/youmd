#!/usr/bin/env bash
# sync-agent-shared.sh — idempotent shared agent stack sync
# Bash 3.2+ compatible. Safe to run multiple times.
#
# What it does:
#   1. Symlinks <repo>/AGENTS.md into every known agent host instruction file.
#   2. Symlinks every <repo>/claude-skills/<name>/ (that has SKILL.md) into
#      ~/.claude/skills/<name>/ and mirrors into ~/.codex/skills/ and ~/.pi/agent/skills/.
#
# Usage: bash ~/.agent-shared/bin/sync-agent-shared.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOME_DIR="${HOME:-$(cd ~ && pwd)}"

# ── helpers ──────────────────────────────────────────────────────────────────

log() { printf '  %s\n' "$*"; }
ok()  { printf '  \033[32mOK\033[0m   %s\n' "$*"; }
skip(){ printf '  \033[2mSKIP\033[0m %s\n' "$*"; }
warn(){ printf '  \033[33mWARN\033[0m %s\n' "$*"; }

# safe_symlink <target> <link>
# Creates a symlink at <link> pointing to <target>.
# - If <link> already is a symlink to <target>: no-op.
# - If <link> is a real file/dir: backs up to <link>.bak, then symlinks.
# - Creates parent dirs as needed.
safe_symlink() {
  local target="$1"
  local link="$2"
  mkdir -p "$(dirname "$link")"

  # already the right symlink
  if [ -L "$link" ]; then
    local existing
    existing="$(readlink "$link" 2>/dev/null || true)"
    if [ "$existing" = "$target" ]; then
      skip "$link -> $target (already linked)"
      return 0
    fi
    # wrong target — remove and re-create
    rm -f "$link"
  elif [ -e "$link" ]; then
    # real file or dir — back up
    local bak="${link}.bak"
    mv "$link" "$bak"
    warn "backed up $link to $bak"
  fi

  ln -s "$target" "$link"
  ok "$link -> $target"
}

# ── 1. Symlink AGENTS.md into every agent host ──────────────────────────────

AGENTS_SRC="$REPO_ROOT/AGENTS.md"

if [ ! -f "$AGENTS_SRC" ]; then
  warn "AGENTS.md not found at $AGENTS_SRC — skipping host instruction links"
else
  log ""
  log "syncing agent instruction file..."

  safe_symlink "$AGENTS_SRC" "$HOME_DIR/.claude/CLAUDE.md"
  safe_symlink "$AGENTS_SRC" "$HOME_DIR/.codex/AGENTS.md"
  safe_symlink "$AGENTS_SRC" "$HOME_DIR/.cursorrules"
  safe_symlink "$AGENTS_SRC" "$HOME_DIR/.pi/agent/AGENTS.md"
fi

# ── 2. Symlink claude-skills into agent hosts ────────────────────────────────

SKILLS_SRC="$REPO_ROOT/claude-skills"

CLAUDE_SKILLS_DIR="$HOME_DIR/.claude/skills"
CODEX_SKILLS_DIR="$HOME_DIR/.codex/skills"
PI_SKILLS_DIR="$HOME_DIR/.pi/agent/skills"

mkdir -p "$CLAUDE_SKILLS_DIR" "$CODEX_SKILLS_DIR" "$PI_SKILLS_DIR"

skill_count=0

if [ -d "$SKILLS_SRC" ]; then
  log ""
  log "syncing skills from $SKILLS_SRC..."

  for skill_dir in "$SKILLS_SRC"/*/; do
    [ -d "$skill_dir" ] || continue
    skill_name="$(basename "$skill_dir")"

    # only link skills that have a SKILL.md
    if [ ! -f "$skill_dir/SKILL.md" ]; then
      skip "skill $skill_name — no SKILL.md, skipping"
      continue
    fi

    # remove trailing slash for clean symlink target
    skill_abs="${SKILLS_SRC}/${skill_name}"

    safe_symlink "$skill_abs" "$CLAUDE_SKILLS_DIR/$skill_name"
    safe_symlink "$skill_abs" "$CODEX_SKILLS_DIR/$skill_name"
    safe_symlink "$skill_abs" "$PI_SKILLS_DIR/$skill_name"

    skill_count=$((skill_count + 1))
  done
fi

log ""
log "sync complete — $skill_count skill(s) linked across agent hosts"
log ""
