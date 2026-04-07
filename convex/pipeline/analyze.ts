"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  VOICE_ANALYSIS_PROMPT,
  TOPICS_ANALYSIS_PROMPT,
  BIO_VARIANTS_PROMPT,
  FAQ_PROMPT,
} from "./prompts";

// ---------------------------------------------------------------------------
// OpenRouter LLM call helpers (shared via convex/lib/openrouter.ts)
// ---------------------------------------------------------------------------

import { callOpenRouter as _callOpenRouter, parseJsonResponse } from "../lib/openrouter";
export { parseJsonResponse };

// Analysis actions use slightly different defaults than extraction
const ANALYSIS_OPTIONS = { temperature: 0.3, timeout: 90_000 };

async function callOpenRouter(
  apiKey: string,
  systemPrompt: string,
  userContent: string
): Promise<string> {
  return _callOpenRouter(apiKey, systemPrompt, userContent, ANALYSIS_OPTIONS);
}

// ---------------------------------------------------------------------------
// Helper: build context string from all extracted source data
// ---------------------------------------------------------------------------

function buildExtractedContext(
  sources: Array<{ sourceType: string; extracted: unknown }>
): string {
  const sections: string[] = [];
  for (const source of sources) {
    if (!source.extracted) continue;
    sections.push(
      `--- Source: ${source.sourceType} ---\n${JSON.stringify(source.extracted, null, 2)}`
    );
  }
  return sections.join("\n\n");
}

// ---------------------------------------------------------------------------
// analyzeVoice — Generate author voice profile
// ---------------------------------------------------------------------------

export const analyzeVoice = internalAction({
  args: {
    userId: v.id("users"),
    extractedSources: v.array(
      v.object({
        sourceType: v.string(),
        extracted: v.any(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

    const context = buildExtractedContext(args.extractedSources);
    const userMessage = `Here is all the extracted identity data from multiple sources:\n\n${context}\n\nGenerate the author voice profile as specified.`;

    const responseText = await callOpenRouter(
      apiKey,
      VOICE_ANALYSIS_PROMPT,
      userMessage
    );
    const content = parseJsonResponse(responseText);

    await ctx.runMutation(internal.pipeline.mutations.upsertAnalysisArtifact, {
      userId: args.userId,
      artifactType: "author_voice",
      content,
    });

    return { success: true, content };
  },
});

// ---------------------------------------------------------------------------
// analyzeTopics — Generate topic/expertise map
// ---------------------------------------------------------------------------

export const analyzeTopics = internalAction({
  args: {
    userId: v.id("users"),
    extractedSources: v.array(
      v.object({
        sourceType: v.string(),
        extracted: v.any(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

    const context = buildExtractedContext(args.extractedSources);
    const userMessage = `Here is all the extracted identity data from multiple sources:\n\n${context}\n\nGenerate the topic and expertise map as specified.`;

    const responseText = await callOpenRouter(
      apiKey,
      TOPICS_ANALYSIS_PROMPT,
      userMessage
    );
    const content = parseJsonResponse(responseText);

    await ctx.runMutation(internal.pipeline.mutations.upsertAnalysisArtifact, {
      userId: args.userId,
      artifactType: "topic_map",
      content,
    });

    return { success: true, content };
  },
});

// ---------------------------------------------------------------------------
// generateBioVariants — Generate short / medium / long bios
// ---------------------------------------------------------------------------

export const generateBioVariants = internalAction({
  args: {
    userId: v.id("users"),
    extractedSources: v.array(
      v.object({
        sourceType: v.string(),
        extracted: v.any(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

    const context = buildExtractedContext(args.extractedSources);
    const userMessage = `Here is all the extracted identity data from multiple sources:\n\n${context}\n\nGenerate the bio variants as specified.`;

    const responseText = await callOpenRouter(
      apiKey,
      BIO_VARIANTS_PROMPT,
      userMessage
    );
    const content = parseJsonResponse(responseText);

    await ctx.runMutation(internal.pipeline.mutations.upsertAnalysisArtifact, {
      userId: args.userId,
      artifactType: "bio_variants",
      content,
    });

    return { success: true, content };
  },
});

// ---------------------------------------------------------------------------
// generateFaq — Generate predicted FAQ
// ---------------------------------------------------------------------------

export const generateFaq = internalAction({
  args: {
    userId: v.id("users"),
    extractedSources: v.array(
      v.object({
        sourceType: v.string(),
        extracted: v.any(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

    const context = buildExtractedContext(args.extractedSources);
    const userMessage = `Here is all the extracted identity data from multiple sources:\n\n${context}\n\nGenerate the predicted FAQ as specified.`;

    const responseText = await callOpenRouter(apiKey, FAQ_PROMPT, userMessage);
    const content = parseJsonResponse(responseText);

    await ctx.runMutation(internal.pipeline.mutations.upsertAnalysisArtifact, {
      userId: args.userId,
      artifactType: "faq",
      content,
    });

    return { success: true, content };
  },
});
