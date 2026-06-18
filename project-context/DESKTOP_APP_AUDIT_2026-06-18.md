# You.md Desktop App — Product Surface Audit

Date: 2026-06-18
Author: Coding agent (Claude), at Houston's request
Status: Audit + first restructure implemented in the `/desktop-demo` mockup

This audit answers: given everything we've built (web app, CLI/API, YouStacks,
shared skills, second brain, realtime cross-machine sync + agent bus), what is
the **minimum product surface area** the native desktop app needs to deliver the
full vision — and what do we intentionally leave out vs. the web app?

---

## 1. The vision in one sentence

You.md is your **portable, MECE personal context layer** — the single source of
truth for *who you are, what you know, what you're building, and what your agents
can do* — that every agent on every machine reads from and writes back to, so
nothing is duplicated and everything stays in sync. It is the **brain + skills +
profile layer, not the agent harness.**

## 2. The MECE decomposition (the spine)

Every feature maps into four mutually-exclusive, collectively-exhaustive buckets:

| Bucket | = | Contains |
|---|---|---|
| **CONTEXT** | who you are + what you know | identity, preferences, goals, memories, notes/second-brain, connection graph |
| **WORK** | what you're building | projects (a dozen+), tasks & follow-ups (human vs agent-owned), brain-dump inbox |
| **CAPABILITIES** | what your agents can do | skills (shared/DRY), stacks (skills grouped by project/domain), meta-skills (create/improve), connected apps + crawlers + protected API/MCP |
| **RUNTIME** | where work happens | YOU sub-agents, the machines they run on, realtime sync + agent bus (cross-machine collaboration) |

Two interaction **modes** sit on top of all four: **Chat** (the agent) and
**Terminal** (any CLI agent). **Graph** is the lens across CONTEXT+WORK+CAPABILITIES.

## 3. What exists today, mapped to the buckets

| Bucket | Web app panes | CLI / API | Data layer |
|---|---|---|---|
| CONTEXT | Profile, Portrait, Files, Vault, Memory, PrivateContext, Edit | `init/pull/push/sync`, `memories`, `private`, `export`, `diff` | identity bundle (markdown compile/decompile), memories |
| WORK | PortfolioGraph (projects/tasks/braindumps/strategy/patterns), GitHub | `project portfolio/task/braindump/portfolio-hydrate`, `machine projects` | portfolioProjects/Tasks, brainDumpCaptures |
| CAPABILITIES | Skills, Stacks, ApiEnv, Sources (crawlers) | `skill *`, `stack *`, `env vault`, `mcp` | shared skills via `.agent-shared`, bundled + meta-improve skills, YouStacks |
| RUNTIME | MachineReadiness (proofs/daemons/agent bus) | `machine *`, `sync --live --daemon`, `agent send/inbox/status` | machineProofReports, realtime sync sessions, agentBus |

## 4. Why the web app feels cluttered

The web shell exposes **~22 panes**. The clutter is not too many features — it's
that the web **mixes the control plane with the daily driver.** It puts machinery
touched monthly (API-key rotation, env audits, machine proofs, security logs, JSON
dumps, portrait format pickers, OG/SEO, public-profile config) at the same altitude
as things touched hourly (chat, tasks, projects, skills). Correct for an admin
console; wrong for a daily app.

## 5. Intentionally left OUT of desktop (stays in web/CLI)

The desktop app is the **daily driver**, not the control plane.

- **Account/auth internals** — API key issuance/rotation/reveal, JWKS, sessions. (curl install handles this.)
- **Raw machinery** — JSON pane, env-key audits, security/activity logs, machine proof reports, portrait format/detail pickers, OG/SEO, public-profile editing & share config.
- **Pipeline/ingestion controls** — source/crawler config; desktop just shows "connected."
- **Onboarding/install** — daemons + curl do it; desktop assumes you're set up.
- **Billing, analytics dashboards, verified badges.**
- **The full agentic harness** — running/stepping/debugging executions, PR-review queues. That's Conductor's job. Desktop shows agents/activity *at a glance* and lets you spawn/scope; it does not try to be the execution IDE. (Matches "brain layer, not harness.")

What desktop KEEPS (daily-driver core): Chat, Brain (identity+memories+notes),
Projects, Tasks, Skills+Stacks, Agents+Devices (realtime), Connections (at a
glance), Terminal, Graph, ⌘K.

## 6. The minimal desktop IA (implemented)

Left rail, sectioned; Graph as a lens; Chat + Terminal as modes; everything else
reachable via ⌘K:

```
Home
CONTEXT   Brain · Projects · Tasks · Graph
STACKS    Skills · Connections
RUNTIME   Agents · Terminal
```

## 7. Gaps closed in this pass

- **Skills/Stacks** was missing entirely → added a Skills view: stacks (grouped, with visibility), shared skills with DRY "shared Nx" indicators, and meta-skills.
- **Agents** didn't show machines/realtime → added a Devices section (machines syncing in realtime) and an agent-bus feed (cross-machine, cross-agent messages).
- **Projects** weren't first-class → added a Projects view: per-project context, its tasks, its stack, and repo/API/MCP links (the spine connecting WORK ↔ CAPABILITIES).
- **Brain** under-represented memory → folded memories + goals into the vault and relabeled Notes → Brain.

## 8. The governing principle

Because curl + daemons + API/MCP do the heavy lifting behind the scenes, the
desktop UI's only jobs are **awareness** ("what's the state of X?") and
**light-touch direction** ("point an agent at X"). No forms, no setup wizards, no
config sprawl. That *is* the minimal surface.

## 9. Open follow-ups (not yet built)

- Per-project chat scoping (chat already knows the active project's context).
- A real palette-driven "spawn sub-agent into project X" action (currently navigates).
- "Promote a memory/idea into a task" and "extract a skill from a pattern" quick actions (surfacing meta-skills in the flow).
- When the design is locked: wire this UI to live you.md data + a real PTY for the terminal in the Tauri build.
