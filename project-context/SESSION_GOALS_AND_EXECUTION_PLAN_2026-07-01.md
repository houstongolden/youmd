# Session Goals, Intent, Work Log & End-to-End Execution Plan

**Date:** 2026-07-01
**Session:** competitor research (Draft/Blume/Cofounder) → product clarity → gap-closing build → PR #63
**Branch:** `claude/draft-ai-research-7mvycw` · **PR:** https://github.com/houstongolden/youmd/pull/63 (draft, CI green, watched)
**Companion doc:** `COMPETITIVE_AND_POSITIONING_2026-07-01.md` (the teardown + positioning itself)

This file is the session's full record: Houston's goals and intent per message, everything researched,
everything designed, everything shipped with status, and the detailed plan for what happens next.

---

## 1. Houston's goals & intent (distilled from every message, in order)

1. **Research draftai.us** (site, GitHub `idodekerobo/draft`, docs) — "seems like they're trying to
   solve similar problems as us." → Is it relevant/competitive?
2. **Research blume.codes** — "similar or relevant for insights and/or competitor research…
   the design is also super nice, love that style." → Competitive read AND design read.
3. **Uploaded the full Blume page screenshot** → analyze the real design, not search snippets.
4. **The big reframe message** (the load-bearing one):
   - Blume's aesthetic is "almost a knockoff of **Cofounder.co**" (warm pixel flowers) — screenshot
     Cofounder too.
   - **Look deeper at what you.md is actually doing** — recent commits and features, not the surface
     pitch.
   - It's **not "team" in the traditional sense** — it's built for **a team of ONE human** (though he
     still has humans at BAMF and clients in Slack/Notion). You.md currently solves **his own team of
     AGENTS**: skills syncing, multiple projects, multiple computers and environments.
   - **The YOU agent is an orchestration layer** that can manage any agentic harness — **harness- and
     model-agnostic** — helping agents work across machines and projects, **continuously update,
     self-improve, and coordinate**.
   - **folder.md** (his other project) gives agents **persistent larger file storage** shared across
     projects and agents — native integration matters.
   - **Drill down**: what's next, what we've built that is **most valuable and novel**, and how to
     leverage "it works for me personally" into a **focused value prop + pain point → product clarity**.
   - **Design**: we have pixelated ASCII portraits + pixel-art agent animations. Evolve toward the
     **warm pixel-art human style of Cofounder/Blume** — fine with it **as long as we retain the core
     pixelated ASCII style** and **keep ASCII/pixel portraits for humans**.
   - Bottom line: **"really need to get clarity on the product direction so we can ship something useful."**
5. **"Go deeper and DO everything"** — execute every recommended next step end-to-end, fix all honest
   gaps, write the project-context doc fully, take action on every single thing.
6. **"Continue comprehensively fully exhaustively end to end boil the ocean."**
7. **This message** — document all goals/intent/research/design/tasks with statuses + a detailed
   end-to-end plan for what's next; then await "continue" to execute.

**Standing constraints from CLAUDE.md/PRINCIPLES.md honored throughout:** autonomous-first (no user
homework, no approve-gates for safe reversible work), no forms, terminal-native design with one
burnt-orange accent, address every part of every message, nothing marked DONE until verified.

---

## 2. Research delivered (full findings in the positioning doc)

| Product | What it is | Axis it owns | Verdict for You.md |
|---|---|---|---|
| **Draft** (draftai.us, MIT, macOS/AS) | Daemon captures Granola/Slack/GitHub → Claude synthesizes → **inbox review/accept** → injected into Claude Code/Cursor/Codex at session start; team sharing via curator + GitHub repo | *Team/product knowledge* | Adjacent, low threat; validates the "stop re-explaining" thesis |
| **Blume Sidecar** (blume.codes, macOS/AS) | Per-repo agent-config manager (skills/rules/hooks across Claude Code/Cursor/Codex/omp/Pi), drift detection, **preview→approve/dismiss**, on-device; PLUS **live agent observability** ("the exact moment one finishes or needs approval") + provider-quota tracking; roadmap: team "intent/domain model" harvested from Slack/meetings (converging toward Draft) | *Per-repo agent config + live observability* | Closest competitor at the **skills** seam; its observability was a real feature gap for us (now closed, §4) |
| **Cofounder** (cofounder.co) | "Run an entire company with AI — kicks off agents for milestones"; warm pixel-art aesthetic that Blume echoes | *AI-runs-a-company* | Low substance overlap; **design reference** (screenshot still needed — egress-blocked here) |

**Recurring tell across all three:** every one gates updates behind a human review/approve step. You.md's
auto-apply / no-homework stance (PRINCIPLES.md) is the contrarian moat. Keep it.

**Design truth from the Blume crops** (saved in `project-context/design-references/blume/`): dark-navy
hero + **literary serif display** headline → **warm cream** body; hand-painted forget-me-nots; rounded
robot mascots with **status-colored bodies** — which is exactly our `PixelCharacter` concept, made
charming. Cofounder is the pixel-flower original of the vibe.

---

## 3. What You.md actually is (code-verified this session)

Not an "identity profile." The shipped substrate is:

- **Cross-machine agent bus** (`convex/agentBus.ts`) + **whitelist-only remote executor**
  (`cli/src/lib/remote-executor.ts`: typed actions, `shell:false`, path containment) — spawn/monitor a
  worker on another of your machines through your own brain relay. No SSH, no broker.
- **YOU orchestrator** (`cli/src/lib/orchestrator/`): model- & harness-agnostic plan→act→observe loop
  driving Claude/Codex/Cursor as swappable **workers**. U is the conductor, never the worker.
- **Fleet-wide skill propagation**: `.agent-shared` → Claude/Codex/Cursor mirrors on every machine.
- **Secrets follow the brain**: zero-knowledge trusted-device vault envelopes.
- **folder.md** as the zero-paste auto-provisioned media lane (brain = text + pointers; bytes in
  folder.md; `store_media`/`get_media` MCP tools for any agent).
- **Resident daemons** (5): realtime sync, identity, skills/stacks, context, orchestrator report-back;
  self-upgrading.

**Positioning (proposed, awaiting Houston's sign-off):**
> **You.md is the synced brain and conductor for your fleet of agents — the same identity, skills,
> secrets, and projects on every machine and every harness you run, coordinating in real time.
> You conduct; they work.**
(Protocol line kept: *an MCP where the context is you.*)

**Wedge demo:** *"From my laptop I tell U to fix failing CI on a project on my other machine. U spawns
Claude there, watches it, reports back green — and the skill it learned is on all my machines by
morning. I never touched the other machine."*

**Design direction:** two registers, one product. Human-facing edges (landing hero, onboarding, public
profile, portrait frame, pixel agents) get the Cofounder/Blume warmth — cream surfaces, charming pixel
creatures, possibly a serif display for hero moments (a deliberate BRANDING amendment, see Phase D).
Machine/ops surfaces (dashboard core, live log, shell, vault) stay hard terminal. Burnt orange remains
the only accent. ASCII/pixel portraits stay THE representation of humans.

---

## 4. Task ledger — everything, with status

**Legend:** ✅ DONE-VERIFIED (built + checked here) · 🟡 CODE-COMPLETE (built, typechecked, unit-tested;
needs one live proof) · 🔵 IN PROGRESS/ARMED · ⭕ NOT STARTED · 🔴 BLOCKED (needs Houston or environment)

### Research & strategy
| # | Task | Status |
|---|---|---|
| R1 | Draft teardown (site/repo/docs) | ✅ |
| R2 | Blume teardown (search + Houston's screenshot) | ✅ |
| R3 | Blume UI crops → sent + saved to `design-references/blume/` | ✅ |
| R4 | Cofounder screenshot + design analysis | 🔴 egress-blocked here (403 for browser + WebFetch); product researched via search; **needs Houston to drop a screenshot** |
| R5 | Deep audit of recent commits/features (orchestrator, cross-machine, vault, folder.md, daemons) | ✅ file:line-verified |
| R6 | Positioning doc `COMPETITIVE_AND_POSITIONING_2026-07-01.md` | ✅ written & committed |
| R7 | Positioning headline sign-off | 🔴 awaiting Houston |

### Code shipped (PR #63 — CI green, Vercel preview Ready)
| # | Task | Status |
|---|---|---|
| C1 | Orchestrator brain-aware routing: `get_identity`/`list_projects`/`get_project` LoopTools (reuse `getMe`/`getPortfolioGraph`), wired into `you orchestrate run`; +12 tests | ✅ build + tests green (live-LLM behavior mocked, see V3) |
| C2 | Live Agents / Attention Queue widget: `LiveAgentsPane.tsx` + read-only auth-scoped `convex/agentActivity.ts#liveAgents` (agent-bus `brainActivities` mirror); wired into dashboard nav + render switch | 🟡 tsc + Vercel build clean; needs live render w/ real worker data |
| C3 | PixelCharacter warmth pass: eyes/antenna/blush/smile, alive-bob only for live agents, reduced-motion-safe; same props API | 🟡 tsc clean; needs visual QA |
| C4 | Linux daemon always-on: `install.sh` auto-installs resident daemon by default on Linux+systemd hosts (`YOU_INSTALL_DAEMON` overridable) | 🟡 needs one live VPS proof |
| C5 | Secret Vault receiving-side auto-restore: `cli/src/lib/vault-autorestore.ts` wired into `you sync --live` (auto `vault pull --restore --map-existing --existing-only --skip-agent-auth` once an envelope exists; opt-out `YOUMD_LIVE_SYNC_VAULT_RESTORE=0`); +10 tests | 🟡 needs one live vault round-trip proof |
| C6 | CHANGELOG.md + feature-requests-active.md entries (#147–153) | ✅ |
| C7 | Commit → push → **draft PR #63** | ✅ Vercel Ready (full `next build` + `docs:check` passed in CI) |
| C8 | PR watch: subscribed + hourly silent cron check-in (job `75d4a13c`) until merged/closed | 🔵 armed |

### Verification frontier (each needs exactly one live proof; logic is done + tested)
| # | Item | Blocker |
|---|---|---|
| V1 | Linux daemon auto-install on a real VPS | needs a live host (Houston or a rented box) |
| V2 | Vault auto-restore end-to-end with a real envelope | needs live Keychain/vault |
| V3 | Orchestrator live-LLM multi-step tuning pass | needs live you.md chat proxy |
| V4 | LiveAgentsPane rendering real worker data | needs live dashboard/Convex |
| V5 | PixelCharacter visual QA | partially unblockable HERE via local static render (Phase E) |

### Session protocol (CLAUDE.md) — remaining hygiene
| # | Item | Status |
|---|---|---|
| P1 | TODO.md update | ⭕ |
| P2 | FEATURES.md update | ⭕ |
| P3 | PROMPTS.md — append Houston's messages from this session | ⭕ (remote env lacks his local JSONL path; messages will be reconstructed from this conversation) |

---

## 5. End-to-end plan for what's next (execute on "continue")

Ordered so autonomous work lands first and Houston-blocked items are batched at the end.

**Phase A — Protocol hygiene (fast, required).**
Update `TODO.md` and `FEATURES.md` for everything in §4; append this session's Houston messages to
`PROMPTS.md` under a `## Session:` heading with timestamps and update its header totals.

**Phase B — Capability map (orchestrator roadmap #5; buildable now).**
A declarative harness-capability registry (which worker is best at coding vs research vs design vs
planning; config, not forks — `YOU_HARNESS_*` compatible), seeded from `.agent-shared` skill metadata
where available, exposed to the loop as a read-only `get_capabilities` tool + used as a spawn-time
default so **U picks the executor, not the user**. Unit tests. CLI build + suite must stay green.

**Phase C — Provider-quota groundwork in Live Agents (the Blume steal).**
Extend `liveAgents` (or a sibling read-only query) + the pane with a "providers" strip (Claude/Codex/
Cursor budget-left) rendered from whatever usage rows already exist in Convex; where no data source
exists yet, ship the typed contract + empty-state and a CLI-side collector stub documented as the
follow-up — no fake numbers.

**Phase D — Warm the human funnel (design pass, honoring "retain the pixel-ASCII core").**
Landing hero + onboarding: make the warm-cream light surface a first-class register on human-facing
sections; deploy the warmed PixelCharacters; keep ASCII portrait as the person. The serif display is a
brand-rule change — implement it scoped to hero moments AND amend `BRANDING.md`/`STYLE_GUIDE.md`
(v2.4) in the same commit so the system stays coherent; everything else (orange-only accent, 2px
radius, no emoji, mono labels) unchanged. `check:radius` + lint must pass.

**Phase E — Visual QA harness (unblocks V5 from inside this sandbox).**
Egress is blocked but localhost isn't: build a small static HTML page that replicates the
PixelCharacter patterns/CSS (all kinds × statuses × sizes, old-vs-new side-by-side), render it with the
pre-installed local Chromium, screenshot, and send the PNGs to Houston for sign-off. Same trick for a
mock-data LiveAgentsPane if feasible without Convex.

**Phase F — Wedge-demo runbook.**
A copy-paste runbook (extending `MULTICOMPUTER_OPERATOR_RUNBOOK`) for the laptop→VPS demo: enroll a
cheap Linux host via `install.sh` (daemon now auto-installs — C4), watch the vault auto-restore (C5),
then `you orchestrate run` a CI-fix with brain-routing (C1) and watch report-back + the Live Agents
pane (C2). This is the script for the recording that sells the product, and it doubles as the live
proof for V1/V2/V4.

**Phase G — Docs surfaces + ship prep.**
Update `MACHINE-SYNC-SETUP.md`/runbook for the new daemon + vault-restore defaults; run
`npm run docs:check` (+ regenerate if drift); bump CLI `0.9.0 → 0.9.1` (`npm version patch
--no-git-tag-version`) + build, so it's publish-ready — **actual `npm publish` needs Houston's OTP**.

**Phase H — Land it.**
Commit each phase conventionally, push to `claude/draft-ai-research-7mvycw`, update PR #63's
description, keep the cron watcher re-arming until merge.

**Blocked-on-Houston batch (say the word / drop the file):**
1. Positioning headline sign-off (R7). 2. Cofounder screenshot (R4). 3. Run the Phase-F runbook on a
real second machine → closes V1/V2/V4 (V3 rides along). 4. `npm publish --otp=CODE` when Phase G is
done. 5. Merge PR #63 when satisfied.

---

*Everything in Phases A–H is autonomous from this environment. The four live proofs and the publish
OTP are the only human-gated steps, by design.*
