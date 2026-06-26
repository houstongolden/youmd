// storage.ts — `you storage` : large-file / media offload to folder.md.
//
// You.md is text-first; bytes live in folder.md and the brain keeps a pointer string. This is
// the manual-key path (works today): `you storage setup <fmd_live_…>` once, then push/pull/list.
// The zero-user-work server-to-server provisioning is folder.md-side (see
// FOLDERMD_NATIVE_INTEGRATION_PLAN_2026-06-26.md) and will replace the manual setup step.

import * as path from "path";
import chalk from "chalk";
import { readGlobalConfig, writeGlobalConfig } from "../lib/config";
import {
  resolveFolderMdKey,
  listFolders,
  createFolder,
  listFiles,
  uploadFile,
  downloadFile,
  FolderMdFile,
  BrainMediaPointer,
} from "../lib/foldermd";

const ACCENT = chalk.hex("#C46A3A");
const DIM = chalk.dim;

export interface StorageOptions {
  name?: string;
  folder?: string;
  json?: boolean;
}

function usage(): void {
  console.log("");
  console.log("  " + ACCENT("you storage") + DIM("  — large files & media (folder.md)"));
  console.log("");
  console.log("  " + chalk.cyan("setup <fmd_live_key>") + DIM("   save your folder.md key (one time)"));
  console.log("  " + chalk.cyan("status") + DIM("                 show configured key/folder"));
  console.log("  " + chalk.cyan("push <file>") + DIM("            upload a file, print its brain pointer (--name, --folder)"));
  console.log("  " + chalk.cyan("pull <fileId> <dest>") + DIM("   download a file (--folder)"));
  console.log("  " + chalk.cyan("list") + DIM("                   list files in the folder (--folder)"));
  console.log("");
}

/** Resolve the folder id to use: explicit flag → config → null. */
function resolveFolderId(explicit?: string): string | null {
  if (explicit && explicit.trim()) return explicit.trim();
  const cfg = readGlobalConfig();
  return cfg.folderMdFolderId || null;
}

/** Ensure a folder exists for this user; create + persist one if needed. */
async function ensureFolder(apiKey: string, explicit?: string): Promise<string> {
  const existing = resolveFolderId(explicit);
  if (existing) return existing;
  // Try to reuse an existing folder, else create a dedicated one.
  try {
    const folders = (await listFolders({ apiKey })) as Array<{ id?: string; name?: string }>;
    const mine = folders.find((f) => f.name === "you.md media") || folders[0];
    if (mine?.id) {
      persistFolderId(mine.id);
      return mine.id;
    }
  } catch {
    // listing failed — fall through to create
  }
  const created = await createFolder({ apiKey }, "you.md media");
  if (!created.id) throw new Error("folder.md did not return a folder id on create");
  persistFolderId(created.id);
  return created.id;
}

function persistFolderId(id: string): void {
  const cfg = readGlobalConfig();
  if (cfg.folderMdFolderId !== id) {
    cfg.folderMdFolderId = id;
    writeGlobalConfig(cfg);
  }
}

function requireKey(): string | null {
  const key = resolveFolderMdKey();
  if (!key) {
    console.log("");
    console.log("  " + chalk.yellow("no folder.md key configured."));
    console.log("  " + DIM("run ") + chalk.cyan("you storage setup <fmd_live_…>") + DIM(" or set FOLDER_API_KEY"));
    console.log("");
    return null;
  }
  return key;
}

export async function storageCommand(
  subcommand: string | undefined,
  args: string[],
  options: StorageOptions
): Promise<void> {
  if (!subcommand || subcommand === "help") {
    usage();
    return;
  }

  if (subcommand === "setup") {
    const key = args[0];
    if (!key || !key.trim()) {
      console.log(chalk.yellow("  usage: you storage setup <fmd_live_key> [--folder <id>]"));
      process.exitCode = 1;
      return;
    }
    const cfg = readGlobalConfig();
    cfg.folderMdKey = key.trim();
    if (options.folder) cfg.folderMdFolderId = options.folder.trim();
    writeGlobalConfig(cfg);
    console.log("");
    console.log("  " + chalk.green("saved") + DIM(" folder.md key" + (options.folder ? " + folder" : "")));
    console.log("");
    return;
  }

  if (subcommand === "status") {
    const key = resolveFolderMdKey();
    const folder = resolveFolderId(options.folder);
    console.log("");
    console.log("  folder.md key: " + (key ? chalk.green("configured") : chalk.dim("not set")));
    console.log("  folder id:     " + (folder ? chalk.cyan(folder) : chalk.dim("not set (auto-created on first push)")));
    console.log("");
    return;
  }

  if (subcommand === "list") {
    const key = requireKey();
    if (!key) return;
    try {
      const folderId = await ensureFolder(key, options.folder);
      const files = await listFiles({ apiKey: key }, folderId);
      if (options.json) {
        console.log(JSON.stringify({ folderId, files }, null, 2));
        return;
      }
      console.log("");
      if (files.length === 0) {
        console.log("  " + DIM("(no files)"));
      } else {
        for (const f of files) console.log("  " + chalk.cyan(f.id) + DIM(`  ${f.path || f.name || ""}  ${f.size ?? ""}`));
      }
      console.log("");
    } catch (err) {
      console.log(chalk.red("  " + (err as Error).message));
      process.exitCode = 1;
    }
    return;
  }

  if (subcommand === "push") {
    const file = args[0];
    if (!file) {
      console.log(chalk.yellow("  usage: you storage push <file> [--name <destPath>] [--folder <id>]"));
      process.exitCode = 1;
      return;
    }
    const key = requireKey();
    if (!key) return;
    try {
      const folderId = await ensureFolder(key, options.folder);
      const uploaded: FolderMdFile = await uploadFile({ apiKey: key }, folderId, file, {
        destPath: options.name,
      });
      const pointer: BrainMediaPointer = {
        provider: "folder.md",
        folderId,
        fileId: String(uploaded.id),
        name: options.name || path.basename(file),
        mimeType: uploaded.mimeType,
        size: uploaded.size,
        uploadedAt: new Date().toISOString(),
      };
      if (options.json) {
        console.log(JSON.stringify(pointer, null, 2));
        return;
      }
      console.log("");
      console.log("  " + chalk.green("uploaded") + " " + chalk.cyan(pointer.fileId) + DIM(`  ${pointer.name}`));
      console.log("  " + DIM("brain pointer (store in a memory/file):"));
      console.log("  " + JSON.stringify(pointer));
      console.log("");
    } catch (err) {
      console.log(chalk.red("  " + (err as Error).message));
      process.exitCode = 1;
    }
    return;
  }

  if (subcommand === "pull") {
    const fileId = args[0];
    const dest = args[1];
    if (!fileId || !dest) {
      console.log(chalk.yellow("  usage: you storage pull <fileId> <dest> [--folder <id>]"));
      process.exitCode = 1;
      return;
    }
    const key = requireKey();
    if (!key) return;
    try {
      const folderId = resolveFolderId(options.folder);
      if (!folderId) {
        console.log(chalk.yellow("  no folder id — pass --folder <id> or run a push first"));
        process.exitCode = 1;
        return;
      }
      const res = await downloadFile({ apiKey: key }, folderId, fileId, dest);
      console.log("");
      console.log("  " + chalk.green("downloaded") + DIM(`  ${res.bytes} bytes → ${res.path}`));
      console.log("");
    } catch (err) {
      console.log(chalk.red("  " + (err as Error).message));
      process.exitCode = 1;
    }
    return;
  }

  usage();
  process.exitCode = 1;
}
