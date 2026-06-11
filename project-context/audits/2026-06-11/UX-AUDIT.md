# You.md UX Audit — 2026-06-11

Synthesis of four dimension audits (web journey, CLI journey, self-improvement loops, agent-facing surfaces). Every claim below was verified against the repo; surprising claims were re-read at the cited lines before inclusion. Findings are deduped across dimensions.

**Mission lens:** make you.md feel magical, intuitive, and alive. The verdict: the personality infrastructure (spinners, thinking phrases, ASCII portraits, terminal voice) is genuinely world-class. The breakage is concentrated in **transitions** — login→init→push, claim→refresh, stream→render, publish→profile-URL — exactly the moments that should be the payoff.

---

## 1. Journey Maps

### 1.1 Web journey

| Step | Score | What works | What breaks |
|---|---|---|---|
| First visit (homepage) | 7/10 | Clean hero, disciplined design system | Only 3 sections render (`src/app/(marketing)/page.tsx:30-41`); the only portrait is a hardcoded JPEG of Houston (`src/components/landing/HeroPortrait.tsx:84`); 12+ orphaned landing components drift in `src/components/landing/` |
| Sign-up | 8/10 | True terminal sequence, zero forms, inline GitHub OAuth | Append-only steps — a typo'd email is unrecoverable (`src/app/(app)/sign-up/[[...sign-up]]/page.tsx:79-90`); verify failure returns to verify, not email (`:206-214`) |
| Brain build (/initialize) | 6.5/10 | Boot theater has soul; U encounter + portrait ask within first interactions (`initialize-content.tsx:405-486`) | **Funnel hole:** any refresh after username claim redirects to /shell forever — only username existence is checked, never onboarding completion (`initialize-content.tsx:143-147`). Boot checkmarks are fixed-timer fiction with no skip until "ready" (`:86-97, 166-174, 369-374`) |
| Daily use (dashboard) | 7/10 | Powerful shell: input history, cmd+K palette, image paste | Boots into a **collapsed** panel, contradicting the documented 35/65 split — and its own loading skeleton, causing a layout snap (`dashboard-content.tsx:115` vs `:193,201`). Pane taxonomy names two different things "activity" (`:53-67`). Profile preview is a full iframe reload of the app (`:425-431`) |
| Public profile | 8.5/10 | Agent-brain endpoints panel above the fold with copy buttons + retrieval order (`profile-content.tsx:559-631`); owner view toggle; raw JSON mode | Genuinely novel; no major friction |

### 1.2 CLI journey

| Step | Score | What works | What breaks |
|---|---|---|---|
| Install → first run | 8/10 | Natural-language first-run ("sign in", "later"); 12h-cached update check with 1.5s timeout | Three surfaces give three different command orderings (postinstall vs bare welcome vs finishBundle) |
| Login | 4/10 | Email-code path is complete and in-terminal | **Default (Enter) path dead-ends:** opens browser, tells user to dig an API key out of settings and re-run `login --key` (`cli/src/commands/login.ts:129-158`). No device flow, no callback |
| Onboarding conversation | 6/10 | Portrait moment is magical (`onboarding.ts:1661-1763`); first turn streams; 70 thinking phrases | `DONE_PHRASES` includes bare `no`/`nah`/`nope`/`ready` (`onboarding.ts:272-293`) — answering "no, I'm based in Miami" silently ends onboarding and compiles a half-empty bundle. Turns 2+ don't stream. Portrait only renders if X/GitHub given; "we'll try again later" never retries (`:1717,1761`) |
| Publish payoff | 3/10 | Celebration moment exists | **Celebration links are broken:** `https://you.md/@username` renders the unclaimed-profile stub, not the profile (`status.ts:256,365`, `whoami.ts:123`; route does no @-normalization) |
| Daily chat (`you`) | 6/10 | Launch investigation grounds U in real local state; act-first system prompts | 1.5s of deliberate fake latency every launch (`chat.ts:1197,1281`); streaming dumps raw ```json protocol blocks to screen (`chat.ts:163-171, 2718-2720`); bare "yes" hijacks chat into the project-bootstrap tool loop (`chat.ts:1401-1415`); **fake green success** "[saved private project]" with no API call (`chat.ts:2643-2645`); portrait render does up to 3 network fetches before falling back to the on-disk cache (`ascii.ts:350-369`) |
| Stacks | 4/10 | inspect/doctor/smoke/route all work | No `stack install` exists — "installable YouStacks" has no install verb (`stack.ts:25-39`); no-manifest error dead-ends |

### 1.3 Agent journey (MCP / machine surfaces)

| Step | Score | What works | What breaks |
|---|---|---|---|
| Discovery | 6/10 | `.well-known/mcp.json`, llms.txt, generated drift-checked docs | **Trust gap:** hosted MCP ships exactly 5 tools (`convex/http.ts:2788-2856`) while every doc surface advertises 24 (`src/generated/docs-reference.ts:28`, `public/llms.txt:18,43-44`) — the 24 exist only in the local stdio server. Published JSON-RPC example calls `get_identity` without the required `username` arg, so it fails against the endpoint it documents (`public/llms-full.txt:133-145` vs `convex/http.ts:2861-2864`) |
| Read identity | 8.5/10 | ETag/Link passthrough, vendor media type, JSON-LD, scoped context links with TTL/304 | Protocol pinned to 2024-11-05 (`convex/http.ts:2709`); no auth metadata in discovery |
| Get smarter about the user | 4/10 | Brief has progressive disclosure (whoami → brief → full) | `includeMemories` defaults false (`cli/src/mcp/server.ts:1734`) and the **markdown brief renders only the memory COUNT, never content** (`server.ts:974-984`) — agents on the default path literally cannot read the brain |

---

## 2. Friction Points — Prioritized Fix List

P0 = trust-breaking or funnel-breaking. All P0s are Small/Medium effort.

| # | Fix | Sev | Effort | Where |
|---|---|---|---|---|
| 1 | Strip `@` from 3 CLI celebration URLs AND normalize leading `@`/`%40` in the `[username]` route with a redirect | High | S | `status.ts:256,365`, `whoami.ts:123`, `src/app/(app)/[username]/page.tsx` |
| 2 | Remove bare `no/nah/nope/ready/yes/go` from global phrase lists; gate done-detection on the agent's last turn being a wrap-up offer (already detected at `onboarding.ts:1369-1383`); gate "start there" on the offer having been made | High | S | `onboarding.ts:272-293,442-445`, `chat.ts:1401-1415` |
| 3 | Fix the fake "[saved private project]" — implement fetch+append via `updatePrivateContext` or print an honest "not supported from CLI yet" | High | S | `chat.ts:2643-2645` |
| 4 | Gate /initialize redirect on an onboarding-complete marker (bundle exists / `onboardedAt`), not bare username; have /shell detect an empty brain as fallback | High | M | `initialize-content.tsx:143-147` |
| 5 | Default `panelOpen=true` (profile pane) + persist last state in localStorage; align skeleton with the real default | High | S | `dashboard-content.tsx:115,193,201` |
| 6 | Buffer-and-filter streamed tokens: hold once a ``` fence opens, flush only non-JSON. Apply to CLI chat, onboarding first turn, and web `useYouAgent` | High | M | `chat.ts:163-171`, `onboarding.ts:1127-1132` |
| 7 | Render memory content (category + one-line content) in the markdown agent brief; flip `includeMemories` default to true (8-item cap already bounds size) | High | S | `cli/src/mcp/server.ts:974-984,1734` |
| 8 | Split docs counts by transport (hostedTools vs localTools); lift whoami + get_agent_brief to the hosted MCP endpoint; fix the JSON-RPC example and replay all documented examples in `llms:smoke` CI | High | M | `docs-reference.ts:27-29`, `convex/http.ts:2788-2854`, `scripts/generate-llms-docs.mjs:314-326` |
| 9 | Delete fixed delays (`delay(600)`, `delay(900)`, skill-install sleeps); cap any minimum-display at ~250ms. The codebase already rejected this pattern at `onboarding.ts:1476-1478` | Med | S | `chat.ts:1197,1281`, `skill.ts:192-377` |
| 10 | Device-flow login: CLI requests short-lived code, opens `/cli-auth?code=X`, polls with BrailleSpinner ("waiting for the browser handshake"), writes key itself. Until then make Enter default to email-code | High | L | `login.ts:129-158` |
| 11 | One interactive magic moment on homepage: "type your GitHub/X handle → watch your portrait render" using the existing `AsciiPortraitGenerator`; funnel into /create with handle pre-filled. Archive dead landing components | High | M | `src/app/(marketing)/page.tsx`, `src/components/landing/` |
| 12 | Pane taxonomy MECE pass: top-level "activity" = agent access log; rename analytics group; align group keys with labels | Med | S | `dashboard-content.tsx:53-67` |
| 13 | Replace profile iframe with `ProfileContent` rendered directly with a `preview` prop sharing the page's Convex subscription — agent edits become visibly live | Med | M | `dashboard-content.tsx:425-431` |
| 14 | Local-first portrait: render cached `portrait.json` instantly, refresh in background, persist for next launch | Med | M | `ascii.ts:350-369`, `chat.ts:1316` |
| 15 | Sign-up correction: support `back` and `/email new@addr` line commands; verify-failure offers `> resend` / `> change email` | Med | S | `sign-up/[[...sign-up]]/page.tsx:79-90,206-214` |
| 16 | Make `/help` + `cmd+k` hint spans tappable buttons (mobile palette entry point) | Med | S | `TerminalInput.tsx:124-127`, `TerminalShell.tsx:43-52` |
| 17 | Onboarding turns 2+ use the same stream-with-fallback helper as chat (after fix #6) | Med | S | `onboarding.ts:1319-1341` |
| 18 | Extend portrait source chain to LinkedIn unavatar + website og:image; retry portrait after research yields `profileImageUrl`, before `finishBundle` | Med | M | `onboarding.ts:1662-1665`, `ascii.ts:390-435` |
| 19 | `youmd stack install <slug>` (registry fetch → manifest+files → auto-doctor → offer link); no-manifest error suggests it | Med | L | `stack.ts:25-39`, model on `skill.ts:221-289` |
| 20 | Renderer honesty: strip ANSI before padEnd (helper exists at `render.ts:154`); `BrailleSpinner.update()` preserves startTime by default | Low | S | `render.ts:214,242,368-371` |
| 21 | `--radius: 2px` (one line fixes cli-pill/CTAs site-wide); migrate 178 inline `borderRadius: "2px"` styles to a utility incrementally | Med | S | `globals.css:55` |
| 22 | Lowercase CTAs ("create your you.md", "read docs") or document the exception | Low | S | `Hero.tsx:68,71`, `Navbar.tsx:143`, `CTAFooter.tsx:58,61` |
| 23 | Sweep `font-medium/semibold` from headings/buttons per the opacity-not-weight rule (19 instances) | Low | S | `Button.tsx:29`, `profile-content.tsx:313,445` |
| 24 | Boot sequence: tie checkmarks to real events (schema = Convex query resolved, claim = createUser returned); overlap real work with theater; "press enter to skip" during boot | Low | S | `initialize-content.tsx:86-97,166-233` |

---

## 3. Visual / Design Recommendations

### 3.1 Dashboard default state (fix #5 + #12)

Restore the signature split as the first impression — the brain is the product's body.

```
+--[ o o o ]------------------+----------------------------------------------+
|  terminal (35%)             |  profile · files · stacks · activity  [<]    |
|                             |                                              |
|  > U: morning houston.      |   @houston                        synced 2d  |
|    your github synced 2d    |   ##############    founder, you.md          |
|    ago. 3 new repos seen.   |   ##  ascii    #    miami                    |
|    want me to fold them in? |   ##  portrait #                             |
|                             |   ##############    [ live profile preview ] |
|  > _                        |                                              |
+--[ @houston | pro | v0.6 ]--+--[ synced 2d ago | published | 4 agents ]----+
```

- `panelOpen=true` default, persisted thereafter.
- Status bar gains a **freshness segment**: `synced 12d ago` in dim orange when stale (sources older than N days), plus a U-initiated nudge on session restore. The phrase library already teases this ("recalculating your freshness score", `agent-utils.ts:89,92`) — make it real. This is the smallest surface that makes the self-improving loop *felt* daily.
- Taxonomy after the MECE pass: `profile | files | stacks | activity | analytics` — one name, one meaning.

### 3.2 Homepage magic moment (fix #11)

One section between hero and CTA footer:

```
   -- see yourself in code --

   > github or x handle: _

   [types "torvalds"]            ############
                                 ##  ascii  ##   rendering your face
   braille spinner:              ##  emerges ##  in code...
   "computing your main          ##  live    ##
    character energy..."         ############

   [ this is you. claim it -> /create?handle=torvalds ]
```

Personal, zero-cost to try, funnels straight into /create. Beats a static profile gallery or terminal replay because the visitor's own face is the proof of "alive".

### 3.3 Terminal-native correction copy (fix #15)

```
> email: houstn@bamf.ai
  sent a code to houstn@bamf.ai. didn't get it?
  > resend        send the code again
  > back          change your email
```

Line commands over edit buttons — re-running a command is what terminals do.

### 3.4 Honest spinners (fix #9, #24)

Personality rides on real work, not padded sleeps. The standard:

- spinner duration == actual operation duration; minimum display cap 250ms
- elapsed timer never resets on label rotation (`render.ts:368-371`)
- boot checkmarks fire on real events: `✓ brain schema loaded` when the Convex query resolves, `✓ username claimed` when `createUser` returns

### 3.5 Voice + token consistency (fixes #21-23)

- `--radius: 2px` everywhere; ban `rounded-md`/`rounded-2xl` (CopyButton, GradientText offenders).
- Lowercase the two CTAs — they are the only sentence-case strings on the page.
- Hierarchy via opacity (0.3-0.9), not weight; JetBrains Mono regular reads more terminal anyway.

---

## 4. What Is Already Excellent (do not regress)

- Zero `<form>` elements and zero emoji across src/app + src/components — the hardest rules, flawlessly enforced.
- ThinkingIndicator: braille frames, 18-shade orange rotation, lightsweep, elapsed timer, ~80 personality phrases (`ThinkingIndicator.tsx`, `agent-utils.ts:40-114`, `render.ts:311-394`).
- Public profile agent-brain panel above the fold with explicit retrieval order — no competitor pattern (`profile-content.tsx:559-631`).
- System prompts with banned-phrase lists enforcing act-first voice (`onboarding.ts:307-416`, `chat.ts:412-526`).
- Accessibility beyond the aesthetic's usual cost: reduced-motion, 44px tap targets, iOS zoom prevention, aria-pressed (`globals.css:354-497`).
- ETag/Link passthrough, vendor content negotiation, JSON-LD, scoped context links with TTL/max-uses/304 (`convex/http.ts:60-360`).
