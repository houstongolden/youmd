# `you.md`

**Your agent brain and named expertise stacks for the agent internet.**

Install once. Every agent can load your brain, memory, preferences, project context, and the named YouStacks of skills/workflows you want it to use. Public profile + private brain + stacks + runtime + protected API/MCP.

No more re-explaining yourself. No more starting from scratch.

```
you.md/houston
```

---

## What This Is

Every AI agent asks the same questions. Who are you? What do you do? How do you want me to talk?

You.md is the answer. A structured brain and stack layer that agents consume directly. Written in `.md` -- the native format of agent instructions. Served via API/MCP when protected access is needed. Readable by anything.

```
agent.md  -- the agent's instructions
soul.md   -- the agent's identity
you.md    -- the human's identity
```

You.md completes the handshake.

Public profile. Private vault. Skills system. Memory brain. Project context. Version-controlled. Content-addressed. One source of truth for your digital identity.

---

## Quick Start

```bash
curl -fsSL https://you.md/install.sh | bash
```

That installs the You.md runtime. The `you` command is the primary local interface; `youmd` remains the npm package and compatibility alias. Users should think "one curl install, then U and my agents know my brain/stacks." Then:

```bash
you login                # press Enter for browser sign-in, or type your email for a code
you init                 # build your agent brain interactively
you                     # meet U — portrait, proactive context scan, live chat
you stack doctor --path cli/examples/youstack-personal
you stack smoke --path cli/examples/youstack-personal
you push                 # publish to you.md/<username>
you skill init-project   # wire your brain and stacks into the current repo
you link create          # generate a shareable context link
```

The installer also writes `~/.you/bin/youmd-auto-upgrade` so host agents can refresh the runtime before stack work.

To enable the resident macOS sync daemon during install:

```bash
curl -fsSL https://you.md/install.sh | YOU_INSTALL_DAEMON=1 bash
```

You can also enable it later with `you stack daemon install`. It keeps identity/API sync, shared skills/stacks, and safe project-context files fresh in the background without syncing secrets or arbitrary app code.

---

## For Agents

If you are an agent landing on this repo, start with the generated docs surfaces before guessing from README snippets:

```bash
curl https://you.md/llms.txt
curl https://you.md/llms-full.txt
curl https://you.md/api/v1/docs/reference
curl https://you.md/api/v1/docs/openapi.json
curl https://you.md/.well-known/mcp.json
curl https://you.md/api/v1/stacks/capabilities
```

Release and drift checks:

```bash
npm run docs:check
npm run agent-docs:syntax
npm run agent-docs:handoff
npm run agent-docs:handoff:json
npm run agent-docs:lint
npm run llms:smoke -- --base-url https://www.you.md
npm run sync:graph:smoke
npm run sync:agent-stack:smoke
npm run agent-docs:ci
```

`/llms.txt` is the short handoff. `/llms-full.txt` is the full context pack with docs, API, MCP, stack runtime, privacy boundaries, smoke checks, and upstream reference-intelligence links.

---

## CLI Commands

21 top-level commands. The `skill` command alone has 18 core subcommands plus aliases.

| Command | What It Does |
|---|---|
| `you init` | Build your agent brain via AI conversation |
| `you` | Meet U in the terminal — portrait, proactive context scan, live chat |
| `you login` | Authenticate (Enter for browser sign-in, email code, or `--key`) |
| `you logout` | Clear local authentication on this machine |
| `you register` | Claim a username |
| `you whoami` | Show current authenticated user |
| `you build` | Compile bundle from local profile/ and preferences/ files |
| `you publish` | Push compiled bundle to the platform |
| `you push` | Upload local `.you/` files and publish (with version control) |
| `you pull` | Download your profile from you.md to local files |
| `you sync` | Pull + push. `--watch` for auto-sync on file changes |
| `you diff` | Show changes between local bundle and published version |
| `you export` | Export to you.json and/or you.md (`--json`, `--md`, `-o path`) |
| `you add <src> <url>` | Add a source (website, linkedin, x, blog, youtube, github) |
| `you status` | Show pipeline/build status |
| `you preview` | Local preview server on port 3333 |
| `you chat` | Explicit long-form chat path; `you` is the main entry |
| `you memories` | Manage your memory brain (list, add, stats) |
| `you private` | Manage private context (notes, links, projects) |
| `you project` | Manage project agent context (init, list, show, memories) |
| `you skill` | Brain-aware agent skills (18 core subcommands -- see below) |
| `you stack` | Local YouStack manifests (inspect, doctor, smoke, capabilities, route, link) |
| `you link` | Context links (create, list, revoke, preview) |
| `you keys` | API key management (list, create, revoke) |

### `you skill` Subcommands

| Subcommand | What It Does |
|---|---|
| `list` | Show all skills with install status |
| `install <name\|all>` | Install from catalog or registry |
| `remove <name\|all>` | Remove installed skill(s) |
| `use <name>` | Run a skill with brain interpolation |
| `sync` | Re-render all skills against live identity |
| `create [name]` | Scaffold a new custom skill |
| `add <name> <source>` | Register a skill in the catalog |
| `push <name>` | Push local changes back to source |
| `link <agent>` | Link skills to claude / cursor / codex |
| `init-project` | AGENTS/CLAUDE bootstrap + project-context/ + .you/ + Claude/Codex skill links |
| `improve` | Review metrics, find gaps, propose changes |
| `metrics` | Usage stats and identity field coverage |
| `search <query>` | Search skills by name or description |
| `browse` | Browse the public skill registry |
| `publish <name>` | Publish a skill to the registry |
| `remote` | Show skills synced to your you.md account |
| `export [dir]` | Export all installed skills to a directory |
| `info <name>` | Detailed info, metrics, and content preview |

### `you project` Subcommands

| Subcommand | What It Does |
|---|---|
| `init [name]` | Initialize a new project (auto-detects from cwd) |
| `list` | List all projects |
| `show [name]` | Show project details and private notes |
| `memories <name>` | List project memories |
| `remember <name> <cat> <msg>` | Add a memory to a project |
| `edit <name> <file>` | Open a project file for editing |

---

## Bundle Structure

Your identity lives in `~/.you/`, with legacy `~/.youmd/` read during migration. Every file is markdown or JSON. No proprietary formats.

```
.you/
  config.json              # Auth, username, sources
  you.md                   # Human-readable compiled identity
  you.json                 # Machine-readable compiled bundle
  manifest.json            # Directory map + content hashes

  profile/                 # Who you are
    about.md               # Bio, tagline, headline
    now.md                 # Current focus
    projects.md            # What you're building
    values.md              # Principles and worldview
    links.md               # Website, socials, repos

  preferences/             # How agents should behave
    agent.md               # Agent interaction rules
    writing.md             # Writing style and tone

  voice/                   # How you sound (AI-analyzed)
    overall.md             # General voice profile
    writing.md             # Written voice characteristics
    speaking.md            # Speaking patterns

  directives/              # Rules agents must follow
    agent.md               # Hard constraints on agent behavior

  private/                 # Private context (not published)
    notes.md               # Personal notes
    links.json             # Internal bookmarks
    projects.json          # Private project list

  skills/                  # Installed brain-aware skills
    voice-sync/
      SKILL.md             # Template with {{var}} placeholders
      RENDERED.md           # Rendered with your brain context

  projects/                # Per-project agent context
    my-project/
      project.json         # Metadata
      context/             # PRD, TODO, features, changelog, decisions
      agent/               # Instructions, preferences, memory
      private/             # Project-scoped private notes
```

---

## Skill System

Skills are brain-aware markdown templates. They use `{{var}}` interpolation to inject your preferences, voice, projects, and stack context into agent instructions.

```markdown
---
name: voice-sync
version: 1.0.0
scope: shared
identity_fields: [voice.overall, voice.writing, voice.speaking]
---

# voice-sync

Keep your voice in sync across every agent tool.

## Brain Context

- **Overall voice:** {{voice.overall}}
- **Writing voice:** {{voice.writing}}
```

When you run `you skill use voice-sync`, every `{{var}}` resolves against your live brain data.

### Bundled Skills

| Skill | What It Does |
|---|---|
| `youstack-start` | Start local agents with brain context, project state, active requests, skills, and next moves |
| `youstack-maintainer` | Organize, update, safely improve, and publish private-by-default YouStacks |
| `machine-bootstrap` | Set up a fresh computer with You.md auth, skills, stacks, GitHub, and active project repos |
| `voice-sync` | Propagate your voice profile to Claude, Codex, Cursor, and custom agents |
| `claude-md-generator` | Bootstrap repo-visible agent instructions with your brain context |
| `project-context-init` | Scaffold project-context/ with your preferences baked in |
| `meta-improve` | Analyze your skill setup, find gaps, propose improvements |
| `proactive-context-fill` | Detect thin brain context and propose safe additive improvements |
| `you-logs` | Show recent agent activity and brain access inline |

### How Skills Work

1. **Install** -- `you skill install voice-sync`
2. **Use** -- renders the template against your brain context: `you skill use voice-sync`
3. **Sync** -- when your brain changes, `you skill sync` re-renders everything
4. **Link** -- `you skill init-project` wires Claude + Codex by default, or use `you skill link claude` / `you skill link codex` directly
5. **Publish** -- share your custom skills to the registry: `you skill publish my-skill`
6. **Browse** -- find skills others have published: `you skill browse`

Variable resolution follows dot notation: `voice.overall` reads `~/.you/voice/overall.md`. Works for `profile.*`, `preferences.*`, `voice.*`, `directives.*`, and `project_name`.

---

## YouStacks

YouStacks are named packages of your expertise: skills, sub-agents, workflows, prompts, examples, tests, docs, host adapters, update rules, and protected brain/API/MCP boundaries.

Think "your own GStack." You can keep a private coding stack, a private scientific research stack, a private content stack, and a public/open BAMFStack-style lighthouse stack without blending the skills or memory scopes together.

A copied stack freezes at copy time. Yours stays current — every stack re-renders against your live brain.

```bash
curl -fsSL https://you.md/install.sh | bash
you stack inspect --path cli/examples/youstack-personal
you stack doctor --path cli/examples/youstack-bamfstack-public
you stack smoke --path cli/examples/youstack-bamfstack-public
you skill use youstack-maintainer
```

Defaults:

- Stacks are private unless you explicitly share or publish them.
- Public stacks should expose reusable skills/docs/examples, not private memories, secrets, proprietary prompts, or connected actions.
- Safe self-improvement updates local skills/workflows/docs/tests together and runs smoke checks.
- Protected memory, tokens, repo sync, private context, and connected tools go through shared You.md API/MCP.
- Generated adapters and startup helpers should sanitize cached shell-facing identifiers before use, not trust previously written cache files.
- Repo names, branch names, and other stack/runtime metadata should stay local unless a hosted surface explicitly documents otherwise.
- Protected brain or stack-aware reads should report honest readiness states such as `not built`, `indexing`, or `ready`, rather than bluffing with silent empty results.
- Retrieval should degrade toward a narrower fallback path before silence: keyword/basic context is better than a blank answer when richer retrieval is temporarily unavailable.

### Upstream Inspiration

You.md is built in the open-agent tradition: local-first, inspectable, portable, and useful inside the tools builders already use.

Hat tip to the projects shaping this architecture:

- [GStack](https://github.com/garrytan/gstack) for the installable agent operating-system pattern.
- [GBrain](https://github.com/garrytan/gbrain) for the shared brain/memory separation.
- [Agent Scripts](https://github.com/steipete/agent-scripts) for canonical shared agent rules, skills, scripts, hooks, and pointer-style repo setup.
- [The Library](https://github.com/disler/the-library) for private-first catalogs of skills, agents, prompts, source references, and typed dependencies.

You.md's bet: keep the brain, stack runtime, skills, and public stack examples mostly open and forkable; charge or gate only where hosted infrastructure matters, such as protected retrieval, sync, publishing, grants, connected tools, higher usage limits, and future agent-platform surfaces.

---

## How It Works

```
you init                 # AI conversation builds your agent brain
you push                 # Publish to you.md/<username> (content-addressed, version-controlled)
you skill init-project   # Wire brain + stacks into current repo (AGENTS/CLAUDE + project-context/ + .you/ + Claude/Codex skills)
you link create          # Generate shareable context link for other agents
```

Brain changes propagate. Run `you push` and your published profile updates. Run `you skill sync` and every agent tool gets the latest you.

Push/pull uses content-addressed hashing for conflict detection. If the remote has changes you haven't pulled, push returns a 409 and tells you to pull first. Git-like safety without the git.

---

## API

All endpoints live at `https://you.md/`.

### Public (no auth)

```bash
# Get profile as JSON
curl https://you.md/api/v1/profiles?username=houston

# Get profile as markdown
curl -H "Accept: text/markdown" https://you.md/api/v1/profiles?username=houston

# List all public profiles
curl https://you.md/api/v1/profiles

# Check username availability
curl https://you.md/api/v1/check-username?username=houston

# Resolve a context link
curl https://you.md/ctx?token=abc123def456

# Browse the skill registry
curl https://you.md/api/v1/skills

# Get a specific skill
curl https://you.md/api/v1/skills?name=voice-sync
```

### Authenticated (Bearer token)

```bash
# Your profile
GET    /api/v1/me

# Bundle management (content-addressed version control)
POST   /api/v1/me/bundle          # Save bundle (supports parentHash for conflict detection)
POST   /api/v1/me/publish          # Publish latest bundle

# Sources
GET    /api/v1/me/sources
POST   /api/v1/me/sources

# Pipeline
POST   /api/v1/me/build
GET    /api/v1/me/build/status

# Analytics
GET    /api/v1/me/analytics

# Context links
GET    /api/v1/me/context-links
POST   /api/v1/me/context-links
DELETE /api/v1/me/context-links

# API keys
GET    /api/v1/me/api-keys
POST   /api/v1/me/api-keys
DELETE /api/v1/me/api-keys

# Memories
GET    /api/v1/me/memories
POST   /api/v1/me/memories

# Private context
GET    /api/v1/me/private
POST   /api/v1/me/private

# Skills
GET    /api/v1/me/skills           # Your installed skills
POST   /api/v1/me/skills           # Publish a skill to the registry
POST   /api/v1/me/skills/install   # Record a skill install
POST   /api/v1/me/skills/usage     # Track skill usage
POST   /api/v1/me/skills/remove    # Remove a skill install

# Enrichment
POST   /api/v1/scrape              # Scrape a social profile
POST   /api/v1/research            # AI research via Perplexity
POST   /api/v1/enrich-linkedin     # Full LinkedIn enrichment (profile + posts + voice)
POST   /api/v1/enrich-x            # X/Twitter enrichment via Grok
POST   /api/v1/verify-identity     # Cross-reference verification
```

### Auth

```bash
POST   /api/auth/send-verification # Start passwordless login/signup
POST   /api/auth/verify-code       # Verify code, establish session, optionally issue API key
POST   /api/v1/chat                # Onboarding chat proxy
POST   /api/v1/chat/stream         # Streaming chat via SSE
```

---

## Tiers

| | Free | Pro (coming soon) |
|---|---|---|
| Full identity bundle | yes | yes |
| Public profile page | yes | yes |
| CLI access (all commands) | yes | yes |
| Skills (install + use) | 8 bundled | unlimited + registry |
| API (read:public) | 1 key | unlimited keys, all scopes |
| Context links | public scope | public + full scope |
| Private vault | local only | synced + encrypted |
| Analytics | basic | full (agent reads, referrers) |
| Rate limits | standard | elevated |

---

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev:frontend    # Next.js on port 3100
npx convex dev          # Convex backend (separate terminal)

# Build CLI
cd cli && npm run build

# Publish CLI through npm Trusted Publishing
npm run publish:cli
```

CLI publishing is handled by `.github/workflows/publish-cli.yml` using npm Trusted Publishing.
Configure npm package `youmd` with GitHub Actions trusted publisher:
owner `houstongolden`, repo `youmd`, workflow filename `publish-cli.yml`.

Agent-readable docs are generated and drift-checked:

```bash
npm run docs:generate
npm run docs:check
npm run agent-docs:syntax
npm run agent-docs:handoff
npm run agent-docs:handoff:json
npm run agent-docs:lint
npm run llms:smoke -- --base-url https://www.you.md
npm run agent-docs:ci
```

`.github/workflows/agent-docs.yml` runs the agent-docs CI guardrail on path-scoped pushes and pull requests.

---

## Links

- **Website:** [you.md](https://you.md)
- **npm:** [youmd](https://www.npmjs.com/package/youmd)
- **GitHub:** [houstongolden/youmd](https://github.com/houstongolden/youmd)

---

MIT. Built by [Houston Golden](https://houstongolden.com).
