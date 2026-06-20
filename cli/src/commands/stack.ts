import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as child_process from "child_process";
import {
  listMaintainerProposals,
  setProposalDecision,
  listBrainConsent,
  setBrainConsent,
  apiErrorMessage,
  recordBrainActivity,
} from "../lib/api";
import { isAuthenticated } from "../lib/config";
import { detectShadowing } from "../lib/projectContext";
import { SkillDiscoveryCheck, verifySkillDiscovery } from "../lib/host-link";
import {
  getYouStackCapabilities,
  getYouStackReadiness,
  linkYouStackAdapters,
  loadYouStackManifest,
  routeYouStackRequest,
  runYouStackDoctor,
  runYouStackSmoke,
  YouStackCapability,
  YouStackValidationResult,
  runStackGuard,
} from "../lib/youstack";
import { resolveCapability } from "../lib/capability-router";
import {
  buildInitGoldenFile,
  goldenFilePath,
  evalResultsFilePath,
  readGoldenFile,
  runEval,
  writeEvalResults,
  writeGoldenFile,
} from "../lib/stackEval";
import { runStackImprove, type ImproveMode } from "../lib/stackImprove";
import { checkStackUpdate, applyStackUpdate } from "../lib/stackUpdate";
import { installStack } from "../lib/stackInstall";
import { getHeartbeatSignal } from "../lib/heartbeat";
import { YOUMD_DAEMONS, getDaemonHealth } from "../lib/daemon";

const ACCENT = chalk.hex("#C46A3A");
const DIM = chalk.dim;

interface StackCommandOptions {
  path?: string;
  json?: boolean;
  hosts?: string;
  target?: string;
  dryRun?: boolean;
  verify?: boolean;
  init?: boolean;
  mode?: string;
  apply?: boolean;
  force?: boolean;
  dir?: string;
}

function runGitText(repoDir: string, args: string[]): string | null {
  const result = child_process.spawnSync("git", ["-C", repoDir, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.status !== 0) return null;
  return String(result.stdout ?? "").trim();
}

function sharedAgentStackSnapshot() {
  const home = process.env.HOME || "";
  const root = path.join(home, ".agent-shared");
  const skillsRoot = path.join(root, "claude-skills");
  const skillNames = fs.existsSync(skillsRoot)
    ? fs.readdirSync(skillsRoot)
        .filter((name) => {
          try {
            return fs.statSync(path.join(skillsRoot, name)).isDirectory() &&
              fs.existsSync(path.join(skillsRoot, name, "SKILL.md"));
          } catch {
            return false;
          }
        })
        .sort()
    : [];
  const gitHead = fs.existsSync(path.join(root, ".git"))
    ? runGitText(root, ["rev-parse", "--short=12", "HEAD"])
    : null;
  const gitBranch = fs.existsSync(path.join(root, ".git"))
    ? runGitText(root, ["branch", "--show-current"])
    : null;
  const dirtyOutput = fs.existsSync(path.join(root, ".git"))
    ? runGitText(root, ["status", "--porcelain"])
    : null;

  return {
    rootExists: fs.existsSync(root),
    stackMapPresent: fs.existsSync(path.join(root, "STACK-MAP.md")),
    sharedSkillCount: skillNames.length,
    recentSharedSkills: skillNames.slice(-12),
    gitHead,
    gitBranch,
    dirty: Boolean(dirtyOutput),
  };
}

async function recordStackSyncActivity(options: {
  dryRun?: boolean;
  exitCode: number;
  scriptPath: string;
}): Promise<void> {
  if (!isAuthenticated()) return;

  try {
    const snapshot = sharedAgentStackSnapshot();
    await recordBrainActivity({
      activityId: `stack-sync:${os.hostname()}`,
      source: "stack-sync",
      channel: "skills",
      kind: options.exitCode === 0 ? "shared-stack-sync" : "warn",
      status: options.exitCode === 0 ? "ok" : "warn",
      title: options.exitCode === 0
        ? `${snapshot.sharedSkillCount} shared skills indexed`
        : "shared stack sync reported a warning",
      detail: options.dryRun
        ? "dry-run shared agent stack sync completed"
        : "canonical ~/.agent-shared skills/stacks synced across local agent hosts",
      entityType: "sharedAgentStack",
      entityId: "~/.agent-shared",
      sourceHost: os.hostname(),
      sourceAgent: "youmd CLI",
      sourceRuntime: process.version,
      metadata: {
        dryRun: Boolean(options.dryRun),
        exitCode: options.exitCode,
        script: path.basename(options.scriptPath),
        sharedSkillCount: snapshot.sharedSkillCount,
        recentSharedSkills: snapshot.recentSharedSkills,
        stackMapPresent: snapshot.stackMapPresent,
        rootExists: snapshot.rootExists,
        gitHead: snapshot.gitHead,
        gitBranch: snapshot.gitBranch,
        dirty: snapshot.dirty,
        canonicalSharedRoot: "~/.agent-shared/claude-skills",
        secretValuesExposed: false,
      },
    });
  } catch (err) {
    if (process.env.DEBUG) console.error(`[stack sync] brain activity failed: ${err}`);
  }
}

function printHelp(): void {
  console.log("");
  console.log("  " + chalk.bold("youmd stack") + DIM(" -- local YouStack manifest tools"));
  console.log("");
  console.log("  " + ACCENT("Commands"));
  console.log("    " + chalk.cyan("inspect") + DIM("              Show the local stack manifest summary"));
  console.log("    " + chalk.cyan("doctor") + DIM("               Run read-only stack health diagnostics"));
  console.log("    " + chalk.cyan("smoke") + DIM("                Run read-only local manifest/file checks"));
  console.log("    " + chalk.cyan("capabilities") + DIM("         List declared local capabilities"));
  console.log("    " + chalk.cyan("route \"...\"") + DIM("          Pick the best local capability for a request"));
  console.log("    " + chalk.cyan("link") + DIM("                 Generate host adapter files from the manifest"));
  console.log("    " + chalk.cyan("guard") + DIM("                Check safety contract (T0-T3) and capability consistency"));
  console.log("    " + chalk.cyan("eval") + DIM("                 Run golden-prompt eval suite (--init to scaffold)"));
  console.log("    " + chalk.cyan("improve") + DIM("              Gather signals + write proposals to journal/ (--mode propose|auto_pr)"));
  console.log("    " + chalk.cyan("update") + DIM("               Check for a newer upstream version (--apply to write it)"));
  console.log("    " + chalk.cyan("install <user>/<slug>") + DIM(" Install a public stack from the registry"));
  console.log("    " + chalk.cyan("proposals") + DIM("            List open maintainer proposals for your stacks"));
  console.log("    " + chalk.cyan("proposals approve <id>") + DIM(" Approve a maintainer proposal"));
  console.log("    " + chalk.cyan("proposals reject <id>") + DIM("  Reject a maintainer proposal"));
  console.log("    " + chalk.cyan("consent") + DIM("              Show your brainScope consent settings"));
  console.log("    " + chalk.cyan("consent grant <scope>") + DIM("  Grant a brainScope (consolidate|fleet_aggregate|journal_mine)"));
  console.log("    " + chalk.cyan("consent revoke <scope>") + DIM(" Revoke a brainScope"));
  console.log("    " + chalk.cyan("sync") + DIM("                 Sync agent skills/stacks across machines (--dry-run to preview)"));
  console.log("    " + chalk.cyan("context-sync") + DIM("         Sync per-project context files (conflict-safe, --dry-run to preview)"));
  console.log("    " + chalk.cyan("daemon install") + DIM("       Install resident identity, skillstack, and context sync daemons"));
  console.log("    " + chalk.cyan("daemon uninstall") + DIM("     Remove launchd daemon plists"));
  console.log("    " + chalk.cyan("daemon status") + DIM("        Show loaded/not-loaded state and recent daemon health"));
  console.log("");
  console.log("  " + DIM("Options: ") + chalk.cyan("--path <manifest-or-dir>") + DIM(", ") + chalk.cyan("--hosts claude-code,codex,cursor") + DIM(", ") + chalk.cyan("--target <dir>") + DIM(", ") + chalk.cyan("--dry-run") + DIM(", ") + chalk.cyan("--verify") + DIM(", ") + chalk.cyan("--json") + DIM(", ") + chalk.cyan("--init") + DIM(", ") + chalk.cyan("--mode propose|auto_pr") + DIM(", ") + chalk.cyan("--apply") + DIM(", ") + chalk.cyan("--force") + DIM(", ") + chalk.cyan("--dir <path>"));
  console.log("");
  console.log("  " + DIM("Canonical layout: ") + chalk.cyan("stacks/<slug>/youstack.json") + DIM(" (legacy youstack.json, .you/, and youstacks/ still load)"));
  console.log("");
}

function printValidation(validation: YouStackValidationResult): void {
  for (const warning of validation.warnings) {
    console.log("  " + chalk.yellow("WARN") + " " + warning);
  }
  for (const error of validation.errors) {
    console.log("  " + chalk.red("FAIL") + " " + error);
  }
}

function capabilityLabel(capability: YouStackCapability): string {
  const mode = capability.localOnly ? "local" : capability.mcpTool || capability.apiEndpoint ? "api/mcp" : "mixed";
  const policy = capability.mutationPolicy || "unspecified";
  return `${capability.id} ${DIM(`[${mode}; ${policy}]`)}`;
}

export async function stackCommand(
  subcommand?: string,
  args: string[] = [],
  options: StackCommandOptions = {}
): Promise<void> {
  const cmd = subcommand || "help";

  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    printHelp();
    return;
  }

  // ── P9: stack install ────────────────────────────────────────────────────────
  if (cmd === "install") {
    const ref = args[0] ?? "";
    const slash = ref.indexOf("/");
    if (!ref || slash <= 0 || slash === ref.length - 1) {
      console.log("");
      console.log(chalk.yellow("  usage: youmd stack install <user>/<slug>"));
      console.log("  " + DIM("example: youmd stack install houston/coding-stack"));
      console.log("");
      process.exitCode = 1;
      return;
    }
    const user = ref.slice(0, slash);
    const slug = ref.slice(slash + 1);

    const { BrailleSpinner } = await import("../lib/render");
    const spinner = new BrailleSpinner(`fetching ${ACCENT(ref)} from registry`);
    spinner.start();

    try {
      const result = await installStack(user, slug, {
        dir: options.dir,
        force: options.force,
      });
      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify({
          slug: result.slug,
          targetDir: result.targetDir,
          filesWritten: result.filesWritten,
          hostLinks: result.hostLinks,
        }, null, 2));
        return;
      }

      console.log("");
      console.log("  " + ACCENT("youstack install") + " " + chalk.bold(ref));
      console.log("  " + DIM("slug: ") + chalk.cyan(result.slug));
      console.log("  " + DIM("dir:  ") + result.targetDir);
      console.log("");
      for (const f of result.filesWritten) {
        console.log("  " + chalk.green("WROTE") + " " + f);
      }
      if (result.hostLinks.length > 0) {
        console.log("");
        for (const link of result.hostLinks) {
          console.log("  " + chalk.green("LINKED") + " " + link);
        }
      }
      console.log("");
      console.log("  " + chalk.green("installed.") + " " + DIM(`run \`youmd stack doctor --path ${result.targetDir}\` to validate.`));
      console.log("");
    } catch (err) {
      spinner.fail("install failed");
      const e = err as Error & { code?: string; validationErrors?: string[] };
      console.log("");
      if (e.code === "not_found") {
        console.log(chalk.red("  not found: ") + e.message);
      } else if (e.code === "conflict") {
        console.log(chalk.red("  conflict: ") + e.message);
      } else if (e.code === "invalid_manifest") {
        console.log(chalk.red("  invalid manifest: ") + e.message);
        if (e.validationErrors) {
          for (const ve of e.validationErrors) {
            console.log("    " + DIM(ve));
          }
        }
      } else {
        console.log(chalk.red("  error: ") + e.message);
      }
      console.log("");
      process.exitCode = 1;
    }
    return;
  }

  // ── L26: stack proposals ─────────────────────────────────────────────────────
  if (cmd === "proposals") {
    const sub = args[0]; // "approve" | "reject" | undefined
    const { BrailleSpinner } = await import("../lib/render");

    if (sub === "approve" || sub === "reject") {
      const id = args[1];
      if (!id) {
        console.log("");
        console.log(chalk.yellow(`  usage: youmd stack proposals ${sub} <id>`));
        console.log("");
        process.exitCode = 1;
        return;
      }
      const decision: "approved" | "rejected" = sub === "approve" ? "approved" : "rejected";
      const spinner = new BrailleSpinner(`submitting ${sub} decision`);
      spinner.start();
      try {
        const res = await setProposalDecision(id, decision);
        spinner.stop();
        if (!res.ok) {
          const msg = apiErrorMessage(res.data) ?? `request failed (${res.status})`;
          console.log("");
          console.log(chalk.red(`  proposals ${sub}: `) + msg);
          console.log("");
          process.exitCode = 1;
          return;
        }
        console.log("");
        console.log("  " + chalk.green(sub === "approve" ? "approved" : "rejected") + " proposal " + ACCENT(id));
        console.log("");
      } catch (err) {
        spinner.fail(`proposals ${sub} failed`);
        console.log("");
        console.log(chalk.red("  error: ") + (err instanceof Error ? err.message : String(err)));
        console.log("");
        process.exitCode = 1;
      }
      return;
    }

    // list
    const spinner = new BrailleSpinner("fetching maintainer proposals");
    spinner.start();
    try {
      const res = await listMaintainerProposals();
      spinner.stop();
      if (!res.ok) {
        const msg = apiErrorMessage(res.data) ?? `request failed (${res.status})`;
        console.log("");
        console.log(chalk.red("  proposals: ") + msg);
        console.log("");
        process.exitCode = 1;
        return;
      }
      const { proposals } = res.data as { proposals: Array<{ proposalId: string; stackSlug: string; skillName: string; evidenceCount: number; humanApprovalState: string }> };
      console.log("");
      if (!proposals || proposals.length === 0) {
        console.log("  " + chalk.dim("no proposals — your stacks are clean"));
        console.log("");
        return;
      }
      console.log("  " + ACCENT("maintainer proposals") + DIM(` (${proposals.length})`));
      console.log("");
      const idW = 20, stackW = 16, skillW = 24, evW = 5, stateW = 10;
      console.log(
        "  " +
        chalk.bold("id".padEnd(idW)) +
        chalk.bold("stack".padEnd(stackW)) +
        chalk.bold("skill".padEnd(skillW)) +
        chalk.bold("ev".padEnd(evW)) +
        chalk.bold("state".padEnd(stateW))
      );
      console.log("  " + DIM("-".repeat(idW + stackW + skillW + evW + stateW)));
      for (const p of proposals) {
        const shortId = String(p.proposalId).slice(-12);
        const stateColor =
          p.humanApprovalState === "approved" ? chalk.green :
          p.humanApprovalState === "rejected" ? chalk.red :
          chalk.dim;
        console.log(
          "  " +
          chalk.cyan(shortId.padEnd(idW)) +
          String(p.stackSlug).slice(0, stackW - 1).padEnd(stackW) +
          String(p.skillName).slice(0, skillW - 1).padEnd(skillW) +
          String(p.evidenceCount).padEnd(evW) +
          stateColor(String(p.humanApprovalState).padEnd(stateW))
        );
      }
      console.log("");
      console.log("  " + DIM("use `youmd stack proposals approve <id>` or `youmd stack proposals reject <id>`"));
      console.log("");
    } catch (err) {
      spinner.fail("proposals fetch failed");
      console.log("");
      console.log(chalk.red("  error: ") + (err instanceof Error ? err.message : String(err)));
      console.log("");
      process.exitCode = 1;
    }
    return;
  }

  // ── L26: stack consent ───────────────────────────────────────────────────────
  if (cmd === "consent") {
    const sub = args[0]; // "grant" | "revoke" | undefined
    const { BrailleSpinner } = await import("../lib/render");

    if (sub === "grant" || sub === "revoke") {
      const scope = args[1];
      if (!scope) {
        console.log("");
        console.log(chalk.yellow(`  usage: youmd stack consent ${sub} <scope>`));
        console.log("  " + DIM("scopes: consolidate, fleet_aggregate, journal_mine"));
        console.log("");
        process.exitCode = 1;
        return;
      }
      const granted = sub === "grant";
      const spinner = new BrailleSpinner(`${granted ? "granting" : "revoking"} ${scope}`);
      spinner.start();
      try {
        const res = await setBrainConsent(scope, granted);
        spinner.stop();
        if (!res.ok) {
          const msg = apiErrorMessage(res.data) ?? `request failed (${res.status})`;
          console.log("");
          console.log(chalk.red(`  consent ${sub}: `) + msg);
          console.log("");
          process.exitCode = 1;
          return;
        }
        console.log("");
        console.log(
          "  " +
          (granted ? chalk.green("granted") : chalk.red("revoked")) +
          " " + ACCENT(scope)
        );
        console.log("");
      } catch (err) {
        spinner.fail(`consent ${sub} failed`);
        console.log("");
        console.log(chalk.red("  error: ") + (err instanceof Error ? err.message : String(err)));
        console.log("");
        process.exitCode = 1;
      }
      return;
    }

    // list
    const spinner = new BrailleSpinner("fetching brain consent settings");
    spinner.start();
    try {
      const res = await listBrainConsent();
      spinner.stop();
      if (!res.ok) {
        const msg = apiErrorMessage(res.data) ?? `request failed (${res.status})`;
        console.log("");
        console.log(chalk.red("  consent: ") + msg);
        console.log("");
        process.exitCode = 1;
        return;
      }
      const { consents } = res.data as { consents: Array<{ scope: string; granted: boolean; explicit: boolean }> };
      console.log("");
      console.log("  " + ACCENT("brain consent settings"));
      console.log("");
      const scopeW = 22, grantedW = 10, explicitW = 12;
      console.log(
        "  " +
        chalk.bold("scope".padEnd(scopeW)) +
        chalk.bold("granted".padEnd(grantedW)) +
        chalk.bold("explicit".padEnd(explicitW))
      );
      console.log("  " + DIM("-".repeat(scopeW + grantedW + explicitW)));
      for (const c of consents) {
        const grantedStr = c.granted ? chalk.green("yes") : chalk.red("no");
        const explicitStr = c.explicit ? chalk.cyan("yes") : chalk.dim("no (default)");
        console.log(
          "  " +
          String(c.scope).padEnd(scopeW) +
          (c.granted ? chalk.green("yes".padEnd(grantedW)) : chalk.red("no".padEnd(grantedW))) +
          (c.explicit ? chalk.cyan("yes") : chalk.dim("no (default)"))
        );
        void grantedStr; void explicitStr;
      }
      console.log("");
      console.log("  " + DIM("use `youmd stack consent revoke <scope>` or `youmd stack consent grant <scope>`"));
      console.log("");
    } catch (err) {
      spinner.fail("consent fetch failed");
      console.log("");
      console.log(chalk.red("  error: ") + (err instanceof Error ? err.message : String(err)));
      console.log("");
      process.exitCode = 1;
    }
    return;
  }

  // ── stack sync ───────────────────────────────────────────────────────────────
  // Compiled file: dist/commands/stack.js — two levels up lands at package root,
  // then into scripts/skillstack-sync/sync.sh.
  if (cmd === "sync") {
    const scriptPath = path.join(__dirname, "..", "..", "scripts", "skillstack-sync", "sync.sh");
    if (!fs.existsSync(scriptPath)) {
      console.error(
        chalk.hex("#C46A3A")(`  error: sync script not found: ${scriptPath}`) +
          "\n  " + chalk.dim("run `npm run build` from the cli/ directory.")
      );
      process.exitCode = 1;
      return;
    }
    const syncArgs = options.dryRun ? ["--dry-run"] : [];
    const result = child_process.spawnSync("bash", [scriptPath, ...syncArgs], {
      stdio: "inherit",
    });
    if (result.error) {
      console.error(chalk.hex("#C46A3A")(`  error spawning sync script: ${result.error.message}`));
      process.exitCode = 1;
      return;
    }
    const exitCode = result.status ?? 0;
    await recordStackSyncActivity({
      dryRun: options.dryRun,
      exitCode,
      scriptPath,
    });
    process.exitCode = exitCode;
    return;
  }

  // ── stack context-sync ────────────────────────────────────────────────────────
  // Syncs per-project context files (conflict-safe). Delegates to context-sync.sh.
  if (cmd === "context-sync") {
    const scriptPath = path.join(__dirname, "..", "..", "scripts", "skillstack-sync", "context-sync.sh");
    if (!fs.existsSync(scriptPath)) {
      console.error(
        chalk.hex("#C46A3A")(`  error: context-sync script not found: ${scriptPath}`) +
          "\n  " + chalk.dim("run `npm run build` from the cli/ directory.")
      );
      process.exitCode = 1;
      return;
    }
    const syncArgs = options.dryRun ? ["--dry-run"] : [];
    const result = child_process.spawnSync("bash", [scriptPath, ...syncArgs], {
      stdio: "inherit",
    });
    if (result.error) {
      console.error(chalk.hex("#C46A3A")(`  error spawning context-sync script: ${result.error.message}`));
      process.exitCode = 1;
      return;
    }
    process.exitCode = result.status ?? 0;
    return;
  }

  // ── stack daemon ─────────────────────────────────────────────────────────────
  if (cmd === "daemon") {
    const action = args[0]; // install | uninstall | status
    const LAUNCH_AGENTS_DIR = path.join(
      process.env.HOME ?? process.env.USERPROFILE ?? "/",
      "Library", "LaunchAgents"
    );

    if (!action || !["install", "uninstall", "status"].includes(action)) {
      console.log("");
      console.log(chalk.yellow("  usage: youmd stack daemon <action>"));
      console.log("  " + chalk.dim("actions: install | uninstall | status"));
      console.log("");
      process.exitCode = 1;
      return;
    }

    if (action === "install") {
      const scriptPath = path.join(__dirname, "..", "..", "scripts", "skillstack-sync", "install-daemons.sh");
      if (!fs.existsSync(scriptPath)) {
        console.error(
          chalk.hex("#C46A3A")(`  error: install-daemons.sh not found: ${scriptPath}`) +
            "\n  " + chalk.dim("run `npm run build` from the cli/ directory.")
        );
        process.exitCode = 1;
        return;
      }
      const result = child_process.spawnSync("bash", [scriptPath], { stdio: "inherit" });
      if (result.error) {
        console.error(chalk.hex("#C46A3A")(`  error spawning install-daemons.sh: ${result.error.message}`));
        process.exitCode = 1;
        return;
      }
      process.exitCode = result.status ?? 0;
      return;
    }

    if (action === "uninstall") {
      console.log("");
      for (const daemon of YOUMD_DAEMONS) {
        for (const label of [daemon.label, daemon.legacyLabel].filter(Boolean) as string[]) {
          const plistPath = path.join(LAUNCH_AGENTS_DIR, `${label}.plist`);
          // unload (ignore errors — may not be loaded)
          child_process.spawnSync("launchctl", ["unload", plistPath], { stdio: "inherit" });
          // remove plist if present
          if (fs.existsSync(plistPath)) {
            fs.unlinkSync(plistPath);
            console.log("  " + chalk.green("removed") + " " + plistPath);
          } else {
            console.log("  " + chalk.dim("not found: ") + plistPath);
          }
        }
      }
      console.log("");
      return;
    }

    if (action === "status") {
      console.log("");
      for (const daemon of getDaemonHealth()) {
        const state = daemon.loaded ? chalk.green("loaded") : chalk.dim("not loaded");
        const cadence = daemon.intervalSeconds > 0
          ? `every ${Math.round(daemon.intervalSeconds / 60)}m`
          : "live websocket";
        console.log("  " + state + "   " + daemon.label + DIM(` (${daemon.name}, ${cadence})`));
        if (daemon.lastActivityAt) {
          console.log("             " + DIM(`last activity: ${daemon.lastActivityAt}`));
        }
        if (daemon.legacyLoaded && daemon.legacyLabel) {
          console.log("             " + chalk.yellow(`legacy loaded: ${daemon.legacyLabel}; run youmd stack daemon install to replace it`));
        }
        if (daemon.warning) {
          console.log("             " + chalk.yellow(`last warning: ${daemon.warning}`));
        }
        if (daemon.secretVaultSummary) {
          const color = daemon.secretVaultState === "ready" ? chalk.green : chalk.yellow;
          console.log("             " + color("secret vault: ") + DIM(daemon.secretVaultSummary));
        }
      }
      console.log("");
      return;
    }
  }

  let loaded;
  try {
    loaded = loadYouStackManifest(options.path);
  } catch (error) {
    console.log("");
    console.log(chalk.red("  youmd stack: ") + (error instanceof Error ? error.message : String(error)));
    console.log("");
    process.exitCode = 1;
    return;
  }

  if (cmd === "inspect") {
    if (options.json) {
      console.log(JSON.stringify(loaded, null, 2));
      return;
    }

    const manifest = loaded.manifest;
    console.log("");
    console.log("  " + ACCENT("youstack") + " " + chalk.bold(manifest.name));
    console.log("  " + DIM("slug: ") + chalk.cyan(manifest.slug));
    if (manifest.domain) console.log("  " + DIM("domain: ") + manifest.domain);
    if (manifest.aliases?.length) console.log("  " + DIM("aliases: ") + manifest.aliases.join(", "));
    if (manifest.tags?.length) console.log("  " + DIM("tags: ") + manifest.tags.join(", "));
    console.log("  " + DIM("version: ") + manifest.version);
    console.log("  " + DIM("visibility: ") + manifest.visibility);
    console.log("  " + DIM("manifest: ") + loaded.manifestPath);
    const readiness = getYouStackReadiness(loaded);
    console.log("  " + DIM("readiness: ") + `${readiness.status} (${readiness.reason})`);
    console.log("");
    console.log("  " + DIM("files: ") + String(manifest.files?.length || 0));
    console.log("  " + DIM("brain scopes: ") + String(manifest.brainScopes?.length || 0));
    console.log("  " + DIM("capabilities: ") + String(getYouStackCapabilities(manifest).length));
    console.log("  " + DIM("adapters: ") + Object.keys(manifest.adapters || {}).join(", "));
    console.log("  " + DIM("improvement: ") + (manifest.improvement?.mode || "not declared"));
    console.log("  " + DIM("update: ") + (manifest.update?.channel || "not declared"));
    console.log("");
    printValidation(loaded.validation);
    if (loaded.validation.ok) {
      console.log("  " + chalk.green("OK") + " manifest schema is valid");
    }
    console.log("");
    return;
  }

  if (cmd === "capabilities") {
    const capabilities = getYouStackCapabilities(loaded.manifest);
    const readiness = getYouStackReadiness(loaded);
    if (options.json) {
      console.log(JSON.stringify({ readiness, capabilities }, null, 2));
      return;
    }

    console.log("");
    console.log("  " + ACCENT("youstack capabilities") + DIM(` (${capabilities.length})`));
    console.log("  " + DIM("readiness: ") + `${readiness.status} (${readiness.reason})`);
    console.log("");
    for (const capability of capabilities) {
      console.log("  " + chalk.cyan(capabilityLabel(capability)));
      if (capability.intent) console.log("    " + DIM(capability.intent));
      if (capability.requiredScopes?.length) {
        console.log("    " + DIM("scopes: ") + capability.requiredScopes.join(", "));
      }
    }
    console.log("");
    return;
  }

  if (cmd === "doctor") {
    const result = runYouStackDoctor(loaded);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      if (!result.ok) process.exitCode = 1;
      return;
    }

    console.log("");
    console.log("  " + ACCENT("youstack doctor") + DIM(" -- read-only diagnostics"));
    console.log("");
    for (const diagnostic of result.diagnostics) {
      console.log("  " + chalk.cyan("INFO") + " " + diagnostic);
    }
    // P20: one dim line per actually-active shadowing (env over session,
    // canonical stack over legacy, repo project-context over global overlay).
    for (const shadow of detectShadowing()) {
      console.log("  " + DIM(`shadowed: ${shadow.message}`));
    }
    console.log("");
    // P11: empirical Claude Code discovery gate — per-skill pass/fail for
    // the SKILL.md files `youmd stack link` would emit for claude-code.
    if (result.discovery.length > 0) {
      for (const check of result.discovery) {
        if (check.ok) {
          console.log("  " + chalk.green("PASS") + " claude discovery: " + check.path);
        } else {
          console.log("  " + chalk.red("FAIL") + " claude discovery: " + check.path);
          for (const problem of check.problems) {
            console.log("       " + DIM(problem));
          }
        }
      }
      console.log("");
    }
    for (const recommendation of result.recommendations) {
      console.log("  " + ACCENT("NEXT") + " " + recommendation);
    }
    printValidation(result);
    console.log("");
    if (result.ok) {
      console.log("  " + chalk.green("Doctor passed.") + " " + DIM("No brain data was modified, no connected tools were invoked, and no files were changed."));
    } else {
      console.log("  " + chalk.red("Doctor failed.") + " " + DIM("Fix the manifest errors above and rerun."));
      process.exitCode = 1;
    }
    // Heartbeat: append NEXT dim line when stack wants to improve.
    try {
      const signal = await getHeartbeatSignal();
      if (signal.active) {
        console.log("  " + DIM("NEXT: " + signal.message));
      }
    } catch { /* advisory only — never break doctor */ }
    console.log("");
    return;
  }

  if (cmd === "route") {
    const request = args.join(" ").trim();
    if (!request) {
      console.log("");
      console.log(chalk.yellow("  usage: youmd stack route \"start this repo with my preferences\""));
      console.log("");
      process.exitCode = 1;
      return;
    }

    const route = routeYouStackRequest(loaded.manifest, request);
    // Resolve transport availability for the matched capability via the canonical router.
    const transport = resolveCapability(loaded.manifest, { capability: route.capability.id });
    const readiness = getYouStackReadiness(loaded);
    if (options.json) {
      console.log(JSON.stringify({ readiness, ...route, transports: transport.transports }, null, 2));
      return;
    }

    console.log("");
    console.log("  " + ACCENT("route") + " " + chalk.cyan(route.capability.id));
    console.log("  " + DIM("readiness: ") + `${readiness.status} (${readiness.reason})`);
    console.log("  " + DIM("request: ") + request);
    if (route.capability.intent) {
      console.log("  " + DIM("intent: ") + route.capability.intent);
    }
    console.log("  " + DIM("policy: ") + (route.capability.mutationPolicy || "unspecified"));
    const http = transport.transports.http ? chalk.green("yes") : chalk.dim("no");
    const mcp = transport.transports.mcp ? chalk.green("yes") : chalk.dim("no");
    console.log("  " + DIM("transports: ") + `http=${http}  mcp=${mcp}`);
    if (route.capability.skill) console.log("  " + DIM("skill: ") + route.capability.skill);
    if (route.capability.mcpTool) console.log("  " + DIM("mcp: ") + route.capability.mcpTool);
    if (route.capability.apiEndpoint) console.log("  " + DIM("api: ") + route.capability.apiEndpoint);
    console.log("");
    return;
  }

  if (cmd === "smoke") {
    const result = runYouStackSmoke(loaded);
    const readiness = getYouStackReadiness(loaded);
    if (options.json) {
      console.log(JSON.stringify({ readiness, ...result }, null, 2));
      if (!result.ok) process.exitCode = 1;
      return;
    }

    console.log("");
    console.log("  " + ACCENT("youstack smoke") + DIM(" -- read-only"));
    console.log("  " + DIM("readiness: ") + `${readiness.status} (${readiness.reason})`);
    console.log("");
    for (const check of result.checks) {
      console.log("  " + chalk.green("OK") + " " + check);
    }
    printValidation(result);
    console.log("");
    if (result.ok) {
      console.log("  " + chalk.green("Smoke passed.") + " " + DIM("No brain data was modified, no connected tools were invoked, and no files were changed."));
    } else {
      console.log("  " + chalk.red("Smoke failed.") + " " + DIM("Fix the manifest errors above and rerun."));
      process.exitCode = 1;
    }
    console.log("");
    return;
  }

  if (cmd === "link") {
    const hosts = options.hosts
      ? options.hosts.split(",").map((host) => host.trim()).filter(Boolean)
      : undefined;
    let results;
    try {
      results = linkYouStackAdapters(loaded, {
        hosts,
        targetDir: options.target,
        dryRun: options.dryRun,
      });
    } catch (error) {
      console.log("");
      console.log(chalk.red("  link failed: ") + (error instanceof Error ? error.message : String(error)));
      console.log("");
      process.exitCode = 1;
      return;
    }

    // P11 release gate: --verify checks every emitted SKILL.md against the
    // Claude Code discovery contract and exits non-zero on failures.
    let verification: { ok: boolean; checks: SkillDiscoveryCheck[] } | undefined;
    if (options.verify) {
      verification = verifySkillDiscovery(results);
      if (!verification.ok) process.exitCode = 1;
    }

    if (options.json) {
      console.log(JSON.stringify({ results, verification }, null, 2));
      return;
    }

    console.log("");
    console.log("  " + ACCENT("youstack link") + (options.dryRun ? DIM(" -- dry run") : ""));
    console.log("");
    for (const result of results) {
      const status = result.wrote ? chalk.green("WROTE") : chalk.yellow("WOULD WRITE");
      console.log("  " + status + " " + chalk.cyan(result.host) + DIM(" -> ") + result.targetPath);
    }
    console.log("");
    if (verification) {
      for (const check of verification.checks) {
        if (check.ok) {
          console.log("  " + chalk.green("PASS") + " skill discovery: " + check.path);
        } else {
          console.log("  " + chalk.red("FAIL") + " skill discovery: " + check.path);
          for (const problem of check.problems) {
            console.log("       " + DIM(problem));
          }
        }
      }
      console.log("");
      if (!verification.ok) {
        console.log("  " + chalk.red("Verification failed.") + " " + DIM("Fix the SKILL.md issues above and rerun."));
        console.log("");
        return;
      }
    }
    if (!options.dryRun) {
      console.log("  " + chalk.green("Adapter files generated.") + " " + DIM("No brain data or connected tools were touched."));
      console.log("");
    }
    return;
  }

  if (cmd === "guard") {
    const guardResult = runStackGuard(loaded.manifest, loaded.manifestPath);

    if (options.json) {
      console.log(JSON.stringify(guardResult, null, 2));
      if (!guardResult.ok) process.exitCode = 1;
      return;
    }

    console.log("");
    console.log("  " + ACCENT("youstack guard") + DIM(` -- T0-T3 safety contract (${guardResult.tier})`));
    console.log("  " + DIM("manifest: ") + loaded.manifestPath);
    console.log("");

    for (const check of guardResult.checks) {
      if (check.status === "PASS") {
        const inferNote = check.inferred
          ? DIM(` (inferred from: ${check.inferredFrom.join(", ")})`)
          : "";
        console.log("  " + chalk.green("PASS") + " " + chalk.cyan(check.capability) + " — " + check.message + inferNote);
      } else {
        const inferNote = check.inferred
          ? DIM(` (inferred from: ${check.inferredFrom.join(", ")})`)
          : "";
        console.log("  " + chalk.red("VIOLATION") + " " + chalk.cyan(check.capability) + " — " + check.message + inferNote);
        console.log("       " + DIM(`tier rule: ${check.tierRule}`));
      }
    }

    if (guardResult.contractViolations.length > 0) {
      console.log("");
      console.log("  " + ACCENT("contract violations:"));
      for (const violation of guardResult.contractViolations) {
        console.log("  " + chalk.red("FAIL") + " " + violation.reason);
        console.log("       " + DIM(`tier rule: ${violation.tierRule}`));
      }
    }

    if (guardResult.warnings.length > 0) {
      console.log("");
      for (const warning of guardResult.warnings) {
        console.log("  " + chalk.yellow("WARN") + " " + warning);
      }
    }

    console.log("");
    if (guardResult.ok) {
      console.log(
        "  " + chalk.green("Guard passed.") + " " +
        DIM(`${guardResult.tier} contract is self-consistent and no inferred capabilities exceed the declared tier.`)
      );
    } else {
      console.log(
        "  " + chalk.red("Guard failed.") + " " +
        DIM("Fix the violations above and rerun `youmd stack guard`.")
      );
      process.exitCode = 1;
    }
    console.log("");
    return;
  }

  if (cmd === "eval") {
    if (options.init) {
      // Write example golden.json
      const golden = buildInitGoldenFile(loaded.manifest);
      const filePath = writeGoldenFile(loaded.rootDir, golden);

      if (options.json) {
        console.log(JSON.stringify({ wrote: filePath, entries: golden.entries.length }, null, 2));
        return;
      }

      console.log("");
      console.log("  " + ACCENT("youstack eval --init"));
      console.log("  " + chalk.green("WROTE") + " " + filePath);
      console.log("  " + DIM(`${golden.entries.length} example entries. Edit to add real assertions, then run \`youmd stack eval\`.`));
      console.log("");
      return;
    }

    // Run the eval suite
    let goldenFile;
    try {
      goldenFile = readGoldenFile(loaded.rootDir);
    } catch (error) {
      console.log("");
      console.log(chalk.red("  eval: ") + (error instanceof Error ? error.message : String(error)));
      console.log("");
      process.exitCode = 1;
      return;
    }

    const evalResults = runEval(loaded.manifest, goldenFile);
    const resultsPath = writeEvalResults(loaded.rootDir, evalResults);

    if (options.json) {
      console.log(JSON.stringify(evalResults, null, 2));
      if (evalResults.failures.length > 0) process.exitCode = 1;
      return;
    }

    console.log("");
    console.log("  " + ACCENT("youstack eval") + DIM(` -- ${evalResults.total} prompts`));
    console.log("  " + DIM("golden: ") + goldenFilePath(loaded.rootDir));
    console.log("  " + DIM("results: ") + resultsPath);
    console.log("");

    for (const entry of goldenFile.entries) {
      const failure = evalResults.failures.find((f) => f.label === entry.label);
      if (!failure) {
        console.log("  " + chalk.green("PASS") + " " + entry.label);
      } else {
        console.log("  " + ACCENT("FAIL") + " " + entry.label);
        for (const diff of failure.diff) {
          console.log("       " + DIM(diff));
        }
        console.log("       " + DIM(`routed to: ${failure.actual.routedTo}`));
      }
    }

    console.log("");
    const passCount = chalk.green(`${evalResults.passed} passed`);
    const failCount = evalResults.failures.length > 0
      ? ACCENT(`${evalResults.failures.length} failed`)
      : chalk.dim("0 failed");
    console.log("  " + passCount + DIM(" / ") + failCount + DIM(` of ${evalResults.total} total`));
    console.log("");

    if (evalResults.failures.length > 0) {
      console.log("  " + chalk.red("Eval failed.") + " " + DIM("Fix routing assertions or update golden.json."));
      console.log("");
      process.exitCode = 1;
    } else {
      console.log("  " + chalk.green("Eval passed.") + " " + DIM("All prompts routed as expected."));
      console.log("");
    }
    return;
  }

  if (cmd === "improve") {
    const rawMode = options.mode ?? "propose";
    if (rawMode !== "propose" && rawMode !== "auto_pr") {
      console.log("");
      console.log(chalk.red("  stack improve: ") + `--mode must be "propose" or "auto_pr" (got: ${rawMode})`);
      console.log("");
      process.exitCode = 1;
      return;
    }

    const improveMode = rawMode as ImproveMode;
    const result = runStackImprove(loaded.manifest, loaded.rootDir, improveMode);

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      if (result.refused) process.exitCode = 1;
      return;
    }

    console.log("");
    console.log("  " + ACCENT("youstack improve") + DIM(` -- mode: ${result.mode}`));
    console.log("  " + DIM("manifest: ") + loaded.manifestPath);
    console.log("");

    if (result.refused) {
      console.log("  " + chalk.red("REFUSED") + " " + result.refused);
      console.log("");
      process.exitCode = 1;
      return;
    }

    console.log("  " + DIM("journal: ") + result.journalPath);
    if (result.appended) {
      console.log("  " + DIM("(appended to existing entry — idempotent re-run)"));
    } else {
      console.log("  " + chalk.green("WROTE") + " " + result.journalPath);
    }
    console.log("");

    if (result.summary.signals.length > 0) {
      console.log("  " + ACCENT("signals:"));
      for (const sig of result.summary.signals) {
        console.log("    " + chalk.cyan(sig.name) + DIM(" = ") + sig.value);
      }
      console.log("");
    }

    if (result.summary.proposals.length === 0) {
      console.log("  " + chalk.green("no proposals") + DIM(" — stack looks healthy"));
    } else {
      console.log("  " + ACCENT("proposals:"));
      for (const p of result.summary.proposals) {
        console.log("  " + chalk.cyan(p.id));
        console.log("    " + p.description);
        console.log("    " + DIM(p.rationale));
      }
    }

    if (result.prUrl) {
      console.log("");
      if (result.prUrl === "no-gh") {
        console.log("  " + chalk.yellow("gh CLI not found") + DIM(" — patch printed to journal only"));
      } else if (result.prUrl.startsWith("pr-failed:")) {
        console.log("  " + chalk.yellow("PR creation failed:") + " " + result.prUrl.replace("pr-failed: ", ""));
      } else {
        console.log("  " + chalk.green("PR opened:") + " " + chalk.cyan(result.prUrl));
      }
    }

    console.log("");
    return;
  }

  // ── L17: stack update ───────────────────────────────────────────────────────
  if (cmd === "update") {
    const info = await checkStackUpdate(loaded);

    if (options.json) {
      console.log(JSON.stringify(info, null, 2));
      return;
    }

    console.log("");
    console.log("  " + ACCENT("youstack update"));
    console.log("  " + DIM("manifest: ") + loaded.manifestPath);
    console.log("");
    console.log("  " + DIM("current: ") + info.currentVersion);
    console.log("  " + DIM("latest:  ") + (info.latestVersion ?? DIM("unknown")));
    console.log("  " + DIM("source:  ") + info.source);
    console.log("");
    console.log("  " + (info.updateAvailable ? chalk.green("update available") : chalk.dim("up to date")));
    if (info.changelogHint) {
      console.log("  " + DIM("hint: ") + info.changelogHint);
    }
    console.log("");

    if (options.apply) {
      if (!info.updateAvailable) {
        console.log("  " + DIM("nothing to apply — already at latest"));
        console.log("");
        return;
      }
      const applyResult = await applyStackUpdate(loaded);
      if (applyResult.error) {
        console.log("  " + chalk.red("apply failed: ") + applyResult.error);
        console.log("");
        process.exitCode = 1;
        return;
      }
      for (const wrote of applyResult.wrote) {
        console.log("  " + chalk.green("WROTE") + " " + wrote);
      }
      console.log("");
      console.log("  " + chalk.green("applied.") + " " + DIM("re-run `youmd stack doctor` to validate the new manifest."));
      console.log("");
    } else if (info.updateAvailable) {
      console.log("  " + DIM("run `youmd stack update --apply` to write the new manifest."));
      console.log("");
    }
    return;
  }

  console.log("");
  console.log(chalk.yellow(`  unknown stack command: ${cmd}`));
  printHelp();
  process.exitCode = 1;
}
