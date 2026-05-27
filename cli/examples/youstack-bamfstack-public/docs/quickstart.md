# BAMFStack Public Lighthouse Quickstart

Install the You.md runtime:

```bash
curl -fsSL https://you.md/install.sh | bash
```

Inspect this stack:

```bash
youmd stack inspect --path cli/examples/youstack-bamfstack-public
youmd stack smoke --path cli/examples/youstack-bamfstack-public
youmd stack capabilities --path cli/examples/youstack-bamfstack-public
youmd stack route --path cli/examples/youstack-bamfstack-public "draft a creator post from research"
```

Link it into a host agent:

```bash
youmd stack link --path cli/examples/youstack-bamfstack-public --hosts codex,claude,cursor --target . --dry-run
```

This stack is public-open as an example, but it stays protected by design:

- No API keys in files.
- No private creator data.
- No proprietary prompts.
- No private memories.
- Mutations require authenticated API/MCP and exact user approval.
- Self-updates may refresh local public stack files only.

Why it matters: BAMFStack proves a YouStack can be useful as local/static files first while still knowing how to reach a real product backend safely when credentials and approvals exist.
