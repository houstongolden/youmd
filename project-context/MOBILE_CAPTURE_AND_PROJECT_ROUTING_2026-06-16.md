# Mobile Capture And Project Routing

Date: 2026-06-16
Status: product direction captured; implementation not started

## Decision

You.md owns the universal mobile capture and project-routing substrate:
raw brain dumps, personal memory, project context, routing, task proposals,
YouStacks updates, protected API/MCP access, host adapters, consent, scopes,
approvals, and audit logs.

Product-specific apps can consume the routed output, but they should not each
reinvent their own inbox, memory router, SMS gateway, or personal-agent identity
stack.

| Surface | Ownership |
|---|---|
| You.md | Universal capture inbox, raw artifacts, dedupe, segmentation, project routing, memory/task extraction, grants, approvals, audit, Slack/voice host adapters |
| BAD app | Workout/run transcript sessions, training notes, body/fitness coaching, session-specific motivation and analysis |
| Myo | Health, body, productivity, and Myo/Mayo-dictation capture where relevant |
| h.computer | Houston's personal display/reference surface for the capture stream and owner-agent status |
| Hubify/BigBounce | Research ideas, Mac mini research commands, paper/review tasks, science project routing |
| Creator.new/BAMF.ai/Fantasy.is/BAMF site | Routed creator, media, agency, CRM, and product tasks when the idea belongs there |

The promise is simple: no good idea gets lost because it happened while moving.

## Source And Safety Notes

This memo is derived from Houston's 2026-06-16 Part 2 brain dump routing memo
and the handoff prompt in `creator-new/project-context/prompts/`.

Safety handling:

- Preserve raw intent, but do not store private phone numbers, secrets, API keys,
  credentials, or unredacted carrier/provider account details.
- Store raw source artifacts privately first, with visibility private by default.
- Use redacted source metadata for product docs and examples.
- Treat phone numbers as account identifiers and sensitive personal data.
- Keep unclear dictation fragments in a clarification queue rather than turning
  low-confidence guesses into product requirements or tasks.

## Mobile Brain-Dump Inbox

You.md should accept:

- Apple Watch and iPhone voice-to-text messages.
- SMS/iMessage batches.
- Pasted messy transcripts.
- Future audio transcript uploads.
- Slack direct messages or channel mentions from scoped workspaces.
- Agent-host messages from MCP/API clients, CLI, web shell, and YouStacks.

The inbox should preserve two tracks:

1. Raw artifact: immutable original text/audio transcript with source metadata.
2. Processed view: deduped, segmented, classified, routed, and reviewable ideas.

Minimum inbound event metadata:

| Field | Purpose |
|---|---|
| `provider` | `sendblue`, `twilio`, `slack`, `voice_upload`, `web_shell`, `cli`, `manual`, or future adapter |
| `channel` | `imessage`, `sms`, `rcs`, `slack_dm`, `slack_channel`, `audio_transcript`, `paste`, etc. |
| `sourceRef` | Redacted line/user/channel reference; never raw private phone number in docs or logs |
| `capturedAt` | Provider timestamp and server receive timestamp |
| `inferredSessionId` | Run/drive/walk/workout/project capture session candidate |
| `rawTextHash` | Dedupe/idempotency without exposing raw text |
| `projectHints` | Explicit or inferred project names such as You.md, BAD, Myo, BigBounce |
| `routingOutcomes` | Proposed project, confidence, consumer, action type, approval state |

## Provider-Agnostic Messaging Gateway

Sendblue is a strong candidate for iMessage-first capture because its current
API surface includes inbound receive webhooks and an API v2 for iMessage, SMS,
RCS, media, read receipts, typing indicators, contacts, line provisioning, and
related messaging operations. The architecture should still stay
provider-agnostic.

Reasons:

- Sendblue/iMessage bridges can carry provider and platform risk compared with
  official SMS/WhatsApp/RCS providers.
- BAD's existing messaging research already treats Sendblue as an adapter, not
  the system of record.
- You.md needs one canonical Convex-backed capture/session/action model even if
  the external carrier changes.

Provider evaluation criteria:

- Inbound webhook shape, event ids, retries, signature verification, and replay
  protection.
- iMessage/SMS/RCS coverage and fallback behavior.
- Voice note/media attachment support.
- Delivery/read/typing events and whether You.md actually needs them.
- Dedicated line, sandbox, line provisioning, and porting constraints.
- Compliance posture, retention controls, SOC/HIPAA claims where relevant, and
  platform/ToS risk.
- Cost per line, cost per message, rate limits, and practical daily caps.
- Webhook secret handling and private phone-number redaction.

The provider adapter should normalize inbound events into You.md first. External
writes to Notion, GitHub, project boards, CRM, Slack channels, or product apps
should remain proposed until the owner explicitly approves them or configures a
bounded automation rule.

## Brain-Dump Processing Pipeline

The capture pipeline should be conservative and reviewable:

1. Save raw transcript artifact first.
2. Record provider metadata, hashes, source visibility, and provenance.
3. Dedupe repeated voice-to-text/SMS chunks.
4. Segment into idea units.
5. Detect session boundaries and link related fragments.
6. Classify each idea by project, consumer app, urgency, and confidence.
7. Extract memory candidates with source citations.
8. Extract task/action candidates with owner/project context.
9. Propose updates to project-context docs, task docs, GitHub issues, Notion,
   CRM records, or app-specific boards.
10. Ask concise clarifying questions only for ambiguous or low-confidence items.
11. Keep unclear fragments in a clarification queue with the raw context attached.

Suggested processing states:

| State | Meaning |
|---|---|
| `raw_saved` | Raw capture is safely stored, no interpretation yet |
| `deduped` | Repeated chunks collapsed, original still preserved |
| `segmented` | Idea units and possible sessions detected |
| `routed` | Project/consumer routing proposed with confidence |
| `proposed` | Tasks, memories, or doc updates are awaiting review |
| `approved` | Owner or automation policy approved downstream writes |
| `applied` | External/project update completed and audited |
| `needs_clarification` | Ambiguous dictation retained for owner follow-up |

## Project Routing And Task Proposal UI

You.md should expose a review surface for captured ideas:

- Raw transcript and deduped transcript side by side.
- Idea clusters with project labels and confidence.
- Memory candidates with "save / ignore / edit" controls.
- Task candidates with destination suggestions.
- External write proposals with visible action scope.
- Clarification queue for garbled dictation.
- Routing audit trail that records which model/skill/stack made the decision.

The user should be able to approve one item, approve a batch, or create an
automation rule such as "BAD workout notes can create private BAD session tasks,
but GitHub issues still require approval."

## Voice Clone And Likeness Layer

You.md should add a roadmap/spec note for ElevenLabs or equivalent custom voice
support. The identity model should support an agent that can speak, write, and
work in the user's style only inside explicit permissions.

Boundaries:

- Require explicit consent and account ownership before voice clone enrollment.
- Store voice/likeness grants as revocable scoped permissions, not as ambient
  product behavior.
- Label or disclose generated voice/avatar output based on context.
- Separate owner-only private voice notes from team/client-facing output.
- Record audit logs for generated voice, voice-memo replies, and delegated sends.
- Let the user revoke a voice model, pause voice output, or disable individual
  hosts.
- Keep BAMF.ai, GPT Images, Gemini, LoRA, and media tooling as consumers or
  generators; You.md owns identity, permission, and audit.

The agent can be an amplified version of the user without becoming deceptive.

## Slack Host Adapter

You.md should define a Slack app/host adapter that lets a user deploy scoped
versions of their You.md agent into Slack workspaces.

Required controls:

- Workspace, channel, and user allowlists.
- Identity labels that make the agent status clear.
- Draft mode versus send mode.
- Read scopes, action scopes, and connected-app grants.
- Client/team-safe disclosure rules.
- Approval gates for external writes and high-impact Slack sends.
- Audit logs for every message drafted, sent, skipped, or escalated.
- Revocation per workspace, channel, stack, or agent persona.

The Slack adapter may work in the user's style, but only inside explicit
workspace rules. It should not pretend to be a human secretly.

## Naming And Runtime Exploration

Capture `y.computer` as a future runtime/domain naming idea. Do not rename
h.computer.

Current model:

- You.md = protocol, brain, context, YouStacks, protected API/MCP.
- h.computer = Houston's personal implementation/reference surface.
- `y.computer` or `{you}.computer` = possible future runtime/domain layer.

## Concise Task List

| Task | Status |
|---|---|
| Provider-agnostic SMS/iMessage gateway research | Not started; Sendblue quick scan captured |
| Inbound transcript data model | Planned in this memo |
| Dedupe/segment/classify pipeline | Planned in this memo |
| Project routing and task proposal UI | Planned in this memo |
| Approval model for external writes | Planned; reuse connected-app grants/write policies |
| BAD workout transcript consumer handoff | Planned; BAD owns workout/session UX |
| Slack host adapter spec | Planned in this memo |
| Voice clone/likeness safety spec | Planned in this memo |

## Implementation Backlog

1. Add a `captureInbox`/`captureEvents` data model with raw artifact storage,
   redacted metadata, source hashes, sessions, and routing state.
2. Add provider adapter interfaces for Sendblue-style inbound webhooks, generic
   SMS providers, Slack, manual paste, web shell, CLI, and future audio uploads.
3. Add a private Brain Dump Inbox review pane under the personal API/MCP
   control center.
4. Add a deterministic first-pass dedupe/segmentation pipeline before LLM
   interpretation.
5. Add project routing against You.md project context, YouStacks, repo mirrors,
   and active feature requests.
6. Add task/memory/doc-update proposals with approval gates and audit logs.
7. Add BAD handoff contracts for workout transcript sessions.
8. Draft Slack host adapter manifest fields and grant scopes.
9. Draft voice clone/likeness enrollment, disclosure, audit, and revocation
   requirements before any ElevenLabs implementation.

## Open Clarifications

- Which inbound line/channel should be the first pilot: Sendblue iMessage/SMS,
  plain SMS, Slack DM, manual paste, or audio transcript upload?
- Should personal mobile capture live under `/shell` `connect` -> `api/mcp`, a
  new `inbox` surface, or the existing Files/Reports workspace first?
- Which external task destination should be first after You.md-native proposals:
  project-context docs, GitHub issues, Notion, or product-specific boards?
- What disclosure default does Houston want for voice-clone output in team and
  client contexts: always label, label outside owner-only channels, or per-host
  policy?
