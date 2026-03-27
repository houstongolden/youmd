---
name: voice-sync
version: 1.0.0
scope: shared
identity_fields: [voice.overall, voice.writing, voice.speaking]
description: "Sync your voice profile across all agent tools — consistent tone everywhere"
---

# voice-sync

Keep your voice profile in sync across every agent tool you use. When your voice changes in one place, it propagates everywhere.

## Identity Context (resolved at sync time)

- **Overall voice:** {{voice.overall}}
- **Writing voice:** {{voice.writing}}
- **Speaking voice:** {{voice.speaking}}

## What This Skill Does

1. Read your current voice profile from the identity context
2. Generate agent-specific voice instructions for:
   - **Claude Code** (.claude/skills/youmd/voice.md)
   - **Cursor** (.cursor/rules/youmd-voice.md)
   - **Custom agents** (.youmd/skills/voice-context.md)
3. Re-render on every `youmd skill sync` or `youmd push`
4. Respect scope — shared voice propagates to all projects

## Sync Targets

| Agent | File | Format |
|---|---|---|
| Claude Code | .claude/skills/youmd/voice.md | Markdown with voice rules |
| Cursor | .cursor/rules/youmd-voice.md | Single markdown file |
| Generic | .youmd/skills/voice-context.md | Universal format |

## When To Use

- After updating your voice via `youmd chat`
- When `youmd skill sync` runs automatically
- When linking a new agent with `youmd skill link`
