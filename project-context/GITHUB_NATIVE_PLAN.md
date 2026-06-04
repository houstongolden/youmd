# GitHub-Native You.md — Vision & Phased Plan

Source: Houston, 2026-06-04.

> "We need a more free / simpler option. Add GitHub OAuth and just let everyone
> sign up for free, host their full You.md and use stacks on their own GitHub
> repos — public or private — and use that for all the MD files and everything.
> Since we have repo access we can clone it and host it on our own servers for
> the agentic / API / MCP stuff. Users want to: sign in, sign up, connect their
> repo, create their own You.md repo, and do it that way. Prioritize that."

This reframes You.md storage around **the user's own GitHub repo as the source of
truth** for their `.md` identity + stacks, with our servers cloning/mirroring it
to power the live agentic/API/MCP surfaces. It also makes onboarding free and
one-click via GitHub OAuth.

## The full request, broken into parts (none skipped)

1. **Free signup** — anyone can sign up free. ✅ shipping in Phase 1.
2. **GitHub OAuth** — sign in / sign up with GitHub. ✅ Phase 1.
3. **Host the full You.md in the user's own repo** — Phase 3.
4. **Use stacks from the user's own repo** — Phase 4.
5. **Public OR private repos** (user's choice). ✅ schema ready (Phase 1); wired in Phase 2.
6. **Repo holds all the MD files** (source of truth) — Phase 3.
7. **Clone repo to our servers** for agentic/API/MCP — Phase 4.
8. **Flow:** sign up → connect repo → create You.md repo → go. Phases 1–2.

## Architecture decision

- **OAuth App + `repo` scope** for v1 (fast, covers create/read/write/clone).
  Hardening to a **GitHub App** with per-repo fine-grained permissions is Phase 5.
- **Repo = source of truth** for the user's identity `.md` + stacks; **Convex =
  index + cache + auth/session + activity/audit + agent API backing store.** We
  do not delete the Convex `bundles` model — the repo content is compiled into
  the existing bundle/profile shape so every current surface keeps working. This
  is additive, not a rip-and-replace.
- Repo layout (proposed):
  ```
  you.md                 # the compiled public identity (human + agent readable)
  you.json               # structured identity bundle
  private/               # private context (only synced if repo is private)
  stacks/<slug>/         # one folder per YouStack (manifest + skills + ...)
  .youmd/manifest.json   # version, schema, sync metadata
  ```

## Phases

### Phase 1 — Free GitHub OAuth signup (THIS BRANCH) ✅
- `githubConnections` table: GitHub identity + encrypted OAuth token + scopes +
  linked-repo metadata (`repoFullName`, `repoVisibility`, default branch, sync
  bookkeeping).
- `convex/github.ts`: `findOrCreateGithubUser` (resolve by GitHub id → verified
  email → create), `getConnection`, `linkRepo`.
- Web routes `/api/auth/github/start` + `/api/auth/github/callback`; reuse the
  existing opaque-session cookie + JWKS Convex JWT path.
- "continue with github" / "sign up free with github" on sign-in + sign-up.
- Setup/runbook: `GITHUB_OAUTH_SETUP.md`.
- **Operator step:** register the OAuth App + set env vars.

### Phase 2 — Connect / create the You.md repo (UI) ✅ (code complete on branch)
- Settings pane `GithubRepoSection`: "create my You.md repo" (creates `you-md`,
  public or private per a visibility toggle) and "connect an existing repo"
  (lists the user's push-access repos via the stored token, pick one). No
  text-input forms — toggle + list only.
- `convex/githubRepo.ts` **actions** `createRepo` / `connectRepo` / `listRepos`
  hold the decrypted token inside Convex (never sent to the browser/Next), call
  GitHub, and persist via internal helpers (`internalSetRepo`). A new repo is
  seeded with `README.md`, `you.md` (latest bundle or starter), `you.json`, and
  `stacks/.gitkeep`. `repo` scope is required and checked before create/connect.
- **Needs:** Convex deploy + the OAuth App configured with `repo` scope.

### Phase 3 — Repo as source of truth for MD files (sync engine) — first slice ✅
- **Done:** `pushToRepo` writes the current compiled `you.md` + `you.json` to the
  repo (Contents API, update-by-sha, skips byte-identical files), tracking
  `lastSyncedSha`. `pullFromRepo` reads `you.md` + `you.json` back and saves a
  new bundle (repo wins on pull) + syncs the public profile. Push/pull controls
  live in the Settings pane `GithubRepoSection`. Conflict policy here is
  last-writer-wins.
- **Remaining:** extend sync to `private/*` and `stacks/*`; run pulled content
  through the compile pipeline where appropriate; a visible diff + optional
  3-way merge; GitHub webhook → re-pull on external `git push`.
- **Needs:** Convex deploy + the OAuth App configured with `repo` scope.

### Phase 4 — Clone & host for agentic/API/MCP
- Server-side clone/mirror of the repo (shallow, token-auth) into our managed
  store so `/api/v1/*`, `/api/v1/mcp`, and context links serve fast without
  hitting GitHub per request. The clone is a cache keyed by `lastSyncedSha`.
- Stacks resolve from `stacks/<slug>/` in the mirror; the YouStacks runtime and
  MCP stack tools read from there.
- Private repos: contents only ever leave the mirror through the existing
  authenticated/token-scoped surfaces (never public profile).

### Phase 5 — Harden to a GitHub App
- Migrate from OAuth App `repo` scope to a GitHub App with fine-grained,
  per-repo, least-privilege content permissions + installation tokens. Lets users
  grant access to only their You.md repo instead of all repos.

## Open product questions (defaults chosen; confirm if wrong)
- Default repo name: `you-md`. Default visibility on "create": **private**
  (safest for identity data); user can flip to public.
- Email collision: a GitHub login whose verified email matches an existing
  You.md account **links** to that account rather than creating a duplicate.
- Repo-as-truth is **opt-in per account** (Phase 2 connect step); accounts
  without a linked repo keep working exactly as today (Convex-backed).
