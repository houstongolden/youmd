# folder.md ↔ You.md — Native Integration Plan

**Date:** 2026-06-26 (updated 2026-06-27)
**Status:** ✅ **AUTONOMOUS PROVISIONING SHIPPED (2026-06-27, both repos).** The zero-paste key
mint described in §2 is now built end-to-end and typechecks clean on both sides; the manual
`you storage setup` step is no longer required. Remaining: one live round-trip once
`FOLDERMD_SERVICE_SECRET` is set on both deployments (see "What shipped 2026-06-27" below).
**Owner advantage:** both products are Houston's, so we built the missing delegation primitive
rather than make users paste keys.

---

## What shipped 2026-06-27 (the §2 + §4 work, done)

**folder.md (`houstongolden/folder-md`):**
- `POST /api/v1/provision` (`app/api/v1/provision/route.ts`) — Bearer `FOLDERMD_SERVICE_SECRET`
  (or `x-service-secret`), constant-time compare, **503 when unset** (closed by default).
- `provisionExternalAccount()` + `mintApiKey()` in `lib/account-bootstrap.ts`; `externalAccounts`
  table + `convex/externalAccounts.ts` (`getByExternal` / `link`) for idempotency per
  `(externalSystem, externalUserId)`. `forceNewKey` rotates the provision key only.
- Contract test #23 in `scripts/run-tests.ts`.

**you.md (`houstongolden/youmd`):**
- `convex/folderMd.ts`: `provision` internal action (calls folder.md, encrypts the key with
  `lib/secretCrypto` AES-GCM, persists to `folderMdAccounts`, recovers a lost key via forced
  rotation), `getByUser`, `saveCreds`.
- HTTP: `POST /api/v1/me/storage/provision` (returns the key to the **owner's** first-party client
  only; connected apps get metadata) and `GET /api/v1/me/storage` (status, no secret).
- CLI/MCP: `ensureProvisionedKey()` auto-mints + caches on first use; wired into `you storage`
  and `store_media`/`get_media`. `setup` kept as an optional BYO-key override. CLI → 0.9.0.

**Operational note (not user homework):** set the same `FOLDERMD_SERVICE_SECRET` (>=32 chars) on
the you.md Convex deployment and folder.md — a deploy-time secret, like every other API key.
Optionally set `FOLDERMD_BASE_URL` on you.md (defaults to `https://www.folder.md/api/v1`).

---

## Security review (2026-06-27) — fixed + deferred

An adversarial review traced the full S2S flow. **Confirmed solid:** service-secret auth is
constant-time, fails closed (503) when unset/short, and rejects unauthenticated callers (401)
before any work; `externalUserId` is server-derived from the authenticated session (not
client-controlled, no cross-tenant reach); the minted key is returned only to the first-party
**owner** client (`credentialType === "api-key"`) — connected apps and `GET /me/storage` never see
it; AES-GCM IV handling is correct.

**Fixed this pass:**
- **Least privilege (H1):** the provision key is now minted with `write`, not `admin` — it only
  needs file read/write on its own Folder (the Folder is created server-side), so a leaked key
  can't manage keys/folders or touch account admin. (`lib/account-bootstrap.ts`)
- **Encryption domain separation (M1):** the stored folder.md key is bound to an AES-GCM AAD
  (`foldermd-api-key:v1`), so its ciphertext can never be cross-decrypted as another secret class
  (e.g. a GitHub token) that shares the deployment encryption secret. +3 unit tests.
  (`convex/lib/secretCrypto.ts`, `convex/folderMd.ts`)
- **Input caps (M3):** `externalSystem`/`externalUserId`/`displayName` length-bounded on the
  provision route (anti-amplification). (`app/api/v1/provision/route.ts`)

**Deferred (documented, not blockers) — need a Convex-transaction change best validated live:**
- **Idempotency race (C1) / rotation race (L1):** a truly-concurrent *first* provision for the
  same user (or simultaneous `forceNewKey` from two machines) can create an orphaned duplicate
  folder.md account/key and split which Folder a machine resolves. Severity is **low** (same
  tenant, no escalation/cross-tenant) and the system self-heals on the next provision (the
  `getByUser` cache + recovery rotation converge). The proper fix is to perform
  create-user+folder+key+link inside a **single Convex mutation** so OCC serializes racers — a
  structural change to `provisionExternalAccount` worth doing with a live deployment to verify.
- **Prefix-collision key lookup (M2):** pre-existing in folder.md's `apiKeys.getByPrefix().first()`
  (not introduced here); the full-hash `secureCompare` keeps it non-exploitable for forgery, but a
  rare prefix collision could fail a legitimate key. Out of scope for this PR (general key-auth
  internals); widen the stored prefix or compare-all-matches in a dedicated change.

---

## 0. Why this exists (the gap, confirmed by code audit)

You.md has **no binary/large-file path**. Every "file" is a markdown/JSON *string* in a ~1MB
Convex bundle, mirrored to GitHub under a 700KB text-only cap. The only blob path is the 8MB
encrypted env vault. A 50MB video / 10MB PDF / folder of design assets has nowhere to go.

**Principle (unchanged):** You.md stays **text-first**. The brain stores a **pointer** (a small
string — which the bundle handles perfectly); the **bytes live in folder.md**. folder.md is the
optional media lane the brain points at — never a hard dependency, invisible to text-only users.

---

## 1. folder.md surface (audited from the `houstongolden/folder-md` repo)

- **Base URL:** `https://www.folder.md/api/v1` (canonical; SDK/MCP/dashboard all use it).
- **Auth:** per-folder **Bearer API key**, prefix `fmd_live_…`, SHA-256 hashed server-side,
  scoped per Folder. Env vars the ecosystem reads: `FOLDER_API_KEY` (primary),
  `FOLDERMD_API_KEY` (fallback), `FOLDERMD_BASE_URL`.
- **REST (key endpoints):**
  - `POST /folders` · `GET /folders` · `GET/PATCH/DELETE /folders/:id`
  - `POST /folders/:id/files` (upload: multipart `file` field, OR raw text body + `x-file-path`)
  - `GET /folders/:id/files` · `GET /folders/:id/files/:fileId?download=true` (auth-gated bytes)
  - `PUT/DELETE /folders/:id/files/:fileId`
  - agent helpers: `GET /agent/capabilities`, `POST /agent/route`; AI: `POST /ai/analyze|suggest`
- **MCP server:** yes (`@foldermd/mcp`, stdio, Bearer auth). Tools: `folder_*` (list/create/get/
  tree/activity/delete), `file_*` (list/write/read/info/activity/update/delete), `subfolder_*`.
  Resources: `foldermd://agent/capabilities`, `foldermd://folders/:id/tree`.
  **Caveat:** `file_write`/`file_upload` is **text-oriented** — use REST multipart for binary/media.
- **SDK:** `@foldermd/sdk` (zero-dep TS), `@foldermd/cli`, plus an AI-SDK tool-export layer.
- **Storage backend:** **Vercel Blob (private)** today. Cloudflare R2 + zero-egress + public URLs
  are **roadmap, not shipped**. Multipart/resumable chunked upload is an **open TODO**. Docs
  state up to ~500MB (platform default), not code-pinned.
- **What does NOT exist yet:** OAuth, client-credentials, token-exchange, delegation, white-label,
  per-user S3/R2 BYO-bucket, or any "act on behalf of end users" provisioning. The unit of
  isolation is the **Folder** (workspace); keys are per-Folder.

---

## 2. The zero-user-work design (the piece to build on folder.md)

The user must never paste a key. Since we own folder.md, add a **server-to-server provisioning
endpoint** there and call it from you.md's backend.

**New folder.md endpoint (to build):**
```
POST https://www.folder.md/api/v1/provision
Headers: Authorization: Bearer <FOLDERMD_SERVICE_SECRET>   # shared you.md↔folder.md secret
Body:    { "externalSystem": "you.md", "externalUserId": "<convex userId>",
           "displayName": "<username> media" }
Returns: { "folderId": "...", "apiKey": "fmd_live_...", "created": true|false }
```
- Idempotent: look up an existing Folder mapped to `(you.md, externalUserId)` or create one +
  mint a per-Folder scoped key. This extends folder.md's existing beta-signup-returns-apiKey flow
  into a proper app-to-app provision.
- you.md stores the returned `folderId` + `apiKey` in Convex against the user (server-side,
  encrypted at rest like other secrets), and syncs the key down to machines exactly like other
  brain state. Agents never see a setup step.

**Until that endpoint exists:** the you.md-side client (shipped this session, see §3) reads a key
from config/env so the whole path is testable now with a manually pasted key.

---

## 3. you.md-side scaffold shipped this session

- `cli/src/lib/foldermd.ts` — typed client: `listFolders`, `createFolder`, `listFiles`,
  `uploadFile` (multipart, the media path), `downloadFile` (auth-gated bytes), `resolveFolderMdKey`
  (explicit → config → `FOLDER_API_KEY`/`FOLDERMD_API_KEY`), and the **`BrainMediaPointer`** type
  (`{provider:"folder.md", folderId, fileId, name, mimeType, size, uploadedAt}`) — the exact string
  you.md stores in a memory/custom_file. No bytes ever enter the brain.
- `cli/src/lib/config.ts` — added `folderMdKey` + `folderMdFolderId` to `GlobalConfig`.
- **Compiles clean** (tsc). Endpoint shapes need ONE live-verify pass against a real folder.md
  account before production (flagged in the client header).
- **`you storage` CLI shipped (manual-key path, works today):** `setup <fmd_live_…>` /
  `status` / `push <file>` / `pull <fileId> <dest>` / `list` (`cli/src/commands/storage.ts`).
  `push` auto-creates+persists a "you.md media" folder, uploads, and prints the
  `BrainMediaPointer` to store in a memory/file. Key resolution precedence explicit → config →
  env; 3 offline unit tests cover setup persistence + precedence (network paths need a live
  account). The autonomous `/provision` step (below) will replace the one-time `setup`.
- **MCP tools shipped (`store_media` / `get_media`):** any agent (Claude/Codex/Cursor) can now
  offload a large/binary asset and get back a `BrainMediaPointer`, or download one by
  folderId+fileId — wired into the local stdio MCP registry (`cli/src/mcp/registry.ts`, 28 tools).
  The folder-ensure logic is shared with the CLI via `ensureUserFolder()` in the client. So media
  offload is available across the whole "works with any agent" surface, not just `you storage`.

---

## 4. Next-session steps (both repos shared)

**On folder.md (`houstongolden/folder-md`):**
1. Build `POST /api/v1/provision` (server-to-server, `FOLDERMD_SERVICE_SECRET`), idempotent
   per `(externalSystem, externalUserId)`. Return `{folderId, apiKey}`.
2. (Optional, unblocks public media) ship the R2 migration + a public/CDN URL on files so
   you.md can hand out URLs instead of proxying bytes. Already on folder.md's own roadmap.
3. (Optional) chunked/resumable upload for >100MB (open TODO) before positioning as backup.

**On you.md (`houstongolden/youmd`):**
4. Convex: store `(folderMdFolderId, folderMdApiKey)` per user (encrypted); add
   `POST /api/v1/me/storage/provision` that calls folder.md `/provision` with the service secret
   and persists the result. Sync the key to machines via the existing brain-sync head (vault-style
   metadata-safe; never log the value).
5. CLI: `you storage push <file> [--project]` → ensure-folder → `uploadFile` → store a
   `BrainMediaPointer` in the project memory/custom_file; `you storage pull <pointer|fileId>` →
   `downloadFile`; `you storage list`. (Client already exists; this is thin wiring.)
6. MCP: add `store_media` / `get_media` tools (local stdio + hosted) that wrap the client so ANY
   agent (Claude/Codex/Cursor) can offload media with one call and get back a pointer. Prefer REST
   multipart over folder.md's text-only `file_write` for binary.
7. Web shell: render media pointers (thumbnails/links) in the Vault/portfolio panes.

**Boundary rule to keep both clean:** brain = small structured owner-state + pointers (identical
everywhere); folder.md = large/binary payloads agents mutate. If it's "config/identity/skill," it's
brain; if it's "a media file we're working on," it's folder.md.

---

## 5. Autonomous-first checklist (PRINCIPLES.md)

- ✅ No user paste once provisioning lands (server-to-server key mint).
- ✅ Invisible to text-only users (media lane only activates on first media offload).
- ✅ No new vendor lock-in for you.md (folder.md is ours; brain still works with zero media).
- ✅ Pointer-based: the brain never grows a blob subsystem; bytes stay in the right tool.
