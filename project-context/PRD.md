# PRD: You.md

**Identity as Code**

Founder: Houston Golden
Package: `youmd`
Status: Pre-Build
Last Updated: 2026-03-02
PRD Version: 2.0

## 15. Visual & Brand System

### 15.1 Brand Concept

**Visual metaphor: Ascension.**

A human figure being drawn upward into a ring of light — identity captured, structured, and shared with a higher intelligence. This is the core brand image. It communicates:

- Your identity is *elevated*, not just stored
- There's something almost spiritual about making yourself legible to AI — it's a new kind of self-knowledge
- The process is warm and human, not cold and technical
- You're choosing to share yourself, not being surveilled

The tone is: **optimistic sci-fi meets calm confidence.** Think Arrival, not Terminator. The imagery says "first contact" — a human meeting a higher intelligence halfway, on their own terms.

### 15.2 Color System

Derived from the hero gradient — warm human tones at the base, ascending into cool ethereal tones:

| Token | Value | Usage |
|---|---|---|
| `--coral` | `#E8857A` | Warm accent, CTAs, human-side elements |
| `--blush` | `#F0A898` | Secondary warm, hover states, soft highlights |
| `--sky` | `#7ABED0` | Primary brand blue, mid-gradient, links |
| `--ether` | `#B8D8E8` | Light UI surfaces, card backgrounds |
| `--gold` | `#F4D78C` | Premium accent, Pro features, verified badges, light source |
| `--light` | `#FFF8E7` | Ethereal glow, highlights, focal points |
| `--void` | `#0A0E1A` | Deep background, text on light surfaces |
| `--ink` | `#1A1F2E` | Secondary dark, card backgrounds in dark mode |
| `--mist` | `#8899AA` | Muted text, secondary labels, borders |

**The gradient direction matters:** warm (coral, blush) at the bottom → cool (sky, ether) in the middle → luminous (gold, light) at the top. This mirrors the hero image and the product metaphor: grounded human identity ascending toward agent intelligence.

**Dark mode is default** — the product lives in the sky/void space. Light mode inverts but preserves the warmth.

### 15.3 Typography

| Element | Font | Weight | Notes |
|---|---|---|---|
| Logo / brand mark | Monospace (e.g., `JetBrains Mono`, `Berkeley Mono`) | Regular | `you.md` always rendered in monospace — it's a filename |
| Headings | System sans-serif (`Inter`, `-apple-system` stack) | 500–600 | Clean, not decorative |
| Body | System sans-serif | 400 | Readable, tight line-height |
| Code / CLI references | Monospace | 400 | Inline code, terminal output, file paths |
| Taglines / hero copy | System sans-serif | 300–400 | Light weight for the ethereal feel |

**The monospace logo is non-negotiable.** `you.md` is a filename. It should always look like one. This reinforces the "identity as code" positioning every time someone sees the brand.

### 15.4 Design Principles

1. **Warm, not cold.** AI products default to blue-steel-clinical. You.md is warm. Coral tones, soft gradients, golden light. The message: this is about *you*, the human.

2. **Spacious, not dense.** Generous whitespace. The profile page should breathe. The hero should feel vast. Tightness is for the CLI output, not the brand.

3. **Ethereal, not flashy.** Subtle glows, soft gradients, gentle animations. No hard neon. No aggressive motion. The visual language says "calm intelligence," not "startup energy."

4. **Monospace anchors the tech.** Every time `you.md`, a CLI command, a file path, or a code reference appears, it's in monospace. This is the visual thread that connects the warm brand to the technical product.

5. **The beam of light is the recurring motif.** The hero's column of light — representing identity being structured and elevated — should echo throughout the product: as a loading state, as a subtle glow behind profile photos, as the line that connects elements on the profile page.

### 15.5 Profile Page Design

The public profile page at `you.md/<username>` follows the brand system:

- **Dark background** (`--void` or `--ink`) — the profile lives in the sky
- **Warm accents** for the user's name, project links, CTAs (`--coral`, `--gold`)
- **Cool tones** for structure and secondary text (`--sky`, `--mist`)
- **Subtle vertical glow** behind the user's identity section — echoing the beam of light
- **Monospace** for the username, file references, and the "you.md/username" URL
- **No profile photos in v1** — the identity is text and structure, not a headshot (revisit later)
- **Standardized layout** — every profile has the same structure, differentiated by content not design
- **"Powered by You.md" footer** uses the brand gradient subtly

### 15.6 CLI Visual Identity

The CLI reflects the brand within terminal constraints:

- **Minimal color use** — only use ANSI colors when they communicate meaning (green for success, yellow for warnings, cyan for links/URLs)
- **The `you.md` wordmark** appears once at the top of `create-youmd` output
- **Progress indicators** use a simple vertical pipeline aesthetic (├── , └──) — echoing the beam/column motif
- **No emoji. No spinners. No skeleton blocks.**
- **Subtle text shimmer or pixel grid loader** allowed for build steps (optional, not required)

### 15.7 Open Graph / Social Cards

Auto-generated for every profile. When someone shares `you.md/houston` on X, LinkedIn, or Slack:

- **Background:** gradient from `--ink` at bottom to `--void` at top, with a subtle `--gold` glow at center
- **Content:** Username in monospace, display name, tagline, `you.md` brand mark
- **Feel:** looks like a terminal output card floating in the sky
- **Dimensions:** 1200×630 (standard OG)

Generated server-side (via Vercel OG or Satori). No manual design per profile.

---

## 0. How to Read This Document

This PRD is the canonical build spec for You.md. It is written for the engineering team.

- **Sections 1–2** define what we're building and why, in plain language.
- **Section 3** defines the open spec — the data format that everything else depends on.
- **Section 4** defines the technical architecture — infrastructure, services, data flow.
- **Section 5** defines the product surface — CLI, web, API — and exactly what ships in v1.
- **Section 6** defines phased milestones with hard scope boundaries.
- **Section 7** covers security, privacy, and trust.
- **Section 8** covers go-to-market, monetization, and success criteria.
- **Appendices** include glossary, open questions, and decision log.

If something isn't in Section 6's milestone scope, we don't build it yet.

---

## 1. Problem

AI agents are becoming the primary interface between humans and software. But agents have no reliable way to understand who they're working for — or who they're talking *about*.

**The agent context problem (personal):**

Every time you use a new AI tool, you restate your tone, re-explain your role, rebuild memory from scratch. Your identity is fragmented across dozens of systems, none of which talk to each other.

**The agent knowledge problem (public):**

When someone asks an AI agent about you — who you are, what you do, what you've built — the agent pieces together an answer from training data and web search results. Even with search, the results are unstructured web pages the agent has to parse and guess from. The information is often incomplete, outdated, or just wrong — and you have zero control over what it says.

Google solved this for search with Knowledge Panels and structured data. **Nobody has solved it for agents.**

Today, if an LLM is asked "Who is [your name]?", the answer depends on whatever the model finds — scraped web pages, third-party articles, fragments of old bios. For most people, the answer is thin or nonexistent. For well-known people, it's a patchwork of unverified sources that may contradict each other. For everyone, there's no canonical source the agent can trust, and no way for the person to correct what's wrong.

You.md solves both problems with a single artifact: a structured, portable identity bundle that agents can consume directly — authoritative, current, and controlled by the person it represents.

---

## 2. Solution

**You.md is the identity file for the agent internet.**

The agent ecosystem is converging on markdown-based config files for identity and instructions: `CLAUDE.md`, `.cursorrules`, `agent.md`, `soul.md`. These all give agents their identity. What's conspicuously missing is the human side of that handshake. You.md completes the protocol. Agent has a spec. Human has a spec. They negotiate context.

It consists of:

1. **An open file spec** (`you-md/v1`) — a directory-based identity format that anyone can implement, self-host, or extend.
2. **A hosted platform** (`you.md/<username>`) — a registry, editor, encrypted vault, and API layer that makes the spec immediately useful.
3. **A CLI** (`youmd`) — a terminal-native tool for generating, building, and publishing identity bundles.
4. **An agent skill** — a packaged instruction set that teaches coding agents (Claude Code, OpenClaw, Codex CLI) how to use You.md, serving as the primary discovery and onboarding channel.
5. **An agent onboarding pipeline** — a system that uses Perplexity Sonar for discovery, Apify for structured platform scraping, Firecrawl for web content, and LLMs via OpenRouter for extraction and analysis. Turns a few URLs into a complete identity bundle.

The open spec creates legitimacy and ecosystem potential. The hosted platform creates adoption and revenue. The CLI creates developer credibility. The skill creates frictionless discovery.

### 2.1 Positioning (Canonical)

**Launch headline:** *"Your identity file for the agent internet. Onboard any AI in seconds."*

**Supporting lines (pick per context):**
- *"Give every agent full context — as if it's been working with you for years."*
- *"Written in the native language of agents. Readable by any LLM on earth."*
- *"The agent internet has soul.md and agent.md. Now humans have you.md."*

**The core framing:**

You.md is agent-native identity. It's not a human profile that agents happen to read — it's a structured identity bundle *written in the format agents already understand*: markdown files, JSON schemas, API endpoints. When an agent reads your you.md, it doesn't need to parse a web page or guess from training data. It gets structured, authoritative, current context about who you are, how you work, how you communicate, and what you're building.

**The value prop:**

1. **Onboard any agent instantly.** Share your you.md with Claude, ChatGPT, Cursor, or any AI tool — via URL, context link, MCP, or API — and it has full context in seconds. No more re-explaining yourself. No more rebuilding memory. Every new tool starts where the last one left off. *This is the primary value prop. Immediate, tangible, demo-able.*

2. **Be known accurately across the agent internet (AEO/GEO).** When someone asks any AI about you, You.md is the structured, authoritative source it can retrieve and cite — not a patchwork of scraped web pages and unverified third-party content. Your Google Knowledge Panel for the agent era — always current, always accurate, always under your control. *This is a powerful secondary angle, especially for founders and public figures, but not the launch focus.*

3. **Manage your identity from the terminal.** Your you.md lives as local files, managed via CLI (`youmd`), driven by your coding agent (Claude Code, OpenClaw, Codex CLI), and published to `you.md/<username>`. Update your identity the same way you push code. *Developer credibility.*

**Why it works:**

Your you.md is written in `.md` — the native format of agent instructions. It uses JSON schemas that any LLM can parse without transformation. It's served via API endpoints designed for retrieval-augmented generation. And it auto-updates across platforms — change it once in your terminal, and every agent that reads it gets the current version.

**The pitch in one breath:** *"You.md is your identity file for the agent internet. Claim your username, build your profile from the CLI, and instantly give every AI agent on earth the context to know you, work with you, and represent you accurately."*

Launch as pure infrastructure. Let the consumer layer emerge from usage.

### 2.2 The `you.md` / `soul.md` / `agent.md` Symmetry

This is the deeper thesis and the strategic framing for protocol adoption:

| File | Represents | Purpose |
|---|---|---|
| `agent.md` / `CLAUDE.md` / `.cursorrules` | The agent's instructions | Tells the agent how to behave in a project |
| `soul.md` | The agent's identity/persona | Gives the agent a personality, values, voice |
| **`you.md`** | **The human's identity** | **Gives agents structured context about the human they're working for** |

These three files form a complete context handshake:
- The agent knows who it is (`soul.md`)
- The agent knows how to behave (`agent.md`)
- The agent knows who it's working for (`you.md`)

You.md is the missing piece. This symmetry is core to the protocol positioning and should be emphasized in all external communications.

---

## 3. Open Spec: `you-md/v1`

This section is the most important in the document. Everything else — the CLI, the web UI, the API — is a consumer of this spec. If the spec is wrong, everything downstream breaks.

### 3.1 Design Principles

- **Directory-based, not single-file.** An identity is a bundle of related files, not a monolith.
- **Markdown-first for humans, JSON for machines.** Humans author in `.md`. The system compiles to `.json`.
- **Explicit public/private boundaries.** Every file is either public or private. There is no ambiguity.
- **Manifest-routed.** Agents read `manifest.json` first. It tells them what exists, what's accessible, and where to find it.
- **Extensible within versioning rules.** Users can add custom directories. The spec defines required primitives and reserved paths.

### 3.2 Required Primitives

Every valid `you-md/v1` bundle MUST contain:

| File | Type | Purpose |
|---|---|---|
| `you.md` | Markdown | Human-readable identity entry point. The "front page." |
| `you.json` | JSON | Compiled machine-readable output. Generated, not hand-edited. |
| `manifest.json` | JSON | Directory map, permission declarations, schema version, source registry. |

These three files are non-negotiable. A bundle without all three is invalid.

### 3.3 Directory Structure

```
you/
├── you.md                    # REQUIRED — human-readable entry file
├── you.json                  # REQUIRED — compiled machine-readable output
├── manifest.json             # REQUIRED — directory map + permissions
│
├── profile/                  # User-authored identity content
│   ├── about.md              # Bio, background, identity narrative
│   ├── now.md                # Current focus (inspired by nownownow.com)
│   ├── projects.md           # Active projects with status
│   ├── values.md             # Core values, beliefs, non-negotiables
│   └── links.md              # Annotated links (website, social, etc.)
│
├── preferences/              # Agent-facing configuration
│   ├── agent.md              # How agents should behave when representing this person
│   ├── writing.md            # Tone, voice, style preferences
│   └── formatting.md         # Output formatting rules
│
├── sources/                  # Raw ingested data (generated by pipeline)
│   ├── website/
│   │   ├── raw.html
│   │   └── extracted.json
│   ├── linkedin/
│   │   ├── raw.json
│   │   └── extracted.json
│   ├── x/
│   │   ├── raw.json
│   │   └── extracted.json
│   └── blog/
│       ├── raw.html
│       └── extracted.json
│
├── analysis/                 # LLM-derived artifacts (generated by pipeline)
│   ├── author_voice.md       # Writing style analysis
│   ├── topic_map.json        # Structured topic/expertise graph
│   ├── bio_variants.md       # Multiple bio lengths (1-line, 3-line, paragraph)
│   ├── narrative_arcs.md     # Career/life story threads
│   └── faq.md                # Predicted questions about this person
│
└── private/                  # Encrypted context (never served publicly)
    ├── private.md
    └── private.json
```

**Reserved paths:** `profile/`, `preferences/`, `sources/`, `analysis/`, `private/` are reserved by the spec. Users may add custom top-level directories (e.g., `portfolio/`, `research/`), which will be listed in the manifest under `custom_paths`.

### 3.4 Manifest Schema

```jsonc
{
  "schema": "you-md/v1",
  "username": "houston",
  "generated_at": "2026-03-02T12:00:00Z",
  "compiler_version": "0.1.0",

  "paths": {
    "public": [
      "you.md",
      "you.json",
      "profile/about.md",
      "profile/now.md",
      "profile/projects.md",
      "profile/values.md",
      "profile/links.md",
      "preferences/agent.md",
      "preferences/writing.md",
      "preferences/formatting.md",
      "analysis/author_voice.md",
      "analysis/topic_map.json",
      "analysis/bio_variants.md",
      "analysis/narrative_arcs.md",
      "analysis/faq.md"
    ],
    "private": [
      "private/private.md",
      "private/private.json"
    ],
    "scoped": []
  },

  "sources": {
    "website": {
      "url": "https://houstongolden.com",
      "last_fetched": "2026-03-01T08:00:00Z",
      "status": "active"
    },
    "linkedin": {
      "url": "https://linkedin.com/in/houstongolden",
      "last_fetched": "2026-03-01T08:00:00Z",
      "status": "active"
    }
  },

  "update_policy": {
    "auto_refresh": false,
    "refresh_interval_days": null,
    "require_approval": true
  },

  "custom_paths": []
}
```

### 3.5 `you.json` Compiled Output Schema

This is what agents consume. It is generated by the build step, never hand-edited.

```jsonc
{
  "schema": "you-md/v1",
  "username": "houston",
  "generated_at": "2026-03-02T12:00:00Z",

  "identity": {
    "name": "Houston Golden",
    "tagline": "Founder, BAMF Media. Building You.md.",
    "location": "Miami, FL",
    "bio": {
      "short": "...",
      "medium": "...",
      "long": "..."
    }
  },

  "now": {
    "focus": ["Building You.md", "Scaling BAMF Media"],
    "updated_at": "2026-03-01"
  },

  "projects": [
    {
      "name": "You.md",
      "role": "Founder",
      "status": "building",
      "url": "https://you.md",
      "description": "Identity as code for the agent internet."
    }
  ],

  "values": ["Build in public", "Extreme ownership", "Ship fast"],

  "links": {
    "website": "https://houstongolden.com",
    "linkedin": "https://linkedin.com/in/houstongolden",
    "x": "https://x.com/houstongolden"
  },

  "preferences": {
    "agent": {
      "tone": "direct, confident, no fluff",
      "formality": "casual-professional",
      "avoid": ["corporate jargon", "passive voice"]
    },
    "writing": {
      "style": "short paragraphs, punchy sentences",
      "format": "markdown preferred"
    }
  },

  "analysis": {
    "topics": ["growth marketing", "AI agents", "identity protocols"],
    "voice_summary": "Direct, high-energy, founder-coded.",
    "credibility_signals": [
      "Founded BAMF Media (8-figure agency)",
      "LinkedIn growth pioneer"
    ]
  },

  "meta": {
    "sources_used": ["website", "linkedin", "x"],
    "last_updated": "2026-03-02T12:00:00Z",
    "compiler_version": "0.1.0"
  },

  "verification": null
}
```

### 3.6 `you.md` Entry File Format

```markdown
---
schema: you-md/v1
name: Houston Golden
username: houston
generated_at: 2026-03-02
---

# Houston Golden

Founder, BAMF Media. Building You.md.

## Now

- Building You.md — identity as code for the agent internet
- Scaling BAMF Media

## Projects

- **You.md** — identity file standard + hosted platform (Founder, building)
- **BAMF Media** — growth marketing agency (Founder/CEO, active)

## Values

- Build in public
- Extreme ownership
- Ship fast

## Agent Preferences

Tone: direct, confident, no fluff.
Avoid: corporate jargon, passive voice.
Format: short paragraphs, punchy sentences.

## Links

- Website: https://houstongolden.com
- LinkedIn: https://linkedin.com/in/houstongolden
- X: https://x.com/houstongolden

---

> Full context: see manifest.json
```

### 3.7 Spec Versioning Rules

- The spec version is `you-md/v1`. All files in a bundle must declare the same version.
- Minor additions (new optional fields) are backward-compatible within `v1`.
- Breaking changes (removed required fields, restructured paths) require `v2`.
- The spec will be published at `spec.you.md` and versioned in a public GitHub repo.

---

## 4. Technical Architecture

### 4.1 System Overview

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│   CLI        │────▶│  API Server   │────▶│  Database         │
│  (youmd)     │     │  (REST)       │     │  (Convex)         │
└─────────────┘     └──────┬───────┘     └──────────────────┘
                           │
┌─────────────┐            │              ┌──────────────────┐
│   Web UI     │───────────┘              │  File Storage     │
│  (Next.js)   │                          │  (Convex)         │
└─────────────┘                           └──────────────────┘
                                                    ▲
                    ┌──────────────┐                 │
                    │  Ingestion    │────────────────┘
                    │  Pipeline     │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Perplexity│ │  Apify   │ │ Firecrawl│
        │ (Search)  │ │ (Scrape) │ │ (Scrape) │
        └──────────┘ └──────────┘ └──────────┘
              │            │            │
              ▼            ▼            ▼
        ┌──────────────────────────────────┐
        │   LLM Layer (via OpenRouter)      │
        │   - Extraction                    │
        │   - Analysis                      │
        │   - Compilation                   │
        └──────────────────────────────────┘
```

### 4.2 Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Backend + Database** | Convex | Reactive, serverless, real-time, TypeScript-native. Replaces separate API server + DB + queue. |
| **Web Frontend** | Next.js 14+ (App Router) | SSR for profile pages (SEO critical), React for editor/dashboard |
| **File Storage** | Convex File Storage | Bundle artifacts, source files. Native to Convex. |
| **Auth** | Clerk (via Convex integration) | Username claim, session management. Convex has first-class Clerk support. |
| **CLI** | TypeScript, published to npm as `youmd` | |
| **LLM Routing** | OpenRouter | Multi-model, cost-optimized, single API |
| **Search** | Perplexity Sonar API | Discovery + web search |
| **Scraping** | Apify (LinkedIn, X), Firecrawl (general web) | Structured scraping at scale |
| **Encryption** | AES-256-GCM | Private vault encryption at rest |
| **Hosting** | Vercel (web) | Convex handles backend hosting natively |
| **Job Queue** | Convex scheduled functions + actions | Replaces BullMQ/Redis. Native async job execution. |

### 4.3 Data Model (Convex)

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    username: v.string(),
    email: v.string(),
    displayName: v.optional(v.string()),
    plan: v.union(v.literal("free"), v.literal("pro")),
  })
    .index("by_username", ["username"])
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"]),

  bundles: defineTable({
    userId: v.id("users"),
    version: v.number(),
    schemaVersion: v.string(),
    manifest: v.any(),
    youJson: v.any(),
    youMd: v.string(),
    pageTemplate: v.optional(v.string()),
    isPublished: v.boolean(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_version", ["userId", "version"]),

  sources: defineTable({
    userId: v.id("users"),
    sourceType: v.string(),
    sourceUrl: v.string(),
    rawStorageId: v.optional(v.id("_storage")),
    extracted: v.optional(v.any()),
    status: v.union(
      v.literal("pending"),
      v.literal("fetching"),
      v.literal("fetched"),
      v.literal("extracting"),
      v.literal("extracted"),
      v.literal("failed")
    ),
    lastFetched: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_type", ["userId", "sourceType"]),

  analysisArtifacts: defineTable({
    userId: v.id("users"),
    artifactType: v.string(),
    content: v.any(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_type", ["userId", "artifactType"]),

  apiKeys: defineTable({
    userId: v.id("users"),
    keyHash: v.string(),
    label: v.optional(v.string()),
    scopes: v.array(v.string()),
    lastUsedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_keyHash", ["keyHash"]),

  privateVault: defineTable({
    userId: v.id("users"),
    encryptedMd: v.bytes(),
    encryptedJson: v.bytes(),
    iv: v.bytes(),
  })
    .index("by_userId", ["userId"]),

  pipelineJobs: defineTable({
    userId: v.id("users"),
    sourceId: v.optional(v.id("sources")),
    stage: v.union(
      v.literal("discover"),
      v.literal("fetch"),
      v.literal("extract"),
      v.literal("analyze"),
      v.literal("compile"),
      v.literal("review")
    ),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    errorMessage: v.optional(v.string()),
    retryCount: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"]),

  profileViews: defineTable({
    userId: v.id("users"),
    viewedAt: v.number(),
    referrer: v.optional(v.string()),
    isAgentRead: v.boolean(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_date", ["userId", "viewedAt"]),

  contextLinks: defineTable({
    userId: v.id("users"),
    token: v.string(),
    scope: v.union(v.literal("public"), v.literal("full")),
    expiresAt: v.optional(v.number()),
    maxUses: v.optional(v.number()),
    useCount: v.number(),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_userId", ["userId"]),
});
```

### 4.4 Ingestion Pipeline (Detailed)

**Toolchain per source type:**

| Source | Discovery | Fetching | Notes |
|---|---|---|---|
| Website | Perplexity Sonar | Firecrawl | Returns clean markdown |
| LinkedIn | Direct URL | Apify LinkedIn Scraper | Structured JSON |
| X / Twitter | Direct URL | Apify Twitter Scraper | Recent posts, bio, engagement |
| Blog / Substack | Perplexity Sonar | Firecrawl | 5-10 recent posts |
| YouTube | Direct URL or Perplexity Sonar | Apify YouTube Scraper | Transcripts for voice |
| GitHub | Direct URL | GitHub REST API | Repos, contributions, README |
| Podcast | Perplexity Sonar | Firecrawl + transcript APIs | Lower priority |

**Pipeline stages:**

1. DISCOVER — Perplexity Sonar validates URLs, finds subpages
2. FETCH — Apify/Firecrawl scrapes raw content
3. EXTRACT — LLM via OpenRouter extracts structured data
4. ANALYZE — LLM generates voice profile, topics, bios, arcs, FAQ
5. COMPILE — Generates you.json, you.md, manifest.json
6. REVIEW — Human-in-the-loop approval

Each stage is a discrete, retryable Convex action.

### 4.5 API Design

**Public HTTP endpoints (no auth):**

```
GET  /api/v1/profiles/:username          → Public you.json
GET  /api/v1/profiles/:username/raw      → Public you.md
GET  /api/v1/profiles/:username/manifest → Public manifest
GET  /ctx/:username/:token               → Context link bundle
```

**Authenticated endpoints:**

```
GET    /api/v1/me                        → Current user profile
PUT    /api/v1/me/bundle                 → Update bundle
POST   /api/v1/me/sources                → Add source URL
GET    /api/v1/me/sources                → List sources
POST   /api/v1/me/build                  → Trigger pipeline
GET    /api/v1/me/build/:jobId           → Pipeline status
POST   /api/v1/me/publish                → Publish bundle
GET    /api/v1/me/keys                   → List API keys
POST   /api/v1/me/keys                   → Create API key
DELETE /api/v1/me/keys/:keyId            → Revoke API key
GET    /api/v1/me/private                → Decrypt private vault
PUT    /api/v1/me/private                → Encrypt + store vault
GET    /api/v1/me/analytics              → View counts
POST   /api/v1/me/links                  → Create context link
GET    /api/v1/me/links                  → List context links
DELETE /api/v1/me/links/:linkId          → Revoke context link
```

**Rate limits:**

| Plan | Requests/min | Requests/day |
|---|---|---|
| Free | 30 | 1,000 |
| Pro | 120 | 10,000 |

### 4.6 CLI Architecture

See PRD Section 4.6 for full CLI command reference and implementation details.

---

## 5. Product Surfaces

### 5.1 Web: Public Profile Page

Server-rendered at `you.md/<username>`. Structured, minimal rendering of `you.json`.

### 5.2 Web: Onboarding + Editor / Dashboard

Secondary path mirroring CLI flow. Structured form editor, pipeline progress, diff review.

### 5.3 API

Backbone for both CLI and web UI.

### 5.4 CLI

Primary interface for developer users.

---

## 6. Milestones & Scope

### Milestone 0: Foundation (Weeks 1-3)
Core infrastructure. Auth. Username claim. Empty bundle creation.

### Milestone 1: Manual Identity Creation (Weeks 4-6)
Users can create and publish identity bundles manually.

### Milestone 2: Ingestion Pipeline (Weeks 7-10)
Source URLs → scrape → extract → analyze → compile.

### Milestone 3: Security + Sharing + Monetization (Weeks 11-13)
Private vault. Context links. API keys. Pro plan.

### Milestone 4: Polish + Launch (Weeks 14-16)
Production-ready. Public launch.

---

## 7. Security & Privacy

- AES-256-GCM encryption for private vault
- API keys hashed with SHA-256, prefixed with `ym_`
- Scoped access, audit logging
- Hard delete on account deletion
- Username released after 30-day hold

---

## 8. Go-to-Market & Business

- Free tier: 3 pipeline runs, 1 API key, public profile
- Pro ($12/mo): BYOK, unlimited pipeline, private vault, scoped keys, higher limits
- Self-hosted: possible via open spec, not a supported product in v1

---

## 9-13. Additional Sections

See full PRD for: Scope Boundaries, Skills Distribution, Viral Loop & Growth, Framework Integration Strategy, and Context Links.

---

## Appendices

See full PRD for: Onboarding Agent Personality, Open Questions, Decision Log, and Glossary.
