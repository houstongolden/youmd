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
  getSecretVaultKeyEnvelope,
  listSecretEnvVaultSnapshots,
  listSecretVaultDevices,
  registerSecretVaultDevice,
  SecretVaultDevice,
  uploadSecretEnvVaultSnapshot,
  upsertSecretVaultKeyEnvelope,
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
  deviceName?: string;
};

type LocalSecretVaultDeviceKey = {
  schemaVersion: "you-md/secret-vault-device-key/v1";
  deviceId: string;
  deviceName: string;
  hostName: string;
  platform: string;
  keyAlgorithm: "rsa-oaep-sha256";
  publicKeyPem: string;
  privateKeyPem: string;
  createdAt: number;
  updatedAt?: number;
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

function deviceKeyDir(): string {
  return path.join(defaultCloudVaultDir(), "devices");
}

function deviceKeyPath(): string {
  return path.join(deviceKeyDir(), "current-device-key.json");
}

function chmodSafe(filePath: string, mode: number): void {
  try {
    fs.chmodSync(filePath, mode);
  } catch {
    // Windows and some external filesystems may ignore POSIX modes.
  }
}

function deviceIdFromPublicKey(publicKeyPem: string): string {
  return `svd_${crypto.createHash("sha256").update(publicKeyPem).digest("hex").slice(0, 24)}`;
}

function defaultDeviceName(): string {
  return `${os.hostname()} (${process.platform})`;
}

function createLocalDeviceKey(deviceName?: string): LocalSecretVaultDeviceKey {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 3072,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const now = Date.now();
  return {
    schemaVersion: "you-md/secret-vault-device-key/v1",
    deviceId: deviceIdFromPublicKey(publicKey),
    deviceName: deviceName || defaultDeviceName(),
    hostName: os.hostname(),
    platform: process.platform,
    keyAlgorithm: "rsa-oaep-sha256",
    publicKeyPem: publicKey,
    privateKeyPem: privateKey,
    createdAt: now,
    updatedAt: now,
  };
}

function loadOrCreateLocalDeviceKey(deviceName?: string): LocalSecretVaultDeviceKey {
  const keyPath = deviceKeyPath();
  if (fs.existsSync(keyPath)) {
    const parsed = JSON.parse(fs.readFileSync(keyPath, "utf-8")) as LocalSecretVaultDeviceKey;
    if (
      parsed.schemaVersion === "you-md/secret-vault-device-key/v1" &&
      parsed.publicKeyPem &&
      parsed.privateKeyPem
    ) {
      const updated: LocalSecretVaultDeviceKey = {
        ...parsed,
        deviceId: parsed.deviceId || deviceIdFromPublicKey(parsed.publicKeyPem),
        deviceName: deviceName || parsed.deviceName || defaultDeviceName(),
        hostName: os.hostname(),
        platform: process.platform,
        keyAlgorithm: "rsa-oaep-sha256",
        updatedAt: Date.now(),
      };
      fs.writeFileSync(keyPath, JSON.stringify(updated, null, 2), { mode: 0o600 });
      chmodSafe(keyPath, 0o600);
      return updated;
    }
  }

  const record = createLocalDeviceKey(deviceName);
  fs.mkdirSync(deviceKeyDir(), { recursive: true, mode: 0o700 });
  chmodSafe(defaultCloudVaultDir(), 0o700);
  chmodSafe(deviceKeyDir(), 0o700);
  fs.writeFileSync(keyPath, JSON.stringify(record, null, 2), { mode: 0o600 });
  chmodSafe(keyPath, 0o600);
  return record;
}

async function registerCurrentSecretVaultDevice(deviceName?: string): Promise<{
  key: LocalSecretVaultDeviceKey;
  device?: SecretVaultDevice;
  status: number;
  ok: boolean;
  error?: unknown;
}> {
  const key = loadOrCreateLocalDeviceKey(deviceName);
  const response = await registerSecretVaultDevice({
    deviceId: key.deviceId,
    deviceName: key.deviceName,
    hostName: key.hostName,
    platform: key.platform,
    publicKeyPem: key.publicKeyPem,
    keyAlgorithm: "rsa-oaep-sha256",
  });
  return {
    key,
    device: response.ok ? response.data.device : undefined,
    status: response.status,
    ok: response.ok,
    error: response.ok ? undefined : response.data,
  };
}

function wrapPassphraseForDevice(passphrase: string, publicKeyPem: string): string {
  return crypto.publicEncrypt(
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(passphrase, "utf-8")
  ).toString("base64");
}

function unwrapPassphraseForCurrentDevice(wrappedPassphraseBase64: string, privateKeyPem: string): string {
  return crypto.privateDecrypt(
    {
      key: privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(wrappedPassphraseBase64, "base64")
  ).toString("utf-8");
}

function keychainAccount(): string {
  return process.env.USER || process.env.LOGNAME || os.userInfo().username || "houston";
}

function readPassphraseFromKeychain(): string | null {
  if (process.platform !== "darwin") return null;
  const service = process.env.YOUMD_ENV_VAULT_KEYCHAIN_SERVICE || "youmd-env-vault";
  const result = child_process.spawnSync(
    "security",
    ["find-generic-password", "-a", keychainAccount(), "-s", service, "-w"],
    { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }
  );
  if (result.status !== 0) return null;
  const passphrase = result.stdout.replace(/\r?\n$/, "");
  return passphrase || null;
}

function promptForPassphrase(): string | null {
  if (!process.stdin.isTTY) return null;
  const script = [
    'printf "You.md vault passphrase: " >&2',
    'IFS= read -r -s PW',
    'printf "\\n" >&2',
    'printf "%s" "$PW"',
  ].join("; ");
  const result = child_process.spawnSync("bash", ["-lc", script], {
    encoding: "utf-8",
    stdio: ["inherit", "pipe", "inherit"],
  });
  if (result.status !== 0) return null;
  return result.stdout || null;
}

function acquireVaultPassphrase(opts: { allowPrompt: boolean }): string | null {
  if (process.env.ENV_VAULT_PASS) return process.env.ENV_VAULT_PASS;
  const keychain = readPassphraseFromKeychain();
  if (keychain) return keychain;
  if (!opts.allowPrompt) return null;
  return promptForPassphrase();
}

function runWithVaultPassphrase<T>(passphrase: string, fn: () => T): T {
  const previous = process.env.ENV_VAULT_PASS;
  process.env.ENV_VAULT_PASS = passphrase;
  try {
    return fn();
  } finally {
    if (previous === undefined) {
      delete process.env.ENV_VAULT_PASS;
    } else {
      process.env.ENV_VAULT_PASS = previous;
    }
  }
}

async function validatePassphraseAgainstLatestVault(passphrase: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const response = await downloadLatestSecretEnvVaultSnapshot();
  if (!response.ok) {
    return {
      ok: false,
      error: secretVaultErrorMessage(response.status, response.data, "failed to download encrypted env vault for passphrase validation"),
    };
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-vault-share-"));
  const targetPath = path.join(tempDir, response.data.snapshot.fileName.replace(/[\\/]/g, "-"));
  try {
    fs.writeFileSync(targetPath, Buffer.from(response.data.encryptedArchiveBase64, "base64"), { mode: 0o600 });
    const status = runWithVaultPassphrase(passphrase, () =>
      runEnvRestoreScript(targetPath, {
        list: true,
        mapExisting: true,
        existingOnly: true,
        skipAgentAuth: true,
      })
    );
    if (status !== 0) {
      return {
        ok: false,
        error: "env-vault passphrase did not decrypt the latest Secret Vault snapshot",
      };
    }
    return { ok: true };
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // best effort cleanup
    }
  }
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

  if (subcommand === "device-register") {
    const spinner = new BrailleSpinner("registering this Mac as a trusted Secret Vault device...");
    spinner.start();
    const result = await registerCurrentSecretVaultDevice(opts.deviceName);
    spinner.stop(result.ok ? "trusted device registered" : "device registration failed");
    if (!result.ok) {
      console.error(chalk.hex("#C46A3A")(`  ${secretVaultErrorMessage(result.status, result.error, "failed to register Secret Vault device")}`));
      return 1;
    }
    if (opts.json) {
      console.log(JSON.stringify({
        success: true,
        device: result.device,
        localKeyPath: deviceKeyPath(),
        secretValuesExposed: false,
      }, null, 2));
    } else {
      console.log(chalk.hex("#C46A3A")("  You.md Secret Vault device"));
      console.log(`  device:  ${result.key.deviceId}`);
      console.log(`  name:    ${result.device?.deviceName ?? result.key.deviceName}`);
      console.log(`  host:    ${result.device?.hostName ?? result.key.hostName}`);
      console.log(`  key:     ${deviceKeyPath()}`);
      console.log(chalk.dim("  private key stays local; public key only was synced"));
      console.log(chalk.dim("  secret values exposed: false"));
    }
    return 0;
  }

  if (subcommand === "device-list") {
    const response = await listSecretVaultDevices();
    if (!response.ok) {
      console.error(chalk.hex("#C46A3A")(`  ${secretVaultErrorMessage(response.status, response.data, "failed to list Secret Vault devices")}`));
      return 1;
    }
    if (opts.json) {
      console.log(JSON.stringify(response.data, null, 2));
      return 0;
    }
    const devices = response.data.devices;
    if (devices.length === 0) {
      console.log(chalk.dim("  no trusted Secret Vault devices registered yet"));
      return 0;
    }
    console.log(chalk.hex("#C46A3A")("  You.md Secret Vault trusted devices"));
    for (const device of devices) {
      const lastSeen = device.lastSeenAt ? new Date(device.lastSeenAt).toISOString() : "never";
      const fingerprint = crypto.createHash("sha256").update(device.publicKeyPem).digest("hex");
      const status = device.revokedAt || !device.trusted ? "revoked" : "trusted";
      console.log(`  ${device.deviceId}  ${status}`);
      console.log(chalk.dim(`    ${device.deviceName} · ${device.hostName ?? "unknown host"} · last seen ${lastSeen}`));
      console.log(chalk.dim(`    public key fingerprint ${fingerprint.slice(0, 12)}...${fingerprint.slice(-8)}`));
    }
    console.log(chalk.dim("  secret values exposed: false"));
    return 0;
  }

  if (subcommand === "share") {
    const registration = await registerCurrentSecretVaultDevice(opts.deviceName);
    if (!registration.ok) {
      console.error(chalk.hex("#C46A3A")(`  ${secretVaultErrorMessage(registration.status, registration.error, "failed to register source Secret Vault device")}`));
      return 1;
    }

    const snapshotsResponse = await listSecretEnvVaultSnapshots({ limit: 1 });
    if (!snapshotsResponse.ok) {
      console.error(chalk.hex("#C46A3A")(`  ${secretVaultErrorMessage(snapshotsResponse.status, snapshotsResponse.data, "failed to list encrypted env vault snapshots")}`));
      return 1;
    }
    const snapshot = snapshotsResponse.data.snapshots[0];
    if (!snapshot) {
      console.error(chalk.hex("#C46A3A")("  no encrypted env vault snapshot exists yet"));
      console.error(chalk.dim("  run `youmd env vault push --root ~/Desktop/CODE_2025 --out ~/Desktop/youmd-env-vault` on the source Mac first"));
      return 1;
    }

    const devicesResponse = await listSecretVaultDevices();
    if (!devicesResponse.ok) {
      console.error(chalk.hex("#C46A3A")(`  ${secretVaultErrorMessage(devicesResponse.status, devicesResponse.data, "failed to list Secret Vault devices")}`));
      return 1;
    }
    const devices = devicesResponse.data.devices.filter((device) => device.trusted && !device.revokedAt);
    if (devices.length === 0) {
      console.error(chalk.hex("#C46A3A")("  no trusted Secret Vault devices are registered yet"));
      console.error(chalk.dim("  run `youmd env vault device-register` on the new Mac, then rerun `youmd env vault share` here"));
      return 1;
    }

    const passphrase = acquireVaultPassphrase({ allowPrompt: true });
    if (!passphrase) {
      console.error(chalk.hex("#C46A3A")("  could not load the env-vault passphrase on this trusted source Mac"));
      console.error(chalk.dim("  set ENV_VAULT_PASS for this command, store macOS Keychain service `youmd-env-vault`, or rerun in an interactive Terminal"));
      return 1;
    }

    const validation = await validatePassphraseAgainstLatestVault(passphrase);
    if (!validation.ok) {
      console.error(chalk.hex("#C46A3A")(`  ${validation.error}`));
      console.error(chalk.dim("  no trusted-device envelopes were written"));
      return 1;
    }

    const spinner = new BrailleSpinner("wrapping vault access for trusted devices...");
    spinner.start();
    let shared = 0;
    for (const device of devices) {
      const wrappedPassphraseBase64 = wrapPassphraseForDevice(passphrase, device.publicKeyPem);
      const response = await upsertSecretVaultKeyEnvelope({
        snapshotId: snapshot.id,
        deviceId: device.deviceId,
        wrappedPassphraseBase64,
        wrapAlgorithm: "rsa-oaep-sha256",
        sourceHost: os.hostname(),
      });
      if (!response.ok) {
        spinner.stop("vault sharing failed");
        console.error(chalk.hex("#C46A3A")(`  ${secretVaultErrorMessage(response.status, response.data, `failed to share vault access for ${device.deviceName}`)}`));
        return 1;
      }
      shared += 1;
    }
    spinner.stop("trusted-device vault access shared");

    if (opts.json) {
      console.log(JSON.stringify({
        success: true,
        snapshot: {
          id: snapshot.id,
          fileName: snapshot.fileName,
          projectCount: snapshot.projectCount,
          variableCount: snapshot.variableCount,
          createdAt: snapshot.createdAt,
        },
        devicesShared: shared,
        secretValuesExposed: false,
      }, null, 2));
    } else {
      console.log(chalk.hex("#C46A3A")("  You.md Secret Vault shared"));
      console.log(`  snapshot: ${snapshot.fileName}`);
      console.log(`  devices:  ${shared}`);
      console.log(chalk.dim("  wrapped passphrases only; raw .env.local values were never uploaded or printed"));
      console.log(chalk.dim("  new Mac restore command: youmd env vault pull --restore --root ~/Desktop/CODE_YOU --map-existing --existing-only --skip-agent-auth"));
    }
    return 0;
  }

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

    let trustedDevicePassphrase: string | null = null;
    if (opts.restore) {
      const registration = await registerCurrentSecretVaultDevice(opts.deviceName);
      if (!registration.ok) {
        console.error(chalk.hex("#C46A3A")(`  ${secretVaultErrorMessage(registration.status, registration.error, "failed to register Secret Vault device before restore")}`));
        return 1;
      }
      const envelopeResponse = await getSecretVaultKeyEnvelope(registration.key.deviceId);
      if (envelopeResponse.ok) {
        try {
          trustedDevicePassphrase = unwrapPassphraseForCurrentDevice(
            envelopeResponse.data.envelope.wrappedPassphraseBase64,
            registration.key.privateKeyPem
          );
          if (!opts.printPath) {
            console.log(chalk.dim(`  trusted-device envelope unlocked for ${registration.key.deviceId}`));
          }
        } catch {
          console.error(chalk.hex("#C46A3A")("  Secret Vault envelope exists but this Mac could not decrypt it"));
          console.error(chalk.dim("  remove/re-register this device key or rerun `youmd env vault share` on the source Mac"));
          return 1;
        }
      } else {
        trustedDevicePassphrase = acquireVaultPassphrase({ allowPrompt: process.stdin.isTTY });
        if (!trustedDevicePassphrase) {
          if (!opts.printPath) {
            console.error(chalk.hex("#C46A3A")(`  ${secretVaultErrorMessage(envelopeResponse.status, envelopeResponse.data, "no trusted-device vault envelope exists for this Mac yet")}`));
            console.error(chalk.dim(`  this Mac is registered as ${registration.key.deviceId}`));
            console.error(chalk.dim("  on the source Mac, run: youmd env vault share"));
            console.error(chalk.dim("  then rerun this restore command; raw .env.local values still never touch the browser or chat"));
          }
          return 1;
        }
        if (!opts.printPath) {
          console.log(chalk.dim("  no trusted-device envelope yet; using local ENV_VAULT_PASS/Keychain/passphrase fallback"));
        }
      }
    }

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
      return runWithVaultPassphrase(trustedDevicePassphrase ?? "", () =>
        runEnvRestoreScript(targetPath, {
          root: opts.root,
          force: opts.force,
          list: false,
          mapExisting: opts.mapExisting ?? true,
          existingOnly: opts.existingOnly ?? true,
          skipAgentAuth: opts.skipAgentAuth ?? true,
        })
      );
    }
    return 0;
  }

  console.log("usage: youmd env vault <push|pull|list|device-register|device-list|share> [options]");
  console.log("  vault push          encrypt local .env.local files and upload ciphertext to You.md Secret Vault");
  console.log("  vault pull          download the latest encrypted account vault to ~/.you/secret-vault");
  console.log("  vault pull --restore --root <dir>");
  console.log("                      restore into cloned project dirs with safe fresh-machine defaults");
  console.log("  vault list          show encrypted vault snapshots without exposing values");
  console.log("  vault device-register");
  console.log("                      register this Mac's local public key as a trusted Secret Vault device");
  console.log("  vault device-list   show trusted devices and public-key fingerprints only");
  console.log("  vault share         wrap the latest vault passphrase to every trusted device");
  return 0;
}
