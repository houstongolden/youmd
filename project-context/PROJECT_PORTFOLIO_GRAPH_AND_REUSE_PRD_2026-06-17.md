# Project Portfolio Graph and Reuse Catalog PRD

Date: 2026-06-17
Status: Product architecture captured; implementation pending
Owner: You.md

## Why This Exists

Houston is building many products, businesses, research projects, internal tools,
public APIs, MCP servers, and skill stacks at the same time. You.md already
tracks identity, projects, sources, memories, skills, stacks, and GitHub project
activity, but the next missing layer is a strategic portfolio graph.

The portfolio graph should help a single human plus many local/cloud agents stay
focused. It should answer:

- What projects exist, what are they for, and what is the goal right now?
- Which project owns an API, MCP server, skill stack, or protected app agent?
- Which projects depend on which other projects?
- Which integration is core, feature-level, optional, dev-only, or admin-only?
- Where is code, UI, prompt, auth, role, layout, or agent behavior being reused?
- Where is an agent about to duplicate a capability that already exists?
- What should a fresh machine or fresh agent load first to work safely?

The product goal is not another static dashboard. The product goal is a living
operating map for Houston's product ecosystem.

## Current You.md Project Model

You.md currently stores and organizes project information through several layers:

1. **Identity bundle projects**
   - `profiles.projects` and bundle `youJson.projects` store public or
     identity-level project summaries.
   - These feed public profile context, MCP `get_identity`, and the compiled
     `you.md` / `you.json` identity files.

2. **Project markdown packs**
   - `convex/me.ts` scaffolds per-project custom files:
     `projects/<slug>/README.md`, `context.md`, `prd.md`, and `todo.md`.
   - The local CLI project engine also reads repo-local `project-context/` files
     and global `~/.youmd/projects/<name>/` overlays.
   - MCP `get_project_context` returns PRD, TODO, features, decisions,
     changelog, and project memories through a readiness envelope.

3. **GitHub active-project telemetry**
   - `trackedProjects` stores one row per recent GitHub repo, including repo URL,
     product URL, repo/directory name, API docs URL, MCP docs URL, stack name,
     high-level goal, recent progress, language, pushed date, and LLM insight.
   - `convex/githubProjects.ts` hydrates this from recent GitHub activity and can
     write project markdown files back to the user's You.md repo.

4. **Repo mirror and stacks**
   - `repoMirror` snapshots mirrorable identity and `stacks/**` files from the
     user's You.md repo so API/MCP reads do not hit GitHub every request.
   - `stacks/<slug>/` is the server-side stack layout for named YouStacks.

5. **DSI and Loop Reports**
   - `dsiComponents`, `sourceSnapshots`, `loopReportRuns`, and report artifacts
     already support a private GitHub Project Catalog with summaries, recent
     commits, LOC/LOMB, source hashes, and daily report inclusion.

These layers are good raw material. They are not yet a full dependency graph or
reuse catalog.

## Portfolio Graph Product Model

Add a first-class portfolio graph resource family on top of the existing
`projects`, `stacks`, `sources`, `memories`, and `activity` surfaces.

### Project Record

Every meaningful project should have:

- `name`, `slug`, `aliases`, and `status`
- `status_source` and `status_updated_at`: manual overrides must survive
  GitHub/local activity hydration so Houston can keep one-off repos inactive
  even when they have recent commits.
- `focus_status` and `focus_rank`: Top Priority, Focusing, Freeze/On Ice,
  Abandoned, Dead/Killed, or Unsorted.
- `type`: SaaS, API, MCP, skill stack, research, agency, internal admin,
  public site, personal site, library, experiment, or infrastructure
- `owner`: human, team, agent, or product owner
- `goal`: durable high-level goal
- `current_focus`: active next milestone
- `ai_summary_short`: one sentence for quick agent startup
- `ai_summary_long`: richer description for planning and handoff
- `product_url`, `repo_url`, `local_directory`, `docs_url`, `admin_url`
- `api_docs_url`, `mcp_docs_url`, `openapi_url`, `well_known_mcp_url`
- `primary_stack_name`, `stack_slug`, `stack_visibility`
- `primary_language`, `framework`, `runtime`, `db`, `auth_model`
- `prd_path`, `tasks_path`, `design_path`, `research_path`, `ideas_path`,
  `changelog_path`, `current_state_path`, `agent_docs_path`
- `source_of_truth`: repo, You.md bundle, local project-context, product DB, or
  external system
- `fresh_machine_setup`: clone command, env backup/restore note, smoke command,
  expected local directory, and setup eligibility. Default new-machine setup
  should clone only projects that are both `active` and `Top Priority` or
  `Focusing`; inactive, unsorted, frozen, abandoned, killed, and unreviewed
  GitHub-only repos require an explicit override.

### API/MCP Surface Record

Every API or MCP surface should have:

- `name`, `slug`, `owning_project`, `owning_stack`
- `surface_type`: REST API, hosted MCP, local MCP, GraphQL, webhook, SDK,
  CLI, internal function, protected app agent
- `visibility`: public, private, scoped, admin-only, dev-only, internal IP
- `docs_url`, `openapi_url`, `mcp_discovery_url`, `install_url`
- `auth_mode`: owner API key, connected-app grant, user OAuth, workspace grant,
  admin env secret, service token, or public
- `integration_type`: user-level, admin/developer-agent, workspace-level,
  product-internal, or public consumer
- `write_policy`: read-only, propose, approved-write, or autonomous write
- `risk_tier`: core dependency, feature dependency, optional enhancement,
  dev-only, or experimental
- `breaking_impact`: what breaks if this surface fails or is disconnected
- `duplicate_risk`: similar surfaces/endpoints that must be checked before new
  endpoint work starts

### Dependency Edge

Every project-to-project relationship should be a typed edge:

- `depends_on`: project B requires project A
- `provides_api_to`: project A powers project B through API/MCP
- `codependent`: both projects require each other for an important workflow
- `optional_consumes`: project B can use project A but degrades without it
- `shares_stack_with`: projects use the same stack, skill set, or agent rules
- `reuses_code_from`: project B intentionally reuses code from project A
- `reuses_ui_from`: project B intentionally reuses UI/UX patterns from project A
- `owns_public_stack_for`: project A owns the installable public stack for a
  product ecosystem
- `owns_protected_harness_for`: project A owns private in-product agent
  behavior that should not be exposed in a public stack

Each edge should carry:

- `direction`
- `reason`
- `features_powered`
- `failure_mode`
- `integration_type`
- `auth_boundary`
- `status`
- `last_verified_at`
- `verification_command`

### Dependency Labels

Use consistent dependency labels so agents can reason quickly:

- **DEPENDENT:** Project B requires Project A for named core features. If A
  fails, B breaks.
- **FEATURE:** Project B uses Project A for specific non-core features. If A
  fails, B degrades with a visible limitation.
- **OPTIONAL:** Project B can use Project A for enhancement. If A fails, B still
  works.
- **DEV-ONLY:** Integration is for Houston or coding agents only. It should not
  be exposed as a user feature.
- **ADMIN:** Integration uses owner/admin credentials or internal environment
  secrets and must not be presented as a user-level connector.
- **WORKSPACE:** Integration is scoped to an org/workspace/team inside the app.
- **USER-LEVEL:** Integration is authorized by an end user through their account
  or API key.

## Protected Harness vs Public Skill Stack

This distinction must be explicit for products like BAMF.ai and BAMFStack.

- A **protected product agent harness** is the private in-product agent brain:
  proprietary prompts, strategy, copywriting, image generation, workflow logic,
  client data, approvals, internal tools, and product-specific execution.
- A **public or installable skill stack** teaches an external host agent how to
  use a product's API/MCP safely. It can include docs, smoke checks, light
  skills, workflows, capability routing, examples, and public-safe prompts.

The public stack can expose how to connect and operate the API/MCP. It should
not leak the deeper proprietary app agent harness unless the owner explicitly
marks that material public-safe.

## Reuse Catalog

The reuse catalog should be a second first-class view beside the dependency
graph. It should track reusable decisions, components, patterns, and source
examples across repos.

### Reusable Pattern Record

Each reusable pattern should have:

- `name`, `slug`, `category`
- `category`: auth, role hierarchy, sidebar, shell layout, chat UX,
  streaming-response pattern, connector UX, API/MCP docs, stack install,
  project-context docs, env management, cron/loop, source crawler, report,
  data model, DSI component, or prompt/skill
- `canonical_status`: canonical, candidate, deprecated, or project-specific
- `canonical_owner_project`
- `source_files`: repo paths that demonstrate the pattern
- `applies_to`: Next.js, Vite, Convex, Supabase, Tailwind, CLI, MCP, API, etc.
- `adopted_by_projects`
- `avoid_when`
- `agent_instruction`: how future coding agents should reuse it
- `smoke_check`
- `last_reviewed_at`

### High-Value Patterns To Capture Now

1. **API/MCP/SkillStack-first architecture**
   - Every serious product should lead with API, MCP, installable stack, skills,
     docs, smoke checks, host adapters, and project context.

2. **Role hierarchy**
   - Solo user account.
   - Team/workspace/org roles: member, manager, admin, owner.
   - Super-admin: Houston/app owner/developer agents only, gated by secrets or
     internal auth, never confused with normal workspace roles.

3. **Auth preference**
   - Prefer first-party passwordless auth: email code or verify link via Resend,
     with SMS/iMessage/RCS via Sendblue or equivalent when needed.
   - Convex Auth is acceptable when multiple SSO providers justify it.
   - GitHub OAuth can be custom when it is the only OAuth need.
   - Avoid Clerk and paid auth providers by default.

4. **Standard app shell layout**
   - Full-height left sidebar.
   - Collapsible logo area.
   - New Chat, Search, main navigation, Files/Library, Skills/Workflows/Stacks,
     Loops, Connections/Integrations, Context/Knowledge, Projects with add/new
     affordance, recent chats, and fixed bottom account menu.
   - Account menu includes theme: dark, light, system; settings; usage; plans;
     account/profile; avatar/image/email/password/phone management.

5. **Agentic split workspace**
   - Main chat can run full width before work starts.
   - Once useful, a right-side full-height pane opens for artifacts, session
     intelligence, previews, docs, task trackers, or generated outputs.
   - On wide screens, right pane is roughly 50-60 percent and chat is roughly
     30-40 percent. Left sidebar may collapse automatically to make room.

6. **Agent streaming response behavior**
   - Start with a quick, specific acknowledgment of what the user said.
   - State what the agent is going to inspect, research, or change.
   - Then show live step-by-step progress, task states, and artifacts/results.
   - Avoid dead loading spinners. Use meaningful progress lines or a live task
     list instead.

7. **Design preferences**
   - No boxes within boxes for information-dense admin/docs/tools.
   - No random forms as the primary product experience.
   - Terminal-native, restrained, useful, and direct.

## Dashboard View Requirement

Add a dedicated `/shell` portfolio view that can be opened from the Projects
group. Working names:

- `portfolio`
- `project graph`
- `ecosystem`
- `project intelligence`

The view should show:

- All tracked projects grouped by status, domain, stack, and recency.
- API/MCP surfaces with owning project, docs, scopes, auth, risk, and consumers.
- Dependency graph with clear labels: dependent, feature, optional, dev-only,
  admin, workspace, user-level.
- Duplicate-risk warnings before new API/MCP or skill work.
- Reusable pattern catalog filtered by tech stack and category.
- Project docs pack status: PRD, tasks, design, research, ideas, changelog,
  current state, agent docs, API docs, MCP docs.
- Fresh-machine readiness: repo clone path, env backup/restore readiness,
  stack install, MCP smoke, last verified, manual active/inactive state, and
  whether the project is setup-eligible by the active + focus gate.

The view should use one clear outer section shell, then rows, tables, dividers,
badges, and compact graph/list toggles. Avoid card piles.

## YouStack Skill Requirement

Add a bundled YouStack skill, working name `portfolio-graph-auditor`, that a host
agent can run inside Claude Code, Codex, Cursor, or the CLI.

The skill should:

1. Discover local workspace roots and recent projects.
2. Read repo agent docs, `project-context/`, package files, API docs, MCP files,
   stack manifests, and README-style docs.
3. Identify project goals, PRDs, tasks, design docs, research docs, ideas docs,
   env requirements, APIs, MCP servers, and install commands.
4. Detect repeated code/UI/auth/layout/agent patterns and propose canonical
   reusable pattern records.
5. Detect likely duplicate APIs, endpoints, skills, stacks, and integrations.
6. Suggest a single canonical owner for each capability.
7. Write proposals into You.md, not directly mutate every repo.
8. Produce a short agent startup brief per project.

This is analogous to skill-stack DRY syncing, but with lighter governance. Skills
still need stronger DRY enforcement because duplicated skills confuse agent
execution. Product APIs and code patterns need explicit ownership and warnings,
not a blanket ban on local variation.

## Lempod Ownership Decision To Track

Houston has multiple Lempod accounts. Lempod management may already be built
more robustly in `bamfaiapp`, while `bamfsite` may also need to manage Lempod as
a business/admin expense.

Do not duplicate Lempod management APIs until ownership is verified.

Required next audit:

1. Inspect `bamfaiapp` for existing Lempod API/routes/admin tools.
2. Inspect `bamfsite` for Lempod API/routes/admin tools.
3. Choose one canonical owner:
   - `bamfaiapp` owns creator/product Lempod management and `bamfsite` consumes
     it through API/MCP.
   - `bamfsite` owns agency/admin/business-expense Lempod management and
     `bamfaiapp` consumes or references it.
   - Split ownership only if account domains are genuinely different, with clear
     names and no duplicate endpoint semantics.
4. Add dependency edges and failure modes.
5. Add a duplicate-risk warning to the portfolio graph.

## Implementation Phases

### Phase 0: Product Context

- Preserve this PRD.
- Update PRD, Architecture, TODO, FEATURES, CURRENT_STATE, active requests, and
  changelog.
- Answer how You.md currently saves Projects and how it should evolve.

### Phase 1: Data Contract

- Add typed portfolio graph records or extend the `projects` resource contract.
- Decide whether the first storage lives in Convex tables, repo markdown
  (`projects/<slug>/portfolio.md`), or both.
- Define the MCP/API response shape for `projects`, `portfolio_graph`, and
  `reuse_patterns`.

### Phase 2: Auditor

- Add `youmd project audit-portfolio` or a bundled skill-backed command.
- Generate read-only proposals from local repos and GitHub activity.
- Store proposals with provenance and owner approval state.

### Phase 3: Dashboard

- Add the `/shell` portfolio view.
- Include API/MCP surface map, dependencies, reusable patterns, docs status, and
  fresh-machine readiness.

### Phase 4: Agent Runtime Use

- Teach `get_agent_brief` and `get_project_context` to include the relevant
  portfolio graph slice.
- Before agents create a new API, MCP route, stack, or reusable component, they
  should check the graph for canonical owners and duplicate-risk warnings.

## Definition of Done

- A fresh agent can ask You.md what projects exist, which APIs/MCPs they expose,
  who depends on whom, and what breaks if a dependency fails.
- A fresh agent can see the canonical reusable auth/sidebar/chat/layout/role
  hierarchy patterns before building a new app.
- A fresh machine can clone/setup only the active + Top Priority/Focusing
  project set by default, and understand each selected project's API/MCP, stack,
  env, docs, and dependency readiness.
- Lempod and similar shared capabilities have one canonical owner or a documented
  split, not quiet duplicate endpoints.
- Product-facing protected app harnesses are clearly separate from public or
  installable skill stacks.
