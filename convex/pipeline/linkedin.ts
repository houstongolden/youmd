"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

// ---------------------------------------------------------------------------
// LinkedIn Voice Analysis — generates voice.linkedin.md content
// ---------------------------------------------------------------------------

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "claude-sonnet-4-20250514";
const OPENROUTER_MODEL = "anthropic/claude-sonnet-4";

// ---------------------------------------------------------------------------
// LLM caller — tries Anthropic direct, falls back to OpenRouter
// ---------------------------------------------------------------------------

async function callLLM(
  systemPrompt: string,
  userContent: string
): Promise<string> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    try {
      return await callAnthropic(anthropicKey, systemPrompt, userContent);
    } catch (e) {
      // console.log("Anthropic API failed, falling back to OpenRouter:", e);
    }
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (!openrouterKey) {
    throw new Error("Neither ANTHROPIC_API_KEY nor OPENROUTER_API_KEY configured");
  }
  return await callOpenRouter(openrouterKey, systemPrompt, userContent);
}

async function callAnthropic(
  apiKey: string,
  systemPrompt: string,
  userContent: string
): Promise<string> {
  const response = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0.3,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errorBody.slice(0, 500)}`);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text;
  if (!content) {
    throw new Error("No content in Anthropic response");
  }
  return content;
}

async function callOpenRouter(
  apiKey: string,
  systemPrompt: string,
  userContent: string
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
      model: OPENROUTER_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.3,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${errorBody.slice(0, 500)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No content in OpenRouter response");
  }
  return content;
}

function parseJsonResponse(raw: string): Record<string, unknown> {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "");
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`Failed to parse LLM JSON response: ${cleaned.slice(0, 200)}...`);
  }
}

// ---------------------------------------------------------------------------
// Prompt for LinkedIn voice analysis
// ---------------------------------------------------------------------------

const LINKEDIN_VOICE_PROMPT = `You are an identity analysis engine for You.md. You specialize in analyzing LinkedIn communication patterns.

Given a LinkedIn profile and their recent posts, analyze their platform-specific voice and communication style.

Return a JSON object with the following structure:

{
  "linkedin_voice": "2-3 sentence summary of their overall communication style on LinkedIn",
  "recurring_themes": ["array of topics they consistently post about"],
  "tone": "primary tone descriptor (e.g., professional, casual, thought-leader, educational, motivational, contrarian, analytical)",
  "vocabulary_patterns": ["distinctive words, phrases, or jargon they frequently use"],
  "audience_style": "description of who they write for and how they engage their audience",
  "content_structure": "how they typically structure posts (e.g., hook + story + lesson, numbered lists, questions to audience, personal anecdotes, data-driven takes)",
  "positioning": "how they position themselves professionally on LinkedIn",
  "cta_patterns": ["common call-to-action patterns they use (e.g., 'Follow for more', 'What do you think?', 'DM me', 'Link in comments')"],
  "post_frequency_style": "how often and when they tend to post, if discernible",
  "engagement_patterns": "how they engage with comments and other posts, if visible"
}

Base this ONLY on evidence from the provided data. If a field has insufficient evidence, provide your best inference with a note like "(limited data)".

Return ONLY the JSON object, no markdown fences, no explanation.`;

// ---------------------------------------------------------------------------
// analyzeLinkedInVoice — Generate LinkedIn-specific voice analysis
// ---------------------------------------------------------------------------

export const analyzeLinkedInVoice = internalAction({
  args: {
    userId: v.id("users"),
    linkedinData: v.any(), // Combined profile + posts data
  },
  handler: async (ctx, args) => {
    const data = args.linkedinData;
    const userMessage = `Here is the LinkedIn profile and recent posts data:\n\n${JSON.stringify(data, null, 2)}\n\nAnalyze their LinkedIn-specific voice and communication patterns.`;

    const responseText = await callLLM(LINKEDIN_VOICE_PROMPT, userMessage);
    const content = parseJsonResponse(responseText);

    await ctx.runMutation(internal.pipeline.mutations.upsertAnalysisArtifact, {
      userId: args.userId,
      artifactType: "voice_linkedin",
      content,
    });

    return { success: true, content };
  },
});

// ---------------------------------------------------------------------------
// generateLinkedInVoiceDoc — Turn analysis into voice.linkedin.md markdown
// ---------------------------------------------------------------------------

export const generateLinkedInVoiceDoc = internalAction({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Read the voice_linkedin artifact
    const artifacts = await ctx.runMutation(
      internal.pipeline.mutations.getAnalysisArtifacts,
      { userId: args.userId }
    );

    const voiceArtifact = artifacts.find(
      (a: { artifactType: string; content: unknown }) =>
        a.artifactType === "voice_linkedin"
    );

    if (!voiceArtifact) {
      return { success: false, error: "No voice_linkedin artifact found" };
    }

    const v = voiceArtifact.content as Record<string, unknown>;
    const today = new Date().toISOString().split("T")[0];

    // Build the markdown document
    const themes = Array.isArray(v.recurring_themes)
      ? (v.recurring_themes as string[]).map((t) => `- ${t}`).join("\n")
      : "- (no data)";

    const vocabPatterns = Array.isArray(v.vocabulary_patterns)
      ? (v.vocabulary_patterns as string[]).map((p) => `- "${p}"`).join("\n")
      : "- (no data)";

    const ctaPatterns = Array.isArray(v.cta_patterns)
      ? (v.cta_patterns as string[]).map((c) => `- ${c}`).join("\n")
      : "- (no data)";

    const markdown = `---
title: "LinkedIn Voice Profile"
platform: linkedin
generated: ${today}
---

## Communication Style
${v.linkedin_voice || "(no data)"}

## Recurring Themes
${themes}

## Tone & Register
${v.tone || "(no data)"}

## Vocabulary Patterns
${vocabPatterns}

## Audience Style
${v.audience_style || "(no data)"}

## Content Structure
${v.content_structure || "(no data)"}

## Positioning
${v.positioning || "(no data)"}

## Call-to-Action Patterns
${ctaPatterns}
`;

    // Store the markdown doc as an artifact too
    await ctx.runMutation(internal.pipeline.mutations.upsertAnalysisArtifact, {
      userId: args.userId,
      artifactType: "voice_linkedin_doc",
      content: { markdown },
    });

    return { success: true, markdown };
  },
});
