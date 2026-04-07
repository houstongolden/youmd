import * as path from "path";
import chalk from "chalk";
import { localBundleExists, readGlobalConfig, isAuthenticated } from "../lib/config";

const ACCENT = chalk.hex("#C46A3A");
const DIM = chalk.dim;

export async function mcpCommand(options: { json?: boolean; install?: string }): Promise<void> {
  // --json: output MCP config for agent settings
  if (options.json) {
    const config = getMcpConfig();
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  // --install: show setup instructions for a specific agent
  if (options.install) {
    await installMcp(options.install);
    return;
  }

  // Default: start the MCP server
  if (!localBundleExists()) {
    console.error("youmd mcp: no local .youmd/ bundle -- remote-only mode (run youmd init for full features)");
  }

  const { startMcpServer } = await import("../mcp/server");
  await startMcpServer();
}

function getMcpConfig(): Record<string, unknown> {
  const binPath = process.argv[1] || "youmd";
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
  const authed = isAuthenticated();

  if (target === "claude") {
    console.log("");
    console.log("  " + ACCENT("you.md mcp") + DIM(" -- claude code"));
    console.log("");
    console.log("  add to " + chalk.cyan("~/.claude/settings.json") + ":");
    console.log("");
    console.log(DIM("  {"));
    console.log(DIM("    \"mcpServers\": {"));
    console.log(`      ${chalk.green('"youmd"')}: {`);
    console.log(`        "command": ${chalk.green('"npx"')},`);
    console.log(`        "args": [${chalk.green('"youmd"')}, ${chalk.green('"mcp"')}]`);
    console.log("      }");
    console.log(DIM("    }"));
    console.log(DIM("  }"));
    console.log("");
    console.log("  then restart claude code.");
    console.log("");

    if (authed) {
      console.log(DIM(`  authenticated as @${username}`));
      console.log(DIM("  memories, remote push, and skill sync available"));
    } else {
      console.log(chalk.yellow("  not authenticated -- run youmd login for full features"));
    }
    console.log("");
  } else if (target === "cursor") {
    console.log("");
    console.log("  " + ACCENT("you.md mcp") + DIM(" -- cursor"));
    console.log("");
    console.log("  add to " + chalk.cyan(".cursor/mcp.json") + " in your project root:");
    console.log("");

    // Show clean, copy-pasteable JSON
    const cursorConfig = {
      mcpServers: {
        youmd: {
          command: "npx",
          args: ["youmd", "mcp"],
        },
      },
    };
    const jsonLines = JSON.stringify(cursorConfig, null, 2).split("\n");
    for (const line of jsonLines) {
      console.log("  " + chalk.white(line));
    }

    console.log("");

    if (authed) {
      console.log(DIM(`  authenticated as @${username}`));
      console.log(DIM("  your identity context will be available to cursor agents."));
    } else {
      console.log(chalk.yellow("  not authenticated -- run youmd login for full features"));
    }
    console.log("");
  } else {
    console.log("");
    console.log(chalk.yellow(`  unknown target: ${target}`));
    console.log("  supported: " + chalk.cyan("claude") + ", " + chalk.cyan("cursor"));
    console.log("");
  }
}
