# POSITIONING-PLAYBOOK.md

**Companion to:** VISION-AUDIT.md (2026-06-11)
**Constraint honored throughout:** terminal-native voice, monochrome + burnt orange, no SaaS-speak, no emoji (PRD v2.3).

---

## 1. Taglines

Ranked. Each tested against: instantly understood? makes a claim only You.md can make? survives 2027?

| Rank | Tagline | Use |
|---|---|---|
| 1 | **Every agent. The same you.** | Primary brand line — the consistency claim, four words |
| 2 | **agent.md is theirs. you.md is yours.** | Developer/hacker channels — the handshake, instantly legible to anyone who has a CLAUDE.md |
| 3 | **Context for the agent internet** | Category line — keep (current `Hero.tsx:42-44`), works as the kicker above the headline |
| 4 | **Install yourself once.** | CLI/install surfaces, README, launch posts |
| 5 | **An MCP where the context is you** | Current internal one-liner (`CURRENT_STATE.md:249`) — the strongest *defensible-today* claim (concrete, already true, zero third-party adoption required). Use in developer docs and MCP-literate channels; too jargon-bound for the hero |
| 6 | **Stop re-explaining yourself to every agent** | Demote from headline to problem-statement line — still the best *pain hook*, just not the brand claim |

---

## 2. Hero Copy (recommended)

```
                          context for the agent internet

                    every agent meets the same you

   One portable brain and your named expertise stacks. Install once —
   Claude Code, Cursor, Codex, ChatGPT, and any URL-aware agent load
   who you are, how you work, and what you're great at. From the first
   turn. Every time.

   ┌─────────────────────────────────────────────────┐
   │ $ curl -fsSL https://you.md/install.sh | bash   │
   └─────────────────────────────────────────────────┘

         [ create your you.md ]      [ read docs ]

   agent.md — the agent's instructions
   soul.md  — the agent's identity
   you.md   — yours.
```

Why this works:
- Keeps the current kicker (already good).
- Headline upgrades convenience → consistency (Reframe R2).
- The handshake triad moves from `README.md:21-27` to below the fold of the hero — the single most quotable artifact the product owns (Reframe R1). It ends on "yours." — the ownership beat.
- The install command *in the hero* is the proof-of-simplicity no paragraph can match, and matches the curl-first product architecture.

Quiet bullets (keep the existing three from `Hero.tsx:12-16`, one edit):
- public identity + private context
- one brain across your agents *(was "one runtime" — users buy the brain, not the runtime)*
- stacks for your best workflows

---

## 3. Problem → Solution Narrative

Use this arc everywhere: landing sections, launch post, README, demo script.

**Act 1 — The cold-start tax.**
Every new agent session starts with amnesia. Who are you? What do you do? How do you want me to talk? You answer the same questions in Claude, in Cursor, in Codex, in ChatGPT. Then again tomorrow.

**Act 2 — The real cost is divergence, not minutes.**
Each agent ends up holding a *different, stale* version of you — one knows your new role, one doesn't; one has your voice, one is guessing. A cold agent gives you generic work. A stale agent gives you confidently wrong work. You become the sync layer between your own tools.

**Act 3 — The silo trap.**
The vendors are "solving" this — inside their walls. ChatGPT memory doesn't follow you to Claude. Claude's memory doesn't follow you to Cursor. Every vendor memory feature deepens the silo. Portability will never come from the model vendors, because it is against their interests. It has to come from a neutral layer.

**Act 4 — One layer, yours.**
You.md is that layer: a structured brain in `.md` — the native format of agent instructions — plus named YouStacks of your expertise. Public profile for the open handshake; private vault behind scoped API/MCP for everything else. Version-controlled. Portable. Yours. Install once; every agent meets the same, current version of you from the first turn.

**Act 5 — Then it compounds.**
Every session adds memory. Every project adds context. Every stack gets sharper. A copied YouStack freezes at copy time; yours stays current because it re-renders against your live brain — which is why the longer you run You.md, the less anything else can replace it.

---

## 4. "Why It's Worth Solving" — Proof

| Claim | Proof |
|---|---|
| The pain is mainstream among the target user | The market already hand-built the workaround: CLAUDE.md, AGENTS.md, .cursorrules sprawl across every serious repo. You.md is the canonicalization of a behavior power users *already do badly* |
| Agents can consume it today, no integration ask | Live: `llms.txt`, `llms-full.txt`, OpenAPI inventory, `/.well-known/mcp.json`, `you-md/v1` schema, MCP JSON-RPC endpoint — verified live 2026-06-11 |
| Cross-vendor by design | Works across Claude Code, Cursor, Codex, ChatGPT + any URL-aware agent (`Hero.tsx:76-82`) — a claim no model vendor can make about its own memory |
| Single-player value, zero network needed | `curl install → youmd init → you` produces a useful local brain before any other user or third-party tool exists |
| Willingness to pay exists in-segment | Target user already pays $20–200+/mo across agent subscriptions; free tier (1 API key, public scope) → Pro (unlimited keys, all scopes, synced vault) per `FEATURES.md:208`; vault encryption planned (`PRD.md:229`) |
| Open where it earns trust, gated where infra costs | "Keep the brain, stack runtime, skills mostly open and forkable; charge only where hosted infrastructure matters" (`README.md:288`) |

**Honesty ledger (do not ship copy ahead of these):** private-vault encryption (`CURRENT_STATE.md:188`), per-stack grant tokens (`CURRENT_STATE.md:115`), and Pro billing (`CURRENT_STATE.md:189`) are not yet live. Until vault encryption ships, copy may promise *scoped access*, not *encrypted vault*.

---

## 5. Channel one-liners

- **Hacker News / dev:** "You have a CLAUDE.md for every repo. This is the CLAUDE.md for *you* — one brain, every agent, `.md` all the way down."
- **X/LinkedIn:** "Agents are becoming the interface to everything. The version of you they act on should be yours. you.md/yourname."
- **Docs/README first line:** keep current (`README.md:3`) — "Your agent brain and named expertise stacks for the agent internet." It's correct and earned.
- **Profile share artifact:** the ASCII portrait OG card + "this is what agents see when they meet me."
