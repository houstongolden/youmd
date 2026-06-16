# You.md Personal API/MCP + YouStacks Product Memo

Date: 2026-06-15

Purpose: route the productizable parts of the h.computer / creator-new late-night idea cloud into You.md, while keeping h.computer as Houston's personal site and living reference implementation.

## Routing Decision

You.md owns the durable primitive:

- Personal API/MCP as the structured identity and context boundary for agents.
- Portable human context using markdown, YAML frontmatter, JSON indexes, OKF-compatible exports, sources, memories, provenance, preferences, project context, and trust rules.
- Protected API/MCP access for private memory, project context, connected sources, tool actions, and audited writeback.
- YouStacks as named, installable packages of skills, workflows, prompts, tools, docs, tests, host adapters, examples, improvement policy, and update policy.
- Connector, crawler, cron, and source-refresh infrastructure for keeping a user's identity fresh.
- Host adapters for Claude Code, Codex, Cursor, ChatGPT, MCP clients, local agents, and future runtimes.
- Skill-learning loops that convert human work into reusable skills and stack updates.
- Stack-level model routing policy, including BYOK and cheaper/open model support.
- Public/private identity modes and gated agent access.

h.computer should consume and demonstrate You.md:

- h.computer remains Houston's personal site, personal agent, living feed, and owner-only control surface.
- h.computer can read from You.md as its canonical identity/context source and write back useful memories, logs, feed items, source updates, and agent-run summaries.
- hstack remains a reference implementation and personal runtime for Houston, not the canonical human-context protocol.
- If multi-tenant `{human}.computer` returns later, it should be built on You.md as the protocol primitive rather than owning the protocol itself.

Creator.new should optionally attach You.md identity/context:

- Creator.new remains the creator workspace builder.
- It can use a You.md connection to prefill creator identity, voice, preferences, source catalog, trust rules, and reusable stack context.
- Creator.new should not own personal API/MCP, broad context protocol, or YouStacks.

## Product Clarification

You.md is not only a profile page. You.md is the durable brain plus portable expertise-stack layer that other products consume.

The product model stays:

```text
Brain -> Stacks -> Runtime -> Protected API/MCP
```

This memo makes the API/MCP and stack layer more explicit:

- **Brain**: identity, memory, private context, project context, source graph, provenance, trust rules, preferences, agent directives, and current state.
- **Stacks**: named expertise packages that teach agents how to work with the brain safely and effectively.
- **Runtime**: the install/update/helper layer that gets You.md into external hosts.
- **Protected API/MCP**: the access boundary for private context, connected tools, source refresh, writeback, approvals, and audit logs.

## Personal API/MCP Contract

The personal API/MCP should expose a coherent user boundary rather than a pile of unrelated endpoints.

Core resources:

- `identity`: public profile, roles, location, links, bio, current positioning.
- `now`: current work, focus, status, active projects, recent updates.
- `projects`: structured project context, repo links, status, next actions, ownership.
- `captures`: raw mobile/host brain dumps, pasted transcripts, inbound SMS/iMessage/Slack events, voice transcript artifacts, deduped idea clusters, routing outcomes, and clarification queues.
- `sources`: source catalog, sync status, provenance, freshness, trust level.
- `memories`: private and scoped memories with source attribution and confidence.
- `preferences`: communication, writing, model, workflow, and agent behavior preferences.
- `trust_rules`: what agents may read, write, infer, share, or mutate.
- `stacks`: installed/published YouStacks, capabilities, host adapters, visibility.
- `activity`: agent-run logs, summaries, writebacks, source refreshes, security events.

Access modes:

- Public read: safe public identity, public stacks, public source summaries.
- Scoped link: time-limited and scope-limited access to selected brain/stacks/projects.
- Owner API key: owner-write and private-read access.
- Agent token: host-specific and stack-specific access with explicit scopes.
- Connected app grant: product-to-product access for h.computer, Creator.new, BAMF.ai, folder.md, and similar consumers.

Writeback should be explicit and provenance-rich:

- Every write records actor, host, stack, source, confidence, timestamp, and reason.
- Sensitive writes should require owner approval or land as proposed changes.
- Agents should never silently overwrite higher-trust human-authored context.

## Lovable-Simple Connector UX

You.md needs a connector experience that feels as simple as Lovable, but writes into structured context instead of app code.

Connector flow:

1. Pick a source or paste a URL/API endpoint.
2. Authenticate or provide a key only when needed.
3. Preview what will be imported and how it maps to You.md objects.
4. Choose visibility and trust rules.
5. Save the source and schedule refresh.
6. Show agent-readable status: last sync, next sync, failures, freshness, and provenance.

First connector set:

- GitHub repos and activity.
- Google Calendar and Gmail.
- LinkedIn / X / public social sources.
- RSS, blogs, Substack, newsletters, custom sites.
- folder.md artifacts.
- BAMF.ai creator context.
- h.computer feed and daily logs.
- Custom webhook.
- Custom JSON endpoint.
- Raw markdown / OKF directory.

Connector docs should generate or update:

- Source schema.
- API/MCP resource/tool description.
- Refresh policy.
- Trust and visibility rules.
- Troubleshooting and fallback behavior.

## Crawlers, Crons, and Monitored Updates

You.md should own identity freshness. h.computer can display freshness, but You.md should be the source refresh brain.

Needed primitives:

- Source ledger with immutable raw versions and content hashes.
- Refresh policies per source: manual, hourly, daily, weekly, webhook-driven.
- Monitored update rules: detect meaningful change, summarize, propose memory/update, require approval when needed.
- Cost controls: native metadata first, cheap extractors second, LLM enrichment only when justified.
- Source health: stale, failing, untrusted, conflict, low-confidence, and no-source warnings.
- Public/private split: public profile refresh is separate from private owner-source refresh.

This connects to the existing OKF provenance work and the immutable-source pipeline already underway.

## Skill Learning Loop

You.md should learn reusable skills from how Houston and other users actually work.

Inputs:

- Human screen recordings.
- Transcripts.
- SOPs and walkthroughs.
- Tool/API lists.
- Fallback paths.
- Agent-run logs and summaries.
- Corrected outputs and review comments.
- Repeated prompts and workflows.

Processing loop:

1. Ingest or link the recording/transcript/log.
2. Extract task intent, tools, prerequisites, steps, edge cases, and acceptance checks.
3. Draft a reusable skill/workflow/prompt/test set.
4. Route into a named YouStack.
5. Smoke test against examples or replay logs.
6. Ask for approval before publishing or installing.
7. Track usage, failures, edits, and improvement suggestions.

Output:

- `SKILL.md` files.
- Workflow docs.
- Prompt templates.
- Tool/API capability maps.
- Host adapter updates.
- Tests/evals.
- Changelog entries and provenance.

## Stack-Level Model Routing

Model routing should be a stack policy, not only a one-off agent instruction.

YouStack manifests should support:

- `orchestratorModel`: judgment, synthesis, architecture, review, security, high-cost wrong answers.
- `leadModel`: planning and implementation once a direction is clear.
- `workerModels`: cheap, repeated, specialized, polling, extraction, QA sweeps.
- `fallbackModels`: what to use when preferred vendors fail or budget is tight.
- `byok`: user-owned keys and provider preferences.
- `costPolicy`: default budget posture, cheap mode, high-confidence mode, and approval thresholds.
- `routingRules`: task classes, risk levels, allowed tools, and review gates.

The runtime should expose this to Claude Code, Codex, Cursor, ChatGPT, MCP clients, and local agents through host-native instructions and API/MCP capability metadata.

## Public/Private Identity Modes

You.md needs identity modes that map cleanly to product use:

- Public profile: safe public identity and public-open stacks.
- Private brain: full owner-only context.
- Scoped agent view: selected context and stacks for a task, repo, product, or collaborator.
- Product integration grant: durable app-level access for h.computer, Creator.new, BAMF.ai, folder.md, and future consumers.
- Team/shared stack: selected YouStacks shared with collaborators while the private brain remains protected.

Every mode needs:

- Clear scopes.
- Expiry and revocation.
- Audit logs.
- Human-readable preview of what the agent/product can see.
- Honest readiness/fallback states when data is missing or access is denied.

## Productization Backlog

### P0: Documentation and product framing

- Add this memo to project context.
- Update PRD and Architecture with the personal API/MCP boundary, h.computer relationship, and connector/source-refresh direction.
- Track active feature requests for connector UX, source refresh, personal API/MCP, skill learning, host adapters, model routing, and gated identity modes.

### P1: Protocol and access foundations

- Define a versioned personal API/MCP resource contract for identity, now, projects, sources, memories, preferences, trust rules, stacks, and activity.
- Align OKF/frontmatter object types with the API resource names.
- Add app-level grants for h.computer and Creator.new style consumers.
- Add previewable scoped grants that show exactly what will be exposed.

### P2: Connector and refresh MVP

- Build the connector grid and detail states in the dashboard.
- Start with GitHub, custom URL/RSS, raw markdown/OKF, h.computer, folder.md, and BAMF.ai.
- Reuse the immutable source ledger and source health model.
- Add refresh policy controls and monitored update summaries.

### P2.5: Mobile capture and project routing MVP

- Add a private brain-dump inbox for Apple Watch/iPhone voice-to-text, SMS/iMessage, pasted transcripts, future audio transcripts, Slack messages, and host-adapter inputs.
- Save raw transcript artifacts first with redacted provider/channel metadata, timestamps, hashes, inferred sessions, and provenance.
- Evaluate Sendblue as an iMessage/SMS/RCS adapter candidate, but keep the gateway provider-agnostic.
- Add a conservative dedupe, segmentation, project classification, memory extraction, task extraction, and clarification queue pipeline.
- Route domain-specific outputs to BAD, Myo, h.computer, Hubify/BigBounce, Creator.new, BAMF.ai, Fantasy.is, and BAMF site without making those apps own the universal capture substrate.
- Require explicit approval or scoped automation rules before any external write to Notion, GitHub issues, project boards, CRM, Slack, or product apps.
- Add voice clone/likeness and Slack host-adapter specs with consent, disclosure, scopes, audit, and revocation before implementation.

### P3: Skill learning MVP

- Add ingestion for transcript/log/SOP artifacts.
- Generate draft skills/workflows into a selected YouStack.
- Add approval, smoke test, and provenance before installation.
- Feed accepted skills into host adapters and docs.

### P4: Stack-level model routing

- Extend `youstack/v1` or draft `youstack/v1.1` with model routing policy.
- Add CLI/MCP inspect output for routing policy.
- Generate host adapter guidance for model tiers and BYOK preferences.
- Add route endpoint support for risk/cost-aware recommendations.

### P5: Product integrations

- h.computer: read You.md identity/context and write back daily logs, feed items, source updates, and agent summaries.
- Creator.new: optionally attach creator identity/context and selected stacks.
- BAMF.ai/folder.md: deepen connector/writeback loops where useful.

## Source Notes Reviewed

- `creator-new/project-context/idea-routing-2026-06-15.md`
- `h-computer/docs/project-context/human-computer-protocol.md`
- `h-computer/docs/project-context/hstack-vision.md`
- `h-computer/docs/project-context/2026-06-15T06-55-42Z-human-computer-protocol-braindump.md`
- `https://h.computer/platform`
- `https://h.computer/docs`
- `https://h.computer/gallery`
- `youmd/project-context/PRD.md`
- `youmd/project-context/ARCHITECTURE.md`
- `youmd/project-context/YOUSTACKS_PRODUCT_LAYER_PRD.md`
- `youmd/project-context/OKF_INTEGRATION.md`
