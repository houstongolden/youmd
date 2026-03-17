# `you.md`

**Your identity file for the agent internet.**

Claim your username. Build your profile from the CLI. Instantly give every AI agent on earth the context to know you, work with you, and represent you accurately.

```
you.md/houston
```

## The Problem

Every time you use a new AI tool, you re-explain yourself. Your tone, your role, your projects, your preferences — all rebuilt from scratch. And when someone else's agent needs to reference you, it pieces together an answer from training data and scraped web pages. No canonical source. No control.

## The Solution

You.md is a structured, portable identity bundle that agents can consume directly. Written in `.md` — the native format of agent instructions. Served via API endpoints designed for retrieval-augmented generation.

```
agent.md  — the agent's instructions
soul.md   — the agent's identity
you.md    — the human's identity
```

You.md completes the handshake.

## Quick Start

### CLI

```bash
npm install -g youmd

youmd init          # Create a local identity bundle
youmd build         # Compile your bundle
youmd publish       # Push to you.md/<username>
```

### Web

Visit [you.md](https://you.md) to claim your username and build your profile through the web editor.

## How It Works

1. **Claim** your username at `you.md/<yourname>`
2. **Build** your identity bundle — bio, projects, values, agent preferences
3. **Share** via URL, context link, or API. Any agent can read your `you.json` instantly

## Open Spec: `you-md/v1`

Every identity is a directory-based bundle:

```
you/
├── you.md              # Human-readable entry file
├── you.json            # Machine-readable compiled output
├── manifest.json       # Directory map + permissions
├── profile/            # Bio, now, projects, values, links
├── preferences/        # Agent tone, writing style, formatting
├── analysis/           # Voice profile, topic map, bio variants
└── private/            # Encrypted context (Pro)
```

## CLI Commands

```
youmd init              Initialize a local .youmd/ bundle
youmd login             Authenticate with you.md
youmd register          Claim a username
youmd build             Compile bundle from local files
youmd publish           Push bundle to you.md/<username>
youmd add <src> <url>   Add a source (website, linkedin, x, etc.)
youmd status            Show build/pipeline status
youmd diff              Show changes since last publish
youmd preview           Preview profile locally
youmd link create       Create a shareable context link
youmd keys create       Create an API key
youmd whoami            Show current user
```

## API

```bash
# Public profile (JSON)
curl https://you.md/api/v1/profiles?username=houston

# Public profile (Markdown)
curl -H "Accept: text/markdown" https://you.md/api/v1/profiles?username=houston

# Context link
curl https://you.md/ctx?token=abc123def456
```

## Tech Stack

- **Frontend:** Next.js 16, Tailwind CSS v4, TypeScript
- **Backend:** Convex (reactive, serverless, TypeScript-native)
- **Auth:** Clerk
- **LLM Pipeline:** OpenRouter (Claude Sonnet for extraction + analysis)
- **Scraping:** Native fetch + Apify (LinkedIn, X)
- **CLI:** TypeScript, Commander, published as `youmd` on npm

## Tiers

| | Free | Pro ($12/mo) |
|---|---|---|
| Profile page | yes | yes |
| CLI access | yes | yes |
| Pipeline runs | 3 total | 10/month |
| BYOK (own API keys) | no | unlimited |
| Private vault | no | yes |
| API keys | 1 (read:public) | unlimited, all scopes |
| Context links | public only | public + full |

## Project Structure

```
src/app/                Next.js App Router pages
src/app/[username]/     Public profile pages
src/app/dashboard/      Authenticated editor
src/app/claim/          Username claim flow
convex/                 Backend (schema, queries, mutations, actions)
convex/pipeline/        Ingestion pipeline (fetch, extract, analyze, compile)
cli/                    CLI package (published as youmd on npm)
project-context/        PRD, progress tracking
```

## Development

```bash
# Install dependencies
npm install

# Start dev server (frontend + backend)
npm run dev:frontend    # Next.js on port 3000
npx convex dev          # Convex backend (separate terminal)

# Build CLI
cd cli && npm run build
```

## License

MIT

---

Built by [Houston Golden](https://houstongolden.com). Identity as code.
