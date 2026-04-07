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

## MCP Server Integration

The generated CLAUDE.md should include a section about the You.md MCP server, so the coding agent can use it for live identity context, memory storage, and project awareness:

```markdown
## MCP Tools (You.md)

This project has `youmd mcp` configured as an MCP server. Use these tools:

- `get_identity` — Load the user's identity context at the start of each session
- `add_memory` — Save important facts, decisions, and preferences learned during work
- `search_memories` — Check existing memories before asking questions the user may have answered before
- `get_project_context` — Load PRD, TODO, features, and decisions for the current project
- `add_project_memory` — Save project-specific decisions and architectural context
- `compile_bundle` / `push_bundle` — Recompile and publish after identity changes

To configure: add `youmd mcp --json` output to your MCP client config.
```

When generating the CLAUDE.md, check if the user has the MCP server configured (look for `youmd` in MCP configs) and include this section if so. If not configured, add a comment suggesting setup:

```markdown
<!-- Tip: Run `youmd mcp --json` to get MCP config for live identity context -->
```

## When To Use

- Starting a new project
- Onboarding a new coding agent (Claude Code, Cursor, Codex)
- After significant identity updates via `youmd chat` or `youmd push`
- When `youmd skill sync` detects identity changes affecting this skill
