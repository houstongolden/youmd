# OKF Integration — Open Knowledge Format for You.md

Last Updated: 2026-06-13
Branch: `claude/okf-youmd-integration-7bxxt1`

## What OKF Is

OKF (Open Knowledge Format, `okf/v0.1`) is Google's vendor-neutral standard for
representing knowledge as a plain directory of UTF-8 markdown files. Each concept
is one `.md` file with a YAML frontmatter block; the only required field is
`type`. Two filenames are reserved: `index.md` (a directory listing for
progressive disclosure, no frontmatter) and `log.md` (date-grouped change
history, newest first). A concept's ID is its file path with `.md` removed.
There is no schema registry, no central authority, no required SDK — if you can
`cat` a file you can read it; if you can `git clone` a repo you can ship it.

Spec: https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md

## Why It Matters For You.md

You.md bundles are *already* directories of markdown (`profile/`,
`preferences/`, `voice/`, `directives/`, `skills/`). OKF is the same shape for a
different domain. Adopting it as the wire format means:

- **Distribution:** a You.md identity or YouStack is a valid OKF bundle any
  OKF-aware agent or tool reads natively — no You.md SDK required.
- **Portability for the sync vision:** identity, skills, and stacks travel
  between machines and agents as plain OKF, lock-in-free, riding the existing
  `youmd sync` engine.
- **Positioning:** "OKF for identity" — the personal-context node in the open
  knowledge graph.

You.md competes *above* the format (hosting, verification, ingestion pipeline,
the You Agent, MCP serving, identity specialization), not on the format itself.

## What This Branch Added

All under `cli/`:

| File | Purpose |
|---|---|
| `src/lib/okf.ts` | Pure OKF core: serialize/parse concept files, conformance validation, `index.md` + `log.md` builders. No fs, no You.md specifics. |
| `src/lib/okf-bundle.ts` | Identity bundle ↔ OKF. Lossless, round-trippable (each section keeps its title + body, gains `type`/`description`/`timestamp` + a `youmd_kind` field that routes it home on import). |
| `src/lib/okf-stack.ts` | YouStack → OKF. Renders a stack (manifest + skills/workflows/docs/tests/prompts) as a conformant OKF bundle, carrying `youstack.json` alongside so it stays installable. |
| `src/commands/okf.ts` | `youmd okf export \| import \| validate`. |
| `src/__tests__/okf*.test.ts` | 30 tests: serialize/parse round-trips, the `type` requirement, validation rules, reserved-file formats, identity round-trip against the real `examples/houston` bundle, stack export against `examples/youstack-personal`. |

CLI surface:

```bash
# Export your identity bundle (+ installed skills) as a conformant OKF bundle
youmd okf export                 # -> ./okf/
youmd okf export --out ~/brain   # custom output dir
youmd okf export --no-skills     # identity only
youmd export --okf               # shortcut for `youmd okf export`

# Export a YouStack as OKF (shareable "Gstack"); youstack.json carried alongside
youmd okf export --stack                         # auto-discovers stacks/<slug>/
youmd okf export --stack path/to/stack --out dist-okf

# Import an OKF bundle back into You.md section files
youmd okf import ./okf --out ~/.youmd-imported   # then `youmd build` + `youmd push`

# Validate any directory for OKF conformance
youmd okf validate ./okf
youmd okf export --json          # machine-readable output (all subcommands)
```

Conformance: an exported identity bundle and an exported stack both pass
`youmd okf validate` with zero errors. The root `index.md` declares
`okf_version: "0.1"`; every concept carries a non-empty `type`.

## Provenance (Familiar-second-brain convention)

Each concept can carry optional provenance frontmatter so you and your agents can
audit the brain — who wrote a concept, how sure they were, and what it derives
from:

- `last_updated_by` — `"houston"`, `"agent"`, … On export, identity sections are
  stamped with `--author` (defaults to your logged-in username); installed skills
  are stamped `agent` (they're generated/interpolated, not hand-authored) — the
  human-vs-agent distinction Familiar is built around.
- `confidence` — `low | medium | high` (only stamped when you pass `--confidence`;
  never fabricated). Malformed values are a validation *warning*, not an error.
- `linked_sources` — the `about` concept is auto-linked to the real sources the
  bundle was compiled from (`you.json` `meta.sources_used`), never fabricated.

These are OKF-legal custom fields (the spec requires consumers to preserve unknown
keys), preserved through export → import → re-export round-trips. Any existing
provenance in a section's own frontmatter is preserved and never overwritten.

```bash
youmd okf export --author houston --confidence high
youmd okf export --stack --author houston
```

## How OKF Rides The Existing Sync Engine

Nothing about `youmd push/pull/sync` changed. OKF is a portable *view/exchange*
format that sits beside the existing flow:

- `youmd sync` (and `youmd sync --watch` for background auto-sync) still moves
  identity between a machine and the server via the 3-way merge in
  `cli/src/lib/merge.ts`.
- `youmd okf export` produces the lock-in-free, OKF-conformant snapshot any
  agent/tool/machine can consume; `youmd okf import` brings an OKF bundle back
  into `~/.youmd/` section files so `youmd build` + `youmd push` can sync it.

## Cross-Machine End-To-End Test (MacBook Air + Mac mini)

This proves the vision: edit on one machine, see it on the other, and confirm
the portable OKF artifact is conformant on both.

Prereq on both Macs: `curl -fsSL https://you.md/install.sh | bash` (or
`npm i -g youmd`), then `youmd login` as `@houstongolden`.

### A. Identity + skills sync (server path — already works)

1. **Mac mini:** `youmd pull` (hydrate `~/.youmd/`), then `youmd skill list`.
2. **MacBook Air:** edit `~/.youmd/profile/now.md` (or `youmd chat`), then
   `youmd push`.
3. **Mac mini:** `youmd pull` → confirm the `now.md` change landed.
4. **Background:** run `youmd sync --watch` on both; edit a file on one and
   confirm it auto-pushes, then `youmd pull` on the other.

### B. Portable OKF snapshot (new — prove lock-in-free portability)

5. **MacBook Air:** `youmd okf export --out ~/you-okf` → check it printed
   "conformant — 0 errors" and that `~/you-okf/index.md` + `profile/*.md` +
   `skills/*.md` exist with `type:` frontmatter.
6. Move `~/you-okf` to the Mac mini (AirDrop / git / scp). On the **Mac mini:**
   `youmd okf validate ~/you-okf` → expect "conformant OKF bundle (okf/0.1)".
   Open any concept file — it reads natively, no You.md needed.
7. **Mac mini:** `youmd okf import ~/you-okf --out ~/.youmd-from-okf`, inspect
   the rebuilt `profile/*.md`, then (optionally) point a build at it.

### C. Publishable YouStack as OKF (the "Gstack" story)

8. On either Mac, from a repo with `stacks/<slug>/youstack.json` (or use the
   bundled `cli/examples/youstack-personal`):
   `youmd okf export --stack --out ~/mystack-okf`.
9. `youmd okf validate ~/mystack-okf` → conformant. It contains `index.md`,
   `youstack.md` (the manifest concept), each skill/workflow/doc as a typed
   concept, `log.md`, and `youstack.json` (still installable). Share that
   directory publicly — any OKF consumer can read it.

### Success criteria

- B/C: both `okf export` runs print "conformant — 0 errors" and `okf validate`
  passes on the *other* machine.
- A: an edit on one Mac appears on the other after sync.
- Any exported concept file opens and reads as plain markdown with a `type`.

## Publishing The CLI (owner-only, when ready)

The new command ships in the `youmd` npm package. Per the operating manual, bump
the version before publishing (this branch intentionally did **not** bump, to
keep the agent-docs version guardrail green until you choose to release):

```bash
cd cli
npm version minor --no-git-tag-version   # new feature command -> minor
npm run build
# update the `youmd X.Y.Z` markers in root AGENTS.md + CLAUDE.md to match,
# then: npm run agent-docs:ci   (must stay green)
npm publish --otp=CODE
```

## Status

- Code complete on `claude/okf-youmd-integration-7bxxt1`.
- `npm --prefix cli run build` passes; OKF test suite green (30 tests); full CLI
  suite green except pre-existing live-network `integration.test.ts` cases that
  require reaching production from the sandbox.
- **Not yet verified by Houston** on the two Macs end-to-end (steps above).
- Publishing + the mandatory version bump are deferred to the owner-only release
  step.
- Generated root docs were intentionally NOT regenerated here: the new `okf`
  command bumps the CLI command count in `src/generated/docs-reference.ts`
  (27 → 28), but running `npm run docs:generate` in this sandbox also wrongly
  collapsed the MCP tool list (14 → 6, an environment artifact). Run
  `npm run docs:generate && npm run docs:check` in a full environment to refresh
  the command count cleanly before/at merge.
