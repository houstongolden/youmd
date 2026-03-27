import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { readGlobalConfig, getLocalBundleDir, localBundleExists } from "../lib/config";
import { pushCommand } from "./push";
import { pullCommand } from "./pull";
import { syncAllSkills } from "../lib/skills";
import { readSkillCatalog } from "../lib/skill-catalog";

export async function syncCommand(options: { watch?: boolean }) {
  const config = readGlobalConfig();

  if (!config.token) {
    console.log(chalk.hex("#C46A3A")("  not authenticated. run: youmd login"));
    return;
  }

  if (options.watch) {
    // Watch mode — auto-push on file changes
    if (!localBundleExists()) {
      console.log(chalk.hex("#C46A3A")("  no local bundle found. run: youmd pull"));
      return;
    }

    const bundleDir = getLocalBundleDir();
    const profileDir = path.join(bundleDir, "profile");
    const prefsDir = path.join(bundleDir, "preferences");
    const voiceDir = path.join(bundleDir, "voice");

    const watchDirs = [profileDir, prefsDir, voiceDir].filter((d) =>
      fs.existsSync(d)
    );

    if (watchDirs.length === 0) {
      console.log(chalk.hex("#C46A3A")("  no directories to watch."));
      return;
    }

    console.log(chalk.dim("  watching for changes..."));
    console.log(
      chalk.dim(
        `  directories: ${watchDirs.map((d) => path.relative(process.cwd(), d)).join(", ")}`
      )
    );
    console.log(chalk.dim("  press ctrl+c to stop"));
    console.log("");

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    for (const dir of watchDirs) {
      fs.watch(dir, { recursive: true }, (eventType, filename) => {
        if (!filename || filename.startsWith(".")) return;
        if (!filename.endsWith(".md")) return;

        // Debounce — wait 1s after last change before pushing
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          console.log(
            chalk.dim(`  change detected: ${filename}`)
          );
          await pushCommand({ publish: true });

          // Also re-interpolate installed skills on identity changes
          const catalog = readSkillCatalog();
          const installedCount = catalog.skills.filter((s) => s.installed).length;
          if (installedCount > 0) {
            const syncResult = syncAllSkills();
            if (syncResult.synced.length > 0) {
              console.log(
                chalk.green("  \u2713") +
                chalk.dim(` ${syncResult.synced.length} skills re-interpolated`)
              );
            }
          }

          console.log(chalk.dim("  watching for changes..."));
        }, 1000);
      });
    }

    // Keep the process alive
    await new Promise(() => {});
  } else {
    // One-shot sync: pull then push
    console.log(chalk.dim("  syncing with you.md..."));
    console.log("");

    console.log(chalk.dim("  ── pull ──"));
    await pullCommand();

    console.log("");
    console.log(chalk.dim("  ── push ──"));
    await pushCommand({ publish: true });

    console.log("");
    console.log(chalk.green("  sync complete."));
    console.log(chalk.dim("  tip: use --watch for auto-sync on file changes"));
  }
}
