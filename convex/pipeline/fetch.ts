"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

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
// fetchWithApify — Use Apify actors for LinkedIn and X scraping
// ---------------------------------------------------------------------------

const APIFY_ACTORS: Record<string, string> = {
  linkedin: "anchor/linkedin-profile-scraper",
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
