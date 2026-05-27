---
name: bamfstack-start
description: Public-safe BAMFStack lighthouse workflow for creator-growth agents.
version: 1.0.0
---

# BAMFStack Public Lighthouse

Use this skill when an agent needs the open BAMFStack workflow pattern without receiving private BAMF data, proprietary prompts, credentials, or hidden product internals.

## Before Work

1. Run the You.md runtime auto-upgrade helper if it exists:

   ```bash
   ~/.youmd/bin/youmd-auto-upgrade --quiet || true
   ```

2. Run `youmd stack smoke --path <this-stack>`.
3. Read `youstack.json`, `docs/quickstart.md`, and `workflows/creator-growth-workflow.md`.
4. Keep API keys in environment variables only. Never print, write, commit, or paste keys.
5. Fetch capability maps before routing ambiguous workflow requests.

## Safe Workflow

- Inspect context before writing.
- Separate source-backed facts from interpretation.
- Ask up to three mini-interview questions when authentic story, proof, or opinion is missing.
- Propose content, media, carousel, or research plans before creating anything.
- Use idempotency for mutations.
- Wait for exact approval before creating, editing, scheduling, deleting, or publishing.
- Never publish-now unless the user explicitly asks.

## You.md Boundary

Local files can explain skills, workflows, examples, and safety rules. Protected memory, private creator data, tokens, connected accounts, proprietary prompts, and server-side actions must stay behind authenticated BAMF or You.md API/MCP surfaces.
