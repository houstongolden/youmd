#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { isAuthenticated, localBundleExists, readGlobalConfig } from "./lib/config";
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

const program = new Command();

program
  .name("youmd")
  .description("identity context protocol for the agent internet — an MCP where the context is you")
  .version("0.6.2");

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
      { name: "mcp", summary: "run the you.md mcp server (for claude, cursor, etc.)" },
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
];

function renderGroupedHelp(): string {
  const ACCENT = chalk.hex("#C46A3A");
  const DIM = chalk.dim;
  const lines: string[] = [];

  lines.push("");
  lines.push("  " + chalk.bold("you.md") + DIM(" -- " + program.description()));
  lines.push("");
  lines.push("  " + DIM("Usage: ") + chalk.cyan("youmd <command> [options]"));
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

  lines.push("  " + DIM("Run ") + chalk.cyan("youmd <command> --help") + DIM(" for per-command options."));
  lines.push("");

  return lines.join("\n");
}

// Override the root command's help output only — subcommand --help keeps
// commander's default rendering, which is still what we want for them.
program.helpInformation = () => renderGroupedHelp();

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
  .option("-o, --output <path>", "Output directory")
  .action((options) => exportCommand(options));

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
  .description("Download your profile from you.md to local .youmd/ files")
  .action(pullCommand);

program
  .command("push")
  .description("Upload local .youmd/ files to you.md and publish")
  .option("--no-publish", "Upload without publishing")
  .option("-f, --force", "Push even if remote has richer data")
  .action(pushCommand);

program
  .command("sync")
  .description("Sync local files with you.md (pull + push)")
  .option("-w, --watch", "Watch for local changes and auto-push")
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
  .description("Search and browse your past messages across agent sessions")
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
  .command("mcp")
  .description("Start the You.md MCP server (identity context for Claude, Cursor, any MCP client)")
  .option("--json", "Output MCP config JSON for agent settings")
  .option("--install <target>", "Show setup instructions for an agent (claude, cursor)")
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

// ─── Guided tutorial when invoked with no args ─────────────────────
// `youmd` (bare) shows a short contextual welcome / next-step guide.
if (process.argv.length <= 2) {
  const ACCENT = chalk.hex("#C46A3A");
  const DIM = chalk.dim;
  const authed = isAuthenticated();
  const hasBundle = localBundleExists();
  const cfg = readGlobalConfig();
  const user = cfg.username ? "@" + cfg.username : "";

  console.log("");
  console.log("  " + chalk.bold("you.md") + DIM(" -- identity context protocol for the agent internet"));
  console.log("");

  if (!authed) {
    console.log("  " + ACCENT("welcome.") + " let's get you set up.");
    console.log("");
    console.log("    " + DIM("1.") + " " + chalk.cyan("youmd register") + DIM("    create your identity"));
    console.log("    " + DIM("2.") + " " + chalk.cyan("youmd login") + DIM("       or log in if you already have one"));
    console.log("    " + DIM("3.") + " " + chalk.cyan("youmd init") + DIM("        scaffold your local bundle"));
    console.log("");
    console.log("  " + DIM("tip: run ") + chalk.cyan("youmd --help") + DIM(" for the full command list."));
  } else if (!hasBundle) {
    console.log("  " + ACCENT("you're logged in") + (user ? " as " + chalk.green(user) : "") + ". let's create your identity.");
    console.log("");
    console.log("    " + DIM("1.") + " " + chalk.cyan("youmd init") + DIM("        scaffold .youmd/ in this dir"));
    console.log("    " + DIM("2.") + " " + chalk.cyan("youmd chat") + DIM("        talk to the agent to fill it in"));
    console.log("    " + DIM("3.") + " " + chalk.cyan("youmd push") + DIM("        publish to https://you.md/") + (user || "@you"));
    console.log("");
    console.log("  " + DIM("or run ") + chalk.cyan("youmd pull") + DIM(" if you already have a profile online."));
  } else {
    console.log("  " + ACCENT("all set.") + (user ? " logged in as " + chalk.green(user) + "." : ""));
    console.log("");
    console.log("    " + chalk.cyan("youmd status") + DIM("      show bundle + sync state"));
    console.log("    " + chalk.cyan("youmd sync") + DIM("        pull + push latest"));
    console.log("    " + chalk.cyan("youmd link create") + DIM(" share identity with an agent"));
    console.log("");
    console.log("  " + DIM("full command list: ") + chalk.cyan("youmd --help"));
  }
  console.log("");
  process.exit(0);
}

program.parse(process.argv);
