# Competitive Landscape + Positioning + Design Direction

**Date:** 2026-07-01
**Author:** coding-agent session (research → synthesis → shipped changes)
**Trigger:** Houston flagged three adjacent products — draftai.us, blume.codes, cofounder.co —
and asked: are they relevant, what have we actually built, what is the sharpest value prop, and
how should the design evolve. This doc answers all four and records the code shipped in response.

**Design references saved:** `project-context/design-references/blume/` (full page + hero +
illustration/mascot + product-UI crops, sliced from Houston's screenshot; the live sites hard-403
automated capture from our environment).

---

## 0. TL;DR

- The three products are all chasing the same thesis — *agents shouldn't start from scratch* — on
  **different axes of context**. None of them occupy You.md's axis.
- **You.md is not an "identity profile" anymore.** The code says it is **the synced brain and
  always-on conductor for one person's fleet of agents** — identity, skills, secrets, and projects
  identical on every machine and every harness, coordinating in real time. That is the thing to
  position and ship behind.
- **Design:** keep the pixel-ASCII / terminal core (it's the moat), and borrow the Blume/Cofounder
  *warmth* only at the human-facing edges (onboarding, profile, the portrait frame, live pixel
  agents). Two registers, one product.
- This session shipped the concrete moves that make the wedge demo real end-to-end (below, §5).

---

## 1. The three competitors

### Draft — draftai.us (`github.com/idodekerobo/draft`, MIT, macOS/Apple-Silicon)
Collaborative **team context** layer. A background daemon captures from **Granola (meetings),
Slack, and GitHub**, Claude synthesizes proposed context updates, the user **reviews them in an
inbox and accepts**, and accepted context is **injected into Claude Code / Cursor / Codex at
session start**. Team sharing via a curator pattern (one person publishes to a GitHub repo;
`draft load-team` pulls). Owns: **what your team/product knows.**

### Blume — blume.codes (warm-illustrated, desktop app + CLI, macOS/Apple-Silicon)
Two things: (a) a **per-repo agent-config manager** — "every skill, rule, and agent file across
Claude Code, Cursor, Codex, omp, Pi in one place"; reviews rules/skills/hooks **on-device**,
detects **drift**, and **proposes fixes you preview → approve/dismiss**; and (b) **live agent
observability** — "see what each coding agent is doing right now, the exact moment one finishes or
needs approval," plus provider-quota tracking. Its roadmap (page) pushes into **team "intent/domain
model"** territory — "Central domain model… source of truth for intent across your whole team,"
"Intent harvesting — Slack threads, meeting transcripts, code reviews," "Conflict resolution across
team." So Blume is **converging toward Draft** from the codebase-config side. Owns: **how your
agents are configured (per repo) + what they're doing right now.**

### Cofounder — cofounder.co (warm pixel-art)
"Run an entire company with AI — kicks off agents for milestones as you build." Adjacent in design
language (warm pixel-flower aesthetic that Blume echoes), not in substance. Owns: **AI-runs-the-company.**

### The map

| Product | Axis of context it owns | Trajectory / threat to us |
|---|---|---|
| **You.md** | *Who **you** are* + *your **fleet of agents*** — personal, portable, MCP-native | — |
| **Draft** | *Team/product knowledge* from meetings/Slack/GitHub | Low: team, not personal fleet |
| **Blume** | *Per-repo agent config* + *live agent observability*; drifting toward team intent | **Medium**: closest on **skills**; its observability is a feature we lacked |
| **Cofounder** | *AI operates a company* | Low on substance; relevant only as design reference |

**Recurring tell:** all three gate updates behind a **review/approve step** (Draft's inbox, Blume's
preview→approve/dismiss). You.md's `PRINCIPLES.md` — *auto-apply, no user homework* — is the
contrarian, more-defensible stance. Keep leaning on it hard; it is a differentiator, not a gap.

---

## 2. What You.md actually is (verified against the code, not the pitch)

A code-level audit (this session) confirms the shipped substrate:

- **Cross-machine agent bus** (`convex/agentBus.ts`) + **whitelist-only remote executor**
  (`cli/src/lib/remote-executor.ts` — typed actions, `shell:false`, no arbitrary exec, path
  containment). From one machine you spawn/monitor a worker on another and get results back,
  relayed through your own brain. No SSH, no external broker.
- **The YOU orchestrator** (`cli/src/lib/orchestrator/` — `supervisor.ts` + `loop.ts`): a
  **model- and harness-agnostic** plan→act→observe loop that launches Claude/Codex/Cursor as
  swappable *workers* and reports back. U is the **conductor, never the worker** — it competes with
  no harness because it sits above all of them.
- **Skills/stacks propagate across every machine AND every harness** via `.agent-shared` →
  Claude/Codex/Cursor mirrors (`cli/src/commands/skills.ts`, `host-link.ts`). Improve once, it's
  everywhere.
- **Secrets follow the brain** (zero-knowledge trusted-device envelopes) so a new host
  self-configures without pasting keys (`convex/secretVault.ts`, `cli/src/commands/env.ts`).
- **folder.md** wired as the zero-paste, auto-provisioned **media/large-file lane**
  (`cli/src/lib/foldermd.ts`, `convex/folderMd.ts`): brain stays text + pointers, bytes live in
  folder.md; `store_media`/`get_media` MCP tools let any agent offload a file.
- **A resident daemon** (`cli/src/lib/daemon.ts`) that self-upgrades and keeps identity, skills,
  context, and the orchestrator report-back running on an interval (launchd + systemd).

**The customer this is really for** (Houston's own words, `cli/CLAUDE.md`): *"I run 6+ AI agents
daily across 4 projects. Every one starts from scratch."* Not "a person who wants a profile" — the
**AI-native operator running many agents, many harnesses, many machines, many projects**, who is
being turned into the operator (copying context, relaying work, re-pasting secrets). That pain is
unowned by Draft/Blume/Cofounder.

---

## 3. The positioning

**Protocol line (keep):** *You.md — an MCP where the context is you.*

**Fleet line (lead with this for the real product):**
> **You.md is the synced brain and conductor for your fleet of agents — the same identity, skills,
> secrets, and projects on every machine and every harness you run, coordinating in real time.
> You conduct; they work.**

**The wedge demo that makes it undeniable** (every piece exists; §5 closes the last gaps):
> *"From my laptop I tell U to fix the failing CI on a project checked out on my other machine. U
> spawns Claude there, watches it, reports back when it's green — and the skill it learned is on all
> my machines by morning. I never touched the other machine."*

This is **federation of your own machines around a personal brain** — a topology none of the
competitors have (they orchestrate inside one runtime, or capture one team's knowledge).

---

## 4. Design direction: two registers, one product

Seeing the Blume crops corrected the earlier read: Blume is a **dark-navy hero with a literary
serif** headline over **warm-cream** body sections, **hand-painted forget-me-not botanicals**, and
**rounded robot mascots whose bodies are status-colored (green/yellow/gray)** — which is *exactly*
our `PixelCharacter` machine/agent/shell + status-pixel concept, just made charming. Cofounder is
the pixel-flower cousin.

**Rule:** keep the terminal-native core (monochrome + burnt orange #C46A3A, JetBrains Mono, 2px
radius, ASCII portraits). Add warmth **only where a human is present**:

| Surface | Direction |
|---|---|
| Human-facing (landing hero, onboarding, public profile, portrait frame) | Warm cream light-mode as a first-class surface (our light tokens are already warm beige); a literary-serif display is on-brand for hero moments; ASCII portrait stays the person, warmth in the frame. |
| Pixel agents / machines | Make `PixelCharacter` **cuter and alive** — this is the cheapest high-impact win; we already own the system, it was just too austere to love. **Shipped this session (§5).** |
| Machine / ops surfaces (dashboard, live log, shell, vault) | Stay hard terminal. This is the moat; do not soften. |

Burnt orange stays the only accent — warmth comes from cream surfaces, soft motion, and charming
pixel agents, never a second color.

---

## 5. Shipped this session (code, verified where possible)

All changes are on branch `claude/draft-ai-research-7mvycw`. CLI build clean; CLI unit tests green
(661 pass; the only failures are 7 pre-existing network-integration tests that need live you.md
endpoints, which this sandbox's egress blocks); frontend `tsc --noEmit` clean.

1. **Orchestrator brain-aware routing** — `cli/src/lib/orchestrator/tools.ts` adds read-only brain
   tools `get_identity`, `list_projects`, `get_project` (reusing `api.ts` `getMe`/`getPortfolioGraph`),
   wired into `you orchestrate run` so U resolves a goal → the right project/repo/machine/harness
   *before* spawning. 12 new unit tests. *Verified: build + tests.*

2. **Live Agents / Attention Queue widget** — `src/components/panes/LiveAgentsPane.tsx` +
   read-only auth-scoped Convex query `convex/agentActivity.ts` (`liveAgents`, reads the
   `agent-bus`-sourced `brainActivities` mirror). Surfaces running/finished workers with a
   `PixelCharacter` avatar + an "needs you" attention section — our answer to Blume's "watch every
   agent." Wired into the dashboard (nav chip + render switch). *Verified: tsc.* (Runtime data
   render pending a live dashboard.)

3. **PixelCharacter warmth pass** — friendlier creatures (big eyes, status antenna, warm blush
   cheek cell, little smile), a quiet **alive-bob that only runs for live agents** (motion signals
   real state per BRANDING.md), extended `globals.css`, fully reduced-motion-safe. Same props API,
   no breakage. *Verified: tsc.* (Visual QA pending a render.)

4. **Gap — Linux daemon always-on** — `src/app/install.sh/route.ts`: resident-daemon auto-install
   now **defaults ON for Linux hosts with systemd --user** (a rented VPS becomes a live fleet peer
   from `you.md/install.sh` with zero steps), opt-in elsewhere, overridable via `YOU_INSTALL_DAEMON`.
   *Verified: tsc.* (Needs one live proof on a real VPS.)

5. **Gap — Secret Vault receiving-side auto-restore** — the missing half of the handshake. The
   source device already auto-*shares* envelopes to new trusted devices, and fresh hosts already
   *device-register*; but nothing *applied* the envelope — the daemon just printed a manual command
   (user homework). New `cli/src/lib/vault-autorestore.ts` (pure decision fn + safe argv) wired into
   the `you sync --live` daemon: once an envelope exists for this host it auto-runs
   `you env vault pull --restore --map-existing --existing-only --skip-agent-auth` (the
   `--existing-only` flag is the safety belt — it can only write `.env.local` into projects that
   already exist here). Opt-out via `YOUMD_LIVE_SYNC_VAULT_RESTORE=0`. 10 new unit tests on the
   decision logic. *Verified: build + tests.* (Needs one live Keychain/vault round-trip proof, like
   the original vault ship did.)

---

## 6. Honest verification frontier

This sandbox can't deploy, can't reach the live you.md/folder.md endpoints (egress-blocked), can't
run a real systemd Linux host, and can't render the Next app for visual QA. So the following are
**coded + typechecked + unit-tested but need one live proof each** before being called done (per
`CLAUDE.md`'s "done means verified in practice"): Linux daemon auto-install on a real VPS; vault
auto-restore end-to-end with a real envelope; the LiveAgentsPane rendering real worker data; and the
PixelCharacter visual pass. None are speculative in logic; all reuse proven patterns already in the
repo.

---

## 7. Next moves (proposed, not yet done)

- **Prove the wedge demo** end-to-end on a real second machine (laptop → VPS): CI-fix delegation +
  overnight skill propagation. That single recording sells the whole product.
- **Capability map** (orchestrator roadmap #5): "which harness is best at coding/research/design"
  so U picks the executor, seeded from `.agent-shared` skill metadata.
- **Warm the human funnel**: apply §4 to the landing hero + onboarding (cream surface, serif hero,
  the new pixel agents) — a focused design pass, not a repaint.
- **Steal Blume's provider-quota tracking** into the Live Agents pane (know how much Claude/Codex/
  Cursor budget is left across the fleet).
