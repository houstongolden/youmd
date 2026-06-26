# Cross-Machine Agent-to-Agent Collaboration

> **⚠️ STALENESS CORRECTION (2026-06-26, code-grounded audit):** the "proposed, not
> built" status below is **out of date**. The Phase 1+2 remote-command path is **shipped
> in code**: the whitelisted git executor (`cli/src/lib/remote-executor.ts`, 5 actions,
> `execFile` + `shell:false` + path containment), the durable `remoteCommands` table
> (`convex/remoteCommands.ts`), the daemon handler (`cli/src/commands/sync.ts:478`), the
> `remote:command` opt-in scope (`convex/lib/scopes.ts:31`), and `you remote run`
> (`cli/src/commands/remote.ts:260`) all exist. Remaining gaps are NOT the executor; they
> are: (a) the resident daemon is **macOS/launchd-only** (`cli/src/lib/daemon.ts:131`) so a
> Linux VPS has no always-on path, (b) unattended secret-vault provisioning on a fresh host
> still needs a one-time `share` from an existing trusted device, and (c) `remote.ts:246`
> status copy still says "Phase 1" though the executor ships. See
> `MULTICOMPUTER_AGENTS_AND_Y_COMPUTER_STRATEGY_2026-06-26.md` §9 for the audit.

**Status:** Phase 0 (read-only status slice) implemented on `prototype/desktop-shell-ia`.
Phases 1–2 (command execution) are now SHIPPED in code (see correction above); Phase 3
(autonomy skill) and the rented-host glue (Linux daemon, unattended vault) remain.

**Founder use case (verbatim intent):**
> "My Mac mini at the office is running long-running agentic tasks. From my MacBook
> at home, I want to open Claude Code/Cursor and ask: is the work done? committed?
> pushed? what was the last update? — and if it's not pushed, tell the agent on the
> Mac mini to commit and push so I can pull it down here. My MacBook's agent should
> interact in real time with the Mac mini's agent via the you.md synced connection
> and trigger it to take actions."

This must honor `project-context/PRINCIPLES.md`: **no user homework**. The whole
flow runs through the agents / CLI / MCP / YStack. The only thing Houston ever
types is a natural-language request to his local Claude Code/Cursor.

---

## 1. What already exists (reused, not rebuilt)

Research of `cli/src` + `convex/` found ~90% of the substrate already shipped:

| Capability | Where | Reuse |
|---|---|---|
| Agent bus (durable, per-user, channel/target addressed) | `realtimeAgentMessages` table; `POST/GET /api/v1/me/agent-bus/messages` (`convex/agentBus.ts`) | **Transport for commands + results** |
| Message schema with `sourceHost`/`targetHost`/`sourceAgent`/`targetAgent`/`channel`/`kind`/`metadata` | `cli/src/lib/api.ts` `AgentBusMessage`; `cli/src/lib/realtime-sync.ts` `RealtimeAgentMessage` | **Command envelope** — already has target addressing |
| Unified activity / audit log | `brainActivities` table; `POST /api/v1/me/brain-activities`; `agentActivity` audit table | **Audit trail for every dispatch + result** |
| Machine identity + state proof | `machineProofReports` table; `POST/GET /api/v1/me/machines/proof(s)`; identifier = `os.hostname()` / `machineKey` | **`remote status` data source** |
| Resident daemon (continuous) | `com.you.realtime-sync` LaunchAgent → `youmd sync --live --daemon`; Convex WebSocket subscription to `realtimeSync.getHead` | **Where the command handler will live** |
| Realtime delivery | Convex `ConvexClient.onUpdate` WebSocket subscription (push, not poll) | **Near-real-time command pickup** |
| Auth | API key `ym_` + 40 base62, SHA-256 hashed; `Authorization: Bearer`; stored `~/.you/config.json` (0600) | **Owner-scoped authz** |
| Scopes | `read:public`, `read:private`, `write:bundle`, `write:memories`, `vault` (`convex/lib/scopes.ts`) | **Add one new scope: `remote:command`** |
| MCP tool registry | `CLI_MCP_TOOLS` in `cli/src/mcp/registry.ts`; `CliMcpCtx` (`apiRequest`, `logActivity`, `authenticated`, `resolveAgentName`) | **Where new tools register** |

**What does NOT exist (must be added for full feature):**
- No `remoteCommands` table / dedicated command-status surface.
- No command **handler** inside the resident daemon (it only syncs identity/skills today).
- No whitelist/executor for git actions.
- No `remote:command` scope.

**Key insight:** machines are not directly reachable from each other. The agent bus
already relays machine→Convex→machine. We do not need new transport — we need a
**command convention on top of the bus** plus a **handler in the existing daemon**.

---

## 2. Architecture

```
  MacBook (home)                 Convex Cloud                  Mac mini (office)
 ┌───────────────┐            ┌──────────────────┐          ┌────────────────────┐
 │ Claude Code / │            │ realtimeAgentMsgs│          │ com.you.realtime-  │
 │ Cursor        │            │  channel=remote- │          │ sync daemon        │
 │   │ MCP tool   │  POST bus  │  command         │  WS push │  (already running)  │
 │   ▼            │──────────► │ brainActivities  │ ───────► │  remote-command    │
 │ remote_machine │            │ (audit)          │          │  handler           │
 │ _run           │            │                  │          │   │                 │
 │                │   GET bus  │                  │  POST bus│   ▼ whitelisted exec │
 │ remote_machine │◄────────── │  result message  │◄─────────│  git status/commit/ │
 │ _status        │  (poll for │  channel=remote- │          │  push (no arb exec) │
 └───────────────┘   result)   │  command-result  │          └────────────────────┘
```

**(a) Querying remote status** — read-only, ships in Phase 0:
1. Local MCP tool / `you remote status <host>` calls `GET /api/v1/me/machines/proofs`
   (last proof: git/install/daemon health, `generatedAt`) **and**
   `GET /api/v1/me/agent-bus/messages?channel=...` filtered to that `sourceHost`
   (last agent activity).
2. Returns: machine status (`ready|warn|failed`), last-seen time, last agent-bus
   message, daemon health. No machine cooperation needed — it reads cloud state.

**(b) Sending a remote command** — Phases 1–3:
1. Local agent calls MCP `remote_machine_run` → `POST /api/v1/me/agent-bus/messages`
   with `channel: "remote-command"`, `targetHost: "<mac-mini-hostname>"`,
   `kind: "command"`, `metadata: { requestId, action, args, issuedBy }`.
2. Mac mini's resident daemon (already subscribed via WebSocket) receives the
   message in near-real-time, confirms `targetHost === os.hostname()`, validates
   the action against the **whitelist**, checks idempotency by `requestId`.
3. Daemon executes the whitelisted action (e.g. `git status`/`commit`/`push`) in
   the resolved project dir, captures result, and posts a result message:
   `channel: "remote-command-result"`, `targetHost: <issuer host>`,
   `metadata: { requestId, ok, action, output, exitCode }`. Also writes a
   `brainActivity` for audit.
4. Local tool polls `GET /agent-bus/messages?channel=remote-command-result` for the
   matching `requestId` (bounded ~2s interval, ~60s timeout) and returns the result.

**Transport decision:** Convex-relayed agent bus (machine A → Convex → machine B).
Chosen because machines are not directly reachable, the bus already exists with
target addressing + audit, and the daemon already holds a live WebSocket. No
new transport, no inbound ports, no P2P.

**Real-time-ness:** delivery to the daemon is push (WebSocket). The local agent's
wait for the *result* is a short bounded poll (simplest, good enough). A future
optimization is to have the local side also subscribe via a realtime-sync session
token, but polling is fine for the PoC.

---

## 3. Message schema (command convention over the existing bus)

No new envelope type — we use existing `AgentBusMessage` fields. The command
contract lives in `channel` + `kind` + `metadata`.

**Command (issuer → target):**
```jsonc
{
  "channel": "remote-command",
  "kind": "command",
  "sourceHost": "houstons-macbook.local",
  "sourceAgent": "Claude Code",
  "targetHost": "office-mac-mini.local",   // REQUIRED — daemon ignores if != hostname
  "body": "git: commit and push youmd",      // human-readable
  "metadata": {
    "requestId": "rc_01J...",                // ULID — idempotency key
    "action": "git.commit_push",             // MUST be in whitelist
    "args": { "project": "youmd", "message": "wip: handoff" },
    "issuedBy": "houston",
    "issuedAt": 1750000000000,
    "expiresAt": 1750000300000,              // daemon drops if expired
    "secretValuesExposed": false
  }
}
```

**Result (target → issuer):**
```jsonc
{
  "channel": "remote-command-result",
  "kind": "result",
  "sourceHost": "office-mac-mini.local",
  "targetHost": "houstons-macbook.local",
  "body": "git.commit_push ok: pushed 3 commits",
  "metadata": {
    "requestId": "rc_01J...",                // matches the command
    "ok": true,
    "action": "git.commit_push",
    "exitCode": 0,
    "output": "...truncated stdout/stderr (no secrets)...",
    "gitState": { "branch": "main", "dirty": false, "ahead": 0, "lastCommit": "abc123" },
    "completedAt": 1750000005000,
    "secretValuesExposed": false
  }
}
```

`requestId` is the idempotency + correlation key throughout.

---

## 4. Convex changes

**Phase 0 (status):** none. Reuses `GET /machines/proofs` + `GET /agent-bus/messages`.

**Phase 2 (command durability + fast status) — proposed:**
Optional but recommended `remoteCommands` table for clean status polling and a TTL
without scanning the message stream:
```ts
remoteCommands: defineTable({
  userId: v.id("users"),
  requestId: v.string(),
  targetHost: v.string(),
  sourceHost: v.string(),
  sourceAgent: v.string(),
  action: v.string(),                 // whitelisted action id
  args: v.optional(v.any()),
  status: v.string(),                 // queued|acked|running|done|error|expired|rejected
  ok: v.optional(v.boolean()),
  output: v.optional(v.string()),
  exitCode: v.optional(v.number()),
  gitState: v.optional(v.any()),
  issuedAt: v.number(),
  expiresAt: v.number(),
  completedAt: v.optional(v.number()),
  secretValuesExposed: v.boolean(),
})
  .index("by_userId_requestId", ["userId", "requestId"])
  .index("by_userId_target_status", ["userId", "targetHost", "status"])
```
Routes: `POST /api/v1/me/remote-commands/dispatch`,
`GET /api/v1/me/remote-commands/:requestId`,
`GET /api/v1/me/remote-commands?targetHost=&status=` (daemon pulls queued work).
If we want to keep Phase 1 minimal, we can ship purely on the agent bus and add
this table only when status polling on the message stream proves awkward.

---

## 5. Resident daemon handler (target machine) — proposed

Add a `remote-command` handler to the existing `youmd sync --live --daemon` loop
(`cli/src/commands/sync.ts` `runLiveSync`), or a sibling `youmd remote serve`
daemon. On each agent-bus update (already subscribed):
1. Filter messages where `channel === "remote-command"` and
   `targetHost === os.hostname()`.
2. Idempotency: skip if `requestId` already processed (local seen-set + cloud status).
3. Expiry: drop if `now > metadata.expiresAt`.
4. **Whitelist validation:** `action` must be in `ALLOWED_REMOTE_ACTIONS`. Reject
   anything else with an `error`/`rejected` result. **Never** eval arbitrary
   strings or shell.
5. Resolve project dir from `args.project` against known You.md project roots only.
6. Execute via a typed executor (spawn with explicit argv arrays, never a shell
   string), bounded timeout, capture stdout/stderr, redact secrets.
7. Post `remote-command-result` + write a `brainActivity` audit row.

**Whitelist (`ALLOWED_REMOTE_ACTIONS`) — the only things a remote can trigger:**
| Action id | Effect | Mutating? |
|---|---|---|
| `git.status` | `git status --porcelain` + branch/ahead/behind/last-commit | no |
| `git.last_activity` | last commit + last agent-bus message for the project | no |
| `git.commit_push` | `git add -A && git commit -m <msg> && git push` on current branch | yes (reversible) |
| `git.pull` | `git pull --ff-only` | yes (reversible) |
| `agent.status` | report running agent processes / last agent-bus heartbeat | no |
| `agent.spawn` | launch a worker harness (claude\|codex\|cursor) on a task in a contained project — **requires `YOU_REMOTE_AGENT_HOST=1` on the target** | yes (reversible) |
| `agent.list` | list worker agents + status on the target | no |
| `agent.output` | tail a worker agent's captured output by id | no |
| `agent.stop` | stop a running worker agent — **requires `YOU_REMOTE_AGENT_HOST=1`** | yes (reversible) |

Explicitly **NOT** allowed: arbitrary shell, `rm`, force-push, branch deletion,
`git reset --hard`, npm scripts, file writes outside git, `custom` harness over remote,
anything not in the table. New actions require a code change + review — the whitelist is
the security boundary.

**Cross-machine orchestration tier (2026-06-26):** the `agent.*` spawn/list/output/stop
actions let the You agent conductor on one machine launch + monitor worker harnesses on
another (office Mac mini, Hostinger VPS) over the same bus. Because `agent.spawn` runs an
autonomous coding agent (a real escalation past the git whitelist), the **target** must opt
in with `YOU_REMOTE_AGENT_HOST=1` — a fresh enrolled host is remotely *observable*
(`agent.list`/`agent.output`/`git.*`) but will not *run* a remotely-triggered worker until
its owner enables it (the y.computer/VPS provision flow sets it deliberately). Issuer side:
`you remote run <machine> agent.spawn --harness claude --project youmd --goal "…"`.

---

## 6. MCP tools + CLI + YStack

**MCP tools** (add to `CLI_MCP_TOOLS` in `cli/src/mcp/registry.ts`):
- `remote_machine_status` *(Phase 0, read-only)* — input `{ machine?: string }`;
  returns last proof + last agent-bus activity for the machine. Requires
  `authenticated`; logs activity.
- `remote_machine_run` *(Phase 1)* — input `{ machine, action, args? }`; dispatches
  a whitelisted command and waits (bounded) for the result. Requires the new
  `remote:command` scope.

**CLI** (`you remote <subcommand>`, new `cli/src/commands/remote.ts`):
- `you remote status [machine]` *(Phase 0)* — prints remote machine status.
- `you remote list` *(Phase 0)* — lists the user's machines from proofs.
- `you remote run <machine> <action> [--message ...]` *(Phase 1)* — dispatch + wait.

**YStack skill** (`cli/skills/remote-machine.md`, Phase 1) wraps the workflow so
the agent does it automatically from one sentence:
> "Check my office Mac mini — is the youmd work committed and pushed? If not, have
> it commit and push." → skill calls `remote_machine_status`, inspects `gitState`,
> and if dirty/unpushed calls `remote_machine_run(action="git.commit_push")`, then
> reports back. **Zero user steps beyond the sentence.**

---

## 7. Security model

1. **Owner-only.** All routes are `/api/v1/me/*`, authed by the owner's API key →
   single `userId`. A command can only target machines that posted proofs under the
   same `userId`. No cross-user reach by construction.
2. **New scope `remote:command`.** Add to `API_SCOPES` in `convex/lib/scopes.ts`.
   Dispatch requires it; status needs only `read:private`. **Excluded** from
   `DEFAULT_OWNER_KEY_SCOPES` (like `vault`) — opt-in. Owner session keys get it.
3. **Whitelist-only execution.** The daemon executes a fixed action table with typed
   argv — never arbitrary shell/code. This is the hard security boundary, not the
   network layer.
4. **Idempotency.** `requestId` (ULID) dedupes; replays are no-ops.
5. **Expiry.** `expiresAt` caps how long a queued command is valid; stale commands
   are dropped, not run.
6. **Audit.** Every dispatch + result writes `brainActivities` / `agentActivity`
   rows (`source`, `sourceHost`, `targetHost`, `action`, `status`) — full trail.
7. **No secret exposure.** Outputs redacted; `secretValuesExposed: false` enforced;
   daemon never echoes env values (consistent with existing daemon guarantees).
8. **Reversible-only mutations.** Whitelist limited to reversible git ops
   (commit/push/ff-pull). No destructive actions; those would need explicit,
   separate, confirmed design — consistent with PRINCIPLES "act on safe/reversible".

---

## 8. Phased plan

- **Phase 0 — read-only status (IMPLEMENTED here):**
  `you remote status/list` + `remote_machine_status` MCP tool, reading existing
  `/machines/proofs` + `/agent-bus/messages`. No backend, no daemon, no exec.
  Gated, safe, additive.
- **Phase 1 — command dispatch over the bus:** `remote:command` scope,
  `remote_machine_run` MCP tool, `you remote run`, daemon handler with the git
  whitelist, result polling. Bus-only (no new table yet).
- **Phase 2 — durability + clean status:** `remoteCommands` table + dispatch/status
  routes for robust idempotency and queue pull.
- **Phase 3 — YStack skill + autonomy:** `remote-machine.md` skill so the agent
  runs the full check→commit→push→report from one natural-language sentence.

---

## 9. Honest status

**Real today:** the agent bus, machine proofs, brain-activity audit, resident
realtime daemon, auth, scopes, and MCP registry are all shipped and were read in
source. **Phase 0** (read-only `you remote status`/`list` + `remote_machine_status`
MCP tool) is implemented on this branch against existing endpoints.

**Proposed (not built):** the `remote:command` scope, the daemon command handler +
git whitelist executor, `remote_machine_run`, the optional `remoteCommands` table,
and the YStack skill. None of these execute anything yet — there is no remote code
execution path in the repo today.
