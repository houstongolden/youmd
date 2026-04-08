---
name: proactive-context-fill
version: 1.0.0
scope: shared
identity_fields: [profile.projects, profile.about, preferences.agent, voice.overall]
description: Auto-detects empty or thin context sections in the user's you.md bundle and proactively offers to populate them.
---

# proactive-context-fill

Use this skill when starting a new session with a user who has a you.md identity bundle. It detects gaps and offers to fill them.

## Detection rules

1. **Projects:** If profile/projects.md lists projects but private/projects/{name}/ subdirectories don't exist or are empty, offer to scaffold each one.
2. **Voice:** If voice/voice.md is < 100 chars, offer to analyze the user's writing samples from sources/ to generate a voice profile.
3. **Directives:** If directives/agent.md is empty or generic, offer to extract specific directives from the user's preferences and recent conversations.
4. **Sources:** If profile/links.md has social URLs but sources/ is empty, offer to scrape and add them.
5. **Memories:** If memory has < 5 entries, offer to seed initial memories from the current conversation.

## Workflow

1. Scan the bundle on session start (read the relevant sections)
2. Build a list of detected gaps
3. Present the list to the user concisely
4. Offer YES/SKIP/ASK_LATER for each gap
5. Execute the chosen actions in batches
6. Allow skipping individual sub-tasks (e.g. "scaffold all projects but skip BAMF.ai")

## Anti-patterns

- DO NOT lecture the user about how their bundle could be better
- DO NOT make the user feel guilty about empty sections
- DO NOT auto-fill without asking
- DO NOT ask 10 questions at once — batch in groups of 2-3

## Example output

```
i noticed a few things i could help with:

1. your projects/ dir is empty (your profile lists 6 projects)
2. voice profile is thin (~50 chars vs typical 300+)
3. no directives set yet

want me to:
[a] scaffold all 6 project subdirectories with quick questions per project
[b] generate a voice profile from your linkedin posts and tweets
[c] extract directives from your existing preferences

reply with letters (e.g. "a c") or skip entirely.
```
