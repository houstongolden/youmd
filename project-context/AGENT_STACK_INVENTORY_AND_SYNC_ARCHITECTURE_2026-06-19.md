# Agent Stack Inventory and Sync Architecture

Date: 2026-06-19

## Why This Exists

`youmd skill list` is currently a You.md catalog view, not a full local/global
agent stack inventory. Houston's actual machine stack includes canonical shared
skills, GStack, SciStack/HubStack/AstroStack, Codex plugin bundles, host mirrors,
You.md catalog/cache entries, project-context directories, prompt logs, memory
files, and agent-specific config.

The new `agent-stack-inventory` shared skill packages the local scanner/report
so every trusted Mac can produce the same secret-safe topology snapshot.

## Product Shape

This should become a first-class You.md surface, then a strong Tauri app surface:

1. Local scanner produces secret-safe JSON and HTML.
2. Resident daemon syncs compact metadata to Convex.
3. The user's `username-you-md` repo stores portable markdown/JSON snapshots.
4. The web/Tauri app renders a live topology with cross-machine diffing.
5. You Agent proposes safe catalog changes, aliases, merges, and sync repairs.

## Data Classes

### Safe To Sync To Convex

- skill names
- paths with `~` home redaction
- symlink target paths
- owner class and sync policy
- short git SHAs, branch, dirty flag
- counts by root/type/source
- catalog entries and missing catalog names
- project-context signal paths
- prompt/log counts
- machine host id/name and timestamp
- DRY audit risk rows without skill body content

### Repo Snapshot Candidates

- latest `agent-stack-inventory.md`
- compact `agent-stack-inventory.json`
- per-machine summary under `machines/<host>/agent-stack.md`
- skill catalog markdown under `skills/_inventory.md`
- governance notes under `skills/_dry-audit.md`

### Keep Local Only

- full skill bodies unless explicitly public/shared
- raw prompt/session transcripts
- `.env.local`, private keys, vault material, API tokens
- decrypted env-vault archive contents
- raw private identity notes beyond existing You.md permissions

## Ownership Classes

- `houston-owned-shared`: canonical shared non-science ops skill in `.agent-shared`
- `houston-owned-science`: SciStack/HubStack/AstroStack canonical skill
- `youmd-catalog-cache`: installed or cached You.md skill
- `gstack-managed-reference`: GStack reference skill
- `plugin-bundled`: OpenAI/Codex/plugin-provided skill bundle
- `public-marketplace-helper`: skills.sh/clawhub/public marketplace reference
- `host-local-or-mirror`: agent host exposure path that needs owner resolution
- `agent-host-local`: local `.agents` skill with unclear broader ownership
- `external-science-extension`: opt-in upstream scientific skill extension
- `unknown`: needs explicit catalog metadata

## DRY Audit Semantics

Same-realpath mirrors are healthy exposure unless the symlink is broken or points
to a stale target. Same-name/different-realpath rows are review queues. They
should become one of:

- alias to canonical owner
- external reference entry
- intentional fork with provenance
- protected owned skill
- merge proposal with explicit before/after proof

Owned skills are never auto-deleted. Public/plugin/reference skills should not
override Houston-owned skills, but they can inform consolidation, docs, aliases,
or upstream-sync notes.

## Near-Term Build Plan

1. Add `youmd skill inventory` as a CLI command that wraps the shared script.
2. Add `youmd skill inventory diff --left A.json --right B.json`.
3. Add Convex `agentStackInventories` summaries keyed by user + machine + root.
4. Add web/Tauri `Skill Mesh` view with ownership, DRY, catalog gap, and machine
   drift tabs.
5. Add You Agent actions:
   - register canonical shared skill in You.md catalog
   - mark external reference
   - create alias/routing note
   - propose merge
   - repair broken mirror
6. Extend project-context hydration so project-scoped `AGENTS.md`, `CLAUDE.md`,
   `.youmd-project`, `youstack.json`, and `project-context/` docs appear in the
   same topology.
