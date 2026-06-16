import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as child_process from "child_process";
import chalk from "chalk";
import { BrailleSpinner } from "../lib/render";
import {
  mintAccessCode,
  parseAccessCode,
  encryptEnv,
  decryptEnv,
  extractVarNames,
} from "../lib/envHandoff";
import {
  createEnvHandoff,
  claimEnvHandoff,
  listEnvHandoffs,
  apiErrorMessage,
} from "../lib/api";

const ACCENT = "#C46A3A";

/** Resolve the code workspace root shared with `youmd machine projects`. */
function resolveCodeRoot(rootOpt?: string): string {
  if (rootOpt) {
    return rootOpt === "~" || rootOpt.startsWith("~/")
      ? path.join(os.homedir(), rootOpt.slice(2))
      : path.resolve(rootOpt);
  }
  if (process.env.YOUMD_CODE_ROOT) return path.resolve(process.env.YOUMD_CODE_ROOT);
  const candidates = [
    path.join(os.homedir(), "Desktop", "CODE_YOU"),
    path.join(os.homedir(), "Desktop", "CODE_2026"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[1]; // default to the machine-command convention
}

/** Find <root>/<project>/.env.local files (NEVER reads beyond depth 2). */
function findProjectEnvFiles(root: string): Array<{ project: string; file: string }> {
  if (!fs.existsSync(root)) return [];
  const out: Array<{ project: string; file: string }> = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(root, entry.name, ".env.local");
    if (fs.existsSync(file)) out.push({ project: entry.name, file });
  }
  return out;
}

function fmtExpiry(expiresAt: number): string {
  const mins = Math.max(0, Math.round((expiresAt - Date.now()) / 60000));
  if (mins >= 60) return `${Math.round(mins / 60)}h`;
  return `${mins}m`;
}

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

export function envBackupCommand(opts: { root?: string; out?: string }): void {
  const scriptPath = resolveScript("backup.sh");
  assertScriptExists(scriptPath);

  const args: string[] = [];
  if (opts.root) args.push("--root", opts.root);
  if (opts.out) args.push("--out", opts.out);

  // Print the spinner line then stop it before handing the TTY to bash
  // (the script needs an interactive TTY for the passphrase prompt).
  const spinner = new BrailleSpinner("sealing your env vault...");
  spinner.start();
  spinner.stop("handing off to vault script");
  console.log("");

  const result = child_process.spawnSync("bash", [scriptPath, ...args], {
    stdio: "inherit",
  });

  if (result.error) {
    console.error(chalk.hex("#C46A3A")(`  error spawning backup script: ${result.error.message}`));
    process.exit(1);
  }

  process.exit(result.status ?? 0);
}

export function envRestoreCommand(
  vault: string,
  opts: { root?: string; force?: boolean }
): void {
  const scriptPath = resolveScript("restore.sh");
  assertScriptExists(scriptPath);

  // Build arg list — restore.sh expects: [--force] [--root <path>] <vault-file>
  const args: string[] = [];
  if (opts.force) args.push("--force");
  if (opts.root) args.push("--root", opts.root);
  args.push(vault);

  const spinner = new BrailleSpinner("opening the vault...");
  spinner.start();
  spinner.stop("handing off to restore script");
  console.log("");

  const result = child_process.spawnSync("bash", [scriptPath, ...args], {
    stdio: "inherit",
  });

  if (result.error) {
    console.error(chalk.hex("#C46A3A")(`  error spawning restore script: ${result.error.message}`));
    process.exit(1);
  }

  process.exit(result.status ?? 0);
}

// ── env share — push client-side-encrypted .env.local handoffs ────────
//
// SECURITY: secret VALUES never leave this machine except as AES-256-GCM
// ciphertext. The decryption key lives only inside the printed access code.
// Codes are single-use and expire (default 60m). Treat them like passwords.
export async function envShareCommand(opts: {
  root?: string;
  ttl?: string | number;
  reads?: string | number;
  project?: string;
}): Promise<void> {
  const root = resolveCodeRoot(opts.root);
  let files = findProjectEnvFiles(root);
  if (opts.project) {
    files = files.filter((f) => f.project === opts.project);
  }

  if (files.length === 0) {
    console.log(chalk.hex(ACCENT)(`  no .env.local files found under ${root}`));
    console.log(chalk.dim("  pass --root <dir> to point at your code workspace, or --project <name>."));
    return;
  }

  const ttl = Math.max(1, Math.min(1440, Number(opts.ttl) || 60));
  const reads = Math.max(1, Math.min(10, Number(opts.reads) || 1));

  console.log("");
  console.log("  " + chalk.bold("env share") + chalk.dim(`  -- ${files.length} project${files.length === 1 ? "" : "s"} · expires in ${ttl}m · ${reads} read${reads === 1 ? "" : "s"}`));
  console.log("");

  const codes: Array<{ project: string; code: string }> = [];
  for (const { project, file } of files) {
    const spinner = new BrailleSpinner(`sealing ${project}...`);
    spinner.start();
    try {
      const body = fs.readFileSync(file, "utf8");
      const varNames = extractVarNames(body);
      const minted = mintAccessCode();
      const payload = encryptEnv(body, minted.key);
      const res = await createEnvHandoff({
        projectName: project,
        codeHash: minted.codeHash,
        ciphertext: payload.ciphertext,
        iv: payload.iv,
        authTag: payload.authTag,
        varNames,
        byteSize: Buffer.byteLength(body, "utf8"),
        maxReads: reads,
        ttlMinutes: ttl,
      });
      if (!res.ok) {
        spinner.fail(apiErrorMessage(res.data) || `failed (${res.status})`);
        continue;
      }
      spinner.stop(`${varNames.length} var${varNames.length === 1 ? "" : "s"} sealed`);
      codes.push({ project, code: minted.code });
    } catch (err) {
      spinner.fail(err instanceof Error ? err.message : "failed");
    }
  }

  if (codes.length === 0) {
    console.log(chalk.hex(ACCENT)("\n  nothing shared."));
    return;
  }

  console.log("");
  console.log(chalk.dim("  ─ access codes (single-use, expiring) ─ deliver out-of-band ─"));
  for (const { project, code } of codes) {
    console.log(`  ${chalk.hex(ACCENT)(project)}`);
    console.log(`  ${code}`);
    console.log("");
  }
  console.log(chalk.dim("  on the new machine: ") + chalk.cyan("youmd env pull <access-code>"));
  console.log(chalk.dim("  these codes are the only key — do NOT commit, log, or paste them into chat."));
}

// ── env pull — claim + decrypt a handoff onto this machine ────────────
export async function envPullCommand(
  code: string,
  opts: { root?: string; dir?: string; force?: boolean }
): Promise<void> {
  if (!code) {
    console.log("usage: youmd env pull <access-code> [--root <dir>] [--dir <path>] [--force]");
    return;
  }

  let parsed;
  try {
    parsed = parseAccessCode(code);
  } catch (err) {
    console.log(chalk.hex(ACCENT)(`  ${err instanceof Error ? err.message : "invalid access code"}`));
    return;
  }

  const spinner = new BrailleSpinner("claiming handoff...");
  spinner.start();

  const res = await claimEnvHandoff(parsed.codeHash);
  if (!res.ok || !res.data) {
    spinner.fail(apiErrorMessage(res.data) || `failed (${res.status})`);
    if (res.status === 410) console.log(chalk.dim("  that code was already used or has expired. mint a fresh one with `youmd env share`."));
    return;
  }

  let plaintext: string;
  try {
    plaintext = decryptEnv(
      { ciphertext: res.data.ciphertext, iv: res.data.iv, authTag: res.data.authTag },
      parsed.key
    );
  } catch {
    spinner.fail("decryption failed — the access code key does not match this payload");
    return;
  }

  const project = res.data.projectName;
  const targetDir = opts.dir
    ? (opts.dir === "~" || opts.dir.startsWith("~/") ? path.join(os.homedir(), opts.dir.slice(2)) : path.resolve(opts.dir))
    : path.join(resolveCodeRoot(opts.root), project);
  const target = path.join(targetDir, ".env.local");

  if (fs.existsSync(target) && !opts.force) {
    spinner.fail(`refusing to overwrite ${target}`);
    console.log(chalk.dim("  pass --force to replace the existing .env.local (a .bak is kept)."));
    return;
  }

  try {
    fs.mkdirSync(targetDir, { recursive: true });
    if (fs.existsSync(target) && opts.force) {
      fs.copyFileSync(target, `${target}.bak.${Date.now()}`);
    }
    fs.writeFileSync(target, plaintext, { mode: 0o600 });
    try {
      fs.chmodSync(target, 0o600);
    } catch {
      // best-effort on platforms without POSIX modes
    }
  } catch (err) {
    spinner.fail(err instanceof Error ? err.message : "write failed");
    return;
  }

  const names = res.data.varNames;
  spinner.stop(`wrote ${project}/.env.local`);
  console.log(chalk.dim(`  ${names.length} variable${names.length === 1 ? "" : "s"}: ${names.join(", ") || "(none detected)"}`));
  console.log(chalk.dim(`  path: ${target} (mode 0600, gitignored — never commit this)`));
  if (res.data.readsRemaining <= 0) {
    console.log(chalk.dim("  this code is now burned."));
  } else {
    console.log(chalk.dim(`  ${res.data.readsRemaining} read${res.data.readsRemaining === 1 ? "" : "s"} remaining on this code.`));
  }
}

// ── env list — show active handoffs (metadata only) ──────────────────
export async function envListCommand(): Promise<void> {
  const spinner = new BrailleSpinner("checking active handoffs...");
  spinner.start();
  const res = await listEnvHandoffs();
  if (!res.ok || !res.data) {
    spinner.fail(apiErrorMessage(res.data) || `failed (${res.status})`);
    return;
  }
  const handoffs = res.data.handoffs;
  spinner.stop(`${handoffs.length} active`);
  if (handoffs.length === 0) {
    console.log(chalk.dim("  no active env handoffs. share some with `youmd env share`."));
    return;
  }
  console.log("");
  for (const h of handoffs) {
    console.log(`  ${chalk.hex(ACCENT)(h.projectName)} ${chalk.dim(`· ${h.varNames.length} vars · ${fmtExpiry(h.expiresAt)} left · ${h.readsRemaining} read${h.readsRemaining === 1 ? "" : "s"}`)}`);
    if (h.varNames.length) console.log(chalk.dim(`    ${h.varNames.join(", ")}`));
  }
  console.log("");
  console.log(chalk.dim("  values are never shown here — names only. claim with `youmd env pull <code>`."));
}
