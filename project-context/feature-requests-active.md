# Active Feature Requests — Tracked Until Verified

## From Houston 2026-03-26

### 1. BrailleSpinner color rotation + lightsweep effect
**Status:** NOT DONE
**Request:** The braille spinner animation should rotate through shades of orange (like Claude Code rotates colors). Also add a lightsweep effect on the text itself — a smooth brightness sweep across the characters, not a background highlight.
**Claude Code reference:** Their spinner uses subtle color rotation + text lightsweep.

### 2. Profile images + ASCII portraits synced from CLI to web API
**Status:** NOT VERIFIED
**Request:** Ensure the CLI properly passes profile images and ASCII portrait data to the web API when pushing/syncing. The portraits generated locally should be saved to the profile's storage on the server.

### 3. Text formatting improvements (DONE in 0.4.8)
**Status:** DONE — word-wrap, paragraph spacing, terminal-width-aware
**Request:** Fix jumbled/garbled text, proper word wrapping, left alignment, line breaks between paragraphs.

### 4. Track all requests in feature-requests.md
**Status:** DONE (this file)
**Request:** Break down ALL messages into plans, don't ignore parts, track progress of each request until verified.

### 5. Update CLAUDE.md with request tracking instructions
**Status:** TODO
**Request:** Add to CLAUDE.md that every user message should be broken down into individual requests, tracked, and not ignored.

---

## Tracking Rules
- Every request gets its own entry with status
- Status: TODO → IN PROGRESS → DONE → VERIFIED BY USER
- Don't mark DONE until actually deployed and tested
- Don't ignore parts of messages — break them ALL down
