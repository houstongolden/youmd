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

## Definition Of Success

This effort is complete only when the local/global inventory is a You.md product
system, not a one-off report.

Success means:

1. The initial `curl -fsSL https://you.md/install.sh | bash` setup path installs
   the current You.md CLI, authenticates or resumes the trusted user, pulls the
   shared skill/stack layer, runs the agent stack inventory, and materializes the
   expected Claude/Codex/Cursor/Pi host mirrors without Houston manually
   discovering missing roots.
2. Fresh-machine setup through the You.md prompt/CLI automatically restores and
   verifies Houston-owned shared skills, SciStack/HubStack/AstroStack references,
   GStack references, YouStacks, product stack catalogs, project-context signals,
   agent config, prompt/log metadata, API/MCP readiness, and safe Secret Vault
   metadata.
3. Convex stores durable, owner-gated machine inventory snapshots, drift
   summaries, sync events, DRY review queues, and repair recommendations without
   storing raw secrets, private key material, decrypted env values, or private
   skill bodies beyond explicit user-controlled sharing rules.
4. The `username-you-md` GitHub repo stores portable markdown/JSON snapshots for
   the user's agent stack state, including per-machine summaries, skill catalog
   summaries, DRY audit notes, and project-context topology.
5. You.md API and MCP expose the same safe machine/skill/stack topology to
   authorized agents so Claude Code, Codex, Cursor, Pi, and the You Agent can
   inspect drift, route to canonical owners, and repair sync gaps without reading
   raw secrets.
6. The You.md web app and future Tauri app render the full audit/diagram/report
   as a live Skill Mesh surface with ownership, provenance, DRY, catalog gap,
   sync health, machine drift, and project-context views.
7. The resident sync/daemon path keeps skills, stacks, context metadata, and
   machine inventory snapshots reconciled in near real time across trusted
   machines and agent runtimes.
8. The proof gate passes on another Mac: run the curl setup command, run or
   observe automatic inventory, confirm all intended canonical/shared skills and
   stack catalogs are installed or referenced, verify the Mac appears in Convex
   and the GitHub snapshot, compare inventories with zero unexpected drift, and
   make a small shared skill/catalog change on one machine that propagates to the
   other without exposing secrets.

## Near-Term Build Plan

1. Add `youmd skill inventory` as a CLI command that wraps the shared script.
   **Done locally; pending npm publish on `youmd@0.8.10`.**
2. Add `youmd skill inventory diff --left A.json --right B.json`.
   **Done locally; pending npm publish on `youmd@0.8.10`.**
3. Bundle the scanner into the CLI package and run local inventory during curl
   install and fresh-machine bootstrap.
   **Done locally; pending npm publish/deploy.**
4. Add Convex `agentStackInventories` summaries keyed by user + machine + root.
5. Add web/Tauri `Skill Mesh` view with ownership, DRY, catalog gap, and machine
   drift tabs.
6. Add You Agent actions:
   - register canonical shared skill in You.md catalog
   - mark external reference
   - create alias/routing note
   - propose merge
   - repair broken mirror
7. Extend project-context hydration so project-scoped `AGENTS.md`, `CLAUDE.md`,
   `.youmd-project`, `youstack.json`, and `project-context/` docs appear in the
   same topology.
