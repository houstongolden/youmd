import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import chalk from "chalk";
import { bundleLooksInitialized, getHomeBundleDir, getLocalBundleDir, readGlobalConfig, isAuthenticated } from "../lib/config";

const ACCENT = chalk.hex("#C46A3A");
const DIM = chalk.dim;
const PUBLISHED_MCP_PACKAGE = process.env.YOUMD_MCP_PACKAGE || "youmd@latest";

/**
 * Per-host agent names injected as YOUMD_AGENT_NAME so the MCP activity log
 * attributes tool calls to the actual host instead of a hardcoded default.
 */
const HOST_AGENT_NAMES: Record<string, string> = {
  claude: "Claude Code",
  codex: "Codex",
  cursor: "Cursor",
};

export function getPublishedMcpEntry(agentName?: string): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    command: "npx",
    args: ["--yes", PUBLISHED_MCP_PACKAGE, "mcp"],
  };
  if (agentName) {
    entry.env = { YOUMD_AGENT_NAME: agentName };
  }
  return entry;
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
    console.error("youmd mcp: no local .you/ bundle -- remote-only mode (run youmd init for full features; legacy .youmd is still read during migration)");
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
  existing: Record<string, unknown> | undefined,
  agentName?: string
): Record<string, unknown> {
  return { ...(existing || {}), youmd: getPublishedMcpEntry(agentName) };
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

/** Locate the `claude` binary on PATH (Claude Code CLI). */
function findClaudeBinary(): string | null {
  const finder = process.platform === "win32" ? "where" : "which";
  try {
    const r = spawnSync(finder, ["claude"], { encoding: "utf-8", timeout: 5_000 });
    if (r.status === 0 && typeof r.stdout === "string") {
      const first = r.stdout
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)[0];
      return first || null;
    }
  } catch {
    // fall through
  }
  return null;
}

/**
 * Parse `claude mcp list` for a youmd entry. Output format (verified against
 * Claude Code 2.x):
 *
 *   Checking MCP server health\u2026
 *   youmd: npx --yes youmd@latest mcp - \u2713 Connected
 *
 * Returns true/false when the list was readable, null when the command
 * failed or timed out (verification unavailable \u2014 caller should fall back
 * to checking ~/.claude.json directly).
 */
export function parseClaudeMcpListForYoumd(output: string): boolean {
  return /^\s*youmd:\s/m.test(output);
}

function claudeListShowsYoumd(claudeBin: string): boolean | null {
  try {
    const r = spawnSync(claudeBin, ["mcp", "list"], {
      encoding: "utf-8",
      timeout: 60_000, // `claude mcp list` health-checks each server
    });
    if (typeof r.stdout !== "string" || (r.status !== 0 && !r.stdout.trim())) {
      return null;
    }
    return parseClaudeMcpListForYoumd(r.stdout);
  } catch {
    return null;
  }
}

function getClaudeJsonPath(): string {
  return path.join(os.homedir(), ".claude.json");
}

/** Check ~/.claude.json (the file Claude Code actually reads) for a youmd mcpServers entry. */
function claudeJsonHasYoumd(): boolean {
  try {
    const raw = fs.readFileSync(getClaudeJsonPath(), "utf-8");
    const cfg = JSON.parse(raw) as Record<string, unknown>;
    const servers = cfg.mcpServers as Record<string, unknown> | undefined;
    return Boolean(servers && typeof servers === "object" && "youmd" in servers);
  } catch {
    return false;
  }
}

/** Verify the install: prefer parsing `claude mcp list`, fall back to ~/.claude.json. */
function verifyClaudeInstall(claudeBin: string | null): boolean {
  if (claudeBin) {
    const listed = claudeListShowsYoumd(claudeBin);
    if (listed !== null) return listed;
  }
  return claudeJsonHasYoumd();
}

/**
 * Install the youmd MCP server for Claude Code.
 *
 * Preferred path: shell out to `claude mcp add --scope user` so Claude Code
 * owns the schema and scope. Fallback: merge an mcpServers entry into
 * ~/.claude.json \u2014 the file Claude Code actually reads (NOT
 * ~/.claude/settings.json, which it ignores for MCP servers).
 */
function installClaudeAuto(): boolean {
  console.log("");
  console.log("  " + ACCENT("you.md mcp") + DIM(" -- claude code (auto)"));
  console.log("");

  const claudeBin = findClaudeBinary();

  if (claudeBin) {
    const addArgs = [
      "mcp", "add",
      "--scope", "user",
      "--env", `YOUMD_AGENT_NAME=${HOST_AGENT_NAMES.claude}`,
      "youmd",
      "--",
      "npx", "--yes", PUBLISHED_MCP_PACKAGE, "mcp",
    ];
    let r = spawnSync(claudeBin, addArgs, { encoding: "utf-8", timeout: 30_000 });

    // Upsert: if youmd already exists, remove the stale entry and re-add so
    // the env block and package spec are current.
    const stderr = `${r.stderr || ""}${r.stdout || ""}`;
    if (r.status !== 0 && /already exists/i.test(stderr)) {
      spawnSync(claudeBin, ["mcp", "remove", "--scope", "user", "youmd"], {
        encoding: "utf-8",
        timeout: 30_000,
      });
      r = spawnSync(claudeBin, addArgs, { encoding: "utf-8", timeout: 30_000 });
    }

    if (r.status === 0) {
      console.log(
        "  " + chalk.green("\u2713") + " registered via " + chalk.cyan("claude mcp add --scope user")
      );
      if (verifyClaudeInstall(claudeBin)) {
        console.log("  " + chalk.green("\u2713") + " verified: youmd appears in " + chalk.cyan("claude mcp list"));
        console.log("");
        console.log("  " + chalk.bold("Installed. Restart Claude Code to activate."));
        console.log("");
        return true;
      }
      console.log("  " + chalk.yellow("!") + " could not verify install \u2014 trying config fallback");
    } else {
      console.log("  " + chalk.yellow("!") + " " + DIM("claude mcp add failed \u2014 falling back to ~/.claude.json"));
    }
  }

  // Fallback: write ~/.claude.json directly (the file Claude Code reads).
  const configPath = getClaudeJsonPath();
  let config: Record<string, unknown> = {};
  const existed = fs.existsSync(configPath);
  if (existed) {
    try {
      const raw = fs.readFileSync(configPath, "utf-8");
      config = raw.trim().length > 0 ? JSON.parse(raw) : {};
    } catch (err) {
      console.log(chalk.yellow("  could not parse ~/.claude.json:"));
      console.log("  " + DIM(err instanceof Error ? err.message : String(err)));
      console.log(DIM("  falling back to manual instructions."));
      console.log("");
      return false;
    }
  }

  const mcpServers = mergeMcpServers(
    config.mcpServers as Record<string, unknown> | undefined,
    HOST_AGENT_NAMES.claude
  );
  const next = { ...config, mcpServers };

  const json = JSON.stringify(next, null, 2) + "\n";
  const backupPath = backupAndWrite(configPath, json);

  console.log(
    "  " + chalk.green("\u2713") + " merged youmd into " + chalk.cyan(configPath)
  );
  if (existed) {
    console.log("  " + DIM("backup: " + backupPath));
  }

  if (!verifyClaudeInstall(claudeBin)) {
    console.log("  " + chalk.yellow("!") + " could not verify the install \u2014 check " + chalk.cyan(configPath));
    console.log("");
    return false;
  }

  console.log("  " + chalk.green("\u2713") + " verified: youmd present in MCP config");
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
    settings.mcpServers as Record<string, unknown> | undefined,
    HOST_AGENT_NAMES.cursor
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

export function upsertCodexMcpServerConfig(raw: string): string {
  const entry = [
    "[mcp_servers.youmd]",
    `command = ${renderTomlString("npx")}`,
    `args = ${renderTomlStringArray(["--yes", PUBLISHED_MCP_PACKAGE, "mcp"])}`,
    `env = { YOUMD_AGENT_NAME = ${renderTomlString(HOST_AGENT_NAMES.codex)} }`,
  ].join("\n");
  const lines = raw.trimEnd().split("\n");
  const nextLines: string[] = [];
  let replaced = false;
  let skippingYoumdBlock = false;

  for (const line of lines) {
    if (/^\s*\[mcp_servers\.youmd(\.[A-Za-z0-9_.-]+)?\]\s*$/.test(line)) {
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
    console.log("  preferred — let the claude CLI register it:");
    console.log("");
    console.log(
      "  " +
        chalk.white(
          `claude mcp add --scope user --env YOUMD_AGENT_NAME="${HOST_AGENT_NAMES.claude}" youmd -- npx --yes ${PUBLISHED_MCP_PACKAGE} mcp`
        )
    );
    console.log("");
    console.log("  or add to " + chalk.cyan("~/.claude.json") + DIM(" (NOT ~/.claude/settings.json)") + ":");
    console.log("");
    console.log(DIM("  {"));
    console.log(DIM("    \"mcpServers\": {"));
    console.log(`      ${chalk.green('"youmd"')}: {`);
    console.log(`        "command": ${chalk.green('"npx"')},`);
    console.log(
      `        "args": [${chalk.green('"--yes"')}, ${chalk.green(`"${PUBLISHED_MCP_PACKAGE}"`)}, ${chalk.green('"mcp"')}],`
    );
    console.log(
      `        "env": { ${chalk.green('"YOUMD_AGENT_NAME"')}: ${chalk.green(`"${HOST_AGENT_NAMES.claude}"`)} }`
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
      console.log(chalk.yellow("  not authenticated -- run you login for full features"));
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
    console.log("  " + chalk.white(`env = { YOUMD_AGENT_NAME = ${renderTomlString(HOST_AGENT_NAMES.codex)} }`));
    console.log("");
    console.log("  then restart codex.");
    console.log("");

    if (authed) {
      console.log(DIM(`  authenticated as @${username}`));
      console.log(DIM("  your identity context will be available to codex agents."));
    } else {
      console.log(chalk.yellow("  not authenticated -- run you login for full features"));
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
          env: { YOUMD_AGENT_NAME: HOST_AGENT_NAMES.cursor },
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
      console.log(chalk.yellow("  not authenticated -- run you login for full features"));
    }
    console.log("");
  } else {
    console.log("");
    console.log(chalk.yellow(`  unknown target: ${target}`));
    console.log("  supported: " + chalk.cyan("claude") + ", " + chalk.cyan("codex") + ", " + chalk.cyan("cursor"));
    console.log("");
  }
}
