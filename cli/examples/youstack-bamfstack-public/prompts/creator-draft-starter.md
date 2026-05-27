# Creator Draft Starter

Use the BAMFStack public lighthouse pattern.

My API keys, private memories, creator data, and proprietary prompts are not in this stack. If the task requires them, use an authenticated BAMF or You.md API/MCP grant and explain the scope first.

Start by checking stack freshness and routing:

```bash
~/.youmd/bin/youmd-auto-upgrade --quiet || true
youmd stack smoke --path .
youmd stack route --path . "inspect creator context before drafting"
```

Then propose a safe plan. Do not create, edit, schedule, delete, or publish until I approve the exact content or action.
