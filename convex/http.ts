import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

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
// PIPELINE ENDPOINTS
// ============================================================

// POST /api/v1/me/build — Trigger the ingestion pipeline
http.route({
  path: "/api/v1/me/build",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;

    try {
      const result = await ctx.runMutation(api.pipeline.index.startPipeline, {
        clerkId: auth.userId,
      });
      return json(result);
    } catch (err) {
      return json(
        { error: err instanceof Error ? err.message : "Failed to start pipeline" },
        500
      );
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

    const status = await ctx.runQuery(api.pipeline.index.getPipelineStatus, {
      clerkId: auth.userId,
    });

    return json(status);
  }),
});

// ============================================================
// ONBOARDING CHAT PROXY (no auth — public, rate-limited by design)
// ============================================================

http.route({
  path: "/api/v1/chat",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const content = await ctx.runAction(api.chat.onboardingChat, {
        messages: body.messages,
      });
      return json({ content });
    } catch (err) {
      return json(
        { error: err instanceof Error ? err.message : "Chat failed" },
        500
      );
    }
  }),
});

// ============================================================
// PROFILE SCRAPING
// ============================================================

// POST /api/v1/scrape — Scrape a social profile by URL
http.route({
  path: "/api/v1/scrape",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const result = await ctx.runAction(api.scrape.scrapeProfile, {
        url: body.url,
        username: body.username,
        platform: body.platform,
      });
      if (!result.success) {
        return json({ success: false, error: result.error }, 400);
      }
      return json(result);
    } catch (err) {
      return json(
        {
          success: false,
          error: err instanceof Error ? err.message : "Scrape failed",
        },
        500
      );
    }
  }),
});

// ============================================================
// AI RESEARCH & ENRICHMENT
// ============================================================

// POST /api/v1/research — Auto-research a user via Perplexity
http.route({
  path: "/api/v1/research",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const result = await ctx.runAction(api.chat.researchUser, {
        name: body.name,
        username: body.username,
        email: body.email,
        links: body.links,
      });
      return json(result);
    } catch (err) {
      return json(
        { success: false, error: err instanceof Error ? err.message : "Research failed" },
        500
      );
    }
  }),
});

// POST /api/v1/enrich-x — Enrich X profile via XAI/Grok
http.route({
  path: "/api/v1/enrich-x",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const result = await ctx.runAction(api.chat.enrichXProfile, {
        xUsername: body.xUsername,
        profileData: body.profileData,
      });
      return json(result);
    } catch (err) {
      return json(
        { success: false, error: err instanceof Error ? err.message : "Enrichment failed" },
        500
      );
    }
  }),
});

// ============================================================
// LINKEDIN ENRICHMENT
// ============================================================

// POST /api/v1/enrich-linkedin — Full LinkedIn enrichment pipeline
http.route({
  path: "/api/v1/enrich-linkedin",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const linkedinUrl = body.linkedinUrl;

      if (!linkedinUrl || typeof linkedinUrl !== "string") {
        return json({ success: false, error: "linkedinUrl is required" }, 400);
      }

      // Validate it looks like a LinkedIn URL
      if (!linkedinUrl.includes("linkedin.com/in/")) {
        return json(
          { success: false, error: "Invalid LinkedIn URL. Expected format: https://linkedin.com/in/username" },
          400
        );
      }

      // If userId provided, look up user; otherwise run without pipeline storage
      let userId = body.userId;

      // Create a temporary source record if we have a userId
      let sourceId: string | undefined;
      if (userId) {
        sourceId = await ctx.runMutation(api.me.addSource, {
          clerkId: userId,
          sourceType: "linkedin_full",
          sourceUrl: linkedinUrl,
        });
      }

      // Fetch LinkedIn profile + posts via Apify
      const apiKey = process.env.APIFY_API_KEY;
      if (!apiKey) {
        return json({ success: false, error: "APIFY_API_KEY not configured" }, 500);
      }

      const profileActorId = "VhxlqQXRwhW8H5hNV";
      const postsActorId = "Wpp1BZ6yGWjySadk3";

      // Run both actors in parallel
      const [profileRes, postsRes] = await Promise.all([
        fetch(
          `https://api.apify.com/v2/acts/${profileActorId}/run-sync-get-dataset-items?token=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ profileUrls: [linkedinUrl] }),
            signal: AbortSignal.timeout(120_000),
          }
        ),
        fetch(
          `https://api.apify.com/v2/acts/${postsActorId}/run-sync-get-dataset-items?token=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              profileUrl: linkedinUrl,
              maxPosts: 20,
              rawData: true,
            }),
            signal: AbortSignal.timeout(120_000),
          }
        ),
      ]);

      if (!profileRes.ok) {
        const err = await profileRes.text();
        return json(
          { success: false, error: `Profile fetch failed: ${err.slice(0, 300)}` },
          502
        );
      }

      const profileData = await profileRes.json();
      const profile = Array.isArray(profileData) ? profileData[0] ?? null : profileData;

      let posts: unknown[] = [];
      if (postsRes.ok) {
        const postsData = await postsRes.json();
        posts = Array.isArray(postsData) ? postsData : [];
      } else {
        // Posts fetch is non-fatal
        console.log("Posts fetch failed, continuing with profile only");
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
        } catch (e) {
          console.log("Voice analysis failed:", e);
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
      return json(
        {
          success: false,
          error: err instanceof Error ? err.message : "LinkedIn enrichment failed",
        },
        500
      );
    }
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
http.route({ path: "/api/v1/me/build", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/build/status", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/me/memories", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/chat", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/scrape", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/research", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/enrich-x", method: "OPTIONS", handler: corsPreflight });
http.route({ path: "/api/v1/enrich-linkedin", method: "OPTIONS", handler: corsPreflight });

// ============================================================
// MEMORY API (authenticated — API key or access token)
// ============================================================

// GET /api/v1/me/memories — List memories
http.route({
  path: "/api/v1/me/memories",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;

    const url = new URL(request.url);
    const category = url.searchParams.get("category") || undefined;
    const limit = url.searchParams.has("limit") ? parseInt(url.searchParams.get("limit")!) : undefined;

    const user = await ctx.runQuery(api.users.getByClerkId, { clerkId: auth.userId });
    if (!user) return json({ error: "User not found" }, 404);

    const memories = await ctx.runQuery(api.memories.listMemories, {
      userId: user._id,
      category,
      limit,
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

    const body = await request.json();
    if (!body.memories || !Array.isArray(body.memories)) {
      return json({ error: "Request body must contain 'memories' array" }, 400);
    }

    const user = await ctx.runQuery(api.users.getByClerkId, { clerkId: auth.userId });
    if (!user) return json({ error: "User not found" }, 404);

    const result = await ctx.runMutation(api.memories.saveFromAgent, {
      userId: user._id,
      agentName: body.agentName || auth.username || "API",
      memories: body.memories,
    });

    return json(result);
  }),
});

export default http;
