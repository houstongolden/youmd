import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

// ============================================================
// PUBLIC ENDPOINTS
// ============================================================

// GET /api/v1/profiles?username=xxx — Public you.json
http.route({
  path: "/api/v1/profiles",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const username = url.searchParams.get("username");

    if (!username) {
      return json({ error: "Username parameter required" }, 400);
    }

    const profile = await ctx.runQuery(api.profiles.getPublicProfile, {
      username,
    });

    if (!profile) {
      return json({ error: "Profile not found" }, 404);
    }

    // Record the view as an agent read
    await ctx.runMutation(api.profiles.recordView, {
      username,
      referrer: request.headers.get("referer") ?? undefined,
      isAgentRead: true,
    });

    const accept = request.headers.get("accept") ?? "";

    // Return markdown if requested
    if (accept.includes("text/markdown") || accept.includes("text/plain")) {
      return new Response(profile.youMd, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          ...CORS_HEADERS,
          "Cache-Control": "public, max-age=60",
        },
      });
    }

    return json(profile.youJson, 200, { "Cache-Control": "public, max-age=60" });
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
      return json({ error: "Username parameter required" }, 400);
    }

    const result = await ctx.runQuery(api.users.checkUsername, { username });
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
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return json({ error: "Token parameter required" }, 400);
    }

    const result = await ctx.runQuery(api.contextLinks.resolveLink, { token });

    if ("error" in result) {
      return json({ error: result.error }, result.status);
    }

    // Increment use count
    await ctx.runMutation(api.contextLinks.incrementUseCount, { token });

    // Record the view
    await ctx.runMutation(api.profiles.recordView, {
      username: result.username,
      referrer: request.headers.get("referer") ?? undefined,
      isAgentRead: true,
      isContextLink: true,
    });

    const accept = request.headers.get("accept") ?? "";

    // Return markdown if requested
    if (accept.includes("text/markdown") || accept.includes("text/plain")) {
      return new Response(result.markdown, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          ...CORS_HEADERS,
        },
      });
    }

    return json({
      schema: "you-md/v1",
      username: result.username,
      scope: result.scope,
      ...result.bundle,
    });
  }),
});

// ============================================================
// AUTHENTICATED ENDPOINTS (API key auth)
// ============================================================

// Helper: validate API key and return user
async function authenticateRequest(
  ctx: { runQuery: (ref: any, args: any) => Promise<any> },
  request: Request
): Promise<{ userId: string; username: string; plan: string } | Response> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return json({ error: "Missing or invalid Authorization header" }, 401);
  }

  const key = authHeader.substring(7);

  // Hash the key and look it up
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  const apiKey = await ctx.runQuery(api.apiKeys.getByHash, { keyHash });

  if (!apiKey || apiKey.revokedAt) {
    return json({ error: "Invalid or revoked API key" }, 401);
  }

  // Update last used
  await (ctx as any).runMutation(api.apiKeys.updateLastUsed, {
    keyId: apiKey._id,
  });

  return {
    userId: apiKey.userId,
    username: apiKey.username,
    plan: apiKey.plan,
  };
}

// POST /api/v1/me/bundle — Save a bundle
http.route({
  path: "/api/v1/me/bundle",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;

    try {
      const body = await request.json();
      const result = await ctx.runMutation(api.me.saveBundleFromForm, {
        clerkId: auth.userId, // We'll need to adapt this
        profileData: body.profileData,
      });
      return json(result);
    } catch (err) {
      return json(
        { error: err instanceof Error ? err.message : "Failed to save bundle" },
        500
      );
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

    try {
      const result = await ctx.runMutation(api.me.publishLatest, {
        clerkId: auth.userId,
      });
      return json(result);
    } catch (err) {
      return json(
        { error: err instanceof Error ? err.message : "Failed to publish" },
        500
      );
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

    const profile = await ctx.runQuery(api.me.getMyProfile, {
      clerkId: auth.userId,
    });

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

    try {
      const body = await request.json();
      const sourceId = await ctx.runMutation(api.me.addSource, {
        clerkId: auth.userId,
        sourceType: body.sourceType,
        sourceUrl: body.sourceUrl,
      });
      return json({ sourceId });
    } catch (err) {
      return json(
        { error: err instanceof Error ? err.message : "Failed to add source" },
        500
      );
    }
  }),
});

// GET /api/v1/me/sources — List sources
http.route({
  path: "/api/v1/me/sources",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;

    const sources = await ctx.runQuery(api.me.getSources, {
      clerkId: auth.userId,
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

    const analytics = await ctx.runQuery(api.me.getAnalytics, {
      clerkId: auth.userId,
    });

    return json(analytics);
  }),
});

// ============================================================
// CORS PREFLIGHT (catch-all for OPTIONS)
// ============================================================

const corsPreflight = httpAction(async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
});

http.route({ path: "/api/v1/profiles", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/check-username", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/ctx", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/bundle", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/publish", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/sources", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/analytics", method: "OPTIONS", handler: corsPreflight });

export default http;
