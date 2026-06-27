import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { detectAgent } from "./lib/agentDetect";
import { isKnownScope, type ApiScope } from "./lib/scopes";
import { HOSTED_MCP_TOOLS, type McpAuthContext } from "./lib/mcpRegistry";
import { deriveStacks } from "./github";
// T14: agentContext imports moved to convex/lib/mcpRegistry.ts (used by tool handlers).
// http.ts retains only the imports it directly uses for non-MCP routes.
import { errorEnvelope, sanitizedServerErrorEnvelope, type ErrorCode } from "./lib/httpErrors";
import {
  AGENT_WRITABLE_MEMORY_CATEGORIES,
  invalidMemoryCategoryMessage,
  resolveMemoryCategory,
} from "./lib/memoryCategories";
import {
  BUILD_RATE_LIMIT,
  WRITE_RATE_LIMIT,
  buildRateLimitHeaders,
  type WriteRateLimit,
} from "./lib/writeLimits";
import { filterClientMessages, YOU_AGENT_SYSTEM_PROMPT } from "./chat";
import { isKnownBrainScope } from "./lib/brainScopes";

const http = httpRouter();

/**
 * Cycle 43 — Trusted internal auth token bypass for httpAction-→mutation calls.
 *
 * Background: cycles 37/38 added requireOwner; cycle 42 made it strict (throw
 * on null Clerk identity) after a live exploit verified that anonymous public
 * /api/query and /api/mutation callers could read+write any user's private
 * data. The strict fix broke httpAction routes that authenticate via API key
 * Bearer token, because the inner mutation's ctx.auth.getUserIdentity() is
 * null in httpAction context (no Clerk JWT, only API key).
 *
 * Cycle 43 fix: HTTP routes pass this server-side-only token in
 * `_internalAuthToken`. requireOwner accepts it as a bypass (validated against
 * the same env var). Public /api/query and /api/mutation callers cannot guess
 * the value (256 bits of entropy), and the token is never sent to clients or
 * logged. See convex/lib/auth.ts for the full security analysis.
 */
const TRUSTED_INTERNAL_AUTH_TOKEN = process.env.TRUSTED_INTERNAL_AUTH_TOKEN;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, If-None-Match, Idempotency-Key",
};

const SECRET_VAULT_MAX_BYTES = 8 * 1024 * 1024;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.slice(offset, offset + chunkSize);
    for (let i = 0; i < chunk.length; i += 1) {
      binary += String.fromCharCode(chunk[i]);
    }
  }
  return btoa(binary);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return bytesToBase64(new Uint8Array(buffer));
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const bytes = base64ToBytes(base64);
  return bytes.buffer;
}

function omitSecretVaultManifest<T extends { manifestText?: unknown }>(snapshot: T): Omit<T, "manifestText"> & { manifestText?: undefined } {
  const { manifestText: _manifestText, ...safe } = snapshot;
  return { ...safe, manifestText: undefined };
}

// Helper for JSON responses
function json(data: unknown, status = 200, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

/**
 * P21 — canonical error responses. Every error return in this file routes
 * through here so the body is always `{ error: { code, message }, message }`
 * (see convex/lib/httpErrors.ts for the envelope contract and the CLI
 * back-compat rationale for the top-level message mirror). Status codes and
 * CORS behavior are unchanged — this wraps the same json() helper.
 */
export function errorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  extra?: Record<string, unknown>,
  extraHeaders?: Record<string, string>
) {
  return json(errorEnvelope(code, message, extra), status, extraHeaders);
}

/**
 * T13 — every unexpected-exception 500 in this file routes through here.
 * The caught error is logged server-side with its route context; the client
 * only ever sees the generic, route-scoped `publicMessage`. NEVER pass
 * err.message into a 5xx response body.
 */
function serverErrorResponse(
  context: string,
  err: unknown,
  publicMessage: string,
  extra?: Record<string, unknown>
) {
  return json(sanitizedServerErrorEnvelope(context, err, publicMessage, extra), 500);
}

/**
 * P13 — cursor pagination on list endpoints (PRODUCT-AUDIT #15,
 * FEATURE-ROADMAP 2.9).
 *
 * Contract (additive, fully backward compatible):
 *   - Every list endpoint accepts optional `?cursor=` + `?limit=` params.
 *   - When NEITHER is supplied the response is byte-identical to the legacy
 *     behavior (same query, same counts, same ordering, same shape).
 *   - When either is supplied the underlying Convex-native `.paginate()`
 *     query runs and the response carries the existing array field PLUS
 *     `nextCursor` (string | null) and `hasMore` (boolean). Endpoints that
 *     historically returned a bare JSON array return the envelope object
 *     only in this opted-in mode (a bare array cannot carry extra fields).
 *   - Cursors are opaque Convex index cursors — never offsets over
 *     in-memory slices. Pass `nextCursor` back as `?cursor=` to continue.
 */
function parseListPagination(
  url: URL,
  maxLimit = 200
): { cursor: string | null; limit: number | null; paginated: boolean } {
  const cursor = url.searchParams.get("cursor");
  let limit: number | null = null;
  if (url.searchParams.has("limit")) {
    const raw = parseInt(url.searchParams.get("limit")!, 10);
    if (Number.isFinite(raw)) limit = Math.min(Math.max(raw, 1), maxLimit);
  }
  return { cursor, limit, paginated: cursor !== null || limit !== null };
}

/** Additive pagination fields derived from a Convex PaginationResult. */
function pageMeta(result: { isDone: boolean; continueCursor: string }) {
  return {
    nextCursor: result.isDone ? null : result.continueCursor,
    hasMore: !result.isDone,
  };
}

/** Map a dynamic HTTP status to a sensible machine code (pass-through errors). */
export function codeForStatus(status: number): ErrorCode {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 410) return "gone";
  if (status === 413) return "payload_too_large";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_error";
  return "invalid_request";
}

// ============================================================
// PUBLIC ENDPOINTS
// ============================================================

// Stable hash helper for ETag generation when contentHash is unavailable
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Link header pointing agents at the you-md/v1 JSON Schema
const SCHEMA_LINK_HEADER =
  '<https://you.md/schema/you-md/v1.json>; rel="describedby"; type="application/schema+json"';

const CONTEXT_LINK_CACHE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Accept",
};

function wantsMarkdown(accept: string): boolean {
  const normalized = accept.toLowerCase();
  const acceptsJson =
    normalized.includes("application/vnd.you-md.v1+json") ||
    normalized.includes("application/json") ||
    normalized.includes("+json");

  if (acceptsJson) return false;

  return normalized.includes("text/markdown") || normalized.includes("text/plain");
}

// GET /api/v1/health — Service health: status, schemaVersion, time + a cheap db probe (200 ok, 503 when the db probe fails)
http.route({
  path: "/api/v1/health",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const time = new Date().toISOString();
    try {
      await ctx.runQuery(internal.health.probe, {});
      return json(
        { status: "ok", schemaVersion: "you-md/v1", time, checks: { db: "ok" } },
        200,
        { "Cache-Control": "no-store" }
      );
    } catch (err) {
      // Sanitized: the probe failure detail goes to server logs only.
      console.error("[http:health] db probe failed:", err);
      return errorResponse(
        "upstream_unavailable",
        "database probe failed",
        503,
        { status: "error", schemaVersion: "you-md/v1", time, checks: { db: "error" } },
        { "Cache-Control": "no-store" }
      );
    }
  }),
});

// GET /api/v1/profiles — List all profiles (no params) or get single profile (?username=xxx)
http.route({
  path: "/api/v1/profiles",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const username = url.searchParams.get("username");

    // No username param — return list of all public profiles (for sitemap, directory)
    if (!username) {
      const profiles = await ctx.runQuery(api.profiles.listAll);
      const usernames = profiles.map((profile: Record<string, unknown>) => {
        const p = profile as Record<string, unknown>;
        return {
          username: String(p.username ?? ""),
          name: typeof p.name === "string" ? p.name : null,
          tagline: typeof p.tagline === "string" ? p.tagline : null,
          location: typeof p.location === "string" ? p.location : null,
          avatarUrl: typeof p.avatarUrl === "string" ? p.avatarUrl : null,
          hasPortrait: Boolean(p.avatarUrl || p.asciiPortrait),
          isClaimed: Boolean(p.isClaimed),
          updatedAt: typeof p.updatedAt === "number" ? p.updatedAt : typeof p.createdAt === "number" ? p.createdAt : null,
        };
      });
      return json(usernames, 200, { "Cache-Control": "public, max-age=300" });
    }

    const profile = await ctx.runQuery(api.profiles.getPublicProfile, {
      username,
    });

    if (!profile) {
      return errorResponse("not_found", "Profile not found", 404);
    }

    // Compute a stable ETag.
    // Prefer the bundle's contentHash (already SHA-256 of canonicalized
    // youJson+youMd); fall back to a hash of profileId + updatedAt so it
    // still changes across saves.
    const profileAny = profile as Record<string, unknown>;
    const explicitHash = profileAny.contentHash as string | undefined;
    const etagValue =
      explicitHash ||
      (await sha256Hex(
        `${profileAny.profileId ?? username}:${profileAny.updatedAt ?? ""}`
      ));
    const etag = `"${etagValue}"`;

    // Honor If-None-Match — return 304 without body
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          ETag: etag,
          Link: SCHEMA_LINK_HEADER,
          "Cache-Control": "public, max-age=60",
          ...CORS_HEADERS,
        },
      });
    }

    // Record the view as an agent read
    await ctx.runMutation(api.profiles.recordView, {
      username,
      referrer: request.headers.get("referer") ?? undefined,
      isAgentRead: true,
    });

    // Log cross-agent activity (best-effort — skip silently if user lookup fails)
    try {
      const agent = detectAgent(request.headers.get("user-agent"));
      const ownerUser = await ctx.runQuery(internal.users.getByUsername, { username });
      if (ownerUser) {
        const profileIdRaw =
          (profileAny.profileId as Id<"profiles"> | undefined) ?? undefined;
        await ctx.runMutation(internal.activity.logActivity, {
          userId: ownerUser._id,
          profileId: profileIdRaw,
          agentName: agent.name,
          agentSource: agent.source,
          agentVersion: agent.version,
          action: "read",
          resource: "identity",
          status: "success",
          details: {
            username,
            accept: request.headers.get("accept") ?? undefined,
          },
        });
      }
    } catch {
      // swallow logging errors — never break the main request
    }

    const accept = request.headers.get("accept") ?? "";

    // Return markdown if requested
    if (wantsMarkdown(accept)) {
      return new Response(profile.youMd, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          Link: SCHEMA_LINK_HEADER,
          ETag: etag,
          ...CORS_HEADERS,
          "Cache-Control": "public, max-age=60",
        },
      });
    }

    // Repo-hosted public stacks (only present when the user's repo is public).
    let repoStacks: unknown = null;
    try {
      repoStacks = await ctx.runQuery(api.github.getPublicRepoStacks, { username });
    } catch {
      // non-fatal — never break the profile read
    }

    // Merge profile-level fields into youJson for richer SEO data.
    // P31 (PRODUCT-AUDIT #39): the compiled youJson already self-describes
    // via `schema: "you-md/v1"` (convex/lib/compile.ts); `schemaVersion` is
    // the additive alias matching the bundles-table field name, defaulted in
    // for older/unclaimed payloads that predate it. Existing keys win.
    const enrichedJson = {
      schemaVersion: "you-md/v1",
      ...(profile.youJson as Record<string, unknown>),
      _profile: {
        avatarUrl: profile.avatarUrl ?? null,
        asciiPortrait: profile.asciiPortrait ?? null,
        displayName: profile.displayName ?? null,
        isClaimed: profile.isClaimed ?? false,
        source: profile.source,
        repoStacks: repoStacks ?? null,
      },
    };
    return new Response(JSON.stringify(enrichedJson, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.you-md.v1+json",
        Link: SCHEMA_LINK_HEADER,
        ETag: etag,
        ...CORS_HEADERS,
        "Cache-Control": "public, max-age=60",
      },
    });
  }),
});

// GET /api/v1/check-username?username=xxx — Check availability
http.route({
  path: "/api/v1/check-username",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const username = url.searchParams.get("username");

    if (!username) {
      return errorResponse("invalid_request", "Username parameter required", 400);
    }

    const result = await ctx.runQuery(api.profiles.checkUsername, { username });
    return json(result);
  }),
});

// ============================================================
// CONTEXT LINKS
// ============================================================

// GET /ctx?token=xxx — Resolve a context link
http.route({
  path: "/ctx",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const token = url.searchParams.get("token");

      if (!token) {
        return errorResponse("invalid_request", "Token parameter required", 400, undefined, CONTEXT_LINK_CACHE_HEADERS);
      }

      const raw = await ctx.runQuery(api.contextLinks.resolveLink, { token });
      const result = raw as Record<string, unknown>;

      if ("error" in result) {
        return errorResponse(codeForStatus((result.status as number) || 400), String(result.error), (result.status as number) || 400, undefined, CONTEXT_LINK_CACHE_HEADERS);
      }

      // Increment use count. This is observability/rate-accounting, not the
      // payload itself; never let a tracking write break a valid context link.
      try {
        await ctx.runMutation(internal.contextLinks.incrementUseCount, { token });
      } catch {
        // non-fatal
      }

      // Record the view
      try {
        await ctx.runMutation(api.profiles.recordView, {
          username: result.username as string,
          referrer: request.headers.get("referer") ?? undefined,
          isAgentRead: true,
          isContextLink: true,
        });
      } catch {
        // non-fatal
      }

      // Log cross-agent activity for context-link resolution
      try {
        const linkMeta = await ctx.runQuery(api.contextLinks.getLinkMeta, { token });
        if (linkMeta) {
          const uaAgent = detectAgent(request.headers.get("user-agent"));
          // Always mark source as "context-link" regardless of UA, since the
          // caller reached us via a shareable link. Keep the parsed name though.
          await ctx.runMutation(internal.activity.logActivity, {
            userId: linkMeta.userId,
            profileId: linkMeta.profileId,
            agentName: uaAgent.name,
            agentSource: "context-link",
            agentVersion: uaAgent.version,
            action: "read",
            resource: "identity",
            scope: linkMeta.scope,
            tokenId: linkMeta._id,
            status: "success",
            details: {
              username: result.username,
              linkName: linkMeta.name,
            },
          });
        }
      } catch {
        // swallow logging errors
      }

      const accept = request.headers.get("accept") ?? "";

      // Build the JSON body once so we can hash it for ETag
      const jsonBody = JSON.stringify(
        {
          schema: "you-md/v1",
          username: result.username,
          scope: result.scope,
          ...(result.bundle as Record<string, unknown>),
          ...(result.privateContext
            ? { _privateContext: result.privateContext }
            : {}),
        },
        null,
        2
      );

      // Compute a stable ETag from token + scope + body hash. The scope is
      // included so that public/full variants of the same token never collide.
      const etagValue = await sha256Hex(`${token}:${result.scope}:${jsonBody.length}:${await sha256Hex(jsonBody)}`);
      const etag = `"${etagValue}"`;

      // Honor If-None-Match — return 304 with no body
      const ifNoneMatch = request.headers.get("if-none-match");
      if (ifNoneMatch && ifNoneMatch === etag) {
        return new Response(null, {
          status: 304,
          headers: {
            ETag: etag,
            Link: SCHEMA_LINK_HEADER,
            ...CONTEXT_LINK_CACHE_HEADERS,
            ...CORS_HEADERS,
          },
        });
      }

      // Return markdown if requested
      if (wantsMarkdown(accept)) {
        return new Response(result.markdown as string, {
          status: 200,
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            ETag: etag,
            Link: SCHEMA_LINK_HEADER,
            ...CONTEXT_LINK_CACHE_HEADERS,
            ...CORS_HEADERS,
          },
        });
      }

      return new Response(jsonBody, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.you-md.v1+json",
          ETag: etag,
          Link: SCHEMA_LINK_HEADER,
          ...CONTEXT_LINK_CACHE_HEADERS,
          ...CORS_HEADERS,
        },
      });
    } catch {
      return errorResponse(
        "server_error",
        "Failed to resolve context link",
        500,
        undefined,
        CONTEXT_LINK_CACHE_HEADERS
      );
    }
  }),
});

// ============================================================
// AUTHENTICATED ENDPOINTS (API key auth)
// ============================================================

// Cycle 57: auth context now carries the key's scopes for enforcement.
// `scopes: null` = legacy grandfathered key (full access, scope_missing
// telemetry); `declaredScopes` = raw scopes stored on the key (for logging).
type AuthContext = {
  credentialType: "api-key" | "connected-app";
  userId: string; // clerkId (compat with /me convex functions)
  username: string;
  plan: string;
  scopes: string[] | null;
  declaredScopes: string[];
  userDbId: Id<"users">;
  apiKeyId?: Id<"apiKeys">;
  connectedAppGrantId?: Id<"connectedAppGrants">;
  appSlug?: string;
  appName?: string;
  appType?: string;
  resourceScopes?: string[];
  writePolicy?: string;
  trustLevel?: string;
};

function authAgentSource(auth: AuthContext, request: Request): "mcp" | "api-key" | "connected-app" {
  if (auth.credentialType === "connected-app") return "connected-app";
  const agent = detectAgent(request.headers.get("user-agent"));
  return agent.source === "mcp" ? "mcp" : "api-key";
}

function connectedAppResourceForPath(pathname: string): string {
  if (pathname.includes("/sources")) return "sources";
  if (pathname.includes("/memories")) return "memories";
  if (pathname.includes("/stacks") || pathname.includes("/stack") || pathname.includes("/repo")) return "stacks";
  if (pathname.includes("/activity") || pathname.includes("/history")) return "activity";
  if (pathname.includes("/private")) return "memories";
  if (pathname.includes("/projects")) return "projects";
  if (pathname.includes("/preferences")) return "preferences";
  return "identity";
}

function connectedAppScopeCandidates(scope: ApiScope, resource: string): string[] {
  if (scope === "read:private") return [`${resource}:read`];
  if (scope === "write:memories") return ["memories:write"];
  if (scope === "write:bundle") {
    if (resource === "sources") return ["sources:write"];
    if (resource === "projects") return ["projects:write"];
    if (resource === "preferences") return ["preferences:write"];
    if (resource === "stacks") return ["stacks:write"];
    if (resource === "activity") return ["activity:write"];
    if (resource === "memories") return ["memories:write"];
    return ["identity:write"];
  }
  return [];
}

function connectedAppResourceForMcpTool(toolName: string): string {
  if (toolName === "get_my_stacks" || toolName === "get_repo_file" || toolName === "get_agent_stack_inventory" || toolName === "get_synced_brain_graph") return "stacks";
  if (toolName === "search_memories" || toolName === "report_skill_outcome") return "memories";
  return "identity";
}

// Helper: validate API key and return user
async function authenticateRequest(
  ctx: Pick<ActionCtx, "runQuery" | "runMutation">,
  request: Request
): Promise<AuthContext | Response> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse("unauthorized", "Missing or invalid Authorization header", 401);
  }

  const key = authHeader.substring(7);
  if (!key) {
    return errorResponse("unauthorized", "Missing API key in Authorization header", 401);
  }

  // Hash the key and look it up
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  if (key.startsWith("yg_")) {
    const grant = await ctx.runQuery(api.connectedApps.getByTokenHash, { tokenHash: keyHash });

    if (!grant) {
      return errorResponse("unauthorized", "Invalid, expired, or revoked connected-app grant", 401);
    }

    await ctx.runMutation(internal.connectedApps.updateLastUsed, {
      grantId: grant.id,
    });

    return {
      credentialType: "connected-app",
      userId: grant.userId,
      username: grant.username,
      plan: grant.plan,
      scopes: grant.scopes,
      declaredScopes: grant.scopes,
      userDbId: grant.userDbId,
      connectedAppGrantId: grant.id,
      appSlug: grant.appSlug,
      appName: grant.appName,
      appType: grant.appType,
      resourceScopes: grant.resourceScopes,
      writePolicy: grant.writePolicy,
      trustLevel: grant.trustLevel,
    };
  }

  const apiKey = await ctx.runQuery(api.apiKeys.getByHash, { keyHash });

  if (!apiKey || apiKey.revokedAt) {
    return errorResponse("unauthorized", "Invalid or revoked API key", 401);
  }

  // Cycle 56: enforce key expiry. Existing keys without expiresAt continue
  // working indefinitely (backward-compat — getByHash returns undefined for
  // keys created before cycle 56's schema change).
  if (apiKey.expiresAt && apiKey.expiresAt < Date.now()) {
    return errorResponse("unauthorized", "API key has expired", 401);
  }

  // Update last used (cycle 49: now via internal.* — was api.* before)
  await ctx.runMutation(internal.apiKeys.updateLastUsed, {
    keyId: apiKey._id,
  });

  return {
    credentialType: "api-key",
    userId: apiKey.userId,
    username: apiKey.username,
    plan: apiKey.plan,
    scopes: apiKey.scopes ?? null,
    declaredScopes: apiKey.declaredScopes ?? [],
    userDbId: apiKey.userDbId,
    apiKeyId: apiKey._id,
  };
}

/**
 * Cycle 57 (audit finding #1): per-route scope enforcement.
 *
 * Returns null when the request may proceed, or a 403 Response when the key
 * lacks the required scope. Legacy grandfathered keys (`auth.scopes === null`
 * — keys created before the enforcement epoch, including pre-epoch "cli-auth"
 * login keys; new logins get full owner scopes — P36) always proceed,
 * but a `scope_missing` activity event is logged whenever their declared
 * scopes wouldn't have covered the call, so real usage can be measured before
 * tightening. Denied calls for scoped keys are logged with status "denied".
 *
 * Usage, immediately after the auth guard in every authenticated route:
 *   const denied = await requireScope(ctx, request, auth, "write:bundle");
 *   if (denied) return denied;
 */
async function requireScope(
  ctx: Pick<ActionCtx, "runMutation">,
  request: Request,
  auth: AuthContext,
  scope: ApiScope,
  connectedAppResourceHint?: string
): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;

  if (auth.credentialType === "connected-app") {
    const resource = connectedAppResourceHint ?? connectedAppResourceForPath(pathname);
    const acceptedScopes = connectedAppScopeCandidates(scope, resource);
    const hasResource = auth.resourceScopes?.includes(resource) ?? false;
    const hasScope = acceptedScopes.some((candidate) => auth.scopes?.includes(candidate));
    const isWrite = acceptedScopes.some((candidate) => candidate.endsWith(":write"));
    const writeAllowed = !isWrite || auth.writePolicy === "approved_write";

    if (!hasResource || !hasScope || !writeAllowed) {
      try {
        const agent = detectAgent(request.headers.get("user-agent"));
        await ctx.runMutation(internal.activity.logActivity, {
          userId: auth.userDbId,
          agentName: auth.appName || agent.name,
          agentSource: "connected-app",
          agentVersion: agent.version,
          action: "scope_missing",
          resource: pathname,
          scope,
          connectedAppGrantId: auth.connectedAppGrantId,
          status: "denied",
          details: {
            appSlug: auth.appSlug,
            acceptedScopes,
            declaredScopes: auth.declaredScopes,
            resourceScopes: auth.resourceScopes,
            writePolicy: auth.writePolicy,
            requiredResource: resource,
          },
        });
      } catch {
        // best-effort
      }
      const reason = !writeAllowed
        ? "Connected-app grant write policy requires approved_write"
        : `Connected-app grant lacks required scope: ${acceptedScopes.join(" or ") || scope}`;
      return errorResponse("scope_missing", reason, 403);
    }

    return null;
  }

  const hasScope =
    auth.scopes === null
      ? auth.declaredScopes.includes(scope)
      : auth.scopes.includes(scope);

  if (auth.scopes === null) {
    // Legacy grandfathered key: allow, but record scope_missing telemetry
    // when its declared scopes wouldn't have covered this call.
    if (!hasScope) {
      try {
        const agent = detectAgent(request.headers.get("user-agent"));
        await ctx.runMutation(internal.activity.logActivity, {
          userId: auth.userDbId,
          agentName: agent.name,
          agentSource: agent.source === "mcp" ? "mcp" : "api-key",
          agentVersion: agent.version,
          action: "scope_missing",
          resource: new URL(request.url).pathname,
          scope,
          apiKeyId: auth.apiKeyId,
          status: "allowed",
          details: { declaredScopes: auth.declaredScopes, legacy: true },
        });
      } catch {
        // telemetry is best-effort — never block the request on it
      }
    }
    return null;
  }

  if (!hasScope) {
    try {
      const agent = detectAgent(request.headers.get("user-agent"));
      await ctx.runMutation(internal.activity.logActivity, {
        userId: auth.userDbId,
        agentName: agent.name,
        agentSource: agent.source === "mcp" ? "mcp" : "api-key",
        agentVersion: agent.version,
        action: "scope_missing",
        resource: new URL(request.url).pathname,
        scope,
        apiKeyId: auth.apiKeyId,
        status: "denied",
        details: { declaredScopes: auth.declaredScopes, legacy: false },
      });
    } catch {
      // best-effort
    }
    return errorResponse(
      "scope_missing",
      `API key lacks required scope: ${scope}`,
      403
    );
  }

  return null;
}

/**
 * P22 + P23 — shared guard for authenticated WRITE routes (POST/PUT/DELETE
 * under /api/v1/me/*, plus the pipeline build trigger).
 *
 * Runs immediately after authenticateRequest/requireScope:
 *
 *   const guard = await guardWrite(ctx, request, auth);
 *   if (guard.blocked) return guard.blocked;
 *   ... handler body ...
 *   return guard.finish(json(result));
 *
 * 1. Per-key rate limit (P22): sliding window keyed on the API key id
 *    (`<limit>:<apiKeyId>`; userDbId fallback if a key-less session path
 *    ever reuses the guard). Limits live in convex/lib/writeLimits.ts
 *    (60 writes/min default, 5 builds/10min). On limit → 429
 *    `rate_limited` envelope with Retry-After + X-RateLimit-* headers.
 *
 * 2. Idempotency-Key replay (P23): when the header is present and a stored
 *    snapshot exists for (apiKeyId, "METHOD /path", sha256(key)) within the
 *    24h TTL, the snapshot is returned verbatim with
 *    `Idempotency-Replayed: true` — the handler body never runs.
 *
 * `finish()` attaches the X-RateLimit-* headers to the response and (when an
 * Idempotency-Key was supplied) stores the response snapshot for replay.
 * Handlers only route their SUCCESS return through finish(); error paths
 * (400/404/409/500) return directly, so error responses carry no rate
 * headers and are never replayed — a retried failure re-executes.
 */
type WriteGuard =
  | { blocked: Response; finish?: never }
  | { blocked: null; finish: (res: Response) => Promise<Response> };

async function guardWrite(
  ctx: Pick<ActionCtx, "runQuery" | "runMutation">,
  request: Request,
  auth: AuthContext,
  limit: WriteRateLimit = WRITE_RATE_LIMIT
): Promise<WriteGuard> {
  const subject = String(auth.apiKeyId ?? auth.userDbId);

  const decision = await ctx.runMutation(
    internal.lib.rateLimit.checkAndRecordWrite,
    {
      bucket: `${limit.name}:${subject}`,
      windowMs: limit.windowMs,
      maxCalls: limit.maxCalls,
    }
  );
  const rateHeaders = buildRateLimitHeaders(decision);

  if (!decision.allowed) {
    return {
      blocked: errorResponse(
        "rate_limited",
        `Rate limit exceeded: ${limit.maxCalls} ${limit.name} calls per ${Math.round(limit.windowMs / 1000)}s per API key. Retry after ${decision.retryAfterSeconds}s.`,
        429,
        { retryAfterSeconds: decision.retryAfterSeconds },
        rateHeaders
      ),
    };
  }

  // Idempotency replay (P23) — opt-in via the Idempotency-Key header.
  const rawKey = request.headers.get("idempotency-key")?.trim();
  let idem: { subject: string; route: string; keyHash: string } | null = null;
  if (rawKey) {
    const route = `${request.method} ${new URL(request.url).pathname}`;
    const keyHash = await sha256Hex(rawKey);
    const stored = await ctx.runQuery(internal.lib.idempotency.getSnapshot, {
      subject,
      route,
      keyHash,
    });
    if (stored) {
      return {
        blocked: new Response(stored.body, {
          status: stored.status,
          headers: {
            "Content-Type": "application/json",
            ...CORS_HEADERS,
            ...rateHeaders,
            "Idempotency-Replayed": "true",
          },
        }),
      };
    }
    idem = { subject, route, keyHash };
  }

  const finish = async (res: Response): Promise<Response> => {
    // Snapshot for replay (size cap enforced in lib/idempotency.ts;
    // 5xx responses are never stored — retries should re-execute).
    if (idem && res.status < 500) {
      try {
        const bodyText = await res.clone().text();
        await ctx.runMutation(internal.lib.idempotency.saveSnapshot, {
          ...idem,
          status: res.status,
          body: bodyText,
        });
      } catch {
        // best-effort — never fail the write because the snapshot failed
      }
    }
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(rateHeaders)) headers.set(k, v);
    return new Response(res.body, { status: res.status, headers });
  };

  return { blocked: null, finish };
}

function cleanStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

function cleanNameSamples(value: unknown, limit = 40): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item) => {
      if (typeof item === "string") return [item];
      if (item && typeof item === "object" && typeof (item as { name?: unknown }).name === "string") {
        return [(item as { name: string }).name];
      }
      return [];
    })
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function hasBodyKey(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function cleanOptionalString(value: unknown, limit = 1200): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, limit);
}

function cleanFiniteNumber(value: unknown, fallback = 0): number {
  const next = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(next) ? next : fallback;
}

function cleanFileName(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const cleaned = value
    .replace(/[\\/]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._-]/g, "")
    .slice(0, 180);
  return cleaned || fallback;
}

async function sha256HexBytes(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function cleanCompetitors(value: unknown): Array<{ name: string; url?: string; note?: string }> {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const name = cleanOptionalString(row.name, 120);
    if (!name) return [];
    return [{
      name,
      url: cleanOptionalString(row.url, 500),
      note: cleanOptionalString(row.note, 500),
    }];
  });
}

function cleanReusablePatterns(value: unknown): Array<{
  slug: string;
  name: string;
  status?: string;
  tags?: string[];
  techStacks?: string[];
  canonicalOwnerProject?: string;
  summary: string;
  sourcePaths?: string[];
  usageProjects?: string[];
}> {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 80).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const slug = portfolioSlug(row.slug ?? row.name);
    const name = cleanOptionalString(row.name, 160);
    const summary = cleanOptionalString(row.summary, 900);
    if (!slug || !name || !summary) return [];
    return [{
      slug,
      name,
      status: cleanOptionalString(row.status, 40),
      tags: cleanStringArray(row.tags).slice(0, 24),
      techStacks: cleanStringArray(row.techStacks).slice(0, 20),
      canonicalOwnerProject: portfolioSlug(row.canonicalOwnerProject ?? row.canonicalOwner),
      summary,
      sourcePaths: cleanStringArray(row.sourcePaths).slice(0, 40),
      usageProjects: cleanStringArray(row.usageProjects).map((project) => portfolioSlug(project)).filter((project): project is string => Boolean(project)).slice(0, 80),
    }];
  });
}

function portfolioSlug(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
  return slug || undefined;
}

function snapshotPathForProject(projectSlug: string | undefined): string {
  return `projects/${projectSlug || "_personal"}/tasks.md`;
}

function appendMarkdownEntry(existing: string, title: string, entry: string): string {
  const base = existing.trim()
    ? existing.trim()
    : `# ${title}\n\nRepo-backed snapshot maintained from You.md agent and CLI commands.`;
  return `${base}\n\n${entry.trim()}\n`;
}

function readCustomFileFromYouJson(youJson: Record<string, unknown>, filePath: string): string {
  const files = Array.isArray(youJson.custom_files)
    ? youJson.custom_files as Array<{ path?: unknown; content?: unknown }>
    : [];
  const file = files.find((item) => item.path === filePath);
  return typeof file?.content === "string" ? file.content : "";
}

function upsertCustomFile(
  youJson: Record<string, unknown>,
  filePath: string,
  content: string
): Record<string, unknown> {
  const next = JSON.parse(JSON.stringify(youJson)) as Record<string, unknown>;
  const files = Array.isArray(next.custom_files)
    ? next.custom_files as Array<{ path?: unknown; content?: unknown; isPublic?: unknown }>
    : [];
  const nextFile = {
    path: filePath,
    content,
    isPublic: filePath.startsWith("profile/"),
  };
  const index = files.findIndex((file) => file.path === filePath);
  if (index >= 0) {
    files[index] = nextFile;
  } else {
    files.push(nextFile);
  }
  next.custom_files = files;
  return next;
}

function taskSnapshotMarkdown(task: {
  title: string;
  ownerType: "human" | "agent";
  ownerLabel?: string;
  projectSlug?: string;
  status?: string;
  priority?: string;
  description?: string;
  dueAt?: number;
  tags?: string[];
}, savedAt: string): string {
  return [
    `## ${savedAt}`,
    `- title: ${task.title}`,
    `- owner: ${task.ownerType}${task.ownerLabel ? ` (${task.ownerLabel})` : ""}`,
    `- project: ${task.projectSlug ?? "personal"}`,
    `- status: ${task.status ?? "open"}`,
    task.priority ? `- priority: ${task.priority}` : null,
    task.dueAt ? `- due: ${new Date(task.dueAt).toISOString()}` : null,
    task.description ? `- notes: ${task.description}` : null,
    task.tags?.length ? `- tags: ${task.tags.join(", ")}` : null,
  ].filter(Boolean).join("\n");
}

function brainDumpSnapshotMarkdown(capture: {
  rawText: string;
  summary: string;
  projectSlugs: string[];
  tags: string[];
  tasks: Array<{ ownerType: "human" | "agent"; title: string }>;
}, savedAt: string): string {
  const lines = [
    `## ${savedAt}`,
    `summary: ${capture.summary}`,
    capture.projectSlugs.length ? `projects: ${capture.projectSlugs.join(", ")}` : "projects: uncategorized",
    capture.tags.length ? `tags: ${capture.tags.join(", ")}` : null,
    "",
    "raw:",
    capture.rawText,
  ].filter((line): line is string => line !== null);

  if (capture.tasks.length > 0) {
    lines.push("", "proposed tasks:");
    for (const task of capture.tasks) {
      lines.push(`- [${task.ownerType}] ${task.title}`);
    }
  }

  return lines.join("\n");
}

async function saveSnapshotPublishAndSync(
  ctx: ActionCtx,
  auth: AuthContext,
  snapshotPath: string,
  snapshotEntry: string,
  source: string,
  syncRepo: boolean
): Promise<{
  path: string;
  bundleVersion: number | null;
  publishVersion: number | null;
  repoSync: { attempted: boolean; ok: boolean; error?: string; push?: unknown; mirror?: unknown };
}> {
  const profile = await ctx.runQuery(api.me.getMyProfile, {
    clerkId: auth.userId,
    _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
  });
  const latestBundle = profile?.latestBundle;
  if (!latestBundle) {
    return {
      path: snapshotPath,
      bundleVersion: null,
      publishVersion: null,
      repoSync: { attempted: false, ok: false, error: "No bundle exists yet." },
    };
  }

  const currentYouJson = JSON.parse(JSON.stringify(latestBundle.youJson ?? {})) as Record<string, unknown>;
  const existing = readCustomFileFromYouJson(currentYouJson, snapshotPath);
  const content = appendMarkdownEntry(existing, snapshotPath.endsWith("tasks.md") ? "Portfolio Tasks" : "Brain Dump Captures", snapshotEntry);
  const youJson = upsertCustomFile(currentYouJson, snapshotPath, content);

  const saved = await ctx.runMutation(api.me.saveBundleFromForm, {
    clerkId: auth.userId,
    _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
    source,
    profileData: {
      _rawBundle: true,
      manifest: latestBundle.manifest ?? {},
      youJson,
      youMd: latestBundle.youMd ?? "",
    },
  });

  const published = await ctx.runMutation(api.me.publishLatest, {
    clerkId: auth.userId,
    _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
  });

  const repoSync: { attempted: boolean; ok: boolean; error?: string; push?: unknown; mirror?: unknown } = {
    attempted: syncRepo,
    ok: !syncRepo,
  };

  if (syncRepo) {
    try {
      const push = await ctx.runAction(api.githubRepo.pushToRepo, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
      });
      const mirror = await ctx.runAction(api.githubRepo.syncMirror, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
      });
      repoSync.ok = true;
      repoSync.push = push;
      repoSync.mirror = mirror;
    } catch (err) {
      repoSync.ok = false;
      repoSync.error = err instanceof Error ? err.message : "unknown repo sync error";
    }
  }

  return {
    path: snapshotPath,
    bundleVersion: saved.version,
    publishVersion: published.version,
    repoSync,
  };
}

// POST /api/v1/me/bundle — Save a bundle
http.route({
  path: "/api/v1/me/bundle",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "write:bundle");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    const startedAt = Date.now();
    const agent = detectAgent(request.headers.get("user-agent"));
    const agentSource = authAgentSource(auth, request);

    try {
      const body = await request.json();

      // Capture the previous head before the save (for diffs in activity log)
      let bundleVersionBefore: number | undefined;
      let contentHashBefore: string | undefined;
      try {
        const before = await ctx.runQuery(api.me.getMyProfile, { clerkId: auth.userId, _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN });
        if (before?.latestBundle) {
          bundleVersionBefore = before.latestBundle.version;
          contentHashBefore = before.latestBundle.contentHash ?? undefined;
        }
      } catch {
        // best-effort
      }

      const result = await ctx.runMutation(api.me.saveBundleFromForm, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        profileData: body.profileData,
        parentHash: body.parentHash, // content-addressed version control
      });

      // Log successful bundle write
      try {
        const ownerUser = await ctx.runQuery(api.users.getByClerkId, {
          clerkId: auth.userId,          _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        });
        if (ownerUser) {
          await ctx.runMutation(internal.activity.logActivity, {
            userId: ownerUser._id,
            agentName: auth.appName || agent.name,
            agentSource,
            agentVersion: agent.version,
            action: "write",
            resource: "bundle",
            status: "success",
            bundleVersionBefore,
            bundleVersionAfter: result.version,
            contentHashBefore,
            contentHashAfter: result.contentHash ?? undefined,
            durationMs: Date.now() - startedAt,
            connectedAppGrantId: auth.connectedAppGrantId,
          });
        }
      } catch {
        // swallow
      }

      return guard.finish(json(result));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save bundle";

      // Log failed bundle write
      try {
        const ownerUser = await ctx.runQuery(api.users.getByClerkId, {
          clerkId: auth.userId,          _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        });
        if (ownerUser) {
          await ctx.runMutation(internal.activity.logActivity, {
            userId: ownerUser._id,
            agentName: auth.appName || agent.name,
            agentSource,
            agentVersion: agent.version,
            action: "write",
            resource: "bundle",
            status: message.includes("ANCESTOR_MISMATCH") ? "denied" : "error",
            details: { message },
            durationMs: Date.now() - startedAt,
            connectedAppGrantId: auth.connectedAppGrantId,
          });
        }
      } catch {
        // swallow
      }

      // Return 409 Conflict for ancestor mismatch (client needs to pull first)
      if (message.includes("ANCESTOR_MISMATCH")) {
        // Machine code kept recognizable for agents that pinned the documented
        // 409 ANCESTOR_MISMATCH contract (docs show the conflict semantics).
        return errorResponse("ancestor_mismatch", message, 409);
      }
      return serverErrorResponse("me/bundles", err, "Failed to save bundle");
    }
  }),
});

// POST /api/v1/me/publish — Publish latest bundle
http.route({
  path: "/api/v1/me/publish",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "write:bundle");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    const startedAt = Date.now();
    const agent = detectAgent(request.headers.get("user-agent"));
    const agentSource = authAgentSource(auth, request);

    try {
      const result = await ctx.runMutation(api.me.publishLatest, {
        clerkId: auth.userId,        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
      });

      try {
        const ownerUser = await ctx.runQuery(api.users.getByClerkId, {
          clerkId: auth.userId,          _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        });
        if (ownerUser) {
          await ctx.runMutation(internal.activity.logActivity, {
            userId: ownerUser._id,
            agentName: auth.appName || agent.name,
            agentSource,
            agentVersion: agent.version,
            action: "publish",
            resource: "bundle",
            status: "success",
            bundleVersionAfter: result.version,
            durationMs: Date.now() - startedAt,
            connectedAppGrantId: auth.connectedAppGrantId,
          });
          // P24 — dispatch outbound webhooks for bundle_published
          try {
            await ctx.runMutation(internal.webhooks.scheduleWebhookDeliveries, {
              userId: ownerUser._id,
              event: "bundle_published",
              payload: { version: result.version, publishedAt: Date.now() },
            });
          } catch {
            // swallow — webhook dispatch failure must not block publish response
          }
        }
      } catch {
        // swallow
      }

      return guard.finish(json(result));
    } catch (err) {
      return serverErrorResponse("me/publish", err, "Failed to publish");
    }
  }),
});

// POST /api/v1/me/portrait — Save pre-rendered ASCII portrait (from CLI push)
http.route({
  path: "/api/v1/me/portrait",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "write:bundle");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    try {
      const body = await request.json();
      const { portrait } = body;

      if (!portrait || !portrait.lines || !portrait.cols || !portrait.rows) {
        return errorResponse("invalid_request", "portrait object with lines, cols, rows, format, sourceUrl required", 400);
      }

      // Find user's profile
      const user = await ctx.runQuery(api.users.getByClerkId, { clerkId: auth.userId, _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN });
      if (!user) return errorResponse("not_found", "user not found", 404);

      const profile = await ctx.runQuery(api.profiles.getByOwnerId, { ownerId: user._id });
      if (!profile) return errorResponse("not_found", "profile not found", 404);

      await ctx.runMutation(api.profiles.savePortrait, {
        profileId: profile._id,
        clerkId: auth.userId,        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        portrait: {
          lines: portrait.lines,
          coloredLines: portrait.coloredLines,
          cols: portrait.cols,
          rows: portrait.rows,
          format: portrait.format || "block",
          sourceUrl: portrait.sourceUrl || "",
        },
      });

      // Also sync avatarUrl if portrait has a real image source URL and profile
      // doesn't already have one. This ensures CLI-pushed portraits are visible
      // as the profile photo on the web, not just stored as ASCII art.
      const srcUrl: string = portrait.sourceUrl || "";
      if (srcUrl && srcUrl.startsWith("http") && !profile.avatarUrl) {
        try {
          await ctx.runMutation(api.profiles.updateProfile, {
            profileId: profile._id,
            clerkId: auth.userId,
            _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
            avatarUrl: srcUrl,
          });
        } catch {
          // non-fatal — portrait was saved, avatar URL sync failed
        }
      }

      // Log activity
      try {
        const agent = detectAgent(request.headers.get("user-agent"));
        const agentSource = authAgentSource(auth, request);
        await ctx.runMutation(internal.activity.logActivity, {
          userId: user._id,
          profileId: profile._id,
          agentName: auth.appName || agent.name,
          agentSource,
          agentVersion: agent.version,
          action: "write",
          resource: "portrait",
          status: "success",
          connectedAppGrantId: auth.connectedAppGrantId,
          details: {
            format: portrait.format || "block",
            cols: portrait.cols,
            rows: portrait.rows,
          },
        });
      } catch {
        // swallow
      }

      return guard.finish(json({ success: true }));
    } catch (err) {
      return serverErrorResponse("me/portrait", err, "Failed to save portrait");
    }
  }),
});

// GET /api/v1/me/storage — folder.md media-lane status (never returns the key)
http.route({
  path: "/api/v1/me/storage",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "read:private");
    if (denied) return denied;

    try {
      const row = await ctx.runQuery(internal.folderMd.getByUser, {
        userId: auth.userDbId,
      });
      return json({
        schemaVersion: "you-md/storage/v1",
        provider: "folder.md",
        configured: Boolean(row),
        folderId: row?.folderId ?? null,
        keyPrefix: row?.keyPrefix ?? null,
        provisionedAt: row?.provisionedAt ?? null,
        secretValuesExposed: false,
      });
    } catch (err) {
      return serverErrorResponse("me/storage", err, "Failed to read storage status");
    }
  }),
});

// POST /api/v1/me/storage/provision — zero-paste folder.md key mint.
// Idempotently ensures the owner has a folder.md media Folder + scoped key
// (minted server-to-server via folder.md /provision) and returns the credential
// to the authenticated OWNER's own client only. Connected apps get folder
// metadata but never the raw key. Pass { forceNewKey: true } to rotate.
http.route({
  path: "/api/v1/me/storage/provision",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "write:bundle");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    try {
      let forceNewKey = false;
      try {
        const body = await request.json();
        forceNewKey = body?.forceNewKey === true;
      } catch {
        // empty/no body is fine — default provisioning
      }

      const result = await ctx.runAction(internal.folderMd.provision, {
        userId: auth.userDbId,
        displayName: auth.username ? `${auth.username} media` : undefined,
        forceNewKey,
      });

      // Only the owner's first-party key/login client receives the raw folder.md
      // key. Third-party connected apps get metadata but not the secret.
      const ownerClient = auth.credentialType === "api-key";

      try {
        const agent = detectAgent(request.headers.get("user-agent"));
        await ctx.runMutation(internal.activity.logActivity, {
          userId: auth.userDbId,
          agentName: auth.appName || agent.name,
          agentSource: authAgentSource(auth, request),
          agentVersion: agent.version,
          action: "write",
          resource: "storage",
          status: "success",
          connectedAppGrantId: auth.connectedAppGrantId,
          details: { created: result.created, rotated: result.rotated },
        });
      } catch {
        // non-fatal — provisioning succeeded
      }

      return guard.finish(
        json({
          success: true,
          schemaVersion: "you-md/storage/v1",
          provider: "folder.md",
          configured: true,
          folderId: result.folderId,
          keyPrefix: result.keyPrefix,
          created: result.created,
          rotated: result.rotated,
          // Owner-only: the scoped folder.md key, cached by the CLI/MCP locally.
          apiKey: ownerClient ? result.apiKey : null,
          secretValuesExposed: ownerClient,
        })
      );
    } catch (err) {
      return serverErrorResponse("me/storage/provision", err, "Failed to provision storage");
    }
  }),
});

// GET /api/v1/me — Get current user profile
http.route({
  path: "/api/v1/me",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "read:private");
    if (denied) return denied;

    const profile = await ctx.runQuery(api.me.getMyProfile, {
      clerkId: auth.userId,      _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
    });

    // P31 (PRODUCT-AUDIT #39): additive top-level schemaVersion marker. The
    // nested bundles already carry it (bundles.schemaVersion + youJson.schema
    // are both "you-md/v1"); this makes the envelope self-describing too.
    if (profile && typeof profile === "object") {
      return json({ schemaVersion: "you-md/v1", ...profile });
    }
    return json(profile);
  }),
});

// GET /api/v1/me/portfolio/graph — Secret-safe project graph snapshot for local agents and fresh-machine bootstrap.
http.route({
  path: "/api/v1/me/portfolio/graph",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "read:private");
    if (denied) return denied;

    try {
      const url = new URL(request.url);
      const includeTasks = url.searchParams.get("includeTasks") === "1" || url.searchParams.get("includeTasks") === "true";
      const graph = await ctx.runQuery(api.portfolio.listPortfolioGraph, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        includeDoneTasks: false,
      });
      const trackedBySlug = new Map<string, typeof graph.recentTrackedProjects[number]>();
      for (const trackedProject of graph.recentTrackedProjects) {
        const candidates = [
          trackedProject.name,
          trackedProject.repoName,
          trackedProject.directoryName,
          trackedProject.fullName,
          trackedProject.stackSlug,
        ].flatMap((value) => {
          const slug = portfolioSlug(value);
          return slug ? [slug] : [];
        });
        for (const slug of candidates) {
          if (!trackedBySlug.has(slug)) trackedBySlug.set(slug, trackedProject);
        }
      }
      const trackedForProject = (project: typeof graph.projects[number]) => {
        const candidates = [
          project.slug,
          project.name,
          project.repoFullName,
          project.repoPath,
          project.stackName,
        ].flatMap((value) => {
          const slug = portfolioSlug(value);
          return slug ? [slug] : [];
        });
        for (const slug of candidates) {
          const trackedProject = trackedBySlug.get(slug);
          if (trackedProject) return trackedProject;
        }
        return null;
      };
      const graphCurlCommand = (projectSlug: string) =>
        `curl -H "Authorization: Bearer $YOUMD_API_KEY" "https://you.md/api/v1/me/portfolio/graph?includeTasks=1" | jq '.projects[] | select(.slug == "${projectSlug}")'`;
      const docsCurlCommand = (docsUrl: string | undefined) =>
        docsUrl ? `curl -fsSL ${docsUrl}` : undefined;
      const docsForProjectStack = (stackName: string | undefined, projectSlug: string | undefined) => {
        const normalized = `${stackName ?? ""} ${projectSlug ?? ""}`.toLowerCase();
        if (normalized.includes("bamf")) {
          return [
            "https://bamf.ai/docs",
            "https://bamf.ai/docs/api/posts",
            "https://bamf.ai/docs/mcp/overview",
            "https://bamf.ai/docs/mcp/tools",
          ];
        }
        if (normalized.includes("you")) {
          return [
            "https://you.md/api/v1/docs/reference",
            "https://you.md/.well-known/mcp.json",
            "https://you.md/api/v1/stacks/capabilities",
          ];
        }
        return [];
      };
      const isGenericYouMdDoc = (docsUrl: string | undefined) =>
        Boolean(docsUrl && (
          docsUrl.includes("you.md/api/v1/docs/reference") ||
          docsUrl.includes("you.md/.well-known/mcp.json") ||
          docsUrl.includes("you.md/api/v1/mcp")
        ));
      const preferredDocs = (
        stackName: string | undefined,
        projectSlug: string | undefined,
        apiDocsUrl: string | undefined,
        mcpDocsUrl: string | undefined,
        docs: string[]
      ) => {
        const stackDocs = docsForProjectStack(stackName, projectSlug);
        const apiDocs = apiDocsUrl && !(stackDocs.length > 0 && isGenericYouMdDoc(apiDocsUrl))
          ? apiDocsUrl
          : undefined;
        const mcpDocs = mcpDocsUrl && !(stackDocs.length > 0 && isGenericYouMdDoc(mcpDocsUrl))
          ? mcpDocsUrl
          : undefined;
        return cleanStringArray([apiDocs, mcpDocs, ...stackDocs, ...docs]);
      };
      const primaryApiDocsUrl = (docs: string[]) =>
        docs.find((docsUrl) => !docsUrl.includes(".well-known/mcp") && !docsUrl.includes("/mcp")) ?? docs[0];
      const primaryMcpDocsUrl = (docs: string[]) =>
        docs.find((docsUrl) => docsUrl.includes(".well-known/mcp") || docsUrl.includes("/mcp"));
      const stackInstallCommand = (stackName: string | undefined) => {
        const normalized = stackName?.toLowerCase() ?? "";
        if (normalized.includes("you")) return "curl -fsSL https://you.md/install.sh | bash";
        if (normalized.includes("bamf")) return "curl -fsSL https://bamf.ai/bamfstack/install.sh | bash";
        return undefined;
      };
      const surfaceCurlCommand = (
        surfaceName: string | undefined,
        ownerProjectSlug: string | undefined,
        ownerStack: string | undefined,
        suppliedCommand: string | undefined
      ) => {
        if (suppliedCommand) return suppliedCommand;
        const normalized = `${surfaceName ?? ""} ${ownerProjectSlug ?? ""} ${ownerStack ?? ""}`.toLowerCase();
        if (normalized.includes("bamfos") || normalized.includes("admin")) return "curl -fsSL https://bamf.ai/bamfstack/install.sh | bash";
        if (normalized.includes("bamf")) return 'curl -H "Authorization: Bearer $BAMF_API_KEY" https://api.bamf.ai/v1/agent/capabilities';
        return undefined;
      };
      const cloneCommand = (repoUrl: string | undefined, target: string | undefined) =>
        repoUrl ? `git clone ${repoUrl} ${target ?? "project"}` : undefined;
      const isShippableActivity = (activity: typeof graph.projectActivities[number]) =>
        activity.kind === "commit" || activity.kind === "pull-request" || activity.kind === "release";
      const activitiesByProject = new Map<string, typeof graph.projectActivities>();
      for (const activity of graph.projectActivities) {
        const existing = activitiesByProject.get(activity.projectSlug) ?? [];
        existing.push(activity);
        activitiesByProject.set(activity.projectSlug, existing);
      }
      const shippedCountsFor = (projectSlug: string) => {
        const now = Date.now();
        const shippable = (activitiesByProject.get(projectSlug) ?? []).filter(isShippableActivity);
        return {
          today: shippable.filter((activity) => activity.occurredAt >= now - 86_400_000).length,
          seven: shippable.filter((activity) => activity.occurredAt >= now - 7 * 86_400_000).length,
          thirty: shippable.filter((activity) => activity.occurredAt >= now - 30 * 86_400_000).length,
          ninety: shippable.filter((activity) => activity.occurredAt >= now - 90 * 86_400_000).length,
        };
      };
      const latestShippedFor = (projectSlug: string) =>
        (activitiesByProject.get(projectSlug) ?? [])
          .filter(isShippableActivity)
          .sort((a, b) => b.occurredAt - a.occurredAt)
          .slice(0, 5)
          .map((activity) => ({
            kind: activity.kind,
            title: activity.title,
            url: activity.url,
            source: activity.source,
            occurredAt: activity.occurredAt,
          }));

      return json({
        schemaVersion: "you-md/portfolio-graph/v1",
        projects: graph.projects.map((project) => {
          const trackedProject = trackedForProject(project);
          const stackName = trackedProject?.stackName ?? project.stackName;
          const docs = preferredDocs(stackName, project.slug, trackedProject?.apiDocsUrl, trackedProject?.mcpDocsUrl, project.docs);
          const apiDocsUrl = primaryApiDocsUrl(docs);
          const mcpDocsUrl = primaryMcpDocsUrl(docs);
          return {
            slug: project.slug,
            name: project.name,
            stackName,
            stackSlug: trackedProject?.stackSlug,
            status: project.status,
            statusSource: project.statusSource,
            statusUpdatedAt: project.statusUpdatedAt,
            focusStatus: project.focusStatus,
            focusRank: project.focusRank,
            machineSetupEligible: project.status === "active" && (
              project.focusStatus === "top-priority" ||
              project.focusStatus === "focusing"
            ),
            summary: project.summary,
            detailedDescription: project.detailedDescription,
            goal: project.goal,
            vision: project.vision,
            focus: project.focus,
            positioning: project.positioning,
            audience: project.audience,
            painPoints: project.painPoints,
            solution: project.solution,
            whyThisSolution: project.whyThisSolution,
            northStar: project.northStar,
            metrics: project.metrics,
            constraints: project.constraints,
            notBuilding: project.notBuilding,
            competitors: project.competitors,
            repoFullName: project.repoFullName,
            repoUrl: project.repoUrl,
            productUrl: project.productUrl,
            repoName: trackedProject?.repoName,
            directoryName: trackedProject?.directoryName,
            apiDocsUrl,
            mcpDocsUrl,
            apiDocsCurlCommand: docsCurlCommand(apiDocsUrl),
            mcpDocsCurlCommand: docsCurlCommand(mcpDocsUrl),
            docs,
            curlCommand: graphCurlCommand(project.slug),
            stackInstallCommand: stackInstallCommand(stackName),
            cloneCommand: cloneCommand(
              project.repoUrl ?? trackedProject?.url,
              trackedProject?.directoryName ?? project.repoPath ?? project.slug
            ),
            shipped: shippedCountsFor(project.slug),
            latestShipped: latestShippedFor(project.slug),
            environments: project.environments,
            tags: project.tags,
            source: project.source,
            repoPath: project.repoPath,
            lastActivityAt: project.lastActivityAt,
            updatedAt: project.updatedAt,
          };
        }),
        recentTrackedProjects: graph.recentTrackedProjects.map((project) => {
          const docs = preferredDocs(project.stackName, project.repoName ?? project.name, project.apiDocsUrl, project.mcpDocsUrl, []);
          const apiDocsUrl = primaryApiDocsUrl(docs);
          const mcpDocsUrl = primaryMcpDocsUrl(docs);
          return {
            fullName: project.fullName,
            name: project.name,
            url: project.url,
            projectUrl: project.projectUrl,
            repoName: project.repoName,
            directoryName: project.directoryName,
            apiDocsUrl,
            mcpDocsUrl,
            apiDocsCurlCommand: docsCurlCommand(apiDocsUrl),
            mcpDocsCurlCommand: docsCurlCommand(mcpDocsUrl),
            stackName: project.stackName,
            stackSlug: project.stackSlug,
            stackInstallCommand: stackInstallCommand(project.stackName),
            cloneCommand: cloneCommand(project.url, project.directoryName ?? project.repoName ?? project.name),
            highLevelGoal: project.highLevelGoal,
            recentProgress: project.recentProgress,
            description: project.description,
            primaryLanguage: project.primaryLanguage,
            pushedAt: project.pushedAt,
            commitsLast90d: project.commitsLast90d,
            isPrivate: project.isPrivate,
            insight: project.insight,
            visibility: project.visibility,
            trackedAt: project.trackedAt,
            updatedAt: project.updatedAt,
          };
        }),
        apiSurfaces: graph.apiSurfaces.map((surface) => ({
          slug: surface.slug,
          name: surface.name,
          kind: surface.kind,
          ownerProjectSlug: surface.ownerProjectSlug,
          ownerStack: surface.ownerStack,
          trust: surface.trust,
          authMode: surface.authMode,
          writePolicy: surface.writePolicy,
          features: surface.features,
          risk: surface.risk,
          notes: surface.notes,
          docsUrls: preferredDocs(surface.ownerStack, surface.ownerProjectSlug, undefined, undefined, surface.docsUrls),
          integrationTypes: surface.integrationTypes,
          curlCommand: surfaceCurlCommand(surface.name, surface.ownerProjectSlug, surface.ownerStack, surface.curlCommand),
          updatedAt: surface.updatedAt,
        })),
        dependencyEdges: graph.dependencyEdges.map((edge) => ({
          fromProjectSlug: edge.fromProjectSlug,
          toProjectSlug: edge.toProjectSlug,
          toSurfaceSlug: edge.toSurfaceSlug,
          tier: edge.tier,
          integrationType: edge.integrationType,
          features: edge.features,
          failureImpact: edge.failureImpact,
          notes: edge.notes,
          updatedAt: edge.updatedAt,
        })),
        reusablePatterns: graph.reusablePatterns.map((pattern) => ({
          slug: pattern.slug,
          name: pattern.name,
          status: pattern.status,
          tags: pattern.tags,
          techStacks: pattern.techStacks,
          canonicalOwnerProject: pattern.canonicalOwnerProject,
          summary: pattern.summary,
          sourcePaths: pattern.sourcePaths,
          usageProjects: pattern.usageProjects,
          updatedAt: pattern.updatedAt,
        })),
        tasks: includeTasks
          ? graph.tasks.map((task) => ({
              projectSlug: task.projectSlug,
              title: task.title,
              description: task.description,
              ownerType: task.ownerType,
              ownerLabel: task.ownerLabel,
              status: task.status,
              priority: task.priority,
              dueAt: task.dueAt,
              sourceType: task.sourceType,
              tags: task.tags,
              createdAt: task.createdAt,
              updatedAt: task.updatedAt,
            }))
          : undefined,
      });
    } catch (err) {
      return serverErrorResponse("me/portfolio/graph", err, "Failed to load portfolio graph");
    }
  }),
});

// POST /api/v1/me/portfolio/tasks — Create an owner-aware portfolio task from CLI/MCP/API.
http.route({
  path: "/api/v1/me/portfolio/tasks",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "write:bundle", "projects");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    const startedAt = Date.now();
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return errorResponse("invalid_request", "title must be a non-empty string", 400);

    const ownerType: "human" | "agent" = body.ownerType === "human" ? "human" : "agent";
    const projectSlug = portfolioSlug(body.projectSlug ?? body.project);
    const tags = cleanStringArray(body.tags);
    const status = typeof body.status === "string" && body.status.trim() ? body.status.trim() : "open";
    const priority = typeof body.priority === "string" && body.priority.trim() ? body.priority.trim() : "normal";
    const description = typeof body.description === "string" && body.description.trim()
      ? body.description.trim()
      : undefined;
    const ownerLabel = typeof body.ownerLabel === "string" && body.ownerLabel.trim()
      ? body.ownerLabel.trim()
      : undefined;

    try {
      const task = await ctx.runMutation(api.portfolio.upsertTask, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        projectSlug,
        title,
        description,
        ownerType,
        ownerLabel,
        status,
        priority,
        sourceType: typeof body.sourceType === "string" ? body.sourceType : "cli-agent",
        tags,
      });

      const snapshot = await saveSnapshotPublishAndSync(
        ctx,
        auth,
        snapshotPathForProject(projectSlug),
        taskSnapshotMarkdown({ title, ownerType, ownerLabel, projectSlug, status, priority, description, tags }, new Date().toISOString()),
        "api:portfolio-task",
        body.syncRepo !== false
      );

      try {
        const agent = detectAgent(request.headers.get("user-agent"));
        await ctx.runMutation(internal.activity.logActivity, {
          userId: auth.userDbId,
          agentName: typeof body.agentName === "string" && body.agentName.trim()
            ? body.agentName.trim()
            : auth.appName || agent.name,
          agentSource: authAgentSource(auth, request),
          agentVersion: agent.version,
          action: "write",
          resource: "portfolio/task",
          status: "success",
          connectedAppGrantId: auth.connectedAppGrantId,
          durationMs: Date.now() - startedAt,
          details: { projectSlug: projectSlug ?? "personal", ownerType, snapshotPath: snapshot.path },
        });
      } catch {
        // best-effort
      }

      return guard.finish(json({ success: true, ...task, snapshot }));
    } catch (err) {
      return serverErrorResponse("me/portfolio/tasks", err, "Failed to save portfolio task");
    }
  }),
});

// POST /api/v1/me/portfolio/tasks/triage — Update task status/priority from local agents.
http.route({
  path: "/api/v1/me/portfolio/tasks/triage",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "write:bundle", "projects");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    const startedAt = Date.now();
    const body = await request.json();
    const taskId = typeof body.taskId === "string" && body.taskId.trim()
      ? body.taskId.trim() as Id<"portfolioTasks">
      : undefined;
    if (!taskId) return errorResponse("invalid_request", "taskId must be a non-empty string", 400);

    const status = typeof body.status === "string" && body.status.trim()
      ? body.status.trim()
      : undefined;
    const priority = typeof body.priority === "string" && body.priority.trim()
      ? body.priority.trim()
      : undefined;
    if (!status && !priority) {
      return errorResponse("invalid_request", "status or priority is required", 400);
    }

    try {
      const task = await ctx.runMutation(api.portfolio.updateTaskTriage, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        taskId,
        status,
        priority,
      });

      const snapshot = await saveSnapshotPublishAndSync(
        ctx,
        auth,
        snapshotPathForProject(task.projectSlug),
        taskSnapshotMarkdown(task, new Date().toISOString()),
        "api:portfolio-task-triage",
        body.syncRepo !== false
      );

      try {
        const agent = detectAgent(request.headers.get("user-agent"));
        await ctx.runMutation(internal.activity.logActivity, {
          userId: auth.userDbId,
          agentName: typeof body.agentName === "string" && body.agentName.trim()
            ? body.agentName.trim()
            : auth.appName || agent.name,
          agentSource: authAgentSource(auth, request),
          agentVersion: agent.version,
          action: "write",
          resource: "portfolio/task-triage",
          status: "success",
          connectedAppGrantId: auth.connectedAppGrantId,
          durationMs: Date.now() - startedAt,
          details: {
            taskId,
            projectSlug: task.projectSlug ?? "personal",
            taskStatus: task.status,
            priority: task.priority,
            snapshotPath: snapshot.path,
          },
        });
      } catch {
        // best-effort
      }

      return guard.finish(json({ success: true, ...task, snapshot }));
    } catch (err) {
      return serverErrorResponse("me/portfolio/tasks/triage", err, "Failed to triage portfolio task");
    }
  }),
});

// POST /api/v1/me/portfolio/tasks/update — Partially update ownership, scope, metadata, and triage fields.
http.route({
  path: "/api/v1/me/portfolio/tasks/update",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "write:bundle", "projects");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    const startedAt = Date.now();
    const body = await request.json() as Record<string, unknown>;
    const taskId = typeof body.taskId === "string" && body.taskId.trim()
      ? body.taskId.trim() as Id<"portfolioTasks">
      : undefined;
    if (!taskId) return errorResponse("invalid_request", "taskId must be a non-empty string", 400);

    const patch: {
      projectSlug?: string | null;
      title?: string;
      description?: string | null;
      ownerType?: "human" | "agent";
      ownerLabel?: string | null;
      status?: string;
      priority?: string;
      dueAt?: number | null;
      tags?: string[];
    } = {};

    if (hasBodyKey(body, "projectSlug") || hasBodyKey(body, "project")) {
      const rawProject = hasBodyKey(body, "projectSlug") ? body.projectSlug : body.project;
      if (rawProject === null || rawProject === "" || rawProject === "personal" || rawProject === "uncategorized") {
        patch.projectSlug = null;
      } else {
        patch.projectSlug = portfolioSlug(rawProject) ?? null;
      }
    }
    if (hasBodyKey(body, "title")) {
      const title = cleanOptionalString(body.title, 240);
      if (!title) return errorResponse("invalid_request", "title must be a non-empty string when provided", 400);
      patch.title = title;
    }
    if (hasBodyKey(body, "description")) {
      patch.description = body.description === null ? null : (cleanOptionalString(body.description, 1600) ?? null);
    }
    if (hasBodyKey(body, "ownerType")) {
      if (body.ownerType !== "human" && body.ownerType !== "agent") {
        return errorResponse("invalid_request", "ownerType must be human or agent when provided", 400);
      }
      patch.ownerType = body.ownerType;
    }
    if (hasBodyKey(body, "ownerLabel")) {
      patch.ownerLabel = body.ownerLabel === null ? null : (cleanOptionalString(body.ownerLabel, 120) ?? null);
    }
    if (hasBodyKey(body, "status")) {
      const status = cleanOptionalString(body.status, 40);
      if (!status) return errorResponse("invalid_request", "status must be non-empty when provided", 400);
      patch.status = status;
    }
    if (hasBodyKey(body, "priority")) {
      const priority = cleanOptionalString(body.priority, 40);
      if (!priority) return errorResponse("invalid_request", "priority must be non-empty when provided", 400);
      patch.priority = priority;
    }
    if (hasBodyKey(body, "dueAt")) {
      const due = body.dueAt === null || body.dueAt === "" ? null : cleanFiniteNumber(body.dueAt, NaN);
      if (due !== null && !Number.isFinite(due)) {
        return errorResponse("invalid_request", "dueAt must be a finite timestamp in milliseconds when provided", 400);
      }
      patch.dueAt = due;
    }
    if (hasBodyKey(body, "tags")) {
      patch.tags = cleanStringArray(body.tags).slice(0, 24);
    }

    if (Object.keys(patch).length === 0) {
      return errorResponse("invalid_request", "at least one task field is required", 400);
    }

    try {
      const task = await ctx.runMutation(api.portfolio.updateTaskDetails, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        taskId,
        ...patch,
      });

      const snapshot = await saveSnapshotPublishAndSync(
        ctx,
        auth,
        snapshotPathForProject(task.projectSlug),
        taskSnapshotMarkdown(task, new Date().toISOString()),
        "api:portfolio-task-update",
        body.syncRepo !== false
      );

      try {
        const agent = detectAgent(request.headers.get("user-agent"));
        await ctx.runMutation(internal.activity.logActivity, {
          userId: auth.userDbId,
          agentName: typeof body.agentName === "string" && body.agentName.trim()
            ? body.agentName.trim()
            : auth.appName || agent.name,
          agentSource: authAgentSource(auth, request),
          agentVersion: agent.version,
          action: "write",
          resource: "portfolio/task-update",
          status: "success",
          connectedAppGrantId: auth.connectedAppGrantId,
          durationMs: Date.now() - startedAt,
          details: {
            taskId,
            projectSlug: task.projectSlug ?? "personal",
            taskStatus: task.status,
            priority: task.priority,
            updatedFields: Object.keys(patch),
            snapshotPath: snapshot.path,
          },
        });
      } catch {
        // best-effort
      }

      return guard.finish(json({ success: true, ...task, snapshot }));
    } catch (err) {
      return serverErrorResponse("me/portfolio/tasks/update", err, "Failed to update portfolio task");
    }
  }),
});

// POST /api/v1/me/portfolio/brain-dumps — Preserve raw dumps and route proposed tasks.
http.route({
  path: "/api/v1/me/portfolio/brain-dumps",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "write:bundle", "projects");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    const startedAt = Date.now();
    const body = await request.json();
    const rawText = typeof body.rawText === "string" ? body.rawText.trim() : "";
    if (!rawText) return errorResponse("invalid_request", "rawText must be a non-empty string", 400);

    const projectSlugs = cleanStringArray(body.projectSlugs ?? body.projects)
      .map((value) => portfolioSlug(value))
      .filter((value): value is string => Boolean(value));
    const tags = cleanStringArray(body.tags);
    const summary = typeof body.summary === "string" && body.summary.trim()
      ? body.summary.trim()
      : rawText.replace(/\s+/g, " ").slice(0, 180);
    const insights = cleanStringArray(body.insights);
    const tasks = Array.isArray(body.tasks)
      ? body.tasks.map((task: unknown) => {
          const row = typeof task === "object" && task !== null ? task as Record<string, unknown> : {};
          const title = typeof row.title === "string" ? row.title.trim() : "";
          if (!title) return null;
          return {
            projectSlug: portfolioSlug(row.projectSlug) ?? projectSlugs[0],
            title,
            description: typeof row.description === "string" && row.description.trim() ? row.description.trim() : undefined,
            ownerType: row.ownerType === "human" ? "human" as const : "agent" as const,
            ownerLabel: typeof row.ownerLabel === "string" && row.ownerLabel.trim() ? row.ownerLabel.trim() : undefined,
            status: typeof row.status === "string" && row.status.trim() ? row.status.trim() : "proposed",
            priority: typeof row.priority === "string" && row.priority.trim() ? row.priority.trim() : "normal",
            tags: cleanStringArray(row.tags),
          };
        }).filter((task: {
          projectSlug?: string;
          title: string;
          description?: string;
          ownerType: "human" | "agent";
          ownerLabel?: string;
          status?: string;
          priority?: string;
          tags?: string[];
        } | null): task is {
          projectSlug?: string;
          title: string;
          description?: string;
          ownerType: "human" | "agent";
          ownerLabel?: string;
          status?: string;
          priority?: string;
          tags?: string[];
        } => task !== null)
      : [];

    try {
      const capture = await ctx.runMutation(api.portfolio.recordBrainDump, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        source: typeof body.source === "string" ? body.source : "cli",
        rawText,
        summary,
        insights,
        projectSlugs,
        tags,
        metadata: {
          ...(typeof body.metadata === "object" && body.metadata !== null ? body.metadata : {}),
          savedFrom: "api/v1/me/portfolio/brain-dumps",
        },
        tasks,
      });

      const snapshot = await saveSnapshotPublishAndSync(
        ctx,
        auth,
        "projects/_braindumps/recent.md",
        brainDumpSnapshotMarkdown({ rawText, summary, projectSlugs, tags, tasks }, new Date().toISOString()),
        "api:portfolio-brain-dump",
        body.syncRepo !== false
      );

      try {
        const agent = detectAgent(request.headers.get("user-agent"));
        await ctx.runMutation(internal.activity.logActivity, {
          userId: auth.userDbId,
          agentName: typeof body.agentName === "string" && body.agentName.trim()
            ? body.agentName.trim()
            : auth.appName || agent.name,
          agentSource: authAgentSource(auth, request),
          agentVersion: agent.version,
          action: "write",
          resource: "portfolio/brain-dump",
          status: "success",
          connectedAppGrantId: auth.connectedAppGrantId,
          durationMs: Date.now() - startedAt,
          details: { projectSlugs, taskCount: tasks.length, snapshotPath: snapshot.path },
        });
      } catch {
        // best-effort
      }

      return guard.finish(json({ success: true, ...capture, snapshot }));
    } catch (err) {
      return serverErrorResponse("me/portfolio/brain-dumps", err, "Failed to save brain dump");
    }
  }),
});

// POST /api/v1/me/portfolio/projects/hydrate — Hydrate portfolio graph from recent GitHub projects and local auditor output.
http.route({
  path: "/api/v1/me/portfolio/projects/hydrate",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "write:bundle", "projects");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    const startedAt = Date.now();
    const body = await request.json();
    const includeTracked = body.includeTracked !== false;
    const days = typeof body.days === "number" && Number.isFinite(body.days) ? body.days : 90;
    const limit = typeof body.limit === "number" && Number.isFinite(body.limit) ? body.limit : 80;
    const source = typeof body.source === "string" && body.source.trim()
      ? body.source.trim()
      : "local-portfolio-audit";
    const projects = Array.isArray(body.projects) ? body.projects : [];
    const reusablePatterns = cleanReusablePatterns(body.reusablePatterns ?? body.patterns);

    const local = {
      received: projects.length,
      upserted: 0,
      skipped: 0,
      projects: [] as Array<{ slug?: string; name: string; created?: boolean }>,
    };
    let patterns: {
      received: number;
      upserted: number;
      created: number;
      updated: number;
      skipped: number;
      patterns: Array<{ slug: string; name: string; created: boolean }>;
    } | null = null;

    try {
      const tracked = includeTracked
        ? await ctx.runMutation(api.portfolio.syncTrackedProjects, {
            clerkId: auth.userId,
            _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
            days,
            limit,
          })
        : null;

      for (const rawProject of projects.slice(0, Math.max(1, Math.min(limit, 200)))) {
        const row = typeof rawProject === "object" && rawProject !== null
          ? rawProject as Record<string, unknown>
          : {};
        const name = typeof row.name === "string" ? row.name.trim() : "";
        if (!name) {
          local.skipped += 1;
          continue;
        }

        const repoPath = typeof row.path === "string" && row.path.trim() ? row.path.trim() : undefined;
        const providers = cleanStringArray(row.providers);
        const environments = cleanStringArray(row.environments ?? row.envFiles);
        const tags = cleanStringArray(row.tags ?? providers.map((provider) => provider.toLowerCase().replace(/[^a-z0-9]+/g, "-")));
        const summary = typeof row.summary === "string" && row.summary.trim()
          ? row.summary.trim()
          : `Local portfolio auditor found ${name}${repoPath ? ` at ${repoPath}` : ""}${providers.length ? ` using ${providers.slice(0, 5).join(", ")}` : ""}.`;
        const result = await ctx.runMutation(api.portfolio.upsertProject, {
          clerkId: auth.userId,
          _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
          slug: typeof row.slug === "string" ? row.slug : undefined,
          name,
          stackName: typeof row.stackName === "string" ? row.stackName : undefined,
          status: typeof row.status === "string" ? row.status : "local-audited",
          summary,
          detailedDescription: cleanOptionalString(row.detailedDescription, 1600),
          goal: cleanOptionalString(row.goal, 800),
          vision: cleanOptionalString(row.vision, 800),
          focus: typeof row.focus === "string" ? row.focus : "Audit project role, API/MCP ownership, reusable patterns, and env/service-account boundaries.",
          positioning: cleanOptionalString(row.positioning, 800),
          audience: cleanOptionalString(row.audience, 800),
          painPoints: cleanStringArray(row.painPoints).slice(0, 12),
          solution: cleanOptionalString(row.solution, 1000),
          whyThisSolution: cleanOptionalString(row.whyThisSolution, 1000),
          northStar: cleanOptionalString(row.northStar, 600),
          metrics: cleanStringArray(row.metrics).slice(0, 12),
          constraints: cleanStringArray(row.constraints).slice(0, 12),
          notBuilding: cleanStringArray(row.notBuilding).slice(0, 12),
          competitors: cleanCompetitors(row.competitors),
          docs: cleanStringArray(row.docs),
          environments,
          tags: ["local-audit", ...tags],
          source,
          repoPath,
          lastActivityAt: typeof row.lastActivityAt === "number" && Number.isFinite(row.lastActivityAt)
            ? row.lastActivityAt
            : Date.now(),
        });
        const slug = portfolioSlug(row.slug ?? name) ?? portfolioSlug(name);
        const activities = Array.isArray(row.activityEvents) ? row.activityEvents : [];
        if (slug && activities.length > 0) {
          await ctx.runMutation(api.portfolio.upsertProjectActivityBatch, {
            clerkId: auth.userId,
            _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
            projectSlug: slug,
            activities: activities.slice(0, 120).map((activity: unknown) => {
              const event = typeof activity === "object" && activity !== null
                ? activity as Record<string, unknown>
                : {};
              return {
                kind: typeof event.kind === "string" && event.kind.trim() ? event.kind.trim() : "summary",
                title: typeof event.title === "string" ? event.title.slice(0, 220) : "Project activity",
                summary: typeof event.summary === "string" && event.summary.trim() ? event.summary.slice(0, 1000) : undefined,
                url: typeof event.url === "string" && event.url.trim() ? event.url.trim() : undefined,
                source: typeof event.source === "string" && event.source.trim() ? event.source.trim() : source,
                evidencePath: typeof event.evidencePath === "string" && event.evidencePath.trim() ? event.evidencePath.trim() : undefined,
                dedupeKey: typeof event.dedupeKey === "string" && event.dedupeKey.trim() ? event.dedupeKey.trim() : undefined,
                tags: cleanStringArray(event.tags),
                metadata: typeof event.metadata === "object" && event.metadata !== null ? event.metadata : undefined,
                occurredAt: typeof event.occurredAt === "number" && Number.isFinite(event.occurredAt)
                  ? event.occurredAt
                  : Date.now(),
              };
            }),
          });
        }
        local.upserted += 1;
        local.projects.push({ slug, name, created: result.created });
      }

      if (reusablePatterns.length > 0) {
        patterns = await ctx.runMutation(api.portfolio.upsertReusablePatternBatch, {
          clerkId: auth.userId,
          _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
          patterns: reusablePatterns,
        });
      }

      try {
        const agent = detectAgent(request.headers.get("user-agent"));
        await ctx.runMutation(internal.activity.logActivity, {
          userId: auth.userDbId,
          agentName: typeof body.agentName === "string" && body.agentName.trim()
            ? body.agentName.trim()
            : auth.appName || agent.name,
          agentSource: authAgentSource(auth, request),
          agentVersion: agent.version,
          action: "write",
          resource: "portfolio/projects",
          status: "success",
          connectedAppGrantId: auth.connectedAppGrantId,
          durationMs: Date.now() - startedAt,
          details: { includeTracked, trackedCount: tracked?.tracked ?? 0, localUpserted: local.upserted, patternUpserted: patterns?.upserted ?? 0, source },
        });
      } catch {
        // best-effort
      }

      return guard.finish(json({ success: true, tracked, local, patterns }));
    } catch (err) {
      return serverErrorResponse("me/portfolio/projects/hydrate", err, "Failed to hydrate portfolio projects");
    }
  }),
});

// POST /api/v1/me/machines/proof — Sync secret-safe fresh-machine verification proof metadata.
http.route({
  path: "/api/v1/me/machines/proof",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "write:bundle", "projects");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    const startedAt = Date.now();
    const body = await request.json();
    const summary = body && typeof body.summary === "object" && body.summary !== null
      ? body.summary as Record<string, unknown>
      : body as Record<string, unknown>;
    const hostName = cleanOptionalString(body.hostName ?? body.hostname, 180);
    const rootDir = cleanOptionalString(body.rootDir ?? body.root, 700);
    if (!hostName) return errorResponse("invalid_request", "hostName must be a non-empty string", 400);
    if (!rootDir) return errorResponse("invalid_request", "rootDir must be a non-empty string", 400);

    const generatedAtRaw = body.generatedAt;
    const generatedAt = typeof generatedAtRaw === "string"
      ? Date.parse(generatedAtRaw)
      : cleanFiniteNumber(generatedAtRaw, Date.now());

    try {
      const proof = await ctx.runMutation(api.portfolio.upsertMachineProof, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        machineKey: cleanOptionalString(body.machineKey, 220),
        hostName,
        platform: cleanOptionalString(body.platform, 180),
        rootDir,
        proofSchemaVersion: cleanFiniteNumber(body.schemaVersion ?? body.proofSchemaVersion, 1),
        status: cleanOptionalString(summary.status, 40) ?? "warn",
        scanned: cleanFiniteNumber(summary.scanned),
        ready: cleanFiniteNumber(summary.ready),
        needsEnv: cleanFiniteNumber(summary.needsEnv),
        partial: cleanFiniteNumber(summary.partial),
        installPassed: cleanFiniteNumber(summary.installPassed),
        checksPassed: cleanFiniteNumber(summary.checksPassed),
        serversPassed: cleanFiniteNumber(summary.serversPassed),
        daemonsLoaded: cleanFiniteNumber(summary.daemonsLoaded ?? body.daemonsLoaded),
        daemonsTotal: cleanFiniteNumber(summary.daemonsTotal ?? body.daemonsTotal),
        legacyDaemonsLoaded: cleanFiniteNumber(summary.legacyDaemonsLoaded ?? body.legacyDaemonsLoaded),
        daemonWarnings: cleanStringArray(body.daemonWarnings ?? summary.daemonWarnings).slice(0, 12),
        daemonLabels: cleanStringArray(body.daemonLabels ?? summary.daemonLabels).slice(0, 12),
        failures: cleanFiniteNumber(summary.failures),
        warnings: cleanStringArray(summary.warnings).slice(0, 12),
        secretValuesExposed: body.secretValuesExposed === true,
        reportPath: cleanOptionalString(body.reportPath, 700),
        source: cleanOptionalString(body.source, 80) ?? "cli",
        agentName: cleanOptionalString(body.agentName, 160),
        generatedAt: Number.isFinite(generatedAt) ? generatedAt : Date.now(),
      });

      try {
        const agent = detectAgent(request.headers.get("user-agent"));
        await ctx.runMutation(internal.activity.logActivity, {
          userId: auth.userDbId,
          agentName: typeof body.agentName === "string" && body.agentName.trim()
            ? body.agentName.trim()
            : auth.appName || agent.name,
          agentSource: authAgentSource(auth, request),
          agentVersion: agent.version,
          action: "write",
          resource: "machines/proof",
          status: "success",
          connectedAppGrantId: auth.connectedAppGrantId,
          durationMs: Date.now() - startedAt,
          details: {
            hostName,
            rootDir,
            machineStatus: cleanOptionalString(summary.status, 40) ?? "warn",
            scanned: cleanFiniteNumber(summary.scanned),
            daemonsLoaded: cleanFiniteNumber(summary.daemonsLoaded ?? body.daemonsLoaded),
            daemonsTotal: cleanFiniteNumber(summary.daemonsTotal ?? body.daemonsTotal),
            legacyDaemonsLoaded: cleanFiniteNumber(summary.legacyDaemonsLoaded ?? body.legacyDaemonsLoaded),
            failures: cleanFiniteNumber(summary.failures),
          },
        });
      } catch {
        // best-effort
      }

      return guard.finish(json({ success: true, ...proof }));
    } catch (err) {
      return serverErrorResponse("me/machines/proof", err, "Failed to sync machine proof");
    }
  }),
});

// GET /api/v1/me/machines/proofs — List synced machine proof summaries for API/CLI callers.
http.route({
  path: "/api/v1/me/machines/proofs",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "read:private", "projects");
    if (denied) return denied;

    const url = new URL(request.url);
    const limit = cleanFiniteNumber(url.searchParams.get("limit"), 12);
    try {
      const machines = await ctx.runQuery(api.portfolio.listMachineProofs, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        limit,
      });
      return json({ machines });
    } catch (err) {
      return serverErrorResponse("me/machines/proofs", err, "Failed to list machine proofs");
    }
  }),
});

// POST /api/v1/me/agent-stack/inventory — Sync secret-safe local/global agent stack inventory metadata.
http.route({
  path: "/api/v1/me/agent-stack/inventory",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "write:bundle", "projects");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    const startedAt = Date.now();
    const body = await request.json() as Record<string, unknown>;
    const totals = body && typeof body.totals === "object" && body.totals !== null
      ? body.totals as Record<string, unknown>
      : body;
    const roots = body && typeof body.roots === "object" && body.roots !== null
      ? body.roots as Record<string, unknown>
      : {};
    const dryAudit = body && typeof body.dryAudit === "object" && body.dryAudit !== null
      ? body.dryAudit as Record<string, unknown>
      : {};

    const hostName = cleanOptionalString(body.hostName ?? body.hostname ?? body.host, 180);
    const rootDir = cleanOptionalString(body.rootDir ?? body.root ?? body.repoRoot ?? roots.workspace, 700);
    if (!hostName) return errorResponse("invalid_request", "hostName must be a non-empty string", 400);
    if (!rootDir) return errorResponse("invalid_request", "rootDir must be a non-empty string", 400);
    const syncRepo = body.syncRepo !== false;

    const generatedAtRaw = body.generatedAt;
    const generatedAt = typeof generatedAtRaw === "string"
      ? Date.parse(generatedAtRaw)
      : cleanFiniteNumber(generatedAtRaw, Date.now());

    try {
      const inventory = await ctx.runMutation(api.portfolio.upsertAgentStackInventory, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        machineKey: cleanOptionalString(body.machineKey, 220),
        hostName,
        platform: cleanOptionalString(body.platform, 180),
        rootDir,
        inventorySchemaVersion: cleanOptionalString(body.inventorySchemaVersion ?? body.schemaVersion, 80),
        uniqueSkillNames: cleanFiniteNumber(totals.uniqueSkillNames),
        uniqueRealSkillFiles: cleanFiniteNumber(totals.uniqueRealSkillFiles),
        directExposureSkillRecords: cleanFiniteNumber(totals.directExposureSkillRecords),
        canonicalSkillFiles: cleanFiniteNumber(totals.canonicalSkillFiles),
        youmdCatalogSkills: cleanFiniteNumber(totals.youmdCatalogSkills),
        missingFromYoumdCatalog: cleanFiniteNumber(totals.missingFromYoumdCatalog),
        duplicateNameDifferentRealpaths: cleanFiniteNumber(totals.duplicateNameDifferentRealpaths),
        sameRealpathMirrors: cleanFiniteNumber(totals.sameRealpathMirrors),
        projectSignals: cleanFiniteNumber(totals.projectSignals),
        ownershipRollup: typeof body.ownershipRollup === "object" && body.ownershipRollup !== null ? body.ownershipRollup : {},
        syncPolicyRollup: typeof body.syncPolicyRollup === "object" && body.syncPolicyRollup !== null ? body.syncPolicyRollup : {},
        provenanceRollup: typeof body.provenanceRollup === "object" && body.provenanceRollup !== null ? body.provenanceRollup : {},
        missingCatalogSamples: cleanNameSamples(body.missingCatalogSamples ?? body.missingFromCatalog, 40),
        duplicateNameSamples: cleanNameSamples(body.duplicateNameSamples ?? dryAudit.duplicateNameDifferentRealpaths, 40),
        mirrorSamples: cleanNameSamples(body.mirrorSamples ?? dryAudit.sameRealpathMirrors, 40),
        reportJsonPath: cleanOptionalString(body.reportJsonPath, 700),
        reportHtmlPath: cleanOptionalString(body.reportHtmlPath, 700),
        source: cleanOptionalString(body.source, 80) ?? "cli",
        agentName: cleanOptionalString(body.agentName, 160),
        secretValuesExposed: body.secretValuesExposed === true,
        generatedAt: Number.isFinite(generatedAt) ? generatedAt : Date.now(),
      });

      const repoSync: { attempted: boolean; ok: boolean; error?: string; push?: unknown; mirror?: unknown } = {
        attempted: syncRepo,
        ok: !syncRepo,
      };
      if (syncRepo) {
        try {
          const push = await ctx.runAction(api.githubRepo.pushToRepo, {
            clerkId: auth.userId,
            _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
          });
          const mirror = await ctx.runAction(api.githubRepo.syncMirror, {
            clerkId: auth.userId,
            _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
          });
          repoSync.ok = true;
          repoSync.push = push;
          repoSync.mirror = mirror;
        } catch (err) {
          repoSync.ok = false;
          repoSync.error = err instanceof Error ? err.message : "unknown repo sync error";
        }
      }

      try {
        const agent = detectAgent(request.headers.get("user-agent"));
        await ctx.runMutation(internal.activity.logActivity, {
          userId: auth.userDbId,
          agentName: typeof body.agentName === "string" && body.agentName.trim()
            ? body.agentName.trim()
            : auth.appName || agent.name,
          agentSource: authAgentSource(auth, request),
          agentVersion: agent.version,
          action: "write",
          resource: "agent-stack/inventory",
          status: "success",
          connectedAppGrantId: auth.connectedAppGrantId,
          durationMs: Date.now() - startedAt,
          details: {
            hostName,
            rootDir,
            uniqueSkillNames: cleanFiniteNumber(totals.uniqueSkillNames),
            missingFromYoumdCatalog: cleanFiniteNumber(totals.missingFromYoumdCatalog),
            duplicateNameDifferentRealpaths: cleanFiniteNumber(totals.duplicateNameDifferentRealpaths),
            repoSyncAttempted: repoSync.attempted,
            repoSyncOk: repoSync.ok,
          },
        });
      } catch {
        // best-effort
      }

      return guard.finish(json({ success: true, ...inventory, repoSync }));
    } catch (err) {
      return serverErrorResponse("me/agent-stack/inventory", err, "Failed to sync agent stack inventory");
    }
  }),
});

// GET /api/v1/me/agent-stack/inventories — List synced safe agent stack inventory summaries.
http.route({
  path: "/api/v1/me/agent-stack/inventories",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "read:private", "projects");
    if (denied) return denied;

    const url = new URL(request.url);
    const limit = cleanFiniteNumber(url.searchParams.get("limit"), 12);
    try {
      const inventories = await ctx.runQuery(api.portfolio.listAgentStackInventories, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        limit,
      });
      return json({ inventories });
    } catch (err) {
      return serverErrorResponse("me/agent-stack/inventories", err, "Failed to list agent stack inventories");
    }
  }),
});

// GET /api/v1/me/agent-stack/drift — Compare synced machine inventories against the freshest baseline.
http.route({
  path: "/api/v1/me/agent-stack/drift",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "read:private", "projects");
    if (denied) return denied;

    const url = new URL(request.url);
    const limit = cleanFiniteNumber(url.searchParams.get("limit"), 12);
    try {
      const drift = await ctx.runQuery(api.portfolio.getAgentStackInventoryDrift, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        limit,
      });
      return json(drift);
    } catch (err) {
      return serverErrorResponse("me/agent-stack/drift", err, "Failed to compute agent stack inventory drift");
    }
  }),
});

// GET /api/v1/me/stack-sources — List identity-backed stack source registry entries.
http.route({
  path: "/api/v1/me/stack-sources",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "read:private", "projects");
    if (denied) return denied;

    try {
      const sources = await ctx.runQuery(api.stackSources.listForUser, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
      });
      return json({
        stackSources: sources.map((s) => ({
          path: s.path,
          remote: s.remote,
          label: s.label,
          kind: s.kind,
        })),
      });
    } catch (err) {
      return serverErrorResponse("me/stack-sources", err, "Failed to list stack sources");
    }
  }),
});

// POST /api/v1/me/stack-sources — Upsert a stack source registry entry.
http.route({
  path: "/api/v1/me/stack-sources",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "write:bundle", "projects");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    const body = await request.json() as Record<string, unknown>;
    const stackPath = cleanOptionalString(body.path, 700);
    const remote = cleanOptionalString(body.remote, 700);
    if (!stackPath) return errorResponse("invalid_request", "path must be a non-empty string", 400);
    if (!remote) return errorResponse("invalid_request", "remote must be a non-empty string", 400);

    try {
      const result = await ctx.runMutation(api.stackSources.upsert, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        path: stackPath,
        remote,
        label: cleanOptionalString(body.label, 200),
        kind: cleanOptionalString(body.kind, 80),
      });
      return guard.finish(json({ success: true, ...result }));
    } catch (err) {
      return serverErrorResponse("me/stack-sources", err, "Failed to upsert stack source");
    }
  }),
});

// POST /api/v1/me/stack-sources/remove — Remove a stack source registry entry.
http.route({
  path: "/api/v1/me/stack-sources/remove",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "write:bundle", "projects");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    const body = await request.json() as Record<string, unknown>;
    const stackPath = cleanOptionalString(body.path, 700);
    if (!stackPath) return errorResponse("invalid_request", "path must be a non-empty string", 400);

    try {
      const result = await ctx.runMutation(api.stackSources.remove, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        path: stackPath,
      });
      return guard.finish(json({ success: true, ...result }));
    } catch (err) {
      return serverErrorResponse("me/stack-sources/remove", err, "Failed to remove stack source");
    }
  }),
});

// GET /api/v1/me/synced-brain/graph — Canonical graph DTO for synced machines, skills, activity, and portfolio signals.
http.route({
  path: "/api/v1/me/synced-brain/graph",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "read:private", "projects");
    if (denied) return denied;

    const url = new URL(request.url);
    const limit = cleanFiniteNumber(url.searchParams.get("limit"), 12);
    const includePortfolioSignals =
      url.searchParams.get("includePortfolioSignals") === "1" ||
      url.searchParams.get("includePortfolioSignals") === "true";
    const includeDoneTasks =
      url.searchParams.get("includeDoneTasks") === "1" ||
      url.searchParams.get("includeDoneTasks") === "true";
    const projectSlug = cleanOptionalString(url.searchParams.get("projectSlug"), 120);

    try {
      const graph = await ctx.runQuery(api.portfolio.getSyncedBrainGraph, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        includePortfolioSignals,
        includeDoneTasks,
        projectSlug,
        limit,
      });
      return json(graph);
    } catch (err) {
      return serverErrorResponse("me/synced-brain/graph", err, "Failed to build synced brain graph");
    }
  }),
});

// POST /api/v1/me/realtime-sync/session — Mint a short-lived websocket credential for trusted local daemons.
http.route({
  path: "/api/v1/me/realtime-sync/session",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "read:private");
    if (denied) return denied;

    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    const clientName = cleanOptionalString(body.clientName, 120);
    const ttlSeconds = cleanFiniteNumber(body.ttlSeconds, 3600);
    const hasVaultScope = auth.scopes === null || auth.declaredScopes.includes("vault");

    try {
      const session = await ctx.runMutation(api.realtimeSync.issueSession, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        clientName,
        credentialType: auth.credentialType,
        canReadVaultMetadata: hasVaultScope,
        ttlSeconds,
      });

      const requestOrigin = new URL(request.url).origin;
      const convexUrl = requestOrigin.replace(".convex.site", ".convex.cloud");

      return json({
        success: true,
        schemaVersion: "you-md/realtime-sync-session/v1",
        convexUrl,
        ...session,
        canReadVaultMetadata: hasVaultScope,
        secretValuesExposed: false,
      });
    } catch (err) {
      return serverErrorResponse("me/realtime-sync/session", err, "Failed to create realtime sync session");
    }
  }),
});

// GET/POST /api/v1/me/agent-bus/messages — private realtime lane for trusted local agents/machines.
http.route({
  path: "/api/v1/me/agent-bus/messages",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "read:private", "activity");
    if (denied) return denied;

    const url = new URL(request.url);
    const channel = url.searchParams.get("channel") || undefined;
    const sinceRaw = url.searchParams.get("since");
    const limitRaw = url.searchParams.get("limit");
    const since = sinceRaw ? Number(sinceRaw) : undefined;
    const limit = limitRaw ? Number(limitRaw) : undefined;

    try {
      const messages = await ctx.runQuery(api.agentBus.listMessages, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        channel,
        since: Number.isFinite(since) ? since : undefined,
        limit: Number.isFinite(limit) ? limit : undefined,
      });
      return json({
        success: true,
        schemaVersion: "you-md/agent-bus/messages/v1",
        messages,
        count: messages.length,
        secretValuesExposed: false,
      });
    } catch (err) {
      return serverErrorResponse("me/agent-bus/messages", err, "Failed to load agent bus messages");
    }
  }),
});

http.route({
  path: "/api/v1/me/agent-bus/messages",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "write:memories", "memories");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    let body: {
      channel?: string;
      kind?: string;
      body?: string;
      sourceHost?: string;
      sourceAgent?: string;
      sourceRuntime?: string;
      targetHost?: string;
      targetAgent?: string;
      metadata?: unknown;
    };
    try {
      body = await request.json();
    } catch {
      return errorResponse("invalid_request", "Invalid JSON body", 400);
    }

    // Cross-machine command dispatch (Phase 1, CROSS-MACHINE-AGENTS.md §7) is
    // gated behind the opt-in `remote:command` scope. Posting an ordinary
    // agent-bus message stays on write:memories; only the command channel
    // requires the elevated scope so an agent key cannot trigger remote git
    // mutations unless explicitly granted.
    if (body.channel === "remote-command") {
      const remoteDenied = await requireScope(ctx, request, auth, "remote:command", "activity");
      if (remoteDenied) return remoteDenied;
    }

    if (!body.body || typeof body.body !== "string") {
      return errorResponse("invalid_request", "body is required", 400);
    }

    try {
      const message = await ctx.runMutation(api.agentBus.sendMessage, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        channel: body.channel,
        kind: body.kind,
        body: body.body,
        sourceHost: body.sourceHost,
        sourceAgent: body.sourceAgent,
        sourceRuntime: body.sourceRuntime,
        targetHost: body.targetHost,
        targetAgent: body.targetAgent,
        metadata: body.metadata,
      });

      try {
        await ctx.runMutation(internal.activity.logActivity, {
          userId: auth.userDbId,
          agentName: body.sourceAgent || detectAgent(request.headers.get("user-agent")).name,
          agentSource: authAgentSource(auth, request),
          action: "agent_message",
          resource: `agent-bus/${message.channel}`,
          scope: "write:memories",
          apiKeyId: auth.apiKeyId,
          connectedAppGrantId: auth.connectedAppGrantId,
          status: "success",
          details: {
            messageId: message.messageId,
            kind: message.kind,
            sourceHost: message.sourceHost,
            targetHost: message.targetHost,
            targetAgent: message.targetAgent,
            secretValuesExposed: false,
          },
        });
      } catch {
        // best-effort observability; the realtime message itself is saved.
      }

      return guard.finish(json({
        success: true,
        schemaVersion: "you-md/agent-bus/message/v1",
        message,
        secretValuesExposed: false,
      }, 201));
    } catch (err) {
      return serverErrorResponse("me/agent-bus/messages", err, "Failed to send agent bus message");
    }
  }),
});

// ── Cross-machine remote commands (CROSS-MACHINE-AGENTS.md §4, Phase 2) ──
// Durable command tracking over the Phase 1 agent-bus dispatch convention.
// All routes are owner-scoped under /me/*. Backward-compatible: Phase 1 still
// works bus-only if a client/daemon never touches these routes.

// POST /api/v1/me/remote-commands/dispatch — write a queued row AND post the
// existing remote-command bus message. Requires the opt-in remote:command scope
// (same gate as posting a remote-command on the agent bus).
http.route({
  path: "/api/v1/me/remote-commands/dispatch",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "remote:command", "activity");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    let body: {
      requestId?: string;
      action?: string;
      args?: unknown;
      targetHost?: string;
      sourceHost?: string;
      sourceAgent?: string;
      body?: string;
      issuedAt?: number;
      expiresAt?: number;
    };
    try {
      body = await request.json();
    } catch {
      return errorResponse("invalid_request", "Invalid JSON body", 400);
    }

    if (!body.requestId || typeof body.requestId !== "string") {
      return errorResponse("invalid_request", "requestId is required", 400);
    }
    if (!body.action || typeof body.action !== "string") {
      return errorResponse("invalid_request", "action is required", 400);
    }
    if (!body.targetHost || typeof body.targetHost !== "string") {
      return errorResponse("invalid_request", "targetHost is required", 400);
    }

    const now = Date.now();
    const issuedAt = Number.isFinite(body.issuedAt) ? (body.issuedAt as number) : now;
    const expiresAt = Number.isFinite(body.expiresAt)
      ? (body.expiresAt as number)
      : now + 5 * 60 * 1000;
    const args =
      body.args && typeof body.args === "object" && !Array.isArray(body.args)
        ? (body.args as Record<string, unknown>)
        : undefined;

    try {
      // 1. Durable queued row (idempotent on requestId).
      const command = await ctx.runMutation(api.remoteCommands.enqueue, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        requestId: body.requestId,
        targetHost: body.targetHost,
        sourceHost: body.sourceHost || "",
        sourceAgent: body.sourceAgent || "youmd remote",
        action: body.action,
        args,
        issuedAt,
        expiresAt,
      });

      // 2. Post the Phase 1 bus message so existing daemons still receive it.
      const message = await ctx.runMutation(api.agentBus.sendMessage, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        channel: "remote-command",
        kind: "command",
        body:
          (typeof body.body === "string" && body.body.trim()) ||
          `${body.action}${args?.project ? ` ${args.project}` : ""}`,
        sourceHost: body.sourceHost,
        sourceAgent: body.sourceAgent || "youmd remote",
        targetHost: body.targetHost,
        metadata: {
          requestId: body.requestId,
          action: body.action,
          args,
          issuedAt,
          expiresAt,
          secretValuesExposed: false,
        },
      });

      return guard.finish(json({
        success: true,
        schemaVersion: "you-md/remote-command/v1",
        command,
        message,
        secretValuesExposed: false,
      }, 201));
    } catch (err) {
      return serverErrorResponse("me/remote-commands/dispatch", err, "Failed to dispatch remote command");
    }
  }),
});

// PATCH /api/v1/me/remote-commands/status — daemon best-effort status update
// (acked→running→done/error). No-op if the requestId has no queued row.
http.route({
  path: "/api/v1/me/remote-commands/status",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "remote:command", "activity");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    let body: {
      requestId?: string;
      status?: string;
      ok?: boolean;
      output?: string;
      exitCode?: number;
      gitState?: unknown;
      completedAt?: number;
    };
    try {
      body = await request.json();
    } catch {
      return errorResponse("invalid_request", "Invalid JSON body", 400);
    }

    if (!body.requestId || typeof body.requestId !== "string") {
      return errorResponse("invalid_request", "requestId is required", 400);
    }
    if (!body.status || typeof body.status !== "string") {
      return errorResponse("invalid_request", "status is required", 400);
    }

    try {
      const command = await ctx.runMutation(api.remoteCommands.updateStatus, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        requestId: body.requestId,
        status: body.status,
        ok: body.ok,
        output: body.output,
        exitCode: body.exitCode,
        gitState: body.gitState,
        completedAt: body.completedAt,
      });
      return guard.finish(json({
        success: true,
        schemaVersion: "you-md/remote-command/v1",
        command, // null when no queued row existed (bus-only command)
        secretValuesExposed: false,
      }));
    } catch (err) {
      return serverErrorResponse("me/remote-commands/status", err, "Failed to update remote command status");
    }
  }),
});

// GET /api/v1/me/remote-commands?requestId=&targetHost=&status= — issuer status
// poll (requestId) or daemon work pull (targetHost+status).
http.route({
  path: "/api/v1/me/remote-commands",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "read:private", "activity");
    if (denied) return denied;

    const url = new URL(request.url);
    const requestId = url.searchParams.get("requestId") || undefined;
    const targetHost = url.searchParams.get("targetHost") || undefined;
    const status = url.searchParams.get("status") || undefined;
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw ? Number(limitRaw) : undefined;

    try {
      // Single-command status lookup.
      if (requestId) {
        const command = await ctx.runQuery(api.remoteCommands.getByRequestId, {
          clerkId: auth.userId,
          _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
          requestId,
        });
        if (!command) {
          return errorResponse("not_found", "remote command not found", 404);
        }
        return json({
          success: true,
          schemaVersion: "you-md/remote-command/v1",
          command,
          secretValuesExposed: false,
        });
      }

      // List / work-pull.
      const commands = await ctx.runQuery(api.remoteCommands.list, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        targetHost,
        status,
        limit: Number.isFinite(limit) ? limit : undefined,
      });
      return json({
        success: true,
        schemaVersion: "you-md/remote-commands/v1",
        commands,
        count: commands.length,
        secretValuesExposed: false,
      });
    } catch (err) {
      return serverErrorResponse("me/remote-commands", err, "Failed to load remote commands");
    }
  }),
});

// POST /api/v1/me/brain-activities — record a redacted, owner-scoped live brain activity event.
http.route({
  path: "/api/v1/me/brain-activities",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "write:bundle", "activity");
    if (denied) return denied;

    let body: {
      activityId?: string;
      source?: string;
      channel?: string;
      kind?: string;
      title?: string;
      detail?: string;
      status?: string;
      projectSlug?: string;
      entityType?: string;
      entityId?: string;
      sourceHost?: string;
      sourceAgent?: string;
      sourceRuntime?: string;
      metadata?: unknown;
      occurredAt?: number;
    };
    try {
      body = await request.json();
    } catch {
      return errorResponse("invalid_request", "Invalid JSON body", 400);
    }

    if (!body.title || typeof body.title !== "string") {
      return errorResponse("invalid_request", "title is required", 400);
    }
    if (!body.source || typeof body.source !== "string") {
      return errorResponse("invalid_request", "source is required", 400);
    }

    try {
      const agent = detectAgent(request.headers.get("user-agent"));
      const activity = await ctx.runMutation(api.brainActivity.recordActivity, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        activityId: body.activityId,
        source: body.source,
        channel: body.channel,
        kind: body.kind,
        title: body.title,
        detail: body.detail,
        status: body.status,
        projectSlug: body.projectSlug,
        entityType: body.entityType,
        entityId: body.entityId,
        sourceHost: body.sourceHost,
        sourceAgent: body.sourceAgent ?? auth.appName ?? agent.name,
        sourceRuntime: body.sourceRuntime,
        metadata: body.metadata,
        occurredAt: Number.isFinite(body.occurredAt) ? body.occurredAt : undefined,
      });

      try {
        await ctx.runMutation(internal.activity.logActivity, {
          userId: auth.userDbId,
          agentName: body.sourceAgent || auth.appName || agent.name,
          agentSource: authAgentSource(auth, request),
          agentVersion: agent.version,
          action: "write",
          resource: `brain-activities/${activity.source}`,
          scope: "write:bundle",
          apiKeyId: auth.apiKeyId,
          connectedAppGrantId: auth.connectedAppGrantId,
          status: "success",
          details: {
            activityId: activity.activityId,
            source: activity.source,
            kind: activity.kind,
            secretValuesExposed: false,
          },
        });
      } catch {
        // best-effort observability; the activity itself is saved.
      }

      return json({
        success: true,
        schemaVersion: "you-md/brain-activity/v1",
        activity,
        secretValuesExposed: false,
      }, 201);
    } catch (err) {
      return serverErrorResponse("me/brain-activities", err, "Failed to record brain activity");
    }
  }),
});

// GET/POST /api/v1/me/secret-vault/env — Account-backed encrypted .env.local vault snapshots.
http.route({
  path: "/api/v1/me/secret-vault/devices",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "vault");
    if (denied) return denied;

    try {
      const devices = await ctx.runQuery(api.secretVault.listDevices, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
      });
      return json({
        success: true,
        devices: devices.map((device) => ({
          deviceId: device.deviceId,
          deviceName: device.deviceName,
          hostName: device.hostName,
          platform: device.platform,
          publicKeyPem: device.publicKeyPem,
          keyAlgorithm: device.keyAlgorithm,
          trusted: device.trusted,
          revokedAt: device.revokedAt,
          lastSeenAt: device.lastSeenAt,
          createdAt: device.createdAt,
          updatedAt: device.updatedAt,
        })),
        secretValuesExposed: false,
      });
    } catch (err) {
      return serverErrorResponse("me/secret-vault/devices", err, "Failed to load Secret Vault devices");
    }
  }),
});

http.route({
  path: "/api/v1/me/secret-vault/devices",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "vault");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    try {
      const body = await request.json();
      const deviceId = cleanOptionalString(body.deviceId, 120);
      const deviceName = cleanOptionalString(body.deviceName, 180) ?? "trusted device";
      const publicKeyPem = typeof body.publicKeyPem === "string" ? body.publicKeyPem.trim().slice(0, 8000) : "";
      const keyAlgorithm = cleanOptionalString(body.keyAlgorithm, 80) ?? "rsa-oaep-sha256";
      if (!deviceId || !/^svd_[A-Za-z0-9_-]{12,}$/.test(deviceId)) {
        return errorResponse("invalid_request", "deviceId must be a stable Secret Vault device id", 400);
      }
      if (!publicKeyPem.includes("BEGIN PUBLIC KEY") || !publicKeyPem.includes("END PUBLIC KEY")) {
        return errorResponse("invalid_request", "publicKeyPem must be an SPKI public key PEM", 400);
      }
      if (keyAlgorithm !== "rsa-oaep-sha256") {
        return errorResponse("invalid_request", "Only rsa-oaep-sha256 device keys are supported", 400);
      }

      const device = await ctx.runMutation(api.secretVault.registerDevice, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        deviceId,
        deviceName,
        hostName: cleanOptionalString(body.hostName, 180),
        platform: cleanOptionalString(body.platform, 80),
        publicKeyPem,
        keyAlgorithm,
      });

      return guard.finish(json({
        success: true,
        device: {
          deviceId: device.deviceId,
          deviceName: device.deviceName,
          hostName: device.hostName,
          platform: device.platform,
          publicKeyPem: device.publicKeyPem,
          keyAlgorithm: device.keyAlgorithm,
          trusted: device.trusted,
          lastSeenAt: device.lastSeenAt,
          createdAt: device.createdAt,
          updatedAt: device.updatedAt,
        },
        secretValuesExposed: false,
      }, 201));
    } catch (err) {
      return serverErrorResponse("me/secret-vault/devices", err, "Failed to register Secret Vault device");
    }
  }),
});

http.route({
  path: "/api/v1/me/secret-vault/envelopes",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "vault");
    if (denied) return denied;

    const url = new URL(request.url);
    const deviceId = cleanOptionalString(url.searchParams.get("deviceId"), 120);
    if (!deviceId) {
      return errorResponse("invalid_request", "deviceId is required", 400);
    }

    try {
      const result = await ctx.runQuery(api.secretVault.getLatestKeyEnvelopeForDevice, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        deviceId,
      });
      if (!result) {
        return errorResponse("not_found", "No Secret Vault key envelope exists for this device yet", 404);
      }
      await ctx.runMutation(api.secretVault.recordPullActivity, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        kind: "envelope-pulled",
        snapshotId: result.snapshot.id as Id<"secretVaultSnapshots">,
        deviceId,
        fileName: result.snapshot.fileName,
        projectCount: result.snapshot.projectCount,
        variableCount: result.snapshot.variableCount,
        sizeBytes: result.snapshot.sizeBytes,
        sourceHost: result.envelope.sourceHost,
        targetHost: deviceId,
        sha256: result.snapshot.sha256,
      });
      return json({
        success: true,
        snapshot: omitSecretVaultManifest(result.snapshot),
        envelope: {
          deviceId: result.envelope.deviceId,
          snapshotId: result.envelope.snapshotId,
          wrappedPassphraseBase64: result.envelope.wrappedPassphraseBase64,
          wrapAlgorithm: result.envelope.wrapAlgorithm,
          sourceHost: result.envelope.sourceHost,
          createdAt: result.envelope.createdAt,
          updatedAt: result.envelope.updatedAt,
        },
        secretValuesExposed: false,
      });
    } catch (err) {
      return serverErrorResponse("me/secret-vault/envelopes", err, "Failed to load Secret Vault key envelope");
    }
  }),
});

http.route({
  path: "/api/v1/me/secret-vault/envelopes",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "vault");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    try {
      const body = await request.json();
      const snapshotId = cleanOptionalString(body.snapshotId, 120);
      const deviceId = cleanOptionalString(body.deviceId, 120);
      const wrappedPassphraseBase64 = cleanOptionalString(body.wrappedPassphraseBase64, 12000);
      const wrapAlgorithm = cleanOptionalString(body.wrapAlgorithm, 80) ?? "rsa-oaep-sha256";
      if (!snapshotId || !deviceId || !wrappedPassphraseBase64) {
        return errorResponse("invalid_request", "snapshotId, deviceId, and wrappedPassphraseBase64 are required", 400);
      }
      if (wrapAlgorithm !== "rsa-oaep-sha256") {
        return errorResponse("invalid_request", "Only rsa-oaep-sha256 key envelopes are supported", 400);
      }

      const envelope = await ctx.runMutation(api.secretVault.upsertKeyEnvelope, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        snapshotId: snapshotId as Id<"secretVaultSnapshots">,
        deviceId,
        wrappedPassphraseBase64,
        wrapAlgorithm,
        sourceHost: cleanOptionalString(body.sourceHost, 180),
      });

      return guard.finish(json({
        success: true,
        envelope: envelope ? {
          deviceId: envelope.deviceId,
          snapshotId: envelope.snapshotId,
          wrapAlgorithm: envelope.wrapAlgorithm,
          sourceHost: envelope.sourceHost,
          createdAt: envelope.createdAt,
          updatedAt: envelope.updatedAt,
        } : null,
        secretValuesExposed: false,
      }, 201));
    } catch (err) {
      return serverErrorResponse("me/secret-vault/envelopes", err, "Failed to save Secret Vault key envelope");
    }
  }),
});

http.route({
  path: "/api/v1/me/secret-vault/env",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "vault");
    if (denied) return denied;

    const url = new URL(request.url);
    const wantsDownload =
      url.searchParams.get("download") === "1" ||
      url.searchParams.get("download") === "true" ||
      url.searchParams.get("download") === "latest";
    const limit = cleanFiniteNumber(url.searchParams.get("limit"), 8);

    try {
      if (!wantsDownload) {
        const snapshots = await ctx.runQuery(api.secretVault.listEnvVaultSnapshots, {
          clerkId: auth.userId,
          _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
          limit,
        });
        return json({
          success: true,
          kind: "env-local",
          snapshots: snapshots.map(omitSecretVaultManifest),
          secretValuesExposed: false,
        });
      }

      const latest = await ctx.runQuery(api.secretVault.getLatestEnvVaultSnapshot, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
      });
      if (!latest) {
        return errorResponse("not_found", "No encrypted env vault snapshot has been uploaded yet", 404);
      }

      const blob = await ctx.storage.get(latest.storageId);
      if (!blob) {
        return errorResponse("not_found", "Encrypted env vault storage object is missing", 404);
      }

      const arrayBuffer = await blob.arrayBuffer();
      const encryptedArchiveBase64 = arrayBufferToBase64(arrayBuffer);
      const computedSha256 = await sha256HexBytes(new Uint8Array(arrayBuffer));
      if (computedSha256 !== latest.sha256) {
        return errorResponse("conflict", "Encrypted env vault checksum mismatch", 409);
      }

      await ctx.runMutation(api.secretVault.recordPullActivity, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        kind: "snapshot-pulled",
        snapshotId: latest.id as Id<"secretVaultSnapshots">,
        fileName: latest.fileName,
        projectCount: latest.projectCount,
        variableCount: latest.variableCount,
        sizeBytes: latest.sizeBytes,
        sourceHost: latest.sourceHost,
        sha256: latest.sha256,
      });

      try {
        const agent = detectAgent(request.headers.get("user-agent"));
        await ctx.runMutation(internal.activity.logActivity, {
          userId: auth.userDbId,
          agentName: auth.appName || agent.name,
          agentSource: authAgentSource(auth, request),
          agentVersion: agent.version,
          action: "vault_read",
          resource: "secret-vault/env",
          scope: "vault",
          apiKeyId: auth.apiKeyId,
          connectedAppGrantId: auth.connectedAppGrantId,
          status: "success",
          details: {
            fileName: latest.fileName,
            sizeBytes: latest.sizeBytes,
            projectCount: latest.projectCount,
            sourceHost: latest.sourceHost,
          },
        });
      } catch {
        // best-effort
      }

      return json({
        success: true,
        kind: "env-local",
        snapshot: {
          ...latest,
          storageId: undefined,
        },
        encryptedArchiveBase64,
        secretValuesExposed: false,
      });
    } catch (err) {
      return serverErrorResponse("me/secret-vault/env", err, "Failed to load encrypted env vault");
    }
  }),
});

http.route({
  path: "/api/v1/me/secret-vault/env",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "vault");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    const startedAt = Date.now();
    try {
      const body = await request.json();
      if (!body || typeof body.encryptedArchiveBase64 !== "string") {
        return errorResponse("invalid_request", "encryptedArchiveBase64 must be a non-empty base64 string", 400);
      }

      const archiveBytes = base64ToBytes(body.encryptedArchiveBase64);
      if (archiveBytes.byteLength === 0) {
        return errorResponse("invalid_request", "encryptedArchiveBase64 decoded to an empty archive", 400);
      }
      if (archiveBytes.byteLength > SECRET_VAULT_MAX_BYTES) {
        return errorResponse(
          "invalid_request",
          `Encrypted env vault is too large for account sync v1 (${archiveBytes.byteLength} bytes > ${SECRET_VAULT_MAX_BYTES} bytes)`,
          413,
          { maxBytes: SECRET_VAULT_MAX_BYTES }
        );
      }

      const sha256 = await sha256HexBytes(archiveBytes);
      const declaredSha = cleanOptionalString(body.sha256, 90);
      if (declaredSha && declaredSha !== sha256) {
        return errorResponse("conflict", "Encrypted env vault checksum does not match upload body", 409);
      }

      const manifestText = cleanOptionalString(body.manifestText, 50_000);
      const manifestSha256 = cleanOptionalString(body.manifestSha256, 90);
      const encryption = body.encryption && typeof body.encryption === "object"
        ? body.encryption as Record<string, unknown>
        : {};
      const extension = cleanOptionalString(encryption.extension ?? body.extension, 20) ?? "enc";
      const fileName = cleanFileName(
        body.fileName,
        `env-vault-cloud-${new Date(startedAt).toISOString().replace(/[:.]/g, "-")}.tar.${extension}`
      );
      const contentType = cleanOptionalString(body.contentType, 120) ?? "application/octet-stream";
      const storageId = await ctx.storage.store(new Blob([archiveBytes], { type: contentType }));

      const snapshot = await ctx.runMutation(api.secretVault.createEnvVaultSnapshot, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        kind: "env-local",
        label: cleanOptionalString(body.label, 160),
        fileName,
        storageId,
        contentType,
        encryptionTool: cleanOptionalString(encryption.tool ?? body.encryptionTool, 80) ?? "unknown",
        extension,
        formatVersion: cleanFiniteNumber(encryption.formatVersion ?? body.formatVersion, 1),
        sizeBytes: archiveBytes.byteLength,
        sha256,
        manifestText,
        manifestSha256,
        projectCount: cleanFiniteNumber(body.projectCount),
        variableCount: body.variableCount === undefined ? undefined : cleanFiniteNumber(body.variableCount),
        agentAuthIncluded: body.agentAuthIncluded === true,
        sourceHost: cleanOptionalString(body.sourceHost, 180),
        sourceRoot: cleanOptionalString(body.sourceRoot, 700),
      });

      try {
        const agent = detectAgent(request.headers.get("user-agent"));
        await ctx.runMutation(internal.activity.logActivity, {
          userId: auth.userDbId,
          agentName: auth.appName || agent.name,
          agentSource: authAgentSource(auth, request),
          agentVersion: agent.version,
          action: "vault_write",
          resource: "secret-vault/env",
          scope: "vault",
          apiKeyId: auth.apiKeyId,
          connectedAppGrantId: auth.connectedAppGrantId,
          status: "success",
          durationMs: Date.now() - startedAt,
          details: {
            fileName,
            sizeBytes: archiveBytes.byteLength,
            projectCount: cleanFiniteNumber(body.projectCount),
            variableCount: body.variableCount === undefined ? undefined : cleanFiniteNumber(body.variableCount),
            sourceHost: cleanOptionalString(body.sourceHost, 180),
          },
        });
      } catch {
        // best-effort
      }

      return guard.finish(json({
        success: true,
        kind: "env-local",
        snapshot: omitSecretVaultManifest(snapshot),
        secretValuesExposed: false,
      }));
    } catch (err) {
      return serverErrorResponse("me/secret-vault/env", err, "Failed to save encrypted env vault");
    }
  }),
});

// POST /api/v1/me/sources — Add a source
http.route({
  path: "/api/v1/me/sources",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "write:bundle");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    try {
      const body = await request.json();
      const sourceId = await ctx.runMutation(api.me.addSource, {
        clerkId: auth.userId,        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        sourceType: body.sourceType,
        sourceUrl: body.sourceUrl,
      });
      return guard.finish(json({ sourceId }));
    } catch (err) {
      return serverErrorResponse("me/sources", err, "Failed to add source");
    }
  }),
});

// GET /api/v1/me/sources — List sources (supports ?cursor= + ?limit= pagination; paginated calls return { sources, nextCursor, hasMore })
http.route({
  path: "/api/v1/me/sources",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "read:private");
    if (denied) return denied;

    const { cursor, limit, paginated } = parseListPagination(new URL(request.url));
    if (paginated) {
      try {
        const result = await ctx.runQuery(api.me.getSourcesPage, {
          clerkId: auth.userId,
          _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
          cursor,
          numItems: limit ?? 50,
        });
        return json({ sources: result.page, ...pageMeta(result) });
      } catch {
        return errorResponse("invalid_request", "Invalid pagination cursor", 400);
      }
    }

    const sources = await ctx.runQuery(api.me.getSources, {
      clerkId: auth.userId,      _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
    });

    return json(sources);
  }),
});

// GET /api/v1/me/analytics — View counts
http.route({
  path: "/api/v1/me/analytics",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "read:private");
    if (denied) return denied;

    const analytics = await ctx.runQuery(api.me.getAnalytics, {
      clerkId: auth.userId,      _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
    });

    return json(analytics);
  }),
});

// ============================================================
// PIPELINE ENDPOINTS
// ============================================================

// POST /api/v1/me/build — Trigger the ingestion pipeline
http.route({
  path: "/api/v1/me/build",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "write:bundle");
    if (denied) return denied;
    // Pipeline builds are LLM-expensive — stricter per-key limit (P22).
    const guard = await guardWrite(ctx, request, auth, BUILD_RATE_LIMIT);
    if (guard.blocked) return guard.blocked;

    try {
      const result = await ctx.runMutation(api.pipeline.index.startPipeline, {
        clerkId: auth.userId,        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
      });
      return guard.finish(json(result));
    } catch (err) {
      return serverErrorResponse("me/build", err, "Failed to start pipeline");
    }
  }),
});

// GET /api/v1/me/build/status — Get pipeline status
http.route({
  path: "/api/v1/me/build/status",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "read:private");
    if (denied) return denied;

    const status = await ctx.runQuery(api.pipeline.index.getPipelineStatus, {
      clerkId: auth.userId,      _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
    });

    return json(status);
  }),
});

// ============================================================
// ONBOARDING CHAT PROXY (no auth — public, IP-rate-limited)
// ============================================================
//
// Cycle 46: previously these public endpoints called paid LLM APIs (Anthropic,
// Perplexity, xAI, OpenRouter) with NO rate limit and NO payload size cap. An
// anonymous attacker could `curl` them in a loop and drain Houston's API
// budgets in hours.
//
// Now: 30 calls per IP per minute, 50KB payload cap. Underlying actions are
// `internalAction` so they can't be called directly via /api/action either.

const CHAT_PUBLIC_RATE_LIMIT = { windowMs: 60_000, maxCalls: 30 };
const CHAT_MAX_PAYLOAD_CHARS = 50_000;

function getCallerIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "anon";
}

function totalMessageChars(messages: unknown): number {
  if (!Array.isArray(messages)) return 0;
  let n = 0;
  for (const m of messages) {
    if (m && typeof m === "object") {
      const content = (m as { content?: unknown }).content;
      if (typeof content === "string") n += content.length;
    }
  }
  return n;
}

http.route({
  path: "/api/v1/chat",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();

      // Cycle 46: payload size cap before any LLM call
      const chars = totalMessageChars(body.messages);
      if (chars > CHAT_MAX_PAYLOAD_CHARS) {
        return errorResponse("payload_too_large", `payload too large (${chars} > ${CHAT_MAX_PAYLOAD_CHARS} chars)`, 413);
      }

      // Cycle 46: per-IP rate limit
      try {
        await ctx.runMutation(internal.lib.rateLimit.checkAndRecord, {
          bucket: `chat:${getCallerIp(request)}`,
          windowMs: CHAT_PUBLIC_RATE_LIMIT.windowMs,
          maxCalls: CHAT_PUBLIC_RATE_LIMIT.maxCalls,
        });
      } catch (err) {
        return errorResponse("rate_limited", err instanceof Error ? err.message : "rate limit exceeded", 429);
      }

      // Cycle 48: daily spend cap kill switch (defense-in-depth vs botnets)
      try {
        await ctx.runMutation(internal.lib.spendCap.checkAndRecord, {
          endpoint: "chat",
        });
      } catch (err) {
        return errorResponse("upstream_unavailable", err instanceof Error ? err.message : "service temporarily unavailable", 503);
      }

      const content = await ctx.runAction(internal.chat.onboardingChat, {
        messages: body.messages,
      });
      return json({ content });
    } catch (err) {
      return serverErrorResponse("chat", err, "Chat failed");
    }
  }),
});

// POST /api/v1/chat/ack — Fast acknowledgment via Haiku (~1-2s response)
// Returns a quick 1-sentence ack + plan before the full response streams
http.route({
  path: "/api/v1/chat/ack",
  method: "POST",
  handler: httpAction(async (_ctx, request) => {
    const body = await request.json();
    const userMessage = body.message || "";
    const context = body.context || "";

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return json({ ack: "on it.", plan: [] });
    }

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 200,
          temperature: 0.5,
          system: `you are the you.md identity agent. respond with ONLY a raw JSON object. no markdown, no code fences.

format: {"ack":"<one casual line, max 10 words, what you're doing right now>"}

voice rules:
- lowercase always. no exclamation marks. no "great!" or "sure!". no "I'll".
- action-focused: "pulling your linkedin now." / "scaffolding project files." / "updating your bio."
- never say "certainly" / "absolutely" / "of course" / "happy to"
- never say what you CAN'T do — you can do everything
- if they asked to scrape: "pulling [platform] now."
- if they asked to scaffold/create files: "writing your [thing] now."
- if they asked a question: answer direction in 5-10 words
- if they shared info: "got it — saving to your profile."
${context ? `\nwho this is: ${context.slice(0, 200)}` : ""}`,
          messages: [{ role: "user", content: userMessage.slice(0, 300) }],
        }),
        signal: AbortSignal.timeout(8_000),
      });

      if (!res.ok) {
        return json({ ack: "on it.", plan: [] }, 200, CORS_HEADERS);
      }

      const data = await res.json();
      const text = data.content?.[0]?.text || "";

      try {
        // Strip code fences if model wrapped the JSON
        const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        const parsed = JSON.parse(cleaned);
        const ack = typeof parsed.ack === "string" ? parsed.ack.trim() : "on it.";
        return json({ ack }, 200, CORS_HEADERS);
      } catch {
        // If JSON parse fails, use the raw text as ack
        const cleanAck = text.replace(/```[\s\S]*```/g, "").replace(/[{}"\[\]]/g, "").trim().slice(0, 80);
        return json({ ack: cleanAck || "on it." }, 200, CORS_HEADERS);
      }
    } catch {
      return json({ ack: "on it.", plan: [] }, 200, CORS_HEADERS);
    }
  }),
});

http.route({
  path: "/api/v1/chat/ack",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })),
});

// POST /api/v1/chat/stream — Streaming chat via SSE
// Bypasses Convex actions to stream directly from Anthropic API.
http.route({
  path: "/api/v1/chat/stream",
  method: "POST",
  handler: httpAction(async (_ctx, request) => {
    const body = await request.json();
    const messages: { role: string; content: string }[] = body.messages || [];

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY;

    if (!anthropicKey && !openrouterKey) {
      return errorResponse("not_configured", "No LLM API key configured", 500);
    }

    // T49: strip client-supplied system messages; server controls the system prompt.
    const { filtered: conversationMessages, droppedSystemCount } = filterClientMessages(messages);
    if (droppedSystemCount > 0) {
      console.warn(`[chat-proxy] /api/v1/chat/stream: dropped ${droppedSystemCount} client system message(s)`);
    }
    const systemMessage = { role: "system", content: YOU_AGENT_SYSTEM_PROMPT };

    // Helper: create SSE response from a ReadableStream
    function sseResponse(stream: ReadableStream): Response {
      return new Response(stream, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          ...CORS_HEADERS,
        },
      });
    }

    // Helper: transform upstream SSE into our simplified format (for OpenRouter/OpenAI format)
    function transformStream(
      upstream: ReadableStream<Uint8Array>,
      extractText: (parsed: {
        choices?: Array<{ delta?: { content?: string } }>;
      }) => string | null
    ): ReadableStream {
      const reader = upstream.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      return new ReadableStream({
        async pull(controller) {
          try {
            const { done, value } = await reader.read();
            if (done) {
              controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() || "";
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") {
                controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
                continue;
              }
              try {
                const parsed = JSON.parse(data);
                const text = extractText(parsed);
                if (text) {
                  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ text })}\n\n`));
                }
              } catch { /* skip */ }
            }
          } catch (err) {
            controller.error(err);
          }
        },
      });
    }

    // Helper: transform Anthropic SSE stream, emitting text deltas AND complete tool_use blocks
    // Uses an async-loop + TransformStream pattern that works reliably in Convex's runtime
    function transformAnthropicStream(upstream: ReadableStream<Uint8Array>): ReadableStream {
      const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
      const writer = writable.getWriter();
      const reader = upstream.getReader();
      const enc = new TextEncoder();
      const dec = new TextDecoder();
      let buf = "";

      // Track each content block by index
      const blocks = new Map<number, { type: "text" | "tool_use"; name?: string; jsonBuf?: string }>();

      // Drive the transform asynchronously — don't await, let Convex stream the output
      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              await writer.write(enc.encode("data: [DONE]\n\n"));
              await writer.close();
              break;
            }

            buf += dec.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") {
                await writer.write(enc.encode("data: [DONE]\n\n"));
                continue;
              }
              try {
                const parsed = JSON.parse(data);

                if (parsed.type === "content_block_start") {
                  const cb = parsed.content_block;
                  if (cb?.type === "text") {
                    blocks.set(parsed.index, { type: "text" });
                  } else if (cb?.type === "tool_use") {
                    blocks.set(parsed.index, { type: "tool_use", name: cb.name, jsonBuf: "" });
                    // Immediately notify frontend a tool call is starting
                    await writer.write(enc.encode(`data: ${JSON.stringify({ tool_streaming: { name: cb.name, status: "started" } })}\n\n`));
                  }
                } else if (parsed.type === "content_block_delta") {
                  const block = blocks.get(parsed.index);
                  if (!block) continue;
                  const { delta } = parsed;

                  if (delta?.type === "text_delta" && block.type === "text" && delta.text) {
                    await writer.write(enc.encode(`data: ${JSON.stringify({ text: delta.text })}\n\n`));
                  } else if (delta?.type === "input_json_delta" && block.type === "tool_use") {
                    block.jsonBuf = (block.jsonBuf || "") + (delta.partial_json || "");
                    // Emit byte count so frontend can show progress (every ~500 chars to avoid overhead)
                    const len = (block.jsonBuf || "").length;
                    if (len > 0 && len % 500 < 50) {
                      await writer.write(enc.encode(`data: ${JSON.stringify({ tool_streaming: { name: block.name, status: "writing", bytes: len } })}\n\n`));
                    }
                  }
                } else if (parsed.type === "content_block_stop") {
                  const block = blocks.get(parsed.index);
                  if (block?.type === "tool_use") {
                    try {
                      const input = JSON.parse(block.jsonBuf || "{}");
                      await writer.write(
                        enc.encode(`data: ${JSON.stringify({ tool_use: { name: block.name, input } })}\n\n`)
                      );
                    } catch { /* malformed tool JSON — skip */ }
                    blocks.delete(parsed.index);
                  } else {
                    blocks.delete(parsed.index);
                  }
                }
                // message_delta, message_stop, ping — ignore
              } catch { /* skip malformed SSE */ }
            }
          }
        } catch {
          try { await writer.abort(); } catch { /* already closed */ }
        }
      })();

      return readable;
    }

    // Try Anthropic streaming first
    if (anthropicKey) {
      try {
        const upstreamRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 64000,
            temperature: 0.4,
            stream: true,
            system: systemMessage?.content || "",
            messages: conversationMessages.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
            tools: [
              {
                name: "update_profile",
                description: "Save updates to one or more sections of the user's identity profile. ALWAYS call this tool when modifying any profile data — never describe changes in text without calling this tool. The platform will auto-compile and publish the updates instantly.",
                input_schema: {
                  type: "object",
                  properties: {
                    updates: {
                      type: "array",
                      description: "Public profile section updates",
                      items: {
                        type: "object",
                        properties: {
                          section: { type: "string", description: "Bundle section path (e.g. profile/about.md, profile/projects.md, projects/my-app/README.md, directives/agent.md)" },
                          content: { type: "string", description: "Full markdown content for this section (include YAML frontmatter: --- title: '...' ---)" },
                        },
                        required: ["section", "content"],
                      },
                    },
                    private_updates: {
                      type: "array",
                      description: "Private section updates — not shown on public profile",
                      items: {
                        type: "object",
                        properties: {
                          section: { type: "string" },
                          content: { type: "string" },
                        },
                        required: ["section", "content"],
                      },
                    },
                    custom_sections: {
                      type: "array",
                      description: "Custom sections to create or update (speaking engagements, investment thesis, reading list, etc.)",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string", description: "Slug (lowercase, hyphens)" },
                          title: { type: "string" },
                          content: { type: "string", description: "Full markdown content" },
                        },
                        required: ["id", "title", "content"],
                      },
                    },
                    avatar_url: {
                      type: "string",
                      description: "Optional public image URL to set as the user's current portrait/avatar.",
                    },
                    avatar_source: {
                      type: "string",
                      description: "Optional source label for the portrait/avatar URL (x, github, linkedin, website, custom).",
                    },
                  },
                },
              },
              {
                name: "save_memory",
                description: "Save important facts, preferences, or context about the user for future sessions. Call this when you learn something worth remembering long-term.",
                input_schema: {
                  type: "object",
                  properties: {
                    memories: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          key: { type: "string", description: "Short descriptive key" },
                          value: { type: "string", description: "The fact or preference to remember" },
                          category: { type: "string", enum: [...AGENT_WRITABLE_MEMORY_CATEGORIES] },
                        },
                        required: ["key", "value", "category"],
                      },
                    },
                  },
                  required: ["memories"],
                },
              },
              {
                name: "fetch_website",
                description: "Fetch and scrape a website URL to get its content. Use this when the user asks you to fetch, scrape, or read a website for project context, company info, or profile enrichment. The platform will perform the actual scrape and inject results into the conversation.",
                input_schema: {
                  type: "object",
                  properties: {
                    urls: {
                      type: "array",
                      description: "List of URLs to scrape",
                      items: { type: "string", description: "Full URL including https://" },
                    },
                    purpose: {
                      type: "string",
                      description: "Why you're fetching these URLs (e.g., 'project context for hubify', 'company website', 'portfolio')",
                    },
                  },
                  required: ["urls"],
                },
              },
            ],
            tool_choice: { type: "auto" },
          }),
          signal: AbortSignal.timeout(240_000),
        });

        if (upstreamRes.ok && upstreamRes.body) {
          return sseResponse(transformAnthropicStream(upstreamRes.body));
        }
        // Anthropic failed — fall through to OpenRouter
        await upstreamRes.text();
      } catch {
        // Fall through to OpenRouter
      }
    }

    // Fallback: OpenRouter streaming
    if (openrouterKey) {
      try {
        const upstreamRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openrouterKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "anthropic/claude-sonnet-4-6",
            messages: [systemMessage, ...conversationMessages],
            temperature: 0.4,
            stream: true,
          }),
          signal: AbortSignal.timeout(240_000),
        });

        if (upstreamRes.ok && upstreamRes.body) {
          return sseResponse(transformStream(upstreamRes.body, (parsed) => {
            return parsed.choices?.[0]?.delta?.content || null;
          }));
        }
      } catch (err) {
        return serverErrorResponse("chat/stream", err, "Stream failed");
      }
    }

    return errorResponse("server_error", "No API key or all providers failed", 500);
  }),
});

// OPTIONS for /api/v1/chat/stream is registered below with other CORS preflight routes

// POST /api/v1/chat/compact — Claude Code-style context compaction
// Cycle 46: requires API-key auth (Bearer token), and the action requires
// the matching clerkId. Per-user rate limit applied.
http.route({
  path: "/api/v1/chat/compact",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    // Compaction processes the owner's chat history → private-read tier
    const denied = await requireScope(ctx, request, auth, "read:private");
    if (denied) return denied;

    try {
      const body = await request.json();
      const { sessionId, messages, keepRecent } = body;

      if (!sessionId || !messages || !Array.isArray(messages)) {
        return errorResponse("invalid_request", "sessionId and messages[] required", 400);
      }

      // Cycle 46: payload cap
      const chars = totalMessageChars(messages);
      if (chars > CHAT_MAX_PAYLOAD_CHARS * 4) {
        return errorResponse("payload_too_large", `payload too large`, 413);
      }

      // Cycle 46: per-user rate limit (more generous than anonymous endpoints)
      try {
        await ctx.runMutation(internal.lib.rateLimit.checkAndRecord, {
          bucket: `compact:${auth.userId}`,
          windowMs: 60_000,
          maxCalls: 60,
        });
      } catch (err) {
        return errorResponse("rate_limited", err instanceof Error ? err.message : "rate limit exceeded", 429);
      }

      // Cycle 48: daily spend cap (compact is cheap so it counts less)
      try {
        await ctx.runMutation(internal.lib.spendCap.checkAndRecord, {
          endpoint: "compact",
        });
      } catch (err) {
        return errorResponse("upstream_unavailable", err instanceof Error ? err.message : "service temporarily unavailable", 503);
      }

      const result = await ctx.runAction(api.chat.compactSession, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        sessionId,
        messages,
        keepRecent: keepRecent ?? 8,
      });

      return json(result);
    } catch (err) {
      return serverErrorResponse("chat/compact", err, "compaction failed");
    }
  }),
});

http.route({ path: "/api/v1/chat/compact", method: "OPTIONS", handler: httpAction(async () => {
  return new Response(null, { status: 204, headers: { ...CORS_HEADERS } });
}) });

// ============================================================
// PROFILE SCRAPING
// ============================================================

// POST /api/v1/scrape — Scrape a social profile by URL
// Cycle 54: per-IP rate limit + daily spend cap added (paid Apify actors).
// Underlying scrape.scrapeProfile is now internalAction, no longer reachable
// via /api/action.
http.route({
  path: "/api/v1/scrape",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();

      // Cycle 54: per-IP rate limit
      try {
        await ctx.runMutation(internal.lib.rateLimit.checkAndRecord, {
          bucket: `scrape:${getCallerIp(request)}`,
          windowMs: 60_000,
          maxCalls: 10,
        });
      } catch (err) {
        return errorResponse("rate_limited", err instanceof Error ? err.message : "rate limit exceeded", 429, { success: false });
      }

      // Cycle 54: daily spend cap
      try {
        await ctx.runMutation(internal.lib.spendCap.checkAndRecord, {
          endpoint: "scrape",
        });
      } catch (err) {
        return errorResponse("upstream_unavailable", err instanceof Error ? err.message : "service temporarily unavailable", 503, { success: false });
      }

      const result = await ctx.runAction(internal.scrape.scrapeProfile, {
        url: body.url,
        username: body.username,
        platform: body.platform,
      });
      if (!result || !result.success) {
        return errorResponse("invalid_request", (result as { error?: string } | null)?.error || "Scrape returned no data", 400, { success: false });
      }
      return json(result);
    } catch (err) {
      return serverErrorResponse("scrape", err, "Scrape failed", { success: false });
    }
  }),
});

// ============================================================
// AI RESEARCH & ENRICHMENT
// ============================================================

// POST /api/v1/research — Auto-research a user via Perplexity
// Cycle 46: per-IP rate limit added (paid Perplexity API).
http.route({
  path: "/api/v1/research",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();

      try {
        await ctx.runMutation(internal.lib.rateLimit.checkAndRecord, {
          bucket: `research:${getCallerIp(request)}`,
          windowMs: 60_000,
          maxCalls: 10,
        });
      } catch (err) {
        return errorResponse("rate_limited", err instanceof Error ? err.message : "rate limit exceeded", 429, { success: false });
      }

      // Cycle 48: daily spend cap
      try {
        await ctx.runMutation(internal.lib.spendCap.checkAndRecord, {
          endpoint: "research",
        });
      } catch (err) {
        return errorResponse("upstream_unavailable", err instanceof Error ? err.message : "service temporarily unavailable", 503, { success: false });
      }

      const result = await ctx.runAction(internal.chat.researchUser, {
        name: body.name,
        username: body.username,
        email: body.email,
        links: body.links,
      });
      return json(result);
    } catch (err) {
      return serverErrorResponse("research", err, "Research failed", { success: false });
    }
  }),
});

// POST /api/v1/verify-identity — Cross-reference scraped profiles via Perplexity Sonar Pro
// Cycle 46: per-IP rate limit added (paid Perplexity Sonar Pro API).
http.route({
  path: "/api/v1/verify-identity",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();

      try {
        await ctx.runMutation(internal.lib.rateLimit.checkAndRecord, {
          bucket: `verify:${getCallerIp(request)}`,
          windowMs: 60_000,
          maxCalls: 10,
        });
      } catch (err) {
        return errorResponse("rate_limited", err instanceof Error ? err.message : "rate limit exceeded", 429, { success: false });
      }

      try {
        await ctx.runMutation(internal.lib.spendCap.checkAndRecord, {
          endpoint: "verify",
        });
      } catch (err) {
        return errorResponse("upstream_unavailable", err instanceof Error ? err.message : "service temporarily unavailable", 503, { success: false });
      }

      const result = await ctx.runAction(internal.chat.verifyIdentity, {
        name: body.name,
        username: body.username,
        scrapedSources: body.scrapedSources || [],
      });
      return json(result);
    } catch (err) {
      return serverErrorResponse("verify", err, "Verification failed", { success: false });
    }
  }),
});

// POST /api/v1/enrich-x — Enrich X profile via XAI/Grok
// Cycle 46: per-IP rate limit added (paid xAI/Grok API).
http.route({
  path: "/api/v1/enrich-x",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();

      try {
        await ctx.runMutation(internal.lib.rateLimit.checkAndRecord, {
          bucket: `enrich:${getCallerIp(request)}`,
          windowMs: 60_000,
          maxCalls: 10,
        });
      } catch (err) {
        return errorResponse("rate_limited", err instanceof Error ? err.message : "rate limit exceeded", 429, { success: false });
      }

      try {
        await ctx.runMutation(internal.lib.spendCap.checkAndRecord, {
          endpoint: "enrich",
        });
      } catch (err) {
        return errorResponse("upstream_unavailable", err instanceof Error ? err.message : "service temporarily unavailable", 503, { success: false });
      }

      const result = await ctx.runAction(internal.chat.enrichXProfile, {
        xUsername: body.xUsername,
        profileData: body.profileData,
      });
      return json(result);
    } catch (err) {
      return serverErrorResponse("enrich-x", err, "Enrichment failed", { success: false });
    }
  }),
});

// ============================================================
// LINKEDIN ENRICHMENT
// ============================================================

// POST /api/v1/enrich-linkedin — Full LinkedIn enrichment pipeline
// Cycle 54: per-IP rate limit + daily spend cap added (the most expensive
// public endpoint — runs TWO Apify actors per call with 120s timeouts).
http.route({
  path: "/api/v1/enrich-linkedin",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const linkedinUrl = body.linkedinUrl;

      if (!linkedinUrl || typeof linkedinUrl !== "string") {
        return errorResponse("invalid_request", "linkedinUrl is required", 400, { success: false });
      }

      // Validate it looks like a LinkedIn URL
      if (!linkedinUrl.includes("linkedin.com/in/")) {
        return errorResponse(
          "invalid_request",
          "Invalid LinkedIn URL. Expected format: https://linkedin.com/in/username",
          400,
          { success: false }
        );
      }

      // Cycle 54: per-IP rate limit (5/min — more restrictive than scrape because runs are 2x)
      try {
        await ctx.runMutation(internal.lib.rateLimit.checkAndRecord, {
          bucket: `linkedin:${getCallerIp(request)}`,
          windowMs: 60_000,
          maxCalls: 5,
        });
      } catch (err) {
        return errorResponse("rate_limited", err instanceof Error ? err.message : "rate limit exceeded", 429, { success: false });
      }

      // Cycle 54: daily spend cap (counts $0.10 per call since it runs 2 actors)
      try {
        await ctx.runMutation(internal.lib.spendCap.checkAndRecord, {
          endpoint: "linkedin",
        });
      } catch (err) {
        return errorResponse("upstream_unavailable", err instanceof Error ? err.message : "service temporarily unavailable", 503, { success: false });
      }

      // Normalize LinkedIn URL to ensure consistent format for Apify
      const slugMatch = linkedinUrl.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/);
      const normalizedUrl = slugMatch
        ? `https://www.linkedin.com/in/${slugMatch[1]}/`
        : linkedinUrl;

      // console.log(`LinkedIn enrichment: normalizing ${linkedinUrl} -> ${normalizedUrl}`);

      // If userId provided, look up user; otherwise run without pipeline storage
      const userId = body.userId;

      // Create a temporary source record if we have a userId
      if (userId) {
        await ctx.runMutation(api.me.addSource, {
          clerkId: userId,
          sourceType: "linkedin_full",
          sourceUrl: linkedinUrl,
        });
      }

      // Fetch LinkedIn profile + posts via Apify
      const apiKey = process.env.APIFY_API_KEY;
      if (!apiKey) {
        return errorResponse("not_configured", "APIFY_API_KEY not configured", 500, { success: false });
      }

      const profileActorId = "VhxlqQXRwhW8H5hNV";
      const postsActorId = "Wpp1BZ6yGWjySadk3";

      // Run both actors in parallel with normalized URL
      // Match the exact input format from the working BAMF implementation
      const slug = normalizedUrl.match(/\/in\/([^/]+)/)?.[1] || "";
      const profileInput = {
        profileUrls: [normalizedUrl],
        profileUrl: normalizedUrl,
        urls: [normalizedUrl],
        username: slug,
        ignoreCache: true,
        forceFresh: true,
      };
      // console.log(`LinkedIn enrichment: sending to Apify actor ${profileActorId} with URL: ${normalizedUrl}, slug: ${slug}`);
      const [profileRes, postsRes] = await Promise.all([
        fetch(
          `https://api.apify.com/v2/acts/${profileActorId}/run-sync-get-dataset-items?token=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(profileInput),
            signal: AbortSignal.timeout(120_000),
          }
        ),
        fetch(
          `https://api.apify.com/v2/acts/${postsActorId}/run-sync-get-dataset-items?token=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              profileUrl: normalizedUrl,
              maxPosts: 20,
              rawData: true,
            }),
            signal: AbortSignal.timeout(120_000),
          }
        ),
      ]);

      if (!profileRes.ok) {
        const err = await profileRes.text();
        return errorResponse(
          "upstream_unavailable",
          `Profile fetch failed: ${err.slice(0, 300)}`,
          502,
          { success: false }
        );
      }

      const profileData = await profileRes.json();
      const rawProfile = Array.isArray(profileData) ? profileData[0] ?? null : profileData;

      if (rawProfile) {
        // console.log(`LinkedIn enrichment: got profile for ${rawProfile.fullName || rawProfile.firstName || "unknown"}, headline: ${rawProfile.headline || rawProfile.title || "none"}`);
      } else {
        // console.log("LinkedIn enrichment: no profile data returned from Apify");
      }

      // Normalize profile data — handle both flat and nested (basic_info) formats
      const bi = rawProfile?.basic_info || {};
      const profile = rawProfile ? {
        ...rawProfile,
        // Flatten basic_info fields to top level for consistent access
        fullName: rawProfile.fullName || bi.fullname || bi.full_name || (rawProfile.firstName && rawProfile.lastName ? `${rawProfile.firstName} ${rawProfile.lastName}`.trim() : (bi.first_name && bi.last_name ? `${bi.first_name} ${bi.last_name}`.trim() : null)),
        headline: rawProfile.headline || rawProfile.title || bi.headline || null,
        about: rawProfile.about || rawProfile.summary || bi.about || null,
        location: rawProfile.location || (typeof bi.location === 'object' ? bi.location?.full : bi.location) || rawProfile.geoLocation || null,
        profileImageUrl: rawProfile.profilePicture || rawProfile.profileImageUrl || rawProfile.imgUrl || bi.profile_picture_url || rawProfile.profilePic || rawProfile.avatar || null,
        connections: rawProfile.connections || rawProfile.connectionsCount || bi.connection_count || null,
        followers: rawProfile.followersCount || rawProfile.followers || bi.follower_count || null,
        publicIdentifier: rawProfile.publicIdentifier || bi.public_identifier || null,
      } : null;

      if (rawProfile && profile) {
        // console.log(`LinkedIn enrichment: normalized — name: ${profile.fullName}, headline: ${(profile.headline || "none").slice(0, 60)}, public_id: ${profile.publicIdentifier}`);
      }

      let posts: unknown[] = [];
      if (postsRes.ok) {
        const postsData = await postsRes.json();
        posts = Array.isArray(postsData) ? postsData : [];
      } else {
        // Posts fetch is non-fatal
        // console.log("Posts fetch failed, continuing with profile only");
        await postsRes.text(); // consume body
      }

      const combined = { profile, posts, fetchedAt: new Date().toISOString() };

      // If we have a userId, run voice analysis
      let voiceAnalysis = null;
      if (userId) {
        try {
          // Look up internal user ID from clerk ID
          const user = await ctx.runMutation(internal.pipeline.mutations.getUserByClerkId, {
            clerkId: userId,
          });
          if (user) {
            const result = await ctx.runAction(
              internal.pipeline.linkedin.analyzeLinkedInVoice,
              {
                userId: user._id,
                linkedinData: combined,
              }
            );
            voiceAnalysis = result.content;

            // Generate the markdown doc
            await ctx.runAction(
              internal.pipeline.linkedin.generateLinkedInVoiceDoc,
              { userId: user._id }
            );
          }
        } catch {
          // console.log("Voice analysis failed:", e);
          // Non-fatal — still return the profile/posts data
        }
      }

      return json({
        success: true,
        profile,
        posts,
        voiceAnalysis,
      });
    } catch (err) {
      return serverErrorResponse("enrich-linkedin", err, "LinkedIn enrichment failed", { success: false });
    }
  }),
});

// ============================================================
// CONTEXT LINK MANAGEMENT (authenticated)
// ============================================================

// POST /api/v1/me/context-links — Create a context link
http.route({
  path: "/api/v1/me/context-links",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    // Context links delegate read access (incl. private scope) — a key must
    // itself be able to read private context before it can mint such links.
    const denied = await requireScope(ctx, request, auth, "read:private");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    try {
      const body = await request.json();
      const result = await ctx.runMutation(api.contextLinks.createLink, {
        clerkId: auth.userId,        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        scope: body.scope || "public",
        ttl: body.ttl || "7d",
        maxUses: body.maxUses,
        name: body.name,
      });
      return guard.finish(json(result));
    } catch (err) {
      return serverErrorResponse("me/context-links", err, "Failed to create context link");
    }
  }),
});

// GET /api/v1/me/context-links — List context links (supports ?cursor= + ?limit= pagination; paginated calls return { links, nextCursor, hasMore })
http.route({
  path: "/api/v1/me/context-links",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "read:private");
    if (denied) return denied;

    const { cursor, limit, paginated } = parseListPagination(new URL(request.url));
    if (paginated) {
      try {
        const result = await ctx.runQuery(api.contextLinks.listLinksPage, {
          clerkId: auth.userId,
          _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
          cursor,
          numItems: limit ?? 50,
        });
        return json({ links: result.page, ...pageMeta(result) });
      } catch {
        return errorResponse("invalid_request", "Invalid pagination cursor", 400);
      }
    }

    const links = await ctx.runQuery(api.contextLinks.listLinks, {
      clerkId: auth.userId,      _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
    });
    return json(links);
  }),
});

// DELETE /api/v1/me/context-links — Revoke a context link
http.route({
  path: "/api/v1/me/context-links",
  method: "DELETE",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "read:private");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    try {
      const body = await request.json();
      if (!body.linkId) {
        return errorResponse("invalid_request", "linkId is required", 400);
      }
      await ctx.runMutation(api.contextLinks.revokeLink, {
        clerkId: auth.userId,        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        linkId: body.linkId,
      });
      return guard.finish(json({ success: true }));
    } catch (err) {
      return serverErrorResponse("me/context-links/revoke", err, "Failed to revoke link");
    }
  }),
});

// ============================================================
// API KEY MANAGEMENT (authenticated)
// ============================================================

// POST /api/v1/me/api-keys — Create an API key
http.route({
  path: "/api/v1/me/api-keys",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    try {
      const body = await request.json();

      // Cycle 57: validate requested scopes against the known vocabulary and
      // block privilege escalation — a scoped key can only mint keys whose
      // scopes are a subset of its own. Legacy grandfathered keys (scopes ===
      // null) keep full minting ability, matching their full-access status.
      // Default when no scopes are requested stays least-privilege
      // ["read:public"]; owner login session keys get full scopes via
      // convex/auth.ts, and the settings UI defaults to all-but-vault (P36).
      const requestedScopes: string[] =
        Array.isArray(body.scopes) && body.scopes.length > 0
          ? body.scopes
          : ["read:public"];

      const unknown = requestedScopes.filter(
        (s) => typeof s !== "string" || !isKnownScope(s)
      );
      if (unknown.length > 0) {
        return errorResponse(
          "invalid_scope",
          `Unknown scope(s): ${unknown.join(", ")}`,
          400
        );
      }

      if (auth.scopes !== null) {
        const escalated = requestedScopes.find((s) => !auth.scopes!.includes(s));
        if (escalated) {
          return errorResponse(
            "scope_missing",
            `API key lacks required scope: ${escalated}`,
            403
          );
        }
      }

      // Forward optional expiry. `null` or `0` mints a never-expiring key (used
      // for permanent machine-sync keys so sync never silently breaks).
      const expiresInDays =
        body.expiresInDays === null || typeof body.expiresInDays === "number" ? body.expiresInDays : undefined;

      const result = await ctx.runMutation(api.apiKeys.createKey, {
        clerkId: auth.userId,        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        label: body.label,
        scopes: requestedScopes,
        expiresInDays,
      });
      return guard.finish(json(result));
    } catch (err) {
      return serverErrorResponse("me/keys", err, "Failed to create API key");
    }
  }),
});

// GET /api/v1/me/api-keys — List API keys (supports ?cursor= + ?limit= pagination; paginated calls return { keys, nextCursor, hasMore })
http.route({
  path: "/api/v1/me/api-keys",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    // Key metadata is account-management surface → private-read tier
    const denied = await requireScope(ctx, request, auth, "read:private");
    if (denied) return denied;

    const { cursor, limit, paginated } = parseListPagination(new URL(request.url));
    if (paginated) {
      try {
        const result = await ctx.runQuery(api.apiKeys.listKeysPage, {
          clerkId: auth.userId,
          _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
          cursor,
          numItems: limit ?? 50,
        });
        return json({ keys: result.page, ...pageMeta(result) });
      } catch {
        return errorResponse("invalid_request", "Invalid pagination cursor", 400);
      }
    }

    const keys = await ctx.runQuery(api.apiKeys.listKeys, {
      clerkId: auth.userId,      _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
    });
    return json(keys);
  }),
});

// DELETE /api/v1/me/api-keys — Revoke an API key
http.route({
  path: "/api/v1/me/api-keys",
  method: "DELETE",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    // Revoking keys can lock out the owner's other agents — gate it on the
    // private tier rather than letting any read:public key do it.
    const denied = await requireScope(ctx, request, auth, "read:private");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    try {
      const body = await request.json();
      if (!body.keyId) {
        return errorResponse("invalid_request", "keyId is required", 400);
      }
      await ctx.runMutation(api.apiKeys.revokeKey, {
        clerkId: auth.userId,        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        keyId: body.keyId,
      });
      return guard.finish(json({ success: true }));
    } catch (err) {
      return serverErrorResponse("me/keys/revoke", err, "Failed to revoke API key");
    }
  }),
});

// ============================================================
// MAINTAINER PROPOSALS + BRAIN CONSENT (L26)
// ============================================================

// GET /api/v1/me/maintainer/proposals — list caller's open proposals
http.route({
  path: "/api/v1/me/maintainer/proposals",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "read:private");
    if (denied) return denied;

    try {
      const proposals = await ctx.runQuery(internal.maintainer.listMyProposals, {
        userId: auth.userDbId,
      });
      return json({ proposals });
    } catch (err) {
      return serverErrorResponse("me/maintainer/proposals/list", err, "Failed to list proposals");
    }
  }),
});

// POST /api/v1/me/maintainer/proposals/decision — approve or reject a proposal
http.route({
  path: "/api/v1/me/maintainer/proposals/decision",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "write:bundle");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    try {
      const body = await request.json() as { proposalId?: unknown; decision?: unknown };
      const { proposalId, decision } = body;
      if (decision !== "approved" && decision !== "rejected") {
        return errorResponse("invalid_request", 'decision must be "approved" or "rejected"', 400);
      }

      const result = await ctx.runMutation(internal.maintainer.setProposalApproval, {
        userId: auth.userDbId,
        proposalId: proposalId as Id<"maintainerProposals">,
        decision,
      });
      return guard.finish(json(result));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("not_found")) {
        return errorResponse("not_found", "Proposal not found", 404);
      }
      return serverErrorResponse("me/maintainer/proposals/decision", err, "Failed to set proposal decision");
    }
  }),
});

// GET /api/v1/me/brain-consent — list all brainScope consent rows
http.route({
  path: "/api/v1/me/brain-consent",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "read:private");
    if (denied) return denied;

    try {
      const consents = await ctx.runQuery(internal.consent.listMyConsents, {
        userId: auth.userDbId,
      });
      return json({ consents });
    } catch (err) {
      return serverErrorResponse("me/brain-consent/list", err, "Failed to list brain consent");
    }
  }),
});

// POST /api/v1/me/brain-consent — grant or revoke a brainScope
http.route({
  path: "/api/v1/me/brain-consent",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "write:bundle");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    try {
      const body = await request.json() as { scope?: unknown; granted?: unknown };
      const { scope, granted } = body;
      if (typeof scope !== "string" || !isKnownBrainScope(scope)) {
        return errorResponse("invalid_request", `scope must be one of: ${["consolidate","fleet_aggregate","journal_mine"].join(", ")}`, 400);
      }
      if (typeof granted !== "boolean") {
        return errorResponse("invalid_request", "granted must be a boolean", 400);
      }

      await ctx.runMutation(internal.consent.setConsent, {
        userId: auth.userDbId,
        scope,
        granted,
      });
      return guard.finish(json({ scope, granted }));
    } catch (err) {
      return serverErrorResponse("me/brain-consent/set", err, "Failed to update brain consent");
    }
  }),
});

// ============================================================
// OUTBOUND WEBHOOKS (P24)
// ============================================================

// POST /api/v1/me/webhooks — Create a webhook subscription
// Returns { id, signingSecret } — signingSecret is shown ONCE, never again.
http.route({
  path: "/api/v1/me/webhooks",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "write:bundle");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    try {
      const body = await request.json();
      const { url, events } = body as { url?: unknown; events?: unknown };
      if (typeof url !== "string" || !url.startsWith("https://")) {
        return errorResponse("invalid_request", "url must be an https:// string", 400);
      }
      if (!Array.isArray(events) || events.length === 0 || events.some((e) => typeof e !== "string")) {
        return errorResponse("invalid_request", "events must be a non-empty string array", 400);
      }

      const user = await ctx.runQuery(api.users.getByClerkId, {
        clerkId: auth.userId, _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
      });
      if (!user) return errorResponse("not_found", "user not found", 404);

      const result = await ctx.runMutation(internal.webhooks.createSubscription, {
        userId: user._id,
        url,
        events,
      });

      return guard.finish(json({ id: result.id, signingSecret: result.signingSecret }, 201));
    } catch (err) {
      return serverErrorResponse("me/webhooks/create", err, "Failed to create webhook subscription");
    }
  }),
});

// GET /api/v1/me/webhooks — List webhook subscriptions (without secret)
http.route({
  path: "/api/v1/me/webhooks",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "write:bundle");
    if (denied) return denied;

    try {
      const user = await ctx.runQuery(api.users.getByClerkId, {
        clerkId: auth.userId, _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
      });
      if (!user) return errorResponse("not_found", "user not found", 404);

      const subs = await ctx.runQuery(internal.webhooks.listSubscriptions, {
        userId: user._id,
      });

      return json({ webhooks: subs });
    } catch (err) {
      return serverErrorResponse("me/webhooks/list", err, "Failed to list webhook subscriptions");
    }
  }),
});

// DELETE /api/v1/me/webhooks — Revoke a webhook subscription
http.route({
  path: "/api/v1/me/webhooks",
  method: "DELETE",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "write:bundle");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    try {
      const body = await request.json();
      if (!body.id) {
        return errorResponse("invalid_request", "id is required", 400);
      }

      const user = await ctx.runQuery(api.users.getByClerkId, {
        clerkId: auth.userId, _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
      });
      if (!user) return errorResponse("not_found", "user not found", 404);

      await ctx.runMutation(internal.webhooks.revokeSubscription, {
        userId: user._id,
        subscriptionId: body.id,
      });

      return guard.finish(json({ deleted: true }));
    } catch (err) {
      return serverErrorResponse("me/webhooks/revoke", err, "Failed to revoke webhook subscription");
    }
  }),
});

// ============================================================
// DEVICE-FLOW AUTH (U7, RFC 8628-shaped, simplified)
// ============================================================
//
// `youmd login` default path: the CLI starts a device authorization, shows
// the short userCode + https://you.md/device, and polls until the user
// approves in a signed-in browser session. The underlying state machine
// lives in convex/auth.ts (startDeviceAuth / pollDeviceAuth — both
// internalMutations so these rate-limited routes are the ONLY public
// surface; anonymous /api/mutation callers cannot mint or poll codes).

const DEVICE_START_RATE_LIMIT = { windowMs: 10 * 60_000, maxCalls: 10 };
// Compliant polling is every 5s (12/min). 60/min leaves headroom for several
// devices behind one NAT while still capping brute-force hammering.
const DEVICE_POLL_RATE_LIMIT = { windowMs: 60_000, maxCalls: 60 };
const DEVICE_VERIFICATION_URL = "https://you.md/device";

// POST /api/v1/auth/device/start — begin a device-flow login (no auth)
http.route({
  path: "/api/v1/auth/device/start",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      await ctx.runMutation(internal.lib.rateLimit.checkAndRecord, {
        bucket: `deviceStart:${getCallerIp(request)}`,
        windowMs: DEVICE_START_RATE_LIMIT.windowMs,
        maxCalls: DEVICE_START_RATE_LIMIT.maxCalls,
      });
    } catch {
      return errorResponse(
        "rate_limited",
        "Too many device authorization requests. Try again in a few minutes.",
        429
      );
    }

    // Body is optional: { clientName?: string } for the approval page.
    let clientName: string | undefined;
    try {
      const body = await request.json();
      if (body && typeof body.clientName === "string" && body.clientName.trim()) {
        clientName = body.clientName.trim().slice(0, 120);
      }
    } catch {
      // empty / non-JSON body is fine
    }

    const started = await ctx.runMutation(internal.auth.startDeviceAuth, {
      clientName,
    });

    return json({
      deviceCode: started.deviceCode,
      userCode: started.userCode,
      verificationUrl: DEVICE_VERIFICATION_URL,
      expiresIn: started.expiresIn,
      interval: started.interval,
    });
  }),
});

// POST /api/v1/auth/device/poll — poll for approval with the deviceCode
http.route({
  path: "/api/v1/auth/device/poll",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      await ctx.runMutation(internal.lib.rateLimit.checkAndRecord, {
        bucket: `devicePoll:${getCallerIp(request)}`,
        windowMs: DEVICE_POLL_RATE_LIMIT.windowMs,
        maxCalls: DEVICE_POLL_RATE_LIMIT.maxCalls,
      });
    } catch {
      return errorResponse(
        "rate_limited",
        "Polling too fast. Slow down and try again shortly.",
        429,
        { status: "slow_down" }
      );
    }

    let deviceCode: string | undefined;
    try {
      const body = await request.json();
      if (body && typeof body.deviceCode === "string") {
        deviceCode = body.deviceCode;
      }
    } catch {
      // handled below
    }
    if (!deviceCode) {
      return errorResponse("invalid_request", "deviceCode is required", 400);
    }

    // Hash here so the plaintext secret never enters mutation args/logs.
    const result = await ctx.runMutation(internal.auth.pollDeviceAuth, {
      deviceCodeHash: await sha256Hex(deviceCode),
    });

    switch (result.status) {
      case "approved":
        // The owner-session key is returned exactly once (row now consumed).
        return json({
          status: "approved",
          apiKey: result.apiKey,
          username: result.username,
          user: {
            id: result.clerkId,
            username: result.username,
            email: result.email,
            displayName: result.displayName,
            plan: result.plan,
          },
        });
      case "pending":
      case "slow_down":
        return json({ status: result.status, interval: result.interval });
      case "denied":
        return errorResponse(
          "forbidden",
          "Authorization was denied in the browser.",
          403,
          { status: "denied" }
        );
      case "expired":
        return errorResponse(
          "gone",
          "Device code expired. Run `youmd login` again for a fresh code.",
          410,
          { status: "expired" }
        );
      default:
        return errorResponse(
          "invalid_request",
          "Invalid or already-used device code.",
          400,
          { status: "invalid" }
        );
    }
  }),
});

http.route({ path: "/api/v1/auth/device/start", method: "OPTIONS", handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })) });
http.route({ path: "/api/v1/auth/device/poll", method: "OPTIONS", handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })) });

// ============================================================
// LEGACY AUTH ROUTES (deprecated after first-party passwordless migration)
// ============================================================

// These endpoints previously implemented email/password auth for older CLI
// builds. The current CLI uses the web app's first-party passwordless flow
// instead:
//   - POST /api/auth/send-verification
//   - POST /api/auth/verify-code
//
// Keep the legacy paths as explicit 410 responses so stale clients get a clear
// migration message instead of silently hitting removed infrastructure.
//
// P31 (PRODUCT-AUDIT #39): the 410s also emit the standard `Deprecation:
// true` + `Sunset: <http-date>` headers so HTTP-aware agents/tooling can
// detect retirement mechanically. The Sunset date is in the past — these
// routes are already retired; the header records when.

const LEGACY_AUTH_DEPRECATION_HEADERS = {
  Deprecation: "true",
  // First-party passwordless auth replaced these routes; already sunset.
  Sunset: "Thu, 01 Jan 2026 00:00:00 GMT",
};

http.route({
  path: "/api/v1/auth/register",
  method: "POST",
  handler: httpAction(async () => {
    return errorResponse(
      "gone",
      "Password registration has been removed. Use /api/auth/send-verification or run `youmd register` from the latest CLI.",
      410,
      undefined,
      LEGACY_AUTH_DEPRECATION_HEADERS
    );
  }),
});

http.route({
  path: "/api/v1/auth/login",
  method: "POST",
  handler: httpAction(async () => {
    return errorResponse(
      "gone",
      "Password login has been removed. Use /api/auth/send-verification and /api/auth/verify-code, or run `youmd login` from the latest CLI.",
      410,
      undefined,
      LEGACY_AUTH_DEPRECATION_HEADERS
    );
  }),
});

http.route({
  path: "/api/v1/webhooks/clerk",
  method: "POST",
  handler: httpAction(async () => {
    return errorResponse(
      "gone",
      "The Clerk webhook endpoint has been retired. You.md now uses first-party passwordless auth and no longer accepts Clerk lifecycle events.",
      410,
      undefined,
      LEGACY_AUTH_DEPRECATION_HEADERS
    );
  }),
});

// ============================================================
// CORS PREFLIGHT (catch-all for OPTIONS)
// ============================================================

const corsPreflight = httpAction(async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
});

http.route({ path: "/api/v1/auth/register", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/auth/login", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/profiles", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/check-username", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/ctx", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/bundle", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/publish", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/portfolio/graph", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/portfolio/projects/hydrate", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/portfolio/tasks", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/portfolio/tasks/triage", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/portfolio/tasks/update", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/portfolio/brain-dumps", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/synced-brain/graph", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/realtime-sync/session", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/agent-bus/messages", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/remote-commands", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/remote-commands/dispatch", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/remote-commands/status", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/brain-activities", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/secret-vault/devices", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/secret-vault/envelopes", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/secret-vault/env", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/sources", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/analytics", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/build", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/build/status", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/memories", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/context-links", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/api-keys", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/webhooks", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/maintainer/proposals", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/maintainer/proposals/decision", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/brain-consent", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/stack-sources", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/stack-sources/remove", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/chat", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/chat/stream", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/scrape", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/research", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/enrich-x", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/enrich-linkedin", method: "OPTIONS", handler: corsPreflight });

// ============================================================
// PRIVATE CONTEXT API (authenticated)
// ============================================================

// GET /api/v1/me/private — Get private context
http.route({
  path: "/api/v1/me/private",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "read:private");
    if (denied) return denied;

    const user = await ctx.runQuery(api.users.getByClerkId, { clerkId: auth.userId, _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN });
    if (!user) return errorResponse("not_found", "User not found", 404);

    // Find the user's profile
    const profile = await ctx.runQuery(api.profiles.getByOwnerId, { ownerId: user._id });
    if (!profile) return json(null);

    const privateCtx = await ctx.runQuery(api.private.getPrivateContext, {
      clerkId: auth.userId,      _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
      profileId: profile._id,
    });
    return json(privateCtx);
  }),
});

// POST /api/v1/me/private — Update private context
http.route({
  path: "/api/v1/me/private",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    // Private-context writes map to write:bundle (vocabulary has no write:private)
    const denied = await requireScope(ctx, request, auth, "write:bundle");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    const user = await ctx.runQuery(api.users.getByClerkId, { clerkId: auth.userId, _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN });
    if (!user) return errorResponse("not_found", "User not found", 404);

    const profile = await ctx.runQuery(api.profiles.getByOwnerId, { ownerId: user._id });
    if (!profile) return errorResponse("not_found", "Profile not found", 404);

    const body = await request.json();
    await ctx.runMutation(api.private.updatePrivateContext, {
      clerkId: auth.userId,      _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
      profileId: profile._id,
      privateNotes: body.privateNotes,
      privateProjects: body.privateProjects,
      internalLinks: body.internalLinks,
      customData: body.customData,
    });

    // Log activity
    try {
      const agent = detectAgent(request.headers.get("user-agent"));
      const agentSource = authAgentSource(auth, request);
      await ctx.runMutation(internal.activity.logActivity, {
        userId: user._id,
        profileId: profile._id,
        agentName: auth.appName || agent.name,
        agentSource,
        agentVersion: agent.version,
        action: "write",
        resource: "private",
        scope: "full",
        connectedAppGrantId: auth.connectedAppGrantId,
        status: "success",
      });
    } catch {
      // swallow
    }

    return guard.finish(json({ success: true }));
  }),
});

http.route({ path: "/api/v1/me/private", method: "OPTIONS", handler: corsPreflight });

// ============================================================
// MEMORY API (authenticated — API key or access token)
// ============================================================

// GET /api/v1/me/memories — List memories (optional full-text search via ?q=; supports ?cursor= + ?limit= pagination — paginated calls add nextCursor + hasMore, including search via the native search-index paginator)
http.route({
  path: "/api/v1/me/memories",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "read:private");
    if (denied) return denied;

    const url = new URL(request.url);
    const category = url.searchParams.get("category") || undefined;
    const q = url.searchParams.get("q")?.trim() || undefined;
    // P14: superseded memories are hidden by default; ?includeSuperseded=true
    // opts list calls into seeing them (search always excludes superseded).
    const includeSuperseded =
      url.searchParams.get("includeSuperseded") === "true" ? true : undefined;
    const cursor = url.searchParams.get("cursor");
    const limitRaw = url.searchParams.has("limit") ? parseInt(url.searchParams.get("limit")!, 10) : undefined;
    const limit = limitRaw !== undefined && Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : undefined;

    const user = await ctx.runQuery(api.users.getByClerkId, { clerkId: auth.userId, _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN });
    if (!user) return errorResponse("not_found", "User not found", 404);

    // P13: ?cursor= or ?limit= opts into cursor pagination. Search (?q=)
    // paginates too — Convex search-index queries support .paginate natively.
    if (cursor !== null || limit !== undefined) {
      try {
        const result = q
          ? await ctx.runQuery(api.memories.searchMemoriesPage, {
              clerkId: auth.userId,
              _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
              userId: user._id,
              searchText: q,
              cursor,
              numItems: limit !== undefined ? Math.min(limit, 100) : 20,
            })
          : await ctx.runQuery(api.memories.listMemoriesPage, {
              clerkId: auth.userId,
              _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
              userId: user._id,
              category,
              includeSuperseded,
              cursor,
              numItems: limit ?? 100,
            });
        return json({ memories: result.page, count: result.page.length, ...pageMeta(result) });
      } catch {
        return errorResponse("invalid_request", "Invalid pagination cursor", 400);
      }
    }

    // Full-text search when ?q= is present (P5: memory search); list otherwise.
    const memories = q
      ? await ctx.runQuery(api.memories.searchMemories, {
          clerkId: auth.userId,
          _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
          userId: user._id,
          searchText: q,
        })
      : await ctx.runQuery(api.memories.listMemories, {
          clerkId: auth.userId,
          _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
          userId: user._id,
          category,
          includeSuperseded,
        });

    return json({ memories, count: memories.length });
  }),
});

// POST /api/v1/me/memories — Save memories
http.route({
  path: "/api/v1/me/memories",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "write:memories");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    const body = await request.json();
    if (!body.memories || !Array.isArray(body.memories) || body.memories.length === 0) {
      return errorResponse("invalid_request", "Request body must contain a non-empty 'memories' array", 400);
    }

    // P15: validate categories up front (invalid_request envelope, never a
    // mutation throw). Known legacy aliases normalize to canonical.
    // P14: pinned/importance pass through (validated additively).
    const sanitized: Array<{
      category: string;
      content: string;
      tags?: string[];
      pinned?: boolean;
      importance?: number;
    }> = [];
    for (let i = 0; i < body.memories.length; i++) {
      const mem = body.memories[i] ?? {};
      const category = resolveMemoryCategory(mem.category);
      if (!category) {
        return errorResponse(
          "invalid_request",
          `memories[${i}]: ${invalidMemoryCategoryMessage(mem.category)}`,
          400
        );
      }
      if (typeof mem.content !== "string" || !mem.content.trim()) {
        return errorResponse("invalid_request", `memories[${i}]: content must be a non-empty string`, 400);
      }
      if (
        mem.importance !== undefined &&
        (!Number.isInteger(mem.importance) || mem.importance < 1 || mem.importance > 5)
      ) {
        return errorResponse("invalid_request", `memories[${i}]: importance must be an integer between 1 and 5`, 400);
      }
      sanitized.push({
        category,
        content: mem.content,
        tags: Array.isArray(mem.tags)
          ? mem.tags.filter((t: unknown): t is string => typeof t === "string")
          : undefined,
        pinned: typeof mem.pinned === "boolean" ? mem.pinned : undefined,
        importance: mem.importance,
      });
    }

    const user = await ctx.runQuery(api.users.getByClerkId, { clerkId: auth.userId, _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN });
    if (!user) return errorResponse("not_found", "User not found", 404);

    const result = await ctx.runMutation(api.memories.saveFromAgent, {
      clerkId: auth.userId,
      _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
      userId: user._id,
      agentName: typeof body.agentName === "string" && body.agentName.trim()
        ? body.agentName.trim()
        : auth.username || "API",
      memories: sanitized,
    });

    // Log activity
    try {
      const agent = detectAgent(request.headers.get("user-agent"));
      const agentSource = authAgentSource(auth, request);
      await ctx.runMutation(internal.activity.logActivity, {
        userId: user._id,
        agentName: typeof body.agentName === "string" && body.agentName.trim()
          ? body.agentName.trim()
          : auth.appName || agent.name,
        agentSource,
        agentVersion: agent.version,
        action: "memory_add",
        resource: "memories",
        status: "success",
        connectedAppGrantId: auth.connectedAppGrantId,
        details: {
          count: Array.isArray(body.memories) ? body.memories.length : 0,
        },
      });
    } catch {
      // swallow
    }

    return guard.finish(json(result));
  }),
});

// PATCH /api/v1/me/memories — Update one memory (P14, additive).
// Body: { memoryId, content?, category?, tags?, pinned?, importance?,
// supersededBy? }. `pinned: true` pins a memory so it never decays out of
// agent briefs; `supersededBy: <newMemoryId>` links old→new (the old row is
// hidden from briefs/search/default lists but stays auditable).
http.route({
  path: "/api/v1/me/memories",
  method: "PATCH",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "write:memories");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    const body = await request.json();
    if (typeof body.memoryId !== "string" || !body.memoryId) {
      return errorResponse("invalid_request", "Request body must contain a 'memoryId' string", 400);
    }

    let category: string | undefined;
    if (body.category !== undefined) {
      const resolved = resolveMemoryCategory(body.category);
      if (!resolved) {
        return errorResponse("invalid_request", invalidMemoryCategoryMessage(body.category), 400);
      }
      category = resolved;
    }
    if (
      body.importance !== undefined &&
      (!Number.isInteger(body.importance) || body.importance < 1 || body.importance > 5)
    ) {
      return errorResponse("invalid_request", "importance must be an integer between 1 and 5", 400);
    }
    if (body.pinned !== undefined && typeof body.pinned !== "boolean") {
      return errorResponse("invalid_request", "pinned must be a boolean", 400);
    }
    const hasUpdate =
      body.content !== undefined ||
      category !== undefined ||
      body.tags !== undefined ||
      body.pinned !== undefined ||
      body.importance !== undefined;
    if (!hasUpdate && body.supersededBy === undefined) {
      return errorResponse(
        "invalid_request",
        "Provide at least one of content, category, tags, pinned, importance, or supersededBy",
        400
      );
    }

    try {
      if (hasUpdate) {
        await ctx.runMutation(api.memories.updateMemory, {
          clerkId: auth.userId,
          _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
          memoryId: body.memoryId as Id<"memories">,
          content: typeof body.content === "string" ? body.content : undefined,
          category,
          tags: Array.isArray(body.tags)
            ? body.tags.filter((t: unknown): t is string => typeof t === "string")
            : undefined,
          pinned: body.pinned,
          importance: body.importance,
        });
      }
      if (body.supersededBy !== undefined) {
        if (typeof body.supersededBy !== "string" || !body.supersededBy) {
          return errorResponse("invalid_request", "supersededBy must be a memory id string", 400);
        }
        await ctx.runMutation(api.memories.supersedeMemory, {
          clerkId: auth.userId,
          _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
          memoryId: body.memoryId as Id<"memories">,
          supersededBy: body.supersededBy as Id<"memories">,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("memory not found")) {
        return errorResponse("not_found", "Memory not found", 404);
      }
      // ConvexError (invalid importance/category/self-supersede) and invalid
      // id strings (ArgumentValidationError) are caller errors.
      return errorResponse("invalid_request", message, 400);
    }

    return guard.finish(json({ success: true }));
  }),
});

// ── Skills Registry ──────────────────────────────────────────

// GET /api/v1/skills — Browse published skills (public, no auth required; supports ?cursor= + ?limit= pagination — paginated calls add nextCursor + hasMore)
http.route({
  path: "/api/v1/skills",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const name = url.searchParams.get("name");

    // If ?name= provided, return single skill with content
    if (name) {
      const skill = await ctx.runQuery(api.skills.getByName, { name });
      if (!skill || !skill.isPublished) {
        return errorResponse("not_found", "Skill not found", 404);
      }
      return json(skill);
    }

    // P13: cursor pagination over the registry (downloads-desc index order)
    const { cursor, limit, paginated } = parseListPagination(url);
    if (paginated) {
      try {
        const result = await ctx.runQuery(api.skills.listPublishedPage, {
          cursor,
          numItems: limit ?? 50,
        });
        return json({ skills: result.page, count: result.page.length, ...pageMeta(result) });
      } catch {
        return errorResponse("invalid_request", "Invalid pagination cursor", 400);
      }
    }

    // Otherwise list all published
    const skills = await ctx.runQuery(api.skills.listPublished, { limit: 50 });
    return json({ skills, count: skills.length });
  }),
});

// CORS preflight for skills endpoints
http.route({
  path: "/api/v1/skills",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })),
});

// GET /api/v1/me/skills — Get my installed skills (authenticated; supports ?cursor= + ?limit= pagination — paginated calls add nextCursor + hasMore)
http.route({
  path: "/api/v1/me/skills",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "read:private");
    if (denied) return denied;

    const user = await ctx.runQuery(api.users.getByClerkId, { clerkId: auth.userId, _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN });
    if (!user) return errorResponse("not_found", "User not found", 404);

    // P13: cursor pagination in installedAt-desc index order
    const { cursor, limit, paginated } = parseListPagination(new URL(request.url));
    if (paginated) {
      try {
        const result = await ctx.runQuery(api.skills.listInstallsPage, {
          clerkId: auth.userId,
          _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
          userId: user._id,
          cursor,
          numItems: limit ?? 50,
        });
        return json({ skills: result.page, count: result.page.length, ...pageMeta(result) });
      } catch {
        return errorResponse("invalid_request", "Invalid pagination cursor", 400);
      }
    }

    const installs = await ctx.runQuery(api.skills.listInstalls, {
      clerkId: auth.userId,
      _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
      userId: user._id,
    });
    return json({ skills: installs, count: installs.length });
  }),
});

// Publish a skill to the registry (authenticated)
http.route({
  path: "/api/v1/me/skills",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "write:bundle");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    let body: {
      name?: unknown;
      content?: unknown;
      description?: unknown;
      version?: unknown;
      scope?: unknown;
      identityFields?: unknown;
    };
    try {
      body = await request.json();
    } catch {
      return errorResponse("invalid_request", "Invalid JSON body", 400);
    }

    try {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return errorResponse("invalid_request", "name is required (string)", 400);
      }
      if (typeof body.content !== "string" || !body.content.trim()) {
        return errorResponse("invalid_request", "content is required (string)", 400);
      }
      if (body.name.length > 100) {
        return errorResponse("invalid_request", "name must be 100 characters or less", 400);
      }
      if (body.content.length > 50000) {
        return errorResponse("invalid_request", "content must be 50KB or less", 400);
      }

      const result = await ctx.runMutation(api.skills.publish, {
        clerkId: auth.userId,        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        name: body.name.trim(),
        description: typeof body.description === "string" ? body.description.slice(0, 500) : "",
        version: typeof body.version === "string" ? body.version.slice(0, 20) : "1.0.0",
        scope: body.scope === "shared" || body.scope === "project" || body.scope === "private" ? body.scope : "shared",
        identityFields: Array.isArray(body.identityFields) ? body.identityFields.filter((f: unknown): f is string => typeof f === "string").slice(0, 20) : [],
        content: body.content,
      });

      return guard.finish(json(result));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to publish skill";
      if (message.includes("already taken")) return errorResponse("conflict", message, 409);
      return serverErrorResponse("me/skills/publish", err, "Failed to publish skill");
    }
  }),
});

// CORS preflight for me/skills
http.route({
  path: "/api/v1/me/skills",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })),
});

// Record a skill install (authenticated)
http.route({
  path: "/api/v1/me/skills/install",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "write:bundle");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    let body: {
      skillName?: unknown;
      source?: unknown;
      scope?: unknown;
      identityFields?: unknown;
    };
    try {
      body = await request.json();
    } catch {
      return errorResponse("invalid_request", "Invalid JSON body", 400);
    }

    try {
      if (typeof body.skillName !== "string" || !body.skillName.trim()) {
        return errorResponse("invalid_request", "skillName is required (string)", 400);
      }

      const result = await ctx.runMutation(api.skills.recordInstall, {
        clerkId: auth.userId,        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        skillName: body.skillName.trim().slice(0, 100),
        source: typeof body.source === "string" ? body.source.slice(0, 200) : "cli",
        scope: typeof body.scope === "string" ? body.scope.slice(0, 20) : "shared",
        identityFields: Array.isArray(body.identityFields) ? body.identityFields.filter((f: unknown): f is string => typeof f === "string").slice(0, 20) : [],
      });

      return guard.finish(json(result));
    } catch (err) {
      return serverErrorResponse("me/skills/install", err, "Failed to record skill install");
    }
  }),
});

http.route({
  path: "/api/v1/me/skills/install",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })),
});

// Track skill usage (authenticated)
http.route({
  path: "/api/v1/me/skills/usage",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "write:bundle");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    let body: { skillName?: unknown };
    try {
      body = await request.json();
    } catch {
      return errorResponse("invalid_request", "Invalid JSON body", 400);
    }

    try {
      if (typeof body.skillName !== "string" || !body.skillName.trim()) {
        return errorResponse("invalid_request", "skillName is required (string)", 400);
      }

      const result = await ctx.runMutation(api.skills.trackUsage, {
        clerkId: auth.userId,        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        skillName: body.skillName.trim(),
      });

      return guard.finish(json(result));
    } catch (err) {
      return serverErrorResponse("me/skills/usage", err, "Failed to track skill usage");
    }
  }),
});

http.route({
  path: "/api/v1/me/skills/usage",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })),
});

// Remove a skill install (authenticated)
http.route({
  path: "/api/v1/me/skills/remove",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "write:bundle");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    let body: { skillName?: unknown };
    try {
      body = await request.json();
    } catch {
      return errorResponse("invalid_request", "Invalid JSON body", 400);
    }

    try {
      if (typeof body.skillName !== "string" || !body.skillName.trim()) {
        return errorResponse("invalid_request", "skillName is required (string)", 400);
      }

      const result = await ctx.runMutation(api.skills.removeInstall, {
        clerkId: auth.userId,        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        skillName: body.skillName.trim(),
      });

      return guard.finish(json(result));
    } catch (err) {
      return serverErrorResponse("me/skills/remove", err, "Failed to remove skill install");
    }
  }),
});

http.route({
  path: "/api/v1/me/skills/remove",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })),
});

// POST /api/v1/me/skills/outcomes — Report a skill execution outcome (authenticated, write:memories scope, idempotency-safe)
http.route({
  path: "/api/v1/me/skills/outcomes",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "write:memories");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    let body: {
      skill?: unknown;
      outcome?: unknown;
      agent?: unknown;
      note?: unknown;
      durationMs?: unknown;
    };
    try {
      body = await request.json();
    } catch {
      return errorResponse("invalid_request", "Invalid JSON body", 400);
    }

    try {
      if (typeof body.skill !== "string" || !body.skill.trim()) {
        return errorResponse("invalid_request", "skill is required (string)", 400);
      }
      const outcome = body.outcome;
      if (outcome !== "success" && outcome !== "failure" && outcome !== "partial") {
        return errorResponse("invalid_request", "outcome must be one of: success, failure, partial", 400);
      }

      const result = await ctx.runMutation(api.skills.recordOutcome, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        skillName: (body.skill as string).trim(),
        outcome: outcome as "success" | "failure" | "partial",
        agent: typeof body.agent === "string" ? body.agent.slice(0, 100) : undefined,
        note: typeof body.note === "string" ? body.note.slice(0, 500) : undefined,
        durationMs: typeof body.durationMs === "number" && body.durationMs >= 0
          ? body.durationMs
          : undefined,
      });

      return guard.finish(json({ success: true, ...result }));
    } catch (err) {
      return serverErrorResponse("me/skills/outcomes", err, "Failed to record skill outcome");
    }
  }),
});

http.route({
  path: "/api/v1/me/skills/outcomes",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })),
});

// GET /api/v1/me/skills/insights — Per-skill outcome aggregates for the authenticated user (read:private; ?cursor=&limit= additive pagination)
http.route({
  path: "/api/v1/me/skills/insights",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "read:private");
    if (denied) return denied;

    const user = await ctx.runQuery(api.users.getByClerkId, {
      clerkId: auth.userId,
      _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
    });
    if (!user) return errorResponse("not_found", "User not found", 404);

    try {
      const insights = await ctx.runQuery(api.skills.activityInsights, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        userId: user._id,
      });

      return json({ insights, total: insights.length });
    } catch (err) {
      return serverErrorResponse("me/skills/insights", err, "Failed to fetch skill insights");
    }
  }),
});

http.route({
  path: "/api/v1/me/skills/insights",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })),
});

// GET /api/v1/me/fleet-snapshot — Fleet-wide install counts for the caller's installed skills (read:private; k-anon floor 20 applies — counts below floor are null). Returns { skills: Array<{ skill: string, fleetInstallCount: number | null }>, generatedAt: number }.
http.route({
  path: "/api/v1/me/fleet-snapshot",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "read:private");
    if (denied) return denied;

    const user = await ctx.runQuery(api.users.getByClerkId, {
      clerkId: auth.userId,
      _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
    });
    if (!user) return errorResponse("not_found", "User not found", 404);

    try {
      // Fetch the caller's installed skill names.
      const installs = await ctx.runQuery(api.skills.listInstalls, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        userId: user._id,
      });
      const skillNames = installs.map((s: { skillName: string }) => s.skillName);

      // Get fleet-wide k-anon-gated counts for those skills.
      const fleetCounts = await ctx.runQuery(internal.fleet._fleetSkillCounts, { skillNames });

      const skills = skillNames.map((skill: string) => ({
        skill,
        fleetInstallCount: fleetCounts[skill] ?? null,
      }));

      return json({ skills, generatedAt: Date.now() });
    } catch (err) {
      return serverErrorResponse("me/fleet-snapshot", err, "Failed to fetch fleet snapshot");
    }
  }),
});

http.route({
  path: "/api/v1/me/fleet-snapshot",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })),
});

// ── Version History & Agent Activity ─────────────────────

// GET /api/v1/me/history — Get bundle version history (authenticated; supports ?cursor= + ?limit= pagination in version-desc order — paginated calls add nextCursor + hasMore)
http.route({
  path: "/api/v1/me/history",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "read:private");
    if (denied) return denied;

    const user = await ctx.runQuery(api.users.getByClerkId, { clerkId: auth.userId, _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN });
    if (!user) return errorResponse("not_found", "User not found", 404);

    // P13: cursor pagination via the by_userId_version index (version desc)
    const { cursor, limit, paginated } = parseListPagination(new URL(request.url));
    if (paginated) {
      try {
        const result = await ctx.runQuery(api.bundles.getHistoryPage, {
          clerkId: auth.userId,
          _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
          userId: user._id,
          cursor,
          numItems: limit ?? 50,
        });
        return json({ history: result.page, count: result.page.length, ...pageMeta(result) });
      } catch {
        return errorResponse("invalid_request", "Invalid pagination cursor", 400);
      }
    }

    const history = await ctx.runQuery(api.bundles.getHistory, {
      clerkId: auth.userId,
      _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
      userId: user._id,
    });
    return json({ history, count: history.length });
  }),
});

// GET /api/v1/me/bundles?version=N — Fetch a specific bundle version
http.route({
  path: "/api/v1/me/bundles",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "read:private");
    if (denied) return denied;

    const url = new URL(request.url);
    const versionParam = url.searchParams.get("version");
    if (!versionParam) {
      return errorResponse("invalid_request", "version query parameter is required", 400);
    }

    const version = Number(versionParam);
    if (!Number.isFinite(version) || !Number.isInteger(version) || version < 1) {
      return errorResponse("invalid_request", "version must be a positive integer", 400);
    }

    const bundle = await ctx.runQuery(api.bundles.getBundleByVersion, {
      clerkId: auth.userId,      _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
      version,
    });

    if (!bundle) {
      return errorResponse("not_found", `Version ${version} not found`, 404);
    }

    return json(bundle);
  }),
});

http.route({
  path: "/api/v1/me/bundles",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })),
});

http.route({
  path: "/api/v1/me/history",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })),
});

// Rollback to a previous version (authenticated)
http.route({
  path: "/api/v1/me/rollback",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "write:bundle");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    let body: { version?: unknown };
    try { body = await request.json(); } catch { return errorResponse("invalid_request", "Invalid JSON", 400); }

    if (typeof body.version !== "number") {
      return errorResponse("invalid_request", "version is required (number)", 400);
    }

    try {
      const result = await ctx.runMutation(api.bundles.rollbackToVersion, {
        clerkId: auth.userId,        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        targetVersion: body.version,
      });
      return guard.finish(json(result));
    } catch (err) {
      return serverErrorResponse("me/rollback", err, "Rollback failed");
    }
  }),
});

http.route({
  path: "/api/v1/me/rollback",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })),
});

// Get agent interaction summary (authenticated)
// Returns aggregated stats for each agent that has touched this user's
// identity, powered by the cross-agent activity log.
http.route({
  path: "/api/v1/me/agents",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "read:private");
    if (denied) return denied;

    try {
      const agents = await ctx.runQuery(api.activity.agentSummary, {
        clerkId: auth.userId,        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
      });
      return json({ agents: agents ?? [] });
    } catch {
      // Backend may not have activity module yet -- return empty list
      return json({ agents: [] });
    }
  }),
});

http.route({
  path: "/api/v1/me/agents",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })),
});

// Get raw agent activity log (authenticated)
// GET /api/v1/me/activity?limit=30&agent=Claude%20Code&action=read — supports ?cursor= pagination (cursor or limit calls add nextCursor + hasMore)
http.route({
  path: "/api/v1/me/activity",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "read:private");
    if (denied) return denied;

    const url = new URL(request.url);
    const agent = url.searchParams.get("agent") || undefined;
    const action = url.searchParams.get("action") || undefined;

    // P13: ?cursor= or ?limit= opts into cursor pagination over the
    // by_userId_date index (newest first, filters applied natively).
    const { cursor, limit, paginated } = parseListPagination(url);
    if (paginated) {
      try {
        const result = await ctx.runQuery(api.activity.listActivityPage, {
          clerkId: auth.userId,
          _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
          agentName: agent,
          action,
          cursor,
          numItems: limit ?? 30,
        });
        return json({ activity: result.page, count: result.page.length, ...pageMeta(result) });
      } catch {
        return errorResponse("invalid_request", "Invalid pagination cursor", 400);
      }
    }

    try {
      const activity = await ctx.runQuery(api.activity.listActivity, {
        clerkId: auth.userId,        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        limit: 30,
        agentName: agent,
        action,
      });
      return json({ activity: activity ?? [], count: (activity ?? []).length });
    } catch {
      // Backend may not have activity module yet -- return empty list
      return json({ activity: [], count: 0 });
    }
  }),
});

http.route({
  path: "/api/v1/me/activity",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })),
});

// POST /api/v1/me/activity/log — log an activity event (used by MCP server, CLI, agents)
http.route({
  path: "/api/v1/me/activity/log",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    // Cycle 57 (deliberate): no scope check here. Any valid key may self-report
    // activity telemetry about its own usage — requiring e.g. read:private
    // would silence the audit trail for narrowly-scoped agent keys.
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    let body: {
      agentName?: string;
      agentSource?: string;
      agentVersion?: string;
      action?: string;
      resource?: string;
      scope?: string;
      status?: string;
      details?: unknown;
      bundleVersionBefore?: number;
      bundleVersionAfter?: number;
      contentHashBefore?: string;
      contentHashAfter?: string;
      durationMs?: number;
    };
    try {
      body = await request.json();
    } catch {
      return errorResponse("invalid_request", "Invalid JSON body", 400);
    }

    if (!body.agentName || !body.action) {
      return errorResponse("invalid_request", "agentName and action required", 400);
    }

    try {
      const user = await ctx.runQuery(api.users.getByClerkId, { clerkId: auth.userId, _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN });
      if (!user) return errorResponse("not_found", "User not found", 404);

      const profile = await ctx.runQuery(api.profiles.getByOwnerId, { ownerId: user._id });

      await ctx.runMutation(internal.activity.logActivity, {
        userId: user._id,
        profileId: profile?._id,
        agentName: body.agentName,
        agentSource: body.agentSource || "unknown",
        agentVersion: body.agentVersion,
        action: body.action,
        resource: body.resource,
        scope: body.scope,
        status: body.status || "success",
        details: body.details,
        bundleVersionBefore: body.bundleVersionBefore,
        bundleVersionAfter: body.bundleVersionAfter,
        contentHashBefore: body.contentHashBefore,
        contentHashAfter: body.contentHashAfter,
        durationMs: body.durationMs,
      });

      return guard.finish(json({ success: true }));
    } catch (err) {
      return serverErrorResponse("me/activity/log", err, "Failed to log activity");
    }
  }),
});

http.route({
  path: "/api/v1/me/activity/log",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })),
});

// ============================================================
// PRIVATE VAULT (encrypted, client-side encryption)
// ============================================================

// POST /api/v1/me/vault/init — Initialize vault with wrapped key
http.route({
  path: "/api/v1/me/vault/init",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "vault");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    try {
      const body = await request.json();
      if (!body.wrappedVaultKey || !body.vaultSalt || !body.vaultKeyIv) {
        return errorResponse("invalid_request", "Missing wrappedVaultKey, vaultSalt, or vaultKeyIv", 400);
      }

      // Convert base64 strings to ArrayBuffer for Convex bytes fields
      const wrappedVaultKey = base64ToArrayBuffer(body.wrappedVaultKey);
      const vaultSalt = base64ToArrayBuffer(body.vaultSalt);
      const vaultKeyIv = base64ToArrayBuffer(body.vaultKeyIv);

      const result = await ctx.runMutation(api.vault.initVault, {
        clerkId: auth.userId,        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        wrappedVaultKey,
        vaultSalt,
        vaultKeyIv,
      });
      return guard.finish(json(result));
    } catch (err) {
      return serverErrorResponse("me/vault/init", err, "Failed to initialize vault");
    }
  }),
});

http.route({ path: "/api/v1/me/vault/init", method: "OPTIONS", handler: corsPreflight });

// POST /api/v1/me/vault — Save encrypted vault data
http.route({
  path: "/api/v1/me/vault",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "vault");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    try {
      const body = await request.json();
      if (!body.encryptedMd || !body.encryptedJson || !body.iv) {
        return errorResponse("invalid_request", "Missing encryptedMd, encryptedJson, or iv", 400);
      }

      const encryptedMd = base64ToArrayBuffer(body.encryptedMd);
      const encryptedJson = base64ToArrayBuffer(body.encryptedJson);
      const iv = base64ToArrayBuffer(body.iv);

      const result = await ctx.runMutation(api.vault.saveEncryptedVault, {
        clerkId: auth.userId,        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        encryptedMd,
        encryptedJson,
        iv,
      });
      return guard.finish(json(result));
    } catch (err) {
      return serverErrorResponse("me/vault/save", err, "Failed to save vault data");
    }
  }),
});

// GET /api/v1/me/vault — Get encrypted vault data
http.route({
  path: "/api/v1/me/vault",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "vault");
    if (denied) return denied;

    try {
      const vault = await ctx.runQuery(api.vault.getEncryptedVault, {
        clerkId: auth.userId,        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
      });

      if (!vault) {
        return json({ initialized: false });
      }

      // Convert ArrayBuffer fields to base64 for JSON transport
      const toB64 = (ab: ArrayBuffer | null) =>
        ab ? arrayBufferToBase64(ab) : null;

      return json({
        initialized: true,
        encryptedMd: toB64(vault.encryptedMd),
        encryptedJson: toB64(vault.encryptedJson),
        iv: toB64(vault.iv),
        wrappedVaultKey: toB64(vault.wrappedVaultKey),
        vaultSalt: toB64(vault.vaultSalt),
        vaultKeyIv: toB64(vault.vaultKeyIv),
        createdAt: vault.createdAt,
        updatedAt: vault.updatedAt,
      });
    } catch (err) {
      return serverErrorResponse("me/vault/get", err, "Failed to get vault data");
    }
  }),
});

http.route({ path: "/api/v1/me/vault", method: "OPTIONS", handler: corsPreflight });

// ============================================================
// ENV HANDOFF (ephemeral, zero-knowledge .env.local exchange)
// ============================================================
//
// Moves a project's `.env.local` between the owner's machines without ever
// committing it to git. Ciphertext is encrypted CLIENT-SIDE (AES-256-GCM):
// the server stores only ciphertext + a hash of the access code's lookup id.
// The decryption key rides inside the one-time access code and never reaches
// the server. Retrieval requires BOTH the owner's `vault`-scoped API key AND
// the expiring code. Rows burn after maxReads or expiry.

// POST /api/v1/me/env/handoff — create a handoff (store ciphertext)
http.route({
  path: "/api/v1/me/env/handoff",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "vault");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    try {
      const body = await request.json();
      if (!body.projectName || !body.codeHash || !body.ciphertext || !body.iv || !body.authTag) {
        return errorResponse("invalid_request", "Missing projectName, codeHash, ciphertext, iv, or authTag", 400);
      }
      const result = await ctx.runMutation(api.envHandoffs.createEnvHandoff, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        projectName: String(body.projectName),
        codeHash: String(body.codeHash),
        ciphertext: String(body.ciphertext),
        iv: String(body.iv),
        authTag: String(body.authTag),
        varNames: Array.isArray(body.varNames) ? body.varNames.map(String) : [],
        byteSize: Number(body.byteSize) || 0,
        maxReads: Number(body.maxReads) || 1,
        ttlMinutes: Number(body.ttlMinutes) || 60,
        clientName: body.clientName ? String(body.clientName) : detectAgent(request.headers.get("user-agent")).name,
      });
      return guard.finish(json(result));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create env handoff";
      if (message.includes("too large") || message.includes("invalid codeHash") || message.includes("too many active")) {
        return errorResponse("invalid_request", message, 400);
      }
      return serverErrorResponse("me/env/handoff", err, "Failed to create env handoff");
    }
  }),
});

http.route({ path: "/api/v1/me/env/handoff", method: "OPTIONS", handler: corsPreflight });

// POST /api/v1/me/env/handoff/claim — claim a handoff by code (burn-after-read)
http.route({
  path: "/api/v1/me/env/handoff/claim",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "vault");
    if (denied) return denied;
    const guard = await guardWrite(ctx, request, auth);
    if (guard.blocked) return guard.blocked;

    try {
      const body = await request.json();
      if (!body.codeHash) {
        return errorResponse("invalid_request", "Missing codeHash", 400);
      }
      const result = await ctx.runMutation(api.envHandoffs.claimEnvHandoff, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        codeHash: String(body.codeHash),
      });
      return guard.finish(json(result));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to claim env handoff";
      if (message.includes("HANDOFF_NOT_FOUND")) {
        return errorResponse("not_found", "No matching handoff for that access code", 404);
      }
      if (message.includes("HANDOFF_EXPIRED")) {
        return errorResponse("expired", "This access code has expired", 410);
      }
      if (message.includes("HANDOFF_CONSUMED")) {
        return errorResponse("consumed", "This access code has already been used", 410);
      }
      return serverErrorResponse("me/env/handoff/claim", err, "Failed to claim env handoff");
    }
  }),
});

http.route({ path: "/api/v1/me/env/handoff/claim", method: "OPTIONS", handler: corsPreflight });

// GET /api/v1/me/env/handoffs — list active handoffs (metadata only)
http.route({
  path: "/api/v1/me/env/handoffs",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "vault");
    if (denied) return denied;

    try {
      const handoffs = await ctx.runQuery(api.envHandoffs.listEnvHandoffs, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
      });
      return json({ handoffs });
    } catch (err) {
      return serverErrorResponse("me/env/handoffs", err, "Failed to list env handoffs");
    }
  }),
});

http.route({ path: "/api/v1/me/env/handoffs", method: "OPTIONS", handler: corsPreflight });

// ============================================================
// MCP SERVER (Model Context Protocol — JSON-RPC 2.0)
// ============================================================
//
// Exposes you.md identity data to MCP-compatible AI agents (Claude Code,
// Cursor, Windsurf, etc.) so they can read user identity context without
// being manually briefed each session.
//
// Spec: https://spec.modelcontextprotocol.io/specification/
//
// The tool/resource inventory is NOT documented here — hand-maintained
// inventories drift. The generated reference is the source of truth:
//   https://you.md/api/v1/docs/reference  (src/generated/docs-reference.ts)
//
// Discovery: GET /.well-known/mcp.json

// Newest spec revision this implementation satisfies: stateless streamable
// HTTP (single JSON-RPC message per POST, no batching), tool content
// results, resources/list + resources/templates/list + resources/read.
const MCP_PROTOCOL_VERSION = "2025-06-18";
// Older revisions we can also serve (the surface is a strict subset that is
// valid under all of these). initialize echoes the client's requested
// version when supported, per spec version negotiation.
const SUPPORTED_MCP_PROTOCOL_VERSIONS = [
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
];
const MCP_SERVER_INFO = { name: "you.md", version: "1.0.0" };
const AGENT_STACK_REPO_RESOURCE_FILES = [
  {
    uri: "agent-stack://repo/README.md",
    path: "agent-stack/README.md",
    name: "agent-stack/README.md",
    description: "Markdown overview of the synced Skill Mesh inventory in the user's GitHub identity repo.",
    mimeType: "text/markdown",
  },
  {
    uri: "agent-stack://repo/inventory.md",
    path: "agent-stack/inventory.md",
    name: "agent-stack/inventory.md",
    description: "Human-readable synced Skill Mesh report with counts, ownership rollups, gaps, mirrors, and DRY queues.",
    mimeType: "text/markdown",
  },
  {
    uri: "agent-stack://repo/inventory.json",
    path: "agent-stack/inventory.json",
    name: "agent-stack/inventory.json",
    description: "Machine-readable synced Skill Mesh report JSON with safe counts and report metadata.",
    mimeType: "application/json",
  },
] as const;

function hostedAgentStackResources(): Array<{
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}> {
  return [
    {
      uri: "agent-stack://inventory/summary",
      name: "agent-stack/inventory/summary",
      description: "Authenticated Skill Mesh summary: synced machine inventories, drift baseline, and safe repo snapshot paths.",
      mimeType: "application/json",
    },
    {
      uri: "agent-stack://inventory/report.html",
      name: "agent-stack/inventory/report.html",
      description: "Generated secret-safe HTML Skill Mesh report from persisted inventory, drift, and repo snapshot metadata.",
      mimeType: "text/html",
    },
    ...AGENT_STACK_REPO_RESOURCE_FILES.map(({ uri, name, description, mimeType }) => ({
      uri,
      name,
      description,
      mimeType,
    })),
  ];
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function numberLike(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function recordLike(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function topNumericRollup(value: unknown, limit = 6): Array<{ label: string; value: number }> {
  return Object.entries(recordLike(value))
    .flatMap(([label, raw]) => {
      const count = numberLike(raw);
      return count > 0 ? [{ label, value: count }] : [];
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function buildHostedAgentStackReportHtml({
  inventories,
  drift,
  mirror,
}: {
  inventories: Array<Record<string, unknown>>;
  drift: Record<string, unknown>;
  mirror: { repoFullName?: string | null; files?: Array<{ path: string; content?: string }> } | null;
}) {
  const latest = inventories[0] ?? {};
  const summary = recordLike(drift.summary);
  const repoPaths = AGENT_STACK_REPO_RESOURCE_FILES.map((file) => file.path);
  const presentPaths = new Set((mirror?.files ?? []).map((file) => file.path));
  const rows = inventories.slice(0, 8);
  const ownership = topNumericRollup(latest.ownershipRollup);
  const syncPolicy = topNumericRollup(latest.syncPolicyRollup);
  const provenance = topNumericRollup(latest.provenanceRollup);
  const missingPaths = repoPaths.filter((path) => !presentPaths.has(path));
  const generatedAt = new Date().toISOString();

  const rollupHtml = (title: string, entries: Array<{ label: string; value: number }>) => `
    <section>
      <h2>${escapeHtml(title)}</h2>
      ${entries.length ? `<ul>${entries.map((entry) => `<li><span>${escapeHtml(entry.label)}</span><strong>${entry.value.toLocaleString()}</strong></li>`).join("")}</ul>` : "<p>No rollup rows yet.</p>"}
    </section>
  `;

  const machineRows = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.hostName)}</td>
      <td>${escapeHtml(row.rootDir)}</td>
      <td>${numberLike(row.uniqueSkillNames).toLocaleString()}</td>
      <td>${numberLike(row.uniqueRealSkillFiles).toLocaleString()}</td>
      <td>${numberLike(row.missingFromYoumdCatalog).toLocaleString()}</td>
      <td>${numberLike(row.duplicateNameDifferentRealpaths).toLocaleString()}</td>
      <td>${escapeHtml(row.secretValuesExposed === true ? "review" : "safe")}</td>
    </tr>
  `).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>You.md Skill Mesh Report</title>
  <style>
    :root { color-scheme: dark; --bg:#0d0d0d; --panel:#151312; --line:#37312d; --text:#f2eee9; --muted:#a69b93; --accent:#c46a3a; --ok:#6fbf73; }
    * { box-sizing: border-box; }
    body { margin:0; background:var(--bg); color:var(--text); font:14px/1.55 Inter, ui-sans-serif, system-ui, sans-serif; }
    main { max-width:1120px; margin:0 auto; padding:28px; }
    h1,h2,th,td,strong,code { font-family:"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace; }
    h1 { margin:0; font-size:32px; font-weight:500; letter-spacing:0; }
    h2 { margin:28px 0 10px; color:var(--accent); font-size:14px; font-weight:500; letter-spacing:.08em; text-transform:uppercase; }
    p { color:var(--muted); max-width:860px; }
    .metrics { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:10px; margin:22px 0; }
    .metric, section { border-left:1px solid var(--line); background:color-mix(in srgb, var(--panel), transparent 8%); padding:12px 14px; }
    .metric span, li span { display:block; color:var(--muted); font-family:"JetBrains Mono", ui-monospace, monospace; font-size:10px; text-transform:uppercase; letter-spacing:.12em; }
    .metric strong { display:block; margin-top:7px; font-size:24px; font-weight:500; }
    .ok { color:var(--ok); } .accent { color:var(--accent); }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:10px; }
    ul { list-style:none; padding:0; margin:0; display:grid; gap:8px; }
    li { display:flex; align-items:center; justify-content:space-between; gap:12px; border-top:1px solid color-mix(in srgb, var(--line), transparent 45%); padding-top:8px; }
    table { width:100%; border-collapse:collapse; margin-top:10px; background:var(--panel); }
    th,td { border-bottom:1px solid var(--line); padding:8px; text-align:left; vertical-align:top; font-size:11px; }
    th { color:var(--muted); text-transform:uppercase; letter-spacing:.1em; font-size:9px; }
    code { color:#f6d0bd; overflow-wrap:anywhere; }
  </style>
</head>
<body>
  <main>
    <h1>You.md Skill Mesh Report</h1>
    <p>Generated ${escapeHtml(generatedAt)} from persisted You.md inventory, drift, and repo mirror metadata. This report includes safe counts, paths, statuses, and source rollups only; raw skill bodies, prompt logs, env values, tokens, and vault contents are not included.</p>
    <div class="metrics">
      <div class="metric"><span>trusted machines</span><strong>${numberLike(summary.machineCount || inventories.length).toLocaleString()}</strong></div>
      <div class="metric"><span>unique skill names</span><strong>${numberLike(latest.uniqueSkillNames).toLocaleString()}</strong></div>
      <div class="metric"><span>real SKILL.md files</span><strong>${numberLike(latest.uniqueRealSkillFiles).toLocaleString()}</strong></div>
      <div class="metric"><span>catalog gaps</span><strong class="accent">${numberLike(latest.missingFromYoumdCatalog).toLocaleString()}</strong></div>
      <div class="metric"><span>DRY review queue</span><strong class="accent">${numberLike(latest.duplicateNameDifferentRealpaths).toLocaleString()}</strong></div>
      <div class="metric"><span>secret exposure</span><strong class="${inventories.some((row) => row.secretValuesExposed === true) ? "accent" : "ok"}">${inventories.some((row) => row.secretValuesExposed === true) ? "review" : "none"}</strong></div>
    </div>
    <div class="grid">
      ${rollupHtml("Ownership", ownership)}
      ${rollupHtml("Sync Policy", syncPolicy)}
      ${rollupHtml("Provenance", provenance)}
    </div>
    <h2>Trusted Machine Snapshots</h2>
    <table>
      <thead><tr><th>host</th><th>root</th><th>skills</th><th>files</th><th>catalog gaps</th><th>DRY</th><th>secrets</th></tr></thead>
      <tbody>${machineRows || '<tr><td colspan="7">No synced inventories yet.</td></tr>'}</tbody>
    </table>
    <h2>Repo Snapshot</h2>
    <p>Repo: <code>${escapeHtml(mirror?.repoFullName ?? "not linked")}</code></p>
    <p>Expected files: ${repoPaths.map((path) => `<code>${escapeHtml(path)}</code>`).join(" ")}</p>
    <p>Missing files: ${missingPaths.length ? missingPaths.map((path) => `<code>${escapeHtml(path)}</code>`).join(" ") : '<span class="ok">none</span>'}</p>
  </main>
</body>
</html>`;
}

async function authenticateHostedAgentStackResource(
  ctx: ActionCtx,
  request: Request,
): Promise<AuthContext | Response> {
  const auth = await authenticateRequest(ctx, request);
  if (auth instanceof Response) return auth;
  const denied = await requireScope(ctx, request, auth, "read:private", "stacks");
  return denied ?? auth;
}

async function readHostedAgentStackResource(
  ctx: ActionCtx,
  request: Request,
  id: unknown,
  uri: string,
): Promise<Response | null> {
  if (!uri.startsWith("agent-stack://")) return null;

  const auth = await authenticateHostedAgentStackResource(ctx, request);
  if (auth instanceof Response) {
    return mcpError(id, auth.status === 403 ? -32003 : -32001, "authentication required for agent-stack resources");
  }

  if (uri === "agent-stack://inventory/summary" || uri === "agent-stack://inventory/report.html") {
    const limit = 12;
    const [inventoryRows, drift, mirror] = await Promise.all([
      ctx.runQuery(api.portfolio.listAgentStackInventories, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        limit,
      }),
      ctx.runQuery(api.portfolio.getAgentStackInventoryDrift, {
        clerkId: auth.userId,
        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        limit,
      }),
      ctx.runQuery(internal.github.internalGetMirrorByClerkId, {
        clerkId: auth.userId,
      }),
    ]);
    const inventories = inventoryRows as Array<Record<string, unknown>>;
    const repoPaths = AGENT_STACK_REPO_RESOURCE_FILES.map((file) => file.path);
    const presentPaths = new Set((mirror?.files ?? []).map((file: { path: string }) => file.path));
    if (uri === "agent-stack://inventory/report.html") {
      return mcpOk(id, {
        contents: [{
          uri,
          mimeType: "text/html",
          text: buildHostedAgentStackReportHtml({
            inventories,
            drift: drift as Record<string, unknown>,
            mirror,
          }),
        }],
      });
    }
    return mcpOk(id, {
      contents: [{
        uri,
        mimeType: "application/json",
        text: JSON.stringify({
          schemaVersion: "you-md/agent-stack-resource-summary/v1",
          generatedAt: Date.now(),
          inventories: inventoryRows,
          drift,
          repoSnapshot: {
            repo: mirror?.repoFullName ?? null,
            expectedPaths: repoPaths,
            missingPaths: repoPaths.filter((path) => !presentPaths.has(path)),
            resourceUris: AGENT_STACK_REPO_RESOURCE_FILES.map(({ uri, path, mimeType }) => ({ uri, path, mimeType })),
          },
          secretValuesExposed: false,
        }, null, 2),
      }],
    });
  }

  const repoResource = AGENT_STACK_REPO_RESOURCE_FILES.find((file) => file.uri === uri);
  if (!repoResource) {
    return mcpError(id, -32602, "unrecognised agent-stack URI — use agent-stack://inventory/summary, agent-stack://inventory/report.html, or agent-stack://repo/{README.md|inventory.md|inventory.json}");
  }
  const mirror = await ctx.runQuery(internal.github.internalGetMirrorByClerkId, {
    clerkId: auth.userId,
  });
  if (!mirror) return mcpError(id, -32004, "No repo mirror yet. Link a repo and sync in settings.");
  const file = mirror.files.find((entry: { path: string }) => entry.path === repoResource.path);
  if (!file) return mcpError(id, -32004, `File not found in mirror: ${repoResource.path}`);
  return mcpOk(id, {
    contents: [{
      uri,
      mimeType: repoResource.mimeType,
      text: file.content,
    }],
  });
}

// ─── Discovery ────────────────────────────────────────────────────────────────

http.route({
  path: "/.well-known/mcp.json",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(
      JSON.stringify({
        schema_version: "1",
        name: "you.md",
        description: "The identity context protocol for the agent internet — give every AI agent context about who you are. Per-stack namespace: /api/v1/mcp/{user}/{stack} scopes tool exposure to the declared stack manifest.",
        server: {
          type: "http",
          url: "https://you.md/api/v1/mcp",
        },
        per_stack_namespace: {
          url_pattern: "https://you.md/api/v1/mcp/{user}/{stack}",
          description: "Stack-scoped MCP endpoint. Always exposes whoami, get_identity, and get_agent_brief. Additional tools are gated by the stack manifest mcpTools field.",
        },
        protocol_version: MCP_PROTOCOL_VERSION,
        capabilities: {
          tools: true,
          resources: true,
        },
        authentication: {
          type: "bearer",
          required: false,
          description:
            "Public identity tools work unauthenticated. Tools that read the authenticated user's own data (whoami, get_agent_brief, get_my_identity, get_my_stacks, get_repo_file, get_agent_stack_inventory, get_synced_brain_graph, search_memories) require a you.md API key with the read:private scope, passed as `Authorization: Bearer <key>`. Write tools (report_skill_outcome) require the write:memories scope.",
          instructions_url: "https://you.md/docs#api-keys",
        },
      }, null, 2),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...CORS_HEADERS,
          "Cache-Control": "public, max-age=3600",
        },
      }
    );
  }),
});

http.route({ path: "/.well-known/mcp.json", method: "OPTIONS", handler: corsPreflight });

// ─── MCP JSON-RPC Handler ─────────────────────────────────────────────────────

http.route({
  path: "/api/v1/mcp",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let body: { jsonrpc?: string; id?: unknown; method?: string; params?: unknown };
    try {
      body = await request.json();
    } catch {
      return mcpError(null, -32700, "Parse error");
    }

    if (body.jsonrpc !== "2.0" || typeof body.method !== "string") {
      return mcpError(body.id ?? null, -32600, "Invalid Request");
    }

    const id = body.id ?? null;
    const method = body.method;
    const params = (body.params as Record<string, unknown>) || {};

    try {
      switch (method) {
        // ── Lifecycle ──────────────────────────────────────────────────────────
        case "initialize": {
          // Spec version negotiation: echo the client's requested version when
          // we support it; otherwise answer with our newest supported version.
          const requestedVersion = (params as Record<string, unknown>).protocolVersion;
          const negotiatedVersion =
            typeof requestedVersion === "string" &&
            SUPPORTED_MCP_PROTOCOL_VERSIONS.includes(requestedVersion)
              ? requestedVersion
              : MCP_PROTOCOL_VERSION;
          return mcpOk(id, {
            protocolVersion: negotiatedVersion,
            capabilities: {
              // P24: subscribe acknowledged (no-op ack — tools/list is static
              // per server version; dispatch can publish list_changed in future).
              tools: { listChanged: false, subscribe: true },
              resources: { listChanged: false, subscribe: false },
            },
            serverInfo: MCP_SERVER_INFO,
            instructions: "you.md is the identity context protocol for the agent internet. use get_identity(username) to load a user's structured identity bundle — their bio, projects, values, skills, agent directives, and communication preferences — so you can work with them without starting from scratch.",
          });
        }

        case "notifications/initialized":
        case "ping": {
          return mcpOk(id, {});
        }

        // ── Subscribe (P24) ────────────────────────────────────────────────────
        // The MCP spec defines a subscribe method for clients to opt into
        // server-initiated notifications. Our tools/list is static per server
        // version, so we acknowledge the subscription immediately without
        // storing state. When tools/list changes in a future version, the
        // dispatch layer can publish notifications/tools/list_changed here.
        case "subscribe": {
          return mcpOk(id, { subscribed: true });
        }

        // ── Tools ──────────────────────────────────────────────────────────────
        // T14: tools/list drives from HOSTED_MCP_TOOLS registry (one source of truth).
        case "tools/list": {
          return mcpOk(id, {
            tools: HOSTED_MCP_TOOLS.map(({ name, description, inputSchema, scopes }) => ({
              name,
              description,
              inputSchema,
              scopes,
            })),
          });
        }

        // T14: tools/call — one-liner registry dispatch. Auth checked once via
        // spec.scopes before calling the handler; handlers never re-authenticate.
        case "tools/call": {
          const toolName = (params as Record<string, unknown>).name as string;
          const toolArgs = ((params as Record<string, unknown>).arguments as Record<string, unknown>) || {};

          const spec = HOSTED_MCP_TOOLS.find((t) => t.name === toolName);
          if (!spec) {
            return mcpError(id, -32601, `Unknown tool: ${toolName}`);
          }

          // Auth: run once, scoped to the declared required scope.
          let toolAuth: McpAuthContext | null = null;
          if (spec.scopes.length > 0) {
            const authResult = await authenticateRequest(ctx, request);
            if (authResult instanceof Response) {
              return mcpToolError(id, "authentication required — pass your you.md API key as Bearer token");
            }
            const denied = await requireScope(
              ctx,
              request,
              authResult,
              spec.scopes[0],
              connectedAppResourceForMcpTool(toolName)
            );
            if (denied) {
              const credentialLabel =
                authResult.credentialType === "connected-app"
                  ? "Connected-app grant"
                  : "API key";
              return mcpToolError(id, `${credentialLabel} lacks required scope: ${spec.scopes[0]}`);
            }
            toolAuth = authResult;
          }

          const handlerResult = await spec.handler(ctx, toolArgs, toolAuth);
          return mcpOk(id, {
            content: handlerResult.content,
            isError: handlerResult.isError ?? false,
          });
        }

        // ── Resources ──────────────────────────────────────────────────────────
        case "resources/list": {
          const authResult = await authenticateRequest(ctx, request);
          const resources = authResult instanceof Response ? [] : hostedAgentStackResources();
          return mcpOk(id, { resources });
        }

        case "resources/templates/list": {
          return mcpOk(id, {
            resourceTemplates: [
              {
                uriTemplate: "identity://{username}",
                name: "you.md identity",
                description: "Public you.md identity bundle for a username. resources/read also accepts https://you.md/{username} URIs.",
                mimeType: "application/vnd.you-md.v1+json",
              },
              {
                uriTemplate: "agent-stack://inventory/summary",
                name: "agent stack inventory summary",
                description: "Authenticated Skill Mesh inventory/drift summary for the current user.",
                mimeType: "application/json",
              },
              {
                uriTemplate: "agent-stack://inventory/report.html",
                name: "agent stack HTML report",
                description: "Authenticated generated Skill Mesh HTML report from safe inventory, drift, and repo mirror metadata.",
                mimeType: "text/html",
              },
              {
                uriTemplate: "agent-stack://repo/{path}",
                name: "agent stack repo snapshot file",
                description: "Authenticated safe Skill Mesh report file from the user's mirrored identity repo. Supported paths: README.md, inventory.md, inventory.json.",
                mimeType: "text/plain",
              },
            ],
          });
        }

        case "resources/read": {
          const uri = (params as Record<string, unknown>).uri as string;
          if (!uri || typeof uri !== "string") {
            return mcpError(id, -32602, "uri parameter required");
          }

          const agentStackResource = await readHostedAgentStackResource(ctx, request, id, uri);
          if (agentStackResource) return agentStackResource;

          // Parse identity://{username} or https://you.md/{username}
          let username: string | null = null;
          const identityMatch = uri.match(/^identity:\/\/([a-zA-Z0-9_-]+)/);
          const urlMatch = uri.match(/you\.md\/([a-zA-Z0-9_-]+)/);
          if (identityMatch) username = identityMatch[1];
          else if (urlMatch) username = urlMatch[1];

          if (!username) {
            return mcpError(id, -32602, "unrecognised URI — use identity://{username} or https://you.md/{username}");
          }

          const profile = await ctx.runQuery(api.profiles.getPublicProfile, { username });
          if (!profile) {
            return mcpError(id, -32001, `no profile found for @${username}`);
          }

          return mcpOk(id, {
            contents: [
              {
                uri,
                mimeType: "application/vnd.you-md.v1+json",
                text: JSON.stringify(profile.youJson ?? { username: profile.username }, null, 2),
              },
            ],
          });
        }

        default:
          return mcpError(id, -32601, `Method not found: ${method}`);
      }
    } catch (err) {
      // T13 — sanitized: JSON-RPC -32603 is the MCP equivalent of a 500.
      // The real error goes to server logs only.
      console.error("[http:mcp] internal error:", err);
      return mcpError(id, -32603, "Internal error");
    }
  }),
});

http.route({ path: "/api/v1/mcp", method: "OPTIONS", handler: corsPreflight });

// Allow GET on MCP for SSE-capable clients / discovery ping
http.route({
  path: "/api/v1/mcp",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(
      JSON.stringify({
        name: "you.md MCP server",
        version: "1.0.0",
        protocolVersion: MCP_PROTOCOL_VERSION,
        description: "Identity context protocol for the agent internet. POST JSON-RPC 2.0 to this endpoint.",
        docs: "https://you.md/docs",
      }, null, 2),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      }
    );
  }),
});

// ─── Per-stack MCP namespace (L23) ───────────────────────────────────────────
//
// GET/POST /api/v1/mcp/{user}/{stack}
//
// A stack-scoped MCP endpoint. Compared with the global /api/v1/mcp surface:
//   - tools/list always includes the three identity-core tools (whoami,
//     get_identity, get_agent_brief) regardless of stack.
//   - Additional tools are included only when the resolved stack manifest
//     declares them in an `mcpTools` array field.
//   - 404 with `not_found` envelope when {user}/{stack} doesn't resolve to a
//     valid public stack in the user's repo mirror.
//
// Auth: same Bearer flow as /api/v1/mcp (authenticateRequest + standard error
// envelope on 401).
//
// TODO(L23-mcpTools): When youstack.json gains an `mcpTools` field, filter the
// full tool list to declared names. For now only the always-on three are served.

// Canonical always-on tool definitions shared between the global MCP surface and
// the per-stack namespace.
const MCP_ALWAYS_ON_TOOL_NAMES = new Set(["whoami", "get_identity", "get_agent_brief"]);

http.route({
  pathPrefix: "/api/v1/mcp/",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Parse {user}/{stack} from the path.
    const url = new URL(request.url);
    const suffix = url.pathname.replace(/^\/api\/v1\/mcp\//, "");
    const parts = suffix.split("/").filter(Boolean);
    if (parts.length < 2) {
      return new Response(
        JSON.stringify({ error: "not_found", message: "Path must be /api/v1/mcp/{user}/{stack}" }),
        { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }
    const [targetUser, targetStack] = parts;

    // Resolve the public stack from the target user's repo mirror.
    // We look up the user by username (public — no auth required for the lookup
    // itself, just like /api/v1/profiles?username=...).
    // Resolve the target user by username (canonical handle).
    const targetUserDoc = await ctx.runQuery(internal.users.getByUsername, {
      username: targetUser,
    });
    if (!targetUserDoc) {
      return new Response(
        JSON.stringify({ error: "not_found", message: `No public profile found for @${targetUser}` }),
        { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    // Load the repo mirror for the target user and derive the stack list.
    const mirror = await ctx.runQuery(internal.github.internalGetMirrorByUserId, {
      userId: targetUserDoc._id,
    });
    if (!mirror) {
      return new Response(
        JSON.stringify({ error: "not_found", message: `No repo mirror found for @${targetUser}` }),
        { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    const stacks = deriveStacks(mirror.files);
    const stack = stacks.find(
      (s: { slug: string }) => s.slug === targetStack
    );
    if (!stack) {
      return new Response(
        JSON.stringify({ error: "not_found", message: `Stack '${targetStack}' not found for @${targetUser}` }),
        { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }

    // Auth: optional — Bearer token required only for tools that need identity.
    // Parse it here so tool handlers can branch on auth presence.
    const auth = await authenticateRequest(ctx, request);
    const authed = !(auth instanceof Response);

    // Parse the JSON-RPC body.
    let body: { jsonrpc?: string; id?: unknown; method?: string; params?: unknown };
    try {
      body = await request.json();
    } catch {
      return mcpError(null, -32700, "Parse error");
    }

    if (body.jsonrpc !== "2.0" || typeof body.method !== "string") {
      return mcpError(body.id ?? null, -32600, "Invalid Request");
    }

    const id = body.id ?? null;
    const method = body.method;

    try {
      switch (method) {
        case "initialize": {
          const params = (body.params as Record<string, unknown>) || {};
          const requestedVersion = (params as Record<string, unknown>).protocolVersion;
          const negotiatedVersion =
            typeof requestedVersion === "string" &&
            SUPPORTED_MCP_PROTOCOL_VERSIONS.includes(requestedVersion)
              ? requestedVersion
              : MCP_PROTOCOL_VERSION;
          return mcpOk(id, {
            protocolVersion: negotiatedVersion,
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: `you.md/${targetUser}/${targetStack}`, version: "1.0.0" },
            instructions: `Stack-scoped you.md MCP endpoint for @${targetUser}/${targetStack}. Always-on tools: whoami, get_identity, get_agent_brief. Additional tools are declared in the stack manifest.`,
          });
        }

        case "notifications/initialized":
        case "ping":
          return mcpOk(id, {});

        case "tools/list": {
          // Always-on identity tools.
          // TODO(L23-mcpTools): When stack.manifest.mcpTools is available, merge
          // additional declared tool definitions from the global tool registry.
          const alwaysOn = [
            {
              name: "whoami",
              description: "Return a compact identity summary of the authenticated user. Requires a you.md API key as Bearer token.",
              inputSchema: { type: "object", properties: {} },
            },
            {
              name: "get_identity",
              description: `Get ${targetUser}'s public identity bundle from you.md.`,
              inputSchema: {
                type: "object",
                properties: {
                  username: {
                    type: "string",
                    description: `The you.md username — defaults to '${targetUser}' for this stack endpoint.`,
                  },
                },
              },
            },
            {
              name: "get_agent_brief",
              description: "Return a startup brief for the authenticated user (identity + memories + skills + next moves). Requires a you.md API key as Bearer token.",
              inputSchema: {
                type: "object",
                properties: {
                  format: { type: "string", enum: ["markdown", "json"] },
                  includeMemories: { type: "boolean" },
                  maxChars: { type: "number" },
                },
              },
            },
          ];
          return mcpOk(id, { tools: alwaysOn });
        }

        case "tools/call": {
          const params = (body.params as Record<string, unknown>) || {};
          const toolName = params.name as string;
          if (!toolName || !MCP_ALWAYS_ON_TOOL_NAMES.has(toolName)) {
            return mcpError(id, -32601, `Tool not available in this stack namespace: ${toolName}`);
          }
          // Delegate to the global MCP surface for always-on tool execution by
          // re-routing to the same handler logic. For now, require auth and proxy
          // the call as a forward.
          if (!authed) {
            return mcpToolError(id, "authentication required — pass your you.md API key as Bearer token");
          }
          // Reconstruct a global MCP request body and call via internal action.
          // This avoids duplicating large handler blocks — the always-on tools
          // are fully implemented in the global /api/v1/mcp handler.
          const proxyUrl = new URL(request.url);
          proxyUrl.pathname = "/api/v1/mcp";
          const proxyRequest = new Request(proxyUrl.toString(), {
            method: "POST",
            headers: request.headers,
            body: JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params }),
          });
          // Forward to the global handler via a subrequest.
          return await fetch(proxyRequest);
        }

        default:
          return mcpError(id, -32601, `Method not found: ${method}`);
      }
    } catch (err) {
      console.error("[http:mcp-stack] internal error:", err);
      return mcpError(id, -32603, "Internal error");
    }
  }),
});

http.route({ pathPrefix: "/api/v1/mcp/", method: "OPTIONS", handler: corsPreflight });

// ─── MCP JSON-RPC helpers ─────────────────────────────────────────────────────

function mcpOk(id: unknown, result: unknown): Response {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", id, result }),
    { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
  );
}

function mcpError(id: unknown, code: number, message: string): Response {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }),
    { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
  );
}

function mcpToolError(id: unknown, message: string): Response {
  return mcpOk(id, {
    content: [{ type: "text", text: message }],
    isError: true,
  });
}

// ─── Hosted MCP helpers ───────────────────────────────────────────────────────
//
// T14: HostedAgentBrief type, loadAuthedUserIdentity, buildHostedAgentBrief,
// and formatAgentBriefMarkdown have been moved to convex/lib/mcpRegistry.ts
// (the unified tool registry). All tool dispatch logic also lives there.

// ============================================================
// VERIFICATIONS
// ============================================================

// GET /api/v1/me/verifications — list user's active verifications
http.route({
  path: "/api/v1/me/verifications",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "read:private");
    if (denied) return denied;

    try {
      const user = await ctx.runQuery(api.users.getByClerkId, { clerkId: auth.userId, _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN });
      if (!user) return errorResponse("not_found", "User not found", 404);

      const profile = await ctx.runQuery(api.profiles.getByOwnerId, { ownerId: user._id });
      if (!profile) return json({ verifications: [], message: "No profile found" });

      const verifications = await ctx.runQuery(api.profiles.listVerifications, { profileId: profile._id });
      return json({ verifications });
    } catch (err) {
      return serverErrorResponse("me/verifications", err, "Failed to get verifications");
    }
  }),
});

http.route({ path: "/api/v1/me/verifications", method: "OPTIONS", handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })) });

// ---------------------------------------------------------------------------
// Admin — reseed sample profiles
// POST /api/admin/reseed  Authorization: Bearer <TRUSTED_INTERNAL_AUTH_TOKEN>
// ---------------------------------------------------------------------------

http.route({
  path: "/api/admin/reseed",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = request.headers.get("Authorization") ?? "";
    const token = auth.replace(/^Bearer\s+/, "");
    if (!TRUSTED_INTERNAL_AUTH_TOKEN || token !== TRUSTED_INTERNAL_AUTH_TOKEN) {
      return errorResponse("unauthorized", "Unauthorized", 401);
    }
    try {
      const cleanupResult = await ctx.runMutation(internal.seed.cleanupSampleProfiles, {});
      const seedResult = await ctx.runMutation(internal.seed.seedSampleProfiles, {});
      return json({ cleanup: cleanupResult, seed: seedResult });
    } catch (err) {
      return serverErrorResponse("admin/reseed", err, "Reseed failed");
    }
  }),
});

http.route({ path: "/api/admin/reseed", method: "OPTIONS", handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })) });

// ---------------------------------------------------------------------------
// Admin — public profile indexing controls
// POST /api/admin/profiles/import-targets  Authorization: Bearer <TRUSTED_INTERNAL_AUTH_TOKEN>
// POST /api/admin/profiles/fetch-sources   Authorization: Bearer <TRUSTED_INTERNAL_AUTH_TOKEN>
// ---------------------------------------------------------------------------

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function isTrustedAdminRequest(request: Request): boolean {
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/, "");
  return Boolean(TRUSTED_INTERNAL_AUTH_TOKEN && token === TRUSTED_INTERNAL_AUTH_TOKEN);
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function omitUndefined<T extends Record<string, unknown>>(value: T): T {
  for (const key of Object.keys(value)) {
    if (value[key] === undefined) delete value[key];
  }
  return value;
}

http.route({
  path: "/api/admin/profiles/import-targets",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!isTrustedAdminRequest(request)) {
      return errorResponse("unauthorized", "Unauthorized", 401);
    }
    const body = await readJsonBody(request);
    try {
      const result = await ctx.runAction(internal.profileIndexing.importInitialPublicProfileTargets, omitUndefined({
        dryRun: optionalBoolean(body.dryRun),
        limit: optionalNumber(body.limit),
        offset: optionalNumber(body.offset),
        batchKey: optionalString(body.batchKey),
        forcePatch: optionalBoolean(body.forcePatch),
      }));
      return json(result);
    } catch (err) {
      return serverErrorResponse("admin/profiles/import-targets", err, "Public profile import failed");
    }
  }),
});

http.route({
  path: "/api/admin/profiles/fetch-sources",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!isTrustedAdminRequest(request)) {
      return errorResponse("unauthorized", "Unauthorized", 401);
    }
    const body = await readJsonBody(request);
    try {
      const result = await ctx.runAction(internal.profileIndexing.fetchDueProfileSources, omitUndefined({
        dryRun: optionalBoolean(body.dryRun),
        limit: optionalNumber(body.limit),
      }));
      return json(result);
    } catch (err) {
      return serverErrorResponse("admin/profiles/fetch-sources", err, "Public profile source refresh failed");
    }
  }),
});

http.route({ path: "/api/admin/profiles/import-targets", method: "OPTIONS", handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })) });
http.route({ path: "/api/admin/profiles/fetch-sources", method: "OPTIONS", handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })) });

// ---------------------------------------------------------------------------
// Repo mirror reads (Phase 4) — agents read the user's repo-hosted identity +
// stacks from our server-side mirror without hitting GitHub.
// GET /api/v1/me/repo/files            -> file list + stacks (or ?path= for one file)
// GET /api/v1/me/repo/stacks           -> derived stacks list
// Both authenticate via the standard API-key Bearer token.
// ---------------------------------------------------------------------------

http.route({
  path: "/api/v1/me/repo/files",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "read:private");
    if (denied) return denied;

    const mirror = await ctx.runQuery(
      internal.github.internalGetMirrorByClerkId,
      { clerkId: auth.userId }
    );
    if (!mirror) {
      return json({ repo: null, files: [], stacks: [], message: "No repo mirror yet. Link a repo and sync." });
    }

    const url = new URL(request.url);
    const path = url.searchParams.get("path");
    if (path) {
      const file = mirror.files.find((f: { path: string }) => f.path === path);
      if (!file) return errorResponse("not_found", `File not found in mirror: ${path}`, 404);
      return json({ path: file.path, size: file.size, content: file.content });
    }

    return json({
      repo: mirror.repoFullName,
      commitSha: mirror.commitSha ?? null,
      syncedAt: mirror.syncedAt,
      truncated: mirror.truncated,
      files: mirror.files.map((f: { path: string; size: number }) => ({
        path: f.path,
        size: f.size,
      })),
      stacks: deriveStacks(mirror.files),
    });
  }),
});

http.route({ path: "/api/v1/me/repo/files", method: "OPTIONS", handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })) });

http.route({
  path: "/api/v1/me/repo/stacks",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;
    const denied = await requireScope(ctx, request, auth, "read:private");
    if (denied) return denied;

    const mirror = await ctx.runQuery(
      internal.github.internalGetMirrorByClerkId,
      { clerkId: auth.userId }
    );
    if (!mirror) {
      return json({ repo: null, stacks: [], message: "No repo mirror yet. Link a repo and sync." });
    }
    return json({ repo: mirror.repoFullName, stacks: deriveStacks(mirror.files) });
  }),
});

http.route({ path: "/api/v1/me/repo/stacks", method: "OPTIONS", handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })) });

// ---------------------------------------------------------------------------
// Public stack registry — no auth required (mirrors /api/v1/profiles pattern)
// GET /api/v1/stacks/registry/{user}/{slug}
//   Returns the stack manifest + files under stacks/<slug>/ from the user's
//   public repo mirror. 404 when the user, mirror, or stack slug is not found.
//   Files are capped at 200 entries; pass ?limit=N (1–200) to narrow further.
//   Response shape: { user, slug, manifest, files[], truncated, fileCount, syncedAt }
// ---------------------------------------------------------------------------

http.route({
  pathPrefix: "/api/v1/stacks/registry/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    // Path: /api/v1/stacks/registry/{user}/{slug}
    const suffix = url.pathname.replace(/^\/api\/v1\/stacks\/registry\/?/, "");
    const parts = suffix.split("/").filter(Boolean);
    if (parts.length < 2) {
      return errorResponse("invalid_request", "Path must be /api/v1/stacks/registry/{user}/{slug}", 400);
    }
    const [targetUser, targetSlug] = parts;

    // Resolve user by username (same pattern as MCP namespace and public profile).
    const userDoc = await ctx.runQuery(internal.users.getByUsername, { username: targetUser });
    if (!userDoc) {
      return errorResponse("not_found", `No profile found for @${targetUser}`, 404);
    }

    // Load the repo mirror (no auth check — public data only).
    const mirror = await ctx.runQuery(internal.github.internalGetMirrorByUserId, {
      userId: userDoc._id,
    });
    if (!mirror) {
      return errorResponse("not_found", `No repo mirror found for @${targetUser}`, 404);
    }

    // Filter to files under stacks/<slug>/ and cap at 200.
    const rawLimit = url.searchParams.has("limit")
      ? Math.min(Math.max(parseInt(url.searchParams.get("limit")!, 10) || 200, 1), 200)
      : 200;
    const prefix = `stacks/${targetSlug}/`;
    const allStackFiles = mirror.files.filter((f: { path: string }) => f.path.startsWith(prefix));
    if (allStackFiles.length === 0) {
      return errorResponse("not_found", `Stack '${targetSlug}' not found for @${targetUser}`, 404);
    }
    const truncated = allStackFiles.length > rawLimit;
    const files = allStackFiles.slice(0, rawLimit);

    // Extract the manifest file (youstack.json or manifest.json) content.
    const manifestFile = files.find((f: { path: string }) =>
      /\/(youstack|manifest)\.(json|ya?ml)$/i.test(f.path)
    );
    let manifest: unknown = null;
    if (manifestFile) {
      try {
        manifest = JSON.parse((manifestFile as { content: string }).content);
      } catch {
        // Not valid JSON — return raw, consumer can handle
        manifest = null;
      }
    }

    return json(
      {
        user: targetUser,
        slug: targetSlug,
        manifest,
        files: files.map((f: { path: string; size: number; content: string }) => ({
          path: f.path,
          size: f.size,
          content: f.content,
        })),
        fileCount: files.length,
        truncated,
        syncedAt: mirror.syncedAt,
        stale: mirror.stale ?? false,
      },
      200,
      { "Cache-Control": "public, max-age=30" }
    );
  }),
});

http.route({ pathPrefix: "/api/v1/stacks/registry/", method: "OPTIONS", handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })) });

// ---------------------------------------------------------------------------
// GitHub webhook — auto-pull on external push to a linked You.md repo
// POST /api/github/webhook  (verified via X-Hub-Signature-256 / HMAC-SHA256)
// ---------------------------------------------------------------------------

async function verifyGithubSignature(
  secret: string,
  body: string,
  signatureHeader: string
): Promise<boolean> {
  if (!signatureHeader.startsWith("sha256=")) return false;
  const provided = signatureHeader.slice("sha256=".length);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(body)
  );
  const expected = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (expected.length !== provided.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return diff === 0;
}

http.route({
  path: "/api/github/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) return errorResponse("not_configured", "webhook not configured", 503);

    const event = request.headers.get("x-github-event") ?? "";
    const signature = request.headers.get("x-hub-signature-256") ?? "";
    const body = await request.text();

    if (!(await verifyGithubSignature(secret, body, signature))) {
      return errorResponse("unauthorized", "invalid signature", 401);
    }
    if (event === "ping") return json({ ok: true, pong: true });

    // GitHub App lifecycle — revoke installation on uninstall/suspend.
    if (event === "installation") {
      let p: { action?: string; installation?: { id?: number } };
      try {
        p = JSON.parse(body);
      } catch {
        return errorResponse("invalid_request", "bad payload", 400);
      }
      const instId = p.installation?.id;
      if (instId && (p.action === "deleted" || p.action === "suspend")) {
        const cleared = await ctx.runMutation(
          internal.github.internalClearInstallationById,
          { installationId: instId }
        );
        return json({ ok: true, cleared });
      }
      return json({ ok: true, ignored: `installation.${p.action ?? "?"}` });
    }

    if (event !== "push") return json({ ok: true, ignored: event });

    let payload: { repository?: { full_name?: string }; ref?: string };
    try {
      payload = JSON.parse(body);
    } catch {
      return errorResponse("invalid_request", "bad payload", 400);
    }

    const repoFullName = payload.repository?.full_name;
    if (!repoFullName) return json({ ok: true, ignored: "no repo" });

    const lookup = await ctx.runQuery(internal.github.internalGetClerkIdByRepo, {
      repoFullName,
    });
    if (!lookup) return json({ ok: true, ignored: "no linked account" });

    // Only react to pushes on the linked default branch.
    if (payload.ref && payload.ref !== `refs/heads/${lookup.defaultBranch}`) {
      return json({ ok: true, ignored: "non-default branch" });
    }

    await ctx.scheduler.runAfter(
      0,
      internal.githubRepo.internalPullForConnection,
      { clerkId: lookup.clerkId }
    );
    await ctx.scheduler.runAfter(
      0,
      internal.githubRepo.internalMirrorForConnection,
      { clerkId: lookup.clerkId }
    );
    return json({ ok: true, scheduled: true });
  }),
});

http.route({ path: "/api/github/webhook", method: "OPTIONS", handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })) });

export default http;
