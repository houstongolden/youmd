import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { getLocalBundleDir, localBundleExists, readLocalConfig, isAuthenticated } from "../lib/config";

export function statusCommand(): void {
  console.log("");
  console.log("you.md -- status");
  console.log("");

  // Check authentication
  const authed = isAuthenticated();
  console.log("  auth:    " + (authed ? chalk.green("authenticated") : chalk.yellow("not authenticated")));

  // Check local bundle
  const hasBundle = localBundleExists();
  console.log("  bundle:  " + (hasBundle ? chalk.green("initialized") : chalk.yellow("not initialized")));

  if (!hasBundle) {
    console.log("");
    console.log("Run " + chalk.cyan("youmd init") + " to create a local bundle.");
    console.log("");
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

  console.log("  files:   " + profileCount + " profile, " + prefsCount + " preferences");
  console.log("");
}
