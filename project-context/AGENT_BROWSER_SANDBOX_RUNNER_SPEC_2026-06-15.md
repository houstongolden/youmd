# Agent-Browser Sandbox Runner Spec

Date: 2026-06-15

Scope: You.md-native source refresh and skill-learning browser tasks. This is not h.computer or Creator.new infrastructure.

## Why This Exists

`agent-browser` sources are for dynamic identity/context sources that native fetch and Firecrawl cannot handle cleanly:

- authenticated dashboards the owner explicitly connects later
- pages that require clicks, waits, scrolling, or screenshots
- repeatable UI workflows that can become YouStack skills
- source refreshes where the action transcript matters as provenance

The provider currently fails closed in code. It must not run arbitrary browser automation until this boundary exists.

## Required Boundary

Every browser run must be an isolated job with:

- a single source id, user id, provider, and declared purpose
- a hard timeout
- a max action count
- a max screenshot/artifact count
- no ambient owner secrets
- explicit connected-app/source grant if credentials are needed
- a source run-policy approval window
- per-user/provider rate limit reservation
- compact transcript saved to source metadata and agent activity
- raw output saved through the immutable raw-source version ledger

## Job Contract

```json
{
  "sourceId": "sources id",
  "userId": "users id",
  "url": "https://example.com",
  "purpose": "refresh_identity_source",
  "timeoutMs": 120000,
  "maxActions": 40,
  "maxArtifacts": 5,
  "credentialMode": "none | scoped_connected_app",
  "allowedHosts": ["example.com"],
  "outputFormats": ["markdown", "text", "screenshot-summary"]
}
```

## Provider Options

Allowed runner targets:

- local worker for development only
- Vercel Sandbox or equivalent isolated compute
- hosted browser provider with per-run isolation
- Browser Use/agent-browser wrapper only inside the above sandbox

Disallowed:

- long-lived browser sessions with owner cookies by default
- using the app server process as the browser runtime
- unbounded crawling
- saving raw screenshots or transcripts that contain secrets without a scoped/private source visibility

## Output Contract

Successful runs normalize to:

- `rawPayload`: JSON containing provider, url, transcript, extracted text, artifact refs, and timing
- `_rawText`: compact text/markdown for the existing extraction stage
- `contentHash`: hash of substantive text/transcript output
- `lastRunDecision`: provider, estimate, approval, and rate-limit decision

Failures normalize to:

- source `status: failed`
- `failureCount` increment
- redacted `errorMessage`
- `metadata.lastRunDecision`
- optional `metadata.lastBrowserTranscript` when safe and compact

## Skill-Learning Hook

When a browser task repeats successfully, the runner should emit a skill-learning candidate:

- page/task name
- inputs required
- action transcript
- selectors or semantic steps
- fallback API/tool list
- failure modes
- suggested `SKILL.md` draft path inside the relevant YouStack

This turns source refresh from a crawler feature into the loop that teaches YouStacks how to operate tools.

## Implementation Order

1. Add a sandbox job table and internal enqueue mutation.
2. Add a worker action that can run one job with strict timeout/action/artifact caps.
3. Store transcript/output via immutable source versioning.
4. Add owner-visible job status in the source details panel.
5. Add skill-learning candidate emission for successful repeated tasks.
