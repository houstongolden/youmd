# VISION-AUDIT.md

**Mission:** Principal Product Visionary + GTM Strategist audit of You.md positioning
**Date:** 2026-06-11
**Sources:** you.md live surfaces (llms.txt verified live), full repo (`src/components/landing/Hero.tsx`, `README.md`, `project-context/PRD.md`, `project-context/CURRENT_STATE.md`, `src/generated/docs-reference.ts`)
**Method:** Three-phase audit; every conclusion below survived an adversarial self-critique pass (refuted items removed or downgraded).

---

## Executive Summary

**Current positioning grade: B**

You.md has a real, felt problem ("stop re-explaining yourself to every new agent" — `Hero.tsx:46-50`), a coherent two-layer product (brain + YouStacks), and unusually strong agent-native plumbing (llms.txt, OpenAPI, MCP discovery, schema). That puts it ahead of ~95% of "AI identity" attempts, which are bio pages with an API bolted on.

What keeps it from an A:

1. **The tagline sells convenience; the product is infrastructure.** "Stop re-explaining yourself" is a time-saving pitch. The actual durable value is *consistency* — every agent meets the same, current version of you. Convenience gets you installed; consistency gets you depended on.
2. **The sharpest IP is buried.** The handshake framing in `README.md:21-27` (`agent.md` → the agent's instructions, `soul.md` → the agent's identity, `you.md` → the human's identity, "You.md completes the handshake") is category-defining language. It is not on the homepage.
3. **Keep engineering stats out of the story.** "76 endpoints + 24 MCP tools" (`docs-reference.ts:27-28`) lives in generated docs surfaces today — correctly. The risk is preventive: those counts must not leak into positioning copy, because an endpoint count is an engineering stat, not a buying reason.
4. **Promise/reality gap.** Private vault encryption (`CURRENT_STATE.md:188`), per-stack grant tokens (`CURRENT_STATE.md:115`), and Pro billing (`CURRENT_STATE.md:189`) are marketed-adjacent but not shipped. For an identity/trust product, the vault gap specifically is a positioning liability, not just a roadmap item.

---

## Phase 1 — Discovery & Truth-Telling

### What we solve today vs what the market feels

| | You.md today | Market's felt pain (2026) |
|---|---|---|
| Core | Local `.youmd/` brain + public profile + installable stacks + CLI/MCP | Every new session starts cold; each agent knows a *different, stale* version of you |
| Format | One canonical `.md`/JSON layer | CLAUDE.md / AGENTS.md / .cursorrules / vendor-memory sprawl, hand-maintained per tool |
| Distribution | curl install + you.md/<name> URL | Vendor memory (ChatGPT, Claude, Cursor) is solving cold-start *inside each silo* |

**Truth-telling:** the market's felt pain is currently developer-shaped (config sprawl across coding agents). The mass-market "AI identity" pain is real but latent. You.md's honest wedge is the power user who already runs 3+ agents — exactly who PRD.md:28-30 names. The vendors will keep solving memory *inside* their silos; cross-vendor portability is structurally against their incentives. That is the why-us: **a neutral identity layer can only come from outside the model vendors.**

### Core "who" + pain quantification

| Persona | Pain | Will they pay/install/share? |
|---|---|---|
| **P1 — Agentic power user / solo AI builder** (3+ agents daily; Houston-shaped) | 10–30 min/day re-establishing context; worse, *divergent* outputs because each agent holds a different model of them; maintains N config files by hand | Install: yes (single-player CLI value, zero network needed). Pay: yes — already spends $20–200+/mo on agent tools; $10–20/mo is rounding error. Share: yes — the public profile URL is the share artifact |
| **P2 — Founder / consultant / creator with public expertise** | Wants agents (theirs and *other people's*) to represent them accurately; expertise trapped in their head | Pays for lighthouse stacks + verified profile; shares aggressively (the profile IS marketing) |
| **P3 — Product/eng teams** (later) | Onboarding agents to a project/person repeatedly; playbook drift across teammates' agents | Team stacks = seat-based revenue; do not lead with this in 2026 |

The quantified pain is not primarily minutes lost — it is **output quality variance**: a cold agent produces generic work until re-briefed, and a stale-context agent produces confidently *wrong* work. That second failure mode is the one worth building the narrative around.

---

## Phase 2 — Vision Stress-Test (brutal honesty)

**Is "Stop re-explaining yourself to every agent" sharp enough?**
It's good — concrete, negative-pain, instantly understood. It does not make hair stand up, because it promises relief, not power. It also has a shelf life: as vendor memory improves, "re-explaining" *feels* solved per-silo, even while divergence gets worse. The hair-raising version is ownership + consistency: *agents are becoming the interface to everything, and the version of you they act on should be yours — one source, current, portable.*

**The bigger, defensible vision:**

> **You.md is the identity protocol of the agent internet — one portable brain and your named expertise stacks, so every agent you ever use meets the same, current version of you from the first turn.**

Short form: **"Every agent. The same you."**

"Operating system for personal AI identity" was stress-tested and rejected: OS is a tired metaphor, implies platform lock-in (the opposite of the open `.md` bet in `README.md:288`), and invites direct comparison with actual agent OSes. **Protocol** is the right claim — DNS resolves names to machines; you.md resolves people to context. A protocol claim is also the only framing under which the open/forkable strategy is a strength rather than a leak.

**Personal context layer vs YouStacks — why both:**

- **Brain** = who you are. Singular, durable, slow-changing. The passport.
- **YouStacks** = what you're great at, packaged and scoped. Plural, shareable, fast-evolving. The toolkits.

Identity without capability is a bio page. Capability without identity is a plugin store. The defensibility is the *binding*: stacks interpolate against your live brain (`youmd skill use` renders identity, `skill sync` re-renders it — `cli/src/commands/skill.ts:595`, `cli/src/lib/sync.ts:63`). A copied stack keeps working but freezes at copy time; only the brain keeps it current. The honest moat is **freshness plus the accumulated brain**, not hard clone-resistance — and it is under-articulated on the homepage (README states it at `README.md:301`, the hero never does).

**Why now (2026):** MCP standardization makes a neutral context endpoint consumable by every major agent; CLAUDE.md/AGENTS.md sprawl has *proven* demand for exactly this file-first pattern; vendor memory silos are creating the first wave of lock-in fear. The window is open because the standard for "user context" has not been claimed — and windows like this close when a vendor ships a default.

---

## Phase 3 — Opportunity & Risk Map

### Positioning reframes (impact 1–10 / effort S–XL)

| # | Reframe | Impact | Effort |
|---|---|---|---|
| R1 | **Lead with the handshake.** `agent.md` is the agent's contract; `you.md` is yours. Promote README.md:21-27 to the hero. Category-defining, already written. | 9 | S |
| R2 | **Convenience → consistency.** From "stop re-explaining" to "every agent meets the same version of you." The subhead already says it (`Hero.tsx:52-55`); make it the headline claim. | 8 | S |
| R3 | **Protocol, not product.** Publish the `you-md/v1` schema as an open standard; actively court other tools to *read* you.md profiles. Being the standard beats being the app. | 10 | L |
| R4 | **Lighthouse-profile growth loop.** Public profiles (ASCII portrait OG cards, directory) as the viral artifact — Linktree-for-agents dynamics. Every profile is an ad. | 8 | M |
| R5 | **Brain-bound stacks as the freshness moat.** Market the binding explicitly: "a copied YouStack freezes at copy time; yours stays current because it re-renders against your live brain." | 6 | S |

### Existential risks (likelihood × severity)

| # | Risk | Severity | Mitigation | Effort |
|---|---|---|---|---|
| X1 | **Platform absorption.** Anthropic/OpenAI ship portable cross-session memory, or MCP adds an official "user context" primitive. | Existential; likelihood med-high | Be the open, vendor-neutral format *first*; embed in MCP ecosystem so absorption looks like adoption. R3 is the hedge. | L |
| X2 | **Trust breach (real or perceived).** One private-vault leak kills the category for you. Vault encryption is implied by the Pro pricing card ("private vault + richer scoping", `Pricing.tsx:16`) and explicitly planned in `PRD.md:229`, but **not shipped** (`CURRENT_STATE.md:188`). | Existential; likelihood low but asymmetric | Ship AES-256-GCM vault before any Pro launch; publish a privacy contract page; never let marketing run ahead of crypto. | M |
| X3 | **Empty-protocol problem.** A protocol no third party queries is a personal config tool; two-sided cold start may never flywheel. | High; likelihood medium | Single-player-first is the correct current strategy (CLI brain is useful with zero network) — keep it; layer the protocol claim on top rather than betting on it. | M |
| X4 | **Stale-brain failure.** The brain drifts from reality; agents meet an *outdated* you — silently breaking the core promise. | High; likelihood high over time | Self-updating loops (post-session capture, `youmd sync --watch`, proactive-context-fill skill) move from feature to existential requirement. | L |

---

## Competitive Moat Map

| Moat | Strength today | Trajectory |
|---|---|---|
| Open `.md` format + `you-md/v1` schema | Medium — exists, not yet adopted by third parties | The big bet (R3) |
| Accumulated private brain (switching cost) | Low now, compounds per user-month | Strongest long-term moat |
| Brain↔stack binding (copied stacks go stale; synced stacks stay current) | Real but absent from homepage | Promote (R5) |
| Public profile network/directory | Weak (cold start) | Growth loop dependent (R4) |
| Agent-native surface depth (llms.txt, OpenAPI, MCP, capabilities) | Strong vs any current alternative | Table stakes by 2027 — moat is temporary |
| Vendor neutrality | Structural advantage no model vendor can copy | Permanent, lean on it in all copy |

---

## Survived self-critique (what was cut)

- Cut: "users lose hours/day" — unsupportable; replaced with the defensible variance argument.
- Downgraded: "brain-bound stacks are inert without the brain" — refuted by code reading (`skill-renderer.ts:300` is plain template substitution; a copied rendered skill still runs, it just goes stale). Moat reworded to freshness + accumulated brain.
- Fixed: "MCP real-time sync not shipped" — stale claim from a March section of CURRENT_STATE.md; the web MCP routes and local MCP server are live as of June (`CURRENT_STATE.md:37,58-61`). Removed from the gap list.
- Cut: enterprise as a 2026 reframe — sequencing error; P3 is deliberately deferred.
- Downgraded: positioning grade from B+ to B after weighing the vault promise/reality gap as a *positioning* (not just engineering) liability.
- Kept after attack: the protocol claim — critique argued it's premature; it survives because the claim costs nothing while single-player value carries adoption (X3 mitigation).
