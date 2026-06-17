import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import {
  readGlobalConfig,
  readBundleConfig,
  writeBundleConfig,
  resolveSyncBundleDir,
  bundleResolutionNotice,
  bundleLooksInitialized,
} from "../lib/config";
import { getMe } from "../lib/api";
import { pushCommand } from "./push";
import { pullCommand, detectLocalDirtyState, stableContentHash } from "./pull";
import { syncAllSkills } from "../lib/skills";
import { readSkillCatalog } from "../lib/skill-catalog";
import { compileBundle } from "../lib/compiler";
import { decompileToFilesystem } from "../lib/decompile";
import { mergeSections, decisionLabel } from "../lib/merge";
import { BrailleSpinner } from "../lib/render";

export async function syncCommand(options: { watch?: boolean; force?: boolean; local?: boolean; daemon?: boolean }) {
  const config = readGlobalConfig();

  if (!config.token) {
    console.log(chalk.hex("#C46A3A")("  not authenticated. run: youmd login"));
    return;
  }

  // T7 — home-first: sync operates on ~/.youmd unless --local or a
  // deliberate youmd.local.json marker targets the project-local bundle.
  const resolution = resolveSyncBundleDir({ local: options.local });
  const bundleDir = resolution.dir;
  const notice = bundleResolutionNotice(resolution);
  if (notice) console.log(chalk.dim(`  ${notice}`));

  if (options.watch) {
    // Watch mode — auto-push on file changes
    if (!bundleLooksInitialized(bundleDir)) {
      console.log(chalk.hex("#C46A3A")(`  no bundle found at ${bundleDir}. run: youmd pull`));
      return;
    }
    // Each bundle directory decompile writes (and the compiler reads) is
    // flat, so we watch every relevant subdirectory explicitly instead of
    // using { recursive: true } — which throws on Linux with Node 18.
    const profileDir = path.join(bundleDir, "profile");
    const prefsDir = path.join(bundleDir, "preferences");
    const voiceDir = path.join(bundleDir, "voice");
    const directivesDir = path.join(bundleDir, "directives");

    const watchDirs = [profileDir, prefsDir, voiceDir, directivesDir].filter(
      (d) => fs.existsSync(d)
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
      fs.watch(dir, (eventType, filename) => {
        if (!filename || filename.startsWith(".")) return;
        if (!filename.endsWith(".md")) return;

        // Debounce — wait 1s after last change before pushing
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          console.log(
            chalk.dim(`  change detected: ${filename}`)
          );
          await pushCommand({ publish: true, local: options.local });

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

    const dirtyState = fs.existsSync(bundleDir)
      ? detectLocalDirtyState(bundleDir)
      : { dirty: false, hasBaseline: false };

    let remoteChanged = false;
    let remoteBundle: {
      youJson?: unknown;
      youMd?: string;
      contentHash?: string;
    } | null = null;
    const localConfig = readBundleConfig(bundleDir);
    if (dirtyState.dirty) {
      try {
        const meRes = await getMe();
        if (meRes.ok) {
          const remoteHash = meRes.data.latestBundle?.contentHash;
          if (remoteHash && localConfig?.lastPulledHash && remoteHash !== localConfig.lastPulledHash) {
            remoteChanged = true;
            remoteBundle = meRes.data.latestBundle;
          }
        }
      } catch {
        // Network error — push's own divergence guard still protects remote
      }
    }

    if (dirtyState.dirty && remoteChanged && !options.force) {
      // Both sides changed — attempt a per-section 3-way merge against the
      // base bundle snapshot saved by the last pull (base.json).
      const mergeOutcome = await attemptThreeWayMergeSync(bundleDir, remoteBundle);
      if (mergeOutcome === "merged") {
        console.log("");
        console.log(chalk.dim("  ── push ──"));
        await pushCommand({ publish: true, local: options.local });
        console.log("");
        console.log(chalk.green("  sync complete."));
        console.log(chalk.dim("  merged local + remote changes per section."));
        return;
      }
      if (mergeOutcome === "conflict") {
        // attemptThreeWayMergeSync already printed the conflicting sections.
        process.exitCode = 1;
        return;
      }
      // "unavailable" — no usable base/remote snapshot; fall back to the
      // guard-and-refuse behavior so nothing gets clobbered.
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
      const pushResult = await pushCommand({
        publish: true,
        force: options.force,
        local: options.local,
        daemon: options.daemon,
      });
      if (options.daemon && pushResult === "size-regression") {
        console.log("");
        console.log(chalk.green("  sync complete."));
        console.log(chalk.dim("  daemon refreshed local identity and skills; remote upload skipped to preserve richer server data."));
        return;
      }

      console.log("");
      console.log(chalk.dim("  ── pull ──"));
      await pullCommand({ force: options.force, local: options.local });
    } else {
      // Clean local (or --force) — pull then push
      console.log(chalk.dim("  ── pull ──"));
      const pullResult = await pullCommand({ force: options.force, local: options.local });
      if (pullResult === "dirty" || pullResult === "auth-required") {
        console.log("");
        console.log(chalk.hex("#C46A3A")("  sync aborted: pull refused."));
        return;
      }
      // "no-remote" falls through — first sync still pushes the local bundle

      if (pullResult === "ok" && !options.force) {
        const remoteAhead = await detectRemoteAheadOfPulledBundle(bundleDir);
        if (remoteAhead) {
          console.log("");
          console.log(chalk.green("  sync complete."));
          console.log(chalk.dim("  hydrated local files and skills from you.md."));
          console.log(chalk.dim("  remote has a newer unpublished draft, so no push was attempted."));
          console.log(chalk.dim("  next: run ") + chalk.cyan("youmd status") + chalk.dim(" or ") + chalk.cyan("you") + chalk.dim(" to keep working."));
          return;
        }
      }

      console.log("");
      console.log(chalk.dim("  ── push ──"));
      const pushResult = await pushCommand({
        publish: true,
        force: options.force,
        local: options.local,
        daemon: options.daemon,
      });
      if (options.daemon && pushResult === "size-regression") {
        console.log("");
        console.log(chalk.green("  sync complete."));
        console.log(chalk.dim("  daemon refreshed local identity and skills; remote upload skipped to preserve richer server data."));
        return;
      }
    }

    console.log("");
    console.log(chalk.green("  sync complete."));
    console.log(chalk.dim("  tip: use --watch for auto-sync on file changes"));
  }
}

async function detectRemoteAheadOfPulledBundle(bundleDir: string): Promise<boolean> {
  const localConfig = readBundleConfig(bundleDir);
  const pulledHash = localConfig?.lastPulledHash;
  if (!pulledHash) return false;

  try {
    const meRes = await getMe();
    if (!meRes.ok) return false;
    const latestHash = meRes.data.latestBundle?.contentHash;
    return !!latestHash && latestHash !== pulledHash;
  } catch {
    return false;
  }
}

type MergeAttemptOutcome = "merged" | "conflict" | "unavailable";

/**
 * Attempt a per-section 3-way merge: base.json (saved by the last pull) vs
 * the compiled local bundle vs the remote latest bundle.
 *
 * Atomic — on any true conflict nothing is written and "conflict" is
 * returned with the conflicting sections printed. On a clean merge the
 * merged sections are written to disk, base.json is updated to the merged
 * result, and the ancestry hashes are advanced so the subsequent push passes
 * its divergence guard (the remote content is now part of our lineage).
 *
 * Returns "unavailable" when there is no usable base snapshot, remote
 * bundle, or compilable local bundle — the caller falls back to the
 * guard-and-refuse conflict stop.
 */
export async function attemptThreeWayMergeSync(
  bundleDir: string,
  remoteBundle: { youJson?: unknown; youMd?: string; contentHash?: string } | null,
): Promise<MergeAttemptOutcome> {
  const remoteYouJson = remoteBundle?.youJson as Record<string, unknown> | undefined;
  if (!remoteYouJson || typeof remoteYouJson !== "object") return "unavailable";

  // Base snapshot — the common ancestor saved by the last pull
  const baseJsonPath = path.join(bundleDir, "base.json");
  let baseJson: Record<string, unknown> | null = null;
  try {
    if (fs.existsSync(baseJsonPath)) {
      baseJson = JSON.parse(fs.readFileSync(baseJsonPath, "utf-8"));
    }
  } catch {
    // corrupt base — can't 3-way merge safely
  }
  if (!baseJson || typeof baseJson !== "object") return "unavailable";

  // Local side — compile the bundle from the local markdown files
  let localYouJson: Record<string, unknown> | null = null;
  try {
    const compiled = compileBundle(bundleDir);
    if (compiled) localYouJson = compiled.youJson;
  } catch {
    // broken local bundle — don't merge on top of it
  }
  if (!localYouJson) return "unavailable";

  console.log(chalk.dim("  local and remote both changed — attempting 3-way merge..."));

  const result = mergeSections(baseJson, localYouJson, remoteYouJson);

  if (!result.clean) {
    console.log("");
    console.log(
      chalk.hex("#C46A3A")(
        `  merge conflict: ${result.conflicts.length} section${result.conflicts.length === 1 ? "" : "s"} changed both locally and remotely:`
      )
    );
    for (const section of result.conflicts) {
      console.log("    " + chalk.hex("#C46A3A")("✗") + " " + section);
    }
    console.log("");
    console.log(chalk.dim("  nothing was written. resolve by choosing a side:"));
    console.log("    " + chalk.cyan("youmd pull --force") + chalk.dim("  take remote (overwrite local)"));
    console.log("    " + chalk.cyan("youmd push --force") + chalk.dim("  keep local (overwrite remote)"));
    return "conflict";
  }

  // Clean merge — report per-section decisions (skip untouched sections)
  for (const s of result.sections) {
    if (s.decision === "unchanged") continue;
    console.log(chalk.green("  ✓") + chalk.dim(` ${s.section}: ${decisionLabel(s.decision)}`));
  }

  // Apply atomically: every section merged cleanly, so write everything
  const spinner = new BrailleSpinner("applying merged sections...");
  spinner.start();
  try {
    decompileToFilesystem(bundleDir, result.merged);
    fs.writeFileSync(path.join(bundleDir, "you.json"), JSON.stringify(result.merged, null, 2));
    // base.json advances to the merged result — the new common ancestor
    fs.writeFileSync(baseJsonPath, JSON.stringify(result.merged, null, 2));

    // Advance ancestry so push accepts the merge:
    //   lastPulledHash → the remote hash we just incorporated
    //   lastPulledStableHash → dirty-check baseline of what's now on disk
    const lc = readBundleConfig(bundleDir) || { version: 1, sources: [] };
    if (remoteBundle?.contentHash) {
      lc.lastPulledHash = remoteBundle.contentHash;
    }
    try {
      const compiledAfter = compileBundle(bundleDir);
      if (compiledAfter) {
        lc.lastPulledStableHash = stableContentHash(compiledAfter.youJson, compiledAfter.markdown);
      }
    } catch {
      // non-fatal — without a baseline the dirty check stays inert
    }
    writeBundleConfig(bundleDir, lc);
    spinner.stop(`${result.sections.filter((s) => s.decision !== "unchanged").length} sections merged`);
  } catch (err) {
    spinner.fail(err instanceof Error ? err.message : String(err));
    return "unavailable";
  }

  return "merged";
}
