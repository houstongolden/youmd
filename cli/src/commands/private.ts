import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import chalk from "chalk";
import {
  isAuthenticated,
  detectProjectContext,
  readProjectPrivateNotes,
  writeProjectPrivateNotes,
  getProjectPrivateDir,
} from "../lib/config";
import { getPrivateContext, updatePrivateContext, PrivateContext, initVault as apiInitVault, saveVaultData, getVaultData } from "../lib/api";
import { BrailleSpinner } from "../lib/render";
import {
  generateVaultKey,
  encryptVaultKey,
  decryptVaultKey,
  encryptData,
  decryptData,
  saveVaultKey as saveVaultKeyLocal,
  loadVaultKey,
  isVaultInitialized,
  toBase64,
  fromBase64,
} from "../lib/vault";

const ACCENT = chalk.hex("#C46A3A");

/**
 * Check if --global flag is present in args and strip it.
 */
function extractGlobalFlag(args: string[]): { isGlobal: boolean; cleanArgs: string[] } {
  const isGlobal = args.includes("--global");
  const cleanArgs = args.filter((a) => a !== "--global");
  return { isGlobal, cleanArgs };
}

export async function privateCommand(subcommand?: string, ...args: string[]) {
  if (!isAuthenticated()) {
    console.log(chalk.red("not authenticated. run `youmd login` first."));
    process.exit(1);
  }

  const { isGlobal, cleanArgs } = extractGlobalFlag(args);
  const projectCtx = isGlobal ? null : detectProjectContext();

  const cmd = subcommand || "show";

  switch (cmd) {
    case "show": {
      await showAll(projectCtx?.name || null);
      break;
    }

    case "notes": {
      const notesSub = cleanArgs[0];
      if (!notesSub) {
        await showNotes(projectCtx?.name || null);
      } else if (notesSub === "set") {
        if (projectCtx && !isGlobal) {
          await setProjectNotes(projectCtx.name);
        } else {
          await setNotes();
        }
      } else if (notesSub === "append") {
        const text = cleanArgs.slice(1).join(" ");
        if (!text) {
          console.log(chalk.red("usage: youmd private notes append \"text to append\""));
          process.exit(1);
        }
        if (projectCtx && !isGlobal) {
          await appendProjectNotes(projectCtx.name, text);
        } else {
          await appendNotes(text);
        }
      } else {
        console.log(chalk.red(`unknown notes subcommand: ${notesSub}`));
        printUsage();
      }
      break;
    }

    case "links": {
      const linksSub = cleanArgs[0];
      if (!linksSub) {
        await showLinks();
      } else if (linksSub === "add") {
        const label = cleanArgs[1];
        const url = cleanArgs[2];
        if (!label || !url) {
          console.log(chalk.red("usage: youmd private links add <label> <url>"));
          process.exit(1);
        }
        await addLink(label, url);
      } else if (linksSub === "remove") {
        const label = cleanArgs[1];
        if (!label) {
          console.log(chalk.red("usage: youmd private links remove <label>"));
          process.exit(1);
        }
        await removeLink(label);
      } else {
        console.log(chalk.red(`unknown links subcommand: ${linksSub}`));
        printUsage();
      }
      break;
    }

    case "projects": {
      const projectsSub = cleanArgs[0];
      if (!projectsSub) {
        await showProjects();
      } else if (projectsSub === "add") {
        const name = cleanArgs[1];
        if (!name) {
          console.log(chalk.red("usage: youmd private projects add <name> [description]"));
          process.exit(1);
        }
        const description = cleanArgs.slice(2).join(" ") || "";
        await addProject(name, description);
      } else if (projectsSub === "remove") {
        const name = cleanArgs[1];
        if (!name) {
          console.log(chalk.red("usage: youmd private projects remove <name>"));
          process.exit(1);
        }
        await removeProject(name);
      } else {
        console.log(chalk.red(`unknown projects subcommand: ${projectsSub}`));
        printUsage();
      }
      break;
    }

    case "vault": {
      const vaultSub = cleanArgs[0] || "status";
      if (vaultSub === "init") {
        await vaultInit();
      } else if (vaultSub === "status") {
        await vaultStatus();
      } else if (vaultSub === "save") {
        const mdPath = cleanArgs[1];
        const jsonPath = cleanArgs[2];
        if (!mdPath || !jsonPath) {
          console.log(chalk.red("usage: youmd private vault save <md-file> <json-file>"));
          process.exit(1);
        }
        await vaultSave(mdPath, jsonPath);
      } else if (vaultSub === "read") {
        await vaultRead();
      } else {
        console.log(chalk.red(`unknown vault subcommand: ${vaultSub}`));
        printUsage();
      }
      break;
    }

    default:
      printUsage();
      break;
  }
}

function printUsage() {
  console.log(chalk.dim("usage:"));
  console.log("  youmd private                              show all private context");
  console.log("  youmd private notes                        show private notes");
  console.log("  youmd private notes set                    set notes (stdin or prompt)");
  console.log("  youmd private notes append \"text\"          append to notes");
  console.log("  youmd private links                        list private links");
  console.log("  youmd private links add <label> <url>      add a link");
  console.log("  youmd private links remove <label>         remove a link");
  console.log("  youmd private projects                     list private projects");
  console.log("  youmd private projects add <name> [desc]   add a project");
  console.log("  youmd private projects remove <name>       remove a project");
  console.log("");
  console.log(chalk.dim("  encrypted vault:"));
  console.log("  youmd private vault                        show vault status");
  console.log("  youmd private vault init                   create vault (set passphrase)");
  console.log("  youmd private vault save <md> <json>       encrypt and store files");
  console.log("  youmd private vault read                   decrypt and display vault");
  console.log("");
  console.log(chalk.dim("  in a project directory, notes are project-scoped by default."));
  console.log(chalk.dim("  use --global to target global private context instead."));
}

// ── Fetch helper ──────────────────────────────────────────────

async function fetchPrivateContext(): Promise<PrivateContext> {
  const spinner = new BrailleSpinner("fetching private context");
  spinner.start();

  const res = await getPrivateContext();

  if (!res.ok) {
    spinner.fail("failed to fetch private context");
    console.log(chalk.red(`  ${JSON.stringify(res.data)}`));
    process.exit(1);
  }

  spinner.stop();
  return res.data || {};
}

// ── Show all ──────────────────────────────────────────────────

async function showAll(projectName: string | null) {
  // Show project-scoped notes if in a project
  if (projectName) {
    const projectNotes = readProjectPrivateNotes(projectName);
    if (projectNotes) {
      console.log(ACCENT(`  project notes [${projectName}]`));
      for (const line of projectNotes.split("\n")) {
        console.log(chalk.white(`    ${line}`));
      }
      console.log();
    } else {
      console.log(chalk.dim(`  no project-specific notes for ${projectName}.`));
      console.log();
    }
  }

  // Always show global private context
  const ctx = await fetchPrivateContext();

  const hasNotes = !!ctx.privateNotes;
  const hasLinks = ctx.internalLinks && Object.keys(ctx.internalLinks).length > 0;
  const hasProjects = ctx.privateProjects && ctx.privateProjects.length > 0;

  if (!hasNotes && !hasLinks && !hasProjects) {
    if (!projectName) {
      console.log(chalk.dim("  no private context yet."));
      console.log(chalk.dim("  use `youmd private notes set`, `youmd private links add`, or `youmd private projects add` to get started."));
    } else {
      console.log(chalk.dim("  no global private context."));
    }
    return;
  }

  if (projectName) {
    console.log(ACCENT("  global private context"));
    console.log();
  }

  if (hasNotes) {
    console.log(ACCENT("  notes"));
    for (const line of ctx.privateNotes!.split("\n")) {
      console.log(chalk.white(`    ${line}`));
    }
    console.log();
  }

  if (hasLinks) {
    console.log(ACCENT("  links"));
    for (const [label, url] of Object.entries(ctx.internalLinks!)) {
      console.log(`    ${chalk.white(label)} ${chalk.dim(url)}`);
    }
    console.log();
  }

  if (hasProjects) {
    console.log(ACCENT("  projects"));
    for (const p of ctx.privateProjects!) {
      const status = p.status ? chalk.dim(` [${p.status}]`) : "";
      const desc = p.description ? chalk.dim(` - ${p.description}`) : "";
      console.log(`    ${chalk.white(p.name)}${status}${desc}`);
    }
    console.log();
  }
}

// ── Notes ─────────────────────────────────────────────────────

async function showNotes(projectName: string | null) {
  // Show project-scoped notes if in a project
  if (projectName) {
    const projectNotes = readProjectPrivateNotes(projectName);
    if (projectNotes) {
      console.log(ACCENT(`  project notes [${projectName}]`));
      for (const line of projectNotes.split("\n")) {
        console.log(chalk.white(`    ${line}`));
      }
    } else {
      console.log(chalk.dim(`  no project-specific notes for ${projectName}.`));
    }
    console.log();
  }

  // Always show global notes
  const ctx = await fetchPrivateContext();

  if (!ctx.privateNotes) {
    if (!projectName) {
      console.log(chalk.dim("  no private notes set."));
      console.log(chalk.dim("  use `youmd private notes set` to add notes."));
    } else {
      console.log(chalk.dim("  no global private notes."));
    }
    return;
  }

  if (projectName) {
    console.log(ACCENT("  global notes"));
  } else {
    console.log(ACCENT("  notes"));
  }
  for (const line of ctx.privateNotes.split("\n")) {
    console.log(chalk.white(`    ${line}`));
  }
}

async function setNotes() {
  let text: string;

  // Check if stdin has data piped in
  if (!process.stdin.isTTY) {
    text = await readStdin();
  } else {
    // Interactive prompt
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    text = await new Promise<string>((resolve) => {
      console.log(chalk.dim("  enter your private notes (press Ctrl+D when done):"));
      const lines: string[] = [];
      rl.on("line", (line) => lines.push(line));
      rl.on("close", () => resolve(lines.join("\n")));
    });
  }

  if (!text.trim()) {
    console.log(chalk.red("  empty input, notes not updated."));
    return;
  }

  const spinner = new BrailleSpinner("saving notes");
  spinner.start();

  const res = await updatePrivateContext({ privateNotes: text });

  if (!res.ok) {
    spinner.fail("failed to save notes");
    console.log(chalk.red(`  ${JSON.stringify(res.data)}`));
    process.exit(1);
  }

  spinner.stop();
  console.log(chalk.green("  notes saved."));
}

async function appendNotes(text: string) {
  const ctx = await fetchPrivateContext();
  const existing = ctx.privateNotes || "";
  const updated = existing ? `${existing}\n${text}` : text;

  const spinner = new BrailleSpinner("appending to notes");
  spinner.start();

  const res = await updatePrivateContext({ privateNotes: updated });

  if (!res.ok) {
    spinner.fail("failed to append notes");
    console.log(chalk.red(`  ${JSON.stringify(res.data)}`));
    process.exit(1);
  }

  spinner.stop();
  console.log(chalk.green("  appended to notes."));
}

// ── Project-scoped notes ──────────────────────────────────────

async function setProjectNotes(projectName: string) {
  let text: string;

  if (!process.stdin.isTTY) {
    text = await readStdin();
  } else {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    text = await new Promise<string>((resolve) => {
      console.log(chalk.dim(`  enter private notes for project ${projectName} (press Ctrl+D when done):`));
      const lines: string[] = [];
      rl.on("line", (line) => lines.push(line));
      rl.on("close", () => resolve(lines.join("\n")));
    });
  }

  if (!text.trim()) {
    console.log(chalk.red("  empty input, notes not updated."));
    return;
  }

  writeProjectPrivateNotes(projectName, text);
  console.log(chalk.green(`  project notes saved [${projectName}].`));
}

async function appendProjectNotes(projectName: string, text: string) {
  const existing = readProjectPrivateNotes(projectName) || "";
  const updated = existing ? `${existing}\n${text}` : text;
  writeProjectPrivateNotes(projectName, updated);
  console.log(chalk.green(`  appended to project notes [${projectName}].`));
}

// ── Links ─────────────────────────────────────────────────────

async function showLinks() {
  const ctx = await fetchPrivateContext();
  const links = ctx.internalLinks || {};
  const entries = Object.entries(links);

  if (entries.length === 0) {
    console.log(chalk.dim("  no private links."));
    console.log(chalk.dim("  use `youmd private links add <label> <url>` to add one."));
    return;
  }

  console.log(ACCENT(`  links (${entries.length})`));
  for (const [label, url] of entries) {
    console.log(`    ${chalk.white(label)} ${chalk.dim(url)}`);
  }
}

async function addLink(label: string, url: string) {
  const ctx = await fetchPrivateContext();
  const links = ctx.internalLinks || {};
  links[label] = url;

  const spinner = new BrailleSpinner("adding link");
  spinner.start();

  const res = await updatePrivateContext({ internalLinks: links });

  if (!res.ok) {
    spinner.fail("failed to add link");
    console.log(chalk.red(`  ${JSON.stringify(res.data)}`));
    process.exit(1);
  }

  spinner.stop();
  console.log(ACCENT(`  added [${label}] ${url}`));
}

async function removeLink(label: string) {
  const ctx = await fetchPrivateContext();
  const links = ctx.internalLinks || {};

  if (!(label in links)) {
    console.log(chalk.red(`  link "${label}" not found.`));
    const keys = Object.keys(links);
    if (keys.length > 0) {
      console.log(chalk.dim(`  available: ${keys.join(", ")}`));
    }
    return;
  }

  delete links[label];

  const spinner = new BrailleSpinner("removing link");
  spinner.start();

  const res = await updatePrivateContext({ internalLinks: links });

  if (!res.ok) {
    spinner.fail("failed to remove link");
    console.log(chalk.red(`  ${JSON.stringify(res.data)}`));
    process.exit(1);
  }

  spinner.stop();
  console.log(chalk.green(`  removed link "${label}".`));
}

// ── Projects ──────────────────────────────────────────────────

async function showProjects() {
  const ctx = await fetchPrivateContext();
  const projects = ctx.privateProjects || [];

  if (projects.length === 0) {
    console.log(chalk.dim("  no private projects."));
    console.log(chalk.dim("  use `youmd private projects add <name> [description]` to add one."));
    return;
  }

  console.log(ACCENT(`  projects (${projects.length})`));
  for (const p of projects) {
    const status = p.status ? chalk.dim(` [${p.status}]`) : "";
    const desc = p.description ? chalk.dim(` - ${p.description}`) : "";
    console.log(`    ${chalk.white(p.name)}${status}${desc}`);
  }
}

async function addProject(name: string, description: string) {
  const ctx = await fetchPrivateContext();
  const projects = ctx.privateProjects || [];

  const existing = projects.find((p) => p.name === name);
  if (existing) {
    console.log(chalk.red(`  project "${name}" already exists. remove it first to update.`));
    return;
  }

  projects.push({ name, description, status: "active" });

  const spinner = new BrailleSpinner("adding project");
  spinner.start();

  const res = await updatePrivateContext({ privateProjects: projects });

  if (!res.ok) {
    spinner.fail("failed to add project");
    console.log(chalk.red(`  ${JSON.stringify(res.data)}`));
    process.exit(1);
  }

  spinner.stop();
  const desc = description ? chalk.dim(` - ${description}`) : "";
  console.log(ACCENT(`  added project: ${name}${desc}`));
}

async function removeProject(name: string) {
  const ctx = await fetchPrivateContext();
  const projects = ctx.privateProjects || [];

  const idx = projects.findIndex((p) => p.name === name);
  if (idx === -1) {
    console.log(chalk.red(`  project "${name}" not found.`));
    if (projects.length > 0) {
      console.log(chalk.dim(`  available: ${projects.map((p) => p.name).join(", ")}`));
    }
    return;
  }

  projects.splice(idx, 1);

  const spinner = new BrailleSpinner("removing project");
  spinner.start();

  const res = await updatePrivateContext({ privateProjects: projects });

  if (!res.ok) {
    spinner.fail("failed to remove project");
    console.log(chalk.red(`  ${JSON.stringify(res.data)}`));
    process.exit(1);
  }

  spinner.stop();
  console.log(chalk.green(`  removed project "${name}".`));
}

// ── Local file I/O (for pull/push integration) ───────────────

export function writePrivateContextToLocal(bundleDir: string, ctx: PrivateContext): number {
  const privateDir = path.join(bundleDir, "private");
  fs.mkdirSync(privateDir, { recursive: true });

  let filesWritten = 0;

  // Write notes
  if (ctx.privateNotes) {
    fs.writeFileSync(path.join(privateDir, "notes.md"), ctx.privateNotes);
    filesWritten++;
  }

  // Write links
  const links = ctx.internalLinks || {};
  const linkEntries = Object.entries(links);
  if (linkEntries.length > 0) {
    const linksArray = linkEntries.map(([label, url]) => ({ label, url }));
    fs.writeFileSync(path.join(privateDir, "links.json"), JSON.stringify(linksArray, null, 2) + "\n");
    filesWritten++;
  }

  // Write projects
  const projects = ctx.privateProjects || [];
  if (projects.length > 0) {
    fs.writeFileSync(path.join(privateDir, "projects.json"), JSON.stringify(projects, null, 2) + "\n");
    filesWritten++;
  }

  return filesWritten;
}

export function readPrivateContextFromLocal(bundleDir: string): Partial<PrivateContext> {
  const privateDir = path.join(bundleDir, "private");
  const updates: Partial<PrivateContext> = {};

  // Read notes
  const notesPath = path.join(privateDir, "notes.md");
  if (fs.existsSync(notesPath)) {
    updates.privateNotes = fs.readFileSync(notesPath, "utf-8");
  }

  // Read links
  const linksPath = path.join(privateDir, "links.json");
  if (fs.existsSync(linksPath)) {
    try {
      const linksArray = JSON.parse(fs.readFileSync(linksPath, "utf-8")) as Array<{ label: string; url: string }>;
      const linksRecord: Record<string, string> = {};
      for (const { label, url } of linksArray) {
        linksRecord[label] = url;
      }
      updates.internalLinks = linksRecord;
    } catch {
      // skip malformed links.json
    }
  }

  // Read projects
  const projectsPath = path.join(privateDir, "projects.json");
  if (fs.existsSync(projectsPath)) {
    try {
      updates.privateProjects = JSON.parse(fs.readFileSync(projectsPath, "utf-8"));
    } catch {
      // skip malformed projects.json
    }
  }

  return updates;
}

// ── Vault commands ────────────────────────────────────────────

function promptPassphrase(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    // Note: passphrase will be visible in terminal. For true hidden input
    // a library like `read` would be needed, but this keeps deps minimal.
    rl.question(chalk.dim(`  ${prompt}: `), (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function vaultInit() {
  if (isVaultInitialized()) {
    console.log(chalk.yellow("  vault already initialized locally."));
    console.log(chalk.dim("  to re-initialize, delete ~/.youmd/vault-key.enc first."));
    return;
  }

  console.log(ACCENT("  initializing private vault"));
  console.log(chalk.dim("  choose a passphrase to protect your vault key."));
  console.log(chalk.dim("  this passphrase encrypts your vault key — if you lose it, your vault data is unrecoverable."));
  console.log();

  const passphrase = await promptPassphrase("vault passphrase");
  if (!passphrase || passphrase.length < 8) {
    console.log(chalk.red("  passphrase must be at least 8 characters."));
    process.exit(1);
  }

  const confirm = await promptPassphrase("confirm passphrase");
  if (passphrase !== confirm) {
    console.log(chalk.red("  passphrases do not match."));
    process.exit(1);
  }

  const spinner = new BrailleSpinner("generating vault key");
  spinner.start();

  // Generate random vault key
  const vaultKey = generateVaultKey();

  // Wrap it with the passphrase
  const wrapped = encryptVaultKey(vaultKey, passphrase);

  // Save locally
  saveVaultKeyLocal(wrapped);

  // Also push wrapped key to server for web recovery
  const res = await apiInitVault({
    wrappedVaultKey: toBase64(wrapped.encrypted),
    vaultSalt: toBase64(wrapped.salt),
    vaultKeyIv: toBase64(wrapped.iv),
  });

  if (!res.ok) {
    spinner.fail("failed to sync vault key to server");
    console.log(chalk.red(`  ${JSON.stringify(res.data)}`));
    // Local key is still saved, so vault works locally
    console.log(chalk.yellow("  vault key saved locally but not synced to server."));
    return;
  }

  spinner.stop();
  console.log(chalk.green("  vault initialized."));
  console.log(chalk.dim("  vault key saved to ~/.youmd/vault-key.enc"));
  console.log(chalk.dim("  wrapped key synced to server for recovery."));
}

async function vaultStatus() {
  const local = isVaultInitialized();

  console.log(ACCENT("  vault status"));
  console.log(`    local key:  ${local ? chalk.green("initialized") : chalk.dim("not initialized")}`);

  if (!local) {
    console.log(chalk.dim("  run `youmd private vault init` to set up the vault."));
    return;
  }

  const spinner = new BrailleSpinner("checking remote vault");
  spinner.start();

  const res = await getVaultData();
  spinner.stop();

  if (!res.ok) {
    console.log(`    remote:     ${chalk.red("error fetching")}`);
    return;
  }

  const data = res.data;
  console.log(`    remote:     ${data.initialized ? chalk.green("initialized") : chalk.dim("not initialized")}`);
  if (data.initialized && data.encryptedMd) {
    console.log(`    has data:   ${chalk.green("yes")}`);
    if (data.updatedAt) {
      console.log(`    updated:    ${chalk.dim(new Date(data.updatedAt).toISOString())}`);
    }
  } else if (data.initialized) {
    console.log(`    has data:   ${chalk.dim("no (vault key stored, no encrypted data yet)")}`);
  }
}

async function vaultSave(mdPath: string, jsonPath: string) {
  if (!isVaultInitialized()) {
    console.log(chalk.red("  vault not initialized. run `youmd private vault init` first."));
    process.exit(1);
  }

  // Read the files
  const resolvedMd = path.resolve(mdPath);
  const resolvedJson = path.resolve(jsonPath);

  if (!fs.existsSync(resolvedMd)) {
    console.log(chalk.red(`  file not found: ${resolvedMd}`));
    process.exit(1);
  }
  if (!fs.existsSync(resolvedJson)) {
    console.log(chalk.red(`  file not found: ${resolvedJson}`));
    process.exit(1);
  }

  const mdContent = fs.readFileSync(resolvedMd, "utf-8");
  const jsonContent = fs.readFileSync(resolvedJson, "utf-8");

  // Prompt for passphrase to decrypt vault key
  const passphrase = await promptPassphrase("vault passphrase");

  const spinner = new BrailleSpinner("encrypting vault data");
  spinner.start();

  // Load and decrypt vault key
  const wrapped = loadVaultKey();
  if (!wrapped) {
    spinner.fail("vault key file missing");
    process.exit(1);
  }

  let vaultKey: Uint8Array;
  try {
    vaultKey = decryptVaultKey(wrapped.encrypted, passphrase, wrapped.salt, wrapped.iv);
  } catch {
    spinner.fail("wrong passphrase");
    process.exit(1);
  }

  // Encrypt the data
  const encMd = encryptData(mdContent, vaultKey);
  const encJson = encryptData(jsonContent, vaultKey);

  // Push to server
  const res = await saveVaultData({
    encryptedMd: toBase64(encMd.ciphertext),
    encryptedJson: toBase64(encJson.ciphertext),
    // We store both IVs concatenated: first 12 bytes for md, next 12 for json
    iv: toBase64(new Uint8Array([...encMd.iv, ...encJson.iv])),
  });

  if (!res.ok) {
    spinner.fail("failed to save vault data");
    console.log(chalk.red(`  ${JSON.stringify(res.data)}`));
    process.exit(1);
  }

  spinner.stop();
  console.log(chalk.green("  vault data encrypted and saved."));
  console.log(chalk.dim(`  md: ${mdContent.length} chars -> ${encMd.ciphertext.length} bytes encrypted`));
  console.log(chalk.dim(`  json: ${jsonContent.length} chars -> ${encJson.ciphertext.length} bytes encrypted`));
}

async function vaultRead() {
  if (!isVaultInitialized()) {
    console.log(chalk.red("  vault not initialized. run `youmd private vault init` first."));
    process.exit(1);
  }

  // Prompt for passphrase
  const passphrase = await promptPassphrase("vault passphrase");

  const spinner = new BrailleSpinner("fetching vault data");
  spinner.start();

  // Load and decrypt vault key
  const wrapped = loadVaultKey();
  if (!wrapped) {
    spinner.fail("vault key file missing");
    process.exit(1);
  }

  let vaultKey: Uint8Array;
  try {
    vaultKey = decryptVaultKey(wrapped.encrypted, passphrase, wrapped.salt, wrapped.iv);
  } catch {
    spinner.fail("wrong passphrase");
    process.exit(1);
  }

  // Fetch encrypted data from server
  const res = await getVaultData();
  if (!res.ok) {
    spinner.fail("failed to fetch vault data");
    process.exit(1);
  }

  const data = res.data;
  if (!data.initialized || !data.encryptedMd || !data.iv) {
    spinner.stop();
    console.log(chalk.dim("  vault is empty. use `youmd private vault save` to add data."));
    return;
  }

  // Parse the combined IV (12 bytes md + 12 bytes json)
  const combinedIv = fromBase64(data.iv);
  const mdIv = combinedIv.slice(0, 12);
  const jsonIv = combinedIv.slice(12, 24);

  try {
    const mdPlain = decryptData(fromBase64(data.encryptedMd!), mdIv, vaultKey);
    spinner.stop();

    console.log(ACCENT("  vault markdown:"));
    for (const line of mdPlain.split("\n")) {
      console.log(chalk.white(`    ${line}`));
    }
    console.log();

    if (data.encryptedJson) {
      const jsonPlain = decryptData(fromBase64(data.encryptedJson), jsonIv, vaultKey);
      console.log(ACCENT("  vault json:"));
      // Pretty-print JSON
      try {
        const parsed = JSON.parse(jsonPlain);
        for (const line of JSON.stringify(parsed, null, 2).split("\n")) {
          console.log(chalk.white(`    ${line}`));
        }
      } catch {
        // Not valid JSON, just print raw
        for (const line of jsonPlain.split("\n")) {
          console.log(chalk.white(`    ${line}`));
        }
      }
    }
  } catch {
    spinner.fail("decryption failed — data may be corrupted");
    process.exit(1);
  }
}

// ── Helpers ───────────────────────────────────────────────────

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
}
