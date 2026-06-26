// foldermd.ts — You.md ↔ folder.md client (large-file / media offload).
//
// You.md is a structured-TEXT brain: every "file" is a markdown/JSON string in a ~1MB Convex
// bundle, mirrored to GitHub under a 700KB text-only cap. There is NO binary/large-file path.
// folder.md (Houston's own agent-native storage product) fills that slot. The brain stays
// text-first and stores only a POINTER (folder.md folder/file id); the bytes live in folder.md.
//
// Auth today is a per-folder Bearer API key (`fmd_live_…`). The ZERO-USER-WORK provisioning
// (you.md mints a scoped key for the user via a server-to-server call) does NOT exist on the
// folder.md side yet — see FOLDERMD_NATIVE_INTEGRATION_PLAN. Until it lands, this client reads
// a key from config/env (FOLDER_API_KEY / FOLDERMD_API_KEY) so the path is testable now.
//
// NOTE: endpoint shapes are from a docs/source audit of folder.md and need one live-verify
// pass against a real account before being relied on in production.

import * as fs from "fs";
import * as path from "path";
import { readGlobalConfig, writeGlobalConfig } from "./config";

export const FOLDERMD_DEFAULT_BASE = "https://www.folder.md/api/v1";

export interface FolderMdAuth {
  apiKey: string;
  baseUrl?: string;
}

export interface FolderMdFile {
  id: string;
  path?: string;
  name?: string;
  size?: number;
  mimeType?: string;
  [k: string]: unknown;
}

/** Resolve a folder.md API key from explicit arg → config → env. Returns null if none. */
export function resolveFolderMdKey(explicit?: string): string | null {
  if (explicit && explicit.trim()) return explicit.trim();
  const cfg = readGlobalConfig() as Record<string, unknown>;
  const fromCfg = typeof cfg.folderMdKey === "string" ? (cfg.folderMdKey as string) : undefined;
  return (
    fromCfg ||
    process.env.FOLDER_API_KEY ||
    process.env.FOLDERMD_API_KEY ||
    null
  );
}

function baseUrl(auth: FolderMdAuth): string {
  return (auth.baseUrl || process.env.FOLDERMD_BASE_URL || FOLDERMD_DEFAULT_BASE).replace(/\/$/, "");
}

function authHeaders(auth: FolderMdAuth): Record<string, string> {
  return { Authorization: `Bearer ${auth.apiKey}` };
}

async function asError(res: Response): Promise<Error> {
  let body = "";
  try {
    body = await res.text();
  } catch {
    /* ignore */
  }
  return new Error(`folder.md ${res.status} ${res.statusText}${body ? `: ${body.slice(0, 300)}` : ""}`);
}

/**
 * Resolve the folder id to use for this user's media, creating + persisting a dedicated
 * "you.md media" folder if none is configured. Shared by the CLI and the MCP tools so the
 * "which folder?" logic lives in one place.
 */
export async function ensureUserFolder(apiKey: string, explicit?: string): Promise<string> {
  const cfg = readGlobalConfig();
  const existing = (explicit && explicit.trim()) || cfg.folderMdFolderId;
  if (existing) return existing;
  const auth: FolderMdAuth = { apiKey };
  // Reuse an existing folder if present, else create one.
  try {
    const folders = (await listFolders(auth)) as Array<{ id?: string; name?: string }>;
    const mine = folders.find((f) => f.name === "you.md media") || folders[0];
    if (mine?.id) return persistFolderId(mine.id);
  } catch {
    // listing failed — fall through to create
  }
  const created = await createFolder(auth, "you.md media");
  if (!created.id) throw new Error("folder.md did not return a folder id on create");
  return persistFolderId(String(created.id));
}

function persistFolderId(id: string): string {
  const cfg = readGlobalConfig();
  if (cfg.folderMdFolderId !== id) {
    cfg.folderMdFolderId = id;
    writeGlobalConfig(cfg);
  }
  return id;
}

/** List the user's folders (workspaces). */
export async function listFolders(auth: FolderMdAuth): Promise<unknown[]> {
  const res = await fetch(`${baseUrl(auth)}/folders`, {
    headers: authHeaders(auth),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw await asError(res);
  const data = (await res.json()) as { folders?: unknown[] } | unknown[];
  return Array.isArray(data) ? data : data.folders ?? [];
}

/** Create a folder (workspace), e.g. a per-you.md-user media folder. */
export async function createFolder(auth: FolderMdAuth, name: string): Promise<FolderMdFile> {
  const res = await fetch(`${baseUrl(auth)}/folders`, {
    method: "POST",
    headers: { ...authHeaders(auth), "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw await asError(res);
  return (await res.json()) as FolderMdFile;
}

/** List files in a folder. */
export async function listFiles(auth: FolderMdAuth, folderId: string): Promise<FolderMdFile[]> {
  const res = await fetch(`${baseUrl(auth)}/folders/${encodeURIComponent(folderId)}/files`, {
    headers: authHeaders(auth),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw await asError(res);
  const data = (await res.json()) as { files?: FolderMdFile[] } | FolderMdFile[];
  return Array.isArray(data) ? data : data.files ?? [];
}

/**
 * Upload a local file (binary or text) to a folder via multipart. This is the large-file/media
 * path the brain cannot handle. Returns the created file record (store its `id` as the brain
 * pointer). For text-only content the folder.md MCP `file_write` tool is an alternative.
 */
export async function uploadFile(
  auth: FolderMdAuth,
  folderId: string,
  localPath: string,
  options: { destPath?: string; mimeType?: string } = {}
): Promise<FolderMdFile> {
  if (!fs.existsSync(localPath)) throw new Error(`file not found: ${localPath}`);
  const bytes = fs.readFileSync(localPath);
  const name = options.destPath || path.basename(localPath);
  const blob = new Blob([bytes], options.mimeType ? { type: options.mimeType } : undefined);
  const form = new FormData();
  form.append("file", blob, name);
  if (options.destPath) form.append("path", options.destPath);

  const res = await fetch(`${baseUrl(auth)}/folders/${encodeURIComponent(folderId)}/files`, {
    method: "POST",
    headers: authHeaders(auth), // do NOT set Content-Type; fetch sets the multipart boundary
    body: form,
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw await asError(res);
  return (await res.json()) as FolderMdFile;
}

/**
 * Download a file's bytes. folder.md storage is private (no public CDN URL yet), so bytes come
 * back through the authenticated API; you.md proxies/streams them rather than handing out a URL.
 */
export async function downloadFile(
  auth: FolderMdAuth,
  folderId: string,
  fileId: string,
  destPath: string
): Promise<{ bytes: number; path: string }> {
  const url = `${baseUrl(auth)}/folders/${encodeURIComponent(folderId)}/files/${encodeURIComponent(fileId)}?download=true`;
  const res = await fetch(url, { headers: authHeaders(auth), signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw await asError(res);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(path.resolve(destPath)), { recursive: true });
  fs.writeFileSync(destPath, buf);
  return { bytes: buf.length, path: destPath };
}

/**
 * The brain pointer: what you.md stores (as a plain string, which the bundle handles perfectly)
 * to reference a media artifact living in folder.md. Embed JSON.stringify(this) in a memory or
 * custom_file. No bytes ever enter the brain.
 */
export interface BrainMediaPointer {
  provider: "folder.md";
  folderId: string;
  fileId: string;
  name: string;
  mimeType?: string;
  size?: number;
  uploadedAt: string;
}
