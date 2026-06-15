# GitHub-Native, Agent-Managed You.md — Comprehensive Plan

Source: Houston's 2026-06-15 vision drop. This is the verbatim breakdown of
EVERY requirement, structured as one main goal + sub-goals, each with explicit
acceptance/verification criteria and a map to existing code. Drives the
multi-agent build (orchestrator = main session; sub-agents per sub-goal, each
verified before its sub-goal is marked done).

---

## THE ONE MAIN GOAL

When a user connects GitHub, their **full You.md lives in a dedicated
`{username}-you-md` GitHub repo that the You agent autonomously manages** (auto
PR + auto-merge + self-conflict-resolution — for THAT repo only). Connecting
GitHub kicks off a guided, alive onboarding that: creates the repo, analyzes
their active GitHub projects and tracks them privately with AI insights, proves
the web↔local↔any-agent round-trip over API/MCP/YouStack, and only at the very
end asks what to surface publicly. The shell's information architecture is fixed
so Brain/Files make sense and content is the GitHub repo (mirrored to DB as
needed).

---

## SUB-GOALS (every requirement, nothing dropped)

### SG0 — Auth redirect bug  ✅ DONE (cb4997a)
- R0.1 Sign-in hung at "redirecting…" after `✓ authenticated`. Cause: SPA
  `router.push(next)` while client auth state stale → `/shell` guard bounced.
- R0.2 Fix: hard `window.location.assign(next)` on sign-in + sign-up so the new
  session cookie is read server-side and the auth context initializes signed-in.
- Verify: sign in via email → lands on `/shell` with no manual URL typing.

### SG1 — GitHub presence in the shell (un-bury it)
- R1.1 GitHub icon at the **top-right of the shell** (not in account settings).
- R1.2 Icon shows a **small warning indicator when youmd is NOT connected** to GitHub.
- R1.3 Clicking it opens the GitHub integration flow / tab.
- Map: `convex/github.getConnection` already exposes connection state; shell top
  bar component needs the icon + `useQuery(getConnection)` warning dot.
- Verify: not-connected → warning dot; connected → clean icon; click → flow opens.

### SG2 — Post-GitHub-auth guided flow (immediate, not silent)
- R2.1 After GitHub OAuth redirects back, do **not** just load `/shell` silently.
- R2.2 Immediately open a **new `integrations`/`github` shell tab** with simple steps.
- R2.3 The flow **creates the `{username}-you-md` repo**, showing steps to completion.
- R2.4 Show a real **success message** (today there is none).
- R2.5 The **You agent congratulates** the user in chat on their new you.md repo.
- R2.6 The agent **explains** how API/MCP/YouStack skills — once installed locally,
  on any machine, or shared via context link — now work with any agent.
- Map: callback now links to current user (done earlier). Need: redirect to
  `/shell?integration=github&step=create-repo`; new pane; `githubRepo.createRepo`.

### SG3 — You-agent next-steps protocol (after GitHub connect)
- R3.1 Encourage **install via the curl command** if not done already.
- R3.2 **Verify the local↔web agent connection.**
- R3.3 Give the user an **exact prompt to paste into their local agent** that
  (a) connects to the API/MCP and (b) sends a synced upstream update.
- R3.4 The web You agent **detects + confirms** the local→web connection works
  when that upstream update arrives.
- Map: needs a server signal/event when the local CLI (via MCP/API) writes an
  upstream update tagged to this user; the chat surfaces a "local connected ✓".

### SG4 — Active-projects GitHub analysis + private tracking (MAIN use case, FIRST)
- R4.1 Automatically analyze the user's **most active GitHub repos, last 30–90 days**.
- R4.2 Identify the most active projects.
- R4.3 **Pull them into the private `{username}-you-md` repo as tracked active projects.**
- R4.4 Respond with **intelligent insights**: what each project is/does + recent work.
- R4.5 **Stream the updates in chat** AFTER the agent commits/pushes to the repo.
- R4.6 Do this BEFORE any public-profile question (it's the primary value).
- Map: GitHub API (commits/activity per repo, scoped by date) + LLM summarization;
  write tracked-projects into the repo; stream via existing chat SSE.

### SG5 — Public profile selection (LAST, lower priority)
- R5.1 As the **final** question, ask which active projects to **share some info
  about on the public profile**.
- R5.2 Ask which to keep **private/stealth — not even listed** in projects.
- Map: per-project visibility flag on the tracked-projects model + profile render.

### SG6 — Local↔remote round-trip detection
- R6.1 After the agent pushes to `{username}-you-md`, the user's **local agent**
  (curl-installed + MCP-connected) **auto-detects the updated remote repo sync**.
- R6.2 The local agent **mirrors the structured update summary** locally.
- Map: `youmd sync`/`youmd stack sync` already pull; add repo-change detection +
  surfacing the structured summary in the local agent output.

### SG7 — The `{username}-you-md` repo: autonomous-managed setup (CRITICAL)
- R7.1 Repo is **truly set up to spec** — the user's **full you.md lives in it**.
- R7.2 The agent **controls it fully — for THIS repo only**.
- R7.3 User authorizes **automatic PRs + merges** that keep it always in sync.
- R7.4 System **resolves conflicts itself — only on the you-md repo**.
- R7.5 Changes from the You agent / other agents (with youstack/youmd installed)
  go through **regular PRs/merge requests** (standard process) — auto-merge is
  reserved for the you-md repo content.
- R7.6 The youmd **API/MCP/stack can autonomously manage the full content** of this repo.
- Map: define the canonical repo layout (identity bundle + tracked projects +
  stacks + context); GitHub App or OAuth `repo` scope for write; an
  auto-merge/conflict-resolve policy scoped to this repo only; webhook → pull.

### SG8 — Shell IA fix (Brain vs Files)
- R8.1 The **Brain tab currently just shows the profile — it should NOT**.
- R8.2 Files has **brain files + history** sub-tabs.
- R8.3 Make Brain vs Files **coherent** (current IA "doesn't make sense").
- R8.4 Files should be **synced/mirrored + saved in the DB AND on GitHub** — or
  **just GitHub** going forward for simplicity (decision needed).
- Map: audit current pane routing (Brain pane shows ProfilePane?); redesign IA so
  Brain = the actual brain/memory/identity content, Files = the repo-backed files.

### SG9 — Orchestration (meta)
- Main session = orchestrator: hold the goal, spawn sub-agents per sub-goal,
  verify each sub-agent's output against the acceptance criteria before marking done.

---

## PROPOSED PHASING (each phase = parallel sub-agents, orchestrator-verified)

- **Phase A — Investigate/ground** (read-only sub-agents): current shell IA &
  panes (Brain/Files), the github repo provisioning code (`githubRepo.ts`,
  `github.ts`), the chat/agent next-steps system, the `{username}-you-md` layout
  the repo *should* have. Output: precise build specs per sub-goal.
- **Phase B — Backend** : `{username}-you-md` repo provisioning to canonical
  layout (SG7), active-project analysis + tracking write (SG4), auto-PR/merge +
  conflict policy scoped to the you-md repo (SG7), local-connection detection
  signal (SG3/R3.4), round-trip detection (SG6).
- **Phase C — Frontend** : shell GitHub icon + warning (SG1), integrations/github
  tab + guided create-repo flow + success (SG2), Brain/Files IA fix (SG8),
  streaming insights in chat (SG4/R4.5), public-profile selection as last step (SG5).
- **Phase D — You-agent protocol** : congratulations + capability explanation
  (SG2/R2.5-6), curl-install nudge + exact paste-prompt + connection verify
  (SG3), project-insights narration (SG4/R4.4).
- **Phase E — Verify end-to-end** : connect GitHub → repo created → projects
  analyzed + pushed → chat streams insights → local agent detects + mirrors →
  public-profile question last. Orchestrator confirms each acceptance criterion.

## OPEN DECISIONS (flag to Houston)
1. **Repo write mechanism**: OAuth `repo` scope (works today) vs a GitHub App for
   least-privilege per-repo auto-merge. App is the "proper" autonomous-manage
   answer for R7.3-7.6 but is more setup.
2. **Files storage**: DB+GitHub mirror vs **GitHub-only** going forward (R8.4).
3. **Auto-merge scope guardrail**: confirm auto-merge/conflict-resolve is ONLY
   ever the `{username}-you-md` repo; everything else stays PR-gated (R7.4-7.5).

---

## VERIFIED LIVE (2026-06-15, in @houstongolden's account)

- **SG0** sign-in redirect — fixed (hard-nav).
- **SG1** GitHub icon + not-connected warning dot — works (dot clears on connect).
- **SG2** connect GitHub → `/shell?integration=github` → guided onboarding renders.
- **SG7** `houstongolden-you-md` created (canonical layout: README, identity/,
  projects/, stacks/, context/, you.md, you.json). Autonomous PR/auto-merge
  VERIFIED: `agentPushViaPR` opened branch -> PR #1 "chore(projects): sync 10
  active projects" -> AUTO-MERGED.
- **SG4** active-project analysis + AI insights for 10 repos; written into
  `projects/<name>.md` in the repo via the merged PR.
- **SG5** public/private selection step renders (private default).
- **Sync directions verified**: web->repo (auto-push/PR merge), web->local (`youmd pull`).

### CRITICAL ROOT-CAUSE FIX (do not lose)
GitHub connect was fully broken because **`TRUSTED_INTERNAL_AUTH_TOKEN` was set
on Convex but NOT on Vercel**. The OAuth callback runs on Vercel and bailed with
`github_server_misconfigured` before linking. FIX: set
`TRUSTED_INTERNAL_AUTH_TOKEN` on Vercel (same value as Convex) — any new
Vercel project/env MUST have it. Also `GITHUB_WEBHOOK_SECRET` set on Convex
prod (for inbound push -> mirror).

### REMAINING (machinery exists, not yet fully verified live)
- **#3 full round-trip**: local push -> web -> repo (local CLI push currently
  guarded by a stale-local-bundle check; needs pull+edit+--force) and the
  realtime repo->webhook->Convex->local pull.
- **#4** per-project write-scope to each project's `project-context/` + a
  `you.md/` change log dir.
- **#6** multi-agent concurrency.

---

## CLEAN UI DEMO VERIFIED (2026-06-15) + PRECISE REMAINING (for a focused follow-up)

### Verified END-TO-END through the browser UI (watchable, not just API)
- Clicked "push to repo" in the shell -> green "pushed you.md, you.json to your
  repo." + "synced just now" -> backend opened **PR #2 "sync identity from
  you.md" -> AUTO-MERGED**. New PR appeared from the UI click. Full loop
  (UI action -> branch -> PR -> auto-merge -> repo -> UI confirm) verified.

### Precise remaining (each with the SIMPLE fix)
1. **local -> web -> repo push** — BLOCKED BY DATA-SAFETY GUARD (correct):
   `~/.youmd` is an 8KB stub vs the 583KB published profile, so push refuses
   (would wipe the profile). FIX: fully restore the local bundle first
   (`youmd pull` currently restores files but not the full compiled bundle —
   the local bundle state is incomplete). Do NOT `--force` push until restored.
2. **SG3 post-connect chat protocol** — NOT FIRING. The agent greets with a
   project-scaffolding message instead of the github-connected protocol
   (congratulate + curl nudge + paste-prompt). `buildGithubConnectedProtocol`
   exists in agent-utils.ts and is wired via `githubRepoName` in useYouAgent.ts,
   but the greeting branch isn't selected. FIX: debug the greeting-branch
   selection in useYouAgent.ts (the github branch must win over the proactive
   project greeting when githubRepoName is set).
3. **SG6 realtime repo->local** — webhook (GITHUB_WEBHOOK_SECRET set) +
   `youmd pull` cover most of it; the local daemon `youmd sync` pulls. Needs a
   live verification + surfacing a structured "remote updated" summary.
4. **#4 per-project project-context write-scope** — NOT BUILT. Simplest version:
   tracked-project files already at `projects/<name>.md`; the "agents write to
   each project's project-context/ + a you.md/ change-log dir" is the new piece.
5. **#6 multi-agent concurrency** — largely covered by the you-md-repo
   PR/auto-merge (each agent's write is a PR); needs a concurrent-write test.

### Standing env requirement (root cause, do not lose)
`TRUSTED_INTERNAL_AUTH_TOKEN` MUST be set on **Vercel** (not just Convex) or
GitHub connect breaks silently (`github_server_misconfigured`).
