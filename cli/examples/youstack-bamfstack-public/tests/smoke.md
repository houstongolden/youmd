# Smoke Test

Run:

```bash
youmd stack doctor --path cli/examples/youstack-bamfstack-public
youmd stack smoke --path cli/examples/youstack-bamfstack-public
youmd stack route --path cli/examples/youstack-bamfstack-public "inspect creator context"
youmd stack route --path cli/examples/youstack-bamfstack-public "run protected bamf action"
```

Expected:

- Manifest validates.
- Required files exist.
- Claude Code, Codex, and Cursor adapters are declared.
- Context requests route to `creator-context`.
- Protected actions route to `protected-bamf-action`.
- No brain data, connected tools, remote repos, or BAMF content are mutated.
