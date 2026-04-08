---
name: you-logs
version: 1.0.0
scope: shared
identity_fields: []
description: View your you.md agent activity log inline. Shows which agents connected to your identity and what they did.
---

# you-logs — Agent Activity Log

Show recent agent activity for the current user.

## Trigger
- CLI: `/you-logs` in Claude Code, Cursor, or any CLI agent with skills installed
- Direct: `youmd logs`

## What it does

Fetches the recent agent activity log from you.md and renders it as a terminal-friendly table showing:
- Time of activity
- Agent name (Claude Code, Cursor, ChatGPT, etc.)
- Action (read, write, push, memory_add, etc.)
- Resource (which file/section was touched)
- Bundle version diffs for writes

## How to use it

When the user types `/you-logs`, run:

```bash
youmd logs --limit 30
```

If they pass arguments like `/you-logs --agent "Claude Code"` or `/you-logs --action push`, pass those through:

```bash
youmd logs --limit 30 --agent "Claude Code"
youmd logs --action push
```

For live monitoring:

```bash
youmd logs --tail
```

(But warn the user this blocks the terminal until ctrl-c.)

## Output format

The output looks like:

```
─── recent activity ───

  14:32  Claude Code      read          identity
  14:32  Claude Code      read          memories/all
  14:31  Claude Code      read          project/current
  14:30  Cursor           push          bundle v49→v50
  14:28  Claude.ai        read          ctx/<token>
  14:25  Claude Code      read          identity

  6 events — use --tail for live mode
```

Return this output verbatim to the user. Don't summarize. The raw log IS the value — they want to see exactly what happened.

## Notes
- This skill requires `youmd` CLI to be installed and the user to be authenticated (`youmd login`)
- If authentication fails, suggest: "Run `youmd login` to view your activity log"
- The data is fetched from the user's you.md account in real-time
