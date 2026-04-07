import * as path from "path";
import chalk from "chalk";
import { localBundleExists, readGlobalConfig, isAuthenticated } from "../lib/config";

const ACCENT = chalk.hex("#C46A3A");

export async function mcpCommand(options: { json?: boolean; install?: string }): Promise<void> {
  // --json: output MCP config for claude settings
  if (options.json) {
    const config = getMcpConfig();
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  // --install: add to agent's MCP settings
  if (options.install) {
    await installMcp(options.install);
    return;
  }

  // Default: start the MCP server
  // Server works with or without local bundle — remote features still available
  if (!localBundleExists()) {
    console.error("youmd mcp: no local .youmd/ bundle — remote-only mode (run youmd init for full features)");
  }

  const { startMcpServer } = await import("../mcp/server");
  await startMcpServer();
}

function getMcpConfig(): Record<string, unknown> {
  const binPath = process.argv[1] || "youmd";
  // Resolve to the actual youmd binary
  const useNpx = !binPath.includes("youmd");

  if (useNpx) {
    return {
      youmd: {
        command: "npx",
        args: ["youmd", "mcp"],
      },
    };
  }

  return {
    youmd: {
      command: "node",
      args: [binPath, "mcp"],
    },
  };
}

async function installMcp(target: string): Promise<void> {
  const config = readGlobalConfig();
  const username = config.username || "user";

  if (target === "claude") {
    // Claude Code settings
    const settingsDir = path.join(
      process.env.HOME || process.env.USERPROFILE || "~",
      ".claude"
    );
    const settingsPath = path.join(settingsDir, "settings.json");

    console.log("");
    console.log(ACCENT("  you.md mcp — claude code"));
    console.log("");
    console.log("  add this to " + chalk.cyan("~/.claude/settings.json") + ":");
    console.log("");
    console.log(chalk.dim("  {"));
    console.log(chalk.dim("    \"mcpServers\": {"));
    console.log(`      ${chalk.green('"youmd"')}: {`);
    console.log(`        "command": ${chalk.green('"npx"')},`);
    console.log(`        "args": [${chalk.green('"youmd"')}, ${chalk.green('"mcp"')}]`);
    console.log("      }");
    console.log(chalk.dim("    }"));
    console.log(chalk.dim("  }"));
    console.log("");
    console.log("  then restart claude code.");
    console.log("");

    if (isAuthenticated()) {
      console.log(chalk.dim(`  authenticated as @${username}`));
      console.log(chalk.dim("  memories, remote push, and skill sync available"));
    } else {
      console.log(chalk.yellow("  not authenticated — run youmd login for full features"));
    }
    console.log("");
  } else if (target === "cursor") {
    console.log("");
    console.log(ACCENT("  you.md mcp — cursor"));
    console.log("");
    console.log("  add this to " + chalk.cyan(".cursor/mcp.json") + " in your project:");
    console.log("");
    console.log(chalk.dim("  {"));
    console.log(chalk.dim("    \"mcpServers\": {"));
    console.log(`      ${chalk.green("\"youmd\"")}: {`);
    console.log(`        "command": ${chalk.green("\"npx\"")},`);
    console.log(`        "args": [${chalk.green("\"youmd\"")}, ${chalk.green("\"mcp\"")}]`);
    console.log("      }");
    console.log(chalk.dim("    }"));
    console.log(chalk.dim("  }"));
    console.log("");
  } else {
    console.log("");
    console.log(chalk.yellow(`  unknown target: ${target}`));
    console.log("  supported: claude, cursor");
    console.log("");
  }
}
