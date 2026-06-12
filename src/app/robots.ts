import type { MetadataRoute } from "next";

/**
 * robots.txt — explicitly allow agent fetching of public brain context.
 *
 * Critical: /ctx/ and /api/v1/profiles MUST be allowed for AI agents.
 * The whole point of you.md is "agents fetch your public brain from a URL."
 * Blocking these endpoints with robots.txt makes the product useless.
 *
 * We disallow internal app routes (/shell, /initialize, /dashboard) because
 * those need authentication and are not meant for crawling.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/docs",
          "/llms.txt",
          "/llms-full.txt",
          "/.well-known/mcp.json",
          "/api/v1/docs/reference",
          "/api/v1/docs/openapi.json",
          "/api/v1/mcp",
          "/api/v1/profiles",
          "/api/v1/skills",
          "/ctx/",
          "/schema/",
        ],
        disallow: ["/shell", "/initialize", "/dashboard", "/api/v1/me"],
      },
      // Explicit allow for known AI agents to make it crystal clear
      {
        userAgent: [
          "ClaudeBot",
          "Claude-Web",
          "ChatGPT-User",
          "GPTBot",
          "OAI-SearchBot",
          "PerplexityBot",
          "Google-Extended",
          "Gemini",
          "Anthropic-AI",
          "cohere-ai",
        ],
        allow: [
          "/",
          "/docs",
          "/llms.txt",
          "/llms-full.txt",
          "/.well-known/mcp.json",
          "/api/v1/docs/reference",
          "/api/v1/docs/openapi.json",
          "/api/v1/mcp",
          "/ctx/",
          "/api/v1/profiles",
          "/api/v1/skills",
          "/schema/",
        ],
        disallow: ["/shell", "/initialize", "/dashboard", "/api/v1/me"],
      },
    ],
    sitemap: "https://www.you.md/sitemap.xml",
  };
}
