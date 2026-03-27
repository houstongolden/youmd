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
import { Spinner } from "../lib/onboarding";

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

  console.log("  \u251C\u2500\u2500 " + chalk.dim("reading") + " you.json (v" + (youJson.version || "?") + ")");
  console.log("  \u251C\u2500\u2500 " + chalk.dim("reading") + " you.md (" + youMd.length + " bytes)");
  console.log("  \u251C\u2500\u2500 " + chalk.dim("reading") + " manifest.json");

  // Safety check: compare local version against remote to prevent overwriting richer data
  const localVersion = youJson.version || 0;
  const localConfig = readLocalConfig();
  const lastKnownRemoteVersion = localConfig?.lastKnownRemoteVersion || 0;

  try {
    const meRes = await getMe();
    if (meRes.ok) {
      const remoteVersion = meRes.data.publishedBundle?.version || meRes.data.latestBundle?.version || 0;
      const remoteSize = JSON.stringify(meRes.data.latestBundle?.youJson || {}).length;
      const localSize = JSON.stringify(youJson).length;

      if (remoteVersion > lastKnownRemoteVersion && remoteSize > localSize * 1.5) {
        console.log("");
        console.log(chalk.yellow("  warning: remote bundle (v" + remoteVersion + ", " + remoteSize + " bytes) is larger than local (v" + localVersion + ", " + localSize + " bytes)"));
        console.log(chalk.yellow("  this may overwrite richer data from the web agent or other sources."));
        console.log("");
        console.log(chalk.dim("  to sync safely:"));
        console.log(chalk.cyan("    youmd pull") + chalk.dim("     -- download remote data first"));
        console.log(chalk.cyan("    youmd build") + chalk.dim("    -- rebuild from merged files"));
        console.log(chalk.cyan("    youmd publish") + chalk.dim("  -- then publish"));
        console.log("");
        console.log(chalk.dim("  to force publish anyway:"));
        console.log(chalk.cyan("    youmd publish --force"));
        console.log("");

        // Check if --force was used (via process.argv since Commander doesn't pass it here)
        if (!process.argv.includes("--force") && !process.argv.includes("-f")) {
          return;
        }
        console.log(chalk.yellow("  --force detected, proceeding..."));
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
    });

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
    const localConfig = readLocalConfig();
    if (localConfig) {
      localConfig.lastPublished = new Date().toISOString();
      writeLocalConfig(localConfig);
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
          `https://uncommon-chicken-142.convex.site/api/v1/profiles?username=${result.username}`
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
