import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { resolveActiveBundleDir } from "../lib/config";
import { compileBundle, writeBundle } from "../lib/compiler";

interface ExportOptions {
  json?: boolean;
  md?: boolean;
  output?: string;
}

export async function exportCommand(options: ExportOptions): Promise<void> {
  console.log("");

  const bundleDir = resolveActiveBundleDir();

  if (!bundleDir) {
    console.log(chalk.yellow("  no active bundle found"));
    console.log("");
    console.log("  run " + chalk.cyan("youmd init") + " to create one.");
    console.log("");
    return;
  }

  // Check if compiled artifacts exist, compile if not
  const youJsonPath = path.join(bundleDir, "you.json");
  const youMdPath = path.join(bundleDir, "you.md");

  if (!fs.existsSync(youJsonPath) || !fs.existsSync(youMdPath)) {
    console.log(chalk.dim("  bundle not compiled -- compiling now..."));
    const result = compileBundle(bundleDir);
    writeBundle(bundleDir, result);
    console.log(chalk.dim(`  compiled bundle v${result.stats.version}`));
    console.log("");
  }

  // Determine output directory
  const outputDir = options.output
    ? path.resolve(process.cwd(), options.output)
    : process.cwd();

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Determine what to export
  const exportJson = options.json || (!options.json && !options.md);
  const exportMd = options.md || (!options.json && !options.md);

  const exported: string[] = [];

  if (exportJson) {
    const source = fs.readFileSync(youJsonPath, "utf-8");
    const dest = path.join(outputDir, "you.json");
    fs.writeFileSync(dest, source);
    exported.push(dest);
  }

  if (exportMd) {
    const source = fs.readFileSync(youMdPath, "utf-8");
    const dest = path.join(outputDir, "you.md");
    fs.writeFileSync(dest, source);
    exported.push(dest);
  }

  // Report success
  console.log(chalk.green("  exported"));
  console.log("");
  for (const file of exported) {
    console.log("  " + chalk.dim(file));
  }
  console.log("");
}
