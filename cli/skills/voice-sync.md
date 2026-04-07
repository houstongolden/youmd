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

1. Read your current voice profile from the identity bundle
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

## Template Variables

In addition to the core voice fields, the following variables are available for fine-grained voice control:

- `{{voice.overall}}` — Full voice description (tone, cadence, personality)
- `{{voice.writing}}` — Written communication style (emails, docs, comments)
- `{{voice.speaking}}` — Verbal communication style (meetings, presentations)
- `{{voice.tone}}` — Short tone descriptor (e.g., "direct, no fluff")
- `{{voice.formality}}` — Formality level (e.g., "casual-professional")
- `{{voice.avoid}}` — Patterns to avoid (e.g., "corporate speak, emoji, verbose explanations")
- `{{profile.about}}` — Brief identity context for attribution

## Usage Examples

### Claude Code agent config

After rendering, paste the output into `.claude/skills/youmd/voice.md`:

```markdown
# Voice Rules

Write all responses in this voice: {{voice.overall}}

When writing code comments: {{voice.writing}}

Avoid: {{voice.avoid}}
```

### Cursor rules file

Use in `.cursor/rules/youmd-voice.md`:

```markdown
# Communication Style
Tone: {{voice.tone}}
Formality: {{voice.formality}}
Writing style: {{voice.writing}}
Never use: {{voice.avoid}}
```

### Custom agent system prompt snippet

```
You are working with {{profile.about}}.
Match this voice: {{voice.overall}}
Formality: {{voice.formality}}
```

## When To Use

- After updating your voice via `youmd chat`
- When `youmd skill sync` runs automatically
- When linking a new agent with `youmd skill link`
