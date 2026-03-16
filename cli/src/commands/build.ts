import chalk from "chalk";
import { getLocalBundleDir, localBundleExists } from "../lib/config";
import { compileBundle, writeBundle } from "../lib/compiler";

export function buildCommand(): void {
  if (!localBundleExists()) {
    console.log("");
    console.log(chalk.yellow("no .youmd/ directory found"));
    console.log("");
    console.log("Run " + chalk.cyan("youmd init") + " to create one.");
    console.log("");
    return;
  }

  const bundleDir = getLocalBundleDir();

  console.log("");
  console.log("you.md -- building identity bundle");
  console.log("");

  const result = compileBundle(bundleDir);

  // Print each file read
  const totalSteps = result.filesRead.length + 3; // +3 for compile, generate, manifest
  let step = 0;

  for (const entry of result.filesRead) {
    step++;
    const prefix = step < totalSteps ? "\u251C\u2500\u2500" : "\u2514\u2500\u2500";
    const dir = entry.type === "profile" ? "profile" : "preferences";
    console.log(`${prefix} Reading ${dir}/${entry.file}`);
  }

  // Compile step
  step++;
  console.log(`${step < totalSteps ? "\u251C\u2500\u2500" : "\u2514\u2500\u2500"} Compiling you.json`);

  // Generate step
  step++;
  console.log(`${step < totalSteps ? "\u251C\u2500\u2500" : "\u2514\u2500\u2500"} Generating you.md`);

  // Write manifest
  step++;
  console.log(`\u2514\u2500\u2500 Writing manifest.json`);

  // Write output files
  writeBundle(bundleDir, result);

  console.log("");
  console.log(chalk.green("\u2713") + ` Bundle compiled (version ${result.bundle.version})`);
  console.log("");
}
