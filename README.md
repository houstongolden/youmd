# `you.md`

**Identity context protocol for the agent internet -- an MCP where the context is you.**

Your identity context protocol. One bundle. Every agent on earth knows who you are, how you work, and what you sound like. Public profile + private file system + skills + API.

No more re-explaining yourself. No more starting from scratch.

```
you.md/houston
```

---

## What This Is

Every AI agent asks the same questions. Who are you? What do you do? How do you want me to talk?

You.md is the answer. A structured, portable identity bundle that agents consume directly. Written in `.md` -- the native format of agent instructions. Served via API. Readable by anything.

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
npx youmd init
```

That's it. An AI conversation builds your identity bundle interactively -- bio, projects, values, voice, agent preferences. No forms. Just a conversation.

```bash
youmd login              # press Enter for browser sign-in, or type your email for a code
youmd push               # publish to you.md/<username>
youmd skill init-project # wire your identity into the current repo
youmd link create        # generate a shareable context link
```

---

## CLI Commands

21 top-level commands. The `skill` command alone has 18 core subcommands plus aliases.

| Command | What It Does |
|---|---|
| `youmd init` | Build your identity via AI conversation |
| `youmd login` | Authenticate (Enter for browser sign-in, email code, or `--key`) |
| `youmd register` | Claim a username |
| `youmd whoami` | Show current authenticated user |
| `youmd build` | Compile bundle from local profile/ and preferences/ files |
| `youmd publish` | Push compiled bundle to the platform |
| `youmd push` | Upload local .youmd/ files and publish (with version control) |
| `youmd pull` | Download your profile from you.md to local files |
| `youmd sync` | Pull + push. `--watch` for auto-sync on file changes |
| `youmd diff` | Show changes between local bundle and published version |
| `youmd export` | Export to you.json and/or you.md (`--json`, `--md`, `-o path`) |
| `youmd add <src> <url>` | Add a source (website, linkedin, x, blog, youtube, github) |
| `youmd status` | Show pipeline/build status |
| `youmd preview` | Local preview server on port 3333 |
| `youmd chat` | Talk to the You Agent -- update profile, add sources, ask questions |
| `youmd memories` | Manage your memory brain (list, add, stats) |
| `youmd private` | Manage private context (notes, links, projects) |
| `youmd project` | Manage project agent context (init, list, show, memories) |
| `youmd skill` | Identity-aware agent skills (18 core subcommands -- see below) |
| `youmd link` | Context links (create, list, revoke, preview) |
| `youmd keys` | API key management (list, create, revoke) |

### `youmd skill` Subcommands

| Subcommand | What It Does |
|---|---|
| `list` | Show all skills with install status |
| `install <name\|all>` | Install from catalog or registry |
| `remove <name\|all>` | Remove installed skill(s) |
| `use <name>` | Run a skill with identity interpolation |
| `sync` | Re-render all skills against live identity |
| `create [name]` | Scaffold a new custom skill |
| `add <name> <source>` | Register a skill in the catalog |
| `push <name>` | Push local changes back to source |
| `link <agent>` | Link skills to claude / cursor / codex |
| `init-project` | AGENTS/CLAUDE bootstrap + project-context/ + .you/ + links |
| `improve` | Review metrics, find gaps, propose changes |
| `metrics` | Usage stats and identity field coverage |
| `search <query>` | Search skills by name or description |
| `browse` | Browse the public skill registry |
| `publish <name>` | Publish a skill to the registry |
| `remote` | Show skills synced to your you.md account |
| `export [dir]` | Export all installed skills to a directory |
| `info <name>` | Detailed info, metrics, and content preview |

### `youmd project` Subcommands

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

Your identity lives in `~/.youmd/`. Every file is markdown or JSON. No proprietary formats.

```
.youmd/
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

  skills/                  # Installed identity-aware skills
    voice-sync/
      SKILL.md             # Template with {{var}} placeholders
      RENDERED.md           # Rendered with your identity

  projects/                # Per-project agent context
    my-project/
      project.json         # Metadata
      context/             # PRD, TODO, features, changelog, decisions
      agent/               # Instructions, preferences, memory
      private/             # Project-scoped private notes
```

---

## Skill System

Skills are identity-aware markdown templates. They use `{{var}}` interpolation to inject your identity into agent instructions.

```markdown
---
name: voice-sync
version: 1.0.0
scope: shared
identity_fields: [voice.overall, voice.writing, voice.speaking]
---

# voice-sync

Keep your voice in sync across every agent tool.

## Identity Context

- **Overall voice:** {{voice.overall}}
- **Writing voice:** {{voice.writing}}
```

When you run `youmd skill use voice-sync`, every `{{var}}` resolves against your live identity data.

### Bundled Skills

| Skill | What It Does |
|---|---|
| `voice-sync` | Propagate your voice profile to Claude, Cursor, and custom agents |
| `claude-md-generator` | Bootstrap repo-visible agent instructions with your identity context |
| `project-context-init` | Scaffold project-context/ with your preferences baked in |
| `meta-improve` | Analyze your skill setup, find gaps, propose improvements |
| `proactive-context-fill` | Detect thin identity context and propose safe additive improvements |
| `you-logs` | Show recent agent activity and identity access inline |

### How Skills Work

1. **Install** -- `youmd skill install voice-sync`
2. **Use** -- renders the template against your identity: `youmd skill use voice-sync`
3. **Sync** -- when your identity changes, `youmd skill sync` re-renders everything
4. **Link** -- `youmd skill link claude` wires rendered skills into `.claude/skills/youmd/`
5. **Publish** -- share your custom skills to the registry: `youmd skill publish my-skill`
6. **Browse** -- find skills others have published: `youmd skill browse`

Variable resolution follows dot notation: `voice.overall` reads `~/.youmd/voice/overall.md`. Works for `profile.*`, `preferences.*`, `voice.*`, `directives.*`, and `project_name`.

---

## How It Works

```
youmd init               # AI conversation builds your identity
youmd push               # Publish to you.md/<username> (content-addressed, version-controlled)
youmd skill init-project # Wire identity into current repo (AGENTS/CLAUDE + project-context/ + .you/ + links)
youmd link create        # Generate shareable context link for other agents
```

Identity changes propagate. Run `youmd push` and your published profile updates. Run `youmd skill sync` and every agent tool gets the latest you.

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
| Skills (install + use) | 6 bundled | unlimited + registry |
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
npm run dev:frontend    # Next.js on port 3000
npx convex dev          # Convex backend (separate terminal)

# Build CLI
cd cli && npm run build
```

---

## Links

- **Website:** [you.md](https://you.md)
- **npm:** [youmd](https://www.npmjs.com/package/youmd)
- **GitHub:** [houstongolden/youmd](https://github.com/houstongolden/youmd)

---

MIT. Built by [Houston Golden](https://houstongolden.com).
