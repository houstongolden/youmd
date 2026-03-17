import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import {
  getLocalBundleDir,
  localBundleExists,
  readLocalConfig,
  isAuthenticated,
  readGlobalConfig,
} from "../lib/config";
import { getMe } from "../lib/api";

export async function statusCommand(): Promise<void> {
  console.log("");
  console.log("you.md -- status");
  console.log("");

  // Check authentication
  const authed = isAuthenticated();
  console.log(
    "  auth:    " +
      (authed ? chalk.green("authenticated") : chalk.yellow("not authenticated"))
  );

  // Check local bundle
  const hasBundle = localBundleExists();
  console.log(
    "  bundle:  " +
      (hasBundle ? chalk.green("initialized") : chalk.yellow("not initialized"))
  );

  if (!hasBundle) {
    console.log("");
    console.log("Run " + chalk.cyan("youmd init") + " to create a local bundle.");
    console.log("");
    // Still show remote status if authenticated
    if (authed) {
      await showRemoteStatus();
    }
    return;
  }

  const bundleDir = getLocalBundleDir();

  // Check manifest for build status
  const manifestPath = path.join(bundleDir, "manifest.json");
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      if (manifest.version > 0) {
        console.log("  version: " + chalk.green("v" + manifest.version));
        console.log("  built:   " + manifest.generatedAt);
      } else {
        console.log("  version: " + chalk.yellow("not built"));
      }
    } catch {
      console.log("  version: " + chalk.yellow("unknown"));
    }
  }

  // Check local config for sources
  const localConfig = readLocalConfig();
  if (localConfig && localConfig.sources.length > 0) {
    console.log("  sources: " + localConfig.sources.length);
  } else {
    console.log("  sources: " + chalk.yellow("none"));
  }

  // Check publish status
  if (localConfig && localConfig.lastPublished) {
    console.log("  publish: " + localConfig.lastPublished);
  } else {
    console.log("  publish: " + chalk.yellow("never"));
  }

  // Count profile and preference files
  const profileDir = path.join(bundleDir, "profile");
  const prefsDir = path.join(bundleDir, "preferences");
  const profileCount = fs.existsSync(profileDir)
    ? fs.readdirSync(profileDir).filter((f) => f.endsWith(".md")).length
    : 0;
  const prefsCount = fs.existsSync(prefsDir)
    ? fs.readdirSync(prefsDir).filter((f) => f.endsWith(".md")).length
    : 0;

  console.log(
    "  files:   " + profileCount + " profile, " + prefsCount + " preferences"
  );

  // Remote status
  if (authed) {
    console.log("");
    await showRemoteStatus();
  } else {
    console.log("");
  }
}

async function showRemoteStatus(): Promise<void> {
  console.log("  " + chalk.dim("--- remote ---"));

  try {
    const res = await getMe();

    if (!res.ok) {
      console.log(
        "  remote:  " +
          chalk.yellow("could not fetch") +
          " (status " +
          res.status +
          ")"
      );
      console.log("");
      return;
    }

    const me = res.data;
    console.log("  user:    " + chalk.green(me.username));
    console.log("  bundles: " + me.bundleCount);

    if (me.publishedBundle) {
      console.log(
        "  live:    v" +
          me.publishedBundle.version +
          (me.publishedBundle.publishedAt
            ? " (published " +
              new Date(me.publishedBundle.publishedAt).toISOString() +
              ")"
            : "")
      );
    } else {
      console.log("  live:    " + chalk.yellow("nothing published"));
    }

    if (me.latestBundle && !me.latestBundle.isPublished) {
      console.log(
        "  draft:   v" +
          me.latestBundle.version +
          " (unpublished)"
      );
    }

    console.log(
      "  url:     " +
        chalk.cyan("https://you.md/" + me.username)
    );
    console.log("");
  } catch (err) {
    console.log(
      "  remote:  " +
        chalk.yellow("unreachable")
    );
    if (err instanceof Error) {
      console.log("  " + chalk.dim(err.message));
    }
    console.log("");
  }
}
