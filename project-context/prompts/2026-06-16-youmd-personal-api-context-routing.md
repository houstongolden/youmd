# 2026-06-16 — You.md personal API/context routing capture

## Purpose

Houston is about to remove or narrow some h.computer product/vision pages. This
note preserves the You.md-relevant ideas before they disappear and routes them
to the correct home.

Decision: You.md owns the canonical personal identity/context/API/MCP primitive.
h.computer remains Houston's personal site, personal agent, and reference
implementation powered by You.md.

## Source Context Read

- `AGENTS.md`
- `project-context/PRD.md`
- `project-context/ARCHITECTURE.md`
- `project-context/YOUSTACKS_PRODUCT_LAYER_PRD.md`
- `project-context/OKF_INTEGRATION.md`
- `project-context/CURRENT_STATE.md`
- `../h-computer/docs/project-context/vision.md`
- `../h-computer/docs/project-context/hstack-vision.md`
- `../h-computer/docs/project-context/human-computer-protocol.md`
- `../h-computer/docs/project-context/2026-06-15T06-55-42Z-human-computer-protocol-braindump.md`
- `../creator-new/project-context/idea-routing-2026-06-15.md`

## You.md-Native Translation

You.md should become:

- the durable agent brain: identity, memory, preferences, private context,
  project context, source catalog, provenance, trust rules, public/private
  context links, protected API/MCP
- the intuitive personal API/MCP layer: structured context API for the person,
  scoped links, API keys, MCP, host adapters, connected-app grants, connector
  ingestion, crawlers, crons, monitored refresh, and public/private modes
- the reusable capability layer through YouStacks: skills, workflows, prompts,
  examples, tools, tests, docs, host adapters, update policies, improvement
  policies, and folder.md-style readable structure
- the substrate agents use before they improvise, not another chatbot or a
  personal-brand website

## Messaging To Preserve In You.md

- "Your agent brain and best workflows for every AI agent"
- "Brain -> Stacks -> Runtime -> Protected API/MCP"
- "The context every agent should already have"
- "A personal API where the context is you"
- "Your portable identity and expertise stack for the agent internet"
- "Not another chatbot; the substrate your agents use before they improvise"

These should be rewritten as You.md-native copy. Do not copy h.computer prose
verbatim into public PRD/product copy.

## Relationship Map

- You.md: canonical protocol, durable brain, personal API/MCP, YouStacks, trust
  and provenance layer.
- h.computer: Houston's personal site/agent/reference implementation that reads
  from You.md and can write useful memories/activity back.
- Creator.new: BAMF-powered creator builder that can optionally attach You.md
  identity/context.
- folder.md: agent-readable storage/file conventions and durable folder
  structure inspiration.
- BAMF.ai: creator/social/media engine, API/MCP, BAMFStack, content generation,
  approvals, analytics, scheduling.
- BAMF OS: private/internal BAMF company brain, CRM, client portals, and admin
  tooling.

## Roadmap Ideas To Keep In You.md

- Lovable-simple connector UX.
- Custom source crawlers and refresh jobs.
- Context-link and MCP polish.
- YouStacks distribution.
- Screen-recording/transcript/SOP-to-skill learning loop.
- Host adapters for Claude Code, Codex, Cursor, ChatGPT, MCP clients, and local
  agents.
- BYOK/model routing as an advanced stack capability, not headline marketing.

## Boundaries

- Do not make You.md sound like h.computer.
- Do not make h.computer the product primitive.
- Do not make a separate "Human API" canon outside You.md unless You.md is still
  the source of truth.
- Do not store secrets in project-context.

## Raw Current Prompt

> sharing this for context again as you may partially but not fully know or have context i wanna share this with you before i remove all these other features/pages from h.computer so you can save them and reference them etc as i realized after workin on these ideas for h.computer last night that they should be saved for you.md and h.computer should moreso just remain my personal agent personal brand site where I experiement and test integrating all my other various API/MCPs etc :)
>
> ---
> You are working in the You.md project.
>
> Context: I had a late-night brain dump across h.computer, Creator.new, BAMF.ai, and You.md, and we have now clarified the product boundaries. A lot of the best language from h.computer’s newest platform/vision/human-computer-protocol/hstack-vision docs actually belongs in You.md first.
>
> Your job is to update You.md project context and messaging so the strongest “personal API / human context protocol / connector-backed agent brain / YouStacks” ideas are preserved in the right home.
>
> Before editing, read:
> - AGENTS.md
> - project-context/PRD.md
> - project-context/ARCHITECTURE.md
> - project-context/YOUSTACKS_PRODUCT_LAYER_PRD.md
> - project-context/OKF_INTEGRATION.md
> - project-context/CURRENT_STATE.md
> - h-computer docs if accessible locally:
>   - ../h-computer/docs/project-context/vision.md
>   - ../h-computer/docs/project-context/hstack-vision.md
>   - ../h-computer/docs/project-context/human-computer-protocol.md
>   - ../h-computer/docs/project-context/2026-06-15T06-55-42Z-human-computer-protocol-braindump.md
> - Creator.new routing memo if accessible:
>   - ../creator-new/project-context/idea-routing-2026-06-15.md
>
> Core clarification:
> You.md owns the broad personal identity/context/API/MCP primitive. h.computer should be Houston’s personal site and reference implementation, not the canonical home for the general “human API” product.
>
> Please update You.md docs so they clearly absorb these ideas:
>
> 1. You.md is the user’s durable agent brain:
>    - identity
>    - memory
>    - preferences
>    - private context
>    - project context
>    - source catalog
>    - provenance
>    - trust rules
>    - public/private context links
>    - protected API/MCP
>
> 2. You.md should become the intuitive “personal API/MCP” layer:
>    - a structured, extensible context API for the person
>    - safe agent access through scoped links, API keys, MCP, and host adapters
>    - connector-backed data ingestion and refresh
>    - crawlers/crons/monitors for user-approved sources
>    - public and private context modes
>
> 3. YouStacks should carry the reusable capability layer:
>    - skills
>    - workflows
>    - prompts
>    - examples
>    - tools
>    - tests
>    - docs
>    - host adapters
>    - update/improvement policies
>    - folder.md-style readable structure
>
> 4. Preserve and adapt the best h.computer language, but route it to You.md:
>    - “Your agent brain and best workflows for every AI agent”
>    - “Brain -> Stacks -> Runtime -> Protected API/MCP”
>    - “The context every agent should already have”
>    - “A personal API where the context is you”
>    - “Your portable identity and expertise stack for the agent internet”
>    - “Not another chatbot; the substrate your agents use before they improvise”
>
> 5. Add a clear relationship section:
>    - You.md = canonical protocol and brain
>    - h.computer = Houston’s personal site/agent/reference implementation powered by You.md
>    - Creator.new = BAMF-powered creator builder that can optionally attach You.md identity/context
>    - folder.md = agent-readable storage/file conventions
>    - BAMF.ai = creator/social/media engine
>    - BAMF OS = private/internal BAMF company brain and client portal tools
>
> 6. Add or update a roadmap section for:
>    - Lovable-simple connector UX
>    - custom source crawlers and refresh jobs
>    - context-link and MCP polish
>    - YouStacks distribution
>    - screen-recording/transcript/SOP-to-skill learning loop
>    - host adapters for Claude Code, Codex, Cursor, ChatGPT, MCP clients, local agents
>    - BYOK/model-routing support as advanced capability, not headline copy
>
> Important boundaries:
> - Do not make You.md sound like h.computer.
> - Do not make h.computer the product primitive.
> - Do not copy raw h.computer docs verbatim into final PRD copy; extract the strongest concepts and rewrite them as You.md-native.
> - Preserve raw prompts/context in project-context/prompts/ with a 2026-06-16 dated note.
> - Update project-context/TODO.md, FEATURES.md, CHANGELOG.md, and feature-requests-active.md if this repo expects that.
> - Do not store secrets.
> - Commit the docs/context changes as one coherent docs commit.
>
> Deliverables:
> - A new project-context prompt/context capture for this request.
> - Updated You.md PRD/vision/messaging docs.
> - A concise summary of exactly what changed and what remains open.
