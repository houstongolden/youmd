/**
 * P9 — stack install from the public registry.
 *
 * Fetches a YouStack from GET /api/v1/stacks/registry/{user}/{slug},
 * validates the manifest, writes files to ./stacks/<slug>/ (or --dir),
 * then runs the host-link engine to emit .claude/skills/<name>/SKILL.md.
 *
 * Error paths:
 *   not_found         — unknown user or stack slug
 *   conflict          — target dir already exists (use --force to overwrite)
 *   invalid_manifest  — manifest fails validateYouStackManifest
 */

import * as fs from "fs";
import * as path from "path";
import { getConvexSiteUrl } from "./config";
import { apiErrorMessage } from "./api";
import {
  validateYouStackManifest,
  linkYouStackAdapters,
  type LoadedYouStack,
  type YouStackManifest,
} from "./youstack";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StackInstallOptions {
  /** Override target base directory. Defaults to process.cwd(). */
  dir?: string;
  /** Overwrite an existing stacks/<slug>/ directory. */
  force?: boolean;
}

export interface StackInstallResult {
  slug: string;
  targetDir: string;
  filesWritten: string[];
  hostLinks: string[];
  /** Stack manifest as parsed from the registry response. */
  manifest: YouStackManifest;
}

export interface RegistryFile {
  path: string;
  size: number;
  content: string;
}

export interface RegistryResponse {
  user: string;
  slug: string;
  manifest: unknown;
  files: RegistryFile[];
  fileCount: number;
  truncated: boolean;
  syncedAt: number;
  stale: boolean;
}

// ── Registry fetch ─────────────────────────────────────────────────────────────

/**
 * Fetch the registry entry for <user>/<slug> from the Convex site.
 * Throws with a descriptive message on network error or non-2xx response.
 */
export async function fetchRegistryEntry(
  user: string,
  slug: string
): Promise<RegistryResponse> {
  const base = getConvexSiteUrl();
  const url = `${base}/api/v1/stacks/registry/${encodeURIComponent(user)}/${encodeURIComponent(slug)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    throw new Error(
      err instanceof Error ? err.message : "network error fetching registry"
    );
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error(`registry returned non-JSON (status ${res.status})`);
  }

  if (!res.ok) {
    const msg = apiErrorMessage(data) ?? `registry error ${res.status}`;
    const code = res.status === 404 ? "not_found" : "registry_error";
    const err = new Error(msg) as Error & { code?: string; status?: number };
    err.code = code;
    err.status = res.status;
    throw err;
  }

  return data as RegistryResponse;
}

// ── Write helpers ─────────────────────────────────────────────────────────────

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

// ── Main install function ─────────────────────────────────────────────────────

/**
 * Install a YouStack from the public registry.
 *
 * 1. Fetch manifest + files from /api/v1/stacks/registry/{user}/{slug}.
 * 2. Validate the manifest with validateYouStackManifest.
 * 3. Write files to <baseDir>/stacks/<slug>/ (refuses if dir exists without --force).
 * 4. Run linkYouStackAdapters to emit .claude/skills/<name>/SKILL.md.
 *
 * Returns StackInstallResult on success. Throws on any error.
 */
export async function installStack(
  user: string,
  slug: string,
  options: StackInstallOptions = {}
): Promise<StackInstallResult> {
  const baseDir = path.resolve(options.dir ?? process.cwd());
  const targetDir = path.join(baseDir, "stacks", slug);

  // Conflict check BEFORE the network call so fast failure is instant.
  if (!options.force && fs.existsSync(targetDir)) {
    const err = new Error(
      `stacks/${slug}/ already exists. Use --force to overwrite.`
    ) as Error & { code?: string };
    err.code = "conflict";
    throw err;
  }

  // Fetch from registry.
  const entry = await fetchRegistryEntry(user, slug);

  // Validate the manifest.
  const validation = validateYouStackManifest(entry.manifest);
  if (!validation.ok) {
    const err = new Error(
      `invalid manifest: ${validation.errors.join("; ")}`
    ) as Error & { code?: string; validationErrors?: string[] };
    err.code = "invalid_manifest";
    err.validationErrors = validation.errors;
    throw err;
  }

  const manifest = entry.manifest as YouStackManifest;

  // Write files.
  ensureDir(targetDir);
  const filesWritten: string[] = [];
  for (const file of entry.files) {
    // Strip the leading stacks/<slug>/ prefix so paths are relative to targetDir.
    const relPath = file.path.replace(/^stacks\/[^/]+\//, "");
    if (!relPath) continue;
    const dest = path.join(targetDir, relPath);
    ensureDir(path.dirname(dest));
    fs.writeFileSync(dest, file.content, "utf8");
    filesWritten.push(dest);
  }

  // Find the manifest file we just wrote.
  const manifestPath = filesWritten.find((p) =>
    /\/(youstack|manifest)\.(json|ya?ml)$/i.test(p)
  ) ?? path.join(targetDir, "youstack.json");

  // Run the host-link engine (emits .claude/skills/<name>/SKILL.md etc.).
  const loaded: LoadedYouStack = {
    manifest,
    manifestPath,
    rootDir: targetDir,
    validation,
  };

  const linkResults = linkYouStackAdapters(loaded, {
    hosts: ["claude-code"],
    targetDir: baseDir,
  });

  const hostLinks = linkResults
    .filter((r) => r.wrote)
    .map((r) => r.targetPath);

  return {
    slug,
    targetDir,
    filesWritten,
    hostLinks,
    manifest,
  };
}
