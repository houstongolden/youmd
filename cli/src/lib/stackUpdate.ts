/**
 * L17 — stack update channel.
 *
 * Checks the upstream registry for a newer version of a YouStack manifest.
 * Falls back to the manifest's `update.source` field if no registry endpoint
 * exists, querying the `repo` field in `owner` with `git ls-remote`.
 *
 * Contract:
 *   - checkStackUpdate(loaded)  → StackUpdateInfo
 *   - applyStackUpdate(loaded, info) → void (writes new files, does NOT commit)
 */

import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";
import type { LoadedYouStack } from "./youstack";

// ── Public types ─────────────────────────────────────────────────────────────

export interface StackUpdateInfo {
  /** Version string declared in the local manifest. */
  currentVersion: string;
  /** Version string from upstream. null when no upstream tag/manifest found. */
  latestVersion: string | null;
  /** Whether the upstream is ahead of local. */
  updateAvailable: boolean;
  /** Source used: "registry" | "git-ls-remote" | "source-url" | "none" */
  source: "registry" | "git-ls-remote" | "source-url" | "none";
  /** First line of upstream CHANGELOG.md, if present beside the manifest. */
  changelogHint: string | null;
  /** Human-readable status message (lowercase). */
  message: string;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Compare semver-ish version strings (e.g. "1.2.3"). Returns true when
 * `upstream` is strictly newer than `local`. Non-semver strings fall back to
 * a raw string comparison (!=).
 */
function isNewer(local: string, upstream: string): boolean {
  if (local === upstream) return false;

  const parse = (v: string): number[] =>
    v.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);

  const a = parse(local);
  const b = parse(upstream);

  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (bv > av) return true;
    if (bv < av) return false;
  }
  return false;
}

/**
 * Fetch the version from a remote youstack.json URL.
 * Returns null on any fetch/parse error.
 */
async function fetchRemoteManifestVersion(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as Record<string, unknown>;
    return typeof data.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

/**
 * Fetch the first non-blank, non-heading line from a remote CHANGELOG.md URL.
 * Returns null on any error.
 */
async function fetchChangelogHint(changelogUrl: string): Promise<string | null> {
  try {
    const resp = await fetch(changelogUrl, {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return null;
    const text = await resp.text();
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) return trimmed.slice(0, 120);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve the latest semver tag from a git remote URL using `git ls-remote`.
 * Returns null when git is unavailable or the repo has no semver tags.
 */
function resolveLatestGitTag(repoUrl: string): string | null {
  try {
    const output = execFileSync(
      "git",
      ["ls-remote", "--tags", "--sort=-version:refname", repoUrl],
      { encoding: "utf8", timeout: 8000, stdio: ["ignore", "pipe", "ignore"] }
    );
    for (const line of output.split("\n")) {
      const ref = line.split("\t")[1]?.trim();
      if (!ref) continue;
      // Only plain tags, not peeled (^{}) refs. Strip refs/tags/ prefix.
      if (ref.includes("^{}")) continue;
      const tag = ref.replace("refs/tags/", "");
      if (/^\d/.test(tag) || /^v\d/.test(tag)) return tag.replace(/^v/, "");
    }
    return null;
  } catch {
    return null;
  }
}

// ── Main public function ──────────────────────────────────────────────────────

/**
 * Check whether the upstream source (registry endpoint → manifest source URL
 * → git ls-remote on owner.repo) has a version newer than the local manifest.
 */
export async function checkStackUpdate(
  loaded: LoadedYouStack
): Promise<StackUpdateInfo> {
  const { manifest, rootDir } = loaded;
  const currentVersion = manifest.version || "0.0.0";

  // ── 1. registry endpoint (future: registry.you.md/stacks/<slug>) ──────────
  // If the manifest has update.source pointing to a remote JSON URL, fetch it.
  const sourceUrl = manifest.update?.source;
  if (sourceUrl && sourceUrl.startsWith("http")) {
    const latestVersion = await fetchRemoteManifestVersion(sourceUrl);
    if (latestVersion) {
      const updateAvailable = isNewer(currentVersion, latestVersion);
      // Try a CHANGELOG.md beside the source manifest.
      const changelogUrl = sourceUrl.replace(/youstack\.json$/, "CHANGELOG.md");
      const changelogHint = await fetchChangelogHint(changelogUrl);
      return {
        currentVersion,
        latestVersion,
        updateAvailable,
        source: "source-url",
        changelogHint,
        message: updateAvailable
          ? `update available: ${currentVersion} → ${latestVersion}`
          : `up to date (${currentVersion})`,
      };
    }
  }

  // ── 2. git ls-remote on owner.repo ───────────────────────────────────────
  const ownerRecord = manifest.owner as Record<string, unknown> | undefined;
  const repoField =
    typeof ownerRecord?.repo === "string" ? ownerRecord.repo : undefined;

  if (repoField) {
    // Resolve a full git remote URL. Bare "owner/name" → github https.
    const gitUrl = repoField.startsWith("http")
      ? repoField
      : `https://github.com/${repoField}.git`;

    const latestVersion = resolveLatestGitTag(gitUrl);
    if (latestVersion) {
      const updateAvailable = isNewer(currentVersion, latestVersion);
      // Check for a local CHANGELOG.md beside the manifest as a hint.
      let changelogHint: string | null = null;
      const localChangelog = path.join(rootDir, "CHANGELOG.md");
      if (fs.existsSync(localChangelog)) {
        const content = fs.readFileSync(localChangelog, "utf8");
        for (const line of content.split("\n")) {
          const t = line.trim();
          if (t && !t.startsWith("#")) {
            changelogHint = t.slice(0, 120);
            break;
          }
        }
      }
      return {
        currentVersion,
        latestVersion,
        updateAvailable,
        source: "git-ls-remote",
        changelogHint,
        message: updateAvailable
          ? `update available: ${currentVersion} → ${latestVersion}`
          : `up to date (${currentVersion})`,
      };
    }
  }

  // ── 3. nothing found ─────────────────────────────────────────────────────
  return {
    currentVersion,
    latestVersion: null,
    updateAvailable: false,
    source: "none",
    changelogHint: null,
    message: "no upstream version source configured (set update.source or owner.repo)",
  };
}

// ── Apply update ─────────────────────────────────────────────────────────────

export interface StackApplyResult {
  wrote: string[];
  skipped: string[];
  error: string | null;
}

/**
 * Apply an update by fetching the manifest from update.source and writing it
 * into place.  Only available when source is "source-url".
 *
 * Does NOT commit or push. Writes the new youstack.json at manifestPath.
 */
export async function applyStackUpdate(
  loaded: LoadedYouStack
): Promise<StackApplyResult> {
  const { manifest, manifestPath } = loaded;
  const sourceUrl = manifest.update?.source;

  if (!sourceUrl || !sourceUrl.startsWith("http")) {
    return {
      wrote: [],
      skipped: [],
      error: "apply requires update.source to be an http(s) URL in the manifest",
    };
  }

  try {
    const resp = await fetch(sourceUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) {
      return {
        wrote: [],
        skipped: [],
        error: `fetch failed: ${resp.status} ${resp.statusText}`,
      };
    }
    const newManifest = await resp.text();
    fs.writeFileSync(manifestPath, newManifest, "utf8");
    return { wrote: [manifestPath], skipped: [], error: null };
  } catch (err) {
    return {
      wrote: [],
      skipped: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
