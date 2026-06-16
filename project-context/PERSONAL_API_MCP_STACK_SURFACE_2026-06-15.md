# Personal API / MCP / Stack Surface

Date: 2026-06-15
Status: product architecture slice landed in shell UI; backend expansion queued

## Decision

Use three names:

- `ystack`: the built-in You.md base stack. It owns the runtime, install script,
  public docs, base API, MCP discovery, auth defaults, and safe platform
  conventions.
- `youstack`: the user's default private personal stack. It owns identity,
  memories, projects, sources, skills, tools, functions, objects, properties,
  chat sessions, and user-approved API/MCP extensions.
- `{name}stack`: any custom user or project stack, such as `bamfstack`,
  `researchstack`, `founderstack`, or `hubifystack`.

This keeps the platform layer and the user-owned layer distinct without making
users learn a CLI-first mental model.

## Product Goal

After a user installs You.md locally:

```bash
curl -fsSL https://you.md/install.sh | bash
youmd auth login
```

They should be able to ask an agent:

> propose the personal API endpoints, MCP tools, functions, and stack objects my
> youstack should expose so other agents can work with me better.

The agent should inspect local/project context, propose a manifest patch, run
doctor/smoke checks, and keep sensitive endpoints private or scoped by default.

## Security Model

Personal API/MCP surfaces should always resolve through one of these access
levels:

| Level | Who can read/call | Examples |
| --- | --- | --- |
| public | anyone | published profile, public YouStacks, public docs |
| auth | owner session | shell, private files, sources, chat sessions |
| token | API key with scopes | agent reads memories, writes project notes, calls custom functions |
| share | expiring scoped link | specific project/context bundle for another agent |

Default rule: private until explicitly shared. Public stacks must pass redaction,
manifest validation, and smoke checks before publication.

## Extension Surface

The user-owned `youstack` should eventually expose:

- endpoints: custom API routes under a personal namespace.
- functions: agent-callable routines with typed inputs, outputs, policies, and
  smoke tests.
- tools: MCP tools generated from stack capabilities and connected services.
- objects: typed identity, project, source, memory, preference, and stack
  entities.
- properties: small durable fields agents can read without scraping prose.
- skills: installable markdown/runtime behaviors owned by the stack.
- sources: websites, repos, RSS, webhooks, JSON, and manual notes.
- sessions: realtime chat/conversation history with summaries and search.

## Gateway Model

Convex should be the internal realtime gateway, not every external carrier.

You.md already has `chatSessions` and `chatMessages`. This slice adds a shell
sidebar for recent sessions and a session-specific owner-gated loader. The
next durable gateway layer should follow the pattern from:

- BadApp: Convex owns canonical threads/messages/unread/routing while Sendblue,
  Telegram, and in-app surfaces are adapters.
- Myo: inbound messages from web, desktop, Slack, Telegram, iMessage, MCP, or
  voice normalize into one queue and respect `queue` versus `steer` delivery.

For You.md, that means:

1. Web shell messages, external agent messages, MCP calls, crons, connector
   events, and future SMS/Slack/Telegram messages should normalize into Convex.
2. Convex owns canonical message/session state, unread/activity state, run
   events, and realtime subscriptions.
3. External providers send inward first, then a delivery action replies on one
   selected channel when policy allows.
4. Normal shell chat replies should not fan out to external channels unless the
   user asks or a scheduled policy says so.
5. Agent runs should eventually emit plan steps and evidence into Convex so the
   shell, sidebar, and MCP clients see the same live state.

## UI IA

Left sidebar order should favor value/frequency:

1. New Chat / Search
2. Projects
3. Personal API
4. Skillstacks
5. Connectors and automation
6. Identity surfaces
7. Saved chats in the lower sidebar area
8. Account/theme/signout in the footer popout

The Connectors page should be the gateway page, not only a GitHub page. GitHub
repo sync is one source graph input inside the larger personal API/MCP/stack
surface.

## Next Backend Slices

1. Add persisted user stack records for `youstack` and custom `{name}stack`
   metadata, including display name, slug, visibility, capabilities, and owner
   policy.
2. Add token scopes for personal API/MCP extensions: `sessions:read`,
   `sessions:write`, `stacks:read`, `stacks:write`, `tools:call`,
   `functions:call`, `sources:read`, `sources:write`.
3. Add manifest-backed custom endpoint/function/tool definitions with
   validation, generated docs, smoke checks, and redaction review.
4. Add Convex `agent_runs`, `agent_plan_steps`, and `queued_agent_messages` so
   sessions become a true realtime communication gateway.
5. Expose session search and replay through owner auth, scoped API tokens, and
   MCP resources with honest readiness states.
