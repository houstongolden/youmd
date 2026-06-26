# Shared Agent Instructions

This file is the canonical instruction file for your shared agent stack.
It is symlinked into each agent host on every machine via `bin/sync-agent-shared.sh`.

Edit this file to give every AI agent (Claude Code, Codex, Cursor, etc.) the
same baseline context about how you work. Keep it lean — project-specific rules
belong in each project's own CLAUDE.md / AGENTS.md.

---

## Working style

- Be direct and concise. No fluff, no filler text.
- Act decisively — don't ask for permission on reversible work.
- When in doubt, act and report rather than ask and wait.

## Code style

- Prefer explicit over implicit.
- Match the style of the existing codebase in every file you edit.
- Never leave dead code, commented-out blocks, or TODOs unless specifically asked.

## Commits

- Commit finished, verified work without being asked.
- One logical change per commit. Bisect when multiple things changed.
- Use conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.

## Agent skills

Shared skills live in `claude-skills/` in this repo. Each skill has a `SKILL.md`
that agents discover automatically after `bin/sync-agent-shared.sh` runs.

To add a skill: create `claude-skills/<name>/SKILL.md` and commit it.
The next sync will symlink it into `~/.claude/skills/<name>/`.
