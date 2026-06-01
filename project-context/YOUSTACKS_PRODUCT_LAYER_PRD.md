# YouStacks Product Layer PRD

Last updated: 2026-05-23

## Agent Kickoff Prompt

```text
You are working inside the local You.md repo. Your job is to start the YouStacks planning phase, not rush into random implementation.

First, save this brief into project-context/YOUSTACKS_PRODUCT_LAYER_PRD.md. Then read the existing You.md context before writing code: README.md, AGENTS.md, CLAUDE.md, project-context/PRD.md, project-context/ARCHITECTURE.md, project-context/FEATURES.md, project-context/TODO.md, project-context/SAFE_AGENT_CONTEXT_INTEGRATION.md, the CLI commands, the Convex schema/http routes, the memory/private-context code, the skill system, link/key sharing, and any existing GitHub/source/sync code.

This is an additive product-layer planning pass. Do not delete, remove, or rewrite existing You.md features just because they do not perfectly fit the new YouStacks framing. First audit what exists, then decide what should be kept as-is, repurposed, expanded, modified, or deferred. Only recommend removing something if it is genuinely breaking core new or existing functionality, creates security/privacy risk, or is actively confusing agents and users.

Core vision:
- You.md is the brain, identity context protocol, and durable personal/project context layer.
- YouStacks are not the brain. They are portable execution packages built on top of You.md.
- YouStacks are nameable and domain-specific. A user can maintain separate stacks for coding, scientific research, content creation, investing, teaching, project operations, or any other expertise lane.
- The first product wedge is for Claude Code, Codex, and Cursor users who want a one-line install that gives their agent their identity, preferences, project context, skills, tools, taste, workflows, and protected memory access.
- OpenClaw, Hermes Agent, and Pi agents are secondary host targets after the first three work.
- Do not launch with a custom You.md agent harness. A personalized You.md-branded agent environment can be a later product layer after the YouStack format, brain boundary, repo sync, and external host adapters are proven.
- The user should be able to create a personal YouStack for themselves, keep it private, share it with teammates/friends through scoped links or tokens, or publish a public/open version.
- Paid/sellable stacks are a later version. V1 is about private/public sharing, portability, trust, and usefulness.
- We need GitHub account/repo sync: users can connect GitHub, choose or create a user-owned repo, and keep their You.md brain files, YouStacks, manifests, skills, and project context synced there while You.md keeps a DB-backed hosted copy for availability and agent access.
- Start with the GitHub OAuth app/account-linking step Houston is setting up, but evaluate whether repo sync should use a GitHub App because GitHub Apps provide fine-grained repo permissions, installation-level repo selection, short-lived tokens, and built-in webhooks.
- Protect private IP: assume anything installed locally can be read. Put proprietary prompts, tools, retrieval, and sensitive actions behind authenticated You.md API/MCP services when needed.
- Treat GStack as the primary external lighthouse. It is the cleanest example of a local-first agent operating system: installable skills, specialist workflows, review/QA/release patterns, update behavior, and host-native files without needing a custom app or per-stack API.
- Keep `garrytan/gstack` as a local reference repo and monitor it daily for architecture, skills, install/update, host adapter, eval, and workflow lessons that should improve YouStacks.
- Keep `garrytan/gbrain` as a local reference repo and monitor it daily for shared-brain, memory, retrieval, sync, provenance, privacy, and context lessons that should improve the You.md brain.
- Keep `steipete/agent-scripts` as a local reference repo and monitor it for shared AGENTS/skills/scripts/hooks, pointer-style downstream repo rules, dependency-light helpers, validation, and canonical repo-owned skill patterns that should improve You.md's stack runtime.
- Keep `disler/the-library` as a local reference repo and monitor it for private-first skill/agent/prompt catalogs, source references instead of stale copies, typed dependencies, pull-on-demand install/use flows, and team/device distribution lessons that should improve YouStacks.
- Treat BAMFStack as the closest internal proof pattern. It was inspired by the GStack shape, then proved that a local stack can become even more powerful when it also knows how to use a real product backend, API, MCP, docs, and auth safely.
- Before designing YouStacks, review GStack first, then review the local bamfaiapp repo: public/bamfstack, docs, docs/workflows/agent-workflows.mdx, docs/mcp, docs/authentication.mdx, src/pages/DocsPage.tsx, supabase/functions/_shared/agent-capabilities.ts, public-api /v1/agent/capabilities and /v1/agent/route, and product-mcp tools/resources/prompts.
- Extract why BAMFStack worked: one-line curl install, local skills/commands/prompts/helper CLI, env-only API key handling, auto-upgrade, read-only smoke test, capability discovery, deterministic workflow routing, app/Stack/API/MCP parity, docs-quality examples, and a sync rule that updates stack files/docs/OpenAPI/tests together.
- You.md docs should reach the same quality bar as BAMF docs: clear quickstart, copyable install and starter prompts, API/MCP reference, agent workflow golden path, generated endpoint/tool reference, auth/token docs, safety rules, playbooks, examples, and a stack sync rule.
- Do not require custom API/MCP per stack in v1. A YouStack should be useful as a local/static install first, like GStack. Use You.md's shared API/MCP only when the stack needs protected brain retrieval, sync, tokens, connected tools, or server-side actions. Custom per-user/per-stack API/MCP surfaces are optional power features, not the baseline.

Deliverables:
1. Create project-context/YOUSTACKS_IMPLEMENTATION_PLAN.md.
2. Include a full feature/functionality inventory of the current You.md product: web app, CLI/TUI, You Agent, memory brain, private context, project context, skills, context links, API keys, MCP/API surfaces, Convex schema/http routes, GitHub/source/sync if any, docs, dashboard panes, onboarding, and sharing flows.
3. For each existing surface, classify it as keep, repurpose, expand, modify, defer, or remove-only-if-breaking. Do not remove features by default.
4. Include an audit of the current You.md brain/memory/private-context/project-context/skills/link/API/CLI surfaces.
5. Include a GStack transfer analysis and a BAMFStack applied-proof analysis: what maps 1:1 to YouStacks, what changes because You.md is a personal brain, and what should not be copied.
6. Define the YouStack manifest schema, repo folder layout, access model, GitHub sync design, public/private sharing model, primary adapters for Claude Code/Codex/Cursor, secondary adapters for OpenClaw/Hermes Agent/Pi agents, optional API/MCP extension boundaries, capability map, route endpoint, helper CLI, smoke test, and docs sync rule.
7. Decide the API/MCP threshold: what works with local files only, what uses the shared You.md API/MCP, what requires optional custom per-stack endpoints, and what clearly waits for user-owned remote MCP/API deploys later.
8. Break implementation into small, bisectable phases and name the first PR-sized slice.
9. Do not implement broad product changes until the audit and plan are written.
```

## Vision

You.md should become the brain. YouStacks should become the portable execution layer.

The cleaner vision is a personal agent operating system:

- You.md owns the brain: identity, memories, private context, project context, sources, preferences, directives, and access rules.
- YouStacks package execution: skills, workflows, tools, prompts, templates, evals, install scripts, host adapters, and protected service calls.
- YouStacks also need a source-of-truth catalog: skills, agents, prompts, scripts, examples, docs, and protected capabilities can be referenced from canonical local paths or GitHub repos instead of copied into every project.
- GitHub becomes the user's owned repo-backed source of truth.
- You.md keeps the hosted DB-backed mirror for availability, indexing, links, tokens, web, CLI, API, and MCP.
- Claude Code, Codex, and Cursor are the first GTM wedge because those users already understand the value of one command making an agent smarter.
- OpenClaw, Hermes Agent, and Pi agents are secondary adapters after the first three work.
- A You.md-branded personalized agent harness is later, not launch scope.

## Product Objects

| Object                  | Job                                                                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| You.md Brain            | Living context graph: identity, memories, projects, decisions, sources, files, preferences, voice, directives, private notes, and access rules.             |
| YouStack                | Versioned execution package that installs into external agents or runs inside You.md. It points at brain scopes instead of copying the entire brain.        |
| User-owned GitHub repo  | Portable source of truth for manifests, skill files, docs, public stack assets, project context, and encrypted or referenced private assets.                |
| You.md hosted mirror    | Always-available DB copy: indexes, compiled bundles, access tokens, share links, server-side tools, protected retrieval, webhooks, logs, and release state. |
| Agent adapters          | Generated output for primary hosts first, then secondary hosts: Claude Code, Codex, Cursor, OpenClaw, Hermes Agent, and Pi agents.                          |
| Protected service layer | Optional remote API/MCP endpoints for sensitive prompts, proprietary workflows, connected accounts, memory retrieval, and tool actions.                     |

## Host Rollout Order

1. Primary launch hosts: Claude Code, Codex, and Cursor.
2. Secondary hosts: OpenClaw, Hermes Agent, and Pi agents.
3. Thin You.md runner: existing web shell, CLI, and TUI can consume YouStacks without becoming the main launch bet.
4. Later You.md harness: a personalized You.md-branded agent environment can come after the stack format, repo sync, protected API/MCP layer, and external host adapters are proven.

## What Goes Into A YouStack

- Identity and directives: the user's voice, preferences, constraints, values, current work, and desired agent behavior.
- Skills and workflows: repeatable modes of work such as planning, research, writing, code review, launches, sales, outreach, creative critique, or expert processes.
- Tools and APIs: MCP servers, CLI commands, hosted endpoints, API clients, browser tools, converters, schedulers, and connected accounts.
- Templates and artifacts: docs, briefs, decks, issue templates, prompts, rubrics, launch checklists, content formats, and examples.
- Evals and guardrails: acceptance criteria, examples, safety rules, slop scans, review gates, smoke tests, and regression cases.
- Install and update metadata: manifest, versions, host targets, repo paths, access policy, provenance, changelog, migrations, and update channels.
- Improvement metadata: the stack's autonomous learning loop, safe signals, evals, approval gates, and which skills/workflows/examples/adapters can self-update.
- Source references: optional local/GitHub pointers and typed dependencies for skills, agents, prompts, scripts, docs, and examples that should stay canonical elsewhere.

## GStack Primary Lighthouse

GStack is the pattern to replicate most directly. The YouStack MVP should feel closer to GStack than to a new SaaS suite: installable, local-first, agent-native, opinionated, and immediately useful inside the tools people already use.

Core lessons:

- Local-first magic: a folder of skills, prompts, commands, and operating rules can make an existing agent dramatically smarter without building a new app.
- Skills are the product: the value is packaged expertise, specialist modes, taste, defaults, checklists, review flows, and reusable workflows the agent can actually run.
- Host-native files: the stack meets Claude Code, Codex, Cursor, and similar tools where they are.
- No backend required: a stack should be powerful before any custom API/MCP exists. Remote capabilities are optional extensions.
- Opinionated workflows: the stack is not generic prompt storage. It encodes how a strong operator reviews, plans, debugs, ships, audits, and improves work.
- Brain stays separate: GBrain being separate from GStack is the architectural lesson. Memory/context is a different layer from skills/workflows.

## Agent Scripts Lighthouse

Peter Steinberger's `agent-scripts` is the reference for keeping shared agent infrastructure elegant:

- One canonical shared `AGENTS.MD` instead of duplicated hard rules in every repo.
- Downstream repos point at the shared file, then keep repo-specific rules below the pointer.
- Skills are terse, routing-first, and validated.
- Helper scripts stay dependency-light and portable.
- Repo-owned skills can remain canonical inside the repo that owns them while being exposed into the shared layer through pointers.

You.md translation: `youmd skill init-project`, YouStack adapters, and GitHub-backed stack sync should support pointer-style managed blocks and source references so generated agent context stays fresh without flattening everything into a stale copy.

## The Library Lighthouse

Dan Disler's `the-library` is the reference for private-first distribution of agentic assets:

- A catalog stores references to skills, agents, and prompts.
- Nothing installs until the user asks for it.
- Local paths and GitHub URLs can both be sources.
- Typed dependencies avoid ambiguity between skills, agents, prompts, scripts, and protected capabilities.
- The agent can run catalog operations from markdown cookbook instructions.

You.md translation: YouStacks should grow from "a manifest of local files" into "a manifest plus private/source-backed catalog" where a user's skills, scripts, prompts, examples, and sub-agents can be pulled, synced, shared, or published while You.md keeps the hosted brain, grants, audit logs, and optional high-usage cloud surfaces.

## BAMFStack Proof Pattern

BAMFStack is the applied proof built from the GStack idea. The domain is different, but the architecture is the transferable part.

What made BAMFStack work:

- It ships a local agent kit instead of trying to replace Codex, Claude Code, or Cursor.
- It has a one-line installer that places skills, commands, prompts, helper binaries, and routing snippets into the right local agent homes.
- It does not ask agents to store raw keys. The key stays in an environment variable and remote MCP registration references that env var.
- It runs a read-only smoke test before any mutation.
- It exposes a canonical capability map through REST, MCP tool, MCP resource, docs, and local helper command.
- It has a route helper that converts fuzzy natural language into a recommended workflow, skill, REST endpoint, MCP tool, scope, and approval policy.
- It keeps the app, Stack, REST API, product MCP, docs, OpenAPI, skills, commands, starter prompts, and tests in sync.
- It uses the hosted product as the powerful backend and the local stack as the agent behavior package.

YouStacks should copy that pattern:

| BAMFStack mechanism            | YouStack equivalent                                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| one-line `bamfstack` installer | one-line `youstack` installer or `youmd stack install`, with host-specific output for Claude Code, Codex, and Cursor.        |
| `bamfstack smoke`              | `youstack smoke` verifies token, brain scope, stack manifest, repo sync, API/MCP, and host adapter health.                   |
| `GET /v1/agent/capabilities`   | `GET /v1/agent/capabilities` or `/v1/stacks/{id}/capabilities` returns app/stack/API/MCP/CLI parity.                         |
| `POST /v1/agent/route`         | `POST /v1/agent/route` routes fuzzy personal/project/workflow asks into the right stack skill and hosted tool.               |
| `bamf.get_agent_capabilities`  | `you.get_agent_capabilities` MCP tool plus `you://agent/capabilities` resource.                                              |
| `bamfstack auto-upgrade`       | `youstack auto-upgrade` refreshes generated local skills, docs, commands, prompts, and adapter instructions.                 |
| BAMF docs + OpenAPI sync rule  | You.md docs must update quickstart, API/MCP reference, generated endpoint/tool tables, skills, commands, and tests together. |

Do not copy the LinkedIn-specific workflows. Copy the operating model.

## Local-First, API/MCP-Optional

YouStacks should not require custom API/MCP to be useful. GStack is powerful because the local package itself carries a strong operating system for the agent. You.md should preserve that simplicity.

V1 should include:

- A local/static stack that works through installed files, instructions, skills, examples, smoke tests, update metadata, and host adapters.
- Shared You.md API/MCP primitives only when needed: token validation, scoped brain retrieval, repo sync state, access logs, approved memory writes, and existing connected tools.
- Optional protected calls when static files would leak sensitive IP or cannot perform the action.
- Declarative personal tool wrappers that can call shared You.md actions, existing APIs, repo files, context links, or connected accounts.
- A permissions model that answers: who can install this stack, what brain scopes can it retrieve, what shared tools can it call, what mutations require approval, and how can access be revoked?

Later:

- User-owned remote MCP/API deployment from the connected GitHub repo.
- Sandboxed workflow execution, custom workers, scheduled jobs, connector SDKs, and team-managed deploys.
- Customer-managed encryption, private cloud/VPC deploys, and enterprise data residency.

## Architecture

1. Brain audit: map the current You.md memory, private context, project context, source ingestion, API keys, context links, skill system, and CLI sync surfaces.
2. Stack manifest: define owner, brain scopes, skills, tools, prompts, adapters, files, repo paths, hosted endpoints, visibility, access policy, and update channel.
3. GitHub connection: link GitHub, let users choose or create a repo, commit generated stack files, process webhooks, and mirror compiled state in You.md.
4. Compiler: compile You.md brain scopes plus selected skills/tools/templates into host-native output for Claude Code, Codex, and Cursor first; OpenClaw, Hermes Agent, and Pi agents second.
5. Private sharing: issue scoped links and custom stack tokens with permissions, expiry, revocation, audit logs, and clear local/server boundaries.
6. Optional hosted tools: keep stacks useful as local files first; add shared You.md API/MCP calls only for protected memory, sync, connected tools, and actions that should not live in plaintext.
7. Feedback loop: capture usage, failures, edits, saved memories, repo diffs, and corrections so You.md brain and YouStack versions improve.
8. Stack portfolio: let one user own many named stacks with separate slugs, domains, skills, sub-agents, workflows, examples, improvement loops, sharing policies, and update channels.
9. Reference intelligence: daily fetch GStack, GBrain, Agent Scripts, and The Library, summarize upstream commits, and create reviewable You.md tasks for relevant stack/brain/catalog/runtime improvements.

## GitHub Sync Plan

The repo is the user's portable source of truth. You.md is the always-available hosted mirror.

V1 requirements:

- Account linking: create the GitHub OAuth App for You.md sign-in/account connection, storing external account identity, username, avatar, email if available, and connection state.
- Repo access architecture: evaluate whether repo creation/sync should move from OAuth tokens to a GitHub App. GitHub's docs generally prefer GitHub Apps for repo access because they use fine-grained permissions, give repo-level control, use short-lived tokens, and include built-in webhooks.
- Owned repo model: let users connect an existing repo or create a new private repo such as `youmd-brain` or `youstacks`.
- Sync boundaries: keep safe, portable files in GitHub. Keep secrets, sensitive prompts, connected-account tokens, and proprietary hosted logic in You.md services or encrypted references.

Potential repo layout:

| Path                               | Purpose                                                                                                   |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `.youmd/you.md`                    | Human-readable compiled identity summary.                                                                 |
| `.youmd/you.json`                  | Machine-readable bundle with schema version, sources, profile, preferences, and references.               |
| `.youmd/brain/`                    | Safe exported brain summaries, memory indexes, project summaries, source manifests, and retrieval policy. |
| `.youstacks/<slug>/stack.json`     | YouStack manifest: name, slug, domain, aliases, tags, brain scopes, files, tools, adapters, versions, sharing policy, improvement policy, and update channel. |
| `.youstacks/<slug>/skills/`        | Host-readable skills, workflows, examples, and rendered instruction files.                                |
| `.youstacks/<slug>/adapters/`      | Generated `CLAUDE.md`, `AGENTS.md`, Cursor rules, MCP config, install scripts, and host-specific docs.    |
| `.youstacks/<slug>/protected.json` | References to hosted services, encrypted blobs, scoped API routes, and policies. No plaintext secrets.    |

## PRD Requirements

| Area                       | V1                                                                                                                                                                                 | Later                                                                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feature preservation audit | Inventory every current You.md feature and functionality surface before changing behavior. Classify each as keep, repurpose, expand, modify, defer, or remove-only-if-breaking.    | Maintain a living capability map tied to tests, docs, owners, routes, CLI commands, API endpoints, data tables, and user-visible workflows.                 |
| You.md brain hardening     | Audit memory capture, project context, private context, retrieval quality, source provenance, deletion, stale data, conflict handling, access logs, and stack-scoped grants.       | Entity graph, temporal memory, cross-agent attribution, explainable retrieval, memory evals, retention policy, source refresh jobs.                         |
| YouStack creation          | Add a stack creation flow that starts from current You.md context and asks one question at a time to identify host, skills, tools, files, sharing mode, and privacy boundaries.    | Creator/expert onboarding that ingests books, posts, transcripts, docs, APIs, and examples.                                                                 |
| BAMFStack proof audit      | Review bamfaiapp's public/bamfstack, docs, capability map, route endpoint, MCP tools/resources, installer, helper CLI, smoke tests, and docs UI before finalizing the plan.        | Maintain a reusable internal checklist for future stack-like products: installer, docs, API/MCP parity, skills, commands, tests, versioning, and safety.    |
| Stack manifest             | Create a schema for name, slug, domain, aliases, tags, brain scopes, file outputs, tools, prompts, templates, examples, evals, host adapters, visibility, access policy, repo sync, improvement policy, and update channels. | Marketplace metadata, billing policy, ratings, dependency graphs, compatibility matrix, and cross-stack composition. |
| Capability map and router  | Create a local-first capability map plus deterministic route helper that maps user intent to surface, YouStack skill, optional REST/MCP tool, scopes, approval policy, and host.   | Use routing telemetry and evals to improve workflow selection, detect stale skills, and recommend new stack capabilities.                                   |
| Installer and helper CLI   | Ship a one-line installer and local helper such as `youstack` or `youmd stack` with version, auto-upgrade, smoke, capabilities, route, prompt, MCP setup, routing, and skills.     | Signed releases, host-specific update channels, local diff previews, and team-managed rollouts.                                                             |
| Primary host adapters      | Generate host-native files and one-line installers for Claude Code, Codex, and Cursor with clear local/server boundaries.                                                          | Deeper host-specific UX, version migrations, compatibility tests, and stack update channels per primary host.                                               |
| Secondary host adapters    | Plan the adapter shape for OpenClaw, Hermes Agent, and Pi agents, but implement after the first three hosts work end-to-end.                                                       | OpenClaw/Hermes/Pi installers, MCP presets, hosted adapter tests, team workspaces, browser agents, and custom SDKs.                                         |
| You.md agent harness       | Do not launch with a bespoke You.md agent harness. Reuse the existing web shell, CLI, and TUI only as thin consumers of the same YouStack format.                                  | A personalized You.md-branded agent environment can become a product layer after external host adapters, repo sync, and protected API/MCP calls are proven. |
| Public/private sharing     | Support private stacks, public stacks, scoped share links, custom YouStack access tokens, revocation, expiry, and access logs.                                                     | Paid distribution, licensing, creator analytics, teams, org roles, and revenue share.                                                                       |
| Protected IP layer         | Allow local packages to call authenticated You.md API/MCP services for proprietary workflows, memory retrieval, and tools that should not be exposed in installed files.           | Per-call billing, sandboxed action execution, hosted evals, creator-owned remote MCP servers, and customer-managed encryption.                              |
| Optional API/MCP layer     | Do not make custom API/MCP required for a stack to work. Start local-first, use shared You.md API/MCP for protected brain/tool primitives, and treat custom endpoints as optional. | Offer user-owned remote MCP/API deployments, custom workers, and private hosting for power users and teams.                                                 |
| Docs and sync rule         | Bring You.md docs to the BAMF docs standard: quickstart, install prompts, auth/tokens, API/MCP reference, agent workflow golden path, examples, generated reference, sync rule.    | Docs previews per stack, generated SDK examples, live runnable examples, changelog automation, and public/private docs per stack visibility.                |

## References

- [GStack](https://github.com/garrytan/gstack): primary lighthouse for the stack-as-agent-operating-system pattern: installable skills, specialist modes, review/QA/release flows, and host-native files.
- [GBrain](https://github.com/garrytan/gbrain): reference for the memory side: markdown brain repo, retrieval layer, MCP surface, and explicit separation between brain and stack.
- [Agent Scripts](https://github.com/steipete/agent-scripts): reference for canonical shared agent rules, skills, helper scripts, validation hooks, and pointer-style downstream setup.
- [The Library](https://github.com/disler/the-library): reference for private-first catalogs of skills, agents, prompts, typed dependencies, and cross-device/team distribution.
- [BAMF Developer Docs](https://bamf.ai/docs): internal quality bar for product docs: quickstart, auth, API/MCP, agent workflows, playbooks, copyable prompts, and generated endpoint/tool reference.
- [BAMFStack Installer](https://bamf.ai/bamfstack/install.sh): internal applied proof for the one-line install pattern: local skills, commands, helper CLI, auto-update, smoke checks, and API/MCP setup guidance.
- [GitHub Apps vs OAuth Apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps): reference for why OAuth can start account linking, while repo sync should seriously evaluate GitHub Apps for finer repo permissions and webhooks.

## Roadmap

1. Phase 0: Save this PRD, inventory existing features, classify keep/repurpose/expand/modify/defer, and create `project-context/YOUSTACKS_IMPLEMENTATION_PLAN.md`.
2. Phase 1: Harden the You.md brain boundary while preserving existing product value: scopes, provenance, memory quality, deletion, access logs, retrieval contracts, and stack-safe context grants.
3. Phase 2: Add the YouStack manifest and compiler with basic Claude Code/Codex/Cursor outputs.
4. Phase 3: Ship GitHub-owned repo sync with DB mirror and webhooks.
5. Phase 4: Ship private/public sharing via scoped links and stack tokens.
6. Phase 5: Add OpenClaw, Hermes Agent, and Pi agent adapters only after the first three host targets are reliable.
7. Phase 6: Expose optional shared API/MCP tools and use the existing You.md web shell/CLI/TUI as a thin runner. A full You.md-branded personalized harness is later, not launch scope.

## Planning Questions

- What features and functionality already exist in You.md across web, CLI, TUI, agent, Convex, API, MCP, docs, links, keys, memory, private context, project context, skills, onboarding, and sharing?
- For each existing surface, should it be kept as-is, repurposed, expanded, modified, deferred, or removed only if genuinely breaking something?
- What does a v1 YouStack manifest need to contain, and what can wait?
- Which brain fields are safe to export locally versus retrieved through scoped API calls?
- Should GitHub repo write access be OAuth-only for MVP, or should repo sync start with a GitHub App?
- What is the minimum Claude Code/Codex/Cursor installer that feels like the GStack magic?
- Which GStack mechanisms should YouStacks copy most directly: local skills, specialist modes, update flow, review/QA/release workflows, host-native files, and separation from the brain layer?
- Which BAMFStack mechanisms map directly to YouStacks: installer, helper CLI, auto-upgrade, smoke, capability map, route helper, docs sync rule, and API/MCP parity?
- Should the first helper be a standalone `youstack` command, a `youmd stack` subcommand, or both with one as an alias?
- Which YouStack capabilities should work with local files only, which need the shared You.md API/MCP, and which justify optional custom per-stack endpoints later?
- What docs information architecture gives You.md the same quality bar as BAMF docs without overbuilding the UI?
- What host abstraction lets OpenClaw, Hermes Agent, and Pi agents become secondary adapters without distorting the primary launch?
- What explicit line keeps the team from building a custom You.md agent harness before the stack format is proven?
- Which existing You.md CLI commands can be extended instead of adding a brand new product surface?
- What tests or smoke checks protect existing You.md functionality while adding the YouStacks layer?
- How do public stacks differ from private stacks in files, permissions, update channels, and hosted endpoints?

## Bottom Line

You.md should make the user's brain portable, repo-backed, permissioned, and instantly useful inside the agent tools people already use.
