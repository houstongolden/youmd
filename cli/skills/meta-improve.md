---
name: meta-improve
version: 1.0.0
scope: shared
identity_fields: [preferences.agent, directives.agent]
description: "Self-improvement protocol — agents review their own effectiveness and propose identity updates"
---

# meta-improve

The feedback loop that makes your identity smarter over time. Agents review what worked and what didn't, then propose updates to your identity bundle.

## Identity Context (resolved at review time)

- **Agent preferences:** {{preferences.agent}}
- **Directives:** {{directives.agent}}

## What This Skill Does

1. Read skill-metrics.json for usage data (which skills run, success/fail rates)
2. Brain-aware preflight: if you are running inside a repo, skim `project-context/` first so you don’t propose generic changes the project already answered:
   - `project-context/CURRENT_STATE.md`
   - `project-context/feature-requests-active.md`
   - `project-context/TODO.md`
   - `project-context/reference-intelligence/TASKS.md`
3. Analyze patterns:
   - Which skills get used most?
   - Which identity fields get referenced most?
   - Are there gaps? (skills that should exist but don't)
   - Are there stale entries? (skills never used)
4. Propose changes:
   - New directives based on repeated corrections
   - Voice refinements based on agent interactions
   - Skill additions based on detected workflow patterns
   - Pruning of unused skills
5. Present proposals for user approval (never auto-apply)

## Metrics Tracked

```json
{
  "skills": {
    "claude-md-generator": {
      "uses": 12,
      "lastUsed": "2026-03-25T...",
      "avgDuration": 1200,
      "successRate": 0.92
    }
  },
  "identityFields": {
    "voice.overall": { "references": 45 },
    "preferences.agent": { "references": 38 }
  },
  "proposals": []
}
```

## MCP Server Health Check

As part of the self-improvement review, meta-improve should also check MCP server health:

1. **Is the MCP server configured?** Check if `youmd mcp --json` output exists in the user's MCP client config (e.g., `~/.claude/claude_desktop_config.json` or `.claude/settings.json`).
2. **Is the server reachable?** Call `get_remote_status` to verify authentication and sync state.
3. **Are tools being used?** Check if agents are actively calling MCP tools. Low usage may indicate misconfiguration.

### Suggesting MCP Setup

If the MCP server is NOT configured, meta-improve should propose setup as an improvement:

```
Proposal: Configure You.md MCP server
Reason: Your identity context is only available via static files. With the MCP server,
agents get live access to memories, project context, and can save learnings in real time.

Setup:
  1. Run: youmd mcp --json
  2. Add the output to your MCP client config
  3. Restart your agent (Claude Code, Cursor, etc.)

Impact: All agents get live identity context instead of stale snapshots.
```

If the MCP server IS configured but `get_remote_status` shows the local bundle is out of sync with remote, propose a `compile_bundle` + `push_bundle` cycle.

## When To Use

- Periodically via `youmd skill improve`
- After a significant number of skill uses (auto-suggested)
- When onboarding a new project (review what's working)
