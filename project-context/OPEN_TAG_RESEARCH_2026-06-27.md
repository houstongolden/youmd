# Open Tag / "You Tag" Research — You.md as the Portable Context Layer for Work-App Agents

**Date:** 2026-06-27
**Status:** Research / decision brief — no code shipped
**Companion doc:** `bamfsite/project-context/open-tag-research.md` (full landscape + the BAMF build). This file is the **You.md-specific** angle.

---

## TL;DR

- **Claude Tag** (Anthropic, June 23 2026) put `@Claude` inside Slack: shared context, persistent memory, ambient mode, tool access, admin governance — but **locked to Claude models, one Slack workspace, Anthropic's plans.** **"Open Tag"** (CopilotKit + `amplifthq/opentag`) is the open-source reaction: same `@mention` loop, any model, any harness.
- **You.md should not try to out-transport them.** Our moat is **portable identity context**, and we already ship the exact primitives an Open Tag agent needs to consume it: an **MCP server**, **scoped API keys**, and **agent-writable memories**.
- **Primary play (A):** position You.md as *the context provider* that any Open Tag — including Claude Tag via MCP — plugs into. *"Claude Tag's memory dies in one Slack. You.md's memory is yours, and follows you into every agent and every app."*
- **Lighthouse demo (B):** a first-party **"You Tag"** Slack/Teams app where `@you` answers from your You.md identity and writes new facts back to your memories.
- This is squarely **autonomous-first** (per `PRINCIPLES.md`): the user does nothing; their identity just shows up wherever an agent is tagged. No new homework, no operator role.

---

## Why this is a natural fit for You.md (we're already 80% there)

From the codebase, You.md already exposes everything an external "tag" agent needs:

| Open Tag needs… | You.md already has it | Where |
|---|---|---|
| A context API any agent can call | **MCP server** (`get_agent_brief`, `get_my_identity`, `search_memories`, `report_skill_outcome`) | `/.well-known/mcp.json`, `/api/v1/mcp`, `convex/lib/mcpRegistry.ts` |
| Granular, safe agent permissions | **Scoped API keys** (`read:public`, `read:private`, `write:memories`, `vault`, `remote:command`) | `convex/apiKeys.ts`, `convex/lib/scopes.ts`, enforced in `http.ts::requireScope()` |
| Persistent, portable memory (Claude Tag parity, but yours) | **`memories`** table — agent-writable, full-text searchable, 10 categories, dedup by `contentHash` | `convex/memories.ts`, `POST /api/v1/me/memories` |
| Streaming agent brain | **You Agent** + `/api/v1/chat/stream` (Claude Sonnet 4.6, OpenRouter fallback) | `convex/chat.ts`, `src/hooks/useYouAgent.ts` |
| Conversation persistence + compaction | **`chatSessions` / `chatMessages`** with Claude-Code-style compaction | `convex/schema.ts`, `/api/v1/chat/compact` |
| Outbound event notifications | **Webhooks** (`bundle_published`, HMAC-signed) | `convex/webhooks.ts` |
| Inbound work-app ingress (Slack/Teams `@mention`) | ❌ **Missing** — the only real gap | — |

**The gap is the same one BAMF has:** an inbound ingress that turns an `@mention` into an agent run and streams the answer back in-thread. Everything else already exists.

---

## Play A — You.md as the context layer for *any* Open Tag (recommended lead)

No Slack code required. We publish/position the integration recipe:

1. User issues a **scoped API key** (`read:private` + `write:memories`) from You.md settings.
2. They paste it into their Open Tag agent (CopilotKit, `amplifthq/opentag`, a custom harness, *or Claude Tag via remote MCP*).
3. The agent now (a) reads `get_agent_brief` so it answers grounded in *who the user is*, and (b) writes durable facts back via `report_skill_outcome` / memories — so what the agent learns in Slack is **portable** to every other agent and app.

This is the differentiator Claude Tag structurally **cannot** match: its memory is trapped in one workspace. You.md memory is the user's, everywhere. Action items: a short "Use You.md with your work-app agent" doc surface (fits the existing `llms.txt` / `/api/v1/docs` generation), and verify the MCP tools return well-shaped briefs for a Slack-sized context window.

## Play B — first-party "You Tag" Slack/Teams app (the demo)

Same ingress shape as the BAMF doc, but on the **Next.js/Convex** stack and pointed at the **You Agent**:

```
Slack app_mention ─▶ Next.js route /api/v1/integrations/slack/events
                       │ 1. verify Slack signature
                       │ 2. ACK < 3s ("on it ▍")            ← Slack's hard 3s limit
                       │ 3. enqueue run (new integrationRuns table / chatSessions surface="slack")
                       ▼
                   Convex worker (scheduled action / durable function)
                       │ 4. conversations.replies → thread context
                       │ 5. MCP get_agent_brief → user identity + memories
                       │ 6. /api/v1/chat (You Agent, server-assembled system prompt)
                       │ 7. stream → chat.update the placeholder progressively
                       │ 8. new durable facts → POST /api/v1/me/memories (write:memories)
                       ▼
                   Slack thread (reply as *you*, from your portable context)
```

Notes specific to our stack:
- **Ingress on Next.js, work on Convex.** Slack signature verify + 3s ACK in a Next.js route handler; enqueue to a Convex action (Convex scheduler / `runAfter`) for the actual run. Keeps the LLM call server-side and rate-limited (the `chat.ts` `internalAction` security model from Cycle 46 stays intact — never expose the brain to the client).
- **Streaming into Slack** = post placeholder, `chat.update` every ~1–2s with buffered deltas + a `▍` cursor (we already filter JSON directives mid-stream; strip those before posting to Slack).
- **HITL approvals:** if the agent proposes a profile/bundle write, render Approve/Reject Block Kit buttons → a Slack interactivity route → `POST /api/v1/me/bundle`. Reuse the existing scoped-key enforcement; **reserve approval gates for writes only** (PRINCIPLES.md: no approval gates for routine safe reads).
- **Surface field:** `chatSessions.surface` already supports `"web" | "cli" | "api"` — add `"slack"`/`"teams"` so cross-platform history unifies.

---

## What NOT to build (anti-bloat check vs. PRINCIPLES.md)

- ❌ Don't fork the You Agent for Slack. One brain, multiple front doors — the Slack worker calls the same `/api/v1/chat`.
- ❌ Don't adopt CopilotKit's runtime or `amplifthq/opentag`'s TS/Hono/SQLite stack — wrong runtime, and we already own dispatcher (Convex) + store (Convex tables) + auth (scoped keys). Borrow the **protocol shape**, not the code.
- ❌ Don't make the user run/migrate/approve anything to get value from Play A — issuing one scoped key is the entire setup, and even that should be one-click from settings.
- ✅ Do converge the *web* generative-UI layer onto **AG-UI** eventually (interop + ecosystem) — but that's independent of, and not required for, Slack/Teams.

---

## Open questions for Houston
1. **Lead with Play A (positioning/MCP recipe) or Play B (build the Slack app)?** Recommendation: ship A's doc surface immediately (near-zero cost, big narrative), build B as the demo.
2. **BAMF first or You.md first overall?** The BAMF agent is ~70% built and gives internal agency value now; You.md is the better *public* story. They share the ingress design — building one informs the other.
3. **Teams day one** or Slack-first? (BAMF screenshots show both "today.")

---

## Sources
See `bamfsite/project-context/open-tag-research.md` §8 for the full source list (Claude Tag coverage, CopilotKit/AG-UI, `amplifthq/opentag`). Key ones:
- [Claude Help Center — What is Claude Tag?](https://support.claude.com/en/articles/15594475-what-is-claude-tag)
- [TechCrunch — Claude Tag](https://techcrunch.com/2026/06/23/anthropics-claude-tag-is-learning-your-company-one-slack-message-at-a-time/)
- [AG-UI docs](https://docs.ag-ui.com/introduction) · [CopilotKit](https://www.copilotkit.ai/)
- [GitHub — amplifthq/opentag](https://github.com/amplifthq/opentag)
