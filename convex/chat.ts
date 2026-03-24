"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";

// ---------------------------------------------------------------------------
// Model routing configuration — right model for the right task
// ---------------------------------------------------------------------------

const MODELS = {
  // Primary chat — best quality for identity conversations
  chat_primary: { provider: "anthropic", model: "claude-sonnet-4-6-20250520" },
  chat_fallback: { provider: "openrouter", model: "anthropic/claude-sonnet-4" },
  // Research — Perplexity Sonar for fast web search with citations
  research: { provider: "perplexity", model: "sonar" },
  // Identity verification — Sonar Pro for deeper cross-referencing
  verify: { provider: "perplexity", model: "sonar-pro" },
  // X/Twitter enrichment — Grok has native X context
  x_enrichment: { provider: "xai", model: "grok-3-mini" },
  // Session summaries — Haiku for cost-efficient background tasks
  summary: { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
  // Fast classification — Haiku for quick routing decisions
  classify: { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
} as const;

/**
 * Chat proxy — routes LLM calls through the backend.
 * Uses Claude Sonnet 4.6 via Anthropic API (best quality).
 * Falls back to OpenRouter.
 */
export const onboardingChat = action({
  args: {
    messages: v.array(
      v.object({
        role: v.union(v.literal("system"), v.literal("user"), v.literal("assistant")),
        content: v.string(),
      })
    ),
  },
  handler: async (_ctx, args) => {
    // Try Anthropic API directly first (Claude Sonnet 4.6)
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      try {
        return await callAnthropic(anthropicKey, args.messages);
      } catch (err) {
        console.error("Anthropic API failed, falling back to OpenRouter:", err);
      }
    }

    // Fallback to OpenRouter
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (openrouterKey) {
      try {
        return await callOpenRouter(openrouterKey, args.messages);
      } catch (err) {
        console.error("OpenRouter API also failed:", err);
        throw err;
      }
    }

    throw new Error("No LLM API key configured. Set ANTHROPIC_API_KEY or OPENROUTER_API_KEY.");
  },
});

/**
 * Perplexity-powered research — auto-research a user from their name/links.
 * Returns a research summary that the agent can use to enrich the profile.
 */
export const researchUser = action({
  args: {
    name: v.string(),
    username: v.optional(v.string()),
    email: v.optional(v.string()),
    links: v.optional(v.array(v.string())),
  },
  handler: async (_ctx, args) => {
    const perplexityKey = process.env.PERPLEXITY_API_KEY;
    if (!perplexityKey) {
      return { success: false, error: "PERPLEXITY_API_KEY not configured" };
    }

    // Build a research query from available info
    const queryParts = [`Who is ${args.name}?`];
    if (args.username) queryParts.push(`Their username is @${args.username}.`);
    if (args.email) {
      const domain = args.email.split("@")[1];
      if (domain && !["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com"].includes(domain)) {
        queryParts.push(`They may be associated with ${domain}.`);
      }
    }
    if (args.links && args.links.length > 0) {
      queryParts.push(`Their online presence includes: ${args.links.join(", ")}.`);
    }
    queryParts.push("Provide a brief professional summary including their role, company, notable projects, and any public information about their work and interests.");

    try {
      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${perplexityKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [
            {
              role: "system",
              content: "You are a research assistant. Provide factual, concise information about the person described. Focus on their professional identity, role, company, projects, and public contributions. Be accurate — if you're not sure, say so. Keep it to 3-5 sentences.",
            },
            {
              role: "user",
              content: queryParts.join(" "),
            },
          ],
          max_tokens: 500,
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return { success: false, error: `Perplexity ${response.status}: ${errorBody.slice(0, 200)}` };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      return { success: true, research: content || "No results found." };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Research failed" };
    }
  },
});

/**
 * Identity verification — cross-references scraped data against web results.
 * Uses Perplexity Sonar Pro for deeper search + smart matching to confirm
 * that the person in the scraped profiles is actually the same person.
 * Returns a confidence score and any discrepancies found.
 */
export const verifyIdentity = action({
  args: {
    name: v.string(),
    username: v.optional(v.string()),
    scrapedSources: v.array(
      v.object({
        platform: v.string(),
        username: v.optional(v.string()),
        bio: v.optional(v.string()),
        company: v.optional(v.string()),
        location: v.optional(v.string()),
      })
    ),
  },
  handler: async (_ctx, args) => {
    const perplexityKey = process.env.PERPLEXITY_API_KEY;
    if (!perplexityKey) {
      return { success: false, error: "PERPLEXITY_API_KEY not configured" };
    }

    // Build cross-reference query from all scraped sources
    const sourceDetails = args.scrapedSources
      .map((s) => {
        const parts = [`${s.platform}: @${s.username || "unknown"}`];
        if (s.bio) parts.push(`bio: "${s.bio.slice(0, 100)}"`);
        if (s.company) parts.push(`company: ${s.company}`);
        if (s.location) parts.push(`location: ${s.location}`);
        return parts.join(", ");
      })
      .join("\n");

    try {
      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${perplexityKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODELS.verify.model,
          messages: [
            {
              role: "system",
              content: `You are an identity verification specialist. Given a name and scraped social profiles, determine if they all belong to the same person. Return a JSON object with:
- "confidence": number 0-100 (how confident these profiles belong to the same person)
- "match": boolean (true if likely same person)
- "signals": string[] (evidence supporting the match)
- "discrepancies": string[] (anything that doesn't match)
- "summary": string (1 sentence about who this person is)
Respond ONLY with valid JSON, no markdown.`,
            },
            {
              role: "user",
              content: `Verify if these social profiles all belong to "${args.name}"${args.username ? ` (username: @${args.username})` : ""}:\n\n${sourceDetails}`,
            },
          ],
          max_tokens: 400,
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(20_000),
      });

      if (!response.ok) {
        return { success: false, error: `Verification failed: ${response.status}` };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) return { success: false, error: "Empty verification response" };

      try {
        const result = JSON.parse(content);
        return { success: true, verification: result };
      } catch {
        // If not valid JSON, return the raw text as summary
        return { success: true, verification: { confidence: 50, match: true, signals: [], discrepancies: [], summary: content } };
      }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Verification failed" };
    }
  },
});

/**
 * XAI/Grok-powered X profile enrichment — get detailed X profile analysis.
 * Analyzes the user's X presence including recent posts, style, topics.
 */
export const enrichXProfile = action({
  args: {
    xUsername: v.string(),
    profileData: v.optional(v.any()), // Existing scraped data from the scraper
  },
  handler: async (_ctx, args) => {
    const xaiKey = process.env.XAI_API_KEY;
    if (!xaiKey) {
      return { success: false, error: "XAI_API_KEY not configured" };
    }

    const scraped = args.profileData || {};

    try {
      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${xaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "grok-3-mini",
          messages: [
            {
              role: "system",
              content: "You are an identity research assistant. Analyze the X/Twitter profile described and provide structured insights. Be factual and concise.",
            },
            {
              role: "user",
              content: `Analyze the X/Twitter profile @${args.xUsername}.
${scraped.bio ? `Their bio says: "${scraped.bio}"` : ""}
${scraped.followers ? `They have ${scraped.followers} followers.` : ""}
${scraped.location ? `Location: ${scraped.location}` : ""}

Please provide:
1. A brief summary of who this person is based on their X presence
2. Their likely profession/industry
3. Key topics they post about
4. Their communication style (formal, casual, technical, etc.)
5. Any notable connections or communities they're part of

Keep each point to 1-2 sentences. Be specific, not generic.`,
            },
          ],
          max_tokens: 600,
          temperature: 0.4,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return { success: false, error: `XAI ${response.status}: ${errorBody.slice(0, 200)}` };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      return { success: true, analysis: content || "No analysis available." };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "XAI enrichment failed" };
    }
  },
});

/** Call Anthropic API directly — Claude Sonnet 4.6 */
async function callAnthropic(
  apiKey: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  const systemMessage = messages.find((m) => m.role === "system");
  const conversationMessages = messages.filter((m) => m.role !== "system");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6-20250520",
      max_tokens: 4096,
      temperature: 0.7,
      system: systemMessage?.content || "",
      messages: conversationMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic ${response.status}: ${errorBody.slice(0, 300)}`);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text;
  if (!content) throw new Error("Empty response from Anthropic");
  return content;
}

/** Call OpenRouter API (fallback) */
async function callOpenRouter(
  apiKey: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://you.md",
      "X-Title": "You.md Agent",
    },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-4",
      messages,
      temperature: 0.7,
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenRouter ${response.status}: ${errorBody.slice(0, 300)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenRouter");
  return content;
}

/**
 * Summarize a chat session — generates a 1-2 sentence summary.
 * Uses Haiku for cost-efficiency since this is a background task.
 */
export const summarizeSession = action({
  args: {
    sessionId: v.string(),
    messages: v.array(
      v.object({
        role: v.string(),
        content: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Only summarize if there are enough messages
    if (args.messages.length < 4) return { summary: null };

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) return { summary: null };

    // Build a compact summary request
    const conversationText = args.messages
      .filter((m) => m.role !== "system")
      .slice(-20) // last 20 messages max
      .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
      .join("\n");

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 100,
          temperature: 0,
          system: "summarize this conversation in 1 short sentence. be specific about what was discussed. no preamble, just the summary.",
          messages: [
            {
              role: "user",
              content: conversationText,
            },
          ],
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) return { summary: null };

      const data = await response.json();
      const summary = data.content?.[0]?.text?.trim();
      return { summary: summary || null };
    } catch {
      return { summary: null };
    }
  },
});
