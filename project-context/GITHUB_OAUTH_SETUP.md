# GitHub OAuth — Setup & Configuration

This is the operator checklist for turning on free GitHub sign-up. The code
shipped on branch `claude/github-oauth-free-signup` is complete; it only needs a
registered GitHub OAuth App and the env vars below. Until they are set, the
"continue with github" button degrades gracefully (redirects back to `/sign-in`
with `?error=github_unconfigured`), and the existing email-code auth is
untouched.

## 1. Register a GitHub OAuth App

1. Go to https://github.com/settings/developers → **OAuth Apps** → **New OAuth App**
   (or register it under the BAMF/You.md org's developer settings).
2. Fill in:
   - **Application name:** You.md
   - **Homepage URL:** `https://you.md`
   - **Authorization callback URL:** `https://you.md/api/auth/github/callback`
     - For local dev also add a second app (or use the same one) with
       `http://localhost:3100/api/auth/github/callback` because
       `npm run dev:frontend` serves Next on port `3100`.
3. Generate a **client secret**.

> We use an **OAuth App** (not a GitHub App) for v1 because it ships fastest and
> the `repo` scope covers everything the vision needs: create/read/write the
> user's You.md repo (public or private) and clone it server-side. A GitHub App
> with fine-grained per-repo permissions is the planned hardening step — see
> `GITHUB_NATIVE_PLAN.md` Phase 5.

## 2. Configure env vars (Vercel)

Set these on the Vercel project (Production + Preview):

| Var | Value | Notes |
|---|---|---|
| `GITHUB_OAUTH_CLIENT_ID` | from the OAuth App | required |
| `GITHUB_OAUTH_CLIENT_SECRET` | from the OAuth App | required, secret |
| `GITHUB_OAUTH_SCOPES` | `read:user user:email repo` | optional; this is the default. Use `read:user user:email` for login-only (no repo access) |
| `AUTH_APP_URL` | `https://you.md` | already used by email auth; ensures the redirect URI matches |

## 3. Configure the Convex secret

The OAuth access token is encrypted at rest with AES-GCM. The bootstrap mutation
(`api.github.findOrCreateGithubUser`) is gated on the trusted internal token, so
both of these must already be set on the **Convex** deployment (they are, for the
existing API-key + internal-auth flows):

| Convex env var | Purpose |
|---|---|
| `TRUSTED_INTERNAL_AUTH_TOKEN` | gates the github bootstrap mutation; passed server-side from the callback route |
| `API_KEY_ENCRYPTION_SECRET` | AES-GCM key for the stored OAuth token (falls back to `TRUSTED_INTERNAL_AUTH_TOKEN`) |
| `GITHUB_WEBHOOK_SECRET` | optional — enables auto-pull on external `git push`. When set, create/connect auto-registers a `push` webhook (Convex `CONVEX_SITE_URL` + `/api/github/webhook`), and the receiver verifies the `X-Hub-Signature-256` HMAC. If unset, webhook auto-pull is skipped and the manual "pull from repo" button still works. |

Set `GITHUB_WEBHOOK_SECRET` to a random 32+ char string. The OAuth `repo`
scope also covers creating the repo webhook for repos the user administers.
No other new Convex secret is required.

## 4. Deploy

- Convex schema changed (`githubConnections` table) → Convex must deploy
  (`npx convex deploy`, or the GitHub Actions auto-deploy on `convex/` changes
  once this lands on `main`).
- Web changed → Vercel auto-deploys on push to `main`.

## 5. Verify end-to-end

1. Open `https://you.md/sign-up` → click **sign up free with github**.
2. Authorize on GitHub → you should land on `/initialize` as a new user (or your
   destination if you already had an account with that verified email).
3. Returning users: `https://you.md/sign-in` → **continue with github** → `/shell`.
4. Confirm a `githubConnections` row exists for the user (Convex dashboard) with
   `hasToken: true` and the granted scopes.

## GitHub App (optional, Phase 5 — fine-grained tokens)

The OAuth `repo` scope is broad. To harden to least-privilege, per-repo,
short-lived tokens, register a **GitHub App** and have users install it on just
their You.md repo. The code path is additive: when the App is configured AND a
user has installed it, repo ops use installation tokens; otherwise they fall
back to the OAuth token. Nothing changes until you configure it.

1. Register a GitHub App (https://github.com/settings/apps/new):
   - **Repository permissions:** Contents: Read & write; Webhooks: Read & write
     (for auto-registering the push hook); Metadata: Read.
   - **Setup URL:** `https://you.md/api/auth/github/app/setup` (and check
     "Redirect on update").
   - Generate a private key (GitHub gives PKCS#1).
2. Convert the key to PKCS#8 (Web Crypto requires it):
   ```
   openssl pkcs8 -topk8 -nocrypt -in app.private-key.pem -out app.pkcs8.pem
   ```
3. Set Convex env vars:
   | Var | Value |
   |---|---|
   | `GITHUB_APP_ID` | the numeric App id |
   | `GITHUB_APP_PRIVATE_KEY_PEM` | contents of `app.pkcs8.pem` |
4. Set the Vercel public env var so the UI shows the install link:
   | Var | Value |
   |---|---|
   | `NEXT_PUBLIC_GITHUB_APP_SLUG` | the App's slug (from its public page URL) |
5. Users: sign in with GitHub (OAuth, as today) → Settings → "github app:
   install" → approve on the You.md repo. The setup callback records the
   installation; subsequent repo ops use installation tokens automatically.

> Status: code complete + compiles, but untested end-to-end (needs a real App).
> The OAuth path remains the verified default.

## What the code does

- `src/app/api/auth/github/start/route.ts` — sets a signed-ish CSRF `state`
  cookie and redirects to GitHub's authorize screen.
- `src/app/api/auth/github/callback/route.ts` — validates `state`, exchanges the
  code for a token, reads the GitHub identity (incl. verified primary email),
  resolves-or-creates the You.md account, mints the same opaque session cookie
  the email flow uses, and redirects.
- `convex/github.ts` — `findOrCreateGithubUser` (resolve by GitHub id → else by
  verified email → else create), `getConnection`, and `linkRepo`. The encrypted
  token + scopes + linked-repo metadata live in the `githubConnections` table.
