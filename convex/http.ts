import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

// GET /api/v1/profiles — Public you.json
http.route({
  path: "/api/v1/profiles",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const username = url.searchParams.get("username");

    if (!username) {
      return new Response(
        JSON.stringify({ error: "Username parameter required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const profile = await ctx.runQuery(api.profiles.getPublicProfile, {
      username,
    });

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
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
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=60",
        },
      });
    }

    // Default: return JSON
    return new Response(JSON.stringify(profile.youJson, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60",
      },
    });
  }),
});

// Context link endpoint — GET /ctx
http.route({
  path: "/ctx",
  method: "GET",
  handler: httpAction(async (_ctx, request) => {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token parameter required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // TODO: Implement context link resolution in Milestone 3
    return new Response(
      JSON.stringify({ error: "Context links not yet implemented" }),
      { status: 501, headers: { "Content-Type": "application/json" } }
    );
  }),
});

// CORS preflight
http.route({
  path: "/api/v1/profiles",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }),
});

export default http;
