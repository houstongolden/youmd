#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as readline from "readline";
import {
  isAuthenticated,
  readGlobalConfig,
  getLocalBundleDir,
  getHomeBundleDir,
  bundleLooksInitialized,
  detectProjectContext,
} from "./lib/config";
import { printPortraitEncounter, printYouLogo, resolvePortraitLines } from "./lib/ascii";
import { requireInteractiveTTY } from "./lib/render";
import {
  getRecentProjectInsights,
  getFeaturedRecentProjectNames,
  getTopProjectOpportunity,
} from "./lib/project";
import { checkForCliUpdate } from "./lib/update";
import { getFirstRunPlan, parseFirstRunAction } from "./lib/first-run";
import { initCommand } from "./commands/init";
import { loginCommand } from "./commands/login";
import { logoutCommand } from "./commands/logout";
import { registerCommand } from "./commands/register";
import { whoamiCommand } from "./commands/whoami";
import { statusCommand } from "./commands/status";
import { buildCommand } from "./commands/build";
import { publishCommand } from "./commands/publish";
import { addCommand } from "./commands/add";
import { diffCommand } from "./commands/diff";
import { exportCommand } from "./commands/export";
import { previewCommand } from "./commands/preview";
import { linkCommand } from "./commands/link";
import { keysCommand } from "./commands/keys";
import { chatCommand } from "./commands/chat";
import { pullCommand } from "./commands/pull";
import { pushCommand } from "./commands/push";
import { syncCommand } from "./commands/sync";
import { memoriesCommand } from "./commands/memories";
import { privateCommand } from "./commands/private";
import { projectCommand } from "./commands/project";
import { promptsCommand } from "./commands/prompts";
import { skillCommand } from "./commands/skill";
import { mcpCommand } from "./commands/mcp";
import { logsCommand } from "./commands/logs";
import { agentsCommand } from "./commands/agents";
import { stackCommand } from "./commands/stack";
import { okfCommand } from "./commands/okf";
import { envBackupCommand, envRestoreCommand, envShareCommand, envPullCommand, envListCommand } from "./commands/env";
import { machineCommand } from "./commands/machine";
import { readCliVersion } from "./lib/version";

const program = new Command();

const CURRENT_VERSION = readCliVersion();
const CLI_NAME = process.env.YOUMD_LAUNCH_SURFACE === "you" ? "you" : "youmd";

program
  .name(CLI_NAME)
  .description("identity context protocol for the agent internet — an MCP where the context is you")
  .version(CURRENT_VERSION);

// ─── Grouped --help output ─────────────────────────────────────────
// Commands are bucketed into categories so the help is scannable.
const HELP_GROUPS: Array<{
  title: string;
  commands: Array<{ name: string; summary: string }>;
}> = [
  {
    title: "AUTH",
    commands: [
      { name: "login", summary: "sign in via browser or email code, or use --key" },
      { name: "logout", summary: "clear local auth state for this machine" },
      { name: "register", summary: "create a new you.md identity" },
      { name: "whoami", summary: "show current authenticated user" },
    ],
  },
  {
    title: "BUNDLE",
    commands: [
      { name: "init", summary: "scaffold a local .youmd/ bundle" },
      { name: "build", summary: "compile local bundle from profile/ + preferences/" },
      { name: "status", summary: "show local + remote state and next steps" },
      { name: "push", summary: "upload local bundle and publish" },
      { name: "pull", summary: "download your profile into local .youmd/" },
      { name: "sync", summary: "pull + push in one command" },
      { name: "diff", summary: "show changes vs published version" },
      { name: "export", summary: "export you.json and/or you.md" },
      { name: "okf", summary: "export/import/validate portable OKF bundles (identity, skills, stacks)" },
      { name: "publish", summary: "publish compiled bundle to the platform" },
    ],
  },
  {
    title: "CHAT",
    commands: [
      { name: "chat", summary: "talk to the you agent (update profile, ask questions)" },
      { name: "memories", summary: "manage your memory brain" },
      { name: "private", summary: "manage private context (notes, links, projects)" },
      { name: "project", summary: "manage project-level agent context" },
      { name: "prompts", summary: "search and browse past agent messages" },
    ],
  },
  {
    title: "SKILLS",
    commands: [
      { name: "skill", summary: "identity-aware agent skills (list/install/use/sync)" },
      { name: "stack", summary: "local YouStack manifests (inspect/doctor/smoke/capabilities/route)" },
    ],
  },
  {
    title: "MONITORING",
    commands: [
      { name: "logs", summary: "view agent activity log (who read/wrote what, when)" },
      { name: "agents", summary: "list connected agents and their activity summary" },
    ],
  },
  {
    title: "MCP",
    commands: [
      { name: "mcp", summary: "run the you.md mcp server (for claude, codex, cursor, etc.)" },
    ],
  },
  {
    title: "SHARING",
    commands: [
      { name: "link", summary: "create, list, preview, revoke context links" },
      { name: "keys", summary: "manage api keys for agent access" },
      { name: "add", summary: "add a source url (website, linkedin, x, github...)" },
    ],
  },
  {
    title: "PREVIEW",
    commands: [
      { name: "preview", summary: "start a local preview server" },
    ],
  },
  {
    title: "SECURITY",
    commands: [
      { name: "env", summary: "encrypted .env.local secrets — local vault + zero-knowledge cross-machine handoff (share/pull)" },
    ],
  },
  {
    title: "MACHINE & SYNC",
    commands: [
      { name: "machine", summary: "bootstrap a fresh Mac with your synced skills, stacks, and context" },
    ],
  },
];

function renderGroupedHelp(): string {
  const ACCENT = chalk.hex("#C46A3A");
  const DIM = chalk.dim;
  const lines: string[] = [];

  lines.push("");
  lines.push("  " + chalk.bold("you.md") + DIM(" -- " + program.description()));
  lines.push("");
  lines.push("  " + DIM("Usage: ") + chalk.cyan(`${CLI_NAME} <command> [options]`));
  lines.push("");

  const longest = Math.max(
    ...HELP_GROUPS.flatMap((g) => g.commands.map((c) => c.name.length))
  );

  for (const group of HELP_GROUPS) {
    lines.push("  " + ACCENT(group.title));
    for (const c of group.commands) {
      lines.push(
        "    " + chalk.cyan(c.name.padEnd(longest + 2)) + DIM(c.summary)
      );
    }
    lines.push("");
  }

  lines.push("  " + DIM("Run ") + chalk.cyan(`${CLI_NAME} <command> --help`) + DIM(" for per-command options."));
  lines.push("");

  return lines.join("\n");
}

// Override the root command's help output only — subcommand --help keeps
// commander's default rendering, which is still what we want for them.
program.helpInformation = () => renderGroupedHelp();

function resolveBundleDirForWelcome(): string | null {
  const localDir = getLocalBundleDir();
  if (bundleLooksInitialized(localDir)) return localDir;

  const homeDir = getHomeBundleDir();
  if (bundleLooksInitialized(homeDir)) return homeDir;

  return null;
}

function readDisplayName(bundleDir: string | null, cfg: ReturnType<typeof readGlobalConfig>): string {
  if (bundleDir) {
    const youJsonPath = path.join(bundleDir, "you.json");
    if (fs.existsSync(youJsonPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(youJsonPath, "utf-8")) as {
          identity?: { name?: string };
        };
        if (parsed.identity?.name) return parsed.identity.name;
      } catch {
        // non-fatal
      }
    }
  }

  return cfg.username || "friend";
}

async function printUpdateHint(): Promise<void> {
  const latest = await checkForCliUpdate(CURRENT_VERSION);
  if (!latest) return;

  console.log("  " + chalk.yellow(`update available: ${CURRENT_VERSION} → ${latest}`));
  console.log("  " + chalk.dim("refresh U with: ") + chalk.cyan("curl -fsSL https://you.md/install.sh | bash"));
  console.log("  " + chalk.dim("or: ") + chalk.cyan(`npm install -g youmd@${latest}`));
  console.log("");
}

async function renderNoArgWelcome(): Promise<void> {
  const ACCENT = chalk.hex("#C46A3A");
  const DIM = chalk.dim;
  const authed = isAuthenticated();
  const cfg = readGlobalConfig();
  const user = cfg.username ? "@" + cfg.username : "";
  const bundleDir = resolveBundleDirForWelcome();
  const hasBundle = !!bundleDir;
  const displayName = readDisplayName(bundleDir, cfg);
  const rawProjectCtx = detectProjectContext();
  const projectCtx =
    rawProjectCtx && path.resolve(rawProjectCtx.root) !== path.resolve(os.homedir())
      ? rawProjectCtx
      : null;
  const recentInsights = getRecentProjectInsights(process.cwd(), 6);
  const recentProjects = getFeaturedRecentProjectNames(recentInsights);
  const missingRepoBootstrap =
    !!projectCtx &&
    (!fs.existsSync(path.join(projectCtx.root, "AGENTS.md")) ||
      !fs.existsSync(path.join(projectCtx.root, "project-context")));

  printYouLogo();

  if (hasBundle) {
    const portraitLines = await resolvePortraitLines(bundleDir);
    const showedPortrait = portraitLines
      ? printPortraitEncounter({
          bundleDir,
          displayName,
          currentProject: projectCtx?.name,
          recentProjects,
          portraitLines,
        })
      : false;
    if (showedPortrait) {
      console.log("");
      console.log("  " + ACCENT("there you are.") + " " + DIM("you look good in code."));
      console.log("");
    }
  }

  if (!authed) {
    console.log("  " + ACCENT("u is ready.") + " let's get you set up without the ceremony.");
    console.log("");
    console.log("    " + DIM("1.") + " " + chalk.cyan("youmd login") + DIM("          browser, email code, or --key"));
    console.log("    " + DIM("2.") + " " + chalk.cyan("youmd init") + DIM("           build your identity through conversation"));
    console.log("    " + DIM("3.") + " " + chalk.cyan("youmd push") + DIM("           publish to you.md/<username>"));
    console.log("");
    console.log("  " + DIM("tip: ") + chalk.cyan("you") + DIM(" is the fast path once your identity bundle exists."));
  } else if (!hasBundle) {
    console.log("  " + ACCENT(`good to see you${user ? `, ${user}` : ""}.`) + " i don't see a local bundle here yet.");
    console.log("");
    console.log("    " + chalk.cyan("youmd init") + DIM("           start the conversational setup"));
    console.log("    " + chalk.cyan("youmd pull") + DIM("           pull your live identity down to this machine"));
    console.log("    " + chalk.cyan("you") + DIM("                  open U once the bundle exists"));
    console.log("");
  } else {
    console.log("  " + ACCENT(`good to see you${user ? `, ${user}` : ""}.`) + " U is online.");
    if (projectCtx) {
      console.log("  " + DIM("current project: ") + chalk.white(projectCtx.name) + DIM(` (${projectCtx.root})`));
    }
    if (recentProjects.length > 0) {
      console.log("  " + DIM("recent project contexts: ") + recentProjects.slice(0, 3).map((name) => chalk.cyan(name)).join(DIM(", ")));
    }
    const topOpportunity = getTopProjectOpportunity(recentInsights);
    if (topOpportunity && !projectCtx) {
      console.log("  " + ACCENT("i found an opening.") + " " + DIM(topOpportunity.summary));
    }
    console.log("");
    console.log("  " + chalk.bold("next best moves"));
    console.log("");
    console.log("    " + chalk.cyan("you") + DIM("                  open U and let it help proactively"));
    console.log("    " + chalk.cyan("youmd status") + DIM("         check sync state, publish state, and gaps"));
    if (missingRepoBootstrap) {
      console.log("    " + chalk.cyan("youmd skill init-project") + DIM(" wire this repo for your agents"));
    } else if (topOpportunity) {
      console.log("    " + chalk.cyan("open the next project opening"));
      console.log("      " + chalk.cyan(topOpportunity.suggestedCommand));
      console.log("      " + DIM("then let U tighten it up"));
    } else {
      console.log("    " + chalk.cyan("youmd sync") + DIM("           pull + push the latest identity state"));
    }
    console.log("    " + chalk.cyan("youmd link create") + DIM("    hand your context to another agent"));
    console.log("");
    if (missingRepoBootstrap) {
      console.log("  " + ACCENT("i spotted an opening.") + " this repo doesn't look fully wired for your agents yet.");
      console.log("  " + DIM("run ") + chalk.cyan("youmd skill init-project") + DIM(" and i'll scaffold the shared operating context."));
      console.log("");
    }
  }

  await printUpdateHint();

  console.log("  " + DIM("full command list: ") + chalk.cyan(`${CLI_NAME} --help`));
  console.log("");
}

function promptInput(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function runYouGuidedSetup(): Promise<void> {
  requireInteractiveTTY();

  const ACCENT = chalk.hex("#C46A3A");
  const DIM = chalk.dim;

  async function handOffToHydratedChat(): Promise<void> {
    console.log("  " + ACCENT("bundle is live.") + " " + DIM("this machine has something real to work with now."));
    console.log("");
    console.log("  " + DIM("Enter = safe sync + open U. say ") + chalk.cyan("chat") + DIM(" to skip sync, ") + chalk.cyan("status") + DIM(" to inspect, ") + chalk.cyan("quit") + DIM(" to stop."));
    console.log("");

    const answer = await promptInput(ACCENT("  > "));
    const action = parseFirstRunAction(answer, {
      authed: isAuthenticated(),
      hasBundle: !!resolveBundleDirForWelcome(),
    }) || "sync";
    console.log("");

    if (action === "quit") {
      console.log("  " + DIM("all set. come back with ") + chalk.cyan("you") + DIM(" when you're ready."));
      console.log("");
      return;
    }

    if (action === "status") {
      await statusCommand();
      console.log("");
      console.log("  " + DIM("when you're ready, run ") + chalk.cyan("you") + DIM(" to open U."));
      console.log("");
      return;
    }

    if (action === "sync" && isAuthenticated()) {
      console.log("  " + ACCENT("hydrating local runtime...") + " " + DIM("pulling first, pushing only when it is safe."));
      console.log("");
      const previousExitCode = process.exitCode;
      process.exitCode = undefined;
      await syncCommand({ watch: false, force: false });
      if (process.exitCode) {
        console.log("");
        console.log("  " + DIM("sync needs attention before chat. run ") + chalk.cyan("youmd status") + DIM(" for details."));
        return;
      }
      process.exitCode = previousExitCode;
      console.log("");
    }

    console.log("  " + ACCENT("handing you to U.") + " " + DIM("same brain, local terminal."));
    console.log("");
    await chatCommand();
  }

  while (true) {
    await renderNoArgWelcome();

    const bundleDir = resolveBundleDirForWelcome();
    const plan = getFirstRunPlan({
      authed: isAuthenticated(),
      hasBundle: !!bundleDir,
    });

    if (!plan) {
      await chatCommand();
      return;
    }

    console.log("  " + ACCENT(plan.headline));
    console.log("  " + DIM(plan.detail));
    console.log(
      "  " +
        DIM("say ") +
        plan.suggestedActions.map((action) => chalk.cyan(action)).join(DIM(", ")) +
        DIM(`. Enter = ${plan.defaultAction}.`),
    );
    console.log("");

    const answer = await promptInput(ACCENT("  > "));
    const action = parseFirstRunAction(answer, {
      authed: isAuthenticated(),
      hasBundle: !!resolveBundleDirForWelcome(),
    }) || plan.defaultAction;

    console.log("");

    if (action === "quit") {
      console.log("  " + DIM("later."));
      console.log("");
      return;
    }

    if (action === "help") {
      console.log(renderGroupedHelp());
      continue;
    }

    if (action === "status") {
      await statusCommand();
      continue;
    }

    if (action === "login") {
      await loginCommand({});
    } else if (action === "register") {
      await registerCommand();
    } else if (action === "pull") {
      await pullCommand();
    } else if (action === "init") {
      await initCommand({});
    }

    if (resolveBundleDirForWelcome()) {
      await handOffToHydratedChat();
      return;
    }
  }
}

program
  .command("init")
  .description("Initialize a local .youmd/ identity context (interactive)")
  .option("--skip-prompts", "Skip interactive prompts and create empty bundle")
  .option("--example <name>", "Scaffold from a sample bundle (houston, priya, jordan)")
  .action(initCommand);

program
  .command("login")
  .description("Authenticate with the You.md platform")
  .option("-k, --key <apiKey>", "API key for authentication")
  .option("-w, --web", "Open browser sign-in directly")
  .option("-e, --email", "Email-code login in the terminal (skip the device flow)")
  .action(loginCommand);

program
  .command("register")
  .description("Register a new You.md identity")
  .action(registerCommand);

program
  .command("logout")
  .description("Clear local authentication for this machine")
  .action(logoutCommand);

program
  .command("whoami")
  .description("Show current authenticated user")
  .action(whoamiCommand);

program
  .command("status")
  .description("Show pipeline/build status")
  .action(statusCommand);

program
  .command("build")
  .description("Compile local you.md bundle from profile/ and preferences/ files")
  .action(buildCommand);

program
  .command("publish")
  .description("Push compiled bundle to the platform API")
  .option("-f, --force", "Publish even if remote has richer data")
  .action(publishCommand);

program
  .command("add <source> <url>")
  .description("Add a source URL to local config (website, linkedin, x, blog, youtube, github)")
  .action(addCommand);

program
  .command("diff [v1] [v2]")
  .description("Compare bundle versions: `youmd diff` (local vs remote) or `youmd diff <v1> <v2>`")
  .action((v1, v2) => diffCommand(v1, v2));

program
  .command("export")
  .description("Export profile to you.json and/or you.md")
  .option("--json", "Export only you.json")
  .option("--md", "Export only you.md")
  .option("--okf", "Export as a portable OKF bundle (directory of markdown concepts)")
  .option("-o, --output <path>", "Output directory")
  .action((options) => exportCommand(options));

program
  .command("okf [subcommand] [arg]")
  .description("Open Knowledge Format — export/import/validate/health/view for portable OKF bundles (identity, skills, stacks)")
  .option("-o, --out <dir>", "Output directory")
  .option("--stack [path]", "Export a YouStack (optionally at <path>) instead of your identity bundle")
  .option("--no-skills", "Exclude installed skills from an identity export")
  .option("--author <name>", "Stamp last_updated_by provenance on exported concepts")
  .option("--confidence <level>", "Stamp confidence provenance (low|medium|high) on exported concepts")
  .option("--stale-days <n>", "Days before a concept is flagged stale by `okf health` (default 30)")
  .option("--json", "Print JSON output")
  .action((subcommand, arg, options) => okfCommand(subcommand, arg, options));

program
  .command("preview")
  .description("Start a local preview server")
  .option("-p, --port <port>", "Port number", "3333")
  .action(previewCommand);

program
  .command("chat")
  .description("Talk to the You agent — update your profile, add sources, ask questions")
  .action(chatCommand);

program
  .command("pull")
  .description("Download your profile from you.md to ~/.youmd/ files")
  .option("-f, --force", "Overwrite local edits that haven't been pushed")
  .option("--local", "Target the project-local .youmd/ instead of ~/.youmd/")
  .action(async (options) => {
    await pullCommand(options);
  });

program
  .command("push")
  .description("Upload ~/.youmd/ files to you.md and publish")
  .option("--no-publish", "Upload without publishing")
  .option("-f, --force", "Push even if remote has richer data")
  .option("--local", "Target the project-local .youmd/ instead of ~/.youmd/")
  .action(pushCommand);

program
  .command("sync")
  .description("Sync ~/.youmd/ files with you.md (pull + push)")
  .option("-w, --watch", "Watch for local changes and auto-push")
  .option("-f, --force", "Sync even when local and remote have both changed")
  .option("--local", "Target the project-local .youmd/ instead of ~/.youmd/")
  .action(syncCommand);

const linkCmd = program
  .command("link [subcommand] [arg]")
  .description("Manage context links (create, list, revoke, preview)")
  .option("--name <name>", "Memorable name for the link (e.g. hiring, acme-demo)")
  .option("--scope <scope>", "Link scope: public or full", "public")
  .option("--ttl <ttl>", "Time to live: 1h, 24h, 7d, 30d, 90d, never", "7d")
  .option("--max-uses <n>", "Maximum number of uses")
  .option("--id <id>", "Link ID or token (for revoke/preview)");

linkCmd.action((subcommand, arg, options) => {
  return linkCommand(subcommand, { ...options, arg });
});

const keysCmd = program
  .command("keys [subcommand]")
  .description("Manage API keys (list, create, revoke)")
  .option("--label <label>", "Label for new key")
  .option("--scopes <scopes>", "Comma-separated scopes (e.g. read:public)", "read:public")
  .option("--id <id>", "Key ID (for revoke)");

keysCmd.action((subcommand, options) => {
  return keysCommand(subcommand, options);
});

program
  .command("memories [subcommand] [args...]")
  .description("Manage your memory brain (list, add, stats)")
  .action((subcommand, args) => {
    return memoriesCommand(subcommand, ...(args || []));
  });

program
  .command("private [subcommand] [args...]")
  .description("Manage private context (notes, links, projects)")
  .action((subcommand, args) => {
    return privateCommand(subcommand, ...(args || []));
  });

program
  .command("project [subcommand] [args...]")
  .description("Manage project agent context (init, list, show, memories)")
  .action((subcommand, args) => {
    return projectCommand(subcommand, ...(args || []));
  });

program
  .command("prompts [subcommand] [args...]")
  .description("Search, browse, and catalog your past messages across agent sessions")
  .allowUnknownOption(true)
  .action((subcommand, args) => {
    return promptsCommand(subcommand, ...(args || []));
  });

program
  .command("skill [subcommand] [args...]")
  .description("Identity-aware agent skills (list, install, use, sync, init-project)")
  .allowUnknownOption(true)
  .action((subcommand, args) => {
    return skillCommand(subcommand, ...(args || []));
  });

program
  .command("stack [subcommand] [args...]")
  .description("Local YouStack manifests (inspect, doctor, smoke, capabilities, route, link, guard, eval, update, install)")
  .option("--path <path>", "Path to a youstack.json file or stack directory")
  .option("--hosts <hosts>", "Comma-separated host list for stack link (claude-code,codex,cursor)")
  .option("--target <dir>", "Target project directory for stack link")
  .option("--dry-run", "Preview stack link writes without changing files")
  .option("--verify", "Verify emitted SKILL.md files pass agent discovery; exit non-zero on failure")
  .option("--json", "Print JSON output")
  .option("--init", "Initialize a golden.json eval scaffold for youmd stack eval")
  .option("--apply", "Apply the fetched update to the local manifest (stack update only)")
  .option("--force", "Overwrite existing stacks/<slug>/ directory (stack install only)")
  .option("--dir <path>", "Base directory to install into (stack install only; defaults to cwd)")
  .action((subcommand, args, options) => {
    return stackCommand(subcommand, args || [], options);
  });

program
  .command("mcp")
  .description("Start the You.md MCP server (identity context for Claude, Cursor, any MCP client)")
  .option("--json", "Output MCP config JSON for agent settings")
  .option("--install <target>", "Show setup instructions for an agent (claude, codex, cursor)")
  .option("--auto", "Auto-write the MCP config into the target's settings file")
  .action(mcpCommand);

program
  .command("logs")
  .description("View agent activity log -- see what agents read/wrote and when")
  .option("--limit <n>", "Max events to show (default 30)")
  .option("--agent <name>", "Filter by agent name (e.g. 'Claude Code')")
  .option("--action <type>", "Filter by action (read|write|push|publish|memory_add)")
  .option("--tail", "Live mode -- poll every 2s for new events")
  .action(logsCommand);

program
  .command("agents")
  .description("List connected agents and their activity summary")
  .action(agentsCommand);

// ─── env — encrypted .env.local vault backup/restore ───────────────
program
  .command("env [subcommand] [args...]")
  .description("encrypted .env.local secrets — local vault backup/restore + zero-knowledge cross-machine handoff")
  .allowUnknownOption(true)
  .option("--root <dir>", "code workspace root (share/pull) or search/restore dir (backup/restore)")
  .option("--out <dir>", "output directory for the vault and manifest")
  .option("--dir <path>", "explicit target directory for `pull` (overrides --root/<project>)")
  .option("--ttl <minutes>", "(share) minutes until access codes expire, default 60")
  .option("--reads <n>", "(share) times each code may be claimed, default 1 (burn-after-read)")
  .option("--project <name>", "(share) limit to a single project directory")
  .option("-f, --force", "overwrite existing .env.local without backing them up")
  .action(async (subcommand, args, options) => {
    const a = args || [];
    if (subcommand === "backup") {
      envBackupCommand({ root: options.root, out: options.out });
    } else if (subcommand === "restore") {
      if (!a[0]) {
        console.log("usage: youmd env restore <vault> [--root <dir>] [--force]");
        return;
      }
      envRestoreCommand(a[0], { root: options.root, force: options.force });
    } else if (subcommand === "share") {
      await envShareCommand({ root: options.root, ttl: options.ttl, reads: options.reads, project: options.project });
    } else if (subcommand === "pull") {
      await envPullCommand(a[0], { root: options.root, dir: options.dir, force: options.force });
    } else if (subcommand === "list" || subcommand === "ls") {
      await envListCommand();
    } else {
      console.log("usage: youmd env <backup|restore|share|pull|list> [options]");
      console.log("  backup              encrypt all .env.local files into a portable local vault");
      console.log("  restore <vault>     decrypt and restore .env.local files from a local vault");
      console.log("  share               push client-side-encrypted .env.local handoffs, print expiring access codes");
      console.log("  pull <access-code>  claim + decrypt a handoff onto this machine (writes .env.local, mode 0600)");
      console.log("  list                show active handoffs (variable names only, never values)");
    }
  });

// ─── machine — cross-machine setup and agent config sync ───────────
program
  .command("machine [subcommand]")
  .description("set up a new machine with your synced skills, stacks, and agent config")
  .option("--root <dir>", "projects: workspace root, default ~/Desktop/CODE_2026")
  .option("--days <n>", "projects: recent activity window in days", "90")
  .option("--yes", "projects: include older projects without prompting")
  .option("--no-clone", "projects: create directories only")
  .option("--force", "restore: overwrite existing files without backing them up")
  .option("--dry-run", "preview what would be written, write nothing")
  .action(async (subcommand, options) => {
    await machineCommand(subcommand || "help", {
      force: options.force,
      dryRun: options.dryRun,
      root: options.root,
      days: options.days,
      yes: options.yes,
      clone: options.clone,
    });
  });

// ─── Guided tutorial when invoked with no args ─────────────────────
// `youmd` (bare) shows a short contextual welcome / next-step guide.
async function main(): Promise<void> {
  if (process.argv.length <= 2) {
    if (process.env.YOUMD_LAUNCH_SURFACE === "you") {
      await runYouGuidedSetup();
      return;
    }
    await renderNoArgWelcome();
    return;
  }

  await program.parseAsync(process.argv);
}

void main();
