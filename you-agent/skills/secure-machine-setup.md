---
name: secure-machine-setup
version: 1.0.0
scope: shared
identity_fields: [profile.projects, preferences.agent]
description: "Bring your You.md agent up on a brand-new machine — clone active projects, deliver per-project secrets via zero-knowledge expiring access codes, install, and sync skills/stacks. Secrets never touch git."
---

# secure-machine-setup

Stand up a fresh computer as a runnable You.md agent workstation: identity pulled, active projects cloned, each project's `.env.local` delivered securely, dependencies installed, and skills/stacks synced. Secrets move through a zero-knowledge encrypted handoff — the you.md server only ever holds ciphertext, never the key or the plaintext, and nothing secret is ever committed, printed, or logged.

## Identity Context

- **Projects:** {{profile.projects}}
- **Agent preferences:** {{preferences.agent}}

## Trigger

Run this when the user is on a new computer and says any of:
- "set up a new machine / new laptop / new mac mini"
- "onboard my projects here"
- "bring my stack up on this laptop"
- "clone all my active projects and load their secrets"
- "I just installed youmd, get me running"

## Principles

- The brain is on you.md. The new machine becomes a working agent host, not a copied folder.
- Secrets are zero-knowledge. The key half of an access code never leaves the source machine. The server stores ciphertext only.
- Access codes are single-use and expiring. Treat them like passwords. Deliver them out-of-band.
- Act, don't ask permission for the safe steps. Do ask before cloning the long tail and before overwriting anything.
- You edit context, not source. README, project-connect / project-context, and root skill/stack/tool markdown only — never app code unless asked.
- Nothing is "done" until `npm install` (or the project's real setup command) actually succeeds.

## Flow

Run in order. Use a spinner on every async step.

1. **Install + authenticate.** On the new machine, install youmd and run device-flow login (short expiring code, Enter to open the browser).
   ```bash
   curl -fsSL https://you.md/install.sh | bash
   youmd login
   ```

2. **Pull identity + project list.** Loads the bundle and `you.json` projects[].
   ```bash
   youmd pull
   ```

3. **Detect priority projects by activity.** Most active first, widen only if asked.
   ```bash
   youmd machine projects --root ~/Desktop/CODE_YOU --days 30
   youmd machine projects --root ~/Desktop/CODE_YOU --days 90
   # offer the long tail explicitly — do not pull it silently:
   youmd machine projects --root ~/Desktop/CODE_YOU --days 365
   ```
   30 days, then 90. Prompt before including the 6-12 month long tail.

4. **Clone each project.** `machine projects` mkdirs `CODE_YOU/<project-name>` matching the repo name and clones via `gh repo clone` or `git clone`. Skips non-empty dirs. Convention: `CODE_YOU/{project-name}`.

5. **Deliver per-project secrets.** Access codes were produced on the old machine with `youmd env share`. On the new machine, claim each one — it decrypts client-side and writes `.env.local` (chmod 0600) into the matching project dir. Values are never printed.
   ```bash
   youmd env pull ymenv1_<handoffId>.<key> --root ~/Desktop/CODE_YOU
   youmd env list   # active handoffs: project + variable NAMES only, expiry, reads remaining
   ```
   Offline alternative: `youmd env backup` / `youmd env restore <vault>` (local passphrase tar vault).

6. **Install dependencies.** Per project, run its real setup command.
   ```bash
   npm install
   ```

7. **Update context only.** For each project, update README, the project-connect / project-context directory, and root markdown for skills/stacks/tools. Do NOT rewrite app source code unprompted.

8. **Sync skills + stacks.** Self-improving skills stay current across machines via the existing daemon.
   ```bash
   youmd stack sync
   ```

Result: every active project cloned, secret-loaded, installed, and synced.

## Security Contract

State this plainly and honor it:

- `.env.local` and any secret file are **never** committed to git, **never** printed, **never** logged, **never** pasted into chat. Values live only on disk at `0600`, and as ciphertext in transit and at rest.
- Encryption is client-side AES-256-GCM, zero-knowledge. The you.md server sees ciphertext plus a hash of the handoffId — never the key, never the plaintext.
- Access code format: `ymenv1_<handoffId>.<key>`. The `<key>` half never leaves the source machine. Retrieval requires BOTH the one-time expiring code AND the owner's authenticated `vault`-scoped API key.
- Codes are single-use by default and expire (default 60 minutes). Treat them like a password. Deliver out-of-band.
- Agents acting on the owner's behalf get scoped, revocable API keys — never the owner's full credentials.

API surface (all require a `vault`-scoped, owner-only API key):
- `POST /api/v1/me/env/handoff` — create (store ciphertext)
- `POST /api/v1/me/env/handoff/claim` — claim by code (burn-after-read, TTL-enforced)
- `GET /api/v1/me/env/handoffs` — list metadata (names only)

## Anti-patterns

- Committing `.env.local` or any secret to git. Ever.
- Printing, echoing, or logging secret values. `env list` shows variable NAMES only.
- Rewriting app source code. You touch README / project-context / root skill-stack-tool markdown, nothing else, unless asked.
- Cloning the full 6-12 month long tail without asking. 30/90 first, then prompt.
- Marking the machine "done" before `npm install` actually succeeds in each project.
- Reusing or sharing an access code, or leaving it in chat history. One use, out-of-band, expires.
