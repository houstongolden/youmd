import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { readGlobalConfig, readLocalConfig, getLocalBundleDir, localBundleExists } from "../lib/config";
import { getMe } from "../lib/api";
import { pushCommand } from "./push";
import { pullCommand, detectLocalDirtyState } from "./pull";
import { syncAllSkills } from "../lib/skills";
import { readSkillCatalog } from "../lib/skill-catalog";

export async function syncCommand(options: { watch?: boolean; force?: boolean }) {
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
    // One-shot sync — state-aware ordering so we never clobber edits:
    //   local dirty + remote unchanged → push first, then pull
    //   clean local                    → pull, then push
    //   both changed                   → conflict; stop with guidance
    console.log(chalk.dim("  syncing with you.md..."));
    console.log("");

    const bundleDir = getLocalBundleDir();
    const dirtyState = localBundleExists()
      ? detectLocalDirtyState(bundleDir)
      : { dirty: false, hasBaseline: false };

    let remoteChanged = false;
    const localConfig = readLocalConfig();
    if (dirtyState.dirty) {
      try {
        const meRes = await getMe();
        if (meRes.ok) {
          const remoteHash = meRes.data.latestBundle?.contentHash;
          if (remoteHash && localConfig?.lastPulledHash && remoteHash !== localConfig.lastPulledHash) {
            remoteChanged = true;
          }
        }
      } catch {
        // Network error — push's own divergence guard still protects remote
      }
    }

    if (dirtyState.dirty && remoteChanged && !options.force) {
      console.log(chalk.hex("#C46A3A")("  conflict: local edits and remote changes both exist."));
      console.log(chalk.dim("  review with ") + chalk.cyan("youmd diff") + chalk.dim(", then either:"));
      console.log("    " + chalk.cyan("youmd push --force") + chalk.dim("  keep local (overwrite remote)"));
      console.log("    " + chalk.cyan("youmd pull --force") + chalk.dim("  keep remote (overwrite local)"));
      process.exitCode = 1;
      return;
    }

    if (dirtyState.dirty && !remoteChanged) {
      // Local edits, remote unchanged — push first so pull can't destroy them
      console.log(chalk.dim("  local edits detected — pushing first..."));
      console.log(chalk.dim("  ── push ──"));
      await pushCommand({ publish: true, force: options.force });

      console.log("");
      console.log(chalk.dim("  ── pull ──"));
      await pullCommand({ force: options.force });
    } else {
      // Clean local (or --force) — pull then push
      console.log(chalk.dim("  ── pull ──"));
      const pullResult = await pullCommand({ force: options.force });
      if (pullResult === "dirty" || pullResult === "auth-required") {
        console.log("");
        console.log(chalk.hex("#C46A3A")("  sync aborted: pull refused."));
        return;
      }
      // "no-remote" falls through — first sync still pushes the local bundle

      console.log("");
      console.log(chalk.dim("  ── push ──"));
      await pushCommand({ publish: true, force: options.force });
    }

    console.log("");
    console.log(chalk.green("  sync complete."));
    console.log(chalk.dim("  tip: use --watch for auto-sync on file changes"));
  }
}
