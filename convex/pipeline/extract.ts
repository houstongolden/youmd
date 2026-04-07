"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { EXTRACTION_PROMPTS } from "./prompts";

// ---------------------------------------------------------------------------
// OpenRouter LLM call helpers (shared via convex/lib/openrouter.ts)
// ---------------------------------------------------------------------------

import { callOpenRouter, parseJsonResponse } from "../lib/openrouter";
export { callOpenRouter, parseJsonResponse };

// ---------------------------------------------------------------------------
// extractFromSource — LLM extraction for a single source
// ---------------------------------------------------------------------------

export const extractFromSource = internalAction({
  args: {
    sourceId: v.id("sources"),
    sourceType: v.string(),
    rawText: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.pipeline.mutations.updateSourceStatus, {
        sourceId: args.sourceId,
        status: "failed",
        errorMessage: "OPENROUTER_API_KEY not configured",
      });
      return { success: false, error: "OPENROUTER_API_KEY not configured" };
    }

    // Update status to extracting
    await ctx.runMutation(internal.pipeline.mutations.updateSourceStatus, {
      sourceId: args.sourceId,
      status: "extracting",
    });

    try {
      // Get the appropriate extraction prompt
      const prompt =
        EXTRACTION_PROMPTS[args.sourceType] ?? EXTRACTION_PROMPTS["website"];

      const userMessage = `Here is the raw content from a ${args.sourceType} source:\n\n---\n${args.rawText}\n---\n\nExtract the structured identity data as specified.`;

      const responseText = await callOpenRouter(apiKey, prompt, userMessage);
      const extracted = parseJsonResponse(responseText);

      // Store extracted data
      await ctx.runMutation(internal.pipeline.mutations.updateSourceExtracted, {
        sourceId: args.sourceId,
        extracted,
      });

      return { success: true, extracted };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown extraction error";
      await ctx.runMutation(internal.pipeline.mutations.updateSourceStatus, {
        sourceId: args.sourceId,
        status: "failed",
        errorMessage: `Extraction failed: ${message}`,
      });
      return { success: false, error: message };
    }
  },
});

// Note: callOpenRouter and parseJsonResponse are duplicated in analyze.ts
// because Convex bundles each "use node" action file independently.
// Cross-imports between action files are not supported.
