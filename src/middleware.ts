import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/initialize(.*)"]);

// Known bot/agent User-Agent patterns
const BOT_UA_PATTERNS = [
  /bot/i, /crawl/i, /spider/i, /curl/i, /wget/i, /httpie/i,
  /python-requests/i, /python-urllib/i, /node-fetch/i, /undici/i, /axios/i, /go-http/i,
  /claudebot/i, /chatgpt/i, /gptbot/i, /openai/i, /anthropic/i,
  /perplexity/i, /cohere/i, /google-extended/i, /bingbot/i,
  /gemini/i, /google-gemini/i, /googleother/i,
  /applebot/i, /facebookexternalhit/i, /twitterbot/i,
  /linkedinbot/i, /slackbot/i, /discordbot/i,
  /ia_archiver/i, /semrush/i, /ahref/i, /mj12bot/i,
  /dify/i, /langchain/i, /llama/i, /mistral/i,
  /phind/i, /you\.com/i, /brave/i, /meta-externalagent/i,
  /copilot/i, /github-copilot/i,
];

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
  // Check User-Agent for known bots
  const ua = req.headers.get("user-agent") || "";
  return BOT_UA_PATTERNS.some((p) => p.test(ua));
}

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  // Agent/bot interception for profile pages
  const { pathname } = req.nextUrl;
  const segments = pathname.split("/").filter(Boolean);

  // Only intercept /{username} (single segment, not reserved)
  if (segments.length === 1 && !RESERVED_PATHS.has(segments[0])) {
    const username = segments[0];

    if (isAgentRequest(req)) {
      const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.replace(".cloud", ".site")
        || "https://kindly-cassowary-600.convex.site";

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
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
