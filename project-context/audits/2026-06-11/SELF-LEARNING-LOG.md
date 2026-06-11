# SELF-LEARNING-LOG.md

**Mission:** Vision/GTM audit of You.md (2026-06-11)
**Purpose:** What the model learned about the product during this analysis, and one concrete improvement to its own reasoning for the next mission.

---

## What I learned about the product

1. **The best positioning asset was already written and is hidden.** The `agent.md / soul.md / you.md` handshake triad (`README.md:21-27`) is stronger than anything on the live homepage. Lesson: audit the README and deep docs for buried language *before* drafting new copy — the founder's earliest framing often contains the sharpest IP.

2. **The product is further ahead on agent-native plumbing than on narrative.** Live llms.txt, OpenAPI inventory, MCP discovery, a versioned schema (`you-md/v1`), and stack capability routing all exist and are generated from shipped code (verified live, hash-stamped, reference-intelligence dated 2026-06-09). The gap is not capability; it is that the homepage sells convenience while the plumbing supports a protocol claim.

3. **The brain↔stack binding is a freshness moat, not a clone-proof one.** Brain-aware skills (`youmd skill use` renders identity — `cli/src/commands/skill.ts:595`; `skill sync` re-renders against live identity — `cli/src/lib/sync.ts:63`) mean a copied stack keeps working but freezes at copy time. The honest claim is "stale on copy, current on sync." Stated in `README.md:301` but absent from the homepage.

4. **The promise/reality gap concentrates in trust surfaces.** Everything unshipped that matters to positioning is a *trust* feature: vault encryption (`CURRENT_STATE.md:188`), per-stack grant tokens (`CURRENT_STATE.md:115`), Pro billing (`CURRENT_STATE.md:189`). For an identity product, trust-feature gaps are positioning liabilities, not roadmap items — this directly moved the grade from B+ to B.

5. **Single-player-first is the correct strategy and the docs already encode it.** The CLI brain is useful with zero network effects, which is the only honest mitigation for the two-sided protocol cold start. The vision work should layer the protocol *claim* on top of single-player *value*, never replace it.

## What the self-critique pass caught

- An unsupportable "hours/day lost" pain quantification → replaced with the output-variance argument (cold = generic, stale = confidently wrong), which is defensible from product mechanics alone.
- An enterprise reframe that was sequencing-wrong for 2026 → moved to deferred persona P3.
- "OS for personal AI identity" framing (from the mission prompt itself) → rejected with reasons; the prompt's own metaphor failed the stress-test, which is the point of the stress-test.
- "Copied stacks are inert without the brain" → refuted by reading `cli/src/lib/skill-renderer.ts:300` (plain `{{var}}` substitution; rendered copies still run). Downgraded to the freshness claim.
- "MCP real-time sync not shipped" → traced to a stale March section of CURRENT_STATE.md; June entries (`CURRENT_STATE.md:37,58-61`) show MCP live. Lesson: within a single status doc, check section dates — promise-vs-shipped tables must be built from the *newest* dated section only.
- A wrong pricing citation (`PRD.md:401-413` — the file is 320 lines) caught because the critique pass re-verifies every file:line claim. Lesson: never carry citations forward from a research summary without spot-checking the ones that drive conclusions.

## One concrete reasoning improvement for the next mission

**Diff promise against production before grading anything.** The single highest-leverage move this mission was pulling `CURRENT_STATE.md` (shipped vs broken) *early* — it changed the positioning grade, generated existential risk X2, and produced the "honesty ledger" constraint on copy. Next mission protocol: step 1 is always to build a two-column promise-vs-shipped table from marketing surfaces and the current-state doc, and let every subsequent judgment cite it. Reasoning audits that start from the vision documents alone systematically over-grade.
