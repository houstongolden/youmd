# Multi-Computer Agents, the Synced Brain, and the y.computer / folder.md Platform

**Date:** 2026-06-26
**Source:** Houston voice/strategy drop (see `project-context/prompts/2026-06-26-multicomputer-agents-y-computer-platform.md`)
**Status:** Strategy + competitive landscape + recommendation. No code shipped in this doc;
it frames the build on top of the existing `CROSS-MACHINE-AGENTS.md` substrate.

---

## 0. TL;DR

- The thing that is genuinely **different** about You.md is not "an agent that manages its
  own sandbox" (everyone has that) and not "spawn sub-agents" (everyone has that). It is a
  **persistent, owner-scoped, synced brain that lets separate agents on separate physical
  computers act as one** — sharing identity, skills, stacks, secrets, and projects, and
  triggering each other in near-real-time. That is the moat. **The brain is the product;
  the computers are interchangeable.**
- The three-domain platform is coherent and worth pursuing **as one platform with three
  surfaces**, not three companies:
  - **you.md** — the synced **brain** (identity, skills, stacks, projects, secrets, the
    agent bus). Already ~90% built.
  - **folder.md** — agent-native **storage** ("Dropbox for agents"). Already live as a
    real product surface; it's the durable-artifact lane the brain points at.
  - **y.computer** — the **compute** lane: virtual computers where your agents run and
    scale beyond your physical machines, each one auto-joining the brain on boot.
- **Recommendation on y.computer:** buy the domain (cheap optionality, strong narrative
  fit), but **do NOT build a sandbox provider.** That layer is brutally commoditized and
  capital-intensive (E2B, Modal, Daytona, Fly Machines, Vercel Sandbox all fighting over
  millisecond cold starts). Build y.computer as a **thin control plane** that provisions a
  managed agent host on whatever cheap underlying compute, and — this is the whole point —
  **auto-enrolls it into the You.md brain** so it shows up in `you remote`, syncs skills/
  stacks/secrets, and is reachable on the agent bus from second one. The brain is the
  differentiator; rent the metal.
- This maps almost 1:1 onto substrate that already exists. See §6.

---

## 1. The vision, captured (Houston's framing)

> The full `u` project is coming together. What I'm building feels different from what's out
> there. Not just an agent managing its own sandbox, and not just spawning sub-agents in
> their own sandbox computers — but **truly separate agents on different physical computers,
> syncing in real time, collaborating on self-improving skills, across multiple projects
> that all stay in sync and share skills and share stacks and communicate across computers
> completely.** It's solving my own problems.
>
> Does it make sense to build our own virtual computer agents on top of this, where **you.md
> is the brain — the synced brain** — and **y.computer** is the actual virtual computers
> where agents run if you want to scale beyond your physical machines (instead of Fly.io,
> which got expensive, or Hostinger)? Plus **folder.md** is the agentic file-sharing / cloud
> storage — Dropbox for agents. Those three combined — **you.md** (brain: files, skills,
> projects, GitHub, all syncing), **folder.md** (files/storage), **y.computer** (the actual
> virtual computers to scale agents) — could be a powerful platform.

The product principle that governs all of it (`PRINCIPLES.md`): **never turn the human into
an operator.** A new y.computer host must *self-enroll* — the user never SSHes in, never runs
a setup script, never copies a key. It boots, joins the brain, and starts working.

---

## 2. Competitive landscape — what's actually out there

The market has split the agent stack into layers. Reading them honestly: each individual
layer has strong, well-funded competitors. **What nobody has assembled is the
owner-scoped, cross-physical-machine, real-time synced version of all three at once.**

### Lane A — Multi-agent orchestration (crowded, but NOT what we are)
LangGraph, CrewAI, Microsoft Copilot/Agent stack, Amazon Bedrock AgentCore, Relevance AI.
The emerging open standard for agent↔agent talk is **A2A**; **MCP** standardizes tool
access. These are about *many agents inside one logical system / one fabric* — a "knowledge
fabric" or shared-memory layer that agents in the same deployment read from.

**Why we're different:** all of these assume the agents are co-located in one orchestrated
runtime (one cloud, one process tree, one vendor). You.md is about **agents that live on
different people-owned physical computers** (office Mac mini, home MacBook, a rented
y.computer) that are *not* part of one orchestration graph and aren't reachable from each
other — yet behave as one because they share a brain. That's a different topology: **federation
of independent hosts around a personal brain**, not orchestration of workers inside a cluster.

### Lane B — Agent sandboxes / virtual computers (commoditized, capital-heavy)
This is the contested real estate of 2026: **E2B** (Firecracker microVMs), **Modal**
(Python-native, gVisor), **Daytona** (repositioned to "secure infra for AI-generated code",
sub-90ms / 27ms cold starts), **Fly Machines** (raw primitive), **Vercel Sandbox**. The
entire competition is **cold-start latency, isolation depth, and price** — a margin-compressed
infrastructure knife fight.

**Why we should NOT compete here directly:** these companies are burning capital to win
milliseconds. y.computer cannot and should not out-Firecracker E2B. **The differentiator is
not the sandbox — it's that our sandbox is born already inside your brain.** A y.computer host
should provision on top of one of these (or cheap long-running VPS like Hostinger for the
"persistent worker" use case) and add the enrollment + sync layer on top.

### Lane C — Agent-native storage (live, including our own)
**folder.md** already exists and ranks as a real "File Storage for AI Agents" product
(API/MCP-native, agents read/write/share via REST/MCP/SDK). Competitors: **Fast.io**
(agents get their own accounts + file-lock APIs for multi-agent concurrency), **Amazon S3
Files** (mounts a bucket as a native FS for agents), **Tigris/Agentuity**, **Simplyblock**.
The consensus requirement set: API-first CRUD, non-expiring persistence, MCP compatibility,
structured/programmatic permissions, versioning, and **multi-agent concurrency control
(locks / optimistic concurrency / CRDTs)**.

**Where we fit:** folder.md is the *durable artifact* lane the brain points at. The brain
syncs identity/skills/stacks/secrets (small, structured, owner-scoped); folder.md holds the
*big shared working files* that multiple machines' agents collaborate on. They're
complementary, not competing.

### Lane D — Portable agent memory / identity (early, validating our thesis)
There's now an academic protocol — **"Portable Agent Memory"** (arXiv 2605.11032) — for
cryptographically-verified memory transfer across heterogeneous agents: a five-component
model (episodic, semantic, procedural, working, **identity**) in a model-agnostic JSON/CBOR
format, Merkle-DAG tamper evidence. The framing is explicit: **MCP = tools, A2A =
coordination, Portable Memory = "what does the agent know"** — three protocols forming the
interoperability layer.

**Why this matters for us:** the market is independently arriving at the conclusion that
**portable identity/memory is the missing third protocol.** That is exactly You.md's core
("an MCP where the context is you"). The academic version is a spec; **we have a shipping
product with a CLI, MCP server, web shell, secret vault, and a resident sync daemon.** That's
a 12–18 month head start on execution against a thesis the field is now validating. Self-
improving-skills competitors (Nous **Hermes Agent**: persistent memory + autonomously
created skills; NVIDIA OpenShell for safe self-evolving agents) are single-agent/single-host;
none do **cross-machine shared skill propagation** the way our `.agent-shared` → Claude/Codex/
Cursor/Pi sync already does.

---

## 3. What is genuinely unique here

Cross-referencing the landscape against what You.md already does (`CROSS-MACHINE-AGENTS.md`,
`CURRENT_STATE.md`), the defensible, not-yet-replicated combination is:

1. **Owner-scoped federation of independent physical hosts.** Not workers in a cluster —
   *your* computers (and rented ones), each independent, unified by a personal brain. The
   security model is "single `userId`, no cross-user reach by construction," which is exactly
   what an *individual's* fleet needs and what enterprise orchestration platforms don't model.

2. **Real-time cross-machine command + status over a relayed agent bus.** Machines aren't
   directly reachable; the brain relays (machine → Convex → machine) with target addressing,
   audit, idempotency, expiry, and a whitelist-only executor. "From my MacBook, ask my office
   Mac mini if the work is pushed, and tell it to push" — that's a primitive nobody ships as a
   consumer-grade, autonomous, no-homework flow.

3. **Self-improving skills that propagate across every host and every agent runtime.** A skill
   improved on one machine syncs through `.agent-shared` into Claude/Codex/Cursor/Pi on every
   other machine. Competitors self-improve *within one agent on one host*; we self-improve
   *across the fleet*.

4. **Secrets that follow the brain, safely.** Trusted-device encrypted `.env.local` envelopes
   mean a new host (physical or virtual) can come up fully configured **without the user
   pasting keys** — the autonomous-first principle applied to the hardest part (secrets). This
   is the unlock that makes y.computer "boots and just works" actually true.

5. **Projects + portfolio graph as shared context.** Every host knows the same 55-project
   portfolio graph, dependency edges, reusable patterns, and API/MCP ownership — so an agent
   on any machine avoids duplicate work across the whole portfolio.

**One-line positioning:** *You.md is the synced brain for your personal fleet of agents —
the same identity, skills, stacks, secrets, and projects on every computer you own or rent,
collaborating in real time.* The computers are cattle; the brain is the pet.

---

## 4. The three-surface platform

```
                      ┌─────────────────────────────────────────────┐
                      │                  you.md                      │
                      │            THE SYNCED BRAIN                  │
                      │  identity · skills · stacks · projects ·     │
                      │  secrets (vault) · portfolio graph ·         │
                      │  agent bus (real-time cross-machine) ·       │
                      │  machine proofs · audit                      │
                      └───────────────┬─────────────────┬───────────┘
                       points at      │                 │   enrolls + drives
              big shared artifacts    │                 │   compute
                              ┌───────▼──────┐   ┌───────▼─────────────┐
                              │  folder.md   │   │     y.computer      │
                              │  STORAGE     │   │     COMPUTE         │
                              │ Dropbox for  │   │ virtual computers   │
                              │ agents:      │   │ that boot already   │
                              │ API/MCP/SDK, │   │ inside your brain — │
                              │ versioned,   │   │ skills/stacks/      │
                              │ concurrency  │   │ secrets synced,     │
                              │ control      │   │ on the agent bus    │
                              └──────────────┘   └─────────────────────┘
```

- **Brain (you.md):** small, structured, owner-scoped state that must be *identical
  everywhere*. Already syncs via the resident daemon + Convex WebSocket. Source of truth for
  *who you are and how your agents work*.
- **Storage (folder.md):** large, shared, mutable artifacts that multiple hosts' agents
  collaborate on. The brain references folder.md paths; folder.md handles the multi-writer
  concurrency (locks/CRDTs) the storage market has standardized on. Source of truth for
  *the files agents are working on together*.
- **Compute (y.computer):** elastic hosts for when your physical machines aren't enough.
  Each one is, from the brain's POV, just another machine that posted a proof and joined the
  bus — so everything in `CROSS-MACHINE-AGENTS.md` already applies to it for free.

The wedge that ties it together and that **no competitor has**: a new y.computer host
**self-enrolls into the brain on boot** (`PRINCIPLES.md`: no user homework) and is
immediately a peer in `you remote` / the agent bus, with skills, stacks, and (vault-gated)
secrets already synced.

---

## 5. Recommendation on y.computer (the decision Houston asked for)

**Buy `y.computer`.** It's cheap optionality and the narrative is genuinely strong:
`you.md` (who you are) + `y.computer` (where you run). The naming symmetry alone is worth it.

**Do NOT build a sandbox/microVM provider.** That's Lane B — a commoditized, capital-heavy
latency race we'd lose. Instead, build y.computer in three escalating tiers, only going as
far as demand justifies:

- **Tier 0 — Bring-your-own-host (ship first, near-zero cost).** y.computer is just
  documentation + the existing `machine-bootstrap` flow pointed at *any* box (a Hostinger
  VPS, a spare Mac, a Fly Machine you already pay for). The value is purely "it auto-joins
  your brain." This is mostly already built — it's `youmd machine` + the resident daemon +
  the vault. **This validates the whole thesis with no infra spend.**
- **Tier 1 — Managed long-running worker (the real product).** A thin control plane that
  provisions a persistent VPS-class host (cheap long-running compute beats per-second
  microVMs for the "agent that runs for days" use case — which is Houston's actual pain:
  "Mac mini running long-running agentic tasks"), then runs the enrollment automatically.
  We resell/wrap cheap compute; we charge for the brain integration + orchestration, not the
  CPU. Margin lives in the brain, not the metal.
- **Tier 2 — Ephemeral burst (only if needed).** For spiky parallel work, provision
  short-lived sandboxes on E2B/Modal/Daytona under the hood. We never operate microVMs
  ourselves; we're the control plane + brain layer on top. Build this *only* when users hit
  the wall on Tier 1.

**Guardrail (per `PRINCIPLES.md` §2 — no bloat for one-offs):** if scaling-beyond-physical-
machines turns out to be mostly Houston's own need right now, **stay at Tier 0/1.** Don't
build a multi-tenant sandbox-broker platform for a user base of one. The general capability
is worth building only when it's reusable AND autonomous.

---

## 6. How this maps onto what already exists (the cheap part)

The `CROSS-MACHINE-AGENTS.md` substrate already covers ~90% of what y.computer enrollment
needs. y.computer is mostly *productizing and naming* existing machinery, not new invention:

| y.computer need | Already exists | Gap |
|---|---|---|
| New host joins the fleet | `machine-bootstrap` skill + `youmd machine projects/verify` + machine proofs | Wrap as a one-call provision-and-enroll; no manual prompt rerun |
| Host reachable from other machines | Agent bus (`realtimeAgentMessages`) + resident daemon WebSocket | Phase 1 command handler (already specced, not built) |
| Skills/stacks identical on new host | `.agent-shared` sync + stack daemons | None — works today |
| Secrets on new host without paste | Trusted-device secret vault envelopes | Auto-register the y.computer host as a trusted device at provision time |
| "Is my remote work done? push it." | `you remote status` (Phase 0, built) + `remote_machine_run` (Phase 1, specced) | Finish Phase 1 git whitelist executor |
| Audit of cross-machine actions | `brainActivities` / `agentActivity` | None — works today |
| folder.md as shared artifact store | folder.md product live; portfolio graph references projects | Define the brain↔folder.md reference contract (paths, scopes, MCP tool) |

**Net:** the platform Houston is describing is mostly an **assembly + naming + thin-control-
plane** job on top of shipped substrate, plus finishing the already-specced Phase 1 remote-
command executor. The hard, novel parts (synced brain, vault, agent bus, machine proofs,
shared skills) are done or in flight. That's the leverage.

---

## 7. Concrete next steps (proposed, not yet committed)

1. **Lock positioning.** Adopt "the synced brain for your personal fleet of agents" as the
   multi-computer headline; keep "an MCP where the context is you" as the protocol line.
2. **Buy `y.computer`.** Park it on a teaser that frames it as "where your You.md agents run."
3. **Ship y.computer Tier 0** as docs + the existing `machine-bootstrap` pointed at any VPS.
   Prove "rent a $7 Hostinger box, it joins your brain in one step, shows up in `you remote`."
4. **Finish CROSS-MACHINE Phase 1** (the `remote:command` scope + git whitelist executor +
   `remote_machine_run`) — it's the demo that sells the whole vision.
5. **Define the brain ↔ folder.md contract.** One MCP tool / reference convention so an agent
   on any machine can hand a big artifact to folder.md and another machine's agent can pick
   it up. Lean on folder.md's existing concurrency model for multi-writer safety.
6. **Auto-enroll secrets.** At y.computer provision time, register the host as a trusted vault
   device so secrets flow without the user pasting anything (the autonomous-first unlock).
7. **Re-evaluate Tier 1/2** only after Tier 0 shows real pull beyond Houston's own machines
   (`PRINCIPLES.md` §2).

---

## 8. Honest risks / open questions

- **Don't become an infra company by accident.** The gravity of Lane B is strong; every step
  toward operating compute is margin down and ops up. Keep y.computer a *control + brain*
  layer as long as possible.
- **folder.md vs the brain boundary needs a crisp rule** so they don't overlap. Proposed rule:
  *brain = small structured owner-state that must be identical everywhere; folder.md = large
  shared artifacts agents mutate together.* If a thing is "config/identity/skill," it's brain;
  if it's "a file we're working on," it's folder.md.
- **Security blast radius grows with rented hosts.** A y.computer host with vault secrets and
  bus command access is a real threat surface. Keep the whitelist-only executor, reversible-
  only mutations, opt-in `remote:command` scope, and full audit — and consider a tighter
  default scope for *rented* hosts than for *owned* ones.
- **Is multi-physical-machine a mass-market need or a power-user (Houston) need today?** Be
  honest. The brain + folder.md are broadly useful now; y.computer compute-scaling may be a
  power-user feature for a while. That's fine — build Tier 0, watch the pull.

---

## 9. Code-grounded audit (2026-06-26) — answering the three real forks

A deeper audit of the actual codebase (Convex storage, brain sync, agent-integration
surface) sharpened three decisions Houston is wrestling with. Findings are cited to
`file:line`; this section supersedes the higher-altitude guesses above where they differ.

### 9.1 Storage: do we need folder.md, or is Convex/GitHub enough?

**Finding — there is no binary/large-file path in You.md today, at all.**
- Every user "file" is a markdown/JSON **string** inside one `bundles` document
  (`convex/schema.ts:387-388`; `custom_files` = `{path, content: string}`,
  `convex/lib/compile.ts:62-67`), bounded by Convex's **~1 MB per-document** limit.
- The GitHub mirror is **text-only and tiny**: 100 files / 128 KB per file / **700 KB
  total** (`convex/lib/repoMirrorPolicy.ts:8-10`); binary can't enter (content must be a
  UTF-8 string, `convex/githubRepo.ts:366`).
- Portraits/images are **ASCII text or external URLs** — never stored bytes
  (`convex/schema.ts:201-210`; `convex/portrait.ts` never calls `storage.store`).
- The only blob path (`ctx.storage`) is wired to exactly two internal cases: the HTML
  scrape cache and the **8 MB encrypted env vault** (`convex/http.ts:54,3569`). Not exposed
  for user media. No `generateUploadUrl`, no R2/S3, no CDN, no per-user quota.
- **A 50 MB video, a 10 MB PDF, or a folder of design assets has nowhere to go today.**

**Decision — keep You.md text-first; make folder.md an OPTIONAL, pluggable media backend
behind a pointer. Do NOT make it a hard dependency, and do NOT grow a blob subsystem inside
You.md.** Rationale (simplicity AND power):
- You.md's *nature* is small structured text + pointers — which the brain already syncs
  perfectly (the 1 MB bundle is fine for *pointers*, terrible for *payloads*).
- The brain already stores strings flawlessly, so a folder.md URL/key **is** a first-class
  brain value with zero new machinery. The integration is just "the brain hands a big/binary
  artifact to folder.md and stores the returned pointer string." Since folder.md is already
  MCP-native and Houston owns it, this is nearly free: **one MCP handoff tool**, not a
  storage rewrite.
- folder.md (Cloudflare R2 default, S3 coming, CDN, multi-writer concurrency control) is the
  *right tool* for real media at scale; Convex `ctx.storage` is **not** a fit for 50 MB+
  media (no CDN, egress cost) even though it could host modest blobs.
- **Escape hatch for max simplicity:** if Houston ever wants zero external storage
  dependency, a minimal `ctx.storage` + `generateUploadUrl` path could handle small media
  (avatars, ≤few-MB PDFs) with no new vendor — but that's a fallback, not the media answer.

**Net:** folder.md earns its place as the *optional media lane* the brain points at — but the
brain must not require it, and most users (text identity) will never touch it. Boundary rule
holds: brain = small structured owner-state + pointers; folder.md = big/binary payloads.

### 9.2 The "You agent" harness temptation: build or don't?

**Finding — You.md already has ~80% of a harness; the only missing piece is the loop.**
- **Strong, broad MCP surface already exists** (the "works with any agent" asset): ~29 local
  stdio tools (`cli/src/mcp/registry.ts` + `cli/src/mcp/server.ts`) + 12 hosted HTTP tools
  (`convex/lib/mcpRegistry.ts`) covering identity, memory, projects, stack routing,
  portfolio, activity, and remote-machine.
- **Three real host adapters** (Claude/Codex/Cursor, `cli/src/lib/host-link.ts`) + a Convex
  skill registry with outcome telemetry (`convex/skills.ts`). **Pi / OpenClaw / Hermes are
  zero code** — roadmap/mock only.
- **A safe cross-machine execution primitive already exists**: the 5-action whitelisted
  `remote-executor.ts`, bus-driven, no arbitrary shell — this already solves "connects to all
  your computers" *securely*.
- **The skeleton of a tool loop exists** (`cli/src/commands/chat.ts:1815-2055`): typed tool
  enum, an LLM router (`chooseLocalHostTool`), single tool execution — but it
  **template-summarizes the result and stops** instead of re-invoking the LLM. Every path in
  the repo is **single-hop**; there is no plan/act/observe loop, no `maxSteps` driver.

**Decision — do NOT build a general harness to rival Claude Code/Cursor (a trap). DO
consider closing the loop on the You agent you already have — strictly as "the brain that can
act," not a coding-harness competitor.** Rationale:
- The differentiated value is **not** "a better coding agent" — it's "an agent born connected
  to your entire brain / fleet / projects / computers out of the box," which none of
  Claude Code / Cursor / Hermes / Pi are. That aligns with everything already built.
- The cost is genuinely small: the **only** net-new piece is turning the existing single-hop
  router into an iterative loop (feed each tool result back to the LLM → repeat until
  `respond`) over a **unified tool dispatcher** that fronts the existing MCP registry, reusing
  `remote-executor.ts` for cross-machine reach. "Below the loop" already exists.
- **Build-the-loop vs adopt Pi.dev:** the loop is ~the only missing 20% and is not large.
  Writing a thin loop yourself keeps it lightweight, dependency-free, and yours, and avoids
  adapting Pi's tool format to You.md's three disjoint tool surfaces. Lean **write the thin
  loop**; only adopt Pi.dev if its runtime features (sandboxing, planning) are specifically
  wanted. Either way, the You agent's moat is the *context + connectivity*, not the loop.
- **Guardrail (`PRINCIPLES.md`):** scope it to "my You agent autonomously acts across my
  brain/fleet." The moment it drifts toward general planning / arbitrary code-exec / being a
  Cursor, stop — that's the harness trap.

### 9.3 y.computer: separate product, or just a capability inside You.md?

**Finding — hosting an always-on agent is already a You.md capability; the blockers are two
small pieces of glue, not a missing product.**
- Install one-liner + `YOU_API_KEY` already does: runtime install, auth, identity/skill/
  stack/context sync, MCP wiring, machine proof, self-upgrade — **autonomous, one shot**
  (`src/app/install.sh/route.ts`, `cli/skills/machine-bootstrap.md`).
- **Blocker 1 — no Linux daemon.** The resident daemon is **macOS/launchd-only**
  (`cli/src/lib/daemon.ts:131`; `YOU_INSTALL_DAEMON` defaults off). A Linux Hostinger VPS
  syncs once at install but won't stay subscribed or pick up bus commands. **A hosted Mac
  mini (Scaleway) has NO such gap** — it gets the full daemon today. → If Houston wants to
  test always-on *now* with zero new code, a **hosted Mac mini is the path**; a Linux VPS
  needs a systemd unit built first (cheaper metal, small one-time dev cost).
- **Blocker 2 — unattended vault provisioning.** A fresh host can't self-decrypt `.env.local`
  until an existing trusted device runs `you env vault share`; the daemon never auto-restores
  (`cli/src/lib/realtime-sync.ts:209-210`). The server is zero-knowledge by design, so it
  *can't* auto-provision without an explicit envelope mint. This is the hardest "just works"
  piece.

**Decision — keep the compute-hosting capability INSIDE You.md. `y.computer` is a brand +
(eventual) control-plane wrapper, NOT a separate codebase or infrastructure.** Rationale:
- The capability is `install script + daemon + machine-bootstrap + (new) provision command` —
  all You.md. Spinning up a separate y.computer system now would duplicate the brain's
  enrollment machinery for no benefit, and violates "no bloat for a user base of ~one"
  (`PRINCIPLES.md` §2).
- Concrete near-term work, all in You.md: (1) ship a **Linux systemd daemon unit** + flip
  daemon auto-install on for the rented-host path; (2) **auto-register a provisioned host as a
  trusted vault device** at enroll time + a daemon-side auto-restore; (3) optional thin
  `you machine provision <vps>` command that drives a provider API then runs the existing
  enroll flow. (4) Fix the `remote.ts:246` "Phase 1" status copy lag.
- Buy `y.computer` for the narrative/landing and as the future managed-SKU brand — but the
  bytes live in You.md until there's real multi-user pull for managed compute.

### 9.4 Audit bottom line

The temptations Houston named are correctly resisted (no sandbox infra, no general harness),
and the audit shows the genuinely valuable moves are **small and mostly already built**:
- **Storage:** folder.md = optional pluggable media backend behind a brain pointer (one MCP
  handoff), not a dependency. Convex stays text-first.
- **Harness:** don't build a Cursor; *optionally* close the single-hop loop into a real
  iterative "You agent that acts across your brain/fleet" — ~20% net-new, lightweight, yours.
- **Compute:** keep it inside You.md (Linux daemon + unattended vault + a provision command);
  `y.computer` is a brand/control-plane wrapper, not a separate product. Hosted Mac mini works
  today; Linux VPS needs the daemon first.
