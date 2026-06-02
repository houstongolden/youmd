# Codex Chat Hygiene

Last updated: 2026-06-02

Codex automations are useful, but each cron run can create a normal sidebar
thread. That is fine for ad hoc work and noisy for recurring monitors. The
operating rule for You.md and other Houston projects is:

1. Keep durable automation output in project files or automation memory.
2. Keep only the newest or currently actionable automation thread visible.
3. Archive completed automation threads after preserving their transcript path,
   summary, and follow-up status.
4. Prefer one consolidated automation per recurring job. Pause duplicate jobs
   instead of letting overlapping schedules create parallel daily threads.
5. For active human work, keep a fresh chat per substantial task, but summarize
   important context into `project-context/` before the thread gets buried.

## You.md Reference Automation

Current desired setup:

- Active: `daily-gstack-gbrain-reference-sync`
  - Display name: `Daily You.md Reference Intelligence`
  - Schedule: daily at 8:30 AM local time
  - Durable outputs:
    - `project-context/reference-intelligence/LATEST.md`
    - `project-context/reference-intelligence/TASKS.md`
    - `$CODEX_HOME/automations/daily-gstack-gbrain-reference-sync/memory.md`
- Paused duplicate: `daily-gstack-gbrain-reference-intelligence`
  - Display name: `Daily You.md Reference Intelligence Review`
  - Reason: overlapping daily monitor that created a second recurring sidebar
    thread with substantially the same purpose.

## Archived Automation Threads

The following You.md automation threads were consolidated because their useful
state lives in the generated reference-intelligence files, automation memory,
and pushed project-context commits. Their transcript files were not deleted.

| Thread ID | Date | Automation | Transcript |
|---|---:|---|---|
| `019e74e8-f30e-7ac2-a9e2-4499ed0aea7f` | 2026-05-29 | `daily-gstack-gbrain-reference-intelligence` | `/Users/houstongolden/.codex/sessions/2026/05/29/rollout-2026-05-29T11-04-44-019e74e8-f30e-7ac2-a9e2-4499ed0aea7f.jsonl` |
| `019e7467-f64a-7060-9b83-463f04a24ef4` | 2026-05-29 | `daily-gstack-gbrain-reference-sync` | `/Users/houstongolden/.codex/sessions/2026/05/29/rollout-2026-05-29T08-43-50-019e7467-f64a-7060-9b83-463f04a24ef4.jsonl` |
| `019e7a0f-ed8a-7d30-829f-036af7811fb4` | 2026-05-30 | `daily-gstack-gbrain-reference-intelligence` | `/Users/houstongolden/.codex/sessions/2026/05/30/rollout-2026-05-30T11-05-24-019e7a0f-ed8a-7d30-829f-036af7811fb4.jsonl` |
| `019e7a1e-0921-74e1-84d1-2af1eee97362` | 2026-05-30 | `daily-gstack-gbrain-reference-intelligence` | `/Users/houstongolden/.codex/sessions/2026/05/30/rollout-2026-05-30T11-20-49-019e7a1e-0921-74e1-84d1-2af1eee97362.jsonl` |
| `019e798d-5962-7683-9bf3-d132e71f341b` | 2026-05-30 | `daily-gstack-gbrain-reference-sync` | `/Users/houstongolden/.codex/sessions/2026/05/30/rollout-2026-05-30T08-42-47-019e798d-5962-7683-9bf3-d132e71f341b.jsonl` |
| `019e7ead-e452-7890-8da5-a14c21ed521f` | 2026-05-31 | `daily-gstack-gbrain-reference-sync` | `/Users/houstongolden/.codex/sessions/2026/05/31/rollout-2026-05-31T08-36-25-019e7ead-e452-7890-8da5-a14c21ed521f.jsonl` |
| `019e7f45-3332-7251-814b-180611378562` | 2026-05-31 | `daily-gstack-gbrain-reference-intelligence` | `/Users/houstongolden/.codex/sessions/2026/05/31/rollout-2026-05-31T11-21-42-019e7f45-3332-7251-814b-180611378562.jsonl` |
| `019e83d8-a693-7f90-8ce0-04d7f02abd12` | 2026-06-01 | `daily-gstack-gbrain-reference-sync` | `/Users/houstongolden/.codex/sessions/2026/06/01/rollout-2026-06-01T08-41-14-019e83d8-a693-7f90-8ce0-04d7f02abd12.jsonl` |
| `019e846c-1dd1-7521-9af2-3cf76e0e5442` | 2026-06-01 | `daily-gstack-gbrain-reference-intelligence` | `/Users/houstongolden/.codex/sessions/2026/06/01/rollout-2026-06-01T11-22-18-019e846c-1dd1-7521-9af2-3cf76e0e5442.jsonl` |
| `019e88f6-62ed-74b1-90e8-56270aefe55f` | 2026-06-02 | `daily-gstack-gbrain-reference-sync` | `/Users/houstongolden/.codex/sessions/2026/06/02/rollout-2026-06-02T08-31-49-019e88f6-62ed-74b1-90e8-56270aefe55f.jsonl` |
| `019e8993-1fd1-7d22-818f-2a10463ee92f` | 2026-06-02 | `daily-gstack-gbrain-reference-intelligence` | `/Users/houstongolden/.codex/sessions/2026/06/02/rollout-2026-06-02T11-23-01-019e8993-1fd1-7d22-818f-2a10463ee92f.jsonl` |

To restore visibility for one of these threads, clear its `archived` flag in
Codex's local `threads` table. Prefer restoring one specific thread instead of
unarchiving the whole automation batch.

## Better Global Product Pattern

The product-level answer is an automation lane:

- Automation runs should land in a collapsible sidebar group named
  `Automations`, not the main project chat stream.
- Each automation should have a stable parent thread or run log with child runs
  grouped underneath it.
- The sidebar should rank active human chats first, then pinned chats, then
  automation runs.
- Each project should have a searchable `context index` fed by chat summaries,
  commits, PRs, automations, and durable project-context files.
- Starting fresh chats should stay encouraged, but context should be extracted
  into durable memory at closeout so speed does not fight recall.

For now, the local policy above gives most of the value without waiting on new
Codex sidebar features.
