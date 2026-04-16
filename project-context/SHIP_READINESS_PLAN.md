# You.md — Ship Readiness Plan

Last Updated: 2026-04-16
Owner: Houston + coding agents
Status: Active

## Goal

Make You.md genuinely ready for public release:

- local CLI/TUI is the strongest surface for power users
- web agent experience is trustworthy, proactive, and personality-rich
- MCP + API + skill flows work end-to-end instead of only looking good in docs
- local and web agent experiences are aligned enough that users do not feel like they are using two different products

## Release Bar

Nothing ships as "ready" until all of the following are true:

- CLI onboarding works end-to-end with real account auth, source ingestion, build, push, and publish
- `youmd skill init-project` works in fresh repos and existing repos without clobbering user-owned docs
- MCP works from real agent clients without manual surgery beyond documented install steps
- web shell agent reliably executes real mutations instead of merely sounding capable
- core API endpoints behave correctly with auth, rate limits, and expected error handling
- agent voice/personality is consistent across local and web surfaces
- dashboard/docs/marketing describe real shipped behavior

## Workstreams

### 1. CLI + Skill + MCP Hard Testing

Run real end-to-end flows, not only unit-level checks.

- Fresh-machine simulation:
  - `npx youmd init`
  - `youmd register` / `youmd login`
  - `youmd push`
  - `youmd skill install all`
  - `youmd skill init-project`
  - `youmd mcp --json`
  - `youmd mcp --install claude --auto`
- Existing-repo simulation:
  - repo with hand-written `AGENTS.md`
  - repo with hand-written `CLAUDE.md`
  - repo with robust `project-context/`
  - repo with Cursor/Codex directories already present
- Verify:
  - generated `.you/` contents
  - managed bootstrap block updates
  - no destructive rewrites
  - linked skills appear where the target agent expects them
  - local bundled-skill catalog upgrades cleanly on existing installs

### 2. API + MCP Endpoint Audit

Build a coverage matrix for all major endpoints and MCP tools.

- Public profile endpoints
- authenticated `/api/v1/me/*` endpoints
- skills endpoints
- activity/agents endpoints
- context link endpoints
- MCP tool calls:
  - `get_identity`
  - `search_profiles`
  - `get_my_identity`
  - `use_skill`
  - `compile_bundle`
  - `push_bundle`
  - activity log tools
- Verify:
  - auth behavior
  - error shape consistency
  - rate-limit behavior
  - payload sanity
  - actual usefulness from a real agent client

### 3. Web Agent Reliability Audit

Focus on the real pain point: the web agent often does not act the way Houston expects.

- Audit `src/hooks/useYouAgent.ts` against actual user journeys:
  - profile updates
  - source additions
  - portrait actions
  - memory saves
  - custom section creation
  - project-context updates
- Verify tool-execution paths:
  - Anthropic `tool_use`
  - OpenRouter fallback behavior
  - mutation calls and error handling
  - UI state transitions
- Create a reproducible bug matrix:
  - "agent said it did something but didn’t"
  - "agent used generic language instead of acting"
  - "agent response looked right but state didn’t change"
  - "pane switch / shell command mismatch"

### 4. Local vs Web Agent Parity

Document where parity is required and where local should intentionally be better.

- Parity required:
  - identity understanding
  - personality baseline
  - project/context awareness
  - memory behavior
  - source handling expectations
  - skill awareness
- Local can lead:
  - terminal rendering
  - repo bootstrap
  - skill linking
  - MCP installation
  - power-user workflow velocity
- Web must not feel broken or timid relative to local:
  - action confidence
  - proactive suggestions
  - mutation reliability
  - visible progress

### 5. Personality + Proactiveness Audit

Review both prompt layers and observed behavior.

- CLI onboarding personality
- CLI chat personality
- web shell personality
- proactive suggestions
- anti-patterns:
  - corporate filler
  - fake capability language
  - excessive permission-asking
  - "the system handles that" deflection
  - generic summaries instead of specific actions

### 6. UI/UX + Docs Truth Audit

- dashboard panes match working functionality
- docs page matches actual commands and outputs
- landing claims match real product behavior
- help panes and slash-command references are correct
- onboarding "what’s next" guidance reflects the best current flow

## Execution Order

### Phase 1 — Evidence

- enumerate real flows
- capture failures
- identify doc/marketing drift
- identify local vs web parity gaps

### Phase 2 — Fixes

- fix critical CLI/MCP/API breakpoints
- fix web-agent execution and confidence issues
- fix prompt/personality drift
- fix docs/UI truth mismatches discovered during testing

### Phase 3 — Ship Gate

- rerun the full smoke matrix
- verify deployment behavior in prod
- verify npm publish path for the CLI
- produce a short public-release checklist

## Deliverables

- endpoint + MCP coverage matrix
- CLI/MCP smoke-test script or checklist
- web-agent bug matrix with repros
- local-vs-web parity doc
- personality/proactiveness audit notes
- final release checklist

## Open Questions

- How much of the cross-agent global stack-sync pattern belongs inside You.md core versus a separate optional skill/workflow?
- Should repo bootstrap eventually write `.codex/AGENTS.md` or equivalent agent-native entrypoints automatically, or keep that in linked skills only?
- Which parts of public release readiness must be validated in prod before npm publish is considered safe?
