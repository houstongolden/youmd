# You.md — Go-To-Market Testing Plan

**Last Updated:** 2026-04-07
**Purpose:** Validate that You.md actually solves the identity context problem across every major agent platform before MVP launch. Not just "does the code work" — does the product deliver value when a real human starts a fresh session with a real agent?

**Core thesis to validate:** A user who has a You.md identity bundle should have a measurably better first interaction with ANY AI agent than a user who starts from scratch.

---

## The Problem We're Solving

Every AI agent asks the same questions. Who are you? What do you do? How do you want me to talk? A user running 4-6 agents daily re-explains themselves dozens of times per week. You.md eliminates this by giving every agent structured identity context from the first message.

**What "solving" looks like:**
- Agent knows the user's name, role, projects, and stack before the user says anything
- Agent applies communication preferences (tone, formality, avoid patterns) automatically
- Agent references specific project context without being told
- Agent respects directives (no emoji, no forms, act decisively) from message one
- Private context (internal notes, sensitive projects) is available only to authorized agents

---

## Testing Matrix Overview

### Agent Categories

| Category | Platforms | Integration Method |
|---|---|---|
| **CLI Agents (MCP)** | Claude Code, Codex, Cursor Agent, Terminal in Cursor IDE | MCP server (`youmd mcp`) |
| **CLI Agents (Context Link)** | OpenClaw, Hermes Agent, Pi, Aider, Continue.dev | Share link / system prompt injection |
| **Web Agents (Context Link)** | Claude.ai, ChatGPT, Grok, Gemini, Perplexity | Paste context link or share block |
| **Desktop Agents** | Claude Cowork (local app), Cursor IDE (composer) | MCP config or context link |
| **Autonomous Agents** | Devin, Manus, Computer Use agents | API endpoint / MCP |

### Context Tiers

| Tier | What's Shared | Use Case |
|---|---|---|
| **Public** | Identity, projects, values, links, preferences, voice | General agent sessions, coding assistants, research |
| **Full (Private)** | Public + private notes, internal links, private projects, investment thesis | Trusted agents, personal assistants, project-specific work |
| **Project-Scoped** | Public + specific project context (PRD, TODO, decisions, memories) | Coding agents working on a specific repo |

---

## Phase 1: CLI Agent Testing (MCP Integration)

### Test 1.1: Claude Code — Fresh Session with MCP

**Setup:**
```json
// ~/.claude/settings.json
{
  "mcpServers": {
    "youmd": {
      "command": "npx",
      "args": ["youmd", "mcp"]
    }
  }
}
```

**Test Cases:**

| # | Scenario | Expected Behavior | Pass Criteria |
|---|---|---|---|
| 1.1.1 | Start new Claude Code session in any repo | Agent reads identity via `get_identity` tool | Agent greets by name, references role/projects |
| 1.1.2 | Ask "what do you know about me?" | Agent returns full identity context | Shows name, tagline, projects, preferences |
| 1.1.3 | Ask agent to write code | Agent applies coding preferences (stack, style) | Uses TypeScript, follows directive "no emoji, no forms" |
| 1.1.4 | Ask agent to draft a message | Agent applies communication preferences | Matches tone (direct, no fluff), avoids listed patterns |
| 1.1.5 | Work on a you.md-linked project | Agent reads project context via MCP | References PRD, TODO, recent decisions |
| 1.1.6 | Ask agent to remember something | Agent calls `add_memory` tool | Memory persists to next session |
| 1.1.7 | Start SECOND session (after 1.1.6) | Agent recalls memory from previous session | References the saved memory naturally |
| 1.1.8 | Ask agent to update profile | Agent calls `update_section` tool | Section updated in local .youmd/ |
| 1.1.9 | Ask agent to push changes | Agent calls `push_bundle` tool | Bundle published to you.md servers |
| 1.1.10 | Ask agent to use a skill | Agent calls `use_skill` (e.g., voice-sync) | Returns rendered skill with identity interpolated |

**Verification:**
- [ ] MCP server starts without errors
- [ ] All 15 tools are discoverable by Claude Code
- [ ] Resources list shows identity, memories, projects, skills
- [ ] Agent behavior is measurably different from a session without You.md

---

### Test 1.2: OpenAI Codex CLI — Fresh Session

**Setup:**
- No native MCP support — use context link or system prompt injection
- Run: `youmd link create --scope public` to get a shareable link
- Or: `youmd export --md` and paste into Codex session

**Test Cases:**

| # | Scenario | Expected Behavior | Pass Criteria |
|---|---|---|---|
| 1.2.1 | Start Codex with identity context in system prompt | Codex acknowledges identity | Greets by name, references context |
| 1.2.2 | Ask Codex to write code matching your style | Codex follows preferences | Uses stated stack, follows tone directives |
| 1.2.3 | Ask Codex for a code review | Codex applies your review preferences | Matches communication style |
| 1.2.4 | Start Codex WITHOUT identity context | Codex asks generic questions | Baseline comparison — how much worse is it? |

---

### Test 1.3: Cursor Agent — MCP Integration

**Setup:**
```json
// .cursor/mcp.json
{
  "mcpServers": {
    "youmd": {
      "command": "npx",
      "args": ["youmd", "mcp"]
    }
  }
}
```

**Test Cases:**

| # | Scenario | Expected Behavior | Pass Criteria |
|---|---|---|---|
| 1.3.1 | Open Cursor, start new chat in Agent mode | Agent reads identity via MCP | Knows who you are without asking |
| 1.3.2 | Ask Cursor to refactor code | Applies coding preferences | Follows stack preferences, avoids patterns in directives |
| 1.3.3 | Ask Cursor to write documentation | Applies writing preferences | Matches voice/tone settings |
| 1.3.4 | Use Cursor Composer (multi-file) | Agent uses identity for all files | Consistent style across generated files |
| 1.3.5 | Terminal panel in Cursor IDE | CLI `youmd` commands work | `youmd status`, `youmd chat` functional in integrated terminal |

---

### Test 1.4: OpenClaw — Agent Orchestration

**Setup:**
- OpenClaw spawns sub-agents — each should inherit identity context
- Share via context link or environment variable

**Test Cases:**

| # | Scenario | Expected Behavior | Pass Criteria |
|---|---|---|---|
| 1.4.1 | OpenClaw spawns a coding agent | Agent has identity context | Applies preferences to generated code |
| 1.4.2 | OpenClaw spawns a research agent | Agent has identity context | Research is personalized to user's domain |
| 1.4.3 | Multiple agents in one OpenClaw session | All agents share identity | Consistent behavior across agents |

---

### Test 1.5: Hermes Agent — CLI Tool

**Setup:**
- Context link injection or system prompt file
- `youmd export --md > ~/.hermes/identity.md`

**Test Cases:**

| # | Scenario | Expected Behavior | Pass Criteria |
|---|---|---|---|
| 1.5.1 | Start Hermes with identity file | Agent reads identity | Personalized first interaction |
| 1.5.2 | Ask Hermes to generate code | Follows coding preferences | Stack, style, directives respected |

---

### Test 1.6: Pi CLI Agent

**Setup:**
- System prompt injection or context link

**Test Cases:**

| # | Scenario | Expected Behavior | Pass Criteria |
|---|---|---|---|
| 1.6.1 | Start Pi with identity context | Agent personalizes responses | Knows name, role, preferences |
| 1.6.2 | Ongoing conversation | Agent maintains context | References identity throughout |

---

### Test 1.7: Aider — AI Pair Programming

**Setup:**
- Aider supports `.aider.conf.yml` with custom system prompts
- Inject you.md content into the system message

**Test Cases:**

| # | Scenario | Expected Behavior | Pass Criteria |
|---|---|---|---|
| 1.7.1 | Start Aider with identity in system prompt | Aider follows coding style | Matches stack, conventions |
| 1.7.2 | Multi-file refactor | Consistent style application | All files follow preferences |

---

### Test 1.8: Continue.dev — VS Code AI

**Setup:**
- Continue supports custom system prompts and context providers
- MCP or context injection

**Test Cases:**

| # | Scenario | Expected Behavior | Pass Criteria |
|---|---|---|---|
| 1.8.1 | Start Continue with identity | Agent personalizes completions | Code style matches preferences |
| 1.8.2 | Ask Continue to explain code | Uses communication preferences | Tone, detail level match settings |

---

## Phase 2: Web Agent Testing (Context Link / Share Block)

### Test 2.1: Claude.ai — Web Chat

**Setup:**
- Create context link: `youmd link create --scope public`
- Or use share block from web dashboard

**Test Cases:**

| # | Scenario | Expected Behavior | Pass Criteria |
|---|---|---|---|
| 2.1.1 | Paste context link as first message | Claude reads and acknowledges identity | Shows name, role, preferences in response |
| 2.1.2 | Paste share block with agent prompt | Claude applies preferences immediately | Tone, formality, avoid patterns respected |
| 2.1.3 | Ask Claude to write an email | Uses voice profile and writing preferences | Output matches voice.overall description |
| 2.1.4 | Ask Claude to review a document | Applies communication preferences | Direct, no fluff, references specific expertise |
| 2.1.5 | Start session WITHOUT context | Claude asks generic questions | Baseline comparison |
| 2.1.6 | Use context link with FULL scope (private) | Claude sees private notes, projects | References private context appropriately |
| 2.1.7 | Create a project conversation | Claude uses project context | References PRD, current sprint, decisions |

---

### Test 2.2: Claude Cowork (Desktop App)

**Setup:**
- Local desktop app — may support MCP or file-based context
- Test with context link pasted into conversation

**Test Cases:**

| # | Scenario | Expected Behavior | Pass Criteria |
|---|---|---|---|
| 2.2.1 | Start Cowork session with context link | Agent reads identity | Personalized from first message |
| 2.2.2 | Multi-turn conversation | Agent maintains identity throughout | Consistent application of preferences |
| 2.2.3 | Switch between projects | Agent adapts to project context | Different project = different context |

---

### Test 2.3: ChatGPT — Web/Desktop

**Setup:**
- Paste context link or you.md markdown
- Test with Custom Instructions if supported

**Test Cases:**

| # | Scenario | Expected Behavior | Pass Criteria |
|---|---|---|---|
| 2.3.1 | Paste you.md/you.txt content | ChatGPT acknowledges identity | Uses name, references projects |
| 2.3.2 | Ask to write code | Follows stack/style preferences | Matches directives |
| 2.3.3 | Ask to draft communication | Applies voice profile | Tone, formality, avoid patterns |
| 2.3.4 | Custom Instructions with you.md content | Persistent identity across chats | Every new chat starts with context |
| 2.3.5 | GPT-4o vs GPT-4 comparison | Both parse identity correctly | Schema-agnostic compatibility |

---

### Test 2.4: Grok (X/xAI)

**Setup:**
- Paste context link or share block

**Test Cases:**

| # | Scenario | Expected Behavior | Pass Criteria |
|---|---|---|---|
| 2.4.1 | Paste identity context | Grok acknowledges and applies | Personalized responses |
| 2.4.2 | Ask Grok to draft a tweet | Uses voice profile | Matches X-specific voice if available |
| 2.4.3 | Ask Grok about your projects | References specific project data | Names, roles, descriptions accurate |

---

### Test 2.5: Gemini (Google)

**Setup:**
- Paste context link or you.json
- Test with Gemini Advanced and Gemini Gems

**Test Cases:**

| # | Scenario | Expected Behavior | Pass Criteria |
|---|---|---|---|
| 2.5.1 | Paste identity to Gemini | Gemini reads and applies | Personalized from first response |
| 2.5.2 | Create a Gem with identity context | Persistent identity in Gem | Every conversation in Gem starts personalized |
| 2.5.3 | Multimodal (voice/image + identity) | Identity context enriches all modalities | Consistent personalization |

---

### Test 2.6: Perplexity

**Setup:**
- Paste context link or identity markdown

**Test Cases:**

| # | Scenario | Expected Behavior | Pass Criteria |
|---|---|---|---|
| 2.6.1 | Paste identity + ask a research question | Perplexity personalizes research | Filters results by domain expertise |
| 2.6.2 | Ask about your own industry | References your specific position | Contextualizes findings to your role |

---

### Test 2.7: Manus (Autonomous Agent)

**Setup:**
- API integration or context injection

**Test Cases:**

| # | Scenario | Expected Behavior | Pass Criteria |
|---|---|---|---|
| 2.7.1 | Deploy Manus with identity context | Manus applies preferences to autonomous tasks | All outputs match communication style |
| 2.7.2 | Multi-step task | Identity context persists across steps | Consistent personalization throughout |

---

## Phase 3: Integration Scenario Testing

### Test 3.1: Cross-Platform Consistency

| # | Scenario | Expected Behavior | Pass Criteria |
|---|---|---|---|
| 3.1.1 | Same prompt to Claude Code + Claude.ai + ChatGPT | All produce identity-consistent output | Tone, style, preferences match across platforms |
| 3.1.2 | Update identity on one platform | Changes propagate to all | `youmd push` → all agents see updated data |
| 3.1.3 | Private context only to authorized agents | Full-scope link shows private, public doesn't | Context scoping works correctly |

---

### Test 3.2: Use Case Scenarios

#### 3.2.1: "I Just Hired a New AI Coding Assistant"

**User story:** Developer installs Claude Code, Cursor, or Codex for the first time. Instead of spending 20 minutes configuring and explaining themselves, they run `youmd mcp --install claude` and the agent immediately knows their stack, style, and active projects.

**Test flow:**
1. Fresh install of Claude Code (no prior sessions)
2. Configure MCP with `youmd mcp --install claude`
3. Open a project and start working
4. Measure: time to first useful output vs. no-youmd baseline
5. Quality: does the agent's first response match preferences?

**Success metric:** First useful response in <30 seconds (vs. 5+ minutes of explaining without You.md)

---

#### 3.2.2: "I'm Starting a New Project"

**User story:** Developer starts a new repo. Instead of writing CLAUDE.md from scratch, they run `youmd skill use claude-md-generator` and get a CLAUDE.md pre-loaded with their identity, preferences, and stack.

**Test flow:**
1. Create empty git repo
2. Run `youmd skill init-project`
3. Verify CLAUDE.md has identity context
4. Verify project-context/ has scaffolded docs
5. Open Claude Code — agent reads the generated CLAUDE.md
6. Measure: agent knows who you are from first message

**Success metric:** Agent-ready project setup in <60 seconds

---

#### 3.2.3: "I Need to Brief a New Agent on My Project"

**User story:** User is switching from Claude Code to Cursor, or bringing on a second agent. Instead of re-explaining the project, they share a context link.

**Test flow:**
1. Create context link: `youmd link create --scope full --ttl 7d`
2. Paste into new agent session
3. Agent reads identity + project context
4. Ask agent to continue work on the project
5. Measure: agent understands the project state without explanation

**Success metric:** Agent productive on existing project in <2 minutes

---

#### 3.2.4: "I Want Every Web Agent to Know Me"

**User story:** User chats with Claude.ai, ChatGPT, Gemini, and Grok throughout the day. Instead of re-introducing themselves each time, they paste their you.md share block.

**Test flow:**
1. Generate share block from web dashboard or CLI
2. Paste into 4 different web agents
3. Ask each the same question
4. Compare: are all responses personalized? Consistent?

**Success metric:** All 4 agents produce identity-aware responses from the first message

---

#### 3.2.5: "I Have Sensitive Context I Only Share with Trusted Agents"

**User story:** User has private investment notes, internal project details, and personal goals they only want their primary coding agent to see.

**Test flow:**
1. Create public context link: `youmd link create --scope public`
2. Create full context link: `youmd link create --scope full`
3. Share public link with a casual web agent
4. Share full link with trusted coding agent
5. Verify: public agent sees only public data
6. Verify: trusted agent sees private notes, projects, links

**Success metric:** Context scoping works — private data never leaks to public scope

---

#### 3.2.6: "I Want My Agent to Match My Communication Style"

**User story:** User has specific preferences: direct tone, no emoji, no corporate speak, short paragraphs. They want EVERY agent to follow these rules.

**Test flow:**
1. Set preferences via CLI: `youmd chat` → tell agent preferences
2. Push to server: `youmd push`
3. Test in 3 different agents (Claude Code, Claude.ai, ChatGPT)
4. Ask each to: write an email, explain a concept, review code
5. Measure: does each agent's output match the voice profile?

**Success metric:** Communication preferences consistently applied across all agents

---

#### 3.2.7: "I Want My Agent to Know My Design Preferences"

**User story:** User has strong opinions about UI/UX — monochrome + accent color, terminal-native, no rounded cards, JetBrains Mono font. They want coding agents to apply these when generating UI code.

**Test flow:**
1. Set design preferences in directives/agent.md
2. Push to server
3. Ask Claude Code to generate a React component
4. Ask Cursor to create a landing page
5. Measure: does generated UI match the design system preferences?

**Success metric:** Generated UI code reflects the user's stated design preferences

---

#### 3.2.8: "I'm an Agency Running Multiple Client Projects"

**User story:** Agency developer works on 5 different client projects. Each has different stack, style, and requirements. You.md project context keeps them separate.

**Test flow:**
1. Initialize 3 different project contexts via `youmd project init`
2. Switch between projects in the CLI/IDE
3. Verify: agent loads correct project context for each
4. Verify: no cross-contamination between projects

**Success metric:** Per-project context isolation works cleanly

---

## Phase 4: Performance & Reliability Testing

| # | Test | Pass Criteria |
|---|---|---|
| 4.1 | MCP server startup time | <3 seconds to first tool response |
| 4.2 | Context link resolution time | <500ms for public scope |
| 4.3 | Full identity JSON response size | <50KB (agent-friendly) |
| 4.4 | you.md markdown response size | <20KB |
| 4.5 | Concurrent agent access | 5 agents reading simultaneously, no errors |
| 4.6 | Context link TTL enforcement | Expired links return 410 Gone |
| 4.7 | API rate limiting (future) | Graceful degradation under load |
| 4.8 | MCP server memory usage | <100MB after 1hr of continuous use |
| 4.9 | Bundle push latency | <2s for average bundle size |
| 4.10 | Profile page load time | <1.5s TTFB, <3s full render |

---

## Phase 5: Content Quality Testing

### What Makes Identity Context "Good"?

| Dimension | Poor | Adequate | Excellent |
|---|---|---|---|
| **Bio** | "I work in tech" | "Software engineer at Acme Corp" | "Staff engineer at Acme Corp, 8 years in distributed systems. Currently leading the payment routing rewrite. Previously Stripe, where I built the retry middleware." |
| **Projects** | "My project" | "Building a SaaS app" | "ScreenshotAPI ($8k MRR) — website screenshot API for developers. Solo founder, TypeScript/Cloudflare Workers stack." |
| **Preferences** | "Be nice" | "Direct tone, casual" | "Tone: direct, no fluff, terminal-native. Avoid: corporate jargon, emoji, passive voice, verbose explanations. Act first, explain second." |
| **Voice** | Empty | "Casual writing" | "Direct, builder energy. Short sentences. Technical but approachable. References specific details, not abstractions." |
| **Directives** | Empty | "Don't use emoji" | "No emoji. No forms. No corporate speak. Act decisively — say 'adding that now' not 'would you like me to add that?'. Default stack: TypeScript, Next.js, Convex, Tailwind." |

### Content quality test:
1. Generate identity via `youmd init` with minimal input
2. Score the auto-generated content on the rubric above
3. Generate via `youmd init` with rich input (LinkedIn, GitHub, X handles)
4. Score again — should be significantly better
5. Iterate on prompts if content quality is below "Adequate"

---

## Phase 6: Competitive Baseline

### Without You.md (Control Group)

For each agent platform, run the SAME task twice:
1. **With You.md:** Identity context provided via MCP, context link, or share block
2. **Without You.md:** Fresh session, no context

**Measure:**
- Time to first useful output (seconds)
- Number of clarifying questions the agent asks
- Quality of output (does it match the user's actual preferences?)
- User satisfaction (1-5 scale)

**Expected results:**
- With You.md: 0-1 clarifying questions, personalized from message 1
- Without You.md: 3-5 clarifying questions, generic first few messages

---

## Test Execution Priority

### Week 1: Core Validation (Must Pass)
1. Claude Code + MCP (Test 1.1) — our primary use case
2. Claude.ai + context link (Test 2.1) — largest agent user base
3. Cross-platform consistency (Test 3.1)
4. "New coding assistant" scenario (Test 3.2.1)
5. Communication style matching (Test 3.2.6)

### Week 2: Platform Coverage
6. Cursor + MCP (Test 1.3)
7. ChatGPT + context link (Test 2.3)
8. Gemini + context link (Test 2.5)
9. Codex CLI (Test 1.2)
10. Private context scoping (Test 3.2.5)

### Week 3: Edge Cases & Polish
11. OpenClaw (Test 1.4)
12. Hermes (Test 1.5)
13. Grok (Test 2.4)
14. Perplexity (Test 2.6)
15. Performance benchmarks (Phase 4)
16. Content quality (Phase 5)
17. Competitive baseline (Phase 6)

---

## Success Criteria for MVP Launch

**Hard requirements (must all pass):**
- [ ] Claude Code MCP integration works end-to-end (install → identity → tools → memory)
- [ ] At least 3 web agents (Claude.ai, ChatGPT, Gemini) correctly parse and apply identity
- [ ] Context links resolve correctly for both public and full scope
- [ ] CLI `youmd init` → `youmd push` → web profile display works
- [ ] Communication preferences are applied by at least 4 different agents
- [ ] Private context stays private (never leaks to public-scope access)

**Soft requirements (strong signal):**
- [ ] 5+ CLI agents work with MCP or context injection
- [ ] Content quality scores "Adequate" or better on all dimensions
- [ ] Time-to-first-useful-output improves by >3x vs. no-youmd baseline
- [ ] At least one "whoa" moment per agent platform tested

**Launch blockers discovered during testing:**
- [ ] (to be filled in during test execution)

---

## Tracking

| Platform | Status | Tester | Date | Notes |
|---|---|---|---|---|
| Claude Code (MCP) | NOT STARTED | | | |
| Codex CLI | NOT STARTED | | | |
| Cursor (MCP) | NOT STARTED | | | |
| Cursor Terminal | NOT STARTED | | | |
| OpenClaw | NOT STARTED | | | |
| Hermes | NOT STARTED | | | |
| Pi CLI | NOT STARTED | | | |
| Aider | NOT STARTED | | | |
| Continue.dev | NOT STARTED | | | |
| Claude.ai | NOT STARTED | | | |
| Claude Cowork | NOT STARTED | | | |
| ChatGPT | NOT STARTED | | | |
| Grok | NOT STARTED | | | |
| Gemini | NOT STARTED | | | |
| Perplexity | NOT STARTED | | | |
| Manus | NOT STARTED | | | |
