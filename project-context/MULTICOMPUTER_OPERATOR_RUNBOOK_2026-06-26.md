# Multi-Computer You.md — Operator Runbook

**Date:** 2026-06-26
**Audience:** Houston (and future agents) standing up + driving the multi-computer orchestrator.
**Scope:** the exact commands to run. Everything here is shipped in `cli/` on branch
`claude/umd-multicomputer-agents-m1cdwo` (PR #60). Live steps are marked ⟶ LIVE.

> Mental model: **you.md is the synced brain. Your computers are interchangeable workers.**
> One machine's You agent (the **conductor**) launches/monitors worker harnesses (Claude
> Code, Codex, Cursor) on any of your machines, and reports back. folder.md is the media lane.

---

## 0. One-time: each machine joins the brain

⟶ LIVE — on every machine you own or rent:
```bash
curl -fsSL https://you.md/install.sh | YOU_API_KEY=<key> YOU_INSTALL_DAEMON=1 bash
```
- Installs the runtime, authenticates, syncs identity/skills/stacks/context, wires MCP for
  Claude/Codex/Cursor, writes a machine proof, and installs the resident daemons.
- **macOS** → launchd; **Linux VPS** → systemd `--user` (auto-detected). On Linux the installer
  enables `linger` so daemons survive logout on a headless box.
- The 5 resident daemons: realtime brain (live ws), skills/stacks (5m), identity (5m),
  project-context (15m), **orchestrator report-back (60s)**.
- Verify: `you stack daemon status` (shows loaded state + last activity per daemon).

Key scopes: the API key needs `remote:command` to dispatch/receive cross-machine commands
(opt-in scope, excluded from default keys). `vault` if you want secret sync.

---

## 1. Turn a machine into a worker host

A host is remotely *observable* by default (status/list/output), but will NOT run a
remotely-triggered autonomous worker until its owner opts in.

⟶ LIVE — on the host you want to accept remote work (e.g. the office Mac mini or VPS):
```bash
you orchestrate host on        # durable; the daemon reads this from config, not shell env
you orchestrate host status    # confirm: "remote worker host: enabled"
```
Kill switch: `you orchestrate host off`, or set `YOU_REMOTE_AGENT_HOST=0` (hard override).

---

## 2. Drive workers — locally

```bash
# launch a worker harness on a task in a project
you orchestrate spawn "implement the failing lint fixes" --harness claude --project youmd
you orchestrate list                 # see workers + status
you orchestrate logs <workerId>      # tail its captured output
you orchestrate stop <workerId>      # stop it
you orchestrate prune                # drop old finished workers
```
Harnesses: `claude` (`claude -p`), `codex` (`codex exec`), `cursor` (`cursor-agent -p`),
`custom` (local only). Override the binary per harness with `YOU_HARNESS_CLAUDE|CODEX|CURSOR`.

---

## 3. Drive workers — across machines

⟶ LIVE — from your MacBook, targeting another host:
```bash
you remote list                                   # your synced machines
you remote run <host> agent.spawn  --harness claude --project youmd --goal "fix lint"
you remote run <host> agent.list
you remote run <host> agent.output --id <workerId>
you remote run <host> agent.stop   --id <workerId>
```
`agent.spawn`/`agent.stop` require the target to have run `you orchestrate host on` (§1).
Transport is the Convex-relayed agent bus; the target's resident daemon executes and replies.

---

## 4. Autonomous orchestration (the conductor decides)

```bash
you orchestrate run "check my youmd PR is green; if lint fails, have a worker on the mini fix it"
```
The loop calls `list_machines` to discover targets, picks a harness, spawns (locally or via
`machine=<host>`), tails output, and reports back — until it calls `finish`. Model-agnostic
(uses the you.md chat proxy, or your OpenRouter key). Tune steps with `--max-steps`.

---

## 5. Always-on report-back

The `com.you.orchestrator-watch` daemon runs `you orchestrate watch --once` every 60s and posts
a `worker-complete` message (report-once) to the agent-bus `orchestrator` channel — so when a
worker finishes/fails, you see it on any machine. Manual: `you orchestrate watch` (foreground)
or `--once`.

---

## 6. Large files & media (folder.md)

```bash
you storage setup <fmd_live_…>            # one-time (until autonomous /provision lands)
you storage push ./demo.mp4               # uploads; prints a BrainMediaPointer to save
you storage list
you storage pull <fileId> ./demo.mp4
```
Any agent can do the same via the MCP tools `store_media` / `get_media`. The brain stores only
the pointer string; bytes live in folder.md (text-first brain stays under its ~1MB cap).

---

## 7. Security model (recap)

- **Owner-scoped:** all cross-machine reach is single-`userId`; no cross-user by construction.
- **Whitelist executor:** remote machines can only trigger the fixed action table
  (`git.*`, `agent.*`) via argv arrays + `shell:false` + path containment — never arbitrary shell.
- **Two-tier opt-in:** read-only remotely by default; autonomous worker spawn needs
  `you orchestrate host on` (durable) + the `remote:command` scope.
- **Audit:** every dispatch + result writes brain-activity rows.
- **Secrets:** never echoed; vault values stay encrypted; the executor redacts output.

---

## 8. Pending live validation (the honest list)

These are built + unit-tested but need real hosts/accounts to confirm end-to-end:
1. systemd enable/linger on a real Linux VPS (Hostinger).
2. The two-machine `agent.spawn` round-trip (MacBook → Mac mini/VPS).
3. Orchestrator loop LLM behavior tuning against real models.
4. folder.md endpoints against a live account (the client's endpoint shapes need one verify pass).
5. The autonomous folder.md `/provision` endpoint (build on the `folder-md` repo; replaces §6 setup).
