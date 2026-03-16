import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { getLocalBundleDir, writeLocalConfig } from "../lib/config";

const PROFILE_FILES = [
  "about.md",
  "now.md",
  "projects.md",
  "values.md",
  "links.md",
];

const PREFERENCE_FILES = [
  "agent.md",
  "writing.md",
];

export function initCommand(): void {
  const bundleDir = getLocalBundleDir();

  if (fs.existsSync(bundleDir)) {
    console.log(chalk.yellow("warning: .youmd/ directory already exists"));
    return;
  }

  console.log("");
  console.log("you.md -- initializing identity bundle");
  console.log("");

  // Create directory structure
  const profileDir = path.join(bundleDir, "profile");
  const preferencesDir = path.join(bundleDir, "preferences");

  fs.mkdirSync(profileDir, { recursive: true });
  fs.mkdirSync(preferencesDir, { recursive: true });

  console.log("  .youmd/");

  // Create empty profile files
  for (const file of PROFILE_FILES) {
    const filePath = path.join(profileDir, file);
    const slug = path.basename(file, ".md");
    const title = slug.charAt(0).toUpperCase() + slug.slice(1);
    fs.writeFileSync(filePath, `---\ntitle: "${title}"\n---\n\n`);
  }
  console.log("  ├── profile/");
  for (let i = 0; i < PROFILE_FILES.length; i++) {
    const connector = i === PROFILE_FILES.length - 1 ? "└──" : "├──";
    console.log(`  │   ${connector} ${PROFILE_FILES[i]}`);
  }

  // Create empty preference files
  for (const file of PREFERENCE_FILES) {
    const filePath = path.join(preferencesDir, file);
    const slug = path.basename(file, ".md");
    const title = slug.charAt(0).toUpperCase() + slug.slice(1);
    fs.writeFileSync(filePath, `---\ntitle: "${title}"\n---\n\n`);
  }
  console.log("  ├── preferences/");
  for (let i = 0; i < PREFERENCE_FILES.length; i++) {
    const connector = i === PREFERENCE_FILES.length - 1 ? "└──" : "├──";
    console.log(`  │   ${connector} ${PREFERENCE_FILES[i]}`);
  }

  // Create empty you.json
  fs.writeFileSync(
    path.join(bundleDir, "you.json"),
    JSON.stringify({ version: 0, profile: [], preferences: [] }, null, 2) + "\n"
  );
  console.log("  ├── you.json");

  // Create empty you.md
  fs.writeFileSync(path.join(bundleDir, "you.md"), "");
  console.log("  ├── you.md");

  // Create manifest
  fs.writeFileSync(
    path.join(bundleDir, "manifest.json"),
    JSON.stringify({ version: 0, entries: [] }, null, 2) + "\n"
  );
  console.log("  └── manifest.json");

  // Write local config
  writeLocalConfig({
    version: 0,
    sources: [],
  });

  console.log("");
  console.log(chalk.green("done") + " -- edit files in .youmd/profile/ and .youmd/preferences/ then run " + chalk.cyan("youmd build"));
  console.log("");
}
