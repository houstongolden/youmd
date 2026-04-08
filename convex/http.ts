import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { detectAgent } from "./lib/agentDetect";

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
      const ownerUser = await ctx.runQuery(api.users.getByUsername, { username });
      if (ownerUser) {
        const profileIdRaw = (profileAny.profileId as any) ?? undefined;
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
    if (accept.includes("text/markdown") || accept.includes("text/plain")) {
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

    return new Response(
      JSON.stringify(
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
      ),
      {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.you-md.v1+json",
          Link: SCHEMA_LINK_HEADER,
          ...CORS_HEADERS,
        },
      }
    );
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
        const before = await ctx.runQuery(api.me.getMyProfile, { clerkId: auth.userId });
        if (before?.latestBundle) {
          bundleVersionBefore = before.latestBundle.version;
          contentHashBefore = before.latestBundle.contentHash ?? undefined;
        }
      } catch {
        // best-effort
      }

      const result = await ctx.runMutation(api.me.saveBundleFromForm, {
        clerkId: auth.userId, // We'll need to adapt this
        profileData: body.profileData,
        parentHash: body.parentHash, // content-addressed version control
      });

      // Log successful bundle write
      try {
        const ownerUser = await ctx.runQuery(api.users.getByClerkId, {
          clerkId: auth.userId,
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

      return json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save bundle";

      // Log failed bundle write
      try {
        const ownerUser = await ctx.runQuery(api.users.getByClerkId, {
          clerkId: auth.userId,
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

    const startedAt = Date.now();
    const agent = detectAgent(request.headers.get("user-agent"));
    const agentSource = agent.source === "mcp" ? "mcp" : "api-key";

    try {
      const result = await ctx.runMutation(api.me.publishLatest, {
        clerkId: auth.userId,
      });

      try {
        const ownerUser = await ctx.runQuery(api.users.getByClerkId, {
          clerkId: auth.userId,
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
        }
      } catch {
        // swallow
      }

      return json(result);
    } catch (err) {
      return json(
        { error: err instanceof Error ? err.message : "Failed to publish" },
        500
      );
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

    try {
      const body = await request.json();
      const { portrait } = body;

      if (!portrait || !portrait.lines || !portrait.cols || !portrait.rows) {
        return json({ error: "portrait object with lines, cols, rows, format, sourceUrl required" }, 400);
      }

      // Find user's profile
      const user = await ctx.runQuery(api.users.getByClerkId, { clerkId: auth.userId });
      if (!user) return json({ error: "user not found" }, 404);

      const profile = await ctx.runQuery(api.profiles.getByOwnerId, { ownerId: user._id });
      if (!profile) return json({ error: "profile not found" }, 404);

      await ctx.runMutation(api.profiles.savePortrait, {
        profileId: profile._id,
        clerkId: auth.userId,
        portrait: {
          lines: portrait.lines,
          coloredLines: portrait.coloredLines,
          cols: portrait.cols,
          rows: portrait.rows,
          format: portrait.format || "block",
          sourceUrl: portrait.sourceUrl || "",
        },
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

      return json({ success: true });
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : "Failed to save portrait" }, 500);
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
          system: `you are the you.md identity agent. you MUST respond with ONLY a raw JSON object — no markdown, no code fences, no explanation. the you.md platform handles scraping, research, and profile updates for you — so acknowledge what the user wants and describe the steps the platform will take.

format: {"ack":"<1 casual sentence acknowledging their request>","plan":["<step 1>","<step 2>","<step 3>"]}

rules:
- ack must be casual, direct, 1 sentence max
- plan should have 2-4 steps describing what will happen
- never say you can't do something — the platform handles scraping, research, etc.
- never wrap in code fences or markdown
${context ? `\nuser context: ${context.slice(0, 500)}` : ""}`,
          messages: [{ role: "user", content: userMessage.slice(0, 500) }],
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
        return json({
          ack: typeof parsed.ack === "string" ? parsed.ack : "on it.",
          plan: Array.isArray(parsed.plan) ? parsed.plan.filter((s: unknown) => typeof s === "string").slice(0, 5) : [],
        }, 200, CORS_HEADERS);
      } catch {
        // If JSON parse fails, use the raw text as ack
        const cleanAck = text.replace(/```[\s\S]*```/g, "").replace(/[{}"\[\]]/g, "").trim();
        return json({ ack: cleanAck.slice(0, 100) || "on it.", plan: [] }, 200, CORS_HEADERS);
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
          signal: AbortSignal.timeout(45_000),
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
          signal: AbortSignal.timeout(45_000),
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

// POST /api/v1/chat/compact — Claude Code-style context compaction
http.route({
  path: "/api/v1/chat/compact",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { sessionId, messages, keepRecent } = body;

      if (!sessionId || !messages || !Array.isArray(messages)) {
        return json({ error: "sessionId and messages[] required" }, 400);
      }

      const result = await ctx.runAction(api.chat.compactSession, {
        sessionId,
        messages,
        keepRecent: keepRecent ?? 8,
      });

      return json(result);
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : "compaction failed" }, 500);
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
        name: body.name,
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

// ── Version History & Agent Activity ─────────────────────

// Get bundle version history (authenticated)
http.route({
  path: "/api/v1/me/history",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;

    const user = await ctx.runQuery(api.users.getByClerkId, { clerkId: auth.userId });
    if (!user) return json({ error: "User not found" }, 404);

    const history = await ctx.runQuery(api.bundles.getHistory, { userId: user._id });
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

    const url = new URL(request.url);
    const versionParam = url.searchParams.get("version");
    if (!versionParam) {
      return json({ error: "version query parameter is required" }, 400);
    }

    const version = Number(versionParam);
    if (!Number.isFinite(version) || !Number.isInteger(version) || version < 1) {
      return json({ error: "version must be a positive integer" }, 400);
    }

    const bundle = await ctx.runQuery(api.bundles.getBundleByVersion, {
      clerkId: auth.userId,
      version,
    });

    if (!bundle) {
      return json({ error: `Version ${version} not found` }, 404);
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

    let body: any;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

    if (typeof body.version !== "number") {
      return json({ error: "version is required (number)" }, 400);
    }

    try {
      const result = await ctx.runMutation(api.bundles.rollbackToVersion, {
        clerkId: auth.userId,
        targetVersion: body.version,
      });
      return json(result);
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : "Rollback failed" }, 500);
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

    try {
      const agents = await ctx.runQuery((api as any).activity.agentSummary, {
        clerkId: auth.userId,
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
// GET /api/v1/me/activity?limit=30&agent=Claude%20Code&action=read
http.route({
  path: "/api/v1/me/activity",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateRequest(ctx, request);
    if (auth instanceof Response) return auth;

    const url = new URL(request.url);
    const limitStr = url.searchParams.get("limit");
    const agent = url.searchParams.get("agent") || undefined;
    const action = url.searchParams.get("action") || undefined;
    const limit = limitStr ? parseInt(limitStr, 10) : 30;

    try {
      const activity = await ctx.runQuery((api as any).activity.listActivity, {
        clerkId: auth.userId,
        limit: Number.isFinite(limit) ? limit : 30,
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
      return json({ error: "Invalid JSON body" }, 400);
    }

    if (!body.agentName || !body.action) {
      return json({ error: "agentName and action required" }, 400);
    }

    try {
      const user = await ctx.runQuery(api.users.getByClerkId, { clerkId: auth.userId });
      if (!user) return json({ error: "User not found" }, 404);

      const profile = await ctx.runQuery(api.profiles.getByOwnerId, { ownerId: user._id });

      await ctx.runMutation((internal as any).activity.logActivity, {
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

      return json({ success: true });
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : "Failed to log activity" }, 500);
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

    try {
      const body = await request.json();
      if (!body.wrappedVaultKey || !body.vaultSalt || !body.vaultKeyIv) {
        return json({ error: "Missing wrappedVaultKey, vaultSalt, or vaultKeyIv" }, 400);
      }

      // Convert base64 strings to ArrayBuffer for Convex bytes fields
      const wrappedVaultKey = new ArrayBuffer(Buffer.from(body.wrappedVaultKey, "base64").length);
      new Uint8Array(wrappedVaultKey).set(Buffer.from(body.wrappedVaultKey, "base64"));

      const vaultSalt = new ArrayBuffer(Buffer.from(body.vaultSalt, "base64").length);
      new Uint8Array(vaultSalt).set(Buffer.from(body.vaultSalt, "base64"));

      const vaultKeyIv = new ArrayBuffer(Buffer.from(body.vaultKeyIv, "base64").length);
      new Uint8Array(vaultKeyIv).set(Buffer.from(body.vaultKeyIv, "base64"));

      const result = await ctx.runMutation(api.vault.initVault, {
        clerkId: auth.userId,
        wrappedVaultKey,
        vaultSalt,
        vaultKeyIv,
      });
      return json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to initialize vault";
      return json({ error: message }, 500);
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

    try {
      const body = await request.json();
      if (!body.encryptedMd || !body.encryptedJson || !body.iv) {
        return json({ error: "Missing encryptedMd, encryptedJson, or iv" }, 400);
      }

      const encryptedMd = new ArrayBuffer(Buffer.from(body.encryptedMd, "base64").length);
      new Uint8Array(encryptedMd).set(Buffer.from(body.encryptedMd, "base64"));

      const encryptedJson = new ArrayBuffer(Buffer.from(body.encryptedJson, "base64").length);
      new Uint8Array(encryptedJson).set(Buffer.from(body.encryptedJson, "base64"));

      const iv = new ArrayBuffer(Buffer.from(body.iv, "base64").length);
      new Uint8Array(iv).set(Buffer.from(body.iv, "base64"));

      const result = await ctx.runMutation(api.vault.saveEncryptedVault, {
        clerkId: auth.userId,
        encryptedMd,
        encryptedJson,
        iv,
      });
      return json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save vault data";
      return json({ error: message }, 500);
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

    try {
      const vault = await ctx.runQuery(api.vault.getEncryptedVault, {
        clerkId: auth.userId,
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
      const message = err instanceof Error ? err.message : "Failed to get vault data";
      return json({ error: message }, 500);
    }
  }),
});

http.route({ path: "/api/v1/me/vault", method: "OPTIONS", handler: corsPreflight });

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

    try {
      const user = await ctx.runQuery(api.users.getByClerkId, { clerkId: auth.userId });
      if (!user) return json({ error: "User not found" }, 404);

      const profile = await ctx.runQuery(api.profiles.getByOwnerId, { ownerId: user._id });
      if (!profile) return json({ verifications: [], message: "No profile found" });

      const verifications = await ctx.runQuery(api.profiles.listVerifications, { profileId: profile._id });
      return json({ verifications });
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : "Failed to get verifications" }, 500);
    }
  }),
});

http.route({ path: "/api/v1/me/verifications", method: "OPTIONS", handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })) });

export default http;
