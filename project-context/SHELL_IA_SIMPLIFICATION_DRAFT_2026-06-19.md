# Shell IA Simplification Draft - 2026-06-19

Status: draft decision record, not yet implemented.

Grounded in:
- `src/app/(app)/dashboard/dashboard-content.tsx`
- `src/hooks/agent-utils.ts`
- `src/hooks/useYouAgent.ts`
- `src/components/panes/*`
- `project-context/DESKTOP_APP_AUDIT_2026-06-18.md`

## Blunt Diagnosis

The shell is currently organized like an internal admin console, not a daily
identity cockpit.

The code exposes 7 primary groups in `PANE_GROUPS`:

1. `home`
2. `projects`
3. `stacks`
4. `apis`
5. `identity`
6. `stats`
7. `account`

Those groups expose 19 right-pane keys from `RightPane`:

`home`, `tasks`, `profile`, `portfolio`, `portrait`, `edit`, `files`, `share`,
`skills`, `stacks`, `history`, `settings`, `analytics`, `agents`, `vault`,
`help`, `github`, `apis`, `machine`.

That is too much first-level product surface. The user should not have to know
whether a thing belongs to `identity`, `projects`, `stacks`, `apis`, `stats`, or
`account` before they can use their own context. The current IA exposes the
implementation map. It does not express the user's job.

## Four-Area IA

The web shell should collapse to four primary areas:

1. `Home`
2. `Brain`
3. `Projects`
4. `Settings`

The persistent shell chat stays separate from these areas. Slash commands and
command/search keep power access. Top-level chrome should answer: where am I
going today?

## Area 1: Home

Purpose: the starting point and daily work queue.

Visible panes:
- `home` - default landing pane.
- `tasks` - daily task queue and project task triage.

Hidden behind command/search:
- `history` - useful, but not daily top-level navigation.
- `analytics` - vanity unless it directly changes what the user should do next.

Kill from top-level chrome:
- separate `stats` group.

Verdict: Home is for "what needs attention now", not for metrics.

## Area 2: Brain

Purpose: the portable identity/context object. This is the core You.md product.

Visible panes:
- `profile` - public identity preview.
- `edit` - files/json/sources editor, but the default subtab should be files.
- `share` - context links and agent handoff.

Collapsed inside Brain:
- `files` - should be the default edit surface, not its own repeated top-level
  pane under multiple groups.
- `portrait` - keep available, but collapse. It is brand polish, not primary
  workflow.
- `history` - if shown here, call it versions or change history and keep it
  below the edit/share path.

Hidden behind Advanced:
- raw `json`.
- raw `sources`/crawler details.
- low-level profile diagnostics.

Verdict: Brain is the product. It deserves one coherent surface, not scattered
profile/files/portrait/share/edit fragments.

## Area 3: Projects

Purpose: work context, portfolio graph, repo sync, and reusable stack/project
knowledge.

Visible panes:
- `portfolio` - project graph, tasks, braindumps, dependencies, patterns.
- `stacks` - only if framed as project capability packages, not a separate
  product museum.
- `skills` - keep, but make it subordinate to "how agents work on my projects".

Collapsed inside Projects:
- `github` - current GitHub/API/MCP pane should become a Connections section
  inside Projects or Settings, depending on whether it is project-scoped or
  account-scoped.
- `agents` - show a compact activity strip if it affects active project work.

Hidden behind command/search:
- dedicated `skills` and `stacks` routes remain useful for power users.
- `/skills/:skillName` and `/stacks/:stackSlug` remain deep links.

Verdict: Projects is where You.md becomes useful beyond a profile. It should not
compete with a standalone "stacks" top-level product unless stacks are the main
thing being used that day.

## Area 4: Settings

Purpose: control plane. Necessary, but not the product.

Visible panes:
- `settings` - account, API keys, billing/plan, auth, profile/account controls.
- `vault` - security-sensitive enough to expose inside Settings, not daily nav.
- `apis` - move here as "API & MCP" or "Developer".

Collapsed inside Settings:
- `machine` - local readiness and daemon proof. Useful, but monthly/debug
  surface.
- `github` - if account-level installation/auth state.
- `help` - footer/help menu, not a primary group.
- `analytics` - if retained, tuck under Settings or Home summary, not top-level.

Hidden behind Advanced:
- raw env intelligence.
- daemon proof reports.
- security/session event logs.
- revoked API key history.

Verdict: Settings is where control-plane machinery goes to stop poisoning the
daily surface.

## Current Pane Mapping

| Current pane | Proposed area | Surface verdict |
|---|---|---|
| `home` | Home | Keep visible |
| `tasks` | Home | Keep visible |
| `profile` | Brain | Keep visible |
| `edit` | Brain | Keep visible |
| `files` | Brain | Collapse into Edit |
| `share` | Brain | Keep visible |
| `portrait` | Brain | Collapse |
| `portfolio` | Projects | Keep visible |
| `skills` | Projects | Collapse under capabilities |
| `stacks` | Projects | Collapse under capabilities |
| `github` | Projects or Settings | Collapse; rename to Connections |
| `agents` | Projects or Home | Collapse to activity strip |
| `settings` | Settings | Keep visible |
| `vault` | Settings | Keep visible but not top-level |
| `apis` | Settings | Collapse under Developer/API & MCP |
| `machine` | Settings | Advanced |
| `history` | Brain or Home | Collapse |
| `analytics` | Home or Settings | Hide by default |
| `help` | Global footer/menu | Remove from pane nav |

## Primary Navigation Target

Replace the current desktop primary group strip:

`home | projects | stacks | apis | identity | stats | account`

with:

`home | brain | projects | settings`

Secondary tabs should appear only inside the active area.

Suggested secondary tabs:

- Home: `today`, `tasks`
- Brain: `profile`, `edit`, `share`
- Projects: `graph`, `capabilities`, `connections`
- Settings: `account`, `security`, `developer`, `advanced`

## Slash Commands Stay Powerful

Do not remove command access. The shell should keep the existing slash command
surface in `src/hooks/useYouAgent.ts` while routing commands into the simplified
areas.

Examples:

- `/profile`, `/edit`, `/files`, `/share`, `/portrait` route to Brain.
- `/projects`, `/portfolio`, `/skills`, `/stacks`, `/github` route to Projects.
- `/settings`, `/vault`, `/api`, `/env`, `/machine` route to Settings.
- `/history`, `/analytics`, `/agents` remain command/search accessible.

This preserves power while removing chrome.

## Implementation Notes

1. Replace `PrimaryPaneGroup` with `home | brain | projects | settings`.
2. Replace `PANE_GROUPS` in `dashboard-content.tsx` with the four-area model.
3. Keep `RightPane` as-is initially to avoid a risky behavior refactor.
4. Update `paneFromShellQuery` so old links still resolve to the same pane.
5. Keep slash commands stable in `useYouAgent.ts`.
6. Rename UI labels only after the route/pane mapping is stable.
7. Do not touch Convex/backend for this pass.

## Product Rule

If a pane is mostly about operating You.md, it belongs in Settings or Advanced.
If a pane is about making agents understand and use Houston's real context, it
belongs in Brain or Projects.

