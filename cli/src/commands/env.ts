import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as child_process from "child_process";
import * as os from "os";
import chalk from "chalk";
import { BrailleSpinner } from "../lib/render";
import {
  apiErrorMessage,
  downloadLatestSecretEnvVaultSnapshot,
  listSecretEnvVaultSnapshots,
  uploadSecretEnvVaultSnapshot,
} from "../lib/api";

// The compiled file lives at dist/commands/env.js.
// Walking up two levels lands at the package root, then into scripts/.
function resolveScript(name: "backup.sh" | "restore.sh"): string {
  return path.join(__dirname, "..", "..", "scripts", "env-vault", name);
}

function assertScriptExists(scriptPath: string): void {
  if (!fs.existsSync(scriptPath)) {
    console.error(
      chalk.hex("#C46A3A")(`  error: script not found: ${scriptPath}`) +
        "\n  " +
        chalk.dim("run `npm run build` from the cli/ directory to ensure scripts are in place.")
    );
    process.exit(1);
  }
}

type EnvBackupOpts = { root?: string; out?: string; preflight?: boolean };
type EnvRestoreOpts = {
  root?: string;
  force?: boolean;
  list?: boolean;
  mapExisting?: boolean;
  existingOnly?: boolean;
  skipAgentAuth?: boolean;
};
export type EnvVaultOpts = EnvBackupOpts & EnvRestoreOpts & {
  label?: string;
  restore?: boolean;
  printPath?: boolean;
  json?: boolean;
};

function expandHome(value: string | undefined): string | undefined {
  if (!value) return value;
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  return value;
}

function defaultVaultOutDir(): string {
  return path.join(os.homedir(), "Desktop", "youmd-env-vault");
}

function defaultCloudVaultDir(): string {
  return path.join(os.homedir(), ".youmd", "secret-vault");
}

function runScript(scriptPath: string, args: string[]): number {
  const result = child_process.spawnSync("bash", [scriptPath, ...args], {
    stdio: "inherit",
  });

  if (result.error) {
    console.error(chalk.hex("#C46A3A")(`  error spawning vault script: ${result.error.message}`));
    return 1;
  }

  return result.status ?? 0;
}

function latestVaultFile(outDir: string): string | null {
  if (!fs.existsSync(outDir)) return null;
  const candidates = fs
    .readdirSync(outDir)
    .filter((fileName) => /^env-vault-.+\.tar\.(enc|age|gpg)$/.test(fileName))
    .map((fileName) => path.join(outDir, fileName))
    .sort();
  return candidates.at(-1) ?? null;
}

function manifestForVault(vaultPath: string): string | null {
  const match = path.basename(vaultPath).match(/^env-vault-(.+)\.tar\.(enc|age|gpg)$/);
  if (!match) return null;
  const candidate = path.join(path.dirname(vaultPath), `manifest-${match[1]}.txt`);
  return fs.existsSync(candidate) ? candidate : null;
}

function sha256File(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function parseSafeManifest(manifestText: string): {
  encryptionTool: string;
  projectCount: number;
  variableCount: number;
  agentAuthIncluded: boolean;
} {
  let encryptionTool = "unknown";
  let projectCount = 0;
  let variableCount = 0;
  let agentAuthIncluded = false;

  for (const line of manifestText.split(/\r?\n/)) {
    const encryptionMatch = line.match(/^Encryption:\s*(.+)$/);
    if (encryptionMatch) encryptionTool = encryptionMatch[1].trim() || encryptionTool;

    const envMatch = line.match(/^[^/\s]+\/\.env\.local:\s*(\d+)\s+variable/);
    if (envMatch) {
      projectCount += 1;
      variableCount += Number(envMatch[1]);
    }

    if (/^\s*agent-auth\/.+:\s*\d+\s+bytes\b/.test(line)) {
      agentAuthIncluded = true;
    }
  }

  return { encryptionTool, projectCount, variableCount, agentAuthIncluded };
}

function vaultExtension(filePath: string): string {
  const match = path.basename(filePath).match(/\.tar\.(enc|age|gpg)$/);
  return match?.[1] ?? "enc";
}

function secretVaultErrorMessage(status: number, data: unknown, fallback: string): string {
  const base = apiErrorMessage(data) ?? fallback;
  if (status === 401) {
    return `${base}. Run \`youmd login\` or \`youmd login --key <vault-scoped-key>\` on this trusted device.`;
  }
  if (status === 403) {
    return `${base}. This key may be missing the \`vault\` scope; create or mint a fresh machine/bootstrap key with \`vault\`, then rerun.`;
  }
  if (status === 404) {
    return `${base}. The installed CLI or hosted You.md API may be stale; run the curl installer/update path, then retry.`;
  }
  return base;
}

export function runEnvBackupScript(opts: EnvBackupOpts): number {
  const scriptPath = resolveScript("backup.sh");
  assertScriptExists(scriptPath);

  const args: string[] = [];
  if (opts.preflight) args.push("--preflight");
  if (opts.root) args.push("--root", expandHome(opts.root)!);
  if (opts.out) args.push("--out", expandHome(opts.out)!);

  // Print the spinner line then stop it before handing the TTY to bash
  // (the script needs an interactive TTY for the passphrase prompt).
  const spinner = new BrailleSpinner(opts.preflight ? "checking env vault readiness..." : "sealing your env vault...");
  spinner.start();
  spinner.stop("handing off to vault script");
  console.log("");

  return runScript(scriptPath, args);
}

export function envBackupCommand(opts: EnvBackupOpts): void {
  process.exit(runEnvBackupScript(opts));
}

export function runEnvRestoreScript(vault: string, opts: EnvRestoreOpts): number {
  const scriptPath = resolveScript("restore.sh");
  assertScriptExists(scriptPath);

  // Build arg list — restore.sh expects: [--list] [--force] [--root <path>] <vault-file>
  const args: string[] = [];
  if (opts.list) args.push("--list");
  if (opts.force) args.push("--force");
  if (opts.mapExisting) args.push("--map-existing");
  if (opts.existingOnly) args.push("--existing-only");
  if (opts.skipAgentAuth) args.push("--skip-agent-auth");
  if (opts.root) args.push("--root", expandHome(opts.root)!);
  args.push(expandHome(vault)!);

  const spinner = new BrailleSpinner(opts.list ? "inspecting the vault..." : "opening the vault...");
  spinner.start();
  spinner.stop("handing off to restore script");
  console.log("");

  return runScript(scriptPath, args);
}

export function envRestoreCommand(vault: string, opts: EnvRestoreOpts): void {
  process.exit(runEnvRestoreScript(vault, opts));
}

export async function envVaultCommand(action: string | undefined, opts: EnvVaultOpts = {}): Promise<number> {
  const subcommand = action || "help";

  if (subcommand === "push") {
    const outDir = expandHome(opts.out) ?? defaultVaultOutDir();
    const rootDir = expandHome(opts.root);
    const backupStatus = runEnvBackupScript({ root: rootDir, out: outDir, preflight: opts.preflight });
    if (backupStatus !== 0) return backupStatus;
    if (opts.preflight) return 0;

    const vaultPath = latestVaultFile(outDir);
    if (!vaultPath) {
      console.error(chalk.hex("#C46A3A")(`  no env-vault-*.tar.* file found in ${outDir}`));
      return 1;
    }

    const manifestPath = manifestForVault(vaultPath);
    const manifestText = manifestPath ? fs.readFileSync(manifestPath, "utf-8") : "";
    const parsed = parseSafeManifest(manifestText);
    const archive = fs.readFileSync(vaultPath);
    const sha256 = sha256File(vaultPath);
    const manifestSha256 = manifestPath ? sha256File(manifestPath) : undefined;
    const extension = vaultExtension(vaultPath);

    const spinner = new BrailleSpinner("syncing encrypted env vault to You.md Secret Vault...");
    spinner.start();
    const response = await uploadSecretEnvVaultSnapshot({
      label: opts.label,
      fileName: path.basename(vaultPath),
      contentType: "application/octet-stream",
      encryption: {
        tool: parsed.encryptionTool,
        extension,
        formatVersion: 1,
      },
      encryptedArchiveBase64: archive.toString("base64"),
      sha256,
      manifestText: manifestText || undefined,
      manifestSha256,
      projectCount: parsed.projectCount,
      variableCount: parsed.variableCount,
      agentAuthIncluded: parsed.agentAuthIncluded,
      sourceHost: os.hostname(),
      sourceRoot: rootDir,
    });
    spinner.stop(response.ok ? "encrypted vault synced" : "vault sync failed");

    if (!response.ok) {
      console.error(chalk.hex("#C46A3A")(`  ${secretVaultErrorMessage(response.status, response.data, "failed to upload encrypted env vault")}`));
      return 1;
    }

    const snapshot = response.data.snapshot;
    if (opts.json) {
      console.log(JSON.stringify(response.data, null, 2));
    } else {
      console.log(chalk.hex("#C46A3A")("  You.md Secret Vault"));
      console.log(`  snapshot: ${snapshot.fileName}`);
      console.log(`  projects: ${snapshot.projectCount}  variables: ${snapshot.variableCount ?? 0}  bytes: ${snapshot.sizeBytes}`);
      console.log(`  sha256:   ${snapshot.sha256.slice(0, 12)}...${snapshot.sha256.slice(-8)}`);
      console.log(chalk.dim("  secret values exposed: false"));
    }
    return 0;
  }

  if (subcommand === "list") {
    const response = await listSecretEnvVaultSnapshots({ limit: 12 });
    if (!response.ok) {
      console.error(chalk.hex("#C46A3A")(`  ${secretVaultErrorMessage(response.status, response.data, "failed to list encrypted env vault snapshots")}`));
      return 1;
    }
    if (opts.json) {
      console.log(JSON.stringify(response.data, null, 2));
      return 0;
    }
    const snapshots = response.data.snapshots;
    if (snapshots.length === 0) {
      console.log(chalk.dim("  no encrypted env vault snapshots uploaded yet"));
      return 0;
    }
    console.log(chalk.hex("#C46A3A")("  You.md Secret Vault snapshots"));
    for (const snapshot of snapshots) {
      const created = new Date(snapshot.createdAt).toISOString();
      console.log(`  ${created}  ${snapshot.fileName}`);
      console.log(chalk.dim(`    ${snapshot.projectCount} projects · ${snapshot.variableCount ?? 0} vars · ${snapshot.sizeBytes} bytes · ${snapshot.sourceHost ?? "unknown host"}`));
    }
    console.log(chalk.dim("  secret values exposed: false"));
    return 0;
  }

  if (subcommand === "pull") {
    const outDir = expandHome(opts.out) ?? defaultCloudVaultDir();
    fs.mkdirSync(outDir, { recursive: true, mode: 0o700 });
    const response = await downloadLatestSecretEnvVaultSnapshot();
    if (!response.ok) {
      if (!opts.printPath) {
        console.error(chalk.hex("#C46A3A")(`  ${secretVaultErrorMessage(response.status, response.data, "failed to download encrypted env vault snapshot")}`));
      }
      return 1;
    }

    const snapshot = response.data.snapshot;
    const safeName = snapshot.fileName.replace(/[\\/]/g, "-");
    const targetPath = path.join(outDir, safeName);
    fs.writeFileSync(targetPath, Buffer.from(response.data.encryptedArchiveBase64, "base64"), { mode: 0o600 });
    if (snapshot.manifestText) {
      const manifestName = `manifest-${snapshot.id}.txt`;
      fs.writeFileSync(path.join(outDir, manifestName), snapshot.manifestText, { mode: 0o600 });
    }

    if (opts.printPath) {
      console.log(targetPath);
    } else if (opts.json) {
      console.log(JSON.stringify({ ...response.data, encryptedArchiveBase64: undefined, path: targetPath }, null, 2));
    } else {
      console.log(chalk.hex("#C46A3A")("  pulled encrypted env vault"));
      console.log(`  path:     ${targetPath}`);
      console.log(`  snapshot: ${snapshot.fileName}`);
      console.log(`  projects: ${snapshot.projectCount}  variables: ${snapshot.variableCount ?? 0}`);
      console.log(chalk.dim("  secret values exposed: false"));
    }

    if (opts.restore) {
      return runEnvRestoreScript(targetPath, {
        root: opts.root,
        force: opts.force,
        list: false,
        mapExisting: opts.mapExisting ?? true,
        existingOnly: opts.existingOnly ?? true,
        skipAgentAuth: opts.skipAgentAuth ?? true,
      });
    }
    return 0;
  }

  console.log("usage: youmd env vault <push|pull|list> [options]");
  console.log("  vault push          encrypt local .env.local files and upload ciphertext to You.md Secret Vault");
  console.log("  vault pull          download the latest encrypted account vault to ~/.youmd/secret-vault");
  console.log("  vault pull --restore --root <dir>");
  console.log("                      restore into cloned project dirs with safe fresh-machine defaults");
  console.log("  vault list          show encrypted vault snapshots without exposing values");
  return 0;
}
