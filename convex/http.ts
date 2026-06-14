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
  userId: string; // clerkId (compat with /me convex functions)
  username: string;
  plan: string;
  scopes: string[] | null;
  declaredScopes: string[];
  userDbId: Id<"users">;
  apiKeyId: Id<"apiKeys">;
};

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
  scope: ApiScope
): Promise<Response | null> {
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
    // Auth reached here means a valid API key was used. Prefer "api-key" as
    // the source unless the UA tells us it's an MCP client.
    const agentSource = agent.source === "mcp" ? "mcp" : "api-key";

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
            agentName: agent.name,
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
            agentName: agent.name,
            agentSource,
            agentVersion: agent.version,
            action: "write",
            resource: "bundle",
            status: message.includes("ANCESTOR_MISMATCH") ? "denied" : "error",
            details: { message },
            durationMs: Date.now() - startedAt,
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
    const agentSource = agent.source === "mcp" ? "mcp" : "api-key";

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
            agentName: agent.name,
            agentSource,
            agentVersion: agent.version,
            action: "publish",
            resource: "bundle",
            status: "success",
            bundleVersionAfter: result.version,
            durationMs: Date.now() - startedAt,
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
        const agentSource = agent.source === "mcp" ? "mcp" : "api-key";
        await ctx.runMutation(internal.activity.logActivity, {
          userId: user._id,
          profileId: profile._id,
          agentName: agent.name,
          agentSource,
          agentVersion: agent.version,
          action: "write",
          resource: "portrait",
          status: "success",
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

      const result = await ctx.runMutation(api.apiKeys.createKey, {
        clerkId: auth.userId,        _internalAuthToken: TRUSTED_INTERNAL_AUTH_TOKEN,
        label: body.label,
        scopes: requestedScopes,
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
      const agentSource = agent.source === "mcp" ? "mcp" : "api-key";
      await ctx.runMutation(internal.activity.logActivity, {
        userId: user._id,
        profileId: profile._id,
        agentName: agent.name,
        agentSource,
        agentVersion: agent.version,
        action: "write",
        resource: "private",
        scope: "full",
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
      agentName: body.agentName || auth.username || "API",
      memories: sanitized,
    });

    // Log activity
    try {
      const agent = detectAgent(request.headers.get("user-agent"));
      const agentSource = agent.source === "mcp" ? "mcp" : "api-key";
      await ctx.runMutation(internal.activity.logActivity, {
        userId: user._id,
        agentName: body.agentName || agent.name,
        agentSource,
        agentVersion: agent.version,
        action: "memory_add",
        resource: "memories",
        status: "success",
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
      const wrappedVaultKey = new ArrayBuffer(Buffer.from(body.wrappedVaultKey, "base64").length);
      new Uint8Array(wrappedVaultKey).set(Buffer.from(body.wrappedVaultKey, "base64"));

      const vaultSalt = new ArrayBuffer(Buffer.from(body.vaultSalt, "base64").length);
      new Uint8Array(vaultSalt).set(Buffer.from(body.vaultSalt, "base64"));

      const vaultKeyIv = new ArrayBuffer(Buffer.from(body.vaultKeyIv, "base64").length);
      new Uint8Array(vaultKeyIv).set(Buffer.from(body.vaultKeyIv, "base64"));

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

      const encryptedMd = new ArrayBuffer(Buffer.from(body.encryptedMd, "base64").length);
      new Uint8Array(encryptedMd).set(Buffer.from(body.encryptedMd, "base64"));

      const encryptedJson = new ArrayBuffer(Buffer.from(body.encryptedJson, "base64").length);
      new Uint8Array(encryptedJson).set(Buffer.from(body.encryptedJson, "base64"));

      const iv = new ArrayBuffer(Buffer.from(body.iv, "base64").length);
      new Uint8Array(iv).set(Buffer.from(body.iv, "base64"));

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
        ab ? Buffer.from(ab).toString("base64") : null;

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
            "Public identity tools work unauthenticated. Tools that read the authenticated user's own data (whoami, get_agent_brief, get_my_identity, get_my_stacks, get_repo_file, search_memories) require a you.md API key with the read:private scope, passed as `Authorization: Bearer <key>`. Write tools (report_skill_outcome) require the write:memories scope.",
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
            const denied = await requireScope(ctx, request, authResult, spec.scopes[0]);
            if (denied) {
              return mcpToolError(id, `API key lacks required scope: ${spec.scopes[0]}`);
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
          // No fixed concrete resources — identities are parameterized by
          // username and exposed via the identity://{username} URI template
          // (see resources/templates/list).
          return mcpOk(id, { resources: [] });
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
            ],
          });
        }

        case "resources/read": {
          const uri = (params as Record<string, unknown>).uri as string;
          if (!uri || typeof uri !== "string") {
            return mcpError(id, -32602, "uri parameter required");
          }

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
