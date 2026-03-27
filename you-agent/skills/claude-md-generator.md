---
name: claude-md-generator
version: 1.0.0
scope: shared
identity_fields: [preferences.agent, directives.agent, voice.overall]
description: "Generate CLAUDE.md for the current project, pre-loaded with your identity context"
---

# claude-md-generator

Generate a CLAUDE.md for the current project, pre-loaded with your identity so every coding agent knows who you are and how you work.

## Identity Context (resolved at install time)

- **Agent preferences:** {{preferences.agent}}
- **Directives:** {{directives.agent}}
- **Voice:** {{voice.overall}}

## What This Skill Does

1. Detect project type (package.json, Cargo.toml, go.mod, pyproject.toml, etc.)
2. Read existing CLAUDE.md or project-context/ if present
3. Generate CLAUDE.md with:
   - Your identity summary (who you are, what you're building)
   - Your agent preferences (how coding agents should behave)
   - Your directives (rules agents must follow)
   - Your voice profile (so agents match your communication style)
   - Detected project stack and structure
4. Write file (merge with existing, don't overwrite)

## Output Template

```markdown
# {{project_name}} — Coding Agent Operating Manual

## Who You're Working With

{{profile.about}}

## Working Style

{{preferences.agent}}

## Directives

{{directives.agent}}

## Voice & Communication

{{voice.overall}}

## Project Stack

(auto-detected from project files)

## Project Structure

(auto-detected directory listing)
```

## When To Use

- Starting a new project
- Onboarding a new coding agent (Claude Code, Cursor, Codex)
- After significant identity updates via `youmd chat` or `youmd push`
- When `youmd skill sync` detects identity changes affecting this skill
