# 2026-06-16 — Connector Favicons + Local Agent Verification

Raw prompt captured for You.md product context.

> please use real google favicon api to get the actual app icons for all the app connectors and show some of the most popular ones closer to the top like Slack,notion, gmail, google calendar, linear, github (checked), CRMs etc... etc from there ... - it should someohw also verify when the agent confirms it has connected locally via a Claude code terminal session or via codex session etc id like to see that as a first-order top suggested way to connect an app even if it is via curl command + api/mcp etc and connecting to your own api etc that is first order priorty for sure

Follow-up prompt:

> continue testing ensure the goal can work for all of this

Implementation note:

- Keep You.md-owned/private API/MCP/custom connector surfaces pinned first.
- Treat local agent runtime install plus API/MCP grant verification as the recommended first connector.
- Use real Google favicon API URLs from app domains for app icons.
- Keep popular tools visible near the top of the catalog after the pinned You.md layer.
