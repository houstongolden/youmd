#!/usr/bin/env node

import chalk from "chalk";

// T29: don't dump the ASCII banner into non-interactive environments — CI logs,
// containers, docker images, etc. process.stdout.isTTY is false for piped
// stdout. YOUMD_NO_BANNER is an explicit opt-out for interactive shells that
// still don't want it. npm_config_user_agent presence + isTTY both required.
if (
  process.env.YOUMD_NO_BANNER ||
  process.env.CI ||
  !process.stdout.isTTY
) {
  process.exit(0);
}

const ACCENT = chalk.hex("#C46A3A");

console.log("");
console.log("  ██╗   ██╗   ██████╗   ██╗   ██╗");
console.log("  ╚██╗ ██╔╝  ██╔═══██╗  ██║   ██║");
console.log("   ╚████╔╝   ██║   ██║  ██║   ██║");
console.log("    ╚██╔╝    ██║   ██║  ██║   ██║");
console.log("     ██║     ╚██████╔╝  ╚██████╔╝");
console.log("     ╚═╝      ╚═════╝    ╚═════╝ ");
console.log("  " + chalk.dim("──────────────────────────────────"));
console.log("  " + ACCENT("u is installed.") + " " + chalk.dim("identity for the agent internet is now on this machine."));
console.log("");
console.log("    " + chalk.cyan("you") + chalk.dim("                 meet U"));
console.log("    " + chalk.cyan("youmd login") + chalk.dim("         explicit auth path"));
console.log("    " + chalk.cyan("youmd init") + chalk.dim("          explicit local setup"));
console.log("");
