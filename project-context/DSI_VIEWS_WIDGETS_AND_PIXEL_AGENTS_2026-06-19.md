# DSI Views, Widgets, and Pixel Agents

Date: 2026-06-19

Status: first local implementation slice shipped on 2026-06-19. Convex now has `dsiViews` and `dsiViewWidgets`, plus an idempotent default `home` View with six live widget contracts. Production Convex deploy remains pending after a silent deploy hang in the local session.

## North Star

You.md should become a Dynamic Software Interface for a person's agentic operating system: one realtime brain layer that can render different useful views of the same private data, agents, machines, projects, tasks, skills, sources, logs, and secrets without forcing the user through a fixed maze of tabs.

The product should feel like a living sync mesh, not a settings panel. The magic moments are:

- A new Mac receives the same skills, preferences, projects, and trusted vault access from one setup prompt.
- A shared skill updates on one machine and appears on another machine moments later.
- Agents across Codex, Claude Code, Pi, local shells, crons, web chat, and future SMS/Slack/Gmail surfaces leave one central activity stream.
- The user asks You Agent for a custom focus view and the interface materializes it as saved realtime widgets.
- Blockers, shipped work, project updates, tasks requiring Houston, and agent-only tasks are visible without digging through logs.

## Core Object Primitives

- **Brain**: identity, preferences, project context, private notes, prompt history, directives, and durable memory.
- **Activity**: canonical append-only live stream for sync, agents, skills, project updates, tasks, sources, crons, vault events, and shipped work.
- **Machine**: trusted device or environment running You.md CLI/daemon/MCP; has safe proof metadata and a stable pixel character identity.
- **Agent**: Codex, Claude Code, Pi, web You Agent, cron worker, or future app-specific agent; reads/writes through scoped trust.
- **Project**: portfolio graph node with repo, API/MCP docs, stack, priority, active state, shipped history, dependencies, and tasks.
- **Task**: project-scoped or personal; owner can be Houston, an agent, or a named workflow/loop.
- **Skill / YouStack**: reusable instructions, workflows, scripts, prompts, host adapters, tests, and sync status.
- **Secret Vault**: encrypted account/device-backed data, never raw in browser; widgets receive redacted metadata or local-only unlock states.
- **View**: saved DSI layout generated or edited by the You Agent; Home is just the default View.
- **Widget**: live data + renderer contract; can be native, generated, or user-installed.

## DSI View Model

Views should be stored as a Convex-backed realtime document plus a GitHub mirrored JSON/Markdown record for auditability.

Minimum view shape:

```json
{
  "id": "focus-week",
  "title": "Focus Week",
  "scope": {
    "projects": ["youmd", "bamfaiapp", "badapp"],
    "tasks": "active",
    "owners": ["houston", "agents"]
  },
  "layout": [
    { "widget": "you-agent-chat", "span": "tall", "mode": "chat-shell-toggle" },
    { "widget": "live-log", "filters": ["projects", "skills", "machines"] },
    { "widget": "task-board", "filters": { "owner": ["houston", "agent"], "status": ["open", "blocked"] } },
    { "widget": "project-shipping", "windows": ["today", "7d", "30d", "90d"] },
    { "widget": "attention-blockers", "severity": "needs-human" }
  ]
}
```

The You Agent should be able to create or edit this from natural language:

> make a widget tracking these three projects and their tasks only, keep my personal tasks on this view too, add an agent chat/shell full height, include a live activity feed, and show blockers where agents need my attention.

## Widget Contracts

Every widget needs:

- A realtime data query contract.
- A renderer contract.
- A security contract describing whether it can see public, private, local-only, or redacted data.
- A source map back to Projects, Tasks, Agents, Machines, Skills, or Brain records.
- An activity emitter so meaningful widget updates appear in the central log.

Default widget types:

- **Live Log**: terminal-like feed backed by `brainActivity`.
- **You Agent Chat / Shell**: chat-first, optional local shell toggle on trusted desktop.
- **Task Board**: global + project-scoped tasks with Houston vs agent ownership.
- **Machine Mesh**: trusted devices, daemon status, skill sync, vault readiness, agent bus.
- **Project Portfolio**: compact project list, priority/status, shipped windows, API/MCP links.
- **Skill Mesh**: shared skills, project stack dependencies, sync status, self-improvement history.
- **Vault Health**: encrypted snapshot metadata, trusted device envelopes, restore readiness.
- **Attention Queue**: blockers, stuck agents, human-required decisions, failed loops.

## Pixel Character System

You.md should add subtle retro pixel characters as identity anchors for Machines, Agents, and Shell sessions.

Rules:

- Characters are original You.md pixel art, visually related to the YOU logo, not copied vendor mascots.
- Characters are deterministic from `machineId`, `agentId`, or `sessionId`, so they stay familiar across sessions.
- Status is conveyed through tiny green/orange/red signal pixels, not large badges.
- Motion is quiet: blink, cursor pulse, sync tick. Always respect `prefers-reduced-motion`.
- Characters should reinforce technical state, not become decoration everywhere.

Initial placement:

- Machine sync mesh host chips.
- Agent bus / connected agents.
- Future live-log rows where a machine or agent emits an event.

## Data + Sync Architecture

Use Convex/realtime as the live layer, GitHub as the durable mirror and audit trail, and local daemons as materializers.

- Convex stores live objects: Views, Widgets, Activity, Machines, Agents, Tasks, Projects, Skills, and redacted Vault metadata.
- GitHub mirrors durable brain/project records and generated view specs where useful.
- Local daemons materialize skills, AGENTS.md/CLAUDE.md, MCP configs, project context, and encrypted vault data.
- Browser never receives raw `.env.local` values. It can show redacted names/counts, unlock states, checksum proofs, and local-only actions.

## Navigation Implication

Collapse the shell IA toward:

- **Home**: default DSI View with chat/shell, live log, tasks, attention, and shipped work.
- **Brain**: identity, memory, sources, preferences, private context.
- **Projects**: portfolio graph, project pages, stacks, API/MCP docs, tasks, shipped history.
- **Settings**: account, machines, vault, API keys, advanced diagnostics.

Advanced surfaces like stats, agents, machine readiness, API/MCP, vault, and activity should become widgets or focused detail pages rather than permanently visible peer tabs.

## Near-Term Build Plan

1. Make `brainActivity` the canonical stream and merge live log, activity, connected agents, and stats events into it.
2. Add first-class `views` and `widgets` Convex tables with strict security scopes.
3. Make Home a saved default View instead of a static tab.
4. Add a You Agent command to create a focus view from natural language.
5. Reuse the Live Log widget in `/desktop-demo` System Status and real `/shell`.
6. Extend pixel characters to connected agents and live log emitters.
7. Add task ownership: Houston vs agent vs workflow, project-scoped or personal.
