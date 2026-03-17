"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { EXTRACTION_PROMPTS } from "./prompts";

// ---------------------------------------------------------------------------
// OpenRouter LLM call helper
// ---------------------------------------------------------------------------

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const EXTRACTION_MODEL = "anthropic/claude-sonnet-4";

async function callOpenRouter(
  apiKey: string,
  systemPrompt: string,
  userContent: string,
  model: string = EXTRACTION_MODEL
): Promise<string> {
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://you.md",
      "X-Title": "You.md Pipeline",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.2,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `OpenRouter API error ${response.status}: ${errorBody.slice(0, 500)}`
    );
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No content in OpenRouter response");
  }

  return content;
}

// ---------------------------------------------------------------------------
// Parse JSON from LLM response (handles markdown fences)
// ---------------------------------------------------------------------------

function parseJsonResponse(raw: string): Record<string, unknown> {
  let cleaned = raw.trim();

  // Strip markdown code fences if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`Failed to parse LLM JSON response: ${cleaned.slice(0, 200)}...`);
  }
}

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
