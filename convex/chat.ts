"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";

/**
 * Proxy for CLI onboarding chat — routes LLM calls through the backend
 * so the OpenRouter API key stays server-side.
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
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY not configured on server");
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://you.md",
        "X-Title": "You.md Onboarding",
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4",
        messages: args.messages,
        temperature: 0.7,
        max_tokens: 2048,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`LLM API error ${response.status}: ${errorBody.slice(0, 300)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from LLM");
    }

    return content;
  },
});
