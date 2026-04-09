import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import {
  getLocalBundleDir,
  localBundleExists,
  isAuthenticated,
  readGlobalConfig,
  readLocalConfig,
  writeLocalConfig,
} from "../lib/config";
import { uploadBundle, publishLatest, getMe } from "../lib/api";
import { getConvexSiteUrl } from "../lib/config";
import { Spinner } from "../lib/onboarding";
import { computeContentHash, shortHash } from "../lib/hash";

export async function publishCommand(): Promise<void> {
  console.log("");

  if (!isAuthenticated()) {
    console.log(chalk.yellow("not authenticated"));
    console.log("");
    console.log("Run " + chalk.cyan("youmd login") + " to authenticate first.");
    console.log("");
    return;
  }

  if (!localBundleExists()) {
    console.log(chalk.yellow("no .youmd/ directory found"));
    console.log("");
    console.log("Run " + chalk.cyan("youmd init") + " to create one.");
    console.log("");
    return;
  }

  const bundleDir = getLocalBundleDir();
  const youJsonPath = path.join(bundleDir, "you.json");
  const youMdPath = path.join(bundleDir, "you.md");
  const manifestPath = path.join(bundleDir, "manifest.json");

  if (!fs.existsSync(youJsonPath)) {
    console.log(
      chalk.yellow("no you.json found -- run ") +
        chalk.cyan("youmd build") +
        chalk.yellow(" first")
    );
    console.log("");
    return;
  }

  const config = readGlobalConfig();

  console.log("  " + chalk.bold("you.md") + chalk.dim(" -- publishing bundle"));
  console.log("");

  // Read the bundle files
  const youJson = JSON.parse(fs.readFileSync(youJsonPath, "utf-8"));
  const youMd = fs.existsSync(youMdPath)
    ? fs.readFileSync(youMdPath, "utf-8")
    : "";
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, "utf-8"))
    : { version: youJson.version || 1, entries: [] };

  console.log("  \u251C\u2500\u2500 " + chalk.dim("reading") + " you.json (v" + (manifest.version || youJson.version || "?") + ")");
  console.log("  \u251C\u2500\u2500 " + chalk.dim("reading") + " you.md (" + youMd.length + " bytes)");
  console.log("  \u251C\u2500\u2500 " + chalk.dim("reading") + " manifest.json");

  // Hash-based ancestry check — prevent overwriting diverged remote
  const localHash = computeContentHash(youJson, youMd);
  const localConfig = readLocalConfig();
  const parentHash = localConfig?.lastPulledHash;
  const isForced = process.argv.includes("--force") || process.argv.includes("-f");

  let remoteHash: string | undefined;
  let remoteVersion = 0;

  try {
    const meRes = await getMe();
    if (meRes.ok) {
      remoteVersion = meRes.data.publishedBundle?.version || meRes.data.latestBundle?.version || 0;
      remoteHash = meRes.data.latestBundle?.contentHash;

      // If remote has a hash and it differs from our last-pulled hash, remote has changed
      if (remoteHash && parentHash && remoteHash !== parentHash && !isForced) {
        console.log("");
        console.log(chalk.yellow("  remote has changed since your last pull."));
        console.log("");
        console.log(chalk.dim("    local:  ") + chalk.cyan(shortHash(localHash)));
        console.log(chalk.dim("    remote: ") + chalk.cyan(shortHash(remoteHash)) + chalk.dim(` (v${remoteVersion})`));
        console.log("");
        console.log(chalk.dim("  run ") + chalk.cyan("youmd pull") + chalk.dim(" first, then publish."));
        console.log(chalk.dim("  or: ") + chalk.cyan("youmd publish --force") + chalk.dim(" to override."));
        console.log("");
        return;
      }

      if (isForced && remoteHash && parentHash && remoteHash !== parentHash) {
        console.log(chalk.yellow("  --force detected, overriding remote changes..."));
      }

      // Save the remote version we checked against
      if (localConfig) {
        localConfig.lastKnownRemoteVersion = remoteVersion;
        writeLocalConfig(localConfig);
      }
    }
  } catch {
    // Network error — proceed but warn
    console.log(chalk.dim("  could not check remote version — proceeding"));
  }

  // Upload the bundle with a thinking spinner
  const spinner = new Spinner("beaming you up to the agent internet");
  spinner.start();

  try {
    const uploadRes = await uploadBundle({
      manifest,
      youJson,
      youMd,
      parentHash,
    });

    if (uploadRes.status === 409) {
      spinner.stop();
      const errData = uploadRes.data as any;
      console.log("");
      console.log(chalk.yellow("  remote has changed since your last pull."));
      console.log("");
      console.log(chalk.dim("    local:  ") + chalk.cyan(shortHash(localHash)));
      console.log(chalk.dim("    remote: ") + chalk.cyan(shortHash(errData?.remoteHash || "unknown")) + chalk.dim(` (v${errData?.remoteVersion || "?"})`));
      console.log("");
      console.log(chalk.dim("  run ") + chalk.cyan("youmd pull") + chalk.dim(" first, then publish."));
      console.log(chalk.dim("  or: ") + chalk.cyan("youmd publish --force") + chalk.dim(" to override."));
      console.log("");
      return;
    }

    if (!uploadRes.ok) {
      spinner.stop();
      const errData = uploadRes.data as any;
      console.log("");
      console.log(
        chalk.red("  upload failed") +
          " -- " +
          (errData?.error || `status ${uploadRes.status}`)
      );
      console.log("");
      return;
    }

    // Update local config with hash tracking
    if (localConfig) {
      localConfig.lastPushedHash = localHash;
      localConfig.lastPulledHash = localHash;
      localConfig.localContentHash = localHash;
      writeLocalConfig(localConfig);
    }

    // Publish the latest bundle
    const pubRes = await publishLatest();

    spinner.stop();

    if (!pubRes.ok) {
      const errData = pubRes.data as any;
      console.log("");
      console.log(
        chalk.red("  publish failed") +
          " -- " +
          (errData?.error || `status ${pubRes.status}`)
      );
      console.log("");
      return;
    }

    const result = pubRes.data;

    // Update local config with publish timestamp
    const lc = readLocalConfig();
    if (lc) {
      lc.lastPublished = new Date().toISOString();
      writeLocalConfig(lc);
    }

    const liveUrl =
      result.url || `https://you.md/${result.username}`;

    console.log("");
    console.log(
      "  " + chalk.green("\u2713") +
        " published v" +
        result.version +
        " as " +
        chalk.bold(result.username)
    );
    console.log("");
    console.log("  " + chalk.bold("you are live on the agent internet."));
    console.log("");
    console.log("  \u250C" + "\u2500".repeat(liveUrl.length + 4) + "\u2510");
    console.log("  \u2502  " + chalk.cyan.bold(liveUrl) + "  \u2502");
    console.log("  \u2514" + "\u2500".repeat(liveUrl.length + 4) + "\u2518");
    console.log("");
    console.log(
      chalk.dim("  api:  ") +
        chalk.cyan(
          `${getConvexSiteUrl()}/api/v1/profiles?username=${result.username}`
        )
    );
    console.log("");
    console.log(
      chalk.dim("  share your identity: ") +
        chalk.cyan("youmd link create")
    );
    console.log("");
  } catch (err) {
    spinner.stop();
    console.log("");
    console.log(chalk.red("  error") + " -- failed to publish bundle");
    if (err instanceof Error) {
      console.log("  " + err.message);
    }
    console.log("");
  }
}
