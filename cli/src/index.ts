#!/usr/bin/env node

import { Command } from "commander";
import { initCommand } from "./commands/init";
import { loginCommand } from "./commands/login";
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
import { skillCommand } from "./commands/skill";

const program = new Command();

program
  .name("youmd")
  .description("identity context protocol for the agent internet — an MCP where the context is you")
  .version("0.5.0");

program
  .command("init")
  .description("Initialize a local .youmd/ identity context (interactive)")
  .option("--skip-prompts", "Skip interactive prompts and create empty bundle")
  .action(initCommand);

program
  .command("login")
  .description("Authenticate with the You.md platform")
  .option("-k, --key <apiKey>", "API key for authentication")
  .option("-w, --web", "Open the dashboard in your browser to create an API key")
  .action(loginCommand);

program
  .command("register")
  .description("Register a new You.md identity")
  .action(registerCommand);

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
  .command("diff")
  .description("Show changes between local bundle and published version")
  .action(() => diffCommand());

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
  .command("skill [subcommand] [args...]")
  .description("Identity-aware agent skills (list, install, use, sync, init-project)")
  .action((subcommand, args) => {
    return skillCommand(subcommand, ...(args || []));
  });

program.parse(process.argv);
