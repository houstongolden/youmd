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
      const usernames = profiles.map((p: { username: string }) => ({
        username: p.username,
        updatedAt: (p as any).updatedAt || (p as any).createdAt || null,
      }));
      return json(usernames, 200, { "Cache-Control": "public, max-age=300" });
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

    // Merge profile-level fields into youJson for richer SEO data
    const enrichedJson = {
      ...(profile.youJson as Record<string, unknown>),
      _profile: {
        avatarUrl: profile.avatarUrl ?? null,
        displayName: profile.displayName ?? null,
        isClaimed: profile.isClaimed ?? false,
        source: profile.source,
      },
    };
    return json(enrichedJson, 200, { "Cache-Control": "public, max-age=60" });
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

    const raw = await ctx.runQuery(api.contextLinks.resolveLink, { token });
    const result = raw as Record<string, unknown>;

    if ("error" in result) {
      return json({ error: result.error }, (result.status as number) || 400);
    }

    // Increment use count
    await ctx.runMutation(api.contextLinks.incrementUseCount, { token });

    // Record the view
    await ctx.runMutation(api.profiles.recordView, {
      username: result.username as string,
      referrer: request.headers.get("referer") ?? undefined,
      isAgentRead: true,
      isContextLink: true,
    });

    const accept = request.headers.get("accept") ?? "";

    // Return markdown if requested
    if (accept.includes("text/markdown") || accept.includes("text/plain")) {
      return new Response(result.markdown as string, {
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
      ...(result.bundle as Record<string, unknown>),
      ...(result.privateContext ? { privateContext: result.privateContext } : {}),
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
        parentHash: body.parentHash, // content-addressed version control
      });
      return json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save bundle";
      // Return 409 Conflict for ancestor mismatch (client needs to pull first)
      if (message.includes("ANCESTOR_MISMATCH")) {
        return json(
          {
            error: "ANCESTOR_MISMATCH",
            message,
          },
          409
        );
      }
      return json({ error: message }, 500);
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
      return json({ error: "No LLM API key configured" }, 500);
    }

    const systemMessage = messages.find((m) => m.role === "system");
    const conversationMessages = messages.filter((m) => m.role !== "system");

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

    // Helper: transform upstream SSE into our simplified format
    function transformStream(
      upstream: ReadableStream<Uint8Array>,
      extractText: (parsed: any) => string | null
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
            model: "claude-sonnet-4-6-20250520",
            max_tokens: 4096,
            temperature: 0.7,
            stream: true,
            system: systemMessage?.content || "",
            messages: conversationMessages.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
          }),
          signal: AbortSignal.timeout(90_000),
        });

        if (upstreamRes.ok && upstreamRes.body) {
          return sseResponse(transformStream(upstreamRes.body, (parsed) => {
            if (parsed.type === "content_block_delta" && parsed.delta?.text) return parsed.delta.text;
            if (parsed.type === "message_stop") return null;
            return null;
          }));
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
            model: "anthropic/claude-sonnet-4",
            messages,
            max_tokens: 4096,
            temperature: 0.7,
            stream: true,
          }),
          signal: AbortSignal.timeout(90_000),
        });

        if (upstreamRes.ok && upstreamRes.body) {
          return sseResponse(transformStream(upstreamRes.body, (parsed) => {
            return parsed.choices?.[0]?.delta?.content || null;
          }));
        }
      } catch (err) {
        return json({ error: err instanceof Error ? err.message : "Stream failed" }, 500);
      }
    }

    return json({ error: "No API key or all providers failed" }, 500);
  }),
});

// OPTIONS for /api/v1/chat/stream is registered below with other CORS preflight routes

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
      if (!result || !result.success) {
        return json({ success: false, error: (result as any)?.error || "Scrape returned no data" }, 400);
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

// POST /api/v1/verify-identity — Cross-reference scraped profiles via Perplexity Sonar Pro
http.route({
  path: "/api/v1/verify-identity",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const result = await ctx.runAction(api.chat.verifyIdentity, {
        name: body.name,
        username: body.username,
        scrapedSources: body.scrapedSources || [],
      });
      return json(result);
    } catch (err) {
      return json(
        { success: false, error: err instanceof Error ? err.message : "Verification failed" },
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

      // Normalize LinkedIn URL to ensure consistent format for Apify
      const slugMatch = linkedinUrl.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/);
      const normalizedUrl = slugMatch
        ? `https://www.linkedin.com/in/${slugMatch[1]}/`
        : linkedinUrl;

      // console.log(`LinkedIn enrichment: normalizing ${linkedinUrl} -> ${normalizedUrl}`);

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
        return json(
          { success: false, error: `Profile fetch failed: ${err.slice(0, 300)}` },
          502
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
        } catch (e) {
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
// CONTEXT LINK MANAGEMENT (authenticated)
// ============================================================

// POST /api/v1/me/context-links — Create a context link
http.route({
  path: "/api/v1/me/context-links",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;

    try {
      const body = await request.json();
      const result = await ctx.runMutation(api.contextLinks.createLink, {
        clerkId: auth.userId,
        scope: body.scope || "public",
        ttl: body.ttl || "7d",
        maxUses: body.maxUses,
      });
      return json(result);
    } catch (err) {
      return json(
        { error: err instanceof Error ? err.message : "Failed to create context link" },
        500
      );
    }
  }),
});

// GET /api/v1/me/context-links — List context links
http.route({
  path: "/api/v1/me/context-links",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;

    const links = await ctx.runQuery(api.contextLinks.listLinks, {
      clerkId: auth.userId,
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

    try {
      const body = await request.json();
      if (!body.linkId) {
        return json({ error: "linkId is required" }, 400);
      }
      await ctx.runMutation(api.contextLinks.revokeLink, {
        clerkId: auth.userId,
        linkId: body.linkId,
      });
      return json({ success: true });
    } catch (err) {
      return json(
        { error: err instanceof Error ? err.message : "Failed to revoke link" },
        500
      );
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

    try {
      const body = await request.json();
      const result = await ctx.runMutation(api.apiKeys.createKey, {
        clerkId: auth.userId,
        label: body.label,
        scopes: body.scopes || ["read:public"],
      });
      return json(result);
    } catch (err) {
      return json(
        { error: err instanceof Error ? err.message : "Failed to create API key" },
        500
      );
    }
  }),
});

// GET /api/v1/me/api-keys — List API keys
http.route({
  path: "/api/v1/me/api-keys",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;

    const keys = await ctx.runQuery(api.apiKeys.listKeys, {
      clerkId: auth.userId,
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

    try {
      const body = await request.json();
      if (!body.keyId) {
        return json({ error: "keyId is required" }, 400);
      }
      await ctx.runMutation(api.apiKeys.revokeKey, {
        clerkId: auth.userId,
        keyId: body.keyId,
      });
      return json({ success: true });
    } catch (err) {
      return json(
        { error: err instanceof Error ? err.message : "Failed to revoke API key" },
        500
      );
    }
  }),
});

// ============================================================
// CLI AUTHENTICATION (email/password via Clerk Backend API)
// ============================================================

// POST /api/v1/auth/register — Create account from CLI
http.route({
  path: "/api/v1/auth/register",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { email, password, username, name } = body;

      if (!email || !password || !username) {
        return json({ error: "email, password, and username are required" }, 400);
      }

      // 1. Check username availability
      const usernameCheck = await ctx.runQuery(api.users.checkUsername, { username });
      if (!usernameCheck.available) {
        return json({ error: usernameCheck.reason || "Username not available" }, 409);
      }

      // 2. Create Clerk user via Backend API
      const clerkKey = process.env.CLERK_SECRET_KEY;
      if (!clerkKey) {
        return json({ error: "Auth service not configured" }, 500);
      }

      const clerkRes = await fetch("https://api.clerk.com/v1/users", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${clerkKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email_address: [email],
          password,
          username,
          first_name: name || username,
        }),
      });

      if (!clerkRes.ok) {
        const clerkError = await clerkRes.json();
        // Extract user-friendly error message from Clerk
        const errors = (clerkError as any).errors || [];
        const message =
          errors.length > 0
            ? errors.map((e: any) => e.long_message || e.message).join("; ")
            : "Failed to create account";
        return json({ error: message }, clerkRes.status === 422 ? 422 : 400);
      }

      const clerkUser = await clerkRes.json();
      const clerkId = (clerkUser as any).id;

      // 3. Create Convex user record (also creates profile)
      await ctx.runMutation(api.users.createUser, {
        clerkId,
        username: username.toLowerCase(),
        email,
        displayName: name || undefined,
      });

      // 4. Generate an API key for CLI access
      const keyResult = await ctx.runMutation(api.apiKeys.createKey, {
        clerkId,
        label: "cli-auth",
        scopes: ["read:public"],
      });

      return json({
        success: true,
        username: username.toLowerCase(),
        apiKey: keyResult.key,
        clerkId,
      });
    } catch (err) {
      return json(
        { error: err instanceof Error ? err.message : "Registration failed" },
        500
      );
    }
  }),
});

// POST /api/v1/auth/login — Login from CLI with email/password
http.route({
  path: "/api/v1/auth/login",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { email, password } = body;

      if (!email || !password) {
        return json({ error: "email and password are required" }, 400);
      }

      const clerkKey = process.env.CLERK_SECRET_KEY;
      if (!clerkKey) {
        return json({ error: "Auth service not configured" }, 500);
      }

      // 1. Look up user by email in Clerk
      const lookupRes = await fetch(
        `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`,
        {
          headers: { Authorization: `Bearer ${clerkKey}` },
        }
      );

      if (!lookupRes.ok) {
        return json({ error: "Failed to look up user" }, 500);
      }

      const users = (await lookupRes.json()) as any[];
      if (!users || users.length === 0) {
        return json({ error: "No account found with that email. Run `youmd register` to create one." }, 401);
      }

      const clerkUser = users[0];
      const clerkUserId = clerkUser.id;

      // 2. Verify password via Clerk Backend API
      const verifyRes = await fetch(
        `https://api.clerk.com/v1/users/${clerkUserId}/verify_password`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${clerkKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password }),
        }
      );

      if (!verifyRes.ok) {
        const verifyBody = await verifyRes.json();
        const verified = (verifyBody as any).verified;
        if (verified === false) {
          return json({ error: "Incorrect password" }, 401);
        }
        return json({ error: "Password verification failed" }, 401);
      }

      const verifyBody = await verifyRes.json();
      if (!(verifyBody as any).verified) {
        return json({ error: "Incorrect password" }, 401);
      }

      // 3. Find the Convex user by clerkId
      const convexUser = await ctx.runQuery(api.users.getByClerkId, { clerkId: clerkUserId });

      if (!convexUser) {
        // User exists in Clerk but not in Convex — create the Convex record
        const clerkUsername =
          clerkUser.username ||
          email.split("@")[0].toLowerCase().replace(/[^a-z0-9-]/g, "-");

        await ctx.runMutation(api.users.createUser, {
          clerkId: clerkUserId,
          username: clerkUsername,
          email,
          displayName: clerkUser.first_name || undefined,
        });
      }

      // Re-fetch to get the user with _id
      const user = await ctx.runQuery(api.users.getByClerkId, { clerkId: clerkUserId });
      if (!user) {
        return json({ error: "Failed to resolve user account" }, 500);
      }

      // 4. Generate API key — revoke old CLI keys first to avoid free-plan limit
      let keyResult;
      try {
        // Try to revoke any existing cli-auth keys first
        // For free plan: revoke all existing keys so we can create a fresh one
        const existingKeys = await ctx.runQuery(api.apiKeys.listKeys, { clerkId: clerkUserId });
        for (const k of existingKeys) {
          if (!k.isRevoked) {
            await ctx.runMutation(api.apiKeys.revokeKey, { clerkId: clerkUserId, keyId: k.id });
          }
        }
        keyResult = await ctx.runMutation(api.apiKeys.createKey, {
          clerkId: clerkUserId,
          label: "cli-auth",
          scopes: ["read:public"],
        });
      } catch {
        // If key creation still fails (non-cli key exists), return without a key
        return json({
          success: true,
          username: user.username,
          plan: user.plan,
          apiKey: null,
          message: "Logged in but could not generate API key. You already have an active key — use it with `youmd login --key YOUR_KEY`.",
        });
      }

      return json({
        success: true,
        username: user.username,
        apiKey: keyResult.key,
        plan: user.plan,
      });
    } catch (err) {
      // If the error is about free plan key limits, find and return existing key info
      const errMsg = err instanceof Error ? err.message : "Login failed";
      if (errMsg.includes("Free plan allows 1 API key")) {
        // User already has a key — tell them to use it or revoke the old one
        return json(
          { error: "You already have an API key. Use `youmd login --key YOUR_KEY` or revoke the old key at you.md/dashboard and try again." },
          409
        );
      }
      return json({ error: errMsg }, 500);
    }
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

    const user = await ctx.runQuery(api.users.getByClerkId, { clerkId: auth.userId });
    if (!user) return json({ error: "User not found" }, 404);

    // Find the user's profile
    const profile = await ctx.runQuery(api.profiles.getByOwnerId, { ownerId: user._id });
    if (!profile) return json(null);

    const privateCtx = await ctx.runQuery(api.private.getPrivateContext, {
      clerkId: auth.userId,
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

    const user = await ctx.runQuery(api.users.getByClerkId, { clerkId: auth.userId });
    if (!user) return json({ error: "User not found" }, 404);

    const profile = await ctx.runQuery(api.profiles.getByOwnerId, { ownerId: user._id });
    if (!profile) return json({ error: "Profile not found" }, 404);

    const body = await request.json();
    await ctx.runMutation(api.private.updatePrivateContext, {
      clerkId: auth.userId,
      profileId: profile._id,
      privateNotes: body.privateNotes,
      privateProjects: body.privateProjects,
      internalLinks: body.internalLinks,
      customData: body.customData,
    });

    return json({ success: true });
  }),
});

http.route({ path: "/api/v1/me/private", method: "OPTIONS", handler: corsPreflight });

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

// ── Skills Registry ──────────────────────────────────────────

// Browse published skills (public, no auth required)
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
        return json({ error: "Skill not found" }, 404);
      }
      return json(skill);
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

// Get my installed skills (authenticated)
http.route({
  path: "/api/v1/me/skills",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;

    const user = await ctx.runQuery(api.users.getByClerkId, { clerkId: auth.userId });
    if (!user) return json({ error: "User not found" }, 404);

    const installs = await ctx.runQuery(api.skills.listInstalls, { userId: user._id });
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

    let body: any;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    try {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return json({ error: "name is required (string)" }, 400);
      }
      if (typeof body.content !== "string" || !body.content.trim()) {
        return json({ error: "content is required (string)" }, 400);
      }
      if (body.name.length > 100) {
        return json({ error: "name must be 100 characters or less" }, 400);
      }
      if (body.content.length > 50000) {
        return json({ error: "content must be 50KB or less" }, 400);
      }

      const result = await ctx.runMutation(api.skills.publish, {
        clerkId: auth.userId,
        name: body.name.trim(),
        description: typeof body.description === "string" ? body.description.slice(0, 500) : "",
        version: typeof body.version === "string" ? body.version.slice(0, 20) : "1.0.0",
        scope: ["shared", "project", "private"].includes(body.scope) ? body.scope : "shared",
        identityFields: Array.isArray(body.identityFields) ? body.identityFields.filter((f: unknown) => typeof f === "string").slice(0, 20) : [],
        content: body.content,
      });

      return json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to publish skill";
      if (message.includes("already taken")) return json({ error: message }, 409);
      return json({ error: message }, 500);
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

    let body: any;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    try {
      if (typeof body.skillName !== "string" || !body.skillName.trim()) {
        return json({ error: "skillName is required (string)" }, 400);
      }

      const result = await ctx.runMutation(api.skills.recordInstall, {
        clerkId: auth.userId,
        skillName: body.skillName.trim().slice(0, 100),
        source: typeof body.source === "string" ? body.source.slice(0, 200) : "cli",
        scope: typeof body.scope === "string" ? body.scope.slice(0, 20) : "shared",
        identityFields: Array.isArray(body.identityFields) ? body.identityFields.filter((f: unknown) => typeof f === "string").slice(0, 20) : [],
      });

      return json(result);
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : "Failed" }, 500);
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

    let body: any;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    try {
      if (typeof body.skillName !== "string" || !body.skillName.trim()) {
        return json({ error: "skillName is required (string)" }, 400);
      }

      const result = await ctx.runMutation(api.skills.trackUsage, {
        clerkId: auth.userId,
        skillName: body.skillName.trim(),
      });

      return json(result);
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : "Failed" }, 500);
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

    let body: any;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    try {
      if (typeof body.skillName !== "string" || !body.skillName.trim()) {
        return json({ error: "skillName is required (string)" }, 400);
      }

      const result = await ctx.runMutation(api.skills.removeInstall, {
        clerkId: auth.userId,
        skillName: body.skillName.trim(),
      });

      return json(result);
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : "Failed" }, 500);
    }
  }),
});

http.route({
  path: "/api/v1/me/skills/remove",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })),
});

export default http;
