"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { computeRawSourceHash } from "../lib/sourceHashing";

// ---------------------------------------------------------------------------
// Helper: strip HTML to plain text / rough markdown
// ---------------------------------------------------------------------------

function htmlToText(html: string): string {
  let text = html;

  // Remove script and style blocks entirely
  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

  // Convert common structural tags to markdown equivalents
  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n");
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n");
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n");
  text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n");
  text = text.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, "\n##### $1\n");
  text = text.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, "\n###### $1\n");

  // Links: convert to markdown links
  text = text.replace(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");

  // Bold / italic
  text = text.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**");
  text = text.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*");

  // List items
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n");

  // Paragraphs and line breaks
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<\/tr>/gi, "\n");
  text = text.replace(/<\/td>/gi, " | ");
  text = text.replace(/<\/th>/gi, " | ");

  // Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode common HTML entities
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)));

  // Clean up whitespace
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.trim();

  return text;
}

function sourcePreview(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 500);
}

function extractHeadings(text: string): string[] {
  const headings = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^#{1,4}\s+/.test(line))
    .map((line) => line.replace(/^#{1,4}\s+/, "").trim())
    .filter(Boolean)
    .slice(0, 5);
  if (headings.length > 0) return headings;

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length >= 12 && line.length <= 120)
    .slice(0, 3);
}

// ---------------------------------------------------------------------------
// fetchWebsite — Fetch a URL, strip HTML, store in Convex
// ---------------------------------------------------------------------------

export const fetchWebsite = internalAction({
  args: {
    sourceId: v.id("sources"),
    url: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Update status to fetching
    await ctx.runMutation(internal.pipeline.mutations.updateSourceStatus, {
      sourceId: args.sourceId,
      status: "fetching",
    });

    try {
      const response = await fetch(args.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; YouMD/0.1; +https://you.md)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      // Store raw HTML in Convex file storage
      const rawBlob = new Blob([html], { type: "text/html" });
      const rawStorageId = await ctx.storage.store(rawBlob);

      // Convert to clean text
      const extractedText = htmlToText(html);

      // Truncate if extremely long (LLMs have context limits)
      const maxChars = 100_000;
      const trimmedText =
        extractedText.length > maxChars
          ? extractedText.slice(0, maxChars) + "\n\n[Content truncated]"
          : extractedText;

      // Update source with raw storage and extracted text
      await ctx.runMutation(internal.pipeline.mutations.updateSourceFetched, {
        sourceId: args.sourceId,
        rawStorageId,
        extractedText: trimmedText,
      });

      // Immutable-source ledger: content-address the raw HTML and append a new
      // version only when it changed (best-effort — never blocks the fetch).
      try {
        const contentHash = await computeRawSourceHash(html);
        await ctx.runMutation(internal.pipeline.mutations.recordRawSourceVersion, {
          sourceId: args.sourceId,
          rawStorageId,
          contentHash,
          fetchedAt: Date.now(),
          contentLength: trimmedText.length,
          contentPreview: sourcePreview(trimmedText),
          contentHeadings: extractHeadings(trimmedText),
        });
      } catch {
        // Versioning is additive provenance; ignore failures here.
      }

      return { success: true, textLength: trimmedText.length };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown fetch error";
      await ctx.runMutation(internal.pipeline.mutations.updateSourceStatus, {
        sourceId: args.sourceId,
        status: "failed",
        errorMessage: `Fetch failed: ${message}`,
      });
      return { success: false, error: message };
    }
  },
});

// ---------------------------------------------------------------------------
// fetchWithFirecrawl — Use Firecrawl for markdown-first source refreshes
// ---------------------------------------------------------------------------

export const fetchWithFirecrawl = internalAction({
  args: {
    sourceId: v.id("sources"),
    url: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.pipeline.mutations.updateSourceStatus, {
        sourceId: args.sourceId,
        status: "failed",
        errorMessage: "FIRECRAWL_API_KEY not configured",
      });
      return { success: false, error: "FIRECRAWL_API_KEY not configured" };
    }

    await ctx.runMutation(internal.pipeline.mutations.updateSourceStatus, {
      sourceId: args.sourceId,
      status: "fetching",
    });

    try {
      const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: args.url,
          formats: ["markdown", "html"],
          onlyMainContent: true,
        }),
        signal: AbortSignal.timeout(90_000),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Firecrawl API error ${response.status}: ${body.slice(0, 500)}`);
      }

      const result = await response.json() as {
        success?: boolean;
        data?: {
          markdown?: string;
          html?: string;
          metadata?: Record<string, unknown>;
        };
      };
      if (result.success === false) {
        throw new Error("Firecrawl scrape returned success=false");
      }

      const markdown = result.data?.markdown ?? "";
      const html = result.data?.html ?? "";
      const sourceText = markdown || htmlToText(html);
      if (!sourceText.trim()) {
        throw new Error("Firecrawl returned no markdown or HTML content");
      }

      const rawPayload = JSON.stringify(
        {
          provider: "firecrawl",
          url: args.url,
          markdown,
          html,
          metadata: result.data?.metadata ?? null,
        },
        null,
        2
      );
      const rawStorageId = await ctx.storage.store(
        new Blob([rawPayload], { type: "application/json" })
      );

      const maxChars = 100_000;
      const trimmedText =
        sourceText.length > maxChars
          ? sourceText.slice(0, maxChars) + "\n\n[Content truncated]"
          : sourceText;

      await ctx.runMutation(internal.pipeline.mutations.updateSourceFetched, {
        sourceId: args.sourceId,
        rawStorageId,
        extractedText: trimmedText,
      });

      try {
        const contentHash = await computeRawSourceHash(markdown || html || rawPayload);
        await ctx.runMutation(internal.pipeline.mutations.recordRawSourceVersion, {
          sourceId: args.sourceId,
          rawStorageId,
          contentHash,
          fetchedAt: Date.now(),
          contentLength: trimmedText.length,
          contentPreview: sourcePreview(trimmedText),
          contentHeadings: extractHeadings(trimmedText),
        });
      } catch {
        // Versioning is additive provenance; ignore failures here.
      }

      return { success: true, textLength: trimmedText.length };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Firecrawl error";
      await ctx.runMutation(internal.pipeline.mutations.updateSourceStatus, {
        sourceId: args.sourceId,
        status: "failed",
        errorMessage: `Firecrawl fetch failed: ${message}`,
      });
      return { success: false, error: message };
    }
  },
});

export const fetchWithAgentBrowser = internalAction({
  args: {
    sourceId: v.id("sources"),
    url: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.pipeline.mutations.updateSourceStatus, {
      sourceId: args.sourceId,
      status: "failed",
      errorMessage:
        "Agent-browser crawler requires a configured sandbox runner before execution",
    });
    return {
      success: false,
      error: `Agent-browser sandbox runner not configured for ${args.url}`,
    };
  },
});

// ---------------------------------------------------------------------------
// fetchWithApify — Use Apify actors for LinkedIn and X scraping
// ---------------------------------------------------------------------------

const APIFY_ACTORS: Record<string, string> = {
  linkedin: "anchor/linkedin-profile-scraper",
  linkedin_profile: "VhxlqQXRwhW8H5hNV", // apimaestro/linkedin-profile-detail
  linkedin_posts: "Wpp1BZ6yGWjySadk3", // supreme_coder/linkedin-post
  x: "apidojo/tweet-scraper",
};

export const fetchWithApify = internalAction({
  args: {
    sourceId: v.id("sources"),
    sourceType: v.string(),
    url: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.APIFY_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.pipeline.mutations.updateSourceStatus, {
        sourceId: args.sourceId,
        status: "failed",
        errorMessage: "APIFY_API_KEY not configured",
      });
      return { success: false, error: "APIFY_API_KEY not configured" };
    }

    const actorId = APIFY_ACTORS[args.sourceType];
    if (!actorId) {
      await ctx.runMutation(internal.pipeline.mutations.updateSourceStatus, {
        sourceId: args.sourceId,
        status: "failed",
        errorMessage: `No Apify actor configured for source type: ${args.sourceType}`,
      });
      return {
        success: false,
        error: `No Apify actor for: ${args.sourceType}`,
      };
    }

    // Update status to fetching
    await ctx.runMutation(internal.pipeline.mutations.updateSourceStatus, {
      sourceId: args.sourceId,
      status: "fetching",
    });

    try {
      // Build actor-specific input
      const actorInput = buildApifyInput(args.sourceType, args.url);

      // Start the Apify actor run (synchronous mode — waits for completion)
      const runResponse = await fetch(
        `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(actorInput),
          signal: AbortSignal.timeout(120_000), // 2-minute timeout for scraping
        }
      );

      if (!runResponse.ok) {
        const errorBody = await runResponse.text();
        throw new Error(
          `Apify API error ${runResponse.status}: ${errorBody.slice(0, 500)}`
        );
      }

      const results = await runResponse.json();

      // Store raw results in file storage
      const rawBlob = new Blob([JSON.stringify(results, null, 2)], {
        type: "application/json",
      });
      const rawStorageId = await ctx.storage.store(rawBlob);

      // Convert Apify results to text for extraction
      const extractedText = JSON.stringify(results, null, 2);
      const maxChars = 100_000;
      const trimmedText =
        extractedText.length > maxChars
          ? extractedText.slice(0, maxChars) + "\n\n[Content truncated]"
          : extractedText;

      await ctx.runMutation(internal.pipeline.mutations.updateSourceFetched, {
        sourceId: args.sourceId,
        rawStorageId,
        extractedText: trimmedText,
      });

      // Immutable-source ledger (best-effort, additive).
      try {
        const contentHash = await computeRawSourceHash(JSON.stringify(results, null, 2));
        await ctx.runMutation(internal.pipeline.mutations.recordRawSourceVersion, {
          sourceId: args.sourceId,
          rawStorageId,
          contentHash,
          fetchedAt: Date.now(),
          contentLength: trimmedText.length,
          contentPreview: sourcePreview(trimmedText),
          contentHeadings: extractHeadings(trimmedText),
        });
      } catch {
        // ignore — versioning is additive provenance
      }

      return { success: true, resultCount: Array.isArray(results) ? results.length : 1 };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Apify error";
      await ctx.runMutation(internal.pipeline.mutations.updateSourceStatus, {
        sourceId: args.sourceId,
        status: "failed",
        errorMessage: `Apify fetch failed: ${message}`,
      });
      return { success: false, error: message };
    }
  },
});

// ---------------------------------------------------------------------------
// Apify input builders per source type
// ---------------------------------------------------------------------------

function buildApifyInput(
  sourceType: string,
  url: string
): Record<string, unknown> {
  switch (sourceType) {
    case "linkedin":
      return {
        profileUrls: [url],
        proxyConfiguration: { useApifyProxy: true },
      };
    case "x":
      // Extract handle from URL for tweet scraper
      const handleMatch = url.match(
        /(?:twitter\.com|x\.com)\/([^/?]+)/
      );
      const handle = handleMatch ? handleMatch[1] : url;
      return {
        handle,
        tweetsDesired: 50,
        proxyConfiguration: { useApifyProxy: true },
      };
    default:
      return { startUrls: [{ url }] };
  }
}

// ---------------------------------------------------------------------------
// fetchLinkedInFull — Fetch LinkedIn profile + posts via two Apify actors
// ---------------------------------------------------------------------------

export const fetchLinkedInFull = internalAction({
  args: {
    sourceId: v.id("sources"),
    linkedinUrl: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.APIFY_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.pipeline.mutations.updateSourceStatus, {
        sourceId: args.sourceId,
        status: "failed",
        errorMessage: "APIFY_API_KEY not configured",
      });
      return { success: false, error: "APIFY_API_KEY not configured" };
    }

    await ctx.runMutation(internal.pipeline.mutations.updateSourceStatus, {
      sourceId: args.sourceId,
      status: "fetching",
    });

    try {
      const profileActorId = APIFY_ACTORS.linkedin_profile;
      const postsActorId = APIFY_ACTORS.linkedin_posts;

      // Run both actors in parallel
      const [profileResults, postsResults] = await Promise.all([
        // Profile actor
        fetch(
          `https://api.apify.com/v2/acts/${profileActorId}/run-sync-get-dataset-items?token=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              profileUrls: [args.linkedinUrl],
            }),
            signal: AbortSignal.timeout(120_000),
          }
        ).then(async (res) => {
          if (!res.ok) {
            const body = await res.text();
            throw new Error(`Profile actor error ${res.status}: ${body.slice(0, 500)}`);
          }
          return res.json();
        }),

        // Posts actor
        fetch(
          `https://api.apify.com/v2/acts/${postsActorId}/run-sync-get-dataset-items?token=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              profileUrl: args.linkedinUrl,
              maxPosts: 20,
              rawData: true,
            }),
            signal: AbortSignal.timeout(120_000),
          }
        ).then(async (res) => {
          if (!res.ok) {
            const body = await res.text();
            throw new Error(`Posts actor error ${res.status}: ${body.slice(0, 500)}`);
          }
          return res.json();
        }),
      ]);

      // Combine into one result
      const combined = {
        profile: Array.isArray(profileResults) ? profileResults[0] ?? null : profileResults,
        posts: Array.isArray(postsResults) ? postsResults : [],
        fetchedAt: new Date().toISOString(),
      };

      // Store raw results in file storage
      const rawBlob = new Blob([JSON.stringify(combined, null, 2)], {
        type: "application/json",
      });
      const rawStorageId = await ctx.storage.store(rawBlob);

      // Convert to text for pipeline consumption
      const extractedText = JSON.stringify(combined, null, 2);
      const maxChars = 100_000;
      const trimmedText =
        extractedText.length > maxChars
          ? extractedText.slice(0, maxChars) + "\n\n[Content truncated]"
          : extractedText;

      await ctx.runMutation(internal.pipeline.mutations.updateSourceFetched, {
        sourceId: args.sourceId,
        rawStorageId,
        extractedText: trimmedText,
      });

      // Immutable-source ledger (best-effort). Hash the substantive content
      // only — exclude the volatile fetchedAt so re-fetching identical
      // profile/posts does not spuriously create a new version.
      try {
        const contentHash = await computeRawSourceHash(
          JSON.stringify({ profile: combined.profile, posts: combined.posts })
        );
        await ctx.runMutation(internal.pipeline.mutations.recordRawSourceVersion, {
          sourceId: args.sourceId,
          rawStorageId,
          contentHash,
          fetchedAt: Date.now(),
          contentLength: trimmedText.length,
          contentPreview: sourcePreview(trimmedText),
          contentHeadings: extractHeadings(trimmedText),
        });
      } catch {
        // ignore — versioning is additive provenance
      }

      return {
        success: true,
        profileFound: !!combined.profile,
        postsCount: combined.posts.length,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown LinkedIn fetch error";
      await ctx.runMutation(internal.pipeline.mutations.updateSourceStatus, {
        sourceId: args.sourceId,
        status: "failed",
        errorMessage: `LinkedIn full fetch failed: ${message}`,
      });
      return { success: false, error: message };
    }
  },
});
