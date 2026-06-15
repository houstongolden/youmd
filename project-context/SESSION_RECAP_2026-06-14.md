# Session Recap — 2026-06-14 → 06-15

Handoff doc for the next agent (or human). Covers the goal, everything shipped,
how the new systems work, current state, and what remains. Pairs with
`CHANGELOG.md` (chronological) and `CURRENT_STATE.md` (deployment status).

---

## The Goal

This session started as "continue executing the 5-prompt audit/sweep/vision
backlog," then expanded — driven by Houston's real need — into **making You.md
the layer that syncs his whole agentic stack (skills, stacks, projects,
secrets, identity) across machines**, because he just bought two new Macs
(MacBook Air + Mac mini) and wants to prove the vision: edit a skill on one Mac,
it auto-updates on the others; agents and human collaborate with shared context
everywhere; everything auto-syncs in the background.

Concretely, the session delivered six things:
1. Closed the remaining audit backlog (L26, P7) — backlog now 100%.
2. GitHub OAuth free sign-up — wired, deployed, verified live.
3. Curl-first install — one command installs CLI + native skills + MCP.
4. A four-plane cross-machine sync system (identity, secrets, skills, stacks).
5. Productized all of it into the `youmd` CLI (`env`, `stack sync`, `machine setup`).
6. This recap + docs/homepage coverage of the new capabilities.

---

## 1. Audit backlog closure (now 100%)

The 2026-06-11 audit (`project-context/audits/2026-06-11/MASTER-BACKLOG.md`,
~123 items across V/P/U/L/T) had two open items; both are now closed:

- **L26 — server-orchestrated evolution.** The weekly maintainer cron already
  mined stack journals into `maintainerProposals` server-side but nothing
  surfaced them. Closed the loop to the human-approval boundary (where the T3
  safety contract says it must stop): owner-authed `GET /api/v1/me/maintainer/proposals`,
  `POST .../proposals/decision` (approve/reject, owner-isolated), and
  `GET/POST /api/v1/me/brain-consent` (revoke `journal_mine`/`consolidate`/
  `fleet_aggregate`). CLI: `youmd stack proposals [approve|reject <id>]`,
  `youmd stack consent [grant|revoke <scope>]`. 8 tests; live + verified on prod.
- **P7 — CLI npm publish.** Published `youmd@0.6.26`, then later `0.7.0`.

While shipping L26 I found and fixed **two latent CI failures from the OKF merge**
that were silently blocking ALL Convex deploys: (a) `convex deploy`'s tsc choked
on a `convex-test` inference limit in `mutations.test.ts` — excluded `*.test.ts`
from `convex/tsconfig.json` (tests run under vitest, never deploy); (b) a stale
`_generated/api.d.ts` missing `lib/sourceHashing` — regenerated. Also fixed the
Agent Docs CI by syncing `AGENTS.md`/`CLAUDE.md` version markers.

---

## 2. GitHub OAuth free sign-up (live)

- Verified the exact callback from code (`src/lib/github-oauth.ts`): **`https://you.md/api/auth/github/callback`** (apex; `next.config.ts` 308-redirects apex→www, and `redirect_uri` must match the registered apex callback — so `AUTH_APP_URL` stays unset and defaults to apex).
- Creds saved to gitignored `.env.local`; `GITHUB_OAUTH_CLIENT_ID/SECRET/SCOPES` set on Vercel production.
- Verified live: `/api/auth/github/start` redirects to `github.com/login/oauth/authorize` with the right client_id, redirect_uri, and `read:user user:email repo` scopes.
- **Open security item:** the client secret was pasted in chat — Houston should rotate it and update Vercel + `.env.local`.

---

## 3. Curl-first install (one command = everything)

- Homepage hero now leads with the **interactive copyable curl install** widget
  (`CliInstallTabs`, curl default) instead of a passive code block; create/docs
  demoted to secondary; microcopy clarifies it installs CLI + skills + MCP.
- `install.sh` (`src/app/install.sh/route.ts`) now **auto-configures MCP** for
  whichever of Claude Code / Codex / Cursor are present (was only suggested) —
  so one curl command makes you.md usable by local agents out of the box.

---

## 4. The four-plane cross-machine sync system

You.md now syncs a user's whole agentic setup across machines via four planes:

| Plane | What | Transport | CLI |
|---|---|---|---|
| Identity | profile, preferences, project-context, memory | Convex (`youmd sync`, has `--watch`) | `youmd sync` |
| Secrets | all `.env.local` files | encrypted env-vault (openssl aes-256-cbc + pbkdf2) | `youmd env backup` / `youmd env restore <vault>` |
| Skills | `~/.agent-shared` + 4 loose `~/.claude/skills` personal skills | private git repo `houstongolden/agent-shared` | `youmd stack sync` |
| Stacks | gstack, scistack, project repos | their own git remotes | (gstack=upstream-pull; scistack=opt-in) |

**Key architecture decisions:**
- `~/.claude/skills` is ~1GB and 71 symlinks — most of it is **gstack** (its own
  repo, tracks upstream `garrytan/gstack`, updates via `gstack-upgrade`) and
  **scistack symlinks** (science skills, own repo `Hubify-Projects/scistack`).
  So the sync transport is NOT one big git-init; it's a multi-repo syncer over
  the repos the user actually owns.
- Created a new private repo **`houstongolden/agent-shared`** (git-init'd
  `~/.agent-shared`) holding AGENTS.md, preferences.json, STACK-MAP.md,
  learnings/, plus `claude-skills/` (the 4 loose personal skills mirrored in).
- **scistack is opt-in** in the daemon (`SKILLSTACK_REPOS` env) because it holds
  the protected learning-loop IP — auto-committing WIP there on a timer is too
  aggressive for v1.
- Secrets deliberately do NOT auto-sync (carried as an encrypted vault, restored
  manually). openssl chosen over age/gpg because it ships on every Mac, so a
  vault always restores on a fresh machine.

**Background daemons** (launchd, every 300s, installed on this Mac):
`com.youmd.skillstack-sync` (runs `youmd stack sync`) and `com.youmd.identity-sync`
(runs `youmd sync`). Install/remove via `youmd stack daemon install|uninstall|status`.

**The fresh-Mac flow is one command each:**
```bash
curl -fsSL https://you.md/install.sh | bash   # CLI + skills + MCP
youmd machine setup                            # clone agent-shared + scistack, restore skills
youmd env restore <vault>                      # secrets (from an AirDropped vault)
youmd stack daemon install                     # background sync
youmd login                                     # identity
```
Make the vault first on the source machine: `youmd env backup` → AirDrop the
`.env-vault/*.tar.enc`.

**Toolkit location:** `cli/scripts/{env-vault,skillstack-sync}/` (moved into the
CLI package so they ship via npm). `.env-vault/` is gitignored.

---

## 5. CLI productization (v0.7.0 / 0.7.1)

New `youmd` commands, all wrapping the tested scripts via stdio passthrough:
- `youmd env backup [--root --out]` / `youmd env restore <vault> [--root --force]`
- `youmd stack sync [--dry-run]`, `youmd stack daemon install|uninstall|status`
- `youmd machine setup`

CLI conventions: top-level commands use a **single `.command("name [subcommand] [args...]")`
with manual dispatch** (see `stack`/`skill`/`env`/`machine` in `cli/src/index.ts`),
NOT commander subcommands — the docs generator's P34 drift-check pairs each
commander command 1:1 with a single-word `HELP_GROUPS` entry. Adding a new
top-level command requires a matching single-word `HELP_GROUPS` entry or
`npm run docs:check` fails.

---

## Current state

- Local `main` == origin; CI green (Convex Deploy, Agent Docs, CI all fixed).
- npm: **`0.7.0` published**; repo is at **`0.7.1`** (adds `machine setup` + the
  env/machine command refactor) — **needs one more publish** to go global.
- Both sync daemons live on this Mac; agent-shared repo populated and pushed.
- GitHub OAuth live and verified.

## What remains / handoff

1. **Publish `youmd@0.7.1`** (`cd cli && npm run build && npm publish --otp=CODE`)
   so `machine setup` + the refactored `env`/`machine` commands are global. The
   publish-version-exists guard passes (0.7.1 free).
2. **Two-machine proof:** run the fresh-Mac flow on the MacBook Air, edit a skill
   in `~/.agent-shared/claude-skills/` there, confirm it lands back here within ~5 min.
3. **Rotate the GitHub OAuth secret** (pasted in chat); update Vercel + `.env.local`.
4. **scistack auto-sync** is opt-in — enable when ready: `SKILLSTACK_REPOS="$HOME/.agent-shared $HOME/.claude/scistack"`.
5. `newsletter-app 2` is **deprecated** (Houston confirmed) — ignore it; its
   corrupted git repo doesn't matter. The live `newsletter-app` is what counts
   and has its `.env.example`.
6. `.env.example` now exists for all active projects (5 added + committed this
   session; `youtube-thumbnail-editor` + `youmd` too).
