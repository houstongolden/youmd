# YouStacks Implementation Plan

Last updated: 2026-05-23
Status: planning draft for Houston review
Scope: additive product-layer planning only. No broad product behavior changes are authorized by this document.

## 1. Decision Summary

You.md remains the brain: the durable identity, memory, preference, private context, project context, skills, auth, and hosted availability layer.

YouStacks are the portable execution packages that sit on top of that brain. A YouStack should make Claude Code, Codex, and Cursor behave like they know the user, the project, the workflows, the trusted tools, and the boundaries before the agent starts improvising.

The first wedge is local-first and host-native:

- Claude Code, Codex, and Cursor are the primary v1 hosts.
- OpenClaw, Hermes Agent, and Pi agents are secondary host targets once the first three work.
- A custom You.md-branded agent harness is explicitly deferred. It can become a later product layer after the stack format, brain boundary, repo sync, and host adapters are proven.
- Paid/sellable stacks are explicitly deferred. V1 is private use, scoped sharing, public/open sharing, portability, trust, and usefulness.

The core build principle:

- Local files should be useful by themselves.
- Protected memory, private prompts, proprietary tools, connected accounts, tokens, sync, and sensitive actions should live behind authenticated You.md API/MCP services.
- Custom per-stack API/MCP is optional later power-user territory, not the baseline.

## 2. Source Audit

This plan was written after reading the existing You.md project context and the named external/internal reference stacks.

You.md sources audited:

- `README.md`
- `AGENTS.md`
- `CLAUDE.md`
- `project-context/PRD.md`
- `project-context/ARCHITECTURE.md`
- `project-context/FEATURES.md`
- `project-context/TODO.md`
- `project-context/SAFE_AGENT_CONTEXT_INTEGRATION.md`
- CLI command registry and related implementations in `cli/src/index.ts`, `cli/src/commands/*`, `cli/src/lib/skills.ts`, `cli/src/lib/skill-catalog.ts`, `cli/src/mcp/server.ts`
- Convex schema and HTTP routes in `convex/schema.ts`, `convex/http.ts`
- Memory, private context, context links, API keys, vault, skills, and source code in `convex/memories.ts`, `convex/private.ts`, `convex/contextLinks.ts`, `convex/apiKeys.ts`, `convex/vault.ts`, `convex/skills.ts`, `convex/sources.ts`
- Dashboard panes, docs routes, onboarding, share/settings/agents/skills surfaces, and You Agent hook
- Current GitHub/source/sync code and repo workflows

Reference sources audited:

- GStack local repo at `~/.claude/skills/gstack`
- BAMF app repo at `/Users/houstongolden/Desktop/CODE_2025/bamfaiapp`
- BAMFStack files under `public/bamfstack`
- BAMF docs under `docs`, especially `docs/workflows/agent-workflows.mdx`, `docs/mcp`, and `docs/authentication.mdx`
- BAMF docs UI in `src/pages/DocsPage.tsx`
- BAMF capability map and router in `supabase/functions/_shared/agent-capabilities.ts`
- BAMF public API routes `/v1/agent/capabilities` and `/v1/agent/route`
- BAMF product MCP in `supabase/functions/product-mcp/index.ts`
- Official GitHub docs on GitHub Apps vs OAuth Apps, installation repositories, OAuth scopes, and installation access tokens:
  - https://docs.github.com/en/enterprise-cloud@latest/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps
  - https://docs.github.com/en/rest/apps/installations
  - https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps
  - https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app

## 3. Existing You.md Feature Inventory And Classification

Classification key:

- Keep: preserve as-is except bug fixes.
- Repurpose: keep the current surface and use it as a building block for YouStacks.
- Expand: add YouStacks capability on top.
- Modify: adjust semantics, docs, or UX because the current behavior is too coarse or confusing.
- Defer: intentionally not part of v1.
- Remove-only-if-breaking: do not remove unless it actively breaks functionality, creates security/privacy risk, or confuses agents/users.

| Surface | Current functionality | Classification | YouStacks action |
| --- | --- | --- | --- |
| Public identity protocol | Public profiles, `you.json`, `you.txt`, public context routes, schema route | Keep | YouStacks can reference public identity but should not replace the identity protocol. |
| Web landing and marketing | Explains You.md as identity/context protocol | Modify | Update copy later to separate brain from portable execution packages. Do not make stacks the whole brand. |
| Dashboard shell | Terminal split-screen, You Agent chat, panes | Keep | Keep as command/control brain UI. Do not turn it into the v1 stack host. |
| Profile/Edit panes | Profile fields, files/sections, profile publish and edit flows | Keep | Stack manifests can point to selected profile fields as brain scopes. |
| Share pane | Creates public/full context links with TTL, max uses, preview prompt, and project query | Expand/modify | Add stack-scoped links/tokens. Current full link is too broad for private IP and private memory. |
| Settings/API keys | Create, reveal, rotate, revoke API keys; security activity; panic revocation | Expand | Add stack token management, GitHub connection status, and stack grants without weakening existing keys. |
| Agents pane | Agent activity logs and trust labeling | Expand | Attribute stack usage, host, adapter, token, route, and brain scope access. |
| Skills pane | Shows bundled skills, registry skills, MCP install commands | Repurpose/expand | Promote skills into first-class stack package components while keeping current skills. |
| Vault pane | Private vault/security surface | Keep/expand | Use for highly sensitive private context and future encrypted stack secrets. |
| Help/docs pane | Product help, docs links | Expand | Add YouStacks quickstart, manifest, adapter, sharing, GitHub sync, API/MCP threshold, and playbooks. |
| Onboarding `/initialize` | Conversational boot sequence, profile capture, memories, sources | Modify | Add optional "create my first YouStack" path later, still one question at a time. No forms. |
| Public profile pages | SSR profile, OG/JSON-LD, public URLs | Keep | Stacks can link to a public profile but should not force public identity exposure. |
| Docs platform | Developer docs, generated API/MCP references, command reference | Expand | Bring YouStacks docs to BAMF-level quality with generated references and examples. |
| You Agent web hook | Rich slash commands for profile, memory, share, skills, vault, agents, analytics, history | Modify/expand | Use as a brain editor and stack generator, not as the v1 custom agent runtime. |
| You Agent CLI chat | Ongoing terminal chat with identity context | Keep/modify | Can help create/update stacks, but external host adapters remain the wedge. |
| CLI command set | `init`, `login`, `build`, `publish`, `add`, `diff`, `export`, `preview`, `chat`, `pull`, `push`, `sync`, `link`, `keys`, `memories`, `private`, `project`, `prompts`, `skill`, `mcp`, `logs`, `agents` | Expand | Add `youmd stack` commands rather than overloading identity commands. |
| CLI TUI/personality | Spinner, terminal-native flow, ASCII identity, project detection | Keep | Reuse for stack creation and smoke tests. |
| Local bundle `~/.youmd` | Profile files, preferences, directives, private files, skills, projects | Repurpose/expand | Add stack home under `~/.youmd/stacks` or `~/.you/stacks` after ownership migration is settled. |
| Project `.you/` bootstrap | Generated agent context, stack map, project-context README | Repurpose/expand | This is the closest existing YouStack substrate; extend without deleting user-owned agent files. |
| Host bootstrap blocks | Additive managed blocks in `AGENTS.md` and `CLAUDE.md`; Cursor rules when present | Expand | Become adapter outputs for Claude Code, Codex, and Cursor. |
| MCP local server | 19 tools and resources including identity, agent brief, memories, project context, skills, compile/push/link | Expand | Add stack manifest/capabilities/router resources and stack-scoped brain retrieval. |
| `get_agent_brief` | Startup brief for local agents with identity, project instructions, skills, TODOs, active requests | Repurpose/expand | This is the seed of the YouStack boot packet. Keep it lean and make stack-aware. |
| HTTP API | Public profiles/ctx/skills; auth; bundle; sources; analytics; links; keys; memories; private; skills; history; agents; vault; chat; MCP | Expand | Add stack manifest, capability map, route, grants, share, GitHub sync, and install metadata endpoints. |
| Convex schema | 21 tables for users/profiles/bundles/sources/memories/private/context links/API keys/skills/agent activity/etc. | Expand | Add stack, grant, adapter, GitHub connection/repo/sync tables. No destructive table removals. |
| Memory brain | Authenticated memories with categories, tags, source/session/agent metadata, archive/update stats | Keep/expand | Add stack-readable scopes, provenance, and host attribution. |
| Private context | Owner-only private notes, projects, links, calendar, comm prefs, thesis, custom data; profile access tokens | Keep/modify | Needs stack-scoped grants and field-level boundaries before exposing to shared stacks. |
| Private vault | Wrapped key and encrypted payload storage | Keep/expand | Candidate for sensitive stack secrets and proprietary prompts later, but v1 should avoid secret-heavy local stacks. |
| Context links | Scoped public/full token links with TTL/max uses/revocation | Modify/expand | Create new stack links/grants instead of stretching public/full links into everything. |
| API keys | `ym_` keys, scopes, expiration, hashed storage, optional reveal encryption | Keep/expand | Keep for API/MCP. Add stack-specific tokens/grants with least privilege. |
| Access tokens | Private profile access tokens for read/write scopes | Repurpose/modify | Useful precedent, but current token scopes are too coarse for stack sharing. |
| Skill system | Seven default skills, remote source install, local install, render, link to Claude/Codex/Cursor | Repurpose/expand | Skills become one artifact type inside a YouStack. Keep current skills. |
| Source ingestion | Website, GitHub, X, LinkedIn, blog, YouTube sources; scraper/enrichment pipeline | Keep | GitHub profile/source ingestion is not repo sync. Keep it separate. |
| Pipeline | Discover/fetch/extract/analyze/compile/review bundle pipeline | Keep/expand | Stack compiler should reuse bundle/project outputs but not mutate the core pipeline prematurely. |
| GitHub/source/sync | Public GitHub profile source, raw GitHub skill source fetch, CI deploy workflows | Expand | There is no user-owned GitHub repo sync yet. Add OAuth/account linking plus GitHub App repo sync. |
| Link/key sharing | Context links, API keys, access tokens, public profiles | Expand/modify | Add scoped stack sharing model with clearer trust and revocation. |
| Dashboard analytics/history | Profile views, bundle versions, rollback, analytics | Keep/expand | Add stack installs, sync events, route calls, and grant usage later. |
| Team/org bundles | Backlog/future | Defer | Useful after personal/private/public stack v1 works. |
| Marketplace/paid stacks | Backlog/future | Defer | Do not let monetization complicate v1 trust. |
| Custom You.md agent harness | Some You Agent surfaces exist, but no dedicated host runtime | Defer | Do not launch v1 around a custom harness. |
| Existing non-stack features | Features that do not perfectly match YouStacks framing | Remove-only-if-breaking | No removals recommended from this audit. |

## 4. Brain, Memory, Private Context, Project Context, Skills, Link, API, And CLI Audit

### Brain Boundary

Current brain sources:

- Hosted Convex data: profiles, bundles, sources, memories, private context, skills, chat history, agent activity, context links, API keys, vault.
- Local user bundle: `~/.youmd/config.json`, `you.md`, `you.json`, `manifest.json`, profile/preference/voice/directive/private files, skills, projects.
- Repo context: `AGENTS.md`, `CLAUDE.md`, `.you/`, `project-context/*`, and host-specific skill/rule surfaces.
- MCP resources: identity, markdown bundle, agent brief, project context, memories, skills, current project.

What works:

- You.md already has a credible brain layer and hosted/local split.
- `get_agent_brief` is the most direct current path to "agent starts with context."
- Project bootstrap already respects user-owned files with managed blocks.
- Skills already link into Claude Code, Codex, and Cursor.

Gaps:

- No first-class YouStack object, manifest, version, ownership, visibility, or install record.
- No stack-scoped grants. Current links are public/full and current API scopes are broad.
- Project-scoped sharing in UI appears mostly as a prompt/query convention, not a backend-enforced grant.
- Context link tokens are stored as raw tokens. Stack tokens should be hashed like API keys.
- Private context is field-rich but not permission-rich enough for shareable stacks.
- No conflict model between hosted DB state, local bundle files, repo files, and generated adapter files.
- No GitHub user-owned repo sync layer.

### Memory

Keep memories as the durable personal brain. Add stack-aware access:

- `memories:read:{category}`
- `memories:write:{category}`
- `memories:search`
- optional `project_memories:{projectSlug}`
- source attribution: stack id, host adapter, route id, tool id, token id, request id

Do not dump all memories into local stack files. Local agents can read local/static stack docs, then call You.md API/MCP for scoped memory retrieval.

### Private Context

Keep private context in the brain. Add field-level stack scopes:

- `private_context:notes:read`
- `private_context:projects:read`
- `private_context:links:read`
- `private_context:calendar:read`
- `private_context:communication:read`
- `private_context:custom:{key}:read`

Default v1 behavior should be deny-by-default. A public/open stack should never include private context by default.

### Project Context

Current project bootstrap is strong and should become stack-aware:

- Keep user-owned `AGENTS.md`, `CLAUDE.md`, `.cursor/rules`, and `project-context` as primary project truth.
- Keep `.you/` as generated supplemental context.
- Generate stack install maps and host adapter outputs into `.you/stacks` or a similarly managed directory.
- Never rewrite human-owned project instructions outside managed blocks.

### Skills

Current skills are valuable and should not be discarded. The shift is:

- A skill is one artifact type.
- A YouStack is a package that may include skills, workflows, prompts, commands, adapter files, docs, smoke tests, and capability declarations.
- Current bundled skills can become the default "personal YouStack starter" components.

### Links, Keys, And Sharing

Current primitives:

- Context links: good for quick context sharing, but too coarse for stack sharing.
- API keys: good for owner API/MCP use, but not ideal for friend/team scoped stack installs.
- Access tokens: good precedent for private profile access, but need more granular scopes.

YouStacks need new grant types:

- owner grant
- private install grant
- scoped teammate/friend token
- public/open read grant
- organization/team grant later
- revocation and activity log for every grant

### API And MCP

Current API/MCP is a good foundation. Add:

- stack manifest read/write
- stack capability map
- stack route endpoint
- stack grant creation/revocation
- stack install metadata
- stack smoke/preflight
- stack sync status
- GitHub connection/repo selection/sync endpoints

### CLI

Do not overload `youmd skill` into a stack system. Add a stack namespace:

```bash
youmd stack init
youmd stack create
youmd stack install <slug-or-url>
youmd stack link --hosts claude,codex,cursor
youmd stack capabilities [slug]
youmd stack route [slug] "..."
youmd stack smoke [slug]
youmd stack sync [slug]
youmd stack push [slug]
youmd stack pull [slug]
youmd stack share [slug]
youmd stack publish [slug]
youmd stack doctor [slug]
youmd stack upgrade [slug]
```

A later one-line alias can exist:

```bash
curl -fsSL https://you.md/youstack/install.sh | bash
```

But the first implementation can live behind the existing `youmd` CLI.

## 5. GStack Transfer Analysis

GStack is the primary external lighthouse because it proves a local-first agent operating system can feel native without a custom app.

What maps 1:1 to YouStacks:

- One-line install into host-native files.
- Host adapter registry for Claude Code, Codex, Cursor, and future hosts.
- Local skills as markdown operating manuals.
- Workflow routing through named skills/commands.
- Team/repo bootstrap without vendoring the full stack into every repo.
- Auto-update checks that are silent/failure-safe.
- A local helper CLI for install, relink, upgrade, doctor/smoke, and routing.
- Generated skill docs/templates so host-specific outputs stay in lockstep.
- Safety wrappers and read-only-first workflows.
- Self-review/release/docs discipline.

What changes because You.md is a personal brain:

- The stack cannot assume all useful context lives in local files.
- Private memories, identity, preferences, and connected tools need scoped authenticated retrieval.
- The manifest must declare which brain scopes it wants and why.
- Activity attribution matters more: host, stack, workflow, brain scope, and user grant should be logged.
- Repo sync is user-owned and identity-linked, not just a clone/update of a public tooling repo.
- The same stack should support private, shared, and public/open modes.

What should not be copied:

- GStack's exact software-team specialist taxonomy as the default You.md stack taxonomy.
- Claude-first assumptions where Codex/Cursor need different host-native surfaces.
- Browser/sidebar infrastructure as core v1. Useful later, not part of the first stack wedge.
- Giant preambles in every generated file when a capability manifest plus focused adapter text can do the job.
- Telemetry or update behavior that is not explicit and user-controlled.

## 6. BAMFStack Applied-Proof Analysis

BAMFStack is the closest internal proof pattern because it combines local stack files with a real product backend, REST API, MCP, docs, auth, and deterministic routing.

What maps 1:1 to YouStacks:

- One-line curl installer.
- Local skills/commands/prompts/helper CLI.
- Environment-only API key handling.
- Auto-upgrade through a version file and hosted installer.
- Read-only smoke test that validates REST, MCP, auth, capabilities, route, and expected tools.
- Capability discovery endpoint before choosing a workflow.
- Deterministic route endpoint for fuzzy natural-language requests.
- App/Stack/API/MCP parity.
- Docs-quality quickstart, authentication, MCP, workflows, examples, and generated references.
- Stack sync rule: when API/MCP changes, update stack files, docs, OpenAPI/reference, prompts, and tests together.

What changes because You.md is a personal brain:

- BAMF is product/tenant scoped. You.md is identity/brain scoped and may span many projects, repos, tools, and relationships.
- BAMF's creator-space boundary maps to You.md's `owner -> brain scopes -> project scopes -> stack grants`.
- BAMF's content actions map to You.md's memory/context/tool actions, many of which are more private than content drafts.
- BAMF can assume a known product API. YouStacks must be useful without custom per-stack APIs.
- BAMFStack protects product actions through API scopes and idempotency. YouStacks must also protect private IP and prompts by deciding what never ships locally.

What should not be copied:

- Requiring every YouStack to have a product-specific API/MCP.
- Assuming a single domain like creator content.
- Storing or printing keys locally beyond env/config references.
- Mutating the hosted brain before a read-only preflight proves the stack, token, host adapter, and route are valid.

## 7. YouStack Product Objects

Primary objects:

- Brain: hosted/local You.md identity, memory, preferences, private context, project context, skills, and connected tools.
- YouStack: a named portable execution package with local files plus optional protected service calls.
- Stack portfolio: the user's collection of separately named stacks for different domains such as coding, scientific research, content creation, investing, teaching, or project-specific operating systems.
- Stack manifest: machine-readable contract for name, slug, domain, aliases, tags, files, capabilities, adapters, grants, protected resources, docs, tests, improvement policy, update policy, and sync.
- Adapter: host-specific generated output for Claude Code, Codex, Cursor, OpenClaw, Hermes, Pi, etc.
- Grant: scoped authorization for a stack to read/write brain scopes or use shared You.md API/MCP.
- Install: a local or remote record that a stack was installed into a host/project.
- Repo sync binding: a GitHub repo/folder mapping for brain files, stacks, manifests, skills, and project context.
- Reference intelligence: local ignored clones of GStack, GBrain, Agent Scripts, and The Library plus generated task reports that keep YouStacks, the You.md brain, shared agent scripts, and stack catalogs aligned with the best current reference patterns.

## 8. Manifest Schema

File name:

```text
youstack.json
```

Minimum v1 schema:

```json
{
  "schemaVersion": "youstack/v1",
  "kind": "youstack",
  "id": "stk_...",
  "slug": "houston-personal",
  "name": "Houston Personal YouStack",
  "domain": "coding",
  "aliases": ["agent-start", "coding-copilot"],
  "tags": ["coding", "repo-startup", "review"],
  "version": "0.1.0",
  "description": "Portable execution context for local coding agents.",
  "owner": {
    "youmdUserId": "usr_...",
    "username": "houston",
    "displayName": "Houston Golden"
  },
  "visibility": "private",
  "compatibility": {
    "hosts": ["claude-code", "codex", "cursor"],
    "minYoumdCli": "0.7.0",
    "requiresYoumdApi": false,
    "requiresYoumdMcp": false
  },
  "brainScopes": [
    {
      "scope": "identity.public.read",
      "required": true,
      "reason": "Introduce the user to the host agent."
    },
    {
      "scope": "preferences.agent.read",
      "required": true,
      "reason": "Honor communication and coding preferences."
    },
    {
      "scope": "memories.search",
      "required": false,
      "reason": "Retrieve relevant memories only when the local files are insufficient."
    }
  ],
  "files": [
    {
      "path": "skills/youstack-start/SKILL.md",
      "type": "skill",
      "required": true,
      "checksum": "sha256:..."
    },
    {
      "path": "workflows/startup.md",
      "type": "workflow",
      "required": true,
      "checksum": "sha256:..."
    }
  ],
  "adapters": {
    "claude-code": {
      "files": [".claude/skills/youstacks/houston-personal/SKILL.md"],
      "bootstrap": "CLAUDE.md"
    },
    "codex": {
      "files": [".codex/skills/youstacks/houston-personal/SKILL.md"],
      "bootstrap": "AGENTS.md"
    },
    "cursor": {
      "files": [".cursor/rules/youstacks-houston-personal.md"],
      "bootstrap": ".cursor/rules"
    }
  },
  "capabilities": [
    {
      "id": "startup",
      "intent": "agent startup context",
      "workflow": "workflows/startup.md",
      "skill": "youstack-start",
      "localOnly": true,
      "mutationPolicy": "read_only"
    },
    {
      "id": "memory-search",
      "intent": "protected brain retrieval",
      "mcpTool": "you.search_memories",
      "apiEndpoint": "POST /api/v1/stacks/{stack_id}/brain/search",
      "requiredScopes": ["memories.search"],
      "mutationPolicy": "read_only"
    }
  ],
  "accessPolicy": {
    "defaultMode": "local_static",
    "protectedByDefault": true,
    "requiresApprovalFor": ["brain.write", "private_context.read", "connected_tool.write"]
  },
  "sharing": {
    "allowedModes": ["private", "scoped-link", "public-open"],
    "defaultMode": "private"
  },
  "repoSync": {
    "enabled": false,
    "provider": "github",
    "path": "youstacks/houston-personal"
  },
  "docs": {
    "quickstart": "docs/quickstart.md",
    "playbooks": ["docs/playbooks/startup.md"]
  },
  "tests": {
    "smoke": "tests/smoke.md"
  },
  "improvement": {
    "mode": "propose",
    "cadence": "after meaningful agent sessions",
    "signals": ["usage", "failures", "user corrections", "repo diffs", "smoke results"],
    "evals": ["youmd stack smoke", "golden prompt regression checks"],
    "appliesTo": ["skills", "subagents", "workflows", "examples", "docs", "adapters"],
    "approvalRequiredFor": ["brain.write", "private_context.read", "connected_tool.write", "remote_repo.write"]
  },
  "update": {
    "channel": "manual",
    "check": "youmd stack smoke",
    "source": "user-owned GitHub repo or local stack folder",
    "autoApply": false
  },
  "provenance": {
    "createdBy": "youmd",
    "createdAt": "2026-05-23T00:00:00Z",
    "source": "you.md"
  }
}
```

## 9. Repo Folder Layout

Preferred user-owned repo layout:

```text
you.md/
  README.md
  youmd.json
  brain/
    public/
      profile.md
      preferences.md
      voice.md
      directives.md
    private/
      README.md
      encrypted-or-redacted-placeholders.md
  projects/
    <project-slug>/
      project.md
      AGENTS.md
      TODO.md
      FEATURES.md
      CHANGELOG.md
  youstacks/
    coding-copilot/
      youstack.json
      README.md
      skills/
      workflows/
      subagents/
      improvement/
      evals/
    scientific-research/
      youstack.json
      README.md
      skills/
      workflows/
      subagents/
      improvement/
      evals/
    content-studio/
      youstack.json
      README.md
      CHANGELOG.md
      skills/
      workflows/
      prompts/
      commands/
      adapters/
        claude-code/
        codex/
        cursor/
        openclaw/
        hermes/
        pi/
      docs/
        quickstart.md
        api-mcp.md
        playbooks/
      examples/
      improvement/
      evals/
      tests/
        smoke.md
      protected.example.json
  manifests/
    stacks.index.json
    brain.index.json
```

Local install layout:

```text
~/.youmd/
  stacks/
    <stack-slug>/
      youstack.json
      files...
  grants/
    <stack-slug>.json
  adapters/
    claude-code/
    codex/
    cursor/
```

Repo/project generated layout:

```text
.you/
  AGENT.md
  STACK-MAP.md
  stacks/
    <stack-slug>/
      youstack.json
      install.json
      adapter-map.json
```

## 10. Access Model

The access model has four layers:

1. Local static files: safe to install and read locally.
2. Shared You.md API/MCP: authenticated calls for protected brain retrieval, sync, tokens, connected tools, and server-side actions.
3. Optional custom per-stack API/MCP: only for stacks with proprietary tools or domain-specific backend actions.
4. Later user-owned remote MCP/API deploys: future power-user/enterprise path.

Grant types:

- `owner`: full owner controls.
- `private_install`: user's own local install.
- `scoped_link`: friend/teammate token with stack-specific scopes and expiration.
- `public_open`: public read-only static stack package.
- `team`: deferred until org/team bundles are real.

Default approval policies:

- Local static reads: allowed.
- Public identity reads: allowed when stack visibility permits.
- Memory/private context reads: explicit grant required.
- Brain writes: explicit owner approval and scoped token required.
- Connected tool writes: explicit approval and idempotency required.
- Secret/proprietary prompt retrieval: never local by default; API/MCP only.

## 11. GitHub Sync Design

Current state:

- You.md can ingest GitHub as a source.
- You.md can fetch remote skill files from GitHub raw URLs.
- You.md has GitHub Actions for Convex deploy and CLI publishing.
- You.md does not currently have user-owned GitHub account/repo sync.

Decision:

- Use GitHub OAuth app/account linking for identity and lightweight "connect my GitHub account" onboarding if that is what Houston is setting up first.
- Prefer a GitHub App for repo sync operations.

Why GitHub App for repo sync:

- Official GitHub docs say GitHub Apps are generally preferred because they use fine-grained permissions, give users more control over repository access, and use short-lived tokens.
- GitHub Apps have centralized/built-in webhooks; OAuth Apps need repo/org webhook scopes and per-repo/org webhook setup.
- Installation access tokens can be limited to repositories and permissions, and expire after one hour.
- Users can select repositories during installation, which matches "choose or create a user-owned repo."
- Repo additions/removals can be tracked through installation/repository webhooks.

Minimum tables to add:

- `githubConnections`: user id, GitHub account id/login, OAuth or GitHub App user token metadata, created/updated/revoked.
- `githubAppInstallations`: installation id, account id/login/type, repository selection, permissions, events, suspended/revoked metadata.
- `githubRepos`: owner, repo, repo id, visibility, default branch, installation id, selected for You.md sync.
- `repoSyncBindings`: user id, repo id, branch, base path, enabled object types, last synced commit, last local/remote hash.
- `repoSyncEvents`: direction, status, commit sha, conflict status, changed paths, actor, error.

Repo sync flow:

1. User connects GitHub account.
2. User installs You.md GitHub App and selects repositories, or creates a new repo from You.md.
3. You.md writes an initial repo layout with manifests and generated docs.
4. You.md stores content hashes and commit sha for each synced object.
5. Webhooks notify You.md of repo changes.
6. Sync engine compares DB object version, local manifest hash, and repo file hash.
7. Conflicts produce a reviewable diff, never silent overwrite.
8. Hosted DB remains the availability/API/MCP copy; GitHub remains the user-owned portable source.

V1 sync content:

- public brain files
- selected preferences/directives
- YouStack manifests and local/static artifacts
- skills/workflows/prompts
- project context files
- docs/examples/tests
- redacted placeholders for private/protected data

Do not sync by default:

- raw private memories
- private context fields
- API keys or tokens
- connected account secrets
- proprietary prompts/tools that the user marks protected

## 12. Sharing Model

Sharing modes:

- Private: owner only.
- Scoped link/token: selected stack, selected scopes, TTL, max uses, optional recipient note.
- Public/open: static files and manifest are public; protected brain scopes are omitted or require owner-authenticated calls.
- Team/org: deferred.
- Paid/sellable: deferred.

V1 stack links should be separate from existing context links:

- Existing context links remain for "share my profile/context."
- Stack links become "install or inspect this stack with these exact scopes."
- Stack tokens should be hashed at rest and revocable.
- Every API/MCP use through a stack token should log stack id, host, route/tool, brain scope, and request id.

## 13. Adapter Design

Primary adapters:

### Claude Code

Outputs:

- `~/.claude/skills/youstacks/<stack-slug>/SKILL.md`
- optional slash commands in `~/.claude/commands`
- additive managed block in `CLAUDE.md`
- MCP registration command or config snippet

### Codex

Outputs:

- `~/.codex/skills/youstacks/<stack-slug>/SKILL.md`
- additive managed block in `AGENTS.md`
- MCP registration in `~/.codex/config.toml` through existing `youmd mcp --install codex`

### Cursor

Outputs:

- `.cursor/rules/youstacks-<stack-slug>.md`
- optional `.cursor/mcp.json`
- short rule file that points to the manifest/capability map instead of dumping everything.

Secondary adapters:

- OpenClaw: generate instruction artifacts that tell OpenClaw-spawned Claude/Codex sessions to load the right YouStack. Do not assume OpenClaw directly consumes all local skill formats.
- Hermes Agent: same pattern as OpenClaw unless native Hermes skills stabilize.
- Pi agents: define a compact startup/capability packet after primary adapters work.

Adapter rules:

- Host files must be generated from the same manifest.
- Adapters must be additive and managed-block-based.
- Adapters must state local-only vs protected API/MCP behavior.
- Adapters must avoid exposing private/proprietary prompts in local files.

## 14. API/MCP Threshold

### Works With Local Files Only

- Public/open stack manifest.
- Skills, prompts, commands, workflows, docs, examples, checklists.
- Public identity summary if the owner chose to include it.
- Host adapter files.
- Local route table for simple deterministic workflow routing.
- Read-only local smoke checks for file existence, manifest validity, adapter validity, and version.

### Uses Shared You.md API/MCP

- Scoped memory search/retrieval.
- Private context retrieval.
- Project context retrieval from hosted brain.
- Stack grant validation and revocation.
- Stack install/activity logs.
- GitHub sync.
- Hosted capability map when the local manifest may be stale.
- Protected prompt/tool retrieval.
- Connected account actions.
- Brain writes, memory saves, profile/private updates.

### Optional Custom Per-Stack API/MCP

- Proprietary domain workflows.
- Product-specific backend actions, like BAMF content creation.
- Custom organization tools.
- Stack-specific retrieval services.
- Paid/private stack logic.

### Later User-Owned Remote MCP/API Deploys

- User-owned remote stack services.
- Enterprise/team self-hosted MCP.
- Custom deployment templates.
- Bring-your-own cloud secrets and data residency.

## 15. Capability Map And Route Endpoint

YouStacks should copy the BAMF capability pattern, generalized for identity/context stacks.

REST:

```text
GET  /api/v1/stacks/{stack_id_or_slug}/capabilities
POST /api/v1/stacks/{stack_id_or_slug}/route
GET  /api/v1/stacks/{stack_id_or_slug}/manifest
POST /api/v1/stacks/{stack_id_or_slug}/smoke
```

Possible global aliases:

```text
GET  /api/v1/agent/capabilities
POST /api/v1/agent/route
```

MCP tools:

```text
you.get_stack_capabilities
you.route_stack_request
you.get_stack_manifest
you.smoke_stack
you.search_stack_brain
```

MCP resources:

```text
youmd://stacks
youmd://stacks/{slug}/manifest
youmd://stacks/{slug}/capabilities
youmd://agent/capabilities
```

Route response should include:

- stack id and version
- recommended capability/workflow
- local skill/adapter path
- REST endpoints and MCP tools
- required brain scopes
- mutation policy
- approval policy
- protected/local boundary
- reasons and alternatives

## 16. Helper CLI

The helper should start inside the existing CLI:

```bash
youmd stack capabilities
youmd stack route "start this repo with my preferences"
youmd stack smoke
youmd stack link --hosts claude,codex,cursor
youmd stack sync
```

Later alias:

```bash
youstack capabilities
youstack smoke
```

Helper behavior:

- Read local manifest first.
- Verify hosted manifest if a token is configured.
- Never print tokens.
- Prefer read-only validation before mutation.
- Emit host-specific next commands.
- Run update checks without blocking agent work.
- Treat stack and skill improvement as a policy-bound loop: observe safe signals, draft updates, run stack smoke/evals, apply only allowed local changes, and require approval for protected brain/private/connected-tool/remote-repo writes.

## 17. Smoke Test

V1 smoke test should be read-only:

- parse manifest
- verify schema version
- verify required files/checksums
- verify adapter target paths
- verify host config presence
- verify `youmd` CLI version
- verify MCP config if requested
- verify stack token without printing it
- fetch capabilities
- run deterministic route check
- dry-run protected brain retrieval with an empty or harmless query
- verify GitHub sync binding status if enabled

## 18. Reference Intelligence

The YouStacks/brain roadmap should be guided by daily local references:

- `garrytan/gstack` -> YouStacks execution layer: local-first skills, host adapters, upgrade flows, eval-first quality, QA/review/release workflows, and agent operating rules.
- `garrytan/gbrain` -> You.md brain layer: durable memory, context extraction, retrieval, provenance, sync, privacy/scopes, and agent startup contracts.
- `steipete/agent-scripts` -> shared agent runtime layer: canonical `AGENTS.MD`, terse skills, dependency-light scripts, validation hooks, repo-owned skill pointers, and downstream pointer rules.
- `disler/the-library` -> private catalog/distribution layer: reference-based skills/agents/prompts, typed dependencies, pull-on-demand installs, sync across devices/teams, and pure-agent cookbook operations.

Local mechanics:

```bash
npm run references:sync
```

Outputs:

- `.reference-repos/<owner>/<repo>` ignored local clones for all monitored upstream lighthouses.
- `project-context/reference-intelligence/LATEST.md` with commit summaries and candidate task synthesis.
- `project-context/reference-intelligence/TASKS.md` as the human review queue.

Rules:

- Reference repos are never vendored into You.md.
- Generated tasks are suggestions, not automatic scope.
- Promote only changes that make YouStacks or the You.md brain simpler, safer, more useful, or more agent-native.
- Do not copy large upstream files. Extract architecture patterns and implement them in the You.md style.
- report no writes performed

Product translation:

- GStack keeps YouStacks honest as an installable local agent operating system.
- GBrain keeps the brain layer honest as durable, private, retrievable context.
- Agent Scripts keeps the shared agent-script layer honest: a small canonical repo, pointer-style downstream rules, validation, and portable helpers.
- The Library keeps the distribution layer honest: private-first catalog, references instead of stale copies, typed dependencies, and agent-readable operations.

Near-term You.md implications:

- Add a stack/source catalog concept to YouStacks so skills, prompts, scripts, and sub-agents can point at canonical local paths or GitHub sources.
- Teach `youstack-maintainer` to prefer source pointers over copies when a repo owns a skill.
- Extend `youmd stack doctor` to warn about stale copied assets, missing typed dependencies, invalid skill front matter, and global-skill sprawl.
- Keep public/open stacks inspectable and forkable, but keep private catalogs, protected prompts, private memory, connected tools, and high-usage hosted services behind You.md API/MCP grants.

The smoke test should end with a plain statement equivalent to:

```text
Smoke passed. No brain data was modified, no connected tools were invoked, and no files outside managed adapter paths were changed.
```

## 18. Docs Quality Bar

You.md docs for YouStacks should reach the BAMF docs quality bar:

- Quickstart with one-line install.
- Starter prompts for Claude Code, Codex, and Cursor.
- Manifest reference.
- Adapter reference.
- API reference.
- MCP reference.
- Auth/token docs.
- Safety rules.
- Agent workflow golden path.
- Capability map and route examples.
- GitHub sync guide.
- Public/private sharing guide.
- Playbooks.
- Copyable examples.
- Generated endpoint/tool reference.
- Troubleshooting.
- Stack sync rule.

## 19. Stack Sync Rule

Whenever a YouStack-facing API/MCP/CLI/adapter behavior changes, update the matching artifacts in the same logical change:

- manifest schema/types
- `YOUSTACKS_IMPLEMENTATION_PLAN.md` or successor architecture doc when architecture changes
- docs quickstart
- docs API/MCP references
- generated endpoint/tool reference and OpenAPI output
- CLI help text
- MCP tool/resource descriptions
- default stack templates
- host adapter templates
- smoke tests
- examples/playbooks
- changelog

## 20. Implementation Phases

Each phase should be independently understandable and revertable.

### Phase 0: Planning And Audit

Status: this document.

Deliverables:

- YouStacks PRD saved.
- Current You.md feature inventory and classifications.
- Brain/private/memory/project/skill/link/API/CLI audit.
- GStack and BAMFStack transfer analysis.
- GitHub sync direction.
- First slice defined.

### Phase 1: Manifest And Local Read-Only Foundation

First PR-sized slice:

`docs: add YouStack manifest schema and read-only local smoke plan`

Recommended actual first implementation PR:

- Add TypeScript types or JSON schema for `youstack/v1`.
- Add a sample private personal YouStack manifest fixture.
- Add `youmd stack inspect` or `youmd stack smoke --local` behind read-only local file validation only.
- Add unit tests for manifest parsing and invalid manifests.
- Add docs quickstart stub and manifest reference.

Do not add sharing, GitHub sync, or brain retrieval in this first PR.

### Phase 2: Host Adapter Compiler

- Generate Claude Code, Codex, and Cursor adapter files from one manifest.
- Reuse existing managed-block and skill-linking patterns.
- Add `youmd stack link --hosts claude,codex,cursor`.
- Add fixture tests for generated adapter output.

### Phase 3: Shared Capability Map And Route

- Add capability map endpoint and MCP resource/tool.
- Add deterministic route endpoint and MCP tool.
- Wire local helper to fetch capabilities/route.
- Keep all routes read-only in this phase.

### Phase 4: Stack Grants And Protected Brain Retrieval

- Add stack grants/tokens with hashed storage.
- Add field/category-level brain scopes.
- Add read-only memory/private/project retrieval through API/MCP.
- Log every stack-scoped access.

### Phase 5: GitHub Account Link And Repo Sync

- Add GitHub account connection.
- Add GitHub App installation/repo selection.
- Add repo sync tables and read/write sync engine.
- Add webhook handling.
- Add conflict review instead of silent overwrite.

### Phase 6: Private/Public Sharing

- Add stack share links/tokens.
- Add public/open stack rendering and install instructions.
- Add revocation, activity, and preview-as-agent.
- Keep paid/sellable stacks deferred.

### Phase 7: Docs And Examples To BAMF Quality

- Publish full YouStacks docs.
- Add generated endpoint/tool references.
- Add golden path playbooks.
- Add starter prompts for all primary hosts.
- Add troubleshooting and safety pages.

### Phase 8: Secondary Hosts

- Add OpenClaw artifacts.
- Add Hermes artifacts.
- Add Pi agent startup/capability packet.
- Add host-specific tests.

### Phase 9: Optional Custom API/MCP Extensions

- Add optional per-stack protected tools.
- Add custom per-stack API/MCP registration.
- Keep user-owned remote deployments as a later separate track.

## 21. Risks And Guardrails

Risks:

- Local stack files can leak private IP if proprietary prompts or private memories are written into them.
- Full-context links are too coarse for stack sharing.
- Repo sync can overwrite user-owned context if conflict handling is weak.
- OAuth-only GitHub sync would likely over-request repo access or make webhook handling messy.
- A custom agent harness would distract from the immediate wedge.
- If docs drift from CLI/API/MCP, agents will route incorrectly.

Guardrails:

- Default local packages to public/static only.
- Put protected retrieval behind authenticated You.md API/MCP.
- Store stack tokens hashed, not plaintext.
- Add field-level private context grants before exposing private context.
- Make repo sync reviewable and hash-based.
- Keep generated blocks clearly marked.
- Keep smoke tests read-only until the stack proves trust.
- Keep custom harness, paid marketplace, and user-owned remote MCP deploys out of v1.

## 22. What To Keep, Repurpose, Expand, Modify, Defer

Keep:

- identity protocol
- public profiles and bundles
- memory brain
- private context
- vault
- dashboard shell and panes
- CLI personality and existing command set
- current skills
- current API/MCP surfaces
- context links and API keys for their current jobs

Repurpose:

- `.you/` project bootstrap into stack install metadata
- `get_agent_brief` into stack-aware boot packet
- skill system into stack artifact system
- access tokens into a better scoped grant design
- docs generator into stack API/MCP docs

Expand:

- CLI with `youmd stack`
- MCP/API with stack manifest/capability/route/smoke/grants
- dashboard share/settings/agents/skills with stack management
- docs to BAMF quality
- GitHub from source ingestion into user-owned repo sync

Modify:

- context sharing from public/full to stack-scoped grants
- private context exposure from coarse to field-level
- marketing/docs language to separate brain from stacks
- onboarding to offer stack creation without making forms

Defer:

- paid/sellable stacks
- custom You.md-branded agent harness
- team/org bundles
- secondary hosts until primary hosts work
- custom per-stack API/MCP baseline
- user-owned remote MCP/API deployments

Remove-only-if-breaking:

- any existing You.md feature that does not perfectly fit the YouStacks framing.

No removals are recommended in this planning pass.
