/**
 * API client for communicating with the You.md Convex backend.
 * Uses the HTTP action endpoints at the Convex site URL.
 */

import { readGlobalConfig, getConvexSiteUrl } from "./config";

const SITE_URL = getConvexSiteUrl();

interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

async function request<T = unknown>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string;
    headers?: Record<string, string>;
  } = {}
): Promise<ApiResponse<T>> {
  const { method = "GET", body, token, headers = {} } = options;

  const reqHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (token) {
    reqHeaders["Authorization"] = `Bearer ${token}`;
  }

  const fetchOptions: RequestInit = {
    method,
    headers: reqHeaders,
  };

  if (body && method !== "GET") {
    fetchOptions.body = JSON.stringify(body);
  }

  const url = `${SITE_URL}${path}`;

  const res = await fetch(url, fetchOptions);

  let data: T;
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    data = (await res.json()) as T;
  } else {
    data = (await res.text()) as unknown as T;
  }

  return {
    ok: res.ok,
    status: res.status,
    data,
  };
}

// ─── Auth endpoints (no token needed) ────────────────────────────────

export async function loginWithEmail(
  email: string,
  password: string
): Promise<ApiResponse<{ success: boolean; username: string; apiKey: string; plan: string }>> {
  return request<{ success: boolean; username: string; apiKey: string; plan: string }>(
    "/api/v1/auth/login",
    { method: "POST", body: { email, password } }
  );
}

export async function registerWithEmail(
  email: string,
  password: string,
  username: string,
  name: string
): Promise<ApiResponse<{ success: boolean; username: string; apiKey: string; clerkId: string }>> {
  return request<{ success: boolean; username: string; apiKey: string; clerkId: string }>(
    "/api/v1/auth/register",
    { method: "POST", body: { email, password, username, name } }
  );
}

// ─── Public endpoints ────────────────────────────────────────────────

export async function checkUsername(
  username: string
): Promise<{ available: boolean; reason: string | null }> {
  const res = await request<{ available: boolean; reason: string | null }>(
    `/api/v1/check-username?username=${encodeURIComponent(username)}`
  );
  return res.data;
}

export async function getPublicProfile(
  username: string
): Promise<{ youJson: unknown; youMd: string; username: string; displayName?: string } | null> {
  const res = await request<any>(
    `/api/v1/profiles?username=${encodeURIComponent(username)}`
  );
  if (!res.ok) return null;

  const data = res.data;

  // The /api/v1/profiles endpoint spreads youJson flat into the response
  // (not wrapped in a youJson property). Detect and wrap it.
  if (data && !data.youJson) {
    // If the response has profile[] or identity{}, the entire response IS the youJson
    if (Array.isArray(data.profile) || data.identity) {
      return {
        youJson: data,
        youMd: data.youMd || data._youMd || "",
        username: data._profile?.username || data.username || username,
        displayName: data._profile?.displayName,
      };
    }
  }

  return data;
}

// ─── Authenticated endpoints ─────────────────────────────────────────

function getToken(): string {
  const config = readGlobalConfig();
  if (!config.token) {
    throw new Error("Not authenticated. Run `youmd login` first.");
  }
  return config.token;
}

export interface MeResponse {
  // Legacy flat fields (kept for backward compat)
  username?: string;
  email?: string;
  displayName?: string;
  plan?: string;
  createdAt?: number;
  // New nested user field (actual API response shape)
  user?: {
    username: string;
    email: string;
    displayName?: string;
    plan: string;
    createdAt: number;
  };
  latestBundle: {
    version: number;
    isPublished: boolean;
    createdAt: number;
    publishedAt?: number;
    youJson?: unknown;
    youMd?: string;
    contentHash?: string;
  } | null;
  publishedBundle: {
    version: number;
    publishedAt?: number;
    contentHash?: string;
  } | null;
  bundleCount: number;
}

export async function getMe(): Promise<ApiResponse<MeResponse>> {
  return request<MeResponse>("/api/v1/me", {
    token: getToken(),
  });
}

export interface RemoteStatus {
  username: string;
  bundleCount: number;
  latestBundle: {
    version: number;
    isPublished: boolean;
    createdAt: number;
  } | null;
  publishedBundle: {
    version: number;
    publishedAt?: number;
  } | null;
}

export async function getRemoteStatus(): Promise<ApiResponse<RemoteStatus>> {
  return request<RemoteStatus>("/api/v1/me", {
    token: getToken(),
  });
}

export interface SaveBundleArgs {
  manifest: unknown;
  youJson: unknown;
  youMd: string;
}

export async function saveBundle(
  args: SaveBundleArgs
): Promise<ApiResponse<{ bundleId: string; version: number }>> {
  return request<{ bundleId: string; version: number }>("/api/v1/me/bundle", {
    method: "POST",
    token: getToken(),
    body: {
      profileData: args, // the server-side saveBundleFromForm expects profileData
    },
  });
}

export async function uploadBundle(
  args: SaveBundleArgs & { parentHash?: string }
): Promise<ApiResponse<any>> {
  // Upload raw bundle data - manifest, youJson, youMd
  // The /api/v1/me/bundle endpoint expects profileData for server-side compilation.
  // For CLI uploads where we already have compiled artifacts, we send them directly.
  return request<any>("/api/v1/me/bundle", {
    method: "POST",
    token: getToken(),
    body: {
      profileData: {
        _rawBundle: true,
        manifest: args.manifest,
        youJson: args.youJson,
        youMd: args.youMd,
      },
      parentHash: args.parentHash,
    },
  });
}

export interface PublishResult {
  version: number;
  username: string;
  url?: string;
}

export async function publishLatest(): Promise<ApiResponse<PublishResult>> {
  return request<PublishResult>("/api/v1/me/publish", {
    method: "POST",
    token: getToken(),
  });
}

// ─── Sources ─────────────────────────────────────────────────────────

export async function addSource(
  sourceType: string,
  sourceUrl: string
): Promise<ApiResponse<{ sourceId: string }>> {
  return request<{ sourceId: string }>("/api/v1/me/sources", {
    method: "POST",
    token: getToken(),
    body: { sourceType, sourceUrl },
  });
}

export async function listSources(): Promise<ApiResponse<any[]>> {
  return request<any[]>("/api/v1/me/sources", {
    token: getToken(),
  });
}

// ─── Memories ───────────────────────────────────────────────────────

export interface MemoryItem {
  category: string;
  content: string;
  source: string;
  sourceAgent?: string;
  tags?: string[];
  createdAt: number;
}

export async function listMemories(opts?: {
  category?: string;
  limit?: number;
}): Promise<ApiResponse<{ memories: MemoryItem[]; count: number }>> {
  const params = new URLSearchParams();
  if (opts?.category) params.set("category", opts.category);
  if (opts?.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  return request<{ memories: MemoryItem[]; count: number }>(
    `/api/v1/me/memories${qs ? `?${qs}` : ""}`,
    { token: getToken() }
  );
}

export async function saveMemories(
  memories: Array<{ category: string; content: string; tags?: string[] }>,
  agentName?: string
): Promise<ApiResponse<{ saved: number }>> {
  return request<{ saved: number }>("/api/v1/me/memories", {
    method: "POST",
    token: getToken(),
    body: { memories, agentName: agentName || "cli" },
  });
}

// ─── Analytics ───────────────────────────────────────────────────────

export async function getAnalytics(): Promise<ApiResponse<any>> {
  return request<any>("/api/v1/me/analytics", {
    token: getToken(),
  });
}

// ─── Context links ──────────────────────────────────────────────────

export interface ContextLink {
  id: string;
  token: string;
  url: string;
  scope: string;
  expiresAt: string;
  maxUses: number | string;
  useCount: number;
  createdAt: string;
  isExpired: boolean;
}

export interface CreateLinkResult {
  id: string;
  token: string;
  url: string;
  scope: string;
  expiresAt: string;
}

export async function createContextLink(opts: {
  scope?: string;
  ttl?: string;
  maxUses?: number;
}): Promise<ApiResponse<CreateLinkResult>> {
  return request<CreateLinkResult>("/api/v1/me/context-links", {
    method: "POST",
    token: getToken(),
    body: {
      scope: opts.scope || "public",
      ttl: opts.ttl || "7d",
      maxUses: opts.maxUses,
    },
  });
}

export async function listContextLinks(): Promise<ApiResponse<ContextLink[]>> {
  return request<ContextLink[]>("/api/v1/me/context-links", {
    token: getToken(),
  });
}

export async function revokeContextLink(linkId: string): Promise<ApiResponse<{ success: boolean }>> {
  return request<{ success: boolean }>("/api/v1/me/context-links", {
    method: "DELETE",
    token: getToken(),
    body: { linkId },
  });
}

// ─── API keys ───────────────────────────────────────────────────────

export interface ApiKeyInfo {
  id: string;
  label: string | null;
  scopes: string[];
  lastUsedAt: string | null;
  createdAt: string;
  isRevoked: boolean;
  keyPrefix: string;
}

export interface CreateKeyResult {
  key: string;
  scopes: string[];
  label?: string;
}

export async function createApiKey(opts: {
  label?: string;
  scopes?: string[];
}): Promise<ApiResponse<CreateKeyResult>> {
  return request<CreateKeyResult>("/api/v1/me/api-keys", {
    method: "POST",
    token: getToken(),
    body: {
      label: opts.label,
      scopes: opts.scopes || ["read:public"],
    },
  });
}

export async function listApiKeys(): Promise<ApiResponse<ApiKeyInfo[]>> {
  return request<ApiKeyInfo[]>("/api/v1/me/api-keys", {
    token: getToken(),
  });
}

export async function revokeApiKey(keyId: string): Promise<ApiResponse<{ success: boolean }>> {
  return request<{ success: boolean }>("/api/v1/me/api-keys", {
    method: "DELETE",
    token: getToken(),
    body: { keyId },
  });
}

// ─── Private context ────────────────────────────────────────────────

export interface PrivateContext {
  privateNotes?: string;
  privateProjects?: Array<{ name: string; description: string; status: string }>;
  internalLinks?: Record<string, string>;
  customData?: unknown;
}

export async function getPrivateContext(): Promise<ApiResponse<PrivateContext | null>> {
  return request<PrivateContext | null>("/api/v1/me/private", {
    token: getToken(),
  });
}

export async function updatePrivateContext(
  updates: Partial<PrivateContext>
): Promise<ApiResponse<{ success: boolean }>> {
  return request<{ success: boolean }>("/api/v1/me/private", {
    method: "POST",
    token: getToken(),
    body: updates,
  });
}

// ─── Skills API ──────────────────────────────────────────────────────

export interface SkillRegistryEntry {
  _id: string;
  name: string;
  description: string;
  version: string;
  scope: string;
  identityFields: string[];
  downloads: number;
  authorId: string;
  createdAt: number;
}

export interface SkillInstallEntry {
  _id: string;
  skillName: string;
  source: string;
  scope: string;
  identityFields: string[];
  installedAt: number;
  lastUsedAt?: number;
  useCount: number;
}

export async function browseSkills(): Promise<ApiResponse<{ skills: SkillRegistryEntry[]; count: number }>> {
  return request<{ skills: SkillRegistryEntry[]; count: number }>("/api/v1/skills");
}

export async function getRegistrySkill(name: string): Promise<ApiResponse<SkillRegistryEntry & { content: string }>> {
  return request<SkillRegistryEntry & { content: string }>(`/api/v1/skills?name=${encodeURIComponent(name)}`);
}

export async function getMySkills(): Promise<ApiResponse<{ skills: SkillInstallEntry[]; count: number }>> {
  return request<{ skills: SkillInstallEntry[]; count: number }>("/api/v1/me/skills", {
    token: getToken(),
  });
}

export async function publishSkill(skill: {
  name: string;
  description: string;
  version: string;
  scope: string;
  identityFields: string[];
  content: string;
}): Promise<ApiResponse<{ id: string; updated: boolean }>> {
  return request<{ id: string; updated: boolean }>("/api/v1/me/skills", {
    method: "POST",
    token: getToken(),
    body: skill,
  });
}

export async function recordSkillInstall(install: {
  skillName: string;
  source: string;
  scope: string;
  identityFields: string[];
}): Promise<ApiResponse<{ id: string; updated: boolean }>> {
  return request<{ id: string; updated: boolean }>("/api/v1/me/skills/install", {
    method: "POST",
    token: getToken(),
    body: install,
  });
}

export async function trackSkillUsage(skillName: string): Promise<ApiResponse<{ success: boolean }>> {
  return request<{ success: boolean }>("/api/v1/me/skills/usage", {
    method: "POST",
    token: getToken(),
    body: { skillName },
  });
}

export async function removeSkillInstall(skillName: string): Promise<ApiResponse<{ success: boolean }>> {
  return request<{ success: boolean }>("/api/v1/me/skills/remove", {
    method: "POST",
    token: getToken(),
    body: { skillName },
  });
}

export async function savePortrait(portrait: {
  lines: string[];
  coloredLines?: unknown;
  cols: number;
  rows: number;
  format: string;
  sourceUrl: string;
}): Promise<ApiResponse<{ success: boolean }>> {
  return request<{ success: boolean }>("/api/v1/me/portrait", {
    method: "POST",
    token: getToken(),
    body: { portrait },
  });
}

// ─── Private vault (encrypted) ──────────────────────────────────────

export interface VaultData {
  initialized: boolean;
  encryptedMd?: string | null;   // base64
  encryptedJson?: string | null; // base64
  iv?: string | null;            // base64
  wrappedVaultKey?: string | null; // base64
  vaultSalt?: string | null;     // base64
  vaultKeyIv?: string | null;    // base64
  createdAt?: number | null;
  updatedAt?: number | null;
}

export async function initVault(wrapped: {
  wrappedVaultKey: string; // base64
  vaultSalt: string;       // base64
  vaultKeyIv: string;      // base64
}): Promise<ApiResponse<{ success: boolean }>> {
  return request<{ success: boolean }>("/api/v1/me/vault/init", {
    method: "POST",
    token: getToken(),
    body: wrapped,
  });
}

export async function saveVaultData(data: {
  encryptedMd: string;   // base64
  encryptedJson: string;  // base64
  iv: string;             // base64
}): Promise<ApiResponse<{ success: boolean }>> {
  return request<{ success: boolean }>("/api/v1/me/vault", {
    method: "POST",
    token: getToken(),
    body: data,
  });
}

export async function getVaultData(): Promise<ApiResponse<VaultData>> {
  return request<VaultData>("/api/v1/me/vault", {
    token: getToken(),
  });
}
