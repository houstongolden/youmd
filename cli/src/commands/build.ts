import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { getLocalBundleDir, localBundleExists, readGlobalConfig, readLocalConfig, writeLocalConfig } from "../lib/config";
import { compileBundle, writeBundle } from "../lib/compiler";
import { BrailleSpinner } from "../lib/render";
import { computeContentHash } from "../lib/hash";

const BUILD_SPINNERS = [
  "assembling your identity context",
  "weaving your narrative thread",
  "crystallizing who you are",
  "forging your identity context",
  "encoding your context mosaic",
  "compiling your digital twin",
];

function randomBuildLabel(): string {
  return BUILD_SPINNERS[Math.floor(Math.random() * BUILD_SPINNERS.length)];
}

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

  // Check for empty profile/ directory — warn before compiling
  const profileDir = path.join(bundleDir, "profile");
  const profileFiles = fs.existsSync(profileDir)
    ? fs.readdirSync(profileDir).filter((f) => f.endsWith(".md"))
    : [];
  if (profileFiles.length === 0) {
    console.log("");
    console.log(chalk.yellow("  warning: profile/ directory is empty or missing"));
    console.log(chalk.dim("  run " + chalk.cyan("youmd pull") + " to fetch your profile, or add .md files to .youmd/profile/"));
    console.log("");
  }

  console.log("");
  console.log("  " + chalk.bold("you.md") + chalk.dim(" -- building identity context"));
  console.log("");

  // Show a personality spinner while compiling
  const spinner = new BrailleSpinner(randomBuildLabel());
  spinner.start();

  const result = compileBundle(bundleDir);

  // Brief pause for the spinner to feel real
  await new Promise((r) => setTimeout(r, 400));

  spinner.stop();

  // Print each file read, organized by directory
  const allDirs = ["profile", "preferences", "voice", "directives"];
  const totalSteps = result.filesRead.length + 3; // +3 for compile, generate, manifest
  let step = 0;

  for (const dir of allDirs) {
    const dirFiles = result.filesRead.filter((f) => f.type === dir || (dir === "preferences" && f.type === "preference") || (dir === "directives" && f.type === "directive"));
    for (const entry of dirFiles) {
      step++;
      const prefix = step < totalSteps ? "\u251C\u2500\u2500" : "\u2514\u2500\u2500";
      console.log(`  ${prefix} ${chalk.dim("reading")} ${dir}/${entry.file}`);
    }
  }

  // Also log any files from unexpected types
  for (const entry of result.filesRead) {
    if (!allDirs.includes(entry.type) && entry.type !== "preference" && entry.type !== "directive") {
      step++;
      const prefix = step < totalSteps ? "\u251C\u2500\u2500" : "\u2514\u2500\u2500";
      console.log(`  ${prefix} ${chalk.dim("reading")} ${entry.type}/${entry.file}`);
    }
  }

  // Compile step
  step++;
  console.log(`  ${step < totalSteps ? "\u251C\u2500\u2500" : "\u2514\u2500\u2500"} ${chalk.dim("compiling")} you.json ${chalk.dim("(nested format)")}`);

  // Generate step
  step++;
  console.log(`  ${step < totalSteps ? "\u251C\u2500\u2500" : "\u2514\u2500\u2500"} ${chalk.dim("generating")} you.md`);

  // Write manifest
  step++;
  console.log(`  \u2514\u2500\u2500 ${chalk.dim("writing")} manifest.json`);

  // Write output files
  writeBundle(bundleDir, result);

  // Compute and store the local content hash
  const youJsonPath = path.join(bundleDir, "you.json");
  const youMdPath = path.join(bundleDir, "you.md");
  if (fs.existsSync(youJsonPath)) {
    const youJson = JSON.parse(fs.readFileSync(youJsonPath, "utf-8"));
    const youMdContent = fs.existsSync(youMdPath) ? fs.readFileSync(youMdPath, "utf-8") : "";
    const localHash = computeContentHash(youJson, youMdContent);
    const localConfig = readLocalConfig() || { version: 1, sources: [] };
    localConfig.localContentHash = localHash;
    writeLocalConfig(localConfig);
  }

  // Use stats from compiler
  const { filledSections, totalSections, version, directories } = result.stats;

  const contentSize = fs.existsSync(youMdPath) ? fs.statSync(youMdPath).size : 0;
  const sizeLabel = contentSize > 1024
    ? (contentSize / 1024).toFixed(1) + " KB"
    : contentSize + " bytes";

  console.log("");
  console.log(
    "  " + chalk.green("\u2713") +
    " bundle compiled" +
    chalk.dim(` (v${version})`)
  );
  console.log(
    chalk.dim(`  ${filledSections}/${totalSections} sections filled, ${sizeLabel} total`)
  );
  if (directories.length > 0) {
    console.log(chalk.dim(`  directories: ${directories.join(", ")}`));
  }

  // Content-aware summary — shows what's actually in the bundle
  const yj = result.youJson as Record<string, unknown>;
  const summaryParts: string[] = [];
  const identity = yj.identity as Record<string, unknown> | undefined;
  if (identity?.name) summaryParts.push(chalk.hex("#C46A3A")(String(identity.name)));
  const projects = yj.projects as unknown[] | undefined;
  if (projects?.length) summaryParts.push(`${projects.length} project${projects.length === 1 ? "" : "s"}`);
  const values = yj.values as unknown[] | undefined;
  if (values?.length) summaryParts.push(`${values.length} value${values.length === 1 ? "" : "s"}`);
  const links = yj.links as Record<string, unknown> | undefined;
  if (links && Object.keys(links).length > 0) summaryParts.push(`${Object.keys(links).length} link${Object.keys(links).length === 1 ? "" : "s"}`);
  const voice = yj.voice as Record<string, unknown> | undefined;
  if (voice?.overall) summaryParts.push("voice");
  const ad = yj.agent_directives as Record<string, unknown> | undefined;
  if (ad?.communication_style || (ad?.negative_prompts as unknown[])?.length) summaryParts.push("directives");
  if (summaryParts.length > 0) {
    console.log(chalk.dim(`  ${summaryParts.join(chalk.dim(" / "))}`));
  }
  console.log("");

  if (isFirstBuild) {
    const config = readGlobalConfig();
    const name = config.username || "friend";
    console.log("  " + chalk.bold(`welcome to the agent internet, ${name}.`));
    console.log("");
  }
}
