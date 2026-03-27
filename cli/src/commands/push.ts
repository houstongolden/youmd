import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { readGlobalConfig, getLocalBundleDir, localBundleExists, readLocalConfig, writeLocalConfig } from "../lib/config";
import { compileBundle, writeBundle } from "../lib/compiler";
import { uploadBundle, publishLatest, updatePrivateContext, getMe } from "../lib/api";
import { readPrivateContextFromLocal } from "./private";
import { computeContentHash, shortHash } from "../lib/hash";
import { syncAllSkills } from "../lib/skills";
import { readSkillCatalog } from "../lib/skill-catalog";

export async function pushCommand(options: { publish?: boolean; force?: boolean }) {
  const config = readGlobalConfig();

  if (!config.token) {
    console.log(chalk.hex("#C46A3A")("  not authenticated. run: youmd login"));
    return;
  }

  if (!localBundleExists()) {
    console.log(chalk.hex("#C46A3A")("  no local bundle found."));
    console.log(chalk.dim("  run: youmd init"));
    return;
  }

  const bundleDir = getLocalBundleDir();

  // Step 1: Compile the bundle from local files
  console.log(chalk.dim("  compiling local bundle..."));
  const bundle = compileBundle(bundleDir);

  if (!bundle) {
    console.log(chalk.hex("#C46A3A")("  compilation failed."));
    return;
  }

  // Write compiled files locally
  writeBundle(bundleDir, bundle);

  const youJsonPath = path.join(bundleDir, "you.json");
  const youMdPath = path.join(bundleDir, "you.md");
  const manifestPath = path.join(bundleDir, "manifest.json");

  if (!fs.existsSync(youJsonPath)) {
    console.log(chalk.hex("#C46A3A")("  you.json not found after compilation."));
    return;
  }

  const youJson = JSON.parse(fs.readFileSync(youJsonPath, "utf-8"));
  const youMd = fs.existsSync(youMdPath)
    ? fs.readFileSync(youMdPath, "utf-8")
    : "";
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, "utf-8"))
    : {};

  // Step 2: Hash-based ancestry check — prevent overwriting diverged remote
  const localHash = computeContentHash(youJson, youMd);
  const localConfig = readLocalConfig();
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
        return;
      }

      if (options.force && remoteHash && parentHash && remoteHash !== parentHash) {
        console.log(chalk.yellow("  --force detected, overriding remote changes..."));
        console.log("");
      }

      // Track the remote version we've seen
      if (localConfig) {
        localConfig.lastKnownRemoteVersion = remoteVersion;
        writeLocalConfig(localConfig);
      }
    }
  } catch {
    // Network error — proceed but warn
    console.log(chalk.dim("  could not verify remote version — proceeding"));
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
      const errData = uploadResult.data as any;
      console.log("");
      console.log(chalk.yellow("  remote has changed since your last pull."));
      console.log("");
      console.log(chalk.dim("    local:  ") + chalk.cyan(shortHash(localHash)));
      console.log(chalk.dim("    remote: ") + chalk.cyan(shortHash(errData?.remoteHash || "unknown")) + chalk.dim(` (v${errData?.remoteVersion || "?"})`));
      console.log("");
      console.log(chalk.dim("  run ") + chalk.cyan("youmd pull") + chalk.dim(" first, then push."));
      console.log(chalk.dim("  or: ") + chalk.cyan("youmd push --force") + chalk.dim(" to override."));
      console.log("");
      return;
    }

    if (!uploadResult.ok) {
      console.log(
        chalk.hex("#C46A3A")(`  push failed: ${JSON.stringify(uploadResult.data)}`)
      );
      return;
    }

    // Update local config with hash tracking
    if (localConfig) {
      localConfig.lastPushedHash = localHash;
      localConfig.lastPulledHash = localHash;
      localConfig.localContentHash = localHash;
      writeLocalConfig(localConfig);
    }

    console.log(
      chalk.green("  ✓") +
        chalk.dim(` bundle uploaded (v${(uploadResult.data as any)?.version || "?"})`) +
        chalk.dim(` [${shortHash(localHash)}]`)
    );

    // Step 3: Auto-publish if --publish flag
    if (options.publish !== false) {
      console.log(chalk.dim("  publishing..."));
      const pubResult = await publishLatest();

      if (pubResult.ok) {
        console.log(
          chalk.green("  ✓") +
            chalk.dim(
              ` published v${pubResult.data.version} → you.md/${pubResult.data.username}`
            )
        );
      } else {
        console.log(
          chalk.hex("#C46A3A")(`  publish failed: ${JSON.stringify(pubResult.data)}`)
        );
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

    // Push portrait + avatarUrl if portrait.json exists locally
    const portraitPath = path.join(bundleDir, "portrait.json");
    if (fs.existsSync(portraitPath)) {
      try {
        const portraitData = JSON.parse(fs.readFileSync(portraitPath, "utf-8"));
        const config = readGlobalConfig();
        const avatarUrl = config.avatarUrl || portraitData.sourceUrl;

        if (avatarUrl && config.token) {
          console.log(chalk.dim("  pushing portrait + avatar..."));
          // Use the existing API to update profile with avatarUrl
          const { request: apiRequest } = require("../lib/api");
          // The /api/v1/me endpoint doesn't support avatar directly,
          // but we can include it in the bundle upload youJson
          if (youJson && avatarUrl) {
            // Ensure the avatarUrl is in the social_images
            if (!youJson.social_images) youJson.social_images = {};
            if (!youJson.social_images.github && avatarUrl.includes("github")) {
              youJson.social_images.github = avatarUrl;
            }
          }
          console.log(
            chalk.green("  \u2713") + chalk.dim(" portrait data included in bundle")
          );
        }
      } catch {
        // non-fatal
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
    const claudeSkills = path.join(bundleDir, "..", ".claude", "skills", "youmd");
    if (installedCount === 0) {
      recs.push("run " + chalk.cyan("youmd skill install all") + " to set up agent skills");
    } else if (!fs.existsSync(claudeSkills)) {
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
  }
}
