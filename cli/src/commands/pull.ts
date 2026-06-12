import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { getMe, getPublicProfile, getPrivateContext } from "../lib/api";
import {
  readGlobalConfig,
  writeGlobalConfig,
  readBundleConfig,
  writeBundleConfig,
  resolveSyncBundleDir,
  bundleResolutionNotice,
  markLocalBundle,
  ensureYoumdGitignored,
} from "../lib/config";
import { writePrivateContextToLocal } from "./private";
import { computeContentHash, shortHash } from "../lib/hash";
import { compileBundle } from "../lib/compiler";
import { syncAllSkills } from "../lib/skills";
import { readSkillCatalog } from "../lib/skill-catalog";
import { decompileToFilesystem, detectFormat } from "../lib/decompile";

export interface LocalDirtyState {
  dirty: boolean;
  localHash?: string;
  hasBaseline: boolean;
}

/**
 * Content hash that ignores volatile compile output. The compiler stamps
 * `generated_at` and `meta.last_updated` into you.json and `generated_at`
 * into you.md on every compile, so the raw contentHash changes even when no
 * source file changed. Strip them before hashing so identical source files
 * always hash the same.
 */
export function stableContentHash(youJson: unknown, youMd: string): string {
  const cleaned = { ...((youJson as Record<string, unknown>) || {}) };
  delete cleaned.generated_at;
  if (cleaned.meta && typeof cleaned.meta === "object" && !Array.isArray(cleaned.meta)) {
    const meta = { ...(cleaned.meta as Record<string, unknown>) };
    delete meta.last_updated;
    cleaned.meta = meta;
  }
  const cleanedMd = (youMd || "")
    .split("\n")
    .filter((line) => !line.startsWith("generated_at:"))
    .join("\n");
  return computeContentHash(cleaned, cleanedMd);
}

/**
 * Detect whether the local bundle has edits that haven't been pushed.
 * Compiles the local bundle and compares its stable content hash against
 * the baseline recorded by the last pull in .youmd/config.json.
 */
export function detectLocalDirtyState(bundleDir: string): LocalDirtyState {
  const lc = readBundleConfig(bundleDir);
  const baseline = lc?.lastPulledStableHash;
  if (!baseline) return { dirty: false, hasBaseline: false };
  if (!fs.existsSync(path.join(bundleDir, "you.json"))) {
    return { dirty: false, hasBaseline: true };
  }
  try {
    const compiled = compileBundle(bundleDir);
    if (!compiled) return { dirty: false, hasBaseline: true };
    const localHash = stableContentHash(compiled.youJson, compiled.markdown);
    return { dirty: localHash !== baseline, localHash, hasBaseline: true };
  } catch {
    // Can't compile — don't block the pull on a broken local bundle
    return { dirty: false, hasBaseline: true };
  }
}

export type PullOutcome = "ok" | "dirty" | "no-remote" | "auth-required";

export async function pullCommand(options: { force?: boolean; local?: boolean } = {}): Promise<PullOutcome> {
  const config = readGlobalConfig();

  if (!config.token) {
    console.log(chalk.hex("#C46A3A")("  not authenticated. run: youmd login"));
    return "auth-required";
  }

  if (!config.username) {
    console.log(chalk.hex("#C46A3A")("  no username configured. run: youmd login"));
    return "auth-required";
  }

  const username = config.username;

  // T7 — home-first: identity pulls land in ~/.youmd unless --local or a
  // deliberate youmd.local.json marker targets the project-local bundle.
  const resolution = resolveSyncBundleDir({ local: options.local });
  const notice = bundleResolutionNotice(resolution);
  if (notice) console.log(chalk.dim(`  ${notice}`));

  console.log(chalk.dim(`  pulling profile for @${username}...`));

  // Fetch the published profile from the API
  const profile = await getPublicProfile(username);

  // If public profile has no youJson, fall back to /me endpoint (latest bundle)
  let youJsonSource: { youJson: unknown; youMd?: string | null } | null = null;

  if (profile && profile.youJson) {
    youJsonSource = { youJson: profile.youJson, youMd: profile.youMd };

    const avatarUrl = ((profile.youJson as Record<string, unknown>)._profile as Record<string, unknown> | undefined)?.avatarUrl;
    if (typeof avatarUrl === "string" && avatarUrl) {
      const nextConfig = readGlobalConfig();
      nextConfig.avatarUrl = avatarUrl;
      writeGlobalConfig(nextConfig);
    }
  } else {
    console.log(chalk.dim("  no published profile found, checking your latest bundle..."));
    try {
      const meRes = await getMe();
      if (meRes.ok && meRes.data?.latestBundle?.youJson) {
        youJsonSource = {
          youJson: meRes.data.latestBundle.youJson,
          youMd: meRes.data.latestBundle.youMd ?? null,
        };
        console.log(chalk.dim(`  found bundle v${meRes.data.latestBundle.version} (${meRes.data.latestBundle.isPublished ? "published" : "draft"})`));
      }
    } catch {
      // getMe failed — fall through to error
    }
  }

  if (!youJsonSource) {
    console.log(chalk.hex("#C46A3A")("  no published bundle found on you.md"));
    console.log(chalk.dim("  publish your local bundle first: youmd build && youmd publish"));
    return "no-remote";
  }

  const bundleDir = resolution.dir;
  const youJson = youJsonSource.youJson as Record<string, unknown>;

  // Refuse to clobber unpushed local edits unless --force. If the local
  // bundle compiles to the same content as the remote (e.g. the user just
  // pushed), there is nothing to lose and the pull proceeds.
  if (!options.force) {
    const dirtyState = detectLocalDirtyState(bundleDir);
    if (dirtyState.dirty) {
      const remoteStable = stableContentHash(youJson, youJsonSource.youMd ?? "");
      if (dirtyState.localHash !== remoteStable) {
        console.log(chalk.hex("#C46A3A")("  local edits detected that haven't been pushed"));
        console.log(
          chalk.dim("  run ") + chalk.cyan("youmd push") + chalk.dim(" first, or ") +
          chalk.cyan("youmd pull --force") + chalk.dim(" to overwrite local edits")
        );
        process.exitCode = 1;
        return "dirty";
      }
    }
  }

  // Detect format and log it
  const format = detectFormat(youJson);
  console.log(chalk.dim(`  format: ${format}`));

  fs.mkdirSync(bundleDir, { recursive: true });

  // T7 — writing a project-local bundle is deliberate: persist the marker so
  // future pull/push/sync target it without --local, and make sure the repo
  // never silently commits identity data.
  if (resolution.scope === "local") {
    markLocalBundle(bundleDir);
    const gitignore = ensureYoumdGitignored(bundleDir);
    if (gitignore === "appended" || gitignore === "created") {
      console.log(chalk.dim("  added .youmd/ to .gitignore — identity data stays out of git"));
    }
  }

  // Decompile youJson → all markdown files in standard directories
  const filesWritten = decompileToFilesystem(bundleDir, youJson);

  // Log each directory that was written
  for (const dir of ["profile", "preferences", "voice", "directives"]) {
    const dirPath = path.join(bundleDir, dir);
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".md"));
      for (const file of files) {
        console.log(chalk.green("  \u2713") + chalk.dim(` ${dir}/${file}`));
      }
    }
  }

  let totalFiles = filesWritten;

  // Write you.json
  fs.writeFileSync(path.join(bundleDir, "you.json"), JSON.stringify(youJson, null, 2));
  totalFiles++;
  console.log(chalk.green("  \u2713") + chalk.dim(" you.json"));

  // Write you.md
  if (youJsonSource.youMd) {
    fs.writeFileSync(path.join(bundleDir, "you.md"), youJsonSource.youMd);
    totalFiles++;
    console.log(chalk.green("  \u2713") + chalk.dim(" you.md"));
  }

  // Pull private context
  try {
    const privateRes = await getPrivateContext();
    if (privateRes.ok && privateRes.data) {
      const privateFiles = writePrivateContextToLocal(bundleDir, privateRes.data);
      if (privateFiles > 0) {
        totalFiles += privateFiles;
        if (privateRes.data.privateNotes) {
          console.log(chalk.green("  \u2713") + chalk.dim(" private/notes.md"));
        }
        if (privateRes.data.internalLinks && Object.keys(privateRes.data.internalLinks).length > 0) {
          console.log(chalk.green("  \u2713") + chalk.dim(" private/links.json"));
        }
        if (privateRes.data.privateProjects && privateRes.data.privateProjects.length > 0) {
          console.log(chalk.green("  \u2713") + chalk.dim(" private/projects.json"));
        }
      }
    }
  } catch {
    console.log(chalk.dim("  skipped private context (not available)"));
  }

  // Record the dirty-check baseline: the stable hash of the bundle as it
  // compiles from the files we just wrote (compile(decompile(x)) may differ
  // from x, and generated_at changes on every compile — stableContentHash
  // makes this comparable on future pulls).
  try {
    const compiledAfterWrite = compileBundle(bundleDir);
    if (compiledAfterWrite) {
      const lc = readBundleConfig(bundleDir) || { version: 1, sources: [] };
      lc.lastPulledStableHash = stableContentHash(compiledAfterWrite.youJson, compiledAfterWrite.markdown);
      writeBundleConfig(bundleDir, lc);
    }
  } catch {
    // non-fatal — without a baseline the dirty check simply stays inert
  }

  // Track the remote hash we pulled so push/publish can detect divergence
  try {
    const meRes = await getMe();
    if (meRes.ok) {
      const remoteVersion = meRes.data.publishedBundle?.version || meRes.data.latestBundle?.version || 0;
      // Record the hash of what we actually wrote to disk — NOT the newest
      // draft's hash, which may be content we never pulled.
      const writtenHash = computeContentHash(youJson, youJsonSource.youMd ?? "");
      const lc = readBundleConfig(bundleDir) || { version: 1, sources: [] };
      lc.lastKnownRemoteVersion = remoteVersion;
      lc.lastPulledHash = writtenHash;
      lc.localContentHash = writtenHash;
      writeBundleConfig(bundleDir, lc);

      const draftHash = meRes.data.latestBundle?.contentHash;
      if (draftHash && draftHash !== writtenHash) {
        console.log(chalk.dim("  note: a newer unpublished draft exists on you.md — pushing will overwrite it"));
      }

      // Save base.json — the "common ancestor" for future merges
      const baseJsonPath = path.join(bundleDir, "base.json");
      fs.writeFileSync(baseJsonPath, JSON.stringify(youJson, null, 2));

      console.log(chalk.dim(`  remote hash: ${shortHash(writtenHash)}`));
    }
  } catch {
    // non-fatal
  }

  // Auto re-interpolate installed skills after identity pull
  const catalog = readSkillCatalog();
  const installedCount = catalog.skills.filter((s) => s.installed).length;
  if (installedCount > 0) {
    console.log("");
    console.log(chalk.dim("  re-interpolating skills against updated identity..."));
    const syncResult = syncAllSkills();
    if (syncResult.synced.length > 0) {
      console.log(
        chalk.green("  \u2713") +
        chalk.dim(` ${syncResult.synced.length} skill${syncResult.synced.length === 1 ? "" : "s"} synced`)
      );
    }
    if (syncResult.errors.length > 0) {
      for (const err of syncResult.errors) {
        console.log(chalk.hex("#C46A3A")(`  skill sync error: ${err}`));
      }
    }
  }

  // Content-aware summary
  const summaryParts: string[] = [];
  const identity = (youJson.identity as Record<string, unknown>) || {};
  if (identity.name) summaryParts.push(chalk.hex("#C46A3A")(String(identity.name)));
  const projects = (youJson.projects as unknown[]) || [];
  if (projects.length > 0) summaryParts.push(`${projects.length} project${projects.length === 1 ? "" : "s"}`);
  const values = (youJson.values as unknown[]) || [];
  if (values.length > 0) summaryParts.push(`${values.length} value${values.length === 1 ? "" : "s"}`);
  const voice = (youJson.voice as Record<string, unknown>) || {};
  if (voice.overall) summaryParts.push("voice");
  const ad = (youJson.agent_directives as Record<string, unknown>) || {};
  if (ad.communication_style || (ad.negative_prompts as unknown[])?.length) summaryParts.push("directives");

  console.log("");
  console.log(chalk.green(`  pulled ${totalFiles} files from you.md/${username}`));
  if (summaryParts.length > 0) {
    console.log(chalk.dim(`  ${summaryParts.join(chalk.dim(" / "))}`));
  }
  console.log(chalk.dim(`  bundle dir: ${bundleDir}`));
  return "ok";
}
