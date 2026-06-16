# Voice Memo Part 2 You.md Handoff

Date: 2026-06-16
Status: You.md routing/docs lane complete; product implementation pending
Owner: You.md

## Scope

This handoff consolidates the You.md-owned slice of Houston's 2026-06-16
Apple Watch/SMS voice-memo brain dump so the work stops living only across
scattered memos and request logs.

You.md owns the durable substrate:

- Universal mobile/host capture inbox.
- Personal API/MCP `captures` boundary and audit trail.
- Raw transcript artifacts, redaction, dedupe, segmentation, and routing.
- Project task/memory/doc-update proposals plus approval gates.
- Voice/likeness grants and custom-voice safety.
- Slack host adapter policy and scoped identity rules.
- The "agent is you" / amplified-user framing.
- YouStacks/runtime/API ownership for how captured work reaches downstream
  products.

Product consumers remain downstream:

- BAD for workout/session UX.
- Myo for health/body/productivity-specific follow-through.
- h.computer as Houston's personal reference implementation.
- Hubify/BigBounce, Creator.new, BAMF.ai, Fantasy.is, and BAMF site as routed
  project consumers.

## Current Status

| Topic | Done | Next implementation slice | Blocked decisions |
|---|---|---|---|
| Universal mobile capture inbox | Captured in `MOBILE_CAPTURE_AND_PROJECT_ROUTING_2026-06-16.md`, `FEATURES.md`, `TODO.md`, and active request `#129` as a You.md-owned substrate for Watch/iPhone voice-to-text, SMS/iMessage, pasted transcripts, Slack, CLI/web shell, and future audio uploads. | Add `captures`/`captureEvents`/artifact storage schema and a private review surface. | Need to choose the first v1 inbox home: `/shell` `connect -> api/mcp`, a dedicated inbox pane, or Files/Reports. |
| Sendblue / iMessage / SMS gateway | Captured as provider-agnostic architecture with Sendblue documented only as an adapter candidate. | Define adapter interface, webhook normalization, signature verification, replay protection, and redacted metadata handling. | Need to choose the first inbound pilot: Sendblue iMessage/SMS, generic SMS/RCS, Slack DM, manual paste, or audio transcript upload. No live provider credentials are committed here. |
| Raw transcript artifacts | Raw-first private artifact handling, redacted source metadata, hashes, session candidates, and provenance are documented. | Add immutable raw artifact storage plus media/transcript attachment metadata. | Need storage/media limits and retention policy decisions for future audio uploads. |
| Dedupe / segmentation / routing | Conservative pipeline and processing states are documented, including dedupe, session linking, segmentation, classification, and clarification queue handling. | Build deterministic first-pass dedupe/session/segmentation before any LLM interpretation. | Need success heuristics for session boundaries and repeated-dictation collapse. |
| Project task proposals | Project/task/memory/doc-update proposals are captured in the memo and request tracking. | Add proposal objects plus owner review controls for approve, batch approve, ignore, and edit. | Need to choose the first downstream task destination after You.md-native proposals: project-context docs, GitHub issues, Notion, or product-specific boards. |
| Approval gates | External writes are explicitly documented as proposed-by-default, with scoped automation only after owner approval. | Reuse connected-app grants/write policy patterns for capture-specific approvals, automation rules, and audit rows. | Need default automation rules and UI placement for owner approvals. |
| ElevenLabs / custom voice safety | Custom-voice direction is captured with consent, disclosure, audit, revocation, and host controls. | Write the dedicated voice safety spec before any live provider integration. | Need a disclosure default for team/client contexts: always label, label outside owner-only channels, or per-host policy. No ElevenLabs credentials are present in this repo lane. |
| Voice / likeness grants | Revocable scoped voice/likeness permissions are documented as explicit grants rather than ambient behavior. | Define a grant schema, host scoping, revocation flows, and audit records distinct from generic connected-app auth. | Need to decide whether voice grants extend the existing `yg_` model or become a dedicated grant family. |
| Slack host adapter | Slack adapter direction is documented with workspace/channel allowlists, draft/send modes, action scopes, disclosure, and audit requirements. | Write the Slack host-adapter spec and v1 grant model before wiring any live Slack app. | Need to choose the first Slack mode: draft-only, owner DM send, or scoped workspace/channel send. No Slack credentials or app config are present in this repo lane. |
| "Agent is you" framing | Captured in the mobile-capture memo as "an amplified version of the user without becoming deceptive" and aligned with You.md's existing "A personal API where the context is you" language. | Preserve this phrasing in future inbox, Slack, and voice specs/UI copy so the product stays identity-native rather than generic assistant software. | No blocker for docs; future product copy should keep this as a guardrail. |
| `y.computer` naming note | Captured as a future runtime/domain exploration while explicitly preserving `h.computer` as Houston's personal implementation/reference surface. | Keep as a naming note only; do not rename current products or URLs. | Naming/product decision deferred; no implementation work should assume a rename. |
| YouStack / API / MCP ownership | Preserved across the personal API/MCP memo, mobile-capture memo, features/current-state docs, and active requests: You.md owns the brain, protected API/MCP, captures resource, grants, host adapters, and YouStacks boundary. | Keep future capture resources, grant scopes, and routing outputs anchored in You.md instead of product-specific silos. | No blocker beyond normal implementation sequencing. |

## Recommended Next Slice

1. Define the `captures` resource contract and Convex data model for raw
   artifacts, routing proposals, approvals, sessions, and audit links.
2. Start with a zero-credential input path first: manual paste plus CLI/web
   shell host messages, so the inbox, raw artifact flow, dedupe, and proposal UI
   can be built before Sendblue/Slack decisions.
3. Add a private Brain Dump Inbox review surface with raw vs processed views,
   project routing, task proposals, and owner approval actions.
4. Write two safety specs before external integrations:
   `Slack host adapter` and `voice/likeness grants`.

## Explicit Blocks

- No live Sendblue integration should land until pilot-provider selection,
  credentials, webhook verification rules, and compliance/risk posture are
  approved.
- No live Slack integration should land until v1 send scope and disclosure rules
  are approved.
- No live ElevenLabs/custom voice integration should land until disclosure
  defaults, grant shape, and revocation/audit behavior are approved.
