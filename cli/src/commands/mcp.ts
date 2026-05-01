import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import chalk from "chalk";
import { bundleLooksInitialized, getHomeBundleDir, getLocalBundleDir, readGlobalConfig, isAuthenticated } from "../lib/config";

const ACCENT = chalk.hex("#C46A3A");
const DIM = chalk.dim;
const PUBLISHED_MCP_PACKAGE = process.env.YOUMD_MCP_PACKAGE || "youmd@latest";

function getPublishedMcpEntry(): Record<string, unknown> {
  return {
    command: "npx",
    args: ["--yes", PUBLISHED_MCP_PACKAGE, "mcp"],
  };
}

function hasActiveBundle(): boolean {
  return bundleLooksInitialized(getLocalBundleDir()) || bundleLooksInitialized(getHomeBundleDir());
}

export async function mcpCommand(options: { json?: boolean; install?: string; auto?: boolean }): Promise<void> {
  // --json: output MCP config for agent settings
  if (options.json) {
    const config = getMcpConfig();
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  // --install: show setup instructions for a specific agent (or auto-write)
  if (options.install) {
    await installMcp(options.install, options.auto);
    return;
  }

  // Default: start the MCP server
  if (!hasActiveBundle()) {
    console.error("youmd mcp: no local .youmd/ bundle -- remote-only mode (run youmd init for full features)");
  }

  const { startMcpServer } = await import("../mcp/server");
  await startMcpServer();
}

function getMcpConfig(): Record<string, unknown> {
  const binPath = process.argv[1];
  const repoLocalDist = path.resolve(process.cwd(), "cli", "dist", "index.js");

  // When running from the source repo itself, prefer the checked-out local CLI
  // so MCP clients exercise the latest in-repo implementation instead of npm.
  if (binPath && path.resolve(binPath) === repoLocalDist && fs.existsSync(repoLocalDist)) {
    return {
      youmd: {
        command: "node",
        args: [repoLocalDist, "mcp"],
      },
    };
  }

  return {
    youmd: getPublishedMcpEntry(),
  };
}

function mergeMcpServers(
  existing: Record<string, unknown> | undefined
): Record<string, unknown> {
  return { ...(existing || {}), youmd: getPublishedMcpEntry() };
}

function backupAndWrite(filePath: string, content: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${filePath}.bak.${ts}`;
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, backupPath);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return backupPath;
}

function installClaudeAuto(): boolean {
  const settingsPath = path.join(os.homedir(), ".claude", "settings.json");

  let settings: Record<string, unknown> = {};
  const existed = fs.existsSync(settingsPath);
  if (existed) {
    try {
      const raw = fs.readFileSync(settingsPath, "utf-8");
      settings = raw.trim().length > 0 ? JSON.parse(raw) : {};
    } catch (err) {
      console.log("");
      console.log(chalk.yellow("  could not parse ~/.claude/settings.json:"));
      console.log("  " + DIM(err instanceof Error ? err.message : String(err)));
      console.log(DIM("  falling back to manual instructions."));
      console.log("");
      return false;
    }
  }

  const mcpServers = mergeMcpServers(
    settings.mcpServers as Record<string, unknown> | undefined
  );
  const next = { ...settings, mcpServers };

  const json = JSON.stringify(next, null, 2) + "\n";
  const backupPath = backupAndWrite(settingsPath, json);

  console.log("");
  console.log("  " + ACCENT("you.md mcp") + DIM(" -- claude code (auto)"));
  console.log("");
  console.log(
    "  " + chalk.green("\u2713") + " merged youmd into " + chalk.cyan(settingsPath)
  );
  if (existed) {
    console.log("  " + DIM("backup: " + backupPath));
  }
  console.log("");
  console.log("  " + chalk.bold("Installed. Restart Claude Code to activate."));
  console.log("");
  return true;
}

function installCursorAuto(): boolean {
  const settingsPath = path.join(process.cwd(), ".cursor", "mcp.json");

  let settings: Record<string, unknown> = {};
  const existed = fs.existsSync(settingsPath);
  if (existed) {
    try {
      const raw = fs.readFileSync(settingsPath, "utf-8");
      settings = raw.trim().length > 0 ? JSON.parse(raw) : {};
    } catch (err) {
      console.log("");
      console.log(chalk.yellow("  could not parse .cursor/mcp.json:"));
      console.log("  " + DIM(err instanceof Error ? err.message : String(err)));
      console.log(DIM("  falling back to manual instructions."));
      console.log("");
      return false;
    }
  }

  const mcpServers = mergeMcpServers(
    settings.mcpServers as Record<string, unknown> | undefined
  );
  const next = { ...settings, mcpServers };

  const json = JSON.stringify(next, null, 2) + "\n";
  const backupPath = backupAndWrite(settingsPath, json);

  console.log("");
  console.log("  " + ACCENT("you.md mcp") + DIM(" -- cursor (auto)"));
  console.log("");
  console.log(
    "  " + chalk.green("\u2713") + " merged youmd into " + chalk.cyan(settingsPath)
  );
  if (existed) {
    console.log("  " + DIM("backup: " + backupPath));
  } else {
    console.log("  " + DIM("created new .cursor/mcp.json"));
  }
  console.log("");
  console.log("  " + chalk.bold("Installed. Restart Cursor to activate."));
  console.log("");
  return true;
}

function renderTomlString(value: string): string {
  return JSON.stringify(value);
}

function renderTomlStringArray(values: string[]): string {
  return `[${values.map(renderTomlString).join(", ")}]`;
}

function upsertCodexMcpServerConfig(raw: string): string {
  const entry = [
    "[mcp_servers.youmd]",
    `command = ${renderTomlString("npx")}`,
    `args = ${renderTomlStringArray(["--yes", PUBLISHED_MCP_PACKAGE, "mcp"])}`,
  ].join("\n");
  const lines = raw.trimEnd().split("\n");
  const nextLines: string[] = [];
  let replaced = false;
  let skippingYoumdBlock = false;

  for (const line of lines) {
    if (/^\s*\[mcp_servers\.youmd\]\s*$/.test(line)) {
      if (!replaced) {
        if (nextLines.length > 0 && nextLines[nextLines.length - 1] !== "") {
          nextLines.push("");
        }
        nextLines.push(entry);
        replaced = true;
      }
      skippingYoumdBlock = true;
      continue;
    }

    if (skippingYoumdBlock && /^\s*\[.+\]\s*$/.test(line)) {
      skippingYoumdBlock = false;
      if (nextLines.length > 0 && nextLines[nextLines.length - 1] !== "") {
        nextLines.push("");
      }
    }

    if (skippingYoumdBlock) continue;
    nextLines.push(line);
  }

  if (!replaced) {
    if (nextLines.length > 0 && nextLines[nextLines.length - 1] !== "") {
      nextLines.push("");
    }
    nextLines.push(entry);
  }

  return `${nextLines.join("\n").trimEnd()}\n`;
}

function installCodexAuto(): boolean {
  const settingsPath = path.join(os.homedir(), ".codex", "config.toml");

  let raw = "";
  const existed = fs.existsSync(settingsPath);
  if (existed) {
    try {
      raw = fs.readFileSync(settingsPath, "utf-8");
    } catch (err) {
      console.log("");
      console.log(chalk.yellow("  could not read ~/.codex/config.toml:"));
      console.log("  " + DIM(err instanceof Error ? err.message : String(err)));
      console.log(DIM("  falling back to manual instructions."));
      console.log("");
      return false;
    }
  }

  const next = upsertCodexMcpServerConfig(raw);
  const backupPath = backupAndWrite(settingsPath, next);

  console.log("");
  console.log("  " + ACCENT("you.md mcp") + DIM(" -- codex (auto)"));
  console.log("");
  console.log(
    "  " + chalk.green("\u2713") + " merged youmd into " + chalk.cyan(settingsPath)
  );
  if (existed) {
    console.log("  " + DIM("backup: " + backupPath));
  } else {
    console.log("  " + DIM("created new ~/.codex/config.toml"));
  }
  console.log("");
  console.log("  " + chalk.bold("Installed. Restart Codex to activate."));
  console.log("");
  return true;
}

async function installMcp(target: string, auto?: boolean): Promise<void> {
  const config = readGlobalConfig();
  const username = config.username || "user";
  const authed = isAuthenticated();
  const normalizedTarget = target.toLowerCase();

  if (auto) {
    if (normalizedTarget === "claude") {
      if (installClaudeAuto()) return;
      // fall through to manual instructions on error
    } else if (normalizedTarget === "cursor") {
      if (installCursorAuto()) return;
    } else if (normalizedTarget === "codex") {
      if (installCodexAuto()) return;
    } else {
      console.log("");
      console.log(chalk.yellow(`  --auto not supported for target: ${target}`));
      console.log(DIM("  supported: claude, codex, cursor"));
      console.log("");
      return;
    }
  }

  if (normalizedTarget === "claude") {
    console.log("");
    console.log("  " + ACCENT("you.md mcp") + DIM(" -- claude code"));
    console.log("");
    console.log("  add to " + chalk.cyan("~/.claude/settings.json") + ":");
    console.log("");
    console.log(DIM("  {"));
    console.log(DIM("    \"mcpServers\": {"));
    console.log(`      ${chalk.green('"youmd"')}: {`);
    console.log(`        "command": ${chalk.green('"npx"')},`);
    console.log(
      `        "args": [${chalk.green('"--yes"')}, ${chalk.green(`"${PUBLISHED_MCP_PACKAGE}"`)}, ${chalk.green('"mcp"')}]`
    );
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
  } else if (normalizedTarget === "codex") {
    console.log("");
    console.log("  " + ACCENT("you.md mcp") + DIM(" -- codex"));
    console.log("");
    console.log("  add to " + chalk.cyan("~/.codex/config.toml") + ":");
    console.log("");
    console.log("  " + chalk.white("[mcp_servers.youmd]"));
    console.log("  " + chalk.white(`command = ${renderTomlString("npx")}`));
    console.log("  " + chalk.white(`args = ${renderTomlStringArray(["--yes", PUBLISHED_MCP_PACKAGE, "mcp"])}`));
    console.log("");
    console.log("  then restart codex.");
    console.log("");

    if (authed) {
      console.log(DIM(`  authenticated as @${username}`));
      console.log(DIM("  your identity context will be available to codex agents."));
    } else {
      console.log(chalk.yellow("  not authenticated -- run youmd login for full features"));
    }
    console.log("");
  } else if (normalizedTarget === "cursor") {
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
          args: ["--yes", PUBLISHED_MCP_PACKAGE, "mcp"],
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
    console.log("  supported: " + chalk.cyan("claude") + ", " + chalk.cyan("codex") + ", " + chalk.cyan("cursor"));
    console.log("");
  }
}
