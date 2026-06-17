import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import {
  readGlobalConfig,
  readBundleConfig,
  writeBundleConfig,
  resolveSyncBundleDir,
  bundleResolutionNotice,
  bundleLooksInitialized,
  markLocalBundle,
  ensureYoumdGitignored,
} from "../lib/config";
import { compileBundle, writeBundle } from "../lib/compiler";
import { uploadBundle, publishLatest, updatePrivateContext, getMe } from "../lib/api";
import { readPrivateContextFromLocal } from "./private";
import { computeContentHash, shortHash } from "../lib/hash";
import { syncAllSkills } from "../lib/skills";
import { hasLinkedClaudeSkills } from "../lib/host-link";
import { readSkillCatalog } from "../lib/skill-catalog";

export type PushOutcome =
  | "ok"
  | "auth-required"
  | "not-initialized"
  | "compile-failed"
  | "empty"
  | "size-regression"
  | "remote-changed"
  | "upload-failed"
  | "publish-failed";

export async function pushCommand(options: { publish?: boolean; force?: boolean; local?: boolean; daemon?: boolean }): Promise<PushOutcome> {
  const config = readGlobalConfig();

  if (!config.token) {
    console.log(chalk.hex("#C46A3A")("  not authenticated. run: youmd login"));
    return "auth-required";
  }

  // T7 — home-first: identity pushes compile ~/.youmd unless --local or a
  // deliberate youmd.local.json marker targets the project-local bundle.
  const resolution = resolveSyncBundleDir({ local: options.local });
  const bundleDir = resolution.dir;
  const notice = bundleResolutionNotice(resolution);
  if (notice) console.log(chalk.dim(`  ${notice}`));

  if (!bundleLooksInitialized(bundleDir)) {
    console.log(chalk.hex("#C46A3A")(`  no bundle found at ${bundleDir}.`));
    if (resolution.scope === "home" && resolution.localBundlePresent) {
      console.log(chalk.dim("  run: youmd init (or youmd push --local for the project-local bundle)"));
    } else {
      console.log(chalk.dim("  run: youmd init"));
    }
    return "not-initialized";
  }

  // Step 1: Compile the bundle from local files
  console.log(chalk.dim("  compiling local bundle..."));
  const compiled = compileBundle(bundleDir);

  if (!compiled) {
    console.log(chalk.hex("#C46A3A")("  compilation failed."));
    return "compile-failed";
  }

  // ── Empty bundle guard ─────────────────────────────────────────
  if (compiled.stats.totalSections === 0) {
    console.log("");
    console.log(chalk.hex("#C46A3A")("  refusing to push: bundle has zero sections."));
    console.log(chalk.dim("  your profile/ directory may be empty."));
    console.log(chalk.dim("  run " + chalk.cyan("youmd pull") + " to fetch your profile first."));
    console.log("");
    return "empty";
  }

  // ── Size regression warning ────────────────────────────────────
  const baseJsonPath = path.join(bundleDir, "base.json");
  if (fs.existsSync(baseJsonPath) && !options.force) {
    try {
      // Compare like-for-like: base.json on disk is pretty-printed (~2.25x the
      // minified size), while compiled.youJson is measured as a minified string.
      // Re-serialize the parsed base minified so this guard measures real data
      // loss, not the indentation difference.
      const baseSize = JSON.stringify(
        JSON.parse(fs.readFileSync(baseJsonPath, "utf-8"))
      ).length;
      const compiledStr = JSON.stringify(compiled.youJson);
      const compiledSize = compiledStr.length;
      if (baseSize > 0 && compiledSize < baseSize * 0.5) {
        console.log("");
        console.log(chalk.yellow(options.daemon
          ? "  daemon skipped push: compiled bundle is >50% smaller than base.json"
          : "  warning: compiled bundle is >50% smaller than base.json"));
        console.log(chalk.dim(`  base: ${(baseSize / 1024).toFixed(1)} KB, compiled: ${(compiledSize / 1024).toFixed(1)} KB`));
        console.log(chalk.dim("  this might mean data was lost during compilation, so the remote brain was preserved."));
        if (options.daemon) {
          console.log(chalk.dim("  daemon mode treats this as pull/refresh-only sync until the roundtrip gap is fixed."));
        } else {
          console.log(chalk.dim("  use " + chalk.cyan("youmd push --force") + " to override."));
        }
        console.log("");
        return "size-regression";
      }
    } catch {
      // non-fatal
    }
  }

  // Write compiled files locally
  writeBundle(bundleDir, compiled);

  // T7 — writing a project-local bundle is deliberate: persist the marker
  // and make sure the repo never silently commits identity data.
  if (resolution.scope === "local") {
    markLocalBundle(bundleDir);
    const gitignore = ensureYoumdGitignored(bundleDir);
    if (gitignore === "appended" || gitignore === "created") {
      console.log(chalk.dim("  added .youmd/ to .gitignore — identity data stays out of git"));
    }
  }

  const youJson = compiled.youJson;
  const youMd = compiled.markdown;
  const manifest = compiled.manifest;

  // ── Auto-diff summary ──────────────────────────────────────────
  if (fs.existsSync(baseJsonPath)) {
    try {
      const baseJson = JSON.parse(fs.readFileSync(baseJsonPath, "utf-8")) as Record<string, unknown>;
      const diff = summarizeDiff(baseJson, youJson);
      if (diff.length > 0) {
        console.log("");
        console.log(chalk.dim("  changes:"));
        for (const line of diff) {
          console.log(`    ${line}`);
        }
      } else {
        console.log(chalk.dim("  no changes detected from base."));
      }
    } catch {
      // base.json unreadable
    }
  }

  // Step 2: Hash-based ancestry check — prevent overwriting diverged remote
  const localHash = computeContentHash(youJson, youMd);
  const localConfig = readBundleConfig(bundleDir);
  const parentHash = localConfig?.lastPulledHash;

  let remoteHash: string | undefined;
  let remoteVersion = 0;

  try {
    const meRes = await getMe();
    if (meRes.ok) {
      remoteVersion = meRes.data.publishedBundle?.version || meRes.data.latestBundle?.version || 0;
      remoteHash = meRes.data.latestBundle?.contentHash;

      // If remote has a hash and it differs from our last-pulled hash, remote has changed
      if (remoteHash && parentHash && remoteHash !== parentHash && !options.force) {
        console.log("");
        console.log(chalk.yellow("  remote has changed since your last pull."));
        console.log("");
        console.log(chalk.dim("    local:  ") + chalk.cyan(shortHash(localHash)));
        console.log(chalk.dim("    remote: ") + chalk.cyan(shortHash(remoteHash)) + chalk.dim(` (v${remoteVersion})`));
        console.log("");
        console.log(chalk.dim("  run ") + chalk.cyan("youmd pull") + chalk.dim(" first, then push."));
        console.log(chalk.dim("  or: ") + chalk.cyan("youmd push --force") + chalk.dim(" to override."));
        console.log("");
        return "remote-changed";
      }

      if (options.force && remoteHash && parentHash && remoteHash !== parentHash) {
        console.log(chalk.yellow("  --force detected, overriding remote changes..."));
        console.log("");
      }

      // Track the remote version we've seen
      if (localConfig) {
        localConfig.lastKnownRemoteVersion = remoteVersion;
        writeBundleConfig(bundleDir, localConfig);
      }
    }
  } catch {
    // Network error — proceed but warn
    console.log(chalk.dim("  could not verify remote version -- proceeding"));
  }

  // Step 3: Upload to Convex
  console.log(chalk.dim("  pushing to you.md..."));

  try {
    const uploadResult = await uploadBundle({
      manifest,
      youJson,
      youMd,
      parentHash,
    });

    if (uploadResult.status === 409) {
      // Server rejected due to hash conflict
      const errData = uploadResult.data;
      console.log("");
      console.log(chalk.yellow("  remote has changed since your last pull."));
      console.log("");
      console.log(chalk.dim("    local:  ") + chalk.cyan(shortHash(localHash)));
      console.log(chalk.dim("    remote: ") + chalk.cyan(shortHash(errData?.remoteHash || "unknown")) + chalk.dim(` (v${errData?.remoteVersion || "?"})`));
      console.log("");
      console.log(chalk.dim("  run ") + chalk.cyan("youmd pull") + chalk.dim(" first, then push."));
      console.log(chalk.dim("  or: ") + chalk.cyan("youmd push --force") + chalk.dim(" to override."));
      console.log("");
      return "remote-changed";
    }

    if (!uploadResult.ok) {
      console.log(
        chalk.hex("#C46A3A")(`  push failed: ${JSON.stringify(uploadResult.data)}`)
      );
      return "upload-failed";
    }

    // Update local config with hash tracking
    if (localConfig) {
      localConfig.lastPushedHash = localHash;
      localConfig.lastPulledHash = localHash;
      localConfig.localContentHash = localHash;
      writeBundleConfig(bundleDir, localConfig);
    }

    console.log(
      chalk.green("  \u2713") +
        chalk.dim(` bundle uploaded (v${uploadResult.data?.version || "?"})`) +
        chalk.dim(` [${shortHash(localHash)}]`)
    );

    // Step 3: Auto-publish if --publish flag
    if (options.publish !== false) {
      console.log(chalk.dim("  publishing..."));
      const pubResult = await publishLatest();

      if (pubResult.ok) {
        const currentConfig = readBundleConfig(bundleDir);
        if (currentConfig) {
          currentConfig.lastPublished = new Date().toISOString();
          writeBundleConfig(bundleDir, currentConfig);
        }
        console.log(
          chalk.green("  \u2713") +
            chalk.dim(
              ` published v${pubResult.data.version} \u2192 you.md/${pubResult.data.username}`
            )
        );
      } else {
        console.log(
          chalk.hex("#C46A3A")(`  publish failed: ${JSON.stringify(pubResult.data)}`)
        );
        return "publish-failed";
      }
    }

    // Push private context if local private/ directory exists
    const privateDir = path.join(bundleDir, "private");
    if (fs.existsSync(privateDir)) {
      const privateUpdates = readPrivateContextFromLocal(bundleDir);
      if (Object.keys(privateUpdates).length > 0) {
        console.log(chalk.dim("  pushing private context..."));
        try {
          const privateRes = await updatePrivateContext(privateUpdates);
          if (privateRes.ok) {
            console.log(
              chalk.green("  \u2713") + chalk.dim(" private context synced")
            );
          } else {
            console.log(
              chalk.hex("#C46A3A")(`  private context push failed: ${JSON.stringify(privateRes.data)}`)
            );
          }
        } catch (privateErr) {
          console.log(
            chalk.hex("#C46A3A")(
              `  private context push failed: ${privateErr instanceof Error ? privateErr.message : String(privateErr)}`
            )
          );
        }
      }
    }

    // Push portrait to server if portrait.json exists locally
    const portraitPath = path.join(bundleDir, "portrait.json");
    if (fs.existsSync(portraitPath)) {
      try {
        const portraitData = JSON.parse(fs.readFileSync(portraitPath, "utf-8"));
        const avatarUrl = config.avatarUrl || portraitData.sourceUrl;

        // Include avatarUrl in social_images
        if (youJson && avatarUrl) {
          if (!youJson.social_images) youJson.social_images = {};
          const si = youJson.social_images as Record<string, string>;
          if (!si.github && typeof avatarUrl === "string" && avatarUrl.includes("github")) {
            si.github = avatarUrl;
          }
        }

        // Push portrait data to server for web display persistence
        if (config.token && portraitData.lines) {
          console.log(chalk.dim("  pushing portrait..."));
          const { savePortrait } = await import("../lib/api");
          const portraitRes = await savePortrait({
            lines: portraitData.lines,
            coloredLines: portraitData.coloredLines,
            cols: portraitData.cols || 80,
            rows: portraitData.rows || portraitData.lines.length,
            format: portraitData.format || "block",
            sourceUrl: portraitData.sourceUrl || avatarUrl || "",
          });
          if (portraitRes.ok) {
            console.log(
              chalk.green("  \u2713") + chalk.dim(" portrait synced to web profile")
            );
          } else {
            console.log(chalk.dim("  portrait sync skipped (no profile yet)"));
          }
        }
      } catch {
        // non-fatal — portrait sync failure shouldn't block push
      }
    }

    // Auto re-interpolate installed skills after push (identity may have changed)
    const catalog = readSkillCatalog();
    const installedCount = catalog.skills.filter((s) => s.installed).length;
    if (installedCount > 0) {
      console.log(chalk.dim("  syncing skills with updated identity..."));
      const syncResult = syncAllSkills();
      if (syncResult.synced.length > 0) {
        console.log(
          chalk.green("  \u2713") +
          chalk.dim(` ${syncResult.synced.length} skill${syncResult.synced.length === 1 ? "" : "s"} re-interpolated`)
        );
      }
    }

    // Recommendations after push
    const recs: string[] = [];
    const catalog2 = readSkillCatalog();
    const installedSkills2 = catalog2.skills.filter((s) => s.installed);
    if (installedSkills2.length === 0) {
      recs.push("run " + chalk.cyan("youmd skill install all") + " to set up agent skills");
    } else if (
      !hasLinkedClaudeSkills(
        path.join(bundleDir, ".."),
        installedSkills2.map((s) => s.name)
      )
    ) {
      recs.push("run " + chalk.cyan("youmd skill link claude") + " to update this project's agent context");
    }

    console.log("");
    console.log(chalk.green("  push complete."));
    if (recs.length > 0) {
      for (const r of recs) {
        console.log(`  ${chalk.hex("#C46A3A")("\u203A")} ${r}`);
      }
    }
  } catch (err) {
    console.log(
      chalk.hex("#C46A3A")(
        `  push failed: ${err instanceof Error ? err.message : String(err)}`
      )
    );
    return "upload-failed";
  }

  return "ok";
}

// ── Diff summary helper ──────────────────────────────────────────────

function summarizeDiff(base: Record<string, unknown>, compiled: Record<string, unknown>): string[] {
  const lines: string[] = [];

  // Detect format migration (array → nested)
  if (Array.isArray(base.profile) && !Array.isArray(compiled.profile) && compiled.identity) {
    lines.push(chalk.green("\u2022") + chalk.dim(" format migrated: array \u2192 nested (you-md/v1)"));
    return lines; // Don't compare field-by-field across formats
  }

  // Compare identity
  const baseId = (base.identity as Record<string, unknown>) || {};
  const compId = (compiled.identity as Record<string, unknown>) || {};
  if (JSON.stringify(baseId) !== JSON.stringify(compId)) {
    lines.push(chalk.yellow("\u2022") + chalk.dim(" identity changed"));
  }

  // Compare projects
  const basePj = (base.projects as unknown[]) || [];
  const compPj = (compiled.projects as unknown[]) || [];
  if (basePj.length !== compPj.length) {
    lines.push(chalk.yellow("\u2022") + chalk.dim(` projects: ${basePj.length} \u2192 ${compPj.length}`));
  } else if (JSON.stringify(basePj) !== JSON.stringify(compPj)) {
    lines.push(chalk.yellow("\u2022") + chalk.dim(" projects modified"));
  }

  // Compare values
  const baseVals = (base.values as unknown[]) || [];
  const compVals = (compiled.values as unknown[]) || [];
  if (JSON.stringify(baseVals) !== JSON.stringify(compVals)) {
    lines.push(chalk.yellow("\u2022") + chalk.dim(` values: ${baseVals.length} \u2192 ${compVals.length}`));
  }

  // Compare preferences
  if (JSON.stringify(base.preferences) !== JSON.stringify(compiled.preferences)) {
    lines.push(chalk.yellow("\u2022") + chalk.dim(" preferences changed"));
  }

  // Compare voice
  if (JSON.stringify(base.voice) !== JSON.stringify(compiled.voice)) {
    lines.push(chalk.yellow("\u2022") + chalk.dim(" voice changed"));
  }

  // Compare directives
  if (JSON.stringify(base.agent_directives) !== JSON.stringify(compiled.agent_directives)) {
    lines.push(chalk.yellow("\u2022") + chalk.dim(" agent_directives changed"));
  }

  // Compare links
  if (JSON.stringify(base.links) !== JSON.stringify(compiled.links)) {
    lines.push(chalk.yellow("\u2022") + chalk.dim(" links changed"));
  }

  // Compare custom sections
  if (JSON.stringify(base.custom_sections) !== JSON.stringify(compiled.custom_sections)) {
    lines.push(chalk.yellow("\u2022") + chalk.dim(" custom_sections changed"));
  }

  return lines;
}
