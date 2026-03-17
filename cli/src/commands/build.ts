import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { getLocalBundleDir, localBundleExists, readGlobalConfig } from "../lib/config";
import { compileBundle, writeBundle } from "../lib/compiler";
import { randomThinking, Spinner } from "../lib/onboarding";

export async function buildCommand(): Promise<void> {
  if (!localBundleExists()) {
    console.log("");
    console.log(chalk.yellow("  no .youmd/ directory found"));
    console.log("");
    console.log("  run " + chalk.cyan("youmd init") + " to create one.");
    console.log("");
    return;
  }

  const bundleDir = getLocalBundleDir();

  // Detect if this is the first build (no manifest.json yet)
  const isFirstBuild = !fs.existsSync(path.join(bundleDir, "manifest.json"));

  console.log("");
  console.log("  " + chalk.bold("you.md") + chalk.dim(" -- building identity bundle"));
  console.log("");

  // Show a thinking phrase while compiling
  const spinner = new Spinner(randomThinking());
  spinner.start();

  const result = compileBundle(bundleDir);

  // Brief pause for the spinner to feel real
  await new Promise((r) => setTimeout(r, 400));

  spinner.stop();

  // Print each file read
  const totalSteps = result.filesRead.length + 3; // +3 for compile, generate, manifest
  let step = 0;

  for (const entry of result.filesRead) {
    step++;
    const prefix = step < totalSteps ? "\u251C\u2500\u2500" : "\u2514\u2500\u2500";
    const dir = entry.type === "profile" ? "profile" : "preferences";
    console.log(`  ${prefix} ${chalk.dim("reading")} ${dir}/${entry.file}`);
  }

  // Compile step
  step++;
  console.log(`  ${step < totalSteps ? "\u251C\u2500\u2500" : "\u2514\u2500\u2500"} ${chalk.dim("compiling")} you.json`);

  // Generate step
  step++;
  console.log(`  ${step < totalSteps ? "\u251C\u2500\u2500" : "\u2514\u2500\u2500"} ${chalk.dim("generating")} you.md`);

  // Write manifest
  step++;
  console.log(`  \u2514\u2500\u2500 ${chalk.dim("writing")} manifest.json`);

  // Write output files
  writeBundle(bundleDir, result);

  // Calculate summary stats
  const filledSections = result.bundle.profile.filter(
    (s) => s.content.split("\n").filter((l) => l.trim() && !l.startsWith("<!--")).length > 0
  ).length + result.bundle.preferences.filter(
    (s) => s.content.split("\n").filter((l) => l.trim() && !l.startsWith("<!--")).length > 0
  ).length;
  const totalSections = result.bundle.profile.length + result.bundle.preferences.length;

  const youMdPath = path.join(bundleDir, "you.md");
  const contentSize = fs.existsSync(youMdPath) ? fs.statSync(youMdPath).size : 0;
  const sizeLabel = contentSize > 1024
    ? (contentSize / 1024).toFixed(1) + " KB"
    : contentSize + " bytes";

  console.log("");
  console.log(
    "  " + chalk.green("\u2713") +
    " bundle compiled" +
    chalk.dim(` (v${result.bundle.version})`)
  );
  console.log(
    chalk.dim(`  ${filledSections}/${totalSections} sections filled, ${sizeLabel} total`)
  );
  console.log("");

  if (isFirstBuild) {
    const config = readGlobalConfig();
    const name = config.username || "friend";
    console.log("  " + chalk.bold(`welcome to the agent internet, ${name}.`));
    console.log("");
  }
}
