---
name: youstack-start
version: 1.0.0
scope: shared
identity_fields: [profile.about, preferences.agent, directives.agent, voice.overall]
description: Start a local Claude/Codex/Cursor session with the user's identity, project state, active requests, installed skills, and next move.
---

# youstack-start

Use this skill at the beginning of a local-agent session, or when the user says "continue", "what should we do next", "use you.md", "use youstack", or asks you to make an existing repo smarter for agents.

YouStack is the you.md operating layer for local agents: identity, project context, skills, scripts, prompts, sub-agents, memory, activity logs, and safe additive repo bootstrapping.

## Identity Context

- **About:** {{profile.about}}
- **Agent preferences:** {{preferences.agent}}
- **Directives:** {{directives.agent}}
- **Voice:** {{voice.overall}}

## First Calls

If the You.md MCP server is available, call these in order:

1. `whoami`
2. `get_agent_brief` with `format: "markdown"`
3. `list_skills`
4. `use_skill` with `name: "youstack-start"` if the skill has not already been loaded

If MCP is not available but the CLI is installed, use:

```bash
youmd whoami
youmd skill list
youmd skill use youstack-start
```

If neither is available, read the repo's normal instruction files first: `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`, `.you/`, and `project-context/`.

## Operating Loop

1. Read the entire user request and extract every actionable request.
2. Read local project instructions before designing or editing.
3. Check `project-context/feature-requests-active.md`, `project-context/CURRENT_STATE.md`, and `project-context/TODO.md` when present.
4. Pick the highest-value next move from real context, not a generic command list.
5. Act end-to-end: implement, verify, update trackers, and report what actually changed.
6. Prefer additive changes to generated agent layers (`.you/`, `.claude/skills/youmd/`, `.codex/skills/youmd/`) before rewriting mature human-owned docs.
7. When a repo already has canonical shared rules or skills elsewhere, add a pointer/managed block instead of duplicating the full text.

## Skill Routing

Use the available You.md skills as follows:

- `project-context-init` when a repo lacks a usable project-context spine.
- `claude-md-generator` when a host-specific agent entrypoint is missing or stale.
- `voice-sync` after voice or communication preferences change.
- `proactive-context-fill` when identity or project context is thin.
- `you-logs` when the user wants proof of which agents accessed context.
- `meta-improve` after repeated sessions to convert corrections into better identity or skill instructions.
- `youstack-maintainer` when a repo needs shared skills, scripts, prompts, sub-agents, source pointers, host adapters, or stack sync improved.

## Guardrails

- Do not ask the user to paste files you can read locally.
- Do not claim You.md pushed, published, linked, or wrote anything unless the tool or command actually succeeded.
- Do not overwrite existing `AGENTS.md`, `CLAUDE.md`, `.cursor/rules`, or project-context files wholesale. Merge or add a managed block.
- Do not copy repo-owned skills/prompts/scripts into a stack when a source pointer would keep the upstream repo canonical.
- Do not stop at "here is a plan" when the user asked you to continue improving the stack.
- Save durable learnings as memories or project notes when the host supports it.

## Done Means

- The current request is tracked.
- The relevant code, skill, MCP, API, or docs surface is actually updated.
- The change is tested with the smallest meaningful local verification.
- Project trackers reflect the state honestly.
- The final response names what changed and what still needs production/user verification.
