import { NextResponse } from "next/server";

const PROTECTED_ROUTE_PATTERNS = [/^\/dashboard(?:\/.*)?$/, /^\/shell(?:\/.*)?$/, /^\/initialize(?:\/.*)?$/];

// AI agent/LLM User-Agent patterns — these get plain text identity context.
// EXCLUDES social card crawlers (need OG tags from HTML) and search engines (need to index HTML).
const AI_AGENT_UA_PATTERNS = [
  /claudebot/i, /chatgpt-user/i, /gptbot/i, /openai/i, /anthropic/i,
  /perplexity/i, /cohere/i, /google-extended/i,
  /gemini/i, /google-gemini/i, /googleother/i,
  /dify/i, /langchain/i, /llama/i, /mistral/i,
  /phind/i, /you\.com/i, /meta-externalagent/i,
  /copilot/i, /github-copilot/i,
  // Programmatic fetchers (developers, agents, scripts)
  /python-requests/i, /python-urllib/i, /node-fetch/i, /undici/i, /axios/i, /go-http/i,
  /httpie/i, /wget/i,
];

// These crawlers MUST get HTML (for OG cards, SEO indexing).
// Do NOT intercept them with plain text.
// Includes: facebookexternalhit, twitterbot, linkedinbot, googlebot, bingbot,
// applebot, slackbot, discordbot, curl (often used for testing HTML)

// Routes that are definitely NOT profile usernames
const RESERVED_PATHS = new Set([
  "", "api", "create", "claim", "dashboard", "docs", "initialize",
  "profiles", "reset-password", "sign-in", "sign-up", "ctx", "_next", "icon.svg",
]);

function isAgentRequest(req: Request): boolean {
  const accept = req.headers.get("accept") || "";
  // Explicit text/plain or text/markdown request = agent
  if (accept.includes("text/plain") || accept.includes("text/markdown")) {
    // But not if they also want text/html (normal browser)
    if (!accept.includes("text/html")) return true;
  }
  // Check User-Agent for known AI agent bots (NOT social/SEO crawlers)
  const ua = req.headers.get("user-agent") || "";
  return AI_AGENT_UA_PATTERNS.some((p) => p.test(ua));
}

export default async function middleware(req: Request & { nextUrl: URL; cookies: { get(name: string): { value: string } | undefined } }) {
  const isProtectedRoute = PROTECTED_ROUTE_PATTERNS.some((pattern) =>
    pattern.test(req.nextUrl.pathname)
  );

  if (isProtectedRoute) {
    const sessionCookie = req.cookies.get("youmd_session")?.value;
    if (!sessionCookie) {
      const signInUrl = new URL("/sign-in", req.url);
      signInUrl.searchParams.set("redirect_url", req.url);
      return NextResponse.redirect(signInUrl);
    }
  }

  // Agent/bot interception for profile pages
  const { pathname } = req.nextUrl;
  const segments = pathname.split("/").filter(Boolean);

  // Only intercept /{username} (single segment, not reserved)
  if (segments.length === 1 && !RESERVED_PATHS.has(segments[0])) {
    const username = segments[0];

    if (isAgentRequest(req)) {
      const convexSiteUrl =
        process.env.NEXT_PUBLIC_CONVEX_URL?.replace(".cloud", ".site") ||
        "https://kindly-cassowary-600.convex.site";

      try {
        const res = await fetch(
          `${convexSiteUrl}/api/v1/profiles?username=${encodeURIComponent(username)}`,
          {
            headers: { Accept: "text/plain" },
            signal: AbortSignal.timeout(10_000),
          }
        );

        if (res.ok) {
          const body = await res.text();
          return new NextResponse(body, {
            status: 200,
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "public, max-age=60, s-maxage=300",
              "X-Robots-Tag": "noindex",
              // Tell agents about machine-readable alternatives
              "Link": `<https://you.md/${username}/you.json>; rel="alternate"; type="application/json", <https://you.md/${username}/you.txt>; rel="alternate"; type="text/plain"`,
            },
          });
        }
      } catch {
        // Fall through to normal page render on error
      }
    }
  }
}

export const config = {
  matcher: [
    // Run middleware on everything except:
    //   - _next internals
    //   - /ctx/ routes (have their own proxy handler, never need Clerk auth)
    //   - /[username]/you.{json,txt,md} public agent endpoints (have their own
    //     route handlers, never need Clerk auth — excluding here keeps Clerk
    //     debug headers off public agent-facing API responses)
    //   - static asset extensions
    "/((?!_next|ctx/|[^/]+/you\\.(?:json|txt|md)$|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
