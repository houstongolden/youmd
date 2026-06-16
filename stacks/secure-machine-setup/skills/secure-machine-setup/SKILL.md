---
name: secure-machine-setup
version: 1.0.0
scope: shared
identity_fields: [profile.projects, preferences.agent]
description: "Bring your You.md agent up on a brand-new machine — clone active projects, deliver per-project secrets via zero-knowledge expiring access codes, install, and sync skills/stacks. Secrets never touch git."
---

# secure-machine-setup

You are standing up a fresh computer as a runnable You.md agent workstation: identity pulled, active projects cloned, each project's `.env.local` delivered securely, dependencies installed, skills/stacks synced. Secrets move through a zero-knowledge encrypted handoff. The you.md server only ever holds ciphertext — never the key, never the plaintext. Nothing secret is committed, printed, or logged.

## Identity Context

- **Projects:** {{profile.projects}}
- **Agent preferences:** {{preferences.agent}}

## Trigger

Run when the user is on a new machine and says any of: "set up a new laptop / mac mini", "onboard my projects here", "bring my stack up on this machine", "clone my active projects and load their secrets", "I just installed youmd, get me running".

## Principles

- The brain is on you.md. Make the machine a working agent host, not a copied folder.
- Zero-knowledge secrets. The key half of an access code never leaves the source machine.
- Access codes are single-use and expiring. Treat them like passwords. Out-of-band only.
- Act on the safe steps. Ask before the long tail and before overwriting anything.
- Edit context, not source: README, project-connect / project-context, and root skill/stack/tool markdown only.
- Not done until `npm install` (or the real setup command) actually succeeds.

## Flow

Run in order. Spinner on every async step.

1. Install youmd and authenticate (device-flow expiring code, Enter to open browser).
   ```bash
   curl -fsSL https://you.md/install.sh | bash
   youmd login
   ```

2. Pull identity + `you.json` projects[].
   ```bash
   youmd pull
   ```

3. Tier projects by activity. Most active first; widen only when asked.
   ```bash
   youmd machine projects --root ~/Desktop/CODE_YOU --days 30
   youmd machine projects --root ~/Desktop/CODE_YOU --days 90
   # prompt before the 6-12 month long tail:
   youmd machine projects --root ~/Desktop/CODE_YOU --days 365
   ```

4. Clone each project. `machine projects` mkdirs `CODE_YOU/<project-name>` (matching the repo name) and clones via `gh repo clone` or `git clone`, skipping non-empty dirs. Convention: `CODE_YOU/{project-name}`.

5. Deliver per-project secrets. Codes were produced on the old machine via `youmd env share`. Claim each one — it decrypts client-side and writes `.env.local` (chmod 0600) into the matching dir. Never print values.
   ```bash
   youmd env pull ymenv1_<handoffId>.<key> --root ~/Desktop/CODE_YOU
   youmd env list   # active handoffs: project + variable NAMES only, expiry, reads remaining
   ```
   Offline alternative: `youmd env backup` / `youmd env restore <vault>`.

6. Install dependencies per project.
   ```bash
   npm install
   ```

7. Update context only — README, project-connect / project-context, root skill/stack/tool markdown. Do NOT rewrite app source unprompted.

8. Sync skills + stacks across machines.
   ```bash
   youmd stack sync
   ```

## Security Contract

- `.env.local` and any secret file are never committed, never printed, never logged, never pasted into chat. Values live only on disk at `0600`, and as ciphertext in transit and at rest.
- Encryption is client-side AES-256-GCM, zero-knowledge. The server sees ciphertext plus a hash of the handoffId — never the key, never the plaintext.
- Access code format `ymenv1_<handoffId>.<key>`. The `<key>` half never leaves the source machine. Retrieval requires BOTH the one-time expiring code AND the owner's authenticated `vault`-scoped API key.
- Codes are single-use by default and expire (default 60 min). Treat like a password. Deliver out-of-band.
- Agents get scoped, revocable keys — never the owner's full credentials.

API (all require a `vault`-scoped, owner-only API key):
- `POST /api/v1/me/env/handoff` — create (store ciphertext)
- `POST /api/v1/me/env/handoff/claim` — claim by code (burn-after-read, TTL-enforced)
- `GET /api/v1/me/env/handoffs` — list metadata (names only)

## Anti-patterns

- Committing `.env.local` or any secret to git. Ever.
- Printing, echoing, or logging secret values. `env list` is names only.
- Rewriting app source. Context markdown only, unless asked.
- Cloning the 6-12 month long tail without asking. 30/90 first, then prompt.
- Marking the machine done before `npm install` actually succeeds per project.
- Reusing, sharing, or leaving an access code in chat history. One use, out-of-band, expires.
