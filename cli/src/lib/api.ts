/**
 * API client for communicating with the You.md Convex backend.
 * Uses the HTTP action endpoints at the Convex site URL.
 */

import { readGlobalConfig } from "./config";

const SITE_URL = "https://uncommon-chicken-142.convex.site";

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
  return res.data;
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
  username: string;
  email: string;
  displayName?: string;
  plan: string;
  createdAt: number;
  latestBundle: {
    version: number;
    isPublished: boolean;
    createdAt: number;
    publishedAt?: number;
  } | null;
  publishedBundle: {
    version: number;
    publishedAt?: number;
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
  args: SaveBundleArgs
): Promise<ApiResponse<any>> {
  // Upload raw bundle data - manifest, youJson, youMd
  // The /api/v1/me/bundle endpoint expects profileData for server-side compilation.
  // For CLI uploads where we already have compiled artifacts, we send them directly.
  return request<any>("/api/v1/me/bundle", {
    method: "POST",
    token: getToken(),
    body: {
      profileData: {
        // Map our compiled bundle back to profile data shape
        // This is a workaround since the endpoint does server-side compilation
        _rawBundle: true,
        manifest: args.manifest,
        youJson: args.youJson,
        youMd: args.youMd,
      },
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

// ─── Analytics ───────────────────────────────────────────────────────

export async function getAnalytics(): Promise<ApiResponse<any>> {
  return request<any>("/api/v1/me/analytics", {
    token: getToken(),
  });
}
