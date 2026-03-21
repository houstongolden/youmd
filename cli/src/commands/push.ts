import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { readGlobalConfig, getLocalBundleDir, localBundleExists } from "../lib/config";
import { compileBundle, writeBundle } from "../lib/compiler";
import { uploadBundle, publishLatest } from "../lib/api";

export async function pushCommand(options: { publish?: boolean }) {
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

  // Step 2: Upload to Convex
  console.log(chalk.dim("  pushing to you.md..."));

  try {
    const uploadResult = await uploadBundle({
      manifest,
      youJson,
      youMd,
    });

    if (!uploadResult.ok) {
      console.log(
        chalk.hex("#C46A3A")(`  push failed: ${JSON.stringify(uploadResult.data)}`)
      );
      return;
    }

    console.log(
      chalk.green("  ✓") +
        chalk.dim(` bundle uploaded (v${(uploadResult.data as any)?.version || "?"})`)
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

    console.log("");
    console.log(chalk.green("  push complete."));
  } catch (err) {
    console.log(
      chalk.hex("#C46A3A")(
        `  push failed: ${err instanceof Error ? err.message : String(err)}`
      )
    );
  }
}
