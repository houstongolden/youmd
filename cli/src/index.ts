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
import { previewCommand } from "./commands/preview";

const program = new Command();

program
  .name("youmd")
  .description("CLI for the You.md identity bundle platform")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize a local .youmd/ directory with empty bundle structure")
  .action(initCommand);

program
  .command("login")
  .description("Authenticate with the You.md platform")
  .option("-k, --key <apiKey>", "API key for authentication")
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
  .action(publishCommand);

program
  .command("add <source> <url>")
  .description("Add a source URL to local config (website, linkedin, x, blog, youtube, github)")
  .action(addCommand);

program
  .command("diff")
  .description("Show changes since last publish")
  .action(diffCommand);

program
  .command("preview")
  .description("Start a local preview server")
  .option("-p, --port <port>", "Port number", "3333")
  .action(previewCommand);

program.parse(process.argv);
