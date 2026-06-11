# One-Click Improvement Plan — 2026-06-11

The three highest-leverage PRs shippable this week. Each prevents a whole class of failure rather than fixing one instance. Estimated total: ~1 day of CC+gstack time across all three.

---

## PR 1 — `fix(cli): pull/sync dirty-check guard + atomic, locked config writes`

**Why first:** `youmd pull` (and therefore `youmd sync`, which runs pull THEN push — `cli/src/commands/sync.ts:84-93`) unconditionally overwrites every local Markdown file via `decompileToFilesystem` (`cli/src/commands/pull.ts:73`). Any local edits not yet pushed are silently destroyed. Separately, 66 raw `writeFileSync` calls in production source (92 incl. tests) with no locking mean Houston's 4-6 parallel agents can corrupt `~/.youmd/config.json`, which `readGlobalConfig` then silently swallows as `{}` (`cli/src/lib/config.ts:89-98`) — logging the user out.

**Files to touch**
- `cli/src/commands/pull.ts` — dirty check before decompile; fix `lastPulledHash` ancestry bug
- `cli/src/lib/config.ts` — atomic write helper, 0o600 mode, `.bak` on parse failure
- `cli/src/commands/sync.ts` — pass `--force` semantics through; abort sync if pull refuses
- `cli/src/__tests__/pull-guard.test.ts` — new

**Sketch — dirty check (pull.ts, before `decompileToFilesystem`)**

```ts
import { compileBundle } from "../lib/compiler";
import { computeContentHash } from "../lib/hash";

// Refuse to clobber unpushed local edits unless --force
const lc = readLocalConfig();
if (!options.force && fs.existsSync(path.join(bundleDir, "you.json"))) {
  const { youJson: localJson, youMd: localMd } = compileBundle(bundleDir);
  const localHash = computeContentHash(localJson, localMd);
  const ancestor = lc?.lastPushedHash || lc?.lastPulledHash;
  if (ancestor && localHash !== ancestor) {
    console.log(chalk.hex("#C46A3A")("  local edits detected that haven't been pushed"));
    console.log(chalk.dim("  run `youmd push` first, or `youmd pull --force` to overwrite"));
    return;
  }
}
```

**Sketch — fix the ancestry hash (pull.ts:124-137).** Today it records the latest DRAFT's hash while writing the PUBLISHED bundle's content, defeating the push divergence guard:

```ts
// Record the hash of what we actually wrote to disk, not the newest draft
const writtenHash = computeContentHash(youJson, youJsonSource.youMd ?? "");
lc.lastPulledHash = writtenHash;
lc.localContentHash = writtenHash;
const draftHash = meRes.data.latestBundle?.contentHash;
if (draftHash && draftHash !== writtenHash) {
  console.log(chalk.dim("  note: a newer unpublished draft exists on you.md — pushing will overwrite it"));
}
```

**Sketch — atomic locked config writes (config.ts)**

```ts
export function writeJsonAtomic(file: string, data: unknown, mode = 0o600): void {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", { mode });
  fs.renameSync(tmp, file); // atomic on same volume
}

export function readGlobalConfig(): GlobalConfig {
  if (!fs.existsSync(GLOBAL_CONFIG_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(GLOBAL_CONFIG_FILE, "utf-8"));
  } catch {
    // Preserve evidence instead of silently logging the user out
    try { fs.copyFileSync(GLOBAL_CONFIG_FILE, GLOBAL_CONFIG_FILE + ".bak"); } catch {}
    console.error("warning: ~/.youmd/config.json is corrupt — saved as config.json.bak");
    return {};
  }
}
```

Route `writeGlobalConfig`/`writeLocalConfig` through `writeJsonAtomic`. A simple `O_EXCL` lockfile around config writes (retry 5x with 50ms jitter) covers the parallel-agent race. Full three-way merge using the already-saved `base.json` (`pull.ts:140-141` — today read only by push's size/diff guard and the compiler skeleton, never as a merge base) is the follow-up PR — this one makes sync safe by default first.

---

## PR 2 — `fix(installer): default to npm channel, pin source installs, health-check auto-upgrade`

**Why:** `src/app/install.sh/route.ts:11` defaults `INSTALL_CHANNEL` to `source`, which `git clone --depth 1`s unpinned main HEAD (line 53) with no checksum. The generated `~/.youmd/bin/youmd-auto-upgrade` re-pipes `curl | bash` every 12 hours into every installed machine (line 110), and stack adapters tell every agent session to run it (`cli/src/lib/youstack.ts:883`). One broken commit on main bricks the entire fleet within 12 hours with no rollback. The update checker (`cli/src/lib/update.ts:40`) compares against npm, which diverges from source installs — so versions are already lying.

**Files to touch**
- `src/app/install.sh/route.ts` — flip default channel, pin source, add health check + rollback

**Sketch — channel default + tag pin**

```bash
INSTALL_CHANNEL="\${YOUMD_INSTALL_CHANNEL:-npm}"            # was: source
SOURCE_REF="\${YOUMD_SOURCE_REF:-cli-v$CLI_VERSION}"        # release tag, injected at build

install_from_source() {
  command -v git >/dev/null 2>&1 || return 1
  TMP_DIR="$(mktemp -d)"
  echo "Installing You.md runtime from GitHub ($SOURCE_REF)..."
  git clone --depth 1 --branch "$SOURCE_REF" "$REPO_URL" "$TMP_DIR/youmd" >/dev/null
  ...
}
```

Inject `CLI_VERSION` into the script template from `cli/package.json` at route render time (the route already builds the script as a template string).

**Sketch — auto-upgrade health check + rollback**

```bash
PREV_VERSION="$(youmd --version 2>/dev/null || true)"
curl -fsSL https://you.md/install.sh | bash >/tmp/youmd-auto-upgrade.log 2>&1 || exit 0
if ! youmd --version >/dev/null 2>&1; then
  echo "youmd upgrade failed health check, rolling back to $PREV_VERSION" >> /tmp/youmd-auto-upgrade.log
  [ -n "$PREV_VERSION" ] && npm install -g "youmd@$PREV_VERSION" >/dev/null 2>&1
fi
```

npm channel makes rollback trivial (versions are immutable). Source stays available for development via `YOUMD_INSTALL_CHANNEL=source`.

---

## PR 3 — `ci: PR quality gate + gated Convex prod deploys`

**Why:** The web app and Convex backend have zero tests and no CI build check — the only gates are docs linting and CLI tests. `.github/workflows/convex-deploy.yml:39` selects the PROD deploy key for every push to main touching `convex/**` and runs `checkout -> npm ci -> npx convex deploy` with no test, typecheck, or smoke step. A broken page component is caught at Vercel deploy time, after merge; a broken Convex function is caught by users.

**Files to touch**
- `.github/workflows/ci.yml` — new
- `.github/workflows/convex-deploy.yml` — add gate job

**Sketch — ci.yml**

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm run lint
      - run: npx next build
        env:
          NEXT_PUBLIC_CONVEX_URL: ${{ secrets.NEXT_PUBLIC_CONVEX_URL }}
      - name: CLI tests
        run: cd cli && npm ci && npm test
```

**Sketch — convex-deploy.yml gate**

```yaml
jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm run llms:smoke -- --base-url https://www.you.md   # script exists: scripts/smoke-agent-docs.mjs
  deploy:
    needs: gate
    ...existing steps...
```

Follow-up (next week, not this PR): dev-deploy -> API smoke -> prod promotion, and the first convex-test contract tests for MCP dispatch + auth (roadmap #6).

---

## Bonus: 30-minute fixes worth riding along on any of the above

| Fix | File | Change |
|---|---|---|
| Brand fonts never load | `src/app/layout.tsx` | Add `JetBrains_Mono` + `Inter` via `next/font/google` with `variable: "--font-jetbrains-mono"` / `"--font-inter"` (globals.css:65-67 already expects these vars) |
| WCAG zoom block | `src/app/layout.tsx:31` | Replace hand-rolled meta with `export const viewport`; drop `maximum-scale=1, user-scalable=no` |
| Agents fetching /llms.txt hit a Convex profile lookup | `src/proxy.ts:25-28` | Add `llms.txt`, `llms-full.txt`, `shell`, `schema`, `install.sh` to RESERVED_PATHS |
| Spend-cap doc lies ($50 vs $500) | `convex/lib/spendCap.ts:7,27,36` | Align comments with `DEFAULT_DAILY_LIMIT_USD = 500` (or lower the constant) |
| CLI version drift | `cli/src/index.ts:55` | Read version from `../package.json` instead of hardcoded `"0.6.23"` |
